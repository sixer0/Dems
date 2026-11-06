// The actor scope of one hosted command (plan row W26; spec ENG-2, SR-79; AC-B-53; SD-22).
// Database-free: a headless simulator and the scope function.
import { AuthStatus, SimPermissionError, SimTransitionError, signedOutAuth, type AuthSlice } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { DURABLE_SLICE_KEYS } from '../../db/mapping';
import { createHost, type Host } from '../../../test/support/seed';
import { actorAuth, isSignedOut, withActorScope } from '../actor-scope';

const AT = Date.UTC(2026, 9, 1, 3, 0, 0);

describe('withActorScope', () => {
  it('the action runs as the operator, and the slice is signed out afterwards', async () => {
    const host = await createHost({ scenario: 'recording' });
    const investigator = host.operator('INVESTIGATOR');
    const before = host.state().audit.total;
    let during: AuthSlice | null = null;

    const result = withActorScope(host.sim.store, investigator.id, AT, () => {
      during = host.state().auth;
      host.sim.actions.addMarker('Key statement');
      return 'returned';
    });

    expect(result).toBe('returned');
    expect(during).toEqual({ status: AuthStatus.SIGNED_IN, operatorId: investigator.id, method: null, issuedAt: AT, lastActivityAt: AT });
    expect(during).toEqual(actorAuth(investigator.id, AT));
    expect(host.state().auth).toEqual(signedOutAuth());
    expect(isSignedOut(host.state().auth)).toBe(true);
    const row = host.state().audit.rows.at(-1);
    expect(host.state().audit.total).toBe(before + 1);
    expect(row).toMatchObject({ type: 'MARKER_ADDED', actorId: investigator.id });
  });

  it.each([
    ['a permission refusal', 'TECHNICIAN', (host: Host) => host.sim.actions.stopRecording('Interview completed'), SimPermissionError],
    ['an illegal transition', 'INVESTIGATOR', (host: Host) => host.sim.actions.startRecording(), SimTransitionError],
    ['an invalid note', 'INVESTIGATOR', (host: Host) => host.sim.actions.addNote(''), SimTransitionError],
  ] as const)('an action that throws (%s) leaves nobody signed in, changes no durable slice and appends no row', async (_label, role, action, errorClass) => {
    const host = await createHost({ scenario: 'recording' });
    const before = host.state();
    expect(() => withActorScope(host.sim.store, host.operator(role).id, AT, () => action(host))).toThrow(errorClass);
    const after = host.state();
    expect(after.auth).toEqual(signedOutAuth());
    for (const key of DURABLE_SLICE_KEYS) expect(after[key], key).toBe(before[key]);
  });

  it('what the action throws is thrown unchanged, also when it is not a simulator error', async () => {
    const host = await createHost({ scenario: 'idle' });
    const thrown = new TypeError('a defect');
    let caught: unknown;
    try {
      withActorScope(host.sim.store, host.operator('SUPERVISOR').id, AT, () => {
        throw thrown;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(thrown);
    expect(host.state().auth).toEqual(signedOutAuth());
  });

  it('between two commands an unchecked action has no actor, and the engine writes no row for an operator', async () => {
    const host = await createHost({ scenario: 'recording' });
    const investigator = host.operator('INVESTIGATOR');
    expect(() => withActorScope(host.sim.store, host.operator('TECHNICIAN').id, AT, () => host.sim.actions.stopRecording('Interview completed'))).toThrow();

    // An action that checks nothing itself (`recover` checks no permission) is NOT attributed to
    // the operator whose command threw before it.
    host.sim.actions.inject('POWER_FAIL');
    const total = host.state().audit.total;
    host.sim.actions.recover();
    const rows = host.state().audit.rows.filter((row) => row.seq > total);
    expect(rows.map((row) => row.type)).toContain('RECOVERY_STARTED');
    expect(rows.every((row) => row.actorId === null)).toBe(true);

    // Twenty minutes of ticks: the idle subsystem has nobody to expire.
    withActorScope(host.sim.store, investigator.id, AT, () => undefined);
    host.drive(20 * 60_000, 1_000);
    expect(host.state().audit.rows.some((row) => row.type === 'AUTH_EXPIRED' || row.type === 'AUTH_SIGNED_OUT')).toBe(false);
    expect(host.state().auth).toEqual(signedOutAuth());
  });

  it('negative control: the same scope WITHOUT the finally leaves the operator signed in, and a later action takes that actor', async () => {
    const host = await createHost({ scenario: 'recording' });
    const technician = host.operator('TECHNICIAN');
    const leakyScope = (action: () => void): void => {
      host.sim.store.setState({ auth: actorAuth(technician.id, AT) });
      action();
      host.sim.store.setState({ auth: signedOutAuth() });
    };
    expect(() => leakyScope(() => host.sim.actions.stopRecording('Interview completed'))).toThrow(SimPermissionError);
    expect(host.state().auth).toMatchObject({ status: AuthStatus.SIGNED_IN, operatorId: technician.id });

    host.sim.actions.inject('POWER_FAIL');
    const total = host.state().audit.total;
    host.sim.actions.recover();
    const started = host.state().audit.rows.find((row) => row.seq > total && row.type === 'RECOVERY_STARTED');
    expect(started?.actorId).toBe(technician.id);
  });

  it('subscribers of the store see the scope; the durable slices never hold it', async () => {
    const host = await createHost({ scenario: 'recording' });
    const seen: Array<string | null> = [];
    const unsubscribe = host.sim.store.subscribe((state) => seen.push(state.auth.operatorId));
    const investigator = host.operator('INVESTIGATOR');
    withActorScope(host.sim.store, investigator.id, AT, () => host.sim.actions.addNote('Subject asked for a break'));
    unsubscribe();
    expect(seen).toContain(investigator.id);
    expect(seen.at(-1)).toBeNull();
    expect((DURABLE_SLICE_KEYS as readonly string[]).includes('auth')).toBe(false);
  });

  // Wave H driver B, finding G75-02 (gate 75 `M5-SW-P`): on a Core in SIMULATED capture the switch of
  // the active microphone is the hosted action. The row must name the paired device the command came
  // from - the tablet's or the phone's device session - exactly as the real path does (SEC35-17).
  // Audit row 150 (D28 DQ-2; N-29, N-36): the hosted switch is RETIRED - it refuses with AUDIO_SOURCE_FIXED_BY_PAIRING and
  // writes no row, from a paired device session or a web console session alike. The scope still carries the device to
  // the action and still leaves with it, also when the action throws.
  it('G75-02 after D5: the paired device reaches the hosted action, which refuses (pairing code) and writes no switch row; the scope is cleared after the throw', async () => {
    const host = await createHost({ scenario: 'recording' });
    const investigator = host.operator('INVESTIGATOR');
    const switchRows = () => host.state().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');
    const standby = host.state().session?.audioSource?.standbyInputId ?? 'MIC-02';
    const before = switchRows().length;

    let during: AuthSlice | null = null;
    expect(() =>
      withActorScope(
        host.sim.store,
        investigator.id,
        AT,
        () => {
          during = host.state().auth;
          host.sim.actions.switchAudioSource(standby);
        },
        'DEV-0002',
      ),
    ).toThrow(expect.objectContaining({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' }));
    expect(during).toMatchObject({ operatorId: investigator.id, deviceId: 'DEV-0002' });
    // The device leaves with the scope, after the refusal too.
    expect(host.state().auth).toEqual(signedOutAuth());

    // CONTROL - a web console session: the same refusal.
    expect(() => withActorScope(host.sim.store, investigator.id, AT + 1_000, () => host.sim.actions.switchAudioSource(standby), null)).toThrow(
      expect.objectContaining({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' }),
    );
    expect(switchRows()).toHaveLength(before);
  });
});
