import type { Block as BlockData, ListBlock } from '../content/types';
import { ChartFigure } from '../charts/ChartFigure';
import { DataTable } from './DataTable';
import { Equation } from './Equation';
import { Rich } from './Inline';

function List({ list }: { list: ListBlock }) {
  const items = list.items.map((item, i) =>
    typeof item === 'string' || Array.isArray(item) ? (
      <li key={i}><Rich text={item} /></li>
    ) : (
      <li key={i}><Rich text={item.text} /><List list={item.sub} /></li>
    ),
  );
  return list.ordered ? <ol start={list.start}>{items}</ol> : <ul>{items}</ul>;
}

export function Block({ block }: { block: BlockData }) {
  switch (block.type) {
    case 'p':
      return <p><Rich text={block.text} /></p>;
    case 'list':
      return <List list={block} />;
    case 'example':
      return (
        <div className="example">
          <p className="example-label">{block.label}</p>
          {block.blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      );
    case 'table':
      return <DataTable table={block} />;
    case 'quote':
      return (
        <blockquote>
          <Rich text={block.text} />
          {block.cite && <> {block.cite}</>}
        </blockquote>
      );
    case 'chart':
      return <ChartFigure ids={block.charts} caption={block.caption} />;
    case 'h':
      return <h4><Rich text={block.text} /></h4>;
    case 'figure':
      return (
        <figure className="figure-note">
          <figcaption><span className="figure-label">{block.label}</span> <Rich text={block.caption} /></figcaption>
        </figure>
      );
    case 'box':
      return (
        <aside className="example box">
          <p className="example-label">{block.label}</p>
          {block.blocks.map((b, i) => <Block key={i} block={b} />)}
        </aside>
      );
    case 'equation':
      return <Equation tex={block.tex} />;
  }
}
