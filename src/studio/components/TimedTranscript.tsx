import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SAMPLE_RATE } from '../../speech/core.ts';
import { toWav } from '../../speech/wav.ts';
import type { Clip } from '../hooks/useWhistleLab.ts';

const UNSURE_BELOW = 0.6;

/** A clip's words, each timed and scored; click one to play from it, and the playing word lights up. */
export function TimedTranscript({ clip, live }: { clip: Clip; live: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(-1);
  const url = useMemo(
    () => (clip.pcm ? URL.createObjectURL(new Blob([toWav(clip.pcm, SAMPLE_RATE)], { type: 'audio/wav' })) : null),
    [clip.pcm],
  );
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const play = (start: number) => {
    const player = audio.current;
    if (!player) return;
    player.currentTime = start;
    void player.play();
  };

  const chips = [
    clip.language,
    `${clip.seconds.toFixed(1)} s`,
    `${clip.words.length} words`,
    ...clip.stats.split(' · '),
  ];

  return (
    <>
      <div className="chips">
        {live && <span className="chip live">live</span>}
        {chips.filter(Boolean).map((chip, i) => (
          <span key={i} className="chip">
            {chip}
          </span>
        ))}
      </div>
      {url && (
        <audio
          ref={audio}
          className="player"
          src={url}
          controls
          onTimeUpdate={(e) => setNow(e.currentTarget.paused ? -1 : e.currentTarget.currentTime)}
          onPause={() => setNow(-1)}
        />
      )}
      <p className="transcript" id="whistle-transcript" aria-live="polite">
        {clip.words.map((word, i) => {
          const unsure = word.probability != null && word.probability < UNSURE_BELOW;
          const title =
            `${word.start.toFixed(2)}–${word.end.toFixed(2)} s` +
            (word.probability == null ? '' : ` · p ${word.probability.toFixed(2)}`);
          return (
            <button
              key={i}
              type="button"
              className="word"
              data-unsure={unsure}
              data-playing={now >= word.start && now < word.end}
              title={title}
              disabled={!url}
              onClick={() => play(word.start)}
              style={{ '--p': word.probability ?? 1 } as CSSProperties}
            >
              {word.word}
            </button>
          );
        })}
        {clip.pending && (
          <span key={clip.pending} className="pending">
            {clip.pending}
          </span>
        )}
        {live && <span className="caret" aria-hidden="true" />}
      </p>
      {clip.words.length > 0 && !live && (
        <details>
          <summary className="meta">timings</summary>
          <table className="suite words">
            <thead>
              <tr>
                <th>Word</th>
                <th>Start</th>
                <th>End</th>
                <th>p</th>
              </tr>
            </thead>
            <tbody>
              {clip.words.map((word, i) => (
                <tr key={i}>
                  <td>{word.word}</td>
                  <td className="mono">{word.start.toFixed(2)}</td>
                  <td className="mono">{word.end.toFixed(2)}</td>
                  <td className="mono">
                    <span className="prob" style={{ '--p': word.probability ?? 0 } as CSSProperties} />
                    {word.probability?.toFixed(3) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
