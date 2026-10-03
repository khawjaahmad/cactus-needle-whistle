/**
 * A status line: a dot for the state, a text, and optionally a progress bar.
 * Returns `({state?, text, fraction?}) => void`; without a state the dot keeps its colour.
 */
export function createStatusLine({ dot, label, bar = null }) {
  return ({ state, text, fraction }) => {
    if (state) dot.dataset.state = state;
    label.textContent = text;
    if (bar) bar.style.width = fraction == null ? '0' : `${Math.round(fraction * 100)}%`;
  };
}
