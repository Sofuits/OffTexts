/**
 * Use cases.
 *
 * A use case exists here when it does something a repository call alone does
 * not: enforce a rule, combine sources, or derive something the whole product
 * must agree on.
 *
 * It does NOT exist for a plain read. A `GetProfileUseCase` whose entire body
 * is `return this.profiles.getMyProfile()` adds a file, a constructor, a
 * registration in the container and a line in every test — and buys nothing.
 * That is the failure mode of Clean Architecture in practice, and it is worth
 * naming so nobody adds one out of symmetry.
 *
 * Plain reads go straight from a query hook to the repository. Both are behind
 * the same interface, so decoupling is unaffected either way.
 */
export {
  ageOn,
  CompleteOnboarding,
  LIMITS as ONBOARDING_LIMITS,
  onboardingGap,
  SaveOnboardingStep,
  type OnboardingStepSave,
} from './CompleteOnboarding';
export { GetScheduledMeets, type ScheduledMeets } from './GetScheduledMeets';
export { RequestMeet } from './RequestMeet';
export { RequestPasswordReset } from './RequestPasswordReset';
export { ResendVerificationCode } from './ResendVerificationCode';
export { SignIn } from './SignIn';
export {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS,
  passwordChecks,
  validateNewPassword,
  type PasswordCheck,
  type PasswordRequirement,
} from './passwordRules';
export { SignUp, type SignUpInput, type SignUpOutcome } from './SignUp';
export { SignInWithGoogle, SignOut, type SignInOutcome } from './SignInWithGoogle';
export { SubmitReview } from './SubmitReview';
export { UpdatePassword } from './UpdatePassword';
export { SIGN_UP_CODE_LENGTH, VerifyEmail } from './VerifyEmail';
export { VerifyPasswordResetCode } from './VerifyPasswordResetCode';
