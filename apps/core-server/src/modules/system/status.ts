/**
 * Operation 64 `getSystemStatus`: the five slices of the system page (plan row W40; spec §7.14;
 * contract `SystemStatus` in `packages/shared/src/api/system.ts`).
 *
 * The answer holds `device`, `services`, `update`, `diagnostics` and `settings` in their wire
 * form (API-6), each under its slice name, all five from ONE committed state. Nothing is
 * computed: the uptime of a service, the progress of an update and the result of a diagnostics
 * check are in the slices as the engine wrote them (`startedAt`, `steps`, `checks`).
 *
 * No live meter value is needed for any member: a diagnostics check holds the verdict the
 * engine reached from the committed hardware state when the check resolved.
 *
 * Pure: it reads the five slices it is given and changes none of them.
 */
import type { SystemStatus } from '@dems/shared/api';
import type { SimState } from '@dems/shared/sim';

/** The five slices of the answer: all from ONE committed state. */
export type SystemStatusSource = Pick<SimState, 'device' | 'services' | 'update' | 'diagnostics' | 'settings'>;

export function systemStatusOf(state: SystemStatusSource): SystemStatus {
  return {
    device: state.device,
    services: state.services,
    update: state.update,
    diagnostics: state.diagnostics,
    settings: state.settings,
  };
}
