/** The output tabs: each `[data-tab=name]` button shows the `#tab-name` panel and hides the rest. */
import { byId } from '../shared/dom.js';

export function createTabs() {
  const tabs = [...document.querySelectorAll('[data-tab]')];

  function show(name) {
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
      byId(`tab-${tab.dataset.tab}`).hidden = tab.dataset.tab !== name;
    }
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => show(tab.dataset.tab)));
  return { show };
}
