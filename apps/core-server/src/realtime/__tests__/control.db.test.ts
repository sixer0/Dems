// Control events over REAL sockets, caused by the REAL operations (plan row W42; spec §4.7, §6.8,
// §9.4; SR-12, SR-41, SR-74; AC-B-19, AC-B-20). Each trigger is the route of the module that
// owns it, called through the stages: a role change, a disable, a sign-out, a rotation, an
// expiry by the sweeper, a revoke, an unpair. What is asserted is what the sockets of the
// affected sessions and devices receive, that they are closed with the specified code, that
// nobody else is, and that it happens within the control deadline of 1 s.
import { performance } from 'node:perf_hooks';
import type { DeltaMessage, SessionUpdatedMessage } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, ROLE_PERMISSIONS } from '@dems/shared/sim';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { disableUrl, enableUrl, roleUrl } from '../../../test/support/admin';
import { MINUTE, SIGN_IN, SIGN_OUT, TOUCH } from '../../../test/support/identity';
import { DEVICES, UNPAIR, revokeUrl } from '../../../test/support/pairing';
import { REALTIME_CONTROL_DEADLINE_MS, TABLET_LINK_DEBOUNCE_MS } from '../limits';
import { replay } from './hub-support';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  WEB_ORIGIN,
  bearer,
  deviceHeaders,
  deviceOperator,
  openSocket,
  operatorSocket,
  pairedDevice,
  realtimeApp,
  settle,
  untilSockets,
  useSockets,
  webHeaders,
  webOperator,
  webPost,
  type RealtimeApp,
  type TestSocket,
  type WebOperator,
} from '../../../test/support/realtime';

const db = useTestDatabase({ template: 'seed' });
let rt: RealtimeApp;
let supervisor: WebOperator;

useSockets(() => rt);

beforeAll(async () => {
  rt = await realtimeApp(db);
  supervisor = await webOperator(rt, SUPERVISOR);
});

beforeEach(() => {
  rt.forgetCounters();
});

/** Milliseconds of REAL time since `from`: the deadline of RT-P12 is measured, not waited for. */
const since = (from: number): number => performance.now() - from;

const auditTypesOf = (socket: TestSocket, from: number): string[] =>
  (socket.messages.slice(from).filter((message) => message.type === 'delta') as DeltaMessage[]).flatMap((delta) =>
    delta.ops.flatMap((op) => (op.op === 'append' && op.slice === 'audit' ? op.rows.map((row) => row.type) : [])),
  );
const replacedSlicesOf = (socket: TestSocket, from: number): string[] =>
  (socket.messages.slice(from).filter((message) => message.type === 'delta') as DeltaMessage[]).flatMap((delta) =>
    delta.ops.flatMap((op) => (op.op === 'replace' ? [op.slice] : [])),
  );
const typesFrom = (socket: TestSocket, from: number): string[] => socket.types().slice(from);

describe('AC-B-19: a role change', () => {
  it('pushes session.updated to every socket of that operator within 1 s, a delta of operators to every operator socket, and admin.changed to the holders of USER_ADMIN', async () => {
    const technician = await webOperator(rt, TECHNICIAN);
    const tablet = await pairedDevice(rt, supervisor);
    const technicianOnTablet = await deviceOperator(rt, tablet, TECHNICIAN);
    const investigator = await webOperator(rt, INVESTIGATOR);
    const sockets = {
      supervisor: await operatorSocket(rt, webHeaders(supervisor.cookie)),
      technicianWeb: await operatorSocket(rt, webHeaders(technician.cookie)),
      technicianDevice: await operatorSocket(rt, deviceHeaders(technicianOnTablet.token)),
      investigator: await operatorSocket(rt, webHeaders(investigator.cookie)),
      device: openSocket(rt.wsUrl, deviceHeaders(tablet.credential)),
    };
    await sockets.device.nextOf('heartbeat');
    await rt.channel.settled();
    await settle(rt, ...Object.values(sockets));
    const marks = Object.fromEntries(Object.entries(sockets).map(([name, socket]) => [name, socket.messages.length]));

    const sentAt = performance.now();
    const response = await webPost(rt.app, roleUrl(TECHNICIAN.id), supervisor.cookie, { role: 'SUPERVISOR', reason: 'Acting supervisor for the night shift' });
    expect(response.statusCode).toBe(200);
    for (const socket of [sockets.technicianWeb, sockets.technicianDevice]) {
      const updated = await socket.next<SessionUpdatedMessage>('session.updated', (message) => message.type === 'session.updated');
      expect(since(sentAt)).toBeLessThan(REALTIME_CONTROL_DEADLINE_MS);
      expect(updated.operator).toEqual({ id: TECHNICIAN.id, role: 'SUPERVISOR' });
      expect(updated.reason).toBe('ROLE_CHANGED');
      // The stored grants of the new role, as the next request of that session is given them.
      expect([...updated.permissions].sort()).toEqual([...ROLE_PERMISSIONS.SUPERVISOR].sort());
    }
    await settle(rt, ...Object.values(sockets));
    expect(since(sentAt)).toBeLessThan(REALTIME_CONTROL_DEADLINE_MS);

    // Every operator socket: the audit row, then the replaced operators slice; nobody was closed.
    for (const name of ['supervisor', 'technicianWeb', 'technicianDevice', 'investigator'] as const) {
      const socket = sockets[name];
      expect(auditTypesOf(socket, marks[name] ?? 0), name).toEqual(['ROLE_CHANGED']);
      expect(replacedSlicesOf(socket, marks[name] ?? 0), name).toContain('operators');
      const operators = replay(socket.messages).state['operators'] as Array<{ id: string; role: string }>;
      expect(operators.find((operator) => operator.id === TECHNICIAN.id)?.role, name).toBe('SUPERVISOR');
      expect(socket.ws.readyState, name).toBe(socket.ws.OPEN);
    }
    // session.updated to the operator's sockets only; admin.changed to whoever holds USER_ADMIN NOW.
    const control = (name: keyof typeof sockets): string[] => typesFrom(sockets[name], marks[name] ?? 0).filter((type) => type === 'session.updated' || type === 'admin.changed');
    expect(control('supervisor')).toEqual(['admin.changed']);
    expect(control('technicianWeb')).toEqual(['session.updated', 'admin.changed']);
    expect(control('technicianDevice')).toEqual(['session.updated', 'admin.changed']);
    expect(control('investigator')).toEqual([]);
    expect(typesFrom(sockets.device, marks['device'] ?? 0)).toEqual(['heartbeat']);
    // The channel holds what the next request would be given, on both sessions of that operator.
    for (const connection of rt.channel.connections().filter((entry) => entry.operatorId === TECHNICIAN.id)) {
      expect(connection.role).toBe('SUPERVISOR');
      expect([...connection.permissions].sort()).toEqual([...ROLE_PERMISSIONS.SUPERVISOR].sort());
    }

    // And back: the same sessions, no new sign-in; the demoted operator is no holder when the hint is sent.
    const back = Object.fromEntries(Object.entries(sockets).map(([name, socket]) => [name, socket.messages.length]));
    expect((await webPost(rt.app, roleUrl(TECHNICIAN.id), supervisor.cookie, { role: 'TECHNICIAN', reason: 'The shift ended' })).statusCode).toBe(200);
    await settle(rt, ...Object.values(sockets));
    const controlBack = (name: keyof typeof sockets): string[] => typesFrom(sockets[name], back[name] ?? 0).filter((type) => type === 'session.updated' || type === 'admin.changed');
    expect(controlBack('technicianWeb')).toEqual(['session.updated']);
    expect(controlBack('technicianDevice')).toEqual(['session.updated']);
    expect(controlBack('supervisor')).toEqual(['admin.changed']);
    expect(controlBack('investigator')).toEqual([]);
    const demoted = sockets.technicianWeb.messages.filter((message) => message.type === 'session.updated').at(-1) as SessionUpdatedMessage;
    expect(demoted.operator).toEqual({ id: TECHNICIAN.id, role: 'TECHNICIAN' });
    expect([...demoted.permissions].sort()).toEqual([...ROLE_PERMISSIONS.TECHNICIAN].sort());
    expect(rt.channel.stats().healed).toBe(0);
  });
});

describe('AC-B-20: a disabled user', () => {
  it('every socket of the operator\'s sessions gets session.ended USER_DISABLED and is closed with 4401 within 1 s; nobody else is; the credentials open no OPERATOR socket any more', async () => {
    const technician = await webOperator(rt, TECHNICIAN);
    const tablet = await pairedDevice(rt, supervisor);
    const technicianOnTablet = await deviceOperator(rt, tablet, TECHNICIAN);
    const web = await operatorSocket(rt, webHeaders(technician.cookie));
    const webTwo = await operatorSocket(rt, webHeaders(technician.cookie));
    const mobile = await operatorSocket(rt, deviceHeaders(technicianOnTablet.token));
    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    const admin = await operatorSocket(rt, webHeaders(supervisor.cookie));
    await device.nextOf('heartbeat');
    await rt.channel.settled();
    await settle(rt, web, webTwo, mobile, device, admin);
    const adminMark = admin.messages.length;

    const sentAt = performance.now();
    expect((await webPost(rt.app, disableUrl(TECHNICIAN.id), supervisor.cookie, { reason: 'Left the unit' })).statusCode).toBe(200);
    for (const socket of [web, webTwo, mobile]) {
      const closed = await socket.closed;
      expect(since(sentAt)).toBeLessThan(REALTIME_CONTROL_DEADLINE_MS);
      expect(closed.code).toBe(4401);
      expect(socket.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'USER_DISABLED' });
    }
    await settle(rt, device, admin);
    // The device of the ended bearer session keeps its own socket; the administrator is told the list changed.
    expect(device.ws.readyState).toBe(device.ws.OPEN);
    expect(device.types()).not.toContain('session.ended');
    expect(typesFrom(admin, adminMark).filter((type) => type !== 'heartbeat' && type !== 'delta')).toEqual(['admin.changed']);
    expect(auditTypesOf(admin, adminMark)).toEqual(['USER_DISABLED']);

    // The same cookie now opens an ANONYMOUS socket; the same bearer value is told 4401.
    const again = openSocket(rt.wsUrl, webHeaders(technician.cookie));
    expect(await again.nextOf('hello')).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID' });
    const bearerAgain = openSocket(rt.wsUrl, deviceHeaders(technicianOnTablet.token));
    expect(await bearerAgain.nextOf('hello')).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID' });
    expect((await bearerAgain.closed).code).toBe(4401);

    // An enable ends nothing and tells the administrators that the list changed.
    const enableMark = admin.messages.length;
    expect((await webPost(rt.app, enableUrl(TECHNICIAN.id), supervisor.cookie, { reason: 'Back on duty' })).statusCode).toBe(200);
    await settle(rt, admin);
    expect(typesFrom(admin, enableMark).filter((type) => type !== 'heartbeat' && type !== 'delta')).toEqual(['admin.changed']);
  });
});

describe('a session that ends by itself (spec §4.7): session.ended, then close 4401, on that session\'s sockets only', () => {
  it('a sign-out ends the sockets of that session; another session of the same operator and its sockets stay', async () => {
    const first = await webOperator(rt, INVESTIGATOR);
    const tablet = await pairedDevice(rt, supervisor);
    const second = await deviceOperator(rt, tablet, INVESTIGATOR);
    const web = await operatorSocket(rt, webHeaders(first.cookie));
    const mobile = await operatorSocket(rt, deviceHeaders(second.token));

    const sentAt = performance.now();
    expect((await webPost(rt.app, SIGN_OUT, first.cookie, { reason: 'LOCK' })).statusCode).toBe(204);
    expect((await web.closed).code).toBe(4401);
    expect(since(sentAt)).toBeLessThan(REALTIME_CONTROL_DEADLINE_MS);
    expect(web.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'SIGNED_OUT' });
    await settle(rt, mobile);
    expect(mobile.ws.readyState).toBe(mobile.ws.OPEN);
    expect(mobile.types()).not.toContain('session.ended');

    // A sign-out of the device session through its bearer value.
    expect((await rt.app.inject({ method: 'POST', url: SIGN_OUT, headers: bearer(second.token) })).statusCode).toBe(204);
    expect((await mobile.closed).code).toBe(4401);
    expect(mobile.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'SIGNED_OUT' });
  });

  it('a sign-in that presents a session replaces it: the socket of the old session gets ROTATED and 4401', async () => {
    const old = await webOperator(rt, INVESTIGATOR);
    const socket = await operatorSocket(rt, webHeaders(old.cookie));
    const response = await rt.app.inject({
      method: 'POST',
      url: SIGN_IN,
      headers: { origin: WEB_ORIGIN, ...old.cookie },
      payload: { username: INVESTIGATOR.username, password: DEMO_OPERATOR_PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    expect((await socket.closed).code).toBe(4401);
    expect(socket.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'ROTATED' });
  });

  it('a reused biometric token (the publication of the biometric module): TOKEN_REUSE and 4401 on the sockets of exactly those sessions (SR-74)', async () => {
    const tablet = await pairedDevice(rt, supervisor);
    const onTablet = await deviceOperator(rt, tablet, INVESTIGATOR);
    const mobile = await operatorSocket(rt, deviceHeaders(onTablet.token));
    const web = await operatorSocket(rt, webHeaders((await webOperator(rt, INVESTIGATOR)).cookie));
    const sessionId = rt.channel.connections().find((connection) => connection.deviceId === tablet.deviceId && connection.principal === 'OPERATOR')?.sessionId;
    if (typeof sessionId !== 'string') throw new Error('the device session has no socket');

    const sentAt = performance.now();
    rt.app.publish({ kind: 'session.ended', sessionIds: [sessionId], reason: 'TOKEN_REUSE' });
    expect((await mobile.closed).code).toBe(4401);
    expect(since(sentAt)).toBeLessThan(REALTIME_CONTROL_DEADLINE_MS);
    expect(mobile.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'TOKEN_REUSE' });
    await settle(rt, web);
    expect(web.ws.readyState).toBe(web.ws.OPEN);
  });

  it('the sweeper ends a session after 15 minutes without activity: IDLE_EXPIRED and 4401; a session that was active stays', async () => {
    const idle = await webOperator(rt, INVESTIGATOR);
    const active = await webOperator(rt, TECHNICIAN);
    const idleSocket = await operatorSocket(rt, webHeaders(idle.cookie));
    const activeSocket = await operatorSocket(rt, webHeaders(active.cookie));
    const supervisorSocket = await operatorSocket(rt, webHeaders(supervisor.cookie));

    rt.clock.advance(14 * MINUTE);
    expect((await webPost(rt.app, TOUCH, active.cookie)).statusCode).toBe(200);
    expect((await webPost(rt.app, TOUCH, supervisor.cookie)).statusCode).toBe(200);
    rt.clock.advance(MINUTE);
    // Sessions that earlier tests left open are past the limit too; this test looks at its own three.
    expect((await rt.control.sweep()).length).toBeGreaterThanOrEqual(1);

    expect((await idleSocket.closed).code).toBe(4401);
    expect(idleSocket.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'IDLE_EXPIRED' });
    await settle(rt, activeSocket, supervisorSocket);
    expect(activeSocket.ws.readyState).toBe(activeSocket.ws.OPEN);
    // The socket itself is no activity: an open console does not keep its session alive (ID-P9).
    expect(auditTypesOf(supervisorSocket, 0)).toContain('AUTH_EXPIRED');
  });

  it('eight hours after the sign-in the session ends whatever its activity: ABSOLUTE_EXPIRED and 4401', async () => {
    const operator = await webOperator(rt, INVESTIGATOR);
    const socket = await operatorSocket(rt, webHeaders(operator.cookie));
    // 34 touches, 14 minutes apart: active all the time, and 7 h 56 min old.
    for (let step = 0; step < 34; step += 1) {
      rt.clock.advance(14 * MINUTE);
      rt.forgetCounters();
      expect((await webPost(rt.app, TOUCH, operator.cookie)).statusCode).toBe(200);
    }
    await rt.control.sweep();
    await settle(rt, socket);
    expect(socket.ws.readyState).toBe(socket.ws.OPEN);
    expect(socket.types()).not.toContain('session.ended');
    rt.clock.advance(4 * MINUTE);
    await rt.control.sweep();
    expect((await socket.closed).code).toBe(4401);
    expect(socket.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'ABSOLUTE_EXPIRED' });
    // The supervisor of this file signed in at the start and is past the idle limit by now.
    supervisor = await webOperator(rt, SUPERVISOR);
  });
});

describe('a device that is revoked or unpaired (spec §4.7): device.revoked, then close 4403, on every socket of the device', () => {
  it('a revoke by the supervisor: the device\'s own socket and the socket of the session bound to it, within 1 s; web sessions stay; the holders of PAIRING_MANAGE are told', async () => {
    const tablet = await pairedDevice(rt, supervisor, 'Tablet to revoke');
    const onTablet = await deviceOperator(rt, tablet, INVESTIGATOR);
    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    await device.nextOf('heartbeat');
    const mobile = await operatorSocket(rt, deviceHeaders(onTablet.token));
    const web = await operatorSocket(rt, webHeaders((await webOperator(rt, INVESTIGATOR)).cookie));
    const admin = await operatorSocket(rt, webHeaders(supervisor.cookie));
    await rt.channel.settled();
    await settle(rt, device, mobile, web, admin);
    const marks = { web: web.messages.length, admin: admin.messages.length };

    const sentAt = performance.now();
    expect((await webPost(rt.app, revokeUrl(tablet.deviceId), supervisor.cookie, { reason: 'The tablet was lost' })).statusCode).toBe(200);
    for (const socket of [device, mobile]) {
      const closed = await socket.closed;
      expect(since(sentAt)).toBeLessThan(REALTIME_CONTROL_DEADLINE_MS);
      expect(closed.code).toBe(4403);
      expect(socket.messages.at(-1)).toEqual({ type: 'device.revoked', v: 1, reason: 'REVOKED' });
      // No session.ended is sent for the session the revoke ended: its socket is the device's.
      expect(socket.types()).not.toContain('session.ended');
    }
    await rt.channel.settled();
    await settle(rt, web, admin);
    expect(web.ws.readyState).toBe(web.ws.OPEN);
    expect(typesFrom(web, marks.web).filter((type) => type !== 'heartbeat' && type !== 'delta')).toEqual([]);
    expect(typesFrom(admin, marks.admin).filter((type) => type !== 'heartbeat' && type !== 'delta')).toEqual(['admin.changed']);
    // The tablet link is compared again at once (no other device socket is open): OFFLINE, with its row.
    expect(auditTypesOf(admin, marks.admin)).toEqual(['DEVICE_REVOKED', 'TABLET_LINK_CHANGED']);
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');

    // The retired credential and the token of its session open nothing any more.
    for (const value of [tablet.credential, onTablet.token]) {
      const again = openSocket(rt.wsUrl, deviceHeaders(value));
      expect(await again.nextOf('hello')).toMatchObject({ principal: 'ANONYMOUS', reason: 'DEVICE_REVOKED' });
      expect((await again.closed).code).toBe(4403);
    }
  });

  it('an unpair by the device itself: UNPAIRED and 4403 on its sockets', async () => {
    const tablet = await pairedDevice(rt, supervisor, 'Tablet to unpair');
    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    await device.nextOf('heartbeat');
    const second = openSocket(rt.wsUrl, { ...bearer(tablet.credential) });
    await second.nextOf('heartbeat');
    expect((await rt.app.inject({ method: 'POST', url: UNPAIR, headers: bearer(tablet.credential) })).statusCode).toBe(204);
    for (const socket of [device, second]) {
      expect((await socket.closed).code).toBe(4403);
      expect(socket.messages.at(-1)).toEqual({ type: 'device.revoked', v: 1, reason: 'UNPAIRED' });
    }
    await rt.channel.settled();
  });
});

describe('the presence of a device and the tablet link, from real sockets (spec §6.5, §6.8; decision D93 DN-6)', () => {
  const onlineOf = async (deviceId: string): Promise<boolean | undefined> => {
    const response = await rt.app.inject({ method: 'GET', url: DEVICES, headers: supervisor.cookie });
    expect(response.statusCode).toBe(200);
    return (response.json() as { devices: Array<{ id: string; online: boolean }> }).devices.find((device) => device.id === deviceId)?.online;
  };

  it('the registry lists a device online while it holds a socket; the link is CONNECTED with the first device socket and OFFLINE 5 s after the last one closed', async () => {
    await untilSockets(rt, 0);
    rt.steps.advance(TABLET_LINK_DEBOUNCE_MS);
    rt.channel.pace();
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');

    const tablet = await pairedDevice(rt, supervisor, 'Tablet with a link');
    const admin = await operatorSocket(rt, webHeaders(supervisor.cookie));
    expect(await onlineOf(tablet.deviceId)).toBe(false);
    const mark = admin.messages.length;

    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    await device.nextOf('heartbeat');
    await rt.channel.settled();
    expect(await onlineOf(tablet.deviceId)).toBe(true);
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    await settle(rt, admin);
    expect(auditTypesOf(admin, mark)).toEqual(['TABLET_LINK_CHANGED']);
    expect(replacedSlicesOf(admin, mark)).toContain('tabletLink');

    // The socket drops and comes back within 5 s: the registry follows, the link does not toggle.
    device.terminate();
    await untilSockets(rt, 1);
    expect(await onlineOf(tablet.deviceId)).toBe(false);
    rt.steps.advance(TABLET_LINK_DEBOUNCE_MS - 250);
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    const back = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    await back.nextOf('heartbeat');
    rt.steps.advance(TABLET_LINK_DEBOUNCE_MS);
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    expect(await onlineOf(tablet.deviceId)).toBe(true);

    // It drops and stays away: OFFLINE at the pace step 5 s later, with the row and the event.
    const beforeOffline = admin.messages.length;
    back.terminate();
    await untilSockets(rt, 1);
    rt.steps.advance(TABLET_LINK_DEBOUNCE_MS - 250);
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    rt.steps.advance(250);
    // The clock stands at the instant the debounce ends; the pace step that finds it there sets the link.
    rt.channel.pace();
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');
    rt.channel.pace();
    await settle(rt, admin);
    expect(auditTypesOf(admin, beforeOffline)).toEqual(['TABLET_LINK_CHANGED']);
    expect(replay(admin.messages).state['tabletLink']).toMatchObject({ state: 'OFFLINE' });
    expect(rt.channel.stats().healed).toBe(0);
  });

  it('the session of an operator on a device counts as a socket of that device; a web session does not', async () => {
    await untilSockets(rt, 0);
    const tablet = await pairedDevice(rt, supervisor, 'Tablet with a session');
    const onTablet = await deviceOperator(rt, tablet, INVESTIGATOR);
    await operatorSocket(rt, webHeaders(supervisor.cookie));
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');
    expect(await onlineOf(tablet.deviceId)).toBe(false);
    await operatorSocket(rt, deviceHeaders(onTablet.token));
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    expect(await onlineOf(tablet.deviceId)).toBe(true);
  });
});
