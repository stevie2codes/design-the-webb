# UI Enhancement: Data-Flavored Personality Layer

**Date:** 2026-03-17
**Goal:** Make the portfolio feel distinctly "Stephen Webb" — a designer who builds, thinks in systems, and works at the AI/data frontier. Inject personality through micro-interactions, data-flavored visual motifs, and content curation rather than structural redesign.

**Guiding principle:** Professional presence, not job-search urgency. Polish over flash.

---

## 1. Work Cards — Screenshots + Hover Tilt

**Files:** `src/pages/HomePage.tsx`, `src/data/projects.ts`

### Side Project Cards
- Each card becomes a **two-column layout** on desktop (md+): screenshot left (~40%), text right (~60%)
- Mobile: screenshot stacks above text with `aspect-[16/10]` constrained frame
- Screenshot renders inside `rounded-xl overflow-hidden` with `object-cover`
- On hover (desktop only):
  - Entire card gets a **CSS perspective tilt** following mouse position within the card (max ~4deg rotateX/Y)
  - Screenshot scales to `1.03` with `transition-transform duration-500`
  - Existing arrow icon reveal + background color shift stay as-is
- Cards without a `screenshot` field fall back to current text-only layout
- If a `screenshot` path is defined but the image fails to load (`onError`), hide the image container and fall back to text-only layout
- Tilt disabled when `prefers-reduced-motion` is active

### "Coming Soon" → "Under NDA"
- Replace dashed border placeholder with a solid `bg-cream-dark` card
- Change "Coming Soon" label to "Under NDA" with a `Lock` icon from Lucide
- Change description: "Detailed case studies from my work at Tyler Technologies. Available upon request."
- Remove the dashed border styling
- Card is **non-interactive** — no link wrapper, no hover state beyond base styling

### New Component
- `src/components/TiltCard.tsx` — reusable mouse-tracking perspective tilt wrapper
  - Props: `children`, `className`, `tiltStrength` (default 4, represents max degrees of rotation)
  - Uses `onMouseMove` to calculate rotation from mouse position relative to card center:
    - `rotateX = ((mouseY - centerY) / (height / 2)) * tiltStrength` (degrees)
    - `rotateY = ((mouseX - centerX) / (width / 2)) * -tiltStrength` (degrees, inverted for natural feel)
  - Uses CSS `transform: perspective(800px) rotateX() rotateY()` with `transition-transform`
  - Add `will-change: transform` for GPU layer promotion
  - Resets to `rotateX(0) rotateY(0)` on mouse leave
  - Returns flat (no tilt) when `useReducedMotion()` is true

---

## 2. Capabilities — Animated Icon Micro-Interactions

**Files:** `src/pages/HomePage.tsx`, `src/components/GSAPReveal.tsx`, new `src/components/AnimatedCapIcon.tsx`

### Remove Pinned Scroll
- Delete the entire `CAPABILITIES PINNED REVEAL` useGSAP block in HomePage
- Remove `data-cap-card` and `data-cap-icon` data attributes from the grid
- Replace with standard `GSAPReveal` wrappers on each card (staggered delay)
- Add an `onEnter?: () => void` callback prop to `GSAPReveal` that fires when ScrollTrigger enters viewport — this allows `AnimatedCapIcon` to receive an `isInView` prop driven by the parent's reveal trigger

### Animated Icons
- Create `src/components/AnimatedCapIcon.tsx` — a component that renders custom SVG icons with hover animations
- Each capability gets a **unique hover animation** (CSS transitions + Framer Motion):
  - **Layers** (Product Design): Three horizontal lines that separate vertically on hover (translateY spread), settle back on leave
  - **BarChart3** (Data Viz): Three bars that grow from 0 to staggered heights on hover
  - **Compass** (Design Systems): Smooth 360deg rotation on hover
  - **PenTool** (Prototyping): Stroke draws in via `stroke-dashoffset` animation on hover
- All animations: ~400ms duration, ease-out, `transform`/`opacity`/`stroke-dashoffset` only (GPU-composited)
- Mobile: animation plays once when the parent `GSAPReveal` fires (component accepts an `isInView` prop controlled by the parent's ScrollTrigger `onEnter` callback — single source of truth, no separate IntersectionObserver)
- Disabled entirely when `prefers-reduced-motion` is active (shows static icon)

### Grid Structure
- Grid stays as `md:grid-cols-2 gap-px bg-line rounded-2xl overflow-hidden`
- Each card keeps its current padding and text structure
- The icon container gets a fixed `w-10 h-10` wrapper to prevent layout shift during animation

---

## 3. Data-Flavored Visual Accents

### A) Section Dividers — Sparkline Rhythms

**Files:** `src/components/SectionLabel.tsx`

- Replace the `<div className="flex-1 h-px bg-line" />` element with an **SVG sparkline path**
- The sparkline is a gently undulating line — 3-5 smooth peaks/valleys across the width
- Generated deterministically from a `seed` prop (hash of section name) so each section has a unique shape:
  - Use a simple string hash (djb2) to seed a deterministic PRNG
  - Generate 5 control points evenly spaced across the width, with Y values between 1 and 7 (within the 8px height)
  - Connect points with smooth SVG cubic bezier paths (`C` commands)
- Uses `stroke: var(--color-line)` at `strokeWidth: 1.5`, same visual weight as current border
- **Draw-on-scroll animation:** `stroke-dashoffset` animates from full length to 0 when the section enters viewport (GSAP ScrollTrigger, `once: true`)
- Falls back to a static fully-drawn line when reduced motion is preferred
- SVG is `width="100%" height="8"` with `preserveAspectRatio="none"` so it stretches to container width

### B) Stats Grid — Contextual Micro-Copy

**Files:** `src/pages/HomePage.tsx` (stats data), `src/components/StatsCounter.tsx`

- Add a `subtitle` field to each stat object:
  - `{ value: "4+", label: "Years in Product Design", subtitle: "Discovery to delivery" }`
  - `{ value: "2", label: "Years as a Developer", subtitle: "I speak your engineers' language" }`
  - `{ value: "6+", label: "Years in Tech", subtitle: "SaaS, gov-tech, AI" }`
  - `{ value: "1", label: "AI Reporting Platform", subtitle: "End-to-end redesign" }`
- Render subtitle below the label in `text-[10px] text-muted/60 italic mt-1` (matches smallest text size used elsewhere in the project)
- StatsCounter interface updated: `Stat` gets optional `subtitle?: string`

### C) Footer — Signature Moment

**Files:** `src/components/Footer.tsx`, `src/pages/HomePage.tsx`

- Redesign footer layout:
  - Left: `<img src="/logo.png" alt="Stephen Webb" className="h-6" />` + copyright text
  - Center: Social icons (GitHub, LinkedIn) — **moved from contact section**. Import `Github`, `Linkedin` from `lucide-react` and `MagneticButton` from `../components/MagneticButton`. Social link URLs hardcoded in Footer (site-global, no props needed).
  - Right: "Back to top" button with `MagneticButton` wrapper, scrolls to top on click. Use visible text "Back to top" (not icon-only) so no `aria-label` needed. Add `aria-label="Scroll back to top"` as supplementary.
- Contact section keeps just the heading, subtitle paragraph, and email CTA button (social icons removed from there)
- Footer gets slightly more padding: `py-14` instead of `py-10`
- Social icons in footer use the same style as current contact section (circular border, hover color shift)
- **Steps 7 and 8 should be implemented together** (or in a single commit) to avoid a broken intermediate state where social icons appear in both contact and footer

---

## Implementation Order

1. **TiltCard component** — reusable, needed by work cards
2. **Work cards redesign** — screenshots + tilt + "Under NDA" reframe
3. **AnimatedCapIcon component** — the 4 custom SVG icons with hover animations
4. **Capabilities section refactor** — remove pinned scroll, wire up animated icons
5. **SectionLabel sparkline** — SVG generation + draw-on-scroll
6. **Stats micro-copy** — data update + subtitle rendering
7. **Footer redesign** — logo, social icons, back-to-top
8. **Contact section cleanup** — remove social icons (now in footer)

## Technical Notes

- All new animations respect `useReducedMotion()` from `src/lib/useReducedMotion.ts`
- No new dependencies — everything uses existing GSAP, Framer Motion, and Lucide
- TiltCard uses pure CSS transforms (no GSAP) for performance
- AnimatedCapIcon uses inline SVG (not Lucide components) for stroke animation control
- Sparkline generation is a pure function — deterministic from seed, no randomness at render time
