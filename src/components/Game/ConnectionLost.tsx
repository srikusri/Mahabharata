import type { PublicState } from '../../engine';
import type { PublicLobby } from '../../multiplayer/lobby';

/** Guest-side: the host's connection dropped. Either wait for the host to come back, or one device takes over. */
export function ConnectionLost({
  game,
  lobby,
  selfId,
  onReconnect,
  onTakeOver,
}: {
  game: PublicState;
  lobby: PublicLobby;
  selfId: string;
  onReconnect: () => void;
  onTakeOver: () => void;
}) {
  // A deterministic, non-binding suggestion so the table does not argue: first live player in turn order after the old host.
  const successor = game.players.find((p) => p.id !== lobby.hostId && !p.bankrupt);
  const iAmSuggested = successor?.id === selfId;
  return (
    <section className="card flex flex-col gap-3 border-red-300/60" role="alert" data-testid="connection-lost">
      <h3 className="font-bold text-red-200">Connection to the host was lost</h3>
      <p className="text-sm opacity-90">
        If the host's phone is back, tap <b>Reconnect</b> and scan its code again. Your seat and the game are kept.
      </p>
      <button className="btn-gold" onClick={onReconnect} data-testid="reconnect">
        Reconnect
      </button>
      <details className="text-sm">
        <summary className="cursor-pointer opacity-80">The host is not coming back</summary>
        <p className="my-2 opacity-90">
          One player can carry on as the new host using the latest game state this phone has. Everyone else then rejoins
          their own seat from the new host's screen. Suggested: <b>{successor?.name ?? 'anyone'}</b>
          {iAmSuggested ? ' (that is you)' : ''}.
        </p>
        <button className="btn-ghost w-full" onClick={() => confirm('Become the host? The other players will need to rejoin you.') && onTakeOver()} data-testid="take-over">
          Take over as host
        </button>
      </details>
    </section>
  );
}
