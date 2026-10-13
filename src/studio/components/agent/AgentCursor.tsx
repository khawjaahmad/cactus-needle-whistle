import { useEffect, useState } from 'react';
import type { AcmeDriver, AgentAction, AgentTarget } from '../../../acme/driver.ts';

const LINGER_MS = 1400;

interface Pointer {
  target: AgentTarget;
  action: AgentAction;
  /** Bumped on every move, so a click's ripple replays. */
  seq: number;
}

/** The agent, drawn over the app it drives: a cursor that travels to each control and acts on it. */
export function AgentCursor({ driver }: { driver: Pick<AcmeDriver, 'onEvent'> }) {
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const [visible, setVisible] = useState(false);
  const [route, setRoute] = useState<{ path: string; seq: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;
    const unsubscribe = driver.onEvent((event) => {
      clearTimeout(timer);
      if (event.type === 'target') {
        seq += 1;
        setPointer({ target: event.target, action: event.action, seq });
        setVisible(true);
      } else if (event.type === 'navigate') {
        seq += 1;
        setRoute({ path: event.path, seq });
      } else {
        timer = setTimeout(() => setVisible(false), LINGER_MS);
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [driver]);

  const box = pointer?.target;
  return (
    <div className="agent-layer" aria-hidden="true">
      {route && (
        <div key={route.seq} className="agent-route">
          {route.path}
        </div>
      )}
      {box && (
        <>
          <div
            className="agent-target"
            data-action={pointer.action}
            data-visible={visible}
            style={{ left: box.x - 4, top: box.y - 4, width: box.width + 8, height: box.height + 8 }}
          />
          <div
            className="agent-cursor"
            data-visible={visible}
            style={{ transform: `translate(${box.x + box.width / 2}px, ${box.y + box.height / 2}px)` }}
          >
            {pointer.action === 'click' && <span key={pointer.seq} className="ripple" />}
            <svg width="22" height="22" viewBox="0 0 22 22">
              <path d="M3 2 L18 10 L11 12 L8 19 Z" fill="#fff" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <span className="agent-tag" data-action={pointer.action}>
              <i />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
