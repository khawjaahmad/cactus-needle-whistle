import type { CaseReport as Report } from '../hooks/useCaseRunner.ts';
import { StepRow } from './StepRow.tsx';

interface Props {
  report: Report | null;
  onAnswer: (yes: boolean) => void;
  onViewSpec: () => void;
}

/** The last run: a summary, one row per step, and the way to its spec when it passed. */
export function CaseReport({ report, onAnswer, onViewSpec }: Props) {
  if (!report) {
    return (
      <div className="report" aria-live="polite">
        <p className="empty flush">
          Each step is decoded under a grammar built from Acme Admin's thirteen tools and gated by confidence before it
          touches the app.
        </p>
      </div>
    );
  }

  const { steps, result } = report;
  const passed = steps.filter((s) => s.state === 'passed').length;
  return (
    <div className="report" aria-live="polite">
      <div className="summary" data-ok={result?.passed}>
        <strong>{result ? (result.passed ? 'Passed' : 'Failed') : 'Running…'}</strong>
        <span className="meta">
          {result ? `${passed}/${steps.length} steps · ${result.seconds} s` : `${passed}/${steps.length}`}
        </span>
      </div>
      <ol className="steps">
        {steps.map((step, i) => (
          <StepRow key={i} index={i} step={step} onAnswer={onAnswer} />
        ))}
      </ol>
      <div className="row">
        {result?.passed && (
          <button className="btn" type="button" onClick={onViewSpec}>
            View Playwright spec
          </button>
        )}
      </div>
    </div>
  );
}
