import { useEffect, useRef, type CSSProperties } from 'react';
import type { StepView } from '../lib/run-case.ts';
import { ConfidenceRing } from './agent/ConfidenceRing.tsx';
import { StateIcon } from './agent/StateIcon.tsx';

/** One step as an agent event: the instruction, the call Needle decided on, and what happened. */
export function StepRow({ step, onAnswer }: { step: StepView; onAnswer: (yes: boolean) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const { state, decision } = step;

  useEffect(() => {
    if (state === 'decoding') ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [state]);

  const confidence = decision && decision.confidence !== 'no score' ? Number(decision.confidence) : null;
  const title = [decision?.reasoning, decision?.why, state === 'passed' ? step.detail : ''].filter(Boolean).join('\n');

  return (
    <li ref={ref} className="event" data-state={state} title={title || undefined}>
      <StateIcon state={state} />
      <div className="event-body">
        <div className="text">{step.text}</div>
        {state === 'decoding' && (
          <div className="thinking" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        {decision && (
          <div className="decision">
            <code
              className="call"
              title={decision.calls}
              style={{ '--chars': Math.min(decision.calls.length, 80) } as CSSProperties}
            >
              {decision.calls}
            </code>
            <ConfidenceRing value={confidence} />
          </div>
        )}
        {(state === 'failed' || state === 'review') && step.detail && <div className="detail">{step.detail}</div>}
        {state === 'review' && (
          <div className="ask">
            <button className="btn btn-primary" type="button" onClick={() => onAnswer(true)}>
              Run
            </button>
            <button className="btn" type="button" onClick={() => onAnswer(false)}>
              Stop
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
