/** What guests are allowed to see: no PRNG state, no deck order, and private events only for their owner. */
import type { DeckId, GameEvent, GameState, PlayerId } from './types';

export type PublicState = Omit<GameState, 'rng' | 'decks' | 'log' | 'ledger'> & {
  decks: Record<DeckId, { count: number }>;
  log: GameEvent[];
  ledger: GameState['ledger'];
};

export function publicView(s: GameState, viewer?: PlayerId): PublicState {
  const { rng: _rng, decks, log, ledger, ...rest } = s;
  return {
    ...rest,
    decks: {
      daiva: { count: decks.daiva.draw.length + decks.daiva.discard.length },
      sankat: { count: decks.sankat.draw.length + decks.sankat.discard.length },
    },
    ledger: ledger.slice(-40),
    log: log.filter((e) => !e.private || e.private === viewer).slice(-60),
  };
}
