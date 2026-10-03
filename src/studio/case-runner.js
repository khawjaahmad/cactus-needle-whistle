/*
 * Runs the written test case against Acme Admin, one step at a time. For each step Needle 3
 * decodes a call under a grammar built from all of the app's tools, and the gate decides to act,
 * ask or refuse (needle3-context.md §6, §9). The Acme driver carries the call out and records
 * Playwright; a passing run becomes a spec.
 */
import { StepError } from '../acme/driver.js';
import { acmeTools } from '../acme/tools.js';
import { byId, h } from '../shared/dom.js';
import { toSpec } from './spec.js';
import { stepRow } from './step-row.js';

// Only app users belong in check_user's enum. The sign-in email isn't one, and with
// "admin@acme.com" in the schema the model filled invite_user's role as "admin".
const USER_TOOLS = new Set(['invite_user', 'remove_user']);

export function createCaseRunner({ agent, driver, editor, session, tabs, specPanel, specAppUrl }) {
  const fail = (row, message) => {
    row.set('failed', message);
    return null;
  };

  /** Decodes, gates and performs one step. Returns what it recorded, or null when the run stops here. */
  async function runStep(row, text, seen) {
    row.set('decoding');
    row.el.scrollIntoView({ block: 'nearest' });
    // The tools as the app is right now: its users, plus any the run has seen, as enums.
    const result = await agent.ask(text, acmeTools(driver.state(), [...seen]));
    if (result.type === 'error') return fail(row, result.message);
    row.decoded(result);
    const { verdict } = result;

    // The gate's reason is already on the row; a refused step stops the run.
    if (verdict.kind === 'refuse') return fail(row, 'Not run.');
    // A written destructive step is its own confirmation once it clears the 0.9 bar.
    if (verdict.kind === 'confirm' && !verdict.irreversible && !(await row.confirm())) {
      return fail(row, 'Stopped at your request.');
    }

    row.set('running');
    try {
      const outcomes = [];
      for (const call of verdict.calls) {
        if (USER_TOOLS.has(call.name)) seen.add(call.arguments.email);
        outcomes.push(await driver.perform(call));
      }
      row.set('passed', outcomes.map((o) => o.detail).join(' · '));
      return { text, lines: outcomes.flatMap((o) => o.lines) };
    } catch (error) {
      return fail(row, error instanceof StepError ? error.message : `Step error: ${error.message}`);
    }
  }

  async function run() {
    const { name, lines } = editor.read();
    if (!lines.length || session.state.busy) return;
    session.set({ busy: true });
    try {
      tabs.show('app');
      await driver.reset();

      const rows = lines.map(stepRow);
      const progress = h('span', { class: 'meta' }, `0/${lines.length}`);
      const summary = h('div', { class: 'summary' }, h('strong', {}, 'Running…'), progress);
      const list = h('ol', { class: 'steps' }, ...rows.map((r) => r.el));
      const actions = h('div', { class: 'row' });
      byId('report').replaceChildren(summary, list, actions);

      const seen = new Set();
      const done = [];
      const started = performance.now();
      for (const [i, text] of lines.entries()) {
        const step = await runStep(rows[i], text, seen);
        if (!step) break;
        done.push(step);
        progress.textContent = `${done.length}/${lines.length}`;
      }

      const passed = done.length === lines.length;
      rows.filter((r) => r.isQueued()).forEach((r) => r.set('skipped'));
      summary.dataset.ok = String(passed);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      summary.replaceChildren(
        h('strong', {}, passed ? 'Passed' : 'Failed'),
        h('span', { class: 'meta' }, `${done.length}/${lines.length} steps · ${seconds} s`),
      );
      if (passed) {
        specPanel.show(toSpec({ name, appUrl: specAppUrl, steps: done }));
        actions.append(
          h('button', { class: 'btn', type: 'button', onclick: () => tabs.show('spec') }, 'View Playwright spec'),
        );
      }
    } finally {
      session.set({ busy: false });
    }
  }

  return { run };
}
