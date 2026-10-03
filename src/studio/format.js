/** How the studio prints tool calls, and reads a test case out of the editor. */

/** `name(key: "value", …)` for a call `{name, arguments}`. */
export const signature = (call) => {
  const args = Object.entries(call.arguments || {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `${call.name}(${args.join(', ')})`;
};

/** A list of calls, either `{name, arguments}` or the suite's `[name, arguments]` pairs; `[]` when empty. */
export const formatCalls = (calls) =>
  calls.length ? calls.map((c) => signature(Array.isArray(c) ? { name: c[0], arguments: c[1] } : c)).join(' · ') : '[]';

/** The steps of a written case: one per non-empty line, `#` lines are comments. */
export const parseSteps = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
