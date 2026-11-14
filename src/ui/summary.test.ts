import { describe, expect, it } from 'vitest';
import { cardEffects, lastAction } from './summary';

const ev = (seq: number, type: string, extra = {}) => ({ seq, type, text: `${type}${seq}`, ...extra });

describe('lastAction', () => {
  it('returns the newest events oldest first and skips turn markers and private lines', () => {
    const log = [ev(1, 'dice'), ev(2, 'move'), ev(3, 'turn'), ev(4, 'peek', { private: 'a' }), ev(5, 'pay'), ev(6, 'buy'), ev(7, 'build')];
    expect(lastAction(log, 3).map((e) => e.seq)).toEqual([5, 6, 7]);
    expect(lastAction(log, 10).map((e) => e.seq)).toEqual([1, 2, 5, 6, 7]);
  });
  it('is empty for an empty log', () => expect(lastAction([])).toEqual([]));
});
describe('cardEffects', () => {
  it('lists what happened after the card in the same update', () => {
    const batch = [ev(1, 'dice'), ev(2, 'move'), ev(3, 'card'), ev(4, 'pay'), ev(5, 'move'), ev(6, 'turn')];
    expect(cardEffects(batch, batch[2]).map((e) => e.seq)).toEqual([4, 5]);
  });
});
