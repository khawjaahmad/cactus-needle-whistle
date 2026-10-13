import type { StepState } from '../../lib/run-case.ts';

/** A step's state as a glyph: a cursor while it acts, a drawn check or cross when it ends. */
export function StateIcon({ state }: { state: StepState }) {
  return (
    <span className="state-icon" data-state={state} title={state}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        {state === 'decoding' && <circle cx="10" cy="10" r="3" className="solid" />}
        {state === 'running' && <path d="M6 4 L15 9 L10.5 10.5 L8.5 15 Z" className="act" />}
        {state === 'review' && <circle cx="10" cy="10" r="4" className="wait" />}
        {state === 'passed' && <path d="M5 10.5 L8.5 14 L15 6.5" className="draw" />}
        {state === 'failed' && <path d="M6 6 L14 14 M14 6 L6 14" className="draw" />}
        {state === 'skipped' && <path d="M6 10 H14" />}
        {state === 'queued' && <circle cx="10" cy="10" r="3" />}
      </svg>
      <span className="sr-only">{state}</span>
    </span>
  );
}
