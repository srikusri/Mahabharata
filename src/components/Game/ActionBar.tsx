import { SPACES } from '../../engine/board';
import type { Action, PublicState } from '../../engine';

/** The one decision the game is waiting for, as big buttons. Everything is a request; the host decides. */
export function ActionBar({ game, selfId, send }: { game: PublicState; selfId: string; send: (a: Action) => void }) {
  const me = game.players.find((p) => p.id === selfId)!;
  const current = game.players[game.turn.index];
  const mine = current.id === selfId;
  const phase = game.turn.phase;
  const debt = game.debts[0];

  if (phase === 'over') return null;

  if (phase === 'debt') {
    if (debt?.debtor !== selfId)
      return <Banner>{game.players.find((p) => p.id === debt?.debtor)?.name} must raise {debt?.amount} S ({debt?.reason})</Banner>;
    return (
      <div className="card flex flex-col gap-2" data-testid="debt-bar">
        <div className="font-bold text-red-300">You owe {debt.amount} S: {debt.reason}</div>
        <div className="text-sm opacity-80">You have {me.cash} S. Mortgage kingdoms or sell Ashramas below, or declare bankruptcy.</div>
        <button className="btn-ghost border-red-400 text-red-300" data-testid="bankrupt" onClick={() => confirm('Declare bankruptcy and leave the game?') && send({ type: 'DECLARE_BANKRUPTCY' })}>
          Declare bankruptcy
        </button>
      </div>
    );
  }

  if (!mine) return <Banner>Waiting for {current.name}…</Banner>;

  switch (phase) {
    case 'roll':
      return (
        <div className="flex flex-col gap-2">
          <button className="btn-gold text-lg" data-testid="roll" onClick={() => send({ type: 'ROLL' })}>
            Roll the dice
          </button>
          {me.inExile && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" data-testid="pay-exile" disabled={me.cash < game.settings.exileFee} onClick={() => send({ type: 'PAY_EXILE' })}>
                Pay {game.settings.exileFee} S to leave
              </button>
              <button className="btn-ghost" data-testid="exile-card" disabled={!me.held.includes('daiva:krishna')} onClick={() => send({ type: 'USE_EXILE_CARD' })}>
                Use Krishna's Counsel
              </button>
            </div>
          )}
        </div>
      );
    case 'buy': {
      const sp = SPACES[game.pendingBuy!.space];
      return (
        <div className="card flex flex-col gap-2" data-testid="buy-bar">
          <div className="font-bold">{sp.name} is unowned. Buy for {sp.price} S?</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-gold" data-testid="buy" disabled={me.cash < (sp.price ?? 0)} onClick={() => send({ type: 'BUY' })}>
              Buy
            </button>
            <button className="btn-ghost" data-testid="decline" onClick={() => send({ type: 'DECLINE' })}>
              Pass
            </button>
          </div>
        </div>
      );
    }
    case 'peek':
      return (
        <div className="card flex flex-col gap-2">
          <div className="font-bold">Sanjaya's Vision: peek at the top card of…</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-gold" onClick={() => send({ type: 'PEEK', deck: 'daiva' })}>Daiva deck</button>
            <button className="btn-gold" onClick={() => send({ type: 'PEEK', deck: 'sankat' })}>Dharma Sankat deck</button>
          </div>
        </div>
      );
    case 'action':
      return (
        <button className="btn-gold text-lg" data-testid="end-turn" onClick={() => send({ type: 'END_TURN' })}>
          End turn
        </button>
      );
  }
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-sm" data-testid="waiting">{children}</div>;
}
