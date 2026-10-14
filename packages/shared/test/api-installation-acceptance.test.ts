// Task 4 (blueprint row 116, WP-26b; schema set C, table `installation_acceptances`; decisions U10,
// U11 (OQ-2), C2, C61; security finding S13-13): the contract package of the installation acceptance
// and its revocation, operations 109 and 110. THE CONTRACT ONLY: no Core route (row 117) and no
// screen (row 118) exists yet. What is held here: who may call, the CLOSED KEY LIST of `steps` and
// of `diagnostics` at every level, the bounds of the table (no looser and no stricter: 32 steps,
// texts of 200 characters on one line, 8,192 and 16,384 bytes counted on the database's text
// form), each refusal with its sentence, and the simulator's answers - refusals that change nothing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_COMMISSION_ACCESS,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CoreApiScope,
  INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS,
  INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS,
  INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS,
  INSTALLATION_ACCEPTANCE_EXAMPLES,
  INSTALLATION_ACCEPTANCE_ID_PATTERN,
  INSTALLATION_ACCEPTANCE_LIMITS,
  INSTALLATION_ACCEPTANCE_OPERATIONS,
  INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES,
  INSTALLATION_ACCEPTANCE_SCHEMAS,
  INSTALLATION_ACCEPTANCE_CHECK_ID_PATTERN,
  INSTALLATION_ACCEPTANCE_STEP_IDS,
  INSTALLATION_ACCEPTANCE_STEP_ID_PATTERN,
  INSTALLATION_ACCEPTANCE_STEP_KEYS,
  INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION,
  INSTALLATION_ACCEPTANCE_STEP_TITLES,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceDiagnosticsSchema,
  InstallationAcceptanceLegacyStepSchema,
  InstallationAcceptanceReason,
  InstallationAcceptanceRevokeRequestSchema,
  InstallationAcceptanceSchema,
  InstallationAcceptanceStepResult,
  InstallationAcceptanceStepSchema,
  isInstallationAcceptanceStepList,
  WEB_CONSOLE_ONLY_REASON,
  createOpenApiDocument,
  findCoreApiOperation,
  installationAcceptanceTextOf,
  installationDocumentBytes,
  isInstallationAcceptanceText,
  listCoreApiResponseStatuses,
  validateCoreApiResponse,
} from '../src/api';
import { AUDIT_TYPE_CATEGORY, AuditType, DEMO_OPERATOR_PASSWORD, OperatorRole, Permission, ROLE_PERMISSIONS, createManualClock, createSim, evaluateDiagnostic } from '../src/sim';

const numberOf = (source: string): number => Number(/operation (\d+)/.exec(source)?.[1]);
const IDS = ['acceptInstallation', 'revokeInstallationAcceptance'] as const;
const L = INSTALLATION_ACCEPTANCE_LIMITS;
const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const step = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({ id: 'CAMERAS_ASSIGNED', passed: true, detail: null, ...overrides });
const run = (checks: unknown[] = [{ id: 'CPU', label: 'CPU and memory', status: 'PASS', detail: 'CPU 12%', params: { cpuPercent: 12, cpuTempC: 48.5 } }], overrides: Record<string, unknown> = {}) => ({
  id: 'DIAG-000001',
  startedAt: 1_000,
  completedAt: 2_000,
  checks,
  ...overrides,
});
const check = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({ id: 'CPU', label: 'CPU and memory', status: 'PASS', detail: null, ...overrides });
/**
 * THE STORED DOCUMENT `steps`, as the table bounds it (row V6): the bound, key-list and text tests of
 * this file hold the STORED form, which reads the steps of the closed list AND the steps a record
 * of the first contract holds (`step()` above is one). What a REQUEST may carry is narrower - the
 * closed list - and has its own cases (`requestOk`, `LIST`).
 */
const stepsOk = (value: unknown): boolean => InstallationAcceptanceSchema.shape.steps.safeParse(value).success;
/** Every check of the contract's closed list once, all passed. */
const LIST: Array<Record<string, unknown>> = INSTALLATION_ACCEPTANCE_STEP_IDS.map((id) => ({ id, result: 'PASS', detail: null }));
const requestOk = (steps: unknown): boolean => InstallationAcceptRequestSchema.safeParse({ steps }).success;
const runOk = (value: unknown): boolean => InstallationAcceptanceDiagnosticsSchema.safeParse(value).success;

/**
 * The text form `jsonb` prints, written out here a second time and by another method than the
 * contract's counter (it builds the text; the contract only counts): one blank after every colon
 * and comma, no exponent in a number.
 */
function databaseText(value: unknown): string {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return plainNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(databaseText).join(', ')}]`;
  return `{${Object.entries(value as Record<string, unknown>).map(([key, member]) => `${JSON.stringify(key)}: ${databaseText(member)}`).join(', ')}}`;
}
function plainNumber(value: number): string {
  const text = String(value);
  const match = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
  if (!match) return text;
  const [, sign = '', first = '', fraction = '', exponentText = '0'] = match;
  const exponent = Number(exponentText);
  const digits = first + fraction;
  if (exponent < 0) return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
  if (fraction.length <= exponent) return `${sign}${digits}${'0'.repeat(exponent - fraction.length)}`;
  return `${sign}${digits.slice(0, exponent + 1)}.${digits.slice(exponent + 1)}`;
}
const utf8 = (text: string): number => new TextEncoder().encode(text).length;

describe('the registry: operations 109 and 110', () => {
  it('number, id, method, path, tag, mode, access and audit; they are entries 109 and 110 of the table', () => {
    const rows = INSTALLATION_ACCEPTANCE_OPERATIONS.map((operation) => [numberOf(operation.source), operation.operationId, operation.method, operation.path, operation.tag, operation.mode, operation.audit.success, operation.audit.denial]);
    expect(rows).toEqual([
      [109, 'acceptInstallation', 'post', '/api/v1/installation/acceptance', 'Device', 'simulated','INSTALLATION_ACCEPTED', 'ACCESS_DENIED'],
      [110, 'revokeInstallationAcceptance', 'post', '/api/v1/installation/acceptance/revoke', 'Device', 'simulated','INSTALLATION_ACCEPTANCE_REVOKED', 'ACCESS_DENIED'],
    ]);
    // Task 4 row RD2 appended operation 111 after them.
    expect(CORE_API_OPERATIONS.slice(108, 110).map((operation) => operation.operationId)).toEqual([...IDS]);
    expect(CORE_API_OPERATIONS).toHaveLength(111);
    // The two audit types exist since the vocabulary step of row 19; this row adds none.
    for (const type of [AuditType.INSTALLATION_ACCEPTED, AuditType.INSTALLATION_ACCEPTANCE_REVOKED]) expect(AUDIT_TYPE_CATEGORY[type]).toBe('SYSTEM');
    // Exactly one audit entry each: no `also`.
    for (const operation of INSTALLATION_ACCEPTANCE_OPERATIONS) expect('also' in operation.audit, operation.operationId).toBe(false);
    expect(Object.keys(INSTALLATION_ACCEPTANCE_SCHEMAS)).toEqual(['InstallationAcceptanceStep', 'InstallationAcceptanceDiagnostics', 'InstallationAcceptance', 'InstallationAcceptRequest', 'InstallationAcceptanceRevokeRequest']);
    for (const [name, schema] of Object.entries(INSTALLATION_ACCEPTANCE_SCHEMAS)) expect((CORE_API_SCHEMAS as Record<string, unknown>)[name], name).toBe(schema);
  });

  it('who may call: CAPTURE_COMMISSION (TECHNICIAN only, U10) on a web console session only, idle only; recording is not gated on an acceptance', () => {
    for (const operation of INSTALLATION_ACCEPTANCE_OPERATIONS) {
      expect(operation.access, operation.operationId).toEqual(CAPTURE_COMMISSION_ACCESS);
      expect(operation.access, operation.operationId).toEqual({ kind: 'PERMISSION', permission: 'CAPTURE_COMMISSION', conditions: ['WEB_CONSOLE_SESSION'] });
      expect(operation.responses[403].description, operation.operationId).toContain(WEB_CONSOLE_ONLY_REASON);
      expect(operation.responses[403].description, operation.operationId).toContain('ACCESS_DENIED');
      expect(operation.description, operation.operationId).toContain('TECHNICIAN only, web console only');
      expect(operation.description, operation.operationId).toContain('**Idle only.**');
      expect(operation.responses[409].description, operation.operationId).toContain('CAPTURE_CONFIG_LOCKED');
      // The statement the row asks for, in both descriptions.
      expect(operation.description, operation.operationId).toContain('**Recording is not gated on an acceptance.**');
      const examples = CORE_API_EXAMPLES[operation.operationId]?.responses[403] as Record<string, { value: { error: { details?: Record<string, string> } } }> | undefined;
      expect(examples?.webConsoleOnly?.value.error.details).toMatchObject({ permission: 'CAPTURE_COMMISSION', role: 'TECHNICIAN', reason: 'WEB_CONSOLE_ONLY' });
      expect(examples?.notPermitted?.value.error.details).toMatchObject({ permission: 'CAPTURE_COMMISSION', role: 'SUPERVISOR' });
    }
    expect(Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(Permission.CAPTURE_COMMISSION))).toEqual(['TECHNICIAN']);
  });

  it('the documented statuses; the in-app simulator answers every one but the success, which only the Core server sends', () => {
    for (const id of IDS) {
      const operation = findCoreApiOperation(id)!;
      expect(listCoreApiResponseStatuses(operation), id).toEqual([200, 400, 401, 403, 409, 422]);
      expect(listCoreApiResponseStatuses(operation, CoreApiScope.OFFLINE), id).toEqual([400, 401, 403, 409, 422]);
      expect(operation.pathParam, id).toBeUndefined();
      expect(operation.query, id).toBeUndefined();
      // Every operation states its simulator answer, and that the answer changes nothing.
      expect(operation.description, id).toMatch(/The simulator (keeps no installation record|never holds an acceptance)/);
      expect(operation.description, id).toContain('It stores nothing, writes no audit row and changes no state.');
    }
    expect(IDS.map((id) => findCoreApiOperation(id)!.requestBody)).toEqual([
      { schema: 'InstallationAcceptRequest', required: true },
      { schema: 'InstallationAcceptanceRevokeRequest', required: true },
    ]);
    const offline = createOpenApiDocument() as { paths: Record<string, { post?: { responses: Record<string, unknown> } }> };
    expect(Object.keys(offline.paths['/api/v1/installation/acceptance']!.post!.responses)).not.toContain('200');
    const all = createOpenApiDocument({ scope: CoreApiScope.ALL }) as { paths: Record<string, { post?: { responses: Record<string, unknown> } }> };
    expect(Object.keys(all.paths['/api/v1/installation/acceptance/revoke']!.post!.responses)).toContain('200');
  });
});

describe('NO FREE JSON (S13-13): the closed key list of `steps` and of `diagnostics`', () => {
  const shapeKeys = (schema: unknown): string[] => Object.keys((schema as { shape: Record<string, unknown> }).shape);
  const diagnosticsShape = (InstallationAcceptanceDiagnosticsSchema as unknown as { shape: Record<string, unknown> }).shape;
  const checkShape = ((diagnosticsShape['checks'] as { element: { shape: Record<string, unknown> } }).element).shape;
  const paramsSchema = (checkShape['params'] as { unwrap: () => unknown }).unwrap();

  it('the four lists ARE the members of the four objects', () => {
    expect(shapeKeys(InstallationAcceptanceStepSchema)).toEqual([...INSTALLATION_ACCEPTANCE_STEP_KEYS]);
    expect(Object.keys(diagnosticsShape)).toEqual([...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS]);
    expect(Object.keys(checkShape)).toEqual([...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS]);
    expect(shapeKeys(paramsSchema)).toEqual([...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS]);
    expect([INSTALLATION_ACCEPTANCE_STEP_KEYS, INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS, INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS, INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS].map((list) => list.length)).toEqual([3, 4, 6, 16]);
    // The request names the steps and the address and NOTHING the Core states itself.
    expect(shapeKeys(InstallationAcceptRequestSchema)).toEqual(['siteAddress', 'steps']);
    expect(shapeKeys(InstallationAcceptanceRevokeRequestSchema)).toEqual(['reason']);
    expect(shapeKeys(InstallationAcceptanceSchema)).toEqual(['acceptanceId', 'acceptedAt', 'acceptedBy', 'softwareVersion', 'coreDeviceId', 'siteName', 'room', 'siteAddress', 'steps', 'diagnostics', 'revokedAt', 'revokedBy', 'revokeReason']);
  });

  it('none of the 28 denied key names of the database is a member name at any level - `code` among them (read from the schema file of the Core)', () => {
    const source = read('../../../apps/core-server/src/db/schema/value-sets.ts');
    const list = /export const AUDIT_DETAIL_FORBIDDEN_KEYS = \[([\s\S]*?)\] as const;/.exec(source)?.[1] ?? '';
    const denied = [...list.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]!);
    expect(denied).toHaveLength(28);
    expect(denied).toContain('code');
    const mine = [...INSTALLATION_ACCEPTANCE_STEP_KEYS, ...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS, ...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS, ...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS];
    expect(mine.filter((key) => denied.includes(key))).toEqual([]);
    // So every one of them is refused wherever it is put: each object is strict.
    for (const key of denied) {
      expect(stepsOk([step({ [key]: 'x' })]), `step.${key}`).toBe(false);
      expect(runOk(run([check()], { [key]: 'x' })), `run.${key}`).toBe(false);
      expect(runOk(run([check({ [key]: 'x' })])), `check.${key}`).toBe(false);
      expect(runOk(run([check({ params: { [key]: 'x' } })])), `params.${key}`).toBe(false);
      expect(InstallationAcceptRequestSchema.safeParse({ steps: [], [key]: 'x' }).success, `request.${key}`).toBe(false);
      expect(InstallationAcceptanceRevokeRequestSchema.safeParse({ reason: 'The Core was moved.', [key]: 'x' }).success, `revoke.${key}`).toBe(false);
    }
  });

  it('a member outside its list is refused at every level, a near name too; a step is flat and the diagnostics are four levels and no deeper', () => {
    expect(stepsOk([step()])).toBe(true);
    for (const extra of ['note', 'label', 'my_code', 'tokens', 'Password', 'ok', 'view']) expect(stepsOk([step({ [extra]: 'x' })]), extra).toBe(false);
    // Flat: a member is a code, a boolean, a text or null - never a list or a map.
    for (const detail of [['a'], { a: 1 }, 1, true]) expect(stepsOk([step({ detail })]), JSON.stringify(detail)).toBe(false);
    for (const steps of [{}, 'x', null, [null], ['CAMERAS_ASSIGNED'], [[step()]]]) expect(stepsOk(steps), JSON.stringify(steps)).toBe(false);
    // A step id is a CODE; `passed` and `detail` are required.
    for (const id of ['', 'cameras', 'CAMERAS ASSIGNED', '1ST', `A${'B'.repeat(64)}`]) expect(INSTALLATION_ACCEPTANCE_STEP_ID_PATTERN.test(id), id).toBe(false);
    expect(INSTALLATION_ACCEPTANCE_STEP_ID_PATTERN.test(`A${'B'.repeat(63)}`)).toBe(true);
    expect(stepsOk([{ id: 'A', passed: true }])).toBe(false);
    expect(stepsOk([{ id: 'A', detail: null }])).toBe(false);

    expect(runOk(run())).toBe(true);
    expect(runOk(run([]))).toBe(true);
    expect(runOk(run([check({ params: { note: 'x' } })]))).toBe(false);
    expect(runOk(run([check({ extra: 1 })]))).toBe(false);
    // The fifth level does not exist: a value of `params` is never a map or a list.
    expect(runOk(run([check({ params: { tracks: { a: 1 } } })]))).toBe(false);
    expect(runOk(run([check({ params: { tracks: ['CAM-01'] } })]))).toBe(false);
    expect(runOk(run([check({ params: { tracks: 'CAM-01,CAM-02', reason: null, linkUp: true, offsetMs: -3 } })]))).toBe(true);
    // A run that has not ended is no diagnostics of an acceptance; a list or a text neither.
    expect(runOk(run([check()], { completedAt: null }))).toBe(false);
    for (const value of [[], 'x', null, {}]) expect(runOk(value), JSON.stringify(value)).toBe(false);
    expect(runOk(run([check({ status: 'GREEN' })]))).toBe(false);
  });

  it('the list of `params` is what the diagnostics of the Core can state today (`evaluateDiagnostic`, read from its source), and a run of the seeded Core is storable', async () => {
    const source = read('../src/sim/maintenance.ts');
    const body = /export function evaluateDiagnostic[\s\S]*?\n}\n/.exec(source)?.[0] ?? '';
    const literals = [...body.matchAll(/params(?::| =) \{([^}]*)\}/g)].map((match) => match[1]!);
    expect(literals.length).toBeGreaterThanOrEqual(12);
    const stated = new Set(literals.flatMap((literal) => [...literal.matchAll(/([A-Za-z]+):/g)].map((match) => match[1]!)));
    expect([...stated].sort()).toEqual([...INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS].sort());

    const sim = createSim({ storage: null, authStorage: null, clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), scheduler: () => () => {} });
    await sim.ready;
    const state = sim.store.getState();
    const checks = ['CPU', 'STORAGE', 'FAN', 'NETWORK', 'CAMERA', 'AUDIO', 'TIME', 'SECURITY'].map((id) => {
      const result = evaluateDiagnostic(state, id);
      return { id, label: id, status: result.status, detail: installationAcceptanceTextOf(result.detail), params: result.params };
    });
    const stored = InstallationAcceptanceDiagnosticsSchema.safeParse(run(checks));
    expect(stored.success).toBe(true);
    expect(installationDocumentBytes(run(checks))).toBeLessThan(L.diagnosticsMaxBytes / 8);
    sim.stop();
  });
});

describe('the bounds are the table\'s: no looser and no stricter (migration 0024; set12 M12S-5, M12S-6)', () => {
  it('the numbers', () => {
    expect(L).toEqual({ stepsMax: 32, stepsMaxBytes: 8_192, diagnosticsMaxBytes: 16_384, textMax: 200, softwareVersionMax: 64, siteTextMax: 200, siteAddressMax: 500, revokeReasonMin: 5, revokeReasonMax: 500 });
    // They are the numbers of the schema file of the table, read here so that a change of either is seen.
    const table = read('../../../apps/core-server/src/db/schema/installation.ts');
    for (const fragment of ['<= 32', '<= 8192', '<= 16384', '{0,200}', '{1,64}', '{1,200}', 'BETWEEN 1 AND 500', 'BETWEEN 5 AND 500', '$.**{3 to last}', '$.**{5 to last}']) expect(table, fragment).toContain(fragment);
  });

  it('no step and 32 steps are taken, 33 are refused', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => step({ id: `STEP_${String(index + 1)}` }));
    expect(stepsOk([])).toBe(true);
    expect(stepsOk(many(32))).toBe(true);
    expect(stepsOk(many(33))).toBe(false);
  });

  it('a text: 200 characters are taken and 201 refused, counted as the database counts (characters, not UTF-16 units); a line break, an escape and every other control character are refused', () => {
    expect(stepsOk([step({ detail: 'x'.repeat(200) })])).toBe(true);
    expect(stepsOk([step({ detail: 'x'.repeat(201) })])).toBe(false);
    expect(stepsOk([step({ detail: '' })])).toBe(true);
    // 200 characters outside the Basic Multilingual Plane are 400 UTF-16 units: the table takes them.
    expect(stepsOk([step({ detail: '\u{1F600}'.repeat(200) })])).toBe(true);
    expect(stepsOk([step({ detail: '\u{1F600}'.repeat(201) })])).toBe(false);
    expect(isInstallationAcceptanceText('\u{1F600}'.repeat(200))).toBe(true);
    expect(isInstallationAcceptanceText('\u{1F600}'.repeat(201))).toBe(false);
    for (const bad of ['line one\nline two', 'a\rb', 'a\tb', 'ok\u001b[2J', 'a\u0000b', 'a\u007fb', 'a\u0085b', 'a\u009fb', 'a b', 'a b', 'a\ud800b']) {
      expect(isInstallationAcceptanceText(bad), JSON.stringify(bad)).toBe(false);
      expect(stepsOk([step({ detail: bad })]), JSON.stringify(bad)).toBe(false);
      expect(runOk(run([check({ detail: bad })])), JSON.stringify(bad)).toBe(false);
      expect(runOk(run([check({ label: bad })])), JSON.stringify(bad)).toBe(false);
      expect(runOk(run([check({ params: { ntpServer: bad } })])), JSON.stringify(bad)).toBe(false);
    }
    for (const good of ['Ruang Pemeriksaan 3', 'café   ­', '48.5 °C', '日本語']) expect(isInstallationAcceptanceText(good), good).toBe(true);
    expect(runOk(run([check({ detail: 'x'.repeat(200), label: 'y'.repeat(200), params: { ntpServer: 'z'.repeat(200) } })]))).toBe(true);
    expect(runOk(run([check({ params: { ntpServer: 'z'.repeat(201) } })]))).toBe(false);
  });

  it('the size is counted on the text form the database stores: one blank after every colon and comma, no exponent in a number', () => {
    expect(installationDocumentBytes({ a: 1, b: [true, null, 'x'] })).toBe('{"a": 1, "b": [true, null, "x"]}'.length);
    expect(installationDocumentBytes([])).toBe(2);
    expect(installationDocumentBytes({})).toBe(2);
    expect(installationDocumentBytes([{}, []])).toBe('[{}, []]'.length);
    expect(installationDocumentBytes('a"b\\c')).toBe('"a\\"b\\\\c"'.length);
    expect(installationDocumentBytes('é日\u{1F600}')).toBe(2 + 2 + 3 + 4);
    // A member that is `undefined` is not sent.
    expect(installationDocumentBytes({ a: 1, b: undefined })).toBe('{"a": 1}'.length);
    const numbers: Array<[number, string]> = [
      [0, '0'], [-0, '0'], [12, '12'], [-3, '-3'], [48.5, '48.5'], [1_790_823_600_000, '1790823600000'], [Number.MAX_SAFE_INTEGER, '9007199254740991'],
      [1e21, '1000000000000000000000'], [1.25e25, '12500000000000000000000000'], [-1e21, '-1000000000000000000000'],
      [1e-7, '0.0000001'], [1.5e-7, '0.00000015'], [-2.5e-10, '-0.00000000025'], [0.000001, '0.000001'],
    ];
    for (const [value, text] of numbers) {
      expect(plainNumber(value), String(value)).toBe(text);
      expect(installationDocumentBytes(value), String(value)).toBe(text.length);
    }
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, undefined, () => 1]) expect(installationDocumentBytes(value)).toBe(Number.POSITIVE_INFINITY);
    // Against the builder of this file, on whole documents.
    const documents: unknown[] = [
      INSTALLATION_ACCEPTANCE_EXAMPLES['acceptInstallation']!.request!['accepted']!.value,
      run(),
      run([check({ detail: 'Kamera 1 – é 日 \u{1F600}', params: { cpuTempC: 48.5, offsetMs: -3, linkUp: false, reason: null, tracks: '' }, resolvesAt: null })]),
      Array.from({ length: 32 }, (_, index) => step({ id: `STEP_${String(index)}`, detail: 'x'.repeat(index) })),
    ];
    for (const document of documents) {
      expect(installationDocumentBytes(document)).toBe(utf8(databaseText(document)));
      // About 2% more than `JSON.stringify`, never less.
      expect(installationDocumentBytes(document)).toBeGreaterThan(utf8(JSON.stringify(document)));
    }
  });

  it('AN OVERSIZED BODY IS REFUSED though every text is within its bound, and the bound itself is taken: 8,192 bytes of steps, 16,384 bytes of diagnostics', () => {
    // 32 steps, each note 200 characters of two bytes: every text is in bound, the list is not.
    const wide = Array.from({ length: 32 }, (_, index) => step({ id: `STEP_${String(index + 1)}`, detail: 'é'.repeat(200) }));
    expect(wide.every((entry) => isInstallationAcceptanceText(entry.detail as string))).toBe(true);
    expect(installationDocumentBytes(wide)).toBeGreaterThan(L.stepsMaxBytes);
    expect(stepsOk(wide)).toBe(false);

    // Exactly at the bound, and one byte over: 32 notes of 200 one-byte characters stay under the
    // bound; characters of two bytes take the place of as many as are missing.
    const base = Array.from({ length: 32 }, (_, index) => step({ id: `STEP_${String(index + 10)}`, detail: 'x'.repeat(200) }));
    expect(installationDocumentBytes(base)).toBeLessThan(L.stepsMaxBytes);
    const pad = (target: number) => {
      const steps = base.map((entry) => ({ ...entry }));
      let missing = target - installationDocumentBytes(steps);
      for (let index = 0; missing > 0 && index < steps.length; index += 1) {
        const widened = Math.min(200, missing);
        steps[index]!.detail = 'é'.repeat(widened) + 'x'.repeat(200 - widened);
        missing -= widened;
      }
      return steps;
    };
    const atBound = pad(L.stepsMaxBytes);
    expect(installationDocumentBytes(atBound)).toBe(L.stepsMaxBytes);
    expect(stepsOk(atBound)).toBe(true);
    const over = pad(L.stepsMaxBytes + 1);
    expect(installationDocumentBytes(over)).toBe(L.stepsMaxBytes + 1);
    expect(stepsOk(over)).toBe(false);

    // The diagnostics: 100 checks whose texts are each in bound are too large together.
    const hundred = run(Array.from({ length: 100 }, (_, index) => check({ id: `C${String(index)}`, detail: 'x'.repeat(200) })));
    expect(installationDocumentBytes(hundred)).toBeGreaterThan(L.diagnosticsMaxBytes);
    expect(runOk(hundred)).toBe(false);
    const checksAt = (target: number) => {
      const checks = Array.from({ length: 59 }, (_, index) => check({ id: `C${String(index + 10)}`, detail: 'x'.repeat(200) }));
      let missing = target - installationDocumentBytes(run(checks));
      for (let index = 0; missing > 0 && index < checks.length; index += 1) {
        const widened = Math.min(200, missing);
        checks[index]!.detail = 'é'.repeat(widened) + 'x'.repeat(200 - widened);
        missing -= widened;
      }
      return run(checks);
    };
    expect(installationDocumentBytes(checksAt(0))).toBeLessThan(L.diagnosticsMaxBytes);
    expect(installationDocumentBytes(checksAt(L.diagnosticsMaxBytes))).toBe(L.diagnosticsMaxBytes);
    expect(runOk(checksAt(L.diagnosticsMaxBytes))).toBe(true);
    expect(installationDocumentBytes(checksAt(L.diagnosticsMaxBytes + 1))).toBe(L.diagnosticsMaxBytes + 1);
    expect(runOk(checksAt(L.diagnosticsMaxBytes + 1))).toBe(false);
  });

  it('the site, the version, the address and the reason of a revocation', () => {
    const example = INSTALLATION_ACCEPTANCE_EXAMPLES['acceptInstallation']!.responses[200]!['accepted']!.value as Record<string, unknown>;
    const ok = (overrides: Record<string, unknown>): boolean => InstallationAcceptanceSchema.safeParse({ ...example, ...overrides }).success;
    expect(ok({})).toBe(true);
    expect(INSTALLATION_ACCEPTANCE_ID_PATTERN.test(example['acceptanceId'] as string)).toBe(true);
    expect([ok({ softwareVersion: 'v'.repeat(64) }), ok({ softwareVersion: 'v'.repeat(65) }), ok({ softwareVersion: '' }), ok({ softwareVersion: '0.6.0\nrm' })]).toEqual([true, false, false, false]);
    for (const member of ['coreDeviceId', 'siteName', 'room']) {
      expect([ok({ [member]: 'R'.repeat(200) }), ok({ [member]: 'R'.repeat(201) }), ok({ [member]: '' }), ok({ [member]: 'Ruang\n3' })], member).toEqual([true, false, false, false]);
    }
    // An address may have several lines; it is bounded in length only.
    expect([ok({ siteAddress: null }), ok({ siteAddress: `${'a'.repeat(249)}\n${'b'.repeat(250)}` }), ok({ siteAddress: 'a'.repeat(501) }), ok({ siteAddress: '' })]).toEqual([true, true, false, false]);
    const request = (siteAddress: unknown): boolean => InstallationAcceptRequestSchema.safeParse({ siteAddress, steps: LIST }).success;
    expect([request(null), request('Jl. Contoh No. 1\nJakarta'), request('a'.repeat(500)), request('a'.repeat(501)), request(''), request('a\u0000b'), InstallationAcceptRequestSchema.safeParse({ steps: LIST }).success]).toEqual([true, true, true, false, false, false, true]);
    // The three revoke members are all null or all set in a stored record; a reason is 5 to 500 characters.
    expect([ok({ revokedAt: 5, revokedBy: 'OPR-003', revokeReason: 'moved' }), ok({ revokedAt: 5, revokedBy: 'OPR-003', revokeReason: 'four' }), ok({ revokedAt: 5, revokedBy: 'nobody', revokeReason: 'moved' })]).toEqual([true, false, false]);
    const revoke = (reason: unknown) => InstallationAcceptanceRevokeRequestSchema.safeParse({ reason });
    expect([revoke('moved').success, revoke('four').success, revoke('r'.repeat(500)).success, revoke('r'.repeat(501)).success, revoke('       ').success, revoke(undefined).success, revoke('a\u0000bcdef').success]).toEqual([true, false, true, false, false, false, false]);
    // Trimmed before it is counted and stored; the body holds no id.
    expect(revoke('  The Core was moved.  ').data).toEqual({ reason: 'The Core was moved.' });
    expect(InstallationAcceptanceRevokeRequestSchema.safeParse({ reason: 'The Core was moved.', acceptanceId: example['acceptanceId'] }).success).toBe(false);
  });

  it('`installationAcceptanceTextOf` makes a text of the Core storable: one line, at most 200 characters, and it changes nothing that already is', () => {
    expect(installationAcceptanceTextOf('Kamera 1, Kamera 2 offline')).toBe('Kamera 1, Kamera 2 offline');
    expect(installationAcceptanceTextOf('line one\nline two\ttab\u001b[2J\u0085 end')).toBe('line one line two tab [2J  end');
    expect(installationAcceptanceTextOf('a\ud800b')).toBe('a b');
    const long = installationAcceptanceTextOf('\u{1F600}'.repeat(300));
    expect(Array.from(long)).toHaveLength(200);
    expect(installationAcceptanceTextOf('v'.repeat(70), L.softwareVersionMax)).toHaveLength(64);
    for (const text of ['', 'x'.repeat(200), 'a\nb', '\u0000', 'ok\u001b[2J'.repeat(60)]) {
      const once = installationAcceptanceTextOf(text);
      expect(isInstallationAcceptanceText(once), JSON.stringify(text.slice(0, 12))).toBe(true);
      expect(installationAcceptanceTextOf(once)).toBe(once);
    }
  });
});

// Row V6 (security review of row 119, caution R119-07; decision C94 (h)). Before this row the contract took any id of
// the code form, 0 to 32 of them, each `passed` as the client said: a body with `steps: []` was "installation accepted".
describe('THE STEP LIST OF AN ACCEPTANCE COMES FROM THE CONTRACT: the checks of the hardware acceptance package, each once, with a result of a closed set', () => {
  it('the list is the 27 check ids of the frame\'s result record, each once, in the frame\'s own order, every one named in the frame; the results are the frame\'s three', () => {
    expect(INSTALLATION_ACCEPTANCE_STEP_IDS).toHaveLength(27);
    expect(new Set(INSTALLATION_ACCEPTANCE_STEP_IDS).size).toBe(27);
    expect([...INSTALLATION_ACCEPTANCE_STEP_IDS].sort()).toEqual(Array.from({ length: 27 }, (_, index) => `9A/H-${String(index + 1).padStart(2, '0')}`));
    expect(INSTALLATION_ACCEPTANCE_STEP_IDS.every((id) => INSTALLATION_ACCEPTANCE_CHECK_ID_PATTERN.test(id))).toBe(true);
    expect(INSTALLATION_ACCEPTANCE_STEP_IDS.length).toBeLessThanOrEqual(L.stepsMax);
    expect(INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION).toBe(1);
    expect(Object.values(InstallationAcceptanceStepResult)).toEqual(['PASS', 'FAIL', 'NOT_RUN']);
    expect(Object.keys(INSTALLATION_ACCEPTANCE_STEP_TITLES)).toEqual([...INSTALLATION_ACCEPTANCE_STEP_IDS]);
    // THE SOURCE: the recording sheet of the frame (section 9.2) lists the checks in the order of the run. Read from the
    // file the installer holds, so that a changed frame fails here.
    const frame = read('../../../scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md');
    const sheet = frame.slice(frame.indexOf('### 9.2 Recording sheet'), frame.indexOf('### 9.3'));
    expect([...sheet.matchAll(/^\| \d+ \| `(9A\/H-\d{2})` /gm)].map((match) => match[1])).toEqual([...INSTALLATION_ACCEPTANCE_STEP_IDS]);
    expect(frame).toContain('exactly one of `PASS`, `FAIL`, `NOT RUN`');
    expect(frame).toContain('**One line per check**, 27 lines');
  });

  it('a request names EVERY check exactly once: an unknown step, a missing check, a repeated check, an empty list, a result outside the set and the steps of the first contract are refused; a failed or not-run check states why', () => {
    expect(requestOk(LIST)).toBe(true);
    expect(requestOk([...LIST].reverse())).toBe(true);
    const [first, second, ...rest] = LIST as [Record<string, unknown>, Record<string, unknown>, ...Record<string, unknown>[]];
    const refused: ReadonlyArray<[string, unknown]> = [
      ['an empty list', []],
      ['one check only', [first]],
      ['a missing check', [second, ...rest]],
      ['a repeated check in the place of another', [first, first, ...rest]],
      ['a repeated check beside the whole list', [...LIST, first]],
      ['a code of the first contract', [{ id: 'CAMERAS_ASSIGNED', result: 'PASS', detail: null }, second, ...rest]],
      ['an id of the form outside the list', [{ ...first, id: '9A/H-28' }, second, ...rest]],
      ['an id of another case', [{ ...first, id: '9a/h-27' }, second, ...rest]],
      ['a preparation step of the frame', [{ ...first, id: 'PREP-01' }, second, ...rest]],
      ['an installation step of the helper', [{ ...first, id: 'HI-01' }, second, ...rest]],
      ['a result outside the set', [{ ...first, result: 'OK' }, second, ...rest]],
      ['the frame\'s words with a blank', [{ ...first, result: 'NOT RUN', detail: 'x' }, second, ...rest]],
      ['no result', [{ id: first.id, detail: null }, second, ...rest]],
      ['the member of the first contract in the place of the result', [{ id: first.id, passed: true, detail: null }, second, ...rest]],
      ['the member of the first contract beside the result', [{ ...first, passed: true }, second, ...rest]],
      ['a failed check without its reason', [{ ...first, result: 'FAIL', detail: null }, second, ...rest]],
      ['a failed check with a blank reason', [{ ...first, result: 'FAIL', detail: '  ' }, second, ...rest]],
      ['a check that was not run without its reason', [{ ...first, result: 'NOT_RUN', detail: null }, second, ...rest]],
      ['the steps of the first contract', [step(), step({ id: 'MICROPHONES_ASSIGNED', passed: false })]],
    ];
    for (const [label, steps] of refused) expect(requestOk(steps), label).toBe(false);
    expect(requestOk([{ ...first, result: 'FAIL', detail: 'The clap was not heard.' }, { ...second, result: 'NOT_RUN', detail: 'No second camera on site.' }, ...rest])).toBe(true);
    expect(isInstallationAcceptanceStepList([...INSTALLATION_ACCEPTANCE_STEP_IDS])).toBe(true);
    expect([isInstallationAcceptanceStepList([]), isInstallationAcceptanceStepList(INSTALLATION_ACCEPTANCE_STEP_IDS.slice(1)), isInstallationAcceptanceStepList([...INSTALLATION_ACCEPTANCE_STEP_IDS.slice(1), '9A/H-01'])]).toEqual([false, false, false]);
    // The refusal of a list quotes nothing of the body.
    const issue = InstallationAcceptRequestSchema.safeParse({ steps: [{ id: 'CAMERAS_ASSIGNED', result: 'PASS', detail: 'row-v6-typed' }] });
    expect(JSON.stringify(issue.error?.issues.map((entry) => entry.message))).not.toContain('row-v6-typed');
  });

  it('a record stored BEFORE the list is still an ANSWER (read, revoked), never a request; the published document states the closed list and the result set', () => {
    const stored = { ...(INSTALLATION_ACCEPTANCE_EXAMPLES['acceptInstallation']!.responses[200]!['accepted']!.value as Record<string, unknown>) };
    expect(InstallationAcceptanceSchema.safeParse(stored).success).toBe(true);
    expect(InstallationAcceptanceSchema.safeParse({ ...stored, steps: [step(), step({ id: 'MICROPHONES_ASSIGNED', passed: false })] }).success).toBe(true);
    expect(InstallationAcceptanceSchema.safeParse({ ...stored, steps: [] }).success).toBe(true);
    // Neither form mixed into one step.
    expect(InstallationAcceptanceSchema.safeParse({ ...stored, steps: [{ id: '9A/H-01', result: 'PASS', passed: true, detail: null }] }).success).toBe(false);
    expect(InstallationAcceptanceLegacyStepSchema.safeParse(LIST[0]).success).toBe(false);
    const schemas = createOpenApiDocument({ scope: 'all' }).components.schemas as Record<string, { properties?: Record<string, { enum?: string[] }> }>;
    expect(schemas['InstallationAcceptanceStep']?.properties?.['id']?.enum).toEqual([...INSTALLATION_ACCEPTANCE_STEP_IDS]);
    expect(schemas['InstallationAcceptanceStep']?.properties?.['result']?.enum).toEqual(['PASS', 'FAIL', 'NOT_RUN']);
    const text = findCoreApiOperation('acceptInstallation')!.description;
    for (const word of ['9A/H-01', '9A/H-27', 'exactly once', 'NOT_RUN']) expect(text, word).toContain(word);
    // Every example request of operation 109 is a request the contract takes.
    for (const example of Object.values(INSTALLATION_ACCEPTANCE_EXAMPLES['acceptInstallation']!.request ?? {})) expect(InstallationAcceptRequestSchema.safeParse(example.value).success).toBe(true);
  });
});

describe('each refusal with its sentence', () => {
  it('seven reasons on `409 INVALID_STATE` (six, and the clock behind the acceptance since row V6, R119-08), each with a sentence that quotes nothing an operator typed', () => {
    const reasons = Object.values(InstallationAcceptanceReason);
    expect(reasons).toEqual([
      'INSTALLATION_ACCEPTANCE_IN_FORCE',
      'INSTALLATION_ACCEPTANCE_NOT_IN_FORCE',
      'INSTALLATION_DIAGNOSTICS_NOT_COMPLETE',
      'INSTALLATION_DIAGNOSTICS_NOT_STORABLE',
      'INSTALLATION_SITE_NOT_STORABLE',
      'INSTALLATION_ACCEPTANCE_NOT_AVAILABLE',
      'INSTALLATION_CLOCK_BEHIND_RECORD',
    ]);
    // A named 409 of the revocation, with a reason and no value.
    const behind = { error: { code: 'INVALID_STATE', message: INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_CLOCK_BEHIND_RECORD, details: { reason: 'INSTALLATION_CLOCK_BEHIND_RECORD' } } };
    expect(validateCoreApiResponse('revokeInstallationAcceptance', 409, behind)).toEqual({ ok: true });
    expect(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_CLOCK_BEHIND_RECORD).not.toMatch(/\d/);
    expect(findCoreApiOperation('revokeInstallationAcceptance')!.description).toContain('INSTALLATION_CLOCK_BEHIND_RECORD');
    // Row V6b's request, cut by row R1b (decision C105 (5)): operation 109 answers the SAME member, sentence and status.
    expect(validateCoreApiResponse('acceptInstallation', 409, behind)).toEqual({ ok: true });
    const accept = findCoreApiOperation('acceptInstallation')!;
    expect(accept.description).toContain('INSTALLATION_CLOCK_BEHIND_RECORD');
    expect(accept.responses[409]?.description).toContain('INSTALLATION_CLOCK_BEHIND_RECORD');
    expect(Object.keys(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES)).toEqual(reasons);
    const texts = INSTALLATION_ACCEPTANCE_OPERATIONS.map((operation) => `${operation.description} ${Object.values(operation.responses).map((response) => response.description).join(' ')}`).join(' ');
    for (const reason of reasons) {
      const sentence = INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason];
      expect(sentence.length, reason).toBeGreaterThan(10);
      expect(sentence, reason).toMatch(/\.$/);
      expect(texts, reason).toContain(reason);
      expect(validateCoreApiResponse('acceptInstallation', 409, { error: { code: 'INVALID_STATE', message: sentence, details: { reason } } }), reason).toEqual({ ok: true });
    }
    // The second acceptance in force is named in the description of 109, with the database as its holder.
    expect(findCoreApiOperation('acceptInstallation')!.description).toContain('At most one acceptance is in force');
    expect(findCoreApiOperation('revokeInstallationAcceptance')!.description).toContain('The body holds no id');
  });

  it('the examples: every documented status has one, every body parses, both requests parse', () => {
    for (const operation of INSTALLATION_ACCEPTANCE_OPERATIONS) {
      const examples = INSTALLATION_ACCEPTANCE_EXAMPLES[operation.operationId]!;
      expect(CORE_API_EXAMPLES[operation.operationId], operation.operationId).toBe(examples);
      expect(Object.keys(examples.responses).map(Number), operation.operationId).toEqual(listCoreApiResponseStatuses(operation));
      for (const [status, named] of Object.entries(examples.responses)) {
        for (const example of Object.values(named)) expect(validateCoreApiResponse(operation.operationId, Number(status), example.value), `${operation.operationId} ${status} ${example.summary}`).toEqual({ ok: true });
      }
    }
    for (const example of Object.values(INSTALLATION_ACCEPTANCE_EXAMPLES['acceptInstallation']!.request!)) expect(InstallationAcceptRequestSchema.safeParse(example.value).success, example.summary).toBe(true);
    for (const example of Object.values(INSTALLATION_ACCEPTANCE_EXAMPLES['revokeInstallationAcceptance']!.request!)) expect(InstallationAcceptanceRevokeRequestSchema.safeParse(example.value).success, example.summary).toBe(true);
  });
});

describe('the simulator: it keeps no installation record, and changes nothing', () => {
  const ACCEPT = '/api/v1/installation/acceptance';
  const REVOKE = `${ACCEPT}/revoke`;
  type Refusal = { error: { code: string; message: string; details?: { reason?: string; in?: string } } };

  async function signedIn(username: string, deviceConsole = false) {
    const sim = createSim({ storage: null, authStorage: null, clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), scheduler: () => () => {}, ...(deviceConsole ? { deviceConsole: true } : {}) });
    await sim.ready;
    sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD);
    return sim;
  }
  const facts = (answer: { status: number; body: unknown }) => [answer.status, (answer.body as Refusal).error.code, (answer.body as Refusal).error.details?.reason ?? (answer.body as Refusal).error.details?.in];

  it('a TECHNICIAN: both operations answer their stated refusal, and the whole state is the SAME object - nothing stored, no audit row, no event', async () => {
    const sim = await signedIn('rina.wijaya');
    const before = sim.store.getState();
    const accept = sim.request({ method: 'POST', path: ACCEPT, body: { siteAddress: 'Jl. Contoh No. 1\nJakarta', steps: LIST.map((listed, index) => (index === 0 ? { ...listed, result: 'FAIL', detail: 'One microphone is missing.' } : listed)) } });
    expect(facts(accept)).toEqual([409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_NOT_AVAILABLE']);
    expect((accept.body as Refusal).error.message).toBe(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE);
    const revoke = sim.request({ method: 'POST', path: REVOKE, body: { reason: 'The Core was moved to another room.' } });
    expect(facts(revoke)).toEqual([409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_NOT_IN_FORCE']);
    expect((revoke.body as Refusal).error.message).toBe(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE);
    // Both answers are documented answers of their operation.
    expect(validateCoreApiResponse('acceptInstallation', accept.status, accept.body)).toEqual({ ok: true });
    expect(validateCoreApiResponse('revokeInstallationAcceptance', revoke.status, revoke.body)).toEqual({ ok: true });
    // A body outside the schema: 422, and the refusal quotes nothing of it.
    const bodies: Array<[string, unknown]> = [
      [ACCEPT, {}],
      [ACCEPT, { steps: [step({ code: 'X' })] }],
      [ACCEPT, { steps: [step({ detail: 'line one\nline two' })] }],
      [ACCEPT, { steps: LIST, diagnostics: run() }],
      [ACCEPT, { steps: LIST, acceptedBy: 'OPR-001' }],
      // Row V6 (R119-07): the simulator holds the body to the same closed list as the Core.
      [ACCEPT, { steps: [] }],
      [ACCEPT, { steps: [step()] }],
      [ACCEPT, { steps: LIST.slice(1) }],
      [ACCEPT, { steps: [...LIST, LIST[0]] }],
      [REVOKE, {}],
      [REVOKE, { reason: 'four' }],
    ];
    for (const [path, body] of bodies) {
      const answer = sim.request({ method: 'POST', path, body });
      expect(facts(answer), `${path} ${JSON.stringify(body)}`).toEqual([422, 'INVALID_INPUT', 'body']);
      expect(JSON.stringify(answer.body), path).not.toMatch(/line one|OPR-001|four|DIAG-/);
    }
    expect(sim.store.getState()).toBe(before);
    sim.stop();
  });

  it('the Core server\'s order: the role first (a SUPERVISOR and an INVESTIGATOR are refused 403), then the web console (a tablet or phone app: WEB_CONSOLE_ONLY), before the body is used', async () => {
    for (const username of ['andi.pratama', 'budi.santoso']) {
      const sim = await signedIn(username);
      const before = sim.store.getState();
      for (const path of [ACCEPT, REVOKE]) expect(sim.request({ method: 'POST', path, body: { anything: 'at all' } }).status, `${username} ${path}`).toBe(403);
      expect(sim.store.getState()).toBe(before);
      sim.stop();
    }
    const tablet = await signedIn('rina.wijaya', true);
    for (const path of [ACCEPT, REVOKE]) {
      const answer = sim403(tablet.request({ method: 'POST', path, body: { anything: 'at all' } }));
      expect(answer, path).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    }
    tablet.stop();
    // Nobody signed in: 401.
    const nobody = createSim({ storage: null, authStorage: null, clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), scheduler: () => () => {} });
    await nobody.ready;
    for (const path of [ACCEPT, REVOKE]) expect(nobody.request({ method: 'POST', path, body: {} }).status, path).toBe(401);
    // A read of either path is no operation.
    expect(nobody.request({ method: 'GET', path: ACCEPT }).status).toBe(405);
    nobody.stop();
  });

  function sim403(answer: { status: number; body: unknown }) {
    return facts(answer);
  }
});
