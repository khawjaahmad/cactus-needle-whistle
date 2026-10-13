/** The two vendored Emscripten builds (vendor/needle3-<rev>/needle.js), as far as the bindings use them. */

export interface HeapModule {
  /** Replaced whenever the heap grows: read it after the call that may have grown it. */
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
}

/** b274efc: tool calling. */
export interface NeedleModule extends HeapModule {
  _needle_load(ptr: number, length: bigint): number;
  _needle_reset(): void;
  _needle_init(system: number, tools: number, flags: number): number;
  _needle_complete(input: number, maxNewTokens: number, out: number, capacity: number): number;
}

/** c7c415a: the build that exports needle_transcribe. */
export interface WhistleModule extends HeapModule {
  _needle_load(ptr: number, length: bigint): number;
  _needle_last_error(): number;
  _needle_transcribe(
    samples: number,
    count: number,
    language: number,
    keywords: number,
    wordTimestamps: number,
    out: number,
    capacity: number,
  ): number;
  /** `text` is NULL for audio; a NULL `out` returns the float count it needs. */
  _needle_embed(text: number, samples: number, count: number, out: number, capacity: number): number;
}

/** A build's factory. */
export type CreateModule<M> = (options?: { wasmBinary?: ArrayBuffer }) => Promise<M>;
