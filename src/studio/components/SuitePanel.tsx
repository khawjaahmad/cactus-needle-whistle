import { useState } from 'react';
import { CATEGORIES, PASS_BAR, TEST_CASES } from '../../acme/cases.ts';
import type { SuiteReport, SuiteRow } from '../hooks/useSuiteRunner.ts';
import { formatCalls } from '../lib/format.ts';
import { ConfidenceRing } from './agent/ConfidenceRing.tsx';

const COLUMNS = ['', 'Request', 'Expected', 'Needle 3', 'conf'];
const MIN_CONFIDENCE = ['0', '0.5', '0.7'];
const DIAL_RADIUS = 34;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

interface Props {
  report: SuiteReport | null;
  hidden: boolean;
  disabled: boolean;
  onRun: (minConfidence: number) => void;
}

/** The 32-case suite, listed up front and filled in as Needle 3 answers each case. */
export function SuitePanel({ report, hidden, disabled, onRun }: Props) {
  const [minConfidence, setMinConfidence] = useState('0.5');
  const rows = report?.rows ?? [];
  const result = report?.result;
  const running = !!report && !result;
  const passed = result?.passed ?? rows.filter((r) => r.ok).length;

  return (
    <div className="panel" id="tab-suite" role="tabpanel" aria-labelledby="tab-button-suite" hidden={hidden}>
      <div className="toolbar">
        <div className="dial-row" data-ok={result?.pass}>
          <svg className="dial" width="44" height="44" viewBox="0 0 84 84" aria-hidden="true">
            <circle cx="42" cy="42" r={DIAL_RADIUS} className="track" />
            <circle
              cx="42"
              cy="42"
              r={DIAL_RADIUS}
              className="fill"
              strokeDasharray={DIAL_CIRCUMFERENCE}
              style={{ strokeDashoffset: DIAL_CIRCUMFERENCE * (1 - rows.length / TEST_CASES.length) }}
            />
          </svg>
          <strong key={passed} className="count" data-idle={!report}>{`${passed}/${TEST_CASES.length}`}</strong>
          {result && (
            <>
              <span className="badge" data-ok={result.pass}>
                {result.pass ? 'Suite passes' : 'Suite fails'}
              </span>
              <span
                className="meta"
                title={`run_tests needs ${PASS_BAR} and no critical failure`}
              >{`≥ ${report.minConfidence} · ${result.criticalFailures} critical`}</span>
            </>
          )}
        </div>
        <div className="row">
          <select
            id="min-conf"
            aria-label="Minimum confidence"
            title="Minimum confidence"
            value={minConfidence}
            disabled={running}
            onChange={(e) => setMinConfidence(e.target.value)}
          >
            {MIN_CONFIDENCE.map((value) => (
              <option key={value} value={value}>
                {`≥ ${value}`}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            id="run-suite"
            type="button"
            disabled={disabled}
            onClick={() => onRun(Number(minConfidence))}
          >
            {running ? 'Running' : report ? '↻ Run again' : '▶ Run suite'}
          </button>
        </div>
      </div>
      <div className="report">
        <table className="suite">
          <thead>
            <tr>
              {COLUMNS.map((heading, i) => (
                <th key={i}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.flatMap(([label, from, to]) => [
              <tr key={label} className="category">
                <td colSpan={COLUMNS.length}>{label}</td>
              </tr>,
              ...TEST_CASES.slice(from, to).map(([request, want], offset) => {
                const index = from + offset;
                return (
                  <CaseRow
                    key={request}
                    request={request}
                    want={formatCalls(want)}
                    row={rows[index]}
                    active={running && index === rows.length}
                  />
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** One case: waiting, being decoded (three dots), or scored. */
function CaseRow({ request, want, row, active }: { request: string; want: string; row?: SuiteRow; active: boolean }) {
  const state = row ? (row.ok ? 'pass' : 'fail') : active ? 'running' : 'waiting';
  const verdict = row ? (row.ok ? 'pass' : row.critical ? 'fail · critical' : 'fail') : state;
  return (
    <tr data-state={state}>
      <td title={verdict}>
        {row ? (
          <span key="verdict" className="verdict" data-ok={row.ok}>
            {row.ok ? '✓' : row.critical ? '!' : '✗'}
          </span>
        ) : active ? (
          <span className="thinking" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="pending-dot" aria-hidden="true" />
        )}
        <span className="sr-only">{verdict}</span>
      </td>
      <td>{request}</td>
      <td className="mono">{want}</td>
      <td className="mono">{row ? formatCalls(row.got) : ''}</td>
      <td>{row && <ConfidenceRing value={row.confidence ?? null} size={20} />}</td>
    </tr>
  );
}
