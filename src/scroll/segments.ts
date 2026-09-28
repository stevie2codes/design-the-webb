/**
 * Film segment tables (SPEC §4.3): which scroll range morphs S_k → S_k+1,
 * as chapter-relative offsets, desktop (vh) and mobile (svh), plus the
 * beacon-sink fx range. resolve() turns them into px after every refresh.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Owner: scroll.
 * Pure data + pure functions; SSR-safe.
 */
import { anchorFor, resolveAnchor, type LayoutMode } from '../field/layout.ts';
import { StateId } from '../field/states/ids.ts';
import { CHAPTERS, PROJECT_WINDOW_VH, type ChapterId } from './chapters.ts';
import type { FieldStore, Seg } from './store.ts';

/**
 * One end of a segment. `off` is in the table's unit (vh desktop, svh
 * mobile; both resolve against store.scroll.H, the 100svh height).
 * - chapter: the chapter's section top + off.
 * - slot: (mobile) the top of the field slot that holds `state`'s anchor + off.
 * - end: the maximum scrollY + off.
 */
export type SegEdge =
  | { readonly at: 'chapter'; readonly ch: ChapterId; readonly off: number }
  | { readonly at: 'slot'; readonly state: StateId; readonly off: number }
  | { readonly at: 'end'; readonly off: number };

export interface SegmentSpec {
  /** From state (S_k). */
  readonly a: StateId;
  /** To state (S_k+1): its entering params apply. */
  readonly b: StateId;
  readonly y0: SegEdge;
  readonly y1: SegEdge;
  /** Debug label. */
  readonly name: string;
}

export interface SegmentTable {
  readonly unit: 'vh' | 'svh';
  /** Exactly 9 film segments, seg k = S_k → S_k+1, in scroll order. */
  readonly film: readonly SegmentSpec[];
  /** fx: the beacon sinks behind the footer horizon (store.fx.sink 0 → 1). */
  readonly sink: { readonly y0: SegEdge; readonly y1: SegEdge };
}

export interface ResolvedSegments {
  /** The film segments in px (also written to store.segments). A prefix when chapters are missing. */
  readonly film: Seg[];
  /** Sink range in px, or null when contact is not measured. */
  readonly sink: { readonly y0: number; readonly y1: number } | null;
}

const chapter = (ch: ChapterId, off: number): SegEdge => ({ at: 'chapter', ch, off });
const slot = (state: StateId, off: number): SegEdge => ({ at: 'slot', state, off });
const end = (off: number): SegEdge => ({ at: 'end', off });
const seg = (a: StateId, y0: SegEdge, y1: SegEdge, name: string): SegmentSpec => ({
  a,
  b: (a + 1) as StateId,
  y0,
  y1,
  name,
});

/**
 * Hero progress p at which seg0 (the rack focus) starts and ends. The lock
 * (§9.5) fires at p ≥ p1, so the lock and the end of seg0 share one number.
 */
export const HERO_P: Readonly<Record<LayoutMode, { readonly p0: number; readonly p1: number }>> = {
  desktop: { p0: 0.06, p1: 0.62 },
  mobile: { p0: 0.06, p1: 0.7 },
};

const HERO_L = { desktop: CHAPTERS.top.L, mobile: CHAPTERS.top.mobileL } as const;
/** C3 window k starts at projects + k·62.5vh; its morph runs over the first 30% (§5 C3). */
const W = PROJECT_WINDOW_VH;
const win = (k: number) => [chapter('projects', k * W), chapter('projects', k * W + 0.3 * W)] as const;

export const SEGMENTS: Readonly<Record<LayoutMode, SegmentTable>> = {
  // §4.3 desktop table (global reference values in the comments).
  desktop: {
    unit: 'vh',
    film: [
      seg(StateId.STATIC, chapter('top', HERO_P.desktop.p0 * HERO_L.desktop), chapter('top', HERO_P.desktop.p1 * HERO_L.desktop), 'rack focus'), // 5.4–55.8
      seg(StateId.NAME, chapter('top', 96), chapter('about', 10), 'pour'), // 96–200
      seg(StateId.CHART, chapter('work', -85), chapter('work', -25), 'topple'), // 325–385
      seg(StateId.REDACTED, chapter('projects', -70), chapter('projects', 10), 'pulse'), // 430–510
      seg(StateId.PULSE, ...win(1), 'lattice'), // 562.5–581.25
      seg(StateId.LATTICE, ...win(2), 'deck'), // 625–643.75
      seg(StateId.DECK, ...win(3), 'constellation'), // 687.5–706.25
      seg(StateId.CONSTELLATION, chapter('capabilities', -80), chapter('capabilities', 10), 'stack'), // 770–860
      seg(StateId.STACK, chapter('contact', -85), chapter('contact', 0), 'spiral'), // 965–1050
    ],
    sink: { y0: chapter('contact', 40), y1: chapter('contact', 80) }, // 1090–1130
  },
  // §4.3 mobile: seg0 in the sticky hero; every other segment into chapter X
  // runs while X's field slot top moves from 100% to 40% of the viewport;
  // seg8 while the contact top moves 100% → 0%.
  mobile: {
    unit: 'svh',
    film: [
      seg(StateId.STATIC, chapter('top', HERO_P.mobile.p0 * HERO_L.mobile), chapter('top', HERO_P.mobile.p1 * HERO_L.mobile), 'rack focus'), // 3–35
      seg(StateId.NAME, slot(StateId.CHART, -100), slot(StateId.CHART, -40), 'pour'),
      seg(StateId.CHART, slot(StateId.REDACTED, -100), slot(StateId.REDACTED, -40), 'topple'),
      seg(StateId.REDACTED, slot(StateId.PULSE, -100), slot(StateId.PULSE, -40), 'pulse'),
      seg(StateId.PULSE, slot(StateId.LATTICE, -100), slot(StateId.LATTICE, -40), 'lattice'),
      seg(StateId.LATTICE, slot(StateId.DECK, -100), slot(StateId.DECK, -40), 'deck'),
      seg(StateId.DECK, slot(StateId.CONSTELLATION, -100), slot(StateId.CONSTELLATION, -40), 'constellation'),
      seg(StateId.CONSTELLATION, slot(StateId.STACK, -100), slot(StateId.STACK, -40), 'stack'),
      seg(StateId.STACK, chapter('contact', -100), chapter('contact', 0), 'spiral'),
    ],
    sink: { y0: chapter('contact', 30), y1: end(0) },
  },
};
// The desktop table assumes every §4.1 sticky chapter is stuck. When one is
// measured as flow instead — short landscape phones (only the hero sticky,
// §4.2), a fit-guard fallback (section[data-overflow]), or C3 while its panels
// are laid out as flow blocks — resolve() swaps in the mobile rule for that
// segment: it runs while the entered state's anchor top moves from 100% to
// 40% of the viewport (FLOW_EDGES). Chapters that are flow by design (C2)
// keep their table rows.

/** Flow fallback edges (§4.2 mobile rule): anchor top at 100% → 40% of the viewport. */
export const FLOW_EDGES = { from: 1, to: 0.4 } as const;

/** Maximum scrollY implied by the measured chapters (footer included). */
function docEnd(s: FieldStore): number | null {
  let bottom = -1;
  for (const rec of Object.values(s.chapters)) if (rec) bottom = Math.max(bottom, rec.top + rec.height);
  return bottom < 0 ? null : Math.max(0, bottom - s.scroll.H);
}

/** Document top of the mobile field slot holding `state`'s anchor, or null. */
function slotTop(state: StateId, s: FieldStore): number | null {
  const vp = { W: s.scroll.W, H: s.scroll.H };
  const rec = s.anchors.get(state);
  if (rec && rec.chapter !== 'viewport') {
    const ch = s.chapters[rec.chapter];
    if (ch) {
      // Anchors in flow chapters are section-local; layout.ts gives the
      // anchor box's y inside its slot, so slot top = anchor top − box.y.
      const box = resolveAnchor(state, 'mobile', vp, s.scroll.H < 600);
      return ch.top + (rec.cy - rec.h / 2) - box.y;
    }
  }
  // Not measured yet: slots open their chapter, so fall back to its top.
  const owner = anchorFor(state, 'mobile').chapter;
  return owner ? (s.chapters[owner]?.top ?? null) : null;
}

/** One edge in px, or null when what it refers to is not measured. */
export function edgeY(edge: SegEdge, s: FieldStore): number | null {
  const unit = s.scroll.H / 100;
  let base: number | null;
  switch (edge.at) {
    case 'chapter':
      base = s.chapters[edge.ch]?.top ?? null;
      break;
    case 'slot':
      base = slotTop(edge.state, s);
      break;
    case 'end':
      base = docEnd(s);
      break;
  }
  return base === null ? null : base + edge.off * unit;
}

const STICKY_BY_SPEC = (id: ChapterId): boolean => id !== 'footer' && CHAPTERS[id].sticky;

/**
 * Desktop only: [y0, y1] for a segment whose entered state lives in a chapter
 * that §4.1 makes sticky but that is measured as flow right now (see
 * FLOW_EDGES), or null to keep the table row. The hero is excluded: seg0 is
 * hero progress by definition.
 */
function flowEdges(spec: SegmentSpec, s: FieldStore): [number, number] | null {
  if (s.layout !== 'desktop') return null;
  const owner = anchorFor(spec.b, 'desktop').chapter;
  if (!owner || owner === 'top' || !STICKY_BY_SPEC(owner)) return null;
  const ch = s.chapters[owner];
  if (!ch || ch.sticky) return null;
  const rec = s.anchors.get(spec.b);
  if (!rec || rec.chapter !== owner) return null;
  const top = ch.top + rec.cy - rec.h / 2; // flow: anchors are section-local
  return [top - FLOW_EDGES.from * s.scroll.H, top - FLOW_EDGES.to * s.scroll.H];
}

/**
 * Resolve the current layout's table to px (§9.3: after every refresh) and
 * write the film segments to `s.segments`. Segments stay in order and never
 * overlap (y0 ≥ previous y1, y1 ≥ y0 + 1px); resolution stops at the first
 * segment whose chapter is not measured, so filmTarget() holds there.
 */
export function resolve(s: FieldStore): ResolvedSegments {
  const table = SEGMENTS[s.layout];
  const film: Seg[] = [];
  let prev = -Infinity;
  for (const spec of table.film) {
    const flow = flowEdges(spec, s);
    const y0 = flow ? flow[0] : edgeY(spec.y0, s);
    const y1 = flow ? flow[1] : edgeY(spec.y1, s);
    if (y0 === null || y1 === null) break;
    const a0 = Math.max(y0, prev);
    const a1 = Math.max(y1, a0 + 1);
    film.push({ a: spec.a, b: spec.b, y0: a0, y1: a1 });
    prev = a1;
  }
  s.segments = film;
  const k0 = edgeY(table.sink.y0, s);
  const k1 = edgeY(table.sink.y1, s);
  return { film, sink: k0 === null || k1 === null ? null : { y0: k0, y1: Math.max(k1, k0 + 1) } };
}
