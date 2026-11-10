import { scaleLinear } from 'd3';
import type { ScatterSpec } from '../content/types';
import { useWidth } from './useWidth';

const M = { top: 22, right: 16, bottom: 52, left: 40 };

/** Labeled bubbles on two low → high axes (0–10), e.g. a strategic group map. */
export function ScatterMap({ scatter, xLabel, yLabel }: { scatter: ScatterSpec; xLabel?: string; yLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = Math.round(Math.min(420, Math.max(300, width * 0.68)));
  const x = scaleLinear().domain([0, 10]).range([M.left, width - M.right]);
  const y = scaleLinear().domain([0, 10]).range([height - M.bottom, M.top]);
  // Bubbles are ellipses sized in axis units on each axis, as drawn in the book.
  const xUnit = (width - M.left - M.right) / 10;
  const yUnit = (height - M.top - M.bottom) / 10;
  const small = width < 420;
  return (
    <div ref={ref}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={scatter.description}>
        <g className="axis">
          <line x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
          <line x1={M.left} x2={M.left} y1={y(0)} y2={y(10)} />
          <text x={M.left} y={y(0) + 16} textAnchor="start">{scatter.xTicks[0]}</text>
          <text x={width - M.right} y={y(0) + 16} textAnchor="end">{scatter.xTicks[1]}</text>
          <text x={M.left - 6} y={y(0)} dy="0.32em" textAnchor="end">{scatter.yTicks[0]}</text>
          <text x={M.left - 6} y={y(10)} dy="0.32em" textAnchor="end">{scatter.yTicks[1]}</text>
        </g>
        <text className="axis-label" x={(M.left + width - M.right) / 2} y={height - 8} textAnchor="middle">{xLabel}</text>
        <text className="axis-label" transform={`translate(12,${(M.top + height - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
        {scatter.points.map((pt) => {
          const lines = pt.label.split(', ');
          return (
            <g key={pt.label} className="bubble">
              <ellipse cx={x(pt.x)} cy={y(pt.y)} rx={Math.max(16, pt.r * xUnit)} ry={Math.max(14, pt.r * yUnit)} />
              <text className="label small" x={x(pt.x)} y={y(pt.y)} textAnchor="middle" fontSize={small ? 9 : 12}>
                {lines.map((l, i) => (
                  <tspan key={l} x={x(pt.x)} dy={i === 0 ? `${0.32 - (lines.length - 1) * 0.55}em` : '1.1em'}>{l}</tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
