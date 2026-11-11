import type { GameEvent } from '../../engine';

/** Shows a drawn card (or a private peek) until dismissed. Everyone sees public draws. */
export function CardModal({ event, onClose }: { event: GameEvent; onClose: () => void }) {
  const isPeek = event.type === 'peek';
  const deck = (event.data?.deck as string | undefined) ?? '';
  const daiva = deck === 'daiva';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" data-testid="card-modal" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl border-4 p-5 text-center shadow-2xl" style={{ background: daiva ? '#FCEFD2' : '#E4EEFA', borderColor: daiva ? '#D9731B' : '#1F5FBF', color: '#2B2114' }}>
        <div className="text-xs font-bold tracking-widest" style={{ color: daiva ? '#D9731B' : '#1F5FBF' }}>
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
        <button className="btn-gold mt-4 w-full" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}
