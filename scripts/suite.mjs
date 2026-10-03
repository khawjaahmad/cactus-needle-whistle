/*
 * Runs the Acme Admin suite (src/acme/cases.js) on the wasm engine the way the studio does: every
 * tool declared, one fresh turn per case. Scores like run_tests (§11).
 *
 *     node scripts/suite.mjs [--min-confidence 0.5] [--dump cases.json]
 *
 * --dump writes each case's bound tools and response, for scripts/reference.py to replay through
 * the official Python package. Exits 0 on run_tests' rule: at least 29 of 32 pass and no critical
 * case fails.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PASS_BAR, SEEN, TEST_CASES, matches, scored, suitePasses } from '../src/acme/cases.js';
import { SEED, SYSTEM, acmeTools } from '../src/acme/tools.js';
import { Models, engineFor, weights } from './lib/weights.mjs';

const require = createRequire(import.meta.url);
const { createEngine, loadCatalog } = require('../src/engine/core.js');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const minConfidence = Number(arg('--min-confidence') ?? 0);
const dumpPath = arg('--dump');

const createNeedle = engineFor(Models.NEEDLE3);
const engine = createEngine(await createNeedle(), await weights(Models.NEEDLE3));
const tools = loadCatalog(acmeTools(SEED, SEEN)).map((t) => t.schema);

let passed = 0;
const criticalFailures = [];
const dump = [];
for (const [request, want, { critical } = {}] of TEST_CASES) {
  if (!engine.bind(SYSTEM, JSON.stringify(tools))) engine.reset();
  const response = engine.complete(request);
  const got = scored(response, minConfidence);
  const ok = matches(got, want);
  passed += ok;
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
