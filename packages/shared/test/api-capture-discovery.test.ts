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
  CAPTURE_AUDIO_CARD_ACCESS,
  CAPTURE_AUDIO_CARD_DEVICE_INDEX_MAX,
  CAPTURE_AUDIO_CARD_ID_PATTERN,
  CAPTURE_AUDIO_CARD_MAX_CHANNELS,
  CAPTURE_AUDIO_CARD_MAX_ENTRIES,
  CAPTURE_AUDIO_CARD_OPERATIONS,
  CAPTURE_AUDIO_CARD_SCHEMAS,
  CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS,
  CAPTURE_AUDIO_CARD_TEXT_MAX_LENGTH,
  CAPTURE_AUDIO_CARD_TEXT_PATTERN,
  CAPTURE_AUDIO_SAMPLE_BITS,
  CAPTURE_AUDIO_USB_ID_PATTERN,
  CAPTURE_AUDIO_USB_PORT_PATTERN,
  CAPTURE_AUDIO_USB_SERIAL_PATTERN,
  CAPTURE_DEVICE_TEST_EXAMPLES,
  CAPTURE_DEVICE_TEST_OPERATIONS,
  CAPTURE_DEVICE_TEST_PATH,
  CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES,
  CAPTURE_DEVICE_TEST_SCHEMAS,
  CAPTURE_DEVICE_TEST_AUDIT_PROFILES_MAX,
  CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE,
  CaptureConnectionTestReason,
  CaptureDeviceTestUnreachableReason,
  CaptureDeviceConnectionTestSchema,
  CaptureDeviceTestProfiles,
  captureDeviceConnectionTestedDetails,
  CAPTURE_CANDIDATE_ID_PATTERN,
  CAPTURE_CANDIDATE_TEXT_MAX_LENGTH,
  CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
  CAPTURE_CONNECTION_TEST_MAX_FAILURES,
  CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
  CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
  CAPTURE_CONNECTION_TEST_TIMEOUT_MS,
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_CREDENTIAL_ACCESS,
  CAPTURE_CAMERA_DEVICE_ID_PATTERN,
  CAPTURE_DEVICE_ADDRESS_CONFIRM_PATH,
  CAPTURE_DEVICE_CONFIRMED_ADDRESS_MAX_LENGTH,
  CAPTURE_DEVICE_CONFIRMED_ADDRESS_PATTERN,
  CAPTURE_DEVICE_UNREACHABLE_REASONS,
  CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE,
  CAPTURE_READDRESS_AUDIT_REASON,
  CAPTURE_READDRESS_EXAMPLES,
  CAPTURE_READDRESS_OPERATIONS,
  CAPTURE_READDRESS_REFUSAL_SENTENCES,
  CAPTURE_READDRESS_SCHEMAS,
  CREDENTIAL_CARRYING_OPERATIONS,
  CaptureDeviceAddressConfirmRequestSchema,
  CaptureDeviceAddressConfirmationSchema,
  CaptureReaddressReason,
  CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED,
  CAPTURE_DISCOVERY_MAX_CANDIDATES,
  CAPTURE_DISCOVERY_MAX_PER_HOUR,
  CAPTURE_DISCOVERY_MAX_PER_MINUTE,
  CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
  CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS,
  CAPTURE_DISCOVERY_OPERATIONS,
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CAPTURE_DISCOVERY_SCHEMAS,
  CAPTURE_DISCOVERY_TYPED_ADDRESS_MAX_LENGTH,
  CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN,
  CAPTURE_DISCOVERY_WINDOW_MS,
  CAPTURE_HOST_LITERAL_PATTERN,
  CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS,
  CAPTURE_SEARCH_ID_PATTERN,
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CaptureAudioCardReason,
  CaptureAudioCardSchema,
  type CaptureAudioCardSearch,
  CaptureAudioCardSearchSchema,
  CaptureAudioInputChange,
  CaptureAudioInputRegisterRequestSchema,
  CaptureAudioInputRegistrationSchema,
  CaptureCandidateAdoptRequestSchema,
  CaptureCandidateSchema,
  CaptureConnectionOutcome,
  CaptureConnectionTestRequestSchema,
  CaptureCredentialWriteRequestSchema,
  CaptureDiscoveryReason,
  CaptureDiscoveryScope,
  CaptureDiscoverySearchSchema,
  CaptureDiscoveryStartRequestSchema,
  CaptureDiscoveryStateSchema,
  CaptureSourceClass,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiScope,
  SIM_CAPTURE_AUDIO_CARD_IDS,
  SIM_TYPED_ADDRESS_CANDIDATE_ID,
  SIM_TYPED_ADDRESS_EXAMPLE,
  WEB_CONSOLE_ONLY_REASON,
  captureAudioInputChangedDetails,
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
  simCaptureAudioCards,
  simCaptureCandidates,
  simCaptureDiscoverySearch,
  simTypedAddressAllowed,
  simTypedAddressCandidate,
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
    // They were the last five entries of the table, in number order; task 4 row 63 appends the two
    // sound-card operations 98-99 after them, and row 194 operation 100. Their place is stated from the
    // start of the table now (entries 93 to 97), so that a later operation does not move it.
    // REVISED 2026-11-02 (principal): RB-9 as amended inserts createUser, updateUser and deleteUser
    // in area 2, so every table entry from `disableUser` on sits three places further.
    expect(CORE_API_OPERATIONS.slice(95, 100).map((operation) => operation.operationId)).toEqual(rows.map((row) => row[1]));
    // The adoption also writes the verification row and, with a credential, the credential fact.
    expect(findCoreApiOperation('adoptCaptureCandidate')?.audit.also).toEqual(['CAPTURE_CONNECTION_TESTED', 'CAPTURE_CREDENTIAL_SET']);
  });

  it('M4-PIN-1 (shared half): 119 operations, 41 GET, 78 POST, offline 45, 91 audit types, 40 error codes (unchanged), 6 access conditions', () => {
    // Task 4 row 63: + the two sound-card operations 98-99 (97 -> 99, POST 61 -> 63, offline 31 -> 33).
    // Task 4 row 194: + the confirmed re-address, operation 100 (99 -> 100, POST 63 -> 64, offline 33 -> 34).
    // Task 4 row RD2: + the retirement of a device, operation 111 (110 -> 111, POST 71 -> 72, offline 44 -> 45);
    // + CAPTURE_DEVICE_RETIRED (85 -> 86).
    const all = listCoreApiOperations(CoreApiScope.ALL);
    // Task 4 row D53: + the live preview and the idle meters, operations 112-113 (111 -> 113, POST 72 -> 74, offline unchanged: both live);
    // + CAMERA_PREVIEW_OPENED (86 -> 87).
    // LCD bridge task: + the panel firmware word, operation 114 (113 -> 114, GET 39 -> 40, offline unchanged: it is live).
    // REVISED 2026-11-02 (principal): RB-9 as amended adds createUser, updateUser and deleteUser, three
    // POSTs of area 2 (114 -> 117, POST 74 -> 77); both scopes stay: the three are live, the offline count 45.
    // D57 (2026-11-03, principal): + getPanelSetup (GET) and setPanelSetup (POST), 117 -> 119,
    // GET 40 -> 41, POST 77 -> 78; both live, so the offline scope stays 45; + PANEL_SETUP_CHANGED (90 -> 91).
    expect([all.length, all.filter((operation) => operation.method === 'get').length, all.filter((operation) => operation.method === 'post').length]).toEqual([119, 41, 78]);
    // Task 4 row 102: + the seven commissioning operations 101-107 (100 -> 107, GET 36 -> 39, POST 64 -> 68, offline 34 -> 41).
    // Task 4 row V3: + the stored-credential connection test, operation 108 (107 -> 108, POST 68 -> 69, offline 41 -> 42);
    // + the four audit types of the third vocabulary step (78 -> 82).
    // Task 4 row 116: + the acceptance of the installation and its revocation, operations 109-110
    // (108 -> 110, POST 69 -> 71, offline 42 -> 44); no audit type (the two exist since row 19).
    expect(listCoreApiOperations(CoreApiScope.OFFLINE)).toHaveLength(45);
    // Task 4 row R1b (decision C99): + CAPTURE_VIDEO_ABSENT_IN_SESSION (82 -> 83); no operation.
    // Task 4 row N2: + CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED, CAPTURE_AUDIO_SILENCE_INSERTED (83 -> 85); no operation.
    // REVISED 2026-11-02 (principal): + USER_CREATED, USER_UPDATED and USER_DELETED (87 -> 90).
    expect(Object.values(AuditType)).toHaveLength(93); // D57: + PANEL_SETUP_CHANGED; audit fix row 84: + CAMERA_LINK_DOWN, CAMERA_LINK_UP
    expect(API_ERROR_CODES).toHaveLength(40);
    expect(Object.values(CoreApiAccessCondition)).toHaveLength(8); // D59 (2026-11-04): + VENDOR_ROOT and VENDOR_ACCOUNT
    const document = createOpenApiDocument({ scope: 'all' });
    // REVISED 2026-11-02 (principal): the document carries the three new operations (114 -> 117).
    // D57 (2026-11-03, principal): + the panel-setup pair (117 -> 119).
    expect(Object.values(document.paths).flatMap((item) => Object.keys(item))).toHaveLength(119);
    // Must FAIL when the registry and the document differ by one operation: a registry without the last one.
    expect(all.slice(0, -1)).toHaveLength(118);
  });

  it('the documented statuses are those of C3 §2.6; 429 and 503 are the envelope-level answers, named by their reason in the text', () => {
    const statuses = Object.fromEntries(CAPTURE_DISCOVERY_OPERATIONS.map((operation) => [operation.operationId, listCoreApiResponseStatuses(operation)]));
    expect(statuses).toEqual({
      // Task 4 row 94: the optional body brings 400 (no JSON object) and 422 (outside the schema, or an address the Core may not dial).
      startCaptureDiscovery: [200, 202, 400, 401, 403, 409, 422],
      getCaptureDiscovery: [200, 401, 403],
      testCaptureCandidateConnection: [200, 400, 401, 403, 404, 409, 422],
      adoptCaptureCandidate: [201, 400, 401, 403, 404, 409, 422],
      rescanCaptureInputs: [200, 401, 403],
    });
    // What the in-app simulator never sends (C3 §2.6 "Simulator"): the 200 of a search that is still
    // RUNNING and the 409 of another session's search or of a recording.
    // Task 4 row 94: the simulator reads the optional body, so it sends the 400 and the 422 as well.
    expect(listCoreApiResponseStatuses(findCoreApiOperation('startCaptureDiscovery')!, CoreApiScope.OFFLINE)).toEqual([202, 400, 401, 403, 422]);
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
  it('CAPTURE_CONFIG is the TECHNICIAN\'s since the 0034 revocation: no new permission, and the other two roles hold none of the five', () => {
    const holders = Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(Permission.CAPTURE_CONFIG));
    // OD-10 had SUPERVISOR here too; migration 0034 revoked it on 2026-10-29 (re-pinned 2026-11-03).
    expect(holders).toEqual([OperatorRole.TECHNICIAN]);
    for (const operation of CAPTURE_DISCOVERY_OPERATIONS) expect(describeCoreApiAccess(operation.access), operation.operationId).toBe('CAPTURE_CONFIG');
  });

  it('the three operations whose body carries a camera credential are web console only: 89, 95 and 96; so are the two sound-card operations 98 and 99 and the re-address 100, and no other', () => {
    const everyWebOnly = CORE_API_OPERATIONS.filter((operation) => (operation.access.conditions ?? []).includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION));
    // Task 4 row 63 (design addendum 4.2, "Role"): 98 and 99 are web console only by that ruling;
    // their bodies hold no credential, so the credential rule below is held for the first three.
    // Task 4 row 194 (row 97's DD-2, confirmed by C47 (29)): operation 100 has the access of 96;
    // its body holds no credential either (the stored one stays with the device).
    // Task 4 row 102 (decision U10; design F-4.2 DR-8): the seven commissioning operations 101-107 are
    // web console only on their OWN permission; ONE of them, `setCameraNetwork`, carries a credential -
    // the fourth credential-carrying operation, typed for one job and never stored (C1, C7).
    const COMMISSIONING_IDS = ['getCaptureNetworkConfig', 'updateCaptureNetworkConfig', 'scanFactoryCameras', 'getHostAlias', 'removeHostAlias', 'setCameraNetwork', 'getCameraNetworkJob'];
    // Task 4 row V3 (row 146; C58): operation 108 tests a REGISTERED camera with its STORED credential.
    // It has the access of 95 and NO body, so it carries no credential: it is not a fifth member of
    // `CREDENTIAL_CARRYING_OPERATIONS`.
    // Task 4 row 116 (WP-26b; decision U10): the acceptance of the installation and its revocation
    // (109, 110) are web console only on the commissioning permission; neither body holds a credential.
    // Task 4 row RD2 (decision C147, Q1): the retirement of a device (111) is web console only on the
    // commissioning permission; its body is a closed reason and holds no credential.
    const ACCEPTANCE_IDS = ['acceptInstallation', 'revokeInstallationAcceptance', 'retireCaptureDevice'];
    const AUDIO_CARD_IDS = ['searchCaptureAudioCards', 'registerCaptureAudioInput', 'confirmCaptureDeviceAddress', ...COMMISSIONING_IDS.filter((id) => id !== 'setCameraNetwork'), 'testCaptureDeviceConnection', ...ACCEPTANCE_IDS];
    // D57 (2026-11-03, principal): the two panel-setup operations (118, 119) are web console only
    // on the plain AUTHENTICATED access plus the vendor-identity gate in the handler; neither body
    // holds a camera credential, so they join everyWebOnly but not AUDIO_CARD_IDS.
    expect(everyWebOnly.map((operation) => operation.operationId)).toEqual([
      'setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate', 'searchCaptureAudioCards', 'registerCaptureAudioInput', 'confirmCaptureDeviceAddress', ...COMMISSIONING_IDS, 'testCaptureDeviceConnection', ...ACCEPTANCE_IDS,
      // D57: the panel-setup pair joins the web-console-only set (the vendor gate lives in the handler).
      'getPanelSetup', 'setPanelSetup',
    ]);
    expect(findCoreApiOperation('testCaptureDeviceConnection')?.requestBody).toBeUndefined();
    expect(CAPTURE_AUDIO_CARD_ACCESS).toEqual(CAPTURE_CREDENTIAL_ACCESS);
    // D57: the panel-setup pair is web-console-only without carrying a credential, like the
    // audio-card list above; drop both before comparing with the credential-carrying four.
    const NO_CREDENTIAL_IDS = [...AUDIO_CARD_IDS, 'getPanelSetup', 'setPanelSetup'];
    const webOnly = everyWebOnly.filter((operation) => !NO_CREDENTIAL_IDS.includes(operation.operationId));
    expect(webOnly.map((operation) => operation.operationId)).toEqual([...CREDENTIAL_CARRYING_OPERATIONS]);
    expect(CAPTURE_CREDENTIAL_ACCESS).toEqual({ kind: 'PERMISSION', permission: 'CAPTURE_CONFIG', conditions: ['WEB_CONSOLE_SESSION'] });
    expect(WEB_CONSOLE_ONLY_REASON).toBe('WEB_CONSOLE_ONLY');
    // Exactly the operations whose request schema holds a `credential` pair, or IS one.
    // The document is built once, not per operation (the old shape rebuilt it 48 times and the
    // test timed out under the full-suite load when D57 added a body to the filter's reach).
    const ALL_SCHEMAS = createOpenApiDocument({ scope: 'all' }).components.schemas;
    const carriesCredential = CORE_API_OPERATIONS.filter((operation) => {
      if (operation.requestBody === undefined) return false;
      const json = JSON.stringify(ALL_SCHEMAS[operation.requestBody.schema]);
      return json.includes('CaptureCredentialWriteRequest') || operation.requestBody.schema === 'CaptureCredentialWriteRequest';
    });
    expect(carriesCredential.map((operation) => operation.operationId)).toEqual(webOnly.map((operation) => operation.operationId));
    // Each of the five documents the refusal on its 403, with the reason and the audit row.
    for (const operation of everyWebOnly) {
      expect(operation.responses[403]?.description, operation.operationId).toContain('WEB_CONSOLE_ONLY');
      expect(operation.responses[403]?.description, operation.operationId).toContain('ACCESS_DENIED');
      expect(CORE_API_EXAMPLES[operation.operationId]?.responses[403]?.webConsoleOnly, operation.operationId).toBeDefined();
    }
  });
});

describe('no caller-supplied target (R-9 AC-10; SEC35-32)', () => {
  const TARGET_MEMBERS = ['address', 'host', 'port', 'url', 'uri', 'path', 'subnet', 'interface', 'timeout', 'windowMs', 'filter', 'profile', 'endpointRef', 'xaddr'];

  it('operations 94 and 97 take no body and no query; 93 takes the optional typed address and nothing else; 95 and 96 take the optional credential and nothing else', () => {
    for (const id of ['getCaptureDiscovery', 'rescanCaptureInputs']) {
      const operation = findCoreApiOperation(id)!;
      expect([operation.requestBody, operation.query, operation.pathParam], id).toEqual([undefined, undefined, undefined]);
    }
    // Task 4 row 94 (AM-3): the one exception. An optional body with ONE optional member; every other
    // member a caller could try to steer the Core with is refused, as before.
    const search = findCoreApiOperation('startCaptureDiscovery')!;
    expect([search.requestBody, search.query, search.pathParam]).toEqual([{ schema: 'CaptureDiscoveryStartRequest', required: false }, undefined, undefined]);
    expect(CAPTURE_DISCOVERY_SCHEMAS.CaptureDiscoveryStartRequest).toBe(CaptureDiscoveryStartRequestSchema);
    expect(Object.keys(CaptureDiscoveryStartRequestSchema.shape)).toEqual(['address']);
    expect(CaptureDiscoveryStartRequestSchema.safeParse({}).success).toBe(true);
    for (const member of TARGET_MEMBERS.filter((name) => name !== 'address')) {
      expect(CaptureDiscoveryStartRequestSchema.safeParse({ [member]: '192.168.10.20' }).success, member).toBe(false);
      expect(CaptureDiscoveryStartRequestSchema.safeParse({ address: '192.168.10.20', [member]: '192.168.10.20' }).success, member).toBe(false);
    }
    for (const schema of [CaptureConnectionTestRequestSchema, CaptureCandidateAdoptRequestSchema]) {
      expect(Object.keys(schema.shape)).toEqual(['credential']);
      expect(schema.safeParse({}).success).toBe(true);
      // A strict object: every member a caller could try to steer the Core with is refused.
      for (const member of TARGET_MEMBERS) expect(schema.safeParse({ [member]: '192.0.2.1' }).success, member).toBe(false);
    }
  });

  it('task 4 row 94 (AM-3; S13-11): the typed address of operation 93 is ONE strict dotted quad - the form of the Core\'s destination rule, and no looser', () => {
    const accepts = (address: unknown): boolean => CaptureDiscoveryStartRequestSchema.safeParse({ address }).success;
    // The strict literal: four decimal parts from 0 to 255, no leading zero.
    for (const address of ['192.168.10.20', '10.0.0.1', '172.16.0.9', '172.31.255.254', '192.168.50.101', '0.0.0.0', '255.255.255.255', '1.2.3.4']) {
      expect(accepts(address), address).toBe(true);
      expect(CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(address), address).toBe(true);
    }
    expect(CAPTURE_DISCOVERY_TYPED_ADDRESS_MAX_LENGTH).toBe('255.255.255.255'.length);
    // The cases the rule's own table calls "not a strict dotted quad" (destination-rule.test.ts), one by one ...
    const malformed = [
      '192.168.050.101', '0xC0.168.50.101', '3232248421', '0x7f000001', '192.168.50', '127.1', '192.168.50.101.1', '192.168.50.256',
      '192.168.50.101.', '192.168.50.101:80', '192.168.50.101/24', ' 192.168.50.101', '192.168.50.101\n', '192.168.50.101 127.0.0.1',
      '192.168.50.0103', '00.0.0.1', '192.168.50.999', '300.1.1.1', '1.2.3.-4', '1,2,3,4', '１９２.168.50.101',
    ];
    // ... a name, a locator, a credential-bearing text, and every way of writing an address as IPv6.
    const names = ['camera-1.local', 'localhost', 'gateway', 'camera:80', 'http://192.168.50.101/', 'rtsp://192.168.50.101/stream', 'admin:pass@192.168.50.101', ''];
    const ipv6 = ['::1', '::', '::ffff:127.0.0.1', '::ffff:192.168.50.101', '::ffff:7f00:1', '[::ffff:192.168.50.101]', '::192.168.50.101', '64:ff9b::c0a8:3265', 'fe80::1%en0', 'fd00::10', '2001:db8::1'];
    for (const address of [...malformed, ...names, ...ipv6]) expect(accepts(address), JSON.stringify(address)).toBe(false);
    // Not a text.
    for (const address of [3_232_248_421, null, ['192.168.50.101'], { address: '192.168.50.101' }, true]) expect(accepts(address), JSON.stringify(address)).toBe(false);
    // Must FAIL if the pattern were the loose one of a candidate's `host`: that one lets a leading zero and a part above 255 pass.
    for (const loose of ['192.168.050.101', '192.168.50.999']) expect(CAPTURE_HOST_LITERAL_PATTERN.test(loose), loose).toBe(true);

    // A FORM ONLY: these match, and the Core's rule refuses each (loopback, public, multicast, broadcast).
    for (const address of ['127.0.0.1', '8.8.8.8', '224.0.0.1', '255.255.255.255', '169.254.1.1']) {
      expect(accepts(address), address).toBe(true);
      expect(simTypedAddressAllowed(address), address).toBe(false);
    }
    // The simulator's stand-in: the three private ranges, without the first and the last address of a /24.
    for (const address of ['10.0.0.1', '172.16.0.9', '172.31.255.254', '192.168.10.20', SIM_TYPED_ADDRESS_EXAMPLE]) expect(simTypedAddressAllowed(address), address).toBe(true);
    for (const address of ['172.15.0.9', '172.32.0.9', '192.169.1.1', '11.0.0.1', '192.168.10.0', '192.168.10.255', '192.168.050.101', 'localhost', '']) expect(simTypedAddressAllowed(address), address).toBe(false);
  });

  it('task 4 row 94: the generated description of operation 93 states the member, the rule, the refusal and the web-console bound; a search without it is documented as unchanged', () => {
    const operation = findCoreApiOperation('startCaptureDiscovery')!;
    for (const part of ['The body is optional', '`address`', 'one** unicast WS-Discovery probe', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'DISCOVERY_ADDRESS_NOT_ALLOWED', 'never quotes the address', 'probe answer only', 'web console only', 'WEB_CONSOLE_ONLY']) {
      expect(operation.description, part).toContain(part);
    }
    expect(operation.description).not.toContain('**No body.**');
    // The access of the operation is what it was (decision C10: the permission of today's search): no condition on the operation itself.
    expect(describeCoreApiAccess(operation.access)).toBe('CAPTURE_CONFIG');
    expect('conditions' in operation.access).toBe(false);
    expect(operation.responses[403]?.description).toContain('WEB_CONSOLE_ONLY');
    expect(operation.responses[422]?.description).toContain('DISCOVERY_ADDRESS_NOT_ALLOWED');
    expect(CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED).toBe('DISCOVERY_ADDRESS_NOT_ALLOWED');

    // The examples: the FIRST request example is the search without an address (what the Core's
    // acceptance suites send), and no example text carries a refused address.
    const examples = CORE_API_EXAMPLES['startCaptureDiscovery']!;
    expect(Object.entries(examples.request ?? {}).map(([name, example]) => [name, example.value])).toEqual([
      ['search', {}],
      ['typedAddress', { address: SIM_TYPED_ADDRESS_EXAMPLE }],
    ]);
    for (const example of Object.values(examples.request ?? {})) expect(CaptureDiscoveryStartRequestSchema.safeParse(example.value).success).toBe(true);
    expect(Object.keys(examples.responses[202] ?? {})).toEqual(['started', 'typedAddress']);
    expect(Object.keys(examples.responses[403] ?? {})).toContain('webConsoleOnly');
    expect(Object.keys(examples.responses[422] ?? {})).toEqual(['invalidInput', 'addressNotAllowed']);
    expect(JSON.stringify(examples.responses[422])).not.toMatch(/\d+\.\d+\.\d+\.\d+/);

    // The document: an optional body, the pattern of the schema, the member not required.
    const document = createOpenApiDocument({ scope: 'all' });
    const component = document.components.schemas['CaptureDiscoveryStartRequest'] as { properties: { address: { pattern: string; maxLength: number } }; required?: string[]; additionalProperties?: boolean };
    expect(component.properties.address.pattern).toBe(CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.source);
    expect(component.properties.address.maxLength).toBe(15);
    expect(component.required ?? []).toEqual([]);
    expect(component.additionalProperties).toBe(false);

    // The synthetic candidate of the simulator parses as a candidate, and says by itself what it is.
    const typed = simTypedAddressCandidate(SIM_TYPED_ADDRESS_EXAMPLE);
    expect(CaptureCandidateSchema.safeParse(typed).success).toBe(true);
    expect([typed.candidateId, typed.adapter, typed.sourceClass, typed.host, typed.vendor, typed.status]).toEqual([SIM_TYPED_ADDRESS_CANDIDATE_ID, 'FAKE', CaptureSourceClass.DEVELOPMENT, SIM_TYPED_ADDRESS_EXAMPLE, 'DEMS', 'NEW']);
    expect(simCaptureCandidates().map((candidate) => candidate.candidateId)).not.toContain(SIM_TYPED_ADDRESS_CANDIDATE_ID);
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

  it('task 4 row 38: the outcomes of before are all still members, `NOT_H264` is kept, and the texts say "usable profile" with no H.264-only wording', () => {
    // Additive (decision AM-2): a value an audit row or a client already holds stays a value of the set.
    const members = Object.values(CaptureConnectionOutcome) as string[];
    for (const before of ['REACHABLE', 'AUTHENTICATION_FAILED', 'WRONG_PROFILE', 'NOT_H264', 'UNREACHABLE']) expect(members, before).toContain(before);
    expect(CaptureConnectionOutcome.NOT_H264).toBe('NOT_H264');
    const operation = findCoreApiOperation('testCaptureCandidateConnection');
    expect(operation?.description).toContain('look for a usable profile');
    expect(operation?.description).toContain('neither H.264 nor HEVC');
    const texts = JSON.stringify([operation?.description, CORE_API_EXAMPLES.testCaptureCandidateConnection, createOpenApiDocument({ scope: CoreApiScope.ALL }).components?.schemas?.['CaptureConnectionTest']]);
    expect(texts).not.toMatch(/usable H\.264/i);
    expect(texts).toContain('H.264 or HEVC');
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

// Task 4, blueprint row 63 (WP-07b; design addendum 4.2; plan review P12-F05 (c), P12-F06; security
// addendum AD-07): the contract of operations 98-99, the listing of the sound cards and the
// registration of one input. The contract only: no Core route answers them yet.
describe('task 4 row 63: operations 98 and 99, the sound cards and the registration of an input', () => {
  it('number, id, method, path, tag, mode, access, conditions and audit; they are entries 98 and 99 of the table', () => {
    const rows = CAPTURE_AUDIO_CARD_OPERATIONS.map((operation) => [
      numberOf(operation.source),
      operation.operationId,
      operation.method,
      operation.path,
      operation.tag,
      operation.mode,
      describeCoreApiAccess(operation.access),
      [...operation.access.conditions],
      operation.audit.success,
      operation.audit.denial,
    ]);
    expect(rows).toEqual([
      [98, 'searchCaptureAudioCards', 'post', '/api/v1/capture/audio-cards/search', 'Device', 'simulated', 'CAPTURE_CONFIG', ['WEB_CONSOLE_SESSION'], 'CAPTURE_DISCOVERY_SEARCHED', 'ACCESS_DENIED'],
      [99, 'registerCaptureAudioInput', 'post', '/api/v1/capture/audio-cards/inputs', 'Device', 'simulated', 'CAPTURE_CONFIG', ['WEB_CONSOLE_SESSION'], 'CAPTURE_AUDIO_INPUT_CHANGED', 'ACCESS_DENIED'],
    ]);
    // REVISED 2026-11-02 (principal): RB-9 as amended inserts createUser, updateUser and deleteUser
    // in area 2, so every table entry from `disableUser` on sits three places further.
    expect(CORE_API_OPERATIONS.slice(100, 102).map((operation) => operation.operationId)).toEqual(rows.map((row) => row[1]));
    expect(Object.keys(CAPTURE_AUDIO_CARD_SCHEMAS)).toEqual(['CaptureAudioCard', 'CaptureAudioCardSearch', 'CaptureAudioInputRegisterRequest', 'CaptureAudioInputRegistration']);
    // The audit types and the third search scope exist since row 19 and the integration pass I-1.
    expect(AUDIT_TYPE_CATEGORY[AuditType.CAPTURE_AUDIO_INPUT_CHANGED]).toBe('DEVICE');
    expect(CaptureDiscoveryScope.AUDIO_CARDS).toBe('AUDIO_CARDS');
  });

  it('the documented statuses; 429 and 503 are envelope-level and named in the text; the simulator never sends a success of 99', () => {
    const search = findCoreApiOperation('searchCaptureAudioCards')!;
    const register = findCoreApiOperation('registerCaptureAudioInput')!;
    expect(listCoreApiResponseStatuses(search)).toEqual([200, 401, 403, 409]);
    expect(listCoreApiResponseStatuses(register)).toEqual([200, 201, 400, 401, 403, 404, 409, 422]);
    // What the in-app simulator can answer: every status of 98; of 99 every refusal and no success.
    expect(listCoreApiResponseStatuses(search, CoreApiScope.OFFLINE)).toEqual([200, 401, 403, 409]);
    expect(listCoreApiResponseStatuses(register, CoreApiScope.OFFLINE)).toEqual([400, 401, 403, 404, 409, 422]);
    expect([search.requestBody, search.query, search.pathParam]).toEqual([undefined, undefined, undefined]);
    expect([register.requestBody, register.pathParam]).toEqual([{ schema: 'CaptureAudioInputRegisterRequest', required: true }, undefined]);
    for (const operation of CAPTURE_AUDIO_CARD_OPERATIONS) {
      // A Core that is not in production capture: 503 with the reason of a camera search without an adapter.
      expect(operation.description, operation.operationId).toContain('`503 NOT_READY`');
      expect(operation.description, operation.operationId).toContain(CaptureDiscoveryReason.DISCOVERY_NOT_READY);
      expect(operation.description, operation.operationId).toContain('CAPTURE_CONFIG_LOCKED');
      expect(validateCoreApiResponse(operation.operationId, 503, { error: { code: 'NOT_READY', message: 'Not ready.', details: { reason: 'DISCOVERY_NOT_READY' } } })).toEqual({ ok: true });
      expect(validateCoreApiResponse(operation.operationId, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests.', details: { reason: 'AUDIO_CARD_SEARCH_RATE_LIMITED' } } })).toEqual({ ok: true });
    }
    expect(search.description).toContain(CaptureAudioCardReason.AUDIO_CARD_SEARCH_RATE_LIMITED);
    expect(register.description).toContain(CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD);
    expect(Object.values(CaptureAudioCardReason)).toEqual(['AUDIO_CARD_SEARCH_IN_PROGRESS', 'AUDIO_INPUT_BEYOND_CARD', 'AUDIO_INPUT_NOT_REGISTRABLE', 'AUDIO_CARD_ALREADY_BOUND', 'AUDIO_CARD_SEARCH_RATE_LIMITED']);
    // R-FLEX AU-R1 (row 99): a card another microphone holds is a 409 reason of 99, named in its text and its 409 entry.
    expect(register.description).toContain(CaptureAudioCardReason.AUDIO_CARD_ALREADY_BOUND);
    expect(register.description).toContain('release: true');
    expect(register.responses[409]?.description).toContain(CaptureAudioCardReason.AUDIO_CARD_ALREADY_BOUND);
    expect(register.responses[409]?.description).not.toContain('nor a port');
    expect(search.description).toContain('`boundTo`');
    expect(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS).toBe(CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS);
  });

  it('every example parses, and the named reasons of the examples are reasons of the contract', () => {
    const reasons = new Set<string>([...Object.values(CaptureAudioCardReason), WEB_CONSOLE_ONLY_REASON]);
    let checked = 0;
    for (const operation of CAPTURE_AUDIO_CARD_OPERATIONS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      for (const [status, named] of Object.entries(examples?.responses ?? {})) {
        for (const [name, example] of Object.entries(named ?? {})) {
          expect(validateCoreApiResponse(operation.operationId, Number(status), example.value), `${operation.operationId} ${status} ${name}`).toEqual({ ok: true });
          const reason = (example.value as { error?: { details?: { reason?: string } } }).error?.details?.reason;
          if (reason !== undefined && reason !== 'DEVICE_REVOKED') expect(reasons, `${operation.operationId} ${status} ${name}`).toContain(reason);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(15);
    expect(CaptureAudioInputRegisterRequestSchema.safeParse(CORE_API_EXAMPLES.registerCaptureAudioInput?.request?.firstInput?.value).success).toBe(true);
    // R-FLEX (row 99): the examples carry `boundTo` (AU-L1), `release` (AU-B1), `releasedDeviceId` (AU-B2) and the AU-R1 refusal with the holder.
    const register = CORE_API_EXAMPLES.registerCaptureAudioInput!;
    expect(CaptureAudioInputRegisterRequestSchema.safeParse(register.request?.release?.value).success).toBe(true);
    expect((register.request?.release?.value as { release?: boolean }).release).toBe(true);
    expect(register.responses[200]?.released?.value).toMatchObject({ change: 'REENABLED', releasedDeviceId: 'MIC-03', deviceId: 'MIC-03' });
    expect(register.responses[200]?.reenabled?.value).toMatchObject({ releasedDeviceId: null });
    expect(register.responses[201]?.registered?.value).toMatchObject({ releasedDeviceId: null });
    expect(register.responses[409]?.alreadyBound?.value).toMatchObject({ error: { code: 'INVALID_STATE', details: { reason: 'AUDIO_CARD_ALREADY_BOUND', deviceId: 'MIC-03' } } });
    const listing = CORE_API_EXAMPLES.searchCaptureAudioCards!.responses[200]!;
    expect((listing.registered!.value as CaptureAudioCardSearch).cards.map((card) => card.boundTo)).toEqual(['MIC-03']);
    expect((listing.simulated!.value as CaptureAudioCardSearch).cards.map((card) => card.boundTo)).toEqual([null, null]);
  });

  it('AD-07 (1): device text is held to a closed character rule and a stated length, in the schema', () => {
    const card = simCaptureAudioCards()[0]!;
    expect(CaptureAudioCardSchema.safeParse(card).success).toBe(true);
    const product = (value: string): boolean => CaptureAudioCardSchema.safeParse({ ...card, product: value }).success;
    expect(product('USB Audio CODEC (rev 2)')).toBe(true);
    expect(product('x'.repeat(CAPTURE_AUDIO_CARD_TEXT_MAX_LENGTH))).toBe(true);
    for (const refused of [
      '',
      'x'.repeat(CAPTURE_AUDIO_CARD_TEXT_MAX_LENGTH + 1),
      'line\nbreak',
      'tab\there',
      'nul\u0000',
      'escape\u001b[31m',
      'delete\u007f',
      'café',
      'right-to-left ‮ override',
      'left-to-right ‎ mark',
      'zero​width',
      'joiner‍',
      'byte order ﻿ mark',
      'lone \ud800 surrogate',
    ]) {
      expect(product(refused), JSON.stringify(refused)).toBe(false);
    }
    const usb = (value: unknown): boolean => CaptureAudioCardSchema.safeParse({ ...card, usbId: value }).success;
    expect([usb(null), usb('08bb:2902')]).toEqual([true, true]);
    for (const refused of ['08BB:2902', '8bb:2902', '08bb2902', '08bb:29020', ' 08bb:2902', '08bb:2902\n', 'vvvv:pppp']) expect(usb(refused), refused).toBe(false);
    const id = (value: string): boolean => CaptureAudioCardSchema.safeParse({ ...card, cardId: value }).success;
    expect([id('CODEC'), id('USB_Audio_1'), id('x'.repeat(32))]).toEqual([true, true, true]);
    for (const refused of ['', 'x'.repeat(33), 'USB Audio', 'hw:1,0', 'card/1', '../card', 'c\u0000', 'caïd']) expect(id(refused), JSON.stringify(refused)).toBe(false);
    // Integers within their bounds; the sample sizes are a closed set and never a format name.
    const whole = (member: string, value: unknown): boolean => CaptureAudioCardSchema.safeParse({ ...card, [member]: value }).success;
    expect([whole('deviceIndex', 0), whole('deviceIndex', CAPTURE_AUDIO_CARD_DEVICE_INDEX_MAX), whole('channelCount', 1), whole('channelCount', CAPTURE_AUDIO_CARD_MAX_CHANNELS)]).toEqual([true, true, true, true]);
    expect([whole('deviceIndex', -1), whole('deviceIndex', 32), whole('deviceIndex', 0.5), whole('channelCount', 0), whole('channelCount', 65), whole('channelCount', '2')]).toEqual([false, false, false, false, false, false]);
    expect([...CAPTURE_AUDIO_SAMPLE_BITS]).toEqual([16, 24, 32]);
    expect([whole('sampleBits', [16, 24, 32]), whole('sampleBits', []), whole('sampleBits', [8]), whole('sampleBits', ['S24_3LE']), whole('sampleBits', [16, 16, 24, 32])]).toEqual([true, true, false, false, false]);
    expect(whole('registered', [{ inputNumber: 1, deviceId: 'MIC-03' }])).toBe(true);
    // R-FLEX AU-L1 (row 99): `boundTo` is a registry id or null, required; never device text.
    expect([whole('boundTo', null), whole('boundTo', 'MIC-03')]).toEqual([true, true]);
    for (const refused of [undefined, '', 'mic 3', 'MIC-03 ', 'USB Audio CODEC', 'CAM-01x', 3]) expect(whole('boundTo', refused), JSON.stringify(refused)).toBe(false);
    expect([whole('registered', [{ inputNumber: 0, deviceId: 'MIC-03' }]), whole('registered', [{ inputNumber: 1, deviceId: 'mic 3' }]), whole('registered', [{ inputNumber: 1, deviceId: 'MIC-03', product: 'x' }])]).toEqual([false, false, false]);
    // A strict object: no member beyond the ten (seven, since row V3 the serial and the port of a USB card; rows 199 / 200, C56; since R-FLEX row 99 `boundTo`, AU-L1).
    expect(Object.keys(CaptureAudioCardSchema.shape)).toEqual(['cardId', 'deviceIndex', 'usbId', 'usbSerial', 'usbPort', 'product', 'channelCount', 'sampleBits', 'registered', 'boundTo']);
    // The two are OPTIONAL and NULLABLE (an answer without them is what it was: the simulator's), and
    // each is held to the closed form of its column: letters, digits and `: . _ -`, 1 to 64.
    for (const member of ['usbSerial', 'usbPort']) {
      expect([whole(member, undefined), whole(member, null), whole(member, 'A1B2-C3.d4_e5:6'), whole(member, '0000:00:14.0-2.1'), whole(member, 'x'.repeat(64))], member).toEqual([true, true, true, true, true]);
      for (const refused of ['', 'x'.repeat(65), 'SN 123', 'serial/1', '../x', 'a\u0000', 'sériel', '<b>', 'a,b', 12]) expect(whole(member, refused), `${member} ${JSON.stringify(refused)}`).toBe(false);
    }
    expect(CAPTURE_AUDIO_USB_SERIAL_PATTERN.source).toBe('^[A-Za-z0-9:._-]{1,64}$');
    expect(CAPTURE_AUDIO_USB_PORT_PATTERN.source).toBe(CAPTURE_AUDIO_USB_SERIAL_PATTERN.source);
    expect(whole('path', '/dev/snd/pcmC1D0c')).toBe(false);
    // The list is capped, and the cap is what `truncated` speaks of.
    const many = (length: number) => ({ searchedAt: 0, cards: Array.from({ length }, () => card), truncated: false });
    expect([CaptureAudioCardSearchSchema.safeParse(many(CAPTURE_AUDIO_CARD_MAX_ENTRIES)).success, CaptureAudioCardSearchSchema.safeParse(many(CAPTURE_AUDIO_CARD_MAX_ENTRIES + 1)).success]).toEqual([true, false]);
  });

  it('AD-07 (2): the request of 99 is a card id of the kernel\'s form, two integers and an optional boolean; nothing a device chose can be sent', () => {
    expect(Object.keys(CaptureAudioInputRegisterRequestSchema.shape)).toEqual(['cardId', 'deviceIndex', 'inputNumber', 'release']);
    const body = { cardId: 'CODEC', deviceIndex: 0, inputNumber: 1 };
    expect(CaptureAudioInputRegisterRequestSchema.safeParse(body).success).toBe(true);
    expect(CaptureAudioInputRegisterRequestSchema.safeParse({ ...body, inputNumber: CAPTURE_AUDIO_CARD_MAX_CHANNELS }).success).toBe(true);
    // R-FLEX AU-B1 (row 99): `release` is optional (absent = false) and a boolean only.
    expect([true, false].map((release) => CaptureAudioInputRegisterRequestSchema.safeParse({ ...body, release }).success)).toEqual([true, true]);
    expect(CaptureAudioInputRegisterRequestSchema.parse(body).release).toBeUndefined();
    for (const refused of ['true', 1, null, 'MIC-03']) expect(CaptureAudioInputRegisterRequestSchema.safeParse({ ...body, release: refused }).success, JSON.stringify(refused)).toBe(false);
    for (const member of ['product', 'usbId', 'channelCount', 'sampleBits', 'sampleRate', 'model', 'name', 'path', 'device', 'address', 'deviceId', 'role']) {
      expect(CaptureAudioInputRegisterRequestSchema.safeParse({ ...body, [member]: 'x' }).success, member).toBe(false);
    }
    for (const refused of [
      {},
      { cardId: 'CODEC', deviceIndex: 0 },
      { ...body, inputNumber: 0 },
      { ...body, inputNumber: 65 },
      { ...body, inputNumber: 1.5 },
      { ...body, inputNumber: '1' },
      { ...body, deviceIndex: -1 },
      { ...body, deviceIndex: 32 },
      { ...body, cardId: 'hw:CARD=CODEC,DEV=0' },
      { ...body, cardId: 'CODEC; rm -rf /' },
      { ...body, cardId: '--device' },
      { ...body, cardId: 1 },
    ]) {
      expect(CaptureAudioInputRegisterRequestSchema.safeParse(refused).success, JSON.stringify(refused)).toBe(false);
    }
    expect(CAPTURE_AUDIO_CARD_ID_PATTERN.test('CODEC')).toBe(true);
    expect(CAPTURE_AUDIO_USB_ID_PATTERN.test('08bb:2902')).toBe(true);
    expect(CAPTURE_AUDIO_CARD_TEXT_PATTERN.test('USB Audio CODEC')).toBe(true);
  });

  it('the answer of 99 and its audit row: a registry id, a change code and two integers, no device text', () => {
    expect(Object.keys(CaptureAudioInputRegistrationSchema.shape)).toEqual(['deviceId', 'change', 'inputNumber', 'channelCount', 'releasedDeviceId']);
    // The audit list has four values (R-FLEX AU-A1, row 129): `RELEASED` is audit-only.
    expect(Object.values(CaptureAudioInputChange)).toEqual(['REGISTERED', 'CARD_CHANGED', 'REENABLED', 'RELEASED']);
    // The answer's `change` is an inline enum of exactly three values (R-FLEX row 99): the audit list may grow (AU-A1 `RELEASED`, row 129), the answer does not.
    expect(CaptureAudioInputRegistrationSchema.shape.change.options).toEqual(['REGISTERED', 'CARD_CHANGED', 'REENABLED']);
    const answer = { deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 2, channelCount: 4, releasedDeviceId: null };
    expect(CaptureAudioInputRegistrationSchema.safeParse({ ...answer, change: 'RELEASED' }).success).toBe(false);
    // R-FLEX AU-B2: `releasedDeviceId` is a registry id or null, and required.
    expect([CaptureAudioInputRegistrationSchema.safeParse({ ...answer, change: 'REENABLED', releasedDeviceId: 'MIC-03' }).success, CaptureAudioInputRegistrationSchema.safeParse({ ...answer, releasedDeviceId: undefined }).success, CaptureAudioInputRegistrationSchema.safeParse({ ...answer, releasedDeviceId: 'mic 3' }).success]).toEqual([true, false, false]);
    expect(CaptureAudioInputRegistrationSchema.safeParse(answer).success).toBe(true);
    expect(CaptureAudioInputRegistrationSchema.safeParse({ ...answer, change: 'DELETED' }).success).toBe(false);
    expect(CaptureAudioInputRegistrationSchema.safeParse({ ...answer, product: 'USB Audio CODEC' }).success).toBe(false);
    const facts = { deviceId: 'MIC-03', change: CaptureAudioInputChange.REENABLED, inputNumber: 2, channelCount: 4 };
    expect(captureAudioInputChangedDetails(facts)).toEqual({ ...facts, operationId: 'registerCaptureAudioInput' });
    expect(Object.keys(captureAudioInputChangedDetails({ ...facts, permission: 'CAPTURE_CONFIG' }))).toEqual(['deviceId', 'change', 'inputNumber', 'channelCount', 'operationId', 'permission']);
    expect(Object.keys(captureAudioInputChangedDetails({ ...facts, permission: null }))).toHaveLength(5);
  });

  it('the simulator\'s listing is fixed and says what it is: two test cards, no USB id, no registered input', () => {
    const cards = simCaptureAudioCards();
    expect(cards.map((card) => [card.cardId, card.deviceIndex, card.usbId, card.channelCount, card.registered.length, card.boundTo])).toEqual([
      [SIM_CAPTURE_AUDIO_CARD_IDS.four, 0, null, 4, 0, null],
      [SIM_CAPTURE_AUDIO_CARD_IDS.two, 0, null, 2, 0, null],
    ]);
    for (const card of cards) {
      expect(card.product).toMatch(/^DEMS test sound card [AB] \(simulated\)$/);
      expect(CaptureAudioCardSchema.safeParse(card).success).toBe(true);
    }
    // Each call builds a new list: a caller that changes its copy changes no other answer.
    expect(simCaptureAudioCards()).not.toBe(cards);
    expect(simCaptureAudioCards()).toEqual(cards);
  });
});

// Task 4 (blueprint row 194, WP-12; finding of rows 97 and 98; decisions U12 A7, C47 (29)): the
// contract of operation 100, the operator-confirmed re-address of a registered camera. The contract
// only: no Core route answers it yet (rows 196, 197).
describe('task 4 row 194: operation 100, the operator-confirmed re-address of a registered camera', () => {
  const operation = CAPTURE_READDRESS_OPERATIONS[0];
  const CONFIRMATION = { deviceId: 'CAM-01', candidateId: 'CND-4F2A91C0D377', address: '192.168.10.21' };

  it('number, id, method, path, tag, mode, access, conditions and audit; it is entry 100 of the table', () => {
    expect(CAPTURE_READDRESS_OPERATIONS).toHaveLength(1);
    expect([
      numberOf(operation.source),
      operation.operationId,
      operation.method,
      operation.path,
      operation.tag,
      operation.mode,
      describeCoreApiAccess(operation.access),
      [...operation.access.conditions],
      operation.audit.success,
      operation.audit.denial,
    ]).toEqual([100, 'confirmCaptureDeviceAddress', 'post', '/api/v1/capture/devices/address/confirm', 'Device', 'simulated', 'CAPTURE_CONFIG', ['WEB_CONSOLE_SESSION'], 'CAPTURE_DEVICE_ADDRESS_CHANGED', 'ACCESS_DENIED']);
    expect(CAPTURE_DEVICE_ADDRESS_CONFIRM_PATH).toBe(operation.path);
    // REVISED 2026-11-02 (principal): RB-9 as amended inserts createUser, updateUser and deleteUser
    // in area 2, so every table entry from `disableUser` on sits three places further.
    expect(CORE_API_OPERATIONS[102]?.operationId).toBe('confirmCaptureDeviceAddress');
    // The access of operation 96 (row 97's DD-2): the same object, not a look-alike.
    expect(operation.access).toEqual(CAPTURE_CREDENTIAL_ACCESS);
    expect(findCoreApiOperation('adoptCaptureCandidate')?.access).toEqual(operation.access);
    expect(Object.keys(CAPTURE_READDRESS_SCHEMAS)).toEqual(['CaptureDeviceAddressConfirmRequest', 'CaptureDeviceAddressConfirmation']);
    // The audit type exists since row 19: no vocabulary step was needed for this operation.
    expect(AUDIT_TYPE_CATEGORY[AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED]).toBe('DEVICE');
    expect(CAPTURE_READDRESS_AUDIT_REASON).toBe('OPERATOR_CONFIRMED');
    // TECHNICIAN and SUPERVISOR hold the permission; nobody else.
    expect(Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(Permission.CAPTURE_CONFIG))).toEqual(['TECHNICIAN']);
  });

  it('the documented statuses; the simulator never sends the success; 503 is envelope-level and named in the text', () => {
    const found = findCoreApiOperation('confirmCaptureDeviceAddress')!;
    expect(listCoreApiResponseStatuses(found)).toEqual([200, 400, 401, 403, 404, 409, 422]);
    expect(listCoreApiResponseStatuses(found, CoreApiScope.OFFLINE)).toEqual([400, 401, 403, 404, 409, 422]);
    expect([found.requestBody, found.query, found.pathParam]).toEqual([{ schema: 'CaptureDeviceAddressConfirmRequest', required: true }, undefined, undefined]);
    expect(found.description).toContain('`503 NOT_READY`');
    expect(found.description).toContain(CaptureDiscoveryReason.DISCOVERY_NOT_READY);
    expect(found.description).toContain('CAPTURE_CONFIG_LOCKED');
    expect(found.description).toContain(CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED);
    expect(found.description).toContain('never follows such a camera by itself');
    expect(found.description).toContain('changes no state');
    expect(validateCoreApiResponse('confirmCaptureDeviceAddress', 503, { error: { code: 'NOT_READY', message: 'Not ready.', details: { reason: 'DISCOVERY_NOT_READY' } } })).toEqual({ ok: true });
    // Every 409 reason is named in the text and in the 409 answer, has a sentence, and equals the server's code.
    const reasons = Object.values(CaptureReaddressReason);
    expect(reasons).toEqual([
      'READDRESS_NOT_THE_REGISTERED_CAMERA', 'READDRESS_IDENTITY_CONFLICT', 'READDRESS_CONFIRMATION_MISMATCH',
      'READDRESS_ADDRESS_UNCHANGED', 'READDRESS_ADDRESS_TAKEN', 'READDRESS_STORED_ADDRESS_UNREADABLE',
    ]);
    expect(Object.keys(CAPTURE_READDRESS_REFUSAL_SENTENCES)).toEqual(reasons);
    for (const reason of reasons) {
      expect(found.description, reason).toContain(reason);
      expect(found.responses[409]?.description, reason).toContain(reason);
      const sentence = CAPTURE_READDRESS_REFUSAL_SENTENCES[reason];
      expect(sentence.length, reason).toBeGreaterThan(10);
      // A sentence never quotes an address.
      expect(sentence, reason).not.toMatch(/\d+\.\d+/);
      expect(validateCoreApiResponse('confirmCaptureDeviceAddress', 409, { error: { code: 'INVALID_STATE', message: sentence, details: { reason } } })).toEqual({ ok: true });
    }
    expect(CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE).not.toMatch(/\d+\.\d+/);
  });

  it('the body: three members, all required, no other; an address outside the form of row 94 is refused', () => {
    const schema = CaptureDeviceAddressConfirmRequestSchema;
    expect(schema.safeParse(CONFIRMATION).success).toBe(true);
    expect(schema.safeParse({ ...CONFIRMATION, address: '192.168.10.21:8080' }).success).toBe(true);
    for (const missing of ['deviceId', 'candidateId', 'address'] as const) {
      const { [missing]: _dropped, ...rest } = CONFIRMATION;
      expect(schema.safeParse(rest).success, missing).toBe(false);
    }
    for (const extra of ['credential', 'username', 'secret', 'port', 'url', 'reason', 'host', 'force']) {
      expect(schema.safeParse({ ...CONFIRMATION, [extra]: 'x' }).success, extra).toBe(false);
    }
    // The host part is exactly the strict dotted quad of operation 93's typed address.
    const quads = ['192.168.10.21', '10.0.0.1', '172.16.5.4', '127.0.0.1', '8.8.8.8', '255.255.255.255', '0.0.0.0'];
    for (const address of quads) {
      expect(CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(address), address).toBe(true);
      expect(schema.safeParse({ ...CONFIRMATION, address }).success, address).toBe(true);
    }
    const outside = [
      '', ' ', 'camera-1.local', 'localhost', '192.168.10', '192.168.10.21.5', '192.168.10.256', '192.168.010.21', '0x7f.0.0.1', '2130706433',
      '192.168.10.21/24', ' 192.168.10.21', '192.168.10.21 ', 'fe80::1', '::ffff:192.168.10.21', '[::1]:80',
      'http://192.168.10.21', 'http://192.168.10.21/onvif/device_service', 'rtsp://192.168.10.21:554/stream1', 'admin:pass@192.168.10.21', '192.168.10.21/path',
    ];
    for (const address of outside) {
      // Whatever the typed-address form refuses, this body refuses too ...
      expect(CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(address), address).toBe(false);
      expect(schema.safeParse({ ...CONFIRMATION, address }).success, address).toBe(false);
    }
    // ... and the one addition is a port from 1 to 65535 without a leading zero.
    for (const port of ['1', '80', '554', '8080', '65535']) expect(schema.safeParse({ ...CONFIRMATION, address: `192.168.10.21:${port}` }).success, port).toBe(true);
    for (const port of ['', '0', '080', '65536', '99999', '8a', '-1', '80:80', '80/']) expect(schema.safeParse({ ...CONFIRMATION, address: `192.168.10.21:${port}` }).success, port).toBe(false);
    // The strict quad with the port stripped is the only thing the pattern adds to: nothing looser.
    for (const address of [...quads, '192.168.10.21:8080']) expect(CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(address.replace(/:\d+$/, '')), address).toBe(true);
    expect(CAPTURE_DEVICE_CONFIRMED_ADDRESS_MAX_LENGTH).toBe('255.255.255.255:65535'.length);
    expect(CAPTURE_DEVICE_CONFIRMED_ADDRESS_PATTERN.test('255.255.255.255:65535')).toBe(true);
    // The device is a camera of the registry, the candidate an id of a search: never a microphone, an address or a name.
    for (const deviceId of ['MIC-01', 'POE-SWITCH', 'CAM-1', 'cam-01', 'CAM-01 ', '192.168.10.21', '']) expect(schema.safeParse({ ...CONFIRMATION, deviceId }).success, deviceId).toBe(false);
    for (const deviceId of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-117']) expect(CAPTURE_CAMERA_DEVICE_ID_PATTERN.test(deviceId), deviceId).toBe(true);
    for (const candidateId of ['CAM-01', '192.168.10.21', 'CND-1', '']) expect(schema.safeParse({ ...CONFIRMATION, candidateId }).success, candidateId).toBe(false);
    expect(CAPTURE_CANDIDATE_ID_PATTERN.test(CONFIRMATION.candidateId)).toBe(true);
  });

  it('the examples parse, carry no credential, and the answer holds the confirmed address', () => {
    const examples = CAPTURE_READDRESS_EXAMPLES.confirmCaptureDeviceAddress!;
    expect(CORE_API_EXAMPLES.confirmCaptureDeviceAddress).toBe(examples);
    for (const example of Object.values(examples.request ?? {})) expect(CaptureDeviceAddressConfirmRequestSchema.safeParse(example.value).success).toBe(true);
    const answers = Object.values(examples.responses[200] ?? {});
    expect(answers).toHaveLength(1);
    for (const example of answers) {
      const parsed = CaptureDeviceAddressConfirmationSchema.safeParse(example.value);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect([parsed.data.deviceId, parsed.data.device.id, parsed.data.device.kind]).toEqual(['CAM-01', 'CAM-01', 'CAMERA']);
    }
    expect(Object.keys(examples.responses).map(Number)).toEqual([200, 400, 401, 403, 404, 409, 422]);
    expect(Object.keys(examples.responses[409] ?? {})).toHaveLength(1 + Object.values(CaptureReaddressReason).length);
    expect(JSON.stringify(examples)).not.toMatch(/"(username|secret|password|credential)"/);
  });
});

describe('task 4 row V3: operation 108, the connection test of a registered camera with its stored credential (row 146; C58)', () => {
  const found = findCoreApiOperation('testCaptureDeviceConnection')!;

  it('number, id, method, path, tag, mode, access, conditions and audit: the access of operation 95, and BOTH audit rows of a test', () => {
    const operation = CAPTURE_DEVICE_TEST_OPERATIONS[0];
    expect(CAPTURE_DEVICE_TEST_OPERATIONS).toHaveLength(1);
    expect([
      numberOf(operation.source),
      operation.operationId,
      operation.method,
      operation.path,
      operation.tag,
      operation.mode,
      describeCoreApiAccess(operation.access),
      [...operation.access.conditions],
      operation.audit.success,
      operation.audit.denial,
    ]).toEqual([108, 'testCaptureDeviceConnection', 'post', '/api/v1/capture/devices/{id}/test', 'Device', 'simulated', 'CAPTURE_CONFIG', ['WEB_CONSOLE_SESSION'], 'CAPTURE_DEVICE_CONNECTION_TESTED', 'ACCESS_DENIED']);
    expect(CAPTURE_DEVICE_TEST_PATH).toBe(operation.path);
    // REVISED 2026-11-02 (principal): RB-9 as amended inserts createUser, updateUser and deleteUser
    // in area 2, so every table entry from `disableUser` on sits three places further.
    expect(CORE_API_OPERATIONS[110]?.operationId).toBe('testCaptureDeviceConnection');
    // It was the last entry until blueprint row 116 appended operations 109 and 110 after it (and row RD2 operation 111).
    expect(CORE_API_OPERATIONS.at(-9)?.operationId).toBe('testCaptureDeviceConnection'); // task 4 row D53: + operations 112-113 after it; the LCD bridge task: + operation 114 after them; RB-9 as amended and D57 append five more behind it (the three users ops ride area 2, so the tail holds 114, 112, 113, 118, 119).
    // The permission as the candidate test has it: the same access object as operation 95.
    expect(operation.access).toEqual(CAPTURE_CREDENTIAL_ACCESS);
    expect(findCoreApiOperation('testCaptureCandidateConnection')?.access).toEqual(operation.access);
    // The reveal of the stored credential is the reader's own row; the outcome is the operation's.
    expect(found.audit.also).toEqual(['CAPTURE_CREDENTIAL_REVEALED']);
    expect([AUDIT_TYPE_CATEGORY[AuditType.CAPTURE_DEVICE_CONNECTION_TESTED], AUDIT_TYPE_CATEGORY[AuditType.CAPTURE_CONNECTION_TESTED]]).toEqual(['SECURITY', 'SECURITY']);
    expect(Object.keys(CAPTURE_DEVICE_TEST_SCHEMAS)).toEqual(['CaptureDeviceConnectionTest']);
  });

  it('NO BODY and no query: nothing can carry a credential, an address or a profile; it is not a credential-carrying operation', () => {
    expect([found.requestBody, found.query]).toEqual([undefined, undefined]);
    expect(found.pathParam?.name).toBe('id');
    expect((CREDENTIAL_CARRYING_OPERATIONS as readonly string[]).includes('testCaptureDeviceConnection')).toBe(false);
    expect(CAPTURE_DEVICE_TEST_EXAMPLES.testCaptureDeviceConnection?.request).toBeUndefined();
    const document = createOpenApiDocument({ scope: 'all' });
    const documented = document.paths['/api/v1/capture/devices/{id}/test']?.post as { requestBody?: unknown; parameters?: { name: string; in: string }[] } | undefined;
    expect(documented).toBeDefined();
    expect(documented?.requestBody).toBeUndefined();
    expect((documented?.parameters ?? []).map((parameter) => `${parameter.in} ${parameter.name}`)).toEqual(['path id']);
  });

  it('the documented statuses; 429 and 503 are envelope-level and named in the text, the lock-out guard as the ONE guard of operation 95', () => {
    expect(listCoreApiResponseStatuses(found)).toEqual([200, 401, 403, 404, 409, 422]);
    // Row V4 (decision C75 (2)): the in-app simulator answers what a Core in simulated capture answers - the
    // envelope's `503 DISCOVERY_NOT_READY` - so the outcome (200) and "no such camera" (404) are the Core server's alone.
    expect(listCoreApiResponseStatuses(found, CoreApiScope.OFFLINE)).toEqual([401, 403, 409]);
    expect([found.responses[200]?.services, found.responses[404]?.services]).toEqual([['dems-core-server'], ['dems-core-server']]);
    expect(CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE).toBe('The connection test of a registered camera is not ready.');
    expect(validateCoreApiResponse('testCaptureDeviceConnection', 503, { error: { code: 'NOT_READY', message: CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE, details: { reason: 'DISCOVERY_NOT_READY' } } })).toEqual({ ok: true });
    for (const said of [
      // Row V4: what a simulated Core and the simulator answer, and what is audited when the reader was reached and no camera asked.
      'a Core whose capture is simulated, or that runs with development sources, always answers this', 'never a synthetic `REACHABLE`',
      '**Refusals after the reader of the stored credential was called.**', '`unreachableReason: CREDENTIAL_NOT_READ`', '`unreachableReason: NOT_SENT`',
      '`429 RATE_LIMITED`', '`retry-after`', CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED, CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD,
      'The lock-out guard is the one of operation 95', 'a typed and a stored one together',
      '`503 NOT_READY`', CaptureDiscoveryReason.DISCOVERY_NOT_READY, CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY,
      'CAPTURE_CONFIG_LOCKED', 'WEB_CONSOLE_ONLY', '**No body.**', 'destination rule', 'CAPTURE_CREDENTIAL_REVEALED', 'CAPTURE_DEVICE_CONNECTION_TESTED',
      'synthetic', 'changes no state',
    ]) {
      expect(found.description, said).toContain(said);
    }
    expect(validateCoreApiResponse('testCaptureDeviceConnection', 429, { error: { code: 'RATE_LIMITED', message: 'Too many connection tests. Try again later.', details: { reason: 'CONNECTION_TEST_LOCKOUT_GUARD' } } })).toEqual({ ok: true });
    expect(validateCoreApiResponse('testCaptureDeviceConnection', 503, { error: { code: 'NOT_READY', message: 'Not ready.', details: { reason: 'CREDENTIAL_STORE_NOT_READY' } } })).toEqual({ ok: true });
    // Every 409 reason is named in the text and in the 409 answer, has the server's sentence, and parses.
    const reasons = Object.keys(CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES) as (keyof typeof CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES)[];
    expect(reasons).toEqual(['CANDIDATE_NOT_TESTABLE', 'CREDENTIAL_REQUIRED', 'CONNECTION_TEST_IN_PROGRESS']);
    for (const reason of reasons) {
      expect(found.description, reason).toContain(reason);
      expect(found.responses[409]?.description, reason).toContain(reason);
      const sentence = CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES[reason];
      // A sentence never quotes an address or a device id.
      expect(sentence, reason).not.toMatch(/\d+\.\d+|CAM-/);
      expect(validateCoreApiResponse('testCaptureDeviceConnection', 409, { error: { code: 'INVALID_STATE', message: sentence, details: { reason } } })).toEqual({ ok: true });
    }
  });

  it('the answer: the members of operation 95 with the device in the place of the candidate; `authenticated` is always true; nothing else fits', () => {
    const schema = CaptureDeviceConnectionTestSchema;
    // Rows PR, V7 (decision C117): + `profiles`, the closed word of what the test found about the camera's STORED profiles.
    expect(Object.keys(schema.shape)).toEqual(['deviceId', 'outcome', 'authenticated', 'testedAt', 'usableProfileCount', 'failedAttemptsRemaining', 'reason', 'profiles']);
    const answer = { deviceId: 'CAM-01', outcome: 'REACHABLE', authenticated: true, testedAt: 1_790_000_000_000, usableProfileCount: 1, failedAttemptsRemaining: 2 };
    expect(schema.safeParse(answer).success).toBe(true);
    expect(Object.values(CaptureDeviceTestProfiles)).toEqual(['PROFILES_STORED', 'STREAM_PROFILE_DIFFERS']);
    for (const profiles of Object.values(CaptureDeviceTestProfiles)) expect(schema.safeParse({ ...answer, profiles }).success, profiles).toBe(true);
    // A closed word: no agreement word, no code of a stream, no count, no list.
    for (const profiles of ['PROFILES_AGREE', 'PROFILES_NOT_STORED', 'HEVC_1080P', 2, ['HEVC_1080P'], null]) expect(schema.safeParse({ ...answer, profiles }).success, String(profiles)).toBe(false);
    for (const outcome of Object.values(CaptureConnectionOutcome)) expect(schema.safeParse({ ...answer, outcome }).success, outcome).toBe(true);
    expect(schema.safeParse({ ...answer, outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' }).success).toBe(true);
    // What the server's function answers (`AdoptedCameraTest` of adopted-test.ts) is exactly this shape.
    expect(schema.safeParse({ ...answer, outcome: 'AUTHENTICATION_FAILED', usableProfileCount: 0, failedAttemptsRemaining: 0 }).success).toBe(true);
    expect(schema.safeParse({ ...answer, authenticated: false }).success).toBe(false);
    for (const deviceId of ['MIC-01', 'POE-SWITCH', 'CND-000000000001', '192.168.10.21', 'cam-01', '']) expect(schema.safeParse({ ...answer, deviceId }).success, deviceId).toBe(false);
    for (const extra of ['credential', 'username', 'secret', 'password', 'host', 'address', 'url', 'endpointRef', 'candidateId', 'error', 'model', 'profiles']) {
      expect(schema.safeParse({ ...answer, [extra]: 'x' }).success, extra).toBe(false);
    }
    for (const [member, value] of [['outcome', 'OK'], ['reason', 'WRONG_PASSWORD'], ['usableProfileCount', -1], ['failedAttemptsRemaining', 1.5], ['testedAt', '2026-10-13']] as const) {
      expect(schema.safeParse({ ...answer, [member]: value }).success, member).toBe(false);
    }
  });

  it('the audit details of the outcome: a registry id, closed codes and a flag - no key for a credential, an address or announced text', () => {
    const facts = { deviceId: 'CAM-01', outcome: CaptureConnectionOutcome.REACHABLE, adapter: 'ONVIF_RTSP', sourceClass: CaptureSourceClass.PRODUCTION };
    expect(captureDeviceConnectionTestedDetails(facts)).toEqual({ deviceId: 'CAM-01', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection' });
    expect(
      captureDeviceConnectionTestedDetails({ ...facts, outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, guardTripped: true, reason: 'SCHEME_NOT_ALLOWED', permission: 'CAPTURE_CONFIG' }),
    ).toEqual({ deviceId: 'CAM-01', outcome: 'AUTHENTICATION_FAILED', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', guardTripped: true, reason: 'SCHEME_NOT_ALLOWED', permission: 'CAPTURE_CONFIG' });
    // A flag that is false, a null reason and a null permission are left out: the row holds what happened.
    expect(Object.keys(captureDeviceConnectionTestedDetails({ ...facts, guardTripped: false, reason: null, permission: null }))).toEqual(['deviceId', 'outcome', 'adapter', 'sourceClass', 'operationId']);
    // Whatever else a caller hands in is not copied: the function names its keys one by one.
    const stray = { ...facts, host: '192.168.10.21', endpointRef: 'urn:uuid:0', username: 'USERNAME', secret: 'SECRET', model: 'x' } as unknown as Parameters<typeof captureDeviceConnectionTestedDetails>[0];
    expect(JSON.stringify(captureDeviceConnectionTestedDetails(stray))).not.toMatch(/192\.168|urn:uuid|USERNAME|SECRET|"model"/);
  });

  it('row V4 (C75 (1)): the outcome row can say that NO camera was asked - UNREACHABLE with a closed reason - and states the count of usable profiles when one was', () => {
    expect(Object.values(CaptureDeviceTestUnreachableReason)).toEqual(['CREDENTIAL_NOT_READ', 'NOT_SENT']);
    expect(CAPTURE_DEVICE_TEST_AUDIT_PROFILES_MAX).toBe(16);
    const facts = { deviceId: 'CAM-01', adapter: 'ONVIF_RTSP', sourceClass: CaptureSourceClass.PRODUCTION };
    const row = { deviceId: 'CAM-01', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection' };
    // The reader was reached and nothing was sent: UNREACHABLE and why. No count - no camera was asked.
    for (const unreachableReason of Object.values(CaptureDeviceTestUnreachableReason)) {
      expect(captureDeviceConnectionTestedDetails({ ...facts, outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason, usableProfileCount: 0 })).toEqual({ ...row, outcome: 'UNREACHABLE', unreachableReason });
    }
    // A camera that was asked and did not answer: a plain UNREACHABLE, with its count.
    expect(captureDeviceConnectionTestedDetails({ ...facts, outcome: CaptureConnectionOutcome.UNREACHABLE, usableProfileCount: 0 })).toEqual({ ...row, outcome: 'UNREACHABLE', usableProfileCount: 0 });
    // The reason belongs to UNREACHABLE alone: for any other outcome it is dropped, the count stays.
    for (const outcome of Object.values(CaptureConnectionOutcome).filter((value) => value !== CaptureConnectionOutcome.UNREACHABLE)) {
      expect(captureDeviceConnectionTestedDetails({ ...facts, outcome, unreachableReason: 'NOT_SENT', usableProfileCount: 2 }), outcome).toEqual({ ...row, outcome, usableProfileCount: 2 });
    }
    // A count outside 0..16, a fraction and null are left out, never cut to fit.
    for (const usableProfileCount of [-1, 17, 1.5, Number.NaN, null]) {
      expect(Object.keys(captureDeviceConnectionTestedDetails({ ...facts, outcome: CaptureConnectionOutcome.REACHABLE, usableProfileCount })), String(usableProfileCount)).toEqual(['deviceId', 'outcome', 'adapter', 'sourceClass', 'operationId']);
    }
    // The reason is AUDIT ONLY: the answer of the operation has no such member, and its own `reason` keeps its one code.
    expect(Object.keys(CaptureDeviceConnectionTestSchema.shape)).not.toContain('unreachableReason');
    expect(Object.values(CaptureConnectionTestReason)).toEqual(['SCHEME_NOT_ALLOWED']);
  });

  it('the examples parse, carry no credential and no address, and name both kinds of result', () => {
    const examples = CAPTURE_DEVICE_TEST_EXAMPLES.testCaptureDeviceConnection!;
    expect(CORE_API_EXAMPLES.testCaptureDeviceConnection).toBe(examples);
    expect(examples.pathParams).toEqual({ id: 'CAM-01' });
    const answers = Object.values(examples.responses[200] ?? {});
    expect(answers.map((example) => (example.value as { outcome: string }).outcome)).toEqual(['REACHABLE', 'AUTHENTICATION_FAILED']);
    for (const example of answers) expect(CaptureDeviceConnectionTestSchema.safeParse(example.value).success).toBe(true);
    expect(Object.keys(examples.responses).map(Number)).toEqual([200, 401, 403, 404, 409, 422]);
    expect(Object.keys(examples.responses[409] ?? {})).toHaveLength(1 + Object.keys(CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES).length);
    expect(JSON.stringify(examples)).not.toMatch(/"(username|secret|password|credential|host|address)"|\d+\.\d+\.\d+\.\d+/);
  });
});
