import { SPACES } from '../../engine/board';
import type { PublicState } from '../../engine';
import type { TokenId } from '../../multiplayer/lobby';
import { TOKEN_STYLE } from '../Player/tokens';

/** My own status in one tappable line: who I am, where I stand, my cash, how many kingdoms and cards I hold. */
export function MeBar({ game, selfId, onOpen }: { game: PublicState; selfId: string; onOpen: () => void }) {
  const me = game.players.find((p) => p.id === selfId);
  if (!me) return null;
  const t = TOKEN_STYLE[me.tokenId as TokenId];
  const kingdoms = Object.values(game.props).filter((x) => x.owner === selfId).length;
  return (
    <button className="card flex w-full items-center gap-3 !p-2 text-left" onClick={onOpen} data-testid="dashboard" aria-label="My status. Open my kingdoms">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-navy" style={{ background: t?.color }}>
        {t?.letter}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-bold">{me.name}</span>
        <span className="block truncate text-xs opacity-75">
          {me.bankrupt ? 'Out of the game' : me.inExile ? 'In Vanavasa' : SPACES[me.position].name} · {kingdoms} kingdom{kingdoms === 1 ? '' : 's'}
          {me.held.length ? ` · ${me.held.length} card${me.held.length > 1 ? 's' : ''}` : ''}
        </span>
      </span>
      <span className="text-right leading-tight">
        <span className="block text-xl font-bold text-gold-light">{me.cash} S</span>
      </span>
    </button>
  );
}
