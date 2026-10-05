// The stop of a listening server (plan row W42; spec §8.6 "Stop", §9.4 close code 1001; rule P4:
// every listener of a test is closed, and nothing of it remains). The real app on a seeded clone,
// a real listener on an ephemeral loopback port, three open sockets, then `app.close()`.
import { connect } from 'node:net';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { replay } from './hub-support';
import {
  INVESTIGATOR,
  SUPERVISOR,
  deviceHeaders,
  deviceOperator,
  openSocket,
  operatorSocket,
  pairedDevice,
  realtimeApp,
  webHeaders,
  webOperator,
  type RealtimeApp,
} from '../../../test/support/realtime';

const db = useTestDatabase({ template: 'seed' });
let rt: RealtimeApp;

beforeAll(async () => {
  rt = await realtimeApp(db);
});

/** True when nothing accepts a connection on the port any more. */
function refuses(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code === 'ECONNREFUSED'));
  });
}

describe('the stop of the server', () => {
  it('the engine stops first, then every socket is closed with 1001, the timers stop, and the listener is gone', async () => {
    const supervisor = await webOperator(rt, SUPERVISOR);
    const tablet = await pairedDevice(rt, supervisor);
    const onTablet = await deviceOperator(rt, tablet, INVESTIGATOR);
    const web = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const mobile = await operatorSocket(rt, deviceHeaders(onTablet.token));
    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    const anonymous = openSocket(rt.wsUrl);
    await Promise.all([device.nextOf('heartbeat'), anonymous.nextOf('heartbeat')]);
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    expect(rt.channel.stats()).toMatchObject({ connections: 4, sockets: 4 });
    expect(rt.channel.running).toBe(true);
    expect(rt.app.server.listening).toBe(true);
    expect(await refuses(rt.port)).toBe(false);
    const logMark = rt.log.lines().length;

    await rt.app.close();

    for (const socket of [web, mobile, device, anonymous]) expect((await socket.closed).code).toBe(1001);
    // What the engine wrote in its last unit reached the operators before their sockets closed, without a gap.
    for (const socket of [web, mobile]) expect(replay(socket.messages).revision).toBe(rt.engine.revision);
    expect(rt.channel.stats()).toMatchObject({ connections: 0, sockets: 0 });
    expect(rt.channel.running).toBe(false);
    expect(rt.steps.active()).toBe(0);
    expect(rt.app.server.listening).toBe(false);
    expect(await refuses(rt.port)).toBe(true);

    // The close order (spec §8.6): the engine's hook ran before the channel's.
    const messages = rt.log.lines().slice(logMark).map((line) => String(line['msg']));
    const engineStopped = messages.indexOf('engine stopped');
    const firstSocketClosed = messages.indexOf('socket closed');
    expect(engineStopped).toBeGreaterThanOrEqual(0);
    expect(firstSocketClosed).toBeGreaterThan(engineStopped);
    expect(messages.filter((message) => message === 'socket closed')).toHaveLength(4);
    // The channel did not touch the tablet link on the way out: the engine had stopped, and no call failed.
    expect(messages.filter((message) => message.startsWith('the tablet link could not be set'))).toEqual([]);

    // A second close is harmless (the helper closes the app again before it drops the clone).
    await rt.app.close();
  });
});
