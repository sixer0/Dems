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
  // D60 (2026-11-04): the seed writes FOUR built-in cameras - the two single-lens lines of the four-track capture surface.
  { id: 'CAM-03', kind: 'CAMERA', transport: 'RTSP', model: 'IP camera IP-3', firmware: '3.8.14', address: '127.0.0.1:8556', poePort: 'POE_CAM_3', enabled: true },
  { id: 'CAM-04', kind: 'CAMERA', transport: 'RTSP', model: 'IP camera IP-4', firmware: '3.8.14', address: '127.0.0.1:8557', poePort: 'POE_CAM_4', enabled: true },
  { id: 'MIC-01', kind: 'MIC', transport: 'USB', model: 'USB condenser microphone UM-1', firmware: '1.04', address: null, poePort: null, enabled: true },
  { id: 'MIC-02', kind: 'MIC', transport: 'USB', model: 'USB condenser microphone UM-1', firmware: '1.04', address: null, poePort: null, enabled: true },
  // D61 (2026-11-04): the seed writes FOUR built-in microphones - the channels MIC-03 and MIC-04 of the four-channel plane.
  { id: 'MIC-03', kind: 'MIC', transport: 'USB', model: 'USB condenser microphone UM-3', firmware: '1.04', address: null, poePort: null, enabled: true },
  { id: 'MIC-04', kind: 'MIC', transport: 'USB', model: 'USB condenser microphone UM-4', firmware: '1.04', address: null, poePort: null, enabled: true },
  { id: 'POE-SWITCH', kind: 'POE', transport: 'SNMP', model: 'PoE+ switch PS-8', firmware: '2.4.1', address: '127.0.0.1', poePort: null, enabled: true },
];

/** The selector row as the seed writes it (CODE-valid profile; dbc-3 §E.3 site config; D60 (2026-11-04): all four video slots). */
const seededConfig = {
  video01DeviceId: 'CAM-01',
  video01Profile: 'H264_1080P25',
  video02DeviceId: 'CAM-02',
  video02Profile: 'H264_1080P25',
  video03DeviceId: 'CAM-03', // D60
  video03Profile: 'H264_1080P25',
  video04DeviceId: 'CAM-04',
  video04Profile: 'H264_1080P25',
  // D61 (2026-11-04): the two role columns became four numbered channel columns (migration 0040).
  mic01Id: 'MIC-01',
  mic02Id: 'MIC-02',
  mic03Id: 'MIC-03',
  mic04Id: 'MIC-04',
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
  it('the seeded row answers the selector in slice order: VIDEO-01 first, MIC-01 first, updatedAt from the row (D61)', () => {
    const slice = captureConfigSliceOf(seededConfig, seededDevices, false);
    expect(slice.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile, camera.online, camera.streamState])).toEqual([
      ['VIDEO-01', 'CAM-01', 'H264_1080P25', true, 'LIVE'],
      ['VIDEO-02', 'CAM-02', 'H264_1080P25', true, 'LIVE'],
      // D60 (2026-11-04): the seeded selector assigns all four tracks.
      ['VIDEO-03', 'CAM-03', 'H264_1080P25', true, 'LIVE'],
      ['VIDEO-04', 'CAM-04', 'H264_1080P25', true, 'LIVE'],
    ]);
    // D61 (2026-11-04): the line names its CHANNEL, as a camera line names its track.
    expect(slice.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel, mic.transport, mic.online])).toEqual([
      ['MIC-01', 'MIC-01', 'MIC-01', 'USB', true],
      ['MIC-02', 'MIC-02', 'MIC-02', 'USB', true],
      ['MIC-03', 'MIC-03', 'MIC-03', 'USB', true],
      ['MIC-04', 'MIC-04', 'MIC-04', 'USB', true],
    ]);
    expect(slice.locked).toBe(false);
    expect(slice.updatedAt).toBe(seededConfig.updatedAt);
  });

  it('the mic rows are in CHANNEL order whichever device holds which channel (AC-B-70 generalized by D61, 2026-11-04; blueprint row 66): a swapped selector row lists channel MIC-01 first', () => {
    // D61: the swap is of the DEVICES on the two first channels - the line still names its own channel, and the
    // load orders by the CHANNEL, as the engine holds it (`inChannelOrder`); the HTTP answer re-sorts by input.
    const swapped = captureConfigSliceOf({ ...seededConfig, mic01Id: 'MIC-02', mic02Id: 'MIC-01' }, seededDevices, false);
    expect(swapped.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel])).toEqual([
      ['MIC-02', 'MIC-02', 'MIC-01'],
      ['MIC-01', 'MIC-01', 'MIC-02'],
      ['MIC-03', 'MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04', 'MIC-04'],
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
    expect(() => captureConfigSliceOf({ ...seededConfig, mic01Id: 'CAM-01' }, seededDevices, false)).toThrow(/outside the MIC-NN input form/); // D61: any of the four channels
  });
});

describe('captureDevicesSliceOf: the registry rows make slice 30 (their own kind, never AdminResource - E-04)', () => {
  it('rows map in id order; host is the address only; capabilities wait for telemetry (SH-18)', () => {
    const slice = captureDevicesSliceOf(seededDevices);
    expect(slice.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH']); // D60: four seeded cameras; D61: four seeded microphones
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
    // A mic and the switch carry no stream state (slice schema: null for a device with no stream). D60: the four cameras come first; D61: then the four microphones.
    expect(slice.devices[4]).toMatchObject({ id: 'MIC-01', streamState: null });
    expect(slice.devices[8]).toMatchObject({ id: 'POE-SWITCH', streamState: null });
    // RK-12: no member of any device is named like a credential.
    for (const device of slice.devices) {
      expect(Object.keys(device)).not.toContain('credential');
      expect(String(device.host)).not.toMatch(/:.*@/);
    }
  });

  it('an empty registry answers the nine built-ins of dbc-3 §E.3 (D60, 2026-11-04: four cameras; D61, 2026-11-04: four microphones; plus the switch)', () => {
    expect(captureDevicesSliceOf([])).toEqual(baselineCaptureDevices());
    expect(baselineCaptureDevices().devices).toHaveLength(9); // D61: the fourth microphone of the numbered channel plane
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
  it('the seed writes 15 permissions and 22 grants (5/11/6), equal to ROLE_PERMISSIONS', () => {
    const rows = rbacRows();
    expect(rows.permissions).toHaveLength(15);
    expect(rows.rolePermissions).toHaveLength(22);
    const perRole = Object.fromEntries(Object.values(OperatorRole).map((role) => [role, rows.rolePermissions.filter((grant) => grant.roleId === role).length]));
    expect(perRole).toEqual({ INVESTIGATOR: 5, SUPERVISOR: 11, TECHNICIAN: 6 });
    for (const role of Object.values(OperatorRole)) {
      const granted = rows.rolePermissions.filter((grant) => grant.roleId === role).map((grant) => grant.permissionId).sort();
      expect(granted).toEqual([...ROLE_PERMISSIONS[role]].sort());
    }
  });

  it('the capture tables carry 1 selector row, 9 built-in devices, 0 credentials (dbc-3 §E.3; D60: four cameras; D61, 2026-11-04: four microphones)', () => {
    // The baseline the boot serves when the seed has not written the rows yet is exactly the E.3 set.
    expect(baselineCaptureDevices().devices).toHaveLength(9); // D61 (2026-11-04): the four-channel plane's four microphones
    expect(baselineCaptureConfig(false).cameras).toHaveLength(4); // D60: four video lines at the default selector
    expect(baselineCaptureConfig(false).mics).toHaveLength(4); // D61: four numbered channels
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
// AD-04). The slot columns (D60, 2026-11-04: ten - four video pairs and two mics) are nullable since schema set A. Until this row `recordOf` threw
// `CAPTURE_ROW_INVALID` for a NULL slot and the slice builder threw for a device it could not find,
// each of which stopped the boot at the step `capture.config`. No seed writes a NULL: the rows
// below are written by hand, as the aggregate of the load statement gives them (a JSON null).
describe('an unassigned selector slot is an absent line, and the boot step passes on it (task 4 row 29)', () => {
  const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const; // D60 (2026-11-04): four video slots; D61 (2026-11-04): four numbered microphone channels - eight slots (was four, was six)
  type Slot = (typeof SLOTS)[number];
  /** The seeded row with the columns of the named slots NULL. */
  const rowWithout = (unassigned: readonly Slot[]) => ({
    ...seededConfig,
    ...(unassigned.includes('VIDEO-01') ? { video01DeviceId: null, video01Profile: null } : {}),
    ...(unassigned.includes('VIDEO-02') ? { video02DeviceId: null, video02Profile: null } : {}),
    ...(unassigned.includes('VIDEO-03') ? { video03DeviceId: null, video03Profile: null } : {}), // D60
    ...(unassigned.includes('VIDEO-04') ? { video04DeviceId: null, video04Profile: null } : {}),
    ...(unassigned.includes('MIC-01') ? { mic01Id: null } : {}), // D61 (2026-11-04): one column per numbered channel
    ...(unassigned.includes('MIC-02') ? { mic02Id: null } : {}),
    ...(unassigned.includes('MIC-03') ? { mic03Id: null } : {}),
    ...(unassigned.includes('MIC-04') ? { mic04Id: null } : {}),
  });
  /** Every set of unassigned slots: 256, the complete selector (none) included (D60, D61: eight slots). */
  const SUBSETS: Slot[][] = Array.from({ length: 256 }, (_unused, bits) => SLOTS.filter((_slot, index) => (bits & (1 << index)) !== 0));
  const SEEDED_DEVICE_OF: Readonly<Record<Slot, string>> = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', 'VIDEO-03': 'CAM-03', 'VIDEO-04': 'CAM-04', 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' }; // D60, D61

  it("each of the 256 selectors of eight slots (D60, D61 of 2026-11-04): exactly the lines of the assigned slots, each on ITS track or channel, and the slice is the contract's", () => {
    for (const unassigned of SUBSETS) {
      const slice = captureConfigSliceOf(rowWithout(unassigned), seededDevices, false);
      const assigned = SLOTS.filter((slot) => !unassigned.includes(slot));
      expect(slice.cameras.map((camera) => [camera.trackId, camera.deviceId]), unassigned.join('+')).toEqual(assigned.filter((slot) => slot.startsWith('VIDEO')).map((slot) => [slot, SEEDED_DEVICE_OF[slot]]));
      expect(slice.mics.map((mic) => [mic.channel, mic.deviceId, mic.inputId]), unassigned.join('+')).toEqual(assigned.filter((slot) => !slot.startsWith('VIDEO')).map((slot) => [slot, SEEDED_DEVICE_OF[slot], SEEDED_DEVICE_OF[slot]])); // D61: the slot of a mic line is its CHANNEL
      expect(slice.updatedAt).toBe(seededConfig.updatedAt);
      // No line with an empty device, and no member that reads "null": an unassigned slot is ABSENT.
      expect(JSON.stringify(slice)).not.toMatch(/null|""/);
    }
    // CONTROL: the complete row is the first of the 64 and answers what it answered before this row.
    expect(SUBSETS[0]).toEqual([]);
    expect(captureConfigSliceOf(rowWithout([]), seededDevices, false)).toEqual(captureConfigSliceOf(seededConfig, seededDevices, false));
  });

  it('AD-04 (2), nothing by position: only VIDEO-02 and only the MIC-03 channel answer those two lines - VIDEO-02 is not read as the first track, channel 3 not as channel 1 (D61)', () => {
    const slice = captureConfigSliceOf(rowWithout(['VIDEO-01', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-04']), seededDevices, true); // D60, D61: eight slots - leave exactly VIDEO-02 and MIC-03 assigned
    expect(slice.cameras).toEqual([{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25', online: true, streamState: 'LIVE' }]);
    expect(slice.mics).toEqual([{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-03', transport: 'USB', online: true }]);
    expect(slice.locked).toBe(true);
    // The mirror image, and a lone channel 1 that is the SECOND input: the channel is the column's, never the input's place.
    const mirror = captureConfigSliceOf({ ...rowWithout(['VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-02', 'MIC-03', 'MIC-04']), mic01Id: 'MIC-02' }, seededDevices, false); // D60, D61
    expect(mirror.cameras.map((camera) => camera.trackId)).toEqual(['VIDEO-01']);
    expect(mirror.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-02', 'MIC-01']]);
  });

  it('a row of twelve NULLs is two empty lists (D60 four video pairs; D61, 2026-11-04: four mic channels): NOT the built-in baseline (that is a table without a row), and it invents no device', () => {
    const empty = captureConfigSliceOf(rowWithout(SLOTS), seededDevices, false);
    expect(empty).toEqual({ cameras: [], mics: [], locked: false, updatedAt: seededConfig.updatedAt });
    expect(empty).not.toEqual(baselineCaptureConfig(false));
    // An empty registry beside it changes nothing: no line is made up from the built-in five.
    expect(captureConfigSliceOf(rowWithout(SLOTS), [], false)).toEqual(empty);
  });

  it('GATE CONDITION AD-04: the store loads, and the boot step `capture.config` passes, on a selector row of twelve NULLs (D60, D61) - in the form the load statement gives it (JSON nulls)', async () => {
    const nulls = JSON.parse(JSON.stringify(rowWithout(SLOTS))) as Record<string, unknown>; // D60: four video pairs; D61: four mic channels
    expect(Object.entries(nulls).filter(([, value]) => value === null).map(([member]) => member).sort()).toEqual(['mic01Id', 'mic02Id', 'mic03Id', 'mic04Id', 'video01DeviceId', 'video01Profile', 'video02DeviceId', 'video02Profile', 'video03DeviceId', 'video03Profile', 'video04DeviceId', 'video04Profile']);
    const store = createCaptureConfigStore();
    const sinks = silentSinks();
    await runCaptureConfigBoot(store, readerReturning({ config: nulls, devices: seededDevices, session_open: false }), sinks);
    // No warn, no error, nothing in the persistent error log: an unassigned selector is not a fault of the boot.
    expect(sinks.lines).toEqual([]);
    const snapshot = store.snapshot();
    expect(snapshot.captureConfig).toEqual({ cameras: [], mics: [], locked: false, updatedAt: seededConfig.updatedAt });
    expect([snapshot.builtInBaseline, snapshot.revision, snapshot.locked]).toEqual([false, 1, false]);
    expect(snapshot.captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH']); // D60: four cameras; D61: four microphones - nine built-ins

    // Every one of the 256 loads, and a member the aggregate left out reads as the same "nothing assigned".
    for (const unassigned of SUBSETS) {
      const loaded = await createCaptureConfigStore().load(readerReturning({ config: rowWithout(unassigned), devices: seededDevices, session_open: false }));
      expect(loaded.captureConfig.cameras.length + loaded.captureConfig.mics.length, unassigned.join('+')).toBe(8 - unassigned.length); // D60, D61: eight slots
    }
    const { mic04Id: _left, ...withoutMember } = seededConfig; // D61: a channel the aggregate left out is an unassigned channel
    expect((await createCaptureConfigStore().load(readerReturning({ config: withoutMember, devices: seededDevices, session_open: false }))).captureConfig.mics.map((mic) => mic.channel)).toEqual(['MIC-01', 'MIC-02', 'MIC-03']);
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
    expect(await refusalOfLoad({ ...rowWithout(['MIC-01']), mic02Id: 'POE-SWITCH' })).toEqual(['CAPTURE_MIC_INPUT_UNKNOWN', { deviceId: 'POE-SWITCH' }]); // D61: any channel of the four
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
        // D60 (2026-11-04): the two further built-in lines ride along untouched.
        ['VIDEO-03', 'CAM-03', true, 'LIVE'],
        ['VIDEO-04', 'CAM-04', true, 'LIVE'],
      ]);
      const entries = captureDevicesSliceOf(devices).devices.filter((device) => device.kind === 'CAMERA');
      expect(entries.map((device) => [device.id, device.online, device.streamState]), `enabled ${enabled}`).toEqual([
        ['CAM-01', enabled, enabled ? 'LIVE' : 'LOST'],
        ['CAM-02', true, 'LIVE'],
        ['CAM-03', true, 'LIVE'], // D60
        ['CAM-04', true, 'LIVE'],
        ['CAM-07', enabled, null],
      ]);
    }
  });
});
