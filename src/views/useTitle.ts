import { useEffect } from 'react';

/** Sets the browser tab title for the current page; null leaves it to a child component. */
export function useTitle(parts: (string | undefined)[] | null) {
  const title = parts && [...parts.filter(Boolean), 'Study Notes'].join(' · ');
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
