import { TOKENS, TokenId } from '../../multiplayer/lobby';

export const TOKEN_STYLE: Record<TokenId, { color: string; letter: string }> = {
  crown: { color: '#E6C45A', letter: 'C' },
  chariot: { color: '#D8453F', letter: 'R' },
  horse: { color: '#3FA46A', letter: 'H' },
  elephant: { color: '#8C93A3', letter: 'E' },
  conch: { color: '#4FC3F7', letter: 'S' },
  bow: { color: '#FF9A4D', letter: 'B' },
};

export const tokenName = (id: TokenId): string => TOKENS.find((t) => t.id === id)?.name ?? id;
