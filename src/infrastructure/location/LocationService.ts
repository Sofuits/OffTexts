import * as ExpoLocation from 'expo-location';

/**
 * "Which city am I in", behind an interface.
 *
 * The one question onboarding asks of the device's location, and the only
 * thing this returns. Coordinates are read, turned into a city on the phone,
 * and dropped: nothing more precise than a city name leaves this file, so
 * nothing more precise can end up stored or shown. A member's exact position
 * is not something a dating app should hold, even briefly.
 *
 * Behind an interface for the same reason as the image picker: a screen that
 * imports a native module cannot render under Jest or on the web.
 */

export type DetectedCity = {
  city: string;
  /** State or region, for disambiguation only. Not stored. */
  region?: string;
};

export interface LocationService {
  /**
   * The city the phone is in, or `null` if it cannot be worked out.
   *
   * A refused permission throws, with a sentence to show — the screen has to
   * say something different for "you said no" and "we could not tell".
   */
  detectCity(): Promise<DetectedCity | null>;
  /** False where there is no location to ask for: tests, and the web build. */
  readonly isAvailable: boolean;
}

export class ExpoLocationService implements LocationService {
  readonly isAvailable = true;

  async detectCity(): Promise<DetectedCity | null> {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      throw new Error(
        permission.canAskAgain
          ? 'Offtexts needs your permission to find your city. You can type it instead.'
          : 'Location is off for Offtexts. Type your city, or turn location on in your phone’s settings.',
      );
    }

    // Low accuracy is enough for a city and is much faster and kinder to the
    // battery than GPS — it usually answers from Wi-Fi and cell towers alone.
    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Low,
    });

    const [place] = await ExpoLocation.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    const city = place?.city ?? place?.subregion ?? place?.district ?? null;
    if (!city) return null;

    return { city, ...(place?.region ? { region: place.region } : {}) };
  }
}

/** Where there is no location service. The screen hides the button. */
export class UnavailableLocationService implements LocationService {
  readonly isAvailable = false;

  async detectCity(): Promise<DetectedCity | null> {
    return null;
  }
}
