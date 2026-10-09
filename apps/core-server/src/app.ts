/**
 * Application factory of the DEMS Core server (plan row W08; spec §2). It performs no listen and
 * opens no database connection: `buildApp()` followed by `app.inject()` works with no PostgreSQL
 * at all. Only the entry point (`index.ts`) boots and listens.
 *
 * FROZEN after plan row W08 (P25): no later row edits this file, `index.ts` or `config.ts`.
 * Everything a later row needs is one of the three mechanisms below; a missing one is a
 * `needs-review`.
 *
 * 1. UNITS. Four stage plugins, `core`, `engine`, `realtime` and fourteen modules are imported
 *    statically and registered in a fixed order, each as a Fastify plugin at ROOT scope: a hook
 *    or a decorator added inside a unit applies to the whole server, exactly as if it were
 *    written here. The owning row replaces the unit's `index.ts` and keeps its exports.
 *    A unit's plugin function opens no database connection; work that needs the database at
 *    start is a boot step (`app.readiness.addBootStep`).
 *
 *    WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 1 to 6). Registered after the
 *    fourteen: the unit `capture` (the supervisor of the capture worker) and the module
 *    `modules/capture-config`. The seam `capture` joins the list of mechanism 3.
 *    Decision D68 extends OD-14 to the registration of `modules/stt-config` (task 3 row 113): waived edits 13 and 14.
 *    Decision D114 extends OD-14 to `modules/capture-discovery` (row 132) and `modules/capture-inputs` (row 133): waived edits 19 to 22.
 *
 * 2. REQUEST STAGES (spec §2.3). One `onRequest` hook runs five handlers in this order and
 *    stops at the first that refuses. They run before the body is read, so a refusal never
 *    depends on request data and wins over a malformed body.
 *
 *      #  stage         slot           provided by                   refuses with
 *      1  routing       (router)       plugins/error-envelope        400, 404, 405
 *      2  readiness     readiness      plugins/readiness             503 NOT_READY
 *      3  Origin guard  originGuard    plugins/origin-guard   W23    403 ORIGIN_NOT_ALLOWED
 *      4  authenticate  authenticate   plugins/authenticate   W24    401 CREDENTIAL_CONFLICT
 *      5  throttle      throttle       plugins/throttle       W23    429 RATE_LIMITED
 *      6  access rule   accessRule     plugins/permission-guard W28  401, 403
 *      7  parsing and validation: the JSON parser, then the zod compilers
 *      8  handler; 9 commit; 10 publish
 *
 *    A unit fills its slot with `app.stages.provide(slot, handler)`; the handler refuses by
 *    throwing an `ApiFailure`. A request that matched no route skips the stages: stage 1
 *    answers first (spec §7.3 line 1).
 *
 * 3. SEAMS (P25). A module reaches another only through these decorators on `app`. Each is a
 *    getter over a registry; the owning unit fills it with `app.seams.provide(name, value)`.
 *
 *      clock, pipeline, auditWriter   core                    W21
 *      originDecision                 plugins/origin-guard    W23
 *      denialBudget                   plugins/throttle        W23
 *      sessionRegistry                modules/identity        W24
 *      engine                         engine                  W26
 *      deviceResolver                 modules/pairing         W32
 *      publish                        realtime                W42
 *      capture                        capture                 task 3 (OD-14 waiver)
 *      readiness                      plugins/readiness       W08 (decorated directly)
 *
 *    The types live in the owning unit's `index.ts`, so the owner can extend them without an
 *    edit here.
 *
 * Tests. `const app = buildApp({ config })`; add scratch routes; `await app.ready()`; then
 * `app.seams.replace(...)`, `app.stages.replace(...)` and `app.readiness.set(...)` as needed.
 * `replace` wins over `provide` whenever it is called.
 *
 * `replace` IS TEST-ONLY BY CONSTRUCTION (checkpoint findings CPB1-5 and CPS1-2; fix round B2b).
 * It works only on an app that was built from a TEST CONFIGURATION: one that
 * `testConfiguration(config)` of `src/test-configuration.ts` marked before `buildApp` was called
 * (the neutral test support does it for every configuration it hands out,
 * `test/support/config.ts`). On any other app, and so
 * on the app of the entry point, which builds its configuration with `loadConfig` and nothing
 * else, `replace` throws, whatever way it is reached (`app.stages.replace(…)`, a computed
 * member, a destructured or aliased function). Whether an app is replaceable is decided once,
 * when `buildApp` starts, before any unit is registered: a unit cannot make its own app
 * replaceable. A static test (`test/static/slot-replacement.test.ts`) keeps the two facts this
 * rests on: `buildApp` is called by the entry point alone, with a configuration of
 * `loadConfig`, and no production source names `testConfiguration`.
 */
import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { captureModule, type CaptureSupervisor } from './capture';
import { BODY_LIMIT_BYTES, type CoreServerConfig } from './config';
import { corePlugin, type AuditWriter, type Clock, type Pipeline } from './core';
import { enginePlugin, type EngineHost } from './engine';
import { isTestConfiguration } from './test-configuration';
import { adminModule } from './modules/admin';
import { alertsModule } from './modules/alerts';
import { captureConfigModule } from './modules/capture-config';
import { captureDiscoveryModule } from './modules/capture-discovery';
import { captureInputsModule } from './modules/capture-inputs';
import { demoModule } from './modules/demo';
import { devicesModule } from './modules/devices';
import { evidenceModule } from './modules/evidence';
import { healthModule } from './modules/health';
import { identityModule, type SessionRegistry } from './modules/identity';
import { networkTimeModule } from './modules/network-time';
import { pairingModule, type DeviceResolver } from './modules/pairing';
import { rbacModule } from './modules/rbac';
import { securityAuditModule } from './modules/security-audit';
import { sessionsModule } from './modules/sessions';
import { storageModule } from './modules/storage';
import { sttConfigModule } from './modules/stt-config';
import { systemModule } from './modules/system';
import { ANONYMOUS_PRINCIPAL, authenticatePlugin, type Principal } from './plugins/authenticate';
import { dbPlugin, type Database, type PoolFactory } from './plugins/db';
import { createRouteTable, errorEnvelopePlugin, handleFrameworkError } from './plugins/error-envelope';
import {
  CoreLogController,
  buildLoggerOptions,
  createErrorLog,
  type ErrorLog,
  type LogStream,
} from './plugins/logger';
import { originGuardPlugin, type OriginDecision } from './plugins/origin-guard';
import { permissionGuardPlugin } from './plugins/permission-guard';
import { readinessPlugin, type Readiness } from './plugins/readiness';
import { responseHeadersPlugin } from './plugins/response-headers';
import { throttlePlugin, type DenialBudget } from './plugins/throttle';
import { realtimePlugin, type Publish } from './realtime';

// ── Seams ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The seams that a unit provides through the registry. `readiness` is decorated directly.
 *
 * This list is the one of P25 plus `denialBudget`. A seam that is not in it is a `needs-review`:
 * the controller decides. If one is granted, it needs no edit of this file: its owning unit
 * merges the name into this interface (`declare module` on this file), provides it with
 * `app.seams.provide(name, value)`, and its users read it with `app.seams.get(name)`.
 */
export interface Seams {
  clock: Clock;
  pipeline: Pipeline;
  auditWriter: AuditWriter;
  originDecision: OriginDecision;
  denialBudget: DenialBudget;
  sessionRegistry: SessionRegistry;
  engine: EngineHost;
  deviceResolver: DeviceResolver;
  publish: Publish;
  capture: CaptureSupervisor;
}
export type SeamName = keyof Seams;

/** Where each seam of the scaffold comes from; named in the error when a seam has no provider. */
export const SEAM_PROVIDERS = {
  clock: 'src/core (W21)',
  pipeline: 'src/core (W21)',
  auditWriter: 'src/core (W21)',
  originDecision: 'src/plugins/origin-guard (W23)',
  denialBudget: 'src/plugins/throttle (W23)',
  sessionRegistry: 'src/modules/identity (W24)',
  engine: 'src/engine (W26)',
  deviceResolver: 'src/modules/pairing (W32)',
  publish: 'src/realtime (W42)',
  capture: 'src/capture (capture module)',
} as const;

// ── Request stages ─────────────────────────────────────────────────────────────────────────────

/** Stages 2 to 6 of the request pipeline, in the order they run (spec §2.3). */
export const REQUEST_STAGES = ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const;
export type RequestStage = (typeof REQUEST_STAGES)[number];

/** Lets the request through by returning; refuses by throwing an `ApiFailure`. */
export type StageHandler = (request: FastifyRequest, reply: FastifyReply) => void | Promise<void>;
type StageHandlers = Record<RequestStage, StageHandler>;

export const STAGE_PROVIDERS: Readonly<Record<RequestStage, string>> = {
  readiness: 'src/plugins/readiness (W08)',
  originGuard: 'src/plugins/origin-guard (W23)',
  authenticate: 'src/plugins/authenticate (W24)',
  throttle: 'src/plugins/throttle (W23)',
  accessRule: 'src/plugins/permission-guard (W28)',
};

// ── The registry behind both ───────────────────────────────────────────────────────────────────

/** A set of named slots. `provide` fills a slot once; `replace` overrides it (tests only). */
export interface Slots<Shape> {
  provide<Name extends keyof Shape & string>(name: Name, value: Shape[Name]): void;
  /** Throws `SlotReplacementRefused` unless the app was built from a test configuration (`testConfiguration`). */
  replace<Name extends keyof Shape & string>(name: Name, value: Shape[Name]): void;
  has(name: keyof Shape & string): boolean;
  /** What fills the slot now. Throws, naming the expected provider, when nothing does. */
  get<Name extends keyof Shape & string>(name: Name): Shape[Name];
}
export type SeamRegistry = Slots<Seams>;
export type RequestStages = Slots<StageHandlers>;

interface SlotStore<Shape> extends Slots<Shape> {
  /** The slots of the scaffold's own list that nothing fills. */
  missing(): string[];
}

/** Thrown by `replace` on an app that was not built from a test configuration. */
export class SlotReplacementRefused extends Error {
  constructor(kind: string, name: string) {
    super(`${kind} "${name}" cannot be replaced: this app was not built from a test configuration`);
    this.name = 'SlotReplacementRefused';
  }
}

function createSlots<Shape>(
  kind: string,
  providers: Readonly<Partial<Record<keyof Shape & string, string>>>,
  replaceable: boolean,
): SlotStore<Shape> {
  const provided = new Map<string, unknown>();
  const replaced = new Map<string, unknown>();
  const names = Object.keys(providers);
  return {
    provide(name, value) {
      if (provided.has(name)) throw new Error(`${kind} "${name}" was provided twice`);
      provided.set(name, value);
    },
    replace(name, value) {
      // Closed over, not read from the object: no caller can switch it on afterwards.
      if (!replaceable) throw new SlotReplacementRefused(kind, name);
      replaced.set(name, value);
    },
    has: (name) => replaced.has(name) || provided.has(name),
    get<Name extends keyof Shape & string>(name: Name): Shape[Name] {
      const value = replaced.has(name) ? replaced.get(name) : provided.get(name);
      if (value === undefined) {
        throw new Error(`${kind} "${name}" has no provider (expected from ${providers[name] ?? 'its owning unit'})`);
      }
      return value as Shape[Name];
    },
    missing: () => names.filter((name) => !replaced.has(name) && !provided.has(name)),
  };
}

// ── What the scaffold adds to Fastify's types ──────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    /** The configuration, loaded once at start. */
    readonly config: CoreServerConfig;
    /** The persistent error log. */
    readonly errorLog: ErrorLog;
    /** The pool of the runtime role (available after `ready()`). */
    readonly db: Database;
    /** Readiness flags, holds and boot steps (available after `ready()`). */
    readonly readiness: Readiness;
    readonly seams: SeamRegistry;
    readonly stages: RequestStages;

    readonly clock: Clock;
    readonly pipeline: Pipeline;
    readonly auditWriter: AuditWriter;
    readonly originDecision: OriginDecision;
    readonly denialBudget: DenialBudget;
    readonly sessionRegistry: SessionRegistry;
    readonly engine: EngineHost;
    readonly deviceResolver: DeviceResolver;
    readonly publish: Publish;
    readonly capture: CaptureSupervisor;
  }

  interface FastifyRequest {
    /** Set to ANONYMOUS before the stages run; stage 4 replaces it. */
    principal: Principal;
  }

  interface FastifyContextConfig {
    /** The `operationId` of the route in the shared registry (`@dems/shared/api`). */
    operationId?: string;
  }
}

// ── The factory ────────────────────────────────────────────────────────────────────────────────

export interface BuildAppOptions {
  readonly config: CoreServerConfig;
  /** Where the log lines go. Default: standard output. Tests pass a capturing stream. */
  readonly logStream?: LogStream;
  /** File of the persistent error log. Default: none; the entry point passes the real file. */
  readonly errorLogFile?: string;
  /** Replaces the pool factory. Tests pass a fake; default: a real, lazy `pg` pool. */
  readonly createPool?: PoolFactory;
}

/**
 * Registers a unit without a new encapsulation context, with Fastify's documented
 * `skip-override` marker: what the unit adds lands on the root instance.
 */
function atRoot<Options extends FastifyPluginOptions>(
  name: string,
  plugin: FastifyPluginAsync<Options>,
): FastifyPluginAsync<Options> {
  const unit: FastifyPluginAsync<Options> = (instance, options) => plugin(instance, options);
  return Object.assign(unit, {
    [Symbol.for('skip-override')]: true,
    [Symbol.for('fastify.display-name')]: name,
  });
}

/** The units, in registration order. The order of the four stage plugins is documentation only:
 *  `REQUEST_STAGES` decides the order in which their handlers run. */
const UNITS: ReadonlyArray<readonly [name: string, plugin: FastifyPluginAsync]> = [
  ['core', corePlugin],
  ['plugins/origin-guard', originGuardPlugin],
  ['plugins/authenticate', authenticatePlugin],
  ['plugins/throttle', throttlePlugin],
  ['plugins/permission-guard', permissionGuardPlugin],
  ['engine', enginePlugin],
  ['realtime', realtimePlugin],
  ['modules/health', healthModule],
  ['modules/identity', identityModule],
  ['modules/rbac', rbacModule],
  ['modules/admin', adminModule],
  ['modules/pairing', pairingModule],
  ['modules/sessions', sessionsModule],
  ['modules/evidence', evidenceModule],
  ['modules/devices', devicesModule],
  ['modules/storage', storageModule],
  ['modules/network-time', networkTimeModule],
  ['modules/security-audit', securityAuditModule],
  ['modules/system', systemModule],
  ['modules/alerts', alertsModule],
  ['modules/demo', demoModule],
  ['modules/stt-config', sttConfigModule],
  ['capture', captureModule],
  ['modules/capture-config', captureConfigModule],
  ['modules/capture-discovery', captureDiscoveryModule],
  ['modules/capture-inputs', captureInputsModule],
];

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const { config } = options;

  const app = Fastify({
    logger: buildLoggerOptions({ level: config.logLevel, stream: options.logStream }),
    logController: new CoreLogController(),
    // Never taken from a request header; unique across restarts, so a log line can be matched
    // with `error.requestId` of an answer.
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: BODY_LIMIT_BYTES,
    // GET and POST only (API-2): no implicit HEAD routes.
    exposeHeadRoutes: false,
    // While the server closes, a request gets the envelope (503 NOT_READY from stage 2), not
    // Fastify's bare 503.
    return503OnClosing: false,
    frameworkErrors: handleFrameworkError,
  });

  // Stage 7: every body, query and path parameter is validated by the registry's zod schema,
  // and every answer with a response schema is serialised through it (SR-64).
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Decided once, here, before any unit is registered (see the header: `replace` is test-only).
  const replaceable = isTestConfiguration(config);
  const seams = createSlots<Seams>('seam', SEAM_PROVIDERS, replaceable);
  const stages = createSlots<StageHandlers>('request stage', STAGE_PROVIDERS, replaceable);
  const routeTable = createRouteTable();

  app.decorate('config', config);
  app.decorate('errorLog', createErrorLog(options.errorLogFile ?? null));
  app.decorate('seams', seams);
  app.decorate('stages', stages);
  app.decorate('clock', { getter: () => seams.get('clock') });
  app.decorate('pipeline', { getter: () => seams.get('pipeline') });
  app.decorate('auditWriter', { getter: () => seams.get('auditWriter') });
  app.decorate('originDecision', { getter: () => seams.get('originDecision') });
  app.decorate('denialBudget', { getter: () => seams.get('denialBudget') });
  app.decorate('sessionRegistry', { getter: () => seams.get('sessionRegistry') });
  app.decorate('engine', { getter: () => seams.get('engine') });
  app.decorate('deviceResolver', { getter: () => seams.get('deviceResolver') });
  app.decorate('publish', { getter: () => seams.get('publish') });
  app.decorate('capture', { getter: () => seams.get('capture') });
  // A request decorator cannot start as an object; the first hook below sets the real value.
  app.decorateRequest<Principal, 'principal'>('principal', null as unknown as Principal);

  // Before any route exists, so that the table holds every route (405 against 404).
  app.addHook('onRoute', (route) => routeTable.record(route));

  // From here on the order is the order of the hooks. Response headers first: a refusal by a
  // stage then already carries them. Cookies next: `request.cookies` is parsed before stage 3.
  app.register(atRoot('plugins/response-headers', responseHeadersPlugin));
  app.register(cookie);
  app.register(atRoot('plugins/error-envelope', errorEnvelopePlugin), { routeTable });

  app.register(
    atRoot('request-stages', async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        request.principal = ANONYMOUS_PRINCIPAL;
        if (request.is404) return;
        for (const stage of REQUEST_STAGES) {
          await stages.get(stage)(request, reply);
          if (reply.sent) return reply;
        }
      });
    }),
  );

  // Readiness before the pool (the pool adds the first boot step); the pool before every unit
  // (`onClose` hooks run in reverse order, so the pool closes last).
  app.register(atRoot('plugins/readiness', readinessPlugin));
  app.register(atRoot('plugins/db', dbPlugin), { createPool: options.createPool });

  for (const [name, plugin] of UNITS) app.register(atRoot(name, plugin));

  // A unit that forgot its seam or its stage stops the boot here, by name, not a request later.
  app.addHook('onReady', async () => {
    const missing = [
      ...seams.missing().map((name) => `seam ${name}`),
      ...stages.missing().map((name) => `request stage ${name}`),
    ];
    if (missing.length > 0) throw new Error(`the scaffold is incomplete: ${missing.join(', ')} not provided`);
  });

  return app;
}
