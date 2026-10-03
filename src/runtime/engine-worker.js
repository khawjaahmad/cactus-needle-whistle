/*
 * The worker side of an engine: boots one Emscripten build against one pinned archive, then
 * serves requests one at a time. Both engines are a single global, non-thread-safe instance
 * (needle.h), and a worker handles one message at a time, so every call is serialised here.
 *
 * Protocol (shared/worker-client.js is the other end):
 *   in:  {type: <requestType>, id, ...}
 *   out: {type: 'progress', loaded, total} · {type: 'ready', loadMs, cached}
 *        {type: 'result', id, ...handle(), ms} · {type: 'error', id?, message}
 *
 * A classic worker script, loaded with importScripts().
 */
(function (root) {
  'use strict';

  const post = (message) => root.postMessage(message);

  /**
   * Both vendored builds call their binary needle.wasm and resolve it against the worker's
   * directory, not the script they came from, and they ignore Module.locateFile. Left alone, one
   * would instantiate the other's binary: the exports line up by position, so nothing throws at
   * load, but needle_last_error binds to a function that wants an i64 and malloc returns the same
   * pointer every call. Handing over the bytes skips the lookup.
   */
  async function instantiate(createModule, wasmUrl) {
    const response = await fetch(new URL(wasmUrl, root.location.href));
    if (!response.ok) throw new Error(`Could not load the engine (HTTP ${response.status}).`);
    return createModule({ wasmBinary: await response.arrayBuffer() });
  }

  /** Downloads a pinned archive once, verifies it, and keeps it in the Cache API for later visits. */
  async function fetchWeights(model) {
    const cache = root.caches ? await root.caches.open(model.cacheName).catch(() => null) : null;
    const hit = cache && (await cache.match(model.url));
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer());
      if (bytes.length === model.bytes) return { bytes, cached: true };
      await cache.delete(model.url);
    }

    const response = await fetch(model.url);
    if (!response.ok) throw new Error(`Could not download ${model.name} (HTTP ${response.status}).`);
    const bytes = new Uint8Array(model.bytes);
    const reader = response.body.getReader();
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (loaded + value.length > model.bytes)
        throw new Error(`The download of ${model.name} is larger than expected.`);
      bytes.set(value, loaded);
      loaded += value.length;
      post({ type: 'progress', loaded, total: model.bytes });
    }
    if (loaded !== model.bytes) throw new Error(`The download of ${model.name} was cut short. Reload to retry.`);
    if (root.crypto?.subtle && (await sha256(bytes)) !== model.sha256) {
      throw new Error(`The download of ${model.name} failed its checksum.`);
    }
    await cache?.put(model.url, new Response(bytes)).catch(() => {});
    return { bytes, cached: false };
  }

  async function sha256(bytes) {
    const digest = new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * @param model        a pin from runtime/models.js
   * @param createModule the build's Emscripten factory (createNeedle)
   * @param wasmUrl      the build's binary, relative to the worker
   * @param create       (module, archiveBytes) => engine
   * @param requestType  the message type this worker answers
   * @param handle       (engine, message) => result fields, run synchronously on the engine
   */
  function serveEngine({ model, createModule, wasmUrl, create, requestType, handle }) {
    let engine;

    const ready = (async () => {
      const started = performance.now();
      const [module, weights] = await Promise.all([instantiate(createModule, wasmUrl), fetchWeights(model)]);
      engine = create(module, weights.bytes);
      post({ type: 'ready', loadMs: performance.now() - started, cached: weights.cached });
    })().catch((error) => {
      post({ type: 'error', message: error.message });
      throw error;
    });

    root.onmessage = async ({ data }) => {
      try {
        await ready;
        if (data.type !== requestType) return;
        const started = performance.now();
        const result = handle(engine, data);
        post({ type: 'result', id: data.id, ...result, ms: performance.now() - started });
      } catch (error) {
        post({ type: 'error', id: data.id, message: error.message });
      }
    };
  }

  root.EngineWorker = { serveEngine };
})(self);
