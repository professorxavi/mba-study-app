import { useMemo } from 'react';
import { Outlet, useLoaderData } from 'react-router';
import { ClassContext } from '../content/context';
import { glossaryLookup } from '../content/model';
import type { ClassData } from '../router';

export function ClassLayout() {
  const { outline, glossary } = useLoaderData() as ClassData;
  const scope = useMemo(() => ({ outline, glossary, lookup: glossaryLookup(glossary.entries) }), [outline, glossary]);
  return (
    <ClassContext.Provider value={scope}>
      <Outlet />
    </ClassContext.Provider>
  );
}
