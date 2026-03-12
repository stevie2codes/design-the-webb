# designthewebb.com

Personal portfolio for Stephen Webb — Senior Product Designer at Tyler Technologies.

## Stack

- **React 19** + TypeScript
- **Vite 7** with HMR
- **Tailwind CSS 4** (v4 `@theme` tokens, no config file)
- **Framer Motion** for page transitions and scroll reveals
- **p5.js** for the animated wireframe grid in the hero
- **React Router** for client-side routing
- **Lucide** icons

## Project Structure

```
src/
  components/
    BlueprintGrid.tsx   # p5.js animated wireframe background
    Nav.tsx             # Top navigation
    Footer.tsx          # Site footer
    Reveal.tsx          # Scroll-triggered reveal wrapper
    SectionLabel.tsx    # Section label component
  pages/
    HomePage.tsx        # Main landing page (hero, about, work, capabilities, contact)
    ProjectDetailPage.tsx  # Individual project case study page
  data/
    projects.ts         # Side project data
  index.css             # Tailwind imports + custom theme tokens + component styles
public/
  stephens-portrait.png # Sketch-style portrait illustration
```

## Design Tokens

Defined in `src/index.css` via Tailwind v4 `@theme`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-cream` | `#faf9f5` | Background |
| `--color-orange` | `#d97757` | Accent / CTA |
| `--color-dark` | `#141413` | Text |
| `--color-muted` | `#8a8880` | Secondary text |
| `--font-display` | Instrument Serif | Headings |
| `--font-body` | DM Sans | Body copy |

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`.
