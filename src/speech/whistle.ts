/** Client for the Whistle worker: transcription, embeddings and live streaming. */
import { createWorkerClient } from '../runtime/worker-client.ts';
import type { Reply } from '../runtime/protocol.ts';
import { SAMPLE_RATE, type TimedWord } from './core.ts';
import type { StreamUpdate } from './stream.ts';

/** What a transcription is biased and forced with. */
export interface SpeechOptions {
  language: string;
  /** Newline-separated words and phrases to favour. */
  keywords: string;
}

export type WhistleRequest =
  | ({ type: 'transcribe'; pcm: Float32Array } & SpeechOptions)
  | { type: 'embed'; pcm: Float32Array }
  /** `start` on a stream's first chunk resets the worker's stream with these options. */
  | { type: 'stream'; pcm: Float32Array; start?: SpeechOptions }
  | { type: 'stream-stop' };

export interface Transcript {
  text: string;
  language: string;
  /** Every word with its start, end and probability. */
  words: TimedWord[];
  /** The clip split into test steps at the speaker's pauses. */
  steps: string[];
  ttftMs: number;
  decodeTps: number;
}

export interface Embedding {
  /** `frames` rows of `dims` floats, one row per 80 ms of audio. */
  vector: Float32Array;
  frames: number;
  dims: number;
}

export interface LiveSession {
  /** Queues a chunk (its buffer is transferred: pass a copy, not a view of audio you keep). */
  push(chunk: Float32Array): void;
  /** Sends what is queued, then ends the stream; the last update arrives through onUpdate. */
  stop(): Promise<void>;
}

const MAX_BATCH_SAMPLES = 3 * SAMPLE_RATE;

export type Whistle = ReturnType<typeof createWhistle>;

export function createWhistle() {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'whistle' });
  const client = createWorkerClient<WhistleRequest, unknown>(worker, {
    name: 'Whistle',
    startingText: 'Starting Whistle',
  });

  /** Live transcription: each pass's committed words and pending tail go to `onUpdate`. */
  function live(options: SpeechOptions, onUpdate: (update: Reply<StreamUpdate>) => void): LiveSession {
    let queued: Float32Array[] = [];
    let first = true;
    let sending: Promise<void> | null = null;

    async function send() {
      while (queued.length) {
        let take = 1;
        let size = queued[0].length;
        while (take < queued.length && size + queued[take].length <= MAX_BATCH_SAMPLES) size += queued[take++].length;
        const pcm = concat(queued.slice(0, take));
        queued = queued.slice(take);
        const start = first ? options : undefined;
        first = false;
        onUpdate(await client.request<StreamUpdate>({ type: 'stream', pcm, start }, [pcm.buffer]));
      }
      sending = null;
    }

    return {
      push(chunk) {
        queued.push(chunk);
        sending ??= send();
      },
      async stop() {
        await sending;
        if (queued.length) await send();
        if (first) return;
        onUpdate(await client.request<StreamUpdate>({ type: 'stream-stop' }));
      },
    };
  }

  return {
    /** Transcribes one clip of at most 30 s; its buffer is transferred. */
    transcribe: (pcm: Float32Array, options: SpeechOptions) =>
      client.request<Transcript>({ type: 'transcribe', pcm, ...options }, [pcm.buffer]),
    /** The encoder output for one clip of at most 30 s, with no transcript decoded. */
    embed: (pcm: Float32Array) => client.request<Embedding>({ type: 'embed', pcm }, [pcm.buffer]),
    live,
    subscribe: client.subscribe,
    getStatus: client.getStatus,
  };
}

function concat(chunks: Float32Array[]) {
  if (chunks.length === 1) return chunks[0];
  const joined = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}
