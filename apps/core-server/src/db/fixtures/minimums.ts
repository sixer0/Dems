/**
 * The minimum row counts of the bulk fixture: the table of database contract §11 (revision 2, 30
 * tables) as revised by dbc-3 §G - the forty tables of the typed schema - as data (plan row W25;
 * BF-5; row-55 CS-20).
 *
 * The numbers are MINIMUMS of the whole table after the load, that is the seeded rows and the
 * fixture's rows together. The loader prints the actual count beside each one, and the tests
 * compare them. `BULK_MIX` holds the required mix of the same table, also as minimums (and one
 * maximum), for the builder and for the tests that count the mix in SQL.
 *
 * Schema v2 (dbc-3 §G, ruling CS-20 of the row-55 review): the six pipeline tables and the three
 * capture rows are bulk-fixture deliverables of M2, not later-milestone leftovers. The builders
 * of `pipeline.ts` synthesise the §G minimums for `session_audio_intervals`, `recording_fragments`,
 * `transcript_chunks`, `transcripts`, `transcript_revisions` and `sealing_jobs`, and the fixture
 * adds the three discovered capture devices and the two fake device credentials; the seed carries
 * the singletons of `capture_config` and `stt_config`. The three revised §G rows are carried as
 * revised: permissions/role_permissions at the seed's 14/22, and `evidence_tracks` at the 1,010
 * floor of exactly-two-per-item - until SH-24 regenerates the v2 evidence dataset through
 * `packages/shared` (outside this row), the fixture still emits the v1 four-track shape the KEPT
 * CHECKs accept (D-DB-05, M2-MT-2), whose 2,060 loaded rows meet the 1,010 floor with margin.
 *
 * Paging facts the numbers are derived from: a page has 50 rows by default and 200 at most; the
 * engine keeps the newest 1,000 audit rows, 500 events and 100 alerts.
 */

export interface TableMinimum {
  /** SQL name of the table. */
  readonly table: string;
  readonly minimum: number;
  /** The required mix, in the contract's words. */
  readonly mix: string;
}

/** The 43 tables in the order of the contract's table: §11 revision 2, revised by dbc-3 §G and dbc-4 §N.10. */
export const BULK_MINIMUMS: readonly TableMinimum[] = Object.freeze([
  { table: 'roles', minimum: 3, mix: 'unchanged' },
  { table: 'permissions', minimum: 14, mix: 'the 14 seeded by schema v2 (dbc-3 §G revised): CAPTURE_CONFIG and TRANSCRIPT_REVISE joined the list' },
  { table: 'role_permissions', minimum: 22, mix: 'all three roles present (dbc-3 §G revised: the seed grants 22)' },
  { table: 'operators', minimum: 12, mix: 'at least 2 enabled SUPERVISOR, at least 2 disabled, every role present' },
  { table: 'operator_credentials', minimum: 12, mix: 'one per operator' },
  {
    table: 'auth_sessions',
    minimum: 300,
    mix: 'at least 30 open (5 bound to a device, 3 BIOMETRIC); at least 5 of each of the 8 end reasons; TOKEN_REUSE only BIOMETRIC with a device',
  },
  { table: 'pairing_codes', minimum: 60, mix: 'at most 1 ACTIVE; at least 40 REDEEMED; at least 5 each of CANCELLED, EXPIRED, EXHAUSTED' },
  { table: 'paired_devices', minimum: 40, mix: 'at least 20 PAIRED, 10 REVOKED, 10 UNPAIRED' },
  { table: 'device_credentials', minimum: 40, mix: 'one per device; at least 5 with a next_hash' },
  { table: 'biometric_tokens', minimum: 80, mix: 'at least 20 live, 30 used, 20 revoked (every reason), 10 past expires_at' },
  { table: 'registry_counters', minimum: 2, mix: 'values above the highest minted number' },
  {
    table: 'audit_log',
    minimum: 5_000,
    mix: 'at least 20 types; all 8 categories; at least 200 rows of one session; at least 100 ACCESS_DENIED; at least 3 actors',
  },
  { table: 'audit_chain_head', minimum: 1, mix: 'seq equals the row count' },
  {
    table: 'audit_chain_history',
    minimum: 25,
    mix: 'reset_no 1 to n without a gap, epoch rising; both reasons 5 times; 5 rows without an actor; 3 scenarios; one row not intact; the newest agrees with one SCENARIO_LOADED row',
  },
  { table: 'events', minimum: 2_500, mix: 'all 10 categories; all 4 severities' },
  { table: 'session_history', minimum: 520, mix: 'at least 500 SEALED and 20 INCOMPLETE; at least 5 without evidence' },
  {
    table: 'evidence_items',
    minimum: 505,
    mix: 'at least 400 SEALED, 40 EXPORTED, 30 ARCHIVED, 20 UNDER_REVIEW, 15 RECORDED; at least 10 tampered; all three case types',
  },
  { table: 'evidence_tracks', minimum: 1_010, mix: 'dbc-3 §G revised: exactly 2 per item once SH-24 lands the v2 dataset; until then the fixture emits the v1 four-track shape the KEPT CHECKs accept (D-DB-05), so its 2,060 loaded rows meet the floor; pipeline.ts carries fragment_count and fragment_chain_head on the two VIDEO rows of the 40 full-chain sessions' },
  { table: 'evidence_custody', minimum: 1_200, mix: 'at least 2 per item' },
  { table: 'exports', minimum: 60, mix: 'at least 40 EVIDENCE, 10 AUDIT, 10 LOGS' },
  { table: 'alerts', minimum: 250, mix: 'at least 10 active, 100 acknowledged; every fault kind' },
  { table: 'health_snapshots', minimum: 1_500, mix: 'at least 1,440 INTERVAL (24 hours at 60 s) and 60 caused by a fault' },
  { table: 'engine_counters', minimum: 6, mix: 'values above the highest minted number; the export row present' },
  { table: 'active_session', minimum: 0, mix: 'a variant flag adds one session in RECORDING with a full 200-item timeline' },
  { table: 'storage_policy', minimum: 1, mix: 'as seeded' },
  { table: 'console_settings', minimum: 1, mix: 'as seeded' },
  { table: 'core_device', minimum: 1, mix: 'as seeded' },
  { table: 'core_state', minimum: 1, mix: 'as seeded; epoch above the highest lineage epoch' },
  { table: 'hardware_snapshot', minimum: 1, mix: 'as seeded' },
  { table: 'schema_meta', minimum: 1, mix: 'as seeded' },
  // Schema v2 (dbc-3 §G): the capture rows (seed plus the fixture's discovered variants) and the
  // six pipeline tables the CS-20 builders of `pipeline.ts` synthesise.
  { table: 'capture_config', minimum: 1, mix: 'seed: the one default singleton' },
  { table: 'capture_devices', minimum: 12, mix: 'dbc-4 §N.10 (revised from 8): 5 built-ins (seed, FAKE); 3 discovered cameras (ONVIF_RTSP, distinct onvif_uuid, at least 1 dual-profile, OD-05); 1 LOCAL_DEVICE camera and 1 LOCAL_DEVICE microphone; 2 USB_AUDIO microphones' },
  { table: 'capture_device_credentials', minimum: 2, mix: "dbc-3 §G: fake devices only (the fixture's discovered cameras, never a built-in); at least 1 rotated (rotated_at later than another row)" },
  { table: 'session_audio_intervals', minimum: 720, mix: "dbc-3 §G: at least 1 per sealed session; at least 150 rows over 50 switched sessions (2-3 intervals, reason 'MANUAL', switched_by non-null); one open interval in the RECORDING variant" },
  { table: 'recording_fragments', minimum: 6_500, mix: 'dbc-3 §G: contiguous full chains for the 40 newest sessions (2 tracks; head equals fragment_chain_head); sampled rows elsewhere; no seq gap anywhere (the gap case is the negative test of M2-MT-3)' },
  { table: 'transcript_chunks', minimum: 2_000, mix: 'dbc-3 §G: contiguous audio ranges; at least 20 FAILED->rerun pairs; at least 95% DONE with segments arrays' },
  { table: 'transcripts', minimum: 400, mix: "dbc-3 §G: one per SEALED; at least 30 labels_status 'UNAVAILABLE'; both labels values present" },
  { table: 'transcript_revisions', minimum: 30, mix: 'dbc-3 §G: at least 5 items with chained revisions (parent_sha256 links); Ed25519-shaped signature' },
  { table: 'sealing_jobs', minimum: 3_000, mix: 'dbc-3 §G: every step of every SEALED session DONE; at least 20 attempt >= 2 with status DONE (resumed via RECOVERY); one RUNNING job in the RECOVERY variant; at least 5 non-null checkpoints' },
  { table: 'stt_config', minimum: 1, mix: 'seed: the one confirmed-default row (row 112, R-8)' },
  // Schema v3 (dbc-4 §N.10): the session-start source record (T-41).
  { table: 'session_capture_sources', minimum: 1_600, mix: 'dbc-4 §N.10: exactly 4 per session that has an interval or a fragment row; at least 20 sessions in the development shape (LOCAL_DEVICE, FAKE, LOCAL_DEVICE, FAKE); at least 20 all-production (ONVIF_RTSP x2, USB_AUDIO x2); the rest all-FAKE; no session mixes a production kind with a development kind; every interval names one of its session\'s two mic rows (MR-S2)' },
  // Schema v5 (erratum PE-129b-01): the per-session STT snapshot (T-42). The fixture builds none
  // (rule S-2: a generator that writes `transcript_chunks` for a REAL session writes its snapshot).
  { table: 'session_stt_config', minimum: 0, mix: 'PE-129b-01: none built; one row per session from the day a generator emits real transcription' },
  // Schema v6 (erratum PE-0013-01): the media store root of a Core (T-43). The fixture builds none:
  // the one row is a fact of a running installation, written by the Core at boot.
  { table: 'core_media_store', minimum: 0, mix: 'PE-0013-01: none built; one row, written by the Core at boot' },
] as const);

/** The required mix as numbers. Every value is a minimum, except `pairingCodes.activeAtMost`. */
export const BULK_MIX = Object.freeze({
  operators: { enabledSupervisors: 2, disabled: 2, roles: 3 },
  authSessions: { open: 30, openDeviceBound: 5, openBiometric: 3, perEndReason: 5, endReasons: 8 },
  pairingCodes: { activeAtMost: 1, redeemed: 40, cancelled: 5, expired: 5, exhausted: 5 },
  pairedDevices: { paired: 20, revoked: 10, unpaired: 10 },
  deviceCredentials: { withNextHash: 5 },
  biometricTokens: { live: 20, used: 30, revoked: 20, revokeReasons: 6, pastExpiry: 10 },
  auditLog: { types: 20, categories: 8, rowsOfOneSession: 200, accessDenied: 100, actors: 3 },
  auditChainHistory: { perReason: 5, withoutActor: 5, scenarios: 3, notIntact: 1 },
  events: { categories: 10, severities: 4 },
  sessionHistory: { sealed: 500, incomplete: 20, withoutEvidence: 5 },
  evidenceItems: { sealed: 400, exported: 40, archived: 30, underReview: 20, recorded: 15, tampered: 10, caseTypes: 3 },
  evidenceTracks: { perItem: 4 },
  evidenceCustody: { perItem: 2 },
  exports: { evidence: 40, audit: 10, logs: 10 },
  // Schema v2: the rotation spans the fourteen FaultKind values (MIC_SILENT, CAPTURE_FAULT);
  // dbc-3 §G adds the MIC_SILENT floor.
  alerts: { active: 10, acknowledged: 100, faultKinds: 14, micSilent: 10 },
  healthSnapshots: { interval: 1_440, fault: 60 },
  activeSessionVariant: { timelineItems: 200 },
  // Schema v2 (dbc-3 §G): the mix of the CS-20 builders in `pipeline.ts`.
  // dbc-4 §N.10: `discovered` counts every row the fixture adds (3 ONVIF cameras, 2 USB
  // microphones, the local camera and the local microphone).
  captureDevices: { builtIn: 5, discovered: 7, onvifCameras: 3, usbAudioMics: 2, localCameras: 1, localMics: 1, dualProfileCameras: 1 },
  sessionCaptureSources: { perSession: 4, developmentSessions: 20, productionSessions: 20 },
  captureDeviceCredentials: { total: 2, rotatedAtLeast: 1 },
  sessionAudioIntervals: { minPerSealed: 1, switchedSessions: 50, manualRows: 150, openInRecordingVariant: 1 },
  recordingFragments: { fullChainSessions: 40, tracksPerChain: 2 },
  transcriptChunks: { failedRerunPairs: 20, doneSegmentsPercent: 95 },
  transcripts: { unavailableLabels: 30, labelsValues: 2 },
  transcriptRevisions: { chainedItems: 5, signatureHexChars: 128 },
  sealingJobs: { resumedAtLeast: 20, checkpointedAtLeast: 5, runningInRecoveryVariant: 1 },
} as const);

export interface MinimumComparison {
  readonly table: string;
  readonly minimum: number;
  /** The row count of the table after the load. */
  readonly loaded: number;
  readonly met: boolean;
}

/** The minimum of one table. */
export function minimumOf(table: string): number {
  const entry = BULK_MINIMUMS.find((candidate) => candidate.table === table);
  if (entry === undefined) throw new RangeError(`no minimum is stated for the table ${table}.`);
  return entry.minimum;
}

/** "entity, minimum, loaded" for all 43 tables, in the contract's order (§11 plus dbc-3 §G). A missing count is 0. */
export function compareWithMinimums(counts: Readonly<Record<string, number>>): MinimumComparison[] {
  return BULK_MINIMUMS.map(({ table, minimum }) => {
    const loaded = counts[table] ?? 0;
    return { table, minimum, loaded, met: loaded >= minimum };
  });
}
