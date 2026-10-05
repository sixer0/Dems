// Backend task 2026-10-04, plan rows W19 (contract A) and W27 (contract C): the examples of the
// Core-server operations. They follow the canonical dataset, use the example instant as epoch
// milliseconds, and show every secret as a placeholder (SR-48; AR-3a): no example, description or
// document holds a credential. The examples of areas 4 to 11 are compared with the real simulator in
// test/api-state-examples.test.ts.
import { describe, expect, it } from 'vitest';
import {
  BIOMETRIC_TOKEN_PATTERN,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  DEVICE_CREDENTIAL_PATTERN,
  OPENAPI_EXAMPLE_INSTANT,
  PAIRING_CODE_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
  SESSION_TOKEN_PATTERN,
  createOpenApiDocument,
  serializeOpenApiDocument,
  type AdminUserList,
  type AuthSessionInfo,
  type PairingRedeemed,
  type RoleMatrix,
} from '../src/api';
import { EXAMPLE_INSTANT_MS, EXAMPLE_PLACEHOLDERS, EXAMPLE_REQUEST_ID, exampleTime } from '../src/api/example-parts';
import {
  DEMO_OPERATOR_PASSWORD,
  DEVICE_CERT_FINGERPRINT,
  DEVICE_ID,
  DEVICE_NAME,
  OPERATORS,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
} from '../src/sim';

const NEW_OPERATIONS = CORE_API_OPERATIONS.slice(10);

/** Every string inside a JSON value, with the path of keys that leads to it. */
function strings(value: unknown, path = '', out: [string, string][] = []): [string, string][] {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => strings(item, `${path}[${index}]`, out));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) strings(child, `${path}.${key}`, out);
  return out;
}

function firstResponse<T>(operationId: string, status: number, name: string): T {
  const example = CORE_API_EXAMPLES[operationId]?.responses[status]?.[name];
  expect(example, `${operationId} ${status} ${name}`).toBeDefined();
  return example!.value as T;
}

describe('the examples of the 65 operations that only the Core server answers', () => {
  it('every operation has examples: a request for each body, an ID for each path parameter, a body for each answer that has one', () => {
    let responses = 0;
    for (const operation of NEW_OPERATIONS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      expect(examples, operation.operationId).toBeDefined();
      expect(Object.keys(examples?.request ?? {}).length > 0, `${operation.operationId} request`).toBe(operation.requestBody !== undefined);
      expect(examples?.pathParams !== undefined, `${operation.operationId} path`).toBe(operation.pathParam !== undefined);
      for (const [status, spec] of Object.entries(operation.responses)) {
        const named = Object.values(examples?.responses[Number(status)] ?? {});
        if (!spec.schema) {
          // A 204 has no body, so it has no example.
          expect(named, `${operation.operationId} ${status}`).toEqual([]);
          continue;
        }
        expect(named.length, `${operation.operationId} ${status}`).toBeGreaterThan(0);
        for (const example of named) {
          expect(CORE_API_SCHEMAS[spec.schema].safeParse(example.value).success, `${operation.operationId} ${status} ${example.summary}`).toBe(true);
          expect(example.summary.length).toBeGreaterThan(3);
          responses += 1;
        }
      }
    }
    expect(NEW_OPERATIONS).toHaveLength(65);
    expect(responses).toBeGreaterThan(300);
  });

  it('use the example instant of the existing examples, as epoch milliseconds', () => {
    expect(EXAMPLE_INSTANT_MS).toBe(Date.parse(OPENAPI_EXAMPLE_INSTANT));
    expect(exampleTime(5) - exampleTime(0)).toBe(300_000);
    const session = firstResponse<AuthSessionInfo>('getAuthSession', 200, 'webConsole');
    expect(session.serverTime).toBe(EXAMPLE_INSTANT_MS);
    // ID-P4, ID-P5: idle 15 minutes after the last activity, absolute 8 hours after issue.
    expect(session.idleExpiresAt - session.lastActivityAt).toBe(15 * 60_000);
    expect(session.absoluteExpiresAt - session.issuedAt).toBe(8 * 60 * 60_000);
    // PR-P2: a code lives 300 s.
    const issued = firstResponse<{ issuedAt: number; expiresAt: number; attemptsAllowed: number }>('issuePairingCode', 201, 'issued');
    expect(issued.expiresAt - issued.issuedAt).toBe(300_000);
    expect(issued.attemptsAllowed).toBe(5);
  });

  it('follow the canonical dataset: operators, the role matrix and the Core identity', () => {
    const users = firstResponse<AdminUserList>('listUsers', 200, 'seeded').users;
    expect(users.map(({ id, username, rank, name, displayName, initials, role }) => ({ id, username, rank, name, displayName, initials, role }))).toEqual(OPERATORS);

    const matrix = firstResponse<RoleMatrix>('getRoleMatrix', 200, 'seeded');
    expect(matrix.roles).toEqual(Object.values(OperatorRole));
    expect(matrix.permissions).toEqual(Object.values(Permission));
    expect(matrix.grants).toHaveLength(18);
    for (const role of Object.values(OperatorRole)) {
      expect(matrix.grants.filter((grant) => grant.role === role).map((grant) => grant.permission)).toEqual([...ROLE_PERMISSIONS[role]]);
    }
    expect(matrix.editable).toBe(false);

    // A session's permission list is the list of its operator's role.
    for (const name of ['webConsole', 'pairedDevice']) {
      const session = firstResponse<AuthSessionInfo>('getAuthSession', 200, name);
      expect(session.permissions).toEqual([...ROLE_PERMISSIONS[session.operator.role]]);
      expect(OPERATORS).toContainEqual(session.operator);
    }

    const paired = firstResponse<PairingRedeemed>('redeemPairingCode', 201, 'paired');
    expect(paired.core).toEqual({ deviceId: DEVICE_ID, name: DEVICE_NAME, certificateFingerprint: DEVICE_CERT_FINGERPRINT });
  });

  it('every error example carries the request ID the server would send', () => {
    let errors = 0;
    for (const operation of NEW_OPERATIONS) {
      for (const [status, named] of Object.entries(CORE_API_EXAMPLES[operation.operationId]?.responses ?? {})) {
        if (Number(status) < 400) continue;
        for (const example of Object.values(named)) {
          expect((example.value as { error: { requestId?: string } }).error.requestId, `${operation.operationId} ${status}`).toBe(EXAMPLE_REQUEST_ID);
          errors += 1;
        }
      }
    }
    expect(errors).toBeGreaterThan(230);
  });
});

describe('no example holds a secret', () => {
  const everything = [
    JSON.stringify(CORE_API_EXAMPLES),
    serializeOpenApiDocument(createOpenApiDocument({ scope: 'all' })),
    serializeOpenApiDocument(createOpenApiDocument()),
    JSON.stringify(CORE_API_OPERATIONS.map((operation) => [operation.summary, operation.description, operation.responses])),
  ].join('\n');

  it('the published demo password appears nowhere in the contract', () => {
    expect(DEMO_OPERATOR_PASSWORD.length).toBeGreaterThan(4);
    expect(everything).not.toContain(DEMO_OPERATOR_PASSWORD);
  });

  it('the placeholders have the form of what they stand for', () => {
    expect(EXAMPLE_PLACEHOLDERS.sessionToken).toMatch(SESSION_TOKEN_PATTERN);
    expect(EXAMPLE_PLACEHOLDERS.deviceCredential).toMatch(DEVICE_CREDENTIAL_PATTERN);
    expect(EXAMPLE_PLACEHOLDERS.biometricToken).toMatch(BIOMETRIC_TOKEN_PATTERN);
    expect(EXAMPLE_PLACEHOLDERS.pairingCode).toMatch(PAIRING_CODE_PATTERN);
    expect(EXAMPLE_PLACEHOLDERS.qrPayload).toMatch(PAIRING_QR_PAYLOAD_PATTERN);
    expect(EXAMPLE_PLACEHOLDERS.qrPayload).toBe(`DEMS-PAIR:1:${EXAMPLE_PLACEHOLDERS.pairingCode}`);
    for (const secret of [EXAMPLE_PLACEHOLDERS.sessionToken, EXAMPLE_PLACEHOLDERS.deviceCredential, EXAMPLE_PLACEHOLDERS.biometricToken]) {
      expect(secret).toContain('EXAMPLE_ONLY_NOT_A_REAL_CREDENTIAL');
    }
    expect(EXAMPLE_PLACEHOLDERS.password).toBe('<operator password>');
    expect(EXAMPLE_PLACEHOLDERS.pairingCode).toBe('000000');
  });

  it('every credential-shaped value of every example is one of the placeholders', () => {
    const allowed = new Set<string>(Object.values(EXAMPLE_PLACEHOLDERS));
    const secretKeys = /(^|\.)(password|code|qrPayload|sessionToken|deviceCredential|biometricToken|token)$/;
    let seen = 0;
    for (const [path, value] of strings(CORE_API_EXAMPLES)) {
      const looksSecret = /^(ses|dvc|bio)_/.test(value) || /^\d{6}$/.test(value) || value.startsWith('DEMS-PAIR:');
      // `error.code` is the machine-readable error code, not a pairing code.
      const namedSecret = secretKeys.test(path) && !path.endsWith('.error.code');
      if (!looksSecret && !namedSecret) continue;
      expect(allowed.has(value), `${path} = ${value}`).toBe(true);
      seen += 1;
    }
    // sign-in password; biometric token (request, enrolment, rotation); session token (two answers);
    // pairing code and QR payload; redeem code; device credential (redeem, rotation).
    expect(seen).toBeGreaterThanOrEqual(11);
    // W27: no operation of areas 4 to 11 carries a secret, so their examples add none. An ID such as
    // `ALR-000001` or `EXP-000032` is not six digits on its own, and no member is named like a secret.
    const contractC = CORE_API_OPERATIONS.filter((operation) => /§7\.(8|9|10|11|12|13|14|15), /.test(operation.source));
    expect(contractC).toHaveLength(38);
    for (const operation of contractC) {
      for (const [path, value] of strings(CORE_API_EXAMPLES[operation.operationId])) {
        expect(/^(ses|dvc|bio)_/.test(value) || /^\d{6}$/.test(value) || value.startsWith('DEMS-PAIR:'), `${operation.operationId}${path}`).toBe(false);
        expect(secretKeys.test(path) && !path.endsWith('.error.code'), `${operation.operationId}${path}`).toBe(false);
      }
    }
  });

  it('no bearer-shaped value hides in a description or a document either', () => {
    const shaped = [...everything.matchAll(/\b(?:ses|dvc|bio)_[A-Za-z0-9_-]{8,}/g)].map((match) => match[0]);
    const placeholders: string[] = [EXAMPLE_PLACEHOLDERS.sessionToken, EXAMPLE_PLACEHOLDERS.deviceCredential, EXAMPLE_PLACEHOLDERS.biometricToken];
    expect(shaped.filter((value) => !placeholders.includes(value))).toEqual([]);
    expect(shaped.length).toBeGreaterThan(0);
  });
});
