import { useEffect, useRef } from 'react';

// KaTeX and its stylesheet load the first time an equation is shown, so lessons without equations don't pay for them.
const loadKatex = () => Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => m.default);

export function Equation({ tex }: { tex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    loadKatex().then((katex) => {
      if (live && ref.current) katex.render(tex, ref.current, { displayMode: true, throwOnError: false });
    });
    return () => {
      live = false;
    };
  }, [tex]);
  // The TeX source stays as the text until KaTeX replaces it.
  return <div ref={ref} className="equation">{tex}</div>;
}
