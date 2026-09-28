import Chapter from '../components/Chapter';
import { PROJECT_COUNT, projects } from '../content/projects';
import { sideProjects } from '../content/site';
import { headingId } from '../scroll/chapters';
import ProjectPanel from './ProjectPanel';

/**
 * How the four panels are laid out on the desktop layout.
 *
 * - 'flow' (the DOM-first baseline, now): the chapter is not sticky and the
 *   panels stack as ~100svh flow blocks, text column beside the card, so all
 *   four read without any scroll choreography.
 * - 'stage' (the choreography phase): the chapter is sticky (L = 250vh, four
 *   62.5vh windows) and, wherever its stage is actually stuck — the
 *   `staged:` variant (JS, full motion, desktop) — the panels become
 *   absolute windows stacked in the 100svh stage, only `[data-active]`
 *   showing. No-JS, reduced motion and the mobile layout keep flow
 *   (§8.2: "the Work stage becomes 4 flow panels").
 *
 * Both modes are styled; switching is this one value. Every card box and
 * field anchor is panel-relative, and a staged panel is `inset: 0` of the
 * stage, so their positions are identical in both modes.
 */
type PanelMode = 'flow' | 'stage';

const PANEL_MODE = 'flow' as PanelMode;

/**
 * C3 Side projects — #projects (SPEC §5 C3).
 *
 * Stage chrome: the "Side projects" h3 (labels the section) top-left and the
 * aria-hidden "01 / 04" counter top-right. The counter only shows in stage
 * mode (in flow every panel carries its own P/0n index); the choreography
 * rolls its digits through `[data-projects-counter]`.
 */
export default function Projects() {
  const titleId = headingId('projects');
  const staged = PANEL_MODE === 'stage';

  return (
    <Chapter id="projects" labelledBy={titleId} sticky={staged}>
      <div className="px-gutter pt-10 desktop:pointer-events-none desktop:absolute desktop:inset-x-0 desktop:top-[max(104px,11svh)] desktop:z-1 desktop:flex desktop:items-baseline desktop:justify-between desktop:pt-0">
        <h3 id={titleId} tabIndex={-1} data-safe className="t-label text-ink-2">
          {sideProjects.label}
        </h3>
        <p aria-hidden="true" data-projects-counter className="t-micro hidden text-ink-2 staged:block">
          {sideProjects.counter(1, PROJECT_COUNT)}
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
