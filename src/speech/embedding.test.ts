import { describe, expect, it } from 'vitest';
import { cosine, meanPool } from './embedding.ts';
import { toWav } from './wav.ts';

describe('meanPool and cosine', () => {
  it('averages frames and compares directions', () => {
    const pooled = meanPool(Float32Array.of(1, 0, 3, 2), 2);
    expect(Array.from(pooled)).toEqual([2, 1]);
    expect(cosine(Float32Array.of(1, 0), Float32Array.of(2, 0))).toBeCloseTo(1);
    expect(cosine(Float32Array.of(1, 0), Float32Array.of(0, 3))).toBeCloseTo(0);
    expect(cosine(Float32Array.of(0, 0), Float32Array.of(1, 1))).toBe(0);
  });
});

describe('toWav', () => {
  it('writes a 16-bit mono header and clamps samples', () => {
    const view = new DataView(toWav(Float32Array.of(0, 1, -2), 16000));
    const ascii = (at: number) => String.fromCharCode(...new Uint8Array(view.buffer, at, 4));
    expect([ascii(0), ascii(8), ascii(36)]).toEqual(['RIFF', 'WAVE', 'data']);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(6);
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([0, 32767, -32767]);
  });
});
