/**
 * Which simulator actions the engine host runs (plan row W26; spec §7.17, §8.1).
 *
 * The list is not written here: it is read from contract C's table `SIM_ACTION_OPERATIONS`
 * (`@dems/shared/api`), which maps each of the 48 members of `SimActions` to its operations and
 * its way of execution. 33 are HOSTED: the server calls the shared action under the caller's
 * identity. Five are INTERNAL (`setTabletLink`, since task 3 register SH-18
 * `applyCaptureTelemetry`, `raiseCaptureWarning` and `clearCaptureWarning`, and since task 3 R-9
 * `registerCaptureDevice`): hosted, but no client may call them; the host has a function of its own
 * for each (`registerCaptureDevice`: inside a module's unit, `internal-actions.ts`). The other ten are never called on the engine (the
 * sign-in actions, `signOut`, `touch`, `pair`, `unpair`, `loadScenario`, `resetDemo`).
 * Task 4 row 185 added one more INTERNAL member, `registerCaptureMicrophone` (inside the unit of
 * operation 99, `internal-actions.ts`): the hosted 33 are unchanged.
 */
import { SIM_ACTION_OPERATIONS, SimActionExecution, type SimActionName } from '@dems/shared/api';
import type { SimActions } from '@dems/shared/sim';

type ExecutionOf<Name extends SimActionName> = (typeof SIM_ACTION_OPERATIONS)[Name]['execution'];

/** The 33 actions a module may run through `engine.command` (spec §7.17, execution "hosted"). */
export type HostedActionName = {
  [Name in SimActionName]: ExecutionOf<Name> extends typeof SimActionExecution.HOSTED ? Name : never;
}[SimActionName];

/** What the action takes and returns: the simulator's own signature. */
export type HostedActionArguments<Action extends HostedActionName> = Parameters<SimActions[Action]>;
export type HostedActionResult<Action extends HostedActionName> = ReturnType<SimActions[Action]>;

/** The hosted action names, in the order of `SimActions`. */
export const HOSTED_ACTIONS = (Object.keys(SIM_ACTION_OPERATIONS) as SimActionName[]).filter(
  (name) => SIM_ACTION_OPERATIONS[name].execution === SimActionExecution.HOSTED,
) as readonly HostedActionName[];

const HOSTED: ReadonlySet<string> = new Set(HOSTED_ACTIONS);

/** True for one of the 33 hosted actions. Checked at run time too: a name can come from data. */
export function isHostedAction(name: string): name is HostedActionName {
  return HOSTED.has(name);
}

/** The hosted actions that reach `operationId`: one for most operations, two for `updateSettings`. */
export function hostedActionsOfOperation(operationId: string): HostedActionName[] {
  return HOSTED_ACTIONS.filter((name) => (SIM_ACTION_OPERATIONS[name].operations as readonly string[]).includes(operationId));
}
