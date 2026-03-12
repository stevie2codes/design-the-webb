# Hero Flow Field Animation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hero section with a fullscreen Perlin noise flow field featuring a particle-to-text entrance animation, Space Grotesk typography, split layout, and an organically-masked portrait photo.

**Architecture:** A single `FlowField.tsx` p5.js component handles all canvas rendering — particles, noise field, text attractor sampling, and entrance choreography. `HomePage.tsx` orchestrates the layout (split: text left, photo right) and coordinates Framer Motion entrance timing for supporting elements with the canvas animation phases via a shared timeline ref. The font swap from Instrument Serif to Space Grotesk is a global change touching `index.html` and `index.css`.

**Tech Stack:** React 19, p5.js (already installed), Framer Motion (already installed), Tailwind CSS v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-hero-flow-field-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/components/FlowField.tsx` | **Create.** p5.js canvas: particle system, Perlin noise flow, text pixel sampling, entrance phases (free-flow → converge → shimmer → release), mouse interaction. Exposes `onPhaseChange` callback. |
| `src/pages/HomePage.tsx` | **Modify.** Hero section: split layout, Framer Motion entrance for label/tagline/CTAs/photo synced to FlowField phases. Replace BlueprintGrid import. |
| `src/index.css` | **Modify.** Update `--font-display` to Space Grotesk. Add organic clip-path for photo mask. |
| `index.html` | **Modify.** Replace Google Fonts link: swap Instrument Serif for Space Grotesk. |
| `src/components/BlueprintGrid.tsx` | **Delete.** Replaced by FlowField. |
| `src/components/MeshNetwork.tsx` | **Delete.** Unused. |

---

## Chunk 1: Foundation — Font Swap & Cleanup

### Task 1: Swap Google Fonts in index.html

**Files:**
- Modify: `index.html:9`

- [ ] **Step 1: Update the Google Fonts link**

Replace the Instrument Serif import with Space Grotesk:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300;1,9..40,400&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Verify fonts load**

Open the dev server preview. Confirm the page still renders (headings will now fall back to Georgia until CSS is updated).

### Task 2: Update CSS theme token

**Files:**
- Modify: `src/index.css:4`

- [ ] **Step 1: Change `--font-display`**

```css
--font-display: 'Space Grotesk', system-ui, sans-serif;
```

- [ ] **Step 2: Verify in browser**

All headings site-wide (hero, about, work, capabilities, contact, nav) use `font-display` via Tailwind's class. Confirm they now render in Space Grotesk.

- [ ] **Step 3: Commit**

```bash
git add index.html src/index.css
git commit -m "feat: swap display font from Instrument Serif to Space Grotesk"
```

### Task 3: Delete unused components

**Files:**
- Delete: `src/components/BlueprintGrid.tsx`
- Delete: `src/components/MeshNetwork.tsx`

- [ ] **Step 1: Remove BlueprintGrid import from HomePage**

In `src/pages/HomePage.tsx`, remove the import line:
```tsx
import BlueprintGrid from "../components/BlueprintGrid";
```

And remove the usage in the hero section:
```tsx
<BlueprintGrid className="absolute inset-0 w-full h-full" />
```

- [ ] **Step 2: Delete the files**

```bash
rm src/components/BlueprintGrid.tsx src/components/MeshNetwork.tsx
```

- [ ] **Step 3: Verify no build errors**

```bash
cd webb-design && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -u src/components/BlueprintGrid.tsx src/components/MeshNetwork.tsx src/pages/HomePage.tsx
git commit -m "chore: remove BlueprintGrid and MeshNetwork components"
```

---

## Chunk 2: FlowField Component — Core Particle System

### Task 4: Create FlowField.tsx with basic flow field

**Files:**
- Create: `src/components/FlowField.tsx`

This is the largest task. Build the core particle system first, without the text attractor logic.

- [ ] **Step 1: Create FlowField.tsx with particle system**

The component should:
- Accept props: `className`, `particleCount` (default 2500), `onPhaseChange` callback
- Detect mobile via `window.innerWidth < 768` and reduce to ~1000 particles
- Use p5.js instance mode (same pattern as the old BlueprintGrid)
- Implement Perlin-like noise via layered sine functions (same approach validated in brainstorm prototype)
- Particle struct: `x, y, px, py, speed, alpha, color, life, maxLife`
- Color palette: `#d97757`, `#e8a08a`, `#c86641`, `rgb(190,165,145)`, `rgb(170,150,140)`
- Background fade: `rgba(250,249,245, 0.06)` per frame for visible motion
- Mouse interaction: track cursor, apply swirl within 250px radius
- Particles respawn from edges (60% bias) or random positions
- Handle `windowResized` for responsive canvas

```tsx
interface FlowFieldProps {
  className?: string;
  particleCount?: number;
  onPhaseChange?: (phase: 'flowing' | 'converging' | 'shimmering' | 'released') => void;
}
```

- [ ] **Step 2: Import FlowField into HomePage hero section**

Replace where BlueprintGrid was:
```tsx
import FlowField from "../components/FlowField";
// ...
<FlowField className="absolute inset-0 w-full h-full" />
```

- [ ] **Step 3: Verify in browser**

Confirm: fullscreen canvas with visible streaming particles in orange palette. Mouse interaction swirls particles. Background is cream `#faf9f5`.

- [ ] **Step 4: Commit**

```bash
git add src/components/FlowField.tsx src/pages/HomePage.tsx
git commit -m "feat: add FlowField component with core particle system"
```

---

## Chunk 3: Text Attractor — Particle-to-Solid Entrance

### Task 5: Add text pixel sampling and entrance phases

**Files:**
- Modify: `src/components/FlowField.tsx`

- [ ] **Step 1: Add text sampling logic**

On setup, render "Stephen\nWebb" in Space Grotesk 700 to a hidden offscreen canvas. Sample pixel data to extract an array of `{x, y}` attractor points where the text pixels are dark. Scale these coordinates to match the actual canvas size and the text's intended position (left side of the split layout — roughly `x: 5%-50%`, `y: 30%-70%` of viewport).

Key details:
- Offscreen canvas should match the responsive font size: `clamp(3.5rem, 10vw, 8rem)`
- Sample every ~3-4 pixels to get ~800-1500 attractor points (enough density without overdoing it)
- Store as `attractorPoints: {x: number, y: number}[]`
- Recalculate on `windowResized`

- [ ] **Step 2: Add phase state machine**

```
Phase 1: 'flowing'     (0 - 500ms)    — particles flow freely, no attractors
Phase 2: 'converging'  (500 - 2000ms) — particles steer toward nearest attractor point
Phase 3: 'shimmering'  (2000 - 2500ms) — particles vibrate at attractor positions
Phase 4: 'released'    (2500ms+)       — attractors disabled, particles rejoin flow
```

Use `millis()` from p5 to track time. Call `onPhaseChange` when transitioning.

During `converging`: each particle finds its nearest attractor point and blends its velocity toward that point with increasing strength (lerp factor ramps from 0 to 0.8 over the phase). Particle alpha increases during convergence for brighter text formation.

During `shimmering`: particles are held at attractor positions with small random jitter (±2px).

During `released`: attractor force set to 0, particles resume normal flow. Brief alpha spike as they release.

- [ ] **Step 3: Verify in browser**

Reload the page. Watch the full sequence:
1. Particles flow freely (~0.5s)
2. Particles rush toward letter shapes (~1.5s)
3. Brief shimmer (~0.5s)
4. Particles release back into flow

The text "Stephen Webb" should be clearly legible during convergence/shimmer. If not, adjust attractor point density or particle alpha.

- [ ] **Step 4: Commit**

```bash
git add src/components/FlowField.tsx
git commit -m "feat: add text attractor entrance with converge/shimmer/release phases"
```

---

## Chunk 4: Hero Layout — Split with Organic Photo Mask

### Task 6: Add organic clip-path to CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the organic mask clip-path**

Add after the base layer:

```css
@layer components {
  .organic-mask {
    clip-path: path('M 50% 2%, 75% 0%, 98% 8%, 97% 25%, 99% 42%, 95% 55%, 98% 70%, 100% 82%, 92% 95%, 75% 98%, 58% 100%, 35% 97%, 20% 95%, 5% 93%, 0% 82%, 2% 65%, 4% 48%, 0% 35%, 3% 20%, 6% 5%, 25% 2%, 50% 2%');
  }
}
```

Note: percentages in `clip-path: path()` don't work — we'll use an inline SVG `clipPath` element with `clipPathUnits="objectBoundingBox"` instead. Define the path in the HomePage component and reference it via `clip-path: url(#organic-mask)`.

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: add organic mask styles"
```

### Task 7: Rebuild hero section with split layout

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add SVG clip-path definition**

Add an inline SVG at the top of the HomePage return, hidden, defining the organic mask:

```tsx
<svg width="0" height="0" className="absolute">
  <defs>
    <clipPath id="organic-mask" clipPathUnits="objectBoundingBox">
      <path d="M0.5,0.02 C0.75,0 0.98,0.08 0.97,0.25 C0.99,0.42 0.95,0.55 0.98,0.7 C1.0,0.82 0.92,0.95 0.75,0.98 C0.58,1.0 0.35,0.97 0.2,0.95 C0.05,0.93 0.0,0.82 0.02,0.65 C0.04,0.48 0.0,0.35 0.03,0.2 C0.06,0.05 0.25,0.02 0.5,0.02Z" />
    </clipPath>
  </defs>
</svg>
```

- [ ] **Step 2: Rewrite the hero section with split layout**

Replace the entire hero `<section>` content:

- FlowField as absolute background (layer 1)
- Content wrapper: `flex items-center min-h-screen px-6 md:px-12`
- Left column (`flex-1`):
  - Label "Senior Product Designer" — fade in immediately (delay 0.1s)
  - Name `<h1>` "Stephen\nWebb" — initially `opacity: 0`, fades in when FlowField phase reaches `'released'` (controlled by state from `onPhaseChange`)
  - Tagline — fade in at delay 0.3s
  - CTAs — fade in at delay 0.5s
- Right column (`w-[280px] lg:w-[320px] xl:w-[360px] flex-shrink-0`):
  - Portrait image with `style={{ clipPath: 'url(#organic-mask)' }}`
  - Fade in when FlowField reaches `'released'` phase
- Mobile: stack with `flex-col md:flex-row`

Use `useState` to track FlowField phase:
```tsx
const [phase, setPhase] = useState<string>('flowing');
```

- [ ] **Step 3: Verify desktop layout**

Confirm: text on left, photo placeholder on right, flow field behind both. Full entrance sequence plays. Supporting text visible before name solidifies.

- [ ] **Step 4: Verify mobile layout**

Use browser dev tools or preview resize to check mobile. Text stacks above photo. Flow field still fullscreen.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: rebuild hero with split layout, organic photo mask, and entrance choreography"
```

---

## Chunk 5: Polish & Photo

### Task 8: Add portrait photo placeholder

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add a placeholder for the portrait**

Use a styled div as placeholder until the user provides their photo. The div should have the same aspect ratio and organic mask, with a subtle gradient background and "Photo" text:

```tsx
<div
  className="w-[280px] lg:w-[320px] xl:w-[360px] aspect-[3/4] bg-gradient-to-br from-cream-dark to-line flex items-center justify-center text-muted text-sm"
  style={{ clipPath: 'url(#organic-mask)' }}
>
  {/* Replace with <img src="/your-photo.jpg" ... /> when ready */}
</div>
```

When the user provides a real photo, swap to:
```tsx
<img
  src="/stephen-portrait.png"
  alt="Stephen Webb"
  className="w-[280px] lg:w-[320px] xl:w-[360px] aspect-[3/4] object-cover object-top"
  style={{ clipPath: 'url(#organic-mask)' }}
  draggable={false}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: add portrait photo placeholder with organic mask"
```

### Task 9: Remove italic styling from headings site-wide

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Update heading styles**

The hero name no longer uses italic (was `italic text-orange` for "Webb"). Since the font swap is global, also audit other headings in HomePage that used `italic text-orange` on accent spans. These are stylistic choices — keep the orange color on accent text but remove `italic` since Space Grotesk doesn't have a true italic style and the faux italic won't look good.

Sections to check:
- About section: `"data meets decisions"` span — keep `text-orange`, remove `italic`
- Capabilities section: `"full product surface"` span — keep `text-orange`, remove `italic`
- Contact section: `"worth using"` span — keep `text-orange`, remove `italic`

- [ ] **Step 2: Verify all sections**

Scroll through the full page. Confirm no faux-italic text appears. All accent text should be upright Space Grotesk in orange.

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "style: remove italic from accent headings for Space Grotesk compatibility"
```

### Task 10: Final verification pass

- [ ] **Step 1: Full page walkthrough**

Verify end-to-end:
1. Page loads → flow field active immediately with visible streaming particles
2. Label, tagline, CTAs fade in within 0.5s
3. Particles converge into "Stephen Webb" (0.5-2s)
4. Brief shimmer (2-2.5s)
5. Solid text appears, particles release (2.5-3s), photo fades in
6. Mouse swirl works
7. Scroll down — all sections render correctly with Space Grotesk headings
8. Mobile layout stacks correctly

- [ ] **Step 2: Performance check**

Open browser dev tools Performance tab. Confirm:
- Canvas runs at ~60fps on desktop
- No janky frames during entrance sequence
- Memory usage is stable (particles respawning, not leaking)

- [ ] **Step 3: Commit any final adjustments, then push**

```bash
git push origin main
```
