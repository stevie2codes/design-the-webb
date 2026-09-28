/**
 * `?debug=field` overlay (SPEC §12, §2.3 rule 5, §9.8 step 6). Loaded only
 * when the param is present (dynamic import from the engine).
 *
 * A 2D canvas above everything (aria-hidden, pointer-events none) showing:
 * - a readout: F / target, segment and pair, mix, tier / drawRange / DPR /
 *   glow / bokeh cap, fps, aperture, print + lock + intro, film ceiling and
 *   resident states, S1 sampling source, adaptive steps, safe-rect luminance;
 * - the text-safe rects the shader masks this frame (green when the field
 *   behind them stays at or below #262A34 before the scrim, red above);
 * - the measured anchor boxes (store.anchors) where they sit now;
 * - S1 registration: every sampled glyph point as a 1px dot plus the DOM
 *   glyph boxes, drawn at the live S1 anchor — they must sit on the <h1>
 *   (acceptance ≤ 1 CSS px, §9.8).
 * Drawn at ≤ 12 Hz; luminance sampled at 2 Hz with readPixels right after
 * the field's render (debug only).
 */
import { anchorCenter } from '../scroll/anchors.ts';
import { SEGMENTS } from '../scroll/segments.ts';
import { store, type FieldFrame } from '../scroll/store.ts';
import { STATE_NAME, StateId } from './states/ids.ts';
import type { NameSample } from './states/name-sampler.ts';
import type { FieldStats } from './index.ts';

export interface DebugSource {
  stats(): FieldStats;
  name(): NameSample | null;
  readonly gl: WebGL2RenderingContext;
  dpr(): number;
}

export interface DebugOverlay {
  /** Call right after the field rendered (same task: the drawing buffer is still readable). */
  afterRender(f: Readonly<FieldFrame>): void;
  dispose(): void;
}

const DRAW_MS = 1000 / 12;
const LUMA_MS = 500;
/** §2.2: the raw haze worst case the scrim is rated for. */
const LUMA_LIMIT_HEX = 0x262a34;

const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const relLum = (r: number, g: number, b: number): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const LUMA_LIMIT = relLum((LUMA_LIMIT_HEX >> 16) & 255, (LUMA_LIMIT_HEX >> 8) & 255, LUMA_LIMIT_HEX & 255);
const hex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

export function createDebugOverlay(src: DebugSource): DebugOverlay {
  const el = document.createElement('canvas');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-field-debug', '');
  el.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:75;pointer-events:none';
  document.body.appendChild(el);
  const ctx = el.getContext('2d');

  let lastDraw = 0;
  let lastLuma = 0;
  // Per safe rect: brightest pixel (luminance, hex), −1 = not sampled.
  const lumaVal = new Float32Array(6).fill(-1);
  const lumaHex: string[] = new Array(6).fill('');
  let buf = new Uint8Array(0);

  let dotsFor: NameSample | null = null;
  let dots: HTMLCanvasElement | null = null;
  let dotsX = 0;
  let dotsY = 0;
  const c2: [number, number] = [0, 0];

  function sampleLuma(f: Readonly<FieldFrame>): void {
    const gl = src.gl;
    const dpr = src.dpr();
    const bw = gl.drawingBufferWidth;
    const bh = gl.drawingBufferHeight;
    for (let k = 0; k < 6; k++) {
      lumaVal[k] = -1;
      if (k >= f.safe.count) continue;
      const r = f.safe.rects;
      const x0 = Math.max(0, Math.floor(r[k * 4] * dpr));
      const x1 = Math.min(bw, Math.ceil(r[k * 4 + 2] * dpr));
      const yTop = Math.max(0, Math.floor(r[k * 4 + 1] * dpr));
      const yBot = Math.min(bh, Math.ceil(r[k * 4 + 3] * dpr));
      const w = x1 - x0;
      const h = yBot - yTop;
      if (w <= 0 || h <= 0) continue;
      if (buf.length < w * h * 4) buf = new Uint8Array(w * h * 4);
      gl.readPixels(x0, bh - yBot, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let best = 0;
      let bi = 0;
      for (let i = 0; i < w * h * 4; i += 8) {
        const l = relLum(buf[i], buf[i + 1], buf[i + 2]);
        if (l > best) {
          best = l;
          bi = i;
        }
      }
      lumaVal[k] = best;
      lumaHex[k] = hex(buf[bi], buf[bi + 1], buf[bi + 2]);
    }
  }

  function buildDots(n: NameSample): void {
    dotsFor = n;
    const d = n.dots;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < d.length; i += 2) {
      x0 = Math.min(x0, d[i]);
      x1 = Math.max(x1, d[i]);
      y0 = Math.min(y0, d[i + 1]);
      y1 = Math.max(y1, d[i + 1]);
    }
    const b = n.boxes;
    for (let i = 0; i < b.length; i += 4) {
      x0 = Math.min(x0, b[i]);
      y0 = Math.min(y0, b[i + 1]);
      x1 = Math.max(x1, b[i + 2]);
      y1 = Math.max(y1, b[i + 3]);
    }
    if (!Number.isFinite(x0)) {
      dots = null;
      return;
    }
    const s = window.devicePixelRatio || 1;
    x0 -= 2;
    y0 -= 2;
    dotsX = x0;
    dotsY = y0;
    dots = document.createElement('canvas');
    dots.width = Math.ceil((x1 - x0 + 4) * s);
    dots.height = Math.ceil((y1 - y0 + 4) * s);
    const g = dots.getContext('2d');
    if (!g) return;
    g.scale(s, s);
    g.strokeStyle = 'rgba(255, 214, 0, 0.55)';
    g.lineWidth = 1 / s;
    for (let i = 0; i < b.length; i += 4) g.strokeRect(b[i] - x0, b[i + 1] - y0, b[i + 2] - b[i], b[i + 3] - b[i + 1]);
    g.fillStyle = 'rgba(80, 255, 200, 0.9)';
    const px = 1 / s;
    for (let i = 0; i < d.length; i += 2) g.fillRect(d[i] - x0 - px / 2, d[i + 1] - y0 - px / 2, px, px);
  }

  function draw(f: Readonly<FieldFrame>): void {
    if (!ctx) return;
    const s = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (el.width !== Math.round(W * s) || el.height !== Math.round(H * s)) {
      el.width = Math.round(W * s);
      el.height = Math.round(H * s);
    }
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';

    // Anchor boxes (measured), where they sit at this scroll position.
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    for (const [id, rec] of store.anchors) {
      anchorCenter(id, store, c2);
      ctx.strokeStyle = 'rgba(140, 151, 173, 0.85)';
      ctx.strokeRect(c2[0] - rec.w / 2, c2[1] - rec.h / 2, rec.w, rec.h);
      ctx.fillStyle = 'rgba(140, 151, 173, 0.95)';
      ctx.fillText(`S${id} ${STATE_NAME[id]}`, c2[0] - rec.w / 2 + 3, c2[1] - rec.h / 2 + 3);
    }
    ctx.setLineDash([]);

    // Text-safe rects with the luminance verdict.
    const r = f.safe.rects;
    for (let k = 0; k < f.safe.count; k++) {
      const over = lumaVal[k] > LUMA_LIMIT;
      ctx.strokeStyle = lumaVal[k] < 0 ? 'rgba(255,255,255,0.5)' : over ? 'rgba(255,70,50,0.95)' : 'rgba(110,230,140,0.8)';
      ctx.strokeRect(r[k * 4] + 0.5, r[k * 4 + 1] + 0.5, r[k * 4 + 2] - r[k * 4] - 1, r[k * 4 + 3] - r[k * 4 + 1] - 1);
      ctx.fillStyle = ctx.strokeStyle;
      const label = `safe ${k}${lumaVal[k] >= 0 ? ` max ${lumaHex[k]}${over ? ' > #262a34' : ''}` : ''}`;
      ctx.fillText(label, r[k * 4] + 3, Math.max(r[k * 4 + 1] + 3, 2));
    }

    // S1 registration dots at the live S1 anchor, at the scale the field
    // draws S1 (≠ 1 only until an in-place resample lands, §9.8).
    const st = src.stats();
    const n = src.name();
    if (n && n !== dotsFor) buildDots(n);
    if (n && dots) {
      anchorCenter(StateId.NAME, store, c2);
      const k = st.name?.scale ?? 1;
      ctx.drawImage(dots, c2[0] + dotsX * k, c2[1] + dotsY * k, (dots.width / s) * k, (dots.height / s) * k);
    }

    // Readout.
    const seg = f.seg >= 0 ? SEGMENTS[store.layout].film[f.seg] : undefined;
    let lumaMax = -1;
    let lumaAt = -1;
    for (let k = 0; k < f.safe.count; k++) {
      if (lumaVal[k] > lumaMax) {
        lumaMax = lumaVal[k];
        lumaAt = k;
      }
    }
    const lines = [
      `F ${f.F.toFixed(3)}  → ${f.target.toFixed(3)}   seg ${f.seg}${seg ? ` ${seg.name}` : ' route'}   S${f.a}→S${f.b}  m ${f.mix.toFixed(3)}`,
      `tier ${st.tier}${st.forced ? ' (forced)' : ''}  tex ${st.textureTier}  N ${st.N}  draw ${st.drawRange}  dpr ${st.dpr}  glow ${st.glow ? 'on' : 'off'}  bokeh ${st.bokehCap}`,
      `fps ${st.fps.toFixed(0)}  aperture ${f.aperture.toFixed(3)}  S ${f.stagger} T ${f.turb} path ${f.path}  opacity ${f.opacity.toFixed(2)}`,
      `printed ${f.printed.toFixed(2)}  lock ${store.flags.printedLock ? 'on' : 'off'}  intro ${st.intro ? 'running' : '-'}  cut ${f.cutting ? 'yes' : 'no'}  mode ${st.mode}`,
      `ceiling S${st.ceiling}  resident ${st.resident.map((i) => `S${i}`).join(' ')}`,
      `S1 ${st.name ? `${st.name.source}  font ${st.name.fontReady ? 'archivo' : 'fallback'}  ${st.name.ms}ms  scale ${st.name.scale}  ${n ? n.dots.length / 2 : 0} dots` : 'pending'}${n ? `  (${Object.entries(n.phases).map(([k, v]) => `${k} ${v}`).join(' · ')})` : ''}`,
      `scroll ${store.scroll.y.toFixed(0)}  vel ${f.velocity.toFixed(2)}  mouse ${f.mouseAmt.toFixed(2)}  safe ${f.safe.count}`,
      `adaptive ${st.adaptive.length ? st.adaptive.join(' > ') : '-'}${st.lost ? '  CONTEXT LOST' : ''}`,
      `luma ${lumaAt >= 0 ? `max ${lumaHex[lumaAt]} (safe ${lumaAt}) ${lumaMax > LUMA_LIMIT ? 'OVER #262a34' : 'ok'}` : '-'}`,
    ];
    const x = 12;
    const y = 76;
    const lh = 14;
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x - 6, y - 5, w + 12, lines.length * lh + 8);
    ctx.fillStyle = 'rgba(242, 238, 230, 0.95)';
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  }

  return {
    afterRender(f) {
      const now = performance.now();
      if (now - lastLuma >= LUMA_MS) {
        lastLuma = now;
        try {
          sampleLuma(f);
        } catch {
          /* readPixels unavailable: no verdict */
        }
      }
      if (now - lastDraw >= DRAW_MS) {
        lastDraw = now;
        draw(f);
      }
    },
    dispose() {
      el.remove();
    },
  };
}
