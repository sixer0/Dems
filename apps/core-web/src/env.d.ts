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
  /**
   * The production console lock (audit register S1/S5; D25 N3, D29 Q6): exactly `1` in the
   * `dems-console` unit (`Environment=VITE_DEMS_PRODUCTION_LOCK=1`). The console then runs LIVE and
   * offers no Simulated mode. Any other value, or absent (lanes, developer runs, tests), is off.
   * Read through `src/runtime/boot.ts`, never directly.
   */
  readonly VITE_DEMS_PRODUCTION_LOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
