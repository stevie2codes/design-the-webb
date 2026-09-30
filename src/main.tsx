import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
// Self-hosted fonts (SPEC §2.5). The fontsource CSS scopes each subset with
// unicode-range, so only the latin files download. Archivo latin is also
// preloaded by the preloadFonts() plugin in vite.config.ts.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
// Sketch theme hands (src/sketch.css): @font-face only; files load on use.
import '@fontsource-variable/caveat/wght.css'
import '@fontsource/permanent-marker/latin-400.css'
import '@fontsource/architects-daughter/latin-400.css'
import 'lenis/dist/lenis.css'
import './index.css'
import './sketch.css'
import { applyLayoutVars } from './field/layout'
import { initMotionPref } from './motion/motionPref'
import { initLayoutMode } from './motion/useLayoutMode'
import { routeKey } from './routes'
import App from './App.tsx'

// Boot: layout variables from layout.ts (overrides the static CSS copy),
// and keep html.rm / html[data-layout] in sync with the pre-paint script.
applyLayoutVars()
initMotionPref()
initLayoutMode()

// The build prerenders every known route into #root (scripts/prerender-plugin.mjs)
// and stamps it with its route key. Hydrate when the markup is this URL's;
// otherwise (dev, or an unknown slug served the 404 file) render from scratch.
const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)
if (container.firstElementChild && container.dataset.ssr === routeKey(window.location.pathname)) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
