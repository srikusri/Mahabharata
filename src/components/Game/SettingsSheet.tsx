import { useState } from 'react';
import { useUi } from '../../ui/prefs';

/** One tidy place for the per-phone switches, so the game header stays short on small screens. */
export function SettingsSheet() {
  const [open, setOpen] = useState(false);
  const ui = useUi();
  const row = (label: string, hint: string, on: boolean, toggle: () => void, id: string) => (
    <button key={id} className="flex w-full items-center justify-between gap-3 rounded-lg border border-gold/30 p-3 text-left" onClick={toggle} aria-pressed={on} data-testid={id}>
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-xs opacity-70">{hint}</span>
      </span>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-gold text-navy' : 'border border-gold/40'}`}>{on ? 'On' : 'Off'}</span>
    </button>
  );
  return (
    <>
      <button className="rounded border border-gold/40 px-2 py-0.5" onClick={() => setOpen(true)} data-testid="settings" aria-label="Settings">
        Settings
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Settings" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-navy-2 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-gold-light">Settings (this phone)</h2>
            <div className="flex flex-col gap-2">
              {row('Sound', 'Dice, coins and chimes', !ui.muted, ui.toggleMute, 'mute')}
              {row('Learning facts', 'A short fact when someone lands on or buys a space', ui.gyan, ui.toggleGyan, 'gyan-toggle')}
              {row('Auto-end turn', 'End my turn after a pause when nothing is left to do', ui.autoEnd, ui.toggleAutoEnd, 'auto-end-toggle')}
              {row('Vibration', 'Buzz when it becomes my turn (Android)', ui.haptics, ui.toggleHaptics, 'haptics-toggle')}
            </div>
            <button className="btn-gold mt-4 w-full" onClick={() => setOpen(false)} data-testid="settings-close">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
