import { SPACES, GROUPS, GROUP_COLOR } from '../../engine/board';
import { RENTS, RATHA_RENT, ASTRA_MULT, mortgageValue, buildCost } from '../../engine';
import type { PublicState } from '../../engine';

const ROW = ['Rent (alone)', 'Rent (full colour set)', 'With 1 Ashrama', 'With 2 Ashramas', 'With 3 Ashramas', 'With 4 Ashramas', 'Royal Mahal'];

/** Tap a board space to read its deed. Pure display; reads the public state only. */
export function DeedModal({ index, game, onClose }: { index: number; game: PublicState; onClose: () => void }) {
  const s = SPACES[index];
  const st = game.props[index];
  const owner = st ? game.players.find((p) => p.id === st.owner) : undefined;
  const rent = RENTS[s.name];
  const bar = s.group ? GROUP_COLOR[s.group] : '#BF9A45';
  const here = game.players.filter((p) => !p.bankrupt && p.position === index).map((p) => p.name);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-label={`${s.name} deed`} data-testid="deed-modal" onClick={onClose}>
      <div className="w-full max-w-xs overflow-hidden rounded-xl bg-paper text-[#2B2114] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 text-center font-bold uppercase tracking-wider" style={{ background: bar, color: s.group === 'yellow' || s.group === 'lblue' ? '#2B2114' : '#fff' }}>
          {s.name}
          {s.group && <div className="text-[10px] font-normal normal-case opacity-90">Kingdom of {GROUPS[s.group].realm}</div>}
        </div>
        <div className="p-4 text-sm">
          {s.price !== undefined && s.kind !== 'tax' && (
            <div className="mb-2 flex justify-between"><span>Price</span><b>{s.price} S</b></div>
          )}
          {rent && (
            <table className="w-full">
              <tbody>
                {ROW.map((r, i) => (
                  <tr key={r} className={st && st.level === i - 1 && i >= 2 ? 'font-bold' : ''}>
                    <td className="py-0.5">{r}</td>
                    <td className="text-right">{rent[i]} S</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rent && <div className="mt-2 text-xs opacity-80">Ashrama costs {buildCost(index)} S each. Mortgage value {mortgageValue(index)} S.</div>}
          {s.kind === 'ratha' && (
            <>
              <p>Rent by Rathas owned:</p>
              <ul className="mt-1">{RATHA_RENT.map((r, i) => <li key={r}>{i + 1} owned: <b>{r} S</b></li>)}</ul>
              <div className="mt-2 text-xs opacity-80">Mortgage value {mortgageValue(index)} S.</div>
            </>
          )}
          {s.kind === 'astra' && (
            <p>Rent is <b>{ASTRA_MULT[0]}×</b> the dice total, or <b>{ASTRA_MULT[1]}×</b> if the owner holds both Astras. Mortgage value {mortgageValue(index)} S.</p>
          )}
          {s.kind === 'tax' && <p>Pay 100 S to the bank.</p>}
          {s.kind === 'daiva' && <p>Draw a Daiva card.</p>}
          {s.kind === 'sankat' && <p>Draw a Dharma Sankat card.</p>}
          {s.kind === 'go' && <p>Collect 200 S each time you pass or land here.</p>}
          {s.kind === 'exile' && <p>Just visiting, or serving Vanavasa. Leave by rolling doubles, paying 50 S, or using Krishna&apos;s Counsel.</p>}
          {s.kind === 'park' && <p>A safe resting place.</p>}
          {s.kind === 'goexile' && <p>Go directly to Vanavasa. You collect no salary.</p>}
          {(st || here.length > 0) && (
            <div className="mt-3 border-t border-black/20 pt-2 text-xs">
              {st && <div data-testid="deed-owner">Owner: <b>{owner?.name}</b>{st.mortgaged ? ' (mortgaged)' : st.level === 5 ? ' · Royal Mahal' : st.level ? ` · ${st.level} Ashrama${st.level > 1 ? 's' : ''}` : ''}</div>}
              {here.length > 0 && <div>Here now: {here.join(', ')}</div>}
            </div>
          )}
          <button className="btn-gold mt-3 w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
