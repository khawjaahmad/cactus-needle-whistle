/** The test case being written: its name and its steps. */
import { useCallback, useRef, useState } from 'react';
import type { Example } from '../lib/examples.ts';
import { parseSteps } from '../lib/format.ts';

export type CaseDraft = ReturnType<typeof useCaseDraft>;

export function useCaseDraft(initial: Example) {
  const [name, setName] = useState(initial.name);
  const [steps, setSteps] = useState(initial.steps.join('\n'));
  const stepsRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback((example: Example) => {
    setName(example.name);
    setSteps(example.steps.join('\n'));
  }, []);

  /** Dictation adds to the case rather than replacing it, so a tester can record it in pieces. */
  const append = useCallback((lines: string[]) => {
    if (!lines.length) return;
    setSteps((current) => {
      const existing = current.trim();
      return `${existing ? `${existing}\n` : ''}${lines.join('\n')}\n`;
    });
    requestAnimationFrame(() => {
      const el = stepsRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  /** The case as written: its name (or its first step) and its steps. */
  const read = () => {
    const lines = parseSteps(steps);
    return { name: name.trim() || lines[0] || 'Test', lines };
  };

  return { name, setName, steps, setSteps, stepsRef, load, append, read };
}
