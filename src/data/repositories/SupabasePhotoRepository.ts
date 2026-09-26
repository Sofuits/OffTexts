import type { Photo, PhotoId } from '@/domain/entities';
import { AppError, attempt, type PhotoRepository, type Result } from '@/domain/repositories';
import { toPhoto } from '@/data/mappers/photoMapper';
import { processProfilePhoto } from '@/infrastructure/media';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';
import { MAX_PROFILE_PHOTOS, MAX_FILE_SIZE } from '@/shared/utils';

/** The bucket created in migration 0001. Public, 5 MB, images only. */
const BUCKET = 'profile-photos';

/**
 * Photos on Supabase: storage plus a row, kept in step.
 *
 * READS go through `api_v1.my_photos`. WRITES go to `public.photos` directly,
 * because a view is not insertable and the "photos: write own" policy is what
 * permits it — with `member_id` pinned in its WITH CHECK, so this cannot file a
 * photo under somebody else's profile even if the client tried.
 *
 * THE ORDER OF THE TWO HALVES MATTERS. On add, the file goes up first and the
 * row second: a failed insert leaves an orphaned object, which costs a few
 * kilobytes and is invisible, whereas a row written first and an upload that
 * then failed would put a broken image on a profile. On remove it is the other
 * way round for the same reason — the row goes first, so a member never sees a
 * photo that no longer has a file behind it.
 */
export class SupabasePhotoRepository implements PhotoRepository {
  constructor(private readonly client: TypedSupabaseClient) {}

  private async requireUserId(): Promise<string> {
    const { data } = await this.client.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new AppError('unauthenticated', 'You are not signed in.');
    return id;
  }

  async listMyPhotos(): Promise<Result<Photo[]>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .schema('api_v1')
        .from('my_photos')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const rows = await Promise.all(
        (data ?? []).map(async (row) => {
          const url = row.storage_path
            ? await this.client.storage
                .from(BUCKET)
                .createSignedUrl(row.storage_path, 60 * 60)
                .then((result) => result.data?.signedUrl ?? row.url ?? '')
            : row.url ?? '';

          return { ...row, url };
        }),
      );

      return rows.map(toPhoto);
    }, classifySupabaseError);
  }

  async addPhoto(localUri: string): Promise<Result<Photo>> {
    return attempt(async () => {
      const userId = await this.requireUserId();

      const { data: existing, error: readError } = await this.client
        .from('photos')
        .select('sort_order')
        .eq('member_id', userId)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (readError) throw readError;

      const highest = existing?.[0]?.sort_order ?? 0;
      if (highest >= MAX_PROFILE_PHOTOS) {
        throw new AppError(
          'validation',
          `You can have ${MAX_PROFILE_PHOTOS} photos. Remove one to add another.`,
          { field: 'photos' },
        );
      }

      const processed = await processProfilePhoto(localUri);
      if (processed.fileSize > MAX_FILE_SIZE) {
        throw new AppError('validation', 'Image is too large. Please choose an image under 10 MB.');
      }

      const blob = await fetch(processed.uri).then((response) => response.blob());
      const extension = 'jpg';
      const storagePath = `${userId}/profile/${Date.now()}.${extension}`;

      const { error: uploadError } = await this.client.storage.from(BUCKET).upload(storagePath, blob, {
        contentType: processed.mimeType,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: signedUrl } = await this.client.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60 * 60);

      const { data, error } = await this.client
        .from('photos')
        .insert({
          member_id: userId,
          storage_path: storagePath,
          url: signedUrl?.signedUrl ?? '',
          sort_order: highest + 1,
          bytes: processed.fileSize,
          width: processed.width,
          height: processed.height,
        })
        .select('*')
        .single();

      if (error) {
        await this.client.storage.from(BUCKET).remove([storagePath]);
        throw error;
      }

      return {
        id: data.id,
        url: data.url,
        storagePath: data.storage_path,
        sortOrder: data.sort_order,
        moderation: 'pending' as const,
        width: processed.width,
        height: processed.height,
      };
    }, classifySupabaseError);
  }

  async removePhoto(id: PhotoId): Promise<Result<void>> {
    return attempt(async () => {
      const userId = await this.requireUserId();

      const { data: row, error: readError } = await this.client
        .from('photos')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();

      if (readError) throw readError;
      if (!row) throw new AppError('notFound', 'That photo is already gone.');

      const { error, count } = await this.client
        .from('photos')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) throw error;

      // A DELETE that RLS forbids does not fail — it matches nothing and
      // reports success. Without this the photo would appear to vanish and
      // come back on the next refresh.
      if (count === 0) {
        throw new AppError('forbidden', 'That photo could not be removed.');
      }

      await this.client.storage.from(BUCKET).remove([row.storage_path]);

      // Close the gap. `sort_order` only has to be unique per member, so a gap
      // is legal in the database — but the UI fills the next empty slot, and a
      // hole at position two would leave it filling position four.
      const { data: remaining, error: remainingError } = await this.client
        .from('photos')
        .select('id')
        .eq('member_id', userId)
        .order('sort_order', { ascending: true });

      if (remainingError) throw remainingError;

      if (remaining && remaining.length > 0) {
        const { error: orderError } = await this.client
          .schema('api_v1')
          .rpc('set_photo_order', { p_ids: remaining.map((photo) => photo.id) });
        if (orderError) throw orderError;
      }
    }, classifySupabaseError);
  }

  async setPhotoOrder(ids: PhotoId[]): Promise<Result<void>> {
    return attempt(async () => {
      if (ids.length === 0) {
        throw new AppError('validation', 'There is nothing to reorder.');
      }

      // An RPC rather than six updates. Reordering swaps positions, and a swap
      // passes through a state where two rows hold the same number — legal only
      // inside one transaction, because the uniqueness constraint is DEFERRABLE.
      const { error } = await this.client.schema('api_v1').rpc('set_photo_order', { p_ids: ids });

      if (error) throw error;
    }, classifySupabaseError);
  }
}
