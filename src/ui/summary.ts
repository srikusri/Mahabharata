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

export interface GyanTrigger {
  space: number;
  /** Event number, so every phone picks the same fact. */
  seed: number;
  who: string;
  how: 'landed' | 'bought';
}

/**
 * Which space deserves a learning card for this update: a purchase wins, otherwise the last place a token
 * moved to (a dice move or a card move). Null when nobody landed or bought.
 */
export function gyanTrigger(batch: GameEvent[], players: { id: string; name: string }[]): GyanTrigger | null {
  const nameOf = (id?: string) => players.find((p) => p.id === id)?.name ?? 'A player';
  const buy = [...batch].reverse().find((e) => e.type === 'buy' && typeof e.data?.space === 'number');
  if (buy) return { space: buy.data!.space as number, seed: buy.seq, who: nameOf(buy.playerId), how: 'bought' };
  const move = [...batch].reverse().find((e) => e.type === 'move' && typeof e.data?.to === 'number');
  if (move) return { space: move.data!.to as number, seed: move.seq, who: nameOf(move.playerId), how: 'landed' };
  return null;
}
