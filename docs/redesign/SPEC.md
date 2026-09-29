# Signal from Noise — Final Rebuild Spec

**Status:** Final and authoritative, v1.0, 2026-09-28. This document is the build spec for the full rebuild of designthewebb.com. If it disagrees with the three proposals or the judge notes, this document wins.
**Basis:** The winning proposal *Signal from Noise* (key `signal`, 123 pts, 2 of 3 judge votes). It includes the grafts the judges asked for where they make the vision more coherent, and it fixes every risk they raised (§11).
**User-locked:** The concept is a "Living data field": one persistent full-viewport WebGL point field that morphs as you scroll, with pinned DOM chapters on top of it. The mood is "Dark & cinematic".
**Supersedes:** The current cream/orange palette, Framer Motion, `components/hero-bg/`, and the guidance in CLAUDE.md about both. CLAUDE.md is rewritten as part of the build (§12).

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| Thesis | Scroll works like a focus ring. Noise racks into focus as the name, then **pours** into an honest career chart, topples into redaction bars, becomes a silhouette for each project, stacks into capability layers, and converges into a beacon you can click. |
| Mood | Near-black `#050507` with light as the medium. One accent, ember `#FF6A3D`. Negative space is generous. |
| Type | **Archivo Variable** at condensed width (75%) for the name and titles, and at normal width for text. **Instrument Serif Italic** for one to three "voice" words. **JetBrains Mono Variable** for labels. All are self-hosted through fontsource. |
| Field engine | Vanilla `three`, one `THREE.Points` object, a custom `ShaderMaterial` (GLSL3). **Every morph state lives on the GPU as an RGBA32F position DataTexture plus an RGBA8 meta DataTexture.** Crossing a segment boundary only swaps uniforms. |
| Particle counts | High: 49,152. Mid: 28,672. Low (mobile): 14,336. 3% are sparks, 15% are fixed depth dust, and 82% form the shape. |
| States | 11 in total. S0 STATIC, S1 NAME, S2 CHART, S3 REDACTED, S4 PULSE, S5 CIVIC LATTICE, S6 PROMPT DECK, S7 CONSTELLATION, S8 STACK, S9 BEACON, and S10 FLATLINE (404 only). |
| Scroll | **Sticky stages with no GSAP pins.** Desktop document height is 1,230vh (1,130vh scrollable), 25% shorter than the proposal. One pure function turns scrollY into a continuous "film position" F in [0, 9], and a 120 ms damp smooths it. |
| Smooth scroll | Lenis 1.3 drives the gsap ticker, and ScrollTrigger updates from Lenis. Touch uses native scroll. There is no Lenis at all under reduced motion. |
| Wow moment | **Rack Focus → Pour.** Bokeh noise closes down into STEPHEN WEBB, and a scan beam prints the real `<h1>`. On the next scroll the name's grains fall column by column into his real career chart. |
| Accessibility floor | Every word is real DOM text. The `<h1>` is visible at first paint without JS or WebGL. WCAG AA contrast is computed below. Reduced motion has a full path, and a Motion toggle sits in the footer. |

### What was grafted from the other proposals

- **Instrument:**
  - An honest chart on a YEARS axis, with the "+" drawn as fizz and the AI-platform stat placed past a divider.
  - The Pour mechanics.
  - Resident state DataTextures.
  - The 404 flatline with a heartbeat.
  - Persistence ghosts on Pulse.
  - The ROWS counter.
  - Tap ripple on touch.
  - Depth dust.
  - A DOM scrim behind text.
  - The rule that intro never locks scroll.
  - Focus-in reveals a chapter.
  - A hidden data table.
- **Editorial:**
  - Sticky stages plus a single director, instead of pins.
  - The isometric capability STACK.
  - The orb as the email CTA.
  - The footer sunset.
  - A Canvas2D fallback built from the same generators.
  - The Motion toggle.
  - The hold rule.
  - A single `layout.ts` source of truth.
  - Scroll inertia.
  - A 30 fps idle throttle.
  - Regenerate only when width changes by more than 40px.
  - A portrait in Contact.
  - Archivo as the display face.
- **Signal** keeps its core:
  - Rack focus / DOF.
  - Per-glyph registration.
  - The mask-image print.
  - The focus loupe.
  - The jump cut.
  - The spark index range with a cheap glow pass.
  - Worker generation.
  - The curtain reveal.
  - The rewind.
  - The text-safe mask.
  - Its palette.

### What was rejected, and why

- **Editorial's dolly through the B:** a fill-rate spike at the wow moment, a trope, and it breaks the Pour's continuity.
- **The multiply-blend "window plate":** too fragile across GSAP transforms and Safari.
- **The film reel and screenshot-filled `background-clip` titles:** repaint cost, and decorative duplicates of the work.
- **3D rotated bars:** a chart-integrity problem.
- **Instrument's bezel, boot log, decode scramble, crosshair that hides the native cursor, and scroll detents:** they read as sci-fi instrument-panel cosplay and add soft scroll-hijacking.
- **Signal's elements that were cut:**
  - The 25 editorial-height bars (dishonest data).
  - The 2×2 quad (weakest chapter).
  - The intro scroll lock.
  - Starting the `<h1>` at opacity 0.
  - The accordion that hid capability descriptions.
  - The invented credits row.
  - Posters captured by hand.
  - Per-segment `bufferSubData` uploads.

---

## 1. Concept & narrative

The site is a short film about focus. One field of points (the "data") is fixed behind every route. Each chapter resolves noise into a legible shape that *means* what the chapter says, and then the real DOM content reads on top of it. Nothing is decoration for its own sake.

| Act | Chapter | Field | What the audience feels |
|---|---|---|---|
| Title card | C0 Hero | S1 → S0 (intro) | First paint shows STEPHEN WEBB in real type. The field then takes over the letters and **defocuses** them into drifting bokeh: his name turned into complex data. |
| Cold open | C0 Hero | S0 STATIC | A dark volume of out-of-focus points, with one line: *I make complex data feel obvious.* The cursor is a loupe of sharpness. |
| Rack focus | C0 Hero | S0 → S1 | The first scroll closes the aperture. Discs shrink to pinpoints and condense left to right into the name. A scan beam prints the crisp DOM `<h1>` exactly underneath. |
| Act I: the Pour | C1 About | S1 → S2 CHART | The letters lose cohesion column by column and fall like sand into his real career chart: 2 yrs developer, 4+ yrs design, 6+ yrs in tech. The "+" keeps fizzing upward. One ember point past the divider marks *now*: the AI reporting platform. |
| Interlude | C2 NDA | S2 → S3 REDACTED | The bars topple like dominoes into redaction lines with a lock cut into them: an honest picture of work that can't be shown. |
| Act II | C3 Side projects ×4 | S4 → S5 → S6 → S7 | Each project gets a live silhouette: a speech bubble with a heartbeat, a civic building printed row by row, a dealt deck of prompts, a hub with its tools. The particles part like a curtain and the real screenshot opens and **stays open** through the hold. |
| Act III | C4 What I do | S7 → S8 STACK | An isometric stack of four layers. Each capability slides its layer out like a drawer and racks it into focus. |
| Finale | C5 Contact | S8 → S9 BEACON | Everything spirals into one glowing beacon. **The beacon's core is the email button.** |
| Credits | C6 Footer | S9 sinks | The beacon sets like a sun behind the footer horizon. "Back to top" rewinds the whole film in 2.4 s. |

**Storyboard mapping.** Desktop scrollable length is 1,130vh. The approved order is kept exactly. The percentages move for two reasons. First, the name is *already on screen at first paint* and locks after one scroll gesture: no one should scroll two screens to learn whose site this is. Second, NDA and Capabilities get their own states.

| State | Approved storyboard | This spec (share of scrollable length) |
|---|---|---|
| Scattered noise | 0% | 0% (after the 2.3 s title-card intro) |
| Name locks | 15% | 5% (y = 56vh) |
| Live bar chart | 35% | lands at 18%, held 18–29% |
| (Redacted) | — | 29–38% |
| Project silhouettes | 55% | 38–66% (centred at 55%) |
| (Capabilities stack) | — | 68–85% |
| Glowing orb → contact | 85% | 85–93%, then held |

---

## 2. Design tokens

### 2.1 Colour — `src/index.css`

```css
@import "tailwindcss";

@theme {
  --color-*: initial;                 /* drop Tailwind's default palette entirely */

  --color-void: #050507;              /* page bg + WebGL clear colour */
  --color-deep: #0a0a0e;              /* footer, mobile menu */
  --color-surface: #111117;           /* cards, screenshot frames */
  --color-surface-2: #18181f;         /* hover / pressed surface */
  --color-line: rgb(242 238 230 / 0.10);        /* hairlines, chip borders (decorative) */
  --color-line-strong: rgb(242 238 230 / 0.18); /* rail track, dividers (decorative) */

  --color-ink: #f2eee6;               /* primary text (warm bone) */
  --color-ink-2: #a7a39a;             /* body copy, secondary */
  --color-ink-3: #8c887f;             /* tertiary: meta/captions on SOLID surfaces only */

  --color-ember: #ff6a3d;             /* THE accent: labels, accent words, focus ring, primary CTA bg */
  --color-ember-hot: #ffb08a;         /* hover state of ember text */
  --color-ember-deep: #b8361a;        /* pressed CTA only (never text) */
  --color-core: #ffe2cf;              /* beacon CTA disc */
  --color-steel: #8c97ad;             /* chart legend swatch (non-text), particle steel */

  --font-sans: "Archivo Variable", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Instrument Serif", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace;

  --ease-cine: cubic-bezier(0.7, 0, 0.2, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-expo: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-ui: cubic-bezier(0.22, 1, 0.36, 1);

  --radius-media: 16px;
  --radius-pill: 999px;
}
```

**Particle palette.** These are shader constants, never used for text. The shader reads colour as a 5-stop ramp, so the ramp position is also listed.

| Name | Hex | Ramp position | Role |
|---|---|---|---|
| `p-noise` | `#3E4557` | 0.00 | Out-of-focus noise, dust |
| `p-steel` | `#8C97AD` | 0.25 | Structure, developer years, inactive groups |
| `p-signal` | `#F2EEE6` | 0.50 | Resolved shapes, design years |
| `p-ember` | `#FF6A3D` | 0.75 | Sparks and accents: *now*, write-heads, packets |
| `p-core` | `#FFD2B8` | 1.00 | Beacon core, scan flash |

### 2.2 Contrast

These are computed WCAG 2.x ratios; the script is reproducible in §12. The AA thresholds are 4.5:1 for body text and 3:1 for large text and UI.

| Text \ backdrop | void `#050507` | deep `#0A0A0E` | surface `#111117` | surface-2 `#18181F` | scrimmed worst case `#0B0C0F` | raw haze worst case `#262A34` |
|---|---|---|---|---|---|---|
| ink `#F2EEE6` | 17.60 | 17.08 | 16.26 | 15.26 | 16.90 | 12.40 |
| ink-2 `#A7A39A` | 8.10 | 7.86 | 7.48 | 7.02 | 7.78 | 5.71 |
| ink-3 `#8C887F` | 5.76 | 5.59 | 5.32 | 5.00 | 5.54 | **4.06 ✗** |
| ember `#FF6A3D` | 7.16 | 6.95 | 6.61 | 6.21 | 6.87 | 5.04 |
| ember-hot `#FFB08A` | 11.47 | 11.13 | 10.60 | 9.95 | 11.02 | 8.08 |

Pairings:

| Pairing | Ratio |
|---|---|
| Primary CTA: void text on ember | 7.16:1 |
| Beacon CTA: void text on core `#FFE2CF` | 16.52:1 |
| Focus ring: ember against void | 7.16:1 (UI minimum is 3:1) |
| Ink on ember | 2.46:1. **Forbidden.** |
| `ember-deep` on void | 3.47:1. Never used for text. |
| Legend swatch `p-steel` against void | 6.93:1 |

### 2.3 Contrast rules (enforced)

1. **ink-3 only ever sits on a solid surface** (void, deep, surface, surface-2). It never sits over the live field, because it drops to 4.06:1 on raw haze.
2. **Every text block over the field carries `data-safe`.** That gives it two things:
   - a **DOM scrim**: `::before` with `inset: -48px`, `background: rgb(5 5 7 / .82)`, and a 48px mask feather on all four edges;
   - an entry in the shader's **text-safe mask**: particles inside the block, with a 24px feather, get alpha × 0.22 and lose their ember tint.

   Together these cap the backdrop at `#0B0C0F` (the table's scrimmed worst case).
3. Nothing bright animates behind text that is being read: the mask stays active during transits (§3.6).
4. Small ember text (< 24px) is allowed at 7.16:1. Ember is never used for text smaller than 12px.
5. Verification: the `?debug=field` overlay samples canvas luminance behind every `data-safe` rect and flags any frame above `#262A34` before the scrim is applied (§12).

### 2.4 Atmosphere

Two fixed layers sit **between the canvas and the content**, so they never touch text contrast. Both have `aria-hidden` and `pointer-events: none`.

- **Vignette:** `radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, rgb(0 0 0 / .55) 100%)`.
- **Grain:** a 128×128 grayscale noise PNG at `public/textures/grain-128.png` (about 16 KB, generated once by `scripts/make-grain.mjs` using Node's zlib with no dependencies).
  - High tier: opacity .045. A 200%-size layer moves with `steps(6)` translate keyframes at 12 fps (transform only, composited).
  - Mid and Low tiers: static, opacity .03.
  - It never uses `mix-blend-mode`.

### 2.5 Typography

**Packages.** All were verified on npm at 5.3.0, and the tarballs were inspected.

| Role | npm package → import | CSS family | Axes / styles | Latin woff2 |
|---|---|---|---|---|
| Display + text | `@fontsource-variable/archivo` → `@fontsource-variable/archivo/wdth.css` | `"Archivo Variable"` | wght 100–900, font-stretch 62–125% | `archivo-latin-wdth-normal.woff2`, 90 KB (**preloaded**, LCP font) |
| Voice (accent words only) | `@fontsource/instrument-serif` → `@fontsource/instrument-serif/400-italic.css` | `"Instrument Serif"` | 400 italic | 22 KB |
| Labels / HUD / data | `@fontsource-variable/jetbrains-mono` → `@fontsource-variable/jetbrains-mono/wght.css` | `"JetBrains Mono Variable"` | wght 100–800 | 40 KB |

The fontsource CSS already scopes each subset with `unicode-range`, so only the latin files download. The Google Fonts `<link>`s and preconnects are removed from `index.html`.

**Metrics measured in Chromium** from the real font files. These drive the layout and the canvas sampler.

- `STEPHEN WEBB` at Archivo 800 with `font-stretch: 75%`, uppercase, tracking 0, measures **6.518 em** wide.
- `STEPHEN` alone measures about 3.90 em. Cap height is 0.69 em.
- Canvas `ctx.fontStretch = 'condensed'` reproduces the DOM width exactly (6.518 em) in Chromium.
- In the 2D canvas, the `condensed` keyword inside the `ctx.font` shorthand also applies.
- Instrument Serif italic has an x-height of 0.52 em against Archivo's 0.53 em, so accent words are set at **1.04 em**.

**Type roles.** These are defined in `@layer components` as `.t-*` classes, because each role sets several properties at once.

| Class | Family / settings | Size | Line-height | Tracking |
|---|---|---|---|---|
| `.t-name` (the `<h1>`) | Archivo 800, `font-stretch: 75%`, uppercase, `white-space: nowrap` | Desktop and landscape tablet: `min(13.2vw, 30svh)`, one line, about 86vw wide. Mobile (< 768px, or portrait < 1024px): `calc((100vw - 40px) / 3.92)`, two lines (STEPHEN / WEBB) | 0.86 | 0 |
| `.t-display-xl` (detail page title) | Archivo 760, stretch 75%, uppercase | `clamp(3rem, 1.4rem + 6.4vw, 8.5rem)` | 0.90 | 0 |
| `.t-title` (project titles, 404 h1) | Archivo 760, stretch 75%, uppercase | `clamp(2.25rem, 1rem + 4vw, 5.25rem)` | 0.92 | 0 |
| `.t-display-l` (chapter statements) | Archivo 340, stretch 100% | `clamp(2.25rem, 1.3rem + 3.4vw, 5rem)` | 1.02 | −0.035em |
| `.t-display-m` (hero lede, NDA heading, capability titles, email) | Archivo 400, stretch 100% | `clamp(1.625rem, 1.1rem + 1.8vw, 2.75rem)` | 1.10 | −0.02em |
| `.t-stat` (chart numerals) | Archivo 300, stretch 75%, `tabular-nums` | `clamp(3.5rem, 2rem + 6vw, 7.5rem)` | 0.85 | −0.01em |
| `.t-lede` | Archivo 400 | `clamp(1.125rem, 1rem + .5vw, 1.4375rem)` | 1.50 | −0.005em |
| `.t-body` | Archivo 400, max 62ch | `clamp(1rem, .96rem + .2vw, 1.0625rem)` | 1.70 | 0 |
| `.t-accent` | Instrument Serif italic 400, colour ember inside statements | 1.04em of its parent | inherit | −0.01em |
| `.t-label` | JetBrains Mono 500, uppercase | 0.75rem (12px) | 1.4 | 0.14em |
| `.t-micro` | JetBrains Mono 450 | 0.6875rem (11px), **aria-hidden decoration only** | 1.3 | 0.08em |

**Font-swap CLS guard.** The `<h1>` is a fixed-height block whose font-size is a length (vw or svh) and whose line-height is in em. When the font swaps, only glyph widths inside the line box change, so nothing below it shifts and CLS stays 0.

### 2.6 Layout

- 12-column grid. Side gutter `--gutter: clamp(20px, 4vw, 64px)`; column gap `clamp(12px, 1.6vw, 28px)`.
- **Field-registered layout is viewport-relative (vw/svh) by design.** The shapes and their DOM labels share one coordinate system (§9.6). Type clamps keep ultra-wide and ultra-small screens sane.
- Radii: media 16px, chips 999px.
- Breakpoints:
  - `md` = 768px.
  - `lg` = 1024px.
  - The **mobile layout** applies when width < 768, **or** width < 1024 in portrait.

### 2.7 Motion tokens

| Token | Value | Use |
|---|---|---|
| `cine` | `cubic-bezier(.7,0,.2,1)` (GSAP `CustomEase` "cine") | Timed morphs, route transitions, scan beam |
| `expo.out` | `(.16,1,.3,1)` | Entrances |
| `expo.in` | `(.7,0,.84,0)` | Exits |
| `expo.inOut` | GSAP built-in | Nav glides, rewind |
| `ui` | `(.22,1,.36,1)` | Hover and focus colour changes |
| `none` | — | Every scrubbed tween. Smoothness comes from Lenis plus the field damp. |

Durations:

| Kind | Duration |
|---|---|
| Micro | 180 ms |
| UI | 240 ms |
| Reveal | 700 ms (line masks, 90 ms stagger) |
| Group focus | 500 ms |
| Timed morph | 1,100 ms |
| Scan beam | 900 ms |
| Jump cut | 250 ms out, 400 ms in |
| Rewind | 2.4 s |

Loops:

| Loop | Period |
|---|---|
| Caret blink | 1.06 s |
| Pulse | 2.4 s |
| Write-head | 3.2 s sweep + 0.8 s hold |
| Beacon breath | 5 s |

---

## 3. Particle field

### 3.1 Stage units (su)

- Camera: `PerspectiveCamera`, fov 30°, placed at z = 3.732 (that is, 1/tan 15°). The z = 0 plane spans y ∈ [−1, 1] and x ∈ [−A, A], where A = canvas aspect.
- Viewport point (x px, y px) maps to `X = (2x/W − 1)·A` and `Y = 1 − 2y/H`, where W and H are the **canvas** CSS size. 1 CSS px = 2/H su.
- The canvas is `position: fixed; top: 0; left: 0; width: 100%; height: 100lvh`. It never resizes when a mobile URL bar shows or hides.
- Layout is authored in vw/svh and **resolved to px before it reaches the generators**, so px → su always uses the canvas height.

### 3.2 Quality tiers and exact counts

The tier is chosen at boot. Textures are always 256 texels wide.

| Tier | Rule | Texture | N | Sparks (3%) | Dust (15%) | Shape M | DPR cap | Base point size (CSS px) | Bokeh cap | Extras |
|---|---|---|---|---|---|---|---|---|---|---|
| **High** | width ≥ 1024, `pointer: fine`, `hardwareConcurrency` ≥ 8, `deviceMemory` not ≤ 4 | 256×192 | **49,152** | 1,475 | 7,373 | 40,304 | 1.5 | 1.1–2.6 | 12px (35% of particles eligible) | Glow pass, animated grain |
| **Mid** | Any other width ≥ 768 that is not mobile layout | 256×112 | **28,672** | 860 | 4,301 | 23,511 | 1.5 | 1.2–2.8 | 10px | Glow pass |
| **Low** | Mobile layout, **or** `deviceMemory` ≤ 4 | 256×56 | **14,336** | 430 | 2,150 | 11,756 | 1.5 (1.25 if ≤ 4 cores) | 1.4–3.2 | 8px (S0 only) | No glow pass, static grain |

- **Warm-up probe.** During the intro (≈ 45 frames), record rAF deltas. If p75 is over 14 ms on High, drop to Mid immediately by `drawRange` only. The textures stay as they are.
- **Adaptive downgrade** runs at any time. It fires when the rolling 60-frame average stays above 20 ms for 2 s, and each firing takes one step:
  1. Bokeh cap −4px.
  2. Halve `drawRange`.
  3. DPR → 1.
  4. Glow pass off.

  It never steps back up within a session. The HUD is unaffected.
- **Fallback triggers:**
  - `webgl2` context creation fails with `failIfMajorPerformanceCaveat: true` (software GL).
  - `deviceMemory ≤ 2 && hardwareConcurrency ≤ 2`.
  - A second `webglcontextlost` in one session.

  Any of these switches to the Canvas2D fallback (§8.4).

### 3.3 Index layout and particle → target mapping

- **Index order.** `[0, S)` are **sparks** (contiguous, so the glow pass is a cheap range draw). `[S, N)` interleave dust and shape through the golden ratio: `v = fract((i − S)·0.6180339887)`. If `v < 0.154639` (= 15/97) the particle is **dust**; otherwise it is **shape**.
- **Any index prefix is a uniform subsample** of every state, by the three-distance theorem. That is what lets `drawRange` halving and the Canvas2D 1,500-point subsample work without reallocation.
- **Rank permutation.** Shape ordinal j has `v_j = fract(j·φ)`. `perm[j]` is the rank of `v_j` among all M values. It is computed once per tier and shared by every state. A state's generator returns exactly M shape targets **sorted by that state's sort key**, and shape ordinal j takes target `perm[j]`. Sparks use the same scheme with their own permutation over S.
- **Coherent pairs share sort keys.** Neighbouring ranks land in neighbouring places in both states, so pairs that should flow do, and pairs that should cross energetically are shuffled.

| State | Sort key |
|---|---|
| S0, S1, S2 | x-major in 64 column bins, then y ascending (makes the rack focus and the Pour column-coherent) |
| S3 | row top→bottom, then x ascending (the leftmost bar becomes the top rows, so the topple reads) |
| S4 | component, then arc length u |
| S5 | row bottom→top, then x |
| S6, S7 | seeded shuffle |
| S8, S9 | polar angle about each state's own centre (spiral coherence) |
| S10 | x |

- **Dust never morphs.** It has one fixed position shared by every state, generated once:
  - x ∈ [−1.4A, 1.4A], y ∈ [−1.4, 1.4], z ∈ [−4, −1.2].
  - Colour `p-noise`/`p-steel`, α 0.18–0.30.
  - Scroll parallax: `y += scrollPx·(2/H)·0.15`, wrapped modulo 2.8, so dust drifts at 15% of content speed.

  This removes shape↔dust streaks entirely.
- **Surplus shape particles** go to a dim Gaussian **halo** around the shape (role `halo`). No generator is ever short.
- **Determinism.** mulberry32 seeded with `0x5EB ^ stateId`.

### 3.4 State storage (the resident DataTexture design)

For each state k, two textures stay on the GPU for the whole session:

- **`pos[k]`**: `DataTexture(Float32Array, 256, N/256, RGBAFormat, FloatType)`, `NearestFilter`, no mipmaps.
  - `xyz` = the **local** position in su, relative to the state's anchor centre.
  - `w` = the **stagger key** used when *entering* this state.
- **`meta[k]`**: `DataTexture(Uint8Array, 256, N/256, RGBAFormat, UnsignedByteType)`, normalised.
  - `r` = colour ramp position.
  - `g` = base alpha.
  - `b` = param (arc length u, row fraction, height fraction).
  - `a` = `role << 4 | group`.
  - Roles:
    - 0: fill
    - 1: edge
    - 2: spark
    - 3: dust
    - 4: halo
    - 5: flow
    - 6: ghost
    - 7: blink
    - 8: ring
    - 9: packet
  - Groups: 0–15.

GPU memory:

| Tier | Memory for all home states |
|---|---|
| High | 11 × (786 KB + 197 KB) = 10.8 MB |
| Mid | 6.3 MB |
| Low | 3.2 MB |

S10 is generated lazily, and only on the 404 route.

**Why DataTextures rather than one vec3 attribute per state:**

- Switching segments is a **sampler-uniform swap**, with zero uploads and no VAO churn. The proposal's `bufferSubData` of about 3 MB per boundary is gone.
- WebGL2 guarantees `texelFetch` in the vertex shader and RGBA32F sampling with NEAREST, so there is no extension risk.
- The vertex shader reads exactly four texels (A pos/meta, B pos/meta), whatever the number of states. Attribute-per-state would need 22 attributes and exceed the 16 guaranteed by `MAX_VERTEX_ATTRIBS`, or else rebind attributes at every boundary.
- The same `Float32Array`s feed the worker cache, `webglcontextrestored` rebuilds, and the Canvas2D fallback.
- One `drawRange` downgrades every state at once.
- A resize swaps a freshly generated texture set atomically.

**Geometry.**

- `position` (vec3) packs `(index, 0, 0)`.
- `aSeed` (vec4 random) holds:
  - `x`: size
  - `y`: twinkle rate
  - `z`: scroll inertia
  - `w`: bokeh eligibility, set when < .35
- `frustumCulled = false`.
- Material: `glslVersion: THREE.GLSL3`, `blending: AdditiveBlending`, `premultipliedAlpha: true` (so ONE, ONE), `depthTest: false`, `depthWrite: false`, `transparent: true`.
- Renderer: `{ antialias: false, alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: true }`, clear colour `#050507`.

### 3.5 Uniforms

| Uniform | Type | Meaning |
|---|---|---|
| `uPosA`, `uPosB`, `uMetaA`, `uMetaB` | sampler2D | Current pair |
| `uTexW` | int | 256 |
| `uKindA`, `uKindB` | int | State ids, used by `live()` |
| `uOffA`, `uOffB` | vec4 | Anchor transform per endpoint: `xy` = anchor centre in su (follows its stage every frame), `z` = scale, `w` = alpha multiplier |
| `uMix` | float | Displayed progress within the pair (from the director, §4.3) |
| `uStagger`, `uTurb` | float | Spread S and turbulence T of the entering state |
| `uPath` | int | 0 DEFAULT, 1 POUR, 2 TOPPLE, 3 DIGITIZE, 4 DEAL, 5 SPIRAL |
| `uTime`, `uDt` | float | Seconds. Frozen under reduced motion. |
| `uAperture`, `uFocusZ` | float | Depth of field |
| `uBokehCap`, `uDpr`, `uSizeMin`, `uSizeMax` | float | Point-size policy per tier |
| `uDensityA`, `uDensityB` | float | Per-state alpha gain, so dense shapes don't blow out |
| `uMouse` | vec3 | Pointer on the z = 0 plane |
| `uMouseAmt` | float | Pointer strength |
| `uMouseMode` | int | 0 loupe, 1 push, 2 attract |
| `uRipple` | vec4 | Touch ripple: x, y, t0, amp |
| `uScrollPx`, `uVelocity` | float | Scroll position (dust parallax) and Lenis velocity / 40, clamped ±1 |
| `uSafe[6]` | vec4 | Text-safe rects in CSS px (x0, y0, x1, y1) |
| `uSafeCount` | int | Number of active rects |
| `uGroupW[8]` | float | Per-group focus weight, damped on the CPU (1 = neutral) |
| `uFocusOn` | float | 0–1, damped |
| `uDisperse` | float | Project curtain amount, 0–1 |
| `uCharge` | float | Hover or focus intensity: NDA link, beacon, project title |
| `uNova` | float | Beacon click burst |
| `uBeat` | float | 404 heartbeat |
| `uScanX`, `uPrinted` | float | Hero beam position in su; print state 0–1 |
| `uBarPivot[3]` | vec2 | S2 bar bottom-right corners in local su (for TOPPLE) |
| `uOpacity` | float | Global fade (jump cut, route) |
| `uExposure` | float | Global brightness (ignition, nova) |
| `uPalette[5]` | vec3 | Ramp colours |
| `uAspect`, `uViewport` | float, vec2 | Viewport geometry |
| `uGlow` | bool (define) | Glow-pass variant |

### 3.6 Vertex shader math (`src/field/shaders/field.vert.glsl`)

```glsl
int i = int(position.x);
ivec2 tc = ivec2(i % uTexW, i / uTexW);
vec4 A = texelFetch(uPosA, tc, 0),  B = texelFetch(uPosB, tc, 0);
vec4 mA = texelFetch(uMetaA, tc, 0), mB = texelFetch(uMetaB, tc, 0);
int role = int(mB.a * 255.0) >> 4;

// 1. per-particle local progress — key comes from the ENTERING state, so reverse scroll is an exact mirror
float tl = clamp((uMix - B.w * uStagger) / (1.0 - uStagger), 0.0, 1.0);
float e  = easeFor(uPath, tl);                       // cubicInOut unless the path says otherwise

// 2. each endpoint runs its own live animation, then its anchor transform
vec3 pa = live(uKindA, A.xyz, mA, uTime) * uOffA.z + vec3(uOffA.xy, 0.0);
vec3 pb = live(uKindB, B.xyz, mB, uTime) * uOffB.z + vec3(uOffB.xy, 0.0);
if (role == DUST) { pa = pb = dust(A.xyz, uScrollPx); }  // world-space, never morphs

// 3. path
vec3 p = pathMix(uPath, pa, pb, e, tl, mA);          // see table
p += curl(p * 1.6 + aSeed.xyz * 17.0) * uTurb * sin(PI * tl);
p += idleDrift(p, aSeed, uTime);                     // per-state amp/freq/speed, mixed by e
p.y -= uVelocity * 0.018 * aSeed.z;                  // scroll inertia: the field has mass
p += mouse(p) + ripple(p);                           // §3.7
```

| Path | Formula |
|---|---|
| DEFAULT | `mix(pa, pb, e)` |
| POUR (S1→S2) | `x = mix(pa.x, pb.x, sineInOut(tl))`; `y = mix(pa.y, pb.y, quadIn(tl))`. Over tl ∈ [.88, 1]: `y += 0.013·sin(2π·(tl − .88)/.12)·(1 − (tl − .88)/.12)`. That is a damped 6px landing bounce. `z = mix`. |
| TOPPLE (S2→S3) | Quadratic Bézier `pa → c → pb`, where `c = pivot + R(−60°)·(pa − pivot)` and `pivot = uBarPivot[group of mA]`. The bars fall to the right like dominoes. |
| DIGITIZE (→S5) | DEFAULT, but for .3 < e < .7 the position is 60% quantised to a 0.05 su grid. |
| DEAL (→S6) | DEFAULT with `z += 0.7·sin(πe)`. The director opens `uAperture` to .35 mid-segment, so the cards deal through the lens. |
| SPIRAL (→S9) | The in-flight offset `(p − centre)` is rotated about Z by `1.4π·(1 − e)` while the radius lerps. |

**Depth of field and size.**

- `persp = 3.732 / (3.732 − p.z)`.
- `coc = uAperture · min(abs(p.z − uFocusZ), 3.0) · 4.5 + groupBlur`. `groupBlur = 1.2·(1 − w)` for S8's unfocused plates.
- `dof = 1 + coc`.
- `sizeCss = mix(uSizeMin, uSizeMax, aSeed.x²) · persp · dof`.
- `cap = aSeed.w < .35 ? uBokehCap : 6.0`.
- `gl_PointSize = min(sizeCss, cap) · uDpr`.
- Alpha: `mix(mA.g, mB.g, e) · mix(uDensityA, uDensityB, e) / pow(dof, 1.6) · uOpacity · uExposure`.
- `vBokeh = smoothstep(2.0, 3.5, dof)`.

**Colour.** Ramp through `uPalette` at `mix(mA.r, mB.r, e)`. Then:

- Group focus: `alpha *= mix(.35, 1, w)`. Where `w > .7`, mix 70% toward ember in S8.
- Pointer: +30% brightness near the pointer.

**Text-safe mask** (in the vertex shader, on the final screen position):

```glsl
for (int k = 0; k < uSafeCount; k++) {
  vec2 d = max(uSafe[k].xy - px, px - uSafe[k].zw);   // signed distance outside the rect
  float inside = 1.0 - smoothstep(0.0, 24.0, max(d.x, d.y));
  alpha *= mix(1.0, 0.22, inside);
  rampPos = mix(rampPos, min(rampPos, 0.5), inside); // no ember behind text
}
```

The rects are computed **analytically** each frame from stage-local rects and scroll (§9.6). Nothing is measured per frame.

### 3.7 Idle, input and live motion

- **Idle drift:** 3D simplex curl noise; the per-state amp/freq/speed values are in §3.10. On the Low tier, a 2-octave sin flow replaces curl (the same amplitudes, cheaper).
- **Twinkle** in settled states: `alpha *= 1 + .15·sin(t·(.5 + 2·aSeed.y) + 6.28·aSeed.y)`.
- **Mouse** (`pointer: fine` only, full motion only):
  - The pointer is projected onto z = 0: `X = ndc.x·A`, `Y = ndc.y`.
  - It is damped at a rate of 0.14 per frame, corrected for dt. Radius r = 0.24 su.
  - **S0 and S10 — loupe:** particles within r are pulled `z → mix(z, 0, .85·(1 − d/r)²)`, so they turn sharp and bright. The loupe's r is 0.32 su (wider than push / attract, so the lens reads at a glance).
  - **Loupe peek (hero rest, S0 → S1):** S1 grains whose *target* lies under the lens are pulled onto it and brightened, so a sharp fragment of the name shows through the loupe before the first scroll. Only grains whose source is within 1.2–2.2 su (soft) travel, so nothing streaks across the frame.
  - **S1–S8 — push:** up to 0.05 su outward with a `(1 − d/r)²` falloff, and +30% α.
  - **S9 — attract:** −0.08 su, so the beacon leans toward the cursor.
  - `uMouseAmt` eases to 0 over 400 ms on `pointerleave` or blur.
- **Touch ripple** (coarse pointers only):
  - Trigger: a tap that moves less than 10px and does not land on an interactive element.
  - Effect: a ring expands to 240 CSS px over 600 ms. Particles within ±0.02 su of the ring are pushed outward by 0.03 su and gain 40% α, fading with `(1 − τ)²`.
  - One ripple at a time.
- **Velocity shiver:** in settled states, add `0.01·abs(uVelocity)` su of jitter.

### 3.8 Fragment shader and glow pass

```glsl
float d = 2.0 * length(gl_PointCoord - 0.5);
if (d > 1.0) discard;
float crisp = exp(-d * d * 7.0);
float disc  = smoothstep(1.0, 0.86, d) * 0.55 + exp(-d * d * 4.0) * 0.45;   // lens disc with a faint rim
float a = mix(crisp, disc, vBokeh) * vAlpha;
fragColor = vec4(vColor * a, a);                                           // premultiplied additive
```

**Glow pass** (High and Mid tiers): a second `Points` object shares the geometry and uses a cloned material with `#define GLOW`. `drawRange = [0, S)`, which is the sparks only. Size ×5, alpha 0.07, no DOF. There is no post-processing anywhere.

**Fill-rate budget:** ≤ 4 ms on the High tier on an integrated GPU (Iris Xe / M1).

- In the S0 worst case, 35% of particles are bokeh-eligible, capped at 12 CSS px × DPR 1.5 = 18 px, which is about 17k × 250 px² ≈ 4.3 M fragments. The rest are about 0.8 M fragments.
- The spark glow adds about 0.4 M.
- The adaptive downgrade steps down the bokeh cap *before* it halves the count.

### 3.9 Per-state constants (`src/field/uniforms.ts`)

The entering parameters (key, S, T, path) belong to the state being *entered*, and apply unchanged in reverse.

| State | Density | Idle amp / freq / speed | Resting aperture | Mouse | Entering: key | S | T | Path |
|---|---|---|---|---|---|---|---|---|
| S0 STATIC | .55 | .20 / .3 / .035 | .90 | loupe | (intro only: reverse of S1) | — | — | — |
| S1 NAME | .42 | .003 / 1.6 / .06 | .04 | push | sparks 0; others `.15 + .6·normX + .25·rand` | .55 | .35 | DEFAULT |
| S2 CHART | .50 | .002 / 1.6 / .06 | .04 | push | bars `.8·hFrac + .2·bar/2`; axis/grid `.05 + .1·rand`; fizz `.85 + .15·rand`; halo `.5·rand`; sparks 1.0 | .60 | .02 | POUR |
| S3 REDACTED | .38 | .002 / 1.6 / .06 | .04 | push | `.7·row/8 + .3·rand` | .45 | .06 | TOPPLE |
| S4 PULSE | .55 | .004 / 1.6 / .06 | .04 | push | arc length u (draws like a pen) | .60 | .20 | DEFAULT |
| S5 CIVIC LATTICE | .55 | .004 / 1.6 / .06 | .04 | push | `.75·row/rows + .25·rand` (bottom first) | .55 | .08 | DIGITIZE |
| S6 PROMPT DECK | .55 | .004 / 1.6 / .06 | .04 | push | card k: `.18k + .1·rand`; stroke `.8 + .2u` | .50 | .10 | DEAL |
| S7 CONSTELLATION | .55 | .004 / 1.6 / .06 | .04 | push | `rand`; spokes `.4 + .5u` | .35 | .40 | DEFAULT |
| S8 STACK | .50 | .003 / 1.6 / .06 | .04 (+ group blur) | push | `.2·plate + .2·arcLen` | .50 | .18 | DEFAULT |
| S9 BEACON | .60 | .004 / 1.6 / .06 | .04 | attract | `1 − normalised distance from screen centre` (outer first) | .50 | .20 | SPIRAL |
| S10 FLATLINE | .50 | .002 / 1.6 / .06 | .50 → .04 on CTA hover | loupe | (route entry, time-based 1,100 ms) | .40 | .20 | DEFAULT |

**Segment-shaped aperture** (the director applies these on top of the table):

| Segment | Aperture |
|---|---|
| seg0 (S0→S1) | `mix(.9, .04, smoothstep(0, .9, m))` |
| seg1 (Pour) | `.04 + .14·sin(πm)`: the name defocuses slightly as it falls and refocuses on landing |
| seg5 (→S6 deal) | `.04 + .31·sin(πm)` |
| All others | `.04` |

### 3.10 State catalogue

Shares below are fractions of **M (shape)**. Sparks are listed separately; they always carry the ember role.

**Home anchors.** Every home state is authored in a local unit box and **aspect-fit into its anchor box**. Emblems use 90% of the box; halo elements may exceed it.

- Project emblems (S4–S7) use the **card box**. On desktop the card box is width `min(44vw, 88.1svh)` with aspect 1200:953, centred at (70vw, 50vh) when on the right or (30vw, 50vh) when on the left. On mobile it is the project's field slot.

---

#### S0 STATIC — cold open (hero rest, and the intro's destination)

- **Anchor:** the viewport, full bleed on every breakpoint.
- **Recipe:** 64% uniform box, x ∈ [−1.35A, 1.35A], y ∈ [−1.3, 1.3], z ∈ [−4, 1.6]. 36% in 6 Gaussian clumps, with centres uniform in the inner 70% of the box and σ = (.5, .32, .9).
- **Sparks:** x ∈ [−A, A], y ∈ [−.8, .8], z ∈ ±.3. These are the only near-focus points.
- **Colour:** 85% `p-noise` at α .30–.55; 15% `p-steel` at α .45; sparks ember at α .9.
- **Live:** none (drift only).

#### S1 NAME — registered to the DOM `<h1>`

- **Anchor:** the `<h1>` glyph boxes.
  - Desktop: one line, left edge at the gutter, **baseline 62vh**, about 86vw wide, cap height about 14.6vh at 16:10.
  - Mobile: two lines, block top at 20svh.
- **Sampling:** main thread, §9.8.
- **Recipe:**
  - **82% glyph pixels**, with edge pixels (any 4-neighbour at alpha ≤ 128) given 2× selection weight, which gives about 38% edge and 62% interior. z jitter ±.015, xy jitter ±0.4 canvas px.
  - **18% atmospheric band:** name centre ± 1.1 cap-heights, 115% of the name width, z ∈ [−.6, .2], `p-steel` at α .10.
- **Sparks:** an ember hairline 0.14em below the baseline, across the full name width. On the one-line name, 16% of the sparks hang yearly ticks from it (0 … 6; .05em deep, the year-2 boundary .09em).
- **The name is a career timeline** (`NAME_TIMELINE` in `field/layout.ts`). Read left → right (line by line on mobile) it spans 6 years. Glyph grains in the first 2 (the developer years) are `p-steel` in focus group 0; the rest are `p-signal` in group 1. The band and the hairline are group 7, which no hover dims.
- **Colour:** glyphs `p-steel` / `p-signal` by year (above), edges α 1.0, interior α .6.
- **Live:**
  - α shimmer .8–1.0 at .3–.9 Hz.
  - **Scan beam:** particles within 0.02 su of `uScanX` get +180% brightness.
  - **Printed:** `uPrinted` 1 gives α ×.45 and size ×1.5, so the particles become a halo behind the DOM type.

#### S2 CHART — honest career chart (About)

- **Anchor:**
  - Desktop: frame x 54 → 92vw (Wf = 38vw), **baseline 80vh**, 7-year scale H = 52vh, so 1 yr = 7.43vh.
  - Mobile: frame gutter to gutter, baseline at slot-top + 40svh, H = 30svh.
- **Encoding:** a YEARS axis 0–7. Heights are **to scale**. The only unit is the quarter-year.

| Group | Bar | x-centre (frame units) | Width | Value | Composition |
|---|---|---|---|---|---|
| g0 | Developer | .16 | .15 | 2 | 8 quarter slabs, `p-steel` |
| g1 | Product design | .40 | .15 | 4+ | 16 quarter slabs, `p-signal` |
| g2 + g3 | In tech | .64 | .15 | 6+ | **Stacked**: 8 steel slabs (g2, the developer years) under 16 signal slabs (g3, the design years). The bar shows 2 + 4+ = 6+. |
| g4 | AI reporting platform | .90, at .80H | — | 1 (a count, **not years**) | Sparks only, beyond the divider |

- **Shares:**
  - **Bars 76%**, split by area 2:4:6 into 12.67 / 25.33 / 38.00%.
    - Each quarter slab is H/28 tall with a 0.2vh gap; particles are excluded from gaps.
    - Within a slab: 35% on edges (left, right and slab-top line, α .9) and 65% stratified jittered fill (α .55).
    - The top slab of each bar gets α 1.0.
  - **"+" fizz 5%:** 2.5% above bar g1, from 4.0 to 4.5 yrs, and 2.5% above g2+g3, from 6.0 to 6.5 yrs. Density fades linearly to 0 at the top. `p-signal` α .5.
  - **Baseline 4%:** x 0 → .78, `p-steel` α .3.
  - **Gridlines 4%:** at 2, 4 and 6 yrs from x 0 to .78, dotted (keep `fract(u·60) < .45`), `p-steel` α .14.
  - **Divider 2%:** dashed vertical at x .80 from 0 to 7 yrs (keep `fract(v·30) < .5`), `p-steel` α .2.
  - **Halo 9%:** Gaussian, σ = (.22Wf, .15H), `p-steel` α .06.
- **Sparks (g4):** 60% on a core disc (σ .010 su) and 40% on a reticle ring (r .028 su).
- **Live:**
  - Fizz rises: `y = base + fract(u0 + .12t)·band`, `α·(1 − f)²`.
  - The AI point pulses at 0.5 Hz (α .8–1) and its reticle dots rotate at .3 rad/s.
  - Bars never wobble: heights are data.
- **Focus groups** (hovering a stat, `uGroupW`; the stat blocks are `aria-hidden`, see §5 C1):

| Stat | Groups lit |
|---|---|
| Developer | g0, g2 |
| Product design | g1, g3 |
| In tech | g2, g3 |
| AI platform | g4 |

#### S3 REDACTED — NDA

- **Anchor:**
  - Desktop: block x 54 → 92vw, vertically centred in the NDA section, about 42.5vh tall.
  - Mobile: slot block gutter to gutter, heights ×.7.
- **Recipe:** 9 left-aligned slabs.
  - Width × block: [.92, .78, .96, .54, .88, .71, .93, .40, .66].
  - Height .05 su. **Slab 2 is .09 su tall** and has a **lock-shaped negative space**, centred at 26% of its width:
    - Body: a rounded rect .042 × .036 su, 1.5px corner radius.
    - Shackle: an upper half-annulus with outer r .016 and inner r .010 su.
  - Gap .045 su.
  - Edges get 30% extra density.
  - **Slabs 88%, halo 12%.**
- **Sparks:** 60% trace the lock outline inside slab 2; 40% form an ember keyline .03 su left of the block, full block height.
- **Colour:** `p-signal` at α .42, which reads as bone-grey slabs.
- **Live:** a scan band 0.06 su tall sweeps top → bottom every 4.5 s (+45% brightness).
- **`uCharge`** (hovering or focusing "Request by email"): the scan speeds up ×3 and the slabs dim 30% from top to bottom. It is a peek that reveals nothing.

#### S4 PULSE — "your city's open data, one question away"

Local box W × .64W, aspect-fit into the card box.

- **Bubble outline 30%:**
  - A rounded rect W × .78H with radius .16W, sampled by arc length with ±.003 jitter.
  - The tail runs (.18W, bottom) → (.08W, bottom − .2H) → (.34W, bottom).
- **Interior fill 8%:** α .10.
- **ECG line 26%:** a polyline through the bubble centre. Points (x, y in bubble heights):
  - (.08, 0), (.34, 0), (.38, .05), (.42, −.04), (.46, .36), (.50, −.30), (.54, .04), (.60, 0), (.92, 0).
  - Stores u (arc length).
- **Persistence ghosts 12%:** three copies of the ECG at u-offsets −.02, −.04 and −.06, with α .5, .25 and .12.
- **Rings 18%:** 3 circles on the spike apex, radii .12W, .24W, .36W, at z −.05, `p-steel` α .35.
- **Halo 6%.**
- **Sparks:** on the spike segment.
- **Live:**
  - A Gaussian highlight travels along u with a 2.4 s period, shifting from signal to ember.
  - The rings expand by `+.12W·fract(t/2.4)` and fade, pinging as the highlight crosses the spike.

#### S5 CIVIC LATTICE — Gov Data Generator (a civic building made of records)

- **Geometry:** built procedurally with point-in-shape tests, so there is **no canvas**, in a 640 × 520 unit space:
  - 3 steps: 600 / 558 / 516 wide × 16 each.
  - 6 columns, 26 × 150, each with a 34 × 8 capital.
  - Entablature 560 × 22.
  - Pediment: a triangle with base 560 and height 64.
  - Drum 220 × 40.
  - Dome: a half-ellipse 220 × 110.
  - Lantern 24 × 30.
- **Lattice:** a strict 10-unit grid gives about 1,900 nodes and **52 rows**. Particles are dealt round-robin across the nodes; duplicates stack backward in z at .018 su steps, up to 8 layers. Stores the row.
- **Shares:** lattice 90%, halo 10%.
- **Colour:** back layers (z < −.05) are `p-steel`; the rest `p-signal`.
- **Sparks:** the write-head row.
- **Live, the write-head:** row r_w sweeps bottom → top in 3.2 s, then holds 0.8 s.
  - Rows below r_w: α .85, crisp.
  - Row r_w: ember, +80% brightness, and the sparks live here.
  - Rows above r_w: α .22 with ±.01 jitter, which reads as "not yet generated".
- **DOM sync:** an aria-hidden `.t-micro` counter "ROWS 00/52" follows r_w (written through a ref at 30 Hz).

#### S6 PROMPT DECK — Prmpt Art (from prompt to art)

- **Cards:** 5 card outlines, each .62 × .86 units with radius .05.
  - Rotations −16 / −8 / 0 / 8 / 16° about a pivot at (0, −1.25).
  - z = −.07·abs(k − 2).
  - The 4 back cards take 4% each (16%); the front card takes 8%.
- **Front card content:**
  - **A procedural `›_` with no font dependency: 24%.** The chevron is two strokes (−.16, .18) → (0, 0) → (−.16, −.18) with stroke width .045; the underscore is a rect (.04, −.20)–(.20, −.16). Both are in front-card units, upper-left area.
  - Three dotted text lines at widths .72 / .50 / .62: 10%.
- **Art stroke 36%:** a cubic Bézier through (−.85, .72), (−.3, 1.25), (.35, .3), (.9, .95), with Gaussian cross-section σ .035, tapered at both ends. Colour grades from ember to signal along u.
- **Halo 6%.**
- **Sparks:** 70% at the stroke's ember head, 30% on the underscore (the blink).
- **Live:** the underscore blinks between α 1 and .12 on a 1.06 s square wave with 80 ms edges. Stroke particles flow along u at .05/s.

#### S7 CONSTELLATION — MCP App (a hub and its tools)

| Element | Geometry | Share |
|---|---|---|
| Hub | Sphere shell, r .09 | 7% |
| Ring | r .62, tilted 62° about X, dotted | 7% |
| Satellites | 6 shells, r .045, 60° apart on the ring | 18% |
| Spokes | 6 lines hub → satellite, storing u | 24% |
| Chords | Between neighbouring satellites | 6% |
| Halo | Fibonacci shell, r 1.0, `p-noise` α .06 | 38% |
| Sparks | Hub core | — |

- **Live:**
  - The graph rotates about Y at .07 rad/s.
  - Spoke particles flow with `u = fract(u0 ± .2t)`: odd spokes outbound, even spokes inbound (request / response).
  - 1 in 10 spoke particles is an ember packet drawn at 1.8× size.

#### S8 STACK — What I do (four isometric layers)

- **Anchor:**
  - Desktop: centre (70vw, 54vh), box 36vw × 64vh.
  - Mobile: slot box 84vw × 40svh. s = min(boxW, boxH).
- **Plates:** four rounded rects in the XZ plane, W .9s × D .6s, radius .06s, at heights y = +.27s, +.09s, −.09s, −.27s. The group is rotated 45° about Y, then 35.264° about X (true isometric).
- **Each plate (25%):** 40% on the perimeter, 60% on its motif.

| Plate | Group | Motif |
|---|---|---|
| Product Design | g0 (top) | Header strip, two content blocks, three text lines |
| Data Visualization | g1 | A 7-point polyline, values [.2, .45, .35, .7, .55, .85, .75], standing off the plate by value × .08s |
| Design Systems | g2 | A 6 × 4 grid of rounded squares; tile (2, 1) is filled |
| Prototyping | g3 | Three node rects, two arrows and a cursor glyph |

- **Sparks:** 40% on the filled tile, 40% on the 7 chart markers, 20% on the cursor tip.
- **Live (focus):**
  - The active plate's `uGroupW` goes to 1: it lifts +.06s along local y, slides +.08s along local x (a drawer being pulled), mixes 70% toward ember and stays sharp.
  - Inactive plates: `p-steel`, α ×.35, and **+1.2 CoC**, so they rack out of focus instead of only dimming.

#### S9 BEACON — Contact

- **Anchor:**
  - Desktop: centre (50vw, 52vh), R = 12vh.
  - Mobile: centre (50vw, 46svh), R = 24vw.

| Element | Geometry | Share |
|---|---|---|
| Shell | Fibonacci sphere at R ± .01R | 52% |
| Core | Gaussian, σ .22R | 18% |
| Ring | r 1.45R, tilted 18°, band .03R | 14% |
| Infall | 5 logarithmic spirals from 2.6R to R | 13% |
| Halo | — | 3% |
| Sparks | Core, σ .06R, `p-core` | — |

- **Live:**
  - The shell rotates about Y at .06 rad/s and breathes: `R·(1 + .03·sin(2π·.2t))`.
  - The ring spins at .12 rad/s.
  - Infall particles move inward: `u = fract(u0 − .07t)`.
  - Rim: shell particles with `abs(n·v) < .25` turn ember; the rest are `p-signal` at α .5. The core is `p-core` at α 1.
- **`uCharge`** (hovering or focusing the beacon CTA): core σ ×1.4, ring speed ×3, rim threshold .25 → .45, exposure +25%.
- **`uNova`** (click): R ×1.8 over .5 s (expo.out), then back over 1.2 s. `mailto:` opens immediately; the animation plays alongside it and never delays it.
- **Sink** (footer): the anchor centre moves to the footer horizon, scale ×.45, α ×.6 (§5, C6).

#### S10 FLATLINE — 404 only, generated lazily

- **Anchor:**
  - Desktop: a line from 8vw to 92vw at 68vh.
  - Mobile: gutter to gutter at 70svh.
- **Recipe:** line 70% (perpendicular σ .003 su), persistence ghosts 12%, halo band 18% (`p-steel` σ .05 su).
- **Sparks:** a scan head that crosses the line every 3.2 s.
- **Live:** the line is flat. `uBeat` fires one heartbeat, centred on screen: `y += uBeat·.14·ECG(x)`. ECG is a sum of Gaussians:

| Wave | Amplitude | Position | σ |
|---|---|---|---|
| P | +.12 | .18 | .025 |
| Q | −.12 | .37 | .008 |
| R | +1.0 | .40 | .010 |
| S | −.28 | .43 | .010 |
| T | +.28 | .62 | .04 |

  Heat rises to ember where abs(ECG) > .5.

**Reduced-motion poster frames:** `uTime` is frozen per state.

| State | Poster frame |
|---|---|
| S4 | Highlight centred on the spike |
| S5 | Fully printed |
| S6 | Caret on |
| S7 | Packets mid-spoke |
| S9 | Breath at mean radius |
| S10 | Flat |

---

## 4. Scroll structure

### 4.1 Desktop document map

Chapters are `<section>`s. A **sticky** chapter is `height: calc(100svh + L)` and contains a `.stage { position: sticky; top: 0; height: 100svh }`. There are no GSAP pins anywhere.

| Chapter | Element id | Type | L | Doc range (vh) | Stage stuck while scrollY ∈ |
|---|---|---|---|---|---|
| C0 Hero | `top` | Sticky | 90 | 0–190 | 0–90 |
| C1 About | `about` | Sticky | 120 | 190–410 | 190–310 |
| C2 NDA | `work` | Flow, 90vh | — | 410–500 | — |
| C3 Side projects | `projects` | Sticky | 250 (4 windows × 62.5) | 500–850 | 500–750 |
| C4 What I do | `capabilities` | Sticky | 100 | 850–1050 | 850–950 |
| C5 Contact | `contact` | Sticky | 40 | 1050–1190 | 1050–1090 |
| C6 Footer | — | Flow, 40vh | — | 1190–1230 | — |

Total 1,230vh; 1,130vh scrollable. That is −25% against the proposal's roughly 1,500vh. Every sticky chapter has a hold of at least 25% of L in which no DOM text moves (the hold rule).

### 4.2 Mobile document map

Mobile uses the mobile layout (< 768px, or portrait < 1024px).

- **Only C0 (L = 50svh, section 150svh) and C5 (L = 30svh, section 130svh) are sticky.** Everything else is normal flow and sized by its content (about 1,300svh in total).
- Each flow chapter opens with an empty `aria-hidden` **field slot** that holds `data-field-anchor`. The shape registers to that slot and scrolls with it. Text flows below the slot, so shapes and text never overlap by construction.
  - Slot heights: About 52svh, NDA 44svh, each project 42svh, Capabilities 44svh.
  - When text does pass over dust or a morph in flight, **text wins**: the text-safe mask and the scrim both apply.
- **Short or landscape phones.** If height < 600px, slots shrink to 34svh and shapes scale ×.8. If width > height and height < 500px, use the desktop split layout at Low tier with only the hero sticky. Test at 360×640, 390×844 and 844×390.
- `svh` everywhere, plus `ScrollTrigger.config({ ignoreMobileResize: true })`.

### 4.3 Film position: the single scroll → state mapping

The home film is the state chain S0 → S1 → … → S9. Segment k morphs S_k → S_{k+1}. **Scroll maps to a continuous film position F ∈ [0, 9]**:

- F = k inside the hold before segment k.
- F = k + t while scrolling through segment k.

The director damps the displayed position toward the target every frame: `F += (F* − F)·(1 − 2^(−dt/h))`, with h = 120 ms (60 ms while rewinding).

The pair on screen is `(a, b) = (S_floor(F), S_floor(F)+1)` with `uMix = F − floor(F)`. Crossing an integer is seamless, because the two adjacent pairs share the endpoint state at `uMix` = 1 or 0 and every particle has arrived. **The field therefore passes through intermediate states continuously and never pops.**

**Desktop segment table** (`src/scroll/segments.ts`). Offsets are relative to chapter tops, which are written into the store by each chapter's ScrollTrigger `onRefresh`. Global values are shown for reference.

| Seg | Pair | Start (y0) | End (y1) | Global (vh) |
|---|---|---|---|---|
| 0 | S0 → S1 (rack focus) | `top` + 5.4 (hero p .06) | `top` + 55.8 (p .62) | 5–56 |
| 1 | S1 → S2 (Pour) | `top` + 96 | `about` + 10 | 96–200 |
| 2 | S2 → S3 (topple) | `work` − 85 | `work` − 25 | 325–385 |
| 3 | S3 → S4 | `projects` − 70 | `projects` + 10 | 430–510 |
| 4 | S4 → S5 | `projects` + 62.5 | + 81.25 | 562.5–581.25 |
| 5 | S5 → S6 | `projects` + 125 | + 143.75 | 625–643.75 |
| 6 | S6 → S7 | `projects` + 187.5 | + 206.25 | 687.5–706.25 |
| 7 | S7 → S8 | `capabilities` − 80 | `capabilities` + 10 | 770–860 |
| 8 | S8 → S9 (spiral) | `contact` − 85 | `contact` + 0 | 965–1050 |
| — | fx: beacon sink | `contact` + 40 | `contact` + 80 | 1090–1130 |

**Mobile segment table.**

- seg0: hero `top` + 3 → + 35svh (p .06 → .70).
- Every other segment into chapter X runs while **X's field slot top moves from 100% to 40% of the viewport** (y0 = slotTop − 100svh, y1 = slotTop − 40svh).
- seg8 is the exception: the contact section top moves from 100% to 0%.
- Sink: `contact` + 30svh → document end.

### 4.4 Jump cut, rewind and nav jumps

- **Jump cut.**
  - Trigger: `abs(F* − F) > 1.5`, sustained for more than 80 ms, while not rewinding and not in the intro. Cooldown 800 ms, so there are never more than 1.25 cuts per second.
  - Sequence:
    1. `uOpacity` → 0 over 250 ms.
    2. Snap F = F*.
    3. `uOpacity` → 1 over 400 ms.
  - A normal trackpad fling stays under the threshold, because the damp lag is about velocity × 0.17 s. Only nav jumps, rail clicks, restores and violent flings trigger it.
- **Nav, rail and hash jumps.**
  - Targets are the start of each chapter's hold, in scrollY: Title 0, About `about` + 10, Work `work` + 0, What I do `capabilities` + 10, Contact `contact` + 0.
  - Target within 2 film states: `lenis.scrollTo(y, { duration: 1.2, easing: expo.inOut })`.
  - Otherwise, a **jump cut**:
    1. A void overlay (z 60) fades in over 300 ms, together with the field.
    2. `lenis.scrollTo(y, { immediate: true })`.
    3. `ScrollTrigger.update()`, and the director snaps.
    4. The overlay fades out over 400 ms.
  - Afterwards, focus moves to the chapter's `<h2>` (`tabindex="-1"`).
- **Back to top = the rewind.**
  - `lenis.scrollTo(0, { duration: 2.4, easing: expo.inOut })` with `store.flags.rewinding = true`. The jump cut is disabled and the damp half-life is 60 ms, so the whole film visibly plays backward.
  - One-shot effects (scan beam, ignition, nova) are suppressed. Scrubbed DOM follows scroll naturally.
  - Under reduced motion it becomes an instant jump.

---

## 5. Chapter choreography and final copy

Conventions:

- **p** is sticky progress over L (`start: 'top top'`, `end: 'bottom bottom'`).
- **Transit** is the 100vh in which a stage scrolls in or out.
- **Line mask** means GSAP `SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true, aria: 'auto' })` with `yPercent 105 → 0`, 700 ms at 90 ms stagger when time-based, or `ease: none` when scrubbed.
- All chapter reveals complete **during the transit-in**, so the whole stuck range is readable. Within a stuck range, only colour and emphasis change (hold rule).
- Every scrubbed ScrollTrigger uses `scrub: true`, because Lenis already smooths.

### C0 Hero — sticky, L = 90vh (mobile 50svh) — `#top`

**Layout (desktop).** The first-paint composition is complete DOM and needs no JS.

| Element | Class | Position |
|---|---|---|
| Eyebrow | `.t-label` ink-2 | Gutter, baseline 41vh |
| `<h1>` | `.t-name` ink | Gutter, baseline 62vh, one line |
| Lede | `.t-display-m` ink | Gutter, top 70vh, one line |
| CTAs | Primary + text link | Gutter, 81vh |
| Scroll cue (aria-hidden) | `.t-micro` ink-2 | Bottom centre, 92vh, over a 48px, 1px line with a travelling dot |
| S/N meter (aria-hidden) | `.t-label` + `.t-readout` | Right gutter; its 1px track (ember fill = the signal) sits on the eyebrow's baseline. Desktop, JS, full motion only; it takes over the corner HUD in the hero. |
| Timeline axis (aria-hidden) | `.t-micro` ink-2 | Under the hairline, in the `<h1>`'s own coordinates: **0**, **Developer** (steel swatch) centred on years 0–2, **2**, **Product design** (bone swatch) centred on 2–6, **6 Years**. Desktop, JS. Fades in over p .50–.62. |
| Stage scrim | `.stage-scrim` | One soft radial scrim behind the lede and CTAs (and a smaller one at the eyebrow), replacing the per-block `[data-safe]` boxes (`.soft-scrim` chapter). |

**Layout (mobile).** Eyebrow at 14svh. Name on two lines at 20–38svh. Lede on two lines at 44svh. CTAs stacked full width at 58svh, each 48px tall. No scroll cue.

**Copy.**

- Eyebrow: **Senior Product Designer — Tyler Technologies**
- h1: **Stephen Webb** (uppercase through CSS; the DOM text stays "Stephen Webb")
- Lede: **I make complex data** *feel obvious.* (the accent in Instrument Serif italic, ember)
- CTAs:
  - **View work ↘** → `#work`: ember background, void text, 48px tall.
  - **Get in touch** → `#contact`: ink text link with a 1px underline that scales in on hover.
- Scroll cue: **Scroll to resolve**

**Timeline.**

| p | What happens |
|---|---|
| 0–.06 | Rest. S0 with the loupe (and its peek) active; the S/N meter reads 0.03. The masked `<h1>` shows as a **ghost** at 11% (`--ghost`), so the name's place is never an empty hole; the ghost fades out over p .30–.58 as the particles resolve. |
| .02–.08 | The scroll cue fades out. |
| .06–.62 | **seg0**, the rack focus: S0 → S1 with the aperture going .9 → .04. The HUD climbs to 1.00. Eyebrow, lede and CTAs stay perfectly still; the lede captions the effect. |
| .62 | **Lock**, time-based with hysteresis (§9.5, §10). Fires forward when p ≥ .62 **and** F ≥ .97; reverses when p < .56 or F < .90. The scan beam sweeps left → right in 900 ms (`cine`), and `--scan` prints the DOM h1. Then `uPrinted` goes 0 → 1 over 500 ms: particles become a .45-α halo. |
| .62–1 | Hold, 38% of L. **Hover the name** (fine pointer, full motion): it unprints (the particles take over), the hovered span of the timeline lights (S1 groups 0 / 1, `focusOn` glow) and a readout above the pointer names it from `stats` (**2** Years as a Developer, **4+** Years in Product Design). Leaving re-prints it with the beam. The same readout works while the name is formed but not yet locked (F .90–1.04). |
| Exit transit | seg1 (the Pour) starts at `top` + 96. Its first 120 ms is time-based: `--scan` fades to 0 and `uPrinted` goes to 0, so the DOM type "hands its glyphs back" and the particle name ignites. |

### C1 About — sticky, L = 120vh — `#about`

**Layout (desktop).**

- Text column from the gutter to 44vw.
- Chart figure on the right, sharing the S2 anchor.
- Numerals sit 2vh above each bar top; labels sit under the baseline.
- Mobile: chart slot (52svh) first, then the text.

**Copy.**

- h2 (styled `.t-label`, ember): **01 — About** (the "01 — " part is `aria-hidden`)
- Statement (`.t-display-l`, `data-safe`): **I design products where** *data meets decisions*
- Portrait:
  - File `headshot-2-optimized.jpg`, 600×800, shown at 120×160.
  - `grayscale(1) brightness(.9)`, 1px line frame, radius 12px.
  - alt "Portrait of Stephen Webb". `loading="lazy"`, width and height set.
- Paragraph 1 (`.t-body` ink-2): *I'm a Senior Product Designer at Tyler Technologies with a background in front-end development. I spent two years writing code before moving into design — which means I think in systems, components, and real constraints.*
- Paragraph 2: *Right now I'm leading the end-to-end redesign of our reporting platform, re-envisioning it as an* **AI-centric experience** *— giving users specific, use-case-driven reporting tools that actually meet their needs.* ("AI-centric experience" is in ink.)
- Chart `<figure aria-labelledby>`:
  - Axis title **Years**. Ticks **0 2 4 6** (`.t-label` ink-2). The y-axis, baseline and ticks are an inline SVG, 1px line-strong.
  - Bars, with the numeral (`.t-stat` ink), the label (`.t-label` ink) and the note (`.t-body` 14px ink-2):
    - **2** — Years as a Developer — *I speak your engineers' language*
    - **4+** — Years in Product Design — *Discovery to delivery*
    - **6+** — Years in Tech — *SaaS, gov-tech, AI* (the stacked bar, with a legend of steel and bone swatches: "Developer", "Product design")
    - Past the divider: **1** — AI Reporting Platform — *End-to-end redesign*, with a 1px ember leader line.
  - Visually hidden `<table>` with columns *Stat | Value | Note*, holding the four rows above verbatim. The visible numerals that count up are `aria-hidden`; the table holds the final values.
  - When the field isn't live (no JS, no WebGL, fallback), SVG bars with a dotted pattern fill are shown instead (`html:not([data-field="live"]) .chart-bars { display: block }`).

**Timeline** (transit-in plus stuck):

| When | What happens |
|---|---|
| y 96 → 200 | **seg1, the Pour** (§10). |
| About top 60% → 15% | Statement line mask. |
| About top 40% → 0% | Axis and baseline draw (stroke-dashoffset); tick labels fade in 30 ms apart. |
| About top 35% → 0% | Portrait and paragraphs fade up (y 16px → 0). |
| seg1 m .55 → 1 | **Numerals count in lockstep with the field.** Each bar's value = value × `smoothstep(.55 + .1k, .95 + .05k, m)`, where m is the director's *displayed* uMix, so the numbers match the grains actually landing. They snap to "2", "4+", "6+" at m ≥ .995. |
| seg1 m ≥ .98 | Time-based, once, 500 ms: the AI point ignites, the leader line draws, and its label fades in. |
| Stuck p 0–1 | **Hold.** Hovering a stat sets `uGroupW` (S2 focus groups) over 500 ms. The visible stat blocks are `aria-hidden` and not focusable, because the hidden table carries the same rows; keyboard and screen-reader users read the table. |

### C2 NDA — flow, 90vh — `#work`

**Layout.** Desktop: text on the left, vertically centred; S3 on the right. Mobile: slot, then text.

**Copy.**

- h2 (`.t-label` ember): **02 — Selected work**
- Lucide `Lock` icon (14px, ember, stroke 1.5) + `.t-label` ember: **Under NDA**
- h3 (`.t-display-m` ink): **Tyler Technologies case studies**
- Body (`.t-body` ink-2): **Detailed case studies from my work at Tyler Technologies. Available upon request.**
- Link: **Request by email →** → `mailto:stephen@designthewebb.com?subject=Case%20study%20request`. The label makes clear it is an email request and does not suggest the case studies are online.

**Timeline.** seg2 (the topple) runs at y 325 → 385. Text fades up when the section top moves from 75% to 35% (stagger .05). Hovering or focusing the link sets `uCharge` on S3.

### C3 Side projects — sticky, L = 250vh (4 windows × 62.5vh) — `#projects`

**Stage chrome** (persistent):

- Top-left: h3 (`.t-label` ink-2) **Side projects**.
- Top-right: aria-hidden `.t-micro` **01 / 04**. Its digits roll vertically over 400 ms when the window changes.

**Panel k layout.** Panels alternate sides:

| Project | Card and silhouette | Text column |
|---|---|---|
| Pulse | Right | Left |
| Gov Data Generator | Left | Right |
| Prmpt Art | Right | Left |
| MCP App | Left | Right |

- Text columns are 4–38vw (left) or 62–96vw (right).
- Inactive panels are `opacity: 0; pointer-events: none` but **stay in the DOM and in the tab order**. Focusing inside panel k scrolls to that window's hold.

**Panel contents:**

- Index: `.t-label` ember, **P/01**, …
- h4 (`.t-title` ink): a `Link` to `/work/:slug` with the project title.
- Description: `.t-lede` ink-2, verbatim.
- Tag chips: `.t-label` ink-2, 1px line border, pill.
- Links (`.t-label` ink, 44px hit areas):
  - **Project details →** (aria-label "Pulse — project details")
  - **Live site ↗** (only when `liveUrl` exists; aria-label "Pulse live site")
  - **GitHub ↗** (aria-label "Pulse source on GitHub")
  - Both external links: `target="_blank" rel="noopener noreferrer"`.
- Screenshot card:
  - Surface background, 1px line border, 16px radius, shadow `0 0 80px rgb(255 106 61 / .12)`.
  - Sized to the card box (width `min(44vw, 88.1svh)`, aspect 1200:953).
  - `<img width="1200" height="953" loading="lazy" decoding="async" alt="{title} screenshot">`.
  - The card is a real, focusable `Link` to `/work/:slug` with accessible name "Open {title} project details". The cursor ring labels it "Open".

**Window timeline** (q = local progress in window k):

| q | Window 0 (Pulse) | Windows 1–3 |
|---|---|---|
| 0–.12 | (Stage still arriving: seg3 runs y 430 → 510; text line-masks in while the section top moves from 30% to stuck q .10) | The previous card closes (clip back to `inset(50%)`) and the previous text exits (opacity 0, y −20px). |
| 0–.30 | — | seg(3+k) morphs to this emblem. |
| .14–.30 | — | Index and title line-mask in; description, chips and links fade up 16px, stagger .03. |
| .16/.30–.40/.42 | Silhouette hold (fully formed, live) | Silhouette hold |
| .40/.42–.55/.56 | **Curtain:** `uDisperse` 0 → 1 scales the emblem ×1.6 about the card centre with α ×.35, so it becomes a living halo framing the card. The card opens with clip-path `inset(50% round 16px)` → `inset(0 round 16px)` and scales .96 → 1. | Same |
| .55/.56–1 | **Hold, 44–45%.** The card stays **open and large** and the text is readable. Only the emblem's live loop moves. | Same |

- **Gov Data Generator:** the ROWS counter is visible during the silhouette hold, under the emblem.
- **MCP App (no screenshot):** there is no curtain. At q .42–.56 the constellation grows ×1.15 into the card box, and a `.t-label` ink-2 caption **Screenshot coming soon** appears under it, followed by the GitHub link.
- **Hovering the title** gives `uCharge` .5 on the emblem, and the cursor ring shows "Open".

**Mobile.** Four flow blocks. Each has its slot (the emblem), then the text, then a full-width inline card, then full-width 48px link buttons. There is no curtain.

### C4 What I do — sticky, L = 100vh — `#capabilities`

**Layout (desktop).** Left column from the gutter to 49vw; S8 on the right (its drawn stack starts at about 53vw). The column is wider than a 44ch caption column on purpose: every description must stay on **two lines** (the `.t-body` 62ch measure). At 44ch each description takes three lines, and the heading, statement and four rows then need about 900–930px of height, so the stuck 100svh stage would overflow and fall back to flow on every laptop height below about 1000px (1366×768, 1440×900, 1536×864).

**Copy.**

- h2 (`.t-label` ember): **03 — What I do**
- Statement (`.t-display-l`): **Thoughtful craft across the** *full product surface*
- Rows, separated by hairlines. Each has an index (`.t-label`, ember when active and ink-2 otherwise), an h3 (`.t-display-m`), and a description (`.t-body` ink-2, two lines on desktop; see Layout) that is **always visible**:
  1. **Product Design** — From discovery to delivery. I design end-to-end product experiences rooted in user research, business strategy, and systems thinking.
  2. **Data Visualization** — Turning dense datasets into legible, actionable interfaces. Charts, dashboards, and exploratory tools that respect the complexity of real data.
  3. **Design Systems** — Building scalable component libraries and design tokens that keep teams aligned and products consistent across dozens of surfaces.
  4. **Prototyping** — High-fidelity interactive prototypes that communicate intent precisely. I prototype to think, test, and sell ideas—not just to document them.

**Timeline.**

- seg7 runs at y 770 → 860.
- The statement line-masks in while the section top moves from 60% to 15%. The rows fade up from 40% to 5%.
- Stuck, row k is active for p ∈ [k/4, (k+1)/4). A **time-based** step of 500 ms changes the title to ink (others ink-2), turns the index ember, grows a 2px ember rule with scaleY, and sets `uGroupW` for plate k.
- Hover or click on a row sets it active until the scroll window next changes. No DOM text moves (hold rule).

**Mobile.** Flow layout. The row nearest the viewport centre is active.

### C5 Contact — sticky, L = 40vh (mobile 30svh) — `#contact`

**Layout (desktop).**

| Element | Class / details | Position |
|---|---|---|
| h2 | `.t-label` ember | Centre, 10vh |
| Headline | `.t-display-l` | Centred, 13–31vh |
| Beacon | S9 | Centre (50vw, 52vh) |
| Beacon CTA disc | See copy | Centred on the beacon |
| Email row | See copy | 74vh |
| Body | `.t-body` ink-2, max 44ch, centred | 81vh |
| Portrait | See copy | Bottom-left at the gutter, bottom 8vh |

**Layout (mobile).** Headline at 10–24svh; beacon at 46svh; CTA disc; email row at 68svh; body at 76svh with a 56px round portrait inline before it.

**Copy.**

- h2: **04 — Get in touch**
- Headline: **Let's build something** / *worth using*
- Beacon CTA: a DOM `<a href="mailto:stephen@designthewebb.com">`.
  - A circle 1.24R in diameter, background `radial-gradient(circle, var(--color-core) 0 55%, transparent 72%)`.
  - Label **Email me ↗** in Archivo 600, 16px, void.
  - `aria-label="Email me — stephen@designthewebb.com"` (it starts with the visible label, for WCAG 2.5.3 Label in Name).
  - Hover or focus sets `uCharge` = 1 over 400 ms; click fires `uNova`.
- Email row: the address as selectable plain text **stephen@designthewebb.com** (`.t-display-m` ink, `user-select: all`) and a **Copy** button (`.t-label`). The button swaps to **Copied** for 1.6 s and announces through an `aria-live="polite"` region.
- Body: **Always interested in connecting with fellow designers, engineers, and product thinkers. Let's talk shop.**
- Portrait:
  - File `headshot-1-optimized.jpg`, 800×533, shown at `min(15vw, 220px)` wide.
  - `grayscale(1)`, turning to full colour on hover over 400 ms. 1px line frame.
  - alt "Stephen Webb".
  - Caption `.t-label` ink-2: **Stephen Webb — Senior Product Designer**

**Timeline.**

| When | What happens |
|---|---|
| y 965 → 1050 | seg8, spiral convergence. |
| Section top 60% → 15% | h2 and headline line-mask in. |
| Section top 20% → 0% | The CTA disc scales .6 → 1 and fades in. |
| Section top 30% → 0% | Email row, body and portrait fade up. |
| F ≥ 8.98 | **Ignition**: time-based, once, exposure 1 → 1.35 → 1 over 600 ms. |
| Stuck | Hold. |
| contact + 40 → + 80 | **Sink.** The CTA disc fades out over the first 10vh (pointer-events none after that), while the email text stays as the accessible path. The beacon's anchor leaves the stage and moves to the footer horizon, scale 1 → .45, α ×.6. |

### C6 Footer — flow, 40vh

- **Background:** solid `deep` with a 1px line on top. This edge is the **horizon**: the beacon sets behind it, and the opaque footer hides the canvas below it.
- **Content:**
  - `.t-label` ink-3 (on the solid surface): **© {new Date().getFullYear()} Stephen Webb**
  - **GitHub ↗** → https://github.com/stevie2codes and **LinkedIn ↗** → https://www.linkedin.com/in/js-webb/. Both `.t-label` ink, 44px targets, new tab.
  - **Back to top ↑**: the rewind (§4.4).
  - **Motion: Full / Reduced**: a toggle button with `aria-pressed`, persisted in `localStorage['dtw:motion']` (wrapped in try/catch).
- **Wordmark:** an aria-hidden outline wordmark **STEPHEN WEBB** (`.t-name` sizing, `-webkit-text-stroke: 1px rgb(242 238 230 / .12)`, transparent fill), fitted to 94vw and cropped 30% by the page bottom.
- `logo.png` is dropped because it is dark on light.

---

## 6. Global UI

**Nav.** Fixed, 64px tall (56px on mobile), and it never hides.

- **Background:** none at the top. After 40px of scroll, a 96px scrim `linear-gradient(void 85% → transparent)` fades in behind it.
- **Left:** a wordmark `Link` to "/" reading **Stephen Webb** (`.t-label` ink). It collapses to **SW** after the hero (y > 190vh), with the letters in between shrinking to zero width over 500 ms, and expands again on upward scroll.
- **Right (desktop):** **01 About · 02 Work · 03 What I do · 04 Contact** in `.t-label` ink-2 → ink on hover. The active chapter gets a 4px ember dot. After them comes an **Email ↗** pill (1px ember border, ember text; on hover it fills ember with void text) linking to `mailto:`.
- Links scroll with the jump policy in §4.4. From other routes they navigate to `/#id` first.

**Mobile menu.**

- A **Menu** button opens a full-screen overlay in `deep` at 97% (no blur).
- Items are `.t-display-l` with a 60 ms stagger, plus Email, GitHub and LinkedIn at the bottom.
- Focus is trapped, Esc closes it, and focus returns to the button.
- The field's `uOpacity` goes to .3, and the render loop **stops** once the 400 ms open animation completes.

**Rail (desktop).**

- A right-edge 1px line-strong track, 40vh tall, 24px from the edge, vertically centred.
- 5 tick `<button>`s: "Go to title", "Go to About", "Go to Work", "Go to What I do", "Go to Contact".
- An ember fill shows progress; labels appear on hover or focus.
- Mobile shows a 2px ember progress bar under the nav instead.

**HUD (desktop, aria-hidden).**

- Bottom-left, `.t-micro` ink-2 with tabular digits: **S/N 0.03**. In the hero (desktop, full motion) the S/N meter beside the eyebrow carries the same value instead (§5 C0): a stage with a displayed `[data-hud-local]` is not a HUD zone.
- `sn = 1 − clamp(.75·(aperture − .04)/.86 + .25·turb/.4, 0, 1)`, damped over 200 ms and written through a ref at 10 Hz.
- It is the only readout (the hero's meter is the same readout, moved). There is no boot log, no coordinates, no frame timer and no bezel.

**Cursor.**

- **The native cursor is always kept.**
- On `pointer: fine` with full motion, a 24px ring (1px `rgb(242 238 230 / .28)`) follows the pointer with damping .18.
- Over `[data-cursor="open"]` or `[data-cursor="live"]` it grows to 56px with a `.t-micro` label **Open** or **Live**.
- It hides over `[data-cursor="text"]` and form controls.
- It updates through a transform in the gsap ticker, never through React state. There are no magnetic buttons anywhere.

**Intro, "the defocus": first visit, total ≈ 2.3 s. It never locks scroll.**

1. **First paint.** The full hero is DOM: the `<h1>` is visible in ink, with a CSS glow backdrop. This is the LCP.
2. **Field ready.** The field loads by `requestIdleCallback` (timeout 800 ms). Ready means the three chunk is loaded, fonts are loaded, S0 and S1 are built, and one frame has rendered off-screen.
   - If the hero is still at p < .06, the canvas fades 0 → 1 over 300 ms. It shows S1 *printed* (the halo) beneath the DOM `<h1>`, so this step is visually seamless.
   - Otherwise it fades in over 600 ms at the current F, and steps 3–4 are skipped.
3. **Unprint, 600 ms.** The beam sweeps right → left. `--scan` goes 100% → 0% and `uPrinted` goes 1 → 0, so the name is now pure light.
4. **Defocus, 1,400 ms (`cine`).** A director override takes F from 1 → 0, and the aperture goes .04 → .9. The name dissolves from its right end into drifting bokeh, and the HUD falls from 1.00 to 0.03. The scroll cue appears at the end.
5. **Skipping.** Any wheel, touch, key or pointerdown ends the override immediately. The damp then glides to the scroll target, and print state follows the lock rule.
6. **Repeat visits** in the same session (`sessionStorage['dtw:intro']`, wrapped in try/catch) run every duration at ×.5.

The DOM `<h1>` stays in the accessibility tree throughout. Only `mask-image` hides it.

**Page transitions** (the field persists in the App shell, outside `<Routes>`).

- **Home → detail:**
  1. Save `sessionStorage['dtw:home-y']`.
  2. The DOM exits: opacity 0, y −16px, 300 ms, expo.in.
  3. The route swaps, and `lenis.scrollTo(0, { immediate: true })`.
  4. **The field keeps the project's emblem.** Only `uOffB` tweens to the detail anchor over 700 ms (expo.inOut); there is no re-morph.
  5. The detail DOM enters with line masks at 350 ms.
- **Detail → home (back or POP):**
  1. After the home chapters mount, fonts are ready and `ScrollTrigger.refresh()` has run, restore the saved y with `immediate: true`.
  2. Run a **jump-cut resync** (a 400 ms fade in). It never morphs through intermediate states.
- **Forward link to "/" from another route:** start at y 0 at S0 with a 600 ms fade and no intro.

**Project detail `/work/:slug`** (code-split).

- **Field:** director route mode, with the pair locked to the emblem.
  - Anchor (74vw, 40vh) at scale .8. Mobile (50vw, 22svh) at scale .7.
  - As the page scrolls 0 → 100vh, the emblem parallaxes up .3 su and dims to α .25, so the writeup sits over near-void.
- **Hero copy:**
  - **← All work** (`.t-label`, to `/#projects`)
  - **P/0n**
  - h1 `.t-display-xl`: title
  - Description: `.t-lede` ink-2, max 36ch
  - Tag chips
  - **View live ↗** (ember background, void text; only when `liveUrl` exists) and **View on GitHub ↗** (1px line-strong border, ink)
- **Figure:**
  - The screenshot at `min(1100px, 88vw)` with a 16px radius and width and height set.
  - As it scrolls from top 85% to top 35%: clip-path `inset(10% round 16px)` → `inset(0 round 16px)`, scrubbed.
  - **MCP App:** a 100vh aria-hidden spacer. The constellation re-stages to the centre at scale 1.3 with the caption **Screenshot coming soon**.
- **Writeup:**
  - h2 `.t-label` **About this project**.
  - Three paragraphs verbatim from `projects.ts`. The first is `.t-lede` ink; the rest are `.t-body` ink-2, 62ch, starting at column 4.
- **Next project:** a full-width row: **Next project** (`.t-label`), then the title `.t-display-l`, then an arrow.
  - Hover or focus peeks the field 25% toward the next emblem over 600 ms, and reverts on leave.
  - Click commits: m → 1 over 1,100 ms while the DOM exits.
- **Unknown slug:** **Project not found** / *The project you're looking for doesn't exist.* / **Back to work** (→ `/#projects`), all over S0.
- `document.title` = `{title} — Stephen Webb`.

**404** (code-split).

- **Field:** S10 FLATLINE at aperture .5, with the loupe on.
- **Copy:**
  - `.t-label` ember: **404 — Signal lost**
  - h1 `.t-title`: **Page not found**
  - `.t-body` ink-2: **The page you're looking for doesn't exist or has been moved.**
  - **Back to home →**
- **Layout:** text at 24–52vh; the line at 68vh.
- Hovering or focusing the CTA fires one heartbeat (`uBeat` 0 → 1 → 0, 600 ms) and tweens the aperture .5 → .04. The lost signal sharpens as you head home.

---

## 7. Motion principles

1. **Scroll is the only clock for the story.** Time-based moments are limited to:
   - the intro;
   - the lock and print;
   - ignition, nova and heartbeat;
   - step changes (the active capability, the counter roll);
   - hover and focus;
   - route transitions.
2. **The field has mass.** Its 120 ms damp on F, scroll inertia and velocity shiver make it trail the DOM slightly, like something physical.
3. **Hold rule.** Every sticky stage keeps at least 25% of L with no DOM text motion. Body text travels at most 24px, and only when entering or exiting.
4. **Never moves:**
   - body copy once revealed (no parallax, no scramble);
   - the nav and rail positions;
   - buttons and links (colour and underline only; nothing magnetic);
   - the email address;
   - stat numerals after they snap;
   - camera roll and tilt;
   - focus rings.
5. **Never happens:**
   - scroll snapping, detents or scroll-speed changes;
   - native cursor hiding;
   - text rotation, skew or blur;
   - more than 3 flashes per second (jump-cut cooldown 800 ms; one-shots suppressed during rewind);
   - anything bright animating behind text being read (mask plus scrim).
6. **Lenis:** `{ lerp: .085, smoothWheel: true, wheelMultiplier: .9, syncTouch: false, autoRaf: false, anchors: false }`. DOM scrubs use `scrub: true`.

---

## 8. Accessibility & performance

### 8.1 Semantics

- Landmarks: `header` (nav), `main#main`, `footer`. A skip link, **Skip to content**, is the first focusable element.
- One `<h1>` per page. Heading outline:
  - Home: h1 name; h2 About / Selected work / What I do / Get in touch; h3 NDA heading, Side projects and capabilities; h4 project titles.
  - Detail: h1 title; h2 About this project / Next project.
- The canvas, vignette, grain, HUD, cursor ring, counters, the footer wordmark and field slots are all `aria-hidden`.
- The chart is a `<figure>` with a visually hidden `<table>`.
- SplitText uses `aria: 'auto'`, which adds an aria-label and hides the split spans.
- Focus ring: `outline: 2px solid var(--color-ember); outline-offset: 3px` on `:focus-visible`. **Every hover effect also fires on `:focus-visible`.** Touch targets are at least 44px.
- **`focusin` inside a chapter:**
  - The chapter's reveal timelines are forced to progress 1, and the page scrolls to its hold start (Lenis, 600 ms).
  - For project panels, it scrolls to that window's hold.
- `::selection` uses an ember background with void text.

### 8.2 Reduced motion

**Triggers:** `prefers-reduced-motion: reduce` **or** the footer toggle. An inline pre-paint script sets `html.rm`.

- There is no Lenis (native scroll) and no sticky stages: `html.rm .chapter { height: auto; min-height: 100svh }` and `.stage { position: static }`. The Work stage becomes 4 flow panels.
- There are no scrubs, splits, counters, beam, intro or cursor ring. All text is visible from first paint, with a 200 ms opacity-only entrance at most.
- **The field stays registered but still.**
  - Each chapter's final state is drawn at its anchor. Anchors still follow their content as the user scrolls; that is scroll, not animation. Frames render **on demand** on scroll events and at crossfades only, with no rAF loop at rest.
  - When a chapter crosses 50% of the viewport, its state crossfades over 400 ms (two draw calls during the fade).
  - `uTime` is frozen at the poster frames in §3.10. Idle drift, twinkle, inertia and pointer effects are off.
- Nav and rail jumps and Back to top are instant, with focus moved to the target heading.
- Switching modes at runtime:
  1. Revert every `gsap.context` and SplitText.
  2. Destroy or create Lenis.
  3. Toggle `html.rm`.
  4. `ScrollTrigger.refresh()`.
  5. Set the engine mode.

### 8.3 Mobile

- Low tier: 14,336 particles, DPR 1.5, no glow pass, static grain, sin-flow idle, a bokeh cap of 8px in S0 only.
- Sticky only for C0 and C5. Field slots keep text and shapes apart. Tap ripple instead of pointer effects.
- Native touch scroll (Lenis `syncTouch: false`), `svh` units, `ignoreMobileResize`.

### 8.4 No WebGL, and context loss

- **The fallback never imports three.** `src/field/index.ts` runs feature detection before the dynamic import.
  - **Canvas2D fallback** (`fallback2d.ts`): it runs the **same generators** (a pure TS worker) and draws the first 1,500 shape indices plus the first 45 spark indices, a uniform subsample by §3.3. Dots are 1.5px in dust and ember, at the same analytic anchors.
  - It redraws only on scroll frames (rAF-throttled, about 0.3 ms) and during a 400 ms crossfade when the active chapter changes.
  - The chart's SVG bars are shown.
- **If Canvas2D also fails:** fixed CSS glows over void: `radial-gradient(60% 40% at 40% 55%, rgb(255 106 61 / .06), transparent 70%), radial-gradient(50% 50% at 75% 40%, rgb(140 151 173 / .05), transparent 70%)`. This is the same backdrop as first paint.
- **`webglcontextlost`:** `preventDefault()`, pause the loop, and show the Canvas2D fallback. On `webglcontextrestored`, rebuild every texture from the cached `Float32Array`s and crossfade back. After a second loss, stay on the fallback.
- **Content is identical in every path.** No text depends on WebGL, JS or animation.

### 8.5 Budgets

| Item | Budget |
|---|---|
| Frame | 16.7 ms |
| Field GPU | ≤ 4 ms High on Iris Xe / M1; ≤ 6 ms Low on a mid-range Android |
| Main-thread JS per frame | ≤ 2 ms. The director is ≤ .3 ms. There are **no React renders and no layout reads per frame.** |
| Initial JS | ≤ 140 KB gz: React 19, router, gsap + ScrollTrigger + SplitText, lenis, app shell and chapters |
| Field chunk | three (tree-shaken named imports) + engine + shaders ≤ 170 KB gz, dynamically imported after first paint |
| Worker | ≤ 20 KB gz |
| Routes | `/work/:slug` and 404 are code-split |
| Fonts | Archivo latin 90 KB (preloaded); JetBrains Mono 40 KB and Instrument Serif 22 KB (swap) |
| Images | All with width and height; `loading="lazy" decoding="async"` below the fold |
| Targets | LCP (the `<h1>`) ≤ 1.8 s desktop / 2.5 s mobile 4G; CLS 0; TBT ≤ 150 ms |
| Idle | 30 fps after 6 s with no scroll, pointer or morph; stop on `document.hidden`; stop while the menu is open; on-demand under reduced motion |

---

## 9. Implementation architecture

### 9.1 Module layout

```
src/
  main.tsx                      fonts + lenis.css + index.css imports; hydrateRoot(<StrictMode><App/>) over the
                                prerendered HTML (createRoot when #root holds another route's markup, or none)
  entry-server.tsx, routes.ts   build-time prerender of "/", each "/work/:slug" and the 404 (§9.11)
  App.tsx                       BrowserRouter → AppShell: SkipLink, FieldCanvas, Atmosphere, Nav, Rail, Hud,
                                CursorRing, <main><Suspense><Routes/></Suspense></main>, Footer, JumpCutOverlay
  index.css                     @theme tokens (§2.1), @layer base (html/body, focus, selection, lenis, rm),
                                @layer components (.t-* type roles, .stage, .chapter, .scrim, chips)
  content/
    site.ts                     every home string (hero, about, stats, NDA, capabilities, contact, socials)
    projects.ts                 moved from data/projects.ts (+ index, emblem StateId, screenshot w/h, side)
  motion/
    gsap.ts                     registerPlugin(ScrollTrigger, SplitText, CustomEase); CustomEase 'cine'; ST.config
    lenis.ts                    Lenis singleton, ticker wiring, scrollTo helpers (glide / jump-cut / rewind)
    motionPref.ts               resolve reduced motion (media query + toggle), html.rm, subscribe()
    reveal.ts                   lineMask(el, opts) and fadeUp(els, opts) helpers used by chapters
  scroll/
    store.ts                    FieldStore: plain mutable singleton (no React state)
    segments.ts                 desktop + mobile segment tables (chapter-relative), resolve() → px
    director.ts                 pure tick(store, dt) → FieldFrame (film position, damp, pairs, jump cut, overrides)
    anchors.ts                  stage-local rect registry, analytic stageTop(y), safe-rect selection
    useChapter.ts               hook: section + ScrollTrigger + anchors + safe rects → store
  field/
    index.ts                    bootField(): feature detect → import('./engine') | import('./fallback2d')
    FieldCanvas.tsx             host <canvas aria-hidden>, ref-counted acquire/release (StrictMode-safe)
    engine.ts                   renderer, camera, Points + glow Points, material, render loop, tiers, adaptivity,
                                visibility/menu pause, context loss, resize
    tiers.ts                    tier rules + warm-up probe + adaptive steps
    textures.ts                 Float32/Uint8 → DataTexture, cache, rebuild on restore
    uniforms.ts                 uniform objects + per-state constants (§3.9)
    layout.ts                   per-state anchor boxes (vw/svh), desktop + mobile; mirrored to CSS vars
    shaders/field.vert.glsl, field.frag.glsl, noise.glsl, live.glsl   (imported with ?raw)
    states/
      ids.ts                    enum StateId { STATIC, NAME, CHART, REDACTED, PULSE, LATTICE, DECK, CONSTELLATION, STACK, BEACON, FLATLINE }
      common.ts                 mulberry32, golden layout + perm, sort keys, arc-length/area samplers,
                                fibonacci sphere, halo, dust, pack(meta)
      s00-static.ts … s10-flatline.ts   pure generators: (ctx) → { pos: Float32Array, meta: Uint8Array }
      name-sampler.ts           S1 DOM glyph sampler (main thread only)
    worker/generate.worker.ts   runs s00, s02–s10 and transfers buffers
    fallback2d.ts               Canvas2D subsample renderer (no three import)
    debug.ts                    ?debug=field overlay: glyph registration dots, safe rects + luminance sampler,
                                anchor boxes, F / segment / tier readout
  chapters/
    Hero.tsx  About.tsx  CareerChart.tsx  Nda.tsx  Projects.tsx  ProjectPanel.tsx  Capabilities.tsx  Contact.tsx
  components/
    Nav.tsx  MobileMenu.tsx  Rail.tsx  Hud.tsx  CursorRing.tsx  Footer.tsx  SkipLink.tsx  Chapter.tsx (section+stage)
    Atmosphere.tsx  CopyEmail.tsx  Chip.tsx  JumpCutOverlay.tsx  MotionToggle.tsx
  pages/
    HomePage.tsx  ProjectDetailPage.tsx  NotFoundPage.tsx
scripts/make-grain.mjs          one-off: writes public/textures/grain-128.png
```

### 9.2 The store (`src/scroll/store.ts`)

```ts
export type ChapterId = 'top' | 'about' | 'work' | 'projects' | 'capabilities' | 'contact' | 'footer';
export const store = {
  mode: 'full' as 'full' | 'reduced' | 'fallback' | 'css',
  layout: 'desktop' as 'desktop' | 'mobile',
  route: { kind: 'home' as 'home' | 'detail' | '404', slug: '' },
  scroll: { y: 0, vel: 0, H: 0, W: 0 },                         // px; written by Lenis 'scroll'
  chapters: {} as Record<ChapterId, { top: number; height: number; L: number; sticky: boolean;
                                       progress: number; active: boolean }>, // top/height on refresh only
  segments: [] as { a: number; b: number; y0: number; y1: number }[],       // px, resolved on refresh
  film: { target: 0, shown: 0, farFor: 0, lastCut: -1, override: null as null | { a: number; b: number; m: number } },
  fx: { groupW: new Float32Array(8).fill(1), focusOn: 0, disperse: 0, charge: 0, nova: 0, beat: 0,
        sink: 0, printed: 0, scanX: 0, exposure: 1, opacity: 1, ripple: [0, 0, -1, 0] },
  anchors: new Map<number /*StateId*/, { chapter: ChapterId | 'viewport'; cx: number; cy: number; w: number; h: number }>(),
  safe: [] as { chapter: ChapterId; x0: number; y0: number; x1: number; y1: number }[], // stage-local px
  pointer: { x: 0, y: 0, active: false, fine: false },
  flags: { rewinding: false, intro: false, menuOpen: false, hidden: false, printedLock: false },
  version: 0,                                                    // bumped on refresh → engine regenerates if needed
};
```

- **Writers:**
  - Lenis writes `scroll`.
  - Chapter ScrollTriggers write `chapters` and some `fx`.
  - UI handlers write `fx.charge`, `fx.groupW`, `flags`.
  - The director writes `film`.
- **Readers:** the engine's render loop, plus HUD, Rail and Nav through refs at ≤ 10 Hz.
- React never subscribes to it.

### 9.3 Chapters → store (`useChapter`)

```ts
useGSAP(() => {
  const st = ScrollTrigger.create({
    trigger: sectionRef.current,
    start: 'top top', end: 'bottom bottom',                  // sticky: progress over L
    onRefresh: (self) => {                                   // the ONLY layout reads
      const s = sectionRef.current!.getBoundingClientRect();
      store.chapters[id] = { top: s.top + window.scrollY, height: s.height, L: self.end - self.start,
                             sticky, progress: self.progress, active: self.isActive };
      registerAnchorsAndSafeRects(id, stageRef.current!);    // stage-local rects of [data-field-anchor], [data-safe]
      store.version++;
    },
    onUpdate: (self) => { store.chapters[id].progress = self.progress; onProgress?.(self.progress); },
    onToggle: (self) => { store.chapters[id].active = self.isActive; },
  });
  buildRevealTimelines();                                    // scrubbed line masks / fade-ups (transit-in)
  return () => st.kill();
}, { scope: sectionRef, dependencies: [reducedMotion, layout] });
```

After every refresh, `segments.resolve(store)` converts the chapter-relative table (§4.3) into px `y0`/`y1`. Flow chapters use `start: 'top bottom'` and `end: 'bottom top'`, and record their document rect the same way.

### 9.4 Director (`src/scroll/director.ts`)

This is a pure function, unit-tested with Vitest if tests are added.

```ts
export function tick(s: typeof store, dt: number, now: number): FieldFrame {
  const Fstar = s.film.override ? s.film.override.a + s.film.override.m : filmTarget(s.scroll.y, s.segments);
  // jump-cut detector
  const far = !s.flags.rewinding && !s.flags.intro && Math.abs(Fstar - s.film.shown) > 1.5;
  s.film.farFor = far ? s.film.farFor + dt : 0;
  if (s.film.farFor > 0.08 && now - s.film.lastCut > 0.8) startJumpCut(s, Fstar, now);  // fades fx.opacity, then snaps
  const h = s.flags.rewinding ? 0.06 : 0.12;
  s.film.shown += (Fstar - s.film.shown) * (1 - Math.pow(2, -dt / h));
  const seg = Math.min(Math.floor(s.film.shown), 8), m = s.film.shown - seg;
  return { a: seg, b: seg + 1, mix: m, ...enteringParams(seg + 1), aperture: segAperture(seg, m),
           offA: anchorTransform(seg, s), offB: anchorTransform(seg + 1, s), safe: activeSafeRects(s) };
}
function filmTarget(y: number, segs: Seg[]) {       // holds return integers, segments return k + t
  if (!segs.length || y <= segs[0].y0) return 0;
  for (let k = 0; k < segs.length; k++) {
    if (y < segs[k].y0) return k;
    if (y < segs[k].y1) return k + (y - segs[k].y0) / (segs[k].y1 - segs[k].y0);
  }
  return segs.length;
}
```

Route mode:

- **Detail pages** set `override = { a: emblem, b: nextEmblem, m }`, where m = 0, 0.25 while peeking, and 1 on commit.
- **404** sets `{ a: FLATLINE, b: FLATLINE, m: 0 }`.

### 9.5 Engine loop and Lenis + ScrollTrigger integration

```ts
// motion/lenis.ts
lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9, syncTouch: false, autoRaf: false, anchors: false });
lenis.on('scroll', (l) => { store.scroll.y = l.animatedScroll; store.scroll.vel = l.velocity; ScrollTrigger.update(); });
gsap.ticker.add(lenisRaf, false, true);   // prioritize=true → runs FIRST each tick: lenis.raf(time*1000)
gsap.ticker.lagSmoothing(0);
ScrollTrigger.config({ ignoreMobileResize: true });
// field/engine.ts
gsap.ticker.add(renderFrame);              // normal priority → runs AFTER Lenis + ScrollTrigger scrubs
```

**Order within one tick:**

1. `lenis.raf` sets the window scroll.
2. The `scroll` event fires, and `ScrollTrigger.update()` applies DOM scrubs and writes the store.
3. `renderFrame`:
   1. `director.tick`.
   2. Uniform writes. Offsets and safe rects are computed analytically.
   3. Damp `fx` values: `groupW`, `charge`, `disperse` (500 ms / 400 ms time constants).
   4. `renderer.render` for the main pass, then the glow pass.

Under reduced motion there is no Lenis. `store.scroll.y` comes from a passive `scroll` listener, and the engine renders on demand.

**Loop control:**

- Skip rendering when `flags.hidden` (`visibilitychange`) or `flags.menuOpen` after its animation.
- Drop to 30 fps (render every other tick) after 6 s with no scroll delta, pointer move, active morph (`abs(F* − F) < 1e−3`) or running one-shot.
- Resume immediately on any input.

**Hero lock and print:**

- `flags.printedLock` is a Schmitt trigger: it turns on at (p ≥ .62 && F ≥ .97) and off at (p < .56 || F < .90 || F > 1.0).
- The rising edge runs a 900 ms `cine` tween. `fx.scanX` goes from the name's left to right edge (su), and `h1.style.setProperty('--scan', pct)` is set in the same `onUpdate`.
- Because the print is time-based and fires only after the particles have arrived, registration can't drift from scrub lag.
- `h1 { mask-image: linear-gradient(90deg, #000 var(--scan, 100%), transparent calc(var(--scan, 100%) + 2%)) }`. Without JS, `--scan` is unset, so the fallback of 100% keeps the `<h1>` fully visible.

### 9.6 Anchors, stage follow and text-safe rects (no per-frame layout)

- **`layout.ts` is the single source of truth.** It holds each state's anchor box in vw/svh for desktop and mobile. It is applied as CSS custom properties on `:root` (`--anchor-chart-x0: 54vw`, …), which position empty `[data-field-anchor="S2"]` boxes inside stages and slots. DOM labels (chart numerals, leader lines) are positioned from the same variables.
- **On refresh only**, `useChapter` measures each anchor box and each `[data-safe]` block **relative to its stage** (sticky) or to the document (flow).
- **Per frame**, the viewport position is derived analytically from scrollY:

```ts
// sticky stage in a section [T, T + H_view + L]
stageTop(y) = y < T ? T - y : y <= T + L ? 0 : (T + L) - y;
anchorCenterVp = stageLocalCenter + stageTop(y);              // flow: docCenter - y
uOff.xy = pxToSu(anchorCenterVp);                             // Y = 1 - 2·py/H, X = (2·px/W - 1)·A
```

- S0 and dust are viewport-anchored. S1 follows the hero stage, so the particle name scrolls away with the `<h1>` before the Pour. S9 during the sink is `mix(stageAnchor, footerHorizon(y), fx.sink)`.
- **Safe rects:** at most 6 (the nav band plus the 5 blocks nearest the viewport centre in the active chapter and its neighbour), with the same formula. This fixes the proposal's "cached offsets minus Lenis scroll" error for stuck content.

### 9.7 Resize

- Keep canvas CSS size at `100% × 100lvh`. `renderer.setSize` runs on width or orientation change only.
- Debounce 200 ms.
- **Regenerate only if** abs(ΔW) > 40px, the orientation changed, or (fine pointer and abs(ΔH) > 120px). Mobile URL-bar height changes are ignored.
- Regeneration sequence:
  1. `ScrollTrigger.refresh()`.
  2. `onRefresh` remeasures anchors and safe rects.
  3. `segments.resolve()`.
  4. The worker regenerates S0 and S2–S9 while the main thread resamples S1.
  5. When **all** buffers are back, dip `uOpacity` to .6 over 150 ms, **swap the texture set atomically**, and restore.
- The old textures render until then. Mid-scroll resize is the only case that uploads textures (plus the one-time font resample in §9.8).
- If the layout mode flips (desktop ↔ mobile), do a full remount of chapters (`key={layout}`) before regenerating.

### 9.8 Font loading and S1 text sampling (`name-sampler.ts`)

1. Wait for the h1 font:
   `await Promise.race([document.fonts.load('800 condensed 100px "Archivo Variable"'), wait(1500)])`.
   If `document.fonts.check(...)` is still false, sample with the fallback stack, which is what the DOM is showing. Then listen for `document.fonts` `loadingdone` → **resample S1 once**, re-upload its textures, and call `ScrollTrigger.refresh()`.
2. For each text node of the `<h1>`'s line spans, and for each character c, use `Range.setStart/End` + `getClientRects()` to get its box: DOM x, width and line.
   - Baseline per line: a zero-size `inline-block` probe with `vertical-align: baseline` inside the line span, read with `offsetTop`.
3. Draw on a canvas sized to the `<h1>` rect × 2, capped at 2048px wide (the scale factor is recorded).
   - `ctx.font = '800 <px> "Archivo Variable"'` and `ctx.fontStretch = 'condensed'` where supported. Chromium was verified to match the DOM exactly.
   - `ctx.textBaseline = 'alphabetic'`. Draw each glyph with `fillText(c, x, baseline)` at **its DOM x**.
   - **Width lock:** `ctx.setTransform(sx, 0, 0, 1, x·(1 − sx), 0)`, where `sx = domWidth(c) / measureText(c).width`, clamped to [0.6, 1.6]. This self-corrects on browsers that ignore `fontStretch` or `letterSpacing`.
4. `getImageData`, then keep alpha > 128. Edge pixels are those with any 4-neighbour at alpha ≤ 128 and get 2× weight. Sample 82% of M, weighted, jittered by ±.4 px. Map to su relative to the `<h1>` rect centre.
5. Budget: ≤ 8 ms at 2048 × 330. It runs during the intro, in an idle callback.
6. `?debug=field` draws the sampled points as 1px dots over the live `<h1>`. **Acceptance: ≤ 1 CSS px error** in Chrome, Safari and Firefox, at 390, 1280, 1440 and 1920 widths.

### 9.9 Generation pipeline

- **Boot order:**
  1. Tier.
  2. Golden layout and `perm` (main thread, ≤ 5 ms).
  3. Dust.
  4. S0 in the worker.
  5. S1 on the main thread.
  6. First frame.
  7. S2–S9 in the worker in order. Each takes < 30 ms at High, and each is uploaded when it arrives. The director never enters a pair whose textures are missing: it holds at the last available state and jump-cuts forward when the texture arrives.
- **Worker message:** `{ type: 'generate', ids, tier: { N, S, M, W: 256 }, viewport: { W, H, A }, anchors }`. It returns `{ type: 'state', id, pos, meta }` with `[pos.buffer, meta.buffer]` transferred.
- **Main thread:** keep every returned array in `textures.ts` (for context restore and the Canvas2D fallback).
- **No Worker support:** run the same generators on the main thread in `requestIdleCallback` chunks.

### 9.10 React lifecycle rules (React 19 StrictMode, routes)

- `FieldCanvas` calls `acquireField()` on mount and `releaseField()` on unmount. Release schedules dispose after one macrotask and is cancelled if a re-acquire arrives, so StrictMode's double effect never recreates the WebGL context.
- All ScrollTriggers and SplitTexts are created inside `useGSAP({ scope, dependencies })`. They revert on unmount and on changes to reduced motion or layout. There are no GSAP pins, so there are no pin spacers to leak.
- Refresh points:
  - `ScrollTrigger.refresh()` after `document.fonts.ready`.
  - After `window` `load` (images have width and height, so this is only a safety net).
  - After every home mount.
  - After a resize regeneration.
- On route change, home triggers are killed before the detail route mounts (its `useGSAP` cleanup), and the director enters route mode.
- `index.html` keeps `history.scrollRestoration = 'manual'`. Home scroll restore is handled explicitly (§6).

### 9.11 `index.html` and build

**`index.html` changes:**

- Remove the Google Fonts links and preconnects.
- Add `<html lang="en" class="no-js" style="background:#050507">`, `<meta name="color-scheme" content="dark">` and `<meta name="theme-color" content="#050507">`.
- Add an inline pre-paint script that:
  - swaps `no-js` → `js`;
  - adds `rm` when `matchMedia('(prefers-reduced-motion: reduce)')` matches or `localStorage['dtw:motion'] === 'reduced'` (try/catch);
  - sets `data-layout` (desktop or mobile).
- Keep the existing meta description and OG tags. `og-image.png` is referenced but **missing from `/public`**; export a 1200×630 still of the S1 lock.

**CSS gating:** sticky layout only applies under `html.js:not(.rm)`. `no-js` and `rm` get plain flow.

**Prerender:** after `vite build`, `scripts/prerender-plugin.mjs` renders every route with `react-dom/static` (`prerenderToNodeStream`, which waits for the lazy routes) into `index.html`, `work/<slug>.html` and `404.html`, with `#root[data-ssr]` set to the route key and the route's `<title>`. There is no SPA catch-all on the host, so unknown paths get `404.html`.

**`vite.config.ts`:** add a tiny `preloadFonts()` plugin (`apply: 'build'`, `transformIndexHtml` `order: 'post'`). It finds the emitted asset matching `archivo-latin-wdth-normal` in `ctx.bundle` and injects `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/…">`.

**GLSL** is imported with Vite's `?raw`. The worker uses `new Worker(new URL('./worker/generate.worker.ts', import.meta.url), { type: 'module' })`.

**`package.json`:**

| Change | Packages |
|---|---|
| Add | `three@^0.186.1`, `lenis@^1.3.26`, `@fontsource-variable/archivo@^5.3.0`, `@fontsource/instrument-serif@^5.3.0`, `@fontsource-variable/jetbrains-mono@^5.3.0` |
| Add (dev) | `@types/three@^0.186.0` |
| Remove | `framer-motion` |
| Keep | `gsap@^3.14.2` (SplitText and CustomEase are included and free since 3.13), `@gsap/react`, `lucide-react` (Lock, ArrowUpRight, ArrowUp, Copy, Menu, X; stroke 1.5), `react-router-dom` |

### 9.12 Path summary

| Path | Scroll | Stages | Field | Reveals | Pointer |
|---|---|---|---|---|---|
| Full, desktop | Lenis | Sticky (6) | WebGL High or Mid, morphs, live loops | Scrubbed + one-shots | Loupe, push, cursor ring |
| Full, mobile | Native (Lenis passthrough) | Sticky C0 and C5 only; slots | WebGL Low | Scrubbed | Tap ripple |
| Reduced | Native, no Lenis | Flow | WebGL on demand: registered posters, 400 ms crossfades | None (visible) | None |
| No WebGL | As above per motion pref | As above | Canvas2D 1,500-point subsample + SVG chart bars | As per motion pref | None |
| No JS | Native | Flow | CSS glow | None (visible) | None |

---

## 10. The wow moment: Rack Focus → Pour

1. **Title card (first paint).** STEPHEN WEBB sits in huge condensed bone-white type. A breath later the field takes over the letters, un-prints them, and opens the lens. The name blooms into soft 12–18px discs with faint lens rims and drifts apart into a deep volume of noise. Only 3% of the points (ember sparks) stay near focus. The cursor sweeps a small loupe of sharpness through the haze. The line *I make complex data feel obvious.* holds still beneath.
2. **Rack focus (first scroll, about 50vh):**
   - The sparks move first and streak across the frame to draw a single ember hairline where the baseline will be.
   - A left-to-right wave (stagger .55), made column-coherent by the shared x-major sort, pulls every particle onto the focal plane while the aperture closes from .9 to .04. Each disc shrinks and brightens into a 1.5px pinpoint as it lands. You literally watch noise come into focus.
   - The HUD climbs from S/N 0.03 to 1.00.
3. **Lock (p .62, once the particles have arrived).**
   - An ember scan beam 0.04 su wide sweeps across the name in 900 ms and brightens it by 180%.
   - The DOM `<h1>`'s `mask-image` follows the beam, so the crisp Archivo type **prints pixel-registered underneath the particles**. The targets were sampled from those exact glyph boxes.
   - The particles relax into a .45-α halo, as if the type were glowing.
4. **The Pour (next ~100vh).**
   - The type hands its glyphs back: the DOM fades in 120 ms and the particle name ignites.
   - Both states are sorted column by column, so each vertical slice of STEPHEN WEBB loses cohesion from its baseline up.
   - The name defocuses slightly as it falls under ease-in-quad gravity and funnels into the chart rising from below.
   - It lands bottom-first in quarter-year slabs, with a 6px damped bounce, and refocuses as it settles. The axis draws itself and the tick labels arrive 30 ms apart.
   - The thin condensed numerals count up **in lockstep with the grains actually landing** (driven by the displayed uMix) and snap to 2, 4+, 6+. The third bar visibly stacks his developer years under his design years.
   - Above 4+ and 6+ a faint fizz keeps rising: the "+" drawn as data that is still arriving.
   - Last, a single ember point ignites past the divider and a leader line writes *AI Reporting Platform — End-to-end redesign*.
5. **Scroll back up** and every step reverses exactly. The grains lift out of the bars and fly back into his name, the type re-prints, the lens opens.

It is the thesis, *I make complex data feel obvious*, performed in two gestures before a single paragraph has been read. The same honesty carries on through the film: bars topple into redaction lines, a curtain of particles reveals each screenshot, and Back to top rewinds the whole film in 2.4 s.

---

## 11. Risk register: every judge risk and its resolution

| # | Risk raised | Resolution in this spec |
|---|---|---|
| 1 | Chart credibility (25 bars at "editorial" heights) | Honest to-scale YEARS chart; quarter-year slabs; stacked 6+ = 2 + 4+; "+" as fizz; the platform count kept off the axis past a divider; figure plus hidden table (§3.10 S2, §5 C1). |
| 2 | Fill rate: 48k additive points with 22px bokeh | Bokeh cap 12/10/8 px at DPR ≤ 1.5; only 35% of particles bokeh-eligible; α / dof^1.6; glow limited to 3% sparks; adaptive downgrade lowers the bokeh cap first; warm-up probe (§3.2, §3.8). |
| 3 | `bufferSubData` hitches at segment boundaries | All states resident as DataTextures; boundaries swap uniforms (§3.4). |
| 4 | Scan-print registration drift (spring vs scrub) | Time-based lock with arrival check (F ≥ .97) and hysteresis; per-glyph DOM-rect sampling with width lock; resample on font load; ≤ 1px acceptance (§9.5, §9.8). |
| 5 | `<h1>` at opacity 0 hurts LCP, SEO and no-JS | `<h1>` visible at first paint in every path; hidden only by `mask-image` after the field has taken over; `--scan` defaults to 100% (§6 intro, §9.5). |
| 6 | Intro scroll lock and jump-cut flicker | Scroll is never locked; any input skips the intro; jump cut needs \|ΔF\| > 1.5 for more than 80 ms plus an 800 ms cooldown; flashes limited to ≤ 3/s (§4.4, §7). |
| 7 | Pin-stack fragility in React 19 | No pins: sticky stages plus one director; `useGSAP` scopes; explicit refresh points; home scroll restore (§4.1, §9.10). |
| 8 | Scroll fatigue at about 1,500vh | 1,230vh document (−25%); every stage has a hold of at least 25%; nav jumps land on holds (§4.1). |
| 9 | Safe-mask rects wrong for pinned content | Stage-local rects measured on refresh; viewport position computed analytically; plus a DOM scrim (§2.3, §9.6). |
| 10 | Mobile layout collisions | Mobile field slots, so text and shapes never overlap; text wins when it does; short and landscape rules; test matrix (§4.2). |
| 11 | Generic typography (Inter Tight + Geist Mono) | Archivo Variable condensed + Instrument Serif italic + JetBrains Mono, package names verified (§2.5). |
| 12 | Hand-captured posters; WebGL2-only; no context-loss path | Canvas2D fallback from the same generators; context loss and restore rebuilds from cached arrays; CSS last resort (§8.4). |
| 13 | Battery and thermal cost of endless loops | 30 fps idle, pause when hidden or menu open, on-demand under reduced motion (§8.5, §9.5). |
| 14 | Dependency and bundle hygiene | Exact package changes; chunk budgets; SplitText is free (verified present in gsap 3.14.2); code-split routes (§8.5, §9.11). |
| 15 | Content fidelity and invented copy | Copy deck (Appendix A). The invented credits row is removed. New strings are UI microcopy only and make no factual claims (listed in Appendix A). |
| 16 | Per-frame `getBoundingClientRect` | Rects are read only in `onRefresh` or resize (§9.3, §9.6). |
| 17 | Canvas `fontStretch` and `letterSpacing` support | Per-glyph DOM x plus width lock; Chromium verified; `?debug=field` check in three browsers (§9.8). |
| 18 | Scroll detents or snapping | None, anywhere (§7). |
| 19 | HUD and chrome clutter | One S/N readout; native cursor kept; no boot log, decode scramble or bezel (§6). |
| 20 | Additive blow-out; undefined tiers | Per-state density; concrete tier rules plus probe (§3.2, §3.9). |
| 21 | Shape/dust fill-fraction streaks | Fixed dust indices that never morph; surplus goes to halo; golden-ratio rank mapping (§3.3). |
| 22 | Transient count-up values read aloud | Counters are `aria-hidden`; final values in the labels and the table; reduced motion shows finals (§5 C1). |
| 23 | Mobile hero must finish NOISE→NAME | Hero sticky on mobile (L 50svh); lock at p .70 (§4.3). |
| 24 | Screenshots undersold or closed too early | 44vw cards open through a hold of about 45% and are real focusable links; 1100px on the detail page (§5 C3, §6). |
| 25 | First viewport must say who this is | Name at first paint as the LCP; nav wordmark; name locks within one gesture (5% of scroll) (§1, §6). |
| 26 | Hidden capability descriptions | Always visible; emphasis by colour only (§5 C4). |
| 27 | Mobile URL-bar resize thrash | Canvas 100lvh; svh layout; `ignoreMobileResize`; regenerate on width or orientation only (§9.7). |
| 28 | Contrast claims unverified | Computed table; ink-3 only on solid surfaces; debug luminance sampler (§2.2, §2.3). |
| 29 | CLAUDE.md contradicts the rebuild | Rewritten in build step 1 (§12). |
| 30 | Jump-cut policy for the rewind | Rewind explicitly disables the jump cut and plays the film backward with a 60 ms damp; nav jumps of more than 2 states cut (§4.4). |

---

## 12. Build order and acceptance

1. **Groundwork.**
   - Rewrite CLAUDE.md: dark tokens, fonts, no Framer Motion, the field architecture, and "preserve the field" in place of "preserve hero-bg".
   - Swap dependencies.
   - Delete: `components/hero-bg/`, `TiltCard`, `MagneticButton`, `CustomCursor`, `AnimatedCapIcon`, `GSAPReveal`, `GSAPTextReveal`, `ScrollScrubText`, `SectionLabel`, `StatsCounter`, `lib/useSplitText.ts`, `assets/hero-illustration.svg`, `public/concept-hero.html`, and the unused `public/screenshots/pulse.png` and `prmpt-art.png`.
   - Write the new `index.css` tokens and type roles.
   - Update `index.html`.
2. **DOM first.** Build every chapter, page and piece of UI as a static, accessible, **fully readable** flow layout with its final copy. This is also the no-JS, reduced-motion and no-WebGL baseline. Run Lighthouse and axe here.
3. Add Lenis, the store, the director, sticky stages, line-mask reveals and the `?debug=field` segment readout.
4. Field engine with S0 and S1, the rack focus, the print, the intro and the tier probe.
5. S2 and the Pour (the numerals counting in lockstep); S3 and the topple.
6. S4–S7, the curtain, route transitions and detail pages.
7. S8, S9 (the CTA disc, sink and rewind) and S10 on the 404.
8. Canvas2D fallback, context loss, adaptive quality and the mobile slot layout.
9. QA matrix.

**Acceptance checklist:**

- [ ] With JS disabled, all copy is visible, the chart SVG bars show, and every link works.
- [ ] Reduced motion (OS setting and footer toggle) shows no scrubs and no Lenis, keeps the field registered but still, and makes Back to top instant.
- [ ] With WebGL disabled (and after `WEBGL_lose_context` twice), the Canvas2D fallback shows identical content.
- [ ] Name registration is within 1px in Chrome, Safari and Firefox at 390 / 1280 / 1440 / 1920 widths.
- [ ] The debug luminance sampler never exceeds `#262A34` pre-scrim behind `data-safe` blocks. axe shows no contrast failures.
- [ ] Performance: p95 frame ≤ 16.7 ms on an M1 (High) and ≤ 20 ms on a Pixel 6a (Low). There are no long tasks > 50 ms during scroll. CLS is 0. LCP is ≤ 1.8 s on desktop.
- [ ] Nav jumps: at most 2 states away they glide; further away they jump-cut. Back to top rewinds in 2.4 s with no flashes.
- [ ] StrictMode dev creates exactly one WebGL context. Home → detail → back restores scroll and state with no intermediate morphs.
- [ ] Viewports 360×640, 390×844, 844×390 and 820×1180 show no text/shape overlap, and every touch target is ≥ 44px.
- [ ] Every string traces to Appendix A.

Contrast script used for §2.2: WCAG relative luminance with sRGB linearisation, `(L1 + .05) / (L2 + .05)`. The scrimmed worst case is `#050507` at 82% over `#262A34`, which gives `#0B0C0F`.

---

## Appendix A — Copy deck

All copy is **verbatim or tightened** from `HomePage.tsx`, `projects.ts`, `Footer.tsx`, `ProjectDetailPage.tsx` and `NotFoundPage.tsx`. No new facts are introduced.

| Location | String | Source |
|---|---|---|
| Hero eyebrow | Senior Product Designer — Tyler Technologies | Hero label + tagline (merged) |
| Hero h1 | Stephen Webb | Hero |
| Hero lede | I make complex data *feel obvious.* | Tagline line 2 |
| Hero CTAs | View work ↘ · Get in touch | Hero CTAs |
| About h2 | 01 — About | Section label |
| About statement | I design products where *data meets decisions* | About |
| About ¶1 | I'm a Senior Product Designer at Tyler Technologies with a background in front-end development. I spent two years writing code before moving into design — which means I think in systems, components, and real constraints. | About |
| About ¶2 | Right now I'm leading the end-to-end redesign of our reporting platform, re-envisioning it as an **AI-centric experience** — giving users specific, use-case-driven reporting tools that actually meet their needs. | About |
| Stats | 2 · Years as a Developer · I speak your engineers' language / 4+ · Years in Product Design · Discovery to delivery / 6+ · Years in Tech · SaaS, gov-tech, AI / 1 · AI Reporting Platform · End-to-end redesign | `stats` |
| Work h2 | 02 — Selected work | Section label |
| NDA | Under NDA · Tyler Technologies case studies · Detailed case studies from my work at Tyler Technologies. Available upon request. | NDA card |
| Side projects label | Side projects | Work |
| Pulse | A conversational interface for querying government open data through Socrata APIs. Your city's open data, one question away. · TypeScript · AI · Gov Data · https://pulse-data.netlify.app/ · https://github.com/stevie2codes/socrata-chat | `projects.ts` |
| Gov Data Generator | A tool for generating realistic government data sets for testing and prototyping reporting interfaces. · TypeScript · Data · Tooling · https://stevie2codes.github.io/gov-data-generator/ · https://github.com/stevie2codes/gov-data-generator | `projects.ts` |
| Prmpt Art | A prompt library for maximizing the effectiveness of prompts into AI agents. Building better conversations with machines. · TypeScript · AI Agents · Prompt Engineering · https://prmptart.com/ · https://github.com/stevie2codes/prmptart | `projects.ts` |
| MCP App | Exploring the Model Context Protocol — building applications that integrate with AI tool ecosystems. · TypeScript · MCP · AI Tools · https://github.com/stevie2codes/mcp-app · "Screenshot coming soon" | `projects.ts` / detail page |
| Writeups | All 12 paragraphs verbatim | `projects.ts` |
| Capabilities h2 | 03 — What I do | Section label |
| Capabilities statement | Thoughtful craft across the *full product surface* | Capabilities |
| Capabilities rows | 4 titles + descriptions verbatim (§5 C4) | `capabilities` |
| Contact h2 | 04 — Get in touch | Section label |
| Contact headline | Let's build something / *worth using* | Contact |
| Contact body | Always interested in connecting with fellow designers, engineers, and product thinkers. Let's talk shop. | Contact |
| Email | stephen@designthewebb.com | Contact |
| Footer | © {year} Stephen Webb · GitHub · LinkedIn · Back to top | `Footer.tsx` |
| Detail | ← All work · View live ↗ · View on GitHub ↗ · About this project · Next project · Project not found · The project you're looking for doesn't exist. · Back to work | `ProjectDetailPage.tsx` |
| 404 | Page not found · The page you're looking for doesn't exist or has been moved. · Back to home | `NotFoundPage.tsx` |

**New UI microcopy.** These strings make no factual claims:

- "Scroll to resolve"
- "Request by email →"
- "Project details →", "Live site ↗", "GitHub ↗"
- "Open {title} project details"
- "Email me ↗"
- "Copy" / "Copied"
- "Motion: Full / Reduced"
- "Years" (axis title)
- "Developer" / "Product design" (legend)
- "P/01"–"P/04"
- "ROWS 00/52"
- "S/N 0.03"
- "404 — Signal lost"
- "Stephen Webb — Senior Product Designer" (portrait caption)
- "Skip to content"
- The nav labels, including "Email ↗", "Menu" / "Close" and the collapsed wordmark "SW"
- "01 / 04"
- Accessible names and alt text (no visible text, no factual claims): "Email stephen@designthewebb.com" (nav Email), "Email me — stephen@designthewebb.com" (beacon CTA), "Portrait of Stephen Webb" / "Stephen Webb" (photo alts), "{title} screenshot", "{title} — project details", "{title} live site", "{title} source on GitHub"
- Rail tick labels "Title", "About", "Work", "What I do", "Contact", and their accessible names "Go to title" … "Go to Contact"
- Cursor ring labels "Open" / "Live"
