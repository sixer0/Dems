/**
 * The one canonical demo dataset (masterplan/01_specs.md §14.7 "Canonical dataset"; D28/Q7).
 *
 * Synthetic: no real persons or cases (A7). Every date is derived from the sim clock, so the
 * demo is never stale; history sits on the previous two WIB calendar days at office hours.
 * Past sessions, their evidence, and the audit and event rows that describe them all come
 * from the one table below, so every list in the UI tells the same story (04 §9 #12-#18).
 */
import { SessionState, type VideoTrackId } from '../domain';
import {
  EVIDENCE_USED_AT_LOAD_BYTES,
  EVIDENCE_VOLUME_BYTES,
  GB,
  RECORDING_BITRATE_MBPS,
  RECORDING_BYTES_PER_HOUR,
  SYSTEM_VOLUME_BYTES,
} from './constants';
import { formatMmdd, formatSeq, formatYmd, startOfWibDay, wibDayAt, wibDateParts } from './clock';
import type { AuditInput, EventInput } from './events';
import { sha256Hex } from './events';
import {
  DATASET_EXPORT_SEQ,
  DATASET_EXPORTED_EVIDENCE_SEQ,
  DEMO_DEVICE_CERT_SHA256,
  DEMO_TAMPERED_EVIDENCE_SEQ,
  DEMO_TAMPERED_TRACK,
} from './demo-alignment';
import { buildItemIntegrity, EVIDENCE_STATUS_STAGE, neverSealedShape } from './evidence';
import type {
  CustodyEntry,
  DeviceIdentity,
  EpochMs,
  EvidenceItem,
  RecordingProfile,
  SessionHistoryEntry,
  SimOperator,
} from './types';
import {
  EvidenceStatus,
  FaultKind,
  OperatorRole,
  RecordingProfileId,
  SessionOutcome,
  SubjectType,
} from './vocabulary';

// ── Device (§14.7: DEMS-IR-01, "Interview Room 1", v2.4.1, update v2.5.0) ──────────────
export const DEVICE_ID = 'DEMS-IR-01';
export const DEVICE_NAME = 'Interview Room 1';
export const PRODUCT_NAME = 'DEMS Edge Client';
export const SOFTWARE_VERSION = '2.4.1';
export const UPDATE_VERSION = '2.5.0';
export const ROOMS = [DEVICE_NAME] as const;

export const RECORDING_PROFILES: readonly RecordingProfile[] = [
  {
    id: RecordingProfileId.STANDARD_1080P25,
    label: 'Standard (1080p / 25 fps)',
    resolution: '1080p',
    fps: 25,
    codec: 'H.264',
    bitrateMbps: RECORDING_BITRATE_MBPS,
  },
];

/** Stable fingerprint text for synthetic keys and certificates (no RNG, no platform crypto). */
export function syntheticFingerprint(label: string, bytes = 16): string {
  const hex = sha256Hex(`dems.synthetic.${label}`).slice(0, bytes * 2).toUpperCase();
  return hex.match(/.{2}/g)?.join(':') ?? hex;
}

export const DEVICE_IDENTITY: DeviceIdentity = {
  serialNumber: 'DEC-2026-IR01-000117',
  hardwareUuid: sha256Hex('dems.synthetic.hardware-uuid')
    .slice(0, 32)
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5'),
  chassisRevision: 'CH-B',
  somPartRevision: 'SOM-A1 rev 1.2',
  audioBoardRevision: 'AUD-2 rev C',
  poeBoardRevision: 'POE-4 rev B',
  powerBoardRevision: 'PWR-1 rev D',
  bspVersion: 'BSP 6.1.57 / DT r3',
  coreSoftwareVersion: SOFTWARE_VERSION,
  tabletAppVersion: SOFTWARE_VERSION,
  tpmModelFirmware: 'TPM 2.0 (fw 7.2.3.1)',
  cameraModelFirmware: 'Dual-lens IP camera DL-2 (fw 3.8.14)',
  provisioningRecordId: 'PRV-2026-0117',
  deviceCertificateId: 'CN=DEMS-IR-01, O=DEMS Demo (synthetic)',
};

/**
 * Display fingerprint of the device certificate: the first 16 bytes of the DEMO certificate's
 * SHA-256, colon-grouped (step 54, SIM-GAP-W1). Pairing shows it in two lines of eight pairs;
 * Security & Audit shows the full 32-byte value (`DEMO_DEVICE_CERT_SHA256`).
 */
export const DEVICE_CERT_FINGERPRINT = colonHex(DEMO_DEVICE_CERT_SHA256.slice(0, 32));

/** `ab12…` → `AB:12:…`. */
export function colonHex(hex: string): string {
  const upper = hex.toUpperCase();
  return upper.match(/.{2}/g)?.join(':') ?? upper;
}

/** `EXP-000031`: export IDs (step 54, SIM-GAP-W47-4). */
export function exportIdFor(seq: number): string {
  return `EXP-${String(seq).padStart(6, '0')}`;
}

/** The dataset's one export (EV 0004 → EXP-000031, step 93's prebuilt package). */
export const DATASET_EXPORT_ID = exportIdFor(DATASET_EXPORT_SEQ);

// ── Operators (§14.7, D25, D28/Q14) ──────────────────────────────────────────────────────
/**
 * Every identity id the software knows. The three first are the identities of the DEMONSTRATION
 * dataset (`OPERATORS`); the two last are the vendor accounts of PT GSP that a FACTORY database
 * holds (`FACTORY_OPERATORS`) and that no demonstration scenario ever acts as. Keeping them in one
 * table is what stops a demonstration row from taking an id a real unit already uses.
 */
export const OPERATOR_IDS = {
  BUDI: 'OPR-001',
  ANDI: 'OPR-002',
  RINA: 'OPR-003',
  // Akun prinsipal PT GSP (vendor) — ditulis OLEH SEED PABRIK (`db:seed --factory`) supaya
  // pre-deliver bisa dijalankan: `root` (SUPERVISOR, satu-satunya peran yang boleh mengatur akun
  // lain) dan `gsp.teknisi` (TECHNICIAN, yang menyusun topologi capture dan menerima pemasangan).
  // Nama `root` dipakai atas permintaan tegas prinsipal; risiko ambiguitas dengan superuser Linux
  // pada baris audit sudah dinyatakan dan diterima. Keduanya lahir TANPA baris kredensial:
  // `operator:set-password` satu-satunya penulis sandi (langkah 2 prosedur §11).
  VENDOR_ROOT: 'OPR-004',
  VENDOR_TEKNISI: 'OPR-005',
} as const;

/** The ids of the demonstration dataset only. A factory database holds none of them. */
export const DEMO_OPERATOR_IDS = {
  BUDI: OPERATOR_IDS.BUDI,
  ANDI: OPERATOR_IDS.ANDI,
  RINA: OPERATOR_IDS.RINA,
} as const;

/** The ids a factory database holds, and nothing else. */
export const FACTORY_OPERATOR_IDS = {
  VENDOR_ROOT: OPERATOR_IDS.VENDOR_ROOT,
  VENDOR_TEKNISI: OPERATOR_IDS.VENDOR_TEKNISI,
} as const;

export const OPERATORS: readonly SimOperator[] = [
  {
    id: OPERATOR_IDS.BUDI,
    username: 'budi.santoso',
    rank: 'AKP',
    name: 'Budi Santoso',
    displayName: 'AKP Budi Santoso',
    initials: 'BS',
    role: OperatorRole.INVESTIGATOR,
  },
  {
    id: OPERATOR_IDS.ANDI,
    username: 'andi.pratama',
    rank: 'AKP',
    name: 'Andi Pratama',
    displayName: 'AKP Andi Pratama',
    initials: 'AP',
    role: OperatorRole.SUPERVISOR,
  },
  {
    id: OPERATOR_IDS.RINA,
    username: 'rina.wijaya',
    rank: null,
    name: 'Rina Wijaya',
    displayName: 'Rina Wijaya',
    initials: 'RW',
    role: OperatorRole.TECHNICIAN,
  },
];

/**
 * The identities of the FACTORY database (PT GSP, ruling of 30 Oct 2026): the two vendor accounts a
 * unit leaving the workshop holds, and the ONLY identities `db:seed --factory` writes. They are not
 * members of `OPERATORS`: a demonstration identity has no place on a delivered unit, and a factory
 * account has no place in a demonstration scenario — the mistake of 30 Oct was to answer the second
 * sentence by making a vendor actor sign demonstration evidence, which forges the vendor's hand on a
 * row that is not theirs. Their credential rows are written by nobody: `operator:set-password` is.
 */
export const FACTORY_OPERATORS: readonly SimOperator[] = [
  {
    id: OPERATOR_IDS.VENDOR_ROOT,
    username: 'root',
    rank: null,
    name: 'Vendor Root PT GSP',
    displayName: 'PT GSP (root)',
    initials: 'GR',
    role: OperatorRole.SUPERVISOR,
  },
  {
    id: OPERATOR_IDS.VENDOR_TEKNISI,
    username: 'gsp.teknisi',
    rank: null,
    name: 'Teknisi PT GSP',
    displayName: 'PT GSP (teknisi)',
    initials: 'GT',
    role: OperatorRole.TECHNICIAN,
  },
];

/** Every identity the software names: the demonstration dataset and the two factory accounts. */
export const ALL_OPERATORS: readonly SimOperator[] = [...OPERATORS, ...FACTORY_OPERATORS];

/**
 * Demo password for all three operators. Shown only in the Login "Demo operators"
 * disclosure; never written to state, events, audit rows or storage (§14.8, §20.1).
 */
export const DEMO_OPERATOR_PASSWORD = 'demo-2026';
/** The security-key sign-in (D28/Q15) signs in as the SUPERVISOR operator. */
export const SECURITY_KEY_OPERATOR_ID = OPERATOR_IDS.ANDI;
/** Demo pairing code (04 §4.2): shown only in the demo disclosure, hidden in presentation mode. */
export const DEMO_PAIRING_CODE = '482913';

// ── Network and time (§14.7) ─────────────────────────────────────────────────────────────
export const NETWORK = {
  ip: '192.168.10.21',
  lanName: 'Interview LAN',
  gateway: '192.168.10.1',
  ntpServer: '192.168.10.1',
} as const;

/**
 * The 17 Core services: the 16 of book §6.1, names verbatim (research/01_explore.md §6.1), then the
 * transcriber service of task 3 (register row SH-09). The transcriber is last, so `SVC-01` … `SVC-16`
 * keep their names and it is `SVC-17`.
 */
export const CORE_SERVICES = [
  'API Gateway',
  'Authentication Service',
  'Session Manager',
  'Video Management Service',
  'Recording Engine',
  'Audio Capture Service',
  'AV Synchronization',
  'Metadata Manager',
  'Time Service',
  'Storage Manager',
  'Security Manager',
  'Evidence Manager',
  'Relay/GPIO Service',
  'LCD Display Service',
  'Health Monitor',
  'Audit Service',
  'Transcription Service',
] as const;

// ── Storage (D28/Q1: 804 GB of 4.0 TB used = 20%, 3.2 TB free) ──────────────────────────
export const STORAGE_AT_LOAD = {
  evidenceTotalBytes: EVIDENCE_VOLUME_BYTES,
  evidenceUsedBytes: EVIDENCE_USED_AT_LOAD_BYTES,
  systemTotalBytes: SYSTEM_VOLUME_BYTES,
  systemUsedBytes: 212 * GB,
} as const;

// ── ID formats (01 G10: the book fixes none) ─────────────────────────────────────────────
export function sessionIdFor(seq: number, at: EpochMs): string {
  return `SES-${formatYmd(at)}-${formatSeq(seq)}`;
}
export function caseNumberFor(seq: number, at: EpochMs): string {
  return `LP/${wibDateParts(at).year}/${formatMmdd(at)}-${formatSeq(seq)}`;
}
export function evidenceIdFor(seq: number, at: EpochMs): string {
  return `EV-${formatYmd(at)}-${formatSeq(seq)}`;
}

/** Bytes a recording of `durationMs` occupies (8.2 GB/h). */
export function recordingBytes(durationMs: number): number {
  return Math.round((durationMs / 3_600_000) * RECORDING_BYTES_PER_HOUR);
}

// ── The recording scenario session (§14.7 "Recording scenario session") ─────────────────
// Step 32 (D54 b): the seven follow-up sessions sealed today take sessions 0017-0023, so the
// recording scenario is session 0024. Its case stays LP/{YYYY}/{MMDD}-0007 (a new case; the
// follow-ups belong to the existing cases 0001-0006).
export const RECORDING_SCENARIO = {
  sessionSeq: 24,
  caseSeq: 7,
  subjectName: 'Ahmad Fauzi',
  subjectType: SubjectType.TERSANGKA,
  investigatorId: OPERATOR_IDS.BUDI,
  room: DEVICE_NAME,
  profileId: RecordingProfileId.STANDARD_1080P25,
  /** 00:18:42 elapsed at load. */
  elapsedMs: (18 * 60 + 42) * 1_000,
} as const;

/** Counters for a fresh idle store: the next session is 0024, the next evidence 0014, and the Scan helper offers case 0008. */
export const IDLE_COUNTERS = {
  session: 24,
  caseNumber: 8,
  evidence: 14,
} as const;

// ── Evidence history ──────────────────────────────────────────────────────────────────────
// Previous two WIB days (step 31, unchanged; steps 92/93 join on these suffixes): 6 items,
// 3 SEALED, 1 RECORDED, 1 EXPORTED, 1 UNDER_REVIEW. EV-…-0004 is the exported item (MB 5).
// The RECORDED item belongs to the one INCOMPLETE session (power fail, recovered, never
// sealed: SYS-008).
// Today (step 32, D54 b): 7 follow-up interviews in the existing cases, all SEALED, spread
// over the hours before the sim clock's `now`, so Sealed Today reads 7 and "1 pending" holds.
interface HistorySeed {
  seq: number;
  sessionSeq: number;
  daysAgo: 1 | 2;
  hour: number;
  minute: number;
  durationMin: number;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  status: EvidenceStatus;
  outcome: SessionOutcome;
  stopReason: string;
}

/** A follow-up interview sealed today; its times come from `todaySchedule(now)`. */
interface TodaySeed {
  seq: number;
  sessionSeq: number;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  stopReason: string;
  /** The previous-day evidence seq whose case this interview continues. */
  caseOf: number;
}

export const EVIDENCE_HISTORY: readonly HistorySeed[] = [
  {
    seq: 1,
    sessionSeq: 11,
    daysAgo: 2,
    hour: 9,
    minute: 15,
    durationMin: 42,
    subjectName: 'Siti Rahma',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.BUDI,
    status: EvidenceStatus.SEALED,
    outcome: SessionOutcome.SEALED,
    stopReason: 'Interview completed',
  },
  {
    seq: 2,
    sessionSeq: 12,
    daysAgo: 2,
    hour: 13,
    minute: 40,
    durationMin: 55,
    subjectName: 'Budi Hartono',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.ANDI,
    status: EvidenceStatus.SEALED,
    outcome: SessionOutcome.SEALED,
    stopReason: 'Interview completed',
  },
  {
    seq: 3,
    sessionSeq: 13,
    daysAgo: 1,
    hour: 8,
    minute: 50,
    durationMin: 68,
    subjectName: 'Rudi Setiawan',
    subjectType: SubjectType.TERSANGKA,
    investigatorId: OPERATOR_IDS.BUDI,
    status: EvidenceStatus.UNDER_REVIEW,
    outcome: SessionOutcome.SEALED,
    stopReason: 'Examination concluded',
  },
  {
    seq: 4,
    sessionSeq: 14,
    daysAgo: 1,
    hour: 10,
    minute: 35,
    durationMin: 37,
    subjectName: 'Maya Lestari',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.BUDI,
    status: EvidenceStatus.EXPORTED,
    outcome: SessionOutcome.SEALED,
    stopReason: 'Interview completed',
  },
  {
    seq: 5,
    sessionSeq: 15,
    daysAgo: 1,
    hour: 13,
    minute: 20,
    durationMin: 29,
    subjectName: 'Dewi Anggraini',
    subjectType: SubjectType.LAINNYA,
    investigatorId: OPERATOR_IDS.ANDI,
    status: EvidenceStatus.SEALED,
    outcome: SessionOutcome.SEALED,
    stopReason: 'Statement recorded',
  },
  {
    seq: 6,
    sessionSeq: 16,
    daysAgo: 1,
    hour: 15,
    minute: 45,
    durationMin: 24,
    subjectName: 'Hendra Wijaya',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.BUDI,
    status: EvidenceStatus.RECORDED,
    outcome: SessionOutcome.INCOMPLETE,
    stopReason: '',
  },
];


/** Seven follow-up interviews sealed today (D54 b), oldest first, all in existing cases. */
export const TODAY_HISTORY: readonly TodaySeed[] = [
  {
    seq: 7,
    sessionSeq: 17,
    subjectName: 'Rahmat Hidayat',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.BUDI,
    stopReason: 'Interview completed',
    caseOf: 3,
  },
  {
    seq: 8,
    sessionSeq: 18,
    subjectName: 'Nur Aini',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.ANDI,
    stopReason: 'Statement recorded',
    caseOf: 1,
  },
  {
    seq: 9,
    sessionSeq: 19,
    subjectName: 'Yusuf Pratomo',
    subjectType: SubjectType.TERSANGKA,
    investigatorId: OPERATOR_IDS.BUDI,
    stopReason: 'Examination concluded',
    caseOf: 3,
  },
  {
    seq: 10,
    sessionSeq: 20,
    subjectName: 'Sri Wahyuni',
    subjectType: SubjectType.LAINNYA,
    investigatorId: OPERATOR_IDS.ANDI,
    stopReason: 'Statement recorded',
    caseOf: 5,
  },
  {
    seq: 11,
    sessionSeq: 21,
    subjectName: 'Fajar Nugroho',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.BUDI,
    stopReason: 'Interview completed',
    caseOf: 2,
  },
  {
    seq: 12,
    sessionSeq: 22,
    subjectName: 'Indah Permata',
    subjectType: SubjectType.SAKSI,
    investigatorId: OPERATOR_IDS.ANDI,
    stopReason: 'Interview completed',
    caseOf: 4,
  },
  {
    seq: 13,
    sessionSeq: 23,
    subjectName: 'Wahyu Saputra',
    subjectType: SubjectType.TERSANGKA,
    investigatorId: OPERATOR_IDS.BUDI,
    stopReason: 'Examination concluded',
    caseOf: 6,
  },
];

export function operatorName(operatorId: string | null): string {
  return ALL_OPERATORS.find((operator) => operator.id === operatorId)?.displayName ?? 'System';
}

const MINUTE_MS = 60_000;
/** Seal completes this long after the recording ends (the dataset's finalization time). */
export const HISTORY_SEAL_DELAY_MS = 9_000;
/** The newest of today's sessions ends this long before `now`, leaving room for the recording scenario. */
const TODAY_LATEST_END_BEFORE_NOW_MS = 25 * MINUTE_MS;
/** Each of today's recordings fills this share of its slot (fixed, so the schedule depends on `now` only). */
const TODAY_DURATION_SHARE = [0.72, 0.6, 0.78, 0.66, 0.58, 0.75, 0.68] as const;

export interface HistoryTimes {
  createdAt: EpochMs;
  startedAt: EpochMs;
  endedAt: EpochMs;
}

function floorSecond(ms: number): number {
  return Math.floor(ms / 1_000) * 1_000;
}

/**
 * Times of today's follow-up sessions (oldest first), derived from `now` alone.
 * - The newest ends 25 min before `now`; each earlier one sits one slot further back.
 * - Office hours first: slots between 07:00 WIB and that end, when each slot gets ≥ 20 min.
 *   Otherwise (an early-morning demo) the slots spread from 00:30 WIB instead.
 * - Slots are 20-70 min; a recording fills 58-78% of its slot, created 90 s before its start.
 * - Before about 02:50 WIB the oldest slots fall on the previous day, so Sealed Today is
 *   lower than 7 there (documented edge case).
 */
export function todaySchedule(now: EpochMs, count: number = TODAY_HISTORY.length): HistoryTimes[] {
  const dayStart = startOfWibDay(now);
  const latestEnd = now - TODAY_LATEST_END_BEFORE_NOW_MS;
  let slot = (latestEnd - (dayStart + 7 * 60 * MINUTE_MS)) / count;
  if (slot < 20 * MINUTE_MS) slot = (latestEnd - (dayStart + 30 * MINUTE_MS)) / count;
  slot = Math.min(70 * MINUTE_MS, Math.max(20 * MINUTE_MS, slot));
  const times: HistoryTimes[] = [];
  for (let index = 0; index < count; index += 1) {
    const endedAt = floorSecond(latestEnd - (count - 1 - index) * slot);
    const share = TODAY_DURATION_SHARE[index % TODAY_DURATION_SHARE.length] ?? 0.6;
    const startedAt = endedAt - floorSecond(slot * share);
    times.push({ createdAt: startedAt - 90_000, startedAt, endedAt });
  }
  return times;
}

/** When the Core booted today: before the first of today's sessions, and at least 45 min before `now`. */
export function bootTimeFor(now: EpochMs): EpochMs {
  const first = todaySchedule(now)[0];
  const beforeFirst = first ? first.createdAt - 32 * MINUTE_MS : now;
  return floorSecond(Math.min(now - 45 * MINUTE_MS, beforeFirst));
}

/** A timestamped audit or event input, before it is appended in time order. */
export interface SeedRow {
  at: EpochMs;
  audit?: AuditInput;
  event?: EventInput;
}

export interface HistoryBuild {
  evidence: EvidenceItem[];
  sessionHistory: SessionHistoryEntry[];
  /** Rows describing the history, sorted by time. */
  rows: SeedRow[];
  /** Today's boot (SYSTEM_BOOT row). */
  bootAt: EpochMs;
}

/** One history item with its times resolved. */
interface PlacedSeed {
  seq: number;
  sessionSeq: number;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  status: EvidenceStatus;
  outcome: SessionOutcome;
  stopReason: string;
  times: HistoryTimes;
  /** How long before creation the operator signed in. */
  signInLeadMs: number;
  /** The case number, fixed by the item that opened the case. */
  caseNumber: string;
}

function placeHistory(now: EpochMs): PlacedSeed[] {
  const placed: PlacedSeed[] = EVIDENCE_HISTORY.map((seed) => {
    const createdAt = wibDayAt(now, seed.daysAgo, seed.hour, seed.minute);
    const startedAt = createdAt + 2 * MINUTE_MS;
    return {
      seq: seed.seq,
      sessionSeq: seed.sessionSeq,
      subjectName: seed.subjectName,
      subjectType: seed.subjectType,
      investigatorId: seed.investigatorId,
      status: seed.status,
      outcome: seed.outcome,
      stopReason: seed.stopReason,
      times: { createdAt, startedAt, endedAt: startedAt + seed.durationMin * MINUTE_MS },
      signInLeadMs: 8 * MINUTE_MS,
      caseNumber: caseNumberFor(seed.seq, createdAt),
    };
  });
  const caseBySeq = new Map(placed.map((item) => [item.seq, item.caseNumber]));
  const schedule = todaySchedule(now);
  TODAY_HISTORY.forEach((seed, index) => {
    const times = schedule[index];
    if (!times) return;
    placed.push({
      seq: seed.seq,
      sessionSeq: seed.sessionSeq,
      subjectName: seed.subjectName,
      subjectType: seed.subjectType,
      investigatorId: seed.investigatorId,
      status: EvidenceStatus.SEALED,
      outcome: SessionOutcome.SEALED,
      stopReason: seed.stopReason,
      times,
      signInLeadMs: 2 * MINUTE_MS,
      caseNumber: caseBySeq.get(seed.caseOf) ?? caseNumberFor(seed.seq, times.createdAt),
    });
  });
  return placed;
}

/** Builds the evidence history, the session history and their audit and event rows for `now`. */
export function buildHistory(now: EpochMs): HistoryBuild {
  const evidence: EvidenceItem[] = [];
  const sessionHistory: SessionHistoryEntry[] = [];
  const rows: SeedRow[] = [];
  const reviewerId = OPERATOR_IDS.ANDI;

  for (const seed of placeHistory(now)) {
    const { createdAt, startedAt, endedAt } = seed.times;
    const durationMs = endedAt - startedAt;
    const sizeBytes = recordingBytes(durationMs);
    const sessionId = sessionIdFor(seed.sessionSeq, createdAt);
    const evidenceId = evidenceIdFor(seed.seq, createdAt);
    const caseNumber = seed.caseNumber;
    const incomplete = seed.outcome === SessionOutcome.INCOMPLETE;
    const sealedAt = incomplete ? null : endedAt + HISTORY_SEAL_DELAY_MS;
    // Step 54 (review 40 §5.c): the DEMO package's sealed hashes when one joins (all 13 do).
    const integrity = buildItemIntegrity({
      evidenceId,
      sessionId,
      caseNumber,
      recordedAt: startedAt,
      endedAt,
      sizeBytes,
      subjectName: seed.subjectName,
    });
    // EV 0005: its stored AUDIO-02 was altered after sealing (step 93's TAMPERED package, D50).
    const tampered = seed.seq === DEMO_TAMPERED_EVIDENCE_SEQ;
    const actor = seed.investigatorId;
    const custody: CustodyEntry[] = [
      { at: startedAt, action: 'RECORDING_STARTED', actorId: actor, detail: null },
      incomplete
        ? { at: endedAt, action: 'SESSION_INCOMPLETE', actorId: null, detail: 'Power fail; recovered' }
        : { at: sealedAt ?? endedAt, action: 'SEALED', actorId: null, detail: null },
    ];

    rows.push(
      {
        at: createdAt - seed.signInLeadMs,
        audit: {
          type: 'AUTH_SUCCESS',
          message: `Operator signed in (${operatorName(actor)})`,
          actorId: actor,
          details: { method: 'PASSWORD' },
        },
        event: {
          type: 'AUTH_LOGIN',
          message: `${operatorName(actor)} signed in`,
          params: { operatorId: actor },
        },
      },
      {
        at: createdAt,
        audit: {
          type: 'SESSION_CREATED',
          message: `Session ${sessionId} created`,
          actorId: actor,
          sessionId,
          details: { caseNumber },
        },
        event: {
          type: 'SESSION_CREATED',
          message: `Session ${sessionId} created`,
          sessionId,
        },
      },
      {
        at: startedAt - 30_000,
        audit: {
          type: 'PRECHECK_PASSED',
          message: 'Pre-recording checks passed',
          actorId: actor,
          sessionId,
        },
      },
      {
        at: startedAt,
        audit: {
          type: 'RECORDING_STARTED',
          message: `Recording started (${sessionId})`,
          actorId: actor,
          sessionId,
        },
        event: {
          type: 'RECORDING_STARTED',
          message: `Recording started · ${sessionId}`,
          severity: 'SUCCESS',
          sessionId,
        },
      },
    );

    if (incomplete) {
      rows.push(
        {
          at: endedAt,
          audit: {
            type: 'FAULT_RAISED',
            message: 'Power fail detected',
            severity: 'CRITICAL',
            sessionId,
            deviceId: DEVICE_ID,
            details: { kind: FaultKind.POWER_FAIL, fromState: SessionState.RECORDING },
          },
          event: {
            type: 'FAULT_RAISED',
            message: 'Power fail detected — recovery marker written',
            severity: 'CRITICAL',
            sessionId,
            params: { kind: FaultKind.POWER_FAIL },
          },
        },
        {
          at: endedAt + 60_000,
          audit: {
            type: 'RECOVERY_STARTED',
            message: 'Recovery scan started',
            sessionId,
          },
        },
        {
          at: endedAt + 63_000,
          audit: {
            type: 'SESSION_INCOMPLETE',
            message: `Session ${sessionId} marked INCOMPLETE (never sealed)`,
            severity: 'WARNING',
            sessionId,
            evidenceId,
          },
          event: {
            type: 'SESSION_INCOMPLETE',
            message: `Session ${sessionId} recovered as INCOMPLETE`,
            severity: 'WARNING',
            sessionId,
          },
        },
      );
    } else {
      rows.push(
        {
          at: endedAt,
          audit: {
            type: 'RECORDING_STOPPED',
            message: `Recording stopped (${sessionId})`,
            actorId: actor,
            sessionId,
            details: { reason: seed.stopReason },
          },
        },
        {
          at: sealedAt ?? endedAt,
          audit: {
            type: 'EVIDENCE_SEALED',
            message: `Evidence ${evidenceId} sealed`,
            sessionId,
            evidenceId,
            details: { manifestHash: integrity.manifestHash },
          },
          event: {
            type: 'EVIDENCE_SEALED',
            message: `Evidence sealed · ${evidenceId}`,
            severity: 'SUCCESS',
            sessionId,
            params: { evidenceId },
          },
        },
      );
    }

    if (seed.status === EvidenceStatus.UNDER_REVIEW) {
      const at = endedAt + 2 * 3_600_000;
      custody.push({ at, action: 'REVIEW_OPENED', actorId: reviewerId, detail: null });
      rows.push({
        at,
        audit: {
          type: 'EVIDENCE_REVIEW_OPENED',
          message: `Review opened for ${evidenceId}`,
          actorId: reviewerId,
          evidenceId,
        },
        event: {
          type: 'EVIDENCE_REVIEW',
          message: `Evidence under review · ${evidenceId}`,
          params: { evidenceId },
        },
      });
    }
    if (seed.status === EvidenceStatus.EXPORTED) {
      const at = endedAt + 5 * 3_600_000;
      // EV 0004's export is step 93's prebuilt EXP-000031 (step 54, SIM-GAP-W47-4).
      const exportId = seed.seq === DATASET_EXPORTED_EVIDENCE_SEQ ? DATASET_EXPORT_ID : null;
      custody.push({
        at,
        action: 'EXPORTED',
        actorId: reviewerId,
        detail: 'Case file transfer (simulated)',
      });
      rows.push({
        at,
        audit: {
          type: 'EVIDENCE_EXPORTED',
          message: `Evidence ${evidenceId} exported`,
          actorId: reviewerId,
          evidenceId,
          details: {
            destination: 'Case file transfer (simulated)',
            reason: 'Prosecutor request',
            ...(exportId ? { exportId } : {}),
          },
        },
        event: {
          type: 'EVIDENCE_EXPORTED',
          message: `Evidence exported · ${evidenceId}`,
          params: exportId ? { evidenceId, exportId } : { evidenceId },
        },
      });
    }

    // Fix wave J (truth rule 3a): the seed's one RECORDED item (the INCOMPLETE session) was never sealed -
    // `neverSealedShape` leaves it without a track hash, a manifest or a signature; a sealed item passes unchanged.
    evidence.push(neverSealedShape({
      id: evidenceId,
      sessionId,
      caseNumber,
      subjectName: seed.subjectName,
      subjectType: seed.subjectType,
      investigatorId: seed.investigatorId,
      room: DEVICE_NAME,
      profileId: RecordingProfileId.STANDARD_1080P25,
      recordedAt: startedAt,
      endedAt,
      sealedAt,
      durationMs,
      sizeBytes,
      status: seed.status,
      lifecycleStage: EVIDENCE_STATUS_STAGE[seed.status],
      tracks: integrity.tracks,
      manifestHash: integrity.manifestHash,
      signature: integrity.signature,
      custody,
      verification: { status: 'NOT_RUN', at: null },
      tampered,
      tamperedTrackId: tampered ? DEMO_TAMPERED_TRACK : null,
      caseType: seed.subjectType,
      markers: [],
      notes: [],
      integritySource: integrity.integritySource,
      // The dataset's recordings all ran on GNSS time (the packages' manifests say so).
      startTimeSource: 'GNSS',
      endTimeSource: 'GNSS',
    }));

    sessionHistory.push({
      id: sessionId,
      outcome: seed.outcome,
      caseNumber,
      subjectName: seed.subjectName,
      subjectType: seed.subjectType,
      investigatorId: seed.investigatorId,
      room: DEVICE_NAME,
      profileId: RecordingProfileId.STANDARD_1080P25,
      createdAt,
      startedAt,
      endedAt,
      durationMs,
      sizeBytes,
      evidenceId,
      faultKind: incomplete ? FaultKind.POWER_FAIL : null,
      startTimeSource: 'GNSS',
      endTimeSource: 'GNSS',
    });
  }

  // Today: boot, time sync, health check and the update notice before the first session.
  const bootAt = bootTimeFor(now);
  rows.push(
    {
      at: bootAt,
      audit: {
        type: 'SYSTEM_BOOT',
        message: `${PRODUCT_NAME} v${SOFTWARE_VERSION} started`,
        deviceId: DEVICE_ID,
      },
      event: {
        type: 'SYSTEM_BOOT',
        message: `System started · v${SOFTWARE_VERSION}`,
        deviceId: DEVICE_ID,
      },
    },
    {
      at: bootAt + MINUTE_MS,
      event: {
        type: 'TIME_SYNC',
        message: 'Time synchronized · GNSS stratum 1',
        severity: 'SUCCESS',
        params: { source: 'GNSS' },
      },
    },
    {
      at: bootAt + 2 * MINUTE_MS,
      event: {
        type: 'HEALTH_CHECK_OK',
        message: 'System health check completed',
        severity: 'SUCCESS',
      },
    },
    {
      at: bootAt + 3 * MINUTE_MS,
      event: {
        type: 'UPDATE_AVAILABLE',
        message: `Version ${UPDATE_VERSION} is ready to install`,
        params: { version: UPDATE_VERSION },
      },
    },
  );

  // Stable sort: rows sharing a timestamp keep their build order.
  rows.sort((a, b) => a.at - b.at);
  // Newest first reads better in the Sessions hub; evidence keeps ID order.
  sessionHistory.sort((a, b) => b.endedAt - a.endedAt);
  return { evidence, sessionHistory, rows, bootAt };
}

/**
 * Evidence-volume usage at time `t` for the 24 h history chart: the load value minus every
 * history recording that ended after `t` (a stepped, coherent curve).
 */
export function usedBytesAt(t: EpochMs, loadUsedBytes: number, items: readonly EvidenceItem[]): number {
  let used = loadUsedBytes;
  for (const item of items) if (item.endedAt > t) used -= item.sizeBytes;
  return used;
}

/** Default camera shown in the live feed. */
export const DEFAULT_CAMERA_ID: VideoTrackId = 'VIDEO-01';
