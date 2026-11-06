---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: database-specialist (row 4, run on the sonnet model)
source_plan: identification/02_structured.md (row 4, Execution Profile row 4, goal G2)
status: complete
tier: 2
---

# Row 4: What the Core holds for each of the eight record kinds of goal G2

## Method and limits

- Source of every statement: the Drizzle schema declarations and the module files named below, read directly, plus the Graft/grep searches whose pattern is quoted. Evidence form is `file:line` relative to `/Users/gsp-budi/Documents/DEMS/`.
- No database connection, no migration, no PostgreSQL start, nothing under `apps/input-av/data/`, no `.env`. Inventory only, no verdict on input-av.
- The typed schema declares 43 tables (header of `apps/core-server/src/db/schema/index.ts:2`); the `pgTable(` search over `db/schema/*.ts` returned 43 declarations (grep `pgTable(\|pgEnum(`, run 2026-10-12). Migrations: 15 `.sql` files in `apps/core-server/src/db/migrations/`. Privileges (GRANT lists) live in the migrations, not in the schema files; they are quoted from schema comments only, not re-read from the SQL, except where stated.
- Abbreviations: `S` = `apps/core-server/src/db/schema/`, `M` = `apps/core-server/src/modules/`, `MAP` = `apps/core-server/src/db/mapping/`.

## Summary table (the row 4 check: one declaration or "none found" per kind)

| # | Record kind | Core record | Declaration | Verdict of the search |
|---|---|---|---|---|
| 1 | Session | Tables `active_session` (0 or 1 row) and `session_history` (one per finished session); plus session-scoped tables `session_capture_sources`, `session_audio_intervals`, `recording_fragments`, `sealing_jobs`, `session_stt_config` | `S/sessions.ts:40`, `S/sessions.ts:141`, `S/recording.ts:183`, `:42`, `:99`, `:137`, `S/stt.ts:134` | Found |
| 2 | Recording or evidence file | Metadata: `evidence_items`, `evidence_tracks`, `evidence_custody`, `exports`, `recording_fragments`. The bytes are FILES on the media store, not table columns | `S/evidence.ts:66`, `:206`, `:250`, `:286`; `S/recording.ts:99`; file layout `sealing/pipeline/contract.ts:7-26` | Found (table plus file) |
| 3 | Audit entry | Tables `audit_log` (hash chain), `audit_chain_head`, `audit_chain_history`; unchained operational `events` | `S/audit.ts:34`, `:91`, `:142`, `:105` | Found |
| 4 | User or role | `roles`, `permissions`, `role_permissions`, `operators`, `operator_credentials`; sign-in sessions `auth_sessions` | `S/rbac.ts:28`, `:41`, `:54`, `:77`, `:112`; `S/identity.ts:18` | Found |
| 5 | Device registry entry | `capture_devices` (capture hardware registry) and, separately, `paired_devices` (client apps) | `S/capture.ts:38`; `S/pairing.ts:88` | Found |
| 6 | Camera credential | `capture_device_credentials` (AES-256-GCM envelope; key kept in the file credential store) | `S/capture.ts:164`; `credential-store/index.ts:78` | Found |
| 7 | Setting | `capture_config` (device selector), `storage_policy`, `console_settings`, `stt_config`, `core_media_store` | `S/capture.ts:94`; `S/core.ts:103`, `:122`, `:294`; `S/stt.ts:46` | Found |
| 8 | Marker | NO table. Stored inside other records: a count on `active_session`, a `TimelineEvent` of kind `MARKER` in `active_session.timeline`, and `evidence_items.markers` (jsonb array of `EvidenceMarker`); plus audit type `MARKER_ADDED` | `S/sessions.ts:60`, `:68`; `S/evidence.ts:94`; `packages/shared/src/sim/types.ts:1116` | Found as embedded data; no own table (search below) |

## 1. Session

| Item | Detail | Evidence |
|---|---|---|
| Active session | Table `active_session`. Primary key `singleton` (boolean): "one active session per Core" is a database rule. Columns: `id`, `state`, `case_number`, `subject_type`, `subject_name`, `investigator_id`, `room`, `profile_id`, `input_notes`, `created_at`, `created_by`, `armed_at`, `started_at`, `stopped_at`, `stop_reason`, `sealed_at`, `marker_count`, `snapshot_count`, `bytes_written`, `evidence_id`, `start_time_source`, `stop_time_source`, `precheck` (jsonb), `finalization` (jsonb), `timeline` (jsonb array, max 200 items), `notes` (jsonb array), `fault`, `recovery`, `updated_at`; schema v2 adds `started_by`, `stopped_by`, `capture_config` (jsonb snapshot of the selector at start), `audio_source` (jsonb), `transcript_status` (jsonb) | `S/sessions.ts:40-85`; constraints `:86-137` |
| One-session rule | Primary key on `singleton`; the only table the runtime role may DELETE from | `S/sessions.ts:35-39` |
| Finished session | Table `session_history`: `id` (pk), `outcome` (`SEALED` or `INCOMPLETE`), `case_number`, `subject_name`, `subject_type`, `investigator_id`, `room`, `profile_id`, `created_at`, `started_at`, `ended_at`, `duration_ms`, `size_bytes`, `fault_kind`, `start_time_source`, `end_time_source`. Never changed after insert | `S/sessions.ts:141-160`; `S/sessions.ts:140` (comment) |
| Session value sets | `SESSION_STATE` 9 states are listed at `S/value-sets.ts:39-49`; `SESSION_OUTCOME` `['SEALED','INCOMPLETE']`; `SUBJECT_TYPE` `['TERSANGKA','SAKSI','LAINNYA']`; `PROFILE` `['STANDARD_1080P25']` (the only profile id); `TIME_SOURCE` `['GNSS','NTP','RTC']` | `S/value-sets.ts:39,50,51,52,53` |
| Which source/device fed the session | Table `session_capture_sources`: 4 rows per session (slots `VIDEO-01`, `VIDEO-02`, `MIC-PRIMARY`, `MIC-STANDBY`), columns `session_id`, `slot`, `device_id` (FK `capture_devices.id`), `adapter_kind`, `recorded_at`. Insert-only | `S/recording.ts:183-210`; slot set `S/value-sets.ts:151` |
| Mic switching inside a session | Table `session_audio_intervals` (pk `session_id, seq`), columns `mic_device_id`, `role` (`PRIMARY`/`STANDBY`), `from_media_ms`, `to_media_ms`, `from_at`, `to_at`, `switched_by`, `reason` (`START`/`MANUAL`/`STOP`); partial unique index "one open interval per session" | `S/recording.ts:42-90`; sets `S/value-sets.ts:155,157` |
| Sealing progress | Table `sealing_jobs` (pk `session_id, step`), columns `status` (`RUNNING`/`DONE`/`FAILED`), `progress`, `eta_ms`, `attempt`, `checkpoint` (jsonb), `error_code`, `started_at`, `updated_at` | `S/recording.ts:137-162` |
| Per-session transcription configuration | Table `session_stt_config` | `S/stt.ts:134` (columns not read in this row) |
| Who writes it | Not by a hand-written INSERT in a module: the engine state is diffed and mapped. `activeSessionToRow` builds the row; the change planner emits `delete` and `insert` (or a column update) on `activeSession`. History row by `sessionHistoryToRow`. Session-start source rows by the constant `INSERT_SESSION_CAPTURE_SOURCES`; audio intervals by `INSERT_AUDIO_INTERVAL`; journal by `WRITE_SEALING_STEP` | `MAP/rows.ts:980`, `MAP/rows.ts:347`; `MAP/changes.ts:255,260-261`; `engine/write-plan.ts:117-134` (`applyPlan`); `capture-session/statements.ts:20,34`; `sealing/step-journal.ts:84` |
| Module that serves it | `modules/sessions/` (operations 25-34 per header; `routes.ts`, `operations.ts`, `current.ts`, `history.ts`, `audio-intervals.ts`) | `M/sessions/index.ts:6`; `M/sessions/routes.ts:16` |
| Derived-from-slice list | The slice-to-table map: `session` to `active_session`; `sessionHistory` to `session_history`; `evidence` to `evidence_items`, `evidence_tracks`, `evidence_custody` | `MAP/slices.ts:139-154` (entries at lines 141, 144, 146) |

## 2. Recording or evidence file

Two layers: rows describing the file, and the file itself.

### 2a. Rows

| Table | Columns that matter for a file | Evidence |
|---|---|---|
| `evidence_items` (one per sealed item, unique `session_id`, FK to `session_history`) | `id`, `session_id`, `recorded_at`, `ended_at`, `sealed_at`, `duration_ms`, `size_bytes`, `status`, `lifecycle_stage`, `manifest_hash` (hex64), `signature_value`, `signature_key_id`, `signature_algorithm` (`SIMULATED-SHA256`/`Ed25519`/`ECDSA-P256-SHA256`), `signature_simulated`, `verification_status`, `verification_at`, `tampered`, `tampered_track_id`, `markers`, `notes`, `integrity_source` (`DEMO_PACKAGE`/`SIMULATED`/`REAL`), `manifest_version`, `transcript_sha256`, `labels_status`, `development_sources`. Runtime role may update only 7 columns (`status`, `lifecycle_stage`, `verification_status`, `verification_at`, `tampered`, `tampered_track_id`, `updated_at`) | `S/evidence.ts:66-114`; update list `MAP/changes.ts:64` |
| `evidence_tracks` (pk `evidence_id, track_id`; v2: one row per FILE, two camera files) | `track_id` (`VIDEO-01`, `VIDEO-02`, `AUDIO-01`, `AUDIO-02` allowed by check), `position` 1..4, `label`, `size_bytes`, `sha256` (stored bytes), `kind` (`FILE` only), `contains_audio` (check: always true), `codec`, `duration_ms`, `fragment_count`, `fragment_chain_head`, `sha256_plain` | `S/evidence.ts:206-247`; sets `S/value-sets.ts:54,165` |
| `evidence_custody` (pk `evidence_id, seq`) | `at`, `action` (open code set), `actor_id`, `detail` | `S/evidence.ts:250-278` |
| `exports` (table name; TS name `exportRecords`) | `id`, `scope` (`EVIDENCE`/`AUDIT`/`LOGS`), `evidence_id`, `operator_id`, `reason` (min 5 chars), `destination`, `at`. Derived from audit rows, no slice of its own | `S/evidence.ts:286-321`; `MAP/to-rows.ts:65,160` |
| `recording_fragments` (pk `session_id, track_id, seq`; insert-only) | `byte_offset`, `byte_length`, `media_start_ms`, `media_duration_ms`, `sha256` (stored fragment), `chain_hash`, `durable_at`; `track_id` is `VIDEO-01` or `VIDEO-02` | `S/recording.ts:99-128`; `modules/recording-fragments/statements.ts:54` |
| `core_media_store` (singleton) | `media_root` absolute POSIX path (max 1024), `recorded_at`. Kept across a reset | `S/core.ts:294-309` |
| Row builders | `evidenceItemToRow`, `evidenceTracksToRows`, `evidenceCustodyToRows`, `evidenceItemFromRows` | `MAP/rows.ts:495`, `:547`, `:584`, `:601` |
| Modules | `modules/evidence/` (reads, media, export request, verification), `modules/evidence-export/`, `modules/sealing/`, `modules/media-stream/` | directory listing of `apps/core-server/src/modules/` |

### 2b. Files on the media store (not table columns)

| File | Writer | Evidence |
|---|---|---|
| `SESSION-<sessionId>/VIDEO-0n.mp4`: the recording the capture worker writes, plaintext until sealed (n = 1, 2) | capture worker via `capture/` supervisor; read by the sealing pipeline | `sealing/pipeline/contract.ts:8`; `sealing/pipeline/sealed-plaintext.ts:10` |
| `fragments/VIDEO-0n.mp4` (sealed camera file: init segment clear, each fragment one AES-256-GCM message) and `fragments/fragments.json` (IV, tag, key id per fragment) | Core sealing step CLOSE_TRACKS | `sealing/pipeline/contract.ts:11-15` |
| `session-manifest.json`, `signature.sig`, certificate | Core sealing steps BUILD_MANIFEST and SIGN_MANIFEST | `sealing/pipeline/contract.ts:21-23` |
| Package files are written atomically (staging folder, fsync, rename) by `createPackageWriter` | `sealing/pipeline/package-writer.ts` | `sealing/pipeline/package-writer.ts:1-10,25-45` |
| `.sealing/<sessionId>/orphans/VIDEO-0n.mp4.<pid>.part` (files of a dead worker) | CLOSE_TRACKS; removed by the sweep | `sealing/pipeline/sealed-plaintext.ts:25,51` |
| `<mediaStoreRoot>/.quarantine/<sessionId>/` (plaintext that failed the removal proof) | `sealed-plaintext.ts` | `sealing/pipeline/sealed-plaintext.ts:19-23` |
| Transcript files (scratch, copied into the package with `copyIn`) | finalize-transcript step | `sealing/pipeline/package-writer.ts:20`; `sealing/finalize-transcript/` (not read further) |

Not established in this row: the exact `AUDIO-01` file name in the package (the stored audio is the session track carried inside the camera files per `S/evidence.ts:196-199` comment, "each carrying the single `AUDIO-01` session track"); the transcript file names.

## 3. Audit entry

| Item | Detail | Evidence |
|---|---|---|
| Chained log | Table `audit_log`: `seq` (pk), `id` (`AUD-<seq>`), `at`, `type` (open `CODE` format), `category` (`AUTH`, `SESSION`, `EVIDENCE`, `DEVICE`, `SECURITY`, `STORAGE`, `PAIRING`, `SYSTEM`), `severity` (`INFO`, `SUCCESS`, `WARNING`, `CRITICAL`), `actor_id` (FK `operators.id`), `message`, `session_id`, `evidence_id`, `device_id` (soft references, no FK), `details` (flat jsonb, a check refuses forbidden secret keys), `prev_hash`, `hash` (unique, hex64) | `S/audit.ts:34-85`; sets `S/value-sets.ts:16-26` |
| Chain head | `audit_chain_head` single row (`seq`, `hash`); moved by a guard trigger (hand-written migration `0002_audit_guards`) | `S/audit.ts:91-102`; `S/audit.ts:5-8` |
| Discarded-chain lineage | `audit_chain_history` (reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario); kept across every reset | `S/audit.ts:142-176`; `db/reset/kept-tables.ts:88` |
| Operational events (not chained) | `events`: `seq`, `id` (`LOG-<seq>`), `at`, `type`, `category`, `severity`, `message`, `params`, `session_id`, `device_id` | `S/audit.ts:105-135` |
| Audit event types (vocabulary) | Shared object `AuditType`, 67 member lines counted between lines 346 and 435 (counting pattern `^  NAME: '`); category per type in `AUDIT_TYPE_CATEGORY`. Groups seen: auth, session machine (`SESSION_CREATED`, `RECORDING_STARTED`, `RECORDING_STOPPED`, `EVIDENCE_SEALED`, `SESSION_INCOMPLETE`, `MARKER_ADDED`, `NOTE_ADDED`, `SNAPSHOT_TAKEN`), integrity stream, evidence, faults and recovery, pairing, devices and storage, plus the capture-phase types `CAPTURE_CONFIG_CHANGED`, `AUDIO_SOURCE_SWITCHED`, `CAMERA_POE_CYCLED`, `TRANSCRIPT_REVISED`, `MIC_SILENT`, `EVIDENCE_MEDIA_SERVED`, `EVIDENCE_EXPORT_FAILED`, `CAPTURE_CREDENTIAL_SET`, `CAPTURE_CREDENTIAL_REVEALED`, `STT_CONFIG_CHANGED`, `CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE` | `packages/shared/src/sim/vocabulary.ts:346-436`; category map `:439`; capture types `:414-434` |
| Writer | `core/audit-writer.ts` inserts the prepared row; rejects an unknown type (`AUDIT_TYPE_UNKNOWN`) and a category that differs from `AUDIT_TYPE_CATEGORY`; the append protocol puts audit rows first in a write plan | `apps/core-server/src/core/audit-writer.ts:165,198-199,244`; `engine/write-plan.ts:127-133` |
| Detail keys per type | Exact detail-key lists in `core/audit-details.ts`; forbidden keys (secrets) list of 28 names, e.g. `password`, `token`, `username`, `secret`, `keyRef`, `onvifUuid`, `mediaUrl`, `credentialRef`, `apiKey` | `apps/core-server/src/core/audit-details.ts` (header cited by `vocabulary.ts:408-410`; not read in this row); `S/value-sets.ts:203-233` |
| Events writer | `core/event-writer.ts` | `apps/core-server/src/core/event-writer.ts:160` |
| Module that reads it | `modules/security-audit/` (`reads.ts`, `stored-chain.ts`, `export-request.ts`, `cursor.ts`) | directory listing |
| Row mapper | `auditRowToRow` | `MAP/rows.ts:1134`; `eventToRow` `MAP/rows.ts:1179` |

## 4. User or role

| Item | Detail | Evidence |
|---|---|---|
| Roles | `roles` (`id` from `ROLE` = `INVESTIGATOR`, `SUPERVISOR`, `TECHNICIAN`; `sort_order`). Written by the seed only | `S/rbac.ts:28-38`; `S/value-sets.ts:15` |
| Permissions | `permissions` (`id` open CODE, `sort_order`), `role_permissions` (pk `role_id, permission_id`). Seed only: "the matrix cannot be changed through the API" is a database rule | `S/rbac.ts:41-74` |
| Operators | `operators`: `id`, `username` (unique, pattern `^[a-z0-9][a-z0-9._-]{0,63}$`), `rank`, `name`, `display_name`, `initials`, `role_id`, `enabled`, `last_sign_in_at`, `role_changed_at`, `created_at`, `updated_at`. Runtime role has no INSERT and no DELETE: no operation creates or deletes a user | `S/rbac.ts:77-106` |
| Operator password | `operator_credentials`: Argon2id parts in separate columns (`algorithm`, `memory_kib`, `passes`, `parallelism`, `salt`, `hash`, `hashed_at`). "No column may be logged or returned" | `S/rbac.ts:112-142` |
| Sign-in sessions | `auth_sessions`: `token_hash` (SHA-256, 32 bytes), `operator_id`, `device_id` (NULL means a web session), `method` (`PASSWORD`/`BIOMETRIC`), `issued_at`, `last_seen_at`, `absolute_expires_at`, `ended_at`, `end_reason` | `S/identity.ts:18-74`; sets `S/value-sets.ts:102-113` |
| Writers | Seed writes operators and credentials (`seed.ts` walks the write order); role change, disable, enable: `UPDATE public.operators ...` statements; sign-in stamp `UPDATE public.operators SET last_sign_in_at`; sign-in rows `INSERT INTO public.auth_sessions` | `db/seed/seed.ts:236,334-336`; `modules/admin/statements.ts:140,142,144`; `modules/identity/session-store.ts:159,340`; row builder `MAP/rows.ts:94` |
| Modules | `modules/identity/` (sign-in, lockout, cookie, biometric), `modules/rbac/`, `modules/admin/` | directory listing |

## 5. Device registry entry

Two registries exist, for different things. Row 4 reports both.

| Registry | Table and columns | Evidence |
|---|---|---|
| Capture hardware (cameras, microphones, PoE switch) | `capture_devices`: `id` (pk; check ties prefix to kind: `CAM-nn`, `MIC-nn`, `POE-<NAME>`), `kind` (`CAMERA`/`MIC`/`POE`), `transport` (open CODE), `model`, `firmware`, `address`, `mac` (pattern `^[0-9A-F:]{17}$`), `onvif_uuid` (partial unique index), `profiles` (jsonb array), `poe_port`, `enabled`, `last_seen_at`, `adapter_kind` (schema v3, default `FAKE`; set `ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE`, `FAKE`, `LOCAL_DEVICE`; paired to device kind by `CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND`). Written at INSERT only for `kind` and `adapter_kind` (no UPDATE grant) | `S/capture.ts:38-87`; `S/value-sets.ts:134,143,145-150` |
| Selector over the registry | `capture_config` singleton: `video_01_device_id`, `video_01_profile`, `video_02_device_id`, `video_02_profile`, `mic_primary_id`, `mic_standby_id`, `revision`, `updated_by`, `updated_at`; FKs to `capture_devices.id`. Snapshotted into `active_session.capture_config` at start | `S/capture.ts:94-155` |
| Writers of `capture_devices` | (a) adoption of a discovered camera: `UPDATE public.capture_devices SET transport, onvif_uuid, profiles, last_seen_at ... WHERE kind = 'CAMERA'`; (b) local device registration `REGISTER_LOCAL_DEVICE` (`adapter_kind` `LOCAL_DEVICE`); (c) the engine's device-slice mapping `captureDevicesToRows`, runtime-updatable columns `model`, `firmware`, `address`, `poe_port`, `enabled` | `modules/capture-discovery/adoption.ts:28`; `capture/fence/statements.ts:36-45`; `MAP/rows.ts:845`; `MAP/changes.ts:73,195-227` |
| Modules | `modules/capture-config/`, `modules/capture-discovery/`, `modules/capture-inputs/`, `modules/devices/` | directory listing |
| Paired client apps (tablet/phone), not capture hardware | `paired_devices`: `id`, `name`, `platform`, `app_version`, `state` (`PAIRED`/`REVOKED`/`UNPAIRED`), `paired_at`, `paired_with_code_id`, `last_seen_at`, `revoked_at`, `revoked_by_operator_id`, `revoke_reason`, `unpaired_at`, `updated_at`; with `pairing_codes`, `device_credentials` (hash of the device secret), `biometric_tokens`, `registry_counters` | `S/pairing.ts:41,88,138,164,217`; writer `INSERT_DEVICE` `modules/pairing/store.ts:208`, `INSERT_DEVICE_CREDENTIAL` `:216` |
| Note on the name | `AdminResource.DEVICES` is the paired-client registry, so the capture registry is deliberately named `capture_devices` | `S/capture.ts:34-37` (comment citing E-04) |
| Kept across a demo reset | `capture_devices`, `capture_device_credentials`, `capture_config` and the pairing tables are among the thirteen kept tables | `db/reset/kept-tables.ts:75-88` |

## 6. Camera credential

| Item | Detail | Evidence |
|---|---|---|
| Table | `capture_device_credentials`: `device_id` (pk, FK `capture_devices.id`), `username`, `encryption` (check: only `AES-256-GCM`), `secret_ciphertext` (bytea, at least 33 bytes), `nonce` (exactly 12 bytes), `key_ref` (CODE reference, "never key material"), `rotated_at` | `S/capture.ts:164-190` |
| Access rule | The runtime role has no SELECT on the table. The single read path is the owner-defined SECURITY DEFINER function `public.dems_capture_credential_reveal(p_device_id text)` returning `username, encryption, secret_ciphertext, nonce, key_ref`; EXECUTE granted to `dems_app` | `S/capture.ts:7-11`; `db/migrations/0005_capture_privileges.sql:58-76` |
| Where the key is | Not in the database. File credential store `<dataDir>/credential-store/keys/` (modes 0700/0600); purpose `CAPTURE_DEVICE` produces key references of the form `CAPTURE_DEVICE_K_<32 hex uppercase>`; every write makes a new key (writing again is the rotation); replaced keys are not yet removed (`retainOnly` has no caller, finding R69-09) | `credential-store/index.ts:78,95-96,224-228`; header notes `credential-store/index.ts:1-50`; folder name `credential-store/key-store.ts:40-41` |
| Envelope | AES-256-GCM, padded frame; `sealSecret`, `openSecret` | `credential-store/envelope.ts:99`, `:152`; minimum-size note `envelope.ts:19` |
| Writers | `INSERT_CAPTURE_CREDENTIAL` and `UPSERT_CAPTURE_CREDENTIAL` (`ON CONFLICT (device_id) DO UPDATE`), used by the connection test / adoption path (operations 89 and 96) | `modules/capture-discovery/connect/statements.ts:36-44`; table-privilege note `statements.ts:9` |
| Audit | `CAPTURE_CREDENTIAL_SET`, `CAPTURE_CREDENTIAL_REVEALED`; the two details carry the device id and a reason code only | `packages/shared/src/sim/vocabulary.ts:421-422`; `S/capture.ts:161-163` |
| Related credential, other kind | STT API key: `stt_config.credential_kind/credential_ref/secret_ciphertext/nonce`, same store, purpose `STT_API_KEY` | `S/stt.ts:60-69`; `credential-store/index.ts:78` |
| Session key (recording encryption, not a camera credential) | Per-session AES-256 key `KID-<sessionId>` in `session-keys-<scope>` inside the credential store folder | `credential-store/index.ts:9-10,138-142` |
| Kept across reset | Yes | `db/reset/kept-tables.ts:84` |

## 7. Setting

| Setting | Table | Columns | Evidence |
|---|---|---|---|
| Capture device selector | `capture_config` | see kind 5 | `S/capture.ts:94-155` |
| Storage policy | `storage_policy` (singleton) | `retention_policy` (`DAYS_30`/`DAYS_90`/`YEAR_1`/`CASE_CLOSURE`), `retention_days` (1..3650), `auto_archive`, `updated_at` | `S/core.ts:103-119`; `S/value-sets.ts:97` |
| Console settings | `console_settings` (singleton, kept across reset) | `presentation_mode`, `time_format` (`24`/`12`), `notify_warnings`, `notify_sound`, `updated_at` | `S/core.ts:122-136`; `S/value-sets.ts:190` |
| STT configuration | `stt_config` (singleton) | `enabled`, `backend` (`omlx-server`/`cpu-local`), `endpoint` (loopback only), `model`, `language` (only `id`), `diarization`, `credential_kind` (`REFERENCE`/`ENCRYPTED`), `credential_ref`, `secret_ciphertext`, `nonce`, `revision`, `updated_by`, `updated_at` | `S/stt.ts:46-76` |
| Media store location | `core_media_store` | `media_root`, `recorded_at`; written by `INSERT ... core_media_store AS stored ... ON CONFLICT` | `S/core.ts:294-309`; `db/commands/media-store-root.ts:36` |
| Counters, schema version | `engine_counters` (names `event`, `session`, `caseNumber`, `evidence`, `item`, `export`), `schema_meta` | `S/core.ts:139-149`; `S/meta.ts:43`; `S/value-sets.ts:189` |
| Other singletons seen (not settings in the operator sense) | `core_device`, `core_state`, `hardware_snapshot`, `health_snapshots`, `alerts` | `S/core.ts:70,152,185,214,247` |
| Writers | Storage policy and console settings: engine change planner, runtime-updatable columns listed; `capture_config`: engine mapping (`captureConfig` column list) and the capture-config module (operation 77, optimistic `revision`); `stt_config`: `UPDATE_STT_CONFIG`, `UPDATE_STT_CONFIG_WITH_CREDENTIAL` (operation 91) | `MAP/changes.ts:60-61,69,186`; `MAP/rows.ts:256,270,782`; `modules/stt-config/statements.ts:90,97`; `modules/capture-config/` (`store.ts`, `routes.ts:280`) |
| Modules | `modules/storage/`, `modules/capture-config/`, `modules/stt-config/`, `modules/system/` | directory listing |
| Operating-mode settings kept in code, not in the database | Capture constants (audio 48 kHz, 1 channel, GOP 50 frames, fragment target 2000 ms, connection-test timeout 15 s, discovery limits) | `packages/shared/src/api/capture.ts:41,43,49,51,168` |

## 8. Marker

Search performed (all returned the results below, run 2026-10-12):

- `grep -rni "pgTable('[a-z_]*marker" apps/core-server/src/db/schema` returned 0 matches: there is no table whose name contains "marker".
- `grep -rn "marker" apps/core-server/src/db/schema/*.ts` returned exactly four lines: `evidence.ts:94`, `evidence.ts:191`, `sessions.ts:60`, `sessions.ts:130`.

So a marker has no table of its own. It exists as follows.

| Where | What | Evidence |
|---|---|---|
| Live count | `active_session.marker_count` (integer, default 0, check `>= 0`) | `S/sessions.ts:60`, `:130` |
| Live item | The session's `timeline` jsonb array receives one `TimelineEvent` of `kind: 'MARKER'` with `params: { index, label }` (label cut to 80 code units; default text `Marker <n>`); this is produced by the shared session machine, not by a SQL statement in a module | `S/sessions.ts:68`; `packages/shared/src/sim/session-machine.ts:1866-1883`; `packages/shared/src/sim/types.ts:438-454` |
| Sealed copy | `evidence_items.markers` jsonb array of `EvidenceMarker { id, at, index (1-based), label }`, `NOT NULL DEFAULT []`, check "is an array"; filled from the timeline's MARKER items when the item is built | `S/evidence.ts:94`, `:189-192`; `packages/shared/src/sim/types.ts:1116-1122`; `packages/shared/src/sim/session-machine.ts:1127` (loop over `item.kind !== 'MARKER'`); mapper `MAP/rows.ts:524,664` |
| Audit trace | Audit type `MARKER_ADDED` (category `SESSION`) with details `{ label, index }`, plus an event of the same type; actor is the signed-in operator | `packages/shared/src/sim/session-machine.ts:1873-1882`; `packages/shared/src/sim/vocabulary.ts:363,454` |
| Entry point | Operation 34 `addSessionMarker`, route with body `{ label }`, returns 204; only in state `RECORDING`; allowed in the Core by `scope.command(principal, action.addSessionMarker, label)` | `modules/sessions/routes.ts:16,367-375`; `packages/shared/src/sim/session-machine.ts:1867` |
| Related per-session text records | Notes: `active_session.notes` / `evidence_items.notes` (jsonb arrays of `SessionNote { id, at, authorId, text, origin? }`); snapshot count `active_session.snapshot_count` | `S/sessions.ts:61,69`; `S/evidence.ts:95`; `packages/shared/src/sim/types.ts:456-466` |

Consequence for the record map (row 6), stated as fact only: marker data cannot be moved as a row of its own; any marker the Core holds lives inside a session or evidence-item record and in the audit chain.

## Cross-cutting facts that bear on "one owner per record"

1. Writes are mostly performed by one mechanism: the engine state is diffed into row changes (`db/mapping/changes.ts`) and applied inside one unit of work together with audit rows (`engine/write-plan.ts:127-133`). Modules write directly with constant SQL only for credentials, pairing, identity, STT config, capture discovery, capture registration, recording fragments, transcript chunks, sealing jobs, capture-session sources and audio intervals (grep of `INSERT INTO` / `.insert(` over `apps/core-server/src`, run 2026-10-12, excluding tests, fixtures, seed and reset).
2. The Core holds no table for: an input-av-style per-recording row, a separate user token table for API clients (the sign-in session table `auth_sessions` and the device tables `paired_devices`/`device_credentials` hold them), or a settings table with arbitrary key-value pairs. These are statements about the schema list of section "Method and limits" (43 tables), not about migrations that may exist outside it.
3. The tables kept across a reset (thirteen): `registry_counters`, `console_settings`, `pairing_codes`, `paired_devices`, `device_credentials`, `auth_sessions`, `biometric_tokens`, `capture_devices`, `capture_device_credentials`, `capture_config`, `stt_config`, `core_media_store`, `audit_chain_history` (`db/reset/kept-tables.ts:75-88`). The audit log and the evidence tables are not among them.
4. Forbidden audit detail keys include `username`, `secret`, `nonce`, `keyRef` and `onvifUuid`, so an adapter cannot place a camera account name or ONVIF reference in an audit detail (`S/value-sets.ts:203-233`; check constraint `audit_log_details_no_secret_keys_check`, `S/audit.ts:83`).

## Not examined (stated so nobody assumes otherwise)

- Migration SQL beyond `0002_audit_guards.sql` (header lines only) and `0005_capture_privileges.sql:55-80`; GRANT lists were taken from schema comments.
- Contents of `core/audit-details.ts`, `sealing/finalize-transcript/`, `modules/capture-inputs/`, `modules/media-stream/`, `modules/transcript-chunks/`, the `transcript*` and `session_stt_config` tables beyond their declaration lines.
- `packages/shared/src/domain/entities.ts` lists 15+ entity names (`ENTITY_NAMES`, `:23`), including `Session`, `EvidenceObject`, `Manifest`, `AuditEvent`, `ExportEvent`; it was listed but its members were not mapped to tables here.
- Whether the Core's production code path (not the engine fixtures) writes some of the fixture-only rows; `db/fixtures/recordings.ts` writes `MARKER_ADDED` rows for demo data (`:273`, `:573`) and was not treated as a production writer.

---
*Generated: 2026-10-12*
*Last Updated: 2026-10-12*
