/*
 * Dictating a test case: the Dictate button records until pressed again (or until Whistle's 30 s
 * cap), then Whistle transcribes the clip and the pauses between steps become the editor's lines.
 */
import { vocabulary } from '../acme/tools.js';
import { byId } from '../shared/dom.js';
import { MAX_SECONDS, SAMPLE_RATE, record } from '../speech/recorder.js';

const MIN_CLIP_SECONDS = 0.4;
// The worklet reports every 128 samples: 125 a second, far more than the meter needs.
const METER_INTERVAL_MS = 80;
const METER_GAIN = 140;

export function createDictationPanel({ dictation, driver, editor, session, status }) {
  const button = byId('dictate');
  const buttonLabel = byId('dictate-label');
  const level = byId('level');
  const levelBar = byId('level-bar');
  let recorder = null;

  function showLevel(peak, seconds) {
    level.hidden = false;
    levelBar.style.width = `${Math.min(100, Math.round(peak * METER_GAIN))}%`;
    buttonLabel.textContent = `Stop · ${Math.max(0, MAX_SECONDS - seconds).toFixed(0)} s`;
  }

  async function start() {
    const { busy, transcribing } = session.state;
    if (busy || transcribing || !dictation.ready) return;
    let lastMeter = 0;
    try {
      recorder = await record({
        onLevel: (peak, seconds) => {
          if (performance.now() - lastMeter < METER_INTERVAL_MS) return;
          lastMeter = performance.now();
          showLevel(peak, seconds);
        },
      });
    } catch (error) {
      const text =
        error.name === 'NotAllowedError'
          ? 'Microphone blocked. Allow it in the browser and try again.'
          : `The microphone is unavailable: ${error.message}`;
      status({ state: 'failed', text });
      return;
    }
    button.dataset.recording = 'true';
    status({ text: 'Listening. Pause between steps and they land on their own lines.' });
    showLevel(0, 0);
    session.set({ recording: true });
    recorder.full.then(finish);
  }

  async function finish() {
    const current = recorder;
    if (!current) return;
    recorder = null;
    button.dataset.recording = 'false';
    buttonLabel.textContent = 'Dictate';
    level.hidden = true;
    session.set({ recording: false, transcribing: true });

    try {
      const pcm = await current.stop();
      const seconds = pcm.length / SAMPLE_RATE;
      if (seconds < MIN_CLIP_SECONDS) {
        status({ text: 'That was too short to transcribe.' });
        return;
      }

      status({ text: `Transcribing ${seconds.toFixed(1)} s…` });
      // Biased towards the app as it is right now, the same live state the tool enums come from.
      const result = await dictation.transcribe(pcm, vocabulary(driver.state()).join('\n'));
      if (result.type === 'error') {
        status({ state: 'failed', text: result.message });
        return;
      }
      editor.append(result.steps);
      status({ text: summarise(result, seconds) });
    } finally {
      session.set({ transcribing: false });
    }
  }

  button.addEventListener('click', () => (recorder ? finish() : start()));
}

/** Silence comes back empty rather than as an invented sentence, so say so plainly. */
function summarise(result, seconds) {
  const count = result.steps.length;
  if (!count) return 'Nothing was said in that clip.';
  return (
    `${count} step${count === 1 ? '' : 's'} · ${seconds.toFixed(1)} s in ${Math.round(result.ms)} ms` +
    ` · ${Math.round(result.ttftMs)} ms to first token · ${result.language}`
  );
}
