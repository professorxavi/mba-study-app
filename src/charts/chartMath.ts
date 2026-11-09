import type { Area, Point, Step } from '../content/types';

/** Units bought at `price`: every demand step whose marginal benefit is at least the price. */
export function quantityDemanded(steps: Step[], price: number): number {
  return steps.filter((s) => s.value >= price).reduce((q, s) => Math.max(q, s.to), 0);
}

/** Units produced at `price`: every supply step whose marginal cost is at most the price. */
export function quantitySupplied(steps: Step[], price: number): number {
  return steps.filter((s) => s.value <= price).reduce((q, s) => Math.max(q, s.to), 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dollar value of a shaded area (see Area docs for each kind). */
export function areaValue(kind: Area['kind'], steps: Step[], price: number): number {
  const width = (s: Step) => s.to - s.from;
  const bought = steps.filter((s) => s.value >= price);
  const made = steps.filter((s) => s.value <= price);
  const sum = (list: Step[], f: (s: Step) => number) => list.reduce((t, s) => t + f(s) * width(s), 0);
  switch (kind) {
    case 'cs': return round2(sum(bought, (s) => s.value - price));
    case 'tb': return round2(sum(bought, (s) => s.value));
    case 'tc': return round2(sum(bought, () => price));
    case 'ps': return round2(sum(made, (s) => price - s.value));
    case 'tvc': return round2(sum(made, (s) => s.value));
    case 'tr': return round2(sum(made, () => price));
  }
}

/**
 * Rectangles making up an area, as [x0, x1, yLow, yHigh] in data units.
 * Each step contributes one rectangle so the shape follows the staircase.
 */
export function areaRects(kind: Area['kind'], steps: Step[], price: number): [number, number, number, number][] {
  const demandSide = kind === 'cs' || kind === 'tb' || kind === 'tc';
  const included = steps.filter((s) => (demandSide ? s.value >= price : s.value <= price));
  return included.map((s) => {
    switch (kind) {
      case 'cs': return [s.from, s.to, price, s.value];
      case 'ps': return [s.from, s.to, s.value, price];
      case 'tb':
      case 'tvc': return [s.from, s.to, 0, s.value];
      case 'tc':
      case 'tr': return [s.from, s.to, 0, price];
    }
  });
}

/** Where two straight-segment curves cross, by linear interpolation between shared x values. */
export function intersection(a: Point[], b: Point[]): Point | null {
  const xs = [...new Set([...a, ...b].map((p) => p[0]))].sort((m, n) => m - n);
  const at = (pts: Point[], x: number) => {
    const sorted = [...pts].sort((m, n) => m[0] - n[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const [x0, y0] = sorted[i];
      const [x1, y1] = sorted[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return null;
  };
  for (let i = 0; i < xs.length - 1; i++) {
    const [x0, x1] = [xs[i], xs[i + 1]];
    const [a0, a1, b0, b1] = [at(a, x0), at(a, x1), at(b, x0), at(b, x1)];
    if (a0 === null || a1 === null || b0 === null || b1 === null) continue;
    const d0 = a0 - b0;
    const d1 = a1 - b1;
    if (d0 === 0) return [x0, round2(a0)];
    if (Math.sign(d0) !== Math.sign(d1)) {
      const t = d0 / (d0 - d1);
      return [round2(x0 + t * (x1 - x0)), round2(a0 + t * (a1 - a0))];
    }
  }
  const last = xs[xs.length - 1];
  const [al, bl] = [at(a, last), at(b, last)];
  return al !== null && al === bl ? [last, round2(al)] : null;
}

/** y on a straight-segment curve at x, or null outside its range. */
export function valueAt(points: Point[], x: number): number | null {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return null;
}

/** Quantity (x) on a straight-segment curve at a price (y), or null outside its range. */
export function quantityAt(points: Point[], price: number): number | null {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (price >= Math.min(y0, y1) && price <= Math.max(y0, y1)) {
      return y1 === y0 ? x0 : round2(x0 + ((x1 - x0) * (price - y0)) / (y1 - y0));
    }
  }
  return null;
}

/** Marginal value of the step containing quantity x (units in (from, to]), or null past the schedule. */
export function stepValueAt(steps: Step[], x: number): number | null {
  const s = steps.find((st) => x > st.from && x <= st.to) ?? (x === steps[0]?.from ? steps[0] : undefined);
  return s ? s.value : null;
}
