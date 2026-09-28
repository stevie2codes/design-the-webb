# designthewebb.com: "Signal from Noise"

Personal portfolio for Stephen Webb, Senior Product Designer. The site is dark and cinematic, built around a "living data field". One persistent full-viewport WebGL point field sits behind every route and morphs as you scroll. Sticky DOM chapters sit on top of it. As you scroll, noise comes into focus as the name, then pours into an honest career chart, redaction bars, a silhouette for each project, a capability stack, and finally a beacon you can click.

**`docs/redesign/SPEC.md` is the source of truth.** The `§` references below point into it. If this file and the spec disagree, follow the spec and fix this file.

The shared scroll ↔ field APIs (store, segments, director, anchors, field entry, per-state constants, QA params) and the per-tick ordering are pinned in **`docs/redesign/CONTRACTS.md`**. Change a contract signature only together with that file.

## Tech stack

- **Framework**: React 19, TypeScript and Vite 7. Routing uses `react-router-dom` 7. Home is eager (the hero `<h1>` is the LCP); `/work/:slug` and the 404 are lazy and code-split. **Every route is prerendered at build time** (`scripts/prerender-plugin.mjs` renders `src/entry-server.tsx` for each entry in `src/routes.ts`), so the no-JS path has all copy and links, and `main.tsx` hydrates. Keep `window`/`document` access out of render (effects and handlers only).
- **Styling**: Tailwind CSS v4 through `@tailwindcss/vite`. There is no `tailwind.config.js`.
- **Motion**: GSAP 3.14 (ScrollTrigger, SplitText, CustomEase) with `@gsap/react` `useGSAP`. Smooth scroll is Lenis 1.3, on the desktop full-motion path only.
- **Field**: vanilla `three` 0.186 with one `THREE.Points` object and a GLSL3 `ShaderMaterial`. It is **dynamically imported after first paint** and never enters the initial bundle. The Canvas2D fallback never imports three.
- **Fonts**: self-hosted through fontsource and imported in `src/main.tsx`:
  - Archivo Variable, including its width axis
  - Instrument Serif italic
  - JetBrains Mono Variable

  There are **no Google Fonts** `<link>`s. The Archivo latin woff2 is preloaded by the `preloadFonts()` plugin in `vite.config.ts`.
- **Icons**: `lucide-react` at `strokeWidth={1.5}`. Only Lock, ArrowUpRight, ArrowUp, Copy, Menu and X are used.
- **Removed, do not reintroduce**: Framer Motion, `components/hero-bg/`, the cream/orange palette, custom cursors that hide the native cursor, and magnetic buttons.

## Commands

- `npm run dev`: dev server on port 5173.
- `npm run build`: runs `tsc -b`, then the Vite build.
- `npm run lint`: ESLint.
- `npm run preview`: serves the production build.
- `npx tsc -p tsconfig.app.json --noEmit`: typecheck only.
- `npm run gen:layout`: rewrites the static layout CSS variables in `src/index.css` from `src/field/layout.ts`. **Run it after every edit to layout.ts.** `node scripts/gen-layout-css.mjs --check` checks for drift without writing. It needs Node 22.18 or later for native TypeScript stripping.
- `npm run gen:grain`: regenerates `public/textures/grain-128.png`.

## Module layout (§9.1)

```
index.html                pre-paint script: no-js→js, html.rm, html[data-layout]; scrollRestoration manual
src/
  main.tsx                fontsource + lenis.css + index.css; applyLayoutVars(); init motion/layout sync;
                          hydrateRoot when #root[data-ssr] matches routeKey(pathname), else createRoot
  App.tsx                 AppShell (ScrollInfra, SkipLink, FieldCanvas, Atmosphere, Nav, Rail, Hud, ScrollToHash,
                          <main id="main">, Footer, JumpCutOverlay, CursorRing) + App = BrowserRouter › AppShell
  entry-server.tsx        build-time prerender: StaticRouter › AppShell via react-dom/static
  routes.ts               routeKey(), PRERENDER_ROUTES (url, output file, title)
  debugParams.ts          QA URL params (?debug=field, ?film=F, ?tier=, ?intro=0); window.__lenis / __field
  index.css               @theme tokens, custom variants, @layer base / components (see below)
  content/
    site.ts               EVERY home + shell string (Appendix A). Never hard-code copy in components.
    projects.ts           side projects: verbatim copy + index, emblem StateId, side, screenshot w/h
  motion/
    gsap.ts               the only place plugins are registered; exports gsap, ScrollTrigger, SplitText, useGSAP, EASE, DUR
    motionPref.ts         reduced motion (OS + footer toggle, localStorage 'dtw:motion'), html.rm, useMotionPref()
    useLayoutMode.ts      'desktop' | 'mobile' (MQ.mobile), html[data-layout], useLayoutMode()
    lenis.ts              Lenis singleton + ticker wiring, useSmoothScroll(), glide / jumpCut / rewind /
                          scrollInstant, subscribeScroll, onSample (≤ 10 Hz) / sampleNow, requestRefresh
    reveal.ts             lineMask(el, opts) and fadeUp(els, opts): scrubbed or timed; null under reduced motion
  scroll/
    chapters.ts           document map: CHAPTERS (L, sticky flags), HOME_ORDER, JUMP_OFFSET_VH, headingId()
    store.ts, segments.ts, director.ts, anchors.ts   contracts (docs/redesign/CONTRACTS.md), §9.2–9.6
    useChapter.ts         section ScrollTrigger → store (onRefresh is the only layout read), [data-reveal]
                          reveals, onProgress / reveal callbacks, focus-in glide to the hold
    jump.ts               §4.4 jump policy (glide ≤ 2 states, else jump cut), focusQuietly, onJumpLinkClick
  field/
    layout.ts             SINGLE SOURCE OF TRUTH for anchor boxes (vw/svh), desktop + mobile; CHART geometry,
                          card box, slot heights, MQ; resolveAnchor(); layoutCss(); applyLayoutVars()
    states/ids.ts         StateId (const object + type; enums are not allowed by erasableSyntaxOnly)
    index.ts, uniforms.ts, tiers.ts   contracts: bootField/acquire/release/getField, STATE_PARAMS, tier table
    FieldCanvas.tsx       the #field-root host: idle-callback acquire, setMode, scroll → invalidate
    engine.ts             renderer, loop, uniform writes, tiers / probe / adaptivity, resize, context loss
    material.ts           geometry, ShaderMaterial + glow clone, uniform objects
    choreo.ts             hero one-shots: §6 intro, §9.5 lock print (--scan, uPrinted), hand-back
    input.ts              pointer, touch ripple, visibility → store
    generation.ts         worker client (jobs, supersede, lazy states); textures.ts: resident DataTextures
    shaders/              field.vert / field.frag / noise / live .glsl (live.glsl: one case per state)
    states/               ids.ts, common.ts (golden layout, perm, sort keys, samplers, pack), registry.ts,
                          s00-static.ts … sNN-*.ts (pure generators), name-sampler.ts (S1, main thread)
    worker/               generate.worker.ts, run.ts (no-Worker fallback runner), protocol.ts
    debug.ts              ?debug=field overlay (lazy chunk); fallback2d.ts (phase 8)
  chapters/               Hero, About, CareerChart, Nda, Projects, ProjectPanel, Capabilities, Contact
  components/             Chapter, ChapterHeading, LinkLabel, Chip, SkipLink, Atmosphere, Nav, MobileMenu,
                          Rail, Hud, Footer, CopyEmail, MotionToggle, CursorRing, JumpCutOverlay, EmblemOutline
  pages/                  HomePage (composes chapters), ProjectDetailPage, NotFoundPage
scripts/                  gen-layout-css.mjs, make-grain.mjs, prerender-plugin.mjs (+ .d.mts; build prerender and
                          the `vite preview` 404 fallback)
```

## The field architecture, in short

- **One field, many states.** There are 11 states: S0 STATIC, S1 NAME, S2 CHART, S3 REDACTED, S4 PULSE, S5 LATTICE, S6 DECK, S7 CONSTELLATION, S8 STACK, S9 BEACON and S10 FLATLINE (404 only).
  - Every state is resident on the GPU as position and meta DataTextures (§3.4). Crossing a segment boundary only swaps uniforms.
- **Scroll drives it.** A pure function maps scrollY to a film position F ∈ [0, 9], and a 120 ms damp smooths it (§4.3).
  - Sticky stages replace GSAP pins, and there are **no pins anywhere**.
  - A plain mutable store feeds the render loop. **React never re-renders per frame, and nothing reads layout per frame.** HUD, rail and nav read the store through refs at 10 Hz or less.
- **Registration.** Every shape is aspect-fit into an anchor box from `field/layout.ts`.
  - The DOM places empty `[data-field-anchor="Sx"]` boxes from the same CSS variables.
  - `useChapter` measures those boxes, and every `[data-safe]` text block, **on ScrollTrigger refresh only**.
- **Paths** (§9.12). Every path shows the same content, and no text depends on WebGL, JS or animation.
  - Full desktop: Lenis, sticky stages, WebGL High or Mid tier.
  - Full mobile: native scroll, only C0 and C5 sticky, WebGL Low tier, field slots.
  - Reduced motion: no Lenis, flow layout, still posters.
  - No WebGL: Canvas2D fallback.
  - No JS: CSS glow backdrop.

## Rules

- **Preserve the field.** It is a single persistent `#field-root` host in the App shell, outside `<Routes>`, and it outlives route changes. Do not add other canvases, background animations or decorative layers that compete with it. Do not remount it per route. In StrictMode it must create exactly one WebGL context.
- **Copy.** Every string traces to SPEC Appendix A through `src/content/`. Do not invent facts or add copy.
- **The DOM is the content.** Every word is real DOM text, and the `<h1>` is visible at first paint.
  - Decorative elements are `aria-hidden`: the canvas, vignette, grain, HUD, counters, field slots, anchors and the footer wordmark.
  - Arrow glyphs in labels are `aria-hidden`; use `<LinkLabel>`.
- **Hold rule** (§7). Within a stuck range, only colour and emphasis change. Body copy never moves once revealed. Nothing is magnetic. The native cursor is never hidden.
- **Contrast** (§2.3).
  - `ink-3` only ever sits on solid surfaces.
  - Every text block over the field gets `data-safe`.
  - Ember text is never smaller than 12px.
  - Ink on ember is forbidden.
- **Focus.** Every hover effect also fires on `:focus-visible`, and touch targets are at least 44px.
- **Performance.** Initial JS is ≤ 140 KB gzipped. three goes in its own chunk. Images always carry `width` and `height`.
- **Motion.** Use GSAP only through `src/motion/gsap.ts`, and create triggers inside `useGSAP({ scope, dependencies: [reducedMotion, layout] })`. Every scrubbed tween uses `ease: 'none'` with `scrub: true`.

## Design system (`src/index.css`)

**Colours** (`@theme`; Tailwind's default palette is removed with `--color-*: initial`):

| Token | Value | Use |
|---|---|---|
| `void` | `#050507` | Page background, WebGL clear colour |
| `deep` | `#0a0a0e` | Footer, mobile menu |
| `surface` / `surface-2` | `#111117` / `#18181f` | Cards; hover state |
| `line` / `line-strong` | bone at 10% / 18% | Hairlines, chips; rail track, dividers |
| `ink` / `ink-2` / `ink-3` | `#f2eee6` / `#a7a39a` / `#8c887f` | Text: primary / body / tertiary (solid surfaces only) |
| `ember` | `#ff6a3d` | The single accent |
| `ember-hot` | `#ffb08a` | Ember hover |
| `ember-deep` | `#b8361a` | Pressed state only, never text |
| `core` | `#ffe2cf` | Beacon CTA |
| `steel` | `#8c97ad` | Chart swatch |

**Type roles.** Use these `.t-*` classes, not ad-hoc font utilities. Add colour with `text-ink` and friends.
- `.t-name`: the h1. Archivo 800 at 75% width, uppercase, sized by `--name-fs`.
- `.t-display-xl`: the detail page title.
- `.t-title`: project titles and the 404 heading.
- `.t-display-l`: chapter statements.
- `.t-display-m`: the hero lede, NDA heading, capability titles and the email address.
- `.t-stat`: chart numerals.
- `.t-lede`: lede paragraphs.
- `.t-body`: body copy, max 62ch.
- `.t-accent`: Instrument Serif italic at 1.04em, in ember. Use it for one to three voice words.
- `.t-label`: JetBrains Mono at 12px, uppercase.
- `.t-micro`: JetBrains Mono at 11px, for aria-hidden decoration only.

**Tokens:**
- Easing: `ease-cine`, `ease-out-expo`, `ease-in-expo`, `ease-ui`.
- Radius: `rounded-media` (16px) and `rounded-pill`.
- Spacing: `px-gutter` and `left-gutter`, `gap-x-col-gap`, `w-card-w` and `h-card-h`.

**Custom variants:**
- Layout:
  - `mobile:` covers width < 768, or width < 1024 in portrait. Short landscape phones stay desktop.
  - `desktop:` is everything else.
  - `short:` is height < 600.
  - `fine:` is `pointer: fine`.
- Paths:
  - `js:` and `nojs:` follow whether JS is running.
  - `live:` means JS with full motion.
  - `rm:` means reduced motion.
  - `field-live:` and `no-field:` follow whether the WebGL field is drawing.
  - `field-s2:` … `field-s9:` and `no-field-s10:` follow whether the field draws **that state** (`html[data-field-states]`). Use them to hide a state's DOM stand-in (chart SVG bars, emblem outlines…), never `field-live:`, so a state whose generator has not landed never leaves a hole.
  - `intro:` applies while the §6 intro runs (`html[data-intro="running"]`).
  - **`staged:`** applies only inside a chapter whose stage is actually sticky right now. Use it for stacked or absolute stage layouts that must fall back to flow under no-js and rm.

**Component classes:**
- `.chapter` / `.stage`: rendered by `<Chapter>`; see below.
- `[data-field-anchor="Sx"]`: positioned from the `--anchor-<state>-x|y|w|h` variables.
- `.field-slot[data-slot=about|work|project|capabilities]`: mobile only. It is `display: none` on desktop.
- `[data-safe]` (alias `.scrim`): a void scrim at .82 opacity, 48px beyond the block, feathered.
- `.chip`.
- `.btn` with `.btn-ember`, `.btn-line` or `.btn-outline-ember`: 48px tall.
- `.link-line`: a 1px underline that scales in; 44px tall.
- `.scan-print`: the h1 mask driven by `--scan`.
- `.skip-link`.
- `.field-root`, `.atmo`, `.atmo-vignette`, `.atmo-grain`.

**Chapters** (§4.1, §4.2). Wrap every home chapter in `<Chapter id="…" labelledBy={headingId(id)}>`.
- It takes its L and sticky flags from `CHAPTERS` in `scroll/chapters.ts`.
- When sticky, the section is `100svh + L` tall and the `.stage` is `sticky; top: 0; 100svh`. This happens only under `html.js:not(.rm)`, and on mobile only for the hero and contact.
- Everywhere else the chapter is plain flow, and the stages of sticky chapters keep `min-height: 100svh`.
- Never put `overflow: hidden` on an ancestor of a stage, because it breaks sticky. Use `overflow: clip` instead.

**Layout variables.** They live on `:root`:
- `--gutter`, `--col-gap`, `--name-fs`, `--card-w`, `--card-h`
- `--slot-*`
- `--anchor-<state>-*`

Each has a desktop value and a mobile value. They are generated from `field/layout.ts`: the static copy sits in index.css between the `@generated` markers, and the runtime copy is injected by `applyLayoutVars()`. **Edit layout.ts, never the generated block.**

**Stacking order** (z-index): body glow −1, `#field-root` 0, atmosphere 1, `main` and footer 2, rail and HUD 30, nav 40, mobile menu 50, jump-cut overlay 60, cursor ring 70, skip link 80.

## Tailwind CSS v4 specifics

- Use `@import "tailwindcss"`, not the `@tailwind` directives.
- Define theme tokens in the `@theme { }` block. Define variants with `@custom-variant`.
- Custom CSS **must** live in `@layer base { }` or `@layer components { }`. Unlayered styles beat every Tailwind utility because of cascade layer precedence.
  - The one intentional exception is the runtime `<style id="dtw-layout-vars">`.
- Load fonts from JS through the fontsource imports in main.tsx, never through a CSS `@import` of a remote stylesheet.
- Prefer Tailwind utilities over custom CSS. Shared multi-property roles go in `@layer components`.
