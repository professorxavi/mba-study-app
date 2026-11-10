import { useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { curveMonotoneX, line, scaleLinear } from 'd3';
import { useLessonScope } from '../content/context';
import type { ChartSpec, Curve, Point, Schedule, Step } from '../content/types';
import { areaRects, stepValueAt, valueAt } from './chartMath';
import { useWidth } from './useWidth';

const M = { top: 18, right: 12, bottom: 46, left: 68 };

type Schedules = Record<string, Pick<Schedule, 'steps'>>;

function curvePath(steps: Step[], curve: Curve, x: (n: number) => number, y: (n: number) => number): string {
  if (curve.shape === 'steps') {
    let d = `M${x(steps[0].from)},${y(steps[0].value)}`;
    for (const s of steps) d += `V${y(s.value)}H${x(s.to)}`;
    // A demand staircase drops to the axis after the last unit, as in the book's figures.
    if (curve.role === 'demand') d += `V${y(0)}`;
    return d;
  }
  if (curve.shape === 'points') return '';
  const pts = [...(curve.points ?? [])].sort((a, b) => a[0] - b[0]);
  const gen = line<Point>().x((p) => x(p[0])).y((p) => y(p[1]));
  if (curve.shape === 'smooth') gen.curve(curveMonotoneX);
  return gen(pts) ?? '';
}

/** A decimal year (2005.5) as "Jul 2005". */
function monthLabel(v: number): string {
  const months = Math.round(v * 12);
  return new Date(Date.UTC(Math.floor(months / 12), months % 12)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** A decimal year as a date, e.g. "Jan 3, 2006" (a month counts as 30.5 days, matching the data's encoding). */
function dayLabel(v: number): string {
  const months = v * 12;
  const m = Math.floor(months + 1e-9);
  const day = 1 + Math.round((months - m) * 30.5);
  return new Date(Date.UTC(Math.floor(m / 12), m % 12, day)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Ticks on whole months, spaced so there are at most `count` of them. */
function monthTicks(x0: number, x1: number, count: number): number[] {
  const first = Math.ceil(x0 * 12 - 1e-6);
  const last = Math.floor(x1 * 12 + 1e-6);
  const step = [1, 2, 3, 4, 6, 12].find((s) => (last - first) / s < count) ?? 12;
  const out: number[] = [];
  for (let m = first; m <= last; m += step) out.push(m / 12);
  return out;
}

function dotsFor(steps: Step[], curve: Curve): Point[] {
  if (Array.isArray(curve.dots)) return curve.dots;
  if (!curve.dots) return [];
  return curve.shape === 'steps' ? steps.map((s) => [s.to, s.value]) : curve.points ?? [];
}

interface Props {
  spec: ChartSpec;
  /** Step data for `steps` curves; defaults to the lesson's shared schedules. */
  schedules?: Schedules;
  /** Makes the active (non-old) price line draggable; receives the raw price under the pointer. */
  onPriceChange?: (price: number) => void;
}

export function XYChart({ spec, schedules: given, onPriceChange }: Props) {
  const lessonSchedules = useLessonScope().charts.schedules;
  const schedules = given ?? lessonSchedules;
  const [ref, width] = useWidth<HTMLDivElement>();
  const clipId = useId();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const height = Math.round(Math.min(400, Math.max(280, width * 0.72)));
  const [x0, x1] = spec.xDomain ?? [0, 1];
  const [y0, y1] = spec.yDomain ?? [0, 1];
  const x = scaleLinear().domain([x0, x1]).range([M.left, width - M.right]);
  const y = scaleLinear().domain([y0, y1]).range([height - M.bottom, M.top]);
  const prefix = spec.yPrefix ?? '';
  const decimals = spec.yDecimals;
  const fmtY = (v: number) =>
    `${prefix}${decimals === undefined ? v.toFixed(2) : v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  const xFormat = spec.xFormat ?? 'quantity';
  const fmtX = (v: number) => (x1 - x0 > 60 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString();
  const tickCount = width < 420 ? 4 : 6;
  const xTicks = xFormat === 'month' ? monthTicks(x0, x1, tickCount) : x.ticks(tickCount);
  const fmtTick = (t: number) => (xFormat === 'month' ? monthLabel(t) : xFormat === 'year' ? String(Math.round(t)) : t.toLocaleString());
  const tipX = (v: number) => (xFormat === 'month' ? dayLabel(v) : xFormat === 'year' ? String(Math.round(v)) : `${spec.xName ?? 'Q'} = ${fmtX(v)}`);
  const yTicks = y.ticks(height < 300 ? 5 : 7);
  const curves = spec.curves ?? [];
  const curveById = new Map(curves.map((c) => [c.id, c]));
  const stepsFor = (c: Curve): Step[] => (c.schedule ? schedules[c.schedule]?.steps ?? [] : []);
  const active = spec.priceLines?.find((p) => !p.old);

  const plotX = (e: PointerEvent<SVGElement>) => {
    const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect();
    return { px: e.clientX - box.left, py: e.clientY - box.top };
  };
  const onHover = (e: PointerEvent<SVGElement>) => {
    const { px } = plotX(e);
    setHoverX(Math.min(x1, Math.max(x0, x.invert(px))));
  };
  const onDrag = (e: PointerEvent<SVGElement>) => {
    if (!dragging || !onPriceChange) return;
    onPriceChange(y.invert(plotX(e).py));
  };

  // Hover readout: each visible curve's price at the cursor quantity.
  const readings =
    hoverX === null
      ? []
      : curves
          .filter((c) => !c.ghost)
          .map((c) => {
            // Unconnected points only have a value right at a point.
            const near = c.points?.find((p) => Math.abs(p[0] - hoverX) <= (x1 - x0) / 40);
            const v = c.shape === 'steps' ? stepValueAt(stepsFor(c), hoverX) : c.shape === 'points' ? near?.[1] ?? null : valueAt(c.points ?? [], hoverX);
            return { c, v };
          })
          .filter((r): r is { c: Curve; v: number } => r.v !== null);
  const tipLeft = hoverX === null ? 0 : x(hoverX);
  const tipRef = useRef<HTMLDivElement>(null);
  // Place the tip right of the crosshair if it fits, otherwise left of it, and always inside the chart.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const w = tip.offsetWidth;
    const left = tipLeft + 10 + w > width ? tipLeft - 10 - w : tipLeft + 10;
    tip.style.left = `${Math.max(0, Math.min(left, width - w))}px`;
  });

  return (
    <div ref={ref} className="xy">
      {curves.filter((c) => !c.ghost).length > 1 && (
        <div className="chart-legend" aria-hidden="true">
          {curves.filter((c) => !c.ghost).map((c) => <span key={c.id} className={c.role}>{c.label}</span>)}
        </div>
      )}
      <div className="plot">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${spec.title} (${spec.figure})`}>
          <defs>
            <clipPath id={clipId}>
              <rect x={M.left} y={M.top} width={Math.max(0, width - M.left - M.right)} height={Math.max(0, height - M.top - M.bottom)} />
            </clipPath>
          </defs>
          <g className="grid">
            {yTicks.map((t) => <line key={t} x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />)}
          </g>

          <g clipPath={`url(#${clipId})`}>
            {spec.areas?.map((a, i) => {
              const curve = curveById.get(a.curve);
              if (!curve) return null;
              return (
                <g key={i} className={`area ${a.kind}${a.faded ? ' faded' : ''}`}>
                  {areaRects(a.kind, stepsFor(curve), a.price).map(([ax0, ax1, lo, hi], j) => (
                    <rect key={j} x={x(ax0)} width={x(ax1) - x(ax0)} y={y(hi)} height={y(lo) - y(hi)} />
                  ))}
                </g>
              );
            })}
          </g>

          {spec.guides?.map(([gx, gy], i) => (
            <path key={i} className="guide" d={`M${x(gx)},${y(y0)}V${y(gy)}H${x(x0)}`} fill="none" />
          ))}

          <g className="axis">
            <line x1={M.left} x2={width - M.right} y1={y(y0)} y2={y(y0)} />
            <line x1={M.left} x2={M.left} y1={y(y0)} y2={y(y1)} />
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={y(y0) + 16} textAnchor="middle">{fmtTick(t)}</text>
            ))}
            {yTicks.map((t) => (
              <text key={t} x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{fmtY(t)}</text>
            ))}
          </g>
          <text className="axis-label" x={(M.left + width - M.right) / 2} y={height - 6} textAnchor="middle">{spec.xLabel}</text>
          <text className="axis-label" transform={`translate(12,${(M.top + height - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">{spec.yLabel}</text>

          {spec.priceLines?.map((p) => (
            <g key={`${p.price}-${p.old ? 'old' : 'now'}`}>
              <line className={`price-line${p.old ? ' old' : ''}`} x1={M.left} x2={width - M.right} y1={y(p.price)} y2={y(p.price)} />
              <text className="label small" x={width - M.right - 2} y={y(p.price) + (p.labelBelow ? 16 : -6)} textAnchor="end">{p.label}</text>
            </g>
          ))}

          <g clipPath={`url(#${clipId})`}>
            {curves.map((c) => {
              const steps = stepsFor(c);
              return (
                <g key={c.id} className={c.ghost ? 'ghost' : undefined}>
                  <path className={`curve ${c.role}`} d={curvePath(steps, c, x, y)} />
                  {!c.ghost && dotsFor(steps, c).map(([px, py]) => (
                    <circle key={`${px}-${py}`} className={`dot ${c.role}`} cx={x(px)} cy={y(py)} r={4.5} />
                  ))}
                </g>
              );
            })}
          </g>

          {spec.marker && (
            <g>
              <circle className="point-e" cx={x(spec.marker.at[0])} cy={y(spec.marker.at[1])} r={6} />
              {/* Right of the crossing is the open wedge between the rising S and falling D. */}
              <text className="label" x={x(spec.marker.at[0]) + 12} y={y(spec.marker.at[1])} dy="0.32em">{spec.marker.label}</text>
            </g>
          )}

          {spec.labels?.map((l) => (
            <text key={l.text} className={`label${l.small ? ' small' : ''}`} x={x(l.at[0])} y={y(l.at[1])} dy="0.32em" textAnchor={l.anchor ?? 'middle'}>
              {l.text}
            </text>
          ))}

          {hoverX !== null && <line className="crosshair" x1={x(hoverX)} x2={x(hoverX)} y1={M.top} y2={y(y0)} />}

          {/* Hit layer for the hover readout, sized to the plot area. */}
          <rect
            className="hit"
            x={M.left}
            y={M.top}
            width={Math.max(0, width - M.left - M.right)}
            height={Math.max(0, height - M.top - M.bottom)}
            onPointerMove={onHover}
            onPointerDown={onHover}
            onPointerLeave={(e) => e.pointerType !== 'touch' && setHoverX(null)}
          />

          {onPriceChange && active && (
            <line
              className={`price-handle${dragging ? ' dragging' : ''}`}
              x1={M.left}
              x2={width - M.right}
              y1={y(active.price)}
              y2={y(active.price)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(true);
                setHoverX(null);
              }}
              onPointerMove={onDrag}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
            />
          )}
        </svg>

        {hoverX !== null && !dragging && (
          <div ref={tipRef} className="chart-tip" style={{ left: tipLeft + 10, top: M.top }} aria-hidden="true">
            <span className="tip-q">{tipX(hoverX)}</span>
            {readings.length === 0 && <span className="tip-row">No curve here</span>}
            {readings.map(({ c, v }) => (
              <span key={c.id} className={`tip-row ${c.role}`}>
                {c.label}: {fmtY(v)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
