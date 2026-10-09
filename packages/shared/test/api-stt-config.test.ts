// Task 3 M6, blueprint row 113 (R-8; decisions D20/D24): the STT configuration contract of
// operations 90-92 — check M6-STTCFG-API, shared half (masterplan/03_api_contract.md §2.5;
// masterplan/10_test_strategy.md §A.6a).
//
// | Clause of M6-STTCFG-API | Where it is held here |
// |---|---|
// | the registry entries equal C3 §2.5 (number, id, method, path, access, audit, mode) | "the registry" |
// | reads 90 for every role; 91/92 need CAPTURE_CONFIG (SUPERVISOR + TECHNICIAN) | "who may call" |
// | responses carry `credentialSet`/`credentialKind` only, never the credential | "the answer shape", "secrecy" |
// | `STT_CONFIG_CHANGED` detail = changed field names + `credentialChanged` | "the audit row" |
// | a non-loopback endpoint is refused 422 INVALID_INPUT (ENDPOINT_NOT_LOOPBACK) | "loopback only" |
// | a stored change applies to the NEXT session (`appliesFrom: NEXT_SESSION`) | "next session" |
//
// The Core server's half (the same clauses against the real route table, the logs and the stored
// rows) is apps/core-server/src/modules/stt-config/__tests__.
import { describe, expect, it } from 'vitest';
import {
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CoreApiAuditNone,
  STT_CONFIG_CHANGED_MESSAGE,
  STT_CONFIG_DEFAULT,
  STT_CONFIG_FIELDS,
  STT_CONFIG_OPERATIONS,
  STT_CREDENTIAL_REF_PATTERN,
  STT_LOOPBACK_ENDPOINT_PATTERN,
  STT_MODEL_ID_MAX_LENGTH,
  STT_MODEL_ID_PATTERN,
  SttConfigSchema,
  SttConfigUpdateRequestSchema,
  SttConfigUpdateResultSchema,
  SttConnectionTestSchema,
  createOpenApiDocument,
  describeCoreApiAccess,
  isSttConfigEndpoint,
  isSttLoopbackEndpoint,
  isSttModelId,
  planSttConfigUpdate,
  serializeOpenApiDocument,
  sttConfigChangedDetails,
  sttCredentialKindAfter,
  type SttConfig,
  type SttConfigStored,
  type SttConfigUpdateResult,
} from '../src/api';
import {
  AUDIT_TYPE_CATEGORY,
  AuditType,
  DEMO_OPERATOR_PASSWORD,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  createManualClock,
  createSim,
  type Sim,
} from '../src/sim';

const AT = Date.UTC(2031, 0, 1);
const PATH = '/api/v1/transcription/config';
const TEST_PATH = `${PATH}/test`;
/** Planted in requests only. Built from parts so that no other file of the repository holds it. */
const SECRET = ['stt', 'PLANTED', 'k3y', 'Zx9Qv7Lm2Rt5'].join('-');
const REFERENCE = ['omlx-settings', ['auth', 'planted_ref_Zx9Qv7'].join('.')].join(':');
const USERS = { INVESTIGATOR: 'budi.santoso', SUPERVISOR: 'andi.pratama', TECHNICIAN: 'rina.wijaya' } as const;

async function simAs(role: keyof typeof USERS | null): Promise<Sim> {
  const sim = createSim({ storage: null, authStorage: null, clock: createManualClock(AT), scheduler: () => () => {} });
  await sim.ready;
  if (role !== null) sim.actions.signIn(USERS[role], DEMO_OPERATOR_PASSWORD);
  return sim;
}

const get = (sim: Sim) => sim.request({ method: 'GET', path: PATH });
const post = (sim: Sim, body: unknown) => sim.request({ method: 'POST', path: PATH, body });
const test = (sim: Sim) => sim.request({ method: 'POST', path: TEST_PATH });
const outcome = (response: { status: number; body: unknown }): [number, string | undefined, string | undefined] => {
  const error = (response.body as { error?: { code?: string; details?: { reason?: string } } }).error;
  return [response.status, error?.code, error?.details?.reason];
};
const sttRows = (sim: Sim) => sim.store.getState().audit.rows.filter((row) => row.type === AuditType.STT_CONFIG_CHANGED);

const STORED: SttConfigStored = { ...STT_CONFIG_DEFAULT, credentialKind: null, revision: 3 };

describe('the registry: operations 90 to 92 as C3 §2.5 writes them', () => {
  it('number, id, method, path, tag, mode, access and audit', () => {
    const rows = STT_CONFIG_OPERATIONS.map((operation) => [
      Number(/operation (\d+)/.exec(operation.source)?.[1]),
      operation.operationId,
      operation.method,
      operation.path,
      operation.tag,
      operation.mode,
      describeCoreApiAccess(operation.access),
      operation.audit.success,
      operation.audit.denial,
    ]);
    expect(rows).toEqual([
      [90, 'getSttConfig', 'get', '/api/v1/transcription/config', 'Device', 'simulated', 'AUTHENTICATED', CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      [91, 'updateSttConfig', 'post', '/api/v1/transcription/config', 'Device', 'simulated', 'CAPTURE_CONFIG', 'STT_CONFIG_CHANGED', 'ACCESS_DENIED'],
      [92, 'testSttConnection', 'post', '/api/v1/transcription/config/test', 'Device', 'simulated', 'CAPTURE_CONFIG', CoreApiAuditNone.PARITY, 'ACCESS_DENIED'],
    ]);
    // They are entries 90 to 92 of the table, in number order (the five of the camera search, 93-97, follow: row 132).
    expect(CORE_API_OPERATIONS.slice(89, 92).map((operation) => operation.operationId)).toEqual(['getSttConfig', 'updateSttConfig', 'testSttConnection']);
  });

  it('the documented statuses are those of C3 §2.5; no operation documents a status of its own for the credential', () => {
    const statuses = Object.fromEntries(STT_CONFIG_OPERATIONS.map((operation) => [operation.operationId, Object.keys(operation.responses).map(Number)]));
    expect(statuses).toEqual({ getSttConfig: [200, 401, 403], updateSttConfig: [200, 400, 401, 403, 409, 422], testSttConnection: [200, 401, 403] });
    expect(STT_CONFIG_OPERATIONS[1].responses[422].description).toContain('ENDPOINT_NOT_LOOPBACK');
    expect(STT_CONFIG_OPERATIONS[1].responses[422].description).toContain('LANGUAGE_NOT_SUPPORTED');
    expect(STT_CONFIG_OPERATIONS[1].responses[422].description).toContain('BACKEND_UNKNOWN');
    expect(STT_CONFIG_OPERATIONS[2].description).toContain('TRANSCRIBER_NOT_READY');
  });

  it('STT_CONFIG_CHANGED is an audit type of category DEVICE (C3 §2.5), and CAPTURE_CONFIG is held by SUPERVISOR and TECHNICIAN only', () => {
    expect(AuditType.STT_CONFIG_CHANGED).toBe('STT_CONFIG_CHANGED');
    expect(AUDIT_TYPE_CATEGORY.STT_CONFIG_CHANGED).toBe('DEVICE');
    const holders = Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(Permission.CAPTURE_CONFIG));
    expect(holders.sort()).toEqual(['SUPERVISOR', 'TECHNICIAN']);
  });
});

describe('the answer shape: credentialSet and credentialKind, and no member for a credential', () => {
  const answer: SttConfig = { enabled: true, backend: 'cpu-local', model: 'm', language: 'id', diarization: true, credentialSet: true, credentialKind: 'ENCRYPTED', revision: 2, updatedAt: AT, pendingForNextSession: false };

  it('the three answer schemas are closed: a member that could carry a credential does not parse', () => {
    expect(SttConfigSchema.safeParse(answer).success).toBe(true);
    for (const extra of ['credential', 'credentialRef', 'credentialValue', 'apiKey', 'secret', 'value', 'ref', 'secretCiphertext', 'nonce', 'authorization']) {
      expect(SttConfigSchema.safeParse({ ...answer, [extra]: 'x' }).success, extra).toBe(false);
      expect(SttConfigUpdateResultSchema.safeParse({ ...answer, appliesFrom: 'NOW', [extra]: 'x' }).success, extra).toBe(false);
      expect(SttConnectionTestSchema.safeParse({ reachable: true, modelAvailable: true, backend: 'cpu-local', detailCode: 'OK', [extra]: 'x' }).success, extra).toBe(false);
    }
  });

  it('the keys of the answer are exactly those of C3 §2.5', () => {
    expect(Object.keys(SttConfigSchema.shape)).toEqual([
      'enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credentialSet', 'credentialKind', 'revision', 'updatedBy', 'updatedAt', 'pendingForNextSession', 'lastTest',
    ]);
    expect(Object.keys(SttConfigUpdateResultSchema.shape)).toEqual([...Object.keys(SttConfigSchema.shape), 'appliesFrom']);
    expect(Object.keys(SttConnectionTestSchema.shape)).toEqual(['reachable', 'modelAvailable', 'backend', 'detailCode']);
    expect(Object.keys(SttConfigUpdateRequestSchema.shape)).toEqual(['revision', 'enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credential']);
  });

  it('the credential of a request is a reference, a secret or CLEAR; a reference is a pointer, never free text', () => {
    const ok = (credential: unknown) => SttConfigUpdateRequestSchema.safeParse({ revision: 1, credential }).success;
    expect(ok({ kind: 'REFERENCE', ref: 'omlx-settings:auth.api_key' })).toBe(true);
    expect(ok({ kind: 'SECRET', value: SECRET })).toBe(true);
    expect(ok({ kind: 'CLEAR' })).toBe(true);
    expect(ok({ kind: 'CLEAR', value: SECRET })).toBe(false);
    expect(ok({ kind: 'REFERENCE', ref: 'a key with spaces' })).toBe(false);
    expect(ok({ kind: 'REFERENCE', ref: `Bearer ${SECRET}` })).toBe(false);
    expect(ok({ kind: 'PLAIN', value: SECRET })).toBe(false);
    expect(STT_CREDENTIAL_REF_PATTERN.test(REFERENCE)).toBe(true);
    // The update needs its revision, and takes no member it does not name.
    expect(SttConfigUpdateRequestSchema.safeParse({ enabled: false }).success).toBe(false);
    expect(SttConfigUpdateRequestSchema.safeParse({ revision: 1, apiKey: SECRET }).success).toBe(false);
  });

  it('no example and no line of either OpenAPI document holds a credential, a host of a third service or a pre-filled secret', () => {
    const examples = JSON.stringify([CORE_API_EXAMPLES.getSttConfig, CORE_API_EXAMPLES.updateSttConfig, CORE_API_EXAMPLES.testSttConnection]);
    expect(examples).not.toMatch(/"kind":"SECRET"/);
    expect(examples).not.toMatch(/"value":"[^"{]/);
    expect(examples).not.toMatch(/https?:\/\//);
    for (const scope of ['offline', 'all'] as const) {
      const text = serializeOpenApiDocument(createOpenApiDocument({ scope }));
      expect(text).toContain('/api/v1/transcription/config/test');
      expect(text).not.toContain(':8000');
    }
  });
});

describe('loopback only (OD-13): ENDPOINT_NOT_LOOPBACK', () => {
  it('accepts 127.0.0.1 and localhost over http with an optional port and path, and nothing else', () => {
    for (const endpoint of ['http://127.0.0.1', 'http://127.0.0.1:8000', 'http://localhost:9000/v1', 'http://127.0.0.1:1/', 'http://localhost']) {
      expect(isSttLoopbackEndpoint(endpoint), endpoint).toBe(true);
    }
    for (const endpoint of [
      'http://192.168.1.20:8000',
      'http://10.0.0.5/v1',
      'http://stt.example.org',
      'https://127.0.0.1:8000',
      'http://[::1]:8000',
      'http://127.0.0.1.evil.example',
      'http://localhost.evil.example:8000',
      'http://127.0.0.1@evil.example',
      'http://user:pass@127.0.0.1:8000',
      'http://127.0.0.1:0',
      'http://127.0.0.1:70000',
      'http://0.0.0.0:8000',
      'ftp://127.0.0.1',
      '127.0.0.1:8000',
      '',
    ]) {
      expect(isSttLoopbackEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  // Task 3 row 115 (D71; pair-76 N-9): the rule of the transcriber, held by operation 91 and by the simulator.
  it('refuses a loopback endpoint that holds `?`, `#`, a backslash, white space or a control character; the simulator answers 422', async () => {
    const refusedForms = [
      'http://127.0.0.1:8000/v1?x=1',
      'http://127.0.0.1:8000/v1#frag',
      'http://127.0.0.1:8000/v1\\models',
      'http://127.0.0.1:8000/v1 models',
      'http://127.0.0.1:8000/v1\tmodels',
      'http://127.0.0.1:8000/v1\nmodels',
      'http://127.0.0.1:8000/\u0000',
      'http://127.0.0.1:8000/\u007f',
      'http://localhost:8000/v1 ',
    ];
    for (const endpoint of refusedForms) expect(isSttConfigEndpoint(endpoint), JSON.stringify(endpoint)).toBe(false);
    // Positive control: the same address without the character is accepted, so the refusal is the character's.
    expect(isSttConfigEndpoint('http://127.0.0.1:8000/v1')).toBe(true);
    expect(isSttConfigEndpoint('http://localhost:8000/v1/models')).toBe(true);
    // Never laxer than the loopback form: what that refuses, this refuses.
    for (const endpoint of ['http://192.168.1.20:8000', 'https://127.0.0.1:8000', 'http://127.0.0.1:0', '']) expect(isSttConfigEndpoint(endpoint), endpoint).toBe(false);
    const sim = await simAs('TECHNICIAN');
    for (const endpoint of refusedForms) {
      const [status] = outcome(post(sim, { revision: 1, backend: 'omlx-server', endpoint }));
      expect(status, JSON.stringify(endpoint)).toBe(422);
    }
    expect(outcome(post(sim, { revision: 1, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000/v1?x=1' }))).toEqual([422, 'INVALID_INPUT', 'ENDPOINT_NOT_LOOPBACK']);
    expect((get(sim).body as SttConfig).revision).toBe(1);
    sim.stop();
  });

  it('the pattern is, character for character, the CHECK of the table (dbc-3 §B.13)', () => {
    expect(STT_LOOPBACK_ENDPOINT_PATTERN.source.replaceAll('\\/', '/')).toBe('^http://(127\\.0\\.0\\.1|localhost)(:[0-9]{1,5})?(/.*)?$');
  });

  it('the plan names the three refusals of C3 §2.5, the revision first', () => {
    const refused = (update: Record<string, unknown>) => {
      const plan = planSttConfigUpdate(STORED, SttConfigUpdateRequestSchema.parse({ revision: 3, ...update }));
      return plan.ok ? 'ok' : `${plan.status} ${plan.status === 422 ? plan.reason : plan.reason}`;
    };
    expect(refused({ endpoint: 'http://192.168.1.20:8000' })).toBe('422 ENDPOINT_NOT_LOOPBACK');
    expect(refused({ language: 'en' })).toBe('422 LANGUAGE_NOT_SUPPORTED');
    expect(refused({ backend: 'cloud' })).toBe('422 BACKEND_UNKNOWN');
    // The table's own rule: the server backend needs an endpoint. Refused before any statement, unnamed.
    expect(refused({ backend: 'omlx-server' })).toBe('422 null');
    expect(refused({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000' })).toBe('ok');
    expect(refused({ revision: 2, endpoint: 'http://192.168.1.20:8000' })).toBe('409 REVISION_CONFLICT');
  });
});

// Fix round 1 (controller ruling on the row-76 navigator's finding): the model is an IDENTIFIER.
describe('the model identifier: one shared pattern, used by operation 91', () => {
  const ACCEPTED = ['ggml-large-v3-turbo', 'whisper-large-v3-turbo', 'mlx-community--whisper-large-v3-turbo-asr-fp16', 'm', 'Model_1.5', 'a'.repeat(128)];
  const REFUSED: ReadonlyArray<readonly [string, string]> = [
    ['a path', 'models/ggml-large-v3-turbo'],
    ['a leading slash', '/ggml-large-v3-turbo'],
    ['a backslash path', 'models\\ggml'],
    ['a parent step', '..'],
    ['a parent step inside', 'ggml..large'],
    ['a parent path', '../../etc/passwd'],
    ['a leading dash (an option)', '-ng'],
    ['a leading dot', '.hidden'],
    ['a trailing dot (R-4: it would name the file `model..bin`)', 'model.'],
    ['a trailing dot after a version', 'ggml-large-v3.'],
    ['a file name', 'ggml-large-v3-turbo.bin'],
    ['a file name in capitals', 'ggml-large-v3-turbo.BIN'],
    ['white space inside', 'ggml large'],
    ['white space around', ' ggml-large-v3-turbo '],
    ['a line break', 'ggml\nlarge'],
    ['a tab', 'ggml\tlarge'],
    ['NUL', 'ggml\u0000large'],
    ['a control character', 'ggml\u0007large'],
    ['a shell character', 'ggml;rm'],
    ['a URL', 'http://127.0.0.1/model'],
    ['129 characters', 'a'.repeat(129)],
    ['nothing', ''],
  ];

  it('accepts the seeded default and every id in use', () => {
    expect(isSttModelId(STT_CONFIG_DEFAULT.model)).toBe(true);
    for (const model of ACCEPTED) {
      expect(isSttModelId(model), model).toBe(true);
      expect(SttConfigUpdateRequestSchema.safeParse({ revision: 1, model }).success, model).toBe(true);
    }
    expect(STT_MODEL_ID_MAX_LENGTH).toBe(128);
    expect(isSttModelId(42)).toBe(false);
  });

  it.each(REFUSED)('refuses %s: the predicate, the body schema, the shared rule and the simulator (422 INVALID_INPUT, nothing stored)', async (_name, model) => {
    expect(isSttModelId(model)).toBe(false);
    expect(SttConfigUpdateRequestSchema.safeParse({ revision: 1, model }).success).toBe(false);
    const plan = planSttConfigUpdate(STORED, { revision: STORED.revision, model });
    expect(plan.ok ? 'ok' : plan.status).toBe(422);
    const sim = await simAs('TECHNICIAN');
    expect(outcome(post(sim, { revision: 1, model }))).toEqual([422, 'INVALID_INPUT', undefined]);
    expect((get(sim).body as SttConfig).model).toBe(STT_CONFIG_DEFAULT.model);
    expect(sttRows(sim)).toEqual([]);
    sim.stop();
  });

  it('the OpenAPI document carries the pattern on the existing member: no new schema, the totals do not move', () => {
    const document = createOpenApiDocument({ scope: 'all' });
    const schema = document.components.schemas['SttConfigUpdateRequest'] as { properties: { model: { pattern?: string } } };
    expect(schema.properties.model.pattern).toBe(STT_MODEL_ID_PATTERN.source);
    // The totals after R-9..R-11 (row 132, D106; C3 §10.1): 158 -> 166 schemas, 92 -> 97 operations.
    expect(Object.keys(document.components.schemas)).toHaveLength(166);
    expect(CORE_API_OPERATIONS).toHaveLength(97);
  });
});

describe('the rule of an update: field names, and the credential by fact only', () => {
  it('lists the changed fields in the order of STT_CONFIG_FIELDS; an equal value is no change', () => {
    const plan = planSttConfigUpdate(STORED, { revision: 3, model: 'other', enabled: false, diarization: true, language: 'id' });
    expect(plan.ok && plan.changedFields).toEqual(['enabled', 'model']);
    expect(plan.ok && plan.credentialChanged).toBe(false);
    const none = planSttConfigUpdate(STORED, { revision: 3, enabled: true, model: STORED.model });
    expect(none.ok && none.changedFields).toEqual([]);
    expect(STT_CONFIG_FIELDS).toEqual(['enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credential']);
  });

  it('a REFERENCE or a SECRET always counts; CLEAR counts only when a credential is set', () => {
    const changed = (stored: SttConfigStored, credential: Parameters<typeof sttCredentialKindAfter>[1]) => {
      const plan = planSttConfigUpdate(stored, { revision: stored.revision, ...(credential === null ? {} : { credential }) });
      return plan.ok ? [plan.credentialChanged, plan.changedFields.join(','), sttCredentialKindAfter(stored.credentialKind, plan.credential)] : null;
    };
    expect(changed(STORED, { kind: 'SECRET', value: SECRET })).toEqual([true, 'credential', 'ENCRYPTED']);
    expect(changed(STORED, { kind: 'REFERENCE', ref: REFERENCE })).toEqual([true, 'credential', 'REFERENCE']);
    expect(changed(STORED, { kind: 'CLEAR' })).toEqual([false, '', null]);
    expect(changed({ ...STORED, credentialKind: 'REFERENCE' }, { kind: 'CLEAR' })).toEqual([true, 'credential', null]);
    expect(changed({ ...STORED, credentialKind: 'ENCRYPTED' }, null)).toEqual([false, '', 'ENCRYPTED']);
  });

  it('the audit details are exactly the five keys of C3 §2.5, flat, with names and flags only', () => {
    const details = sttConfigChangedDetails({ changedFields: ['enabled', 'endpoint', 'credential'], enabled: false, backend: 'omlx-server', credentialChanged: true, revision: 4 });
    expect(details).toEqual({ changedFields: 'enabled,endpoint,credential', enabled: false, backend: 'omlx-server', credentialChanged: true, revision: 4 });
    expect(Object.keys(details)).toEqual(['changedFields', 'enabled', 'backend', 'credentialChanged', 'revision']);
    for (const value of Object.values(details)) expect(['string', 'number', 'boolean']).toContain(typeof value);
  });
});

describe('who may call (the simulator, the same code path as Simulated mode)', () => {
  it('signed out: 401 on all three', async () => {
    const sim = await simAs(null);
    expect([get(sim).status, post(sim, { revision: 1, enabled: false }).status, test(sim).status]).toEqual([401, 401, 401]);
    sim.stop();
  });

  it('every role reads operation 90; INVESTIGATOR is refused 91 and 92 with 403 NOT_PERMITTED and nothing is stored', async () => {
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      const sim = await simAs(role);
      expect(get(sim).status, role).toBe(200);
      sim.stop();
    }
    const sim = await simAs('INVESTIGATOR');
    expect(outcome(post(sim, { revision: 1, enabled: false }))).toEqual([403, 'NOT_PERMITTED', undefined]);
    expect(outcome(test(sim))).toEqual([403, 'NOT_PERMITTED', undefined]);
    expect((get(sim).body as SttConfig).enabled).toBe(true);
    expect((get(sim).body as SttConfig).revision).toBe(1);
    expect(sttRows(sim)).toEqual([]);
    sim.stop();
  });

  it('SUPERVISOR and TECHNICIAN change and test it', async () => {
    for (const role of ['SUPERVISOR', 'TECHNICIAN'] as const) {
      const sim = await simAs(role);
      const changed = post(sim, { revision: 1, enabled: false });
      expect(changed.status, role).toBe(200);
      expect((changed.body as SttConfigUpdateResult).enabled).toBe(false);
      expect(test(sim).status, role).toBe(200);
      expect(sttRows(sim)).toHaveLength(1);
      sim.stop();
    }
  });
});

describe('the audit row and the refusals', () => {
  it('one STT_CONFIG_CHANGED row per change, with the five keys; none for a refusal or for an update that changes nothing', async () => {
    const sim = await simAs('TECHNICIAN');
    const operatorId = sim.store.getState().auth.operatorId;
    expect(outcome(post(sim, { revision: 1, endpoint: 'http://192.168.1.20:8000' }))).toEqual([422, 'INVALID_INPUT', 'ENDPOINT_NOT_LOOPBACK']);
    expect(outcome(post(sim, { revision: 1, language: 'en' }))).toEqual([422, 'INVALID_INPUT', 'LANGUAGE_NOT_SUPPORTED']);
    expect(outcome(post(sim, { revision: 1, backend: 'cloud' }))).toEqual([422, 'INVALID_INPUT', 'BACKEND_UNKNOWN']);
    expect(outcome(post(sim, { revision: 9, enabled: false }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    expect(outcome(post(sim, { revision: 1, enabled: true }))).toEqual([200, undefined, undefined]);
    expect(sttRows(sim)).toEqual([]);
    expect((get(sim).body as SttConfig).revision).toBe(1);

    const changed = post(sim, { revision: 1, backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', diarization: false, credential: { kind: 'SECRET', value: SECRET } });
    expect(changed.status).toBe(200);
    const rows = sttRows(sim);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(operatorId);
    // Fix round 1, navigator finding N-10: the simulator's row carries the message the Core server writes.
    expect(rows[0]?.message).toBe(STT_CONFIG_CHANGED_MESSAGE);
    expect(STT_CONFIG_CHANGED_MESSAGE).toBe('STT configuration changed');
    expect(rows[0]?.details).toEqual({ changedFields: 'backend,endpoint,diarization,credential', enabled: true, backend: 'omlx-server', credentialChanged: true, revision: 2 });
    expect(changed.body).toMatchObject({ revision: 2, credentialSet: true, credentialKind: 'ENCRYPTED', endpoint: 'http://127.0.0.1:9000', appliesFrom: 'NOW' });
    sim.stop();
  });
});

describe('next session: a change stored while a session is open applies to the next one', () => {
  it('idle: appliesFrom NOW; a session open: appliesFrom NEXT_SESSION and pendingForNextSession', async () => {
    const sim = await simAs('SUPERVISOR');
    const idle = post(sim, { revision: 1, diarization: false }).body as SttConfigUpdateResult;
    expect([idle.appliesFrom, idle.pendingForNextSession]).toEqual(['NOW', false]);

    const created = sim.request({ method: 'POST', path: '/api/v1/session', body: CORE_API_EXAMPLES.createSession!.request!.recordingScenario!.value });
    expect(created.status).toBe(201);
    // The open session started before the change below: the read does not yet call it pending.
    expect((get(sim).body as SttConfig).pendingForNextSession).toBe(false);
    const open = post(sim, { revision: 2, enabled: false });
    expect(open.status).toBe(200);
    const body = open.body as SttConfigUpdateResult;
    console.info(`[row113] M6-STTCFG-API next-session | status=${open.status} appliesFrom=${body.appliesFrom} pendingForNextSession=${body.pendingForNextSession} revision=${body.revision}`);
    expect([body.appliesFrom, body.pendingForNextSession, body.enabled, body.revision]).toEqual(['NEXT_SESSION', true, false, 3]);
    expect((get(sim).body as SttConfig).pendingForNextSession).toBe(true);
    // The write is NOT refused while a session is open (unlike the selector's 409 CAPTURE_CONFIG_LOCKED).
    expect(sttRows(sim)).toHaveLength(2);
    sim.stop();
  });
});

describe('secrecy: a planted credential reaches no answer and no audit row (with a negative control)', () => {
  it('SECRET, REFERENCE and CLEAR writes: 0 hits over every answer, the audit trail and the events', async () => {
    const sim = await simAs('SUPERVISOR');
    const seen: unknown[] = [];
    const keep = <T>(value: T): T => (seen.push(value), value);
    keep(post(sim, { revision: 1, credential: { kind: 'SECRET', value: SECRET } }));
    keep(get(sim));
    keep(post(sim, { revision: 2, credential: { kind: 'REFERENCE', ref: REFERENCE } }));
    keep(get(sim));
    keep(test(sim));
    // Refusals that carry the credential in their body, too.
    keep(post(sim, { revision: 99, credential: { kind: 'SECRET', value: SECRET } }));
    keep(post(sim, { revision: 3, backend: 'cloud', credential: { kind: 'SECRET', value: SECRET } }));
    keep(post(sim, { revision: 3, credential: { kind: 'SECRET', value: SECRET, extra: true } }));
    keep(post(sim, { revision: 3, credential: { kind: 'CLEAR' } }));
    keep(get(sim));
    const state = sim.store.getState();
    const haystack = JSON.stringify({ seen, audit: state.audit, events: state.events, alerts: state.alerts });
    const hits = (needle: string) => haystack.split(needle).length - 1;
    console.info(`[row113] M6-STTCFG-API credential grep (simulator) | answers=${seen.length} auditRows=${state.audit.rows.length} bytes=${haystack.length} secretHits=${hits(SECRET)} referenceHits=${hits(REFERENCE)}`);
    expect(hits(SECRET)).toBe(0);
    expect(hits(REFERENCE)).toBe(0);
    expect(hits('auth.planted')).toBe(0);
    expect(sttRows(sim).map((row) => row.details?.['changedFields'])).toEqual(['credential', 'credential', 'credential']);
    // Negative control: the same search finds the same value once it IS planted in an answer.
    const planted = JSON.stringify({ seen: [...seen, { body: { credential: SECRET } }], audit: state.audit });
    expect(planted.split(SECRET).length - 1).toBe(1);
    console.info(`[row113] M6-STTCFG-API credential grep negative control | plantedHits=${planted.split(SECRET).length - 1}`);
    sim.stop();
  });
});
