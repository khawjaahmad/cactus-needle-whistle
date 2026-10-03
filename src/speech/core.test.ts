import { describe, expect, it } from 'vitest';
import { isSilent, toSteps } from './core.ts';

describe('toSteps (dictation split)', () => {
  const word = (w: string, start: number, end: number) => ({ word: w, start, end });

  it('splits on a long pause', () => {
    const words = [word('open', 0, 0.3), word('settings', 0.35, 0.8), word('verify', 1.6, 1.9), word('it', 1.95, 2)];
    expect(toSteps({ text: '', words })).toEqual(['Open settings', 'Verify it']);
  });

  it('splits on sentence-final punctuation and drops the full stop', () => {
    const words = [word('Sign', 0, 0.2), word('out.', 0.25, 0.5), word('then', 0.6, 0.8), word('go', 0.85, 1)];
    expect(toSteps({ text: '', words })).toEqual(['Sign out', 'Then go']);
  });

  it('falls back to the text without timestamps, and gives nothing for silence', () => {
    expect(toSteps({ text: 'open settings.' })).toEqual(['Open settings']);
    expect(toSteps({ text: '' })).toEqual([]);
  });
});

describe('isSilent', () => {
  it('rejects room tone and keeps speech', () => {
    expect(isSilent(new Float32Array(0))).toBe(true);
    expect(isSilent(new Float32Array(1600).fill(0.001))).toBe(true);
    expect(isSilent(new Float32Array(1600).fill(0.2))).toBe(false);
  });
});
