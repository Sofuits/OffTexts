import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';
import { MAX_PHOTOS, type Photo, type PhotoId } from '@/domain/entities';

export type PhotoGridProps = {
  /** Ordered. The first one is the member's avatar everywhere in the app. */
  photos: Photo[];
  max?: number;
  onAdd: () => void;
  onRemove: (id: PhotoId) => void;
  /** True while a photo is being picked, uploaded or deleted. Blocks a second tap. */
  busy?: boolean;
  /** False on platforms with no camera roll — the tiles then explain themselves. */
  canPick?: boolean;
  style?: ViewStyle;
};

/**
 * The photo tiles, three across.
 *
 * The first tile is labelled, because ordering is not obvious and it matters:
 * photo one is the avatar on every card, every match row and every meet. People
 * who do not know that upload their best photo third.
 *
 * MODERATION IS SHOWN ON THE TILE, not in a sentence underneath. A member who
 * has just uploaded a photo and cannot see it anywhere else assumes it failed —
 * a dimmed tile with "Waiting" on it is the difference between "it is being
 * checked" and "it did not work".
 *
 * Empty slots are drawn rather than hidden. A single "+" button gives no sense
 * of how many are wanted; six outlines do, and the flow gets better profiles
 * for it.
 */
export function PhotoGrid({
  photos,
  max = MAX_PHOTOS,
  onAdd,
  onRemove,
  busy = false,
  canPick = true,
  style,
}: PhotoGridProps): React.JSX.Element {
  const theme = useTheme();
  const slots = Array.from({ length: max }, (_, index) => photos[index]);

  return (
    <View style={[styles.grid, { gap: theme.spacing[12] }, style]}>
      {slots.map((photo, index) => {
        const isNextEmpty = !photo && photos.length === index;

        if (photo) {
          const rejected = photo.moderation === 'rejected';
          const pending = photo.moderation === 'pending';

          return (
            <View key={photo.id} style={styles.cell}>
              <View
                style={[
                  styles.tile,
                  {
                    borderRadius: theme.radii.lg,
                    backgroundColor: theme.colors.inset,
                    borderColor: rejected ? theme.colors.danger : theme.colors.border,
                  },
                ]}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={[styles.image, rejected && styles.faded]}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={index === 0 ? 'Your main photo' : `Photo ${index + 1}`}
                />

                {pending || rejected ? (
                  <View style={[styles.stamp, { backgroundColor: theme.colors.scrim }]}>
                    <AppText
                      variant="caption"
                      color={rejected ? 'danger' : 'warning'}
                      align="center"
                    >
                      {rejected ? 'Not accepted' : 'Waiting'}
                    </AppText>
                  </View>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => onRemove(photo.id)}
                disabled={busy}
                hitSlop={theme.hitSlop}
                style={[
                  styles.remove,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                ]}
                testID={`button-remove-photo-${index}`}
              >
                <Ionicons name="close" size={14} color={theme.colors.textPrimary} />
              </Pressable>

              {index === 0 ? (
                <AppText
                  variant="caption"
                  color="primary"
                  align="center"
                  style={{ marginTop: theme.spacing[4] }}
                >
                  Main
                </AppText>
              ) : null}
            </View>
          );
        }

        return (
          <View key={`slot-${index}`} style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                canPick ? `Add photo ${index + 1}` : 'Adding photos is not available here'
              }
              accessibilityState={{ disabled: !canPick || busy || !isNextEmpty }}
              // Only the next empty slot is live. Letting somebody fill slot
              // five while four is empty produces a gap the grid then fills in
              // the wrong place, and the database numbers slots by position.
              disabled={!canPick || busy || !isNextEmpty}
              onPress={onAdd}
              style={({ pressed }) => [
                styles.tile,
                styles.centre,
                {
                  borderRadius: theme.radii.lg,
                  backgroundColor: theme.colors.inset,
                  borderColor: isNextEmpty ? theme.colors.primary : theme.colors.border,
                  borderStyle: 'dashed',
                },
                pressed && styles.pressed,
              ]}
              testID={`button-add-photo-${index}`}
            >
              {busy && isNextEmpty ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Ionicons
                  name="add"
                  size={24}
                  color={isNextEmpty ? theme.colors.primary : theme.colors.textDisabled}
                />
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Three across: a third of the row, less two gaps of 12 shared between three
  // cells. Expressed as a percentage so it holds on any screen width.
  cell: { width: '30.6%' },
  tile: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  faded: { opacity: 0.4 },
  stamp: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
});
