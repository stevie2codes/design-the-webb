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

/** The card box itself, for decoration placed in the panel (outlines, readouts). */
const AT_CARD_BOX = 'absolute top-(--panel-card-y) left-(--panel-card-x) h-(--panel-card-h) w-(--panel-card-w)';

/** Links: an inline row on desktop; full-width 48px rows between hairlines on mobile. */
const LINK =
  'link-line t-label w-full min-h-12 justify-between gap-2 text-ink desktop:w-auto desktop:min-h-11 desktop:justify-start';

/**
 * One project window in C3 (SPEC §5 C3): P/0n index, h4 title linking to
 * /work/:slug, description, tag chips, links, and the screenshot card on
 * `project.side` (MCP App: emblem only, "Screenshot coming soon").
 *
 * Desktop: ≥ 100svh (flow) or one absolute 100svh window of the sticky stage
 * (`staged:`); the text column vertically centred on one side, the card
 * absolutely placed at the S4–S7 card box on the other.
 * Mobile (§5 C3 "Mobile"): field slot (the emblem) → text → full-width
 * inline card → full-width link rows. No curtain.
 *
 * Hooks (chapters/projects/stage.ts drives them):
 * - `[data-panel]` (1–4), `[data-active]`; a `[data-fit]` probe closing the
 *   text column (the stage falls back to flow when a column cannot fit
 *   100svh; the probe only has height in the stuck layout);
 * - `[data-field-anchor]` (desktop box in the panel, mobile box in the slot);
 * - reveals: `[data-p-index]`, `[data-p-title]` (line masks: the title's
 *   Link is split itself, so SplitText labels the <a> and never hides a
 *   focusable element), `[data-p-up]` (fade-ups);
 * - exits: `[data-p-exit]` (the two `[data-safe]` text blocks);
 * - the card: `[data-card-link]` (scale) > `[data-card-glow]` (the ember
 *   shadow, faded) + `[data-card-clip]` (the curtain's clip-path; the link
 *   itself is never clipped, so its focus ring always shows);
 * - `[data-mcp-caption]`, `[data-rows-counter]` (+ `[data-rows-stage]`);
 * - `[data-charge]` on the title (hover / focus → uCharge .5 on the emblem),
 *   `a[data-detail-link]` on every /work link (the §6 route transition).
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
      className="relative pb-24 desktop:flex desktop:min-h-svh desktop:items-center-safe desktop:py-[max(128px,16svh)] staged:absolute staged:inset-0 staged:pointer-events-none staged:opacity-0 staged:transition-opacity staged:duration-300 staged:ease-ui staged:data-active:pointer-events-auto staged:data-active:opacity-100"
    >
      {/* Mobile: the emblem's slot opens the block (§4.2). Hidden on desktop. */}
      <div className="field-slot" data-slot="project" aria-hidden="true">
        <div data-field-anchor={anchor} />
        <EmblemOutline emblem={emblem} className={`${AT_CARD_BOX} scale-90`} />
        {isLattice && <RowsCounter className="absolute bottom-1 left-gutter hidden live:field-s5:block" />}
      </div>

      {/* Desktop emblem box = card box (§3.10). Until the field draws the
          emblem, its outline holds the box: the silhouette hold never shows
          a hole (the open card covers it). MCP App's sits in its window. */}
      <div aria-hidden="true" data-field-anchor={anchor} className="mobile:hidden" />
      {screenshot && <EmblemOutline emblem={emblem} className={`${AT_CARD_BOX} scale-90 mobile:hidden`} />}
      {isLattice && (
        // Under the emblem during the silhouette hold (stage mode, live field only).
        <RowsCounter
          stage
          className="absolute top-[calc(var(--panel-card-y)+var(--panel-card-h)+16px)] left-(--panel-card-x) hidden staged:field-s5:block"
        />
      )}

      <div
        className={`px-gutter desktop:w-[calc(38vw-var(--gutter))] desktop:shrink-0 desktop:px-0 ${TEXT_COLUMN[project.side]}`}
      >
        <div data-safe data-p-exit>
          <p aria-hidden="true" data-p-index className="t-label text-ember">
            {project.indexLabel}
          </p>
          <h4 id={titleId} className="t-title mt-5 text-balance text-ink desktop:mt-6">
            {/* inline-block: the line mask splits this Link itself. ::before
                pads the hit area to ≥ 44px without moving the type (36px ×
                0.92 on phones). */}
            <Link
              to={href}
              data-p-title
              data-detail-link
              data-cursor="open"
              data-charge={anchor}
              className="relative inline-block max-w-full transition-colors duration-240 ease-ui before:absolute before:inset-x-0 before:-inset-y-1.5 hover:text-ember-hot focus-visible:text-ember-hot"
            >
              {title}
            </Link>
          </h4>
          <p data-p-up className="t-lede mt-6 max-w-[40ch] text-ink-2 desktop:mt-8">
            {project.description}
          </p>
          <ul data-p-up className="mt-8 flex flex-wrap gap-2">
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
          data-p-exit
          className="mt-10 flex flex-col border-t border-line desktop:mt-9 desktop:flex-row desktop:flex-wrap desktop:gap-x-8 desktop:border-t-0"
        >
          <li data-p-up className="border-b border-line desktop:border-b-0">
            <Link to={href} data-detail-link aria-label={sideProjects.aria.details(title)} className={LINK}>
              <LinkLabel cta={sideProjects.links.details} />
            </Link>
          </li>
          {project.liveUrl && (
            <li data-p-up className="border-b border-line desktop:border-b-0">
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
          <li data-p-up className="border-b border-line desktop:border-b-0">
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
        {/* The fit guard's probe (<Chapter>): the column's bottom, but only in
            the stuck layout. Flow (reduced motion, mobile) stacks the panels
            past 100svh by design; there the probe has no height, so the guard
            ignores it, and it grows (a ResizeObserver hit) when the stage
            applies again, e.g. after the Motion toggle. */}
        <span aria-hidden="true" data-fit className="block h-0 staged:h-px" />
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
 *
 * The curtain (§5 C3) clips the inner frame, never the link: a clip-path
 * would cut the link's focus ring and the ember glow. The glow is its own
 * layer under the frame, so the curtain can fade it. z-1 keeps the card
 * above neighbouring [data-safe] scrims.
 */
function ScreenshotCard({ href, title, shot }: ScreenshotCardProps) {
  return (
    <Link
      to={href}
      aria-label={sideProjects.aria.card(title)}
      data-card
      data-card-link
      data-detail-link
      data-cursor="open"
      className={`group relative z-1 mt-10 block rounded-media desktop:h-(--panel-card-h) ${CARD_BOX}`}
    >
      <span
        aria-hidden="true"
        data-card-glow
        className="pointer-events-none absolute inset-0 rounded-media shadow-[0_0_80px_rgb(255_106_61/0.12)] transition-shadow duration-240 ease-ui group-hover:shadow-[0_0_96px_rgb(255_106_61/0.2)] group-focus-visible:shadow-[0_0_96px_rgb(255_106_61/0.2)]"
      />
      <span
        data-card-clip
        className="relative block aspect-[1200/953] w-full overflow-hidden rounded-media border border-line bg-surface transition-colors duration-240 ease-ui group-hover:border-line-strong group-focus-visible:border-line-strong desktop:h-full"
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
      </span>
    </Link>
  );
}

/**
 * MCP App has no screenshot (§5 C3): the constellation owns the card box and
 * a caption sits under it (the stage fades it in with the ×1.15 grow).
 * Desktop: until the field draws S7 (no JS, no WebGL, S7 not generated) an
 * aria-hidden hairline window holds the box with the constellation outline
 * in it; with S7 drawn it keeps its space (invisible). Mobile: the emblem is
 * in the slot above, so only the caption.
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
      <p data-safe data-mcp-caption className="t-label mt-4 text-ink-2 mobile:mt-0">
        {sideProjects.screenshotSoon}
      </p>
    </div>
  );
}

/**
 * aria-hidden "ROWS 00/52" readout (§3.10 S5 DOM sync); the choreography
 * writes it at 30 Hz from the lattice write-head. `stage`: the desktop one
 * under the emblem, faded by the stage timeline.
 */
function RowsCounter({ className, stage = false }: { className: string; stage?: boolean }) {
  return (
    <p aria-hidden="true" data-rows-counter data-rows-stage={stage || undefined} className={`t-micro text-ink-2 ${className}`}>
      {sideProjects.rowsCounter(0)}
    </p>
  );
}
