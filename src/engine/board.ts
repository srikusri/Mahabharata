/**
 * Board definition: the 40 spaces, in clockwise order from Rajasooya Yagna (GO).
 * This mirrors the A3 print artwork (make_board3.py) so the digital and printed
 * boards cannot drift apart. It is data only; game rules live in the engine (Phase 3).
 */
export type GroupId = 'brown' | 'lblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'dblue';
export type SpaceKind = 'go' | 'exile' | 'park' | 'goexile' | 'prop' | 'ratha' | 'astra' | 'daiva' | 'sankat' | 'tax';

export interface Space {
  index: number;
  kind: SpaceKind;
  name: string;
  price?: number;
  group?: GroupId;
}

export interface GroupInfo {
  realm: string;
  buildCost: number;
  props: ReadonlyArray<readonly [string, number]>;
}

export const GROUPS: Record<GroupId, GroupInfo> = {
  brown: { realm: 'Matsya', buildCost: 50, props: [['Viratanagara', 60], ['Upaplavya', 60]] },
  lblue: { realm: 'Panchala', buildCost: 50, props: [['Ahichhatra', 100], ['Kampilya', 100], ['S. Panchala', 120]] },
  pink: { realm: 'Chedi & Avanti', buildCost: 100, props: [['Chanderi', 140], ['Ujjayani', 140], ['Mahishmati', 160]] },
  orange: { realm: 'Magadha', buildCost: 100, props: [['Girivraja', 180], ['Rajagriha', 180], ['Pataliputra', 200]] },
  red: { realm: 'Gandhara', buildCost: 150, props: [['Purushapura', 220], ['Taxila', 220], ['Dwaraka Outpost', 240]] },
  yellow: { realm: 'Yadava', buildCost: 150, props: [['Mathura', 260], ['Dwaraka', 260], ['Anarta', 280]] },
  green: { realm: 'Pandava Capital', buildCost: 200, props: [['Khandavaprastha', 300], ['Maya Sabha', 300], ['Indraprastha', 320]] },
  dblue: { realm: 'Imperial Capital', buildCost: 200, props: [['Narasimha', 350], ['Varanavata', 375], ['Hastinapura', 400]] },
};

/** Order of colour groups around the board, clockwise from GO. */
export const GROUP_ORDER: readonly GroupId[] = ['yellow', 'lblue', 'red', 'brown', 'green', 'pink', 'orange', 'dblue'];

export const GROUP_COLOR: Record<GroupId, string> = {
  brown: '#8A5A44',
  lblue: '#8FC1D4',
  pink: '#C97B9B',
  orange: '#D98A3D',
  red: '#B5313A',
  yellow: '#E6C45A',
  green: '#3E7D5B',
  dblue: '#2C3F8F',
};

const PROPERTY_SLOTS = [1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 38, 39];

const SPECIAL: Record<number, Omit<Space, 'index'>> = {
  0: { kind: 'go', name: 'Rajasooya Yagna' },
  10: { kind: 'exile', name: 'Vanavasa' },
  20: { kind: 'park', name: 'Amaravati' },
  30: { kind: 'goexile', name: 'Go to Vanavasa' },
  2: { kind: 'sankat', name: 'Dharma Sankat' },
  17: { kind: 'sankat', name: 'Dharma Sankat' },
  33: { kind: 'sankat', name: 'Dharma Sankat' },
  7: { kind: 'daiva', name: 'Daiva Card' },
  22: { kind: 'daiva', name: 'Daiva Card' },
  36: { kind: 'daiva', name: 'Daiva Card' },
  4: { kind: 'tax', name: 'Royal Tax', price: 100 },
  5: { kind: 'ratha', name: 'Nandighosha Ratha', price: 200 },
  15: { kind: 'ratha', name: 'Vijaya Ratha', price: 200 },
  25: { kind: 'ratha', name: 'Celestial Ratha', price: 200 },
  35: { kind: 'ratha', name: 'Divine Ratha', price: 200 },
  12: { kind: 'astra', name: 'Agni Astra', price: 150 },
  28: { kind: 'astra', name: 'Varun Astra', price: 150 },
};

function build(): Space[] {
  const props: Space[] = [];
  for (const g of GROUP_ORDER) for (const [name, price] of GROUPS[g].props) props.push({ index: -1, kind: 'prop', name, price, group: g });
  const spaces: Space[] = [];
  let p = 0;
  for (let i = 0; i < 40; i++) {
    const s = SPECIAL[i];
    if (s) spaces.push({ index: i, ...s });
    else if (PROPERTY_SLOTS.includes(i)) spaces.push({ ...props[p++], index: i });
    else throw new Error(`Board space ${i} is undefined`);
  }
  if (p !== props.length) throw new Error('Property count mismatch');
  return spaces;
}

export const SPACES: readonly Space[] = build();

export type Side = 'bottom' | 'left' | 'top' | 'right';

/** Grid position (0-based row/col in an 11x11 grid) and which side of the board a space is on. */
export function gridPos(i: number): { row: number; col: number; side: Side; corner: boolean } {
  if (i === 0) return { row: 10, col: 10, side: 'bottom', corner: true };
  if (i < 10) return { row: 10, col: 10 - i, side: 'bottom', corner: false };
  if (i === 10) return { row: 10, col: 0, side: 'bottom', corner: true };
  if (i < 20) return { row: 10 - (i - 10), col: 0, side: 'left', corner: false };
  if (i === 20) return { row: 0, col: 0, side: 'top', corner: true };
  if (i < 30) return { row: 0, col: i - 20, side: 'top', corner: false };
  if (i === 30) return { row: 0, col: 10, side: 'top', corner: true };
  return { row: i - 30, col: 10, side: 'right', corner: false };
}
