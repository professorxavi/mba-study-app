import { useLessonScope } from '../content/context';
import type { ChartSpec, Provenance, Rich as RichText } from '../content/types';
import { Rich } from '../components/Inline';
import { CircularFlow } from './CircularFlow';
import { InteractiveChart } from './InteractiveChart';
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
            {spec.kind === 'circular-flow' && spec.flow ? <CircularFlow flow={spec.flow} /> : spec.interactive ? <InteractiveChart spec={spec} /> : <XYChart spec={spec} />}
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
