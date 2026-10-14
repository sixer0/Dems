// Task 4 (blueprint row 102, WP-23b; design F-4.2 DR-1 to DR-12; decisions U6, U7, U9, U10, C1, C7,
// C19; security findings S13-08, S13-11): the contract package of the commissioning functions of the
// camera network, operations 101 to 107. THE CONTRACT ONLY: no Core route, no job and no screen
// exists yet. What is held here: who may call, the forms of every address member (no looser than
// the Core's destination rule), each refusal with its sentence, the request line and the limits of
// the alias helper as contract facts (compared with the delivered helper file), the list of
// credential-carrying operations, and the simulator's answers - synthetic, and changing nothing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_FACTORY_SCAN_MAX_DEVICES,
  CAMERA_NETWORK_JOB_ID_PATTERN,
  CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS,
  CAMERA_NETWORK_SET_POLL_MS,
  CAMERA_NETWORK_SET_WAIT_MS,
  CAPTURE_CAMERA_SUBNET_PATTERN,
  CAPTURE_COMMISSION_ACCESS,
  CAPTURE_COMMISSIONING_EXAMPLES,
  CAPTURE_COMMISSIONING_OPERATIONS,
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CAPTURE_COMMISSIONING_SCHEMAS,
  CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN,
  CAPTURE_INTERFACE_NAME_PATTERN,
  CAPTURE_MAC_ADDRESS_PATTERN,
  CAPTURE_NETWORK_CONFIG_DEFAULTS,
  CAPTURE_NETWORK_CONFIG_FIELDS,
  CAPTURE_NETWORK_CONFIG_LIMITS,
  CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CREDENTIAL_CARRYING_OPERATIONS,
  CameraFactoryScanRequestSchema,
  CameraFactoryScanSchema,
  CameraNetworkJobFailure,
  CameraNetworkJobSchema,
  CameraNetworkJobState,
  CameraNetworkJobStep,
  CameraNetworkSetRequestSchema,
  CaptureCommissioningReason,
  CaptureNetworkConfigSchema,
  CaptureNetworkConfigUpdateRequestSchema,
  CoreApiScope,
  CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS,
  CAMERA_NETWORK_SCAN_MAX_AGE_MS,
  FactoryCameraDeviceCount,
  FactoryCameraSchema,
  HOST_ALIAS_HELPER,
  HostAliasLineError,
  HostAliasReason,
  HostAliasStateSchema,
  SIM_CAPTURE_INTERFACE_NAME,
  SIM_FACTORY_CAMERA_MAC,
  SIM_FACTORY_CAMERA_NAME,
  WEB_CONSOLE_ONLY_REASON,
  createOpenApiDocument,
  describeCoreApiAccess,
  findCoreApiOperation,
  hostAliasAddLine,
  hostAliasDelLine,
  listCoreApiResponseStatuses,
  simCameraFactoryScan,
  simCaptureNetworkConfig,
  validateCoreApiResponse,
} from '../src/api';
import { AUDIT_TYPE_CATEGORY, AuditType, DEMO_OPERATOR_PASSWORD, OperatorRole, Permission, ROLE_PERMISSIONS, createManualClock, createSim } from '../src/sim';

const numberOf = (source: string): number => Number(/operation (\d+)/.exec(source)?.[1]);
const IDS = ['getCaptureNetworkConfig', 'updateCaptureNetworkConfig', 'scanFactoryCameras', 'getHostAlias', 'removeHostAlias', 'setCameraNetwork', 'getCameraNetworkJob'] as const;

describe('the registry: operations 101 to 107', () => {
  it('number, id, method, path, tag, mode, access, conditions and audit; they are entries 101 to 107 of the table', () => {
    const rows = CAPTURE_COMMISSIONING_OPERATIONS.map((operation) => [
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
      [101, 'getCaptureNetworkConfig', 'get', '/api/v1/capture/network/config', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'NONE-R', 'ACCESS_DENIED'],
      [102, 'updateCaptureNetworkConfig', 'post', '/api/v1/capture/network/config', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'CAPTURE_NETWORK_CONFIG_CHANGED', 'ACCESS_DENIED'],
      [103, 'scanFactoryCameras', 'post', '/api/v1/capture/network/scan', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'CAMERA_FACTORY_SCANNED', 'ACCESS_DENIED'],
      [104, 'getHostAlias', 'get', '/api/v1/capture/network/alias', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'NONE-R', 'ACCESS_DENIED'],
      [105, 'removeHostAlias', 'post', '/api/v1/capture/network/alias/remove', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'HOST_ALIAS_REMOVED', 'ACCESS_DENIED'],
      [106, 'setCameraNetwork', 'post', '/api/v1/capture/network/cameras/address', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'CAMERA_NETWORK_SET', 'ACCESS_DENIED'],
      [107, 'getCameraNetworkJob', 'get', '/api/v1/capture/network/jobs/{id}', 'Device', 'simulated', 'CAPTURE_COMMISSION', ['WEB_CONSOLE_SESSION'], 'NONE-R', 'ACCESS_DENIED'],
    ]);
    expect(CORE_API_OPERATIONS.slice(100, 107).map((operation) => operation.operationId)).toEqual([...IDS]);
    expect(Object.keys(CAPTURE_COMMISSIONING_SCHEMAS)).toEqual([
      'CaptureNetworkConfig', 'CaptureNetworkConfigUpdateRequest', 'HostAlias', 'HostAliasState', 'CameraFactoryScanRequest', 'FactoryCamera', 'CameraFactoryScan',
      'CameraNetworkSetRequest', 'CameraNetworkJob',
    ]);
    for (const name of Object.keys(CAPTURE_COMMISSIONING_SCHEMAS)) expect(CORE_API_SCHEMAS).toHaveProperty(name);
    // The audit types exist since row 19: no vocabulary step was needed for these operations.
    expect(findCoreApiOperation('scanFactoryCameras')?.audit.also).toEqual(['HOST_ALIAS_ADDED', 'HOST_ALIAS_REMOVED']);
    expect(findCoreApiOperation('removeHostAlias')?.audit.also).toEqual(['HOST_ALIAS_REMOVE_FAILED']);
    expect(findCoreApiOperation('setCameraNetwork')?.audit.also).toEqual(['HOST_ALIAS_ADDED', 'HOST_ALIAS_REMOVED', 'CAPTURE_DEVICE_ADDRESS_CHANGED']);
    for (const type of [AuditType.CAPTURE_NETWORK_CONFIG_CHANGED, AuditType.CAMERA_FACTORY_SCANNED, AuditType.CAMERA_NETWORK_SET]) expect(AUDIT_TYPE_CATEGORY[type]).toBe('DEVICE');
    for (const type of [AuditType.HOST_ALIAS_ADDED, AuditType.HOST_ALIAS_REMOVED, AuditType.HOST_ALIAS_REMOVE_FAILED]) expect(AUDIT_TYPE_CATEGORY[type]).toBe('SECURITY');
  });

  it('who may call: CAPTURE_COMMISSION, held by TECHNICIAN only (U10), on a web console session only; no other operation names the permission', () => {
    expect(CAPTURE_COMMISSION_ACCESS).toEqual({ kind: 'PERMISSION', permission: 'CAPTURE_COMMISSION', conditions: ['WEB_CONSOLE_SESSION'] });
    for (const operation of CAPTURE_COMMISSIONING_OPERATIONS) expect(operation.access, operation.operationId).toEqual(CAPTURE_COMMISSION_ACCESS);
    const holders = Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(Permission.CAPTURE_COMMISSION));
    expect(holders).toEqual(['TECHNICIAN']);
    // The deferral of row 100 ends here: the permission is enforced at these seven and at no other
    // - until blueprint row 116 (WP-26b) added the acceptance of the installation and its
    // revocation, operations 109 and 110, which take the same permission (7 -> 9).
    const naming = CORE_API_OPERATIONS.filter((operation) => describeCoreApiAccess(operation.access) === 'CAPTURE_COMMISSION').map((operation) => operation.operationId);
    expect(naming).toEqual([...IDS, 'acceptInstallation', 'revokeInstallationAcceptance']);
    for (const operation of CAPTURE_COMMISSIONING_OPERATIONS) {
      expect(operation.responses[403]?.description, operation.operationId).toContain(WEB_CONSOLE_ONLY_REASON);
      expect(operation.responses[403]?.description, operation.operationId).toContain('ACCESS_DENIED');
      expect(operation.description, operation.operationId).toContain('TECHNICIAN only, web console only');
      const examples = CORE_API_EXAMPLES[operation.operationId]?.responses[403] as Record<string, { value: { error: { details?: Record<string, string> } } }> | undefined;
      expect(examples?.webConsoleOnly?.value.error.details).toMatchObject({ permission: 'CAPTURE_COMMISSION', role: 'TECHNICIAN', reason: 'WEB_CONSOLE_ONLY' });
      // A SUPERVISOR is the role of the refusal example: it holds CAPTURE_CONFIG and not this permission.
      expect(examples?.notPermitted?.value.error.details).toMatchObject({ permission: 'CAPTURE_COMMISSION', role: 'SUPERVISOR' });
    }
  });

  it('the documented statuses; what the in-app simulator can answer; the four successes only the Core server sends', () => {
    const all = Object.fromEntries(IDS.map((id) => [id, listCoreApiResponseStatuses(findCoreApiOperation(id)!)]));
    const offline = Object.fromEntries(IDS.map((id) => [id, listCoreApiResponseStatuses(findCoreApiOperation(id)!, CoreApiScope.OFFLINE)]));
    expect(all).toEqual({
      getCaptureNetworkConfig: [200, 401, 403],
      updateCaptureNetworkConfig: [200, 400, 401, 403, 409, 422],
      scanFactoryCameras: [200, 400, 401, 403, 409, 422],
      getHostAlias: [200, 401, 403],
      removeHostAlias: [200, 401, 403, 409],
      setCameraNetwork: [202, 400, 401, 403, 409, 422],
      getCameraNetworkJob: [200, 401, 403, 404, 422],
    });
    expect(offline).toEqual({
      getCaptureNetworkConfig: [200, 401, 403],
      updateCaptureNetworkConfig: [400, 401, 403, 409, 422],
      scanFactoryCameras: [200, 400, 401, 403, 409, 422],
      getHostAlias: [200, 401, 403],
      removeHostAlias: [401, 403, 409],
      setCameraNetwork: [400, 401, 403, 409, 422],
      getCameraNetworkJob: [401, 403, 404],
    });
    // Bodies and parameters: three bodies (one optional), one path parameter, no query anywhere.
    expect(IDS.map((id) => [findCoreApiOperation(id)!.requestBody, findCoreApiOperation(id)!.pathParam?.name, findCoreApiOperation(id)!.query])).toEqual([
      [undefined, undefined, undefined],
      [{ schema: 'CaptureNetworkConfigUpdateRequest', required: true }, undefined, undefined],
      [{ schema: 'CameraFactoryScanRequest', required: false }, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [{ schema: 'CameraNetworkSetRequest', required: true }, undefined, undefined],
      [undefined, 'id', undefined],
    ]);
    // Idle only for the four writes; the three reads say they can be read while a session is open.
    for (const id of ['updateCaptureNetworkConfig', 'scanFactoryCameras', 'removeHostAlias', 'setCameraNetwork']) expect(findCoreApiOperation(id)!.description, id).toContain('CAPTURE_CONFIG_LOCKED');
    for (const id of ['getCaptureNetworkConfig', 'getHostAlias', 'getCameraNetworkJob']) expect(findCoreApiOperation(id)!.description, id).toContain('while a session is open');
    // Every operation states its simulator answer, and that answer says it changes nothing.
    for (const operation of CAPTURE_COMMISSIONING_OPERATIONS) expect(operation.description, operation.operationId).toMatch(/The simulator (holds no host|stores nothing|scans nothing|never holds|changes no camera|starts no job)/);
    expect(validateCoreApiResponse('scanFactoryCameras', 429, { error: { code: 'RATE_LIMITED', message: 'Too many scans.', details: { reason: 'COMMISSIONING_SCAN_RATE_LIMITED' } } })).toEqual({ ok: true });
    expect(validateCoreApiResponse('setCameraNetwork', 429, { error: { code: 'RATE_LIMITED', message: 'Too many attempts.', details: { reason: 'CONNECTION_TEST_LOCKOUT_GUARD' } } })).toEqual({ ok: true });
  });
});

describe('the forms: no looser than the Core\'s destination rule', () => {
  const PRIVATE_HOSTS = ['192.168.1.64', '192.168.0.90', '10.0.0.1', '10.255.255.254', '172.16.0.1', '172.31.255.254', '192.168.10.101', '192.168.255.254'];
  const NOT_AN_ADDRESS_OF_THE_FORM = [
    // point 1 of the rule: never a name, a leading zero, a hexadecimal or octal part, a bare integer, IPv6, a port or a prefix glued on
    '', ' ', 'camera-1.local', 'localhost', '192.168.1', '192.168.1.64.5', '192.168.1.256', '192.168.01.64', '0xC0.0xA8.1.64', '3232235840', 'fe80::1', '::ffff:192.168.1.64',
    '192.168.1.64:80', '192.168.1.64/24', ' 192.168.1.64', '192.168.1.64 ', 'http://192.168.1.64', 'admin:pass@192.168.1.64',
    // never loopback, the unspecified address, link-local, multicast, broadcast or a public address
    '127.0.0.1', '0.0.0.0', '169.254.1.1', '224.0.0.1', '255.255.255.255', '8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '192.167.1.1', '192.169.1.1', '11.0.0.1',
    // never the first or the last address of its /24
    '192.168.1.0', '192.168.1.255', '10.0.0.0', '10.0.0.255', '172.16.5.0', '172.16.5.255',
  ];

  it('a camera address is one strict dotted quad inside a private range, host part 1 to 254 - a subset of the typed address of operation 93', () => {
    for (const address of PRIVATE_HOSTS) {
      expect(CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(address), address).toBe(true);
      expect(CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(address), address).toBe(true);
    }
    for (const address of NOT_AN_ADDRESS_OF_THE_FORM) expect(CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(address), JSON.stringify(address)).toBe(false);
    for (const address of CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses) expect(CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(address), address).toBe(true);
  });

  it('every address member of every request and answer is held to that form', () => {
    const SET = { fromAddress: '192.168.1.64', scannedMac: 'AA:BB:CC:00:11:22', credential: { username: 'USERNAME', secret: 'SECRET' } };
    const UPDATE = { revision: 1 };
    for (const address of NOT_AN_ADDRESS_OF_THE_FORM) {
      const label = JSON.stringify(address);
      expect(CameraFactoryScanRequestSchema.safeParse({ address }).success, label).toBe(false);
      expect(CameraNetworkSetRequestSchema.safeParse({ ...SET, fromAddress: address }).success, label).toBe(false);
      expect(CameraNetworkSetRequestSchema.safeParse({ ...SET, toAddress: address }).success, label).toBe(false);
      expect(CameraNetworkSetRequestSchema.safeParse({ ...SET, gateway: address }).success, label).toBe(false);
      expect(CaptureNetworkConfigUpdateRequestSchema.safeParse({ ...UPDATE, factoryAddresses: ['192.168.1.64', address] }).success, label).toBe(false);
    }
    for (const address of PRIVATE_HOSTS) {
      expect(CameraFactoryScanRequestSchema.safeParse({ address }).success, address).toBe(true);
      expect(CameraNetworkSetRequestSchema.safeParse({ ...SET, fromAddress: address, toAddress: address, gateway: address }).success, address).toBe(true);
    }
    // The open JSON document carries the pattern on each of them: a client validates the same form.
    const schemas = createOpenApiDocument({ scope: 'all' }).components.schemas as Record<string, { properties?: Record<string, { pattern?: string; items?: { pattern?: string } }> }>;
    const source = CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.source;
    expect(schemas['CameraFactoryScanRequest']?.properties?.['address']?.pattern).toBe(source);
    for (const member of ['fromAddress', 'toAddress', 'gateway']) expect(schemas['CameraNetworkSetRequest']?.properties?.[member]?.pattern, member).toBe(source);
    expect(schemas['CaptureNetworkConfigUpdateRequest']?.properties?.['factoryAddresses']?.items?.pattern).toBe(source);
  });

  it('the camera subnet, the interface name, the three numbers and the list bound', () => {
    for (const subnet of ['192.168.10.0/24', '10.20.0.0/16', '172.16.4.0/22', '192.168.100.64/30']) expect(CAPTURE_CAMERA_SUBNET_PATTERN.test(subnet), subnet).toBe(true);
    for (const subnet of ['192.168.10.0', '192.168.10.0/15', '192.168.10.0/31', '192.168.10.0/32', '192.168.10.0/8', '8.8.8.0/24', '127.0.0.0/24', '192.168.010.0/24', '192.168.10.0/024', 'fe80::/64', '192.168.10.0/24 ', 'lan/24', '']) {
      expect(CAPTURE_CAMERA_SUBNET_PATTERN.test(subnet), JSON.stringify(subnet)).toBe(false);
    }
    // Row V7b (F-4, C114): the widened form of schema version 14 - letters of either case, as the alias helper's own rule.
    for (const name of ['enp3s0', 'eth1', 'br-cam', 'eno1.20', 'a', 'x'.repeat(15), 'Eth1', 'en0_CAM', 'A', 'Z9.x-y_']) expect(CAPTURE_INTERFACE_NAME_PATTERN.test(name), name).toBe(true);
    for (const name of ['', '-eth', '_eth', '.eth', 'eth 1', 'eth1;reboot', '../eth1', 'x'.repeat(16), 'X'.repeat(16), 'eth1\n', 'eth/1', 'eth:1', 'éth1']) expect(CAPTURE_INTERFACE_NAME_PATTERN.test(name), JSON.stringify(name)).toBe(false);
    expect(CAPTURE_INTERFACE_NAME_PATTERN.source).toBe('^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$');
    expect(CAPTURE_NETWORK_CONFIG_LIMITS).toEqual({ factoryAddressesMax: 32, aliasHostMin: 2, aliasHostMax: 254, aliasMinutesMin: 5, aliasMinutesMax: 480, cameraIpStartMin: 2, cameraIpStartMax: 250, onvifPortsMin: 1, onvifPortsMax: 8, onvifPortMin: 1, onvifPortMax: 65535 });
    expect(CAPTURE_NETWORK_CONFIG_DEFAULTS).toEqual({ factoryAddresses: ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'], aliasHost: 253, aliasMinutes: 30, cameraIpStart: 101, onvifPorts: [80] });
    expect([...CAPTURE_NETWORK_CONFIG_FIELDS]).toEqual(['interfaceName', 'cameraSubnet', 'factoryAddresses', 'aliasHost', 'aliasMinutes', 'cameraIpStart', 'onvifPorts']);
    const update = (change: Record<string, unknown>) => CaptureNetworkConfigUpdateRequestSchema.safeParse({ revision: 1, ...change }).success;
    expect(update({})).toBe(true);
    expect(update({ interfaceName: 'enp3s0', cameraSubnet: '192.168.10.0/24' })).toBe(true);
    expect(update({ interfaceName: null, cameraSubnet: null })).toBe(true);
    expect(update({ factoryAddresses: Array.from({ length: 32 }, (_unused, index) => `192.168.1.${String(index + 1)}`) })).toBe(true);
    expect(update({ factoryAddresses: Array.from({ length: 33 }, (_unused, index) => `192.168.1.${String(index + 1)}`) })).toBe(false);
    for (const [member, bad] of [['aliasHost', 1], ['aliasHost', 255], ['aliasMinutes', 4], ['aliasMinutes', 481], ['cameraIpStart', 1], ['cameraIpStart', 251], ['aliasMinutes', 30.5], ['aliasHost', '253']] as const) {
      expect(update({ [member]: bad }), `${member}=${String(bad)}`).toBe(false);
    }
    expect(CaptureNetworkConfigUpdateRequestSchema.safeParse({ aliasMinutes: 60 }).success).toBe(false);
    // No member a caller could steer the host with: no port, gateway, prefix, DHCP mode, credential or path.
    for (const extra of ['port', 'ports', 'gateway', 'prefixLength', 'dhcp', 'mode', 'credential', 'socketPath', 'helper', 'interfaceFile']) expect(update({ [extra]: 'x' }), extra).toBe(false);
    for (const extra of ['port', 'prefixLength', 'dhcp', 'mode', 'interfaceName', 'deviceId', 'username', 'secret', 'password']) {
      expect(CameraNetworkSetRequestSchema.safeParse({ fromAddress: '192.168.1.64', scannedMac: 'AA:BB:CC:00:11:22', credential: { username: 'U', secret: 'S' }, [extra]: 'x' }).success, extra).toBe(false);
    }
    for (const extra of ['addresses', 'range', 'subnet', 'port', 'interfaceName', 'timeoutMs']) expect(CameraFactoryScanRequestSchema.safeParse({ [extra]: 'x' }).success, extra).toBe(false);
    expect(CAMERA_FACTORY_SCAN_MAX_DEVICES).toBe(33);
    expect(CAPTURE_MAC_ADDRESS_PATTERN.test('AA:BB:CC:00:11:22')).toBe(true);
    for (const mac of ['aa:bb:cc:00:11:22', 'AA-BB-CC-00-11-22', 'AABBCC001122', 'AA:BB:CC:00:11', '']) expect(CAPTURE_MAC_ADDRESS_PATTERN.test(mac), mac).toBe(false);
    expect(CAMERA_NETWORK_JOB_ID_PATTERN.test('CNJ-000001')).toBe(true);
    for (const id of ['CNJ-1', 'cnj-000001', 'CAM-01', '192.168.1.64', '']) expect(CAMERA_NETWORK_JOB_ID_PATTERN.test(id), id).toBe(false);
  });

  it('row V7b (S2-02, C116): the allowed ONVIF ports - the two CHECKs of `onvif_ports` as a form, each bound held; the answer states the list', () => {
    const update = (onvifPorts: unknown) => CaptureNetworkConfigUpdateRequestSchema.safeParse({ revision: 1, onvifPorts }).success;
    // Each bound, at it and one past it. SEEN RED: `.min(onvifPortsMin)` removed ([] passed); `.max(onvifPortsMax)` -> 9 (nine ports passed); the distinct refine removed ([80, 80] passed); `onvifPortMax` 65535 -> 65536.
    expect(update([80])).toBe(true);
    expect(update([])).toBe(false);
    expect(update([1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
    expect(update([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(false);
    expect(update([1])).toBe(true);
    expect(update([0])).toBe(false);
    expect(update([65535])).toBe(true);
    expect(update([65536])).toBe(false);
    expect(update([-80])).toBe(false);
    // No port twice; a whole number only (the schema is stricter than the CHECK, which takes 80.0 as 80); a number, not its text; no null.
    expect(update([80, 8080, 80])).toBe(false);
    expect(update([80.5])).toBe(false);
    expect(update(['80'])).toBe(false);
    expect(update(null)).toBe(false);
    expect(update(80)).toBe(false);
    // The order is kept as written: the first is the port of an address that names none.
    expect(CaptureNetworkConfigUpdateRequestSchema.parse({ revision: 1, onvifPorts: [8080, 80, 554] }).onvifPorts).toEqual([8080, 80, 554]);
    // Absent: the stored list stays (the member is optional in the request, required in the answer).
    expect(update(undefined)).toBe(true);
    const answer = simCaptureNetworkConfig();
    expect(answer.onvifPorts).toEqual([80]);
    expect(CaptureNetworkConfigSchema.safeParse(answer).success).toBe(true);
    const { onvifPorts: _dropped, ...withoutPorts } = answer;
    expect(CaptureNetworkConfigSchema.safeParse(withoutPorts).success).toBe(false);
    expect(CaptureNetworkConfigSchema.safeParse({ ...answer, onvifPorts: [80, 80] }).success).toBe(false);
    // The open document states the bounds a client validates against.
    const schemas = createOpenApiDocument({ scope: 'all' }).components.schemas as Record<string, { properties?: Record<string, { minItems?: number; maxItems?: number; items?: { minimum?: number; maximum?: number; type?: string } }>; required?: string[] }>;
    for (const name of ['CaptureNetworkConfig', 'CaptureNetworkConfigUpdateRequest']) {
      const member = schemas[name]?.properties?.['onvifPorts'];
      expect([member?.minItems, member?.maxItems, member?.items?.minimum, member?.items?.maximum, member?.items?.type], name).toEqual([1, 8, 1, 65535, 'integer']);
    }
    expect(schemas['CaptureNetworkConfig']?.required).toContain('onvifPorts');
    expect(schemas['CaptureNetworkConfigUpdateRequest']?.required ?? []).not.toContain('onvifPorts');
  });
});

describe('the credential of operation 106: typed for one job, never stored (C1, C7)', () => {
  it('the four credential-carrying operations are exactly those whose request schema holds the credential pair', () => {
    expect([...CREDENTIAL_CARRYING_OPERATIONS]).toEqual(['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate', 'setCameraNetwork']);
    const schemas = createOpenApiDocument({ scope: 'all' }).components.schemas as Record<string, unknown>;
    const carrying = CORE_API_OPERATIONS.filter((operation) => {
      if (operation.requestBody === undefined) return false;
      return operation.requestBody.schema === 'CaptureCredentialWriteRequest' || JSON.stringify(schemas[operation.requestBody.schema]).includes('CaptureCredentialWriteRequest');
    }).map((operation) => operation.operationId);
    expect(carrying).toEqual([...CREDENTIAL_CARRYING_OPERATIONS]);
    // Each of the four is web console only.
    for (const id of CREDENTIAL_CARRYING_OPERATIONS) expect(findCoreApiOperation(id)!.access.conditions, id).toEqual(['WEB_CONSOLE_SESSION']);
  });

  it('the credential is required in the request and exists in NO answer; the description states the rule', () => {
    const BOUND = { fromAddress: '192.168.1.64', scannedMac: 'AA:BB:CC:00:11:22' };
    expect(CameraNetworkSetRequestSchema.safeParse(BOUND).success).toBe(false);
    expect(CameraNetworkSetRequestSchema.safeParse({ ...BOUND, credential: { username: 'only' } }).success).toBe(false);
    expect(CameraNetworkSetRequestSchema.safeParse({ ...BOUND, credential: { username: 'USERNAME', secret: 'SECRET' } }).success).toBe(true);
    // Row V6 (R119-04): THE HARDWARE ADDRESS THE TECHNICIAN SAW IS REQUIRED, in the one strict form. A request without
    // it - the request of the first contract - is refused: a scan row without a hardware address cannot be started.
    const typed = { username: 'USERNAME', secret: 'SECRET' };
    expect(CameraNetworkSetRequestSchema.safeParse({ fromAddress: '192.168.1.64', credential: typed }).success).toBe(false);
    for (const mac of [null, '', 'aa:bb:cc:00:11:22', 'AA-BB-CC-00-11-22', 'AABBCC001122', 'AA:BB:CC:00:11', 'AA:BB:CC:00:11:22 ', 'AA:BB:CC:00:11:22:33', 0]) {
      expect(CameraNetworkSetRequestSchema.safeParse({ fromAddress: '192.168.1.64', scannedMac: mac, credential: typed }).success, String(mac)).toBe(false);
    }
    expect((createOpenApiDocument({ scope: 'all' }).components.schemas as Record<string, { required?: string[] }>)['CameraNetworkSetRequest']?.required).toEqual(['fromAddress', 'scannedMac', 'credential']);
    const schemas = createOpenApiDocument({ scope: 'all' }).components.schemas as Record<string, unknown>;
    for (const name of ['CaptureNetworkConfig', 'HostAlias', 'HostAliasState', 'FactoryCamera', 'CameraFactoryScan', 'CameraNetworkJob']) {
      // By member name (a description may say that it holds none).
      expect(JSON.stringify(schemas[name]), name).not.toMatch(/"(credential|username|secret|password)":/i);
    }
    const job = { jobId: 'CNJ-000001', state: 'RUNNING', step: 'REACHING', fromAddress: '192.168.1.64', toAddress: null, scannedMac: 'AA:BB:CC:00:11:22', deviceCount: 'NOT_KNOWN', neighbourMac: null, authenticatedMac: null, confirmedMac: null, deviceId: null, failure: null, startedAt: 1, endedAt: null };
    expect(CameraNetworkJobSchema.safeParse(job).success).toBe(true);
    for (const extra of ['credential', 'username', 'secret', 'password']) expect(CameraNetworkJobSchema.safeParse({ ...job, [extra]: 'x' }).success, extra).toBe(false);
    const text = findCoreApiOperation('setCameraNetwork')!.description;
    for (const phrase of ['typed for this one job and never stored', 'never reused for another camera or a later job', 'never echoes it', 'DHCP mode cannot be asked', 'MAC_MISMATCH']) expect(text, phrase).toContain(phrase);
    expect([CAMERA_NETWORK_SET_WAIT_MS, CAMERA_NETWORK_SET_POLL_MS, CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS]).toEqual([180_000, 4_000, 3]);
    expect(Object.values(CameraNetworkJobState)).toEqual(['RUNNING', 'COMPLETED', 'FAILED']);
    expect(Object.values(CameraNetworkJobStep)).toEqual(['REACHING', 'IDENTIFYING', 'SETTING', 'WAITING', 'DONE']);
    expect(Object.values(CameraNetworkJobFailure)).toEqual([
      'CAMERA_UNREACHABLE', 'ONVIF_NOT_ENABLED', 'AUTHENTICATION_FAILED', 'MAC_MISMATCH', 'SET_REFUSED', 'NOT_FOUND_AT_NEW_ADDRESS', 'HOST_ALIAS_FAILED', 'CORE_RESTARTED',
    ]);
    // The examples of the request carry placeholders only.
    for (const example of Object.values(CAPTURE_COMMISSIONING_EXAMPLES.setCameraNetwork?.request ?? {})) {
      expect((example.value as { credential: unknown }).credential).toEqual({ username: 'USERNAME', secret: 'SECRET' });
    }
  });
});

describe('the alias helper: the request line and the limits as contract facts (C19; S13-08)', () => {
  it('the two lines, and what cannot be put into one', () => {
    expect(HOST_ALIAS_HELPER).toEqual({ requestMaxBytes: 64, verbs: ['add', 'del'], prefixLength: 24, minutesMin: 5, minutesMax: 480, maxAliases: 1 });
    expect(hostAliasAddLine('192.168.1.253', 30)).toBe('add 192.168.1.253/24 30\n');
    expect(hostAliasDelLine('192.168.1.253')).toBe('del 192.168.1.253/24\n');
    // The longest line is inside the helper's bound, with its line feed.
    expect(Buffer.byteLength(hostAliasAddLine('192.168.255.254', 480))).toBeLessThanOrEqual(HOST_ALIAS_HELPER.requestMaxBytes);
    for (const minutes of [5, 30, 480]) expect(hostAliasAddLine('10.0.0.253', minutes)).toBe(`add 10.0.0.253/24 ${String(minutes)}\n`);
    for (const minutes of [0, 4, 481, 30.5, Number.NaN, -30, '30' as never]) expect(() => hostAliasAddLine('192.168.1.253', minutes), String(minutes)).toThrow(HostAliasLineError);
    for (const address of ['192.168.1.253/24', '192.168.1.253 60', '192.168.1.253\ndel 10.0.0.1', '8.8.8.8', '127.0.0.1', '192.168.1.0', '192.168.1.255', 'eth1', '', '192.168.1.253;id', null as never]) {
      expect(() => hostAliasAddLine(address, 30), JSON.stringify(address)).toThrow(HostAliasLineError);
      expect(() => hostAliasDelLine(address), JSON.stringify(address)).toThrow(HostAliasLineError);
    }
    // A refusal names the rule, never the value.
    try {
      hostAliasAddLine('192.168.1.253;id', 30);
    } catch (error) {
      expect((error as Error).message).not.toContain('192.168');
      expect((error as Error).message).not.toContain(';id');
    }
    expect(Object.values(HostAliasReason)).toEqual(['FACTORY_SCAN', 'SET_CAMERA_ADDRESS']);
  });

  it('the facts equal the delivered helper file (`scripts/host/netalias/dems-core-netalias`): a change of either is seen here', () => {
    const helper = readFileSync(fileURLToPath(new URL('../../../scripts/host/netalias/dems-core-netalias', import.meta.url)), 'utf8');
    const constant = (name: string): number => Number(new RegExp(`^${name} = (\\d+)$`, 'm').exec(helper)?.[1]);
    expect(constant('REQUEST_MAX_BYTES')).toBe(HOST_ALIAS_HELPER.requestMaxBytes);
    expect(constant('MINUTES_MIN')).toBe(HOST_ALIAS_HELPER.minutesMin);
    expect(constant('MINUTES_MAX')).toBe(HOST_ALIAS_HELPER.minutesMax);
    expect(constant('MAX_MARKED')).toBe(HOST_ALIAS_HELPER.maxAliases);
    expect(helper).toContain('add <a.b.c.d>/24 <minutes>');
    expect(helper).toContain('del <a.b.c.d>/24');
    // The contract's bounds of the stored lifetime are the helper's.
    expect([CAPTURE_NETWORK_CONFIG_LIMITS.aliasMinutesMin, CAPTURE_NETWORK_CONFIG_LIMITS.aliasMinutesMax]).toEqual([constant('MINUTES_MIN'), constant('MINUTES_MAX')]);
    // The operations state the line where an operator reads it.
    expect(findCoreApiOperation('scanFactoryCameras')!.description).toContain('add <a.b.c.d>/24 <minutes>');
    expect(findCoreApiOperation('removeHostAlias')!.description).toContain('del <a.b.c.d>/24');
  });
});

describe('each refusal with its sentence', () => {
  it('fifteen reasons (thirteen, and two since row V6: R119-03 and R119-04), each with a sentence that quotes no address, no interface and no credential', () => {
    const reasons = Object.values(CaptureCommissioningReason);
    expect(reasons).toEqual([
      'COMMISSIONING_NOT_AVAILABLE', 'COMMISSIONING_HELPER_NOT_CONFIGURED', 'COMMISSIONING_NOT_CONFIGURED', 'COMMISSIONING_JOB_IN_PROGRESS', 'HOST_ALIAS_NOT_PRESENT',
      'HOST_ALIAS_FAILED', 'HOST_ALIAS_REMOVE_FAILED', 'CAMERA_ADDRESS_CONFLICT', 'CAMERA_SCAN_TOO_OLD', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND', 'CAMERA_NEW_ADDRESS_IN_USE', 'CAMERA_NO_FREE_ADDRESS', 'COMMISSIONING_ADDRESS_NOT_ALLOWED',
      'NETWORK_CONFIG_NOT_ALLOWED', 'COMMISSIONING_SCAN_RATE_LIMITED',
    ]);
    expect(Object.keys(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES)).toEqual(reasons);
    const texts = CAPTURE_COMMISSIONING_OPERATIONS.map((operation) => `${operation.description} ${Object.values(operation.responses).map((response) => response.description).join(' ')}`).join(' ');
    for (const reason of reasons) {
      const sentence = CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason];
      expect(sentence.length, reason).toBeGreaterThan(10);
      expect(sentence, reason).toMatch(/\.$/);
      expect(sentence, reason).not.toMatch(/\d+\.\d+|eth\d|enp|USERNAME|SECRET/);
      // Every reason is named by at least one operation.
      expect(texts, reason).toContain(reason);
    }
    // The envelope takes each of them on its code.
    expect(validateCoreApiResponse('setCameraNetwork', 409, { error: { code: 'INVALID_STATE', message: CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.CAMERA_ADDRESS_CONFLICT, details: { reason: 'CAMERA_ADDRESS_CONFLICT' } } })).toEqual({ ok: true });
    expect(validateCoreApiResponse('scanFactoryCameras', 422, { error: { code: 'INVALID_INPUT', message: CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_ADDRESS_NOT_ALLOWED, details: { in: 'body', reason: 'COMMISSIONING_ADDRESS_NOT_ALLOWED' } } })).toEqual({ ok: true });
  });

  it('the examples: every documented status has one, every body parses, and none carries a real-looking credential', () => {
    for (const operation of CAPTURE_COMMISSIONING_OPERATIONS) {
      const examples = CAPTURE_COMMISSIONING_EXAMPLES[operation.operationId]!;
      expect(CORE_API_EXAMPLES[operation.operationId], operation.operationId).toBe(examples);
      expect(Object.keys(examples.responses).map(Number), operation.operationId).toEqual(listCoreApiResponseStatuses(operation));
      for (const [status, named] of Object.entries(examples.responses)) {
        for (const example of Object.values(named)) expect(validateCoreApiResponse(operation.operationId, Number(status), example.value), `${operation.operationId} ${status} ${example.summary}`).toEqual({ ok: true });
      }
    }
    expect(JSON.stringify(CAPTURE_COMMISSIONING_EXAMPLES).match(/"secret":"[^"]*"/g)).toEqual(['"secret":"SECRET"', '"secret":"SECRET"']);
  });
});

describe('the simulator: synthetic answers that change nothing', () => {
  const NET = '/api/v1/capture/network';

  async function technician(deviceConsole = false) {
    const sim = createSim({ storage: null, authStorage: null, clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), scheduler: () => () => {}, ...(deviceConsole ? { deviceConsole: true } : {}) });
    await sim.ready;
    sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    return sim;
  }

  it('the two fixed values say what they are', () => {
    const config = simCaptureNetworkConfig();
    expect(CaptureNetworkConfigSchema.safeParse(config).success).toBe(true);
    expect([config.interfaceName, config.revision, config.updatedAt, config.updatedBy]).toEqual([SIM_CAPTURE_INTERFACE_NAME, 1, null, null]);
    expect(SIM_CAPTURE_INTERFACE_NAME).toBe('simulated0');
    const scan = simCameraFactoryScan(1_000);
    expect(CameraFactoryScanSchema.safeParse(scan).success).toBe(true);
    expect([scan.synthetic, scan.alias, scan.addressCount, scan.devices.length]).toEqual([true, null, 4, 1]);
    expect(scan.devices[0]).toMatchObject({ address: '192.168.1.64', mac: SIM_FACTORY_CAMERA_MAC, name: SIM_FACTORY_CAMERA_NAME, registeredDeviceId: null, endpointCount: null, deviceCount: 'NOT_KNOWN' });
    // Row V6 (R119-03; decision C94 (a)): THE SCAN STATES WHAT IT KNOWS. The three-state member stands IN THE PLACE OF
    // the boolean `conflict`: the old member is gone from the schema (a reader of the first contract finds nothing to
    // take for "no conflict"), an answer that still carries it is refused, and "not known" is a word of its own.
    expect(Object.values(FactoryCameraDeviceCount)).toEqual(['ONE', 'MORE_THAN_ONE', 'NOT_KNOWN']);
    expect('conflict' in scan.devices[0]!).toBe(false);
    expect(Object.keys(FactoryCameraSchema.shape)).not.toContain('conflict');
    const device = scan.devices[0]!;
    expect(FactoryCameraSchema.safeParse(device).success).toBe(true);
    expect(FactoryCameraSchema.safeParse({ ...device, conflict: false }).success).toBe(false);
    for (const state of [null, undefined, true, false, 'UNKNOWN', 'NONE', '']) expect(FactoryCameraSchema.safeParse({ ...device, deviceCount: state }).success, String(state)).toBe(false);
    expect(FactoryCameraSchema.safeParse({ ...device, endpointCount: 2, deviceCount: 'MORE_THAN_ONE' }).success).toBe(true);
    // A job says what it ran on, and which hardware address it was bound to.
    expect(Object.keys(CameraNetworkJobSchema.shape)).toEqual(expect.arrayContaining(['scannedMac', 'deviceCount']));
    expect(CAMERA_NETWORK_SCAN_MAX_AGE_MS).toBe(600_000);
    expect(CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS).toBe(2);
    expect(SIM_FACTORY_CAMERA_NAME).toContain('simulated');
    // Locally administered: the second-least-significant bit of the first byte is set.
    expect(Number.parseInt(SIM_FACTORY_CAMERA_MAC.slice(0, 2), 16) & 0b10).toBe(0b10);
    expect(simCameraFactoryScan(1_000, '192.168.1.200')).toMatchObject({ addressCount: 5, devices: [{ address: '192.168.1.200' }] });
    expect(HostAliasStateSchema.safeParse({ alias: null }).success).toBe(true);
  });

  it('every call of a TECHNICIAN leaves the whole state the SAME object: nothing stored, no audit row, no event', async () => {
    const sim = await technician();
    const before = sim.store.getState();
    const calls: Array<[string, string, unknown?]> = [
      ['GET', `${NET}/config`],
      ['POST', `${NET}/config`, { revision: 1, interfaceName: 'enp3s0', cameraSubnet: '192.168.10.0/24' }],
      ['POST', `${NET}/scan`],
      ['POST', `${NET}/scan`, { address: '192.168.1.200' }],
      ['GET', `${NET}/alias`],
      ['POST', `${NET}/alias/remove`],
      ['POST', `${NET}/cameras/address`, { fromAddress: '192.168.1.64', scannedMac: 'AA:BB:CC:00:11:22', toAddress: '192.168.10.101', credential: { username: 'USERNAME', secret: 'SECRET' } }],
      ['GET', `${NET}/jobs/CNJ-000001`],
    ];
    const statuses = calls.map(([method, path, body]) => sim.request({ method: method as 'GET' | 'POST', path, ...(body === undefined ? {} : { body }) }).status);
    expect(statuses).toEqual([200, 409, 200, 200, 200, 409, 409, 404]);
    expect(sim.store.getState()).toBe(before);
    // The read after the refused write is the fixed configuration still.
    expect(sim.request({ method: 'GET', path: `${NET}/config` }).body).toEqual(simCaptureNetworkConfig());
    sim.stop();
  });

  it('a tablet or phone app is refused on all seven before the body is used (WEB_CONSOLE_ONLY)', async () => {
    const sim = await technician(true);
    const paths: Array<['GET' | 'POST', string]> = [
      ['GET', `${NET}/config`], ['POST', `${NET}/config`], ['POST', `${NET}/scan`], ['GET', `${NET}/alias`], ['POST', `${NET}/alias/remove`], ['POST', `${NET}/cameras/address`], ['GET', `${NET}/jobs/CNJ-000001`],
    ];
    for (const [method, path] of paths) {
      const answer = sim.request({ method, path, body: { anything: 'at all' } });
      expect([answer.status, (answer.body as { error: { code: string; details?: { reason?: string } } }).error.details?.reason], `${method} ${path}`).toEqual([403, 'WEB_CONSOLE_ONLY']);
    }
    sim.stop();
  });
});
