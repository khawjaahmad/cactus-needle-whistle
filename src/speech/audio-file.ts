/** Any audio file the browser can decode, as the 16 kHz mono float PCM Whistle takes. */
import { SAMPLE_RATE } from './core.ts';

export async function decodeAudioFile(file: Blob) {
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    buffer.getChannelData(c).forEach((sample, i) => (mono[i] += sample / buffer.numberOfChannels));
  }
  return mono;
}
