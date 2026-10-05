/**
 * The permission guard: stage 6 of the request pipeline (plan row W28; hand-built element HB-7;
 * spec §2.3 stage 6, §4, §6.6, §7.3 lines 6 and 7, §12.1, §13.1; SR-13, SR-43 to SR-46, SR-71;
 * decisions D11 TD-07, D13, D52 DN-2, D64 DN-12, D78 DN-9).
 *
 * WHAT IT DOES, for every request that matched a route and passed stages 2 to 5, before the
 * body is read:
 *
 *   1. finds the access rule of the route. The rule is the contract registry's
 *      (`access-rules.ts`): a route cannot bring its own;
 *   2. decides (`decision.ts`): the principal the rule names, the permission, the conditions.
 *      An OPERATOR's permissions are the ones stage 4 read from PostgreSQL for THIS request;
 *      nothing is cached between requests (RB-2, RB-3);
 *   3. lets the request through, or refuses it:
 *        401 `NOT_SIGNED_IN`                   no row (no actor can be named, RB-6);
 *        403 `DEVICE_REVOKED`                  one `ACCESS_DENIED` row naming the device;
 *        403 `NOT_PERMITTED` (`FORBIDDEN` for  one `ACCESS_DENIED` row naming actor, operation,
 *            `exportEvidence`)                 permission and role; `EXPORT_DENIED` with its
 *                                              event for the three exports (RB-5);
 *        403 `DEVICE_NOT_PAIRED`               no row;
 *        403 `DEMO_DISABLED`                   no row, one log line (DC-2).
 *      An audited refusal first takes its place in the denial budget of the caller's key
 *      (`app.denialBudget.consume`, ID-P13): from the 21st within 60 s that call answers 429
 *      and nothing is written. Then the row is appended in its own unit of work and committed
 *      BEFORE the answer leaves. If the row cannot be written the request is still refused
 *      (503 `NOT_READY` when the database does not answer, 500 when the insert itself fails):
 *      no caller gets through because the audit trail could not be reached.
 *
 * DENY BY DEFAULT (RB-1, SR-43, AC-B-12). The plugin is registered before every unit that adds
 * a route, so its `onRoute` hook sees every route of every module and of the realtime channel.
 * A route that is no operation of the registry, or whose registry entry lacks an access rule
 * or an audit rule, stops `app.ready()` with an `AccessRuleError` that names it: the entry
 * point then exits before it listens. A registry operation whose route is NOT registered is no
 * concern of this check: the module rows add their routes one by one, and the conformance test
 * (plan row W52) compares the registered routes with the registry in both directions.
 *
 * WHERE A ROUTE WITHOUT A RULE IS STOPPED. Three places, the earliest that can see it:
 *
 *   1. `app.ready()`    every route registered once this plugin is loaded: every unit's, and
 *                       any plugin registered after the units. `AccessRuleError`, by route.
 *   2. `checkRouter()`  the first thing the boot step `rbac.matrix` does, before the listener
 *                       opens: EVERY route of the router, whenever it was added, read from
 *                       Fastify's printed route table (`router-table.ts`). This is what catches
 *                       a route that was added to the instance before the plugins ran, which
 *                       no `onRoute` hook of a plugin is ever shown. Such a route is held to
 *                       the registry by method and path; its `config.operationId` cannot be
 *                       read back from the router.
 *   3. the request      a route that reached the router without a rule all the same (an app
 *                       that was never booted: only a test) is refused with 500
 *                       `INTERNAL_ERROR`, logged with the code of the problem. A route that IS
 *                       a registry operation and was added early gets the registry's rule here.
 *
 * In the server's own start (`index.ts`: ready, boot, listen) no route is added before the
 * plugins run; a static test of this folder keeps route registration out of every file that is
 * loaded before the guard.
 *
 * FOR A MODULE ROW. Register each route from its registry entry (`routeOfOperation(id)`), check
 * no permission, no session and no device in the handler, and call
 * `app.engine.command(request.principal, …)`: for the 23 hosted actions that the simulator does
 * not check, this stage is the only check there is.
 *
 * FOR A TEST THAT IS NOT ABOUT STAGE 6: `app.stages.replace('accessRule', () => {})` BEFORE
 * `app.ready()`. The stage is then out of the pipeline and the route check is skipped with one
 * log line, so scratch routes work. Nothing outside a test replaces a stage (a static test of
 * this folder says so).
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `permissionGuardPlugin` keeps its name;
 * the stage handler is provided with `app.stages.provide('accessRule', handler)`.
 */
import { CoreApiAccessCondition, type CoreApiOperation } from '@dems/shared/api';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { consoleIdentityOf } from '../authenticate';
import { describeError, principalReference, routeOf } from '../logger';
import {
  AccessRuleError,
  createRuleBook,
  isAccessRule,
  refuseProblems,
  routeName,
  routePatternOf,
  type AccessRule,
  type AccessRuleProblem,
  type RuleBook,
} from './access-rules';
import { AccessRefusalKind, decideAccess, type AccessCaller, type AccessRefusal } from './decision';
import { denialRecordOf, refusalAnswer } from './denial';
import { checkStoredMatrix, readStoredMatrix, type StoredMatrix } from './matrix';
import { routesOfPrintedTable } from './router-table';

export {
  ANY_OF_SEPARATOR,
  AccessRuleError,
  AccessRuleErrorCode,
  EXPORT_DENIALS,
  FORBIDDEN_OPERATION,
  REALTIME_CHANNEL_ID,
  REALTIME_CHANNEL_RULE,
  RETIRED_DEVICE_OPERATIONS,
  compileAccessRule,
  createRuleBook,
  denialPermissionCode,
  isAccessRule,
  permissionsOfDenialCode,
  routePatternOf,
  type AccessRule,
  type AccessRuleProblem,
  type ExportDenialShape,
  type PermissionDenial,
  type RouteIdentity,
  type RuleBook,
} from './access-rules';
export {
  AccessRefusalKind,
  decideAccess,
  isAudited,
  type AccessCaller,
  type AccessDecision,
  type AccessRefusal,
} from './decision';
export { RETIRED_DEVICE_REASON, denialRecordOf, refusalAnswer, type DenialRecord } from './denial';
export { routesOfPrintedTable, type RouterRoute } from './router-table';
export {
  READ_STORED_MATRIX,
  checkStoredMatrix,
  firstGrantDifference,
  readStoredMatrix,
  roleMatrixOf,
  type GrantDifference,
  type MatrixReader,
  type StoredGrant,
  type StoredMatrix,
} from './matrix';

/** Label of the unit of work that appends a denial row. It appears in the pipeline's log lines. */
export const DENIAL_UNIT_LABEL = 'rbac.denied';

/** The stored matrix as the boot step last read it. */
export interface LoadedMatrix extends StoredMatrix {
  /** When it was read, by the server clock (epoch milliseconds). */
  readonly loadedAt: number;
}

/** What the guard offers beside its stage: for the RBAC module, the reset row and tests. */
export interface PermissionGuardControl {
  /** The rules of the contract registry, by route and by operation ID. */
  readonly rules: RuleBook;
  /** The rules of the routes that are registered in this app, in the order they were registered. */
  registeredRules(): readonly AccessRule[];
  /** What the boot check found wrong with the registered routes; empty for an app that started. */
  routeProblems(): readonly AccessRuleProblem[];
  /**
   * Holds EVERY route of the router against the registry, by method and path: also a route
   * that was added before this plugin ran and that the check of `app.ready()` never saw. Throws
   * an `AccessRuleError` that names each route without a rule (logged and written to the error
   * log). The boot step calls it before it reads the matrix. Does nothing but write one log
   * line when a test took stage 6 out of the pipeline.
   */
  checkRouter(): void;
  /** The stored matrix as last loaded; null until the boot step `rbac.matrix` has run. */
  matrix(): LoadedMatrix | null;
  /**
   * Reads the stored matrix again and checks it against the rules of the registered routes and
   * against the shared role table. Rejects with an `AccessRuleError` when a named permission is
   * not stored, when the stored vocabulary is not the shared one, or when the stored grants are
   * not exactly the shared role table (logged and written to the error log), and with the
   * driver's error when the database does not answer. The last matrix that passed stays in
   * `matrix()`.
   *
   * The boot step calls it, and the reset row after it has swapped the database. A role change
   * needs NO call: the decision reads the caller's permissions with every request.
   */
  reloadMatrix(): Promise<LoadedMatrix>;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it.
const controls = new WeakMap<object, PermissionGuardControl>();

/** The guard's controls of an app. Available after `ready()`, also when a test replaced the stage. */
export function permissionGuard(app: FastifyInstance): PermissionGuardControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the permission guard is not loaded: call it after app.ready()');
  return control;
}

/**
 * Method, path and operation ID of a route, from its registry entry: what a module passes to
 * `app.route({ ...routeOfOperation(operation), schema, handler })`. The guard accepts a route
 * only in this form.
 */
export function routeOfOperation(operation: Pick<CoreApiOperation, 'operationId' | 'method' | 'path'>): {
  method: 'GET' | 'POST';
  url: string;
  config: { operationId: string };
} {
  return {
    method: operation.method === 'get' ? 'GET' : 'POST',
    url: routePatternOf(operation.path),
    config: { operationId: operation.operationId },
  };
}

const ROUTES_REFUSED = 'a registered route has no access rule or no audit rule: the server does not start';
const ROUTER_UNREADABLE = 'the route table of the router could not be read: the server does not start';
const MATRIX_REFUSED = 'the stored role matrix does not fit the access rules';
const MATRIX_UNREADABLE = 'the stored role matrix could not be read';
const STAGE_REPLACED = 'the access rule stage was replaced: the route check is skipped and stage 6 guards no request of this app';
const REFUSED = 'request refused by the access rule';

/**
 * A list of problems for the persistent error log, as one text per member. Identifiers only:
 * codes, operations, route patterns, and what each problem says in words, which names
 * operations, permissions and roles and never anything a caller sent.
 */
function problemContext(problems: readonly AccessRuleProblem[]): { codes: string; operations: string; routes: string; details: string } {
  const join = (values: ReadonlyArray<string | null>, separator = ', '): string => [...new Set(values.filter((value) => value !== null))].join(separator);
  return {
    codes: join(problems.map((problem) => problem.code)),
    operations: join(problems.map((problem) => problem.operationId)),
    routes: join(problems.map((problem) => problem.route)),
    details: join(
      problems.map((problem) => problem.detail),
      '; ',
    ),
  };
}

export const permissionGuardPlugin: FastifyPluginAsync = async (app) => {
  const rules = createRuleBook();
  /** The rule of every registered route, by `METHOD pattern`. */
  const registered = new Map<string, AccessRule>();
  const problems: AccessRuleProblem[] = [];
  let loaded: LoadedMatrix | null = null;

  // RB-1. Synchronous and before every unit that adds a route (the order of `app.ts`).
  app.addHook('onRoute', (route) => {
    const methods = typeof route.method === 'string' ? [route.method] : route.method;
    for (const method of methods) {
      const resolved = rules.resolve({ method, url: route.url, operationId: route.config?.operationId });
      if (isAccessRule(resolved)) registered.set(routeName(method, route.url), resolved);
      else problems.push(resolved);
    }
  });

  /** The rule of the route a request matched. Refuses with 500 when the route has none. */
  function ruleOf(request: FastifyRequest): AccessRule {
    const url = request.routeOptions.url ?? '';
    const name = routeName(request.method, url);
    const known = registered.get(name);
    if (known !== undefined) return known;
    // Not seen at boot: the route was added before this plugin ran. A registry operation gets
    // its rule now; anything else is refused. The error envelope answers 500 `INTERNAL_ERROR`
    // and writes the code of this error to the log and to the persistent error log.
    const resolved = rules.resolve({ method: request.method, url, operationId: request.routeOptions.config.operationId });
    if (!isAccessRule(resolved)) throw new AccessRuleError([resolved]);
    registered.set(name, resolved);
    return resolved;
  }

  function callerOf(rule: AccessRule, request: FastifyRequest): AccessCaller {
    return {
      principal: request.principal,
      // Asked only where the rule needs it: it reads the Origin facts of stage 3.
      consoleIdentity: rule.conditions.includes(CoreApiAccessCondition.CONSOLE_IDENTITY) && consoleIdentityOf(app, request) !== null,
      demoControls: app.config.demoControls,
    };
  }

  /** The `{id}` of the path, when the rule has a pattern for it and the value matches. */
  function pathIdOf(rule: AccessRule, request: FastifyRequest): string | null {
    if (rule.idPattern === null) return null;
    const params: unknown = request.params;
    const id: unknown = typeof params === 'object' && params !== null && 'id' in params ? params.id : undefined;
    return typeof id === 'string' && rule.idPattern.test(id) ? id : null;
  }

  function logRefusal(request: FastifyRequest, rule: AccessRule, refusal: AccessRefusal, code: string, audited: boolean): void {
    request.log.warn(
      {
        code,
        route: routeOf(request),
        operationId: rule.operationId,
        access: rule.marker,
        principal: principalReference(request.principal),
        ...(refusal.kind === AccessRefusalKind.DEVICE_REVOKED ? { deviceId: refusal.deviceId } : {}),
        // What refused: a condition of the rule, or the marker DEVICE itself. Under a key of its
        // own: a log line has no member named `cause` or `reason` (standing rule M14).
        ...(refusal.kind === AccessRefusalKind.DEVICE_NOT_PAIRED ? { refusedBy: refusal.cause } : {}),
        audited,
      },
      REFUSED,
    );
  }

  const handler = async (request: FastifyRequest): Promise<void> => {
    const rule = ruleOf(request);
    const decision = decideAccess(rule, callerOf(rule, request));
    if (decision.allowed) return;

    const { refusal } = decision;
    const answer = refusalAnswer(rule, refusal);
    const record = denialRecordOf(rule, refusal, pathIdOf(rule, request));
    if (record !== null) {
      // The place first (ID-P13): from the 21st refusal of the key in 60 s this throws the 429,
      // and no row is written. Then the row, committed before the answer.
      await app.denialBudget.consume(request);
      await app.pipeline.run(DENIAL_UNIT_LABEL, async (unit) => {
        await unit.audit.append(record.audit);
        if (record.event !== null) await unit.events.append(record.event);
      });
    }
    // A 401 is on the request line with its code; a 403 gets one line that says which rule refused.
    if (refusal.kind !== AccessRefusalKind.NOT_SIGNED_IN) logRefusal(request, rule, refusal, answer.code, record !== null);
    throw answer;
  };
  app.stages.provide('accessRule', handler);

  /** Logs and persists what stops the start, then throws it. */
  function refuseRoutes(found: readonly AccessRuleProblem[], source: string): void {
    if (found.length === 0) return;
    app.log.error({ code: found[0]?.code, problems: found }, ROUTES_REFUSED);
    app.errorLog.append({ level: 'fatal', source, message: ROUTES_REFUSED, code: found[0]?.code, context: problemContext(found) });
    refuseProblems(found);
  }

  /** The rules of the routes of the router that `onRoute` did not show: by method and path. */
  const fromRouter = new Map<string, AccessRule>();

  const control: PermissionGuardControl = {
    rules,
    registeredRules: () => [...registered.values()],
    routeProblems: () => [...problems],
    checkRouter() {
      if (app.stages.get('accessRule') !== handler) {
        app.log.warn({ routes: registered.size, unchecked: problems.length }, STAGE_REPLACED);
        return;
      }
      let routes: ReturnType<typeof routesOfPrintedTable>;
      try {
        routes = routesOfPrintedTable(app.printRoutes());
      } catch (error) {
        // A table this server cannot read is a table it cannot vouch for.
        app.log.error({ code: 'ROUTER_TABLE_UNREADABLE' }, ROUTER_UNREADABLE);
        app.errorLog.append({ level: 'fatal', source: 'permissionGuard.checkRouter', message: ROUTER_UNREADABLE, ...describeError(error), code: 'ROUTER_TABLE_UNREADABLE' });
        throw error;
      }
      const found: AccessRuleProblem[] = [];
      for (const route of routes) {
        const name = routeName(route.method, route.url);
        if (registered.has(name)) continue;
        const resolved = rules.ruleAt(route.method, route.url);
        if (isAccessRule(resolved)) fromRouter.set(name, resolved);
        else found.push(resolved);
      }
      refuseRoutes(found, 'permissionGuard.checkRouter');
    },
    matrix: () => loaded,
    async reloadMatrix() {
      let matrix: StoredMatrix;
      try {
        matrix = await readStoredMatrix(app.db.pool);
      } catch (error) {
        // By its code only: a driver's message can quote a statement.
        const description = describeError(error);
        app.log.error({ code: description.code ?? description.errorName }, MATRIX_UNREADABLE);
        app.errorLog.append({ level: 'error', source: 'permissionGuard.reloadMatrix', message: MATRIX_UNREADABLE, ...description });
        throw error;
      }
      const found = checkStoredMatrix(matrix, [...registered.values(), ...fromRouter.values()]);
      if (found.length > 0) {
        const context = problemContext(found);
        app.log.error({ code: found[0]?.code, problems: found }, MATRIX_REFUSED);
        app.errorLog.append({ level: 'fatal', source: 'permissionGuard.reloadMatrix', message: MATRIX_REFUSED, code: found[0]?.code, context });
        refuseProblems(found);
      }
      loaded = { ...matrix, loadedAt: app.clock.now() };
      return loaded;
    },
  };
  controls.set(app.stages, control);

  app.addHook('onReady', async () => {
    if (app.stages.get('accessRule') !== handler) {
      app.log.warn({ routes: registered.size, unchecked: problems.length }, STAGE_REPLACED);
      return;
    }
    refuseRoutes(problems, 'permissionGuard.routes');
  });
};
