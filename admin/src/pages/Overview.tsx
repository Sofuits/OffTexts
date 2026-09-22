import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/domain/repositories';
import { Async } from '@admin/components/Async';
import { useAdmin } from '@admin/lib/session';

/** Headline numbers, so the first screen says something rather than nothing. */
export function Overview(): React.JSX.Element {
  const { repositories } = useAdmin();

  const counts = useQuery({
    queryKey: ['counts'],
    queryFn: async () => unwrap(await repositories.admin.getCounts()),
  });

  return (
    <>
      <h1>Overview</h1>
      <p className="lede">Offtexts, as it stands right now.</p>

      <Async query={counts} empty={{ title: 'Nothing yet', detail: 'The database is empty.' }}>
        {(data) => (
          <div className="tiles">
            <div className="card tile">
              <b className="num">{data.members}</b>
              <span>Members</span>
            </div>
            <div className="card tile">
              <b className="num">{data.verifiedMembers}</b>
              <span>In the discovery feed</span>
            </div>
            <div className="card tile">
              <b className="num">{data.reservations}</b>
              <span>Reservations</span>
            </div>
            <div className="card tile">
              <b className="num">{data.reviews}</b>
              <span>Reviews</span>
            </div>
          </div>
        )}
      </Async>

      <h2>What’s here, and what isn’t</h2>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
          Members, reservations and reviews read live from the database. Cafés and safety cases have
          no tables yet — those sections explain what they need rather than showing invented data.
        </p>
      </div>
    </>
  );
}
