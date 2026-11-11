import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeCollector } from '../components/Lobby/CodeCollector';
import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { QrDisplay } from '../components/Lobby/QrDisplay';
import { TokenPicker } from '../components/Lobby/TokenPicker';
import { REJECT_TEXT, TokenId, isTokenId, sanitizeName } from '../multiplayer/lobby';
import { loadPrefs, savePrefs } from '../persistence/IndexedDBManager';
import { useStore } from '../state/connectionStore';

type Stage = 'scan' | 'reply' | 'profile';

export function JoinFlow() {
  const { guestSession, guest, leave } = useStore();
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
        setStage('reply');
      } catch (e) {
        setErr((e as Error).message);
        setScanKey((k) => k + 1);
      }
    },
    [guestSession],
  );

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

  const taken = guest?.lobby?.players.map((p) => p.tokenId) ?? [];
  const clean = sanitizeName(name);
  const canJoin = !!clean && !!token && /^\d{4}$/.test(pin) && guest?.status === 'open';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header className="flex items-start justify-between">
        <h2 className="text-2xl font-bold text-gold-light">Join a game</h2>
        {guest && <ConnectionBadge status={guest.status} rttMs={guest.rttMs} />}
      </header>

      {stage === 'scan' && (
        <section className="flex flex-col items-center gap-3" data-testid="join-scan">
          <p className="text-center text-sm opacity-80">Scan the code shown on the host's phone.</p>
          <CodeCollector key={scanKey} onCode={onOffer} />
        </section>
      )}

      {stage === 'reply' && answer && (
        <section className="card flex flex-col items-center gap-3" data-testid="join-reply">
          <h3 className="font-bold">Show this to {hostName || 'the host'}</h3>
          <p className="text-center text-sm opacity-80">
            Hold this code in front of the host's camera ("Step 2" on their screen). Keep it visible until it says Connected.
          </p>
          <QrDisplay code={answer} />
          <p className="text-sm text-gold-light">Waiting for the host to scan...</p>
          {slow && (
            <p className="text-center text-xs text-red-200">
              Taking a while. Both phones must be on the same Wi-Fi, and the Wi-Fi must allow devices to talk to each other
              (guest networks and some routers block this). Try again, or switch off mobile data / VPN.
            </p>
          )}
        </section>
      )}

      {stage === 'profile' && (
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
            Host's PIN
            <input
              className="rounded border border-gold/50 bg-navy-2 p-3 text-center text-2xl tracking-[0.5em] text-ivory"
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

      <button className="btn-ghost" onClick={leave}>
        Back
      </button>
    </main>
  );
}
