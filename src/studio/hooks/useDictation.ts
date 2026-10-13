/** Dictating a test case: record, transcribe with Whistle, append one line per step. */
import { useRef, useState } from 'react';
import type { EngineStatus } from '../../runtime/protocol.ts';
import { MAX_SECONDS, SAMPLE_RATE } from '../../speech/core.ts';
import type { Transcript, Whistle } from '../../speech/whistle.ts';
import { record, type Recording } from '../../speech/recorder.ts';
import { useEngineStatus } from './useEngineStatus.ts';

const MIN_CLIP_SECONDS = 0.4;
const METER_INTERVAL_MS = 80;

/** A message about the last dictation, shown in place of the engine's status once it is ready. */
type Note = { state?: EngineStatus['state']; text: string };

interface Options {
  whistle: Whistle;
  /** The words to bias towards: the app as it is right now, the same state the tool enums come from. */
  vocabulary: () => string[];
  onSteps: (steps: string[]) => void;
}

export function useDictation({ whistle, vocabulary, onSteps }: Options) {
  const engine = useEngineStatus(whistle);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState<{ peak: number; secondsLeft: number } | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const recorder = useRef<Recording | null>(null);

  async function start() {
    let lastMeter = 0;
    try {
      recorder.current = await record({
        onLevel: (peak, seconds) => {
          if (performance.now() - lastMeter < METER_INTERVAL_MS) return;
          lastMeter = performance.now();
          setLevel({ peak, secondsLeft: Math.max(0, MAX_SECONDS - seconds) });
        },
      });
    } catch (error) {
      const text =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone blocked'
          : `The microphone is unavailable: ${error instanceof Error ? error.message : String(error)}`;
      setNote({ state: 'failed', text });
      return;
    }
    setNote({ text: 'Listening' });
    setLevel({ peak: 0, secondsLeft: MAX_SECONDS });
    setRecording(true);
    void recorder.current.full.then(finish);
  }

  async function finish() {
    const current = recorder.current;
    if (!current) return;
    recorder.current = null;
    setRecording(false);
    setLevel(null);
    setTranscribing(true);

    try {
      const pcm = await current.stop();
      const seconds = pcm.length / SAMPLE_RATE;
      if (seconds < MIN_CLIP_SECONDS) {
        setNote({ text: 'Too short' });
        return;
      }

      setNote({ text: 'Transcribing' });
      const result = await whistle.transcribe(pcm, { keywords: vocabulary().join('\n'), language: 'en' });
      if (result.type === 'error') {
        setNote({ state: 'failed', text: result.message });
        return;
      }
      onSteps(result.steps);
      setNote({ text: summarise(result, seconds) });
    } finally {
      setTranscribing(false);
    }
  }

  const status: EngineStatus =
    engine.state === 'ready' && note ? { state: note.state ?? 'ready', text: note.text } : engine;

  return {
    status,
    ready: engine.state === 'ready',
    recording,
    transcribing,
    level,
    toggle: () => (recorder.current ? finish() : start()),
  };
}

/** Silence comes back empty rather than as an invented sentence, so say so plainly. */
function summarise(result: Transcript & { ms: number }, seconds: number) {
  const count = result.steps.length;
  if (!count) return 'Nothing heard';
  return `+${count} step${count === 1 ? '' : 's'} · ${seconds.toFixed(1)} s · ${Math.round(result.ms)} ms`;
}
