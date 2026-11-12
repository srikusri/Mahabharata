import type { GameEvent } from '../../engine';

export function EventLog({ log }: { log: GameEvent[] }) {
  const shown = [...log].reverse().slice(0, 14);
  return (
    <section className="card" data-testid="log">
      <h3 className="mb-1 font-bold text-gold-light">Chronicle</h3>
      <ul aria-live="polite" className="flex flex-col gap-1 text-sm">
        {shown.map((e) => (
          <li key={e.seq} className={e.type === 'turn' ? 'mt-1 border-t border-gold/20 pt-1 font-bold' : 'opacity-90'}>
            {e.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
