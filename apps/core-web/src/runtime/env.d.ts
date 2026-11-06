/// <reference types="vite/client" />

/**
 * Build-time env key of the data mode (backend task 04_client_integration_spec §3.1, MD-2 rule
 * 3; plan row W50). It merges with the declaration in `src/env.d.ts`.
 */
interface ImportMetaEnv {
  /**
   * `live` or `simulated`: the mode a dev server preselects when nothing is stored (a lane starts
   * Vite with `VITE_DEMS_CORE_MODE=live`). Any other value counts as absent. Ignored by a
   * production or packaged build. Read through `src/runtime/boot.ts`, never directly.
   */
  readonly VITE_DEMS_CORE_MODE?: string
}
