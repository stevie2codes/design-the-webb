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
| `edgeY(edge, s)` | `→ number \| null` |
| `resolve(s)` | `→ ResolvedSegments`. Writes `s.segments`. Call it after every refresh. Segments stay ordered and never overlap. If a chapter is missing, only the segments before it are resolved. |

### `src/scroll/anchors.ts`: owner scroll; status real (route mode is TODO)

| Symbol | Signature |
|---|---|
| `NAV_BAND_PX`, `SAFE_FEATHER_PX` | constants: 64 / 56 px and 24 px |
| `stageTop(y, ch: ChapterRecord)` | `→ number`. The viewport top of the chapter's frame (§9.6). |
| `isStageSticky(stageEl)` | `→ boolean`. Reads computed style, so call it at refresh only. |
| `registerChapterRects(id, stageEl, s = store)` | `→ void`. **Refresh only.** Measures `[data-field-anchor]` and `[data-safe]`. |
| `clearChapterRects(id, s = store)` | `→ void`. Call it on unmount or route change. |
| `anchorCenter(id, s, out)` | `→ [x, y]` in viewport px. An unmeasured state falls back to its `layout.ts` box, treated as viewport-framed. |
| `anchorTransform(id, s, out: Vec4, disperse?)` | `→ [x px, y px, scale, alpha]`. Applies the S9 sink and the S4–S7 curtain. |
| `createSafeRectBuffer()` | `→ SafeRectBuffer` |
| `activeSafeRects(s, out?)` | `→ SafeRectBuffer`. The nav band, then the 5 on-screen blocks nearest the centre. In the stuck C3 stage, only the active panel's blocks count. |

### `src/scroll/director.ts`: owner scroll; status real (reduced-motion posters and route-mode details are TODO)

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

What `tick` does, by override:

- **No override:** F* = `filmTarget(scrollY)`, then the jump cut (the director folds its fade into `frame.opacity` and never writes `fx.opacity`), then the 120 ms damp (60 ms while rewinding).
- **Override with `b = a + 1` on the home route:** F* = a + m, as used by the intro.
- **Override with `snap`:** no damp and no cut. Used by `?film=` and resyncs.
- **Any other override, or a route other than home:** route mode. The frame shows (a, b) directly, with `seg = −1`.

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

Adding a state takes three things: a generator in `states/sNN-*.ts`, a `live()` case in the shader, and one `STATE_PARAMS` row.

### `src/field/tiers.ts`: owner engine; the table and rule are real, the probe and adaptivity runtime is TODO

`TierName`, `TIER_ORDER`, `TierSpec`, `TIERS` (the §3.2 counts), `BOKEH_SHARE`, `TierEnv`, `pickTier(env) → TierName`, `dprCap(tier, cores)`, `isFeebleDevice(env)`, `readTierEnv()` (browser only), `PROBE`, `ADAPTIVE`, `AdaptiveStep`.

### `src/field/index.ts`: owner engine; acquire and release are real, bootField is a stub

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

Dev builds always expose the globals. **Headless SwiftShader needs `?tier=…` or `?debug`**, because otherwise `failIfMajorPerformanceCaveat` sends the page to the fallback.

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
3. **`Timeline.updateRoot`** renders every time-based gsap tween. Examples: the print tween writing `fx.scanX` and `--scan`; `fx.printed`, `fx.exposure` and `fx.nova`; the intro override `m`; the UI's charge and groupW targets.
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
