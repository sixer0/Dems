/**
 * The operations of the demo-control module, read from the contract registry (plan row W43;
 * spec §7.16, §7.17 members 26, 27, 30 and 31).
 *
 *   #   operationId     method and path                      how it runs
 *   71  getDemoStatus   GET  /api/v1/demo/status             a read: the engine's committed state and one row of `core_state`
 *   72  loadScenario    POST /api/v1/demo/scenario           server-native: the reset routine with the named scenario
 *   73  injectFault     POST /api/v1/demo/faults             hosted: inject(kind, target?)
 *   74  clearFault      POST /api/v1/demo/faults/clear       hosted: clearFault(kind, target?)
 *   75  resetDemo       POST /api/v1/demo/reset              server-native: the reset routine with the scenario `idle`
 *
 * Method, path, access rule and audit rule are the registry's: this file names the operations
 * and nothing about who may call them.
 */
import { findCoreApiOperation, type CoreApiRegistryOperation } from '@dems/shared/api';
import { ScenarioName } from '@dems/shared/sim';

/** The operations this module answers, in registry order (operations 71 to 75). */
export const DEMO_MODULE_OPERATIONS = ['getDemoStatus', 'loadScenario', 'injectFault', 'clearFault', 'resetDemo'] as const;
export type DemoModuleOperation = (typeof DEMO_MODULE_OPERATIONS)[number];

/** The two operations that run the reset routine of the database. */
export type ResetOperation = 'loadScenario' | 'resetDemo';

/**
 * `reason` of the lineage row a reset writes for the chain it discards (database contract
 * §4.30): what the routine is told about why it runs.
 */
export const RESET_REASON_OF_OPERATION = {
  loadScenario: 'SCENARIO_LOAD',
  resetDemo: 'RESET',
} as const satisfies Record<ResetOperation, 'RESET' | 'SCENARIO_LOAD'>;

/** `resetDemo` is the scenario `idle` (spec §12.4). */
export const RESET_DEMO_SCENARIO = ScenarioName.IDLE;

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function operationOf(operationId: DemoModuleOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}
