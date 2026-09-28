import { Fragment } from 'react';
import Chapter from '../components/Chapter';
import ChapterHeading from '../components/ChapterHeading';
import { about, type RichText } from '../content/site';
import { headingId } from '../scroll/chapters';
import CareerChart, { CareerStats, CHART_STAGE_VARS } from './CareerChart';

/** Plain runs, and `strong` runs set in ink (emphasis by colour, not weight). */
function Rich({ runs }: { runs: RichText }) {
  return (
    <>
      {runs.map((run, i) =>
        typeof run === 'string' ? (
          <Fragment key={i}>{run}</Fragment>
        ) : (
          <strong key={i} className="font-normal text-ink">
            {run.strong}
          </strong>
        ),
      )}
    </>
  );
}

/**
 * C1 About — #about, sticky, L 120vh on desktop; flow on mobile (SPEC §5 C1).
 *
 * Desktop: the text column runs from the gutter to 44vw, centred in the
 * stage; the career chart (S2) sits on the right, x 54 → 92vw, baseline
 * 80svh, with the stat row under it. Mobile (§5 C1): the chart's field slot
 * first (the aria-hidden figure — slot, plot, hidden table — is ordered
 * first visually), then the text, then the stat list. DOM and reading order
 * stay heading → text → chart → stats, and only aria-hidden or visually
 * hidden content moves, so visual and focus order agree.
 *
 * The statement's size is also capped by height on desktop so the whole
 * column fits the 100svh stage on short, wide screens. The column's bottom
 * padding keeps the HUD's corner band (≥ 48px) clear.
 */
export default function About() {
  const titleId = headingId('about');
  const { statement, portrait } = about;
  const [first, ...rest] = about.paragraphs;

  return (
    <Chapter
      id="about"
      labelledBy={titleId}
      className="overflow-x-clip"
      stageClassName={`mobile:flex mobile:flex-col ${CHART_STAGE_VARS}`}
    >
      {/* data-fit: the column (and the chart's stat row) must fit the stuck
          stage, or the chapter falls back to flow (the fit guard in <Chapter>). */}
      <div data-fit className="desktop:ml-gutter desktop:flex desktop:min-h-svh desktop:w-[calc(44vw-var(--gutter))] desktop:flex-col desktop:justify-center-safe desktop:pt-[max(104px,11svh)] desktop:pb-[max(48px,6svh)] mobile:px-gutter mobile:pt-16">
        <div data-safe>
          <ChapterHeading heading={about.heading} id={titleId} />
          <p
            data-cursor="text"
            className="t-display-l mt-7 text-ink desktop:text-[length:max(2.25rem,min(clamp(2.25rem,1.3rem+3.4vw,5rem),7.4svh))]"
          >
            {statement.lead} <span className="t-accent">{statement.accent}</span>
          </p>
        </div>

        <div data-safe data-cursor="text" className="mt-12 desktop:mt-[max(2.5rem,5svh)]">
          {/* The portrait floats beside ¶1 only: flow-root keeps ¶2 clear of it. */}
          <div className="flow-root">
            <img
              src={portrait.src}
              width={portrait.width}
              height={portrait.height}
              alt={portrait.alt}
              loading="lazy"
              decoding="async"
              className="float-left mt-1.5 mr-6 mb-2 h-40 w-30 rounded-[12px] border border-line object-cover brightness-90 grayscale"
            />
            <p className="t-body text-ink-2">
              <Rich runs={first} />
            </p>
          </div>
          {rest.map((runs, i) => (
            <p key={i} className="t-body mt-5 text-ink-2">
              <Rich runs={runs} />
            </p>
          ))}
        </div>
      </div>

      <CareerChart className="mobile:order-first" />
      <CareerStats className="mobile:mx-gutter mobile:mt-14 mobile:mb-[18svh]" />
    </Chapter>
  );
}
