import { InboundGuard, Sequencer, newId, parseEnvelope } from './MessageProtocol';
import { PublicLobby, RejectReason, parseLobby } from './lobby';
import type { Transport } from './Transport';
import { HEARTBEAT_INTERVAL_MS } from './config';

export type GuestStatus = 'connecting' | 'open' | 'joining' | 'joined' | 'rejected' | 'closed';

export interface GuestState {
  status: GuestStatus;
  selfId: string;
  lobby: PublicLobby | null;
  /** Non-fatal join problem (e.g. wrong PIN); the guest may try again. */
  joinError: RejectReason | null;
  /** Fatal reason the host refused or removed this guest. */
  fatalReason: RejectReason | null;
  rttMs: number | null;
  started: boolean;
}

export interface GuestOptions {
  roomId: string;
  hostId: string;
  playerId?: string;
  now?: () => number;
}

export interface GuestProfile {
  pin: string;
  name: string;
  tokenId: string;
}

export interface SavedSession {
  roomId: string;
  playerId: string;
  secret: string;
}

/** Guest side of the lobby. Only ever sends requests; the host decides. */
export class GuestManager {
  readonly roomId: string;
  readonly hostId: string;
  readonly playerId: string;

  onChange: ((s: GuestState) => void) | null = null;
  /** Fired when the host accepts us, so the secret can be persisted for resume. */
  onSession: ((s: SavedSession) => void) | null = null;
  /** Host-sent game state (opaque here; the game layer validates it) and any rejection notice for our last action. */
  onGame: ((msg: { game?: unknown; events?: unknown; error?: string }) => void) | null = null;

  private readonly seq: Sequencer;
  private readonly guard: InboundGuard;
  private readonly now: () => number;
  private transport: Transport | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: GuestState;

  constructor(opts: GuestOptions) {
    this.roomId = opts.roomId;
    this.hostId = opts.hostId;
    this.playerId = opts.playerId ?? `G${newId(7)}`;
    this.now = opts.now ?? Date.now;
    this.seq = new Sequencer(this.roomId, this.playerId);
    this.guard = new InboundGuard(this.roomId, this.hostId);
    this.state = {
      status: 'connecting',
      selfId: this.playerId,
      lobby: null,
      joinError: null,
      fatalReason: null,
      rttMs: null,
      started: false,
    };
  }

  getState(): GuestState {
    return { ...this.state };
  }

  attachTransport(t: Transport): void {
    this.transport = t;
    t.onmessage = (d) => this.handle(d);
    t.onclose = () => {
      this.stopHeartbeat();
      if (this.state.status !== 'rejected') this.set({ status: 'closed' });
    };
    if (t.state === 'open') this.set({ status: 'open' });
    else if (t.state === 'closed') this.set({ status: 'closed' });
    else t.onopen = () => this.set({ status: 'open' });
  }

  join(profile: GuestProfile, resumeSecret?: string): void {
    if (this.state.status !== 'open') throw new Error('Not connected to the host yet.');
    this.set({ status: 'joining', joinError: null });
    this.send('PLAYER_JOIN', {
      pin: profile.pin,
      name: profile.name,
      tokenId: profile.tokenId,
      ...(resumeSecret ? { resumeSecret } : {}),
    });
  }

  setReady(ready: boolean): void {
    this.send('PLAYER_READY', { ready });
  }

  resync(): void {
    this.send('RESYNC', {});
  }

  sendAction(payload: Record<string, unknown>): void {
    this.send('GAME_ACTION', payload);
  }

  leave(): void {
    this.send('PLAYER_LEAVE', {});
    this.dispose();
  }

  startHeartbeat(intervalMs = HEARTBEAT_INTERVAL_MS): void {
    this.stopHeartbeat();
    this.send('HEARTBEAT', { t: this.now() });
    this.timer = setInterval(() => this.send('HEARTBEAT', { t: this.now() }), intervalMs);
  }

  stopHeartbeat(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stopHeartbeat();
    this.transport?.close();
  }

  // ---- internals ----------------------------------------------------------

  private send(type: Parameters<Sequencer['next']>[0], payload: Record<string, unknown>): void {
    if (!this.transport || this.transport.state !== 'open') return;
    this.transport.send(JSON.stringify(this.seq.next(type, payload)));
  }

  private handle(raw: string): void {
    const env = parseEnvelope(raw);
    if (!env || this.guard.check(env) !== 'ok') return; // wrong sender (not the host), replay, wrong room
    const p = env.payload;

    switch (env.type) {
      case 'GAME_STATE_UPDATE': {
        const lobby = parseLobby(p.lobby);
        if (lobby) this.acceptLobby(lobby);
        if (this.state.status === 'joined' && (p.game !== undefined || typeof p.error === 'string')) {
          this.onGame?.({ game: p.game, events: p.events, error: typeof p.error === 'string' ? p.error : undefined });
        }
        return;
      }
      case 'GAME_SNAPSHOT': {
        const lobby = parseLobby(p.lobby);
        const w = p.welcome as { playerId?: unknown; secret?: unknown } | undefined;
        if (w && w.playerId === this.playerId && typeof w.secret === 'string' && lobby) {
          this.set({ status: 'joined', lobby, joinError: null, started: lobby.phase === 'playing' });
          this.onSession?.({ roomId: this.roomId, playerId: this.playerId, secret: w.secret });
          this.startHeartbeat();
        } else if (lobby) {
          this.set({ lobby }); // plain resync
        }
        return;
      }
      case 'GAME_START': {
        const lobby = parseLobby(p.lobby);
        this.set({ started: true, ...(lobby ? { lobby } : {}) });
        return;
      }
      case 'PLAYER_LEAVE': {
        if (typeof p.rejected !== 'string') return;
        const reason = p.rejected as RejectReason;
        if (p.fatal === true) this.set({ status: 'rejected', fatalReason: reason });
        else this.set({ status: 'open', joinError: reason });
        return;
      }
      case 'HEARTBEAT': {
        if (p.reply === true && typeof p.t === 'number') this.set({ rttMs: Math.max(0, this.now() - p.t) });
        return;
      }
      default:
        return;
    }
  }

  private acceptLobby(lobby: PublicLobby): void {
    const cur = this.state.lobby;
    if (cur && lobby.version <= cur.version && cur.roomId === lobby.roomId) return; // stale
    this.set({ lobby, started: this.state.started || lobby.phase === 'playing' });
  }

  private set(patch: Partial<GuestState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange?.(this.getState());
  }
}
