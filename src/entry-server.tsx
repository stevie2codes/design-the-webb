/**
 * Build-time prerender entry (SPEC §0, §9.12 "No JS"): renders the app shell
 * for every known route to static HTML, so the <h1>, every word of copy and
 * every link are in the served HTML before any JS runs. Loaded in Node by
 * scripts/prerender-plugin.mjs after the client build; never bundled for
 * the browser.
 *
 * `prerenderToNodeStream` waits for every Suspense boundary, so the lazy
 * routes (detail, 404) are rendered in full.
 */
import { StrictMode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { StaticRouter } from 'react-router-dom';
import { AppShell } from './App';
import { PRERENDER_ROUTES, type PrerenderRoute } from './routes';

async function render(url: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <StaticRouter location={url}>
        <AppShell />
      </StaticRouter>
    </StrictMode>,
    {
      onError(error) {
        throw error;
      },
    },
  );
  const decoder = new TextDecoder();
  let html = '';
  for await (const chunk of prelude as unknown as AsyncIterable<Uint8Array | string>) {
    html += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
  }
  return html + decoder.decode();
}

export interface PrerenderedPage extends PrerenderRoute {
  /** The markup that goes inside #root. */
  readonly html: string;
}

export async function prerenderAll(): Promise<PrerenderedPage[]> {
  const pages: PrerenderedPage[] = [];
  for (const route of PRERENDER_ROUTES) pages.push({ ...route, html: await render(route.url) });
  return pages;
}
