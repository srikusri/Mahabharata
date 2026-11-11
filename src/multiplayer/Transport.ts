/**
 * Transport abstraction. Everything above this file (HostManager, GuestManager,
 * the message protocol) is independent of WebRTC, so the same logic can be
 * unit-tested over an in-memory loopback and run in production over a
 * RTCDataChannel.
 */
export type TransportState = 'connecting' | 'open' | 'closed';

export interface Transport {
  readonly state: TransportState;
  send(data: string): void;
  close(): void;
  onmessage: ((data: string) => void) | null;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
}

class Loopback implements Transport {
  state: TransportState = 'open';
  onmessage: ((data: string) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  peer!: Loopback;

  send(data: string): void {
    if (this.state !== 'open') return;
    const p = this.peer;
    queueMicrotask(() => {
      if (p.state === 'open') p.onmessage?.(data);
    });
  }

  close(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.onclose?.();
    const p = this.peer;
    queueMicrotask(() => p.remoteClosed());
  }

  private remoteClosed(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.onclose?.();
  }
}

/** Two connected in-memory transports (already open). Used by tests and dev tooling. */
export function createLoopbackPair(): [Transport, Transport] {
  const a = new Loopback();
  const b = new Loopback();
  a.peer = b;
  b.peer = a;
  return [a, b];
}
