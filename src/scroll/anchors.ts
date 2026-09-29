/**
 * Anchors, stage follow and text-safe rects (SPEC §9.6): measure on
 * refresh, derive per frame analytically — no layout reads per frame.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Owner: scroll.
 *
 * Frames (consistent with field/layout.ts AnchorFrame):
 * - sticky chapter: rects are relative to the `.stage` (it moves as a whole);
 * - flow chapter (incl. mobile field slots, fit-guard fallbacks): rects are
 *   relative to the `<section>` (whose top is ChapterRecord.top);
 * - viewport-framed states (S0, S10): viewport px, recorded with
 *   `chapter: 'viewport'`.
 * Per frame: viewport y = local y + stageTop(scrollY, chapter).
 *
 * Only registerChapterRects / clearChapterRects / isStageSticky / svhPx touch
 * the DOM (refresh / resize time); everything else is pure and
 * allocation-free (safe to call from the render loop).
 */
import { anchorFor, resolveAnchor } from '../field/layout.ts';
import { STATE_COUNT, StateId } from '../field/states/ids.ts';
import { LIMITS } from '../field/uniforms.ts';
import { PROJECT_SWITCH_Q, PROJECT_TEXT_Q, PROJECT_WINDOW_VH, type ChapterId } from './chapters.ts';
import { detailAnchorTransform } from './detailField.ts';
import { store, type ChapterRecord, type FieldStore, type SafeRectBuffer, type Vec4 } from './store.ts';

/** Height of the fixed nav band, always the first safe rect (§6: 64px, 56px on mobile). */
export const NAV_BAND_PX = { desktop: 64, mobile: 56 } as const;
/** Feather of the shader's text-safe mask (§2.3); rects this far off-screen still count. */
export const SAFE_FEATHER_PX = 24;

/**
 * Viewport top of a chapter's anchor frame at scrollY `y` (§9.6):
 * sticky `[T, T + 100svh + L]` → `T − y` before, 0 while stuck, `T + L − y`
 * after; flow → `T − y`.
 */
export function stageTop(y: number, ch: ChapterRecord): number {
  if (!ch.sticky || y < ch.top) return ch.top - y;
  if (y <= ch.top + ch.L) return 0;
  return ch.top + ch.L - y;
}

/** Whether a stage is sticky right now (computed style; refresh-time only). */
export function isStageSticky(stageEl: HTMLElement): boolean {
  return getComputedStyle(stageEl).position === 'sticky';
}

/** A fixed, invisible 100svh box: the stage height in px, whatever the path. */
let svhProbe: HTMLElement | null = null;

/**
 * 100svh in CSS px (the stage height and the basis of every svh / vh offset:
 * `store.scroll.H`). A layout read: call it on init, resize and refresh only.
 * Falls back to innerHeight where svh is unsupported.
 */
export function svhPx(): number {
  if (typeof document === 'undefined') return 0;
  if (!svhProbe || !svhProbe.isConnected) {
    svhProbe = document.createElement('div');
    svhProbe.setAttribute('aria-hidden', 'true');
    svhProbe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(svhProbe);
  }
  return svhProbe.getBoundingClientRect().height || window.innerHeight;
}

const parseStateKey = (key: string | undefined): StateId | null => {
  const m = key ? /^S(\d{1,2})$/.exec(key) : null;
  const n = m ? Number(m[1]) : -1;
  return n >= 0 && n < STATE_COUNT ? (n as StateId) : null;
};

/**
 * REFRESH ONLY (§9.3 onRefresh). Measure every visible
 * `[data-field-anchor="Sx"]` and `[data-safe]` inside `stageEl` in the
 * chapter's frame and write them to `s.anchors` / `s.safe` (replacing this
 * chapter's previous safe rects). 0 × 0 boxes (display:none: the other
 * layout's anchor) are skipped. `[data-safe]` inside `[data-panel="k"]`
 * records `panel: k − 1`.
 */
export function registerChapterRects(id: ChapterId, stageEl: HTMLElement, s: FieldStore = store): void {
  const section = stageEl.parentElement ?? stageEl;
  const origin = (isStageSticky(stageEl) ? stageEl : section).getBoundingClientRect();

  for (const el of stageEl.querySelectorAll<HTMLElement>('[data-field-anchor]')) {
    const state = parseStateKey(el.dataset.fieldAnchor);
    if (state === null) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const viewport = anchorFor(state, s.layout).frame === 'viewport';
    s.anchors.set(state, {
      // A viewport-framed box sits at the stage origin, so stage-local = viewport px.
      chapter: viewport ? 'viewport' : id,
      cx: r.left - origin.left + r.width / 2,
      cy: r.top - origin.top + r.height / 2,
      w: r.width,
      h: r.height,
    });
  }

  s.safe = s.safe.filter((r) => r.chapter !== id);
  for (const el of stageEl.querySelectorAll<HTMLElement>('[data-safe]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const panelEl = el.closest<HTMLElement>('[data-panel]');
    const panel = panelEl ? Number(panelEl.dataset.panel) - 1 : NaN;
    s.safe.push({
      chapter: id,
      x0: r.left - origin.left,
      y0: r.top - origin.top,
      x1: r.right - origin.left,
      y1: r.bottom - origin.top,
      ...(Number.isInteger(panel) && panel >= 0 ? { panel } : {}),
    });
  }
}

/**
 * REFRESH ONLY. Routes without chapters (the project detail pages, the 404)
 * register their `[data-safe]` blocks inside `root` in document px (chapter
 * 'page'), so the text-safe mask (§2.3) covers their copy too — the detail
 * emblem's MCP re-stage and parallax pass behind the writeup. Replaces the
 * previous page rects.
 */
export function registerPageRects(root: HTMLElement, s: FieldStore = store): void {
  s.safe = s.safe.filter((r) => r.chapter !== 'page');
  const y = window.scrollY;
  for (const el of root.querySelectorAll<HTMLElement>('[data-safe]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    s.safe.push({ chapter: 'page', x0: r.left, y0: r.top + y, x1: r.right, y1: r.bottom + y });
  }
}

/** Forget the page rects (the page unmounts). */
export function clearPageRects(s: FieldStore = store): void {
  s.safe = s.safe.filter((r) => r.chapter !== 'page');
}

/** Forget a chapter's anchors and safe rects (unmount, route change). */
export function clearChapterRects(id: ChapterId, s: FieldStore = store): void {
  for (const [state, rec] of s.anchors) if (rec.chapter === id) s.anchors.delete(state);
  s.safe = s.safe.filter((r) => r.chapter !== id);
}

// ---------------------------------------------------------------------------
// Per frame.

/** Cache for unmeasured anchors (resolveAnchor allocates; resolve once per viewport). */
const fallback = new Map<StateId, { W: number; H: number; layout: string; cx: number; cy: number }>();

/**
 * Viewport-px centre of a state's anchor at the current scroll. Unmeasured
 * states (before the first refresh, other routes, S10) use the layout.ts
 * box as if its frame were the viewport.
 */
export function anchorCenter(id: StateId, s: FieldStore, out: [number, number]): [number, number] {
  const rec = s.anchors.get(id);
  if (rec) {
    const ch = rec.chapter === 'viewport' ? undefined : s.chapters[rec.chapter];
    out[0] = rec.cx;
    out[1] = rec.cy + (ch ? stageTop(s.scroll.y, ch) : 0);
    return out;
  }
  const { W, H } = s.scroll;
  let c = fallback.get(id);
  if (!c || c.W !== W || c.H !== H || c.layout !== s.layout) {
    const b = W > 0 && H > 0 ? resolveAnchor(id, s.layout, { W, H }, s.layout === 'mobile' && H < 600) : null;
    c = { W, H, layout: s.layout, cx: b ? b.cx : W / 2, cy: b ? b.cy : H / 2 };
    fallback.set(id, c);
  }
  out[0] = c.cx;
  out[1] = c.cy;
  return out;
}

const tmp: [number, number] = [0, 0];

/**
 * The beacon sink (§5 C5 "contact + 40 → + 80", §3.10 S9 "Sink"; tuned,
 * CONTRACTS.md). The contact stage unsticks as the sink starts, so the email
 * row and the body scroll up across the beacon's way down: the crossing is
 * unavoidable, and must read as the beacon passing BEHIND the text.
 * - `travel`: the beacon first rides its stage (content scrolling), then
 *   sets: centre and scale follow smoothstep(travel, sink), so the descent
 *   is bunched into the gap below the body text and the crossing is quick.
 * - `scale`: × (1 − .55·e) (spec: ×.45 at the horizon).
 * - α × k² with k the scale (area-conserving: a smaller disc with the same
 *   surface brightness — at ×.45 the particles are ≈ 5× denser, and the
 *   spec's α ×.6 summed to white). The core and sparks also fade in the
 *   shader (live/s09.glsl, uSink), since the CTA disc no longer covers them.
 * - `behind`: dimmed toward ×.15 by its analytic overlap with the contact
 *   chapter's text-safe rects (known per frame) — the box of its shell and
 *   its flattened ring (`reach` × R across, `rise` × R up and down), fully
 *   dimmed once `cover` of it is covered — so it never
 *   shines through text being read (§2.3 rule 3) and reads as passing
 *   behind it.
 */
export const BEACON_SINK = { travel: [0.3, 1], scale: 0.55, behind: 0.15, reach: 1.45, rise: 1.1, cover: 0.45 } as const;

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = x <= e0 ? 0 : x >= e1 ? 1 : (x - e0) / (e1 - e0);
  return t * t * (3 - 2 * t);
};

/** The sink's travel / scale progress at fx.sink `sink` (0 → 1). */
export const beaconSinkEase = (sink: number): number => smoothstep(BEACON_SINK.travel[0], BEACON_SINK.travel[1], sink);

/**
 * Fraction (0–1) of the box (x ± rx, y ± ry) (viewport px) covered by the
 * contact chapter's text-safe rects (feathered like the mask).
 * Allocation-free.
 */
function contactTextOverlap(s: FieldStore, x: number, y: number, rx: number, ry: number): number {
  const ch = s.chapters.contact;
  if (!ch || rx <= 0 || ry <= 0) return 0;
  const top = stageTop(s.scroll.y, ch);
  const x0 = x - rx;
  const x1 = x + rx;
  const y0 = y - ry;
  const y1 = y + ry;
  let covered = 0;
  for (let i = 0; i < s.safe.length; i++) {
    const q = s.safe[i];
    if (q.chapter !== 'contact') continue;
    const w = Math.min(x1, q.x1 + SAFE_FEATHER_PX) - Math.max(x0, q.x0 - SAFE_FEATHER_PX);
    const h = Math.min(y1, q.y1 + top + SAFE_FEATHER_PX) - Math.max(y0, q.y0 + top - SAFE_FEATHER_PX);
    if (w > 0 && h > 0) covered += w * h;
  }
  return Math.min(1, covered / (4 * rx * ry));
}

/**
 * The anchor transform of one pair endpoint (`uOffA/B` before pxToSu):
 * [centre x px, centre y px, scale, alpha]. Applies the beacon sink (S9 →
 * footer horizon, BEACON_SINK) and the project curtain (`disperse`: S4–S6
 * ×1.6 at α ×.35; S7 has no screenshot and grows ×1.15).
 */
export function anchorTransform(id: StateId, s: FieldStore, out: Vec4, disperse = s.fx.disperse): Vec4 {
  // Route mode, project detail (§6): the emblem pair sits at the detail
  // anchor with its scroll parallax, dimming, the MCP re-stage and the
  // home → detail hand-off (scroll/detailField.ts).
  if (s.route.kind === 'detail' && id >= StateId.PULSE && id <= StateId.CONSTELLATION) {
    return detailAnchorTransform(id, s, out);
  }
  anchorCenter(id, s, tmp);
  let x = tmp[0];
  let y = tmp[1];
  let scale = 1;
  let alpha = 1;

  const sink = s.fx.sink;
  if (id === StateId.BEACON && sink > 0) {
    const foot = s.chapters.footer;
    const hx = s.scroll.W / 2;
    const hy = foot ? foot.top - s.scroll.y : s.scroll.H;
    const e = beaconSinkEase(sink);
    x += (hx - x) * e;
    y += (hy - y) * e;
    const k = 1 - BEACON_SINK.scale * e;
    scale *= k;
    alpha *= k * k;
    const rec = s.anchors.get(StateId.BEACON);
    const r = (rec ? rec.h / 2 : 0.12 * s.scroll.H) * k;
    const covered = contactTextOverlap(s, x, y, r * BEACON_SINK.reach, r * BEACON_SINK.rise);
    alpha *= 1 - (1 - BEACON_SINK.behind) * smoothstep(0, BEACON_SINK.cover, covered);
  }

  if (disperse > 0 && id >= StateId.PULSE && id <= StateId.CONSTELLATION) {
    if (id === StateId.CONSTELLATION) scale *= 1 + 0.15 * disperse;
    else {
      scale *= 1 + 0.6 * disperse;
      alpha *= 1 - 0.65 * disperse;
    }
  }

  out[0] = x;
  out[1] = y;
  out[2] = scale;
  out[3] = alpha;
  return out;
}

/**
 * The home film's shapes stay on screen while they morph (tuning, see
 * CONTRACTS.md "Tuning notes"): an endpoint whose chapter has scrolled its
 * anchor box past the nav band (outgoing) or below the fold (incoming) rides
 * the viewport edge instead — its box is clamped into [nav band, 100svh] —
 * until the stage brings it back. Without it every cross-chapter segment
 * (the Pour, S3 → S4, S7 → S8, the spiral) morphed between two off-screen
 * shapes and read as an empty frame at mid-segment.
 *
 * Desktop only (mobile holds read long text below a slot that has scrolled
 * away; a hanging shape would sit over it). Never S0 (viewport), S2 (the DOM
 * axis, ticks and numerals must stay registered to the bars) or S10; S9 only
 * before the sink (which sets it behind the footer horizon) — the spiral
 * winds about S9's centre, so it now winds on screen, and S9 is back on its
 * anchor before the CTA disc fades in (section top 20% → 0%). A box still
 * inside the band is untouched, so every hold stays registered. Uses the
 * measured box at scale 1 (the C3 curtain's ×1.6 never pushes the stuck
 * emblem). Allocation-free.
 */
export function hangInView(id: StateId, s: FieldStore, out: Vec4): Vec4 {
  if (s.layout !== 'desktop' || s.route.kind !== 'home') return out;
  if (id === StateId.STATIC || id === StateId.CHART || id === StateId.FLATLINE) return out;
  if (id === StateId.BEACON && s.fx.sink > 0) return out;
  const rec = s.anchors.get(id);
  if (!rec || rec.chapter === 'viewport') return out;
  const half = rec.h / 2;
  const top = NAV_BAND_PX.desktop + half;
  const bottom = s.scroll.H - half;
  if (top >= bottom) return out;
  if (out[1] < top) out[1] = top;
  else if (out[1] > bottom) out[1] = bottom;
  return out;
}

export function createSafeRectBuffer(): SafeRectBuffer {
  return { rects: new Float32Array(LIMITS.safeRects * 4), weights: new Float32Array(LIMITS.safeRects).fill(1), count: 0 };
}

const BLOCKS = LIMITS.safeRects - 1;
const bestD = new Float64Array(BLOCKS);
const bestR = new Float64Array(BLOCKS * 4);
const bestW = new Float64Array(BLOCKS);

const ramp01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/**
 * Mask weight of a stuck C3 panel's text blocks (PROJECT_TEXT_Q), so the
 * text-safe mask never carves a hole around text that is not visible yet
 * (it fades exactly like the blocks' scrims and their text, stage.ts):
 * window 0 ramps in over its transit-in window, windows 1–3 over their
 * reveal (q .14–.30); every panel ramps out over its exit (the next
 * window's q 0–.12).
 */
function panelTextWeight(s: FieldStore, proj: ChapterRecord, panel: number): number {
  const q = proj.progress * 4 - panel; // local progress in the panel's own window
  let w: number;
  if (panel === 0) {
    const H = s.scroll.H;
    const from = (PROJECT_TEXT_Q.first.fromPct / 100) * H;
    const to = (-PROJECT_TEXT_Q.first.toQ * PROJECT_WINDOW_VH * H) / 100;
    w = ramp01((from - (proj.top - s.scroll.y)) / (from - to));
  } else {
    const [r0, r1] = PROJECT_TEXT_Q.reveal;
    w = ramp01((q - r0) / (r1 - r0));
  }
  if (q >= 1) {
    const [e0, e1] = PROJECT_TEXT_Q.exit;
    w = Math.min(w, 1 - ramp01((q - 1 - e0) / (e1 - e0)));
  }
  return w;
}

/**
 * The ≤ 6 text-safe rects for this frame (§9.6), in viewport CSS px: the nav
 * band first, then the 5 on-screen `[data-safe]` blocks nearest the viewport
 * centre. In the stuck C3 stage only the active window's panel counts, with
 * a weight that follows its text (panelTextWeight; every other rect 1).
 * Writes into `out` (allocation-free) and returns it.
 */
export function activeSafeRects(s: FieldStore, out: SafeRectBuffer = createSafeRectBuffer()): SafeRectBuffer {
  const { y, W, H } = s.scroll;
  const proj = s.chapters.projects;
  // The text-safe window switches with the panels' hand-over (q .13), not at
  // the window edge: the previous panel's text is still exiting over q 0–.12.
  const win = proj && proj.sticky ? Math.min(3, Math.max(0, Math.floor(proj.progress * 4 - PROJECT_SWITCH_Q))) : -1;
  let n = 0;

  for (let i = 0; i < s.safe.length; i++) {
    const r = s.safe[i];
    let top: number;
    let w = 1;
    if (r.chapter === 'page') {
      if (s.route.kind === 'home') continue;
      top = -y;
    } else {
      const ch = s.chapters[r.chapter];
      if (!ch || s.route.kind !== 'home') continue;
      if (win >= 0 && r.panel !== undefined && r.chapter === 'projects') {
        if (r.panel !== win) continue;
        w = panelTextWeight(s, ch, win);
        if (w <= 0.001) continue;
      }
      top = stageTop(y, ch);
    }
    const y0 = r.y0 + top;
    const y1 = r.y1 + top;
    if (y1 < -SAFE_FEATHER_PX || y0 > H + SAFE_FEATHER_PX) continue;
    const d = Math.abs((y0 + y1) / 2 - H / 2);
    let pos: number;
    if (n < BLOCKS) pos = n++;
    else if (d < bestD[BLOCKS - 1]) pos = BLOCKS - 1;
    else continue;
    while (pos > 0 && bestD[pos - 1] > d) {
      bestD[pos] = bestD[pos - 1];
      bestW[pos] = bestW[pos - 1];
      for (let j = 0; j < 4; j++) bestR[pos * 4 + j] = bestR[(pos - 1) * 4 + j];
      pos--;
    }
    bestD[pos] = d;
    bestW[pos] = w;
    bestR[pos * 4] = r.x0;
    bestR[pos * 4 + 1] = y0;
    bestR[pos * 4 + 2] = r.x1;
    bestR[pos * 4 + 3] = y1;
  }

  const o = out.rects;
  o[0] = 0;
  o[1] = 0;
  o[2] = W;
  o[3] = NAV_BAND_PX[s.layout];
  for (let k = 0; k < n * 4; k++) o[4 + k] = bestR[k];
  const ow = out.weights;
  ow[0] = 1;
  for (let k = 0; k < n; k++) ow[1 + k] = bestW[k];
  out.count = 1 + n;
  return out;
}
