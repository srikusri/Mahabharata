/** Spaces a token walks, one at a time, from `from` to `to`. Long or backward moves (card teleports, exile) jump. */
export function hopPath(from: number, to: number, size = 40, maxWalk = 12): number[] {
  if (from === to) return [];
  const dist = (to - from + size) % size;
  if (dist > maxWalk) return [to];
  return Array.from({ length: dist }, (_, i) => (from + i + 1) % size);
}

/** Money change summary per player between two cash snapshots (only non-zero changes). */
export function cashDeltas(prev: Record<string, number>, next: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, c] of Object.entries(next)) {
    const d = c - (prev[id] ?? c);
    if (d !== 0) out[id] = d;
  }
  return out;
}

export interface Standing {
  id: string;
  name: string;
  tokenId: string;
  net: number;
  bankrupt: boolean;
}

/** Final ranking: winner first, then by net worth, bankrupt players last. */
export function standings(players: Standing[], winnerId: string | null): Standing[] {
  return [...players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return b.net - a.net;
  });
}
