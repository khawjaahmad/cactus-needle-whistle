import { describe, expect, it } from 'vitest';
import type { FunctionCall } from '../engine/types.ts';
import { matches, scored, suitePasses } from './cases.ts';

const call = (name: string, args = {}): FunctionCall => ({ name, arguments: args });

describe('suite scoring', () => {
  it('compares whole calls, order-insensitive and case-folded', () => {
    const got = [call('set_theme', { theme: 'Dark' }), call('set_two_factor', { state: 'off' })];
    expect(
      matches(got, [
        ['set_two_factor', { state: 'off' }],
        ['set_theme', { theme: 'dark' }],
      ]),
    ).toBe(true);
    expect(matches(got, [['set_theme', { theme: 'dark' }]])).toBe(false);
  });

  it('counts negated, ungrounded and low-confidence calls as no call', () => {
    const calls = [call('sign_out')];
    expect(scored({ function_calls: calls, validation: { negation: true } })).toEqual([]);
    expect(scored({ function_calls: calls, validation: { ungrounded: ['x'] } })).toEqual([]);
    expect(scored({ function_calls: calls, confidence: 0.4 }, 0.5)).toEqual([]);
    expect(scored({ function_calls: calls, confidence: 0.4 })).toEqual(calls);
  });

  it('fails on any critical failure', () => {
    expect(suitePasses(32, 0)).toBe(true);
    expect(suitePasses(32, 1)).toBe(false);
    expect(suitePasses(28, 0)).toBe(false);
  });
});
