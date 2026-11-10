import type { MatrixSpec } from '../content/types';

/** A 2×2 framework grid with optional axis labels and a label over its center. Built in HTML so cell text wraps. */
export function MatrixChart({ matrix, xLabel, yLabel }: { matrix: MatrixSpec; xLabel?: string; yLabel?: string }) {
  const axes = !!(matrix.xTicks || matrix.yTicks);
  return (
    <div className={`matrix${axes ? ' with-axes' : ''}`} role="img" aria-label={matrix.description}>
      {yLabel && <span className="matrix-ylabel" aria-hidden="true">{yLabel}</span>}
      {matrix.yTicks && (
        <span className="matrix-yticks" aria-hidden="true">
          <span>{matrix.yTicks[1]}</span>
          <span>{matrix.yTicks[0]}</span>
        </span>
      )}
      <div className={`matrix-grid${matrix.center ? ' has-center' : ''}`} aria-hidden="true">
        {matrix.cells.flat().map((c, i) => (
          <div key={i} className={`matrix-cell${c.tone ? ' ' + c.tone : ''}`}>{c.text}</div>
        ))}
        {matrix.center && <div className="matrix-center">{matrix.center}</div>}
      </div>
      {matrix.xTicks && (
        <span className="matrix-xticks" aria-hidden="true">
          <span>{matrix.xTicks[0]}</span>
          <span>{matrix.xTicks[1]}</span>
        </span>
      )}
      {xLabel && <span className="matrix-xlabel" aria-hidden="true">{xLabel}</span>}
    </div>
  );
}
