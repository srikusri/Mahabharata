import { END_VOTE_AFTER_ROUNDS } from '../../engine';
import type { Action, PublicState } from '../../engine';

/** After 100 rounds any player can propose ending the game; when every remaining player agrees, net worth decides. */
export function EndGamePanel({ game, selfId, send }: { game: PublicState; selfId: string; send: (a: Action) => void }) {
  const vote = game.endVote ?? null;
  const done = game.turn.round - 1;
  if (game.turn.phase === 'over') return null;
  if (!vote && done < END_VOTE_AFTER_ROUNDS) return null;
  const alive = game.players.filter((p) => !p.bankrupt);
  const me = alive.find((p) => p.id === selfId);
  if (!me) return null;

  if (!vote) {
    return (
      <section className="card flex flex-col gap-2" data-testid="end-game-panel">
        <div className="font-bold text-gold-light">{done} rounds played</div>
        <p className="text-sm opacity-85">If every player agrees, the game ends now and the greatest net worth wins.</p>
        <button className="btn-ghost" data-testid="propose-end" onClick={() => send({ type: 'PROPOSE_END' })}>
          Propose to end the game
        </button>
      </section>
    );
  }
  const proposer = game.players.find((p) => p.id === vote.by)?.name ?? 'A player';
  const iAgreed = vote.agreed.includes(selfId);
  return (
    <section className="card flex flex-col gap-2 border-gold" data-testid="end-game-vote" role="status">
      <div className="font-bold text-gold-light">{proposer} proposes to end the game</div>
      <p className="text-sm opacity-85">Everyone must agree. The player with the greatest net worth (cash, kingdoms and buildings) wins.</p>
      <ul className="flex flex-wrap gap-2 text-xs">
        {alive.map((p) => (
          <li key={p.id} className={`rounded-full border px-2 py-0.5 ${vote.agreed.includes(p.id) ? 'border-green-400 text-green-300' : 'border-gold/40 opacity-70'}`}>
            {vote.agreed.includes(p.id) ? '✓' : '…'} {p.name}
          </li>
        ))}
      </ul>
      {iAgreed ? (
        <div className="grid grid-cols-1 gap-2">
          <div className="text-center text-xs opacity-80">Waiting for the others ({vote.agreed.length} of {alive.length})</div>
          <button className="btn-ghost" data-testid="withdraw-end" onClick={() => send({ type: 'REJECT_END' })}>
            Withdraw
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-gold" data-testid="agree-end" onClick={() => send({ type: 'AGREE_END' })}>
            Agree
          </button>
          <button className="btn-ghost" data-testid="decline-end" onClick={() => send({ type: 'REJECT_END' })}>
            Keep playing
          </button>
        </div>
      )}
    </section>
  );
}
