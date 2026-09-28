/**
 * Main-thread side of generation (SPEC §9.9): posts jobs to the generator
 * worker and hands each returned state to the engine. Without Worker support
 * (or if the worker fails to load) the same generators run on the main
 * thread, one state per idle callback.
 */
import type { StateId } from './states/ids.ts';
import type { GenerateRequest, WorkerReply } from './worker/protocol.ts';

export type GenJob = Omit<GenerateRequest, 'type' | 'job'>;

export interface GenCallbacks {
  onState(job: number, id: StateId, pos: Float32Array, meta: Uint8Array, extras?: Record<string, number[]>, ms?: number): void;
  /** No generator yet (a later phase) — the film ceiling stops below it. */
  onMissing(job: number, id: StateId): void;
  onError(job: number, id: StateId, message: string): void;
  onDone(job: number): void;
}

type Idle = (cb: () => void) => void;
const idle: Idle = (cb) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 200 });
  else setTimeout(cb, 16);
};

export class GeneratorClient {
  private worker: Worker | null = null;
  private workerFailed = false;
  private seq = 0;
  private latest = -1;
  private pending: GenerateRequest | null = null;
  private disposed = false;
  private readonly cb: GenCallbacks;

  constructor(cb: GenCallbacks) {
    this.cb = cb;
    if (typeof Worker === 'undefined') {
      this.workerFailed = true;
      return;
    }
    try {
      this.worker = new Worker(new URL('./worker/generate.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerReply>) => this.receive(e.data);
      this.worker.onerror = (e) => {
        // The worker script failed (CSP, load error): finish on the main thread.
        e.preventDefault?.();
        this.failWorker();
      };
    } catch {
      this.failWorker();
    }
  }

  /** Start a job; a newer job supersedes the rest of older ones. Returns its id. */
  start(job: GenJob): number {
    const req: GenerateRequest = { type: 'generate', job: ++this.seq, ...job };
    this.latest = req.job;
    this.pending = req;
    if (this.worker && !this.workerFailed) this.worker.postMessage(req);
    else void this.runOnMain(req);
    return req.job;
  }

  dispose(): void {
    this.disposed = true;
    this.latest = -1;
    this.worker?.terminate();
    this.worker = null;
  }

  private failWorker(): void {
    if (this.workerFailed) return;
    this.workerFailed = true;
    this.worker?.terminate();
    this.worker = null;
    if (this.pending && this.pending.job === this.latest) void this.runOnMain(this.pending);
  }

  private receive(r: WorkerReply): void {
    if (this.disposed || r.job !== this.latest) return;
    switch (r.type) {
      case 'state':
        this.cb.onState(r.job, r.id, r.pos, r.meta, r.extras, r.ms);
        break;
      case 'missing':
        this.cb.onMissing(r.job, r.id);
        break;
      case 'error':
        this.cb.onError(r.job, r.id, r.message);
        break;
      case 'done':
        this.pending = null;
        this.cb.onDone(r.job);
        break;
    }
  }

  private async runOnMain(req: GenerateRequest): Promise<void> {
    const { runOne } = await import('./worker/run.ts');
    const ids = [...req.ids];
    const step = () => {
      if (this.disposed || req.job !== this.latest) return;
      const id = ids.shift();
      if (id === undefined) {
        this.receive({ type: 'done', job: req.job });
        return;
      }
      this.receive(runOne(req, id));
      idle(step);
    };
    idle(step);
  }
}
