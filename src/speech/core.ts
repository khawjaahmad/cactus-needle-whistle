/*
 * Cactus Whistle: the speech engine binding, and the split from one dictation into test steps.
 *
 * Whistle is a second engine, not an upgrade of the first. Its build (vendor/needle3-c7c415a) is
 * the one that exports needle_transcribe; the studio's tool decoding stays on the pinned b274efc
 * build. That engine reports much lower confidence on the frozen suite (24/32 at 0.5 against
 * 32/32 pinned, a correct check_message at 0.01), and the studio's gate is built on calibrated
 * confidence, so the two engines are kept apart: one Emscripten instance per worker, each with its
 * own "process-global" model (needle.h).
 */
import type { WhistleModule } from '../runtime/emscripten.ts';
import { createHeap } from '../runtime/wasm-heap.ts';

const OUT_CAPACITY = 1 << 16;
// Keep in step with recorder.ts, which captures for these bounds.
export const SAMPLE_RATE = 16000;
export const MAX_SECONDS = 30; // needle_transcribe takes at most 30 s in one pass.

// A pause this long between words reads as the end of a test step. Dictating a case, people
// stop noticeably longer between steps than inside one; measured against `say` output and
// read-aloud cases, within-step gaps sit under 0.3 s.
const STEP_PAUSE_SECONDS = 0.65;

// Digital silence comes back empty, but room tone does not: four seconds of an idle office mic
// decoded as a confident Spanish sentence. Measured, that clip was -54 dBFS against -16 for
// speech, so -40 rejects the room with two orders of magnitude of headroom either side.
const SILENCE_RMS = 0.01;

export interface TimedWord {
  word: string;
  start: number;
  end: number;
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

  // The engine copies the archive during load.
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
      // A fresh view: HEAPU8.buffer is replaced whenever the heap grows.
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

  return { transcribe };
}

export type SpeechEngine = ReturnType<typeof createSpeechEngine>;

/** True when a clip carries nothing but room tone, which the model would rather invent over. */
export function isSilent(pcm: Float32Array) {
  let energy = 0;
  for (let i = 0; i < pcm.length; i += 1) energy += pcm[i] * pcm[i];
  return !pcm.length || Math.sqrt(energy / pcm.length) < SILENCE_RMS;
}

/**
 * One dictation to the lines of a test case. Whistle times every word, so the pauses the
 * tester already leaves between steps are the split; sentence-final punctuation splits too,
 * for a tester who reads a written case aloud without pausing.
 */
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
    // A long gap ends the step before it, so this word opens the next one.
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
