# Personality Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add data-flavored personality to the portfolio through micro-interactions (TiltCard, animated capability icons), visual accents (sparkline dividers, stats subtitles), and a redesigned footer — all respecting reduced motion preferences.

**Architecture:** New standalone components (`TiltCard`, `AnimatedCapIcon`, sparkline in `SectionLabel`) that slot into the existing HomePage layout. No structural changes to routing or data flow — only cosmetic/interaction enhancements. The capabilities section removes its pinned GSAP scroll in favor of standard `GSAPReveal` wrappers with animated icons.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4, GSAP + ScrollTrigger, Framer Motion, Lucide React. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-17-personality-enhancements-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/TiltCard.tsx` | Mouse-tracking CSS perspective tilt wrapper |
| Create | `src/components/AnimatedCapIcon.tsx` | 4 inline SVG icons with unique hover/scroll animations |
| Modify | `src/components/GSAPReveal.tsx` | Add `onEnter` callback prop |
| Modify | `src/components/SectionLabel.tsx` | Replace `h-px bg-line` div with SVG sparkline + draw-on-scroll |
| Modify | `src/components/StatsCounter.tsx` | Add optional `subtitle` field to `Stat` interface + render |
| Modify | `src/components/Footer.tsx` | Full redesign: logo, social icons, back-to-top |
| Modify | `src/pages/HomePage.tsx` | Work cards (screenshots + tilt + NDA), capabilities refactor, stats subtitles, contact social removal |
| Modify | `src/data/projects.ts` | No changes needed (screenshot fields already present) |

---

## Chunk 1: TiltCard Component + Work Cards Redesign

### Task 1: Create TiltCard Component

**Files:**
- Create: `src/components/TiltCard.tsx`

- [ ] **Step 1: Create the TiltCard component**

```tsx
// src/components/TiltCard.tsx
import { useRef, useCallback } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltStrength?: number;
}

export default function TiltCard({
  children,
  className,
  tiltStrength = 4,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduced) return;
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rotateX =
        ((e.clientY - centerY) / (rect.height / 2)) * tiltStrength;
      const rotateY =
        ((e.clientX - centerX) / (rect.width / 2)) * -tiltStrength;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    },
    [tiltStrength, reduced]
  );

  const handleMouseLeave = useCallback(() => {
    if (reduced) return;
    const card = cardRef.current;
    if (card) {
      card.style.transform =
        "perspective(800px) rotateX(0deg) rotateY(0deg)";
    }
  }, [reduced]);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: "transform 300ms ease-out",
        willChange: reduced ? "auto" : "transform",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify TiltCard renders**

Run: `npm run dev` (if not already running)
Open browser → navigate to localhost:5173 → verify no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TiltCard.tsx
git commit -m "feat: add TiltCard mouse-tracking perspective tilt component"
```

---

### Task 2: Redesign Work Cards — Screenshots + Tilt

**Files:**
- Modify: `src/pages/HomePage.tsx:398-457` (work section)

- [ ] **Step 1: Add TiltCard import to HomePage**

At the top of `HomePage.tsx`, add:
```tsx
import TiltCard from "../components/TiltCard";
```

- [ ] **Step 2: Replace side project card markup with screenshot layout + TiltCard**

Replace the entire side projects `.map()` block (the `<div className="space-y-10 lg:space-y-12">` and its contents, lines 428-456) with:

```tsx
<div className="space-y-10 lg:space-y-12">
  {sideProjects.map((project, i) => (
    <GSAPReveal key={project.slug} delay={0.12 + i * 0.08}>
      <TiltCard>
        <Link
          to={`/work/${project.slug}`}
          className={`group block rounded-2xl p-10 md:p-14 lg:p-16 ${
            i % 2 === 0 ? "bg-orange/5" : "bg-dark/[0.03]"
          } hover:bg-orange/[0.07] transition-all duration-500 cursor-pointer`}
        >
          <div className={`${project.screenshot ? "md:flex md:gap-10 lg:gap-14" : ""}`}>
            {project.screenshot && (
              <ScreenshotImage
                src={project.screenshot}
                alt={`${project.title} screenshot`}
              />
            )}
            <div className="flex-1">
              <h3 className="font-display text-2xl md:text-3xl text-dark mb-4 flex items-center gap-3">
                {project.title}
                <ArrowUpRight className="w-5 h-5 text-orange opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-muted leading-relaxed max-w-2xl mb-6">
                {project.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs font-medium text-dark/50 border border-dark/10"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Link>
      </TiltCard>
    </GSAPReveal>
  ))}
</div>
```

- [ ] **Step 3: Add ScreenshotImage helper component**

First, update the React import at the top of `HomePage.tsx` to include `useState`:

```tsx
import { useRef, useState } from "react";
```

Then add this component above the `HomePage` function (below the `stats` array):

```tsx
function ScreenshotImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <div className="md:w-[40%] mb-6 md:mb-0 rounded-xl overflow-hidden aspect-[16/10] flex-shrink-0">
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify work cards with screenshots**

Open browser → scroll to "Selected Work" → verify:
- Pulse, Gov Data Generator, Prmpt Art show screenshots on the left (desktop)
- MCP App shows text-only layout (no screenshot field)
- Hover tilt works on desktop
- Screenshots scale on hover

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: add screenshot layout and TiltCard hover to work cards"
```

---

### Task 3: Replace "Coming Soon" with "Under NDA" Card

**Files:**
- Modify: `src/pages/HomePage.tsx:405-419` (case studies placeholder)

- [ ] **Step 1: Add Lock import**

Add `Lock` to the lucide-react import at the top of `HomePage.tsx`:
```tsx
import { ..., Lock } from "lucide-react";
```

- [ ] **Step 2: Replace the dashed-border placeholder**

Replace the "Case studies coming soon" `GSAPReveal` block (the entire dashed-border div) with:

```tsx
<GSAPReveal>
  <div className="rounded-2xl bg-cream-dark p-10 md:p-14 lg:p-16 mb-16 lg:mb-20 text-center">
    <div className="flex items-center justify-center gap-2 mb-4">
      <Lock className="w-4 h-4 text-orange" strokeWidth={1.5} />
      <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange">
        Under NDA
      </p>
    </div>
    <h3 className="font-display text-2xl md:text-3xl text-dark mb-4">
      Tyler Technologies Case Studies
    </h3>
    <p className="text-muted leading-relaxed max-w-lg mx-auto">
      Detailed case studies from my work at Tyler Technologies.
      Available upon request.
    </p>
  </div>
</GSAPReveal>
```

- [ ] **Step 3: Verify NDA card**

Open browser → scroll to work section → verify:
- Solid cream-dark background (no dashed border)
- Lock icon + "Under NDA" label
- Updated description text
- Card is non-interactive (no hover state, no link)

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: replace 'Coming Soon' placeholder with 'Under NDA' card"
```

---

## Chunk 2: Animated Capability Icons + Section Refactor

### Task 4: Add `onEnter` Callback to GSAPReveal

**Files:**
- Modify: `src/components/GSAPReveal.tsx`

- [ ] **Step 1: Add onEnter prop to GSAPReveal interface and implementation**

Update the interface to include `onEnter`:

```tsx
interface GSAPRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  onEnter?: () => void;
}
```

Update the function signature:

```tsx
export default function GSAPReveal({
  children,
  className,
  delay = 0,
  stagger = 0.08,
  onEnter,
}: GSAPRevealProps) {
```

Add `onEnter` call inside the `scrollTrigger` config (add the `onEnter` key):

```tsx
scrollTrigger: {
  trigger: el,
  start: "top 85%",
  once: true,
  onEnter: onEnter,
},
```

- [ ] **Step 2: Verify existing reveals still work**

Open browser → scroll through page → all existing GSAPReveal animations should work identically (the new prop is optional with no default behavior change).

- [ ] **Step 3: Commit**

```bash
git add src/components/GSAPReveal.tsx
git commit -m "feat: add onEnter callback prop to GSAPReveal"
```

---

### Task 5: Create AnimatedCapIcon Component

**Files:**
- Create: `src/components/AnimatedCapIcon.tsx`

- [ ] **Step 1: Create the AnimatedCapIcon component with 4 SVG icons**

```tsx
// src/components/AnimatedCapIcon.tsx
import { useState } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";

type IconName = "layers" | "barChart" | "compass" | "penTool";

interface AnimatedCapIconProps {
  name: IconName;
  isInView?: boolean;
  className?: string;
}

export default function AnimatedCapIcon({
  name,
  isInView = false,
  className = "",
}: AnimatedCapIconProps) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();

  const active = reduced ? false : hovered || isInView;

  return (
    <div
      className={`w-10 h-10 ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 text-orange"
      >
        {name === "layers" && <LayersIcon active={active} />}
        {name === "barChart" && <BarChartIcon active={active} />}
        {name === "compass" && <CompassIcon active={active} />}
        {name === "penTool" && <PenToolIcon active={active} />}
      </svg>
    </div>
  );
}

/* ── Layers: 3 horizontal lines that spread vertically on hover ── */
function LayersIcon({ active }: { active: boolean }) {
  // Use transform: translateY instead of animating SVG y1/y2 attributes
  // (SVG geometry attribute transitions don't work in Firefox/Safari)
  const offset = active ? 2 : 0;
  return (
    <g>
      <g style={{ transition: "transform 400ms ease-out", transform: `translateY(${-offset}px)` }}>
        <line x1="2" y1="8" x2="22" y2="8" />
      </g>
      <line x1="2" y1="12" x2="22" y2="12" />
      <g style={{ transition: "transform 400ms ease-out", transform: `translateY(${offset}px)` }}>
        <line x1="2" y1="16" x2="22" y2="16" />
      </g>
    </g>
  );
}

/* ── BarChart: 3 bars that grow from bottom on hover ── */
function BarChartIcon({ active }: { active: boolean }) {
  // Use transform: scaleY instead of animating SVG y/height attributes
  // (SVG geometry attribute transitions don't work in Firefox/Safari)
  const scales = active ? [0.6, 1, 0.75] : [0, 0, 0];
  return (
    <g>
      {[
        { x: 4, scale: scales[0], delay: "0ms" },
        { x: 10, scale: scales[1], delay: "80ms" },
        { x: 16, scale: scales[2], delay: "160ms" },
      ].map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={6}
          width="4"
          height="16"
          rx="1"
          fill="currentColor"
          stroke="none"
          style={{
            transformOrigin: `${bar.x + 2}px 22px`,
            transition: `transform 400ms ease-out ${bar.delay}`,
            transform: `scaleY(${bar.scale})`,
          }}
        />
      ))}
      <line x1="2" y1="22" x2="22" y2="22" />
    </g>
  );
}

/* ── Compass: needle rotates 360deg on hover ── */
function CompassIcon({ active }: { active: boolean }) {
  // Reset without transition on leave, animate on enter — allows repeated 360deg spins
  return (
    <g
      style={{
        transformOrigin: "12px 12px",
        transition: active ? "transform 600ms ease-out" : "none",
        transform: active ? "rotate(360deg)" : "rotate(0deg)",
      }}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="12,2 15,12 12,14 9,12"
        fill="currentColor"
        stroke="none"
      />
    </g>
  );
}

/* ── PenTool: stroke draws in via dashoffset on hover ── */
function PenToolIcon({ active }: { active: boolean }) {
  const pathLength = 80;
  return (
    <path
      d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586"
      strokeDasharray={pathLength}
      strokeDashoffset={active ? 0 : pathLength}
      style={{
        transition: "stroke-dashoffset 500ms ease-out",
      }}
    />
  );
}
```

- [ ] **Step 2: Verify component renders without errors**

This component isn't wired up yet — just verify no TypeScript/import errors in the dev server console.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnimatedCapIcon.tsx
git commit -m "feat: add AnimatedCapIcon with 4 unique SVG hover animations"
```

---

### Task 6: Refactor Capabilities Section

**Files:**
- Modify: `src/pages/HomePage.tsx:29-54` (capabilities data), `193-260` (pinned GSAP block), `461-498` (capabilities JSX)

- [ ] **Step 1: Add AnimatedCapIcon import**

```tsx
import AnimatedCapIcon from "../components/AnimatedCapIcon";
```

- [ ] **Step 2: Update capabilities data to use icon names instead of Lucide components**

Replace the `capabilities` array (lines 29-54) with:

```tsx
const capabilities = [
  {
    iconName: "layers" as const,
    title: "Product Design",
    description:
      "From discovery to delivery. I design end-to-end product experiences rooted in user research, business strategy, and systems thinking.",
  },
  {
    iconName: "barChart" as const,
    title: "Data Visualization",
    description:
      "Turning dense datasets into legible, actionable interfaces. Charts, dashboards, and exploratory tools that respect the complexity of real data.",
  },
  {
    iconName: "compass" as const,
    title: "Design Systems",
    description:
      "Building scalable component libraries and design tokens that keep teams aligned and products consistent across dozens of surfaces.",
  },
  {
    iconName: "penTool" as const,
    title: "Prototyping",
    description:
      "High-fidelity interactive prototypes that communicate intent precisely. I prototype to think, test, and sell ideas—not just to document them.",
  },
];
```

- [ ] **Step 3: Remove unused Lucide icon imports**

Remove `Layers`, `BarChart3`, `Compass`, `PenTool` from the lucide-react import (they are no longer used — `AnimatedCapIcon` uses inline SVG).

- [ ] **Step 4: Delete the CAPABILITIES PINNED REVEAL useGSAP block**

Delete the entire third `useGSAP` block (the `// ═══ CAPABILITIES PINNED REVEAL ═══` section, lines 193-260). Also remove the `capabilitiesRef` ref declaration (line 73) and the `ref={capabilitiesRef}` from the capabilities section wrapper div.

- [ ] **Step 5: Replace capabilities grid JSX**

Replace the capabilities grid (the `<div className="grid md:grid-cols-2 ...">` block) with:

```tsx
<div className="grid md:grid-cols-2 gap-px bg-line rounded-2xl overflow-hidden">
  {capabilities.map((cap, i) => (
    <CapabilityCard key={cap.title} cap={cap} index={i} />
  ))}
</div>
```

Add a `CapabilityCard` component above the `HomePage` function (hooks must live in a proper component, not inside `.map()`):

```tsx
function CapabilityCard({
  cap,
  index,
}: {
  cap: (typeof capabilities)[number];
  index: number;
}) {
  const [inView, setInView] = useState(false);
  return (
    <GSAPReveal delay={0.1 + index * 0.1} onEnter={() => setInView(true)}>
      <div className="bg-cream p-12 md:p-16 lg:p-20 group hover:bg-orange/[0.03] transition-colors duration-500 h-full">
        <AnimatedCapIcon
          name={cap.iconName}
          isInView={inView}
          className="mb-10"
        />
        <h3 className="font-display text-xl md:text-2xl text-dark mb-5">
          {cap.title}
        </h3>
        <p className="text-muted leading-relaxed text-[15px]">
          {cap.description}
        </p>
      </div>
    </GSAPReveal>
  );
}
```

- [ ] **Step 6: Verify capabilities section**

Open browser → scroll to "What I Do" section → verify:
- Grid renders 4 cards with standard GSAPReveal entrance (no more pinned scrolling)
- Icons show static on first load, animate once when scrolled into view (mobile behavior)
- On desktop: hovering a card triggers the icon's unique animation
- Reduced motion: icons show static, no animation

- [ ] **Step 7: Commit**

```bash
git add src/components/AnimatedCapIcon.tsx src/components/GSAPReveal.tsx src/pages/HomePage.tsx
git commit -m "feat: replace pinned capabilities scroll with animated icon cards"
```

---

## Chunk 3: Sparkline Dividers + Stats Subtitles

### Task 7: Add Sparkline Dividers to SectionLabel

**Files:**
- Modify: `src/components/SectionLabel.tsx`

- [ ] **Step 1: Rewrite SectionLabel with sparkline SVG**

Replace the entire file with:

```tsx
import { useRef, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap-init";
import { useReducedMotion } from "../lib/useReducedMotion";

// djb2 string hash → deterministic seed
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

// Seeded PRNG (simple LCG)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateSparklinePath(seed: string): string {
  const rand = seededRandom(hashString(seed));
  const points = 5;
  const segments: string[] = [];

  // Generate control points: evenly spaced X, random Y between 1-7
  const pts = Array.from({ length: points }, (_, i) => ({
    x: (i / (points - 1)) * 100,
    y: 1 + rand() * 6, // Y between 1 and 7 within 8px height
  }));

  // Start at first point
  segments.push(`M ${pts[0].x} ${pts[0].y}`);

  // Cubic bezier through remaining points
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx1 = prev.x + (curr.x - prev.x) / 3;
    const cpx2 = prev.x + ((curr.x - prev.x) * 2) / 3;
    segments.push(
      `C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`
    );
  }

  return segments.join(" ");
}

export default function SectionLabel({
  children,
  className = "mb-20",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const reduced = useReducedMotion();
  const seed = typeof children === "string" ? children : "section";
  const d = useMemo(() => generateSparklinePath(seed), [seed]);

  useGSAP(() => {
    const path = pathRef.current;
    if (!path || reduced) return;

    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(path, {
      strokeDashoffset: 0,
      duration: 1.2,
      ease: "power2.out",
      scrollTrigger: {
        trigger: path,
        start: "top 85%",
        once: true,
      },
    });
  }, { dependencies: [reduced, d] });

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="text-xs font-medium tracking-[0.2em] uppercase text-orange whitespace-nowrap">
        {children}
      </span>
      <svg
        className="flex-1"
        width="100%"
        height="8"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          ref={pathRef}
          d={d}
          stroke="var(--color-line)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify sparkline dividers**

Open browser → scroll through page → verify:
- Each section label ("About", "Selected Work", "What I Do", "Get in Touch") has a gently undulating line instead of a flat line
- Each section has a different sparkline shape
- Lines draw on scroll (animate from left to right)
- Reduced motion: lines appear fully drawn immediately

- [ ] **Step 3: Commit**

```bash
git add src/components/SectionLabel.tsx
git commit -m "feat: replace flat section dividers with animated sparkline SVGs"
```

---

### Task 8: Add Stats Micro-Copy Subtitles

**Files:**
- Modify: `src/components/StatsCounter.tsx` (interface + render)
- Modify: `src/pages/HomePage.tsx:56-61` (stats data)

- [ ] **Step 1: Update Stat interface and render subtitle**

In `StatsCounter.tsx`, update the `Stat` interface:

```tsx
interface Stat {
  value: string;
  label: string;
  subtitle?: string;
}
```

In the render, add the subtitle below the label (after the `<div className="text-xs tracking-wide text-muted uppercase">` block):

```tsx
{stat.subtitle && (
  <div className="text-[10px] text-muted/60 italic mt-1">
    {stat.subtitle}
  </div>
)}
```

- [ ] **Step 2: Update stats data in HomePage**

Replace the `stats` array in `HomePage.tsx`:

```tsx
const stats = [
  { value: "4+", label: "Years in Product Design", subtitle: "Discovery to delivery" },
  { value: "2", label: "Years as a Developer", subtitle: "I speak your engineers' language" },
  { value: "6+", label: "Years in Tech", subtitle: "SaaS, gov-tech, AI" },
  { value: "1", label: "AI Reporting Platform", subtitle: "End-to-end redesign" },
];
```

- [ ] **Step 3: Verify stats subtitles**

Open browser → scroll to stats grid → verify:
- Each stat cell shows the subtitle in small italic text below the label
- Subtitles are muted/light opacity

- [ ] **Step 4: Commit**

```bash
git add src/components/StatsCounter.tsx src/pages/HomePage.tsx
git commit -m "feat: add contextual micro-copy subtitles to stats grid"
```

---

## Chunk 4: Footer Redesign + Contact Cleanup

### Task 9: Redesign Footer

**Files:**
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Rewrite Footer component**

Replace the entire file with:

```tsx
import { ArrowUp, Github, Linkedin } from "lucide-react";
import MagneticButton from "./MagneticButton";

const socials = [
  { icon: Github, label: "GitHub", href: "https://github.com/stevie2codes" },
  { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/js-webb/" },
];

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="px-6 md:px-12 py-14 border-t border-line">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Logo + copyright */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Stephen Webb" className="h-6" />
          <span className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Stephen Webb
          </span>
        </div>

        {/* Center: Social icons */}
        <div className="flex items-center gap-4">
          {socials.map((social) => (
            <MagneticButton key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="w-10 h-10 rounded-full border border-dark/10 flex items-center justify-center text-muted hover:text-dark hover:border-dark/30 transition-all"
              >
                <social.icon className="w-4 h-4" />
              </a>
            </MagneticButton>
          ))}
        </div>

        {/* Right: Back to top */}
        <MagneticButton>
          <button
            onClick={scrollToTop}
            aria-label="Scroll back to top"
            className="group inline-flex items-center gap-2 text-xs text-muted hover:text-dark transition-colors"
          >
            Back to top
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </MagneticButton>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify footer**

Open browser → scroll to bottom → verify:
- Logo + copyright on the left
- GitHub + LinkedIn social icons in center
- "Back to top" button on the right that scrolls to top on click
- Social icons have hover state (circular border, color shift)

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat: redesign footer with logo, social icons, and back-to-top"
```

---

### Task 10: Remove Social Icons from Contact Section

**Files:**
- Modify: `src/pages/HomePage.tsx:538-555` (contact social icons block)

- [ ] **Step 1: Remove social icons from contact section**

Delete the entire last `GSAPReveal` block in the contact section — the one wrapping the social icons `div` (the `<GSAPReveal delay={0.4}>` block with the GitHub/LinkedIn icons).

- [ ] **Step 2: Remove unused imports if applicable**

Check if `Github` and `Linkedin` are still used elsewhere in HomePage. If not (they shouldn't be after removing from contact), remove them from the lucide-react import.

- [ ] **Step 3: Verify contact section**

Open browser → scroll to contact section → verify:
- Heading, subtitle, and email CTA remain
- No more social icons in contact
- Social icons now only appear in footer

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: move social icons from contact section to footer"
```

---

## Chunk 5: Final Verification

### Task 11: Full Page Verification

- [ ] **Step 1: Run production build**

```bash
cd /Users/stevie2toes/design-the-webb/webb-design && npm run build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 2: Full visual verification**

Using the dev server, verify each enhancement:
1. **Work cards**: Screenshots display, tilt on hover, "Under NDA" card styled correctly
2. **Capabilities**: Animated icons respond to hover (desktop) and scroll (mobile), no pinned scroll
3. **Sparkline dividers**: Each section has unique undulating line, draw-on-scroll works
4. **Stats subtitles**: Italic micro-copy visible below each stat label
5. **Footer**: Logo, social icons, back-to-top all present and functional
6. **Contact**: Social icons removed, only email CTA remains
7. **Reduced motion**: Toggle in OS settings → all animations disabled, static fallbacks render

- [ ] **Step 3: Console check**

Verify zero errors and zero warnings in browser console across all pages (home + project detail + 404).

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for personality enhancements"
```
