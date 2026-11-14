import type { GameEvent, PublicState } from '../../engine';
import { lastAction } from '../../ui/summary';
import { TOKEN_STYLE } from '../Player/tokens';
import type { TokenId } from '../../multiplayer/lobby';

/** Right under the board: what just happened, who paid whom and who got what, without scrolling. */
export function LastAction({ game }: { game: PublicState }) {
  const rows: GameEvent[] = lastAction(game.log, 4);
  if (!rows.length) return null;
  return (
    <section className="card !p-2" data-testid="last-action" aria-label="Last action" aria-live="polite">
      <ul className="flex flex-col gap-0.5 text-sm">
        {rows.map((e, i) => {
          const p = game.players.find((x) => x.id === e.playerId);
          const color = p ? TOKEN_STYLE[p.tokenId as TokenId]?.color : undefined;
          const newest = i === rows.length - 1;
          return (
            <li key={e.seq} className={`flex items-start gap-2 ${newest ? 'font-bold text-gold-light' : 'opacity-75'}`}>
              <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: color ?? '#BF9A45' }} />
              <span>{e.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
