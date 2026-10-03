/*
 * Runs a written test case against Acme Admin, one step at a time. For each step Needle 3 decodes
 * a call under a grammar built from all of the app's tools, and the gate decides to act, ask or
 * refuse (needle3-context.md §6, §9). The Acme driver carries the call out and records Playwright
 * lines; the steps that pass become a spec. Framework-free: the view comes in through `update`
 * and `confirm`.
 */
import { StepError, type AcmeDriver } from '../../acme/driver.ts';
import { acmeTools } from '../../acme/tools.ts';
import type { ToolEntry, Turn } from '../../engine/types.ts';
import type { Reply } from '../../runtime/protocol.ts';
import { signature } from './format.ts';
import type { RecordedStep } from './spec.ts';

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

// Only app users belong in check_user's enum. The sign-in email isn't one, and with
// "admin@acme.com" in the schema the model filled invite_user's role as "admin".
const USER_TOOLS = new Set(['invite_user', 'remove_user']);

/** The model's call and confidence, its reasoning, and the gate's reason. */
const describe = ({ response, verdict }: Turn): StepView['decision'] => ({
  calls: verdict.calls.length ? verdict.calls.map(signature).join(' · ') : '[]',
  confidence: response.confidence == null ? 'no score' : response.confidence.toFixed(2),
  reasoning: response.reasoning,
  why: verdict.why,
});

/** Runs the steps in order, stopping at the first that fails. Returns the steps that passed. */
export async function runCase(lines: string[], { ask, driver, update, confirm }: CaseRunDeps) {
  // Emails the run has invited or removed, so a later check can name them.
  const seen = new Set<string>();

  const fail = (index: number, detail: string) => {
    update(index, { state: 'failed', detail });
    return null;
  };

  async function runStep(index: number, text: string): Promise<RecordedStep | null> {
    update(index, { state: 'decoding' });
    // The tools as the app is right now: its users, plus any the run has seen, as enums.
    const result = await ask(text, acmeTools(driver.state(), [...seen]));
    if (result.type === 'error') return fail(index, result.message);
    update(index, { decision: describe(result) });
    const { verdict } = result;

    // The gate's reason is already on the row; a refused step stops the run.
    if (verdict.kind === 'refuse') return fail(index, 'Not run.');
    // A written destructive step is its own confirmation once it clears the 0.9 bar.
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
      return { text, lines: outcomes.flatMap((o) => o.lines) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(index, error instanceof StepError ? message : `Step error: ${message}`);
    }
  }

  const done: RecordedStep[] = [];
  for (const [index, text] of lines.entries()) {
    const step = await runStep(index, text);
    if (!step) break;
    done.push(step);
  }
  // Steps after the one that failed never ran.
  lines.forEach((_, index) => index > done.length && update(index, { state: 'skipped' }));
  return done;
}
