/** Owns the Needle 3 engine off the main thread (runtime/engine-worker.ts has the protocol). */
import createNeedle from '../../vendor/needle3-b274efc/needle.js';
import wasmUrl from '../../vendor/needle3-b274efc/needle.wasm?url';
import { serveEngine } from '../runtime/engine-worker.ts';
import { NEEDLE3 } from '../runtime/models.ts';
import { createEngine, loadCatalog, runTurn } from './core.ts';
import type { RunRequest } from './types.ts';

serveEngine({
  model: NEEDLE3,
  createModule: createNeedle,
  wasmUrl,
  create: createEngine,
  handlers: {
    run: (engine, { text, facts, tools }: RunRequest) => runTurn(engine, text, facts, loadCatalog(tools)),
  },
});
