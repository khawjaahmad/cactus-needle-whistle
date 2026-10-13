/** The worker side of an engine: boots one build and archive, then serves requests one at a time. */
import type { CreateModule } from './emscripten.ts';
import type { ModelPin } from './models.ts';
import type { WorkerEvent } from './protocol.ts';

const scope = self as unknown as {
  postMessage(message: WorkerEvent): void;
  onmessage: ((event: MessageEvent) => void) | null;
  location: { href: string };
};
const post = (message: WorkerEvent) => scope.postMessage(message);
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Hands each build its own needle.wasm bytes, since both would otherwise load the same file. */
async function instantiate<M>(createModule: CreateModule<M>, wasmUrl: string) {
  const response = await fetch(new URL(wasmUrl, scope.location.href));
  if (!response.ok) throw new Error(`Could not load the engine (HTTP ${response.status}).`);
  return createModule({ wasmBinary: await response.arrayBuffer() });
}

/** Downloads a pinned archive once, verifies it, and keeps it in the Cache API for later visits. */
async function fetchWeights(model: ModelPin) {
  const cache = self.caches ? await caches.open(model.cacheName).catch(() => null) : null;
  const hit = await cache?.match(model.url);
  if (cache && hit) {
    const bytes = new Uint8Array(await hit.arrayBuffer());
    if (bytes.length === model.bytes) return { bytes, cached: true };
    await cache.delete(model.url);
  }

  const response = await fetch(model.url);
  if (!response.ok || !response.body) throw new Error(`Could not download ${model.name} (HTTP ${response.status}).`);
  const bytes = new Uint8Array(model.bytes);
  const reader = response.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (loaded + value.length > model.bytes) throw new Error(`The download of ${model.name} is larger than expected.`);
    bytes.set(value, loaded);
    loaded += value.length;
    post({ type: 'progress', loaded, total: model.bytes });
  }
  if (loaded !== model.bytes) throw new Error(`The download of ${model.name} was cut short. Reload to retry.`);
  if (self.crypto?.subtle && (await sha256(bytes)) !== model.sha256) {
    throw new Error(`The download of ${model.name} failed its checksum.`);
  }
  await cache?.put(model.url, new Response(bytes)).catch(() => {});
  return { bytes, cached: false };
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface ServeOptions<M, Engine> {
  model: ModelPin;
  /** The build's Emscripten factory. */
  createModule: CreateModule<M>;
  /** The build's needle.wasm, as Vite serves it. */
  wasmUrl: string;
  create: (module: M, archive: Uint8Array) => Engine;
  /** One handler per message type this worker answers. */
  handlers: Record<string, (engine: Engine, request: never) => object>;
}

export function serveEngine<M, Engine>({ model, createModule, wasmUrl, create, handlers }: ServeOptions<M, Engine>) {
  let engine: Engine;

  const ready = (async () => {
    const started = performance.now();
    const [module, weights] = await Promise.all([instantiate(createModule, wasmUrl), fetchWeights(model)]);
    engine = create(module, weights.bytes);
    post({ type: 'ready', loadMs: performance.now() - started, cached: weights.cached });
  })().catch((error: unknown) => {
    post({ type: 'error', message: errorMessage(error) });
    throw error;
  });

  scope.onmessage = async ({ data }) => {
    try {
      await ready;
      const handle = handlers[data.type];
      if (!handle) throw new Error(`This worker does not answer "${data.type}".`);
      const started = performance.now();
      const result = handle(engine, data as never);
      post({ type: 'result', id: data.id, ...result, ms: performance.now() - started });
    } catch (error) {
      post({ type: 'error', id: data.id, message: errorMessage(error) });
    }
  };
}
