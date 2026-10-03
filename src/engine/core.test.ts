import { describe, expect, it } from 'vitest';
import { judge, loadCatalog } from './core.ts';
import type { FunctionCall } from './types.ts';

const call = (name: string, args = {}): FunctionCall => ({ name, arguments: args });

describe('judge (the gate)', () => {
  const risky = new Set(['remove_user']);

  it('executes a confident call', () => {
    const verdict = judge({ function_calls: [call('sign_out')], confidence: 0.8 });
    expect(verdict.kind).toBe('execute');
    expect(verdict.bar).toBe(0.5);
  });

  it('asks below the bar, and when there is no calibrated score', () => {
    expect(judge({ function_calls: [call('sign_out')], confidence: 0.3 }).kind).toBe('confirm');
    expect(judge({ function_calls: [call('sign_out')] }).kind).toBe('confirm');
  });

  it('shows withheld calls and asks', () => {
    const verdict = judge({ function_calls: [], suppressed_calls: [call('sign_out')] });
    expect(verdict.kind).toBe('confirm');
    expect(verdict.calls).toEqual([call('sign_out')]);
  });

  it('refuses nothing, a failed turn, a negated or an ungrounded call', () => {
    expect(judge({ function_calls: [] }).kind).toBe('refuse');
    expect(judge({ success: false, error_code: 'truncated' }).kind).toBe('refuse');
    const negated = { function_calls: [call('sign_out')], confidence: 0.9, validation: { negation: true } };
    expect(judge(negated).kind).toBe('refuse');
    const ungrounded = { function_calls: [call('sign_out')], confidence: 0.9, validation: { ungrounded: ['email'] } };
    expect(judge(ungrounded).kind).toBe('refuse');
  });

  it('holds risky calls to 0.9 and marks them irreversible above it', () => {
    const below = judge({ function_calls: [call('remove_user')], confidence: 0.8 }, risky);
    expect(below.kind).toBe('confirm');
    expect(below.irreversible).toBeUndefined();
    const above = judge({ function_calls: [call('remove_user')], confidence: 0.95 }, risky);
    expect(above.kind).toBe('confirm');
    expect(above.irreversible).toBe(true);
    expect(above.bar).toBe(0.9);
  });
});

describe('loadCatalog', () => {
  it('keeps risk out of the schema the engine sees', () => {
    const parameters = { type: 'object' as const, properties: {}, required: [] };
    const [entry] = loadCatalog([{ name: 'remove_user', description: '', risk: 'high', parameters }]);
    expect(entry.risky).toBe(true);
    expect('risk' in entry.schema).toBe(false);
  });
});
