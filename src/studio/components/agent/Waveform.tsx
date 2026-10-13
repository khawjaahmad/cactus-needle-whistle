import { useState } from 'react';

const BARS = 40;
const GAIN = 4;

/** The microphone as a scrolling waveform: one bar per meter reading, newest on the right. */
export function Waveform({ peak }: { peak: number | null }) {
  const [history, setHistory] = useState<number[]>(() => Array(BARS).fill(0));
  const [last, setLast] = useState(peak);
  if (peak !== last) {
    setLast(peak);
    if (peak != null) setHistory([...history.slice(1), Math.min(1, peak * GAIN)]);
  }

  return (
    <div className="waveform" aria-hidden="true">
      {history.map((value, i) => (
        <i key={i} style={{ transform: `scaleY(${Math.max(0.06, value)})` }} />
      ))}
    </div>
  );
}
