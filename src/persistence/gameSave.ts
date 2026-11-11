/** Host-side snapshot of a game in progress, so a reloaded or crashed host can pick up where it left off. */
import type { GameState } from '../engine';
import type { SeatsSnapshot } from '../multiplayer/HostManager';
import { kvDelete, kvGet, kvSet } from './IndexedDBManager';

export interface HostSave {
  v: 1;
  roomId: string;
  hostId: string;
  hostName: string;
  hostToken: string;
  pin: string;
  seats: SeatsSnapshot;
  state: GameState;
  savedAt: number;
}

const KEY = 'hostGame';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export const saveHostGame = (s: HostSave) => kvSet(KEY, s);
export const clearHostGame = () => kvDelete(KEY);

export async function loadHostGame(now = Date.now()): Promise<HostSave | null> {
  const s = await kvGet<HostSave>(KEY);
  if (!s || s.v !== 1 || !s.state || !s.seats || now - s.savedAt > MAX_AGE_MS) return null;
  if (s.state.turn.phase === 'over') return null;
  return s;
}
