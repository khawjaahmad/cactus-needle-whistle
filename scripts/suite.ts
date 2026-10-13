/** Runs the 32-case Acme Admin suite on the wasm engine, the way the studio does. */
import { writeFileSync } from 'node:fs';
import { PASS_BAR, SEEN, TEST_CASES, matches, scored, suitePasses } from '../src/acme/cases.ts';
import { SEED, SYSTEM, acmeTools } from '../src/acme/tools.ts';
import { createEngine, loadCatalog } from '../src/engine/core.ts';
import { NEEDLE3 } from '../src/runtime/models.ts';
import createNeedle from '../vendor/needle3-b274efc/needle.js';
import { weights } from './lib/weights.ts';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const minConfidence = Number(arg('--min-confidence') ?? 0);
const dumpPath = arg('--dump');

const engine = createEngine(await createNeedle(), await weights(NEEDLE3));
const tools = loadCatalog(acmeTools(SEED, SEEN)).map((t) => t.schema);

let passed = 0;
const criticalFailures: string[] = [];
const dump = [];
for (const [request, want, { critical } = {}] of TEST_CASES) {
  if (!engine.bind(SYSTEM, JSON.stringify(tools))) engine.reset();
  const response = engine.complete(request);
  const got = scored(response, minConfidence);
  const ok = matches(got, want);
  passed += Number(ok);
  if (!ok && critical) criticalFailures.push(request);
  dump.push({ request, want, tools, response });

  const verdict = ok ? 'ok  ' : critical ? 'CRIT' : 'FAIL';
  const conf = response.confidence == null ? null : response.confidence.toFixed(2);
  const why = ok
    ? ''
    : `  held=${JSON.stringify(response.suppressed_calls)} validation=${JSON.stringify(response.validation)}`;
  console.log(`${verdict} ${JSON.stringify(request).padEnd(52)} conf=${conf} -> ${JSON.stringify(got)}${why}`);
}

const pass = suitePasses(passed, criticalFailures.length);
console.log(
  `\n${passed}/${TEST_CASES.length} passed at min_confidence=${minConfidence}, ` +
    `${criticalFailures.length} critical failures (bar ${PASS_BAR}): ${pass ? 'PASS' : 'FAIL'}`,
);

if (dumpPath) writeFileSync(dumpPath, JSON.stringify({ system: SYSTEM, minConfidence, cases: dump }));
process.exit(pass ? 0 : 1);
