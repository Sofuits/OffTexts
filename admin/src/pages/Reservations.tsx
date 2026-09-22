import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/domain/repositories';
import { Async, formatDateTime, Pill } from '@admin/components/Async';
import { useAdmin } from '@admin/lib/session';

/** Every booked meet, newest first. */
export function Reservations(): React.JSX.Element {
  const { repositories } = useAdmin();

  const reservations = useQuery({
    queryKey: ['reservations'],
    queryFn: async () => unwrap(await repositories.admin.listReservations()),
  });

  return (
    <>
      <h1>Reservations</h1>
      <p className="lede">
        Every meet that has been booked, with both members and the venue. Venue is free text today —
        it becomes a link to a café once that table exists.
      </p>

      <Async
        query={reservations}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          title: 'No reservations yet',
          detail:
            'A reservation appears when one member requests a meet with another. Nobody has done that yet.',
        }}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Requested by</th>
                  <th>With</th>
                  <th>Venue</th>
                  <th>Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num">{formatDateTime(row.scheduledFor)}</td>
                    <td>{row.requesterName}</td>
                    <td>{row.recipientName}</td>
                    <td>{row.venueName}</td>
                    <td>{row.venueArea || '—'}</td>
                    <td>
                      <Pill value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </>
  );
}
