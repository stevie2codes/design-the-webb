/**
 * Generator worker messages (SPEC §9.9). Types only.
 *
 * main → worker: `generate` for a list of ids at one tier / viewport.
 * worker → main: one `state` per id (buffers transferred), `missing` for ids
 * without a generator yet, `error` on a throw, then `done`.
 */
import type { LayoutMode } from '../layout.ts';
import type { StateId } from '../states/ids.ts';
import type { AnchorSize, GenViewport, TierDims } from '../states/common.ts';

export interface GenerateRequest {
  readonly type: 'generate';
  /** Job id: replies carry it; the engine drops replies of superseded jobs. */
  readonly job: number;
  /** In order of priority (§9.9: S0 first, then S2–S9). */
  readonly ids: readonly StateId[];
  readonly tier: TierDims;
  readonly view: GenViewport;
  readonly layout: LayoutMode;
  readonly short: boolean;
  /** Anchor box sizes in px (layout.ts, refined by measured anchors). */
  readonly anchors: Partial<Record<StateId, AnchorSize>>;
}

export type WorkerRequest = GenerateRequest;

export type WorkerReply =
  | {
      readonly type: 'state';
      readonly job: number;
      readonly id: StateId;
      readonly pos: Float32Array;
      readonly meta: Uint8Array;
      readonly extras?: Record<string, number[]>;
      readonly ms: number;
    }
  | { readonly type: 'missing'; readonly job: number; readonly id: StateId }
  | { readonly type: 'error'; readonly job: number; readonly id: StateId; readonly message: string }
  | { readonly type: 'done'; readonly job: number };
