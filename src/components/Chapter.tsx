import type { Chapter as ChapterData } from '../content/types';
import { Block } from './Block';

export function Chapter({ chapter }: { chapter: ChapterData }) {
  return (
    <section className="chapter" id={chapter.id}>
      <p className="chapter-num">{chapter.label}</p>
      <h2>{chapter.title}</h2>
      <p className="source-tag">{chapter.sourceTag}</p>
      {chapter.sections.map((s) => (
        <div key={s.id} id={s.id} className="section">
          {s.title && (
            <h3>
              {s.sec && <span className="sec">{s.sec}</span>}
              {s.title}
              {s.aside && <> <span className="sec">{s.aside}</span></>}
            </h3>
          )}
          {s.blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      ))}
    </section>
  );
}
