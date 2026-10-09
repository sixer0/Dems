// Task 3 R-9..R-11, blueprint row 132 (decision D106): the shared contract of operations 93-97 —
// camera search, candidate list, connection test, adoption, local-input re-read
// (masterplan/03_api_contract.md §2.6, §4 erratum PE-121-08, §5.2, §7, §10.1;
// masterplan/10_test_strategy.md §A.4a: M4-PIN-1 shared half, M4-AUD-1 key lists).
//
// | Clause | Where it is held here |
// |---|---|
// | the registry entries equal C3 §2.6 (number, id, method, path, tag, mode, access, audit) | "the registry" |
// | 93, 94, 97 on every console; 89, 95, 96 web console only (`WEB_CONSOLE_SESSION`) | "who may call" |
// | no request carries an address, a host, a port, a URL, a subnet or a filter (R-9 AC-10) | "no caller-supplied target" |
// | no response shape carries a credential (row-121 gate) | "no secret in any shape" |
// | the credential is printable ASCII (erratum PE-128-27) | "the credential" |
// | the constants are those of C3 §7 as fixed at the spec gate (D91) | "the constants" |
// | the four audit key lists; `host` / `endpointRef` for PRODUCTION only (D86 C-3) | "the audit details" |
//
// The simulator's answers are in test/sim-capture-discovery.test.ts; the Core server's half is
// apps/core-server/src/modules/capture-discovery/__tests__.
import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  CAPTURE_ADAPTER_CODE_PATTERN,
  CAPTURE_CANDIDATE_ID_PATTERN,
  CAPTURE_CANDIDATE_TEXT_MAX_LENGTH,
  CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
  CAPTURE_CONNECTION_TEST_MAX_FAILURES,
  CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
  CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
  CAPTURE_CONNECTION_TEST_TIMEOUT_MS,
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_CREDENTIAL_ACCESS,
  CAPTURE_DEVICE_UNREACHABLE_REASONS,
  CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED,
  CAPTURE_DISCOVERY_MAX_CANDIDATES,
  CAPTURE_DISCOVERY_MAX_PER_HOUR,
  CAPTURE_DISCOVERY_MAX_PER_MINUTE,
  CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
  CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS,
  CAPTURE_DISCOVERY_OPERATIONS,
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CAPTURE_DISCOVERY_SCHEMAS,
  CAPTURE_DISCOVERY_WINDOW_MS,
  CAPTURE_HOST_LITERAL_PATTERN,
  CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS,
  CAPTURE_SEARCH_ID_PATTERN,
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CaptureCandidateAdoptRequestSchema,
  CaptureCandidateSchema,
  CaptureConnectionOutcome,
  CaptureConnectionTestRequestSchema,
  CaptureCredentialWriteRequestSchema,
  CaptureDiscoveryReason,
  CaptureDiscoverySearchSchema,
  CaptureDiscoveryStateSchema,
  CaptureSourceClass,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiScope,
  WEB_CONSOLE_ONLY_REASON,
  captureCandidateAdoptedDetails,
  captureConnectionTestedDetails,
  captureDeviceUnreachableDetails,
  captureDiscoverySearchedDetails,
  createOpenApiDocument,
  describeCoreApiAccess,
  findCoreApiOperation,
  listCoreApiOperations,
  listCoreApiResponseStatuses,
  serializeOpenApiDocument,
  simCaptureCandidates,
  simCaptureDiscoverySearch,
  validateCoreApiResponse,
} from '../src/api';
import { AUDIT_TYPE_CATEGORY, AuditType, OperatorRole, Permission, ROLE_PERMISSIONS } from '../src/sim';

const numberOf = (source: string): number => Number(/operation (\d+)/.exec(source)?.[1]);

describe('the registry: operations 93 to 97 as C3 §2.6 writes them', () => {
  it('number, id, method, path, tag, mode, access, conditions and audit', () => {
    const rows = CAPTURE_DISCOVERY_OPERATIONS.map((operation) => [
      numberOf(operation.source),
      operation.operationId,
      operation.method,
      operation.path,
      operation.tag,
      operation.mode,
      describeCoreApiAccess(operation.access),
      'conditions' in operation.access ? [...operation.access.conditions] : [],
      operation.audit.success,
      operation.audit.denial,
    ]);
    expect(rows).toEqual([
      [93, 'startCaptureDiscovery', 'post', '/api/v1/capture/discovery', 'Device', 'simulated', 'CAPTURE_CONFIG', [], 'CAPTURE_DISCOVERY_SEARCHED', 'ACCESS_DENIED'],
      [94, 'getCaptureDiscovery', 'get', '/api/v1/capture/discovery', 'Device', 'simulated', 'CAPTURE_CONFIG', [], CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      [95, 'testCaptureCandidateConnection', 'post', '/api/v1/capture/discovery/candidates/{id}/test', 'Device', 'simulated', 'CAPTURE_CONFIG', ['WEB_CONSOLE_SESSION'], 'CAPTURE_CONNECTION_TESTED', 'ACCESS_DENIED'],
      [96, 'adoptCaptureCandidate', 'post', '/api/v1/capture/discovery/candidates/{id}/adopt', 'Device', 'simulated', 'CAPTURE_CONFIG', ['WEB_CONSOLE_SESSION'], 'CAPTURE_CANDIDATE_ADOPTED', 'ACCESS_DENIED'],
      [97, 'rescanCaptureInputs', 'post', '/api/v1/capture/inputs/rescan', 'Device', 'simulated', 'CAPTURE_CONFIG', [], 'CAPTURE_DISCOVERY_SEARCHED', 'ACCESS_DENIED'],
    ]);
    // They are the last five entries of the table, in number order.
    expect(CORE_API_OPERATIONS.slice(-5).map((operation) => operation.operationId)).toEqual(rows.map((row) => row[1]));
    // The adoption also writes the verification row and, with a credential, the credential fact.
    expect(findCoreApiOperation('adoptCaptureCandidate')?.audit.also).toEqual(['CAPTURE_CONNECTION_TESTED', 'CAPTURE_CREDENTIAL_SET']);
  });

  it('M4-PIN-1 (shared half): 97 operations, 36 GET, 61 POST, offline 31, 67 audit types, 40 error codes (unchanged), 6 access conditions', () => {
    const all = listCoreApiOperations(CoreApiScope.ALL);
    expect([all.length, all.filter((operation) => operation.method === 'get').length, all.filter((operation) => operation.method === 'post').length]).toEqual([97, 36, 61]);
    expect(listCoreApiOperations(CoreApiScope.OFFLINE)).toHaveLength(31);
    expect(Object.values(AuditType)).toHaveLength(67);
    expect(API_ERROR_CODES).toHaveLength(40);
    expect(Object.values(CoreApiAccessCondition)).toHaveLength(6);
    const document = createOpenApiDocument({ scope: 'all' });
    expect(Object.values(document.paths).flatMap((item) => Object.keys(item))).toHaveLength(97);
    // Must FAIL when the registry and the document differ by one operation: a registry without the last one.
    expect(all.slice(0, -1)).toHaveLength(96);
  });

  it('the documented statuses are those of C3 §2.6; 429 and 503 are the envelope-level answers, named by their reason in the text', () => {
    const statuses = Object.fromEntries(CAPTURE_DISCOVERY_OPERATIONS.map((operation) => [operation.operationId, listCoreApiResponseStatuses(operation)]));
    expect(statuses).toEqual({
      startCaptureDiscovery: [200, 202, 401, 403, 409],
      getCaptureDiscovery: [200, 401, 403],
      testCaptureCandidateConnection: [200, 400, 401, 403, 404, 409, 422],
      adoptCaptureCandidate: [201, 400, 401, 403, 404, 409, 422],
      rescanCaptureInputs: [200, 401, 403],
    });
    // What the in-app simulator never sends (C3 §2.6 "Simulator"): the 200 of a search that is still
    // RUNNING and the 409 of another session's search or of a recording.
    expect(listCoreApiResponseStatuses(findCoreApiOperation('startCaptureDiscovery')!, CoreApiScope.OFFLINE)).toEqual([202, 401, 403]);
    for (const status of [429, 503]) expect(CORE_API_ENVELOPE_RESPONSES.some((entry) => entry.status === status)).toBe(true);
    const text = (operationId: string): string => findCoreApiOperation(operationId)?.description ?? '';
    expect(text('startCaptureDiscovery')).toContain('DISCOVERY_RATE_LIMITED');
    expect(text('startCaptureDiscovery')).toContain('DISCOVERY_NOT_READY');
    expect(text('startCaptureDiscovery')).toContain('DISCOVERY_NOT_ALLOWED_WHILE_RECORDING');
    expect(text('testCaptureCandidateConnection')).toContain('CONNECTION_TEST_LOCKOUT_GUARD');
    expect(text('adoptCaptureCandidate')).toContain('CREDENTIAL_STORE_NOT_READY');
    expect(text('rescanCaptureInputs')).toContain('INPUT_RESCAN_RATE_LIMITED');
    // A rate limit and a not-ready answer validate for each of the five without being listed per operation.
    for (const operation of CAPTURE_DISCOVERY_OPERATIONS) {
      expect(validateCoreApiResponse(operation.operationId, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests.', details: { reason: 'DISCOVERY_RATE_LIMITED' } } })).toEqual({ ok: true });
      expect(validateCoreApiResponse(operation.operationId, 503, { error: { code: 'NOT_READY', message: 'Not ready.', details: { reason: 'DISCOVERY_NOT_READY' } } })).toEqual({ ok: true });
    }
  });

  it('every example parses, and the named reasons of the examples are reasons of the contract', () => {
    const reasons = new Set<string>([...Object.values(CaptureDiscoveryReason), WEB_CONSOLE_ONLY_REASON]);
    let checked = 0;
    for (const operation of CAPTURE_DISCOVERY_OPERATIONS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      expect(examples, operation.operationId).toBeDefined();
      for (const [status, named] of Object.entries(examples?.responses ?? {})) {
        for (const [name, example] of Object.entries(named ?? {})) {
          expect(validateCoreApiResponse(operation.operationId, Number(status), example.value), `${operation.operationId} ${status} ${name}`).toEqual({ ok: true });
          const reason = (example.value as { error?: { details?: { reason?: string } } }).error?.details?.reason;
          if (reason !== undefined && reason !== 'DEVICE_REVOKED') expect(reasons, `${operation.operationId} ${status} ${name}`).toContain(reason);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe('who may call (R-9 AC-12; D80(2), D80(3))', () => {
  it('CAPTURE_CONFIG is SUPERVISOR and TECHNICIAN: no new permission, and INVESTIGATOR holds none of the five', () => {
    const holders = Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(Permission.CAPTURE_CONFIG));
    expect(holders.sort()).toEqual([OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN].sort());
    for (const operation of CAPTURE_DISCOVERY_OPERATIONS) expect(describeCoreApiAccess(operation.access), operation.operationId).toBe('CAPTURE_CONFIG');
  });

  it('the three operations whose body carries a camera credential are web console only: 89, 95 and 96, and no other', () => {
    const webOnly = CORE_API_OPERATIONS.filter((operation) => (operation.access.conditions ?? []).includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION));
    expect(webOnly.map((operation) => operation.operationId)).toEqual(['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate']);
    expect(CAPTURE_CREDENTIAL_ACCESS).toEqual({ kind: 'PERMISSION', permission: 'CAPTURE_CONFIG', conditions: ['WEB_CONSOLE_SESSION'] });
    expect(WEB_CONSOLE_ONLY_REASON).toBe('WEB_CONSOLE_ONLY');
    // Exactly the operations whose request schema holds a `credential` pair, or IS one.
    const carriesCredential = CORE_API_OPERATIONS.filter((operation) => {
      if (operation.requestBody === undefined) return false;
      const json = JSON.stringify(createOpenApiDocument({ scope: 'all' }).components.schemas[operation.requestBody.schema]);
      return json.includes('CaptureCredentialWriteRequest') || operation.requestBody.schema === 'CaptureCredentialWriteRequest';
    });
    expect(carriesCredential.map((operation) => operation.operationId)).toEqual(webOnly.map((operation) => operation.operationId));
    // Each of the three documents the refusal on its 403, with the reason and the audit row.
    for (const operation of webOnly) {
      expect(operation.responses[403]?.description, operation.operationId).toContain('WEB_CONSOLE_ONLY');
      expect(operation.responses[403]?.description, operation.operationId).toContain('ACCESS_DENIED');
      expect(CORE_API_EXAMPLES[operation.operationId]?.responses[403]?.webConsoleOnly, operation.operationId).toBeDefined();
    }
  });
});

describe('no caller-supplied target (R-9 AC-10; SEC35-32)', () => {
  const TARGET_MEMBERS = ['address', 'host', 'port', 'url', 'uri', 'path', 'subnet', 'interface', 'timeout', 'windowMs', 'filter', 'profile', 'endpointRef', 'xaddr'];

  it('operations 93, 94 and 97 take no body and no query; 95 and 96 take the optional credential and nothing else', () => {
    for (const id of ['startCaptureDiscovery', 'getCaptureDiscovery', 'rescanCaptureInputs']) {
      const operation = findCoreApiOperation(id)!;
      expect([operation.requestBody, operation.query, operation.pathParam], id).toEqual([undefined, undefined, undefined]);
    }
    for (const schema of [CaptureConnectionTestRequestSchema, CaptureCandidateAdoptRequestSchema]) {
      expect(Object.keys(schema.shape)).toEqual(['credential']);
      expect(schema.safeParse({}).success).toBe(true);
      // A strict object: every member a caller could try to steer the Core with is refused.
      for (const member of TARGET_MEMBERS) expect(schema.safeParse({ [member]: '192.0.2.1' }).success, member).toBe(false);
    }
  });

  it('the one path parameter is a candidate id: an address, a URL and a capture device id do not match it', () => {
    for (const id of ['testCaptureCandidateConnection', 'adoptCaptureCandidate']) {
      const pattern = findCoreApiOperation(id)!.pathParam!.pattern;
      expect(pattern).toBe(CAPTURE_CANDIDATE_ID_PATTERN);
      expect(pattern.test('CND-4F2A91C0D377')).toBe(true);
      for (const other of ['192.0.2.10', '127.0.0.1:8554', 'http://192.0.2.10/onvif', 'CAM-01', 'CND-4f2a91c0d377', 'CND-4F2A91C0D37', 'CND-4F2A91C0D3777', 'DSC-000001']) {
        expect(pattern.test(other), other).toBe(false);
      }
    }
    // Operations 78 and 79 never accept a candidate id: a capture device id has another form in a body line.
    expect(CAPTURE_SEARCH_ID_PATTERN.test('DSC-000012')).toBe(true);
    expect(CAPTURE_SEARCH_ID_PATTERN.test('DSC-12')).toBe(false);
  });
});

describe('no secret in any shape (row-121 gate; RK-12; C-N8)', () => {
  it('the six response schemas of this section have no credential member, at any depth', () => {
    const document = createOpenApiDocument({ scope: 'all' });
    const responses = ['CaptureDiscoverySearch', 'CaptureCandidate', 'CaptureDiscoveryState', 'CaptureConnectionTest', 'CaptureCandidateAdoption', 'CaptureInputScan'];
    expect(Object.keys(CAPTURE_DISCOVERY_SCHEMAS).filter((name) => !name.endsWith('Request'))).toEqual(responses);
    const keys = (value: unknown, out: string[] = []): string[] => {
      if (Array.isArray(value)) for (const item of value) keys(item, out);
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          out.push(key);
          keys(child, out);
        }
      }
      return out;
    };
    for (const name of responses) {
      const members = keys(document.components.schemas[name]);
      expect(members.filter((key) => /^(username|secret|password|credential|token|url|uri|streamUri|xaddrs?)$/i.test(key)), name).toEqual([]);
      expect(JSON.stringify(document.components.schemas[name]), name).not.toContain('CaptureCredentialWriteRequest');
    }
    // Positive control: the same walk finds the pair in the two request schemas.
    expect(keys(document.components.schemas['CaptureConnectionTestRequest'])).toContain('credential');
    expect(keys(document.components.schemas['CaptureCredentialWriteRequest'])).toEqual(expect.arrayContaining(['username', 'secret']));
  });

  it('a candidate with a credential-bearing address, a URL or a host name as `host` does not parse', () => {
    const [candidate] = simCaptureCandidates();
    expect(CaptureCandidateSchema.safeParse(candidate).success).toBe(true);
    for (const host of ['admin:pass@192.0.2.10', 'http://192.0.2.10', 'rtsp://192.0.2.10/stream', 'camera.local', '192.0.2.10/onvif', '']) {
      expect(CaptureCandidateSchema.safeParse({ ...candidate, host }).success, host).toBe(false);
    }
    for (const host of ['192.0.2.10', '127.0.0.1', 'fe80::1']) expect(CAPTURE_HOST_LITERAL_PATTERN.test(host), host).toBe(true);
    // A strict object: a member the contract does not have is refused (a planted credential, a stream address).
    expect(CaptureCandidateSchema.safeParse({ ...candidate, username: 'admin' }).success).toBe(false);
    expect(CaptureCandidateSchema.safeParse({ ...candidate, streamUri: 'rtsp://192.0.2.10/1' }).success).toBe(false);
    // Announced text is bounded: 120 characters, never empty.
    expect(CaptureCandidateSchema.safeParse({ ...candidate, name: 'x'.repeat(CAPTURE_CANDIDATE_TEXT_MAX_LENGTH) }).success).toBe(true);
    expect(CaptureCandidateSchema.safeParse({ ...candidate, name: 'x'.repeat(CAPTURE_CANDIDATE_TEXT_MAX_LENGTH + 1) }).success).toBe(false);
    expect(CaptureCandidateSchema.safeParse({ ...candidate, name: '' }).success).toBe(false);
    expect(CAPTURE_ADAPTER_CODE_PATTERN.test('ONVIF_RTSP')).toBe(true);
  });

  it('the search shape holds counts and codes only, and the state caps the list at 64', () => {
    const search = simCaptureDiscoverySearch('DSC-000001', 1_000, 601_000, true);
    expect(CaptureDiscoverySearchSchema.safeParse(search).success).toBe(true);
    expect(CaptureDiscoverySearchSchema.safeParse({ ...search, scope: 'MIC_LOCAL' }).success).toBe(false);
    expect(CaptureDiscoverySearchSchema.safeParse({ ...search, failureReason: 'bind EADDRINUSE 192.0.2.1:3702' }).success).toBe(false);
    expect(CaptureDiscoverySearchSchema.safeParse({ ...search, interfaceName: 'en0' }).success).toBe(false);
    const [candidate] = simCaptureCandidates();
    const many = (count: number) => ({ search, candidates: Array.from({ length: count }, () => candidate), truncated: true });
    expect(CaptureDiscoveryStateSchema.safeParse(many(CAPTURE_DISCOVERY_MAX_CANDIDATES)).success).toBe(true);
    expect(CaptureDiscoveryStateSchema.safeParse(many(CAPTURE_DISCOVERY_MAX_CANDIDATES + 1)).success).toBe(false);
    expect(Object.values(CaptureConnectionOutcome)).toEqual(['REACHABLE', 'AUTHENTICATION_FAILED', 'WRONG_PROFILE', 'NOT_H264', 'UNREACHABLE']);
  });
});

describe('the credential (C3 §2.3 op 89, §2.6 ops 95 and 96; erratum PE-128-27)', () => {
  it('printable ASCII; the username without the six markup characters; anything else is refused', () => {
    const ok = (username: string, secret: string): boolean => CaptureCredentialWriteRequestSchema.safeParse({ username, secret }).success;
    expect(ok('onvif-operator', 'A long pass phrase, with ~punctuation~ {and} "quotes" <too>!')).toBe(true);
    for (const username of ['adm<in', 'adm>in', 'adm&in', 'adm"in', "adm'in", 'adm\\in', 'ädmin', 'admin\u0007', 'ad\nmin', '']) expect(ok(username, 'secret'), JSON.stringify(username)).toBe(false);
    for (const secret of ['pässword', 'pass\u0000word', 'pass\tword', 'パスワード', '']) expect(ok('admin', secret), JSON.stringify(secret)).toBe(false);
    // Decision D117: the username is at most 120 characters (the bound of the stored column), the secret 1024.
    expect(ok('a'.repeat(120), 's'.repeat(1024))).toBe(true);
    expect(ok('a'.repeat(121), 's')).toBe(false);
    expect(ok('a', 's'.repeat(1025))).toBe(false);
    // Decision D117: a PASSWORD is never trimmed or altered - leading and trailing spaces are part of it;
    // the username is trimmed. A password of spaces only is a password.
    const parsed = CaptureCredentialWriteRequestSchema.parse({ username: '  onvif  ', secret: '  pass word  ' });
    expect(parsed).toEqual({ username: 'onvif', secret: '  pass word  ' });
    expect(CaptureCredentialWriteRequestSchema.parse({ username: 'onvif', secret: ' ' }).secret).toBe(' ');
    expect(CaptureConnectionTestRequestSchema.parse({ credential: { username: 'onvif', secret: 'tail ' } }).credential?.secret).toBe('tail ');
    expect(CaptureCandidateAdoptRequestSchema.parse({ credential: { username: 'onvif', secret: ' lead' } }).credential?.secret).toBe(' lead');
    // The same schema in the three places: op 89's body and the `credential` member of 95 and 96.
    expect(CaptureConnectionTestRequestSchema.shape.credential.unwrap()).toBe(CaptureCredentialWriteRequestSchema);
    expect(CaptureCandidateAdoptRequestSchema.shape.credential.unwrap()).toBe(CaptureCredentialWriteRequestSchema);
    expect(CaptureConnectionTestRequestSchema.safeParse({ credential: { username: 'adm<in', secret: 's' } }).success).toBe(false);
    expect(CaptureConnectionTestRequestSchema.safeParse({ credential: { username: 'admin', secret: 's', host: '192.0.2.1' } }).success).toBe(false);
  });

  it('no example of the document carries anything but the placeholders', () => {
    for (const id of ['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate']) {
      for (const example of Object.values(CORE_API_EXAMPLES[id]?.request ?? {})) {
        const value = example.value as { username?: string; secret?: string; credential?: { username: string; secret: string } };
        const pair = value.credential ?? (value.username === undefined ? undefined : { username: value.username, secret: value.secret });
        if (pair !== undefined) expect(pair, id).toEqual({ username: 'USERNAME', secret: 'SECRET' });
      }
    }
    // No example value of the five operations is a URL or holds a `user@host` form.
    const examples = JSON.stringify(CAPTURE_DISCOVERY_OPERATIONS.map((operation) => CORE_API_EXAMPLES[operation.operationId]));
    expect(examples).not.toMatch(/:\/\/|@/);
    expect(serializeOpenApiDocument(createOpenApiDocument({ scope: 'all' }))).toContain('"USERNAME"');
  });
});

describe('the constants (C3 §7, errata PE-128-17..21; decisions D86 C-2 / C-8, D91)', () => {
  it('one value each, as fixed at the spec gate', () => {
    expect({
      CAPTURE_DISCOVERY_WINDOW_MS,
      CAPTURE_DISCOVERY_RESULT_TTL_MS,
      CAPTURE_DISCOVERY_MAX_CANDIDATES,
      CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
      CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS,
      CAPTURE_DISCOVERY_MAX_PER_MINUTE,
      CAPTURE_DISCOVERY_MAX_PER_HOUR,
      CAPTURE_CONNECTION_TEST_TIMEOUT_MS,
      CAPTURE_CONNECTION_TEST_VALIDITY_MS,
      CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
      CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
      CAPTURE_CONNECTION_TEST_MAX_FAILURES,
      CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
      CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS,
      CAPTURE_CANDIDATE_TEXT_MAX_LENGTH,
    }).toEqual({
      CAPTURE_DISCOVERY_WINDOW_MS: 3_000,
      CAPTURE_DISCOVERY_RESULT_TTL_MS: 600_000,
      CAPTURE_DISCOVERY_MAX_CANDIDATES: 64,
      CAPTURE_DISCOVERY_MIN_INTERVAL_MS: 10_000,
      CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS: 5_000,
      CAPTURE_DISCOVERY_MAX_PER_MINUTE: 6,
      CAPTURE_DISCOVERY_MAX_PER_HOUR: 30,
      CAPTURE_CONNECTION_TEST_TIMEOUT_MS: 15_000,
      CAPTURE_CONNECTION_TEST_VALIDITY_MS: 300_000,
      CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS: 5_000,
      CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE: 6,
      CAPTURE_CONNECTION_TEST_MAX_FAILURES: 2,
      CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS: 1_800_000,
      CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS: 5_000,
      CAPTURE_CANDIDATE_TEXT_MAX_LENGTH: 120,
    });
    expect(CAPTURE_SEARCH_ID_PATTERN.source).toBe('^DSC-[0-9]{6,}$');
    expect(CAPTURE_CANDIDATE_ID_PATTERN.source).toBe('^CND-[0-9A-F]{12}$');
    // The lift of D86 C-4 is a boolean and nothing else; what allows it to be `true` is held by the
    // static test of the Core server (check M4-DISC-REC-1 (b)).
    expect(typeof CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED).toBe('boolean');
  });
});

describe('the audit details (C3 §5.2; M4-AUD-1: exact keys, no values)', () => {
  it('the four types sit in existing categories', () => {
    expect([
      AUDIT_TYPE_CATEGORY.CAPTURE_DISCOVERY_SEARCHED,
      AUDIT_TYPE_CATEGORY.CAPTURE_CONNECTION_TESTED,
      AUDIT_TYPE_CATEGORY.CAPTURE_CANDIDATE_ADOPTED,
      AUDIT_TYPE_CATEGORY.CAPTURE_DEVICE_UNREACHABLE,
    ]).toEqual(['DEVICE', 'SECURITY', 'DEVICE', 'DEVICE']);
  });

  it('CAPTURE_DISCOVERY_SEARCHED: eight required keys, four optional ones, counts and codes only', () => {
    const base = { searchId: 'DSC-000012', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 1 } as const;
    expect(captureDiscoverySearchedDetails(base)).toEqual(base);
    expect(Object.keys(captureDiscoverySearchedDetails({ ...base, outcome: 'FAILED', failureReason: 'SOCKET_ERROR', sessionId: 'SES-20261009-0003', operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' }))).toEqual([
      'searchId', 'scope', 'trigger', 'outcome', 'responderCount', 'newCount', 'registeredCount', 'interfaceCount', 'failureReason', 'sessionId', 'operationId', 'permission',
    ]);
    // An absent or null optional leaves no key behind.
    expect(Object.keys(captureDiscoverySearchedDetails({ ...base, failureReason: null, sessionId: null, operationId: null, permission: null }))).toHaveLength(8);
  });

  it('CAPTURE_CONNECTION_TESTED and CAPTURE_CANDIDATE_ADOPTED: `host` and `endpointRef` for a PRODUCTION candidate only (D86 C-3)', () => {
    const identity = { host: '192.0.2.10', endpointRef: 'urn:uuid:00000000-0000-0000-0000-000000000000' };
    const tested = { candidateId: 'CND-4F2A91C0D377', searchId: 'DSC-000012', outcome: 'AUTHENTICATION_FAILED', authenticated: true, adapter: 'ONVIF_RTSP', operationId: 'testCaptureCandidateConnection' } as const;
    const production = captureConnectionTestedDetails({ ...tested, sourceClass: CaptureSourceClass.PRODUCTION, ...identity, guardTripped: true, permission: 'CAPTURE_CONFIG' });
    expect(Object.keys(production)).toEqual(['candidateId', 'searchId', 'outcome', 'authenticated', 'adapter', 'sourceClass', 'operationId', 'host', 'endpointRef', 'guardTripped', 'permission']);
    // The same facts for a DEVELOPMENT candidate: the two identity keys are dropped, whatever was passed.
    const development = captureConnectionTestedDetails({ ...tested, adapter: 'FAKE', sourceClass: CaptureSourceClass.DEVELOPMENT, ...identity });
    expect(Object.keys(development)).toEqual(['candidateId', 'searchId', 'outcome', 'authenticated', 'adapter', 'sourceClass', 'operationId']);

    const adopted = { deviceId: 'CAM-03', candidateId: 'CND-4F2A91C0D377', searchId: 'DSC-000012', adapter: 'ONVIF_RTSP', credentialSet: true } as const;
    expect(Object.keys(captureCandidateAdoptedDetails({ ...adopted, sourceClass: CaptureSourceClass.PRODUCTION, ...identity }))).toEqual([
      'deviceId', 'candidateId', 'searchId', 'adapter', 'sourceClass', 'credentialSet', 'operationId', 'host', 'endpointRef',
    ]);
    expect(Object.keys(captureCandidateAdoptedDetails({ ...adopted, adapter: 'FAKE', sourceClass: CaptureSourceClass.DEVELOPMENT, ...identity }))).toEqual([
      'deviceId', 'candidateId', 'searchId', 'adapter', 'sourceClass', 'credentialSet', 'operationId',
    ]);
    expect(captureCandidateAdoptedDetails({ ...adopted, sourceClass: CaptureSourceClass.PRODUCTION }).operationId).toBe('adoptCaptureCandidate');
    // No builder has a parameter for a username, a secret or a URL: the key cannot be written.
    for (const details of [production, development]) expect(Object.keys(details).filter((key) => /user|secret|password|url|credential$/i.test(key))).toEqual([]);
  });

  it('CAPTURE_DEVICE_UNREACHABLE: exactly six keys, and the eight reasons of C3 §5.2', () => {
    expect(captureDeviceUnreachableDetails({ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId: 'SES-20261009-0003' })).toEqual({
      deviceId: 'CAM-02',
      deviceKind: 'CAMERA',
      phase: 'PRECHECK',
      reason: 'UNREACHABLE',
      degraded: true,
      sessionId: 'SES-20261009-0003',
    });
    expect([...CAPTURE_DEVICE_UNREACHABLE_REASONS]).toEqual(['UNREACHABLE', 'AUTHENTICATION_FAILED', 'NOT_CONNECTED', 'PERMISSION_DENIED', 'DEVICE_BUSY', 'DEVICE_NOT_FOUND', 'OPEN_FAILED', 'HELPER_EXITED']);
  });
});
