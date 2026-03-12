# Hero Section Redesign — Flow Field Animation

**Date:** 2026-03-11
**Status:** Approved

## Summary

Replace the current static-feeling hero (left-aligned text over faint morphing wireframe rectangles) with a fullscreen Perlin noise flow field featuring a two-stage particle-to-solid text entrance, split layout with an organically-masked portrait photo, and a new sans-serif display font.

## Animation: Flow Field (p5.js)

- **Type:** Perlin noise flow field with particle trails, fullscreen canvas behind all content
- **Particles:** ~2500 on desktop, ~1000 on mobile
- **Colors:** Multi-color palette — orange `#d97757`, orange-light `#e8a08a`, orange-dark `#c86641`, warm muted, cool muted
- **Motion:** Visible streaming with short-lived trails. Particles spawn from edges and random positions, flow along noise currents. Stronger fade rate (6% per frame) so motion is clearly perceptible.
- **Interaction:** Mouse cursor creates a swirl vortex — particles deflect around cursor position (250px radius)
- **Performance:** Canvas with `devicePixelRatio` capped at 2. Reduced particle count on mobile.

## Entrance Sequence (Hybrid Two-Stage)

| Phase | Time | What Happens |
|-------|------|-------------|
| 1 | 0–0.5s | Flow field starts immediately. Title label ("Senior Product Designer"), tagline, and CTAs fade in via Framer Motion. Particles flow freely. |
| 2 | 0.5–2s | Particles converge toward "Stephen Webb" letter shapes (sampled from offscreen canvas pixel data). |
| 3 | 2–2.5s | Shimmer/settle — particles vibrate at letter positions briefly. |
| 4 | 2.5–3s | Solid text fades in over particle text. Particles release back into the flow field. Photo fades in. |

**Technique:** Render name text in Space Grotesk to a hidden canvas, read pixel data to extract letter-position coordinates, use those as attractor points for a subset of particles during the convergence phase.

## Typography

- **Display font:** Space Grotesk, 700 weight (replaces Instrument Serif)
- **Body font:** DM Sans (unchanged)
- **Name color:** All `#141413` — both "Stephen" and "Webb" in same dark color. Flow field provides all color.
- **Sizing:** Responsive `clamp(3.5rem, 10vw, 8rem)` — large enough for particle formation to read clearly

## Layout: Split

- **Desktop:** Two-column. Left: label, name, tagline, CTAs. Right: organically-masked portrait photo. Vertically centered.
- **Photo mask:** Organic blob-shaped SVG clip-path with irregular, fluid edges echoing the flow field aesthetic.
- **Mobile:** Stacked — text content on top, photo below (smaller, still masked). Flow field spans full background.
- **Canvas layer:** Fullscreen behind everything. Particles flow around and through both text and photo areas.

## Files Affected

| Action | File | Description |
|--------|------|-------------|
| Create | `src/components/FlowField.tsx` | New p5.js particle system with text attractor logic, replacing BlueprintGrid |
| Modify | `src/pages/HomePage.tsx` | New hero layout, entrance choreography, Space Grotesk usage |
| Modify | `src/index.css` | Update `--font-display` to Space Grotesk, add organic mask clip-path |
| Modify | `index.html` | Update Google Fonts link to include Space Grotesk |
| Delete | `src/components/BlueprintGrid.tsx` | Replaced by FlowField |
| Delete | `src/components/MeshNetwork.tsx` | Unused component |
| Add | `public/` | Portrait photo (user-provided) |

## Design Decisions

1. **Flow field over gradient blobs or liquid mesh** — Most technically impressive, creates genuine wow-factor. Particles forming text is a memorable entrance moment.
2. **Space Grotesk over Instrument Serif** — Mono-influenced geometric sans feels "engineered" and matches the particle/technical aesthetic. Serif felt too polished/editorial.
3. **All-dark name over two-tone** — Let the flow field own the color. Name becomes a strong monolithic anchor.
4. **Organic mask over clean cutout** — Ties the photo into the flow field energy rather than feeling like a separate dropped-on element.
5. **Hybrid entrance over full-animation-first** — Supporting text visible in <1s (no dead screen), while the particle convergence provides the wow moment.
