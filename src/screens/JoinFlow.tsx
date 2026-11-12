import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeCollector } from '../components/Lobby/CodeCollector';
import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { QrDisplay } from '../components/Lobby/QrDisplay';
import { Steps } from '../components/Lobby/Steps';
import { shareOrCopy } from '../ui/share';
import { TokenPicker } from '../components/Lobby/TokenPicker';
import { REJECT_TEXT, TokenId, isTokenId, sanitizeName } from '../multiplayer/lobby';
import { loadPrefs, savePrefs } from '../persistence/IndexedDBManager';
import { useStore } from '../state/connectionStore';

type Stage = 'scan' | 'reply' | 'profile';
const STEPS = ['Scan invite', 'Show reply', 'Your details'];

export function JoinFlow() {
  const { guestSession, guest, leave, game, selfId, go, pendingOffer } = useStore();
  const [autoPin, setAutoPin] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('scan');
  const [answer, setAnswer] = useState<string | null>(null);
  const [hostName, setHostName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [slow, setSlow] = useState(false);
  const [name, setName] = useState('');
  const [token, setToken] = useState<TokenId | null>(null);
  const [pin, setPin] = useState('');
  const autoTried = useRef(false);

  useEffect(() => {
    void loadPrefs().then((p) => {
      if (!p) return;
      setName((n) => n || p.name);
      if (isTokenId(p.tokenId)) setToken((t) => t ?? (p.tokenId as TokenId));
    });
  }, []);

  const onOffer = useCallback(
    async (code: string) => {
      if (!guestSession) return;
      setErr(null);
      try {
        const r = await guestSession.acceptOffer(code);
        setAnswer(r.answerCode);
        setHostName(r.hostName);
        if (r.pin) {
          setPin(r.pin);
          setAutoPin(true);
        }
        setStage('reply');
      } catch (e) {
        setErr((e as Error).message);
        setScanKey((k) => k + 1);
      }
    },
    [guestSession],
  );

  // Opened from an invite link: use the offer it carried.
  useEffect(() => {
    if (!pendingOffer || !guestSession || stage !== 'scan') return;
    useStore.setState({ pendingOffer: null });
    void onOffer(pendingOffer);
  }, [pendingOffer, guestSession, stage, onOffer]);

  // Channel opened: move on to the profile form.
  useEffect(() => {
    if (stage === 'reply' && (guest?.status === 'open' || guest?.status === 'joining')) setStage('profile');
  }, [guest?.status, stage]);

  // Taking long hint.
  useEffect(() => {
    if (stage !== 'reply') return;
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(t);
  }, [stage]);

  // Rejoin the same seat automatically if we have a saved session for this room.
  useEffect(() => {
    if (stage !== 'profile' || autoTried.current || guest?.status !== 'open') return;
    const secret = guestSession?.resumeSecret;
    if (!secret) return;
    autoTried.current = true;
    void loadPrefs().then((p) => {
      const nm = sanitizeName(p?.name);
      if (nm && p && isTokenId(p.tokenId)) guestSession?.manager?.join({ pin: '', name: nm, tokenId: p.tokenId }, secret);
    });
  }, [stage, guest?.status, guestSession]);

  // Rejoining a game in progress: if the host kept our seat we resume silently; otherwise (after a host change) we reclaim it with the PIN.
  const seat = guest?.lobby?.players.find((p) => p.id === selfId && !p.connected);
  const claim = stage === 'profile' && !!seat && (!guestSession?.resumeSecret || !!guest?.joinError);
  const taken = guest?.lobby?.players.map((p) => p.tokenId) ?? [];
  const clean = sanitizeName(name);
  const canJoin = !!clean && !!token && /^\d{4}$/.test(pin) && guest?.status === 'open';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header className="flex items-start justify-between">
        <h2 className="text-2xl font-bold text-gold-light">Join a game</h2>
        {guest && <ConnectionBadge status={guest.status} rttMs={guest.rttMs} />}
      </header>

      {!claim && <Steps labels={STEPS} current={stage === 'scan' ? 0 : stage === 'reply' ? 1 : 2} />}

      {stage === 'scan' && pendingOffer && <p className="text-center text-sm text-gold-light">Opening your invite...</p>}
      {stage === 'scan' && !pendingOffer && (
        <section className="flex flex-col items-center gap-3" data-testid="join-scan">
          <p className="text-center text-sm opacity-80">Point your camera at the code on the host's phone. It scans by itself.</p>
          <CodeCollector key={scanKey} onCode={onOffer} />
        </section>
      )}

      {stage === 'reply' && answer && (
        <section className="card flex flex-col items-center gap-3" data-testid="join-reply">
          <h3 className="font-bold">Now show this to {hostName || 'the host'}</h3>
          <p className="text-center text-sm opacity-80">
            Hold this screen in front of the host's camera and keep it there until this page moves on by itself. Or send the reply to them.
          </p>
          <QrDisplay code={answer} />
          <button
            className="btn-ghost w-full py-2 text-sm"
            data-testid="send-reply"
            data-code={answer}
            onClick={async () => {
              const r = await shareOrCopy({ title: 'Mahabharata reply', text: `My Mahabharata reply code:\n${answer}` });
              setShareMsg(r === 'copied' ? 'Reply copied. Paste it into your chat with the host.' : r === 'failed' ? 'Could not share. Use the QR code.' : null);
            }}
          >
            Send the reply code to the host
          </button>
          {shareMsg && <p className="text-center text-xs text-gold-light">{shareMsg}</p>}
          <p className="text-sm text-gold-light">Waiting for the host to scan...</p>
          {slow && (
            <p className="text-center text-xs text-red-200">
              Taking a while. Both phones must be on the same Wi-Fi, and the Wi-Fi must allow devices to talk to each other
              (guest networks and some routers block this). Try again, or switch off mobile data / VPN.
            </p>
          )}
        </section>
      )}

      {claim && seat && (
        <section className="flex flex-col gap-4" data-testid="join-claim">
          <p className="text-center">Rejoin as <b>{seat.name}</b></p>
          <label className="flex flex-col gap-1 text-sm">
            Host's PIN
            <input
              className="rounded border border-gold/50 bg-navy-2 p-3 text-center text-2xl tracking-[0.5em] text-ivory"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              data-testid="claim-pin"
            />
          </label>
          {guest?.joinError && (
            <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200" data-testid="join-error">
              {REJECT_TEXT[guest.joinError]}
            </p>
          )}
          <button
            className="btn-gold"
            disabled={!/^\d{4}$/.test(pin) || guest?.status !== 'open'}
            data-testid="claim-join"
            onClick={() => guestSession?.manager?.join({ pin, name: seat.name, tokenId: seat.tokenId })}
          >
            Rejoin
          </button>
        </section>
      )}

      {stage === 'profile' && !claim && (
        <section className="flex flex-col gap-4" data-testid="join-profile">
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input
              className="rounded border border-gold/50 bg-navy-2 p-3 text-base text-ivory"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              data-testid="guest-name"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm">
            Choose your token
            <TokenPicker value={token} onChange={setToken} taken={taken} />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            {autoPin ? "Host's PIN (filled in for you)" : "Host's PIN"}
            <input
              className={`rounded border border-gold/50 bg-navy-2 text-center tracking-[0.5em] text-ivory ${autoPin ? 'p-2 text-lg opacity-70' : 'p-3 text-2xl'}`}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              data-testid="guest-pin"
            />
          </label>
          {guest?.joinError && (
            <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200" data-testid="join-error">
              {REJECT_TEXT[guest.joinError]}
            </p>
          )}
          <button
            className="btn-gold"
            disabled={!canJoin}
            data-testid="guest-join"
            onClick={() => {
              void savePrefs({ name: clean as string, tokenId: token as string });
              guestSession?.manager?.join({ pin, name: clean as string, tokenId: token as string });
            }}
          >
            {guest?.status === 'joining' ? 'Joining...' : 'Join lobby'}
          </button>
        </section>
      )}

      {guest?.fatalReason && (
        <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200">
          {REJECT_TEXT[guest.fatalReason]}
        </p>
      )}
      {guest?.status === 'closed' && stage !== 'scan' && (
        <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200">
          The connection closed. Go back and scan again.
        </p>
      )}
      {err && (
        <p role="alert" className="rounded border border-red-300/50 p-3 text-sm text-red-200" data-testid="join-error-scan">
          {err}
        </p>
      )}

      <button className="btn-ghost" onClick={() => (game ? go('play') : leave())}>
        Back
      </button>
    </main>
  );
}
