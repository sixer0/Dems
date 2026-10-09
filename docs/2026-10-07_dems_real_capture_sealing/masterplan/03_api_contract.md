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
last_updated: 2026-10-09 (row-128 spec-gate fix pass PE-128-17..39 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 121 contract delta PE-121-01..PE-121-16, `masterplan/11_audit_errata.md` §5.8: R-9..R-11 operations 93-97 in §2.6 as a TARGET for rows 132-142, new totals stated once in §10.1 — the registry as built is still 92; D73-D78, D80; earlier the same day: pair-review errata PE-113-01..PE-113-14, `masterplan/11_audit_errata.md` §5: R-8 ops 90-92 CONFIRMED by D24 and COUNTED — registry 92, 35 GET / 57 POST, audit types 63, offline 26; row-113 driver choices recorded, D68; earlier: 2026-10-08 RV-SPEC errata AU2-07/AU2-08 and §2.5 added as a proposal; 2026-10-07 row-35 remediation, op 89 added)
---

# API Contract C3 — operations 76-97, modified operations, error codes, audit types, slices and constants

> **Erratum PE-121-01 (D73, D78, D80).** The title range is 76-97 since blueprint row 121: operations
> 93-97 (§2.6) are the contract for R-9, R-10 and R-11. They are a **target** — rows 132, 133, 136,
> 139 and 142 build them. Figures in this file that say 92 / 35 / 57 / 63 / 26 are the registry **as
> built** by row 113; the totals after the delta are stated once, in §10.1.
>
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
| `WEB_CONSOLE_SESSION` — **erratum PE-121-04** | `CoreApiAccessCondition` (new, proposed; rows 132 / 142 materialise) | the caller's operator session is **not** bound to a paired device (a web console session). Otherwise `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one `ACCESS_DENIED` row, before the body is used. `WEB_CONSOLE_SESSION` is a policy fence that keeps the camera credential off the tablet and phone code paths; it is not an authentication factor. The refusal comes before the body is **used**: nothing of the body reaches a log, an audit row or an error (**erratum PE-128-29**, SEC35-45). On ops 89, 95, 96 — every operation whose body carries a camera credential | D80(3); `contract-model.ts:89-120` (the condition list grows by one, §10.1; it is the complement of `DEVICE_SESSION`) |

The four additions are additive to closed value sets (`auth.ts`, `vocabulary.ts`,
`contract-model.ts`); no existing value changes meaning. `AUDIT_TYPE_CATEGORY` gains one entry per
new audit type (§5), as the predecessor required (`specs` §13.1 idiom).

---

## 1. Numbering and total count

| Item | Value |
|---|---|
| Existing registry (all scope) | **75 operations**, 27 GET / 48 POST (`core-api.ts:51`; `apps/core-server/test/acceptance/contract.test.ts:374-380`) |
| New operations this phase | **14**, numbered **76-89** (13 from the blueprint + op 89 added by the SEC35-01 remediation), **plus 3**, numbered **90-92** (R-8, §2.5; confirmed D24) = **17** — **erratum PE-113-02** |
| Modified operations (of the 75) | **24** substantive (§3, 22 table rows; the `72/73/74` row modifies three), each with before/after |
| New registry total | **92 operations**, **35 GET / 57 POST** — **erratum PE-113-02 (D24):** 89 (34 GET / 55 POST) was the M2 total for ops 76-89; ops 90-92 (1 GET + 2 POST) joined it at M6 row 113. Pinned by `packages/shared/test/api-registry.test.ts:285` (92) and `packages/shared/test/api-openapi-scope.test.ts:297-299` (35 GET / 57 POST) |
| R-8 operations (D20) — **CONFIRMED (D24), COUNTED; erratum PE-113-02** | ops **90-92** (§2.5), built by row 113. Counted facts: registry **92 (35 GET / 57 POST)**; audit types **63** (`STT_CONFIG_CHANGED`; `api-registry.test.ts:470`); error codes stay **40** (`packages/shared/test/api-envelope.test.ts:51`); replicated slices stay **30** (`packages/shared/test/api-state-slices.test.ts:443`); `offline` scope **26** (`api-registry.test.ts:692`; §8). The former wording "proposed, not counted ... if confirmed" is withdrawn |
| R-9..R-11 operations (D73, D78, D80) — **erratum PE-121-02** | ops **93-97** (§2.6): search, read of the search state and candidate list, connection test, adoption, local-input re-read. **Target, not built** (rows 132, 142). Every "92", "35 GET / 57 POST", "63" and "26" in this table is the as-built figure of row 113; the R-9..R-11 delta of row 121 moves this figure — the new target is stated once, in §10.1 |
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
| `CAPTURE_CONFIG` (discovery and connect flow) — **erratum PE-121-04** | SUPERVISOR, TECHNICIAN | R-9 AC-12; D80(2)-(4) | ops 93-97 (§2.6); **no new permission**. 93 / 94 / 97 on web, tablet and phone and while a session is open; 95 / 96 (and 89) web console only (`WEB_CONSOLE_SESSION`) and idle only |
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
never echoes the credential and the audit detail carries `deviceId` only (§5.2; RK-12). **Erratum PE-121-05 (D80(3), D80(7)):** op 89 additionally
carries the condition `WEB_CONSOLE_SESSION` (a tablet or phone session is refused `403 NOT_PERMITTED`,
`WEB_CONSOLE_ONLY`), and until the credential sealer of row 84 is provided it answers `503 NOT_READY`
(`CREDENTIAL_STORE_NOT_READY`) and stores nothing; its `{id}` is always a registered device (§2.4,
§2.6). **Access
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
| 89 | `CaptureCredentialWrite { username, secret }` (path `{id}` = the camera device; both fields **write-only**; **erratum PE-128-27:** `username` 1..255 printable ASCII without `<`, `>`, `&`, `"`, `'`, backslash, `secret` 1..1024 printable ASCII, else `422 INVALID_INPUT`) | 200 `CaptureConfig` (the credential is **never** echoed) | publishes `captureConfig` | 400, 401, 403 (**erratum PE-121-05:** also `NOT_PERMITTED` / `WEB_CONSOLE_ONLY` for a device-bound session), 404 unknown `{id}` (a candidate id is never a device id), 409 `CAPTURE_CONFIG_LOCKED`, 422 `INVALID_INPUT`, 503 `NOT_READY` (**erratum PE-121-05:** `CREDENTIAL_STORE_NOT_READY` until row 84) |

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
never be logged or audited** (§5). **Erratum PE-121-06 (R-11; D80(9)):** the `CaptureDevice` field
list gains `adapter` and `sourceClass` (§2.6 "Device shapes"); neither is a secret, and the list
still holds no credential member.

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
other operation reveals a credential. **Erratum PE-121-05 (open point 3 of `specs` §B.2.6; D80(7)):**
the path names a **registered** device only — op 89 never creates a `capture_devices` row and never
addresses a discovery candidate. A candidate becomes a device only in the commit of op 96, whose
credential leg runs this same write (same schema, module, sealer, store and audit type) inside the
adoption transaction (§2.6 "Adoption and operation 89"). Op 89 remains the way to **replace** the
credential of a registered camera. It is web console only (`WEB_CONSOLE_SESSION`), and before row 84
it answers `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) — no second store exists in the interim.

### 2.5 STT configuration operations 90-92 (CONFIRMED — D24, Q-STT-CFG answer (a); R-8, D20; built by row 113)

> **Erratum PE-121-02:** the counts in this block are the as-built figures of row 113; the R-9..R-11 delta of row 121 moves this figure — the new target is stated once, in §10.1.
>
> **Status: confirmed and counted (erratum PE-113-03; D24).** These three operations implement R-8
> (`specs` R-8; D20). The user confirmed Q-STT-CFG with all 13 proposed defaults at the second gate
> (D24: "Q-STT-CFG (a) all 13 proposed R-8 defaults confirmed") and row 113 built them
> (`packages/shared/src/api/transcription.ts:384-471`; `apps/core-server/src/modules/stt-config/`).
> They **are** part of the registry and of every pinned count: **92 operations, 35 GET / 57 POST**,
> audit types **63** (`STT_CONFIG_CHANGED`), error codes unchanged at **40** (existing codes only;
> the new `details.reason` values are listed in §4), slices unchanged at 30 (no new slice; see
> "Slice" below). All three are `mode: simulated`, so the `offline` scope grows **23 -> 26** (§8).
> The OpenAPI `info.version` values stay as built — `0.3.0` (`all`) / `0.2.0` (`offline`),
> `packages/shared/src/api/openapi.ts:108,114`; whether a version step is wanted is an open
> controller item (pair-113 navigator N-12), not decided here. Where a cell below differs from the
> proposal of 2026-10-08 it is marked **Erratum PE-113-nn**; the reason for each is in
> `masterplan/11_audit_errata.md` §5.

| # | operationId | Method | Path | Tag | Mode | Access (marker) | Audit success / denial | Register rows / class |
|--:|---|---|---|---|---|---|---|---|
| 90 | `getSttConfig` | GET | `/api/v1/transcription/config` | Device | simulated | `AUTHENTICATED` | `NONE-R` / `ACCESS_DENIED` | NM-06, NM-09 pattern; R-8; M6 |
| 91 | `updateSttConfig` | POST | `/api/v1/transcription/config` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | `STT_CONFIG_CHANGED` / `ACCESS_DENIED` | NM-06, NM-09 pattern, E-30, E-31; R-8; M6 |
| 92 | `testSttConnection` | POST | `/api/v1/transcription/config/test` | Device | simulated | `PERMISSION CAPTURE_CONFIG` | none on success (no state change) / `ACCESS_DENIED` | NM-06; R-8; M6 |

| # | Request | Success | Realtime | Errors |
|--:|---|---|---|---|
| 90 | none | 200 `SttConfig { enabled, backend: 'omlx-server'\|'cpu-local', endpoint?, model, language: 'id', diarization: boolean, credentialSet: boolean, credentialKind?: 'REFERENCE'\|'ENCRYPTED', revision, updatedBy?, updatedAt, pendingForNextSession: boolean, lastTest? { reachable, modelAvailable, testedAt } }` | none | 401; 403 `ORIGIN_NOT_ALLOWED` / revoked device (the request-stage guard, Core server only — every role may read, so no role is refused; `transcription.ts:403-405`); 503 `NOT_READY` (`details.reason: STT_CONFIG_NOT_SEEDED`) when the singleton row is missing (`modules/stt-config/index.ts:219-225`) — **erratum PE-113-04** |
| 91 | `SttConfigUpdate { revision, enabled?, backend?, endpoint?, model?, language?, diarization?, credential?: { kind: 'REFERENCE'\|'SECRET'\|'CLEAR', ref?, value? } }`. **Erratum PE-113-05:** the optional member `language` is part of the body (only `id` is accepted, OD-20; any other value is `LANGUAGE_NOT_SUPPORTED`, which was unreachable without the member). **Erratum PE-113-06:** `credential` is **one closed object with a cross-member rule**, not a union — a `REFERENCE` carries `ref` only, a `SECRET` carries `value` only, `CLEAR` carries neither; the accepted set is exactly the three forms formerly written as a union (wire-compatible), anything else (extra member, both members, wrong kind) is `422` | 200 `SttConfig` + `appliesFrom: 'NOW'\|'NEXT_SESSION'` | none (clients re-read op 90) | 400 `INVALID_JSON`, 401, 403 `NOT_PERMITTED`, **409 `INVALID_STATE` with `details.reason: REVISION_CONFLICT` and `details.currentRevision`** (a stale `revision`; nothing stored, no audit row — **erratum PE-113-07:** the former pointer "the same optimistic-revision refusal as op 78" dangled, op 78 defines only `409 CAPTURE_CONFIG_LOCKED`, §2.2), 422 `INVALID_INPUT` (`details.reason`: `ENDPOINT_NOT_LOOPBACK`, `LANGUAGE_NOT_SUPPORTED`, `BACKEND_UNKNOWN`), **503 `NOT_READY` with `details.reason: CREDENTIAL_STORE_NOT_READY`** for a `SECRET` write while the Core credential sealer is not provided (nothing stored; `REFERENCE` and `CLEAR` need no sealer — **erratum PE-113-08**, see the rule "Credential store (interim)" below), 503 `NOT_READY` (`STT_CONFIG_NOT_SEEDED`) when the singleton row is missing |
| 92 | none (tests the **stored** configuration) | 200 `SttConnectionTest { reachable, modelAvailable, backend, detailCode }` — `reachable: false` is a 200 result, not an HTTP error | none | 401, 403 `NOT_PERMITTED`, 503 `NOT_READY` (`details.reason: TRANSCRIBER_NOT_READY`; existing code, new reason value). **Erratum PE-113-08 (D68(d)):** the module opens no connection itself; it runs a **provided** probe, and until row 115 provides it the Core server answers this 503 on every call (`modules/stt-config/index.ts:175-180,264-266`). Row 115 must prove a 200 on a booted server |

**Rules.**

| Rule | Contract | Authority |
|---|---|---|
| RBAC | reads (90) for every role — tablets/phones show read-only status; writes and the test (91, 92) need `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN), the same permission as the device selector | D20; OD-10; §2.1 |
| When a change applies | 91 is **accepted while a session is open** and stored; it applies to the **next** session (`appliesFrom: 'NEXT_SESSION'`, `pendingForNextSession: true`); the open session keeps the snapshot taken at its start. The alternative (refuse while open, like 78-80 with `409 CAPTURE_CONFIG_LOCKED`) was **not chosen**: Q-STT-CFG was answered (a), D24 — **erratum PE-113-09**. When idle the answer carries `appliesFrom: 'NOW'` | D20; D24; OD-10 pattern; `transcript-spec §B.7` |
| Credential never returned | no response, slice, log line or audit detail carries the credential or the reference target's contents. A `REFERENCE` (default for `omlx-server`: the oMLX key stays in `~/.omlx/settings.json`, referenced by path only — SEC35-14) or a `SECRET` stored encrypted in the Core credential store (`04_database_contract.md §B.13`); responses carry only `credentialSet` and `credentialKind`; the `value` field is write-only and never pre-filled | D20; E-31; SEC35-14; RK-12 pattern (op 89) |
| Loopback only | `endpoint` must resolve to `127.0.0.1`/`localhost` in this phase; anything else is `422 INVALID_INPUT` (`ENDPOINT_NOT_LOOPBACK`); LAN is class C | OD-13 (D4); `specs` C-N4 |
| Test connection | 92 performs one loopback request to the configured backend (model list / health) with a short timeout and reports `reachable`/`modelAvailable`; it never sends audio, never starts or restarts oMLX (D7(d)), never reports a speed figure (D230), and is serialised with other oMLX calls | D7(d); D230 |
| Disabled / unreachable effect | `enabled: false` → no transcriber work in the next session; the package records `transcript.state = 'DISABLED'` (`06_evidence_package_spec.md §B.7a`). Enabled but unreachable at run time → D-EV-1 failure rule | D20; D-EV-1 |
| Slice | no new realtime slice (keeps 30); clients re-read op 90 on screen entry and after 91. **No `sttConfig` slice** — the alternative is closed by D24 (**erratum PE-113-09**) | D20; D24 |
| Stale revision (**erratum PE-113-07**) | `revision` is an optimistic lock. A body made from an older revision answers `409 INVALID_STATE`, `details.reason: REVISION_CONFLICT`, `details.currentRevision` (a counter, not a secret); nothing is stored and no audit row is written. The stale revision is refused **before** the named 422 values. An update that changes nothing writes no audit row and keeps the revision | D68; `transcription.ts:76-77,282-283,307,432-436`; `modules/stt-config/change.ts:82-86,196-199` |
| Credential store (interim; **erratum PE-113-08**, D68(c)) | a `SECRET` is stored only as ciphertext produced by a **provided** credential sealer. No Core credential store exists yet, so a `SECRET` write answers `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) and stores nothing — the secret is never kept in a weaker form. **Row 84 (M7-W3 key store, SEC35-03) owns `provideCredentialSealer` and the matching opener** for the key-loader. Until row 84: row 115 treats a stored `ENCRYPTED` kind as "credential unavailable", and row 117 offers the reference form only and shows the 503 reason plainly | D68(c); `modules/stt-config/seams.ts:12-20`; `modules/stt-config/index.ts:110-111,147-149`; `modules/stt-config/change.ts:96-100,173`; `transcription.ts:80-81` |

**`STT_CONFIG_CHANGED`** (audit type, **confirmed D24**; category `DEVICE`, written by op 91 on
success only). Exact detail keys: `changedFields: string` — **erratum PE-113-10:** the changed field
**names** joined with a comma (for example `enabled,model,credential`), in the fixed order `enabled,
backend, endpoint, model, language, diarization, credential`, **not** a `string[]`: an audit detail
is a flat map and cannot store a list value (`transcription.ts:114-117,353-365`;
`apps/core-server/src/core/audit-details.ts:118,268-271`); a name of this closed set holds no comma;
never values; `enabled: boolean` (the new value — not a secret), `backend: string`, `credentialChanged:
boolean`, `revision: number`. The endpoint, model path, credential and reference target are **never**
in the detail (E-30/E-31). No row on refusal.

### 2.6 Discovery, connect flow and local inputs — operations 93-97 (R-9, R-10, R-11; NEW SCOPE D73, approved D78; rulings D80)

> **Status: contract delta of blueprint row 121 (erratum PE-121-03).** Target for rows 132, 133,
> 136, 139 and 142; **nothing here is built yet** — the registry holds 92 operations until row 132
> lands. Inputs: `specs` §B.2 (R-9 16 AC, R-10 6 AC, R-11 10 AC; C-N13..C-N15), the controller
> rulings D80 (1)-(11), D72(g)(h)(k), D73-D78. The pinned totals this section moves are stated
> **once**, in §10.1. Values marked *(proposed)* are confirmed or changed by the row named beside
> them; everything else is normative for rows 132-142.

**Identity.**

| # | operationId | Method | Path | Tag | Mode | Access (marker + condition) | Audit success / denial | Requirement |
|--:|---|---|---|---|---|---|---|---|
| 93 | `startCaptureDiscovery` | POST | `/api/v1/capture/discovery` | Device | simulated | `PERMISSION CAPTURE_CONFIG` (web, tablet, phone) | `CAPTURE_DISCOVERY_SEARCHED`, written once when the search window closes / `ACCESS_DENIED` | R-9 AC-1(a), AC-2..AC-4, AC-11..AC-13; R-10 AC-1, AC-4 |
| 94 | `getCaptureDiscovery` | GET | `/api/v1/capture/discovery` | Device | simulated | `PERMISSION CAPTURE_CONFIG` (web, tablet, phone); **owner session only** | `NONE-R` / `ACCESS_DENIED` | R-9 AC-2, AC-4, AC-12 |
| 95 | `testCaptureCandidateConnection` | POST | `/api/v1/capture/discovery/candidates/{id}/test` | Device | simulated | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` (**web console only**, D80(3)) | `CAPTURE_CONNECTION_TESTED`, one row per attempt, every outcome / `ACCESS_DENIED` | R-9 AC-5..AC-7, AC-10, AC-11, AC-13 |
| 96 | `adoptCaptureCandidate` | POST | `/api/v1/capture/discovery/candidates/{id}/adopt` | Device | simulated | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` (**web console only**) | `CAPTURE_CANDIDATE_ADOPTED` (+ `CAPTURE_CONNECTION_TESTED` for its re-verification; + `CAPTURE_CREDENTIAL_SET` when a credential is stored) / `ACCESS_DENIED` | R-9 AC-5, AC-8, AC-9; open point 3 |
| 97 | `rescanCaptureInputs` | POST | `/api/v1/capture/inputs/rescan` | Device | simulated | `PERMISSION CAPTURE_CONFIG` (web, tablet, phone) | `CAPTURE_DISCOVERY_SEARCHED` with `scope: MIC_LOCAL` / `ACCESS_DENIED` | R-10 AC-2, AC-4; D80(5) |

Access notes. No new permission (R-9 AC-12): every operation needs `CAPTURE_CONFIG` (SUPERVISOR +
TECHNICIAN, §2.1); any other role is refused `403 NOT_PERMITTED` with one `ACCESS_DENIED` row. An
operator signed in on a paired tablet or phone (a device-bound session) may call 93, 94 and 97. The
two operations that carry a camera credential in the body — 95 and 96 — and operation 89 carry the
new condition `WEB_CONSOLE_SESSION` (§0): a device-bound session is refused `403 NOT_PERMITTED`,
`details.reason: WEB_CONSOLE_ONLY`, with one `ACCESS_DENIED` row, **before the body is used**
(D80(3); the R-8 precedent was a UI rule only — here the server enforces it). `WEB_CONSOLE_SESSION` is a policy fence that keeps the camera credential off the tablet and phone code paths; it is not an authentication factor. The refusal comes before the body is **used**: nothing of the body reaches a log, an audit row or an error (**erratum PE-128-29**, SEC35-45). The search that a
pre-check runs (below) is not an API operation and needs no `CAPTURE_CONFIG` of its starter
(D80(2)).

**Shapes.** Every request schema is a `z.strictObject` (an unknown member is `422 INVALID_INPUT`).
`epochMs` = Core clock, integer milliseconds.

| # | Request | Success | Realtime | Statuses and error codes (`details.reason`) |
|--:|---|---|---|---|
| 93 | **none.** The body is absent or `{}`. No address, subnet, interface, port, timeout or filter member exists — a search always probes the fixed WS-Discovery multicast group | `202 CaptureDiscoverySearch` for a new search; `200` with the same object and `created: false` when the caller's own search is still `RUNNING` (no second probe). `CaptureDiscoverySearch { searchId: string /^DSC-[0-9]{6,}$/, scope: 'CAMERA_NETWORK', trigger: 'MANUAL'\|'PRECHECK', state: 'RUNNING'\|'COMPLETE'\|'FAILED', startedAt: epochMs, windowMs: number, completesAt: epochMs, expiresAt: epochMs, responderCount: number, newCount: number, registeredCount: number, interfaceCount: number, failureReason: string\|null, created: boolean }` (**erratum PE-128-26:** `interfaceCount` = interfaces probed; a count, never a name or an address) (the three counts are `0` while `RUNNING`) | none; raises or resolves the situation-A alert in the `alerts` slice when the window closes (§5.4) | 401; 403 `NOT_PERMITTED`; **409 `INVALID_STATE`** (`DISCOVERY_IN_PROGRESS`: another operator session's search is running — one socket per Core, C-N13); **429 `RATE_LIMITED`** (`DISCOVERY_RATE_LIMITED`, `retry-after`); **503 `NOT_READY`** (`DISCOVERY_NOT_READY`: no discovery adapter is provided, or capture is not ready). **Never `409 CAPTURE_CONFIG_LOCKED`** — a search is allowed while a session is open (D80(4)). **Erratum PE-128-21 (D86 C-4):** **409 `INVALID_STATE`** (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`): the session state is `RECORDING` and `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` is `false` — 0 datagrams, no audit row, no alert. The constant becomes `true` only when the gate artifact records `M4-SEC-DISC-1` and `M4-SEC-DISC-3` PASS (check `M4-DISC-REC-1`) |
| 94 | none | `200 CaptureDiscoveryState { search: CaptureDiscoverySearch \| null, candidates: CaptureCandidate[], truncated: boolean }`. `search: null` and `candidates: []` when the caller's session has no live search (never started, expired, replaced). `candidates` is empty while `RUNNING` and complete once `COMPLETE` (forward-only: the list never shrinks or reorders during its life). `truncated: true` when more than `CAPTURE_DISCOVERY_MAX_CANDIDATES` devices answered (**erratum PE-128-26:** already-registered matches are kept first, then arrival order) | none — **no slice** (see "Why no slice") | 401; 403 `NOT_PERMITTED` |
| 95 | `CaptureConnectionTestRequest { credential?: { username: text 1..255, secret: text 1..1024 } }` — **erratum PE-128-27 (D86 SEC35-35):** `username`: 1..255 printable ASCII without `<`, `>`, `&`, `"`, `'`, backslash; `secret`: 1..1024 printable ASCII; anything else is `422 INVALID_INPUT` before any network request (limit of this phase: a camera with a non-ASCII password cannot be tested). The same rule applies to the body of operation 89 and to the `credential` member of operation 96. **The target is the candidate in the path and nothing else: the body has no address, host, port, URL, path or profile member** (R-9 AC-10). `credential` is **required** for a candidate of `sourceClass: PRODUCTION` and optional for `DEVELOPMENT` (loopback fixture candidates). Both fields are write-only and live in the request scope only (rule "Credential in memory") | `200 CaptureConnectionTest { candidateId, outcome: 'REACHABLE'\|'AUTHENTICATION_FAILED'\|'WRONG_PROFILE'\|'NOT_H264'\|'UNREACHABLE', authenticated: boolean, testedAt: epochMs, usableProfileCount: number, failedAttemptsRemaining: number }`. **A failed test is a `200` result, not an HTTP error** (the op 92 idiom). `authenticated` says whether a credential was supplied — a fact, never a value. No device error text, no URL, no credential member | none | 400 `INVALID_JSON`; 401; 403 `NOT_PERMITTED` (role, or `WEB_CONSOLE_ONLY`); **404 `NOT_FOUND`** (the id is unknown, expired, or belongs to another session's search — one answer for all three); **409 `CAPTURE_CONFIG_LOCKED`** (a session is open; no audit row, SEC35-19); **409 `INVALID_STATE`** (`CANDIDATE_ALREADY_REGISTERED`, `CANDIDATE_NOT_TESTABLE`, `CONNECTION_TEST_IN_PROGRESS`); **422 `INVALID_INPUT`** (`CREDENTIAL_REQUIRED`; schema); **429 `RATE_LIMITED`** (`CONNECTION_TEST_RATE_LIMITED`, `CONNECTION_TEST_LOCKOUT_GUARD`; `retry-after`); 503 `NOT_READY` (`DISCOVERY_NOT_READY`). **Every refusal in this cell happens before any network request (0 outbound requests)** |
| 96 | `CaptureCandidateAdoptRequest { credential?: CaptureCredentialWrite }` — the member is the **same schema as the body of op 89** (`{ username, secret }`, `devices.ts:149-156`). It must be present exactly when the candidate's last passing test was authenticated. No other member: the adoption decides no track, no role and no address | `201 CaptureCandidateAdoption { deviceId: string, device: CaptureDevice, credentialSet: boolean }` (`CaptureDevice` as in op 77; the credential is **never** echoed) | publishes `captureDevices` (the new device); `captureConfig` is **not** changed | 400 `INVALID_JSON`; 401; 403 `NOT_PERMITTED` (role, or `WEB_CONSOLE_ONLY`); 404 `NOT_FOUND` (as 95); **409 `CAPTURE_CONFIG_LOCKED`**; **409 `INVALID_STATE`** (`CANDIDATE_ALREADY_REGISTERED` with `details.deviceId`; `CANDIDATE_NOT_TESTED` — no `REACHABLE` outcome younger than `CAPTURE_CONNECTION_TEST_VALIDITY_MS`; `CONNECTION_TEST_FAILED` with `details.outcome` — the re-verification did not answer `REACHABLE`; `CONNECTION_TEST_IN_PROGRESS`); **422 `INVALID_INPUT`** (`CREDENTIAL_REQUIRED`, `CREDENTIAL_NOT_EXPECTED`; schema); 429 `RATE_LIMITED` (as 95); **503 `NOT_READY`** (`CREDENTIAL_STORE_NOT_READY` — a credential is in the body and the Core credential sealer of row 84 is not provided; `DISCOVERY_NOT_READY`). **Every refusal stores nothing** |
| 97 | none | `200 CaptureInputScan { scannedAt: epochMs, inputs: [{ deviceId: string, inputId: 'MIC-01'\|'MIC-02'\|null, present: boolean, adapter: string, sourceClass: 'PRODUCTION'\|'DEVELOPMENT', errorCode: 'PERMISSION_DENIED'\|'DEVICE_BUSY'\|'DEVICE_NOT_FOUND'\|'OPEN_FAILED'\|'HELPER_EXITED'\|null }], unregisteredCount: number }` — one entry per **registered** microphone; local inputs that are not registered are counted only | publishes `captureDevices` (`online` of the microphones) | 401; 403 `NOT_PERMITTED`; 429 `RATE_LIMITED` (`INPUT_RESCAN_RATE_LIMITED`); 503 `NOT_READY` (`CAPTURE_NOT_READY`) |

`CaptureCandidate` (op 94) — built from the probe answer only (D80(1): no follow-up read of device
information; R-9 AC-2):

| Field | Type | Meaning |
|---|---|---|
| `candidateId` | string, `/^CND-[0-9A-F]{12}$/` | minted by the Core at random per search; meaningful only inside the owner session |
| `adapter` | string code (`^[A-Z][A-Z0-9_]{0,63}$`) | `ONVIF_RTSP` or `FAKE` (see "Device shapes"; **erratum PE-128-22**) |
| `sourceClass` | `'PRODUCTION'` \| `'DEVELOPMENT'` | derived by the Core from `adapter`; never set by a client |
| `host` | string, an IP literal | the address **the answer came from** — never a URL, never `user:password@` (C-N8) |
| `endpointRef` | string 1..120 \| null | the announced endpoint reference |
| `vendor`, `model`, `name` | string 1..120 \| null | announced scopes. **Untrusted device text**: stored and returned under the API-13 text rule, drawn as text only |
| `status` | `'NEW'` \| `'REGISTERED'` | `REGISTERED` when it matches a `capture_devices` row: by `endpointRef` = `onvif_uuid`, else by the candidate's service address (host, or host and port, as adoption would store it) = the whole stored `address` (`dbc-4` §N.5; D83). **Erratum PE-128-23 (D83; D-DB-15)** |
| `deviceId` | string \| null | the registered device when `status: REGISTERED` |
| `testable` | boolean | `false` when the responder announced a service address whose host is not `host` (D80(11)); such a candidate is listed and can never be tested (`409 CANDIDATE_NOT_TESTABLE`). **Erratum PE-128-26 (D86):** `false` also when no announced service address qualifies (`cap` DS-9: `NO_SERVICE_ADDRESS`, `ADDRESS_MISMATCH`) or the service address fails the form rule of SEC35-32 (2) |
| `conflict` | boolean | **Erratum PE-128-26 (D86; SEC35-28, SEC35-30):** two answers with one endpoint reference from different source addresses, or two endpoint references from one address: every such row is listed and `testable: false` |
| `addressChanged` | boolean | **Erratum PE-128-26 (D86; SEC35-30):** `REGISTERED` by endpoint reference while the answering address differs from the stored one |
| `lastTest` | `{ outcome, authenticated: boolean, testedAt: epochMs }` \| null | the last connection-test outcome in this search's life; no credential, no profile name |
| `adoptable` | boolean | `status: NEW`, and `lastTest.outcome = REACHABLE` younger than `CAPTURE_CONNECTION_TEST_VALIDITY_MS` |

**No secret in any shape (row 121 gate: 0 response shapes carry a credential).** The seven response
shapes of this section — `CaptureDiscoverySearch`, `CaptureDiscoveryState`, `CaptureCandidate`,
`CaptureConnectionTest`, `CaptureCandidateAdoption`, `CaptureInputScan`, and the changed
`CaptureDevice` — hold no `username`, no `secret`, no credential-bearing URL and no member derived
from either. The only credential-carrying members are the **request** member `credential` of 95 and
96 (and the body of op 89).

**Rules.**

| Rule | Contract | Authority |
|---|---|---|
| Search trigger | A search runs (a) by op 93, or (b) **once per pre-check run** inside `beginPrecheck` / `retryPrecheck` when a configured camera is unreachable — owned by the session of the operator who started the pre-check, `trigger: PRECHECK`, same audit row, same bounds except that the pre-check search has its own allowance of one per pre-check run, outside the per-minute and per-hour bounds; it stays single-flight (if another search is `RUNNING` it is not started and the pre-check result says so; the pre-check itself is not failed by it). **Erratum PE-128-20 (D86 C-8; SEC35-39 (3)).** Never at boot, on a timer, or as a side effect of a read (op 94 never probes) | R-9 AC-1; D74(1); D80(2) |
| Candidate state: where it lives | In the Core's memory only, as data of **one operator session** (the authenticated session that started the search). **No table, no slice, no file.** Candidates never appear in op 77 or in the `captureDevices` slice | R-9 AC-3, AC-4; D76(1) |
| Candidate state: ownership | Only the owner session reads it (op 94) or acts on it (95, 96). No role — not SUPERVISOR either — reads another session's search: for a foreign candidate id the answer is `404 NOT_FOUND`, and op 94 answers the caller's own state only (there is no search id in any path). The same operator on another client has another session and runs their own search. What everyone sees is the outcome as an alert (§5.4), never the list | R-9 AC-4, AC-10; D80(2), D80(3) |
| Candidate state: lifetime | Discarded at `expiresAt` = `completesAt` + `CAPTURE_DISCOVERY_RESULT_TTL_MS`; at sign-out or expiry of the owner session; at a Core restart; and when the owner starts a new search (the new list replaces the old one and the old candidate ids die with their test results). At most one live search per session and at most one `RUNNING` search per Core | R-9 AC-4; C-N13 |
| Not an SSRF or port-scan primitive | The target of 95 and 96 is a **candidate id** resolved inside the caller's own live search. The Core takes the address from its own search state (`host`, and a service address only when its host equals `host`); a client never supplies one. A search lists network responders only. `LOCAL_DEVICE` sources are never candidates: they are registered by row 136 (D83 O-8). A candidate with `adapter: FAKE` exists only when the probe reached the fake ONVIF stub through the loopback target injected by test support (`cap` DS-15); a candidate whose host is a loopback address is always `FAKE`, never `ONVIF_RTSP`, and operation 96 refuses to write `ONVIF_RTSP` for a loopback host (SEC35-41 (a)). No caller-supplied address exists in any mode. **Erratum PE-128-22 (D83 O-8; SEC35-41 (a)).** A foreign id, an expired id, another session's id and a `testable: false` candidate are refused with 0 outbound requests | R-9 AC-10; D80(11); D80(10) (typed-address entry is not in scope) |
| Connection test: what it does | One read-only attempt, at most `CAPTURE_CONNECTION_TEST_TIMEOUT_MS`, against the candidate: authenticate, list the media profiles, check for a usable H.264 profile. It changes no setting on the camera (no NTP, GOP, profile or PoE action — class C) and is never repeated without a new operator action. **Erratum PE-128-30 (D82; D86 C-2; SEC35-32 (4)):** codec and profile are judged from the authenticated ONVIF answer only; the Core opens no RTSP connection in this phase (D82). The pre-authentication calls carry no credential; the credential is attached for `GetProfiles`; the test stops at the first refusal — at most 2 rejected credential-bearing requests per failed test (SEC35-38). The stream address returned by `GetStreamUri` is compared, never stored and never contacted | R-9 AC-6, AC-7; D75; D76(2) |
| Connection test: outcomes | `REACHABLE` (answered; with a credential: authenticated; a usable H.264 profile exists) · `AUTHENTICATION_FAILED` (the camera refused the credential) · `WRONG_PROFILE` (no usable media profile) · `NOT_H264` (profiles exist, none is H.264) · `UNREACHABLE` (no answer within the timeout; D80(11)). Exactly these five; each is reachable on fixtures | R-9 AC-6; D80(11) |
| Credential in memory | The `credential` member of 95 and 96 is held in the memory of that one request and is gone when its answer is written: it is not kept in the candidate state, not cached for a later request, not written to a log line, an audit row, an error detail or a file, and not passed to another process on a command line or in an environment variable. A retry is a new request with a newly sent credential (R-9 AC-8). The Core holds **no** camera credential between requests anywhere except the one Core credential store. **Erratum PE-128-31 (D86 SEC35-34):** it cannot be erased from memory: the guarantee is request-scoped — one request, never serialised, never persisted, never logged, not reachable from any object that outlives the request | D80(7); R-9 AC-7, AC-8; C-N15 |
| Credential required | A `PRODUCTION` candidate is never contacted without an operator-entered credential (`422 CREDENTIAL_REQUIRED`, 0 outbound requests): "no credential means no connection attempt". A `DEVELOPMENT` candidate (loopback only, development flag on) may be tested and adopted without one; fixture cameras with fixture credentials exercise the authenticated outcomes | D76(2); D80(7); R-9 AC-7, AC-10(ii) |
| Adoption: when a `capture_devices` row comes into being (**open point 3**) | **Exactly once: in the commit of op 96.** Order inside op 96: access → idle check → candidate resolved in the caller's search → `status: NEW` → a fresh `REACHABLE` test → credential presence matches that test → the sealer is provided if a credential is present → **re-verification** (one read-only attempt with the credential of *this* request; not `REACHABLE` → `409 CONNECTION_TEST_FAILED`) → **one database transaction**: INSERT the `capture_devices` row, INSERT the `capture_device_credentials` row when a credential is present, and the audit rows. The re-verification compares the set of profile tokens with the set the passing test read; a difference answers `409 INVALID_STATE` (`CONNECTION_TEST_FAILED`, `details.cause: DEVICE_CHANGED`). No database transaction is open while the network attempt runs (SEC35-47; **erratum PE-128-31**). Any failure before or inside the transaction leaves **0** rows in both tables. Searches, tests, refused adoptions, closed prompts, sign-out and a Core restart write no row at all — there is no pending row and nothing to clean up | open point 3 of `specs` §B.2.6; R-9 AC-8; D76(2)-(3) |
| Adoption and operation 89 | Op 89 is **unchanged in path and body**: its `{id}` is always a **registered** capture device (`HARDWARE_DEVICE_ID_PATTERN`, `404` otherwise), so it can never address a candidate. The credential leg of op 96 **is the op-89 write**: the same request schema, the same single owning credential module, the same sealer seam, the same store, the same `CAPTURE_CREDENTIAL_SET` row (`deviceId` only; `operationId: adoptCaptureCandidate`) — run inside the adoption transaction so that a camera is never registered without the credential it was verified with. There is one store and one write path; op 96 adds no second one. After adoption, replacing the credential of that device is op 89 | D80(7); D76(3); D68(c); C-N15 |
| Before row 84 (sealer) | Op 89 and the credential leg of op 96 answer `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) and store nothing — the op 91 rule (§2.5 "Credential store (interim)"). So from M4: search, list, **every** test outcome (the test stores nothing, so it also runs with a credential), and adoption of `DEVELOPMENT` candidates **without** a credential. After row 84: adoption with a credential, hence of every `PRODUCTION` camera. No second credential store, no plaintext or weaker interim form | D80(7); D68(c); PE-113-08 |
| What adoption stores | `id` = the next free `CAM-NN` (the highest existing number + 1, two digits minimum, never reused — minted by the Core); `kind = 'CAMERA'` (written once, never updated, D72(f)); `transport = 'RTSP'`; `model` (announced, text rule); `address` (host or host:port, never a credential URL); `onvif_uuid` (= `endpointRef`); `profiles` (the usable H.264 profile codes the re-verification read); `enabled = true`; `last_seen_at`; and the adapter kind in `capture_devices.adapter_kind` (`dbc-4` §N.2; **erratum PE-128-24**). Not stored: the candidate id, the search id, the test history | open point 5 (row 122 owns the columns) |
| Adoption is not assignment | Op 96 changes no track. Assigning the new device to `VIDEO-01` / `VIDEO-02` is op 78 / 79 (R-1), which accept **registered** device ids only — so "assignable only after a successful test" holds by construction: a registered row exists only through the seed or op 96. Ops 78 / 79 never accept a candidate id (`422` by pattern) | R-9 AC-5 |
| Config lock | 93 is allowed in every open state except `RECORDING` until the lift; 94 and 97 are allowed while a session is open (**erratum PE-128-21**, D86 C-4). 95, 96 and 89 answer `409 CAPTURE_CONFIG_LOCKED` with no state change and **no** audit row | D80(4); OD-10; SEC35-19 |
| Idempotency | 93: idempotent while the caller's search is `RUNNING` (`200`, `created: false`); afterwards a new call is a new search. 94: a read. 95: **not** idempotent — each accepted call is one attempt and one audit row. 96: at most one device per candidate and per `endpointRef` — a repeat answers `409 CANDIDATE_ALREADY_REGISTERED` with the `deviceId`; two concurrent adoptions yield one row. 97: idempotent in effect | R-9 AC-8 |
| Rate limits *(values: §7; D86 C-8; erratum PE-128-20)* | Searches: one `RUNNING` per Core; per operator session at least `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` between starts and per Core at least `CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS`; per Core at most `CAPTURE_DISCOVERY_MAX_PER_MINUTE` and per operator session at most `CAPTURE_DISCOVERY_MAX_PER_HOUR`. Tests (95 and the re-verification of 96 count alike): one test at a time per Core; at least `CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` between attempts on one `host` and between two tests of one operator session on any host; at most `CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE` per Core; and the **lock-out guard**: at most `CAPTURE_CONNECTION_TEST_MAX_FAILURES` `AUTHENTICATION_FAILED` outcomes per `host` in `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS`, counted per Core **by host** (a new search, another session or another operator does not reset it). Over a bound: `429 RATE_LIMITED` with `retry-after`, 0 outbound requests, no audit row. Fake clock in tests (C-N5) | R-9 AC-11; D80(11) |
| Microphones | No network microphone discovery and no microphone adoption. Op 97 re-reads the local inputs (`AudioInputAdapter.enumerate()`) and reports each registered microphone as present or not, with the helper's named error for a local device (R-11 AC-5). It registers nothing and never replaces a local device by a fake. **Erratum PE-128-35 (cap §A.6.4 HL-10; D83 OP-125-4):** op 97 reports microphones only. A local camera's named cause reaches the clients as `params.cause` of the situation-B alert of a pre-check (§5.4); no other member carries it (accepted limit) | D80(5); OD-06; D80(11) |
| Why no slice | A replicated slice is one state for every client of the Core; the candidate list belongs to one session. Keeping it out of the slices keeps the slice count at 30 and makes "another operator cannot read it" structural. Clients poll op 94 while a search is `RUNNING` (not faster than once per second) | §6; R-9 AC-4 |
| Web Try-it | 95 and 96 carry a credential in the body and **join `TRY_IT_DENIED_OPERATIONS`** (`apps/core-web/src/features/api-reference/try-it.ts:39-48`), beside op 89 (the new list length is in §10.1). 93, 94 and 97 carry none and stay allowed in Simulated mode | row 121 requirement; D68(a) N-2 |

**Device shapes: adapter kind and development class (R-11; D80(9)).** `CaptureDevice` (op 77, slice
`captureDevices`) gains two members, and each camera and mic line of `CaptureConfig` (op 76, slice
`captureConfig`) gains `sourceClass`:

| Member | Type | Rule |
|---|---|---|
| `adapter` | string code | `adapter` is one of five values (`dbc-4` §N.2, `capture_devices.adapter_kind`): `ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE` (production kinds) and `FAKE`, `LOCAL_DEVICE` (development kinds; `LOCAL_DEVICE` = this Mac's camera or microphone behind a loopback helper, `FAKE` = a fixture source). **Erratum PE-128-24 (D83 D-DB-11)** |
| `sourceClass` | `'PRODUCTION'` \| `'DEVELOPMENT'` | `DEVELOPMENT` exactly when `adapter` is `LOCAL_DEVICE` or `FAKE`. The API class has two values; the manifest class of fields 124 / 125 is a different, three-valued set (`PRODUCTION` \| `LOCAL_DEVICE` \| `FAKE`) derived from the same adapter kind by the mapping of `dbc-4` §N.2. A per-source class (D80(9)): clients draw the "development source" label from it. Development configuration = capture operation `REAL_DEVELOPMENT` (`DEMS_CAPTURE_DEV_SOURCES=1`), production configuration = `REAL_PRODUCTION` (`cap` §A.1.2). **Erratum PE-128-24 (D81; D82(e); D83 D-DB-11)** |
| `sourceOpen` | boolean | **Erratum PE-128-38 (D86, SEC35-44 (4)):** `true` while the Core holds an open source of a `LOCAL_DEVICE` device (the short pre-check open included); the data behind the "is on" indicator of `ux` §8f (check `M5-SEC-PRIV-2-W/T/P`). Always `false` for other kinds |

**Erratum PE-128-36 (D83 OP-125-2).** `CaptureDevice` carries no `credentialSet` member in this phase: the runtime role has no SELECT on `capture_device_credentials` (`dbc-4` §N.7); only the answer of operation 96 states it. Recorded gap (OP-125-2).

How the kinds map. `capture_devices.kind` stays the **device class** `CAMERA` \| `MIC` \| `POE`
(`capture_devices_kind_check`, `0004_capture.sql:48`) and is immutable (no UPDATE grant, D72(f)).
The adapter kind is a **second axis** and never a new value of `kind`: a `LOCAL_DEVICE` camera is
`kind: CAMERA, adapter: LOCAL_DEVICE`; a `LOCAL_DEVICE` microphone is `kind: MIC, adapter:
LOCAL_DEVICE`. Like `kind`, the adapter of a row is written at INSERT and never updated: a device
that changes its adapter is another device with another id. In `REAL_PRODUCTION` ops 76 / 77 list **0** `DEVELOPMENT` devices, and op 78 / 79 refuse an assignment that names one (`422 INVALID_INPUT`, `DEVELOPMENT_SOURCE_NOT_ALLOWED`) — R-11 AC-2; in `SIMULATED` the stored kinds are inert and the seeded `FAKE` built-ins are listed as today (D83 O-2; `dbc-4` §N.9). The adapter kind is recorded in `capture_devices.adapter_kind` (`dbc-4` §N.2). **Erratum PE-128-25 (D83 O-2).**

**What R-10 reads — no new read operation.** The three notifications are Core state that every
client already receives: the replicated **`alerts`** slice (`state-slices.ts:800`; the alert rows
of §5.4), the **`captureDevices`** and **`captureConfig`** slices (`online`, `streamState`), and
the **`session`** slice (the pre-check result and the fault of a FAULTED session). The empty
candidate list itself is op 94. Nothing else is needed.

**Simulator (Simulated mode; the `offline` scope).** All five operations are `mode: simulated`. The
in-app simulator opens no socket, waits on no timer and answers deterministically, so parity tests
compare fixed values:

| # | The simulator answers |
|--:|---|
| 93 | `202` with a search that is already `COMPLETE` (`windowMs: 0`, `created: true`), two fixed candidates, `interfaceCount: 0`, one `CAPTURE_DISCOVERY_SEARCHED` row (`responderCount: 2`). It never answers 409, 429 or 503 and raises no alert (the list is not empty) |
| 94 | the state of that search: `CND-000000000001` (`NEW`, `adapter: FAKE`, `sourceClass: DEVELOPMENT`, `host: 127.0.0.1`, `testable: true`, `conflict: false`, `addressChanged: false`) and `CND-000000000002` (`REGISTERED`, `deviceId: CAM-01`); `search: null` before the first search and after a demo reset |
| 95 | for `…0001`: `200`, `outcome: REACHABLE`, `authenticated` = whether `credential` was sent; the body is accepted **opaquely** — never stored, never inspected, never echoed (the op 89 rule, §8). `…0002`: `409 CANDIDATE_ALREADY_REGISTERED`. Any other id: `404`. Open session: `409 CAPTURE_CONFIG_LOCKED` |
| 96 | for `…0001` after a `REACHABLE` test: `201`, registers `CAM-03` (`adapter: FAKE`) in the simulator's `captureDevices`, `credentialSet` = whether `credential` was sent, nothing stored; it never answers `503` (the simulator has no sealer, as for op 89). Without a test: `409 CANDIDATE_NOT_TESTED`. A demo reset removes `CAM-03` |
| 97 | `200` with the simulator's two microphones, `present` from its device state |

The simulator's devices carry `adapter: FAKE`, `sourceClass: DEVELOPMENT` (they are not production
devices). On a tablet or phone the in-app simulator refuses 95, 96 and 89 with the same
`403 NOT_PERMITTED` (`WEB_CONSOLE_ONLY`) as the Core server.

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

### 3.1 Changes made by R-9..R-11 (erratum PE-121-07; D72(k), D80)

Target for rows 132, 133, 136, 139 and 142. No row below adds a status or an error **code**; new
`details.reason` values are in §4.

| # | operationId | Before | After | Authority |
|--:|---|---|---|---|
| — | `beginPrecheck`, `retryPrecheck` (of the existing 75; `sessions.ts:241,267`) | the predecessor's pre-check items | each run also checks every configured camera and microphone for reachability and names each unreachable device by device id and label (never an address with a credential). **Start rule (D80(6), mirroring D72(k)):** both cameras unreachable, or both microphones unreachable → blocked (the existing `PRECHECK_BLOCKED` path); one camera of two, or the standby microphone, unreachable → a warning the operator acknowledges (the existing `PRECHECK_WARNINGS` path, `acknowledgePrecheckWarnings`) and a degraded session may start. **Erratum PE-128-33 (D83):** the selected ACTIVE (primary) microphone unreachable blocks the start (the existing `PRECHECK_BLOCKED` path) whatever the state of the standby; no operation switches at pre-check. When a configured camera is unreachable the run performs **one** search (§2.6 "Search trigger") and reports its responder count. Each unreachable device raises the situation-B alert once (§5.4). A later run in which the device is reachable resolves it | R-10 AC-2, AC-5; R-9 AC-1(b); D80(2), D80(6) |
| — | recording start (session machine; no operation changes shape) | a start with no camera was not ruled | no camera connects within the ingest-open window → the session is FAULTED, nothing claims to record, 0 evidence files; `session.fault` carries `CAPTURE_FAULT` with the reason `NO_CAMERA_CONNECTED` (§5.4 situation C). One camera of two → the session records, with the degraded warning naming the missing camera. `getCurrentSession` (27) keeps its shape. **Erratum PE-128-34 (D84; D86 C-5; D82; ruling R-1 option A, D91):** a session presents 'recording' only from the first durable fragment; until then it presents 'connecting cameras' — the stored state stays `RECORDING` and the session payload carries one boolean, `captureDurable`, `false` until the first durable fragment. `FAULTED` with nothing durable is a failed start: 0 evidence files, 0 evidence items, no interrupted seal; `FAULTED` with a durable fragment goes to the interrupted seal. The ingest-open window is a named setting passed by the launcher (D84). A start is refused before `app.capture.start` — no listener opens, no source row is written — when an assigned device's adapter kind has no opener in this phase (`ONVIF_RTSP`, `USB_AUDIO`): `409 INVALID_STATE` (`SOURCE_KIND_NOT_RECORDABLE`), also reported as a BLOCK item of the pre-check; a mixed session (production and development sources) is refused the same way (D82, D86 C-5) | D72(k), D72(i); R-10 AC-3 |
| 39 / 40 | `listEvidence` / `getEvidence` (rows of §3) | `EvidenceItem` v2 without a development-source mark | **Erratum PE-128-32:** `EvidenceItem` gains `developmentSources: boolean \| null` — the copy of `evidence_items.development_sources` (manifest field 126); `null` = not recorded (v1 or pre-`0008` item), never read as production | D81 (row 124 A-2); D83 (OP-125-3) |
| 41 | `verifyEvidence` (row of §3) | per-file verify result without a source block | **Erratum PE-128-32:** the response gains `sources: { ok: boolean, development: boolean, tracks: [{ trackId, deviceId, sourceClass }], audioIntervals: [{ seq, micDeviceId, sourceClass }] }` with the manifest classes `PRODUCTION` \| `LOCAL_DEVICE` \| `FAKE` (`ev` §D.1, V-15); top-level `ok` is unchanged by the value of the mark. The three operations (39, 40, 41) are already in the modified set: the count stays 26 | D81 (row 124 A-2); D83 (OP-125-3) |
| 76 / 77 | `getCaptureConfig` / `getCaptureDevices` | `CaptureDevice` = `id, kind, model, firmware, host, poePort, online, streamState, capabilities` | `CaptureDevice` gains `adapter` and `sourceClass`; each camera and mic line of `CaptureConfig` gains `sourceClass` (§2.6 "Device shapes"). In `REAL_PRODUCTION` both list 0 `DEVELOPMENT` devices; in `SIMULATED` the stored kinds are inert and the seeded `FAKE` built-ins are listed as today (D83 O-2; `dbc-4` §N.9; **erratum PE-128-25**). Discovery candidates never appear in either | R-11 AC-2, AC-6; D80(9); R-9 AC-4 |
| 78 / 79 | `updateCaptureConfig` / `setCaptureCameraSource` | accept the seeded device ids | accept **any registered** device of the right kind, including an adopted `CAM-NN` (the description of `CAPTURE_DEVICE_PARAM`, `devices.ts:365-369`, names five ids and must be widened); refuse a `DEVELOPMENT` device while the development flag is off (`422 INVALID_INPUT`, `DEVELOPMENT_SOURCE_NOT_ALLOWED`); never accept a candidate id | R-9 AC-5; R-11 AC-2 |
| 89 | `setCaptureDeviceCredential` | any `CAPTURE_CONFIG` session; `503 NOT_READY` unspecified | web console only (`WEB_CONSOLE_SESSION`); `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) until row 84; registered devices only (PE-121-05) | D80(3), D80(7) |
| — | `signOut` and session expiry (of the existing 75) | end the operator session | also discard that session's discovery state (§2.6 "lifetime"); no shape change | R-9 AC-4 |

Count: of the existing 75 operations two more change behaviour (`beginPrecheck`, `retryPrecheck`), so
the modified set is 24 + 2 = **26**; `signOut` and the recording start are behaviour notes with no
contract change. **Ruled (D83):** the selected ACTIVE (primary) microphone unreachable blocks the start (the existing `PRECHECK_BLOCKED` path). No operation switches at pre-check: the operator cancels the session, sets the primary microphone on Devices (operation 80, idle) and starts again. **Erratum PE-128-33 (D83; replaces the D81 mic-toggle ruling).**

---

## 4. Error codes

New codes are added to `ApiErrorCode` (`core-api.ts:153-186`; currently **31** codes) and to
`API_ERROR_CODES`. **9 new codes** → 40 (the original 7 plus the SEC35-22 reconciliation of
`RESET_BLOCKED_REAL_EVIDENCE` and `TRANSCRIPT_AUDIO_UNAVAILABLE`, which rows 30/33 already use).
Every machine code is `SCREAMING_SNAKE_CASE`
(`API_ERROR_CODE_PATTERN`, `patterns.ts`) so the audit writer's `code()` rule accepts it
(`audit-details.ts:50`). A failed export job is **not** an HTTP error: it is the job's `status:
FAILED` in the `200` body of op 87 (audited as `EVIDENCE_EXPORT_FAILED`, §5.2).

**Erratum PE-121-08 (R-9..R-11).** The delta of row 121 adds **no error code** (the count stays 40,
§10.1): every new refusal is an existing code with a new `details.reason` value, the pattern of
PE-113-07 / PE-113-11. A failed connection test is **not** an HTTP error — it is the `outcome` of a
`200` body (op 95). The reasons are in the table "New reason values of the row-121 delta" below. The
alternative (five new codes such as a discovery-in-progress or a candidate-not-tested code) was
not chosen: it would move the pinned count without telling a client anything the reason does not.

**Client-facing message rule.** Every `message` is fixed, operator-safe English; it quotes **no part
of the request**, names no ID the caller did not prove it may see, and carries no credential, token,
key, password or signed URL (`ApiErrorSchema`, `core-api.ts:194-216`; predecessor `specs §7.2`). The
machine-readable cause travels in `details.reason`/`details.simCode` (flat map). A gated control
that is refused by access shows the **"Checking your permissions…"** state (E-16; `specs C-N12`); a
forward-only progress read shows its last Core-instant value, never a rewind (E-13).

| Code | HTTP | Message (rule) | Returned by | Register + decision |
|---|--:|---|---|---|
| `CAPTURE_CONFIG_LOCKED` | 409 | "The capture configuration cannot be changed while a session is open." | 78, 79, 80, 89; **erratum PE-121-08:** also 95, 96 (never 93, 94, 97 — D80(4)) | OD-10; SH-04/CS-12; register E-30 (no audit row on this refusal) |
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
| `NOT_READY` (503) | gains `details.reason: CAPTURE_NOT_READY` when the capture worker/binary/store is not ready (boot checks). **Erratum PE-113-11 (D68):** three more reason values on the same code, no new code — `TRANSCRIBER_NOT_READY` (op 92: no transcriber probe can run), `CREDENTIAL_STORE_NOT_READY` (op 91: a `SECRET` write while no credential sealer is provided), `STT_CONFIG_NOT_SEEDED` (ops 90-92: the singleton `stt_config` row is missing) | all capture ops + boot; 90, 91, 92 | CS-22; `specs B AC-3`; `core-api.ts:185`; `transcription.ts:78-81`; `modules/stt-config/change.ts:57-58,75-79` |
| `RECORDING_ACTIVE` (409) | unchanged meaning; also raised when a PoE cycle is attempted during RECORDING | 48 | OD-22; `devices.ts:150` |
| `INVALID_STATE` (409) | 81 raises it when the session is not RECORDING; 83 when sealing has not started | 81, 83 | `sessions.ts:451` idiom |
| `NOT_FOUND` (404) | 79/80 for an unknown `{id}`; 81/82 for an ID that is not the open session (the existing rule, `sessions.ts:9`) | 79, 80, 81, 82 | existing |
| `FORBIDDEN` (403) vs `NOT_PERMITTED` (403) | `NOT_PERMITTED` for every new permission refusal; `FORBIDDEN` is not used by any new op (RB-5 keeps it for exports only) | all new | RB-4/RB-5; `contract.test.ts:384` |
| `DEMO_DISABLED` (403) | widened to real-capture mode for 72/73/74/71 | 71-74 | OD-18; CS-23 |
| `SESSION_ACTIVE` (409) | **not** reused for the idle-only config lock; `CAPTURE_CONFIG_LOCKED` is distinct so a client can tell "another session is open" from "the config is read-only now" | 78-80 vs 24 | OD-10 |

**New reason values of the row-121 delta (erratum PE-121-08; no new code).**

| Code (existing) | HTTP | New `details.reason` | Returned by | Meaning; what was done |
|---|--:|---|---|---|
| `INVALID_STATE` | 409 | `DISCOVERY_IN_PROGRESS` | 93 | another session's search is running; no probe sent |
| `INVALID_STATE` | 409 | `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` (**erratum PE-128-21**) | 93 | the session state is `RECORDING` and the lift constant is `false` (D86 C-4); 0 datagrams, no audit row, no alert |
| `INVALID_STATE` | 409 | `SOURCE_KIND_NOT_RECORDABLE` (**erratum PE-128-34**) | recording start; also a BLOCK item of the pre-check | an assigned device's adapter kind has no opener in this phase, or the session mixes production and development sources (D82, D86 C-5); refused before `app.capture.start` |
| `INVALID_STATE` | 409 | `CANDIDATE_ALREADY_REGISTERED` (+ `details.deviceId`) | 95, 96 | the candidate matches a registered device; nothing done |
| `INVALID_STATE` | 409 | `CANDIDATE_NOT_TESTABLE` | 95 | announced service host ≠ answering host (D80(11)); 0 outbound requests |
| `INVALID_STATE` | 409 | `CANDIDATE_NOT_TESTED` | 96 | no `REACHABLE` outcome inside `CAPTURE_CONNECTION_TEST_VALIDITY_MS`; nothing stored |
| `INVALID_STATE` | 409 | `CONNECTION_TEST_FAILED` (+ `details.outcome`) | 96 | the re-verification did not answer `REACHABLE`; nothing stored |
| `INVALID_STATE` | 409 | `CONNECTION_TEST_IN_PROGRESS` | 95, 96 | a test of this candidate is running; no second attempt |
| `INVALID_INPUT` | 422 | `CREDENTIAL_REQUIRED` | 95, 96 | a `PRODUCTION` candidate, or an adoption after an authenticated test, without `credential`; 0 outbound requests |
| `INVALID_INPUT` | 422 | `CREDENTIAL_NOT_EXPECTED` | 96 | `credential` sent although the passing test was unauthenticated; nothing stored |
| `INVALID_INPUT` | 422 | `DEVELOPMENT_SOURCE_NOT_ALLOWED` | 78, 79 | a `DEVELOPMENT` device named while the development flag is off |
| `RATE_LIMITED` | 429 | `DISCOVERY_RATE_LIMITED`, `CONNECTION_TEST_RATE_LIMITED`, `CONNECTION_TEST_LOCKOUT_GUARD`, `INPUT_RESCAN_RATE_LIMITED` | 93; 95, 96; 95, 96; 97 | over a bound of §7; `retry-after` set; 0 outbound requests; no audit row |
| `NOT_READY` | 503 | `DISCOVERY_NOT_READY` | 93, 95, 96 | no discovery adapter provided, or capture not ready |
| `NOT_READY` | 503 | `CREDENTIAL_STORE_NOT_READY` (existing value, PE-113-11) | now also 89, 96 | a credential would be stored and no sealer is provided (until row 84); nothing stored |
| `NOT_PERMITTED` | 403 | `WEB_CONSOLE_ONLY` | 89, 95, 96 | a device-bound session on a credential-carrying operation (`WEB_CONSOLE_SESSION`); one `ACCESS_DENIED` row |
| `NOT_FOUND` | 404 | — | 95, 96 | candidate id unknown, expired or of another session — one answer, no hint which |

Message rule: the fixed messages of the existing codes are used unchanged; no message quotes a host,
a candidate id the caller did not own, or any part of a credential.

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
`CAPTURE_CREDENTIAL_REVEALED` from SEC35-02; SEC35-22). **Erratum PE-113-12 (D24):** with
`STT_CONFIG_CHANGED` (§2.5, category `DEVICE`, row 113) there are **10** new types and the total is
**63** (`packages/shared/test/api-registry.test.ts:470`; `packages/shared/src/sim/vocabulary.ts:425,496`).
**Erratum PE-121-09:** 63 is the as-built figure; the row-121 delta adds four types (§5.2, the last
four entries) — the R-9..R-11 delta of row 121 moves this figure — the new target is stated once, in §10.1.

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
> **Erratum PE-121-09 (R-9 AC-9; D76(3)):** the `credential` member of ops 95 and 96 — username,
> secret and anything derived from them — is forbidden in every detail key and value, exactly like
> the body of op 89. A connection test records its **outcome name** and the fact that a credential
> was supplied (`authenticated: boolean`), never what was supplied. No row of the delta carries a
> credential-bearing URL. Network identifiers of a probed device (address, endpoint reference, MAC,
> serial) are **not** in any detail of the delta either: rows carry ids and counts (D75).

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

**The four audit types of the row-121 delta (erratum PE-121-09).** Target for rows 132, 133, 139,
142. None is written on a refusal (lock, rate limit, validation, not found): those write no row,
and an access refusal writes `ACCESS_DENIED` as everywhere.

**`CAPTURE_DISCOVERY_SEARCHED`** — category `DEVICE` — written **once per search**, when its window
closes or fails: by op 93, by the pre-check search, and by op 97 (`scope: MIC_LOCAL`). **An empty
search writes this one row and no other** (D80(8)); the alert of §5.4 is not a second audit row.

| Key | Type | Example |
|---|---|---|
| `searchId` | string, `^DSC-[0-9]{6,}$` | `DSC-000012` |
| `scope` | string, one of `CAMERA_NETWORK`/`MIC_LOCAL` | `CAMERA_NETWORK` |
| `trigger` | string, one of `MANUAL`/`PRECHECK` | `MANUAL` |
| `outcome` | string, one of `COMPLETE`/`FAILED` | `COMPLETE` |
| `responderCount` | number | `0` |
| `newCount` | number | `0` |
| `registeredCount` | number | `0` |
| `interfaceCount` | number — interfaces probed; a count, never a name or an address (**erratum PE-128-28**, SEC35-30) | `1` |
| `failureReason`? | string, a SCREAMING_SNAKE code | `SOCKET_ERROR` |
| `sessionId`? | string, the recording session when one is open | `SES-20261009-0003` |
| `operationId`? | string, `^[a-z][A-Za-z0-9]{0,63}$` | `startCaptureDiscovery` |
| `permission`? | string, a SCREAMING_SNAKE code | `CAPTURE_CONFIG` |

**`CAPTURE_CONNECTION_TESTED`** — category `SECURITY` — written once per attempt, **for every
outcome**, by op 95 and by the re-verification of op 96. An `AUTHENTICATION_FAILED` outcome is
audited as a fact (camera-credential refusals are audited, C-N9). **Never the username, the secret or a URL.** **Erratum PE-128-28 (D86 C-3; SEC35-46):** three optional keys — `host`? and `endpointRef`? (present for `PRODUCTION` candidates only, D86 C-3) and `guardTripped`? (boolean; `true` on the failure that trips the lock-out guard). The key is named `endpointRef`, never `onvifUuid` (a denied key, `0006_stt_config.sql:33`).

| Key | Type | Example |
|---|---|---|
| `candidateId` | string, `^CND-[0-9A-F]{12}$` | `CND-4F2A91C0D377` |
| `searchId` | string | `DSC-000012` |
| `outcome` | string, one of `REACHABLE`/`AUTHENTICATION_FAILED`/`WRONG_PROFILE`/`NOT_H264`/`UNREACHABLE` | `AUTHENTICATION_FAILED` |
| `authenticated` | boolean — a credential was supplied (a fact, not a value) | `true` |
| `adapter` | string, a SCREAMING_SNAKE code | `FAKE` |
| `sourceClass` | string, one of `PRODUCTION`/`DEVELOPMENT` | `DEVELOPMENT` |
| `operationId` | string, `testCaptureCandidateConnection` or `adoptCaptureCandidate` | `testCaptureCandidateConnection` |
| `host`? | string, an IP literal; `PRODUCTION` candidates only (D86 C-3) | `192.0.2.10` |
| `endpointRef`? | string 1..120; `PRODUCTION` candidates only (D86 C-3) | `urn:uuid:00000000-0000-0000-0000-000000000000` |
| `guardTripped`? | boolean — `true` on the failure that trips the lock-out guard | `false` |
| `permission`? | string, a SCREAMING_SNAKE code | `CAPTURE_CONFIG` |

**`CAPTURE_CANDIDATE_ADOPTED`** — category `DEVICE` — written by op 96 inside the adoption
transaction. When a credential is stored, the same transaction also writes one
`CAPTURE_CREDENTIAL_SET` row (`deviceId`, `operationId: adoptCaptureCandidate`) — "credential set,
by name only".

| Key | Type | Example |
|---|---|---|
| `deviceId` | string, a Core hardware device id (the new row) | `CAM-03` |
| `candidateId` | string | `CND-4F2A91C0D377` |
| `searchId` | string | `DSC-000012` |
| `adapter` | string, a SCREAMING_SNAKE code | `FAKE` |
| `sourceClass` | string, one of `PRODUCTION`/`DEVELOPMENT` | `DEVELOPMENT` |
| `credentialSet` | boolean | `false` |
| `operationId` | string | `adoptCaptureCandidate` |
| `host`? | string, an IP literal; `PRODUCTION` candidates only (D86 C-3; **erratum PE-128-28**) | `192.0.2.10` |
| `endpointRef`? | string 1..120; `PRODUCTION` candidates only (D86 C-3; **erratum PE-128-28**) | `urn:uuid:00000000-0000-0000-0000-000000000000` |
| `permission`? | string, a SCREAMING_SNAKE code | `CAPTURE_CONFIG` |

**`CAPTURE_DEVICE_UNREACHABLE`** — category `DEVICE` — written by the Core capture side **once per
occurrence, when the alert is raised** (§5.4 situation B, and the degraded warning of situation C).
Resolving the alert writes no row; a later occurrence is a new alert with a new row (D72(h)).

| Key | Type | Example |
|---|---|---|
| `deviceId` | string, a Core hardware device id | `CAM-02` |
| `deviceKind` | string, one of `CAMERA`/`MIC` | `CAMERA` |
| `phase` | string, one of `PRECHECK`/`SESSION_START` | `PRECHECK` |
| `reason` | string, one of `UNREACHABLE`/`AUTHENTICATION_FAILED`/`NOT_CONNECTED`/`PERMISSION_DENIED`/`DEVICE_BUSY`/`DEVICE_NOT_FOUND`/`OPEN_FAILED`/`HELPER_EXITED` (**erratum PE-128-35**: the five helper error names of `cap` §A.6.4 HL-10, also the alert `cause` value set) | `UNREACHABLE` |
| `degraded` | boolean — the session may start, or started, without this device | `true` |
| `sessionId` | string | `SES-20261009-0003` |

### 5.3 Changed audit rows (existing types)

| Type | Change | Authority |
|---|---|---|
| `DEVICE_COMMAND` | gains the value `POE_CYCLE` for op 48; `details.command: POE_CYCLE`, plus `poePort`; no secret | E-12; OD-22 |
| `EVIDENCE_EXPORTED` | now the **request** row of op 42 (the job is queued), with `details.kind: PACKAGE\|COMPOSITE`; the file may not exist yet | OD-16; NM-12 |
| `ACCESS_DENIED` | unchanged keys (`operationId`, `permission`, `role`, `reason?`); the new permissions and the `SESSION_HOLDER` condition feed `reason` | `audit-details.ts:91-96`; OD-09/OD-10/OD-15 |
| `EVIDENCE_SEALED` | unchanged; the v2 seal writes it once per session with both files and the transcript | OD-02/OD-03 |
| `RECOVERY_STARTED`/`RECOVERY_COMPLETED` | unchanged; a resumed seal sets `SealingProgress.resumed` (op 83) | OD-08; `specs E.5` |
| `CAPTURE_CREDENTIAL_SET` — **erratum PE-121-09** | unchanged keys; `operationId` may now read `adoptCaptureCandidate` (the credential leg of op 96) | D80(7); §2.6 |
| `ACCESS_DENIED` — **erratum PE-121-09** | unchanged keys; `reason` may now name the condition `WEB_CONSOLE_SESSION` (ops 89, 95, 96) | D80(3) |
| `FAULT_RAISED` / `FAULT_CLEARED` — **erratum PE-121-09** | for the kind `CAPTURE_FAULT` raised at session start with no camera, the row carries the optional `reason: NO_CAMERA_CONNECTED` and `evidenceFiles: 0` — the one row "stating that nothing was recorded" (R-10 AC-3). **Confidence MEDIUM:** this analyst found the row's composition in the simulator (`packages/shared/src/sim/faults.ts:343,358`) but no entry for it in `SERVER_AUDIT_DETAIL_RULES`; rows 133 / 139 check where the key list lives before adding the two keys | D72(k), D72(h); R-10 AC-3 |
| `SYSTEM_BOOT` (existing type) — **erratum PE-128-37** | gains the key `captureOperation`: `SIMULATED` \| `REAL_PRODUCTION` \| `REAL_DEVELOPMENT`; one row per boot. No new audit type: the total stays 67 | D86 (SEC35-41 (b)) |
| `PRECHECK_BLOCKED` — **erratum PE-121-09** | unchanged type; written as today when both cameras or both microphones are unreachable (§3.1) | D80(6) |

`AUDIT_TYPE_CATEGORY` gains exactly nine entries (`CAPTURE_CONFIG_CHANGED`→`DEVICE`,
`AUDIO_SOURCE_SWITCHED`→`SESSION`, `CAMERA_POE_CYCLED`→`DEVICE`, `TRANSCRIPT_REVISED`→`EVIDENCE`,
`MIC_SILENT`→`DEVICE`, `EVIDENCE_MEDIA_SERVED`→`EVIDENCE`, `EVIDENCE_EXPORT_FAILED`→`EVIDENCE`,
`CAPTURE_CREDENTIAL_SET`→`SECURITY`, `CAPTURE_CREDENTIAL_REVEALED`→`SECURITY`). SEC35-01/SEC35-22.
**Erratum PE-121-09:** the row-121 delta adds four entries: `CAPTURE_DISCOVERY_SEARCHED`→`DEVICE`,
`CAPTURE_CONNECTION_TESTED`→`SECURITY`, `CAPTURE_CANDIDATE_ADOPTED`→`DEVICE`,
`CAPTURE_DEVICE_UNREACHABLE`→`DEVICE`. No new category.

### 5.4 Alerts of R-10 — no new fault kind, no CHECK change (erratum PE-121-10)

**Decision.** The three no-device notifications use the alert kinds that exist: **`SYSTEM`** for the
three WARNING cases and **`CAPTURE_FAULT`** for the one CRITICAL case. `FaultKind` keeps its **14**
values (`packages/shared/src/sim/vocabulary.ts:218-235`), and the three database CHECKs that list
them — `alerts_kind_check`, `session_history_outcome_check`, `health_snapshots_cause_check`
(`0004_capture.sql:227,217,228`) — are **not** changed. Each case is told apart by `params.reason`
(`alerts.params` is a flat map, `alerts_params_check`).

Why this is right and not only cheap. (1) `alerts.kind` already admits `SYSTEM` beside the fault
kinds (`SimAlert.kind: FaultKind | 'SYSTEM'`, `types.ts:1016`), and "a search found nothing" or "a
device did not answer the pre-check" is a statement about an absence at an operator action — it has
no fault life cycle, never belongs in `session_history.fault_kind` or a health snapshot, and must
not be injectable or clearable by the demo fault operations (D72(h)). (2) The existing kinds do not
fit the WARNING cases: `FAULT_SEVERITY` fixes `CAMERA_LOSS` and `CAPTURE_FAULT` as CRITICAL
(`faults.ts:51,67`), while D80(6) wants one unreachable camera to warn and allow a degraded session.
(3) The CRITICAL case **is** a capture fault of the session as a whole, which `CAPTURE_FAULT` with
no subject already means (`capture-telemetry.ts:149`). The alternative — three new kinds — would
need migration `0008` on three CHECKs and a `FaultKind` / `FaultEvt` / severity-map change for no
gain in what a client can show.

| Situation | Alert `kind` | Severity | `target` | `params` (flat; ids, counts and codes only) | Audit row | Resolved by |
|---|---|---|---|---|---|---|
| **A** — a search returned no responder | `SYSTEM` | WARNING | `CAPTURE_DISCOVERY` | `reason: CAPTURE_DISCOVERY_EMPTY`, `searchId`, `trigger` | none of its own — the search's `CAPTURE_DISCOVERY_SEARCHED` row with `responderCount: 0` (D80(8)) | the next search of any session with `responderCount ≥ 1` |
| **B** — a configured camera or microphone is unreachable at pre-check | `SYSTEM` | WARNING | the device id | `reason: CAPTURE_DEVICE_UNREACHABLE`, `deviceId`, `deviceKind`, `phase: PRECHECK`, `cause` (the audit `reason` code), `searchResponderCount`? | one `CAPTURE_DEVICE_UNREACHABLE` per device per occurrence | a later pre-check run in which that device is reachable |
| **C** — no camera connected at session start | `CAPTURE_FAULT` (subject none) | CRITICAL | none | `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0` | the existing `FAULT_RAISED` row of that fault (§5.3) | the capture side, when a camera connects in a later session (`FAULT_CLEARED`); never demo op 74 |
| **C, degraded** — one camera of two connected | `SYSTEM` | WARNING | the missing device id | `reason: CAPTURE_DEVICE_UNREACHABLE`, `deviceId`, `deviceKind: CAMERA`, `phase: SESSION_START`, `cause: NOT_CONNECTED` | one `CAPTURE_DEVICE_UNREACHABLE` | the capture side, when that camera connects in a later session |

Rules. **Raised once, by the Core** (R-10 AC-6): at most one active alert per (`reason`, `target`);
raising it again while it is active changes nothing and writes nothing (the `raiseCaptureWarning`
rule, `capture-telemetry.ts:176-177`) — so pressing "Search again" five times with no responder
leaves one alert and five search rows. A search that finds only already-registered cameras is not
empty and raises nothing (R-10 AC-1). **Cleared by the capture side only** (D72(h)); a later
occurrence is a new alert with its own audit row. Alert text and `params` carry device ids, labels,
counts and codes — no credential, no username, no credential-bearing URL, no address. A client
never raises its own copy; all three clients draw the alert from the `alerts` slice.

What the implementing rows must add (not a schema change): the existing INTERNAL warning action
takes the codes `MIC_SILENT` and `CAPTURE_FAULT` only (`capture-telemetry.ts:156-173`), so the
`SYSTEM`-kind alerts need an INTERNAL raise / resolve path of their own, and the `CAPTURE_FAULT`
raise needs an optional reason. An added INTERNAL action moves the pinned sim-action count
(`sim-actions.ts:13`, "internal 4") — a pin for rows 133 / 139, outside the totals of §10.1.

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

**Erratum PE-121-11 (R-9, R-11).** The slice count **stays 30**: the row-121 delta adds no slice.
(1) Discovery candidates are session-scoped and are deliberately **not** replicated (§2.6 "Why no
slice"); a client reads them with op 94. (2) Two payloads gain members: each item of
`captureDevices.devices` gains `adapter` and `sourceClass`, and each item of `captureConfig.cameras`
and `captureConfig.mics` gains `sourceClass` (§2.6 "Device shapes"). `kind` keeps the set
`CAMERA|MIC|POE`. (3) Op 96 publishes `captureDevices` (one more device); op 97 and the pre-check
publish `online`. (4) The R-10 alerts travel in the existing `alerts` slice (§5.4).

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

**Constants of the row-121 delta (erratum PE-121-12).** Same module, same pin test. Every value is
**proposed by this row**: row 123 confirms the search window, row 126 the limits. The lock-out guard is a conservative default and is not derived from any camera's documentation (D86 C-2). Before the first test against a real camera the user is asked for that model's lock-out rule and the constant is re-pinned (class C-1 entry item). Counted per Core by host; not reset by a new search, another session or another operator; reset by a `REACHABLE` outcome on that host; the re-verification of operation 96 counts; `UNREACHABLE` does not count; held in memory (a Core restart clears it — accepted). **Erratum PE-128-19 (D86 C-2; SEC35-38).**

| Constant | Value (proposed) | Unit | Type | Authority / note |
|---|---|---|---|---|
| `CAPTURE_DISCOVERY_WINDOW_MS` | `3_000` | ms | number | how long the one UDP socket of a search stays open (C-N13); accepted D82(c); `cap` §A.6.1 DS-7 (floor 850 ms + margin). **Erratum PE-128-17** |
| `CAPTURE_DISCOVERY_RESULT_TTL_MS` | `600_000` | ms | number | life of a candidate list after its window closes (R-9 AC-4) |
| `CAPTURE_DISCOVERY_MAX_CANDIDATES` | `64` | candidates | number | bound of the per-session state; beyond it `truncated: true` |
| `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` | `10_000` | ms | number | between two search starts of one operator session (R-9 AC-11) |
| `CAPTURE_DISCOVERY_MAX_PER_MINUTE` | `6` | searches | number | per Core, all sessions together; the pre-check search has its own allowance (outside the per-minute and per-hour bounds). **Erratum PE-128-20 (D86 C-8; SEC35-39)** |
| `CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS` | `5_000` | ms | number | between two search starts on one Core, whatever the session (D86 C-8; SEC35-39 (4)). **Erratum PE-128-20** |
| `CAPTURE_DISCOVERY_MAX_PER_HOUR` | `30` | searches | number | per operator session (D86 C-8; SEC35-39 (2)). **Erratum PE-128-20** |
| `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` | `false` | — | boolean | the lift of D86 C-4: `true` only when the gate artifact records `M4-SEC-DISC-1` and `M4-SEC-DISC-3` PASS (check `M4-DISC-REC-1`); until then op 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`) while the session state is `RECORDING`. **Erratum PE-128-21** |
| `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` | `15_000` | ms | number | the whole test, enforced by destroying the per-test agent; TCP connect 3 s and each request 5 s are sub-bounds (`cap` CT-4; SEC35-33 (1)); then `UNREACHABLE`. **Erratum PE-128-18 (D86 C-8; SEC35-39 (4))** |
| `CAPTURE_CONNECTION_TEST_VALIDITY_MS` | `300_000` | ms | number | how long a `REACHABLE` outcome keeps a candidate adoptable |
| `CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` | `5_000` | ms | number | between two attempts on one host **and** between two tests of one operator session on any host (D86 C-8; SEC35-39 (1)). **Erratum PE-128-20** |
| `CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE` | `6` | attempts | number | per Core; one test at a time per Core. **Erratum PE-128-20** |
| `CAPTURE_CONNECTION_TEST_MAX_FAILURES` | `2` | outcomes | number | `AUTHENTICATION_FAILED` per host inside the window below — a conservative default (D86 C-2; see above). **Erratum PE-128-19** |
| `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` | `1_800_000` | ms | number | window of the lock-out guard (30 minutes); counted per Core by host, in memory (a Core restart clears it — accepted, D86 C-2). **Erratum PE-128-19** |
| `CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS` | `5_000` | ms | number | between two local-input re-reads per Core |
| `CAPTURE_CANDIDATE_ID_PATTERN` | `/^CND-[0-9A-F]{12}$/` | — | RegExp | candidate ids (48 random bits) |
| `CAPTURE_SEARCH_ID_PATTERN` | `/^DSC-[0-9]{6,}$/` | — | RegExp | search ids |

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

**Which of the 17 are visible in `offline`** (14 of §2.2 + 3 of §2.5 — **erratum PE-113-13**).
**Erratum PE-121-13:** the five operations of §2.6 (93-97) are all `mode: simulated` and join the
visible column when rows 132 / 142 build them; the table below is the as-built set of 17 — the R-9..R-11 delta of row 121 moves this figure — the new target is stated once, in §10.1.

| Visible in `offline` (mode `simulated`; 16 ops) | `all`-only (mode `live`; 1 op) |
|---|---|
| 76 `getCaptureConfig`, 77 `getCaptureDevices`, 78 `updateCaptureConfig`, 79 `setCaptureCameraSource`, 80 `setPrimaryMic`, 81 `switchAudioSource`, 82 `listAudioSourceIntervals`, 83 `getSealingProgress`, 84 `getTranscript`, 85 `createTranscriptRevision`, 86 `listTranscriptRevisions`, 87 `getEvidenceExportJob`, **89 `setCaptureDeviceCredential`**, **90 `getSttConfig`, 91 `updateSttConfig`, 92 `testSttConnection`** (R-8; D24) | 88 `createEvidenceMediaSession` |

88 is `live` only: Simulated mode plays the bundled demo media and opens no signed media session
(`register NM-11`; predecessor `specs §11` MS-1 still true for Simulated mode). 87 is `simulated`
because OD-17 says the simulator emulates the new sealing/export steps; its `mode` is re-checked at
row 39. 89 is `simulated` (the simulator accepts the write opaquely and never stores or echoes a
credential), so OD-17's "simulator emulates v2" stays true; its `mode` is re-checked at row 39.

**Operations 93-97 in Simulated mode (erratum PE-121-13).** All five are `simulated`: OD-17 says
the simulator emulates v2, and the web console must be able to show the search and connect flow
without a Core. The simulator's fixed answers are in §2.6 "Simulator" — no socket, no timer, two
fixed candidates, a credential body accepted opaquely and never stored (the rule of op 89 above).
Parity tests therefore compare exact values, and the states the simulator never reaches (`409
DISCOVERY_IN_PROGRESS`, every `429`, every `503`, the four failing test outcomes) are Core-server
tests on the fake stub and fixtures. **Web Try-it:** `testCaptureCandidateConnection` (95) and
`adoptCaptureCandidate` (96) join `TRY_IT_DENIED_OPERATIONS` because their bodies carry a
camera credential; the list decides by method + path (D70). **Version:** whether five added
operations want an `info.version` step is the same open controller item as at M6 (pair-113 N-12);
this row assumes none.

**Projected pinned counts (M2 owns the edit).** The `offline` document grows from **10** operations
(health + 9 design-book, `openapi.ts:11`) to **23** (10 + the 13 simulated of §2.2) at M2 and to
**26** with ops 90-92 at M6 row 113. The `all` document grows from **75** to **89** (`34 GET / 55 POST`,
§2.2) at M2 and to **92** (**`35 GET / 57 POST`**) at M6. **Erratum PE-113-13 (D24):** 26 and 92 are
counted facts, pinned by `packages/shared/test/api-registry.test.ts:690-692`,
`packages/shared/test/openapi.test.ts:167,216` and `packages/shared/test/api-openapi-scope.test.ts:247,291-299`;
the `info.version` values did not change at M6 (0.3.0 / 0.2.0; see the §2.5 status note). The edits
are in `apps/core-server/test/acceptance/contract.test.ts:374-380` (the `75`/`27`/`48` literals) and
`packages/shared/openapi/openapi.json` (regenerated by `npm run openapi:gen -w @dems/shared`). The
`rbac-matrix.test.ts` loops over the registry (`rbac-matrix.test.ts:5-8`, "the registry's 75
entries"), so it follows the new count with no literal edit. **These are M2 implementation steps
(register SH-19, WB-09, CS-25; `structured §6 M2` "OpenAPI drift test at 0.3.0"); this row is the
contract.** The op-count change (89, then 92) and the offline count (23, then 26) are additions for
row 36/37 to fold into M2-API-1/M2-API-2 and the section-C pin family; the M6 step was folded by row
113 (`implementation/52_m6_stt_config_api.md` §3).

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
| N-9 | **No caller-supplied network target (erratum PE-121-14).** No operation of §2.6 takes an address, host, port, URL or subnet; typed-address entry is not in scope and a camera that does not answer the multicast probe cannot be found — a recorded gap, such a camera stays class C. | D80(10); R-9 AC-10 |
| N-10 | **No second credential store and no credential kept in memory between requests (erratum PE-121-14).** The one store is the Core credential store behind the op-89 write; before row 84 nothing is stored in any form. | D80(7); D68(c); C-N15 |
| N-11 | **A search authenticates, registers and configures nothing (erratum PE-121-14)**, and reads nothing beyond the probe answer; no operation of §2.6 changes a setting on a camera. | D76(1); D80(1); D75 |
| N-12 | **No network microphone discovery, no microphone adoption, no removal of an adopted device (erratum PE-121-14).** Op 97 re-reads local inputs only. Unregistering a camera is not designed in this phase (the capture tables are kept tables) — a gap for the controller. | D80(5); OD-06 |
| N-13 | **No new fault kind and no new error code (erratum PE-121-14)**: §5.4 and §4 use the existing sets. | §5.4; §4 |

---

## 10. Self-gate (this document's own acceptance)

| Gate check (from `structured row 29` Verification) | Result |
|---|---|
| **Every new or modified operation has method, path, access, audit type** | **17/17 new** (`§2.2` 14 + `§2.5` 3 — erratum PE-113-14); **24/24 modified** (`§3`, 22 rows). Each new row carries method, path, tag, mode, access marker, audit success/denial and error codes. |
| **Total operation count stated** | **75 + 14 + 3 = 92** operations (35 GET / 57 POST), `§1` — **erratum PE-113-14 (D24):** 89 (34 GET / 55 POST) was the M2 figure. `offline` grows 10 → 23 → **26**; `all` 0.2.1 → 0.3.0, `offline` 0.1.0 → 0.2.0 (`§8`; no version step at M6). |
| **0 uses of `AdminResource.DEVICE[S]` for capture** (E-04) | `grep -n "AdminResource\.DEVICES" masterplan/03_api_contract.md` → **0 matches**. The prohibition uses the bracketed `AdminResource.DEVICE[S]` form (the repo's own forbidden-literal idiom, `capture-spec §C.4`); `grep -c "AdminResource.DEVICE[S]"` → the prohibition rows only (`§6`, `§9 N-2`). The capture kinds are `captureConfig`/`captureDevices` (`§6`). |
| **Every new audit type has an exact detail-key list with 0 secret keys** | **10/10** (`§5.2` 9 + `STT_CONFIG_CHANGED` in `§2.5`, five keys, field names only — erratum PE-113-14): `CAPTURE_CONFIG_CHANGED`, `AUDIO_SOURCE_SWITCHED`, `CAMERA_POE_CYCLED`, `TRANSCRIPT_REVISED`, `MIC_SILENT`, `EVIDENCE_MEDIA_SERVED`, `EVIDENCE_EXPORT_FAILED`, `CAPTURE_CREDENTIAL_SET`, `CAPTURE_CREDENTIAL_REVEALED`. No key holds a credential, token, key, password, pairing code, typed username or signed URL (`§5.1`). `TRANSCRIPT_REVISED` carries the revision id + author + hash, **never the body**; `CAPTURE_CREDENTIAL_*` carry `deviceId` only. |
| **All six gate answers cited by decision ID** | **6/6** — OD-01, OD-09, OD-10, OD-15, OD-17, OD-22, each `D4` (`§0`). D7/D8/D10/D12 folded as binding corrections (`§0`). |
| **Every design choice cited** (`file:line`, decision ID, or register row) | Yes — every table row and every shape note carries a citation (`§2-§8`). |
| **Register rows required by this row are satisfied** | SH-03/SH-04/SH-12/SH-13/SH-14/SH-16/SH-19/SH-25, CS-04/CS-06/CS-07/CS-12/CS-14/CS-22/CS-25, NM-06/NM-07/NM-09/NM-10/NM-11/NM-12, WB-04/WB-09/WB-11, MB-07/MB-09, E-04/E-12/E-30/E-31, RK-12/T-33, W1-C1/W1-C7/W1-C9/W1-C10. |
| **W1-C7 not repeated** | No `--maxWorkers`/`--poolOptions` claim appears in this document. |
| **Row 121: every new or extended operation states method, permission, request and response shape and error codes** (erratum PE-121-15) | **5/5 new** (93-97, §2.6: identity, shape, rules, simulator) and **7 extended** (76, 77, 78, 79, 89, `beginPrecheck`, `retryPrecheck`; §3.1). |
| **Row 121: 0 response shapes carry a credential** | **0 of 7** (§2.6 "No secret in any shape"). The only credential members are the request member `credential` of 95 / 96 and the body of 89; all three are web console only and on the Try-it deny list. |
| **Row 121: new audit types have exact key lists with 0 secret keys** | **4/4** (§5.2): 12 + 11 + 10 + 6 keys; none holds a username, secret, URL, MAC or serial; `host` and `endpointRef` only in the two types above and only for `PRODUCTION` candidates (**erratum PE-128-28**, D86 C-3). |
| **Row 121: the new totals are stated once** | §10.1 — and nowhere else in this file. |

### 10.1 Pinned totals after the row-121 delta — stated once (erratum PE-121-15)

These are the **targets** for rows 132 and 142 (the registry and the pin tests still hold the
"today" column until those rows land). Arithmetic from the as-built figures of row 113.

| Pinned total | Today (as built, row 113) | Delta of row 121 | **Target** | What moves it |
|---|--:|--:|--:|---|
| Operations (`all` scope) | 92 | + 5 | **97** | ops 93, 94, 95, 96, 97 |
| GET | 35 | + 1 | **36** | op 94 |
| POST | 57 | + 4 | **61** | ops 93, 95, 96, 97 |
| Audit types | 63 | + 4 | **67** | `CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE` |
| Error codes | 40 | + 0 | **40** | new `details.reason` values only (§4) |
| Replicated slices | 30 | + 0 | **30** | no discovery slice; two payloads gain members (§6) |
| `offline` scope operations | 26 | + 5 | **31** | all five are `simulated` (§8) |
| `FaultKind` values / fault-kind CHECKs | 14 / 3 | + 0 / 0 changed | **14 / 3 unchanged** | §5.4 |
| `CoreApiAccessCondition` values | 5 | + 1 | **6** | `WEB_CONSOLE_SESSION` (§0) |
| Web Try-it denied operations | 8 | + 2 | **10** | ops 95, 96 |
| Modified operations of the original 75 (a document count, not a test pin) | 24 | + 2 | **26** | `beginPrecheck`, `retryPrecheck` (§3.1) |

**Erratum PE-128-39 (spec gate, row 128).** Document counts of the delta after the spec gate: `details.reason` values 15 -> 17; constants 14 -> 17; audit keys 12 + 11 + 10 + 6. The pinned totals above are unchanged: 97 / 36 / 61, 67, 40, 30, 31, 6, 10.

Checks: 36 + 61 = 97; 92 + 5 = 97; 31 = 97 − the one `live` operation (88) − the 65 operations of
the original 75 that are outside the `offline` scope (75 − 10).

**Every place in this file that quotes a total, and what was done to it (PE-121-02 unless noted).**
Front matter `last_updated` and the PE-121-01 note under the title (say "as built 92" and point
here); §1 table rows "New operations this phase", "New registry total", "R-8 operations" (kept as
the as-built figures; the new row "R-9..R-11 operations" points here); §2.5 status block (pointer
added); §4 intro "31 … 9 new codes → 40" (unchanged and still true; PE-121-08 says no code is
added); §5 intro "53 → 62 … 63" (pointer added, PE-121-09); §5.3 `AUDIT_TYPE_CATEGORY` "exactly
nine entries" (four more named, PE-121-09); §6 title and intro "28 → 30" (still true; PE-121-11);
§8 "Which of the 17", "16 ops", "10 → 23 → 26", "75 → 89 → 92" (as built; pointer added,
PE-121-13); §10 rows "17/17 new", "75 + 14 + 3 = 92", "10/10" and the open-items paragraph "92 /
26 / 63 / 40" (as built; the four row-121 gate rows above point here); the footer. The titles "## 2.
New operations 76-89" and "§2.5 … 90-92" are ranges of their own sections and stay.

**Open items of the row-121 delta (erratum PE-121-16) — for the controller and rows 122-128.**
(1) **Wire carriage of the credential.** Row 121's blueprint text says the credential "travels only
through operation 89"; D80(7) and the row order put it in the body of the connection test (95, in
memory only), and this contract also puts it in the body of the adoption (96), where it is the
op-89 write run inside the adoption transaction. Reason: op 89's path cannot name an unregistered
device, and a two-step "adopt, then op 89" would leave a registered camera with no credential when
the second step fails or is abandoned (R-9 AC-8). The alternative — let op 89's path accept a
candidate id and perform the adoption — was not chosen: it changes the path pattern, the 404 rule
and the meaning of an operation that is already built in the simulator. **Needs the controller's
confirmation** (and row 126's view). (2) **Re-verification inside op 96** is this row's addition: it
guarantees that the stored credential is one that authenticated, at the cost of one more attempt;
row 126 confirms or drops it. (3) R-9 AC-5 and AC-7 of `specs` §B.2 and the text of blueprint row
142 still say the test takes its credential "from operation 89"; D80(7) overrides them — row 128
reconciles the wording (this row edits neither file). (4) The primary-microphone case of §3.1.
(5) All values of §7. (6) Whether `host` should join the `CAPTURE_CONNECTION_TESTED` detail for
forensics (left out here because of D75). (7) Whether Simulated mode shows the "development source"
label on its `FAKE` devices (row 125). (8) Where the adapter kind is stored (row 122) — the only
point of this contract that may need a column; nothing here needs a CHECK change.

**Closed at the spec gate (row 128):** (1) D81; (2) kept, SEC35-47; (3) reconciled; (4) D83; (5) §7 fixed; (6) D86 C-3; (7) D83 — not shown in Simulated client mode; (8) `dbc-4` §N.2. **Erratum PE-128-39.**

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
**Erratum PE-113-14 (D24):** after row 113 the counted values are operations **92**, offline **26**,
audit types **63**; error codes stay **40**.

---

*Generated: 2026-10-07 16:55*
*Last Updated: 2026-10-09 (row-128 spec-gate fix pass PE-128-17..39 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 121 contract delta PE-121-01..PE-121-16: §2.6 operations 93-97 for R-9..R-11, §3.1, §5.4, §10.1 — target totals stated once in §10.1, D73-D78, D80; earlier the same day: pair-review errata PE-113-01..PE-113-14: §2.5 R-8 ops 90-92 confirmed by D24 and counted, row-113 driver choices recorded, D68; earlier: 2026-10-08 RV-SPEC errata AU2-07/AU2-08 + §2.5 as a proposal; row-35 security remediation SEC35-01/12/13/16/17/19/21/22)*
