import { describe, expect, it } from 'vitest';
import { StepError } from '../../acme/driver.ts';
import { SEED } from '../../acme/tools.ts';
import type { FunctionCall, Turn, Verdict } from '../../engine/types.ts';
import { runCase, type CaseRunDeps, type StepView } from './run-case.ts';

const call = (name: string, args = {}): FunctionCall => ({ name, arguments: args });
const turn = (verdict: Partial<Verdict> & Pick<Verdict, 'kind'>, confidence = 0.9) => ({
  type: 'result' as const,
  id: 1,
  ms: 1,
  response: { function_calls: verdict.calls ?? [], confidence },
  verdict: { calls: [], bar: 0.5, why: 'because', ...verdict },
});

/** Runs `lines` with one scripted turn per step; returns what passed and each step's last view. */
async function run(lines: string[], turns: Turn[], { confirm = true, perform = async (c: FunctionCall) => c } = {}) {
  const views: StepView[] = lines.map((text) => ({ text, state: 'queued' }));
  const asked: string[][] = [];
  const deps: CaseRunDeps = {
    ask: async (_text, tools) => {
      asked.push(tools.find((t) => t.name === 'check_user')?.parameters.properties.email.enum ?? []);
      return { type: 'result', id: 1, ms: 1, ...turns[asked.length - 1] };
    },
    driver: {
      state: () => SEED,
      perform: async (c) => {
        await perform(c);
        return { detail: `did ${c.name}`, lines: [`// ${c.name}`] };
      },
    },
    update: (i, patch) => {
      views[i] = { ...views[i], ...patch };
    },
    confirm: async () => confirm,
  };
  const done = await runCase(lines, deps);
  return { done, views, asked };
}

describe('runCase', () => {
  it('runs confident steps and records their lines', async () => {
    const { done, views } = await run(['Sign out'], [turn({ kind: 'execute', calls: [call('sign_out')] })]);
    expect(done).toEqual([{ text: 'Sign out', lines: ['// sign_out'] }]);
    expect(views[0]).toMatchObject({ state: 'passed', detail: 'did sign_out' });
    expect(views[0].decision).toMatchObject({ calls: 'sign_out()', confidence: '0.90', why: 'because' });
  });

  it('stops at a refused step and skips the rest', async () => {
    const { done, views } = await run(
      ['a', 'b', 'c'],
      [turn({ kind: 'execute', calls: [call('sign_out')] }), turn({ kind: 'refuse' })],
    );
    expect(done).toHaveLength(1);
    expect(views.map((v) => v.state)).toEqual(['passed', 'failed', 'skipped']);
    expect(views[1].detail).toBe('Not run.');
  });

  it('asks before a call the gate would not run alone, and stops on no', async () => {
    const ask = turn({ kind: 'confirm', calls: [call('sign_out')] }, 0.3);
    expect((await run(['a'], [ask])).views[0].state).toBe('passed');
    const { views } = await run(['a'], [ask], { confirm: false });
    expect(views[0]).toMatchObject({ state: 'failed', detail: 'Stopped at your request.' });
  });

  it('runs a confident irreversible step without asking', async () => {
    const remove = turn({
      kind: 'confirm',
      irreversible: true,
      calls: [call('remove_user', { email: 'bob@acme.com' })],
    });
    const { views } = await run(['Remove bob@acme.com'], [remove], { confirm: false });
    expect(views[0].state).toBe('passed');
  });

  it('lets later checks name users the run invited', async () => {
    const invite = turn({ kind: 'execute', calls: [call('invite_user', { email: 'dana@acme.com' })] });
    const { asked } = await run(['a', 'b'], [invite, turn({ kind: 'refuse' })]);
    expect(asked[0]).not.toContain('dana@acme.com');
    expect(asked[1]).toContain('dana@acme.com');
  });

  it('reports a step the app rejects', async () => {
    const perform = async () => {
      throw new StepError('Expected to be on /dashboard; on /login.');
    };
    const { views } = await run(['a'], [turn({ kind: 'execute', calls: [call('check_page')] })], { perform });
    expect(views[0]).toMatchObject({ state: 'failed', detail: 'Expected to be on /dashboard; on /login.' });
  });
});
