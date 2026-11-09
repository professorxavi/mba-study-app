import type { Inline, Rich as RichText } from '../content/types';
import { Term } from './Term';

function Piece({ piece }: { piece: Inline }) {
  if (typeof piece === 'string') return <>{piece}</>;
  const [kind, value] = Object.entries(piece)[0] as [string, RichText];
  if (kind === 'term') return <Term text={value} />;
  const inner = <Rich text={value} />;
  switch (kind) {
    case 'strong': return <strong>{inner}</strong>;
    case 'em': return <em>{inner}</em>;
    default: return <span className={kind}>{inner}</span>;
  }
}

export function Rich({ text }: { text: RichText }) {
  if (typeof text === 'string') return <>{text}</>;
  return <>{text.map((piece, i) => <Piece key={i} piece={piece} />)}</>;
}
