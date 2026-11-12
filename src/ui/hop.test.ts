import { describe, expect, it } from 'vitest';
import { cashDeltas, hopPath, standings } from './hop';

describe('hopPath', () => {
  it('walks forward space by space', () => expect(hopPath(3, 7)).toEqual([4, 5, 6, 7]));
  it('wraps past GO', () => expect(hopPath(38, 2)).toEqual([39, 0, 1, 2]));
  it('jumps for long or backward moves', () => {
    expect(hopPath(30, 10)).toEqual([10]);
    expect(hopPath(20, 17)).toEqual([17]);
  });
  it('stays put when unchanged', () => expect(hopPath(5, 5)).toEqual([]));
});
describe('cashDeltas', () => {
  it('reports only changes', () => expect(cashDeltas({ a: 100, b: 50 }, { a: 80, b: 50, c: 9 })).toEqual({ a: -20 }));
});
describe('standings', () => {
  it('puts winner first, bankrupt last, rest by net worth', () => {
    const p = (id: string, net: number, bankrupt = false) => ({ id, name: id, tokenId: 'crown', net, bankrupt });
    expect(standings([p('a', 10, true), p('b', 900), p('c', 500), p('d', 50)], 'd').map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});
