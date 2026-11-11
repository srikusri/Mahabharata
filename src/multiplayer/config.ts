/**
 * ICE configuration.
 *
 * Default: no ICE servers at all. Peers on the same Wi-Fi connect through local
 * (host) candidates, with zero third-party dependencies and the smallest QR codes.
 *
 * To test across different networks, open the app with ?stun=1 on every device.
 * That adds one public STUN server (it only reveals your public address; game
 * traffic stays peer-to-peer). Symmetric NATs and strict firewalls may still
 * fail without a TURN relay, which this project intentionally does not use.
 */
export function getIceServers(search: string = typeof location !== 'undefined' ? location.search : ''): RTCIceServer[] {
  const q = new URLSearchParams(search);
  if (q.get('stun') === '1') return [{ urls: 'stun:stun.l.google.com:19302' }];
  return [];
}

export const HEARTBEAT_INTERVAL_MS = 3000;
export const HOST_LIVENESS_TIMEOUT_MS = 15000;
export const INVITE_TTL_MS = 3 * 60 * 1000;
