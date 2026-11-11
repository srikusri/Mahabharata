/** Lobby data model shared by host and guests. */
import { isPlainObject } from './MessageProtocol';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const TOKENS = [
  { id: 'crown', name: 'Royal Crown' },
  { id: 'chariot', name: 'Sacred Chariot' },
  { id: 'horse', name: 'War Horse' },
  { id: 'elephant', name: 'Royal Elephant' },
  { id: 'conch', name: 'Divine Conch' },
  { id: 'bow', name: 'Gandiva Bow' },
] as const;

export type TokenId = (typeof TOKENS)[number]['id'];

export function isTokenId(x: unknown): x is TokenId {
  return typeof x === 'string' && TOKENS.some((t) => t.id === x);
}

export interface LobbyPlayer {
  id: string;
  name: string;
  tokenId: TokenId;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

/** The lobby as seen by guests. It never contains the room PIN. */
export interface PublicLobby {
  roomId: string;
  hostId: string;
  phase: 'lobby' | 'playing';
  players: LobbyPlayer[];
  version: number;
  maxPlayers: number;
}

export type RejectReason =
  | 'BAD_PIN'
  | 'ROOM_FULL'
  | 'TOKEN_TAKEN'
  | 'BAD_TOKEN'
  | 'BAD_NAME'
  | 'ID_IN_USE'
  | 'GAME_STARTED'
  | 'TOO_MANY_ATTEMPTS'
  | 'BAD_REQUEST'
  | 'KICKED';

export const REJECT_TEXT: Record<RejectReason, string> = {
  BAD_PIN: 'Wrong PIN. Check the number on the host screen.',
  ROOM_FULL: 'This game is full.',
  TOKEN_TAKEN: 'That token was just taken. Pick another.',
  BAD_TOKEN: 'Pick a token.',
  BAD_NAME: 'Enter a name (1-20 characters).',
  ID_IN_USE: 'This player is already in the room.',
  GAME_STARTED: 'The game has already started.',
  TOO_MANY_ATTEMPTS: 'Too many wrong PINs. Ask the host for a new invite.',
  BAD_REQUEST: 'The host could not understand the request.',
  KICKED: 'The host removed you from the game.',
};

/** Trim, collapse whitespace, strip control characters and angle brackets; 1-20 chars. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s.length > 0 ? s : null;
}

/** Validate a lobby received over the wire. */
export function parseLobby(x: unknown): PublicLobby | null {
  if (!isPlainObject(x)) return null;
  if (typeof x.roomId !== 'string' || typeof x.hostId !== 'string') return null;
  if (x.phase !== 'lobby' && x.phase !== 'playing') return null;
  if (!Number.isSafeInteger(x.version) || !Number.isSafeInteger(x.maxPlayers)) return null;
  if (!Array.isArray(x.players) || x.players.length > MAX_PLAYERS) return null;
  const players: LobbyPlayer[] = [];
  for (const p of x.players) {
    if (!isPlainObject(p)) return null;
    const name = sanitizeName(p.name);
    if (typeof p.id !== 'string' || !name || !isTokenId(p.tokenId)) return null;
    players.push({
      id: p.id,
      name,
      tokenId: p.tokenId,
      ready: p.ready === true,
      connected: p.connected !== false,
      isHost: p.isHost === true,
    });
  }
  return {
    roomId: x.roomId,
    hostId: x.hostId,
    phase: x.phase,
    version: x.version as number,
    maxPlayers: x.maxPlayers as number,
    players,
  };
}
