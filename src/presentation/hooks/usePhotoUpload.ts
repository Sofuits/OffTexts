import { useCallback, useMemo, useState } from 'react';

import { useServices } from '@/app/di';
import type { Photo, PhotoId } from '@/domain/entities';
import {
  useAddPhoto,
  useMyPhotos,
  useRemovePhoto,
  useSetPhotoOrder,
} from '@/presentation/hooks/queries/usePhotos';

export type PhotoManager = {
  /** The member's photos in order, including ones still waiting on a moderator. */
  photos: Photo[];
  isLoading: boolean;
  /** Opens the library (or the camera), uploads what is chosen, and records it. */
  add: (source?: 'library' | 'camera') => Promise<void>;
  remove: (id: PhotoId) => Promise<void>;
  /** Moves a photo one place earlier (-1) or later (+1). */
  move: (id: PhotoId, by: -1 | 1) => Promise<void>;
  /** Makes a photo the first one, which is the avatar everywhere. */
  makeMain: (id: PhotoId) => Promise<void>;
  /** True while picking, uploading or deleting. */
  isBusy: boolean;
  /** The last failure, in words a member can act on. Cleared on the next attempt. */
  error: string | null;
  /** False where there is no camera roll — hide the control rather than fail on tap. */
  canPick: boolean;
  /** False where there is no camera. */
  canUseCamera: boolean;
};

/**
 * Everything the photo grid needs, in one hook.
 *
 * It exists because picking and storing are never useful apart, and because
 * both the onboarding step and the profile screen need exactly the same four
 * things. Written as a hook rather than a use case: one half is a native
 * module and the other is a repository call, and neither is a business rule.
 *
 * A cancelled pick does nothing at all — no error, no spinner, no message. The
 * member changed their mind, which is not a failure and must not look like one.
 */
export function usePhotoUpload(): PhotoManager {
  const { imagePicker } = useServices();
  const query = useMyPhotos();
  const addPhoto = useAddPhoto();
  const removePhoto = useRemovePhoto();
  const setOrder = useSetPhotoOrder();

  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const add = useCallback(
    async (source: 'library' | 'camera' = 'library'): Promise<void> => {
      setPickerError(null);
      setIsPicking(true);

      let picked: { uri: string } | null = null;
      try {
        picked =
          source === 'camera' ? await imagePicker.takePhoto() : await imagePicker.pickFromLibrary();
      } catch (caught) {
        // A refused permission arrives here carrying the sentence to show. Only
        // a message is taken from it — a native module's own wording is not fit
        // to put in front of a member.
        setPickerError(
          caught instanceof Error
            ? caught.message
            : 'That photo could not be added. Try another one.',
        );
        return;
      } finally {
        setIsPicking(false);
      }

      if (!picked) return;

      // `mutateAsync` rather than `mutate`, so the caller can await the whole
      // thing — the onboarding step needs to know when the grid will update.
      // The rejection is swallowed because the error is already in `error`;
      // letting it escape would produce an unhandled rejection warning for a
      // failure that has been handled.
      await addPhoto.mutateAsync(picked.uri).catch(() => undefined);
    },
    [imagePicker, addPhoto],
  );

  const remove = useCallback(
    async (id: PhotoId): Promise<void> => {
      setPickerError(null);
      await removePhoto.mutateAsync(id).catch(() => undefined);
    },
    [removePhoto],
  );

  const photos = useMemo(() => query.data ?? [], [query.data]);

  // Reordering sends the whole list, never a pair — see `setPhotoOrder`.
  const reorder = useCallback(
    async (ids: PhotoId[]): Promise<void> => {
      setPickerError(null);
      await setOrder.mutateAsync(ids).catch(() => undefined);
    },
    [setOrder],
  );

  const move = useCallback(
    async (id: PhotoId, by: -1 | 1): Promise<void> => {
      const ids = photos.map((photo) => photo.id);
      const from = ids.indexOf(id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to] as PhotoId, ids[from] as PhotoId];
      await reorder(ids);
    },
    [photos, reorder],
  );

  const makeMain = useCallback(
    async (id: PhotoId): Promise<void> => {
      const ids = photos.map((photo) => photo.id);
      if (ids[0] === id || !ids.includes(id)) return;
      await reorder([id, ...ids.filter((other) => other !== id)]);
    },
    [photos, reorder],
  );

  return {
    photos,
    isLoading: query.isPending,
    add,
    remove,
    move,
    makeMain,
    isBusy: isPicking || addPhoto.isPending || removePhoto.isPending || setOrder.isPending,
    error:
      pickerError ??
      addPhoto.error?.message ??
      removePhoto.error?.message ??
      setOrder.error?.message ??
      null,
    canPick: imagePicker.isAvailable,
    canUseCamera: imagePicker.canUseCamera,
  };
}
