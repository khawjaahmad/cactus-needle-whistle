import type { EngineStatus } from '../../runtime/protocol.ts';

/** The brand, and the Needle 3 engine's status with its download progress. */
export function Header({ status }: { status: EngineStatus }) {
  const progress = status.fraction == null ? '0' : `${Math.round(status.fraction * 100)}%`;
  return (
    <header>
      <div className="bar">
        <div className="brand">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 16 L16 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Needle Test Studio <span className="label">plain-English tests · on-device</span>
        </div>
        <div className="status" role="status" aria-live="polite">
          <span className="dot" data-state={status.state} />
          <span className="label">{status.text}</span>
        </div>
      </div>
      <div className="progress" aria-hidden="true">
        <i style={{ width: progress }} />
      </div>
    </header>
  );
}
