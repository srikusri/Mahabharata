import { create } from 'zustand';

const KEY = 'mg:ui';
interface UiPrefs {
  muted: boolean;
  haptics: boolean;
}
function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { muted: false, haptics: true, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { muted: false, haptics: true };
}
function save(p: UiPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export const useUi = create<UiPrefs & { toggleMute: () => void; toggleHaptics: () => void }>((set, get) => ({
  ...load(),
  toggleMute: () => {
    set({ muted: !get().muted });
    save({ muted: get().muted, haptics: get().haptics });
  },
  toggleHaptics: () => {
    set({ haptics: !get().haptics });
    save({ muted: get().muted, haptics: get().haptics });
  },
}));

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
