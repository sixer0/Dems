/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { packagedCspPlugin } from './src/lib/packaged-csp.ts'

// masterplan/01_specs.md §4.2. The router plugin must come before react() (02 L527).
// 06_packaging_spec §3.4 (step 100): `base` stays the default `/` and `build.sourcemap` stays off.
// `packagedCspPlugin` is build-only and acts only with VITE_DEMS_CORE_ORIGIN=same-origin (the
// packager); dev mode and the default build are unchanged.
export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), packagedCspPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  // D127 (F96-1): nothing is inlined as a `data:` URI. The app fetches the small demo-evidence files, and the packaged CSP `connect-src` blocks `fetch(data:)`.
  build: { assetsInlineLimit: 0 },
  // D91 (step 53 hand-over): pre-bundle the form stack, so a cold dependency cache does not
  // re-optimise on the first /session/new load (one "Invalid hook call", then a reload).
  // `@hookform/resolvers/zod` is the subpath the app imports (session-new/index.tsx).
  optimizeDeps: { include: ['react-hook-form', '@hookform/resolvers', '@hookform/resolvers/zod', 'zod'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // D74 M7 (step 53 hand-over): `.test.ts` files run too.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
