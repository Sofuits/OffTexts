# Assets

Everything the app bundles: images, icons, fonts and SVGs.

App-level artwork (launcher icon, splash, favicon) lives in the project-root
`assets/` folder because `app.config.ts` points at it. Everything a component
imports lives here.

## Folders

| Folder    | What goes in it                                          |
| --------- | -------------------------------------------------------- |
| `images/` | Photographs and raster artwork (`.png`, `.jpg`, `.webp`) |
| `icons/`  | Small raster icons that are not from an icon font        |
| `fonts/`  | Font files (`.ttf`, `.otf`)                              |
| `svg/`    | Vector artwork (`.svg`)                                  |

## Images

Drop the file into `images/` and import it. Metro resolves the path at build
time, so the import must be a literal string — a variable will not work.

```tsx
import { Image } from 'react-native';

import venuePlaceholder from '@/assets/images/venue-placeholder.png';

<Image source={venuePlaceholder} style={{ width: 120, height: 120 }} />;
```

Ship `@2x` and `@3x` variants next to the base file and Metro picks the right
one per device:

```text
venue-placeholder.png
venue-placeholder@2x.png
venue-placeholder@3x.png
```

A remote image uses `source={{ uri }}` instead and needs explicit dimensions —
React Native cannot measure an image it has not downloaded yet.

## Icons

Prefer `@expo/vector-icons`, already a dependency. It covers Ionicons, Material
Icons and several more. Import each icon set from its own entry point, never
from the package root — the root import makes Metro bundle every set's font
(about 4MB of TTFs) even when only one is used:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';

<Ionicons name="calendar-outline" size={24} color={theme.colors.primary} />;
```

Only put a file in `icons/` when the design is custom and no icon font has it.

## Fonts

1. Put the files in `fonts/`, for example `Inter-Regular.ttf`.
2. Install the loader once: `npx expo install expo-font`.
3. Load them before the first render — text flashes in the system font
   otherwise:

```tsx
import { useFonts } from 'expo-font';

const [loaded] = useFonts({
  'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
  'Inter-SemiBold': require('@/assets/fonts/Inter-SemiBold.ttf'),
});

if (!loaded) return null;
```

4. Point the theme at them in `src/theme/typography.ts`:

```ts
export const fontFamilies = {
  regular: 'Inter-Regular',
  semibold: 'Inter-SemiBold',
  // …
};
```

Every `AppText` picks the new font up from there. No component changes.

**On Android, `fontWeight` is ignored when `fontFamily` is set.** Load a
separate file per weight and name it; do not expect `fontWeight: '600'` to
synthesise a semibold.

## SVG

Not wired up by default. To use SVGs as components:

```bash
npx expo install react-native-svg
npm install -D react-native-svg-transformer
```

Then add a `metro.config.js` that routes `.svg` through the transformer. Until
that is done, export SVGs to PNG and put them in `images/`.

## Naming

`kebab-case`, descriptive, no spaces: `meet-confirmed-badge.png`, not
`Group 12 copy.png`. Some build steps are case-sensitive and some are not, and
the mismatch only surfaces on a colleague's machine.
