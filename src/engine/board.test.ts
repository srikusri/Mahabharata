import { describe, expect, it } from 'vitest';
import { GROUPS, GROUP_ORDER, SPACES, gridPos } from './board';

describe('board', () => {
  it('has 40 spaces indexed 0..39', () => {
    expect(SPACES).toHaveLength(40);
    SPACES.forEach((s, i) => expect(s.index).toBe(i));
  });

  it('has the four corners in the right places', () => {
    expect([0, 10, 20, 30].map((i) => SPACES[i].kind)).toEqual(['go', 'exile', 'park', 'goexile']);
  });

  it('has 23 kingdoms, all with unique names, 4 rathas, 2 astras', () => {
    const props = SPACES.filter((s) => s.kind === 'prop');
    expect(props).toHaveLength(23);
    expect(new Set(props.map((p) => p.name)).size).toBe(23);
    expect(SPACES.filter((s) => s.kind === 'ratha')).toHaveLength(4);
    expect(SPACES.filter((s) => s.kind === 'astra')).toHaveLength(2);
    expect(SPACES.filter((s) => s.kind === 'daiva')).toHaveLength(3);
    expect(SPACES.filter((s) => s.kind === 'sankat')).toHaveLength(3);
    expect(SPACES.filter((s) => s.kind === 'tax')).toHaveLength(1);
  });

  it('keeps each colour group together as a block, in group order', () => {
    const seen: string[] = [];
    for (const s of SPACES) if (s.group && seen[seen.length - 1] !== s.group) seen.push(s.group);
    expect(seen).toEqual([...GROUP_ORDER]);
    for (const g of GROUP_ORDER) {
      expect(SPACES.filter((s) => s.group === g).map((s) => [s.name.toLowerCase(), s.price])).toEqual(
        GROUPS[g].props.map(([n, p]) => [n.toLowerCase(), p]),
      );
    }
  });

  it('prices follow the print edition', () => {
    const price = (name: string) => SPACES.find((s) => s.name === name)?.price;
    expect(price('Viratanagara')).toBe(60);
    expect(price('Hastinapura')).toBe(400);
    expect(price('Varanavata')).toBe(375);
    expect(price('Nandighosha Ratha')).toBe(200);
    expect(price('Agni Astra')).toBe(150);
  });

  it('maps every space to a unique grid cell on the perimeter', () => {
    const cells = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { row, col } = gridPos(i);
      expect(row === 0 || row === 10 || col === 0 || col === 10).toBe(true);
      cells.add(`${row},${col}`);
    }
    expect(cells.size).toBe(40);
    expect(gridPos(0)).toMatchObject({ row: 10, col: 10 });
    expect(gridPos(10)).toMatchObject({ row: 10, col: 0 });
    expect(gridPos(20)).toMatchObject({ row: 0, col: 0 });
    expect(gridPos(30)).toMatchObject({ row: 0, col: 10 });
  });
});
