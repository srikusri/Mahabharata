import { create } from 'zustand';

const KEY = 'mg:ui';
interface UiPrefs {
  muted: boolean;
  haptics: boolean;
  /** End the turn by itself after a pause once there is nothing left to decide. */
  autoEnd: boolean;
  autoEndSec: number;
  /** Show a short learning fact when someone lands on or buys a space. */
  gyan: boolean;
}
const DEFAULTS: UiPrefs = { muted: false, haptics: true, autoEnd: true, autoEndSec: 15, gyan: true };
function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}
function save(p: UiPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const persist = (g: UiPrefs) => save({ muted: g.muted, haptics: g.haptics, autoEnd: g.autoEnd, autoEndSec: g.autoEndSec, gyan: g.gyan });

export const useUi = create<UiPrefs & { toggleMute: () => void; toggleHaptics: () => void; toggleAutoEnd: () => void; toggleGyan: () => void }>((set, get) => ({
  ...load(),
  toggleMute: () => {
    set({ muted: !get().muted });
    persist(get());
  },
  toggleHaptics: () => {
    set({ haptics: !get().haptics });
    persist(get());
  },
  toggleGyan: () => {
    set({ gyan: !get().gyan });
    persist(get());
  },
  toggleAutoEnd: () => {
    set({ autoEnd: !get().autoEnd });
    persist(get());
  },
}));

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
