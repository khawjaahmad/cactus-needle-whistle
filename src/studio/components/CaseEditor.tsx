import type { CaseDraft } from '../hooks/useCaseDraft.ts';
import { EXAMPLES } from '../lib/examples.ts';

/** The test case: its name, one step per line, and the examples it can load. */
export function CaseEditor({ draft }: { draft: CaseDraft }) {
  const { stepsRef } = draft;
  return (
    <>
      <div className="row spread">
        <span className="label">Test case</span>
        <select
          id="example"
          aria-label="Load an example test case"
          value=""
          onChange={(e) => e.target.value && draft.load(EXAMPLES[Number(e.target.value)])}
        >
          <option value="">Examples</option>
          {EXAMPLES.map((example, i) => (
            <option key={example.name} value={i}>
              {example.name}
            </option>
          ))}
        </select>
      </div>
      <label className="sr-only" htmlFor="test-name">
        Test name
      </label>
      <input
        id="test-name"
        type="text"
        maxLength={120}
        placeholder="Test name"
        value={draft.name}
        onChange={(e) => draft.setName(e.target.value)}
      />
      <label className="sr-only" htmlFor="steps">
        Steps, one per line
      </label>
      <textarea
        id="steps"
        ref={stepsRef}
        spellCheck={false}
        placeholder="One step per line"
        title="Login: admin@acme.com / Passw0rd!"
        value={draft.steps}
        onChange={(e) => draft.setSteps(e.target.value)}
      />
    </>
  );
}
