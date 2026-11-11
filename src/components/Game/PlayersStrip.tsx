import { SPACES } from '../../engine/board';
import type { PublicState } from '../../engine';
import type { TokenId } from '../../multiplayer/lobby';
import { TOKEN_STYLE } from '../Player/tokens';
import { netWorth } from '../../engine/properties';
import type { GameState } from '../../engine';

export function PlayersStrip({ game, selfId, offline }: { game: PublicState; selfId: string; offline: Set<string> }) {
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
            <div className="text-right text-sm font-bold text-gold-light" title={`Net worth ${netWorth(game as unknown as GameState, p.id)} S`}>
              {p.cash} S
            </div>
          </div>
        );
      })}
    </section>
  );
}
