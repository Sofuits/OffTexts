import { AppError } from '@/domain/repositories';
import {
  classifySupabaseError,
  reportRawSupabaseErrors,
  type RawSupabaseError,
} from '@/infrastructure/supabase/supabaseErrors';

/** Exactly what PostgREST returned for a read of api_v1 before it was exposed. */
const SCHEMA_NOT_EXPOSED = {
  code: 'PGRST106',
  details: null,
  hint: 'Only the following schemas are exposed: public, graphql_public',
  message: 'Invalid schema: api_v1',
};

const NOT_IN_SCHEMA_CACHE = {
  code: 'PGRST205',
  details: null,
  hint: null,
  message: "Could not find the table 'api_v1.candidates_today' in the schema cache",
};

afterEach(() => reportRawSupabaseErrors(null));

describe('classifySupabaseError', () => {
  it.each([
    ['PGRST106, schema not exposed', SCHEMA_NOT_EXPOSED],
    ['PGRST205, not in the schema cache', NOT_IN_SCHEMA_CACHE],
  ])('treats %s as the server not being wired up', (_name, raw) => {
    const error = classifySupabaseError(raw);

    // Not the member's fault, and a retry after the fix succeeds — so the
    // Retry button is offered.
    expect(error.kind).toBe('server');
    expect(error.isRetryable).toBe(true);
    // The generic line, not the database's: that names schemas and tables.
    expect(error.message).not.toContain('api_v1');
    expect(error.cause).toBe(raw);
  });

  it('does not tell the member to try again when there is nothing to tap', () => {
    const error = classifySupabaseError({ code: 'XX999', message: 'something new' });

    expect(error.kind).toBe('unknown');
    // No Retry button is rendered for an unknown error…
    expect(error.isRetryable).toBe(false);
    // …so the copy must not ask for one.
    expect(error.message).not.toMatch(/try again/i);
  });

  it('reports nothing unless a reporter is registered, which production never does', () => {
    const reporter = jest.fn();
    reportRawSupabaseErrors(reporter);
    reportRawSupabaseErrors(null);

    classifySupabaseError(SCHEMA_NOT_EXPOSED);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('hands the raw error to the dev reporter before replacing it', () => {
    const seen: RawSupabaseError[] = [];
    reportRawSupabaseErrors((raw) => seen.push(raw));

    const error = classifySupabaseError(SCHEMA_NOT_EXPOSED);

    expect(seen).toEqual([
      {
        kind: 'server',
        code: 'PGRST106',
        message: 'Invalid schema: api_v1',
        details: null,
        hint: 'Only the following schemas are exposed: public, graphql_public',
        status: undefined,
      },
    ]);
    // Reporting changes nothing about what the member is shown.
    expect(error.message).not.toContain('api_v1');
  });

  it('survives a reporter that throws', () => {
    reportRawSupabaseErrors(() => {
      throw new Error('logger broke');
    });

    expect(classifySupabaseError(SCHEMA_NOT_EXPOSED).kind).toBe('server');
  });

  it('passes an AppError through untouched and unreported', () => {
    const reporter = jest.fn();
    reportRawSupabaseErrors(reporter);
    const original = new AppError('forbidden', 'No.');

    expect(classifySupabaseError(original)).toBe(original);
    expect(reporter).not.toHaveBeenCalled();
  });
});
