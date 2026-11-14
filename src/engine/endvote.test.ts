import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from './engine';
import { END_VOTE_AFTER_ROUNDS } from './data';
import { netWorth } from './properties';
import { parseAction, validate } from './validator';
import { publicView } from './view';
import { restoreFromPublic } from './snapshot';
import type { Action, GameState } from './types';

const mk = (n = 3) => createGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tokenId: 't' + i })), 7);
const old = (s: GameState) => ({ ...s, turn: { ...s.turn, round: END_VOTE_AFTER_ROUNDS + 1 } });
const run = (s: GameState, pid: string, a: Action) => {
  const r = applyAction(s, pid, a);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe('ending the game by agreement', () => {
  it('is not allowed before 100 rounds are complete', () => {
    const s = mk();
    s.turn.round = END_VOTE_AFTER_ROUNDS; // 99 complete
    expect(validate(s, 'p0', { type: 'PROPOSE_END' })).toMatch(/after 100 rounds/);
    expect(validate(old(s), 'p0', { type: 'PROPOSE_END' })).toBeNull();
  });
  it('anyone may propose, even off their turn, and the proposer counts as agreeing', () => {
    const s = run(old(mk()), 'p2', { type: 'PROPOSE_END' });
    expect(s.endVote).toEqual({ by: 'p2', agreed: ['p2'] });
    expect(s.turn.phase).toBe('roll');
    expect(validate(s, 'p1', { type: 'PROPOSE_END' })).toMatch(/already open/);
  });
  it('ends by net worth only when every remaining player agrees', () => {
    let s = old(mk());
    s.players[1].cash += 900; // P1 is richest
    s = run(s, 'p0', { type: 'PROPOSE_END' });
    s = run(s, 'p1', { type: 'AGREE_END' });
    expect(s.turn.phase).toBe('roll');
    expect(validate(s, 'p1', { type: 'AGREE_END' })).toMatch(/already agreed/);
    s = run(s, 'p2', { type: 'AGREE_END' });
    expect(s.turn.phase).toBe('over');
    expect(s.winner).toBe('p1');
    expect(s.winReason).toBe('agreed');
    expect(s.endVote).toBeNull();
    expect(netWorth(s, 'p1')).toBeGreaterThan(netWorth(s, 'p0'));
  });
  it('one refusal cancels the proposal and play continues', () => {
    let s = run(old(mk()), 'p0', { type: 'PROPOSE_END' });
    s = run(s, 'p1', { type: 'REJECT_END' });
    expect(s.endVote).toBeNull();
    expect(s.turn.phase).toBe('roll');
    expect(validate(s, 'p0', { type: 'AGREE_END' })).toMatch(/Nobody/);
    s = run(s, 'p0', { type: 'PROPOSE_END' }); // can be proposed again
    expect(s.endVote?.by).toBe('p0');
  });
  it('a bankruptcy of a non-voter completes the vote', () => {
    let s = old(mk());
    s.players[2].cash = 0;
    s = run(s, 'p0', { type: 'PROPOSE_END' });
    s = run(s, 'p1', { type: 'AGREE_END' });
    expect(s.turn.phase).toBe('roll');
    // p2 owes more than they have and declares bankruptcy
    s.turn.phase = 'debt';
    s.debts = [{ debtor: 'p2', creditor: 'bank', amount: 100, reason: 'test' }];
    s = run(s, 'p2', { type: 'DECLARE_BANKRUPTCY' });
    expect(s.turn.phase).toBe('over');
    expect(s.winReason === 'agreed' || s.winReason === 'last-standing' || s.winReason === 'timed').toBe(true);
  });
  it('survives the public view, wire parsing and host migration', () => {
    const s = run(old(mk()), 'p0', { type: 'PROPOSE_END' });
    const view = publicView(s, 'p1');
    expect(view.endVote?.agreed).toEqual(['p0']);
    expect(restoreFromPublic(view, 3).endVote?.by).toBe('p0');
    expect(parseAction({ type: 'AGREE_END', junk: 1 })).toEqual({ type: 'AGREE_END' });
  });
  it('older saves without endVote still work', () => {
    const s = old(mk());
    delete (s as Partial<GameState>).endVote;
    expect(validate(s, 'p0', { type: 'PROPOSE_END' })).toBeNull();
    expect(validate(s, 'p0', { type: 'AGREE_END' })).toMatch(/Nobody/);
  });
});
