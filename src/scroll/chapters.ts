/**
 * The home document map (SPEC §4.1 desktop, §4.2 mobile): one entry per
 * chapter. <Chapter> reads its defaults from here, and the scroll phase
 * (segments.ts / useChapter) uses the same numbers.
 *
 * Pure data: the generator worker and node scripts may import this file.
 */

export type ChapterId = 'top' | 'about' | 'work' | 'projects' | 'capabilities' | 'contact' | 'footer';

/** Chapters rendered with <Chapter> on the home route. */
export type HomeChapterId = Exclude<ChapterId, 'footer'>;

export interface ChapterSpec {
  /** Desktop sticky length L in vh: the stage stays stuck while the section scrolls L. 0 for flow chapters. */
  readonly L: number;
  /** Mobile sticky length in svh (only for chapters sticky on mobile). */
  readonly mobileL?: number;
  /** Sticky on the desktop layout. */
  readonly sticky: boolean;
  /** Sticky on the mobile layout (§4.2: only C0 and C5). */
  readonly stickyOnMobile: boolean;
  /** Sticky on short landscape phones, height < 500px (§4.2: only the hero). */
  readonly stickyOnShort: boolean;
  /** Desktop min-height of a flow chapter, in svh. */
  readonly flowH?: number;
}

export const CHAPTERS = {
  top: { L: 90, mobileL: 50, sticky: true, stickyOnMobile: true, stickyOnShort: true },
  about: { L: 120, sticky: true, stickyOnMobile: false, stickyOnShort: false },
  work: { L: 0, sticky: false, stickyOnMobile: false, stickyOnShort: false, flowH: 90 },
  projects: { L: 250, sticky: true, stickyOnMobile: false, stickyOnShort: false },
  capabilities: { L: 100, sticky: true, stickyOnMobile: false, stickyOnShort: false },
  contact: { L: 40, mobileL: 30, sticky: true, stickyOnMobile: true, stickyOnShort: false },
} as const satisfies Record<HomeChapterId, ChapterSpec>;

/** Home chapter order (C0 → C5). The footer (C6, flow 40vh) follows. */
export const HOME_ORDER: readonly HomeChapterId[] = ['top', 'about', 'work', 'projects', 'capabilities', 'contact'];

/** Footer height on desktop, in vh (C6). */
export const FOOTER_VH = 40;

/** C3: four project windows of 62.5vh each inside L = 250vh. */
export const PROJECT_WINDOW_VH = 62.5;

/**
 * C3 window hold start, as local progress q within a window (§5 C3: the
 * curtain ends and the hold begins at q .55/.56). Focus inside panel k
 * scrolls to `projects + (k + q)·62.5vh` (§8.1).
 */
export const PROJECT_HOLD_Q = 0.56;

/**
 * C3 hand-over, as local progress q within a window (§5 C3): the previous
 * panel's close runs over q 0–.10, and `data-active` (and the text-safe
 * rects, anchors.ts activeSafeRects) switch to the next panel at q .08,
 * inside it (tuned, final review: a sequence — exit, then reveal — left an
 * empty frame at every hand-over; the panels' opacity now crossfades over
 * 300 ms at the switch while the incoming lines are already rising).
 */
export const PROJECT_SWITCH_Q = 0.08;

/**
 * C3 panel text windows, in window-local q (§5 C3), shared by the stage
 * choreography (chapters/projects/stage.ts) and the text-safe mask weights
 * (anchors.ts activeSafeRects), so the scrim, the mask and the text fade
 * together:
 * - `exit`: the previous panel's text exits (opacity 1 → 0) over q 0–.10;
 * - `reveal`: windows 1–3 reveal their index, title and fade-ups over
 *   q .08–.24 (overlapping the exit: a crossfade, not a sequence);
 * - `first`: window 0 reveals during the transit-in, while the section top
 *   moves from 30% of the viewport to stuck q .10.
 */
export const PROJECT_TEXT_Q = {
  exit: [0, 0.1],
  reveal: [0.08, 0.24],
  first: { fromPct: 30, toQ: 0.1 },
} as const;

/**
 * The home film state each chapter shows at rest: its "poster" under
 * reduced motion (§8.2), where the field crossfades between these instead of
 * morphing. C3 shows S4–S7, one per panel (S4 + panel index). Numbers are
 * StateId values (kept numeric so this file stays dependency-free).
 */
export const CHAPTER_STATE = {
  top: 1,
  about: 2,
  work: 3,
  projects: 4,
  capabilities: 8,
  contact: 9,
} as const satisfies Record<HomeChapterId, number>;

/**
 * Nav / rail / hash jump targets: the start of each chapter's hold, as an
 * offset in vh from the chapter top (§4.4). The offset only applies while the
 * chapter's stage is actually sticky; in flow the target is the section top.
 */
export const JUMP_OFFSET_VH = { top: 0, about: 10, work: 0, capabilities: 10, contact: 0 } as const satisfies Partial<
  Record<HomeChapterId, number>
>;

/**
 * Id of the heading that labels a chapter (`aria-labelledby`). Nav jumps
 * move focus to it, so render it with `tabIndex={-1}`.
 */
export const headingId = (id: ChapterId): string => `${id}-title`;
