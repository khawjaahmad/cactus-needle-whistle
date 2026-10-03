/** The environment's frozen 32-case suite, run in the browser and scored like run_tests (§11). */
import { CATEGORIES, PASS_BAR, SEEN, TEST_CASES, matches, scored, suitePasses } from '../acme/cases.js';
import { SEED, acmeTools } from '../acme/tools.js';
import { byId, h } from '../shared/dom.js';
import { formatCalls } from './format.js';

const COLUMNS = ['', 'Request', 'Expected', 'Needle 3', 'conf'];

function caseRow({ request, want, got, ok, critical, confidence }) {
  const verdict = ok ? 'pass' : critical ? 'fail · critical' : 'fail';
  return h(
    'tr',
    { 'data-ok': String(ok) },
    h('td', {}, verdict),
    h('td', {}, request),
    h('td', { class: 'mono' }, formatCalls(want)),
    h('td', { class: 'mono' }, formatCalls(got)),
    h('td', { class: 'mono' }, confidence?.toFixed(2) ?? '—'),
  );
}

export function createSuiteRunner({ agent, session }) {
  async function run() {
    if (session.state.busy) return;
    session.set({ busy: true });
    try {
      const minConfidence = Number(byId('min-conf').value);
      const tools = acmeTools(SEED, SEEN);
      const tbody = h('tbody');
      const summary = h('div', { class: 'summary' }, h('strong', {}, 'Running…'), h('span', { class: 'meta' }, ''));
      const headings = COLUMNS.map((t) => h('th', {}, t));
      const table = h('table', { class: 'suite' }, h('thead', {}, h('tr', {}, headings)), tbody);
      byId('suite-report').replaceChildren(summary, table);

      let passed = 0;
      let run = 0;
      let criticalFailures = 0;
      for (const [label, from, to] of CATEGORIES) {
        tbody.append(h('tr', { class: 'category' }, h('td', { colspan: String(COLUMNS.length) }, label)));
        for (const [request, want, { critical } = {}] of TEST_CASES.slice(from, to)) {
          const result = await agent.ask(request, tools);
          const failed = result.type === 'error';
          const got = failed ? [] : scored(result.response, minConfidence);
          const ok = !failed && matches(got, want);
          passed += ok;
          run += 1;
          if (!ok && critical) criticalFailures += 1;
          tbody.append(caseRow({ request, want, got, ok, critical, confidence: result.response?.confidence }));
          summary.lastChild.textContent = `${passed}/${run} so far`;
        }
      }

      const pass = suitePasses(passed, criticalFailures);
      summary.dataset.ok = String(pass);
      summary.replaceChildren(
        h('strong', {}, `${passed}/${TEST_CASES.length} passed · ${pass ? 'suite passes' : 'suite fails'}`),
        h(
          'span',
          { class: 'meta' },
          `min_confidence ${minConfidence} · ${criticalFailures} critical failures · ` +
            `run_tests needs ${PASS_BAR} and no critical failure`,
        ),
      );
    } finally {
      session.set({ busy: false });
    }
  }

  return { run };
}
