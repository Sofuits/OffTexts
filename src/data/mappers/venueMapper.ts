import type { OpeningHours, Venue } from '@/domain/entities';
import type { VenueRow } from '@/infrastructure/supabase/rows';

/**
 * `api_v1.venues` rows into venues.
 *
 * Two things make this less trivial than it looks.
 *
 * First, every column is typed nullable — PostgREST reports a view that way
 * regardless of the underlying table, because it cannot prove otherwise. A
 * café with no name cannot exist, but the type says it can, so each field gets
 * a fallback rather than a non-null assertion.
 *
 * Second, `hours` is `jsonb` and therefore `Json` — genuinely unknown at
 * compile time. It is aggregated in the view, so it is an array of objects in
 * practice, but the only honest way to read it is to check. `toHours` drops
 * anything that does not have the three fields rather than letting an
 * `undefined` weekday reach `startTimesOn` and quietly produce no slots.
 */

function toHours(value: unknown): OpeningHours[] {
  if (!Array.isArray(value)) return [];

  const hours: OpeningHours[] = [];

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const weekday = record.weekday;
    const opensAt = record.opens_at;
    const closesAt = record.closes_at;

    if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) continue;
    if (typeof opensAt !== 'string' || typeof closesAt !== 'string') continue;

    hours.push({ weekday, opensAt, closesAt });
  }

  return hours;
}

export function toVenue(row: VenueRow): Venue {
  return {
    id: row.id ?? '',
    name: row.name ?? 'Café',
    slug: row.slug ?? '',
    addressLine: row.address_line ?? '',
    area: row.area ?? '',
    city: row.city ?? '',
    ...(row.latitude === null || row.latitude === undefined ? {} : { latitude: row.latitude }),
    ...(row.longitude === null || row.longitude === undefined ? {} : { longitude: row.longitude }),
    ...(row.maps_url ? { mapsUrl: row.maps_url } : {}),
    // One, not zero. A capacity of zero would read as "never bookable", which
    // is a stronger claim than "the column was null".
    concurrentCapacity: row.concurrent_meet_capacity ?? 1,
    hours: toHours(row.hours),
  };
}
