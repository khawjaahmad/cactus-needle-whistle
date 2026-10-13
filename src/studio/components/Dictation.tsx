import type { EngineStatus } from '../../runtime/protocol.ts';
import { Waveform } from './agent/Waveform.tsx';

interface Level {
  peak: number;
  secondsLeft: number;
}

/** Turns red while the microphone is open and counts down to Whistle's 30 s cap. */
export function DictateButton({
  recording,
  level,
  disabled,
  onClick,
}: {
  recording: boolean;
  level: Level | null;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button className="btn" id="dictate" type="button" data-recording={recording} disabled={disabled} onClick={onClick}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>{recording && level ? `${level.secondsLeft.toFixed(0)} s` : 'Dictate'}</span>
    </button>
  );
}

/** The live waveform while the microphone is open; otherwise a short note on the last dictation. */
export function DictationStatus({ status, peak, busy }: { status: EngineStatus; peak: number | null; busy?: boolean }) {
  if (peak != null) return <Waveform peak={peak} />;
  return (
    <div className="row note" role="status" aria-live="polite" data-busy={busy}>
      <span className="dot" data-state={status.state} />
      <span key={status.text} className="meta">
        {status.text}
      </span>
    </div>
  );
}
