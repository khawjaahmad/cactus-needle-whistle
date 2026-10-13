const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A confidence as a ring: green from 0.9, white from 0.5, yellow below. */
export function ConfidenceRing({ value, size = 24 }: { value: number | null; size?: number }) {
  const level = value == null ? 'none' : value >= 0.9 ? 'high' : value >= 0.5 ? 'mid' : 'low';
  return (
    <span className="ring" data-level={level} title={value == null ? 'no score' : `confidence ${value.toFixed(2)}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r={RADIUS} className="track" />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          className="fill"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: CIRCUMFERENCE * (1 - (value ?? 0)) }}
        />
      </svg>
      <span className="ring-value">{value == null ? '—' : value.toFixed(2)}</span>
    </span>
  );
}
