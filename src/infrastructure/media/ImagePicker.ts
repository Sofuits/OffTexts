import * as ExpoPicker from 'expo-image-picker';

/**
 * Picking a photo from the phone, behind an interface.
 *
 * WHY THIS IS NOT IMPORTED BY THE SCREEN
 * `expo-image-picker` is a native module. A screen that imports it directly
 * cannot be rendered under Jest, cannot run on the web, and pins the app to
 * Expo for as long as that screen exists. One file holds the import and the
 * composition root hands the interface out — the same arrangement the logger,
 * the connectivity monitor and the key-value store already use.
 *
 * The result type is deliberately small: a local `file://` URI and its
 * dimensions. Everything else the picker returns (EXIF, base64, asset ids) is
 * either privacy-sensitive or useless to us, and asking for it costs memory on
 * a device that may not have much.
 */

export type PickedImage = {
  /** A local `file://` URI. Upload it, then discard it — it does not persist. */
  uri: string;
  width: number;
  height: number;
};

export interface ImagePickerService {
  /**
   * Opens the library and returns what was chosen.
   *
   * `null` means the member backed out, which is not an error and must not be
   * shown as one. A refused permission throws, because that is a state the
   * screen has to explain.
   */
  pickFromLibrary(): Promise<PickedImage | null>;
  /**
   * Opens the camera and returns the photo taken. Same contract as
   * `pickFromLibrary`: `null` for backing out, a throw for a refused permission.
   */
  takePhoto(): Promise<PickedImage | null>;
  /** True when this build can pick at all. False on web and under test. */
  readonly isAvailable: boolean;
  /** True when there is a camera to open. */
  readonly canUseCamera: boolean;
}

/** The real one. */
export class ExpoImagePicker implements ImagePickerService {
  readonly isAvailable = true;
  readonly canUseCamera = true;

  async pickFromLibrary(): Promise<PickedImage | null> {
    const permission = await ExpoPicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      // Thrown rather than returned as null, because the two need different
      // words on screen: "you cancelled" needs no words at all, and "we cannot
      // see your photos" needs a sentence pointing at Settings.
      throw new Error(
        permission.canAskAgain
          ? 'Offtexts needs permission to open your photos.'
          : 'Photo access is off for Offtexts. You can turn it on in your phone’s settings.',
      );
    }

    return toPicked(await ExpoPicker.launchImageLibraryAsync(PICKER_OPTIONS));
  }

  async takePhoto(): Promise<PickedImage | null> {
    const permission = await ExpoPicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new Error(
        permission.canAskAgain
          ? 'Offtexts needs permission to use your camera.'
          : 'Camera access is off for Offtexts. You can turn it on in your phone’s settings.',
      );
    }

    return toPicked(await ExpoPicker.launchCameraAsync(PICKER_OPTIONS));
  }
}

const PICKER_OPTIONS: ExpoPicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // Square, because every place a photo appears in this app is square or a
  // circle. Cropping here means the member chooses the crop instead of an
  // algorithm choosing it for them later.
  allowsEditing: true,
  aspect: [1, 1],
  // 0.8 rather than 1: the difference is invisible at the sizes we display
  // and roughly halves what gets uploaded over a phone connection.
  quality: 0.8,
  exif: false,
  base64: false,
};

function toPicked(result: ExpoPicker.ImagePickerResult): PickedImage | null {
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/**
 * The one used where there is no camera roll: tests, and the web build.
 *
 * It reports `isAvailable: false` so the UI can hide the control rather than
 * offer a button that does nothing — the same reasoning as the Google sign-in
 * flag in `env`.
 */
export class UnavailableImagePicker implements ImagePickerService {
  readonly isAvailable = false;
  readonly canUseCamera = false;

  async pickFromLibrary(): Promise<PickedImage | null> {
    return null;
  }

  async takePhoto(): Promise<PickedImage | null> {
    return null;
  }
}
