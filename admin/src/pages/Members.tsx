import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { unwrap, type MemberFilter } from '@/domain/repositories';
import type { PersonId, VerificationStatus } from '@/domain/entities';
import { MEET_INTENT_LABELS } from '@/domain/entities';
import { Async, formatDate, Pill } from '@admin/components/Async';
import { useAdmin } from '@admin/lib/session';

/**
 * Members, and who is in the discovery feed.
 *
 * "Add to the discovery feed" from the ticket is the Verify button. Discovery
 * is not a separate flag — `profiles: read own or verified` already hides
 * unverified members from everyone, so verification *is* the feed. A second
 * column would be a second source of truth for one question.
 */
export function Members(): React.JSX.Element {
  const { repositories } = useAdmin();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [verification, setVerification] = useState<VerificationStatus | ''>('');

  const filter: MemberFilter = {
    ...(search ? { search } : {}),
    ...(verification ? { verification } : {}),
  };

  const members = useQuery({
    queryKey: ['members', filter],
    queryFn: async () => unwrap(await repositories.admin.listMembers(filter)),
  });

  const setStatus = useMutation({
    mutationFn: async (input: { id: PersonId; status: VerificationStatus }) =>
      unwrap(await repositories.admin.setVerification(input.id, input.status)),
    // Refetch rather than patching the row in place: the filter above may mean
    // the member no longer belongs in the list they are looking at, and the
    // server is the one that decides that.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  return (
    <>
      <h1>Members</h1>
      <p className="lede">
        Everyone who has signed up. Verifying a member puts them in the discovery feed — until then
        no other member can see them at all.
      </p>

      <div className="row" style={{ marginBottom: 'var(--s-16)' }}>
        <input
          type="search"
          placeholder="Search name or city"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search members"
        />
        <select
          value={verification}
          onChange={(event) => setVerification(event.target.value as VerificationStatus | '')}
          aria-label="Filter by verification"
        >
          <option value="">Any status</option>
          <option value="unverified">Unverified</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {setStatus.isError ? <p className="error">{(setStatus.error as Error).message}</p> : null}

      <Async
        query={members}
        isEmpty={(page) => page.items.length === 0}
        empty={{
          title: 'No members match',
          detail:
            'Either nobody has signed up yet, or nothing here matches the search and filter above.',
        }}
      >
        {(page) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Age</th>
                  <th>Looking for</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Discovery feed</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map(({ person, joinedAt }) => (
                  <tr key={person.id}>
                    <td>
                      <strong>{person.name}</strong>
                    </td>
                    <td>{person.city}</td>
                    <td className="num">{person.age ?? '—'}</td>
                    <td>
                      {person.intents.length
                        ? person.intents.map((intent) => MEET_INTENT_LABELS[intent]).join(', ')
                        : '—'}
                    </td>
                    <td>
                      <Pill value={person.verification} />
                    </td>
                    <td className="num">{formatDate(joinedAt)}</td>
                    <td>
                      {person.verification === 'verified' ? (
                        <button
                          type="button"
                          className="ghost"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: person.id, status: 'unverified' })}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: person.id, status: 'verified' })}
                        >
                          Add
                        </button>
                      )}
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
