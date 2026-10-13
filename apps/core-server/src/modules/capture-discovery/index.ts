/**
 * Camera search and candidate list (blueprint row 132, M4; requirement R-9; contract C3 §2.6 ops 93
 * and 94, §5.2 `CAPTURE_DISCOVERY_SEARCHED`, §7; decisions D74 to D76, D80, D83, D86, D91, D106).
 *
 * WHAT THIS MODULE OWNS
 *   - operations 93 `startCaptureDiscovery` and 94 `getCaptureDiscovery` (`routes.ts`);
 *   - the search itself (`search.ts`): the ONE file of the server that calls `discover` of the
 *     camera adapter, for its two triggers - operation 93 and the pre-check's one search;
 *   - the candidate store (`store.ts`): what a search found, in the memory of the Core, as data of
 *     the operator session that searched. No table, no slice, no file;
 *   - the bounds of a search (`limits.ts`) and the match against the registered cameras
 *     (`registered.ts`).
 *
 * WHAT A SEARCH WRITES: one `CAPTURE_DISCOVERY_SEARCHED` audit row with counts, when its window
 * closes. Nothing else: `capture_devices` and `capture_device_credentials` are never written here.
 * The alert of an empty search is the no-device notifier's (`src/capture-notices`, row 133), which
 * this module tells of every closed search; it writes no second audit row (D80(8)).
 *
 * THE DISCOVERY ADAPTER. Built here, per search, with what the capture folder may not draw
 * itself (static rule G-R8): the message IDs (the platform's random UUID), the capture timers and
 * the lookup of the registered cameras. It exists only when the Core runs real capture
 * (`captureMode: real`): a `SIMULATED` Core has no network search and operation 93 answers
 * `503 DISCOVERY_NOT_READY`. Test support and a lane launcher hand in their own factory
 * (`provideAdapter`), which is the only way the loopback fixture of the fake ONVIF stub is reached:
 * no source under `src/` names it (static rule G-R9).
 *
 * WHEN A LIST GOES AWAY: at its `expiresAt`, when its owner searches again, when the owner signs
 * out (the hook below discards it at once) and when the server stops. A session that EXPIRES can
 * no longer make a request, so its list is unreachable from that moment (stage 4 answers 401
 * before any read); the memory itself is freed at the list's own `expiresAt`, at most ten minutes
 * later. `discardSession` of the control frees it at once for a caller that knows the session ended.
 *
 * THE CONNECT FLOW (row 142: operations 95, 96 and 89) lives in `connect/`. This plugin registers
 * its routes and hands it the candidate state, the connection tester of the camera adapter and
 * the registrar of an adopted camera (`adoption.ts`: the INTERNAL engine action
 * `registerCaptureDevice` inside the adoption's unit).
 *
 * REGISTERED by `app.ts` (decision D114: the OD-14 waiver of P25 extended to this unit). The plugin
 * function opens no database connection and no socket: `buildApp()` works without PostgreSQL and
 * sends nothing.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED, CaptureDiscoveryState, CaptureDiscoveryTrigger } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import { avcDeclaredFrameRate, createSystemTimers } from '../../capture';
import {
  createOnvifConnectionTester,
  createOnvifDiscoveryAdapter,
  createOnvifStreamLocator,
  createStreamConnectionTester,
  startProductionProcess,
  type CaptureAdapterKind,
  type OnvifDiscoveryAdapter,
  type RegisteredLookup,
} from '../../capture/adapters';
import { captureFenceControl } from '../../capture/fence';
import { captureNotices, type PrecheckSearchSeam } from '../../capture-notices';
import { streamProfileOf } from '../../sealing-host';
import { registerAdoptedCameraTest } from './adopted-test';
import { registerAdoptedCameraTestRoute } from './adopted-test-route';
import { registerAdoptedCamera, type AdoptedCamera } from './adoption';
import { candidateDirectoryOf, registerCaptureConnectRoutes } from './connect';
import { createSearchLimiter, type SearchLimiter } from './limits';
import { registerCaptureReaddressRoute } from './readdress-route';
import { readRegisteredCameras } from './registered';
import { registerCaptureDiscoveryRoutes } from './routes';
import { readLastSearchNumber } from './search-ids';
import { createSearchRunner, openSessionOf, type SearchClosed, type SearchRunner } from './search';
import { createSessionExpiryWatch, readEndedSessions } from './session-expiry';
import { createCandidateStore, type CandidateStore, type HeldCandidate, type TestRecord } from './store';

export {
  ADOPTED_CAMERA_TRANSPORT,
  ADOPTED_STREAM_ROLE,
  AdoptionProfileInvalid,
  AdoptionRowMissing,
  INSERT_ADOPTED_CAMERA_STREAM,
  SET_ADOPTED_CAMERA_COLUMNS,
  assertAdoptedProfiles,
  registerAdoptedCamera,
  writeAdoptedCameraStreams,
  type AdoptedCamera,
  type AdoptedCameraStream,
} from './adoption';
export { adoptedCameraTestControl, type AdoptedCameraTest, type AdoptedCameraTestControl, type AdoptedCameraTestParts, type StoredCredentialReader } from './adopted-test';
export { SearchBound, createSearchLimiter, type SearchAllowance, type SearchLimiter } from './limits';
export { CAPTURE_READDRESS_MODULE_OPERATION, READDRESS_NETWORK_FACTS_UNREADABLE, captureReaddressControl, type CaptureReaddressControl } from './readdress-route';
export { READ_REGISTERED_CAMERAS, adoptionAddressOf, readRegisteredCameras, registeredIndexOf, type RegisteredCamera, type RegisteredIndex } from './registered';
export { CAPTURE_DISCOVERY_MODULE_OPERATIONS, captureDiscoveryOperation, searchRefused, type CaptureDiscoveryModuleOperation } from './routes';
export { READ_LAST_SEARCH_NUMBER, readLastSearchNumber, searchIdOf, type SearchNumberReader } from './search-ids';
export { createSearchRunner, type SearchClosed, type SearchRefusal, type SearchRequest, type SearchRunner, type SearchRunnerOptions, type SearchStart } from './search';
export { createCandidateStore, type CandidateStore, type FoundCandidate, type HeldCandidate, type TestRecord } from './store';
// The rule holder of a typed address (task 4 row 96, its request 1): the door the production composition hands the rule in through.
export { typedAddressControl, type TypedAddressControl, type TypedAddressRule } from './typed-address';
// The control of the connect flow (task 4 row 143c, decision C65): the door the production composition hands the candidate rule in through.
export { captureConnectControl, type CaptureConnectControl } from './connect';

/** Builds the discovery adapter of one search around the lookup of the registered cameras. */
export type DiscoveryAdapterFactory = (registered: RegisteredLookup) => OnvifDiscoveryAdapter;

/** The candidates of a session, as the connect flow (row 142) reaches them. The clock is the server's. */
export interface CandidateDirectorySeam {
  /** Null for an id that is unknown, expired or of another session's search: one answer for all three. */
  find(sessionId: string, candidateId: string): HeldCandidate | null;
  recordTest(sessionId: string, candidateId: string, test: TestRecord): void;
  markRegistered(sessionId: string, candidateId: string, deviceId: string): void;
}

/** What this module offers beside its routes. */
export interface CaptureDiscoveryControl {
  /** The candidate state, for the connect flow. */
  readonly candidates: CandidateDirectorySeam;
  /**
   * Hands in the factory of the discovery adapter in the place of the module's own. Once per app.
   * The product does not call it. Test support and a lane launcher do: it is how a search reaches
   * the fake ONVIF stub on loopback.
   */
  provideAdapter(factory: DiscoveryAdapterFactory): void;
  /** True when a search can run: a factory was handed in, or the Core runs real capture. */
  ready(): boolean;
  /** The owner session ended: its list and its place in the per-session bounds are gone at once. */
  discardSession(sessionId: string): void;
  /** Told of every search whose window closed, after its audit row is written. */
  onSearchClosed(listener: (closed: SearchClosed) => void | Promise<void>): void;
  /** The seam this module hands the pre-check gate (`captureNotices(app).provideDiscovery`): the pre-check's one search. */
  readonly precheckSearch: PrecheckSearchSeam;
  /** Searches started since the process began: for the trigger checks (0 at boot, 0 after a read). */
  searchesStarted(): number;
  /** Sessions that hold a list: for the checks of the bounded memory. */
  heldLists(): number;
  /** Resolves when every expiry check a commit started has ended (`session-expiry.ts`): for the tests. */
  expirySettled(): Promise<void>;
}

interface ControlState extends CaptureDiscoveryControl {
  readonly store: CandidateStore;
  readonly limiter: SearchLimiter;
  runner: SearchRunner | null;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `captureConfigControl(app)` / `sttConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The module's controls of an app. Available once the module is registered. */
export function captureDiscoveryControl(app: { readonly stages: object }): CaptureDiscoveryControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture-discovery module is not loaded: register it before app.ready(), then call it after');
  return control;
}

const SOURCE = 'captureDiscovery';
const AUDIT_UNIT_LABEL = 'captureDiscovery.searched';
const SIGN_OUT_OPERATION = 'signOut';
const ADMIT_FAILED = 'an adopted camera could not be handed to the adapter registry: it is assignable after the next start of the Core';
const STREAM_TEST_FAULT = 'the stream half of a camera connection test failed on this host: the relay could not judge the stream';
const EXPIRY_CHECK_FAILED ='the check for expired owner sessions of the candidate lists failed: a list goes at its own expiry';

export const captureDiscoveryModule: FastifyPluginAsync = async (app) => {
  const store = createCandidateStore({ randomBytes: (size) => randomBytes(size) });
  const limiter = createSearchLimiter();
  const timers = createSystemTimers();
  let provided: DiscoveryAdapterFactory | null = null;
  const realCapture = app.config.captureMode === 'real';
  /** The product's adapter: the fixed WS-Discovery group, no loopback target. */
  const own: DiscoveryAdapterFactory = (registered) => createOnvifDiscoveryAdapter({ timers, newMessageId: randomUUID, registered });
  const factory = (): DiscoveryAdapterFactory | null => provided ?? (realCapture ? own : null);

  const runner = createSearchRunner({
    store,
    limiter,
    now: () => app.clock.now(),
    ready: () => factory() !== null,
    adapter: (registered) => factory()?.(registered) ?? null,
    registeredCameras: () => app.db.read(`${SOURCE}.registeredCameras`, (pool) => readRegisteredCameras({ query: (text) => pool.query(text) })),
    // Fix wave I (G70b-07): the search IDs go on from the highest number the stored audit chain holds, so a restart repeats none.
    lastStoredSearchNumber: () => app.db.read(`${SOURCE}.lastSearchNumber`, (pool) => readLastSearchNumber({ query: (text) => pool.query(text) })),
    openSession: () => {
      if (!app.engine.running) return null;
      // Fix wave L (re-check 70 note G70c-05): a SEALED session is not open - `openSessionOf`, the ONE rule.
      return openSessionOf(app.engine.state().session);
    },
    // The lift of D86 C-4 is the ONE pinned constant of the contract: nothing here can switch it.
    duringRecordingEnabled: CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED,
    audit: async (entry) => {
      await app.pipeline.run(AUDIT_UNIT_LABEL, async (unit) => {
        await unit.audit.append(entry);
      });
    },
    log: { info: (fields, message) => app.log.info(fields, message), error: (fields, message) => app.log.error(fields, message) },
    persist: (entry) => app.errorLog.append({ level: 'error', ...entry }),
  });

  // THE SECOND TRIGGER (R-9 AC-1 (b)): the one search of a pre-check run with an unreachable camera.
  // It is owned by the session of the operator who started the pre-check (who needs no
  // CAPTURE_CONFIG for it, D80(2)), runs under its own allowance and stays single-flight: when
  // another search is running, or no adapter exists, it is not started and the answer is null.
  const precheckSearch: PrecheckSearchSeam = {
    async runPrecheckSearch(owner) {
      const outcome = await runner.start({ sessionId: owner.authSessionId, operatorId: owner.operatorId, deviceId: owner.deviceId, trigger: CaptureDiscoveryTrigger.PRECHECK });
      if (!outcome.started || !outcome.created) return null;
      const closed = await outcome.closed;
      if (closed === null) return null;
      return { searchId: closed.searchId, trigger: closed.trigger, outcome: closed.state === CaptureDiscoveryState.FAILED ? 'FAILED' : 'COMPLETE', responderCount: closed.responderCount };
    },
  };

  const expiryWatch = createSessionExpiryWatch({
    ownerSessions: () => [...new Set([...store.sessionIds(), ...limiter.sessionIds()])],
    endedAmong: (sessionIds) => app.db.read(`${SOURCE}.endedSessions`, (pool) => readEndedSessions({ query: (text, values) => pool.query(text, [...values]) }, sessionIds)),
    discard: (sessionId) => control.discardSession(sessionId),
    failed: (error) => {
      const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : 'UNKNOWN';
      app.log.error({ source: `${SOURCE}.sessionExpiry`, code }, EXPIRY_CHECK_FAILED);
      app.errorLog.append({
        level: 'error',
        source: `${SOURCE}.sessionExpiry`,
        message: EXPIRY_CHECK_FAILED,
        ...(error instanceof Error && error.stack !== undefined ? { stackTrace: error.stack } : {}),
        context: { code },
      });
    },
  });

  const now = (): number => app.clock.now();
  const control: ControlState = {
    store,
    limiter,
    runner,
    precheckSearch,
    candidates: {
      find: (sessionId, candidateId) => store.find(sessionId, candidateId, now()),
      recordTest: (sessionId, candidateId, test) => {
        store.recordTest(sessionId, candidateId, test, now());
      },
      markRegistered: (sessionId, candidateId, deviceId) => {
        store.markRegistered(sessionId, candidateId, deviceId, now());
      },
    },
    provideAdapter(given) {
      if (provided !== null) throw new Error('the discovery adapter factory was provided twice');
      provided = given;
    },
    ready: () => factory() !== null,
    discardSession(sessionId) {
      store.discardSession(sessionId);
      limiter.forgetSession(sessionId);
    },
    onSearchClosed: (listener) => runner.onClosed(listener),
    searchesStarted: () => runner.started(),
    heldLists: () => store.size(),
    expirySettled: () => expiryWatch.settled(),
  };
  controls.set(app.stages, control);

  // THE NO-DEVICE NOTIFIER (row 133; C3 §5.4 situation A; D80(8)). It is told of EVERY closed camera
  // search, whatever started it: an empty one raises the one alert, the next one with a responder
  // resolves it. It writes no audit row: the search's own row is the only one. A failure there is
  // logged and persisted by the runner; the search stands.
  const notices = captureNotices(app);
  runner.onClosed(async ({ search }) => {
    await notices.notifier.searchClosed({
      searchId: search.searchId,
      trigger: search.trigger,
      outcome: search.state === CaptureDiscoveryState.FAILED ? 'FAILED' : 'COMPLETE',
      responderCount: search.responderCount,
    });
  });
  notices.provideDiscovery(precheckSearch);

  registerCaptureDiscoveryRoutes(app, { runner, store });

  // THE CONFIRMED RE-ADDRESS (task 4 rows 97 / 197: operation 100; `readdress-route.ts`). It is given the
  // candidate state of THIS module, asked by the caller's session on the server clock - and none while the
  // Core has no camera search (503). The destination rule's network facts are handed in by the production
  // composition (`captureReaddressControl(app).provideNetworkFacts`); until then every address is refused.
  registerCaptureReaddressRoute(app, { candidates: () => (factory() === null ? null : control.candidates) });

  // THE CONNECT FLOW (row 142: operations 95, 96 and 89; `connect/`). Its routes are registered
  // here, and it is given what this module owns: the candidate state (by the caller's session, on
  // the server clock), the read-only connection tester of the camera adapter, and the registrar
  // that makes an adopted camera part of the registry inside the adoption's own unit. The
  // credential sealer is the connect flow's own (the one Core credential store, at `onReady`).
  const connect = registerCaptureConnectRoutes(app);
  connect.provideCandidates(candidateDirectoryOf(store, now));
  // THE CONNECTION TEST HAS TWO HALVES (task 4 row 50; amendment AM-2; AD-06). The ONVIF half says the
  // camera answers, takes the credential and names its streams. The STREAM half lets the capture relay
  // probe each named stream (through the production door) and the Core judge it: the codec from the
  // bytes of the parameter sets, the code by the SEAL'S OWN two functions, handed in here - so a tested
  // camera is stated exactly as its sealed recording will be. It runs only for a test with a credential
  // on a Core that has a relay program (`captureRelayPath`); without either the answer is the ONVIF
  // half's own and no code exists. A failure of the relay itself is a fault of the HOST: said in the
  // log and the persistent error log by its code, while the operator gets the outcome of the contract.
  const streamTester = createStreamConnectionTester({
    onvif: createOnvifConnectionTester({ timers }),
    locator: createOnvifStreamLocator({ timers }),
    door: startProductionProcess,
    relayProgram: app.config.captureRelayPath,
    timers,
    statement: { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate },
    tell: (note) => {
      app.log.error({ source: `${SOURCE}.streamTest`, code: note.code, relayWord: note.reason }, STREAM_TEST_FAULT);
      app.errorLog.append({ level: 'error', source: `${SOURCE}.streamTest`, message: STREAM_TEST_FAULT, code: note.code, context: { relayWord: note.reason } });
    },
  });
  connect.provideTester(streamTester);
  // THE CONNECTION TEST OF AN ADOPTED CAMERA WITH ITS STORED CREDENTIAL (task 4 row 146; AD-03 (5), AD-02 (1);
  // `adopted-test.ts`). It is given the SAME tester and the SAME limits object as operations 95 and 96, so the
  // single flight, the spacing and the lock-out guard of a host count a typed test and a stored one alike. The reader
  // (bound to the reason `CONNECTION_TEST`) and the destination rule (bound to the host's facts) are handed in by the
  // production composition through `adoptedCameraTestControl(app).provide`; until then a test answers 503 before
  // anything is read. Its route is operation 108 (row 146b, `adopted-test-route.ts`), mounted below. The OUTCOME entry
  // of a test (`record`) is appended in one unit of its own, after the reader's reveal has committed.
  registerAdoptedCameraTest(app, {
    host: {
      now,
      state: () => app.engine.state(),
      query: (text, values) => app.db.read(`${SOURCE}.adoptedCamera`, (pool) => pool.query(text, values)),
      after: (delayMs, callback) => timers.after(delayMs, callback),
      note: (fields, message) => app.log.info(fields, message),
      persist: (entry) => app.errorLog.append({ level: 'warn', source: `${SOURCE}.adoptedTest`, message: entry.message, code: entry.code, context: { ...entry.context } }),
      record: (entry) => app.pipeline.run(`${SOURCE}.adoptedTested`, async (unit) => void (await unit.audit.append(entry))),
    },
    limits: () => connect.limits,
    tester: () => streamTester,
  });
  registerAdoptedCameraTestRoute(app);
  // Fix wave I (re-gate 70, finding G70b-01): the adapter registry of the running operation is built
  // at boot from the stored devices of that moment. A camera adopted afterwards is handed to it WHEN
  // THE ADOPTION COMMITTED (never for a unit that rolled back), before the next unit starts: the
  // selector can assign it at once. A failure here does not undo the adoption - it is logged and
  // persisted, and the next start of the Core serves the stored row as before.
  const admitAdopted = (device: AdoptedCamera): void => {
    try {
      const admission = captureFenceControl(app).admitDevice({ id: device.id, kind: 'CAMERA', adapterKind: device.adapterKind as CaptureAdapterKind, model: device.model });
      app.log.info({ code: 'CAPTURE_DEVICE_ADMITTED', source: `${SOURCE}.admit`, deviceId: device.id, admission }, 'adopted camera handed to the adapter registry');
    } catch (error) {
      const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : 'UNKNOWN';
      app.log.error({ source: `${SOURCE}.admit`, code, deviceId: device.id }, ADMIT_FAILED);
      app.errorLog.append({
        level: 'error',
        source: `${SOURCE}.admit`,
        message: ADMIT_FAILED,
        ...(error instanceof Error && error.stack !== undefined ? { stackTrace: error.stack } : {}),
        context: { code, deviceId: device.id },
      });
    }
  };
  connect.provideRegistrar(async (scope, _principal, device) => {
    const registered = await registerAdoptedCamera(scope, device);
    scope.unit.afterCommit(() => admitAdopted(device));
    return registered;
  });

  // SIGN-OUT (C3 §3.1 "signOut and session expiry"; R-9 AC-4): the list of the session that signed
  // out is discarded with the answer. The principal is the one stage 4 resolved for this request.
  app.addHook('onResponse', async (request, reply) => {
    if (request.routeOptions.config.operationId !== SIGN_OUT_OPERATION || reply.statusCode >= 300) return;
    if (request.principal.kind === 'OPERATOR') control.discardSession(request.principal.sessionId);
  });

  // EXPIRY (the same clause of C3 §3.1; integration pass C1): a session that expires makes no
  // request, so no response hook sees it. After every commit that holds an `AUTH_EXPIRED` row the
  // watch asks which of the sessions that own a list or starts here have ended, and discards those
  // at once (`session-expiry.ts`). A failed read frees nothing early and is logged and persisted.
  let stopWatching: (() => void) | null = null;
  app.addHook('onReady', async () => {
    stopWatching = app.pipeline.onCommit((unit) => expiryWatch.committed(unit));
  });

  // The server stops: a search that is running is ended (the adapter closes its socket) and every list is gone.
  app.addHook('onClose', async () => {
    stopWatching?.();
    runner.abort();
    store.clear();
  });
};
