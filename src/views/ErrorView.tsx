import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { useTitle } from './useTitle';

export function ErrorView() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  useTitle([notFound ? 'Not found' : 'Error']);
  if (!notFound) console.error(error);
  return (
    <div className="page single">
      <main>
        <header className="intro">
          <p className="eyebrow">{notFound ? 'Not found' : 'Something went wrong'}</p>
          <h1>{notFound ? "That page doesn't exist" : "This page couldn't be loaded"}</h1>
          <p className="muted">
            {notFound
              ? 'The class, lesson or page in this link was not found.'
              : 'Check your connection and reload. Pages you have opened before also work offline.'}
          </p>
          <p><Link to="/">Back to all classes</Link></p>
        </header>
      </main>
    </div>
  );
}
