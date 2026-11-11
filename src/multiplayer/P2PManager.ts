import { HostManager } from './HostManager';
import { GuestManager, GuestState, SavedSession } from './GuestManager';
import { WebRTCConnection, RtcOptions } from './WebRTCConnection';
import { decodeSignal, encodeSignal } from './signaling';
import { newId } from './MessageProtocol';
import { INVITE_TTL_MS } from './config';

export interface Invite {
  slot: string;
  /** The OFFER code to show as a QR (the guest scans this first). */
  code: string;
}

interface Pending {
  conn: WebRTCConnection;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Host-side pairing. One invite = one WebRTC peer connection = one guest seat.
 *
 *   createInvite()      -> OFFER code (host shows)
 *   completeInvite(ans) <- ANSWER code (host scans from the guest)
 */
export class HostSession {
  private readonly pending = new Map<string, Pending>();

  constructor(
    readonly manager: HostManager,
    private readonly rtc: RtcOptions = {},
  ) {}

  async createInvite(): Promise<Invite> {
    const conn = new WebRTCConnection(this.rtc);
    const slot = newId(6);
    try {
      const sdp = await conn.createOffer();
      const code = await encodeSignal({
        role: 'offer',
        roomId: this.manager.roomId,
        hostId: this.manager.hostId,
        hostName: this.manager.hostName,
        slot,
        sdp,
      });
      const timer = setTimeout(() => this.cancelInvite(slot), INVITE_TTL_MS);
      this.pending.set(slot, { conn, timer });
      return { slot, code };
    } catch (e) {
      conn.close();
      throw e;
    }
  }

  async completeInvite(answerCode: string): Promise<void> {
    const sig = await decodeSignal(answerCode);
    if (sig.role !== 'answer') throw new Error('That is an invite code, not a reply. Scan the code on the other phone after it has scanned yours.');
    if (sig.roomId !== this.manager.roomId) throw new Error('That reply is for a different game.');
    const entry = this.pending.get(sig.slot);
    if (!entry) throw new Error('That invite expired or was already used. Create a new invite.');
    clearTimeout(entry.timer);
    this.pending.delete(sig.slot);
    // Attach first so the channel-open event is never missed.
    this.manager.attachTransport(entry.conn);
    await entry.conn.acceptAnswer(sig.sdp);
  }

  cancelInvite(slot: string): void {
    const entry = this.pending.get(slot);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.conn.close();
    this.pending.delete(slot);
  }

  dispose(): void {
    for (const slot of [...this.pending.keys()]) this.cancelInvite(slot);
    this.manager.dispose();
  }
}

export interface GuestSessionOptions {
  rtc?: RtcOptions;
  /** Keep this player id (rejoining a seat after the host returned or changed). */
  playerId?: string;
  onState?: (s: GuestState) => void;
  onGame?: (m: { game?: unknown; events?: unknown; error?: string }) => void;
  loadSaved?: () => Promise<SavedSession | null>;
  saveSession?: (s: SavedSession) => void;
}

/** Guest-side pairing: scan OFFER -> show ANSWER -> channel opens -> join. */
export class GuestSession {
  manager: GuestManager | null = null;
  hostName = '';
  resumeSecret: string | undefined;
  private conn: WebRTCConnection | null = null;

  constructor(private readonly opts: GuestSessionOptions = {}) {}

  async acceptOffer(offerCode: string): Promise<{ answerCode: string; hostName: string; roomId: string }> {
    const sig = await decodeSignal(offerCode);
    if (sig.role !== 'offer' || !sig.hostId) throw new Error('That is a reply code, not an invite. Scan the code shown on the host phone.');

    const saved = (await this.opts.loadSaved?.()) ?? null;
    const resume = saved && saved.roomId === sig.roomId ? saved : null;
    this.resumeSecret = resume?.secret;

    this.dispose();
    const conn = new WebRTCConnection(this.opts.rtc);
    const manager = new GuestManager({ roomId: sig.roomId, hostId: sig.hostId, playerId: resume?.playerId ?? this.opts.playerId });
    manager.onChange = (s) => this.opts.onState?.(s);
    manager.onSession = (s) => this.opts.saveSession?.(s);
    manager.onGame = (m) => this.opts.onGame?.(m);
    manager.attachTransport(conn);
    this.conn = conn;
    this.manager = manager;
    this.hostName = sig.hostName ?? '';

    const sdp = await conn.acceptOffer(sig.sdp);
    const answerCode = await encodeSignal({
      role: 'answer',
      roomId: sig.roomId,
      slot: sig.slot,
      guestId: manager.playerId,
      sdp,
    });
    this.opts.onState?.(manager.getState());
    return { answerCode, hostName: this.hostName, roomId: sig.roomId };
  }

  dispose(): void {
    this.manager?.dispose();
    this.conn?.close();
    this.manager = null;
    this.conn = null;
  }
}
