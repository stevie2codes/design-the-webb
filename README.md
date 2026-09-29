# designthewebb.com: Signal from Noise

Portfolio of Stephen Webb, Senior Product Designer at Tyler Technologies.

The site is dark and cinematic. One persistent full-viewport WebGL point field sits behind every route and morphs as you scroll: noise resolves into the name, then pours into a career chart, redaction bars, a silhouette per project, a capability stack, and a beacon you can click. Sticky DOM chapters sit on top of it, and every word is real, prerendered DOM text.

| Document | What it holds |
|---|---|
| [`docs/redesign/SPEC.md`](docs/redesign/SPEC.md) | The build spec and source of truth: states, choreography, layout, budgets, copy deck (Appendix A) |
| [`docs/redesign/CONTRACTS.md`](docs/redesign/CONTRACTS.md) | Shared scroll ↔ field APIs, per-tick ordering, measured tuning notes that override SPEC numbers |
| [`docs/redesign/QA.md`](docs/redesign/QA.md) | Latest audit results: bundle budgets, axe, long tasks, CLS, LCP, caching |
| [`CLAUDE.md`](CLAUDE.md) | Contributor and agent notes: module layout, rules, design tokens |

## Stack

- **App:** React 19, TypeScript, Vite 7, React Router 7. Every route is prerendered at build time and hydrated.
- **Styling:** Tailwind CSS 4 (`@theme` tokens in `src/index.css`, no config file).
- **Motion:** GSAP 3.14 (ScrollTrigger, SplitText) and Lenis 1.3, lazy-loaded after hydration.
- **Field:** three.js 0.186 (one `THREE.Points`, GLSL3 shaders), dynamically imported after first paint; shape generation runs in a worker. A Canvas2D fallback (no three) covers browsers without WebGL2 and repeated context loss.
- **Fonts:** self-hosted through fontsource: Archivo Variable (preloaded), Instrument Serif italic, JetBrains Mono Variable.
- **Hosting:** Netlify. `netlify.toml` builds `dist/`; `public/_headers` sets caching (hashed `/assets/*` immutable for a year, HTML always revalidated).

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b, vite build, prerender → dist/
npm run preview      # serve dist/ (unknown paths get 404.html, like Netlify)
npm run lint         # ESLint
npx tsc -p tsconfig.app.json --noEmit   # typecheck only

npm run gen:layout   # after editing src/field/layout.ts (rewrites the generated CSS vars in index.css)
npm run gen:grain    # regenerate public/textures/grain-128.png
npm run gen:og       # regenerate public/og-image.png (needs Playwright + Chromium, see scripts/make-og.mjs)
```

`gen:layout` needs Node 22.18 or later (native TypeScript stripping). `node scripts/gen-layout-css.mjs --check` reports drift without writing.

## Architecture pointers

- `src/scroll/`: the chapter map, a plain mutable store, the director (scrollY → film position F ∈ [0, 9]) and anchor measurement. Nothing reads layout per frame and React never re-renders per frame.
- `src/field/`: `layout.ts` is the single source of truth for anchor boxes; `index.ts` boots and ref-counts the one WebGL context; `engine.ts` renders; `states/` holds the pure generators for S0–S10; `fallback2d.ts` is the Canvas2D path.
- `src/chapters/` and `src/pages/`: the DOM chapters and routes. All copy lives in `src/content/`.
- `src/motion/`: tokens (safe in the initial bundle) and the lazy GSAP / Lenis runtime.

Every path shows the same content: full desktop (Lenis, sticky stages, WebGL), full mobile (native scroll, field slots), reduced motion (flow layout, still posters), no WebGL (Canvas2D), forced colours (no field) and no JS (CSS glow backdrop).

## Debug and QA parameters

| Param | Effect |
|---|---|
| `?debug=field` | Overlay: film position, segment, tier, fps, safe rects, anchor boxes, S1 glyph dots |
| `?debug` | Exposes `window.__field` and `window.__lenis`; allows software GL |
| `?film=<F>` | Pins the film position (no damp, no intro) |
| `?tier=high\|mid\|low` | Forces a render tier; allows software GL |
| `?intro=0` | Skips the intro |

Dev builds always expose `window.__field` and `window.__lenis`. Headless Chromium renders the field with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`); timings there show relative cost, not real frame rates.
