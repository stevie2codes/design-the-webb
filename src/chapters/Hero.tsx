import { Fragment, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import Chapter from '../components/Chapter';
import LinkLabel from '../components/LinkLabel';
import Doodle from '../components/Doodle';
import SignalMeter from '../components/SignalMeter';
import { chart, hero, sketchNotes, stats } from '../content/site';
import { getField } from '../field/index';
import { NAME_TIMELINE } from '../field/layout';
import { headingId } from '../scroll/chapters';
import { onJumpLinkClick } from '../scroll/jump';
import { store } from '../scroll/store';
import { claimFocus, releaseFocus } from './choreo/fx';

/** §5 C0: the scroll cue fades out while the hero's sticky progress runs .02 → .08 (scrubbed, linear). */
const CUE_FADE = [0.02, 0.08] as const;
/**
 * Ghost name (hero idea #1): the masked <h1> keeps this much opacity at rest
 * and fades out while the rack focus resolves the particles (sticky p).
 */
const GHOST = 0.11;
const GHOST_FADE = [0.3, 0.58] as const;
/** The timeline axis under the name fades in as the name locks (sticky p). */
const AXIS_FADE = [0.5, 0.62] as const;
/** Film range in which the name is formed: hovering it reads the timeline. */
const NAME_FILM = [0.9, 1.04] as const;
const FOCUS_OWNER = 'hero-name';

const { years: YEARS, devYears: DEV_YEARS, groups: NAME_GROUP } = NAME_TIMELINE;
/** Axis tick labels (chart.ticks: 0, 2, 4, 6) at their years across the name; 4 is left out for the span label. */
const AXIS_TICKS = chart.ticks.filter((t) => Number(t) !== 4).map((t) => ({ label: t, at: Number(t) / YEARS }));
/** The two spans, labelled at their centres (chart.legend: Developer, Product design). */
const AXIS_SPANS = [
  { ...chart.legend[0], at: DEV_YEARS / 2 / YEARS },
  { ...chart.legend[1], at: (DEV_YEARS + YEARS) / 2 / YEARS },
];
const SPAN_SWATCH = { steel: 'bg-steel', signal: 'bg-ink' } as const;
/** Hover readouts per group, from the chart's stats. */
const SPAN_STAT = {
  [NAME_GROUP.dev]: stats.find((s) => s.key === 'developer'),
  [NAME_GROUP.design]: stats.find((s) => s.key === 'design'),
} as const;

/** The name is formed on screen (the displayed film is at S1). */
const nameFormed = () => store.film.shown >= NAME_FILM[0] && store.film.shown <= NAME_FILM[1];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * C0 Hero — #top, sticky, L 90vh (mobile 50svh; the only chapter sticky on
 * short landscape). SPEC §5 C0, §6 intro, §9.5 print.
 *
 * The first-paint composition is complete DOM and needs no JS: the <h1> is
 * the LCP and is visible in every path. Positions are stage-relative (the
 * stage is 100svh in sticky and flow mode alike) and come from the S1
 * anchor variables in src/field/layout.ts, so the DOM name and the particle
 * name share one coordinate system.
 *
 * Desktop: eyebrow baseline 41svh · name baseline 62svh, one line ·
 * lede top 70svh · CTAs 81svh · scroll cue 92svh (bottom centre).
 * Mobile:  eyebrow ends above the name (≈14svh) · name 20–38svh on two
 * lines · lede 44svh on two lines · CTAs stacked from 58svh · no cue.
 *
 * Measured metrics (Chromium, the real fonts): Archivo at line-height .86
 * puts the baseline .76em below the line-box top (cap height .69em);
 * JetBrains Mono at 1.4 puts it 1.06em down (.34em above the box bottom);
 * at 1.3, 1.01em down.
 *
 * Hooks for later phases:
 * - [data-field-anchor="S0"] (the viewport) and [data-field-anchor="S1"]
 *   (desktop: the name's cap box; mobile: the two-line block).
 * - h1.scan-print: JS writes --scan (0–100%) during the print; unset = 100%.
 *   The h1 is exactly as wide as the name (w-max), so --scan maps to it.
 * - h1 > [data-name-line]: one span per line (STEPHEN / WEBB) for the S1
 *   glyph sampler (§9.8); inline on desktop, block on mobile.
 * - [data-scroll-cue]: fades out at p .02–.08.
 *
 * Choreography (phase 2). Everything time-based lives in the engine
 * (field/choreo.ts): the §6 intro (canvas fade-in over S1 printed, unprint,
 * defocus into S0, skip on any input), the §9.5 lock print (beam + --scan +
 * uPrinted halo, from the director's Schmitt trigger) and the hand-back at
 * the start of seg1. The rack focus (seg0) is scrubbed by the director from
 * scroll; the HUD climbs with it. This component only:
 * - fades the scroll cue with sticky progress (onProgress, ref writes);
 * - hides the cue while the intro is expected or runs (`intro:` variant:
 *   html[data-intro] is "pending" from the pre-paint script until the
 *   engine starts the intro or drops the guess, then "running"), so it
 *   "appears at the end" (§6 step 4) and never blinks at first paint.
 * Eyebrow, lede and CTAs never move (the lede captions the effect), so C0
 * has no line masks or fade-ups.
 *
 * Hero ideas #1, #2, #4, #5, #9 (SPEC §5 C0):
 * - Ghost: sticky progress writes the h1's --ghost (11% at rest → 0 over
 *   p .30–.58), so the masked name shows faintly instead of as a hole. The
 *   `live:` class defaults are the rest values until the first update.
 * - The loupe peek (#2) is all shader (field.vert.glsl).
 * - S/N meter (#4): <SignalMeter>, right gutter on the eyebrow's baseline.
 * - One soft stage scrim (#5): .soft-scrim + .stage-scrim.
 * - The name as a career timeline (#9): the S1 grains are steel / signal by
 *   year (layout.ts NAME_TIMELINE); the axis below the h1 labels the
 *   hairline (--resolve: p .50–.62), and hovering the formed name unprints
 *   it, lights the hovered span (claimFocus) and shows its stat. Reduced motion: no intro, no beam; the
 * field shows S1 printed — nothing is left to resolve, so there is no cue.
 */
export default function Hero() {
  const titleId = headingId('top');
  const cueRef = useRef<HTMLDivElement>(null);
  const cueShown = useRef(1);
  const nameRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipValueRef = useRef<HTMLSpanElement>(null);
  const tipLabelRef = useRef<HTMLSpanElement>(null);
  /** Hover state: the cached name box, the lit group, and whether the hover unprinted the name. */
  const hover = useRef<{ rect: DOMRect | null; group: number; unprinted: boolean }>({
    rect: null,
    group: -1,
    unprinted: false,
  });
  const written = useRef({ ghost: -1, resolve: -1 });

  const endHover = () => {
    const h = hover.current;
    if (h.group >= 0) releaseFocus(FOCUS_OWNER);
    // Hand the name back to the DOM type (a fresh beam) if the lock still holds.
    if (h.unprinted && store.flags.printedLock) getField()?.print(true);
    h.rect = null;
    h.group = -1;
    h.unprinted = false;
    tipRef.current?.removeAttribute('data-on');
  };

  // Sticky progress → cue opacity, ghost and axis (no React state, §8.5).
  // In flow (reduced motion, fit-guard fallback) progress means something
  // else: the cue stays on, and the name and its axis are simply shown.
  const onProgress = (p: number) => {
    const sticky = !!store.chapters.top?.sticky;
    const el = cueRef.current;
    if (el) {
      const t = sticky ? (p - CUE_FADE[0]) / (CUE_FADE[1] - CUE_FADE[0]) : 0;
      const o = 1 - Math.min(1, Math.max(0, t));
      if (o !== cueShown.current) {
        cueShown.current = o;
        el.style.opacity = o >= 1 ? '' : o.toFixed(3);
        el.style.visibility = o <= 0 ? 'hidden' : '';
      }
    }
    const ghost = sticky ? Math.round(GHOST * (1 - smooth(GHOST_FADE[0], GHOST_FADE[1], p)) * 1000) / 1000 : 0;
    const resolve = sticky ? Math.round(smooth(AXIS_FADE[0], AXIS_FADE[1], p) * 1000) / 1000 : 1;
    const w = written.current;
    // Always written (never removed): the live: defaults below are the rest
    // values, for the first paint before any progress update.
    if (ghost !== w.ghost) {
      w.ghost = ghost;
      h1Ref.current?.style.setProperty('--ghost', String(ghost));
    }
    if (resolve !== w.resolve) {
      w.resolve = resolve;
      nameRef.current?.style.setProperty('--resolve', String(resolve));
    }
    if (hover.current.rect && !nameFormed()) endHover();
  };

  useEffect(() => () => endHover(), []);

  // Hover the formed name (fine pointer, full motion): it hands its glyphs
  // back to the particles, the hovered span of the timeline lights (S1 focus
  // groups) and a readout names it; leaving re-prints the name.
  const onNameMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || !store.pointer.fine || store.mode !== 'full' || !nameFormed()) {
      if (hover.current.rect) endHover();
      return;
    }
    const h = hover.current;
    if (!h.rect) {
      h.rect = e.currentTarget.getBoundingClientRect(); // once per hover, in a handler
      if (store.flags.printedLock) {
        getField()?.print(false);
        h.unprinted = true;
      }
    }
    const r = h.rect;
    const t = (e.clientX - r.left) / Math.max(1, r.width);
    const group = t < DEV_YEARS / YEARS ? NAME_GROUP.dev : NAME_GROUP.design;
    const tip = tipRef.current;
    if (group !== h.group) {
      h.group = group;
      claimFocus(FOCUS_OWNER, [group], [NAME_GROUP.dev, NAME_GROUP.design], { low: 0, focusOn: 1 });
      const stat = SPAN_STAT[group];
      if (tipValueRef.current) tipValueRef.current.textContent = stat?.value ?? '';
      if (tipLabelRef.current) tipLabelRef.current.textContent = stat?.label ?? '';
      tip?.setAttribute('data-on', '');
    }
    if (tip) tip.style.transform = `translate(${(e.clientX - r.left).toFixed(1)}px, ${(e.clientY - r.top).toFixed(1)}px)`;
  };

  const words = hero.name.split(' ');
  // "Senior Product Designer — Tyler Technologies": the company never breaks.
  const [role, company] = hero.eyebrow.split(' — ');

  return (
    <Chapter id="top" labelledBy={titleId} className="soft-scrim overflow-x-clip" hudZone onProgress={onProgress}>
      {/* One soft scrim for the stage (hero idea #5) instead of a box per block. */}
      <div aria-hidden="true" className="stage-scrim" />
      {/* Field anchors. S0 is full bleed; S1 registers to the <h1>. */}
      <div aria-hidden="true" data-field-anchor="S0" />
      <div aria-hidden="true" data-field-anchor="S1" />

      {/* Eyebrow. Desktop: baseline at 41svh, or 24px above the cap line when
          the name is tall for the viewport. Mobile: box bottom 12px above
          the name block (≈14svh at 390×844), clear of the 80px nav band. */}
      <p
        data-safe="tight"
        className="t-label absolute left-gutter top-[calc(min(41svh,var(--anchor-name-y)-24px)+0.34em)] -translate-y-full whitespace-nowrap text-ink-2 mobile:top-[calc(var(--anchor-name-y)-12px)] mobile:right-gutter mobile:whitespace-normal"
      >
        {company ? (
          <>
            {role} — <span className="whitespace-nowrap">{company}</span>
          </>
        ) : (
          hero.eyebrow
        )}
      </p>

      {/* S/N meter (desktop, aria-hidden): right gutter, its track on the
          eyebrow's baseline. */}
      <SignalMeter className="absolute right-gutter top-[min(41svh,calc(var(--anchor-name-y)-24px))] -translate-y-full mobile:hidden short:hidden rm:hidden nojs:hidden" />

      {/* The name. Desktop: box top = baseline − .76em, i.e. the cap line
          (--anchor-name-y) − .07em. Mobile: block top at --anchor-name-y.
          The wrapper is exactly as wide as the <h1> (w-max), so the timeline
          axis below it runs in the name's own coordinates. */}
      <div
        ref={nameRef}
        className="absolute z-1 left-[var(--anchor-name-x)] top-[calc(var(--anchor-name-y)-var(--name-fs)*0.07)] w-max live:[--resolve:0] mobile:top-[var(--anchor-name-y)]"
      >
        <h1
          ref={h1Ref}
          id={titleId}
          tabIndex={-1}
          onPointerMove={onNameMove}
          onPointerLeave={endHover}
          className="t-name scan-print text-ink outline-none live:[--ghost:0.11]"
        >
          {words.map((word, i) => (
            <Fragment key={word}>
              {i > 0 && ' '}
              <span data-name-line={i} className="mobile:block">
                {word}
              </span>
            </Fragment>
          ))}
        </h1>

        {/* The name as a career timeline (hero idea #9; desktop, aria-hidden —
            the About chart and its table carry the facts): the ember hairline
            the field draws .14em under the baseline is a YEARS axis, labelled
            here in the name's coordinates. Fades in as the name locks. */}
        <div
          aria-hidden="true"
          className="t-micro pointer-events-none absolute inset-x-0 top-[calc(100%+var(--name-fs)*0.04+14px)] h-[1.3em] whitespace-nowrap uppercase text-ink-2 opacity-(--resolve) mobile:hidden nojs:hidden"
        >
          {AXIS_TICKS.map((tick) => (
            <span key={tick.label} className="absolute -translate-x-1/2" style={{ left: `${tick.at * 100}%` }}>
              {tick.label}
              {tick.at === 1 && <span className="absolute left-full ml-[1.2em]">{chart.axisTitle}</span>}
            </span>
          ))}
          {AXIS_SPANS.map((span) => (
            <span
              key={span.label}
              className="absolute flex -translate-x-1/2 items-center gap-2"
              style={{ left: `${span.at * 100}%` }}
            >
              <span className={`size-2 shrink-0 rounded-[1px] ${SPAN_SWATCH[span.swatch]}`} />
              {span.label}
            </span>
          ))}
        </div>

        {/* Hover readout (aria-hidden): follows the pointer over the formed name. */}
        <div
          ref={tipRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 opacity-0 transition-opacity duration-200 ease-ui data-on:opacity-100"
        >
          <div className="-translate-x-1/2 -translate-y-[calc(100%+18px)] flex items-baseline gap-3 whitespace-nowrap rounded-[6px] border border-line-strong bg-surface px-3 py-2">
            <span ref={tipValueRef} className="t-label text-ember" />
            <span ref={tipLabelRef} className="t-label text-ink" />
          </div>
        </div>
      </div>

      {/* Lede and CTAs. The box runs from the lede top to the CTA bottom:
          desktop 70svh → 81svh + 48px; mobile 44svh → 58svh + two 48px
          buttons. When the lede is taller than the gap, gap-* takes over. */}
      <div
        data-safe="tight"
        className="absolute left-gutter top-[70svh] flex min-h-[calc(11svh+48px)] flex-col justify-between gap-6 mobile:right-gutter mobile:top-[max(44svh,calc(var(--anchor-name-y)+var(--name-fs)*1.72+28px))] mobile:min-h-[calc(14svh+108px)] mobile:gap-8"
      >
        <p data-cursor="text" className="t-display-m text-ink desktop:whitespace-nowrap">
          {hero.lede.lead} <span className="t-accent mobile:block">{hero.lede.accent}</span>
        </p>
        {/* Phones: stacked, the primary full width (§5 C0 mobile). Portrait
            tablets (mobile layout, ≥ 600px wide): a 750px pill is a slab, so
            the pair sits in a row as on desktop. */}
        <div className="flex items-center gap-x-9 mobile:flex-col mobile:items-stretch mobile:gap-y-3 mobile:min-[600px]:flex-row mobile:min-[600px]:items-center">
          {/* In-page jumps: a plain click lands on the chapter's hold start with
              focus on its <h2> (§4.4), like the nav; the href is the no-JS path. */}
          <a
            href={hero.ctaPrimary.href}
            onClick={onJumpLinkClick}
            className="btn btn-ember mobile:w-full mobile:min-[600px]:w-auto"
          >
            <LinkLabel cta={hero.ctaPrimary} />
          </a>
          <a
            href={hero.ctaSecondary.href}
            onClick={onJumpLinkClick}
            className="link-line t-label text-ink mobile:min-h-12 mobile:self-center"
          >
            <LinkLabel cta={hero.ctaSecondary} />
          </a>
          {/* Sketch theme: a margin note pointing back at the CTAs (aria-hidden). */}
          <span aria-hidden="true" className="pointer-events-none -ml-4 hidden items-center gap-1 sketch:desktop:flex">
            <Doodle kind="arrowLeft" className="h-10 w-16 text-steel" />
            <span className="aside-note -translate-y-3">{sketchNotes.hero}</span>
          </span>
        </div>
      </div>

      {/* Scroll cue (desktop, aria-hidden): label baseline at 92svh over a
          1px line that runs toward the fold, max 48px, with a travelling
          dot. Hidden on short viewports, where it would crowd the CTAs. */}
      <div
        ref={cueRef}
        aria-hidden="true"
        data-scroll-cue
        className="t-micro pointer-events-none absolute left-1/2 top-[calc(92svh-1.01em)] -translate-x-1/2 whitespace-nowrap uppercase text-ink-2 mobile:hidden short:hidden rm:hidden"
      >
        {/* Hidden while the intro is expected or runs; fades in as it ends (§6 step 4). */}
        <div className="flex flex-col items-center gap-2.5 transition-opacity duration-700 ease-ui intro:opacity-0 intro:duration-300">
          <span>{hero.scrollCue}</span>
          <span className="relative block h-[clamp(0px,calc(8svh-0.29em-22px),48px)] w-px overflow-y-clip bg-line-strong">
            <span className="absolute inset-0 animate-cue">
              <span className="absolute top-0 left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-ember" />
            </span>
          </span>
        </div>
      </div>
    </Chapter>
  );
}
