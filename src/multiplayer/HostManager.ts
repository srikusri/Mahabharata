import {
  Envelope,
  InboundGuard,
  MessageType,
  Sequencer,
  isPlainObject,
  newId,
  newPin,
  newSecret,
  parseEnvelope,
  safeEqual,
} from './MessageProtocol';
import {
  LobbyPlayer,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PublicLobby,
  RejectReason,
  isTokenId,
  sanitizeName,
} from './lobby';
import type { Transport } from './Transport';
import { HOST_LIVENESS_TIMEOUT_MS } from './config';

interface Peer {
  transport: Transport;
  guard: InboundGuard;
  playerId: string | null;
  attempts: number;
  lastSeen: number;
}

export type HostEvent =
  | { type: 'joined' | 'resumed' | 'left'; playerId: string }
  | { type: 'rejected'; reason: RejectReason }
  | { type: 'started' }
  | { type: 'resync'; playerId: string }
  | { type: 'action'; playerId: string; payload: Record<string, unknown> };

export interface HostOptions {
  hostName: string;
  hostToken: string;
  roomId?: string;
  hostId?: string;
  pin?: string;
  now?: () => number;
}

const MAX_PIN_ATTEMPTS = 3;
const FATAL: ReadonlySet<RejectReason> = new Set(['ROOM_FULL', 'GAME_STARTED', 'TOO_MANY_ATTEMPTS', 'ID_IN_USE', 'KICKED']);

/**
 * Host-authoritative lobby. The host owns the only copy of the truth; guests
 * send requests, the host validates them and broadcasts the result. Nothing a
 * guest says is trusted: sender identity is pinned per connection, messages are
 * schema-validated, replays are dropped, and the PIN is checked in constant time.
 */
export class HostManager {
  readonly roomId: string;
  readonly hostId: string;
  readonly pin: string;
  readonly hostName: string;

  onChange: ((lobby: PublicLobby) => void) | null = null;
  onEvent: ((e: HostEvent) => void) | null = null;

  private readonly seq: Sequencer;
  private readonly now: () => number;
  private readonly peers = new Set<Peer>();
  private readonly byId = new Map<string, Peer>();
  private readonly secrets = new Map<string, string>();
  private players: LobbyPlayer[];
  private phase: 'lobby' | 'playing' = 'lobby';
  private version = 1;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: HostOptions) {
    const name = sanitizeName(opts.hostName);
    if (!name) throw new Error('Host name is required.');
    if (!isTokenId(opts.hostToken)) throw new Error('Host token is invalid.');
    this.hostName = name;
    this.roomId = opts.roomId ?? newId(6);
    this.hostId = opts.hostId ?? `H${newId(7)}`;
    this.pin = opts.pin ?? newPin();
    this.now = opts.now ?? Date.now;
    this.seq = new Sequencer(this.roomId, this.hostId);
    this.players = [
      { id: this.hostId, name, tokenId: opts.hostToken, ready: true, connected: true, isHost: true },
    ];
  }

  publicLobby(): PublicLobby {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      phase: this.phase,
      version: this.version,
      maxPlayers: MAX_PLAYERS,
      players: this.players.map((p) => ({ ...p })),
    };
  }

  /** Attach a transport (WebRTC data channel, or loopback in tests). */
  attachTransport(t: Transport): void {
    const peer: Peer = {
      transport: t,
      guard: new InboundGuard(this.roomId),
      playerId: null,
      attempts: 0,
      lastSeen: this.now(),
    };
    this.peers.add(peer);
    t.onmessage = (d) => this.handle(peer, d);
    t.onclose = () => this.dropPeer(peer);
    // Unjoined peers get a preview so the join screen can show taken tokens.
    const hello = () => this.sendTo(peer, 'GAME_STATE_UPDATE', { lobby: this.publicLobby() });
    if (t.state === 'open') hello();
    else if (t.state === 'closed') this.dropPeer(peer);
    else t.onopen = hello;
  }

  startGame(): void {
    if (this.phase !== 'lobby') throw new Error('The game has already started.');
    if (this.players.length < MIN_PLAYERS) throw new Error('At least 2 players are needed.');
    if (!this.players.every((p) => p.ready && p.connected)) throw new Error('Not every player is ready.');
    this.phase = 'playing';
    this.version++;
    this.broadcast('GAME_START', { lobby: this.publicLobby() });
    this.emitChange();
    this.onEvent?.({ type: 'started' });
  }

  kick(playerId: string): void {
    const peer = this.byId.get(playerId);
    if (playerId === this.hostId) return;
    if (peer) {
      this.sendTo(peer, 'PLAYER_LEAVE', { rejected: 'KICKED', fatal: true });
      this.removePlayer(playerId);
      peer.playerId = null;
      setTimeout(() => peer.transport.close(), 200);
    }
  }

  /** Drop connections that have gone silent. Call periodically (or use startLivenessMonitor). */
  checkLiveness(timeoutMs = HOST_LIVENESS_TIMEOUT_MS): void {
    const t = this.now();
    for (const peer of [...this.peers]) {
      if (peer.playerId && t - peer.lastSeen > timeoutMs) peer.transport.close();
    }
  }

  startLivenessMonitor(intervalMs = 5000): void {
    this.stopLivenessMonitor();
    this.timer = setInterval(() => this.checkLiveness(), intervalMs);
  }

  stopLivenessMonitor(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stopLivenessMonitor();
    for (const p of [...this.peers]) p.transport.close();
    this.peers.clear();
    this.byId.clear();
  }

  // ---- inbound ------------------------------------------------------------

  private handle(peer: Peer, raw: string): void {
    const env = parseEnvelope(raw);
    if (!env) return;
    if (peer.guard.check(env) !== 'ok') return;
    peer.lastSeen = this.now();

    if (!peer.playerId) {
      if (env.type === 'PLAYER_JOIN') this.onJoin(peer, env);
      return; // nothing else is allowed before joining
    }

    switch (env.type) {
      case 'PLAYER_READY': {
        if (this.phase !== 'lobby' || typeof env.payload.ready !== 'boolean') return;
        const p = this.players.find((x) => x.id === peer.playerId);
        if (p && p.ready !== env.payload.ready) {
          p.ready = env.payload.ready;
          this.bumpAndBroadcast();
        }
        return;
      }
      case 'HEARTBEAT':
        this.sendTo(peer, 'HEARTBEAT', { t: env.payload.t ?? null, reply: true });
        return;
      case 'RESYNC':
        this.sendTo(peer, 'GAME_SNAPSHOT', { lobby: this.publicLobby() });
        if (this.phase === 'playing') this.onEvent?.({ type: 'resync', playerId: peer.playerId });
        return;
      case 'PLAYER_LEAVE': {
        const id = peer.playerId;
        peer.playerId = null;
        this.removePlayer(id);
        peer.transport.close();
        return;
      }
      case 'GAME_ACTION':
        this.onEvent?.({ type: 'action', playerId: peer.playerId, payload: env.payload });
        return;
      default:
        return; // other types are host -> guest only
    }
  }

  private onJoin(peer: Peer, env: Envelope): void {
    const p = env.payload;
    const id = env.senderId;
    const resumeSecret = typeof p.resumeSecret === 'string' ? p.resumeSecret : null;

    const existing = this.players.find((x) => x.id === id);
    if (existing) {
      const secret = this.secrets.get(id);
      if (resumeSecret && secret && safeEqual(resumeSecret, secret)) return this.resume(peer, existing);
      return this.reject(peer, 'ID_IN_USE');
    }
    if (this.phase !== 'lobby') return this.reject(peer, 'GAME_STARTED');
    if (typeof p.pin !== 'string' || !safeEqual(p.pin, this.pin)) {
      peer.attempts++;
      return this.reject(peer, peer.attempts >= MAX_PIN_ATTEMPTS ? 'TOO_MANY_ATTEMPTS' : 'BAD_PIN');
    }
    if (this.players.length >= MAX_PLAYERS) return this.reject(peer, 'ROOM_FULL');
    const name = sanitizeName(p.name);
    if (!name) return this.reject(peer, 'BAD_NAME');
    if (!isTokenId(p.tokenId)) return this.reject(peer, 'BAD_TOKEN');
    if (this.players.some((x) => x.tokenId === p.tokenId)) return this.reject(peer, 'TOKEN_TAKEN');

    const secret = newSecret();
    this.players.push({ id, name, tokenId: p.tokenId, ready: false, connected: true, isHost: false });
    this.secrets.set(id, secret);
    peer.playerId = id;
    this.byId.set(id, peer);
    this.sendTo(peer, 'GAME_SNAPSHOT', { welcome: { playerId: id, secret }, lobby: this.publicLobby() });
    this.bumpAndBroadcast();
    this.onEvent?.({ type: 'joined', playerId: id });
  }

  private resume(peer: Peer, existing: LobbyPlayer): void {
    const old = this.byId.get(existing.id);
    if (old && old !== peer) {
      old.playerId = null; // so its close event does not mark the player offline
      old.transport.close();
    }
    peer.playerId = existing.id;
    this.byId.set(existing.id, peer);
    existing.connected = true;
    this.sendTo(peer, 'GAME_SNAPSHOT', {
      welcome: { playerId: existing.id, secret: this.secrets.get(existing.id) },
      lobby: this.publicLobby(),
    });
    this.bumpAndBroadcast();
    this.onEvent?.({ type: 'resumed', playerId: existing.id });
  }

  private reject(peer: Peer, reason: RejectReason): void {
    const fatal = FATAL.has(reason);
    this.sendTo(peer, 'PLAYER_LEAVE', { rejected: reason, fatal });
    if (fatal) setTimeout(() => peer.transport.close(), 200);
    this.onEvent?.({ type: 'rejected', reason });
  }

  // ---- state --------------------------------------------------------------

  private dropPeer(peer: Peer): void {
    this.peers.delete(peer);
    const id = peer.playerId;
    if (!id || this.byId.get(id) !== peer) return;
    this.byId.delete(id);
    if (this.phase === 'lobby') {
      this.removePlayer(id);
    } else {
      const p = this.players.find((x) => x.id === id);
      if (p) p.connected = false;
      this.bumpAndBroadcast();
      this.onEvent?.({ type: 'left', playerId: id });
    }
  }

  private removePlayer(id: string): void {
    this.players = this.players.filter((p) => p.id !== id);
    this.secrets.delete(id);
    this.byId.delete(id);
    this.bumpAndBroadcast();
    this.onEvent?.({ type: 'left', playerId: id });
  }

  private bumpAndBroadcast(): void {
    this.version++;
    this.broadcast('GAME_STATE_UPDATE', { lobby: this.publicLobby() });
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange?.(this.publicLobby());
  }

  // ---- game state (the engine lives outside; the host only carries it) ------

  /** Send each joined guest their own view of the game (views differ: private events). */
  publishGame(build: (playerId: string) => Record<string, unknown>): void {
    for (const peer of this.peers) {
      if (peer.playerId && peer.transport.state === 'open') this.sendTo(peer, 'GAME_STATE_UPDATE', build(peer.playerId));
    }
  }

  sendGameTo(playerId: string, payload: Record<string, unknown>): void {
    const peer = this.byId.get(playerId);
    if (peer) this.sendTo(peer, 'GAME_STATE_UPDATE', payload);
  }

  // ---- outbound -----------------------------------------------------------

  private sendTo(peer: Peer, type: MessageType, payload: Record<string, unknown>): void {
    if (peer.transport.state !== 'open') return;
    peer.transport.send(JSON.stringify(this.seq.next(type, payload)));
  }

  private broadcast(type: MessageType, payload: Record<string, unknown>): void {
    const data = JSON.stringify(this.seq.next(type, payload));
    for (const peer of this.peers) {
      if (peer.playerId && peer.transport.state === 'open') peer.transport.send(data);
    }
  }
}

// Re-exported for convenience in tests.
export { isPlainObject };
