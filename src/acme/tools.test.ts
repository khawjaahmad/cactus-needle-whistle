import { describe, expect, it } from 'vitest';
import type { ToolEntry } from '../engine/types.ts';
import { SEED, acmeTools, vocabulary } from './tools.ts';

const byName = (tools: ToolEntry[]) => Object.fromEntries(tools.map((t) => [t.name, t]));

describe('acmeTools', () => {
  it('fills enums from the live users and the run so far', () => {
    const tools = byName(acmeTools(SEED, ['dana@acme.com']));
    expect(tools.remove_user.parameters.properties.email.enum).toEqual([
      'ana@acme.com',
      'bob@acme.com',
      'chen@acme.com',
    ]);
    expect(tools.check_user.parameters.properties.email.enum).toContain('dana@acme.com');
    expect(tools.remove_user.risk).toBe('high');
  });

  it('drops a tool whose enum would be empty', () => {
    const tools = byName(acmeTools({ users: [] }));
    expect(tools.remove_user).toBeUndefined();
    expect(tools.check_user).toBeUndefined();
    expect(tools.sign_in).toBeDefined();
  });

  it('biases dictation towards names the app uses', () => {
    expect(vocabulary(SEED)).toContain('Chen Wei');
  });
});
