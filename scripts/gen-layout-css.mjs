// Writes the static layout variables (src/field/layout.ts → CSS) into
// src/index.css between the `@generated layout-vars` markers, so the page
// lays out before (and without) JS. At runtime applyLayoutVars() injects the
// same values keyed on html[data-layout].
//
//   node scripts/gen-layout-css.mjs          rewrite the block
//   node scripts/gen-layout-css.mjs --check  exit 1 if the block is stale
//
// Needs node ≥ 22.18 (native TypeScript type stripping).
import { readFileSync, writeFileSync } from 'node:fs';
import { layoutCss } from '../src/field/layout.ts';

const file = new URL('../src/index.css', import.meta.url);
const START = '/* @generated layout-vars:start — edit src/field/layout.ts, then `npm run gen:layout` */';
const END = '/* @generated layout-vars:end */';
const INDENT = '  ';

const css = readFileSync(file, 'utf8');
const a = css.indexOf(START);
const b = css.indexOf(END);
if (a < 0 || b < a) {
  console.error('gen-layout-css: markers not found in src/index.css');
  process.exit(1);
}
const block = `${START}\n${layoutCss('media', INDENT)}\n${INDENT}${END}`;
const next = css.slice(0, a) + block + css.slice(b + END.length);

if (process.argv.includes('--check')) {
  if (next !== css) {
    console.error('gen-layout-css: src/index.css is stale; run `npm run gen:layout`');
    process.exit(1);
  }
  console.log('gen-layout-css: up to date');
} else if (next !== css) {
  writeFileSync(file, next);
  console.log('gen-layout-css: src/index.css updated');
} else {
  console.log('gen-layout-css: already up to date');
}
