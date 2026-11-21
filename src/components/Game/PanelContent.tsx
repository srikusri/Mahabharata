import { GROUP_COLOR } from '../../engine/board';
import type { Action, PublicState } from '../../engine';
import type { PublicLobby } from '../../multiplayer/lobby';
import { EndGamePanel } from './EndGamePanel';
import { EventLog } from './EventLog';
import { HostTools } from './HostTools';
import { PlayersStrip } from './PlayersStrip';
import { PropertyPanel } from './PropertyPanel';
import type { Tab } from './TabBar';

/** What each tab shows. The same content appears in a bottom sheet on phones and inline on wide screens. */
export function PanelContent(props: {
  tab: Tab;
  game: PublicState;
  lobby: PublicLobby;
  selfId: string;
  isHost: boolean;
  pin: string | null;
  offline: Set<string>;
  send: (a: Action) => void;
  onSkip: (id: string) => void;
  onLeave: () => void;
}) {
  const { tab, game, lobby, selfId, isHost, pin, offline, send, onSkip, onLeave } = props;
  const me = game.players.find((p) => p.id === selfId);
  if (tab === 'kingdoms')
    return (
      <>
        {me?.held.length ? (
          <div className="card text-sm" data-testid="held-cards">
            Cards held: {me.held.map((h) => h.split(':')[1]).join(', ')}
          </div>
        ) : null}
        {me && !me.bankrupt ? <PropertyPanel game={game} selfId={selfId} send={send} /> : <p className="card text-sm opacity-70">You are out of the game.</p>}
      </>
    );
  if (tab === 'players') return <PlayersStrip game={game} selfId={selfId} offline={offline} />;
  if (tab === 'log') return <EventLog log={game.log} />;
  return (
    <>
      <EndGamePanel game={game} selfId={selfId} send={send} />
      {isHost && game.turn.phase !== 'over' && <HostTools game={game} lobby={lobby} pin={pin} onSkip={onSkip} />}
      <div className="flex flex-wrap justify-center gap-2 text-xs opacity-70">
        {Object.entries(GROUP_COLOR).map(([g, c]) => (
          <span key={g} className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full" style={{ background: c }} />
            {g}
          </span>
        ))}
      </div>
      <button className="btn-ghost" onClick={onLeave} data-testid="leave">
        Leave game
      </button>
    </>
  );
}
