# Needle Test Studio

Plain-English test cases, run by an on-device agent. Write a manual test one step per line (or say
it), and Cactus Needle 3 turns each step into a tool call that drives a real app, Acme Admin,
in the browser. Speech runs on Cactus Whistle on the same CPU. Nothing leaves the tab.

The studio has three tabs:

- **App under test**: Acme Admin in a frame, with the agent's cursor drawn over it as it clicks,
  types, selects and checks.
- **Needle suite**: the environment's 32 frozen cases, listed up front and scored live.
- **Whistle**: the speech model on its own: clips, files, live streaming, word timings and
  speech embeddings.

## Quick start

Node 22.18 or later (the scripts are TypeScript that Node runs directly).

```sh
npm install
npm run dev        # studio at http://localhost:5173, Acme Admin at /sandbox/
```

The first visit downloads the two models from Hugging Face (Needle 3, 35.3 MB; Whistle, 16.9 MB),
checks their SHA-256 and caches them, so later visits start in a few seconds.

| Command                                                | What it does                                                |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                                          | Dev server                                                  |
| `npm run build`                                        | Typecheck, then build both pages into `dist/`               |
| `npm run preview`                                      | Serve `dist/` at http://localhost:4173                      |
| `npm test`                                             | Vitest unit tests                                           |
| `npm run lint`                                         | oxlint                                                      |
| `npm run format`                                       | Prettier (everything but `vendor/`)                         |
| `npm run suite -- --dump /tmp/acme.json`               | The 32-case suite on the wasm engine in Node (min conf 0.5) |
| `.venv/bin/python scripts/reference.py /tmp/acme.json` | The same inputs through the `cactus-needle` Python package  |
| `npm run speech-check -- clip.wav`                     | Whistle on a 16 kHz mono WAV, with keyword bias             |

The Node scripts download the pinned archives into `.ref/` on first run and check their SHA-256.
`src/runtime/models.ts` holds the pins, shared with the browser.

## How a case runs

1. Each step is decoded by Needle 3 under a grammar built from all thirteen Acme Admin tools
   (`src/acme/tools.ts`), with enums filled from the app's live state: its users, pages, roles,
   settings and messages.
2. A gate decides: act at or above confidence 0.5, ask you below it or when the engine withheld
   the call, refuse when there is no call. Negated or ungrounded calls are refused. `remove_user`
   needs 0.9; above that the written step counts as your confirmation.
3. The driver (`src/acme/driver.ts`) carries the call out through the app's real controls, and
   the step is checked against what the app shows.

The steps appear as a live timeline: three dots while Needle decides, the decoded call typed out
with a confidence ring, then a check or a cross. The header orb shows whether the agent is
thinking, acting, listening or waiting.

### Tool design notes

- **Constraints in the grammar**: `minLength` and an email `pattern` make an empty password or a
  non-address impossible to decode, so a step that lacks one is withheld, not guessed.
- **Triggers** route phrasings that descriptions can't separate: verify steps to a check, the two
  on/off settings, and sign-in. They use only negative lookaheads and step aside for multi-action
  steps.
- **All thirteen tools are declared every turn.** An embedding shortlist of five was tried and
  removed: it left the right tool out. The cost is that a step which changes the app's users
  changes the enums, and the engine re-reads every schema (about 4.6 s against 2.2 s for five),
  so a toast check also accepts a message that appeared after the last action and has faded.
- Only invited or removed users join `check_user`'s enum: with `admin@acme.com` in the schema,
  "invite Eve Stone" came back with role `admin`.

## The suite

`src/acme/cases.ts` holds 32 cases in six categories: exact calls, a missing required value, no
matching tool, negation, an out-of-range value, and two calls from one request. They are scored
like `run_tests`: whole calls compared, at least 29 must pass, and any missing, negated or
out-of-range case is critical, so one miss there fails the suite. The suite tab lists every case
with its expected call before a run and fills in Needle 3's answer as it goes.

## Whistle

Whistle needs `needle_transcribe`, which the pinned tool-calling build (`b274efc`) doesn't export.
The build that does (`c7c415a`) scores only 24/32 on the suite because of deflated confidence, so
the two engines are kept apart: one Emscripten instance per worker, each with its own model.

- **Dictation**: the Dictate button records up to 30 s, and pauses of 0.65 s or more between
  words (or sentence-final punctuation) split the transcript into steps. Keywords come from the
  app's live state, so names survive: "Chen Wei" decodes as _Chen way_ without them. The language
  is fixed to English, and clips under -40 dBFS count as silence, since an idle microphone once
  decoded as a confident Spanish sentence.
- **Whistle tab**: record a clip (one pass, up to 30 s), stream the microphone live with no limit,
  or upload a file of any length. The language is detected unless you pick one, and keywords
  (comma-separated) bias the search. Every word comes back with its start, end and probability;
  click one to play from there, and low-probability words are underlined.
- **Live streaming** (`src/speech/stream.ts`): the wasm build has no streaming API, so the stream
  re-transcribes a window of recent audio each second and commits a word once two passes agree on
  it. The window keeps already-committed audio as context (cutting right after a committed word
  makes the next word misheard) and is trimmed at sentence ends, so passes stay short however long
  the stream runs. Files longer than 30 s go through the same stream.
- **Speech embeddings** (`needle_embed`): 512 floats per 80 ms frame. Clips are compared by the
  cosine of their mean-pooled frames, without decoding a transcript.

## Results

- **Suite (Node)**: 32/32 at min confidence 0.5, no critical failures. At 0 it is 31/32:
  "sign in as admin@acme.com" decodes `password: "sign"` at 0.23, which the 0.5 gate turns into a
  question.
- **Reference**: all 32 cases give identical calls on the wasm engine and the official Python
  package (`cactus-needle` 3.0.3).
- **Browser**: five of the six example cases pass with no step needing review. "Turn off
  two-factor" stops at 'Confirm "Settings saved" appears', which decodes `[]` at 0.14. The
  browser's facts carry the live clock, and one suite case ("invite Eve Stone") can flip its role
  at some minutes, so the suite tab can show 31/32; the Node suite pins the time and is stable.
- **Whistle**: a 1.3 s clip transcribes in about 80 ms; a 32 s file in 13 windowed passes
  (slowest 554 ms); a live stream keeps up at one pass a second. The same sentence in two voices
  embeds at cosine 0.88, against 0.55 to 0.59 for a different sentence.

## Layout

A Vite + React + TypeScript project with two pages. Domain logic is plain TypeScript; React owns
only views and their state.

```
index.html               the studio            → src/studio/main.tsx
sandbox/index.html       Acme Admin (in a frame) → src/sandbox/main.tsx
src/studio/              the studio: App.tsx, engines.ts, components/, components/agent/, hooks/, lib/
src/sandbox/             Acme Admin, the app under test
src/acme/                the environment: tools.ts, cases.ts, driver.ts
src/engine/              Needle 3: binding and gate, worker, client
src/speech/              Whistle: binding, streaming, embeddings, recorder, worker, client
src/runtime/             shared by both workers and the Node scripts: model pins, heap, protocol
vendor/needle3-<rev>/    the two Emscripten builds, untouched, plus a needle.d.ts each
scripts/                 suite.ts, speech-check.ts, reference.py
*.test.ts                unit tests, next to the code they cover
```

- The vendored `needle.js` files are CommonJS scripts. A small Vite plugin (`vite.config.ts`)
  serves them to the browser as ES modules without changing them on disk; Node loads them as
  CommonJS through `vendor/package.json`.
- Both builds name their binary `needle.wasm` and would load the same file, so each worker
  fetches its own build's bytes and passes them in (`src/runtime/engine-worker.ts`).
- The driver sets field values through the element prototype's setter, the way typing does,
  because React ignores values assigned directly to a controlled input. In the studio it pauses
  320 ms before each action and types a character at a time, so the cursor can be seen working.
- The studio uses the Park UI theme: Outfit, the Sage gray scale (dark), a white accent on black,
  and small radii. Motion is reduced to a single frame under `prefers-reduced-motion`.

## Deploying

`npm run build` writes static files to `dist/` (Vercel: preset "Vite"; Netlify: build
`npm run build`, publish `dist`). Both pages are served from the site root, `/` and `/sandbox/`.

The microphone needs a secure context, so dictation and recording work on `https` and on
`localhost`; file upload and everything else work anywhere.

Don't bump the engine without re-running the suite. The `needle.wasm` published on 2026-09-28
(revision `27c0a9a`, same weights) decodes the same calls but reports much lower confidence, so
the suite fails at every threshold.
