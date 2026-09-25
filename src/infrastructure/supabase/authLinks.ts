/**
 * Reading what Supabase puts on the end of an auth redirect.
 *
 * Plain string handling with no native import, on purpose: the data layer
 * needs it for password recovery, and the data layer must still load in a
 * browser for the admin portal.
 *
 * The Google sign-in redirect is read with it too (`oauthFlow.ts`), so both
 * kinds of link are understood the same way.
 */

export type AuthLinkParams =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: string | null }
  | {
      kind: 'error';
      /** `error_code`, falling back to `error`: the most specific name there is. */
      code: string | null;
      /** The raw `error` parameter, e.g. `access_denied` or `server_error`. */
      error: string | null;
      /** The raw `error_code` parameter — Supabase's own code, when it sent one. */
      errorCode: string | null;
      description: string | null;
    }
  | { kind: 'none' };

/**
 * Supabase returns tokens in the fragment (#), not the query string, so they
 * never reach a server log. An error, though, can arrive in either — so both
 * are read, the fragment winning.
 */
export function readAuthLink(url: string): AuthLinkParams {
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  const params = new URLSearchParams(query);
  new URLSearchParams(fragment).forEach((value, key) => params.set(key, value));

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'tokens', accessToken, refreshToken, type: params.get('type') };
  }

  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    return {
      kind: 'error',
      code: params.get('error_code') ?? params.get('error'),
      error: params.get('error'),
      errorCode: params.get('error_code'),
      description: params.get('error_description'),
    };
  }

  return { kind: 'none' };
}
