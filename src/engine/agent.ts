/*
 * Client for the Needle 3 worker: loads the engine off the main thread and runs one turn against
 * whatever tools the caller binds (the Acme Admin environment's, for this studio).
 */
import { createWorkerClient } from '../runtime/worker-client.ts';
import type { RunRequest, ToolEntry, Turn } from './types.ts';

/** System facts, not instructions (§8): the model resolves "tomorrow" against `date:`. */
function facts(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${day}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `date: ${date} ${time}; locale: ${navigator.language}; device: desktop`;
}

export type Agent = ReturnType<typeof createAgent>;

export function createAgent() {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'needle3' });
  const client = createWorkerClient<RunRequest, Turn>(worker, { name: 'model', startingText: 'Starting engine' });

  return {
    /** Decodes and gates one turn with `tools` bound. */
    ask: (text: string, tools: ToolEntry[]) => client.request({ type: 'run', text, facts: facts(), tools }),
    subscribe: client.subscribe,
    getStatus: client.getStatus,
  };
}
