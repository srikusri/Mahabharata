import { useEffect, useState } from 'react';
import { TokenPicker } from '../components/Lobby/TokenPicker';
import { TokenId, isTokenId, sanitizeName } from '../multiplayer/lobby';
import { loadPrefs, savePrefs } from '../persistence/IndexedDBManager';
import { useStore } from '../state/connectionStore';

export function HostSetup() {
  const go = useStore((s) => s.go);
  const startHost = useStore((s) => s.startHost);
  const [name, setName] = useState('');
  const [token, setToken] = useState<TokenId | null>(null);

  useEffect(() => {
    void loadPrefs().then((p) => {
      if (!p) return;
      setName((n) => n || p.name);
      if (isTokenId(p.tokenId)) setToken((t) => t ?? p.tokenId as TokenId);
    });
  }, []);

  const clean = sanitizeName(name);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-6">
      <h2 className="text-2xl font-bold text-gold-light">Create a game</h2>
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          className="rounded border border-gold/50 bg-navy-2 p-3 text-base text-ivory"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Arjuna"
          data-testid="host-name"
        />
      </label>
      <div className="flex flex-col gap-2 text-sm">
        Choose your token
        <TokenPicker value={token} onChange={setToken} />
      </div>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={() => go('home')}>
          Back
        </button>
        <button
          className="btn-gold flex-1"
          disabled={!clean || !token}
          data-testid="host-create"
          onClick={() => {
            void savePrefs({ name: clean as string, tokenId: token as string });
            startHost(clean as string, token as TokenId);
          }}
        >
          Create
        </button>
      </div>
    </main>
  );
}
