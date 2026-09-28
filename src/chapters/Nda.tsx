import { Lock } from 'lucide-react';
import Chapter from '../components/Chapter';
import ChapterHeading from '../components/ChapterHeading';
import LinkLabel from '../components/LinkLabel';
import { nda } from '../content/site';
import { headingId } from '../scroll/chapters';

/**
 * C2 NDA — #work (SPEC §5 C2). A flow chapter: min 90svh on desktop with
 * the text block vertically centred on the left and the S3 REDACTED box on
 * the right (54 → 92vw, 42.5svh tall, centred in the section). On mobile
 * the S3 field slot (44svh) opens the chapter and the text follows it.
 *
 * Hooks for later phases:
 * - `[data-field-anchor="S3"]`: the desktop box sits in the stage (which
 *   starts at the section top, the anchor's frame); the mobile box lives in
 *   the `.field-slot`. Each is display:none in the other layout.
 * - `[data-safe]` on the text block (scrim + text-safe mask, §2.3).
 * - `[data-charge="S3"]` on the email link: hover / focus sets `uCharge`
 *   on S3 (the scan speeds up; it is a peek that reveals nothing).
 */
export default function Nda() {
  const titleId = headingId('work');

  return (
    <Chapter
      id="work"
      labelledBy={titleId}
      stageClassName="pb-24 desktop:flex desktop:min-h-(--chapter-flow-h) desktop:items-center desktop:py-24"
    >
      {/* Mobile: the redaction slot opens the chapter (§4.2). Hidden on desktop. */}
      <div className="field-slot" data-slot="work" aria-hidden="true">
        <div data-field-anchor="S3" />
        <RedactedOutline />
      </div>

      <div className="px-gutter mobile:pt-2">
        <div data-safe className="desktop:w-[min(40vw,34rem)]">
          <ChapterHeading heading={nda.heading} id={titleId} />

          <p className="t-label mt-14 flex items-center gap-2.5 text-ember desktop:mt-16">
            <Lock aria-hidden="true" size={14} strokeWidth={1.5} className="shrink-0" />
            {nda.badge}
          </p>

          <h3 className="t-display-m mt-5 text-balance text-ink">{nda.title}</h3>

          <p className="t-body mt-6 text-ink-2">{nda.body}</p>

          <a href={nda.cta.href} data-charge="S3" className="btn btn-line mt-10">
            <LinkLabel cta={nda.cta} />
          </a>
        </div>
      </div>

      {/* Desktop S3 box, positioned from --anchor-redacted-* (section frame). */}
      <div aria-hidden="true" data-field-anchor="S3" className="mobile:hidden" />
      <RedactedOutline className="mobile:hidden" />
    </Chapter>
  );
}

// ─── No-field placeholder ────────────────────────────────────────────────────
// Until the field is live (no JS, no WebGL, this DOM-first baseline) the S3
// box shows the redaction as nine dotted, left-aligned slabs (§3.10 S3):
// widths [.92 … .66] of the block, .05 su tall with .045 su gaps (so the
// whole block is .85 su = the 42.5svh box), slab 2 .09 su tall with the lock
// cut out of it at 26% of its width, and the ember keyline .03 su to the
// left. Heights are fractions of the box, so the mobile ×.7 box scales too.

const SLAB_W = [0.92, 0.78, 0.96, 0.54, 0.88, 0.71, 0.93, 0.4, 0.66] as const;
const SLAB_H = 0.05;
const LOCK_SLAB_H = 0.09;
const SLAB_GAP = 0.045;
const BLOCK_H = SLAB_W.length * SLAB_GAP - SLAB_GAP + (SLAB_W.length - 1) * SLAB_H + LOCK_SLAB_H;
const pct = (su: number): string => `${+((su / BLOCK_H) * 100).toFixed(3)}%`;
const SLABS = SLAB_W.map((w, i) => {
  const top = i * (SLAB_H + SLAB_GAP) + (i > 1 ? LOCK_SLAB_H - SLAB_H : 0);
  return { w, top: pct(top), h: pct(i === 1 ? LOCK_SLAB_H : SLAB_H), lock: i === 1 };
});

function RedactedOutline({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-(--anchor-redacted-y) left-(--anchor-redacted-x) h-(--anchor-redacted-h) w-(--anchor-redacted-w) field-live:hidden ${className}`}
    >
      <span className="absolute inset-y-0 -left-[calc(var(--anchor-redacted-h)*0.0353)] w-px bg-ember/60" />
      {SLABS.map(({ w, top, h, lock }) => (
        <span
          key={top}
          style={{ top, height: h, width: `${w * 100}%` }}
          className="absolute left-0 bg-[radial-gradient(circle,rgb(242_238_230/0.42)_0.9px,transparent_1.3px)] bg-size-[4px_4px] shadow-[inset_0_0_0_1px_rgb(242_238_230/0.14)]"
        >
          {lock && <LockCut />}
        </span>
      ))}
    </div>
  );
}

/** The lock's negative space (body .042 × .036 su, shackle r .016/.010 su), in su. */
function LockCut() {
  return (
    <svg
      viewBox="0 0 0.09 0.09"
      focusable="false"
      className="absolute top-0 left-[26%] h-full w-auto -translate-x-1/2 overflow-visible"
    >
      <path
        d="M.029,.035 V.035 A.016,.016 0 0 1 .061,.035 H.055 A.010,.010 0 0 0 .035,.035 Z"
        className="fill-void"
      />
      <rect x=".024" y=".035" width=".042" height=".036" rx=".003" className="fill-void stroke-ember" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path
        d="M.029,.035 A.016,.016 0 0 1 .061,.035 M.035,.035 A.010,.010 0 0 1 .055,.035"
        fill="none"
        className="stroke-ember"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
