/*
 * Owns Cactus Whistle off the main thread, the way engine/worker.ts owns Needle 3. A separate
 * worker, so the two engines are separate Emscripten instances and neither sees the other's
 * global model (needle.h: one process-global model per kind), and so a 4 s transcription never
 * blocks a decode.
 *
 * Request: TranscribeRequest. `pcm` is a transferred Float32Array of 16 kHz mono samples,
 *          `keywords` the app's live vocabulary.
 * Result:  Transcript, plus `ms`.
 */
import createNeedle from '../../vendor/needle3-c7c415a/needle.js';
import wasmUrl from '../../vendor/needle3-c7c415a/needle.wasm?url';
import { serveEngine } from '../runtime/engine-worker.ts';
import { WHISTLE } from '../runtime/models.ts';
import { createSpeechEngine, isSilent, toSteps, type WhistleResult } from './core.ts';
import type { TranscribeRequest, Transcript } from './dictation.ts';

const SILENCE: WhistleResult = { text: '', language: '', ttft_ms: 0, decode_tps: 0 };

serveEngine({
  model: WHISTLE,
  createModule: createNeedle,
  wasmUrl,
  create: createSpeechEngine,
  requestType: 'transcribe',
  handle(engine, { pcm, language, keywords }: TranscribeRequest): Transcript {
    const result = isSilent(pcm)
      ? SILENCE
      : engine.transcribe(pcm, { language: language || null, keywords: keywords || null });
    return {
      text: result.text,
      language: result.language,
      steps: toSteps(result),
      ttftMs: result.ttft_ms,
      decodeTps: result.decode_tps,
    };
  },
});
