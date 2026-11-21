import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameEvent } from '../engine';
import { Board, Ownership } from '../components/Board/Board';
import { ActionBar } from '../components/Game/ActionBar';
import { ConnectionLost } from '../components/Game/ConnectionLost';
import { CardModal } from '../components/Game/CardModal';
import { Dice } from '../components/Game/Dice';
import { ConnectionBadge } from '../components/Lobby/ConnectionBadge';
import { TOKEN_STYLE } from '../components/Player/tokens';
import type { TokenId } from '../multiplayer/lobby';
import { useStore } from '../state/connectionStore';
import { DeedModal } from '../components/Game/DeedModal';
import { GyanCard } from '../components/Game/GyanCard';
import { SettingsSheet } from '../components/Game/SettingsSheet';
import { LastAction } from '../components/Game/LastAction';
import { cardEffects, gyanTrigger, type GyanTrigger } from '../ui/summary';
import { Standings } from '../components/Game/Standings';
import { TurnToast } from '../components/Game/TurnToast';
import { play, sfxFor } from '../ui/sound';
import { useUi } from '../ui/prefs';
import { useHopPositions } from '../ui/useHopPositions';
import { useWakeLock } from '../ui/useWakeLock';
import { useMedia } from '../ui/useMedia';
import { MeBar } from '../components/Game/MeBar';
import { PlayerChips } from '../components/Game/PlayerChips';
import { Sheet } from '../components/Game/Sheet';
import { TabBar, type Tab } from '../components/Game/TabBar';
import { PanelContent } from '../components/Game/PanelContent';
import { END_VOTE_AFTER_ROUNDS } from '../engine';

export function PlayScreen() {
  const { lobby, selfId, guest, role, leave, game, events, gameError, clearError, dispatch, reconnect, takeOver, skipOffline, pin } = useStore();
  const [modal, setModal] = useState<{ event: GameEvent; effects: GameEvent[] } | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const lastVersion = useRef(-1);
  const [deed, setDeed] = useState<number | null>(null);
  const gyanOn = useUi((s) => s.gyan);
  const [gyan, setGyan] = useState<GyanTrigger | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const wide = useMedia('(min-width: 1024px)');
  const voteKey = useRef('');
  useWakeLock(!!game && game.turn.phase !== 'over');
  const targets = useMemo(() => Object.fromEntries((game?.players ?? []).filter((p) => !p.bankrupt).map((p) => [p.id, p.position])), [game]);
  const hopped = useHopPositions(targets, () => play('step'));

  // React to the events of each new state: tumble the dice, show drawn cards.
  useEffect(() => {
    if (!game || game.version === lastVersion.current) return;
    lastVersion.current = game.version;
    if (events.some((e) => e.type === 'dice')) setRollKey((k) => k + 1);
    const sounds = new Set(events.map((e) => sfxFor(e.type)).filter((x): x is NonNullable<typeof x> => !!x));
    sounds.forEach((x) => play(x));
    const g = gyanTrigger(events, game.players);
    if (g) setGyan(g);
    const card = events.find((e) => e.type === 'card' && e.data?.title) ?? events.find((e) => e.type === 'peek');
    if (card) setModal({ event: card, effects: card.type === 'card' ? cardEffects(events, card) : [] });
  }, [game, events]);

  useEffect(() => {
    if (!gameError) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [gameError, clearError]);

  // A proposal to end the game that I have not answered opens the Menu sheet by itself.
  useEffect(() => {
    const v = game?.endVote;
    if (!game || !v || !selfId) { voteKey.current = ''; return; }
    const key = `${v.by}:${game.version >= 0 ? v.by : ''}`;
    const alive = game.players.some((p) => p.id === selfId && !p.bankrupt);
    if (alive && !v.agreed.includes(selfId) && voteKey.current !== key) {
      voteKey.current = key;
      if (!wide) setTab('menu');
    }
  }, [game, selfId, wide]);

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

  const current = game.players[game.turn.index];
  const offline = new Set(lobby.players.filter((p) => !p.connected).map((p) => p.id));
  const tokens = game.players.filter((p) => !p.bankrupt).map((p) => ({ id: p.id, tokenId: p.tokenId as TokenId, position: hopped[p.id] ?? p.position, name: p.name }));
  const winner = game.players.find((p) => p.id === game.winner);
  const myToken = TOKEN_STYLE[current.tokenId as TokenId];
  const voteAlert = game.turn.phase !== 'over' && (!!game.endVote || game.turn.round - 1 >= END_VOTE_AFTER_ROUNDS);
  const shownTab: Tab | null = wide ? (tab ?? 'players') : tab;
  const toggle = (t: Tab) => setTab((cur) => (!wide && cur === t ? null : t));

  const panel = (t: Tab) => (
    <PanelContent
      tab={t}
      game={game}
      lobby={lobby}
      selfId={selfId}
      isHost={role === 'host'}
      pin={pin}
      offline={offline}
      send={dispatch}
      onSkip={skipOffline}
      onLeave={() => confirm('Leave the game?') && leave()}
    />
  );
  const titles: Record<Tab, string> = { kingdoms: 'My kingdoms', players: 'Players', log: 'Chronicle', menu: 'Menu' };

  const header = (
    <header className="flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold text-gold-light" data-testid="turn-title">
        <i className="h-3 w-3 shrink-0 rounded-full" style={{ background: myToken?.color }} />
        <span className="truncate">{game.turn.phase === 'over' ? 'Game over' : current.id === selfId ? 'Your turn' : `${current.name}'s turn`}</span>
      </h2>
      <div className="flex items-center gap-3 text-xs">
        <span className="opacity-70">Round {game.turn.round}</span>
        <SettingsSheet />
        <ConnectionBadge status={role === 'host' ? 'host' : (guest?.status ?? 'closed')} rttMs={guest?.rttMs} />
      </div>
    </header>
  );
  const board = (
    <div className="mx-auto w-full" style={{ maxWidth: wide ? undefined : 'min(100%, max(250px, calc(100dvh - 340px)))' }}>
      <Board tokens={tokens} activeIndex={current.position} ownership={ownership} onSelect={setDeed} center={<Dice dice={game.turn.dice} rollKey={rollKey} />} />
    </div>
  );
  const gyanCard = gyanOn && gyan && <GyanCard trigger={gyan} onClose={() => setGyan(null)} />;
  const errorToast = gameError && (
    <div role="alert" data-testid="game-error" className="fixed left-3 right-3 top-12 z-50 mx-auto max-w-md rounded-lg bg-red-900/95 p-2 text-center text-sm shadow-xl" onClick={clearError}>
      {gameError}
    </div>
  );
  const lost = role === 'guest' && guest?.status === 'closed' && game.turn.phase !== 'over' && (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-md">
        <ConnectionLost game={game} lobby={lobby} selfId={selfId} onReconnect={reconnect} onTakeOver={takeOver} />
      </div>
    </div>
  );

  const overlays = (
    <>
      {errorToast}
      {lost}
      {deed !== null && <DeedModal index={deed} game={game} onClose={() => setDeed(null)} />}
      {modal && (
        <CardModal
          event={modal.event}
          effects={modal.effects}
          who={game.players.find((p) => p.id === modal.event.playerId)?.name ?? 'A player'}
          mine={modal.event.playerId === selfId}
          onClose={() => setModal(null)}
        />
      )}
      {game.turn.phase === 'over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" data-testid="game-over">
          <div className="card max-h-full max-w-xs overflow-y-auto text-center">
            <div className="text-xs tracking-widest text-gold-light">CHAKRAVARTIN</div>
            <h2 className="my-2 text-3xl font-bold">{winner?.name ?? 'Nobody'}</h2>
            <p className="text-sm opacity-80">{game.winReason === 'agreed' ? 'wins on net worth, by agreement' : game.winReason === 'timed' ? 'wins on net worth' : 'is the last ruler standing'}</p>
            <Standings game={game} />
            <button className="btn-gold mt-4 w-full" onClick={leave}>Return home</button>
          </div>
        </div>
      )}
    </>
  );

  if (wide)
    return (
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_380px] items-start gap-4 p-3">
        <TurnToast myTurn={current.id === selfId} phase={game.turn.phase} />
        <div className="sticky top-3 flex flex-col gap-3">
          {header}
          {board}
          <LastAction game={game} />
          {gyanCard}
        </div>
        <div className="flex flex-col gap-3">
          <ActionBar game={game} selfId={selfId} send={dispatch} />
          <MeBar game={game} selfId={selfId} onOpen={() => setTab('kingdoms')} />
          <PlayerChips game={game} selfId={selfId} offline={offline} />
          <TabBar tab={shownTab} onTab={toggle} alert={{ menu: voteAlert }} />
          {shownTab && panel(shownTab)}
        </div>
        {overlays}
      </main>
    );

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col gap-2 overflow-hidden p-2">
      <TurnToast myTurn={current.id === selfId} phase={game.turn.phase} />
      {header}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        {board}
        <LastAction game={game} max={3} onOpen={() => setTab('log')} />
      </div>
      <PlayerChips game={game} selfId={selfId} offline={offline} />
      <MeBar game={game} selfId={selfId} onOpen={() => setTab('kingdoms')} />
      <div className="safe-b flex flex-col gap-2">
        <ActionBar game={game} selfId={selfId} send={dispatch} />
        <TabBar tab={tab} onTab={toggle} alert={{ menu: voteAlert }} />
      </div>
      {gyanCard && <div className="fixed left-2 right-2 top-12 z-30 mx-auto max-w-md overflow-hidden rounded-xl bg-navy shadow-2xl">{gyanCard}</div>}
      {tab && (
        <Sheet title={titles[tab]} onClose={() => setTab(null)} testId={`sheet-${tab}`}>
          {panel(tab)}
        </Sheet>
      )}
      {overlays}
    </main>
  );
}
