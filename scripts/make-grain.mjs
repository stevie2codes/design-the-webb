// One-off: writes public/textures/grain-128.png, a 128×128 8-bit grayscale
// noise tile for the Atmosphere grain layer (SPEC §2.4). No dependencies:
// PNG chunks are assembled by hand and compressed with node's zlib.
// Deterministic (mulberry32), so re-running produces the same file.
//
//   node scripts/make-grain.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZE = 128;
const out = new URL('../public/textures/grain-128.png', import.meta.url);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Gaussian-ish grain (sum of 3 uniforms) centred on mid-grey: reads as film
// grain rather than harsh salt-and-pepper once scaled down to ~4% opacity.
const rand = mulberry32(0x5eb);
const raw = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE + 1);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const g = (rand() + rand() + rand()) / 3;
    raw[row + 1 + x] = Math.max(0, Math.min(255, Math.round(128 + (g - 0.5) * 2 * 150)));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // colour type: grayscale
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, png);
console.log(`make-grain: wrote public/textures/grain-128.png (${png.length} bytes)`);
