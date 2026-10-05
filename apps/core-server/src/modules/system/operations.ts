/**
 * The operations of the system module, read from the contract registry (plan row W40; spec
 * §7.14, §7.17 members 32, 35, 36, 38, 39).
 *
 *   #   operationId           method and path                        hosted action
 *   64  getSystemStatus       GET  /api/v1/system/status             reads
 *   65  runDiagnostics        POST /api/v1/system/diagnostics        runDiagnostics()
 *   66  restartServices       POST /api/v1/system/services/restart   restartServices()
 *   67  startSoftwareUpdate   POST /api/v1/system/update             startSoftwareUpdate()
 *   68  updateSettings        POST /api/v1/settings                  updateSettings(patch)
 *
 * Method, path, access rule and audit rule are the registry's: this file names the operations
 * and the hosted action of each command, and nothing else about them.
 */
import { CORE_API_OPERATIONS, type CoreApiRegistryOperation } from '@dems/shared/api';

/** The operations this module answers, in registry order (64 to 68). */
export const SYSTEM_MODULE_OPERATIONS = ['getSystemStatus', 'runDiagnostics', 'restartServices', 'startSoftwareUpdate', 'updateSettings'] as const;
export type SystemModuleOperation = (typeof SYSTEM_MODULE_OPERATIONS)[number];

/**
 * The hosted simulator action behind each command (spec §7.17). For operation 68 the contract's
 * table names two actions, `updateSettings` and `setPresentationMode`: the second is the first
 * with the one member `presentationMode` (`sim/actions.ts`), and a request body may name any of
 * the four members, so the route runs `updateSettings` for every body.
 */
export const SYSTEM_ACTION_OF_OPERATION = {
  runDiagnostics: 'runDiagnostics',
  restartServices: 'restartServices',
  startSoftwareUpdate: 'startSoftwareUpdate',
  updateSettings: 'updateSettings',
} as const satisfies Partial<Record<SystemModuleOperation, string>>;

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function registryEntry(operationId: SystemModuleOperation): CoreApiRegistryOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}
