/**
 * A photo on a member's profile.
 *
 * WHY THIS IS NOT JUST A STRING
 * `Person.photoUrls` is a list of URLs and that is all a viewer ever needs. The
 * owner needs more: which photo is which when they delete one, and whether a
 * moderator has looked at it yet. A pending photo is not in `photoUrls` at all
 * — the database keeps that array as a cache of the *approved* ones — so
 * without this type a member would upload a photo and watch it vanish.
 */

export type PhotoId = string;

/**
 * Where a photo is in moderation.
 *
 * Every photo starts `pending` and is invisible to everyone but its owner until
 * a person approves it. That is the whole point of ID-verified meetings: the
 * face on the card is checked before anybody agrees to sit opposite it.
 */
export type PhotoModeration = 'pending' | 'approved' | 'rejected';

export type Photo = {
  id: PhotoId;
  /** Public URL. Stable while the bucket is public; a signed URL if it stops being. */
  url: string;
  /** The object key. Needed to delete the file, and not derivable from the URL. */
  storagePath: string;
  /** 1-6. Photo 1 is the avatar everywhere in the app. */
  sortOrder: number;
  moderation: PhotoModeration;
  /** Set only when `moderation` is `rejected`. The database enforces that pairing. */
  rejectionReason?: string;
  width?: number;
  height?: number;
};

/** The most a member may have. Mirrors the CHECK on `photos.sort_order`. */
export const MAX_PHOTOS = 6;

/** The fewest a finished profile may have. Mirrors `complete_my_onboarding()`. */
export const MIN_PHOTOS = 2;

/**
 * Photos that count towards the minimum.
 *
 * Pending ones do: moderation happens after onboarding, and nobody should have
 * to wait on a moderator to finish. Rejected ones do not — they will never be
 * shown to anybody.
 */
export function usablePhotos(photos: Photo[]): Photo[] {
  return photos.filter((photo) => photo.moderation !== 'rejected');
}

/** What other members can actually see. */
export function approved(photos: Photo[]): Photo[] {
  return photos.filter((photo) => photo.moderation === 'approved');
}

/**
 * A short line about where the photos stand, or null when there is nothing to
 * say.
 *
 * In the domain rather than in a screen because the admin portal and the phone
 * should describe the same state the same way — and because "2 waiting" is a
 * rule about counts, not about layout.
 */
export function moderationSummary(photos: Photo[]): string | null {
  const pending = photos.filter((photo) => photo.moderation === 'pending').length;
  const rejected = photos.filter((photo) => photo.moderation === 'rejected').length;

  if (rejected > 0) {
    return rejected === 1
      ? 'One photo was not accepted. Tap it to see why.'
      : `${rejected} photos were not accepted. Tap one to see why.`;
  }

  if (pending > 0) {
    return pending === 1
      ? 'One photo is waiting on a moderator. Only you can see it until then.'
      : `${pending} photos are waiting on a moderator. Only you can see them until then.`;
  }

  return null;
}
