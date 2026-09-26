import type { Venue } from '@/domain/entities';
import type { Result } from './Result';

/**
 * Partner cafés a meeting can be booked at.
 *
 * Read-only from the app, and it must stay that way. A member cannot add a
 * café, change its hours or mark it closed — those are staff actions, done in
 * the admin portal, and the RLS policies on `cafes` refuse them from an
 * authenticated caller. An interface with a `save` on it would be an invitation
 * to write code that gets a 403 on a real device.
 *
 * Only active cafés are ever returned: `api_v1.venues` filters on status, so
 * "is this bookable" is answered by the row existing rather than by a flag
 * every caller would have to remember to check.
 */
export interface VenueRepository {
  /**
   * Bookable cafés, optionally narrowed to one city.
   *
   * The city filter is the common case and not an optimisation — showing
   * somebody in Pune a café in Delhi is worse than showing them nothing.
   */
  listVenues(city?: string): Promise<Result<Venue[]>>;
}
