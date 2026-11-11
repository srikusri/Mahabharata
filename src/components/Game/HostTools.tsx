import type { PublicState } from '../../engine';
import type { PublicLobby } from '../../multiplayer/lobby';
import { InviteFlow } from '../Lobby/InviteFlow';

/** Host-only: see who is offline, reconnect them, or skip them when the game is waiting on them. */
export function HostTools({ game, lobby, pin, onSkip }: { game: PublicState; lobby: PublicLobby; pin: string | null; onSkip: (id: string) => void }) {
  const offline = lobby.players.filter((p) => !p.connected && !game.players.find((g) => g.id === p.id)?.bankrupt);
  const waitingOn = game.turn.phase === 'debt' ? game.debts[0]?.debtor : game.players[game.turn.index].id;
  return (
    <section className="card flex flex-col gap-3" data-testid="host-tools">
      <h3 className="font-bold text-gold-light">Host tools</h3>
      <div className="text-xs opacity-70">
        Room {lobby.roomId} · PIN <b data-testid="host-pin">{pin}</b>
      </div>
      {offline.length === 0 ? (
        <p className="text-sm opacity-70">Everyone is connected.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {offline.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm" data-offline={p.name}>
              <span>
                <b>{p.name}</b> is offline
              </span>
              {waitingOn === p.id && game.turn.phase !== 'over' && (
                <button className="btn-ghost px-3 py-1 text-sm" data-testid="skip-offline" onClick={() => confirm(`Skip ${p.name}? If they owe money they go bankrupt.`) && onSkip(p.id)}>
                  Skip their turn
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {offline.length > 0 && <InviteFlow label="Reconnect a player" />}
    </section>
  );
}
