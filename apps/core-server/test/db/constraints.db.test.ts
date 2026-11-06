// Constraints by behaviour (database contract CL-02, CL-03, CL-04): one REFUSED row for every
// named CHECK, one for every foreign key, one for every reachable uniqueness rule; and the valid
// rows are ACCEPTED, so no CHECK is stricter than the contract.
//
// Rows are written as `dems_owner` (several tables are closed to the runtime role, and a CHECK
// binds every role alike). A CHECK is evaluated before a key or a foreign key is looked at, so
// each refused row differs from a valid one in exactly the column that breaks the rule under
// test, and the test asserts the NAME of the constraint that refused it.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { readInventory } from './contract-inventory';
import {
  AUDIT_INSERT,
  EVIDENCE_ID,
  SESSION_ID,
  T,
  activeSession,
  alert,
  audioInterval,
  authSession,
  biometricToken,
  ACCEPTANCE_REVOKED,
  ALIAS_CLOSED,
  captureAudioInput,
  captureConfig,
  captureDevice,
  captureDeviceCredential,
  captureDeviceStream,
  captureNetworkConfig,
  captureSource,
  hostNetworkAlias,
  installationAcceptance,
  mediaStore,
  sessionSttSnapshot,
  consoleSettings,
  coreDevice,
  coreState,
  deviceCredential,
  eventRow,
  evidenceCustody,
  evidenceItem,
  evidenceTrack,
  exportRecord,
  hardwareSnapshot,
  hash32,
  healthSnapshot,
  insertDevice,
  insertRbac,
  insertRow,
  json,
  lineageRow,
  nextAuditRow,
  operator,
  operatorCredential,
  pairedDevice,
  pairingCode,
  recordingFragment,
  sealingJob,
  sessionHistory,
  storagePolicy,
  sttConfig,
  transcript,
  transcriptChunk,
  transcriptRevision,
  type Row,
} from './fixtures';
import { SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: 'schema' });
const inventory = readInventory();
let owner: Pool;

beforeAll(() => {
  owner = db.ownerPool();
});

const ZEROS = '0'.repeat(64);
/** An audit row that continues the empty chain, with some columns replaced. */
const auditRow = (overrides: Row): Row => ({ ...nextAuditRow({ seq: 0, hash: ZEROS }), ...overrides });

/** `[check, table, row]`: the row breaks exactly that CHECK. */
const REFUSED_BY_CHECK: ReadonlyArray<readonly [string, string, Row]> = [
  ['roles_id_check', 'roles', { id: 'ADMIN', sort_order: 9 }],
  ['permissions_id_check', 'permissions', { id: 'lower_case', sort_order: 99 }],
  ['operators_id_check', 'operators', operator('OPR-9', 'fixture.nine', 'SUPERVISOR')],
  ['operators_username_check', 'operators', operator('OPR-009', 'Upper.Case', 'SUPERVISOR')],
  ['operators_name_check', 'operators', operator('OPR-009', 'fixture.nine', 'SUPERVISOR', { initials: 'ABCDE' })],
  ['operator_credentials_algorithm_check', 'operator_credentials', operatorCredential('OPR-002', { algorithm: 'bcrypt' })],
  ['operator_credentials_params_check', 'operator_credentials', operatorCredential('OPR-002', { memory_kib: 19_455 })],
  ['operator_credentials_lengths_check', 'operator_credentials', operatorCredential('OPR-002', { hash: Buffer.alloc(31, 1) })],
  ['auth_sessions_token_hash_check', 'auth_sessions', authSession('c', { token_hash: Buffer.alloc(31, 1) })],
  ['auth_sessions_method_check', 'auth_sessions', authSession('c', { method: 'SECURITY_KEY' })],
  ['auth_sessions_biometric_device_check', 'auth_sessions', authSession('c', { method: 'BIOMETRIC', device_id: null })],
  ['auth_sessions_times_check', 'auth_sessions', authSession('c', { last_seen_at: T - 1 })],
  ['auth_sessions_end_check', 'auth_sessions', authSession('c', { ended_at: T + 1, end_reason: null })],
  ['auth_sessions_end_reason_check', 'auth_sessions', authSession('c', { ended_at: T + 1, end_reason: 'KICKED' })],
  ['auth_sessions_token_reuse_check', 'auth_sessions', authSession('c', { ended_at: T + 1, end_reason: 'TOKEN_REUSE', method: 'PASSWORD' })],
  ['pairing_codes_id_check', 'pairing_codes', pairingCode('PCD-12')],
  ['pairing_codes_code_hash_check', 'pairing_codes', pairingCode('PCD-000099', { code_hash: Buffer.alloc(16, 1) })],
  ['pairing_codes_state_check', 'pairing_codes', pairingCode('PCD-000099', { state: 'USED' })],
  ['pairing_codes_times_check', 'pairing_codes', pairingCode('PCD-000099', { expires_at: T })],
  ['pairing_codes_attempts_check', 'pairing_codes', pairingCode('PCD-000099', { failed_attempts: 6 })],
  ['pairing_codes_closed_check', 'pairing_codes', pairingCode('PCD-000099', { state: 'ACTIVE' })],
  ['paired_devices_id_check', 'paired_devices', pairedDevice('DEV-1', 'PCD-000001')],
  ['paired_devices_text_check', 'paired_devices', pairedDevice('DEV-0099', 'PCD-000001', { name: '' })],
  ['paired_devices_lifecycle_check', 'paired_devices', pairedDevice('DEV-0099', 'PCD-000001', { state: 'REVOKED' })],
  ['device_credentials_lengths_check', 'device_credentials', deviceCredential('DEV-0001', { next_hash: hash32('device-credential:DEV-0001') })],
  ['biometric_tokens_token_hash_check', 'biometric_tokens', biometricToken('c', { token_hash: Buffer.alloc(8, 1) })],
  ['biometric_tokens_times_check', 'biometric_tokens', biometricToken('c', { expires_at: T })],
  ['biometric_tokens_revoke_check', 'biometric_tokens', biometricToken('c', { revoked_at: T + 1, revoke_reason: 'BECAUSE' })],
  ['registry_counters_name_check', 'registry_counters', { name: 'session', next_value: 1 }],
  ['registry_counters_value_check', 'registry_counters', { name: 'device', next_value: 0 }],
  ['audit_log_id_check', 'audit_log', auditRow({ id: 'AUD-1' })],
  ['audit_log_type_check', 'audit_log', auditRow({ type: 'lowercase' })],
  ['audit_log_category_check', 'audit_log', auditRow({ category: 'NETWORK' })],
  ['audit_log_severity_check', 'audit_log', auditRow({ severity: 'FATAL' })],
  ['audit_log_hashes_check', 'audit_log', auditRow({ hash: ZEROS })],
  ['audit_log_details_flat_check', 'audit_log', auditRow({ details: json({ a: { b: 1 } }) })],
  ['audit_log_details_no_secret_keys_check', 'audit_log', auditRow({ details: json({ token: 'x' }) })],
  ['audit_chain_head_singleton_check', 'audit_chain_head', { singleton: false, seq: 0, hash: ZEROS }],
  ['audit_chain_head_values_check', 'audit_chain_head', { singleton: true, seq: -1, hash: ZEROS }],
  ['events_seq_check', 'events', eventRow(0)],
  ['events_id_check', 'events', eventRow(1, { id: 'LOG-1' })],
  ['events_type_check', 'events', eventRow(1, { type: 'bad type' })],
  ['events_category_check', 'events', eventRow(1, { category: 'PAIRING' })],
  ['events_severity_check', 'events', eventRow(1, { severity: 'FATAL' })],
  ['events_params_flat_check', 'events', eventRow(1, { params: json([1]) })],
  ['events_params_no_secret_keys_check', 'events', eventRow(1, { params: json({ password: 'x' }) })],
  ['active_session_singleton_check', 'active_session', activeSession({ singleton: false })],
  ['active_session_id_check', 'active_session', activeSession({ id: 'SES-1' })],
  ['active_session_state_check', 'active_session', activeSession({ state: 'PAUSED' })],
  ['active_session_input_check', 'active_session', activeSession({ subject_type: 'ANAK' })],
  ['active_session_time_source_check', 'active_session', activeSession({ start_time_source: 'GPS' })],
  ['active_session_counts_check', 'active_session', activeSession({ marker_count: -1 })],
  ['active_session_json_check', 'active_session', activeSession({ timeline: json({}) })],
  ['session_history_id_check', 'session_history', sessionHistory({ case_number: 'LP/26/1-1' })],
  ['session_history_outcome_check', 'session_history', sessionHistory({ fault_kind: 'POWER_FAIL' })],
  ['session_history_input_check', 'session_history', sessionHistory({ profile_id: 'UHD' })],
  ['session_history_values_check', 'session_history', sessionHistory({ duration_ms: -1 })],
  ['session_history_time_source_check', 'session_history', sessionHistory({ end_time_source: 'GPS' })],
  ['evidence_items_id_check', 'evidence_items', evidenceItem({ id: 'EV-1' })],
  ['evidence_items_status_check', 'evidence_items', evidenceItem({ status: 'DELETED' })],
  ['evidence_items_input_check', 'evidence_items', evidenceItem({ case_type: 'ANAK' })],
  ['evidence_items_hashes_check', 'evidence_items', evidenceItem({ manifest_hash: 'xyz' })],
  ['evidence_items_signature_check', 'evidence_items', evidenceItem({ signature_simulated: false })],
  ['evidence_items_verification_check', 'evidence_items', evidenceItem({ verification_status: 'PASS', verification_at: null })],
  ['evidence_items_tamper_check', 'evidence_items', evidenceItem({ tampered_track_id: 'VIDEO-09' })],
  ['evidence_items_values_check', 'evidence_items', evidenceItem({ size_bytes: -1 })],
  // dbc-3 §C.4 swapped this CHECK: 'REAL' is a valid integrity source since schema v2, so the
  // refusing value is one of neither set ('GHOST') - the probe breaks the rule as landed.
  ['evidence_items_sources_check', 'evidence_items', evidenceItem({ integrity_source: 'GHOST' })],
  ['evidence_items_json_check', 'evidence_items', evidenceItem({ markers: json({}) })],
  // D61 (2026-11-04): the position bound widened to eight (0040); a ninth track breaks the check.
  ['evidence_tracks_track_check', 'evidence_tracks', evidenceTrack('VIDEO-01', 9)],
  ['evidence_tracks_values_check', 'evidence_tracks', evidenceTrack('VIDEO-01', 1, { sha256: 'nothex' })],
  ['evidence_custody_values_check', 'evidence_custody', evidenceCustody(0)],
  ['exports_id_check', 'exports', exportRecord('EXP-1')],
  ['exports_scope_check', 'exports', exportRecord('EXP-000001', { scope: 'AUDIT' })],
  ['exports_text_check', 'exports', exportRecord('EXP-000001', { reason: '  ab  ' })],
  ['alerts_id_check', 'alerts', alert('ALR-1')],
  ['alerts_kind_check', 'alerts', alert('ALR-000001', { kind: 'UNKNOWN' })],
  ['alerts_params_check', 'alerts', alert('ALR-000001', { params: json({ a: [1] }) })],
  ['storage_policy_singleton_check', 'storage_policy', storagePolicy({ singleton: false })],
  ['storage_policy_values_check', 'storage_policy', storagePolicy({ retention_days: 0 })],
  ['console_settings_singleton_check', 'console_settings', consoleSettings({ singleton: false })],
  ['console_settings_time_format_check', 'console_settings', consoleSettings({ time_format: '25' })],
  ['engine_counters_name_check', 'engine_counters', { name: 'device', next_value: 1 }],
  ['engine_counters_value_check', 'engine_counters', { name: 'event', next_value: 0 }],
  ['core_device_singleton_check', 'core_device', coreDevice({ singleton: false })],
  ['core_state_singleton_check', 'core_state', coreState({ singleton: false })],
  ['core_state_values_check', 'core_state', coreState({ epoch: -1 })],
  ['hardware_snapshot_singleton_check', 'hardware_snapshot', hardwareSnapshot({ singleton: false })],
  ['hardware_snapshot_camera_check', 'hardware_snapshot', hardwareSnapshot({ active_camera_id: 'AUDIO-01' })],
  ['hardware_snapshot_shapes_check', 'hardware_snapshot', hardwareSnapshot({ cameras: json({}) })],
  ['health_snapshots_cause_check', 'health_snapshots', healthSnapshot({ fault_kind: 'TAMPER' })],
  ['health_snapshots_states_check', 'health_snapshots', healthSnapshot({ active_faults: -1 })],
  ['schema_meta_singleton_check', 'schema_meta', { singleton: false, schema_version: 1, contract_revision: 'dbc-2' }],
  ['audit_chain_history_numbers_check', 'audit_chain_history', lineageRow(0, { epoch: 0 })],
  ['audit_chain_history_head_hash_check', 'audit_chain_history', lineageRow(1, { head_hash: 'zz' })],
  ['audit_chain_history_values_check', 'audit_chain_history', lineageRow(1, { row_count: 0 })],
  ['audit_chain_history_reason_check', 'audit_chain_history', lineageRow(1, { reason: 'MANUAL' })],
  // ── schema v2 (dbc-3 §B): one refused row per named CHECK of the ten new tables and of the
  //    five CHECKs the changed tables gained (§C.4). R1/R3: transcribed from the contract text ──
  ['capture_devices_id_check', 'capture_devices', captureDevice('CAM1', 'CAMERA')],
  ['capture_devices_transport_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { transport: 'usb' })],
  ['capture_devices_text_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { model: '' })],
  ['capture_devices_profiles_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { profiles: json({}) })],
  // schema v10 (AD-06 (4)): an element that is an ONVIF token, as adoption stored it before row 51.
  ['capture_devices_profiles_code_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { profiles: json(['profile_1']) })],
  ['capture_devices_poe_port_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { poe_port: 'eth0' })],
  ['capture_config_singleton_check', 'capture_config', captureConfig({ singleton: false })],
  ['capture_config_profile_check', 'capture_config', captureConfig({ video_01_profile: 'uhd' })],
  // D60 (2026-11-04): the third and fourth slots carry their own profile CHECK (0039).
  ['capture_config_profile_34_check', 'capture_config', captureConfig({ video_03_profile: 'uhd' })],
  // D61 (2026-11-04): the collision rule is pairwise over the four numbered channels (0040).
  ['capture_config_mic_check', 'capture_config', captureConfig({ mic_02_id: 'MIC-01' })],
  ['capture_config_selector_check', 'capture_config', captureConfig({ video_02_device_id: 'CAM-01', video_02_profile: 'UHD' })],
  ['capture_config_revision_check', 'capture_config', captureConfig({ revision: 0 })],
  ['capture_device_credentials_username_check', 'capture_device_credentials', captureDeviceCredential('CAM-01', { username: '' })],
  ['capture_device_credentials_encryption_check', 'capture_device_credentials', captureDeviceCredential('CAM-01', { encryption: 'AES-128-GCM' })],
  ['capture_device_credentials_secret_check', 'capture_device_credentials', captureDeviceCredential('CAM-01', { secret_ciphertext: Buffer.alloc(32, 9) })],
  ['capture_device_credentials_nonce_check', 'capture_device_credentials', captureDeviceCredential('CAM-01', { nonce: Buffer.alloc(11, 3) })],
  ['capture_device_credentials_key_ref_check', 'capture_device_credentials', captureDeviceCredential('CAM-01', { key_ref: 'key-01' })],
  ['session_audio_intervals_session_check', 'session_audio_intervals', audioInterval(1, { session_id: 'SES-1' })],
  ['session_audio_intervals_seq_check', 'session_audio_intervals', audioInterval(0)],
  ['session_audio_intervals_role_check', 'session_audio_intervals', audioInterval(1, { role: 'MAIN' })],
  ['session_audio_intervals_reason_check', 'session_audio_intervals', audioInterval(1, { reason: 'SWITCH' })],
  ['session_audio_intervals_media_check', 'session_audio_intervals', audioInterval(1, { from_media_ms: 10, to_media_ms: 5, to_at: T + 5 })],
  ['session_audio_intervals_open_check', 'session_audio_intervals', audioInterval(1, { to_at: T + 5 })],
  ['recording_fragments_session_check', 'recording_fragments', recordingFragment('SES-1', 'VIDEO-01', 1)],
  // D28 / 0044 (row 146): AUDIO-01..04 are fragment tracks now; a fifth channel breaks the check.
  ['recording_fragments_track_check', 'recording_fragments', recordingFragment(SESSION_ID, 'AUDIO-05' as 'VIDEO-01', 1)],
  ['recording_fragments_seq_check', 'recording_fragments', recordingFragment(SESSION_ID, 'VIDEO-01', 0)],
  ['recording_fragments_bytes_check', 'recording_fragments', recordingFragment(SESSION_ID, 'VIDEO-01', 1, { byte_length: 0 })],
  ['recording_fragments_media_check', 'recording_fragments', recordingFragment(SESSION_ID, 'VIDEO-01', 1, { media_duration_ms: 0 })],
  ['recording_fragments_hashes_check', 'recording_fragments', recordingFragment(SESSION_ID, 'VIDEO-01', 1, { chain_hash: 'zz' })],
  ['transcript_chunks_session_check', 'transcript_chunks', transcriptChunk(1, { session_id: 'SES-1' })],
  ['transcript_chunks_seq_check', 'transcript_chunks', transcriptChunk(0)],
  ['transcript_chunks_audio_check', 'transcript_chunks', transcriptChunk(1, { audio_to_ms: 0 })],
  ['transcript_chunks_status_check', 'transcript_chunks', transcriptChunk(1, { status: 'QUEUED' })],
  ['transcript_chunks_segments_check', 'transcript_chunks', transcriptChunk(1, { segments: json({}) })],
  ['transcript_chunks_done_check', 'transcript_chunks', transcriptChunk(1, { status: 'DONE' })],
  ['transcript_chunks_ref_check', 'transcript_chunks', transcriptChunk(1, { embedding_ref: 'ref-1' })],
  ['transcripts_hashes_check', 'transcripts', transcript({ srt_sha256: 'zz' })],
  ['transcripts_json_check', 'transcripts', transcript({ model: json([]) })],
  ['transcripts_labels_check', 'transcripts', transcript({ labels_status: 'PARTIAL' })],
  ['transcript_revisions_revision_no_check', 'transcript_revisions', transcriptRevision(0)],
  ['transcript_revisions_hashes_check', 'transcript_revisions', transcriptRevision(1, { sha256: 'zz' })],
  ['transcript_revisions_reason_check', 'transcript_revisions', transcriptRevision(1, { reason: 'no' })],
  ['transcript_revisions_key_id_check', 'transcript_revisions', transcriptRevision(1, { signature_key_id: 'key_1' })],
  ['transcript_revisions_certificate_check', 'transcript_revisions', transcriptRevision(1, { signature_certificate_sha256: 'zz' })],
  ['transcript_revisions_signature_check', 'transcript_revisions', transcriptRevision(1, { signature_algorithm: 'Ed25519', signature_simulated: true, signature_value: 'ab'.repeat(64) })],
  ['transcript_revisions_signature_value_check', 'transcript_revisions', transcriptRevision(1, { signature_value: 'ab'.repeat(64) })],
  ['sealing_jobs_session_check', 'sealing_jobs', sealingJob('FRAGMENTS', { session_id: 'SES-1' })],
  ['sealing_jobs_step_check', 'sealing_jobs', sealingJob('step-1')],
  ['sealing_jobs_status_check', 'sealing_jobs', sealingJob('FRAGMENTS', { status: 'QUEUED' })],
  ['sealing_jobs_progress_check', 'sealing_jobs', sealingJob('FRAGMENTS', { progress: 101 })],
  ['sealing_jobs_eta_check', 'sealing_jobs', sealingJob('FRAGMENTS', { eta_ms: -1 })],
  ['sealing_jobs_attempt_check', 'sealing_jobs', sealingJob('FRAGMENTS', { attempt: 0 })],
  ['sealing_jobs_checkpoint_check', 'sealing_jobs', sealingJob('FRAGMENTS', { checkpoint: json([]) })],
  ['sealing_jobs_error_code_check', 'sealing_jobs', sealingJob('FRAGMENTS', { error_code: 'err' })],
  ['stt_config_singleton_check', 'stt_config', sttConfig({ singleton: false })],
  ['stt_config_backend_check', 'stt_config', sttConfig({ backend: 'gpu' })],
  ['stt_config_endpoint_required_check', 'stt_config', sttConfig({ backend: 'omlx-server', endpoint: null })],
  ['stt_config_endpoint_loopback_check', 'stt_config', sttConfig({ backend: 'omlx-server', endpoint: 'http://example.com' })],
  ['stt_config_language_check', 'stt_config', sttConfig({ language: 'en' })],
  ['stt_config_secret_check', 'stt_config', sttConfig({ backend: 'omlx-server', endpoint: 'http://localhost:8000', credential_kind: 'ENCRYPTED', credential_ref: 'KEY_1', secret_ciphertext: Buffer.alloc(16, 9), nonce: Buffer.alloc(12, 3) })],
  ['stt_config_nonce_check', 'stt_config', sttConfig({ backend: 'omlx-server', endpoint: 'http://localhost:8000', credential_kind: 'ENCRYPTED', credential_ref: 'KEY_1', secret_ciphertext: Buffer.alloc(17, 9), nonce: Buffer.alloc(11, 3) })],
  ['stt_config_credential_check', 'stt_config', sttConfig({ credential_kind: 'REFERENCE' })],
  ['stt_config_revision_check', 'stt_config', sttConfig({ revision: 0 })],
  ['evidence_items_manifest_version_check', 'evidence_items', evidenceItem({ manifest_version: 3 })],
  ['evidence_items_labels_check', 'evidence_items', evidenceItem({ labels_status: 'PARTIAL' })],
  ['evidence_items_signature_value_check', 'evidence_items', evidenceItem({ signature_value: 'ab'.repeat(64) })],
  ['evidence_tracks_kind_check', 'evidence_tracks', evidenceTrack('VIDEO-01', 1, { kind: 'STREAM' })],
  ['evidence_tracks_audio_check', 'evidence_tracks', evidenceTrack('VIDEO-01', 1, { contains_audio: false })],
  // ── schema v3 (dbc-4 §N.2, §N.3): the two CHECKs `capture_devices` gained and three of the four
  //    of T-41 (the fourth, the slot list, is shadowed by the pairing rule - see SHADOWED). ──
  ['capture_devices_adapter_kind_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { adapter_kind: 'RTMP' })],
  ['capture_devices_adapter_pairing_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { adapter_kind: 'USB_AUDIO' })],
  ['session_capture_sources_session_check', 'session_capture_sources', captureSource('VIDEO-01', { session_id: 'SES-1' })],
  ['session_capture_sources_adapter_kind_check', 'session_capture_sources', captureSource('VIDEO-01', { adapter_kind: 'RTMP' })],
  ['session_capture_sources_pairing_check', 'session_capture_sources', captureSource('VIDEO-01', { adapter_kind: 'USB_AUDIO' })],
  // ── schema v5 (erratum PE-129b-01): the seven CHECKs of T-42, each alone (none is shadowed). ──
  ['session_stt_config_session_check', 'session_stt_config', sessionSttSnapshot({ session_id: 'SES-1' })],
  ['session_stt_config_backend_check', 'session_stt_config', sessionSttSnapshot({ backend: 'cloud' })],
  ['session_stt_config_endpoint_required_check', 'session_stt_config', sessionSttSnapshot({ endpoint: null })],
  ['session_stt_config_endpoint_loopback_check', 'session_stt_config', sessionSttSnapshot({ endpoint: 'http://192.0.2.10:8000' })],
  ['session_stt_config_language_check', 'session_stt_config', sessionSttSnapshot({ language: 'en' })],
  ['session_stt_config_credential_kind_check', 'session_stt_config', sessionSttSnapshot({ credential_kind: 'PLAIN' })],
  ['session_stt_config_revision_check', 'session_stt_config', sessionSttSnapshot({ config_revision: 0 })],
  // ── schema v6 (erratum PE-0013-01): the cause of an alert in the CODE form; the two CHECKs of T-43. ──
  ['alerts_reason_check', 'alerts', alert('ALR-000001', { reason: 'mic disconnected' })],
  ['core_media_store_singleton_check', 'core_media_store', mediaStore({ singleton: false })],
  ['core_media_store_root_check', 'core_media_store', mediaStore({ media_root: 'media/sessions' })],
  // ── schema v7 (task 4 schema set A): the seven CHECKs of T-44, the six of T-45, the three of
  //    `session_capture_sources.source_facts`, and the slot pair of the selector. ──
  ['capture_device_streams_device_id_check', 'capture_device_streams', captureDeviceStream('MIC-01', 'HEVC_1080P')],
  ['capture_device_streams_profile_check', 'capture_device_streams', captureDeviceStream('CAM-01', 'profile_1')],
  ['capture_device_streams_token_check', 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P', { onvif_profile_token: 'profile 1' })],
  ['capture_device_streams_lens_check', 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P', { lens: 5 })],
  ['capture_device_streams_stream_role_check', 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P', { stream_role: 'THIRD' })],
  ['capture_device_streams_codec_check', 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P', { codec: 'H265' })],
  ['capture_device_streams_size_check', 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P', { height: null })],
  ['capture_audio_inputs_device_id_check', 'capture_audio_inputs', captureAudioInput('CAM-01')],
  ['capture_audio_inputs_usb_id_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { usb_id: '1235:821G' })],
  ['capture_audio_inputs_card_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { card_id: 'USB Audio' })],
  ['capture_audio_inputs_input_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { input_number: 5 })],
  ['capture_audio_inputs_sample_rate_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { sample_rate: 44_100 })],
  ['capture_audio_inputs_sample_bits_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { sample_bits: 20 })],
  ['session_capture_sources_source_facts_flat_check', 'session_capture_sources', captureSource('VIDEO-01', { source_facts: json({ model: { name: 'nested' } }) })],
  ['session_capture_sources_source_facts_no_secret_keys_check', 'session_capture_sources', captureSource('VIDEO-01', { source_facts: json({ model: 'Fixture model', username: 'someone' }) })],
  ['session_capture_sources_source_facts_bound_check', 'session_capture_sources', captureSource('VIDEO-01', { source_facts: json({ model: 'm'.repeat(121) }) })],
  ['capture_config_slot_pair_check', 'capture_config', captureConfig({ video_01_profile: null })],
  // ── schema v8 (task 4 schema set B): the eight CHECKs of T-46, the eight of T-47, and the two of
  //    the USB serial and port of a sound card. Each row breaks its one rule and no other. ──
  ['capture_network_config_singleton_check', 'capture_network_config', captureNetworkConfig({ singleton: false })],
  ['capture_network_config_interface_name_check', 'capture_network_config', captureNetworkConfig({ interface_name: 'Ethernet 1' })],
  ['capture_network_config_camera_subnet_check', 'capture_network_config', captureNetworkConfig({ camera_subnet: '192.168.1.0/8' })],
  ['capture_network_config_factory_addresses_check', 'capture_network_config', captureNetworkConfig({ factory_addresses: json(['192.168.1.64', 'camera.local']) })],
  ['capture_network_config_alias_host_check', 'capture_network_config', captureNetworkConfig({ alias_host: 255 })],
  ['capture_network_config_alias_minutes_check', 'capture_network_config', captureNetworkConfig({ alias_minutes: 4 })],
  ['capture_network_config_camera_ip_start_check', 'capture_network_config', captureNetworkConfig({ camera_ip_start: 251 })],
  ['capture_network_config_revision_check', 'capture_network_config', captureNetworkConfig({ revision: 0 })],
  // Schema v14 (set 15): the two CHECKs of the allowed ONVIF ports. Nine different ports break the
  // size alone; one port twice breaks the second rule alone.
  ['capture_network_config_onvif_ports_check', 'capture_network_config', captureNetworkConfig({ onvif_ports: json([80, 81, 82, 83, 84, 85, 86, 87, 88]) })],
  ['capture_network_config_onvif_ports_distinct_check', 'capture_network_config', captureNetworkConfig({ onvif_ports: json([80, 8080, 80]) })],
  ['host_network_aliases_interface_name_check', 'host_network_aliases', hostNetworkAlias({ interface_name: 'eth1;reboot' })],
  ['host_network_aliases_address_check', 'host_network_aliases', hostNetworkAlias({ address: '8.8.8.8/24' })],
  ['host_network_aliases_reason_check', 'host_network_aliases', hostNetworkAlias({ reason: 'TESTING' })],
  ['host_network_aliases_expires_at_check', 'host_network_aliases', hostNetworkAlias({ expires_at: T })],
  ['host_network_aliases_removed_at_check', 'host_network_aliases', hostNetworkAlias({ removed_at: T - 1, remove_reason: 'MANUAL' })],
  ['host_network_aliases_remove_reason_check', 'host_network_aliases', hostNetworkAlias({ removed_at: T + 5_000 })],
  ['host_network_aliases_removed_by_check', 'host_network_aliases', hostNetworkAlias({ removed_by: 'OPR-001' })],
  ['host_network_aliases_remove_error_check', 'host_network_aliases', hostNetworkAlias({ remove_error: 'del failed' })],
  ['capture_audio_inputs_usb_serial_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { usb_serial: 'SN 0042' })],
  ['capture_audio_inputs_usb_port_check', 'capture_audio_inputs', captureAudioInput('MIC-01', { usb_port: '1-1.4/input0' })],
  // Schema v15 (set 16, design 07): the two CHECKs of the retirement. An instant without an
  // operator breaks the first alone; a retired PoE row (instant and operator both set) the second alone.
  ['capture_devices_retired_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { retired_at: T })],
  ['capture_devices_retired_kind_check', 'capture_devices', captureDevice('POE-A1', 'POE', { poe_port: 'P1', retired_at: T, retired_by: 'OPR-001' })],
  // ── schema v11 (task 4 schema set C): the eleven CHECKs of T-48. Each row breaks ONE rule, or
  //    the rule it names comes first in name order (CHECKs are evaluated in name order). ──
  ['installation_acceptances_software_version_check', 'installation_acceptances', installationAcceptance({ software_version: '' })],
  ['installation_acceptances_site_check', 'installation_acceptances', installationAcceptance({ room: '' })],
  ['installation_acceptances_site_address_check', 'installation_acceptances', installationAcceptance({ site_address: '' })],
  ['installation_acceptances_steps_check', 'installation_acceptances', installationAcceptance({ steps: json({}) })],
  ['installation_acceptances_steps_no_secret_keys_check', 'installation_acceptances', installationAcceptance({ steps: json([{ id: 'A', password: 'x' }]) })],
  ['installation_acceptances_steps_bound_check', 'installation_acceptances', installationAcceptance({ steps: json([{ id: 'A', detail: 'x'.repeat(201) }]) })],
  ['installation_acceptances_diagnostics_check', 'installation_acceptances', installationAcceptance({ diagnostics: json([]) })],
  ['installation_acceptances_diagnostics_no_secret_keys_check', 'installation_acceptances', installationAcceptance({ diagnostics: json({ checks: [{ params: { token: 'x' } }] }) })],
  ['installation_acceptances_diagnostics_bound_check', 'installation_acceptances', installationAcceptance({ diagnostics: json({ note: 'x'.repeat(201) }) })],
  ['installation_acceptances_revoked_at_check', 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, revoked_at: T - 1 })],
  ['installation_acceptances_revoke_check', 'installation_acceptances', installationAcceptance({ revoked_at: T + 5_000 })],
];

/**
 * CHECKs that no single row can break alone, with what refuses the row first. They are part of
 * the contract and of the catalog (the catalog test compares their text); here the test shows
 * what a row that breaks them actually meets.
 */
const SHADOWED: ReadonlyArray<readonly [string, string, Row, string, string | undefined]> = [
  // The guard trigger runs before the CHECKs and refuses a sequence that does not continue the head.
  ['audit_log_seq_check', 'audit_log', auditRow({ seq: 0, id: 'AUD-000000' }), SQLSTATE.chainDiscontinuity, undefined],
  // The lifecycle rule lists the three states, so an unknown state breaks it too; CHECKs run in name order.
  ['paired_devices_state_check', 'paired_devices', pairedDevice('DEV-0099', 'PCD-000001', { state: 'LOST' }), SQLSTATE.checkViolation, 'paired_devices_lifecycle_check'],
  // v2, the same shape: every kind outside (CAMERA, MIC, POE) also breaks capture_devices_id_check
  // (its branch list names the three kinds) - and, since dbc-4, capture_devices_adapter_pairing_check,
  // whose three branches name the same kinds and which comes first in name order.
  ['capture_devices_kind_check', 'capture_devices', captureDevice('CAM-01', 'CAMERA', { kind: 'SPEAKER' }), SQLSTATE.checkViolation, 'capture_devices_adapter_pairing_check'],
  // v2 again: every kind outside (REFERENCE, ENCRYPTED) also breaks stt_config_credential_check, whose
  // three branches name the same set; that one comes first in name order.
  ['stt_config_credential_kind_check', 'stt_config', sttConfig({ credential_kind: 'PLAIN' }), SQLSTATE.checkViolation, 'stt_config_credential_check'],
  // v3, widened by D61 (2026-11-04): a ninth slot is in neither branch of
  // session_capture_sources_pairing_check, which comes first in name order.
  ['session_capture_sources_slot_check', 'session_capture_sources', captureSource('MIC-05'), SQLSTATE.checkViolation, 'session_capture_sources_pairing_check'],
];

async function insert(table: string, row: Row): Promise<void> {
  if (table === 'audit_log') await owner.query(AUDIT_INSERT, Object.values(row));
  else await insertRow(owner, table, row);
}

describe('CL-03: one refused row per named CHECK', () => {
  it('the list covers all 234 CHECKs of the contract: 229 directly, 5 that another rule refuses first', () => {
    const named = inventory.tables.flatMap((table) => table.constraints.filter((constraint) => constraint.kind === 'CHECK').map((constraint) => constraint.name));
    const covered = [...REFUSED_BY_CHECK.map(([name]) => name), ...SHADOWED.map(([name]) => name)];
    expect(named).toHaveLength(234);
    expect(REFUSED_BY_CHECK).toHaveLength(229);
    expect([...covered].sort()).toEqual([...named].sort());
    for (const [name, table] of [...REFUSED_BY_CHECK, ...SHADOWED]) expect(name.startsWith(`${table}_`), name).toBe(true);
  });

  it.each(REFUSED_BY_CHECK.map(([name, table, row]) => [name, table, row] as const))('%s refuses the row (23514)', async (name, table, row) => {
    await expectRefused(() => insert(table, row), SQLSTATE.checkViolation, name);
  });

  it.each(SHADOWED.map(([name, table, row, code, constraint]) => [name, code, constraint ?? 'the chain guard', table, row] as const))(
    '%s: a row that breaks it is refused with %s by %s',
    async (_name, code, by, table, row) => {
      await expectRefused(() => insert(table, row), code, by === 'the chain guard' ? undefined : by);
    },
  );

  it('nothing was written by the refused rows', async () => {
    for (const table of inventory.tables.map((entry) => entry.name)) {
      const expected = table === 'audit_chain_head' || table === 'schema_meta' ? 1 : 0;
      const { rows } = await owner.query<{ rows: number }>(`SELECT count(*)::int AS rows FROM public.${table}`);
      expect(rows[0]?.rows, table).toBe(expected);
    }
  });
});

describe('the valid rows are accepted: no CHECK is stricter than the contract', () => {
  it('one valid row in each of the 48 tables', async () => {
    await insertRbac(owner);
    await insertDevice(owner, 'DEV-0001', 'PCD-000001');
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000050'));
    await insertRow(owner, 'auth_sessions', authSession('valid'));
    await insertRow(owner, 'auth_sessions', authSession('valid-ended', { ended_at: T + 5, end_reason: 'SIGNED_OUT' }));
    await insertRow(owner, 'auth_sessions', authSession('valid-reuse', { method: 'BIOMETRIC', device_id: 'DEV-0001', ended_at: T + 5, end_reason: 'TOKEN_REUSE' }));
    await insertRow(owner, 'biometric_tokens', biometricToken('valid'));
    await insertRow(owner, 'registry_counters', { name: 'device', next_value: 2 });
    await insertRow(owner, 'registry_counters', { name: 'pairingCode', next_value: 51 });
    await insert('audit_log', nextAuditRow({ seq: 0, hash: ZEROS }, { actorId: 'OPR-002', details: { reason: 'fixture', manifestHash: ZEROS, attempts: 3, ok: true, none: null } }));
    await insertRow(owner, 'events', eventRow(1, { params: json({ kind: 'fixture', value: 1.5 }) }));
    await insertRow(owner, 'session_history', sessionHistory());
    await insertRow(owner, 'session_history', sessionHistory({ id: 'SES-20261001-0003', outcome: 'INCOMPLETE', fault_kind: 'POWER_FAIL', started_at: null, start_time_source: null }));
    await insertRow(owner, 'evidence_items', evidenceItem());
    // D60/D61 (2026-11-04): eight tracks - four video, four numbered audio channels, position 1..8.
    for (const [position, track] of ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'].entries()) {
      await insertRow(owner, 'evidence_tracks', evidenceTrack(track, position + 1));
    }
    await insertRow(owner, 'evidence_custody', evidenceCustody(1));
    await insertRow(owner, 'exports', exportRecord('EXP-000001'));
    await insertRow(owner, 'exports', exportRecord('EXP-000002', { scope: 'AUDIT', evidence_id: null }));
    await insertRow(owner, 'alerts', alert('ALR-000001', { params: json({ kind: 'STORAGE_LOW', target: null }) }));
    await insertRow(owner, 'alerts', alert('ALR-000002', { kind: 'SYSTEM' }));
    // schema v6 (PE-0013-01): two causes of one kind on one device are two rows; a cause on a SYSTEM alert.
    await insertRow(owner, 'alerts', alert('ALR-000003', { kind: 'CAPTURE_FAULT', severity: 'CRITICAL', target: 'MIC-01', reason: 'MIC_DISCONNECTED' }));
    await insertRow(owner, 'alerts', alert('ALR-000004', { kind: 'CAPTURE_FAULT', severity: 'CRITICAL', target: 'MIC-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' }));
    await insertRow(owner, 'alerts', alert('ALR-000005', { kind: 'SYSTEM', severity: 'INFO', target: 'MIC-01', reason: 'MIC_RATE_AT_LIMIT' }));
    await insertRow(owner, 'storage_policy', storagePolicy());
    await insertRow(owner, 'console_settings', consoleSettings());
    for (const name of ['event', 'session', 'caseNumber', 'evidence', 'item', 'export']) {
      await insertRow(owner, 'engine_counters', { name, next_value: 1 });
    }
    await insertRow(owner, 'core_device', coreDevice());
    await insertRow(owner, 'core_state', coreState());
    await insertRow(owner, 'hardware_snapshot', hardwareSnapshot());
    await insertRow(owner, 'health_snapshots', healthSnapshot());
    await insertRow(owner, 'health_snapshots', healthSnapshot({ cause: 'FAULT_RAISED', fault_kind: 'TAMPER', session_state: 'RECORDING', active_faults: 1 }));
    await insertRow(owner, 'active_session', activeSession());
    await insertRow(owner, 'audit_chain_history', lineageRow(1, { actor_id: 'OPR-002' }));
    // ── schema v2 (dbc-3 §B): one valid row for each of the ten new tables. Devices first — the
    //    capture configuration and the intervals point at them. ──
    await insertRow(owner, 'capture_devices', captureDevice('CAM-01', 'CAMERA'));
    await insertRow(owner, 'capture_devices', captureDevice('CAM-02', 'CAMERA'));
    await insertRow(owner, 'capture_devices', captureDevice('MIC-01', 'MIC'));
    await insertRow(owner, 'capture_devices', captureDevice('MIC-02', 'MIC'));
    // D61 (2026-11-04): the four channels feed their built-ins, so MIC-03/04 exist too.
    await insertRow(owner, 'capture_devices', captureDevice('MIC-03', 'MIC'));
    await insertRow(owner, 'capture_devices', captureDevice('MIC-04', 'MIC'));
    await insertRow(owner, 'capture_devices', captureDevice('POE-A1', 'POE', { poe_port: 'P1' }));
    await insertRow(owner, 'capture_config', captureConfig());
    await insertRow(owner, 'capture_device_credentials', captureDeviceCredential('CAM-01'));
    // schema v3 (dbc-4 §N.3), widened by D60/D61 (2026-11-04): the eight source rows of the session
    // (four video tracks, four microphone channels), before its first interval.
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) await insertRow(owner, 'session_capture_sources', captureSource(slot));
    await insertRow(owner, 'session_audio_intervals', audioInterval(1));
    await insertRow(owner, 'recording_fragments', recordingFragment(SESSION_ID, 'VIDEO-01', 1));
    // D28 / 0044 (row 146): the first fragment of each microphone channel file is a valid row too.
    for (const track of ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04']) await insertRow(owner, 'recording_fragments', recordingFragment(SESSION_ID, track as 'VIDEO-01', 1));
    await insertRow(owner, 'transcript_chunks', transcriptChunk(1, { status: 'DONE', segments: json([]), computed_at: T + 60_000 }));
    await insertRow(owner, 'transcripts', transcript());
    await insertRow(owner, 'transcript_revisions', transcriptRevision(1));
    await insertRow(owner, 'sealing_jobs', sealingJob('FRAGMENTS', { status: 'DONE', progress: 100, eta_ms: null, checkpoint: json({ offset: 1 }) }));
    await insertRow(owner, 'sealing_jobs', sealingJob('MANIFEST', { status: 'DONE', progress: 100, eta_ms: null }));
    await insertRow(owner, 'stt_config', sttConfig());
    // schema v5 (PE-129b-01): the session's STT snapshot, and one for a disabled local backend.
    await insertRow(owner, 'session_stt_config', sessionSttSnapshot());
    await insertRow(owner, 'session_stt_config', sessionSttSnapshot({ session_id: 'SES-20261001-0003', enabled: false, backend: 'cpu-local', endpoint: null, credential_kind: null }));
    // schema v6 (PE-0013-01): the media store root; and the two key ids of the specification on a revision.
    await insertRow(owner, 'core_media_store', mediaStore());
    await insertRow(owner, 'transcript_revisions', transcriptRevision(8, { signature_key_id: 'CORE-KEY-EVSIGN-01' }));
    await insertRow(owner, 'transcript_revisions', transcriptRevision(9, { signature_key_id: 'DEMO-KEY-EVSIGN-01' }));
    // schema v7 (task 4 schema set A): the main and the sub stream of one camera, and a second
    // statement for the same lens and role (the index is plain: addendum 7.2); a stream no test
    // has read yet (no codec, no size, no video source); one input of a sound card (MIC-02 keeps
    // no row: the foreign-key list below needs a microphone without one).
    await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P'));
    await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_360P', { onvif_profile_token: 'profile_2', stream_role: 'SUB', width: 640, height: 360 }));
    await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-01', 'H264_1080P25', { codec: 'H264' }));
    await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-02', 'H264_1080P25', { video_source_token: null, codec: null, width: null, height: null }));
    await insertRow(owner, 'capture_audio_inputs', captureAudioInput('MIC-01', { usb_id: null }));
    // schema v8 (task 4 schema set B): the network settings with a list of two addresses; an
    // alias that was removed, one whose removal failed and is therefore still open; the serial and
    // the port of a sound card are NULL above (a card that states neither) - they are set here.
    await insertRow(owner, 'capture_network_config', captureNetworkConfig({ factory_addresses: json(['192.168.1.64', '10.0.0.2']) }));
    await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED, removed_by: 'OPR-001' }));
    await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ address: '10.20.30.254/24', reason: 'SET_CAMERA_ADDRESS', remove_error: 'DEL_FAILED' }));
    await owner.query("UPDATE public.capture_audio_inputs SET usb_serial = 'A1B2-C3.D4_E5:F6', usb_port = '1-1.4' WHERE device_id = 'MIC-01'");
    // schema v11 (task 4 schema set C): an acceptance that was revoked, the one in force after it,
    // and a revoked one with no site address, no step and empty diagnostics (the bounds are upper bounds).
    await insertRow(owner, 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED }));
    await insertRow(owner, 'installation_acceptances', installationAcceptance({ accepted_at: T + 10_000 }));
    await insertRow(owner, 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, site_address: null, steps: json([]), diagnostics: json({}) }));

    const { rows } = await owner.query<{ empty: string }>(
      inventory.tables.map((table) => `SELECT '${table.name}' AS empty WHERE NOT EXISTS (SELECT 1 FROM public.${table.name})`).join(' UNION ALL '),
    );
    expect(rows).toEqual([]);
  });

  it('the defaults of the contract are what an INSERT without the column gets', async () => {
    await owner.query(
      "INSERT INTO operators (id, username, name, display_name, initials, role_id, created_at, updated_at) VALUES ('OPR-070', 'fixture.defaults', 'D', 'D', 'D', 'TECHNICIAN', 1, 1)",
    );
    expect((await owner.query("SELECT enabled, rank, last_sign_in_at FROM operators WHERE id = 'OPR-070'")).rows).toEqual([
      { enabled: true, rank: null, last_sign_in_at: null },
    ]);
    const generated = await owner.query(
      "INSERT INTO auth_sessions (token_hash, operator_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, 'OPR-070', 'PASSWORD', 1, 1, 2) RETURNING id",
      [hash32('defaults')],
    );
    expect(generated.rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const code = await owner.query(
      "INSERT INTO pairing_codes (id, code_hash, state, issued_by_operator_id, issued_at, expires_at, closed_at) VALUES ('PCD-000070', $1, 'EXPIRED', 'OPR-070', 1, 2, 3) RETURNING failed_attempts",
      [hash32('defaults-code')],
    );
    expect(code.rows).toEqual([{ failed_attempts: 0 }]);
    const event = await owner.query(
      "INSERT INTO events (seq, id, at, type, category, severity, message) VALUES (2, 'LOG-000002', 1, 'SESSION_CREATED', 'SESSION', 'INFO', 'm') RETURNING params",
    );
    expect(event.rows).toEqual([{ params: {} }]);
    const item = await owner.query(
      "SELECT signature_simulated, verification_status, tampered, markers, notes FROM evidence_items",
    );
    expect(item.rows).toEqual([{ signature_simulated: true, verification_status: 'NOT_RUN', tampered: false, markers: [], notes: [] }]);
  });
});

describe('CL-02: every reference is a foreign key with ON DELETE RESTRICT', () => {
  /** `[foreign key, table, row]`: a valid row whose parent does not exist. */
  const UNKNOWN_PARENT: ReadonlyArray<readonly [string, string, Row]> = [
    ['role_permissions_role_id_fkey', 'role_permissions', { role_id: 'NOBODY', permission_id: 'USER_ADMIN' }],
    ['role_permissions_permission_id_fkey', 'role_permissions', { role_id: 'TECHNICIAN', permission_id: 'UNKNOWN_PERMISSION' }],
    ['operators_role_id_fkey', 'operators', operator('OPR-050', 'fixture.fifty', 'NOBODY')],
    ['operator_credentials_operator_id_fkey', 'operator_credentials', operatorCredential('OPR-777')],
    ['auth_sessions_operator_id_fkey', 'auth_sessions', authSession('fk-1', { operator_id: 'OPR-777' })],
    ['auth_sessions_device_id_fkey', 'auth_sessions', authSession('fk-2', { device_id: 'DEV-7777' })],
    ['pairing_codes_issued_by_operator_id_fkey', 'pairing_codes', pairingCode('PCD-000777', { issued_by_operator_id: 'OPR-777' })],
    ['pairing_codes_closed_by_operator_id_fkey', 'pairing_codes', pairingCode('PCD-000778', { state: 'CANCELLED', closed_by_operator_id: 'OPR-777' })],
    ['paired_devices_paired_with_code_id_fkey', 'paired_devices', pairedDevice('DEV-0777', 'PCD-777777')],
    [
      'paired_devices_revoked_by_operator_id_fkey',
      'paired_devices',
      pairedDevice('DEV-0778', 'PCD-000050', { state: 'REVOKED', revoked_at: T + 2_000, revoked_by_operator_id: 'OPR-777', revoke_reason: 'fixture reason' }),
    ],
    ['device_credentials_device_id_fkey', 'device_credentials', deviceCredential('DEV-7777')],
    ['biometric_tokens_device_id_fkey', 'biometric_tokens', biometricToken('fk-1', { device_id: 'DEV-7777' })],
    ['biometric_tokens_operator_id_fkey', 'biometric_tokens', biometricToken('fk-2', { operator_id: 'OPR-777' })],
    ['active_session_investigator_id_fkey', 'active_session', activeSession({ investigator_id: 'OPR-777' })],
    ['active_session_created_by_fkey', 'active_session', activeSession({ created_by: 'OPR-777' })],
    ['session_history_investigator_id_fkey', 'session_history', sessionHistory({ id: 'SES-20261001-0777', investigator_id: 'OPR-777' })],
    ['evidence_items_session_id_fkey', 'evidence_items', evidenceItem({ id: 'EV-20261001-0777', session_id: 'SES-20261001-0999' })],
    ['evidence_items_investigator_id_fkey', 'evidence_items', evidenceItem({ id: 'EV-20261001-0778', session_id: 'SES-20261001-0003', investigator_id: 'OPR-777' })],
    ['evidence_tracks_evidence_id_fkey', 'evidence_tracks', evidenceTrack('VIDEO-01', 1, { evidence_id: 'EV-20261001-0999' })],
    ['evidence_custody_evidence_id_fkey', 'evidence_custody', evidenceCustody(1, { evidence_id: 'EV-20261001-0999' })],
    ['evidence_custody_actor_id_fkey', 'evidence_custody', evidenceCustody(9, { actor_id: 'OPR-777' })],
    ['exports_evidence_id_fkey', 'exports', exportRecord('EXP-000777', { evidence_id: 'EV-20261001-0999' })],
    ['exports_operator_id_fkey', 'exports', exportRecord('EXP-000778', { operator_id: 'OPR-777' })],
    ['audit_chain_history_actor_id_fkey', 'audit_chain_history', lineageRow(9, { actor_id: 'OPR-777' })],
    // ── schema v2 (dbc-3 §B): every new foreign key, with the parent missing. The rows break no
    //    CHECK, so the foreign key is what refuses them. ──
    ['active_session_started_by_fkey', 'active_session', activeSession({ started_by: 'OPR-777' })],
    ['active_session_stopped_by_fkey', 'active_session', activeSession({ stopped_by: 'OPR-777' })],
    ['capture_config_video_01_device_id_fkey', 'capture_config', captureConfig({ video_01_device_id: 'CAM-99' })],
    ['capture_config_video_02_device_id_fkey', 'capture_config', captureConfig({ video_02_device_id: 'CAM-99' })],
    // D60 (2026-11-04) added the third and fourth camera pairs' keys; D61 (2026-11-04) renamed the
    // two mic roles and added the third and fourth channels (0040).
    ['capture_config_video_03_device_id_fkey', 'capture_config', captureConfig({ video_03_device_id: 'CAM-99', video_03_profile: 'FHD' })],
    ['capture_config_video_04_device_id_fkey', 'capture_config', captureConfig({ video_04_device_id: 'CAM-99', video_04_profile: 'FHD' })],
    ['capture_config_mic_01_id_fkey', 'capture_config', captureConfig({ mic_01_id: 'MIC-99' })],
    ['capture_config_mic_02_id_fkey', 'capture_config', captureConfig({ mic_02_id: 'MIC-99' })],
    ['capture_config_mic_03_id_fkey', 'capture_config', captureConfig({ mic_03_id: 'MIC-99' })],
    ['capture_config_mic_04_id_fkey', 'capture_config', captureConfig({ mic_04_id: 'MIC-99' })],
    ['capture_config_updated_by_fkey', 'capture_config', captureConfig({ updated_by: 'OPR-777' })],
    ['capture_device_credentials_device_id_fkey', 'capture_device_credentials', captureDeviceCredential('CAM-99')],
    ['session_audio_intervals_mic_device_id_fkey', 'session_audio_intervals', audioInterval(2, { mic_device_id: 'MIC-99', from_media_ms: 100, to_media_ms: 200, from_at: T + 100, to_at: T + 200, reason: 'MANUAL' })],
    ['session_audio_intervals_switched_by_fkey', 'session_audio_intervals', audioInterval(3, { switched_by: 'OPR-777', from_media_ms: 200, to_media_ms: 300, from_at: T + 200, to_at: T + 300, reason: 'MANUAL' })],
    ['transcripts_evidence_id_fkey', 'transcripts', transcript({ evidence_id: 'EV-20261001-0999' })],
    ['transcript_revisions_evidence_id_fkey', 'transcript_revisions', transcriptRevision(1, { evidence_id: 'EV-20261001-0999' })],
    ['transcript_revisions_author_id_fkey', 'transcript_revisions', transcriptRevision(2, { author_id: 'OPR-777' })],
    ['stt_config_updated_by_fkey', 'stt_config', sttConfig({ updated_by: 'OPR-777' })],
    // schema v3 (dbc-4 §N.3): the one new foreign key, with an unknown device.
    ['session_capture_sources_device_id_fkey', 'session_capture_sources', captureSource('VIDEO-01', { session_id: 'SES-20261001-0777', device_id: 'CAM-99' })],
    // schema v7 (task 4 schema set A): the three new foreign keys - an unknown camera, an unknown
    // microphone, and an unknown operator on the input of a microphone that has no row yet.
    ['capture_device_streams_device_id_fkey', 'capture_device_streams', captureDeviceStream('CAM-99', 'HEVC_1080P')],
    ['capture_audio_inputs_device_id_fkey', 'capture_audio_inputs', captureAudioInput('MIC-99', { input_number: 3 })],
    ['capture_audio_inputs_updated_by_fkey', 'capture_audio_inputs', captureAudioInput('MIC-02', { input_number: 2, updated_by: 'OPR-777' })],
    // schema v8 (task 4 schema set B): the three new foreign keys, each with an unknown operator.
    // The two alias rows are CLOSED ones: an open row would meet the one-open rule first.
    ['capture_network_config_updated_by_fkey', 'capture_network_config', captureNetworkConfig({ updated_by: 'OPR-777' })],
    ['host_network_aliases_added_by_fkey', 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED, added_by: 'OPR-777' })],
    ['host_network_aliases_removed_by_fkey', 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED, removed_by: 'OPR-777' })],
    // schema v11 (task 4 schema set C): the two new foreign keys, each with an unknown operator.
    // Both rows are REVOKED ones: a row in force would meet the one-in-force rule first.
    ['installation_acceptances_accepted_by_fkey', 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, accepted_by: 'OPR-777' })],
    ['installation_acceptances_revoked_by_fkey', 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, revoked_by: 'OPR-777' })],
    // schema v15 (set 16, design 07): who retired a device, an unknown operator.
    ['capture_devices_retired_by_fkey', 'capture_devices', captureDevice('CAM-77', 'CAMERA', { retired_at: T, retired_by: 'OPR-777' })],
  ];

  it('the list covers all 53 foreign keys of the contract', () => {
    const named = inventory.tables.flatMap((table) => table.constraints.filter((constraint) => constraint.kind === 'FOREIGN KEY').map((constraint) => constraint.name));
    expect(named).toHaveLength(53);
    expect([...UNKNOWN_PARENT.map(([name]) => name), 'audit_log_actor_id_fkey'].sort()).toEqual([...named].sort());
  });

  it.each(UNKNOWN_PARENT.map(([name, table, row]) => [name, table, row] as const))('%s refuses a row whose parent does not exist (23503)', async (name, table, row) => {
    // `active_session` holds its one row already; the foreign key is still what refuses first? No:
    // the primary key would. The test therefore removes that row for the two active_session cases.
    // Schema v2 adds the same single-row shape to `capture_config` and `stt_config`.
    // Schema v8 adds it to `capture_network_config`.
    if (['active_session', 'capture_config', 'stt_config', 'capture_network_config'].includes(table)) await owner.query(`DELETE FROM public.${table}`);
    try {
      await expectRefused(() => insert(table, row), SQLSTATE.foreignKeyViolation, name);
    } finally {
      if (table === 'active_session') await insertRow(owner, 'active_session', activeSession());
      if (table === 'capture_config') await insertRow(owner, 'capture_config', captureConfig());
      if (table === 'stt_config') await insertRow(owner, 'stt_config', sttConfig());
      if (table === 'capture_network_config') await insertRow(owner, 'capture_network_config', captureNetworkConfig());
    }
  });

  it('audit_log_actor_id_fkey refuses an audit row that names an unknown operator (23503)', async () => {
    const head = (await owner.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head')).rows[0];
    const row = nextAuditRow({ seq: Number(head?.seq), hash: String(head?.hash) }, { actorId: 'OPR-777' });
    await expectRefused(() => insert('audit_log', row), SQLSTATE.foreignKeyViolation, 'audit_log_actor_id_fkey');
  });

  it('a referenced row cannot be deleted: SQLSTATE 23001 on PostgreSQL 18, never a cascade (K-2, D38)', async () => {
    const before = await owner.query<{ total: number }>(
      `SELECT (SELECT count(*) FROM operators)::int + (SELECT count(*) FROM auth_sessions)::int + (SELECT count(*) FROM evidence_tracks)::int AS total`,
    );
    const statements = [
      "DELETE FROM operators WHERE id = 'OPR-002'",
      "DELETE FROM roles WHERE id = 'SUPERVISOR'",
      "DELETE FROM permissions WHERE id = 'USER_ADMIN'",
      "DELETE FROM pairing_codes WHERE id = 'PCD-000001'",
      "DELETE FROM paired_devices WHERE id = 'DEV-0001'",
      `DELETE FROM session_history WHERE id = '${SESSION_ID}'`,
      `DELETE FROM evidence_items WHERE id = '${EVIDENCE_ID}'`,
    ];
    for (const statement of statements) {
      const refusal = await expectRefused(() => owner.query(statement), SQLSTATE.restrictViolation);
      expect(refusal.message, statement).toContain('violates RESTRICT setting of foreign key constraint');
    }
    // ON UPDATE NO ACTION: a key that is referenced cannot be changed either (23503).
    await expectRefused(() => owner.query("UPDATE operators SET id = 'OPR-099' WHERE id = 'OPR-002'"), SQLSTATE.foreignKeyViolation);
    const after = await owner.query<{ total: number }>(
      `SELECT (SELECT count(*) FROM operators)::int + (SELECT count(*) FROM auth_sessions)::int + (SELECT count(*) FROM evidence_tracks)::int AS total`,
    );
    expect(after.rows).toEqual(before.rows);
  });
});

describe('CL-04: business uniqueness is in the database', () => {
  /** `[constraint or index, statement]`: each breaks exactly that rule. */
  const duplicate = (name: string, work: () => Promise<unknown>) => expectRefused(work, SQLSTATE.uniqueViolation, name);

  it('one username; one sort position; one row per token hash and credential hash', async () => {
    await duplicate('operators_username_key', () => insertRow(owner, 'operators', operator('OPR-060', 'fixture.investigator', 'INVESTIGATOR')));
    await duplicate('roles_sort_order_key', () => owner.query("UPDATE roles SET sort_order = 1 WHERE id = 'SUPERVISOR'"));
    await duplicate('permissions_sort_order_key', () => insertRow(owner, 'permissions', { id: 'EXTRA_PERMISSION', sort_order: 1 }));
    await duplicate('auth_sessions_token_hash_key', () => insertRow(owner, 'auth_sessions', authSession('valid', { operator_id: 'OPR-001' })));
    await duplicate('biometric_tokens_token_hash_key', () =>
      insertRow(owner, 'biometric_tokens', biometricToken('valid', { used_at: T + 1 })),
    );
    // A second device needs a code of its own, so the credential rules are shown on a second device.
    await insertRow(owner, 'paired_devices', pairedDevice('DEV-0002', 'PCD-000050'));
    await duplicate('device_credentials_current_hash_key', () =>
      insertRow(owner, 'device_credentials', deviceCredential('DEV-0002', { current_hash: hash32('device-credential:DEV-0001') })),
    );
    await owner.query("UPDATE device_credentials SET next_hash = $1 WHERE device_id = 'DEV-0001'", [hash32('next')]);
    await duplicate('device_credentials_next_hash_key', () => insertRow(owner, 'device_credentials', deviceCredential('DEV-0002', { next_hash: hash32('next') })));
    await insertRow(owner, 'device_credentials', deviceCredential('DEV-0002'));
    await duplicate('device_credentials_pkey', () => insertRow(owner, 'device_credentials', deviceCredential('DEV-0002', { current_hash: hash32('another') })));
  });

  it('one device per code; one evidence item per session; one track per position; one discarded chain per epoch', async () => {
    await duplicate('paired_devices_paired_with_code_id_key', () => insertRow(owner, 'paired_devices', pairedDevice('DEV-0003', 'PCD-000001')));
    await duplicate('evidence_items_session_id_key', () => insertRow(owner, 'evidence_items', evidenceItem({ id: 'EV-20261001-0002' })));
    await owner.query("DELETE FROM evidence_tracks WHERE track_id = 'AUDIO-02'");
    await duplicate('evidence_tracks_evidence_id_position_key', () => insertRow(owner, 'evidence_tracks', evidenceTrack('AUDIO-02', 1)));
    await duplicate('evidence_tracks_pkey', () => insertRow(owner, 'evidence_tracks', evidenceTrack('VIDEO-01', 4)));
    await duplicate('audit_chain_history_epoch_key', () => insertRow(owner, 'audit_chain_history', lineageRow(2, { epoch: 0 })));
    await duplicate('role_permissions_pkey', () => insertRow(owner, 'role_permissions', { role_id: 'SUPERVISOR', permission_id: 'USER_ADMIN' }));
  });

  it('one active session per Core: a second row of active_session is refused', async () => {
    await duplicate('active_session_pkey', () => insertRow(owner, 'active_session', activeSession({ id: 'SES-20261001-0009', case_number: 'LP/2026/1001-0009' })));
  });

  it('a unique index with a WHERE clause binds only the rows that satisfy it (PG-08)', async () => {
    // One ACTIVE code at a time; any number of closed ones.
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000060', { state: 'ACTIVE', closed_at: null }));
    await duplicate('pairing_codes_one_active_key', () => insertRow(owner, 'pairing_codes', pairingCode('PCD-000061', { state: 'ACTIVE', closed_at: null })));
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000062', { state: 'EXPIRED' }));
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000063', { state: 'EXPIRED' }));

    // One live biometric token per device and operator; any number of used or revoked ones.
    await duplicate('biometric_tokens_one_live_key', () => insertRow(owner, 'biometric_tokens', biometricToken('second-live')));
    await insertRow(owner, 'biometric_tokens', biometricToken('used-1', { used_at: T + 1 }));
    await insertRow(owner, 'biometric_tokens', biometricToken('used-2', { used_at: T + 1 }));
    await insertRow(owner, 'biometric_tokens', biometricToken('revoked-1', { revoked_at: T + 1, revoke_reason: 'DISABLED' }));
    // The same device with another operator is another key.
    await insertRow(owner, 'biometric_tokens', biometricToken('other-operator', { operator_id: 'OPR-001' }));
  });

  it('a hash can appear in the chain once: a row that continues the head with an earlier hash is refused (G-5)', async () => {
    const rows = (await owner.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_log ORDER BY seq')).rows;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const next = nextAuditRow({ seq: Number(last?.seq), hash: String(last?.hash) });
    // With one row in the log the earlier hash is also the head, which the hashes CHECK refuses; add a row first.
    await insert('audit_log', next);
    const forged = { ...nextAuditRow({ seq: Number(next['seq']), hash: String(next['hash']) }), hash: String(first?.hash) };
    await duplicate('audit_log_hash_key', () => insert('audit_log', forged));
  });
});
