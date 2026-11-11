import type { Transport, TransportState } from './Transport';
import { slimSdp } from './signaling';

export interface RtcOptions {
  iceServers?: RTCIceServer[];
  /** Max time to wait for ICE gathering before using what we have. */
  gatherTimeoutMs?: number;
}

/**
 * One RTCPeerConnection with one reliable, ordered RTCDataChannel ("mg").
 * ICE is not trickled: we wait for gathering to finish so that a single offer
 * and a single answer carry every candidate (needed for QR signalling).
 * DataChannels are DTLS-encrypted by WebRTC.
 */
export class WebRTCConnection implements Transport {
  state: TransportState = 'connecting';
  onmessage: ((data: string) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;

  private readonly pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private readonly gatherTimeoutMs: number;

  constructor(opts: RtcOptions = {}) {
    this.gatherTimeoutMs = opts.gatherTimeoutMs ?? 4000;
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers ?? [] });
    this.pc.ondatachannel = (e) => this.bind(e.channel);
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === 'failed' || s === 'closed') this.markClosed();
    };
  }

  /** Host side: create the data channel and an offer SDP (with candidates). */
  async createOffer(): Promise<string> {
    this.bind(this.pc.createDataChannel('mg', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gathered();
    return slimSdp(this.pc.localDescription?.sdp ?? '');
  }

  /** Guest side: accept an offer and produce the answer SDP (with candidates). */
  async acceptOffer(sdp: string): Promise<string> {
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gathered();
    return slimSdp(this.pc.localDescription?.sdp ?? '');
  }

  /** Host side: apply the guest's answer. The channel opens shortly after. */
  async acceptAnswer(sdp: string): Promise<void> {
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  send(data: string): void {
    if (this.state !== 'open' || !this.dc || this.dc.readyState !== 'open') return;
    this.dc.send(data);
  }

  close(): void {
    try {
      this.dc?.close();
    } catch {
      /* already closed */
    }
    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
    this.markClosed();
  }

  private bind(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.onopen = () => {
      if (this.state === 'closed') return;
      this.state = 'open';
      this.onopen?.();
    };
    dc.onclose = () => this.markClosed();
    dc.onmessage = (e) => {
      if (typeof e.data === 'string') this.onmessage?.(e.data);
    };
    if (dc.readyState === 'open') dc.onopen?.(new Event('open'));
  }

  private markClosed(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.onclose?.();
  }

  private gathered(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      const done = () => {
        clearTimeout(timer);
        this.pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      };
      const onChange = () => {
        if (this.pc.iceGatheringState === 'complete') done();
      };
      const timer = setTimeout(done, this.gatherTimeoutMs);
      this.pc.addEventListener('icegatheringstatechange', onChange);
    });
  }
}
