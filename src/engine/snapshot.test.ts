import { describe, expect, it } from 'vitest';
import { SPACES } from './board';
import { CARD_LIST } from './cards';
import { applyAction, createGame, forcePass } from './engine';
import { isPublicState, restoreFromPublic } from './snapshot';
import { validate } from './validator';
import { publicView } from './view';
import type { GameState } from './types';

const mk = (n = 3) => createGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tokenId: 't' })), 5);
const idx = (n: string) => SPACES.find((s) => s.name === n)!.index;

describe('forcePass (host override for offline players)', () => {
  it('passes a stuck turn and clears pending decisions', () => {
    const s = mk();
    s.turn.phase = 'buy';
    s.pendingBuy = { space: 3 };
    const r = forcePass(s);
    expect(r.ok && r.state.turn.index).toBe(1);
    expect(r.ok && r.state.turn.phase).toBe('roll');
    expect(r.ok && r.state.pendingBuy).toBeNull();
  });
  it('a doubles bonus is dropped when skipping', () => {
    const s = mk();
    s.turn.extraRoll = true;
    const r = forcePass(s);
    expect(r.ok && r.state.turn.index).toBe(1);
  });
  it('bankrupts a debtor who is offline, even when it is not their turn', () => {
    const s = mk();
    s.turn.phase = 'debt';
    s.debts = [{ debtor: 'p2', creditor: 'p0', amount: 500, reason: 'x' }];
    s.players[2].cash = 1;
    s.props[idx('Hastinapura')] = { owner: 'p2', level: 0, mortgaged: false };
    const r = forcePass(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[2].bankrupt).toBe(true);
    expect(r.state.props[idx('Hastinapura')].owner).toBe('p0');
    expect(r.state.turn.index).toBe(0); // p0 (the creditor) is still on turn
    expect(r.state.turn.phase).toBe('action');
  });
  it('refuses after the game is over', () => {
    const s = mk();
    s.turn.phase = 'over';
    expect(forcePass(s).ok).toBe(false);
  });
});

describe('restoreFromPublic (host migration)', () => {
  function playSome(): GameState {
    let s = mk(4);
    for (let i = 0; i < 40 && s.turn.phase !== 'over'; i++) {
      const pid = s.turn.phase === 'debt' ? s.debts[0].debtor : s.players[s.turn.index].id;
      const order = ['BUY', 'ROLL', 'PEEK', 'END_TURN', 'DECLINE', 'DECLARE_BANKRUPTCY'];
      for (const type of order) {
        const a = type === 'PEEK' ? { type: 'PEEK' as const, deck: 'daiva' as const } : ({ type } as never);
        if (validate(s, pid, a) === null) {
          const r = applyAction(s, pid, a);
          if (r.ok) s = r.state;
          break;
        }
      }
    }
    return s;
  }

  it('keeps every public fact and issues a playable state with fresh decks', () => {
    const s = playSome();
    s.players[1].held = ['daiva:hanuman'];
    const view = JSON.parse(JSON.stringify(publicView(s, 'p0')));
    expect(isPublicState(view)).toBe(true);
    const r = restoreFromPublic(view, 999);
    expect(r.players).toEqual(s.players);
    expect(r.props).toEqual(s.props);
    expect(r.turn).toEqual(s.turn);
    expect(r.debts).toEqual(s.debts);
    expect(r.bankNet).toBe(s.bankNet);
    expect(r.version).toBe(s.version);
    // every card in exactly one place, held cards not in a pile
    const all = [...r.decks.daiva.draw, ...r.decks.daiva.discard, ...r.decks.sankat.draw, ...r.decks.sankat.discard, ...r.players.flatMap((p) => p.held)];
    expect(all).toHaveLength(CARD_LIST.length);
    expect(new Set(all).size).toBe(CARD_LIST.length);
    expect(r.decks.daiva.draw).not.toContain('daiva:hanuman');
  });

  it('the restored game keeps playing and conserves money', () => {
    const s = playSome();
    let r = restoreFromPublic(JSON.parse(JSON.stringify(publicView(s))), 4242);
    const startTotal = r.players.reduce((n, p) => n + p.cash, 0) - r.bankNet;
    for (let i = 0; i < 300 && r.turn.phase !== 'over'; i++) {
      const pid = r.turn.phase === 'debt' ? r.debts[0].debtor : r.players[r.turn.index].id;
      for (const type of ['BUY', 'ROLL', 'END_TURN', 'DECLINE', 'DECLARE_BANKRUPTCY'] as const) {
        if (validate(r, pid, { type }) === null) {
          const x = applyAction(r, pid, { type });
          if (x.ok) r = x.state;
          break;
        }
      }
      const peek = validate(r, pid, { type: 'PEEK', deck: 'daiva' });
      if (!peek) {
        const x = applyAction(r, pid, { type: 'PEEK', deck: 'daiva' });
        if (x.ok) r = x.state;
      }
    }
    expect(r.players.reduce((n, p) => n + p.cash, 0) - r.bankNet).toBe(startTotal);
  });

  it('rejects malformed views', () => {
    expect(isPublicState(null)).toBe(false);
    expect(isPublicState({ version: 1 })).toBe(false);
    const v = publicView(mk()) as unknown as Record<string, unknown>;
    expect(isPublicState({ ...v, turn: { ...(v.turn as object), index: 9 } })).toBe(false);
    expect(isPublicState({ ...v, players: [] })).toBe(false);
  });
});
