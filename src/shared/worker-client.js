/*
 * The page side of an engine worker (runtime/engine-worker.js): reports loading progress and
 * readiness, and turns each request into a promise of its result or error message.
 */

const megabytes = (n) => (n / 1e6).toFixed(1);

/**
 * @param url       the worker script
 * @param name      what the status line calls the engine, e.g. 'model' or 'Whistle'
 * @param onStatus  ({state: 'loading'|'ready'|'failed', text, fraction?}) => void
 * @returns {request(message, transfer?) => Promise<result|{type: 'error', message}>, ready}
 */
export function createWorkerClient(url, { name, onStatus }) {
  const worker = new Worker(url);
  const pending = new Map();
  let nextId = 1;
  let ready = false;

  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      onStatus({
        state: 'loading',
        text: `Downloading ${name} ${megabytes(data.loaded)} / ${megabytes(data.total)} MB`,
        fraction: data.loaded / data.total,
      });
    } else if (data.type === 'ready') {
      ready = true;
      const seconds = (data.loadMs / 1000).toFixed(1);
      onStatus({ state: 'ready', text: `${capitalize(name)} ready · ${seconds} s${data.cached ? ' from cache' : ''}` });
    } else if (pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    } else if (data.type === 'error') {
      onStatus({ state: 'failed', text: data.message });
    }
  };
  worker.onerror = (event) => {
    onStatus({ state: 'failed', text: event.message || `The ${name} worker failed to start.` });
  };

  function request(message, transfer = []) {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker.postMessage({ ...message, id }, transfer);
    });
  }

  return {
    request,
    get ready() {
      return ready;
    },
  };
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
