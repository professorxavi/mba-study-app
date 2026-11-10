import { useLessonScope } from '../content/context';
import type { ChartSpec, Provenance, Rich as RichText } from '../content/types';
import { Rich } from '../components/Inline';
import { CircularFlow } from './CircularFlow';
import { InteractiveChart } from './InteractiveChart';
import { MatrixChart } from './MatrixChart';
import { ScatterMap } from './ScatterMap';
import { ShareBars } from './ShareBars';
import { XYChart } from './XYChart';

const PROVENANCE: Record<Provenance, string> = {
  text: 'values stated in the text',
  derived: 'values computed from the text',
  'read-from-image': 'some values read from the figure image',
};

function provenanceLine(spec: ChartSpec): string {
  const note = spec.provenanceNote ? ` (${spec.provenanceNote})` : '';
  return `${spec.figure} · ${PROVENANCE[spec.provenance]}${note}`;
}

export function ChartFigure({ ids, caption }: { ids: string[]; caption: RichText }) {
  const { chart } = useLessonScope();
  const specs = ids.map(chart).filter((s): s is ChartSpec => !!s);
  // Panels that share a source (e.g. Figure 3.2e left/right) get one provenance line.
  const lines = [...new Set(specs.map(provenanceLine).map((l) => l.replace(/ \((left|right)\)/, '')))];
  return (
    <figure className="chart">
      <div className={specs.length > 1 ? 'chart-row' : undefined}>
        {specs.map((spec) => (
          <div key={spec.id}>
            <p className="chart-title">{spec.title}</p>
            <ChartBody spec={spec} />
          </div>
        ))}
      </div>
      <figcaption>
        <Rich text={caption} />
        {lines.map((l) => <span key={l} className="provenance">Rebuilt from {l}</span>)}
      </figcaption>
    </figure>
  );
}

function ChartBody({ spec }: { spec: ChartSpec }) {
  if (spec.kind === 'circular-flow' && spec.flow) return <CircularFlow flow={spec.flow} />;
  if (spec.kind === 'share' && spec.share) return <ShareBars share={spec.share} />;
  if (spec.kind === 'scatter' && spec.scatter) return <ScatterMap scatter={spec.scatter} xLabel={spec.xLabel} yLabel={spec.yLabel} />;
  if (spec.kind === 'matrix' && spec.matrix) return <MatrixChart matrix={spec.matrix} xLabel={spec.xLabel} yLabel={spec.yLabel} />;
  return spec.interactive ? <InteractiveChart spec={spec} /> : <XYChart spec={spec} />;
}
