/**
 * The fake PoE controller (blueprint row 65; check M4-FAKE-1; capture spec §A.6 "Test hook").
 * Adapter kind `FAKE`: it remembers the power state of its ports and records every cycle. It
 * decides nothing: whether a cycle is allowed is the devices module's (OD-22, CS-06).
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import { PoePortStatus, type CaptureCapability, type PoeController } from '../types';

export interface FakePoeOptions {
  readonly id: string;
  readonly label?: string;
  /** The port codes the switch serves (the `poePort` of the cameras' registry rows). */
  readonly ports: readonly string[];
  readonly capabilities?: readonly CaptureCapability[];
}

export interface FakePoeController extends PoeController {
  /** Every cycle, in order, by port code. */
  readonly cycles: string[];
  setStatus(port: string, status: PoePortStatus): void;
}

export function createFakePoeController(options: FakePoeOptions): FakePoeController {
  const state = new Map<string, PoePortStatus>(options.ports.map((port) => [port, PoePortStatus.POWERED]));
  const cycles: string[] = [];
  const known = (port: string): void => {
    if (!state.has(port)) throw new CaptureAdapterError(CaptureAdapterRefusal.POE_PORT_UNKNOWN, options.id);
  };
  return {
    seam: 'POE',
    kind: CaptureAdapterKind.FAKE,
    devices: Object.freeze([Object.freeze({ id: options.id, deviceClass: 'POE' as const, label: options.label ?? options.id, capabilities: Object.freeze([...(options.capabilities ?? (['SNMP'] as const))]), profiles: Object.freeze([]) })]),
    cycles,
    async status(port) {
      known(port);
      return state.get(port) ?? PoePortStatus.UNKNOWN;
    },
    async cycle(port) {
      known(port);
      cycles.push(port);
      // Off and on again: a cycle ends powered, whatever the port was.
      state.set(port, PoePortStatus.POWERED);
    },
    setStatus(port, status) {
      known(port);
      state.set(port, status);
    },
  };
}
