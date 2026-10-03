/// <reference types="vite/client" />

/**
 * Build-time env keys the app reads (06_packaging_spec §3.4). Vite copies `VITE_*` process env
 * into `import.meta.env`; no `.env.*` file is used, so dev mode never sets these.
 */
interface ImportMetaEnv {
  /**
   * `same-origin` only in the packaged build (`VITE_DEMS_CORE_ORIGIN=same-origin vite build`):
   * the Core REST and `/ws` addresses then follow `window.location`. Unset (dev, tests) keeps
   * `http://127.0.0.1:4400`. Read through `src/lib/core-endpoint.ts`, never directly.
   */
  readonly VITE_DEMS_CORE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
