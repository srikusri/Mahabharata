import type { GameEvent } from '../engine';

/** Event types that are bookkeeping, not something a player needs to read in the summary. */
const QUIET = new Set(['turn']);

/** The last few things that happened, oldest first. Survives reconnects because it reads the shared log. */
export function lastAction(log: GameEvent[], max = 4): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = log.length - 1; i >= 0 && out.length < max; i--) {
    const e = log[i];
    if (!QUIET.has(e.type) && !e.private) out.unshift(e);
  }
  return out;
}

/** What a drawn card caused: the events of the same update that came after it (payments, moves, salary...). */
export function cardEffects(batch: GameEvent[], card: GameEvent): GameEvent[] {
  return batch.filter((e) => e.seq > card.seq && !e.private && !['turn', 'card', 'dice', 'peek'].includes(e.type));
}
