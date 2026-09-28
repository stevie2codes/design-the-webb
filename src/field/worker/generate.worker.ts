/**
 * Generator worker (SPEC §9.9): runs S0 and S2–S10 off the main thread and
 * transfers each state's buffers as soon as it is built. S1 is sampled from
 * the DOM on the main thread (states/name-sampler.ts).
 *
 * Loaded with `new Worker(new URL('./worker/generate.worker.ts',
 * import.meta.url), { type: 'module' })`. Budget ≤ 20 KB gz. Jobs run in
 * order, one state per macrotask, so a superseding request (resize) cuts in
 * between states.
 */
import { runOne } from './run.ts';
import type { StateId } from '../states/ids.ts';
import type { GenerateRequest, WorkerReply, WorkerRequest } from './protocol.ts';

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerReply, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

interface Queued {
  readonly req: GenerateRequest;
  readonly ids: StateId[];
}

/** Jobs in order; a superseding request clears it. One state per macrotask. */
const queue: Queued[] = [];
let running = false;

function step(): void {
  const head = queue[0];
  if (!head) {
    running = false;
    return;
  }
  const id = head.ids.shift();
  if (id === undefined) {
    queue.shift();
    scope.postMessage({ type: 'done', job: head.req.job });
  } else {
    const reply = runOne(head.req, id);
    scope.postMessage(reply, reply.type === 'state' ? [reply.pos.buffer, reply.meta.buffer] : []);
  }
  setTimeout(step, 0);
}

scope.onmessage = (e) => {
  const req = e.data;
  if (req?.type !== 'generate') return;
  if (req.supersede !== false) queue.length = 0;
  queue.push({ req, ids: [...req.ids] });
  if (!running) {
    running = true;
    setTimeout(step, 0);
  }
};
