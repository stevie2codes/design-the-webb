import { useEffect, useRef } from 'react';
import { Link, useNavigationType, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Chip from '../components/Chip';
import EmblemOutline from '../components/EmblemOutline';
import LinkLabel from '../components/LinkLabel';
import { getNextProject, getProject, type Project } from '../content/projects';
import { detail } from '../content/site';
import { StateId } from '../field/states/ids';
import { enterRoute } from '../scroll/director';
import { store } from '../scroll/store';

const TITLE_ID = 'project-title';

/**
 * /work/:slug (SPEC §6 "Project detail"), code-split.
 *
 * Field (later phase): route mode with the pair locked to the project's
 * emblem, anchored at (74vw, 40vh) × .8 on desktop and (50vw, 22svh) × .7 on
 * mobile — the desktop copy keeps to the left 46vw and the mobile copy starts
 * below a project field slot, so text and emblem never overlap. Hooks:
 * [data-emblem] on the article, [data-detail-figure] for the clip-path reveal,
 * [data-detail-stage] for the MCP App re-stage, [data-next-emblem] for the
 * Next project peek.
 */
export default function ProjectDetailPage() {
  const { slug } = useParams();
  const project = getProject(slug);

  useEffect(() => {
    document.title = detail.documentTitle(project ? project.title : detail.notFound.title);
  }, [project]);

  // Route mode (§9.4): the pair is locked to this project's emblem (and the
  // next one, for the peek); an unknown slug sits over S0.
  useEffect(() => {
    if (!slug || !project) {
      enterRoute(store, 'detail', slug ?? '', { a: StateId.STATIC });
      return;
    }
    enterRoute(store, 'detail', slug, { a: project.emblem, b: getNextProject(slug).emblem });
  }, [slug, project]);

  if (!project) return <ProjectNotFound />;
  // Keyed: "Next project" mounts a fresh page (focus, scroll-driven hooks).
  return <ProjectDetail key={project.slug} project={project} />;
}

function ProjectDetail({ project }: { project: Project }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navType = useNavigationType();
  const next = getNextProject(project.slug);

  // In-app navigation lands focus on the title (tabIndex -1), so keyboard and
  // screen reader users start at the top of the new page. Not on POP (first
  // load, back/forward).
  useEffect(() => {
    if (navType !== 'POP') titleRef.current?.focus({ preventScroll: true });
  }, [navType]);

  return (
    <>
      <article
        aria-labelledby={TITLE_ID}
        data-project={project.slug}
        data-emblem={project.emblem}
        className="overflow-x-clip"
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="relative px-gutter pt-[calc(4rem+10svh)] pb-[12svh] mobile:pt-0 mobile:pb-24 desktop:min-h-svh">
          {/* The emblem (route mode, §6): centred at (74vw, 40svh) × .8 of the
              card box on desktop, (50vw, 22svh) × .7 in the slot on mobile.
              Hairline poster until the field draws the emblem. */}
          <div aria-hidden="true" className="field-slot" data-slot="project">
            <EmblemOutline emblem={project.emblem} className="absolute inset-[15%] size-[70%]" />
          </div>
          <EmblemOutline
            emblem={project.emblem}
            className="absolute top-[40svh] left-[74vw] h-[calc(var(--card-h)*0.8)] w-[calc(var(--card-w)*0.8)] -translate-1/2 mobile:hidden"
          />
          <div data-safe className="desktop:max-w-[46vw]">
            <Link
              to={detail.back.href}
              className="link-line t-label gap-[0.6em] text-ink-2 hover:text-ink focus-visible:text-ink"
            >
              <LinkLabel cta={detail.back} />
            </Link>

            <p className="t-label mt-[8svh] text-ember mobile:mt-10">{project.indexLabel}</p>
            <h1
              ref={titleRef}
              id={TITLE_ID}
              tabIndex={-1}
              className="t-display-xl mt-4 text-balance text-ink"
            >
              {project.title}
            </h1>
            <p className="t-lede mt-8 max-w-[36ch] text-ink-2">{project.description}</p>

            <ul className="mt-8 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <Chip key={tag} as="li">
                  {tag}
                </Chip>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3 mobile:flex-col">
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor="live"
                  className="btn btn-ember mobile:w-full"
                >
                  <LinkLabel cta={detail.viewLive} />
                </a>
              )}
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-line mobile:w-full"
              >
                <LinkLabel cta={detail.viewGithub} />
              </a>
            </div>
          </div>
        </header>

        {/* ── Figure ───────────────────────────────────────────────────── */}
        {project.screenshot ? (
          <figure
            data-detail-figure=""
            className="mx-auto w-[min(1100px,88vw)] overflow-hidden rounded-media border border-line bg-surface"
          >
            <img
              src={project.screenshot.src}
              width={project.screenshot.width}
              height={project.screenshot.height}
              alt={`${project.title} screenshot`}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </figure>
        ) : (
          // MCP App: no screenshot. A 100svh aria-hidden stage the
          // constellation re-staging to the centre (× 1.3) fills, captioned.
          <div className="relative">
            <div aria-hidden="true" data-detail-stage="" className="h-svh" />
            <EmblemOutline
              emblem={project.emblem}
              className="absolute top-[46%] left-1/2 h-[min(calc(var(--card-h)*1.3),70svh)] w-[min(calc(var(--card-w)*1.3),calc(100%-2*var(--gutter)))] -translate-1/2"
            />
            <div className="absolute inset-x-0 bottom-[12svh] flex justify-center px-gutter">
              <p data-safe className="t-label text-ink-2">
                {detail.screenshotSoon}
              </p>
            </div>
          </div>
        )}

        {/* ── Writeup ──────────────────────────────────────────────────── */}
        <section
          aria-labelledby="project-about-title"
          className="px-gutter pt-[22svh] pb-[18svh] mobile:pt-28 mobile:pb-24"
        >
          <div className="grid grid-cols-12 items-baseline gap-x-col-gap gap-y-8">
            <h2
              id="project-about-title"
              className="t-label col-span-12 text-ember desktop:col-span-3"
            >
              {detail.aboutHeading}
            </h2>
            <div data-safe data-cursor="text" className="col-span-12 w-fit max-w-full desktop:col-span-8 desktop:col-start-4">
              <p className="t-lede max-w-[40ch] text-ink">{project.writeup[0]}</p>
              <p className="t-body mt-10 text-ink-2">{project.writeup[1]}</p>
              <p className="t-body mt-6 text-ink-2">{project.writeup[2]}</p>
            </div>
          </div>
        </section>
      </article>

      {/* ── Next project ───────────────────────────────────────────────── */}
      <nav aria-labelledby="next-project-title" className="overflow-x-clip border-t border-line px-gutter">
        <div data-safe className="relative py-[9svh] mobile:py-14">
          <h2 id="next-project-title" className="t-label text-ember">
            {detail.nextHeading}
          </h2>
          <Link
            to={`/work/${next.slug}`}
            data-cursor="open"
            data-next-emblem={next.emblem}
            className="mt-5 flex items-center justify-between gap-6 text-ink transition-colors duration-240 ease-ui after:absolute after:inset-0 hover:text-ember focus-visible:text-ember"
          >
            <span className="t-display-l">{next.title}</span>
            <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-9 shrink-0 desktop:size-14" />
          </Link>
        </div>
      </nav>
    </>
  );
}

/** Unknown slug (§6): over S0, text at 24svh. */
function ProjectNotFound() {
  return (
    <section aria-labelledby={TITLE_ID} className="relative min-h-svh overflow-x-clip px-gutter pt-[24svh] pb-[20svh]">
      <div data-safe className="w-fit max-w-full">
        <h1 id={TITLE_ID} tabIndex={-1} className="t-title text-balance text-ink">
          {detail.notFound.title}
        </h1>
        <p className="t-body mt-6 max-w-[40ch] text-ink-2">{detail.notFound.body}</p>
        <Link to={detail.notFound.back.href} className="btn btn-line mt-10 mobile:w-full">
          <LinkLabel cta={detail.notFound.back} />
        </Link>
      </div>
    </section>
  );
}
