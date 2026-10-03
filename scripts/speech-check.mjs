/*
 * Runs Whistle on the vendored wasm speech engine, the way src/speech/worker.js does, and prints
 * the transcript and the steps it splits into. The browser fetches whistle.cact from Hugging
 * Face; this caches it under .ref/ instead.
 *
 *     node scripts/speech-check.mjs [--bias] clip.wav [more.wav…]   # 16 kHz mono WAV
 *
 * --bias passes Acme Admin's live vocabulary as keywords, as the studio does, and prints the
 * transcript with and without it.
 *
 * Make a clip with macOS `say`, pausing between steps the way a tester would:
 *     say "Open settings. [[slnc 700]] Verify two-factor is off." -o raw.aiff
 *     afconvert -f WAVE -d LEI16@16000 -c 1 raw.aiff clip.wav
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SEED, vocabulary } from '../src/acme/tools.js';
import { Models, engineFor, weights } from './lib/weights.mjs';

const require = createRequire(import.meta.url);
const { createSpeechEngine, toSteps, SAMPLE_RATE, MAX_SECONDS } = require('../src/speech/core.js');

const args = process.argv.slice(2);
const bias = args.includes('--bias');
const clips = args.filter((a) => !a.startsWith('--'));
if (!clips.length) {
  console.error('usage: node scripts/speech-check.mjs [--bias] clip.wav [more.wav…]');
  process.exit(2);
}

/** 16 kHz mono PCM from a WAV, the only format needle_transcribe takes. */
function readWav(path) {
  const buf = readFileSync(path);
  const fmt = buf.indexOf('fmt ', 12, 'ascii');
  const channels = buf.readUInt16LE(fmt + 10);
  const rate = buf.readUInt32LE(fmt + 12);
  const bits = buf.readUInt16LE(fmt + 22);
  if (channels !== 1 || rate !== SAMPLE_RATE || bits !== 16) {
    throw new Error(`${path}: need 16 kHz mono 16-bit, got ${rate} Hz, ${channels} ch, ${bits}-bit`);
  }
  const data = buf.indexOf('data', fmt, 'ascii');
  const count = buf.readUInt32LE(data + 4) / 2;
  const pcm = new Float32Array(count);
  for (let i = 0; i < count; i += 1) pcm[i] = buf.readInt16LE(data + 8 + i * 2) / 32768;
  return pcm;
}

const createNeedle = engineFor(Models.WHISTLE);
const engine = createSpeechEngine(await createNeedle(), await weights(Models.WHISTLE));
let failed = 0;

for (const clip of clips) {
  const pcm = readWav(clip);
  const seconds = pcm.length / SAMPLE_RATE;
  if (seconds > MAX_SECONDS) {
    console.error(`${clip}: ${seconds.toFixed(1)} s is over Whistle's ${MAX_SECONDS} s single pass`);
    failed += 1;
    continue;
  }
  const started = performance.now();
  const plain = engine.transcribe(pcm);
  const elapsed = performance.now() - started;
  // With --bias, the steps come from the biased pass, which is the one the studio runs.
  const result = bias ? engine.transcribe(pcm, { keywords: vocabulary(SEED).join('\n') }) : plain;
  const steps = toSteps(result);

  console.log(
    `\n${clip}  ${seconds.toFixed(2)} s · ${elapsed.toFixed(0)} ms` +
      ` · ttft ${plain.ttft_ms.toFixed(0)} ms · ${plain.decode_tps.toFixed(0)} tok/s · ${plain.language || 'silence'}`,
  );
  console.log(`  text   ${JSON.stringify(plain.text)}`);
  if (bias) console.log(`  biased ${JSON.stringify(result.text)}`);
  steps.forEach((step, i) => console.log(`  step ${i + 1}  ${step}`));
  if (!steps.length) console.log('  (no speech)');
}

process.exit(failed ? 1 : 0);
