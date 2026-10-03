/** One step's row in the report: what Needle decided, and what happened when it ran. */
import { h } from '../shared/dom.js';
import { signature } from './format.js';

export function stepRow(text, index) {
  const state = h('span', { class: 'state' }, 'queued');
  const detail = h('div', { class: 'detail' });
  const body = h('div', {}, h('div', { class: 'text' }, text), detail);
  const el = h(
    'li',
    { class: 'step', 'data-state': 'queued' },
    h('span', { class: 'n' }, String(index + 1).padStart(2, '0')),
    state,
    body,
  );

  const set = (next, message) => {
    el.dataset.state = next;
    state.textContent = next;
    if (message != null) detail.textContent = message;
  };

  /** Shows the model's call and confidence, its reasoning, and the gate's reason. */
  const decoded = ({ response, verdict }) => {
    const confidence = response.confidence == null ? 'no score' : response.confidence.toFixed(2);
    const calls = verdict.calls.length ? verdict.calls.map(signature).join(' · ') : '[]';
    detail.before(
      h('div', { class: 'call' }, calls, `  ·  ${confidence}`),
      response.reasoning ? h('div', { class: 'why' }, response.reasoning) : '',
      h('div', { class: 'why' }, verdict.why),
    );
  };

  /** A step the gate would not run alone waits for the tester (§6: show the call, ask). */
  const confirm = () =>
    new Promise((resolve) => {
      set('review', 'Run this call as decoded?');
      const answer = (yes) => () => {
        ask.remove();
        resolve(yes);
      };
      const ask = h(
        'div',
        { class: 'ask' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: answer(true) }, 'Run step'),
        h('button', { class: 'btn', type: 'button', onclick: answer(false) }, 'Stop'),
      );
      body.append(ask);
    });

  /** Still waiting when the run ended. */
  const isQueued = () => el.dataset.state === 'queued';

  return { el, set, decoded, confirm, isQueued };
}
