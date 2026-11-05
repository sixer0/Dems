// The composition of production capture on the REAL app and PostgreSQL (task 4 row 85b; decision C55).
//
// What the unit file cannot show: the app-bound function opens the REAL doors of the three modules and of the session,
// once, in `REAL_PRODUCTION` only; the stored facts are read from the registry tables as the runtime role; and with no
// network facts injected (R-FLEX, row 109: no reader is the one "not configured" left for a stored camera) both credential readers refuse a registered production camera with no
// reveal and no audit entry. Nothing is booted and nothing is started: no worker, no relay, no camera, no port. The
// composition is asked for where the entry point asks for it, after `app.ready()` and before the boot steps.
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../test/support/config';
import { buildApp } from '../app';
import { buildProductionRegistryOf, captureFenceControl } from '../capture/fence';
import type { DestinationContext } from '../capture/destination-rule';
import type { ConfigInput } from '../config';
import { CaptureCompositionCode, composeProductionCaptureOf, productionCaptureComposition, type ProductionCaptureInput } from '../capture-composition';
import { adoptedCameraTestControl, captureConnectControl } from '../modules/capture-discovery';
import { captureAudioCardsControl } from '../modules/capture-inputs';
// Integration pass I-9a: the network facts through the real composition (the block at the end of this file).
import type { LightMyRequestResponse } from 'fastify';
import { afterAll } from 'vitest';
import { TEST_CAPTURE_HOST, testHostPrograms, testListingStandIns } from '../../test/support/capture-host';
import { readTrail } from '../../test/support/core';
import { FIXED_NOW, engineApp } from '../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../test/support/identity';
import { CaptureAdapterKind, type OnvifCandidate, type OnvifDiscoveryAdapter, type WsDiscoveryResult } from '../capture/adapters';
import { captureBootControl } from '../capture/boot';
import { realBootFixture } from '../capture/boot/__tests__/support';
import { captureNetworkConfigControl, captureNetworkFacts, type HostInterface } from '../modules/capture-config';
import { captureDiscoveryControl, captureReaddressControl, typedAddressControl } from '../modules/capture-discovery';
import { hashPassword } from '../modules/identity/password-hash';
import { BootError } from '../plugins/readiness';
// Task 4 row 106b: the alias through the real composition (the block at the end of this file).
import { validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import { factoryScanRuleOf } from '../capture/fence';
import { HELPER_CODES, type HelperCodeName, type HostAliasExchange, type HostAliasTransport } from '../capture/host-alias';
import { productionHostAlias } from '../capture-composition';
import { captureFactoryScanControl, captureHostAliasControl } from '../modules/capture-config';
import { createFactoryScanGate } from '../modules/capture-config/factory-scan';
import { throttleControl } from '../plugins/throttle';
// Task 4 row 111b: the host's observations through the real composition (the last case of the row-106b block).
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSystemTimers } from '../capture';
import { hostCommissioningInputsOf, productionCameraDoors } from '../capture/fence';

const db = useTestDatabase({ template: 'seed', slug: 'row85b' });

const HOST: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  // R-FLEX NW-C1 (row 136): the eligible interfaces the global STORED_CAMERA rule reads; without them it is NOT_CONFIGURED (RF-N7, RM-N4).
  interfaceSubnets: [
    { name: 'eth1', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth0', address: '10.20.0.5', network: '10.20.0.0', prefixLength: 24 },
  ],
  hostAddresses: ['192.168.50.1', '10.20.0.5'],
};
const SESSION = 'SES-20261013-0085';

/** What an adoption and a microphone registration leave: a production camera at a stored address, and a registered input with its serial and port path. */
async function productionRows(owner: Pool): Promise<void> {
  await owner.query(
    "INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind, address) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP', '192.168.50.21'), ('CAM-12', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP', '127.0.0.1:8557'), ('MIC-11', 'MIC', 'USB', true, 'USB_AUDIO', NULL)",
  );
  await owner.query(
    "INSERT INTO public.capture_audio_inputs (device_id, usb_id, card_id, card_device, input_number, native_channels, updated_at, usb_serial, usb_port) VALUES ('MIC-11', '1235:8215', 'USB', 0, 3, 18, 1760000000000, 'Y8ABC123', '0000:00:14.0-2.3')",
  );
}

async function ready(slug: string, overrides: Partial<ConfigInput>, prepare?: (owner: Pool) => Promise<unknown>) {
  const target = await db.another({ template: 'seed', slug });
  await prepare?.(target.ownerPool());
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
  target.onCleanup(() => app.close());
  await app.ready();
  return { app, log, owner: target.ownerPool() };
}

const codeOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: unknown }).code;
  }
  return 'RESOLVED';
};
const audits = async (owner: Pool): Promise<number> => Number((await owner.query('SELECT count(*)::int AS n FROM public.audit_log')).rows[0]?.n);

const PRODUCTION: Partial<ConfigInput> = { captureMode: 'real', demoControls: false };
const DEVELOPMENT: Partial<ConfigInput> = { captureMode: 'real', demoControls: false, captureDevSources: true };
const INPUT: ProductionCaptureInput = { platform: 'darwin' };

describe('row 85b: the composition on the real app, in each capture operation', () => {
  it.each([
    ['SIMULATED', { demoControls: true }],
    ['REAL_DEVELOPMENT', DEVELOPMENT],
  ] as const)('%s: nothing is composed - the connection test has no reader, the card listing no enumerator; a second call is refused', async (operation, overrides) => {
    const { app } = await ready(`r85b_${operation.toLowerCase()}`, overrides, productionRows);
    expect(captureFenceControl(app).operation).toBe(operation);
    expect(productionCaptureComposition(app)).toBeNull();
    const composition = composeProductionCaptureOf(app, { ...INPUT, network: () => HOST });
    expect(composition).toEqual({ composed: false, operation });
    expect(productionCaptureComposition(app)).toBe(composition);
    expect([adoptedCameraTestControl(app).ready(), captureAudioCardsControl(app).ready()]).toEqual([false, false]);
    expect(() => composeProductionCaptureOf(app, INPUT)).toThrow(expect.objectContaining({ code: CaptureCompositionCode.COMPOSED_TWICE }));
    // Row 143c (C65): the candidate rule of the connect flow was NOT handed in - its door is still open for a first hand-over.
    expect(() => captureConnectControl(app).provideCandidateRule(() => ({ allowed: false, refusal: 'NOT_CONFIGURED' }))).not.toThrow();
  });

  it('REAL_PRODUCTION, as the entry point composes it (the platform and NO network facts): the three doors are opened once; every stored camera address is refused before a reveal - 0 audit entries; the card listing states its named reason', async () => {
    const { app, log, owner } = await ready('r85b_production', PRODUCTION, productionRows);
    expect(captureFenceControl(app).operation).toBe('REAL_PRODUCTION');
    expect([adoptedCameraTestControl(app).ready(), captureAudioCardsControl(app).ready()]).toEqual([false, false]);
    const composition = composeProductionCaptureOf(app, INPUT);
    if (!composition.composed) throw new Error('expected a composition');
    expect([adoptedCameraTestControl(app).ready(), captureAudioCardsControl(app).ready()]).toEqual([true, true]);
    // Row N7: macOS has a listing; this configuration names no audio helper, so its third row cannot be started - the named answer.
    expect([composition.networkFactsInjected, composition.cardListingUnavailable, composition.relayReports.attached()]).toEqual([false, 'LISTING_PROGRAM_NOT_HANDED_IN', false]);
    // Once per app: the doors of the modules refuse a second hand-over, and so does the composition itself.
    expect(() => composeProductionCaptureOf(app, INPUT)).toThrow(expect.objectContaining({ code: CaptureCompositionCode.COMPOSED_TWICE }));
    expect(() => captureAudioCardsControl(app).provideEnumerator(composition.cards)).toThrow('provided twice');
    expect(() => adoptedCameraTestControl(app).provide({ reader: { connectionTest: async () => Promise.reject(new Error('no')) }, storedAddress: composition.storedAddress })).toThrow('provided twice');
    // Row 143c (C65): the SAME binding went to the connect flow, once - the test of a candidate is bound by it in production.
    expect(() => captureConnectControl(app).provideCandidateRule(composition.storedAddress)).toThrow('provided twice');

    // The stored facts, read as the runtime role outside any unit of work.
    expect(await composition.stored.candidate('CAM-11')).toMatchObject({ adapterKind: 'ONVIF_RTSP', host: '192.168.50.21', serviceAddress: 'http://192.168.50.21/onvif/device_service' });
    expect(await composition.stored.candidate('CAM-01')).toBeNull();
    expect(await composition.stored.stream('CAM-11', 'H264_1080P25')).toBeNull();
    expect(await composition.stored.microphone('MIC-11')).toEqual({ deviceId: 'MIC-11', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 3, nativeChannels: 18, usbSerial: 'Y8ABC123', usbPort: '0000:00:14.0-2.3' });
    expect(await composition.stored.microphone('MIC-01')).toBeNull();

    // FAIL-CLOSED: no network facts. A production camera inside what WOULD be the camera subnet and one at loopback are both refused.
    const before = await audits(owner);
    const reader = composition.dependencies.camera.credentials;
    expect([await codeOf(reader.sessionOpen('CAM-11', SESSION)), await codeOf(reader.relayRestart('CAM-11', SESSION)), await codeOf(reader.sessionOpen('CAM-12', SESSION))]).toEqual(['CAPTURE_CREDENTIAL_ADDRESS_REFUSED', 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED', 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED']);
    // A development camera of the seed is refused for its kind, whatever the address rule says.
    expect(await codeOf(reader.sessionOpen('CAM-01', SESSION))).toBe('CAPTURE_CREDENTIAL_DEVICE_REFUSED');
    expect(await audits(owner)).toBe(before);
    expect([composition.storedAddress('192.168.50.21', undefined), composition.storedAddress('127.0.0.1', 8557)]).toEqual([{ allowed: false, refusal: 'NOT_CONFIGURED' }, { allowed: false, refusal: 'LOOPBACK' }]);

    // The card listing: a named refusal, said once in the log at the composition.
    expect(await codeOf(composition.cards.list())).toBe('AUDIO_CARD_LISTING_NOT_AVAILABLE');
    const lines = log.lines().filter((line) => String(line['code'] ?? '').startsWith('CAPTURE_COMPOSITION') || line['code'] === 'AUDIO_CARD_LISTING_NOT_AVAILABLE');
    expect(lines.map((line) => [line['code'], line['reason'] ?? line['cardListing'] ?? null])).toEqual([
      ['AUDIO_CARD_LISTING_NOT_AVAILABLE', 'LISTING_PROGRAM_NOT_HANDED_IN'],
      ['CAPTURE_COMPOSITION_DONE', 'LISTING_PROGRAM_NOT_HANDED_IN'],
    ]);
    // No address and no path in a line of the composition.
    expect(JSON.stringify(lines)).not.toMatch(/192\.168\.|127\.0\.0\.1|\/onvif/);
  });

  it('REAL_PRODUCTION with the host facts INJECTED (what row 108 will hand in): the camera of the camera subnet passes the gate and its reveal is refused only by the store; the loopback row stays refused', async () => {
    const { app, owner } = await ready('r85b_production_facts', PRODUCTION, productionRows);
    const composition = composeProductionCaptureOf(app, { ...INPUT, network: () => HOST });
    if (!composition.composed) throw new Error('expected a composition');
    expect(composition.networkFactsInjected).toBe(true);
    const before = await audits(owner);
    const reader = composition.dependencies.camera.credentials;
    // CAM-11 has no stored credential on this clone: the gate is passed and the reader answers its own code - not the address refusal.
    const admitted = await codeOf(reader.sessionOpen('CAM-11', SESSION));
    expect(typeof admitted).toBe('string');
    expect(admitted).not.toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    expect(admitted).not.toBe('RESOLVED');
    expect(await codeOf(reader.sessionOpen('CAM-12', SESSION))).toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    expect(composition.storedAddress('192.168.50.21', undefined)).toMatchObject({ allowed: true });
    expect(adoptedCameraTestControl(app).ready()).toBe(true);
    // No credential was revealed for the refused camera: at most the one entry of CAM-11's own read exists.
    expect((await audits(owner)) - before).toBeLessThanOrEqual(1);
  });
});

// Task 4 row 85c (decision C60 (2), (3)): the remainder, on the real app and PostgreSQL. Nothing is booted, no program is
// started (the platform handed in is macOS: the listing program is never asked), no device is contacted.
describe('row 85c: the remainder of the composition on the real app', () => {
  const CAMERA_FAULT = { code: 'CAPTURE_FAULT', subject: 'CAM-11', reason: 'CAMERA_STREAM_ENDED' } as const;
  const MIC_FAULT = { code: 'CAPTURE_FAULT', subject: 'MIC-11', reason: 'MIC_DISCONNECTED' } as const;
  const faultRows = async (owner: Pool): Promise<string[]> =>
    (await owner.query<{ type: string; reason: string | null; device: string | null }>("SELECT type, details->>'reason' AS reason, device_id AS device FROM public.audit_log WHERE type IN ('FAULT_RAISED', 'FAULT_CLEARED') AND details->>'kind' = 'CAPTURE_FAULT' ORDER BY seq")).rows.map((row) => `${row.type} ${String(row.reason)}`);

  it('(c) the audio helper of the configuration reaches the audio bundle; (e) the microphone watch is told "not superseded" by a supervisor that replaces no worker; (d) with NO engine running the sink writes nothing and says so by name', async () => {
    const { app, owner } = await ready('r85c_parts', { ...PRODUCTION, captureAudioHelperPath: '/opt/dems/bin/ffmpeg', captureGuardPath: '/opt/dems/bin/capture-guard' }, productionRows);
    const composition = composeProductionCaptureOf(app, INPUT);
    if (!composition.composed) throw new Error('expected a composition');
    expect([composition.dependencies.audio.helperProgram, composition.dependencies.audio.guardProgram]).toEqual(['/opt/dems/bin/ffmpeg', '/opt/dems/bin/capture-guard']);
    expect(composition.watches.microphone.superseded('MIC-11')).toBe(false);
    expect(composition.watches.camera.faults).toBe(composition.watches.microphone.faults);
    if (app.engine.running) await app.engine.stop();
    const before = await audits(owner);
    expect(await codeOf(composition.faults.raise(CAMERA_FAULT))).toBe('CAPTURE_WATCH_FAULT_ENGINE_NOT_AVAILABLE');
    expect(await codeOf(composition.faults.clear(CAMERA_FAULT))).toBe('CAPTURE_WATCH_FAULT_ENGINE_NOT_AVAILABLE');
    expect([composition.faults.owned(), await audits(owner)]).toEqual([[], before]);
  });

  it('(d) THE SINK ON THE REAL ENGINE: a fault the watch raised is ONE FAULT_RAISED row and its clear ONE FAULT_CLEARED row; a fault the engine held before the watch spoke is neither owned nor cleared; another cause on the same device is never touched', async () => {
    const { app, owner } = await ready('r85c_sink', PRODUCTION, productionRows);
    const composition = composeProductionCaptureOf(app, INPUT);
    if (!composition.composed) throw new Error('expected a composition');
    if (!app.engine.running) await app.engine.start('resync');
    const active = (): string[] => app.engine.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => `${String(fault.reason)}@${String(fault.target)}`).sort();
    const { faults } = composition;

    // (1) The watch's own fault.
    await faults.raise(CAMERA_FAULT);
    await faults.raise(CAMERA_FAULT);
    expect(active()).toEqual(['CAMERA_STREAM_ENDED@CAM-11']);
    expect(faults.owned()).toEqual(['CAMERA_STREAM_ENDED:CAM-11']);
    // Another part raises another cause on the SAME camera meanwhile (the worker's integrity fault).
    await app.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-11', reason: 'CAMERA_ANNOUNCE_NOT_SEEN' } as never);
    await faults.clear(CAMERA_FAULT);
    expect(active()).toEqual(['CAMERA_ANNOUNCE_NOT_SEEN@CAM-11']);
    expect(faults.owned()).toEqual([]);

    // (2) Another part's fault under the watch's own key: the capture worker said the microphone delivers nothing, first.
    await app.engine.raiseCaptureWarning(MIC_FAULT as never);
    await faults.raise(MIC_FAULT);
    expect(faults.owned()).toEqual([]);
    await faults.clear(MIC_FAULT);
    expect(active()).toEqual(['CAMERA_ANNOUNCE_NOT_SEEN@CAM-11', 'MIC_DISCONNECTED@MIC-11']);

    // (3) A fault of its own that another part ended: the clear writes no second FAULT_CLEARED row.
    await faults.raise(CAMERA_FAULT);
    await app.engine.clearCaptureWarning(CAMERA_FAULT as never);
    await faults.clear(CAMERA_FAULT);
    expect(faults.owned()).toEqual([]);

    expect(await faultRows(owner)).toEqual([
      'FAULT_RAISED CAMERA_STREAM_ENDED',
      'FAULT_RAISED CAMERA_ANNOUNCE_NOT_SEEN',
      'FAULT_CLEARED CAMERA_STREAM_ENDED',
      'FAULT_RAISED MIC_DISCONNECTED',
      'FAULT_RAISED CAMERA_STREAM_ENDED',
      'FAULT_CLEARED CAMERA_STREAM_ENDED',
    ]);
  });

  it('(f), (g) the wider device read and the later admission on PostgreSQL, as the runtime role: the stored profile list of a camera reaches its entry; a camera inserted after the build is admitted from ITS STORED ROW', async () => {
    const { app, owner } = await ready('r85c_builder', PRODUCTION, async (pool) => {
      await productionRows(pool);
      await pool.query(`UPDATE public.capture_devices SET profiles = '["H264_1080P25","H264_720P25"]'::jsonb, model = 'Room camera A' WHERE id = 'CAM-11'`);
    });
    const executor = { query: <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]) => app.db.read('row85c.test', (pool) => pool.query(text, values as unknown[] | undefined)) as unknown as Promise<{ rows: Row[] }> };
    const taken: string[] = [];
    const told: string[] = [];
    const built = await buildProductionRegistryOf({
      operation: captureFenceControl(app).operation,
      executor,
      reader: executor,
      dependencies: { camera: null, audio: null },
      // Stand-ins of the three production kinds WITHOUT an opener (as the class-C stubs), the camera one with the door of a later device.
      load: async (_operation, devices) =>
        ({
          camera: { seam: 'CAMERA', kind: 'ONVIF_RTSP', hasOpener: false, devices: devices.cameras, admitDevice: (entry: { id: string }) => void taken.push(entry.id) },
          audio: { seam: 'AUDIO', kind: 'USB_AUDIO', hasOpener: false, devices: devices.mics },
          poe: { seam: 'POE', kind: 'SNMP_POE', devices: devices.switches },
        }) as never,
      audioCards: async () => null,
      onAdmission: (deviceId, outcome, code) => void told.push(`${deviceId} ${outcome} ${String(code)}`),
    });
    expect(built.registry.list().map((device) => [device.id, device.label, device.capabilities, device.profiles])).toEqual([
      ['CAM-11', 'Room camera A', ['VIDEO'], ['H264_1080P25', 'H264_720P25']],
      ['CAM-12', 'CAM-12', ['VIDEO'], []],
      ['MIC-11', 'MIC-11', ['AUDIO'], []],
    ]);
    expect(built.malformedProfiles()).toEqual([]);
    // A camera adopted after the build: the caller names it; the row says what it is.
    await owner.query(`INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind, address, profiles) VALUES ('CAM-13', 'CAMERA', 'RTSP', 'Adopted later', true, 'ONVIF_RTSP', '192.168.50.23', '["H264_1080P25"]'::jsonb)`);
    expect(built.admit({ id: 'CAM-13', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: 'not the stored label' })).toBe('ADMITTING');
    expect(await built.admitted('CAM-13')).toBe('ADMITTED');
    expect(built.registry.describe('CAM-13')).toMatchObject({ label: 'Adopted later', capabilities: ['VIDEO'], profiles: ['H264_1080P25'], sourceClass: 'PRODUCTION', hasOpener: false });
    expect([taken, told]).toEqual([['CAM-13'], ['CAM-13 ADMITTED null']]);
    // A microphone registered after the build: its adapter has no door of a later device (as both built adapters today) - not served.
    await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('MIC-12', 'MIC', 'USB', true, 'USB_AUDIO')");
    expect(built.admit({ id: 'MIC-12', kind: 'MIC', adapterKind: 'USB_AUDIO', model: null })).toBe('NOT_SERVED');
    // The mounted fence of this app is untouched by any of it: before the lift it serves no production device.
    expect(captureFenceControl(app).admitDevice({ id: 'CAM-13', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: null })).toBe('NOT_SERVED');
  });
});

// INTEGRATION PASS I-9a (request lines `row 108`, `row 197`; records 095, 096, 108; decisions C55, C60 (4)): THE NETWORK
// FACTS THROUGH THE REAL COMPOSITION, at its three takers. The reader is the capture-config module's own
// (`captureNetworkFacts(app)`, as the entry point's ONE statement hands it in); the stored choice is a row of
// `capture_network_config`; the host's interface table is a double of this file (`eth1` = the camera port on
// 192.168.50.0/24) - no interface of this Mac is read, no address is contacted, no device and no credential exists.
describe('integration pass I-9a: the network facts through the real composition', () => {
  /** The host of this block: an office network on `eth0`, the camera port `eth1`, a loopback. Synthetic. */
  // R-FLEX row 136: a non-zero `mac` on every non-loopback address - row 105 makes an address without one ineligible as a source (RG-13).
  const INTERFACES: readonly HostInterface[] = [
    { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
    { name: 'eth0', internal: false, addresses: [{ address: '10.20.0.15', prefixLength: 16, mac: '02:00:00:00:00:e0' }] },
    { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24, mac: '02:00:00:00:00:e1' }] },
  ];
  const INSIDE = '192.168.50.31';
  const OUTSIDE = '192.168.60.31';
  const STORE_CHOICE = "INSERT INTO public.capture_network_config (interface_name, camera_subnet, updated_at) VALUES ('eth1', '192.168.50.0/24', 1760000000000)";

  it('(1) the entry\'s statement: the reader is handed in and NOT called at composition; a stored camera address inside the configured subnet is allowed and one outside refused; with no configuration the global purposes judge on the eligible interfaces (R-FLEX RM-N4)', async () => {
    const { app, owner } = await ready('i9a_facts', PRODUCTION, async (pool) => {
      await productionRows(pool);
      await pool.query(STORE_CHOICE);
    });
    const control = captureNetworkConfigControl(app);
    let tableReads = 0;
    control.replaceForTest({
      interfaces: () => {
        tableReads += 1;
        return INTERFACES;
      },
    });
    // BEFORE the boot step `capture.config`: the row is stored and the reader knows nothing of it.
    expect(captureNetworkFacts(app)()).toBeNull();
    // What that boot step runs. From here a CALL of the reader reads the host's table: the count below is the count of calls.
    await control.load();
    tableReads = 0;

    // THE ENTRY'S ONE STATEMENT (its platform word aside).
    const composition = composeProductionCaptureOf(app, { platform: 'darwin', network: captureNetworkFacts(app) });
    if (!composition.composed) throw new Error('expected a composition');
    expect(composition.networkFactsInjected).toBe(true);
    // NOT CALLED AT COMPOSITION TIME: no taker was asked, so nobody asked the reader.
    expect(tableReads).toBe(0);
    expect([captureReaddressControl(app).factsProvided(), typedAddressControl(app).ruled()]).toEqual([true, true]);
    expect(tableReads).toBe(0);

    // CALLED AT EACH JUDGEMENT: one read of the table per answer.
    expect(composition.storedAddress(INSIDE, undefined)).toEqual({ allowed: true, destination: { address: INSIDE, port: 80, sourceAddress: '192.168.50.1', viaAlias: false } });
    expect(tableReads).toBe(1);
    // R-FLEX (row 136): off-link is NW-R1 NO_SOURCE_INTERFACE, no longer OUTSIDE_CAMERA_SUBNET (RM-N2).
    expect(composition.storedAddress(OUTSIDE, undefined)).toEqual({ allowed: false, refusal: 'NO_SOURCE_INTERFACE' });
    expect(tableReads).toBe(2);
    // The same facts at the typed probe's rule (item 3): the rule's own answer for a typed address, as it came.
    expect(typedAddressControl(app).decide('192.168.50.77')).toEqual({ allowed: true, destination: { address: '192.168.50.77', port: 80, sourceAddress: '192.168.50.1', viaAlias: false } });
    // R-FLEX (row 136): TYPED_PROBE is global - off-link NO_SOURCE_INTERFACE (RM-N2); the office subnet is dialled from eth0 (RM-N1 lifted).
    expect(typedAddressControl(app).decide('192.168.60.77')).toEqual({ allowed: false, refusal: 'NO_SOURCE_INTERFACE' });
    expect(typedAddressControl(app).decide('10.20.0.77')).toEqual({ allowed: true, destination: { address: '10.20.0.77', port: 80, sourceAddress: '10.20.0.15', viaAlias: false } });
    expect(tableReads).toBe(5);
    // Through the credential reader of the camera bundle: CAM-11 (192.168.50.21) passes the gate - its refusal is the store's, not the address rule's.
    const reader = composition.dependencies.camera.credentials;
    const admitted = await codeOf(reader.sessionOpen('CAM-11', SESSION));
    expect(admitted).not.toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    expect(admitted).not.toBe('RESOLVED');

    // THE CHOICE IS TAKEN AWAY (the interface is not chosen). R-FLEX (row 136): the facts are still a context with
    // `cameraSubnet: null` (row 105, RF-N3), and STORED_CAMERA / TYPED_PROBE no longer answer NOT_CONFIGURED for a missing
    // camera interface (RM-N4): they judge on the eligible interfaces - the camera port's subnet is dialled from eth1, off-link is NW-R1.
    await owner.query('UPDATE public.capture_network_config SET interface_name = NULL, revision = revision + 1');
    await control.load();
    expect(captureNetworkFacts(app)()).toMatchObject({ cameraSubnet: null, cameraAddresses: [] });
    const fromEth1 = (address: string) => ({ allowed: true, destination: { address, port: 80, sourceAddress: '192.168.50.1', viaAlias: false } });
    expect([composition.storedAddress(INSIDE, undefined), composition.storedAddress(OUTSIDE, undefined)]).toEqual([fromEth1(INSIDE), { allowed: false, refusal: 'NO_SOURCE_INTERFACE' }]);
    expect(typedAddressControl(app).decide('192.168.50.77')).toEqual(fromEth1('192.168.50.77'));
    expect(await codeOf(reader.sessionOpen('CAM-11', SESSION))).not.toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    // NO ROW AT ALL: the same (RM-N4).
    await owner.query('DELETE FROM public.capture_network_config');
    await control.load();
    expect([composition.storedAddress(INSIDE, undefined), typedAddressControl(app).decide('192.168.50.77')]).toEqual([fromEth1(INSIDE), fromEth1('192.168.50.77')]);
  });

  it('a Core that is NOT production, and a production Core composed WITHOUT a reader: neither door is opened - a re-address and a typed address stay refused', async () => {
    const development = await ready('i9a_dev', DEVELOPMENT, productionRows);
    expect(composeProductionCaptureOf(development.app, { platform: 'darwin', network: () => HOST })).toEqual({ composed: false, operation: 'REAL_DEVELOPMENT' });
    expect([captureReaddressControl(development.app).factsProvided(), typedAddressControl(development.app).ruled()]).toEqual([false, false]);
    const bare = await ready('i9a_bare', PRODUCTION, productionRows);
    expect(composeProductionCaptureOf(bare.app, INPUT)).toMatchObject({ composed: true, networkFactsInjected: false });
    expect([captureReaddressControl(bare.app).factsProvided(), typedAddressControl(bare.app).ruled()]).toEqual([false, false]);
    expect(typedAddressControl(bare.app).decide('192.168.50.77')).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
  });

  // ── (2), (3): THROUGH THE ROUTES of a BOOTED production Core ─────────────────────────────────
  // The order is the entry point's: ready, the composition, the host facts, the boot steps (`capture.fence`, then
  // `capture.config`, which loads the stored choice). The Core is held to the explicit TEST host (C46) and to a stand-in
  // worker that the boot inspects and never drives. The discovery adapter is a SCRIPT of this file: no datagram leaves.
  // Task 4 row 228b: this block's own synthetic installation (not a reserved id) - the key names it and the production Core is configured with it.
  const fixture = realBootFixture('i9a', 'DEMS-TEST-I9A');
  fixture.provisionKey();
  afterAll(() => fixture.remove());
  const DISCOVERY = '/api/v1/capture/discovery';
  const CONFIRM = '/api/v1/capture/devices/address/confirm';
  const MOVED_INSIDE = 'urn:uuid:0a9e3170-0000-4000-8000-000000000011';
  const MOVED_OUTSIDE = 'urn:uuid:0a9e3170-0000-4000-8000-000000000012';
  /** A password of the operators' own for this production clone (D241): built at run time, kept nowhere. */
  const OWN_PASSWORD = ['own', 'i9a', String(process.pid), 'q7Lm'].join('-');
  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const answer = (host: string, endpointRef: string): OnvifCandidate => ({
    adapterKind: CaptureAdapterKind.ONVIF_RTSP,
    host,
    serviceAddress: `http://${host}/onvif/device_service`,
    endpointRef,
    vendor: 'I9A-VENDOR',
    model: 'I9A-MODEL',
    name: 'I9A-NAME',
    testable: true,
    conflict: false,
    reason: null,
    registered: true,
    addressChanged: true,
    types: [],
    profileHints: [],
    locationHints: [],
    macHint: null,
    serialHint: null,
  });
  const found = (candidates: OnvifCandidate[]): WsDiscoveryResult => ({
    candidates,
    responderCount: candidates.length,
    interfaceCount: 1,
    truncated: false,
    counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
  });

  it('(2) operation 100 and (3) the typed address of operation 93, as the routes answer on a booted production Core: a confirmation inside the camera subnet is accepted and written, one outside is refused 422 and nothing is written; a typed address inside reaches the search with the rule\'s answer, one outside starts nothing', async () => {
    const target = await db.another({ template: 'seed', slug: 'i9a_routes' });
    const owner = target.ownerPool();
    // No speech runtime on a test host; the seeded selector assigns development sources, which a production Core refuses to start on: all four unassigned.
    await owner.query('UPDATE public.stt_config SET enabled = false');
    await owner.query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, video_03_device_id = NULL, video_03_profile = NULL, video_04_device_id = NULL, video_04_profile = NULL, mic_01_id = NULL, mic_02_id = NULL, mic_03_id = NULL, mic_04_id = NULL');
    // Two adopted cameras at their stored addresses, each with its endpoint reference; the stored network choice.
    await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind, address, onvif_uuid) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP', '192.168.50.20', $1), ('CAM-12', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP', '192.168.50.21', $2)", [MOVED_INSIDE, MOVED_OUTSIDE]);
    await owner.query(STORE_CHOICE);
    const record = await hashPassword(OWN_PASSWORD);
    await owner.query('UPDATE public.operator_credentials SET algorithm = $1, memory_kib = $2, passes = $3, parallelism = $4, salt = $5, hash = $6', [record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);

    const host = await engineApp(target, fixture.dataDir, {
      startAt: FIXED_NOW + 60_000,
      logLevel: 'info',
      config: { captureMode: 'real', demoControls: false, dataDir: fixture.dataDir, installationDeviceId: fixture.installationId, captureWorkerPath: fixture.worker('capture-worker-i9a', 'capture-worker/0.4.0'), ...testHostPrograms(fixture.programsDir) },
    });
    const { app } = host;
    captureNetworkConfigControl(app).replaceForTest({ interfaces: () => INTERFACES });
    // The script in the place of the product's adapter: it answers at once and keeps what each search carried.
    const searches: unknown[] = [];
    let listed: OnvifCandidate[] = [];
    captureDiscoveryControl(app).provideAdapter(
      () =>
        ({
          discover: async (search: { readonly unicast?: unknown }) => {
            searches.push(search.unicast ?? null);
            return found(listed);
          },
        }) as unknown as OnvifDiscoveryAdapter,
    );
    // THE ENTRY POINT'S ORDER: the composition with the module's reader, the host facts, then the boot steps.
    const composition = composeProductionCaptureOf(app, { platform: 'darwin', network: captureNetworkFacts(app) });
    expect(composition.composed).toBe(true);
    // Bench-port seam 2026-11-04 (row N13, as in `fence.db.test.ts`): the faked darwin host carries the two microphone-listing stand-ins.
    captureBootControl(app).provideHost({ ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(fixture.dataDir) });
    try {
      await app.readiness.boot();
    } catch (error) {
      throw new Error(`the production boot of this case was refused at step ${error instanceof BootError ? error.stepId : 'unknown'}`, { cause: error });
    }
    await host.engine.idle();
    expect(captureFenceControl(app).operation).toBe('REAL_PRODUCTION');
    // The boot step loaded the stored choice: the reader answers now.
    expect(captureNetworkFacts(app)()).toMatchObject({ cameraSubnet: { network: '192.168.50.0', prefixLength: 24 } });

    const signedIn = await webSignIn(app, 'rina.wijaya', OWN_PASSWORD);
    expect(signedIn.statusCode, 'the sign-in of the technician').toBe(200);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
    const post = (url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> => app.inject({ method: 'POST', url, headers, ...(payload === undefined ? {} : { payload }) });
    const settled = async (): Promise<void> => {
      for (let turn = 0; turn < 20; turn += 1) {
        await delay(10);
        await app.pipeline.drain();
      }
    };
    const errorOf = (response: LightMyRequestResponse): [number, unknown, unknown] => {
      const body = response.json<{ error?: { code?: string; details?: { reason?: string } } }>();
      return [response.statusCode, body.error?.code ?? null, body.error?.details?.reason ?? null];
    };
    const addressOf = async (deviceId: string): Promise<unknown> => (await owner.query('SELECT address FROM public.capture_devices WHERE id = $1', [deviceId])).rows[0]?.address;
    const changes = async (): Promise<number> => (await readTrail(owner)).filter((row) => row.type === 'CAPTURE_DEVICE_ADDRESS_CHANGED').length;

    // A SEARCH that finds both registered cameras at a changed address: one inside the camera subnet, one outside it.
    listed = [answer(INSIDE, MOVED_INSIDE), answer(OUTSIDE, MOVED_OUTSIDE)];
    host.clock.advance(130_000);
    const started = await post(DISCOVERY);
    expect(started.statusCode, started.body).toBe(202);
    await settled();
    const state = (await app.inject({ method: 'GET', url: DISCOVERY, headers: { cookie: headers.cookie } })).json<{ candidates: { candidateId: string; deviceId: string | null; status: string; addressChanged?: boolean; host: string }[] }>();
    expect(state.candidates.map((candidate) => [candidate.status, candidate.deviceId, candidate.addressChanged, candidate.host])).toEqual([
      ['REGISTERED', 'CAM-11', true, INSIDE],
      ['REGISTERED', 'CAM-12', true, OUTSIDE],
    ]);
    const candidateOf = (deviceId: string): string => state.candidates.find((candidate) => candidate.deviceId === deviceId)?.candidateId ?? '';

    // (2) OUTSIDE THE SUBNET: refused by the product's rule on the module's reader; nothing is written.
    host.clock.advance(30_000);
    const refused = await post(CONFIRM, { deviceId: 'CAM-12', candidateId: candidateOf('CAM-12'), address: OUTSIDE });
    expect(errorOf(refused), refused.body).toEqual([422, 'INVALID_INPUT', 'DISCOVERY_ADDRESS_NOT_ALLOWED']);
    await settled();
    expect([await addressOf('CAM-12'), await changes()]).toEqual(['192.168.50.21', 0]);
    // (2) INSIDE THE SUBNET: accepted - the row holds the new address and ONE entry of the type exists.
    host.clock.advance(30_000);
    const accepted = await post(CONFIRM, { deviceId: 'CAM-11', candidateId: candidateOf('CAM-11'), address: INSIDE });
    expect(accepted.statusCode, accepted.body).toBe(200);
    await settled();
    expect([await addressOf('CAM-11'), await addressOf('CAM-12'), await changes()]).toEqual([INSIDE, '192.168.50.21', 1]);

    // (3) A TYPED ADDRESS OUTSIDE THE SUBNET: 422, and no search was started for it.
    listed = [];
    const before = searches.length;
    host.clock.advance(130_000);
    const typedOutside = await post(DISCOVERY, { address: '192.168.60.77' });
    expect(errorOf(typedOutside), typedOutside.body).toEqual([422, 'INVALID_INPUT', 'DISCOVERY_ADDRESS_NOT_ALLOWED']);
    await settled();
    expect(searches.length).toBe(before);
    // (3) A TYPED ADDRESS INSIDE IT: the search starts and carries THE RULE'S OWN ANSWER (the source is the camera port's address).
    host.clock.advance(130_000);
    const typedInside = await post(DISCOVERY, { address: '192.168.50.77' });
    expect(typedInside.statusCode, typedInside.body).toBe(202);
    await settled();
    expect(searches.slice(before)).toEqual([{ address: '192.168.50.77', port: 80, sourceAddress: '192.168.50.1', viaAlias: false }]);
  }, 180_000);
});

// TASK 4 ROW 106b (decisions C74, C78; request lines `row 106` and `row 107`): THE ALIAS THROUGH THE REAL COMPOSITION, on a
// BOOTED production Core - the lifecycle with its three fact sources, its boot sweep and its shutdown removal, the routes
// of operations 104 / 105, and operation 103 live with the parts the composition handed in.
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the helper       A DOUBLE: a transport of this file (`aliasTransport` of the composition's input) that answers from a
//                    script and keeps every line. No socket, no process, no `ip` or other network command; no address of
//                    any host is read or changed. The real client refuses any socket root did not make.
//   the host         a table of interfaces of this file; the double puts an address on its camera port when it answers
//                    "done" to an `add`, and takes it off again for a `del`.
//   the interface    `aliasInterfaceFile` answers the name the row holds (the product's own reader of the file is a
//   file             request line of this row: without it every `add` is refused).
//   the probe        of this file, in the place of the composition's (the unauthenticated ONVIF clock read): NOTHING is
//                    dialled. The rule and the alias port stay the composition's own.
describe('row 106b: the alias of the camera port through the real composition, on a booted production Core', () => {
  // Task 4 row 228b: this block's own synthetic installation (not a reserved id), as above.
  const fixture = realBootFixture('r106b', 'DEMS-TEST-R106B');
  fixture.provisionKey();
  afterAll(() => fixture.remove());
  const TECHNICIAN = OPERATORS.find((operator) => operator.role === 'TECHNICIAN')!;
  const SCAN = '/api/v1/capture/network/scan';
  const ALIAS = '/api/v1/capture/network/alias';
  const REMOVE = '/api/v1/capture/network/alias/remove';
  const STORE_CHOICE = "INSERT INTO public.capture_network_config (interface_name, camera_subnet, updated_at) VALUES ('eth1', '192.168.50.0/24', 1760000000000)";
  /** What a Core that died between the intent and the result of an `add` leaves: an OPEN row. */
  const LEFT_OPEN = "INSERT INTO public.host_network_aliases (interface_name, address, reason, added_at, added_by, expires_at) VALUES ('eth1', '192.168.9.253/24', 'FACTORY_SCAN', 1760000000000, $1, 1760001800000)";
  const OWN_PASSWORD = ['own', 'r106b', String(process.pid), 'k4Tz'].join('-');
  type Scripted = HelperCodeName | 'TIMED_OUT' | 'CONNECTION_LOST';

  async function production(slug: string, input: (owner: Pool, world: { readonly transport: HostAliasTransport }) => Omit<ProductionCaptureInput, 'network'>) {
    const target = await db.another({ template: 'seed', slug });
    const owner = target.ownerPool();
    await owner.query('UPDATE public.stt_config SET enabled = false');
    await owner.query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, video_03_device_id = NULL, video_03_profile = NULL, video_04_device_id = NULL, video_04_profile = NULL, mic_01_id = NULL, mic_02_id = NULL, mic_03_id = NULL, mic_04_id = NULL');
    await owner.query(STORE_CHOICE);
    await owner.query(LEFT_OPEN, [TECHNICIAN.id]);
    const record = await hashPassword(OWN_PASSWORD);
    await owner.query('UPDATE public.operator_credentials SET algorithm = $1, memory_kib = $2, passes = $3, parallelism = $4, salt = $5, hash = $6', [record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);
    const host = await engineApp(target, fixture.dataDir, {
      startAt: FIXED_NOW + 60_000,
      logLevel: 'info',
      config: { captureMode: 'real', demoControls: false, dataDir: fixture.dataDir, installationDeviceId: fixture.installationId, captureWorkerPath: fixture.worker(`capture-worker-${slug}`, 'capture-worker/0.4.0'), ...testHostPrograms(fixture.programsDir) },
    });
    const { app } = host;

    // THE HELPER DOUBLE. It marks what it added; a `del` of anything else is the helper's own "not marked".
    const marked = new Set<string>(['192.168.9.253']);
    const queued: Record<'add' | 'del', Scripted[]> = { add: [], del: [] };
    const seen: { line: string; intents: number }[] = [];
    const transport: HostAliasTransport = {
      preflight: async () => null,
      exchange: async (line): Promise<HostAliasExchange> => {
        const [verb, cidr] = line.trim().split(' ') as ['add' | 'del', string];
        const address = cidr.replace('/24', '');
        // What the trail holds AT THE MOMENT THE LINE ARRIVES: the intent of this very action, already committed.
        const intents = (await readTrail(owner)).filter((row) => row.type === 'HOST_ALIAS_REQUESTED' && row.details['address'] === address && row.details['action'] === (verb === 'add' ? 'ADD' : 'REMOVE')).length;
        seen.push({ line: line.trim(), intents });
        const answer: Scripted = queued[verb].shift() ?? (verb === 'add' || marked.has(address) ? 'OK' : 'NOT_MARKED');
        if (answer === 'TIMED_OUT' || answer === 'CONNECTION_LOST') return { kind: 'FAILED', failure: answer };
        if (answer === 'OK' && verb === 'add') marked.add(address);
        if (answer === 'OK' && verb === 'del') marked.delete(address);
        return { kind: 'ANSWER', text: `${String(HELPER_CODES[answer])} ${answer}\n` };
      },
    };
    // THE HOST: the camera port holds its own address and whatever the double marked in a factory /24 of this file.
    // R-FLEX row 136: a non-zero `mac` on every non-loopback address - row 105 makes an address without one ineligible as a source (RG-13).
    const SCANNED = ['192.168.1.253', '192.168.0.253'];
    captureNetworkConfigControl(app).replaceForTest({
      interfaces: () => [
        { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
        { name: 'eth0', internal: false, addresses: [{ address: '10.20.0.15', prefixLength: 16, mac: '02:00:00:00:00:e0' }] },
        { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24, mac: '02:00:00:00:00:e1' }, ...SCANNED.filter((address) => marked.has(address)).map((address) => ({ address, prefixLength: 24, mac: '02:00:00:00:00:e1' }))] },
      ],
    });

    // THE ENTRY POINT'S ORDER: the composition with the module's reader, the host facts, then the boot steps.
    const composition = composeProductionCaptureOf(app, { ...input(owner, { transport }), network: captureNetworkFacts(app) });
    expect(composition.composed).toBe(true);
    // Bench-port seam 2026-11-04 (row N13, as in `fence.db.test.ts`): the faked darwin host carries the two microphone-listing stand-ins.
    captureBootControl(app).provideHost({ ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(fixture.dataDir) });
    // Nothing was asked of the helper at composition, and nothing was read of the alias table.
    expect(seen).toEqual([]);
    try {
      await app.readiness.boot();
    } catch (error) {
      throw new Error(`the production boot of this case was refused at step ${error instanceof BootError ? error.stepId : 'unknown'}`, { cause: error });
    }
    await host.engine.idle();
    expect(captureFenceControl(app).operation).toBe('REAL_PRODUCTION');

    const signedIn = await webSignIn(app, TECHNICIAN.username, OWN_PASSWORD);
    expect(signedIn.statusCode, 'the sign-in of the technician').toBe(200);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
    const call = async (method: 'GET' | 'POST', url: string, payload?: object): Promise<LightMyRequestResponse> => {
      throttleControl(app).reset();
      const response = await app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });
      await app.pipeline.drain();
      return response;
    };
    const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown, unknown] => {
      const error = response.json<{ error?: { code?: string; details?: { reason?: string; cause?: string } } }>().error;
      return [response.statusCode, error?.code ?? null, error?.details?.reason ?? null, error?.details?.cause ?? null];
    };
    const typesOf = (rows: readonly AuditRow[]): string[] => rows.map((row) => `${row.type}${row.details['action'] === undefined ? '' : `:${String(row.details['action'])}`}`);
    const since = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);
    const rows = async (): Promise<Record<string, unknown>[]> =>
      (await owner.query('SELECT address, reason, removed_at IS NULL AS open, remove_reason, removed_by, remove_error FROM public.host_network_aliases ORDER BY added_at, id')).rows as Record<string, unknown>[];
    return { host, app, owner, seen, queued, marked, call, reasonOf, typesOf, since, rows };
  }

  it('the lifecycle is mounted and handed on: the boot sweep closes a row a dead Core left; operation 103 is LIVE and writes the alias rows (the intent BEFORE each call); C78 DD-2 through the scan; `alias` of the answer and operations 104 / 105 from the lifecycle\'s state; the removal at the close of the app', async () => {
    const { host, app, owner, seen, queued, call, reasonOf, typesOf, since, rows } = await production('r106b_live', (_owner, world) => ({ platform: 'darwin', aliasTransport: world.transport, aliasInterfaceFile: () => 'eth1' }));

    // ── THE MOUNT: one lifecycle per app, at its two doors; the scan has its parts.
    const mounted = productionHostAlias(app);
    if (mounted === null) throw new Error('expected a mounted alias lifecycle');
    expect([captureHostAliasControl(app).provided(), captureFactoryScanControl(app).provided()]).toEqual([true, true]);

    // ── THE BOOT SWEEP (step `capture.hostAlias`, after `capture.config` loaded the choice): the open row, then what the
    // stored factory list can produce. Each line found its intent committed. The row is closed with BOOT_SWEEP.
    expect(seen.map((entry) => entry.line)).toEqual(['del 192.168.9.253/24', 'del 192.168.1.253/24', 'del 192.168.0.253/24']);
    expect(seen.every((entry) => entry.intents >= 1)).toBe(true);
    expect(await rows()).toEqual([{ address: '192.168.9.253/24', reason: 'FACTORY_SCAN', open: false, remove_reason: 'BOOT_SWEEP', removed_by: null, remove_error: null }]);
    const swept = (await readTrail(owner)).filter((row) => typeof row.details['aliasId'] === 'string');
    expect(swept.map((row) => [row.type, row.actorId, row.details['removeReason'], row.details['address']])).toEqual([
      ['HOST_ALIAS_REQUESTED', null, 'BOOT_SWEEP', '192.168.9.253'],
      ['HOST_ALIAS_REMOVED', null, 'BOOT_SWEEP', '192.168.9.253'],
    ]);
    // Said once, in counts: never an address.
    const sweepLines = host.log.lines().filter((line) => line['code'] === 'HOST_ALIAS_BOOT_SWEEP');
    expect(sweepLines).toHaveLength(1);
    expect(sweepLines[0]).toMatchObject({ stateRead: true, interfaceTableRead: true, asked: 3, attempted: 3, stillOpen: false });
    expect(JSON.stringify(sweepLines[0])).not.toMatch(/192\.168\./);

    // ── OPERATION 104: a plain read. None in place.
    expect((await call('GET', ALIAS)).json()).toEqual({ alias: null });

    // ── OPERATION 103, LIVE: the parts are the composition's; only the probe is this file's (nothing is dialled).
    const probed: string[] = [];
    captureFactoryScanControl(app).replaceForTest({
      gate: createFactoryScanGate(0),
      parts: {
        rule: factoryScanRuleOf(),
        alias: mounted.jobs,
        probe: async (destination) => {
          probed.push(`${destination.address} from ${String(destination.sourceAddress)}`);
          return destination.address === '192.168.1.108' ? { answered: true, onvifReachable: true } : { answered: false, onvifReachable: false };
        },
      },
    });
    let from = (await readTrail(owner)).length;
    let lines = seen.length;
    const scanned = await call('POST', SCAN);
    expect(scanned.statusCode, scanned.body).toBe(200);
    const answer = scanned.json<{ addressCount: number; alias: unknown; devices: { address: string }[] }>();
    expect(validateCoreApiResponse('scanFactoryCameras', 200, answer)).toMatchObject({ ok: true });
    // `alias` IS THE LIFECYCLE'S STATE (C78 DD-3): the scan asked both addresses away again, and the lifecycle says none is in place.
    expect([answer.addressCount, answer.alias, answer.devices.map((device) => device.address)]).toEqual([4, null, ['192.168.1.108']]);
    expect(probed).toEqual(['192.168.1.64 from 192.168.1.253', '192.168.1.108 from 192.168.1.253', '192.168.1.13 from 192.168.1.253', '192.168.0.90 from 192.168.0.253']);
    expect(seen.slice(lines).map((entry) => entry.line)).toEqual(['add 192.168.1.253/24 30', 'del 192.168.1.253/24', 'add 192.168.0.253/24 30', 'del 192.168.0.253/24']);
    // THE ALIAS AUDIT ROWS OF A SCAN: `HOST_ALIAS_REQUESTED` BEFORE each call (each line found its intent in the trail), then the result; ONE entry of the scan last.
    expect(seen.slice(lines).every((entry) => entry.intents >= 1)).toBe(true);
    let written = await since(from);
    expect(typesOf(written)).toEqual([
      'HOST_ALIAS_REQUESTED:ADD',
      'HOST_ALIAS_ADDED',
      'HOST_ALIAS_REQUESTED:REMOVE',
      'HOST_ALIAS_REMOVED',
      'HOST_ALIAS_REQUESTED:ADD',
      'HOST_ALIAS_ADDED',
      'HOST_ALIAS_REQUESTED:REMOVE',
      'HOST_ALIAS_REMOVED',
      'CAMERA_FACTORY_SCANNED',
    ]);
    expect(written.slice(0, 4).map((row) => [row.actorId, row.details['address'], row.details['operationId'], row.details['permission']])).toEqual(Array.from({ length: 4 }, () => [TECHNICIAN.id, '192.168.1.253', 'scanFactoryCameras', 'CAPTURE_COMMISSION']));
    expect([written[0]?.details['reason'], written[0]?.details['minutes'], written[3]?.details['removeReason']]).toEqual(['FACTORY_SCAN', 30, 'JOB_DONE']);
    // (The clock of this Core stands still: the rows of one instant are told apart by their address, not by their order.)
    expect((await rows()).filter((row) => row['remove_reason'] === 'JOB_DONE').sort((left, right) => String(left['address']).localeCompare(String(right['address'])))).toEqual([
      { address: '192.168.0.253/24', reason: 'FACTORY_SCAN', open: false, remove_reason: 'JOB_DONE', removed_by: TECHNICIAN.id, remove_error: null },
      { address: '192.168.1.253/24', reason: 'FACTORY_SCAN', open: false, remove_reason: 'JOB_DONE', removed_by: TECHNICIAN.id, remove_error: null },
    ]);

    // ── C78 DD-2 (a): THE HELPER DEFINITELY REFUSED THE ADD - NO removal is asked.
    from = (await readTrail(owner)).length;
    lines = seen.length;
    queued.add.push('ADDRESS_IN_USE');
    expect(reasonOf(await call('POST', SCAN))).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', 'HELPER_ADDRESS_IN_USE']);
    expect(seen.slice(lines).map((entry) => entry.line)).toEqual(['add 192.168.1.253/24 30']);
    expect(typesOf(await since(from))).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'CAMERA_FACTORY_SCANNED']);

    // ── C78 DD-2 (b): A BOUND EXCEEDED (effect UNKNOWN) - a removal IS asked, once, and its result is recorded.
    from = (await readTrail(owner)).length;
    lines = seen.length;
    queued.add.push('TIMED_OUT');
    expect(reasonOf(await call('POST', SCAN))).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', 'HELPER_TIMED_OUT']);
    expect(seen.slice(lines).map((entry) => entry.line)).toEqual(['add 192.168.1.253/24 30', 'del 192.168.1.253/24']);
    written = await since(from);
    // Row HA (caution R119c-01): the double never marked this address (its add timed out), so its `del` is answered
    // NOT_MARKED - the helper removed nothing. The result is HOST_ALIAS_REMOVE_FAILED { HELPER_NOT_MARKED }, no longer
    // HOST_ALIAS_REMOVED; the row is closed all the same (the line after the next).
    expect(typesOf(written)).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED', 'CAMERA_FACTORY_SCANNED']);
    expect([written[3]?.details['removeReason'], written[3]?.details['failureReason']]).toEqual(['ADD_UNCONFIRMED', 'HELPER_NOT_MARKED']);
    expect([written[1]?.details['failureReason'], written[4]?.details['outcome'], written[4]?.details['failureReason']]).toEqual(['HELPER_TIMED_OUT', 'FAILED', 'HOST_ALIAS_FAILED']);
    expect((await rows()).filter((row) => row['open'] === true)).toEqual([]);

    // ── `alias` OF THE ANSWER when a removal was NOT confirmed (the last /24): the lifecycle's state names the address
    // that is still on the camera port, with the code of the removal that failed. Operation 104 says the same.
    queued.del.push('OK', 'CONNECTION_LOST');
    const left = await call('POST', SCAN);
    expect(left.statusCode, left.body).toBe(200);
    const leftAlias = left.json<{ alias: Record<string, unknown> | null }>().alias;
    expect(validateCoreApiResponse('scanFactoryCameras', 200, left.json())).toMatchObject({ ok: true });
    expect(leftAlias).toMatchObject({ address: '192.168.0.253', reason: 'FACTORY_SCAN', removeError: 'HELPER_CONNECTION_LOST' });
    const state = await call('GET', ALIAS);
    expect(validateCoreApiResponse('getHostAlias', 200, state.json())).toMatchObject({ ok: true });
    expect(state.json()).toEqual({ alias: leftAlias });

    // ── OPERATION 105: the technician's removal. The Core names the address from its own state; one intent, one result.
    from = (await readTrail(owner)).length;
    lines = seen.length;
    const removed = await call('POST', REMOVE);
    expect(removed.statusCode, removed.body).toBe(200);
    expect(removed.json()).toEqual({ alias: null });
    expect(validateCoreApiResponse('removeHostAlias', 200, removed.json())).toMatchObject({ ok: true });
    expect(seen.slice(lines)).toEqual([{ line: 'del 192.168.0.253/24', intents: expect.any(Number) }]);
    written = await since(from);
    expect(written.map((row) => [row.type, row.actorId, row.details['removeReason'], row.details['operationId'], row.details['permission']])).toEqual([
      ['HOST_ALIAS_REQUESTED', TECHNICIAN.id, 'MANUAL', 'removeHostAlias', 'CAPTURE_COMMISSION'],
      ['HOST_ALIAS_REMOVED', TECHNICIAN.id, 'MANUAL', 'removeHostAlias', 'CAPTURE_COMMISSION'],
    ]);
    expect((await rows()).filter((row) => row['remove_reason'] === 'MANUAL')).toEqual([{ address: '192.168.0.253/24', reason: 'FACTORY_SCAN', open: false, remove_reason: 'MANUAL', removed_by: TECHNICIAN.id, remove_error: null }]);
    // None in place any more: refused by name, nothing asked, nothing written.
    from = (await readTrail(owner)).length;
    lines = seen.length;
    expect(reasonOf(await call('POST', REMOVE))).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_NOT_PRESENT', null]);
    expect([seen.length - lines, (await since(from)).length]).toEqual([0, 0]);
    expect((await call('GET', ALIAS)).json()).toEqual({ alias: null });

    // ── THE CLOSE OF THE APP: an alias in place is asked away by the shutdown hook - AFTER the engine stopped, in a unit of
    // the pipeline - with its intent and its result, by no operator.
    const acquired = await mounted.lifecycle.acquire({ address: '192.168.1.253', minutes: 30, reason: 'SET_CAMERA_ADDRESS', actor: { operatorId: TECHNICIAN.id, deviceId: null, operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' } });
    expect(acquired).toMatchObject({ ok: true });
    from = (await readTrail(owner)).length;
    lines = seen.length;
    await app.close();
    expect(seen.slice(lines).map((entry) => entry.line)).toEqual(['del 192.168.1.253/24']);
    expect(seen.at(-1)?.intents).toBeGreaterThanOrEqual(1);
    written = (await since(from)).filter((row) => row.type.startsWith('HOST_ALIAS_'));
    expect(written.map((row) => [row.type, row.actorId, row.details['removeReason'], row.details['address']])).toEqual([
      ['HOST_ALIAS_REQUESTED', null, 'SHUTDOWN', '192.168.1.253'],
      ['HOST_ALIAS_REMOVED', null, 'SHUTDOWN', '192.168.1.253'],
    ]);
    expect((await rows()).filter((row) => row['open'] === true)).toEqual([]);
    // After the shutdown nothing is added any more.
    await expect(mounted.lifecycle.acquire({ address: '192.168.1.253', minutes: 30, reason: 'FACTORY_SCAN', actor: { operatorId: TECHNICIAN.id, deviceId: null, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } })).resolves.toEqual({ ok: false, refusal: 'SHUTTING_DOWN', stillInPlace: false });
  }, 240_000);

  it('this platform (the product\'s own seam, no double): the boot sweep asks nothing and says so ONCE; the scan and a removal answer the named "not available"; the state is still read; no entry is written', async () => {
    const { host, app, owner, seen, call, reasonOf, since, rows } = await production('r106b_darwin', () => ({ platform: 'darwin' }));
    expect(productionHostAlias(app)).not.toBeNull();
    expect(seen).toEqual([]);
    const said = host.log.lines().filter((line) => typeof line['code'] === 'string' && String(line['code']).startsWith('HOST_ALIAS_BOOT_SWEEP'));
    expect(said.map((line) => [line['code'], line['asked']])).toEqual([['HOST_ALIAS_BOOT_SWEEP_NOT_ON_THIS_PLATFORM', 0]]);
    // The row a dead Core left is still open: nothing on this platform can take it away, and nothing claims it did.
    expect(await rows()).toEqual([{ address: '192.168.9.253/24', reason: 'FACTORY_SCAN', open: true, remove_reason: null, removed_by: null, remove_error: null }]);
    const from = (await readTrail(owner)).length;
    expect((await call('GET', ALIAS)).json()).toMatchObject({ alias: { address: '192.168.9.253', reason: 'FACTORY_SCAN', removeError: null } });
    expect(reasonOf(await call('POST', SCAN))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]);
    expect(reasonOf(await call('POST', REMOVE))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]);
    expect((await since(from)).filter((row) => row.type.startsWith('HOST_ALIAS_') || row.type === 'CAMERA_FACTORY_SCANNED')).toEqual([]);
    expect((await rows())[0]).toMatchObject({ open: true });
  }, 180_000);

  // TASK 4 ROW 106c (decision C82, named amendment SR-11): THE THIRD FACT SOURCE THROUGH THE REAL COMPOSITION. The runner
  // the entry point hands in is a DOUBLE of this case (it records the question and answers from a variable): no program
  // is started, no file is read. The helper is the double of this block. The platform is STATED to the composition (as
  // the entry states `process.platform`); the card listing is a stand-in so that nothing of a Linux host is touched.
  it('row 106c: on a booted production Core the interface file is asked through the handed-in runner with the FIXED row, at an add only; every answer but the one stored name refuses the add before the helper; off linux nothing is run and every add is refused', async () => {
    const FIXED = { program: '/usr/bin/cat', args: ['/etc/dems/netalias-interface'] };
    const actor = { operatorId: TECHNICIAN.id, deviceId: null, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } as const;
    const runnerOf = () => {
      const asked: unknown[] = [];
      const state: { answer: unknown } = { answer: { outcome: 'NOT_STARTED' } };
      const hostRunner: NonNullable<ProductionCaptureInput['hostRunner']> = async (command) => {
        asked.push(command);
        return state.answer as never;
      };
      return { asked, state, hostRunner };
    };

    // ── LINUX, as stated by the entry.
    const linux = runnerOf();
    const { app, owner, seen, since, rows } = await production('r106c_linux', (_owner, world) => ({ platform: 'linux', aliasTransport: world.transport, hostRunner: linux.hostRunner, cardPrograms: { captureDevices: async () => '' } }));
    const mounted = productionHostAlias(app);
    if (mounted === null) throw new Error('expected a mounted alias lifecycle');
    // The composition and the boot sweep (three removals) never asked the file: a removal does not need it.
    expect(seen.map((entry) => entry.line.split(' ')[0])).toEqual(['del', 'del', 'del']);
    expect(linux.asked).toEqual([]);
    const lines = seen.length;
    const from = (await readTrail(owner)).length;
    const add = () => mounted.lifecycle.acquire({ address: '192.168.1.253', minutes: 30, reason: 'FACTORY_SCAN', actor });
    const REFUSED: readonly [unknown, string][] = [
      [{ outcome: 'NOT_STARTED' }, 'INTERFACE_FILE_UNREADABLE'],
      [{ outcome: 'TIMED_OUT' }, 'INTERFACE_FILE_UNREADABLE'],
      [{ outcome: 'RAN', exitCode: 1, output: '' }, 'INTERFACE_FILE_UNREADABLE'],
      [{ outcome: 'RAN', exitCode: 0, output: '' }, 'INTERFACE_FILE_UNREADABLE'],
      [{ outcome: 'RAN', exitCode: 0, output: 'eth1\neth0\n' }, 'INTERFACE_FILE_UNREADABLE'],
      [{ outcome: 'RAN', exitCode: 0, output: 'eth1;id\n' }, 'INTERFACE_FILE_UNREADABLE'],
      // A well-formed name that is not the stored camera interface (here: one the host's table does not hold).
      [{ outcome: 'RAN', exitCode: 0, output: 'eth9\n' }, 'INTERFACE_FILE_DIFFERS_FROM_ROW'],
      // A real interface of the host's table that is not the camera interface.
      [{ outcome: 'RAN', exitCode: 0, output: 'eth0\n' }, 'INTERFACE_FILE_DIFFERS_FROM_ROW'],
    ];
    for (const [answer, refusal] of REFUSED) {
      linux.state.answer = answer;
      await expect(add(), JSON.stringify(answer)).resolves.toEqual({ ok: false, refusal, stillInPlace: false });
    }
    // Asked once per add, with the SAME fixed row; the helper was never asked, no entry and no row was written.
    expect(linux.asked).toEqual(REFUSED.map(() => FIXED));
    expect(seen.slice(lines)).toEqual([]);
    expect((await since(from)).filter((row) => row.type.startsWith('HOST_ALIAS_'))).toEqual([]);
    expect((await rows()).filter((row) => row['open'] === true)).toEqual([]);
    // THE ONE ANSWER THAT LETS AN ADD THROUGH: the one name the stored row holds.
    linux.state.answer = { outcome: 'RAN', exitCode: 0, output: 'eth1\n' };
    await expect(add()).resolves.toMatchObject({ ok: true, alias: { address: '192.168.1.253' } });
    expect(seen.slice(lines).map((entry) => entry.line)).toEqual(['add 192.168.1.253/24 30']);
    expect(linux.asked).toHaveLength(REFUSED.length + 1);
    // Its removal asks the helper and NOT the file.
    await expect(mounted.lifecycle.release({ removeReason: 'JOB_DONE', actor })).resolves.toMatchObject({ ok: true });
    expect(seen.slice(lines).map((entry) => entry.line)).toEqual(['add 192.168.1.253/24 30', 'del 192.168.1.253/24']);
    expect(linux.asked).toHaveLength(REFUSED.length + 1);

    // ── THIS PLATFORM, with a runner that WOULD answer the right name and a helper double that WOULD add: nothing is run.
    const darwin = runnerOf();
    darwin.state.answer = { outcome: 'RAN', exitCode: 0, output: 'eth1\n' };
    const other = await production('r106c_darwin', (_owner, world) => ({ platform: 'darwin', aliasTransport: world.transport, hostRunner: darwin.hostRunner }));
    const there = productionHostAlias(other.app);
    if (there === null) throw new Error('expected a mounted alias lifecycle');
    const before = other.seen.length;
    await expect(there.lifecycle.acquire({ address: '192.168.1.253', minutes: 30, reason: 'FACTORY_SCAN', actor })).resolves.toEqual({ ok: false, refusal: 'INTERFACE_FILE_UNREADABLE', stillInPlace: false });
    expect(darwin.asked).toEqual([]);
    expect(other.seen.slice(before)).toEqual([]);
  }, 300_000);

  // ── Task 4 row 111b (decisions C78, C87): THE HOST'S OWN OBSERVATIONS through the real composition ──────────────────
  //
  // WHAT IS A STAND-IN, AND WHY: the two programs are shell scripts of this case in a temporary directory, started by the
  // REAL production door (only the core-file limit of this test process is answered as 0) through the PRODUCT'S function
  // `hostCommissioningInputsOf`, handed in at the composition's seam `commissioningInputs`. No `ip`, `ping` or `arping`
  // runs; nothing is sent to any address: the scan's probe is this case's (`replaceForTest({ probe })` keeps every other
  // part the composition handed in), and no job is ever started (the one request is refused before anything is dialled).
  it('row 111b: on `linux` the composition hands the observations to the scan (`mac`: the neighbour table, asked from the alias address) and to the set-IP job (its door is open: the refusal is no longer COMMISSIONING_NOT_AVAILABLE); on this platform nothing is handed in and nothing is started', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'dems-row111b-db-'));
    try {
      const standIn = (name: string, body: string): string => {
        const program = join(folder, name);
        writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$0.args"\n${body}\n`, { mode: 0o700 });
        chmodSync(program, 0o700);
        return program;
      };
      const startedWith = (program: string): string[] => (existsSync(`${program}.args`) ? readFileSync(`${program}.args`, 'utf8').trim().split('\n') : []);
      const neighbourProgram = standIn('neighbour', `printf '%s dev eth1 lladdr aa:bb:cc:00:11:22 REACHABLE\\n' "$5"`);
      const echoProgram = standIn('echo', 'exit 1');
      const SET = '/api/v1/capture/network/cameras/address';
      const typed = { username: ['cnryU', 'r111b', String(process.pid)].join(''), secret: ['cnryS', 'r111b', String(process.pid)].join('') };
      const timers = createSystemTimers();
      const world: { facts: (() => DestinationContext | null) | null } = { facts: null };
      const observed = hostCommissioningInputsOf({
        platform: 'linux',
        timers,
        network: () => world.facts?.() ?? null,
        cameraInterface: () => 'eth1',
        door: (options) => productionCameraDoors(timers).door({ ...options, coreFileLimit: () => 0 }),
        neighbourProgram,
        echoProgram,
      });
      if (observed === null) throw new Error('expected the observations of a linux host');

      // ── LINUX: the seam holds the product's function over the stand-ins.
      const linux = await production('r111b_linux', (_owner, made) => ({ platform: 'linux', aliasTransport: made.transport, aliasInterfaceFile: () => 'eth1', cardPrograms: { captureDevices: async () => '' }, commissioningInputs: observed }));
      world.facts = captureNetworkFacts(linux.app);
      // Composition and boot started neither program.
      expect([startedWith(neighbourProgram), startedWith(echoProgram)]).toEqual([[], []]);
      const probed: string[] = [];
      captureFactoryScanControl(linux.app).replaceForTest({
        gate: createFactoryScanGate(0),
        probe: async (destination) => {
          probed.push(`${destination.address} from ${String(destination.sourceAddress)}`);
          return destination.address === '192.168.1.108' ? { answered: true, onvifReachable: true } : { answered: false, onvifReachable: false };
        },
      });
      const mark = linux.host.log.lines().length;
      const from = (await readTrail(linux.owner)).length;
      const scanned = await linux.call('POST', SCAN);
      expect(scanned.statusCode, scanned.body).toBe(200);
      const answer = scanned.json<{ devices: { address: string; mac: string | null; deviceCount: string; endpointCount: number | null }[] }>();
      expect(validateCoreApiResponse('scanFactoryCameras', 200, answer)).toMatchObject({ ok: true });
      // THE HARDWARE ADDRESS IS THE HOST'S: asked once, for the one address that answered, while its alias address was on the port.
      // (Row V6, R119-03: the composition's probe does not count, so the scan answers NOT_KNOWN - never "one device, no conflict".)
      expect(answer.devices).toMatchObject([{ address: '192.168.1.108', mac: 'AA:BB:CC:00:11:22', deviceCount: 'NOT_KNOWN', endpointCount: null }]);
      expect(startedWith(neighbourProgram)).toEqual(['-4 neigh show to 192.168.1.108']);
      expect(startedWith(echoProgram)).toEqual([]);
      expect(probed).toHaveLength(4);
      // Neither the hardware address nor an address of the scan is in a log line or an audit entry of the scan.
      const said = `${JSON.stringify(linux.host.log.lines().slice(mark))}\n${JSON.stringify((await linux.since(from)).filter((row) => row.type === 'CAMERA_FACTORY_SCANNED'))}`;
      expect(said).not.toMatch(/AA:BB:CC|aa:bb:cc|192\.168\.1\.108/);

      // THE SET-IP JOB: its door is open. An address the last scan did not list is refused by the job's own rule, AFTER the
      // refusal "not available" - nothing is dialled, no program is started, nothing typed stays anywhere.
      // (Row V6, R119-04: the request carries the hardware address of the scan row; it is refused here before that address is read.)
      const refused = await linux.call('POST', SET, { fromAddress: '192.168.1.64', scannedMac: 'AA:BB:CC:00:11:22', credential: typed });
      expect(linux.reasonOf(refused).slice(0, 3)).toEqual([422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']);
      expect(startedWith(neighbourProgram)).toHaveLength(1);
      expect(startedWith(echoProgram)).toEqual([]);
      expect(`${JSON.stringify(linux.host.log.lines())}\n${JSON.stringify(await readTrail(linux.owner))}\n${refused.body}`).not.toMatch(/cnry[US]r111b/);

      // ── THIS PLATFORM, composed as the entry composes it (no seam): no observation exists. The scan states no hardware
      // address and every job keeps the named refusal. No program was started.
      const darwin = await production('r111b_darwin', (_owner, made) => ({ platform: 'darwin', aliasTransport: made.transport, aliasInterfaceFile: () => 'eth1' }));
      captureFactoryScanControl(darwin.app).replaceForTest({ gate: createFactoryScanGate(0), probe: async (destination) => (destination.address === '192.168.1.108' ? { answered: true, onvifReachable: true } : { answered: false, onvifReachable: false }) });
      const plain = await darwin.call('POST', SCAN);
      expect(plain.statusCode, plain.body).toBe(200);
      expect(plain.json<{ devices: { address: string; mac: string | null }[] }>().devices).toMatchObject([{ address: '192.168.1.108', mac: null }]);
      expect(darwin.reasonOf(await darwin.call('POST', SET, { fromAddress: '192.168.1.108', scannedMac: 'AA:BB:CC:00:11:22', credential: typed })).slice(0, 3)).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
      expect([startedWith(neighbourProgram), startedWith(echoProgram)]).toEqual([['-4 neigh show to 192.168.1.108'], []]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 300_000);

  it('a Core that is NOT production, and a production Core composed WITHOUT the network facts: no lifecycle is made, neither door is opened, no boot step is added', async () => {
    const development = await ready('r106b_dev', DEVELOPMENT, productionRows);
    expect(composeProductionCaptureOf(development.app, { platform: 'darwin', network: () => HOST })).toEqual({ composed: false, operation: 'REAL_DEVELOPMENT' });
    expect([productionHostAlias(development.app), captureHostAliasControl(development.app).provided(), captureFactoryScanControl(development.app).provided()]).toEqual([null, false, false]);
    const bare = await ready('r106b_bare', PRODUCTION, productionRows);
    expect(composeProductionCaptureOf(bare.app, INPUT)).toMatchObject({ composed: true, networkFactsInjected: false });
    expect([productionHostAlias(bare.app), captureHostAliasControl(bare.app).provided(), captureFactoryScanControl(bare.app).provided()]).toEqual([null, false, false]);
  });
});
