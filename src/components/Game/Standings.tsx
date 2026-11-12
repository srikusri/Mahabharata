import type { PublicState, GameState } from '../../engine';
import { netWorth } from '../../engine';
import { standings } from '../../ui/hop';
import { TOKEN_STYLE } from '../Player/tokens';
import type { TokenId } from '../../multiplayer/lobby';

export function Standings({ game }: { game: PublicState }) {
  const rows = standings(
    game.players.map((p) => ({ id: p.id, name: p.name, tokenId: p.tokenId, net: netWorth(game as unknown as GameState, p.id), bankrupt: p.bankrupt })),
    game.winner,
  );
  return (
    <ol className="mt-3 space-y-1 text-left text-sm" data-testid="standings">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-2">
          <span className="w-4 opacity-70">{i + 1}.</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-navy" style={{ background: TOKEN_STYLE[r.tokenId as TokenId]?.color }}>{TOKEN_STYLE[r.tokenId as TokenId]?.letter}</span>
          <span className="flex-1 truncate">{r.name}</span>
          <span className="text-gold-light">{r.bankrupt ? 'Bankrupt' : `${r.net} S`}</span>
        </li>
      ))}
    </ol>
  );
}
