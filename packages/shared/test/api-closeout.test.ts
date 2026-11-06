// Plan row W83 (contract close-out): what the close-out added to the contract, held in place.
// Ledger: docs/2026-10-04_dems_backend_rbac_pairing/implementation/83_contract_closeout.md. Each block
// names the ledger row and the gap it closes; a later edit that takes a closing text back turns it red.
import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  AuditExportAcceptedSchema,
  BEARER_SECRET_PREFIXES,
  BIOMETRIC_TOKEN_LIFETIME_MS,
  BIOMETRIC_TOKEN_PATTERN,
  BIOMETRIC_TOKEN_PREFIX,
  BiometricEnrollmentSchema,
  BiometricTokenRefusalReason,
  CORE_API_EXAMPLES,
  CORE_API_SCHEMAS,
  CORE_API_OPERATIONS,
  DEVICE_CREDENTIAL_PATTERN,
  DEVICE_COMMAND_OPERATIONS,
  DEVICE_CREDENTIAL_PREFIX,
  DemoRebuildRefusalReason,
  HeartbeatSchema,
  MetersMessageSchema,
  PAIRING_CODE_LIFETIME_MS,
  PAIRING_CODE_MAX_FAILED_REDEEMS,
  PAIRING_QR_PAYLOAD_PATTERN,
  PAIRING_QR_PREFIX,
  PASSWORD_SESSION_REQUIRED_REASON,
  PairingCodeCloseReason,
  PairingCodeIssuedSchema,
  REALTIME_CLIENT_MESSAGES,
  REALTIME_CLOSE_CODES,
  REALTIME_SERVER_EXAMPLES,
  RealtimeCloseCode,
  ResyncMessageSchema,
  RoleMatrixSchema,
  SIM_ACTION_OPERATIONS,
  SESSION_TOKEN_PATTERN,
  SESSION_TOKEN_PREFIX,
  createOpenApiDocument,
  denialPermissionOf,
  deviceCommandOfOperation,
  findCoreApiOperation,
  permissionsOfDenialLabel,
  validateCoreApiEnvelopeResponse,
  validateCoreApiResponse,
  WsServerMessageSchema,
} from '../src/api';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { WEB_SESSION_REFUSED } from '../src/api/operation-parts';
import { en } from '../src/i18n';
import { VERIFY_NOTICE } from '../src/evidence-verify/types';

function operation(operationId: string) {
  const found = findCoreApiOperation(operationId);
  expect(found, operationId).toBeDefined();
  return found!;
}
const text403 = (operationId: string) => operation(operationId).responses[403]?.description ?? '';
const examples403 = (operationId: string) => CORE_API_EXAMPLES[operationId]?.responses[403] ?? {};
const errorOf = (value: unknown) => (value as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;

describe('W83 ledger rows 4 and 11: the prefixes and the numbers that were only words', () => {
  it('each bearer prefix is the literal head of its pattern, and the list holds the three (gap 4)', () => {
    expect(SESSION_TOKEN_PATTERN.source.startsWith(`^${SESSION_TOKEN_PREFIX}`)).toBe(true);
    expect(DEVICE_CREDENTIAL_PATTERN.source.startsWith(`^${DEVICE_CREDENTIAL_PREFIX}`)).toBe(true);
    expect(BIOMETRIC_TOKEN_PATTERN.source.startsWith(`^${BIOMETRIC_TOKEN_PREFIX}`)).toBe(true);
    expect([...BEARER_SECRET_PREFIXES]).toEqual(['ses_', 'dvc_', 'bio_']);
  });

  it('the pairing code constants are what the schema and the QR pattern say (gap W32-4)', () => {
    expect(PAIRING_CODE_LIFETIME_MS).toBe(300_000);
    expect(PAIRING_CODE_MAX_FAILED_REDEEMS).toBe(5);
    expect(PAIRING_QR_PAYLOAD_PATTERN.test(`${PAIRING_QR_PREFIX}123456`)).toBe(true);
    expect(PAIRING_QR_PAYLOAD_PATTERN.test('DEMS-PAIR:2:123456')).toBe(false);
    expect(PairingCodeIssuedSchema.shape.expiresAt.description).toContain('300 s');
    expect(PairingCodeIssuedSchema.shape.attemptsAllowed.description).toContain('5');
    const issued = CORE_API_EXAMPLES['issuePairingCode']?.responses[201];
    const value = Object.values(issued ?? {})[0]?.value as { issuedAt: number; expiresAt: number; attemptsAllowed: number; qrPayload: string };
    expect(value.expiresAt - value.issuedAt).toBe(PAIRING_CODE_LIFETIME_MS);
    expect(value.attemptsAllowed).toBe(PAIRING_CODE_MAX_FAILED_REDEEMS);
    expect(value.qrPayload.startsWith(PAIRING_QR_PREFIX)).toBe(true);
  });

  it('the close reasons of a pairing code are named once (gap W81-1)', () => {
    expect(Object.values(PairingCodeCloseReason)).toEqual(['EXPIRED', 'EXHAUSTED', 'CANCELLED']);
    expect(operation('cancelPairingCode').description).toContain('EXPIRED and EXHAUSTED');
    expect(operation('issuePairingCode').description).toContain('`details.reason: CANCELLED`');
  });

  it('the biometric token lifetime and the refusal reasons of a token (gap W41-1, gap W41-4)', () => {
    expect(BIOMETRIC_TOKEN_LIFETIME_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(BiometricEnrollmentSchema.shape.expiresAt.description).toContain('BIOMETRIC_TOKEN_LIFETIME_MS');
    const enabled = CORE_API_EXAMPLES['setBiometricEnrollment']?.responses[200]?.['enabled']?.value as { expiresAt: number };
    const signedIn = CORE_API_EXAMPLES['signInWithBiometric']?.responses[200]?.['signedIn']?.value as { session: { issuedAt: number } };
    expect(enabled.expiresAt - BIOMETRIC_TOKEN_LIFETIME_MS).toBe(signedIn.session.issuedAt);
    expect(Object.values(BiometricTokenRefusalReason)).toEqual([
      'TOKEN_REUSE',
      'USER_DISABLED',
      'TOKEN_REVOKED',
      'TOKEN_EXPIRED',
      'OTHER_DEVICE',
      'DEVICE_NOT_PAIRED',
    ]);
  });
});

describe('W83 ledger rows 8, 10, 28, 29, 39: refusal texts that now say what the server answers', () => {
  it('the failure that locks answers 423 itself: redeem and both sign-ins (gap W32-1, gap W41-3)', () => {
    const redeem = operation('redeemPairingCode').responses[423]?.description ?? '';
    expect(redeem).toContain('The failure that locks answers this too and writes PAIRING_FAILED');
    expect(redeem).toContain('writes PAIRING_LOCKED');
    for (const operationId of ['signIn', 'signInWithBiometric']) {
      const locked = operation(operationId).responses[423]?.description ?? '';
      expect(locked, operationId).toContain('it was verified and writes AUTH_FAILED');
      expect(locked, operationId).toContain('writes AUTH_LOCKED');
    }
  });

  it('a web console session on each of the five device-only operations is named, with its example (gap W32-3, gap W52-1)', () => {
    for (const operationId of ['getDeviceRegistration', 'unpairDevice', 'rotateDeviceCredential', 'signInWithBiometric', 'reportBiometricFailure']) {
      expect(text403(operationId), operationId).toContain("an operator's web console session called a device-only operation (DEVICE_NOT_PAIRED; no audit row)");
      const example = examples403(operationId)['webConsoleSession']?.value;
      expect(ApiErrorSchema.safeParse(example).success, operationId).toBe(true);
      expect(errorOf(example), operationId).toMatchObject({ code: 'DEVICE_NOT_PAIRED', message: 'This operation is available on a paired device only.' });
      expect(errorOf(example).details, operationId).toBeUndefined();
    }
    // A device retired while its request was in flight is answered without a row.
    expect(text403('listUsers')).toContain('none when the device was retired while the request was in flight');
  });

  it('operation 7 names the reason of a session that no password opened (gap W41-2)', () => {
    expect(PASSWORD_SESSION_REQUIRED_REASON).toBe('PASSWORD_SESSION_REQUIRED');
    expect(text403('setBiometricEnrollment')).toContain('`details.reason: PASSWORD_SESSION_REQUIRED`');
    const example = examples403('setBiometricEnrollment')['passwordSessionRequired']?.value;
    expect(errorOf(example)).toMatchObject({
      code: 'DEVICE_NOT_PAIRED',
      message: 'Sign in with your password to turn biometric sign-in on.',
      details: { reason: PASSWORD_SESSION_REQUIRED_REASON },
    });
  });

  it('a live token from another device is a reuse too (gap W41-5)', () => {
    expect(operation('signInWithBiometric').description).toContain('or a live one presented by another paired device');
    expect(REALTIME_SERVER_EXAMPLES['session.ended']?.['tokenReuse']?.summary).toContain('or a live one by another device');
  });
});

describe('W83 ledger rows 12, 14, 16: the session and evidence refusals', () => {
  it('the envelope names `sessionId`, and the session commands say the server\'s texts are fixed (gap W34-1, gap W34-3)', () => {
    const error = ApiErrorSchema.shape.error;
    expect(error.shape.details.description).toContain('`sessionId` (409 `SESSION_ACTIVE`');
    for (const operationId of ['createSession', 'startSession', 'stopSession']) {
      const all = operation(operationId).coreServerDescription ?? '';
      expect(all, operationId).toContain('"This session is not the open session."');
      expect(all, operationId).toContain('"The action is not allowed in the current state."');
      expect(all, operationId).toContain('`details.sessionId`');
      expect(operation(operationId).description, operationId).not.toContain('This session is not the open session.');
    }
  });

  it('the examples of the Core-only session operations quote no part of the request (gap W34-3)', () => {
    let seen = 0;
    for (const operationId of ['beginPrecheck', 'retryPrecheck', 'acknowledgePrecheckWarnings', 'cancelSession', 'recoverSession', 'addSessionMarker', 'addSessionNote', 'takeSessionSnapshot']) {
      for (const status of [404, 409]) {
        for (const [name, example] of Object.entries(CORE_API_EXAMPLES[operationId]?.responses[status] ?? {})) {
          const { code, message } = errorOf(example.value);
          if (code === 'NOT_FOUND') expect(message, `${operationId} ${status} ${name}`).toBe('This session is not the open session.');
          if (name === 'invalidState') expect(message, `${operationId} ${status} ${name}`).toBe('The action is not allowed in the current state.');
          expect(message, `${operationId} ${status} ${name}`).not.toMatch(/SES-\d{8}-\d{4}/);
          seen += 1;
        }
      }
    }
    expect(seen).toBeGreaterThan(8);
  });

  it('the 409 of an archive carries the transition (gap W35-1)', () => {
    const example = CORE_API_EXAMPLES['archiveEvidence']?.responses[409]?.['notSealed']?.value;
    expect(errorOf(example).details).toEqual({ simCode: 'UNSEALED_EVIDENCE', from: null, event: 'archiveEvidence' });
  });
});

describe('W83 ledger rows 6, 21 to 23, 26, 33 to 35, 75: description texts', () => {
  it('a cursor on a row the rebuilt chain does not hold is no cursor (gap W39-1)', () => {
    expect(operation('listAuditRows').responses[422]?.description).toContain('a cursor on a row that the chain rebuilt by a demo reset or a scenario load does not hold');
  });

  it('the audit export answer says which rows (gap W39-2)', () => {
    expect(AuditExportAcceptedSchema.shape.rows.description).toBe('Stored audit rows the export covers: every row before the AUDIT_EXPORTED row it wrote.');
    expect(AuditExportAcceptedSchema.shape.head.description).toBe('Hash of the last of those rows: the `prevHash` of the AUDIT_EXPORTED row.');
  });

  it('an alert of the kind AUDIT_TAMPER wrote AUDIT_CHAIN_DISCONTINUITY (gap W40-2)', () => {
    expect(operation('listAlerts').description).toContain('Every alert of a fault kind was raised by a fault');
    expect(operation('listAlerts').description).toContain('AUDIT_CHAIN_DISCONTINUITY for the kind AUDIT_TAMPER');
  });

  it('resync and meters say what the server does (gap W42-2, gap W42-3)', () => {
    expect(ResyncMessageSchema.description).toContain('one that comes sooner is answered when the 2 s have passed');
    expect(REALTIME_CLIENT_MESSAGES.find((entry) => entry.type === 'resync')?.effect).toContain('answered when the 2 s have passed');
    expect(MetersMessageSchema.shape.seq.description).toContain('It never goes back on a connection, also across a new epoch.');
  });

  it('a rebuild that cannot run names its reason (gap W43-1)', () => {
    expect(Object.values(DemoRebuildRefusalReason)).toEqual(['RESET_IN_PROGRESS', 'RESET_FAILED']);
    for (const operationId of ['loadScenario', 'resetDemo']) {
      expect(operation(operationId).description, operationId).toContain('`503 NOT_READY` with `details.reason`: `RESET_IN_PROGRESS`');
      expect(operation(operationId).description, operationId).toContain('`RESET_FAILED`');
    }
  });

  it('the grants of the role matrix are a set (gap 6)', () => {
    expect(RoleMatrixSchema.shape.grants.description).toContain('the order of the entries is not significant');
  });

  it('a refused export is still recorded and carries no revision headers (finding F-B2a-7)', () => {
    expect(operation('exportEvidence').coreServerDescription).toContain('A refused export is still recorded');
    expect(operation('exportEvidence').description).not.toContain('A refused export is still recorded');
    for (const operationId of ['exportAudit', 'exportLogs']) expect(operation(operationId).description, operationId).toContain('A refused export is still recorded');
  });
});

describe('W83 ledger rows 18, 25, 32: the envelope 400 and the close code 1009', () => {
  it('a body-less POST answering 400 INVALID_JSON validates; the routing 400 is still found by status alone (gap W36-1, gap W40-1)', () => {
    const invalidJson = { error: { code: 'INVALID_JSON', message: 'The request body must be a JSON object.', requestId: 'req-1' } };
    // Task 3 M2-W7 (C3 §3 op 48): restartDevice gained the optional `{ confirm }` body, so it is no
    // longer body-less; every other command here still answers 400 INVALID_JSON with no request body.
    for (const operationId of ['testDeviceSignal', 'identifyDevice', 'runDiagnostics', 'restartServices', 'startSoftwareUpdate', 'acknowledgeAlert', 'resetDemo', 'touchSession']) {
      expect(operation(operationId).requestBody, operationId).toBeUndefined();
      expect(validateCoreApiResponse(operationId, 400, invalidJson), operationId).toEqual({ ok: true });
      // Another code on that 400 is still refused.
      expect(validateCoreApiResponse(operationId, 400, { error: { code: 'INVALID_INPUT', message: 'x' } }).ok, operationId).toBe(false);
    }
    expect(validateCoreApiEnvelopeResponse(400, { error: { code: 'INVALID_PATH', message: 'The path is malformed.' } })).toEqual({ ok: true });
  });

  it('1009 closes a socket whose client sent a message over the limit (gap W42-1)', () => {
    expect(RealtimeCloseCode.MESSAGE_TOO_BIG).toBe(1009);
    expect(REALTIME_CLOSE_CODES.find((entry) => entry.code === 1009)?.reaction).toBe('Reconnect.');
  });
});

describe('W83 ledger rows 13 and 17: the all-scope text of a status (decision D184 DQ-1)', () => {
  const all = createOpenApiDocument({ scope: 'all' });
  const offline = createOpenApiDocument();
  const response = (document: typeof all, path: string, status: string) =>
    (document.paths[path]?.post?.responses?.[status] as { description: string } | undefined)?.description ?? '';

  it('stopSession and exportEvidence name INVALID_INPUT in the all scope; the offline text stays the baseline (gap W34-2, gap W35-2)', () => {
    for (const path of ['/api/v1/session/{id}/stop', '/api/v1/evidence/{id}/export']) {
      expect(response(all, path, '422'), path).toContain('INVALID_REASON');
      expect(response(all, path, '422'), path).toContain('INVALID_INPUT');
      expect(response(offline, path, '422'), path).toBe('The reason is shorter than 5 characters (INVALID_REASON).');
    }
    // Only those two statuses carry such a text.
    const carriers = CORE_API_OPERATIONS.flatMap((entry) =>
      Object.entries(entry.responses)
        .filter(([, spec]) => (spec as { coreServerDescription?: string }).coreServerDescription !== undefined)
        .map(([status]) => `${entry.operationId} ${status}`),
    );
    expect(carriers).toEqual(['stopSession 422', 'exportEvidence 422']);
  });
});

describe('W83 ledger row 3: which device command reaches which operation (gap 3)', () => {
  it('the table maps each of the four commands onto one of deviceCommand\'s three operations (POE_CYCLE rides restartDevice)', () => {
    // Task 3 M2-W7 (C3 §0; E-12): POE_CYCLE joins the enum and reaches restartDevice too — op 48
    // decides RESTART versus PoE cycle from the body and the camera's stream state (C3 §3 op 48).
    // Four commands, three operations: the value list holds restartDevice twice, so compare distinct.
    expect([...new Set(Object.values(DEVICE_COMMAND_OPERATIONS))].sort()).toEqual([...SIM_ACTION_OPERATIONS.deviceCommand.operations].sort());
    for (const [command, operationId] of Object.entries(DEVICE_COMMAND_OPERATIONS)) {
      const last = operation(operationId).path.split('/').at(-1)!.toUpperCase().replaceAll('-', '_');
      // Every command but POE_CYCLE has its own endpoint named after it; POE_CYCLE rides /restart.
      expect(last, command).toBe(command === 'POE_CYCLE' ? 'RESTART' : command);
    }
    // The reverse lookup returns the canonical command of an operation (RESTART for restartDevice).
    expect(deviceCommandOfOperation('restartDevice')).toBe('RESTART');
    expect(deviceCommandOfOperation('testDeviceSignal')).toBe('TEST_SIGNAL');
    expect(deviceCommandOfOperation('identifyDevice')).toBe('IDENTIFY');
    expect(deviceCommandOfOperation('getDeviceHealth')).toBeUndefined();
    expect(deviceCommandOfOperation('toString')).toBeUndefined();
  });
});

describe('W83 ledger rows 5 and 66: one spelling of the any-of for clients (gap 5, finding F64, ruling R-D1)', () => {
  it('the example says what the Core server sends, and every spelling maps to the same permissions', () => {
    const access = operation('setStoragePolicy').access!;
    expect(denialPermissionOf(access)).toBe('EVIDENCE_REVIEW_OR_MAINTENANCE');
    expect(errorOf(examples403('setStoragePolicy')['notPermitted']?.value).details).toMatchObject({ permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE' });
    for (const label of ['EVIDENCE_REVIEW_OR_MAINTENANCE', 'EVIDENCE_REVIEW | MAINTENANCE', 'ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)']) {
      expect(permissionsOfDenialLabel(label), label).toEqual(['EVIDENCE_REVIEW', 'MAINTENANCE']);
    }
    expect(permissionsOfDenialLabel('USER_ADMIN')).toEqual(['USER_ADMIN']);
    expect(permissionsOfDenialLabel('')).toEqual([]);
    expect(denialPermissionOf(operation('listUsers').access!)).toBe('USER_ADMIN');
    expect(denialPermissionOf(operation('getAuthSession').access!)).toBeNull();
  });
});

describe('W83 ledger row 64: KI-18', () => {
  it('no scope says that mock-core answers on a fixed origin with CORS for the dev origins; the offline text says where it answers', () => {
    for (const scope of ['offline', 'all'] as const) {
      const text = JSON.stringify(createOpenApiDocument({ scope }));
      expect(text, scope).not.toContain('CORS allows the web dev origins');
      expect(text, scope).not.toContain('served by mock-core on 127.0.0.1:4400');
    }
    const health = createOpenApiDocument().paths['/api/v1/health']?.get?.description ?? '';
    expect(health).toContain("on 127.0.0.1:4400 in a development run and on the page's own origin in a packaged build");
  });
});

describe('W83 ledger row 71: the answers of contract A are strict (finding W52-F2; decision D184 DQ-3 (a))', () => {
  it('the heartbeat stays the released, non-strict member of the union (ledger row 38 took fallback (b): a sentence in AC-B-46)', () => {
    const heartbeat = { type: 'heartbeat', v: 1, seq: 1, serverTime: '2026-10-01T03:00:00.000Z', uptimeMs: 1, intervalMs: 1000, clients: 1, sessionState: null };
    expect(WsServerMessageSchema.options).toContain(HeartbeatSchema);
    expect(WsServerMessageSchema.safeParse({ ...heartbeat, extra: 1 }).success).toBe(true);
  });

  it('every success answer of contract A refuses an unknown top-level member; the ten existing answers and the error body do not', () => {
    const strict = (name: string) => (CORE_API_SCHEMAS as Record<string, { _zod: { def: { catchall?: { _zod: { def: { type: string } } } } } }>)[name]?._zod.def.catchall?._zod.def.type === 'never';
    for (const name of ['SignInResponse', 'SignInStatus', 'AuthSessionInfo', 'AuthSessionExpiry', 'BiometricEnrollment', 'RoleMatrix', 'AdminUserList', 'AdminUser', 'PairingCodeIssued', 'ActivePairingCode', 'PairingRedeemed', 'PairedDeviceList', 'PairedDevice', 'DeviceRegistration', 'DeviceCredentialRotated', 'DemoStatus', 'DemoEpoch']) {
      expect(strict(name), name).toBe(true);
    }
    // Shared with mock-core and the released launcher, or pinned to the baseline: the residual of AC-B-10.
    for (const name of ['HealthResponse', 'SessionCommandResponse', 'CurrentSessionResponse', 'DeviceHealthResponse', 'AudioStatusResponse', 'VideoStatusResponse', 'StorageStatusResponse', 'EvidenceExportAccepted', 'ApiError', 'Heartbeat']) {
      expect(strict(name), name).toBe(false);
    }
  });
});

// FXR-W, Nits W92-20 and W92-24 of `verification/11_code_review_shared_web.md` (decision D242).
//
// | Nit | Held here |
// |-----|-----------|
// | W92-20: the unused key `apiReference.realtime.live.everySlice` is gone | "W92-20" |
// | W92-24: `WEB_SESSION_REFUSED` has one definition (`operation-parts.ts`), and the identity and pairing operations still carry its text | "W92-24" |
describe('W92-20: no dead key in the API Reference words', () => {
  it('`apiReference.realtime.live` has no `everySlice`', () => {
    expect(Object.keys(en.apiReference.realtime.live)).not.toContain('everySlice')
  })
})

describe('W92-24: one copy of the web-session refusal text', () => {
  it('defined once under src/api', () => {
    const dir = resolve(import.meta.dirname, '../src/api')
    const definers = readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => /const WEB_SESSION_REFUSED\s*=/.test(readFileSync(resolve(dir, name), 'utf8')))
    expect(definers).toEqual(['operation-parts.ts'])
  })

  it('the device-only operations of identity and pairing still name it in their 403', () => {
    const carrying = CORE_API_OPERATIONS.filter((operation) => JSON.stringify(operation).includes(WEB_SESSION_REFUSED)).map((operation) => operation.operationId)
    expect(carrying.length).toBeGreaterThanOrEqual(5)
  })
})

// Closing pass F-X, item 1: what the contract text says after the fix wave. Written RED.
//   op 41   the notice description names BOTH notices of a v2 result and the nullable key mark
//   op 33   `202` with state FINALIZING when the operation re-queues a failed seal (decision D186 (4))
//   ops 84 / 85 / 86 / 42 / 87   the case scope of REAL evidence, as op 88 states it (R93-02)
describe('the contract text after the fix wave', () => {
  const openapi = readFileSync(join(__dirname, '..', 'openapi', 'openapi.json'), 'utf8');

  describe('contract text of the closing pass', () => {
    it('operation 41: every notice code of the verifier is described, and `signature.developmentKey` is stated as nullable', () => {
      const schema = JSON.parse(openapi).components.schemas.EvidenceVerifyResult as { properties: { notices: { items: { properties: { code: { description: string } } } }; signature: { description: string } } };
      for (const code of Object.values(VERIFY_NOTICE)) expect(schema.properties.notices.items.properties.code.description, code).toContain(`\`${code}\``);
      expect(schema.properties.signature.description).toMatch(/`developmentKey` is nullable/);
    });

    it('operation 33: the description and the 202 name the FINALIZING answer of a re-queued seal', () => {
      const operation = findCoreApiOperation('recoverSession');
      expect(operation?.description).toContain('**FINALIZING**');
      expect(operation?.responses[202]?.description).toContain('FINALIZING');
    });

    it('the case scope of REAL evidence is stated on operations 84, 85, 86, 42 and 87 as on 88', () => {
      for (const id of ['getTranscript', 'createTranscriptRevision', 'listTranscriptRevisions', 'exportEvidence', 'getEvidenceExportJob', 'createEvidenceMediaSession']) {
        const operation = findCoreApiOperation(id);
        expect(`${operation?.description ?? ''}\n${operation?.coreServerDescription ?? ''}`, id).toContain('`details.reason: EVIDENCE_CASE_SCOPE`');
      }
    });
  });
});
