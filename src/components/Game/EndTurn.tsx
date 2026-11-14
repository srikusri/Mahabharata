import { useEffect, useRef, useState } from 'react';
import { useUi } from '../../ui/prefs';

/**
 * End-turn button with an optional countdown. It only exists once the game has nothing left to decide for you
 * (phase "action"). Any new game state restarts the countdown, so building or mortgaging first is never cut short.
 */
export function EndTurn({ version, onEnd }: { version: number; onEnd: () => void }) {
  const { autoEnd, autoEndSec } = useUi();
  const [held, setHeld] = useState(false);
  const [left, setLeft] = useState(autoEndSec);
  const fired = useRef(false);
  const end = useRef(onEnd);
  end.current = onEnd;
  const running = autoEnd && !held;

  useEffect(() => {
    fired.current = false;
    setLeft(autoEndSec);
    if (!running) return;
    const deadline = Date.now() + autoEndSec * 1000;
    const iv = setInterval(() => {
      const ms = deadline - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(iv);
        end.current();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [version, running, autoEnd, autoEndSec]);

  return (
    <div className="flex flex-col gap-1">
      <button className="btn-gold text-lg" data-testid="end-turn" onClick={() => { fired.current = true; onEnd(); }}>
        End turn{running ? ` (${left}s)` : ''}
      </button>
      {autoEnd && (
        <div className="flex items-center gap-2 text-xs opacity-90" data-testid="auto-end">
          <div className="h-1 flex-1 overflow-hidden rounded bg-gold/20" aria-hidden>
            <div className="h-full bg-gold transition-[width] duration-200 ease-linear" style={{ width: held ? '100%' : `${(left / autoEndSec) * 100}%` }} />
          </div>
          <button className="underline" data-testid="auto-end-hold" onClick={() => setHeld((h) => !h)}>
            {held ? 'Resume timer' : 'Wait, I am not done'}
          </button>
        </div>
      )}
    </div>
  );
}
