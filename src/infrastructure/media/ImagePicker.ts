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
  mimeType?: string | null;
  fileSize?: number;
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
  /** True when this build can pick at all. False on web and under test. */
  readonly isAvailable: boolean;
}

/** The real one. */
export class ExpoImagePicker implements ImagePickerService {
  readonly isAvailable = true;

  private async readFileMetadata(uri: string): Promise<{ mimeType?: string | null; fileSize?: number }> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const mimeType = blob.type || null;
      return { mimeType, fileSize: typeof blob.size === 'number' ? blob.size : undefined };
    } catch {
      return {};
    }
  }

  async pickFromLibrary(): Promise<PickedImage | null> {
    const permission = await ExpoPicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error(
        permission.canAskAgain
          ? 'Offtexts needs permission to open your photos.'
          : 'Photo access is off for Offtexts. You can turn it on in your phone’s settings.',
      );
    }

    const result = await ExpoPicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
      base64: false,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset) return null;

    const metadata = await this.readFileMetadata(asset.uri);

    return {
      uri: asset.uri,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      mimeType: asset.mimeType ?? metadata.mimeType ?? null,
      fileSize: metadata.fileSize,
    };
  }
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

  async pickFromLibrary(): Promise<PickedImage | null> {
    return null;
  }
}
