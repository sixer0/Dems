// The capture-config store, its slice builders and its boot (blueprint row 52 / M2-W10; register
// NM-09 "store/slices boot", CS-23 read side; C3 §6; dbc-3 §B.1/§B.2/§E.3). No app, no database:
// every reader here is a fake that answers what the two KEPT tables would hold, so the boot runs
// in-memory exactly as the blueprint's Verification asks ("boot with FAKES/in-memory").
//
// The M2-MT-7 half of this file is the SEED-COUNT CLAUSE proved from the seed's own row builders:
// `rbacRows()` of `db/mapping` is what `db:seed` writes into the three RBAC tables, and the capture
// baseline is what dbc-3 §E.3 fixes for the two capture tables. The counts are therefore the seed's
// counts, read at their source, not a hand-typed number.
import { REPLICATED_SLICE_NAMES } from '@dems/shared/api';
import { ROLE_PERMISSIONS, DEFAULT_CAPTURE_DEVICES, OperatorRole } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { rbacRows } from '../../../db/mapping';
import {
  CAPTURE_CONFIG_BOOT_STEP,
  CaptureSliceError,
  READ_CAPTURE_STATE,
  baselineCaptureConfig,
  baselineCaptureDevices,
  captureConfigSliceOf,
  captureDevicesSliceOf,
  createCaptureConfigStore,
  runCaptureConfigBoot,
  type CaptureBootSinks,
  type CaptureDeviceRecord,
  type CaptureStateRow,
  type CaptureStoreReader,
} from '../index';

const seededDevices: readonly CaptureDeviceRecord[] = [
  { id: 'CAM-01', kind: 'CAMERA', transport: 'RTSP', model: 'Dual-lens IP camera DL-2', firmware: '3.8.14', address: '127.0.0.1:8554', poePort: 'POE_CAM_1', enabled: true },
  { id: 'CAM-02', kind: 'CAMERA', transport: 'RTSP', model: 'Dual-lens IP camera DL-2', firmware: '3.8.14', address: '127.0.0.1:8555', poePort: 'POE_CAM_1', enabled: true },
  { id: 'MIC-01', kind: 'MIC', transport: 'USB', model: 'USB condenser microphone UM-1', firmware: '1.04', address: null, poePort: null, enabled: true },
  { id: 'MIC-02', kind: 'MIC', transport: 'USB', model: 'USB condenser microphone UM-1', firmware: '1.04', address: null, poePort: null, enabled: true },
  { id: 'POE-SWITCH', kind: 'POE', transport: 'SNMP', model: 'PoE+ switch PS-8', firmware: '2.4.1', address: '127.0.0.1', poePort: null, enabled: true },
];

/** The selector row as the seed writes it (CODE-valid profile; dbc-3 §E.3 site config). */
const seededConfig = {
  video01DeviceId: 'CAM-01',
  video01Profile: 'H264_1080P25',
  video02DeviceId: 'CAM-02',
  video02Profile: 'H264_1080P25',
  micPrimaryId: 'MIC-01',
  micStandbyId: 'MIC-02',
  revision: 1,
  updatedAt: 1_759_000_000_000,
};

const readerReturning = (row: Partial<CaptureStateRow> | Error): CaptureStoreReader & { queries: string[] } => {
  const queries: string[] = [];
  return {
    queries,
    async query<Row>(text: string) {
      queries.push(text);
      if (row instanceof Error) throw row;
      return { rows: [{ config: null, devices: [], session_open: false, ...row } as unknown as Row] };
    },
  };
};

const silentSinks = (): CaptureBootSinks & { lines: Array<{ level: string; message: string; code?: string }> } => {
  const lines: Array<{ level: string; message: string; code?: string }> = [];
  return {
    lines,
    info: () => undefined,
    warn: (_fields, message) => void lines.push({ level: 'warn', message }),
    error: (_fields, message) => void lines.push({ level: 'error', message }),
    persist: (entry) => void lines.push({ level: entry.level, message: entry.message, code: entry.code }),
  };
};

describe('captureConfigSliceOf: the selector row plus the registry make slice 29', () => {
  it('the seeded row answers the selector in slice order: VIDEO-01 first, PRIMARY first, updatedAt from the row', () => {
    const slice = captureConfigSliceOf(seededConfig, seededDevices, false);
    expect(slice.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile, camera.online, camera.streamState])).toEqual([
      ['VIDEO-01', 'CAM-01', 'H264_1080P25', true, 'LIVE'],
      ['VIDEO-02', 'CAM-02', 'H264_1080P25', true, 'LIVE'],
    ]);
    expect(slice.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role, mic.transport, mic.online])).toEqual([
      ['MIC-01', 'MIC-01', 'PRIMARY', 'USB', true],
      ['MIC-02', 'MIC-02', 'STANDBY', 'USB', true],
    ]);
    expect(slice.locked).toBe(false);
    expect(slice.updatedAt).toBe(seededConfig.updatedAt);
  });

  it('the mic rows are in input order whichever input is PRIMARY (AC-B-70; blueprint row 66): a swapped selector row lists MIC-01 first', () => {
    const swapped = captureConfigSliceOf({ ...seededConfig, micPrimaryId: 'MIC-02', micStandbyId: 'MIC-01' }, seededDevices, false);
    expect(swapped.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role])).toEqual([
      ['MIC-01', 'MIC-01', 'STANDBY'],
      ['MIC-02', 'MIC-02', 'PRIMARY'],
    ]);
  });

  it('locked is the caller fact about the open session, never a table value (OD-10)', () => {
    expect(captureConfigSliceOf(seededConfig, seededDevices, true).locked).toBe(true);
    expect(baselineCaptureConfig(true).locked).toBe(true);
    expect(baselineCaptureConfig(false).locked).toBe(false);
  });

  it('a disabled camera reads LOST, the lost-stream state that makes operation 48 legal (OD-22)', () => {
    const offline = seededDevices.map((device) => (device.id === 'CAM-02' ? { ...device, enabled: false } : device));
    const slice = captureConfigSliceOf(seededConfig, offline, false);
    expect(slice.cameras[1]).toMatchObject({ trackId: 'VIDEO-02', online: false, streamState: 'LOST' });
  });

  it('an empty selector table answers the built-in baseline (the seed wiring is routed, boot.ts says so loudly)', () => {
    expect(captureConfigSliceOf(null, [], false)).toEqual(baselineCaptureConfig(false));
  });

  it('a selector naming a device the registry lacks, or a mic outside the two inputs, refuses with identifiers only', () => {
    expect(() => captureConfigSliceOf({ ...seededConfig, video01DeviceId: 'CAM-09' }, seededDevices, false)).toThrowError(CaptureSliceError);
    try {
      captureConfigSliceOf({ ...seededConfig, video01DeviceId: 'CAM-09' }, seededDevices, false);
      expect.unreachable();
    } catch (cause) {
      expect(cause).toBeInstanceOf(CaptureSliceError);
      expect((cause as CaptureSliceError).code).toBe('CAPTURE_DEVICE_UNKNOWN');
      expect((cause as CaptureSliceError).context).toEqual({ trackId: 'VIDEO-01', deviceId: 'CAM-09' });
    }
    expect(() => captureConfigSliceOf({ ...seededConfig, micPrimaryId: 'CAM-01' }, seededDevices, false)).toThrow(/outside the MIC-NN input form/);
  });
});

describe('captureDevicesSliceOf: the registry rows make slice 30 (their own kind, never AdminResource - E-04)', () => {
  it('rows map in id order; host is the address only; capabilities wait for telemetry (SH-18)', () => {
    const slice = captureDevicesSliceOf(seededDevices);
    expect(slice.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);
    expect(slice.devices[0]).toEqual({
      id: 'CAM-01',
      kind: 'CAMERA',
      model: 'Dual-lens IP camera DL-2',
      firmware: '3.8.14',
      host: '127.0.0.1:8554',
      poePort: 'POE_CAM_1',
      online: true,
      streamState: 'LIVE',
      capabilities: [],
    });
    // A mic and the switch carry no stream state (slice schema: null for a device with no stream).
    expect(slice.devices[2]).toMatchObject({ id: 'MIC-01', streamState: null });
    expect(slice.devices[4]).toMatchObject({ id: 'POE-SWITCH', streamState: null });
    // RK-12: no member of any device is named like a credential.
    for (const device of slice.devices) {
      expect(Object.keys(device)).not.toContain('credential');
      expect(String(device.host)).not.toMatch(/:.*@/);
    }
  });

  it('an empty registry answers the five built-ins of dbc-3 §E.3', () => {
    expect(captureDevicesSliceOf([])).toEqual(baselineCaptureDevices());
    expect(baselineCaptureDevices().devices).toHaveLength(5);
  });
});

describe('the store loads once and answers by reference (NM-09 boot)', () => {
  it('before the first load, snapshot() refuses: the boot step loads first', () => {
    const store = createCaptureConfigStore();
    expect(() => store.snapshot()).toThrowError(CaptureSliceError);
    try {
      store.snapshot();
      expect.unreachable();
    } catch (cause) {
      expect((cause as CaptureSliceError).code).toBe('CAPTURE_STORE_UNLOADED');
    }
  });

  it('a seeded database gives both slices, the revision, and locked from the open-session fact', async () => {
    const store = createCaptureConfigStore();
    const reader = readerReturning({ config: seededConfig, devices: seededDevices, session_open: true });
    const snapshot = await store.load(reader);
    expect(snapshot.locked).toBe(true);
    expect(snapshot.revision).toBe(1);
    expect(snapshot.builtInBaseline).toBe(false);
    expect(store.snapshot()).toBe(snapshot);
    expect(store.snapshot().captureConfig.updatedAt).toBe(seededConfig.updatedAt);
    // One statement, exactly as the stored-matrix read of the guard does it.
    expect(reader.queries).toHaveLength(1);
  });

  it('an unseeded selector table loads the baseline and marks it (the named exception of boot.ts)', async () => {
    const store = createCaptureConfigStore();
    const snapshot = await store.load(readerReturning({ config: null, devices: [], session_open: false }));
    expect(snapshot.builtInBaseline).toBe(true);
    expect(snapshot.revision).toBe(0);
    expect(snapshot.captureConfig).toEqual(baselineCaptureConfig(false));
    expect(snapshot.captureDevices).toEqual(DEFAULT_CAPTURE_DEVICES);
  });

  it('the load statement reads the two KEPT tables and active_session - and never the credential table (RK-12)', () => {
    expect(READ_CAPTURE_STATE).toContain('public.capture_config');
    expect(READ_CAPTURE_STATE).toContain('public.capture_devices');
    expect(READ_CAPTURE_STATE).toContain('public.active_session');
    expect(READ_CAPTURE_STATE).not.toContain('capture_device_credentials');
    expect(READ_CAPTURE_STATE).not.toContain('secret');
    expect(READ_CAPTURE_STATE).not.toContain('$1');
  });
});

describe('runCaptureConfigBoot: the step logs and persists what it decided, and fails closed', () => {
  it('a seeded load passes quietly; an unseeded one warns in the log AND in the persistent error log', async () => {
    const seeded = silentSinks();
    await runCaptureConfigBoot(createCaptureConfigStore(), readerReturning({ config: seededConfig, devices: seededDevices, session_open: false }), seeded);
    expect(seeded.lines).toEqual([]);

    const unseeded = silentSinks();
    await runCaptureConfigBoot(createCaptureConfigStore(), readerReturning({ config: null, devices: [], session_open: false }), unseeded);
    expect(unseeded.lines.filter((line) => line.level === 'warn')).toHaveLength(2);
    expect(unseeded.lines.filter((line) => line.level === 'warn').every((line) => line.code === 'CAPTURE_CONFIG_BASELINE' || line.message.includes('built-in selector baseline'))).toBe(true);
  });

  it('an invalid row set stops the start: logged, persisted with its code, and thrown', async () => {
    const sinks = silentSinks();
    const brokenReader = readerReturning({ config: { ...seededConfig, video01DeviceId: 'CAM-09' }, devices: seededDevices, session_open: false });
    await expect(runCaptureConfigBoot(createCaptureConfigStore(), brokenReader, sinks)).rejects.toThrowError(CaptureSliceError);
    expect(sinks.lines.filter((line) => line.level === 'error')).toHaveLength(2);
    expect(sinks.lines.some((line) => line.level === 'error' && line.code === 'CAPTURE_DEVICE_UNKNOWN')).toBe(true);
  });

  it('the step carries its id for the readiness log (boot step `capture.config`)', () => {
    expect(CAPTURE_CONFIG_BOOT_STEP).toBe('capture.config');
  });
});

describe('M2-MT-7 seed-count clause, read at the seed source (in-memory)', () => {
  it('the seed writes 14 permissions and 22 grants (5/12/5), equal to ROLE_PERMISSIONS', () => {
    const rows = rbacRows();
    expect(rows.permissions).toHaveLength(14);
    expect(rows.rolePermissions).toHaveLength(22);
    const perRole = Object.fromEntries(Object.values(OperatorRole).map((role) => [role, rows.rolePermissions.filter((grant) => grant.roleId === role).length]));
    expect(perRole).toEqual({ INVESTIGATOR: 5, SUPERVISOR: 12, TECHNICIAN: 5 });
    for (const role of Object.values(OperatorRole)) {
      const granted = rows.rolePermissions.filter((grant) => grant.roleId === role).map((grant) => grant.permissionId).sort();
      expect(granted).toEqual([...ROLE_PERMISSIONS[role]].sort());
    }
  });

  it('the capture tables carry 1 selector row, 5 built-in devices, 0 credentials (dbc-3 §E.3)', () => {
    // The baseline the boot serves when the seed has not written the rows yet is exactly the E.3 set.
    expect(baselineCaptureDevices().devices).toHaveLength(5);
    expect(baselineCaptureConfig(false).cameras).toHaveLength(2);
    expect(baselineCaptureConfig(false).mics).toHaveLength(2);
    // A credential is never seeded (SD-8) and never readable by this module: the load statement
    // above proves the absence; here, the baseline holds no credential member either.
    expect(JSON.stringify(baselineCaptureDevices())).not.toMatch(/username|secret|ciphertext|nonce/i);
  });

  it('the two capture slices are replicated slices 29 and 30 (M2-API-3 slice-count clause)', () => {
    expect(REPLICATED_SLICE_NAMES).toHaveLength(30);
    expect(REPLICATED_SLICE_NAMES[28]).toBe('captureConfig');
    expect(REPLICATED_SLICE_NAMES[29]).toBe('captureDevices');
  });
});
