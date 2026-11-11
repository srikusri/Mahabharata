import { SPACES } from '../../engine/board';
import type { LobbyPlayer } from '../../multiplayer/lobby';
import { TOKEN_STYLE, tokenName } from './tokens';

/** Phase 1 dashboard. Balance and ownership are placeholders until the engine lands in Phase 3. */
export function PlayerDashboard({
  player,
  balance = 1500,
  position = 0,
  owned = [],
  isTurn = false,
}: {
  player: LobbyPlayer;
  balance?: number;
  position?: number;
  owned?: string[];
  isTurn?: boolean;
}) {
  return (
    <section className="card flex flex-col gap-3" aria-label="Your dashboard" data-testid="dashboard">
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-navy"
          style={{ background: TOKEN_STYLE[player.tokenId].color }}
        >
          {TOKEN_STYLE[player.tokenId].letter}
        </span>
        <div className="flex-1">
          <div className="text-lg font-bold">{player.name}</div>
          <div className="text-xs opacity-70">{tokenName(player.tokenId)}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gold-light">{balance} S</div>
          <div className="text-xs opacity-70">Suvarna</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-xs opacity-70">Position</div>
          <div>{SPACES[position].name}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Turn</div>
          <div>{isTurn ? 'Your turn' : 'Waiting'}</div>
        </div>
      </div>
      <div>
        <div className="text-xs opacity-70">Kingdoms</div>
        <div className="text-sm">{owned.length ? owned.join(', ') : 'None yet'}</div>
      </div>
    </section>
  );
}
