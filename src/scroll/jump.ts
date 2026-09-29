/**
 * Nav / rail / hash jumps (SPEC §4.4), shared by Nav, Rail, the hero CTAs,
 * the App's hash handling and the chapters' focus-in scroll (§8.1).
 *
 * Policy: the target is the start of the chapter's hold. A target within 2
 * film states of where the page is now glides (Lenis, 1.2 s expo.inOut);
 * further away it jump-cuts (void overlay, immediate scroll, director snap).
 * Without Lenis (reduced motion) every jump is instant. Focus then moves to
 * the chapter's heading (`tabIndex={-1}`).
 *
 * Browser-only helpers (call from handlers / effects). Targets come from the
 * store's chapter records (measured on refresh), with a one-off DOM measure
 * as the fallback before the first refresh.
 */
import type { MouseEvent } from 'react';
import { glide, isSmooth, jumpCut, scrollLimit } from '../motion/lenis';
import { filmTarget } from './director';
import { headingId, JUMP_OFFSET_VH, type ChapterId } from './chapters';
import { store, type FieldStore } from './store';

/** Chapters that have a jump target (the nav items, the rail ticks), in document order. */
export type JumpId = keyof typeof JUMP_OFFSET_VH;

export const JUMP_ORDER: readonly JumpId[] = ['top', 'about', 'work', 'capabilities', 'contact'];

export const isJumpId = (id: string): id is JumpId => Object.hasOwn(JUMP_OFFSET_VH, id);

/** A plain left click (no modifier): the only click a link may hijack for an in-page jump. */
export const isPlainClick = (e: MouseEvent): boolean =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** Glide when the target is at most this many film states away (§4.4). */
export const GLIDE_MAX_STATES = 2;

/**
 * Clamp to the scroll range. `live` measures the document now (a jump, once
 * per click: the cached limit can still be another route's right after a
 * route swap); the rail's per-sample targets use the cached limit (no layout
 * reads at sample rate).
 */
const clampY = (y: number, live = false): number => {
  const max = live ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight) : scrollLimit();
  return Math.max(0, max > 0 ? Math.min(y, max) : y);
};

/**
 * Scroll target of a chapter: the start of its hold (§4.4). The offset only
 * applies while the stage is actually sticky; in flow (mobile, reduced
 * motion, fit-guard fallbacks) the target is the section top. Null when the
 * chapter is not on the page.
 */
export function chapterTarget(id: JumpId, s: FieldStore = store): number | null {
  const rec = s.chapters[id];
  if (rec) {
    if (id === 'top') return 0;
    const H = s.scroll.H || window.innerHeight;
    return clampY(rec.top + (rec.sticky ? (JUMP_OFFSET_VH[id] * H) / 100 : 0), true);
  }
  // Before the first refresh: measure once.
  const section = document.getElementById(id);
  if (!section) return null;
  if (id === 'top') return 0;
  const stage = section.querySelector<HTMLElement>(':scope > .stage');
  const sticky = stage !== null && getComputedStyle(stage).position === 'sticky';
  const offset = sticky ? (JUMP_OFFSET_VH[id] * window.innerHeight) / 100 : 0;
  return clampY(section.getBoundingClientRect().top + window.scrollY + offset, true);
}

/**
 * All jump targets in JUMP_ORDER, from the store only (no layout reads), made
 * strictly increasing so every rail tick is reachable. Returns false (and
 * leaves `out` empty) until every home chapter is measured.
 */
export function jumpTargets(s: FieldStore, out: number[]): boolean {
  out.length = 0;
  const H = s.scroll.H;
  for (let i = 0; i < JUMP_ORDER.length; i++) {
    const id = JUMP_ORDER[i];
    const rec = s.chapters[id];
    if (!rec) {
      out.length = 0;
      return false;
    }
    const raw = id === 'top' ? 0 : rec.top + (rec.sticky ? (JUMP_OFFSET_VH[id] * H) / 100 : 0);
    out.push(Math.max(i === 0 ? 0 : out[i - 1] + 1, clampY(raw)));
  }
  return true;
}

/** Index into JUMP_ORDER of the chapter whose hold the page has reached (2px slack), or −1. */
export function activeJumpIndex(y: number, targets: readonly number[]): number {
  if (targets.length === 0) return -1;
  let k = 0;
  for (let i = 1; i < targets.length; i++) if (y >= targets[i] - 2) k = i;
  return k;
}

let quietFocus = 0;

/**
 * Focus without scrolling, flagged so the chapters' focus-in scroll (§8.1)
 * ignores it (it is the jump's own focus move, not the visitor tabbing).
 */
export function focusQuietly(el: HTMLElement | null): void {
  if (!el) return;
  quietFocus++;
  try {
    el.focus({ preventScroll: true });
  } finally {
    quietFocus--;
  }
}

/** True while focusQuietly() is moving focus. */
export const isQuietFocus = (): boolean => quietFocus > 0;

/** Move focus to a chapter's heading (`tabIndex={-1}`), without scrolling. */
export function focusChapterHeading(id: ChapterId): void {
  focusQuietly(document.getElementById(headingId(id)));
}

export type JumpKind = 'glide' | 'cut' | 'instant';

/** How a jump from scrollY `from` to `to` would travel (§4.4). */
export function jumpKind(from: number, to: number, s: FieldStore = store, smooth = true): JumpKind {
  if (!smooth) return 'instant';
  const a = filmTarget(from, s.segments);
  const b = filmTarget(to, s.segments);
  return Math.abs(b - a) <= GLIDE_MAX_STATES ? 'glide' : 'cut';
}

/**
 * Scroll to scrollY `y` with the §4.4 policy, then run `onArrive` (focus):
 * right away for a glide (the heading is focused as the glide starts), after
 * the snap for a jump cut, at once when instant.
 */
export function jumpToY(y: number, onArrive?: () => void, retarget?: () => number | null): JumpKind {
  const kind = jumpKind(store.scroll.y, y, store, isSmooth());
  if (kind === 'glide') {
    glide(y);
    onArrive?.();
  } else {
    jumpCut(y, { onCut: onArrive, retarget }); // instant without Lenis
  }
  return kind;
}

/**
 * Scroll to a chapter's hold start with the §4.4 policy and move focus to its
 * heading. Returns false when the chapter is not on the page.
 */
export function jumpToChapter(id: JumpId): boolean {
  const y = chapterTarget(id);
  if (y === null) return false;
  jumpToY(y, () => focusChapterHeading(id), () => chapterTarget(id));
  return true;
}

/**
 * onClick for an in-page `<a href="#id">` to a chapter (the hero CTAs): a
 * plain click jumps like the nav (hold start, focus on the heading) instead
 * of the native fragment jump, which would leave focus on <body>. Modifier
 * clicks and the no-JS page keep the href.
 */
export function onJumpLinkClick(event: MouseEvent<HTMLAnchorElement>): void {
  const id = event.currentTarget.hash.slice(1);
  if (isJumpId(id) && isPlainClick(event) && jumpToChapter(id)) event.preventDefault();
}
