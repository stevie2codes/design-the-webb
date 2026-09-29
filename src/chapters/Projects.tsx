import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import Chapter from '../components/Chapter';
import { PROJECT_COUNT, projects } from '../content/projects';
import { sideProjects } from '../content/site';
import { headingId } from '../scroll/chapters';
import type { ChapterContext } from '../scroll/useChapter';
import ProjectPanel from './ProjectPanel';
import { captureArrival, runArrival } from './projects/route';
import { projectsChoreo } from './projects/stage';

/**
 * How the four panels are laid out on the desktop layout.
 *
 * - 'stage' (§5 C3): the chapter is sticky (L = 250vh, four 62.5vh windows)
 *   and, wherever its stage is actually stuck — the `staged:` variant (JS,
 *   full motion, desktop, no fit-guard fallback) — the panels are absolute
 *   windows stacked in the 100svh stage, only `[data-active]` showing, run
 *   by chapters/projects/stage.ts. No-JS, reduced motion, the mobile layout
 *   and `[data-overflow]` keep flow (§8.2: "the Work stage becomes 4 flow
 *   panels").
 * - 'flow' (the DOM-first baseline): the chapter is not sticky and the
 *   panels stack as ~100svh flow blocks, text column beside the card.
 *
 * Every card box and field anchor is panel-relative, and a staged panel is
 * `inset: 0` of the stage, so their positions are identical in both modes.
 */
type PanelMode = 'flow' | 'stage';

const PANEL_MODE = 'stage' as PanelMode;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * C3 Side projects — #projects (SPEC §5 C3).
 *
 * Stage chrome: the "Side projects" h3 (labels the section) top-left and the
 * aria-hidden "01 / 04" counter top-right, whose digit rolls vertically
 * (400 ms) when the window changes (`[data-counter-roll]`). The counter only
 * shows in stage mode (in flow every panel carries its own P/0n index).
 *
 * Also the home route's arrival point (§6 "Page transitions"): every home
 * mount renders C3, so a return from a detail page (restore + jump-cut
 * resync) or a forward link to "/" (fade in at y 0) is run from here, in a
 * layout effect, before the first paint (chapters/projects/route.ts).
 */
export default function Projects() {
  const titleId = headingId('projects');
  const staged = PANEL_MODE === 'stage';

  const navigate = useNavigate();
  const navType = useNavigationType();
  const { hash } = useLocation();
  const navRef = useRef(navigate);
  useLayoutEffect(() => {
    navRef.current = navigate;
  });

  // Which arrival this mount is: read once, during the first render, before
  // HomePage's enterRoute('home') runs (null on the server, on first load and
  // on layout remounts).
  const [arrival] = useState(() => (typeof window === 'undefined' ? null : captureArrival(navType, hash)));
  useLayoutEffect(() => (arrival ? runArrival(arrival) : undefined), [arrival]);

  const reveal = (ctx: ChapterContext) => projectsChoreo(ctx, { navigate: (to) => navRef.current(to) });

  return (
    <Chapter id="projects" labelledBy={titleId} sticky={staged} reveal={reveal}>
      <div className="px-gutter pt-10 desktop:pointer-events-none desktop:absolute desktop:inset-x-0 desktop:top-[max(104px,11svh)] desktop:z-1 desktop:flex desktop:items-baseline desktop:justify-between desktop:pt-0">
        <h3 id={titleId} tabIndex={-1} data-safe className="t-label text-ink-2">
          {sideProjects.label}
        </h3>
        <p
          aria-hidden="true"
          data-projects-counter
          className="t-micro hidden items-start leading-[1.3] text-ink-2 staged:inline-flex"
        >
          <span>0</span>
          <span className="inline-block h-[1.3em] overflow-hidden">
            <span data-counter-roll className="block transition-transform duration-400 ease-ui">
              {projects.map((p) => (
                <span key={p.slug} className="block h-[1.3em]">
                  {p.index}
                </span>
              ))}
            </span>
          </span>
          <span className="whitespace-pre"> / {pad2(PROJECT_COUNT)}</span>
        </p>
      </div>

      <div data-panel-mode={PANEL_MODE} className="staged:absolute staged:inset-0">
        {projects.map((project, i) => (
          <ProjectPanel key={project.slug} project={project} active={i === 0} />
        ))}
      </div>
    </Chapter>
  );
}
