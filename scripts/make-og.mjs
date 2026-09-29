// Writes the Open Graph / Twitter card image (SPEC §9.11): a 1200×630 still of
// the S1 lock — the printed name and its halo over the live field — taken from
// the real production build with Playwright.
//
//   node scripts/make-og.mjs                 # vite build → preview → screenshot
//   node scripts/make-og.mjs --no-build      # reuse --dist (default .qa/dist-og)
//   node scripts/make-og.mjs --url http://127.0.0.1:4173   # shoot a server you run
//   options: --dist <dir> --port 4303 --format png|jpeg --quality 88 --out <file>
//
// How the still is framed:
//   /?intro=0&debug   no §6 intro; `debug` exposes window.__lenis / __field and
//                     allows software GL (headless Chromium renders with SwiftShader)
//   scroll to 70% of the hero's sticky run (past HERO_P.p1 = .62, the lock threshold),
//   wait for __field.ready and the print to finish, then hide the chrome (nav, rail,
//   HUD, CTAs, scroll cue) with visibility:hidden so nothing reflows.
//
// Playwright is not a project dependency: set PLAYWRIGHT to its index.mjs
// (default /opt/node22/lib/node_modules/playwright/index.mjs).
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (k) => args.includes('--' + k);

const W = 1200;
const H = 630;
const VH = +opt('vh', 760);
const format = opt('format', 'png');
const quality = +opt('quality', 88);
// PNG only. The screenshot is re-encoded losslessly (adaptive row filters, zlib 9).
// If that is still over the 300 KB budget (the field's grain is high-entropy), the
// low bits of near-black pixels (all channels < --dark-max) are dropped, one bit at
// a time, up to --dark-bits. Two bits start to show as banding at the scrim edges.
const BUDGET = 300_000; // bytes
const maxDarkBits = +opt('dark-bits', 2);
const darkMax = +opt('dark-max', 48);
const out = opt('out', `public/og-image.${format === 'jpeg' ? 'jpg' : 'png'}`);
const dist = opt('dist', '.qa/dist-og');
const port = +opt('port', 4303);
let base = opt('url', null);

const { chromium } = await import(process.env.PLAYWRIGHT ?? '/opt/node22/lib/node_modules/playwright/index.mjs');

// --- Minimal PNG re-encoder (8-bit RGB / RGBA, no interlace) -----------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const x of buf) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
function decodePng(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), depth = buf[24], type = buf[25], lace = buf[28];
  if (depth !== 8 || (type !== 2 && type !== 6) || lace) throw new Error('unsupported PNG');
  const bpp = type === 6 ? 4 : 3;
  const idat = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o), kind = buf.toString('latin1', o + 4, o + 8);
    if (kind === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[row + i - bpp] : 0, b = y ? px[up + i] : 0, c = y && i >= bpp ? px[up + i - bpp] : 0;
      const v = raw[src + i];
      px[row + i] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 0xff;
    }
  }
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0, j = 0; i < px.length; i += bpp, j += 3) px.copy(rgb, j, i, i + 3);
  return { w, h, rgb };
}
function encodePng({ w, h, rgb }) {
  const stride = w * 3, raw = Buffer.alloc(h * (stride + 1)), cand = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = y * stride, up = row - stride;
    let best = 0, bestSum = Infinity, bestBuf = null;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? rgb[row + i - 3] : 0, b = y ? rgb[up + i] : 0, c = y && i >= 3 ? rgb[up + i - 3] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (rgb[row + i] - pred) & 0xff;
        cand[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; bestBuf = Buffer.from(cand); }
    }
    raw[y * (stride + 1)] = best;
    bestBuf.copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (kind, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(kind, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function recompress(file) {
  const source = readFileSync(file);
  let bits = 0;
  let png;
  do {
    png = encodePng(posterizeDarks(decodePng(source), bits));
  } while (png.length > BUDGET && ++bits <= maxDarkBits);
  writeFileSync(file, png);
  return Math.min(bits, maxDarkBits);
}
function posterizeDarks(img, darkBits) {
  if (darkBits > 0) {
    const mask = 0xff & ~((1 << darkBits) - 1);
    for (let i = 0; i < img.rgb.length; i += 3) {
      if (img.rgb[i] < darkMax && img.rgb[i + 1] < darkMax && img.rgb[i + 2] < darkMax) {
        img.rgb[i] &= mask;
        img.rgb[i + 1] &= mask;
        img.rgb[i + 2] &= mask;
      }
    }
  }
  return img;
}

let server = null;
if (!base) {
  if (!flag('no-build')) {
    const r = spawnSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  server = spawn('npx', ['vite', 'preview', '--outDir', dist, '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base + '/')).ok) break;
    } catch {
      /* not up yet */
    }
    if (i > 100) throw new Error('vite preview did not start on ' + base);
    await new Promise((r) => setTimeout(r, 150));
  }
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  // A slightly taller viewport, then a 1200×630 clip centred on the text block
  // (eyebrow → lede): the hero composes for a full screen, not a 1.9:1 card.
  const page = await browser.newPage({ viewport: { width: W, height: VH }, deviceScaleFactor: 1 });
  await page.goto(base + '/?intro=0&debug', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__field?.ready && window.__lenis, null, { timeout: 60_000 });
  // Scroll into the lock: 70% of the hero's sticky run (p1 = .62 on desktop).
  await page.evaluate(() => {
    const hero = document.querySelector('main section');
    const run = hero.offsetHeight - innerHeight;
    window.__lenis.scrollTo(Math.round(run * 0.7), { immediate: true, force: true });
  });
  await page.waitForFunction(() => window.__field.store?.flags.printedLock === true, null, { timeout: 30_000 });
  await page.waitForTimeout(3000); // the print sweep, then the halo settles
  await page.addStyleTag({
    content: `
      header, .fixed.right-6, .t-micro.fixed, [data-scroll-cue],
      #top .stage a { visibility: hidden !important; }
    `,
  });
  await page.waitForTimeout(2500);
  const box = await page.evaluate(() => {
    const top = document.querySelector('#top .stage p[data-safe]').getBoundingClientRect().top;
    const bottom = document.querySelector('#top .stage [data-cursor="text"]').getBoundingClientRect().bottom;
    return { top, bottom };
  });
  const y = Math.max(0, Math.min(VH - H, Math.round((box.top + box.bottom) / 2 - H / 2)));
  await page.screenshot({
    path: out,
    type: format,
    clip: { x: 0, y, width: W, height: H },
    ...(format === 'jpeg' ? { quality } : {}),
  });
  const shot = statSync(out).size;
  if (format === 'png') {
    const bits = recompress(out);
    console.log(`screenshot ${(shot / 1000).toFixed(1)} kB → re-encoded${bits ? `, ${bits} dark bit(s) dropped` : ' losslessly'}`);
  }
  console.log(`wrote ${out} (${W}×${H}, ${(statSync(out).size / 1000).toFixed(1)} kB)`);
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
