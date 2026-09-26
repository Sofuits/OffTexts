export const MAX_PROFILE_PHOTOS = 6;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_PROFILE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProfilePhotoValidationInput = {
  mimeType?: string | null;
  fileSize?: number;
  fileExists?: boolean;
  currentPhotoCount: number;
  maximumPhotos?: number;
};

export function validateProfilePhotoUpload({
  mimeType,
  fileSize,
  fileExists,
  currentPhotoCount,
  maximumPhotos = MAX_PROFILE_PHOTOS,
}: ProfilePhotoValidationInput): string | null {
  if (fileExists === false) {
    return 'Please select a JPG, PNG, or WebP image.';
  }

  const normalizedMimeType = mimeType?.toLowerCase();
  if (!normalizedMimeType || !ALLOWED_PROFILE_PHOTO_MIME_TYPES.includes(normalizedMimeType as any)) {
    return 'Please select a JPG, PNG, or WebP image.';
  }

  if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE) {
    return 'Image is too large. Please choose an image under 10 MB.';
  }

  if (currentPhotoCount >= maximumPhotos) {
    return `You can upload up to ${maximumPhotos} profile photos.`;
  }

  return null;
}

export function reorderPhotoIds<T>(ids: T[], fromIndex: number, toIndex: number): T[] {
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate photo ids were supplied.');
  }

  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return [...ids];
  }

  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return [...ids];
  }
  next.splice(toIndex, 0, moved);
  return next;
}

export function removePhotoFromOrder<T>(ids: T[], idToRemove: T): T[] {
  return ids.filter((id) => id !== idToRemove);
}
