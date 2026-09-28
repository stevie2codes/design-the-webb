import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LinkLabel from '../components/LinkLabel';
import { detail, notFound } from '../content/site';

/**
 * 404 (SPEC §6), code-split. The field draws S10 FLATLINE registered to the
 * [data-field-anchor="S10"] line at 68svh (70svh mobile), 8–92vw. Text sits at
 * 24–52svh on the page gutter, like every other page (only the line starts
 * at 8vw). The tab title says the page failed: "Page not found — Stephen Webb".
 *
 * DOM baseline: while the field is not live, a 1px hairline stands in for the
 * flatline at the same anchor (the way the chart shows SVG bars).
 * Field-phase hook: hovering/focusing the CTA ([data-heartbeat]) fires one
 * heartbeat and sharpens the aperture.
 */
export default function NotFoundPage() {
  useEffect(() => {
    document.title = detail.documentTitle(notFound.title);
  }, []);

  return (
    <section aria-labelledby="not-found-title" data-hud-zone className="relative min-h-svh overflow-x-clip">
      <div aria-hidden="true" data-field-anchor="S10" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-(--anchor-flatline-y) left-(--anchor-flatline-x) hidden h-px w-(--anchor-flatline-w) bg-linear-to-r from-transparent via-line-strong to-transparent no-field:block"
      />

      <div className="px-gutter pt-[24svh] pb-[36svh]">
        <div data-safe className="w-fit max-w-full">
          <p className="t-label text-ember">{notFound.label}</p>
          <h1 id="not-found-title" tabIndex={-1} className="t-title mt-5 text-balance text-ink">
            {notFound.title}
          </h1>
          <p className="t-body mt-6 max-w-[40ch] text-ink-2">{notFound.body}</p>
          <Link to={notFound.cta.href} data-heartbeat="" className="btn btn-line mt-10 mobile:w-full">
            <LinkLabel cta={notFound.cta} />
          </Link>
        </div>
      </div>
    </section>
  );
}
