import { useCallback, useState } from 'react';

import { useServices } from '@/app/di';
import type { Photo, PhotoId } from '@/domain/entities';
import { useAddPhoto, useMyPhotos, useRemovePhoto, useSetPhotoOrder } from '@/presentation/hooks/queries/usePhotos';
import {
  MAX_PROFILE_PHOTOS,
  reorderPhotoIds,
  validateProfilePhotoUpload,
} from '@/shared/utils';

export type PhotoManager = {
  /** The member's photos in order, including ones still waiting on a moderator. */
  photos: Photo[];
  isLoading: boolean;
  /** Opens the library, uploads what is chosen, and records it. */
  add: () => Promise<void>;
  remove: (id: PhotoId) => Promise<void>;
  reorder: (fromIndex: number, toIndex: number) => Promise<void>;
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
  const setPhotoOrder = useSetPhotoOrder();

  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const add = useCallback(async (): Promise<void> => {
    const currentCount = query.data?.length ?? 0;
    if (currentCount >= MAX_PROFILE_PHOTOS) {
      setPickerError(`You can upload up to ${MAX_PROFILE_PHOTOS} profile photos.`);
      return;
    }

    setPickerError(null);
    setIsPicking(true);

    let picked: { uri: string; mimeType?: string | null; fileSize?: number } | null = null;
    try {
      picked = await imagePicker.pickFromLibrary();
    } catch (caught) {
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

    const validationError = validateProfilePhotoUpload({
      mimeType: picked.mimeType,
      fileSize: picked.fileSize,
      fileExists: true,
      currentPhotoCount: currentCount,
      maximumPhotos: MAX_PROFILE_PHOTOS,
    });

    if (validationError) {
      setPickerError(validationError);
      return;
    }

    await addPhoto.mutateAsync(picked.uri).catch(() => undefined);
  }, [imagePicker, addPhoto, query.data?.length]);

  const remove = useCallback(
    async (id: PhotoId): Promise<void> => {
      setPickerError(null);
      await removePhoto.mutateAsync(id).catch(() => undefined);
    },
    [removePhoto],
  );

  const reorder = useCallback(
    async (fromIndex: number, toIndex: number): Promise<void> => {
      const ids = (query.data ?? []).map((photo) => photo.id);
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= ids.length || toIndex >= ids.length) return;

      const nextIds = reorderPhotoIds(ids, fromIndex, toIndex);
      setPickerError(null);
      await setPhotoOrder.mutateAsync(nextIds).catch(() => undefined);
    },
    [query.data, setPhotoOrder],
  );

  return {
    photos: query.data ?? [],
    isLoading: query.isPending,
    add,
    remove,
    reorder,
    isBusy: isPicking || addPhoto.isPending || removePhoto.isPending || setPhotoOrder.isPending,
    error:
      pickerError ??
      addPhoto.error?.message ??
      removePhoto.error?.message ??
      setPhotoOrder.error?.message ??
      null,
    canPick: imagePicker.isAvailable,
  };
}
