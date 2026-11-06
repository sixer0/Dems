/**
 * CLASS C — the production PoE controller, adapter kind `SNMP_POE` (blueprint row 65; register
 * NM-09; OD-07: SNMP, RFC 3621; structured §9 C-3).
 *
 * An INTERFACE-COMPLETE STUB: no datagram is sent. Loaded by `adapters/real.ts` only, and never
 * in a test.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import type { CaptureDeviceEntry, PoeController } from '../types';

export function createSnmpPoeController(devices: readonly CaptureDeviceEntry[]): PoeController {
  const classC = async (): Promise<never> => {
    throw new CaptureAdapterError(CaptureAdapterRefusal.CLASS_C_NOT_BUILT, devices[0]?.id ?? null);
  };
  return { seam: 'POE', kind: CaptureAdapterKind.SNMP_POE, devices: Object.freeze([...devices]), status: classC, cycle: classC };
}
