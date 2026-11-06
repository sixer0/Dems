/**
 * Login reads over the Core server (backend task 04_client_integration_spec §5.5 WS-5; plan row
 * W55). The counterpart of `./sim-adapter` for Live mode. Light: it loads neither the typed client
 * nor the Live source (types only).
 *
 * - **Health** (`useLiveCoreHealth`). An anonymous client receives no Core state, so the device
 *   strip shows what is public: the service, its version and its readiness. The answer comes from
 *   the console's one health reader, `fetchCoreHealth()` (the page's own origin in Live mode),
 *   under the shared key `['health']`, which the query bridge refetches after a resync. Nothing is
 *   asked in Simulated mode (`enabled` is false there). The key and its `queryFn` are the one
 *   definition of `lib/health-query.ts` (FXR-W, W92-8); this observer adds its own interval and
 *   `retry: false`.
 *
 * - **Panel firmware** (`useLivePanelFirmware`). The seventh cell of the same strip: the version the
 *   front panel states about itself (operation 114), which is PUBLIC for exactly the reason above —
 *   the screen that shows it has no session yet. Its key and `queryFn` are `lib/panel-firmware-query.ts`;
 *   this observer adds `retry: false` and `PANEL_FIRMWARE_REFETCH_MS`. That interval is slow on purpose:
 *   an anonymous request of a Live console counts in the STRICT throttle bucket of its class (30 per
 *   minute, stage 5), and a sign-in screen must not spend that budget on a version string.
 *
 * The presentation-mode follow-up of WS-10 used to be here. It runs on every route, so decision
 * D144(4) (finding CPW1-4) moved it to `runtime/presentation-follow.ts`, beside `query-bridge.ts`,
 * where the root route installs it.
 */
import { useQuery } from '@tanstack/react-query'
import { healthQueryOptions } from '@/lib/health-query'
import { panelFirmwareQueryOptions } from '@/lib/panel-firmware-query'
import { HEALTH_REFETCH_MS, HEALTH_STARTING_REFETCH_MS, isCoreStarting } from './login-live-model'

/** How often the panel firmware answer is asked for again. Slower than health on purpose (see above). */
export const PANEL_FIRMWARE_REFETCH_MS = 30_000

/**
 * The health answer of the Core server, for the Login page in Live mode. No retry of its own: the
 * heartbeat says whether the Core is reachable, and the answer is asked for again on the interval.
 */
export function useLiveCoreHealth(enabled: boolean) {
  return useQuery({
    ...healthQueryOptions(),
    enabled,
    retry: false,
    refetchInterval: (query) => (isCoreStarting(query.state.data) ? HEALTH_STARTING_REFETCH_MS : HEALTH_REFETCH_MS),
  })
}

/**
 * The firmware word of the attached front panel (operation 114), for the Login page in Live mode.
 * PUBLIC, so no session is waited for — this hook runs while the caller is still anonymous. No retry
 * of its own: an unreachable Core is answered again on the interval, and a Core that cannot see its
 * panel answers `200` with empty words, which is a SUCCESS here (the cell shows "unknown", not an error).
 */
export function useLivePanelFirmware(enabled: boolean) {
  return useQuery({
    ...panelFirmwareQueryOptions(),
    enabled,
    retry: false,
    refetchInterval: PANEL_FIRMWARE_REFETCH_MS,
  })
}
