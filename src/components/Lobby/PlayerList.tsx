import type { PublicLobby } from '../../multiplayer/lobby';
import { TOKEN_STYLE, tokenName } from '../Player/tokens';

export function PlayerList({ lobby, selfId }: { lobby: PublicLobby; selfId: string | null }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="player-list">
      {lobby.players.map((p) => (
        <li key={p.id} className="card flex items-center gap-3 !p-3" data-player={p.name}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-navy"
            style={{ background: TOKEN_STYLE[p.tokenId].color }}
          >
            {TOKEN_STYLE[p.tokenId].letter}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">
              {p.name}
              {p.id === selfId && <span className="ml-1 text-xs text-gold-light">(you)</span>}
              {p.isHost && <span className="ml-1 text-xs text-gold-light">host</span>}
            </div>
            <div className="text-xs opacity-70">{tokenName(p.tokenId)}</div>
          </div>
          <span className={`text-xs font-semibold ${!p.connected ? 'text-red-300' : p.ready ? 'text-green-300' : 'text-gold-light'}`}>
            {!p.connected ? 'Offline' : p.ready ? 'Ready' : 'Not ready'}
          </span>
        </li>
      ))}
    </ul>
  );
}
