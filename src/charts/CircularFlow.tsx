import type { FlowSpec } from '../content/types';

/** Two actors trading around an outer and an inner loop (e.g. a product market and a labor market). */
export function CircularFlow({ flow }: { flow: FlowSpec }) {
  const [outerTop, outerBottom] = flow.outer;
  const [innerTop, innerBottom] = flow.inner;
  return (
    <div>
      <svg className="flow" viewBox="40 0 480 345" role="img" aria-label={flow.description}>
        <defs>
          {(['goods', 'money'] as const).map((k) => (
            <marker key={k} id={`head-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path className={`head-${k}`} d="M0,0L10,5L0,10z" />
            </marker>
          ))}
        </defs>

        {/* Outer loop */}
        <path className={`arc ${outerTop.kind}`} d="M460,150 A180,120 0 0 0 100,150" markerEnd={`url(#head-${outerTop.kind})`} />
        <path className={`arc ${outerBottom.kind}`} d="M100,190 A180,120 0 0 0 460,190" markerEnd={`url(#head-${outerBottom.kind})`} />
        {/* Inner loop */}
        <path className={`arc ${innerTop.kind}`} d="M410,150 A130,80 0 0 0 150,150" markerEnd={`url(#head-${innerTop.kind})`} />
        <path className={`arc ${innerBottom.kind}`} d="M150,190 A130,80 0 0 0 410,190" markerEnd={`url(#head-${innerBottom.kind})`} />

        {([[outerTop, 20], [innerTop, 118], [innerBottom, 248], [outerBottom, 334]] as const).map(([arc, y]) => (
          <text key={arc.key} className="arc-label" x="280" y={y} textAnchor="middle"><tspan className="key">{arc.key}</tspan> {arc.label}</text>
        ))}

        <g className="node">
          <rect x="60" y="150" width="120" height="40" rx="6" />
          <text x="120" y="170" dy="0.35em" textAnchor="middle">{flow.left}</text>
        </g>
        <g className="node">
          <rect x="380" y="150" width="120" height="40" rx="6" />
          <text x="440" y="170" dy="0.35em" textAnchor="middle">{flow.right}</text>
        </g>
      </svg>
      <div className="flow-legend">
        <span className="goods">{flow.legend.goods}</span>
        <span className="money">{flow.legend.money}</span>
      </div>
    </div>
  );
}
