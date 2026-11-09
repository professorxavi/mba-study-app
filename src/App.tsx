import { RouterProvider } from 'react-router';
import { missingConfig } from './data/firebase';
import { router } from './router';

/** Without Firebase config there is no content to load, so say exactly what's missing. */
function MissingConfig() {
  return (
    <div className="page single">
      <main>
        <header className="intro">
          <p className="eyebrow">Setup needed</p>
          <h1>Firebase isn't configured</h1>
          <p>Copy <code>.env.example</code> to <code>.env</code>, fill in these values from the Firebase console, and restart the dev server:</p>
          <ul>{missingConfig.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
        </header>
      </main>
    </div>
  );
}

export function App() {
  return missingConfig.length ? <MissingConfig /> : <RouterProvider router={router} />;
}
