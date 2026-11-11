import { useEffect } from 'react';
import { useStore } from '../state/connectionStore';

export function Home() {
  const go = useStore((s) => s.go);
  const startGuest = useStore((s) => s.startGuest);
  const { savedGame, savedSeat, resumeHost, reconnect, loadSaved } = useStore();
  useEffect(() => void loadSaved(), [loadSaved]);
  const secure = typeof window !== 'undefined' ? window.isSecureContext : true;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6 text-center">
      <header>
        <h1 className="text-4xl font-bold tracking-[0.2em] text-gold-light">MAHABHARATA</h1>
        <p className="mt-2 italic">The Battle for Dharma &amp; Sovereign Realm</p>
      </header>
      <div className="flex flex-col gap-3">
        <button className="btn-gold" onClick={() => go('host-setup')} data-testid="create-game">
          Create New Game
        </button>
        <button className="btn-ghost" onClick={() => startGuest()} data-testid="join-game">
          Join Game
        </button>
        {savedGame && (
          <button className="btn-ghost" onClick={resumeHost} data-testid="resume-host">
            Resume your hosted game ({savedGame.state.players.length} players, round {savedGame.state.turn.round})
          </button>
        )}
        {savedSeat && (
          <button className="btn-ghost" onClick={reconnect} data-testid="rejoin-game">
            Rejoin the game you were in
          </button>
        )}
      </div>
      {!secure && (
        <p className="rounded border border-red-300/50 p-3 text-sm text-red-200" data-testid="insecure-warning">
          This page is not served over https, so the camera is blocked. QR scanning needs https (GitHub Pages is https).
          You can still pair with "Paste code".
        </p>
      )}
      <p className="text-xs opacity-60">2 to 6 players. No server, no account. Players connect directly to the host.</p>
    </main>
  );
}
