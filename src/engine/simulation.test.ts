import { describe, expect, it } from 'vitest';
import { SPACES } from './board';
import { applyAction, createGame } from './engine';
import { nextRandom } from './dice';
import { netWorth } from './properties';
import type { Action, GameState } from './types';
import { validate } from './validator';

/** Every action a player could try right now; the validator filters to the legal ones. */
function candidates(s: GameState, pid: string): Action[] {
  const out: Action[] = [{ type: 'ROLL' }, { type: 'BUY' }, { type: 'DECLINE' }, { type: 'END_TURN' }, { type: 'PAY_EXILE' }, { type: 'USE_EXILE_CARD' }, { type: 'DECLARE_BANKRUPTCY' }, { type: 'PEEK', deck: 'daiva' }, { type: 'PEEK', deck: 'sankat' }];
  for (const sp of SPACES) {
    if (!['prop', 'ratha', 'astra'].includes(sp.kind)) continue;
    for (const type of ['BUILD', 'SELL_BUILDING', 'MORTGAGE', 'UNMORTGAGE'] as const) out.push({ type, space: sp.index });
  }
  return out.filter((a) => validate(s, pid, a) === null);
}

function invariants(s: GameState) {
  const sum = s.players.reduce((n, p) => n + p.cash, 0);
  expect(sum).toBe(s.players.length * s.settings.startingCash + s.bankNet);
  for (const p of s.players) {
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.position).toBeGreaterThanOrEqual(0);
    expect(p.position).toBeLessThan(40);
    if (p.bankrupt) {
      expect(p.cash).toBe(0);
      expect(Object.values(s.props).some((x) => x.owner === p.id)).toBe(false);
    }
  }
  for (const [i, st] of Object.entries(s.props)) {
    expect(st.level).toBeGreaterThanOrEqual(0);
    expect(st.level).toBeLessThanOrEqual(5);
    if (st.mortgaged) expect(st.level).toBe(0);
    expect(SPACES[Number(i)].kind === 'prop' || st.level === 0).toBe(true);
  }
  // Every card is in exactly one place.
  const all = [...s.decks.daiva.draw, ...s.decks.daiva.discard, ...s.decks.sankat.draw, ...s.decks.sankat.discard, ...s.players.flatMap((p) => p.held)];
  expect(all).toHaveLength(16);
  expect(new Set(all).size).toBe(16);
}

function play(seed: number, players: number, maxRounds: number | null, cap = 20000) {
  let s = createGame(Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tokenId: 't' })), seed, { maxRounds });
  const bot = { rng: seed * 7919 + 13 };
  let steps = 0;
  while (s.turn.phase !== 'over' && steps++ < cap) {
    const pid = s.turn.phase === 'debt' ? s.debts[0].debtor : s.players[s.turn.index].id;
    let legal = candidates(s, pid);
    expect(legal.length).toBeGreaterThan(0); // the game can never get stuck
    // Strategy: prefer progress, buy/build eagerly, otherwise random.
    const pick = (t: string) => legal.filter((a) => a.type === t);
    const prefer = ['BUY', 'BUILD', 'ROLL', 'PEEK'].find((t) => pick(t).length && nextRandom(bot) < 0.85);
    if (s.turn.phase === 'debt') legal = legal.filter((a) => a.type !== 'DECLARE_BANKRUPTCY').length && nextRandom(bot) < 0.7 ? legal.filter((a) => a.type !== 'DECLARE_BANKRUPTCY') : legal;
    if (prefer && s.turn.phase !== 'debt') legal = pick(prefer);
    const a = legal[Math.floor(nextRandom(bot) * legal.length)];
    const r = applyAction(s, pid, a);
    expect(r.ok).toBe(true);
    if (!r.ok) break;
    s = r.state;
    if (steps % 7 === 0) invariants(s);
  }
  invariants(s);
  return { s, steps };
}

describe('randomised full games', () => {
  it('2-6 player games keep every invariant and always finish', () => {
    let finished = 0;
    let overs = 0;
    for (let seed = 1; seed <= 36; seed++) {
      const players = 2 + (seed % 5);
      const { s, steps } = play(seed, players, seed % 3 === 0 ? null : 40, seed % 3 === 0 ? 2500 : 20000);
      if (s.turn.phase === 'over') overs++;
      if (seed % 3 === 0 && s.turn.phase !== 'over') continue; // unlimited games may run long; invariants were still checked
      expect(steps).toBeLessThan(20000);
      expect(s.turn.phase).toBe('over');
      expect(s.winner).not.toBeNull();
      if (s.winReason === 'last-standing') {
        finished++;
        expect(s.players.filter((p) => !p.bankrupt)).toHaveLength(1);
      } else {
        const alive = s.players.filter((p) => !p.bankrupt);
        const best = Math.max(...alive.map((p) => netWorth(s, p.id)));
        expect(netWorth(s, s.winner!)).toBe(best);
      }
    }
    expect(finished).toBeGreaterThan(0);
    expect(overs).toBeGreaterThanOrEqual(20);
  }, 120000);

  it('a seeded game replays identically', () => {
    const a = play(42, 4, 30).s;
    const b = play(42, 4, 30).s;
    expect(a).toEqual(b);
  });
});
