import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { PlayerList } from '../components/Lobby/PlayerList';
import { REJECT_TEXT } from '../multiplayer/lobby';
import { useStore } from '../state/connectionStore';

export function GuestLobby() {
  const { guest, guestSession, lobby, selfId, leave } = useStore();
  if (!guest || !lobby) return null;
  const me = lobby.players.find((p) => p.id === selfId);
  const down = guest.status === 'closed' || guest.status === 'rejected';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gold-light">Lobby</h2>
          <div className="text-sm opacity-70">Room {lobby.roomId}</div>
        </div>
        <ConnectionBadge status={guest.status} rttMs={guest.rttMs} />
      </header>

      <PlayerList lobby={lobby} selfId={selfId} />

      {down && (
        <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200" data-testid="lobby-down">
          {guest.fatalReason ? REJECT_TEXT[guest.fatalReason] : 'Lost connection to the host. Leave and scan their code again to rejoin your seat.'}
        </p>
      )}

      <button
        className={me?.ready ? 'btn-ghost' : 'btn-gold'}
        disabled={down}
        data-testid="ready-toggle"
        onClick={() => guestSession?.manager?.setReady(!me?.ready)}
      >
        {me?.ready ? 'Not ready' : "I'm ready"}
      </button>
      <p className="text-center text-xs opacity-60">Waiting for the host to start the game.</p>
      <button className="btn-ghost" onClick={leave}>
        Leave game
      </button>
    </main>
  );
}
