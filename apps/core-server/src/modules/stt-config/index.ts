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
import { routeOfOperation } from '../../plugins/permission-guard';
import { changeSttConfig, sttConfigNotSeeded, sttConfigOf, type Actor } from './change';
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
const NOT_SEEDED = 'the stt_config table holds no row: the seed did not write the STT configuration';

/** What this module offers beside its routes: the two providers of `seams.ts`, and its last test. */
export interface SttConfigControl {
  /** Hands in the probe of operation 92. Once per app; the transcriber runtime does it (row 115). */
  provideProbe(probe: SttConnectionProbe): void;
  /** Hands in the sealer of a `SECRET` credential. Once per app; the Core credential store does it. */
  provideCredentialSealer(sealer: SttCredentialSealer): void;
  hasProbe(): boolean;
  hasCredentialSealer(): boolean;
  /** The outcome of the last test since the server started, or null. */
  lastTest(): SttLastTest | null;
}

interface ControlState extends SttConfigControl {
  probe: SttConnectionProbe | null;
  sealer: SttCredentialSealer | null;
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
    sealer: null,
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
    hasProbe: () => state.probe !== null,
    hasCredentialSealer: () => state.sealer !== null,
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
      const outcome = await changeSttConfig(app, actorOf(request), request.body, {
        sealer: control.sealer,
        lastTest: control.last,
        // Read only when the body carries a secret and a sealer is there (`change.ts`, `sealSecretOf`).
        preview: () => app.db.read(CHANGE_SOURCE, (pool) => readSttConfig({ query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) }), request),
      });
      // N-5: the stored outcome of the last test described the configuration before this change.
      if (sttChangeInvalidatesLastTest(outcome.changedFields)) {
        control.last = null;
        control.tested += 1;
      }
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
      const { probe } = control;
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
