/*
 * Moving bytes and strings across an Emscripten heap, for both engine bindings
 * (engine/core.js, speech/core.js). A plain script so a worker can importScripts() it and Node
 * can require() it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WasmHeap = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function createHeap(M) {
    /** A NUL-terminated copy of `text` on the heap, or 0 (NULL) for null. The caller frees it. */
    const cstr = (text) => {
      if (text == null) return 0;
      const bytes = encoder.encode(text);
      const ptr = M._malloc(bytes.length + 1);
      M.HEAPU8.set(bytes, ptr);
      M.HEAPU8[ptr + bytes.length] = 0;
      return ptr;
    };

    /** Calls `fn` with each text as a C string, and frees them however it returns. */
    const withStrings = (texts, fn) => {
      const ptrs = texts.map(cstr);
      try {
        return fn(...ptrs);
      } finally {
        ptrs.forEach((ptr) => ptr && M._free(ptr));
      }
    };

    /** Calls `fn(ptr, length)` with a heap copy of `bytes`, and frees it however it returns. */
    const withBytes = (bytes, fn) => {
      const ptr = M._malloc(bytes.length);
      try {
        M.HEAPU8.set(bytes, ptr);
        return fn(ptr, bytes.length);
      } finally {
        M._free(ptr);
      }
    };

    /** The NUL-terminated string at `ptr`, or '' for NULL. */
    const readString = (ptr) => {
      if (!ptr) return '';
      const heap = M.HEAPU8; // read after the call that wrote it: memory growth replaces the view
      return decoder.decode(heap.subarray(ptr, heap.indexOf(0, ptr)));
    };

    return { withStrings, withBytes, readString };
  }

  return { createHeap };
});
