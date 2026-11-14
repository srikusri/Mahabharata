/**
 * Rules data transcribed from the print edition PDF (deeds p4-9, Rathas/Astras p10, cards p11-12).
 * Rent rows: [alone, full colour group, 1, 2, 3, 4 Ashramas, Royal Mahal].
 */
import { GROUPS, GroupId, SPACES } from './board';

export const RENTS: Record<string, readonly number[]> = {
  Viratanagara: [2, 4, 10, 30, 90, 160, 250],
  Upaplavya: [4, 8, 20, 60, 180, 320, 450],
  Ahichhatra: [6, 12, 30, 90, 270, 400, 550],
  Kampilya: [6, 12, 30, 90, 270, 400, 550],
  'S. Panchala': [8, 16, 40, 100, 300, 450, 600],
  Chanderi: [10, 20, 50, 150, 450, 625, 750],
  Ujjayani: [10, 20, 50, 150, 450, 625, 750],
  Mahishmati: [12, 24, 60, 180, 500, 700, 900],
  Girivraja: [14, 28, 70, 200, 550, 750, 950],
  Rajagriha: [14, 28, 70, 200, 550, 750, 950],
  Pataliputra: [16, 32, 80, 220, 600, 800, 1000],
  Purushapura: [18, 36, 90, 250, 700, 875, 1050],
  Taxila: [18, 36, 90, 250, 700, 875, 1050],
  'Dwaraka Outpost': [20, 40, 100, 300, 750, 925, 1100],
  Mathura: [22, 44, 110, 330, 800, 975, 1150],
  Dwaraka: [22, 44, 110, 330, 800, 975, 1150],
  Anarta: [24, 48, 120, 360, 850, 1025, 1200],
  Khandavaprastha: [26, 52, 130, 390, 900, 1100, 1275],
  'Maya Sabha': [26, 52, 130, 390, 900, 1100, 1275],
  Indraprastha: [28, 56, 150, 450, 1000, 1200, 1400],
  Narasimha: [35, 70, 175, 500, 1100, 1300, 1500],
  Varanavata: [40, 80, 200, 550, 1200, 1500, 1700],
  Hastinapura: [50, 100, 200, 600, 1400, 1700, 2000],
};

/** Rent for owning 1, 2, 3, 4 Rathas. */
export const RATHA_RENT = [25, 50, 100, 200] as const;
/** Astra rent is this multiple of the dice total: one owned, both owned. */
export const ASTRA_MULT = [4, 10] as const;

export const RATHA_SPACES = SPACES.filter((s) => s.kind === 'ratha').map((s) => s.index);
export const ASTRA_SPACES = SPACES.filter((s) => s.kind === 'astra').map((s) => s.index);
export const GROUP_SPACES = Object.fromEntries(
  (Object.keys(GROUPS) as GroupId[]).map((g) => [g, SPACES.filter((s) => s.group === g).map((s) => s.index)]),
) as Record<GroupId, number[]>;

export const EXILE_SPACE = 10;
export const PARK_SPACE = 20;
export const GO_SPACE = 0;
export const BOARD_SIZE = 40;

/** After this many completed rounds, players may end the game by unanimous agreement; net worth decides. */
export const END_VOTE_AFTER_ROUNDS = 100;

export const DEFAULT_SETTINGS = { startingCash: 1500, salary: 200, exileFee: 50, maxRounds: null as number | null };

for (const s of SPACES) {
  if (s.kind === 'prop' && (RENTS[s.name]?.length ?? 0) !== 7) throw new Error(`Missing rent table for ${s.name}`);
}
