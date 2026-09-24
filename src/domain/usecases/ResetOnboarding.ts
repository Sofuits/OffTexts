import type { Person } from '@/domain/entities';
import {
  failure,
  type PhotoRepository,
  type ProfileRepository,
  type Result,
} from '@/domain/repositories';

/**
 * Puts the signed-in member back to a first run. Development only.
 *
 * It exists so the onboarding wizard can be replayed while it is being worked
 * on, without creating a new account each time. Nothing in a production build
 * can reach it: the only caller is a button behind `env.hasDemoSignIn`, which
 * is false in production whatever the environment variables say.
 *
 * WHAT IT CLEARS, AND WHY THAT IS ENOUGH
 * `hasCompletedOnboarding` reads two fields, `dateOfBirth` and `intents`, so
 * blanking those is what sends the member back to the wizard. Photos go too,
 * or the photo step comes back pre-filled and the replay is not a first run.
 * Everything else the wizard asks for is overwritten when it is finished
 * again, and the wizard's draft starts empty regardless of the profile.
 *
 * Through the repositories rather than around them, so it behaves the same on
 * the in-memory backend and on Supabase — on Supabase it is an ordinary
 * update of the member's own row, which RLS already allows.
 *
 * Photos first, profile last. If a photo fails to delete, the member is still
 * onboarded and still on the tabs, and pressing the button again finishes the
 * job. The other order could leave them in the wizard with photos it would
 * show as already picked.
 */
export class ResetOnboarding {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly photos: PhotoRepository,
  ) {}

  async execute(): Promise<Result<Person>> {
    const mine = await this.photos.listMyPhotos();
    if (!mine.ok) return failure(mine.error);

    // One at a time. Each removal renumbers the ones after it, so two in
    // flight at once would be renumbering the same rows.
    for (const photo of mine.value) {
      const removed = await this.photos.removePhoto(photo.id);
      if (!removed.ok) return failure(removed.error);
    }

    return this.profiles.updateMyProfile({ dateOfBirth: null, intents: [] });
  }
}
