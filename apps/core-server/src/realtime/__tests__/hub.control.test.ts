// The hub: who is told and who is closed (plan row W42; spec §4.7, §9.2, §9.4; SR-41, SR-74;
// AC-B-19, AC-B-20). The mapping of a publication to sockets by the IDs the upgrade resolved, the
// memory for an upgrade that was resolved before a publication, the presence counter and the
// tablet link. No socket and no database; the real triggers run in `control.db.test.ts`.
import type { SessionEndedReason as ContractSessionEndedReason } from '@dems/shared/api';
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { CLOSE_REASON, REALTIME_ENDED_MEMORY_MS, TABLET_LINK_DEBOUNCE_MS, TABLET_LINK_RETRY_MS } from '../limits';
import type { SessionEndedReason } from '../publication';
import { ANONYMOUS, deviceAdmission, operatorAdmission, testHub, type TestHub } from './hub-support';

/** The sockets of one scene: two operators on the web and on a device, a second device, an anonymous one. */
function scene(test: TestHub) {
  const sockets = {
    investigatorWeb: test.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'web-1' })),
    investigatorWebTwo: test.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'web-1b' })),
    investigatorDevice: test.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'dev-1', deviceId: 'DEV-0001' })),
    supervisorWeb: test.open(operatorAdmission({ operatorId: 'OPR-002', sessionId: 'web-2', role: 'SUPERVISOR' })),
    technicianDevice: test.open(operatorAdmission({ operatorId: 'OPR-003', sessionId: 'dev-3', deviceId: 'DEV-0002', role: 'TECHNICIAN' })),
    tabletOne: test.open(deviceAdmission('DEV-0001')),
    tabletTwo: test.open(deviceAdmission('DEV-0002')),
    anonymous: test.open(ANONYMOUS),
  };
  for (const socket of Object.values(sockets)) socket.transport.clear();
  return sockets;
}

type Scene = ReturnType<typeof scene>;
const received = (sockets: Scene): Record<string, string[]> =>
  Object.fromEntries(Object.entries(sockets).map(([name, socket]) => [name, socket.transport.types()]));
const closedWith = (sockets: Scene): Record<string, number | null> =>
  Object.fromEntries(Object.entries(sockets).map(([name, socket]) => [name, socket.transport.closed?.code ?? null]));
const NOBODY = { investigatorWeb: null, investigatorWebTwo: null, investigatorDevice: null, supervisorWeb: null, technicianDevice: null, tabletOne: null, tabletTwo: null, anonymous: null };
const NOTHING = Object.fromEntries(Object.keys(NOBODY).map((name) => [name, [] as string[]]));

describe('session.updated: a role change (AC-B-19)', () => {
  it('goes to every socket of that operator\'s sessions, on the web and on a device, and to nobody else; nobody is closed', async () => {
    const test = await testHub();
    const sockets = scene(test);
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.TECHNICIAN, permissions: ROLE_PERMISSIONS.TECHNICIAN });
    expect(received(sockets)).toEqual({ ...NOTHING, investigatorWeb: ['session.updated'], investigatorWebTwo: ['session.updated'], investigatorDevice: ['session.updated'] });
    expect(closedWith(sockets)).toEqual(NOBODY);
    expect(sockets.investigatorWeb.transport.messages()[0]).toEqual({
      type: 'session.updated',
      v: 1,
      operator: { id: 'OPR-001', role: 'TECHNICIAN' },
      permissions: [...ROLE_PERMISSIONS.TECHNICIAN],
      reason: 'ROLE_CHANGED',
    });
  });

  it('the permissions sent are the publication\'s, as read in the unit that changed the role, not a table of this process', async () => {
    const test = await testHub();
    const sockets = scene(test);
    const stored = [Permission.EVIDENCE_VIEW, Permission.USER_ADMIN];
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.TECHNICIAN, permissions: stored });
    expect(sockets.investigatorWeb.transport.messages()[0]).toMatchObject({ permissions: stored });
    expect(test.hub.connections().find((connection) => connection.sessionId === 'web-1')).toMatchObject({ role: 'TECHNICIAN', permissions: stored });
  });

  it('the topic membership follows at once: admin.changed goes to whoever holds the permission after the change', async () => {
    const test = await testHub();
    const sockets = scene(test);
    // The supervisor makes the investigator a supervisor: session.updated first, then admin.changed.
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.SUPERVISOR, permissions: ROLE_PERMISSIONS.SUPERVISOR });
    test.hub.publish({ kind: 'admin.changed', resource: 'USERS' });
    expect(received(sockets)).toEqual({
      ...NOTHING,
      investigatorWeb: ['session.updated', 'admin.changed'],
      investigatorWebTwo: ['session.updated', 'admin.changed'],
      investigatorDevice: ['session.updated', 'admin.changed'],
      supervisorWeb: ['admin.changed'],
    });
    // And back: an operator who lost USER_ADMIN is no holder any more when the hint is sent.
    for (const socket of Object.values(sockets)) socket.transport.clear();
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.INVESTIGATOR, permissions: ROLE_PERMISSIONS.INVESTIGATOR });
    test.hub.publish({ kind: 'admin.changed', resource: 'USERS' });
    expect(received(sockets)).toEqual({
      ...NOTHING,
      investigatorWeb: ['session.updated'],
      investigatorWebTwo: ['session.updated'],
      investigatorDevice: ['session.updated'],
      supervisorWeb: ['admin.changed'],
    });
  });
});

describe('admin.changed: a hint for the holders of the permission (spec §9.2)', () => {
  it.each([
    ['USERS', Permission.USER_ADMIN],
    ['DEVICES', Permission.PAIRING_MANAGE],
    ['PAIRING_CODE', Permission.PAIRING_MANAGE],
  ] as const)('%s goes to OPERATOR sockets that hold %s, names the list only, and reaches no DEVICE or ANONYMOUS socket', async (resource, permission) => {
    const test = await testHub();
    const holder = test.open(operatorAdmission({ operatorId: 'OPR-009', sessionId: 'holder', permissions: [permission] }));
    const other = test.open(
      operatorAdmission({ operatorId: 'OPR-008', sessionId: 'other', permissions: Object.values(Permission).filter((candidate) => candidate !== permission) }),
    );
    const device = test.open(deviceAdmission());
    const anonymous = test.open(ANONYMOUS);
    for (const socket of [holder, other, device, anonymous]) socket.transport.clear();
    test.hub.publish({ kind: 'admin.changed', resource });
    expect(holder.transport.messages()).toEqual([{ type: 'admin.changed', v: 1, resource }]);
    for (const socket of [other, device, anonymous]) expect(socket.transport.sent).toEqual([]);
  });
});

describe('session.ended: the event, then close 4401, on exactly the sockets of those sessions (SR-41, AC-B-20)', () => {
  const REASONS: readonly SessionEndedReason[] = ['SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'ROTATED', 'USER_DISABLED', 'TOKEN_REUSE'];

  it.each(REASONS)('%s', async (reason) => {
    const test = await testHub();
    const sockets = scene(test);
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason });
    expect(received(sockets)).toEqual({ ...NOTHING, investigatorWeb: ['session.ended'] });
    expect(closedWith(sockets)).toEqual({ ...NOBODY, investigatorWeb: 4401 });
    expect(sockets.investigatorWeb.transport.messages()[0]).toEqual({ type: 'session.ended', v: 1, reason });
    expect(sockets.investigatorWeb.transport.closed).toEqual({ code: 4401, reason: CLOSE_REASON.SESSION_ENDED });
  });

  it('the reasons of the seam are the reasons of the contract', () => {
    const contract: readonly ContractSessionEndedReason[] = REASONS;
    expect(contract).toHaveLength(6);
  });

  it('several sessions in one publication (a disabled user): each of their sockets, and another session of nobody else', async () => {
    const test = await testHub();
    const sockets = scene(test);
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1', 'web-1b', 'dev-1'], reason: 'USER_DISABLED' });
    expect(closedWith(sockets)).toEqual({ ...NOBODY, investigatorWeb: 4401, investigatorWebTwo: 4401, investigatorDevice: 4401 });
    expect(received(sockets)).toEqual({ ...NOTHING, investigatorWeb: ['session.ended'], investigatorWebTwo: ['session.ended'], investigatorDevice: ['session.ended'] });
    // The device of the ended bearer session keeps its own socket: only the session ended.
    expect(sockets.tabletOne.transport.closed).toBeNull();
  });

  it('nothing is sent after the close, and a session nobody holds a socket for changes nothing', async () => {
    const test = await testHub({ scenario: 'recording' });
    const sockets = scene(test);
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    test.hub.publish({ kind: 'session.ended', sessionIds: ['no-such-session'], reason: 'SIGNED_OUT' });
    test.engine.host.drive(1000);
    test.commit('tick');
    test.hub.beat();
    expect(sockets.investigatorWeb.transport.types()).toEqual(['session.ended']);
    expect(sockets.investigatorWebTwo.transport.types()).toEqual(['delta', 'heartbeat']);
    expect(test.hub.stats().operators).toBe(4);
  });
});

describe('device.revoked: the event, then close 4403, on every socket of the device (spec §4.7)', () => {
  it.each(['REVOKED', 'UNPAIRED'] as const)('%s: its DEVICE socket and the sockets of sessions bound to it; no other device, no web session', async (reason) => {
    const test = await testHub();
    const sockets = scene(test);
    test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0001', reason });
    expect(received(sockets)).toEqual({ ...NOTHING, investigatorDevice: ['device.revoked'], tabletOne: ['device.revoked'] });
    expect(closedWith(sockets)).toEqual({ ...NOBODY, investigatorDevice: 4403, tabletOne: 4403 });
    expect(sockets.tabletOne.transport.messages()[0]).toEqual({ type: 'device.revoked', v: 1, reason });
    expect(sockets.tabletOne.transport.closed).toEqual({ code: 4403, reason: CLOSE_REASON.DEVICE_REVOKED });
  });

  it('a DEVICE socket is sent nothing else of the control topic', async () => {
    const test = await testHub();
    const sockets = scene(test);
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.SUPERVISOR, permissions: ROLE_PERMISSIONS.SUPERVISOR });
    test.hub.publish({ kind: 'session.ended', sessionIds: ['dev-1'], reason: 'SIGNED_OUT' });
    test.hub.publish({ kind: 'admin.changed', resource: 'DEVICES' });
    expect(sockets.tabletOne.transport.sent).toEqual([]);
    expect(sockets.tabletTwo.transport.sent).toEqual([]);
    expect(sockets.anonymous.transport.sent).toEqual([]);
  });
});

describe('an upgrade that was resolved before a publication and arrives after it (SR-41)', () => {
  it('a web session that ended meanwhile is admitted as ANONYMOUS with SESSION_INVALID and gets no state', async () => {
    const test = await testHub();
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    const { transport } = test.open(operatorAdmission({ sessionId: 'web-1' }));
    expect(transport.types()).toEqual(['hello', 'heartbeat']);
    expect(transport.messages()[0]).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID', topics: ['heartbeat'] });
    expect(transport.closed).toBeNull();
    expect(test.hub.connections()[0]).toMatchObject({ principal: 'ANONYMOUS', operatorId: null, sessionId: null });
    // Another session of the same operator is not touched.
    expect(test.open(operatorAdmission({ sessionId: 'web-2' })).transport.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
  });

  it('a bearer session that ended meanwhile gets hello with SESSION_INVALID and close 4401', async () => {
    const test = await testHub();
    test.hub.publish({ kind: 'session.ended', sessionIds: ['dev-1'], reason: 'TOKEN_REUSE' });
    const { transport } = test.open(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' }));
    expect(transport.types()).toEqual(['hello']);
    expect(transport.messages()[0]).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID' });
    expect(transport.closed?.code).toBe(4401);
    expect(test.presence.isOnline('DEV-0001')).toBe(false);
  });

  it('a device that was retired meanwhile gets hello with DEVICE_REVOKED and close 4403, as DEVICE and as the session of an operator', async () => {
    const test = await testHub();
    test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0001', reason: 'REVOKED' });
    for (const admission of [deviceAdmission('DEV-0001'), operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' })]) {
      const { transport } = test.open(admission);
      expect(transport.types()).toEqual(['hello']);
      expect(transport.messages()[0]).toMatchObject({ principal: 'ANONYMOUS', reason: 'DEVICE_REVOKED' });
      expect(transport.closed?.code).toBe(4403);
    }
    expect(test.open(deviceAdmission('DEV-0002')).transport.closed).toBeNull();
    expect(test.presence.online()).toEqual(['DEV-0002']);
  });

  it('a role that changed meanwhile: the socket is admitted with the published role and its permissions', async () => {
    const test = await testHub();
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.SUPERVISOR, permissions: ROLE_PERMISSIONS.SUPERVISOR });
    const { transport } = test.open(operatorAdmission({ operatorId: 'OPR-001', role: 'INVESTIGATOR' }));
    expect(transport.messages()[0]).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters', 'admin'] });
    expect(test.hub.connections()[0]).toMatchObject({ role: 'SUPERVISOR', permissions: ROLE_PERMISSIONS.SUPERVISOR });
    // Another operator is admitted as stage 4 read it.
    expect(test.open(operatorAdmission({ operatorId: 'OPR-003', sessionId: 'other', role: 'TECHNICIAN' })).transport.messages()[0]).toMatchObject({
      topics: ['heartbeat', 'control', 'state', 'meters'],
    });
  });

  it('a new epoch forgets the published roles (a reset re-seeds them) and keeps the ended sessions', async () => {
    const test = await testHub();
    test.hub.publish({ kind: 'session.updated', operatorId: 'OPR-001', role: OperatorRole.SUPERVISOR, permissions: ROLE_PERMISSIONS.SUPERVISOR });
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    expect(test.open(operatorAdmission({ operatorId: 'OPR-001', sessionId: 'web-9' })).transport.messages()[0]).toMatchObject({
      topics: ['heartbeat', 'control', 'state', 'meters'],
    });
    expect(test.open(operatorAdmission({ sessionId: 'web-1' })).transport.messages()[0]).toMatchObject({ principal: 'ANONYMOUS' });
  });

  it('the memory lasts 60 s of the server clock and is cleared by the pace step', async () => {
    expect(REALTIME_ENDED_MEMORY_MS).toBe(60_000);
    const test = await testHub();
    test.hub.publish({ kind: 'session.ended', sessionIds: ['web-1'], reason: 'SIGNED_OUT' });
    test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0001', reason: 'UNPAIRED' });
    test.clock.advance(REALTIME_ENDED_MEMORY_MS - 1);
    test.hub.pace();
    expect(test.open(operatorAdmission({ sessionId: 'web-1' })).transport.messages()[0]).toMatchObject({ principal: 'ANONYMOUS' });
    expect(test.open(deviceAdmission('DEV-0001')).transport.closed?.code).toBe(4403);
    test.clock.advance(1);
    test.hub.pace();
    // Past the memory the hub decides as stage 4 did; a real upgrade this late cannot resolve.
    expect(test.open(operatorAdmission({ sessionId: 'web-1' })).transport.messages()[0]).toMatchObject({ principal: 'OPERATOR' });
    expect(test.open(deviceAdmission('DEV-0001')).transport.closed).toBeNull();
  });
});

describe('the presence counter and the tablet link (spec §6.5, §6.8; decision D93 DN-6)', () => {
  it('a DEVICE socket and an OPERATOR socket bound to a device count; a web session and an anonymous socket do not', async () => {
    const test = await testHub();
    const web = test.open(operatorAdmission());
    test.open(ANONYMOUS);
    await test.hub.tabletLink.settled();
    expect(test.presence.online()).toEqual([]);
    expect(test.engine.linkCalls).toEqual([]);

    const tablet = test.open(deviceAdmission('DEV-0001'));
    const signedIn = test.open(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' }));
    const other = test.open(operatorAdmission({ sessionId: 'dev-2', deviceId: 'DEV-0002' }));
    await test.hub.tabletLink.settled();
    expect(test.presence.online().sort()).toEqual(['DEV-0001', 'DEV-0002']);
    expect(test.hub.tabletLink.open).toBe(3);
    // CONNECTED once, at the first device socket.
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);

    tablet.handle.closed(1000);
    expect(test.presence.isOnline('DEV-0001')).toBe(true);
    signedIn.handle.closed(1000);
    expect(test.presence.isOnline('DEV-0001')).toBe(false);
    other.handle.closed(1000);
    web.handle.closed(1000);
    expect(test.presence.online()).toEqual([]);
    expect(test.hub.tabletLink.open).toBe(0);
  });

  it('the link goes OFFLINE 5 s after the last device socket closed, at the pace step, and not earlier', async () => {
    expect(TABLET_LINK_DEBOUNCE_MS).toBe(5_000);
    const test = await testHub();
    const tablet = test.open(deviceAdmission());
    await test.hub.tabletLink.settled();
    expect(test.engine.state().tabletLink.state).toBe('CONNECTED');

    tablet.handle.closed(1006);
    test.clock.advance(TABLET_LINK_DEBOUNCE_MS - 1);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    test.clock.advance(1);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED', 'OFFLINE']);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED', 'OFFLINE']);
  });

  it('a device that reconnects within 5 s does not toggle the link', async () => {
    const test = await testHub();
    const first = test.open(deviceAdmission());
    await test.hub.tabletLink.settled();
    first.handle.closed(1006);
    test.clock.advance(TABLET_LINK_DEBOUNCE_MS - 1);
    test.hub.pace();
    test.open(deviceAdmission());
    test.clock.advance(60_000);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    expect(test.engine.state().tabletLink.state).toBe('CONNECTED');
  });

  it('a revoked device takes the link OFFLINE at once when no other device socket is open, and not while one is', async () => {
    const test = await testHub();
    test.open(deviceAdmission('DEV-0001'));
    const second = test.open(deviceAdmission('DEV-0002'));
    await test.hub.tabletLink.settled();
    test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0001', reason: 'REVOKED' });
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    expect(test.presence.online()).toEqual(['DEV-0002']);

    second.transport.clear();
    test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0002', reason: 'UNPAIRED' });
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED', 'OFFLINE']);
    expect(test.presence.online()).toEqual([]);
  });

  it('a socket that the server closes leaves the presence counter with the close, not when the peer answers', async () => {
    const test = await testHub();
    const tablet = test.open(deviceAdmission());
    test.hub.publish({ kind: 'device.revoked', deviceId: 'DEV-0001', reason: 'REVOKED' });
    expect(test.presence.isOnline('DEV-0001')).toBe(false);
    tablet.handle.closed(4403);
    expect(test.hub.tabletLink.open).toBe(0);
  });

  it('a call that was not committed is tried again, not before 1 s, and reported once', async () => {
    expect(TABLET_LINK_RETRY_MS).toBe(1_000);
    const test = await testHub();
    test.engine.failNextLink = true;
    test.open(deviceAdmission());
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    expect(test.engine.state().tabletLink.state).toBe('OFFLINE');
    test.clock.advance(TABLET_LINK_RETRY_MS - 1);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    test.clock.advance(1);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED', 'CONNECTED']);
    expect(test.engine.state().tabletLink.state).toBe('CONNECTED');
    const reports = test.log.lines.filter((line) => line.message.startsWith('the tablet link could not be set'));
    expect(reports).toHaveLength(1);
    expect(Object.keys(reports[0]?.fields ?? {}).sort()).toEqual(['err', 'link']);
    expect(test.log.persisted).toHaveLength(1);
    expect(test.log.persisted[0]).toMatchObject({ level: 'warn', source: 'realtime.tabletLink', context: { link: 'CONNECTED' } });
  });

  it('a run of failures is reported once; after a call that was committed, the next failure is reported again', async () => {
    const test = await testHub();
    const reports = (): number => test.log.lines.filter((line) => line.message.startsWith('the tablet link could not be set')).length;
    test.engine.failNextLink = true;
    const tablet = test.open(deviceAdmission());
    await test.hub.tabletLink.settled();
    expect(reports()).toBe(1);
    // The retry fails too: the same run, no second report.
    test.engine.failNextLink = true;
    test.clock.advance(TABLET_LINK_RETRY_MS);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED', 'CONNECTED']);
    expect([reports(), test.log.persisted.length]).toEqual([1, 1]);
    // The third try is committed.
    test.clock.advance(TABLET_LINK_RETRY_MS);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.state().tabletLink.state).toBe('CONNECTED');
    // A new failure later is a new run.
    tablet.handle.closed(1006);
    test.engine.failNextLink = true;
    test.clock.advance(TABLET_LINK_DEBOUNCE_MS);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED', 'CONNECTED', 'CONNECTED', 'OFFLINE']);
    expect([reports(), test.log.persisted.length]).toEqual([2, 2]);
  });

  it('while the engine does not run nothing is set; after its start the link follows the open sockets again', async () => {
    const test = await testHub();
    test.engine.stop();
    test.open(deviceAdmission());
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual([]);
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
  });

  it('the stop of the server sets nothing: the engine has stopped, and the next start writes the truthful row', async () => {
    const test = await testHub();
    test.open(deviceAdmission());
    await test.hub.tabletLink.settled();
    test.engine.stop();
    test.hub.shutdown();
    test.clock.advance(60_000);
    test.hub.pace();
    await test.hub.tabletLink.settled();
    expect(test.engine.linkCalls).toEqual(['CONNECTED']);
    expect(test.presence.online()).toEqual([]);
  });
});
