import type { EngineStatus } from '../../runtime/protocol.ts';

const METER_GAIN = 140;

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
      <span>{recording && level ? `Stop · ${level.secondsLeft.toFixed(0)} s` : 'Dictate'}</span>
    </button>
  );
}

/** Whistle's status, then what the last dictation did; and the live peak meter while recording. */
export function DictationStatus({ status, level }: { status: EngineStatus; level: Level | null }) {
  return (
    <>
      <div className="row" role="status" aria-live="polite">
        <span className="dot" data-state={status.state} />
        <span className="meta">{status.text}</span>
      </div>
      <div className="level" hidden={!level} aria-hidden="true">
        <i style={{ width: `${Math.min(100, Math.round((level?.peak ?? 0) * METER_GAIN))}%` }} />
      </div>
    </>
  );
}
