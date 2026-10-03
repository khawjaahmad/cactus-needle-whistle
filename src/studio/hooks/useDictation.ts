/*
 * Dictating a test case: the Dictate button records until pressed again (or until Whistle's 30 s
 * cap), then Whistle transcribes the clip and the pauses between steps become the editor's lines.
 */
import { useRef, useState } from 'react';
import type { EngineStatus } from '../../runtime/protocol.ts';
import { MAX_SECONDS, SAMPLE_RATE } from '../../speech/core.ts';
import type { Dictation, Transcript } from '../../speech/dictation.ts';
import { record, type Recording } from '../../speech/recorder.ts';
import { useEngineStatus } from './useEngineStatus.ts';

const MIN_CLIP_SECONDS = 0.4;
// The worklet reports every 128 samples: 125 a second, far more than the meter needs.
const METER_INTERVAL_MS = 80;

/** A message about the last dictation, shown in place of the engine's status once it is ready. */
type Note = { state?: EngineStatus['state']; text: string };

interface Options {
  dictation: Dictation;
  /** The words to bias towards: the app as it is right now, the same state the tool enums come from. */
  vocabulary: () => string[];
  onSteps: (steps: string[]) => void;
}

export function useDictation({ dictation, vocabulary, onSteps }: Options) {
  const engine = useEngineStatus(dictation);
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
          ? 'Microphone blocked. Allow it in the browser and try again.'
          : `The microphone is unavailable: ${error instanceof Error ? error.message : String(error)}`;
      setNote({ state: 'failed', text });
      return;
    }
    setNote({ text: 'Listening. Pause between steps and they land on their own lines.' });
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
        setNote({ text: 'That was too short to transcribe.' });
        return;
      }

      setNote({ text: `Transcribing ${seconds.toFixed(1)} s…` });
      const result = await dictation.transcribe(pcm, vocabulary().join('\n'));
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

  // The engine's own status until it is ready, then what the last dictation did.
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
  if (!count) return 'Nothing was said in that clip.';
  return (
    `${count} step${count === 1 ? '' : 's'} · ${seconds.toFixed(1)} s in ${Math.round(result.ms)} ms` +
    ` · ${Math.round(result.ttftMs)} ms to first token · ${result.language}`
  );
}
