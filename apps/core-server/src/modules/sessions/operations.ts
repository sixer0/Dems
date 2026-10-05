/**
 * The operations of the sessions module and what binds each to the contract (plan row W34; spec
 * §7.8, §7.17; contract `packages/shared/src/api/core-api.ts` for operations 24 to 27 and
 * `sessions.ts` for 28 to 38).
 *
 * Nothing of the contract is typed a second time here:
 *
 *   method, path     the registry entry (`operationOf`), handed to `routeOfOperation`;
 *   hosted action    the contract's table `SIM_ACTION_OPERATIONS`, read through the engine's
 *                    `hostedActionsOfOperation` (`actionOf`). Its TYPE comes from the same table,
 *                    so the arguments a handler passes are checked against the action the table
 *                    names: an operation that is re-bound there does not compile here;
 *   success status   a handler names the statuses it answers, and `successesOf` holds them
 *                    against the 2xx statuses the registry documents when the routes are
 *                    registered: both lists must be equal;
 *   body schema      a body that is validated in the handler is validated with the schema the
 *                    registry names for it (`bodySchemaOf`).
 *
 * A change of the contract that this module does not follow therefore stops the boot (the plugin
 * function throws) instead of sending an answer the contract does not document.
 */
import { CORE_API_OPERATIONS, CORE_API_SCHEMAS, SIM_ACTION_OPERATIONS, type CoreApiRegistryOperation } from '@dems/shared/api';
import { hostedActionsOfOperation, type HostedActionName } from '../../engine';

/** The operations this module answers, in registry order: 24 to 38 of spec §7.8. */
export const SESSION_OPERATION_IDS = [
  'createSession',
  'startSession',
  'stopSession',
  'getCurrentSession',
  'beginPrecheck',
  'retryPrecheck',
  'acknowledgePrecheckWarnings',
  'cancelSession',
  'scanCaseNumber',
  'recoverSession',
  'addSessionMarker',
  'addSessionNote',
  'takeSessionSnapshot',
  'acknowledgeSessionSummary',
  'listSessionHistory',
] as const;
export type SessionOperationId = (typeof SESSION_OPERATION_IDS)[number];

/** The two reads: no hosted action, no state change. */
export const SESSION_READ_IDS = ['getCurrentSession', 'listSessionHistory'] as const satisfies readonly SessionOperationId[];
export type SessionReadId = (typeof SESSION_READ_IDS)[number];
/** The thirteen commands: each runs hosted actions of the simulator as one unit of work. */
export type SessionCommandId = Exclude<SessionOperationId, SessionReadId>;

/** The registry entry of an operation of this module. Throws for a name the registry does not hold. */
export function operationOf(operationId: SessionOperationId): CoreApiRegistryOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

type OperationsOf<Action extends HostedActionName> = (typeof SIM_ACTION_OPERATIONS)[Action]['operations'][number];

/** The hosted action the contract's table binds to an operation, as a type. */
export type ActionOf<Operation extends string> = {
  [Action in HostedActionName]: Operation extends OperationsOf<Action> ? Action : never;
}[HostedActionName];

/**
 * The hosted action of a command, read from the contract's table. Exactly one action reaches
 * each command of this module; anything else is a contract this module was not written for.
 */
export function actionOf<Operation extends SessionCommandId>(operationId: Operation): ActionOf<Operation> {
  const actions = hostedActionsOfOperation(operationId);
  const [action] = actions;
  if (action === undefined || actions.length !== 1) {
    throw new Error(`the contract binds ${actions.length} hosted actions to ${operationId}; the sessions module expects exactly one`);
  }
  return action as ActionOf<Operation>;
}

/**
 * `schema`, when it is the very schema the registry names for the request body of the operation.
 * Throws otherwise. For the two operations whose body is validated in the handler (`text-body.ts`)
 * and not as the route's body schema: the schema applied there is still the contract's.
 */
export function bodySchemaOf<Schema>(operationId: SessionOperationId, schema: Schema): Schema {
  const name = operationOf(operationId).requestBody?.schema;
  if (name === undefined || CORE_API_SCHEMAS[name] !== schema) {
    throw new Error(`the contract names ${name ?? 'no schema'} for the request body of ${operationId}; the sessions module validates it with another one`);
  }
  return schema;
}

/** The 2xx statuses the registry documents for an operation, ascending. */
export function successStatusesOf(operationId: SessionOperationId): number[] {
  return Object.keys(operationOf(operationId).responses)
    .map(Number)
    .filter((status) => status >= 200 && status < 300)
    .sort((a, b) => a - b);
}

/**
 * `statuses`, when they are EXACTLY the 2xx statuses the registry documents for the operation.
 * Throws otherwise: a success the module would send undocumented, or a documented one it never
 * sends, is a contract this module was not written for.
 */
export function successesOf<const Statuses extends readonly number[]>(operationId: SessionOperationId, statuses: Statuses): Statuses {
  const documented = successStatusesOf(operationId);
  const answered = [...statuses].sort((a, b) => a - b);
  if (documented.length !== answered.length || documented.some((status, index) => status !== answered[index])) {
    throw new Error(`the contract documents the successes [${documented.join(', ')}] for ${operationId}; the sessions module answers [${answered.join(', ')}]`);
  }
  return statuses;
}
