// M6-STTCFG-API, Core-server half (blueprint row 113; requirement R-8; C3 §2.5;
// masterplan/10_test_strategy.md §A.6a): operations 90 to 92 against the contract registry.
//
// | Clause of M6-STTCFG-API | describe block |
// |---|---|
// | the route list equals the registry operations 90-92 (MODG) | "MODG" |
// | reads 90 for every role; `CAPTURE_CONFIG` required for 91 and 92; INVESTIGATOR refused | "who may call" |
// | responses carry `credentialSet`/`credentialKind` only | "operation 90", "the credential is write-only" |
// | `STT_CONFIG_CHANGED` detail = changed field names + `credentialChanged` | "operation 91" |
// | a non-loopback endpoint is refused `422 INVALID_INPUT` (`ENDPOINT_NOT_LOOPBACK`) | "operation 91: the refusals" |
// | a stored change applies to the NEXT session (`appliesFrom: NEXT_SESSION`) | "next session" |
// | a credential reaches no response, log line, error-log entry or audit row (grep = 0, with a negative control) | "secrecy" |
// | operation 92 contacts the configured loopback backend only through the provided probe | "operation 92" |
//
// In-process: the real app factory, the real pipeline, the real audit writer and the real stage 6
// on a stand-in pool (`support.ts`). Operation 92 is driven against a FAKE STT server this file
// starts on an ephemeral loopback port; no real STT server is contacted, and port 8000 is never
// named. What PostgreSQL itself says to the module's statements is `stt-config.db.test.ts`.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  STT_BACKENDS,
  STT_CONFIG_CHANGED_MESSAGE,
  STT_CONFIG_OPERATIONS,
  STT_LOOPBACK_ENDPOINT_PATTERN,
  SttConfigSchema,
  SttConfigUpdateResultSchema,
  SttConnectionTestSchema,
  SttCredentialKind,
  isSttModelId,
  matchCoreApiOperation,
  validateCoreApiResponse,
  type SttConfig,
  type SttConfigUpdateResult,
  type SttConnectionTest,
} from '@dems/shared/api';
import { OperatorRole } from '@dems/shared/sim';
import type { RouteOptions } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { CLOCK_START } from '../../../../test/support/core';
import { permissionGuard } from '../../../plugins/permission-guard';
import { STT_BACKEND, STT_CREDENTIAL_KIND } from '../../../db/schema';
import { STT_CONFIG_MODULE_OPERATIONS, STT_CONFIG_UNIT_LABEL, STT_TEST_QUEUE_LIMIT, STT_TEST_TIMEOUT_MS, sttConfigChanged, type SttConnectionProbe, type SttProbeTarget } from '../index';
import { UPDATE_STT_CONFIG, UPDATE_STT_CONFIG_WITH_CREDENTIAL } from '../statements';
import { ANONYMOUS, SEEDED_ROW, STT_PATH, STT_TEST_PATH, haystacksOf, hitsOf, operator, outcome, sttApp, sttDatabase, testSealer, type SttApp } from './support';

/** Planted in requests only. Built from parts, so that no other file of the repository holds them. */
const SECRET = ['stt', 'PLANTED', 'k3y', 'Qm8Zr4Tn6Wb2'].join('-');
const REFERENCE = ['omlx-settings', ['auth', 'planted_ref_Qm8Zr4'].join('.')].join(':');

const open: SttApp[] = [];
const servers: Server[] = [];
const folders: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  for (const stt of open.splice(0)) await stt.close();
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

async function build(options: Parameters<typeof sttApp>[0] = {}): Promise<SttApp> {
  const stt = await sttApp(options);
  open.push(stt);
  return stt;
}

const SUPERVISOR = operator(OperatorRole.SUPERVISOR, 'OPR-002');
const TECHNICIAN = operator(OperatorRole.TECHNICIAN, 'OPR-003');
const INVESTIGATOR = operator(OperatorRole.INVESTIGATOR, 'OPR-001');

/** The details of the audit rows of one type, read from what was sent to the audit insert. */
function auditRowsOf(stt: SttApp, type: string): Array<Record<string, unknown>> {
  return stt.db
    .auditInserts()
    .filter((values) => values.includes(type))
    .map((values) => {
      const details = values.find((value) => typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) ?? values.find((value) => typeof value === 'string' && value.startsWith('{'));
      return (typeof details === 'string' ? JSON.parse(details) : details) as Record<string, unknown>;
    });
}

describe('MODG: the route list of the module equals the registry operations it owns', () => {
  it('registers operations 90 to 92 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/transcription', async () => {
    const registered: RouteOptions[] = [];
    const db = sttDatabase();
    const app = buildApp({ config: unitTestConfig(), createPool: () => db.pool, logStream: captureLog().stream });
    app.addHook('onRoute', (route) => void registered.push(route));
    await app.ready();
    const fromModule = registered.filter((route) => route.url.startsWith('/api/v1/transcription')).map((route) => `${String(route.method)} ${route.url} ${String(route.config?.operationId)}`);
    const fromRegistry = STT_CONFIG_OPERATIONS.map((operation) => `${operation.method.toUpperCase()} ${operation.path} ${operation.operationId}`);
    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/transcription/config getSttConfig',
      'POST /api/v1/transcription/config updateSttConfig',
      'POST /api/v1/transcription/config/test testSttConnection',
    ]);
    console.info(`[row113] MODG routes of src/modules/stt-config: ${fromModule.join(' | ')}`);
    for (const route of registered.filter((candidate) => candidate.url.startsWith('/api/v1/transcription'))) {
      expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler'] as const) expect(route[hook], `${route.url} ${hook}`).toBeUndefined();
    }
    await app.close();
  });

  it('the three are operations 90, 91 and 92 of the registry, whose totals are those of C3 §10.1', () => {
    const numberOf = (operationId: string): number => Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    expect(STT_CONFIG_MODULE_OPERATIONS.map(numberOf)).toEqual([90, 91, 92]);
    // Entries 90 to 92; the five of the camera search (93 to 97; row 132, D106) follow them.
    expect(CORE_API_OPERATIONS.slice(89, 92).map((operation) => operation.operationId)).toEqual([...STT_CONFIG_MODULE_OPERATIONS]);
    const gets = CORE_API_OPERATIONS.filter((operation) => operation.method === 'get').length;
    const posts = CORE_API_OPERATIONS.filter((operation) => operation.method === 'post').length;
    console.info(`[row113] registry totals | operations=${CORE_API_OPERATIONS.length} GET=${gets} POST=${posts}`);
    // 97, 36, 61 until task 4 blueprint row 63 added the two sound-card operations 98 and 99 (both POST).
    // 99, 36, 63 until task 4 blueprint row 194 added operation 100 (POST).
    // 100, 36, 64 until task 4 blueprint row 102 added the seven commissioning operations 101-107 (three GET, four POST).
    // 107, 39, 68 until task 4 row V3 added operation 108, the stored-credential connection test (POST).
    // 108, 39, 69 until task 4 blueprint row 116 added operations 109 and 110, the installation acceptance and its revocation (both POST).
    expect([CORE_API_OPERATIONS.length, gets, posts]).toEqual([110, 39, 71]);
  });

  it('the guard holds the registry rule for each: AUTHENTICATED for 90, CAPTURE_CONFIG for 91 and 92', async () => {
    const stt = await build();
    const rules = permissionGuard(stt.app).registeredRules();
    const found = STT_CONFIG_MODULE_OPERATIONS.map((operationId) => {
      const rule = rules.find((candidate) => candidate.operationId === operationId);
      return [operationId, rule?.kind, [...(rule?.permissions ?? [])]];
    });
    expect(found).toEqual([
      ['getSttConfig', CoreApiAccessKind.AUTHENTICATED, []],
      ['updateSttConfig', CoreApiAccessKind.PERMISSION, ['CAPTURE_CONFIG']],
      ['testSttConnection', CoreApiAccessKind.PERMISSION, ['CAPTURE_CONFIG']],
    ]);
    expect(STT_CONFIG_OPERATIONS.map((operation) => operation.audit.success)).toEqual([CoreApiAuditNone.READ, 'STT_CONFIG_CHANGED', CoreApiAuditNone.PARITY]);
  });

  // Fix round 1, navigator finding N-10: one message for the row, whoever writes it.
  it('N-10: the audit message of STT_CONFIG_CHANGED is the contract constant the simulator writes too', () => {
    const entry = sttConfigChanged({ operatorId: 'OPR-002', deviceId: null, changedFields: ['enabled'], enabled: false, backend: 'cpu-local', credentialChanged: false, revision: 2 });
    expect(entry.message).toBe(STT_CONFIG_CHANGED_MESSAGE);
    expect(STT_CONFIG_CHANGED_MESSAGE).toBe('STT configuration changed');
  });

  it('the value sets and the loopback pattern of the contract are those of the table (dbc-3 §B.13)', () => {
    expect([...STT_BACKENDS]).toEqual([...STT_BACKEND]);
    expect(Object.values(SttCredentialKind)).toEqual([...STT_CREDENTIAL_KIND]);
    // The CHECK `stt_config_endpoint_loopback_check` as migration 0006 wrote it, character for character.
    const migration = readFileSync(new URL('../../../db/migrations/0006_stt_config.sql', import.meta.url), 'utf8');
    expect(migration).toContain(`'${STT_LOOPBACK_ENDPOINT_PATTERN.source.replaceAll('\\/', '/')}'`);
  });
});

describe('who may call: read for every role, CAPTURE_CONFIG for the write and the test', () => {
  it('an anonymous caller is refused 401 on all three, and nothing is written', async () => {
    const stt = await build();
    stt.actAs(ANONYMOUS);
    expect(outcome(await stt.get())).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, enabled: false }))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(outcome(await stt.post(STT_TEST_PATH))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(stt.db.updates).toEqual([]);
  });

  it.each([INVESTIGATOR, SUPERVISOR, TECHNICIAN].map((principal) => [principal.kind === 'OPERATOR' ? principal.role : '', principal] as const))(
    '%s reads operation 90',
    async (_role, principal) => {
      const stt = await build();
      stt.actAs(principal);
      const response = await stt.get();
      expect(response.statusCode).toBe(200);
      expect(validateCoreApiResponse('getSttConfig', 200, response.json())).toEqual({ ok: true });
    },
  );

  it('INVESTIGATOR is refused 403 NOT_PERMITTED on 91 and on 92: one ACCESS_DENIED row each, nothing stored, the probe never called', async () => {
    const stt = await build();
    const probe = vi.fn<SttConnectionProbe>(async () => ({ reachable: true, modelAvailable: true, detailCode: 'OK' }));
    stt.control.provideProbe(probe);
    stt.actAs(INVESTIGATOR);
    const write = await stt.post(STT_PATH, { revision: 1, enabled: false, credential: { kind: 'SECRET', value: SECRET } });
    const test = await stt.post(STT_TEST_PATH);
    console.info(`[row113] M6-STTCFG-API INVESTIGATOR | op91=${write.statusCode} ${outcome(write)[1]} | op92=${test.statusCode} ${outcome(test)[1]}`);
    expect(outcome(write)).toEqual([403, 'NOT_PERMITTED', null]);
    expect(outcome(test)).toEqual([403, 'NOT_PERMITTED', null]);
    expect(validateCoreApiResponse('updateSttConfig', 403, write.json())).toEqual({ ok: true });
    expect(validateCoreApiResponse('testSttConnection', 403, test.json())).toEqual({ ok: true });
    expect(write.json().error.details).toEqual({ operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' });
    // Refused before the body was read: nothing stored, no STT row, the probe untouched.
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(probe).not.toHaveBeenCalled();
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toEqual([
      { operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' },
      { operationId: 'testSttConnection', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' },
    ]);
    // The read stays open to the same caller.
    expect((await stt.get()).statusCode).toBe(200);
  });

  it.each([
    ['SUPERVISOR', SUPERVISOR],
    ['TECHNICIAN', TECHNICIAN],
  ] as const)('%s changes and tests the configuration', async (_role, principal) => {
    const stt = await build();
    stt.control.provideProbe(async () => ({ reachable: true, modelAvailable: true, detailCode: 'OK' }));
    stt.actAs(principal);
    expect((await stt.post(STT_PATH, { revision: 1, enabled: false })).statusCode).toBe(200);
    expect((await stt.post(STT_TEST_PATH)).statusCode).toBe(200);
    expect(stt.db.row()?.enabled).toBe(false);
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toEqual([]);
  });
});

// Batch N (security review row 99, finding S99-09; ruling D241): operation 91 takes a typed secret, as
// operations 89 / 95 / 96 do. A body that CARRIES `credential` is web-console only, with the answer and
// the row of the condition WEB_CONSOLE_SESSION; a body without it stays open to a tablet (gate 81).
describe('S99-09: a credential in the body of operation 91 is web-console only', () => {
  const ON_TABLET = operator(OperatorRole.TECHNICIAN, 'OPR-003', 'TAB-01');
  const SUPERVISOR_ON_PHONE = operator(OperatorRole.SUPERVISOR, 'OPR-002', 'PHN-01');

  it.each([
    ['SECRET', { kind: 'SECRET', value: SECRET }],
    ['REFERENCE', { kind: 'REFERENCE', ref: REFERENCE }],
    ['CLEAR', { kind: 'CLEAR' }],
  ] as const)('a session bound to a paired device sending a %s credential: 403 NOT_PERMITTED (WEB_CONSOLE_ONLY), ONE ACCESS_DENIED row, nothing sealed, nothing stored, nothing of the body anywhere', async (_kind, credential) => {
    const stt = await build();
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    for (const principal of [ON_TABLET, SUPERVISOR_ON_PHONE]) {
      stt.actAs(principal);
      const refused = await stt.post(STT_PATH, { revision: 1, enabled: false, credential });
      expect(outcome(refused)).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      expect(validateCoreApiResponse('updateSttConfig', 403, refused.json())).toEqual({ ok: true });
      expect(refused.json().error.details).toEqual({ operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: principal.kind === 'OPERATOR' ? principal.role : '', reason: 'WEB_CONSOLE_ONLY' });
    }
    // The same answer and row as the condition on operations 89 / 95 / 96 (the guard's own builders).
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toEqual([
      { operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'TECHNICIAN', reason: 'WEB_CONSOLE_ONLY' },
      { operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'SUPERVISOR', reason: 'WEB_CONSOLE_ONLY' },
    ]);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(sealer.sealed).toEqual([]);
    const haystacks = haystacksOf(stt);
    expect(hitsOf(haystacks, SECRET)).toEqual({ responses: 0, logs: 0, errorLog: 0, auditRows: 0, events: 0 });
    expect(hitsOf(haystacks, REFERENCE)).toEqual({ responses: 0, logs: 0, errorLog: 0, auditRows: 0, events: 0 });
  });

  it('CONTROL (gate 81): the same tablet session saves a change WITHOUT a credential, and reads and tests; the web console session stores the SECRET', async () => {
    const stt = await build();
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    stt.control.provideProbe(async () => ({ reachable: true, modelAvailable: true, detailCode: 'OK' }));
    stt.actAs(ON_TABLET);
    const saved = await stt.post(STT_PATH, { revision: 1, enabled: false, diarization: false });
    expect(saved.statusCode).toBe(200);
    expect(stt.db.row()?.enabled).toBe(false);
    expect((await stt.get()).statusCode).toBe(200);
    expect((await stt.post(STT_TEST_PATH)).statusCode).toBe(200);
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toEqual([]);
    // The web console (a session bound to no device) with the same permission stores the secret.
    stt.actAs(TECHNICIAN);
    const stored = await stt.post(STT_PATH, { revision: (saved.json() as SttConfigUpdateResult).revision, credential: { kind: 'SECRET', value: SECRET } });
    expect(stored.statusCode).toBe(200);
    expect(sealer.sealed).toHaveLength(1);
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toEqual([]);
  });

  it('a device session WITHOUT the permission is refused for the permission, as before (the role, not the console)', async () => {
    const stt = await build();
    stt.actAs(operator(OperatorRole.INVESTIGATOR, 'OPR-001', 'TAB-01'));
    const refused = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: SECRET } });
    expect(outcome(refused)).toEqual([403, 'NOT_PERMITTED', null]);
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toEqual([{ operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' }]);
  });

  it('the contract says it: the description of operation 91 names the rule, its 403 names the reason, and an example shows the answer', () => {
    const operation = CORE_API_OPERATIONS.find((entry) => entry.operationId === 'updateSttConfig');
    expect(operation?.description).toContain('WEB_CONSOLE_ONLY');
    expect(operation?.description).toMatch(/web console/i);
    expect(JSON.stringify(operation?.responses[403])).toContain('WEB_CONSOLE_ONLY');
    const examples = (CORE_API_EXAMPLES['updateSttConfig']?.responses[403] ?? {}) as Record<string, { value: unknown } | undefined>;
    const example = examples['webConsoleOnly'];
    expect(validateCoreApiResponse('updateSttConfig', 403, example?.value)).toEqual({ ok: true });
    expect(example?.value).toMatchObject({ error: { code: 'NOT_PERMITTED', details: { operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', reason: 'WEB_CONSOLE_ONLY' } } });
    // The access rule of the registry is unchanged (the condition is on the BODY, which stage 6 never reads): CAPTURE_CONFIG, no condition.
    expect(operation?.access).toEqual({ kind: 'PERMISSION', permission: 'CAPTURE_CONFIG' });
  });
});

describe('operation 90: the stored configuration, without any credential', () => {
  it('answers the seeded row in the contract shape', async () => {
    const stt = await build();
    stt.actAs(INVESTIGATOR);
    const body = (await stt.get()).json() as SttConfig;
    expect(body).toEqual({
      enabled: true,
      backend: 'cpu-local',
      model: 'ggml-large-v3-turbo',
      language: 'id',
      diarization: true,
      credentialSet: false,
      revision: 1,
      updatedAt: SEEDED_ROW.updated_at,
      pendingForNextSession: false,
    });
    expect(SttConfigSchema.safeParse(body).success).toBe(true);
  });

  it('a stored credential shows as credentialSet and credentialKind, and as nothing else', async () => {
    const stt = await build({
      row: { ...SEEDED_ROW, backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', credential_kind: 'ENCRYPTED', credential_ref: 'PLANTED_KEY_REF', secret_ciphertext: Buffer.alloc(40, 7), nonce: Buffer.alloc(12, 9), revision: 4, updated_by: 'OPR-003' },
    });
    stt.actAs(SUPERVISOR);
    const response = await stt.get();
    const body = response.json() as SttConfig;
    expect(body).toMatchObject({ credentialSet: true, credentialKind: 'ENCRYPTED', endpoint: 'http://127.0.0.1:9000', revision: 4, updatedBy: 'OPR-003' });
    expect(Object.keys(body).sort()).toEqual(
      ['backend', 'credentialKind', 'credentialSet', 'diarization', 'enabled', 'endpoint', 'language', 'model', 'pendingForNextSession', 'revision', 'updatedAt', 'updatedBy'].sort(),
    );
    expect(response.body).not.toContain('PLANTED_KEY_REF');
  });

  it('a table the seed never wrote answers 503 NOT_READY (STT_CONFIG_NOT_SEEDED), logged and persisted', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'row113-'));
    folders.push(folder);
    const errorLogFile = join(folder, 'error.log');
    const stt = await build({ row: null, errorLogFile });
    stt.actAs(SUPERVISOR);
    expect(outcome(await stt.get())).toEqual([503, 'NOT_READY', 'STT_CONFIG_NOT_SEEDED']);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, enabled: false }))).toEqual([503, 'NOT_READY', 'STT_CONFIG_NOT_SEEDED']);
    expect(stt.log.lines().some((line) => line['code'] === 'STT_CONFIG_NOT_SEEDED' && line['level'] === 50)).toBe(true);
    expect(readFileSync(errorLogFile, 'utf8')).toContain('"code":"STT_CONFIG_NOT_SEEDED"');
  });
});

describe('operation 91: the change, its audit row and when it applies', () => {
  it('stores the change, bumps the revision and writes ONE STT_CONFIG_CHANGED row with exactly the five keys', async () => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    const response = await stt.post(STT_PATH, { revision: 1, backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', model: 'whisper-large-v3-turbo', diarization: false });
    expect(response.statusCode).toBe(200);
    const body = response.json() as SttConfigUpdateResult;
    expect(validateCoreApiResponse('updateSttConfig', 200, body)).toEqual({ ok: true });
    expect(SttConfigUpdateResultSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      enabled: true,
      backend: 'omlx-server',
      endpoint: 'http://127.0.0.1:9000',
      model: 'whisper-large-v3-turbo',
      language: 'id',
      diarization: false,
      credentialSet: false,
      revision: 2,
      updatedBy: 'OPR-003',
      updatedAt: CLOCK_START,
      pendingForNextSession: false,
      appliesFrom: 'NOW',
    });
    expect(stt.db.row()).toMatchObject({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', revision: 2, updated_by: 'OPR-003', updated_at: CLOCK_START, credential_kind: null });
    // A change without a credential names no credential column at all.
    expect(stt.db.updates.map((update) => update.text)).toEqual([UPDATE_STT_CONFIG]);
    const rows = auditRowsOf(stt, 'STT_CONFIG_CHANGED');
    console.info(`[row113] M6-STTCFG-API audit detail | ${JSON.stringify(rows)}`);
    expect(rows).toEqual([{ changedFields: 'backend,endpoint,model,diarization', enabled: true, backend: 'omlx-server', credentialChanged: false, revision: 2 }]);
    expect(Object.keys(rows[0] ?? {})).toEqual(['changedFields', 'enabled', 'backend', 'credentialChanged', 'revision']);
    // The row names neither the endpoint nor the model: field NAMES only.
    expect(JSON.stringify(stt.db.auditInserts())).not.toContain('9000');
    expect(JSON.stringify(stt.db.auditInserts())).not.toContain('whisper-large');
    // The one log line of the change: names and facts, never a value of the body.
    const line = stt.log.lines().find((candidate) => candidate['code'] === 'STT_CONFIG_CHANGED');
    expect(line).toMatchObject({ changedFields: 'backend,endpoint,model,diarization', credentialChanged: false, revision: 2, appliesFrom: 'NOW' });
    expect(JSON.stringify(line)).not.toContain('9000');
  });

  it('an update that changes nothing sends no statement, writes no row and keeps the revision', async () => {
    const stt = await build();
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_PATH, { revision: 1, enabled: true, language: 'id', model: SEEDED_ROW.model });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ revision: 1, appliesFrom: 'NOW' });
    expect(stt.db.updates).toEqual([]);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
  });

  it('the unit is one transaction of the pipeline: the lock, the update and the audit insert, then COMMIT', async () => {
    const stt = await build();
    stt.actAs(SUPERVISOR);
    const before = stt.db.standIn.statements.length;
    await stt.post(STT_PATH, { revision: 1, enabled: false });
    const sent = stt.db.standIn.statements.slice(before);
    expect(sent[0]).toMatch(/^BEGIN\b/);
    expect(sent.at(-1)).toBe('COMMIT');
    expect(sent.filter((text) => text.startsWith('insert into "audit_log" '))).toHaveLength(1);
    expect(STT_CONFIG_UNIT_LABEL).toBe('sttConfig.update');
    expect(stt.db.standIn.committed.auditSeqs).toEqual([1]);
  });
});

describe('operation 91: the refusals change nothing and write no row', () => {
  it.each([
    ['a LAN address', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://192.168.1.20:8000', backend: 'omlx-server' }],
    ['a public host name', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://stt.example.org/v1' }],
    ['loopback over TLS', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'https://127.0.0.1:9000' }],
    ['a host that only starts with the loopback address', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://127.0.0.1.evil.example:9000' }],
    ['credentials in the URL', 'ENDPOINT_NOT_LOOPBACK', { endpoint: `http://user:${SECRET}@127.0.0.1:9000` }],
    ['the wildcard address', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://0.0.0.0:9000' }],
    // Row 115 (D71; pair-76 N-9): the stricter rule of the transcriber, held before anything is stored.
    ['a loopback endpoint with a query', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://127.0.0.1:9000/v1?x=1', backend: 'omlx-server' }],
    ['a loopback endpoint with a fragment', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://127.0.0.1:9000/v1#top' }],
    ['a loopback endpoint with a backslash', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://127.0.0.1:9000/v1\\models' }],
    ['a loopback endpoint with white space', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://127.0.0.1:9000/v1 models' }],
    ['a loopback endpoint with a tab', 'ENDPOINT_NOT_LOOPBACK', { endpoint: 'http://127.0.0.1:9000/v1\tmodels' }],
    ['another language', 'LANGUAGE_NOT_SUPPORTED', { language: 'en' }],
    ['an unknown backend', 'BACKEND_UNKNOWN', { backend: 'cloud-stt' }],
  ] as const)('%s: 422 INVALID_INPUT with details.reason %s', async (_name, reason, change) => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    const response = await stt.post(STT_PATH, { revision: 1, ...change });
    console.info(`[row113] M6-STTCFG-API refusal | ${_name} -> ${response.statusCode} ${outcome(response)[1]} reason=${outcome(response)[2]}`);
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT', reason]);
    expect(validateCoreApiResponse('updateSttConfig', 422, response.json())).toEqual({ ok: true });
    expect(response.json().error.details).toEqual({ in: 'body', reason });
    // The refusal quotes nothing of the input.
    expect(response.body).not.toContain('192.168');
    expect(response.body).not.toContain(SECRET);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
    // Refused inside the unit: the transaction was rolled back, not committed.
    expect(stt.db.standIn.statements.at(-1)).toBe('ROLLBACK');
  });

  // Row 115: a control character in the endpoint. Refused by the text rule of the body or by the
  // endpoint rule, whichever meets it first: 422 either way, and nothing is stored.
  it.each([['NUL', '\u0000'], ['U+0001', '\u0001'], ['a line feed', '\n'], ['DEL', '\u007f'], ['a C1 control', '\u0085']] as const)('a loopback endpoint with %s: 422 INVALID_INPUT, nothing stored', async (_name, character) => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    const response = await stt.post(STT_PATH, { revision: 1, backend: 'omlx-server', endpoint: `http://127.0.0.1:9000/v1${character}models` });
    expect(outcome(response).slice(0, 2)).toEqual([422, 'INVALID_INPUT']);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
    // Control: the same endpoint without the character is stored.
    const accepted = await stt.post(STT_PATH, { revision: 1, backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000/v1/models' });
    expect(accepted.statusCode).toBe(200);
  });

  it('the server backend without an endpoint, a body without its revision, an unknown member: 422, unnamed', async () => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, backend: 'omlx-server' }))).toEqual([422, 'INVALID_INPUT', null]);
    expect(outcome(await stt.post(STT_PATH, { enabled: false }))).toEqual([422, 'INVALID_INPUT', null]);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, apiKey: SECRET }))).toEqual([422, 'INVALID_INPUT', null]);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, credential: { kind: 'PLAIN', value: SECRET } }))).toEqual([422, 'INVALID_INPUT', null]);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, credential: { kind: 'REFERENCE', ref: `Bearer ${SECRET}` } }))).toEqual([422, 'INVALID_INPUT', null]);
    expect(stt.db.updates).toEqual([]);
  });

  // Fix round 1 (controller ruling): the model is an identifier, never a file name or a path.
  it.each([
    ['a path', 'models/ggml-large-v3-turbo'],
    ['a parent path', '../../etc/passwd'],
    ['a leading dash', '-ng'],
    ['a file name', 'ggml-large-v3-turbo.bin'],
    ['white space', 'ggml large'],
    ['NUL', 'ggml\u0000large'],
    ['a line break', 'ggml\nlarge'],
    ['129 characters', 'a'.repeat(129)],
  ])('a model that is %s: 422 INVALID_INPUT, nothing stored, no row', async (_name, model) => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    const response = await stt.post(STT_PATH, { revision: 1, model });
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT', null]);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
  });

  it('the seeded model id and the ids in use are accepted', async () => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    expect(isSttModelId(SEEDED_ROW.model)).toBe(true);
    let revision = 1;
    for (const model of ['whisper-large-v3-turbo', 'mlx-community--whisper-large-v3-turbo-asr-fp16', SEEDED_ROW.model]) {
      const response = await stt.post(STT_PATH, { revision, model });
      expect(response.statusCode, model).toBe(200);
      revision = (response.json() as SttConfigUpdateResult).revision;
    }
    expect(stt.db.row()?.model).toBe(SEEDED_ROW.model);
  });

  it('a stale revision: 409 INVALID_STATE (REVISION_CONFLICT) with the current revision, nothing stored', async () => {
    const stt = await build();
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_PATH, { revision: 7, enabled: false });
    expect(outcome(response)).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    expect(response.json().error.details).toEqual({ reason: 'REVISION_CONFLICT', currentRevision: 1 });
    expect(validateCoreApiResponse('updateSttConfig', 409, response.json())).toEqual({ ok: true });
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    // The second writer of a race is refused the same way: the first one took revision 1.
    expect((await stt.post(STT_PATH, { revision: 1, enabled: false })).statusCode).toBe(200);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, diarization: false }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toHaveLength(1);
  });
});

describe('next session: a change stored while a session is open applies to the next one', () => {
  it('idle: appliesFrom NOW. A session open: the write is accepted, appliesFrom NEXT_SESSION, pendingForNextSession true', async () => {
    const stt = await build();
    stt.actAs(SUPERVISOR);
    const idle = (await stt.post(STT_PATH, { revision: 1, diarization: false })).json() as SttConfigUpdateResult;
    expect([idle.appliesFrom, idle.pendingForNextSession]).toEqual(['NOW', false]);

    // A session opens one minute later; the configuration it started with is revision 2.
    stt.clock.advance(60_000);
    stt.db.setSessionOpenedAt(stt.clock.now());
    expect(((await stt.get()).json() as SttConfig).pendingForNextSession).toBe(false);

    stt.clock.advance(5_000);
    const response = await stt.post(STT_PATH, { revision: 2, enabled: false });
    const body = response.json() as SttConfigUpdateResult;
    console.info(`[row113] M6-STTCFG-API next-session | status=${response.statusCode} appliesFrom=${body.appliesFrom} pendingForNextSession=${body.pendingForNextSession} revision=${body.revision}`);
    // Accepted, not refused: the selector's 409 CAPTURE_CONFIG_LOCKED does not apply to this operation.
    expect(response.statusCode).toBe(200);
    expect([body.appliesFrom, body.pendingForNextSession, body.enabled, body.revision]).toEqual(['NEXT_SESSION', true, false, 3]);
    expect(stt.db.row()).toMatchObject({ enabled: false, revision: 3 });
    expect(((await stt.get()).json() as SttConfig).pendingForNextSession).toBe(true);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toHaveLength(2);
    expect(stt.log.lines().filter((line) => line['code'] === 'STT_CONFIG_CHANGED').map((line) => line['appliesFrom'])).toEqual(['NOW', 'NEXT_SESSION']);

    // The session ends: nothing is pending any more, and the next change applies at once.
    stt.db.setSessionOpenedAt(null);
    expect(((await stt.get()).json() as SttConfig).pendingForNextSession).toBe(false);
    expect(((await stt.post(STT_PATH, { revision: 3, enabled: true })).json() as SttConfigUpdateResult).appliesFrom).toBe('NOW');
  });
});

describe('the credential is write-only', () => {
  it('REFERENCE: stored as a pointer; the answer says REFERENCE and never the pointer', async () => {
    const stt = await build();
    stt.actAs(TECHNICIAN);
    const response = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'REFERENCE', ref: REFERENCE } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ credentialSet: true, credentialKind: 'REFERENCE', revision: 2 });
    expect(response.body).not.toContain(REFERENCE);
    expect(stt.db.row()).toMatchObject({ credential_kind: 'REFERENCE', credential_ref: REFERENCE, secret_ciphertext: null, nonce: null });
    expect(stt.db.updates.map((update) => update.text)).toEqual([UPDATE_STT_CONFIG_WITH_CREDENTIAL]);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([{ changedFields: 'credential', enabled: true, backend: 'cpu-local', credentialChanged: true, revision: 2 }]);
  });

  it('SECRET without a credential store: 503 NOT_READY (CREDENTIAL_STORE_NOT_READY), nothing stored in any form', async () => {
    const stt = await build();
    stt.actAs(SUPERVISOR);
    expect(stt.control.hasCredentialSealer()).toBe(false);
    const response = await stt.post(STT_PATH, { revision: 1, enabled: false, credential: { kind: 'SECRET', value: SECRET } });
    expect(outcome(response)).toEqual([503, 'NOT_READY', 'CREDENTIAL_STORE_NOT_READY']);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
  });

  it('SECRET with a sealer: only AES-256-GCM ciphertext, its nonce and a key reference are stored; the answer says ENCRYPTED', async () => {
    const stt = await build();
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: SECRET } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ credentialSet: true, credentialKind: 'ENCRYPTED', revision: 2 });
    const row = stt.db.row();
    expect(row).toMatchObject({ credential_kind: 'ENCRYPTED', credential_ref: 'TEST_STT_KEY_1' });
    expect(row?.nonce?.byteLength).toBe(12);
    expect(row?.secret_ciphertext?.byteLength).toBe(Buffer.byteLength(SECRET) + 16);
    // What went to the UPDATE holds no plaintext, in any encoding a careless write would use.
    const sent = stt.db.updates[0]?.values ?? [];
    for (const value of sent) {
      const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
      expect(bytes.includes(Buffer.from(SECRET))).toBe(false);
      expect(bytes.toString('latin1')).not.toContain(Buffer.from(SECRET).toString('base64'));
    }
    // And it is a real envelope of that secret: the holder of the key opens it.
    expect(sealer.open({ ciphertext: row?.secret_ciphertext ?? Buffer.alloc(0), nonce: row?.nonce ?? Buffer.alloc(0) })).toBe(SECRET);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([{ changedFields: 'credential', enabled: true, backend: 'cpu-local', credentialChanged: true, revision: 2 }]);
  });

  it('a sealer that does not seal is refused: 500, nothing stored, the plaintext never sent to the table', async () => {
    const stt = await build();
    stt.control.provideCredentialSealer({ seal: async (plaintext) => ({ keyRef: 'TEST_STT_KEY_1', ciphertext: new Uint8Array(Buffer.from(`${plaintext}-padding-to-17-bytes`)), nonce: new Uint8Array(12) }) });
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: SECRET } });
    expect(outcome(response)).toEqual([500, 'INTERNAL_ERROR', null]);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(response.body).not.toContain(SECRET);
    expect(stt.log.text()).not.toContain(SECRET);
  });

  // Row 115, finding F-115-1: the search for the plaintext in the envelope is made from 8 bytes on.
  // A real envelope holds any ONE given byte about once in four times; that is no unsealed secret.
  it('an envelope that happens to hold the byte of a one-character secret is stored (200); from 8 bytes on, a plaintext inside the envelope is refused', async () => {
    const envelopeWith = (inside: string) => ({ keyRef: 'TEST_STT_KEY_2', ciphertext: new Uint8Array(Buffer.concat([Buffer.alloc(40, 0xa5), Buffer.from(inside, 'utf8'), Buffer.alloc(40, 0x5a)])), nonce: new Uint8Array(12) });
    for (const [value, expected] of [['k', 200], ['seven77', 200], ['eight888', 500]] as const) {
      const stt = await build();
      stt.control.provideCredentialSealer({ seal: async (plaintext) => envelopeWith(plaintext) });
      stt.actAs(SUPERVISOR);
      const response = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value } });
      expect(response.statusCode, value).toBe(expected);
      expect(stt.db.updates.length, value).toBe(expected === 200 ? 1 : 0);
    }
  });

  it('CLEAR removes a stored credential; a second CLEAR changes nothing', async () => {
    const stt = await build({ row: { ...SEEDED_ROW, credential_kind: 'REFERENCE', credential_ref: REFERENCE, revision: 2 } });
    stt.actAs(TECHNICIAN);
    const cleared = await stt.post(STT_PATH, { revision: 2, credential: { kind: 'CLEAR' } });
    expect(cleared.json()).toMatchObject({ credentialSet: false, revision: 3 });
    expect('credentialKind' in (cleared.json() as object)).toBe(false);
    expect(stt.db.row()).toMatchObject({ credential_kind: null, credential_ref: null, secret_ciphertext: null, nonce: null });
    const again = await stt.post(STT_PATH, { revision: 3, credential: { kind: 'CLEAR' } });
    expect(again.json()).toMatchObject({ credentialSet: false, revision: 3 });
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([{ changedFields: 'credential', enabled: true, backend: 'cpu-local', credentialChanged: true, revision: 3 }]);
  });
});

// ── Operation 92 against a fake STT server on an ephemeral loopback port ───────────────────────

interface FakeStt {
  readonly endpoint: string;
  readonly requests: Array<{ method: string; url: string; headers: Record<string, unknown>; bodyBytes: number }>;
}

/** A stand-in STT backend: answers a model list on `/v1/models`. It is not oMLX and is never on port 8000. */
async function fakeSttServer(models: readonly string[], status = 200): Promise<FakeStt> {
  const requests: FakeStt['requests'] = [];
  const server = createServer((request, response) => {
    let bodyBytes = 0;
    request.on('data', (chunk: Buffer) => void (bodyBytes += chunk.byteLength));
    request.on('end', () => {
      requests.push({ method: request.method ?? '', url: request.url ?? '', headers: { ...request.headers }, bodyBytes });
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: models.map((id) => ({ id })) }));
    });
  });
  servers.push(server);
  // A sandbox that forbids loopback binding fails here at once (EPERM), not at the test's time limit.
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  expect(port).not.toBe(8000);
  return { endpoint: `http://127.0.0.1:${port}`, requests };
}

/** A loopback probe for the tests, of the shape the runtime row provides: one GET of the model list. */
const loopbackProbe: SttConnectionProbe = async (target, { signal }) => {
  if (target.endpoint === null) return { reachable: false, modelAvailable: false, detailCode: 'NO_ENDPOINT' };
  try {
    const response = await fetch(`${target.endpoint}/v1/models`, { signal });
    if (!response.ok) return { reachable: true, modelAvailable: false, detailCode: response.status === 401 ? 'CREDENTIAL_REJECTED' : 'BACKEND_ERROR' };
    const listed = ((await response.json()) as { data?: Array<{ id?: string }> }).data?.map((model) => model.id) ?? [];
    return listed.includes(target.model) ? { reachable: true, modelAvailable: true, detailCode: 'OK' } : { reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' };
  } catch {
    return { reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' };
  }
};

const serverRow = (endpoint: string, model = 'whisper-large-v3-turbo') => ({ ...SEEDED_ROW, backend: 'omlx-server', endpoint, model, credential_kind: 'REFERENCE', credential_ref: REFERENCE, revision: 2 });

describe('operation 92: a test of the stored configuration through the provided probe', () => {
  it('no probe provided: 503 NOT_READY with details.reason TRANSCRIBER_NOT_READY', async () => {
    const stt = await build();
    stt.actAs(SUPERVISOR);
    expect(stt.control.hasProbe()).toBe(false);
    const response = await stt.post(STT_TEST_PATH);
    expect(outcome(response)).toEqual([503, 'NOT_READY', 'TRANSCRIBER_NOT_READY']);
  });

  it('a fake backend on loopback that has the model: reachable and modelAvailable; ONE GET of the model list, no body, no audit row', async () => {
    const fake = await fakeSttServer(['whisper-large-v3-turbo', 'other']);
    const stt = await build({ row: serverRow(fake.endpoint) });
    const seen: SttProbeTarget[] = [];
    stt.control.provideProbe((target, options) => {
      seen.push(target);
      return loopbackProbe(target, options);
    });
    stt.actAs(TECHNICIAN);
    const response = await stt.post(STT_TEST_PATH);
    const body = response.json() as SttConnectionTest;
    console.info(`[row113] M6-STTCFG-API test-connection | fake=${fake.endpoint.replace(/:\d+$/, ':<ephemeral>')} status=${response.statusCode} ${JSON.stringify(body)} requests=${fake.requests.length}`);
    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ reachable: true, modelAvailable: true, backend: 'omlx-server', detailCode: 'OK' });
    expect(validateCoreApiResponse('testSttConnection', 200, body)).toEqual({ ok: true });
    expect(SttConnectionTestSchema.safeParse(body).success).toBe(true);
    // One loopback request: a GET of the model list. No audio, no body at all.
    expect(fake.requests.map((request) => `${request.method} ${request.url} ${request.bodyBytes}`)).toEqual(['GET /v1/models 0']);
    // The probe was handed the stored configuration and nothing of the credential but its kind.
    expect(seen).toEqual([{ enabled: true, backend: 'omlx-server', endpoint: fake.endpoint, model: 'whisper-large-v3-turbo', credentialKind: 'REFERENCE' }]);
    expect(JSON.stringify(seen)).not.toContain(REFERENCE);
    // No state change, no audit row; the outcome is kept for operation 90.
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.auditInserts()).toEqual([]);
    expect(((await stt.get()).json() as SttConfig).lastTest).toEqual({ reachable: true, modelAvailable: true, testedAt: CLOCK_START });
  });

  it('the backend answers but lacks the model: reachable, modelAvailable false', async () => {
    const fake = await fakeSttServer(['some-other-model']);
    const stt = await build({ row: serverRow(fake.endpoint) });
    stt.control.provideProbe(loopbackProbe);
    stt.actAs(SUPERVISOR);
    expect((await stt.post(STT_TEST_PATH)).json()).toEqual({ reachable: true, modelAvailable: false, backend: 'omlx-server', detailCode: 'MODEL_NOT_AVAILABLE' });
  });

  it('nothing listens on the stored endpoint: a 200 result with reachable false, not an HTTP error', async () => {
    const fake = await fakeSttServer(['whisper-large-v3-turbo']);
    const server = servers.pop();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    const stt = await build({ row: serverRow(fake.endpoint) });
    stt.control.provideProbe(loopbackProbe);
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_TEST_PATH);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reachable: false, modelAvailable: false, backend: 'omlx-server', detailCode: 'UNREACHABLE' });
    expect(((await stt.get()).json() as SttConfig).lastTest).toMatchObject({ reachable: false, modelAvailable: false });
  });

  it('a probe that throws: answered as unreachable, and the fault is logged and persisted by its code, never its message', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'row113-'));
    folders.push(folder);
    const errorLogFile = join(folder, 'error.log');
    const stt = await build({ errorLogFile });
    stt.control.provideProbe(async () => {
      throw Object.assign(new Error(`connect failed with key ${SECRET}`), { code: 'ECONNRESET' });
    });
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_TEST_PATH);
    expect(response.json()).toEqual({ reachable: false, modelAvailable: false, backend: 'cpu-local', detailCode: 'UNREACHABLE' });
    const persisted = readFileSync(errorLogFile, 'utf8');
    expect(persisted).toContain('"source":"sttConfig.testConnection"');
    expect(persisted).toContain('"code":"ECONNRESET"');
    expect(persisted).not.toContain(SECRET);
    expect(stt.log.text()).not.toContain(SECRET);
    expect(stt.log.lines().some((line) => line['code'] === 'ECONNRESET' && line['source'] === 'sttConfig.testConnection')).toBe(true);
  });

  it('a probe that never answers is cut off at the time limit: detailCode TIMEOUT, and its signal is aborted', async () => {
    const stt = await build();
    let aborted = false;
    stt.control.provideProbe(
      (_target, { signal, timeoutMs }) =>
        new Promise(() => {
          expect(timeoutMs).toBe(STT_TEST_TIMEOUT_MS);
          signal.addEventListener('abort', () => void (aborted = true));
        }),
    );
    stt.actAs(SUPERVISOR);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = stt.post(STT_TEST_PATH);
    await vi.advanceTimersByTimeAsync(STT_TEST_TIMEOUT_MS + 1);
    const response = await pending;
    vi.useRealTimers();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reachable: false, modelAvailable: false, backend: 'cpu-local', detailCode: 'TIMEOUT' });
    expect(aborted).toBe(true);
    expect(STT_TEST_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  // Fix round 1, navigator finding N-5: `lastTest` is the outcome of a test of ONE configuration.
  it('N-5: a change of what was tested (backend, endpoint, model or credential) forgets lastTest; a change of anything else keeps it', async () => {
    const stt = await build();
    stt.control.provideProbe(async () => ({ reachable: true, modelAvailable: true, detailCode: 'OK' }));
    stt.actAs(SUPERVISOR);
    const lastTest = async (): Promise<unknown> => ((await stt.get()).json() as SttConfig).lastTest;
    const tested = { reachable: true, modelAvailable: true, testedAt: CLOCK_START };
    let revision = 1;
    const change = async (body: Record<string, unknown>): Promise<SttConfigUpdateResult> => {
      const answer = (await stt.post(STT_PATH, { revision, ...body })).json() as SttConfigUpdateResult;
      revision = answer.revision;
      return answer;
    };

    await stt.post(STT_TEST_PATH);
    expect(await lastTest()).toEqual(tested);
    // Not what the test tested: the outcome stands, also in the answer of the change itself.
    expect((await change({ diarization: false })).lastTest).toEqual(tested);
    expect((await change({ enabled: false })).lastTest).toEqual(tested);
    expect((await change({ enabled: false })).lastTest).toEqual(tested);
    expect(await lastTest()).toEqual(tested);

    for (const body of [{ model: 'another-model' }, { backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000' }, { endpoint: 'http://127.0.0.1:9001' }, { credential: { kind: 'REFERENCE', ref: REFERENCE } }]) {
      await stt.post(STT_TEST_PATH);
      expect(await lastTest(), JSON.stringify(Object.keys(body))).toEqual(tested);
      const answer = await change(body);
      expect('lastTest' in answer, JSON.stringify(Object.keys(body))).toBe(false);
      expect(await lastTest(), JSON.stringify(Object.keys(body))).toBeUndefined();
    }
    // A refused change forgets nothing.
    await stt.post(STT_TEST_PATH);
    expect(outcome(await stt.post(STT_PATH, { revision, backend: 'cloud-stt' }))[0]).toBe(422);
    expect(await lastTest()).toEqual(tested);
  });

  // Controller ruling on fix round 1: the race between the preview and the lock, made deterministic
  // with a hook of the stand-in (another writer commits right after the preview read answered).
  it('N-7: the row moves between the preview and the lock, the preview had refused the body and the lock would accept it: 409 REVISION_CONFLICT, nothing sealed, nothing stored', async () => {
    const stt = await build();
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    stt.actAs(SUPERVISOR);
    // The body is made from revision 2. The preview reads revision 1 (stale: nothing is sealed);
    // then another writer brings the row to revision 2, which is what the unit locks.
    stt.db.afterNextPoolRead((row) => {
      row.revision = 2;
      row.diarization = false;
    });
    const response = await stt.post(STT_PATH, { revision: 2, credential: { kind: 'SECRET', value: SECRET } });
    expect(outcome(response)).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    expect(response.json().error.details).toEqual({ reason: 'REVISION_CONFLICT', currentRevision: 2 });
    expect(sealer.sealed).toEqual([]);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toMatchObject({ revision: 2, credential_kind: null });
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED')).toEqual([]);
    expect(stt.db.standIn.statements.at(-1)).toBe('ROLLBACK');
    // The caller reads again and writes with what it read: accepted, sealed once.
    expect((await stt.post(STT_PATH, { revision: 2, credential: { kind: 'SECRET', value: SECRET } })).statusCode).toBe(200);
    expect(sealer.sealed).toHaveLength(1);
  });

  it('N-7: the opposite order - the preview accepts and seals, the row moves, the lock refuses the stale revision: 409, the envelope is dropped unstored', async () => {
    const stt = await build();
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    stt.actAs(SUPERVISOR);
    stt.db.afterNextPoolRead((row) => void (row.revision = 2));
    const response = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: SECRET } });
    expect(outcome(response)).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    expect(sealer.sealed).toHaveLength(1);
    expect(stt.db.updates).toEqual([]);
    expect(stt.db.row()).toMatchObject({ revision: 2, credential_kind: null, secret_ciphertext: null });
  });

  it('N-5: a test that was in flight while the configuration changed is not kept as lastTest of the new one', async () => {
    const stt = await build();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => void (release = resolve));
    stt.control.provideProbe(async () => (await held, { reachable: true, modelAvailable: true, detailCode: 'OK' }));
    stt.actAs(SUPERVISOR);
    const test = stt.post(STT_TEST_PATH);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await stt.post(STT_PATH, { revision: 1, model: 'another-model' })).statusCode).toBe(200);
    release?.();
    // The caller of the test gets the outcome of what it tested; operation 90 does not call it the last test of the stored model.
    expect((await test).json()).toMatchObject({ reachable: true });
    expect(((await stt.get()).json() as SttConfig).lastTest).toBeUndefined();
  });

  // Fix round 1, navigator finding N-6: the tests in waiting are bounded.
  it('N-6: at most STT_TEST_QUEUE_LIMIT tests wait; one more is answered 503 NOT_READY at once and never reaches the probe', async () => {
    const stt = await build();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => void (release = resolve));
    let calls = 0;
    stt.control.provideProbe(async () => {
      calls += 1;
      await held;
      return { reachable: true, modelAvailable: true, detailCode: 'OK' };
    });
    stt.actAs(TECHNICIAN);
    const waiting = Array.from({ length: STT_TEST_QUEUE_LIMIT }, () => stt.post(STT_TEST_PATH));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const over = await stt.post(STT_TEST_PATH);
    expect(outcome(over)).toEqual([503, 'NOT_READY', 'TRANSCRIBER_NOT_READY']);
    release?.();
    expect((await Promise.all(waiting)).map((answer) => answer.statusCode)).toEqual(Array.from({ length: STT_TEST_QUEUE_LIMIT }, () => 200));
    expect(calls).toBe(STT_TEST_QUEUE_LIMIT);
    // The room is free again.
    expect((await stt.post(STT_TEST_PATH)).statusCode).toBe(200);
  });

  // Fix round 1, navigator finding N-7: the sealer runs before the serial pipeline is entered.
  it('N-7: a SECRET is sealed outside the unit of work: while the sealer waits, another unit of the pipeline runs', async () => {
    const stt = await build();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => void (release = resolve));
    const sealer = testSealer();
    stt.control.provideCredentialSealer({ seal: async (plaintext) => (await held, sealer.seal(plaintext)) });
    stt.actAs(SUPERVISOR);
    const secret = stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: SECRET } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Another unit (an audited refusal of stage 6) commits while the sealer is still waiting.
    stt.actAs(INVESTIGATOR);
    const refused = await Promise.race([stt.post(STT_TEST_PATH), new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000))]);
    expect(refused?.statusCode).toBe(403);
    expect(stt.db.updates).toEqual([]);
    release?.();
    expect((await secret).statusCode).toBe(200);
    expect(stt.db.row()?.credential_kind).toBe('ENCRYPTED');
  });

  it('one test at a time: a second call waits for the first, and a failed test does not block the next', async () => {
    const stt = await build();
    let running = 0;
    let most = 0;
    let calls = 0;
    stt.control.provideProbe(async () => {
      calls += 1;
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 15));
      running -= 1;
      if (calls === 1) throw new Error('first probe fails');
      return { reachable: true, modelAvailable: true, detailCode: 'OK' };
    });
    stt.actAs(SUPERVISOR);
    const answers = await Promise.all([stt.post(STT_TEST_PATH), stt.post(STT_TEST_PATH), stt.post(STT_TEST_PATH)]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200, 200]);
    expect(calls).toBe(3);
    expect(most).toBe(1);
    expect(answers.map((answer) => (answer.json() as SttConnectionTest).reachable).sort()).toEqual([false, true, true]);
  });
});

describe('secrecy: a planted credential reaches no response, no log line, no error-log entry and no audit row', () => {
  it('SECRET, REFERENCE and CLEAR writes, every refusal, a read and a test: 0 hits; the same search finds a planted value (negative control)', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'row113-'));
    folders.push(folder);
    const errorLogFile = join(folder, 'error.log');
    const fake = await fakeSttServer(['ggml-large-v3-turbo']);
    const stt = await build({ errorLogFile });
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    stt.control.provideProbe(loopbackProbe);

    // Refused by stage 6, with the credential in the body.
    stt.actAs(INVESTIGATOR);
    await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: SECRET } });
    await stt.post(STT_PATH, { revision: 1, credential: { kind: 'REFERENCE', ref: REFERENCE } });
    // Accepted writes, and every refusal of the operation itself, each with the credential in the body.
    stt.actAs(SUPERVISOR);
    await stt.post(STT_PATH, { revision: 1, backend: 'omlx-server', endpoint: fake.endpoint, credential: { kind: 'SECRET', value: SECRET } });
    await stt.get();
    await stt.post(STT_PATH, { revision: 2, credential: { kind: 'REFERENCE', ref: REFERENCE } });
    await stt.get();
    await stt.post(STT_TEST_PATH);
    await stt.post(STT_PATH, { revision: 99, credential: { kind: 'SECRET', value: SECRET } });
    await stt.post(STT_PATH, { revision: 3, backend: 'cloud-stt', credential: { kind: 'SECRET', value: SECRET } });
    await stt.post(STT_PATH, { revision: 3, endpoint: 'http://192.168.1.20:8000', credential: { kind: 'REFERENCE', ref: REFERENCE } });
    await stt.post(STT_PATH, { revision: 3, credential: { kind: 'SECRET', value: SECRET, extra: true } });
    await stt.post(STT_PATH, { revision: 3, credential: { kind: 'REFERENCE', ref: `${REFERENCE} with spaces` } });
    await stt.post(STT_PATH, { revision: 3, apiKey: SECRET });
    await stt.app.inject({ method: 'POST', url: STT_PATH, headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' }, payload: `{"revision":3,"credential":{"kind":"SECRET","value":"${SECRET}"` }).then((answer) => stt.answers.push(answer));
    await stt.post(STT_PATH, { revision: 3, credential: { kind: 'CLEAR' } });
    await stt.get();

    expect(stt.answers.map((answer) => answer.statusCode)).toEqual([403, 403, 200, 200, 200, 200, 200, 409, 422, 422, 422, 422, 422, 400, 200, 200]);
    const haystacks = haystacksOf(stt, readFileSync(errorLogFile, { encoding: 'utf8', flag: 'a+' }));
    const secretHits = hitsOf(haystacks, SECRET);
    const referenceHits = hitsOf(haystacks, REFERENCE);
    const partialHits = hitsOf(haystacks, 'planted_ref');
    console.info(
      `[row113] M6-STTCFG-API credential grep | responses=${stt.answers.length} (${haystacks.responses.length} bytes) logLines=${stt.log.lines().length} (${haystacks.logs.length} bytes) errorLog=${haystacks.errorLog.length} bytes auditRows=${stt.db.auditInserts().length} (${haystacks.auditRows.length} bytes) | secret=${JSON.stringify(secretHits)} reference=${JSON.stringify(referenceHits)}`,
    );
    const none = { responses: 0, logs: 0, errorLog: 0, auditRows: 0, events: 0 };
    expect(secretHits).toEqual(none);
    expect(referenceHits).toEqual(none);
    expect(partialHits).toEqual(none);
    // The base64 and hex forms of the secret, too: a careless encoder would write one of them.
    expect(hitsOf(haystacks, Buffer.from(SECRET).toString('base64'))).toEqual(none);
    expect(hitsOf(haystacks, Buffer.from(SECRET).toString('hex'))).toEqual(none);
    // The search covered something: the log holds the lines of these requests, the audit the rows.
    expect(stt.log.lines().length).toBeGreaterThan(16);
    expect(auditRowsOf(stt, 'STT_CONFIG_CHANGED').map((row) => row['changedFields'])).toEqual(['backend,endpoint,credential', 'credential', 'credential']);
    expect(auditRowsOf(stt, 'ACCESS_DENIED')).toHaveLength(2);
    // The only places the two values went: the sealer (plaintext in, ciphertext out) and the UPDATE of the pointer.
    expect(sealer.sealed).toHaveLength(1);
    expect(JSON.stringify(stt.db.updates).split(REFERENCE).length - 1).toBe(1);
    expect(JSON.stringify(stt.db.updates)).not.toContain(SECRET);
    // The backend that was "tested" was the fake one, with no credential in any header.
    expect(JSON.stringify(fake.requests)).not.toContain(SECRET);
    expect(fake.requests).toHaveLength(1);

    // NEGATIVE CONTROL: the same search, over the same captures, after the value WAS written to
    // each of them, finds it in each.
    stt.app.log.info({ note: `planted ${SECRET}` }, 'negative control');
    stt.app.errorLog.append({ level: 'warn', source: 'row113.negativeControl', message: 'negative control', context: { note: SECRET } });
    // N-8: the audit capture is planted THROUGH ITS CHANNEL too - a real unit of the pipeline whose
    // row (a type without a key list) holds the value, so the insert the stand-in receives holds it.
    await stt.app.pipeline.run('row113.negativeControl', async (unit) => {
      await unit.audit.append({ type: 'SYSTEM_BOOT', message: 'negative control', actorId: null, deviceId: null, details: { note: SECRET } });
    });
    // The event capture, through its channel: an event of the same unit kind, whose parameters hold the value.
    await stt.app.pipeline.run('row113.negativeControl.event', async (unit) => {
      await unit.events.append({ type: 'SYSTEM_BOOT', message: 'negative control', params: { note: SECRET } });
    });
    // The response capture, through its channel: a real answer of the server that holds the value.
    // An endpoint is not a secret and operation 90 returns it, so the value is stored as a path of
    // a loopback endpoint and read back - the same `answers` list every request above went into.
    const withPath = await stt.post(STT_PATH, { revision: ((await stt.get()).json() as SttConfig).revision, backend: 'omlx-server', endpoint: `http://127.0.0.1:9000/${SECRET}` });
    expect(withPath.statusCode).toBe(200);
    const planted = haystacksOf(stt, readFileSync(errorLogFile, 'utf8'));
    const control = hitsOf(planted, SECRET);
    console.info(`[row113] M6-STTCFG-API credential grep negative control | planted=${JSON.stringify(control)}`);
    // Every capture found what was planted THROUGH it. (The answer of the write and nothing else carries the endpoint.)
    expect(control).toEqual({ responses: 1, logs: 1, errorLog: 1, auditRows: 1, events: 1 });
  });
});
