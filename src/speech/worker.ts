/** Owns Cactus Whistle off the main thread, the way engine/worker.ts owns Needle 3. */
import createNeedle from '../../vendor/needle3-c7c415a/needle.js';
import wasmUrl from '../../vendor/needle3-c7c415a/needle.wasm?url';
import { serveEngine } from '../runtime/engine-worker.ts';
import { WHISTLE } from '../runtime/models.ts';
import { createSpeechEngine, isSilent, toSteps, type WhistleResult } from './core.ts';
import { createTranscriptStream } from './stream.ts';
import type { Embedding, SpeechOptions, Transcript } from './whistle.ts';

const SILENCE: WhistleResult = { text: '', language: '', ttft_ms: 0, decode_tps: 0 };

serveEngine({
  model: WHISTLE,
  createModule: createNeedle,
  wasmUrl,
  create(module, cact) {
    const speech = createSpeechEngine(module, cact);
    return { speech, stream: createTranscriptStream(speech.transcribe) };
  },
  handlers: {
    transcribe({ speech }, { pcm, language, keywords }: { pcm: Float32Array } & SpeechOptions): Transcript {
      const result = isSilent(pcm)
        ? SILENCE
        : speech.transcribe(pcm, { language: language || null, keywords: keywords || null });
      return {
        text: result.text,
        language: result.language,
        words: result.words ?? [],
        steps: toSteps(result),
        ttftMs: result.ttft_ms,
        decodeTps: result.decode_tps,
      };
    },
    embed: ({ speech }, { pcm }: { pcm: Float32Array }): Embedding => speech.embed(pcm),
    stream({ stream }, { pcm, start }: { pcm: Float32Array; start?: SpeechOptions }) {
      if (start) stream.start({ language: start.language || null, keywords: start.keywords || null });
      return stream.process(pcm);
    },
    'stream-stop': ({ stream }) => stream.stop(),
  },
});
