import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  QueryBoundary,
  ScreenContainer,
  Spacer,
} from '@/presentation/components';
import { isUpcoming } from '@/domain/entities';
import { useCancelMeet, useMeet } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { formatDayAndDate, formatRelative, formatTime } from '@/shared/utils/date';

type Props = RootStackScreenProps<'MeetDetails'>;

/** Details of one meet, reached from the Upcoming section. */
export function MeetDetailsScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { meetId } = route.params;

  const meet = useMeet(meetId);
  const cancel = useCancelMeet();

  const openPerson = useCallback(() => {
    if (!meet.data) return;
    navigation.navigate('PersonProfile', {
      personId: meet.data.personId,
      personName: meet.data.personName,
    });
  }, [meet.data, navigation]);

  return (
    <ScreenContainer testID="screen-meet-details" edges={['bottom']}>
      <QueryBoundary
        isLoading={meet.isPending}
        error={meet.error}
        data={meet.data}
        onRetry={meet.refetch}
        isEmpty={() => false}
      >
        {(data) => {
          const upcoming = isUpcoming(data);
          const rows: [string, string][] = [
            ['When', formatDayAndDate(data.scheduledFor)],
            ['Time', formatTime(data.scheduledFor)],
            ['Where', `${data.venueName}, ${data.venueArea}`],
            [upcoming ? 'Starts' : 'Happened', formatRelative(data.scheduledFor)],
          ];

          return (
            <>
              <View
                style={[
                  styles.hero,
                  {
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.radii.xl,
                    borderColor: theme.colors.border,
                    padding: theme.spacing[24],
                  },
                ]}
              >
                <Avatar name={data.personName} uri={data.personPhotoUrl} size={72} />
                <Spacer size={12} />
                <AppText variant="subheading" align="center">
                  {data.personName}
                </AppText>
                <AppText variant="body" color="textSecondary" align="center">
                  {data.venueName}
                </AppText>
                <Spacer size={12} />
                <Badge
                  label={data.status}
                  tone={data.status === 'cancelled' ? 'danger' : 'success'}
                />
              </View>

              <Spacer size={24} />
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.radii.lg,
                    borderColor: theme.colors.border,
                    paddingHorizontal: theme.spacing[16],
                  },
                ]}
              >
                {rows.map(([label, value], index) => (
                  <View
                    key={label}
                    style={[
                      styles.row,
                      {
                        paddingVertical: theme.spacing[16],
                        borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: theme.colors.border,
                      },
                    ]}
                  >
                    <AppText variant="label" color="textSecondary">
                      {label}
                    </AppText>
                    <AppText variant="body" style={styles.value}>
                      {value}
                    </AppText>
                  </View>
                ))}
              </View>

              <Spacer size={32} />
              <Button label="View profile" variant="outline" fullWidth onPress={openPerson} />

              {upcoming && data.status !== 'cancelled' ? (
                <>
                  <Spacer size={12} />
                  <Button
                    label="Cancel this meet"
                    variant="danger"
                    fullWidth
                    loading={cancel.isPending}
                    onPress={() => cancel.mutate(data.id)}
                  />
                </>
              ) : null}

              {cancel.error ? (
                <>
                  <Spacer size={12} />
                  <AppText variant="caption" color="danger" align="center">
                    {cancel.error.message}
                  </AppText>
                </>
              ) : null}
            </>
          );
        }}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  value: { flexShrink: 1, textAlign: 'right' },
});
