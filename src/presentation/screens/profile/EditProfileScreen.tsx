import React from 'react';

import {
  AppText,
  Button,
  ScreenContainer,
  SectionHeader,
  Spacer,
  TextField,
} from '@/presentation/components';
import type { RootStackScreenProps } from '@/app/navigation/types';

type Props = RootStackScreenProps<'EditProfile'>;

/**
 * Edit profile — placeholder.
 *
 * The fields render but are uncontrolled and nothing is saved: profile editing
 * is out of scope for this boilerplate. The screen exists so the path from the
 * Profile tab is real and typed.
 */
export function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  return (
    <ScreenContainer testID="screen-edit-profile" edges={['bottom']}>
      <SectionHeader title="Edit profile" subtitle="Layout only — saving is not wired up" />
      <Spacer size={20} />

      <TextField label="Full name" placeholder="As on your ID" editable={false} />
      <Spacer size={16} />
      <TextField label="Headline" placeholder="One line about you" editable={false} />
      <Spacer size={16} />
      <TextField label="City" placeholder="Pune" editable={false} />
      <Spacer size={16} />
      <TextField
        label="About"
        placeholder="A few sentences"
        multiline
        editable={false}
        hint="Fields stay disabled until the profile API exists."
      />

      <Spacer size={32} />
      <Button label="Save changes" fullWidth disabled />
      <Spacer size={12} />
      <Button label="Cancel" variant="ghost" fullWidth onPress={navigation.goBack} />

      <Spacer size={24} />
      <AppText variant="caption" color="textSecondary" align="center">
        Saving is intentionally not implemented. See the roadmap in README.md.
      </AppText>
    </ScreenContainer>
  );
}
