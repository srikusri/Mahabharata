import { useState } from 'react';
import { GROUP_COLOR, SPACES } from '../../engine/board';
import { buildCost, mortgageValue, unmortgageCost, whyNotBuild, whyNotMortgage, whyNotSell, whyNotUnmortgage } from '../../engine/properties';
import { RENTS } from '../../engine/data';
import type { Action, GameState, PublicState } from '../../engine';

const LEVEL = ['', '1 Ashrama', '2 Ashramas', '3 Ashramas', '4 Ashramas', 'Royal Mahal'];

/** Your holdings with the actions the rules currently allow. Buttons are disabled with the rule's own reason. */
export function PropertyPanel({ game, selfId, send }: { game: PublicState; selfId: string; send: (a: Action) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const mine = Object.keys(game.props).map(Number).filter((i) => game.props[i].owner === selfId).sort((a, b) => a - b);
  // The rules helpers only read players/props, which the public view carries.
  const s = game as unknown as GameState;
  if (!mine.length) return <section className="card text-sm opacity-70">You own no kingdoms yet.</section>;
  return (
    <section className="card flex flex-col gap-2" data-testid="properties">
      <h3 className="font-bold text-gold-light">Your holdings</h3>
      {mine.map((i) => {
        const sp = SPACES[i];
        const st = game.props[i];
        const color = sp.group ? GROUP_COLOR[sp.group] : sp.kind === 'ratha' ? '#BF9A45' : '#4A7FD0';
        const isOpen = open === i;
        const row = (label: string, a: Action, why: string | null) => (
          <button key={label} className="btn-ghost px-3 py-2 text-sm" disabled={!!why} title={why ?? ''} onClick={() => send(a)}>
            {label}
          </button>
        );
        return (
          <div key={i} className="rounded-lg border border-gold/30" data-prop={sp.name}>
            <button className="flex w-full items-center gap-2 p-2 text-left" onClick={() => setOpen(isOpen ? null : i)}>
              <span className="h-4 w-4 shrink-0 rounded" style={{ background: color }} />
              <span className="flex-1 font-bold">{sp.name}</span>
              <span className="text-xs opacity-70">
                {st.mortgaged ? 'Mortgaged' : sp.kind === 'prop' ? LEVEL[st.level] || 'No buildings' : ''}
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-wrap gap-2 border-t border-gold/20 p-2">
                {sp.kind === 'prop' && (
                  <>
                    {row(`Build (${buildCost(i)} S)`, { type: 'BUILD', space: i }, whyNotBuild(s, selfId, i))}
                    {row(`Sell (+${buildCost(i) / 2} S)`, { type: 'SELL_BUILDING', space: i }, whyNotSell(s, selfId, i))}
                  </>
                )}
                {row(`Mortgage (+${mortgageValue(i)} S)`, { type: 'MORTGAGE', space: i }, whyNotMortgage(s, selfId, i))}
                {row(`Redeem (${unmortgageCost(i)} S)`, { type: 'UNMORTGAGE', space: i }, whyNotUnmortgage(s, selfId, i))}
                {sp.kind === 'prop' && (
                  <div className="w-full text-xs opacity-70">
                    Rent: {RENTS[sp.name][0]} alone, {RENTS[sp.name][1]} group, {RENTS[sp.name].slice(2).join(' / ')} with 1-4 Ashramas and Mahal
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
