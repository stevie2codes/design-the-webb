import type { MouseEvent } from 'react';
import { registerHorizon } from '../chapters/choreo/horizon';
import { footer, socials } from '../content/site';
import { rewind } from '../motion/lenis';
import { headingId } from '../scroll/chapters';
import { focusQuietly, isPlainClick } from '../scroll/jump';
import LinkLabel from './LinkLabel';
import MotionToggle from './MotionToggle';

/** Footer links: `.t-label` ink with the scale-in underline; 44px targets. */
const LINK = 'link-line t-label text-ink';

/**
 * Back to top = the rewind (§4.4, §5 C6): a link to #top, so it works without
 * JS too (the native fragment jump). With JS a plain click plays the whole
 * film backward — `scrollTo(0)` over 2.4 s expo.inOut with the jump cut off
 * and a 60 ms film damp (motion/lenis.ts `rewind`); instant under reduced
 * motion — and moves focus to the top heading (the hero <h1>, else <main>) so
 * keyboard users land where the page is going (§8.2). Off home, #top does not
 * exist, so the same click just rewinds this page to its top.
 */
function backToTop(event: MouseEvent<HTMLAnchorElement>): void {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  rewind();
  focusQuietly(document.getElementById(headingId('top')) ?? document.getElementById('main'));
}

/**
 * C6 Footer (SPEC §5 C6): solid `deep` with a 1px line on top. That edge is
 * the horizon the beacon sets behind; the opaque footer hides the canvas
 * below it. Flow, 40svh tall on desktop; content height on mobile.
 *
 * Desktop: © on the left, GitHub / LinkedIn centred (above where the beacon
 * sets), Back to top and the Motion toggle on the right. Mobile: links first,
 * the © line last. The outline wordmark closes the page, cropped by its
 * bottom edge.
 *
 * The sunset (§1 "Credits", §5 C5 sink): as the beacon sets behind this
 * edge, the horizon warms — an ember line and a faint light spill centred
 * where the beacon goes down, their opacity written by Contact's sink
 * trigger (choreo/horizon.ts; 0 at rest, under reduced motion and without
 * JS). The © label (ink-3) sits clear of the spill, so it stays on solid
 * `deep` (§2.3 rule 1).
 *
 * Hooks: `a[data-back-to-top]` (the rewind).
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-2 flex flex-col overflow-hidden border-t border-line bg-deep desktop:min-h-[40svh]">
      <div ref={registerHorizon} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-0">
        <span className="absolute inset-x-[20%] top-0 h-px bg-linear-to-r from-transparent via-ember/80 to-transparent" />
        <span className="absolute inset-0 bg-[radial-gradient(34%_100%_at_50%_0%,rgb(255_106_61/0.1),transparent_100%)]" />
      </div>
      <div className="grid gap-y-5 px-gutter pt-8 desktop:grid-cols-[1fr_auto_1fr] desktop:items-center desktop:gap-x-10 desktop:pt-[max(40px,5svh)]">
        {/* The prerender bakes in the build year; the client may differ at New Year. */}
        <p suppressHydrationWarning className="t-label order-last pt-3 text-ink-3 desktop:order-none desktop:pt-0">
          {footer.copyright(year)}
        </p>

        <ul className="flex flex-wrap gap-x-8 desktop:justify-center">
          {socials.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                <LinkLabel cta={link} />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-8 desktop:justify-end">
          <a href="#top" onClick={backToTop} data-back-to-top className={LINK}>
            <LinkLabel cta={footer.backToTop} />
          </a>
          {/* The toggle needs JS (it flips html.rm and persists the choice). */}
          <MotionToggle className="nojs:hidden" />
        </div>
      </div>

      <Wordmark />
    </footer>
  );
}

// ─── Wordmark ────────────────────────────────────────────────────────────────
// STEPHEN WEBB in the name's face (Archivo 800, stretch 75%, uppercase) as a
// 1px outline at rgb(242 238 230 / .12) on a transparent fill, fitted to 94vw
// and cropped 30% by the page bottom (§5 C6). Drawn as SVG text so the fit
// (textLength) and the crop (viewBox, measured from the baseline) are exact
// whatever the font metrics: at font-size 100 the line is 651.8 wide
// (6.518em) and the caps are 69 tall (0.69em); the viewBox stops 30% of the
// cap height above the baseline, at the footer's bottom edge.

const WM_FS = 100;
const WM_W = 651.8;
const WM_CAP = 69;
/** Room for the stroke at the top and sides, in viewBox units. */
const WM_PAD = 2;
const WM_VIEWBOX = `${-WM_PAD} ${-WM_CAP - WM_PAD} ${WM_W + 2 * WM_PAD} ${WM_CAP * 0.7 + WM_PAD}`;

function Wordmark() {
  return (
    <div aria-hidden="true" className="pointer-events-none mt-auto pt-16 select-none desktop:pt-12">
      <svg viewBox={WM_VIEWBOX} focusable="false" className="mx-auto block h-auto w-[94vw]">
        <text
          x="0"
          y="0"
          fontSize={WM_FS}
          textLength={WM_W}
          lengthAdjust="spacingAndGlyphs"
          fill="none"
          stroke="rgb(242 238 230 / 0.12)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className="font-sans font-extrabold [font-stretch:75%]"
        >
          {footer.wordmark.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
