import { useState } from 'react';
import { useLessonScope } from '../content/context';
import type { ChartData, ChartSpec, Curve, PriceLine } from '../content/types';
import { areaValue, intersection, quantityAt, quantityDemanded, quantitySupplied } from './chartMath';
import { fmtMoney } from '../format';
import { XYChart } from './XYChart';

const money = fmtMoney;
const qty = (n: number) => (Number.isInteger(n) ? n : Math.round(n)).toLocaleString();

interface State {
  /** null: no price chosen yet (charts whose book figure has no active price line). */
  price: number | null;
  shifts: Record<string, number>;
}

/**
 * Apply the reader's price and curve shifts to a spec. The default state returns the book's figure unchanged.
 * Labels whose text is a curve id (e.g. "D") move with that curve; labels flagged `value` hide once anything changes.
 */
function derive(spec: ChartSpec, state: State, changed: boolean): ChartSpec {
  if (!changed) return spec;
  const { price, shifts } = state;
  const curves: Curve[] = [];
  for (const c of spec.curves ?? []) {
    const dx = shifts[c.id] ?? 0;
    if (dx === 0 || !c.points) {
      curves.push(c);
      continue;
    }
    curves.push({ ...c, id: `${c.id}-was`, ghost: true });
    curves.push({ ...c, points: c.points.map(([px, py]) => [px + dx, py]), dots: false });
  }

  const active = spec.priceLines?.find((p) => !p.old);
  const priceLines: PriceLine[] =
    price === null ? spec.priceLines ?? [] : [{ ...(active ?? {}), price, label: `P = ${money(price)}`, old: false }];

  const d = curves.find((c) => c.role === 'demand' && !c.ghost && c.points);
  const s = curves.find((c) => c.role === 'supply' && !c.ghost && c.points);
  const e = spec.marker && d?.points && s?.points ? intersection(d.points, s.points) : null;

  return {
    ...spec,
    curves,
    priceLines: Object.keys(shifts).some((k) => shifts[k] !== 0) && price === null ? [] : priceLines,
    areas: spec.areas?.map((a) => (a.faded || price === null ? a : { ...a, price })),
    marker: e ? { at: e, label: `E (${money(e[1])}, ${qty(e[0])})` } : undefined,
    labels: spec.labels
      ?.filter((l) => !l.value)
      .map((l) => (shifts[l.text] ? { ...l, at: [l.at[0] + shifts[l.text], l.at[1]] } : l)),
  };
}

/** One line of plain-language results for the current state, read out to screen readers too. */
function readout(spec: ChartSpec, price: number | null, schedules: ChartData['schedules']): string {
  const parts: string[] = [];
  const lineD = spec.curves?.find((c) => c.role === 'demand' && !c.ghost && c.points);
  const lineS = spec.curves?.find((c) => c.role === 'supply' && !c.ghost && c.points);
  if (spec.marker) parts.push(`Equilibrium ${spec.marker.label.replace(/^E /, '')}`);
  else if (lineD && lineS) parts.push('The curves no longer cross in view');

  if (price !== null) {
    for (const c of spec.curves ?? []) {
      if (c.shape !== 'steps' || !c.schedule) continue;
      const steps = schedules[c.schedule].steps;
      if (c.role === 'demand') {
        const tb = areaValue('tb', steps, price);
        const tc = areaValue('tc', steps, price);
        parts.push(`At ${money(price)}: Q = ${qty(quantityDemanded(steps, price))}`, `total benefit ${money(tb)} − total cost ${money(tc)} = CS ${money(tb - tc)}`);
      } else {
        const tr = areaValue('tr', steps, price);
        const tvc = areaValue('tvc', steps, price);
        parts.push(`At ${money(price)}: Q = ${qty(quantitySupplied(steps, price))}`, `total revenue ${money(tr)} − total variable cost ${money(tvc)} = PS ${money(tr - tvc)}`);
      }
    }
    if (lineD && lineS) {
      const qd = quantityAt(lineD.points!, price);
      const qs = quantityAt(lineS.points!, price);
      if (qd === null || qs === null) parts.push(`At ${money(price)}: outside the plotted schedules`);
      else {
        const gap = Math.round(qs - qd);
        const verdict = gap > 0 ? `surplus of ${qty(gap)}` : gap < 0 ? `shortage of ${qty(-gap)}` : 'no shortage or surplus';
        parts.push(`At ${money(price)}: Qd ${qty(qd)}, Qs ${qty(qs)}, ${verdict}`);
      }
    }
  }
  return parts.join(' · ');
}

const SHIFT_NAMES: Record<string, string> = { demand: 'Shift demand', supply: 'Shift supply' };

export function InteractiveChart({ spec }: { spec: ChartSpec }) {
  const cfg = spec.interactive!;
  const initial: State = { price: spec.priceLines?.find((p) => !p.old)?.price ?? null, shifts: {} };
  const [state, setState] = useState<State>(initial);
  const { schedules } = useLessonScope().charts;
  const changed = state.price !== initial.price || Object.values(state.shifts).some((v) => v !== 0);
  const shown = derive(spec, state, changed);

  const setPrice = (raw: number) => {
    const p = cfg.price!;
    const snapped = Math.round(Math.min(p.max, Math.max(p.min, raw)) / p.step) * p.step;
    setState((s) => ({ ...s, price: Math.round(snapped * 100) / 100 }));
  };
  const sliderPrice = state.price ?? spec.marker?.at[1] ?? cfg.price?.min ?? 0;

  return (
    <>
      <XYChart spec={shown} onPriceChange={cfg.price ? setPrice : undefined} />
      <div className="controls">
        {cfg.price && (
          <label className="control">
            <span>Price <strong>{state.price === null ? 'not set' : money(state.price)}</strong></span>
            <input
              type="range"
              min={cfg.price.min}
              max={cfg.price.max}
              step={cfg.price.step}
              value={sliderPrice}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
        )}
        {cfg.shift?.curves.map((id) => {
          const curve = spec.curves?.find((c) => c.id === id);
          const v = state.shifts[id] ?? 0;
          return (
            <label key={id} className="control">
              <span>
                {SHIFT_NAMES[curve?.role ?? ''] ?? `Shift ${id}`} <strong>{v > 0 ? `+${v}` : v}</strong>
              </span>
              <input
                type="range"
                min={-cfg.shift!.range}
                max={cfg.shift!.range}
                step={cfg.shift!.step}
                value={v}
                onChange={(e) => setState((s) => ({ ...s, shifts: { ...s.shifts, [id]: Number(e.target.value) } }))}
              />
            </label>
          );
        })}
        <button type="button" className="reset" disabled={!changed} onClick={() => setState(initial)}>
          Reset to the book's figure
        </button>
      </div>
      <p className="readout" aria-live="polite">
        {changed
          ? readout(shown, state.price, schedules)
          : initial.price === null
            ? 'Use the sliders to test a price or shift the curves.'
            : 'Drag the price line or use the slider.'}
      </p>
    </>
  );
}
