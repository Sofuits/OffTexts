import React, { useState } from 'react';

import { BottomTabs } from '@/app/navigation/BottomTabs';
import { hasCompletedOnboarding } from '@/domain/entities';
import { useMyProfile } from '@/presentation/hooks';
import { OnboardingScreen, SplashScreen } from '@/presentation/screens';

/**
 * What a signed-in member sees: the wizard, or the app.
 *
 * WHY THIS IS A GATE AND NOT A ROUTE
 * Onboarding as a navigable screen would mean somebody deciding to push it,
 * somebody remembering to pop it, and a back gesture that lands on a half-built
 * profile. As a branch it cannot go wrong: the profile is either complete or it
 * is not, the navigator renders one of two things, and finishing the wizard
 * changes the answer rather than triggering a transition.
 *
 * WHY THE ANSWER IS REMEMBERED RATHER THAN READ EVERY RENDER
 * This is the part that is easy to get wrong, and it was: the obvious version
 * is `if (profile.isPending) return <SplashScreen />`, and it oscillates.
 * The tab screens below read the same profile query, so mounting them adds an
 * observer; if that observer sends the query back to `pending` — which happens
 * whenever the cached entry has been dropped, as it is under a short `gcTime` —
 * the gate returns to the splash, unmounts the tabs, drops the observer, and
 * starts again. React stops it with "Maximum update depth exceeded" after
 * fifty rounds, and the screen the member gets is the error boundary.
 *
 * Holding the last answer breaks the cycle: once the gate knows, a later
 * `pending` cannot take the tabs away. It is also the better behaviour on its
 * own terms — a background refetch of the profile should not flash a splash
 * screen at somebody mid-scroll.
 *
 * WHY A FAILED READ SHOWS THE APP
 * A network error is not evidence of an incomplete profile. Sending somebody
 * with no signal through onboarding again — and writing over what they already
 * have — is the worse of the two mistakes by some margin. The tab screens have
 * their own error states and will say what is wrong.
 */
export function AuthedArea(): React.JSX.Element {
  const profile = useMyProfile();

  // null means "not yet known", which is a third state and not a default.
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  const answer = profile.data
    ? hasCompletedOnboarding(profile.data)
    : profile.isError
      ? // Could not read it. Assume onboarded — see above.
        true
      : null;

  // Adjusted during render rather than in an effect. React supports this for
  // exactly this case: setting state while rendering the same component
  // re-runs that component before anything is committed, so the children never
  // see the stale value and there is no extra frame. Doing it in an effect
  // would render the wrong branch once and then correct it, which for this
  // component means mounting the whole app and immediately unmounting it.
  if (answer !== null && answer !== isOnboarded) {
    setIsOnboarded(answer);
  }

  if (isOnboarded === null && answer === null) return <SplashScreen />;
  if (!isOnboarded) return <OnboardingScreen />;
  return <BottomTabs />;
}
