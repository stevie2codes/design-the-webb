/**
 * Nav / rail / hash jumps (SPEC §4.4), shared by Nav, Rail, the hero CTAs
 * and the App's hash handling.
 *
 * Placeholder until the Lenis jump policy (glide within 2 film states, jump
 * cut beyond) lands in the scroll phase: for now a native scroll, smooth
 * unless reduced motion is on, then focus moves to the chapter heading.
 */
import type { MouseEvent } from 'react';
import { isReducedMotion } from '../motion/motionPref';
import { headingId, JUMP_OFFSET_VH } from './chapters';

/** Chapters that have a jump target (the nav items, the rail ticks). */
export type JumpId = keyof typeof JUMP_OFFSET_VH;

export const isJumpId = (id: string): id is JumpId => Object.hasOwn(JUMP_OFFSET_VH, id);

/** A plain left click (no modifier): the only click a link may hijack for an in-page jump. */
export const isPlainClick = (e: MouseEvent): boolean =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * Scroll target of a chapter: the start of its hold (§4.4). The offset only
 * applies while the stage is actually sticky; in flow (mobile, reduced
 * motion, no-JS styles) the target is the section top. Null when the chapter
 * is not in the DOM.
 */
export function chapterTarget(id: JumpId): number | null {
  const section = document.getElementById(id);
  if (!section) return null;
  if (id === 'top') return 0;
  const stage = section.querySelector<HTMLElement>(':scope > .stage');
  const sticky = stage !== null && getComputedStyle(stage).position === 'sticky';
  const offset = sticky ? (JUMP_OFFSET_VH[id] * window.innerHeight) / 100 : 0;
  return section.getBoundingClientRect().top + window.scrollY + offset;
}

/**
 * Scroll to a chapter's hold start and move focus to its heading
 * (`tabIndex={-1}`). Returns false when the chapter is not in the DOM.
 */
export function jumpToChapter(id: JumpId): boolean {
  const top = chapterTarget(id);
  if (top === null) return false;
  window.scrollTo({ top, behavior: isReducedMotion() ? 'auto' : 'smooth' });
  document.getElementById(headingId(id))?.focus({ preventScroll: true });
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
