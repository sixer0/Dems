// Backend task 2026-10-04, plan rows W19 (contract A) and W27 (contract C): the two scopes of the
// OpenAPI builder (02_plan §16 CO-3, CO-4; 04_client_integration_spec §11 AR-1; 01_specs API-12,
// §7.19, AC-B-11).
// - `offline` is the default. Until M2 it was the document of the baseline commit `acaff20`, section
//   by section, except the widened components (AC-B-13); OD-17 (D4) supersedes that byte-for-byte pin
//   and grows it to 23 operations at version 0.2.0 (the ten baseline plus the thirteen simulated
//   capture/transcript operations). The web API Reference builds it in Simulated mode.
// - `all` holds every operation of the registry, as the Core server answers it: 97 operations, two
//   security schemes, the server 127.0.0.1:4420, version 0.3.0 (0.2.1 until M2 row 50). It is the committed openapi.json.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dereference, validate } from '@scalar/openapi-parser';
import { describe, expect, it } from 'vitest';
import { OPENAPI_COMMITTED_SCOPE, OPENAPI_JSON_PATH, renderOpenApiJson } from '../scripts/gen-openapi';
import {
  API_BADGES,
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CORE_HTTP_ORIGIN,
  CORE_SERVER_HTTP_ORIGIN,
  CORE_SERVER_PORT,
  CORE_SERVER_WS_URL,
  CORE_WS_URL,
  CoreApiAccessKind,
  CoreApiScope,
  EPOCH_HEADER_NAME,
  OPENAPI_ALLOWED_EXTENSION,
  OPENAPI_CORE_SERVER_DOCUMENT_VERSION,
  OPENAPI_DOCUMENT_VERSION,
  OPENAPI_SESSION_COOKIE_NAME,
  OpenApiSecurityScheme,
  REQUEST_ID_HEADER_NAME,
  REVISION_HEADER_NAME,
  buildOpenApiQueryParameters,
  coreApiAccessPermissions,
  createOpenApiDocument,
  describeCoreApiAccess,
  listCoreApiResponseStatuses,
  listOpenApiOperations,
  serializeOpenApiDocument,
  validateCoreApiResponse,
  type JsonSchemaObject,
  type OpenApiDocument,
} from '../src/api';

const sha256 = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * SHA-256 of `JSON.stringify(section)` of packages/shared/openapi/openapi.json at the baseline
 * commit `acaff20` (95,021 bytes; `git show acaff20:packages/shared/openapi/openapi.json`).
 */
const BASELINE = {
  info: '932bce8ca02d6685a68427ca029ac24a64a84c380002c84fe49a38f4afbc213e', // [openapi, info]
  servers: '816622205c53d229fff526e9dd0a986c4f74b8bbf113384dc32f533bb076fc88',
  tags: 'eae2a20baad7c588c67bfd4abb2abf4ae588a2e940e20c4d42be7c027061d072',
  // Changed by design (W83, KI-18; decision D184): the health description no longer names a fixed origin.
  // At acaff20: 64d1bf9b9cabe862b95b0981dccf233187d766e963e4342df76a5637aed98492.
  paths: '184431cd5576b32c452a5a0af7b85babe5bae50da2271fb00ae4430e6a75d0e7',
  headers: '398f21cb993e8b95f6319663cdc8a79620e83de26fd7aa86a6d67309dbd53f67',
  operations: {
    // Changed by design (W83, KI-18). At acaff20: 314f8b26397442a98e86d76bd9571f9e2cc074c341dd5c9b211a7f966aeba102.
    getServiceHealth: 'eb18b951117540b3008d13124770ecc92337fe25e8ab473631bed7d09e46d7b9',
    createSession: 'dd82698b89feda8a52f79f0df15428dd079406bb34766740aa884d53561463d4',
    startSession: 'ef11eecc963ef6ab9fac4801297fa8231b842a64b4366b114ec302bd3b9b8494',
    stopSession: 'e3996b66f273ce04f25545b5663835d00d6484c67d03d40a23fde623d83e67f1',
    getCurrentSession: '7dfc78b7e983d8ae6bf56e471b17962cbb4510ee79bfc09e9dd010f585411ccd',
    getDeviceHealth: '196e3132e4d1defdd6716a045d30f0fefa5e151b97a6b84f38b4da8d155c0d8f',
    getAudioStatus: 'ebf461e24b9b16ff135a9418e8a5ba070579c09ca77d1a517e6a7a69afd26d35',
    getVideoStatus: 'f66cfcc7e1ed04c6580e9fb4e4bdfb89b26643713fbecc1b61511f75e682e7ce',
    getStorageStatus: '58190d2d80e339a1781482ae58efd894ef9094aa01cf8fe639af3075a5dd4b49',
    exportEvidence: '1ff69bfc599f30bef13df7a7da2db30eec486fbf2076530a2790548710798472',
  } as Record<string, string>,
  schemas: {
    HealthResponse: 'df862263c944bc2deb59986bdd00b689236167a7fb8ad1e0674f583e75898f4e',
    SessionCreateRequest: 'de642d09d9cc12e6a4a0762e6f7a183eacdc480b40f404cefcf0aa067a4a50b0',
    SessionStartRequest: '73074032dd466d378d58edfc72e12a81099ebbccc0ba2d2194db0e7fed9f75d9',
    SessionStopRequest: '2fc8bacbf45d34e245a40fc3531f53dadf5de6cf57ea1675214741af8e19a5e2',
    SessionCommandResponse: 'dd3703c705b340f9aedf67847be01a25051bf3e55856dac81988c380f70a4456',
    PrecheckItem: '9913f4bac5bdfb509517558d3dab8b2fff87c0217b54d9e12411aed633eba2bf',
    SessionResource: 'b51747e5f2c72baf99830f84e5c9adc3e15affb2562af5d605f5848a190757bd',
    CurrentSessionResponse: '23be44b5a79f1cd77a3ab4eb7732334fdd5e18fa7851fb6492edcfe507e78ca3',
    VideoTrackStatus: '5a71f0530db950eb57256dbc79d279f0e9127b65cd5883ceb9f3099436e38453',
    AudioChannelStatus: 'fb75e510976f57cee1b2ffe1eaf94652b9154218d93a935e5d25d9749dd62668',
    VideoStatusResponse: 'b0d8574a29bd99fb23159d7a3ac41d3eba87f7b0d821469641e55fb0db315b9f',
    AudioStatusResponse: 'bb6709ec8a79a3e9eb468654a155a6b9700531a852af33d04e4ab345bb52a099',
    StorageStatusResponse: 'c8076cc53e1d2d551618b6dab6fce3a5e35aa3f5b5cfa0f7eacadbf0863a6474',
    DeviceHealthResponse: '11e041a509e2ace069f888729f2fe73ad6a72a9c4abee41150c8b03fe44cb2d7',
    EvidenceExportRequest: 'd8efc131e355d3933bdc9dbb421e5f2e02fdd302d5003a5a5f8ea2a873bfe384',
    EvidenceExportAccepted: '4c20ebe319f61277317f4c681a01ffcf4b515655ceed98675cd7ff340ea9da0f',
    ApiError: 'b38637a26af4942d359e94efdb3b20bc57e729e009189c7500b43ac95b091c9f',
    Heartbeat: '85693998ae4cae6606228bda368d39e9e0ab861aed750c53ddec55daf707865e',
  } as Record<string, string>,
};
/**
 * The components the specification widens (01_specs §7.2, §7.4; task 3 M2-W6 SH-03 widens
 * `PrecheckItem`: `PrecheckCheckId` gained the role-keyed pair MIC_PRIMARY/MIC_STANDBY, and
 * `SessionResource`: the session carries the v2 snapshot members (SH-05) and the sealing steps v2).
 * Every other one is byte-equal to acaff20.
 */
const WIDENED = ['HealthResponse', 'ApiError', 'PrecheckItem', 'SessionResource'];
/**
 * OD-17 (D4; C3 §8) supersedes the whole-document byte-for-byte pin to `acaff20`: the in-app
 * simulator emulates v2, so the 13 simulated capture/transcript operations join the ten baseline
 * operations (offline grows 10 -> 23, `info.version` 0.1.0 -> 0.2.0). These are the pinned OD-17
 * operation ids and component names, in builder order.
 */
const OFFLINE_OP_IDS = [
  'getServiceHealth', 'createSession', 'startSession', 'stopSession', 'getCurrentSession',
  'getDeviceHealth', 'getAudioStatus', 'getVideoStatus', 'getStorageStatus', 'exportEvidence',
  'getCaptureConfig', 'updateCaptureConfig', 'getCaptureDevices', 'setCaptureCameraSource', 'setPrimaryMic',
  'listAudioSourceIntervals', 'switchAudioSource', 'getSealingProgress', 'getTranscript', 'listTranscriptRevisions',
  'createTranscriptRevision', 'getEvidenceExportJob', 'setCaptureDeviceCredential',
  // Task 3 M6 (blueprint row 113; C3 §2.5): the three simulated STT configuration operations 90-92
  // join the offline scope (23 -> 26); `info.version` stays 0.2.0 (C3 §2.5 names no version change).
  'getSttConfig', 'updateSttConfig', 'testSttConnection',
  // Task 3 R-9..R-11 (blueprint row 132, D106; C3 §2.6, §10.1): the five simulated operations 93-97
  // join the offline scope (26 -> 31), in builder order (a path's GET before its POST);
  // `info.version` stays 0.2.0 (D69: the versions step once, at the M6 gate).
  'getCaptureDiscovery', 'startCaptureDiscovery', 'testCaptureCandidateConnection', 'adoptCaptureCandidate', 'rescanCaptureInputs',
];
const OFFLINE_SCHEMA_NAMES = [
  'HealthResponse', 'SessionCreateRequest', 'SessionStartRequest', 'SessionStopRequest', 'SessionCommandResponse',
  'PrecheckItem', 'SessionResource', 'CurrentSessionResponse', 'VideoTrackStatus', 'AudioChannelStatus',
  'VideoStatusResponse', 'AudioStatusResponse', 'StorageStatusResponse', 'DeviceHealthResponse', 'EvidenceExportRequest',
  'EvidenceExportAccepted', 'EvidenceExportCompositeOptions', 'ApiError', 'Heartbeat', 'CaptureConfigSlice',
  'CaptureDevicesSlice', 'PageQuery', 'CaptureConfigCameraUpdate', 'CaptureConfigMicUpdate', 'CaptureConfigUpdateRequest',
  'CaptureCameraSourceRequest', 'CaptureCredentialWriteRequest', 'AudioSourceSwitchRequest', 'AudioSourceState',
  'AudioSourceIntervalEntry', 'AudioSourceIntervalPage', 'SealingProgressStep', 'SealingProgress', 'TranscriptSegment',
  'TranscriptDocument', 'TranscriptRevisionRequest', 'TranscriptRevision', 'TranscriptRevisionPage', 'EvidenceExportJob',
  // Task 3 M6 (row 113; C3 §2.5): the six STT configuration schemas (39 -> 45 components).
  'SttLastTest', 'SttConfig', 'SttCredentialWrite', 'SttConfigUpdateRequest', 'SttConfigUpdateResult', 'SttConnectionTest',
  // Task 3 R-9..R-11 (row 132, D106; C3 §2.6): the eight schemas of operations 93-97 (45 -> 53 components).
  'CaptureDiscoverySearch', 'CaptureCandidate', 'CaptureDiscoveryState', 'CaptureConnectionTestRequest', 'CaptureConnectionTest',
  'CaptureCandidateAdoptRequest', 'CaptureCandidateAdoption', 'CaptureInputScan',
];
/** Baseline operations whose OpenAPI object C3 §3 modified in M2 (op 42 QUEUED, op 44 device-health v2, audio re-key). */
const OPS_CHANGED_BY_M2 = ['getDeviceHealth', 'getAudioStatus', 'getVideoStatus', 'exportEvidence'];
/** Baseline components whose zod schema C3 §3 modified in M2 (audio re-key, device-health v2, export composite options). */
const SCHEMAS_CHANGED_BY_M2 = [
  'VideoTrackStatus', 'AudioChannelStatus', 'AudioStatusResponse', 'DeviceHealthResponse',
  'EvidenceExportRequest', 'EvidenceExportAccepted',
];
const BASELINE_CODE_LIST =
  'Machine-readable code: INVALID_JSON, NOT_SIGNED_IN, NOT_PERMITTED, FORBIDDEN, NOT_FOUND, METHOD_NOT_ALLOWED, SESSION_ACTIVE, INVALID_INPUT, INVALID_STATE, PRECHECK_RUNNING, PRECHECK_WARNINGS, PRECHECK_BLOCKED, INVALID_REASON, NOT_SEALED, SECURITY_FAULT, SIMULATOR_ERROR.';

function hostsOf(document: OpenApiDocument): string[] {
  const text = serializeOpenApiDocument(document);
  return [...new Set([...text.matchAll(/\b(?:https?|wss?):\/\/[^\s"'`)\\]+/g)].map((match) => new URL(match[0]).host))];
}

/**
 * Every `x-` key of a JSON value that is a vendor extension. The names inside a `headers` map are
 * HTTP header names (`x-request-id`, `x-dems-epoch`), not extensions, so they are left out.
 */
function extensionKeys(value: unknown, out: string[] = [], inHeaders = false): string[] {
  if (Array.isArray(value)) for (const item of value) extensionKeys(item, out);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('x-') && !inHeaders) out.push(key);
      extensionKeys(child, out, key === 'headers');
    }
  }
  return out;
}

describe('scope offline: the default, and the document of the baseline', () => {
  const offline = createOpenApiDocument();

  it('is what createOpenApiDocument() returns, and holds the 31 offline operations (23 of OD-17, STT 90-92 and the camera search 93-97)', () => {
    expect(serializeOpenApiDocument(offline)).toBe(serializeOpenApiDocument(createOpenApiDocument({ scope: 'offline' })));
    expect(serializeOpenApiDocument(offline)).toBe(serializeOpenApiDocument(createOpenApiDocument({ scope: CoreApiScope.OFFLINE, includeSimulated: true })));
    expect(listOpenApiOperations(offline).map((entry) => entry.operation.operationId)).toEqual(OFFLINE_OP_IDS);
    expect(listOpenApiOperations(createOpenApiDocument({ includeSimulated: false })).map((entry) => entry.operation.operationId)).toEqual(['getServiceHealth']);
  });

  it('servers, tags and the header component stay byte-equal to acaff20; info and paths follow the OD-17 scope (M2)', () => {
    // OD-17 (D4) supersedes the whole-document byte-pin: offline grows to 23 operations at version 0.2.0.
    // The three sections the capture operations do not touch stay byte-equal to the baseline commit.
    expect(sha256(offline.servers)).toBe(BASELINE.servers);
    expect(sha256(offline.tags)).toBe(BASELINE.tags);
    expect(sha256(offline.components.headers)).toBe(BASELINE.headers);
    expect(Object.keys(offline)).toEqual(['openapi', 'info', 'servers', 'tags', 'paths', 'components']);
    expect(Object.keys(offline.components)).toEqual(['schemas', 'headers']);
    expect(offline.info.version).toBe(OPENAPI_DOCUMENT_VERSION);
    expect(OPENAPI_DOCUMENT_VERSION).toBe('0.2.0');
  });

  it('keeps the six untouched baseline operations byte-equal to acaff20; the four M2-modified ones, the thirteen capture operations, the three STT ones and the five of the camera search are new content', () => {
    const now = Object.fromEntries(listOpenApiOperations(offline).map((entry) => [entry.operation.operationId, sha256(entry.operation)]));
    expect(Object.keys(now)).toEqual(OFFLINE_OP_IDS);
    for (const [id, hash] of Object.entries(BASELINE.operations)) {
      if (OPS_CHANGED_BY_M2.includes(id)) expect(now[id], id).not.toBe(hash);
      else expect(now[id], id).toBe(hash);
    }
  });

  it('holds the 53 offline components (39 of OD-17, 6 of STT 90-92 and 8 of the camera search 93-97); the eight untouched baseline schemas stay byte-equal to acaff20 and the rest legitimately diverge', () => {
    expect(Object.keys(offline.components.schemas)).toEqual(OFFLINE_SCHEMA_NAMES);
    for (const [name, hash] of Object.entries(BASELINE.schemas)) {
      const now = sha256(offline.components.schemas[name]);
      if (WIDENED.includes(name) || SCHEMAS_CHANGED_BY_M2.includes(name)) expect(now, name).not.toBe(hash);
      else expect(now, name).toBe(hash);
    }
  });

  it('HealthResponse differs by exactly the two additions of 01_specs §7.4', () => {
    const health = structuredClone(offline.components.schemas.HealthResponse) as { properties: Record<string, JsonSchemaObject>; required: string[] };
    expect(health.properties.service).toEqual({ type: 'string', enum: ['dems-mock-core', 'dems-core-server'] });
    expect(health.properties.ready).toEqual({
      type: 'object',
      properties: { database: { type: 'boolean' }, engine: { type: 'boolean' } },
      required: ['database', 'engine'],
    });
    expect(health.required).not.toContain('ready');
    // Undo the two additions: what is left is the baseline component.
    health.properties.service = { type: 'string', const: 'dems-mock-core' };
    delete health.properties.ready;
    expect(sha256(health)).toBe(BASELINE.schemas.HealthResponse);
  });

  it('ApiError differs by exactly the longer code list and the two optional members of 01_specs §7.2', () => {
    const error = structuredClone(offline.components.schemas.ApiError) as {
      properties: { error: { properties: Record<string, JsonSchemaObject>; required: string[] } };
    };
    const inner = error.properties.error;
    expect(Object.keys(inner.properties)).toEqual(['code', 'message', 'details', 'requestId']);
    expect(inner.required).toEqual(['code', 'message']);
    expect(String(inner.properties.code?.description).startsWith(BASELINE_CODE_LIST.slice(0, -1))).toBe(true);
    // Undo the additions: what is left is the baseline component.
    delete inner.properties.details;
    delete inner.properties.requestId;
    inner.properties.code = { ...inner.properties.code, description: BASELINE_CODE_LIST };
    expect(sha256(error)).toBe(BASELINE.schemas.ApiError);
  });

  it('carries none of the registry metadata, no new header and no host but mock-core', () => {
    const keys = [...new Set(extensionKeys(offline))].sort();
    expect(keys).toEqual(['x-badges', 'x-dems-mode', 'x-dems-rbac', 'x-dems-source']);
    expect(Object.keys(offline.components.headers)).toEqual(['XDemsSimulated']);
    expect(hostsOf(offline)).toEqual(['127.0.0.1:4400']);
    expect(serializeOpenApiDocument(offline)).not.toContain('4420');
  });

  it('is not a file: the builder returns it, and the committed openapi.json holds the other scope', () => {
    // Changed by design (W27; AC-B-11, AR-1): until contract C the committed file was this scope.
    // No app reads openapi.json: the web page builds this document in the browser, so what it
    // renders in Simulated mode did not change when the committed scope did.
    expect(OPENAPI_COMMITTED_SCOPE).toBe(CoreApiScope.ALL);
    const committed = readFileSync(OPENAPI_JSON_PATH, 'utf8');
    expect(committed).not.toBe(serializeOpenApiDocument(offline));
    expect(renderOpenApiJson('offline')).toBe(serializeOpenApiDocument(offline));
    expect(listOpenApiOperations(JSON.parse(renderOpenApiJson('offline')) as OpenApiDocument)).toHaveLength(31);
  });

  it('leaves out what only the Core server sends: its statuses, its text, its headers, its security', () => {
    for (const { operation } of listOpenApiOperations(offline)) {
      const entry = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operation.operationId)!;
      expect(Object.keys(operation.responses).map(Number), operation.operationId).toEqual(listCoreApiResponseStatuses(entry, CoreApiScope.OFFLINE));
      expect(operation.description, operation.operationId).toBe(entry.description);
      expect('security' in operation, operation.operationId).toBe(false);
    }
    // The five reads document 200 alone here, as at the baseline; the registry holds 401 and 403 for them.
    const read = offline.paths['/api/v1/session/current']?.get;
    expect(Object.keys(read?.responses ?? {})).toEqual(['200']);
    expect(Object.keys(CORE_API_OPERATIONS.find((operation) => operation.operationId === 'getCurrentSession')!.responses)).toEqual(['200', '401', '403']);
    expect(Object.keys(offline.paths['/api/v1/session/{id}/start']?.post?.responses ?? {})).not.toContain('422');
    expect('securitySchemes' in offline.components).toBe(false);
    expect('security' in offline).toBe(false);
  });
});

describe('scope all: every operation of the registry, as the Core server answers it', () => {
  const all = createOpenApiDocument({ scope: 'all' });
  const operations = listOpenApiOperations(all);
  const entryOf = (operationId: string) => CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId)!;

  it('is a valid OpenAPI 3.1.0 document for @scalar/openapi-parser, with every $ref resolvable', async () => {
    const text = serializeOpenApiDocument(all);
    const result = await validate(text);
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.version).toBe('3.1');
    expect((await dereference(text)).errors ?? []).toEqual([]);
    expect(renderOpenApiJson('all')).toBe(text);
    // Changed by design (W27): `all` is the committed scope, so the default render is this text.
    expect(renderOpenApiJson()).toBe(text);
    expect(text).not.toBe(renderOpenApiJson('offline'));
  });

  it('AC-B-11: is the committed openapi.json, byte for byte, with 97 operations and two security schemes', () => {
    expect(OPENAPI_COMMITTED_SCOPE).toBe(CoreApiScope.ALL);
    const committed = readFileSync(OPENAPI_JSON_PATH, 'utf8');
    expect(committed).toBe(renderOpenApiJson());
    expect(committed).toBe(serializeOpenApiDocument(all));
    const parsed = JSON.parse(committed) as OpenApiDocument;
    expect(listOpenApiOperations(parsed)).toHaveLength(97); // C3 §10.1 total (row 132, D106; was 92 at M6 row 113, 89 at M2 row 50)
    expect(Object.keys(parsed.components.securitySchemes ?? {})).toHaveLength(2);
    expect(parsed.info.version).toBe('0.3.0'); // changed by design (M2 row 50; C3 §8; was 0.2.1 at W83)
    expect(parsed.servers[0]?.url).toBe('http://127.0.0.1:4420');
  });

  it('has 97 operations on 91 paths: 36 GET and 61 POST', () => {
    // C3 §2.5 (M6 row 113): ops 90-92 add two paths (`/transcription/config` GET+POST, `.../test`).
    // C3 §2.6 (row 132, D106): ops 93-97 add four (`/capture/discovery` POST+GET, the candidate's
    // `.../test` and `.../adopt`, `/capture/inputs/rescan`).
    expect(operations).toHaveLength(97);
    expect(Object.keys(all.paths)).toHaveLength(91);
    expect(new Set(operations.map((entry) => entry.operation.operationId))).toEqual(new Set(CORE_API_OPERATIONS.map((operation) => operation.operationId)));
    expect(operations.filter((entry) => entry.method === 'get')).toHaveLength(36);
    expect(operations.filter((entry) => entry.method === 'post')).toHaveLength(61);
    expect(Object.keys(all.paths['/api/v1/pairing/code'] ?? {})).toEqual(['post', 'get']);
    expect(all.tags.map((tag) => tag.name)).toEqual([
      'Service', 'Identity', 'Administration', 'Pairing', 'Session', 'Device', 'Storage', 'Evidence', 'Network', 'Security', 'System', 'Alerts', 'Demo', 'Realtime',
    ]);
    // Every tag an operation uses is declared, and every declared tag but Realtime is used.
    const used = new Set(operations.flatMap((entry) => entry.operation.tags));
    expect([...used].sort()).toEqual(all.tags.map((tag) => tag.name).filter((name) => name !== 'Realtime').sort());
  });

  it('thirty can be answered by the in-app simulator, 67 only by a service; "Show simulated endpoints" off keeps the 67', () => {
    // M6 row 113: the three STT configuration operations are simulated (22 -> 25); row 132 (D106):
    // the five of the camera search are simulated too (25 -> 30). The live count stays 67.
    expect(operations.filter((entry) => entry.operation['x-dems-mode'] === 'simulated')).toHaveLength(30);
    expect(operations.filter((entry) => entry.operation['x-dems-mode'] === 'live')).toHaveLength(67);
    expect(listOpenApiOperations(createOpenApiDocument({ scope: 'all', includeSimulated: false }))).toHaveLength(67);
    // AR-3: in this scope every operation carries LIVE, because the Core server answers each one.
    for (const { operation } of operations) {
      const badges = operation['x-badges'].map((badge) => badge.name);
      expect(badges, operation.operationId).toContain(API_BADGES.LIVE.name);
      expect(badges, operation.operationId).not.toContain(API_BADGES.SIMULATED.name);
    }
    expect(operations.filter((entry) => entry.operation['x-badges'].some((badge) => badge.name === API_BADGES.RBAC_AUDIT.name)).map((entry) => entry.operation.operationId)).toEqual([
      'exportEvidence',
    ]);
  });

  it('states the access rule, the audit rule and the services of every operation', () => {
    for (const { operation } of operations) {
      const entry = entryOf(operation.operationId);
      expect(operation['x-dems-access'], operation.operationId).toEqual({
        rule: describeCoreApiAccess(entry.access),
        permissions: [...coreApiAccessPermissions(entry.access)],
        conditions: [...(entry.access.conditions ?? [])],
      });
      expect(operation['x-dems-audit'], operation.operationId).toEqual({
        success: entry.audit.success,
        denial: entry.audit.denial,
        also: [...(entry.audit.also ?? [])],
      });
      expect(operation['x-dems-services'], operation.operationId).toEqual([...entry.services]);
    }
    expect(operations.find((entry) => entry.operation.operationId === 'getServiceHealth')?.operation['x-dems-services']).toEqual([
      'dems-mock-core',
      'dems-core-server',
    ]);
    // The one any-of names both permissions.
    expect(operations.find((entry) => entry.operation.operationId === 'setStoragePolicy')?.operation['x-dems-access']).toEqual({
      rule: 'ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)',
      permissions: ['EVIDENCE_REVIEW', 'MAINTENANCE'],
      conditions: [],
    });
    // Decision D113 (finding CPS1-3): operation 23 needs the device credential itself, and the
    // document says so in the rule, in the text and in the example of the refusal.
    const rotate = operations.find((entry) => entry.operation.operationId === 'rotateDeviceCredential')?.operation;
    expect(rotate?.['x-dems-access']).toEqual({ rule: 'DEVICE', permissions: [], conditions: ['DEVICE_CREDENTIAL'] });
    expect(rotate?.description).toContain('`403 DEVICE_NOT_PAIRED` (`details.reason: DEVICE_CREDENTIAL_REQUIRED`)');
    expect(rotate?.responses['403']?.description).toContain('DEVICE_NOT_PAIRED, `details.reason: DEVICE_CREDENTIAL_REQUIRED`');
    expect(JSON.stringify(rotate?.responses['403'])).toContain('"reason":"DEVICE_CREDENTIAL_REQUIRED"');
    expect(operations.filter((entry) => (entry.operation['x-dems-access']?.conditions ?? []).includes('DEVICE_CREDENTIAL')).map((entry) => entry.operation.operationId)).toEqual([
      'signInWithBiometric',
      'rotateDeviceCredential',
    ]);
    expect(serializeOpenApiDocument(all).split('DEVICE_CREDENTIAL_REQUIRED')).toHaveLength(7);
    // The offline document has no operation 23, so nothing of the condition reaches it.
    expect(serializeOpenApiDocument(createOpenApiDocument())).not.toContain('DEVICE_CREDENTIAL');
    // 58 operations carry a permission (01_specs §7.19; grew from 41 in M2 with the capture ops,
    // from 51 in M6 with the STT configuration write and test, ops 91/92, and from 53 with the five
    // CAPTURE_CONFIG operations 93-97 of R-9..R-11).
    // Only the four simulated commands keep
    // `x-dems-rbac`, which lists the simulator's role holders; the role holders of the Core server
    // are data, read with `getRoleMatrix`.
    expect(operations.filter((entry) => (entry.operation['x-dems-access']?.permissions ?? []).length > 0)).toHaveLength(58);
    expect(operations.filter((entry) => entry.operation['x-dems-rbac']).map((entry) => entry.operation.operationId).sort()).toEqual([
      'createSession', 'exportEvidence', 'startSession', 'stopSession',
    ]);
  });

  it('API-12: two security schemes, and each operation takes the credential its access rule names', () => {
    const schemes = all.components.securitySchemes;
    expect(Object.keys(schemes ?? {})).toEqual(['sessionCookie', 'bearerAuth']);
    expect(Object.values(OpenApiSecurityScheme)).toEqual(['sessionCookie', 'bearerAuth']);
    // ID-P7: the session cookie, documented under the main instance's name.
    expect(schemes?.sessionCookie).toMatchObject({ type: 'apiKey', in: 'cookie', name: 'dems_session_4420' });
    expect(OPENAPI_SESSION_COOKIE_NAME).toBe(`dems_session_${CORE_SERVER_PORT}`);
    expect(schemes?.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    for (const scheme of Object.values(schemes ?? {})) expect(scheme.description.length).toBeGreaterThan(80);
    // No document-level requirement: the rule is per operation.
    expect('security' in all).toBe(false);

    const cookieOrBearer = [{ sessionCookie: [] }, { bearerAuth: [] }];
    const bearer = [{ bearerAuth: [] }];
    for (const { operation } of operations) {
      const { access } = entryOf(operation.operationId);
      const conditions: readonly string[] = access.conditions ?? [];
      const expected =
        access.kind === CoreApiAccessKind.PUBLIC
          ? conditions.includes('CONSOLE_IDENTITY')
            ? [{}, { bearerAuth: [] }]
            : []
          : access.kind === CoreApiAccessKind.DEVICE || conditions.includes('DEVICE_SESSION')
            ? bearer
            : cookieOrBearer;
      expect(operation.security, operation.operationId).toEqual(expected);
    }
    const securityOf = (operationId: string) => operations.find((entry) => entry.operation.operationId === operationId)?.operation.security;
    expect(securityOf('getServiceHealth')).toEqual([]);
    expect(securityOf('redeemPairingCode')).toEqual([]);
    expect(securityOf('signIn')).toEqual([{}, { bearerAuth: [] }]);
    expect(securityOf('unpairDevice')).toEqual(bearer);
    // D113: the bearer of operation 23 is the device credential; the scheme stays the bearer.
    expect(securityOf('rotateDeviceCredential')).toEqual(bearer);
    expect(securityOf('signInWithBiometric')).toEqual(bearer);
    expect(securityOf('setBiometricEnrollment')).toEqual(bearer);
    expect(securityOf('getCurrentSession')).toEqual(cookieOrBearer);
    expect(securityOf('exportAudit')).toEqual(cookieOrBearer);
    // Task 3 R-9 (C3 §0 `WEB_CONSOLE_SESSION`; D80(3)): the three web-console-only operations keep the
    // credential of an OPERATOR in the document — the bearer of a paired device authenticates there and
    // is then refused 403 `WEB_CONSOLE_ONLY`, which their 403 documents. The condition is in `x-dems-access`.
    expect(securityOf('testCaptureCandidateConnection')).toEqual(cookieOrBearer);
    expect(entryOf('testCaptureCandidateConnection').access.conditions).toEqual(['WEB_CONSOLE_SESSION']);
    // By count: 3 take none, 1 an optional bearer, 6 the bearer, 87 the cookie or the bearer (79 + ops 90-92 + ops 93-97).
    const shape = (security: unknown) => JSON.stringify(security);
    const count = (expected: unknown) => operations.filter((entry) => shape(entry.operation.security) === shape(expected)).length;
    expect([count([]), count([{}, { bearerAuth: [] }]), count(bearer), count(cookieOrBearer)]).toEqual([3, 1, 6, 87]);
  });

  it('API-12: the Core server 127.0.0.1:4420 is the first server, mock-core the second; version 0.3.0 (M2)', () => {
    expect(all.servers.map((server) => server.url)).toEqual([CORE_SERVER_HTTP_ORIGIN, CORE_HTTP_ORIGIN]);
    expect(CORE_SERVER_HTTP_ORIGIN).toBe('http://127.0.0.1:4420');
    expect(all.servers[0]?.description).toContain('dems-core-server');
    expect(all.servers[1]?.description).toContain('It answers no other operation');
    expect(hostsOf(all).sort()).toEqual(['127.0.0.1:4400', '127.0.0.1:4420']);
    expect(all.info.version).toBe(OPENAPI_CORE_SERVER_DOCUMENT_VERSION);
    expect(OPENAPI_CORE_SERVER_DOCUMENT_VERSION).toBe('0.3.0');
    expect(all.info.summary).toContain('97 operations');
    expect(createOpenApiDocument({ scope: 'all', includeSimulated: false }).info.summary).toContain('67 operations');
    // Each build is independent: a caller may change the servers of its own copy.
    const mine = createOpenApiDocument({ scope: 'all' });
    mine.servers[0]!.url = 'http://changed';
    expect(createOpenApiDocument({ scope: 'all' }).servers[0]?.url).toBe(CORE_SERVER_HTTP_ORIGIN);
  });

  it('describes the Core server truthfully: no text of this scope says that mock-core or the browser answers an operation (KI-18)', () => {
    const texts: [string, string][] = [
      ['info.summary', all.info.summary],
      ['info.description', all.info.description],
      ...all.servers.map((server, index) => [`servers[${index}]`, server.description] as [string, string]),
      ...all.tags.map((tag) => [`tag ${tag.name}`, tag.description] as [string, string]),
      ...operations.map(({ operation }) => [operation.operationId, operation.description] as [string, string]),
    ];
    // The sentences of the offline document that are untrue of the Core server.
    const stale = [
      /served by mock-core on 127\.0\.0\.1:4400/,
      /CORS allows the web dev origins/,
      /Liveness of the local mock-core service/,
      /one live endpoint on the local mock-core, nine simulated in the browser/,
      /Served over the network by mock-core/,
      /the simulated endpoints are answered in the browser/,
      /"Try it" is answered in the browser/,
      /Nothing leaves the machine/,
      /left out here on purpose/,
      /no token travels on the wire/,
      /\*\*SIMULATED\.?\*\*/,
    ];
    for (const [where, text] of texts) for (const pattern of stale) expect(text, `${where}: ${pattern}`).not.toMatch(pattern);
    const whole = serializeOpenApiDocument(all);
    for (const pattern of stale) expect(whole, String(pattern)).not.toMatch(pattern);
    // mock-core is named for what it does answer: health and its heartbeat socket.
    expect(all.info.description).toContain('`GET /api/v1/health` and a heartbeat-only');
    for (const tag of all.tags.filter((entry) => !['Service', 'Realtime'].includes(entry.name))) {
      expect(tag.description, tag.name).toContain('Answered by the Core server');
    }
    for (const tag of all.tags.filter((entry) => ['Identity', 'Administration', 'Pairing', 'Demo', 'Network', 'Security', 'System', 'Alerts'].includes(entry.name))) {
      expect(tag.description, tag.name).not.toMatch(/mock-core|simulator/);
    }
    // The ten existing operations show the Core server's text; every other one has one text.
    for (const { operation } of operations) {
      const entry = entryOf(operation.operationId);
      expect(operation.description, operation.operationId).toBe(entry.coreServerDescription ?? entry.description);
    }
    // 01_specs §11: the document offers no media operation and says so.
    expect(all.info.description).toContain('Media and evidence package files are not served');
  });

  it('the Realtime tag names both sockets', () => {
    const realtime = all.tags.find((tag) => tag.name === 'Realtime')?.description ?? '';
    expect(realtime).toContain(`\`${CORE_SERVER_WS_URL}\``);
    expect(realtime).toContain(`\`${CORE_WS_URL}\``);
    expect(realtime.indexOf('### Core server')).toBeGreaterThan(0);
    expect(realtime.indexOf('### mock-core')).toBeGreaterThan(realtime.indexOf('### Core server'));
  });

  it('uses no vendor extension beyond x-badges and x-dems-*; the names in a headers map are HTTP header names', () => {
    const keys = [...new Set(extensionKeys(all))].sort();
    expect(keys).toEqual(['x-badges', 'x-dems-access', 'x-dems-audit', 'x-dems-mode', 'x-dems-rbac', 'x-dems-services', 'x-dems-source']);
    expect(keys.filter((key) => !OPENAPI_ALLOWED_EXTENSION.test(key))).toEqual([]);
    // The pinned response header names of the Core server (D36). `x-request-id` does not fit the
    // extension pattern and need not: it is the name of a header, inside `headers` maps only.
    const headerNames = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (key === 'headers' && child && typeof child === 'object') for (const name of Object.keys(child)) if (name.startsWith('x-')) headerNames.add(name);
          collect(child);
        }
      }
    };
    collect(all.paths);
    expect([...headerNames].sort()).toEqual([EPOCH_HEADER_NAME, REVISION_HEADER_NAME, REQUEST_ID_HEADER_NAME].sort());
    expect([...headerNames].sort()).toEqual(['x-dems-epoch', 'x-dems-revision', 'x-request-id']);
    expect(OPENAPI_ALLOWED_EXTENSION.test(REQUEST_ID_HEADER_NAME)).toBe(false);
    // No renderer feature beyond display (D45).
    const everyKey: string[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          everyKey.push(key);
          walk(child);
        }
      }
    };
    walk(all);
    expect(everyKey.filter((key) => /scalar|agent|mcp|pre-request|post-response|code-?samples/i.test(key))).toEqual([]);
  });

  it('holds one component per registry schema, and the ten existing operations with the schemas of the offline scope', () => {
    expect(Object.keys(all.components.schemas)).toEqual(Object.keys(CORE_API_SCHEMAS));
    expect(Object.keys(all.components.schemas)).toHaveLength(166); // 152 + the six STT configuration schemas (M6 row 113) + the eight of ops 93-97 (row 132)
    const offline = createOpenApiDocument();
    for (const [name, schema] of Object.entries(offline.components.schemas)) expect(all.components.schemas[name], name).toEqual(schema);
    // Changed by design (W27; 01_specs §7.19): in this scope the ten are described as the Core
    // server answers them. What they are is unchanged: ID, tags, summary, parameters, request body,
    // mode, source, the simulator's RBAC note, and the schema and the examples of every status the
    // offline scope documents. What differs is listed below.
    for (const { path, method, operation } of listOpenApiOperations(offline)) {
      const twin = all.paths[path]?.[method];
      expect(twin, operation.operationId).toBeDefined();
      for (const member of ['operationId', 'tags', 'summary', 'parameters', 'requestBody', 'x-dems-mode', 'x-dems-source', 'x-dems-rbac'] as const) {
        expect(twin?.[member], `${operation.operationId} ${member}`).toEqual(operation[member]);
      }
      for (const [status, response] of Object.entries(operation.responses)) {
        // Changed by design (W83, decision D184 DQ-1): a status may carry an all-scope text of its own
        // (`coreServerDescription`: `stopSession` and `exportEvidence` 422); the offline text is unchanged.
        const allText = (entryOf(operation.operationId).responses[Number(status)] as { coreServerDescription?: string } | undefined)?.coreServerDescription;
        expect(twin?.responses[status]?.description, `${operation.operationId} ${status}`).toBe(allText ?? response.description);
        // Changed by design (closing-fix round C1; F84-3, D187 ruling 3): a status may carry examples of
        // the Core server's own answer (`coreServerResponses`: health 200), listed first; the rest of the
        // content is the offline scope's.
        const own = CORE_API_EXAMPLES[operation.operationId]?.coreServerResponses?.[Number(status)];
        const media = response.content?.['application/json'];
        const content = own && media ? { 'application/json': { ...media, examples: { ...own, ...media.examples } } } : response.content;
        expect(twin?.responses[status]?.content, `${operation.operationId} ${status}`).toEqual(content);
      }
      const extra = Object.keys(twin?.responses ?? {}).filter((status) => !(status in operation.responses));
      const entry = entryOf(operation.operationId);
      expect(extra.map(Number), operation.operationId).toEqual(
        listCoreApiResponseStatuses(entry).filter((status) => !listCoreApiResponseStatuses(entry, CoreApiScope.OFFLINE).includes(status)),
      );
    }
    // C1 (F84-3): health is the only such operation; the Live page prefills from the first example,
    // which is a valid answer of the Core server.
    expect(Object.keys(CORE_API_EXAMPLES).filter((id) => CORE_API_EXAMPLES[id]?.coreServerResponses)).toEqual(['getServiceHealth']);
    const health = all.paths['/api/v1/health']?.get?.responses['200']?.content?.['application/json']?.examples ?? {};
    expect(Object.keys(health)).toEqual(['coreServer', 'live']);
    expect(validateCoreApiResponse('getServiceHealth', 200, health.coreServer?.value)).toEqual({ ok: true });
    expect(health.coreServer?.value).toMatchObject({ service: 'dems-core-server', ready: { database: true, engine: true } });
    const serialized = JSON.stringify(all.components.schemas);
    expect(serialized).not.toContain('"$schema"');
    expect(serialized).not.toContain('9007199254740991');
    // Nested named schemas are references.
    expect(JSON.stringify(all.components.schemas.AuthSessionInfo)).toContain('#/components/schemas/Operator');
    expect(JSON.stringify(all.components.schemas.PairingRedeemed)).toContain('#/components/schemas/CoreIdentity');
    // API-6: a read of contract C refers to the slice components; it does not copy them.
    expect(all.components.schemas.DeviceInventory).toMatchObject({
      properties: {
        device: { $ref: '#/components/schemas/DeviceSlice' },
        cameras: { $ref: '#/components/schemas/CamerasSlice' },
        tabletLink: { $ref: '#/components/schemas/TabletLinkSlice' },
      },
      additionalProperties: false,
    });
    expect(JSON.stringify(all.components.schemas.AuditPage)).toContain('#/components/schemas/AuditRow');
    expect(JSON.stringify(all.components.schemas.EvidenceDetail)).toContain('#/components/schemas/EvidenceMediaRef');
    expect(JSON.stringify(all.components.schemas.AuditChainStatus)).toContain('#/components/schemas/AuditChainLineageEntry');
  });

  it('documents the request ID on every answer of the Core server, and the state revision on a 2xx of its POSTs', () => {
    // Changed by design (W27): the nine design-book operations are answered by the Core server in
    // this scope, so they document its headers; the simulator's header belongs to the offline scope.
    expect(Object.keys(all.components.headers)).toEqual(['XRequestId', 'XDemsEpoch', 'XDemsRevision', 'Allow', 'RetryAfter']);
    // D36: the epoch and the revision are integers.
    expect(all.components.headers.XDemsEpoch?.schema).toEqual({ type: 'integer', minimum: 0 });
    expect(all.components.headers.XDemsRevision?.schema).toEqual({ type: 'integer', minimum: 0 });
    for (const { method, operation } of operations) {
      for (const [status, response] of Object.entries(operation.responses)) {
        const names = Object.keys(response.headers ?? {});
        // health is answered by mock-core too, which sends none of them.
        if (operation.operationId === 'getServiceHealth') expect(names).toEqual([]);
        else if (method === 'post' && Number(status) < 300) expect(names, `${operation.operationId} ${status}`).toEqual(['x-request-id', 'x-dems-epoch', 'x-dems-revision']);
        else expect(names, `${operation.operationId} ${status}`).toEqual(['x-request-id']);
      }
    }
    expect(serializeOpenApiDocument(all)).not.toContain('"x-dems-simulated"');
  });

  it('a list read documents its query members as parameters', () => {
    const parametersOf = (path: string) => (all.paths[path]?.get?.parameters ?? []).map((parameter) => [parameter.name, parameter.in, parameter.required]);
    expect(parametersOf('/api/v1/session/history')).toEqual([['cursor', 'query', false], ['limit', 'query', false]]);
    expect(parametersOf('/api/v1/evidence')).toEqual([
      ['status', 'query', false], ['caseType', 'query', false], ['q', 'query', false], ['cursor', 'query', false], ['limit', 'query', false],
    ]);
    expect(parametersOf('/api/v1/audit').map(([name]) => name)).toEqual(['category', 'type', 'actorId', 'sessionId', 'evidenceId', 'order', 'cursor', 'limit']);
    expect(parametersOf('/api/v1/events').map(([name]) => name)).toEqual(['category', 'type', 'severity', 'cursor', 'limit']);
    // API-9: the limit is a whole number from 1 to 200; the cursor is opaque and has a pattern.
    const limit = all.paths['/api/v1/audit']?.get?.parameters?.find((parameter) => parameter.name === 'limit');
    expect(limit?.schema).toEqual({ type: 'integer', minimum: 1, maximum: 200 });
    const cursor = all.paths['/api/v1/audit']?.get?.parameters?.find((parameter) => parameter.name === 'cursor');
    expect(cursor?.schema).toEqual({ type: 'string', pattern: '^[A-Za-z0-9-]{1,128}$' });
    // The item read has its path parameter and no query.
    expect(all.paths['/api/v1/evidence/{id}']?.get?.parameters?.map((parameter) => [parameter.name, parameter.in])).toEqual([['id', 'path']]);
  });

  it('defines the envelope-level answers once, as components.responses', () => {
    const responses = all.components.responses ?? {};
    expect(Object.keys(responses)).toEqual([
      // `InvalidJson` added by design (W83, gap W36-1 and gap W40-1).
      'InvalidPath', 'NotFound', 'MethodNotAllowed', 'NotReady', 'OriginNotAllowed', 'CredentialConflict', 'RateLimited', 'PayloadTooLarge', 'InvalidJson', 'InternalError',
    ]);
    expect(Object.keys(responses)).toHaveLength(CORE_API_ENVELOPE_RESPONSES.length);
    for (const response of Object.values(responses)) {
      expect(response.content?.['application/json'].schema.$ref).toBe('#/components/schemas/ApiError');
    }
    expect(Object.keys(responses.MethodNotAllowed?.headers ?? {})).toEqual(['allow']);
    expect(Object.keys(responses.RateLimited?.headers ?? {})).toEqual(['retry-after']);
    expect(responses.RateLimited?.description.startsWith('429 RATE_LIMITED.')).toBe(true);
  });
});

describe('contract gap 2: the query parameters of an operation come from its query schema', () => {
  it('each member becomes one `in: query` parameter with its JSON Schema; a required member is required', () => {
    const schema = {
      type: 'object',
      properties: {
        cursor: { description: 'Opaque position.', type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
      required: ['limit'],
    };
    expect(buildOpenApiQueryParameters(schema)).toEqual([
      { name: 'cursor', in: 'query', required: false, description: 'Opaque position.', schema: { type: 'string' } },
      { name: 'limit', in: 'query', required: true, description: 'limit', schema: { type: 'integer', minimum: 1, maximum: 200 } },
    ]);
    expect(buildOpenApiQueryParameters(undefined)).toEqual([]);
    // With a real component of the registry.
    const start = createOpenApiDocument().components.schemas.SessionStartRequest;
    expect(buildOpenApiQueryParameters(start).map((parameter) => [parameter.name, parameter.required])).toEqual([['acknowledgeWarnings', false]]);
  });
});
