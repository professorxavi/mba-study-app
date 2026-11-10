import type { ShareSpec } from '../content/types';

/** 100% stacked horizontal bars, one per row, built in HTML so labels wrap and the bars fit any width. */
export function ShareBars({ share }: { share: ShareSpec }) {
  const unit = share.unit ?? '';
  return (
    <div className="share" role="img" aria-label={share.description}>
      <div className="chart-legend" aria-hidden="true">
        {share.parts.map((p, i) => <span key={p} className={`series-${i + 1} block`}>{p}</span>)}
      </div>
      <div className="share-rows" aria-hidden="true">
        {share.bars.map((bar) => {
          const total = bar.values.reduce((a, b) => a + b, 0) || 1;
          return (
            <div key={bar.label} className="share-row">
              <span className="share-label">{bar.label}</span>
              <span className="share-bar">
                {bar.values.map((v, i) => (
                  <span key={i} className={`share-seg series-${i + 1}`} style={{ width: `${(v / total) * 100}%` }} title={`${share.parts[i]}: ${v}${unit}`}>
                    {/* Values sit inside segments wide enough to hold them; the title carries the rest. */}
                    {v / total >= 0.08 && <span className="share-value">{v}{unit}</span>}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
