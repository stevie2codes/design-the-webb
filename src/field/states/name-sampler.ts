/**
 * S1 NAME — registered to the DOM <h1> (SPEC §3.10, §9.8). Main thread only.
 *
 * 1. Wait for the h1 font (≤ 1.5 s); if it is still missing, sample with the
 *    fallback stack — the computed font-family, i.e. what the DOM shows.
 *    The engine resamples once on `document.fonts` `loadingdone`.
 * 2. Per glyph: Range + getClientRects() for DOM x / width; per line a
 *    zero-size inline-block probe gives the baseline.
 * 3. Draw every glyph at ITS DOM x on a canvas of the h1 rect × 2 (≤ 2048px
 *    wide), with a per-glyph width lock sx = domWidth / measureText (clamped
 *    .6–1.6), so browsers that ignore fontStretch / letterSpacing still match.
 * 4. Keep alpha > 128; edge pixels (a 4-neighbour ≤ 128) weigh 2×; sample
 *    82% of M by weighted stratified sampling, jittered ±.4 canvas px, mapped
 *    to su relative to the S1 ANCHOR centre ([data-field-anchor="S1"]) — the
 *    point the director's uOff follows — so glyph-box vs anchor-box offsets
 *    are baked in and registration holds at any scroll position.
 * 18% atmospheric band; sparks draw an ember hairline .14em under the last
 * baseline, across the name. Sort: 64 column bins then y (shared with S0 / S2).
 *
 * Without a hero <h1> (another route at boot) it falls back to the layout.ts
 * cap box and a whole-line draw; the engine resamples once the hero mounts.
 */
import { StateId } from './ids.ts';
import {
  COLUMNS_64,
  RAMP,
  TargetList,
  mulberry32,
  packState,
  sortTargets,
  stateSeed,
  type DustData,
  type GenViewport,
  type IndexLayout,
} from './common.ts';
import { NAME_METRICS, resolveAnchor, type LayoutMode } from '../layout.ts';
import { Role } from '../uniforms.ts';

/** The font the DOM name uses (§2.5, §9.8 step 1). */
export const NAME_FONT_SPEC = '800 condensed 100px "Archivo Variable"';
const FALLBACK_FAMILY = '"Archivo Variable", ui-sans-serif, system-ui, sans-serif';

/** Shares of M (§3.10 S1). */
const GLYPH_SHARE = 0.82;
/** Spark hairline offset below the baseline, in em. */
const HAIRLINE_EM = 0.14;
/** Canvas resolution: h1 rect × 2, capped at 2048px wide. */
const RASTER_SCALE = 2;
const RASTER_MAX_W = 2048;

export interface NameElements {
  readonly h1: HTMLElement | null;
  readonly anchor: HTMLElement | null;
}

/** The hero name and its anchor box, if the hero is mounted. */
export function findNameElements(doc: Document = document): NameElements {
  const anchor = doc.querySelector<HTMLElement>('[data-field-anchor="S1"]');
  const scope: ParentNode = anchor?.closest('.stage') ?? anchor?.parentElement ?? doc;
  const h1 = scope.querySelector<HTMLElement>('h1.scan-print') ?? doc.querySelector<HTMLElement>('#top h1');
  return { h1, anchor };
}

/** Wait (≤ timeout) for the name font; true when it is ready. */
export async function waitForNameFont(timeoutMs = 1500): Promise<boolean> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return true;
  try {
    await Promise.race([fonts.load(NAME_FONT_SPEC), new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch {
    /* a failed load falls through to the fallback stack */
  }
  return isNameFontReady();
}

export function isNameFontReady(): boolean {
  try {
    return typeof document === 'undefined' || !document.fonts || document.fonts.check(NAME_FONT_SPEC);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Measuring.

/** One drawn run (a glyph, or a whole line in the layout fallback), in viewport CSS px. */
interface Run {
  readonly text: string;
  readonly x: number;
  /** DOM advance width for the width lock; null = no lock. */
  readonly w: number | null;
  readonly baseline: number;
  readonly line: number;
}

interface Line {
  readonly x0: number;
  readonly x1: number;
  readonly baseline: number;
}

interface Frame {
  /** h1 box, viewport CSS px. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Anchor centre, viewport CSS px. */
  readonly acx: number;
  readonly acy: number;
  readonly font: string;
  readonly stretch: string;
  readonly size: number;
  readonly lines: readonly Line[];
  readonly runs: readonly Run[];
}

const STRETCH_KEYWORDS: ReadonlyArray<readonly [number, string]> = [
  [56.25, 'ultra-condensed'],
  [68.75, 'extra-condensed'],
  [81.25, 'condensed'],
  [93.75, 'semi-condensed'],
  [106.25, 'normal'],
  [118.75, 'semi-expanded'],
  [137.5, 'expanded'],
  [175, 'extra-expanded'],
];

function stretchKeyword(value: string): string {
  const pct = parseFloat(value);
  if (!Number.isFinite(pct)) return /condensed|expanded|normal/.test(value) ? value : 'normal';
  for (const [max, kw] of STRETCH_KEYWORDS) if (pct <= max) return kw;
  return 'ultra-expanded';
}

function measureDom(h1: HTMLElement, anchorEl: HTMLElement | null): Frame | null {
  const rect = h1.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const cs = getComputedStyle(h1);
  const size = parseFloat(cs.fontSize) || 16;
  const upper = cs.textTransform === 'uppercase';
  const stretch = stretchKeyword(cs.fontStretch);
  const lineEls = Array.from(h1.querySelectorAll<HTMLElement>('[data-name-line]'));
  const range = document.createRange();
  const runs: Run[] = [];
  const lines: Line[] = [];

  (lineEls.length ? lineEls : [h1]).forEach((el, li) => {
    // Baseline probe: a zero-size inline-block sits on the line's baseline.
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
    el.appendChild(probe);
    const baseline = probe.getBoundingClientRect().bottom;
    probe.remove();

    let x0 = Infinity;
    let x1 = -Infinity;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue ?? '';
      for (let k = 0; k < text.length; k++) {
        const ch = text[k];
        if (/\s/.test(ch)) continue;
        range.setStart(n, k);
        range.setEnd(n, k + 1);
        const r = range.getClientRects()[0];
        if (!r || r.width <= 0) continue;
        runs.push({ text: upper ? ch.toUpperCase() : ch, x: r.left, w: r.width, baseline, line: li });
        x0 = Math.min(x0, r.left);
        x1 = Math.max(x1, r.right);
      }
    }
    if (x1 > x0) lines.push({ x0, x1, baseline });
  });
  if (!runs.length) return null;

  const a = anchorEl?.getBoundingClientRect();
  const hasAnchor = !!a && a.width > 0 && a.height > 0;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    acx: hasAnchor ? a.left + a.width / 2 : rect.left + rect.width / 2,
    acy: hasAnchor ? a.top + a.height / 2 : rect.top + rect.height / 2,
    font: `${cs.fontStyle} ${cs.fontWeight} ${stretch} SIZEpx ${cs.fontFamily}`,
    stretch,
    size,
    lines,
    runs,
  };
}

/** The layout.ts cap box, drawn as whole lines (no hero on this route). Stage-local px. */
function layoutFrame(view: GenViewport, mode: LayoutMode): Frame {
  const b = resolveAnchor(StateId.NAME, mode, { W: view.W, H: view.svh });
  const M = NAME_METRICS;
  const runs: Run[] = [];
  let size: number;
  if (mode === 'mobile') {
    size = b.h / (2 * M.lineHeight);
    const base0 = b.y + 0.76 * size;
    runs.push({ text: 'STEPHEN', x: b.x, w: M.stephenEm * size, baseline: base0, line: 0 });
    runs.push({ text: 'WEBB', x: b.x, w: null, baseline: base0 + M.lineHeight * size, line: 1 });
  } else {
    size = b.h / M.capEm;
    runs.push({ text: 'STEPHEN WEBB', x: b.x, w: b.w, baseline: b.y + b.h, line: 0 });
  }
  const lines = runs.map((r) => ({ x0: r.x, x1: r.x + (r.w ?? M.stephenEm * size * 0.6), baseline: r.baseline }));
  return {
    left: b.x,
    top: b.y - 0.1 * size,
    width: b.w,
    height: b.h + 0.2 * size,
    acx: b.cx,
    acy: b.cy,
    font: `normal 800 condensed SIZEpx ${FALLBACK_FAMILY}`,
    stretch: 'condensed',
    size,
    lines,
    runs,
  };
}

// ---------------------------------------------------------------------------
// Sampling.

export interface NameSample {
  readonly pos: Float32Array;
  readonly meta: Uint8Array;
  readonly source: 'dom' | 'layout';
  /** The Archivo face was available when sampling (else: fallback stack). */
  readonly fontReady: boolean;
  /** The h1 box in local su (relative to the anchor centre): the beam's run. */
  readonly bounds: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
  /** Debug: glyph sample points, CSS px relative to the anchor centre (x, y pairs). */
  readonly dots: Float32Array;
  /** Debug: glyph boxes, CSS px relative to the anchor centre (x0, y0, x1, y1). */
  readonly boxes: Float32Array;
  readonly ms: number;
  /** Time per phase (ms): measure, draw, readback, classify, sample, sort, pack. */
  readonly phases: Readonly<Record<string, number>>;
}

export interface NameSampleInput {
  readonly layout: IndexLayout;
  readonly dust: DustData;
  readonly view: GenViewport;
  readonly mode: LayoutMode;
  readonly elements: NameElements;
}

let raster: HTMLCanvasElement | null = null;

export function sampleName(input: NameSampleInput): NameSample {
  const t0 = performance.now();
  const phases: Record<string, number> = {};
  let tp = t0;
  const mark = (name: string) => {
    const t = performance.now();
    phases[name] = Math.round((t - tp) * 10) / 10;
    tp = t;
  };
  const { layout, view } = input;
  const dom = input.elements.h1 ? measureDom(input.elements.h1, input.elements.anchor) : null;
  mark('measure');
  const f = dom ?? layoutFrame(view, input.mode);
  const rand = mulberry32(stateSeed(StateId.NAME));
  const suK = view.H > 0 ? 2 / view.H : 0;
  const toSuX = (x: number) => (x - f.acx) * suK;
  const toSuY = (y: number) => -(y - f.acy) * suK;
  const normX = (x: number) => Math.min(1, Math.max(0, (x - f.left) / Math.max(1, f.width)));
  const cap = NAME_METRICS.capEm * f.size;
  // Group = line index: split halfway between consecutive line centres.
  const lineSplits = f.lines.slice(1).map((l, i) => (f.lines[i].baseline + l.baseline) / 2 - cap / 2);
  const lineOf = (y: number): number => {
    let i = 0;
    while (i < lineSplits.length && y > lineSplits[i]) i++;
    return i;
  };

  // 3. Raster.
  const pad = 0.25 * f.size;
  const ox = f.left - pad;
  const oy = f.top - pad;
  const wCss = f.width + 2 * pad;
  const hCss = f.height + 2 * pad;
  const k = Math.min(RASTER_SCALE, RASTER_MAX_W / wCss);
  const cw = Math.max(1, Math.ceil(wCss * k));
  const ch = Math.max(1, Math.ceil(hCss * k));
  raster ??= document.createElement('canvas');
  raster.width = cw;
  raster.height = ch;
  const ctx = raster.getContext('2d', { willReadFrequently: true });
  const shape = new TargetList(layout.M);
  const spark = new TargetList(layout.S);
  const nGlyph = Math.round(layout.M * GLYPH_SHARE);
  const dots = new Float32Array(nGlyph * 2);
  let nDots = 0;

  if (ctx) {
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = f.font.replace('SIZE', String(f.size * k));
    if ('fontStretch' in ctx) ctx.fontStretch = f.stretch as CanvasFontStretch;
    for (const r of f.runs) {
      const x = (r.x - ox) * k;
      const b = (r.baseline - oy) * k;
      let sx = 1;
      if (r.w !== null) {
        const m = ctx.measureText(r.text).width;
        if (m > 0) sx = Math.min(1.6, Math.max(0.6, (r.w * k) / m));
      }
      ctx.setTransform(sx, 0, 0, 1, x * (1 - sx), 0);
      ctx.fillText(r.text, x, b);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    mark('draw');

    // 4. alpha > 128 → on; edge = an on pixel with a 4-neighbour off
    //    (weight 2), interior weight 1. The .25em pad keeps ink off the
    //    border, so the loops skip the outer ring without bounds checks.
    const img = ctx.getImageData(0, 0, cw, ch).data;
    mark('readback');
    const n = cw * ch;
    const on = new Uint8Array(n);
    for (let i = 0, j = 3; i < n; i++, j += 4) on[i] = img[j] > 128 ? 1 : 0;
    const cls = new Uint8Array(n); // 0 off, 1 interior, 2 edge
    let total = 0;
    for (let y = 1; y < ch - 1; y++) {
      for (let i = y * cw + 1, end = y * cw + cw - 1; i < end; i++) {
        if (!on[i]) continue;
        const c = on[i - 1] & on[i + 1] & on[i - cw] & on[i + cw] ? 1 : 2;
        cls[i] = c;
        total += c;
      }
    }

    mark('classify');
    // Weighted stratified sampling: one sample at a random point of each
    // stratum [s, s + 1)·step of the cumulative weight (scan order). Evenly
    // spread like systematic sampling, without its row-aligned moiré.
    if (total > 0) {
      const step = total / nGlyph;
      let stratum = 0;
      let next = rand() * step;
      let acc = 0;
      for (let i = 0; i < n && shape.count < nGlyph; i++) {
        const c = cls[i];
        if (!c) continue;
        acc += c;
        if (next >= acc) continue;
        const x = i % cw;
        const y = (i - x) / cw;
        while (next < acc && shape.count < nGlyph) {
          next = (++stratum + rand()) * step;
          const cssX = ox + (x + 0.5 + (rand() * 2 - 1) * 0.4) / k;
          const cssY = oy + (y + 0.5 + (rand() * 2 - 1) * 0.4) / k;
          const nx = normX(cssX);
          const edge = c === 2;
          shape.push(
            toSuX(cssX),
            toSuY(cssY),
            (rand() * 2 - 1) * 0.015,
            0.15 + 0.6 * nx + 0.25 * rand(),
            RAMP.signal,
            edge ? 1 : 0.6,
            nx,
            edge ? Role.EDGE : Role.FILL,
            lineOf(cssY),
          );
          dots[nDots++] = cssX - f.acx;
          dots[nDots++] = cssY - f.acy;
        }
      }
    }
  }

  mark('sample');
  // 18% atmospheric band: name centre ± 1.1 cap-heights, 115% of the width.
  const firstBase = f.lines[0]?.baseline ?? f.top + f.height;
  const lastBase = f.lines[f.lines.length - 1]?.baseline ?? firstBase;
  const nameTop = firstBase - cap;
  const cyBand = (nameTop + lastBase) / 2;
  const halfBand = 1.1 * cap + (lastBase - nameTop - cap) / 2;
  const cxBand = f.left + f.width / 2;
  while (!shape.full) {
    const cssX = cxBand + (rand() - 0.5) * 1.15 * f.width;
    const cssY = cyBand + (rand() * 2 - 1) * halfBand;
    const nx = normX(cssX);
    shape.push(toSuX(cssX), toSuY(cssY), -0.6 + rand() * 0.8, 0.15 + 0.6 * nx + 0.25 * rand(), RAMP.steel, 0.1, nx, Role.HALO);
  }

  // Sparks: an ember hairline .14em below the (last) baseline, across the
  // full name width. On the two-line mobile name the lines are only .17em
  // apart, so a hairline under STEPHEN would sit on WEBB's cap line.
  let hx0 = Infinity;
  let hx1 = -Infinity;
  for (const l of f.lines) {
    hx0 = Math.min(hx0, l.x0);
    hx1 = Math.max(hx1, l.x1);
  }
  if (!Number.isFinite(hx0)) {
    hx0 = f.left;
    hx1 = f.left + f.width;
  }
  const hairY = lastBase + HAIRLINE_EM * f.size;
  while (!spark.full) {
    const cssX = hx0 + rand() * (hx1 - hx0);
    const cssY = hairY + (rand() * 2 - 1) * 0.3;
    spark.push(toSuX(cssX), toSuY(cssY), (rand() * 2 - 1) * 0.01, 0, RAMP.ember, 0.9, normX(cssX), Role.SPARK);
  }

  sortTargets(shape, COLUMNS_64, rand);
  sortTargets(spark, COLUMNS_64, rand);
  mark('sort');
  const packed = packState(layout, shape, spark, input.dust);
  mark('pack');

  const boxes = new Float32Array(f.runs.length * 4);
  f.runs.forEach((r, i) => {
    boxes[i * 4] = r.x - f.acx;
    boxes[i * 4 + 1] = r.baseline - cap - f.acy;
    boxes[i * 4 + 2] = r.x + (r.w ?? 0) - f.acx;
    boxes[i * 4 + 3] = r.baseline - f.acy;
  });

  return {
    pos: packed.pos,
    meta: packed.meta,
    source: dom ? 'dom' : 'layout',
    fontReady: isNameFontReady(),
    bounds: { x0: toSuX(f.left), x1: toSuX(f.left + f.width), y0: toSuY(f.top + f.height), y1: toSuY(f.top) },
    dots: dots.subarray(0, nDots),
    boxes,
    ms: performance.now() - t0,
    phases,
  };
}
