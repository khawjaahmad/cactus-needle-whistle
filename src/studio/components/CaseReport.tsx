import type { CaseReport as Report } from '../hooks/useCaseRunner.ts';
import { StepRow } from './StepRow.tsx';

interface Props {
  report: Report | null;
  onAnswer: (yes: boolean) => void;
}

/** The run as a live event timeline, under a segmented progress bar. */
export function CaseReport({ report, onAnswer }: Props) {
  if (!report) {
    return (
      <div className="report">
        <div className="idle-core" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  const { steps, result } = report;
  const passed = steps.filter((s) => s.state === 'passed').length;
  return (
    <div className="report" aria-live="polite">
      <div className="run-head" data-ok={result?.passed}>
        <div className="segments" aria-hidden="true">
          {steps.map((step, i) => (
            <i key={i} data-state={step.state} />
          ))}
        </div>
        <div className="run-score">
          <strong key={passed} className="count">{`${passed}/${steps.length}`}</strong>
          {result && (
            <>
              <span className="badge" data-ok={result.passed}>
                {result.passed ? 'Passed' : 'Failed'}
              </span>
              <span className="meta">{result.seconds} s</span>
            </>
          )}
        </div>
      </div>
      <ol className="timeline">
        {steps.map((step, i) => (
          <StepRow key={i} step={step} onAnswer={onAnswer} />
        ))}
      </ol>
    </div>
  );
}
