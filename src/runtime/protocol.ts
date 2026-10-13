/** Messages between a page and an engine worker. */

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
