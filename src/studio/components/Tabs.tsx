export type TabId = 'app' | 'suite' | 'whistle';

const TABS: [TabId, string][] = [
  ['app', 'App under test'],
  ['suite', 'Needle suite'],
  ['whistle', 'Whistle'],
];

/** The output tabs. */
export function Tabs({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          id={`tab-button-${id}`}
          role="tab"
          type="button"
          aria-selected={active === id}
          aria-controls={`tab-${id}`}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
