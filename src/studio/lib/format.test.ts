import { describe, expect, it } from 'vitest';
import { formatCalls, parseSteps, signature } from './format.ts';
import { toSpec } from './spec.ts';

describe('studio formatting', () => {
  it('prints calls and reads steps', () => {
    expect(signature({ name: 'open_page', arguments: { page: 'users' } })).toBe('open_page(page: "users")');
    expect(formatCalls([['sign_out', {}]])).toBe('sign_out()');
    expect(formatCalls([])).toBe('[]');
    expect(parseSteps('  Open settings \n\n# a comment\nSign out')).toEqual(['Open settings', 'Sign out']);
  });

  it('assembles a Playwright spec from a run', () => {
    const spec = toSpec({
      name: 'Sign out',
      appUrl: 'http://localhost/sandbox/?reset#',
      steps: [{ text: 'Sign  out', lines: ['await page.click("#x");'] }],
    });
    expect(spec).toMatch(/test\("Sign out", async \(\{ page \}\) => \{/);
    expect(spec).toMatch(/\n {2}\/\/ Sign out\n {2}await page\.click\("#x"\);\n/);
    expect(spec).toMatch(/process\.env\.APP_URL \?\? "http:\/\/localhost\/sandbox\/\?reset#"/);
  });
});
