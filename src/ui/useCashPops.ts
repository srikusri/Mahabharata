import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '../engine';
import { cashDeltas } from './hop';

/** Floating +/- money per player, for ~1.7 s after their cash changes. */
export function useCashPops(game: PublicState): Record<string, { d: number; k: number }> {
  const prev = useRef<Record<string, number>>(Object.fromEntries(game.players.map((p) => [p.id, p.cash])));
  const [pops, setPops] = useState<Record<string, { d: number; k: number }>>({});
  useEffect(() => {
    const next = Object.fromEntries(game.players.map((p) => [p.id, p.cash]));
    const d = cashDeltas(prev.current, next);
    prev.current = next;
    const ids = Object.keys(d);
    if (!ids.length) return;
    setPops((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, { d: d[id], k: (o[id]?.k ?? 0) + 1 }])) }));
    const t = setTimeout(() => setPops((o) => Object.fromEntries(Object.entries(o).filter(([id]) => !ids.includes(id)))), 1700);
    return () => clearTimeout(t);
  }, [game]);
  return pops;
}
