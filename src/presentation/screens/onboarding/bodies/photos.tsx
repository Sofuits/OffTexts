import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, PhotoGrid, Spacer } from '@/presentation/components';
import { usePhotoUpload } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import { MIN_PHOTOS, usablePhotos, type PhotoId } from '@/domain/entities';
import type { StepContext } from '../steps';

/**
 * The one step that writes as it goes, and always has.
 *
 * The file has already left the phone and is sitting in the bucket the moment
 * it is picked, so the only choice is whether the row that points at it
 * exists — and a file with no row is an orphan nobody can find or delete.
 */
export function PhotosBody(_props: StepContext): React.JSX.Element {
  const theme = useTheme();
  const photos = usePhotoUpload();
  const [previewing, setPreviewing] = useState<PhotoId | null>(null);

  const usable = usablePhotos(photos.photos).length;
  const needed = Math.max(MIN_PHOTOS - usable, 0);

  // Camera or library, asked each time. A remembered choice would be one more
  // setting; the question costs a tap and matches what every phone does.
  const chooseSource = (): void => {
    if (!photos.canUseCamera) {
      void photos.add('library');
      return;
    }
    Alert.alert('Add a photo', undefined, [
      { text: 'Take a photo', onPress: () => void photos.add('camera') },
      { text: 'Choose from library', onPress: () => void photos.add('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const index = previewing ? photos.photos.findIndex((photo) => photo.id === previewing) : -1;
  const current = index >= 0 ? photos.photos[index] : undefined;

  return (
    <>
      <PhotoGrid
        photos={photos.photos}
        onAdd={chooseSource}
        onRemove={(id) => {
          void photos.remove(id);
        }}
        onPressPhoto={setPreviewing}
        busy={photos.isBusy}
        canPick={photos.canPick}
      />

      <Spacer size={16} />
      <AppText
        variant="caption"
        color={needed > 0 ? 'textSecondary' : 'success'}
        testID="photo-count"
      >
        {needed > 0
          ? `Add ${needed} more to continue. Up to 6 in total.`
          : 'Tap a photo to preview it, or to make it your main one.'}
      </AppText>

      {photos.photos.some((photo) => photo.moderation === 'rejected') ? (
        <>
          <Spacer size={8} />
          <AppText variant="caption" color="danger">
            Photos that weren’t accepted don’t count. Tap one to see why, then replace it.
          </AppText>
        </>
      ) : null}

      {photos.error ? (
        <>
          <Spacer size={16} />
          <AppText variant="caption" color="danger" testID="photo-error">
            {photos.error}
          </AppText>
        </>
      ) : null}

      {!photos.canPick ? (
        <>
          <Spacer size={16} />
          <AppText variant="caption" color="textDisabled">
            Adding photos needs the Offtexts app on a phone.
          </AppText>
        </>
      ) : null}

      <Modal
        visible={current !== undefined}
        animationType="slide"
        onRequestClose={() => setPreviewing(null)}
        presentationStyle="fullScreen"
      >
        <SafeAreaView
          style={[styles.fill, { backgroundColor: theme.colors.background }]}
          edges={['top', 'bottom']}
        >
          {current ? (
            <View style={[styles.fill, { padding: theme.spacing[20] }]}>
              <View style={styles.header}>
                <AppText variant="bodyStrong" style={styles.fill}>
                  {index === 0 ? 'Main photo' : `Photo ${index + 1} of ${photos.photos.length}`}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close preview"
                  onPress={() => setPreviewing(null)}
                  hitSlop={theme.hitSlop}
                  testID="button-close-preview"
                >
                  <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
                </Pressable>
              </View>

              <Spacer size={16} />
              <Image
                source={{ uri: current.url }}
                style={[styles.preview, { borderRadius: theme.radii.lg }]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />

              <Spacer size={12} />
              {current.moderation === 'pending' ? (
                <AppText variant="caption" color="warning">
                  Waiting on a moderator. Only you can see it until then.
                </AppText>
              ) : current.moderation === 'rejected' ? (
                <AppText variant="caption" color="danger">
                  {`Not accepted${current.rejectionReason ? `: ${current.rejectionReason}` : '.'}`}
                </AppText>
              ) : null}

              <View style={styles.fill} />

              {index > 0 ? (
                <Button
                  label="Make this my main photo"
                  fullWidth
                  onPress={() => {
                    void photos.makeMain(current.id);
                    setPreviewing(null);
                  }}
                  disabled={photos.isBusy}
                  testID="button-make-main"
                />
              ) : null}
              <Spacer size={12} />
              <View style={[styles.row, { gap: theme.spacing[12] }]}>
                <Button
                  label="Move earlier"
                  variant="secondary"
                  style={styles.fill}
                  onPress={() => void photos.move(current.id, -1)}
                  disabled={index === 0 || photos.isBusy}
                  testID="button-move-earlier"
                />
                <Button
                  label="Move later"
                  variant="secondary"
                  style={styles.fill}
                  onPress={() => void photos.move(current.id, 1)}
                  disabled={index === photos.photos.length - 1 || photos.isBusy}
                  testID="button-move-later"
                />
              </View>
              <Spacer size={12} />
              <Button
                label="Remove photo"
                variant="ghost"
                fullWidth
                onPress={() => {
                  void photos.remove(current.id);
                  setPreviewing(null);
                }}
                disabled={photos.isBusy}
                testID="button-remove-preview"
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row' },
  preview: { width: '100%', aspectRatio: 1 },
});
