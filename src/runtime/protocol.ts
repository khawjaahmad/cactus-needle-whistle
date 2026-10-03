/**
 * The message protocol between a page and an engine worker (engine-worker.ts serves it,
 * worker-client.ts calls it):
 *   in:  {type: <requestType>, id, ...}
 *   out: {type: 'progress', loaded, total} · {type: 'ready', loadMs, cached}
 *        {type: 'result', id, ...handle(), ms} · {type: 'error', id?, message}
 */

export type WorkerError = { type: 'error'; id?: number; message: string };
export type WorkerResult<T> = T & { type: 'result'; id: number; ms: number };

export type WorkerEvent =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; loadMs: number; cached: boolean }
  | WorkerResult<object>
  | WorkerError;

/** What a request resolves to: the handler's result, or the error it threw. */
export type Reply<T> = WorkerResult<T> | WorkerError;

export interface EngineStatus {
  state: 'loading' | 'ready' | 'failed';
  text: string;
  /** Download progress, 0..1, while loading. */
  fraction?: number;
}
