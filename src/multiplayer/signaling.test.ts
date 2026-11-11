import { describe, expect, it } from 'vitest';
import { PartAssembler, SignalPayload, decodeSignal, encodeSignal, slimSdp, splitForQr } from './signaling';

// A realistic Chrome data-channel-only offer with host + srflx + tcp + link-local candidates.
const SDP = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:842163049 1 udp 1677729535 203.0.113.7 51372 typ srflx raddr 192.168.1.23 rport 51372 generation 0 network-cost 999',
  'a=candidate:1467250027 1 udp 2122260223 192.168.1.23 51372 typ host generation 0 network-cost 999',
  'a=candidate:3500000001 1 tcp 1518280447 192.168.1.23 9 typ host tcptype active generation 0 network-cost 999',
  'a=candidate:3500000002 1 udp 2122194687 fe80::1c2b:3dff:fe4a:5b6c 53000 typ host generation 0 network-cost 999',
  'a=ice-ufrag:Zq8f',
  'a=ice-pwd:3pIX0yG6k1m0W9v5k2Q8oHnA',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 6B:0F:0E:0F:C3:9A:5D:11:8E:4A:77:21:3C:B0:5E:99:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

const offer = (over: Partial<SignalPayload> = {}): SignalPayload => ({
  role: 'offer',
  roomId: 'ROOM12',
  slot: 'SLOT01',
  hostId: 'HABCDEFG',
  hostName: 'Arjuna',
  sdp: SDP,
  ...over,
});

describe('slimSdp', () => {
  it('drops tcp and link-local candidates but keeps udp host/srflx', () => {
    const out = slimSdp(SDP);
    expect(out).not.toMatch(/ tcp /);
    expect(out).not.toMatch(/fe80:/);
    expect(out).toMatch(/typ host/);
    expect(out).toMatch(/typ srflx/);
    expect(out.startsWith('v=0')).toBe(true);
    expect(out.endsWith('\r\n')).toBe(true);
  });
});

describe('encode/decode', () => {
  it('round-trips an offer and keeps the code QR-friendly', async () => {
    const code = await encodeSignal(offer());
    expect(code).toMatch(/^MG1\.[zr]\.[A-Za-z0-9_-]+$/);
    const back = await decodeSignal(code);
    expect(back.role).toBe('offer');
    expect(back.hostName).toBe('Arjuna');
    expect(back.sdp).toBe(slimSdp(SDP));
    expect(code.length).toBeLessThan(1200);
  });

  it('compresses when streams are available', async () => {
    const code = await encodeSignal(offer());
    expect(code.startsWith('MG1.z.')).toBe(true);
    expect(code.length).toBeLessThan(JSON.stringify(offer()).length);
  });

  it('round-trips an answer', async () => {
    const code = await encodeSignal({ role: 'answer', roomId: 'ROOM12', slot: 'SLOT01', guestId: 'GXYZ', sdp: SDP });
    const back = await decodeSignal(code);
    expect(back.role).toBe('answer');
    expect(back.guestId).toBe('GXYZ');
  });

  it('rejects garbage, truncated and incomplete codes', async () => {
    await expect(decodeSignal('hello')).rejects.toThrow();
    const code = await encodeSignal(offer());
    await expect(decodeSignal(code.slice(0, -10))).rejects.toThrow();
    const noHost = await encodeSignal({ ...offer(), hostId: undefined });
    await expect(decodeSignal(noHost)).rejects.toThrow(/incomplete/);
  });
});

describe('multi-part QR', () => {
  const big = 'MG1.r.' + 'A'.repeat(1900);

  it('keeps short codes as a single QR', () => {
    expect(splitForQr('MG1.r.abc', 600)).toEqual(['MG1.r.abc']);
  });

  it('splits long codes and reassembles in any order, with repeats', () => {
    const parts = splitForQr(big, 600);
    expect(parts.length).toBe(4);
    expect(parts.every((p) => p.length < 650)).toBe(true);
    const a = new PartAssembler();
    const order = [2, 0, 0, 3, 2, 1];
    let last = a.add(parts[order[0]]);
    expect(last.complete).toBe(false);
    for (const i of order.slice(1)) last = a.add(parts[i]);
    expect(last.complete).toBe(true);
    expect(last.code).toBe(big);
  });

  it('reports progress and resets when a different code starts scanning', () => {
    const p1 = splitForQr(big, 600);
    const p2 = splitForQr('MG1.r.' + 'B'.repeat(1900), 600);
    const a = new PartAssembler();
    a.add(p1[0]);
    const r = a.add(p2[1]);
    expect(r.have).toBe(1);
    expect(r.total).toBe(4);
  });

  it('passes whole codes straight through and ignores unrelated QR codes', () => {
    const a = new PartAssembler();
    expect(a.add('MG1.r.abc').code).toBe('MG1.r.abc');
    expect(a.add('https://example.com').ignored).toBe(true);
  });

  it('survives a full encode -> split -> assemble -> decode trip', async () => {
    const o = offer({ sdp: SDP + 'a=candidate:1 1 udp 2122260223 10.0.0.' + '9'.repeat(300) + ' 1 typ host\r\n' });
    const code = await encodeSignal(o);
    const a = new PartAssembler();
    let res;
    for (const part of splitForQr(code, 200)) res = a.add(part);
    expect(res?.complete).toBe(true);
    expect((await decodeSignal(res?.code as string)).roomId).toBe('ROOM12');
  });
});
