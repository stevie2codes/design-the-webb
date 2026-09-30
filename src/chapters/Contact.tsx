import { useCallback, useEffect, useRef, type FocusEvent, type PointerEvent } from 'react';
import Chapter from '../components/Chapter';
import ChapterHeading from '../components/ChapterHeading';
import CopyEmail from '../components/CopyEmail';
import Doodle from '../components/Doodle';
import LinkLabel from '../components/LinkLabel';
import { contact, sketchNotes } from '../content/site';
import { headingId } from '../scroll/chapters';
import type { ChapterContext } from '../scroll/useChapter';
import { contactChoreo, CTA_CHARGE_OWNER } from './choreo/contact';
import { fireNova, setCharge, settleOneShots } from './choreo/fx';

type Gsap = ChapterContext['gsap'];

/** §5 C5: the email row, body and portrait fade up while the section top moves from 30% to 0%. */
const UP_WINDOW = '30,0';

/**
 * Stage-level measures (inherited by everything below):
 * - --disc-d: the beacon CTA disc, 1.24R across (§5 C5), never smaller than
 *   the label needs (≈ 7rem at 16px).
 * - --email-y: where the email row starts: 74svh desktop, 68svh mobile.
 *   Short screens (height < 600, or < 700 on phones) drop it and just
 *   clear the beacon, so the sticky stage still holds everything; short
 *   phones also tighten the body gap and the bottom padding (360×640 stays
 *   sticky).
 * - --disc-gap / --shell-gap: how far the email row clears the disc and the
 *   beacon's shell; tighter on short phones (mobile, height < 600, where the
 *   beacon is also ×.8 at 44svh: layout.ts), so 375×548 and 360×560 stay
 *   sticky too.
 */
const STAGE =
  'group/contact [--disc-d:max(calc(var(--anchor-beacon-r)*1.24),6.75rem)] [--email-y:68svh] desktop:[--email-y:74svh] mobile:[@media(max-height:699.98px)]:[--email-y:0px] short:[--email-y:0px] [--disc-gap:24px] [--shell-gap:16px] mobile:short:[--disc-gap:16px] mobile:short:[--shell-gap:4px]';

/**
 * C5 Contact — #contact (SPEC §5 C5). Sticky on both layouts (L 40vh desktop,
 * 30svh mobile); on short landscape phones it is flow.
 *
 * Desktop: h2 at 10svh and the two-line headline under it (≈ 13–31svh), the
 * beacon at (50vw, 52svh) with the CTA disc centred on it, the email row at
 * 74svh, the body at ≈ 81svh, the portrait bottom-left at the gutter.
 * Mobile: headline ≈ 10–24svh, beacon at 46svh, email row at 68svh, body
 * with a 56px round portrait inline before it. Short screens set the
 * headline on one line and bring the portrait inline.
 *
 * The email row never overlaps the beacon: it starts at
 * max(--email-y, disc bottom + --disc-gap, shell bottom (cy + R) + --shell-gap), so
 * nothing collides on short screens (the disc is only 1.24R across; the
 * dotted shell is 2R).
 *
 * Hooks:
 * - `[data-field-anchor="S9"]` (stage frame, --anchor-beacon-*).
 * - `a[data-beacon-cta]`: the disc. `[data-charge="S9"]` → hover / focus sets
 *   uCharge; click fires uNova (mailto opens immediately, never delayed).
 *   The sink fades it out (`[data-cta-sink]`, pointer-events none after);
 *   `[data-cta-disc]` scales in.
 * - `[data-safe]` on the header, on the email row + body (one block), and
 *   on the desktop portrait. Fade-ups move only their children, never a
 *   [data-safe] block itself (its rect is measured for the text-safe mask).
 *
 * Choreography (§5 C5): choreo/contact.ts — the h2 and headline line masks
 * (section top 60% → 15%), the disc scale-in (20% → 0%), the fade-ups (30%
 * → 0%), the ignition at F ≥ 8.98, the sink and the footer sunset. Reduced
 * motion: all of it is simply there; hover / focus still charges the
 * beacon.
 *
 * Reading order: h2, headline, the CTA disc, the email row, the body, then
 * the desktop portrait and its caption (last in the DOM; it is absolutely
 * placed bottom-left). All scrims sit at z −1 under all text, so DOM order
 * never decides which block's text a scrim can dim.
 */
export default function Contact() {
  const titleId = headingId('contact');
  /** gsap for the click's nova, from the chapter context (null under reduced motion or before it loads). */
  const gsapRef = useRef<Gsap | null>(null);

  const reveal = useCallback((ctx: ChapterContext) => {
    gsapRef.current = ctx.reduced ? null : ctx.gsap;
    const cleanup = contactChoreo(ctx);
    return () => {
      cleanup();
      gsapRef.current = null;
      settleOneShots();
    };
  }, []);

  useEffect(() => () => setCharge(CTA_CHARGE_OWNER, false), []);

  return (
    <Chapter id="contact" labelledBy={titleId} stageClassName={STAGE} reveal={reveal}>
      <div aria-hidden="true" data-field-anchor="S9" />
      <BeaconOutline />

      {/* data-fit: everything must fit the stuck stage, or the chapter falls
          back to flow (the fit guard in <Chapter>). The header clears the
          nav band (64px + its 96px scrim; 56 + 80 on mobile). */}
      <div data-fit className="grid grid-cols-1 justify-items-center pb-10 desktop:pb-[max(16px,2.5svh)] mobile:[@media(max-height:699.98px)]:pb-6">
        {/* Row 1: the header, over a floor that keeps row 2 below the disc. */}
        <div
          aria-hidden="true"
          className="col-start-1 row-start-1 h-[max(var(--email-y),calc(var(--anchor-beacon-cy)+var(--disc-d)/2+var(--disc-gap)),calc(var(--anchor-beacon-cy)+var(--anchor-beacon-r)+var(--shell-gap)))]"
        />
        <div className="col-start-1 row-start-1 w-full self-start px-gutter pt-[max(92px,11svh)] desktop:pt-[max(104px,11svh)] short:pt-[70px]">
          <div data-safe className="mx-auto w-fit max-w-full text-center">
            <ChapterHeading heading={contact.heading} id={titleId} />
            <p
              data-reveal="lines"
              data-reveal-timed
              className="t-display-l mt-3 text-ink desktop:mt-4 short:mt-2 short:text-[min(clamp(2.25rem,1.3rem+3.4vw,5rem),9svh)]"
            >
              <span className="block short:inline">{contact.headline.lead}</span>{' '}
              <span className="t-accent block short:inline">{contact.headline.accent}</span>
            </p>
          </div>
        </div>

        <BeaconCta gsapRef={gsapRef} />

        {/* Row 2: the email row, then the body (portrait inline on mobile /
            short). One scrim for both: stacked [data-safe] blocks closer
            than 48px would darken each other's text. */}
        <div className="col-start-1 row-start-2 w-full px-gutter">
          <div data-safe className="relative mx-auto w-fit max-w-full">
            <CopyEmail data-reveal="up" data-reveal-window={UP_WINDOW} />
            {/* Sketch theme: a margin note beside the email (aria-hidden). */}
            <div aria-hidden="true" className="pointer-events-none absolute -top-6 left-full ml-4 flex items-center gap-1 mobile:hidden">
              <Doodle kind="heart" className="h-10 w-10 text-ember" />
              <span className="aside-note">{sketchNotes.contact}</span>
            </div>
            <div
              data-reveal="up"
              data-reveal-window={UP_WINDOW}
              className="mx-auto mt-5 max-w-[44ch] desktop:mt-4 desktop:text-center short:text-left mobile:[@media(max-height:699.98px)]:mt-3"
            >
              <Portrait variant="inline" />
              {/* Balanced when centred (no "talk shop." widow); pretty beside the inline portrait.
                  Mobile: its own block beside the floated portrait (flow-root), so a
                  fourth line on narrow phones never wraps under the photo. */}
              <p className="t-body text-pretty text-ink-2 desktop:text-balance short:text-pretty mobile:flow-root">{contact.body}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: bottom-left at the gutter, after the text in reading order. */}
      <Portrait variant="aside" />
    </Chapter>
  );
}

/** Beacon CTA hover / keyboard focus → uCharge 1 (the director damps it over 400 ms). */
const chargeOn = (e: PointerEvent) => {
  if (e.pointerType !== 'touch') setCharge(CTA_CHARGE_OWNER, true);
};
const chargeOff = () => setCharge(CTA_CHARGE_OWNER, false);
const focusCharge = (e: FocusEvent<HTMLElement>) => {
  if (e.currentTarget.matches(':focus-visible')) setCharge(CTA_CHARGE_OWNER, true);
};

/**
 * The beacon's core is the email button (§5 C5): a real mailto link, a
 * circle 1.24R across centred on the S9 anchor, filled with the core
 * gradient. The ember bloom behind it brightens on hover / focus (the DOM
 * side of uCharge). Its only movement is the entrance (scale .6 → 1 on
 * [data-cta-disc]); the sink fades [data-cta-sink]. Hover / keyboard focus
 * charge the beacon; a click fires the nova and the mailto opens at once
 * (never prevented or delayed).
 */
function BeaconCta({ gsapRef }: { gsapRef: { readonly current: Gsap | null } }) {
  return (
    <div
      data-cta-sink
      className="pointer-events-none absolute top-(--anchor-beacon-cy) left-(--anchor-beacon-cx) isolate size-(--disc-d) -translate-x-1/2 -translate-y-1/2"
    >
      <div data-cta-disc className="relative size-full">
        <a
          href={contact.cta.href}
          aria-label={contact.cta.ariaLabel}
          data-beacon-cta
          data-charge="S9"
          data-cursor="hide"
          onPointerEnter={chargeOn}
          onPointerLeave={chargeOff}
          onFocus={focusCharge}
          onBlur={chargeOff}
          onClick={() => {
            const gsap = gsapRef.current;
            if (gsap) fireNova(gsap);
          }}
          className="peer pointer-events-auto flex size-full items-center justify-center rounded-full bg-[radial-gradient(circle,var(--color-core)_0_55%,transparent_72%)] font-sans text-base leading-none font-semibold whitespace-nowrap text-void"
        >
          <span>
            <LinkLabel cta={contact.cta} />
          </span>
        </a>
        <span
          aria-hidden="true"
          className="absolute -inset-1/2 -z-1 rounded-full bg-[radial-gradient(circle,rgb(var(--ember-rgb)/0.3),rgb(var(--ember-rgb)/0.08)_38%,transparent_62%)] opacity-50 transition-opacity duration-400 ease-ui peer-hover:opacity-100 peer-focus-visible:opacity-100"
        />
      </div>
    </div>
  );
}

/** Shared by both portraits: grayscale → colour (§5 C5). */
const PORTRAIT_FILTER =
  'brightness-[.82] grayscale transition-[filter] duration-400 ease-ui group-hover/portrait:brightness-100 group-hover/portrait:grayscale-0 group-focus-within/contact:brightness-100 group-focus-within/contact:grayscale-0';

/**
 * The portrait (§5 C5): grayscale → full colour over 400ms on hover, and
 * while anything in Contact has keyboard focus (hover effects also fire on
 * focus, §8.1). The photo is itself monochrome, so it also lifts from
 * brightness .82 → 1.
 * - `aside` (desktop): bottom-left at the gutter, bottom 8svh,
 *   min(15vw, 220px) wide (12vw below 1150px, where the centred email row
 *   would otherwise come within a few px of it), 1px line frame, caption.
 * - `inline` (mobile, and short desktop screens): a 56px round portrait
 *   floated before the body; the caption is kept for screen readers.
 * Only one is displayed at a time (the other is display:none, so it is out
 * of the accessibility tree too); both share one cached image.
 */
function Portrait({ variant }: { variant: 'aside' | 'inline' }) {
  const img = {
    src: contact.portrait.src,
    width: contact.portrait.width,
    height: contact.portrait.height,
    alt: contact.portrait.alt,
    loading: 'lazy',
    decoding: 'async',
  } as const;

  if (variant === 'aside') {
    return (
      <figure
        data-safe
        className="group/portrait sketch-tape absolute bottom-[8svh] left-gutter hidden w-[min(15vw,220px)] desktop:block max-[1150px]:w-[12vw] short:hidden"
      >
        <div data-reveal="up" data-reveal-window={UP_WINDOW} className="overflow-hidden rounded-[12px] border border-line">
          <img {...img} className={`block h-auto w-full ${PORTRAIT_FILTER}`} />
        </div>
        <figcaption data-reveal="up" data-reveal-window={UP_WINDOW} className="t-label mt-3 text-balance text-ink-2">
          {contact.portraitCaption}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="group/portrait float-left mt-1 mr-4 mb-1 size-14 desktop:hidden short:block">
      <div className="size-full overflow-hidden rounded-full border border-line">
        <img {...img} className={`block size-full origin-[47%_42%] scale-[1.7] object-cover ${PORTRAIT_FILTER}`} />
      </div>
      <figcaption className="sr-only">{contact.portraitCaption}</figcaption>
    </figure>
  );
}

/**
 * Until the field is live (this DOM-first baseline, no WebGL) the S9 box
 * shows the beacon as hairlines: the shell (a dotted circle at R) and the
 * ring (r 1.45R, tilted 18°, seen nearly edge-on). The CTA disc is the core.
 * Hidden once the field draws S9 (`field-s9:`).
 */
function BeaconOutline() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-1 -1 2 2"
      className="pointer-events-none absolute top-(--anchor-beacon-y) left-(--anchor-beacon-x) size-(--anchor-beacon-w) overflow-visible field-s9:hidden"
    >
      <ellipse
        cx="0"
        cy="0"
        rx="1.45"
        ry={1.45 * Math.sin((18 * Math.PI) / 180)}
        transform="rotate(-8)"
        fill="none"
        vectorEffect="non-scaling-stroke"
        className="stroke-ember/35"
        strokeWidth={1}
      />
      <circle
        cx="0"
        cy="0"
        r="1"
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeWidth={1.5}
        strokeDasharray="0 5"
        className="stroke-ink/45"
      />
    </svg>
  );
}
