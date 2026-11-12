import { useEffect } from 'react';

/** Keeps the screen on during a game (helps against iOS/Android backgrounding dropping the P2P link). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type Sentinel = { release: () => Promise<void> };
    let lock: Sentinel | null = null;
    let dead = false;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } };
    const grab = async () => {
      try {
        if (!dead && document.visibilityState === 'visible') lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        /* denied or unsupported */
      }
    };
    void grab();
    const onVis = () => void grab();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
