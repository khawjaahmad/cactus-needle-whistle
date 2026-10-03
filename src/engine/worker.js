/*
 * Owns the Needle 3 engine off the main thread (runtime/engine-worker.js has the protocol).
 *
 * Request: {type: 'run', id, text, facts, tools}
 *          `tools` is the page's current catalog: [{risk, ...schema}], enums filled from what is
 *          on the page right now.
 * Result:  {type: 'result', id, response, verdict, ms}
 */
importScripts(
  '../../vendor/needle3-b274efc/needle.js',
  '../runtime/models.js',
  '../runtime/wasm-heap.js',
  '../runtime/engine-worker.js',
  'core.js',
);

EngineWorker.serveEngine({
  model: Models.NEEDLE3,
  createModule: createNeedle,
  wasmUrl: '../../vendor/needle3-b274efc/needle.wasm',
  create: NeedleCore.createEngine,
  requestType: 'run',
  handle: (engine, { text, facts, tools }) => NeedleCore.runTurn(engine, text, facts, NeedleCore.loadCatalog(tools)),
});
