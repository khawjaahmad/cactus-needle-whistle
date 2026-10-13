import { useState, type SyntheticEvent } from 'react';
import type { AcmeDriver } from '../../acme/driver.ts';
import { AgentCursor } from './agent/AgentCursor.tsx';

interface Props {
  /** The first address; the driver navigates the frame itself after that. */
  src: string;
  hidden: boolean;
  driver: Pick<AcmeDriver, 'attach' | 'onEvent'>;
  onReset: () => void;
}

/** Acme Admin in a frame, with its current address, and the agent drawn over it. */
export function AppFrame({ src, hidden, driver, onReset }: Props) {
  const [address, setAddress] = useState('');

  const loaded = ({ currentTarget: frame }: SyntheticEvent<HTMLIFrameElement>) => {
    const win = frame.contentWindow;
    if (!win) return;
    const show = () => setAddress(win.location.hash.slice(1) || '/');
    show();
    win.addEventListener('hashchange', show);
    driver.attach(frame);
  };

  return (
    <div className="panel" id="tab-app" role="tabpanel" aria-labelledby="tab-button-app" hidden={hidden}>
      <div className="address">
        <span className="traffic" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span key={address} className="url">
          acme.admin{address}
        </span>
        <button className="btn icon" type="button" aria-label="Reset app" title="Reset app" onClick={onReset}>
          ↺
        </button>
      </div>
      <div className="stage">
        <iframe src={src} title="App under test: Acme Admin" onLoad={loaded} />
        <AgentCursor driver={driver} />
      </div>
    </div>
  );
}
