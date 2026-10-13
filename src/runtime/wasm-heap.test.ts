import { describe, expect, it } from 'vitest';
import { createHeap } from './wasm-heap.ts';

function fakeModule() {
  let next = 8;
  const freed: number[] = [];
  return {
    HEAPU8: new Uint8Array(256),
    freed,
    _malloc: (n: number) => {
      const ptr = next;
      next += n;
      return ptr;
    },
    _free: (ptr: number) => void freed.push(ptr),
  };
}

describe('wasm heap helpers', () => {
  it('passes strings as C strings and frees them', () => {
    const M = fakeModule();
    const heap = createHeap(M);
    const seen = heap.withStrings(['héllo', null], (a, b) => [heap.readString(a), b]);
    expect(seen).toEqual(['héllo', 0]);
    expect(M.freed).toHaveLength(1);
    expect(heap.readString(0)).toBe('');
  });

  it('frees a byte copy even when the call throws', () => {
    const M = fakeModule();
    const heap = createHeap(M);
    expect(() =>
      heap.withBytes(new Uint8Array([1, 2, 3]), (ptr, length) => {
        expect([...M.HEAPU8.subarray(ptr, ptr + length)]).toEqual([1, 2, 3]);
        throw new Error('rejected');
      }),
    ).toThrow('rejected');
    expect(M.freed).toHaveLength(1);
  });
});
