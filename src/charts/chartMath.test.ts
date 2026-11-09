import { describe, expect, it } from 'vitest';
import type { Point, Step } from '../content/types';
import { areaValue, intersection, quantityAt, quantityDemanded, quantitySupplied, stepValueAt } from './chartMath';

// Made-up schedules (no course content lives in the repo): blocks of 10 units of demand, 5 units of supply.
const blocks = (width: number, values: number[]): Step[] => values.map((value, i) => ({ from: i * width, to: (i + 1) * width, value }));
const demand = blocks(10, [5, 4, 2.5, 1]);
const supply = blocks(5, [1, 2, 3.5, 5]);
const lineD: Point[] = [[0, 10], [100, 0]];
const lineS: Point[] = [[0, 0], [100, 10]];

describe('consumer surplus on a staircase', () => {
  it('buys every block worth at least the price', () => {
    expect(quantityDemanded(demand, 3)).toBe(20);
    expect(quantityDemanded(demand, 2)).toBe(30);
    expect(quantityDemanded(demand, 4)).toBe(20);
  });
  it('TB, TC and CS at $3', () => {
    expect(areaValue('tb', demand, 3)).toBe(90);
    expect(areaValue('tc', demand, 3)).toBe(60);
    expect(areaValue('cs', demand, 3)).toBe(30);
  });
  it('CS rises to $55 when the price falls to $2', () => {
    expect(areaValue('cs', demand, 2)).toBe(55);
  });
});

describe('producer surplus on a staircase', () => {
  it('produces every block costing at most the price', () => {
    expect(quantitySupplied(supply, 3)).toBe(10);
    expect(quantitySupplied(supply, 4)).toBe(15);
  });
  it('TR, TVC and PS at $3', () => {
    expect(areaValue('tr', supply, 3)).toBe(30);
    expect(areaValue('tvc', supply, 3)).toBe(15);
    expect(areaValue('ps', supply, 3)).toBe(15);
  });
  it('PS rises to $27.50 at $4', () => {
    expect(areaValue('ps', supply, 4)).toBe(27.5);
  });
});

describe('line curves', () => {
  it('D and S cross at the equilibrium', () => {
    expect(intersection(lineD, lineS)).toEqual([50, 5]);
  });
  it('reads Qd and Qs at a price', () => {
    expect(quantityAt(lineD, 4)).toBe(60);
    expect(quantityAt(lineS, 4)).toBe(40);
    expect(quantityAt(lineD, 12)).toBeNull();
  });
  it('shifting demand right raises the equilibrium price and quantity', () => {
    const shifted = lineD.map(([q, p]) => [q + 20, p] as Point);
    expect(intersection(shifted, lineS)).toEqual([60, 6]);
  });
  it('reads the step value under a quantity', () => {
    expect(stepValueAt(demand, 15)).toBe(4);
    expect(stepValueAt(demand, 5)).toBe(5);
    expect(stepValueAt(demand, 50)).toBeNull();
  });
});
