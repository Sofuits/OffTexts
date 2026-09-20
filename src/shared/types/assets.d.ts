/**
 * Lets TypeScript accept `import logo from './logo.png'`.
 *
 * Metro turns an image import into a number (an asset registry id) at build
 * time, but TypeScript has no idea that happens. Expo generates a similar
 * declaration into `expo-env.d.ts` when the dev server starts — that file is
 * gitignored, so a fresh clone would fail `npm run typecheck` before anyone
 * had run `npm start`. This file is committed, so it always works.
 */
declare module '*.png' {
  const content: number;
  export default content;
}

declare module '*.jpg' {
  const content: number;
  export default content;
}

declare module '*.jpeg' {
  const content: number;
  export default content;
}

declare module '*.gif' {
  const content: number;
  export default content;
}

declare module '*.webp' {
  const content: number;
  export default content;
}
