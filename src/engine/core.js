/*
 * Needle 3 in the browser: the engine binding and the call gate.
 *
 * A plain script rather than a module, so the Web Worker can importScripts() it and the Node
 * suite (scripts/suite.mjs) can require() it. The gate sets its bar by risk and refuses negated
 * or ungrounded calls, as the package's run() does.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../runtime/wasm-heap.js'));
  else root.NeedleCore = factory(root.WasmHeap);
})(typeof self !== 'undefined' ? self : globalThis, function (WasmHeap) {
  'use strict';

  // needle_complete returns tokens generated, not bytes, and truncates a short buffer silently
  // (needle_jni.cpp), so the response gets room it will never plausibly fill.
  const RESPONSE_CAPACITY = 1 << 18;
  const MAX_NEW_TOKENS = 512;

  // The bar is set by what a wrong action costs (§6).
  const AUTO_THRESHOLD = 0.5;
  const HIGH_RISK_THRESHOLD = 0.9;

  /**
   * Wraps an instantiated Emscripten module around one loaded archive. The engine is a single
   * global, non-thread-safe instance, so exactly one caller (the worker) may own it.
   */
  function createEngine(M, cact) {
    const heap = WasmHeap.createHeap(M);

    // The engine copies the archive during load (android/tools/probes/alias_probe.c).
    const loaded = heap.withBytes(cact, (ptr, length) => M._needle_load(ptr, BigInt(length)));
    if (loaded !== 0) throw new Error(`The engine rejected needle3.cact (code ${loaded}).`);

    const out = M._malloc(RESPONSE_CAPACITY);
    let boundKey = null;

    /** Binds a system turn and toolset; returns true when it re-initialised (a fresh conversation). */
    function bind(system, toolsJson) {
      const key = `${system}\n${toolsJson}`;
      if (boundKey === key) return false;
      M._needle_reset();
      boundKey = null;
      const prefix = heap.withStrings([system || null, toolsJson], (s, t) => M._needle_init(s, t, 0));
      if (prefix < 0) throw new Error('The tools and system facts do not fit the context window.');
      boundKey = key;
      return true;
    }

    function complete(input, maxNewTokens = MAX_NEW_TOKENS) {
      M.HEAPU8.fill(0, out, out + RESPONSE_CAPACITY);
      const rc = heap.withStrings([input], (p) => M._needle_complete(p, maxNewTokens, out, RESPONSE_CAPACITY - 1));
      if (rc < 0) throw new Error('The engine failed to complete this turn.');
      return JSON.parse(heap.readString(out));
    }

    return { bind, complete, reset: () => M._needle_reset() };
  }

  /**
   * Tool entries arrive as `{risk, ...schema}`. `risk` only feeds the gate; the engine sees the
   * rest of the schema, triggers included, and applies the triggers itself (§9).
   */
  function loadCatalog(entries) {
    return entries.map(({ risk, ...schema }) => ({ name: schema.name, schema, risky: risk === 'high' }));
  }

  /**
   * The routing the Needle docs recommend (§6): act when there are calls at or above the bar,
   * show the call and ask when there are calls or withheld calls below it, refuse when there is
   * nothing. The bar is set by what a wrong action costs: 0.5, or 0.9 for tools marked
   * `risk: 'high'`, which also always ask. Calls the engine flags as negated or ungrounded are
   * refused, as the package's run() and run_tests do; calls with no calibrated score are asked about.
   */
  function judge(response, risky = new Set(), threshold = AUTO_THRESHOLD) {
    const validation = response.validation || {};
    const calls = response.function_calls || [];
    const held = response.suppressed_calls || [];
    const ungrounded = validation.ungrounded || [];
    const confidence = response.confidence;
    const isRisky = calls.some((c) => risky.has(c.name));
    const bar = isRisky ? HIGH_RISK_THRESHOLD : threshold;
    const pct = (x) => `${Math.round(x * 100)}%`;
    const ask = (why, shown = calls) => ({ kind: 'confirm', calls: shown, bar, why });
    const refuse = (why) => ({ kind: 'refuse', calls: [], bar, why });

    // e.g. error_code "truncated": the model reached for a value the grammar doesn't allow (an email
    // outside the enum) and ran out of tokens. No call was decoded, so nothing runs.
    if (response.success === false) {
      return refuse(`No call decoded: ${response.error || response.error_code || 'the engine gave no reason'}.`);
    }
    if (!calls.length && !held.length) return refuse('No Acme Admin action covers this step.');
    if (!calls.length) return ask('The engine withheld this call.', held);
    if (validation.negation) return refuse('The engine flagged the step as negated, so nothing runs.');
    if (ungrounded.length) return refuse(`The engine made up ${ungrounded.join(', ')}; the step doesn't give it.`);
    if (confidence == null) return ask('These weights report no calibrated confidence.');
    if (confidence < bar) return ask(`Confidence ${pct(confidence)} is below the ${pct(bar)} bar.`);
    if (isRisky) {
      // `irreversible` lets an unattended test run count the written step as the confirmation.
      return {
        kind: 'confirm',
        irreversible: true,
        calls,
        bar,
        why: `Confidence ${pct(confidence)}, but this can't be undone.`,
      };
    }
    return { kind: 'execute', calls, bar, why: `Confidence ${pct(confidence)} clears the ${pct(bar)} bar.` };
  }

  /**
   * One standalone request against the page's current tools: bind, fresh conversation, decode, gate.
   * Every tool is declared. This engine puts every declared tool into the prompt (the archive has no
   * retrieval head), and Acme Admin's thirteen sit well under the roughly two dozen past which the
   * porting guide says accuracy falls. A shortlist of five, tried before, left the right tool out.
   */
  function runTurn(engine, request, facts, catalog) {
    if (!engine.bind(facts, JSON.stringify(catalog.map((t) => t.schema)))) engine.reset();
    const response = engine.complete(request);
    return { response, verdict: judge(response, new Set(catalog.filter((t) => t.risky).map((t) => t.name))) };
  }

  return { createEngine, loadCatalog, judge, runTurn };
});
