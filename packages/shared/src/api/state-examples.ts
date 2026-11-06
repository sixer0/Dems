/**
 * Example values of the Core state on the wire (backend task: 2026-10-04 01_specs §7.8 to §7.15;
 * plan row W27, contract C). The reads of areas 4 to 11 answer slices and rows of the state, and
 * their examples are built from these values.
 *
 * - **They are the real simulator's.** Every value below is what the shared simulator holds in its
 *   idle state at the example instant (`OPENAPI_EXAMPLE_INSTANT`, 2026-10-01 10:00:00 WIB), copied
 *   here as plain data: `src/api` does not import the simulator. test/api-state-examples.test.ts
 *   builds that state and fails when one of these values differs from it.
 * - **Long series are cut** to their newest `STATE_EXAMPLE_SERIES_POINTS` points (the storage
 *   history, the write-rate history, the time-offset history, the bandwidth history), so the
 *   document stays readable. Nothing else is left out.
 * - **Nothing here is a secret.** The key fingerprints are those of the simulated demo keys, the
 *   serial numbers and addresses are synthetic, and no value has the form of a credential.
 */
import type {
  ActiveCameraIdSliceBody,
  AuditRowBody,
  CamerasSliceBody,
  CaptureConfigSliceBody,
  CaptureDevicesSliceBody,
  DeviceSliceBody,
  DiagnosticsSliceBody,
  EvidenceItemBody,
  MicsSliceBody,
  NetworkSliceBody,
  OtherDevicesSliceBody,
  PortsSliceBody,
  SecuritySliceBody,
  ServicesSliceBody,
  SessionHistoryEntryBody,
  SettingsSliceBody,
  SimAlertBody,
  SimEventBody,
  StoragePolicySliceBody,
  StorageSliceBody,
  TabletLinkSliceBody,
  TimeSliceBody,
  UpdateSliceBody,
} from './state-slices';

/** How many points of a long series an example keeps: the newest ones. */
export const STATE_EXAMPLE_SERIES_POINTS = 2;

/**
 * Identifiers the examples of areas 4 to 11 use. The first three repeat `EXAMPLE_IDS` of
 * `examples.ts` (the canonical dataset); the test holds the two together.
 */
export const STATE_EXAMPLE_IDS = {
  /** The session of the recording scenario. */
  openSessionId: 'SES-20261001-0024',
  /** A well-formed session ID that is not the open session. */
  otherSessionId: 'SES-20261001-0099',
  /** The dataset's exported item: sealed, verified, with a demo package. */
  evidenceId: 'EV-20260930-0004',
  /** The dataset's item whose AUDIO-02 track fails verification. */
  tamperedEvidenceId: 'EV-20260930-0005',
  /** The item of the incomplete session: RECORDED, never sealed. */
  recordedEvidenceId: 'EV-20260930-0006',
  unknownEvidenceId: 'EV-20260930-0099',
  cameraDeviceId: 'CAM-01',
  micDeviceId: 'MIC-02',
  platformDeviceId: 'GNSS',
  unknownDeviceId: 'CAM-09',
  alertId: 'ALR-000001',
  diagnosticsRunId: 'DIAG-000001',
} as const;

/** Slice `device`. */
const DEVICE: DeviceSliceBody = {
  id: 'DEMS-IR-01',
  name: 'Interview Room 1',
  room: 'Interview Room 1',
  productName: 'DEMS Edge Client',
  softwareVersion: '2.4.1',
  identity: {
    serialNumber: 'DEC-2026-IR01-000117',
    hardwareUuid: '157db69a-cc30-5125-a739-14c9bc62a4fd',
    chassisRevision: 'CH-B',
    somPartRevision: 'SOM-A1 rev 1.2',
    audioBoardRevision: 'AUD-2 rev C',
    poeBoardRevision: 'POE-4 rev B',
    powerBoardRevision: 'PWR-1 rev D',
    bspVersion: 'BSP 6.1.57 / DT r3',
    coreSoftwareVersion: '2.4.1',
    tabletAppVersion: '2.4.1',
    tpmModelFirmware: 'TPM 2.0 (fw 7.2.3.1)',
    cameraModelFirmware: 'Dual-lens IP camera DL-2 (fw 3.8.14)',
    provisioningRecordId: 'PRV-2026-0117',
    deviceCertificateId: 'CN=DEMS-IR-01, O=DEMS Demo (synthetic)',
  },
};

/** Slice `tabletLink`. */
const TABLET_LINK: TabletLinkSliceBody = { state: 'CONNECTED', changedAt: 1_790_823_600_000 };

/** Slice `activeCameraId`. */
const ACTIVE_CAMERA_ID: ActiveCameraIdSliceBody = 'VIDEO-01';

/** Slice `cameras`. */
const CAMERAS: CamerasSliceBody = [
  {
    id: 'VIDEO-01',
    deviceId: 'CAM-01',
    name: 'Camera 1',
    room: 'Interview Room 1',
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
    room: 'Interview Room 1',
    lens: 'READY',
    online: true,
    recState: null,
    resolution: '1080p',
    fps: 25,
    codec: 'H.264',
    bitrateMbps: 9,
    poePort: 'POE_CAM_1',
    model: 'Dual-lens IP camera DL-2 (lens 2)',
    firmware: '3.8.14',
  },
  // D60 (2026-11-04): the two further built-in cameras of the four-track capture surface.
  {
    id: 'VIDEO-03',
    deviceId: 'CAM-03',
    name: 'Camera 3',
    room: 'Interview Room 1',
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
    room: 'Interview Room 1',
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
];

/** Slice `mics` (D61, 2026-11-04: FOUR simultaneous channels; `channel` is the selector slot, the numeric meter index and `micRole` are superseded). */
const MICS: MicsSliceBody = [
  {
    id: 'AUDIO-01',
    deviceId: 'MIC-01',
    name: 'MIC 1 – Interviewer',
    role: 'Interviewer',
    channel: 'MIC-01',
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
    channel: 'MIC-02',
    state: 'READY',
    recState: null,
    gainDb: 32,
    phantom: true,
    clipLatched: false,
  },
  {
    id: 'AUDIO-03',
    deviceId: 'MIC-03',
    name: 'MIC 3 – Channel 3', // D61
    role: null,
    channel: 'MIC-03',
    state: 'READY',
    recState: null,
    gainDb: 32,
    phantom: true,
    clipLatched: false,
  },
  {
    id: 'AUDIO-04',
    deviceId: 'MIC-04',
    name: 'MIC 4 – Channel 4', // D61
    role: null,
    channel: 'MIC-04',
    state: 'READY',
    recState: null,
    gainDb: 32,
    phantom: true,
    clipLatched: false,
  },
];

/** Slice `otherDevices`. */
const OTHER_DEVICES: OtherDevicesSliceBody = [
  { id: 'POE-SWITCH', name: 'PoE Switch', online: true, status: '4/4 Ports Active' }, // D60 (2026-11-04): four camera-side PoE ports
  { id: 'REC-INDICATOR', name: 'Recording Indicator', online: true, status: 'Standby' },
  { id: 'TABLET', name: 'Tablet Control', online: true, status: 'CONNECTED' },
];

/** Slice `ports`. */
const PORTS: PortsSliceBody = [
  { id: 'POE_CAM_1', label: 'PoE CAM 1', link: true },
  { id: 'POE_CAM_2_AUX', label: 'PoE CAM 2 / AUX', link: true, spare: true },
  { id: 'POE_CAM_3', label: 'PoE CAM 3', link: true }, // D60 (2026-11-04): the two further camera ports
  { id: 'POE_CAM_4', label: 'PoE CAM 4', link: true }, // D60
  { id: 'MGMT_LAN', label: 'MGMT LAN', link: true },
  { id: 'MIC_IN_1', label: 'MIC IN 1', link: true },
  { id: 'MIC_IN_2', label: 'MIC IN 2', link: true },
  { id: 'MIC_IN_3', label: 'MIC IN 3', link: true }, // D61 (2026-11-04): four microphone channels
  { id: 'MIC_IN_4', label: 'MIC IN 4', link: true }, // D61
  { id: 'GNSS_SMA', label: 'GNSS SMA', link: true },
  { id: 'RELAY_IO', label: 'Relay I/O', link: true },
];

/** Slice `storage`; `history` and `writeRateHistory` are cut. */
const STORAGE: StorageSliceBody = {
  state: 'READY',
  volumes: [
    { id: 'NVME-SYS', kind: 'SYSTEM', label: 'NVMe (system)', totalBytes: 2_000_000_000_000, usedBytes: 212_000_000_000 },
    { id: 'HDD-EVIDENCE', kind: 'EVIDENCE', label: 'HDD (evidence)', totalBytes: 4_000_000_000_000, usedBytes: 804_000_000_000 },
  ],
  writeBytesPerSec: 0,
  bitrateMbps: 18.3,
  history: [{ at: 1_790_820_000_000, usedBytes: 799_674_500_000 }, { at: 1_790_823_600_000, usedBytes: 804_000_000_000 }],
  lastWriteVerifiedAt: null,
  simulatedFillBytes: 0,
  writeRateHistory: [{ at: 1_790_823_598_000, bytesPerSec: 0 }, { at: 1_790_823_599_000, bytesPerSec: 0 }],
};

/** Slice `storagePolicy`. */
const STORAGE_POLICY: StoragePolicySliceBody = { retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true };

/** Slice `time`; `history` is cut. */
const TIME: TimeSliceBody = {
  source: 'GNSS',
  locked: true,
  stratum: 1,
  offsetMs: 3,
  lastSyncAt: 1_790_823_588_000,
  gnss: { locked: true, satellites: 11 },
  ntp: { server: '192.168.10.1', reachable: true, stratum: 2 },
  rtc: { driftPpm: 1.8 },
  history: [{ at: 1_790_823_580_000, offsetMs: 1.3, source: 'GNSS' }, { at: 1_790_823_590_000, offsetMs: 1.8, source: 'GNSS' }],
};

/** Slice `network`; `bandwidth.history` is cut. */
const NETWORK: NetworkSliceBody = {
  ip: '192.168.10.21',
  lanName: 'Interview LAN',
  gateway: '192.168.10.1',
  linkUp: true,
  linkSpeedMbps: 1000,
  // D60 (2026-11-04): three powered camera ports (CAM 1 dual-lens, CAM 3, CAM 4) plus the spare.
  poe: { activePorts: 4, totalPorts: 4, budgetW: 120, drawW: 37.2, poweredPorts: 3, sparePorts: 1 },
  bandwidth: {
    downMbps: 12.4,
    upMbps: 3.1,
    history: [{ at: 1_790_823_598_000, downMbps: 12.2, upMbps: 2.8 }, { at: 1_790_823_599_000, downMbps: 12.1, upMbps: 3.3 }],
  },
  domains: [
    { id: 'CAMERA', vlan: 10, active: true },
    { id: 'MANAGEMENT', vlan: 20, active: true },
    { id: 'SERVICE_UPDATE', vlan: 30, active: false },
    { id: 'EXPORT_TRANSFER', vlan: 40, active: false },
  ],
};

/** Slice `security`. The keys are records of the simulated demo keys, never key material. */
const SECURITY: SecuritySliceBody = {
  state: 'READY',
  posture: 'SECURE',
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
    { id: 'SIGNED_FIRMWARE', label: 'Signed firmware', ok: true, detail: 'v2.4.1' },
  ],
  keys: [
    {
      id: 'DEVICE_CERT',
      label: 'Device certificate (DEMO)',
      algorithm: 'Ed25519',
      fingerprint: '76:0B:E9:29:6D:40:F7:D8:93:20:FD:C6:5F:76:7A:4B:9A:37:88:F4:B6:A5:CA:F8:D4:05:A9:D6:98:A5:77:9A',
      expiresAt: 1_924_991_999_000,
      simulated: true,
      demo: true,
    },
    {
      id: 'EVIDENCE_SIGNING_KEY',
      label: 'Evidence signing key (DEMO-KEY-EVSIGN-01)',
      algorithm: 'Ed25519',
      fingerprint: '0C:AC:09:D5:2F:B7:02:28:75:52:DD:72:AF:4B:62:CF:0B:7C:8F:C3:DA:9D:D8:AE:9D:BE:E7:DA:A1:64:05:C7',
      expiresAt: 1_924_991_999_000,
      simulated: true,
      demo: true,
      keyId: 'DEMO-KEY-EVSIGN-01',
    },
    {
      id: 'TLS_SERVER',
      label: 'TLS server certificate',
      algorithm: 'ECDSA P-256',
      fingerprint: 'CE:C7:40:85:83:0E:6A:FE:E4:FB:7A:EA:B9:19:AE:3C',
      expiresAt: 1_816_743_600_000,
      simulated: true,
    },
  ],
};

/** Slice `services`: the 17 Core services (the 16 of book §6.1 and the transcriber service). */
const SERVICES: ServicesSliceBody = [
  { id: 'SVC-01', name: 'API Gateway', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-02', name: 'Authentication Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-03', name: 'Session Manager', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-04', name: 'Video Management Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-05', name: 'Recording Engine', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-06', name: 'Audio Capture Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-07', name: 'AV Synchronization', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-08', name: 'Metadata Manager', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-09', name: 'Time Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-10', name: 'Storage Manager', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-11', name: 'Security Manager', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-12', name: 'Evidence Manager', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-13', name: 'Relay/GPIO Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-14', name: 'LCD Display Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-15', name: 'Health Monitor', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-16', name: 'Audit Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
  { id: 'SVC-17', name: 'Transcription Service', status: 'RUNNING', startedAt: 1_790_811_162_000 },
];

/** Slice `update`. */
const UPDATE: UpdateSliceBody = {
  currentVersion: '2.4.1',
  availableVersion: '2.5.0',
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
};

/** Slice `diagnostics`: null before the first run. */
const DIAGNOSTICS: DiagnosticsSliceBody = null;

/** Slice `settings`. */
const SETTINGS: SettingsSliceBody = { presentationMode: false, timeFormat: '24', notifyWarnings: true, notifySound: false };

/**
 * Slice 29 `captureConfig` (SH-16; ops 76/78/79/80/89). The idle selector of the seeded topology:
 * four camera lines and the four microphone channels MIC-01..MIC-04 on the built-in microphones
 * (OD-05; D61 of 2026-11-04: four simultaneous channels — the OD-09 primary/standby pair is
 * superseded, channel 1 keeps the transcription duty).
 * `locked` is false because no session is open (OD-10).
 */
const CAPTURE_CONFIG: CaptureConfigSliceBody = {
  cameras: [
    { trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25', online: true, streamState: 'LIVE' },
    { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25', online: true, streamState: 'LIVE' },
    // D60 (2026-11-04): all four video tracks are assigned by default.
    { trackId: 'VIDEO-03', deviceId: 'CAM-03', profile: 'H264_1080P25', online: true, streamState: 'LIVE' },
    { trackId: 'VIDEO-04', deviceId: 'CAM-04', profile: 'H264_1080P25', online: true, streamState: 'LIVE' },
  ],
  mics: [
    // D61 (2026-11-04): the row is keyed by its channel, as a camera row is keyed by its track.
    { channel: 'MIC-01', inputId: 'MIC-01', deviceId: 'MIC-01', transport: 'USB', online: true },
    { channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02', transport: 'USB', online: true },
    { channel: 'MIC-03', inputId: 'MIC-03', deviceId: 'MIC-03', transport: 'USB', online: true },
    { channel: 'MIC-04', inputId: 'MIC-04', deviceId: 'MIC-04', transport: 'USB', online: true },
  ],
  locked: false,
  updatedAt: 1_790_823_600_000,
};

/**
 * Slice 30 `captureDevices` (SH-16, E-04): the nine built-in capture devices of the seeded registry
 * (`dbc-3 §E.3`; D60 of 2026-11-04 widened the seed to four cameras, two microphones, one switch;
 * D61 of 2026-11-04 adds the two further microphones).
 * Hosts are loopback addresses of the fake sources; **no** credential appears here
 * (RK-12) and this slice is not the paired-client registry (E-04).
 */
const CAPTURE_DEVICES: CaptureDevicesSliceBody = {
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
    // D61 (2026-11-04): the two further built-in microphones of the four-channel capture surface.
    {
      id: 'MIC-03',
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
      id: 'MIC-04',
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

/** The slices of the idle state that the reads of areas 6 to 10 answer, by slice name. */
export const EXAMPLE_SLICES = {
  device: DEVICE,
  tabletLink: TABLET_LINK,
  activeCameraId: ACTIVE_CAMERA_ID,
  cameras: CAMERAS,
  mics: MICS,
  otherDevices: OTHER_DEVICES,
  ports: PORTS,
  storage: STORAGE,
  storagePolicy: STORAGE_POLICY,
  time: TIME,
  network: NETWORK,
  security: SECURITY,
  services: SERVICES,
  update: UPDATE,
  diagnostics: DIAGNOSTICS,
  settings: SETTINGS,
  // Task 3 M2-W6 (SH-16): the two capture slices ops 76/77 answer.
  captureConfig: CAPTURE_CONFIG,
  captureDevices: CAPTURE_DEVICES,
} as const;

/** The two newest entries of `sessionHistory` (the slice holds 13; newest first). */
export const EXAMPLE_SESSION_HISTORY: SessionHistoryEntryBody[] = [
  {
    id: 'SES-20261001-0023',
    outcome: 'SEALED',
    caseNumber: 'LP/2026/0930-0006',
    subjectName: 'Wahyu Saputra',
    subjectType: 'TERSANGKA',
    investigatorId: 'OPR-001',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
    createdAt: 1_790_821_107_000,
    startedAt: 1_790_821_197_000,
    endedAt: 1_790_822_100_000,
    durationMs: 903_000,
    sizeBytes: 2_056_833_333,
    evidenceId: 'EV-20261001-0013',
    faultKind: null,
    startTimeSource: 'GNSS',
    endTimeSource: 'GNSS',
  },
  {
    id: 'SES-20261001-0022',
    outcome: 'SEALED',
    caseNumber: 'LP/2026/0930-0004',
    subjectName: 'Indah Permata',
    subjectType: 'SAKSI',
    investigatorId: 'OPR-002',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
    createdAt: 1_790_819_685_000,
    startedAt: 1_790_819_775_000,
    endedAt: 1_790_820_771_000,
    durationMs: 996_000,
    sizeBytes: 2_268_666_667,
    evidenceId: 'EV-20261001-0012',
    faultKind: null,
    startTimeSource: 'GNSS',
    endTimeSource: 'GNSS',
  },
];

/** The evidence item `EV-20260930-0004` of the `evidence` slice: exported by the SUPERVISOR, with its custody chain. */
export const EXAMPLE_EVIDENCE_ITEM: EvidenceItemBody = {
  id: 'EV-20260930-0004',
  sessionId: 'SES-20260930-0014',
  caseNumber: 'LP/2026/0930-0004',
  subjectName: 'Maya Lestari',
  subjectType: 'SAKSI',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
  recordedAt: 1_790_739_420_000,
  endedAt: 1_790_741_640_000,
  sealedAt: 1_790_741_649_000,
  durationMs: 2_220_000,
  sizeBytes: 5_056_666_667,
  status: 'EXPORTED',
  lifecycleStage: 'AUTHORIZED_EXPORT_TRANSFER',
  tracks: [
    {
      trackId: 'VIDEO-01',
      label: 'Camera 1',
      // D60 (2026-11-04): four 1080p tracks at 0.245 of the item each (TRACK_SHARE widened).
      sizeBytes: 1_238_883_333,
      sha256: '8a118ca0627b9a008ee1152edad540be884e5a232eb2515805912da9deb2c04a',
    },
    {
      trackId: 'VIDEO-02',
      label: 'Camera 2',
      sizeBytes: 1_238_883_333,
      sha256: 'a904438e454e860add759306c5de9ced90e05d4e153ed0cf26b8c2909b59dbd9',
    },
    {
      trackId: 'AUDIO-01',
      label: 'MIC 1 – Interviewer',
      // D61 (2026-11-04): four PCM channels share the audio budget - 0.005 of the item each.
      sizeBytes: 25_283_333,
      sha256: 'ad6aa4e1591259a027c832793f8f784d67fd59f0a092937c059de1caa0577c78',
    },
    {
      trackId: 'AUDIO-02',
      label: 'MIC 2 – Subject',
      sizeBytes: 25_283_333, // D61
      sha256: '728b535907b3cb993941be4554b997d1d26a41301cfc7f5cdd977f8dc16aed0d',
    },
  ],
  manifestHash: '403909dc0ed7d1e91bd6bf07ec3bb3c8c6a02c0bc236b465fb93dd780239dee1',
  signature: {
    value: 'ab37d6e1a00eba1699e211dacde76a8aa7912b6027a4e7324662b304e5f730f9',
    keyId: 'KEY-EVSIGN-01',
    algorithm: 'SIMULATED-SHA256',
    simulated: true,
  },
  custody: [
    { at: 1_790_739_420_000, action: 'RECORDING_STARTED', actorId: 'OPR-001', detail: null },
    { at: 1_790_741_649_000, action: 'SEALED', actorId: null, detail: null },
    { at: 1_790_759_640_000, action: 'EXPORTED', actorId: 'OPR-002', detail: 'Case file transfer (simulated)' },
  ],
  verification: { status: 'NOT_RUN', at: null },
  tampered: false,
  tamperedTrackId: null,
  caseType: 'SAKSI',
  markers: [],
  notes: [],
  integritySource: 'DEMO_PACKAGE',
  startTimeSource: 'GNSS',
  endTimeSource: 'GNSS',
};

/** The two newest rows of the audit chain (82 rows at the example instant), with the head and the total. */
export const EXAMPLE_AUDIT: { rows: AuditRowBody[]; head: string; total: number } = {
  rows: [
    {
      seq: 81,
      id: 'AUD-000081',
      at: 1_790_822_100_000,
      type: 'RECORDING_STOPPED',
      category: 'SESSION',
      severity: 'INFO',
      actorId: 'OPR-001',
      message: 'Recording stopped (SES-20261001-0023)',
      sessionId: 'SES-20261001-0023',
      evidenceId: null,
      deviceId: null,
      details: { reason: 'Examination concluded' },
      prevHash: 'ecdc0f0506619fcc18bb6f9d7ace1d8b2d733c4ea0fd79891bac322553c7fbe8',
      hash: '7899890f79b75a706711c638e91c80d3340dafce6cd1086e3f117340247730e7',
    },
    {
      seq: 82,
      id: 'AUD-000082',
      at: 1_790_822_109_000,
      type: 'EVIDENCE_SEALED',
      category: 'EVIDENCE',
      severity: 'INFO',
      actorId: null,
      message: 'Evidence EV-20261001-0013 sealed',
      sessionId: 'SES-20261001-0023',
      evidenceId: 'EV-20261001-0013',
      deviceId: null,
      details: { manifestHash: 'e01badaa8a8bdd7f83f37d8afb4ac6852b678f6e45faf360f05a27d2296ef5df' },
      prevHash: '7899890f79b75a706711c638e91c80d3340dafce6cd1086e3f117340247730e7',
      hash: '90d3ec6022f945ef50e78aa01db2c3e9f50e4f04ded7adef292f3013295a180c',
    },
  ],
  head: '90d3ec6022f945ef50e78aa01db2c3e9f50e4f04ded7adef292f3013295a180c',
  total: 82,
};

/** The two newest operational events (59 at the example instant). */
export const EXAMPLE_EVENTS: SimEventBody[] = [
  {
    id: 'LOG-000058',
    seq: 58,
    at: 1_790_821_197_000,
    type: 'RECORDING_STARTED',
    severity: 'SUCCESS',
    message: 'Recording started · SES-20261001-0023',
    params: {},
    sessionId: 'SES-20261001-0023',
    deviceId: null,
  },
  {
    id: 'LOG-000059',
    seq: 59,
    at: 1_790_822_109_000,
    type: 'EVIDENCE_SEALED',
    severity: 'SUCCESS',
    message: 'Evidence sealed · EV-20261001-0013',
    params: { evidenceId: 'EV-20261001-0013' },
    sessionId: 'SES-20261001-0023',
    deviceId: null,
  },
];

/** The alert the simulator raises for the demo fault MIC_NO_SIGNAL on AUDIO-02 at the example instant. The idle state has none. */
export const EXAMPLE_ALERT: SimAlertBody = {
  id: 'ALR-000001',
  at: 1_790_823_600_000,
  severity: 'WARNING',
  kind: 'MIC_NO_SIGNAL',
  message: 'MIC 2 – Subject: no signal',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: 'AUDIO-02',
  params: { kind: 'MIC_NO_SIGNAL', target: 'AUDIO-02', evt: 'EVT-05/06', eventKind: 'SOURCE_FAULT' },
};
