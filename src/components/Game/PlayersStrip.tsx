import { useEffect, useRef, useState } from 'react';
import { cashDeltas } from '../../ui/hop';
import { SPACES } from '../../engine/board';
import type { PublicState } from '../../engine';
import type { TokenId } from '../../multiplayer/lobby';
import { TOKEN_STYLE } from '../Player/tokens';
import { netWorth } from '../../engine/properties';
import type { GameState } from '../../engine';

export function PlayersStrip({ game, selfId, offline }: { game: PublicState; selfId: string; offline: Set<string> }) {
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
  return (
    <section className="grid grid-cols-2 gap-2" data-testid="players">
      {game.players.map((p, i) => {
        const turn = i === game.turn.index && game.turn.phase !== 'over';
        return (
          <div key={p.id} data-player={p.name} className={`card flex items-center gap-2 p-2 ${turn ? 'ring-2 ring-gold-light' : ''} ${p.bankrupt ? 'opacity-40' : ''}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-navy" style={{ background: TOKEN_STYLE[p.tokenId as TokenId]?.color }}>
              {TOKEN_STYLE[p.tokenId as TokenId]?.letter}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-bold">
                {p.name}
                {p.id === selfId ? ' (you)' : ''}
              </div>
              <div className="truncate text-xs opacity-70">
                {p.bankrupt ? 'Bankrupt' : p.inExile ? 'In Vanavasa' : SPACES[p.position].name}
                {offline.has(p.id) && !p.bankrupt ? ' · offline' : ''}
              </div>
            </div>
            <div className="relative text-right text-sm font-bold text-gold-light" title={`Net worth ${netWorth(game as unknown as GameState, p.id)} S`}>
              {p.cash} S
              {pops[p.id] && (
                <span key={pops[p.id].k} data-testid="money-pop" className={`money-pop absolute -top-3 right-0 text-xs ${pops[p.id].d > 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {pops[p.id].d > 0 ? '+' : ''}{pops[p.id].d}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
