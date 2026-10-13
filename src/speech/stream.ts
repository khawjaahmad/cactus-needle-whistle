/** Live transcription with no limit on length, over a model that hears at most 30 s at a time. */
import { isSilent, SAMPLE_RATE, type TimedWord, type TranscribeOptions, type WhistleResult } from './core.ts';

const TRIM_SECONDS = 10;
const HARD_TRIM_SECONDS = 18;
const FORCE_COMMIT_SECONDS = 20;
const KEEP_PENDING_WORDS = 2;
const TIME_SLACK_SECONDS = 0.1;
const MAX_OVERLAP_WORDS = 5;
const DROP_SILENCE_SECONDS = 2;

export interface StreamUpdate {
  /** The words this chunk committed, with times from the start of the stream. */
  words: TimedWord[];
  /** The latest pass's unconfirmed tail. */
  pending: string;
  language: string;
  /** Seconds of audio received so far. */
  received: number;
}

type Transcribe = (pcm: Float32Array, options: TranscribeOptions) => Pick<WhistleResult, 'language' | 'words'>;

/** Words compared for agreement: case and punctuation aside, a pass may add a comma later. */
const normalise = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
const same = (a: TimedWord, b: TimedWord) => normalise(a.word) === normalise(b.word);
const endsSentence = (word: TimedWord) => /[.!?]["')]?$/.test(word.word);

export function createTranscriptStream(transcribe: Transcribe) {
  let window = new Float32Array(0);
  let windowStart = 0;
  let received = 0;
  let committed: TimedWord[] = [];
  let committedEnd = 0;
  let previous: TimedWord[] = [];
  let language: string | null = null;
  let options: TranscribeOptions = {};

  /** Moves the window's start to `seconds` (stream time), dropping the audio before it. */
  function trimTo(seconds: number) {
    const samples = Math.min(window.length, Math.max(0, Math.round((seconds - windowStart) * SAMPLE_RATE)));
    window = window.slice(samples);
    windowStart += samples / SAMPLE_RATE;
    committed = committed.filter((w) => w.end > windowStart);
  }

  /** One pass over the window: the words it heard after the committed ones, in stream time. */
  function pass() {
    const result = transcribe(window, { ...options, language: options.language || language, wordTimestamps: true });
    if (result.language) language ??= result.language;

    const fresh = (result.words ?? [])
      .map((w) => ({ ...w, start: w.start + windowStart, end: w.end + windowStart }))
      .filter((w) => w.start >= committedEnd - TIME_SLACK_SECONDS);
    for (let n = Math.min(MAX_OVERLAP_WORDS, committed.length, fresh.length); n > 0; n -= 1) {
      const tail = committed.slice(-n);
      if (tail.every((w, i) => same(w, fresh[i]))) return fresh.slice(n);
    }
    return fresh;
  }

  function commit(words: TimedWord[]) {
    if (!words.length) return;
    committed = [...committed, ...words];
    committedEnd = words[words.length - 1].end;
  }

  function trim() {
    const seconds = window.length / SAMPLE_RATE;
    if (seconds < TRIM_SECONDS) return;
    const sentenceEnd = committed.findLast(endsSentence);
    if (sentenceEnd) trimTo(sentenceEnd.end);
    else if (seconds >= HARD_TRIM_SECONDS) trimTo(committedEnd);
  }

  const update = (words: TimedWord[], pendingWords: TimedWord[]): StreamUpdate => ({
    words,
    pending: pendingWords.map((w) => w.word).join(' '),
    language: language ?? '',
    received,
  });

  /** Starts a new stream; the options hold until it stops. */
  function start(next: TranscribeOptions = {}) {
    window = new Float32Array(0);
    windowStart = received = committedEnd = 0;
    committed = previous = [];
    language = null;
    options = next;
  }

  return {
    start,

    /** Adds a chunk and returns what it committed. */
    process(chunk: Float32Array): StreamUpdate {
      const grown = new Float32Array(window.length + chunk.length);
      grown.set(window);
      grown.set(chunk, window.length);
      window = grown;
      received += chunk.length / SAMPLE_RATE;

      if (isSilent(window)) {
        if (window.length >= DROP_SILENCE_SECONDS * SAMPLE_RATE) trimTo(received);
        previous = [];
        return update([], []);
      }

      const current = pass();
      let agreed = 0;
      while (agreed < previous.length && agreed < current.length && same(previous[agreed], current[agreed]))
        agreed += 1;
      if (window.length >= FORCE_COMMIT_SECONDS * SAMPLE_RATE) {
        agreed = Math.max(agreed, current.length - KEEP_PENDING_WORDS);
      }

      const words = current.slice(0, agreed);
      commit(words);
      previous = current.slice(agreed);
      trim();
      return update(words, previous);
    },

    /** Ends the stream: the window is transcribed once more and the rest committed whole. */
    stop(): StreamUpdate {
      const words = window.length && !isSilent(window) ? pass() : [];
      const last = update(words, []);
      start();
      return last;
    },
  };
}

export type TranscriptStream = ReturnType<typeof createTranscriptStream>;
