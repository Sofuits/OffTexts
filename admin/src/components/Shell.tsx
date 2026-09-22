import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useSession } from '@admin/lib/session';

/**
 * The responsive frame every section sits in.
 *
 * One navigation element, not two. A phone gets a horizontally scrollable strip
 * and a laptop gets a sidebar, from the same markup and the same `NavLink`s —
 * so there is no hidden drawer whose open state can disagree with the visible
 * menu, and no second list to forget when a section is added.
 */

const SECTIONS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/members', label: 'Members' },
  { to: '/cafes', label: 'Cafés' },
  { to: '/reservations', label: 'Reservations' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/safety', label: 'Safety cases' },
];

export function Shell(): React.JSX.Element {
  const { state, signOut } = useSession();
  const email = state.status === 'ready' ? state.session.user.email : undefined;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Offtexts <span>Admin</span>
        </div>

        <nav className="nav" aria-label="Sections">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end ?? false}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {section.label}
            </NavLink>
          ))}
        </nav>

        <div className="who">
          <div>{email}</div>
          <button
            type="button"
            className="ghost"
            style={{ marginTop: 8 }}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
