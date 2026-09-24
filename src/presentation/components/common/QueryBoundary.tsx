import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { useTheme } from '@/presentation/hooks/useTheme';
import { AppError } from '@/domain/repositories';

export type QueryBoundaryProps<T> = {
  isLoading: boolean;
  error: Error | null;
  data: T | undefined;
  /** Called when the member taps Retry. Pass `refetch` from the query. */
  onRetry?: () => void;
  /** Shown when the query succeeded but returned nothing. */
  emptyMessage?: string;
  /** True when `data` counts as empty. Defaults to an empty array check. */
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
};

/**
 * Renders the four states every remote read has: loading, error, empty, data.
 *
 * Written once because otherwise each screen invents its own, they drift, and
 * one of them forgets the error case — which is how a member ends up looking at
 * a permanently empty list with no way to know anything went wrong.
 *
 * Retry is only offered for errors that could plausibly succeed on a second
 * attempt. A Retry button on a 403 is a lie.
 */
export function QueryBoundary<T>({
  isLoading,
  error,
  data,
  onRetry,
  emptyMessage = 'Nothing here yet.',
  isEmpty,
  children,
}: QueryBoundaryProps<T>): React.JSX.Element {
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.centre, { paddingVertical: theme.spacing[40] }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    const appError = error instanceof AppError ? error : null;
    const canRetry = Boolean(onRetry) && (appError?.isRetryable ?? true);

    return (
      <View
        style={[
          styles.centre,
          styles.panel,
          {
            borderRadius: theme.radii.xl,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            padding: theme.spacing[24],
          },
        ]}
      >
        <AppText variant="body" color="textSecondary" align="center">
          {appError?.message ?? 'Something went wrong.'}
        </AppText>
        {canRetry ? (
          <Button
            label="Try again"
            variant="outline"
            size="sm"
            onPress={onRetry}
            style={{ marginTop: theme.spacing[16] }}
          />
        ) : null}
      </View>
    );
  }

  if (data === undefined) {
    return <View />;
  }

  const empty = isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0;

  if (empty) {
    return (
      <View
        style={[
          styles.centre,
          styles.panel,
          // A white card like `EmptyState`, not a dashed outline: dashed reads
          // as "drop something here", and there is nothing to drop.
          {
            borderRadius: theme.radii.xl,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            padding: theme.spacing[32],
          },
        ]}
      >
        <AppText variant="body" color="textSecondary" align="center">
          {emptyMessage}
        </AppText>
      </View>
    );
  }

  return <>{children(data)}</>;
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  panel: { borderWidth: StyleSheet.hairlineWidth },
});
