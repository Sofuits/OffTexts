import type { Photo, PhotoId } from '@/domain/entities';
import type { Result } from './Result';

/**
 * A member's own photos.
 *
 * Separate from `ProfileRepository` because a photo is not a profile field. It
 * is a file in a bucket, a row with its own moderation state, and a position in
 * an order that can be changed — three operations the profile has no opinion
 * about. An earlier version had `uploadPhoto` on the profile repository, which
 * returned a URL and left the caller with nowhere to put it; that is how a
 * member could add a photo and watch it disappear.
 *
 * WHY THERE IS NO `listPhotosFor(someoneElse)`
 * The policy on `photos` admits only the owner. Everyone else sees approved
 * URLs through `Person.photoUrls`, which the database keeps in step by trigger.
 * That is not a filter somebody could forget to apply — a pending or rejected
 * photo is unreachable, not merely hidden.
 */
export interface PhotoRepository {
  /** The signed-in member's photos, in display order, including pending ones. */
  listMyPhotos(): Promise<Result<Photo[]>>;

  /**
   * Uploads a local file and records it.
   *
   * One call, because the two halves are useless apart: a file in the bucket
   * with no row is an orphan nobody will ever find, and a row pointing at
   * nothing is a broken image. It returns the photo rather than a URL so the
   * caller has an id to delete by.
   *
   * @param localUri A `file://` URI from the image picker.
   */
  addPhoto(localUri: string): Promise<Result<Photo>>;

  /** Removes the row and the file, and closes the gap in the order. */
  removePhoto(id: PhotoId): Promise<Result<void>>;

  /**
   * Reorders. The first id becomes photo one, which is the avatar.
   *
   * Every id must be given, not just the moved ones: the database numbers them
   * by position in this array, so a partial list would renumber some photos
   * into slots others still hold.
   */
  setPhotoOrder(ids: PhotoId[]): Promise<Result<void>>;
}
