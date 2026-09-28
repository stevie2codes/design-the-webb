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
 * Nav / rail / hash jump targets: the start of each chapter's hold, as an
 * offset in vh from the chapter top (§4.4).
 */
export const JUMP_OFFSET_VH = { top: 0, about: 10, work: 0, capabilities: 10, contact: 0 } as const satisfies Partial<
  Record<HomeChapterId, number>
>;

/**
 * Id of the heading that labels a chapter (`aria-labelledby`). Nav jumps
 * move focus to it, so render it with `tabIndex={-1}`.
 */
export const headingId = (id: ChapterId): string => `${id}-title`;
