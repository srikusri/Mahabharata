import { describe, expect, it } from 'vitest';
import {
  Envelope,
  InboundGuard,
  Sequencer,
  newId,
  newPin,
  parseEnvelope,
  safeEqual,
} from './MessageProtocol';

const env = (over: Partial<Envelope> = {}): Envelope => ({
  protocolVersion: 1,
  roomId: 'ROOM1',
  senderId: 'P2',
  messageId: 'M1',
  sequenceNumber: 1,
  type: 'GAME_ACTION',
  payload: { action: 'ROLL_DICE' },
  ...over,
});

describe('parseEnvelope', () => {
  it('accepts a valid message', () => {
    expect(parseEnvelope(JSON.stringify(env()))?.payload).toEqual({ action: 'ROLL_DICE' });
  });

  it.each([
    ['not json', '{nope'],
    ['not an object', '[1,2]'],
    ['wrong version', JSON.stringify(env({ protocolVersion: 2 as never }))],
    ['unknown type', JSON.stringify(env({ type: 'HACK' as never }))],
    ['bad room chars', JSON.stringify(env({ roomId: 'a b' }))],
    ['negative seq', JSON.stringify(env({ sequenceNumber: -1 }))],
    ['float seq', JSON.stringify(env({ sequenceNumber: 1.5 }))],
    ['array payload', JSON.stringify({ ...env(), payload: [] })],
    ['null payload', JSON.stringify({ ...env(), payload: null })],
    ['huge', 'x'.repeat(70_000)],
  ])('rejects %s', (_n, raw) => {
    expect(parseEnvelope(raw)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(parseEnvelope(42)).toBeNull();
    expect(parseEnvelope(undefined)).toBeNull();
  });
});

describe('InboundGuard', () => {
  it('accepts increasing sequence numbers and pins the sender', () => {
    const g = new InboundGuard('ROOM1');
    expect(g.check(env({ messageId: 'a', sequenceNumber: 1 }))).toBe('ok');
    expect(g.check(env({ messageId: 'b', sequenceNumber: 5 }))).toBe('ok'); // gaps are fine
    expect(g.check(env({ messageId: 'c', senderId: 'EVIL', sequenceNumber: 6 }))).toBe('bad_sender');
  });

  it('rejects replays and out-of-order sequence numbers', () => {
    const g = new InboundGuard('ROOM1');
    g.check(env({ messageId: 'a', sequenceNumber: 3 }));
    expect(g.check(env({ messageId: 'a', sequenceNumber: 4 }))).toBe('duplicate');
    expect(g.check(env({ messageId: 'b', sequenceNumber: 3 }))).toBe('stale');
    expect(g.check(env({ messageId: 'c', sequenceNumber: 2 }))).toBe('stale');
  });

  it('rejects the wrong room and a wrong pre-set sender', () => {
    const g = new InboundGuard('ROOM1', 'HOST');
    expect(g.check(env({ roomId: 'OTHER' }))).toBe('bad_room');
    expect(g.check(env({ senderId: 'P2' }))).toBe('bad_sender');
    expect(g.check(env({ senderId: 'HOST', messageId: 'z' }))).toBe('ok');
  });

  it('does not advance state on rejected messages', () => {
    const g = new InboundGuard('ROOM1');
    g.check(env({ messageId: 'a', sequenceNumber: 2 }));
    g.check(env({ messageId: 'b', sequenceNumber: 1 })); // stale, rejected
    expect(g.check(env({ messageId: 'c', sequenceNumber: 3 }))).toBe('ok');
  });
});

describe('Sequencer and ids', () => {
  it('numbers messages 1, 2, 3 with unique ids', () => {
    const s = new Sequencer('ROOM1', 'P1');
    const a = s.next('HEARTBEAT');
    const b = s.next('HEARTBEAT');
    expect([a.sequenceNumber, b.sequenceNumber]).toEqual([1, 2]);
    expect(a.messageId).not.toBe(b.messageId);
    expect(parseEnvelope(JSON.stringify(a))).not.toBeNull();
  });

  it('generates 4-digit pins and valid ids', () => {
    for (let i = 0; i < 200; i++) expect(newPin()).toMatch(/^\d{4}$/);
    expect(newId(8)).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('safeEqual compares correctly', () => {
    expect(safeEqual('1234', '1234')).toBe(true);
    expect(safeEqual('1234', '1235')).toBe(false);
    expect(safeEqual('1234', '123')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});
