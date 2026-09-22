import React, { useState } from 'react';

import { useSession } from '@admin/lib/session';

/**
 * Staff sign-in.
 *
 * Email and password, through the same `SignIn` use case the phone app uses.
 * No Google here: staff accounts are created deliberately by someone with
 * database access, and an OAuth button would suggest anyone with a Google
 * account can get in.
 */
export function SignIn(): React.JSX.Element {
  const { state, container, signOut } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'misconfigured') {
    return (
      <div className="signin">
        <div className="state" style={{ maxWidth: 520 }}>
          <h3>Not configured</h3>
          <p className="error">{state.message}</p>
        </div>
      </div>
    );
  }

  if (state.status === 'checking') {
    return (
      <div className="signin">
        <p style={{ color: 'var(--c-text-secondary)' }}>Checking your access…</p>
      </div>
    );
  }

  // Signed in, but not on the staff table. Say so plainly rather than showing
  // empty sections — which is what the RLS policies would actually produce, and
  // which reads as a broken portal rather than a closed door.
  if (state.status === 'notStaff') {
    return (
      <div className="signin">
        <div className="state" style={{ maxWidth: 520 }}>
          <h3>This account isn’t staff</h3>
          <p>
            You’re signed in as <strong>{state.session.user.email}</strong>, but that account isn’t
            on the staff list, so there is nothing here to show you. Ask someone with database
            access to add you.
          </p>
          <p style={{ marginTop: 16 }}>
            <button type="button" className="ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!container) return;

    setError(null);
    setBusy(true);
    const result = await container.useCases.signIn.execute({ email, password });
    setBusy(false);

    if (!result.ok) setError(result.error.message);
    // On success the auth subscription re-renders this away. Nothing to do.
  };

  return (
    <div className="signin">
      <form onSubmit={onSubmit}>
        <div className="brand" style={{ marginBottom: 8 }}>
          Offtexts <span>Admin</span>
        </div>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {error ? (
          <p className="error" style={{ margin: 0, fontSize: 13.5 }}>
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
