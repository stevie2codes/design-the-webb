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
| `SafeRectBuffer` | interface | `{ rects: Float32Array(24), weights: Float32Array(6), count }` in viewport px. Maps to `uSafe[6]`, `uSafeW[6]` (per-rect mask strength, 1 = the full §2.3 mask) and `uSafeCount`. |
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

### `src/scroll/anchors.ts`: owner scroll; status real

| Symbol | Signature |
|---|---|
| `NAV_BAND_PX`, `SAFE_FEATHER_PX`, `SAFE_FEATHER` | constants: 64 / 56 px; 24 px; `{ soft: 112, tight: 24 }` (per-rect outward feathers, see Tuning notes) |
| `stageTop(y, ch: ChapterRecord)` | `→ number`. The viewport top of the chapter's frame (§9.6). |
| `isStageSticky(stageEl)` | `→ boolean`. Reads computed style, so call it at refresh only. |
| `registerChapterRects(id, stageEl, s = store)` | `→ void`. **Refresh only.** Measures `[data-field-anchor]` and `[data-safe]`. |
| `clearChapterRects(id, s = store)` | `→ void`. Call it on unmount or route change. |
| `anchorCenter(id, s, out)` | `→ [x, y]` in viewport px. An unmeasured state falls back to its `layout.ts` box, treated as viewport-framed. |
| `anchorTransform(id, s, out: Vec4, disperse?)` | `→ [x px, y px, scale, alpha]`. Applies the S9 sink and the S4–S7 curtain; on a detail route S4–S7 go through `scroll/detailField.ts` `detailAnchorTransform` (detail anchor, scroll parallax and dimming, the MCP App re-stage over its spacer, the 700 ms home → detail hand-off, the "Next project" commit back to rest, reduced-motion registration to the header). |
| `hangInView(id, s, out)` | Home film, desktop only: clamps an endpoint's anchor centre into [nav band + h/2, 100svh − h/2] so a shape whose chapter has scrolled away rides the viewport edge while it morphs. Never S0, S1 (the Pour leaves with the h1), S2 (DOM axis registration), S10, or S9 during the sink. The director applies it to both endpoints outside route mode and posters. See Tuning notes. |
| `registerPageRects(root)` / `clearPageRects()` | Routes without chapters (detail pages, 404): their `[data-safe]` blocks in document px, `chapter: 'page'`. `activeSafeRects` reads page rects only off the home route and chapter rects only on it. |
| `svhPx()` | `→ number`, 100svh in px (measured once per refresh; browser only) |
| `createSafeRectBuffer()` | `→ SafeRectBuffer` |
| `activeSafeRects(s, out?, nameW = 0)` | `→ SafeRectBuffer` (rects, weights, feathers). The nav band, then the 5 on-screen blocks nearest the centre. In the stuck C3 stage, only the active panel's blocks count; the active panel switches at the hand-over, `floor(4p − PROJECT_SWITCH_Q)`, at q .08, inside the exit (q 0–.10). Those blocks carry a weight that follows their text (`PROJECT_TEXT_Q`: in over the reveal, out over the exit; a block at weight 0 is dropped); every other rect weighs 1. |
| `BEACON_SINK`, `beaconSinkEase(sink)` | The S9 sink's tuning (see Tuning notes) and its travel / scale progress |

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
| `snapFilm(s)` | `→ void`. Sets displayed F to target now — and the frame's damped fx (disperse, charge, groupW, focusOn) to their targets: the nav jump-cut step 3, and the resync after returning from a detail page (so it never re-grows a curtain halo). |
| `createFieldFrame()` | `→ FieldFrame` |
| `frame` | `Readonly<FieldFrame>`, the last frame produced. HUD and debug read it at ≤ 10 Hz. |
| `tick(s, dt, now)` | `→ FieldFrame`. The engine's `renderFrame` calls it once per tick. |
| `hudSignalAt(F)` | `→ number`: S/N at film position F without a frame (the HUD before the engine's first frame, and without WebGL) |
| `filmTargetOf(s)` | `→ number`: the store's undamped film target (override, else scroll) |
| `enterRoute(s, kind, slug?, pair?)` | Each page calls it on mount. `'home'`: coming from another route, clears the route override (a home mount on the home route keeps the intro's override and the `?film` pin). `'detail'`: `{ a: emblem, b?: nextEmblem }` at m = 0 (UI tweens `override.m`: .25 peek, 1 commit). `'404'`: `{ FLATLINE, FLATLINE, 0 }`, aperture .5 → .04 with the damped `fx.charge`. |
| `posterState(s)` | `→ StateId`: reduced motion's poster — the state of the chapter that has crossed 50% of the viewport (C3 per panel) |
| `POSTER_FADE` | .4 s, the reduced-motion crossfade |

What `tick` does, by override:

- **No override:** F* = `filmTarget(scrollY)`, then the jump cut (the director folds its fade into `frame.opacity` and never writes `fx.opacity`), then the 120 ms damp (60 ms while rewinding). The cut is a state machine (out → in): it snaps F (and the damped fx) on the first frame at or past the fade-out however late it lands, restarts the fade-in if that frame is more than half a fade-in late, and never re-arms its detector before the fade-in ends — one cut can never become several.
- **Override with `b = a + 1` on the home route:** F* = a + m, as used by the intro.
- **Override with `snap`:** no damp and no cut. Used by `?film=` and resyncs.
- **Any other override, or a route other than home:** route mode. The frame shows (a, b) directly, with `seg = −1`.
- **Reduced motion (`store.mode === 'reduced'`, no override):** posters. (a, b, mix) is a **crossfade**, not a morph: the engine draws A alone at α·(1 − mix), then B alone at α·mix (two passes, each state on both sides of the pair at mix 0, with its resting aperture). `seg = −1`, S = T = 0, path DEFAULT; `settled` is false only while a 400 ms fade runs, so the engine keeps rendering until it is true. The fx (groupW, focusOn, charge, disperse) are copied undamped — §8.2 wants no animation, and a damped value would freeze part-way once the on-demand loop stops. There are no lock edges: the engine shows S1 printed (`fx.printed = 1`) without the beam. The poster never passes the film ceiling (until S2–S9 exist it is S1).

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

Adding a state takes four things: a generator in `states/sNN-*.ts`, its live function in `shaders/live/sNN.glsl` (spliced automatically), a `case` in `live.glsl`, and one `STATE_PARAMS` row (plus its `POSTER_TIME` when its poster frame is not t = 0).

### `src/field/tiers.ts`: owner engine; status real (table, rule, warm-up probe, adaptive governor)

`TierName`, `TIER_ORDER`, `TierSpec`, `TIERS` (the §3.2 counts), `BOKEH_SHARE`, `TierEnv`, `pickTier(env) → TierName`, `dprCap(tier, cores)`, `isFeebleDevice(env)`, `readTierEnv()` (browser only), `PROBE`, `ADAPTIVE`, `AdaptiveStep`.

### `src/field/index.ts`: owner engine; status real (Canvas2D fallback in `fallback2d.ts`)

| Symbol | Signature |
|---|---|
| `FieldMode` | `'full' \| 'reduced'` |
| `FieldKind` | `'webgl' \| 'canvas2d' \| 'none'` |
| `PauseReason` | `'hidden' \| 'menu' \| 'context-lost' \| 'route' \| 'debug'`. Pauses are counted per reason. |
| `FieldBootOptions` | `{ mode, layout, tier, debug, intro, softwareGL }` |
| `FieldHandle` | `{ kind (live getter), tier (getter), setMode, pause, resume, invalidate, onReady(cb) → unsubscribe, dispose, debugSlowFrames?(ms) }`. `kind` reads `'canvas2d'` while the engine's loss overlay covers a lost context, and for good after a second loss. `debugSlowFrames(ms)` (WebGL, `?debug` only) adds synthetic frame time to what the probe and the adaptive governor measure; 0 stops it. |
| `FieldDebugHandle` | `{ store, frame, tier, kind, ready, stats(), slowFrames(ms) }`. This is `window.__field`. |
| `CreateField<Ctx>` | `(canvas, ctx, opts) → Promise<FieldHandle>`. `./engine` must export `createEngine: CreateField<WebGL2RenderingContext>`; `./fallback2d` exports `createFallback: CreateField<CanvasRenderingContext2D \| null>` (null: the host canvas already holds a WebGL context, so it draws on an overlay canvas of its own). `fallback2d.ts` never imports `three`. |
| `glAttributes(softwareGL)` | `→ WebGLContextAttributes` (§3.4) |
| `defaultBootOptions(mode, layout)` | `→ FieldBootOptions`, built from the QA params |
| `bootField(canvas, opts)` | `→ Promise<FieldHandle>`. Never throws. It creates the context **on the host canvas**, so there is exactly one WebGL context, and then `import('./engine')`. |
| `acquireField(canvas, opts)` / `releaseField()` | Ref-counted. The last release disposes after one macrotask, and a re-acquire cancels that (StrictMode-safe, §9.10). Sets `window.__field`. |
| `getField()` | `→ FieldHandle \| null`, synchronously (code outside React: the reduced-motion scroll listener, the menu, QA) |
| `FieldHandle.ready` | three loaded, fonts loaded, S0 + S1 built, one frame rendered (§6) |
| `FieldHandle.intro` | `{ run(): Promise<void>, skip(), running }`: the §6 intro (it runs by itself; any wheel / touch / key / pointerdown skips it) |
| `FieldHandle.print(on)` | Force the §9.5 print (normally automatic from `frame.lockEdge`) |
| `FieldHandle.stats()` | `→ FieldStats \| null`: tier, texture tier, drawRange, dpr, glow, bokeh cap, fps, rendered frames, canvas and generated-for size, film ceiling, resident states, adaptive steps fired, context-loss state, S1 source / font / ms / scale (the S1 anchor's width now ÷ at sampling: 1 when registered, see below), `renderer` (what draws now: `'canvas2d'` for the fallback and a covered loss) and `paint` (`{ points, dots, paints, ms, meanMs }`, the Canvas2D fallback's paints) |
| `INTRO_ATTR`, `isIntroPending()`, `clearIntroPending()` | `html[data-intro]`: `"pending"` is the pre-paint script's guess that the §6 intro will run (JS, not rm, `/`, no `?intro=0` / `?film`, no forced colors); the engine replaces it with `"running"` (choreo) or drops it (`clearIntroPending`: no intro, dispose), and so does FieldCanvas when no renderer starts or forced colors are on. The HUD reads 1.00 while it is pending. |
| `FieldDebugHandle.ready`, `.stats()` | QA waits with `waitForFunction(() => window.__field?.ready)` |

**Fallback triggers (§3.2, §8.4).** `bootField` goes to the Canvas2D fallback (`createFallback`, standalone: sets `html[data-field="fallback"]`, `store.mode` `'fallback'` or `'reduced'`, §9.7 regeneration and the S1 resample) when (1) `isFeebleDevice` (`deviceMemory ≤ 2 && hardwareConcurrency ≤ 2`, no context attempt); (2) no WebGL2 context with `failIfMajorPerformanceCaveat` (a software-only GL; `?debug` / `?tier` drop the flag); (3) the engine chunk fails to load or `createEngine` throws (the host canvas then holds a WebGL context: the fallback draws on an overlay). If the fallback fails too, the handle is kind `'none'` and the CSS glow stays.

**Context loss (engine.ts).** First `webglcontextlost`: WebGL pauses (`'context-lost'`), a `LossFallback` overlay canvas fades in and the engine's own loop paints it from the engine's cached position / meta arrays (S2 leaves `data-field-states`, so the chart's SVG bars show). `webglcontextrestored`: every texture is re-uploaded from the cached arrays, the WebGL canvas crossfades back over 400 ms, the overlay goes. A second loss stays on the overlay for good (`kind` → `'canvas2d'`). A loss before the first frame: the fallback shows, no intro. The adaptive governor is re-created after a restore or a motion toggle with the steps already fired (`new AdaptiveGovernor(fired)`), so it never steps back up.

**Fallback painter (`fallback2d.ts`).** Same generators (worker, or the main-thread runner) at Low-tier size; a uniform subsample (45 sparks + the first 1,500 shape ordinals + the dust inside that prefix), 1.5px dots in 17 ramp colours × 12 α levels, additive. Reads the same director frame as the engine (pair, mix, stagger, turbulence, the POUR / TOPPLE / DIGITIZE / DEAL / SPIRAL paths, offsets, group focus, the stack drawer, the beacon sink, dust drift); live animations frozen at their reduced-motion poster frame; text-safe rects ×.22 with each rect's feather (`f.safe.feathers`), α ≤ .045, never ember. Repaints only when the frame signature changes; under reduced motion it leaves the ticker once settled. The backing store is capped at `FALLBACK.maxPixels` (2.1 M; DPR lowered, never below 1): a full-viewport DPR 2 canvas raster cost 50–126 ms per wheel frame.

`FieldCanvas` (field/FieldCanvas.tsx) is the only mount: `#field-root` with one aria-hidden `<canvas style="opacity:0">` (identical on the server). It acquires in an idle callback (≤ 800 ms), releases on unmount, forwards the motion preference to `setMode`, subscribes `invalidate()` to every scroll write (`subscribeScroll`), samples the HUD once the field is ready, and sets `store.mode = 'css'` when no renderer starts (kind `'none'`: the CSS glow on `body::before` stays the backdrop). Under `forced-colors: active` it never boots the field (and releases a running one when the mode turns on; it boots again when it turns off); index.css unmasks the `<h1>` and hides the canvas, the atmosphere, the scrims and the scroll cue there.

Engine boot details: it bootstraps `store.scroll.W / H` only if they are still 0, and sets the `?film` override only if the scroll side has not (same value). Worker jobs carry `GenerateRequest.supersede` (default true: a new job drops the queue; lazy single-state jobs pass false and queue behind it). The boot order is route-aware: a direct hit on the 404 boots `[S0, S10]` and defers S2–S9 until the route leaves the 404 (then one `supersede: false` job). Each state's textures are uploaded (`renderer.initTexture`) when it arrives, never on the first frame that draws it (§9.9).

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
| `?debug` + `window.__field.slowFrames(ms)` | adds `ms` of synthetic frame time to the probe / governor (exercise each adaptive step); 0 stops it | engine |

Dev builds always expose the globals. `?tier=…` or `?debug` create the context without `failIfMajorPerformanceCaveat`; headless Chromium here (SwiftShader, `--use-angle=swiftshader --enable-unsafe-swiftshader`) renders WebGL2 without either (re-checked in phase 4, desktop and mobile emulation), but a stricter software GL may need one of them to avoid the fallback. Pass `?debug` anyway on QA URLs: it exposes `window.__field` / `__lenis`.

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

- `lineMask(el, opts)` and `fadeUp(els, opts)`, scrubbed or timed; both return a `Reveal` (`complete()`, `revert()`) or `null` under reduced motion. `reveal.ts` registers SplitText and is its own lazy chunk: never import it statically from initial-bundle code; chapters get the helpers from their context. `lineMask` splits with `aria: 'auto'` only on elements whose role takes a name (headings, links, buttons: `splitAria`); a `<p>` keeps `aria: 'none'`, so its line runs stay in the AX tree (ARIA prohibits naming a paragraph, and screen readers skip such a label).
- `Reveal.revert()` is idempotent and ends with a clear of every inline property the reveal wrote. useChapter's teardown runs the `reveal` cleanup, reverts the chapter's context, THEN calls `revert()` on every tracked reveal: a context revert alone can leave a from-state behind (a staggered `fromTo` built or refreshed past its window reverts to opacity 0 / y 16px in gsap 3.14; hand-written styles such as `maskOneLine`'s are re-rendered at p = 0). Track every reveal that writes inline styles; `choreo/reveal.ts` `asReveal(anim, clear)` takes the clear.
- `motion/prime.ts` `prime(anim)`: renders a scroll-driven animation to its end and back at build time, so gsap initialises its tweens (CSSPlugin computed-style and transform reads, recorded start states) then — not in the scroll frame that first reaches them (§8.5) — and inside the context being built. Every scrubbed reveal, the chart axis and ticks, the CTA disc and the C3 stage timeline are primed.
- `useChapter(id, sectionRef, stageRef, { onProgress, reveal })`, `ChapterContext` (`gsap`, `ScrollTrigger`, `lineMask`, `fadeUp`, `window(el, from, to)`, `track()`, `isSticky()`), `REVEAL_WINDOWS`. `<Chapter>` forwards `onProgress` and `reveal`; the fit guard requests a refresh when it flips.
- useChapter builds, once the runtime has loaded, **one `gsap.context` scoped to the section**, rebuilt (reverted) when reduced motion or the layout changes and on unmount — the §9.10 `useGSAP({ scope, dependencies })` rule without `@gsap/react`, which would pull gsap into the initial bundle. It loads the reveal chunk only when the chapter has `[data-reveal]` elements or a `reveal` callback (full motion); otherwise `ctx.lineMask` / `ctx.fadeUp` return null.
- Declarative reveals: `data-reveal="lines" | "up"`, optional `data-reveal-window="from,to"` (viewport %) and `data-reveal-timed`. Focus-in (§8.1) completes a chapter's reveals and glides to its hold (C3: the focused panel's window hold). **Never line-mask `ChapterHeading`**: SplitText's `aria: 'auto'` would put the hidden "01 — " into the accessible name.
- Phase 2 uses reveals only where §5 C0 has them — none: the hero's eyebrow, lede and CTAs never move, and the scroll cue fades through `onProgress` (p .02 → .08). The other chapters' `data-reveal` attributes (About, NDA, Capabilities, Contact per §5) land with their choreography in phase 3.

### `src/scroll/jump.ts`, `src/scroll/chapters.ts`: owner scroll

`chapterTarget`, `jumpTargets`, `activeJumpIndex`, `jumpKind`, `jumpToY(y, onArrive?)`, `jumpToChapter(id)` (§4.4 policy: ≤ 2 film states glide, else cut; the policy compares the film positions derived from the current and target scroll, not the displayed F), `focusQuietly`, `isQuietFocus`, `focusChapterHeading`, `JUMP_ORDER`, `GLIDE_MAX_STATES`, `onJumpLinkClick`. `chapters.ts` adds `CHAPTER_STATE` (each chapter's reduced-motion poster), `PROJECT_HOLD_Q` (.56) and `PROJECT_SWITCH_Q` (.13: the C3 hand-over, shared by `chapters/projects/stage.ts` and `activeSafeRects`).

### `src/scroll/detailField.ts`: owner scroll (phase 3); status real

Pure and allocation-free (render loop). `detailAnchorTransform(id, s, out)`, `DETAIL_FIELD` (parallax .15·H, dim to α .25, hand-off .7 s, MCP stage window), `handoff` (`{x, y, scale, alpha, t}`: captured by `chapters/projects/route.ts`, tweened by `chapters/projects/detail.ts`), `detailFx` (`restore` for the "Next project" commit, the MCP spacer's `stageTop` / `stageH`, measured on refresh).

### Phase 3 chapter helpers (`src/chapters/choreo/`, `src/chapters/projects/`)

- **Focus and charge are arbitrated.** `fx.groupW` and `fx.focusOn` are written only through `chapters/choreo/fx.ts` `claimFocus(owner, lit, dim, { focusOn })` / `releaseFocus(owner)`: the newest live claim wins, and with no claim every group is 1 and `focusOn` 0. Any new focus writer (a project-title hover, say) claims through it, or leaves groups 0–4 alone (S1, S2, S4, S7 and S8 all use low group ids). `fx.charge` likewise goes through `setCharge(owner, on, level)` (only the owner that set it clears it). One-shots: `fireNova`, `fireIgnition` (C5 writes `fx.exposure` for the ignition), `settleOneShots`.
- `film.ts`: `watchFilm(gsap, fn)` (one shared ticker listener, kept after the engine's `renderFrame`, full motion only), `fieldDraws(state)` / `onFieldStates(fn)` (a MutationObserver cache of `html[data-field-states]`), `posterF()`, `invalidateField()`.
- `chart.ts` (C1), `contact.ts` (C5 reveals, ignition, sink), `horizon.ts` (footer sunset), `reveal.ts` (`maskOneLine`); `projects/stage.ts` (the C3 4-window stage), `projects/route.ts` (home ↔ detail transitions), `projects/detail.ts` (detail page field + figure).
- The C3 stage lives in its own gsap context, built outside the chapter's (`context.ignore`), reverted once by stage.ts, and cleared after its revert (and once more as a tracked reveal after the chapter context). `PROJECT_TEXT_Q` (scroll/chapters.ts) holds the panel text windows shared by the stage, the `--scrim` scrub and `activeSafeRects`.

The App's `ScrollToHash` routes every route-change scroll through these: no hash → `scrollInstant(0)` (PUSH / REPLACE); POP to a non-home route → `scrollInstant(saved)` for that history entry (`sessionStorage['dtw:route-y']`, location.key → y, written from `store.scroll.y` when the entry is left; 0 when none) once the lazy route has rendered; POP to home is `runArrival`'s; a jump id → `jumpToChapter`; any other hash → `jumpToY(top, () => focusQuietly(heading))`; a home hash arrival from another route that `runArrival` handles (`arrivalOwnsScroll()`) is skipped, so one scroll runs per arrival. **First load:** index.html strips the hash before the first paint (no native fragment jump; the hero paints first) and keeps it in `window.__dtwHash` (`scroll/initialHash.ts`); the pre-paint script sets no `data-intro="pending"` and the engine runs no intro when one exists. ScrollToHash waits for the first ScrollTrigger refresh with every home chapter measured and fonts loaded (3 s failsafe), then `scrollInstant(homeHashTarget(id))` + `snapFilm` (instant: the page has only shown the hero), focuses the heading quietly and restores the hash with `history.replaceState`. A visitor who has already scrolled > 40px keeps their position.

`jumpCut(y, { onCut, retarget })`: when the motion preference flips while a cut still covers its scroll, `applyMotion` finishes the jump after the next refresh at `retarget() ?? y` (jumpToChapter passes `chapterTarget(id)`, so it lands in the new layout) and still runs `onCut`. `scrollInstant` and `glide` call `lenis.resize()` first, and `chapterTarget` clamps to the live document height (the cached limit can still be the previous route's right after a swap); `jumpTargets` (rail, ≤ 10 Hz) keeps the cached limit.

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
| shader mask feather, `[data-safe]::before` feather | shader: the block's rect fully masked, then a smootherstep ramp on the Euclidean distance outside it (rounded iso-lines) over a per-rect outward feather, `uSafeF`: 112px, 24px for the nav band and for `data-safe="tight"` blocks while S1 shows (their feather eases 112 → 24 with the S1 weight of the pair). Scrim: 8 eased stops over 48px across (bounded by the gutter) and 80px top / bottom (48px for tight blocks), rounded | linear 24px / 48px rect | Linear ramps start and stop abruptly (Mach bands), and even eased 24px / 48px ramps left every text block a hard dark box punched into the bokeh (final review: 6.4 vs 9.9 mean luminance, a sharp edge). The wide rounded falloff reads as a lens effect; it only dims more field, so the §2.3 budget holds. The hero eyebrow sits 20–50px above the name's cap line and the mobile lede 28px below it, hence tight while the name shows. |
| shader loupe (`LOUPE_CORE`) | `loupe = amt · (1 − smoothstep(.35r, r, d))`; z → `uFocusZ` by .95·loupe; CoC → 1 by loupe; brightness +30% by loupe | z → 0 by .85·(1 − d/r)² | The quadratic pull only focused ~5–11 px around the pointer, under the 24 px ring: the loupe was invisible. Now the inner 35% of r (≈ 38 px at 900 px tall) is fully sharp with a soft edge. |
| `live.glsl` scan beam | ramp + .5 within the beam (bone → ember → p-core) as well as brightness ×2.8 | brightness only | §10 "an ember scan beam", §2.1 p-core "scan flash": the brightness-only beam read as a white band on the grains. |

Phase 3 integration (tuned on the same setup: 1440×900 High/Mid, 1920×1080, 1280×720, 1280×640, 390×844 Low; pinned `?film=` sweeps plus natural scroll, reduced motion and no WebGL):

| Where | Value | Spec | Why |
|---|---|---|---|
| `material.ts` / `live.glsl` | every `shaders/live/sNN.glsl` spliced at `// @include states` (sorted `import.meta.glob`), one `case` per state | — | Adding a state's live() = drop its file in `shaders/live/` + its case |
| `anchors.ts` `hangInView` (director, home film, desktop) | a morphing endpoint's anchor centre is clamped into [nav band + h/2, 100svh − h/2]; not S0, S2, S10, nor S9 while sinking | anchors follow their stage | Every cross-chapter segment (the Pour's second half, S3 → S4, S7 → S8, the spiral) morphed between two off-screen shapes: at mid-segment the frame was empty void. Now the outgoing shape rides the top edge and the incoming one rises from the bottom edge, so each transition reads. Holds are unaffected (a box in view is never moved). Mobile keeps strict registration (phase 4). |
| `field.vert.glsl` `P_TOPPLE` | bars and fizz (groups 0–3) tip RIGIDLY about their bottom-right pivot, θ = −1.4·r², r = tl / .5 (gravity), then glide to the slab, cubic over tl .4 → 1; everything else morphs directly | quadratic Bézier via pivot + R(−60°)(pa − pivot) | The Bézier smeared each bar toward its slab and never read as a fall. On the linear clock `tl` so the whole bar falls together. |
| `s03-redacted.ts` `KEY.barRand` | .015 | (agent: .06) | With the rigid fall, a wider key spread fanned each falling bar into a cloud |
| `uniforms.ts` S3 `enter.turb` | .015 | .06 | Curl noise at .06 scattered each bar mid-fall (agent request) |
| `chapters/choreo/chart.ts` topple fades | numeral k fades (CSS `filter: opacity`) over tl 0 → .3 of its own bar's topple, tl = (m − key·.45) / .55 with the S3 keys (bars 0 / .45 / .9, the AI "1" and leader .15) | — | The numerals stayed at full ink over bars that had already fallen |
| `Capabilities.tsx` `FOCUS_GATE` | [7.9, 8.04] | [7.9, 8.6] (agent) | The spiral started from one lit drawer and three dimmed plates; now all four plates carry their light into it |
| `live/s08.glsl` | `STACK_ACTIVE_GAIN` .8, `STACK_REST_DIM` .1 | agent .5 / .3 | At .3 the three resting plates all but vanished (α ×.35 ×.7, +1.2 CoC); the stack must read as four layers with one drawer out |
| `uniforms.ts` S8 density | .7 | .5 | The isometric plates are hairlines; at .5 the stack read too faint next to S7 / S9 |
| `projects/stage.ts` flow panels (reduced motion, fit-guard flow) | `fx.disperse` 1 on desktop, 0 on mobile | 0 | In flow every card is open on its emblem's anchor: at 0 the opaque card hid S4–S6 entirely; the post-curtain halo is the chapter's final state (§8.2) |
| `layout.ts` `CARD_W` desktop | `min(44vw, 88.1svh, (50svh − 128px) × 2 × 1200/953)` | `min(44vw, 88.1svh)` | On short wide windows (e.g. 1280×640) the card's top (50svh − h/2) ran under the C3 chrome ("Side projects" / "01 / 04" at max(104px, 11svh)); binds only below ≈ 830px tall with 44vw binding |
| `engine.ts` reduced motion | leaves the ticker only after a SETTLED frame was drawn (`shownSettled`) | render while dirty or settling | With frames > 100 ms apart the frame ending a poster crossfade could arrive after the window closed, leaving a half-faded poster (agent report) |
| detail / 404 text-safe rects | `registerPageRects` on mount, refresh and resize | — | Pages without chapters registered no `[data-safe]`, so the MCP re-stage and the parallaxing emblem drew under the writeup at full strength |
| `Chapter.tsx` fit guard | re-measures on motion-preference and layout switches | resize and font load | Content that overflowed only in flow stayed stuck in `[data-overflow]` after Reduced → Full |

Phase 3 review fixes (same setup; canvas-only luminance sampler over the `[data-safe]` rects, AX tree via CDP, per-rAF layout-read instrumentation):

| Where | Value | Spec | Why |
|---|---|---|---|
| `anchors.ts` `BEACON_SINK` (S9 sink) | travel and scale follow `smoothstep(.3, 1, sink)` (the beacon rides its stage first, then sets); scale × (1 − .55·e); α × k² (area-conserving, k the scale); dimmed toward ×.15 by its analytic overlap with the contact text-safe rects (box 1.45R × 1.1R, fully dimmed at 45% covered) | anchor → horizon linearly, ×.45, α ×.6 | The stage unsticks as the sink starts, so the email row and body scroll up across the beacon: it was cut flat by the scrim edge, vanished, popped back as a half-disc, and its ×.45 core (≈ 5× denser) summed to pure white under the email (canvas-only max #ffffff). Now it passes behind the text (≤ #161618 behind every contact rect at 1440×900 High) and sets as a half-disc on the ember horizon |
| `live/s09.glsl` `uSink` | core and sparks × (1 − .8·smoothstep(0, .25, sink)) | — | The CTA disc that covers the core fades over the first quarter of the sink; a bare dense core would glare |
| `choreo/contact.ts` disc fade | opacity 1 − smoothstep(0, .15, sink) | the first 10vh (sink .25) | Tied to the beacon's own progress: gone before the beacon leaves its stage (travel starts at .3), so the label never floats off the core (desktop and mobile) |
| `projects/stage.ts` scrims, `uSafeW` | a panel's `[data-safe]` scrims (`--scrim`, the ::before opacity) and its mask weight ramp 0 → 1 with its text reveal (window 0: its transit-in), out with its exit; the closing card also fades out over q .02–.10 | scrim and mask switch at the hand-over (q .08 since the final review) | An empty dark box with a hard vertical wall popped into the morph cloud at every hand-over before any text showed; the closing card ended as a 30px navy chip |
| `choreo/chart.ts` numerals | a bar numeral fades in over the first .05 of its window and rides its bar's grain front (`--fill`, translate by the unfilled height) until the snap; while counting, the decimal is set at .42em | numerals at the final heights throughout | "0 / 0 / 0" hung over empty columns for half the Pour and later counts sat on the falling stream; full-size "1.4" is wider than a bar pitch, so riding counts collided |
| `index.css` `low:` (height ≤ 760px), About / Capabilities | Capabilities: statement cap 4.6svh, rows py .75svh, description lead-in .6svh and line-height 1.5, list gap 2svh; About: statement cap 6.2svh, `--label-gap` 14px, stat notes 13px / 1.35 | — | Real laptop viewports (1366×657, 1536×730, 1280×720, 1280×640) fell back to flow by a few px (About's stat row, Capabilities' 3-line statement); now every one stays sticky (fit-guard need ≤ 100svh, doc 12.30 vh). Add them to the phase-4 QA matrix |
| `live/s10.glsl` charge | line and ghosts α ×4, halo ×2.4 at uCharge 1, halo / ghosts lifted ≤ .1 toward p-signal | — | With the global bokeh falloff (tuned for S0) the defocused rest line emitted more light than the focused one: the hover read as the signal fading (−65%). Focused line energy now ≥ rest (band mean 11.9 vs 11.3 above background) |
| `s02-chart.ts` steel slabs | p-steel (ramp .25), fill α .5, edges α .9; the 6+ bar's 2-year line a signal seam at α 1 | steel p-steel, fill .55, edge .9 | Phase 3 dropped them to ramp .22 / .38 / .75 because additive steel and signal read as the same grey; the final review found that too dark (dim grey-brown dust, rgb(64,69,80), not matching the legend's #8c97ad swatch). p-steel at .5 / .9 keeps the hue split, and the signal seam keeps the stack split |
| `projects/detail.ts` peek | the peek also tweens `detailFx.restore` → .5 (the commit to 1) | only m .25 | At the page end the emblem sat at α .25 half under the nav band: a 25% morph there was invisible |
| `About.tsx` statement | `text-balance`; the accent phrase `nowrap` on phones and from 1200px up | — | "decisions" was a one-word widow split from its accent at 1440 |

Generator-phase deviations (measured by each state's agent and kept; the source notes the spec value next to each):

| State | Deviation |
|---|---|
| S2 | Bar keys are the exact inverse of the §5 C1 numeral curve (a grain at height fraction h of bar k lands when the numeral shows value × smoothstep(.55 + .1k, .95 + .05k, m)); the top ≈ 5% of the 6+ bar is spread over keys .95–1. Gridlines are omitted behind the bars. The AI reticle is 16 dots; spark α is normalised per tier. |
| S3 | Spec su sizes scaled by k = box height / .85 (fits `Nda.tsx` on every canvas). Keys per source S2 bar (0 / .45 / .9 + rand, via `barAtRank`); non-bar grains .85·row/8 + .15·rand. |
| S4 | Rings α .45 (spec .35), clipped to the bubble, z = −.04 × emblem width (the shader reads the unit length from it). Ghosts share the trace's position and act as a trail in time. Outline / ECG / spark α .5 / .62 / .6. |
| S5 | Printed rows register each node's z-stack onto its line of sight (one crisp dot, not a perspective streak) and draw ×1.35; unprinted rows ×.5 (spec .22/.85); columns snapped between nodes; 1,056 nodes (spec ≈ 1,900; the listed parts cover ≈ 1,100 cells); under the curtain records ×1.5 size, ×1.9 α. |
| S6 | Back-card outlines are occluded by the cards in front; the "›_" glyph sits upper-left on the front card; 40% of stroke grains are soft sprites (×3.4 size, ×.16 α); card outlines ×1.35 / ×1.8 α under the curtain. |
| S7 | Halo is a flattened shell (polar .65 × equatorial, r ≤ 1 fitted to 92% of the box height, ≈ .68 desktop) instead of an r 1 sphere spilling onto the caption; packets are two ember dashes per spoke. |
| S8 | Depth flattened ×.3 after the iso rotation; a slab under-edge on each plate; motif details designed (the spec names them only); inactive plates' sparks ×.25. |
| S9 | Ring rolled 8° and dotted; infall in a disc tilted 30° with .42 turns (face-on streams ran under the headline); shell α .28 (spec .5), rim ×2.4, core α .46 (spec 1); the ×3 charged ring speed is a crossfade between a slow and a fast population (no phase jump). |
| S10 | ECG shifted so R sits at the screen centre; ghost α ×2 (the head's trail, the beat's echo); a comet tail on the head; line α normalised per CSS px and tier point area; line depth σ .6 su with the perspective divided out in live(), so depth only blurs. |
| C1–C5 | Stat blocks and capability rows respond to hover / click only (the spec makes them aria-hidden / non-focusable; keyboard users get the table and scroll activation). Numerals show one decimal (set at .42em) while counting, and ride their bar's grain front. Contact ignition may fire at a nav jump cut's snap. |
| C3 | The curtain clips an inner `[data-card-clip]` frame and the ember glow is its own layer (a clip-path on the link cut its focus ring and glow); the title line mask splits the `<a>` itself; arrivals run from `Projects.tsx` in a layout effect. |

Phase 4 (Canvas2D fallback, context loss, adaptive, mobile slot layout; 390×844, 360×640, 375×548, 820×1180, 844×390 Low and the desktop matrix):

| Where | Value | Spec | Why |
|---|---|---|---|
| `anchors.ts` `SLOT_CARRY` / `slotCarry` (mobile home film) | fade .25, band .1, hang 44px | anchors follow their slot | Replaces desktop `hangInView` on mobile. When the outgoing shape has scrolled off before a segment starts it is moved into the incoming slot while off-screen, fades in over the first 25% of the segment and morphs in place as the slot rises (100% → 40%); when it is still on screen the grains flow directly (outgoing waits under the nav band, incoming is held above the fold). A hidden slide-back band keeps reverse scrolls from popping. Mid-transition frames were empty before. |
| `segments.ts` `MOBILE_POUR` | chart slot top 80% → 20% | 100% → 40% (§4.3) | The bars landed out of view |
| `segments.ts` `MOBILE_SPIRAL_FROM` | contact top 60% → 0% | 100% → 0% | The beacon formed out of view |
| `anchors.ts` `CONTACT_HEAD` | {.6, .35} | — | The mobile contact header's scrim and text-safe mask ramp in with its line masks instead of an empty dark box during the spiral |
| `input.ts` tap ripple amplitude | 1.6 | 1 (§3.7) | Invisible over the resting noise at 1 |
| `layout.ts` beacon `mobileShort` (height < 600) | ×.8 at 44svh | — | 375×548 and 360×560 stay sticky (with `Contact.tsx` `--disc-gap` / `--shell-gap`) |
| `fallback2d.ts` `FALLBACK.maxPixels` | 2.1 M backing-store pixels | — | Software raster of a 5 MP canvas: 50–126 ms per wheel frame at 1440×900 DPR 2; 0 long tasks after |
| `fallback2d.ts` exposure | structure α normalised to .9 across states; group-focus floor .75; always Low-tier generation | — | A sparse 1,819-dot subsample must still read each plate |
| `anchors.ts` `MASK_LEAD` (C3 panel text-safe weights) | .5: full weight over the first half of a reveal, released over the last half of an exit | ramps with the reveal / exit windows | The staggered fade-ups are readable before the window ends; a linear mask let grains reach L .219 behind the half-revealed MCP App panel (budget .0232). After: worst L .0225 desktop, .0212 mobile |
| `anchors.ts` `restRect` (safe-rect measure) | `[data-safe]` rects are measured minus the element's own translate | raw layout rect | Refresh ran while reveals parked blocks at `y: 16` (the MCP caption): the mask sat 16px low for the whole hold |
| `choreo.ts` `INTRO_SCROLL_SKIP_PX` | any scroll > 4px from where the intro started ends it | wheel / touch / key / pointerdown | A hash, restore or script jump during the intro left the film on S0 → S1 over another chapter for the rest of the intro |
| `engine.ts` `precompile` | `renderer.compileAsync(scene, camera)` during boot when `KHR_parallel_shader_compile` exists; ready waits for it | — | Takes the program link out of the ready frame on GPUs (the 355–473 ms load task on SwiftShader stays: no such extension there) |

Final review fixes (headless Chromium, SwiftShader, `.qa/fin/`):

| Where | Value | Spec | Why |
|---|---|---|---|
| `chapters.ts` `PROJECT_TEXT_Q` / `PROJECT_SWITCH_Q`, `ProjectPanel` panel opacity | exit q 0–.10, `data-active` switch .08, reveal .08–.24; the stuck panels crossfade over 300 ms (`transition-opacity`) | exit, then reveal (§5 C3) | The sequence left an empty frame (chrome labels and a haze) at every hand-over |
| `uniforms.ts` S7 `enter.turb` | .15 | .4 (tuned earlier) | Prmpt → MCP passed through a formless haze |
| `segments.ts` `MOBILE_PROJECT_TO` | mobile S4 → S5 → S6 → S7 segments end at slot top 60% | 100% → 40% (§4.3) | Half a screen of dust at each mobile hand-over |
| `anchors.ts` `CURTAIN` / `curtainScale` | S4–S6 curtain scale ≤ the room between the gutter and 100vw − 56px (≈ ×1.3 at 1440) | ×1.6 | The Pulse bubble ran off the right edge under the rail; the Gov lattice reached the left viewport edge |
| `live/s04.glsl`, `live/s05.glsl` under `uDisperse` | the ECG trace, ghosts and spike, and the lattice steps (rows ≤ 7), fade over disperse .3 → .6 | — | Stray ECG segments either side of the open card; a dot-matrix carpet under it |
| `live/s08.glsl` `STACK_REST_EDGE`, `field.vert.glsl` stack CoC | resting plates' edges ×2.3; +.6 CoC | +1.2 CoC | Only the active plate read; the stack looked like one plate |
| `anchors.ts` `hangInView` | never S1 | — | 'WEBB' clamped under the nav band beside the lede and CTAs during the Pour |
| `live.glsl` S1 halo | `HALO_EDGE_SIZE` 6.0 / α .042 (Low 4.2 / .045) | §3.10 ×1.5 / α .45 | ×4.2 / α .085 sprites stayed discrete: the printed name looked eroded |
| `uniforms.ts` S1 idle amp | .0015 su | .003 (tuned earlier) | Moved the name's centroid up to 2px over time (§12 item 4) |
| `name-sampler.ts` baseline | the probe baseline snapped to device pixels | — | Chromium paints text on a snapped baseline: 1440 × 900 sat 0.5px higher than the DOM |
| `s02-chart.ts` `STEEL_SLAB` | see the phase 3 row | — | — |
| `layout.ts` S2 desktop baseline | min(80svh, 100svh − 180px) | 80svh | The bar notes ended 20px above the fold at 1280 × 720 |
| `useChapter.ts` statements (`data-reveal-timed`) | About, Capabilities and Contact statements line-mask time-based (700 ms, 90 ms stagger) and reverse above their start | scrubbed | A paused scroll left sliced glyphs and rows of i-dots |
| `projects/stage.ts` MCP caption box | opacity 1 → 0 over capabilities top 80% → 62% (the first 20% of seg7) | — | "Screenshot coming soon" floated alone over the haze after the constellation left |
| `detailField.ts` | α .25 by 60svh, .12 by 120svh | .25 by 100svh | The emblem stayed bright beside the screenshot and the lede |
| `field.vert.glsl` highlight cap | brightness gains capped to 1 as the anchor α falls below .6 (fully under .2) | — | The ECG's ember head still read at α .25 on the detail page |
| `index.css` `field-s2:` … `no-field-s10:` | also match `data-field="fallback"` | live only | The fallback drew S4–S9 while their DOM stand-ins stayed visible: a double exposure |

