/** The environment's frozen 32-case suite, run in the browser and scored like run_tests (§11). */
import { useState } from 'react';
import { SEEN, TEST_CASES, matches, scored, suitePasses, type ExpectedCall } from '../../acme/cases.ts';
import { SEED, acmeTools } from '../../acme/tools.ts';
import type { Agent } from '../../engine/agent.ts';
import type { FunctionCall } from '../../engine/types.ts';

export interface SuiteRow {
  request: string;
  want: ExpectedCall[];
  got: FunctionCall[];
  ok: boolean;
  critical: boolean;
  confidence?: number | null;
}

export interface SuiteReport {
  minConfidence: number;
  rows: SuiteRow[];
  /** Set when the run has ended. */
  result?: { pass: boolean; passed: number; criticalFailures: number };
}

export function useSuiteRunner(agent: Pick<Agent, 'ask'>) {
  const [report, setReport] = useState<SuiteReport | null>(null);
  const [running, setRunning] = useState(false);

  async function run(minConfidence: number) {
    if (running) return;
    setRunning(true);
    try {
      const tools = acmeTools(SEED, SEEN);
      let rows: SuiteRow[] = [];
      setReport({ minConfidence, rows });

      for (const [request, want, { critical = false } = {}] of TEST_CASES) {
        const result = await agent.ask(request, tools);
        const response = result.type === 'error' ? null : result.response;
        const got = response ? scored(response, minConfidence) : [];
        const ok = !!response && matches(got, want);
        rows = [...rows, { request, want, got, ok, critical, confidence: response?.confidence }];
        setReport({ minConfidence, rows });
      }

      const passed = rows.filter((r) => r.ok).length;
      const criticalFailures = rows.filter((r) => !r.ok && r.critical).length;
      setReport({
        minConfidence,
        rows,
        result: { pass: suitePasses(passed, criticalFailures), passed, criticalFailures },
      });
    } finally {
      setRunning(false);
    }
  }

  return { report, running, run };
}
