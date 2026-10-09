/**
 * The operations of the devices module, read from the contract registry, and the one link the
 * registry does not hold yet (plan row W36; spec §7.10, §7.17).
 *
 *   #   operationId          method and path                          hosted action
 *   44  getDeviceHealth      GET  /api/v1/device/health               reads
 *   45  getAudioStatus       GET  /api/v1/audio/status                reads
 *   46  getVideoStatus       GET  /api/v1/video/status                reads
 *   47  getDeviceInventory   GET  /api/v1/device/inventory            reads
 *   48  restartDevice        POST /api/v1/device/{id}/restart         deviceCommand(id, RESTART)
 *   49  testDeviceSignal     POST /api/v1/device/{id}/test-signal     deviceCommand(id, TEST_SIGNAL)
 *   50  identifyDevice       POST /api/v1/device/{id}/identify        deviceCommand(id, IDENTIFY)
 *   51  setActiveCamera      POST /api/v1/video/active-camera         setActiveCamera(cameraId)
 *   52  resetMicClip         POST /api/v1/audio/clip/reset            resetClip(channel)
 *
 * Method, path, access rule and audit rule are the registry's: this file names the operations
 * and nothing about them.
 */
import { CORE_API_OPERATIONS, DEVICE_COMMAND_OPERATIONS, SIM_ACTION_OPERATIONS, type CoreApiRegistryOperation } from '@dems/shared/api';
// Value and type: the PoE-cycle filter below reads the enum's member.
import { DeviceCommand } from '@dems/shared/sim';

/** The operations this module answers, in registry order (operations 44 to 52). */
export const DEVICES_OPERATIONS = [
  'getDeviceHealth',
  'getAudioStatus',
  'getVideoStatus',
  'getDeviceInventory',
  'restartDevice',
  'testDeviceSignal',
  'identifyDevice',
  'setActiveCamera',
  'resetMicClip',
] as const;
export type DevicesOperation = (typeof DEVICES_OPERATIONS)[number];

/** The three operations the contract lists for the simulator action `deviceCommand`. */
export type DeviceCommandOperation = (typeof SIM_ACTION_OPERATIONS)['deviceCommand']['operations'][number];

/**
 * Which `DeviceCommand` each of the three operations of `deviceCommand` runs.
 *
 * The contract's table `DEVICE_COMMAND_OPERATIONS` (command -> operation), inverted (W83 closed
 * the local adapter of gap 3; review finding W91-12: derived, not restated; the name stays for
 * this module's callers). On the server each operation runs exactly one command. The contract
 * table's type holds its keys to `DeviceCommand` and its values to the action's operations; a test
 * holds each value to the path of its operation and to the action the registry entry names.
 */
export const DEVICE_COMMAND_OF_OPERATION: Readonly<Record<DeviceCommandOperation, DeviceCommand>> = Object.freeze(
  // Task 3 M2-W7 (E-12; C3 §0): POE_CYCLE joins the contract table and reaches restartDevice too —
  // operation 48 decides RESTART versus PoE cycle from the body and the stream state, so the
  // per-operation command of the ACTION stays RESTART. The inversion keeps the three commands the
  // deviceCommand action itself carries; the PoE-cycle audit value is written by the server-side
  // path that performs the cycle (details.command: POE_CYCLE, C3 §5.3), not by this map.
  Object.fromEntries(
    (Object.entries(DEVICE_COMMAND_OPERATIONS) as [DeviceCommand, DeviceCommandOperation][])
      .filter(([command]) => command !== DeviceCommand.POE_CYCLE)
      .map(([command, operationId]) => [operationId, command]),
  ) as Record<DeviceCommandOperation, DeviceCommand>,
);

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function operationOf(operationId: DevicesOperation): CoreApiRegistryOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}
