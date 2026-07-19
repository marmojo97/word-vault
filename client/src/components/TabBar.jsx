const TABS = [
  { id: 'today',    label: 'Today',    icon: '◐' },
  { id: 'practice', label: 'Practice', icon: '↻' },
  { id: 'vault',    label: 'Vault',    icon: '◳' },
  { id: 'add',      label: 'Add',      icon: '+' }
];

export default function TabBar({ tab, setTab }) {
  return (
    <nav className="tab-bar" aria-label="Primary navigation">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={tab === t.id ? 'active' : ''}
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
        >
          <span className="tab-icon" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
