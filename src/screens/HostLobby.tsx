import { useState } from 'react';
import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { PlayerList } from '../components/Lobby/PlayerList';
import { InviteFlow } from '../components/Lobby/InviteFlow';
import { useStore } from '../state/connectionStore';

export function HostLobby() {
  const { hostSession, lobby, pin, selfId, leave } = useStore();
  const [err, setErr] = useState<string | null>(null);

  const full = !!lobby && lobby.players.length >= lobby.maxPlayers;
  const others = lobby?.players.filter((p) => !p.isHost) ?? [];
  const canStart = !!lobby && others.length >= 1 && lobby.players.every((p) => p.ready && p.connected);

  if (!lobby || !hostSession) return null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gold-light">Your game</h2>
          <div className="text-sm opacity-70">Room {lobby.roomId}</div>
        </div>
        <ConnectionBadge status="host" />
      </header>

      <div className="card text-center">
        <div className="text-xs uppercase tracking-widest opacity-70">Joining PIN</div>
        <div className="text-5xl font-bold tracking-[0.3em] text-gold-light" data-testid="pin">
          {pin}
        </div>
        <div className="mt-1 text-xs opacity-70">Players enter this after their phone connects</div>
      </div>

      <PlayerList lobby={lobby} selfId={selfId} />

      <InviteFlow disabled={full} label={full ? 'Game is full' : 'Add a player'} />

      {err && (
        <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200" data-testid="host-error">
          {err}
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={leave}>
          Close game
        </button>
        <button
          className="btn-gold flex-1"
          disabled={!canStart}
          data-testid="start-game"
          onClick={() => {
            try {
              hostSession.manager.startGame();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          Start game
        </button>
      </div>
      {!canStart && <p className="text-center text-xs opacity-60">Needs at least 2 players, all ready.</p>}
    </main>
  );
}
