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
import { anchorFor, DETAIL_ANCHOR, resolveAnchor, resolveLen } from '../field/layout.ts';
import { STATE_COUNT, StateId } from '../field/states/ids.ts';
import { LIMITS } from '../field/uniforms.ts';
import type { ChapterId } from './chapters.ts';
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
/** Reused viewport for resolveLen (no per-frame allocation). */
const VP = { W: 0, H: 0 };

/**
 * The anchor transform of one pair endpoint (`uOffA/B` before pxToSu):
 * [centre x px, centre y px, scale, alpha]. Applies the beacon sink (S9 →
 * footer horizon, scale ×.45, α ×.6, §5 C5) and the project curtain
 * (`disperse`: S4–S6 ×1.6 at α ×.35; S7 has no screenshot and grows ×1.15).
 */
export function anchorTransform(id: StateId, s: FieldStore, out: Vec4, disperse = s.fx.disperse): Vec4 {
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
    x += (hx - x) * sink;
    y += (hy - y) * sink;
    scale *= 1 - 0.55 * sink;
    alpha *= 1 - 0.4 * sink;
  }

  if (disperse > 0 && id >= StateId.PULSE && id <= StateId.CONSTELLATION) {
    if (id === StateId.CONSTELLATION) scale *= 1 + 0.15 * disperse;
    else {
      scale *= 1 + 0.6 * disperse;
      alpha *= 1 - 0.65 * disperse;
    }
  }

  // Route mode, project detail (§6): the emblem pair sits at the detail
  // anchor — (74vw, 40svh) ×.8, mobile (50vw, 22svh) ×.7 — and, as the page
  // scrolls 0 → 100svh, parallaxes up .3 su (≈ .15·H px: 1 su = H/2 px on
  // the canvas) and dims to α .25, so the writeup sits over near-void.
  // TODO(phase6-scroll): the MCP App re-stage (centre, ×1.3) over its spacer.
  if (s.route.kind === 'detail' && id >= StateId.PULSE && id <= StateId.CONSTELLATION) {
    const d = DETAIL_ANCHOR[s.layout];
    VP.W = s.scroll.W;
    VP.H = s.scroll.H;
    const t = VP.H > 0 ? Math.min(1, Math.max(0, s.scroll.y / VP.H)) : 0;
    x = resolveLen(d.cx, VP);
    y = resolveLen(d.cy, VP) - 0.15 * VP.H * t;
    scale = d.scale;
    alpha *= 1 - 0.75 * t;
  }

  out[0] = x;
  out[1] = y;
  out[2] = scale;
  out[3] = alpha;
  return out;
}

export function createSafeRectBuffer(): SafeRectBuffer {
  return { rects: new Float32Array(LIMITS.safeRects * 4), count: 0 };
}

const BLOCKS = LIMITS.safeRects - 1;
const bestD = new Float64Array(BLOCKS);
const bestR = new Float64Array(BLOCKS * 4);

/**
 * The ≤ 6 text-safe rects for this frame (§9.6), in viewport CSS px: the nav
 * band first, then the 5 on-screen `[data-safe]` blocks nearest the viewport
 * centre. In the stuck C3 stage only the active window's panel counts.
 * Writes into `out` (allocation-free) and returns it.
 */
export function activeSafeRects(s: FieldStore, out: SafeRectBuffer = createSafeRectBuffer()): SafeRectBuffer {
  const { y, W, H } = s.scroll;
  const proj = s.chapters.projects;
  const win = proj && proj.sticky ? Math.min(3, Math.max(0, Math.floor(proj.progress * 4))) : -1;
  let n = 0;

  for (let i = 0; i < s.safe.length; i++) {
    const r = s.safe[i];
    const ch = s.chapters[r.chapter];
    if (!ch) continue;
    if (win >= 0 && r.panel !== undefined && r.chapter === 'projects' && r.panel !== win) continue;
    const top = stageTop(y, ch);
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
      for (let j = 0; j < 4; j++) bestR[pos * 4 + j] = bestR[(pos - 1) * 4 + j];
      pos--;
    }
    bestD[pos] = d;
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
  out.count = 1 + n;
  return out;
}
