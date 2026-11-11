import { describe, expect, it } from 'vitest';
import { SPACES } from './board';
import { CARD_LIST } from './cards';
import { RENTS } from './data';
import { applyAction, createGame } from './engine';
import { rentFor } from './properties';
import type { Action, GameState } from './types';
import { parseAction, validate } from './validator';
import { publicView } from './view';

const mk = (n = 3, seed = 1, settings = {}) =>
  createGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tokenId: 't' + i })), seed, settings);
const idx = (name: string) => SPACES.find((s) => s.name === name)!.index;
function run(s: GameState, pid: string, a: Action, dice?: [number, number]) {
  const r = applyAction(s, pid, a, { dice });
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const give = (s: GameState, pid: string, ...names: string[]) => {
  for (const n of names) s.props[idx(n)] = { owner: pid, level: 0, mortgaged: false };
};
const V = idx('Viratanagara');
const U = idx('Upaplavya');
/** Place the player so a non-doubles roll of `sum` (3..11) lands exactly on `space`, then roll. */
function landOn(s: GameState, pid: string, space: number, sum = 3): GameState {
  s.players.find((p) => p.id === pid)!.position = (space - sum + 40) % 40;
  const dice: [number, number] = sum % 2 ? [(sum - 1) / 2, (sum + 1) / 2] : [sum / 2 - 1, sum / 2 + 1];
  return run(s, pid, { type: 'ROLL' }, dice);
}
const total = (s: GameState) => s.players.reduce((n, p) => n + p.cash, 0);

describe('data', () => {
  it('has 23 kingdoms with 7-entry rent tables and 16 cards', () => {
    expect(SPACES.filter((s) => s.kind === 'prop')).toHaveLength(23);
    for (const s of SPACES.filter((x) => x.kind === 'prop')) expect(RENTS[s.name]).toHaveLength(7);
    expect(CARD_LIST).toHaveLength(16);
  });
});

describe('start and dice', () => {
  it('starts everyone on GO with 1500', () => {
    const s = mk();
    expect(s.players.every((p) => p.cash === 1500 && p.position === 0)).toBe(true);
    expect(s.turn.phase).toBe('roll');
  });
  it('is deterministic for a seed', () => {
    const a = applyAction(mk(2, 99), 'p0', { type: 'ROLL' });
    const b = applyAction(mk(2, 99), 'p0', { type: 'ROLL' });
    expect(a).toEqual(b);
  });
  it('rejects out-of-turn and wrong-phase actions', () => {
    const s = mk();
    expect(applyAction(s, 'p1', { type: 'ROLL' }).ok).toBe(false);
    expect(applyAction(s, 'p0', { type: 'END_TURN' }).ok).toBe(false);
    expect(applyAction(s, 'p0', { type: 'BUY' }).ok).toBe(false);
    expect(applyAction(s, 'ghost', { type: 'ROLL' }).ok).toBe(false);
  });
  it('parseAction rejects junk', () => {
    expect(parseAction({ type: 'NOPE' })).toBeNull();
    expect(parseAction({ type: 'BUILD', space: 99 })).toBeNull();
    expect(parseAction({ type: 'BUILD', space: 1.5 })).toBeNull();
    expect(parseAction({ type: 'PEEK', deck: 'x' })).toBeNull();
    expect(parseAction({ type: 'BUILD', space: 3, extra: 1 })).toEqual({ type: 'BUILD', space: 3 });
  });
});

describe('movement, purchase, rent', () => {
  it('moves, offers purchase, buys', () => {
    let s = run(mk(), 'p0', { type: 'ROLL' }, [1, 2]);
    expect(s.players[0].position).toBe(3);
    expect(s.turn.phase).toBe('buy');
    s = run(s, 'p0', { type: 'BUY' });
    expect(s.props[3].owner).toBe('p0');
    expect(s.players[0].cash).toBe(1500 - (SPACES[3].price ?? 0));
    expect(s.turn.phase).toBe('action');
    s = run(s, 'p0', { type: 'END_TURN' });
    expect(s.turn.index).toBe(1);
  });
  it('cannot buy what you cannot afford; declining leaves it unowned', () => {
    const s = mk();
    s.players[0].cash = 10;
    const r = run(s, 'p0', { type: 'ROLL' }, [1, 2]);
    expect(validate(r, 'p0', { type: 'BUY' })).toMatch(/Need/);
    expect(run(r, 'p0', { type: 'DECLINE' }).props[3]).toBeUndefined();
  });
  it('colour-group and building rent come from the deed tables', () => {
    const s = mk();
    give(s, 'p1', 'Viratanagara');
    expect(rentFor(s, V, 7)).toBe(2);
    give(s, 'p1', 'Upaplavya');
    expect(rentFor(s, V, 7)).toBe(4);
    s.props[V].level = 3;
    expect(rentFor(s, V, 7)).toBe(90);
  });
  it('landing on an owned kingdom pays its owner', () => {
    const s = mk();
    give(s, 'p1', 'Viratanagara');
    const r = landOn(s, 'p0', V);
    expect(r.players[0].cash).toBe(1498);
    expect(r.players[1].cash).toBe(1502);
  });
  it('no rent on a mortgaged kingdom or your own', () => {
    const s = mk();
    give(s, 'p1', 'Viratanagara');
    s.props[V].mortgaged = true;
    expect(landOn(s, 'p0', V).players[0].cash).toBe(1500);
    const s2 = mk();
    give(s2, 'p0', 'Viratanagara');
    expect(landOn(s2, 'p0', V).players[0].cash).toBe(1500);
  });
  it('passing GO pays salary; landing on GO pays too', () => {
    const s = mk();
    s.players[0].position = 38;
    const r = run(s, 'p0', { type: 'ROLL' }, [1, 2]);
    expect(r.players[0].position).toBe(1);
    expect(r.players[0].cash).toBe(1700);
    expect(r.turn.phase).toBe('buy');
  });
  it('landing exactly on GO pays 200', () => {
    const s = mk();
    s.players[0].position = 36;
    const r = run(s, 'p0', { type: 'ROLL' }, [1, 3]);
    expect(r.players[0].position).toBe(0);
    expect(r.players[0].cash).toBe(1700);
  });
  it('Rathas scale and Astras use the dice', () => {
    const s = mk();
    give(s, 'p1', 'Nandighosha Ratha');
    expect(rentFor(s, 5, 0)).toBe(25);
    give(s, 'p1', 'Vijaya Ratha');
    expect(rentFor(s, 5, 0)).toBe(50);
    give(s, 'p1', 'Celestial Ratha');
    expect(rentFor(s, 5, 0)).toBe(100);
    give(s, 'p1', 'Divine Ratha');
    expect(rentFor(s, 5, 0)).toBe(200);
    give(s, 'p1', 'Agni Astra');
    expect(rentFor(s, 12, 7)).toBe(28);
    give(s, 'p1', 'Varun Astra');
    expect(rentFor(s, 12, 7)).toBe(70);
  });
  it('Astra rent is charged from the actual roll', () => {
    const s = mk();
    give(s, 'p1', 'Agni Astra');
    const r = landOn(s, 'p0', 12, 7);
    expect(r.players[0].cash).toBe(1500 - 28);
  });
  it('Royal Tax costs 100', () => {
    const r = run(mk(), 'p0', { type: 'ROLL' }, [1, 3]);
    expect(r.players[0].position).toBe(4);
    expect(r.players[0].cash).toBe(1400);
  });
});

describe('doubles and exile', () => {
  it('doubles roll again; third double goes to exile with no salary', () => {
    let s = mk();
    s = run(s, 'p0', { type: 'ROLL' }, [1, 1]); // 2: Dharma Sankat card
    if (s.turn.phase === 'peek') s = run(s, 'p0', { type: 'PEEK', deck: 'daiva' });
    const afterFirst = s.players[0];
    if (afterFirst.inExile) return; // a card sent us to exile; covered elsewhere
    expect(s.turn.phase).toBe('roll');
    s = run(s, 'p0', { type: 'ROLL' }, [3, 3]);
    if (s.turn.phase === 'buy') s = run(s, 'p0', { type: 'DECLINE' });
    if (s.turn.phase === 'peek') s = run(s, 'p0', { type: 'PEEK', deck: 'daiva' });
    if (s.turn.phase === 'debt') return;
    if (s.turn.phase === 'roll') {
      const cash = s.players[0].cash;
      s = run(s, 'p0', { type: 'ROLL' }, [4, 4]);
      expect(s.players[0].inExile).toBe(true);
      expect(s.players[0].position).toBe(10);
      expect(s.players[0].cash).toBe(cash);
      expect(s.turn.phase).toBe('action');
    }
  });
  it('three doubles, forced', () => {
    const s = mk();
    s.turn.doubles = 2;
    s.players[0].position = 20;
    const r = run(s, 'p0', { type: 'ROLL' }, [3, 3]);
    expect(r.players[0].inExile).toBe(true);
    expect(r.players[0].position).toBe(10);
    expect(r.players[0].cash).toBe(1500);
    expect(r.turn.phase).toBe('action');
  });
  it('Go to Vanavasa sends you there with no salary', () => {
    const s = mk();
    s.players[0].position = 28;
    const r = run(s, 'p0', { type: 'ROLL' }, [1, 1]);
    expect(r.players[0].inExile).toBe(true);
    expect(r.players[0].cash).toBe(1500);
    expect(r.turn.phase).toBe('action'); // doubles do not grant an extra turn after exile
  });
  it('exile: doubles leave and move without extra turn; non-doubles stay; fine is 50', () => {
    const s = mk();
    s.players[0].position = 10;
    s.players[0].inExile = true;
    const stay = run(s, 'p0', { type: 'ROLL' }, [1, 2]);
    expect(stay.players[0].inExile).toBe(true);
    expect(stay.players[0].position).toBe(10);
    const out = run(s, 'p0', { type: 'ROLL' }, [2, 2]);
    expect(out.players[0].inExile).toBe(false);
    expect(out.players[0].position).toBe(14);
    expect(out.turn.phase).not.toBe('roll');
    const paid = run(s, 'p0', { type: 'PAY_EXILE' });
    expect(paid.players[0].cash).toBe(1450);
    expect(paid.players[0].inExile).toBe(false);
    expect(paid.turn.phase).toBe('roll');
  });
  it("Krishna's Counsel frees from exile and returns to the discard", () => {
    const s = mk();
    s.players[0].inExile = true;
    s.players[0].held = ['daiva:krishna'];
    const r = run(s, 'p0', { type: 'USE_EXILE_CARD' });
    expect(r.players[0].inExile).toBe(false);
    expect(r.players[0].held).toEqual([]);
    expect(r.decks.daiva.discard).toContain('daiva:krishna');
  });
});

describe('building and mortgages', () => {
  const setup = () => {
    const s = mk();
    give(s, 'p0', 'Viratanagara', 'Upaplavya');
    return s;
  };
  it('needs the full group and builds evenly', () => {
    const s = mk();
    give(s, 'p0', 'Viratanagara');
    expect(validate(s, 'p0', { type: 'BUILD', space: V })).toMatch(/complete/);
    give(s, 'p0', 'Upaplavya');
    let t = run(s, 'p0', { type: 'BUILD', space: V });
    expect(t.players[0].cash).toBe(1450);
    expect(validate(t, 'p0', { type: 'BUILD', space: V })).toMatch(/evenly/);
    t = run(t, 'p0', { type: 'BUILD', space: U });
    expect(validate(t, 'p0', { type: 'BUILD', space: V })).toBeNull();
  });
  it('Royal Mahal needs 4 Ashramas first and stops at 5', () => {
    let s = setup();
    for (let i = 0; i < 4; i++) {
      s = run(s, 'p0', { type: 'BUILD', space: V });
      s = run(s, 'p0', { type: 'BUILD', space: U });
    }
    expect(s.props[V].level).toBe(4);
    s = run(s, 'p0', { type: 'BUILD', space: V });
    expect(s.props[V].level).toBe(5);
    expect(rentFor(s, V, 0)).toBe(250);
    expect(validate(s, 'p0', { type: 'BUILD', space: V })).toMatch(/Mahal/);
  });
  it('mortgage pays half, blocks rent, needs buildings sold first; redeem costs +10%', () => {
    let s = setup();
    s = run(s, 'p0', { type: 'BUILD', space: V });
    expect(validate(s, 'p0', { type: 'MORTGAGE', space: U })).toMatch(/Sell/);
    s = run(s, 'p0', { type: 'SELL_BUILDING', space: V });
    expect(s.players[0].cash).toBe(1500 - 50 + 25);
    s = run(s, 'p0', { type: 'MORTGAGE', space: V });
    expect(s.players[0].cash).toBe(1475 + 30);
    expect(validate(s, 'p0', { type: 'BUILD', space: U })).toMatch(/mortgaged/);
    s = run(s, 'p0', { type: 'UNMORTGAGE', space: V });
    expect(s.players[0].cash).toBe(1505 - 33);
  });
  it('selling must be even', () => {
    let s = setup();
    s = run(s, 'p0', { type: 'BUILD', space: V });
    s = run(s, 'p0', { type: 'BUILD', space: U });
    s = run(s, 'p0', { type: 'BUILD', space: V });
    expect(validate(s, 'p0', { type: 'SELL_BUILDING', space: U })).toMatch(/evenly/);
    expect(validate(s, 'p0', { type: 'SELL_BUILDING', space: V })).toBeNull();
  });
  it('only the current player builds, and not during a purchase decision', () => {
    const s = setup();
    expect(validate(s, 'p1', { type: 'BUILD', space: V })).not.toBeNull();
    s.turn.phase = 'buy';
    expect(validate(s, 'p0', { type: 'BUILD', space: V })).not.toBeNull();
  });
});

describe('cards', () => {
  const withTop = (s: GameState, deck: 'daiva' | 'sankat', id: string) => {
    s.decks[deck].draw = [id, ...s.decks[deck].draw.filter((x) => x !== id)];
  };
  const daivaSpace = 7;
  const sankatSpace = 17;
  it('Durvasa: 50 from each other player', () => {
    const s = mk();
    withTop(s, 'daiva', 'daiva:durvasa');
    const r = landOn(s, 'p0', daivaSpace);
    expect(r.players[0].cash).toBe(1600);
    expect(r.players[1].cash).toBe(1450);
    expect(r.players[2].cash).toBe(1450);
  });
  it('Karna, Parashurama, Draupadi', () => {
    for (const [id, cash] of [['daiva:karna', 1650], ['daiva:parashurama', 1400], ['daiva:draupadi', 1550]] as const) {
      const s = mk();
      withTop(s, 'daiva', id);
      expect(landOn(s, 'p0', daivaSpace).players[0].cash).toBe(cash);
    }
  });
  it('Divine Chariot Speed moves to GO and pays salary', () => {
    const s = mk();
    withTop(s, 'daiva', 'daiva:chariot');
    const r = landOn(s, 'p0', daivaSpace);
    expect(r.players[0].position).toBe(0);
    expect(r.players[0].cash).toBe(1700);
  });
  it('Indra negates the next rent owed and is spent', () => {
    const s = mk();
    give(s, 'p1', 'Viratanagara');
    s.players[0].held = ['daiva:indra'];
    const r = landOn(s, 'p0', V);
    expect(r.players[0].cash).toBe(1500);
    expect(r.players[0].held).toEqual([]);
    expect(r.decks.daiva.discard).toContain('daiva:indra');
  });
  it('Hanuman doubles the next rent received and is spent', () => {
    const s = mk();
    give(s, 'p1', 'Viratanagara');
    s.players[1].held = ['daiva:hanuman'];
    const r = landOn(s, 'p0', V);
    expect(r.players[0].cash).toBe(1496);
    expect(r.players[1].cash).toBe(1504);
    expect(r.players[1].held).toEqual([]);
  });
  it('Hastinapura Dice Game exiles', () => {
    const s = mk();
    withTop(s, 'sankat', 'sankat:dicegame');
    const r = landOn(s, 'p0', sankatSpace);
    expect(r.players[0].inExile).toBe(true);
    expect(r.players[0].position).toBe(10);
  });
  it("Vidura's Warning moves to Amaravati", () => {
    const s = mk();
    withTop(s, 'sankat', 'sankat:vidura');
    expect(landOn(s, 'p0', sankatSpace).players[0].position).toBe(20);
  });
  it("Bhishma's Vow skips your next turn only", () => {
    const s = mk();
    withTop(s, 'sankat', 'sankat:bhishma');
    let r = landOn(s, 'p0', sankatSpace);
    r = run(r, 'p0', { type: 'END_TURN' });
    expect(r.turn.index).toBe(1);
    r = run(r, 'p1', { type: 'ROLL' }, [1, 2]);
    if (r.turn.phase === 'buy' || r.turn.phase === 'debt') r = applyAction(r, 'p1', { type: 'DECLINE' }).ok ? run(r, 'p1', { type: 'DECLINE' }) : r;
    r = run(r, 'p1', { type: 'END_TURN' });
    r = run(r, 'p2', { type: 'ROLL' }, [1, 2]);
    if (r.turn.phase === 'buy') r = run(r, 'p2', { type: 'DECLINE' });
    r = run(r, 'p2', { type: 'END_TURN' });
    expect(r.turn.index).toBe(1);
  });
  it('Ashrama Renovation charges 25 per Ashrama (Mahal counts as 4)', () => {
    const s = mk();
    give(s, 'p0', 'Viratanagara', 'Upaplavya');
    s.props[V].level = 2;
    s.props[U].level = 5;
    withTop(s, 'sankat', 'sankat:ashrama');
    const r = landOn(s, 'p0', sankatSpace);
    expect(r.players[0].cash).toBe(1500 - 25 * 6);
  });
  it("Sanjaya's Vision is private to the peeker", () => {
    let s = mk();
    withTop(s, 'sankat', 'sankat:sanjaya');
    s = landOn(s, 'p0', sankatSpace);
    expect(s.turn.phase).toBe('peek');
    const r = applyAction(s, 'p0', { type: 'PEEK', deck: 'daiva' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(publicView(r.state, 'p0').log.some((e) => e.type === 'peek')).toBe(true);
    expect(publicView(r.state, 'p1').log.some((e) => e.type === 'peek')).toBe(false);
    expect(r.state.turn.phase).toBe('action');
    expect(r.state.decks.daiva.draw).toEqual(s.decks.daiva.draw); // returned, not removed
  });
  it('public view hides rng and deck order', () => {
    const v = publicView(mk()) as unknown as Record<string, unknown>;
    expect(v.rng).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain('daiva:krishna');
  });
});

describe('debt, bankruptcy, winning', () => {
  it('raises funds by mortgaging, then pays automatically', () => {
    const s = mk();
    give(s, 'p1', 'Viratanagara');
    give(s, 'p0', 'Hastinapura'); // mortgage value 200
    s.players[0].cash = 1;
    let r = landOn(s, 'p0', V);
    expect(r.turn.phase).toBe('debt');
    expect(validate(r, 'p1', { type: 'MORTGAGE', space: V })).not.toBeNull();
    r = run(r, 'p0', { type: 'MORTGAGE', space: idx('Hastinapura') });
    expect(r.turn.phase).toBe('action');
    expect(r.players[1].cash).toBe(1502);
    expect(r.debts).toHaveLength(0);
  });
  it('bankruptcy to a player transfers cash and properties (buildings cleared, mortgages kept); game ends', () => {
    const s = mk(2);
    give(s, 'p1', 'Viratanagara');
    give(s, 'p0', 'Hastinapura');
    s.props[idx('Hastinapura')].mortgaged = true;
    s.players[0].cash = 1;
    let r = landOn(s, 'p0', V);
    r = run(r, 'p0', { type: 'DECLARE_BANKRUPTCY' });
    expect(r.players[0].bankrupt).toBe(true);
    expect(r.props[idx('Hastinapura')]).toMatchObject({ owner: 'p1', mortgaged: true, level: 0 });
    expect(r.players[1].cash).toBe(1501);
    expect(r.turn.phase).toBe('over');
    expect(r.winner).toBe('p1');
  });
  it('bankruptcy to the bank frees properties; play continues with the rest', () => {
    const s = mk(3);
    give(s, 'p0', 'Hastinapura');
    s.players[0].cash = 10;
    let r = run(s, 'p0', { type: 'ROLL' }, [1, 3]); // lands on Royal Tax
    expect(r.turn.phase).toBe('debt');
    r = run(r, 'p0', { type: 'DECLARE_BANKRUPTCY' });
    expect(r.props[idx('Hastinapura')]).toBeUndefined();
    expect(r.turn.phase).toBe('roll');
    expect(r.turn.index).toBe(1);
  });
  it('timed play ends by net worth', () => {
    let s = mk(2, 5, { maxRounds: 1 });
    give(s, 'p1', 'Hastinapura');
    s = run(s, 'p0', { type: 'ROLL' }, [1, 2]);
    if (s.turn.phase === 'buy') s = run(s, 'p0', { type: 'DECLINE' });
    s = run(s, 'p0', { type: 'END_TURN' });
    s = run(s, 'p1', { type: 'ROLL' }, [1, 2]);
    if (s.turn.phase === 'buy') s = run(s, 'p1', { type: 'DECLINE' });
    s = run(s, 'p1', { type: 'END_TURN' });
    expect(s.turn.phase).toBe('over');
    expect(s.winReason).toBe('timed');
    expect(s.winner).toBe('p1');
  });
  it('rejects every action after the game is over', () => {
    const s = mk(2);
    s.turn.phase = 'over';
    expect(applyAction(s, 'p0', { type: 'ROLL' }).ok).toBe(false);
  });
});
