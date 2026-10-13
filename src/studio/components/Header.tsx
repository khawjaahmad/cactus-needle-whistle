import type { EngineStatus } from '../../runtime/protocol.ts';
import { AgentOrb, type AgentMode } from './agent/AgentOrb.tsx';

/** One engine as a pill: a dot that pulses while it downloads, its progress, and the full status on hover. */
function EnginePill({ name, status }: { name: string; status: EngineStatus }) {
  const progress =
    status.state === 'loading' && status.fraction != null ? ` ${Math.round(status.fraction * 100)}%` : '';
  return (
    <span className="engine-pill" data-state={status.state} title={status.text}>
      <span className="dot" data-state={status.state} />
      <span className="pill-name">{name}</span>
      {progress && <span className="meta">{progress}</span>}
      {status.state === 'loading' && (
        <i className="pill-progress" style={{ width: `${(status.fraction ?? 0) * 100}%` }} />
      )}
    </span>
  );
}

/** The brand, what the agent is doing, and both on-device engines. */
export function Header({ mode, needle, whistle }: { mode: AgentMode; needle: EngineStatus; whistle: EngineStatus }) {
  return (
    <header>
      <div className="bar">
        <div className="brand">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 16 L16 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Needle Test Studio
          <AgentOrb mode={mode} />
        </div>
        <div className="status" aria-live="polite">
          <EnginePill name="Needle 3" status={needle} />
          <EnginePill name="Whistle" status={whistle} />
        </div>
      </div>
    </header>
  );
}
