/**
 * STT configuration module (blueprint row 113, milestone M6; requirement R-8, decisions D20 and
 * D24; contract `packages/shared/src/api/transcription.ts`, C3 §2.5; table `stt_config`, dbc-3
 * §B.13).
 *
 *   #   operationId        method and path                            access (registry)   audit on success
 *   90  getSttConfig       GET  /api/v1/transcription/config          AUTHENTICATED       none (a read)
 *   91  updateSttConfig    POST /api/v1/transcription/config          CAPTURE_CONFIG      STT_CONFIG_CHANGED; none when unchanged
 *   92  testSttConnection  POST /api/v1/transcription/config/test     CAPTURE_CONFIG      none (no state change)
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`) and names it in `config.operationId`.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`), before the body is read: every signed-in role reads operation 90;
 * `CAPTURE_CONFIG` (SUPERVISOR and TECHNICIAN) is needed for 91 and 92, and a caller without it
 * is refused there with one `ACCESS_DENIED` row. This folder reads no role and no permission.
 *
 * A BODY OF OPERATION 91 THAT CARRIES `credential` IS WEB-CONSOLE ONLY (batch N; security review
 * S99-09, ruling D241): the operation takes a typed secret, as operations 89 / 95 / 96 do, and those
 * carry the condition `WEB_CONSOLE_SESSION`. Stage 6 runs before the body is parsed, so the rule
 * cannot stand in the registry's access member without closing the operation to the tablet, whose
 * technician saves a change WITHOUT a credential. The handler therefore asks the guard itself
 * (`permissionGuard(app).requireWebConsoleSession`) as its FIRST statement when the body has the
 * member - any kind of it (SECRET, REFERENCE, CLEAR: each changes the credential): a session bound
 * to a paired device gets the condition's own answer, row and log line, and nothing of the body is
 * read, sealed, stored or logged. This folder still reads no role and no permission.
 *
 * THE CONFIGURATION IS A STORED ROW, NOT A SLICE. C3 §2.5 keeps the replicated state at 30
 * slices: clients re-read operation 90 on screen entry and after 91. So the two reads answer from
 * the table through the pool (`app.db.read`: a failure is the database's and answers 503), and
 * the change is a unit of work of its own (`change.ts`), not a hosted simulator action.
 *
 * THE CREDENTIAL IS WRITE-ONLY. A request may carry one; nothing this module sends, logs or
 * audits ever does (`statements.ts` selects no credential column; `change.ts` hands a secret to
 * the sealer and forwards ciphertext only). An answer says `credentialSet` and `credentialKind`.
 * The body of operation 91 is never logged: the one log line of a change names the changed
 * FIELDS, the revision and whether the credential changed.
 *
 * A CHANGE APPLIES TO THE NEXT SESSION (`appliesFrom`, `pendingForNextSession`): see `change.ts`.
 *
 * OPERATION 92 TESTS THE STORED CONFIGURATION THROUGH A PROVIDED PROBE (`seams.ts`). The server
 * itself opens no outbound connection. One test runs at a time (the contract's "serialised with
 * other oMLX calls"), each under a time limit; a probe that fails or runs out of time is a 200
 * result with `reachable: false`, logged and persisted by its code. The outcome of the last test
 * is kept in memory for operation 90 (`lastTest`); it is not configuration and is not stored.
 *
 * THE TRANSCRIPTION COMPOSITION IS MOUNTED HERE (row 115; `src/transcription`). `app.ts` is frozen
 * (P25), so the plugin function of this module calls `mountTranscription(app, …)`: it adds the
 * CS-22 boot step of the transcriber and, in an app that has a data directory, makes the probe of
 * operation 92. That probe is used when no other was provided; a probe handed to `provideProbe`
 * wins over it (a test that states what a probe is given and what it answers). An app without a
 * data directory has no transcriber and operation 92 keeps answering 503 `TRANSCRIBER_NOT_READY`.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 */
import {
  ApiErrorCode,
  STT_CONFIG_OPERATIONS,
  STT_TRANSCRIBER_NOT_READY_REASON,
  sttChangeInvalidatesLastTest,
  SttConfigSchema,
  SttConfigUpdateRequestSchema,
  SttConfigUpdateResultSchema,
  SttConnectionDetailCode,
  SttConnectionTestSchema,
  type CoreApiRegistryOperation,
  type SttConfig,
  type SttConfigUpdateResult,
  type SttConnectionTest,
  type SttLastTest,
} from '@dems/shared/api';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../plugins/authenticate';
import { ApiFailure } from '../../plugins/error-envelope';
import { describeError } from '../../plugins/logger';
import { permissionGuard, routeOfOperation } from '../../plugins/permission-guard';
import { changeSttConfig, sttConfigNotSeeded, sttConfigOf, type Actor } from './change';
import { coreCredentialStore } from '../../credential-store';
import { mountTranscription } from '../../transcription';
import { STT_TEST_QUEUE_LIMIT, STT_TEST_TIMEOUT_MS, type SttConnectionProbe, type SttCredentialSealer, type SttProbeResult } from './seams';
import { readSttConfig, type StoredSttConfig } from './statements';

export {
  STT_CONFIG_NOT_SEEDED_REASON,
  STT_CONFIG_UNIT_LABEL,
  SealedCredentialRefused,
  sttConfigChanged,
  sttConfigOf,
  type Actor,
  type SttChangeOutcome,
  type SttConfigChanged,
} from './change';
export {
  STT_KEY_REF_PATTERN,
  STT_TEST_QUEUE_LIMIT,
  STT_TEST_TIMEOUT_MS,
  isSealedCredential,
  type SealedSttCredential,
  type SttConnectionProbe,
  type SttCredentialSealer,
  type SttProbeOptions,
  type SttProbeResult,
  type SttProbeTarget,
} from './seams';
export {
  LOCK_STT_CONFIG,
  READ_STT_CONFIG,
  SttConfigRowError,
  UPDATE_STT_CONFIG,
  UPDATE_STT_CONFIG_WITH_CREDENTIAL,
  type StoredSttConfig,
} from './statements';

/** The operations this module answers, in registry order (90, 91, 92). */
export const STT_CONFIG_MODULE_OPERATIONS = ['getSttConfig', 'updateSttConfig', 'testSttConnection'] as const;
export type SttConfigModuleOperation = (typeof STT_CONFIG_MODULE_OPERATIONS)[number];

const READ_SOURCE = 'sttConfig.read';
const TEST_SOURCE = 'sttConfig.testConnection';
const CHANGE_SOURCE = 'sttConfig.update';
const CHANGED = 'STT configuration changed';
const PROBE_FAILED = 'the STT connection probe failed; the test is answered as unreachable';
const STORE_SOURCE = 'sttConfig.credentialStore';
const STORE_REFUSED = 'the Core credential store refuses to work: a SECRET credential cannot be stored';
const NOT_SEEDED = 'the stt_config table holds no row: the seed did not write the STT configuration';

/** What this module offers beside its routes: the two providers of `seams.ts`, and its last test. */
export interface SttConfigControl {
  /**
   * Hands in a probe of operation 92 in the place of the transcription composition's own (row
   * 115). Once per app. The product does not call it: the module takes its probe from
   * `src/transcription` when the app has a data directory. A probe handed in here wins over that one.
   */
  provideProbe(probe: SttConnectionProbe): void;
  /**
   * Hands in a sealer of a `SECRET` credential in the place of the Core credential store's own.
   * Once per app. The product does not call it: when the app is ready the module takes its sealer
   * from the Core credential store (`src/credential-store`, row 84). A sealer handed in here wins
   * over that one (a test that states what a sealer is given and what it answers).
   */
  provideCredentialSealer(sealer: SttCredentialSealer): void;
  hasProbe(): boolean;
  hasCredentialSealer(): boolean;
  /** The outcome of the last test since the server started, or null. */
  lastTest(): SttLastTest | null;
}

interface ControlState extends SttConfigControl {
  probe: SttConnectionProbe | null;
  /** The probe of the transcription composition; null while the app has no data directory (no transcriber). */
  runtimeProbe: SttConnectionProbe | null;
  sealer: SttCredentialSealer | null;
  /** The sealer of the Core credential store; null while the app has no store, or one it refuses. */
  storeSealer: SttCredentialSealer | null;
  last: SttLastTest | null;
  /** The tail of the tests in flight: one test at a time. */
  queue: Promise<unknown>;
  /** The tests that run or wait for their turn: never more than `STT_TEST_QUEUE_LIMIT`. */
  waiting: number;
  /** Grows with every change of what a test tests: a test that was in flight across one is not kept as `lastTest`. */
  tested: number;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `permissionGuard(app)` / `captureConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The module's controls of an app. Available once the module is registered. */
export function sttConfigControl(app: { readonly stages: object }): SttConfigControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the STT configuration module is not loaded: register it before app.ready(), then call it after');
  return control;
}

function createControl(): ControlState {
  const state: ControlState = {
    probe: null,
    runtimeProbe: null,
    sealer: null,
    storeSealer: null,
    last: null,
    queue: Promise.resolve(),
    waiting: 0,
    tested: 0,
    provideProbe(probe) {
      if (state.probe !== null) throw new Error('the STT connection probe was provided twice');
      state.probe = probe;
    },
    provideCredentialSealer(sealer) {
      if (state.sealer !== null) throw new Error('the STT credential sealer was provided twice');
      state.sealer = sealer;
    },
    hasProbe: () => (state.probe ?? state.runtimeProbe) !== null,
    hasCredentialSealer: () => (state.sealer ?? state.storeSealer) !== null,
    lastTest: () => state.last,
  };
  return state;
}

function registryEntry(operationId: SttConfigModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = STT_CONFIG_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/**
 * The actor of a row: the operator and the device of the caller's session. Stage 6 lets only an
 * operator reach these routes; the refusal here is the same backstop the engine host has, and it
 * reads no permission and no role.
 */
function actorOf(request: FastifyRequest): Actor {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/** 503 of operation 92 while no probe can run (C3 §2.5). */
function transcriberNotReady(): ApiFailure {
  return new ApiFailure(503, ApiErrorCode.NOT_READY, 'The transcriber is not ready. Try again shortly.', {
    details: { reason: STT_TRANSCRIBER_NOT_READY_REASON },
  });
}

class ProbeTimedOut extends Error {
  readonly code = SttConnectionDetailCode.TIMEOUT;
}

/** One probe under the time limit. The signal tells the probe to give its request up. */
async function runProbe(probe: SttConnectionProbe, stored: StoredSttConfig): Promise<SttProbeResult> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new ProbeTimedOut('the STT connection probe ran out of time'));
    }, STT_TEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      probe(
        { enabled: stored.enabled, backend: stored.backend, endpoint: stored.endpoint, model: stored.model, credentialKind: stored.credentialKind },
        { signal: abort.signal, timeoutMs: STT_TEST_TIMEOUT_MS },
      ),
      limit,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export const sttConfigModule: FastifyPluginAsync = async (app) => {
  const control = createControl();
  controls.set(app.stages, control);
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // THE TRANSCRIPTION COMPOSITION (row 115). Mounted from here because `app.ts` is frozen: its
  // boot step joins the steps of this module's place in the registration order. It reads the
  // stored row through this module's own statement (no credential column) and the runtime pool.
  const transcription = mountTranscription(app, {
    readConfig: () => readSttConfig({ query: (text, values) => app.db.pool.query(text, values === undefined ? [] : [...values]) }),
  });
  if (transcription.mounted) control.runtimeProbe = transcription.probe;

  // THE CORE CREDENTIAL STORE (row 84; D68(c); SEC35-03). Once the app is ready the module asks
  // the one store of the app for the sealer of a `SECRET` credential. An app without a data
  // directory has no store, and a `SECRET` write keeps answering 503 (`CREDENTIAL_STORE_NOT_READY`).
  // A store that refuses to work (its directory is not private) is a fault of the host: said once,
  // in the log and in the persistent error log, by its code; the write answers the same 503.
  app.addHook('onReady', async () => {
    const opened = coreCredentialStore(app);
    if (opened.status === 'READY') {
      control.storeSealer = { seal: (plaintext) => opened.store.stt.seal(plaintext) };
    } else if (opened.status === 'UNAVAILABLE') {
      app.log.error({ code: opened.code, source: STORE_SOURCE }, STORE_REFUSED);
      app.errorLog.append({ level: 'error', source: STORE_SOURCE, message: STORE_REFUSED, code: opened.code, context: { errno: opened.detail } });
    }
  });

  /**
   * The stored row through the pool. A statement that fails, and a row outside the contract
   * (`SttConfigRowError`), are faults of the store: `app.db.read` logs and persists them by their
   * code and answers 503. A table without the row is the seed's fault: the same, said here.
   */
  const stored = async (request: FastifyRequest, source: string): Promise<StoredSttConfig> => {
    const row = await app.db.read(source, (pool) => readSttConfig({ query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) }), request);
    if (row === null) {
      request.log.error({ code: 'STT_CONFIG_NOT_SEEDED', source }, NOT_SEEDED);
      app.errorLog.append({ level: 'error', source, message: NOT_SEEDED, code: 'STT_CONFIG_NOT_SEEDED', context: { requestId: request.id } });
      throw sttConfigNotSeeded();
    }
    return row;
  };

  // 90 getSttConfig
  routes.route({
    ...routeOfOperation(registryEntry('getSttConfig')),
    schema: { response: { 200: SttConfigSchema } },
    handler: async (request): Promise<SttConfig> => sttConfigOf(await stored(request, READ_SOURCE), control.last),
  });

  // 91 updateSttConfig
  routes.route({
    ...routeOfOperation(registryEntry('updateSttConfig')),
    schema: { body: SttConfigUpdateRequestSchema, response: { 200: SttConfigUpdateResultSchema } },
    handler: async (request): Promise<SttConfigUpdateResult> => {
      // S99-09: a credential in the body is web-console only (see the file header). Before anything of the body is used.
      if (request.body.credential !== undefined) await permissionGuard(app).requireWebConsoleSession(request);
      const outcome = await changeSttConfig(app, actorOf(request), request.body, {
        sealer: control.sealer ?? control.storeSealer,
        lastTest: control.last,
        // Read only when the body carries a secret and a sealer is there (`change.ts`, `sealSecretOf`).
        preview: () => app.db.read(CHANGE_SOURCE, (pool) => readSttConfig({ query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) }), request),
      });
      // N-5: the stored outcome of the last test described the configuration before this change.
      if (sttChangeInvalidatesLastTest(outcome.changedFields)) {
        control.last = null;
        control.tested += 1;
      }
      // The service state of the transcriber follows the stored `enabled` (row 115).
      if (outcome.changedFields.length > 0) transcription.noteConfigChange(outcome.result.enabled);
      if (outcome.changedFields.length > 0) {
        // Field NAMES and two facts. Never the body: it may hold a credential.
        request.log.info(
          {
            code: 'STT_CONFIG_CHANGED',
            source: CHANGE_SOURCE,
            changedFields: outcome.changedFields.join(','),
            credentialChanged: outcome.credentialChanged,
            revision: outcome.result.revision,
            appliesFrom: outcome.result.appliesFrom,
          },
          CHANGED,
        );
      }
      return outcome.result;
    },
  });

  // 92 testSttConnection
  routes.route({
    ...routeOfOperation(registryEntry('testSttConnection')),
    schema: { response: { 200: SttConnectionTestSchema } },
    handler: async (request): Promise<SttConnectionTest> => {
      const probe = control.probe ?? control.runtimeProbe;
      if (probe === null) throw transcriberNotReady();
      // N-6: the tests in waiting are bounded (each may hold its turn for the whole time limit).
      // One more than the room holds is answered at once and never reaches the probe.
      if (control.waiting >= STT_TEST_QUEUE_LIMIT) throw transcriberNotReady();
      control.waiting += 1;
      const tested = control.tested;
      let result: SttProbeResult;
      let row: StoredSttConfig;
      try {
        row = await stored(request, TEST_SOURCE);
      } catch (error) {
        control.waiting -= 1;
        throw error;
      }
      // One test at a time: this one starts when the test before it has ended, however it ended.
      const turn = control.queue.then(() => runProbe(probe, row));
      control.queue = turn.catch(() => undefined);
      try {
        result = await turn;
      } catch (error) {
        // A probe that threw or ran out of time is an unreachable backend to the caller (a 200
        // result, C3 §2.5), and a fault to the team: by its code, never its message.
        const description = describeError(error);
        const timedOut = error instanceof ProbeTimedOut;
        const code = timedOut ? SttConnectionDetailCode.TIMEOUT : (description.code ?? description.errorName);
        request.log.error({ code, source: TEST_SOURCE, backend: row.backend }, PROBE_FAILED);
        app.errorLog.append({ level: 'error', source: TEST_SOURCE, message: PROBE_FAILED, ...description, code, context: { requestId: request.id, backend: row.backend } });
        result = { reachable: false, modelAvailable: false, detailCode: timedOut ? SttConnectionDetailCode.TIMEOUT : SttConnectionDetailCode.UNREACHABLE };
      } finally {
        control.waiting -= 1;
      }
      const answer: SttConnectionTest = {
        reachable: result.reachable === true,
        modelAvailable: result.reachable === true && result.modelAvailable === true,
        backend: row.backend,
        detailCode: String(result.detailCode),
      };
      // The outcome describes the configuration the test read; if that changed meanwhile, it is not "the last test" of the stored one.
      if (control.tested === tested) control.last = { reachable: answer.reachable, modelAvailable: answer.modelAvailable, testedAt: app.clock.now() };
      return answer;
    },
  });
};
