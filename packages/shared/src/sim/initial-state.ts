/**
 * The idle baseline state, built from the canonical dataset for a given `now`
 * (masterplan/01_specs.md §14.7; scenario `idle`, the default after login).
 *
 * Step 32's `scenarios.ts` starts from this baseline for `recording`, `finalizing` and
 * `fault-demo`. Health series start empty; the 1 Hz health subsystem fills them.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
  AUDIO_FLOOR_DBFS,
  AUDIO_NOISE_FLOOR_DBFS,
  RECORDING_BITRATE_MBPS,
  SERIES_POINTS,
  SIM_TZ,
  SIM_TZ_OFFSET_MINUTES,
  STORAGE_HISTORY_POINTS,
} from './constants';
import {
  DEMO_DEVICE_CERT_NOT_AFTER,
  DEMO_DEVICE_CERT_SHA256,
  DEMO_KEY_ALGORITHM,
  DEMO_SIGNING_KEY_ID,
  DEMO_SIGNING_PUBLIC_KEY_HEX,
} from './demo-alignment';
import {
  buildHistory,
  colonHex,
  CORE_SERVICES,
  DEFAULT_CAMERA_ID,
  DEVICE_CERT_FINGERPRINT,
  DEVICE_ID,
  DEVICE_IDENTITY,
  DEVICE_NAME,
  IDLE_COUNTERS,
  NETWORK,
  OPERATORS,
  PRODUCT_NAME,
  SOFTWARE_VERSION,
  STORAGE_AT_LOAD,
  syntheticFingerprint,
  UPDATE_VERSION,
  usedBytesAt,
} from './dataset';
import { appendActivity, emptyAuditLog } from './events';
import { fnv1a } from './rng';
import type {
  AudioFrame,
  AuthSlice,
  BandwidthPoint,
  CaptureConfigSlice,
  CaptureDevicesSlice,
  EpochMs,
  HealthPoint,
  MicLevelPoint,
  SettingsSlice,
  SimState,
  TimeHistoryPoint,
  WriteRatePoint,
} from './types';
import { signedOutAuth } from './auth';
import { PairingState, ScenarioName, SecurityPosture, TabletLinkState } from './vocabulary';

export interface InitialStateInput {
  now: EpochMs;
  seed: number;
  pairing?: PairingState;
  auth?: AuthSlice;
  /**
   * Schema v2 (register SH-05): the capture selector this state starts with. A scenario may pin
   * the device/profile/role choices; the default is `DEFAULT_CAPTURE_CONFIG` below, which matches
   * the seven built-in `capture_devices` rows the v2 seed writes (`dbc-3 §B.2`, §E.3; D60 of
   * 2026-11-04 widened the seed from five rows to seven: four cameras, two microphones, one switch).
   */
  capture?: Partial<CaptureConfigSeed>;
}

/** The selector defaults of the idle baseline (the seeded demo topology, OD-05 dual-lens). */
export interface CaptureConfigSeed {
  config: CaptureConfigSlice;
  devices: CaptureDevicesSlice;
}

/**
 * Media profile code of the seeded 1080p/25 fps H.264 stream (open `CODE` set, OD-06).
 *
 * Erratum RECON-F1 (row 55 §5): the spelling is the canonical underscore `CODE`. C3 §1 requires
 * every machine code to be `SCREAMING_SNAKE_CASE` and dbc-3 §B.1 marks `video_01_profile` /
 * `video_02_profile` as format `CODE`, which the 0004 CHECK `^[A-Z][A-Z0-9_]{0,63}$` enforces - a
 * hyphen is not a `CODE`. The earlier spelling joined the codec to the resolution with a hyphen
 * and was the one non-conforming value on the wire; the state slice and the stored row now hold
 * the same string, so no bridge is needed.
 */
export const CAPTURE_PROFILE_1080P25 = 'H264_1080P25';

/**
 * The built-in capture devices (`dbc-3 §E.3`); hosts are loopback, never a credential URL.
 *
 * D60 (2026-11-04): four simultaneous video tracks need four built-in cameras — the dual-lens pair
 * on PoE CAM 1 and two further single-lens cameras on PoE CAM 3 and CAM 4 (`CAMERA_PORT` of
 * `derive.ts`). Their ids are the next free numbers of the id pattern (`CAM-NN`); a camera the
 * operator adopts through the search now takes `CAM-05`, since the registry mints the highest number
 * plus one (`nextCaptureCameraId`).
 */
export const DEFAULT_CAPTURE_DEVICES: CaptureDevicesSlice = {
  devices: [
    {
      id: 'CAM-01',
      kind: 'CAMERA',
      model: 'Dual-lens IP camera DL-2',
      firmware: '3.8.14',
      host: '127.0.0.1:8554',
      poePort: 'POE_CAM_1',
      online: true,
      streamState: 'LIVE',
      capabilities: ['VIDEO', 'PULL'],
    },
    {
      id: 'CAM-02',
      kind: 'CAMERA',
      model: 'Dual-lens IP camera DL-2',
      firmware: '3.8.14',
      host: '127.0.0.1:8555',
      poePort: 'POE_CAM_1',
      online: true,
      streamState: 'LIVE',
      capabilities: ['VIDEO', 'PULL'],
    },
    // D60 (2026-11-04): the two further built-in cameras of the four-track capture surface.
    {
      id: 'CAM-03',
      kind: 'CAMERA',
      model: 'IP camera IP-3',
      firmware: '3.8.14',
      host: '127.0.0.1:8556',
      poePort: 'POE_CAM_3',
      online: true,
      streamState: 'LIVE',
      capabilities: ['VIDEO', 'PULL'],
    },
    {
      id: 'CAM-04',
      kind: 'CAMERA',
      model: 'IP camera IP-4',
      firmware: '3.8.14',
      host: '127.0.0.1:8557',
      poePort: 'POE_CAM_4',
      online: true,
      streamState: 'LIVE',
      capabilities: ['VIDEO', 'PULL'],
    },
    {
      id: 'MIC-01',
      kind: 'MIC',
      model: 'USB condenser microphone UM-1',
      firmware: '1.04',
      host: null,
      poePort: null,
      online: true,
      streamState: null,
      capabilities: ['AUDIO'],
    },
    {
      id: 'MIC-02',
      kind: 'MIC',
      model: 'USB condenser microphone UM-1',
      firmware: '1.04',
      host: null,
      poePort: null,
      online: true,
      streamState: null,
      capabilities: ['AUDIO'],
    },
    {
      id: 'POE-SWITCH',
      kind: 'POE',
      model: 'PoE+ switch PS-8',
      firmware: '2.4.1',
      host: '127.0.0.1',
      poePort: null,
      online: true,
      streamState: null,
      capabilities: ['SNMP', 'PULL'],
    },
  ],
};

/**
 * The idle selector: FOUR camera lines and MIC-01 primary, MIC-02 hot standby (OD-05/OD-09).
 * D60 (2026-11-04): all four video tracks are assigned by default, so a simulated session records
 * four camera files at once; each line holds the seeded 1080p/25 profile of its camera.
 */
export const DEFAULT_CAPTURE_CONFIG: CaptureConfigSlice = {
  cameras: [
    { trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: CAPTURE_PROFILE_1080P25, online: true, streamState: 'LIVE' },
    { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: CAPTURE_PROFILE_1080P25, online: true, streamState: 'LIVE' },
    { trackId: 'VIDEO-03', deviceId: 'CAM-03', profile: CAPTURE_PROFILE_1080P25, online: true, streamState: 'LIVE' }, // D60
    { trackId: 'VIDEO-04', deviceId: 'CAM-04', profile: CAPTURE_PROFILE_1080P25, online: true, streamState: 'LIVE' }, // D60
  ],
  mics: [
    { inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY', transport: 'USB', online: true },
    { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY', transport: 'USB', online: true },
  ],
  // Idle: nothing is open, so the selector is editable (OD-10).
  locked: false,
  updatedAt: 0,
};

export function silentFrame(at: EpochMs, seq = 0): AudioFrame {
  return { seq, at, dbfs: AUDIO_NOISE_FLOOR_DBFS, peak: AUDIO_NOISE_FLOOR_DBFS, clip: false, noSignal: false };
}

/** A flat −90 frame (NO SIGNAL). */
export function noSignalFrame(at: EpochMs, seq = 0): AudioFrame {
  return { seq, at, dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, clip: false, noSignal: true };
}

/** Default console preferences (step 54). */
export const DEFAULT_SETTINGS: SettingsSlice = {
  presentationMode: false,
  timeFormat: '24',
  notifyWarnings: true,
  notifySound: false,
};

/** The DEMO signing key's fingerprint: SHA-256 of the raw 32-byte public key, colon-grouped (step 54). */
export const DEMO_SIGNING_KEY_FINGERPRINT = colonHex(bytesToHex(sha256(hexToBytes(DEMO_SIGNING_PUBLIC_KEY_HEX))));

/**
 * Deterministic noise in [-1, 1) from a label and an instant (no RNG stream is consumed, so the
 * live streams and AC-51 stay untouched). Used to back-fill the series at load.
 */
export function timeNoise(label: string, at: EpochMs): number {
  return (fnv1a(`${label}:${Math.floor(at)}`) / 4_294_967_296) * 2 - 1;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Series that would have accumulated since today's boot (step 54, SIM-GAP-W50-4): the rings hold
 * 120 points, so the newest 120 samples before `now` are back-filled; every live chart reads
 * full at load instead of "collecting samples". Idle values with seeded-looking jitter.
 */
export function backfillSeries(now: EpochMs, bootAt: EpochMs) {
  const lastSecond = Math.floor(now / 1_000) * 1_000 - 1_000;
  const seconds = Array.from({ length: SERIES_POINTS }, (_, index) => lastSecond - (SERIES_POINTS - 1 - index) * 1_000).filter(
    (at) => at >= bootAt,
  );
  const lastTen = Math.floor(now / 10_000) * 10_000 - 10_000;
  const tens = Array.from({ length: SERIES_POINTS }, (_, index) => lastTen - (SERIES_POINTS - 1 - index) * 10_000).filter(
    (at) => at >= bootAt,
  );
  const health: HealthPoint[] = seconds.map((at) => ({
    at,
    cpuPercent: round1(18 + timeNoise('cpu', at) * 3),
    cpuTempC: round1(52 + timeNoise('cpuT', at) * 0.3),
    storageTempC: round1(38 + timeNoise('hddT', at) * 0.2),
    ambientTempC: round1(27 + timeNoise('ambT', at) * 0.1),
    fanRpm: Math.round(2_400 + timeNoise('fan', at) * 35),
  }));
  const bandwidth: BandwidthPoint[] = seconds.map((at) => ({
    at,
    downMbps: round1(12.4 + timeNoise('down', at) * 0.7),
    upMbps: round1(3.1 + timeNoise('up', at) * 0.3),
  }));
  const time: TimeHistoryPoint[] = tens.map((at) => ({ at, offsetMs: round1(1.6 + timeNoise('offset', at) * 2.2), source: 'GNSS' }));
  const micLevels: MicLevelPoint[] = seconds.map((at) => ({
    at,
    'AUDIO-01': round1(AUDIO_NOISE_FLOOR_DBFS + timeNoise('mic1', at) * 2),
    'AUDIO-02': round1(AUDIO_NOISE_FLOOR_DBFS + timeNoise('mic2', at) * 2),
  }));
  const writeRate: WriteRatePoint[] = seconds.map((at) => ({ at, bytesPerSec: 0 }));
  return { health, bandwidth, time, micLevels, writeRate };
}

export function createIdleState(input: InitialStateInput): SimState {
  const { now, seed } = input;
  const history = buildHistory(now);
  const series = backfillSeries(now, history.bootAt);

  const base: SimState = {
    meta: {
      schemaVersion: 2,
      seed,
      scenario: ScenarioName.IDLE,
      epoch: 0,
      createdAt: now,
      counters: {
        event: 1,
        session: IDLE_COUNTERS.session,
        caseNumber: IDLE_COUNTERS.caseNumber,
        evidence: IDLE_COUNTERS.evidence,
        item: 1,
      },
    },
    clock: { now, tz: SIM_TZ, tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES },
    device: {
      id: DEVICE_ID,
      name: DEVICE_NAME,
      room: DEVICE_NAME,
      productName: PRODUCT_NAME,
      softwareVersion: SOFTWARE_VERSION,
      identity: DEVICE_IDENTITY,
    },
    operators: OPERATORS.map((operator) => ({ ...operator })),
    auth: input.auth ?? signedOutAuth(),
    authLockout: { failures: [], lockedUntil: null },
    pairing: {
      state: input.pairing ?? PairingState.PAIRED,
      coreDeviceId: DEVICE_ID,
      coreName: DEVICE_NAME,
      certificateFingerprint: DEVICE_CERT_FINGERPRINT,
      // Paired shortly after today's boot (step 32: the boot now precedes today's sessions).
      pairedAt: (input.pairing ?? PairingState.PAIRED) === PairingState.PAIRED ? history.bootAt + 4 * 60_000 : null,
      failures: [],
      lockedUntil: null,
    },
    tabletLink: { state: TabletLinkState.CONNECTED, changedAt: now },
    session: null,
    lastSealedSessionId: null,
    lastSealedAcknowledged: true,
    sessionHistory: history.sessionHistory,
    activeCameraId: DEFAULT_CAMERA_ID,
    cameras: [
      {
        id: 'VIDEO-01',
        deviceId: 'CAM-01',
        name: 'Camera 1',
        room: DEVICE_NAME,
        lens: 'READY',
        online: true,
        recState: null,
        resolution: '1080p',
        fps: 25,
        codec: 'H.264',
        bitrateMbps: 9,
        poePort: 'POE_CAM_1',
        model: 'Dual-lens IP camera DL-2 (lens 1)',
        firmware: '3.8.14',
      },
      {
        id: 'VIDEO-02',
        deviceId: 'CAM-02',
        name: 'Camera 2',
        room: DEVICE_NAME,
        lens: 'READY',
        online: true,
        recState: null,
        resolution: '1080p',
        fps: 25,
        codec: 'H.264',
        bitrateMbps: 9,
        // Both lenses of the one dual-lens camera share PoE CAM 1 (design book B.01, §4.2; D79).
        poePort: 'POE_CAM_1',
        model: 'Dual-lens IP camera DL-2 (lens 2)',
        firmware: '3.8.14',
      },
      // D60 (2026-11-04): the two further built-in cameras of the four-track capture surface, each
      // on its own PoE port (`CAMERA_PORT` of `derive.ts`).
      {
        id: 'VIDEO-03',
        deviceId: 'CAM-03',
        name: 'Camera 3',
        room: DEVICE_NAME,
        lens: 'READY',
        online: true,
        recState: null,
        resolution: '1080p',
        fps: 25,
        codec: 'H.264',
        bitrateMbps: 9,
        poePort: 'POE_CAM_3',
        model: 'IP camera IP-3',
        firmware: '3.8.14',
      },
      {
        id: 'VIDEO-04',
        deviceId: 'CAM-04',
        name: 'Camera 4',
        room: DEVICE_NAME,
        lens: 'READY',
        online: true,
        recState: null,
        resolution: '1080p',
        fps: 25,
        codec: 'H.264',
        bitrateMbps: 9,
        poePort: 'POE_CAM_4',
        model: 'IP camera IP-4',
        firmware: '3.8.14',
      },
    ],
    mics: [
      {
        id: 'AUDIO-01',
        deviceId: 'MIC-01',
        name: 'MIC 1 – Interviewer',
        role: 'Interviewer',
        // OD-01 T1 / OD-09: MIC-01 is the primary input inside AUDIO-01, MIC-02 the hot standby.
        micRole: 'PRIMARY',
        channel: 1,
        state: 'READY',
        recState: null,
        gainDb: 32,
        phantom: true,
        clipLatched: false,
      },
      {
        id: 'AUDIO-02',
        deviceId: 'MIC-02',
        name: 'MIC 2 – Subject',
        role: 'Subject',
        micRole: 'STANDBY',
        channel: 2,
        state: 'READY',
        recState: null,
        gainDb: 32,
        phantom: true,
        clipLatched: false,
      },
    ],
    audio: { inputs: { 'MIC-01': silentFrame(now), 'MIC-02': silentFrame(now) }, activeInputId: 'MIC-01' },
    storage: {
      state: 'READY',
      volumes: [
        {
          id: 'NVME-SYS',
          kind: 'SYSTEM',
          label: 'NVMe (system)',
          totalBytes: STORAGE_AT_LOAD.systemTotalBytes,
          usedBytes: STORAGE_AT_LOAD.systemUsedBytes,
        },
        {
          id: 'HDD-EVIDENCE',
          kind: 'EVIDENCE',
          label: 'HDD (evidence)',
          totalBytes: STORAGE_AT_LOAD.evidenceTotalBytes,
          usedBytes: STORAGE_AT_LOAD.evidenceUsedBytes,
        },
      ],
      writeBytesPerSec: 0,
      bitrateMbps: RECORDING_BITRATE_MBPS,
      // Hourly usage over the last 24 h: the load value minus every history recording that
      // ended after each point, so the curve steps up at the real session times (step 32).
      history: Array.from({ length: STORAGE_HISTORY_POINTS }, (_, i) => {
        const at = now - (STORAGE_HISTORY_POINTS - 1 - i) * 3_600_000;
        return { at, usedBytes: usedBytesAt(at, STORAGE_AT_LOAD.evidenceUsedBytes, history.evidence) };
      }),
      lastWriteVerifiedAt: null,
      simulatedFillBytes: 0,
      writeRateHistory: series.writeRate,
    },
    storagePolicy: { retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true },
    time: {
      source: 'GNSS',
      locked: true,
      stratum: 1,
      offsetMs: 3,
      // GNSS disciplines the clock continuously; the health subsystem refreshes this every 16 s.
      lastSyncAt: now - 12_000,
      gnss: { locked: true, satellites: 11 },
      ntp: { server: NETWORK.ntpServer, reachable: true, stratum: 2 },
      rtc: { driftPpm: 1.8 },
      history: series.time,
    },
    network: {
      ip: NETWORK.ip,
      lanName: NETWORK.lanName,
      gateway: NETWORK.gateway,
      linkUp: true,
      linkSpeedMbps: 1_000,
      // Design book §4.2/§8 (D79): PoE CAM 1 powers the dual-lens camera; D60 (2026-11-04) adds
      // CAM 3 and CAM 4 for the two further built-in cameras (4 × 30 W budget). PoE CAM 2/AUX is
      // the spare. All ports are healthy at load.
      poe: { activePorts: 4, totalPorts: 4, budgetW: 120, drawW: 37.2, poweredPorts: 3, sparePorts: 1 },
      bandwidth: { downMbps: 12.4, upMbps: 3.1, history: series.bandwidth },
      domains: [
        { id: 'CAMERA', vlan: 10, active: true },
        { id: 'MANAGEMENT', vlan: 20, active: true },
        { id: 'SERVICE_UPDATE', vlan: 30, active: false },
        { id: 'EXPORT_TRANSFER', vlan: 40, active: false },
      ],
    },
    security: {
      state: 'READY',
      posture: SecurityPosture.SECURE,
      tpm: { model: 'TPM 2.0', ok: true },
      secureBoot: true,
      encryption: 'AES-256-GCM',
      hashAlgorithm: 'SHA-256',
      tamper: false,
      controls: [
        { id: 'TPM', label: 'TPM 2.0', ok: true, detail: 'Attestation OK' },
        { id: 'SECURE_BOOT', label: 'Secure Boot', ok: true, detail: 'Enabled' },
        { id: 'ENCRYPTION', label: 'Evidence encryption', ok: true, detail: 'AES-256-GCM' },
        { id: 'HASH_CHAIN', label: 'Audit hash chain', ok: true, detail: 'SHA-256' },
        { id: 'TAMPER', label: 'Enclosure tamper switch', ok: true, detail: 'Closed' },
        { id: 'SIGNED_FIRMWARE', label: 'Signed firmware', ok: true, detail: `v${SOFTWARE_VERSION}` },
      ],
      keys: [
        // Step 54 (review 40 §5.c, SIM-GAP-W1): the step-93 DEMO certificate and signing key.
        {
          id: 'DEVICE_CERT',
          label: 'Device certificate (DEMO)',
          algorithm: DEMO_KEY_ALGORITHM,
          fingerprint: colonHex(DEMO_DEVICE_CERT_SHA256),
          expiresAt: Date.parse(DEMO_DEVICE_CERT_NOT_AFTER),
          simulated: true,
          demo: true,
        },
        {
          id: 'EVIDENCE_SIGNING_KEY',
          label: `Evidence signing key (${DEMO_SIGNING_KEY_ID})`,
          algorithm: DEMO_KEY_ALGORITHM,
          fingerprint: DEMO_SIGNING_KEY_FINGERPRINT,
          expiresAt: Date.parse(DEMO_DEVICE_CERT_NOT_AFTER),
          simulated: true,
          demo: true,
          keyId: DEMO_SIGNING_KEY_ID,
        },
        {
          id: 'TLS_SERVER',
          label: 'TLS server certificate',
          algorithm: 'ECDSA P-256',
          fingerprint: syntheticFingerprint('tls-server-certificate'),
          expiresAt: now + 300 * 86_400_000,
          simulated: true,
        },
      ],
    },
    services: CORE_SERVICES.map((name, index) => ({
      id: `SVC-${String(index + 1).padStart(2, '0')}`,
      name,
      status: 'RUNNING',
      // Every service started with today's boot (step 54, SIM-GAP-W52-1).
      startedAt: history.bootAt,
    })),
    health: {
      cpuPercent: 18,
      cpuTempC: 52,
      storageTempC: 38,
      ambientTempC: 27,
      fanRpm: 2_400,
      fanOk: true,
      series: series.health,
      micLevels: series.micLevels,
    },
    otherDevices: [
      { id: 'POE-SWITCH', name: 'PoE Switch', online: true, status: '4/4 Ports Active' }, // D60 (2026-11-04): four camera-side PoE ports
      { id: 'REC-INDICATOR', name: 'Recording Indicator', online: true, status: 'Standby' },
      { id: 'TABLET', name: 'Tablet Control', online: true, status: 'CONNECTED' },
    ],
    ports: [
      { id: 'POE_CAM_1', label: 'PoE CAM 1', link: true },
      { id: 'POE_CAM_2_AUX', label: 'PoE CAM 2 / AUX', link: true, spare: true },
      { id: 'POE_CAM_3', label: 'PoE CAM 3', link: true }, // D60 (2026-11-04): the two further camera ports
      { id: 'POE_CAM_4', label: 'PoE CAM 4', link: true }, // D60
      { id: 'MGMT_LAN', label: 'MGMT LAN', link: true },
      { id: 'MIC_IN_1', label: 'MIC IN 1', link: true },
      { id: 'MIC_IN_2', label: 'MIC IN 2', link: true },
      { id: 'GNSS_SMA', label: 'GNSS SMA', link: true },
      { id: 'RELAY_IO', label: 'Relay I/O', link: true },
    ],
    evidence: history.evidence,
    events: [],
    alerts: [],
    audit: emptyAuditLog(),
    faults: { active: [] },
    diagnostics: null,
    update: {
      currentVersion: SOFTWARE_VERSION,
      availableVersion: UPDATE_VERSION,
      activeSlot: 'A',
      state: 'IDLE',
      steps: [
        { id: 'SIGNATURE_VERIFICATION', status: 'pending' },
        { id: 'COMPATIBILITY_CHECK', status: 'pending' },
        { id: 'ANTI_ROLLBACK_POLICY', status: 'pending' },
        { id: 'INSTALL_INACTIVE_SLOT', status: 'pending' },
        { id: 'REBOOT', status: 'pending' },
        { id: 'POST_BOOT_HEALTH_CHECK', status: 'pending' },
      ],
      startedAt: null,
      completedAt: null,
    },
    settings: { ...DEFAULT_SETTINGS },
    // Slice 29 (SH-16): the selector, editable while idle. `updatedAt` is the boot instant of this
    // state; a scenario that pins `capture` overrides any member of the two slices.
    captureConfig: { ...DEFAULT_CAPTURE_CONFIG, updatedAt: now, ...input.capture?.config },
    // Slice 30 (SH-16, E-04): the capture-device registry, its own kind, never the paired clients.
    captureDevices: input.capture?.devices ?? DEFAULT_CAPTURE_DEVICES,
  };

  // Replay the history rows through the real chain, one timestamp at a time.
  let slices = { audit: base.audit, events: base.events, meta: base.meta };
  for (const row of history.rows) {
    slices = appendActivity(slices, row.at, {
      ...(row.audit ? { audit: row.audit } : {}),
      ...(row.event ? { event: row.event } : {}),
    });
  }
  return { ...base, ...slices };
}
