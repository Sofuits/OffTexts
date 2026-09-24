import type { Venue } from '@/domain/entities';
import { attempt, type Result, type VenueRepository } from '@/domain/repositories';
import { toVenue } from '@/data/mappers/venueMapper';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * Partner cafés, from the published contract.
 *
 * `api_v1.venues` already filters to active cafés and folds the opening hours
 * in as an array, so this is one request rather than two and there is no
 * `status` check to forget. Reading `public.cafes` directly instead would mean
 * a second query for `cafe_hours` and a join done on the phone.
 *
 * The city filter is applied server-side. It looks like an optimisation and is
 * not: a member in Pune scrolling past cafés in Delhi is a worse screen, and
 * the list is short enough that the round trip is the only cost either way.
 */
export class SupabaseVenueRepository implements VenueRepository {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listVenues(city?: string): Promise<Result<Venue[]>> {
    return attempt(async () => {
      let builder = this.client.schema('api_v1').from('venues').select('*');

      if (city?.trim()) builder = builder.eq('city', city.trim());

      // By area, then name. Somebody choosing a café is choosing a part of town
      // first and a café second, and an alphabetical list scatters one
      // neighbourhood across the whole screen.
      const { data, error } = await builder
        .order('area', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []).map(toVenue);
    }, classifySupabaseError);
  }
}
