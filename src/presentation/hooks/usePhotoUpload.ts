import { useCallback, useState } from 'react';

import { useServices } from '@/app/di';
import type { Photo, PhotoId } from '@/domain/entities';
import { useAddPhoto, useMyPhotos, useRemovePhoto } from '@/presentation/hooks/queries/usePhotos';

export type PhotoManager = {
  /** The member's photos in order, including ones still waiting on a moderator. */
  photos: Photo[];
  isLoading: boolean;
  /** Opens the library, uploads what is chosen, and records it. */
  add: () => Promise<void>;
  remove: (id: PhotoId) => Promise<void>;
  /** True while picking, uploading or deleting. */
  isBusy: boolean;
  /** The last failure, in words a member can act on. Cleared on the next attempt. */
  error: string | null;
  /** False where there is no camera roll — hide the control rather than fail on tap. */
  canPick: boolean;
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

  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const add = useCallback(async (): Promise<void> => {
    setPickerError(null);
    setIsPicking(true);

    let picked: { uri: string } | null = null;
    try {
      picked = await imagePicker.pickFromLibrary();
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
  }, [imagePicker, addPhoto]);

  const remove = useCallback(
    async (id: PhotoId): Promise<void> => {
      setPickerError(null);
      await removePhoto.mutateAsync(id).catch(() => undefined);
    },
    [removePhoto],
  );

  return {
    photos: query.data ?? [],
    isLoading: query.isPending,
    add,
    remove,
    isBusy: isPicking || addPhoto.isPending || removePhoto.isPending,
    error: pickerError ?? addPhoto.error?.message ?? removePhoto.error?.message ?? null,
    canPick: imagePicker.isAvailable,
  };
}
