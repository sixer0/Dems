// G70-01 (gate 70; decision D196; D91 ruling R-2, D131): A CORE IN SIMULATED CAPTURE NEVER STATES A
// SOURCE CLASS OR AN ADAPTER, ON ANY OPERATION. Both clients draw the "Development source" badge
// from what the Core sent and from nothing else, so one operation that says `sourceClass:
// DEVELOPMENT` on a simulated Core draws the badge there (gate 70: operation 97 did, on lane 1).
//
// ONE TABLE over everything a client can read of a capture source on a simulated Core - the real
// app factory on PostgreSQL as `dems_app`, booted, the seeded operators signed in on the web
// console, with NOTHING handed in (no discovery adapter, no probe): the product as a lane runs it.
//
//   reads      76 getCaptureConfig, 77 getCaptureDevices, the four device reads, the alerts
//   searches   93 startCaptureDiscovery (503: a simulated Core has no camera search, so no
//              candidate - the only shape whose `adapter` / `sourceClass` are not optional - can
//              exist), 94 getCaptureDiscovery, 97 rescanCaptureInputs
//   writes     78 updateCaptureConfig (the pair replacement), 79 setCaptureCameraSource,
//              80 setPrimaryMic: the selector they answer
//   state      the replicated slices `captureDevices`, `captureConfig`, `alerts`, and every audit
//              row the table wrote
//
// The CONTROL of the reader is the planted row below; the control of the rule itself is
// `source-class.db.test.ts` (a REAL_DEVELOPMENT Core does state the class, read by the same words).
import { CORE_API_OPERATIONS, validateCoreApiResponse } from '@dems/shared/api';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureFenceControl } from '../../../capture/fence';
import { noticesApp, type NoticesApp } from '../../capture-inputs/__tests__/support';

const db = useTestDatabase({ template: 'seed' });

/** What a simulated Core must never say about a source: the two members, the "is on" member, and the values of either. */
const SOURCE_STATEMENT = /"sourceClass"|"adapter"|"adapterKind"|"sourceOpen"|DEVELOPMENT|PRODUCTION|LOCAL_DEVICE|"FAKE"|ONVIF_RTSP/;
const pathOf = (operationId: string): string => {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the registry has no operation ${operationId}`);
  return operation.path;
};

interface Row {
  readonly operation: string;
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly body?: Record<string, unknown>;
  readonly status: number;
}
/** In this order: the reads, the searches, then the three writes (each leaves a valid selector). */
const TABLE: readonly Row[] = [
  { operation: 'getCaptureConfig', method: 'GET', url: pathOf('getCaptureConfig'), status: 200 },
  { operation: 'getCaptureDevices', method: 'GET', url: pathOf('getCaptureDevices'), status: 200 },
  { operation: 'getDeviceHealth', method: 'GET', url: pathOf('getDeviceHealth'), status: 200 },
  { operation: 'getAudioStatus', method: 'GET', url: pathOf('getAudioStatus'), status: 200 },
  { operation: 'getVideoStatus', method: 'GET', url: pathOf('getVideoStatus'), status: 200 },
  { operation: 'getDeviceInventory', method: 'GET', url: pathOf('getDeviceInventory'), status: 200 },
  { operation: 'startCaptureDiscovery', method: 'POST', url: pathOf('startCaptureDiscovery'), status: 503 },
  { operation: 'getCaptureDiscovery', method: 'GET', url: pathOf('getCaptureDiscovery'), status: 200 },
  { operation: 'rescanCaptureInputs', method: 'POST', url: pathOf('rescanCaptureInputs'), status: 200 },
  { operation: 'setPrimaryMic', method: 'POST', url: '/api/v1/capture/mics/MIC-02/primary', status: 200 },
  // D61 (2026-11-04): the mic line is keyed by its CHANNEL — the `role` member of the two-role lane is
  // off the wire (strict schema: a body that still states it is 422). Four numbered channels.
  { operation: 'updateCaptureConfig', method: 'POST', url: pathOf('updateCaptureConfig'), body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }, { inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', deviceId: 'MIC-04', channel: 'MIC-04' }] }, status: 200 },
  { operation: 'setCaptureCameraSource', method: 'POST', url: '/api/v1/capture/cameras/CAM-01/source', body: { trackId: 'VIDEO-01' }, status: 200 },
  { operation: 'listAlerts', method: 'GET', url: pathOf('listAlerts'), status: 200 },
];

let server: NoticesApp;
beforeAll(async () => {
  server = await noticesApp(db);
});

describe('G70-01: a Core in SIMULATED capture states no source class and no adapter, on any operation', () => {
  it('CONTROL - the reader finds each statement when it is there', () => {
    for (const planted of ['{"adapter":"FAKE"}', '{"sourceClass":"DEVELOPMENT"}', '{"inputs":[{"deviceId":"MIC-01","sourceClass":"PRODUCTION"}]}', '{"sourceOpen":false}', '{"kind":"LOCAL_DEVICE"}']) expect(SOURCE_STATEMENT.test(planted), planted).toBe(true);
    expect(SOURCE_STATEMENT.test('{"deviceId":"MIC-01","inputId":"MIC-01","present":true,"errorCode":null}')).toBe(false);
  });

  it('the table: every read, search and selector write answers its status, fits the contract, and says nothing about a source; nor do the slices and the audit rows', async () => {
    expect(captureFenceControl(server.app).operation).toBe('SIMULATED');
    const trail = await server.trailLength();
    const said: string[] = [];
    for (const row of TABLE) {
      // Clear of the spacing of a re-read; short enough for the session to stay signed in (it idles out after 15 minutes).
      server.clock.advance(20_000);
      const response = row.method === 'GET' ? await server.get('TECHNICIAN', row.url) : await server.post('TECHNICIAN', row.url, row.body);
      expect(response.statusCode, `${row.operation}: ${response.body}`).toBe(row.status);
      if (row.status === 200) expect(validateCoreApiResponse(row.operation as Parameters<typeof validateCoreApiResponse>[0], 200, response.json()), row.operation).toEqual({ ok: true });
      if (SOURCE_STATEMENT.test(response.body)) said.push(`${row.operation}: ${SOURCE_STATEMENT.exec(response.body)?.[0] ?? ''}`);
    }
    expect(said).toEqual([]);

    await server.app.pipeline.drain();
    await server.engine.idle();
    for (const slice of ['captureDevices', 'captureConfig', 'alerts'] as const) expect(JSON.stringify(server.engine.slice(slice)), slice).not.toMatch(SOURCE_STATEMENT);
    const rows = await server.since(trail);
    // The table wrote rows (the re-read, the three selector writes): they are read, and none states a source.
    expect(rows.map((row) => row.type)).toEqual(expect.arrayContaining(['CAPTURE_DISCOVERY_SEARCHED', 'CAPTURE_CONFIG_CHANGED']));
    expect(rows.filter((row) => SOURCE_STATEMENT.test(JSON.stringify(row))).map((row) => row.type)).toEqual([]);
  });

  it('operation 97 names each registered microphone with what a simulated Core knows: its ids, whether it is there - and no class', async () => {
    server.clock.advance(20_000);
    // REVISED 2026-11-04 (migration 0034, ratified 2026-10-29): CAPTURE_CONFIG was REVOKED from SUPERVISOR —
    // the re-read is the installing technician's; the table above already drives it as TECHNICIAN.
    const response = await server.post('TECHNICIAN', pathOf('rescanCaptureInputs'));
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ inputs: unknown[] }>().inputs).toEqual([
      // D61 (2026-11-04): the Core registers FOUR numbered microphone channels; the re-read names each one.
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: true, errorCode: null },
      { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, errorCode: null },
      { deviceId: 'MIC-04', inputId: 'MIC-04', present: true, errorCode: null },
    ]);
  });
});
