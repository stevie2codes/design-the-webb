import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigationType, useParams } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import LinkLabel from '../components/LinkLabel';
import {
  caseChrome,
  getCaseStudy,
  getNextCaseStudy,
  type Block,
  type CaseSection,
  type CaseStudy,
  type Titled,
} from '../content/caseStudies';
import { detail, type RichText } from '../content/site';
import { StateId } from '../field/states/ids';
import { onScrollRefresh } from '../motion/lenis';
import { clearPageRects, registerPageRects } from '../scroll/anchors';
import { enterRoute } from '../scroll/director';
import { store } from '../scroll/store';
import CaseFigure from './case/CaseFigures';
import NotFoundPage from './NotFoundPage';

const TITLE_ID = 'case-title';

/**
 * /case-studies/:slug (SPEC §6 "Case study"), code-split. Long-form and
 * DOM-first: every word is real text, the figures are recreated mock UI on
 * solid surfaces (aria-hidden, captioned), and nothing depends on motion.
 *
 * Field: director route mode over S0 STATIC — the quiet noise the work was
 * pulled out of. The header and each section's content column are
 * `[data-safe]` (scrim + text-safe mask, §2.3), measured on mount, refresh
 * and resize (registerPageRects).
 *
 * An unknown slug renders the 404 page (its own route mode, S10), matching
 * the prerendered 404.html that `routeKey` maps it to.
 */
export default function CaseStudyPage() {
  const { slug } = useParams();
  const study = getCaseStudy(slug);

  useEffect(() => {
    // The 404 page enters its own route mode; a child effect runs first, so
    // only claim the route when there is a study to show.
    if (study) enterRoute(store, 'detail', study.slug, { a: StateId.STATIC });
  }, [study]);

  if (!study) return <NotFoundPage />;
  // Keyed: "Next case study" mounts a fresh page (focus, rects).
  return <CaseStudyArticle key={study.slug} study={study} />;
}

function CaseStudyArticle({ study }: { study: CaseStudy }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navType = useNavigationType();
  const next = getNextCaseStudy(study.slug);

  useEffect(() => {
    document.title = detail.documentTitle(study.title);
  }, [study]);

  // In-app navigation lands focus on the title (not on POP: first load, back / forward).
  useEffect(() => {
    if (navType !== 'POP') titleRef.current?.focus({ preventScroll: true });
  }, [navType]);

  // Text-safe rects (§2.3), measured on mount, refresh and resize.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = (): void => registerPageRects(root);
    measure();
    window.addEventListener('resize', measure, { passive: true });
    const off = onScrollRefresh(measure);
    return () => {
      window.removeEventListener('resize', measure);
      off();
      clearPageRects();
    };
  }, []);

  // Figures are numbered through the page.
  let fig = 0;
  const numbered = study.sections.map((section) => ({
    section,
    figs: section.blocks.map((b) => (b.kind === 'figure' ? ++fig : 0)),
  }));

  return (
    <div ref={rootRef}>
      <article aria-labelledby={TITLE_ID} data-case={study.slug} className="overflow-x-clip">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="px-gutter pt-[calc(4rem+10svh)] pb-[8svh] mobile:pt-28 mobile:pb-12">
          <div data-safe className="w-fit max-w-full">
            <Link
              to={caseChrome.back.href}
              className="link-line t-label gap-[0.6em] text-ink-2 hover:text-ink focus-visible:text-ink"
            >
              <LinkLabel cta={caseChrome.back} />
            </Link>

            <p className="t-label mt-[7svh] text-ember mobile:mt-10">
              {study.indexLabel} · {caseChrome.kind}
            </p>
            <h1
              ref={titleRef}
              id={TITLE_ID}
              tabIndex={-1}
              className="t-display-xl mt-4 max-w-[14ch] text-balance text-ink outline-none"
            >
              {study.title}
            </h1>
            <p className="t-lede mt-8 max-w-[52ch] text-ink-2">{study.lede}</p>
            <p className="t-label mt-8 flex items-start gap-2.5 text-ink-2">
              <Lock aria-hidden="true" size={14} strokeWidth={1.5} className="mt-[0.15em] shrink-0 text-ember" />
              <span>{caseChrome.ndaNote}</span>
            </p>
          </div>

          <dl
            data-safe
            aria-label={caseChrome.metaLabel}
            className="mt-14 grid grid-cols-1 gap-x-col-gap gap-y-6 border-t border-line pt-7 min-[600px]:grid-cols-2 desktop:grid-cols-4"
          >
            {study.meta.map((m) => (
              <div key={m.label}>
                <dt className="t-label text-ink-2">{m.label}</dt>
                <dd className="t-body mt-2 text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ── Sections ─────────────────────────────────────────────────── */}
        {numbered.map(({ section, figs }) => (
          <Section key={section.id} section={section} figs={figs} slug={study.slug} />
        ))}

        {/* ── Walkthrough request ──────────────────────────────────────── */}
        <aside className="px-gutter pt-[6svh] pb-[12svh] mobile:pb-20">
          <div data-safe className="grid grid-cols-12 gap-x-col-gap">
            <div className="col-span-12 desktop:col-span-8 desktop:col-start-4">
              <p className="t-display-m text-balance text-ink">{caseChrome.request.lead}</p>
              <a href={caseChrome.request.cta.href} className="btn btn-ember mt-8 mobile:w-full">
                <LinkLabel cta={caseChrome.request.cta} />
              </a>
            </div>
          </div>
        </aside>
      </article>

      {/* ── Next case study ────────────────────────────────────────────── */}
      <nav aria-labelledby="next-case-title" className="overflow-x-clip border-t border-line px-gutter">
        <div data-safe className="relative py-[9svh] mobile:py-14">
          <h2 id="next-case-title" className="t-label text-ember">
            {caseChrome.nextHeading}
          </h2>
          <Link
            to={`/case-studies/${next.slug}`}
            data-cursor="open"
            className="mt-5 flex items-center justify-between gap-6 text-ink transition-colors duration-240 ease-ui after:absolute after:inset-0 hover:text-ember focus-visible:text-ember"
          >
            <span className="t-display-l">{next.title}</span>
            <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-9 shrink-0 desktop:size-14" />
          </Link>
        </div>
      </nav>
    </div>
  );
}

function Section({ section, figs, slug }: { section: CaseSection; figs: readonly number[]; slug: string }) {
  const headingId = `${slug}-${section.id}`;
  return (
    <section aria-labelledby={headingId} className="px-gutter py-[7svh] mobile:py-12">
      <div className="grid grid-cols-12 items-start gap-x-col-gap gap-y-6">
        <h2 id={headingId} className="t-label col-span-12 pt-1 text-ember desktop:col-span-3">
          {section.heading}
        </h2>
        <div data-safe className="col-span-12 flex min-w-0 flex-col gap-7 desktop:col-span-8 desktop:col-start-4">
          {section.blocks.map((block, i) => (
            <BlockView key={i} block={block} fig={figs[i]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Rich({ text }: { text: RichText }) {
  return (
    <>
      {text.map((run, i) =>
        typeof run === 'string' ? (
          run
        ) : (
          <strong key={i} className="font-normal text-ink">
            {run.strong}
          </strong>
        ),
      )}
    </>
  );
}

function BlockView({ block, fig }: { block: Block; fig: number }): ReactNode {
  switch (block.kind) {
    case 'p':
      return (
        <p className="t-body text-ink-2">
          <Rich text={block.text} />
        </p>
      );
    case 'list':
      return (
        <ul className="flex flex-col gap-4">
          {block.items.map((item, i) => (
            <li key={i} className="t-body relative pl-6 text-ink-2">
              <span aria-hidden="true" className="absolute top-[0.85em] left-0 h-px w-3 bg-ember" />
              <Rich text={item} />
            </li>
          ))}
        </ul>
      );
    case 'steps':
      return <Numbered items={block.items} />;
    case 'lessons':
      return <Numbered items={block.items} />;
    case 'decision':
      return (
        <div className="rounded-media border border-line bg-surface p-7 mobile:p-5 desktop:p-9">
          <h3 className="t-display-m text-balance text-ink">{block.title}</h3>
          <dl className="mt-8 grid gap-x-8 gap-y-3 min-[600px]:grid-cols-[8rem_1fr] min-[600px]:gap-y-7">
            <dt className="t-label text-ink-3">{caseChrome.decision.considered}</dt>
            <dd className="mb-4 min-[600px]:mb-0">
              <ul className="flex flex-col gap-2">
                {block.considered.map((c) => (
                  <li key={c} className="t-body relative pl-5 text-ink-3">
                    <span aria-hidden="true" className="absolute top-[0.85em] left-0 h-px w-2.5 bg-line-strong" />
                    {c}
                  </li>
                ))}
              </ul>
            </dd>
            <dt className="t-label text-ember">{caseChrome.decision.chose}</dt>
            <dd className="t-body mb-4 text-ink min-[600px]:mb-0">{block.chose}</dd>
            <dt className="t-label text-ink-3">{caseChrome.decision.why}</dt>
            <dd className="t-body text-ink-2">{block.why}</dd>
          </dl>
        </div>
      );
    case 'figure':
      return (
        <figure className="my-2">
          <div aria-hidden="true">
            <CaseFigure id={block.figure} />
          </div>
          <figcaption className="t-body mt-4 text-ink-2">
            <span className="t-label mr-3 text-ink">{caseChrome.figure(fig)}</span>
            {block.caption}
          </figcaption>
        </figure>
      );
  }
}

function Numbered({ items }: { items: readonly Titled[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => (
        <li key={item.title} className="grid grid-cols-[3rem_1fr] gap-x-2 border-t border-line py-6 last:pb-0">
          <span aria-hidden="true" className="t-label pt-1 text-ember">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div>
            <p className="t-lede text-ink">{item.title}</p>
            <p className="t-body mt-2 text-ink-2">{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
