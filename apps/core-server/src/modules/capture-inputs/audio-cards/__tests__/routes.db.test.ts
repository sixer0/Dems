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
import { DUO, DUO_MOVED_CARD_ID, DUO_PORT, INTERFACE_REPLACED, NO_CARD, OTHER_PORT, SIX, SIX_PORT, SIX_SERIAL, THREE_CARDS, TRIO, TRIO_PORT, TWO_CARDS, TWO_CARDS_DUO_ELSEWHERE, TWO_CARDS_DUO_RENAMED, TWO_CARDS_INTERFACE_MOVED, TWO_CARDS_ONE_SERIAL, fakeHost, type FakeHost } from './fixtures';

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
const DEVICE_TEXT = [DUO.cardId, DUO.product, DUO.usbId, SIX.cardId, SIX.product, SIX.usbId, 'fff0:0099', SIX_SERIAL, SIX_PORT, DUO_PORT, OTHER_PORT, DUO_MOVED_CARD_ID, TRIO.cardId, TRIO.product, TRIO.usbId, TRIO_PORT];

let guard: GuardApp;
let owner: Pool;
let host: FakeHost;
let supervisor: Headers;
let technician: Headers;
/** A second web console session of the TECHNICIAN: SUPERVISOR's CAPTURE_CONFIG was REVOKED 2026-10-29 (PT GSP; migration 0034), so the file's second permitted web caller is another session of the installing technician (the pattern of `capture-config/camera-network`). */
let otherTechnician: Headers;
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
  otherTechnician = await webOperator(guard, TECHNICIAN.username);
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
  it(`the schema version of the code: [${DB_SCHEMA_VERSION}, '${DB_CONTRACT_REVISION}'] = [15, 'dbc-16'], read as dems_app; the capture operation is SIMULATED`, async () => {
    const row = (await guard.app.db.pool.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([row.schema_version, row.contract_revision]).toEqual([15, 'dbc-16']);
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
    expect(captureFenceControl(guard.app).operation).toBe('SIMULATED');
  });

  it('outside production capture: 503 NOT_READY / DISCOVERY_NOT_READY for both operations, nothing listed, nothing stored, no audit row; `provideEnumerator` is REFUSED', async () => {
    const control = captureAudioCardsControl(guard.app);
    expect(control.ready()).toBe(false);
    const from = (await trail()).length;
    const before = await stored();
    for (const session of [otherTechnician, technician]) {
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
  it('401 without a session; 403 NOT_PERMITTED for the INVESTIGATOR and for the SUPERVISOR, whose CAPTURE_CONFIG was REVOKED on 2026-10-29; 403 WEB_CONSOLE_ONLY for a tablet session, also with a malformed body: one ACCESS_DENIED row each, the host is never read', async () => {
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

      // SUPERVISOR's CAPTURE_CONFIG was REVOKED 2026-10-29 by the product principal (PT GSP;
      // migration 0034): the capture topology is the installing technician's layer alone.
      for (const [deniedSession, deniedOperator] of [[investigator, INVESTIGATOR], [supervisor, SUPERVISOR]] as const) {
        from = (await trail()).length;
        const denied = await post(deniedSession, url, payload);
        expect([denied.statusCode, errorOf(denied).code, errorOf(denied).details?.['permission']], `${operationId} ${deniedOperator.role}`).toEqual([403, 'NOT_PERMITTED', 'CAPTURE_CONFIG']);
        const deniedRows = await since(from);
        expect(deniedRows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
        expect(deniedRows[0], operationId).toMatchObject({ actorId: deniedOperator.id, details: { operationId, permission: 'CAPTURE_CONFIG' } });
      }

      from = (await trail()).length;
      expect(reasonOf(await post(technicianOnTablet, url, payload)), operationId).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      const rows = await since(from);
      expect(rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
      expect(rows[0], operationId).toMatchObject({ actorId: TECHNICIAN.id, deviceId: TABLET, details: { operationId, reason: 'WEB_CONSOLE_ONLY' } });
    }
    // A body that is no JSON, from the tablet: the refusal is the same, before the body is used.
    expect(reasonOf(await post(technicianOnTablet, REGISTER, `{"cardId": "${DUO.cardId}"`))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    expect(host.listings()).toBe(listings);
    expect(await stored()).toEqual(before);
    // CONTROL: both web console sessions of the same TECHNICIAN pass both rules (the SUPERVISOR lost CAPTURE_CONFIG on 2026-10-29, above).
    expect((await post(technician, SEARCH)).statusCode).toBe(200);
    expect((await post(otherTechnician, SEARCH)).statusCode).toBe(200);
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
        { cardId: DUO.cardId, deviceIndex: 0, usbId: DUO.usbId, product: DUO.product, channelCount: 2, sampleBits: [24], registered: [], boundTo: null },
        { cardId: SIX.cardId, deviceIndex: 0, usbId: SIX.usbId, product: SIX.product, channelCount: 6, sampleBits: [24], registered: [], boundTo: null },
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
    const response = await post(otherTechnician, SEARCH);
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
    expect(reasonOf(await post(otherTechnician, SEARCH))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    expect(reasonOf(await post(otherTechnician, REGISTER, body(DUO.cardId, 1)))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    release();
    expect((await running).statusCode).toBe(200);
    expect(host.listings()).toBe(listings + 1);
    expect((await since(from)).map((row) => row.type)).toEqual(['CAPTURE_DISCOVERY_SEARCHED']);
    expect(await usbMicrophones()).toEqual([]);

    // The spacing: `post` moves the gate's clock one step before each call; taken back to 2 s short of the interval, the search is refused.
    expect((await post(otherTechnician, SEARCH)).statusCode).toBe(200);
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
    expect(response.json()).toEqual({ deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 4, channelCount: 6, releasedDeviceId: null });
    expect(host.listings()).toBe(listings + 1);
    expect(await stored()).toEqual([before[0] + 1, before[1] + 1]);
    expect((await owner.query("SELECT id, kind, transport, model, enabled, adapter_kind, address, onvif_uuid FROM public.capture_devices WHERE id = 'MIC-03'")).rows).toEqual([
      { id: 'MIC-03', kind: 'MIC', transport: 'USB', model: SIX.product, enabled: true, adapter_kind: 'USB_AUDIO', address: null, onvif_uuid: null },
    ]);
    expect((await owner.query("SELECT device_id, usb_id, card_id, card_device, input_number, native_channels, sample_rate, sample_bits, updated_by FROM public.capture_audio_inputs WHERE device_id = 'MIC-03'")).rows).toEqual([
      { device_id: 'MIC-03', usb_id: SIX.usbId, card_id: SIX.cardId, card_device: 0, input_number: 4, native_channels: 6, sample_rate: 48000, sample_bits: 24, updated_by: TECHNICIAN.id },
    ]);
    // Task 4 row 199: the identity of the card is stored with it - the port path of the listing, and NULL for a card that states no serial.
    expect((await owner.query("SELECT usb_serial, usb_port FROM public.capture_audio_inputs WHERE device_id = 'MIC-03'")).rows).toEqual([{ usb_serial: null, usb_port: SIX_PORT }]);
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
    const response = await post(otherTechnician, REGISTER, body(SIX.cardId, 4));
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('registerCaptureAudioInput', 200, response.json())).toMatchObject({ ok: true });
    expect(response.json()).toEqual({ deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6, releasedDeviceId: null });
    expect(await stored()).toEqual(before);
    expect(await usbMicrophones()).toEqual(['MIC-03']);
    // ONE device in the engine too: the action enabled the registered one and appended none.
    expect(guard.app.engine.state().captureDevices.devices.filter((device) => device.adapter === 'USB_AUDIO').map((device) => [device.id, device.online])).toEqual([['MIC-03', true]]);
    expect((await owner.query("SELECT d.enabled, i.updated_by FROM public.capture_devices d JOIN public.capture_audio_inputs i ON i.device_id = d.id WHERE d.id = 'MIC-03'")).rows).toEqual([{ enabled: true, updated_by: TECHNICIAN.id }]);
    expect((await since(from)).map((row) => [row.type, row.details])).toEqual([['CAPTURE_AUDIO_INPUT_CHANGED', { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' }]]);

    const search = await post(technician, SEARCH);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, search.json())).toMatchObject({ ok: true });
    // R-FLEX row 131 (AU-L1): the card is bound to the microphone that holds it.
    expect((search.json() as { cards: { cardId: string; registered: unknown[]; boundTo: string | null }[] }).cards.map((card) => [card.cardId, card.registered, card.boundTo])).toEqual([
      [DUO.cardId, [], null],
      [SIX.cardId, [{ inputNumber: 4, deviceId: 'MIC-03' }], 'MIC-03'],
    ]);
  });

  it('200 CARD_CHANGED: another USB id behind the stored key is said in the answer and in ONE entry; still one device', async () => {
    host.use(INTERFACE_REPLACED);
    const from = (await trail()).length;
    const response = await post(technician, REGISTER, body(SIX.cardId, 4));
    expect([response.statusCode, response.json()]).toEqual([200, { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 4, channelCount: 6, releasedDeviceId: null }]);
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
    expect([stored4.statusCode, stored4.json()]).toEqual([201, { deviceId: 'MIC-04', change: 'REGISTERED', inputNumber: 1, channelCount: 2, releasedDeviceId: null }]);
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

// Task 4 row 199 (follow-up of row 192; AD-07 (4)): the two columns of schema set B are WRITTEN by
// a registration and READ by the match, as the runtime role, on this clone. THE DOUBLE: the host
// is the table of fixed listing texts (`fixtures.ts`), a serial being the one line of the kernel's
// attribute by card index. No Linux host, no sound card: `9A/H-07`. State this block starts from:
// MIC-03 = input 4 of the interface (its stored USB id was changed above), MIC-04 = input 1 of the
// card of two inputs, registered above with no serial on its port.
// DECLARED here beside the registration cases it extends, and RUN after the admission block below
// (`row199Cases()`): that block pins the four commits of the cases above, and these add commits.
function row199Cases(): void {
 describe('row 199: a registration stores the serial and the port path; a stored input matches a live card by serial, else by its model on any port (R-FLEX row 131)', () => {
  const identityRow = async (deviceId: string): Promise<unknown> => (await owner.query('SELECT usb_id, usb_serial, usb_port FROM public.capture_audio_inputs WHERE device_id = $1', [deviceId])).rows[0];
  const enabled = async (deviceId: string): Promise<unknown> => ((await owner.query('SELECT enabled FROM public.capture_devices WHERE id = $1', [deviceId])).rows[0] as { enabled?: boolean } | undefined)?.enabled;
  const off = async (deviceId: string): Promise<void> => void (await owner.query('UPDATE public.capture_devices SET enabled = false WHERE id = $1', [deviceId]));
  const enabledUsb = (): Promise<number> => count('capture_devices', "adapter_kind = 'USB_AUDIO' AND enabled");
  const changesSince = async (from: number): Promise<unknown[]> => (await since(from)).filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED').map((row) => [row.deviceId, row.details?.['change']]);

  it('a registration WRITES both values and they READ BACK, as dems_app: the serial where the card states one, NULL where it states none; the port path of both', async () => {
    host.use(TWO_CARDS_ONE_SERIAL);
    const response = await post(technician, REGISTER, body(SIX.cardId, 5));
    expect([response.statusCode, response.json()]).toEqual([201, { deviceId: 'MIC-05', change: 'REGISTERED', inputNumber: 5, channelCount: 6, releasedDeviceId: null }]);
    expect(await identityRow('MIC-05')).toEqual({ usb_id: SIX.usbId, usb_serial: SIX_SERIAL, usb_port: SIX_PORT });
    // The card of two inputs states no serial: MIC-04, registered by the block above, holds its port and NULL.
    expect(await identityRow('MIC-04')).toEqual({ usb_id: DUO.usbId, usb_serial: null, usb_port: DUO_PORT });
    // Read back through the module's own statements, as the runtime role.
    expect(await realStore.inputOf(guard.app.db.pool, { cardId: SIX.cardId, cardDevice: 0, inputNumber: 5 })).toEqual({ deviceId: 'MIC-05', usbId: SIX.usbId, usbSerial: SIX_SERIAL, usbPort: SIX_PORT, enabled: true });
    expect((await realStore.registeredInputs(guard.app.db.pool)).filter((input) => input.deviceId !== 'MIC-03').map((input) => [input.deviceId, input.identity])).toEqual([
      ['MIC-04', { usbId: DUO.usbId, usbSerial: null, usbPort: DUO_PORT }],
      ['MIC-05', { usbId: SIX.usbId, usbSerial: SIX_SERIAL, usbPort: SIX_PORT }],
    ]);
    // Row V3's contract members (the request of rows 199 / 200): BOTH values are in the answer of the search, over HTTP and
    // valid against the contract - the serial where the card states one and null where it states none, the port of both.
    const search = await post(technician, SEARCH);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, search.json())).toMatchObject({ ok: true });
    expect(search.json<{ cards: { cardId: string; usbSerial?: string | null; usbPort?: string | null }[] }>().cards.map((card) => [card.cardId, card.usbSerial, card.usbPort])).toEqual([
      [DUO.cardId, null, DUO_PORT],
      [SIX.cardId, SIX_SERIAL, SIX_PORT],
    ]);
  });

  it('THE STORED SERIAL ON ANOTHER PORT matches (the card was moved): 200 REENABLED, the microphone on again, the stored port follows', async () => {
    await off('MIC-05');
    host.use(TWO_CARDS_INTERFACE_MOVED);
    const from = (await trail()).length;
    const response = await post(technician, REGISTER, body(SIX.cardId, 5));
    expect([response.statusCode, response.json()]).toEqual([200, { deviceId: 'MIC-05', change: 'REENABLED', inputNumber: 5, channelCount: 6, releasedDeviceId: null }]);
    expect([await enabled('MIC-05'), await identityRow('MIC-05'), await changesSince(from)]).toEqual([true, { usb_id: SIX.usbId, usb_serial: SIX_SERIAL, usb_port: OTHER_PORT }, [['MIC-05', 'REENABLED']]]);
  });

  it('A CARD WITHOUT A SERIAL ON ITS STORED PORT matches: 200 REENABLED, the microphone on again', async () => {
    await off('MIC-04');
    host.use(TWO_CARDS_ONE_SERIAL);
    const response = await post(technician, REGISTER, body(DUO.cardId, 1));
    expect([response.statusCode, response.json()]).toEqual([200, { deviceId: 'MIC-04', change: 'REENABLED', inputNumber: 1, channelCount: 2, releasedDeviceId: null }]);
    expect([await enabled('MIC-04'), await identityRow('MIC-04')]).toEqual([true, { usb_id: DUO.usbId, usb_serial: null, usb_port: DUO_PORT }]);
  });

  // TURNED BY R-FLEX row 131 (AC9, D-A4.1; spec T-6): was "a same-product card with no matching serial on another port is
  // CARD_CHANGED". With no serial stored the card is its model, on ANY port: a port move is not a re-bind.
  it('T-6 / A PORT MOVE IS NOT A RE-BIND: the serial-less card on another port is bound to its microphone (boundTo, registered); operation 99 answers 200 REENABLED, the stored port follows, no second device', async () => {
    await off('MIC-04');
    host.use(TWO_CARDS_DUO_ELSEWHERE);
    const search = await post(technician, SEARCH);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, search.json())).toMatchObject({ ok: true });
    expect((search.json() as { cards: { cardId: string; registered: unknown[]; boundTo: string | null }[] }).cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([
      [DUO.cardId, 'MIC-04', [{ inputNumber: 1, deviceId: 'MIC-04' }]],
      // MIC-05 is found by its serial; MIC-03 (another USB id stored behind this key) does not hold this card.
      [SIX.cardId, 'MIC-05', [{ inputNumber: 5, deviceId: 'MIC-05' }]],
    ]);
    const from = (await trail()).length;
    const before = { stored: await stored(), usb: await usbMicrophones() };
    const moved = await post(technician, REGISTER, body(DUO.cardId, 1));
    expect([moved.statusCode, moved.json()]).toEqual([200, { deviceId: 'MIC-04', change: 'REENABLED', inputNumber: 1, channelCount: 2, releasedDeviceId: null }]);
    expect(validateCoreApiResponse('registerCaptureAudioInput', 200, moved.json())).toMatchObject({ ok: true });
    expect([await changesSince(from), await enabled('MIC-04'), await stored(), await usbMicrophones()]).toEqual([[['MIC-04', 'REENABLED']], true, before.stored, before.usb]);
    expect(await identityRow('MIC-04')).toEqual({ usb_id: DUO.usbId, usb_serial: null, usb_port: OTHER_PORT });
  });

  // R-FLEX row 131 (D-A4.2; spec T-7, T-8): a macOS-style move - the card under ANOTHER kernel card id and port.
  it('T-7 / T-8: the card under another kernel card id is still bound by IDENTITY (boundTo); operation 99 at the same input RE-KEYS the holder as dems_app - 200 REENABLED, card_id and usb_port follow, live row count unchanged, 1 audit REENABLED', async () => {
    host.use(TWO_CARDS_DUO_RENAMED);
    const search = await post(technician, SEARCH);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, search.json())).toMatchObject({ ok: true });
    expect((search.json() as { cards: { cardId: string; boundTo: string | null }[] }).cards.map((card) => [card.cardId, card.boundTo])).toEqual([
      [DUO_MOVED_CARD_ID, 'MIC-04'],
      [SIX.cardId, 'MIC-05'],
    ]);
    const live = await count('capture_audio_inputs', 'retired_at IS NULL');
    const from = (await trail()).length;
    const moved = await post(technician, REGISTER, body(DUO_MOVED_CARD_ID, 1));
    expect([moved.statusCode, moved.json()]).toEqual([200, { deviceId: 'MIC-04', change: 'REENABLED', inputNumber: 1, channelCount: 2, releasedDeviceId: null }]);
    expect((await owner.query("SELECT card_id, card_device, input_number, usb_id, usb_serial, usb_port FROM public.capture_audio_inputs WHERE device_id = 'MIC-04'")).rows).toEqual([
      { card_id: DUO_MOVED_CARD_ID, card_device: 0, input_number: 1, usb_id: DUO.usbId, usb_serial: null, usb_port: OTHER_PORT },
    ]);
    expect([await count('capture_audio_inputs', 'retired_at IS NULL'), await changesSince(from), await usbMicrophones()]).toEqual([live, [['MIC-04', 'REENABLED']], ['MIC-03', 'MIC-04', 'MIC-05']]);
  });

  // DECISION D48 (2026-10-23, reverses D10 (1) / Q96-01 a of row 131; spec T-9, T-10 as they were): ONE MICROPHONE PER INPUT
  // of a card. Was: another input of the held card refused 409 AUDIO_CARD_ALREADY_BOUND, and with release: true the holder moved.
  it('T-9 / T-10 (D48): another input of the held card is a SECOND microphone, as dems_app - 201 REGISTERED, two live rows of the card, the holder stays; the same input again is 200 REENABLED, also with release: true, nothing released', async () => {
    host.use(TWO_CARDS_DUO_RENAMED);
    const from = (await trail()).length;
    const before = await stored();
    const second = await post(technician, REGISTER, body(DUO_MOVED_CARD_ID, 2));
    expect([second.statusCode, second.json()]).toEqual([201, { deviceId: 'MIC-06', change: 'REGISTERED', inputNumber: 2, channelCount: 2, releasedDeviceId: null }]);
    expect(validateCoreApiResponse('registerCaptureAudioInput', 201, second.json())).toMatchObject({ ok: true });
    expect([await stored(), await count('capture_audio_inputs', `usb_id = '${DUO.usbId}' AND retired_at IS NULL`)]).toEqual([[before[0] + 1, before[1] + 1], 2]);
    expect((await owner.query('SELECT device_id, card_id, input_number FROM public.capture_audio_inputs WHERE usb_id = $1 AND retired_at IS NULL ORDER BY device_id', [DUO.usbId])).rows).toEqual([
      { device_id: 'MIC-04', card_id: DUO_MOVED_CARD_ID, input_number: 1 },
      { device_id: 'MIC-06', card_id: DUO_MOVED_CARD_ID, input_number: 2 },
    ]);
    // The same input twice is never a second microphone, and a release of it releases nothing.
    const again = await post(technician, REGISTER, { ...body(DUO_MOVED_CARD_ID, 2), release: true });
    expect([again.statusCode, again.json()]).toEqual([200, { deviceId: 'MIC-06', change: 'REENABLED', inputNumber: 2, channelCount: 2, releasedDeviceId: null }]);
    expect(await stored()).toEqual([before[0] + 1, before[1] + 1]);
    expect((await since(from)).filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED').map((row) => [row.deviceId, row.details?.['change'], row.details?.['inputNumber']])).toEqual([
      ['MIC-06', 'REGISTERED', 2],
      ['MIC-06', 'REENABLED', 2],
    ]);
    // Operation 98: the card names both inputs with their microphones; `boundTo` is the first holder, the lowest MIC id.
    const search = await post(technician, SEARCH);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, search.json())).toMatchObject({ ok: true });
    expect((search.json() as { cards: { cardId: string; registered: unknown[]; boundTo: string | null }[] }).cards.filter((card) => card.cardId === DUO_MOVED_CARD_ID).map((card) => [card.boundTo, card.registered])).toEqual([
      ['MIC-04', [{ inputNumber: 1, deviceId: 'MIC-04' }, { inputNumber: 2, deviceId: 'MIC-06' }]],
    ]);
  });

  // TURNED BY R-FLEX row 131 (Q96-09 a, register RM-A4 removed): a row with neither serial nor port is read as "no serial".
  it('AN INPUT STORED BEFORE THE TWO COLUMNS EXISTED (both NULL) is read as "no serial": the serial-less unit of its model, on any port, is its card - 200 REENABLED, and the registration stores its identity', async () => {
    await owner.query("UPDATE public.capture_audio_inputs SET usb_serial = NULL, usb_port = NULL WHERE device_id = 'MIC-04'");
    await off('MIC-04');
    host.use(TWO_CARDS_DUO_RENAMED);
    // R-FLEX row 108 (D24): DB-A2 on PostgreSQL, as dems_app, returns the row with NEITHER serial NOR port - it holds its card:
    // operation 98 names it (was invisible under the bundle-C filter). D48: MIC-06, input 2 of the card (T-9 above), holds it too.
    expect(await realStore.boundInputs(guard.app.db.pool, DUO.usbId)).toEqual([
      { deviceId: 'MIC-04', cardDevice: 0, inputNumber: 1, usbSerial: null, usbPort: null },
      { deviceId: 'MIC-06', cardDevice: 0, inputNumber: 2, usbSerial: null, usbPort: OTHER_PORT },
    ]);
    const held = await post(technician, SEARCH);
    expect((held.json() as { cards: { cardId: string; boundTo: string | null }[] }).cards.map((card) => [card.cardId, card.boundTo])).toEqual([
      [DUO_MOVED_CARD_ID, 'MIC-04'],
      [SIX.cardId, 'MIC-05'],
    ]);
    // D48: input 2 is MIC-06's own input - its microphone again, never refused for MIC-04's holding of the card.
    const second = await post(technician, REGISTER, body(DUO_MOVED_CARD_ID, 2));
    expect([second.statusCode, second.json()]).toEqual([200, { deviceId: 'MIC-06', change: 'REENABLED', inputNumber: 2, channelCount: 2, releasedDeviceId: null }]);
    const from = (await trail()).length;
    const again = await post(otherTechnician, REGISTER, body(DUO_MOVED_CARD_ID, 1));
    expect([again.statusCode, (again.json() as { change: string }).change]).toEqual([200, 'REENABLED']);
    expect([await changesSince(from), await enabled('MIC-04'), await identityRow('MIC-04')]).toEqual([[['MIC-04', 'REENABLED']], true, { usb_id: DUO.usbId, usb_serial: null, usb_port: OTHER_PORT }]);
    // The match is logged as a CODE of the rule, never a serial or a port; the port refusal and the no-identity refusal are gone.
    const matches = guard.log.lines().filter((line) => line['source'] === 'captureAudioCards' && typeof line['match'] === 'string').map((line) => String(line['match']));
    expect(matches).toEqual(expect.arrayContaining(['SAME_CARD', 'USB_ID_DIFFERS']));
    expect(matches.filter((match) => /PORT_DIFF|NOT_STORED/.test(match))).toEqual([]);
  });
 });
}

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
    // CONTROL (updated for the lift, AM-1, commit d9df31ac; decision C154): since the lift a `USB_AUDIO` adapter that states an opener
    // IS registered in REAL_PRODUCTION (its kind is on OPENER_CAPABLE_KINDS and its source class is the class that operation records),
    // and is still REFUSED in a development registry. Both halves run on registries of their own, so this file's shared registry
    // (read by the cases below) is not changed by the control.
    const withOpener = (): AudioInputAdapter => usbAudioStandIn({ id: 'MIC-99', kind: 'MIC', adapterKind: 'USB_AUDIO', model: null }, true);
    const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    production.register(withOpener());
    expect(production.list().map((device) => [device.id, device.adapterKind, device.sourceClass, device.hasOpener])).toEqual([['MIC-99', 'USB_AUDIO', 'PRODUCTION', true]]);
    const development = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
    expect(() => development.register(withOpener())).toThrow(CaptureAdapterError);
    expect(development.list()).toEqual([]);
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

row199Cases();

describe('a session is open: 409 CAPTURE_CONFIG_LOCKED for both operations (idle only)', () => {
  it('no audit row, the host is not read, nothing stored; with the session cancelled both are accepted again', async () => {
    const principal: Principal = { kind: 'OPERATOR', operatorId: INVESTIGATOR.id, sessionId: 'row070-investigator', deviceId: null, role: INVESTIGATOR.role } as Principal;
    const created = await guard.app.engine.command(principal, 'createSession', { caseNumber: 'LP/2026/1013-0070', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: INVESTIGATOR.id });
    expect(created.value).toMatchObject({ ok: true });
    await guard.app.pipeline.drain();
    const rows = (await trail()).length;
    const before = await stored();
    const listings = host.listings();
    // R-FLEX row 108, spec T-12: a RELEASE of the held card of two inputs is refused the same, before anything is read or moved.
    for (const [url, payload] of [
      [SEARCH, undefined],
      [REGISTER, body(SIX.cardId, 2)],
      [REGISTER, { ...body(DUO_MOVED_CARD_ID, 2), release: true }],
      [REGISTER, { ...body(DUO.cardId, 2), release: true }],
    ] as const) {
      for (const session of [otherTechnician, technician]) expect(reasonOf(await post(session, url, payload)), url).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    }
    expect((await trail()).length).toBe(rows);
    expect(await stored()).toEqual(before);
    expect(host.listings()).toBe(listings);
    await guard.app.engine.command(principal, 'cancel');
    await guard.app.pipeline.drain();
    // CONTROL: with no session open the same two calls are accepted. (Both inputs of the card of two inputs have their
    // microphones, MIC-04 and MIC-06 (D48), so the control registers a free input of the interface.)
    expect((await post(otherTechnician, SEARCH)).statusCode).toBe(200);
    expect((await post(technician, REGISTER, body(SIX.cardId, 2))).statusCode).toBe(201);
    // T-12: the holder of the card of two inputs did not move.
    expect((await owner.query("SELECT input_number FROM public.capture_audio_inputs WHERE device_id = 'MIC-04'")).rows).toEqual([{ input_number: 1 }]);
  });
});

// R-FLEX row 108 (spec T-11; X-1: no extra gate, the units of work run one at a time), TURNED BY D48 (one microphone per
// input of a card): two registrations of two inputs of ONE card, begun together. Each is 201, or refused by the listing gate
// (one listing at a time) - never AUDIO_CARD_ALREADY_BOUND: the inputs differ. Was: exactly one 201, one live row of the card.
describe('T-11 (D48): two registrations of two inputs of one card begun together', () => {
  it('each is 201 REGISTERED or 409 AUDIO_CARD_SEARCH_IN_PROGRESS; one live row and one REGISTERED entry per accepted input; a refused input registers after; the same input again is 200 REENABLED, never a second microphone', async () => {
    host.use(THREE_CARDS);
    const from = (await trail()).length;
    const before = await stored();
    const live = (): Promise<number> => count('capture_audio_inputs', `usb_id = '${TRIO.usbId}' AND retired_at IS NULL`);
    const answers = await Promise.all([post(technician, REGISTER, body(TRIO.cardId, 1)), post(otherTechnician, REGISTER, body(TRIO.cardId, 2))]);
    for (const answer of answers) if (answer.statusCode !== 201) expect([answer.statusCode, errorOf(answer).details?.['reason']]).toEqual([409, 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    const accepted = answers.filter((answer) => answer.statusCode === 201).length;
    expect(accepted).toBeGreaterThanOrEqual(1);
    expect(await live()).toBe(accepted);
    expect(await stored()).toEqual([before[0] + accepted, before[1] + accepted]);
    expect((await since(from)).filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED').map((row) => row.details?.['change'])).toEqual(Array.from({ length: accepted }, () => 'REGISTERED'));
    // Begun one after the other, the input the listing gate refused is a second microphone of the card.
    for (const [index, answer] of answers.entries()) if (answer.statusCode !== 201) expect((await post(otherTechnician, REGISTER, body(TRIO.cardId, index + 1))).statusCode).toBe(201);
    const rows = (await owner.query('SELECT device_id, input_number FROM public.capture_audio_inputs WHERE usb_id = $1 AND retired_at IS NULL ORDER BY input_number', [TRIO.usbId])).rows as { device_id: string; input_number: number }[];
    expect([rows.map((row) => row.input_number), new Set(rows.map((row) => row.device_id)).size]).toEqual([[1, 2], 2]);
    // The same input twice: its microphone again, no second one.
    const again = await post(technician, REGISTER, body(TRIO.cardId, 1));
    expect([again.statusCode, again.json()]).toEqual([200, { deviceId: rows[0]?.device_id, change: 'REENABLED', inputNumber: 1, channelCount: TRIO.channels, releasedDeviceId: null }]);
    expect(await live()).toBe(2);
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
    expect((await owner.query("SELECT DISTINCT model FROM public.capture_devices WHERE adapter_kind = 'USB_AUDIO' ORDER BY model")).rows.map((row: { model: string }) => row.model)).toEqual([DUO.product, SIX.product, TRIO.product]);
  });
});
