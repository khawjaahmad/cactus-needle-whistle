/** Runs the written case (lib/run-case.ts) and keeps its report for the view. */
import { useRef, useState } from 'react';
import type { AcmeDriver } from '../../acme/driver.ts';
import type { Agent } from '../../engine/agent.ts';
import { runCase, type StepView } from '../lib/run-case.ts';

export interface CaseReport {
  steps: StepView[];
  /** Set when the run has ended. */
  result?: { passed: boolean; seconds: string };
}

interface Options {
  agent: Pick<Agent, 'ask'>;
  driver: AcmeDriver;
  onStart: () => void;
}

export function useCaseRunner({ agent, driver, onStart }: Options) {
  const [report, setReport] = useState<CaseReport | null>(null);
  const [running, setRunning] = useState(false);
  const answerConfirm = useRef<((yes: boolean) => void) | null>(null);

  const update = (index: number, patch: Partial<StepView>) =>
    setReport((r) => r && { ...r, steps: r.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) });

  async function run({ lines }: { lines: string[] }) {
    if (!lines.length || running) return;
    setRunning(true);
    try {
      onStart();
      await driver.reset();
      setReport({ steps: lines.map((text) => ({ text, state: 'queued' })) });

      const started = performance.now();
      const done = await runCase(lines, {
        ask: agent.ask,
        driver,
        update,
        confirm: () =>
          new Promise((resolve) => {
            answerConfirm.current = resolve;
          }),
      });

      const passed = done === lines.length;
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      setReport((r) => r && { ...r, result: { passed, seconds } });
    } finally {
      setRunning(false);
    }
  }

  /** The tester's answer to a step waiting for review. */
  function answer(yes: boolean) {
    answerConfirm.current?.(yes);
    answerConfirm.current = null;
  }

  return { report, running, run, answer };
}
