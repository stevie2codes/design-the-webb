import { Fragment, useRef } from 'react';
import Chapter from '../components/Chapter';
import LinkLabel from '../components/LinkLabel';
import { hero } from '../content/site';
import { headingId } from '../scroll/chapters';
import { onJumpLinkClick } from '../scroll/jump';
import { store } from '../scroll/store';

/** §5 C0: the scroll cue fades out while the hero's sticky progress runs .02 → .08 (scrubbed, linear). */
const CUE_FADE = [0.02, 0.08] as const;

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
 * has no line masks or fade-ups. Reduced motion: no intro, no beam; the
 * field shows S1 printed — nothing is left to resolve, so there is no cue.
 */
export default function Hero() {
  const titleId = headingId('top');
  const cueRef = useRef<HTMLDivElement>(null);
  const cueShown = useRef(1);

  // Sticky progress → cue opacity (no React state, §8.5). In flow (reduced
  // motion, fit-guard fallback) progress means something else: keep it on.
  const onProgress = (p: number) => {
    const el = cueRef.current;
    if (!el) return;
    const t = store.chapters.top?.sticky ? (p - CUE_FADE[0]) / (CUE_FADE[1] - CUE_FADE[0]) : 0;
    const o = 1 - Math.min(1, Math.max(0, t));
    if (o === cueShown.current) return;
    cueShown.current = o;
    el.style.opacity = o >= 1 ? '' : o.toFixed(3);
    el.style.visibility = o <= 0 ? 'hidden' : '';
  };
  const words = hero.name.split(' ');
  // "Senior Product Designer — Tyler Technologies": the company never breaks.
  const [role, company] = hero.eyebrow.split(' — ');

  return (
    <Chapter id="top" labelledBy={titleId} className="overflow-x-clip" hudZone onProgress={onProgress}>
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

      {/* The name. Desktop: box top = baseline − .76em, i.e. the cap line
          (--anchor-name-y) − .07em. Mobile: block top at --anchor-name-y. */}
      <h1
        id={titleId}
        tabIndex={-1}
        className="t-name scan-print absolute z-1 left-[var(--anchor-name-x)] top-[calc(var(--anchor-name-y)-0.07em)] w-max text-ink outline-none mobile:top-[var(--anchor-name-y)]"
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
