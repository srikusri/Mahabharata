import { describe, expect, it } from 'vitest';
import { SPACES } from '../engine/board';
import { GYAN, gyanFor, pickFact } from './gyan';
import { gyanTrigger } from '../ui/summary';

describe('gyan content', () => {
  it('has learning facts for every space on the board', () => {
    const missing = SPACES.filter((s) => !GYAN[s.name]).map((s) => s.name);
    expect(missing).toEqual([]);
  });
  it('has no entries for spaces that do not exist (typos)', () => {
    const names = new Set(SPACES.map((s) => s.name));
    expect(Object.keys(GYAN).filter((k) => !names.has(k))).toEqual([]);
  });
  it('keeps every fact short enough for a child to read on a phone, with at least two per space', () => {
    for (const [name, g] of Object.entries(GYAN)) {
      expect(g.facts.length, name).toBeGreaterThanOrEqual(2);
      for (const f of g.facts) {
        expect(f.length, `${name}: ${f.slice(0, 30)}`).toBeLessThanOrEqual(420);
        expect(f.trim(), name).toBe(f);
        expect(f, name).not.toMatch(/\s{2,}/);
      }
      expect(new Set(g.facts).size, name).toBe(g.facts.length);
    }
  });
  it('picks the same fact for the same event number, and rotates through all of them', () => {
    const g = GYAN.Hastinapura;
    expect(pickFact(g, 41)).toBe(pickFact(g, 41));
    expect(new Set(g.facts.map((_, i) => pickFact(g, i))).size).toBe(g.facts.length);
  });
  it('looks up by board index', () => {
    expect(gyanFor(39)?.name).toBe('Hastinapura');
    expect(gyanFor(0)?.name).toBe('Rajasooya Yagna');
  });
});

describe('gyanTrigger', () => {
  const players = [{ id: 'a', name: 'Arjuna' }];
  const mv = (seq: number, to: number) => ({ seq, type: 'move', text: '', playerId: 'a', data: { from: 0, to } });
  it('shows the last place a token moved to', () => {
    expect(gyanTrigger([mv(1, 5), mv(2, 9)], players)).toEqual({ space: 9, seed: 2, who: 'Arjuna', how: 'landed' });
  });
  it('prefers a purchase', () => {
    const buy = { seq: 3, type: 'buy', text: '', playerId: 'a', data: { space: 9 } };
    expect(gyanTrigger([mv(1, 9), buy], players)).toEqual({ space: 9, seed: 3, who: 'Arjuna', how: 'bought' });
  });
  it('is null when nobody moved or bought', () => {
    expect(gyanTrigger([{ seq: 1, type: 'turn', text: '' }], players)).toBeNull();
  });
});
