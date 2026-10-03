import { useState } from 'react';
import { CATEGORIES, PASS_BAR, TEST_CASES } from '../../acme/cases.ts';
import type { SuiteReport, SuiteRow } from '../hooks/useSuiteRunner.ts';
import { formatCalls } from '../lib/format.ts';

const COLUMNS = ['', 'Request', 'Expected', 'Needle 3', 'conf'];
const MIN_CONFIDENCE = ['0', '0.5', '0.7'];

interface Props {
  report: SuiteReport | null;
  hidden: boolean;
  disabled: boolean;
  onRun: (minConfidence: number) => void;
}

/** The environment's frozen suite: a threshold, a run button, and the scored table. */
export function SuitePanel({ report, hidden, disabled, onRun }: Props) {
  const [minConfidence, setMinConfidence] = useState('0.5');

  return (
    <div className="panel" id="tab-suite" role="tabpanel" aria-labelledby="tab-button-suite" hidden={hidden}>
      <div className="section">
        <div className="row spread">
          <span className="label">Acme Admin environment · {TEST_CASES.length} frozen cases</span>
          <div className="row">
            <label className="meta" htmlFor="min-conf">
              min_confidence
            </label>
            <select id="min-conf" value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)}>
              {MIN_CONFIDENCE.map((value) => (
                <option key={value} value={value}>
                  {value}
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
              Run suite
            </button>
          </div>
        </div>
        <div className="meta">
          The shape of the package's needle.environments: exact calls, [] for a missing value, no matching tool, a
          negated request or an out-of-range value, and two calls from one request. Scored like run_tests: whole calls
          compared, ungrounded or negated calls count as no call, and the suite fails on any critical case (missing,
          negated or out-of-range).
        </div>
      </div>
      <div className="report">{report && <SuiteResults report={report} />}</div>
    </div>
  );
}

function SuiteResults({ report: { minConfidence, rows, result } }: { report: SuiteReport }) {
  const passed = rows.filter((r) => r.ok).length;
  return (
    <>
      <div className="summary" data-ok={result?.pass}>
        {result ? (
          <>
            <strong>{`${result.passed}/${TEST_CASES.length} passed · ${result.pass ? 'suite passes' : 'suite fails'}`}</strong>
            <span className="meta">
              {`min_confidence ${minConfidence} · ${result.criticalFailures} critical failures · ` +
                `run_tests needs ${PASS_BAR} and no critical failure`}
            </span>
          </>
        ) : (
          <>
            <strong>Running…</strong>
            <span className="meta">{rows.length ? `${passed}/${rows.length} so far` : ''}</span>
          </>
        )}
      </div>
      <table className="suite">
        <thead>
          <tr>
            {COLUMNS.map((heading, i) => (
              <th key={i}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* A category's heading appears once its first case is under way. */}
          {CATEGORIES.filter(([, from]) => rows.length >= from).flatMap(([label, from, to]) => [
            <tr key={label} className="category">
              <td colSpan={COLUMNS.length}>{label}</td>
            </tr>,
            ...rows.slice(from, to).map((row) => <CaseRow key={row.request} row={row} />),
          ])}
        </tbody>
      </table>
    </>
  );
}

function CaseRow({ row: { request, want, got, ok, critical, confidence } }: { row: SuiteRow }) {
  return (
    <tr data-ok={ok}>
      <td>{ok ? 'pass' : critical ? 'fail · critical' : 'fail'}</td>
      <td>{request}</td>
      <td className="mono">{formatCalls(want)}</td>
      <td className="mono">{formatCalls(got)}</td>
      <td className="mono">{confidence?.toFixed(2) ?? '—'}</td>
    </tr>
  );
}
