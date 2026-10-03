/** The Playwright tab: shows the last passing run's spec, to copy or download. */
import { byId, h } from '../shared/dom.js';

const FILE_NAME = 'acme.spec.ts';
const FEEDBACK_MS = 1500;

export function createSpecPanel() {
  const view = byId('spec');
  const copy = byId('copy-spec');
  const download = byId('download-spec');
  let spec = '';

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(spec);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Copy failed';
    }
    setTimeout(() => {
      copy.textContent = 'Copy';
    }, FEEDBACK_MS);
  });

  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([spec], { type: 'text/plain' }));
    h('a', { href: url, download: FILE_NAME }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  return {
    show(text) {
      spec = text;
      view.textContent = text;
      copy.disabled = download.disabled = false;
    },
  };
}
