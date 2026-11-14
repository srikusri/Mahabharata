import { useEffect, useRef } from 'react';
import type { GameEvent } from '../../engine';

/**
 * Shows a drawn card (or a private peek). Says whose card it is and what it did, so onlookers are not confused.
 * Onlookers' copy closes by itself after a few seconds; the player who drew it dismisses it.
 */
export function CardModal({ event, effects, who, mine, onClose }: { event: GameEvent; effects: GameEvent[]; who: string; mine: boolean; onClose: () => void }) {
  const isPeek = event.type === 'peek';
  const deck = (event.data?.deck as string | undefined) ?? '';
  const daiva = deck === 'daiva';
  const onlooker = !mine && !isPeek;
  const close = useRef(onClose);
  close.current = onClose; // the parent re-renders often; keep the timer from restarting each time
  useEffect(() => {
    if (!onlooker) return;
    const t = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(t);
  }, [onlooker, event.seq]);
  const accent = daiva ? '#D9731B' : '#1F5FBF';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" data-testid="card-modal" onClick={onClose}>
      <div className="flip-in w-full max-w-xs rounded-2xl border-4 p-5 text-center shadow-2xl" style={{ background: daiva ? '#FCEFD2' : '#E4EEFA', borderColor: accent, color: '#2B2114' }}>
        <div className="mb-1 rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: accent }} data-testid="card-owner">
          {isPeek ? 'Only you can see this' : mine ? 'You drew this card' : `${who} drew this card`}
        </div>
        <div className="text-xs font-bold tracking-widest" style={{ color: accent }}>
          {isPeek ? "SANJAYA'S VISION" : daiva ? 'DAIVA CARD' : 'DHARMA SANKAT CARD'}
        </div>
        {isPeek ? (
          <p className="mt-3 text-base">{event.text}</p>
        ) : (
          <>
            <h3 className="mt-2 text-xl font-bold">{String(event.data?.title)}</h3>
            <p className="mt-2 text-base">{String(event.data?.text)}</p>
          </>
        )}
        {effects.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-black/20 pt-2 text-left text-sm" data-testid="card-effects">
            {effects.map((e) => (
              <li key={e.seq}>{e.text}</li>
            ))}
          </ul>
        )}
        <button className="btn-gold mt-4 w-full" onClick={onClose}>{onlooker ? 'Close' : 'OK'}</button>
      </div>
    </div>
  );
}
