/**
 * Snapshots and host migration.
 *
 * Guests never see the PRNG state or deck order, so a successor host cannot restore those exactly. It does not need
 * to: restoreFromPublic rebuilds a fully playable GameState from the public view, with a fresh seed and every card that
 * is not being held reshuffled into its draw pile. Money, positions, ownership, buildings, mortgages, turn, phase,
 * debts and held cards all carry over exactly.
 */
import { CARDS, DECK_IDS } from './cards';
import { shuffle } from './dice';
import type { DeckId, GameState } from './types';
import type { PublicState } from './view';

export const SNAPSHOT_VERSION = 1;

/** Structural check of untrusted JSON before it is treated as a game view. */
export function isPublicState(x: unknown): x is PublicState {
  const g = x as PublicState | undefined;
  return (
    !!g &&
    typeof g === 'object' &&
    Number.isSafeInteger(g.version) &&
    Array.isArray(g.players) &&
    g.players.length >= 2 &&
    g.players.length <= 6 &&
    g.players.every((p) => p && typeof p.id === 'string' && typeof p.cash === 'number' && Array.isArray(p.held) && Number.isInteger(p.position)) &&
    !!g.turn &&
    typeof g.turn === 'object' &&
    Number.isInteger(g.turn.index) &&
    g.turn.index >= 0 &&
    g.turn.index < g.players.length &&
    !!g.props &&
    typeof g.props === 'object' &&
    Array.isArray(g.debts) &&
    !!g.settings
  );
}

export function restoreFromPublic(view: PublicState, seed: number): GameState {
  const s: GameState = {
    ...(JSON.parse(JSON.stringify(view)) as Omit<PublicState, 'decks'>),
    decks: { daiva: { draw: [], discard: [] }, sankat: { draw: [], discard: [] } },
    rng: seed | 0,
    ledger: Array.isArray(view.ledger) ? [...view.ledger] : [],
    log: Array.isArray(view.log) ? view.log.filter((e) => !e.private) : [],
  } as GameState;
  const held = new Set(s.players.flatMap((p) => p.held));
  for (const deck of ['daiva', 'sankat'] as DeckId[]) {
    s.decks[deck].draw = shuffle(s, DECK_IDS[deck].filter((id) => !held.has(id) && CARDS[id]));
  }
  s.txCounter = Math.max(s.txCounter ?? 0, ...s.ledger.map((t) => t.n));
  return s;
}
