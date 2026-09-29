/**
 * The generator runner shared by the worker and the no-Worker main-thread
 * path (SPEC §9.9). It caches the index layout and dust per tier / aspect,
 * so a job only pays for its generators.
 */
import { StateId } from '../states/ids.ts';
import {
  createIndexLayout,
  makeContext,
  makeDust,
  runGenerator,
  type DustData,
  type IndexLayout,
  type TierDims,
} from '../states/common.ts';
import { generatorFor } from '../states/registry.ts';
import type { GenerateRequest, WorkerReply } from './protocol.ts';

let layoutCache: IndexLayout | null = null;
let dustCache: DustData | null = null;

export function layoutFor(t: TierDims): IndexLayout {
  if (!layoutCache || layoutCache.N !== t.N || layoutCache.S !== t.S) {
    layoutCache = createIndexLayout(t);
    dustCache = null;
  }
  return layoutCache;
}

export function dustFor(layout: IndexLayout, A: number): DustData {
  if (!dustCache || dustCache.A !== A) dustCache = makeDust(layout, A);
  return dustCache;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Run one id of a request. Returns the reply (with the buffers to transfer).
 * Never throws.
 */
export function runOne(req: GenerateRequest, id: StateId): WorkerReply {
  const gen = generatorFor(id);
  if (!gen || id === StateId.NAME) return { type: 'missing', job: req.job, id };
  try {
    const t0 = now();
    const layout = layoutFor(req.tier);
    const dust = dustFor(layout, req.view.A);
    const anchor = req.anchors[id] ?? { w: req.view.W, h: req.view.svh, extra: {} };
    const ctx = makeContext(id, layout, req.view, req.layout, req.short, anchor);
    const st = runGenerator(gen, ctx, dust);
    return { type: 'state', job: req.job, id, pos: st.pos, meta: st.meta, extras: st.extras, ms: now() - t0 };
  } catch (e) {
    return { type: 'error', job: req.job, id, message: e instanceof Error ? e.message : String(e) };
  }
}
