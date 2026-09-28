import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import Chip from '../components/Chip';
import EmblemOutline from '../components/EmblemOutline';
import LinkLabel from '../components/LinkLabel';
import type { Project, Screenshot } from '../content/projects';
import { sideProjects } from '../content/site';
import { anchorVar } from '../field/layout';
import { StateId, stateKey } from '../field/states/ids';

export interface ProjectPanelProps {
  project: Project;
  /**
   * Stage mode only: the window on screen. Inactive staged panels are
   * opacity 0 with no pointer events, but stay in the DOM and the tab order
   * (§5 C3). The choreography toggles `data-active` directly; flow ignores it.
   */
  active?: boolean;
}

/**
 * Desktop text column: gutter → 38vw when the card is on the right, 62vw →
 * (100vw − gutter) when it is on the left (§5 C3: 4–38vw / 62–96vw, aligned
 * to the real gutter so it lines up with the chapter chrome).
 */
const TEXT_COLUMN: Record<Project['side'], string> = {
  right: 'desktop:ml-gutter',
  left: 'desktop:ml-[62vw]',
};

/** Desktop card box: the emblem's anchor box (layout.ts), so card and silhouette register exactly. */
const CARD_BOX =
  'desktop:absolute desktop:left-(--panel-card-x) desktop:top-(--panel-card-y) desktop:mt-0 desktop:w-(--panel-card-w)';


/** Links: an inline row on desktop; full-width 48px rows between hairlines on mobile. */
const LINK =
  'link-line t-label w-full min-h-12 justify-between gap-2 text-ink desktop:w-auto desktop:min-h-11 desktop:justify-start';

/**
 * One project window in C3 (SPEC §5 C3): P/0n index, h4 title linking to
 * /work/:slug, description, tag chips, links, and the screenshot card on
 * `project.side` (MCP App: emblem only, "Screenshot coming soon").
 *
 * Desktop: ≥ 100svh; text column vertically centred on one side, card
 * absolutely placed at the S4–S7 card box on the other.
 * Mobile (§5 C3 "Mobile"): field slot (the emblem) → text → full-width
 * inline card → full-width link rows. No curtain.
 *
 * Hooks: `[data-panel]` (1–4), `[data-active]`, `[data-field-anchor]`
 * (desktop box in the panel, mobile box in the slot), `[data-safe]` text
 * blocks, `[data-card]` (the curtain clips it), `[data-cursor]`,
 * `[data-charge]` on the title (hover → uCharge .5 on the emblem) and
 * `[data-rows-counter]` (Gov Data Generator write-head readout).
 */
export default function ProjectPanel({ project, active = false }: ProjectPanelProps) {
  const { slug, title, emblem, screenshot } = project;
  const href = `/work/${slug}`;
  const anchor = stateKey(emblem);
  const titleId = `project-${slug}-title`;
  const isLattice = emblem === StateId.LATTICE;

  // Panel-scoped aliases of this emblem's anchor box (desktop classes only).
  const cardVars = {
    '--panel-card-x': `var(${anchorVar(emblem, 'x')})`,
    '--panel-card-y': `var(${anchorVar(emblem, 'y')})`,
    '--panel-card-w': `var(${anchorVar(emblem, 'w')})`,
    '--panel-card-h': `var(${anchorVar(emblem, 'h')})`,
  } as CSSProperties;

  return (
    <article
      aria-labelledby={titleId}
      data-panel={project.index}
      data-active={active || undefined}
      style={cardVars}
      className="relative pb-24 desktop:flex desktop:min-h-svh desktop:items-center-safe desktop:py-[max(128px,16svh)] staged:absolute staged:inset-0 staged:pointer-events-none staged:opacity-0 staged:data-active:pointer-events-auto staged:data-active:opacity-100"
    >
      {/* Mobile: the emblem's slot opens the block (§4.2). Hidden on desktop. */}
      <div className="field-slot" data-slot="project" aria-hidden="true">
        <div data-field-anchor={anchor} />
        <EmblemOutline
          emblem={emblem}
          className="absolute top-(--panel-card-y) left-(--panel-card-x) h-(--panel-card-h) w-(--panel-card-w) scale-90"
        />
        {isLattice && (
          <RowsCounter className="absolute bottom-1 left-gutter hidden live:field-s5:block" />
        )}
      </div>

      {/* Desktop emblem box = card box (§3.10). */}
      <div aria-hidden="true" data-field-anchor={anchor} className="mobile:hidden" />
      {isLattice && (
        // Under the emblem during the silhouette hold (stage mode, live field only).
        <RowsCounter className="absolute top-[calc(var(--panel-card-y)+var(--panel-card-h)+16px)] left-(--panel-card-x) hidden staged:field-s5:block" />
      )}

      <div className={`px-gutter desktop:w-[calc(38vw-var(--gutter))] desktop:shrink-0 desktop:px-0 ${TEXT_COLUMN[project.side]}`}>
        <div data-safe>
          <p aria-hidden="true" className="t-label text-ember">
            {project.indexLabel}
          </p>
          <h4 id={titleId} className="t-title mt-5 text-balance text-ink desktop:mt-6">
            {/* ::before pads the hit area to ≥ 44px without moving the type (36px × 0.92 on phones). */}
            <Link
              to={href}
              data-cursor="open"
              data-charge={anchor}
              className="relative transition-colors duration-240 ease-ui before:absolute before:inset-x-0 before:-inset-y-1.5 hover:text-ember-hot focus-visible:text-ember-hot"
            >
              {title}
            </Link>
          </h4>
          <p className="t-lede mt-6 max-w-[40ch] text-ink-2 desktop:mt-8">{project.description}</p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <Chip key={tag} as="li">
                {tag}
              </Chip>
            ))}
          </ul>
        </div>

        {screenshot ? (
          <ScreenshotCard href={href} title={title} shot={screenshot} />
        ) : (
          <EmblemOnly emblem={emblem} />
        )}

        <ul
          data-safe
          className="mt-10 flex flex-col border-t border-line desktop:mt-9 desktop:flex-row desktop:flex-wrap desktop:gap-x-8 desktop:border-t-0"
        >
          <li className="border-b border-line desktop:border-b-0">
            <Link to={href} aria-label={sideProjects.aria.details(title)} className={LINK}>
              <LinkLabel cta={sideProjects.links.details} />
            </Link>
          </li>
          {project.liveUrl && (
            <li className="border-b border-line desktop:border-b-0">
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={sideProjects.aria.live(title)}
                data-cursor="live"
                className={LINK}
              >
                <LinkLabel cta={sideProjects.links.live} />
              </a>
            </li>
          )}
          <li className="border-b border-line desktop:border-b-0">
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={sideProjects.aria.github(title)}
              className={LINK}
            >
              <LinkLabel cta={sideProjects.links.github} />
            </a>
          </li>
        </ul>
      </div>
    </article>
  );
}

interface ScreenshotCardProps {
  href: string;
  title: string;
  shot: Screenshot;
}

/**
 * The screenshot card: a real, focusable link to the detail page named
 * "Open {title} project details". Desktop: exactly the card box
 * (min(44vw, 88.1svh) at 1200:953). Mobile: full width, inline.
 * z-1 keeps it above neighbouring [data-safe] scrims.
 */
function ScreenshotCard({ href, title, shot }: ScreenshotCardProps) {
  return (
    <Link
      to={href}
      aria-label={sideProjects.aria.card(title)}
      data-card
      data-cursor="open"
      className={`relative z-1 mt-10 block aspect-[1200/953] w-full overflow-hidden rounded-media border border-line bg-surface shadow-[0_0_80px_rgb(255_106_61/0.12)] transition-[border-color,box-shadow] duration-240 ease-ui hover:border-line-strong hover:shadow-[0_0_96px_rgb(255_106_61/0.2)] focus-visible:border-line-strong focus-visible:shadow-[0_0_96px_rgb(255_106_61/0.2)] desktop:h-(--panel-card-h) ${CARD_BOX}`}
    >
      <img
        src={shot.src}
        width={shot.width}
        height={shot.height}
        loading="lazy"
        decoding="async"
        alt={sideProjects.imgAlt(title)}
        className="block size-full object-cover"
      />
    </Link>
  );
}

/**
 * MCP App has no screenshot (§5 C3): the constellation owns the card box and
 * a caption sits under it. Desktop: until the field is live (no JS, no
 * WebGL, this baseline) an aria-hidden hairline window holds the box with
 * the constellation poster in it; with the live field it keeps its space
 * (invisible). Mobile: the emblem is in the slot above, so only the caption.
 */
function EmblemOnly({ emblem }: { emblem: Project['emblem'] }) {
  return (
    <div data-card className={`relative z-1 mt-10 mobile:mt-8 ${CARD_BOX}`}>
      <div
        aria-hidden="true"
        className="relative w-full rounded-media border border-line field-s7:invisible mobile:hidden desktop:h-(--panel-card-h)"
      >
        <EmblemOutline emblem={emblem} className="absolute inset-0 size-full scale-90" />
      </div>
      <p data-safe className="t-label mt-4 text-ink-2 mobile:mt-0">
        {sideProjects.screenshotSoon}
      </p>
    </div>
  );
}

/** aria-hidden "ROWS 00/52" readout; the engine writes it through `[data-rows-counter]` at 30 Hz. */
function RowsCounter({ className }: { className: string }) {
  return (
    <p aria-hidden="true" data-rows-counter className={`t-micro text-ink-2 ${className}`}>
      {sideProjects.rowsCounter(0)}
    </p>
  );
}
