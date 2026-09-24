import type { Photo, PhotoModeration } from '@/domain/entities';
import type { MyPhotoRow } from '@/infrastructure/supabase/rows';

/**
 * `api_v1.my_photos` rows into photos.
 *
 * Every column reads as nullable because it comes from a view — PostgREST
 * cannot prove otherwise — so each gets a fallback rather than an assertion.
 *
 * The moderation fallback is `pending` rather than `approved`, and that
 * direction is not arbitrary: a row whose state could not be read must be
 * treated as not yet checked. Guessing `approved` would put an unmoderated
 * photo in front of other members on the strength of a null.
 */

const toModeration = (value: string | null): PhotoModeration =>
  value === 'approved' || value === 'rejected' ? value : 'pending';

export function toPhoto(row: MyPhotoRow): Photo {
  return {
    id: row.id ?? '',
    url: row.url ?? '',
    storagePath: row.storage_path ?? '',
    sortOrder: row.sort_order ?? 1,
    moderation: toModeration(row.moderation ?? null),
    ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
    ...(row.width === null || row.width === undefined ? {} : { width: row.width }),
    ...(row.height === null || row.height === undefined ? {} : { height: row.height }),
  };
}
