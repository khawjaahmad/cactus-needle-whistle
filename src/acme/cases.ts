/** The 32-case acceptance suite for Acme Admin, and how run_tests scores it. */
import type { CallArguments, FunctionCall, NeedleResponse } from '../engine/types.ts';

/** A call as the suite writes it: `[name, arguments]`. */
export type ExpectedCall = [name: string, args: CallArguments];
/** `[request, the calls it must give, options]`; `[]` means no call may run. */
export type TestCase = [request: string, want: ExpectedCall[], options?: { critical?: boolean }];

const CRITICAL = { critical: true };

export const TEST_CASES: TestCase[] = [
  [
    'sign in as admin@acme.com with password Passw0rd!',
    [['sign_in', { email: 'admin@acme.com', password: 'Passw0rd!' }]],
  ],
  ['Log in with admin@acme.com and wrongpass', [['sign_in', { email: 'admin@acme.com', password: 'wrongpass' }]]],
  ['sign out', [['sign_out', {}]]],
  ['go to the users page', [['open_page', { page: 'users' }]]],
  ['open settings', [['open_page', { page: 'settings' }]]],
  ['search users for dana', [['search_users', { query: 'dana' }]]],
  ['invite dana@acme.com as an editor', [['invite_user', { email: 'dana@acme.com', role: 'editor' }]]],
  ['invite Eve Stone at eve@acme.com', [['invite_user', { email: 'eve@acme.com', name: 'Eve Stone', role: 'viewer' }]]],
  ['remove bob@acme.com', [['remove_user', { email: 'bob@acme.com' }]]],
  ['turn off two-factor authentication', [['set_two_factor', { state: 'off' }]]],
  ['enable email alerts', [['set_email_alerts', { state: 'on' }]]],
  ['switch to the dark theme', [['set_theme', { theme: 'dark' }]]],
  ['user should be redirected to the dashboard', [['check_page', { page: 'dashboard' }]]],
  ['verify we are still on the login page', [['check_page', { page: 'login' }]]],
  [
    'an error "Invalid email or password" should be displayed',
    [['check_message', { message: 'Invalid email or password' }]],
  ],
  ['confirm "Invitation sent" appears', [['check_message', { message: 'Invitation sent' }]]],
  ['verify dana@acme.com is pending', [['check_user', { email: 'dana@acme.com', status: 'pending' }]]],
  ['verify bob@acme.com is removed', [['check_user', { email: 'bob@acme.com', status: 'removed' }]]],
  ['verify two-factor is off', [['check_setting', { setting: 'two-factor', value: 'off' }]]],
  ['make sure the theme is dark', [['check_setting', { setting: 'theme', value: 'dark' }]]],

  ['sign in as admin@acme.com', [], CRITICAL],
  ['invite a new editor', [], CRITICAL],
  ['remove a user', [], CRITICAL],

  ['what is the weather in London', []],
  ['export all users to a spreadsheet', []],

  ['do not remove bob@acme.com', [], CRITICAL],
  ["don't sign out", [], CRITICAL],

  ['switch to the purple theme', [], CRITICAL],
  ['remove carol@acme.com', [], CRITICAL],

  [
    'turn off two-factor and switch to the dark theme',
    [
      ['set_two_factor', { state: 'off' }],
      ['set_theme', { theme: 'dark' }],
    ],
  ],
  [
    'invite dana@acme.com and then open the dashboard',
    [
      ['invite_user', { email: 'dana@acme.com', role: 'viewer' }],
      ['open_page', { page: 'dashboard' }],
    ],
  ],
  [
    'sign out and go to the login page',
    [
      ['sign_out', {}],
      ['open_page', { page: 'login' }],
    ],
  ],
];

/** The six categories, as [label, first case, end]. */
export const CATEGORIES: [label: string, from: number, to: number][] = [
  ['Exact call', 0, 20],
  ['Required value missing → []', 20, 23],
  ['No tool covers it → []', 23, 25],
  ['Negated → []', 25, 27],
  ['Value out of range → []', 27, 29],
  ['Two calls from one request', 29, 32],
];

/** Emails the suite's run has seen besides the seeded users. */
export const SEEN = ['dana@acme.com'];

/** A call as run_tests compares it: name and every argument, strings case-folded, keys sorted. */
const fold = (args: CallArguments) =>
  Object.fromEntries(
    Object.keys(args)
      .sort()
      .map((k) => [k, typeof args[k] === 'string' ? args[k].toLowerCase() : args[k]]),
  );
const key = (name: string, args: CallArguments = {}) => JSON.stringify([name, fold(args)]);

/** Order-insensitive match on whole calls, like run_tests: an extra or missing argument fails. */
export function matches(got: FunctionCall[], want: ExpectedCall[]) {
  const a = got.map((c) => key(c.name, c.arguments)).sort();
  const b = want.map(([name, args]) => key(name, args)).sort();
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** run_tests' rule: at least 90% of cases pass and no critical case fails. */
export const PASS_BAR = Math.round(0.9 * TEST_CASES.length);
export const suitePasses = (passed: number, criticalFailures: number) => passed >= PASS_BAR && criticalFailures === 0;

/** Scores one response like run_tests: ungrounded, negated or below-threshold calls count as none. */
export function scored(response: NeedleResponse, minConfidence = 0) {
  const v = response.validation ?? {};
  const calls = response.function_calls ?? [];
  if (v.negation || v.ungrounded?.length) return [];
  if (minConfidence > 0 && calls.length && (response.confidence ?? 0) < minConfidence) return [];
  return calls;
}
