/**
 * `pairedDevices.*`: the Paired Devices page, `/admin/devices` (backend task
 * 04_client_integration_spec §10.1 PG-10, §10.3). Live mode only. Plan row W54 wrote the words of
 * the page stub; the page row (W81) adds the key families of §10.3: `summary`, `issue.*`,
 * `devices.*`, `revoke.*`, `toasts.*` and the other `states.*`. The navigation label is
 * `shell.nav.pairedDevices`.
 */
import type { ResourceTree } from '../resource-tree';

export const pairedDevices = {
  title: 'Paired Devices',
  subtitle: 'Tablets and phones allowed to operate this Core',

  states: {
    /** Under the heading `shell.liveOnly.title`. */
    liveOnly: 'Simulated mode has no device registry and issues no pairing code. Devices are paired with the Core server.',
  },
} as const satisfies ResourceTree;
