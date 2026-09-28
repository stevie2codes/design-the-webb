# Phase 2 contracts: scroll infra ↔ field engine

These are the shared modules that the **scroll** agent (SPEC §12 step 3) and the **engine** agent (step 4) build against. SPEC.md is still authoritative. This file only pins the APIs, the owners, the units, and the order of work inside one frame.

- **Owner** means who implements the file and may change its bodies. Changing a signature or a type named here needs both sides to agree, and this file must be updated in the same commit.
- **Status**: *real* means implemented and usable now. *stub* means typed, with the body marked `TODO(phase2-scroll)` or `TODO(phase2-engine)`.
- Every module below is SSR-safe. None touches `window` or `document` at import or during render. Only `scroll/`, `field/uniforms.ts` and `field/tiers.ts` feed the director, and none of them imports `three`.

## Conventions

- **Units.** The scroll side speaks **viewport CSS px**. The engine speaks **su** (§3.1), and it converts at uniform-write time with `pxToSu()` and its own canvas size (100% × 100lvh). The only su value in the store is `fx.scanX`, which the engine owns.
- **`store.scroll.W` / `store.scroll.H`** hold the viewport width and the **100svh height in px**: the stage height, and the basis for every svh or vh offset. They are *not* the canvas height. The scroll infra writes them on init, resize and refresh only.
- **Anchor and safe-rect frames** match the `AnchorFrame` of `field/layout.ts`:
  - For a sticky chapter, positions are relative to the `.stage`.
  - For a flow chapter (mobile slots and fit-guard fallbacks included), positions are relative to the `<section>`.
  - For S0 and S10, positions are viewport px, with `chapter: 'viewport'`.
  - In every case, viewport y = local y + `stageTop(scrollY, chapter)`.
- **Clock.** `now` is `gsap.ticker.time` and `dt` is `deltaMs / 1000`, both in seconds. `fx.ripple[2]` (t0) and `film.lastCut` use the same clock. In full motion the engine sets `uTime = frame.now`. Under reduced motion it freezes `uTime` at the poster frames.
- **No per-frame allocation or layout reads** (§8.5). `tick()` returns one reused `FieldFrame`, so copy what you need and never keep the object. Measuring happens in `registerChapterRects()` at refresh only.

## Exported symbols

### `src/scroll/store.ts`: shared; the shape is frozen (§9.2)

| Symbol | Kind | Notes |
|---|---|---|
| `store` | const | The §9.2 object verbatim. The field writers are listed in the file header. |
| `FieldStore` | type | `typeof store` |
| `ChapterId` | type | Re-exported from `scroll/chapters.ts` |
| `StoreMode` | type | `'full' \| 'reduced' \| 'fallback' \| 'css'` |
| `RouteKind` | type | `'home' \| 'detail' \| '404'` |
| `ChapterRecord` | interface | `{ top, height, L, sticky, progress, active }`. The footer is recorded too, because its `top` is the sink horizon. |
| `Seg` | interface | `{ a, b, y0, y1 }` in px, with b = a + 1 |
| `FilmOverride` | interface | `{ a, b, m, snap? }`. See Director. |
| `AnchorRecord` | interface | `{ chapter \| 'viewport', cx, cy, w, h }` in px, in the chapter's frame |
| `SafeRecord` | interface | `{ chapter, x0, y0, x1, y1, panel? }`. `panel` is the C3 window, 0–3. |
| `Ripple` | type | `[x px, y px, t0 s, amp]` |
| `EnteringParams` | interface | `{ stagger, turb, path: PathId }` |
| `Vec3`, `Vec4` | type | Mutable number tuples |
| `SafeRectBuffer` | interface | `{ rects: Float32Array(24), count }` in viewport px. Maps to `uSafe[6]` and `uSafeCount`. |
| `FieldFrame` | interface | Everything the engine needs per frame. See the file for field docs. |

Type-level additions to §9.2 (the runtime shape is unchanged):

- `chapters` is typed `Partial<…>`, because it starts empty.
- `FilmOverride.snap` is added.
- `SafeRecord.panel` is added.

### `src/scroll/segments.ts`: owner scroll; status real

| Symbol | Signature |
|---|---|
| `SegEdge` | `{at:'chapter', ch, off} \| {at:'slot', state, off} \| {at:'end', off}`. `off` is in vh on desktop and svh on mobile. |
| `SegmentSpec`, `SegmentTable`, `ResolvedSegments` | types |
| `HERO_P` | `Record<LayoutMode, {p0, p1}>`, where p1 is also the lock threshold: .62 on desktop and .70 on mobile |
| `SEGMENTS` | `Record<LayoutMode, SegmentTable>`, the §4.3 tables plus the sink range |
| `FLOW_EDGES` | `{ from: 1, to: .4 }`: a chapter §4.1 makes sticky but measured as flow (C3 today, fit-guard fallbacks, short landscape phones) gets anchor-based edges — its anchor top moving from 100% to 40% of the viewport, the mobile rule |
| `edgeY(edge, s)` | `→ number \| null` |
| `resolve(s)` | `→ ResolvedSegments`. Writes `s.segments`. Call it after every refresh. Segments stay ordered and never overlap. If a chapter is missing, only the segments before it are resolved. |

### `src/scroll/anchors.ts`: owner scroll; status real (the MCP App detail re-stage is `TODO(phase6-scroll)`)

| Symbol | Signature |
|---|---|
| `NAV_BAND_PX`, `SAFE_FEATHER_PX` | constants: 64 / 56 px and 24 px |
| `stageTop(y, ch: ChapterRecord)` | `→ number`. The viewport top of the chapter's frame (§9.6). |
| `isStageSticky(stageEl)` | `→ boolean`. Reads computed style, so call it at refresh only. |
| `registerChapterRects(id, stageEl, s = store)` | `→ void`. **Refresh only.** Measures `[data-field-anchor]` and `[data-safe]`. |
| `clearChapterRects(id, s = store)` | `→ void`. Call it on unmount or route change. |
| `anchorCenter(id, s, out)` | `→ [x, y]` in viewport px. An unmeasured state falls back to its `layout.ts` box, treated as viewport-framed. |
| `anchorTransform(id, s, out: Vec4, disperse?)` | `→ [x px, y px, scale, alpha]`. Applies the S9 sink and the S4–S7 curtain; in route mode, the detail-page anchor with its scroll parallax and dimming. |
| `svhPx()` | `→ number`, 100svh in px (measured once per refresh; browser only) |
| `createSafeRectBuffer()` | `→ SafeRectBuffer` |
| `activeSafeRects(s, out?)` | `→ SafeRectBuffer`. The nav band, then the 5 on-screen blocks nearest the centre. In the stuck C3 stage, only the active panel's blocks count. |

### `src/scroll/director.ts`: owner scroll; status real

| Symbol | Signature |
|---|---|
| `FILM_MAX`, `MAX_DT`, `FILM_HALF_LIFE`, `JUMP_CUT`, `LOCK`, `FX_DUR`, `MOUSE_RATE` | constants (§4.3, §4.4, §9.5, §3.7) |
| `filmTarget(y, segs)` | `→ number` (§9.4) |
| `enteringParams(id)` | `→ Readonly<EnteringParams>`, from `STATE_PARAMS` |
| `segAperture(seg, m)` | `→ number` (§3.9 segment-shaped aperture) |
| `filmOverride(F, snap?)` | `→ FilmOverride`, a home pair for position F |
| `signalToNoise(aperture, turb)` | `→ number`, the §6 HUD formula |
| `hudSignal(frame)` | `→ number`. Rest reads 0.03 and every hold reads 1.00. |
| `setFilmCeiling(k)` | `→ void`. **The engine calls this** each time S0…Sk are all resident (§9.9). |
| `snapFilm(s)` | `→ void`. Sets displayed F to target now: the nav jump-cut step 3, and the resync after returning from a detail page. |
| `createFieldFrame()` | `→ FieldFrame` |
| `frame` | `Readonly<FieldFrame>`, the last frame produced. HUD and debug read it at ≤ 10 Hz. |
| `tick(s, dt, now)` | `→ FieldFrame`. The engine's `renderFrame` calls it once per tick. |
| `hudSignalAt(F)` | `→ number`: S/N at film position F without a frame (the HUD before the engine's first frame, and without WebGL) |
| `filmTargetOf(s)` | `→ number`: the store's undamped film target (override, else scroll) |
| `enterRoute(s, kind, slug?, pair?)` | Each page calls it on mount. `'home'`: coming from another route, clears the route override (a home mount on the home route keeps the intro's override and the `?film` pin). `'detail'`: `{ a: emblem, b?: nextEmblem }` at m = 0 (UI tweens `override.m`: .25 peek, 1 commit). `'404'`: `{ FLATLINE, FLATLINE, 0 }`, aperture .5 → .04 with the damped `fx.charge`. |
| `posterState(s)` | `→ StateId`: reduced motion's poster — the state of the chapter that has crossed 50% of the viewport (C3 per panel) |
| `POSTER_FADE` | .4 s, the reduced-motion crossfade |

What `tick` does, by override:

- **No override:** F* = `filmTarget(scrollY)`, then the jump cut (the director folds its fade into `frame.opacity` and never writes `fx.opacity`), then the 120 ms damp (60 ms while rewinding).
- **Override with `b = a + 1` on the home route:** F* = a + m, as used by the intro.
- **Override with `snap`:** no damp and no cut. Used by `?film=` and resyncs.
- **Any other override, or a route other than home:** route mode. The frame shows (a, b) directly, with `seg = −1`.
- **Reduced motion (`store.mode === 'reduced'`, no override):** posters. (a, b, mix) is a **crossfade**, not a morph: the engine draws A alone at α·(1 − mix), then B alone at α·mix (two passes, each state on both sides of the pair at mix 0, with its resting aperture). `seg = −1`, S = T = 0, path DEFAULT; `settled` is false only while a 400 ms fade runs, so the engine keeps rendering until it is true. There are no lock edges: the engine shows S1 printed (`fx.printed = 1`) without the beam. The poster never passes the film ceiling (until S2–S9 exist it is S1).

### `src/field/uniforms.ts`: owner engine; shared data, no `three`

| Symbol | Notes |
|---|---|
| `PathId` | const and type: DEFAULT 0, POUR 1, TOPPLE 2, DIGITIZE 3, DEAL 4, SPIRAL 5 (`uPath`) |
| `MouseMode` | const and type: LOUPE 0, PUSH 1, ATTRACT 2 |
| `Role` | const and type: the §3.4 meta roles 0–9 |
| `LIMITS` | `{ safeRects 6, groups 8, barPivots 3, palette 5, texW 256 }` |
| `PaletteStop`, `PALETTE`, `CLEAR_COLOR` | §2.1 particle ramp |
| `IdleParams`, `StateParams`, `STATE_PARAMS` | §3.9, keyed by `StateId`: density, idle amp/freq/speed, resting aperture, mouse, and enter {S, T, path}. The stagger *key* belongs to the generator. |
| `CAMERA_Z`, `pxToSu(x, y, W, H, out)`, `suPerPx(H)` | §3.1. W and H are the **canvas** CSS size. |
| `FIELD_GAIN` | Global exposure (shader define): multiplies every particle's α. §3.6 fixes relative brightness only; 3 is the calibrated absolute scale. |
| `POSTER_TIME` | Per state, the `live()` clock frozen under reduced motion (§3.10 poster frames); 0 until each generator phase sets its key frame |
| `SCAN_OFF` | −1e4 su: `fx.scanX` when no beam runs |

Adding a state takes three things: a generator in `states/sNN-*.ts`, a `live()` case in the shader, and one `STATE_PARAMS` row.

### `src/field/tiers.ts`: owner engine; status real (table, rule, warm-up probe, adaptive governor)

`TierName`, `TIER_ORDER`, `TierSpec`, `TIERS` (the §3.2 counts), `BOKEH_SHARE`, `TierEnv`, `pickTier(env) → TierName`, `dprCap(tier, cores)`, `isFeebleDevice(env)`, `readTierEnv()` (browser only), `PROBE`, `ADAPTIVE`, `AdaptiveStep`.

### `src/field/index.ts`: owner engine; status real (the Canvas2D fallback is `TODO(phase8-engine)`)

| Symbol | Signature |
|---|---|
| `FieldMode` | `'full' \| 'reduced'` |
| `FieldKind` | `'webgl' \| 'canvas2d' \| 'none'` |
| `PauseReason` | `'hidden' \| 'menu' \| 'context-lost' \| 'route' \| 'debug'`. Pauses are counted per reason. |
| `FieldBootOptions` | `{ mode, layout, tier, debug, intro, softwareGL }` |
| `FieldHandle` | `{ kind, tier (getter), setMode, pause, resume, invalidate, onReady(cb) → unsubscribe, dispose }` |
| `FieldDebugHandle` | `{ store, frame, tier, kind }`. This is `window.__field`. |
| `CreateField<Ctx>` | `(canvas, ctx, opts) → Promise<FieldHandle>`. `./engine` must export `createEngine: CreateField<WebGL2RenderingContext>`. |
| `glAttributes(softwareGL)` | `→ WebGLContextAttributes` (§3.4) |
| `defaultBootOptions(mode, layout)` | `→ FieldBootOptions`, built from the QA params |
| `bootField(canvas, opts)` | `→ Promise<FieldHandle>`. Never throws. It creates the context **on the host canvas**, so there is exactly one WebGL context, and then `import('./engine')`. |
| `acquireField(canvas, opts)` / `releaseField()` | Ref-counted. The last release disposes after one macrotask, and a re-acquire cancels that (StrictMode-safe, §9.10). Sets `window.__field`. |
| `getField()` | `→ FieldHandle \| null`, synchronously (code outside React: the reduced-motion scroll listener, the menu, QA) |
| `FieldHandle.ready` | three loaded, fonts loaded, S0 + S1 built, one frame rendered (§6) |
| `FieldHandle.intro` | `{ run(): Promise<void>, skip(), running }`: the §6 intro (it runs by itself; any wheel / touch / key / pointerdown skips it) |
| `FieldHandle.print(on)` | Force the §9.5 print (normally automatic from `frame.lockEdge`) |
| `FieldHandle.stats()` | `→ FieldStats \| null`: tier, texture tier, drawRange, dpr, glow, bokeh cap, fps, rendered frames, canvas and generated-for size, film ceiling, resident states, adaptive steps fired, context-loss state, S1 source / font / ms / scale (the S1 anchor's width now ÷ at sampling: 1 when registered, see below) |
| `INTRO_ATTR`, `isIntroPending()`, `clearIntroPending()` | `html[data-intro]`: `"pending"` is the pre-paint script's guess that the §6 intro will run (JS, not rm, `/`, no `?intro=0` / `?film`, no forced colors); the engine replaces it with `"running"` (choreo) or drops it (`clearIntroPending`: no intro, dispose), and so does FieldCanvas when no renderer starts or forced colors are on. The HUD reads 1.00 while it is pending. |
| `FieldDebugHandle.ready`, `.stats()` | QA waits with `waitForFunction(() => window.__field?.ready)` |

`FieldCanvas` (field/FieldCanvas.tsx) is the only mount: `#field-root` with one aria-hidden `<canvas style="opacity:0">` (identical on the server). It acquires in an idle callback (≤ 800 ms), releases on unmount, forwards the motion preference to `setMode`, subscribes `invalidate()` to every scroll write (`subscribeScroll`), samples the HUD once the field is ready, and sets `store.mode = 'css'` when no renderer starts (kind `'none'`: the CSS glow on `body::before` stays the backdrop). Under `forced-colors: active` it never boots the field (and releases a running one when the mode turns on; it boots again when it turns off); index.css unmasks the `<h1>` and hides the canvas, the atmosphere, the scrims and the scroll cue there.

Engine boot details: it bootstraps `store.scroll.W / H` only if they are still 0, and sets the `?film` override only if the scroll side has not (same value). Worker jobs carry `GenerateRequest.supersede` (default true: a new job drops the queue; lazy single-state jobs pass false and queue behind it).

Engine runtime details:

- **S1 registration (§9.8).** S1 registers to the DOM glyphs, not the viewport, and the `<h1>` rescales with `--name-fs` on every resize — below the §9.7 regeneration thresholds too. Each `NameSample` records the S1 anchor size it was sampled at (`anchorW / anchorH`). On every store refresh (and after the resize debounce) the engine compares it with `store.anchors.get(S1)`; past 0.5px it resamples S1 in place (an idle callback, two same-size texture uploads, the set's generation size kept). Until that lands, S1's `uOff.z` (and the beam's `nameSpan`) is multiplied by `anchorW now / anchorW sampled`, so the interim frame is registered too. A pending regeneration resamples S1 into its own set instead.
- **Reduced motion is on demand (§8.2, §8.5).** `renderFrame` leaves the gsap ticker once a frame finds the field settled with no invalidation window open, so gsap's autoSleep stops the rAF loop at rest. `invalidate()`, `wake('scroll' | 'state')`, `setMode`, `resume` and a context restore put it back (`gsap.ticker.add` wakes a sleeping ticker). Invalidations open their 300 ms window on the next frame's clock, because `gsap.ticker.time` is stale while the ticker sleeps. Full motion keeps `renderFrame` on the ticker for good.
- **DPR follows the screen.** A `(resolution: Ndppx)` query, re-armed after each change, updates the renderer's pixel ratio (`min(devicePixelRatio, the tier cap)`) when the window moves to another screen or the zoom changes — unless the adaptive `dpr` step has fired.
- **Context restore** re-applies the void clear colour: three's `initGLContext()` rebuilds `WebGLBackground` with black.

### `src/debugParams.ts`: shared; status real

| Symbol | Signature |
|---|---|
| `DebugParams` | `{ debug, field, film, tier, intro, softwareGL, expose }` |
| `DEFAULT_DEBUG_PARAMS` | The server-side and no-params value |
| `parseDebugParams(search, dev?)` | pure |
| `getDebugParams()` | Cached per page load. Returns the defaults on the server. |
| `DebugGlobals`, `exposeGlobal(key, value)` | `→ remove()`. Declares `window.__lenis` and `window.__field`. |

## QA URL parameters

| Param | Effect | Who applies it |
|---|---|---|
| `?debug=field` | §12 overlay: F, segment, tier, fps, safe rects, anchor boxes, S1 glyph dots | engine (`field/debug.ts`) |
| `?debug` (any value) | exposes `window.__lenis` and `window.__field`; allows software GL | both |
| `?film=<F>` | At init: `store.film.override = filmOverride(F, true)` and `flags.intro = false`. No damp, no cut. The lock still needs hero p ≥ p1, so scroll there if you want the printed name. | scroll |
| `?tier=high\|mid\|low` | forces the tier; allows software GL | engine |
| `?intro=0` | skips the intro | engine |

Dev builds always expose the globals. `?tier=…` or `?debug` create the context without `failIfMajorPerformanceCaveat`; headless Chromium here (SwiftShader, `--use-angle=swiftshader --enable-unsafe-swiftshader`) renders WebGL2 without either, but a stricter software GL may need one of them to avoid the fallback.

QA scripts (gitignored `.qa/`): `shoot.mjs` (scroll positions, `--mobile --reduced --nogl`), `engine/shot.mjs` (waits for `__field.ready`; `--dpr`, `--clip`, `--scroll`), `intro.mjs` (frames at fixed times after `html[data-intro="running"]`), `interact.mjs` (nav jump cut, runtime motion toggle, rewind, detail route and back).

## Order within one gsap tick (§9.5)

Registration:

- The scroll infra calls `gsap.ticker.add(lenisRaf, false, true)`. **prioritize = true**, so it runs first whenever it is added.
- The scroll infra calls `gsap.ticker.lagSmoothing(0)`.
- The engine calls `gsap.ticker.add(renderFrame)` at normal priority, after gsap-core's own `Timeline.updateRoot`.

Each tick then runs:

1. **`lenisRaf(time)`** → `lenis.raf(time * 1000)` sets the window scroll, and Lenis fires `'scroll'`:
   - `store.scroll.y = l.animatedScroll`
   - `store.scroll.vel = l.velocity`
   - `ScrollTrigger.update()`
2. **Inside `ScrollTrigger.update()`**, synchronously:
   - Scrubbed DOM (`scrub: true`, `ease: 'none'`).
   - Chapter `onUpdate` writes `chapters[id].progress` and the scrubbed fx (`disperse`, `sink`).
   - `onToggle` writes `active`.
3. **`Timeline.updateRoot`** renders every time-based gsap tween. Examples: the print tween writing `fx.scanX` and `--scan`; `fx.printed`, `fx.exposure` and `fx.nova`; the UI's charge and groupW targets. The §6 intro timeline runs on its own clamped clock instead: its stepper is registered **prioritized** (`gsap.ticker.add(stepIntro, false, true)`), so it runs at the very start of the tick — before `lenisRaf` — and the same tick's `renderFrame` draws its beam, `printed` and override `m` in the paint that shows its `--scan`.
4. **Other normal-priority listeners**, such as the cursor ring and the ≤ 10 Hz HUD sampler. Their relative order doesn't matter, because they read the previous frame.
5. **`renderFrame(time, deltaMs)`** (engine):
   1. `const f = director.tick(store, deltaMs / 1000, time)`. This computes F, the pair, entering params, aperture, anchor transforms, safe rects, the damped fx and pointer, and the lock edge. The director damps fx here, *before* the uniform writes, which removes the one-frame lag of the §9.5 order.
   2. React to `f.lockEdge`:
      - **+1:** the 900 ms `cine` print tween (§9.5).
      - **−1:** unprint, 120 ms.
      - Skip the beam while `flags.rewinding`.
   3. Uniform writes. `offA`, `offB` and `mouse` pass through `pxToSu()`. `uSafe` takes `f.safe.rects` as-is.
   4. `renderer.render` for the main pass, then the glow pass.
   5. Idle throttle: 30 fps after 6 s of `f.settled`, with no scroll or pointer. Skip the render while paused (`hidden`, `menu`).

`onRefresh` never runs per frame. It is the only place that reads layout:

1. `store.chapters[id] = {…}`
2. `registerChapterRects(id, stage)`
3. `segments.resolve(store)`
4. `store.version++`, after which the engine regenerates if needed.

Under reduced motion there is no Lenis. A passive `scroll` listener writes `store.scroll.y` and calls `handle.invalidate()`, and the engine renders on demand.

## Scroll-side modules and components (phase 2)

### `src/motion/lenis.ts`: owner scroll; status real

**The motion layer is lazy (§8.5 initial JS ≤ 140 KB gz).** gsap, ScrollTrigger and Lenis never enter the initial bundle:

- `motion/lenis.ts` is the **facade** in the initial bundle: the API below, the listener sets (`subscribeScroll`, `onScrollRefresh`, `onSample`) and native fallbacks. It imports neither `gsap` nor `lenis` (types only).
- `motion/scrollRuntime.ts` is the lazy chunk with the implementation (Lenis, the ScrollTrigger wiring, the scrollTo helpers, the sampler scheduling). `useSmoothScroll()` loads it right after hydration; the facade delegates once it has loaded. Before that (or if the chunk fails) `glide` / `jumpCut` / `rewind` / `scrollInstant` scroll natively and instantly, `requestRefresh` is a no-op (the runtime's start refreshes), `getLenis()` is null and `isSmooth()` false.
- `motion/lazy.ts`: `loadGsap()`, `loadScroll()`, `loadReveal()` (cached promises, retry after a failed load), `scrollRuntime()` (sync, null until loaded), `reportLoadError`.
- `motion/gsap.ts` is itself lazy-only: gsap + ScrollTrigger, the four custom eases registered with `gsap.registerEase` from `motion/tokens.ts` (a cubic-bézier solver; no CustomEase), `ScrollTrigger.config({ ignoreMobileResize: true })`. Only lazy chunks import it statically (the scroll runtime, the field engine, the reveal helpers). Initial-bundle code gets it through `loadGsap()` (Nav's menu fade, CursorRing's ticker).
- `motion/tokens.ts` (initial bundle, pure): `EASE`, `DUR`, `LOOP`, `BEZIER`, `cubicBezier()`.

| Symbol | Signature |
|---|---|
| `useSmoothScroll()` | Mount once in the App shell (`<ScrollInfra />`, first). Loads the runtime; ref-counted, StrictMode-safe (acquire / release chain on the same promise, so their order holds). |
| `LENIS_OPTIONS` | (in `scrollRuntime.ts`) §7.6 plus `respectReducedMotion: false` (the site resolves reduced motion itself; a visitor who chose Full on a reduced-motion OS still gets smooth scroll) |
| `getLenis()`, `isSmooth()`, `scrollLimit()` | Access |
| `glide(y, { duration?, onComplete? })` | §4.4 glide, 1.2 s expo.inOut; instant without Lenis |
| `jumpCut(y, { onCut? })` | §4.4 jump cut: overlay in 300 ms → immediate scroll + `ScrollTrigger.update()` + `snapFilm` → overlay out 400 ms. It never tweens `fx.opacity` (the opaque z-60 overlay already covers the canvas). |
| `rewind(opts)` | Back to top, 2.4 s with `flags.rewinding`; any wheel / touch / scroll key / pointerdown hands control back |
| `scrollInstant(y)` | Immediate scroll that cancels a running Lenis animation (use it instead of `window.scrollTo`) |
| `subscribeScroll(fn)` | After every `store.scroll` write and every refresh |
| `onScrollRefresh(fn)` | After every ScrollTrigger refresh (store already updated) |
| `onSample(fn)`, `sampleNow()` | ≤ 10 Hz sampler (ticker in full motion, scroll-driven under reduced); `sampleNow` runs every sampler once |
| `requestRefresh()` | One coalesced `ScrollTrigger.refresh()` two frames later |
| `registerJumpCutOverlay(el)` | JumpCutOverlay registers its element |
| `GLIDE_S`, `FOCUS_GLIDE_S`, `JUMP_CUT_FADE` | 1.2 s, .6 s, { in .3, out .4 } |

Wiring (§9.5): `gsap.ticker.add(lenisRaf, false, true)`, `lagSmoothing(0)`; the Lenis `scroll` event writes `store.scroll.y / vel` and calls `ScrollTrigger.update()`. `scroll.W / H` are measured at `refreshInit`; every refresh re-measures the footer record (the sink horizon) and the limit, runs `resolve()` and bumps `version`. Refresh points: fonts ready and every later `loadingdone`, window `load`, each home mount, motion or layout switches. It applies `?film=` at init and exposes `window.__lenis` (dev or `?debug`).

### `src/motion/reveal.ts`, `src/scroll/useChapter.ts`, `src/components/Chapter.tsx`: owner scroll

- `lineMask(el, opts)` and `fadeUp(els, opts)`, scrubbed or timed; both return a `Reveal` (`complete()`, `revert()`) or `null` under reduced motion. `reveal.ts` registers SplitText and is its own lazy chunk: never import it statically from initial-bundle code; chapters get the helpers from their context.
- `useChapter(id, sectionRef, stageRef, { onProgress, reveal })`, `ChapterContext` (`gsap`, `ScrollTrigger`, `lineMask`, `fadeUp`, `window(el, from, to)`, `track()`, `isSticky()`), `REVEAL_WINDOWS`. `<Chapter>` forwards `onProgress` and `reveal`; the fit guard requests a refresh when it flips.
- useChapter builds, once the runtime has loaded, **one `gsap.context` scoped to the section**, rebuilt (reverted) when reduced motion or the layout changes and on unmount — the §9.10 `useGSAP({ scope, dependencies })` rule without `@gsap/react`, which would pull gsap into the initial bundle. It loads the reveal chunk only when the chapter has `[data-reveal]` elements or a `reveal` callback (full motion); otherwise `ctx.lineMask` / `ctx.fadeUp` return null.
- Declarative reveals: `data-reveal="lines" | "up"`, optional `data-reveal-window="from,to"` (viewport %) and `data-reveal-timed`. Focus-in (§8.1) completes a chapter's reveals and glides to its hold (C3: the focused panel's window hold). **Never line-mask `ChapterHeading`**: SplitText's `aria: 'auto'` would put the hidden "01 — " into the accessible name.
- Phase 2 uses reveals only where §5 C0 has them — none: the hero's eyebrow, lede and CTAs never move, and the scroll cue fades through `onProgress` (p .02 → .08). The other chapters' `data-reveal` attributes (About, NDA, Capabilities, Contact per §5) land with their choreography in phase 3.

### `src/scroll/jump.ts`, `src/scroll/chapters.ts`: owner scroll

`chapterTarget`, `jumpTargets`, `activeJumpIndex`, `jumpKind`, `jumpToY(y, onArrive?)`, `jumpToChapter(id)` (§4.4 policy: ≤ 2 film states glide, else cut; the policy compares the film positions derived from the current and target scroll, not the displayed F), `focusQuietly`, `isQuietFocus`, `focusChapterHeading`, `JUMP_ORDER`, `GLIDE_MAX_STATES`, `onJumpLinkClick`. `chapters.ts` adds `CHAPTER_STATE` (each chapter's reduced-motion poster) and `PROJECT_HOLD_Q` (.56).

The App's `ScrollToHash` routes every route-change scroll through these: no hash → `scrollInstant(0)` (not on POP); a jump id → `jumpToChapter`; any other hash → `jumpToY(top, () => focusQuietly(heading))`.

### UI ownership

- **Nav** owns `flags.menuOpen` and the menu's `fx.opacity`: opening fades `fx.opacity` to .3 over 400 ms, then sets `menuOpen` (the engine stops its loop 450 ms later); closing clears it immediately. Nav publishes `html[data-active-chapter]`.
- **HUD, Rail, Nav, CursorRing** run on the ≤ 10 Hz sampler / the ticker and write through refs. Until the engine's first frame (`frame.now > 0`) the HUD derives S/N from the scroll-driven film target; under reduced motion it does not damp.
- **Pages** call `enterRoute` on mount (HomePage `'home'`; ProjectDetailPage its emblem pair or `{ a: STATIC }`; NotFoundPage `'404'`, whose CTA hover / focus sets `fx.charge` 1 / 0).
- **App shell order** (§9.1): `ScrollInfra`, SkipLink, `FieldCanvas`, Atmosphere, Nav, Rail, Hud, ScrollToHash, `<main>`, Footer, `JumpCutOverlay`, `CursorRing`.

### `html` attributes set at runtime

| Attribute | Set by | Meaning |
|---|---|---|
| `data-field="live"` | engine | The WebGL field is drawing (scrims on, `field-live:`) |
| `data-field-states="0 1 …"` | engine | Resident state ids. The `field-s2:` … `field-s9:` and `no-field-s10:` variants hide each DOM stand-in (chart SVG bars, NDA slabs, emblem outlines, stack plates, beacon shell, the 404 hairline, the ROWS counter's visibility) only once **its own** state draws, so a state whose generator has not landed never leaves a hole. |
| `data-tier` | engine | Drawn tier (animated grain on High) |
| `data-intro="pending"` | pre-paint script (index.html) | The §6 intro is expected; the `intro:` variant hides the scroll cue (a CSS failsafe shows it after 4 s), the HUD reads 1.00. Dropped by the engine / FieldCanvas when no intro follows. |
| `data-intro="running"` | engine | The §6 intro runs; the `intro:` variant hides the scroll cue until it ends |
| `data-active-chapter` | Nav | For CSS hooks |

## Tuning notes (phase 2 visual QA)

Tuned on headless SwiftShader screenshots at 1440×900 (DPR 1 and 2, High and Mid) and 390×844 (Low), judged for the hero's cold open, rack focus, lock and halo. Everything else follows §3. Where a value departs from the spec, the spec number is noted in the source next to it.

| Where | Value | Spec | Why |
|---|---|---|---|
| `uniforms.ts` `FIELD_GAIN` | 3 | — (absolute scale unspecified) | Engine phase: §3.6 literally leaves S0 invisible and S1 very dim |
| shader α falloff (`BOKEH_FALLOFF`) | `α / grow^1.3`, grow = drawn / base size | `α / dof^1.6` | Light is conserved once the cap binds (engine phase: growth actually drawn); 1.3 instead of 1.6 so the lens discs read as soft light, not a dark haze |
| shader bokeh cap spread (`BOKEH_SPREAD`) | eligible points cap at `uBokehCap × mix(.5, 1.5, aSeed.w / .35)` (mean = the tier cap) | one cap per tier | Discs of many sizes instead of one: the defocused volume gains depth. Adaptive downgrade still lowers `uBokehCap` first. |
| frag lens disc | plateau .42 + rim ring .5 (d .6 → 1) + centre .3 | plateau .55 + centre .45 ("faint rim") | Real-lens "soap bubble" rims make overlapping discs read as bokeh |
| `s00-static.ts` `BOX_SHARE` | .5 box / .5 clumps | .64 / .36 | More nebula structure |
| `s00-static.ts` `BOX_DIM` | box particles at .6 × α | — | Clumps glow in a darker volume: depth and composition instead of an even carpet of grain |
| `s00-static.ts` `SPARK_ALPHA` | `.2 + .7·r⁴` | .9 flat | Sparse embers: most smoulder, a few flare |
| `uniforms.ts` S1 density | .6 | .42 | The resolved particle name reads as bone light, not grey sand |
| `live.glsl` `NAME_GRAIN_SIZE` | glyph grains × 1.45 | 1.5px pinpoints | Same reason; still pinpoints |
| `live.glsl` printed halo | fill α → 0; edge grains become soft Gaussian sprites (`vSoft`) at size × 4.2 (× 3.0 on Low), α × .085, ramp + .08 (toward ember); band and hairline keep α ×.45 / size ×1.5 | α ×.45, size ×1.5 for all | The crisp DOM type covers every particle inside the glyphs, so the spec's halo never showed. Edge sprites bloom past the glyph edges: the printed name glows warmly, and the interior fill costs no fill rate. |
| `choreo.ts` intro clock | its own clock, ≤ 50 ms per tick, stepped first in the tick | gsap global time | `lagSmoothing(0)` (for Lenis) let one long frame (a shader compile, a busy main thread) skip the whole 2.3 s title card; now it slows down instead. The engine sets the intro override, then renders its first frame (compiling the programs, canvas still at 0), so the first visible frame and the HUD's first reading are the printed S1 (1.00). |

Phase 2 review fixes (tuned on the same setup, measured with the canvas-only luminance sampler and the `?debug=field` overlay):

| Where | Value | Spec | Why |
|---|---|---|---|
| `tiers.ts` warm-up probe (`PROBE`, `probeVerdict`) | refresh interval = p10 of the 45 deltas; slow if > 25% of frames exceed 1.5 intervals, or the interval itself exceeds 1000/48 ms | p75 > 14 ms | A rAF delta never undercuts the vsync interval: at 60 Hz (external monitors, MacBook Airs) every frame is 16.7 ms however light the load, so the literal rule demoted every such High desktop to Mid. The new rule judges dropped frames; 60–144 Hz at every vsync → ok, a steady 30 fps render or ≥ 25% drops → slow. |
| shader text-safe mask (`SAFE_ALPHA_MAX`) | α ×.22 as specced, then capped at an absolute .06 (and no extra brightness) inside a rect | ×.22 only | After `FIELD_GAIN` 3 one crisp S1 grain kept ~.4 α behind text; the sampler read up to `#5b5959` (4.3× the `#262A34` budget). With the cap the canvas-only maximum behind every hero rect stays ≤ `#222224` (L .016 vs .023; High, Mid, Low, 1440 × 900 and 390 × 844) across seg0 and the lock. |
| shader mask feather, `[data-safe]::before` feather | smootherstep over 24px (shader) and 48px (scrim, 8 eased stops) | linear 24px / 48px | Linear ramps start and stop abruptly (Mach bands): the scrimmed blocks read as hard dark boxes. Kept at the specced widths: the hero eyebrow sits 20–50px above the name's cap line, so a wider ramp dims the particle name's top. |
| shader loupe (`LOUPE_CORE`) | `loupe = amt · (1 − smoothstep(.35r, r, d))`; z → `uFocusZ` by .95·loupe; CoC → 1 by loupe; brightness +30% by loupe | z → 0 by .85·(1 − d/r)² | The quadratic pull only focused ~5–11 px around the pointer, under the 24 px ring: the loupe was invisible. Now the inner 35% of r (≈ 38 px at 900 px tall) is fully sharp with a soft edge. |
| `live.glsl` scan beam | ramp + .5 within the beam (bone → ember → p-core) as well as brightness ×2.8 | brightness only | §10 "an ember scan beam", §2.1 p-core "scan flash": the brightness-only beam read as a white band on the grains. |
