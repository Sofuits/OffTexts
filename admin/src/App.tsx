import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Shell } from '@admin/components/Shell';
import { SessionProvider, useSession } from '@admin/lib/session';
import { Cafes, SafetyCases } from '@admin/pages/Pending';
import { Members } from '@admin/pages/Members';
import { Overview } from '@admin/pages/Overview';
import { Reservations } from '@admin/pages/Reservations';
import { Reviews } from '@admin/pages/Reviews';
import { SignIn } from '@admin/pages/SignIn';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Staff open a section, act, and come back. Data a minute old is fine;
      // refetching on every window focus is not, on a laptop with ten tabs.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Everything, or the sign-in screen.
 *
 * One gate, like the phone app's navigator: the routed sections do not exist in
 * the tree until the session is ready. That is why no page has to ask whether
 * it is allowed to render — if it is mounted, it is.
 */
function Gate(): React.JSX.Element {
  const { state } = useSession();

  if (state.status === 'loading') {
    return (
      <div className="signin">
        <p style={{ color: 'var(--c-text-secondary)' }}>Loading…</p>
      </div>
    );
  }

  if (state.status !== 'ready') return <SignIn />;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Overview />} />
        <Route path="members" element={<Members />} />
        <Route path="cafes" element={<Cafes />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="safety" element={<SafetyCases />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
