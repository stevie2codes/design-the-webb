/**
 * C3 Side projects — the stage choreography (SPEC §5 C3, §3.10 S4–S7 curtain,
 * §8.1 focus rules). Built from Projects' `reveal(ctx)` callback; reads the
 * hooks ProjectPanel renders:
 *   [data-panel="k"]           one window (1–4), `data-active` on the one on screen
 *   [data-p-index] [data-p-title]   line-masked (the title is the Link itself:
 *                              SplitText's aria labels the <a>, never an ancestor
 *                              of a focusable element)
 *   [data-p-up]                fade-ups (description, chips, each link)
 *   [data-p-exit]              the text blocks that exit (opacity 0, y −20px)
 *   [data-card-link] > [data-card-glow] + [data-card-clip]   the screenshot card
 *   [data-mcp-caption]         MCP App's "Screenshot coming soon"
 *   [data-rows-counter]        the "ROWS nn/52" readouts ([data-rows-stage]: the stage one)
 *   [data-charge]              the title links (hover / focus → uCharge .5)
 *   a[data-detail-link]        links to /work/:slug (the route transition)
 *   [data-counter-roll]        the "01 / 04" digit column
 *
 * Window k (q = local progress, 4 windows × 62.5vh over L = 250vh; the
 * stage timeline runs t = k + q ∈ [0, 4] = 4 × sticky progress):
 *
 * | q            | Window 0 (Pulse)                        | Windows 1–3                                    |
 * |--------------|-----------------------------------------|------------------------------------------------|
 * | transit      | text in: section top 30% → stuck q .10  | —                                              |
 * | 0–.10        | —                                       | card k−1 closes to inset(50%), scale .96 (and   |
 * |              |                                         | fades out over .02–.10); its text exits (with   |
 * |              |                                         | its scrim); fx.disperse 1 → 0                   |
 * | .08          | —                                       | data-active hands over (counter rolls, 400 ms; |
 * |              |                                         | the panels crossfade over 300 ms)              |
 * | .08–.24      | —                                       | index + title line masks; description, chips   |
 * |              |                                         | and links fade up 16px (stagger .03); the text |
 * |              |                                         | blocks' scrims fade in with them (--scrim)     |
 * | .40/.42–.55/.56 | CURTAIN: fx.disperse 0 → 1 (emblem ×1.6, α ×.35 — a halo round the card);  |
 * |              | the card opens inset(50% round 16px) → inset(0 round 16px), scale .96 → 1, glow on |
 * | .55/.56–1    | HOLD (44–45%): card open, text still; only the emblem's live loop moves      |
 *
 * - MCP App (window 3, no screenshot): no card; the same fx.disperse 0 → 1
 *   grows the constellation ×1.15 into the card box (anchors.ts) and the
 *   caption fades up under it.
 * - Gov Data Generator (window 1): the stage "ROWS nn/52" readout shows during
 *   the silhouette hold (fades in q .26–.32, out .42–.48), and every ROWS
 *   readout follows the lattice write-head (`latticeRow(frame.now)`, the
 *   shader's own clock) at 30 Hz while the field shows S5.
 * - Inactive panels are opacity 0 / no pointer events (CSS `staged:` +
 *   `data-active`) but stay in the DOM and the tab order; focus inside panel
 *   k glides to that window's hold (useChapter focus-in, PROJECT_HOLD_Q).
 * - Scrims: a panel's two [data-safe] text blocks carry `--scrim` (their
 *   ::before opacity), scrubbed 0 → 1 with the reveal — window 0's over its
 *   transit-in window — so no empty dark box pops in at the hand-over. The
 *   shader's text-safe mask follows the same windows (anchors.ts
 *   activeSafeRects weights, PROJECT_TEXT_Q).
 * - The stage context is built OUTSIDE the chapter's gsap context (it is
 *   reverted once, by this module), and every property it wrote is cleared
 *   after its revert (a flip to flow, the Motion toggle, unmount).
 *
 * Everything scrubbed is `ease: none` (Lenis + the field damp smooth it).
 * The stage part exists only while the stage is actually sticky (desktop,
 * full motion, not [data-overflow]); it is rebuilt when a refresh flips that
 * (the fit guard), and reverted to the plain flow panels otherwise. Reveals
 * work in both (useChapter's windows fall back to per-element flow windows).
 *
 * Both modes: title hover / focus-visible → uCharge .5 while the field shows
 * that emblem; plain clicks on /work links run the §6 route transition.
 */
import { projects } from '../../content/projects';
import { sideProjects } from '../../content/site';
import { StateId } from '../../field/states/ids';
import { onScrollRefresh, requestRefresh } from '../../motion/lenis';
import { reportLoadError } from '../../motion/lazy';
import { prime } from '../../motion/prime';
import { PROJECT_SWITCH_Q, PROJECT_TEXT_Q, PROJECT_WINDOW_VH } from '../../scroll/chapters';
import { frame } from '../../scroll/director';
import { store } from '../../scroll/store';
import type { ChapterContext } from '../../scroll/useChapter';
import { invalidateField } from '../choreo/film';
import { setCharge } from '../choreo/fx';
import { scrubVars } from '../choreo/reveal';
import { leaveHome, preloadDetail } from './route';

/** §5 C3 window timeline, in window-local progress q. */
export const STAGE_Q = {
  /** Previous card closes, previous text exits, disperse 1 → 0. */
  close: PROJECT_TEXT_Q.exit,
  /** The closing card fades out within its close, so it never ends as a floating chip. */
  cardFade: [0.02, 0.1],
  /** `data-active` hands over (between the exit and the reveal); the text-safe rects switch with it. */
  switch: PROJECT_SWITCH_Q,
  /** Index / title line masks, fade-ups and the text scrims (windows 1–3). */
  reveal: PROJECT_TEXT_Q.reveal,
  /** Window 0's text: section top 30% of the viewport → stuck q .10. */
  firstReveal: PROJECT_TEXT_Q.first,
  /** Curtain, window 0 and windows 1–3. */
  curtain0: [0.4, 0.55],
  curtain: [0.42, 0.56],
  /** Gov Data Generator ROWS readout (window 1): in, out. */
  rowsIn: [0.26, 0.32],
  rowsOut: [0.42, 0.48],
} as const;

export const WINDOWS = 4;
/** Text exit rise (px, §7.3 ≤ 24px). */
const EXIT_Y = -20;
/** Fade-up stagger inside a panel (§5 C3). */
const UP_STAGGER = 0.03;
/** Every inline property the stage writes (cleared after its revert). */
const STAGE_PROPS = 'clipPath,transform,translate,scale,opacity,--scrim';
/** Card closed / open (§5 C3). Four explicit insets, so gsap interpolates them. */
const CLIP_CLOSED = 'inset(50% 50% 50% 50% round 16px)';
const CLIP_OPEN = 'inset(0% 0% 0% 0% round 16px)';
const CARD_CLOSED_SCALE = 0.96;
/** Title hover charge (§5 C3). */
const TITLE_CHARGE = 0.5;
/** A title charges the field only while its emblem is on screen (displayed F within this). */
const CHARGE_GATE = 0.75;
/** ROWS readout rate (§3.10 S5: 30 Hz). */
const ROWS_HZ = 30;
const OWNER = 'projects';

const curtainOf = (k: number): readonly [number, number] => (k === 0 ? STAGE_Q.curtain0 : STAGE_Q.curtain);

export interface StageOptions {
  /** react-router's navigate (kept in a ref by Projects: always the current one). */
  navigate(to: string): void;
}

interface PanelEls {
  readonly el: HTMLElement;
  readonly emblem: StateId;
  readonly index: HTMLElement | null;
  readonly title: HTMLElement | null;
  readonly ups: HTMLElement[];
  readonly exits: HTMLElement[];
  readonly card: HTMLElement | null;
  readonly clip: HTMLElement | null;
  readonly glow: HTMLElement | null;
  readonly caption: HTMLElement | null;
  readonly rows: HTMLElement | null;
}

function panelEls(section: HTMLElement): PanelEls[] {
  const out: PanelEls[] = [];
  for (let k = 1; k <= WINDOWS; k++) {
    const el = section.querySelector<HTMLElement>(`[data-panel="${k}"]`);
    if (!el) continue;
    const q = (sel: string) => el.querySelector<HTMLElement>(sel);
    out.push({
      el,
      emblem: projects[k - 1]?.emblem ?? StateId.PULSE,
      index: q('[data-p-index]'),
      title: q('[data-p-title]'),
      ups: Array.from(el.querySelectorAll<HTMLElement>('[data-p-up]')),
      exits: Array.from(el.querySelectorAll<HTMLElement>('[data-p-exit]')),
      card: q('[data-card-link]'),
      clip: q('[data-card-clip]'),
      glow: q('[data-card-glow]'),
      caption: q('[data-mcp-caption]'),
      rows: q('[data-rows-stage]'),
    });
  }
  return out;
}

/** A plain left click (no modifier): the only click a route transition may take over. */
const plainClick = (e: MouseEvent): boolean =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** Build the C3 choreography; returns its cleanup. */
export function projectsChoreo(ctx: ChapterContext, opts: StageOptions): () => void {
  const { section, gsap } = ctx;
  const panels = panelEls(section);
  const cleanups: Array<() => void> = [];
  let alive = true;

  // ── Reveals (full motion; null under reduced motion) ──────────────────────
  // Window-relative windows: "section top at X% of the viewport", so window
  // k's q maps to X = −(k + q)·62.5. In flow they fall back to per-element
  // windows (useChapter).
  panels.forEach((p, k) => {
    const pct = (q: number) => -(k + q) * PROJECT_WINDOW_VH;
    const [from, to] =
      k === 0
        ? [STAGE_Q.firstReveal.fromPct, pct(STAGE_Q.firstReveal.toQ)]
        : [pct(STAGE_Q.reveal[0]), pct(STAGE_Q.reveal[1])];
    for (const el of [p.index, p.title]) if (el) ctx.track(ctx.lineMask(el, { window: ctx.window(el, from, to) }));
    if (p.ups.length) {
      ctx.track(ctx.fadeUp(p.ups, { window: ctx.window(p.ups[0], from, to), stagger: UP_STAGGER }));
    }
  });

  // ── The stage (sticky only) ───────────────────────────────────────────────
  const roll = section.querySelector<HTMLElement>('[data-counter-roll]');
  let active = -1;
  const setActive = (progress: number, force = false): void => {
    const t = progress * WINDOWS;
    let a = 0;
    for (let k = 1; k < panels.length; k++) if (t >= k + STAGE_Q.switch) a = k;
    if (a === active && !force) return;
    active = a;
    panels.forEach((p, k) => p.el.toggleAttribute('data-active', k === a));
    if (roll) roll.style.transform = `translateY(${(-100 * a) / WINDOWS}%)`;
  };

  let staged: boolean | null = null;
  let stage: ReturnType<typeof gsap.context> | null = null;

  const cards = panels.flatMap((p) => (p.card ? [p.card] : []));
  const clips = panels.flatMap((p) => (p.clip ? [p.clip] : []));
  const glows = panels.flatMap((p) => (p.glow ? [p.glow] : []));
  const captions = panels.flatMap((p) => (p.caption ? [p.caption] : []));
  const rows = panels.flatMap((p) => (p.rows ? [p.rows] : []));
  const exits = panels.flatMap((p) => p.exits);
  // The MCP caption's box (caption + its stand-in window): fades with seg7.
  const captionBox = panels[panels.length - 1]?.caption?.parentElement ?? null;
  const touched = [...cards, ...clips, ...glows, ...captions, ...rows, ...exits, ...(captionBox ? [captionBox] : [])];

  /** The stuck stage: initial states, window 0's scrim, and the 4-window timeline (built in its own context). */
  const stageTimeline = (): void => {
    const fx = store.fx;
    if (clips.length) gsap.set(clips, { clipPath: CLIP_CLOSED });
    if (cards.length) gsap.set(cards, { scale: CARD_CLOSED_SCALE });
    if (glows.length) gsap.set(glows, { opacity: 0 });
    if (captions.length) gsap.set(captions, { opacity: 0, y: 16 });
    if (rows.length) gsap.set(rows, { opacity: 0 });
    // Text scrims: 0 until the panel's text reveals (window 0: its transit-in).
    if (exits.length) gsap.set(exits, { '--scrim': 0 });
    const first = panels[0]?.exits ?? [];
    if (first.length) {
      const w = ctx.window(first[0], STAGE_Q.firstReveal.fromPct, -STAGE_Q.firstReveal.toQ * PROJECT_WINDOW_VH);
      prime(gsap.fromTo(first, { '--scrim': 0 }, { '--scrim': 1, ease: 'none', scrollTrigger: scrubVars(w) }));
    }

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => setActive(self.progress),
        onRefresh: (self) => setActive(self.progress, true),
      },
    });

    panels.forEach((p, k) => {
      const [c0, c1] = curtainOf(k);
      const at = k + c0;
      const dur = c1 - c0;
      // fromTo with both ends spelled out: browsers normalise the computed
      // inset() ("inset(50% round 16px)"), which gsap cannot pair with a
      // four-value end. immediateRender off: gsap.set above owns the start.
      if (p.clip) tl.fromTo(p.clip, { clipPath: CLIP_CLOSED }, { clipPath: CLIP_OPEN, duration: dur, immediateRender: false }, at);
      if (p.card) tl.to(p.card, { scale: 1, duration: dur }, at);
      if (p.glow) tl.to(p.glow, { opacity: 1, duration: dur }, at);
      if (p.caption) tl.to(p.caption, { opacity: 1, y: 0, duration: dur }, at);
      tl.to(fx, { disperse: 1, duration: dur }, at);
      if (k > 0 && p.exits.length) {
        const [r0, r1] = STAGE_Q.reveal;
        tl.fromTo(p.exits, { '--scrim': 0 }, { '--scrim': 1, duration: r1 - r0, immediateRender: false }, k + r0);
      }

      if (k < panels.length - 1) {
        const t0 = k + 1 + STAGE_Q.close[0];
        const d = STAGE_Q.close[1] - STAGE_Q.close[0];
        if (p.clip) tl.fromTo(p.clip, { clipPath: CLIP_OPEN }, { clipPath: CLIP_CLOSED, duration: d, immediateRender: false }, t0);
        if (p.clip) {
          const [f0, f1] = STAGE_Q.cardFade;
          tl.fromTo(p.clip, { opacity: 1 }, { opacity: 0, duration: f1 - f0, immediateRender: false }, k + 1 + f0);
        }
        if (p.card) tl.to(p.card, { scale: CARD_CLOSED_SCALE, duration: d }, t0);
        if (p.glow) tl.to(p.glow, { opacity: 0, duration: d }, t0);
        if (p.exits.length) tl.to(p.exits, { opacity: 0, y: EXIT_Y, duration: d }, t0);
        tl.to(fx, { disperse: 0, duration: d }, t0);
      }
      if (p.rows) {
        tl.to(p.rows, { opacity: 1, duration: STAGE_Q.rowsIn[1] - STAGE_Q.rowsIn[0] }, k + STAGE_Q.rowsIn[0]);
        tl.to(p.rows, { opacity: 0, duration: STAGE_Q.rowsOut[1] - STAGE_Q.rowsOut[0] }, k + STAGE_Q.rowsOut[0]);
      }
    });
    // The MCP caption labels the constellation: it fades out over the first
    // 20% of seg7 (S7 → S8, capabilities top 80% → −10% of the viewport:
    // segments.ts), so it never floats alone over the haze once the stage
    // scrolls away. Its box, not the caption: the timeline owns the caption's
    // own opacity.
    const caps = document.getElementById('capabilities');
    if (captionBox && caps) {
      prime(
        gsap.fromTo(
          captionBox,
          { opacity: 1 },
          { opacity: 0, ease: 'none', immediateRender: false, scrollTrigger: { trigger: caps, start: 'top 80%', end: 'top 62%', scrub: true } },
        ),
      );
    }

    // Pin the timeline to exactly four windows (t = 4 × progress).
    tl.set({}, {}, WINDOWS);
    // Initialise every tween now, in this context (§8.5: no computed-style
    // reads in the scroll frame that first reaches one; and their recorded
    // start states belong to the stage context, never the chapter's).
    prime(tl);
  };

  /**
   * The stage lives in its OWN gsap context, never nested in the chapter's:
   * syncStage runs first inside the chapter's reveal callback (the chapter
   * context would record the stage context and revert it a second time,
   * re-applying the recorded CLOSED clip-paths), later from a refresh.
   */
  const buildStage = (): ReturnType<typeof gsap.context> => {
    // gsap.context() with no argument: the context being built right now, if any.
    const outer = gsap.context() as ReturnType<typeof gsap.context> | undefined;
    if (!outer) return gsap.context(stageTimeline, section);
    const made: { ctx?: ReturnType<typeof gsap.context> } = {};
    outer.ignore(() => {
      made.ctx = gsap.context(stageTimeline, section);
    });
    return made.ctx ?? gsap.context(stageTimeline, section);
  };
  const clearStage = (): void => {
    if (touched.length) gsap.set(touched, { clearProps: STAGE_PROPS });
    for (const el of exits) el.style.removeProperty('--scrim');
  };
  const revertStage = (): void => {
    if (!stage) return;
    stage.revert();
    stage = null;
    clearStage();
  };


  /**
   * Flow panels (reduced motion, the fit-guard fallback): on desktop every
   * card is shown open ON its emblem's anchor, so the emblem takes its final,
   * post-curtain pose — the ×1.6 halo framing the card (§8.2 "each
   * chapter's final state"); at disperse 0 the opaque card hid S4–S6
   * entirely. Mobile gives the emblem its own slot above the card: 0.
   */
  const flowDisperse = (): void => {
    const v = store.layout === 'desktop' ? 1 : 0;
    if (store.fx.disperse === v) return;
    store.fx.disperse = v;
    invalidateField();
  };
  const syncStage = (): void => {
    if (!alive) return;
    const sticky = !ctx.reduced && ctx.isSticky();
    if (sticky === staged) {
      if (!sticky) flowDisperse();
      return;
    }
    staged = sticky;
    revertStage();
    store.fx.disperse = 0;
    if (sticky) {
      stage = buildStage();
      requestRefresh(); // position the new trigger
    } else {
      setActive(0, true);
      flowDisperse();
    }
  };
  syncStage();
  // The fit guard (or a resize) can flip the stage to flow and back: follow it.
  cleanups.push(
    onScrollRefresh(() => {
      if (staged !== (!ctx.reduced && ctx.isSticky())) requestAnimationFrame(syncStage);
    }),
  );
  cleanups.push(() => {
    revertStage();
    store.fx.disperse = 0;
  });
  // useChapter reverts the chapter's context after this cleanup and then the
  // tracked reveals: clear the stage's properties once more at the very end
  // (a start state recorded in the chapter's context would re-apply them).
  ctx.track({ complete() {}, revert: clearStage });

  // ── ROWS nn/52 (S5 write-head, §3.10) ─────────────────────────────────────
  const rowsEls = Array.from(section.querySelectorAll<HTMLElement>('[data-rows-counter]'));
  if (rowsEls.length) {
    let shown = '';
    const write = (s: string): void => {
      if (s === shown) return;
      shown = s;
      for (const el of rowsEls) el.textContent = s;
    };
    import('../../field/states/s05-lattice').then(({ latticeRow, LATTICE_POSTER_T }) => {
      if (!alive) return;
      if (ctx.reduced) {
        write(sideProjects.rowsCounter(latticeRow(LATTICE_POSTER_T))); // the poster: fully printed
        return;
      }
      let last = -Infinity;
      const tick = (time: number): void => {
        if (time - last < 1 / ROWS_HZ) return;
        last = time;
        if (frame.now <= 0 || Math.abs(frame.F - StateId.LATTICE) > CHARGE_GATE) return;
        write(sideProjects.rowsCounter(latticeRow(frame.now)));
      };
      gsap.ticker.add(tick);
      cleanups.push(() => gsap.ticker.remove(tick));
    }, reportLoadError);
  }

  // ── Title charge (§5 C3: hover → uCharge .5; §8.1: also on focus-visible) ─
  let charged: HTMLElement | null = null;
  let chargeOn = false;
  const emblemOf = (el: HTMLElement): number => {
    const panel = el.closest<HTMLElement>('[data-panel]');
    const k = panel ? Number(panel.dataset.panel) - 1 : -1;
    return projects[k]?.emblem ?? -1;
  };
  /** On while a title is hovered / focused AND its emblem is on screen. */
  const applyCharge = (): void => {
    const on = charged !== null && (frame.now <= 0 || Math.abs(frame.F - emblemOf(charged)) < CHARGE_GATE);
    if (on === chargeOn) return;
    chargeOn = on;
    setCharge(OWNER, on, TITLE_CHARGE);
  };
  const charge = (el: HTMLElement | null): void => {
    if (el === charged) return;
    charged = el;
    applyCharge();
  };
  if (!ctx.reduced) {
    // A keyboard focus glides to its window after the focus lands: follow the film.
    const tick = (): void => {
      if (charged) applyCharge();
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }
  const chargeTarget = (t: EventTarget | null): HTMLElement | null =>
    t instanceof Element ? t.closest<HTMLElement>('[data-charge]') : null;
  const onOver = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    const el = chargeTarget(e.target);
    if (el) charge(el);
  };
  const onOut = (e: PointerEvent): void => {
    if (!charged || e.pointerType === 'touch') return;
    const to = e.relatedTarget;
    if (!(to instanceof Node) || !charged.contains(to)) charge(null);
  };
  const onFocusIn = (e: FocusEvent): void => {
    const el = chargeTarget(e.target);
    if (el && el.matches(':focus-visible')) charge(el);
  };
  const onFocusOut = (e: FocusEvent): void => {
    if (charged && chargeTarget(e.target) === charged) charge(null);
  };

  // ── Route transition (§6 home → detail) ───────────────────────────────────
  const detailLink = (t: EventTarget | null): HTMLAnchorElement | null =>
    t instanceof Element ? t.closest<HTMLAnchorElement>('a[data-detail-link]') : null;
  const onClick = (e: MouseEvent): void => {
    const a = detailLink(e.target);
    if (!a || e.defaultPrevented || !plainClick(e)) return;
    if (leaveHome(a.getAttribute('href') ?? a.pathname, opts.navigate)) e.preventDefault();
  };
  const onIntent = (e: Event): void => {
    if (detailLink(e.target)) preloadDetail();
  };

  section.addEventListener('pointerover', onOver);
  section.addEventListener('pointerout', onOut);
  section.addEventListener('focusin', onFocusIn);
  section.addEventListener('focusout', onFocusOut);
  section.addEventListener('click', onClick);
  section.addEventListener('pointerdown', onIntent, { passive: true });
  cleanups.push(() => {
    section.removeEventListener('pointerover', onOver);
    section.removeEventListener('pointerout', onOut);
    section.removeEventListener('focusin', onFocusIn);
    section.removeEventListener('focusout', onFocusOut);
    section.removeEventListener('click', onClick);
    section.removeEventListener('pointerdown', onIntent);
    charged = null;
    chargeOn = false;
    setCharge(OWNER, false);
  });

  return () => {
    alive = false;
    for (const fn of cleanups.splice(0)) fn();
  };
}
