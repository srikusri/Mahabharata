import { useEffect, useState } from 'react';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** Two dice. The values come from the host; this only animates the reveal (about 0.7s of tumbling). */
export function Dice({ dice, rollKey }: { dice: [number, number] | null; rollKey: number }) {
  const [shown, setShown] = useState<[number, number] | null>(dice);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!dice) return setShown(null);
    setRolling(true);
    const t0 = Date.now();
    const id = setInterval(() => {
      if (Date.now() - t0 > 700) {
        clearInterval(id);
        setShown(dice);
        setRolling(false);
      } else setShown([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 80);
    return () => clearInterval(id);
    // rollKey changes on every roll, even when the numbers repeat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  if (!shown) return <div className="text-sm opacity-70">Awaiting the roll</div>;
  return (
    <div className="flex items-center gap-3" data-testid="dice" data-dice={dice ? dice.join(',') : ''} aria-label={dice ? `Dice ${dice[0]} and ${dice[1]}` : 'Dice'}>
      {shown.map((d, i) => (
        <span key={i} className={`select-none leading-none text-gold-light ${rolling ? 'animate-pulse' : ''}`} style={{ fontSize: '9cqw' }}>
          {FACES[d - 1]}
        </span>
      ))}
      {!rolling && dice && <span className="text-sm opacity-80">= {dice[0] + dice[1]}</span>}
    </div>
  );
}
