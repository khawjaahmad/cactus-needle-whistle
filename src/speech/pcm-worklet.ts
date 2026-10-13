/** AudioWorklet that posts 16 kHz mono microphone frames and their peak level. */

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;

class PcmCollector extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]) {
    const channel = inputs[0]?.[0];
    if (!channel || !channel.length) return true;

    let peak = 0;
    for (let i = 0; i < channel.length; i += 1) peak = Math.max(peak, Math.abs(channel[i]));
    this.port.postMessage({ frame: new Float32Array(channel), peak });
    return true;
  }
}

registerProcessor('pcm-collector', PcmCollector);
