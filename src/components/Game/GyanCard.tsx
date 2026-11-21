import { useEffect, useState } from 'react';
import { gyanFor, pickFact } from '../../content/gyan';
import { SPACES, GROUP_COLOR } from '../../engine/board';
import type { GyanTrigger } from '../../ui/summary';
import { canSpeak, speak, stopSpeaking } from '../../ui/speech';

/** A small "did you know" card about the space someone just landed on or bought. Never blocks play. */
export function GyanCard({ trigger, onClose }: { trigger: GyanTrigger; onClose: () => void }) {
  const found = gyanFor(trigger.space);
  const [extra, setExtra] = useState(0);
  useEffect(() => setExtra(0), [trigger.seed]);
  useEffect(() => {
    const t = setTimeout(onClose, 30000);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [trigger.seed, onClose]);
  if (!found) return null;
  const { name, gyan } = found;
  const space = SPACES[trigger.space];
  const fact = pickFact(gyan, trigger.seed + extra);
  const bar = space.group ? GROUP_COLOR[space.group] : '#BF9A45';
  return (
    <section className="card relative overflow-hidden !p-0" data-testid="gyan-card" aria-label={`Did you know: ${name}`}>
      <div className="h-1.5" style={{ background: bar }} />
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold/80">Gyan · {gyan.kind}</div>
            <h3 className="font-bold text-gold-light" data-testid="gyan-title">
              {name}
            </h3>
            <div className="text-xs opacity-70">{trigger.who} {trigger.how === 'bought' ? 'bought this' : 'landed here'}</div>
          </div>
          <button className="px-1 text-lg leading-none opacity-70" onClick={onClose} aria-label="Close fact" data-testid="gyan-close">
            ×
          </button>
        </div>
        <p className="text-sm leading-snug" data-testid="gyan-fact" aria-live="polite">
          {fact}
        </p>
        {gyan.word && <p className="text-xs text-gold-light">Word: {gyan.word.replace(/^[^:]+: /, '')}</p>}
        {gyan.today && <p className="text-xs opacity-80">Today (as usually identified): {gyan.today}</p>}
        <div className="mt-1 flex gap-2 text-xs">
          {gyan.facts.length > 1 && (
            <button className="btn-ghost !px-3 !py-1" onClick={() => setExtra((e) => e + 1)} data-testid="gyan-next">
              Another fact
            </button>
          )}
          {canSpeak() && (
            <button className="btn-ghost !px-3 !py-1" onClick={() => speak(`${name}. ${fact}`)} data-testid="gyan-listen">
              Listen
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
