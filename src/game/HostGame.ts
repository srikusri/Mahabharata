/**
 * Glue between the authoritative engine and the host's connections.
 * Guests only ever send Action requests; this validates each one with the engine, applies it, and
 * publishes each player's own view of the new state. Nothing here is rendered; the UI subscribes.
 */
import { Action, ActionResult, GameEvent, GameState, NewPlayer, PublicState, applyAction, createGame, parseAction, publicView, randomSeed } from '../engine';
import type { Settings } from '../engine';
import type { HostManager } from '../multiplayer/HostManager';

export interface HostGameOptions {
  seed?: number;
  settings?: Partial<Settings>;
}

export class HostGame {
  state: GameState;
  /** Host UI subscription: the host's own view plus the events of the action that produced it. */
  onView: ((view: PublicState, events: GameEvent[]) => void) | null = null;

  constructor(private readonly host: HostManager, players: NewPlayer[], opts: HostGameOptions = {}) {
    this.state = createGame(players, opts.seed ?? randomSeed(), opts.settings);
  }

  /** Called for every HostManager event. */
  handleHostEvent(e: { type: string; playerId?: string; payload?: Record<string, unknown> }): void {
    if (e.type === 'action' && e.playerId) this.handleRemote(e.playerId, e.payload ?? {});
    else if ((e.type === 'resumed' || e.type === 'resync') && e.playerId) this.sendSnapshot(e.playerId);
  }

  /** The host player's own action. */
  dispatchLocal(action: Action): ActionResult {
    return this.apply(this.host.hostId, action);
  }

  hostView(): PublicState {
    return publicView(this.state, this.host.hostId);
  }

  /** Initial broadcast when the game starts. */
  publishAll(events: GameEvent[] = []): void {
    this.host.publishGame((pid) => this.payloadFor(pid, events));
    this.onView?.(this.hostView(), events.filter((e) => !e.private || e.private === this.host.hostId));
  }

  private handleRemote(playerId: string, payload: Record<string, unknown>): void {
    const action = parseAction(payload);
    if (!action) return this.host.sendGameTo(playerId, { error: 'Unrecognised action' });
    this.apply(playerId, action);
  }

  private apply(playerId: string, action: Action): ActionResult {
    const r = applyAction(this.state, playerId, action);
    if (!r.ok) {
      if (playerId !== this.host.hostId) this.host.sendGameTo(playerId, { error: r.error });
      return r;
    }
    this.state = r.state;
    this.publishAll(r.events);
    return r;
  }

  private sendSnapshot(playerId: string): void {
    this.host.sendGameTo(playerId, this.payloadFor(playerId, []));
  }

  private payloadFor(playerId: string, events: GameEvent[]): Record<string, unknown> {
    return { game: publicView(this.state, playerId), events: events.filter((e) => !e.private || e.private === playerId) };
  }
}
