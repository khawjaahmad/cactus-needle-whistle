import type { CSSProperties } from 'react';
import { cosine } from '../../speech/embedding.ts';
import type { EmbeddedClip } from '../hooks/useWhistleLab.ts';

/** Every embedded clip against every other: cosine similarity of their mean-pooled encoder frames. */
export function EmbeddingCompare({ clips, onRemove }: { clips: EmbeddedClip[]; onRemove: (id: number) => void }) {
  if (!clips.length) return null;
  return (
    <div className="embeddings">
      <span className="label" title="Cosine similarity of mean-pooled encoder frames; no transcript decoded">
        Similarity
      </span>
      <div className="matrix">
        <table className="suite" id="whistle-similarity">
          <thead>
            <tr>
              <th>Clip</th>
              {clips.map((clip, i) => (
                <th key={clip.id} title={clip.label}>
                  {i + 1}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {clips.map((row, i) => (
              <tr key={row.id}>
                <td>
                  {i + 1}. {row.label} <span className="meta">{`${row.frames}×${row.dims}`}</span>
                </td>
                {clips.map((col) => {
                  const similarity = cosine(row.pooled, col.pooled);
                  return (
                    <td key={col.id} className="mono cell" style={{ '--s': Math.max(0, similarity) } as CSSProperties}>
                      {similarity.toFixed(2)}
                    </td>
                  );
                })}
                <td>
                  <button
                    className="btn"
                    type="button"
                    aria-label={`Remove ${row.label}`}
                    onClick={() => onRemove(row.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
