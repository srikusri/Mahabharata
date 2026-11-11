import { useEffect, useMemo, useRef, useState } from 'react';
import { SPACES, GROUP_COLOR } from '../engine/board';
import type { GameEvent } from '../engine';
import { Board, Ownership } from '../components/Board/Board';
import { ActionBar } from '../components/Game/ActionBar';
import { ConnectionLost } from '../components/Game/ConnectionLost';
import { HostTools } from '../components/Game/HostTools';
import { CardModal } from '../components/Game/CardModal';
import { Dice } from '../components/Game/Dice';
import { EventLog } from '../components/Game/EventLog';
import { PlayersStrip } from '../components/Game/PlayersStrip';
import { PropertyPanel } from '../components/Game/PropertyPanel';
import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { PlayerDashboard } from '../components/Player/PlayerDashboard';
import { TOKEN_STYLE } from '../components/Player/tokens';
import type { TokenId } from '../multiplayer/lobby';
import { useStore } from '../state/connectionStore';

export function PlayScreen() {
  const { lobby, selfId, guest, role, leave, game, events, gameError, clearError, dispatch, reconnect, takeOver, skipOffline, pin } = useStore();
  const [modal, setModal] = useState<GameEvent | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const lastVersion = useRef(-1);

  // React to the events of each new state: tumble the dice, show drawn cards.
  useEffect(() => {
    if (!game || game.version === lastVersion.current) return;
    lastVersion.current = game.version;
    if (events.some((e) => e.type === 'dice')) setRollKey((k) => k + 1);
    const card = events.find((e) => e.type === 'card' && e.data?.title) ?? events.find((e) => e.type === 'peek');
    if (card) setModal(card);
  }, [game, events]);

  useEffect(() => {
    if (!gameError) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [gameError, clearError]);

  const ownership = useMemo(() => {
    const out: Record<number, Ownership> = {};
    if (!game) return out;
    for (const [i, st] of Object.entries(game.props)) {
      const owner = game.players.find((p) => p.id === st.owner);
      out[Number(i)] = { color: TOKEN_STYLE[(owner?.tokenId ?? 'crown') as TokenId].color, level: st.level, mortgaged: st.mortgaged };
    }
    return out;
  }, [game]);

  if (!lobby || !selfId) return null;
  if (!game)
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <p>Summoning the realm…</p>
      </main>
    );

  const me = game.players.find((p) => p.id === selfId);
  const lobbyMe = lobby.players.find((p) => p.id === selfId);
  const current = game.players[game.turn.index];
  const offline = new Set(lobby.players.filter((p) => !p.connected).map((p) => p.id));
  const tokens = game.players.filter((p) => !p.bankrupt).map((p) => ({ id: p.id, tokenId: p.tokenId as TokenId, position: p.position, name: p.name }));
  const ownedNames = Object.keys(game.props).map(Number).filter((i) => game.props[i].owner === selfId).map((i) => SPACES[i].name);
  const winner = game.players.find((p) => p.id === game.winner);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gold-light" data-testid="turn-title">
          {game.turn.phase === 'over' ? 'Game over' : current.id === selfId ? 'Your turn' : `${current.name}'s turn`}
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="opacity-70">Round {game.turn.round}</span>
          <ConnectionBadge status={role === 'host' ? 'host' : (guest?.status ?? 'closed')} rttMs={guest?.rttMs} />
        </div>
      </header>

      <Board
        tokens={tokens}
        activeIndex={current.position}
        ownership={ownership}
        center={<Dice dice={game.turn.dice} rollKey={rollKey} />}
      />

      {gameError && (
        <div role="alert" data-testid="game-error" className="rounded-lg bg-red-900/80 p-2 text-center text-sm" onClick={clearError}>
          {gameError}
        </div>
      )}

      {role === 'guest' && guest?.status === 'closed' && game.turn.phase !== 'over' && (
        <ConnectionLost game={game} lobby={lobby} selfId={selfId} onReconnect={reconnect} onTakeOver={takeOver} />
      )}
      <ActionBar game={game} selfId={selfId} send={dispatch} />
      {me && lobbyMe && !me.bankrupt && (
        <PlayerDashboard player={lobbyMe} balance={me.cash} position={me.position} owned={ownedNames} isTurn={current.id === selfId} />
      )}
      {me?.held.length ? (
        <div className="card text-sm">Cards held: {me.held.map((h) => h.split(':')[1]).join(', ')}</div>
      ) : null}
      <PlayersStrip game={game} selfId={selfId} offline={offline} />
      {me && !me.bankrupt && <PropertyPanel game={game} selfId={selfId} send={dispatch} />}
      <EventLog log={game.log} />
      {role === 'host' && game.turn.phase !== 'over' && <HostTools game={game} lobby={lobby} pin={pin} onSkip={skipOffline} />}

      <div className="flex flex-wrap justify-center gap-2 text-xs opacity-70">
        {Object.entries(GROUP_COLOR).map(([g, c]) => (
          <span key={g} className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full" style={{ background: c }} />
            {g}
          </span>
        ))}
      </div>
      <button className="btn-ghost" onClick={() => confirm('Leave the game?') && leave()}>
        Leave game
      </button>

      {modal && <CardModal event={modal} onClose={() => setModal(null)} />}
      {game.turn.phase === 'over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" data-testid="game-over">
          <div className="card max-w-xs text-center">
            <div className="text-xs tracking-widest text-gold-light">CHAKRAVARTIN</div>
            <h2 className="my-2 text-3xl font-bold">{winner?.name ?? 'Nobody'}</h2>
            <p className="text-sm opacity-80">{game.winReason === 'timed' ? 'wins on net worth' : 'is the last ruler standing'}</p>
            <button className="btn-gold mt-4 w-full" onClick={leave}>Return home</button>
          </div>
        </div>
      )}
    </main>
  );
}
