---
task_id: task4-input-av-core-port
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: data-analyst (row RD, wave 12, track D)
type: design (Tier 1, short)
confidence: HIGH on the facts cited; MEDIUM on the build estimate
source_request: delegation_progress/file_requests.md line 570 (row W6); decision C146
last_updated: 2026-10-14
---

# Design 07 - Retire a capture device, adopt it again (decision C146, request 570)

READ-ONLY row. No code, no `apps/input-av/data/`, no `.data/`, no key or credential file was read.
Every Core fact carries `file:line`; anything not verified is marked **HYPOTHESIS**.

## 0. The gap (who, what, why)

- **Who.** The TECHNICIAN in the web console. A SUPERVISOR also assigns slots (`sim/auth.ts:71-72`).
- **What.** Two sentences send the operator to "adopt the camera again": `common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM`
  (`packages/shared/src/i18n/en/common.ts:939-940`) and the W6 words for `STREAM_PROFILE_DIFFERS` (`apps/core-web/src/i18n-web.ts:670`).
  Operations 95 and 96 refuse a registered camera's candidate with `CANDIDATE_ALREADY_REGISTERED` (`modules/capture-discovery/connect/service.ts:337`, `:615`).
  The registered-camera test matches by `onvif_uuid` first and then by the whole address (`registered.ts:5-8`, `:58-70`).
  The contract has 110 operations and none of them removes or retires a device (OpenAPI listing: no delete or retire under `/capture`).
- **Why it matters.** A camera whose stream now states other profiles cannot be made assignable from any screen.
  The same rule also blocks two other cases. A broken camera **replaced by a new unit at the same address** is matched
  "already registered" by its address. A device removed for good stays listed forever.

## 1. What input-av does (the default scheme, U1). Code only.

| Endpoint | Code | Behaviour |
|---|---|---|
| `DELETE /cameras/{cam_id}` | `nvr/routers/admin.py:391-400` | `admin_only`. **Refuses `409` if ANY `Recording` row names the camera** ("Kamera punya rekaman; nonaktifkan (enabled=false) saja"). Otherwise it removes the MediaMTX preview path (`mediamtx.py:79-83`, best effort: a failure is only logged), **hard-deletes the `cameras` row**, and writes audit `camera.delete` (actor, id, ip; no details). The row holds `username`, `password` and the `rtsp_url` with credentials (`db.py:76-79`), so the credential goes with it. No recording file is touched. Audio sources are `cameras` rows with `kind="audio"` (`db.py:90-92`), so microphones use the same path. There is no session check beyond the recording count. **HYPOTHESIS:** a camera of a running session that has no `Recording` row yet could be deleted. |
| `DELETE /devices/{device_id}` | `nvr/routers/devices.py:49-58` | "Forget". It hard-deletes a row of the network-discovery list (`devices`, `db.py:182-198`), not a camera. Audit `device.forget` records ip, mac and vendor. The row comes back when the device is detected again. |
| `service.py:250-256` `_discard` | called at `:196` | Not a device removal. During a session it deletes the file and the `Recording` row of a retry part that failed again with no data. Writes no audit row. |
| (re-registration) | `registration.py:50-51` | ONVIF registration refuses a MAC held by ANY camera row, including a disabled one. **So input-av cannot re-adopt a camera that has recordings either.** The only way around this is a manual `POST /cameras` (`admin.py:245-273`, no MAC check), which gives a new id. |

**input-av in short:** a device that never recorded is hard-deleted, together with its credential. A device that recorded can only be disabled (`enabled=false`), and it keeps its id and history forever.

## 2. What a registered device is in the Core (every reference)

| Reference to `capture_devices.id` | Kind | Evidence |
|---|---|---|
| `capture_config.video_01/02_device_id`, `mic_primary_id`, `mic_standby_id` | FK, RESTRICT | `db/schema/capture.ts:245-272` |
| `capture_device_credentials.device_id` (one per camera, write-only GCM envelope) | FK, RESTRICT | `capture.ts:304-322` |
| `capture_device_streams.device_id` (PK with `profile`) | FK, RESTRICT; runtime role has **no DELETE**, key not updatable | `capture.ts:348-370`, `0016:27` |
| `capture_audio_inputs.device_id`, plus **UNIQUE (card_id, card_device, input_number)** | FK, RESTRICT; no DELETE | `capture.ts:405-441`, `0016:41` |
| `session_capture_sources.device_id` (INSERT-only; `source_facts` is a point-in-time copy) | FK, RESTRICT | `db/schema/recording.ts:193-215` |
| `session_audio_intervals.mic_device_id` | FK, RESTRICT | `recording.ts:48`, `:62-68` |
| `audit_log.device_id`, `events.device_id` | **soft reference by value** ("insertable whatever became of the thing it names") | `db/schema/audit.ts:9-10`, `:47`, `:117` |
| Sealed manifest fields 35 `tracks[].deviceId`, 56 and 139 `micDeviceId` | **by value, sealed** | `packages/shared/src/evidence-package/manifest.ts:975`, `:996`, `:1116` |
| Sealed manifest fields 38-39 (camera model and firmware) | **read from the registry row AT SEAL TIME** | `sealing-host/session-reader.ts:48-52` |
| `capture_devices_onvif_uuid_key` (partial unique on `onvif_uuid`) | identity backstop of adoption | `capture.ts:178-180`, `0008:17` |

Other facts:
- The runtime role holds **no DELETE on `capture_devices`** (`capture.ts:8`, `0005`). The engine refuses any slice in which a device "left the registry" (`db/mapping/changes.ts:232`).
- `enabled` is the presence flag the engine calls `online`, not a lifecycle state (`db/mapping/rows.ts:889`, `:904`).
- Camera ids are minted as the highest number plus one (`connect/service.ts:562-565`), counted over the slice and the stored rows (`:620`).

**Can a device be hard-deleted? No.** Once a session used a device, six RESTRICT FKs and the INSERT-only
`session_capture_sources` hold its row. A device that was never used could be deleted, but the id could then be reused:
deleting the highest `CAM-nn` makes the next adoption mint the same number again. The audit rows and sealed
manifests that name that id by value would then point at another camera. That breaks the rule "a device id keeps
meaning what it meant when a package was sealed". The Core needs input-av's *disable* (the row is kept) **plus**
input-av's *delete* of the credential.

## 3. Options compared

| | A. Hard delete (input-av `DELETE`) | B. RETIRE + adopt again under a NEW id | C. RETIRE + adopt again under the SAME id | D. Explicit "replace stored profiles" on op 108's differ answer |
|---|---|---|---|---|
| Evidence model | breaks it: ids reused, rows orphaned, 4 DELETE grants needed | holds: the old id is frozen and never minted again | id stays stable, but fields 38-39 and the stream rows change under an id that sealed packages name | the id now stands for a new statement. Stream rows cannot be deleted and a reused code is UPDATEd in place, so the registry loses what (CAM-nn, code) meant |
| PR rule "a stored statement is never replaced silently" (`pr_profiles_from_connection_test.md` s2 (b); review 086 (11), `verification/086_pre_lift_security.md:170`) | n/a | holds: nothing is replaced, a new statement gets a new id | replaced, though explicitly | replaced, though explicitly |
| Covers a replacement unit at the same address | partly | yes | no (a different unit would hold the old id) | no |
| Covers removal for good, both kinds | yes | yes | yes | no (cameras only) |
| Pending seal of an ended session | could orphan it | safe: retirement writes neither model nor firmware | unsafe while a seal is pending (fields 38-39) | unsafe if model or firmware is rewritten |
| New operations | 1 | **1** (ops 95/96/99 reused) | 2 (retire + un-retire) | 1, cameras only |
| Operator cost | low | the slot must be unassigned and then reassigned to the new id | the same | lowest |

**RECOMMENDATION: B.** One new operation, RETIRE, for both kinds. Adopting again goes through the existing
operations 95/96 (cameras) and 99 (microphones) and gives a **new** id. Reasons:
1. It is input-av's own model for a device that recorded: the row and its history are kept, and the credential is gone.
2. Every id keeps one meaning. Sealed fields 35/56/139 and every audit `device_id` stay true.
3. It closes three gaps with one act: a changed statement, a replaced unit, and a device removed for good.
4. It keeps PR's rule exactly. Op 108 stays a non-writer on a difference.

D stays possible later as a separate decision. It is rejected now because it is cameras-only, has no answer for a
replaced unit, and rewrites registry meaning.

## 4. The design of B

### 4.1 Schema: version 15, migration set 16 (`dbc-16`)
- `0032_capture_device_retirement.sql` (NEW under `apps/core-server/src/db/migrations/`):
  - `capture_devices` gets `retired_at bigint NULL` and `retired_by text NULL` (FK `operators`, RESTRICT).
    CHECK: both are NULL or both are set.
  - `capture_audio_inputs` gets `retired_at bigint NULL`. This mirror is written in the same unit; the db test holds them equal.
  - Replace `capture_devices_onvif_uuid_key` with a unique index `WHERE onvif_uuid IS NOT NULL AND retired_at IS NULL`.
  - Replace the constraint `capture_audio_inputs_card_input_key` with a unique index on the same three columns `WHERE retired_at IS NULL`.
  - A trigger refuses any UPDATE of a retired row other than `last_seen_at` and `enabled`, and any UPDATE that sets `retired_at` back to NULL.
    Precedent for guard triggers: `0002_audit_guards`.
  - An owner-owned `SECURITY DEFINER` function `dems_capture_credential_destroy(p_device_id text)`. It deletes the one
    credential row and is the mirror of the reveal function (`0005:61-75`). The runtime role gets EXECUTE on it and **no table DELETE**.
- `0033_capture_device_retirement_privileges.sql` (NEW): `GRANT UPDATE (retired_at, retired_by)` on `capture_devices` and
  `UPDATE (retired_at)` on `capture_audio_inputs`; the EXECUTE grant; the version row.
- `db/schema/capture.ts` (columns and indexes), `db/schema/meta.ts:110-112` (14 to 15, `dbc-15` to `dbc-16`), and the B-3 refusal in both directions as in earlier sets.
- **HYPOTHESIS:** a demo reset (`db/reset/kept-tables.ts:117-118`) carries whole rows, so `retired_at` survives a reset. RD1 checks this.

### 4.2 Contract
- **Operation 111 `retireCaptureDevice`**: `POST /api/v1/capture/devices/{id}/retire`.
  - Body: `{ reason: 'REMOVED' | 'REPLACED' | 'STATEMENT_CHANGED' }`, a closed set, so no free text reaches the audit (NL-1).
  - Answer: the device entry with `retiredAt` and `retiredBy`.
- Permission: **`CAPTURE_COMMISSION`** (TECHNICIAN only, `sim/auth.ts:80-83`), from the web console only, under the idle lock.
  This is the order of `commissioningRefusal` (`sim/api.ts:1318-1326`). Retiring a device is decommissioning it.
- The engine slice member `CaptureDeviceStatus.retiredAt: number | null` (`sim/types.ts:750`). Retired devices **stay in
  the slice**, as `changes.ts:232` requires. `RUNTIME_UPDATABLE_COLUMNS.captureDevices` (`changes.ts:73`) gains `retiredAt` and `retiredBy`.
- Audit `CAPTURE_DEVICE_RETIRED`, category SECURITY (a credential is destroyed). Details: `deviceId`, `kind`, `reason`,
  `credentialDestroyed: boolean`, `streamRowsKept: count`. Audit types are an open `CODE` set (`audit.ts:75`): no migration.
- Adoption (op 96) and microphone registration (op 99): when the identity rule matches a RETIRED row, the audit
  details gain `previousDeviceId`. This links the history; no old id is rewritten.

### 4.3 Refusals of op 111 (all `409 INVALID_STATE` unless stated; nothing is stored, no audit row)

| `details.reason` | When | Operator sentence |
|---|---|---|
| `CAPTURE_CONFIG_LOCKED` (existing) | a session is open | "A session is open. Devices can be retired only while no session is open." |
| `CAPTURE_DEVICE_ASSIGNED` | a selector slot names the device | "This {{source}} is assigned to {{slot}}. Unassign it first, then retire it. Nothing was changed." |
| `CAPTURE_DEVICE_RETIRED` | already retired | "This {{source}} is already retired. Nothing was changed." |
| `CAPTURE_DEVICE_BUILT_IN` | an id of `DEFAULT_CAPTURE_DEVICES` (`sim/initial-state.ts:96`; `rows.ts:771`) or kind `POE` | "The demo devices of the simulator and the PoE switch cannot be retired. Nothing was changed." |
| `CONNECTION_TEST_IN_PROGRESS` (existing) | op 108 is running for this camera | the existing sentence |
| `404 NOT_FOUND` | unknown id | existing |

### 4.4 What a retired device is everywhere else
- **Unassignable.** Ops 77-80 refuse with `CAPTURE_DEVICE_RETIRED`, a new member of `common.captureSlotRefusal`. The capture fence refuses it again at session start.
- **No longer "registered".** The matcher's read (`registered.ts:18`) and adoption's address check (`connect/service.ts:614`) skip retired rows.
  **Ids are minted over ALL rows** (`:620`). The matcher and the minting must use separate statements.
- Op 108, op 89 (credential) and op 100 (readdress) refuse a retired id with `CAPTURE_DEVICE_RETIRED`.
  Op 108's settle (`adopted-profiles.ts`) checks again inside its unit and writes nothing.
- Microphones: op 99's match by exact key (`audio-cards/service.ts:35-47`) skips retired inputs. A retired input's card
  is listed as a new card; registering it mints a new `MIC-nn`, also counted over ALL rows.
- Kept for history: the registry row (model and firmware are read by a pending seal), the stream rows (no DELETE),
  and the audio input row. **The credential is destroyed** in the same unit.
- **Honest limit:** PostgreSQL keeps the dead tuple until VACUUM, plus WAL and backups. Those copies are the
  ciphertext only. **HYPOTHESIS:** its key lives in the Core credential store under `key_ref` (`capture.ts:312`).

### 4.5 Clients
- Web console:
  - A **Retire** control in a production device's drawer (`features/devices/device-drawer.tsx`) and on the microphone card (`audio-input-card.tsx`).
  - A confirm dialog with the three reasons that states the consequences: credential erased, the device cannot be
    assigned, and adopting it again gives a new number.
  - A collapsed "Retired devices" list (read only).
- Tablet: shows retired devices only as "Retired" with no control. Commissioning is web-console-only (`sim/api.ts:1325`).
- The two "adopt again" sentences become: "...To use what the camera states now, retire it in the web console
  (Devices), then search for it and adopt it again: it gets a new number. Then assign one of the profiles it states."

## 5. Rows to build (wave 13 proposal)

| Row | Size | Agent | Files (verified unless NEW) | Dependency |
|---|---|---|---|---|
| RD1 schema set 16 | M | database-specialist | `src/db/schema/capture.ts`, `schema/meta.ts`, NEW `migrations/0032_capture_device_retirement.sql`, NEW `0033_..._privileges.sql`, `migrations/meta/_journal.json` + NEW snapshots, NEW `test/db/set16.db.test.ts` (beside `test/db/set15.db.test.ts`), `db/reset/kept-tables.ts` (check only) | none |
| RD2 contract op 111 | M | coder-execution | `packages/shared/src/api/capture-discovery.ts` (or NEW `api/capture-retire.ts` under `api/`), `sim/types.ts:750`, `sim/vocabulary.ts` (audit type and category), `sim/api.ts:208` (route table) and the sim handler, `i18n/en/common.ts:939` (refusals and sentence), `apps/core-server/src/core/audit-details.ts`, `packages/shared/openapi/openapi.json` (regenerated) | contract on RD1 (names only) |
| RD3 Core op 111 | M | coder-execution | NEW `src/modules/capture-config/retire.ts`, `capture-config/routes.ts`, `engine/internal-actions.ts`, `db/mapping/rows.ts`, `db/mapping/changes.ts:73` | build on RD1 + RD2 |
| RD4a cameras skip retired | M | coder-execution | `capture-discovery/registered.ts`, `connect/service.ts` (`:614`, `:620`), `adopted-test.ts`, `adopted-profiles.ts`, `readdress.ts`, the op 89 handler (`connect/index.ts` or `connect/service.ts` - which one: HYPOTHESIS), `capture-config/routes.ts` (assignment), `capture/fence/sources.ts`, `modules/devices/status.ts` | build on RD3 |
| RD4b microphones skip retired | S | coder-execution | `capture-inputs/audio-cards/service.ts`, `registrar.ts`, `statements.ts` | build on RD3; disjoint from RD4a |
| RD5 web + tablet | M | coder-execution | `apps/core-web/src/features/devices/device-drawer.tsx`, `audio-input-card.tsx`, NEW `retire-device-dialog.tsx` under `features/devices/`, `apps/core-web/src/i18n-web.ts:670`; tablet `apps/mobile/src/features/devices/device-detail.tsx` | contract on RD2 |
| RD6 review | S | security-review | the points below | after RD1-RD5 |

Shared resources: one migration writer (RD1); one `packages/shared` writer per wave (RD2, then RD5 reads it); `capture-config/routes.ts` is touched by RD3 and RD4a, so they run in sequence.

### Security points for the reviewer (RD6)
1. **Credential destruction.** The credential is deleted in the retire unit only through the definer function. The runtime role has no table DELETE (a test asserts 42501). A rollback restores it. Op 108 after a retire answers `CAPTURE_DEVICE_RETIRED`, not `CREDENTIAL_NOT_READ`.
2. **No retire while recording.** The idle lock and the slot check run inside the engine unit. A race with session start must be impossible (the engine lock). A test retires while a start is held.
3. **No evidence row orphaned.** No DELETE on registry, stream, input or session tables. Retirement leaves model and firmware unchanged, so a pending seal states the same fields 38-39. A sealed package naming the old id still resolves to its row.
4. **No id reuse.** Minting counts retired rows. A test retires the highest `CAM-nn` and `MIC-nn` and then adopts a new device.
5. **No un-retire.** The trigger refuses clearing `retired_at` and edits of a retired row. Op 108's settle writes nothing to a retired camera.
6. **The simulator's demo devices** (`CAM-01/02`, `MIC-01/02`, `POE-SWITCH`) are refused. The sim mirrors the Core's refusal order.
7. **NL-1.** The audit details carry a closed reason, counts and ids only. No address, `onvif_uuid`, serial or token.

## 6. Assumptions, gaps, open questions
- HYPOTHESIS: reset carries `retired_at` (RD1 checks). HYPOTHESIS: the credential key is installation-wide (`key_ref`).
- HYPOTHESIS: microphone ids are minted over the slice only (`engine/internal-actions.ts:69`). Retired rows stay in the slice, so this is safe either way; RD4b checks it.
- Q1: Use `CAPTURE_COMMISSION`, or a new permission? (Recommended: reuse it. A new one needs a seed and grant row.)
- Q2: Should retired devices show in op 45's list (with `retiredAt`), or only behind a filter?
- Q3: Option D (in-place replace) later, as a convenience for the same unit? Not recommended now.
- Q4: Should a never-used device be hard-deleted, as input-av does? Not recommended: id reuse (section 2).

---
*Generated: 2026-10-14 · Last Updated: 2026-10-14*
