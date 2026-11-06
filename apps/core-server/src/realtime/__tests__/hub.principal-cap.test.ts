// The hub: the cap of one principal (plan row W42 follow-up; review finding CPS1-5; decisions
// D113, D116). One operator session may hold 4 sockets, one device credential 2. At that cap the
// NEWEST socket is admitted and the principal's OLDEST is closed with 1013, so a client is never
// kept out by its own earlier sockets, and no principal can take the places of the others. The
// caps shared by everybody (16 in all, 6 without a principal) are as they were. No socket and no
// database; the same rules run over real sockets in `upgrade.db.test.ts`.
import type { HelloMessage } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { CLOSE_REASON, REALTIME_MAX_PER_DEVICE, REALTIME_MAX_PER_SESSION } from '../limits';
import { ANONYMOUS, deviceAdmission, frame, operatorAdmission, testHub, type FakeTransport, type TestHub } from './hub-support';

type Opened = ReturnType<TestHub['open']>;
const REPLACED = { code: 1013, reason: CLOSE_REASON.REPLACED };
const closes = (sockets: readonly Opened[]): Array<number | null> => sockets.map((socket) => socket.transport.closed?.code ?? null);
const admitted = (transport: FakeTransport): boolean => transport.types()[0] === 'hello' && transport.closed === null;

/** `count` sockets of one web session, as the tabs of one browser profile open them. */
const tabs = (test: TestHub, count: number, sessionId = 'web-1', operatorId = 'OPR-001'): Opened[] =>
  Array.from({ length: count }, () => test.open(operatorAdmission({ operatorId, sessionId })));

describe('a web session: four sockets, then the newest takes the place of the oldest', () => {
  it('four tabs are open side by side; the fifth is admitted and the FIRST is closed with 1013', async () => {
    expect(REALTIME_MAX_PER_SESSION).toBe(4);
    // The loser reads another reason than a socket refused at a cap shared by everybody.
    expect([CLOSE_REASON.REPLACED, CLOSE_REASON.CAP]).toEqual(['replaced by a newer connection', 'connection cap']);
    const test = await testHub();
    const four = tabs(test, 4);
    expect(closes(four)).toEqual([null, null, null, null]);
    expect(test.hub.stats()).toMatchObject({ operators: 4, displaced: 0, refusedByCap: 0 });

    const [fifth] = tabs(test, 1);
    expect(closes(four)).toEqual([1013, null, null, null]);
    expect(four[0]?.transport.closed).toEqual(REPLACED);
    // The newcomer is a full OPERATOR socket: hello, its snapshot, the heartbeat.
    expect(fifth?.transport.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
    expect(fifth?.transport.messages()[0] as HelloMessage | undefined).toMatchObject({ type: 'hello', principal: 'OPERATOR' });
    expect(test.hub.stats()).toMatchObject({ operators: 4, connections: 4, sockets: 5, displaced: 1, refusedByCap: 0 });

    // The next one displaces the second, which is the oldest now.
    const [sixth] = tabs(test, 1);
    expect(closes(four)).toEqual([1013, 1013, null, null]);
    expect(admitted(sixth!.transport)).toBe(true);
    expect(test.hub.stats()).toMatchObject({ operators: 4, displaced: 2 });
  });

  it('a second operator is still admitted, and so is another session of the same operator: each session has its own four', async () => {
    const test = await testHub();
    const first = tabs(test, 4, 'web-1', 'OPR-001');
    const otherOperator = tabs(test, 4, 'web-2', 'OPR-002');
    const sameOperatorOtherBrowser = tabs(test, 2, 'web-1b', 'OPR-001');
    expect(closes([...first, ...otherOperator, ...sameOperatorOtherBrowser])).toEqual(Array.from({ length: 10 }, () => null));
    expect(test.hub.stats()).toMatchObject({ operators: 10, displaced: 0, refusedByCap: 0 });
    // One more of the first session displaces within that session only.
    tabs(test, 1, 'web-1', 'OPR-001');
    expect(closes(first)).toEqual([1013, null, null, null]);
    expect(closes([...otherOperator, ...sameOperatorOtherBrowser])).toEqual(Array.from({ length: 6 }, () => null));
  });

  it('the displaced socket is sent nothing more, and the log names it, its principal and the socket that replaced it, nothing else', async () => {
    const test = await testHub({ scenario: 'recording' });
    const four = tabs(test, 4);
    const [fifth] = tabs(test, 1);
    const sentBefore = four[0]?.transport.sent.length;
    test.engine.host.runAs(test.engine.host.operator('INVESTIGATOR'), () => test.engine.host.sim.actions.addMarker('After the displacement'));
    test.commit('command');
    test.hub.beat();
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    expect(four[0]?.transport.sent.length).toBe(sentBefore);
    expect(four[0]?.transport.closed).toEqual(REPLACED);
    // The four that are open got the delta, the heartbeat and the end of their session.
    expect(fifth?.transport.types().slice(-3)).toEqual(['delta', 'heartbeat', 'session.ended']);

    const line = test.log.lines.find((entry) => entry.message === 'socket closed: replaced by a newer socket of its principal');
    expect(line?.level).toBe('info');
    expect(line?.fields).toEqual({ connectionId: four[0]?.handle.connectionId, code: 1013, principal: 'operator:OPR-001', replacedBy: fifth?.handle.connectionId });
  });

  it('a socket that is being closed, or that the client closed, holds no place: the next one displaces nobody', async () => {
    const test = await testHub();
    const four = tabs(test, 4);
    // The server closes one (a protocol violation); the client closes another.
    four[1]?.handle.receive(frame('not json'), false);
    expect(four[1]?.transport.closed?.code).toBe(1008);
    four[2]?.handle.closed(1000);
    const two = tabs(test, 2);
    expect(closes(four)).toEqual([null, 1008, null, null]);
    expect(two.every((socket) => admitted(socket.transport))).toBe(true);
    expect(test.hub.stats()).toMatchObject({ operators: 4, displaced: 0 });
  });
});

describe('a paired device: two sockets of its device credential; a session on it is a principal of its own', () => {
  it('two sockets of the device credential are open; a third is admitted and the oldest is closed with 1013', async () => {
    expect(REALTIME_MAX_PER_DEVICE).toBe(2);
    const test = await testHub();
    const own = test.open(deviceAdmission('DEV-0001'));
    // A retry of the app: its new socket and the one it replaces overlap.
    const overlap = test.open(deviceAdmission('DEV-0001'));
    await test.hub.tabletLink.settled();
    expect(closes([own, overlap])).toEqual([null, null]);
    expect(test.hub.stats()).toMatchObject({ devices: 2, displaced: 0 });

    const third = test.open(deviceAdmission('DEV-0001'));
    expect(closes([own, overlap, third])).toEqual([1013, null, null]);
    expect(own.transport.closed).toEqual(REPLACED);
    expect(third.transport.types()).toEqual(['hello', 'heartbeat']);
    expect(test.hub.stats()).toMatchObject({ devices: 2, operators: 0, displaced: 1, refusedByCap: 0 });

    // The device never left: it is online throughout and the link was set once.
    await test.hub.tabletLink.settled();
    expect(test.presence.online()).toEqual(['DEV-0001']);
    expect(test.hub.tabletLink.open).toBe(2);
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    const line = test.log.lines.find((entry) => entry.message === 'socket closed: replaced by a newer socket of its principal');
    expect(line?.fields).toEqual({ connectionId: own.handle.connectionId, code: 1013, principal: 'device:DEV-0001', replacedBy: third.handle.connectionId });
  });

  it('the device\'s own socket, a password session and a biometric session of one operator on that device are three principals: all three stay open', async () => {
    // What the pairing acceptance test holds on one device (AC-B-82): a cap counted per device
    // across its sessions would close the device's own socket here.
    const test = await testHub();
    const own = test.open(deviceAdmission('DEV-0001'));
    const password = test.open(operatorAdmission({ sessionId: 'dev-password', deviceId: 'DEV-0001' }));
    const biometric = test.open(operatorAdmission({ sessionId: 'dev-biometric', deviceId: 'DEV-0001' }));
    expect(closes([own, password, biometric])).toEqual([null, null, null]);
    expect(test.hub.stats()).toMatchObject({ devices: 1, operators: 2, displaced: 0, refusedByCap: 0 });
    // Ending one of the sessions closes its socket and neither of the others.
    test.hub.publish({ kind: 'session.ended', sessionIds: ['dev-biometric'], reason: 'SIGNED_OUT' });
    expect(closes([own, password, biometric])).toEqual([null, null, 4401]);
  });

  it('a session on a device has the four of any session: its fifth socket closes its own oldest, and neither the device\'s socket nor another session on the device', async () => {
    const test = await testHub();
    const own = test.open(deviceAdmission('DEV-0001'));
    const otherSession = test.open(operatorAdmission({ operatorId: 'OPR-002', sessionId: 'dev-2', deviceId: 'DEV-0001' }));
    const four = Array.from({ length: 4 }, () => test.open(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' })));
    expect(closes([own, otherSession, ...four])).toEqual([null, null, null, null, null, null]);
    const fifth = test.open(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' }));
    expect(closes([own, otherSession, ...four, fifth])).toEqual([null, null, 1013, null, null, null, null]);
    expect(four[0]?.transport.closed).toEqual(REPLACED);
    expect(test.hub.stats()).toMatchObject({ devices: 1, operators: 5, displaced: 1 });
  });

  it('another device, and a web session of the same operator, are other principals', async () => {
    const test = await testHub();
    const tablet = [test.open(deviceAdmission('DEV-0001')), test.open(deviceAdmission('DEV-0001')), test.open(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' }))];
    const phone = [test.open(deviceAdmission('DEV-0002')), test.open(deviceAdmission('DEV-0002')), test.open(operatorAdmission({ sessionId: 'dev-2', deviceId: 'DEV-0002' }))];
    const web = tabs(test, 4, 'web-1');
    expect(closes([...tablet, ...phone, ...web])).toEqual(Array.from({ length: 10 }, () => null));
    expect(test.hub.stats()).toMatchObject({ devices: 4, operators: 6, displaced: 0 });
  });
});

describe('a reconnect storm of one client does not lock it out, and costs nobody else anything', () => {
  it('forty sockets of one session in a row, none of them closed by the client: every one is admitted, four are open, the others were displaced', async () => {
    const test = await testHub();
    const bystanders = [test.open(operatorAdmission({ operatorId: 'OPR-002', sessionId: 'web-2', role: 'SUPERVISOR' })), test.open(deviceAdmission('DEV-0009'))];
    const anonymous = Array.from({ length: 6 }, () => test.open(ANONYMOUS));

    const storm: Opened[] = [];
    for (let index = 0; index < 40; index += 1) {
      const [socket] = tabs(test, 1);
      storm.push(socket!);
      // Each newcomer is a working OPERATOR socket at the moment it is admitted.
      expect(socket?.transport.types(), `socket ${index + 1}`).toEqual(['hello', 'snapshot', 'heartbeat']);
      expect(socket?.transport.closed).toBeNull();
      expect(test.hub.stats().operators).toBeLessThanOrEqual(1 + REALTIME_MAX_PER_SESSION);
    }
    expect(closes(storm)).toEqual([...Array.from({ length: 36 }, () => 1013), null, null, null, null]);
    expect(test.hub.stats()).toMatchObject({ connections: 12, operators: 5, devices: 1, anonymous: 6, displaced: 36, refusedByCap: 0 });
    // Nobody else was touched, and there is room for others as before.
    expect(closes([...bystanders, ...anonymous])).toEqual(Array.from({ length: 8 }, () => null));
    expect(admitted(test.open(operatorAdmission({ operatorId: 'OPR-003', sessionId: 'web-3' })).transport)).toBe(true);
  });

  it('the same for a device that reconnects again and again with its device credential: two are open, never more, and the session on it is not touched', async () => {
    const test = await testHub();
    const signedIn = test.open(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' }));
    const storm = Array.from({ length: 20 }, () => test.open(deviceAdmission('DEV-0001')));
    expect(closes(storm)).toEqual([...Array.from({ length: 18 }, () => 1013), null, null]);
    expect(signedIn.transport.closed).toBeNull();
    expect(test.hub.stats()).toMatchObject({ devices: 2, operators: 1, displaced: 18, refusedByCap: 0 });
    await test.hub.tabletLink.settled();
    expect(test.hub.tabletLink.open).toBe(3);
    expect(test.presence.online()).toEqual(['DEV-0001']);
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
  });

  it('displaced sockets that their peer never closes are destroyed at the close deadline and forgotten: the storm leaves nothing behind', async () => {
    const test = await testHub();
    const storm = tabs(test, 12);
    expect(test.hub.stats()).toMatchObject({ sockets: 12, connections: 4 });
    test.clock.advance(test.hub.limits.closeGraceMs);
    test.hub.pace();
    expect(storm.slice(0, 8).every((socket) => socket.transport.terminated)).toBe(true);
    expect(storm.slice(8).some((socket) => socket.transport.terminated)).toBe(false);
    for (const socket of storm.slice(0, 8)) socket.handle.closed(1006);
    expect(test.hub.stats()).toMatchObject({ sockets: 4, connections: 4, terminated: 8 });
  });
});

describe('the caps shared by everybody are unchanged', () => {
  /** Six anonymous sockets, two web sessions with four tabs each, one device credential with two sockets: 16. */
  function full(test: TestHub) {
    const anonymous = Array.from({ length: 6 }, () => test.open(ANONYMOUS));
    const first = tabs(test, 4, 'web-1', 'OPR-001');
    const second = tabs(test, 4, 'web-2', 'OPR-002');
    const device = [test.open(deviceAdmission('DEV-0001')), test.open(deviceAdmission('DEV-0001'))];
    return { anonymous, first, second, device, all: [...anonymous, ...first, ...second, ...device] };
  }

  it('sixteen sockets are open with every principal at its own cap; a seventeenth of a NEW principal is closed with 1013 and displaces nobody', async () => {
    const test = await testHub();
    const hub = full(test);
    expect(closes(hub.all)).toEqual(Array.from({ length: 16 }, () => null));
    expect(test.hub.stats()).toMatchObject({ connections: 16, anonymous: 6, operators: 8, devices: 2, displaced: 0 });

    for (const admission of [operatorAdmission({ operatorId: 'OPR-004', sessionId: 'web-4' }), deviceAdmission('DEV-0002'), ANONYMOUS]) {
      const beyond = test.open(admission);
      expect(beyond.transport.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
      expect(beyond.transport.sent).toEqual([]);
    }
    expect(closes(hub.all)).toEqual(Array.from({ length: 16 }, () => null));
    expect(test.hub.stats()).toMatchObject({ connections: 16, refusedByCap: 3, displaced: 0 });
  });

  it('with the hub full, a principal at its own cap still reconnects: its newest takes the place of its oldest and the total stays 16', async () => {
    const test = await testHub();
    const hub = full(test);
    const [reconnected] = tabs(test, 1, 'web-1', 'OPR-001');
    expect(admitted(reconnected!.transport)).toBe(true);
    expect(closes(hub.first)).toEqual([1013, null, null, null]);
    expect(closes([...hub.anonymous, ...hub.second, ...hub.device])).toEqual(Array.from({ length: 12 }, () => null));
    const again = test.open(deviceAdmission('DEV-0001'));
    expect(admitted(again.transport)).toBe(true);
    expect(closes(hub.device)).toEqual([1013, null]);
    expect(test.hub.stats()).toMatchObject({ connections: 16, displaced: 2, refusedByCap: 0 });
  });

  it('with the hub full, a principal BELOW its own cap is refused like anybody, as before: its sockets are not swapped to make room', async () => {
    const test = await testHub();
    const anonymous = Array.from({ length: 6 }, () => test.open(ANONYMOUS));
    const others = [...tabs(test, 4, 'web-1', 'OPR-001'), ...tabs(test, 4, 'web-2', 'OPR-002')];
    const tablet = [test.open(deviceAdmission('DEV-0001')), test.open(operatorAdmission({ operatorId: 'OPR-003', sessionId: 'dev-3', deviceId: 'DEV-0001' }))];
    expect(test.hub.stats()).toMatchObject({ connections: 16, operators: 9, devices: 1 });
    // One device socket of two, one socket of the session's four: both below their caps.
    for (const admission of [deviceAdmission('DEV-0001'), operatorAdmission({ operatorId: 'OPR-003', sessionId: 'dev-3', deviceId: 'DEV-0001' })]) {
      const beyond = test.open(admission);
      expect(beyond.transport.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
      expect(beyond.transport.sent).toEqual([]);
    }
    expect(closes([...anonymous, ...others, ...tablet])).toEqual(Array.from({ length: 16 }, () => null));
    expect(test.hub.stats()).toMatchObject({ connections: 16, displaced: 0, refusedByCap: 2 });
  });

  it('a socket without a principal has no cap of its own: the seventh is refused, not swapped for the first', async () => {
    const test = await testHub();
    const six = Array.from({ length: 6 }, () => test.open(ANONYMOUS));
    const seventh = test.open(ANONYMOUS);
    expect(seventh.transport.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
    expect(closes(six)).toEqual([null, null, null, null, null, null]);
    expect(test.hub.stats()).toMatchObject({ anonymous: 6, displaced: 0, refusedByCap: 1 });
  });

  it('an upgrade whose session ended before it arrived is admitted without a principal and counts under none', async () => {
    const test = await testHub();
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    const late = tabs(test, 6);
    expect(closes(late)).toEqual([null, null, null, null, null, null]);
    expect(test.hub.stats()).toMatchObject({ anonymous: 6, operators: 0, displaced: 0 });
    // They are anonymous sockets, so the anonymous cap is what refuses the seventh.
    expect(tabs(test, 1)[0]?.transport.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
  });

  it('a bearer value that did not resolve is told so and counts under no principal', async () => {
    const test = await testHub();
    for (let index = 0; index < 5; index += 1) {
      const refused = test.open({ kind: 'ANONYMOUS', reason: 'DEVICE_REVOKED', closeCode: 4403 });
      expect(refused.transport.closed?.code).toBe(4403);
    }
    expect(test.hub.stats()).toMatchObject({ connections: 0, displaced: 0, refusedByCap: 0 });
  });
});
