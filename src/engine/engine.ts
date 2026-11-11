/**
 * GameEngine: turn flow, dice, landing, cards, debts, bankruptcy and winning.
 * Pure and deterministic: applyAction(state, playerId, action) returns a NEW state (or an error);
 * all randomness comes from state.rng. No UI, no networking.
 */
import { SPACES } from './board';
import { CARDS, DECK_IDS } from './cards';
import { DEFAULT_SETTINGS, EXILE_SPACE, GO_SPACE, PARK_SPACE } from './data';
import { rollDie, shuffle } from './dice';
import { mortgageValue, netWorth, ownedBy, rentFor, unmortgageCost, buildCost } from './properties';
import type { Action, ActionResult, DeckId, GameEvent, GameState, Party, PlayerId, PlayerState, Settings } from './types';
import { validate } from './validator';

export interface NewPlayer {
  id: PlayerId;
  name: string;
  tokenId: string;
}

export function createGame(players: NewPlayer[], seed: number, settings: Partial<Settings> = {}): GameState {
  if (players.length < 2 || players.length > 6) throw new Error('A game needs 2-6 players');
  const st: Settings = { ...DEFAULT_SETTINGS, ...settings };
  const s: GameState = {
    version: 0,
    settings: st,
    players: players.map<PlayerState>((p) => ({
      ...p,
      cash: st.startingCash,
      position: GO_SPACE,
      inExile: false,
      exileTurns: 0,
      bankrupt: false,
      skipNext: false,
      held: [],
    })),
    props: {},
    decks: { daiva: { draw: [], discard: [] }, sankat: { draw: [], discard: [] } },
    rng: seed | 0,
    turn: { index: 0, round: 1, phase: 'roll', dice: null, doubles: 0, extraRoll: false },
    pendingBuy: null,
    pendingPeek: false,
    debts: [],
    ledger: [],
    bankNet: 0,
    txCounter: 0,
    log: [],
    eventSeq: 0,
    winner: null,
    winReason: null,
  };
  s.decks.daiva.draw = shuffle(s, DECK_IDS.daiva);
  s.decks.sankat.draw = shuffle(s, DECK_IDS.sankat);
  return s;
}

// ---------------------------------------------------------------- internals

interface Ctx {
  s: GameState;
  ev: GameEvent[];
  rigged?: [number, number];
}

const LOG_CAP = 200;
const LEDGER_CAP = 300;

const P = (c: Ctx, id: PlayerId) => c.s.players.find((p) => p.id === id)!;
const cur = (c: Ctx) => c.s.players[c.s.turn.index];
const active = (c: Ctx) => c.s.players.filter((p) => !p.bankrupt);

function emit(c: Ctx, type: string, text: string, extra: Partial<GameEvent> = {}) {
  const e: GameEvent = { seq: ++c.s.eventSeq, type, text, ...extra };
  c.ev.push(e);
  c.s.log.push(e);
  if (c.s.log.length > LOG_CAP) c.s.log.splice(0, c.s.log.length - LOG_CAP);
}

function transfer(c: Ctx, from: Party, to: Party, amount: number, reason: string) {
  if (amount <= 0) return;
  if (from !== 'bank') P(c, from).cash -= amount;
  else c.s.bankNet += amount;
  if (to !== 'bank') P(c, to).cash += amount;
  else c.s.bankNet -= amount;
  c.s.ledger.push({ n: ++c.s.txCounter, from, to, amount, reason });
  if (c.s.ledger.length > LEDGER_CAP) c.s.ledger.splice(0, c.s.ledger.length - LEDGER_CAP);
}

const nameOf = (c: Ctx, p: Party) => (p === 'bank' ? 'the Bank' : P(c, p).name);

/** Pay now if the debtor can afford it; otherwise queue a debt they must raise funds for (or go bankrupt). */
function charge(c: Ctx, debtor: PlayerId, creditor: Party, amount: number, reason: string) {
  if (amount <= 0) return;
  if (P(c, debtor).cash >= amount) {
    transfer(c, debtor, creditor, amount, reason);
    emit(c, 'pay', `${P(c, debtor).name} pays ${amount} S to ${nameOf(c, creditor)} (${reason})`, { playerId: debtor });
  } else {
    c.s.debts.push({ debtor, creditor, amount, reason });
    emit(c, 'debt', `${P(c, debtor).name} owes ${amount} S to ${nameOf(c, creditor)} (${reason}) and must raise funds`, { playerId: debtor });
  }
}

function checkWinner(c: Ctx): boolean {
  const alive = active(c);
  if (alive.length <= 1 && c.s.turn.phase !== 'over') {
    c.s.winner = alive[0]?.id ?? null;
    c.s.winReason = 'last-standing';
    c.s.turn.phase = 'over';
    c.s.pendingBuy = null;
    emit(c, 'win', `${alive[0]?.name ?? 'Nobody'} is the Chakravartin, Sovereign of the Realm!`, { playerId: alive[0]?.id });
  }
  return c.s.turn.phase === 'over';
}

function finishTimed(c: Ctx) {
  const ranked = active(c)
    .map((p) => ({ p, w: netWorth(c.s, p.id) }))
    .sort((a, b) => b.w - a.w);
  c.s.winner = ranked[0].p.id;
  c.s.winReason = 'timed';
  c.s.turn.phase = 'over';
  emit(c, 'win', `Time! ${ranked[0].p.name} has the greatest net worth (${ranked[0].w} S) and is the Chakravartin.`, { playerId: ranked[0].p.id });
}

function advanceTurn(c: Ctx) {
  const { s } = c;
  const n = s.players.length;
  let i = s.turn.index;
  for (let g = 0; g < n * 2 + 2; g++) {
    const prev = i;
    i = (i + 1) % n;
    if (i <= prev) s.turn.round++;
    const p = s.players[i];
    if (p.bankrupt) continue;
    if (p.skipNext) {
      p.skipNext = false;
      emit(c, 'skip', `${p.name} skips this turn in meditation`, { playerId: p.id });
      continue;
    }
    break;
  }
  s.turn.index = i;
  s.turn.dice = null;
  s.turn.doubles = 0;
  s.turn.extraRoll = false;
  s.turn.phase = 'roll';
  if (s.settings.maxRounds !== null && s.turn.round > s.settings.maxRounds) return finishTimed(c);
  emit(c, 'turn', `${s.players[i].name}'s turn`, { playerId: s.players[i].id });
}

/** Everything for this roll is resolved and nobody owes anything: either roll again, or let the player act and end the turn. */
function settleTurn(c: Ctx) {
  if (checkWinner(c)) return;
  const p = cur(c);
  if (p.bankrupt) return advanceTurn(c);
  c.s.turn.phase = p.inExile || !c.s.turn.extraRoll ? 'action' : 'roll';
  if (c.s.turn.phase === 'roll') emit(c, 'extra', `${p.name} rolled doubles and rolls again`, { playerId: p.id });
}

/** After resolving a landing/card, decide which decision (if any) the game is now waiting for. */
function proceed(c: Ctx) {
  const { s } = c;
  if (checkWinner(c)) return;
  if (s.debts.length) s.turn.phase = 'debt';
  else if (s.pendingBuy) s.turn.phase = 'buy';
  else if (s.pendingPeek) s.turn.phase = 'peek';
  else settleTurn(c);
}

function settleDebts(c: Ctx) {
  const { s } = c;
  while (s.debts.length) {
    const d = s.debts[0];
    if (P(c, d.debtor).cash < d.amount) break;
    transfer(c, d.debtor, d.creditor, d.amount, d.reason);
    emit(c, 'pay', `${P(c, d.debtor).name} pays ${d.amount} S to ${nameOf(c, d.creditor)} (${d.reason})`, { playerId: d.debtor });
    s.debts.shift();
  }
  proceed(c);
}

function sendToExile(c: Ctx, p: PlayerState, why: string) {
  p.position = EXILE_SPACE;
  p.inExile = true;
  p.exileTurns = 0;
  c.s.turn.extraRoll = false;
  emit(c, 'exile', `${p.name} ${why} and goes to Vanavasa`, { playerId: p.id });
}

function moveForward(c: Ctx, p: PlayerState, target: number) {
  const old = p.position;
  p.position = target;
  emit(c, 'move', `${p.name} moves to ${SPACES[target].name}`, { playerId: p.id, data: { from: old, to: target } });
  if (target < old) {
    transfer(c, 'bank', p.id, c.s.settings.salary, 'Rajasooya Yagna');
    emit(c, 'salary', `${p.name} collects ${c.s.settings.salary} S at Rajasooya Yagna`, { playerId: p.id });
  }
}

function discardCard(c: Ctx, id: string) {
  c.s.decks[CARDS[id].deck].discard.push(id);
}

function ensureDraw(c: Ctx, deck: DeckId): boolean {
  const d = c.s.decks[deck];
  if (d.draw.length === 0 && d.discard.length) {
    d.draw = shuffle(c.s, d.discard);
    d.discard = [];
  }
  return d.draw.length > 0;
}

function consumeHeld(c: Ctx, p: PlayerState, id: string) {
  p.held.splice(p.held.indexOf(id), 1);
  discardCard(c, id);
}

function drawCard(c: Ctx, p: PlayerState, deck: DeckId) {
  if (!ensureDraw(c, deck)) return emit(c, 'card', 'The deck is empty (every card is being held)');
  const id = c.s.decks[deck].draw.shift()!;
  const def = CARDS[id];
  emit(c, 'card', `${p.name} draws ${def.title}: ${def.text}`, { playerId: p.id, data: { deck, id, title: def.title, text: def.text } });
  if (def.kept) {
    p.held.push(id);
    return;
  }
  discardCard(c, id);
  const others = active(c).filter((q) => q.id !== p.id);
  switch (id) {
    case 'daiva:durvasa':
      for (const q of others) charge(c, q.id, p.id, 50, "Sage Durvasa's Boon");
      break;
    case 'daiva:karna':
      transfer(c, 'bank', p.id, 150, "Karna's Charity");
      break;
    case 'daiva:parashurama':
      charge(c, p.id, 'bank', 100, 'Curse of Parashurama');
      break;
    case 'daiva:chariot':
      moveForward(c, p, GO_SPACE);
      break;
    case 'daiva:draupadi':
      for (const q of others) charge(c, q.id, p.id, 25, "Draupadi's Blessing");
      break;
    case 'sankat:vidura':
      moveForward(c, p, PARK_SPACE);
      break;
    case 'sankat:dicegame':
      sendToExile(c, p, 'loses the dice game');
      break;
    case 'sankat:ashrama': {
      // A Royal Mahal counts as the 4 Ashramas it was built on.
      const count = ownedBy(c.s, p.id).reduce((n, i) => n + Math.min(c.s.props[i].level, 4), 0);
      charge(c, p.id, 'bank', 25 * count, `Ashrama Renovation (${count} Ashramas)`);
      break;
    }
    case 'sankat:yaksha':
      transfer(c, 'bank', p.id, 100, "Yaksha's Questions");
      break;
    case 'sankat:coronation':
      transfer(c, 'bank', p.id, 50, 'Royal Coronation');
      break;
    case 'sankat:lac':
      charge(c, p.id, 'bank', 75, 'Lac Palace Escape');
      break;
    case 'sankat:bhishma':
      p.skipNext = true;
      break;
    case 'sankat:sanjaya':
      c.s.pendingPeek = true;
      break;
  }
}

function resolveLanding(c: Ctx, p: PlayerState) {
  const sp = SPACES[p.position];
  const { s } = c;
  switch (sp.kind) {
    case 'goexile':
      return sendToExile(c, p, 'is summoned');
    case 'tax':
      return charge(c, p.id, 'bank', sp.price ?? 100, 'Royal Tax');
    case 'daiva':
      return drawCard(c, p, 'daiva');
    case 'sankat':
      return drawCard(c, p, 'sankat');
    case 'prop':
    case 'ratha':
    case 'astra': {
      const st = s.props[p.position];
      if (!st) {
        s.pendingBuy = { space: p.position };
        return;
      }
      if (st.owner === p.id || st.mortgaged) return;
      const owner = P(c, st.owner);
      let rent = rentFor(s, p.position, (s.turn.dice?.[0] ?? 0) + (s.turn.dice?.[1] ?? 0));
      if (p.held.includes('daiva:indra')) {
        consumeHeld(c, p, 'daiva:indra');
        return emit(c, 'armor', `${p.name}'s Indra's Armor negates the rent for ${sp.name}`, { playerId: p.id });
      }
      if (owner.held.includes('daiva:hanuman')) {
        consumeHeld(c, owner, 'daiva:hanuman');
        rent *= 2;
        emit(c, 'hanuman', `${owner.name}'s Hanuman's Strength doubles the rent`, { playerId: owner.id });
      }
      return charge(c, p.id, st.owner, rent, `Rent for ${sp.name}`);
    }
    default:
      return; // go, exile (visiting), park: no effect
  }
}

function doRoll(c: Ctx, p: PlayerState) {
  const { s } = c;
  const dice: [number, number] = c.rigged ?? [rollDie(s), rollDie(s)];
  const doubles = dice[0] === dice[1];
  s.turn.dice = dice;
  emit(c, 'dice', `${p.name} rolls ${dice[0]} + ${dice[1]} = ${dice[0] + dice[1]}${doubles ? ' (doubles)' : ''}`, { playerId: p.id, data: { dice } });

  if (p.inExile) {
    if (!doubles) {
      p.exileTurns++;
      s.turn.extraRoll = false;
      emit(c, 'exile', `${p.name} remains in Vanavasa`, { playerId: p.id });
      return proceed(c);
    }
    p.inExile = false;
    p.exileTurns = 0;
    s.turn.extraRoll = false; // leaving exile with doubles: move, but no extra turn
    emit(c, 'exile', `${p.name} leaves Vanavasa`, { playerId: p.id });
  } else if (doubles) {
    s.turn.doubles++;
    if (s.turn.doubles >= 3) {
      sendToExile(c, p, 'rolled three doubles and succumbs to Adharma');
      return proceed(c);
    }
    s.turn.extraRoll = true;
  } else {
    s.turn.extraRoll = false;
  }
  moveForward(c, p, (p.position + dice[0] + dice[1]) % 40);
  resolveLanding(c, p);
  proceed(c);
}

function bankrupt(c: Ctx, id: PlayerId) {
  const { s } = c;
  const p = P(c, id);
  const debt = s.debts[0];
  const heir: Party = debt && debt.debtor === id ? debt.creditor : 'bank';
  emit(c, 'bankrupt', `${p.name} is bankrupt! Assets pass to ${nameOf(c, heir)}`, { playerId: id });
  if (p.cash > 0) transfer(c, id, heir, p.cash, 'Bankruptcy');
  for (const i of ownedBy(s, id)) {
    if (heir === 'bank') delete s.props[i];
    else s.props[i] = { owner: heir, level: 0, mortgaged: s.props[i].mortgaged };
  }
  for (const h of p.held) discardCard(c, h);
  p.held = [];
  p.bankrupt = true;
  s.debts = s.debts
    .filter((d) => d.debtor !== id)
    .map((d) => (d.creditor === id ? { ...d, creditor: heir } : d))
    .filter((d) => d.debtor !== d.creditor);
  settleDebts(c);
}

// ---------------------------------------------------------------- public API

export interface ApplyOptions {
  /** Tests only: force the dice. The host never passes this. */
  dice?: [number, number];
}

export function applyAction(state: GameState, playerId: PlayerId, action: Action, opts: ApplyOptions = {}): ActionResult {
  const err = validate(state, playerId, action);
  if (err) return { ok: false, error: err };
  const c: Ctx = { s: JSON.parse(JSON.stringify(state)) as GameState, ev: [], rigged: opts.dice };
  const p = P(c, playerId);
  const { s } = c;

  switch (action.type) {
    case 'ROLL':
      doRoll(c, p);
      break;
    case 'BUY': {
      const sp = SPACES[s.pendingBuy!.space];
      transfer(c, p.id, 'bank', sp.price!, `Bought ${sp.name}`);
      s.props[sp.index] = { owner: p.id, level: 0, mortgaged: false };
      s.pendingBuy = null;
      emit(c, 'buy', `${p.name} buys ${sp.name} for ${sp.price} S`, { playerId: p.id, data: { space: sp.index } });
      proceed(c);
      break;
    }
    case 'DECLINE':
      emit(c, 'decline', `${p.name} declines to buy ${SPACES[s.pendingBuy!.space].name}`, { playerId: p.id });
      s.pendingBuy = null;
      proceed(c);
      break;
    case 'END_TURN':
      advanceTurn(c);
      break;
    case 'PAY_EXILE':
      transfer(c, p.id, 'bank', s.settings.exileFee, 'Exile fine');
      p.inExile = false;
      p.exileTurns = 0;
      emit(c, 'exile', `${p.name} pays ${s.settings.exileFee} S and leaves Vanavasa`, { playerId: p.id });
      break;
    case 'USE_EXILE_CARD':
      consumeHeld(c, p, 'daiva:krishna');
      p.inExile = false;
      p.exileTurns = 0;
      emit(c, 'exile', `${p.name} uses Krishna's Counsel and leaves Vanavasa`, { playerId: p.id });
      break;
    case 'PEEK': {
      s.pendingPeek = false;
      if (ensureDraw(c, action.deck)) {
        const top = CARDS[s.decks[action.deck].draw[0]];
        emit(c, 'peek', `You see the top ${action.deck === 'daiva' ? 'Daiva' : 'Dharma Sankat'} card: ${top.title}. ${top.text}`, { private: p.id, playerId: p.id });
        emit(c, 'peeked', `${p.name} peeks at the top ${action.deck === 'daiva' ? 'Daiva' : 'Dharma Sankat'} card`, { playerId: p.id });
      } else emit(c, 'peeked', `${p.name} finds that deck empty`, { playerId: p.id });
      proceed(c);
      break;
    }
    case 'BUILD': {
      const st = s.props[action.space];
      const cost = buildCost(action.space);
      transfer(c, p.id, 'bank', cost, `Built on ${SPACES[action.space].name}`);
      st.level++;
      emit(c, 'build', `${p.name} builds ${st.level === 5 ? 'a Royal Mahal' : `Ashrama ${st.level}`} on ${SPACES[action.space].name} for ${cost} S`, { playerId: p.id, data: { space: action.space } });
      break;
    }
    case 'SELL_BUILDING': {
      const st = s.props[action.space];
      const refund = buildCost(action.space) / 2;
      st.level--;
      transfer(c, 'bank', p.id, refund, `Sold building on ${SPACES[action.space].name}`);
      emit(c, 'sell', `${p.name} sells a building on ${SPACES[action.space].name} for ${refund} S`, { playerId: p.id, data: { space: action.space } });
      if (s.turn.phase === 'debt') settleDebts(c);
      break;
    }
    case 'MORTGAGE': {
      s.props[action.space].mortgaged = true;
      transfer(c, 'bank', p.id, mortgageValue(action.space), `Mortgaged ${SPACES[action.space].name}`);
      emit(c, 'mortgage', `${p.name} mortgages ${SPACES[action.space].name} for ${mortgageValue(action.space)} S`, { playerId: p.id, data: { space: action.space } });
      if (s.turn.phase === 'debt') settleDebts(c);
      break;
    }
    case 'UNMORTGAGE': {
      const cost = unmortgageCost(action.space);
      transfer(c, p.id, 'bank', cost, `Redeemed ${SPACES[action.space].name}`);
      s.props[action.space].mortgaged = false;
      emit(c, 'unmortgage', `${p.name} redeems ${SPACES[action.space].name} for ${cost} S`, { playerId: p.id, data: { space: action.space } });
      break;
    }
    case 'DECLARE_BANKRUPTCY':
      bankrupt(c, p.id);
      break;
  }
  s.version++;
  return { ok: true, state: s, events: c.ev };
}

/**
 * Host-only override for a player who has gone offline: resolves whatever the game is waiting for
 * and passes the turn. If the player is in debt, they are declared bankrupt (nothing else can be decided for them).
 * Not reachable through guest actions; only HostGame calls it, after checking the player really is offline.
 */
export function forcePass(state: GameState): ActionResult {
  if (state.turn.phase === 'over') return { ok: false, error: 'The game is over' };
  const c: Ctx = { s: JSON.parse(JSON.stringify(state)) as GameState, ev: [] };
  const { s } = c;
  if (s.turn.phase === 'debt') {
    const id = s.debts[0].debtor;
    emit(c, 'forced', `${P(c, id).name} is offline and cannot settle the debt`, { playerId: id });
    bankrupt(c, id);
  } else {
    const p = cur(c);
    emit(c, 'forced', `${p.name} is offline; their turn is skipped`, { playerId: p.id });
    s.pendingBuy = null;
    s.pendingPeek = false;
    s.turn.extraRoll = false;
    advanceTurn(c);
  }
  s.version++;
  return { ok: true, state: s, events: c.ev };
}

/** Thin stateful wrapper for callers that prefer an object (the host session). */
export class GameEngine {
  constructor(public state: GameState) {}
  static create(players: NewPlayer[], seed: number, settings?: Partial<Settings>) {
    return new GameEngine(createGame(players, seed, settings));
  }
  dispatch(playerId: PlayerId, action: Action): ActionResult {
    const r = applyAction(this.state, playerId, action);
    if (r.ok) this.state = r.state;
    return r;
  }
}
