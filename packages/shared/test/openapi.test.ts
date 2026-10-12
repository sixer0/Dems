// AC-56 (masterplan/01_specs.md §14.9, §14.14; blueprint step 33): the OpenAPI 3.1.0 document is
// valid for @scalar/openapi-parser, has 31 operations (health LIVE, the 30 simulated endpoints — the
// 9 §21.2 endpoints, the 13 capture/transcript ones added by OD-17 and the 3 STT configuration ones
// of task 3 M6 row 113, C3 §2.5 — SIMULATED), carries only
// allowed extensions, matches the committed openapi.json, and agrees with the simulator's handlers
// (sim/api.ts) and canonical dataset.
//
// Backend task (2026-10-04, plan row W19): the registry now holds more operations than these ten.
// `createOpenApiDocument()` returns the `offline` scope, which is the document this file has always
// described, so its assertions stand. The one that compared the components with the whole schema
// registry is narrowed to the scope by design; test/api-openapi-scope.test.ts covers the `all` scope.
//
// Plan row W27 (contract C; 01_specs §7.19, AC-B-11): the registry is complete, and two assertions
// changed by design. The committed openapi.json now holds the `all` scope (97 operations, two
// security schemes), so the drift check compares the file with that scope. And the five simulated
// reads and `startSession` document statuses that only the Core server sends, so the comparison
// with the simulator covers the statuses the simulator can produce. The `x-` check below still runs
// on the offline document; the `all` scope, where `x-request-id` is a response header name, has
// its own in test/api-openapi-scope.test.ts.
import { readFileSync } from 'node:fs';
import { dereference, validate } from '@scalar/openapi-parser';
import { describe, expect, it } from 'vitest';
import { OPENAPI_COMMITTED_SCOPE, OPENAPI_JSON_PATH, renderOpenApiJson } from '../scripts/gen-openapi';
import {
  API_BADGES,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CORE_HTTP_ORIGIN,
  CORE_WS_URL,
  EXAMPLE_IDS,
  HEALTH_PATH,
  HeartbeatSchema,
  CoreApiScope,
  OPENAPI_ALLOWED_EXTENSION,
  OPENAPI_EXAMPLE_INSTANT,
  SIMULATED_HEADER_NAME,
  SIMULATED_HEADER_VALUE,
  createOpenApiDocument,
  listCoreApiResponseStatuses,
  listOpenApiOperations,
  matchCoreApiOperation,
  serializeOpenApiDocument,
  validateCoreApiResponse,
  type CoreApiOperation,
} from '../src/api';
import {
  CORE_SERVICES,
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  OperatorRole,
  RECORDING_SCENARIO,
  SIM_API_ROUTES,
  caseNumberFor,
  createManualClock,
  createSim,
  roleHas,
  sessionIdFor,
  type ControllableClock,
  type Sim,
} from '../src/sim';

const AT = Date.parse(OPENAPI_EXAMPLE_INSTANT);

/** The components of the 33 offline operations (ten baseline + thirteen simulated capture + three STT configuration + five of the camera search + two of the sound cards), in builder order. */
const OFFLINE_SCHEMA_NAMES = [
  'HealthResponse',
  'SessionCreateRequest',
  'SessionStartRequest',
  'SessionStopRequest',
  'SessionCommandResponse',
  'PrecheckItem',
  'SessionResource',
  'CurrentSessionResponse',
  'VideoTrackStatus',
  'AudioChannelStatus',
  'VideoStatusResponse',
  'AudioStatusResponse',
  'StorageStatusResponse',
  'DeviceHealthResponse',
  'EvidenceExportRequest',
  'EvidenceExportAccepted',
  'EvidenceExportCompositeOptions',
  'ApiError',
  'Heartbeat',
  'CaptureConfigSlice',
  'CaptureDevicesSlice',
  'PageQuery',
  'CaptureConfigCameraUpdate',
  'CaptureConfigMicUpdate',
  'CaptureConfigUpdateRequest',
  'CaptureCameraSourceRequest',
  'CaptureCredentialWriteRequest',
  'AudioSourceSwitchRequest',
  'AudioSourceState',
  'AudioSourceIntervalEntry',
  'AudioSourceIntervalPage',
  'SealingProgressStep',
  'SealingProgress',
  'TranscriptSegment',
  'TranscriptDocument',
  'TranscriptRevisionRequest',
  'TranscriptRevision',
  'TranscriptRevisionPage',
  'EvidenceExportJob',
  // Task 3 M6 (blueprint row 113; C3 §2.5): the six STT configuration schemas of ops 90-92.
  'SttLastTest',
  'SttConfig',
  'SttCredentialWrite',
  'SttConfigUpdateRequest',
  'SttConfigUpdateResult',
  'SttConnectionTest',
  // Task 3 R-9..R-11 (blueprint row 132, D106; C3 §2.6): the eight schemas of ops 93-97.
  // Task 4 row 94 (WP-12; AM-3): + the optional body of op 93, first of the block (56 -> 57 components).
  'CaptureDiscoveryStartRequest',
  'CaptureDiscoverySearch',
  'CaptureCandidate',
  'CaptureDiscoveryState',
  'CaptureConnectionTestRequest',
  'CaptureConnectionTest',
  'CaptureCandidateAdoptRequest',
  'CaptureCandidateAdoption',
  'CaptureInputScan',
  // Task 4 (blueprint row 63; design addendum 4.2): three of the four schemas of ops 98-99; the
  // fourth, `CaptureAudioInputRegistration`, is the answer of the successes only the Core server sends.
  'CaptureAudioCard',
  'CaptureAudioCardSearch',
  'CaptureAudioInputRegisterRequest',
];

/** The nine book §21.2 endpoints, verbatim (research/01_explore.md §21.2). */
const BOOK_21_2 = [
  'post /api/v1/session',
  'post /api/v1/session/{id}/start',
  'post /api/v1/session/{id}/stop',
  'get /api/v1/session/current',
  'get /api/v1/device/health',
  'get /api/v1/audio/status',
  'get /api/v1/video/status',
  'get /api/v1/storage/status',
  'post /api/v1/evidence/{id}/export',
];

function badgeNames(operation: { 'x-badges': { name: string }[] }): string[] {
  return operation['x-badges'].map((badge) => badge.name);
}

/** Every object key in a JSON value, with the path of objects that hold it. */
function collectKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) collectKeys(item, out);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.push(key);
      collectKeys(child, out);
    }
  }
  return out;
}

describe('AC-56: the OpenAPI document', () => {
  const document = createOpenApiDocument();
  const operations = listOpenApiOperations(document);

  it('is a valid OpenAPI 3.1.0 document for @scalar/openapi-parser, with every $ref resolvable', async () => {
    expect(document.openapi).toBe('3.1.0');
    const result = await validate(serializeOpenApiDocument(document));
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.version).toBe('3.1');
    const dereferenced = await dereference(serializeOpenApiDocument(document));
    expect(dereferenced.errors ?? []).toEqual([]);
  });

  it('the parser rejects a broken reference (positive control for the check above)', async () => {
    const broken = createOpenApiDocument();
    const health = broken.paths[HEALTH_PATH]?.get;
    expect(health).toBeDefined();
    health!.responses['200']!.content!['application/json'].schema.$ref = '#/components/schemas/Nope';
    expect((await validate(serializeOpenApiDocument(broken))).valid).toBe(false);
  });

  it('has 33 operations: GET /api/v1/health LIVE and the 32 simulated endpoints (9 book §21.2 + 13 capture + 3 STT configuration + 5 camera search + 2 sound cards) SIMULATED', () => {
    expect(operations).toHaveLength(33);
    expect(new Set(operations.map((entry) => entry.operation.operationId)).size).toBe(33);

    const live = operations.filter((entry) => entry.operation['x-dems-mode'] === 'live');
    expect(live.map((entry) => `${entry.method} ${entry.path}`)).toEqual([`get ${HEALTH_PATH}`]);
    expect(badgeNames(live[0]!.operation)).toEqual([API_BADGES.LIVE.name]);

    const simulated = operations.filter((entry) => entry.operation['x-dems-mode'] === 'simulated');
    const simulatedPaths = simulated.map((entry) => `${entry.method} ${entry.path}`);
    // OD-17 (D4): the offline scope grows from the nine design-book endpoints to those nine plus the
    // thirteen simulated capture/transcript operations. The nine stay an independent pin; the rest is
    // pinned by count and by the badges below (their exact routes are pinned in api-registry.test.ts).
    // Task 3 M6 row 113 (C3 §2.5) adds the three STT configuration operations 90-92: 22 -> 25.
    // Task 3 R-9..R-11 (row 132, D106; C3 §2.6) add the five operations 93-97: 25 -> 30.
    // Task 4 row 63 (design addendum 4.2) adds the two sound-card operations 98-99: 30 -> 32.
    expect(simulatedPaths.length).toBe(32);
    for (const endpoint of BOOK_21_2) expect(simulatedPaths, endpoint).toContain(endpoint);
    for (const entry of simulated) {
      expect(badgeNames(entry.operation)).toContain(API_BADGES.SIMULATED.name);
      expect(badgeNames(entry.operation)).not.toContain(API_BADGES.LIVE.name);
    }
    const badgeCount = (name: string) => operations.filter((entry) => badgeNames(entry.operation).includes(name)).length;
    expect(badgeCount('LIVE')).toBe(1);
    expect(badgeCount('SIMULATED')).toBe(32);
  });

  it('marks only the export RBAC + AUDIT, and every x-dems-rbac lists exactly the roles holding its permission', () => {
    const rbacAudit = operations.filter((entry) => badgeNames(entry.operation).includes(API_BADGES.RBAC_AUDIT.name));
    expect(rbacAudit.map((entry) => entry.operation.operationId)).toEqual(['exportEvidence']);
    const withRbac = operations.filter((entry) => entry.operation['x-dems-rbac']);
    // Step 54 (D101): start and stop document SESSION_START (401 / 403) like create.
    expect(withRbac.map((entry) => entry.operation.operationId).sort()).toEqual([
      'createSession',
      'exportEvidence',
      'startSession',
      'stopSession',
    ]);
    for (const entry of withRbac) {
      const rbac = entry.operation['x-dems-rbac']!;
      const holders = Object.values(OperatorRole).filter((role) => roleHas(role, rbac.permission as never));
      expect([...rbac.roles].sort()).toEqual([...holders].sort());
    }
  });

  it('the committed openapi/openapi.json matches the builder byte for byte (no drift)', () => {
    // Changed by design (W27; AC-B-11): the committed file holds the `all` scope, 99 operations (97 of C3 §10.1 + the two of task 4 row 63).
    // The document this file describes is the offline one, which the generator still renders.
    const committed = readFileSync(OPENAPI_JSON_PATH, 'utf8');
    expect(OPENAPI_COMMITTED_SCOPE).toBe(CoreApiScope.ALL);
    expect(renderOpenApiJson()).toBe(serializeOpenApiDocument(createOpenApiDocument({ scope: OPENAPI_COMMITTED_SCOPE })));
    expect(committed).toBe(renderOpenApiJson());
    expect(listOpenApiOperations(JSON.parse(committed) as typeof document)).toHaveLength(99);
    expect(renderOpenApiJson(CoreApiScope.OFFLINE)).toBe(serializeOpenApiDocument(document));
  });

  it('builds deterministically, and each build is an independent object', () => {
    const a = createOpenApiDocument();
    const b = createOpenApiDocument();
    expect(a).not.toBe(b);
    expect(serializeOpenApiDocument(a)).toBe(serializeOpenApiDocument(b));
    a.info.title = 'changed';
    delete a.paths[HEALTH_PATH];
    expect(serializeOpenApiDocument(createOpenApiDocument())).toBe(serializeOpenApiDocument(b));
  });

  it('uses no vendor extension beyond x-badges and x-dems-* (D45), no auth scheme and no remote URL', () => {
    const text = serializeOpenApiDocument(document);
    const extensionKeys = collectKeys(JSON.parse(text)).filter((key) => key.startsWith('x-'));
    expect(extensionKeys.length).toBeGreaterThan(0);
    expect(extensionKeys.filter((key) => !OPENAPI_ALLOWED_EXTENSION.test(key))).toEqual([]);
    expect(collectKeys(JSON.parse(text)).filter((key) => /scalar|agent|mcp|pre-request|post-response|code-?samples/i.test(key))).toEqual([]);
    // No authentication scheme: the design book defines none (the simulator acts as the signed-in operator).
    expect('security' in document).toBe(false);
    expect('securitySchemes' in document.components).toBe(false);
    const hosts = [...text.matchAll(/\b(?:https?|wss?):\/\/[^\s"'`)\\]+/g)].map((match) => new URL(match[0]).host);
    expect(hosts.length).toBeGreaterThan(0);
    expect([...new Set(hosts)]).toEqual(['127.0.0.1:4400']);
  });

  it('serves from the local mock-core origin and documents x-dems-simulated on every simulated response only', () => {
    expect(document.servers.map((server) => server.url)).toEqual([CORE_HTTP_ORIGIN]);
    for (const { operation } of operations) {
      for (const response of Object.values(operation.responses)) {
        if (operation['x-dems-mode'] === 'simulated') expect(response.headers?.[SIMULATED_HEADER_NAME]).toBeDefined();
        else expect(response.headers).toBeUndefined();
      }
    }
    expect(document.components.headers.XDemsSimulated?.schema).toEqual({ type: 'string', const: SIMULATED_HEADER_VALUE });
  });

  it('generates one component per contract schema of its scope, from the zod schemas', () => {
    // Changed by design (W19; OD-17 M2; M6 row 113; task 4 rows 63 and 94): the offline document holds the 57 schemas its 33 operations
    // use, in registry order (a subsequence of `CORE_API_SCHEMAS`); the `all` scope holds one component
    // per entry of `CORE_API_SCHEMAS`.
    expect(Object.keys(document.components.schemas)).toEqual(OFFLINE_SCHEMA_NAMES);
    const registryOrder = Object.keys(CORE_API_SCHEMAS);
    let cursor = -1;
    for (const name of OFFLINE_SCHEMA_NAMES) {
      const next = registryOrder.indexOf(name, cursor + 1);
      expect(next, name).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(Object.keys(createOpenApiDocument({ scope: 'all' }).components.schemas)).toEqual(Object.keys(CORE_API_SCHEMAS));
    const serialized = JSON.stringify(document.components.schemas);
    expect(serialized).not.toContain('"$schema"');
    expect(serialized).not.toContain('"$id"');
    expect(serialized).not.toContain('9007199254740991');
    // Nested named schemas are references, not copies.
    expect(JSON.stringify(document.components.schemas.CurrentSessionResponse)).toContain('#/components/schemas/SessionResource');
  });

  it('describes WS /ws in the Realtime tag with a Heartbeat example that parses', () => {
    const realtime = document.tags.find((tag) => tag.name === 'Realtime');
    expect(realtime?.description).toContain(CORE_WS_URL);
    const block = /```json\n([\s\S]+?)\n```/.exec(realtime?.description ?? '');
    expect(HeartbeatSchema.safeParse(JSON.parse(block?.[1] ?? 'null')).success).toBe(true);
  });

  it('"Show simulated endpoints" off keeps only the live operation and stays valid', async () => {
    const liveOnly = createOpenApiDocument({ includeSimulated: false });
    expect(listOpenApiOperations(liveOnly).map((entry) => entry.operation.operationId)).toEqual(['getServiceHealth']);
    expect(liveOnly.tags.map((tag) => tag.name)).toEqual(['Service', 'Realtime']);
    expect((await validate(serializeOpenApiDocument(liveOnly))).valid).toBe(true);
  });
});

describe('examples', () => {
  function examplesFor(operation: CoreApiOperation) {
    const examples = CORE_API_EXAMPLES[operation.operationId];
    expect(examples, operation.operationId).toBeDefined();
    return examples!;
  }

  it('every documented response with a body has at least one example, and every example parses', () => {
    let checked = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const examples = examplesFor(operation);
      for (const [status, spec] of Object.entries(operation.responses)) {
        if (!spec.schema) continue;
        const named = examples.responses[Number(status)] ?? {};
        expect(Object.keys(named).length, `${operation.operationId} ${status}`).toBeGreaterThan(0);
        for (const [name, example] of Object.entries(named)) {
          const result = validateCoreApiResponse(operation.operationId, Number(status), example.value);
          expect(result, `${operation.operationId} ${status} ${name}`).toEqual({ ok: true });
          checked += 1;
        }
      }
      for (const status of Object.keys(examples.responses)) {
        expect(operation.responses[Number(status)], `${operation.operationId} example for undocumented ${status}`).toBeDefined();
      }
    }
    expect(checked).toBeGreaterThanOrEqual(CORE_API_OPERATIONS.length);
  });

  it('request and path-parameter examples parse with their schemas', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const examples = examplesFor(operation);
      if (operation.requestBody) {
        const named = Object.values(examples.request ?? {});
        expect(named.length, operation.operationId).toBeGreaterThan(0);
        for (const example of named) {
          expect(CORE_API_SCHEMAS[operation.requestBody.schema].safeParse(example.value).success).toBe(true);
        }
      } else {
        expect(examples.request).toBeUndefined();
      }
      if (operation.pathParam) {
        expect(examples.pathParams?.id).toMatch(operation.pathParam.pattern);
      }
    }
  });

  it('validateCoreApiResponse rejects a wrong body, an undocumented status and an unknown operation', () => {
    expect(validateCoreApiResponse('getStorageStatus', 200, { state: 'READY' })).toMatchObject({ ok: false, reason: 'INVALID_BODY' });
    expect(validateCoreApiResponse('getStorageStatus', 418, {})).toMatchObject({ ok: false, reason: 'UNDOCUMENTED_STATUS' });
    expect(validateCoreApiResponse('nope', 200, {})).toMatchObject({ ok: false, reason: 'UNKNOWN_OPERATION' });
  });
});

describe('matchCoreApiOperation', () => {
  it('routes every operation, with decoded path parameters', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const id = CORE_API_EXAMPLES[operation.operationId]?.pathParams?.id;
      const path = id ? operation.path.replace('{id}', encodeURIComponent(id)) : operation.path;
      const match = matchCoreApiOperation(operation.method.toUpperCase(), path);
      expect(match?.operation.operationId, path).toBe(operation.operationId);
      expect(match?.params).toEqual(id ? { id } : {});
    }
  });

  it('returns null for an unknown path, a wrong method and malformed percent-encoding', () => {
    expect(matchCoreApiOperation('GET', '/api/v1/session/list')).toBeNull();
    expect(matchCoreApiOperation('POST', '/api/v1/session/current')).toBeNull();
    expect(matchCoreApiOperation('GET', '/api/v1/session')).toBeNull();
    expect(matchCoreApiOperation('POST', '/api/v1/evidence/%E0%A4%A/export')).toBeNull();
    expect(matchCoreApiOperation('GET', '/api/v1/session/current')?.operation.operationId).toBe('getCurrentSession');
  });
});

// ── The contract against the real simulated handlers (sim/api.ts via Sim.request) ──────────

interface SimRig {
  sim: Sim;
  clock: ControllableClock;
  seen: Map<string, Set<number>>;
  call(operationId: string, method: 'GET' | 'POST', path: string, body?: unknown): { status: number; body: unknown };
  advance(ms: number): void;
}

async function rig(seen: Map<string, Set<number>>): Promise<SimRig> {
  const clock = createManualClock(AT);
  // Memory storages (F-31-1) and a no-op scheduler: the test drives every tick.
  const sim = createSim({ storage: null, authStorage: null, clock, scheduler: () => () => {} });
  await sim.ready;
  return {
    sim,
    clock,
    seen,
    call(operationId, method, path, body) {
      const response = sim.request({ method, path, body });
      expect(response.headers[SIMULATED_HEADER_NAME], `${method} ${path}`).toBe(SIMULATED_HEADER_VALUE);
      expect(matchCoreApiOperation(method, path)?.operation.operationId).toBe(operationId);
      const verdict = validateCoreApiResponse(operationId, response.status, response.body);
      expect(verdict, `${method} ${path} → ${response.status} ${JSON.stringify(response.body)}`).toEqual({ ok: true });
      const statuses = seen.get(operationId) ?? new Set<number>();
      statuses.add(response.status);
      seen.set(operationId, statuses);
      return { status: response.status, body: response.body };
    },
    advance(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += 100) {
        clock.advance(100);
        sim.tick();
      }
    },
  };
}

const RECORDING_INPUT = CORE_API_EXAMPLES.createSession!.request!.recordingScenario!.value as Record<string, unknown>;

describe('the contract matches the simulated handlers (sim/api.ts)', () => {
  it("the simulator's route table lists exactly the simulated operations of the registry (32)", () => {
    const documented = CORE_API_OPERATIONS.filter((operation) => operation.mode === 'simulated').map(
      (operation) => `${operation.method.toUpperCase()} ${operation.path} ${operation.operationId}`,
    );
    const simulated = SIM_API_ROUTES.map((route) => `${route.method} ${route.path} ${route.operationId}`);
    expect([...simulated].sort()).toEqual([...documented].sort());
  });

  it('every documented simulated status is produced by the simulator, and every response parses', async () => {
    const seen = new Map<string, Set<number>>();

    // Flow 1: the recording scenario, end to end, plus the export RBAC paths.
    const a = await rig(seen);
    for (const op of ['getCurrentSession', 'getDeviceHealth', 'getAudioStatus', 'getVideoStatus', 'getStorageStatus'] as const) {
      const path = CORE_API_OPERATIONS.find((o) => o.operationId === op)!.path;
      expect(a.call(op, 'GET', path).status).toBe(200);
    }
    expect(a.call('createSession', 'POST', '/api/v1/session', RECORDING_INPUT).status).toBe(401);
    // Step 54 (review 40 M5): start and stop answer 401 before anything else when signed out.
    expect(a.call('startSession', 'POST', `/api/v1/session/${EXAMPLE_IDS.recordingSessionId}/start`).status).toBe(401);
    expect(
      a.call('stopSession', 'POST', `/api/v1/session/${EXAMPLE_IDS.recordingSessionId}/stop`, { reason: 'Interview completed' }).status,
    ).toBe(401);
    a.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(a.call('createSession', 'POST', '/api/v1/session', '[1]').status).toBe(400);
    expect(a.call('createSession', 'POST', '/api/v1/session', { caseNumber: 'LP/2026/1001-0007' }).status).toBe(422);
    const created = a.call('createSession', 'POST', '/api/v1/session', RECORDING_INPUT);
    expect(created).toEqual({ status: 201, body: { sessionId: EXAMPLE_IDS.recordingSessionId, state: 'CREATE', created: true } });
    expect(a.call('createSession', 'POST', '/api/v1/session', RECORDING_INPUT).status).toBe(200);
    expect(a.call('createSession', 'POST', '/api/v1/session', { ...RECORDING_INPUT, subjectName: 'Other Person' }).status).toBe(409);
    const id = EXAMPLE_IDS.recordingSessionId;
    expect(a.call('startSession', 'POST', '/api/v1/session/SES-20261001-0099/start').status).toBe(404);
    expect(a.call('startSession', 'POST', `/api/v1/session/${id}/start`, '[1]').status).toBe(400);
    expect(a.call('startSession', 'POST', `/api/v1/session/${id}/start`).status).toBe(202);
    expect(a.call('startSession', 'POST', `/api/v1/session/${id}/start`).status).toBe(409);
    expect(a.call('stopSession', 'POST', `/api/v1/session/${id}/stop`, { reason: 'Interview completed' }).status).toBe(409);
    a.advance(6_000);
    expect(a.call('startSession', 'POST', `/api/v1/session/${id}/start`).status).toBe(200);
    a.advance(2_000);
    expect(a.call('getCurrentSession', 'GET', '/api/v1/session/current').status).toBe(200);
    expect(a.call('stopSession', 'POST', '/api/v1/session/SES-20261001-0099/stop', { reason: 'Interview completed' }).status).toBe(404);
    expect(a.call('stopSession', 'POST', `/api/v1/session/${id}/stop`, '[1]').status).toBe(400);
    expect(a.call('stopSession', 'POST', `/api/v1/session/${id}/stop`, { reason: 'no' }).status).toBe(422);
    expect(a.call('stopSession', 'POST', `/api/v1/session/${id}/stop`, { reason: 'Interview completed' }).status).toBe(202);
    a.advance(12_000);
    const sealed = a.call('getCurrentSession', 'GET', '/api/v1/session/current').body as {
      session: { state: string; evidenceId: string | null };
    };
    expect(sealed.session).toMatchObject({ state: 'SEALED', evidenceId: EXAMPLE_IDS.recordingEvidenceId });
    const exportPath = `/api/v1/evidence/${EXAMPLE_IDS.exportedEvidenceId}/export`;
    const exportBody = CORE_API_EXAMPLES.exportEvidence!.request!.handover!.value;
    expect(a.call('exportEvidence', 'POST', exportPath, exportBody).status).toBe(403);
    a.sim.actions.signOut();
    expect(a.call('exportEvidence', 'POST', exportPath, exportBody).status).toBe(401);
    a.sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD);
    expect(a.call('exportEvidence', 'POST', exportPath, '[1]').status).toBe(400);
    expect(a.call('exportEvidence', 'POST', exportPath, { reason: 'x' }).status).toBe(422);
    expect(a.call('exportEvidence', 'POST', '/api/v1/evidence/EV-20260930-0099/export', exportBody).status).toBe(404);
    expect(a.call('exportEvidence', 'POST', `/api/v1/evidence/${EXAMPLE_IDS.recordedEvidenceId}/export`, exportBody).status).toBe(409);
    const accepted = a.call('exportEvidence', 'POST', exportPath, exportBody);
    // C3 §3 op 42 (row 48/51a): the accepted body is the queue receipt `QUEUED`; the evidence item's
    // lifecycle status (`EXPORTED`) is a separate fact asserted in sim-api.test.ts, not this receipt.
    expect(accepted).toMatchObject({ status: 202, body: { evidenceId: EXAMPLE_IDS.exportedEvidenceId, status: 'QUEUED' } });
    a.sim.stop();

    // Flow 2: a TECHNICIAN may not create sessions (403 NOT_PERMITTED).
    const b = await rig(seen);
    b.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    expect(b.call('createSession', 'POST', '/api/v1/session', RECORDING_INPUT).status).toBe(403);
    expect(b.call('startSession', 'POST', `/api/v1/session/${EXAMPLE_IDS.recordingSessionId}/start`).status).toBe(403);
    expect(
      b.call('stopSession', 'POST', `/api/v1/session/${EXAMPLE_IDS.recordingSessionId}/stop`, { reason: 'Interview completed' }).status,
    ).toBe(403);
    b.sim.stop();

    // Flow 3..: the thirteen simulated capture/transcript operations (OD-17, ops 76-87/89). Each is
    // driven across every status the simulator can produce, so the coverage loop below can demand the
    // full offline set of all 22 simulated operations, not just the nine §21.2 ones. Statuses the
    // simulator deliberately does not emit (the Origin/revoked-device 403 on reads every role may
    // make, and the path-parameter/query 422 the simulator answers with 404 instead - D-51a-6) are
    // marked `services: ['dems-core-server']` in the registry and counted as Core-server-only below.
    const SBASE = '/api/v1/session';
    const EBASE = '/api/v1/evidence';
    const CFG_PATH = '/api/v1/capture/config';
    const DEV_PATH = '/api/v1/capture/devices';
    const micBody = { inputId: 'MIC-02', reason: 'Subject answers' };
    const revBody = { baseRevision: 0, changes: [{ segmentIndex: 0, from: 'a', to: 'b' }], note: 'A correction for the walk' };

    // Flow 3: signed-out refusals, then an INVESTIGATOR (lacks CAPTURE_CONFIG -> 403) reading the two
    // capture slices (200) and attempting the four selector writes (403).
    const c = await rig(seen);
    c.call('getCaptureConfig', 'GET', CFG_PATH);
    c.call('getCaptureDevices', 'GET', DEV_PATH);
    c.call('updateCaptureConfig', 'POST', CFG_PATH, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] });
    c.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/CAM-01/source', { trackId: 'VIDEO-02' });
    c.call('setPrimaryMic', 'POST', '/api/v1/capture/mics/MIC-02/primary');
    c.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/CAM-01/credential', { username: 'u', secret: 's' });
    c.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(c.call('getCaptureConfig', 'GET', CFG_PATH).status).toBe(200);
    expect(c.call('getCaptureDevices', 'GET', DEV_PATH).status).toBe(200);
    expect(c.call('updateCaptureConfig', 'POST', CFG_PATH, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] }).status).toBe(403);
    expect(c.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/CAM-01/source', { trackId: 'VIDEO-02' }).status).toBe(403);
    expect(c.call('setPrimaryMic', 'POST', '/api/v1/capture/mics/MIC-02/primary').status).toBe(403);
    expect(c.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/CAM-01/credential', { username: 'u', secret: 's' }).status).toBe(403);
    c.sim.stop();

    // Flow 4: an idle TECHNICIAN (holds CAPTURE_CONFIG) drives the writes to 400 (bad JSON), 404
    // (unknown device), 422 (schema-invalid body) and 200 (applied).
    const d = await rig(seen);
    d.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    expect(d.call('updateCaptureConfig', 'POST', CFG_PATH, '[1]').status).toBe(400);
    expect(d.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/CAM-01/source', '[1]').status).toBe(400);
    expect(d.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/CAM-01/credential', '[1]').status).toBe(400);
    expect(d.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/GHOST/source', { trackId: 'VIDEO-02' }).status).toBe(404);
    expect(d.call('setPrimaryMic', 'POST', '/api/v1/capture/mics/MIC-99/primary').status).toBe(404);
    expect(d.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/GHOST/credential', { username: 'u', secret: 's' }).status).toBe(404);
    expect(d.call('updateCaptureConfig', 'POST', CFG_PATH, { cameras: [{ trackId: 'VIDEO-09', deviceId: 'CAM-01' }] }).status).toBe(422);
    // Decision D106 (3): the facade runs the hosted action's transition, so what the selector as a
    // whole refuses is refused here too — a line that names no registered camera, and one camera on
    // both tracks with one profile (the built-in selector holds CAM-02 on VIDEO-02 already).
    expect(d.call('updateCaptureConfig', 'POST', CFG_PATH, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-77' }] }).status).toBe(422);
    expect(d.call('updateCaptureConfig', 'POST', CFG_PATH, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] }).status).toBe(422);
    expect(d.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/CAM-01/source', { trackId: 'VIDEO-09' }).status).toBe(422);
    expect(d.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/CAM-01/credential', { username: 'only' }).status).toBe(422);
    // The two cameras swap their tracks: a whole selector that holds each source once.
    const SWAP = { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] };
    expect(d.call('updateCaptureConfig', 'POST', CFG_PATH, SWAP).status).toBe(200);
    expect(d.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/CAM-01/source', { trackId: 'VIDEO-02' }).status).toBe(200);
    expect(d.call('setPrimaryMic', 'POST', '/api/v1/capture/mics/MIC-02/primary').status).toBe(200);
    expect(d.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/CAM-01/credential', { username: 'u', secret: 's' }).status).toBe(200);
    d.sim.stop();

    // Flow 5: a SUPERVISOR opens a session; the four selector writes then refuse 409 CAPTURE_CONFIG_LOCKED.
    const e = await rig(seen);
    e.sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD);
    e.sim.request({ method: 'POST', path: SBASE, body: RECORDING_INPUT });
    e.call('updateCaptureConfig', 'POST', CFG_PATH, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] });
    e.call('setCaptureCameraSource', 'POST', '/api/v1/capture/cameras/CAM-01/source', { trackId: 'VIDEO-02' });
    e.call('setPrimaryMic', 'POST', '/api/v1/capture/mics/MIC-02/primary');
    e.call('setCaptureDeviceCredential', 'POST', '/api/v1/capture/devices/CAM-01/credential', { username: 'u', secret: 's' });
    e.sim.stop();

    // Flow 6: a recording session drives switchAudioSource / listAudioSourceIntervals / getSealingProgress.
    const f = await rig(seen);
    f.call('switchAudioSource', 'POST', `${SBASE}/${EXAMPLE_IDS.recordingSessionId}/audio-source`, micBody);
    f.call('listAudioSourceIntervals', 'GET', `${SBASE}/${EXAMPLE_IDS.recordingSessionId}/audio-source`);
    f.call('getSealingProgress', 'GET', `${SBASE}/${EXAMPLE_IDS.recordingSessionId}/sealing`);
    f.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    f.sim.request({ method: 'POST', path: SBASE, body: RECORDING_INPUT });
    const fid = EXAMPLE_IDS.recordingSessionId;
    expect(f.call('switchAudioSource', 'POST', `${SBASE}/${fid}/audio-source`, micBody).status).toBe(409); // CREATE, not RECORDING
    expect(f.call('switchAudioSource', 'POST', `${SBASE}/SES-20261001-9999/audio-source`, micBody).status).toBe(404);
    expect(f.call('listAudioSourceIntervals', 'GET', `${SBASE}/SES-20261001-9999/audio-source`).status).toBe(404);
    expect(f.call('getSealingProgress', 'GET', `${SBASE}/SES-20261001-9999/sealing`).status).toBe(404);
    f.sim.request({ method: 'POST', path: `${SBASE}/${fid}/start` });
    f.advance(6_000);
    f.sim.request({ method: 'POST', path: `${SBASE}/${fid}/start` });
    f.advance(2_000); // RECORDING
    expect(f.call('switchAudioSource', 'POST', `${SBASE}/${fid}/audio-source`, '[1]').status).toBe(400);
    // D133 (1): an input is any `MIC-NN`; a malformed id is 422, a well-formed one that is no input of the session is 409 AUDIO_SOURCE_CONFLICT.
    expect(f.call('switchAudioSource', 'POST', `${SBASE}/${fid}/audio-source`, { inputId: 'MIC-9' }).status).toBe(422);
    expect(f.call('switchAudioSource', 'POST', `${SBASE}/${fid}/audio-source`, { inputId: 'MIC-09' }).status).toBe(409);
    expect(f.call('getSealingProgress', 'GET', `${SBASE}/${fid}/sealing`).status).toBe(409); // sealing not started
    expect(f.call('switchAudioSource', 'POST', `${SBASE}/${fid}/audio-source`, micBody).status).toBe(200);
    expect(f.call('listAudioSourceIntervals', 'GET', `${SBASE}/${fid}/audio-source`).status).toBe(200);
    f.sim.request({ method: 'POST', path: `${SBASE}/${fid}/stop`, body: { reason: 'Interview completed' } });
    f.advance(20_000);
    expect(f.call('getSealingProgress', 'GET', `${SBASE}/${fid}/sealing`).status).toBe(200);
    f.sim.stop();

    // Flow 7: a TECHNICIAN (lacks SESSION_START) is refused the in-session switch with 403.
    const g = await rig(seen);
    g.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    expect(g.call('switchAudioSource', 'POST', `${SBASE}/${EXAMPLE_IDS.recordingSessionId}/audio-source`, micBody).status).toBe(403);
    g.sim.stop();

    // Flow 8: the transcript chain. A legacy item (no bound hash) refuses 409; sealing a session binds
    // one, which op 84 serves (200), op 86 lists (200), and op 85 revises (400/422/409-conflict/201).
    const h = await rig(seen);
    h.call('getTranscript', 'GET', `${EBASE}/${EXAMPLE_IDS.recordingEvidenceId}/transcript`);
    h.call('createTranscriptRevision', 'POST', `${EBASE}/${EXAMPLE_IDS.recordingEvidenceId}/transcript/revisions`, revBody);
    h.call('listTranscriptRevisions', 'GET', `${EBASE}/${EXAMPLE_IDS.recordingEvidenceId}/transcript/revisions`);
    h.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(h.call('getTranscript', 'GET', `${EBASE}/EV-19700101-9999/transcript`).status).toBe(404);
    expect(h.call('listTranscriptRevisions', 'GET', `${EBASE}/EV-19700101-9999/transcript/revisions`).status).toBe(404);
    expect(h.call('createTranscriptRevision', 'POST', `${EBASE}/EV-19700101-9999/transcript/revisions`, revBody).status).toBe(404);
    const legacy = h.sim.store.getState().evidence.find((item) => !item.transcriptSha256)?.id ?? '';
    expect(h.call('getTranscript', 'GET', `${EBASE}/${legacy}/transcript`).status).toBe(409);
    expect(h.call('listTranscriptRevisions', 'GET', `${EBASE}/${legacy}/transcript/revisions`).status).toBe(409);
    expect(h.call('createTranscriptRevision', 'POST', `${EBASE}/${legacy}/transcript/revisions`, revBody).status).toBe(409);
    h.sim.request({ method: 'POST', path: SBASE, body: RECORDING_INPUT });
    const hid = EXAMPLE_IDS.recordingSessionId;
    h.sim.request({ method: 'POST', path: `${SBASE}/${hid}/start` });
    h.advance(6_000);
    h.sim.request({ method: 'POST', path: `${SBASE}/${hid}/start` });
    h.advance(2_000);
    h.sim.request({ method: 'POST', path: `${SBASE}/${hid}/stop`, body: { reason: 'Interview completed' } });
    h.advance(20_000);
    const sealedItem = h.sim.store.getState().evidence.find((item) => item.sessionId === hid && item.transcriptSha256)?.id ?? '';
    const ep = `${EBASE}/${sealedItem}`;
    expect(h.call('getTranscript', 'GET', `${ep}/transcript`).status).toBe(200);
    expect(h.call('listTranscriptRevisions', 'GET', `${ep}/transcript/revisions`).status).toBe(200);
    expect(h.call('createTranscriptRevision', 'POST', `${ep}/transcript/revisions`, '[1]').status).toBe(400);
    expect(h.call('createTranscriptRevision', 'POST', `${ep}/transcript/revisions`, { baseRevision: 'x' }).status).toBe(422);
    expect(h.call('createTranscriptRevision', 'POST', `${ep}/transcript/revisions`, { ...revBody, baseRevision: 9 }).status).toBe(409);
    expect(
      h.call('createTranscriptRevision', 'POST', `${ep}/transcript/revisions`, {
        baseRevision: 0,
        changes: [{ segmentIndex: 0, from: 'selamat pagi', to: 'Selamat pagi.' }],
        note: 'Punctuation',
      }).status,
    ).toBe(201);
    h.sim.stop();

    // Flow 9: a TECHNICIAN (lacks TRANSCRIPT_REVISE) is refused the revision with 403.
    const i = await rig(seen);
    i.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    expect(i.call('createTranscriptRevision', 'POST', `${EBASE}/${EXAMPLE_IDS.recordingEvidenceId}/transcript/revisions`, revBody).status).toBe(403);
    i.sim.stop();

    // Flow 10: op 87 polls the export job op 42 queued (200), plus 401 / 404 / 422 and an INVESTIGATOR 403.
    const j = await rig(seen);
    j.call('getEvidenceExportJob', 'GET', `${EBASE}/exports/EXPJ-000004`);
    j.sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD);
    const sealedForExport = j.sim.store.getState().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
    const acceptedJob = j.sim.request({
      method: 'POST',
      path: `${EBASE}/${sealedForExport}/export`,
      body: { reason: 'Case file handover for prosecutor review', destination: 'Case file transfer (simulated)' },
    });
    const jobId = `EXPJ-${(acceptedJob.body as { exportId: string }).exportId.slice('EXP-'.length)}`;
    expect(j.call('getEvidenceExportJob', 'GET', `${EBASE}/exports/${jobId}`).status).toBe(200);
    expect(j.call('getEvidenceExportJob', 'GET', `${EBASE}/exports/EXPJ-000001`).status).toBe(404);
    expect(j.call('getEvidenceExportJob', 'GET', `${EBASE}/exports/not-a-job`).status).toBe(422);
    j.sim.actions.signOut();
    j.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(j.call('getEvidenceExportJob', 'GET', `${EBASE}/exports/${jobId}`).status).toBe(403);
    j.sim.stop();

    // Flow 13 (task 3 M6, blueprint row 113; C3 §2.5): the three STT configuration operations 90-92.
    // Signed out: 401 on all three. An INVESTIGATOR reads the configuration (200, every role) and is
    // refused the write and the test (403: CAPTURE_CONFIG is SUPERVISOR + TECHNICIAN only).
    const STT_PATH = '/api/v1/transcription/config';
    const STT_TEST_PATH = `${STT_PATH}/test`;
    const k = await rig(seen);
    expect(k.call('getSttConfig', 'GET', STT_PATH).status).toBe(401);
    expect(k.call('updateSttConfig', 'POST', STT_PATH, { revision: 1, enabled: false }).status).toBe(401);
    expect(k.call('testSttConnection', 'POST', STT_TEST_PATH).status).toBe(401);
    k.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(k.call('getSttConfig', 'GET', STT_PATH).status).toBe(200);
    expect(k.call('updateSttConfig', 'POST', STT_PATH, { revision: 1, enabled: false }).status).toBe(403);
    expect(k.call('testSttConnection', 'POST', STT_TEST_PATH).status).toBe(403);
    k.sim.stop();
    // A TECHNICIAN drives the write to 400 (not a JSON object), 422 (schema, and the named loopback
    // refusal), 409 (stale revision) and 200; the test answers 200.
    const l = await rig(seen);
    l.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    expect(l.call('updateSttConfig', 'POST', STT_PATH, '[1]').status).toBe(400);
    expect(l.call('updateSttConfig', 'POST', STT_PATH, { enabled: false }).status).toBe(422);
    const lan = l.call('updateSttConfig', 'POST', STT_PATH, { revision: 1, backend: 'omlx-server', endpoint: 'http://192.168.1.20:8000' });
    expect([lan.status, (lan.body as { error: { details?: { reason?: string } } }).error.details?.reason]).toEqual([422, 'ENDPOINT_NOT_LOOPBACK']);
    expect(l.call('updateSttConfig', 'POST', STT_PATH, { revision: 7, enabled: false }).status).toBe(409);
    expect(l.call('updateSttConfig', 'POST', STT_PATH, { revision: 1, enabled: false }).status).toBe(200);
    expect(l.call('testSttConnection', 'POST', STT_TEST_PATH).status).toBe(200);
    expect(l.call('getSttConfig', 'GET', STT_PATH).status).toBe(200);
    l.sim.stop();

    // Flow 14 (task 3 R-9..R-11, blueprint row 132, decision D106; C3 §2.6 "Simulator"): the five
    // operations 93-97. Signed out: 401 on all five. An INVESTIGATOR lacks CAPTURE_CONFIG: 403 on all
    // five (the candidate read included: operation 94 is not open to every role).
    const DISC_PATH = '/api/v1/capture/discovery';
    const RESCAN_PATH = '/api/v1/capture/inputs/rescan';
    const FRESH = `${DISC_PATH}/candidates/CND-000000000001`;
    const REGISTERED = `${DISC_PATH}/candidates/CND-000000000002`;
    const discoveryCalls = (target: SimRig): number[] => [
      target.call('startCaptureDiscovery', 'POST', DISC_PATH).status,
      target.call('getCaptureDiscovery', 'GET', DISC_PATH).status,
      target.call('testCaptureCandidateConnection', 'POST', `${FRESH}/test`, {}).status,
      target.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, {}).status,
      target.call('rescanCaptureInputs', 'POST', RESCAN_PATH).status,
    ];
    const m = await rig(seen);
    expect(discoveryCalls(m)).toEqual([401, 401, 401, 401, 401]);
    m.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(discoveryCalls(m)).toEqual([403, 403, 403, 403, 403]);
    m.sim.stop();
    // A TECHNICIAN: no search yet (200 with `search: null`, 404 for any candidate id), then the search
    // (202), the read (200), the test (400 / 422 / 409 for the registered candidate / 200), the adoption
    // (409 before a test / 400 / 422 / 201 / 409 for a repeat) and the local-input re-read (200).
    const n = await rig(seen);
    n.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    expect(n.call('getCaptureDiscovery', 'GET', DISC_PATH)).toEqual({ status: 200, body: { search: null, candidates: [], truncated: false } });
    expect(n.call('testCaptureCandidateConnection', 'POST', `${FRESH}/test`, {}).status).toBe(404);
    expect(n.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, {}).status).toBe(404);
    // Task 4 row 94: the optional body of the search. A body that is no JSON object 400; a typed
    // address outside the form 422; neither starts a search. Then the search as before (202).
    expect(n.call('startCaptureDiscovery', 'POST', DISC_PATH, '[1]').status).toBe(400);
    expect(n.call('startCaptureDiscovery', 'POST', DISC_PATH, { address: 'camera-1.local' }).status).toBe(422);
    expect(n.call('getCaptureDiscovery', 'GET', DISC_PATH)).toEqual({ status: 200, body: { search: null, candidates: [], truncated: false } });
    expect(n.call('startCaptureDiscovery', 'POST', DISC_PATH).status).toBe(202);
    expect(n.call('getCaptureDiscovery', 'GET', DISC_PATH).status).toBe(200);
    expect(n.call('testCaptureCandidateConnection', 'POST', `${FRESH}/test`, '[1]').status).toBe(400);
    expect(n.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, '[1]').status).toBe(400);
    expect(n.call('testCaptureCandidateConnection', 'POST', `${FRESH}/test`, { credential: { username: 'only' } }).status).toBe(422);
    expect(n.call('testCaptureCandidateConnection', 'POST', `${REGISTERED}/test`, {}).status).toBe(409);
    expect(n.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, {}).status).toBe(409);
    expect(n.call('testCaptureCandidateConnection', 'POST', `${FRESH}/test`, {}).status).toBe(200);
    expect(n.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, { address: '192.0.2.1' }).status).toBe(422);
    expect(n.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, {}).status).toBe(201);
    expect(n.call('adoptCaptureCandidate', 'POST', `${FRESH}/adopt`, {}).status).toBe(409);
    expect(n.call('rescanCaptureInputs', 'POST', RESCAN_PATH).status).toBe(200);
    n.sim.stop();

    // Flow 15 (task 4, blueprint row 63; design addendum 4.2): the two sound-card operations 98-99.
    // Signed out: 401 on both. An INVESTIGATOR lacks CAPTURE_CONFIG: 403 on both.
    const CARDS_PATH = '/api/v1/capture/audio-cards/search';
    const INPUTS_PATH = '/api/v1/capture/audio-cards/inputs';
    const FIRST_INPUT = { cardId: 'DEMS_TEST_A', deviceIndex: 0, inputNumber: 1 };
    const audioCalls = (target: SimRig): number[] => [
      target.call('searchCaptureAudioCards', 'POST', CARDS_PATH).status,
      target.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, FIRST_INPUT).status,
    ];
    const o = await rig(seen);
    expect(audioCalls(o)).toEqual([401, 401]);
    o.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(audioCalls(o)).toEqual([403, 403]);
    o.sim.stop();
    // A TECHNICIAN: the fixed listing of two test cards (200); the registration registers nothing -
    // 400 / 422 for a body that is no request, 404 for a card that is not in the listing, 409 for an
    // input the card does not have and 409 for one it has (the simulator captures from no sound card).
    const p = await rig(seen);
    p.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    const listed = p.call('searchCaptureAudioCards', 'POST', CARDS_PATH);
    expect(listed.status).toBe(200);
    expect((listed.body as { cards: { cardId: string }[] }).cards.map((card) => card.cardId)).toEqual(['DEMS_TEST_A', 'DEMS_TEST_B']);
    expect(p.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, '[1]').status).toBe(400);
    expect(p.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, { cardId: 'DEMS_TEST_A' }).status).toBe(422);
    expect(p.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, { ...FIRST_INPUT, product: 'x' }).status).toBe(422);
    expect(p.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, { ...FIRST_INPUT, cardId: 'OTHER' }).status).toBe(404);
    const reasonOf = (answer: { body: unknown }): unknown => (answer.body as { error: { details?: { reason?: string } } }).error.details?.reason;
    const beyond = p.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, { ...FIRST_INPUT, inputNumber: 5 });
    expect([beyond.status, reasonOf(beyond)]).toEqual([409, 'AUDIO_INPUT_BEYOND_CARD']);
    const refused = p.call('registerCaptureAudioInput', 'POST', INPUTS_PATH, FIRST_INPUT);
    expect([refused.status, reasonOf(refused)]).toEqual([409, 'AUDIO_INPUT_NOT_REGISTRABLE']);
    p.sim.stop();
    // A SUPERVISOR with a session open: both are idle only (409 CAPTURE_CONFIG_LOCKED).
    const q = await rig(seen);
    q.sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD);
    q.sim.request({ method: 'POST', path: SBASE, body: RECORDING_INPUT });
    expect(audioCalls(q)).toEqual([409, 409]);
    q.sim.stop();

    // Every status of the simulated operations that the simulator can produce was produced by it.
    // Changed by design (W27; 01_specs §7.19): the five baseline reads document a 401 and a 403, and
    // `startSession` a 422, that only the Core server sends (`responses[status].services`). RECON-A adds
    // the same marking for the six capture reads whose 403 is the Origin/revoked-device guard no seeded
    // role can hit, and for the five capture reads/writes whose 422 is a path-parameter/query format check
    // the simulator answers with 404 instead (D-51a-6). The simulator is not rewritten, so the comparison
    // stays limited to the offline-scope statuses, and the simulator must never produce one of the others.
    let coreServerOnly = 0;
    for (const operation of CORE_API_OPERATIONS.filter((o) => o.mode === 'simulated')) {
      const produced = [...(seen.get(operation.operationId) ?? [])].sort((a, b) => a - b);
      expect(produced, operation.operationId).toEqual(listCoreApiResponseStatuses(operation, CoreApiScope.OFFLINE));
      const others = listCoreApiResponseStatuses(operation).filter((status) => !produced.includes(status));
      for (const status of others) expect(operation.responses[status]?.services, `${operation.operationId} ${status}`).toEqual(['dems-core-server']);
      coreServerOnly += others.length;
    }
    // Baseline: 401+403 on five reads (10) and 422 on startSession (1) = 11.
    // Capture (RECON-A): 403 on six reads (6) and 422 on setPrimaryMic/listAudioSourceIntervals/
    // getSealingProgress/getTranscript/listTranscriptRevisions (5) = 11. Total 22.
    // Task 3 M6 row 113: the 403 of getSttConfig (every role may read it; the Origin/revoked-device
    // guard is the Core server's) = 1. Total 23.
    // Task 3 R-9 (row 132; C3 §2.6 op 93): the 200 of a search that is still RUNNING and the 409 of
    // another session's search or of a recording — the simulator's search is COMPLETE when it is
    // answered and it has one console = 2. Total 25.
    // Task 4 row 63 (design addendum 4.2, op 99): the 201 and the 200 of a registration - the
    // simulator captures from no sound card and registers nothing = 2. Total 27.
    expect(coreServerOnly).toBe(27);
  });
});

// ── Examples against the canonical dataset at the example instant ────────────────────────

describe('examples follow the canonical dataset (2026-10-01 10:00 WIB)', () => {
  it('the recording scenario IDs and input come from the dataset', () => {
    expect(sessionIdFor(RECORDING_SCENARIO.sessionSeq, AT)).toBe(EXAMPLE_IDS.recordingSessionId);
    expect(caseNumberFor(RECORDING_SCENARIO.caseSeq, AT)).toBe(EXAMPLE_IDS.recordingCaseNumber);
    expect(RECORDING_INPUT).toEqual({
      caseNumber: EXAMPLE_IDS.recordingCaseNumber,
      subjectType: RECORDING_SCENARIO.subjectType,
      subjectName: RECORDING_SCENARIO.subjectName,
      investigatorId: RECORDING_SCENARIO.investigatorId,
      room: RECORDING_SCENARIO.room,
      profileId: RECORDING_SCENARIO.profileId,
    });
    const byId = new Map(OPERATORS.map((operator) => [operator.id, operator.role]));
    expect(byId.get(EXAMPLE_IDS.investigatorId)).toBe('INVESTIGATOR');
    expect(byId.get(EXAMPLE_IDS.supervisorId)).toBe('SUPERVISOR');
    expect(byId.get(EXAMPLE_IDS.technicianId)).toBe('TECHNICIAN');
  });

  it('the evidence IDs exist with the statuses the examples claim', async () => {
    const r = await rig(new Map());
    const evidence = r.sim.store.getState().evidence;
    expect(evidence.find((item) => item.id === EXAMPLE_IDS.exportedEvidenceId)?.status).toBe('EXPORTED');
    expect(evidence.find((item) => item.id === EXAMPLE_IDS.recordedEvidenceId)?.status).toBe('RECORDED');
    r.sim.stop();
  });

  it('the device-health and storage examples equal the idle simulator at that instant', async () => {
    const r = await rig(new Map());
    const health = r.call('getDeviceHealth', 'GET', '/api/v1/device/health').body;
    expect(health).toEqual(CORE_API_EXAMPLES.getDeviceHealth!.responses[200]!.idle!.value);
    const storage = r.call('getStorageStatus', 'GET', '/api/v1/storage/status').body;
    expect(storage).toEqual(CORE_API_EXAMPLES.getStorageStatus!.responses[200]!.atLoad!.value);
    expect((health as { services: { name: string }[] }).services.map((service) => service.name)).toEqual([...CORE_SERVICES]);
    r.sim.stop();
  });
});
