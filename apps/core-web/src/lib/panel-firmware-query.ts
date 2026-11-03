/**
 * The panel firmware query of the console: one definition of the key `['panel-firmware']`
 * (`PANEL_FIRMWARE_QUERY_KEY`), the sibling of `health-query.ts`.
 *
 * Operation 114 `getPanelFirmware` is the third PUBLIC read of the registry: the sign-in screen shows
 * the firmware word of the front panel, and a sign-in screen has no session yet. The answer comes from
 * the console's one panel reader, `fetchCorePanelFirmware()` (the page's own origin in Live mode), and
 * holds two strings — nothing of a session, nothing of evidence.
 *
 * As with health, the key and its `queryFn` are defined ONCE here (FXR-W, W92-8); each reader adds
 * what its own screen needs (`enabled`, an interval, `retry: false`).
 */
import { queryOptions } from '@tanstack/react-query'
import { PANEL_FIRMWARE_QUERY_KEY } from '@dems/shared/api'
import { fetchCorePanelFirmware } from '@/lib/core-endpoint'

export { PANEL_FIRMWARE_QUERY_KEY }

/** The key `['panel-firmware']` and its one `queryFn`. */
export function panelFirmwareQueryOptions() {
  return queryOptions({ queryKey: PANEL_FIRMWARE_QUERY_KEY, queryFn: () => fetchCorePanelFirmware() })
}
