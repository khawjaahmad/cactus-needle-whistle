/*
 * Client for the Needle 3 worker: loads the engine off the main thread and runs one turn against
 * whatever tools the caller binds (the Acme Admin environment's, for this studio).
 */
import { createWorkerClient } from '../shared/worker-client.js';

/** System facts, not instructions (§8): the model resolves "tomorrow" against `date:`. */
function facts(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${day}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `date: ${date} ${time}; locale: ${navigator.language}; device: desktop`;
}

/** @param onStatus ({state: 'loading'|'ready'|'failed', text, fraction?}) => void */
export function createAgent({ onStatus }) {
  const client = createWorkerClient(new URL('./worker.js', import.meta.url), { name: 'model', onStatus });

  return {
    /** Decodes and gates one turn with `tools` bound: {response, verdict, ms} or {type: 'error', message}. */
    ask: (text, tools) => client.request({ type: 'run', text, facts: facts(), tools }),
    get ready() {
      return client.ready;
    },
  };
}
