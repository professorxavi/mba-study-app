import type { Chapter } from '../content/types';

export function Toc({ chapters }: { chapters: Chapter[] }) {
  return (
    <nav className="toc" aria-label="Chapters">
      <p className="toc-label">Contents</p>
      <ol>
        {chapters.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`}><span>{c.navLabel}</span>{c.navTitle}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
