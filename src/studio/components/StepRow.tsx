import { useEffect, useRef } from 'react';
import type { StepView } from '../lib/run-case.ts';

/** One step: what Needle decided, what happened when it ran, and the question when the gate asks. */
export function StepRow({
  index,
  step,
  onAnswer,
}: {
  index: number;
  step: StepView;
  onAnswer: (yes: boolean) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { state, decision } = step;

  useEffect(() => {
    if (state === 'decoding') ref.current?.scrollIntoView({ block: 'nearest' });
  }, [state]);

  return (
    <li ref={ref} className="step" data-state={state}>
      <span className="n">{String(index + 1).padStart(2, '0')}</span>
      <span className="state">{state}</span>
      <div>
        <div className="text">{step.text}</div>
        {decision && (
          <>
            <div className="call">{`${decision.calls}  ·  ${decision.confidence}`}</div>
            {decision.reasoning && <div className="why">{decision.reasoning}</div>}
            <div className="why">{decision.why}</div>
          </>
        )}
        <div className="detail">{step.detail}</div>
        {state === 'review' && (
          <div className="ask">
            <button className="btn btn-primary" type="button" onClick={() => onAnswer(true)}>
              Run step
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
