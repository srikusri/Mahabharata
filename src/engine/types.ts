/** Game state and action types. Everything here is plain JSON so it can be snapshotted and sent over the wire. */
export type PlayerId = string;
export type Party = PlayerId | 'bank';
export type DeckId = 'daiva' | 'sankat';
export type Phase = 'roll' | 'buy' | 'action' | 'debt' | 'peek' | 'over';

export interface PlayerState {
  id: PlayerId;
  name: string;
  tokenId: string;
  cash: number;
  position: number;
  inExile: boolean;
  exileTurns: number;
  bankrupt: boolean;
  /** Bhishma's Vow: skip the next turn. */
  skipNext: boolean;
  /** Kept cards: 'daiva:krishna' | 'daiva:indra' | 'daiva:hanuman'. */
  held: string[];
}

export interface PropState {
  owner: PlayerId;
  /** 0 = none, 1-4 = Ashramas, 5 = Royal Mahal. */
  level: number;
  mortgaged: boolean;
}

export interface Debt {
  debtor: PlayerId;
  creditor: Party;
  amount: number;
  reason: string;
}

export interface Settings {
  startingCash: number;
  salary: number;
  exileFee: number;
  /** Optional timed play: the game ends after this many rounds; highest net worth wins. */
  maxRounds: number | null;
}

export interface Transaction {
  n: number;
  from: Party;
  to: Party;
  amount: number;
  reason: string;
}

export interface GameEvent {
  seq: number;
  type: string;
  text: string;
  playerId?: PlayerId;
  /** Only this player may see the event (e.g. Sanjaya's Vision). */
  private?: PlayerId;
  data?: Record<string, unknown>;
}

export interface DeckState {
  draw: string[];
  discard: string[];
}

export interface GameState {
  version: number;
  settings: Settings;
  players: PlayerState[];
  props: Record<number, PropState>;
  decks: Record<DeckId, DeckState>;
  /** PRNG state. Host-only; stripped from the public view. */
  rng: number;
  turn: {
    index: number;
    round: number;
    phase: Phase;
    dice: [number, number] | null;
    doubles: number;
    extraRoll: boolean;
  };
  pendingBuy: { space: number } | null;
  pendingPeek: boolean;
  debts: Debt[];
  ledger: Transaction[];
  /** Net money the bank has paid out; Σ player cash === players * startingCash + bankNet. */
  bankNet: number;
  txCounter: number;
  log: GameEvent[];
  eventSeq: number;
  winner: PlayerId | null;
  winReason: 'last-standing' | 'timed' | 'agreed' | null;
  /** Open proposal to end the game early by net worth; every remaining player must agree. Absent in older saves. */
  endVote?: { by: PlayerId; agreed: PlayerId[] } | null;
}

export type Action =
  | { type: 'ROLL' }
  | { type: 'BUY' }
  | { type: 'DECLINE' }
  | { type: 'END_TURN' }
  | { type: 'PAY_EXILE' }
  | { type: 'USE_EXILE_CARD' }
  | { type: 'BUILD'; space: number }
  | { type: 'SELL_BUILDING'; space: number }
  | { type: 'MORTGAGE'; space: number }
  | { type: 'UNMORTGAGE'; space: number }
  | { type: 'PEEK'; deck: DeckId }
  | { type: 'DECLARE_BANKRUPTCY' }
  | { type: 'PROPOSE_END' }
  | { type: 'AGREE_END' }
  | { type: 'REJECT_END' };

export type ActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string };
