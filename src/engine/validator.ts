/** RuleValidator: decides whether a request is legal *right now*. The host runs this on every guest action. */
import { SPACES } from './board';
import { BOARD_SIZE, END_VOTE_AFTER_ROUNDS } from './data';
import { whyNotBuild, whyNotMortgage, whyNotSell, whyNotUnmortgage } from './properties';
import type { Action, GameState, PlayerId } from './types';

const SPACE_ACTIONS = ['BUILD', 'SELL_BUILDING', 'MORTGAGE', 'UNMORTGAGE'] as const;
const PLAIN_ACTIONS = ['ROLL', 'BUY', 'DECLINE', 'END_TURN', 'PAY_EXILE', 'USE_EXILE_CARD', 'DECLARE_BANKRUPTCY', 'PROPOSE_END', 'AGREE_END', 'REJECT_END'] as const;

/** Untrusted payload -> a well-formed Action, or null. Extra fields are dropped. */
export function parseAction(payload: unknown): Action | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const t = p.type;
  if ((PLAIN_ACTIONS as readonly unknown[]).includes(t)) return { type: t } as Action;
  if ((SPACE_ACTIONS as readonly unknown[]).includes(t)) {
    const space = p.space;
    if (typeof space !== 'number' || !Number.isInteger(space) || space < 0 || space >= BOARD_SIZE) return null;
    return { type: t, space } as Action;
  }
  if (t === 'PEEK' && (p.deck === 'daiva' || p.deck === 'sankat')) return { type: 'PEEK', deck: p.deck };
  return null;
}

export function validate(s: GameState, pid: PlayerId, a: Action): string | null {
  if (s.turn.phase === 'over') return 'The game is over';
  const me = s.players.find((p) => p.id === pid);
  if (!me || me.bankrupt) return 'You are not in this game';
  const isCurrent = s.players[s.turn.index].id === pid;
  const phase = s.turn.phase;
  const debtor = s.debts[0]?.debtor;

  switch (a.type) {
    case 'ROLL':
      if (!isCurrent) return 'Not your turn';
      return phase === 'roll' ? null : 'You cannot roll now';
    case 'BUY': {
      if (!isCurrent || phase !== 'buy' || !s.pendingBuy) return 'Nothing to buy';
      const price = SPACES[s.pendingBuy.space].price ?? 0;
      return me.cash >= price ? null : `Need ${price} Suvarna`;
    }
    case 'DECLINE':
      return isCurrent && phase === 'buy' ? null : 'Nothing to decline';
    case 'END_TURN':
      if (!isCurrent) return 'Not your turn';
      return phase === 'action' ? null : 'Finish your move first';
    case 'PAY_EXILE':
      if (!isCurrent || phase !== 'roll' || !me.inExile) return 'You are not in exile';
      return me.cash >= s.settings.exileFee ? null : `Need ${s.settings.exileFee} Suvarna`;
    case 'USE_EXILE_CARD':
      if (!isCurrent || phase !== 'roll' || !me.inExile) return 'You are not in exile';
      return me.held.includes('daiva:krishna') ? null : "You do not hold Krishna's Counsel";
    case 'PEEK':
      return isCurrent && phase === 'peek' ? null : 'Nothing to peek at';
    case 'PROPOSE_END': {
      const done = s.turn.round - 1;
      if (done < END_VOTE_AFTER_ROUNDS) return `The game can be ended by agreement after ${END_VOTE_AFTER_ROUNDS} rounds (${done} played)`;
      return s.endVote ? 'A proposal to end the game is already open' : null;
    }
    case 'AGREE_END':
      if (!s.endVote) return 'Nobody has proposed ending the game';
      return s.endVote.agreed.includes(pid) ? 'You already agreed' : null;
    case 'REJECT_END':
      return s.endVote ? null : 'Nobody has proposed ending the game';
    case 'DECLARE_BANKRUPTCY':
      return phase === 'debt' && debtor === pid ? null : 'You are not in debt';
    case 'BUILD':
    case 'UNMORTGAGE':
      if (!isCurrent || (phase !== 'roll' && phase !== 'action')) return 'Not allowed now';
      return (a.type === 'BUILD' ? whyNotBuild : whyNotUnmortgage)(s, pid, a.space);
    case 'SELL_BUILDING':
    case 'MORTGAGE': {
      const raising = phase === 'debt' && debtor === pid;
      const myTurn = isCurrent && (phase === 'roll' || phase === 'action');
      if (!raising && !myTurn) return 'Not allowed now';
      return (a.type === 'SELL_BUILDING' ? whyNotSell : whyNotMortgage)(s, pid, a.space);
    }
  }
}
