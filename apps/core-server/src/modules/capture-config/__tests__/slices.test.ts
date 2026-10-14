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
  it('the seed writes 15 permissions and 23 grants (5/12/6), equal to ROLE_PERMISSIONS', () => {
    const rows = rbacRows();
    expect(rows.permissions).toHaveLength(15);
    expect(rows.rolePermissions).toHaveLength(23);
    const perRole = Object.fromEntries(Object.values(OperatorRole).map((role) => [role, rows.rolePermissions.filter((grant) => grant.roleId === role).length]));
    expect(perRole).toEqual({ INVESTIGATOR: 5, SUPERVISOR: 12, TECHNICIAN: 6 });
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

// Task 4 row 29 (WP-13a; sites A1 and A2 of research/027; decisions C14, C18; security requirement
// AD-04). The six slot columns are nullable since schema set A. Until this row `recordOf` threw
// `CAPTURE_ROW_INVALID` for a NULL slot and the slice builder threw for a device it could not find,
// each of which stopped the boot at the step `capture.config`. No seed writes a NULL: the rows
// below are written by hand, as the aggregate of the load statement gives them (a JSON null).
describe('an unassigned selector slot is an absent line, and the boot step passes on it (task 4 row 29)', () => {
  const SLOTS = ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'] as const;
  type Slot = (typeof SLOTS)[number];
  /** The seeded row with the columns of the named slots NULL. */
  const rowWithout = (unassigned: readonly Slot[]) => ({
    ...seededConfig,
    ...(unassigned.includes('VIDEO-01') ? { video01DeviceId: null, video01Profile: null } : {}),
    ...(unassigned.includes('VIDEO-02') ? { video02DeviceId: null, video02Profile: null } : {}),
    ...(unassigned.includes('PRIMARY') ? { micPrimaryId: null } : {}),
    ...(unassigned.includes('STANDBY') ? { micStandbyId: null } : {}),
  });
  /** Every set of unassigned slots: 16, the complete selector (none) included. */
  const SUBSETS: Slot[][] = Array.from({ length: 16 }, (_unused, bits) => SLOTS.filter((_slot, index) => (bits & (1 << index)) !== 0));
  const SEEDED_DEVICE_OF: Readonly<Record<Slot, string>> = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: 'MIC-02' };

  it('each of the 16 selectors of four slots: exactly the lines of the assigned slots, each on ITS track or role, and the slice is the contract\'s', () => {
    for (const unassigned of SUBSETS) {
      const slice = captureConfigSliceOf(rowWithout(unassigned), seededDevices, false);
      const assigned = SLOTS.filter((slot) => !unassigned.includes(slot));
      expect(slice.cameras.map((camera) => [camera.trackId, camera.deviceId]), unassigned.join('+')).toEqual(assigned.filter((slot) => slot.startsWith('VIDEO')).map((slot) => [slot, SEEDED_DEVICE_OF[slot]]));
      expect(slice.mics.map((mic) => [mic.role, mic.deviceId, mic.inputId]), unassigned.join('+')).toEqual(assigned.filter((slot) => !slot.startsWith('VIDEO')).map((slot) => [slot, SEEDED_DEVICE_OF[slot], SEEDED_DEVICE_OF[slot]]));
      expect(slice.updatedAt).toBe(seededConfig.updatedAt);
      // No line with an empty device, and no member that reads "null": an unassigned slot is ABSENT.
      expect(JSON.stringify(slice)).not.toMatch(/null|""/);
    }
    // CONTROL: the complete row is the first of the 16 and answers what it answered before this row.
    expect(SUBSETS[0]).toEqual([]);
    expect(captureConfigSliceOf(rowWithout([]), seededDevices, false)).toEqual(captureConfigSliceOf(seededConfig, seededDevices, false));
  });

  it('AD-04 (2), nothing by position: only VIDEO-02 and only a STANDBY microphone answer those two lines - VIDEO-02 is not read as the first track, the standby not as the primary', () => {
    const slice = captureConfigSliceOf(rowWithout(['VIDEO-01', 'PRIMARY']), seededDevices, true);
    expect(slice.cameras).toEqual([{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25', online: true, streamState: 'LIVE' }]);
    expect(slice.mics).toEqual([{ inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY', transport: 'USB', online: true }]);
    expect(slice.locked).toBe(true);
    // The mirror image, and a lone PRIMARY that is the SECOND input: the role is the column's, never the input's place.
    const mirror = captureConfigSliceOf({ ...rowWithout(['VIDEO-02', 'STANDBY']), micPrimaryId: 'MIC-02' }, seededDevices, false);
    expect(mirror.cameras.map((camera) => camera.trackId)).toEqual(['VIDEO-01']);
    expect(mirror.mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-02', 'PRIMARY']]);
  });

  it('a row of six NULLs is two empty lists: NOT the built-in baseline (that is a table without a row), and it invents no device', () => {
    const empty = captureConfigSliceOf(rowWithout(SLOTS), seededDevices, false);
    expect(empty).toEqual({ cameras: [], mics: [], locked: false, updatedAt: seededConfig.updatedAt });
    expect(empty).not.toEqual(baselineCaptureConfig(false));
    // An empty registry beside it changes nothing: no line is made up from the built-in five.
    expect(captureConfigSliceOf(rowWithout(SLOTS), [], false)).toEqual(empty);
  });

  it('GATE CONDITION AD-04: the store loads, and the boot step `capture.config` passes, on a selector row of six NULLs - in the form the load statement gives it (JSON nulls)', async () => {
    const sixNulls = JSON.parse(JSON.stringify(rowWithout(SLOTS))) as Record<string, unknown>;
    expect(Object.entries(sixNulls).filter(([, value]) => value === null).map(([member]) => member).sort()).toEqual(['micPrimaryId', 'micStandbyId', 'video01DeviceId', 'video01Profile', 'video02DeviceId', 'video02Profile']);
    const store = createCaptureConfigStore();
    const sinks = silentSinks();
    await runCaptureConfigBoot(store, readerReturning({ config: sixNulls, devices: seededDevices, session_open: false }), sinks);
    // No warn, no error, nothing in the persistent error log: an unassigned selector is not a fault of the boot.
    expect(sinks.lines).toEqual([]);
    const snapshot = store.snapshot();
    expect(snapshot.captureConfig).toEqual({ cameras: [], mics: [], locked: false, updatedAt: seededConfig.updatedAt });
    expect([snapshot.builtInBaseline, snapshot.revision, snapshot.locked]).toEqual([false, 1, false]);
    expect(snapshot.captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);

    // Every one of the 16 loads, and a member the aggregate left out reads as the same "nothing assigned".
    for (const unassigned of SUBSETS) {
      const loaded = await createCaptureConfigStore().load(readerReturning({ config: rowWithout(unassigned), devices: seededDevices, session_open: false }));
      expect(loaded.captureConfig.cameras.length + loaded.captureConfig.mics.length, unassigned.join('+')).toBe(4 - unassigned.length);
    }
    const { micStandbyId: _left, ...withoutMember } = seededConfig;
    expect((await createCaptureConfigStore().load(readerReturning({ config: withoutMember, devices: seededDevices, session_open: false }))).captureConfig.mics.map((mic) => mic.role)).toEqual(['PRIMARY']);
  });

  it('FAIL CLOSED stays: a slot member that is neither text nor null, half a video pair, and a device the registry lacks beside an empty slot still stop the start, by name', async () => {
    const refusalOfLoad = async (config: Record<string, unknown>): Promise<[string, Record<string, unknown>]> => {
      try {
        await createCaptureConfigStore().load(readerReturning({ config, devices: seededDevices, session_open: false }));
      } catch (error) {
        if (error instanceof CaptureSliceError) return [error.code, { ...error.context }];
        throw error;
      }
      return ['no refusal', {}];
    };
    for (const value of [7, false, ['CAM-01'], { id: 'CAM-01' }]) {
      expect(await refusalOfLoad({ ...seededConfig, video02DeviceId: value }), JSON.stringify(value)).toEqual(['CAPTURE_ROW_INVALID', { member: 'video02DeviceId' }]);
    }
    // Half a pair: the CHECK `capture_config_slot_pair_check` cannot hold it; read by hand it is refused by the member that is missing.
    expect(await refusalOfLoad({ ...seededConfig, video01Profile: null })).toEqual(['CAPTURE_ROW_INVALID', { trackId: 'VIDEO-01', member: 'video01Profile' }]);
    expect(await refusalOfLoad({ ...seededConfig, video02DeviceId: null })).toEqual(['CAPTURE_ROW_INVALID', { trackId: 'VIDEO-02', member: 'video02DeviceId' }]);
    // An empty slot does not excuse the others: an unknown camera and a mic outside the input form are refused as before.
    expect(await refusalOfLoad({ ...rowWithout(['VIDEO-01']), video02DeviceId: 'CAM-09' })).toEqual(['CAPTURE_DEVICE_UNKNOWN', { trackId: 'VIDEO-02', deviceId: 'CAM-09' }]);
    expect(await refusalOfLoad({ ...rowWithout(['PRIMARY']), micStandbyId: 'POE-SWITCH' })).toEqual(['CAPTURE_MIC_INPUT_UNKNOWN', { deviceId: 'POE-SWITCH' }]);
    // An empty text is no "nothing assigned": only NULL is. It names no device, and is refused as one.
    expect(await refusalOfLoad({ ...seededConfig, video01DeviceId: '' })).toEqual(['CAPTURE_DEVICE_UNKNOWN', { trackId: 'VIDEO-01', deviceId: '' }]);
    // The boot step turns such a refusal into a stopped start with its code in both sinks (unchanged).
    const sinks = silentSinks();
    await expect(runCaptureConfigBoot(createCaptureConfigStore(), readerReturning({ config: { ...seededConfig, video01Profile: null }, devices: seededDevices, session_open: false }), sinks)).rejects.toThrowError(CaptureSliceError);
    expect(sinks.lines.filter((line) => line.level === 'error')).toHaveLength(2);
  });
});

// Task 4 row V7d (decisions C126 (b), C141; request line 568 of row V7c): the two builders state a REGISTERED camera's
// stream as the row layer does (`db/mapping/rows.ts`): null - NOT READ - at rest, whatever its `enabled` flag; only the
// built-in cameras of the demonstration model keep LIVE / LOST from the flag (the cases above, unedited). Mutations: v7d_op44_not_read.md.
describe('row V7d: a registered camera is NOT READ (null) on both slices the builders make, never LIVE / LOST from `enabled`', () => {
  const registered = (enabled: boolean): CaptureDeviceRecord => ({ id: 'CAM-07', kind: 'CAMERA', transport: 'RTSP', model: null, firmware: null, address: '192.0.2.17', poePort: null, enabled });

  it('on its selector line and on its registry entry, enabled or not; CONTROL: the built-in CAM-01 beside it keeps LIVE, and LOST when disabled', () => {
    for (const enabled of [true, false]) {
      const devices = [...seededDevices.map((device) => (device.id === 'CAM-01' ? { ...device, enabled } : device)), registered(enabled)];
      const config = captureConfigSliceOf({ ...seededConfig, video02DeviceId: 'CAM-07' }, devices, false);
      expect(config.cameras.map((line) => [line.trackId, line.deviceId, line.online, line.streamState]), `enabled ${enabled}`).toEqual([
        ['VIDEO-01', 'CAM-01', enabled, enabled ? 'LIVE' : 'LOST'],
        ['VIDEO-02', 'CAM-07', enabled, null],
      ]);
      const entries = captureDevicesSliceOf(devices).devices.filter((device) => device.kind === 'CAMERA');
      expect(entries.map((device) => [device.id, device.online, device.streamState]), `enabled ${enabled}`).toEqual([
        ['CAM-01', enabled, enabled ? 'LIVE' : 'LOST'],
        ['CAM-02', true, 'LIVE'],
        ['CAM-07', enabled, null],
      ]);
    }
  });
});
