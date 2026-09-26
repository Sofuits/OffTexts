/**
 * Barrel for the component library.
 *
 * Screens import from `@/presentation/components`; they should not reach into a
 * subfolder. That keeps the public surface of this layer visible in one file.
 */
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './buttons/Button';
export { CandidateCard, type CandidateCardProps } from './cards/CandidateCard';
export { MatchListItem, type MatchListItemProps } from './cards/MatchListItem';
export { MeetListItem, type MeetListItemProps } from './cards/MeetListItem';
export { ProfileCard, type ProfileCardProps } from './cards/ProfileCard';
export { AppText, type AppTextProps } from './common/AppText';
export { Avatar, type AvatarProps } from './common/Avatar';
export { Badge, type BadgeProps } from './common/Badge';
export { EmptyState, type EmptyStateProps } from './common/EmptyState';
export { ErrorBoundary } from './common/ErrorBoundary';
export { Logo, type LogoProps } from './common/Logo';
export { MatchCelebration, type MatchCelebrationProps } from './common/MatchCelebration';
export { OfflineBanner } from './common/OfflineBanner';
export { QueryBoundary, type QueryBoundaryProps } from './common/QueryBoundary';
export { SectionHeader, type SectionHeaderProps } from './common/SectionHeader';
export { Spacer, type SpacerProps } from './common/Spacer';
export { InterestPicker, type InterestPickerProps } from './inputs/InterestPicker';
export { PasswordChecklist } from './inputs/PasswordChecklist';
export { PasswordField, type PasswordFieldProps } from './inputs/PasswordField';
export { TextField, type TextFieldProps } from './inputs/TextField';
export { ScreenContainer, type ScreenContainerProps } from './layouts/ScreenContainer';
export {
  ProfileSummary,
  type ProfileSection,
  type ProfileSummaryProps,
} from './profile/ProfileSummary';
export { ScreenHeader, type ScreenHeaderProps } from './layouts/ScreenHeader';
export { Chip, ChipGroup, type ChipProps } from './onboarding/Chip';
export { AgeRangeField, type AgeRangeFieldProps } from './onboarding/AgeRangeField';
export { ChoiceRow, type ChoiceRowProps } from './onboarding/ChoiceRow';
export { CircleButton, type CircleButtonProps } from './onboarding/CircleButton';
export { DateOfBirthField, type DateOfBirthFieldProps } from './onboarding/DateOfBirthField';
export { IconTile, type IconTileProps } from './onboarding/IconTile';
export { MultiOptionChips, type MultiOptionChipsProps } from './onboarding/MultiOptionChips';
export { OnboardingStep, type OnboardingStepProps } from './onboarding/OnboardingStep';
export { OptionChips, type OptionChipsProps } from './onboarding/OptionChips';
export { PhotoGrid, type PhotoGridProps } from './onboarding/PhotoGrid';
export { PrivacyNote, type PrivacyNoteProps } from './onboarding/PrivacyNote';
export { ProgressDots, type ProgressDotsProps } from './onboarding/ProgressDots';
export { VisibilityToggle, type VisibilityToggleProps } from './onboarding/VisibilityToggle';
