import type { PublicState } from '../../engine';
import type { TokenId } from '../../multiplayer/lobby';
import { useCashPops } from '../../ui/useCashPops';
import { TOKEN_STYLE } from '../Player/tokens';

/** Everyone's token and cash in one slim row that is always on screen. The active player is ringed. */
export function PlayerChips({ game, selfId, offline }: { game: PublicState; selfId: string; offline: Set<string> }) {
  const pops = useCashPops(game);
  return (
    <section className="flex gap-1.5" data-testid="players" aria-label="Players">
      {game.players.map((p, i) => {
        const turn = i === game.turn.index && game.turn.phase !== 'over';
        const off = offline.has(p.id) && !p.bankrupt;
        const t = TOKEN_STYLE[p.tokenId as TokenId];
        return (
          <div
            key={p.id}
            data-player={p.name}
            data-offline={off ? p.name : undefined}
            className={`relative flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-1.5 py-1 ${turn ? 'border-gold-light bg-gold/15 ring-1 ring-gold-light' : 'border-gold/30 bg-navy-2/60'} ${p.bankrupt ? 'opacity-40' : ''}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-navy" style={{ background: t?.color }}>
              {t?.letter}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[10px] opacity-80">
                {p.name}
                {p.id === selfId ? ' •' : ''}
              </div>
              <div className="text-xs font-bold text-gold-light">{p.bankrupt ? 'Out' : `${p.cash} S`}</div>
            </div>
            {pops[p.id] && (
              <span key={pops[p.id].k} data-testid="money-pop" className={`money-pop absolute -top-2 right-1 text-xs font-bold ${pops[p.id].d > 0 ? 'text-green-300' : 'text-red-300'}`}>
                {pops[p.id].d > 0 ? '+' : ''}
                {pops[p.id].d}
              </span>
            )}
            {off && <i className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-400" title="offline" />}
          </div>
        );
      })}
    </section>
  );
}
