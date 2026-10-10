/**
 * Fixture rows for the database tests of plan row W17 (not a test file).
 *
 * One VALID row per table, written out column by column, in the order of the contract. The
 * tests insert them as `dems_owner` (TI-9: the helper's role, for fixtures only); the code under
 * test and every statement whose privilege matters runs as `dems_app`.
 *
 * Synthetic only: no person's name, no real credential. The "hashes" are SHA-256 of marker
 * texts such as `fixture:session-token`, never of a real secret.
 */
import { randomUUID } from 'node:crypto';
import { auditId, chainHash, type AuditEventBody } from '@dems/shared/sim';
import type { Pool, PoolClient } from 'pg';
import { FIXED_NOW, sha256, sha256Hex } from './support';

export type Row = Record<string, unknown>;
type Runner = Pick<Pool | PoolClient, 'query'>;

export const T = FIXED_NOW;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A `jsonb` value as a bind parameter: the driver would turn a JavaScript array into an array literal. */
export const json = (value: unknown): string => JSON.stringify(value);
export const hash32 = (marker: string): Buffer => sha256(`fixture:${marker}`);
/** A 128-hex-character value (64 raw bytes): the Ed25519 signature shape. */
export const hex128 = (marker: string): string => sha256Hex(`fixture:${marker}`) + sha256Hex(`fixture2:${marker}`);
export const hex64 = (marker: string): string => sha256Hex(`fixture:${marker}`);

/** `INSERT INTO public.<table> (...) VALUES ($1, ...)`. Table and column names are constants of this file. */
export async function insertRow(runner: Runner, table: string, row: Row): Promise<void> {
  const columns = Object.keys(row);
  if (!/^[a-z_]+$/.test(table) || columns.some((column) => !/^[a-z0-9_]+$/.test(column))) {
    throw new Error('insertRow takes plain identifiers');
  }
  await runner.query(
    `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
    Object.values(row),
  );
}

export const ROLES: readonly Row[] = [
  { id: 'INVESTIGATOR', sort_order: 1 },
  { id: 'SUPERVISOR', sort_order: 2 },
  { id: 'TECHNICIAN', sort_order: 3 },
];

export const PERMISSIONS: readonly Row[] = [
  { id: 'SESSION_START', sort_order: 1 },
  { id: 'EVIDENCE_VIEW', sort_order: 2 },
  { id: 'EVIDENCE_EXPORT', sort_order: 3 },
  { id: 'USER_ADMIN', sort_order: 4 },
  { id: 'MAINTENANCE', sort_order: 5 },
];

export const ROLE_PERMISSIONS: readonly Row[] = [
  { role_id: 'INVESTIGATOR', permission_id: 'SESSION_START' },
  { role_id: 'INVESTIGATOR', permission_id: 'EVIDENCE_VIEW' },
  { role_id: 'SUPERVISOR', permission_id: 'SESSION_START' },
  { role_id: 'SUPERVISOR', permission_id: 'EVIDENCE_VIEW' },
  { role_id: 'SUPERVISOR', permission_id: 'EVIDENCE_EXPORT' },
  { role_id: 'SUPERVISOR', permission_id: 'USER_ADMIN' },
  { role_id: 'TECHNICIAN', permission_id: 'MAINTENANCE' },
];

export function operator(id: string, username: string, roleId: string, overrides: Row = {}): Row {
  return {
    id,
    username,
    rank: null,
    name: `Fixture Operator ${id}`,
    display_name: `Operator ${id}`,
    initials: 'FO',
    role_id: roleId,
    enabled: true,
    last_sign_in_at: null,
    role_changed_at: null,
    created_at: T,
    updated_at: T,
    ...overrides,
  };
}

/** Four operators: one investigator, TWO supervisors (the two administrators of T-AT-5), one technician. */
export const OPERATORS: readonly Row[] = [
  operator('OPR-001', 'fixture.investigator', 'INVESTIGATOR'),
  operator('OPR-002', 'fixture.supervisor.a', 'SUPERVISOR'),
  operator('OPR-003', 'fixture.technician', 'TECHNICIAN'),
  operator('OPR-004', 'fixture.supervisor.b', 'SUPERVISOR'),
];

export function operatorCredential(operatorId: string, overrides: Row = {}): Row {
  return {
    operator_id: operatorId,
    algorithm: 'argon2id',
    memory_kib: 19_456,
    passes: 2,
    parallelism: 1,
    salt: Buffer.alloc(16, 7),
    hash: hash32(`password-hash:${operatorId}`),
    hashed_at: T,
    ...overrides,
  };
}

export function pairingCode(id: string, overrides: Row = {}): Row {
  return {
    id,
    code_hash: hash32(`pairing-code:${id}`),
    state: 'REDEEMED',
    issued_by_operator_id: 'OPR-002',
    issued_at: T,
    expires_at: T + 300_000,
    failed_attempts: 0,
    closed_at: T + 1_000,
    closed_by_operator_id: null,
    ...overrides,
  };
}

export function pairedDevice(id: string, codeId: string, overrides: Row = {}): Row {
  return {
    id,
    name: `Fixture tablet ${id}`,
    platform: 'android',
    app_version: '0.1.0',
    state: 'PAIRED',
    paired_at: T + 1_000,
    paired_with_code_id: codeId,
    last_seen_at: T + 1_000,
    revoked_at: null,
    revoked_by_operator_id: null,
    revoke_reason: null,
    unpaired_at: null,
    updated_at: T + 1_000,
    ...overrides,
  };
}

export function deviceCredential(deviceId: string, overrides: Row = {}): Row {
  return { device_id: deviceId, current_hash: hash32(`device-credential:${deviceId}`), next_hash: null, rotated_at: null, ...overrides };
}

export function authSession(marker: string, overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    token_hash: hash32(`session-token:${marker}`),
    operator_id: 'OPR-002',
    device_id: null,
    method: 'PASSWORD',
    issued_at: T,
    last_seen_at: T,
    absolute_expires_at: T + 8 * HOUR,
    ended_at: null,
    end_reason: null,
    ...overrides,
  };
}

export function biometricToken(marker: string, overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    token_hash: hash32(`biometric-token:${marker}`),
    family_id: randomUUID(),
    device_id: 'DEV-0001',
    operator_id: 'OPR-002',
    issued_at: T,
    expires_at: T + 30 * DAY,
    used_at: null,
    revoked_at: null,
    revoke_reason: null,
    ...overrides,
  };
}

export const SESSION_ID = 'SES-20261001-0001';
export const EVIDENCE_ID = 'EV-20261001-0001';
export const CASE_NUMBER = 'LP/2026/1001-0001';

export function sessionHistory(overrides: Row = {}): Row {
  return {
    id: SESSION_ID,
    outcome: 'SEALED',
    case_number: CASE_NUMBER,
    subject_name: 'Fixture Subject',
    subject_type: 'SAKSI',
    investigator_id: 'OPR-001',
    room: 'Interview Room 1',
    profile_id: 'STANDARD_1080P25',
    created_at: T,
    started_at: T + 1_000,
    ended_at: T + 61_000,
    duration_ms: 60_000,
    size_bytes: 136_000_000,
    fault_kind: null,
    start_time_source: 'GNSS',
    end_time_source: 'GNSS',
    ...overrides,
  };
}

export function evidenceItem(overrides: Row = {}): Row {
  return {
    id: EVIDENCE_ID,
    session_id: SESSION_ID,
    case_number: CASE_NUMBER,
    subject_name: 'Fixture Subject',
    subject_type: 'SAKSI',
    investigator_id: 'OPR-001',
    room: 'Interview Room 1',
    profile_id: 'STANDARD_1080P25',
    recorded_at: T + 1_000,
    ended_at: T + 61_000,
    sealed_at: T + 70_000,
    duration_ms: 60_000,
    size_bytes: 136_000_000,
    status: 'SEALED',
    lifecycle_stage: 'SEALED_LOCAL_EVIDENCE',
    manifest_hash: hex64('manifest'),
    signature_value: hex64('signature'),
    signature_key_id: 'fixture-key-1',
    signature_algorithm: 'SIMULATED-SHA256',
    signature_simulated: true,
    verification_status: 'NOT_RUN',
    verification_at: null,
    tampered: false,
    tampered_track_id: null,
    case_type: 'SAKSI',
    markers: json([]),
    notes: json([]),
    integrity_source: 'SIMULATED',
    start_time_source: 'GNSS',
    end_time_source: 'GNSS',
    created_at: T + 70_000,
    updated_at: T + 70_000,
    ...overrides,
  };
}

export function evidenceTrack(trackId: string, position: number, overrides: Row = {}): Row {
  return {
    evidence_id: EVIDENCE_ID,
    track_id: trackId,
    position,
    label: `Track ${trackId}`,
    size_bytes: 34_000_000,
    sha256: hex64(`track:${trackId}`),
    ...overrides,
  };
}

export function evidenceCustody(seq: number, overrides: Row = {}): Row {
  return { evidence_id: EVIDENCE_ID, seq, at: T + 70_000 + seq, action: 'SEALED', actor_id: 'OPR-001', detail: null, ...overrides };
}

export function exportRecord(id: string, overrides: Row = {}): Row {
  return {
    id,
    scope: 'EVIDENCE',
    evidence_id: EVIDENCE_ID,
    operator_id: 'OPR-002',
    reason: 'Fixture court order 12',
    destination: 'Fixture USB drive',
    at: T + 80_000,
    ...overrides,
  };
}

export function alert(id: string, overrides: Row = {}): Row {
  return {
    id,
    at: T,
    severity: 'WARNING',
    kind: 'STORAGE_LOW',
    message: 'Fixture alert',
    active: true,
    acknowledged: false,
    resolved_at: null,
    target: null,
    params: null,
    ...overrides,
  };
}

export function eventRow(seq: number, overrides: Row = {}): Row {
  return {
    seq,
    id: `LOG-${String(seq).padStart(6, '0')}`,
    at: T + seq,
    type: 'SESSION_CREATED',
    category: 'SESSION',
    severity: 'INFO',
    message: 'Fixture event',
    params: json({}),
    session_id: null,
    device_id: null,
    ...overrides,
  };
}

export function activeSession(overrides: Row = {}): Row {
  return {
    singleton: true,
    id: 'SES-20261001-0002',
    state: 'RECORDING',
    case_number: 'LP/2026/1001-0002',
    subject_type: 'TERSANGKA',
    subject_name: 'Fixture Subject Two',
    investigator_id: 'OPR-001',
    room: 'Interview Room 1',
    profile_id: 'STANDARD_1080P25',
    input_notes: '',
    created_at: T,
    created_by: 'OPR-001',
    armed_at: T + 5_000,
    started_at: T + 6_000,
    stopped_at: null,
    stop_reason: null,
    sealed_at: null,
    marker_count: 0,
    snapshot_count: 0,
    bytes_written: 0,
    evidence_id: null,
    start_time_source: 'GNSS',
    stop_time_source: null,
    precheck: json({ checks: [] }),
    finalization: json({ steps: [] }),
    timeline: json([]),
    notes: json([]),
    fault: null,
    recovery: null,
    updated_at: T + 6_000,
    ...overrides,
  };
}

export function storagePolicy(overrides: Row = {}): Row {
  return { singleton: true, retention_policy: 'DAYS_90', retention_days: 90, auto_archive: false, updated_at: T, ...overrides };
}

export function consoleSettings(overrides: Row = {}): Row {
  return {
    singleton: true,
    presentation_mode: false,
    time_format: '24',
    notify_warnings: true,
    notify_sound: false,
    updated_at: T,
    ...overrides,
  };
}

export function coreDevice(overrides: Row = {}): Row {
  return {
    singleton: true,
    id: 'CORE-FIXTURE-01',
    name: 'Fixture Core',
    room: 'Interview Room 1',
    product_name: 'DEMS Core',
    software_version: '0.2.0',
    certificate_fingerprint: 'fixture-fingerprint',
    serial_number: 'FX-0001',
    hardware_uuid: '00000000-0000-4000-8000-000000000001',
    chassis_revision: 'A',
    som_part_revision: 'A',
    audio_board_revision: 'A',
    poe_board_revision: 'A',
    power_board_revision: 'A',
    bsp_version: '1.0.0',
    core_software_version: '0.2.0',
    tablet_app_version: '0.1.0',
    tpm_model_firmware: 'fixture-tpm 1.0',
    camera_model_firmware: 'fixture-camera 1.0',
    provisioning_record_id: 'PRV-0001',
    device_certificate_id: 'CRT-0001',
    updated_at: T,
    ...overrides,
  };
}

export function coreState(overrides: Row = {}): Row {
  return {
    singleton: true,
    seed: 20_261_001,
    sim_schema_version: 2,
    scenario: 'idle',
    epoch: 0,
    created_at: T,
    seeded_at: T,
    last_reset_at: null,
    last_sealed_session_id: null,
    last_sealed_acknowledged: true,
    updated_at: T,
    ...overrides,
  };
}

export function hardwareSnapshot(overrides: Row = {}): Row {
  return {
    singleton: true,
    sim_schema_version: 2,
    tablet_link: json({ state: 'OFFLINE' }),
    active_camera_id: 'VIDEO-01',
    cameras: json([]),
    mics: json([]),
    storage: json({}),
    time_status: json({}),
    network: json({}),
    security: json({}),
    services: json([]),
    health: json({}),
    other_devices: json([]),
    ports: json([]),
    faults: json({ active: [] }),
    diagnostics: null,
    software_update: json({}),
    written_at: T,
    ...overrides,
  };
}

export function healthSnapshot(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    at: T,
    cause: 'INTERVAL',
    fault_kind: null,
    cpu_percent: 12.5,
    cpu_temp_c: 48.25,
    storage_temp_c: 39.5,
    ambient_temp_c: 24.75,
    fan_rpm: 2_400,
    fan_ok: true,
    storage_state: 'READY',
    evidence_used_bytes: 1_000_000,
    time_source: 'GNSS',
    time_offset_ms: 0.25,
    security_state: 'READY',
    session_state: null,
    active_faults: 0,
    ...overrides,
  };
}

export function lineageRow(resetNo: number, overrides: Row = {}): Row {
  return {
    reset_no: resetNo,
    epoch: resetNo - 1,
    head_hash: hex64(`discarded-head:${resetNo}`),
    row_count: 82,
    first_seq: 1,
    last_seq: 82,
    reset_at: T + resetNo,
    actor_id: null,
    reason: 'RESET',
    scenario: 'idle',
    ...overrides,
  };
}

/** Roles, permissions, grants and the four operators with their credential rows. */
export async function insertRbac(runner: Runner): Promise<void> {
  for (const row of ROLES) await insertRow(runner, 'roles', row);
  for (const row of PERMISSIONS) await insertRow(runner, 'permissions', row);
  for (const row of ROLE_PERMISSIONS) await insertRow(runner, 'role_permissions', row);
  for (const row of OPERATORS) {
    await insertRow(runner, 'operators', row);
    await insertRow(runner, 'operator_credentials', operatorCredential(String(row['id'])));
  }
}

/** One redeemed code, the device it paired, and the device's credential row. */
export async function insertDevice(runner: Runner, deviceId = 'DEV-0001', codeId = 'PCD-000001'): Promise<void> {
  await insertRow(runner, 'pairing_codes', pairingCode(codeId));
  await insertRow(runner, 'paired_devices', pairedDevice(deviceId, codeId));
  await insertRow(runner, 'device_credentials', deviceCredential(deviceId));
}

// ── The audit chain, through the append protocol ───────────────────────────────────────────────

export interface AuditInput {
  readonly type?: string;
  readonly category?: string;
  readonly severity?: string;
  readonly actorId?: string | null;
  readonly message?: string;
  readonly sessionId?: string | null;
  readonly evidenceId?: string | null;
  readonly deviceId?: string | null;
  readonly details?: Record<string, string | number | boolean | null>;
  readonly at?: number;
}

export interface ChainHead {
  readonly seq: number;
  readonly hash: string;
}

/** The row that continues `head`, built with the SHARED code (AP-3): `auditId`, `chainHash`. */
export function nextAuditRow(head: ChainHead, input: AuditInput = {}): Row {
  const seq = head.seq + 1;
  const body = {
    seq,
    id: auditId(seq),
    at: input.at ?? T + seq,
    type: input.type ?? 'SYSTEM_BOOT',
    category: input.category ?? 'SYSTEM',
    severity: input.severity ?? 'INFO',
    actorId: input.actorId ?? null,
    message: input.message ?? `Fixture audit row ${seq}`,
    sessionId: input.sessionId ?? null,
    evidenceId: input.evidenceId ?? null,
    deviceId: input.deviceId ?? null,
    details: input.details ?? {},
  };
  return {
    seq: body.seq,
    id: body.id,
    at: body.at,
    type: body.type,
    category: body.category,
    severity: body.severity,
    actor_id: body.actorId,
    message: body.message,
    session_id: body.sessionId,
    evidence_id: body.evidenceId,
    device_id: body.deviceId,
    details: json(body.details),
    prev_hash: head.hash,
    hash: chainHash(head.hash, body as AuditEventBody),
  };
}

export const AUDIT_INSERT =
  'INSERT INTO public.audit_log (seq, id, at, type, category, severity, actor_id, message, ' +
  'session_id, evidence_id, device_id, details, prev_hash, hash) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)';

export const AUDIT_LOCK = 'SELECT seq, hash FROM public.audit_chain_lock()';

/** AP-2: the lock, which returns the head to extend. Must run inside a transaction. */
export async function lockChain(client: Runner): Promise<ChainHead> {
  const { rows } = await client.query<{ seq: string; hash: string }>(AUDIT_LOCK);
  const row = rows[0];
  if (row === undefined) throw new Error('audit_chain_lock() returned no row');
  return { seq: Number(row.seq), hash: row.hash };
}

/** AP-4: one INSERT for one row, with bind parameters. */
export async function insertAuditRow(client: Runner, row: Row): Promise<void> {
  await client.query(AUDIT_INSERT, Object.values(row));
}

/** AP-1 to AP-5 for `count` rows in one transaction on one connection of the pool. */
export async function appendAuditRows(pool: Pool, count: number, input: AuditInput = {}): Promise<ChainHead> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let head = await lockChain(client);
    for (let index = 0; index < count; index += 1) {
      const row = nextAuditRow(head, input);
      await insertAuditRow(client, row);
      head = { seq: Number(row['seq']), hash: String(row['hash']) };
    }
    await client.query('COMMIT');
    return head;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// ── schema v2 builders (dbc-3 §A; RECON-B2b). One VALID row per new table, in the order of the
//    contract; every column a CHECK inspects holds a value that satisfies the rule. ──

export function captureDevice(id: string, kind: 'CAMERA' | 'MIC' | 'POE', overrides: Row = {}): Row {
  return {
    id,
    kind,
    transport: kind === 'CAMERA' ? 'ONVIF' : kind === 'MIC' ? 'USB' : 'POE',
    model: 'Fixture model',
    firmware: '1.2.3',
    address: kind === 'CAMERA' ? '127.0.0.1' : null,
    mac: '00:11:22:33:44:55',
    // One device per endpoint reference since dbc-4 (`capture_devices_onvif_uuid_key`).
    onvif_uuid: kind === 'CAMERA' ? `ONVIF-${id}` : null,
    profiles: json([]),
    poe_port: null,
    enabled: true,
    last_seen_at: null,
    adapter_kind: 'FAKE',
    ...overrides,
  };
}

/** One `session_capture_sources` row (T-41, dbc-4 §N.3): a slot of `SESSION_ID`, fed by a seeded-style device. */
export function captureSource(slot: string, overrides: Row = {}): Row {
  return {
    session_id: SESSION_ID,
    slot,
    device_id: slot.startsWith('VIDEO-') ? (slot === 'VIDEO-02' ? 'CAM-02' : 'CAM-01') : slot === 'MIC-STANDBY' ? 'MIC-02' : 'MIC-01',
    adapter_kind: 'FAKE',
    recorded_at: T,
    ...overrides,
  };
}

export function captureConfig(overrides: Row = {}): Row {
  return {
    video_01_device_id: 'CAM-01',
    video_01_profile: 'UHD',
    video_02_device_id: 'CAM-02',
    video_02_profile: 'HD',
    mic_primary_id: 'MIC-01',
    mic_standby_id: 'MIC-02',
    revision: 1,
    updated_by: 'OPR-001',
    updated_at: T,
    ...overrides,
  };
}

export function captureDeviceCredential(deviceId: string, overrides: Row = {}): Row {
  return {
    device_id: deviceId,
    username: 'fixture.user',
    encryption: 'AES-256-GCM',
    secret_ciphertext: Buffer.alloc(33, 9),
    nonce: Buffer.alloc(12, 3),
    key_ref: 'KEY_01',
    rotated_at: T,
    ...overrides,
  };
}

export function audioInterval(seq: number, overrides: Row = {}): Row {
  return {
    session_id: SESSION_ID,
    seq,
    mic_device_id: 'MIC-01',
    role: 'PRIMARY',
    from_media_ms: 0,
    to_media_ms: null,
    from_at: T,
    to_at: null,
    switched_by: 'OPR-001',
    reason: 'START',
    ...overrides,
  };
}

export function recordingFragment(sessionId: string, trackId: 'VIDEO-01' | 'VIDEO-02', seq: number, overrides: Row = {}): Row {
  return {
    session_id: sessionId,
    track_id: trackId,
    seq,
    byte_offset: 0,
    byte_length: 1_048_576,
    media_start_ms: 0,
    media_duration_ms: 4_000,
    sha256: hex64(`fragment:${sessionId}:${trackId}:${seq}`),
    chain_hash: hex64(`fragment-chain:${sessionId}:${trackId}:${seq}`),
    durable_at: T,
    ...overrides,
  };
}

export function transcriptChunk(seq: number, overrides: Row = {}): Row {
  return {
    session_id: SESSION_ID,
    seq,
    audio_from_ms: 0,
    audio_to_ms: 5_000,
    status: 'PENDING',
    segments: null,
    embedding_ref: null,
    model_id: null,
    computed_at: null,
    ...overrides,
  };
}

export function transcript(overrides: Row = {}): Row {
  return {
    evidence_id: EVIDENCE_ID,
    json_sha256: hex64('transcript-json'),
    srt_sha256: hex64('transcript-srt'),
    vtt_sha256: hex64('transcript-vtt'),
    model: json({ id: 'fixture-model' }),
    diarization: json({ enabled: true }),
    labels_status: 'UNAVAILABLE',
    created_at: T,
    ...overrides,
  };
}

export function transcriptRevision(revisionNo: number, overrides: Row = {}): Row {
  return {
    evidence_id: EVIDENCE_ID,
    revision_no: revisionNo,
    parent_sha256: revisionNo === 1 ? '0'.repeat(64) : hex64(`transcript-rev:${revisionNo - 1}`),
    sha256: hex64(`transcript-rev:${revisionNo}`),
    author_id: 'OPR-001',
    reason: 'Fixture revision reason',
    signature_value: hex64(`transcript-signature:${revisionNo}`),
    signature_key_id: 'KEY_01',
    signature_algorithm: 'SIMULATED-SHA256',
    signature_simulated: true,
    signature_certificate_sha256: null,
    created_at: T,
    ...overrides,
  };
}

export function sealingJob(step: string, overrides: Row = {}): Row {
  return {
    session_id: SESSION_ID,
    step,
    status: 'RUNNING',
    progress: 50,
    eta_ms: 1_200,
    attempt: 1,
    checkpoint: null,
    error_code: null,
    started_at: T,
    updated_at: T,
    ...overrides,
  };
}

export function sttConfig(overrides: Row = {}): Row {
  return {
    enabled: true,
    backend: 'cpu-local',
    endpoint: null,
    model: 'vosk-id-small',
    language: 'id',
    diarization: true,
    credential_kind: null,
    credential_ref: null,
    secret_ciphertext: null,
    nonce: null,
    revision: 1,
    updated_by: 'OPR-001',
    updated_at: T,
    ...overrides,
  };
}

/** The one `core_media_store` row (T-43, erratum PE-0013-01): the media store root of a Core. */
export function mediaStore(overrides: Row = {}): Row {
  return { singleton: true, media_root: '/srv/dems/media/sessions', recorded_at: T, ...overrides };
}

/** One `session_stt_config` row (T-42, erratum PE-129b-01): the STT snapshot of `SESSION_ID`. */
export function sessionSttSnapshot(overrides: Row = {}): Row {
  return {
    session_id: SESSION_ID,
    enabled: true,
    backend: 'omlx-server',
    endpoint: 'http://127.0.0.1:8000',
    model: 'whisper-large-v3-turbo',
    language: 'id',
    diarization: true,
    credential_kind: 'REFERENCE',
    config_revision: 1,
    taken_at: T,
    ...overrides,
  };
}
