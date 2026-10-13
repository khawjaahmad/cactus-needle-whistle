/** The microphone, for dictation and the Whistle tab. */
import { MAX_SECONDS, SAMPLE_RATE } from './core.ts';
import workletUrl from './pcm-worklet.ts?worker&url';

export interface Recording {
  /** Stops and releases the microphone; resolves to 16 kHz mono PCM. */
  stop(): Promise<Float32Array>;
  /** Resolves when the cap is reached, so the caller can close its own UI. */
  full: Promise<void>;
}

const CHUNK_SECONDS = 1;

interface RecordOptions {
  /** (peak: 0..1, seconds) for the meter and the countdown */
  onLevel?: (peak: number, seconds: number) => void;
  /** Live: called with each second of 16 kHz audio, in order, and with the remainder on stop. */
  onChunk?: (pcm: Float32Array) => void;
  /** Stops collecting here; Infinity for a live recording. */
  maxSeconds?: number;
}

/** Opens the microphone and collects samples until stop() or `maxSeconds`. */
export async function record({ onLevel, onChunk, maxSeconds = MAX_SECONDS }: RecordOptions = {}) {
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

  const rate = context.sampleRate;
  const cap = Math.ceil(rate * maxSeconds);
  const source = context.createMediaStreamSource(stream);
  const collector = new AudioWorkletNode(context, 'pcm-collector');
  const frames: Float32Array[] = [];
  let samples = 0;
  let chunk: Float32Array[] = [];
  let chunked = 0;
  let delivered = Promise.resolve();
  const deliver = () => {
    if (!onChunk || !chunk.length) return;
    const pcm = join(chunk, chunked);
    chunk = [];
    chunked = 0;
    delivered = delivered.then(async () => onChunk(rate === SAMPLE_RATE ? pcm : await resample(pcm, rate)));
  };
  let reachedCap = () => {};
  const full = new Promise<void>((resolve) => {
    reachedCap = resolve;
  });

  collector.port.onmessage = ({ data }: MessageEvent<{ frame: Float32Array; peak: number }>) => {
    if (samples >= cap) return;
    frames.push(data.frame);
    samples += data.frame.length;
    if (onChunk) {
      chunk.push(data.frame);
      chunked += data.frame.length;
      if (chunked >= rate * CHUNK_SECONDS) deliver();
    }
    onLevel?.(data.peak, samples / rate);
    if (samples >= cap) reachedCap();
  };
  source.connect(collector);
  const mute = new GainNode(context, { gain: 0 });
  collector.connect(mute).connect(context.destination);

  async function stop() {
    collector.port.onmessage = null;
    source.disconnect();
    collector.disconnect();
    deliver();
    await delivered;
    const pcm = join(frames, Math.min(samples, cap));
    await release();
    return rate === SAMPLE_RATE ? pcm : resample(pcm, rate);
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
export async function resample(pcm: Float32Array<ArrayBuffer>, from: number) {
  const length = Math.round((pcm.length * SAMPLE_RATE) / from);
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const buffer = new AudioBuffer({ length: pcm.length, sampleRate: from, numberOfChannels: 1 });
  buffer.copyToChannel(pcm, 0);
  const source = new AudioBufferSourceNode(offline, { buffer });
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}
