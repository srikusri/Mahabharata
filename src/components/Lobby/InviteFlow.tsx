import { useCallback, useState } from 'react';
import type { Invite } from '../../multiplayer/P2PManager';
import { useStore } from '../../state/connectionStore';
import { inviteLink } from '../../multiplayer/signaling';
import { shareOrCopy } from '../../ui/share';
import { CodeCollector } from './CodeCollector';
import { QrDisplay } from './QrDisplay';
import { Steps } from './Steps';

const STEPS = ['Show invite', 'Get reply', 'Connected'];

type Stage = 'idle' | 'offer' | 'scan' | 'connecting';

/** The host's two-step QR exchange for one phone: show an invite, scan the reply. Used in the lobby and mid-game. */
export function InviteFlow({ label = 'Add a player', disabled = false }: { label?: string; disabled?: boolean }) {
  const hostSession = useStore((s) => s.hostSession);
  const [stage, setStage] = useState<Stage>('idle');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const start = async () => {
    if (!hostSession) return;
    setErr(null);
    setBusy(true);
    try {
      setNote(null);
      setShareMsg(null);
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
        setNote('Phone connected. They are choosing a name and token now. You can add the next player.');
      } catch (e) {
        setErr((e as Error).message);
        setScanKey((k) => k + 1);
        setStage('scan');
      }
    },
    [hostSession],
  );

  const link = invite ? inviteLink(invite.code, location.href) : '';
  const sendLink = async () => {
    const r = await shareOrCopy({
      title: 'Join my Mahabharata game',
      text: 'Join my Mahabharata game. Open this link in Safari or Chrome:',
      url: link,
    });
    setShareMsg(r === 'copied' ? 'Link copied. Paste it into a chat.' : r === 'failed' ? 'Could not share. Use the QR code.' : null);
  };

  return (
    <>
      {note && stage === 'idle' && (
        <p role="status" className="rounded border border-gold/50 p-3 text-center text-sm text-gold-light" data-testid="invite-note">
          {note}
        </p>
      )}
      {stage === 'idle' && (
        <button className="btn-ghost" onClick={start} disabled={disabled || busy} data-testid="add-player">
          {busy ? 'Preparing invite...' : label}
        </button>
      )}

      {stage === 'offer' && invite && (
        <section className="card flex flex-col items-center gap-3" data-testid="offer-stage">
          <Steps labels={STEPS} current={0} />
          <h3 className="font-bold">Let the player scan this</h3>
          <p className="text-center text-sm opacity-80">
            On their phone: open this app, tap <b>Join Game</b> and point the camera here. Keep this screen up until they have scanned it.
          </p>
          <QrDisplay code={invite.code} />
          <div className="flex w-full flex-col gap-1">
            <button className="btn-ghost w-full py-2 text-sm" onClick={sendLink} data-testid="send-link" data-link={link}>
              No camera? Send an invite link instead
            </button>
            {shareMsg && <p className="text-center text-xs text-gold-light">{shareMsg}</p>}
          </div>
          <button className="btn-gold w-full" onClick={() => setStage('scan')} data-testid="next-scan">
            They scanned it: get their reply
          </button>
          <button className="text-sm underline opacity-70" onClick={cancel}>
            Cancel
          </button>
        </section>
      )}

      {(stage === 'scan' || stage === 'connecting') && (
        <section className="card flex flex-col items-center gap-3" data-testid="scan-stage">
          <Steps labels={STEPS} current={stage === 'scan' ? 1 : 2} />
          <h3 className="font-bold">Scan the reply code on their phone</h3>
          {stage === 'scan' && (
            <p className="text-center text-sm opacity-80">
              Their screen now shows a reply code. Point your camera at it, or paste it if they sent it to you.
            </p>
          )}
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
