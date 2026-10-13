/** Transcribes 16 kHz mono WAV clips with Whistle and prints the text and the steps. */
import { readFileSync } from 'node:fs';
import { SEED, vocabulary } from '../src/acme/tools.ts';
import { WHISTLE } from '../src/runtime/models.ts';
import { MAX_SECONDS, SAMPLE_RATE, createSpeechEngine, toSteps } from '../src/speech/core.ts';
import createNeedle from '../vendor/needle3-c7c415a/needle.js';
import { weights } from './lib/weights.ts';

const args = process.argv.slice(2);
const bias = args.includes('--bias');
const clips = args.filter((a) => !a.startsWith('--'));
if (!clips.length) {
  console.error('usage: node scripts/speech-check.ts [--bias] clip.wav [more.wav…]');
  process.exit(2);
}

/** 16 kHz mono PCM from a WAV, the only format needle_transcribe takes. */
function readWav(path: string) {
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

const engine = createSpeechEngine(await createNeedle(), await weights(WHISTLE));
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
