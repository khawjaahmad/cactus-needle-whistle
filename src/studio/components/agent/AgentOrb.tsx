export type AgentMode = 'idle' | 'listening' | 'thinking' | 'acting' | 'waiting';

/** What the agent is doing right now, as a living orb and one word. */
export function AgentOrb({ mode }: { mode: AgentMode }) {
  return (
    <span className="agent-orb" data-mode={mode} role="status" aria-live="polite">
      <span className="orb" aria-hidden="true">
        <i />
        <i />
      </span>
      <span key={mode} className="orb-word">
        {mode === 'idle' ? '' : mode}
      </span>
    </span>
  );
}
