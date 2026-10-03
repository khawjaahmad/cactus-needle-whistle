/*
 * Collects microphone samples for Whistle: mono float frames from an AudioContext already
 * running at 16 kHz, plus a peak level per block for the meter. The main thread joins the
 * frames; nothing is resampled here. Loaded by recorder.ts with audioWorklet.addModule().
 */

// The AudioWorkletGlobalScope, which the DOM lib doesn't describe.
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
    // A copy: the render quantum's buffer is reused on the next call.
    this.port.postMessage({ frame: new Float32Array(channel), peak });
    return true;
  }
}

registerProcessor('pcm-collector', PcmCollector);
