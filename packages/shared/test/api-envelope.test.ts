// Backend task 2026-10-04, plan row W19 (contract A): the error envelope (01_specs §7.2, §7.3).
// 15 new codes, the two additive optional members `details` and `requestId`, and the answers that
// are defined once for every operation instead of per operation.
import { describe, expect, it } from 'vitest';
import {
  ALLOW_HEADER_NAME,
  API_BODY_LIMIT_BYTES,
  API_ERROR_CODES,
  API_ERROR_CODE_PATTERN,
  ApiErrorCode,
  ApiErrorSchema,
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_OPERATIONS,
  CORE_SERVER_HOST,
  CORE_SERVER_HTTP_ORIGIN,
  CORE_SERVER_PORT,
  CORE_SERVER_SERVICE_NAME,
  CORE_SERVER_WS_URL,
  CREDENTIAL_CONFLICT_REASON,
  EPOCH_HEADER_NAME,
  REQUEST_ID_HEADER_NAME,
  RETRY_AFTER_HEADER_NAME,
  REVISION_HEADER_NAME,
  validateCoreApiEnvelopeResponse,
  validateCoreApiResponse,
  type ApiError,
} from '../src/api';
import { DEFAULT_REQUEST_ID_HEADER, EPOCH_HEADER, RETRY_AFTER_HEADER, REVISION_HEADER } from '../src/client';

/** The 16 codes of the document at the baseline commit, in its order (`core-api.ts:88` at acaff20). */
const BASELINE_CODES = [
  'INVALID_JSON', 'NOT_SIGNED_IN', 'NOT_PERMITTED', 'FORBIDDEN', 'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'SESSION_ACTIVE', 'INVALID_INPUT',
  'INVALID_STATE', 'PRECHECK_RUNNING', 'PRECHECK_WARNINGS', 'PRECHECK_BLOCKED', 'INVALID_REASON', 'NOT_SEALED', 'SECURITY_FAULT', 'SIMULATOR_ERROR',
];
/** The 15 new codes, in the order of 01_specs §7.2. */
const NEW_CODES = [
  'INVALID_PATH', 'INVALID_CREDENTIALS', 'INVALID_CODE', 'ORIGIN_NOT_ALLOWED', 'DEVICE_NOT_PAIRED', 'DEVICE_REVOKED', 'DEMO_DISABLED',
  'RECORDING_ACTIVE', 'COMMAND_UNSUPPORTED', 'LAST_ADMIN', 'PAYLOAD_TOO_LARGE', 'LOCKED', 'RATE_LIMITED', 'INTERNAL_ERROR', 'NOT_READY',
];
/** Task 3 M2-W7 (blueprint row 48; C3 §4): the nine capture-phase codes, 31 -> 40 (SEC35-22). */
const CAPTURE_CODES = [
  'CAPTURE_CONFIG_LOCKED', 'AUDIO_SOURCE_CONFLICT', 'CAMERA_NOT_LOST', 'TRANSCRIPT_NOT_READY', 'TRANSCRIPT_REVISION_CONFLICT',
  'EXPORT_IN_PROGRESS', 'MEDIA_NOT_AVAILABLE', 'RESET_BLOCKED_REAL_EVIDENCE', 'TRANSCRIPT_AUDIO_UNAVAILABLE',
];
/** Audit row 143 (D5; D28 DQ-2; register N-36): op 81 retired, 40 -> 41. */
const PAIRING_CODES = ['AUDIO_SOURCE_FIXED_BY_PAIRING'];

const envelope = (code: string, extra: Partial<ApiError['error']> = {}): ApiError => ({ error: { code, message: 'refused', ...extra } });

describe('the code list grows from 16 to 41', () => {
  it('the 16 baseline codes come first and unchanged, then the 15 of the Core server, then the 9 of task 3, then the 1 of D5', () => {
    expect(API_ERROR_CODES).toEqual([...BASELINE_CODES, ...NEW_CODES, ...CAPTURE_CODES, ...PAIRING_CODES]);
    expect(API_ERROR_CODES).toHaveLength(41);
    expect(new Set(API_ERROR_CODES).size).toBe(41);
    for (const [key, code] of Object.entries(ApiErrorCode)) {
      expect(key).toBe(code);
      expect(code).toMatch(API_ERROR_CODE_PATTERN);
    }
  });

  it('`code` stays a pattern-checked string, so a code outside the list still parses', () => {
    for (const code of [...API_ERROR_CODES, 'TIMEOUT', 'NETWORK', 'CONTRACT_VIOLATION', 'SOMETHING_NEW']) {
      expect(ApiErrorSchema.safeParse(envelope(code)).success, code).toBe(true);
    }
    for (const code of ['lower_case', '9_STARTS_WITH_DIGIT', '', 'HAS SPACE']) {
      expect(ApiErrorSchema.safeParse(envelope(code)).success, code).toBe(false);
    }
  });
});

describe('`details` and `requestId` are additive and optional', () => {
  it('a body without them still parses, to exactly what it was', () => {
    const old = { error: { code: 'NOT_FOUND', message: 'Evidence not found.' } };
    expect(ApiErrorSchema.parse(old)).toEqual(old);
    expect(Object.keys(ApiErrorSchema.parse(old).error)).toEqual(['code', 'message']);
  });

  it('they are kept, not stripped: a flat map of string, number, boolean or null, and a request ID', () => {
    const body = {
      error: {
        code: 'LOCKED',
        message: 'Too many failed attempts.',
        details: { simCode: 'SESSION_ACTIVE', attemptsRemaining: 0, lockedUntil: 1_790_823_618_000, retryInMs: 18_000, locked: true, from: null },
        requestId: '00000000-0000-4000-8000-000000000000',
      },
    };
    expect(ApiErrorSchema.parse(body)).toEqual(body);
    // Members the envelope does not know are still dropped.
    expect(ApiErrorSchema.parse({ error: { ...body.error, stack: 'at handler (index.ts:1)' } })).toEqual(body);
  });

  it('refuses a nested detail, a detail list, an empty request ID and a request ID that is not a string', () => {
    for (const details of [{ nested: { a: 1 } }, { list: [1, 2] }, 'text', 5, [1]]) {
      expect(ApiErrorSchema.safeParse({ error: { code: 'LOCKED', message: 'x', details } }).success, JSON.stringify(details)).toBe(false);
    }
    for (const requestId of ['', 5, null, {}]) {
      expect(ApiErrorSchema.safeParse({ error: { code: 'LOCKED', message: 'x', requestId } }).success, JSON.stringify(requestId)).toBe(false);
    }
  });

  it('the answer the Core server builds today parses: code, message, details and a UUID', () => {
    // The form of apps/core-server/src/plugins/error-envelope/api-failure.ts `errorBody`.
    const server = {
      error: {
        code: 'INVALID_INPUT',
        message: 'The request does not match the expected input.',
        details: { in: 'body' },
        requestId: '4b0a3c9e-7d1f-4c55-9a1e-0d2f6b8e1c33',
      },
    };
    expect(ApiErrorSchema.parse(server)).toEqual(server);
  });
});

describe('answers defined once for every operation (CORE_API_ENVELOPE_RESPONSES)', () => {
  it('holds the seven statuses of 01_specs §7.2 and the two refusals of stages 3 and 4, in order of precedence', () => {
    expect(CORE_API_ENVELOPE_RESPONSES.map((entry) => [entry.status, entry.codes, entry.stage])).toEqual([
      [400, ['INVALID_PATH'], 'routing'],
      [404, ['NOT_FOUND'], 'routing'],
      [405, ['METHOD_NOT_ALLOWED'], 'routing'],
      [503, ['NOT_READY'], 'pipeline'],
      [403, ['ORIGIN_NOT_ALLOWED'], 'pipeline'],
      [401, ['NOT_SIGNED_IN'], 'pipeline'],
      [429, ['RATE_LIMITED'], 'pipeline'],
      [413, ['PAYLOAD_TOO_LARGE'], 'pipeline'],
      // Changed by design (W83, gap W36-1 and gap W40-1): a body that is no JSON object, on a POST that takes none.
      [400, ['INVALID_JSON'], 'pipeline'],
      [500, ['INTERNAL_ERROR', 'SIMULATOR_ERROR'], 'pipeline'],
    ]);
    // "400 INVALID_PATH, 404 unknown route, 405, 413, 429, 500 and 503 are defined once at envelope level."
    for (const status of [400, 404, 405, 413, 429, 500, 503]) {
      expect(CORE_API_ENVELOPE_RESPONSES.some((entry) => entry.status === status), String(status)).toBe(true);
    }
    for (const entry of CORE_API_ENVELOPE_RESPONSES) {
      for (const code of entry.codes) expect(API_ERROR_CODES).toContain(code);
      expect(entry.description.length).toBeGreaterThan(20);
    }
    const headers = CORE_API_ENVELOPE_RESPONSES.flatMap((entry) => ('header' in entry ? [[entry.status, entry.header]] : []));
    expect(headers).toEqual([[405, ALLOW_HEADER_NAME], [429, RETRY_AFTER_HEADER_NAME]]);
    const reasons = CORE_API_ENVELOPE_RESPONSES.flatMap((entry) => ('reason' in entry ? [[entry.status, entry.reason]] : []));
    expect(reasons).toEqual([[401, CREDENTIAL_CONFLICT_REASON]]);
  });

  it('no operation repeats 405, 413, 429, 500 or 503 in its own responses', () => {
    for (const operation of CORE_API_OPERATIONS) {
      for (const status of [405, 413, 429, 500, 503]) expect(operation.responses[status], `${operation.operationId} ${status}`).toBeUndefined();
    }
  });

  it('validateCoreApiResponse accepts a pipeline answer on every operation, with its code only', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const id = operation.operationId;
      expect(validateCoreApiResponse(id, 429, envelope('RATE_LIMITED')), id).toEqual({ ok: true });
      expect(validateCoreApiResponse(id, 413, envelope('PAYLOAD_TOO_LARGE')), id).toEqual({ ok: true });
      expect(validateCoreApiResponse(id, 500, envelope('INTERNAL_ERROR')), id).toEqual({ ok: true });
      expect(validateCoreApiResponse(id, 503, envelope('NOT_READY', { requestId: 'r-1' })), id).toEqual({ ok: true });
      expect(validateCoreApiResponse(id, 429, envelope('NOT_READY')), id).toMatchObject({ ok: false, reason: 'INVALID_BODY' });
      expect(validateCoreApiResponse(id, 429, { nope: true }), id).toMatchObject({ ok: false, reason: 'INVALID_BODY' });
      // A status nobody documents stays undocumented.
      expect(validateCoreApiResponse(id, 418, envelope('TEAPOT')), id).toMatchObject({ ok: false, reason: 'UNDOCUMENTED_STATUS' });
    }
    // The simulator's own 500.
    expect(validateCoreApiResponse('getCurrentSession', 500, envelope('SIMULATOR_ERROR'))).toEqual({ ok: true });
  });

  it('the Origin guard and the credential conflict are accepted where an operation documents no 403 or 401', () => {
    // Changed by design (W27; 01_specs §7.19): health is the one operation that documents 200 only.
    // The five reads document 401 and 403 of their own now (Core server only), so a 403 on them is
    // checked like any documented status, by its schema.
    expect(validateCoreApiResponse('getServiceHealth', 403, envelope('ORIGIN_NOT_ALLOWED'))).toEqual({ ok: true });
    expect(validateCoreApiResponse('getCurrentSession', 403, envelope('ORIGIN_NOT_ALLOWED'))).toEqual({ ok: true });
    expect(validateCoreApiResponse('getCurrentSession', 403, envelope('DEVICE_REVOKED'))).toEqual({ ok: true });
    expect(validateCoreApiResponse('getCurrentSession', 401, envelope('NOT_SIGNED_IN'))).toEqual({ ok: true });
    // Not a blanket 403: where no 403 is documented, only the envelope-level code passes.
    expect(validateCoreApiResponse('getServiceHealth', 403, envelope('NOT_PERMITTED'))).toMatchObject({ ok: false, reason: 'INVALID_BODY' });
    const conflict = envelope('NOT_SIGNED_IN', { details: { reason: CREDENTIAL_CONFLICT_REASON } });
    expect(validateCoreApiResponse('getServiceHealth', 401, conflict)).toEqual({ ok: true });
    expect(validateCoreApiResponse('getSignInStatus', 401, conflict)).toEqual({ ok: true });
    // Without the reason it is the plain "not signed in", which a PUBLIC operation cannot answer.
    expect(validateCoreApiResponse('getServiceHealth', 401, envelope('NOT_SIGNED_IN'))).toMatchObject({ ok: false, reason: 'INVALID_BODY' });
    // An operation that documents the status itself decides: any envelope is its answer.
    expect(validateCoreApiResponse('getAuthSession', 401, envelope('NOT_SIGNED_IN'))).toEqual({ ok: true });
    expect(validateCoreApiResponse('listUsers', 403, envelope('NOT_PERMITTED'))).toEqual({ ok: true });
  });

  it('a routing refusal belongs to no operation: validateCoreApiEnvelopeResponse checks it', () => {
    expect(validateCoreApiEnvelopeResponse(400, envelope('INVALID_PATH'))).toEqual({ ok: true });
    expect(validateCoreApiEnvelopeResponse(404, envelope('NOT_FOUND'))).toEqual({ ok: true });
    expect(validateCoreApiEnvelopeResponse(405, envelope('METHOD_NOT_ALLOWED'))).toEqual({ ok: true });
    expect(validateCoreApiEnvelopeResponse(400, envelope('INVALID_JSON'))).toMatchObject({ ok: false, reason: 'INVALID_BODY' });
    expect(validateCoreApiEnvelopeResponse(418, envelope('TEAPOT'))).toMatchObject({ ok: false, reason: 'UNDOCUMENTED_STATUS' });
    // A routing status is not accepted as the answer of a matched operation.
    expect(validateCoreApiResponse('getCurrentSession', 405, envelope('METHOD_NOT_ALLOWED'))).toMatchObject({ ok: false, reason: 'UNDOCUMENTED_STATUS' });
    expect(validateCoreApiResponse('getCurrentSession', 404, envelope('NOT_FOUND'))).toMatchObject({ ok: false, reason: 'UNDOCUMENTED_STATUS' });
    // Where 404 is the operation's own answer (an unknown resource), it is documented there.
    expect(validateCoreApiResponse('revokeDevice', 404, envelope('NOT_FOUND'))).toEqual({ ok: true });
  });
});

describe('additive constants (01_specs §2.4; 02_plan §3.4; D36)', () => {
  it('the Core server constants have the pinned values, beside mock-core\'s', () => {
    expect([CORE_SERVER_HOST, CORE_SERVER_PORT, CORE_SERVER_HTTP_ORIGIN, CORE_SERVER_WS_URL, CORE_SERVER_SERVICE_NAME]).toEqual([
      '127.0.0.1',
      4420,
      'http://127.0.0.1:4420',
      'ws://127.0.0.1:4420/ws',
      'dems-core-server',
    ]);
    expect(CORE_SERVER_HTTP_ORIGIN).toBe(`http://${CORE_SERVER_HOST}:${CORE_SERVER_PORT}`);
    expect(CORE_SERVER_WS_URL).toBe(`ws://${CORE_SERVER_HOST}:${CORE_SERVER_PORT}/ws`);
    expect(API_BODY_LIMIT_BYTES).toBe(65_536);
  });

  it('the header names are pinned, and they are the ones the typed client reads', () => {
    expect([REQUEST_ID_HEADER_NAME, EPOCH_HEADER_NAME, REVISION_HEADER_NAME, RETRY_AFTER_HEADER_NAME, ALLOW_HEADER_NAME]).toEqual([
      'x-request-id',
      'x-dems-epoch',
      'x-dems-revision',
      'retry-after',
      'allow',
    ]);
    expect(DEFAULT_REQUEST_ID_HEADER).toBe(REQUEST_ID_HEADER_NAME);
    expect(EPOCH_HEADER).toBe(EPOCH_HEADER_NAME);
    expect(REVISION_HEADER).toBe(REVISION_HEADER_NAME);
    expect(RETRY_AFTER_HEADER).toBe(RETRY_AFTER_HEADER_NAME);
  });
});
