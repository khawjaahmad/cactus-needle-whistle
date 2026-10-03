import { useState, type SyntheticEvent } from 'react';

interface Props {
  /** The first address; the driver navigates the frame itself after that. */
  src: string;
  hidden: boolean;
  /** Every load of the frame, so the driver can drive and watch the new document. */
  onLoad: (frame: HTMLIFrameElement) => void;
  onReset: () => void;
}

/** Acme Admin in a frame, with its current address. */
export function AppFrame({ src, hidden, onLoad, onReset }: Props) {
  const [address, setAddress] = useState('');

  const loaded = ({ currentTarget: frame }: SyntheticEvent<HTMLIFrameElement>) => {
    const win = frame.contentWindow;
    if (!win) return;
    const show = () => setAddress(win.location.href.replace(location.origin, ''));
    show();
    win.addEventListener('hashchange', show);
    onLoad(frame);
  };

  return (
    <div className="panel" id="tab-app" role="tabpanel" aria-labelledby="tab-button-app" hidden={hidden}>
      <div className="address">
        <span className="label">Acme Admin</span>
        <span className="url">{address}</span>
        <button className="btn" type="button" onClick={onReset}>
          Reset app
        </button>
      </div>
      <iframe src={src} title="App under test: Acme Admin" onLoad={loaded} />
    </div>
  );
}
