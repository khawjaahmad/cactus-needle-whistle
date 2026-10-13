import { describe, expect, it } from 'vitest';
import type { TimedWord, TranscribeOptions } from './core.ts';
import { createTranscriptStream } from './stream.ts';

const SECOND = new Float32Array(16000).fill(0.2);
const QUIET = new Float32Array(16000);
const words = (...list: [string, number, number][]): TimedWord[] =>
  list.map(([word, start, end]) => ({ word, start, end }));

/** A stream whose passes return `passes` in order; records each pass's window length and options. */
function scripted(passes: { words: TimedWord[]; language?: string }[]) {
  const calls: { seconds: number; options: TranscribeOptions }[] = [];
  const stream = createTranscriptStream((pcm, options) => {
    calls.push({ seconds: pcm.length / 16000, options });
    return { language: 'en', ...passes[calls.length - 1] };
  });
  stream.start();
  return { stream, calls };
}

describe('createTranscriptStream', () => {
  it('commits the words two passes agree on and leaves the rest pending', () => {
    const { stream } = scripted([
      { words: words(['open', 0, 0.4]) },
      { words: words(['Open', 0, 0.4], ['the', 0.5, 0.7], ['set', 0.8, 1.9]) },
    ]);
    expect(stream.process(SECOND)).toMatchObject({ words: [], pending: 'open', received: 1 });
    const second = stream.process(SECOND);
    expect(second.words).toEqual(words(['Open', 0, 0.4]));
    expect(second.pending).toBe('the set');
  });

  it('keeps committed audio for context and tells new words apart by their times', () => {
    const { stream, calls } = scripted([
      { words: words(['open', 0, 0.5], ['the', 0.6, 0.9]) },
      { words: words(['open', 0, 0.5], ['the', 0.6, 0.9], ['settings', 1, 1.8]) },
      { words: words(['open', 0, 0.5], ['the', 0.85, 0.95], ['settings', 1, 1.8], ['page.', 2, 2.5]) },
    ]);
    stream.process(SECOND);
    expect(stream.process(SECOND).words).toEqual(words(['open', 0, 0.5], ['the', 0.6, 0.9]));
    const third = stream.process(SECOND);
    expect(calls[2].seconds).toBe(3);
    expect(third.words).toEqual(words(['settings', 1, 1.8]));
    expect(third.pending).toBe('page.');
  });

  it('trims the window at a committed sentence end once it is long', () => {
    const said = words(['Sign', 0, 0.4], ['out.', 0.5, 1], ['Then', 9, 9.5]);
    const { stream, calls } = scripted(Array.from({ length: 11 }, () => ({ words: said })));
    for (let i = 0; i < 11; i += 1) stream.process(SECOND);
    expect(calls.map((c) => c.seconds)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
  });

  it('commits everything left when it stops', () => {
    const { stream } = scripted([
      { words: words(['sign', 0, 0.3]) },
      { words: words(['sign', 0, 0.3], ['out.', 0.4, 0.7]) },
    ]);
    stream.process(SECOND);
    expect(stream.stop()).toMatchObject({ words: words(['sign', 0, 0.3], ['out.', 0.4, 0.7]), pending: '' });
  });

  it('skips passes over silence and drops it once it is long', () => {
    const { stream, calls } = scripted([{ words: words(['hello', 0.1, 0.5]) }]);
    stream.process(QUIET);
    stream.process(QUIET);
    expect(calls).toHaveLength(0);
    stream.process(SECOND);
    expect(calls[0].seconds).toBe(1);
  });

  it('forces a commit when the passes never agree for too long', () => {
    const passes = Array.from({ length: 20 }, (_, i) => ({
      words: words([`a${i}`, 0, 1], [`b${i}`, 1, 2], [`c${i}`, 2, 3], [`d${i}`, 3, 4]),
    }));
    const { stream } = scripted(passes);
    for (let i = 0; i < 19; i += 1) expect(stream.process(SECOND).words).toEqual([]);
    const forced = stream.process(SECOND);
    expect(forced.words.map((w) => w.word)).toEqual(['a19', 'b19']);
    expect(forced.pending).toBe('c19 d19');
  });

  it('holds the first detected language for the rest of the stream unless one is named', () => {
    const { stream, calls } = scripted([{ words: [], language: 'de' }, { words: [] }]);
    stream.process(SECOND);
    stream.process(SECOND);
    expect(calls.map((c) => c.options.language)).toEqual([null, 'de']);

    const named = scripted([{ words: [] }]);
    named.stream.start({ language: 'fr' });
    named.stream.process(SECOND);
    expect(named.calls[0].options.language).toBe('fr');
  });
});
