import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The admin portal.
 *
 * `@` points at the mobile app's `src/`, not at this folder's. That is the
 * whole trick: `domain/`, `data/` and `shared/theme` are imported verbatim,
 * with the same specifiers they use internally, so there is no second copy of
 * the entities, the repositories or the palette to drift out of sync.
 *
 * It only works because those layers have no React Native dependency — a claim
 * `src/__tests__/architecture.test.ts` enforces rather than assumes. If someone
 * adds `import { env }` to a repository, that test fails before this build
 * breaks with a far less helpful error.
 *
 * `@admin` is this app's own code, kept visibly separate.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('./src', import.meta.url)),
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
