/**
 * Versioned JSON message protocol, validation and replay protection.
 */
export const PROTOCOL_VERSION = 1 as const;

export const MESSAGE_TYPES = [
  'PLAYER_JOIN',
  'PLAYER_LEAVE',
  'PLAYER_READY',
  'GAME_START',
  'GAME_ACTION',
  'GAME_STATE_UPDATE',
  'GAME_SNAPSHOT',
  'TURN_CHANGE',
  'DICE_RESULT',
  'PROPERTY_PURCHASE',
  'TRANSACTION',
  'CARD_DRAW',
  'HEARTBEAT',
  'RECONNECT',
  'RESYNC',
  'GAME_OVER',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface Envelope {
  protocolVersion: typeof PROTOCOL_VERSION;
  roomId: string;
  senderId: string;
  messageId: string;
  sequenceNumber: number;
  type: MessageType;
  payload: Record<string, unknown>;
}

const MAX_RAW_BYTES = 64 * 1024;
const TYPE_SET = new Set<string>(MESSAGE_TYPES);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Parse and strictly validate an inbound message. Returns null for anything malformed. */
export function parseEnvelope(raw: unknown): Envelope | null {
  if (typeof raw !== 'string' || raw.length > MAX_RAW_BYTES) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(o)) return null;
  if (o.protocolVersion !== PROTOCOL_VERSION) return null;
  if (typeof o.roomId !== 'string' || !ID_RE.test(o.roomId)) return null;
  if (typeof o.senderId !== 'string' || !ID_RE.test(o.senderId)) return null;
  if (typeof o.messageId !== 'string' || !ID_RE.test(o.messageId)) return null;
  if (!Number.isSafeInteger(o.sequenceNumber) || (o.sequenceNumber as number) < 0) return null;
  if (typeof o.type !== 'string' || !TYPE_SET.has(o.type)) return null;
  if (!isPlainObject(o.payload)) return null;
  return o as unknown as Envelope;
}

const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}

/** Short human-friendly random id (room ids, player ids, message ids). */
export function newId(len = 8): string {
  return Array.from(randomBytes(len), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/** 128-bit hex secret (used to prove identity when a player resumes). */
export function newSecret(): string {
  return Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 4-digit PIN, uniformly distributed (rejection sampling). */
export function newPin(): string {
  const limit = 4294960000; // largest multiple of 10000 <= 2^32
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 10000).padStart(4, '0');
  }
}

/** Comparison that does not short-circuit on the first differing character. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Builds outbound envelopes with a strictly increasing per-connection sequence number. */
export class Sequencer {
  private seq = 0;
  constructor(
    readonly roomId: string,
    readonly senderId: string,
  ) {}

  next(type: MessageType, payload: Record<string, unknown> = {}): Envelope {
    return {
      protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId,
      senderId: this.senderId,
      messageId: newId(12),
      sequenceNumber: ++this.seq,
      type,
      payload,
    };
  }
}

export type GuardResult = 'ok' | 'bad_room' | 'bad_sender' | 'duplicate' | 'stale';

/**
 * Per-connection inbound filter: right room, one fixed sender, no duplicate
 * message ids, strictly increasing sequence numbers (data channels are ordered
 * and reliable, so anything <= the last accepted sequence is a replay).
 *
 * If no expected sender is given, the first accepted message pins the sender.
 */
export class InboundGuard {
  private lastSeq = 0;
  private seen = new Set<string>();
  private order: string[] = [];
  private sender: string | null;

  constructor(
    private readonly roomId: string,
    expectedSender: string | null = null,
    private readonly cap = 512,
  ) {
    this.sender = expectedSender;
  }

  check(env: Envelope): GuardResult {
    if (env.roomId !== this.roomId) return 'bad_room';
    if (this.sender !== null && env.senderId !== this.sender) return 'bad_sender';
    if (this.seen.has(env.messageId)) return 'duplicate';
    if (env.sequenceNumber <= this.lastSeq) return 'stale';
    if (this.sender === null) this.sender = env.senderId;
    this.lastSeq = env.sequenceNumber;
    this.seen.add(env.messageId);
    this.order.push(env.messageId);
    if (this.order.length > this.cap) this.seen.delete(this.order.shift() as string);
    return 'ok';
  }
}
