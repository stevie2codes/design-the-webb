# GSAP Animation Enhancement — Design Spec

## Overview

Add GSAP alongside Framer Motion to bring scroll-driven animations, character-level text reveals, magnetic hover effects, and timeline-orchestrated sequences to the portfolio site. GSAP handles scroll + text + timelines; Framer Motion keeps component-level hover/springs/layout animations.

## Packages

- `gsap` — core library
- `@gsap/react` — `useGSAP` hook for React lifecycle integration

GSAP plugins used:
- `ScrollTrigger` (free, bundled with core) — scroll-driven animations, pinning, scrubbing
- **No SplitText plugin** — SplitText requires a GSAP Club license. Instead, we build a custom `useSplitText` hook that manually wraps characters/words in `<span>` elements, giving the same DOM structure for GSAP to animate.

## Architecture

### New Files

```
src/
  lib/
    gsap-init.ts            — Register GSAP plugins once (ScrollTrigger, SplitText)
    useSplitText.ts         — Custom SplitText hook (fallback if no GSAP license)
  components/
    GSAPReveal.tsx           — Scroll-triggered fade+translate reveal (replaces Reveal.tsx)
    GSAPTextReveal.tsx       — Cinematic heading reveal with character split + stagger
    MagneticButton.tsx       — Magnetic hover wrapper using gsap.to()
    ScrollScrubText.tsx      — Word-by-word scroll-scrubbed opacity animation
    StatsCounter.tsx         — Animated number counter on scroll trigger
```

### Modified Files

- `pages/HomePage.tsx` — Swap `Reveal` → `GSAPReveal`/`GSAPTextReveal`, replace ScrambleText with GSAP SplitText timeline, add hero scroll-away, add pinned capabilities section, add stats counter, wrap CTAs + social icons in `MagneticButton`
- `App.tsx` — Import `gsap-init.ts` to register plugins on app startup

### Removed Files

- `components/Reveal.tsx` — Replaced by `GSAPReveal.tsx`
- `components/ScrambleText.tsx` — Replaced by GSAP SplitText in hero timeline

### Unchanged (stays Framer Motion)

- `components/hero-bg/*` — BlobLayer, GeometryLayer, ParticleLayer, useMousePosition (mouse-reactive springs)

### Refactored

- `components/hero-bg/useHeroScroll.ts` — **Removed**. Its scroll-driven parallax values are replaced by the GSAP ScrollTrigger in the hero scroll-away (effect #2). The HeroBackground component receives scroll-driven opacity/transform from GSAP instead.
- `components/hero-bg/HeroBackground.tsx` — Modified to accept GSAP-driven scroll values instead of using `useHeroScroll`
- `components/CustomCursor.tsx` — Spring-based cursor tracking
- `components/Nav.tsx` — Mobile menu open/close
- CSS hover transitions — Tailwind handles button hover states

## Effects — Section by Section

### 1. Hero — SplitText Entrance Timeline

A single `gsap.timeline()` orchestrates the entire hero entrance:

1. **"Senior Product Designer"** label — fade in + translateX(-20px → 0), duration 0.6s
2. **"Stephen"** — SplitText character reveal: each char starts at `translateY(100%)` + `opacity: 0` inside a `clip-path: inset(0 0 100% 0)` container, staggers in at 0.03s per char with `power3.out` easing
3. **"Webb"** — Same treatment, starts 0.15s after "Stephen" completes
4. **Underline** — `scaleX: 0 → 1` with `power2.inOut` easing
5. **Tagline words** — Each word slides up (translateY 12px → 0) + fades in, 0.04s stagger
6. **CTA buttons** — Fade in + translateY(16px → 0) with `power3.out`

7. **Scroll indicator** — Fade in at the end of the timeline, stays as a Framer Motion `animate` loop for the pulsing line (GSAP handles the initial appearance, FM handles the repeating pulse)

The timeline replaces all current Framer Motion `initial`/`animate` props in the hero section. No more manual delay chaining.

All GSAP animations are created inside `useGSAP(() => { ... }, { scope: containerRef })` to ensure automatic cleanup on unmount.

### 2. Hero — Scroll-Away Parallax

ScrollTrigger config:
- **trigger**: hero section
- **start**: `"top top"`
- **end**: `"bottom top"`
- **scrub**: 1

Animations:
- Hero text content: `translateY` at 1.3× scroll speed (moves up faster than natural scroll)
- Hero background (blobs/particles): `opacity: 1 → 0` over 60% of the scroll distance via a GSAP ScrollTrigger on the HeroBackground wrapper div. The existing Framer Motion `useHeroScroll` hook is removed and replaced by this ScrollTrigger — no dual scroll listeners.
- Creates smooth dissolve into About section, eliminates the current hard cutoff

### 3. About — Scroll-Scrubbed Text Reveal

The heading *"I design products where data meets decisions"* uses a `ScrollScrubText` component:

- Each word starts at `opacity: 0.15` (visible but washed out)
- As user scrolls, words progressively illuminate to `opacity: 1`, left-to-right
- The orange "data meets decisions" span lights up last
- ScrollTrigger: `scrub: 0.5` (slightly smoothed for organic feel), brief pin on the heading so user scrolls "through" the text

Body paragraphs and stats row use standard `GSAPReveal` (not scrubbed).

### 4. Stats — Counter Animation

Numbers count from 0 to final value using `gsap.to()` with `snap: 1` (integers only).

- **Trigger**: ScrollTrigger `once: true` when stats row enters viewport
- **Duration**: ~1.5s per number
- **Stagger**: 0.15s between the 4 stat boxes
- **Easing**: `power2.out` — fast start, smooth deceleration
- Values: "4+", "2", "6+", "1" — parse numeric part, animate, append suffix

### 5. Capabilities — Pinned Sequential Reveal

ScrollTrigger config:
- **trigger**: capabilities section
- **pin**: true (section stays fixed)
- **scrub**: 1
- **end**: `"+=200%"` (2× viewport height of scroll distance)

The heading *"Thoughtful craft across the full product surface"* pins to viewport top. Each of the 4 capability cards animates in sequentially:

- Card: `translateY(60px) + opacity: 0 → translateY(0) + opacity: 1`
- Icon: `scale(0.8) → scale(1)` with `elastic.out` easing
- Each card occupies ~25% of the pinned scroll distance

Layout during pin: The 2×2 grid stays as-is in the DOM. All 4 cards start at `opacity: 0, translateY: 60px`. GSAP animates them in sequence (card 1 at 0-25% scroll, card 2 at 25-50%, etc.) within the existing grid. The grid is visible throughout — cards simply appear in their grid positions one by one. No layout switching needed.

### 6. Magnetic Hover — CTAs + Social Icons

A reusable `MagneticButton` wrapper component:

- Tracks mouse position relative to element center via `onMouseMove`
- `gsap.to()` translates the element toward the cursor (max displacement: ~8px)
- On `onMouseLeave`, springs back to center with `elastic.out` easing (duration 0.6s)
- Applied to: "View Work" button, "Get in Touch" button, email CTA in Contact, GitHub/LinkedIn/Twitter social icons

Implementation: pure GSAP, no Framer Motion involvement. The wrapper renders a `<div>` that wraps its children and applies the magnetic transform.

### 7. Global Reveal Replacement

Two new components replace the current `Reveal`:

**`GSAPTextReveal`** — for headings (cinematic):
- SplitText splits heading into characters
- Each char: `translateY(30px) + opacity: 0` → revealed with `power3.out`, 0.02s stagger
- Optional `clip-path: inset(0 0 100% 0) → inset(0)` for "unmasking from bottom" effect
- ScrollTrigger: `once: true`, start: `"top 80%"` (triggers when element top crosses 80% down from viewport top)

**`GSAPReveal`** — for body text, cards, generic elements (clean):
- `translateY(20px) + opacity: 0` → revealed
- Duration: 0.6s, easing: `power2.out`
- Optional `stagger` prop for children (default 0.08s)
- Optional `delay` prop
- ScrollTrigger: `once: true`, start: `"top 85%"` (triggers when element top crosses 85% down from viewport top)

## gsap-init.ts

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
// import { SplitText } from "gsap/SplitText"; // if licensed

gsap.registerPlugin(ScrollTrigger);
// gsap.registerPlugin(SplitText); // if licensed

export { gsap, ScrollTrigger };
```

Called once in `App.tsx` or `main.tsx` via side-effect import.

## useSplitText Hook (Custom Fallback)

If GSAP SplitText is unavailable (requires Club license), build a custom hook:

```ts
function useSplitText(ref: RefObject<HTMLElement>, options: { type: "chars" | "words" }) {
  // On mount: walk the DOM tree (not just textContent) to preserve child elements
  // like <span class="text-orange">. For each text node, wrap chars/words in <span>.
  // Existing element nodes (like styled spans) are preserved and their text content
  // is split within them.
  // Returns: { chars: HTMLElement[], words: HTMLElement[], revert: () => void }
  // revert() restores original innerHTML (stored on mount)
}
```

**Important**: The hook walks `childNodes` recursively, only splitting `Text` nodes. This preserves inline elements like `<span className="text-orange">data meets decisions</span>` in the About heading — the span stays intact, and its text content is split into character spans inside it.

This gives the same DOM structure that GSAP can animate with `gsap.from(chars, { y: 30, opacity: 0, stagger: 0.02 })`.

## Other Sections — Global Migration

All remaining sections migrate from `Reveal` to GSAP equivalents:

### Work Section
- **"Selected Work" SectionLabel**: `GSAPReveal` (clean fade)
- **"Coming Soon" case study placeholder**: `GSAPReveal`
- **"Side Projects" label**: `GSAPReveal`
- **Project cards**: `GSAPReveal` with `stagger: 0.1` on children

### Contact Section
- **"Let's build something worth using"** heading: `GSAPTextReveal` (cinematic character split — this is a big emotional heading, deserves the treatment)
- **Body paragraph + email CTA**: `GSAPReveal`
- **Social icons row**: `GSAPReveal` with stagger
- **Email button + social icons**: wrapped in `MagneticButton`

### SectionLabel Component
- `SectionLabel` stays as a pure presentational component (just renders styled text)
- Its parent `GSAPReveal` wrapper handles the animation — same pattern as now where `Reveal` wraps `SectionLabel`

## Mobile Considerations

- **Pinned capabilities**: Disable pinning on mobile (< 768px). Fall back to standard sequential `GSAPReveal` for each card.
- **Magnetic hover**: Disable on touch devices (no hover). Check `matchMedia("(hover: hover)")`.
- **Scroll-scrubbed text**: Reduce pin duration on mobile. Words reveal faster (less scroll distance required).
- **SplitText hero**: Keep on mobile but reduce stagger duration (0.02s instead of 0.03s) for snappier feel on smaller screens.

## Performance

- Apply `will-change: transform, opacity` only to pinned/scrubbed elements (hero scroll-away, About scrub text, Capabilities pin). For one-shot reveals, let GSAP's `force3D: true` (default) handle GPU promotion — applying `will-change` to every `GSAPReveal` would create too many compositor layers on mobile.
- `ScrollTrigger.refresh()` called after initial render and on resize
- Pin spacers managed by ScrollTrigger (automatic)
- GSAP core + ScrollTrigger: ~30KB gzipped (much lighter than Remotion was at ~160KB)

## Success Criteria

- Hero entrance feels cinematic and precisely choreographed
- Scrolling through the page feels interactive, not just "things appearing"
- About heading scroll-scrub creates a "moment" that makes you slow down and read
- Capabilities section tells a story through sequential reveal
- Magnetic hover adds tactile quality without being distracting
- Mobile experience degrades gracefully (no janky pinning, no hover effects)
- Bundle size increase stays under 35KB gzipped
