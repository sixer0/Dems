/**
 * Test support of the permission guard (plan row W28; not a test file). Other rows import it.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/plugins/permission-guard/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 * `passScratchRoutes` is in `./scratch-routes` (re-exported below): the identity support needs it,
 * and this file needs the identity support, so it could not stay here without a cycle.
 *
 * FOR A TEST OF ANOTHER STAGE OR MODULE THAT ADDS SCRATCH ROUTES TO THE REAL APP. A scratch
 * route is no operation of the contract registry, so stage 6 refuses it (deny by default). Two
 * ways to keep such a test about what it tests:
 *
 *   `app.stages.replace('accessRule', () => {})`   the whole stage is out of the pipeline. Before
 *                                                   `app.ready()` it also skips the boot check,
 *                                                   which a scratch route inside a child plugin
 *                                                   needs; after it, it is enough for scratch
 *                                                   routes that were added to the app directly.
 *   `passScratchRoutes(app)`, after `app.ready()`   only routes that are no registry operation
 *                                                   pass; every registry route (sign-in, the
 *                                                   session operations, …) keeps the REAL guard.
 *
 * FOR A TEST OF THE GUARD, or of a module behind it: `guardApp` and `registryRoutes` build the
 * real app with stand-in handlers for registry operations that have no route in that app.
 *
 * THE MODULES LAND ONE BY ONE (decision D85). No test that uses this file may depend on WHICH
 * operations a module has registered, and a stand-in route for a registry operation never
 * stands beside a module's route (rule M10). Two kinds of test app:
 *
 *   WITHOUT THE DOMAIN MODULES   the test file imports `./without-domain-modules` first. The
 *                                operations it calls get stand-ins, whose handlers it may
 *                                assert on (`GuardApp.reached`): no module can own them there.
 *                                `registryRoutes` still adds a stand-in only where the app has
 *                                no route, for the operations of the units that stay real;
 *   THE REAL APP                 the test registers nothing and names no module's operation.
 *                                It reads what is registered (`registeredRules()`) and asks
 *                                only what does not depend on a handler: a refusal of stage 6,
 *                                and whether stage 6 let a request through (`recordPassed`: a
 *                                hook after the stages and before the body is read). A POST
 *                                that only has to show "allowed" is sent with a body that is
 *                                no JSON (`MALFORMED_JSON`): refused by stage 6 it answers 401
 *                                or 403, let through it answers 400 `INVALID_JSON` at stage 7,
 *                                and no handler of any module runs.
 */
import type { CoreApiOperation } from '@dems/shared/api';
import { CORE_API_OPERATIONS, WS_PATH } from '@dems/shared/api';
import { createManualClock } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../../src/app';
import type { DatabaseConnection, ListenPort, LogLevel } from '../../src/config';
import {
  CLOCK_START,
  bearer,
  cookieValue,
  deviceRegistryDouble,
  deviceSignIn,
  webSignIn,
  type DeviceRegistryDouble,
  type Headers,
} from './identity';
import { captureLog, unitTestConfig, type CapturedLog } from './config';
import { routeOfOperation } from '../../src/plugins/permission-guard';

export { passScratchRoutes } from './scratch-routes';

/** The registry entry of an operation. Throws for a name the registry does not hold. */
export function operationOf(operationId: string): CoreApiOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** What a stand-in handler of `registryRoutes` answers, and what it saw. */
export interface StandInAnswer {
  readonly reached: string;
}

/**
 * Adds a stand-in route for each named registry operation that has NO route in the app yet:
 * method, path and `config.operationId` are the registry's, so the guard applies the registry's
 * rule; the handler only says that it was reached. An operation that a module has registered
 * keeps its real route. Returns the operations a stand-in was added for.
 *
 * Call it from a plugin that is registered after the units (`guardApp` does), so that the
 * routes of every unit exist when it looks. At the top level, before the plugins ran, no unit's
 * route exists yet: use it there only for an operation that no unit of that app registers (a
 * domain operation, in an app without the domain modules).
 */
export function registryRoutes(app: FastifyInstance, operationIds: readonly string[], reached: string[] = []): string[] {
  const added: string[] = [];
  for (const operationId of operationIds) {
    const route = routeOfOperation(operationOf(operationId));
    if (app.hasRoute({ method: route.method, url: route.url })) continue;
    app.route({
      ...route,
      handler: async (): Promise<StandInAnswer> => {
        reached.push(operationId);
        return { reached: operationId };
      },
    });
    added.push(operationId);
  }
  return added;
}

/**
 * Adds a stand-in for the socket route, `GET /ws`, when the realtime channel has not registered
 * it (plan row W42). Returns whether it was added.
 */
export function channelRoute(app: FastifyInstance): boolean {
  if (app.hasRoute({ method: 'GET', url: WS_PATH })) return false;
  app.get(WS_PATH, async () => ({ channel: true }));
  return true;
}

/** A request that stage 6 let through: recorded after the stages, before the body is read. */
export interface PassedRequest {
  /** `config.operationId` of the route; null for a route that names none (the socket). */
  readonly operationId: string | null;
  /** `METHOD pattern`, for example `GET /ws`. */
  readonly route: string;
  /** Who stage 4 resolved the caller to. */
  readonly principal: 'ANONYMOUS' | 'DEVICE' | 'OPERATOR';
}

/**
 * Records every request that passed the request stages: a `preParsing` hook, which runs after
 * the one `onRequest` hook of the stages and before the body is read. A request a stage refused
 * never gets there. Add it before `app.ready()`.
 */
export function recordPassed(app: FastifyInstance, passed: PassedRequest[] = []): PassedRequest[] {
  app.addHook('preParsing', (request, _reply, payload, done) => {
    passed.push({
      operationId: request.routeOptions.config.operationId ?? null,
      route: `${request.method} ${request.routeOptions.url ?? ''}`,
      principal: request.principal.kind,
    });
    done(null, payload);
  });
  return passed;
}

/**
 * Headers and body of a POST that only has to show whether stage 6 lets it through: a body
 * that is no JSON. Stage 7 answers 400 `INVALID_JSON` for it on every route, a module's and a
 * stand-in's alike, and no handler runs.
 */
export const MALFORMED_JSON = { headers: { 'content-type': 'application/json' }, payload: '{"w28": ' } as const;

// ── The real app on a clone, with every stage as the server has it ─────────────────────────────

export interface GuardTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  readonly run: { readonly dataDir: string };
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

export interface GuardAppOptions {
  readonly port?: ListenPort;
  readonly demoControls?: boolean;
  readonly logLevel?: LogLevel;
  readonly errorLogFile?: string;
  /** Registry operations the test calls: each gets a stand-in route unless a module has registered it. */
  readonly standIns?: readonly string[];
  /** Further routes, added by the same plugin as the stand-ins: the boot check is shown them. */
  readonly routes?: (instance: FastifyInstance, reached: string[]) => void;
  /** Routes added to the instance itself before `ready()`: no plugin's `onRoute` hook is shown them. */
  readonly topLevel?: (app: FastifyInstance) => void;
}

export interface GuardApp {
  readonly app: FastifyInstance;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ReturnType<typeof createManualClock>;
  readonly log: CapturedLog;
  /** `dems_session_<listen port>`. */
  readonly cookieName: string;
  /** The operations whose STAND-IN handler ran, in order. A module's own handler is not recorded here. */
  readonly reached: string[];
  /** The operations of `standIns` that got a stand-in: those no module had registered. */
  readonly standIns: string[];
  /** Every request that stage 6 let through, in order, whatever its handler did afterwards. */
  readonly passed: PassedRequest[];
  /** The device registry behind the seam `deviceResolver`, as a stand-in the test steers. */
  readonly devices: DeviceRegistryDouble;
}

/**
 * The real app factory on a clone, as `dems_app`, built but not yet ready: for a test of the
 * boot. NO stage is replaced. The one stand-in is the device registry behind the seam
 * `deviceResolver`: the test says which device is paired and which is retired, whatever the
 * pairing module (plan row W32) has built.
 */
export function buildGuardApp(target: GuardTarget, options: GuardAppOptions = {}): GuardApp {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({
      database: target.runtime,
      dataDir: target.run.dataDir,
      logLevel: options.logLevel ?? 'info',
      port: options.port ?? 4420,
      demoControls: options.demoControls ?? false,
    }),
    logStream: log.stream,
    ...(options.errorLogFile === undefined ? {} : { errorLogFile: options.errorLogFile }),
  });
  target.onCleanup(() => app.close());
  const reached: string[] = [];
  const standIns: string[] = [];
  const passed = recordPassed(app);
  options.topLevel?.(app);
  if (options.standIns !== undefined || options.routes !== undefined) {
    // A plugin registered after the units, as a module is: the guard's boot check sees its
    // routes, and every module's route exists when the stand-ins are chosen.
    void app.register(async (instance) => {
      standIns.push(...registryRoutes(instance, options.standIns ?? [], reached));
      options.routes?.(instance, reached);
    });
  }
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  const devices = deviceRegistryDouble();
  app.seams.replace('deviceResolver', devices.resolver);
  return { app, clock, log, cookieName: app.config.sessionCookieName, reached, standIns, passed, devices };
}

/**
 * `buildGuardApp`, ready, with the database answering. The engine is not booted (a booted
 * engine ticks): `ready.engine` is set by hand, as the identity tests do. It is closed before
 * the clone is dropped.
 */
export async function guardApp(target: GuardTarget, options: GuardAppOptions = {}): Promise<GuardApp> {
  const guard = buildGuardApp(target, options);
  await guard.app.ready();
  if (!(await guard.app.db.probe({ fresh: true }))) throw new Error('the clone does not answer as dems_app');
  guard.app.readiness.set('engine', true);
  return guard;
}

/** Signs an operator in on the web console and returns the header that carries the session: the cookie. */
export async function webOperator(guard: GuardApp, username: string): Promise<Headers> {
  const response = await webSignIn(guard.app, username);
  const token = response.statusCode === 200 ? cookieValue(response, guard.cookieName) : null;
  if (token === null) throw new Error(`the web sign-in of the test operator answered ${response.statusCode}`);
  return { cookie: `${guard.cookieName}=${token}` };
}

/** Signs an operator in on a paired device and returns the header that carries the session: the bearer value. */
export async function deviceOperator(guard: GuardApp, deviceCredential: string, username: string): Promise<Headers> {
  const response = await deviceSignIn(guard.app, deviceCredential, username);
  const token = response.statusCode === 200 ? (response.json() as { sessionToken?: string }).sessionToken : undefined;
  if (token === undefined) throw new Error(`the device sign-in of the test operator answered ${response.statusCode}`);
  return bearer(token);
}

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcome(response: LightMyRequestResponse): [number, string | null] {
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body: a 204.
  }
  return [response.statusCode, code];
}
