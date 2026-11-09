import { Link } from 'react-router';
import { useClassScope } from '../content/context';
import { lessonName, moduleName } from '../content/model';
import { useTitle } from './useTitle';

export function ClassView() {
  const { outline } = useClassScope();
  const base = `/${outline.id}`;
  useTitle([`${outline.code}: ${outline.title}`]);

  return (
    <div className="page">
      <nav className="toc" aria-label="Modules">
        <p className="toc-label">Modules</p>
        <ol>
          {outline.modules.map((m) => (
            <li key={m.id}>
              <a href={`#m-${m.id}`}><span>Mod {m.id}</span>{m.title}</a>
            </li>
          ))}
        </ol>
        <p className="toc-label toc-gap">Class</p>
        <ol>
          <li><Link to={`${base}/glossary`}><span>A–Z</span>Glossary</Link></li>
          <li><Link to={`${base}/credits`}><span>©</span>Credits</Link></li>
        </ol>
      </nav>
      <main>
        <header className="intro">
          <p className="eyebrow">{outline.code}</p>
          <h1>{outline.title}</h1>
        </header>
        {outline.modules.map((m) => (
          <section key={m.id} id={`m-${m.id}`} className="chapter">
            <h2>{moduleName(m.id, m.title)}</h2>
            <ol className="lesson-list">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link to={`${base}/${m.id}/${l.id}`}>{lessonName(l.id, l.title)}</Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </main>
    </div>
  );
}
