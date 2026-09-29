/**
 * Route table for the build-time prerender (SPEC §0, §9.11, §9.12 "No JS").
 *
 * Every known URL ships as static HTML: `/`, each `/work/:slug` and the 404
 * page. The prerender (scripts/prerender-plugin.mjs) stamps each file's
 * `#root` with its route key (`data-ssr`); main.tsx hydrates only when that
 * key matches the key of the URL being loaded, and renders from scratch
 * otherwise. An unknown `/work/<slug>` is served work/404.html ("Project
 * not found", §6), any other unknown path 404.html, so both paths (JS on and
 * off) show the same page (§8.4).
 *
 * Pure data: no DOM access (the prerender imports it in Node).
 */
import { getProject, projects } from './content/projects';
import { detail, notFound, siteTitle } from './content/site';

/** Key of the generic 404 page (any unknown path). */
export const NOT_FOUND_KEY = '404';
/** Key of `/work/:slug` with an unknown slug ("Project not found", prerendered to work/404.html). */
export const PROJECT_NOT_FOUND_KEY = 'project-404';

/** "/work/pulse/" → "/work/pulse"; "" → "/". */
const normalize = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';

/** The route key for a pathname: "/", "/work/<slug>", "project-404" or "404". */
export function routeKey(pathname: string): string {
  const path = normalize(pathname);
  if (path === '/') return '/';
  const match = /^\/work\/([^/]+)$/.exec(path);
  if (!match) return NOT_FOUND_KEY;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return PROJECT_NOT_FOUND_KEY;
  }
  return getProject(slug) ? `/work/${slug}` : PROJECT_NOT_FOUND_KEY;
}

export interface PrerenderRoute {
  /** URL rendered through the router. */
  readonly url: string;
  /** Route key stamped on #root (data-ssr). */
  readonly key: string;
  /** Output file, relative to the build's outDir. Extensionless URLs resolve to `<path>.html`. */
  readonly file: string;
  /** document.title for the file (the pages set the same title at runtime). */
  readonly title: string;
}

export const PRERENDER_ROUTES: readonly PrerenderRoute[] = [
  { url: '/', key: '/', file: 'index.html', title: siteTitle },
  ...projects.map((p) => ({
    url: `/work/${p.slug}`,
    key: `/work/${p.slug}`,
    file: `work/${p.slug}.html`,
    title: detail.documentTitle(p.title),
  })),
  { url: '/404', key: NOT_FOUND_KEY, file: '404.html', title: detail.documentTitle(notFound.title) },
  // Any unknown slug renders the same "Project not found" page (public/_redirects
  // serves this file with status 404 for /work/*; real work/<slug>.html files win).
  {
    url: '/work/__not-found',
    key: PROJECT_NOT_FOUND_KEY,
    file: 'work/404.html',
    title: detail.documentTitle(detail.notFound.title),
  },
];
