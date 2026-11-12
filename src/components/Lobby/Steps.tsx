/** Numbered progress strip so both phones always show where they are in the pairing. */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex w-full items-center justify-center gap-2 text-xs" aria-label="Pairing progress" data-testid="steps">
      {labels.map((l, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'todo';
        return (
          <li key={l} className="flex items-center gap-1" aria-current={state === 'now' ? 'step' : undefined}>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border font-bold ${
                state === 'done' ? 'border-gold bg-gold text-navy' : state === 'now' ? 'border-gold-light text-gold-light' : 'border-gold/30 opacity-50'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={state === 'now' ? 'font-bold text-gold-light' : 'opacity-70'}>{l}</span>
            {i < labels.length - 1 && <span className="mx-1 opacity-30">›</span>}
          </li>
        );
      })}
    </ol>
  );
}
