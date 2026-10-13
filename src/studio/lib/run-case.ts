/** Runs a written test case against Acme Admin, one step at a time. */
import { StepError, type AcmeDriver } from '../../acme/driver.ts';
import { acmeTools } from '../../acme/tools.ts';
import type { ToolEntry, Turn } from '../../engine/types.ts';
import type { Reply } from '../../runtime/protocol.ts';
import { signature } from './format.ts';

export type StepState = 'queued' | 'decoding' | 'review' | 'running' | 'passed' | 'failed' | 'skipped';

/** One step as the report shows it: what Needle decided, and what happened when it ran. */
export interface StepView {
  text: string;
  state: StepState;
  decision?: { calls: string; confidence: string; reasoning?: string; why: string };
  detail?: string;
}

export interface CaseRunDeps {
  ask: (text: string, tools: ToolEntry[]) => Promise<Reply<Turn>>;
  driver: Pick<AcmeDriver, 'perform' | 'state'>;
  /** Merges `patch` into step `index`'s view. */
  update: (index: number, patch: Partial<StepView>) => void;
  /** Asks the tester whether to run a call the gate would not run alone (§6: show the call, ask). */
  confirm: (index: number) => Promise<boolean>;
}

const USER_TOOLS = new Set(['invite_user', 'remove_user']);

/** The model's call and confidence, its reasoning, and the gate's reason. */
const describe = ({ response, verdict }: Turn): StepView['decision'] => ({
  calls: verdict.calls.length ? verdict.calls.map(signature).join(' · ') : '[]',
  confidence: response.confidence == null ? 'no score' : response.confidence.toFixed(2),
  reasoning: response.reasoning,
  why: verdict.why,
});

/** Runs the steps in order, stopping at the first that fails. */
export async function runCase(lines: string[], { ask, driver, update, confirm }: CaseRunDeps) {
  const seen = new Set<string>();

  const fail = (index: number, detail: string) => {
    update(index, { state: 'failed', detail });
    return false;
  };

  async function runStep(index: number, text: string): Promise<boolean> {
    update(index, { state: 'decoding' });
    const result = await ask(text, acmeTools(driver.state(), [...seen]));
    if (result.type === 'error') return fail(index, result.message);
    update(index, { decision: describe(result) });
    const { verdict } = result;

    if (verdict.kind === 'refuse') return fail(index, 'Not run.');
    if (verdict.kind === 'confirm' && !verdict.irreversible) {
      update(index, { state: 'review', detail: 'Run this call as decoded?' });
      if (!(await confirm(index))) return fail(index, 'Stopped at your request.');
    }

    update(index, { state: 'running' });
    try {
      const outcomes = [];
      for (const call of verdict.calls) {
        if (USER_TOOLS.has(call.name)) seen.add(call.arguments.email);
        outcomes.push(await driver.perform(call));
      }
      update(index, { state: 'passed', detail: outcomes.map((o) => o.detail).join(' · ') });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(index, error instanceof StepError ? message : `Step error: ${message}`);
    }
  }

  let passed = 0;
  for (const [index, text] of lines.entries()) {
    if (!(await runStep(index, text))) break;
    passed += 1;
  }
  lines.forEach((_, index) => index > passed && update(index, { state: 'skipped' }));
  return passed;
}
