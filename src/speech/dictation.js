/*
 * Client for the Whistle worker, loaded and reported the way engine/agent.js reports Needle 3.
 */
import { createWorkerClient } from '../shared/worker-client.js';

/** @param onStatus ({state: 'loading'|'ready'|'failed', text, fraction?}) => void */
export function createDictation({ onStatus }) {
  const client = createWorkerClient(new URL('./worker.js', import.meta.url), { name: 'Whistle', onStatus });

  return {
    /**
     * Transcribes one clip (its buffer is transferred), biased towards the words the app under
     * test actually uses. The language is named rather than detected: Acme Admin's steps, tools
     * and enums are English, and left to detect it a noisy clip comes back as a fluent sentence
     * in another one.
     */
    transcribe: (pcm, keywords, language = 'en') =>
      client.request({ type: 'transcribe', pcm, keywords, language }, [pcm.buffer]),
    get ready() {
      return client.ready;
    },
  };
}
