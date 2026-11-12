import { useEffect, useRef, useState } from 'react';
import { hopPath } from './hop';
import { reducedMotion } from './prefs';

/** Walks each token to its target one space at a time. Returns the positions to draw. */
export function useHopPositions(targets: Record<string, number>, onStep?: () => void, stepMs = 130): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>(targets);
  const queued = useRef<Record<string, number>>({ ...targets });
  const queues = useRef<Record<string, number[]>>({});
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  const key = JSON.stringify(targets);
  useEffect(() => {
    const quick = reducedMotion();
    for (const [id, to] of Object.entries(targets)) {
      const from = queued.current[id] ?? to;
      if (from === to) continue;
      queued.current[id] = to;
      queues.current[id] = [...(queues.current[id] ?? []), ...(quick ? [to] : hopPath(from, to))];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const iv = setInterval(() => {
      let moved = false;
      const patch: Record<string, number> = {};
      for (const [id, q] of Object.entries(queues.current)) {
        if (q.length) {
          patch[id] = q.shift() as number;
          moved = true;
        }
      }
      if (moved) {
        setShown((s) => ({ ...s, ...patch }));
        stepRef.current?.();
      }
    }, stepMs);
    return () => clearInterval(iv);
  }, [stepMs]);

  // players that left the target list should not linger
  const out: Record<string, number> = {};
  for (const id of Object.keys(targets)) out[id] = shown[id] ?? targets[id];
  return out;
}
