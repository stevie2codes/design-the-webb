# QA results (SPEC §12 step 9)

Headless audits of a production build (`npx vite build`, `vite preview`), Chromium from Playwright. WebGL runs on SwiftShader, so absolute timings overstate GPU and shader-compile cost; read them as relative costs. Scripts live in the gitignored `.qa/` folder: `audit.mjs` (budgets, axe, perf), `audit-contrast.mjs`, `audit-cls.mjs`, `audit-fontcls.mjs`, `audit-profile.mjs` (CPU profile attribution for long tasks).

Run: 2026-09-29, working tree on top of `f380c9f` (phase 4 integrated, then the final review fixes below). The sections below the checklist come from the meta/perf pass; figures that changed at integration or in the final review are updated inline.

## §12 acceptance checklist (phase 4 integration)

Build `npx vite build --outDir .qa/dist-int`, served by `vite preview` on port 4310, headless Chromium (Playwright) with SwiftShader WebGL. Only Chromium is installed here: **Safari and Firefox were not run**. SwiftShader rasterises on the CPU, so absolute frame times are not representative of a GPU; they are used as relative costs. Evidence paths are under `.qa/int/` (gitignored), and the scripts that produced them sit beside them.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | JS off: all copy visible, chart SVG bars show, every link works | **Pass** (final review: the mobile nav gap is fixed) | `nojs.mjs` → `nojs.json`. Six routes at 1440 and 390: `html.no-js`, the h1 present, every non-decorative text node visible. The chart's `.chart-bars` shows 3 rects at both widths. 14 internal hrefs resolve to 200 non-404 files, and every `#hash` exists. **Mobile nav without JS** (was: no nav at all below 768px): the header is in flow and shows a second row of the four chapter links, each ≥ 44 × 44 (`.qa/fin/nojs.mjs`, 390 × 844 and 360 × 640, `/`, `/work/pulse`, `/work/nope`; header bottom 100px, first content below it; `.qa/fin/s/sheet-nojs.png`). Email / GitHub / LinkedIn are reachable in Contact and the footer. Only Copy and the Motion toggle need JS |
| 2 | Reduced motion (OS and footer toggle): no scrubs, no Lenis, field registered but still, Back to top instant | **Pass** | `reduced.mjs`. Both paths: `html.rm`, no Lenis, 0 sticky stages, 0 inline-style changes across 7 scroll pairs 120px apart (no scrubs), 0 field renders in 2s at rest, all 10 anchors registered (size Δ 0px). Back to top reads scrollY 0 within the first 50ms sample. Toggling back to Full brings Lenis back. Sheet `sw-reduced.png` |
| 3 | WebGL off, and after `WEBGL_lose_context` twice: the Canvas2D fallback shows identical content | **Pass** | `.qa/fb/triggers.mjs`: flags, a feeble device and a blocked engine chunk each give canvas2d; with the fallback chunk blocked too, kind 'none'. `.qa/fb/lose.mjs` → `lose-*.png`: loss 1 shows the fallback, restore returns to WebGL, loss 2 keeps canvas2d, 1 context throughout. Final review: after loss 2 the engine no longer asks for a restore (`.qa/fin/toggle.mjs`: `restoreContext()` now logs "context restoration not allowed" and the GL counters stay at tex 48 / fb 6, where three used to rebuild to 52 / 9 on a dead context). The DOM stand-ins (emblem outlines, NDA slabs, stack plates, beacon shell, 404 hairline) now hide under the fallback too (`field-sN:` accepts `data-field="fallback"`), so the MCP constellation and the S8 plates are drawn once, not double-exposed (`.qa/fin/s/ng-7_389vh.png`, `ng-9vh.png`). `samecontent.mjs`: `<main>` text and links identical in WebGL and no-WebGL runs, apart from the aria-hidden animated ROWS counter |
| 4 | Name registration ≤ 1px in Chrome, Safari, Firefox at 390 / 1280 / 1440 / 1920 | **Open.** Chromium: vertical ≤ 1px at every size (fixed); horizontal ≤ 1px at rest, with transient luminance-centroid swings up to 1.7px. Safari / Firefox: not run (not installed here) | `.qa/fin/register.mjs` (canvas alone vs h1 alone at `?film=1&intro=0`). The final review measured 1440 at Δy −1.5 to −1.6px, which is systematic. Root cause: Chromium paints text on a device-pixel-snapped baseline, and the sampler used the fractional one from its probe (1440 × 900: 558.53 vs painted 559). `name-sampler.ts` now snaps the probe baseline to device pixels (`.qa/fin/rastercheck.mjs`: sampler raster vs DOM ink Δy at 1440 went from −0.80 to within ±0.5). The S1 idle drift is halved (.003 → .0015 su; it moved the whole centroid up to 2px over time at 1920). Luminance-centroid Δ(x, y) in px after the fix, at 3 s / 12 s after ready: 390 (−0.5, −0.2) / (−0.4, 0.5); 1280 (−0.4, −0.5) / (−0.6, −0.1); 1440 (1.3, −0.7) / (0.6, −0.4); 1920 (1.7, −0.6) / (−0.2, −0.3); DPR 2 at 6 s: 390 (0.0, −0.2), 1440 (0.7, −0.7). A 1920 time series (2 / 3 / 4.5 / 6 s: x 0.2 / 1.6 / −0.4 / −0.1) shows the x excursions are momentary luminance changes (the live shimmer), not a placement offset. Ink edges ±1–3px (the grains are 1.5–2px discs). The item stays Open until Safari and Firefox are measured on real hardware |
| 5 | Luminance behind `data-safe` never exceeds `#262A34` (L .0232) pre-scrim; axe shows no contrast failures | **Pass** | `luma-gl.mjs` (WebGL, canvas-only screenshot, every visible safe block every H/4), re-run after the final review's softer text-safe mask (the rect stays fully masked; only the feather outside it widened): 1440: 123 samples, 0 over, worst L .0212 (the Pulse panel). 390: 94 samples, 0 over, worst L .0227 (the hero lede during the Pour). A first attempt with a rounded-rect mask let one grain reach L .0255 in a block corner at 390, so the mask now runs on the Euclidean distance outside the full rect. Fallback (`.qa/fb/luma.mjs`, phase 4): 1440 worst L .0148; 390 worst L .0134 (its mask only widened since). axe (`.qa/audit.mjs`, 4 routes × 1440/390 × full/reduced): 0 violations; contrast re-run on solid backdrops: 0 failures |
| 6 | p95 frame ≤ 16.7ms on M1 (High) / ≤ 20ms on Pixel 6a (Low); no long tasks > 50ms during scroll; CLS 0; LCP ≤ 1.8s desktop | **Frame targets: not verifiable (no M1 / Pixel here); proxies pass. Long tasks, CLS, LCP: pass** | `frames.mjs`, the same wheel scroll per tier (SwiftShader rAF delta p50 / p95 in ms): High 66.7 / 333, Mid 50 / 250, Low 33.3 / 183, Canvas2D 16.7 / 16.8. So Low costs half of High, and **0 long tasks on every run**. `.qa/audit.mjs` perf gave scroll long tasks of 0 on desktop GL, intro=0, Canvas2D, reduced motion and mobile; re-checked after the final review with `.qa/fin/lt.mjs` (PerformanceObserver after load, then a full scroll): 0 on reduced motion, desktop, mobile 390, Canvas2D and Low tier. Load CLS 0 and scroll CLS ≤ 0.0001 on every run; throttled desktop CLS went from 0.036 to **0.0025** after the fallback font faces (`audit-fontcls.mjs`), and mobile throttled is 0. LCP is the `<h1>` at 200–232ms locally and ≤ 640ms throttled |
| 7 | Nav jumps: ≤ 2 states glide, further jump-cut; Back to top rewinds in 2.4s with no flashes; hash jumps | **Pass** (final review: deep links and nav from a detail page fixed) | `jumps.mjs` (re-run): top→about and about→work glide (10 / 7 scroll positions, no overlay); work→contact (6 states) and contact→about (7) jump-cut (overlay max .77 / .60, one scroll step); the rewind reaches y 0 at 2.72s with no overlay, no director cut, F monotone. **Deep links** (was: a fresh `/#contact` landed on the hero with the hash stripped): `.qa/fin/hash.mjs`, fresh loads: desktop `/#contact` → y 9450, `/?debug#capabilities` → 7740 (hold start), URL keeps its hash, no intro; reduced motion 7261 / 6210; mobile 9525 / 8201; StrictMode dev `/#capabilities` → 7740 with focus on `capabilities-title`. **Nav from a detail page** (was: every target clamped to the detail page's max scroll, 2430): `.qa/fin/navfromdetail.mjs`, direct and in-app, desktop and mobile, all 16 runs land on the chapter's hold start (desktop 1800 / 3690 / 7740 / 9450, mobile 1266 / 2854 / 8201 / 9525) with one scroll per arrival. **Back / forward to a detail page** restores that entry's y (`.qa/fin/fwd.mjs`: 300 → 300, was the page's max scroll). **Motion toggle during a jump cut** now finishes the jump in the new layout (`.qa/fin/combo.mjs`: y 7261, the reduced-flow contact top; was y 0) |
| 8 | StrictMode dev: exactly one WebGL context; home → detail → back restores scroll and state with no intermediate morphs | **Pass** | `strict.mjs` on the dev server (StrictMode) on 4310, re-run on 4315 after the final review (same result). 1 context and 1 canvas on home, on the detail page, after back, and on a fresh 404. Back restores y 5333 → 5333 and F 5 → 5. The only other frames (2 × F 0 as the home route mounts) are drawn under the jump-cut overlay at opacity 1, and the overlay then fades. `strict-before.png` = `strict-back.png` |
| 9 | 360×640, 390×844, 844×390, 820×1180: no text/shape overlap; touch targets ≥ 44px | **Pass** (final review: collapsed wordmark fixed) | `.qa/mob/audit.mjs` at all four: 0 horizontal overflow, 0 targets < 44px (48 checked), 0 anchor ∩ `[data-safe]` overlaps, slots 52/44/42/44svh. `textoverlap.mjs` reports only non-defects: line-box leading between lines of one heading; content scrolling under the fixed nav; the masked (invisible) h1 during the Pour on 844×390; and the h1 box under the eyebrow on 820 while the name shows as bokeh. Checked by eye in `l844-585.png`, `t820-0.png`, `m360-*.png` and sheets `sw-360.png`, `sw-390.png`, `sw-844x390.png`, `sw-820.png`. The load-time audit missed the collapsed "SW" wordmark (33px wide past 190vh): it now keeps `min-w-11`, 44 × 44 collapsed at 1440, 390 × 844 and 360 × 640 on `/` and `/work/pulse` (`.qa/fin/navw.mjs`, measured after scrolling to the end and back) |
| 10 | Every string traces to Appendix A | **Pass** | Two steps. `copytrace.mjs` (re-run): 615 rendered strings over 6 routes, including aria-labels, alts and titles, all come from `src/content/*.ts` (the 17 it cannot match literally are that module's template functions: `{title} screenshot`, `{title} live site`, `Open {title} project details`, `ROWS nn/52`, `© {year} Stephen Webb`, the uppercase footer wordmark). Then `src/content/site.ts` was diffed by hand against SPEC Appendix A's table and its microcopy list. The strings found outside it were UI-only, with no factual claims: "Menu" / "Close", "Email ↗", "SW", the rail labels ("Title" …) and their "Go to …" names, the cursor labels "Open" / "Live", the photo alts and the `{title} …` accessible names. They are now listed in Appendix A's "New UI microcopy" |
Final review sweeps (build `.qa/dist-final`, `vite preview` on 4314; all looked at): desktop natural positions `.qa/fin/s/d-*.png` (hero, Pour, About hold, the four C3 windows and their hand-overs, capabilities, contact), the lock `.qa/fin/s/lock-d.png`, 1280 × 720 About `.qa/fin/s/v1280-2_2vh.png`, mobile 390 `.qa/fin/s/sheet-m390.png`, reduced motion + `/work/nope` `.qa/fin/s/sheet-rm.png`, no WebGL `.qa/fin/s/ng-*.png`, `/work/pulse` `.qa/fin/s/dp-*.png`, `/nope` `.qa/fin/s/nf-0vh.png`, no JS `.qa/fin/s/sheet-nojs.png`. No console errors.

Phase 4 integration sweeps (contact sheets, all looked at): `sw-1440-intro.png` (intro frames at 0.3/1.2/2.4/4s, then natural wheel scroll), `sw-1920.png`, `sw-1280.png`, `sw-390.png`, `sw-360.png`, `sw-844x390.png`, `sw-820.png`, `sw-reduced.png`, `sw-nogl.png`, `sw-lose.png` (loss #1 → restored → loss #2 stays Canvas2D), `sw-work-{pulse,gov-data-generator,prmpt-art,mcp-app}{,-m}.png`, `sw-404{,-m}.png`. No console errors on any of them and 0 horizontal overflow.

Fixes made in the final review (build `.qa/dist-final`, preview on 4314; scripts and evidence in `.qa/fin/`):
- **Deep links** (`index.html`, `scroll/initialHash.ts`, `App.tsx` ScrollToHash): the pre-paint script keeps the hash in `window.__dtwHash` and expects no intro; the first refresh jumps there instantly (director snapped), focuses the heading and restores the hash.
- **Arrivals from a detail page** (`chapters/projects/route.ts`, `scroll/jump.ts`, `motion/scrollRuntime.ts`): Lenis re-measures before the target is computed; `chapterTarget` clamps to the live document; `scrollInstant` / `glide` resize Lenis first; ScrollToHash skips a home arrival that `runArrival` owns (`arrivalOwnsScroll`), which now also focuses the heading.
- **Back / forward to a detail page** restores that entry's y (`sessionStorage['dtw:route-y']`).
- **Motion toggle during a jump cut** finishes the jump in the new layout (`JumpCutOptions.retarget`).
- **Second context loss** no longer asks for a restore (`engine.ts`: a capture listener stops three's preventDefault).
- **Unknown slugs** without JS get the same "Project not found" page (`routes.ts` prerenders `work/404.html`; `public/_redirects` `/work/*  /work/404.html  404`; the `vite preview` middleware mirrors it).
- **Nav**: the collapsed "SW" keeps a 44 × 44 target; without JS on mobile the header is in flow with a row of chapter links.
- **Fallback double exposure**: `field-s2:` … `field-s9:` / `no-field-s10:` accept `data-field="fallback"` (the fallback never lists S2, so the chart's SVG bars stay).
- **Text-safe mask** (`field.vert.glsl`, `anchors.ts` `SAFE_FEATHER`, `[data-safe]::before`): a 112px outward feather on the Euclidean distance (24px for the nav band and for `data-safe="tight"` hero blocks while S1 shows), and an 80px top / bottom scrim ramp (48px tight): the dark boxes read as a soft falloff.
- **S8**: resting plates' outlines ×2.3 and +.6 CoC (was +1.2): all four plates read.
- **Pour**: S1 no longer hangs under the nav band; the letters leave with the h1.
- **C3 hand-overs**: text crossfades (exit q 0–.10, switch .08, reveal .08–.24, a 300 ms panel opacity transition); S7's entry turbulence .4 → .15; mobile project segments complete at slot top 60%.
- **Curtain halo**: S4–S6 scale clamped to [gutter, 100vw − 56px] (≈ ×1.3 at 1440); the ECG trace and the lattice steps fade out as it opens.
- **S1 lock halo**: wider, fainter glow sprites (×6.0 at α .042; Low ×4.2 at .045).
- **S2**: steel slabs are p-steel at fill .5 / edges .9; the desktop baseline is min(80svh, 100svh − 180px).
- **Statements** (About, Capabilities, Contact) line-mask in time-based (700 ms, 90 ms stagger) and reverse above their start: no sliced glyphs at rest.
- **MCP caption** fades out over the first 20% of seg7.
- **Detail emblem**: α .25 by 60svh, .12 by 120svh; live highlights are capped to 1 under a dimmed anchor.
- **S1 registration**: device-pixel-snapped baseline; S1 idle drift .003 → .0015 su.
- **Appendix A** lists the UI-only strings that were missing from it.

Fixes made during integration:
- `scroll/anchors.ts` `restRect`: safe rects are measured at the element's resting position. This removes the 16px stale MCP caption rect (item 5).
- `scroll/anchors.ts` `MASK_LEAD`: the C3 panel mask leads its text reveal (item 5).
- `field/choreo.ts`: any scroll without input ends the intro (820×1180 script / hash jump).
- `field/engine.ts` `precompile`: `compileAsync` when `KHR_parallel_shader_compile` exists.
- `index.css`: metric-matched fallback faces (CLS).
- `scripts/prerender-plugin.mjs`: per-route `og:title` / `twitter:title` / `og:url` / canonical.
- `CONTRACTS.md`: the phase 4 contracts and tuning.

## Bundle budgets (§8.5)

Sizes are Vite's gzip report in kB (1 kB = 1000 B).

| Item | Budget | Measured | Result |
|---|---|---|---|
| Initial JS (entry `index-*.js`, no static deps or modulepreloads) | ≤ 140 kB gz | 123.0 kB (final review) | Pass |
| Field chunk (`engine-*.js`: three + engine + shaders) | ≤ 170 kB gz | 163.0 kB (final review) | Pass |
| Worker (`generate.worker-*.js`) | ≤ 20 kB gz | 19.2 kB (45.6 kB raw) | Pass, 0.8 kB headroom |
| Canvas2D fallback (`fallback2d-*.js`) does not import three | no three | 9.6 kB gz; imports gsap, entry, `common`, `generation`; none contain three | Pass |
| CSS | — | 20.6 kB gz | — |
| All JS on disk | — | 389 kB gz | — |
| Archivo latin woff2 (preloaded) | 90 KB | 88.0 KiB | Pass |
| JetBrains Mono latin / Instrument Serif latin italic (swap) | 40 / 22 KB | 39.5 / 21.6 KiB | Pass |
| Font preload `<link rel="preload" as="font" type="font/woff2" crossorigin>` for Archivo latin | present | present in `index.html`, all 4 `work/*.html` and `404.html` | Pass |
| `/work/:slug` and 404 code-split | split | `ProjectDetailPage-*.js` 3.6 kB, `NotFoundPage-*.js` 1.0 kB | Pass |
| Prerendered files | every route | `index.html`, 4 × `work/<slug>.html`, `404.html`, and (final review) `work/404.html` ("Project not found", served for unknown slugs) | Pass |

Bytes transferred on a home load at 1440×900 (uncompressed from `vite preview`): JS 361 KiB with the field / 213 KiB on the Canvas2D path, CSS 20 KiB, fonts 150 KiB, other 81 KiB (grain texture plus the lazily loaded headshot).

## Meta and OG image (§9.11)

| Check | Result |
|---|---|
| `public/og-image.png` 1200×630, the S1 lock (printed name and halo), from the real build | Pass: 296 kB PNG (`npm run gen:og`; lossless re-encode, then one low bit dropped on near-black pixels to fit < 300 kB) |
| `og:image`, `twitter:image` absolute URLs `https://designthewebb.com/og-image.png` | Pass |
| `og:image:type` / `:width` / `:height` / `:alt`, `twitter:image:alt`, `og:site_name` | Added |
| Same head on every prerendered route | Pass (all 6 files). `og:url` and the OG title point at the home page on detail routes too; see shared requests |

## Caching headers (Netlify)

`public/_headers` (copied to `dist/`):

| Path | Cache-Control |
|---|---|
| `/assets/*` (hashed JS, CSS, fonts, worker) | `public, max-age=31536000, immutable` |
| `/textures/*`, `/screenshots/*`, `/photos/*`, `og-image.png`, favicons | `public, max-age=86400, stale-while-revalidate=604800` |
| `/`, `/index.html`, `/work/*`, `/404.html` | `public, max-age=0, must-revalidate` |
| `/*` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (no Cache-Control, so no rule stacks two Cache-Control values) |

Not verified against a live Netlify deploy.

## axe-core 4.x (§8.1)

Every route at 1440×900 and 390×844 (mobile emulation), full motion and reduced motion (16 runs). The script walks the whole page first so every reveal has fired.

| Route | Violations (all 4 runs) | Incomplete |
|---|---|---|
| `/` | 0 | color-contrast 91–114 (text over the canvas); `aria-valid-attr-value` 1 at 390 (menu button `aria-controls` → the inert menu dialog) |
| `/work/pulse` | 0 | color-contrast 21–29; same menu-button item at 390 |
| `/work/mcp-app` | 0 | color-contrast 21–29; same menu-button item at 390 |
| `/nope` (404) | 0 | color-contrast 13–21; same menu-button item at 390 |

axe cannot resolve a background through the canvas, so contrast was re-run with the field, atmosphere and scrims removed and the page background forced to the void (`#050507`) and then to the worst scrimmed backdrop from §2.3 (`#0B0C0F`), at 1440 and 390 on all four routes: **0 color-contrast violations**. The remaining incompletes are aria-hidden glyphs, one-character tick labels and HUD text beside pseudo-elements.

## Load and scroll performance (§8.5)

`PerformanceObserver` for `longtask`, `layout-shift` and `largest-contentful-paint`, 5 s after load, then a scripted scroll to the bottom (desktop: 100 px wheel steps every 16 ms through Lenis; mobile: `scrollTo` in 120 px steps).

| Run | Field | LCP element | LCP | Load CLS | Long tasks during load (ms) | Long tasks during scroll | Scroll CLS |
|---|---|---|---|---|---|---|---|
| Desktop 1440, intro | WebGL (mid) | `h1#top-title` | 260 ms | 0.0003 | 60, 86, 101, 355 | 0 | 0 |
| Desktop 1440, `?intro=0` | WebGL (mid) | `h1#top-title` | 232 ms | 0.0003 | 77, 101, 55, 69, 394 | 0 | 0 |
| Desktop 1440, no WebGL | Canvas2D | `h1#top-title` | 148 ms | 0.0003 | 67, 87, 58 | 0 | 0 |
| Desktop 1440, reduced motion | WebGL posters | `h1#top-title` | 244 ms | 0.0003 | 218, 68, 67, 476 | 0 (the meta/perf pass saw one 101–265 ms task, the first crossfade draw; it did not recur at integration or in the final review, `.qa/fin/lt.mjs`) | 0 |
| Mobile 390×844 | WebGL | `h1` line span "Stephen" | 220 ms | 0 | 79, 70 | 0 | 0.0001 |

Throttled network (150 ms RTT, 9 Mbps down), 3 runs each, `?intro=0`:

| Viewport | FCP = LCP | CLS |
|---|---|---|
| Desktop 1440 | 548–660 ms | 0.036 before integration → **0.0025** with the metric-matched fallback faces (540–640 ms) |
| Mobile 390 | 540–648 ms | 0 |

| Check | Target | Result |
|---|---|---|
| LCP element is the `<h1>` | h1 | Pass on every path |
| LCP | ≤ 1.8 s desktop / 2.5 s mobile 4G | Pass (≤ 0.66 s on the throttled local run) |
| No long tasks > 50 ms during scroll | 0 | **Pass** at integration on every path (desktop GL, intro=0, Canvas2D, reduced motion, mobile). The earlier reduced-motion 100–265 ms task (first crossfade draw) did not recur; its profile showed ≈ 2 ms of JS, i.e. SwiftShader GPU work, not script |
| CLS | 0 | **Pass unthrottled (0 load, ≤ 0.0001 scroll).** Throttled desktop 0.0025 (was 0.036): the swap moved "Stephen " / the lede because the generic fallbacks (DejaVu on Linux) are ≈ 10% wider; `Archivo Fallback` (regular, bold and a 75%-width bold for the h1), `Instrument Serif Fallback` and `JetBrains Mono Fallback` now match advance widths within ≈ 1% |
| TBT (sum of long-task time over 50 ms during load) | ≤ 150 ms | Canvas2D 62 ms, mobile 49 ms pass. Desktop WebGL ≈ 400 ms on SwiftShader: one 355–431 ms task is the first `renderer.render` compiling the field programs synchronously (profile: `worker.onmessage → onState → maybeReady → renderNow → renderBufferDirect`, 225 ms inside three's program link). It runs after LCP, off the critical path, and SwiftShader compiles far slower than a GPU driver, but it is the largest main-thread block on the page |

## Open items

The three meta/perf shared requests were applied at integration:
1. **Precompile.** `engine.ts` precompiles with `compileAsync` when `KHR_parallel_shader_compile` exists. SwiftShader has no such extension and links on the first draw, so the headless 355–473ms load task remains. It runs after LCP.
2. **Fallback faces.** `index.css` metric-matched fallback faces: throttled desktop CLS went from 0.036 to 0.0025. The residue is the h1 condensed fallback, which is within 2px on "STEPHEN WEBB".
3. **Route meta.** The prerender writes per-route og/twitter titles, `og:url` and canonical. The 404 keeps the home `og:url` and has no canonical.

Remaining known issues:
- **Not verified here: browsers.** Safari and Firefox registration were not run; only Chromium is installed. Item 4 stays Open until they are.
- **Not verified here: frame times.** Real M1 and Pixel 6a p95 frame times were not measured. The proxies are the relative tier costs and zero long tasks.
- **Registration x at some frames.** The Chromium luminance centroid swings up to 1.7px horizontally for a moment (the live shimmer); it is ≤ 0.6px at rest and y is ≤ 0.8px everywhere.
- **Hero eyebrow scrim.** At the S0 rest the tight 48px scrim around the eyebrow is still faintly visible as a box (it must stay tight for the S1 name 20–50px below).
- **Reverse flings on mobile.** A very fast reverse fling (≥ 3000px/s) can briefly show a slot-carried shape reappear (mobile report).
- **Sparse start of the Pour.** The first ~40% of the Pour is sparse at 820×1180 (Low tier).
- **Glides on slow machines.** On a very slow machine (≈ 6fps) a 2-state glide can trigger the director's field-only cut fade. The DOM does not flash.
- **`_redirects` and headers** are not verified against a live Netlify deploy (`vite preview` returns 200 for `/work/<unknown>`; Netlify returns 404 via the rule).
