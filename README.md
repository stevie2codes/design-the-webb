# designthewebb.com

Personal portfolio for Stephen Webb, Senior Product Designer at Tyler Technologies.

The site is called **Signal from Noise**. It is dark and cinematic. One persistent WebGL point field sits behind the page and morphs as you scroll, with sticky DOM chapters on top of it. The full build spec is [`docs/redesign/SPEC.md`](docs/redesign/SPEC.md). Contributor and agent notes are in [`CLAUDE.md`](CLAUDE.md).

## Stack

- **Core:** React 19, TypeScript and Vite 7, with React Router 7.
- **Styling:** Tailwind CSS 4, with `@theme` tokens and no config file.
- **Motion:** GSAP 3.14 (ScrollTrigger, SplitText, CustomEase) and Lenis for smooth scrolling.
- **Field:** three.js, loaded after first paint.
- **Fonts:** self-hosted through fontsource: Archivo Variable, Instrument Serif and JetBrains Mono Variable.
- **Icons:** Lucide.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run build      # output in dist/
```

After editing `src/field/layout.ts`, run `npm run gen:layout` to refresh the static layout variables in `src/index.css`.
