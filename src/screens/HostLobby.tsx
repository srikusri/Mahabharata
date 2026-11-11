import { useCallback, useState } from 'react';
import { CodeCollector } from '../components/Lobby/CodeCollector';
import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { PlayerList } from '../components/Lobby/PlayerList';
import { QrDisplay } from '../components/Lobby/QrDisplay';
import type { Invite } from '../multiplayer/P2PManager';
import { useStore } from '../state/connectionStore';

type Stage = 'idle' | 'offer' | 'scan' | 'connecting';

export function HostLobby() {
  const { hostSession, lobby, pin, selfId, leave } = useStore();
  const [stage, setStage] = useState<Stage>('idle');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const full = !!lobby && lobby.players.length >= lobby.maxPlayers;
  const others = lobby?.players.filter((p) => !p.isHost) ?? [];
  const canStart = !!lobby && others.length >= 1 && lobby.players.every((p) => p.ready && p.connected);

  const addPlayer = async () => {
    if (!hostSession) return;
    setErr(null);
    setBusy(true);
    try {
      setInvite(await hostSession.createInvite());
      setStage('offer');
    } catch (e) {
      setErr((e as Error).message || 'Could not create an invite.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (invite) hostSession?.cancelInvite(invite.slot);
    setInvite(null);
    setStage('idle');
    setErr(null);
  };

  const onReply = useCallback(
    async (code: string) => {
      if (!hostSession) return;
      setErr(null);
      setStage('connecting');
      try {
        await hostSession.completeInvite(code);
        setInvite(null);
        setStage('idle');
      } catch (e) {
        setErr((e as Error).message);
        setScanKey((k) => k + 1);
        setStage('scan');
      }
    },
    [hostSession],
  );

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

      {stage === 'idle' && (
        <button className="btn-ghost" onClick={addPlayer} disabled={full || busy} data-testid="add-player">
          {busy ? 'Preparing invite...' : full ? 'Game is full' : 'Add a player'}
        </button>
      )}

      {stage === 'offer' && invite && (
        <section className="card flex flex-col items-center gap-3" data-testid="offer-stage">
          <h3 className="font-bold">Step 1: the player scans this</h3>
          <p className="text-center text-sm opacity-80">
            On their phone: open this app, tap Join Game, and scan. Their phone will then show a reply code.
          </p>
          <QrDisplay code={invite.code} />
          <button className="btn-gold w-full" onClick={() => setStage('scan')} data-testid="next-scan">
            Step 2: scan their reply code
          </button>
          <button className="text-sm underline opacity-70" onClick={cancel}>
            Cancel
          </button>
        </section>
      )}

      {(stage === 'scan' || stage === 'connecting') && (
        <section className="card flex flex-col items-center gap-3" data-testid="scan-stage">
          <h3 className="font-bold">Scan the reply code on their phone</h3>
          {stage === 'scan' ? <CodeCollector key={scanKey} onCode={onReply} /> : <p>Connecting...</p>}
          <button className="text-sm underline opacity-70" onClick={cancel}>
            Cancel
          </button>
        </section>
      )}

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
