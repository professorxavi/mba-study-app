import type { TableBlock } from '../content/types';
import { Rich } from './Inline';

export function DataTable({ table }: { table: TableBlock }) {
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className={table.highlight?.includes(i) ? 'hl' : undefined}>
                {row.map((cell, j) => (
                  <td key={j} className={table.numeric?.includes(j) ? 'n' : undefined}><Rich text={cell} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="table-note"><Rich text={table.note} /></p>}
    </>
  );
}
