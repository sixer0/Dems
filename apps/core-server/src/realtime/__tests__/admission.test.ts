// The socket decision table as a pure function (plan row W42; spec §9.2, §14.2; SR-38, SR-40,
// SR-42; AC-B-85). What stage 4 found decides who a socket is; nothing else is read. The same
// cells are run through a real handshake in `upgrade.db.test.ts`.
import { REALTIME_PRINCIPAL_TOPICS, RealtimeCloseCode, RealtimeHelloReason, RealtimePrincipal, RealtimeTopic } from '@dems/shared/api';
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { ANONYMOUS_PRINCIPAL, type Authentication, type AuthenticationFailure, type Principal } from '../../plugins/authenticate';
import { admissionOf, beyondCap, deviceRetired, displacedBy, isRefused, principalCapOf, principalKeyOf, sessionInvalid, topicsOf, type Admission } from '../admission';
import { REALTIME_MAX_ANONYMOUS, REALTIME_MAX_CONNECTIONS, REALTIME_MAX_PER_DEVICE, REALTIME_MAX_PER_SESSION } from '../limits';

const CAPS = { maxConnections: REALTIME_MAX_CONNECTIONS, maxAnonymous: REALTIME_MAX_ANONYMOUS };

const operator = (deviceId: string | null, role: OperatorRole = OperatorRole.INVESTIGATOR): Principal => ({
  kind: 'OPERATOR',
  operatorId: 'OPR-001',
  sessionId: 'session-row-1',
  deviceId,
  role,
  permissions: ROLE_PERMISSIONS[role],
});
const device: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
const retired: Principal = { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0002' };

const presented = (kind: Authentication['presented'], failure: AuthenticationFailure | null): Authentication => ({ presented: kind, failure, session: null });
const NONE = presented('NONE', null);

const FAILURES: readonly AuthenticationFailure[] = ['MALFORMED', 'UNKNOWN', 'ENDED', 'OPERATOR_DISABLED', 'DEVICE_UNKNOWN', 'DEVICE_RETIRED'];

describe('admissionOf: who a socket is', () => {
  it('an OPERATOR principal is an OPERATOR socket with the IDs and the permissions stage 4 read, from a cookie or a bearer', () => {
    const web = admissionOf(operator(null), presented('COOKIE', null));
    expect(web).toEqual({
      kind: 'OPERATOR',
      operatorId: 'OPR-001',
      sessionId: 'session-row-1',
      deviceId: null,
      role: 'INVESTIGATOR',
      permissions: ROLE_PERMISSIONS.INVESTIGATOR,
    });
    const mobile = admissionOf(operator('DEV-0001', OperatorRole.SUPERVISOR), presented('BEARER', null));
    expect(mobile).toMatchObject({ kind: 'OPERATOR', deviceId: 'DEV-0001', role: 'SUPERVISOR' });
    expect(isRefused(web)).toBe(false);
    expect(isRefused(mobile)).toBe(false);
  });

  it('a DEVICE principal is a DEVICE socket', () => {
    const admission = admissionOf(device, presented('BEARER', null));
    expect(admission).toEqual({ kind: 'DEVICE', deviceId: 'DEV-0001' });
    expect(isRefused(admission)).toBe(false);
  });

  it('no credential: ANONYMOUS, no reason, the socket stays open', () => {
    const admission = admissionOf(ANONYMOUS_PRINCIPAL, NONE);
    expect(admission).toEqual({ kind: 'ANONYMOUS', reason: null, closeCode: null });
    expect(isRefused(admission)).toBe(false);
  });

  it.each(FAILURES)('the cookie that does not resolve (%s): ANONYMOUS with SESSION_INVALID, and the socket stays open', (failure) => {
    const admission = admissionOf(ANONYMOUS_PRINCIPAL, presented('COOKIE', failure));
    expect(admission).toEqual({ kind: 'ANONYMOUS', reason: RealtimeHelloReason.SESSION_INVALID, closeCode: null });
    expect(isRefused(admission)).toBe(false);
  });

  it.each(FAILURES.filter((failure) => failure !== 'DEVICE_RETIRED'))(
    'a bearer value that does not resolve (%s): hello with SESSION_INVALID, then close 4401',
    (failure) => {
      const admission = admissionOf(ANONYMOUS_PRINCIPAL, presented('BEARER', failure));
      expect(admission).toEqual({ kind: 'ANONYMOUS', reason: RealtimeHelloReason.SESSION_INVALID, closeCode: RealtimeCloseCode.SESSION_ENDED });
      expect(RealtimeCloseCode.SESSION_ENDED).toBe(4401);
      expect(isRefused(admission)).toBe(true);
    },
  );

  it('a bearer value of a retired device: hello with DEVICE_REVOKED, then close 4403, by the principal or by the failure', () => {
    const expected = { kind: 'ANONYMOUS', reason: RealtimeHelloReason.DEVICE_REVOKED, closeCode: RealtimeCloseCode.DEVICE_REVOKED };
    expect(RealtimeCloseCode.DEVICE_REVOKED).toBe(4403);
    expect(admissionOf(retired, presented('BEARER', 'DEVICE_RETIRED'))).toEqual(expected);
    // Either sign alone is enough: the socket is never left open for a retired device.
    expect(admissionOf(retired, presented('BEARER', 'ENDED'))).toEqual(expected);
    expect(admissionOf(ANONYMOUS_PRINCIPAL, presented('BEARER', 'DEVICE_RETIRED'))).toEqual(expected);
    expect(isRefused(admissionOf(retired, presented('BEARER', 'DEVICE_RETIRED')))).toBe(true);
  });

  it('a bearer value is never left open as ANONYMOUS, whatever stage 4 says about it', () => {
    for (const failure of [...FAILURES, null]) {
      expect(isRefused(admissionOf(ANONYMOUS_PRINCIPAL, presented('BEARER', failure))), String(failure)).toBe(true);
    }
  });

  it('the two builders name the two reasons and the two codes', () => {
    expect(sessionInvalid('COOKIE')).toEqual({ kind: 'ANONYMOUS', reason: 'SESSION_INVALID', closeCode: null });
    expect(sessionInvalid('BEARER')).toEqual({ kind: 'ANONYMOUS', reason: 'SESSION_INVALID', closeCode: 4401 });
    expect(deviceRetired()).toEqual({ kind: 'ANONYMOUS', reason: 'DEVICE_REVOKED', closeCode: 4403 });
  });
});

describe('beyondCap: 16 connections, of which 6 anonymous (RT-P6, AC-B-85)', () => {
  const anonymous = admissionOf(ANONYMOUS_PRINCIPAL, NONE);
  const dead = admissionOf(ANONYMOUS_PRINCIPAL, presented('COOKIE', 'ENDED'));
  const anOperator = admissionOf(operator(null), presented('COOKIE', null));
  const aDevice = admissionOf(device, presented('BEARER', null));

  it('the numbers are the specification\'s', () => {
    expect(CAPS).toEqual({ maxConnections: 16, maxAnonymous: 6 });
  });

  it('the sixth anonymous socket is accepted, the seventh is not; an operator and a device still are', () => {
    expect(beyondCap(anonymous, { total: 5, anonymous: 5 }, CAPS)).toBe(false);
    expect(beyondCap(anonymous, { total: 6, anonymous: 6 }, CAPS)).toBe(true);
    expect(beyondCap(dead, { total: 6, anonymous: 6 }, CAPS)).toBe(true);
    expect(beyondCap(anOperator, { total: 6, anonymous: 6 }, CAPS)).toBe(false);
    expect(beyondCap(aDevice, { total: 6, anonymous: 6 }, CAPS)).toBe(false);
  });

  it('anonymous sockets are counted apart: ten operators leave six anonymous places, not fewer', () => {
    expect(beyondCap(anonymous, { total: 15, anonymous: 5 }, CAPS)).toBe(false);
    expect(beyondCap(anonymous, { total: 10, anonymous: 0 }, CAPS)).toBe(false);
  });

  it('the 17th connection of any kind is beyond the cap', () => {
    for (const admission of [anonymous, anOperator, aDevice] satisfies Admission[]) {
      expect(beyondCap(admission, { total: 15, anonymous: 0 }, CAPS)).toBe(false);
      expect(beyondCap(admission, { total: 16, anonymous: 0 }, CAPS)).toBe(true);
      expect(beyondCap(admission, { total: 17, anonymous: 0 }, CAPS)).toBe(true);
    }
  });
});

describe('the cap of one principal (review finding CPS1-5)', () => {
  const PRINCIPAL_CAPS = { maxPerSession: REALTIME_MAX_PER_SESSION, maxPerDevice: REALTIME_MAX_PER_DEVICE };

  it('the numbers: four sockets of one operator session (four tabs of a console), two of one device credential (its socket and the overlap of a reconnect)', () => {
    expect(PRINCIPAL_CAPS).toEqual({ maxPerSession: 4, maxPerDevice: 2 });
    // Ten places are left for principals; no single one can take them all, nor half of them.
    expect(REALTIME_MAX_CONNECTIONS - REALTIME_MAX_ANONYMOUS).toBe(10);
    expect(REALTIME_MAX_PER_SESSION).toBeLessThan((REALTIME_MAX_CONNECTIONS - REALTIME_MAX_ANONYMOUS) / 2);
  });

  it('principalKeyOf: an OPERATOR socket by its session row, on the web and on a device; a DEVICE socket by its device; nothing without a principal', () => {
    expect(principalKeyOf(admissionOf(operator(null), presented('COOKIE', null)))).toBe('session:session-row-1');
    // A session on a device is counted under the session: a device may hold several sessions.
    expect(principalKeyOf(admissionOf(operator('DEV-0001'), presented('BEARER', null)))).toBe('session:session-row-1');
    expect(principalKeyOf(admissionOf(device, presented('BEARER', null)))).toBe('device:DEV-0001');
    expect(principalKeyOf(admissionOf(ANONYMOUS_PRINCIPAL, NONE))).toBeNull();
    expect(principalKeyOf(admissionOf(ANONYMOUS_PRINCIPAL, presented('COOKIE', 'ENDED')))).toBeNull();
    expect(principalKeyOf(admissionOf(retired, presented('BEARER', 'DEVICE_RETIRED')))).toBeNull();
  });

  it('two sessions of ONE operator are two principals, on the web and on one device; the device\'s own socket is a third', () => {
    const first: Admission = { kind: 'OPERATOR', operatorId: 'OPR-001', sessionId: 'a', deviceId: null, role: OperatorRole.INVESTIGATOR, permissions: [] };
    const second: Admission = { ...first, sessionId: 'b' };
    expect(principalKeyOf(first)).not.toBe(principalKeyOf(second));
    const passwordOnTablet: Admission = { ...first, sessionId: 'c', deviceId: 'DEV-0007' };
    const biometricOnTablet: Admission = { ...first, sessionId: 'd', deviceId: 'DEV-0007' };
    const tablet: Admission = { kind: 'DEVICE', deviceId: 'DEV-0007' };
    expect([principalKeyOf(passwordOnTablet), principalKeyOf(biometricOnTablet), principalKeyOf(tablet)]).toEqual(['session:c', 'session:d', 'device:DEV-0007']);
  });

  it('principalCapOf: the device cap for a device key, the session cap for a session key', () => {
    expect(principalCapOf('device:DEV-0001', PRINCIPAL_CAPS)).toBe(2);
    expect(principalCapOf('session:session-row-1', PRINCIPAL_CAPS)).toBe(4);
    expect(principalCapOf('device:DEV-0001', { maxPerSession: 9, maxPerDevice: 3 })).toBe(3);
    expect(principalCapOf('session:x', { maxPerSession: 9, maxPerDevice: 3 })).toBe(9);
  });

  it('displacedBy: nobody below the cap, the oldest one at the cap, and as many as it takes above it', () => {
    expect([0, 1, 2, 3].map((open) => displacedBy(open, 4))).toEqual([0, 0, 0, 0]);
    expect(displacedBy(4, 4)).toBe(1);
    expect(displacedBy(5, 4)).toBe(2);
    expect([0, 1, 2, 3].map((open) => displacedBy(open, 2))).toEqual([0, 0, 1, 2]);
    expect(displacedBy(0, 1)).toBe(0);
    expect(displacedBy(1, 1)).toBe(1);
  });
});

describe('topicsOf: what hello names (spec §9.2)', () => {
  it('ANONYMOUS: the heartbeat and nothing else, with or without a reason', () => {
    expect(topicsOf(admissionOf(ANONYMOUS_PRINCIPAL, NONE))).toEqual(['heartbeat']);
    expect(topicsOf(admissionOf(ANONYMOUS_PRINCIPAL, presented('COOKIE', 'ENDED')))).toEqual(['heartbeat']);
    expect(topicsOf(admissionOf(retired, presented('BEARER', 'DEVICE_RETIRED')))).toEqual(['heartbeat']);
  });

  it('DEVICE: the heartbeat and control', () => {
    expect(topicsOf(admissionOf(device, presented('BEARER', null)))).toEqual(['heartbeat', 'control']);
  });

  it('OPERATOR: control, state and meters; admin only with USER_ADMIN or PAIRING_MANAGE', () => {
    const base = ['heartbeat', 'control', 'state', 'meters'];
    expect(topicsOf(admissionOf(operator(null, OperatorRole.INVESTIGATOR), presented('COOKIE', null)))).toEqual(base);
    expect(topicsOf(admissionOf(operator(null, OperatorRole.TECHNICIAN), presented('COOKIE', null)))).toEqual(base);
    expect(topicsOf(admissionOf(operator(null, OperatorRole.SUPERVISOR), presented('COOKIE', null)))).toEqual([...base, 'admin']);
    for (const permission of [Permission.USER_ADMIN, Permission.PAIRING_MANAGE]) {
      const admission: Admission = { kind: 'OPERATOR', operatorId: 'OPR-009', sessionId: 's', deviceId: null, role: OperatorRole.TECHNICIAN, permissions: [permission] };
      expect(topicsOf(admission), permission).toEqual([...base, 'admin']);
    }
  });

  it('never more than the contract gives the principal, each topic once, the heartbeat always', () => {
    const cases: Admission[] = [
      admissionOf(ANONYMOUS_PRINCIPAL, NONE),
      admissionOf(device, presented('BEARER', null)),
      admissionOf(operator('DEV-0001', OperatorRole.SUPERVISOR), presented('BEARER', null)),
    ];
    for (const admission of cases) {
      const topics = topicsOf(admission);
      const allowed: readonly string[] = REALTIME_PRINCIPAL_TOPICS[admission.kind];
      expect(topics).toContain(RealtimeTopic.HEARTBEAT);
      expect(new Set(topics).size).toBe(topics.length);
      expect(topics.every((topic) => allowed.includes(topic))).toBe(true);
    }
    expect(Object.keys(REALTIME_PRINCIPAL_TOPICS).sort()).toEqual(Object.values(RealtimePrincipal).sort());
  });
});
