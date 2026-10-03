/** The test case editor: its name, its steps, and the examples it can load. */
import { byId, h } from '../shared/dom.js';
import { EXAMPLES } from './examples.js';
import { parseSteps } from './format.js';

export function createEditor() {
  const name = byId('test-name');
  const steps = byId('steps');
  const picker = byId('example');

  const load = (example) => {
    name.value = example.name;
    steps.value = example.steps.join('\n');
  };

  picker.append(
    h('option', { value: '' }, 'Load an example…'),
    ...EXAMPLES.map((example, i) => h('option', { value: String(i) }, example.name)),
  );
  picker.addEventListener('change', () => {
    if (picker.value) load(EXAMPLES[Number(picker.value)]);
    picker.value = '';
  });
  load(EXAMPLES[0]);

  return {
    /** The case as written: its name (or its first step) and its steps. */
    read() {
      const lines = parseSteps(steps.value);
      return { name: name.value.trim() || lines[0] || 'Test', lines };
    },

    /** Dictation adds to the case rather than replacing it, so a tester can record it in pieces. */
    append(lines) {
      if (!lines.length) return;
      const existing = steps.value.trim();
      steps.value = `${existing ? `${existing}\n` : ''}${lines.join('\n')}\n`;
      steps.scrollTop = steps.scrollHeight;
    },
  };
}
