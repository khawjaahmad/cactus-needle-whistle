/** Cactus Whistle: the speech engine binding, and the split from one dictation into test steps. */
import type { WhistleModule } from '../runtime/emscripten.ts';
import { createHeap } from '../runtime/wasm-heap.ts';

const OUT_CAPACITY = 1 << 16;
export const SAMPLE_RATE = 16000;
export const MAX_SECONDS = 30;
/** The languages Whistle transcribes; anything else is detected as one of these. */
export const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl'] as const;
export const EMBEDDING_FRAME_SECONDS = 0.08;

const STEP_PAUSE_SECONDS = 0.65;

const SILENCE_RMS = 0.01;

export interface TimedWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

/** What needle_transcribe returns. */
export interface WhistleResult {
  text: string;
  language: string;
  ttft_ms: number;
  decode_tps: number;
  words?: TimedWord[];
}

export interface TranscribeOptions {
  language?: string | null;
  /** Newline-separated names the app actually uses, so they survive the search. */
  keywords?: string | null;
  wordTimestamps?: boolean;
}

/** Wraps an instantiated Emscripten module around a loaded whistle.cact. */
export function createSpeechEngine(M: WhistleModule, cact: Uint8Array) {
  const heap = createHeap(M);
  const lastError = () => heap.readString(M._needle_last_error()) || 'no reason given';

  const loaded = heap.withBytes(cact, (ptr, length) => M._needle_load(ptr, BigInt(length)));
  if (loaded !== 0) throw new Error(`The engine rejected whistle.cact: ${lastError()}`);

  const out = M._malloc(OUT_CAPACITY);

  /** 16 kHz mono float PCM in [-1, 1] to its transcript, with word timings. */
  function transcribe(
    pcm: Float32Array,
    { language = null, keywords = null, wordTimestamps = true }: TranscribeOptions = {},
  ): WhistleResult {
    if (pcm.length > SAMPLE_RATE * MAX_SECONDS) {
      throw new Error(`Whistle transcribes at most ${MAX_SECONDS} s in one pass.`);
    }
    const samples = M._malloc(pcm.length * 4);
    try {
      new Float32Array(M.HEAPU8.buffer, samples, pcm.length).set(pcm);
      M.HEAPU8.fill(0, out, out + OUT_CAPACITY);
      const tokens = heap.withStrings([language, keywords], (lang, keys) =>
        M._needle_transcribe(samples, pcm.length, lang, keys, wordTimestamps ? 1 : 0, out, OUT_CAPACITY - 1),
      );
      if (tokens < 0) throw new Error(`Whistle could not transcribe this clip: ${lastError()}`);
      return JSON.parse(heap.readString(out));
    } finally {
      M._free(samples);
    }
  }

  /** The encoder output for a clip, one row per 80 ms frame, flattened; no transcript decoded. */
  function embed(pcm: Float32Array) {
    if (pcm.length > SAMPLE_RATE * MAX_SECONDS) {
      throw new Error(`Whistle embeds at most ${MAX_SECONDS} s in one pass.`);
    }
    const samples = M._malloc(pcm.length * 4);
    try {
      new Float32Array(M.HEAPU8.buffer, samples, pcm.length).set(pcm);
      const size = M._needle_embed(0, samples, pcm.length, 0, 0);
      if (size <= 0) throw new Error(`Whistle could not embed this clip: ${lastError()}`);
      const vector = M._malloc(size * 4);
      try {
        if (M._needle_embed(0, samples, pcm.length, vector, size) !== size) {
          throw new Error(`Whistle could not embed this clip: ${lastError()}`);
        }
        const frames = Math.ceil(pcm.length / (SAMPLE_RATE * EMBEDDING_FRAME_SECONDS));
        return { vector: new Float32Array(M.HEAPU8.buffer, vector, size).slice(), frames, dims: size / frames };
      } finally {
        M._free(vector);
      }
    } finally {
      M._free(samples);
    }
  }

  return { transcribe, embed };
}

export type SpeechEngine = ReturnType<typeof createSpeechEngine>;

/** True when a clip carries nothing but room tone, which the model would rather invent over. */
export function isSilent(pcm: Float32Array) {
  let energy = 0;
  for (let i = 0; i < pcm.length; i += 1) energy += pcm[i] * pcm[i];
  return !pcm.length || Math.sqrt(energy / pcm.length) < SILENCE_RMS;
}

/** One dictation to the lines of a test case. */
export function toSteps(result: Pick<WhistleResult, 'text' | 'words'>): string[] {
  const words = result.words ?? [];
  if (!words.length) return result.text ? [sentenceCase(result.text)] : [];

  const steps: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) steps.push(current);
    current = [];
  };

  words.forEach((word, i) => {
    const previous = words[i - 1];
    if (previous && word.start - previous.end >= STEP_PAUSE_SECONDS) flush();
    current.push(word.word);
    if (/[.!?]["')]?$/.test(word.word)) flush();
  });
  flush();

  return steps.map((parts) => sentenceCase(parts.join(' '))).filter(Boolean);
}

/** A step reads like a written one: no trailing full stop, a capital at the front. */
function sentenceCase(text: string) {
  const trimmed = text
    .trim()
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/[.]+$/, '')
    .trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : '';
}
