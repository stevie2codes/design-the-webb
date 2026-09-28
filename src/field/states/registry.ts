/**
 * Worker-side generator registry (SPEC §9.9). Every `states/sNN-*.ts` file
 * that exports `generator: StateGenerator` is picked up here by filename, so
 * adding a state never touches this file. S1 NAME is not here: it samples
 * the DOM and runs on the main thread (states/name-sampler.ts).
 *
 * Eager glob: the generators are bundled into the worker chunk (a classic
 * worker has no code splitting). Vite-only (import.meta.glob).
 */
import type { StateId } from './ids.ts';
import type { StateGenerator } from './common.ts';

const modules = import.meta.glob<StateGenerator>('./s[0-9][0-9]-*.ts', { eager: true, import: 'generator' });

const byId = new Map<StateId, StateGenerator>();
for (const gen of Object.values(modules)) if (gen) byId.set(gen.id, gen);

/** The generator for a state, or undefined when it has none yet. */
export function generatorFor(id: StateId): StateGenerator | undefined {
  return byId.get(id);
}

/** Ids with a worker generator (sorted). */
export function generatedIds(): StateId[] {
  return [...byId.keys()].sort((a, b) => a - b);
}
