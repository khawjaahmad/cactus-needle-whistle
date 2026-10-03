/*
 * The microphone, for dictation. Whistle wants 16 kHz mono float PCM and takes at most 30 s in
 * one pass, so the AudioContext is opened at 16 kHz and the recording stops itself at the cap
 * rather than sending a clip the engine would reject.
 */
import { MAX_SECONDS, SAMPLE_RATE } from './core.ts';
import workletUrl from './pcm-worklet.ts?worker&url';

export interface Recording {
  /** Stops and releases the microphone; resolves to 16 kHz mono PCM. */
  stop(): Promise<Float32Array>;
  /** Resolves when the cap is reached, so the caller can close its own UI. */
  full: Promise<void>;
}

/**
 * Opens the microphone and collects samples until stop(), or until the 30 s Whistle takes in one
 * pass.
 *
 * @param onLevel  (peak: 0..1, seconds) for the meter and the countdown
 */
export async function record({ onLevel }: { onLevel?: (peak: number, seconds: number) => void } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  const release = async () => {
    stream.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => {});
  };

  try {
    await context.audioWorklet.addModule(workletUrl);
  } catch (error) {
    await release();
    throw error;
  }

  const cap = Math.ceil(context.sampleRate * MAX_SECONDS);
  const source = context.createMediaStreamSource(stream);
  const collector = new AudioWorkletNode(context, 'pcm-collector');
  const frames: Float32Array[] = [];
  let samples = 0;
  let reachedCap = () => {};
  const full = new Promise<void>((resolve) => {
    reachedCap = resolve;
  });

  collector.port.onmessage = ({ data }: MessageEvent<{ frame: Float32Array; peak: number }>) => {
    if (samples >= cap) return;
    frames.push(data.frame);
    samples += data.frame.length;
    onLevel?.(data.peak, samples / context.sampleRate);
    if (samples >= cap) reachedCap();
  };
  source.connect(collector);
  // A zero-gain sink keeps the graph pulling without putting the microphone through the speakers.
  const mute = new GainNode(context, { gain: 0 });
  collector.connect(mute).connect(context.destination);

  async function stop() {
    collector.port.onmessage = null;
    source.disconnect();
    collector.disconnect();
    const captured = context.sampleRate;
    const pcm = join(frames, Math.min(samples, cap));
    await release();
    return captured === SAMPLE_RATE ? pcm : resample(pcm, captured);
  }

  return { stop, full } satisfies Recording;
}

function join(frames: Float32Array[], total: number) {
  const pcm = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    const room = total - offset;
    if (room <= 0) break;
    pcm.set(room < frame.length ? frame.subarray(0, room) : frame, offset);
    offset += frame.length;
  }
  return pcm;
}

/** A browser that would not open the context at 16 kHz still has to hand Whistle 16 kHz. */
async function resample(pcm: Float32Array<ArrayBuffer>, from: number) {
  const length = Math.round((pcm.length * SAMPLE_RATE) / from);
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const buffer = new AudioBuffer({ length: pcm.length, sampleRate: from, numberOfChannels: 1 });
  buffer.copyToChannel(pcm, 0);
  const source = new AudioBufferSourceNode(offline, { buffer });
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}
