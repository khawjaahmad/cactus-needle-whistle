import { useEffect, useState } from 'react';

const FILE_NAME = 'acme.spec.ts';
const FEEDBACK_MS = 1500;

/** The last passing run as a Playwright spec, to copy or download. */
export function SpecPanel({ spec, hidden }: { spec: string; hidden: boolean }) {
  const [copyLabel, setCopyLabel] = useState('Copy');

  useEffect(() => {
    if (copyLabel === 'Copy') return;
    const timer = setTimeout(() => setCopyLabel('Copy'), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyLabel]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(spec);
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Copy failed');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([spec], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="panel" id="tab-spec" role="tabpanel" aria-labelledby="tab-button-spec" hidden={hidden}>
      <div className="address">
        <span className="url">{FILE_NAME}</span>
        <button className="btn" type="button" disabled={!spec} onClick={copy}>
          {copyLabel}
        </button>
        <button className="btn btn-primary" type="button" disabled={!spec} onClick={download}>
          Download
        </button>
      </div>
      <pre className="code" id="spec">
        {spec || (
          <span className="empty">
            A passing run appears here as a Playwright spec that repeats it without the model.
          </span>
        )}
      </pre>
    </div>
  );
}
