import { useRef } from 'react';
import { LANGUAGES } from '../../speech/core.ts';
import type { useWhistleLab } from '../hooks/useWhistleLab.ts';
import { DictationStatus } from './Dictation.tsx';
import { EmbeddingCompare } from './EmbeddingCompare.tsx';
import { TimedTranscript } from './TimedTranscript.tsx';

const LANGUAGE_NAMES: Record<(typeof LANGUAGES)[number], string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
};

interface Props {
  lab: ReturnType<typeof useWhistleLab>;
  hidden: boolean;
}

/** Whistle on its own: record, stream or upload; timed words; embeddings compared. */
export function WhistlePanel({ lab, hidden }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { mode, options, setOptions, clip } = lab;
  const idle = lab.ready && mode === 'idle';
  const capturing = mode === 'recording' || mode === 'live';

  return (
    <div className="panel" id="tab-whistle" role="tabpanel" aria-labelledby="tab-button-whistle" hidden={hidden}>
      <div className="toolbar">
        <div className="row">
          {capturing ? (
            <button className="btn" id="whistle-stop" type="button" data-recording="true" onClick={lab.stop}>
              <span className="rec-dot" aria-hidden="true" /> Stop
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary"
                id="whistle-record"
                type="button"
                disabled={!idle}
                onClick={lab.recordClip}
              >
                ● Record
              </button>
              <button className="btn" id="whistle-live" type="button" disabled={!idle} onClick={lab.goLive}>
                ◉ Live
              </button>
              <button className="btn" type="button" disabled={!idle} onClick={() => fileInput.current?.click()}>
                ↑ Upload
              </button>
            </>
          )}
          <input
            ref={fileInput}
            id="whistle-file"
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void lab.upload(file);
            }}
          />
        </div>
        <div className="row">
          <select
            id="whistle-language"
            aria-label="Language"
            title="Language"
            value={options.language}
            disabled={!idle}
            onChange={(e) => setOptions({ ...options, language: e.target.value })}
          >
            <option value="">Auto</option>
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
          <input
            id="whistle-keywords"
            type="text"
            className="keywords"
            aria-label="Keywords to favour, comma separated"
            title="Names and words to favour"
            placeholder="Keywords"
            value={options.keywords.replaceAll('\n', ', ')}
            disabled={!idle}
            onChange={(e) =>
              setOptions({
                ...options,
                keywords: e.target.value
                  .split(',')
                  .map((k) => k.trimStart())
                  .join('\n'),
              })
            }
          />
        </div>
      </div>
      <div className="whistle-status">
        <DictationStatus status={lab.status} peak={lab.peak} busy={mode === 'working'} />
      </div>

      <div className="report">
        {clip ? (
          <>
            <TimedTranscript clip={clip} live={mode === 'live'} />
            {clip.pcm && (
              <div className="row">
                <button className="btn" id="whistle-embed" type="button" disabled={!idle} onClick={lab.embed}>
                  ⊕ Embed
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="idle-wave" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
        )}
        <EmbeddingCompare clips={lab.embedded} onRemove={lab.removeEmbedded} />
      </div>
    </div>
  );
}
