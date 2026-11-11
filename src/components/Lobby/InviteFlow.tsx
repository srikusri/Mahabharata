import { useCallback, useState } from 'react';
import type { Invite } from '../../multiplayer/P2PManager';
import { useStore } from '../../state/connectionStore';
import { CodeCollector } from './CodeCollector';
import { QrDisplay } from './QrDisplay';

type Stage = 'idle' | 'offer' | 'scan' | 'connecting';

/** The host's two-step QR exchange for one phone: show an invite, scan the reply. Used in the lobby and mid-game. */
export function InviteFlow({ label = 'Add a player', disabled = false }: { label?: string; disabled?: boolean }) {
  const hostSession = useStore((s) => s.hostSession);
  const [stage, setStage] = useState<Stage>('idle');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const start = async () => {
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

  return (
    <>
      {stage === 'idle' && (
        <button className="btn-ghost" onClick={start} disabled={disabled || busy} data-testid="add-player">
          {busy ? 'Preparing invite...' : label}
        </button>
      )}

      {stage === 'offer' && invite && (
        <section className="card flex flex-col items-center gap-3" data-testid="offer-stage">
          <h3 className="font-bold">Step 1: the player scans this</h3>
          <p className="text-center text-sm opacity-80">
            On their phone: open this app, tap Join Game (or Rejoin), and scan. Their phone will then show a reply code.
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
    </>
  );
}
