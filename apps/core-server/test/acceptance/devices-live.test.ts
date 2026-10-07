// Acceptance test "Paired Devices stays live" of the DEMS Core server (E-fix FX-C; decision D201
// ruling R4; defect E2E-S-2 of `test/07e_e2e_pairing.md`, the family of RESIDUAL-W70-1).
//
// WHAT WAS BROKEN. The portal's Paired Devices page and the Devices drawer read the registry
// (operation 19: `online`, `signedInOperatorId`) again only on `admin.changed DEVICES`. A paired
// device's sign-in, sign-out, socket admission and departure published none, so the Operator
// cell stayed "—" for 46 s after the phone signed in, until a reload.
//
// WHAT IS ASKED. Each of the four transitions reaches the supervisor's portal socket (it holds
// PAIRING_MANAGE) as exactly ONE `admin.changed DEVICES` after the debounce, and the registry it
// makes the portal read already shows the new state; an investigator's console (no permission)
// and the device's own sockets get none. No flood: a sign-in and the socket the app opens right
// after it are one message.
//
// WHAT IS REAL. The real app on the file's own clone of the seed, booted, LISTENING on an
// ephemeral loopback port; every REST call through the real stages; every socket a real
// WebSocket. The server clock and the channel's timers are manual: `steps.advance` moves them.
//
// SECRETS (P19). The device credential and the session token are taken from an answer and handed
// on; none is printed or handed to an assertion. Assertions see counts, booleans and IDs.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  closeAllSockets,
  deviceHeaders,
  deviceOperator,
  openSocket,
  operatorSocket,
  pairedDevice,
  realtimeApp,
  settle,
  untilSockets,
  webHeaders,
  webOperator,
  type DeviceOperator,
  type RealtimeApp,
  type TestSocket,
  type WebOperator,
} from '../support/realtime';
import { useTestDatabase } from '../helpers/db';
import { SIGN_OUT, bearer, get } from '../support/identity';
import { DEVICES, INVESTIGATOR, SUPERVISOR, type PairedTestDevice } from '../support/pairing';

const db = useTestDatabase({ template: 'seed' });

// Caps, not waits: a clone waits for the clone lock, which the runs of other rows may hold.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

/** The numbers of the ruling, stated here and not taken from the code under test. */
const DEBOUNCE_MS = 1_000;
const PACE_MS = 250;

let rt: RealtimeApp;
let supervisor: WebOperator;
let portal: TestSocket;
let investigatorConsole: TestSocket;
let device: PairedTestDevice;

// The sockets live across the steps of the journey (one `it` per transition), so they are closed
// once, at the end, instead of after each test (`useSockets` would close them after step 1).
beforeAll(async () => {
  rt = await realtimeApp(db);
  supervisor = await webOperator(rt, SUPERVISOR);
  device = await pairedDevice(rt, supervisor);
});

afterAll(async () => {
  closeAllSockets();
  if (rt !== undefined) await untilSockets(rt, 0);
});

/** `admin.changed DEVICES` messages a socket got from position `from` on. */
const devicesHints = (socket: TestSocket, from = 0): number =>
  socket.messages.slice(from).filter((message) => message.type === 'admin.changed' && message.resource === 'DEVICES').length;

/** What the portal's next read of operation 19 says about the device. */
async function registryRow(): Promise<{ online: boolean; signedInOperatorId: string | null }> {
  const response = await get(rt.app, DEVICES, supervisor.cookie);
  expect(response.statusCode).toBe(200);
  const row = (response.json() as { devices: Array<{ id: string; online: boolean; signedInOperatorId: string | null }> }).devices.find(
    (candidate) => candidate.id === device.deviceId,
  );
  if (row === undefined) throw new Error('the paired device is not in the registry');
  return { online: row.online, signedInOperatorId: row.signedInOperatorId };
}

// ONE JOURNEY (review finding W91-15): the `it` blocks below are its labelled steps, in order. The
// watchers' step opens the sockets that steps 1 to 4 use, and each step starts from the state the
// one before it left, so the block runs sequentially and is never shuffled. A failed step makes the
// steps after it fail too: read the FIRST failure.
describe('E2E-S-2 (R4): a paired device\'s four transitions keep Paired Devices live', { concurrent: false, shuffle: false }, () => {
  let deviceSocket: TestSocket;
  let operator: DeviceOperator;
  let operatorSocketOfDevice: TestSocket;
  const marks = { portal: 0, console: 0 };
  const counts: Array<[string, number]> = [];

  /** Waits out the debounce on the manual clock and returns how many hints each watcher got since the last mark. */
  async function afterDebounce(step: string, extra: TestSocket[] = []): Promise<{ portal: number; console: number }> {
    // Not before the debounce: 750 ms later nothing has been sent.
    rt.steps.advance(DEBOUNCE_MS - PACE_MS);
    await settle(rt, portal, investigatorConsole, ...extra);
    expect(devicesHints(portal, marks.portal), `${step}: nothing before the debounce`).toBe(0);
    rt.steps.advance(PACE_MS);
    await settle(rt, portal, investigatorConsole, ...extra);
    // And nothing more for the next 5 s: one message per transition.
    rt.steps.advance(5_000);
    await settle(rt, portal, investigatorConsole, ...extra);
    const got = { portal: devicesHints(portal, marks.portal), console: devicesHints(investigatorConsole, marks.console) };
    marks.portal = portal.messages.length;
    marks.console = investigatorConsole.messages.length;
    counts.push([step, got.portal]);
    return got;
  }

  it('the watchers: the supervisor\'s portal socket and an investigator\'s console, past the pairing\'s own hints', async () => {
    portal = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const investigator = await webOperator(rt, INVESTIGATOR);
    investigatorConsole = await operatorSocket(rt, webHeaders(investigator.cookie));
    rt.steps.advance(10_000);
    await settle(rt, portal, investigatorConsole);
    marks.portal = portal.messages.length;
    marks.console = investigatorConsole.messages.length;
    expect(await registryRow()).toEqual({ online: false, signedInOperatorId: null });
  });

  it('1. the device\'s socket is admitted: ONE hint, and the registry says online', async () => {
    deviceSocket = openSocket(rt.wsUrl, deviceHeaders(device.credential));
    await deviceSocket.opened;
    await deviceSocket.nextOf('hello');
    const got = await afterDebounce('device socket admitted', [deviceSocket]);
    expect(got).toEqual({ portal: 1, console: 0 });
    expect(await registryRow()).toEqual({ online: true, signedInOperatorId: null });
  });

  it('2. the operator signs in on the device and the app opens its session socket at once: ONE hint, the Operator column fills', async () => {
    operator = await deviceOperator(rt, device, INVESTIGATOR);
    operatorSocketOfDevice = openSocket(rt.wsUrl, deviceHeaders(operator.token));
    await operatorSocketOfDevice.opened;
    await operatorSocketOfDevice.nextOf('snapshot');
    const got = await afterDebounce('sign-in + session socket', [deviceSocket, operatorSocketOfDevice]);
    expect(got).toEqual({ portal: 1, console: 0 });
    expect(await registryRow()).toEqual({ online: true, signedInOperatorId: INVESTIGATOR.id });
  });

  it('3. the operator signs out on the device (its session socket is closed with 4401): ONE hint, the Operator column empties', async () => {
    const closed = operatorSocketOfDevice.whenClosed;
    const response = await rt.app.inject({ method: 'POST', url: SIGN_OUT, headers: { 'user-agent': 'okhttp/4.12.0', ...bearer(operator.token) } });
    expect(response.statusCode).toBe(204);
    expect((await closed).code).toBe(4401);
    const got = await afterDebounce('sign-out', [deviceSocket]);
    expect(got).toEqual({ portal: 1, console: 0 });
    expect(await registryRow()).toEqual({ online: true, signedInOperatorId: null });
  });

  it('4. the device\'s socket departs: ONE hint, and the registry says offline', async () => {
    const closed = deviceSocket.whenClosed;
    deviceSocket.ws.close(1000);
    await closed;
    const got = await afterDebounce('device socket departed');
    expect(got).toEqual({ portal: 1, console: 0 });
    expect(await registryRow()).toEqual({ online: false, signedInOperatorId: null });
  });

  it('the count: four transitions, four hints to the holder of PAIRING_MANAGE, none to anybody else', () => {
    expect(counts).toEqual([
      ['device socket admitted', 1],
      ['sign-in + session socket', 1],
      ['sign-out', 1],
      ['device socket departed', 1],
    ]);
    expect(deviceSocket.messages.some((message) => message.type === 'admin.changed')).toBe(false);
    expect(operatorSocketOfDevice.messages.some((message) => message.type === 'admin.changed')).toBe(false);
    // Every frame of every socket was a message of the contract (AC-B-46).
    expect([portal, investigatorConsole, deviceSocket, operatorSocketOfDevice].flatMap((socket) => socket.invalid)).toEqual([]);
    console.info(`[fx-c] admin.changed DEVICES per transition: ${counts.map(([step, count]) => `${step} ${count}`).join('; ')}`);
  });
});
