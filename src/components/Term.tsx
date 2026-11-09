import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useClassScope } from '../content/context';
import type { Rich as RichText } from '../content/types';
import { Rich } from './Inline';

const EDGE = 8;

/** A glossary term: hover, focus, or tap shows its definition with a link to the glossary entry. */
export function Term({ text }: { text: RichText }) {
  const { outline, lookup } = useClassScope();
  const entry = lookup(text);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shift, setShift] = useState(0);

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the popover inside the viewport on narrow screens.
  useLayoutEffect(() => {
    if (!open || !pop.current) return setShift(0);
    const { left, right } = pop.current.getBoundingClientRect();
    const max = document.documentElement.clientWidth - EDGE;
    setShift(right > max ? max - right : left < EDGE ? EDGE - left : 0);
  }, [open]);

  if (!entry) return <span className="term"><Rich text={text} /></span>;

  return (
    <span
      ref={wrap}
      className="term-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <button
        type="button"
        className="term"
        aria-expanded={open}
        aria-controls={id}
        onFocus={() => setOpen(true)}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        <Rich text={text} />
      </button>
      {open && (
        <span ref={pop} id={id} className="term-pop" role="group" aria-label={entry.term} style={{ transform: `translateX(${shift}px)` }}>
          <span className="term-pop-title">{entry.term}</span>
          <Rich text={entry.definition} />
          <Link className="term-pop-link" to={`/${outline.id}/glossary/${entry.id}`}>Glossary →</Link>
        </span>
      )}
    </span>
  );
}
