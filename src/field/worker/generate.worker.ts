/**
 * Generator worker (SPEC §9.9): runs S0 and S2–S10 off the main thread and
 * transfers each state's buffers as soon as it is built. S1 is sampled from
 * the DOM on the main thread (states/name-sampler.ts).
 *
 * Loaded with `new Worker(new URL('./worker/generate.worker.ts',
 * import.meta.url), { type: 'module' })`. Budget ≤ 20 KB gz.
 */
import { runOne } from './run.ts';
import type { WorkerReply, WorkerRequest } from './protocol.ts';

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerReply, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

/** The latest job: a newer request supersedes the rest of an older one. */
let latest = -1;

scope.onmessage = (e) => {
  const req = e.data;
  if (req?.type !== 'generate') return;
  latest = req.job;
  // One state per macrotask, so a superseding request can cut in between.
  const ids = [...req.ids];
  const step = () => {
    if (req.job !== latest) return;
    const id = ids.shift();
    if (id === undefined) {
      scope.postMessage({ type: 'done', job: req.job });
      return;
    }
    const reply = runOne(req, id);
    scope.postMessage(reply, reply.type === 'state' ? [reply.pos.buffer, reply.meta.buffer] : []);
    setTimeout(step, 0);
  };
  step();
};
