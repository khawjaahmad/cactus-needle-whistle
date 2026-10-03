import type { CaseDraft } from '../hooks/useCaseDraft.ts';
import { EXAMPLES } from '../lib/examples.ts';

/** The test case: its name, one step per line, and the examples it can load. */
export function CaseEditor({ draft }: { draft: CaseDraft }) {
  const { stepsRef } = draft;
  return (
    <>
      <div className="row spread">
        <label className="label" htmlFor="example">
          Test case
        </label>
        <select
          id="example"
          aria-label="Load an example test case"
          value=""
          onChange={(e) => e.target.value && draft.load(EXAMPLES[Number(e.target.value)])}
        >
          <option value="">Load an example…</option>
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
        value={draft.steps}
        onChange={(e) => draft.setSteps(e.target.value)}
      />
      <div className="meta">
        One step per line, the way you'd write a manual test. Needle 3 maps each to one of Acme Admin's actions or
        checks. Login: admin@acme.com / Passw0rd!
      </div>
    </>
  );
}
