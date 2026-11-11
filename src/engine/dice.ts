/** Deterministic PRNG (mulberry32) whose state lives in GameState.rng, so a seed replays a whole game. */
export function nextRandom(holder: { rng: number }): number {
  holder.rng = (holder.rng + 0x6d2b79f5) | 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rollDie(holder: { rng: number }): number {
  return 1 + Math.floor(nextRandom(holder) * 6);
}

export function shuffle<T>(holder: { rng: number }, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(holder) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh 32-bit seed from the platform CSPRNG (host calls this once when the game starts). */
export function randomSeed(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] | 0;
}
