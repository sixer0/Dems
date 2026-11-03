/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ServerOptions } from 'vite'
import { packagedCspPlugin } from './src/lib/packaged-csp.ts'

/** Ports a Core server listens on: the main instance and lanes 1 to 3 (backend task 02_plan §3.4, §4.2). */
const CORE_PROXY_PORTS = ['4420', '4421', '4422', '4423']

/**
 * Live-mode dev proxy (backend task 04_client_integration_spec §4.1, WT-1 to WT-3; 02_plan W05).
 * With `DEMS_CORE_PROXY_PORT` set, the dev server forwards `/api/v1` and `/ws` to the Core server on
 * `127.0.0.1:<port>`: the browser talks to one origin, so the session cookie stays same-origin.
 * Unset (or empty): no proxy, the dev server is as before. Any other value stops the dev server.
 *
 * SECURITY (WT-2, SD-07): an entry holds `target` (and `ws`) and NOTHING else. No `headers`, no
 * `changeOrigin`, no `rewriteWsOrigin`, no `configure`, `bypass` or `rewrite` hook: the Core server's
 * Origin guard must see the `Origin` and the `Cookie` exactly as the browser sent them.
 *
 * CORS (backend task decisions D29, F30): while the proxy is on, the dev server's own CORS layer is
 * off. It runs before the proxy, so it would add `Access-Control-Allow-Origin` to the Core server's
 * answers for any loopback origin and answer preflights itself; the Core server sends no such thing
 * (SR-04, OR-5). Without the variable nothing is returned, so Vite's default stays and Simulated-mode
 * dev is unchanged.
 */
/** A proxied path whose last segment is a bearer value: the media session (`mts_`), the export download (`exs_`) and the live camera preview (`cps_`, decisions D51 / D53). */
const SIGNED_PATH = /^\/(media|exports|preview)\/.*$/

/**
 * Review finding R93-09 (fix pass F-M8). Vite prints `http proxy error: <request url>` for every
 * proxy error, and the Core destroys a media connection ON PURPOSE when a fragment fails its tag
 * mid-stream (also at a Core restart): the token path would be in the dev server's output. This
 * listener is registered through the entry's `configure`, which Vite calls BEFORE it adds its own
 * `error` listener - so it runs first and blanks the path on the request Vite is about to print.
 * It changes nothing of a request that is forwarded: it acts only after the request has failed.
 */
export function blankSignedPathOnProxyError(forwarder: { on(event: 'error', listener: (error: unknown, request: unknown, response: unknown) => void): unknown }): void {
  const blank = (holder: unknown): void => {
    if (typeof holder !== 'object' || holder === null) return
    const request = holder as { url?: unknown }
    if (typeof request.url === 'string') request.url = request.url.replace(SIGNED_PATH, '/$1/[signed path not printed]')
  }
  forwarder.on('error', (_error, request, response) => {
    blank(request)
    blank((response as { req?: unknown } | null | undefined)?.req)
  })
}

function coreDevProxy(port: string | undefined): Pick<ServerOptions, 'proxy' | 'cors'> {
  if (port === undefined || port === '') return {}
  if (!CORE_PROXY_PORTS.includes(port)) {
    throw new Error(
      `DEMS_CORE_PROXY_PORT must be one of ${CORE_PROXY_PORTS.join(', ')} (got "${port}"). Unset it to run without the Core proxy.`,
    )
  }
  const target = `http://127.0.0.1:${port}`
  return {
    proxy: {
      '/api/v1': { target },
      '/ws': { target, ws: true },
      // Blueprint row 92 (M8): the media route of the signed media session (operation 88) is
      // registry-external like `/ws`; the player asks it same-origin, so the session cookie travels.
      // R93-09: a proxy error of a signed path is printed without the path.
      '/media': { target, configure: blankSignedPathOnProxyError },
      // Fix pass F-M8 (R93-05): the registry-external download route of a finished export, same-origin like `/media`.
      '^/exports/exs_': { target, configure: blankSignedPathOnProxyError },
      // Decisions D51 / D53: the registry-external live camera preview stream (`GET /preview/<token>`), same-origin like `/media`.
      // A preview the Core cuts (the sign-in session ended, the camera was lost) is a proxy error: its token path is blanked too.
      '/preview': { target, configure: blankSignedPathOnProxyError },
    },
    cors: false,
  }
}

// masterplan/01_specs.md §4.2. The router plugin must come before react() (02 L527).
// 06_packaging_spec §3.4 (step 100): `base` stays the default `/` and `build.sourcemap` stays off.
// `packagedCspPlugin` is build-only and acts only with VITE_DEMS_CORE_ORIGIN=same-origin (the
// packager); dev mode and the default build are unchanged.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), packagedCspPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // WT-3: the proxy (with its `cors: false`) exists in the dev server only. `vite build` never reads
  // the variable, and `vite preview`, which would otherwise inherit both from `server`, gets neither.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    ...(command === 'serve' && !isPreview ? coreDevProxy(process.env.DEMS_CORE_PROXY_PORT) : {}),
  },
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
}))
