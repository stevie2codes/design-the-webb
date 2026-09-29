/**
 * layout.ts — the single source of truth for field-registered layout
 * (SPEC §2.6, §3.10, §4.2, §9.6).
 *
 * Every home state has an anchor box authored in viewport units (vw/svh),
 * one for the desktop layout and one for the mobile layout. The same numbers
 * reach three consumers:
 *   1. CSS custom properties on :root (`--anchor-chart-x`, …) that position the
 *      empty `[data-field-anchor="S2"]` boxes and the DOM labels registered to
 *      the shapes. The static copy lives in src/index.css between the
 *      `@generated layout-vars` markers (run `npm run gen:layout` after editing
 *      this file); applyLayoutVars() re-injects the same values at boot, so the
 *      two can never drift at runtime.
 *   2. resolveAnchor() for the engine/worker (px for a given viewport).
 *   3. Constants shared by DOM and generators (chart geometry, card aspect…).
 *
 * Pure module: no DOM access at import time (the generator worker and the
 * node script scripts/gen-layout-css.mjs import it). Imports carry explicit
 * .ts extensions so node's type stripping can load it.
 */
import { STATE_NAME, StateId, stateKey } from './states/ids.ts';
import type { ChapterId } from '../scroll/chapters.ts';

export type LayoutMode = 'desktop' | 'mobile';

/**
 * Media queries for the layout rule (§2.6, §4.2).
 * Mobile layout: width < 768, or width < 1024 in portrait — except short
 * landscape phones (landscape and height < 500), which use the desktop split
 * layout with only the hero sticky. The pre-paint script in index.html
 * repeats MQ.mobile verbatim; keep them identical.
 */
export const MQ = {
  mobile: '(max-width: 1023.98px) and (orientation: portrait), (max-width: 767.98px) and (min-height: 500px)',
  desktop:
    '(min-width: 1024px), (min-width: 768px) and (orientation: landscape), (orientation: landscape) and (max-height: 499.98px)',
  /** Desktop layout minus short landscape: all desktop sticky chapters apply. */
  desktopTall:
    '(min-width: 1024px) and (min-height: 500px), (min-width: 768px) and (orientation: landscape) and (min-height: 500px)',
  /** Landscape phones with height < 500: desktop layout, Low tier, only the hero sticky. */
  shortLandscape: '(orientation: landscape) and (max-height: 499.98px)',
  /** Height < 600: mobile field slots shrink to 34svh and shapes scale ×.8. */
  short: '(max-height: 599.98px)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  finePointer: '(pointer: fine)',
} as const;

// ---------------------------------------------------------------------------
// Length expressions: tiny typed ASTs that print to CSS or resolve to px.

export type Len =
  | { readonly k: 'px' | 'vw' | 'svh'; readonly v: number }
  | { readonly k: 'add' | 'min' | 'max'; readonly a: readonly Len[] }
  | { readonly k: 'scale'; readonly a: Len; readonly num: number; readonly den: number }
  | { readonly k: 'clamp'; readonly lo: Len; readonly v: Len; readonly hi: Len }
  | RefLen;

/** A named CSS variable; prints as `var(--name)` and resolves through `v`. */
export type RefLen = { readonly k: 'ref'; readonly name: `--${string}`; readonly v: Len };

export const px = (v: number): Len => ({ k: 'px', v });
export const vw = (v: number): Len => ({ k: 'vw', v });
export const svh = (v: number): Len => ({ k: 'svh', v });
export const add = (...a: Len[]): Len => ({ k: 'add', a });
/** a × num / den, folding nested products so the CSS stays readable. */
const scale = (a: Len, num: number, den: number): Len =>
  a.k === 'scale' ? { k: 'scale', a: a.a, num: a.num * num, den: a.den * den } : { k: 'scale', a, num, den };
export const mul = (a: Len, num: number): Len => scale(a, num, 1);
export const div = (a: Len, den: number): Len => scale(a, 1, den);
export const sub = (a: Len, b: Len): Len => add(a, mul(b, -1));
export const min = (...a: Len[]): Len => ({ k: 'min', a });
export const max = (...a: Len[]): Len => ({ k: 'max', a });
export const clamp = (lo: Len, v: Len, hi: Len): Len => ({ k: 'clamp', lo, v, hi });
export const ref = (name: `--${string}`, v: Len): RefLen => ({ k: 'ref', name, v });

const fmt = (x: number): string => String(+x.toFixed(4));

/** A term that is valid anywhere inside a CSS math function. */
function term(l: Len): string {
  switch (l.k) {
    case 'px':
    case 'vw':
    case 'svh':
      return l.v === 0 ? '0px' : `${fmt(l.v)}${l.k}`;
    case 'ref':
      return `var(${l.name})`;
    case 'add':
      return `(${sum(l)})`;
    case 'scale':
      return `(${sum(l)})`;
    case 'min':
    case 'max':
      return `${l.k}(${l.a.map(sum).join(', ')})`;
    case 'clamp':
      return `clamp(${sum(l.lo)}, ${sum(l.v)}, ${sum(l.hi)})`;
  }
}

/** Like term(), without the outer parentheses of a sum or product. */
function sum(l: Len): string {
  if (l.k === 'add') {
    return l.a
      .map((x, i) => {
        // Print `a + (b * -1)` as `a - b`.
        if (i > 0 && x.k === 'scale' && x.num < 0) {
          const pos = x.num === -1 && x.den === 1 ? x.a : scale(x.a, -x.num, x.den);
          return ` - ${term(pos)}`;
        }
        return i > 0 ? ` + ${term(x)}` : term(x);
      })
      .join('');
  }
  if (l.k === 'scale') {
    const num = l.num === 1 ? '' : ` * ${fmt(l.num)}`;
    const den = l.den === 1 ? '' : ` / ${fmt(l.den)}`;
    return `${term(l.a)}${num}${den}`;
  }
  return term(l);
}

/** Print a length as a CSS value, e.g. `calc(62svh + (var(--name-fs) * -0.69))`. */
export function toCss(l: Len): string {
  return l.k === 'add' || l.k === 'scale' ? `calc(${sum(l)})` : term(l);
}

/** Viewport in CSS px. `H` is the small viewport height (the svh basis). */
export interface Viewport {
  readonly W: number;
  readonly H: number;
}

/** Resolve a length to CSS px. */
export function resolveLen(l: Len, vp: Viewport): number {
  switch (l.k) {
    case 'px':
      return l.v;
    case 'vw':
      return (l.v * vp.W) / 100;
    case 'svh':
      return (l.v * vp.H) / 100;
    case 'ref':
      return resolveLen(l.v, vp);
    case 'add':
      return l.a.reduce((s, x) => s + resolveLen(x, vp), 0);
    case 'scale':
      return (resolveLen(l.a, vp) * l.num) / l.den;
    case 'min':
      return Math.min(...l.a.map((x) => resolveLen(x, vp)));
    case 'max':
      return Math.max(...l.a.map((x) => resolveLen(x, vp)));
    case 'clamp':
      return Math.min(Math.max(resolveLen(l.v, vp), resolveLen(l.lo, vp)), resolveLen(l.hi, vp));
  }
}

// ---------------------------------------------------------------------------
// Grid and shared measures.

/** Side gutter (§2.6). Also a Tailwind spacing token: `px-gutter`, `left-gutter`… */
export const GUTTER = ref('--gutter', clamp(px(20), vw(4), px(64)));
/** 12-column grid column gap (§2.6). Tailwind: `gap-x-col-gap`. */
export const COL_GAP = ref('--col-gap', clamp(px(12), vw(1.6), px(28)));
/** Content width between the gutters. */
export const CONTENT_W: Len = sub(vw(100), mul(GUTTER, 2));

/** Measured Archivo metrics for the name (§2.5). */
export const NAME_METRICS = {
  /** "STEPHEN WEBB" at 800 / stretch 75% / uppercase, in em. */
  widthEm: 6.518,
  /** "STEPHEN" alone, in em. */
  stephenEm: 3.9,
  capEm: 0.69,
  lineHeight: 0.86,
  /** Mobile font-size divisor: font-size = content width / 3.92. */
  mobileDivisor: 3.92,
} as const;

/**
 * The name as a career timeline (hero idea #9), shared by the S1 sampler
 * (particle colour, focus group, hairline ticks) and the hero's DOM axis.
 * Read left → right it spans `years`; the first `devYears` are the developer
 * years (steel, focus group `groups.dev`), the rest product design (signal,
 * `groups.design`). The values are the `stats` counts in content/site.ts.
 * The hairline sits `hairlineEm` below the baseline.
 */
export const NAME_TIMELINE = {
  years: 6,
  devYears: 2,
  /** Focus groups: the two spans, and `rest` (the band and the hairline) that no hover dims. */
  groups: { dev: 0, design: 1, rest: 7 },
  hairlineEm: 0.14,
} as const;

/**
 * `.t-name` font-size (§2.5). Desktop: min(13.2vw, 30svh), one line.
 * Mobile: two lines sized so STEPHEN fits between the gutters. The spec
 * writes `(100vw − 40px) / 3.92`, which is the same value at phone widths
 * (gutter = 20px up to 500px wide); using the real gutter keeps portrait
 * tablets (gutter > 20px) from overflowing.
 */
export const NAME_FS: Readonly<Record<LayoutMode, RefLen>> = {
  desktop: ref('--name-fs', min(vw(13.2), svh(30))),
  mobile: ref('--name-fs', div(CONTENT_W, NAME_METRICS.mobileDivisor)),
};

/** Screenshots and the project card box: 1200 × 953 (§3.10, §5 C3). */
export const CARD = {
  imgW: 1200,
  imgH: 953,
  /** Emblems fill 90% of their box (aspect-fit); halo elements may exceed it. */
  emblemFill: 0.9,
} as const;

/**
 * Card width: min(44vw, 88.1svh) on desktop (§5 C3); full content width
 * inline on mobile. Tuned (CONTRACTS.md): also ≤ (50svh − 128px) × 2 × 1200/953,
 * so the card's top (50svh − h/2) stays ≥ 128px, below the C3 chrome
 * ("Side projects" / "01 / 04" at max(104px, 11svh)). Binds only on short
 * wide windows (below ≈ 830px tall with 44vw binding, e.g. 1280 × 640).
 */
export const CARD_W: Readonly<Record<LayoutMode, RefLen>> = {
  desktop: ref('--card-w', min(vw(44), svh(88.1), mul(sub(svh(50), px(128)), 2400 / 953))),
  mobile: ref('--card-w', CONTENT_W),
};
const cardH = (mode: LayoutMode): Len => div(mul(CARD_W[mode], CARD.imgH), CARD.imgW);
/** Card height (width × 953 / 1200). Resolves with the desktop width; CSS uses the current mode's --card-w. */
export const CARD_H: RefLen = ref('--card-h', cardH('desktop'));

/** Mobile field slot heights in svh (§4.2). */
export type SlotId = 'about' | 'work' | 'project' | 'capabilities';
export const SLOT_SVH: Readonly<Record<SlotId, number>> = { about: 52, work: 44, project: 42, capabilities: 44 };
/** When height < 600px, every slot shrinks to 34svh and shapes scale ×.8. */
export const SHORT_SLOT_SVH = 34;
export const SHORT_SHAPE_SCALE = 0.8;

/**
 * S2 chart geometry, in frame units (x ∈ [0, 1] of the chart width, values
 * in years on a 0–7 scale). Shared by the generator and the DOM chart.
 */
export const CHART = {
  years: 7,
  slabsPerYear: 4,
  ticks: [0, 2, 4, 6],
  bars: [
    { stat: 'developer', xc: 0.16, w: 0.15, years: 2, groups: [0] },
    { stat: 'design', xc: 0.4, w: 0.15, years: 4, groups: [1] },
    /** Stacked: 2 developer years (g2) under 4+ design years (g3). */
    { stat: 'tech', xc: 0.64, w: 0.15, years: 6, groups: [2, 3], stack: [2, 4] },
  ],
  /** Baseline and gridlines run from x 0 to .78. */
  gridEnd: 0.78,
  /** Dashed divider; the AI-platform count sits past it (a count, not years). */
  divider: 0.8,
  ai: { stat: 'ai', xc: 0.9, y: 0.8, groups: [4] },
  /** The "+" fizz bands, in years. */
  fizz: [
    { bar: 1, from: 4, to: 4.5 },
    { bar: 2, from: 6, to: 6.5 },
  ],
  /** Numerals sit this far above each bar top (desktop). */
  numeralGap: svh(2),
} as const;

/**
 * S8 STACK fit (§3.10). Drawn true-isometric, the four plates (±.27s apart,
 * each .9s × .6s) are ≈ 1.05s tall and 1.06s wide, and the active drawer
 * lifts a further ≈ .08s, so with s = min(boxW, boxH) the stack would spill
 * out of its box. Generators and the DOM placeholder use
 * s = min(boxW, boxH) / STACK_FIT.
 */
export const STACK_FIT = 1.15;

/** Project detail route: the emblem's anchor point and scale relative to the card box (§6). */
export const DETAIL_ANCHOR = {
  desktop: { cx: vw(74), cy: svh(40), scale: 0.8 },
  mobile: { cx: vw(50), cy: svh(22), scale: 0.7 },
  /** MCP App (no screenshot): the constellation re-stages to the centre at this scale. */
  mcpScale: 1.3,
} as const;

// ---------------------------------------------------------------------------
// Anchor boxes.

/**
 * What an anchor box is positioned against:
 * - viewport: fixed to the viewport (S0, S10)
 * - stage: the sticky `.stage` of its chapter (100svh tall)
 * - section: a flow chapter's `<section>` (desktop NDA)
 * - slot: a mobile `.field-slot` (the empty aria-hidden block that opens a flow chapter)
 */
export type AnchorFrame = 'viewport' | 'stage' | 'section' | 'slot';

export interface AnchorBox {
  readonly frame: AnchorFrame;
  /** Owning chapter, or null for viewport-framed states. */
  readonly chapter: ChapterId | null;
  /** Left, top, width, height inside the frame. */
  readonly x: Len;
  readonly y: Len;
  readonly w: Len;
  readonly h: Len;
  /** Named extras, emitted as `--anchor-<state>-<key>`. Same keys in both modes. */
  readonly extra?: Readonly<Record<string, Len>>;
}

export interface StateAnchors {
  readonly desktop: AnchorBox;
  readonly mobile: AnchorBox;
  /** Mobile when height < 600px (slot-framed states only). */
  readonly mobileShort?: AnchorBox;
}

const box = (
  frame: AnchorFrame,
  chapter: ChapterId | null,
  x: Len,
  y: Len,
  w: Len,
  h: Len,
  extra?: Record<string, Len>,
): AnchorBox => ({ frame, chapter, x, y, w, h, extra });

const VIEWPORT = box('viewport', null, px(0), px(0), vw(100), svh(100));

/** Desktop card box: centred at (70vw, 50svh) on the right or (30vw, 50svh) on the left. */
const cardBox = (cxVw: number): AnchorBox =>
  box(
    'stage',
    'projects',
    sub(vw(cxVw), div(CARD_W.desktop, 2)),
    sub(svh(50), div(CARD_H, 2)),
    CARD_W.desktop,
    CARD_H,
  );

/** Mobile slot builders: (slot height in svh, shape scale k). */
const slotChart = (s: number, k: number): AnchorBox => {
  const baseline = s - 12 * k; // leaves 12svh under the baseline for labels
  return box('slot', 'about', GUTTER, svh(baseline - 30 * k), CONTENT_W, svh(30 * k), { baseline: svh(baseline) });
};
const slotRedacted = (s: number, k: number): AnchorBox => {
  const h = 42.5 * 0.7 * k; // desktop height ×.7
  return box('slot', 'work', GUTTER, svh((s - h) / 2), CONTENT_W, svh(h));
};
const slotCard = (s: number): AnchorBox => box('slot', 'projects', GUTTER, px(0), CONTENT_W, svh(s));
const slotStack = (s: number, k: number): AnchorBox =>
  box('slot', 'capabilities', vw((100 - 84 * k) / 2), svh((s - 40 * k) / 2), vw(84 * k), svh(40 * k));

/** Mobile S9: centre (50vw, cy svh), R = 24vw × k (the contact stage frame). */
const beaconMobile = (k: number, cy: number): AnchorBox =>
  box('stage', 'contact', vw(50 - 24 * k), sub(svh(cy), vw(24 * k)), vw(48 * k), vw(48 * k), {
    cx: vw(50),
    cy: svh(cy),
    r: vw(24 * k),
  });

/** Desktop S2 baseline: 80svh, lifted on short viewports (see ANCHORS[S2]). */
const CHART_BASE_D = min(svh(80), sub(svh(100), px(180)));

const S = SHORT_SLOT_SVH;
const K = SHORT_SHAPE_SCALE;

const nameFsD = NAME_FS.desktop;
const nameFsM = NAME_FS.mobile;
const nameCap = mul(nameFsD, NAME_METRICS.capEm);

/** Per-state anchor boxes, desktop and mobile (§3.10, §4.2, §5). */
export const ANCHORS: Readonly<Record<StateId, StateAnchors>> = {
  [StateId.STATIC]: { desktop: VIEWPORT, mobile: VIEWPORT },

  // S1: desktop is the cap box of the one-line <h1> (left at the gutter,
  // baseline 62svh = y + h). Mobile is the two-line block, top at 20svh.
  // The live registration is sampled from the real glyph boxes (§9.8).
  [StateId.NAME]: {
    desktop: box('stage', 'top', GUTTER, sub(svh(62), nameCap), mul(nameFsD, NAME_METRICS.widthEm), nameCap),
    mobile: box(
      'stage',
      'top',
      GUTTER,
      svh(20),
      mul(nameFsM, NAME_METRICS.stephenEm),
      mul(nameFsM, 2 * NAME_METRICS.lineHeight),
    ),
  },

  // S2: frame x 54 → 92vw, baseline 80svh, 7-year scale H = 52svh.
  // Tuned (final review): the baseline is at most 100svh − 180px, so the
  // bar notes (≈ 130px under it) keep ≥ 50px above the fold on short
  // laptops (1280 × 720: baseline 540 instead of 576); from 900px tall
  // (80svh ≤ 100svh − 180px) nothing changes.
  [StateId.CHART]: {
    desktop: box('stage', 'about', vw(54), sub(CHART_BASE_D, svh(52)), vw(38), svh(52), { baseline: CHART_BASE_D }),
    mobile: slotChart(SLOT_SVH.about, 1),
    mobileShort: slotChart(S, K),
  },

  // S3: x 54 → 92vw, 42.5svh tall, centred in the 90svh NDA section.
  [StateId.REDACTED]: {
    desktop: box('section', 'work', vw(54), svh((90 - 42.5) / 2), vw(38), svh(42.5)),
    mobile: slotRedacted(SLOT_SVH.work, 1),
    mobileShort: slotRedacted(S, K),
  },

  // S4–S7: the card box. Pulse right, Gov Data Generator left, Prmpt Art right, MCP App left.
  [StateId.PULSE]: { desktop: cardBox(70), mobile: slotCard(SLOT_SVH.project), mobileShort: slotCard(S) },
  [StateId.LATTICE]: { desktop: cardBox(30), mobile: slotCard(SLOT_SVH.project), mobileShort: slotCard(S) },
  [StateId.DECK]: { desktop: cardBox(70), mobile: slotCard(SLOT_SVH.project), mobileShort: slotCard(S) },
  [StateId.CONSTELLATION]: { desktop: cardBox(30), mobile: slotCard(SLOT_SVH.project), mobileShort: slotCard(S) },

  // S8: centre (70vw, 54svh), box 36vw × 64svh. Mobile: 84vw × 40svh in the slot.
  [StateId.STACK]: {
    desktop: box('stage', 'capabilities', vw(52), svh(22), vw(36), svh(64)),
    mobile: slotStack(SLOT_SVH.capabilities, 1),
    mobileShort: slotStack(S, K),
  },

  // S9: centre (50vw, 52svh), R = 12svh. Mobile: centre (50vw, 46svh), R = 24vw.
  [StateId.BEACON]: {
    desktop: box('stage', 'contact', sub(vw(50), svh(12)), svh(40), svh(24), svh(24), {
      cx: vw(50),
      cy: svh(52),
      r: svh(12),
    }),
    mobile: beaconMobile(1, 46),
    // Height < 600 (tuned; §4.2 scales slot shapes ×.8): R = 19.2vw at
    // 44svh, so the stuck contact stage still holds the headline, the beacon
    // and the email row + body on short phones (375 × 548, 360 × 560)
    // instead of falling back to flow.
    mobileShort: beaconMobile(K, 44),
  },

  // S10 (404): a line from 8vw to 92vw at 68svh; mobile gutter to gutter at 70svh. h = 0 (a line).
  [StateId.FLATLINE]: {
    desktop: box('viewport', null, vw(8), svh(68), vw(84), px(0)),
    mobile: box('viewport', null, GUTTER, svh(70), CONTENT_W, px(0)),
  },
};

export function anchorFor(id: StateId, mode: LayoutMode, short = false): AnchorBox {
  const a = ANCHORS[id];
  return mode === 'mobile' ? (short && a.mobileShort) || a.mobile : a.desktop;
}

export interface ResolvedBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly cy: number;
  readonly extra: Readonly<Record<string, number>>;
}

/** An anchor box in CSS px, relative to its frame. */
export function resolveAnchor(id: StateId, mode: LayoutMode, vp: Viewport, short = false): ResolvedBox {
  const b = anchorFor(id, mode, short);
  const x = resolveLen(b.x, vp);
  const y = resolveLen(b.y, vp);
  const w = resolveLen(b.w, vp);
  const h = resolveLen(b.h, vp);
  const extra: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.extra ?? {})) extra[k] = resolveLen(v, vp);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, extra };
}

/** CSS custom property name for an anchor measure, e.g. `--anchor-chart-x`. */
export const anchorVar = (id: StateId, prop: 'x' | 'y' | 'w' | 'h' | (string & {})): `--anchor-${string}` =>
  `--anchor-${STATE_NAME[id]}-${prop}`;

// ---------------------------------------------------------------------------
// CSS output.

type VarList = ReadonlyArray<readonly [string, string]>;

function varsFor(mode: LayoutMode, short: boolean): VarList {
  const out: Array<readonly [string, string]> = [
    [GUTTER.name, toCss(GUTTER.v)],
    [COL_GAP.name, toCss(COL_GAP.v)],
    [NAME_FS[mode].name, toCss(NAME_FS[mode].v)],
    [CARD_W[mode].name, toCss(CARD_W[mode].v)],
    [CARD_H.name, toCss(cardH(mode))],
  ];
  for (const slot of Object.keys(SLOT_SVH) as SlotId[]) {
    out.push([`--slot-${slot}`, toCss(svh(mode === 'mobile' && short ? SHORT_SLOT_SVH : SLOT_SVH[slot]))]);
  }
  for (const key of Object.keys(ANCHORS)) {
    const id = Number(key) as StateId;
    const b = anchorFor(id, mode, short);
    out.push([anchorVar(id, 'x'), toCss(b.x)]);
    out.push([anchorVar(id, 'y'), toCss(b.y)]);
    out.push([anchorVar(id, 'w'), toCss(b.w)]);
    out.push([anchorVar(id, 'h'), toCss(b.h)]);
    for (const [k, v] of Object.entries(b.extra ?? {})) out.push([anchorVar(id, k), toCss(v)]);
  }
  return out;
}

function rule(selector: string, vars: VarList, indent: string): string {
  const body = vars.map(([k, v]) => `${indent}  ${k}: ${v};`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/** `[data-field-anchor="S2"]` → its box vars (read by the base `[data-field-anchor]` rule). */
function anchorAttrRules(indent: string): string {
  return Object.keys(ANCHORS)
    .map((key) => {
      const id = Number(key) as StateId;
      const v = (p: string) => `var(${anchorVar(id, p)})`;
      return `${indent}[data-field-anchor="${stateKey(id)}"] { --ax: ${v('x')}; --ay: ${v('y')}; --aw: ${v('w')}; --ah: ${v('h')}; }`;
    })
    .join('\n');
}

/**
 * The layout variables as CSS.
 * - 'media': keyed on media queries (works without JS). Pasted into
 *   src/index.css by `npm run gen:layout`.
 * - 'attr': keyed on html[data-layout] (the JS truth); injected at boot.
 */
export function layoutCss(target: 'media' | 'attr', indent = ''): string {
  const d = varsFor('desktop', false);
  const m = varsFor('mobile', false);
  // Each block only lists what differs from the block it overrides.
  const diff = (list: VarList, base: VarList) => list.filter(([k, v]) => base.find(([k2]) => k2 === k)?.[1] !== v);
  const mDiff = diff(m, d);
  const mShort = diff(varsFor('mobile', true), m);
  const i1 = indent + '  ';
  const i2 = i1 + '  ';
  const parts =
    target === 'media'
      ? [
          rule(':root', d, indent),
          `${indent}@media ${MQ.mobile} {\n${rule(':root', mDiff, i1)}\n${i1}@media ${MQ.short} {\n${rule(':root', mShort, i2)}\n${i1}}\n${indent}}`,
        ]
      : [
          rule(':root', d, indent),
          rule(':root[data-layout="mobile"]', mDiff, indent),
          `${indent}@media ${MQ.short} {\n${rule(':root[data-layout="mobile"]', mShort, i1)}\n${indent}}`,
        ];
  parts.push(anchorAttrRules(indent));
  return parts.join('\n');
}

const STYLE_ID = 'dtw-layout-vars';

/**
 * Inject the layout variables, keyed on html[data-layout], as an unlayered
 * <style> (it wins over the static defaults in index.css). Idempotent.
 */
export function applyLayoutVars(doc: Document = document): void {
  let el = doc.getElementById(STYLE_ID);
  if (!el) {
    el = doc.createElement('style');
    el.id = STYLE_ID;
    doc.head.appendChild(el);
  }
  el.textContent = layoutCss('attr');
}
