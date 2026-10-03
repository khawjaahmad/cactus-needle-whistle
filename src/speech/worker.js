/*
 * Owns Cactus Whistle off the main thread, the way engine/worker.js owns Needle 3. A separate
 * worker, so the two engines are separate Emscripten instances and neither sees the other's
 * global model (needle.h: one process-global model per kind), and so a 4 s transcription never
 * blocks a decode.
 *
 * Request: {type: 'transcribe', id, pcm, keywords, language}
 *          `pcm` is a transferred Float32Array of 16 kHz mono samples, `keywords` the app's live
 *          vocabulary.
 * Result:  {type: 'result', id, text, language, steps, ttftMs, decodeTps, ms}
 */
importScripts(
  '../../vendor/needle3-c7c415a/needle.js',
  '../runtime/models.js',
  '../runtime/wasm-heap.js',
  '../runtime/engine-worker.js',
  'core.js',
);

const SILENCE = { text: '', language: '', ttft_ms: 0, decode_tps: 0 };

EngineWorker.serveEngine({
  model: Models.WHISTLE,
  createModule: createNeedle,
  wasmUrl: '../../vendor/needle3-c7c415a/needle.wasm',
  create: WhistleCore.createSpeechEngine,
  requestType: 'transcribe',
  handle(engine, { pcm, language, keywords }) {
    const result = WhistleCore.isSilent(pcm)
      ? SILENCE
      : engine.transcribe(pcm, { language: language || null, keywords: keywords || null });
    return {
      text: result.text,
      language: result.language,
      steps: WhistleCore.toSteps(result),
      ttftMs: result.ttft_ms,
      decodeTps: result.decode_tps,
    };
  },
});
