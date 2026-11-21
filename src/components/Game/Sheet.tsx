import { ReactNode, useEffect } from 'react';

/** Standard bottom sheet: dim backdrop, drag-handle look, title, close button, scrolls inside itself. */
export function Sheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId ?? 'sheet'}
        className="sheet-up flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-2xl border-t border-gold/50 bg-navy shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gold/40" aria-hidden />
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold-light">{title}</h2>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 text-lg leading-none" onClick={onClose} aria-label="Close" data-testid="sheet-close">
            ×
          </button>
        </div>
        <div className="safe-b flex flex-col gap-3 overflow-y-auto px-3">{children}</div>
      </div>
    </div>
  );
}
