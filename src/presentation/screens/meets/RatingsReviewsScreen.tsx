import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  QueryBoundary,
  ScreenContainer,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import { averageRating } from '@/domain/entities';
import { useReviewsForMeet } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { formatDate } from '@/shared/utils/date';
import { clamp } from '@/shared/utils/helpers';

type Props = RootStackScreenProps<'RatingsReviews'>;

/** Whole stars for a 1–5 rating. */
function Stars({ rating }: { rating: number }): React.JSX.Element {
  const filled = clamp(Math.round(rating), 0, 5);
  return (
    <AppText variant="label" color="primary" accessibilityLabel={`${filled} out of 5 stars`}>
      {'★'.repeat(filled)}
      <AppText variant="label" color="textDisabled">
        {'★'.repeat(5 - filled)}
      </AppText>
    </AppText>
  );
}

/** Ratings and reviews for a past meet, reached from the History section. */
export function RatingsReviewsScreen({ route }: Props): React.JSX.Element {
  const theme = useTheme();
  const { meetId, personName } = route.params;
  const reviews = useReviewsForMeet(meetId);

  return (
    <ScreenContainer testID="screen-ratings-reviews" edges={['bottom']}>
      <SectionHeader title={`Meet with ${personName}`} subtitle="How it went" />
      <Spacer size={20} />

      <QueryBoundary
        isLoading={reviews.isPending}
        error={reviews.error}
        data={reviews.data}
        onRetry={reviews.refetch}
        emptyMessage="No reviews for this meet yet."
      >
        {(items) => {
          // Computed by the domain, so every client shows the same number.
          const average = averageRating(items) ?? 0;

          return (
            <>
              <View
                style={[
                  styles.summary,
                  {
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.radii.lg,
                    borderColor: theme.colors.border,
                    padding: theme.spacing[20],
                  },
                ]}
              >
                <AppText variant="display" color="primary">
                  {average.toFixed(1)}
                </AppText>
                <Stars rating={average} />
                <AppText
                  variant="caption"
                  color="textSecondary"
                  style={{ marginTop: theme.spacing[4] }}
                >
                  {items.length} {items.length === 1 ? 'review' : 'reviews'}
                </AppText>
              </View>

              <Spacer size={20} />

              {items.map((review, index) => (
                <React.Fragment key={review.id}>
                  {index > 0 ? <Spacer size={12} /> : null}
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.colors.card,
                        borderRadius: theme.radii.lg,
                        padding: theme.spacing[16],
                        borderColor: theme.colors.border,
                        ...theme.shadows.sm,
                      },
                    ]}
                  >
                    <View style={styles.cardHead}>
                      <Avatar name={review.authorName} size={36} />
                      <View style={[styles.cardHeadText, { marginLeft: theme.spacing[12] }]}>
                        <AppText variant="bodyStrong">{review.authorName}</AppText>
                        <AppText variant="caption" color="textSecondary">
                          {formatDate(review.createdAt)}
                        </AppText>
                      </View>
                      <Stars rating={review.rating} />
                    </View>

                    <AppText
                      variant="body"
                      color="textSecondary"
                      style={{ marginTop: theme.spacing[12] }}
                    >
                      {review.comment}
                    </AppText>
                  </View>
                </React.Fragment>
              ))}
            </>
          );
        }}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardHeadText: { flex: 1 },
});
