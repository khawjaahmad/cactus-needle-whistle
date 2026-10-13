import { describe, expect, it } from 'vitest';
import { formatCalls, parseSteps, signature } from './format.ts';

describe('studio formatting', () => {
  it('prints calls and reads steps', () => {
    expect(signature({ name: 'open_page', arguments: { page: 'users' } })).toBe('open_page(page: "users")');
    expect(formatCalls([['sign_out', {}]])).toBe('sign_out()');
    expect(formatCalls([])).toBe('[]');
    expect(parseSteps('  Open settings \n\n# a comment\nSign out')).toEqual(['Open settings', 'Sign out']);
  });
});
