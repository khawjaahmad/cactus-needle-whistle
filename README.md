# Needle Test Studio: plain-English tests on Cactus Needle 3

A manual test case, written one step per line, runs against a real app (Acme Admin, in a frame)
with Needle 3 in the browser on the official `wasm` engine. Each step is decoded under a grammar
built from all of the app's tool schemas and gated by confidence before it touches the app. A passing run exports a Playwright spec that repeats it
without the model.

A case can also be dictated: Cactus Whistle transcribes it on the same CPU, in the browser, and
the pauses between spoken steps become the lines.

```sh
npm install                                               # Prettier only; the app has no build step
npm start                                                 # serves the studio at http://localhost:8765
npm test                                                  # unit tests for the gate, scoring, dictation split, specs
npm run suite -- --dump /tmp/acme.json                    # 32-case suite on the wasm engine (min_confidence 0.5)
.venv/bin/python scripts/reference.py /tmp/acme.json      # same inputs through the Python package
npm run speech-check -- clip.wav                          # Whistle on a 16 kHz mono clip, with keyword bias
npm run format                                            # Prettier over everything but vendor/
```

The Node scripts download the pinned archives into `.ref/` on first run and check their SHA-256
(`src/runtime/models.js` holds the pins the browser uses too).

## How it uses Needle 3 (needle3-context.md, "How to Design Tools for Needle 3")

- **The toolset is the product** (`src/acme/tools.js`): one tool per Acme Admin action and check
  (`sign_in`, `invite_user`, `remove_user`, `set_two_factor`, `check_user`…). Closed sets are enums
  filled from the app's live state (its users, its message catalogue); free text is copied
  verbatim with its format in the description; polar pairs are one on/off enum.
- **Constraints in the grammar**: `minLength` and an email `pattern` make an empty password or a
  non-address impossible to decode, so a step that doesn't give one is withheld, not guessed.
- **Triggers** (§9) where descriptions can't separate phrasings: verify steps reach a check (each
  check owns its nouns), the two on/off settings, and sign-in. They use only negative lookaheads
  and step aside when a step asks for several actions.
- **All thirteen tools declared every turn.** This engine puts every declared tool into the
  prompt: `needle_init`'s prefix grows from 442 tokens at five tools to 1,060 at thirteen, and
  `config.json` lists only a confidence head, so nothing is retrieved. Thirteen is well under the
  roughly two dozen where the porting guide says accuracy falls. An embedding shortlist of five
  was used before and removed: it left the right tool out ("remove a user" decoded `sign_out`,
  "invite Eve Stone" lost the name). The cost: when a step changes the app's users, the enums
  change and the engine re-reads every schema, about 4.6 s for thirteen tools against 2.2 s for
  five (measured in Node). A check for a toast therefore also accepts a message that appeared after
  the last action and has since faded (`src/acme/driver.js`); the exported spec still asserts it is
  visible. Only invited or removed users join `check_user`'s enum: with the sign-in email
  `admin@acme.com` in the schema, "invite Eve Stone" came back with role `admin`.
  **Facts, not instructions** (§8).
- **The docs' routing** (§6): act at or above 0.5, show the call and ask below it or when the
  engine withheld it, refuse on `[]`. Like the package's `run()`, a call the engine flags as
  negated or ungrounded is refused, and so is a turn with `success: false`.
- **One deliberate departure**: `remove_user` needs 0.9, and the docs pair that bar with a
  confirmation. In a test case the written step ("Remove bob@acme.com") is the tester's
  confirmation, so above 0.9 it runs unattended; below it the studio asks.
- **Test the environment, not a demo prompt**: `src/acme/cases.js` is a frozen 32-case suite in the six
  categories `needle.environments` uses, scored like `run_tests`: whole calls compared, and every
  missing, negated and out-of-range case is critical, so one miss fails the suite. The studio runs
  it live too.

## Dictating a case (Cactus Whistle)

- **Two engines, not one.** Whistle needs `needle_transcribe`, which the pinned `b274efc` build
  doesn't export. The build that does (`c7c415a`, vendored in `vendor/needle3-c7c415a/`) scores **24/32** on the
  frozen suite at 0.5 against the pin's 32/32 — the same deflated confidence the HF engine showed
  (a correct `check_message` at 0.01). The studio's gate is built on calibrated confidence, so
  the speech build is kept to speech: `src/speech/worker.js` loads `whistle.cact` (16.9 MB, revision
  `b358dda`, SHA-256 checked and cached) into its own Emscripten instance, and tool decoding
  stays on the pinned engine in `src/engine/worker.js`. `needle.h` makes each model process-global, so one
  engine per worker is what keeps them apart.
- **Both builds call their binary `needle.wasm`**, and this one resolves that name against the
  worker's directory rather than the script it came from, so left alone it instantiates the
  tool-calling binary against the speech engine's JS. The exports line up by position and nothing
  throws: `needle_last_error` binds to a function wanting an i64 and `malloc` returns the same
  pointer every call. Both workers therefore fetch their own build's bytes and pass `wasmBinary`
  (`src/runtime/engine-worker.js`); the builds also ignore `Module.locateFile`.
- **Word timestamps are the step split** (`src/speech/core.js`): a gap of 0.65 s or more between words
  ends a step, as does sentence-final punctuation, so a dictated case arrives as lines rather than
  one paragraph. Dictation appends, so a case can be recorded in pieces.
- **Keyword biasing comes from the live app state** — the same `src/acme/tools.js` source the enums
  are built from (`vocabulary()`): user names and emails, the pages, roles, settings and message
  catalogue. It is what makes a name survive the search: "Invite Chen Wei as an editor" decodes as
  _Chen way_ unbiased and _Chen Wei_ biased.
- **Bounds the model sets**: 16 kHz mono, at most 30 s in one pass, so the recorder opens the
  AudioContext at 16 kHz (resampling only if a browser refuses), counts down, and stops itself at
  30 s.
- **Room tone is not silence.** Digital silence does come back empty, but four seconds of an idle
  office microphone decoded as a confident Spanish sentence. Two guards: the language is named
  `en` rather than detected, since the steps, tools and enums all are, and a clip under -40 dBFS
  is reported as nothing said instead of being transcribed. The floor is measured, not guessed —
  that room was -54 dBFS against -16 for speech.

## Results

- Suite: **32/32 at min_confidence 0.5, no critical failures.** At 0 it is 31/32 and fails one
  critical case: the `sign_in` trigger forces a call for "sign in as admin@acme.com", which
  decodes `password: "sign"` at 0.23. The docs say a triggered tool always produces a call and the
  score decides; the 0.5 gate turns it into a question.
- Reference: **32/32 cases give identical calls** on the wasm engine and the official Python
  package (`cactus-needle` 3.0.3) fed the same tools, facts and text.
- Six example test cases pass in the browser with no step needing review; their exported specs
  pass in Playwright, and a broken copy fails.
- Whistle: a 12.6 s dictation of a four-step case transcribes in **639 ms** (243 ms to first
  token, 176 tok/s) in Chrome and splits into its four steps; the same clip gives the same four
  steps in Node. A 4.5 s clip takes 252 ms. The suite is still 32/32 with the speech engine in
  the page.

## Layout

Static files served from the repository root; each folder owns one concern.

```
index.html, styles/studio.css    the studio page and its styles
src/studio/                      studio UI (ES modules)
  main.js                        wiring only: engines, app frame, panels
  case-runner.js, step-row.js    runs a written case step by step; one row per step
  suite-runner.js                the 32-case suite in the browser
  dictation-panel.js             Dictate button, level meter, transcript into the editor
  editor.js, examples.js         test case editor and its examples
  spec.js, spec-panel.js         Playwright spec from a passing run; copy and download
  session.js, status.js, tabs.js busy/recording state, status lines, output tabs
  format.js                      call signatures and step parsing
src/engine/                      Needle 3: core.js (binding + gate), worker.js, agent.js (client)
src/speech/                      Whistle: core.js (binding + step split), worker.js, dictation.js
                                 (client), recorder.js + pcm-worklet.js (microphone)
src/runtime/                     shared by both workers and the Node scripts: models.js (pins),
                                 wasm-heap.js (heap strings), engine-worker.js (boot, download,
                                 message protocol)
src/shared/                      dom.js (`h`), worker-client.js (page side of the protocol)
src/acme/                        the environment: tools.js, cases.js, driver.js
sandbox/                         Acme Admin, the app under test: app.js, store.js, styles.css
vendor/needle3-<rev>/            the two Emscripten builds, untouched
scripts/                         suite.mjs, speech-check.mjs, reference.py, lib/weights.mjs
tests/                           node:test unit tests
```

`engine/core.js`, `speech/core.js` and `runtime/*.js` are plain scripts (UMD) rather than modules,
so the classic workers can `importScripts()` them and Node can `require()` them. For that reason
the root `package.json` has no `"type": "module"`; `src/acme/` and `src/studio/`, the ES modules
Node imports, declare it in their own `package.json`.

## Deploying

Static files, no build step (Vercel: the repository root, preset "Other"; Netlify: publish
the repository root). The engine is vendored from `Cactus-Compute/needle3` at revision `b274efc`; the 35.3 MB
`needle3.cact` is fetched from the same revision on first visit, SHA-256 checked and cached.
`vendor/needle3-c7c415a/` is the same repo at `c7c415a` and fetches `whistle.cact` the same way. Dictation needs
a secure context for `getUserMedia`, so it is there on `https` and on `localhost` and absent
elsewhere; everything else works without it.
Don't bump the engine without re-running the suite. The `needle.wasm` Hugging Face published on
2026-09-28 (revision `27c0a9a`, same weights) decodes the same calls but reports much lower
confidence (a correct `check_message` at 0.01), so the suite fails at every threshold: 25/32 at
0.5, and 31/32 with the same critical miss as the pinned engine at 0. The browser build's `needle.h` declares
`needle_last_error()`, but `needle.js` doesn't export it, so a prefix overflow can't report its
token counts.
