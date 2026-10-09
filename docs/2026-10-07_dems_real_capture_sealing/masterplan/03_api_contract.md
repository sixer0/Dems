---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
blueprint_row: 29
milestone: M0
class: B (GA:OD-01, OD-09, OD-10, OD-15, OD-17, OD-22)
tier: 1
type: api-contract (C3)
status: draft-for-M0-gate
confidence: HIGH for the operation set, access/audit rules, error codes, audit detail-key lists, slices, constants and version edits (mechanical over `research/03_analysis.md`, `masterplan/01_specs.md`, `decisions/decisions.md` D4/D7/D8/D10/D12, and the existing contract source read at HEAD); MEDIUM for the request/response *shape summaries* and for the two proposed `CoreApiAccessCondition`/`Permission` additions, which M2 materialises
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md
source_phase_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D4-D12)
last_updated: 2026-10-08 (RV-SPEC: errata AU2-07/AU2-08; proposed ops 90-92 for R-8 pending Q-STT-CFG, §2.5 — registry stays 89 until confirmed; 2026-10-07 row-35 remediation, op 89 added)
---

# API Contract C3 — operations 76-89, modified operations, error codes, audit types, slices and constants

> **This is the contract, not the code change.** It names what M2 must build in
> `packages/shared/src/api/*`, `packages/shared/openapi/openapi.json` and the pinned-count tests.
> No file outside this task folder is edited by this row (blueprint row 29, red line). The shared
> contract source (`packages/shared/src/api/*.ts`) is a **read-only input** here; M2 writes it.
>
> **The register is the contract** (`masterplan/01_specs.md` header; `research/03_analysis.md`
> §Overview). Where the raw impact map and the register disagree, the register wins (D10(a)). Every
> design choice below cites `file:line`, a decision ID (`D4`/`D7`/`D8`/`D10`/`D12`) or a register row
> (`SH-*`, `CS-*`, `WB-*`, `MB-*`, `NM-*`, `E-*`, `W1-C*`).
>
> **Correction W1-C7 is honoured and never repeated here.** No claim about
> `--poolOptions.threads.maxThreads` appears in this document; the register line
> `research/03_analysis.md:335` is errata-corrected by D12(c) and vitest 5.0.3 honours
> `--maxWorkers` (D12(c)). This contract contains no test-runner claim at all (W1-C7 finding; row 29
> is not a test row).

**Citation short forms.**

| Short | Source |
|---|---|
| `register §B/§C/§D/§F` + `SH-xx`/`CS-xx`/`NM-xx` | `research/03_analysis.md` (register) |
| `specs §A-§H`, `specs row 29` | `masterplan/01_specs.md` |
| `structured row 29`, `structured §6` | `identification/02_structured.md` |
| `Dn` | `decisions/decisions.md` |
| `coll3 F-nn` | `research/02_collection.md` |
| `capture-spec §X` / `transcript-spec §X` | sibling peer specs `masterplan/05_capture_architecture_spec.md` (row 31) / `masterplan/07_transcript_spec.md` (row 33) |
| `core-api.ts:NNN`, `openapi.ts:NNN`, … | the existing contract source at HEAD, read-only |

---

## 0. Gate answers and inputs in force

The six gate answers that unblock this row are fixed verbatim by D4 (recommended defaults). D8, D10
and D12 are binding corrections; D7 re-scopes the Mac-side STT work.

| Gate | Answer (D4) | Where it lands in C3 | Cited by |
|---|---|---|---|
| **OD-01** | T1: `AUDIO-01` = the one session audio track; `AUDIO-02` legacy v1 only; mic inputs `MIC-01`/`MIC-02` (`MicRole` PRIMARY/STANDBY) | ops 76-82; modified ops 40/45/47; `captureConfig` slice | D4 OD-01; register §C OD-01; SH-01/SH-03/SH-05/SH-16 |
| **OD-09** | hot standby; mic toggle for the **session holder** with `SESSION_START` **+ SUPERVISOR**; web-only recording stays "no" | op 81 access rule + `SESSION_HOLDER` condition; op 48 PoE gate is separate | D4 OD-09; register §C OD-09; SH-03/SH-13/NM-10 |
| **OD-10** | new permission `CAPTURE_CONFIG` for **SUPERVISOR + TECHNICIAN**, **editable only while idle** | ops 78/79/80; RBAC row `CAPTURE_CONFIG` | D4 OD-10; register §C OD-10; SH-03/SH-04/CS-12/NM-09 |
| **OD-15** | `TRANSCRIPT_REVISE` for **INVESTIGATOR + SUPERVISOR**; **Core key signs revisions**; **author recorded**; **no approval flow** | ops 85/86; audit `TRANSCRIPT_REVISED` | D4 OD-15; register §C OD-15; SH-02/SH-14/NM-06 |
| **OD-17** | simulator emulates v2; **`offline` OpenAPI scope → 0.2.0** (all-scope 0.3.0); `release/` 0.1.0 untouched | §8; the `offline` visibility column of §2 | D4 OD-17; register §C OD-17; SH-19/W1-C9 |
| **OD-22** | PoE-cycle **only for a camera whose stream is lost**, confirmed + audited, gap marked | modified op 48; audit `CAMERA_POE_CYCLED` | D4 OD-22; register §C OD-22; CS-06/NM-01 |

Binding corrections folded in: **D8** (W1-C1..W1-C11), **D10(a)-(f)** (register is the contract; the
supervisor restarts the ingest per session; GOP = fragment quantum; the avfilter API performs the
switch), **D12(a)-(d)** (S4 within ±40 ms; B10 conversions; **W1-C7 corrected**; GStreamer deferred).
D7(a)-(d) re-scopes rows 10-12 to reuse the installed oMLX engines on this Mac and keeps the portable
`cpu-local` whisper.cpp for the Core; op shapes here are backend-neutral, so D7 changes no API field.

**Security-review remediation (row 35 -> this contract).** The row-35 security design review
(`masterplan/09_security_design_review.md`) routed the findings whose owning section is this contract
to this revision. Applied here as normative text: **SEC35-01** (the missing credential-write operation
+ `CAPTURE_CREDENTIAL_SET`; §1, §2.2, §5.2), **SEC35-12** (media-session signing key, TTL, requester
binding; §2.4, §7), **SEC35-13** (media-token prefix; §2.4), **SEC35-16** (REAL-evidence case scoping
for op 88 — **flagged for the second blueprint gate**; §2.1/§2.4), **SEC35-17** (`sendingDeviceId`
device rule; §5.2), **SEC35-19** (idle-lock refusal audit; §4/§5.1), **SEC35-21** (`baseRevision`
mapping; §2.3), **SEC35-22** (error-code/audit-type union and counts; §4/§5). SEC35-18
(`SESSION_HOLDER`) stays an M2 deliverable (§10); the SEC35-02 reveal control and the DB-side
hardening are owned by row 30 (`04_database_contract.md`).

**New permission and condition additions (proposed; M2 materialises).**

| Addition | Kind | Value | Authority |
|---|---|---|---|
| `CAPTURE_CONFIG` | `Permission` (existing enum, additive) | grant to `SUPERVISOR`, `TECHNICIAN` | D4 OD-10; register SH-03/SH-04/CS-12 |
| `TRANSCRIPT_REVISE` | `Permission` (existing enum, additive) | grant to `INVESTIGATOR`, `SUPERVISOR` | D4 OD-15; register SH-03/SH-04/CS-12 |
| `SESSION_HOLDER` | `CoreApiAccessCondition` (new) | the caller is the operator who created the open session, **or** holds `SUPERVISOR` | D4 OD-09; `contract-model.ts:88-112` (condition list grows by one) |
| `POE_CYCLE` | `DeviceCommand` (existing enum, additive) | a device command whose contract entry is op 48 | E-12; `vocabulary.ts:260`; register §A E-12 |

The four additions are additive to closed value sets (`auth.ts`, `vocabulary.ts`,
`contract-model.ts`); no existing value changes meaning. `AUDIT_TYPE_CATEGORY` gains one entry per
new audit type (§5), as the predecessor required (`specs` §13.1 idiom).

---

## 1. Numbering and total count

| Item | Value |
|---|---|
| Existing registry (all scope) | **75 operations**, 27 GET / 48 POST (`core-api.ts:51`; `apps/core-server/test/acceptance/contract.test.ts:374-380`) |
| New operations this phase | **14**, numbered **76-89** (13 from the blueprint + op 89 added by the SEC35-01 remediation) |
| Modified operations (of the 75) | **24** substantive (§3, 22 table rows; the `72/73/74` row modifies three), each with before/after |
| New registry total | **89 operations**; projected **34 GET / 55 POST** |
| Proposed, not counted (R-8, D20) | ops **90-92** (§2.5) pending Q-STT-CFG at the second gate; if confirmed the total becomes **92 (35 GET / 57 POST)** and audit types **63** |
| Register row that fixes numbers | `register §B.6 NM-09` fixes **ops 76-80** (the five capture-config operations). No other row numbers an operation, so ops 81-89 are assigned here |
| Register row that requires the 13th operation | `register §B.6 NM-11` (evidence media streaming) requires one operation the predecessor contract explicitly forbade (media not served, `specs` §A.3/§11 MS-1). It is op 88 |
| Register row that requires the 14th operation (SEC35-01) | `register RK-12` + `T-33` (map §6 `capture_device_credentials`) + `E-30` (audited refusals): the write-only credential store had **no** write operation, so op 89 `setCaptureDeviceCredential` is added and `CAPTURE_CREDENTIAL_SET` with it (§2.2, §5.2) |

**Ops 76-80 = NM-09 exactly.** `register §B.6 NM-09`: "Device-selector config store + API: persist
VIDEO-01/02 sources + primary/standby mic; validate; locked while open; audit; publish slice; **ops
76-80**; own slice (E-04)". Five operations: two reads (config, devices) and three writes (whole
config, one camera source, one mic role) so each write's audit detail is exact (§5).

**Why 89, not 88 (SEC35-01 remediation).** The enumerated requirement set fills 76-87; `NM-11` needs
the 88th; and the row-35 review found that the write-only credential store had **no** write path
(`D §B.3` named "operation 80", which `§A §2.2` already uses for `setPrimaryMic` — an operation-number
conflict). Ops 76-88 were fully occupied by the 13 original operations, so the credential-write
operation takes the **next free number, 89**, and the total becomes **89**. The blueprint's "about 88"
(`structured §3.1`) is still met. This is a documented extension (an added operation), not a renumber
of any existing op: 76-88 keep their assignments unchanged.

**A path normalization against the register.** `register SH-13` and sibling `capture-spec §E` write
the mic-switch path in the plural (`/api/v1/sessions/{id}/audio-source`). The shared contract's area-4
paths are **singular** (`sessions.ts:132` `SESSION_PATH = \`${API_BASE_PATH}/session\``). This contract
uses the singular `/api/v1/session/{id}/audio-source` to match the area's own convention and flags the
plural spelling as an erratum for the M0 gate (row 39).

---

## 2. New operations 76-89

Legend. **Mode**: `simulated` = the in-app simulator answers it, so it is visible in the `offline`
scope per OD-17; `live` = only the Core server, so all-scope only. **Access**: the registry marker
(`contract-model.ts:74-86`); the permission's role holders are in the RBAC table below. **Audit**:
the success rule (`NONE-R` = a read; `NONE-P` = parity, no row) and the denial rule (`ACCESS_DENIED`,
or `EXPORT_DENIED` on the export command, `contract-model.ts:200-211`).

### 2.1 RBAC rows the access column cites

| Permission | Roles | Authority | Note |
|---|---|---|---|
| `CAPTURE_CONFIG` (new) | SUPERVISOR, TECHNICIAN | D4 OD-10; register SH-04/CS-12; `sim/auth.ts` (SH-04); `specs §D` | editable **only while idle** (OD-10) → 409 `CAPTURE_CONFIG_LOCKED` |
| `TRANSCRIPT_REVISE` (new) | INVESTIGATOR, SUPERVISOR | D4 OD-15; register SH-04/CS-12; `specs §D` | Core key signs; author recorded; no approval flow |
| `SESSION_START` (existing) | INVESTIGATOR, SUPERVISOR | `sessions.ts:133`; predecessor `specs §4.4` | op 81 adds the `SESSION_HOLDER` condition |
| `EVIDENCE_VIEW` (existing) | every role | `evidence.ts:147`; `evidence.ts` (VIEW_DENIED note) | reads 84/86/88; **REAL evidence additionally needs case/session scope (SEC35-16, §2.4) — flagged for the second blueprint gate** |
| `CAPTURE_CONFIG` (new; credential custody) | SUPERVISOR, TECHNICIAN | D4 OD-10; `04_database_contract.md §B.3/§D` | op 89 writes the credential store; the store is read only through the single owning module + the supervisor reveal path (SEC35-02) |
| `EVIDENCE_EXPORT` (existing) | SUPERVISOR | `core-api.ts:872-877`; RB-5 | modified op 42 |
| `DEVICE_MANAGE` (existing) | TECHNICIAN | `devices.ts:155`; predecessor `specs §4.4` | modified op 48 (PoE cycle) |
| `AUTHENTICATED` (any role) | every role | `contract-model.ts:133` | captures, sealing progress, intervals |

Role matrix source of truth: `packages/shared/src/sim/auth.ts` (`register SH-04`), verified by the
`rbac.matrix` boot test (D88 equality; `specs C-N9`).

### 2.2 Identity table — method, path, mode, access, audit, register rows

| # | operationId | Method | Path | Tag | Mode | Access (marker) | Audit success / denial | Register rows / class |
|--:|---|---|---|---|---|---|---|---|
| 76 | `getCaptureConfig` | GET | `/api/v1/capture/config` | Device | simulated | `AUTHENTICATED` | `NONE-R` / `ACCESS_DENIED` | SH-12, SH-16, CS-12, NM-09; R-1; M4 |
| 77 | `getCaptureDevices` | GET | `/api/v1/capture/devices` | Device | simulated | `AUTHENTICATED` | `NONE-R` / `ACCESS_DENIED` | SH-16, NM-09; E-04; R-1; M4 |
| 78 | `updateCaptureConfig` | POST | `/api/v1/capture/config` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | `CAPTURE_CONFIG_CHANGED` / `ACCESS_DENIED` | SH-03, SH-04, SH-12, CS-12, NM-09; R-1; M4 |
| 79 | `setCaptureCameraSource` | POST | `/api/v1/capture/cameras/{id}/source` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | `CAPTURE_CONFIG_CHANGED` / `ACCESS_DENIED` | SH-12, NM-09; OD-05/OD-10; R-1; M4 |
| 80 | `setPrimaryMic` | POST | `/api/v1/capture/mics/{id}/primary` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | `CAPTURE_CONFIG_CHANGED` / `ACCESS_DENIED` | SH-03, SH-12, NM-09; R-1; M4 |
| 81 | `switchAudioSource` | POST | `/api/v1/session/{id}/audio-source` | Session | simulated | `PERMISSION SESSION_START` + `SESSION_HOLDER` | `AUDIO_SOURCE_SWITCHED` / `ACCESS_DENIED` | SH-03, SH-13, CS-07, NM-10; R-3; M5 |
| 82 | `listAudioSourceIntervals` | GET | `/api/v1/session/{id}/audio-source` | Session | simulated | `AUTHENTICATED` | `NONE-R` / `ACCESS_DENIED` | SH-02, SH-05, NM-10; R-3; M5 |
| 83 | `getSealingProgress` | GET | `/api/v1/session/{id}/sealing` | Session | simulated | `AUTHENTICATED` | `NONE-R` / `ACCESS_DENIED` | SH-05, SH-06, CS-04, NM-07; R-6; M7 |
| 84 | `getTranscript` | GET | `/api/v1/evidence/{id}/transcript` | Evidence | simulated | `PERMISSION EVIDENCE_VIEW` | `NONE-R` / `ACCESS_DENIED` | SH-14, NM-06; R-5; M6/M8 |
| 85 | `createTranscriptRevision` | POST | `/api/v1/evidence/{id}/transcript/revisions` | Evidence | simulated | `PERMISSION TRANSCRIPT_REVISE` | `TRANSCRIPT_REVISED` / `ACCESS_DENIED` | SH-02, SH-03, SH-04, SH-14, NM-06; R-5; M7/M8 |
| 86 | `listTranscriptRevisions` | GET | `/api/v1/evidence/{id}/transcript/revisions` | Evidence | simulated | `PERMISSION EVIDENCE_VIEW` | `NONE-R` / `ACCESS_DENIED` | SH-02, SH-14, NM-06; R-5; M7/M8 |
| 87 | `getEvidenceExportJob` | GET | `/api/v1/evidence/exports/{id}` | Evidence | simulated | `PERMISSION EVIDENCE_EXPORT` | `NONE-R` / `ACCESS_DENIED` | SH-14, NM-12; OD-16; M8 |
| 88 | `createEvidenceMediaSession` | POST | `/api/v1/evidence/{id}/media-sessions` | Evidence | **live** | `PERMISSION EVIDENCE_VIEW` | `EVIDENCE_MEDIA_SERVED` / `ACCESS_DENIED` | NM-11, WB-04, MB-07; E-31; M8 |
| 89 | `setCaptureDeviceCredential` | POST | `/api/v1/capture/devices/{id}/credential` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | `CAPTURE_CREDENTIAL_SET` / `ACCESS_DENIED` | RK-12, T-33, E-30, SH-03; SEC35-01; R-1; M4 |

Access notes. 76/77 are reads every role may call, like `getDeviceInventory`
(`devices.ts:126`). 78/79/80 need `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN) and are **refused with
no state change** while a session is open (OD-10) — the refusal is `409 CAPTURE_CONFIG_LOCKED`, and
**no** `CAPTURE_CONFIG_CHANGED` row is written (`specs C-N9`; register E-30). 81 needs
`SESSION_START` **and** the new `SESSION_HOLDER` condition: the operator who created the open
session, or any SUPERVISOR (OD-09); an operator who holds `SESSION_START` but is neither is refused
`403 NOT_PERMITTED`. 85 needs `TRANSCRIPT_REVISE` (INVESTIGATOR + SUPERVISOR; OD-15). 88 is
`live` only: Simulated mode plays the bundled demo media and opens no media session
(`register NM-11`; predecessor `specs §11` MS-1 stays true for Simulated mode). 89 needs
`CAPTURE_CONFIG`, is idle-only (`409 CAPTURE_CONFIG_LOCKED`), and is **write-only**: the response
never echoes the credential and the audit detail carries `deviceId` only (§5.2; RK-12). **Access
correction for REAL evidence (SEC35-16):** op 88 and the `EVIDENCE_VIEW` reads (84/86) are scoped to
the caller's own case/session for items whose `integrity_source = 'REAL'` — `EVIDENCE_VIEW` alone is
**not** sufficient (see §2.1 and §2.4); this is a pre-existing-permission correction and **needs user
confirmation at the second blueprint gate** before M8.

### 2.3 Shape table — request, success, realtime, errors

| # | Request shape (summary) | Success shape (summary) | Realtime slice | Error codes (besides the shared envelope) |
|--:|---|---|---|---|
| 76 | none | `CaptureConfig` = `{ cameras[], mics[], locked, updatedAt }` | reads new `captureConfig` (§6) | 401, 403 |
| 77 | none | `CaptureDevices` = `{ devices: CaptureDevice[] }` | reads new `captureDevices` (§6) | 401, 403 |
| 78 | `CaptureConfigUpdate` = partial `{ cameras?[], mics?[] }` | 200 `CaptureConfig` | publishes `captureConfig` | 400, 401, 403, 409 `CAPTURE_CONFIG_LOCKED`, 422 `INVALID_INPUT`, 503 `NOT_READY` |
| 79 | `CaptureCameraSource { trackId: VIDEO-01\|VIDEO-02 }` (path `{id}` = the camera device) | 200 `CaptureConfig` | publishes `captureConfig` | 400, 401, 403, 404 unknown `{id}`, 409 `CAPTURE_CONFIG_LOCKED`, 422 `INVALID_INPUT`, 503 `NOT_READY` |
| 80 | none (path `{id}` = the mic input to make primary) | 200 `CaptureConfig` | publishes `captureConfig` | 401, 403, 404 unknown `{id}`, 409 `CAPTURE_CONFIG_LOCKED`, 503 `NOT_READY` |
| 81 | `AudioSourceSwitch { inputId, reason? }` | 200 `AudioSourceState { sessionId, activeInputId, standbyInputId, switchedAt, intervalFromMs }` | publishes `session`; `meters.audio.activeInputId` | 400, 401, 403, 404 not open session, 409 `AUDIO_SOURCE_CONFLICT`, 409 `INVALID_STATE`, 422 `INVALID_INPUT` |
| 82 | query `cursor`, `limit` (API-9, `PageQuery`) | 200 `{ items: AudioSourceInterval[], nextCursor }` | reads `session` (intervals) | 401, 403, 404, 422 `INVALID_QUERY` |
| 83 | none | 200 `SealingProgress { sessionId, state, steps[] { id, status, startedAt, completedAt, durationMs }, progressPct, etaMs, resumed, updatedAt }` | reads `session` (`finalization`) | 401, 403, 404, 409 `INVALID_STATE` |
| 84 | none | 200 `TranscriptDocument { documentVersion, language, speakerState, segments[], sha256, machineTranscriptHash, assembledAt, revision }` | reads `evidence` (transcript summary) | 401, 403, 404, 409 `TRANSCRIPT_NOT_READY` |
| 85 | `TranscriptRevisionRequest { baseRevision, changes[] { segmentIndex, from, to }, note? }` | 201 `TranscriptRevision { revisionId, number, authorId, baseRevision, machineTranscriptHash, signedBy, signature, createdAt, changes[] }` | publishes `evidence` | 400, 401, 403, 404, 409 `TRANSCRIPT_NOT_READY`, 409 `TRANSCRIPT_REVISION_CONFLICT`, 422 `INVALID_INPUT` |
| 86 | query `cursor`, `limit` | 200 `{ items: TranscriptRevision[], nextCursor }` | reads `evidence` | 401, 403, 404, 409 `TRANSCRIPT_NOT_READY`, 422 `INVALID_QUERY` |
| 87 | none | 200 `EvidenceExportJob { jobId, evidenceId, kind: PACKAGE\|COMPOSITE, status: QUEUED\|RUNNING\|COMPLETE\|FAILED, progressPct, etaMs, manifestHash?, signature?, derived, createdAt, completedAt }` | reads `evidence` (`exportJob`) | 401, 403, 404, 422 `INVALID_PATH_PARAMETER` |
| 88 | none | 201 `EvidenceMediaSession { evidenceId, fileId: VIDEO-01\|VIDEO-02, url, expiresAt, ranges: true }` | none (not replicated) | 401, 403, 404, 409 `MEDIA_NOT_AVAILABLE`, 422 `INVALID_PATH_PARAMETER` |
| 89 | `CaptureCredentialWrite { username, secret }` (path `{id}` = the camera device; both fields **write-only**) | 200 `CaptureConfig` (the credential is **never** echoed) | publishes `captureConfig` | 400, 401, 403, 404 unknown `{id}`, 409 `CAPTURE_CONFIG_LOCKED`, 422 `INVALID_INPUT`, 503 `NOT_READY` |

Shape sources. `CaptureConfig`, `CaptureDevice`, `TranscriptDocument` and `TranscriptRevision`
are the **wire form of the new/changed replicated slices** (`state-slices.ts` idiom API-6: one zod
schema serves the socket and REST); `AudioSourceInterval` is register SH-02
(`AudioSourceInterval` entity); `SealingProgress` mirrors the `session.finalization` slice with the
v2 steps (`register SH-05/SH-06`); `EvidenceExportJob` is `register NM-12`. Every request schema is a
`z.strictObject`/`z.object` in the existing idiom, and every text carries the API-13 text rule
(`text.ts`) so the 422 `INVALID_INPUT` refusal is uniform.

**No secret in any shape.** `CaptureDevice` carries **no credential**: the field list is `id, kind,
model, firmware, host, poePort, online, streamState, capabilities`. A camera URL is host/path only and
**never** `user:password@` (camera credentials are write-only, `register RK-12`; `specs C-N8`).
`EvidenceMediaSession.url` is a signed, loopback-only URL (E-31) and is **the one field that must
never be logged or audited** (§5).

### 2.4 Per-area notes

**Capture config (76-80).** 76/77 read the two new replicated slices; 78/79/80 write them while idle.
79 assigns the camera device in the path (`CAM-01`/`CAM-02`) to the video track named in the body
(`VIDEO-01`/`VIDEO-02`); 80 makes the mic input in the path `PRIMARY`, and the other input
`STANDBY` (`MicRole`, OD-01). All three refuse while a session is open (OD-10) with
`409 CAPTURE_CONFIG_LOCKED` and write no audit row on refusal. Both topologies are supported (one
dual-lens camera, two PoE cameras; OD-05) because the config names a device per track, not a lens.

**Mic switch (81-82).** 81 is the in-session toggle: it moves the active source to the named input at
the next worker input-quantum boundary (≤ one input quantum + IPC latency; ≤ 21.333 ms only for a
1024-sample pull loop — erratum AU2-07, `capture-spec §E`; S2 §4; AU-2 §2), records one
`AudioSourceInterval`, and answers with the new active/standby state. It **never** auto-switches and
it is refused when a session is not RECORDING. 82 returns the interval list (mic-switch query), whose
`fromMs`/`toMs` are **media-pts** values derived capture-side (S2 §6 finding 3; `capture-spec §E`), so
playback can draw the audio-source band (`register WB-04/MB-07`).

**Sealing progress (83).** 83 returns the v2 finalization steps with per-step status, duration and an
`etaMs`. Progress is **forward-only** and derived from Core instants (`coreClockOf`), never the client
clock (`register E-13`; OD-08), and `resumed: true` marks a RECOVERY resume (`register MB-06`).

**Transcript (84-86).** 84 returns the machine transcript inside the seal. 85 appends a **signed
revision** (`TRANSCRIPT_REVISE`, Core Ed25519 key, author recorded, no approval flow — OD-15); the
sealed machine transcript is byte-unchanged and `baseRevision` binds the revision to it (row 33
`transcript-spec §A.6`). 86 lists the append-only revisions.

**`baseRevision` mapping (SEC35-21).** `baseRevision` (op 85) is defined as the item's **current
`max(revision_no)`** (`0` when no revision exists), read and compared **inside the same INSERT
transaction** that mints `revision_no = max+1` (`04_database_contract.md §B.9`); a mismatch is
`409 TRANSCRIPT_REVISION_CONFLICT`. There is no `baseRevision` column — the mapping is a write-
transaction rule (no sequence; D-DB-07), and verify V-11 remains the `parent_sha256` chain.

**Export (modified 42 + 87).** `exportEvidence` (op 42) becomes the **v2 export request**: it creates
a background export job (decrypted copy + manifest + signature; `composite` optional, marked
`derived` — OD-16) and answers `202`; 87 polls the job to completion. The former synchronous
`EvidenceExportAccepted` changes meaning from "the file exists" to "the job is queued" (§3).

**Media (88).** `createEvidenceMediaSession` returns a short-lived signed URL to the NM-11 media
route, which serves the decrypted camera file with HTTP Range support (M8; `register NM-11`). The
route is registry-external, like `/ws` (`contract.test.ts:388-408`); it carries its own static rule
and adds the signed-URL prefix to both log-blanking lists (E-31). This is why 88 is `live` only.

**Media-session signing, binding and TTL (SEC35-12).** The URL is a bearer value, so the contract
pins it as normative: the URL is HMAC-signed with a **separate media-session signing key**
(`MEDIA_SESSION_SIGNING_KEY_ID`, held in the Core credential store, never the evidence `Signer` key,
never in a log or an audit row); the token **binds to one `(operatorId, sessionId, evidenceId,
fileId)`** and is rejected if any component differs; its lifetime is the short constant
`EVIDENCE_MEDIA_SESSION_TTL_MS` (§7); and the replay window is exactly that TTL (E-31; register
NM-11/WB-04/MB-07). `EVIDENCE_MEDIA_SERVED` records the binding and byte counts, **never the URL**
(§5.2).

**Media-token prefix (SEC35-13).** The signed-URL token carries the fixed prefix
`EVIDENCE_MEDIA_TOKEN_PREFIX = 'mts_'` (§7). Both log-blanking lists extend their regex from
`\b(ses|dvc|bio)_` to `\b(ses|dvc|bio|mts)_` at the two pinned insertion points
(`apps/core-web/src/runtime/error-sink.ts:52` and `apps/mobile/src/runtime/log.ts:46`), and the
camera-credential form `rtsp://user:pass@host` is blanked too (SEC35-04; row 31 §G G-R4). The
obligation is executable and asserted by check `M8-BLK-1` (row 36), which row 36/37 must extend to the
new prefix.

**REAL-evidence case scope (SEC35-16, provisional).** For an item whose `integrity_source='REAL'`,
op 88 (and the `EVIDENCE_VIEW` reads 84/86) additionally require the caller to be the **owner of that
case/session** (the session creator) or a **SUPERVISOR**; a mere `EVIDENCE_VIEW` holder is refused
`403 NOT_PERMITTED`. This narrows the pre-existing all-roles `EVIDENCE_VIEW` reach for REAL evidence
and is **not** decided by OD-10/OD-15, so it is recorded as **provisional** and flagged **needs user
confirmation at the second blueprint gate** (accept the residual all-roles read, or confirm the
case-scope rule) before M8 ships. Simulated/demo (`DEMO_PACKAGE`) evidence keeps the existing
all-roles read (P2 §8 R-12 stays true there).

**Credential (89).** `setCaptureDeviceCredential` is the write-only credential path (SEC35-01;
RK-12): it accepts `{ username, secret }` for the camera device in the path, stores it encrypted at
rest (`04_database_contract.md §B.3`), returns the `CaptureConfig` snapshot, and **never** echoes,
logs or audits the credential value; the `CAPTURE_CREDENTIAL_SET` audit detail is `deviceId` only
(§5.2). It is idle-only and requires `CAPTURE_CONFIG`. The store is read only through the single
owning module + supervisor reveal path fixed in `04_database_contract.md §B.3/§D` (SEC35-02); no
other operation reveals a credential.

### 2.5 STT configuration operations 90-92 (PROPOSED — pending Q-STT-CFG confirmation at the second gate; R-8, D20)

> **Status: proposed, not counted.** These three operations implement R-8 (`specs` R-8; D20). They
> are **not** part of the 89-operation registry, the pinned counts or the OpenAPI plan until the user
> confirms Q-STT-CFG. If confirmed: registry **92 operations, 35 GET / 57 POST**, audit types **63**
> (`STT_CONFIG_CHANGED`), error codes unchanged at **40** (existing codes only), slices unchanged at
> 30 (no new slice; see "Slice" below). If rejected: delete this section; nothing else changes.

| # | operationId | Method | Path | Tag | Mode | Access (marker) | Audit success / denial | Register rows / class |
|--:|---|---|---|---|---|---|---|---|
| 90 | `getSttConfig` | GET | `/api/v1/transcription/config` | Device | simulated | `AUTHENTICATED` | `NONE-R` / `ACCESS_DENIED` | NM-06, NM-09 pattern; R-8; M6 |
| 91 | `updateSttConfig` | POST | `/api/v1/transcription/config` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | `STT_CONFIG_CHANGED` / `ACCESS_DENIED` | NM-06, NM-09 pattern, E-30, E-31; R-8; M6 |
| 92 | `testSttConnection` | POST | `/api/v1/transcription/config/test` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | none on success (no state change) / `ACCESS_DENIED` | NM-06; R-8; M6 |

| # | Request | Success | Realtime | Errors |
|--:|---|---|---|---|
| 90 | none | 200 `SttConfig { enabled, backend: 'omlx-server'\|'cpu-local', endpoint?, model, language: 'id', diarization: boolean, credentialSet: boolean, credentialKind?: 'REFERENCE'\|'ENCRYPTED', revision, updatedBy?, updatedAt, pendingForNextSession: boolean, lastTest? { reachable, modelAvailable, testedAt } }` | none | 401 |
| 91 | `SttConfigUpdate { revision, enabled?, backend?, endpoint?, model?, diarization?, credential?: { kind: 'REFERENCE', ref } \| { kind: 'SECRET', value } \| { kind: 'CLEAR' } }` | 200 `SttConfig` + `appliesFrom: 'NOW'\|'NEXT_SESSION'` | none (clients re-read op 90) | 401, 403 `NOT_PERMITTED`, 409 (the same optimistic-revision refusal as op 78), 422 `INVALID_INPUT` (`details.reason`: `ENDPOINT_NOT_LOOPBACK`, `LANGUAGE_NOT_SUPPORTED`, `BACKEND_UNKNOWN`) |
| 92 | none (tests the **stored** configuration) | 200 `SttConnectionTest { reachable, modelAvailable, backend, detailCode }` — `reachable: false` is a 200 result, not an HTTP error | none | 401, 403 `NOT_PERMITTED`, 503 `NOT_READY` (`details.reason: TRANSCRIBER_NOT_READY`; existing code, new reason value) |

**Rules.**

| Rule | Contract | Authority |
|---|---|---|
| RBAC | reads (90) for every role — tablets/phones show read-only status; writes and the test (91, 92) need `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN), the same permission as the device selector | D20; OD-10; §2.1 |
| When a change applies | 91 is **accepted while a session is open** and stored; it applies to the **next** session (`appliesFrom: 'NEXT_SESSION'`, `pendingForNextSession: true`); the open session keeps the snapshot taken at its start. The alternative (refuse while open, like 78-80 with `409 CAPTURE_CONFIG_LOCKED`) is listed under Q-STT-CFG | D20; OD-10 pattern; `transcript-spec §B.7` |
| Credential never returned | no response, slice, log line or audit detail carries the credential or the reference target's contents. A `REFERENCE` (default for `omlx-server`: the oMLX key stays in `~/.omlx/settings.json`, referenced by path only — SEC35-14) or a `SECRET` stored encrypted in the Core credential store (`04_database_contract.md §B.13`); responses carry only `credentialSet` and `credentialKind`; the `value` field is write-only and never pre-filled | D20; E-31; SEC35-14; RK-12 pattern (op 89) |
| Loopback only | `endpoint` must resolve to `127.0.0.1`/`localhost` in this phase; anything else is `422 INVALID_INPUT` (`ENDPOINT_NOT_LOOPBACK`); LAN is class C | OD-13 (D4); `specs` C-N4 |
| Test connection | 92 performs one loopback request to the configured backend (model list / health) with a short timeout and reports `reachable`/`modelAvailable`; it never sends audio, never starts or restarts oMLX (D7(d)), never reports a speed figure (D230), and is serialised with other oMLX calls | D7(d); D230 |
| Disabled / unreachable effect | `enabled: false` → no transcriber work in the next session; the package records `transcript.state = 'DISABLED'` (`06_evidence_package_spec.md §B.7a`). Enabled but unreachable at run time → D-EV-1 failure rule | D20; D-EV-1 |
| Slice | no new realtime slice (keeps 30); clients re-read op 90 on screen entry and after 91. A `sttConfig` slice is an alternative left to Q-STT-CFG | D20 |

**`STT_CONFIG_CHANGED`** (proposed audit type, category `DEVICE`, written by op 91 on success only).
Exact detail keys: `changedFields: string[]` (field **names** from the `SttConfigUpdate` set, never
values), `enabled: boolean` (the new value — not a secret), `backend: string`, `credentialChanged:
boolean`, `revision: number`. The endpoint, model path, credential and reference target are **never**
in the detail (E-30/E-31). No row on refusal.

---

## 3. Modified operations (of the existing 75)

Each row: **Before** (current contract) → **After**. `file:line` is the current source. (The
`72/73/74` row covers three operations; the table modifies **24** operations in **22** rows.)

| # | operationId | Before | After | Register row + decision |
|--:|---|---|---|---|
| 39 | `listEvidence` | `EvidenceItem` v1: `tracks` VIDEO-01/02 + AUDIO-01/02 each one file hash; simulated signature | `EvidenceItem` v2: `files[]` (one whole fMP4 per camera, each with stored-bytes + plaintext hashes and a fragment-chain head), `audioSourceIntervals[]`, `transcript` summary; real Ed25519 signature | SH-07, OD-02 L2. `evidence.ts:75` |
| 40 | `getEvidence` | item + `EvidenceMediaRef { source: DEMO_PACKAGE\|NONE, packageSuffix }` | item v2 + `media` gains `source: DEMO_PACKAGE\|LIVE_STREAM\|NONE`; `LIVE_STREAM` means a signed media session (op 88) can play it | SH-07/SH-14, NM-11; OD-02/OD-16. `evidence.ts:85-101` |
| 41 | `verifyEvidence` | per-track hash compare + manifest + `SIMULATED-SHA256` signature | per-**file** fragment chain verify (both hashes) + transcript hash + **real** signature; `ok:false` on one tampered fragment (OD-02 L2) | SH-07, NM-08; OD-02/OD-03/OD-04/OD-21. `evidence.ts:111-130` |
| 42 | `exportEvidence` | body `{ reason, destination? }`; `202 EvidenceExportAccepted { exportId, evidenceId, status: 'EXPORTED' }`; synchronous; no file | body gains `{ kind: PACKAGE\|COMPOSITE, composite? }`; creates a background job; `202` `{ exportId, status: 'QUEUED' }`; completion by 87; audit adds `EVIDENCE_EXPORT_FAILED` | SH-14, NM-12; OD-16. `core-api.ts:421-451, 829-881` |
| 44 | `getDeviceHealth` | `cameras[]` (lens/recState), `audio[]` (AUDIO-01/02 as mics) | `cameras[]` gains `streamState: LIVE\|LOST`; `audio[]` re-keyed to inputs `MIC-01`/`MIC-02` + `activeInputId` | SH-17, OD-01/OD-22. `core-api.ts:381-415` |
| 45 | `getAudioStatus` | `channels[]` length 2, `AUDIO-01`=MIC 1, `AUDIO-02`=MIC 2 ("never merged") | `channels[]` length 2 keyed by **input** `MIC-01`/`MIC-02`, each with `role: PRIMARY\|STANDBY`, plus `activeInputId`; `AUDIO-01` is the session track, not a channel | SH-17, SH-25; OD-01/OD-09. `core-api.ts:322-349` |
| 46 | `getVideoStatus` | `tracks[]` VIDEO-01/02 status | adds `sourceDeviceId` and `streamState: LIVE\|LOST` per track | SH-05; OD-01/OD-22. `core-api.ts:306-320` |
| 47 | `getDeviceInventory` | seven slices incl. `mics` (AUDIO-01/02) | `mics` re-keyed to inputs; adds the `captureConfig` snapshot; **never** the paired-client registry | SH-12/SH-16; OD-01; E-04. `devices.ts:56-67` |
| 48 | `restartDevice` | `POST /device/{id}/restart`, `DEVICE_MANAGE`, audit `DEVICE_COMMAND`, refused while RECORDING | for a **camera**: a PoE cycle, **allowed only when its stream is LOST** (`409 CAMERA_NOT_LOST` otherwise) and requiring `{ confirm: true }`; audit `DEVICE_COMMAND` **and** `CAMERA_POE_CYCLED`; the `captureConfig` slice marks the gap. Mics/other devices keep the existing restart | CS-06, NM-01; OD-22; E-12. `devices.ts:130-158` |
| 27 | `getCurrentSession` | session with six `FinalizationStep`s and no capture snapshot | session carries the `captureConfig` snapshot + `audioSource`; finalization uses **v2** steps (`CLOSE_TRACKS` … `STORE_SEALED_PACKAGE`) with `progress`/`etaMs`/`attempt` | SH-05/SH-06; OD-01/OD-08. `core-api.ts:294-300` |
| 38 | `listSessionHistory` | `SessionHistoryEntry` v1 | adds `audioSourceSwitchCount` and `interrupted: boolean` (durable-part seal) | SH-05; OD-01/OD-08. `sessions.ts:110-116, 410-432` |
| 43 | `archiveEvidence` | archives v1 sealed items | unchanged shape; now valid for v2 items; `409 NOT_SEALED` unchanged | SH-08; OD-02. `evidence.ts:229-254` |
| 53 | `getStorageStatus` | demo volume figures | evidence-store usage + capture write rate (`storage` slice from CS-09) | CS-09; OD-25. `core-api.ts:351-379` |
| 54 | `getStorageDetail` | `storage`, `storagePolicy` slices | same two slices, evidence-store figures real | CS-09; OD-25. `storage.ts` |
| 57 | `getTimeStatus` | device `time` slice | adds per-camera NTP **offset** records (camera clock offsets via telemetry) | CS-11, NM-01; OD-05. `network-time.ts` |
| 59 | `listAuditRows` | `type` filter over the existing enum | the enum grows by the new audit types (§5); no shape change | CS-14; E-30. `security-audit.ts` |
| 60 | `verifyAuditChain` | three checks (view/stored/lineage) | unchanged; the new types join the chain like any row | CS-13; E-30. `security-audit.ts` |
| 64 | `getSystemStatus` | 16 services | services slice adds `capture-worker` and `transcriber`; capture telemetry feeds health | CS-10, NM-02; OD-24. `system.ts` |
| 66 | `restartServices` | restarts listed services | also restarts the capture worker and the transcriber | CS-10; OD-24. `system.ts` |
| 71 | `getDemoStatus` | reports the demo flag and faults | in **real-capture** mode reports `demo: 'DISABLED'` (hardware faults off) | CS-23; OD-18. `demo-controls.ts` |
| 72/73/74 | `loadScenario`/`injectFault`/`clearFault` | available with `DEMO_CONTROL` + flag | **refused** in real-capture mode with `403 DEMO_DISABLED`; Simulated unchanged | CS-23; OD-18. `demo-controls.ts` |
| 75 | `resetDemo` | resets to the seed state | **refused with `409`** while real sealed packages exist; capture config/devices/credentials are kept tables | CS-21; OD-19. `demo-controls.ts` |

**Also touched, no shape change.** The five simulated reads (`getCurrentSession`, `getDeviceHealth`,
`getAudioStatus`, `getVideoStatus`, `getStorageStatus`) gain nothing beyond the above; their CRUD
contract (statuses, headers) is unchanged. `getAuthSession`/`hasPairing…` are not touched. The
`finalization` step enum change (op 27) is the one DB-coupled contract change and is shared with
row 30 (`dbc-3`), not owned here.

---

## 4. Error codes

New codes are added to `ApiErrorCode` (`core-api.ts:153-186`; currently **31** codes) and to
`API_ERROR_CODES`. **9 new codes** → 40 (the original 7 plus the SEC35-22 reconciliation of
`RESET_BLOCKED_REAL_EVIDENCE` and `TRANSCRIPT_AUDIO_UNAVAILABLE`, which rows 30/33 already use).
Every machine code is `SCREAMING_SNAKE_CASE`
(`API_ERROR_CODE_PATTERN`, `patterns.ts`) so the audit writer's `code()` rule accepts it
(`audit-details.ts:50`). A failed export job is **not** an HTTP error: it is the job's `status:
FAILED` in the `200` body of op 87 (audited as `EVIDENCE_EXPORT_FAILED`, §5.2).

**Client-facing message rule.** Every `message` is fixed, operator-safe English; it quotes **no part
of the request**, names no ID the caller did not prove it may see, and carries no credential, token,
key, password or signed URL (`ApiErrorSchema`, `core-api.ts:194-216`; predecessor `specs §7.2`). The
machine-readable cause travels in `details.reason`/`details.simCode` (flat map). A gated control
that is refused by access shows the **"Checking your permissions…"** state (E-16; `specs C-N12`); a
forward-only progress read shows its last Core-instant value, never a rewind (E-13).

| Code | HTTP | Message (rule) | Returned by | Register + decision |
|---|--:|---|---|---|
| `CAPTURE_CONFIG_LOCKED` | 409 | "The capture configuration cannot be changed while a session is open." | 78, 79, 80 | OD-10; SH-04/CS-12; register E-30 (no audit row on this refusal) |
| `AUDIO_SOURCE_CONFLICT` | 409 | "The requested microphone cannot become the active source." | 81 | OD-09/OD-11; SH-13/NM-10 |
| `CAMERA_NOT_LOST` | 409 | "Only a camera whose stream is lost can be power-cycled." | 48 | OD-22; CS-06; `details.streamState: LIVE` |
| `TRANSCRIPT_NOT_READY` | 409 | "The transcript is not available yet." | 84, 85, 86 | OD-15; NM-06; M6 timing (`transcript-spec §A.5`) |
| `TRANSCRIPT_REVISION_CONFLICT` | 409 | "The transcript revision is based on a revision that is no longer current." | 85 | OD-15; `transcript-spec §A.6` (`baseRevision`) |
| `EXPORT_IN_PROGRESS` | 409 | "An export job is already running for this evidence item." | 42 | OD-16; NM-12 |
| `MEDIA_NOT_AVAILABLE` | 409 | "No playback media is available for this evidence item." | 88 | NM-11; predecessor `specs §11` MS-1 |
| `RESET_BLOCKED_REAL_EVIDENCE` | 409 | "The demo reset is blocked because real sealed evidence exists." | 75 (`resetDemo`), `loadScenario` refusal | SEC35-22; OD-19; `04_database_contract.md §E.2` (`register RK-16`) |
| `TRANSCRIPT_AUDIO_UNAVAILABLE` | 409 | "The session audio required for transcription is not available." | 84/85/86 (surfaced as `details.reason`; the package still seals as `PARTIAL`, `transcript-spec §A.1/§E.5` D-EV-1) | SEC35-22; `07_transcript_spec.md §A.1`; OD-15 |

**Changed behaviour of existing codes (no new code).**

| Code | Change | Returned by | Authority |
|---|---|---|---|
| `NOT_READY` (503) | gains `details.reason: CAPTURE_NOT_READY` when the capture worker/binary/store is not ready (boot checks) | all capture ops + boot | CS-22; `specs B AC-3`; `core-api.ts:185` |
| `RECORDING_ACTIVE` (409) | unchanged meaning; also raised when a PoE cycle is attempted during RECORDING | 48 | OD-22; `devices.ts:150` |
| `INVALID_STATE` (409) | 81 raises it when the session is not RECORDING; 83 when sealing has not started | 81, 83 | `sessions.ts:451` idiom |
| `NOT_FOUND` (404) | 79/80 for an unknown `{id}`; 81/82 for an ID that is not the open session (the existing rule, `sessions.ts:9`) | 79, 80, 81, 82 | existing |
| `FORBIDDEN` (403) vs `NOT_PERMITTED` (403) | `NOT_PERMITTED` for every new permission refusal; `FORBIDDEN` is not used by any new op (RB-5 keeps it for exports only) | all new | RB-4/RB-5; `contract.test.ts:384` |
| `DEMO_DISABLED` (403) | widened to real-capture mode for 72/73/74/71 | 71-74 | OD-18; CS-23 |
| `SESSION_ACTIVE` (409) | **not** reused for the idle-only config lock; `CAPTURE_CONFIG_LOCKED` is distinct so a client can tell "another session is open" from "the config is read-only now" | 78-80 vs 24 | OD-10 |

The predecessor's mapping table (`specs §7.2`; `sim/api.ts:481-495`) still governs the
`SimErrorCode → status+code` conversion; the new codes are returned directly by the Core server and
carry no `simCode` except where the simulator emulates them (ops 76-87), where `details.simCode`
repeats the machine code for parity.

---

## 5. Audit types

Every new type is added to `AuditType` (`vocabulary.ts:296-361`) and to `AUDIT_TYPE_CATEGORY`
(`vocabulary.ts:364-419`) in an **existing** category (no new category). Each type that the server
writes gets an **exact detail-key list** in `SERVER_AUDIT_DETAIL_RULES`
(`apps/core-server/src/core/audit-details.ts:90-132`), so a module cannot add a key that could carry
a secret (`audit-details.ts:1-18`; register E-10). The **9 new types** bring the total from 53
(predecessor `specs §13.1`) to **62** (the original 7 plus `CAPTURE_CREDENTIAL_SET` from SEC35-01 and
`CAPTURE_CREDENTIAL_REVEALED` from SEC35-02; SEC35-22).

### 5.1 The hard rule (E-30 / E-31)

> **No secret value ever appears in an audit detail key or value.** A credential (`dvc_`), a session
> token (`ses_`), a pairing code, a biometric token, a key or key id, a password, a cookie value, a
> typed username, a raw camera credential, and a **signed URL or any prefix of it** are forbidden in
> every detail key and every detail value. The camera credential store is write-only and a refusal
> audits the **fact** of the refusal, never the value (E-30; `register RK-12`; `specs C-N8`).
> `ACCESS_DENIED` on a camera-credential refusal carries `details.reason` only.
> `AUDIO_SOURCE_SWITCHED.deviceId` is an **identifier**, never a credential (B15/E-30).
> `EvidenceMediaSession.url` is never written to an audit row or a log; `EVIDENCE_MEDIA_SERVED`
> records the evidence id, the file id and byte counts only (E-31; `capture-spec G §G-R4`).
> A credential **reveal** (the supervisor path of `04_database_contract.md §B.3`) writes the fact only:
> `CAPTURE_CREDENTIAL_REVEALED` carries `deviceId` and never the username, ciphertext, nonce or key
> (SEC35-02). The media-session token (prefix `mts_`) and the oMLX API key at
> `~/.omlx/settings.json` are forbidden in every detail key and value (SEC35-13/SEC35-14).

`DEVICE_CREDENTIAL_REQUIRED` refusals write **no** audit row (B4); **camera** credential refusals
**do** (E-30). Both stay true here.

### 5.2 New audit types and exact detail keys

Type: value form is given as `key: <type>`; a `?` marks an optional key. "Example" is the value
shape, never a real value.

**`CAPTURE_CONFIG_CHANGED`** — category `DEVICE` — written by ops 78/79/80 (OD-10). Actor: the
editing operator. Device member: the target device when one is named.

| Key | Type | Example | Writer |
|---|---|---|---|
| `operationId` | string, `^[a-z][A-Za-z0-9]{0,63}$` | `setPrimaryMic` | all three |
| `scope` | string, one of `CONFIG`/`CAMERA`/`MIC` | `MIC` | all three |
| `field` | string, one of `CAMERAS`/`MICS`/`SOURCE`/`ROLE` | `ROLE` | all three |
| `trackId`? | string, `VIDEO-01`/`VIDEO-02` | `VIDEO-01` | 78/79 |
| `inputId`? | string, `MIC-01`/`MIC-02` | `MIC-02` | 78/80 |
| `deviceId`? | string, a Core hardware device id (`DEVICE_ID_PATTERN`) | `CAM-02` | 78/79 |
| `from`? | string, the previous value | `STANDBY` | 78/80 |
| `to`? | string, the new value | `PRIMARY` | 78/80 |
| `permission`? | string, a SCREAMING_SNAKE code | `CAPTURE_CONFIG` | all three |

**`AUDIO_SOURCE_SWITCHED`** — category `SESSION` — written by op 81 (OD-09; R-3). The **sending
device ID** is the row's own `deviceId` member and is repeated as `sendingDeviceId` (B15: a command
sent from the phone must name the device; E-30).

| Key | Type | Example |
|---|---|---|
| `fromInput` | string, `MIC-01`/`MIC-02` | `MIC-01` |
| `toInput` | string, `MIC-01`/`MIC-02` | `MIC-02` |
| `fromMs` | number, media-pts ms | `5303` |
| `toMs` | number, media-pts ms | `5324` |
| `sendingDeviceId` | string, `DEV-NNNN` (the registry id of the sending client) — **required when the caller is a paired mobile device** (B15/OD-09); optional only for a web operator session | `DEV-0004` |

`fromMs`/`toMs` are interval markers, not secrets. There is **no** `trigger` key: every switch is
operator-initiated and **no** automatic/failover switch exists (OD-11: sustained silence raises
`MIC_SILENT` and the operator decides; `capture-spec §E.1`). The only writer is op 81. **SEC35-17:**
when the actor is a device the key is **required** (a device-sent command must name the sending
device); only a web operator session may omit it.

**`CAMERA_POE_CYCLED`** — category `DEVICE` — written by op 48 when a lost-stream camera is
power-cycled (OD-22).

| Key | Type | Example |
|---|---|---|
| `deviceId` | string, Core hardware device id | `CAM-01` |
| `poePort` | string, one of `POE_CAM_1`/`POE_CAM_2_AUX` | `POE_CAM_1` |
| `streamWasLost` | boolean, must be `true` | `true` |
| `confirmed` | boolean, must be `true` (operator confirmation) | `true` |
| `gapFromMs`? | number, media-pts ms of the lost-stream start | `120340` |
| `gapToMs`? | number, media-pts ms of recovery | `121980` |

**`TRANSCRIPT_REVISED`** — category `EVIDENCE` — written by op 85 (OD-15). **Never the transcript
body or any segment text** (only counts and the binding hash).

| Key | Type | Example |
|---|---|---|
| `revisionId` | string | `TRV-000004` |
| `authorId` | string, `OPERATOR_ID_PATTERN` | `OPR-002` |
| `number` | number, the 1-based revision number | `4` |
| `baseRevision` | number | `3` |
| `changeCount` | number | `1` |
| `machineTranscriptHash` | string, `SHA256_HEX_PATTERN` | `9f2c…` |
| `reason`? | text, 1..`NATIVE_TEXT_MAX_LENGTH` | `Koreksi nama jalan` |
| `permission`? | string, a SCREAMING_SNAKE code | `TRANSCRIPT_REVISE` |

**`MIC_SILENT`** — category `DEVICE` — written by the warning raiser (op-side; `capture-spec §E.1`).
It is a **warning**, never an auto-switch (OD-11).

| Key | Type | Example |
|---|---|---|
| `inputId` | string, `MIC-01`/`MIC-02` | `MIC-01` |
| `thresholdDbfs` | number, dBFS | `-50` |
| `durationMs` | number, ms | `10000` |
| `sinceMs` | number, media-pts ms the silence began | `88120` |
| `active` | boolean | `true` |

**`EVIDENCE_MEDIA_SERVED`** — category `EVIDENCE` — written by op 88 (NM-11; E-31). **Never the
signed URL** and never a byte of media.

| Key | Type | Example |
|---|---|---|
| `fileId` | string, `VIDEO-01`/`VIDEO-02` | `VIDEO-01` |
| `bytesServed` | number | `1048576` |
| `rangeStart`? | number | `0` |
| `rangeEnd`? | number | `1048575` |
| `signed` | boolean, always `true` | `true` |
| `expiresAt`? | number, epoch ms | `1790825000000` |

**`EVIDENCE_EXPORT_FAILED`** — category `EVIDENCE` — written by the export job (op 42/87; OD-16).

| Key | Type | Example |
|---|---|---|
| `jobId` | string | `EXPJ-000012` |
| `kind` | string, one of `PACKAGE`/`COMPOSITE` | `COMPOSITE` |
| `reason` | string, a SCREAMING_SNAKE code | `SIGNATURE_FAILED` |

**`CAPTURE_CREDENTIAL_SET`** — category `SECURITY` — written by op 89 (SEC35-01; RK-12; E-30).
**Never the username, the secret, the ciphertext, the nonce or the key** — the fact of the write only.

| Key | Type | Example |
|---|---|---|
| `deviceId` | string, a Core hardware device id (`DEVICE_ID_PATTERN`) | `CAM-01` |
| `operationId` | string, `^[a-z][A-Za-z0-9]{0,63}$` | `setCaptureDeviceCredential` |
| `permission`? | string, a SCREAMING_SNAKE code | `CAPTURE_CONFIG` |

**`CAPTURE_CREDENTIAL_REVEALED`** — category `SECURITY` — written by the single owning reveal module
when the supervisor path reads the credential to compose a capture plan (SEC35-02). **Never the
username, the secret, the ciphertext, the nonce or the key.**

| Key | Type | Example |
|---|---|---|
| `deviceId` | string, a Core hardware device id (`DEVICE_ID_PATTERN`) | `CAM-01` |
| `reason` | string, a SCREAMING_SNAKE code | `CAPTURE_PLAN_COMPOSE` |

### 5.3 Changed audit rows (existing types)

| Type | Change | Authority |
|---|---|---|
| `DEVICE_COMMAND` | gains the value `POE_CYCLE` for op 48; `details.command: POE_CYCLE`, plus `poePort`; no secret | E-12; OD-22 |
| `EVIDENCE_EXPORTED` | now the **request** row of op 42 (the job is queued), with `details.kind: PACKAGE\|COMPOSITE`; the file may not exist yet | OD-16; NM-12 |
| `ACCESS_DENIED` | unchanged keys (`operationId`, `permission`, `role`, `reason?`); the new permissions and the `SESSION_HOLDER` condition feed `reason` | `audit-details.ts:91-96`; OD-09/OD-10/OD-15 |
| `EVIDENCE_SEALED` | unchanged; the v2 seal writes it once per session with both files and the transcript | OD-02/OD-03 |
| `RECOVERY_STARTED`/`RECOVERY_COMPLETED` | unchanged; a resumed seal sets `SealingProgress.resumed` (op 83) | OD-08; `specs E.5` |

`AUDIT_TYPE_CATEGORY` gains exactly nine entries (`CAPTURE_CONFIG_CHANGED`→`DEVICE`,
`AUDIO_SOURCE_SWITCHED`→`SESSION`, `CAMERA_POE_CYCLED`→`DEVICE`, `TRANSCRIPT_REVISED`→`EVIDENCE`,
`MIC_SILENT`→`DEVICE`, `EVIDENCE_MEDIA_SERVED`→`EVIDENCE`, `EVIDENCE_EXPORT_FAILED`→`EVIDENCE`,
`CAPTURE_CREDENTIAL_SET`→`SECURITY`, `CAPTURE_CREDENTIAL_REVEALED`→`SECURITY`). SEC35-01/SEC35-22.

---

## 6. Realtime slices 28 → 30

The replicated snapshot holds **28** slice names today (`state-slices.ts:826-827`
`REPLICATED_SLICE_NAMES`; `ReplicatedStateSchema:841-844`). This phase adds **two** replicated
slices, `captureConfig` and `captureDevices` (`register SH-16`: "28 -> 30; never reuse
`AdminResource.DEVICE[S]` (E-04)"). Each new name is added to `STATE_SLICE_DELIVERY`,
`REPLICATED_SLICE_SCHEMAS`, `REPLICATED_SLICE_NAMES`, `ReplicatedStateSchema` and the
`DeltaReplaceOpSchema` discriminated union (`realtime-messages.ts:270-299`); the `ReplicatedState`
snapshot becomes 30 names.

| # | New slice | Delivery | Payload (shape summary) | Published by | Read by (client) |
|--:|---|---|---|---|---|
| 29 | `captureConfig` | replicated | `{ cameras: [{ trackId, deviceId, profile, online, streamState }], mics: [{ inputId, deviceId, role, transport, online }], locked: boolean, updatedAt: epochMs }` | ops 78/79/80 (and 81 for `activeInputId` adjacency) | web WB-05/WB-02/WB-11; tablet/phone MB-08/MB-09 |
| 30 | `captureDevices` | replicated | `{ devices: [{ id, kind: CAMERA\|MIC\|POE, model, firmware, host, poePort, online, streamState, capabilities }] }` | supervisor telemetry (`applyCaptureTelemetry`, `register SH-18`) | web WB-05/WB-11; mobile MB-08/MB-09 |

**Own kind, never the paired-client registry (E-04).** `captureDevices` is its own slice with its own
delta `slice` literal. `AdminResource` (`realtime-messages.ts:156`) stays the registry of **paired
clients** (`USERS`/`DEVICES`/`PAIRING_CODE`) and is **not** used by capture. If a notification kind
is ever needed for capture (it is not, because the two slices are replicated and a change is a
`delta` `replace`), the proposal is a separate `CaptureResource = { CONFIG: 'CONFIG', DEVICES:
'DEVICES' }` enumeration — **never** a value added to `AdminResource`. E-04: `AdminResource.DEVICE[S]`
(`realtime-messages.ts:156`) is the paired-client registry event; capture devices must use their own
slice/kind.

**Changed streamed slice.** `meters.audio` (`state-slices.ts:375-395`) is re-keyed from
`AUDIO-01`/`AUDIO-02` channels to inputs `MIC-01`/`MIC-02` and gains `activeInputId`, so the meters
show the input levels and which is active (`register SH-17`; `live-sim.ts:902-905` is the fifth call
site, `SH-25`; coordinate with DR-1, OD-26). This is the E-02 correction. No new message type is
added: `meters`, `state`, `delta` and the control messages are unchanged (`realtime-messages.ts`).

**Erratum (capture-device kind).** The `captureDevices` kind vocabulary above previously used a
long-form audio label outside the DB set; it now reads `CAMERA|MIC|POE`, aligned to the normative DB
CHECK `capture_devices_kind_check` (`dbc-3 §B.2`: `CHECK IN ('CAMERA','MIC','POE')`, authored by row 45) — source: row 47 finding, D31.

---

## 7. Constants in `@dems/shared/api` (CS-25)

All live in a new module `packages/shared/src/api/capture.ts`, re-exported from
`@dems/shared/api`, and are pinned by
`apps/core-server/src/modules/__tests__/contract-values.test.ts` (extended; `register CS-25`; E-18).
The sibling `capture-spec §E.1` already names `MIC_SILENCE_DBFS`, `MIC_SILENCE_DURATION_MS`,
`MIC_DISCONNECT_DEBOUNCE_MS`; this contract fixes **all** of them as the single source.

| Constant | Value | Unit | Type | Authority / note |
|---|---|---|---|---|
| `MIC_SILENCE_DBFS` | `-50` | dBFS | number | OD-11 (D4); `capture-spec §E.1` |
| `MIC_SILENCE_DURATION_MS` | `10_000` | ms | number | OD-11 (D4) |
| `MIC_DISCONNECT_DEBOUNCE_MS` | `2_000` | ms | number | OD-11 (D4) |
| `CAPTURE_AUDIO_SAMPLE_RATE_HZ` | `48_000` | Hz | number | OD-06 (D4); AAC-LC 48 kHz mono |
| `CAPTURE_AUDIO_CHANNELS` | `1` | channels | number | OD-06 (D4); mono |
| `CAPTURE_FRAGMENT_TARGET_MS` | `2_000` | ms | number | S1 SP-4; **open decision**, see below |
| `CAPTURE_GOP_FRAMES` | `50` | frames | number | S1 `-g 50 @ 25 fps` = 2.0 s; SP-4. **Erratum AU2-08:** a **target** — enforced only where DEMS encodes (fakes) and written to the camera (ONVIF `GovLength`) at session start; on the copy path the camera's GOP is used and the worker verifies the observed keyframe interval (`capture-spec §C.1`, OP-GOP) |
| `CAPTURE_MIN_FRAG_DURATION_MS` | `2_000` | ms | number | S1 SP-4; pairs with the GOP |
| `SEALING_PROGRESS_INTERVAL_MS` | `1_000` | ms | number | per-step progress/ETA recompute (R-6; op 83); design proposal |
| `CAPTURE_METER_RATE_HZ` | `20` | Hz | number | `register NM-02` (20 Hz meters) |
| `EVIDENCE_MEDIA_SESSION_TTL_MS` | `60_000` | ms | number | SEC35-12; short-lived media token (E-31); replay window = this TTL |
| `EVIDENCE_MEDIA_TOKEN_PREFIX` | `'mts_'` | — | string | SEC35-13; the signed-URL prefix added to both blanking lists (E-31) |
| `MEDIA_SESSION_SIGNING_KEY_ID` | `'MEDIA-KEY-EVMEDIA-01'` | — | string | SEC35-12; the separate media-session signing key id (never the evidence `Signer` key) |

**Fragment-quantum decision flagged as OPEN.** The pair `CAPTURE_GOP_FRAMES` = 50 and
`CAPTURE_FRAGMENT_TARGET_MS`/`CAPTURE_MIN_FRAG_DURATION_MS` = 2_000 encodes the S1 finding that
`frag_keyframe + min_frag_duration` cuts keyframe-aligned on the **GOP grid** (the GOP is the
fragment quantum; D10(b); S1 §6.4/§6.5 SP-4; `capture-spec §C.1`). `capture-spec §C.1` records this
pairing as a **decision for the M0 spec gate**, so it is written here as a contract constant **with
its open decision flagged** (row 39 must confirm it; OD-21 legal confirmation is separate and stays
unresolved, S1 §10 gap 5 / `coll3 F-102`). No `frag_typ[e]`, `default_prf[t]` or `frag_start_numbe[r]`
constant is introduced (W1-C1; `capture-spec §C.4`).

`sibling transcript-spec §0.2` owns `AUDIO_FRAME_MS = 21.333` and the STT/VAD/`TRANSCRIPT_DOC_VERSION`
constants; this contract does **not** duplicate them (J.9 anchor-only rule). The two specs share the
48 kHz/21.333 ms audio grid by value.

---

## 8. OpenAPI versioning plan

| Scope | Constant and line (current) | Change | Authority |
|---|---|---|---|
| `all` | `OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.2.1'` at `packages/shared/src/api/openapi.ts:106` | **→ `'0.3.0'`** | blueprint row 29; `structured §3.1` ("about 88"); contract C3 |
| `offline` | `OPENAPI_DOCUMENT_VERSION = '0.1.0'` at `packages/shared/src/api/openapi.ts:102` | **→ `'0.2.0'`** | OD-17 (D4); register §C OD-17, SH-19, W1-C9 (`research/03_analysis.md:337`); row 1 §2.5 |

The exact edits are the two string literals at `openapi.ts:102` and `openapi.ts:106`, plus the header
comment at `openapi.ts:13` and the `0.2.0 until the contract close-out W83` comment at
`openapi.ts:104-105` (both must read the new values). No other constant in `openapi.ts` changes:
`OPENAPI_VERSION` stays `3.1.0`.

**Why `offline` changes (OD-17).** `OD-17` says the simulator emulates v2, so the shared in-app
simulator answers the new capture/transcript operations; those operations are `mode: 'simulated'`
and therefore belong to the `offline` scope (`openApi` `isOfflineCoreApiOperation`,
`core-api.ts:911-918`). OD-17 **supersedes** the `offline` byte-for-byte pin
(`openapi.ts:22-24`, held by `test/api-openapi-scope.test.ts`); M2 updates that test to the OD-17
scope instead of the baseline commit.

**Which of the 14 are visible in `offline`.**

| Visible in `offline` (mode `simulated`; 13 ops) | `all`-only (mode `live`; 1 op) |
|---|---|
| 76 `getCaptureConfig`, 77 `getCaptureDevices`, 78 `updateCaptureConfig`, 79 `setCaptureCameraSource`, 80 `setPrimaryMic`, 81 `switchAudioSource`, 82 `listAudioSourceIntervals`, 83 `getSealingProgress`, 84 `getTranscript`, 85 `createTranscriptRevision`, 86 `listTranscriptRevisions`, 87 `getEvidenceExportJob`, **89 `setCaptureDeviceCredential`** | 88 `createEvidenceMediaSession` |

88 is `live` only: Simulated mode plays the bundled demo media and opens no signed media session
(`register NM-11`; predecessor `specs §11` MS-1 still true for Simulated mode). 87 is `simulated`
because OD-17 says the simulator emulates the new sealing/export steps; its `mode` is re-checked at
row 39. 89 is `simulated` (the simulator accepts the write opaquely and never stores or echoes a
credential), so OD-17's "simulator emulates v2" stays true; its `mode` is re-checked at row 39.

**Projected pinned counts (M2 owns the edit).** The `offline` document grows from **10** operations
(health + 9 design-book, `openapi.ts:11`) to **23** (10 + the 13 simulated above). The `all` document
grows from **75** to **89** and from `27 GET / 48 POST` to **`34 GET / 55 POST`** (§2.2). The edits
are in `apps/core-server/test/acceptance/contract.test.ts:374-380` (the `75`/`27`/`48` literals) and
`packages/shared/openapi/openapi.json` (regenerated by `npm run openapi:gen -w @dems/shared`). The
`rbac-matrix.test.ts` loops over the registry (`rbac-matrix.test.ts:5-8`, "the registry's 75
entries"), so it follows the new count with no literal edit. **These are M2 implementation steps
(register SH-19, WB-09, CS-25; `structured §6 M2` "OpenAPI drift test at 0.3.0"); this row is the
contract.** The op-count change (89) and the offline count (23) are additions for row 36/37 to fold
into M2-API-1/M2-API-2 and the section-C pin family.

---

## 9. Explicit non-goals (red-line guards)

| # | Non-goal | Authority |
|--:|---|---|
| N-1 | **No code change in this row.** No file in `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile` is edited; the contract source is read-only input. M2 writes the registry, the slices, the audit allow-list, `openapi.json` and the pinned counts. | blueprint row 29 ("the actual code change happens in M2"); red line |
| N-2 | **Capture devices never reuse `AdminResource.DEVICE[S]`.** That value (`realtime-messages.ts:156`) is the **paired-client registry** event (`USERS`/`DEVICES`/`PAIRING_CODE`). Capture devices use the new slices `captureConfig`/`captureDevices` and their own delta `slice` literal (E-04; SH-16; `capture-spec G §G-R5`). If a notification kind is ever required, use `CaptureResource.*`, never `AdminResource`. | E-04; `register §A E-04` |
| N-3 | **No secret in any audit detail key or value** (§5.1), and no signed URL or its prefix in a log or an audit row (E-30/E-31). | E-30, E-31; `specs C-N8/C-N9` |
| N-4 | **Nothing here contradicts OD-13 (loopback listener) or OD-18 (demo controls disabled in real mode).** The media route (op 88) is loopback-only; the signed URL is `http://127.0.0.1:<port>/…` and LAN is class C (C-5). Demo fault injection/scenario/reset are disabled/fenced in real mode (modified ops 71-75). | OD-13, OD-18 (D4); `specs C-N4`; register §C OD-13/OD-18 |
| N-5 | **No LAN exposure, no TLS PKI, no physical device work** — that is class C (C-5). The contract is testable on emulators over loopback. | OD-13; `structured §9 C-5` |
| N-6 | **No media and no evidence file in git or `docs/`** (OD-25); this document cites no media. | OD-25; `specs C-N3` |
| N-7 | **No benchmark and no RTF/WER figure** anywhere in this contract (D230). | D230; `structured §6 M1` |
| N-8 | **Superseded items stay superseded**: no multi-track master (D223→D224/D225), no benchmark plan (D226→D230), no `MIC 1`/`MIC 2` mapping (D219→D220/D221), no AUDIO-MIX/channel attribution (D220), no MLX fp16 copy (D229). | `specs §D "Superseded"`; `register §E` |

---

## 10. Self-gate (this document's own acceptance)

| Gate check (from `structured row 29` Verification) | Result |
|---|---|
| **Every new or modified operation has method, path, access, audit type** | **14/14 new** (`§2.2`); **24/24 modified** (`§3`, 22 rows). Each new row carries method, path, tag, mode, access marker, audit success/denial and error codes. |
| **Total operation count stated** | **75 + 14 = 89** operations (projected 34 GET / 55 POST), `§1`. `offline` grows 10 → 23; `all` 0.2.1 → 0.3.0, `offline` 0.1.0 → 0.2.0 (`§8`). |
| **0 uses of `AdminResource.DEVICE[S]` for capture** (E-04) | `grep -n "AdminResource\.DEVICES" masterplan/03_api_contract.md` → **0 matches**. The prohibition uses the bracketed `AdminResource.DEVICE[S]` form (the repo's own forbidden-literal idiom, `capture-spec §C.4`); `grep -c "AdminResource.DEVICE[S]"` → the prohibition rows only (`§6`, `§9 N-2`). The capture kinds are `captureConfig`/`captureDevices` (`§6`). |
| **Every new audit type has an exact detail-key list with 0 secret keys** | **9/9** (`§5.2`): `CAPTURE_CONFIG_CHANGED`, `AUDIO_SOURCE_SWITCHED`, `CAMERA_POE_CYCLED`, `TRANSCRIPT_REVISED`, `MIC_SILENT`, `EVIDENCE_MEDIA_SERVED`, `EVIDENCE_EXPORT_FAILED`, `CAPTURE_CREDENTIAL_SET`, `CAPTURE_CREDENTIAL_REVEALED`. No key holds a credential, token, key, password, pairing code, typed username or signed URL (`§5.1`). `TRANSCRIPT_REVISED` carries the revision id + author + hash, **never the body**; `CAPTURE_CREDENTIAL_*` carry `deviceId` only. |
| **All six gate answers cited by decision ID** | **6/6** — OD-01, OD-09, OD-10, OD-15, OD-17, OD-22, each `D4` (`§0`). D7/D8/D10/D12 folded as binding corrections (`§0`). |
| **Every design choice cited** (`file:line`, decision ID, or register row) | Yes — every table row and every shape note carries a citation (`§2-§8`). |
| **Register rows required by this row are satisfied** | SH-03/SH-04/SH-12/SH-13/SH-14/SH-16/SH-19/SH-25, CS-04/CS-06/CS-07/CS-12/CS-14/CS-22/CS-25, NM-06/NM-07/NM-09/NM-10/NM-11/NM-12, WB-04/WB-09/WB-11, MB-07/MB-09, E-04/E-12/E-30/E-31, RK-12/T-33, W1-C1/W1-C7/W1-C9/W1-C10. |
| **W1-C7 not repeated** | No `--maxWorkers`/`--poolOptions` claim appears in this document. |

**Open items carried to the M0 gate (row 39) — no blocker.** (1) The register/sibling plural path
`/api/v1/sessions/{id}/audio-source` vs the area-4 singular convention (§1) — normalized here,
flagged. (2) The fragment-quantum pairing (`CAPTURE_GOP_FRAMES`/`CAPTURE_FRAGMENT_TARGET_MS`) is a
contract constant **with an open decision** (§7; `capture-spec §C.1`). (3) `offline` visibility of
ops 76-87 depends on the simulator actually emulating them in M2 (OD-17); row 39 re-checks. (4) The
`SESSION_HOLDER` access condition is proposed, not yet in `contract-model.ts` (§0) — M2 adds it
(SEC35-18, deferred to M2 with check `M2-API-3`). (5) The REAL-evidence case scope for op 88
(SEC35-16, §2.4) is **provisional and needs user confirmation at the second blueprint gate** — it
narrows the pre-existing all-roles `EVIDENCE_VIEW` reach beyond OD-10/OD-15. (6) The op-count change
(88 → 89), the offline count (22 → 23), the audit-type count (60 → 62) and the error-code count
(38 → 40) are row 36/37 pick-ups for M2-API-1/M2-API-2/M2-AUD-1 and the section-C pin family.

---

*Generated: 2026-10-07 16:55*
*Last Updated: 2026-10-08 (RV-SPEC errata AU2-07/AU2-08 + proposed §2.5 R-8 ops 90-92; earlier: row-35 security remediation SEC35-01/12/13/16/17/19/21/22)*
