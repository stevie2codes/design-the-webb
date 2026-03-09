# Portfolio 2025

Personal portfolio website for a product designer in the SaaS data space.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- **Animation**: Framer Motion
- **Generative Art**: p5.js (instance mode for React compatibility)
- **Icons**: Lucide React
- **Fonts**: Instrument Serif (display) + DM Sans (body) — loaded via `<link>` in `index.html`

## Project Structure

```
src/
  App.tsx              — Main single-page app with all sections
  index.css            — Tailwind imports + @theme tokens + base layer overrides
  components/
    BlueprintGrid.tsx  — p5.js hero background (morphing wireframe rectangles on dot grid)
    MeshNetwork.tsx    — p5.js floating connected nodes (available, not currently used)
```

## Design System

### Color Palette (defined in `@theme` in index.css)
- `cream` (#faf9f5) — primary background
- `cream-dark` (#f0ede5) — section alternate background
- `orange` (#d97757) — accent/brand color
- `dark` (#141413) — primary text
- `muted` (#8a8880) — secondary text
- `line` (#e0ddd4) — borders and dividers

### Typography
- Display/headings: `font-display` (Instrument Serif)
- Body text: `font-body` (DM Sans)

### Spacing Philosophy
- Sections use generous vertical padding: `py-40 md:py-56 lg:py-64`
- Content constrained to `max-w-6xl` with `px-6 md:px-12`
- Large gaps between elements for breathing room on wide viewports

## Key Patterns

### Tailwind CSS v4 Specifics
- Uses `@import "tailwindcss"` instead of `@tailwind` directives
- Theme tokens defined with `@theme { }` block (not `tailwind.config.js`)
- Custom CSS MUST be wrapped in `@layer base { }` — un-layered styles override all Tailwind utilities due to CSS cascade layer precedence
- Google Fonts loaded via HTML `<link>`, NOT CSS `@import` (causes ordering conflicts with Tailwind)

### p5.js in React
- Uses p5.js **instance mode** (`new p5((p) => { ... })`) — NOT global mode
- Canvas managed via `useRef` + `useEffect` cleanup
- p5.js v2 may produce "Invalid hook call" console warnings — these are non-breaking

### Framer Motion
- Scroll animations use `whileInView` prop (not `useInView` hook)
- `Reveal` wrapper component handles scroll-triggered fade-in + slide-up
- `viewport={{ once: true }}` so animations only trigger once

## Commands

- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Guidelines

- Keep the aesthetic: warm, editorial, craft-forward — not generic AI/SaaS
- Maintain generous whitespace — this is a design portfolio
- BlueprintGrid is the hero identity piece — preserve it
- Prefer Tailwind utilities over custom CSS
- When adding custom CSS, always wrap in `@layer base { }` or `@layer components { }`
