// Simulated authentication (masterplan/01_specs.md §14.8, AC-50; 04_mobile_specs.md §6; SCR-02).
// Driven by a manual sim clock and in-memory adapters: no timers, no web globals.
import { describe, expect, it } from 'vitest';
import {
  AUTH_LOCKOUT_MS,
  canonicalJSON,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  OPERATOR_IDS,
  Permission,
  ROLE_PERMISSIONS,
  roleHas,
  selectLockout,
  selectOperator,
  type AuditRow,
  type AuthSessionStorage,
  type ControllableClock,
  type Sim,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function setup(authStorage: AuthSessionStorage = createMemoryAuthStorage()): {
  sim: Sim;
  clock: ControllableClock;
  authStorage: AuthSessionStorage;
} {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage });
  return { sim, clock, authStorage };
}

/** Audit rows appended after `from` (the dataset seeds history rows first). */
function newRows(sim: Sim, from: number): AuditRow[] {
  return sim.store.getState().audit.rows.filter((row) => row.seq > from);
}

function countTypes(rows: readonly AuditRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.type] = (counts[row.type] ?? 0) + 1;
  return counts;
}

describe('AC-50: lockout policy and audit rows', () => {
  it('locks after 5 failures in 5 min, rejects correct credentials for 60 s, then succeeds', () => {
    const { sim, clock } = setup();
    const { actions } = sim;
    const before = sim.store.getState().audit.total;

    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(actions.signIn('budi.santoso', `wrong-${i}`));
      clock.advance(10_000);
    }
    expect(results.slice(0, 4).map((r) => (r.ok ? 'ok' : r.reason))).toEqual([
      'INVALID_CREDENTIALS',
      'INVALID_CREDENTIALS',
      'INVALID_CREDENTIALS',
      'INVALID_CREDENTIALS',
    ]);
    expect(results.slice(0, 4).map((r) => (!r.ok && 'attemptsRemaining' in r ? r.attemptsRemaining : -1))).toEqual([
      4, 3, 2, 1,
    ]);
    const fifth = results[4];
    expect(fifth).toMatchObject({ ok: false, reason: 'LOCKED', retryInMs: AUTH_LOCKOUT_MS });

    // Even correct credentials are rejected while locked (sim clock authoritative).
    clock.advance(20_000);
    const whileLocked = actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(whileLocked).toMatchObject({ ok: false, reason: 'LOCKED' });
    expect(sim.store.getState().auth.status).toBe('SIGNED_OUT');

    // 60 s after the lock started, the correct password works.
    const lockedUntil = sim.store.getState().authLockout.lockedUntil;
    expect(lockedUntil).not.toBeNull();
    clock.set(lockedUntil as number);
    const success = actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(success).toEqual({ ok: true, operatorId: OPERATOR_IDS.BUDI, role: 'INVESTIGATOR', method: 'PASSWORD' });
    expect(sim.store.getState().auth).toMatchObject({ status: 'SIGNED_IN', operatorId: OPERATOR_IDS.BUDI });
    expect(sim.store.getState().authLockout).toEqual({ failures: [], lockedUntil: null });

    // Audit: 5 AUTH_FAILED, 1 AUTH_LOCKED, 1 AUTH_SUCCESS; one row per attempt.
    const rows = newRows(sim, before);
    expect(countTypes(rows)).toEqual({ AUTH_FAILED: 5, AUTH_LOCKED: 1, AUTH_SUCCESS: 1 });
    expect(rows.map((r) => r.type)).toEqual([
      'AUTH_FAILED',
      'AUTH_FAILED',
      'AUTH_FAILED',
      'AUTH_FAILED',
      'AUTH_FAILED',
      'AUTH_LOCKED',
      'AUTH_SUCCESS',
    ]);
    expect(rows.every((r) => r.category === 'AUTH')).toBe(true);
    expect(rows[4]?.details).toMatchObject({ attemptsRemaining: 0, lockedUntil });

    // No password (right or wrong) anywhere in the state, events or audit rows.
    const serialized = canonicalJSON(sim.store.getState());
    expect(serialized).not.toContain(DEMO_OPERATOR_PASSWORD);
    expect(serialized).not.toContain('wrong-');
    expect(sim.actions.verifyAuditChain()).toMatchObject({ ok: true });
  });

  it('counts failures in a rolling 5 min window', () => {
    const { sim, clock } = setup();
    for (let i = 0; i < 4; i += 1) sim.actions.signIn('budi.santoso', 'nope');
    clock.advance(5 * 60_000); // the first four fall out of the window
    const next = sim.actions.signIn('budi.santoso', 'nope');
    expect(next).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: 4 });
    expect(selectLockout(sim.store.getState()).locked).toBe(false);
  });

  it('locks console-wide, across usernames', () => {
    const { sim } = setup();
    for (const name of ['budi.santoso', 'andi.pratama', 'rina.wijaya', 'someone', 'budi.santoso']) {
      sim.actions.signIn(name, 'bad');
    }
    expect(sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD)).toMatchObject({ reason: 'LOCKED' });
  });

  it('does not record a username that matches no operator', () => {
    const { sim } = setup();
    const before = sim.store.getState().audit.total;
    sim.actions.signIn('demo-2026-typed-in-the-wrong-field', 'x');
    const [row] = newRows(sim, before);
    expect(row).toMatchObject({ type: 'AUTH_FAILED', actorId: null });
    expect(row?.details).toMatchObject({ knownOperator: false });
    expect(canonicalJSON(sim.store.getState())).not.toContain('typed-in-the-wrong-field');
  });

  it('accepts usernames case-insensitively and trimmed', () => {
    const { sim } = setup();
    expect(sim.actions.signIn('  Rina.Wijaya ', DEMO_OPERATOR_PASSWORD)).toMatchObject({
      ok: true,
      role: 'TECHNICIAN',
    });
  });
});

describe('SCR-02: biometric sign-in', () => {
  it('signs in with audit method BIOMETRIC', () => {
    const { sim } = setup();
    const before = sim.store.getState().audit.total;
    const result = sim.actions.signInWithBiometric(OPERATOR_IDS.BUDI);
    expect(result).toEqual({ ok: true, operatorId: OPERATOR_IDS.BUDI, role: 'INVESTIGATOR', method: 'BIOMETRIC' });
    const [row] = newRows(sim, before);
    expect(row).toMatchObject({ type: 'AUTH_SUCCESS', actorId: OPERATOR_IDS.BUDI });
    expect(row?.details).toEqual({ method: 'BIOMETRIC' });
    expect(sim.store.getState().auth.method).toBe('BIOMETRIC');
  });

  it('counts an OS authentication_failed result toward the lockout', () => {
    const { sim } = setup();
    const before = sim.store.getState().audit.total;
    for (let i = 0; i < 4; i += 1) sim.actions.recordBiometricFailure(OPERATOR_IDS.BUDI);
    const fifth = sim.actions.recordBiometricFailure(OPERATOR_IDS.BUDI);
    expect(fifth).toMatchObject({ ok: false, reason: 'LOCKED' });
    expect(sim.actions.signInWithBiometric(OPERATOR_IDS.BUDI)).toMatchObject({ reason: 'LOCKED' });
    const rows = newRows(sim, before);
    expect(countTypes(rows)).toEqual({ AUTH_FAILED: 5, AUTH_LOCKED: 1 });
    expect(rows.every((r) => r.details.method === 'BIOMETRIC')).toBe(true);
  });

  it('rejects an unknown operator ID as a failure', () => {
    const { sim } = setup();
    expect(sim.actions.signInWithBiometric('OPR-999')).toMatchObject({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
      attemptsRemaining: 4,
    });
  });
});

describe('security key, sign-out, idle expiry and the dems.auth record', () => {
  it('signs in as the SUPERVISOR with the simulated security key', () => {
    const { sim } = setup();
    expect(sim.actions.signInWithSecurityKey()).toEqual({
      ok: true,
      operatorId: OPERATOR_IDS.ANDI,
      role: 'SUPERVISOR',
      method: 'SECURITY_KEY',
    });
  });

  it('stores only { operatorId, issuedAt } and clears it on sign-out', () => {
    const authStorage = createMemoryAuthStorage();
    const { sim } = setup(authStorage);
    sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(authStorage.load()).toEqual({ operatorId: OPERATOR_IDS.BUDI, issuedAt: START });
    const before = sim.store.getState().audit.total;
    sim.actions.signOut('LOCK');
    expect(authStorage.load()).toBeNull();
    expect(sim.store.getState().auth.status).toBe('SIGNED_OUT');
    expect(newRows(sim, before)).toMatchObject([{ type: 'AUTH_SIGNED_OUT', details: { reason: 'LOCK' } }]);
  });

  it('restores a stored operator on createSim (a web reload)', () => {
    const authStorage = createMemoryAuthStorage();
    authStorage.save({ operatorId: OPERATOR_IDS.RINA, issuedAt: START - 60_000 });
    const { sim } = setup(authStorage);
    expect(selectOperator(sim.store.getState())?.displayName).toBe('Rina Wijaya');
    expect(sim.store.getState().auth).toMatchObject({ status: 'SIGNED_IN', issuedAt: START - 60_000 });
  });

  it('ignores a stored record for an unknown operator', () => {
    const authStorage = createMemoryAuthStorage();
    authStorage.save({ operatorId: 'OPR-404', issuedAt: START });
    const { sim } = setup(authStorage);
    expect(sim.store.getState().auth.status).toBe('SIGNED_OUT');
  });

  it('expires after 15 min without activity; touch() keeps the session alive', () => {
    const { sim, clock } = setup();
    sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    clock.advance(14 * 60_000);
    sim.actions.touch();
    clock.advance(14 * 60_000);
    sim.tick();
    expect(sim.store.getState().auth.status).toBe('SIGNED_IN');
    clock.advance(60_000);
    sim.tick();
    expect(sim.store.getState().auth.status).toBe('EXPIRED');
    const last = sim.store.getState().audit.rows.at(-1);
    expect(last).toMatchObject({ type: 'AUTH_EXPIRED', actorId: OPERATOR_IDS.BUDI });
  });
});

describe('RBAC (demo roles, 01 G1)', () => {
  it('matches the §14.7 role table', () => {
    expect(roleHas('INVESTIGATOR', 'SESSION_START')).toBe(true);
    expect(roleHas('INVESTIGATOR', 'EVIDENCE_EXPORT')).toBe(false);
    expect(roleHas('SUPERVISOR', 'SESSION_START')).toBe(true);
    expect(roleHas('SUPERVISOR', 'EVIDENCE_EXPORT')).toBe(true);
    expect(roleHas('SUPERVISOR', 'AUDIT_EXPORT')).toBe(true);
    expect(roleHas('TECHNICIAN', 'SESSION_START')).toBe(false);
    expect(roleHas('TECHNICIAN', 'EVIDENCE_EXPORT')).toBe(false);
    expect(roleHas('TECHNICIAN', 'MAINTENANCE')).toBe(true);
    expect(roleHas(null, 'EVIDENCE_VIEW')).toBe(false);
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN']);
  });

  // Backend task W16 (GP-06; 2026-10-04 01_specs §4.3, §4.4, AC-B-17): the matrix the Core server
  // seeds and enforces. Three permissions and three SUPERVISOR grants were added; nothing else moved.
  it('pins 15 permissions and 23 grants: INVESTIGATOR 5, SUPERVISOR 12, TECHNICIAN 6 (W16; M2-W6 SH-04; task 4 row 100)', () => {
    expect(Object.values(Permission)).toEqual([
      'SESSION_START',
      'SESSION_NOTE',
      'EVIDENCE_VIEW',
      'EVIDENCE_REVIEW',
      'EVIDENCE_EXPORT',
      'AUDIT_EXPORT',
      'DEVICE_MANAGE',
      'DIAGNOSTICS_RUN',
      'MAINTENANCE',
      'PAIRING_MANAGE',
      'USER_ADMIN',
      'DEMO_CONTROL',
      // Task 3 M2-W6 (register SH-03/SH-04; D4 OD-10 and OD-15).
      'CAPTURE_CONFIG',
      'TRANSCRIPT_REVISE',
      // Task 4 row 100 (decision U10): declared last; place 15 is the stored sort order.
      'CAPTURE_COMMISSION',
    ]);
    expect(Object.keys(Permission)).toEqual(Object.values(Permission));
    expect(ROLE_PERMISSIONS).toEqual({
      INVESTIGATOR: ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN', 'TRANSCRIPT_REVISE'],
      SUPERVISOR: [
        'SESSION_START',
        'SESSION_NOTE',
        'EVIDENCE_VIEW',
        'DIAGNOSTICS_RUN',
        'TRANSCRIPT_REVISE',
        'EVIDENCE_REVIEW',
        'EVIDENCE_EXPORT',
        'AUDIT_EXPORT',
        'PAIRING_MANAGE',
        'USER_ADMIN',
        'DEMO_CONTROL',
        'CAPTURE_CONFIG',
      ],
      TECHNICIAN: ['EVIDENCE_VIEW', 'DEVICE_MANAGE', 'DIAGNOSTICS_RUN', 'MAINTENANCE', 'CAPTURE_CONFIG', 'CAPTURE_COMMISSION'],
    });
    const grants = Object.values(ROLE_PERMISSIONS).map((list) => list.length);
    expect(grants).toEqual([5, 12, 6]);
    // The same numbers the seed writes (`dbc-3 §E.3` + task 4 row 100: 15 permissions, 23 grants; D88 equality).
    expect(grants.reduce((sum, count) => sum + count, 0)).toBe(23);
    for (const list of Object.values(ROLE_PERMISSIONS)) {
      expect(new Set<string>(list).size).toBe(list.length);
    }
    for (const permission of ['PAIRING_MANAGE', 'USER_ADMIN', 'DEMO_CONTROL'] as const) {
      expect(roleHas('SUPERVISOR', permission)).toBe(true);
      expect(roleHas('INVESTIGATOR', permission)).toBe(false);
      expect(roleHas('TECHNICIAN', permission)).toBe(false);
    }
    // OD-10: the selector is a supervisor/technician thing; an investigator never holds it.
    expect(roleHas('SUPERVISOR', Permission.CAPTURE_CONFIG)).toBe(true);
    expect(roleHas('TECHNICIAN', Permission.CAPTURE_CONFIG)).toBe(true);
    expect(roleHas('INVESTIGATOR', Permission.CAPTURE_CONFIG)).toBe(false);
    // OD-15: an investigator and a supervisor revise transcripts; a technician does not.
    expect(roleHas('INVESTIGATOR', Permission.TRANSCRIPT_REVISE)).toBe(true);
    expect(roleHas('SUPERVISOR', Permission.TRANSCRIPT_REVISE)).toBe(true);
    expect(roleHas('TECHNICIAN', Permission.TRANSCRIPT_REVISE)).toBe(false);
    // Decision U10: the commissioning functions are the technician's alone - ONE role holds it.
    expect(roleHas('TECHNICIAN', Permission.CAPTURE_COMMISSION)).toBe(true);
    expect(roleHas('SUPERVISOR', Permission.CAPTURE_COMMISSION)).toBe(false);
    expect(roleHas('INVESTIGATOR', Permission.CAPTURE_COMMISSION)).toBe(false);
    expect(Object.entries(ROLE_PERMISSIONS).filter(([, list]) => (list as readonly string[]).includes(Permission.CAPTURE_COMMISSION)).map(([role]) => role)).toEqual(['TECHNICIAN']);
  });
});
