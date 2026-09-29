// Build-time prerender (SPEC §0, §9.11, §9.12 "No JS").
//
// After the client build is written, load src/entry-server.tsx through a
// throwaway Vite SSR server, render every route in PRERENDER_ROUTES
// (src/routes.ts) and write it into a copy of the built index.html:
//   dist/index.html            "/"
//   dist/work/<slug>.html      "/work/<slug>"   (extensionless URLs resolve to .html
//                                                on Netlify and in `vite preview`)
//   dist/404.html              any unknown path (Netlify serves it with status 404)
//   dist/work/404.html         any unknown /work/<slug> ("Project not found";
//                              public/_redirects serves it with status 404)
// #root gets the markup plus data-ssr="<route key>", and <title> the route's
// title; main.tsx hydrates when the key matches the URL.
//
// `vite preview` mirrors Netlify: unknown paths get 404.html instead of the
// SPA fallback to index.html (which would show the home page with JS off).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const ROOT_TAG = '<div id="root"></div>';
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SITE_ORIGIN = 'https://designthewebb.com';

/**
 * Per-route share metadata: og:title / twitter:title follow the route's
 * <title>; og:url and <link rel="canonical"> point at the route's own URL.
 * The 404 files keep the home og:url and get no canonical (they are served
 * for every unknown path).
 * @param {string} template
 * @param {{ url: string, key: string, title: string }} page
 */
function withRouteMeta(template, page) {
  const title = escapeHtml(page.title);
  let html = template
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`);
  if (page.key === '404' || page.key === 'project-404') return html;
  const url = page.url === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${page.url}`;
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapeHtml(url)}$2`);
  if (!html.includes('rel="canonical"')) html = html.replace('</title>', `</title>\n    <link rel="canonical" href="${escapeHtml(url)}" />`);
  return html;
}

/** @returns {import('vite').Plugin} */
export default function prerender() {
  /** @type {import('vite').ResolvedConfig} */
  let config;
  return {
    name: 'dtw:prerender',
    apply: (_, env) => env.command === 'build' || env.isPreview === true,
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      if (config.command !== 'build' || config.build.ssr) return;
      const outDir = resolve(config.root, config.build.outDir);
      const template = readFileSync(join(outDir, 'index.html'), 'utf8');
      if (!template.includes(ROOT_TAG)) throw new Error(`[dtw:prerender] ${ROOT_TAG} not found in index.html`);

      const server = await createServer({
        configFile: false,
        root: config.root,
        logLevel: 'error',
        appType: 'custom',
        plugins: [react()],
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      try {
        const { prerenderAll } = await server.ssrLoadModule('/src/entry-server.tsx');
        const pages = await prerenderAll();
        for (const page of pages) {
          const html = withRouteMeta(template, page)
            .replace(ROOT_TAG, `<div id="root" data-ssr="${escapeHtml(page.key)}">${page.html}</div>`)
            .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
          const file = join(outDir, page.file);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, html);
        }
        config.logger.info(`[dtw:prerender] ${pages.map((p) => p.file).join(', ')}`);
      } finally {
        await server.close();
      }
    },
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, _res, next) => {
        const accept = req.headers.accept ?? '';
        if ((req.method !== 'GET' && req.method !== 'HEAD') || !(accept === '' || accept.includes('text/html') || accept.includes('*/*'))) return next();
        const [rawPath, query = ''] = (req.url ?? '/').split('?');
        let path;
        try {
          path = decodeURIComponent(rawPath);
        } catch {
          return next();
        }
        if (path === '/' || /\.[a-z0-9]+$/i.test(path)) return next(); // the home file, or an asset
        const base = path.replace(/\/+$/, '');
        if (existsSync(join(outDir, `${base}.html`))) {
          req.url = `${base}.html${query ? `?${query}` : ''}`;
        } else if (/^\/work\/[^/]+$/.test(base) && existsSync(join(outDir, 'work/404.html'))) {
          req.url = '/work/404.html';
        } else if (existsSync(join(outDir, '404.html'))) {
          req.url = '/404.html';
        }
        next();
      });
    },
  };
}
