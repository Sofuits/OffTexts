import { toProfileUpdateRow } from '@/data/mappers';
import { InMemoryPhotoRepository, InMemoryProfileRepository } from '@/data/repositories';
import { hasCompletedOnboarding } from '@/domain/entities';
import { AppError, failure, unwrap, type PhotoRepository } from '@/domain/repositories';
import { ResetOnboarding } from '@/domain/usecases';

/**
 * The dev-only reset, against the real in-memory repositories rather than
 * fakes: the point is that it goes through the same interface Supabase
 * implements, so what it does here is what it does there.
 */
describe('ResetOnboarding', () => {
  it('takes a finished profile back to a first run', async () => {
    const profiles = new InMemoryProfileRepository();
    const photos = new InMemoryPhotoRepository();
    await photos.addPhoto('file:///one.jpg');
    await photos.addPhoto('file:///two.jpg');

    // The seeded member has been through onboarding; that is the starting point.
    expect(hasCompletedOnboarding(unwrap(await profiles.getMyProfile()))).toBe(true);

    const person = unwrap(await new ResetOnboarding(profiles, photos).execute());

    expect(person.dateOfBirth).toBeUndefined();
    expect(person.intents).toEqual([]);
    expect(hasCompletedOnboarding(person)).toBe(false);
    expect(hasCompletedOnboarding(unwrap(await profiles.getMyProfile()))).toBe(false);
    expect(unwrap(await photos.listMyPhotos())).toEqual([]);
  });

  it('leaves the profile alone when a photo cannot be removed', async () => {
    const profiles = new InMemoryProfileRepository();
    const inner = new InMemoryPhotoRepository();
    await inner.addPhoto('file:///one.jpg');
    const photos: PhotoRepository = {
      listMyPhotos: () => inner.listMyPhotos(),
      addPhoto: (uri) => inner.addPhoto(uri),
      setPhotoOrder: (ids) => inner.setPhotoOrder(ids),
      removePhoto: async () => failure(new AppError('network', 'No connection.')),
    };

    const result = await new ResetOnboarding(profiles, photos).execute();

    expect(result.ok).toBe(false);
    // Still onboarded, so still on the tabs, where pressing it again retries.
    expect(hasCompletedOnboarding(unwrap(await profiles.getMyProfile()))).toBe(true);
  });

  it('sends Supabase a null date of birth and no intents', () => {
    // The Supabase repository writes exactly this row to `profiles`, which the
    // "update own" policy allows; date_of_birth is nullable. No RPC needed.
    expect(toProfileUpdateRow({ dateOfBirth: null, intents: [] })).toEqual({
      date_of_birth: null,
      intents: [],
    });
  });
});
