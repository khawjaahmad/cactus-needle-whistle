/** Moving bytes and strings across an Emscripten heap, for both engine bindings. */
import type { HeapModule } from './emscripten.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createHeap(M: HeapModule) {
  /** A NUL-terminated copy of `text` on the heap, or 0 (NULL) for null. The caller frees it. */
  const cstr = (text: string | null) => {
    if (text == null) return 0;
    const bytes = encoder.encode(text);
    const ptr = M._malloc(bytes.length + 1);
    M.HEAPU8.set(bytes, ptr);
    M.HEAPU8[ptr + bytes.length] = 0;
    return ptr;
  };

  /** Calls `fn` with each text as a C string, and frees them however it returns. */
  const withStrings = <T>(texts: (string | null)[], fn: (...ptrs: number[]) => T): T => {
    const ptrs = texts.map(cstr);
    try {
      return fn(...ptrs);
    } finally {
      ptrs.forEach((ptr) => ptr && M._free(ptr));
    }
  };

  /** Calls `fn(ptr, length)` with a heap copy of `bytes`, and frees it however it returns. */
  const withBytes = <T>(bytes: Uint8Array, fn: (ptr: number, length: number) => T): T => {
    const ptr = M._malloc(bytes.length);
    try {
      M.HEAPU8.set(bytes, ptr);
      return fn(ptr, bytes.length);
    } finally {
      M._free(ptr);
    }
  };

  /** The NUL-terminated string at `ptr`, or '' for NULL. */
  const readString = (ptr: number) => {
    if (!ptr) return '';
    const heap = M.HEAPU8; // read after the call that wrote it: memory growth replaces the view
    return decoder.decode(heap.subarray(ptr, heap.indexOf(0, ptr)));
  };

  return { withStrings, withBytes, readString };
}
