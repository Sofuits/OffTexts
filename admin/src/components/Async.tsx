import React from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * Loading, error and empty, in one place.
 *
 * The same job `QueryBoundary` does in the phone app, and written separately
 * for the same reason the styling is: this renders HTML, that renders React
 * Native. What is shared between the two is the shape of the problem, not the
 * markup.
 *
 * An empty section says what would put something in it. "No members yet" is a
 * dead end; "no members have signed up yet" tells the reader the screen is
 * working and the database is simply empty.
 */
export function Async<T>({
  query,
  empty,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T, Error>;
  /** What to say when the request succeeded and returned nothing. */
  empty: { title: string; detail: string };
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}): React.JSX.Element {
  if (query.isPending) {
    return (
      <div className="state">
        <p>Loading…</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="state">
        <h3>That didn’t load</h3>
        <p className="error">{query.error.message}</p>
        <p style={{ marginTop: 12 }}>
          <button type="button" className="ghost" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  const data = query.data as T;

  if (isEmpty?.(data)) {
    return (
      <div className="state">
        <h3>{empty.title}</h3>
        <p>{empty.detail}</p>
      </div>
    );
  }

  return <>{children(data)}</>;
}

/** A status word as a coloured pill. The class carries the colour; see styles.css. */
export function Pill({ value }: { value: string }): React.JSX.Element {
  return <span className={`pill ${value}`}>{value.replace(/_/g, ' ')}</span>;
}

/** Dates, formatted one way everywhere. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
