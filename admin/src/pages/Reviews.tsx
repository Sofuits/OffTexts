import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/domain/repositories';
import { Async, formatDate } from '@admin/components/Async';
import { useAdmin } from '@admin/lib/session';

/**
 * Reviews left after meets.
 *
 * Worth knowing what staff are looking at: reviews are private to the two
 * people who were at the meet — the member-facing policy only shows a review to
 * its participants. Staff see them all because moderation requires it, not
 * because they are public.
 */
export function Reviews(): React.JSX.Element {
  const { repositories } = useAdmin();

  const reviews = useQuery({
    queryKey: ['reviews'],
    queryFn: async () => unwrap(await repositories.admin.listReviews()),
  });

  return (
    <>
      <h1>Reviews</h1>
      <p className="lede">
        What members said after meeting. These are private between the two people involved — staff
        see them for moderation.
      </p>

      <Async
        query={reviews}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          title: 'No reviews yet',
          detail: 'A review can only be written after a meet has happened. None have.',
        }}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>Author</th>
                  <th>Comment</th>
                  <th>Meet</th>
                  <th>Written</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ review, meetScheduledFor }) => (
                  <tr key={review.id}>
                    <td className="num" aria-label={`${review.rating} out of 5`}>
                      {'★'.repeat(review.rating)}
                      <span style={{ color: 'var(--c-text-disabled)' }}>
                        {'★'.repeat(5 - review.rating)}
                      </span>
                    </td>
                    <td>{review.authorName}</td>
                    <td className="wrap">{review.comment}</td>
                    <td className="num">{formatDate(meetScheduledFor)}</td>
                    <td className="num">{formatDate(review.createdAt)}</td>
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
