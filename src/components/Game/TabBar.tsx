export type Tab = 'kingdoms' | 'players' | 'log' | 'menu';

const TABS: { id: Tab; label: string }[] = [
  { id: 'kingdoms', label: 'Kingdoms' },
  { id: 'players', label: 'Players' },
  { id: 'log', label: 'Chronicle' },
  { id: 'menu', label: 'Menu' },
];

/** The four places everything else lives. Big tap targets, one tap to open, one tap to close. */
export function TabBar({ tab, onTab, alert }: { tab: Tab | null; onTab: (t: Tab) => void; alert?: Partial<Record<Tab, boolean>> }) {
  return (
    <nav className="grid grid-cols-4 gap-1.5" aria-label="Game panels">
      {TABS.map((t) => (
        <button
          key={t.id}
          data-testid={`tab-${t.id}`}
          aria-pressed={tab === t.id}
          onClick={() => onTab(t.id)}
          className={`relative min-h-[44px] rounded-lg border px-1 text-sm font-bold transition active:scale-95 ${tab === t.id ? 'border-gold bg-gold/20 text-gold-light' : 'border-gold/30 text-ivory/90'}`}
        >
          {t.label}
          {alert?.[t.id] && <i className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-400" aria-label="needs attention" />}
        </button>
      ))}
    </nav>
  );
}
