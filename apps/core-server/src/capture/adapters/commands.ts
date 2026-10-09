/**
 * Which adapter seam carries each device command (blueprint row 65; register CS-06, E-12; capture
 * spec §A.1 "the device-contract commands whose map is derived from the contract, never restated").
 *
 * The commands are the keys of the contract table `DEVICE_COMMAND_OPERATIONS`
 * (`@dems/shared/api`); the operation of each command is that table's, and the Core's
 * operation-to-command map `DEVICE_COMMAND_OF_OPERATION` (`modules/devices/operations.ts`) is
 * that table inverted. This file adds the ONE fact the contract does not hold: which seam a
 * command reaches when capture is real. It is typed by the contract's keys, so a command that
 * joins the contract table does not compile here until it is given a seam (E-12: a new device
 * command is a contract-table entry), and it lists no operation.
 */
import { DEVICE_COMMAND_OPERATIONS } from '@dems/shared/api';

export type CaptureDeviceCommand = keyof typeof DEVICE_COMMAND_OPERATIONS;

/** `DEVICE`: the adapter of the device the operation names. `POE`: the PoE controller, for the port that device's row names. */
export type CaptureCommandSeam = 'DEVICE' | 'POE';

export const SEAM_OF_DEVICE_COMMAND = Object.freeze({
  RESTART: 'DEVICE',
  TEST_SIGNAL: 'DEVICE',
  IDENTIFY: 'DEVICE',
  POE_CYCLE: 'POE',
} as const satisfies Record<CaptureDeviceCommand, CaptureCommandSeam>);

/** The commands of the contract table, in its order. */
export const CAPTURE_DEVICE_COMMANDS: readonly CaptureDeviceCommand[] = Object.freeze(Object.keys(DEVICE_COMMAND_OPERATIONS) as CaptureDeviceCommand[]);

/** The operation a command is reached through: read from the contract table, never restated. */
export function operationOfDeviceCommand(command: CaptureDeviceCommand): (typeof DEVICE_COMMAND_OPERATIONS)[CaptureDeviceCommand] {
  return DEVICE_COMMAND_OPERATIONS[command];
}
