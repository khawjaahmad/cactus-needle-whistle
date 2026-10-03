/*
 * Client for the Whistle worker, loaded and reported the way engine/agent.ts reports Needle 3.
 */
import { createWorkerClient } from '../runtime/worker-client.ts';

export interface TranscribeRequest {
  type: 'transcribe';
  pcm: Float32Array;
  keywords: string;
  language: string;
}

export interface Transcript {
  text: string;
  language: string;
  /** The clip split into test steps at the tester's pauses. */
  steps: string[];
  ttftMs: number;
  decodeTps: number;
}

export type Dictation = ReturnType<typeof createDictation>;

export function createDictation() {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'whistle' });
  const client = createWorkerClient<TranscribeRequest, Transcript>(worker, {
    name: 'Whistle',
    startingText: 'Starting Whistle',
  });

  return {
    /**
     * Transcribes one clip (its buffer is transferred), biased towards the words the app under
     * test actually uses. The language is named rather than detected: Acme Admin's steps, tools
     * and enums are English, and left to detect it a noisy clip comes back as a fluent sentence
     * in another one.
     */
    transcribe: (pcm: Float32Array, keywords: string, language = 'en') =>
      client.request({ type: 'transcribe', pcm, keywords, language }, [pcm.buffer]),
    subscribe: client.subscribe,
    getStatus: client.getStatus,
  };
}
