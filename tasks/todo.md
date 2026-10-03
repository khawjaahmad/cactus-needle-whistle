# Refactor: modular layout, separation of concerns, formatting

## Goal / acceptance criteria

- Behaviour unchanged: the suite gives identical engine responses to the baseline (32/32 at 0.5),
  speech-check gives the same transcript/steps, the studio runs the examples in a browser and
  exports the same Playwright spec.
- Layout by concern: studio UI, Needle engine, Whistle speech, Acme environment, shared runtime,
  vendored builds, Node scripts, styles out of HTML.
- Duplicated code collapsed: worker clients, worker boot + weight download, heap string helpers,
  model pins (were copied into speech-check.mjs).
- Consistent formatting (Prettier), unit tests for the pure logic.

## Plan

- [x] Back up original to scratchpad; baseline suite (32/32, dump) and speech-check output
- [x] Move vendored engines to vendor/needle3-<rev>/, load wasm by bytes in both workers
- [x] src/runtime: models.js (pins), wasm-heap.js, engine-worker.js (boot, weights, protocol)
- [x] src/engine (core, worker, agent) and src/speech (core, worker, dictation, recorder, worklet)
- [x] src/shared: dom.js, worker-client.js
- [x] Split app.js into src/studio/* modules; CSS to styles/
- [x] sandbox: store.js for persistence, CSS out of HTML, inline styles to classes
- [x] scripts/: suite.mjs, speech-check.mjs, reference.py, lib/weights.mjs (.ref cache)
- [x] package.json scripts, Prettier config, .editorconfig, .gitignore; format
- [x] Unit tests (node:test) for judge, toSteps, isSilent, matches/scored, toSpec, parseSteps
- [x] Verify: unit tests, suite dump == baseline, speech-check == baseline, browser run of examples
- [x] README: layout and commands

## Working notes

- needle.js (both builds) ignores Module.locateFile; scriptDirectory is the worker's dir. Pass
  `wasmBinary` to keep each build on its own binary.
- No "type": "module" in package.json: the UMD cores rely on CommonJS `module.exports` in Node.
- acme-users localStorage key is the contract between sandbox and driver: one constant.

## Results

- Layout: src/{studio,engine,speech,runtime,shared,acme}, sandbox/ (+ store.js, styles.css),
  styles/studio.css, vendor/needle3-{b274efc,c7c415a}, scripts/, tests/. app.js (342 lines) split
  into 12 studio modules; main.js only wires them.
- Deduplicated: worker boot + download + protocol (runtime/engine-worker.js), worker client
  (shared/worker-client.js), heap helpers (runtime/wasm-heap.js), model pins (runtime/models.js),
  Node weight cache (scripts/lib/weights.mjs). Removed unused dom.js `label` and driver `path`.
- Fixed: scripts/suite.mjs pointed at ../../android/... (absent here); now uses .ref/ like
  speech-check. Busy/transcribing flags now reset in `finally`, so a thrown error can't lock the UI.
- Verified: npm test 20/20; suite output identical to the original (32/32 at 0.5, dump responses
  identical); speech-check identical on two clips; in Chrome, 6 examples give the same results as
  the original build and identical Playwright specs (same SHA-256), the suite tab passes 32/32, and
  there are no console errors; prettier --check clean.
- Pre-existing, not changed: example "Turn off two-factor" fails at 'Confirm "Settings saved"
  appears' ([] at 0.14) on both the original and the refactored build; README still says six pass.
