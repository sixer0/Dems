// E-fix FX-C (backend task 2026-10-04; decision D201 ruling R4; E2E-S-2, RESIDUAL-W70-1): a
// paired device's sign-in or sign-out (the publication `device.session`) and the admission or
// departure of a device's socket reach the holders of PAIRING_MANAGE as ONE debounced
// `admin.changed DEVICES`, so Paired Devices' Operator and Online columns and the Devices drawer
// read the registry again. Before the fix the hub published nothing for any of the four, and the
// open page kept "—" until a reload (07e_e2e_pairing.md steps 4 and 6).
//
// No socket and no database: the hub with a manual clock, as `hub.control.test.ts`. The real
// sign-in and sign-out publications run in `src/modules/identity/__tests__/device-session.db.test.ts`.
import { describe, expect, it } from 'vitest';
import { DEVICES_CHANGED_DEBOUNCE_MS, DEVICES_CHANGED_MAX_WAIT_MS, REALTIME_DELTA_PACE_MS, REALTIME_LIMITS, TABLET_LINK_DEBOUNCE_MS } from '../limits';
import { ANONYMOUS, deviceAdmission, operatorAdmission, testHub, type TestHub } from './hub-support';

/** A supervisor's console (holds PAIRING_MANAGE), an investigator's console (does not), and an anonymous socket. */
async function watchers(test?: TestHub) {
  const hub = test ?? (await testHub());
  const holder = hub.open(operatorAdmission({ operatorId: 'OPR-002', sessionId: 'web-2', role: 'SUPERVISOR' }));
  const other = hub.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'web-1', role: 'INVESTIGATOR' }));
  const anonymous = hub.open(ANONYMOUS);
  expect(holder.transport.types()).toContain('snapshot');
  const clear = () => {
    for (const socket of [holder, other, anonymous]) socket.transport.clear();
  };
  clear();
  /** The `admin.changed` messages the holder got, by resource. */
  const told = () => holder.transport.messages().flatMap((message) => (message.type === 'admin.changed' ? [message.resource] : []));
  const nobodyElse = () => {
    expect(other.transport.types().filter((type) => type === 'admin.changed')).toEqual([]);
    expect(anonymous.transport.types().filter((type) => type === 'admin.changed')).toEqual([]);
  };
  return { test: hub, holder, other, anonymous, told, nobodyElse, clear };
}

/** Moves the clock in pace steps, as the plugin's 250 ms timer does. */
function paceFor(test: TestHub, ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed += REALTIME_DELTA_PACE_MS) {
    test.clock.advance(REALTIME_DELTA_PACE_MS);
    test.hub.pace();
  }
}

describe('admin.changed DEVICES for a device\'s sign-in, sign-out, socket admission and departure (R4)', () => {
  it('the numbers: 1 s without another change, at most 5 s from the first change of a run (its own limit, W91-3)', () => {
    expect(DEVICES_CHANGED_DEBOUNCE_MS).toBe(1_000);
    expect(DEVICES_CHANGED_MAX_WAIT_MS).toBe(5_000);
    expect(REALTIME_LIMITS.devicesChangedDebounceMs).toBe(DEVICES_CHANGED_DEBOUNCE_MS);
    expect(REALTIME_LIMITS.devicesChangedMaxWaitMs).toBe(DEVICES_CHANGED_MAX_WAIT_MS);
  });

  it('a device socket admitted: one message 1 s later, at the pace step, and not earlier; nobody without the permission', async () => {
    const w = await watchers();
    w.test.open(deviceAdmission('DEV-0001'));
    expect(w.test.presence.isOnline('DEV-0001')).toBe(true);
    paceFor(w.test, DEVICES_CHANGED_DEBOUNCE_MS - REALTIME_DELTA_PACE_MS);
    expect(w.told()).toEqual([]);
    paceFor(w.test, REALTIME_DELTA_PACE_MS);
    expect(w.told()).toEqual(['DEVICES']);
    paceFor(w.test, 10_000);
    expect(w.told()).toEqual(['DEVICES']);
    w.nobodyElse();
  });

  it('a device socket departed: one message, and the registry it makes the page read says offline', async () => {
    const w = await watchers();
    const tablet = w.test.open(deviceAdmission('DEV-0001'));
    paceFor(w.test, 2_000);
    w.clear();
    tablet.handle.closed(1006);
    expect(w.test.presence.isOnline('DEV-0001')).toBe(false);
    paceFor(w.test, 2_000);
    expect(w.told()).toEqual(['DEVICES']);
    w.nobodyElse();
  });

  it('a sign-in (`device.session`) and the socket the app opens 400 ms later are ONE message, not two', async () => {
    const w = await watchers();
    w.test.hub.publish({ kind: 'device.session', deviceIds: ['DEV-0001'] });
    paceFor(w.test, 400);
    w.test.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'dev-1', deviceId: 'DEV-0001' }));
    paceFor(w.test, 3_000);
    expect(w.told()).toEqual(['DEVICES']);
  });

  it('a sign-out: the session\'s sockets close (departure) and `device.session` arrives: ONE message', async () => {
    const w = await watchers();
    w.test.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'dev-1', deviceId: 'DEV-0001' }));
    paceFor(w.test, 2_000);
    w.clear();
    w.test.hub.publish({ kind: 'session.ended', sessionIds: ['dev-1'], reason: 'SIGNED_OUT' });
    w.test.hub.publish({ kind: 'device.session', deviceIds: ['DEV-0001'] });
    paceFor(w.test, 3_000);
    expect(w.told()).toEqual(['DEVICES']);
  });

  it('two separate transitions, 3 s apart, are two messages: one per transition after the debounce', async () => {
    const w = await watchers();
    w.test.hub.publish({ kind: 'device.session', deviceIds: ['DEV-0001'] });
    paceFor(w.test, 3_000);
    w.test.hub.publish({ kind: 'device.session', deviceIds: ['DEV-0001'] });
    paceFor(w.test, 3_000);
    expect(w.told()).toEqual(['DEVICES', 'DEVICES']);
  });

  it('no flood: a device that reconnects every 500 ms for 20 s is told at most once per 5 s', async () => {
    const w = await watchers();
    const at: number[] = [];
    let count = 0;
    for (let step = 0; step < 40; step += 1) {
      const socket = w.test.open(deviceAdmission('DEV-0001'));
      for (let half = 0; half < 2; half += 1) {
        w.test.clock.advance(REALTIME_DELTA_PACE_MS);
        w.test.hub.pace();
        if (w.told().length > count) {
          count = w.told().length;
          at.push(w.test.clock.now());
        }
      }
      socket.handle.closed(1006);
    }
    expect(at.length).toBe(4);
    const gaps = at.slice(1).map((time, index) => time - (at[index] ?? 0));
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(DEVICES_CHANGED_MAX_WAIT_MS);
  });

  it('the longest wait is the device change\'s own limit, not the tablet link\'s (W91-3): retuning one leaves the other', async () => {
    // A hub whose tablet link debounces for 2 s and whose device changes may wait 4 s: a device
    // that reconnects every 500 ms is told every 4 s (5 times in 20 s), not every 2 s.
    const w = await watchers(await testHub({ limits: { tabletLinkDebounceMs: 2_000, devicesChangedMaxWaitMs: 4_000 } }));
    expect(TABLET_LINK_DEBOUNCE_MS).not.toBe(2_000);
    const at: number[] = [];
    let count = 0;
    for (let step = 0; step < 40; step += 1) {
      const socket = w.test.open(deviceAdmission('DEV-0001'));
      for (let half = 0; half < 2; half += 1) {
        w.test.clock.advance(REALTIME_DELTA_PACE_MS);
        w.test.hub.pace();
        if (w.told().length > count) {
          count = w.told().length;
          at.push(w.test.clock.now());
        }
      }
      socket.handle.closed(1006);
    }
    const gaps = at.slice(1).map((time, index) => time - (at[index] ?? 0));
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap).toBe(4_000);
  });

  it('an immediate admin.changed DEVICES (a revoke) also answers what waited: one message, not a second one a second later', async () => {
    const w = await watchers();
    w.test.open(deviceAdmission('DEV-0001'));
    paceFor(w.test, 2_000);
    w.clear();
    // The revoke's publications: its sockets close (a departure), then the list changed.
    w.test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0001', reason: 'REVOKED' });
    w.test.hub.publish({ kind: 'admin.changed', resource: 'DEVICES' });
    expect(w.told()).toEqual(['DEVICES']);
    paceFor(w.test, 3_000);
    expect(w.told()).toEqual(['DEVICES']);
  });

  it('a web console\'s socket is no device: its admission and departure tell nobody', async () => {
    const w = await watchers();
    const web = w.test.open(operatorAdmission({ operatorId: 'OPR-003', sessionId: 'web-3', role: 'TECHNICIAN' }));
    web.handle.closed(1000);
    w.test.open(ANONYMOUS);
    paceFor(w.test, 3_000);
    expect(w.told()).toEqual([]);
  });

  it('after the shutdown nothing waits and nothing is sent', async () => {
    const w = await watchers();
    w.test.hub.publish({ kind: 'device.session', deviceIds: ['DEV-0001'] });
    w.test.hub.shutdown();
    paceFor(w.test, 3_000);
    expect(w.told()).toEqual([]);
  });
});
