/** The Whistle tab: Whistle on its own, apart from the test cases. */
import { useRef, useState } from 'react';
import type { EngineStatus, Reply } from '../../runtime/protocol.ts';
import { decodeAudioFile } from '../../speech/audio-file.ts';
import { MAX_SECONDS, SAMPLE_RATE, type TimedWord } from '../../speech/core.ts';
import { meanPool } from '../../speech/embedding.ts';
import { record } from '../../speech/recorder.ts';
import type { StreamUpdate } from '../../speech/stream.ts';
import type { LiveSession, SpeechOptions, Whistle } from '../../speech/whistle.ts';
import { useEngineStatus } from './useEngineStatus.ts';

const MIN_CLIP_SECONDS = 0.4;
const METER_INTERVAL_MS = 80;
const FILE_CHUNK_SECONDS = 1;

export type Mode = 'idle' | 'recording' | 'live' | 'working';

export interface Clip {
  label: string;
  seconds: number;
  /** 16 kHz mono, for playback and embedding; null while a live stream is still running. */
  pcm: Float32Array | null;
  words: TimedWord[];
  /** A live stream's unconfirmed tail. */
  pending: string;
  language: string;
  /** How the transcript was made, for the meta line. */
  stats: string;
}

export interface EmbeddedClip {
  id: number;
  label: string;
  frames: number;
  dims: number;
  pooled: Float32Array;
}

type Note = { state?: EngineStatus['state']; text: string };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const label = (words: TimedWord[], fallback: string) => {
  const text = words.map((w) => w.word).join(' ');
  return text ? (text.length > 48 ? `${text.slice(0, 47)}…` : text) : fallback;
};

export function useWhistleLab(whistle: Whistle) {
  const engine = useEngineStatus(whistle);
  const [options, setOptions] = useState<SpeechOptions>({ language: '', keywords: '' });
  const [mode, setMode] = useState<Mode>('idle');
  const [clip, setClip] = useState<Clip | null>(null);
  const [embedded, setEmbedded] = useState<EmbeddedClip[]>([]);
  const [peak, setPeak] = useState<number | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const nextId = useRef(1);

  const fail = (text: string) => setNote({ state: 'failed', text });
  const meter = () => {
    let last = 0;
    return (level: number) => {
      if (performance.now() - last < METER_INTERVAL_MS) return;
      last = performance.now();
      setPeak(level);
    };
  };

  /** One pass over a clip of at most 30 s. */
  async function transcribeClip(pcm: Float32Array, name: string) {
    const seconds = pcm.length / SAMPLE_RATE;
    setNote({ text: 'Transcribing' });
    const result = await whistle.transcribe(pcm.slice(), options);
    if (result.type === 'error') return fail(result.message);
    setClip({
      label: label(result.words, name),
      seconds,
      pcm,
      words: result.words,
      pending: '',
      language: result.language,
      stats:
        `one pass · ${Math.round(result.ms)} ms · ` +
        `ttft ${Math.round(result.ttftMs)} ms · ${Math.round(result.decodeTps)} tok/s`,
    });
    setNote({ text: result.words.length ? 'Done' : 'Nothing heard' });
  }

  /** A stream over live audio or a long file: words land as two passes agree on them. */
  function openStream(name: string) {
    const started = performance.now();
    let passes = 0;
    let slowest = 0;
    setClip({ label: name, seconds: 0, pcm: null, words: [], pending: '', language: '', stats: '' });
    const session: LiveSession = whistle.live(options, (update: Reply<StreamUpdate>) => {
      if (update.type === 'error') return fail(update.message);
      passes += 1;
      slowest = Math.max(slowest, update.ms);
      setClip((current) => {
        const words = [...(current?.words ?? []), ...update.words];
        return {
          label: name,
          pcm: null,
          seconds: update.received,
          words,
          pending: update.pending,
          language: update.language,
          stats: `stream · ${passes} passes · max ${Math.round(slowest)} ms`,
        };
      });
    });
    const finish = (pcm: Float32Array) =>
      setClip(
        (current) =>
          current && {
            ...current,
            label: label(current.words, name),
            pcm,
            seconds: pcm.length / SAMPLE_RATE,
            stats: `${current.stats} · ${((performance.now() - started) / 1000).toFixed(1)} s total`,
          },
      );
    return { session, finish };
  }

  async function withMicrophone(start: () => Promise<void>) {
    try {
      await start();
    } catch (error) {
      setMode('idle');
      setPeak(null);
      fail(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone blocked'
          : `No microphone: ${errorText(error)}`,
      );
    }
  }

  /** Records a clip of up to 30 s, then transcribes it in one pass. */
  const recordClip = () =>
    withMicrophone(async () => {
      const recording = await record({ onLevel: meter() });
      setMode('recording');
      setNote({ text: 'Recording' });
      const stop = async () => {
        stopRef.current = null;
        setMode('working');
        setPeak(null);
        const pcm = await recording.stop();
        if (pcm.length < MIN_CLIP_SECONDS * SAMPLE_RATE) setNote({ text: 'Too short' });
        else await transcribeClip(pcm, 'Recording');
        setMode('idle');
      };
      stopRef.current = stop;
      void recording.full.then(() => {
        if (stopRef.current === stop) void stop();
      });
    });

  /** Streams the microphone with no limit, showing words as they are committed. */
  const goLive = () =>
    withMicrophone(async () => {
      let stream: ReturnType<typeof openStream> | null = null;
      const recording = await record({
        onLevel: meter(),
        onChunk: (chunk) => stream?.session.push(chunk),
        maxSeconds: Infinity,
      });
      stream = openStream('Live');
      const { session, finish } = stream;
      setMode('live');
      setNote({ text: 'Live' });
      stopRef.current = async () => {
        stopRef.current = null;
        setMode('working');
        setPeak(null);
        const pcm = await recording.stop();
        await session.stop();
        finish(pcm);
        setNote({ text: 'Done' });
        setMode('idle');
      };
    });

  /** A file of any length: one pass up to 30 s, the stream beyond it. */
  async function upload(file: File) {
    setMode('working');
    try {
      setNote({ text: 'Decoding' });
      const pcm = await decodeAudioFile(file);
      if (pcm.length <= MAX_SECONDS * SAMPLE_RATE) {
        await transcribeClip(pcm, file.name);
      } else {
        setNote({ text: 'Streaming file' });
        const { session, finish } = openStream(file.name);
        const step = FILE_CHUNK_SECONDS * SAMPLE_RATE;
        for (let i = 0; i < pcm.length; i += step) session.push(pcm.slice(i, i + step));
        await session.stop();
        finish(pcm);
        setNote({ text: 'Done' });
      }
    } catch (error) {
      fail(`Unreadable: ${errorText(error)}`);
    } finally {
      setMode('idle');
    }
  }

  /** Adds the current clip's embedding (its first 30 s) to the comparison. */
  async function embed() {
    if (!clip?.pcm) return;
    setMode('working');
    try {
      const result = await whistle.embed(clip.pcm.slice(0, MAX_SECONDS * SAMPLE_RATE));
      if (result.type === 'error') return fail(result.message);
      const entry = {
        id: nextId.current++,
        label: clip.label,
        frames: result.frames,
        dims: result.dims,
        pooled: meanPool(result.vector, result.dims),
      };
      setEmbedded((list) => [...list, entry]);
      setNote({ text: `Embedded · ${result.frames}×${result.dims} · ${Math.round(result.ms)} ms` });
    } finally {
      setMode('idle');
    }
  }

  const status: EngineStatus =
    engine.state === 'ready' && note ? { state: note.state ?? 'ready', text: note.text } : engine;

  return {
    status,
    ready: engine.state === 'ready',
    mode,
    peak,
    options,
    setOptions,
    clip,
    embedded,
    recordClip,
    goLive,
    stop: () => void stopRef.current?.(),
    upload,
    embed,
    removeEmbedded: (id: number) => setEmbedded((list) => list.filter((e) => e.id !== id)),
  };
}
