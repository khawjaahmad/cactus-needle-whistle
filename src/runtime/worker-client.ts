/*
 * The page side of an engine worker (engine-worker.ts): tracks its loading status for whoever
 * subscribes (React reads it with useSyncExternalStore), and turns each request into a promise of
 * its result or error.
 */
import type { EngineStatus, Reply, WorkerEvent } from './protocol.ts';

const megabytes = (n: number) => (n / 1e6).toFixed(1);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface WorkerClient<Request, Result> {
  request(message: Request, transfer?: Transferable[]): Promise<Reply<Result>>;
  subscribe(listener: () => void): () => void;
  getStatus(): EngineStatus;
}

/**
 * @param worker  the engine's worker, constructed by the caller so Vite can find and bundle it
 * @param name    what the status line calls the engine, e.g. 'model' or 'Whistle'
 */
export function createWorkerClient<Request extends { type: string }, Result>(
  worker: Worker,
  { name, startingText }: { name: string; startingText: string },
): WorkerClient<Request, Result> {
  const pending = new Map<number, (reply: Reply<Result>) => void>();
  const listeners = new Set<() => void>();
  let status: EngineStatus = { state: 'loading', text: startingText };
  let nextId = 1;

  const setStatus = (next: EngineStatus) => {
    status = next;
    listeners.forEach((listener) => listener());
  };

  worker.onmessage = ({ data }: MessageEvent<WorkerEvent>) => {
    if (data.type === 'progress') {
      setStatus({
        state: 'loading',
        text: `Downloading ${name} ${megabytes(data.loaded)} / ${megabytes(data.total)} MB`,
        fraction: data.loaded / data.total,
      });
    } else if (data.type === 'ready') {
      const seconds = (data.loadMs / 1000).toFixed(1);
      setStatus({
        state: 'ready',
        text: `${capitalize(name)} ready · ${seconds} s${data.cached ? ' from cache' : ''}`,
      });
    } else if (data.id != null && pending.has(data.id)) {
      pending.get(data.id)?.(data as Reply<Result>);
      pending.delete(data.id);
    } else if (data.type === 'error') {
      setStatus({ state: 'failed', text: data.message });
    }
  };
  worker.onerror = (event) => {
    setStatus({ state: 'failed', text: event.message || `The ${name} worker failed to start.` });
  };

  return {
    request(message, transfer = []) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage({ ...message, id }, transfer);
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus: () => status,
  };
}
