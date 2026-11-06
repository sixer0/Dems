/**
 * Debug-build device probes (backend task plan rows W12 and W15). NEVER part of a release build:
 * the only reference to this module is the `require` inside the `if (__DEV__)` block of
 * `runDevProbeFromUrl` in `./debug.ts`, which Metro removes from a release bundle together with
 * this module.
 *
 * A probe is started by a deep link, on an emulator whose device port 4420 is mapped to a host port
 * (`DEMS_CORE_HOST_PORT`, `scripts/device-session.sh`):
 *
 *   adb shell "am start -W -a android.intent.action.VIEW -d 'demsdemo:///?probe=core-client&run=<id>' com.dems.demo.tablet"
 *
 * It writes one line per check to the device log (`adb logcat -d -s ReactNativeJS:V`), each starting
 * with `[DEMS-PROBE-W12 run=<id>]` and holding `PASS` or `FAIL`, and a final `DONE` line. A failed
 * check is also written to the persistent runtime log.
 *
 * | Probe | Proves |
 * |-------|--------|
 * | `core-client` | Early proof (e): the registry-driven typed client (`@dems/shared/client`, HB-9) on Hermes with the default global `fetch`: GET, POST with a JSON body and a bearer header, the error envelope, 429 with `retry-after`, a contract violation, no answer, the time-out; and a socket opened with an `Authorization` header (CA-08). The clients are the default ones, typed by the registry's literal table |
 * | `secure-store` | Early proof (g), plan row W15: `expo-secure-store` through the wrapper `./secure-credentials` (the package's only importer). One fixed probe item, `dems.live.probe.v1`, with a meaningless value made on the device: written, read and deleted without an authentication requirement, then with `requireAuthentication: true` (write, read, the write after a rotation, delete). Its lines carry the tag `[DEMS-PROBE-W15 run=<id>]`. It needs no Core server and no reverse rule. A protected step that does not settle within 8 s is reported as `pending` (an OS prompt is waiting; nothing answers it) and the remaining protected steps are skipped. The item is deleted at the end in every case |
 * | `secure-store-wait` | The same probe, waiting 60 s per protected step: for a re-run on a device where the USER answers the OS prompts (no agent does) |
 *
 * The probe holds no secret. Its bearer value is an obviously fake string made at run time; only its
 * prefix and length are ever logged. It changes no setting of the app. The harness offers a dummy
 * cookie on the first request, to measure whether the app ever sends one back; the last two checks
 * delete it again, and it expires by itself after 60 s.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import { fetch as expoFetch } from 'expo/fetch';
import { CORE_API_EXAMPLES, EvidenceExportRequestSchema, SessionStopRequestSchema, sessionCreateSchema } from '@dems/shared/api';
import { createCoreClient, type CoreCallResult, type CoreClientLogLine, type CoreFetch } from '@dems/shared/client';
import { reportRuntimeIssue } from './log';
import {
  isUnprotectedBiometricItemAllowed,
  secureStoreDevProbe,
  type SecureStoreOutcome,
  type SecureStoreRead,
} from './secure-credentials';

/** The address every app build uses for the Core server; `adb reverse` maps it to the host (01_specs §2.4). */
const CORE_ORIGIN = 'http://127.0.0.1:4420';
const CORE_SOCKET_URL = 'ws://127.0.0.1:4420/ws';
/** A device port with no reverse rule and no listener: a request to it gets no answer. */
const DEAD_ORIGIN = 'http://127.0.0.1:4429';
const LOG_TAG = 'DEMS-PROBE-W12';
/** The log tag of a probe that is not W12's. A name without an entry keeps `LOG_TAG`. */
const LOG_TAGS: Readonly<Record<string, string>> = {
  'secure-store': 'DEMS-PROBE-W15',
  'secure-store-wait': 'DEMS-PROBE-W15',
};

type Details = Record<string, unknown>;
type Line = (check: string, pass: boolean, details: Details) => void;

export interface DevProbeContext {
  /** The run ID of the deep link, echoed in every log line. */
  readonly run: string;
  /** Writes one PASS or FAIL line. */
  readonly line: Line;
}

/** An obviously fake device credential, made at run time. Never a real one, never logged in full. */
function fakeCredential(): string {
  let hex = '';
  for (let index = 0; index < 32; index += 1) hex += Math.floor(Math.random() * 16).toString(16);
  return `dvc_PROBE_FAKE_${hex}`;
}

function describeCredential(value: string): Details {
  return { prefix: value.slice(0, 4), length: value.length };
}

/**
 * The contract's own request example of an operation. The examples table holds plain values and the
 * typed client takes each body with the type of its schema, so the caller parses the example with the
 * registry's schema for that body (on the device; an example that its schema refuses makes the probe
 * report a FAIL line).
 */
function requestExample(operationId: string): unknown {
  const examples = CORE_API_EXAMPLES[operationId]?.request;
  return examples ? Object.values(examples)[0]?.value : undefined;
}

/** What a result looks like, without its payload. */
function outline(result: CoreCallResult): Details {
  return result.ok
    ? { ok: true, status: result.status, epoch: result.epoch, revision: result.revision, requestId: result.requestId }
    : {
        ok: false,
        kind: result.kind,
        status: result.status,
        code: result.error.code,
        retryAfterSeconds: result.retryAfterSeconds,
        transport: result.transport,
        requestId: result.requestId,
        ...(result.issues ? { issues: result.issues } : {}),
      };
}

/** A raw POST with the global fetch and its default options (no `credentials` member); the JSON answer or the error text. */
async function rawPost(path: string): Promise<{ status: number | null; body: Details | null; error: string | null }> {
  try {
    const response = await fetch(`${CORE_ORIGIN}${path}`, { method: 'POST' });
    const text = await response.text();
    return { status: response.status, body: JSON.parse(text) as Details, error: null };
  } catch (error) {
    return { status: null, body: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * React Native's `WebSocket` constructor takes a third argument that a browser's does not:
 * `{ headers }`, sent with the upgrade request (`react-native/src/types/globals.d.ts`). The app's
 * type environment declares the browser signature, so the device signature is stated here.
 */
type HeaderSocketConstructor = new (
  url: string,
  protocols: string | string[] | null,
  options: { headers: Record<string, string> },
) => WebSocket;
const HeaderSocket = WebSocket as unknown as HeaderSocketConstructor;

interface SocketOutcome {
  opened: boolean;
  hello: Details | null;
  echoed: boolean;
  closeCode: number | null;
  closeReason: string | null;
  error: string | null;
}

/**
 * Opens the socket with the bearer value in a HEADER of the upgrade request (React Native's
 * `WebSocket` takes a third argument, `{ headers }`), exchanges one message, then asks the harness
 * to close with `closeWith` and reports the close code the device sees.
 */
function socketRoundTrip(bearer: string, closeWith: number, timeoutMs = 6_000): Promise<SocketOutcome> {
  return new Promise((resolve) => {
    const outcome: SocketOutcome = { opened: false, hello: null, echoed: false, closeCode: null, closeReason: null, error: null };
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const socket = new HeaderSocket(CORE_SOCKET_URL, null, { headers: { Authorization: `Bearer ${bearer}` } });
    const timer = setTimeout(() => {
      outcome.error = 'no close within the time-out';
      try {
        socket.close();
      } catch {
        // Already closed.
      }
      finish();
    }, timeoutMs);
    socket.onopen = () => {
      outcome.opened = true;
    };
    socket.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : '';
      if (outcome.hello === null) {
        try {
          outcome.hello = JSON.parse(text) as Details;
        } catch {
          outcome.error = 'the first message is not JSON';
        }
        socket.send('ping-w12');
        return;
      }
      if (text === 'echo:ping-w12') {
        outcome.echoed = true;
        socket.send(`close:${closeWith}`);
      }
    };
    socket.onerror = (event) => {
      const message = (event as { message?: unknown }).message;
      outcome.error = typeof message === 'string' ? message : 'socket error';
    };
    socket.onclose = (event) => {
      outcome.closeCode = typeof event.code === 'number' ? event.code : null;
      outcome.closeReason = typeof event.reason === 'string' ? event.reason : null;
      finish();
    };
  });
}

/** Early proof (e), plan row W12. */
async function coreClientProbe({ line }: DevProbeContext): Promise<void> {
  const bearer = fakeCredential();
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  const log: CoreClientLogLine[] = [];
  const report = (entry: { kind: string; operationId: string; status: number | null; message: string }) =>
    reportRuntimeIssue('info', 'runtime.devProbes.coreClient.report', entry.message, {
      kind: entry.kind,
      operationId: entry.operationId,
      status: entry.status,
    });

  // P0a: which runtime, and which `fetch` is the global one. Measured on the first device run: the
  // global is not the `expo/fetch` export itself but Expo's wrapper around it, a function named
  // `_fetch` that resolves a relative URL and then calls the fetch it wrapped
  // (`@expo/metro-runtime/src/location/install.native.ts:55-91`); it marks itself with the symbol
  // below. So the check is: the export itself, or that wrapper. P0b then proves by the class of the
  // answer that the wrapped function is `expo/fetch`.
  const hermes = (globalThis as { HermesInternal?: { getRuntimeProperties?: () => Record<string, unknown> } }).HermesInternal;
  const isExpoFetch = globalFetch === expoFetch;
  const isExpoWrapper =
    typeof globalFetch === 'function' &&
    (globalFetch as unknown as Record<symbol, unknown>)[Symbol.for('expo.polyfillFetchWithWindowLocation')] === true;
  line('P0a runtime and global fetch', (isExpoFetch || isExpoWrapper) && typeof hermes === 'object', {
    globalFetchIsExpoFetch: isExpoFetch,
    globalFetchIsExpoRelativeUrlWrapper: isExpoWrapper,
    globalFetchName: typeof globalFetch === 'function' ? globalFetch.name : typeof globalFetch,
    hermes: typeof hermes === 'object',
    hermesVersion: hermes?.getRuntimeProperties?.()['OSS Release Version'] ?? null,
    os: Platform.OS,
    osVersion: Platform.Version,
    reactNative: Platform.constants.reactNativeVersion,
    useRnFetchFlag: process.env.EXPO_PUBLIC_USE_RN_FETCH ?? null,
    globals: {
      ReadableStream: typeof (globalThis as { ReadableStream?: unknown }).ReadableStream,
      AbortController: typeof AbortController,
      TextDecoder: typeof (globalThis as { TextDecoder?: unknown }).TextDecoder,
      Headers: typeof Headers,
      WebSocket: typeof WebSocket,
    },
  });

  // The first client injects nothing: the typed client looks the global fetch up itself (CL-3).
  const client = createCoreClient({ baseUrl: CORE_ORIGIN, credentials: () => bearer, log: (entry) => log.push(entry), report });
  // The second injects the global fetch explicitly: the same function, passed the way the app will pass it.
  const injected = createCoreClient({
    baseUrl: CORE_ORIGIN,
    credentials: () => bearer,
    fetch: globalFetch as CoreFetch,
    log: (entry) => log.push(entry),
    report,
  });

  // P1: one GET, validated by zod on the device.
  const health = await client.call('getServiceHealth');
  line('P1 GET getServiceHealth', health.ok && health.status === 200 && health.data.status === 'ok', {
    ...outline(health),
    service: health.ok ? health.data.service : null,
  });

  // P1b: the typed client sent P1 with `credentials: 'omit'`, and the answer offered a cookie. Did the
  // app store it? A raw request with default options tells: a measurement, either answer passes.
  const afterOmit = await rawPost('/api/v1/proof/echo');
  line("P1b cookie store after a 'credentials: omit' answer", afterOmit.status === 200, {
    status: afterOmit.status,
    cookieStoredByOmitRequest: afterOmit.body?.cookiePresent ?? null,
    error: afterOmit.error,
  });

  // P0b: the answer of the global fetch has the class of an answer of the `expo/fetch` export (the same
  // constructor object), with the properties that tell it from React Native's polyfill: `_rawHeaders`
  // and a stream as `body`, no `_bodyInit`. Both requests use default options, so the harness's dummy
  // cookie is in the app's cookie store from here on.
  try {
    const raw = await fetch(`${CORE_ORIGIN}/api/v1/health`);
    const stream = (raw as { body?: unknown }).body;
    const text = await raw.text();
    const direct = await expoFetch(`${CORE_ORIGIN}/api/v1/health`);
    await direct.text();
    const sameClass = (raw as object).constructor === (direct as object).constructor;
    line('P0b raw global fetch answer', raw.status === 200 && text.length > 0 && sameClass && '_rawHeaders' in raw && !('_bodyInit' in raw), {
      status: raw.status,
      responseClass: (raw as object).constructor?.name ?? null,
      sameClassAsExpoFetchAnswer: sameClass,
      hasRawHeaders: '_rawHeaders' in raw,
      hasPolyfillBodyInit: '_bodyInit' in raw,
      bodyType: stream === null ? 'null' : typeof stream,
      bodyClass: stream !== null && typeof stream === 'object' ? ((stream as object).constructor?.name ?? null) : null,
      textLength: text.length,
      contentType: raw.headers.get('content-type'),
      headerLookupIsCaseInsensitive: raw.headers.get('Content-Type') === raw.headers.get('content-type'),
    });
  } catch (error) {
    line('P0b raw global fetch answer', false, { error: error instanceof Error ? error.message : String(error) });
  }

  // P2: one POST with a JSON body and a bearer header, validated by zod; the two state headers are read.
  const created = await injected.call('createSession', { body: sessionCreateSchema.parse(requestExample('createSession')) });
  line(
    'P2 POST createSession',
    created.ok && created.status === 201 && created.data.state === 'CREATE' && Number.isInteger(created.epoch) && Number.isInteger(created.revision),
    {
      ...outline(created),
      sessionId: created.ok ? created.data.sessionId : null,
      state: created.ok ? created.data.state : null,
      bearer: describeCredential(bearer),
    },
  );

  // P3: an error envelope, parsed as ApiError and classed by its status.
  const exported = await injected.call('exportEvidence', {
    params: { id: CORE_API_EXAMPLES.exportEvidence?.pathParams?.id ?? 'EV-20260930-0004' },
    body: EvidenceExportRequestSchema.parse(requestExample('exportEvidence')),
  });
  line(
    'P3 POST exportEvidence 403',
    !exported.ok && exported.status === 403 && exported.kind === 'FORBIDDEN' && exported.error.code === 'FORBIDDEN' && exported.error.message.length > 0,
    { ...outline(exported), messageLength: exported.ok ? 0 : exported.error.message.length },
  );

  // P4: a 429 keeps its class and the retry-after header.
  const limited = await injected.call('stopSession', {
    params: { id: CORE_API_EXAMPLES.stopSession?.pathParams?.id ?? 'SES-20261001-0024' },
    body: SessionStopRequestSchema.parse(requestExample('stopSession')),
  });
  line(
    'P4 POST stopSession 429 retry-after',
    !limited.ok && limited.status === 429 && limited.kind === 'RATE_LIMITED' && limited.retryAfterSeconds === 42 && limited.transport === 'UNAVAILABLE',
    outline(limited),
  );

  // P5: a 2xx body that violates its schema never reaches the caller.
  const violated = await client.call('getStorageStatus');
  line(
    'P5 GET getStorageStatus contract violation',
    !violated.ok && violated.kind === 'CONTRACT_VIOLATION' && violated.status === 200 && !('data' in violated),
    outline(violated),
  );

  // P6: no answer (nothing listens on that device port).
  const dead = createCoreClient({ baseUrl: DEAD_ORIGIN, credentials: () => bearer, report });
  const startedDead = Date.now();
  const unanswered = await dead.call('getServiceHealth');
  line('P6 GET with no listener', !unanswered.ok && unanswered.kind === 'NETWORK' && unanswered.transport === 'CORE_OFFLINE', {
    ...outline(unanswered),
    elapsedMs: Date.now() - startedDead,
  });

  // P7: the time-out (CL-6), with the abort signal of the runtime. The harness answers this route after 3 s.
  const impatient = createCoreClient({ baseUrl: CORE_ORIGIN, credentials: () => bearer, timeoutMs: 1_000, report });
  const startedSlow = Date.now();
  const slow = await impatient.call('getVideoStatus');
  const elapsedSlow = Date.now() - startedSlow;
  line('P7 GET getVideoStatus time-out', !slow.ok && slow.kind === 'TIMEOUT' && elapsedSlow >= 900 && elapsedSlow < 2_500, {
    ...outline(slow),
    elapsedMs: elapsedSlow,
  });

  // P8: the client's own debug log holds method, route template, status and request ID only (CL-6a).
  const logText = JSON.stringify(log);
  line('P8 debug log', log.length === 5 && !logText.includes(bearer) && log.every((entry) => Object.keys(entry).length === 4), {
    lines: log.map((entry) => `${entry.method} ${entry.path} ${entry.status ?? '-'} ${entry.requestId ?? '-'}`),
  });

  // P9: a socket with the bearer value in a header of the upgrade; one message echoed; close code 4403 (CA-08).
  const revoked = await socketRoundTrip(bearer, 4403);
  const helloAuth = (revoked.hello?.authorization ?? null) as { present?: unknown; scheme?: unknown; prefix?: unknown } | null;
  line(
    'P9 WebSocket Authorization header, echo, close 4403',
    revoked.opened && helloAuth?.present === true && helloAuth.scheme === 'Bearer' && helloAuth.prefix === 'dvc_' && revoked.echoed && revoked.closeCode === 4403,
    {
      opened: revoked.opened,
      serverSawAuthorization: helloAuth,
      serverSawOrigin: revoked.hello?.origin ?? null,
      serverSawHost: revoked.hello?.host ?? null,
      serverSawCookie: revoked.hello?.cookiePresent ?? null,
      serverSawUserAgent: revoked.hello?.userAgent ?? null,
      echoed: revoked.echoed,
      closeCode: revoked.closeCode,
      closeReason: revoked.closeReason,
      error: revoked.error,
    },
  );

  // P10: the other close code the app must tell apart (CA-08).
  const ended = await socketRoundTrip(bearer, 4401);
  line('P10 WebSocket close 4401', ended.opened && ended.echoed && ended.closeCode === 4401, {
    opened: ended.opened,
    echoed: ended.echoed,
    closeCode: ended.closeCode,
    closeReason: ended.closeReason,
    error: ended.error,
  });

  // P11: does a raw fetch with default options send the harness's dummy cookie back? A measurement:
  // either answer passes. The answer also deletes the cookie from the app's cookie store.
  const forgot = await rawPost('/api/v1/proof/forget-cookie');
  line('P11 raw fetch, default credentials: cookie sent back?', forgot.status === 200, {
    status: forgot.status,
    cookieSentBack: forgot.body?.cookiePresent ?? null,
    serverSawOrigin: forgot.body?.origin ?? null,
    error: forgot.error,
  });

  // P12: the app is left without the dummy cookie.
  const after = await rawPost('/api/v1/proof/echo');
  line('P12 no cookie is left in the app', after.status === 200 && after.body?.cookiePresent === false, {
    status: after.status,
    cookiePresent: after.body?.cookiePresent ?? null,
    error: after.error,
  });
}

/** A meaningless probe value, made on the device at each run. Never a credential, never logged. */
function probeValue(): string {
  let hex = '';
  for (let index = 0; index < 24; index += 1) hex += Math.floor(Math.random() * 16).toString(16);
  return `PROBE_W15_${hex}`;
}

type StoreStep = SecureStoreOutcome | SecureStoreRead<string>;

/** What one secure-store step did, without any value. `pending`: it did not settle in the wait. */
interface StepObservation {
  readonly outcome: 'ok' | 'threw' | 'pending';
  readonly ms: number;
  readonly result: StoreStep | null;
}

function describeStep(step: StepObservation): Details {
  const { result } = step;
  if (result === null) return { outcome: step.outcome, ms: step.ms };
  if (!result.ok) return { outcome: step.outcome, ms: step.ms, code: result.code, messageClass: result.reason, nativeCode: result.nativeCode };
  return { outcome: step.outcome, ms: step.ms };
}

/**
 * Runs one step of the wrapper's probe item and measures it. The wrapper never throws, so `threw`
 * means "the store rejected and the wrapper returned its code". A step still unsettled after
 * `waitMs` is `pending`: on a device with an enrolled fingerprint that is the OS prompt waiting.
 */
async function observe(run: () => Promise<StoreStep>, waitMs: number): Promise<StepObservation> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs);
  });
  try {
    const result = await Promise.race([run(), pending]);
    const ms = Date.now() - started;
    if (result === null) return { outcome: 'pending', ms, result: null };
    return { outcome: result.ok ? 'ok' : 'threw', ms, result };
  } catch (error) {
    // Not expected (the wrapper returns failures); kept so that a probe step can never throw.
    reportRuntimeIssue('error', 'runtime.devProbes.secureStore.step', error instanceof Error ? error.name : 'unknown error');
    return { outcome: 'threw', ms: Date.now() - started, result: null };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Whether a read returned the expected text: `equal`, `absent` or `different`. Never the text. */
function compare(step: StepObservation, expected: string): 'equal' | 'absent' | 'different' | 'not-read' {
  const { result } = step;
  if (result === null || !result.ok || !('value' in result)) return 'not-read';
  if (result.value === null) return 'absent';
  return result.value === expected ? 'equal' : 'different';
}

/**
 * Early proof (g), plan row W15. The unprotected steps must work (PASS or FAIL). A protected step
 * is an OBSERVATION: its line is PASS when the step was observed, whatever it did, and the details
 * say what it did (`ok`, `threw` with the code and the message class, or `pending`). Nothing is
 * done to make a protected step succeed.
 */
async function secureStoreProbe({ line }: DevProbeContext, waitMs: number): Promise<void> {
  const probe = secureStoreDevProbe;
  if (probe === null) {
    line('S0 environment', false, { error: 'the wrapper exports no probe (not a debug build)' });
    return;
  }

  // S0: what the device and the library say. Read-only calls; none of them shows a prompt.
  const localAuth: Details = {};
  try {
    localAuth.hasHardware = await LocalAuthentication.hasHardwareAsync();
    localAuth.isEnrolled = await LocalAuthentication.isEnrolledAsync();
    localAuth.enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
  } catch (error) {
    localAuth.error = error instanceof Error ? error.name : 'unknown error';
  }
  line('S0 environment', true, {
    isDevice: Device.isDevice,
    platformApiLevel: Device.platformApiLevel,
    osVersion: Platform.Version,
    model: Device.modelName,
    deviceType: Device.deviceType,
    debugBuild: __DEV__,
    canUseBiometricAuthentication: probe.canUseBiometricAuthentication(),
    unprotectedBiometricItemAllowed: isUnprotectedBiometricItemAllowed(),
    localAuthentication: localAuth,
    item: probe.itemKey,
    waitMs,
  });

  // S1: nothing is left from an earlier run (an item left behind is deleted and reported).
  const before = await observe(() => probe.read(false), waitMs);
  const leftover = compare(before, '') !== 'absent';
  if (leftover) await observe(() => probe.remove(), waitMs);
  line('S1 probe item absent before the run', before.outcome === 'ok' && !leftover, { ...describeStep(before), leftoverDeleted: leftover });

  // U1 to U4: the item without an authentication requirement (how the device credential is stored).
  const plain = probeValue();
  const plainWrite = await observe(() => probe.write(plain, false), waitMs);
  line('U1 unprotected write', plainWrite.outcome === 'ok', describeStep(plainWrite));
  const plainRead = await observe(() => probe.read(false), waitMs);
  line('U2 unprotected read gives the written value', compare(plainRead, plain) === 'equal', {
    ...describeStep(plainRead),
    read: compare(plainRead, plain),
    length: plain.length,
  });
  const plainDelete = await observe(() => probe.remove(), waitMs);
  line('U3 unprotected delete', plainDelete.outcome === 'ok', describeStep(plainDelete));
  const plainGone = await observe(() => probe.read(false), waitMs);
  line('U4 read after the delete gives nothing', compare(plainGone, plain) === 'absent', { ...describeStep(plainGone), read: compare(plainGone, plain) });

  // P1 to P6: the item with `requireAuthentication: true` (how the biometric token would be stored).
  // Observations only. After a `pending` step the OS prompt is still open, so the rest is skipped.
  const first = probeValue();
  const second = probeValue();
  const third = probeValue();
  let blocked = false;
  const protectedStep = async (check: string, run: () => Promise<StoreStep>, extra: (step: StepObservation) => Details = () => ({})) => {
    if (blocked) {
      line(check, true, { outcome: 'skipped', why: 'an earlier protected step is still pending' });
      return;
    }
    const step = await observe(run, waitMs);
    if (step.outcome === 'pending') blocked = true;
    line(check, true, { ...describeStep(step), ...extra(step) });
  };
  await protectedStep('P1 protected write', () => probe.write(first, true));
  await protectedStep('P2 protected read', () => probe.read(true), (step) => ({ read: compare(step, first) }));
  await protectedStep('P3 rotation: delete of the old value', () => probe.remove());
  await protectedStep('P4 rotation: protected write of a new value', () => probe.write(second, true));
  await protectedStep('P5 rotation in place: protected write over the stored value', () => probe.write(third, true));
  await protectedStep('P6 protected read after the rotation', () => probe.read(true), (step) => ({ read: compare(step, third) }));

  // Z1, Z2: the probe item is gone, whatever happened above. A delete needs no authentication.
  const cleanup = await observe(() => probe.remove(), waitMs);
  line('Z1 delete of the probe item', cleanup.outcome === 'ok', describeStep(cleanup));
  const after = await observe(() => probe.read(false), waitMs);
  line('Z2 probe item absent after the run', compare(after, first) === 'absent', { ...describeStep(after), read: compare(after, first), protectedStepPending: blocked });
}

const PROBES: Readonly<Record<string, (context: DevProbeContext) => Promise<void>>> = {
  'core-client': coreClientProbe,
  'secure-store': (context) => secureStoreProbe(context, 8_000),
  'secure-store-wait': (context) => secureStoreProbe(context, 60_000),
};

/** Probe names in flight, so a link delivered twice (launch URL and link event) runs a probe once. */
const running = new Set<string>();

/**
 * Runs the named probe and logs its lines. Called only by `runDevProbeFromUrl` (`./debug.ts`).
 * Never throws: a probe that throws is logged as a FAIL line and reported.
 */
export async function runDevProbe(name: string, run: string): Promise<void> {
  const prefix = `[${LOG_TAGS[name] ?? LOG_TAG} run=${run}]`;
  const key = `${name}/${run}`;
  if (running.has(key)) return;
  running.add(key);
  let passed = 0;
  let failed = 0;
  const line: Line = (check, pass, details) => {
    if (pass) passed += 1;
    else {
      failed += 1;
      reportRuntimeIssue('error', `runtime.devProbes.${name}`, `${check}: FAIL`, { run, details: JSON.stringify(details).slice(0, 400) });
    }
    console.log(`${prefix} ${check} ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(details)}`);
  };
  try {
    const probe = PROBES[name];
    if (!probe) {
      line(`unknown probe "${name}"`, false, { known: Object.keys(PROBES) });
    } else {
      console.log(`${prefix} START ${name}`);
      await probe({ run, line });
    }
  } catch (error) {
    line(`${name} threw`, false, { error: error instanceof Error ? error.message : String(error) });
  } finally {
    running.delete(key);
    console.log(`${prefix} DONE ${name} pass=${passed} fail=${failed}`);
  }
}
