import {
  MAX_FILE_SIZE,
  MAX_PROFILE_PHOTOS,
  reorderPhotoIds,
  removePhotoFromOrder,
  validateProfilePhotoUpload,
} from '@/shared/utils/profilePhotoValidation';

describe('profile photo validation', () => {
  it('accepts a valid JPG under the size limit', () => {
    const result = validateProfilePhotoUpload({
      mimeType: 'image/jpeg',
      fileSize: 1024 * 1024,
      fileExists: true,
      currentPhotoCount: 2,
      maximumPhotos: MAX_PROFILE_PHOTOS,
    });

    expect(result).toBeNull();
  });

  it('rejects an unsupported file type', () => {
    const result = validateProfilePhotoUpload({
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileExists: true,
      currentPhotoCount: 1,
      maximumPhotos: MAX_PROFILE_PHOTOS,
    });

    expect(result).toBe('Please select a JPG, PNG, or WebP image.');
  });

  it('rejects an oversized image', () => {
    const result = validateProfilePhotoUpload({
      mimeType: 'image/png',
      fileSize: MAX_FILE_SIZE + 1,
      fileExists: true,
      currentPhotoCount: 1,
      maximumPhotos: MAX_PROFILE_PHOTOS,
    });

    expect(result).toBe('Image is too large. Please choose an image under 10 MB.');
  });

  it('rejects any upload beyond the configured maximum count', () => {
    const result = validateProfilePhotoUpload({
      mimeType: 'image/webp',
      fileSize: 128 * 1024,
      fileExists: true,
      currentPhotoCount: MAX_PROFILE_PHOTOS,
      maximumPhotos: MAX_PROFILE_PHOTOS,
    });

    expect(result).toBe('You can upload up to 6 profile photos.');
  });
});

describe('photo ordering utility', () => {
  it('moves a photo to the front while preserving the rest of the sequence', () => {
    const photos = ['a', 'b', 'c'];

    expect(reorderPhotoIds(photos, 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('removes a photo and renumbers the remaining order', () => {
    const photos = ['a', 'b', 'c'];

    expect(removePhotoFromOrder(photos, 'b')).toEqual(['a', 'c']);
  });

  it('prevents duplicate ids in a reorder to avoid corrupted order', () => {
    expect(() => reorderPhotoIds(['a', 'b', 'c'], 0, 0)).not.toThrow();
    expect(() => reorderPhotoIds(['a', 'a', 'c'], 0, 1)).toThrow('Duplicate photo ids were supplied.');
  });
});
