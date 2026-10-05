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
import { CORE_API_OPERATIONS, SIM_ACTION_OPERATIONS, type CoreApiRegistryOperation } from '@dems/shared/api';
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
 * CONTRACT-GAP-3 (local adapter): `SIM_ACTION_OPERATIONS.deviceCommand` of the contract lists the
 * three operations and does not say which command reaches which. On the server each operation
 * runs exactly one command, so the link is this table. The keys are held to the contract's list
 * at compile time; a test holds each value to the path of its operation and to the action the
 * registry entry names. When the contract's table carries the link, read it there and delete
 * this constant.
 */
export const DEVICE_COMMAND_OF_OPERATION = {
  restartDevice: DeviceCommand.RESTART,
  testDeviceSignal: DeviceCommand.TEST_SIGNAL,
  identifyDevice: DeviceCommand.IDENTIFY,
} as const satisfies Record<DeviceCommandOperation, DeviceCommand>;

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function operationOf(operationId: DevicesOperation): CoreApiRegistryOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}
