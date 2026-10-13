// Operations 98 and 99 on a booted Core, as `dems_app`, against PostgreSQL (task 4 blueprint row
// 70, WP-07c; contract `packages/shared/src/api/capture-audio-cards.ts`; design addendum 04
// section 4.2; security addendum AD-07; decisions U10, C25, C31).
//
// WHAT IS REAL: the app factory with every stage (stage 6 enforces CAPTURE_CONFIG and
// `WEB_CONSOLE_SESSION`), booted as the entry point boots it on a throw-away clone of the seed;
// this module's two routes; its statements as the runtime role; the engine's unit of work and the
// audit chain; the enumerator and the parser of row 64; the capture device registry of row 65.
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the capture operation  the test Core is SIMULATED (no production Core boots without the
//                          production registry builder of row 85). The module's own answer there
//                          is 503, which the first block measures; every other block puts the
//                          enumerator in with `replaceForTest`. Not proven here: a booted
//                          REAL_PRODUCTION Core with an enumerator handed in by row 85.
//   the host               a table of fixed listing texts (`fixtures.ts`). No Linux host, no
//                          sound card, no process. Proven on hardware: `9A/H-07`.
//   the registrar          NO LONGER A STAND-IN (task 4 rows 185 and 190): every registration of
//                          this file runs the registrar of the product (`registrar.ts`), that is
//                          the engine's INTERNAL action `registerCaptureMicrophone` in the unit of
//                          the registration - the registry row comes from the engine's typed
//                          writer and the replicated `captureDevices` slice of the RUNNING engine
//                          holds the microphone with the commit. The plugin hands it in itself
//                          (measured in the first block, before this file touches it); the first
//                          block also takes it away once: a module without one answers 503.
//   the adapter            a class-C stand-in of kind USB_AUDIO with no opener, registered in a
//                          REAL production registry of this file (the stub of `usb-audio.ts` is
//                          loaded by `adapters/real.ts` only).
//
// EVERY RULE HAS ITS CONTROL.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS, CAPTURE_DISCOVERY_MAX_PER_MINUTE, validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { CaptureAdapterError, CaptureAdapterKind, CaptureOperation, createCaptureDeviceRegistry, type AudioInputAdapter, type CaptureDeviceRegistry } from '../../../../capture/adapters';
import { captureFenceControl } from '../../../../capture/fence';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../../../db/schema';
import { engineControl } from '../../../../engine';
import type { Principal } from '../../../../plugins/authenticate';
import { throttleControl } from '../../../../plugins/throttle';
import { identityControl } from '../../../identity';
import { AudioCardEnumeratorRefusedError, captureAudioCardsControl, createEngineMicrophoneRegistrar, createListingGate, createMicrophoneStore, type MicrophoneStore, type RegisteredMicrophone } from '../index';
import { DUO, INTERFACE_REPLACED, NO_CARD, SIX, TWO_CARDS, fakeHost, type FakeHost } from './fixtures';

const db = useTestDatabase({ template: 'seed', slug: 'row070' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row070-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row070-log-'));
const errorLogFile = join(logDir, 'errors.log');

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const TABLET = 'DEV-0070';
const SEARCH = '/api/v1/capture/audio-cards/search';
const REGISTER = '/api/v1/capture/audio-cards/inputs';
/** Every string a card of the fixtures announced: none may be in an audit row or a log line. */
const DEVICE_TEXT = [DUO.cardId, DUO.product, DUO.usbId, SIX.cardId, SIX.product, SIX.usbId, 'fff0:0099'];

let guard: GuardApp;
let owner: Pool;
let host: FakeHost;
let supervisor: Headers;
let technician: Headers;
let investigator: Headers;
let technicianOnTablet: Headers;
/** The clock of the listing gate alone: moving it expires no operator session. */
let gateClock = CLOCK_START;
/** One step of that clock: the spacing, and long enough that no minute holds more searches than its bound. */
const GATE_STEP_MS = Math.max(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS, Math.ceil(60_000 / CAPTURE_DISCOVERY_MAX_PER_MINUTE));
/** The registry handed in: a REAL production registry, with what this file's admission registered. */
let registry: CaptureDeviceRegistry;
const admitted: RegisteredMicrophone[] = [];
/** The real store, with ONE write that can be made to fail. */
let failSecondWrite = false;
const realStore = createMicrophoneStore();
const store: MicrophoneStore = {
  ...realStore,
  async insertInput(connection, input) {
    if (failSecondWrite) throw Object.assign(new Error('row070: a failure injected in the second write'), { code: 'ROW070_INJECTED' });
    await realStore.insertInput(connection, input);
  },
};

/** A class-C stand-in: kind USB_AUDIO, one device, NO opener. What a production boot gives a stored `USB_AUDIO` row until WP-13. */
function usbAudioStandIn(device: RegisteredMicrophone, hasOpener = false): AudioInputAdapter {
  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.USB_AUDIO,
    devices: [{ id: device.id, deviceClass: 'MIC', label: device.model ?? device.id, capabilities: ['AUDIO'], profiles: [] }],
    hasOpener,
    enumerate: async () => [],
    open: async () => {
      throw new Error('row070: the stand-in opens nothing');
    },
    level: async () => null,
  };
}

async function post(session: Headers | null, url: string, payload?: unknown): Promise<LightMyRequestResponse> {
  // Past BOTH bounds of the search for every call (the spacing, and six in a minute: task 4 row 156): only the bound a test is about can refuse.
  gateClock += GATE_STEP_MS;
  const headers = session === null ? { origin: WEB_ORIGIN } : { ...session, ...('cookie' in session ? { origin: WEB_ORIGIN } : {}) };
  const response = await guard.app.inject({ method: 'POST', url, headers: { ...headers, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) }, ...(payload === undefined ? {} : { payload: payload as object }) });
  await guard.app.pipeline.drain();
  return response;
}
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};
const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown] => [response.statusCode, errorOf(response).code, errorOf(response).details?.['reason'] ?? null];
const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
const count = async (table: string, where = 'true'): Promise<number> => ((await owner.query(`SELECT count(*)::int AS rows FROM public.${table} WHERE ${where}`)).rows[0] as { rows: number }).rows;
const stored = async (): Promise<[number, number]> => [await count('capture_devices'), await count('capture_audio_inputs')];
const usbMicrophones = async (): Promise<string[]> => (await owner.query("SELECT id FROM public.capture_devices WHERE adapter_kind = 'USB_AUDIO' ORDER BY id")).rows.map((row: { id: string }) => row.id);
const body = (cardId: string, inputNumber: number, deviceIndex = 0): Record<string, unknown> => ({ cardId, deviceIndex, inputNumber });

beforeAll(async () => {
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile, logLevel: 'trace' });
  await guard.app.ready();
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();

  await insertPairedDevice(owner, TABLET, TECHNICIAN.id, CLOCK_START);
  const tablet = guard.devices.pair(TABLET);
  supervisor = await webOperator(guard, SUPERVISOR.username);
  technician = await webOperator(guard, TECHNICIAN.username);
  investigator = await webOperator(guard, INVESTIGATOR.username);
  technicianOnTablet = await deviceOperator(guard, tablet, TECHNICIAN.username);
  await guard.app.pipeline.drain();
  host = fakeHost(TWO_CARDS);
  registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
  failSecondWrite = false;
  host.use(TWO_CARDS);
});

describe('the database and the Core this file runs on', () => {
  it(`the schema version of the code: [${DB_SCHEMA_VERSION}, '${DB_CONTRACT_REVISION}'] = [8, 'dbc-9'], read as dems_app; the capture operation is SIMULATED`, async () => {
    const row = (await guard.app.db.pool.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([row.schema_version, row.contract_revision]).toEqual([8, 'dbc-9']);
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
    expect(captureFenceControl(guard.app).operation).toBe('SIMULATED');
  });

  it('outside production capture: 503 NOT_READY / DISCOVERY_NOT_READY for both operations, nothing listed, nothing stored, no audit row; `provideEnumerator` is REFUSED', async () => {
    const control = captureAudioCardsControl(guard.app);
    expect(control.ready()).toBe(false);
    const from = (await trail()).length;
    const before = await stored();
    for (const session of [supervisor, technician]) {
      expect(reasonOf(await post(session, SEARCH))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
      expect(reasonOf(await post(session, REGISTER, body(DUO.cardId, 1)))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    }
    expect(await since(from)).toEqual([]);
    expect(await stored()).toEqual(before);
    expect(control.listingsStarted()).toBe(0);
    expect(() => control.provideEnumerator(host.enumerator)).toThrow(AudioCardEnumeratorRefusedError);
    expect(control.ready()).toBe(false);

    // From here on: this file's parts in the place of the module's (the enumerator over fixed texts,
    // a production registry of this file, the store with one write that can fail, a gate on its own clock).
    // THE COMPOSITION (task 4 row 190): the plugin handed the product's registrar in itself. With an
    // enumerator and nothing else of this file, operation 99 can store: no 503 for want of a registrar.
    control.replaceForTest({ enumerator: host.enumerator });
    expect([control.ready(), control.registrable()]).toEqual([true, true]);
    expect(() => control.provideRegistrar(createEngineMicrophoneRegistrar())).toThrow(/provided twice/);
    // CONTROL: a module WITHOUT a registrar (taken away here) answers 503 before the host is read.
    control.replaceForTest({ registrar: null });
    expect([control.ready(), control.registrable()]).toEqual([true, false]);
    expect(reasonOf(await post(technician, REGISTER, body(DUO.cardId, 1)))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    expect(host.listings()).toBe(0);
    expect(await stored()).toEqual(before);
    control.replaceForTest({
      enumerator: host.enumerator,
      // The registrar of the product again, built as the plugin builds it: no stand-in from here on.
      registrar: createEngineMicrophoneRegistrar(),
      store,
      gate: createListingGate(() => gateClock),
      admission: (device) => {
        admitted.push(device);
        registry.register(usbAudioStandIn(device));
        return 'ADMITTED';
      },
    });
    expect([control.ready(), control.registrable()]).toEqual([true, true]);
  });
});

describe('who may call: CAPTURE_CONFIG on a web console session, and nobody else', () => {
  it('401 without a session; 403 NOT_PERMITTED for a role without the permission; 403 WEB_CONSOLE_ONLY for a tablet session, also with a malformed body: one ACCESS_DENIED row each, the host is never read', async () => {
    const listings = host.listings();
    const before = await stored();
    for (const [url, payload] of [
      [SEARCH, undefined],
      [REGISTER, body(DUO.cardId, 1)],
    ] as const) {
      const operationId = url === SEARCH ? 'searchCaptureAudioCards' : 'registerCaptureAudioInput';
      let from = (await trail()).length;
      expect(reasonOf(await post(null, url, payload)), operationId).toEqual([401, 'NOT_SIGNED_IN', null]);
      expect(await since(from), operationId).toEqual([]);

      const denied = await post(investigator, url, payload);
      expect([denied.statusCode, errorOf(denied).code, errorOf(denied).details?.['permission']], operationId).toEqual([403, 'NOT_PERMITTED', 'CAPTURE_CONFIG']);
      let rows = await since(from);
      expect(rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
      expect(rows[0], operationId).toMatchObject({ actorId: INVESTIGATOR.id, details: { operationId, permission: 'CAPTURE_CONFIG' } });

      from = (await trail()).length;
      expect(reasonOf(await post(technicianOnTablet, url, payload)), operationId).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      rows = await since(from);
      expect(rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
      expect(rows[0], operationId).toMatchObject({ actorId: TECHNICIAN.id, deviceId: TABLET, details: { operationId, reason: 'WEB_CONSOLE_ONLY' } });
    }
    // A body that is no JSON, from the tablet: the refusal is the same, before the body is used.
    expect(reasonOf(await post(technicianOnTablet, REGISTER, `{"cardId": "${DUO.cardId}"`))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    expect(host.listings()).toBe(listings);
    expect(await stored()).toEqual(before);
    // CONTROL: the same TECHNICIAN on the web console, and the SUPERVISOR, pass both rules.
    expect((await post(technician, SEARCH)).statusCode).toBe(200);
    expect((await post(supervisor, SEARCH)).statusCode).toBe(200);
    expect(host.listings()).toBe(listings + 2);
  });
});

describe('operation 98 searchCaptureAudioCards', () => {
  it('200: the cards of the listing, validated against the contract; nothing stored; ONE CAPTURE_DISCOVERY_SEARCHED row with scope AUDIO_CARDS, a search id and counts', async () => {
    const from = (await trail()).length;
    const before = await stored();
    const response = await post(technician, SEARCH);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, response.json())).toMatchObject({ ok: true });
    expect(response.json()).toMatchObject({
      truncated: false,
      cards: [
        { cardId: DUO.cardId, deviceIndex: 0, usbId: DUO.usbId, product: DUO.product, channelCount: 2, sampleBits: [24], registered: [] },
        { cardId: SIX.cardId, deviceIndex: 0, usbId: SIX.usbId, product: SIX.product, channelCount: 6, sampleBits: [24], registered: [] },
      ],
    });
    expect(await stored()).toEqual(before);
    const rows = await since(from);
    expect(rows.map((row) => row.type)).toEqual(['CAPTURE_DISCOVERY_SEARCHED']);
    expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: null });
    expect(Object.keys(rows[0]?.details ?? {}).sort()).toEqual(['interfaceCount', 'newCount', 'operationId', 'outcome', 'permission', 'registeredCount', 'responderCount', 'scope', 'searchId', 'trigger']);
    expect(rows[0]?.details).toMatchObject({ scope: 'AUDIO_CARDS', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 2, registeredCount: 0, interfaceCount: 0, operationId: 'searchCaptureAudioCards', permission: 'CAPTURE_CONFIG' });
    expect(String(rows[0]?.details?.['searchId'])).toMatch(/^DSC-\d{13}$/);
  });

  it('a host without a card: 200 with an empty list and a row with 0 responders', async () => {
    host.use(NO_CARD);
    const from = (await trail()).length;
    const response = await post(supervisor, SEARCH);
    expect([response.statusCode, response.json()]).toMatchObject([200, { cards: [], truncated: false }]);
    expect((await since(from)).map((row) => [row.type, row.details?.['responderCount']])).toEqual([['CAPTURE_DISCOVERY_SEARCHED', 0]]);
  });

  it('409 INVALID_STATE / AUDIO_CARD_SEARCH_IN_PROGRESS while a listing runs, for both operations: one reading of the host, one row; and inside the spacing 429 with retry-after and no row', async () => {
    const listings = host.listings();
    const from = (await trail()).length;
    const release = host.holdOnce();
    const running = post(technician, SEARCH);
    // The first request is inside its listing once the host was asked.
    for (let turn = 0; turn < 200 && host.listings() === listings; turn += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(host.listings()).toBe(listings + 1);
    expect(reasonOf(await post(supervisor, SEARCH))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    expect(reasonOf(await post(supervisor, REGISTER, body(DUO.cardId, 1)))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    release();
    expect((await running).statusCode).toBe(200);
    expect(host.listings()).toBe(listings + 1);
    expect((await since(from)).map((row) => row.type)).toEqual(['CAPTURE_DISCOVERY_SEARCHED']);
    expect(await usbMicrophones()).toEqual([]);

    // The spacing: `post` moves the gate's clock one step before each call; taken back to 2 s short of the interval, the search is refused.
    expect((await post(supervisor, SEARCH)).statusCode).toBe(200);
    const rows = (await trail()).length;
    const back = GATE_STEP_MS - CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS + 2_000;
    gateClock -= back;
    const limited = await post(technician, SEARCH);
    expect(reasonOf(limited)).toEqual([429, 'RATE_LIMITED', 'AUDIO_CARD_SEARCH_RATE_LIMITED']);
    expect(limited.headers['retry-after']).toBe('2');
    expect((await trail()).length).toBe(rows);
    expect(host.listings()).toBe(listings + 2);
    gateClock += back;
  });
});

describe('operation 99 registerCaptureAudioInput', () => {
  it('201 REGISTERED: ONE unit writes the registry row (class MIC, adapter kind USB_AUDIO, the next free id) and its row in capture_audio_inputs, from the Core\'s own listing; ONE CAPTURE_AUDIO_INPUT_CHANGED entry with the closed keys', async () => {
    const from = (await trail()).length;
    const before = await stored();
    const listings = host.listings();
    const response = await post(technician, REGISTER, body(SIX.cardId, 4));
    expect(response.statusCode).toBe(201);
    expect(validateCoreApiResponse('registerCaptureAudioInput', 201, response.json())).toMatchObject({ ok: true });
    expect(response.json()).toEqual({ deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 4, channelCount: 6 });
    expect(host.listings()).toBe(listings + 1);
    expect(await stored()).toEqual([before[0] + 1, before[1] + 1]);
    expect((await owner.query("SELECT id, kind, transport, model, enabled, adapter_kind, address, onvif_uuid FROM public.capture_devices WHERE id = 'MIC-03'")).rows).toEqual([
      { id: 'MIC-03', kind: 'MIC', transport: 'USB', model: SIX.product, enabled: true, adapter_kind: 'USB_AUDIO', address: null, onvif_uuid: null },
    ]);
    expect((await owner.query("SELECT device_id, usb_id, card_id, card_device, input_number, native_channels, sample_rate, sample_bits, updated_by FROM public.capture_audio_inputs WHERE device_id = 'MIC-03'")).rows).toEqual([
      { device_id: 'MIC-03', usb_id: SIX.usbId, card_id: SIX.cardId, card_device: 0, input_number: 4, native_channels: 6, sample_rate: 48000, sample_bits: 24, updated_by: TECHNICIAN.id },
    ]);
    const rows = await since(from);
    expect(rows.map((row) => row.type)).toEqual(['CAPTURE_AUDIO_INPUT_CHANGED']);
    expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: 'MIC-03' });
    expect(rows[0]?.details).toEqual({ deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 4, channelCount: 6, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' });
    // The selector is not touched (decision C25: a role is assigned in the selector, not here).
    expect((await owner.query('SELECT mic_primary_id, mic_standby_id FROM public.capture_config')).rows).toEqual([{ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' }]);
    // Task 4 rows 185 / 190: the RUNNING engine holds the microphone, as the action registered it
    // (class, adapter and id are the action's), and its selector slice is what it was.
    const state = guard.app.engine.state();
    expect(state.captureDevices.devices.find((device) => device.id === 'MIC-03')).toEqual({ id: 'MIC-03', kind: 'MIC', model: SIX.product, firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: ['AUDIO'], adapter: 'USB_AUDIO', sourceClass: 'PRODUCTION' });
    expect(state.captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'MIC-03']);
    expect(state.captureConfig.mics.map((mic) => mic.deviceId)).toEqual(['MIC-01', 'MIC-02']);
  });

  it('200 REENABLED: the same input again is ONE device; a microphone that was off is on again; operation 98 names the input as registered', async () => {
    await owner.query("UPDATE public.capture_devices SET enabled = false WHERE id = 'MIC-03'");
    const from = (await trail()).length;
    const before = await stored();
    const response = await post(supervisor, REGISTER, body(SIX.cardId, 4));
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('registerCaptureAudioInput', 200, response.json())).toMatchObject({ ok: true });
    expect(response.json()).toEqual({ deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6 });
    expect(await stored()).toEqual(before);
    expect(await usbMicrophones()).toEqual(['MIC-03']);
    // ONE device in the engine too: the action enabled the registered one and appended none.
    expect(guard.app.engine.state().captureDevices.devices.filter((device) => device.adapter === 'USB_AUDIO').map((device) => [device.id, device.online])).toEqual([['MIC-03', true]]);
    expect((await owner.query("SELECT d.enabled, i.updated_by FROM public.capture_devices d JOIN public.capture_audio_inputs i ON i.device_id = d.id WHERE d.id = 'MIC-03'")).rows).toEqual([{ enabled: true, updated_by: SUPERVISOR.id }]);
    expect((await since(from)).map((row) => [row.type, row.details])).toEqual([['CAPTURE_AUDIO_INPUT_CHANGED', { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' }]]);

    const search = await post(technician, SEARCH);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, search.json())).toMatchObject({ ok: true });
    expect((search.json() as { cards: { cardId: string; registered: unknown[] }[] }).cards.map((card) => [card.cardId, card.registered])).toEqual([
      [DUO.cardId, []],
      [SIX.cardId, [{ inputNumber: 4, deviceId: 'MIC-03' }]],
    ]);
  });

  it('200 CARD_CHANGED: another USB id behind the stored key is said in the answer and in ONE entry; still one device', async () => {
    host.use(INTERFACE_REPLACED);
    const from = (await trail()).length;
    const response = await post(technician, REGISTER, body(SIX.cardId, 4));
    expect([response.statusCode, response.json()]).toEqual([200, { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 4, channelCount: 6 }]);
    expect(await usbMicrophones()).toEqual(['MIC-03']);
    expect((await owner.query("SELECT usb_id FROM public.capture_audio_inputs WHERE device_id = 'MIC-03'")).rows).toEqual([{ usb_id: 'fff0:0099' }]);
    expect((await since(from)).map((row) => [row.type, row.details?.['change']])).toEqual([['CAPTURE_AUDIO_INPUT_CHANGED', 'CARD_CHANGED']]);
  });

  it('the refusals, each storing nothing and writing no audit row: 404 unknown card, 404 a device index the card does not have, 409 an input beyond the card, 400 no JSON, 422 a body that does not match (never read by the host)', async () => {
    const from = (await trail()).length;
    const before = await stored();
    expect(reasonOf(await post(technician, REGISTER, body('NoSuchCard', 1)))).toEqual([404, 'NOT_FOUND', null]);
    expect(reasonOf(await post(technician, REGISTER, body(DUO.cardId, 1, 3)))).toEqual([404, 'NOT_FOUND', null]);
    expect(reasonOf(await post(technician, REGISTER, body(DUO.cardId, 3)))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_BEYOND_CARD']);
    expect(reasonOf(await post(technician, REGISTER, body(SIX.cardId, 7)))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_BEYOND_CARD']);
    const listings = host.listings();
    const malformed = await post(technician, REGISTER, `{"cardId": "${DUO.cardId}", "deviceIndex": 0,`);
    expect([malformed.statusCode, errorOf(malformed).code]).toEqual([400, 'INVALID_JSON']);
    for (const payload of [
      {},
      { cardId: DUO.cardId, deviceIndex: 0 },
      { ...body(DUO.cardId, 1), product: DUO.product },
      { ...body(DUO.cardId, 1), usbId: DUO.usbId },
      { ...body(DUO.cardId, 1), channelCount: 64 },
      body(`hw:CARD=${DUO.cardId}`, 1),
      body(DUO.cardId, 0),
      body(DUO.cardId, 65),
      body(DUO.cardId, 1, 32),
      { cardId: DUO.cardId, deviceIndex: '0', inputNumber: 1 },
    ]) {
      const refused = await post(technician, REGISTER, payload);
      expect([refused.statusCode, errorOf(refused).code], JSON.stringify(payload)).toEqual([422, 'INVALID_INPUT']);
      // The refusal never quotes the input.
      expect(refused.body, JSON.stringify(payload)).not.toContain(DUO.cardId);
    }
    expect(host.listings()).toBe(listings);
    expect(await since(from)).toEqual([]);
    expect(await stored()).toEqual(before);
  });

  it('the unit rolls back as a whole: with the SECOND write failing, no registry row, no input row and no audit entry remain, and nothing is admitted; the next registration takes the id the failed one had', async () => {
    const from = (await trail()).length;
    const before = await stored();
    const admissions = admitted.length;
    failSecondWrite = true;
    const failed = await post(technician, REGISTER, body(DUO.cardId, 1));
    expect(failed.statusCode).toBe(500);
    expect(await stored()).toEqual(before);
    expect(await usbMicrophones()).toEqual(['MIC-03']);
    expect((await since(from)).filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED')).toEqual([]);
    expect(admitted.length).toBe(admissions);
    // The registry row of the ENGINE went back with it: the action had appended MIC-04 in the unit that failed.
    expect(guard.app.engine.state().captureDevices.devices.filter((device) => device.adapter === 'USB_AUDIO').map((device) => device.id)).toEqual(['MIC-03']);
    // CONTROL: the same call without the injected failure writes both rows, as MIC-04.
    failSecondWrite = false;
    const stored4 = await post(technician, REGISTER, body(DUO.cardId, 1));
    expect([stored4.statusCode, stored4.json()]).toEqual([201, { deviceId: 'MIC-04', change: 'REGISTERED', inputNumber: 1, channelCount: 2 }]);
    expect(await stored()).toEqual([before[0] + 1, before[1] + 1]);
    expect(admitted.length).toBe(admissions + 1);
  });

  it('what the runtime role may NOT do to the two tables: no DELETE, no change of the adapter kind, no change of the rate; one input is one row (the unique key)', async () => {
    const sqlstate = (pending: Promise<unknown>): Promise<string | undefined> =>
      pending.then(
        () => 'answered',
        (error: { code?: string }) => error.code,
      );
    const app = guard.app.db.pool;
    expect(await sqlstate(app.query("DELETE FROM public.capture_audio_inputs WHERE device_id = 'MIC-03'"))).toBe('42501');
    expect(await sqlstate(app.query("UPDATE public.capture_audio_inputs SET sample_rate = 44100 WHERE device_id = 'MIC-03'"))).toBe('42501');
    expect(await sqlstate(app.query("UPDATE public.capture_devices SET adapter_kind = 'FAKE' WHERE id = 'MIC-03'"))).toBe('42501');
    expect(await sqlstate(app.query("INSERT INTO public.capture_audio_inputs (device_id, card_id, card_device, input_number, native_channels, updated_at) VALUES ('MIC-04', $1, 0, 4, 6, 1)", [SIX.cardId]))).toBe('23505');
  });
});

describe('admission to the registry handed in: a DEVICE ROW, not a recordable source', () => {
  it('each committed unit was handed over once, after its commit; the registry lists the microphone as USB_AUDIO / PRODUCTION with NO opener, and `assertRecordable` REFUSES it', () => {
    // Four commits: MIC-03 registered, re-enabled, changed; MIC-04 registered. The unit that rolled back handed nothing over.
    expect(admitted.map((device) => [device.id, device.kind, device.adapterKind])).toEqual([
      ['MIC-03', 'MIC', 'USB_AUDIO'],
      ['MIC-03', 'MIC', 'USB_AUDIO'],
      ['MIC-03', 'MIC', 'USB_AUDIO'],
      ['MIC-04', 'MIC', 'USB_AUDIO'],
    ]);
    expect(registry.list().map((device) => [device.id, device.deviceClass, device.adapterKind, device.sourceClass, device.hasOpener])).toEqual([
      ['MIC-03', 'MIC', 'USB_AUDIO', 'PRODUCTION', false],
      ['MIC-04', 'MIC', 'USB_AUDIO', 'PRODUCTION', false],
    ]);
    for (const id of ['MIC-03', 'MIC-04']) {
      let refusal: unknown = null;
      try {
        registry.assertRecordable(id);
      } catch (error) {
        refusal = error;
      }
      expect(refusal, id).toBeInstanceOf(CaptureAdapterError);
      expect((refusal as CaptureAdapterError).code, id).toBe('SOURCE_KIND_NOT_RECORDABLE');
      // It IS assignable as a production microphone: only the recording is refused.
      expect(registry.assertAssignable('MIC', id).id).toBe(id);
    }
    // CONTROL: an adapter of this kind that CLAIMS an opener is refused at registration (the lift is WP-13's decision).
    expect(() => registry.register(usbAudioStandIn({ id: 'MIC-99', kind: 'MIC', adapterKind: 'USB_AUDIO', model: null }, true))).toThrow(CaptureAdapterError);
    expect(registry.list().map((device) => device.id)).toEqual(['MIC-03', 'MIC-04']);
  });

  it('the re-enable and the card change (two further commits of MIC-03) reached the admission too, and a failed admission does not undo a registration: it is logged and persisted', async () => {
    // Four commits so far: MIC-03 registered, re-enabled, changed; MIC-04 registered. The stand-in's
    // registry refused the two repeats of MIC-03 (a duplicate id): each was caught, the rows stayed.
    const log = guard.log.lines().filter((line) => line['source'] === 'captureAudioCards.admit');
    expect(log.filter((line) => line['code'] === 'CAPTURE_DEVICE_ADMITTED').map((line) => line['deviceId'])).toEqual(['MIC-03', 'MIC-04']);
    expect(log.filter((line) => line['level'] === 50 || line['level'] === 'error').map((line) => [line['deviceId'], line['code']])).toEqual([
      ['MIC-03', 'CAPTURE_DEVICE_DUPLICATE'],
      ['MIC-03', 'CAPTURE_DEVICE_DUPLICATE'],
    ]);
    expect(await usbMicrophones()).toEqual(['MIC-03', 'MIC-04']);
  });

  it('THE GAP OF ROW 70 IS CLOSED (task 4 rows 185 and 190): the replicated captureDevices slice of the RUNNING engine holds both new microphones, and what it holds is what the registry rows read back as', async () => {
    const devices = guard.app.engine.state().captureDevices.devices;
    expect(devices.map((device) => device.id)).toContain('MIC-01');
    expect(devices.filter((device) => device.id === 'MIC-03' || device.id === 'MIC-04').map((device) => [device.id, device.kind, device.adapter, device.sourceClass, device.online, device.capabilities])).toEqual([
      // Decision C43 (3), integration pass I-7: the capability of the built-in pair, not an empty list.
      ['MIC-03', 'MIC', 'USB_AUDIO', 'PRODUCTION', true, ['AUDIO']],
      ['MIC-04', 'MIC', 'USB_AUDIO', 'PRODUCTION', true, ['AUDIO']],
    ]);
    // The stored rows: the adapter kind and the class of the action, the transport of the registrar's statement.
    expect((await owner.query("SELECT id, kind, transport, enabled, adapter_kind, model FROM public.capture_devices WHERE adapter_kind = 'USB_AUDIO' ORDER BY id")).rows).toEqual(
      devices.filter((device) => device.adapter === 'USB_AUDIO').map((device) => ({ id: device.id, kind: 'MIC', transport: 'USB', enabled: true, adapter_kind: 'USB_AUDIO', model: device.model })),
    );
  });
});

describe('a session is open: 409 CAPTURE_CONFIG_LOCKED for both operations (idle only)', () => {
  it('no audit row, the host is not read, nothing stored; with the session cancelled both are accepted again', async () => {
    const principal: Principal = { kind: 'OPERATOR', operatorId: INVESTIGATOR.id, sessionId: 'row070-investigator', deviceId: null, role: INVESTIGATOR.role } as Principal;
    const created = await guard.app.engine.command(principal, 'createSession', { caseNumber: 'LP/2026/1013-0070', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: INVESTIGATOR.id });
    expect(created.value).toMatchObject({ ok: true });
    await guard.app.pipeline.drain();
    const rows = (await trail()).length;
    const before = await stored();
    const listings = host.listings();
    for (const [url, payload] of [
      [SEARCH, undefined],
      [REGISTER, body(DUO.cardId, 2)],
    ] as const) {
      for (const session of [supervisor, technician]) expect(reasonOf(await post(session, url, payload)), url).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    }
    expect((await trail()).length).toBe(rows);
    expect(await stored()).toEqual(before);
    expect(host.listings()).toBe(listings);
    await guard.app.engine.command(principal, 'cancel');
    await guard.app.pipeline.drain();
    // CONTROL: with no session open the same two calls are accepted.
    expect((await post(supervisor, SEARCH)).statusCode).toBe(200);
    expect((await post(technician, REGISTER, body(DUO.cardId, 2))).statusCode).toBe(201);
  });
});

describe('AD-07: no device text outside the answer of the search and the model column (this block runs last)', () => {
  it('0 hits of a card id, a product or a USB id in the audit trail and in the log at trace; the error log holds no device text either', async () => {
    await guard.app.pipeline.drain();
    const rows = (await trail()).filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED' || row.type === 'CAPTURE_DISCOVERY_SEARCHED');
    expect(rows.length).toBeGreaterThan(8);
    const log = guard.log.text();
    expect(log).toContain('sound-card input registered');
    for (const text of DEVICE_TEXT) {
      expect(JSON.stringify(rows), text).not.toContain(text);
      expect(log, text).not.toContain(text);
    }
    // The one stored home of device text: the model of the registry row, as the listing returned it.
    expect((await owner.query("SELECT DISTINCT model FROM public.capture_devices WHERE adapter_kind = 'USB_AUDIO' ORDER BY model")).rows.map((row: { model: string }) => row.model)).toEqual([DUO.product, SIX.product]);
  });
});
