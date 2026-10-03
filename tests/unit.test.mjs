/*
 * The pure logic, without the model: the gate, the dictation split, suite scoring, the tool
 * schemas, spec generation and the heap helpers. The engines themselves are checked end to end by
 * scripts/suite.mjs and scripts/speech-check.mjs.
 *
 *     npm test
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { matches, scored, suitePasses } from '../src/acme/cases.js';
import { SEED, acmeTools, vocabulary } from '../src/acme/tools.js';
import { formatCalls, parseSteps, signature } from '../src/studio/format.js';
import { toSpec } from '../src/studio/spec.js';

const require = createRequire(import.meta.url);
const { judge, loadCatalog } = require('../src/engine/core.js');
const { toSteps, isSilent } = require('../src/speech/core.js');
const { createHeap } = require('../src/runtime/wasm-heap.js');

const call = (name, args = {}) => ({ name, arguments: args });

describe('judge (the gate)', () => {
  const risky = new Set(['remove_user']);

  it('executes a confident call', () => {
    const verdict = judge({ function_calls: [call('sign_out')], confidence: 0.8 });
    assert.equal(verdict.kind, 'execute');
    assert.equal(verdict.bar, 0.5);
  });

  it('asks below the bar, and when there is no calibrated score', () => {
    assert.equal(judge({ function_calls: [call('sign_out')], confidence: 0.3 }).kind, 'confirm');
    assert.equal(judge({ function_calls: [call('sign_out')] }).kind, 'confirm');
  });

  it('shows withheld calls and asks', () => {
    const verdict = judge({ function_calls: [], suppressed_calls: [call('sign_out')] });
    assert.equal(verdict.kind, 'confirm');
    assert.deepEqual(verdict.calls, [call('sign_out')]);
  });

  it('refuses nothing, a failed turn, a negated or an ungrounded call', () => {
    assert.equal(judge({ function_calls: [] }).kind, 'refuse');
    assert.equal(judge({ success: false, error_code: 'truncated' }).kind, 'refuse');
    const negated = { function_calls: [call('sign_out')], confidence: 0.9, validation: { negation: true } };
    assert.equal(judge(negated).kind, 'refuse');
    const ungrounded = { function_calls: [call('sign_out')], confidence: 0.9, validation: { ungrounded: ['email'] } };
    assert.equal(judge(ungrounded).kind, 'refuse');
  });

  it('holds risky calls to 0.9 and marks them irreversible above it', () => {
    const below = judge({ function_calls: [call('remove_user')], confidence: 0.8 }, risky);
    assert.equal(below.kind, 'confirm');
    assert.equal(below.irreversible, undefined);
    const above = judge({ function_calls: [call('remove_user')], confidence: 0.95 }, risky);
    assert.equal(above.kind, 'confirm');
    assert.equal(above.irreversible, true);
    assert.equal(above.bar, 0.9);
  });
});

describe('loadCatalog', () => {
  it('keeps risk out of the schema the engine sees', () => {
    const [entry] = loadCatalog([{ name: 'remove_user', risk: 'high', parameters: {} }]);
    assert.equal(entry.risky, true);
    assert.equal('risk' in entry.schema, false);
  });
});

describe('toSteps (dictation split)', () => {
  const word = (w, start, end) => ({ word: w, start, end });

  it('splits on a long pause', () => {
    const words = [word('open', 0, 0.3), word('settings', 0.35, 0.8), word('verify', 1.6, 1.9), word('it', 1.95, 2)];
    assert.deepEqual(toSteps({ words }), ['Open settings', 'Verify it']);
  });

  it('splits on sentence-final punctuation and drops the full stop', () => {
    const words = [word('Sign', 0, 0.2), word('out.', 0.25, 0.5), word('then', 0.6, 0.8), word('go', 0.85, 1)];
    assert.deepEqual(toSteps({ words }), ['Sign out', 'Then go']);
  });

  it('falls back to the text without timestamps, and gives nothing for silence', () => {
    assert.deepEqual(toSteps({ text: 'open settings.' }), ['Open settings']);
    assert.deepEqual(toSteps({ text: '' }), []);
  });
});

describe('isSilent', () => {
  it('rejects room tone and keeps speech', () => {
    assert.equal(isSilent(new Float32Array(0)), true);
    assert.equal(isSilent(new Float32Array(1600).fill(0.001)), true);
    assert.equal(isSilent(new Float32Array(1600).fill(0.2)), false);
  });
});

describe('suite scoring', () => {
  it('compares whole calls, order-insensitive and case-folded', () => {
    const got = [call('set_theme', { theme: 'Dark' }), call('set_two_factor', { state: 'off' })];
    assert.equal(
      matches(got, [
        ['set_two_factor', { state: 'off' }],
        ['set_theme', { theme: 'dark' }],
      ]),
      true,
    );
    assert.equal(matches(got, [['set_theme', { theme: 'dark' }]]), false);
  });

  it('counts negated, ungrounded and low-confidence calls as no call', () => {
    const calls = [call('sign_out')];
    assert.deepEqual(scored({ function_calls: calls, validation: { negation: true } }), []);
    assert.deepEqual(scored({ function_calls: calls, validation: { ungrounded: ['x'] } }), []);
    assert.deepEqual(scored({ function_calls: calls, confidence: 0.4 }, 0.5), []);
    assert.deepEqual(scored({ function_calls: calls, confidence: 0.4 }), calls);
  });

  it('fails on any critical failure', () => {
    assert.equal(suitePasses(32, 0), true);
    assert.equal(suitePasses(32, 1), false);
    assert.equal(suitePasses(28, 0), false);
  });
});

describe('acmeTools', () => {
  const byName = (tools) => Object.fromEntries(tools.map((t) => [t.name, t]));

  it('fills enums from the live users and the run so far', () => {
    const tools = byName(acmeTools(SEED, ['dana@acme.com']));
    assert.deepEqual(tools.remove_user.parameters.properties.email.enum, [
      'ana@acme.com',
      'bob@acme.com',
      'chen@acme.com',
    ]);
    assert.ok(tools.check_user.parameters.properties.email.enum.includes('dana@acme.com'));
    assert.equal(tools.remove_user.risk, 'high');
  });

  it('drops a tool whose enum would be empty', () => {
    const tools = byName(acmeTools({ users: [] }));
    assert.equal(tools.remove_user, undefined);
    assert.equal(tools.check_user, undefined);
    assert.ok(tools.sign_in);
  });

  it('biases dictation towards names the app uses', () => {
    assert.ok(vocabulary(SEED).includes('Chen Wei'));
  });
});

describe('studio formatting', () => {
  it('prints calls and reads steps', () => {
    assert.equal(signature(call('open_page', { page: 'users' })), 'open_page(page: "users")');
    assert.equal(formatCalls([['sign_out', {}]]), 'sign_out()');
    assert.equal(formatCalls([]), '[]');
    assert.deepEqual(parseSteps('  Open settings \n\n# a comment\nSign out'), ['Open settings', 'Sign out']);
  });

  it('assembles a Playwright spec from a run', () => {
    const spec = toSpec({
      name: 'Sign out',
      appUrl: 'http://localhost/sandbox/?reset#',
      steps: [{ text: 'Sign  out', lines: ['await page.click("#x");'] }],
    });
    assert.match(spec, /test\("Sign out", async \(\{ page \}\) => \{/);
    assert.match(spec, /\n {2}\/\/ Sign out\n {2}await page\.click\("#x"\);\n/);
    assert.match(spec, /process\.env\.APP_URL \?\? "http:\/\/localhost\/sandbox\/\?reset#"/);
  });
});

describe('wasm heap helpers', () => {
  // A bump allocator over a plain array, standing in for an Emscripten module.
  function fakeModule() {
    const M = { HEAPU8: new Uint8Array(256), freed: [] };
    let next = 8;
    M._malloc = (n) => {
      const ptr = next;
      next += n;
      return ptr;
    };
    M._free = (ptr) => M.freed.push(ptr);
    return M;
  }

  it('passes strings as C strings and frees them', () => {
    const M = fakeModule();
    const heap = createHeap(M);
    const seen = heap.withStrings(['héllo', null], (a, b) => [heap.readString(a), b]);
    assert.deepEqual(seen, ['héllo', 0]);
    assert.equal(M.freed.length, 1);
    assert.equal(heap.readString(0), '');
  });

  it('frees a byte copy even when the call throws', () => {
    const M = fakeModule();
    const heap = createHeap(M);
    assert.throws(() =>
      heap.withBytes(new Uint8Array([1, 2, 3]), (ptr, length) => {
        assert.deepEqual([...M.HEAPU8.subarray(ptr, ptr + length)], [1, 2, 3]);
        throw new Error('rejected');
      }),
    );
    assert.equal(M.freed.length, 1);
  });
});
