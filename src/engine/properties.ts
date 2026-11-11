/** Ownership, rent, building and mortgage rules. Pure functions over GameState. */
import { GROUPS, SPACES } from './board';
import { ASTRA_MULT, ASTRA_SPACES, GROUP_SPACES, RATHA_RENT, RATHA_SPACES, RENTS } from './data';
import type { GameState, PlayerId } from './types';

export const level = (s: GameState, i: number) => s.props[i]?.level ?? 0;
export const ownedBy = (s: GameState, pid: PlayerId) =>
  Object.keys(s.props).map(Number).filter((i) => s.props[i].owner === pid).sort((a, b) => a - b);

export function ownsGroup(s: GameState, pid: PlayerId, space: number): boolean {
  const g = SPACES[space].group;
  return !!g && GROUP_SPACES[g].every((i) => s.props[i]?.owner === pid);
}

export const mortgageValue = (space: number) => (SPACES[space].price ?? 0) / 2;
/** Un-mortgaging costs the mortgage value plus 10% (the print rules are silent; classic convention). */
export const unmortgageCost = (space: number) => Math.round(mortgageValue(space) * 1.1);
export const buildCost = (space: number) => {
  const g = SPACES[space].group;
  return g ? GROUPS[g].buildCost : 0;
};

export function rentFor(s: GameState, space: number, diceTotal: number): number {
  const sp = SPACES[space];
  const st = s.props[space];
  if (!st) return 0;
  if (sp.kind === 'prop') {
    const row = RENTS[sp.name];
    if (st.level > 0) return row[1 + st.level];
    return ownsGroup(s, st.owner, space) ? row[1] : row[0];
  }
  if (sp.kind === 'ratha') {
    const n = RATHA_SPACES.filter((i) => s.props[i]?.owner === st.owner).length;
    return RATHA_RENT[n - 1];
  }
  if (sp.kind === 'astra') {
    const n = ASTRA_SPACES.filter((i) => s.props[i]?.owner === st.owner).length;
    return ASTRA_MULT[n - 1] * diceTotal;
  }
  return 0;
}

function groupLevels(s: GameState, space: number): number[] {
  const g = SPACES[space].group!;
  return GROUP_SPACES[g].filter((i) => i !== space).map((i) => level(s, i));
}

export function whyNotBuild(s: GameState, pid: PlayerId, space: number): string | null {
  const sp = SPACES[space];
  const st = s.props[space];
  if (sp?.kind !== 'prop') return 'Only kingdoms can be built on';
  if (!st || st.owner !== pid) return 'You do not own that kingdom';
  if (!ownsGroup(s, pid, space)) return 'You must own the complete colour group';
  if (GROUP_SPACES[sp.group!].some((i) => s.props[i].mortgaged)) return 'A kingdom in this group is mortgaged';
  if (st.level >= 5) return 'Already has a Royal Mahal';
  if (st.level > Math.min(...groupLevels(s, space))) return 'Build evenly across the group';
  const cost = buildCost(space);
  if (s.players.find((p) => p.id === pid)!.cash < cost) return `Need ${cost} Suvarna`;
  return null;
}

export function whyNotSell(s: GameState, pid: PlayerId, space: number): string | null {
  const st = s.props[space];
  if (SPACES[space]?.kind !== 'prop' || !st || st.owner !== pid) return 'You do not own that kingdom';
  if (st.level === 0) return 'Nothing to sell';
  if (st.level < Math.max(...groupLevels(s, space))) return 'Sell evenly across the group';
  return null;
}

export function whyNotMortgage(s: GameState, pid: PlayerId, space: number): string | null {
  const st = s.props[space];
  const sp = SPACES[space];
  if (!sp || !['prop', 'ratha', 'astra'].includes(sp.kind) || !st || st.owner !== pid) return 'You do not own that';
  if (st.mortgaged) return 'Already mortgaged';
  if (sp.kind === 'prop' && GROUP_SPACES[sp.group!].some((i) => level(s, i) > 0)) return 'Sell the Ashramas in this group first';
  return null;
}

export function whyNotUnmortgage(s: GameState, pid: PlayerId, space: number): string | null {
  const st = s.props[space];
  if (!st || st.owner !== pid) return 'You do not own that';
  if (!st.mortgaged) return 'Not mortgaged';
  const cost = unmortgageCost(space);
  if (s.players.find((p) => p.id === pid)!.cash < cost) return `Need ${cost} Suvarna`;
  return null;
}

/** Cash + property (mortgaged at mortgage value) + building money spent. Used for timed play. */
export function netWorth(s: GameState, pid: PlayerId): number {
  const p = s.players.find((x) => x.id === pid)!;
  let total = p.cash;
  for (const i of ownedBy(s, pid)) {
    const st = s.props[i];
    total += st.mortgaged ? mortgageValue(i) : SPACES[i].price ?? 0;
    total += st.level * buildCost(i);
  }
  return total;
}
