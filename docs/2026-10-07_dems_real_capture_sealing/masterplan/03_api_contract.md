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
last_updated: 2026-10-11 (docs follow-up of batch N, `implementation/166_batch_n_docs_followup.md`: PE-BN-08 .. PE-BN-12 (operation 91 refuses a body with `credential` from a tablet or phone session, by its handler; the log-blanking rule blanks the userinfo of a URL; `SESSION_CAPTURE_CHECKPOINTS_EXAMPLE`; the shared module `@dems/shared/evidence-rules` and the bounds of `transcriptModel` and a revision's `reason`; the demo-password refusal is a boot refusal and moves nothing in the API), PE-WM-01 updated in place (V98-08 closed: `params` belongs to the state slice) and PE-WM-03 updated in place (V98-13 built: a probe source that throws fails closed); decisions D241; totals unmoved 97 / 36 / 61 / 67); 2026-10-11 (docs errata of batch N for fix waves L and M: PE-WL-01 .. PE-WL-07 (the UNSEALABLE notice and operation 70, operation 33 as the retry of a blocked seal, operation 83 `resumed` / 404, `files[].profile` and `streamProfileNotice`, the one rule "a session is open", the media route's cut and its 409 example, the blocked-seal sentences and the 600 bound) and PE-WM-01 .. PE-WM-05 (pre-check facts of a generated source that does not answer, one WARNING row under concurrent requests, the probe asked at every use, `CAPTURE_SUPERVISOR_FAULT_OVER`, operation 31 without a body); `implementation/165_batch_n_docs.md`; decisions D228 .. D237, D241; totals unmoved 97 / 36 / 61 / 67); 2026-10-11 (docs touch-up after closing passes K-Z1 and K-Z2: PE-WK-35 updated AS BUILT (op 88 `seekIndex`: the indexed view, its refusal codes, the two route rules, the audit row in file offsets, what was proven), PE-WK-36 (one WARNING row per media stop; PE-WH-04's line cites moved), line cites of PE-WK-01..35 re-checked; `implementation/148_docs_errata_wave_k_touchup.md`; decision D225; no figure of the registry moves: 97 / 36 / 61 / 67); 2026-10-11 (docs errata pass for fix wave K: PE-WK-01..PE-WK-13 - op 85 `422 REVISION_FROM_NOT_CURRENT_TEXT`, `reason` on revisions, `etaMs` null for the transcript step, `pendingForNextSession`, `EvidenceItem.transcriptModel`, `exportDestinationDefault`, `archiveOnCore`, op 41 `plainChecked`, the verify rows, the central sending-device rule, the demo reset refusal row, the life of the restart fault, `params.reason` on timeline rows, the `STREAM_PROFILE_DIFFERS` notice, and PE-WK-35 (op 88 `seekIndex`, contract named, producer not yet live); `implementation/147_docs_errata_wave_k.md`; decisions D220-D224; no figure of the registry moves: 97 / 36 / 61 / 67); 2026-10-10 (docs errata follow-up PE-WI-19..PE-WI-24: PE-FX-02 corrected by D218 (4), the members of closing pass J (`security.platformNotReported`, `coreNotRunning`, the start's 503 reason carried to the clients, the simulator's held integrity rows) and the scope of the simulator's source class; `implementation/137_docs_errata_followup.md`; decisions D217, D218; no figure of the registry moves: 97 / 36 / 61 / 67); 2026-10-10 (docs errata pass for fix waves H and I: PE-WH-02..PE-WH-06, PE-WI-01..PE-WI-09, each marked in place and listed in the errata index; `implementation/136_docs_errata_wave_h_i.md`; decisions D205-D209, D216, D217; no figure of the registry moves: 97 / 36 / 61 / 67); 2026-10-09 (row-128 spec-gate fix pass PE-128-17..39 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 121 contract delta PE-121-01..PE-121-16, `masterplan/11_audit_errata.md` §5.8: R-9..R-11 operations 93-97 in §2.6 as a TARGET for rows 132-142, new totals stated once in §10.1 — the registry as built is still 92; D73-D78, D80; earlier the same day: pair-review errata PE-113-01..PE-113-14, `masterplan/11_audit_errata.md` §5: R-8 ops 90-92 CONFIRMED by D24 and COUNTED — registry 92, 35 GET / 57 POST, audit types 63, offline 26; row-113 driver choices recorded, D68; earlier: 2026-10-08 RV-SPEC errata AU2-07/AU2-08 and §2.5 added as a proposal; 2026-10-07 row-35 remediation, op 89 added)
---

# API Contract C3 — operations 76-97, modified operations, error codes, audit types, slices and constants

## Errata index (fix passes of 2026-10-10)

> Added on 2026-10-10 by blueprint row 96 (register DOC-02). An index only: no text of this spec was
> changed, and each erratum stays where it stands. It lists the errata paragraphs the review-fix
> passes of 2026-10-10 added to THIS file (commit `f293221`). Errata of earlier passes (`PE-12x-…`,
> `PE-R8-…` and others) are marked inline as before and are not repeated here. Decision numbers
> refer to `decisions/decisions.md`.

| Erratum | Where | What it changes, in one line | Decision |
|---|---|---|---|
| PE-FX-01 | §2.4 Per-area notes | The case scope of REAL evidence is enforced as built: operations 84, 85, 86, 88, 42, 87 and the routes `GET /media/{token}` and `GET /exports/{token}` hold one predicate and refuse with `403 NOT_PERMITTED`, `details.reason: EVIDENCE_CASE_SCOPE` | D178 |
| PE-FX-02 | §2.4 Per-area notes | Operation 33 `recoverSession` answers `202` with state `FINALIZING` when it re-queues a failed seal on a Core in real capture | D186 (4) |
| PE-FM4-01 | §2.6, row of operation 95 | The bound of the camera user name is 1..120, not 1..255 (operations 89, 95, 96) | D117, D178 |
| PE-FM4-03 | §7 Constants, `CAPTURE_CONNECTION_TEST_MAX_FAILURES` | The lock-out guard counts rejected credential-bearing requests, not outcomes: a test refused for the sign-in method, or sent without a credential, is not counted | D181 (ruling 3) |
| PE-WH-01 | §2.6, row "Microphones" (operation 97) | `adapter` and `sourceClass` of `CaptureInputScan.inputs[]` are optional and absent in simulated capture (a SIMULATED Core and the in-app simulator); a Core in real capture states both | D196, D206 (2) |
| PE-WH-02 | §2.4 Per-area notes | Operation 88 and `GET /media/{token}` open every item with a sealed v2 package in the Core's store: a REAL item or a demonstration item the seed sealed there; the case scope stays for REAL items only | D205, D208 |
| PE-WH-03 | §3, row of operation 40 (paragraph below the table) | Operation 40 as built: `media.fileIds`, `media.reason`, `access { play, readTranscript, export }`, `exports[]`; a seed-sealed v2 item answers `LIVE_STREAM`, `DEMO_PACKAGE` is for v1 demonstration items; the item's optional sealed facts; operation 87 `archive`; the item's `interrupted` is the manifest's fact; five more examples | D205, D207, D208 |
| PE-WH-04 | §5.2 `EVIDENCE_MEDIA_SERVED` | One row per media-session issue (operation 88) and one WARNING row when serving stops on the package; an answered range is a log line, not a row | D205 |
| PE-WH-05 | §6 Realtime slices | Two optional members of existing slices: `session.captureCheckpoints` and `time.hostClock`; the pre-check TIME item of a Core in its own capture is a note | D203 (1), D209 |
| PE-WH-06 | §2.4 Per-area notes | The installation identity (manifest fields 20 / 21) is Core configuration, two environment keys; no API member carries or sets it | D209 |
| PE-WI-01 | §4, row `DEVELOPMENT_SOURCE_NOT_ALLOWED` | Four values of `details.reason` on the selector's `422 INVALID_INPUT` (operations 78 / 79) | D115 (3) moved, D215, D217 |
| PE-WI-02 | §4, row `NOT_READY` (503) | Two more values of `details.reason` on `startSession`: `SESSION_KEY_NOT_OF_SESSION`, `SESSION_KEY_STORE_UNAVAILABLE` | D216 (4), D217 |
| PE-WI-03 | §5.2 `CAPTURE_CONNECTION_TESTED` | One more optional detail key `reason` (`SCHEME_NOT_ALLOWED`), only on the row of a scheme refusal; such a refusal is not counted by the lock-out guard | D181 (3), D217 |
| PE-WI-04 | §5.3 Changed audit rows | Six session rows carry the paired device of the sender in the row's `deviceId` | D216 (2), D217 |
| PE-WI-05 | §6 Realtime slices | One optional member: `session.precheck.sendingDeviceId` | D216 (2), D217 |
| PE-WI-06 | §2.4 Sealing progress (83) | `resumed` on a Core in real capture: true only for a run of the seal started by a start of the Core or by `recoverSession` | D217 |
| PE-WI-07 | §2.4 Sealing progress (83) | How a retried or blocked seal is read: existing members and the shared reader `sealAttentionOf`; no contract member added | D216, D217 |
| PE-WI-08 | §2.6 (before §3) and §7 `CAPTURE_SEARCH_ID_PATTERN` | A camera search id goes on across restarts of the Core within one database | D217 |
| PE-WI-09 | §5.3 Changed audit rows | A start of a real-capture Core after a stop: no power-fail fault row for a session that was FINALIZING and no tablet-link row; the limit for the other four states | D216 (3), D217 (5) |
| PE-WI-19 | §2.4 Per-area notes (after PE-FX-02); §5.3 row `RECOVERY_STARTED` | CORRECTS PE-FX-02: the retry of a failed seal that operation 33 starts DOES write one `RECOVERY_STARTED` row, `details.reason: SEAL_RETRY`; it still starts no recovery of the boot kind and the answer is still `202` with state `FINALIZING` | D218 (4), D186 (8) |
| PE-WI-20 | §6 Realtime slices | One optional member of the slice `security`: `platformNotReported?: true`; the three required members keep their placeholder values and are not readings where it is present | D217 (7), D218 |
| PE-WI-21 | §6 Realtime slices; §5.3 rows `FAULT_RAISED` / `FAULT_CLEARED` / `SYSTEM_BOOT` | One optional member `coreNotRunning?: true` on `session.fault` and on an entry of `faults.active[]`, and the same key in open maps (alert and event `params`, audit `details`, timeline `params`); kind stays `POWER_FAIL` | D217 (5), D218 |
| PE-WI-22 | §4, row `NOT_READY` (503) | The `details.reason` of a refused `startSession` reaches the clients: a start refused for the session key is no longer shown as a Core that is starting | D217, D218 |
| PE-WI-23 | §5.3 Changed audit rows (new row) | The in-app simulator and a Core's hosted simulator write no integrity row (`FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`) while a start is not durable; they are written, at their scheduled times, once it is, and never for a start that failed | D217, D218 |
| PE-WI-24 | §2.6 (the paragraph after the simulator table) | `adapter: FAKE`, `sourceClass: DEVELOPMENT` hold for the in-app simulator's two search candidates and its adopted device `CAM-03` only; the built-in devices carry neither member, operation 97 neither, and a SIMULATED Core states none on any operation | D196, D206 (1) (2) |
| PE-WK-01 | §2.4 Transcript (84-86); §4 reason table | Operation 85 refuses a change whose `from` is not the segment's CURRENT text: `422 INVALID_INPUT`, `details.reason: REVISION_FROM_NOT_CURRENT_TEXT`, `segmentIndex`, `currentRevision`; nothing signed, no row; a stale `baseRevision` stays `409 TRANSCRIPT_REVISION_CONFLICT` | D221 (2), D224 |
| PE-WK-02 | §2.3 rows 85 / 86; §2.4 Transcript (84-86) | `reason?` on the answer of operation 85 and on every entry of operation 86 (the author's note, as stored and signed); absent = not stated | D224; G81b-09 |
| PE-WK-03 | §2.4 Sealing progress (83) | `etaMs` is the remaining time of the running step as the Core measured it; `null` whenever it has no measured basis, always for the transcript step; a client draws no time-left line for `null` | D220, D224; G75c-05 |
| PE-WK-04 | §2.5 STT configuration operations 90-92 | `pendingForNextSession` is true only while a session that is not SEALED holds an older snapshot; a change saved after the seal applies `NOW` | D221 (3), D224; G81b-05 |
| PE-WK-05 | §3, op 40 (paragraph after PE-WH-03) | `EvidenceItem.transcriptModel?` (shape of op 41's `transcriptModel`; server backend = name + three nulls); absent = not stated | D221 (3), D224; G81b-06 |
| PE-WK-06 | §3, ops 40 / 42 (paragraph after PE-WK-05) | `EvidenceDetail.exportDestinationDefault?` (op 40) and `EvidenceExportAccepted.archiveOnCore?` (op 42), the Core's own statements; the empty destination means the Core's default, true to its mode | D223, D224; G94b-06, -11, -12 |
| PE-WK-07 | §3, op 41 (paragraph after PE-WK-06) | `files[].plainChecked?`: present and `false` when the plaintext check did not run for the file (never written as `true`); `plainOk: false` is then "not checked" | D222 (6), D224; G89b-06 |
| PE-WK-08 | §5.3 Changed audit rows (new row) | `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` carry `details.operationId`; the failed row of a sealed package names `failedFragments` and `failedFragmentCount` | D216 (2), D222 (3), D224; G89b-04 |
| PE-WK-09 | §5.3 Changed audit rows (new row) | The central rule: every audit row a hosted action writes for the acting operator carries the sending paired device in the row's `deviceId`; the row types and the stated exceptions | D216 (2), D222 (3), D224; G89b-04, G94b-03, G75c-09 |
| PE-WK-10 | §5.3 Changed audit rows (new row) | The `ACCESS_DENIED` row of a refused demo reset / scenario load (`RESET_BLOCKED_REAL_EVIDENCE`) carries the sending device; the lineage row of a reset still carries none | D216 (2), D224 |
| PE-WK-11 | §6 Realtime slices (after PE-WI-21); §5.3 row `FAULT_CLEARED` | The life of the restart fault: active only while its session is open as that faulted session; ONE `FAULT_CLEARED` when the session is sealed or closed; a start heals a stored one | D220, D224; G75c-01 |
| PE-WK-12 | §6 Realtime slices (after PE-WK-11) | The timeline row of a capture fault that does not end the session carries `params.reason`; one row per interruption | D220, D224; G75c-06 |
| PE-WK-13 | §5.4 Alerts (new paragraph) | The notice `STREAM_PROFILE_DIFFERS`: a WARNING alert, written not active, once per session, when the recorded stream is not the configured profile | D222 (2), D224; G89b-01 |
| PE-WK-35 | §2.4 Media (88) | Operation 88 gains the optional request / answer name `seekIndex` for the INDEXED VIEW of a sealed camera file (one `sidx` box built from the signed fragment table; the sealed package, export and Verify unchanged). Written as a contract with the producer not live; UPDATED AS BUILT by closing pass K-Z1: the index, the refusal codes, the two route rules (the offsets of the view; `409 SEEK_INDEX_NOT_AVAILABLE`, never plain bytes), the audit row in file offsets, what was proven | D224 (1), D225 (1) (2); G94b-01 |
| PE-WK-36 | §5.2 `EVIDENCE_MEDIA_SERVED` (after the table of PE-WH-04) | The WARNING row of a media stop is written ONCE per stop - per operator, sign-in session, item as sealed, file, fragment and code within 60 s - not once per request that stops; a repeat is a log line; PE-WH-04's line cites moved | D225 (2), D224; G94b-10 |
| PE-WL-01 | §5.4 Alerts (after PE-WK-13) | The life of the UNSEALABLE notice: active until a holder of `EVIDENCE_REVIEW` acknowledges it through operation 70; that resolves it and writes ONE `FAULT_CLEARED` (session of the notice, operator, sending device); another role's acknowledgement leaves it active and writes no audit row (known gap, a 68th type); never a fault of another session (`alertBlocksRecording`, `openUnsealableNoticesOf`) | D228 (2), D231, D237; G75d-01, G75e-07 |
| PE-WL-02 | §2.4 Session (after PE-WI-19) | Operation 33 is the retry of a BLOCKED seal for `SESSION_START` holders (investigator, supervisor); `SEAL_AUTOMATIC_RETRIES` = 3, runs at 0 / +5 / +35 / +155 s, then the Core waits; no self-retry when the cause heals | D228 (1), D231; G75d-02 |
| PE-WL-03 | §2.4 Sealing progress (83) (after PE-WK-03) | `resumed` is true only for a seal a START of the Core ran again (narrows PE-WI-06); `404` for a session that is not open, so also for one that ended UNSEALABLE | D228, D231; G75d-04, G75d-09 (a) |
| PE-WL-04 | §3, op 40 (after PE-WK-07) | `evidence.files[].profile?` (the manifest's field 36 as signed) and `evidence.streamProfileNotice?` (op 40 only; read from the newest 100 alerts, so absent is not "equal") | D229 (3), D231; G89c-04 |
| PE-WL-05 | §2.6 (after PE-WI-08) | Camera-search rows carry `details.sessionId` only while a session is open; the boot line `CAPTURE_CONFIG_LOADED ... locked` uses the rule of operation 76 | D231; G70c-04, G70c-05 |
| PE-WL-06 | §5.2 `EVIDENCE_MEDIA_SERVED` (after PE-WK-36) | The cut of the media route: `206`, the bytes before the fragment, the socket destroyed; `409 FRAGMENT_NOT_AUTHENTIC` at the byte of the cut; exported example `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` | D230b, D231, D236; G94c-01 |
| PE-WL-07 | §5.4 Alerts (after PE-WL-01) | The sentences of a retried or blocked seal (cause without the conclusion while retried; "stopped after 3 automatic retries ... the Core now waits"; the alert names "Retry sealing" and who presses it); `SEAL_BLOCKED_MESSAGE_MAX` 400 -> 600 | D228 (1), D231; G75d-02, G75d-04 |
| PE-WM-01 | §5.4 Alerts (after PE-WL-07) | What a client receives when a generated source fails its pre-check (check row, notice, alert, audit rows) and after a later reachable run (0 banners, the alert resolved with no audit row). Updated by batch N: V98-08 is closed - `reasonCode` and `params` are members of the state slice `session`, and operation 27 answers `id`, `status`, `value`, `reason` only | D232, D237; G70d-01; D241 (V98-08) |
| PE-WM-02 | §5.2 `EVIDENCE_MEDIA_SERVED` (after PE-WL-06) | ONE WARNING row per stop also for range requests cut at the same moment; no further row for the same stop within 60 s of the first in the same sign-in | D236, D237; G94d-02 |
| PE-WM-03 | §5.4 Alerts (after PE-WM-01) | The reachability probe is asked at every use: a camera adopted during a run passes its pre-check without a restart; V98-13 stated as open at `713d83f`. Updated by batch N: V98-13 is BUILT - a probe source that throws makes every configured source read not reachable (camera `UNREACHABLE`, microphone `OPEN_FAILED`) and the pre-check blocks; no new cause | D237; follow-up M-S2; D241 (V98-13) |
| PE-WM-04 | §6 Realtime slices (after PE-WK-12) | `CAPTURE_SUPERVISOR_FAULT_OVER`: one info log line for the supervisor's CLEARED of an earlier session's fault; not a fault, no state, no row | D234, D237; G75e-03 |
| PE-WM-05 | §3 (after PE-WL-04) | Operation 31 `cancelSession` takes no body: "Cancel session" on the devices sends no reason; contract unchanged | D237; G70d-03 |
| PE-BN-08 | §2.5, operation 91 (after PE-WK-04) | A body of operation 91 that carries `credential` (`SECRET`, `REFERENCE` or `CLEAR`) is web console only: `403 NOT_PERMITTED` / `WEB_CONSOLE_ONLY` and one `ACCESS_DENIED` row from a tablet or phone session. The rule is the handler's (`requireWebConsoleSession`); the `access` member is unchanged and the condition `WEB_CONSOLE_SESSION` still stands on operations 89, 95 and 96 only | D241 (S99-09) |
| PE-BN-09 | §2.4, after "Media-token prefix (SEC35-13)" | The shared log-blanking rule set blanks the userinfo of a URL that carries a password, whatever the scheme (`rtsp://user:password@host` is kept as `rtsp://***@host`); the sentence above that said the form was blanked was an obligation, built now; its two limits | D241 (S99-04) |
| PE-BN-10 | §6 Realtime slices (after PE-WH-05) | `SESSION_CAPTURE_CHECKPOINTS_EXAMPLE`: the contract example of `session.captureCheckpoints` (24 fragments, 34,000,000 bytes, two cameras) that the clients' tests import | D241 (V98-09) |
| PE-BN-11 | §3, op 41 (after PE-WK-07) | The reader of a camera-file row's parts, of `transcriptModel` (text members 1 to 256 characters) and of a revision's `reason` (trimmed, 1 to 500) is one shared module, `@dems/shared/evidence-rules`; a part whose check did not run reads "Not run" on both clients. Contract unchanged | D241 (R101-03) |
| PE-BN-12 | §4 (after the error-code tables) | The demo-password refusal of a `REAL_PRODUCTION` Core is a boot refusal (spec 05 erratum PE-BN-13): no operation, error code, audit type or slice moved; the sign-in cards still print the demonstration password | D241 (S99-01) |

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
| `WEB_CONSOLE_SESSION` — **erratum PE-121-04** | `CoreApiAccessCondition` (new, proposed; rows 132 / 142 materialise) | the caller's operator session is **not** bound to a paired device (a web console session). Otherwise `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one `ACCESS_DENIED` row, before the body is used. `WEB_CONSOLE_SESSION` is a policy fence that keeps the camera credential off the tablet and phone code paths; it is not an authentication factor. The refusal comes before the body is **used**: nothing of the body reaches a log, an audit row or an error (**erratum PE-128-29**, SEC35-45). On ops 89, 95, 96 — every operation whose body carries a camera credential [operation 91 is web console only for a body that carries `credential`, by its HANDLER and not by this condition: erratum PE-BN-08] | D80(3); `contract-model.ts:89-120` (the condition list grows by one, §10.1; it is the complement of `DEVICE_SESSION`) |

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
| `CAPTURE_CONFIG` (discovery and connect flow) — **erratum PE-121-04** | SUPERVISOR, TECHNICIAN | R-9 AC-12; D80(2)-(4) | ops 93-97 (§2.6); **no new permission**. 93 / 94 / 97 on web, tablet and phone and while a session is open; 95 / 96 (and 89) web console only (`WEB_CONSOLE_SESSION`) and idle only [91: only a body with `credential`, by its handler - PE-BN-08] |
| `EVIDENCE_EXPORT` (existing) | SUPERVISOR | `core-api.ts:872-877`; RB-5 | modified op 42 |
| `DEVICE_MANAGE` (existing) | TECHNICIAN | `devices.ts:155`; predecessor `specs §4.4` | modified op 48 (PoE cycle) |
| `AUTHENTICATED` (any role) | every role | `contract-model.ts:133` | captures, sealing progress, intervals |
| `CAPTURE_COMMISSION` (new; added by task 4, blueprint row 100) | TECHNICIAN | task 4 decision U10; plan review P12-F07; `sim/auth.ts`; stored rows: migration `0018` | the commissioning functions of the camera network (alias address, factory-address scan, set camera address, network settings). **TECHNICIAN only.** Its operations are 101 to 107 of the table of §2.6, added by the contract package of task 4 (blueprint row 102); each is web console only (`WEB_CONSOLE_SESSION`) |

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
| 85 | `TranscriptRevisionRequest { baseRevision, changes[] { segmentIndex, from, to }, note? }` | 201 `TranscriptRevision { revisionId, number, authorId, baseRevision, machineTranscriptHash, signedBy, signature, createdAt, changes[] }` (**erratum PE-WK-02:** also `reason?`) | publishes `evidence` | 400, 401, 403, 404, 409 `TRANSCRIPT_NOT_READY`, 409 `TRANSCRIPT_REVISION_CONFLICT`, 422 `INVALID_INPUT` (**erratum PE-WK-01:** also `details.reason: REVISION_FROM_NOT_CURRENT_TEXT`) |
| 86 | query `cursor`, `limit` | 200 `{ items: TranscriptRevision[], nextCursor }` (**erratum PE-WK-02:** each item may carry `reason?`) | reads `evidence` | 401, 403, 404, 409 `TRANSCRIPT_NOT_READY`, 422 `INVALID_QUERY` |
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

**Erratum PE-WK-03 (decisions D220, D224; re-gate 75 finding G75c-05; fix wave K driver S1, `implementation/139_fix_wave_k_s1.md` section 1 row 5; `delegation_progress/contract_wave_k.md` S1 section 5; `implementation/147_docs_errata_wave_k.md`):** the rule of `etaMs`. On a Core in real capture it is the remaining time of the RUNNING step AS THE CORE
MEASURED IT (`apps/core-server/src/sealing-host/progress.ts:48-54`): only the two steps that process bytes the Core counts report one, `CLOSE_TRACKS` and `FINALIZE_HASHES` (`sealing/pipeline/pipeline.ts:292`, `:531`), and only after a twentieth of the step is done (`pipeline.ts:247`). It is `null`
whenever the Core has no measured basis: before that twentieth, for a step that FAILED (`pipeline.ts:936`), while no step runs, and ALWAYS for the transcript step `FINALIZE_TRANSCRIPT` (`pipeline.ts:633`; it used to carry what was left of the BOUND of the wait, about 1,680 s, which is a limit and not an
estimate). `0` when every step is done. The same holds for `session.finalization.steps[].etaMs`. The progress sentence of the transcript step is `steps[].detail` ("1 of 3 chunks", `pipeline.ts:634`) where a client reads the session slice. CLIENT RULE: `etaMs === null` draws NO "about N s left" line
(not "0 s", not a dash with a unit; masterplan/08_client_ux_spec.md erratum PE-WK-21). A timed seal of the in-app simulator keeps the simulator's own figure (`progress.ts:50-51`). The body shape and the totals are unchanged.

**Erratum PE-WL-03 (decisions D228, D231; re-check 75 findings G75d-04 and G75d-09 (a); fix wave L driver L-S, `implementation/153_fix_wave_l_s.md` rows 3a, 3c; `contract_wave_l.md` section 3; `implementation/165_batch_n_docs.md`) - OPERATION 83: `resumed` IS TRUE ONLY FOR A START OF THE CORE; AN ENDED SESSION ANSWERS 404.** Narrows PE-WI-06. On a Core in real capture `resumed: true` means that a START of the Core ran the seal again - never an automatic retry of the same process and never the on-demand retry of operation 33 (which set it before wave L). The fact is the sealing host's (`apps/core-server/src/sealing-host/index.ts:650` `resumedSeal`, set only by the start path `:697`; `sealing-host/progress.ts:18-25`, `:66`; member description `packages/shared/src/api/sessions.ts:233`). In Simulated mode the rule of the attempt stays (the simulator's attempt grows on a RECOVERY only). No member states "this seal was run again on demand"; none was asked for. Operation 83 answers `404 NOT_FOUND` when `{id}` is not the open session (`apps/core-server/src/modules/sealing/index.ts:56`) - so also for a session that ended UNSEALABLE: there is NO progress of an ended session, and a dialog that still holds the last body of operation 83 must drop it (no percentage, no "Finalizing", no "Resumed"). The durable facts of that end are the `sessionHistory[]` entry with `outcome: 'INCOMPLETE'` and, while it is open, the notice of PE-WL-01. Example `sealingProgress` of `SESSION_EXAMPLES` unchanged. Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

**Erratum PE-WI-06 (decision D217; re-gate 75 finding G75b-02; fix wave I driver A1, `implementation/131_fix_wave_i_a1.md` section 3.1 row "Resumed after restart" and decision 6; `delegation_progress/contract_wave_i.md` section 4):** the meaning of
`resumed` on a Core in real capture is the sealing host's fact, not a reading of `attempt`. It is
`true` only when THIS run of the seal was started by a start of the Core (the boot resume) or by
the recovery action `recoverSession`; it is `false` for a first run and for every automatic retry
inside the same process (`apps/core-server/src/modules/sealing/index.ts:61`;
`apps/core-server/src/sealing-host/index.ts:575`, `:588`, `:635`). The body shape of operation 83
did not change. In simulated capture `resumed` stays what the simulator answers (there `attempt`
grows by a RECOVERY alone). `finalization.steps[].attempt` grows with EVERY run of the seal: a
client must not derive "resumed after restart" from `attempt > 1`.

**Erratum PE-WI-07 (decisions D216, D217; re-gate 75 findings G75b-01, G75b-02; fix wave I driver A1, `implementation/131_fix_wave_i_a1.md` section 3.1 rows 2c-2e; `delegation_progress/contract_wave_i.md` sections 1-3):** how a
seal that is retried or blocked is read. **No contract member was added** (97 operations, 67 audit
types; no OpenAPI change): everything is in members the state already carries.
(1) RETRYING: `session.state` is `FINALIZING` and one entry of `session.finalization.steps[]` has
`status: 'error'`, the Core's sentence in `detail` and its `attempt`; there is no alert yet. The
Core runs the seal again by itself: three retries per process, after 5 s, 30 s and 120 s
(`apps/core-server/src/sealing/pipeline/way-out.ts:61`).
(2) BLOCKED: the retries are used up and the cause may heal. The state stays `FINALIZING`, the
failed step keeps `status: 'error'`, and ONE entry of `alerts[]` is active: `severity: CRITICAL`,
`kind: SYSTEM`, `target` = the session id, `params: { reason: 'SEAL_BLOCKED', cause, step,
sessionId, detail? }`. `params.cause` is a sealing failure code; `params.detail` is an optional key
of the open `params` map with one value of the closed list `SEAL_BLOCKED_DETAILS`:
`SESSION_KEY_NOT_OF_SESSION`, `SESSION_KEY_STORE_UNAVAILABLE`, `SESSION_KEY_UNSAFE`,
`SESSION_KEY_WRITE_FAILED`, `SESSION_KEY_NOT_FOUND`, `SESSION_CIPHER_REFUSED`
(`packages/shared/src/sim/seal-blocked.ts:35`, `:41-53`). The alert is resolved when the seal
completes or the session is ended. The Core records no new session until this one is sealed.
(3) THE ONE READING for a client is the shared reader `sealAttentionOf({ session, alerts })`
(`seal-blocked.ts:141`; `null`, or `kind: 'RETRYING' | 'BLOCKED'`), and for Home / Dashboard /
header surfaces `sealBlockedNoticeOf(state, sessionId?)` (`seal-blocked.ts:97`); the fixed
sentences are `SEAL_BLOCKED_DETAIL_SENTENCE` (`:60-66`) and `SEAL_RECORDING_KEPT_SENTENCE`
(`:70`, "The recording is kept on the Core."). Both are exported by `@dems/shared/sim`.
(4) TERMINAL: `SEALER_FAILED` with the cause `SESSION_KEY_NOT_OF_SESSION` is not retriable; its
third attempt ends the session as UNSEALABLE (the recordings are MOVED to `.quarantine/<id>/`,
the session ends INCOMPLETE, the alert is `params: { reason: 'UNSEALABLE', cause, sessionId }`).
Every other sealer cause stays retriable and blocked until healed (`implementation/131_fix_wave_i_a1.md` section 7, decision 2).
What the surfaces draw from this is `masterplan/08_client_ux_spec.md` erratum PE-WI-10.

**Transcript (84-86).** 84 returns the machine transcript inside the seal. 85 appends a **signed
revision** (`TRANSCRIPT_REVISE`, Core Ed25519 key, author recorded, no approval flow — OD-15); the
sealed machine transcript is byte-unchanged and `baseRevision` binds the revision to it (row 33
`transcript-spec §A.6`). 86 lists the append-only revisions.

**`baseRevision` mapping (SEC35-21).** `baseRevision` (op 85) is defined as the item's **current
`max(revision_no)`** (`0` when no revision exists), read and compared **inside the same INSERT
transaction** that mints `revision_no = max+1` (`04_database_contract.md §B.9`); a mismatch is
`409 TRANSCRIPT_REVISION_CONFLICT`. There is no `baseRevision` column — the mapping is a write-
transaction rule (no sequence; D-DB-07), and verify V-11 remains the `parent_sha256` chain.

**Erratum PE-WK-01 (decisions D221 (2), D224; re-gate 81 finding G81b-01; fix wave K driver S2, `implementation/140_fix_wave_k_s2.md` section 1 row G81b-01; `delegation_progress/contract_wave_k.md` S2 section 4; `implementation/147_docs_errata_wave_k.md`):** operation 85 refuses a change whose `from` is not the segment's CURRENT text.
The current text of a segment is the `to` of the newest stored revision that changed it, else the text of the sealed machine transcript; the changes of ONE request apply in the order sent, so a second change to a segment starts from the `to` of the first
(`apps/core-server/src/modules/transcripts/routes.ts:173-187`, `staleFromOf`). The refusal is `422 INVALID_INPUT` with `details { in: 'body', member: 'changes', reason: 'REVISION_FROM_NOT_CURRENT_TEXT', segmentIndex, currentRevision }`:
`segmentIndex` is the first change (in request order) whose `from` is stale, `currentRevision` the head the unit read (`routes.ts:152`, `:162`, `:513-516`). The check runs INSIDE the unit, AFTER the head check (`:494`), so a request built on a head that is no longer current stays
`409 TRANSCRIPT_REVISION_CONFLICT` (a stale base is told as before) and the text is judged against the revision list the unit settled (`:513`). It is thrown before the signer signs, before the revision row, before the `TRANSCRIPT_REVISED` audit row and before the staged list
(`:518` onward): nothing is signed and nothing is written. Stored revisions are read for their `to` only; a stored `from` that was false when it was written (the planted revision 4 of `EV-20261010-0020`) is not re-judged, and verify V-11 was not changed. A client builds `from` from
the newest revision's `to` (operation 86) for a segment that was already revised, not from the sealed document. The contract text of `from` says so (`packages/shared/src/api/evidence.ts:402`). No new code and no new operation: 97 / 36 / 61 / 67; the new `details.reason` value is also listed in §4.

**Erratum PE-WK-02 (decision D224; re-gate 81 finding G81b-09; fix wave K reconcile pass K-R, `implementation/144_fix_wave_k_kr.md` section 1 item 6; `delegation_progress/contract_wave_k.md` KR section 2; `implementation/147_docs_errata_wave_k.md`):** `TranscriptRevision` gains the optional
member `reason` (`packages/shared/src/api/evidence.ts:443`; the schema was a strict object without it while the stored row holds it). It is the note the author gave (operation 85 `note`, 5..500 characters), written from the stored row by `revisionAnswer`
(`apps/core-server/src/modules/transcripts/routes.ts:414-416`), so it is on the `201` of operation 85 and on every entry of `items` of operation 86; the same text is inside the signed body and on the `TRANSCRIPT_REVISED` row (`details.reason`, `routes.ts:564`).
Absent only where a stored revision holds none (operation 85 cannot write such a revision, the note being required): absent means "not stated", a client draws nothing and never a default. Access is the access of the revision itself (`EVIDENCE_VIEW` plus the case scope of
operation 86): a refusal carries no entry, so no reason. Examples: `TRANSCRIPT_REVISION_REASON_EXAMPLE`, and the registry examples of `createTranscriptRevision` 201 and `listTranscriptRevisions` 200 carry the member. Additive and optional: 97 / 36 / 61 / 67 unchanged.

**Export (modified 42 + 87).** `exportEvidence` (op 42) becomes the **v2 export request**: it creates
a background export job (decrypted copy + manifest + signature; `composite` optional, marked
`derived` — OD-16) and answers `202`; 87 polls the job to completion. The former synchronous
`EvidenceExportAccepted` changes meaning from "the file exists" to "the job is queued" (§3).

**Media (88).** `createEvidenceMediaSession` returns a short-lived signed URL to the NM-11 media
route, which serves the decrypted camera file with HTTP Range support (M8; `register NM-11`). The
route is registry-external, like `/ws` (`contract.test.ts:388-408`); it carries its own static rule
and adds the signed-URL prefix to both log-blanking lists (E-31). This is why 88 is `live` only.

**Erratum PE-WK-35 (decisions D224 (1); re-gate 94 finding G94b-01, MAJOR; closing pass K-Z1, `delegation_progress/contract_wave_k.md` Z1 section 1; `implementation/142_fix_wave_k_m1.md` section 1.4; `implementation/147_docs_errata_wave_k.md`; updated AS BUILT by `implementation/145_fix_wave_k_z1.md`, decision D225 (1) (2) and `implementation/148_docs_errata_wave_k_touchup.md`) - THE INDEXED VIEW (CONTRACT NAMED, PRODUCER NOT YET LIVE WHEN FIRST WRITTEN; BUILT BY CLOSING PASS K-Z1: SEE "AS BUILT" BELOW THE PARAGRAPH):** the Android player of the tablet / phone cannot seek the sealed camera
file (it has no segment index; the web seeks by probing ranges; M1's diagnosis on the device). Ruling D224 (1): the media route serves an INDEXED VIEW. Operation 88 gains ONE additive optional name, `seekIndex`, and nothing else: the REQUEST body `EvidenceMediaSessionRequest.seekIndex?: true` ("serve this session as the indexed view if the Core can"; absent = the stream exactly as before, the web player sends nothing new;
`packages/shared/src/api/evidence.ts:507-512`) and the ANSWER `EvidenceMediaSession.seekIndex?: true` (present, always `true`, exactly when the URL of THIS session serves the indexed view; absent = the plain stream, because the client did not ask or the fragment table of the file cannot yield an exact index; never `false`; `evidence.ts:533-538`). Examples: `EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE` and `EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE`
(`evidence.ts:548-557`); the mobile constant `SEEK_INDEX_MEMBER` (`apps/mobile/src/features/evidence/media-session.ts:109`) is the same name. THE VIEW, as the contract and the header of the pure builder state it (`apps/core-server/src/media-stream/seek-index.ts:1-41`, the header of the file): the SAME decrypted bytes plus ONE `sidx` box between the init segment and the first fragment, built from the SIGNED manifest's fragment table
(`files[].fragments[]`: `byteOffset`, `byteLength`, `mediaStartMs`, `mediaDurationMs`, `keyframe`; timescale 1000; one reference per fragment; `starts_with_SAP` from `keyframe`); an index is built ONLY when the table says by itself that its references are the whole of the file after the init segment (a first fragment after byte 0, every fragment starting where the one before ended, the last ending at the end of the file, starts strictly ascending;
an interrupted recording whose sealed prefix holds that gets an index for what exists), else the session states no view and the client keeps its no-seek sentence (ux erratum PE-WK-24). The view is a property of the media SESSION (it is under the token's MAC): `content-length`, `content-range` and Range offsets of that URL are those of the view (file size + the index's bytes). Nothing in the sealed package, its hashes, the export archive or
Verify changes; the box exists in the answer of the media route only. Totals unchanged: 97 / 36 / 61 / 67, schema 6. STATE WHEN FIRST WRITTEN (SUPERSEDED by the "AS BUILT" paragraph below, kept as written): the request and answer schemas and the examples are in the tree; the producer (`media-stream/service.ts`, `source.ts`, `token.ts`) was still being changed by its driver and the contract file carries no "consistent" line for Z1; nothing here was run, and the closing pass's own note was not written. The behaviour above is the CONTRACT's, not a finding of this pass: OPEN until that note
exists and the re-check on the device has seeked an indexed view.

**AS BUILT - erratum PE-WK-35, updated in place (closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` sections 1, 2 and 10; decision D225 (1) and (2); `delegation_progress/contract_wave_k.md` Z1, status line `:157` "LIVE"; `implementation/148_docs_errata_wave_k_touchup.md`; every line below was read in the tree on 2026-10-11).** The sentences "CONTRACT NAMED" and "PRODUCER NOT LIVE" above no longer hold: the producer exists, and the contract above is what it does.
(1) REQUEST AND ANSWER, unchanged in shape. The body is strict (`MediaSessionRequestSchema`, `apps/core-server/src/media-stream/service.ts:168`: `fileId` and `seekIndex: true` only; `seekIndex: false`, another member or another value is `422 INVALID_INPUT`, `askOfBody` `:231-237`). The session is the indexed view when it was ASKED and the plan of the file HAS an index (`:341`); the answer then carries `seekIndex: true` (`:358`). Asked and refused by the table: the session is the plain stream, the answer carries no `seekIndex`, and one `info` log line names the refusal code (`:342`) - the code is never in the answer.
(2) THE INDEX (`media-stream/seek-index.ts:105` `buildSeekIndex`, pure): ONE `sidx` box version 1 (ISO/IEC 14496-12 8.16.3) placed at the first fragment's `byteOffset`, i.e. the end of the init segment; 40 bytes plus 12 per fragment (`:92-93`), at most 65 535 references (`:87`). `referenced_size` = the fragment's `byteLength`; `subsegment_duration` = the distance to the NEXT fragment's `mediaStartMs` and, for the last fragment, its own `mediaDurationMs` (a fragment's own duration spans its audio and video, so neighbours overlap by some ms; the starts are the table's gapless clock: `:22-25`, `:117-130`); `timescale` 1000; `earliest_presentation_time` = the first `mediaStartMs`; `first_offset` 0; `starts_with_SAP` from `keyframe` (`:95`, `:149`). `reference_ID` is the CONSTANT 1 (`:31-33`, `:86`, `:138`): the signed table does not hold the video track's ID and the player this view is for does not read it (decision D225 (2)). THE VIEW is `file[0, at) | sidx | file[at, size)` (`:12`), its length the file's plus the box's (`indexedViewSize`, `:155-157`).
(3) EXACT OR NONE. The index is built only when the signed table proves by itself that its references are the whole of the file behind the init segment; otherwise the refusal is one of `NO_FRAGMENTS`, `NO_INIT_SEGMENT`, `FRAGMENTS_NOT_CONTIGUOUS`, `FRAGMENTS_NOT_TO_END`, `TIMES_NOT_ASCENDING`, `VALUE_OUT_OF_RANGE`, `TOO_MANY_FRAGMENTS` (`:54-68`). The plan is made with the same believed manifest as the plain stream and cached with it (`source.ts:91-93`, `:197-198`; `service.ts:307-321`). An interrupted recording's sealed prefix holds the rule on the real tables (note 145 section 1) and gets an index for what exists.
(4) ROUTE RULE 1 - THE OFFSETS OF A SESSION OF THE VIEW ARE THE VIEW'S. The view is a CLAIM of the media token, under its MAC: the high bit of the file byte, the same token length, so a token cannot be moved between views (`media-stream/token.ts:54-55`, `:73-74`, `:109`, `:147-154`). On such a session `content-length`, `content-range`, the `Range` offsets and the `416` (`content-range: bytes */<view size>`) are those of the VIEW, and behind the box every view offset is the file offset plus the box's length (`service.ts:437-446`, `:495-501`; `ranges.ts:53-60`; `seek-index.ts:167-182`). Every file stretch of a view range is read, opened and authenticated by the same reader as in the plain stream (`source.ts:254-263` `readIndexedView` through `readPlain`), so the refusal position is the plain stream's: the first piece is read before the status line, a range that STARTS at the view offset the index names for a failed fragment is a clean `409 MEDIA_NOT_AVAILABLE` / `FRAGMENT_NOT_AUTHENTIC` naming it and not one byte (`service.ts:452-462`), and a range that reaches it later is cut before it (`:484-492`).
(5) ROUTE RULE 2 - NEVER THE PLAIN BYTES AT THE VIEW'S OFFSETS. A session of the view whose file has no index when the request arrives answers `409 MEDIA_NOT_AVAILABLE` with `details.reason: SEEK_INDEX_NOT_AVAILABLE` (`service.ts:142`, `:439-440`). It cannot happen while the manifest of record is the one the session was issued for (contract Z1 section 2).
(6) THE AUDIT ROW OF A STOP on a session of the view names the range in FILE offsets (the sealed file's own), and `bytesServed` as sent, including the index's bytes when the range covered them (`service.ts:447-450`, `:393`; contract Z1 section 2). That a stop is one row, not one per request, is erratum PE-WK-36.
(7) UNCHANGED, and read in the code: the web player sends no `seekIndex` and gets the stream of before; nothing is written (the box exists in the answer of the media route only: `seek-index.ts:10-16`); the sealed package, its hashes, the export archive and Verify never see it. Totals 97 / 36 / 61 / 67, schema 6; the OpenAPI document holds the member (`packages/shared/openapi/openapi.json`, regenerated by Z1, note 145 section 2).
(8) WHAT WAS PROVEN, by the driver and not re-run by this pass (note 145 section 3, decision D225): on the tablet against the real Core, seeks at 25 / 50 / 90 % of a 60.8 s item land (the scrubber handed over 15 / 30 / 55 s, the player read 15.000 / 30.016 / 55.000 s), seeks beyond the buffer on a 296 s item land, an interrupted item seeks, the position survives a renewal of the media session, the tamper demonstration stops with ONE WARNING row; by tests, the index on the real tables, 11 range cases and the refusal position. NOT proven: the PHONE was not driven; a one-camera package was sealed by the product pipeline in a test only; the web does not use the view. Not yet gate-verified (the targeted re-check of gate 94 has not run).

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

**Erratum PE-BN-09 (decision D241, ruling S99-04; security review row 99 finding S99-04; `implementation/164_batch_n_chain_fixes.md` section 2; `delegation_progress/contract_batch_n.md` E-BN-3; `implementation/166_batch_n_docs_followup.md`) - THE SHARED LOG-BLANKING RULE SET BLANKS THE USERINFO OF A URL THAT CARRIES A PASSWORD.** The paragraph "Media-token prefix (SEC35-13)" above says the camera-credential form `rtsp://user:pass@host` "is blanked too (SEC35-04)". At `713d83f` the shared rule set had token-prefix and scheme rules and no rule for a password inside a URL: that sentence was an obligation, not a fact. It is built in batch N. Rule 1b of `packages/shared/src/api/redaction.ts` (`URL_USERINFO`, `:83`; applied at `:249` before the token rule; described in the file header at `:14`): the shared log-blanking rule set blanks the userinfo of a URL that carries a password, whatever the scheme - `rtsp://user:password@host/...` is kept as `rtsp://***@host/...`; the password may hold `@` and `:`. Two limits, stated in the file: a password with a raw `/` is not covered (no URL parser reads it), and a userinfo WITHOUT a password is not blanked. The blanking of `mts_` and `exs_` tokens is unchanged. The one rule set is what both client logs call (the web error sink and the mobile `runtime/log.ts`). Held by `packages/shared/test/redaction.test.ts`, describe "S99-04" (nine vectors, an object walk, and six texts that must stay). No operation, member or audit type moved.

**REAL-evidence case scope (SEC35-16, provisional).** For an item whose `integrity_source='REAL'`,
op 88 (and the `EVIDENCE_VIEW` reads 84/86) additionally require the caller to be the **owner of that
case/session** (the session creator) or a **SUPERVISOR**; a mere `EVIDENCE_VIEW` holder is refused
`403 NOT_PERMITTED`. This narrows the pre-existing all-roles `EVIDENCE_VIEW` reach for REAL evidence
and is **not** decided by OD-10/OD-15, so it is recorded as **provisional** and flagged **needs user
confirmation at the second blueprint gate** (accept the residual all-roles read, or confirm the
case-scope rule) before M8 ships. Simulated/demo (`DEMO_PACKAGE`) evidence keeps the existing
all-roles read (P2 §8 R-12 stays true there).

**Erratum PE-FX-01 (decision D178; review row 93, finding R93-02; closing pass F-X): the case scope
is ENFORCED as built** - operations 84, 85, 86, 88, 42 and 87 and the two registry-external routes
`GET /media/{token}` and `GET /exports/{token}` hold ONE predicate (the case's investigator or a
SUPERVISOR) for REAL evidence and refuse with `403 NOT_PERMITTED`, `details.reason:
EVIDENCE_CASE_SCOPE`, one `ACCESS_DENIED` row.

**Erratum PE-FX-02 (decision D186 (4); fix pass F-M7b decision 4): operation 33 `recoverSession`
answers `202` with state `FINALIZING`, not `RECOVERY`, when the open session is FINALIZING with a
FAILED sealing step on a Core in real capture operation: the operation then re-queues that seal in
the background, starts no recovery and writes no `RECOVERY_STARTED`. In every other state it is
unchanged (`202 RECOVERY` from FAULT, `409 INVALID_STATE` otherwise).

**Erratum PE-WI-19 (decision D218 (4); decision D186 (8); tidy pass F-Y; `implementation/137_docs_errata_followup.md`) - CORRECTS PE-FX-02:** the clause of PE-FX-02 above, "starts no recovery
and writes no `RECOVERY_STARTED`", is **SUPERSEDED** (the old sentence stays above as history; do not read it as the contract). The ruling of D218 (4) follows the code. As built, the retry
on demand of a failed seal is AUDITED. Operation 33 hands the request's principal to the sealing host's door `failedSeal(id)`
(`apps/core-server/src/modules/sessions/routes.ts:306-312`); `retryFailedSeal` (`apps/core-server/src/sealing-host/index.ts:569-579`; contract text `:150-158`) returns true at once while a run of the seal is under way, and otherwise resets the way-out (`:574`) and writes ONE audit row through `noteRetryOnDemand` (`:308`, called at `:578`) and the engine door `noteSealRetryOnDemand`. The row
(`apps/core-server/src/engine/sealing-notice-doors.ts:119-137`): type `RECOVERY_STARTED`, severity `WARNING`, `actorId` = the operator who asked (null when the principal is no operator),
`sessionId`, `evidenceId`, message "Sealing of session {id} is run again on demand ({cause})", and `details { reason: 'SEAL_RETRY', cause, step, faultKind }` where `cause` is the failure code of
the failed step, `step` the step (both `null` when the journal cannot be read), and `faultKind` the session's fault kind or `null` when it has none (`SEAL_RETRY_REASON` is `engine/sealing-notice-doors.ts:34`).
A request that finds a run already under way resets nothing, writes no row and answers `202` all the same (`sealing-host/index.ts:572-573`). What PE-FX-02 had right stays: the answer is `202` with
`state: FINALIZING`; no recovery of the boot kind (the `FAULT` to `RECOVERY` path, `recoverTransition`) is started and the session stays `FINALIZING`; every other state is unchanged. The row is
the audit note of the retry, not the start of a recovery; no new audit type (67). Pinned by `apps/core-server/src/modules/sessions/__tests__/recover-failed-seal.db.test.ts:85-89`.

**Erratum PE-WL-02 (decisions D228 (1), D231; re-check 75 finding G75d-02; fix wave L driver L-S, `implementation/153_fix_wave_l_s.md` row 2; `contract_wave_l.md` section 2; `implementation/165_batch_n_docs.md`) - OPERATION 33 IS THE RETRY OF A BLOCKED SEAL; THE CORE DOES NOT RETRY BY ITSELF WHEN THE CAUSE HEALS.** PE-FX-02 / PE-WI-19 state operation 33 `recoverSession` as the on-demand retry of a FAILED seal. Wave L states the three rules around a BLOCKED one; nothing new is on the wire. (1) WHO: the permission of operation 33, named `SEAL_RETRY_PERMISSION` = `Permission.SESSION_START` (`packages/shared/src/sim/seal-blocked.ts:47`; INVESTIGATOR and SUPERVISOR - a TECHNICIAN gets `403`); test `canRetryBlockedSeal(role)` (`:50`). It answers `202` with `state: FINALIZING` and writes `RECOVERY_STARTED` with `details.reason: 'SEAL_RETRY'`, the operator and the sending device. (2) THE BOUNDED DESIGN, as a constant clients may print from: `SEAL_AUTOMATIC_RETRIES` = 3 (`seal-blocked.ts:44`). One attempt at the stop, then three automatic retries in the same process, 5 s, 30 s and 120 s after the failure before (`apps/core-server/src/sealing/pipeline/way-out.ts:61` `SEAL_RETRY_DEFAULTS`): four runs, at 0 / +5 / +35 / +155 s. A cause that no retry gets past ends UNSEALABLE instead (PE-WL-01); every BLOCKED seal is retriable on demand. (3) THEN THE CORE WAITS: it runs the seal again ONLY at a start of the Core (which has its own three retries) or when operation 33 is sent. **It does NOT retry by itself when the cause heals.** A client knows the state by `sealAttentionOf(state)?.kind === 'BLOCKED'`. True sentences for a screen: "Sealing stopped after 3 automatic retries." and "An investigator or a supervisor can retry." (UX spec erratum PE-WL-09). Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`. Gate state: blocked -> release -> operation 33 -> sealed was driven live at final re-check 75 (`gateway_check/10e_m5_final.md`; D234).

**Erratum PE-WH-02 (decisions D205, D208; gate 94 finding G94-01; reconcile pass R, `implementation/127_fix_wave_h_r.md` section 3 and "D205: the scope line"):** operation 88 and the
registry-external route `GET /media/{token}` open an item that has a sealed v2 package in the
Core's store. That is a REAL item, OR a demonstration item the seed sealed on this Core
(`integrity_source = 'DEMO_PACKAGE'`, manifest version 2, development sources, an Ed25519 signature
that is not simulated: `apps/core-server/src/media-stream/items.ts:54`;
`apps/core-server/src/media-stream/service.ts:195`). The case scope of SEC35-16 / PE-FX-01 stays
for `integrity_source='REAL'` only, as the sentence above already says (`service.ts:263`): a
seed-sealed demonstration item plays for every `EVIDENCE_VIEW` holder. A v1 demonstration item
and a simulated item keep `409 MEDIA_NOT_AVAILABLE` (reason `NOT_A_SEALED_PACKAGE`); a client
plays its bundled media for those. For the tamper demonstration item a range that starts in the
altered fragment answers `409 MEDIA_NOT_AVAILABLE` with the reason `FRAGMENT_NOT_AUTHENTIC`
(`VIDEO-02`, seq 3). The description strings of operations 40 / 88 in
`packages/shared/src/api/evidence.ts` still say 'REAL' / 'every dataset item': wording only, not
changed by pass R (no rename, additive rule).

**Erratum PE-WH-06 (decision D209; closing pass Z1, `implementation/128_fix_wave_h_z1.md` item 3):** the
installation identity a sealed manifest states (`device.deviceId`, `device.name`: evidence package
spec §B.3 fields 20 / 21, erratum PE-WH-08) is CORE CONFIGURATION, read once at start from two
environment keys, `DEMS_INSTALLATION_DEVICE_ID` and `DEMS_INSTALLATION_NAME`
(`apps/core-server/src/config.ts:60-61`, `:294`, `:301`;
`apps/core-server/src/sealing-host/installation-identity.ts:59`). No operation of this contract
reads, carries or sets it, and no slice member was added for it. The stored device record of the
state is no longer read for the manifest.

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
| 91 | `updateSttConfig` | POST | `/api/v1/transcription/config` | Device | simulated | `PERMISSION CAPTURE_CONFIG` [a body with `credential` is also web console only, by the handler: PE-BN-08] | `STT_CONFIG_CHANGED` / `ACCESS_DENIED` | NM-06, NM-09 pattern, E-30, E-31; R-8; M6 |
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

**Erratum PE-WK-04 (decisions D221 (3), D224; re-gate 81 finding G81b-05; fix wave K driver S2, `implementation/140_fix_wave_k_s2.md` section 1 row G81b-05; `implementation/147_docs_errata_wave_k.md`):** `pendingForNextSession` (operation 90) is true only while a session that is NOT SEALED holds an older snapshot. On a Core in real capture the
session fact is read from `active_session` only for a row whose state is not `SEALED` (`apps/core-server/src/modules/stt-config/statements.ts:66-77`, `OPEN_SESSION_STATE_RULE`): the table keeps the row of the last session after its seal, and "a row exists" had said "a session is open" for a Core on which none was, so
both clients said "A saved change is waiting" with nothing to wait for. A sealed session holds no snapshot any more (its transcript is sealed), so a change saved after the seal answers `appliesFrom: 'NOW'` and `pendingForNextSession: false`; during an open session a change still answers `NEXT_SESSION` / `true` (the row "When a change applies" above is
unchanged for that case). The simulator already stated the fact so (`isSessionActive`). The member name and the shape are unchanged. Totals unchanged.

**Erratum PE-BN-08 (decision D241, ruling S99-09; security review row 99 finding S99-09; batch N code driver, `implementation/164_batch_n_chain_fixes.md` section 3 and section 11 decisions 1 and 2; `delegation_progress/contract_batch_n.md` E-BN-2; `implementation/166_batch_n_docs_followup.md`) - A BODY OF OPERATION 91 THAT CARRIES `credential` IS WEB CONSOLE ONLY; THE RULE IS THE HANDLER'S, NOT THE ACCESS MEMBER'S.** Operation 91 `updateSttConfig`: access `CAPTURE_CONFIG` (unchanged; `packages/shared/src/api/transcription.ts:519`). A body that carries `credential` (`SECRET`, `REFERENCE` or `CLEAR`) is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and ONE `ACCESS_DENIED` row (`details`: `operationId`, `permission`, `role`, `reason`) when the session is bound to a paired tablet or phone - before the credential is read, sealed or stored. The same session may send every other member, and a save WITHOUT `credential` from a device is stored as before. The rule is applied by the operation's handler through the permission guard, as its first statement when the body has the member (`apps/core-server/src/modules/stt-config/index.ts:309` calling `requireWebConsoleSession`, `apps/core-server/src/plugins/permission-guard/index.ts:359`); the guard answers with the refusal of stage 6 itself - the same denial budget, `ACCESS_DENIED` row, log line and `403` (`WEB_CONSOLE_ONLY_TEXT`, `plugins/permission-guard/denial.ts:47`: "This action is available on the web console only. The attempt was audited."). It is NOT a condition on the access member, because the access rule is decided at stage 6, before the body is parsed: a `WEB_CONSOLE_SESSION` condition there would have refused the tablet's save without a credential as well. The condition `WEB_CONSOLE_SESSION` therefore still stands on operations 89, 95 and 96 only, and the acceptance matrix (`test/acceptance/rbac-matrix.test.ts`: three operations carry the condition) is unchanged. All three credential kinds are covered because each changes the credential (the batch N driver's decision, section 11 (2) of note 164: narrowing the rule to `SECRET` is a one-line change). Registry: a description sentence (`STT_CREDENTIAL_WEB_CONSOLE_ONLY`), the 403 text (`STT_CREDENTIAL_WEB_CONSOLE_ONLY_REFUSED`) and the 403 example `webConsoleOnly` (`STT_WEB_CONSOLE_ONLY_EXAMPLE`) of operation 91 (`transcription.ts:453-456`, `:596-607`, `:642`); `packages/shared/openapi/openapi.json` was regenerated. The in-app simulator of a tablet or phone answers the same (`packages/shared/src/sim/api.ts:1080`). The mobile apps send nothing to operation 91: no file of `apps/mobile/src` other than a test names it (a search of the tree), and a static test holds that for the transcription folder (`apps/mobile/src/features/transcription/stt-status-static.test.ts:24-30`); they read operation 90 only. Held by `modules/stt-config/__tests__/routes.test.ts` (describe "S99-09", with the control of the same tablet session saving without a credential), `modules/stt-config/__tests__/static.test.ts`, `packages/shared/test/api-stt-config.test.ts` and, with a real paired-tablet session on PostgreSQL, `modules/capture-discovery/connect/__tests__/connect.db.test.ts:250`. A test, not a lane run: no gate has seen it. Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

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
| 98 | `searchCaptureAudioCards` | POST | `/api/v1/capture/audio-cards/search` | Device | simulated | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` (**web console only**) | `CAPTURE_DISCOVERY_SEARCHED` with `scope: AUDIO_CARDS` / `ACCESS_DENIED` | Added by task 4 (`docs/2026-10-12_input_av_core_adapter_plan`, blueprint row 63, integration pass I-2): P12-F05 (c), P12-F06; AD-07. Contract: `packages/shared/src/api/capture-audio-cards.ts` |
| 99 | `registerCaptureAudioInput` | POST | `/api/v1/capture/audio-cards/inputs` | Device | simulated | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` (**web console only**) | `CAPTURE_AUDIO_INPUT_CHANGED` / `ACCESS_DENIED` | Added by task 4 (the same row and pass): P12-F05 (c), P12-F06; AD-07 (2). Contract: the same file |
| 100 | `confirmCaptureDeviceAddress` | POST | `/api/v1/capture/devices/address/confirm` | Device | simulated | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` (**web console only**) | `CAPTURE_DEVICE_ADDRESS_CHANGED` / `ACCESS_DENIED` | Added by task 4 (`docs/2026-10-12_input_av_core_adapter_plan`, blueprint row 194): the operator-confirmed re-address of a registered camera; U12 A7, C47 (29); SEC35-28, AD-02. Contract: `packages/shared/src/api/capture-discovery.ts`, last section. No Core route yet (row 197) |
| 101 | `getCaptureNetworkConfig` | GET | `/api/v1/capture/network/config` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `NONE-R` / `ACCESS_DENIED` | Added by task 4 (`docs/2026-10-12_input_av_core_adapter_plan`, blueprint row 102, WP-23b): the commissioning functions of the camera network; U6, U7, U10. Contract: `packages/shared/src/api/capture-commissioning.ts`. No Core route yet (row 108) |
| 102 | `updateCaptureNetworkConfig` | POST | `/api/v1/capture/network/config` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `CAPTURE_NETWORK_CONFIG_CHANGED` / `ACCESS_DENIED` | The same row and file. No Core route yet (row 108) |
| 103 | `scanFactoryCameras` | POST | `/api/v1/capture/network/scan` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `CAMERA_FACTORY_SCANNED` (+ `HOST_ALIAS_ADDED`, `HOST_ALIAS_REMOVED`) / `ACCESS_DENIED` | The same row and file; U9 (active scan only). No Core route yet (row 107) |
| 104 | `getHostAlias` | GET | `/api/v1/capture/network/alias` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `NONE-R` / `ACCESS_DENIED` | The same row and file. No Core route yet (row 106) |
| 105 | `removeHostAlias` | POST | `/api/v1/capture/network/alias/remove` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `HOST_ALIAS_REMOVED` (or `HOST_ALIAS_REMOVE_FAILED`) / `ACCESS_DENIED` | The same row and file; C19. No Core route yet (row 106) |
| 106 | `setCameraNetwork` | POST | `/api/v1/capture/network/cameras/address` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `CAMERA_NETWORK_SET` (+ the alias rows; + `CAPTURE_DEVICE_ADDRESS_CHANGED` for a registered camera) / `ACCESS_DENIED` | The same row and file; the fourth credential-carrying operation, typed for one job and never stored (C1, C7). No Core route yet (row 111) |
| 107 | `getCameraNetworkJob` | GET | `/api/v1/capture/network/jobs/{id}` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `NONE-R` / `ACCESS_DENIED` | The same row and file. No Core route yet (row 111) |
| 108 | `testCaptureDeviceConnection` | POST | `/api/v1/capture/devices/{id}/test` | Device | simulated | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` (**web console only**) | `CAPTURE_DEVICE_CONNECTION_TESTED` (+ the reader's `CAPTURE_CREDENTIAL_REVEALED`) / `ACCESS_DENIED` | Added by task 4 (`docs/2026-10-12_input_av_core_adapter_plan`, row V3, the third contract step; blueprint row 146): the connection test of a registered camera with its STORED credential; no body; C58, C62; AD-03 (5), AD-02 (1). Contract: `packages/shared/src/api/capture-discovery.ts`, last section. No Core route yet (row 146b) |
| 109 | `acceptInstallation` | POST | `/api/v1/installation/acceptance` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `INSTALLATION_ACCEPTED` / `ACCESS_DENIED` | Added by task 4 (`docs/2026-10-12_input_av_core_adapter_plan`, blueprint row 116, WP-26b): the acceptance of the installation, stored in `installation_acceptances` (schema set C; at most one in force); decisions U10, U11, C2; S13-13. Idle only; recording is not gated on it. Contract: `packages/shared/src/api/installation-acceptance.ts`. No Core route yet (row 117) |
| 110 | `revokeInstallationAcceptance` | POST | `/api/v1/installation/acceptance/revoke` | Device | simulated | `PERMISSION CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (**TECHNICIAN only, web console only**) | `INSTALLATION_ACCEPTANCE_REVOKED` / `ACCESS_DENIED` | The same row and file: the revocation of the acceptance in force, with a reason; no id in the body. No Core route yet (row 117) |

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
| 95 | `CaptureConnectionTestRequest { credential?: { username: text 1..255, secret: text 1..1024 } }` **Erratum PE-FM4-01 (decisions D117, D178; review row 69, finding R69-11): the bound of the camera user name is 1..120, not 1..255** - the bound of the stored column (`capture_device_credentials_username_check`), of the shared constant `CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH` and of the request schema of operations 89, 95 and 96; a longer name is `422 INVALID_INPUT` before any network request. — **erratum PE-128-27 (D86 SEC35-35):** `username`: 1..255 printable ASCII without `<`, `>`, `&`, `"`, `'`, backslash; `secret`: 1..1024 printable ASCII; anything else is `422 INVALID_INPUT` before any network request (limit of this phase: a camera with a non-ASCII password cannot be tested). The same rule applies to the body of operation 89 and to the `credential` member of operation 96. **The target is the candidate in the path and nothing else: the body has no address, host, port, URL, path or profile member** (R-9 AC-10). `credential` is **required** for a candidate of `sourceClass: PRODUCTION` and optional for `DEVELOPMENT` (loopback fixture candidates). Both fields are write-only and live in the request scope only (rule "Credential in memory") | `200 CaptureConnectionTest { candidateId, outcome: 'REACHABLE'\|'AUTHENTICATION_FAILED'\|'WRONG_PROFILE'\|'NOT_H264'\|'UNREACHABLE', authenticated: boolean, testedAt: epochMs, usableProfileCount: number, failedAttemptsRemaining: number }`. **A failed test is a `200` result, not an HTTP error** (the op 92 idiom). `authenticated` says whether a credential was supplied — a fact, never a value. No device error text, no URL, no credential member | none | 400 `INVALID_JSON`; 401; 403 `NOT_PERMITTED` (role, or `WEB_CONSOLE_ONLY`); **404 `NOT_FOUND`** (the id is unknown, expired, or belongs to another session's search — one answer for all three); **409 `CAPTURE_CONFIG_LOCKED`** (a session is open; no audit row, SEC35-19); **409 `INVALID_STATE`** (`CANDIDATE_ALREADY_REGISTERED`, `CANDIDATE_NOT_TESTABLE`, `CONNECTION_TEST_IN_PROGRESS`); **422 `INVALID_INPUT`** (`CREDENTIAL_REQUIRED`; schema); **429 `RATE_LIMITED`** (`CONNECTION_TEST_RATE_LIMITED`, `CONNECTION_TEST_LOCKOUT_GUARD`; `retry-after`); 503 `NOT_READY` (`DISCOVERY_NOT_READY`). **Every refusal in this cell happens before any network request (0 outbound requests)** |
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
| Microphones | No network microphone discovery and no microphone adoption. Op 97 re-reads the local inputs (`AudioInputAdapter.enumerate()`) and reports each registered microphone as present or not, with the helper's named error for a local device (R-11 AC-5). It registers nothing and never replaces a local device by a fake. **Erratum PE-128-35 (cap §A.6.4 HL-10; D83 OP-125-4):** op 97 reports microphones only. A local camera's named cause reaches the clients as `params.cause` of the situation-B alert of a pre-check (§5.4); no other member carries it (accepted limit). **Erratum PE-WH-01 (decisions D196, D206 (2); gate 70 finding G70-01; wave H driver D and closing pass Z1):** the members `adapter` and `sourceClass` of an entry of `CaptureInputScan.inputs[]` are OPTIONAL and are ABSENT in simulated capture — on a Core whose capture operation is SIMULATED and in the in-app simulator alike. Simulated capture states no adapter and no source class on any operation; a Core in real capture states both on every entry, `sourceClass` derived from `adapter` as for a device (absent exactly when `adapter` is). A client reads an absent `sourceClass` as "not stated", never as `PRODUCTION` | D80(5); OD-06; D80(11); D206 (2) |
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

**Erratum PE-WI-24 (decisions D196, D206 (1) (2), D218; `implementation/137_docs_errata_followup.md`):** the sentence "The simulator's devices carry `adapter: FAKE`, `sourceClass: DEVELOPMENT`" above is
true of two things only and is not general. (1) It HOLDS for what the table names, in the IN-APP simulator: the two search candidates of operation 94 (`simCaptureCandidates()`, adapter `SIM_CAPTURE_ADAPTER = 'FAKE'`,
`sourceClass: DEVELOPMENT`; `packages/shared/src/api/capture-discovery.ts:719-764`) and the device `CAM-03` that operation 96 registers (`sim/capture-registry.ts:72-73`, derived from the adapter;
`sim/api.ts:1420`). (2) It does NOT hold for the other devices: the five built-in devices of the simulator's `captureDevices` (`CAM-01`, `CAM-02`, microphones, PoE) carry neither member
(`packages/shared/src/sim/initial-state.ts:96-154`, `sim/types.ts` `CaptureDeviceStatus.adapter?` / `sourceClass?` "present on a device that operation 96 registered"), and the entries of operation 97 carry neither in
simulated capture (erratum PE-WH-01; `sim/api.ts:1482`). (3) It does NOT describe a Core in SIMULATED capture (the server): by D206 (1) that Core states no adapter and no source class on any operation - operation 93
answers `503` (no camera search, so no candidate exists), operation 94 holds no candidate, and the device reads, slices, alerts and audit rows say nothing of a source
(`apps/core-server/src/modules/devices/__tests__/simulated-no-source-class.db.test.ts`). A client reads an absent `sourceClass` as "not stated", never as `PRODUCTION`. Open, not touched here: lines 586 and 698 of
this file say that in `SIMULATED` "the seeded `FAKE` built-ins are listed as today" (erratum PE-128-25, older than D206); read with this erratum they mean the stored kinds, not a member on the wire.

**Erratum PE-WI-08 (decision D217; re-gate 70 finding G70b-07; fix wave I driver A2, `implementation/132_fix_wave_i_a2.md` section 1 row G70b-07 and decision 7; `delegation_progress/contract_wave_i_a2.md` section 6):** a camera search id is
`DSC-` and a number that GOES ON across restarts of the Core within one database: the first
search of a process reads the highest camera-search number of the stored
`CAPTURE_DISCOVERY_SEARCHED` rows and continues from it
(`apps/core-server/src/modules/capture-discovery/search-ids.ts:21-22`, `:36`). The pattern is
unchanged (`CAPTURE_SEARCH_ID_PATTERN`, §7). A client must not assume that the first search of a
session is `DSC-000001`. Two stated limits: the thirteen-digit ids of the microphone re-read
(operation 97) are made from the clock and are not part of the counter; a search whose window
never closed wrote no row, so its number is given again after a restart (it is then the only one
in the chain with it). No table, column or migration was added.

**Erratum PE-WL-05 (decision D231; re-check 70 notes G70c-04 and G70c-05; fix wave L driver L-S, `implementation/153_fix_wave_l_s.md` rows 6a, 6b; `contract_wave_l.md` section 6; `implementation/165_batch_n_docs.md`) - "A SESSION IS OPEN" IS ONE RULE: THE CAMERA-SEARCH ROWS AND THE BOOT LINE.** Server only; nothing for clients. (1) `CAPTURE_DISCOVERY_SEARCHED` and the other camera-search rows carry `details.sessionId` only while a session is OPEN (stated and not `SEALED`); otherwise the key is absent. Before, the row named the last session also after its seal (`apps/core-server/src/modules/capture-discovery/search.ts:76` `openSessionOf`, the one caller `index.ts:148-149`). (2) The boot log line `CAPTURE_CONFIG_LOADED ... locked` follows the rule operation 76 already answered `captureConfig.locked` with - a session that is not SEALED - and no longer "a session row exists" (`apps/core-server/src/modules/capture-config/store.ts:58-61`). `captureConfig.locked` of operation 76 was right before and is unchanged. Proven by unit test of the statement and the function; the boot line on a database that holds a SEALED session row was not driven by the driver (note 153 open items).

---

## 3. Modified operations (of the existing 75)

Each row: **Before** (current contract) → **After**. `file:line` is the current source. (The
`72/73/74` row covers three operations; the table modifies **24** operations in **22** rows.)

| # | operationId | Before | After | Register row + decision |
|--:|---|---|---|---|
| 39 | `listEvidence` | `EvidenceItem` v1: `tracks` VIDEO-01/02 + AUDIO-01/02 each one file hash; simulated signature | `EvidenceItem` v2: `files[]` (one whole fMP4 per camera, each with stored-bytes + plaintext hashes and a fragment-chain head), `audioSourceIntervals[]`, `transcript` summary; real Ed25519 signature | SH-07, OD-02 L2. `evidence.ts:75` |
| 40 | `getEvidence` | item + `EvidenceMediaRef { source: DEMO_PACKAGE\|NONE, packageSuffix }` | item v2 + `media` gains `source: DEMO_PACKAGE\|LIVE_STREAM\|NONE`; `LIVE_STREAM` means a signed media session (op 88) can play it. **Erratum PE-WH-03** (paragraph below this table): the members as built | SH-07/SH-14, NM-11; OD-02/OD-16. `evidence.ts:85-101` |
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

**Erratum PE-WH-03 (decisions D205, D207, D208; gate 94 findings G94-01, G94-04, G94-05; wave H driver C1 and reconcile pass R, `implementation/127_fix_wave_h_r.md` sections 2 and 3):** operation 40
`getEvidence` as built. The contract (`packages/shared/src/api/evidence.ts`) is the single source
of these names; all members below are optional and additive.
(1) `media`: `source`, `packageSuffix`, and with `LIVE_STREAM` the camera file ids
**`media.fileIds`** (1 or 2; `evidence.ts:106`, `:124`), with `NONE` a code in `media.reason`.
An item with a sealed v2 package in the Core's store answers `LIVE_STREAM` + `fileIds` (or `NONE`
+ reason) - a REAL item and a seed-sealed demonstration item alike (PE-WH-02);
`DEMO_PACKAGE` is for v1 demonstration items only (`apps/core-server/src/modules/evidence/media.ts:31`).
(2) `access`: `play`, **`readTranscript`** (this caller is inside the case scope operations 84 /
86 hold for the item; `evidence.ts:153`) and `export`. A client that reads `readTranscript: false`
does not ask operations 84 / 86, so a page view writes no `ACCESS_DENIED` row.
(3) `exports[]`: only for a caller with `access.export`, the finished exports whose archive lies
in the Core's store, newest first (`exportId`, `jobId`, `kind`, `completedAt`, `exportedBy`,
`archiveBytes`, `archiveSha256?`; `evidence.ts:139-142`, `:162`). Operation 87 answers `archive`
(length and SHA-256 of the archive file) on a COMPLETE job (`evidence.ts:457-460`).
(4) The item: `sealedPackage` (`PRESENT` / `NOT_READABLE`, stated for a package sealed on this
Core - the one test of "sealed here"; never `manifestVersion`), `files`, `interrupted`,
`interruptedCause`, `signature.developmentKey` (`true` / `false` / `null`; `evidence.ts:318`),
`audioSourceIntervals[].sourceClass`, and `transcript` on the body's item.
(5) THE interrupted fact is the item's `interrupted`, which is the sealed manifest's
`timeline.interrupted`. The custody entry `RECORDING_INTERRUPTED` answers only where the member
is absent; if the two ever disagree the manifest wins (D207, D208: the pipeline feeds both from
one value).
(6) Five more `getEvidence` 200 examples beside `productSealed`: `productSealedInterrupted`,
`productSealedOneCamera`, `noMedia`, `outsideCaseScope`, `seedSealedDemo` (`evidence.ts:1000-1062`).
Not in the contract and not sent: `media.files`, `access.transcript`, and `transcript.noSpeech` /
`reason` on operation 40.

**Erratum PE-WK-05 (decisions D221 (3), D224; re-gate 81 finding G81b-06; fix wave K driver S2, `implementation/140_fix_wave_k_s2.md` section 1 row G81b-06; `delegation_progress/contract_wave_k.md` S2 section 1; `implementation/147_docs_errata_wave_k.md`):** the model of a sealed transcript was stated by operation 41 only, so
the sentence of D160 reached no operator. `EvidenceItem` gains the optional member `transcriptModel { name, version, quantisation, modelSha256, reportedByServer, report }` (`packages/shared/src/api/state-slices.ts:712-722`, `:847`; the same members and names as `transcriptModel` of operation 41, so one client type reads
both). It is on `evidence.transcriptModel` of operation 40, on the rows of operation 39 and on the items of the slice `evidence`, for an item whose sealed package lies in this Core's store and whose SIGNED manifest declares a transcript document. It is read from the verifier's own statement
of a manifest whose signature held (`apps/core-server/src/evidence-facts/sealed-facts.ts:62-72`), put on the replicated item by the sealed-facts door (`apps/core-server/src/engine/sealed-facts-doors.ts:141-143`) and laid over operations 39 / 40 (`apps/core-server/src/evidence-facts/index.ts:114`). ABSENT, and then
"not stated" (a client draws nothing and never a default): a v1 or demonstration item without a package here, an item sealed with STT disabled or without a document, a package that cannot be read (`sealedPackage: NOT_READABLE`), a manifest whose signature did not hold. A SERVER backend (D160): `reportedByServer: true`, `name` set,
`version`, `quantisation` and `modelSha256` all `null`; the sentence to show is `report` (the Core's own line: reported by the STT server and not verified by the Core). A LOCAL backend: all four set, `version` being the version the installation DECLARED (PE-D9-01), `reportedByServer: false`. The member is put on an item when its sealed package is read
(at a start of the Core, after a seal, and by operation 40 for an item that carries no sealed facts yet); an item a RUNNING Core had already read gets it at that Core's next start. Not added (no client asked by name): chunk count and language on the item (the language is in operation 84). Examples: `EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE`,
`EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE`. Additive and optional: 97 / 36 / 61 / 67 unchanged.

**Erratum PE-WK-06 (decisions D223, D224; re-gate 94 findings G94b-06, G94b-11, G94b-12; fix wave K driver S2, `implementation/140_fix_wave_k_s2.md` section 1; `delegation_progress/contract_wave_k.md` S2 sections 2 and 3, KR section 3; `implementation/147_docs_errata_wave_k.md`):** two facts the Core states, so that no client infers them.
(1) `EvidenceDetail.exportDestinationDefault?` (operation 40, top level beside `access` and `exports`; `packages/shared/src/api/evidence.ts:164`; set by the handler, `apps/core-server/src/modules/evidence/index.ts:240`; Core server only) is THE text the Core records when an export request names no destination: `Case file transfer` on a Core in its own capture
(`DEFAULT_EXPORT_DESTINATION_REAL`, `packages/shared/src/sim/evidence-actions.ts:56`), `Case file transfer (simulated)` on a Core in simulated capture (`:50`). The mode is asked of the one function `captureOperationOf` (`modules/evidence/index.ts:178-180`). CLIENT RULE: pre-select the destination option whose RECORDED text equals this member, so that web and
mobile offer the same default; absent (the in-app simulator, an older Core) = the client's first option; never another option when the member is present. "Empty destination" on operation 42 means the Core's default: a Core in its own capture hands it in (`modules/evidence/export-request.ts:66-68`); a Core in simulated capture hands the request on unchanged and
the hosted action names the simulator's default itself (`sim/evidence-actions.ts:228-231`), which IS that Core's default.
(2) `EvidenceExportAccepted.archiveOnCore?: boolean` (the `202` of operation 42; `packages/shared/src/api/core-api.ts:582`; `modules/evidence/index.ts:321`): `true` = an export JOB of this Core writes an archive into the Core's store (operation 87 follows it; the sentence "The export is stored on the Core" is the client's, drawn once the job is DONE); `false` = the request was only
recorded - a demonstration item - and NO archive is written (a client draws "Demonstration: no archive is written."); absent (the in-app simulator, an older Core) = not stated, a client claims no stored archive. The Live source hands the member on by that name when the `202` states a boolean (`packages/shared/src/live/source/bindings.ts:264`, `:313-317`).
Examples: `EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE` (also inside `getEvidence.productSealed`), `EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE`. Additive and optional.

**Erratum PE-WK-07 (decisions D222 (6), D224; re-gate 89 finding G89b-06; fix wave K reconcile pass K-R, `implementation/144_fix_wave_k_kr.md` section 1 item 3; `delegation_progress/contract_wave_k.md` S1 section 7 and KR section 1; `implementation/147_docs_errata_wave_k.md`):** operation 41 `files[].plainOk` is a strict boolean and
the Core wrote `false` when check V-05 did not run, so a client drew "decrypted bytes FAIL" beside V-05 "Not run". `files[].plainChecked?: boolean` (`packages/shared/src/api/evidence.ts:278`) is PRESENT AND `false` when the plaintext check did NOT run for THIS file (its stored bytes already failed, the file could not be read, or the key was not available in a run that does
not require it); `plainOk` is then `false` because it is not a pass, NOT because a comparison failed. ABSENT: `plainOk` is the result of the check (`true` PASS; `false` FAIL, either a comparison that failed or a REQUIRED key that is missing, which V-05 then names as a finding of the track). The Core NEVER writes `plainChecked: true`; a reader reads
`row.plainChecked === false` (`apps/core-server/src/evidence-verify/index.ts:221-230`). The member is per FILE, so it is finer than the status of V-05 (V-05 can be FAIL for `VIDEO-01` while `VIDEO-02` was not checked). Stored bytes (V-04) and the chain have no such member: `storedOk` and `chainOk` are always checked when a file row exists.
An older Core answers no member: the client falls back to the state of check V-05 of the SAME result (SKIPPED reads "Not run"), never FAIL from `plainOk: false` alone. Example `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` (two file rows, the second with `plainOk: false, plainChecked: false`). Additive and optional.

**Erratum PE-BN-11 (decision D241, ruling R101-03; final code review `gateway_check/22_final_code_review.md` R101-03; `implementation/164_batch_n_chain_fixes.md` section 5 and section 11 decision 3; `delegation_progress/contract_batch_n.md` E-BN-5; `implementation/166_batch_n_docs_followup.md`) - THE READERS OF A CAMERA-FILE ROW'S PARTS, OF `transcriptModel` AND OF A REVISION'S `reason` ARE ONE SHARED MODULE.** No member, operation or example of the contract changed; what changed is that the web console and the tablet / phone apps no longer read the same members by two different rules. The module is `@dems/shared/evidence-rules` (`packages/shared/src/evidence-rules/index.ts`; the export `./evidence-rules` of `packages/shared/package.json:23`; it imports nothing). (1) `v2FilePartOutcome` (`:67`): one part of a file row of operation 41 - stored bytes (check V-04, `storedOk`), decrypted bytes (V-05, `plainOk`), fragment chain (V-06, `chainOk`) - reads PASS when the answer states it passed; NOT_RUN, never FAIL, when the answer states the check did not run for that part: `files[].plainChecked === false` (erratum PE-WK-07; the decrypted-bytes part only, per file) or that part's check `SKIPPED` in the per-check report of the SAME result; else FAIL. It is never a guess: a result with no per-check report that names the check says nothing about "not run" and the part's flag stands. (2) `readTranscriptModel` (`:110`): the four text members of `transcriptModel` - `name`, `version`, `quantisation`, `report` - are 1 to 256 characters, the contract's bound (`TRANSCRIPT_MODEL_TEXT_MAX`, `:85`; `EvidenceTranscriptModelSchema`, `packages/shared/src/api/evidence.ts:310-318`); `name`, `report` and `reportedByServer` are required, so a `report` longer than 256 makes the WHOLE model read "not stated" (null), while a longer `version` or `quantisation` is null on its own. (3) `readRevisionReason` (`:140`): the revision's `reason` TRIMMED, 1 to 500 characters (`REVISION_REASON_MAX`, `:133`), else "not reported". Behaviour that changed: on the web console a stored-bytes or fragment-chain part whose check was `SKIPPED` read FAIL and now reads "Not run" (the tablet / phone read SKIPPED before); the web bounded `report` at 1,024 characters and the mobile apps at 1,000 (`name` and `version` at 200), `quantisation` at 64 on both - all are now 256, which is stricter for `report`, but the Core's own response schema already refuses a longer line, so a real answer cannot meet the bound; the web showed a revision reason untrimmed. The clients' sentences are the UX spec's (erratum PE-BN-14). Held by `packages/shared/test/evidence-verify.test.ts` (describe "R101-03", 13 tests by the count of note 164, over the contract examples). Not done (note 164): the other duplicated files of the two clients stay per client.

**Erratum PE-WL-04 (decisions D229 (3), D231; re-check 89 finding G89c-04; fix wave L driver L-S, `implementation/153_fix_wave_l_s.md` row 4 and decision 5; `contract_wave_l.md` section 4; `implementation/165_batch_n_docs.md`) - `evidence.files[].profile` AND `evidence.streamProfileNotice`.** Two optional additive members of `EvidenceItem`. (1) `files[].profile?` (string, pattern `[A-Za-z0-9_.-]{1,48}`, for example `H264_720P30`): the manifest's per-track `profile` AS SIGNED (evidence spec field 36, errata PE-WK-16 and PE-WK-47), present exactly with `sealedPackage === 'PRESENT'`; on the replicated item and on operations 39 and 40 (`packages/shared/src/api/state-slices.ts:802-806`). (2) `streamProfileNotice?` (operation 40 only): `{ tracks: [{ trackId: 'VIDEO-01' | 'VIDEO-02', stream, configured }] }` - the notice `STREAM_PROFILE_DIFFERS` of PE-WK-13 for the item's session (`state-slices.ts:851-862`; read by `apps/core-server/src/evidence-facts/index.ts:115` `streamProfileNoticeOf`, attached at `:218-219`). **It is read from the Core's alert list, which holds the newest 100 alerts** (`ALERT_RING_SIZE`, `packages/shared/src/sim/constants.ts:50`): ABSENT means "the Core holds no such notice now", never "was checked and equal" - for an item whose alert left the list the member is absent although the session had the notice; the manifest's own value is always on `files[].profile`. Examples (`@dems/shared/api`): `EVIDENCE_SEALED_PROFILE_EXAMPLE`, `EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE` (`packages/shared/src/api/evidence.ts:1011`, `:1020`). `session.input.profileId` is NOT touched (D224 (5)). Clients draw "Sealed format (signed manifest)" per track and the notice from these two names; an item that states neither draws nothing (notes 154 section 2.4, 155). Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

**Erratum PE-WM-05 (decision D237 (ruling); final re-check 70 finding G70d-03; fix wave M driver M-M, `implementation/160_fix_wave_m_m.md` decision 1; `implementation/165_batch_n_docs.md`) - OPERATION 31 `cancelSession` TAKES NO BODY.** The "Cancel session" control the tablet and the phone gained in wave M (UX spec erratum PE-WM-09) sends operation 31 as it stands: `POST session/{id}/cancel`, no request body, `204`, one `SESSION_CANCELLED` row (`packages/shared/src/api/sessions.ts:353-372`). There is no reason member to send and none was added: a cancelled session is one that never recorded (CREATE, PRECHECK or ARMED), and the ruling of D237 keeps the contract unchanged. Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

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
| `NOT_READY` (503) | gains `details.reason: CAPTURE_NOT_READY` when the capture worker/binary/store is not ready (boot checks). **Erratum PE-113-11 (D68):** three more reason values on the same code, no new code — `TRANSCRIBER_NOT_READY` (op 92: no transcriber probe can run), `CREDENTIAL_STORE_NOT_READY` (op 91: a `SECRET` write while no credential sealer is provided), `STT_CONFIG_NOT_SEEDED` (ops 90-92: the singleton `stt_config` row is missing). **Erratum PE-WI-02 (decisions D216 (4), D217; re-gate 75 finding G75b-01; fix wave I driver A1, `implementation/131_fix_wave_i_a1.md` section 3.1 row 2b and decision 3; `delegation_progress/contract_wave_i.md` section 5):** two more reason values on the same code, on `startSession` of a Core in real capture, no new status or code - `SESSION_KEY_NOT_OF_SESSION` (a session key of an earlier session with this session number is in the Core's key store, so the recording could not be sealed) and `SESSION_KEY_STORE_UNAVAILABLE` (the key store cannot be used). The start is refused BEFORE any recording: nothing was recorded and nothing changed, the session stays ARMED and can be cancelled; a client shows the message as it shows the other refused starts (`apps/core-server/src/sealing-host/index.ts:183-186`, `:582-586`; `apps/core-server/src/sealing-host/session-key.ts:115-123`; `apps/core-server/src/modules/sessions/routes.ts:221`). **Erratum PE-WI-22 (decisions D217, D218; closing pass J item 7, `implementation/135_fix_wave_i_pass_j.md` section 1):** the reason of that refusal is CARRIED to the clients. A `503 NOT_READY` is classified by a client as a Core that is not ready (`packages/shared/src/client/core-client.ts:381`) and used to be worded "The Core server is starting" (web `lib/core-errors.ts:149`); a refused start is not that. The Live source now carries `details.reason` on the rebuilt error (`LiveTransportError.detailReason`, `packages/shared/src/live/errors.ts:52`, `:63`, `:77`; `live/source/rebuild-error.ts:107`), and both start handlers ask the shared reader `startRefusedReasonOf(error)` BEFORE their general presenter (`packages/shared/src/sim/start-refused.ts`: `START_REFUSED_REASONS`, `startRefusedSentenceKey`; web `features/session-new/index.tsx:397`, mobile `features/session-new/use-session-new.ts:205`). Only the two values `SESSION_KEY_NOT_OF_SESSION` and `SESSION_KEY_STORE_UNAVAILABLE` are read; any other 503, and one without a reason, is still "starting". The wording is the clients' (UX spec erratum PE-WI-37). Not changed, same defect (open): `CAPTURE_HELPERS_LEFT` is a `503 NOT_READY` too and is still worded "starting" | all capture ops + boot; 90, 91, 92 | CS-22; `specs B AC-3`; `core-api.ts:185`; `transcription.ts:78-81`; `modules/stt-config/change.ts:57-58,75-79` |
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
| `INVALID_INPUT` | 422 | `DEVELOPMENT_SOURCE_NOT_ALLOWED` | 78, 79 | a `DEVELOPMENT` device named while the development flag is off. **Erratum PE-WI-01 (decisions D215, D217; the pin of D115 (3) moved; re-gate 70 finding G70b-01; fix wave I driver A2, `implementation/132_fix_wave_i_a2.md` section 1 and decision 1; `delegation_progress/contract_wave_i_a2.md` section 3):** this value keeps its meaning, and the same `422 INVALID_INPUT` of operations 78 / 79 (`details: { in: "body", reason, deviceId }`) now states the TRUE reason, one of four: `DEVELOPMENT_SOURCE_NOT_ALLOWED`; `PRODUCTION_SOURCE_NOT_ALLOWED` (a production device named on a Core that runs development sources - it answered the development reason before); `CAPTURE_DEVICE_NOT_SERVED` (the device is registered, but no capture adapter of the running Core serves it); `CAPTURE_DEVICE_CLASS_MISMATCH` (the device is not of the class the line asks for). Source: `CaptureAssignmentRefusal`, `apps/core-server/src/modules/capture-config/routes.ts:79-90`. Any other adapter refusal keeps the adapter layer's own code. A camera adopted through operation 96 is assignable at once, without a restart of the Core |
| `INVALID_INPUT` | 422 | `REVISION_FROM_NOT_CURRENT_TEXT` (**erratum PE-WK-01**; + `details.segmentIndex`, `details.currentRevision`) | 85 | a change's `from` is not the segment's current text (the `to` of the newest revision that changed it, else the sealed text); nothing signed, no revision row, no audit row. A `baseRevision` that is no longer the head stays `409 TRANSCRIPT_REVISION_CONFLICT` and is judged first |
| `RATE_LIMITED` | 429 | `DISCOVERY_RATE_LIMITED`, `CONNECTION_TEST_RATE_LIMITED`, `CONNECTION_TEST_LOCKOUT_GUARD`, `INPUT_RESCAN_RATE_LIMITED` | 93; 95, 96; 95, 96; 97 | over a bound of §7; `retry-after` set; 0 outbound requests; no audit row |
| `NOT_READY` | 503 | `DISCOVERY_NOT_READY` | 93, 95, 96 | no discovery adapter provided, or capture not ready |
| `NOT_READY` | 503 | `CREDENTIAL_STORE_NOT_READY` (existing value, PE-113-11) | now also 89, 96 | a credential would be stored and no sealer is provided (until row 84); nothing stored |
| `NOT_PERMITTED` | 403 | `WEB_CONSOLE_ONLY` | 89, 95, 96 [and 91 by its handler, for a body with `credential`: PE-BN-08] | a device-bound session on a credential-carrying operation (`WEB_CONSOLE_SESSION`); one `ACCESS_DENIED` row |
| `NOT_FOUND` | 404 | — | 95, 96 | candidate id unknown, expired or of another session — one answer, no hint which |

Message rule: the fixed messages of the existing codes are used unchanged; no message quotes a host,
a candidate id the caller did not own, or any part of a credential.

The predecessor's mapping table (`specs §7.2`; `sim/api.ts:481-495`) still governs the
`SimErrorCode → status+code` conversion; the new codes are returned directly by the Core server and
carry no `simCode` except where the simulator emulates them (ops 76-87), where `details.simCode`
repeats the machine code for parity.

**Erratum PE-BN-12 (decision D241, ruling S99-01; security review row 99 finding S99-01, HIGH; `implementation/164_batch_n_chain_fixes.md` section 1; `delegation_progress/contract_batch_n.md` E-BN-1; `implementation/166_batch_n_docs_followup.md`) - THE DEMO-PASSWORD REFUSAL IS A BOOT REFUSAL: NOTHING IN THE API MOVED.** A Core whose capture operation is `REAL_PRODUCTION` does not start while an operator's stored credential still verifies against the published demonstration password of the seed (`DEMO_OPERATOR_PASSWORD`, `packages/shared/src/sim/dataset.ts:153`), or while its operators cannot be read: the boot step `capture.boot` refuses with `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (the rule and its place are erratum PE-BN-13 of the capture architecture spec). It is a refusal of the START, not an `ApiError`: a Core that refused has opened no listener, so no operation answers it, and no error code, `details.reason`, audit type, operation or slice was added (97 operations / 36 GET / 61 POST, 67 audit types, 30 slices, schema 6 / `dbc-7`). What the API does NOT state: the sign-in answer carries `demoControls` (`packages/shared/src/api/identity.ts:159`) and nothing about the capture operation, and the health answer (`packages/shared/src/api/health.ts:35-47`) states none either, so no Core-stated fact reaches a signed-out client. The two sign-in cards therefore still print the demonstration password (open; the structural debt R101-01, carried to the next task by D241).

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

**Erratum PE-WH-04 (decision D205; gate 94 finding G94-06; wave H driver C1; request line 10:20:00Z of `delegation_progress/file_requests.md`):** WHEN the row is written, as built. ONE row
per media-session ISSUE - operation 88 commits it before its answer, with `fileId`,
`bytesServed: 0`, `signed: true`, `expiresAt`, so no token exists that the trail does not know of
(SEC35-12; `apps/core-server/src/media-stream/service.ts:314-323`) - plus ONE row of severity
WARNING when serving STOPS on the package itself (a fragment that does not authenticate or cannot
be opened), with `fileId`, `bytesServed`, `rangeStart`, `rangeEnd`, `signed: true`
(`service.ts:344-353`). An answered Range request is a LOG LINE, not an audit row
(`service.ts:341`). A reading of this type as "one row per answered range" is superseded. The key
list below is unchanged (`apps/core-server/src/core/audit-details.ts:280-287`).

| Key | Type | Example |
|---|---|---|
| `fileId` | string, `VIDEO-01`/`VIDEO-02` | `VIDEO-01` |
| `bytesServed` | number | `1048576` |
| `rangeStart`? | number | `0` |
| `rangeEnd`? | number | `1048575` |
| `signed` | boolean, always `true` | `true` |
| `expiresAt`? | number, epoch ms | `1790825000000` |

**Erratum PE-WK-36 (decisions D225 (2), D224; re-gate 94 finding G94b-10; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` section 4 "G94b-10" and section 10 decision 3; `delegation_progress/contract_wave_k.md` Z1 section 2; request line 19:42:01Z of `delegation_progress/file_requests.md`; `implementation/148_docs_errata_wave_k_touchup.md`) - ONE WARNING ROW PER STOP, NOT PER REQUEST THAT STOPS:** erratum PE-WH-04 said ONE WARNING row when serving stops on the package; as built that held per REQUEST that stops, and one tamper stop on the tablet was 8 refused requests (the native player repeats a failed load three times before it reports an error, and the app's own renewal then asked the same place again). Since closing pass K-Z1 the row is written ONCE per (operator, sign-in session, item as sealed - its `manifestSha256` -, file, fragment, code) within `EVIDENCE_MEDIA_SESSION_TTL_MS` = 60 s from the row (`apps/core-server/src/media-stream/service.ts:376-401`, the key at `:377`; the window `packages/shared/src/api/capture.ts:107`). A repeat of the same stop - a player's own retries, the web player's integrity probe (by the rule; not driven in a real browser), a media session renewed at the same place - is refused exactly as the first (the same cut, or the same `409 MEDIA_NOT_AVAILABLE` / `FRAGMENT_NOT_AUTHENTIC`) and is a `warn` log line with `repeated: true`, no audit row (`:380-383`). The key holds IDs and codes, never a token, so a renewed media session at the same place is the SAME stop; another operator or sign-in session, another fragment or file, and a playback after the 60 s are each their own row. The memory is the process's: at most `MEDIA_STOP_MEMORY_ENTRIES` = 256 stops, the oldest dropped (`:144`, `:396-401`); it is filled only after the row is committed, so a row that could not be written is tried again by the next request (`:395`, `:402-405`); a Core that restarts forgets it and writes the row again - never fewer rows than stops. The key list of the row above is unchanged, and so are the issue row and the rule "an answered range is a log line" of PE-WH-04. On a session of the indexed view (erratum PE-WK-35) the row's `rangeStart` / `rangeEnd` are offsets of the SEALED FILE. Measured by the driver on the tablet against the real Core: 1 row and 4 requests per tamper stop (the cut plus the native player's retries; "one request" is not reachable from app code), rows seq 494 and 507 (note 145 sections 3.5 and 4). PE-WH-04's own line cites have moved with the file: the issue row is committed at `service.ts:346-354`, the stop row at `:385-394`, the Range log line is `:373`. Not yet gate-verified.

**Erratum PE-WL-06 (decisions D230b, D231, D236; re-check 94 finding G94c-01, MAJOR; fix wave L driver L-S, `implementation/153_fix_wave_l_s.md` row 7 and section 2; `contract_wave_l.md` section 7; `implementation/165_batch_n_docs.md`) - THE CUT OF THE MEDIA ROUTE, AND THE 409 AT THE BYTE OF THE CUT.** The Core's side was MEASURED, not changed. A range that reaches a fragment that fails authentication is answered `206` with the full `content-length` and the bytes before that fragment; then the Core DESTROYS the connection - the body never completes, also on a keep-alive connection. The SAME request from the byte of the cut answers the clean `409`: `error.code: 'MEDIA_NOT_AVAILABLE'`, `details { simCode: 'MEDIA_NOT_AVAILABLE', reason: 'FRAGMENT_NOT_AUTHENTIC', fileId, seq }`. The contract now exports that answer: `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` (its `.body` is the body the Core sends, member for member; only `requestId` is the request's own) and the constant `MEDIA_FRAGMENT_NOT_AUTHENTIC_REASON` (`packages/shared/src/api/evidence.ts:1037-1044`); a Core test on a real loopback socket holds the two equal (`apps/core-server/src/modules/media-stream/__tests__/routes.test.ts:608-614`). What the Core cannot do: the status line and the length are on the wire before the failed fragment is read, so there is no further signal without changing the answer. A reader that waits for the END of a cut body can therefore wait for ever behind a proxy that does not pass the close on (the web development origin): the client rule is the bounded probe of UX spec erratum PE-WL-08. Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

**Erratum PE-WM-02 (decisions D236, D237; final re-check 94 finding G94d-02; fix wave M driver M-S, `implementation/158_fix_wave_m_s.md`; `contract_wave_m.md` "M-S 2"; `implementation/165_batch_n_docs.md`) - ONE WARNING ROW PER STOP ALSO UNDER CONCURRENT RANGE REQUESTS.** Extends PE-WK-36; no contract change. A media element asks for two ranges of one file at once and both are cut on the same fragment a few milliseconds apart: each passed the "already known" test before the other's row was written, and one stop left two rows. As built the stop is remembered in the same turn as that test, BEFORE the write is awaited, and forgotten again only when its row could not be written (the next request then writes it): `apps/core-server/src/media-stream/service.ts:377-409`. The later request is a warn log line with `repeated: true` (`:381`). The key is unchanged from PE-WK-36 - operator, sign-in session, item as sealed (evidence id and manifest hash), file, fragment, code (`:377`) - and so is the window: no further row for the same stop within `EVIDENCE_MEDIA_SESSION_TTL_MS` (60 s) of the first, in the same sign-in (`:393`). Pinned by `modules/media-stream/__tests__/indexed-view.test.ts:281`. Gate state: one row per stop was confirmed at the confirmation session (report 14, D239).

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

**Erratum PE-WI-03 (decisions D181 (3), D217; re-gate 70 finding G70b-05; fix wave I driver A2, `implementation/132_fix_wave_i_a2.md` section 1 row G70b-05 and decision 2; `delegation_progress/contract_wave_i_a2.md` section 2):** one more
OPTIONAL key, `reason`, with the one value `SCHEME_NOT_ALLOWED` (the closed code of operation 95's
`reason`). It is present ONLY on the row of a scheme refusal - the camera offered only a sign-in
method the Core does not answer, and the credential was NOT sent - and absent on every other row
(`apps/core-server/src/core/audit-details.ts:347`;
`apps/core-server/src/modules/capture-discovery/connect/service.ts:112-119`). It is an erratum to
the key list pass F-M4 pinned: no other member told a scheme refusal from a first refused
credential (`outcome`, `authenticated: true`, `guardTripped: false` are the same for both). A test
sent without a credential is told by the existing `authenticated: false`. **A scheme refusal does
not count for the lock-out guard** (PE-FM4-03; `connect/limits.ts:185-188`): `failedAttemptsRemaining`
is a required member of operation 95's answer and carries the host's UNCHANGED count, so a client
draws the remaining-attempts line only for `outcome === AUTHENTICATION_FAILED && authenticated ===
true && reason === undefined`. The audit type set stays 67. Example:
`CAPTURE_CONNECTION_TESTED_SCHEME_REFUSAL_EXAMPLE` (`@dems/shared/api`).

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
| `reason`? (**PE-WI-03**) | string, the one value `SCHEME_NOT_ALLOWED`; only on the row of a scheme refusal | `SCHEME_NOT_ALLOWED` |
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
| `RECOVERY_STARTED`/`RECOVERY_COMPLETED` | unchanged; a resumed seal sets `SealingProgress.resumed` (op 83). **Erratum PE-WI-06** (§2.4): on a Core in real capture `resumed` is true only for a run started by a start of the Core or by `recoverSession`. **Erratum PE-WI-19** (§2.4): the retry that `recoverSession` starts for a failed seal writes one `RECOVERY_STARTED` row with `details { reason: SEAL_RETRY, cause, step, faultKind }` and the asking operator as `actorId` | OD-08; `specs E.5`; D217, D218 (4) |
| `CAPTURE_CREDENTIAL_SET` — **erratum PE-121-09** | unchanged keys; `operationId` may now read `adoptCaptureCandidate` (the credential leg of op 96) | D80(7); §2.6 |
| `ACCESS_DENIED` — **erratum PE-121-09** | unchanged keys; `reason` may now name the condition `WEB_CONSOLE_SESSION` (ops 89, 95, 96) [the same reason `WEB_CONSOLE_ONLY` on op 91 for a body with `credential`: PE-BN-08] | D80(3) |
| `FAULT_RAISED` / `FAULT_CLEARED` — **erratum PE-121-09** | for the kind `CAPTURE_FAULT` raised at session start with no camera, the row carries the optional `reason: NO_CAMERA_CONNECTED` and `evidenceFiles: 0` — the one row "stating that nothing was recorded" (R-10 AC-3). **Confidence MEDIUM:** this analyst found the row's composition in the simulator (`packages/shared/src/sim/faults.ts:343,358`) but no entry for it in `SERVER_AUDIT_DETAIL_RULES`; rows 133 / 139 check where the key list lives before adding the two keys | D72(k), D72(h); R-10 AC-3 |
| `SYSTEM_BOOT` (existing type) — **erratum PE-128-37** | gains the key `captureOperation`: `SIMULATED` \| `REAL_PRODUCTION` \| `REAL_DEVELOPMENT`; one row per boot. No new audit type: the total stays 67 | D86 (SEC35-41 (b)) |
| `PRECHECK_BLOCKED` — **erratum PE-121-09** | unchanged type; written as today when both cameras or both microphones are unreachable (§3.1) | D80(6) |
| `SESSION_CREATED`, `PRECHECK_PASSED`, `PRECHECK_BLOCKED`, `RECORDING_STARTED`, `RECORDING_STOPPED`, `SESSION_CANCELLED` — **erratum PE-WI-04** | unchanged keys. When a PAIRED DEVICE sent the action, the row carries that device's id in the row's own `deviceId` member (as `AUDIO_SOURCE_SWITCHED` does); no `details` key was added and `sendingDeviceId` stays a detail key of the switch row only. A row of an action sent from the web console keeps `deviceId: null`. The pre-check rows are written later, on an engine tick, and take the device from `session.precheck.sendingDeviceId` (§6, PE-WI-05). The simulator inside an app (the device console) is unchanged: its session rows name no device. Source: `packages/shared/src/sim/session-machine.ts:344`, `:621`, `:683`, `:809`, `:855`, `:909`, `:998`; `implementation/132_fix_wave_i_a2.md` section 1 row G75b-04 and decisions 3, 5 | D216 (2), D217; re-gate 75 finding G75b-04 |
| `FAULT_RAISED`, `TABLET_LINK_CHANGED`, `RECOVERY_STARTED` at a start of the Core — **erratum PE-WI-09** | Real capture only; the SIMULATED lane is unchanged. A session that was FINALIZING when the Core stopped is NOT faulted at the next start: no `FAULT_RAISED` "Power fail detected", no `RECOVERY_STARTED { faultKind: POWER_FAIL }`, no alert; the session stays FINALIZING and its seal resumes. No `TABLET_LINK_CHANGED` "Tablet control offline - recording continues" row is written at any start of a real-capture Core: the link reads OFFLINE in the state, and "Tablet control connected" is written when a device connects (`apps/core-server/src/engine/rehydrate.ts:255`, `:269`, `:345-357`, `:375`). **LIMIT, not built:** a real-capture Core stopped while its session was PRECHECK, ARMED, RECORDING or STOPPING still gets the restart fault of kind `POWER_FAIL` at the next start. Ruling D217 (5): no new reason code now; a `CORE_STOPPED` cause is listed for the next task (`implementation/132_fix_wave_i_a2.md` section 4) | D216 (3), D217 (5); re-gate 75 finding G75b-03 |
| `FAULT_RAISED`, `FAULT_CLEARED`, `SYSTEM_BOOT` of the restart fault — **erratum PE-WI-21** | When the fault is the restart fault of a Core in its own capture, the three rows carry the optional detail key `coreNotRunning: true` (`FAULT_RAISED` and `FAULT_CLEARED` beside `kind`, `evt`, `target`; `SYSTEM_BOOT` beside `afterFault: POWER_FAIL`), and their `message` says the Core was not running (§6). `kind` stays `POWER_FAIL`; no new reason code, no new audit type. Absent: the row is what it was | D217 (5), D218; closing pass J |
| `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED` of the SIMULATED stream — **erratum PE-WI-23** | The simulator (the in-app one and a SIMULATED Core's hosted one) runs its recording integrity stream from the accepted start. While the start is not decided (`session.captureDurable === false`, the simulator's connecting time) its arrivals are HELD: schedule and random draws are unchanged and each row is written at its own scheduled time once the start is durable; a start that fails drops them, so a failed start has none of these rows. A start that happened has the same rows as before; only a row that fell inside the connecting second can sit up to that second later in the chain. A Core in its own capture writes none of them at all (wave H, G75-01) | D217, D218; `packages/shared/src/sim/generator.ts:247-252`; closing pass J item 5 (G75b-10) |
| `EVIDENCE_VERIFIED`, `EVIDENCE_VERIFY_FAILED` — **erratum PE-WK-08** | Both rows carry `details.operationId` (`verifyEvidence`): the Core's verification of a sealed package writes it (`apps/core-server/src/sealing-host/index.ts:737`), so does the hosted verify of a demonstration item and the in-app simulator's own row (`packages/shared/src/sim/evidence-actions.ts:121`; one detail key more on the simulator's rows). The FAILED row of a SEALED package names the fragment and not only the file: `details.failedFragments` (the fragments whose stored bytes did not verify, `<trackId>:<seq>`, comma-joined, at most 8, `VERIFY_ROW_MAX_FRAGMENTS`) and `details.failedFragmentCount` (how many there were); both only when there is at least one (`packages/shared/src/sim/session-machine.ts:1618-1622`, `:1639`, `:1659-1660`; the list is built from the verdict record, `apps/core-server/src/evidence-verify/index.ts:103`, `:364`). `failedFragmentCount` is also a member of the op 41 result (`packages/shared/src/api/evidence.ts:308`); the audit key is its own copy of it. Both rows also carry the sending device by the rule of the next row (the verdict of a sealed package is written by an INTERNAL action with nobody in `auth`, so the Core hands the device in: `sealing-host/index.ts:733-738`). Keys are names and numbers, never values. No new audit type | D216 (2), D222 (3), D224; re-gate 89 finding G89b-04 |
| EVERY audit row a hosted action writes for the acting operator — **erratum PE-WK-09** (extends PE-WI-04) | Wave I named six session rows one by one; since wave K the rule is held where every row of a hosted action is written. When the acting identity holds a paired device (`auth.deviceId`, set by the Core for exactly ONE hosted command of a device session: `apps/core-server/src/engine/actor-scope.ts:27-41`), the row's actor is that identity, and the row names no device of its own, the row's `deviceId` is the paired device (`packages/shared/src/sim/events.ts:255`, `:274-281`, called by `appendActivity` at `:297`). No `details` key. Row types that now name the sender (sweep of `implementation/140_fix_wave_k_s2.md` section 2): the six session rows of PE-WI-04; `SUMMARY_ACKNOWLEDGED`; the `RECOVERY_STARTED` of the operator's `recover` (its `SYSTEM_BOOT` row keeps the Core's own device); `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` of a demonstration item and of a sealed package; `EVIDENCE_EXPORTED` (also the DEFERRED request of a job) and the `EXPORT_DENIED` of the hosted action; and every other row a hosted action writes with the operator as actor (the shared test drives marker, note, snapshot, archive, audit export and alert acknowledge from a device and asserts that every row names it; actions not driven by a case are covered by the rule). Rows that already named the sender: `AUDIO_SOURCE_SWITCHED`, sign-in / sign-out / lock-out / biometric and pairing rows, the `ACCESS_DENIED` of the permission guard, of the transcript case scope and of the media unit, the `EXPORT_DENIED` and download rows of the export service, `TRANSCRIPT_REVISED`, `STT_CONFIG_CHANGED`, `ROLE_CHANGED` / `USER_*`, `CAPTURE_DISCOVERY_SEARCHED` and the camera connect / adopt / credential rows. STATED EXCEPTIONS: a row with a device of its own is never overwritten, so a device-command row (`DEVICE_COMMAND`) that names the camera or microphone it is ABOUT does NOT name its sender (one column, two meanings), and the capture-selector rows keep `details.sendingDeviceId` as wave H wrote it; rows without an actor or of another actor (engine-timed rows: `PRECHECK_*` on a tick takes the pre-check's device, seal, fault and boot rows; `EVIDENCE_EXPORT_FAILED` of a job) name nobody because nobody sent them; every row of a web console session keeps `deviceId: null`; the simulator inside an app has no device in `auth`, so its rows are unchanged. The demo reset rows are the next row | D216 (2), D222 (3), D224; findings G89b-04, G94b-03, G75c-09 |
| `ACCESS_DENIED` of a refused demo reset / scenario load (`RESET_BLOCKED_REAL_EVIDENCE`) — **erratum PE-WK-10** | The row carries the paired device that sent the request: `null` for a web console session, as before (`apps/core-server/src/modules/demo/host.ts:91-100`, `reset.ts:137`, `:169`, `:332`, `modules/demo/index.ts:133-135`, `:187`, `:220`). The server does not refuse a device for these two operations (the access rule asks the permission `DEMO_CONTROL` and the demo flag, not the kind of session); the mobile app offers no control for them. LIMIT, not built: the LINEAGE row of a reset (`audit_chain_history`, `apps/core-server/src/db/reset/kept-tables.ts:185-189`) has no device column, so it names none, and the `SCENARIO_LOADED` row a reset that RAN writes into the new database carries none either; a device on them needs a migration or a line in `src/db/reset` (`implementation/144_fix_wave_k_kr.md` item 4 and decision 5) | D216 (2), D224 |
| `FAULT_CLEARED` of the restart fault — **erratum PE-WK-11** (§6) | ONE row when the session the restart fault was raised for is sealed or closed, and one at the start of a Core whose database holds a fault that is stuck; `details { kind: POWER_FAIL, evt, target: null, coreNotRunning: true }` and the message "The Core is running again — the fault of the time it was not running is cleared" | D220, D224 |

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

**Erratum PE-WK-13 (decisions D222 (2), D224; re-gate 89 finding G89b-01; fix wave K driver S1, `implementation/139_fix_wave_k_s1.md` section 1 row 3; `delegation_progress/contract_wave_k.md` S1 section 3 and KR section 4; `implementation/147_docs_errata_wave_k.md`):** the notice `STREAM_PROFILE_DIFFERS`. No alert kind, no
fault kind and no audit type was added. When the seal reads a session whose camera file shows a recorded stream that is not the profile the selector configured (evidence package spec, erratum PE-WK-16), the session carries ONE alert: `severity: WARNING`, `kind: SYSTEM`, `target: <sessionId>`, `active: false` with `resolvedAt` set (a notice: nothing is to be done and nothing
ends it, so it never holds Home at "attention needed"), `params { reason: 'STREAM_PROFILE_DIFFERS', sessionId, tracks: 'VIDEO-01:<stream>:<configured>[,VIDEO-02:...]' }` and the message "The recorded video is not the configured profile: VIDEO-01 is H264_720P30 (configured H264_1080P25). The evidence manifest states the recorded stream."
(`apps/core-server/src/engine/sealing-notice-doors.ts:40`, `:160-183`). It is written once per session (a second call for the same session returns the state unchanged, `:169`), WITHOUT an audit row (a `FAULT_RAISED` with no `FAULT_CLEARED` would be drawn as a fault), and raised when the seal READS the session (`apps/core-server/src/sealing-host/index.ts:274-290`), not while recording;
the same difference is one warn line `SEALING_STREAM_PROFILE_DIFFERS` in the log. CLIENT RULE (the manifest is the statement): a label of the RECORDING's picture ("1080p - 25 fps", "Recording Profile") on an item or a session whose alert list holds this notice must not state the configured profile as a fact of the recording; `session.input.profileId` (`STANDARD_1080P25`, a closed
set of one, a different member from field 36) and `captureConfig.cameras[].profile` are what was CONFIGURED and are not changed by this notice (`implementation/144_fix_wave_k_kr.md` decision 3: changing `profileId` needs a new value of a closed set, a migration, and is left for the next task). On a development-capture Core the notice does not fire for the generated sources: the selector line of a FAKE camera states its adapter's profile from a development start on (capture architecture spec, erratum PE-WK-15); a selector an operator sets to another
profile still gets the stream in the manifest and the notice, and sessions sealed before that start keep their notice.

**Erratum PE-WL-01 (decisions D228 (2), D231; re-check 75 finding G75d-01; fix wave L driver L-S, `implementation/153_fix_wave_l_s.md` rows 1a-1c; `delegation_progress/contract_wave_l.md` section 1; `implementation/165_batch_n_docs.md`) - THE LIFE OF THE UNSEALABLE NOTICE; OPERATION 70 ENDS IT.** The alert a session leaves when it ends UNSEALABLE (`kind: SYSTEM`, `severity: CRITICAL`, `target` = the session id, `params { reason: 'UNSEALABLE', sessionId, cause }`) is an OPEN NOTICE of ITS session only. It stays `active` through later sealed sessions and through every restart of the Core (it is a stored row), and it blocks nothing: the Core records the next session at once. It ends in ONE way: operation 70 `acknowledgeAlert` (no new operation) sent by an operator whose role holds `UNSEALABLE_ACKNOWLEDGE_PERMISSION` = `Permission.EVIDENCE_REVIEW` (`packages/shared/src/sim/seal-unsealable.ts:130`; SUPERVISOR today). That call sets `acknowledged: true`, `active: false`, `resolvedAt` = the Core instant - also for a notice another role had acknowledged before - and writes ONE audit row `FAULT_CLEARED` (no new type), `sessionId` = the session of the NOTICE (never the session that is open at that moment), actor = the operator, `deviceId` by the sending-device rule of PE-WK-09, `details { reason: 'UNSEALABLE', cause, alertId, operationId: 'acknowledgeAlert' }`; no timeline event is written (`packages/shared/src/sim/faults.ts:575-600`). The registry entry of operation 70 lists the row under `also` and keeps `success: none (parity)`; the answer is `204` in every case (`packages/shared/src/api/alerts.ts:89`, `:101`). An acknowledgement by a role WITHOUT that permission is what it was: `acknowledged: true`, the alert stays `active`, NO audit row (one info log line). **Known gap (G75e-07; D237; `contract_wave_m.md` "M-S 4"): none of the 67 audit types fits an acknowledgement that closes nothing, so that act is in no audit trail; a 68th type is for the next task.** Client rule, by the names of `@dems/shared/sim`: `openUnsealableNoticesOf(state)` is the ONE fact for "an open notice that does not block recording" (`seal-unsealable.ts:102`); `alertBlocksRecording(alert)` answers `false` for this notice, `true` for an active `SEAL_BLOCKED` alert and `null` for every other alert (`:123-127`); an alert for which it answers `false` is never drawn as a fault, an attention state or a banner reason of ANY session, and an alert that names a session (`params.sessionId`) counts only for that session; `canResolveUnsealable(role)` tells a client whose acknowledgement closes the notice (`:133`). Examples: `SEAL_UNSEALABLE_EXAMPLE_ALERT`, `SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED`. Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`. Gate state: the acknowledgement and its row were confirmed live at final re-check 75 (`gateway_check/10e_m5_final.md`; D234); the audit-row gap is open (G75e-07).

**Erratum PE-WL-07 (decisions D228 (1), D231; re-check 75 findings G75d-02 and G75d-04; fix wave L driver L-S and closing pass L-Z, `implementation/153_fix_wave_l_s.md` rows 2, 3b, `implementation/156_fix_wave_l_z.md` section 2; `contract_wave_l.md` sections 2, 3 and its L-Z table; `implementation/165_batch_n_docs.md`) - THE SENTENCES OF A SEAL THAT IS RETRIED OR BLOCKED; THE ALERT MESSAGE BOUND IS 600.** No member changed; three texts the Core writes did. (1) While a cause that NO retry gets past is still being retried, the failed step's sentence (`session.finalization.steps[].detail`) states the cause WITHOUT the conclusion ": this session cannot be sealed." (`apps/core-server/src/sealing/pipeline/way-out.ts:92` `sealCauseWithoutConclusion`, used at `:408`); the conclusion is said only at the terminal end, by the notice of PE-WL-01. (2) The END of the failed step's sentence of a BLOCKED seal is `sealStoppedSentence()`: "<cause> Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself." (`packages/shared/src/sim/seal-blocked.ts:72`). (3) The `SEAL_BLOCKED` alert ends its hint with `SEAL_RETRY_HOW_SENTENCE`: `..., then retry the seal: an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console, or the Core is restarted.` (`seal-blocked.ts:62`, `:65`; `way-out.ts:121-141`). An alert STORED before a Core ran this code keeps its old text. The engine door accepts an alert message of at most `SEAL_BLOCKED_MESSAGE_MAX` = 600 characters (was a literal 400; `apps/core-server/src/engine/sealing-notice-doors.ts:123`). A surface that must not print a code draws `SEAL_UNSEALABLE_PLAIN_SENTENCE` and shows `cause` as a detail (`seal-unsealable.ts:46`). Examples changed with the words: `SEAL_BLOCKED_EXAMPLE_ALERT.message`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps[0].detail`. Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

**Erratum PE-WM-01 (decisions D232, D237; final re-check 70 finding G70d-01; fix wave M driver M-S, `implementation/158_fix_wave_m_s.md` section 2; `delegation_progress/contract_wave_m.md` "M-S 1"; `implementation/165_batch_n_docs.md`) - WHAT A CLIENT RECEIVES WHEN A GENERATED SOURCE FAILS ITS PRE-CHECK.** No member was added: wave M built only the way to make a generated source not answer (the source rig, capture spec erratum PE-WM-06); the product's pre-check produced every fact below before. Values for ONE camera of two that does not answer (for example `CAM-05` on `VIDEO-02`), pinned by `apps/core-server/src/capture-notices/__tests__/notices.test.ts:410`, `:469`: (a) the device: `captureDevices.devices[]` `online: false`, written before the checks run; (b) the check row: `session.precheck.items[]` id `LENS_2` (`LENS_1` for `VIDEO-01`), `status: "WARN"`, `value: "UNREACHABLE"`, `params { deviceId, rule: "oneCamera" }`; `session.precheck.outcome: "WARN"`, so the start is allowed after `acknowledgePrecheckWarnings`; (c) the notice (notification B): ONE alert per device per occurrence, `kind: "SYSTEM"`, `severity: "WARNING"`, `active: true`, `target` = the device id, `message: "<deviceId> is not reachable"`, `params { reason: "CAPTURE_DEVICE_UNREACHABLE", deviceId, deviceKind: "CAMERA", phase: "PRECHECK", cause: "UNREACHABLE", searchResponderCount }` - raised when the ONE pre-check search has closed, a moment AFTER the 200 of the pre-check call, so that it carries the count (`searchResponderCount` is absent when no search could run); (d) the audit rows: one `CAPTURE_DISCOVERY_SEARCHED` (`trigger: PRECHECK`) and one `CAPTURE_DEVICE_UNREACHABLE` with `details { deviceId, deviceKind, phase: "PRECHECK", reason: "UNREACHABLE", degraded: true, sessionId }` (`degraded: false` when the start is blocked). The other cases of the start rule (`packages/shared/src/sim/capture-notices.ts:29-33`): both cameras = `LENS_1` and `LENS_2` `BLOCK`, `params.rule: "noCamera"`, outcome `BLOCK`, one `PRECHECK_BLOCKED` row; a STANDBY microphone = item `MIC_STANDBY` `WARN`, `rule: "noStandby"`, alert `deviceKind: "MIC"`, `cause: "DEVICE_NOT_FOUND"`, no search and no count, raised at once; the ACTIVE microphone = item `MIC_PRIMARY` `BLOCK`, `rule: "activeMicrophone"`. **After the source answers again** nothing changes by itself (the Core does not poll its sources): the NEXT pre-check run (`retryPrecheck`, or a new session's `beginPrecheck`) reads `online: true`, the check row `PASS`, and resolves the alert (`active: false`, `resolvedAt` set) with NO audit row for the resolve - 0 banners; between the two the device tile still reads not online. Raise, release, raise again = 2 alerts (the first resolved) and 2 `CAPTURE_DEVICE_UNREACHABLE` rows. The sentence and the choices are the clients' (UX spec §8e and erratum PE-WM-09); the Core sends no sentence beyond `message`. Open observation (V98-08; report `gateway_check/14_wave_m_confirmation.md` section 3): one `GET session/current` at the confirmation session showed the check row without `params`; the schema has the member as optional (`packages/shared/src/api/state-slices.ts:216`) and where the clients read it was not checked then - not closed by this erratum. **[CLOSED by batch N (decision D241, ruling V98-08; `implementation/166_batch_n_docs_followup.md`; `delegation_progress/contract_batch_n.md` E-BN-6; `implementation/164_batch_n_chain_fixes.md` section 7 - no code changed):** the members `reasonCode` and `params { deviceId, rule }` of the check row in (b) are members of the STATE SLICE `session` (topic `state`): `session.precheck.items[]` is `PrecheckItemStateSchema`, which has `reasonCode` and `params` (`packages/shared/src/api/state-slices.ts:210-218`, `params` at `:216`). Operation 27 `GET /api/v1/session/current` answers the design-book item `PrecheckItemSchema` (`packages/shared/src/api/core-api.ts:285-292`): `id`, `status`, `value`, `reason` and nothing else (API-1: the design-book operations keep their response schema). A read of operation 27 that shows no `params` is therefore the contract, not a defect, and both clients read the slice. A test pins both shapes (`packages/shared/test/sim-own-capture.test.ts:370`).] Totals unmoved: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`. Gate state: driven live on tablet and phone by the driver (note 160) and on the web and the tablet (microphone) by the confirmation session (report 14; D239); both cameras unreachable, "Search again" pressed by a holder of `CAPTURE_CONFIG` and a start after the acknowledgement are NOT PROVEN live.

**Erratum PE-WM-03 (decision D237; follow-up M-S2, `implementation/161_fix_wave_m_s2.md`; `contract_wave_m.md` "MS2"; `implementation/165_batch_n_docs.md`) - THE REACHABILITY PROBE IS ASKED AT EVERY USE.** The capture-notices unit kept the first probe it was given: a view of the adapters of the moment it was made. A camera ADOPTED during a run (operation 96) and assigned to a track therefore read `LENS_n` `WARN` / `UNREACHABLE` at the next pre-check - a false notification B - until the Core was restarted. As built the probe source is asked at each pre-check run and at each re-read of the inputs, and its answer is never kept (`apps/core-server/src/capture-notices/index.ts:152-173` `probeNow`; `precheck.ts:123-125`): an adopted camera passes its pre-check on the same Core process. No member, option or audit type changed. Stated beside it (verification finding V98-13, ruled FIX NOW in D241 and owned by the code driver of batch N, not by this erratum): at commit `713d83f` a probe source that THROWS is reported (`CAPTURE_PROBE_SOURCE_FAILED`) and the gate then asks nothing (`precheck.ts:125` `NOT_ASKED`), so that pre-check judges no reachability; a session start without a camera still faults by name. **[SUPERSEDED by batch N: V98-13 is BUILT (decision D241, ruling V98-13; `implementation/166_batch_n_docs_followup.md`; `delegation_progress/contract_batch_n.md` E-BN-4; `implementation/164_batch_n_chain_fixes.md` section 4).** A pre-check whose reachability probe cannot be made (the source of the probe throws) is judged with every configured source NOT REACHABLE: a camera with cause `UNREACHABLE`, a microphone with cause `OPEN_FAILED` - the causes a failed read of that source already has (`apps/core-server/src/capture-notices/precheck.ts:182-184` and `:191-195`); no new cause and no new sentence. The device is stored not online, notification B is raised for it, and the start rule blocks or warns as for any unreachable source. The failure is logged once as `CAPTURE_PRECHECK_PROBE_SOURCE_FAILED` (`PrecheckReportCode.PROBE_SOURCE_FAILED`, `precheck.ts:102`; a log and error-log code only - no alert kind, audit type or member), with the cause; the per-source lines carry a fixed error. Built as: `capture-notices/index.ts:164` `probeOrThrow` is what the gate reads (`:194`); `precheck.ts:150-156` catches the throw and runs with `UNCHECKED_PROBE` (`:126`), whose reads reject. "No adapter is registered" (the source answers none) is unchanged: nothing is asked. Operation 97 is unchanged: its `probeNow` (`index.ts:166-174`) still turns a throwing source into none and the operation answers `503 NOT_READY` (`CAPTURE_NOT_READY`) by name. Held by two tests "V98-13" in `capture-notices/__tests__/notices.test.ts`; a test, not a lane run, and no gate has seen it.] The citations of the first paragraph (`index.ts:152-173`, `precheck.ts:123-125`) are those of `713d83f`; at this tree the probe source is asked in `probeOrThrow` (`index.ts:164`). Gate state: confirmed at the confirmation session (`CAM-06` adopted, put on `VIDEO-02`, the row PASSES with the process id unchanged; report 14, D239).

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

**Erratum PE-WH-05 (decisions D203 (1), D209; gates 75 / 89 findings G75-01, G89-01; closing pass Z1, `implementation/128_fix_wave_h_z1.md` items 1 and 4):** the slice count stays 30; two
existing slices gain one OPTIONAL member each, both in the OpenAPI document.
(1) `session.captureCheckpoints?: { fragments, bytes, lastAt, cameras: [{ deviceId, fragments,
bytes }] }` - what the Core holds of a recording of its OWN capture: the fragment checkpoints the
capture worker reported durable. Not stored; refreshed at most every 5 s of the Core clock and at
the end of the capture; `lastAt` is the Core clock when the checkpoint was heard. ABSENT in
simulated capture, before the first checkpoint and on a session read back after a restart: absent
means "not stated", never 0 (`packages/shared/src/api/state-slices.ts:364-372`). The REST
`Session` does not carry it; the slice does.
(2) `time.hostClock?: true` - present on a Core in its own capture: the time is the host system
clock and there is no time service; `source` is then `RTC`, nothing is locked, no offset is
measured and the history is empty; never GNSS (`state-slices.ts:548-551`). Absent on the simulated
time service. `RECORDING_STARTED.timeSource` follows the slice, and `systemStatus` raises no
`TIME_FALLBACK` for the host clock.
(3) On such a Core the pre-check TIME item is a NOTE, not a warning to acknowledge: `WARN`, value
`HOST_SYSTEM_CLOCK`, the text "Time source: host system clock (no GNSS)", `reasonCode: null`,
`params.rule: TIME_HOST_CLOCK`; it leaves the outcome PASS and needs no acknowledgement
(`packages/shared/src/sim/core-facts.ts:159-163`).

**Erratum PE-BN-10 (decision D241, ruling V98-09; verification finding V98-09; `implementation/164_batch_n_chain_fixes.md` section 7; `delegation_progress/contract_batch_n.md` section 2; `implementation/166_batch_n_docs_followup.md`) - `SESSION_CAPTURE_CHECKPOINTS_EXAMPLE`: THE CONTRACT EXAMPLE OF `session.captureCheckpoints`.** Completes erratum PE-WH-05 (1), which stated the member and no example. Exported from `packages/shared/src/api/state-slices.ts:276`: `fragments: 24`, `bytes: 34000000`, `lastAt: 1790824000000`, two cameras (`CAM-01`: 12 fragments, 20,000,000 bytes; `CAM-02`: 12 fragments, 14,000,000 bytes) - the sum of the cameras is the total, as the Core writes it. A client test imports it and moves `lastAt` to the instant it needs (the rule of D208: the consumer's tests import the contract's examples): `apps/core-web/src/features/session-monitor/__tests__/integrity-facts.test.tsx`, `apps/core-web/src/test/real-core-facts.test.tsx` and `apps/mobile/src/features/session-live/situation-c.test.tsx`. Held against the member's schema by `packages/shared/test/sim-own-capture.test.ts:353`. No member, operation or slice changed.

**Erratum PE-WI-05 (decisions D216 (2), D217; re-gate 75 finding G75b-04; fix wave I driver A2, `implementation/132_fix_wave_i_a2.md` section 1 row G75b-04 and decision 4; `delegation_progress/contract_wave_i_a2.md` section 6):** the open
session gains one OPTIONAL member, `session.precheck.sendingDeviceId?: string` (pattern
`^[A-Z][A-Z0-9-]{1,31}$`, `SENDING_DEVICE_ID_PATTERN`): the paired device that sent this
pre-check; absent when a web console session sent it
(`packages/shared/src/api/state-slices.ts:249`, `:280-284`). It is a member of the stored
pre-check JSON (no migration; OpenAPI +5 lines) and exists so that the engine-timed pre-check row
can name its sender (PE-WI-04). Example: `SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE`
(`state-slices.ts:255`). Contract totals unchanged: 97 operations (36 GET / 61 POST), 67 audit
types, 30 slices.

**Erratum PE-WI-20 (decisions D217 (7), D218; re-gate 75 finding G75b-06; closing pass J, `implementation/135_fix_wave_i_pass_j.md` section 0 and item 1; `implementation/137_docs_errata_followup.md`):** the slice `security`
gains one OPTIONAL member, `security.platformNotReported?: true` (`packages/shared/src/api/state-slices.ts:617`; example `SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE`, `:265`; OpenAPI +5 lines, no migration:
the slice is stored as JSON). Present on a Core in its own capture, it states that this Core reads no TPM, no Secure Boot state and computes no posture: `tpm`, `secureBoot`, `posture` and the `TPM` /
`SECURE_BOOT` entries of `controls` are then NOT readings. **The three required members keep their placeholder values** (`posture: SECURE`, `tpm.ok: true`, `secureBoot: true`): the closed shape
requires a boolean, a boolean and one of three postures, none of which can say "unknown", and a reader that does not know the member would read `false` as "failed". The member IS the statement;
a client reads it BY NAME first (`isPlatformNotReported`, `packages/shared/src/sim/core-facts.ts:183`) and shows "Not reported" (UX spec erratum PE-WI-35). It does not cover `encryption`, `hashAlgorithm`,
`tamper` or the key list. Absent: the simulated device, the SIMULATED Core and the in-app simulator without an external capture (their values are what they show). Who sets it: the Core's engine
start, beside the time block (`apps/core-server/src/engine/host.ts:998-1002`, `platformNotReportedTransition`, `core-facts.ts:188`); the hosted simulator created with an external capture
(`packages/shared/src/sim/engine.ts:233`) and each health tick (`sim/health.ts:196-197`), so every derivation of the slice keeps it. **Readers NOT changed and still fed by the placeholders
(accepted, ruling 1 of D218):** the platform device list entry "TPM" (`packages/shared/src/sim/devices.ts:93`), the maintenance self-test line "TPM 2.0 and Secure Boot OK" (`sim/maintenance.ts:99-102`), and the field `security.tpmOk` of operation `getDeviceStatus`
(`apps/core-server/src/modules/devices/status.ts:271`). Contract totals unchanged.

**Erratum PE-WI-21 (decisions D217 (5), D218; re-gate 75 finding G75b-03; closing pass J, `implementation/135_fix_wave_i_pass_j.md` section 0 and item 2):** the restart fault of a Core in its own capture gains
ONE name, `coreNotRunning?: true`, carried by (1) `session.fault` (`state-slices.ts:342`), (2) an entry of `faults.active[]` (`state-slices.ts:936`), and, in OPEN maps with no schema change, (3) the `params` of the
fault's alert and of its event, (4) the `details` of its `FAULT_RAISED` row and of its `FAULT_CLEARED` row, (5) the `details` of the `SYSTEM_BOOT` row its recovery writes
(`details { afterFault: POWER_FAIL, coreNotRunning: true }`), (6) the `params` of its timeline item (`packages/shared/src/sim/faults.ts:304-327`, `:405-419`, `:531-540`; `sim/session-machine.ts:1666-1680`,
`:1692-1701`). Example `CORE_NOT_RUNNING_FAULT_EXAMPLE` (`state-slices.ts:266`). Meaning: the Core was not running while the session was active and does not know why. **The kind stays
`POWER_FAIL`, `fromState` is unchanged and the fault has no `reason`** (ruling D217 (5): no new cause now); the member rides on `POWER_FAIL` only (a raise of another kind with it throws,
`faults.ts:305`). The Core raises it at the next start when the stopped session was PRECHECK, ARMED, RECORDING or STOPPING (`apps/core-server/src/engine/rehydrate.ts:368`, `coreNotRunningFaultTransition`,
`faults.ts:282-283`); the SIMULATED lane and the in-app simulator raise the power-fail fault as before and carry no member. The `message` of those rows is the sentence "The Core was not running while this session
was active. It does not know why it stopped." (`CORE_NOT_RUNNING_SENTENCE`, `sim/core-not-running.ts`); the recovery's `SYSTEM_BOOT` row says "{product} is running again. It was not running while this session was
active" and the clearing row "The Core is running again - the fault of the time it was not running is cleared". `coreNotRunning` is a MEMBER, not a cause (ruling 3 of D218): a closed session's history
entry still carries `faultKind: POWER_FAIL` with no member (the history is column-mapped, `db/mapping/rows.ts:363`), and an interrupted seal still names `POWER_FAIL`; both go with the cause `CORE_STOPPED`
of the next task. Readers by name: `isCoreNotRunning`, `isCoreNotRunningKind`, `coreNotRunningFaultOf`, `faultKindLabelKey` (`@dems/shared/sim`). Contract totals unchanged: 30 slices, 67 audit types.

**Erratum PE-WK-11 (decisions D220, D224; re-gate 75 finding G75c-01, kept MAJOR by the controller; fix wave K driver S1, `implementation/139_fix_wave_k_s1.md` section 2; `delegation_progress/contract_wave_k.md` S1 section 1; `implementation/147_docs_errata_wave_k.md`) - completes PE-WI-21 with the END of the fault:** PE-WI-21 stated how
the restart fault is raised and worded; nothing ended it (the simulator clears a `POWER_FAIL` only in its hosted action `recover`, which a Core in real capture never takes for a session with a durable recording, and `clearCaptureFaults` clears `MIC_SILENT` / `CAPTURE_FAULT` only), so the alert and `faults.active[]` entry stayed active through the interrupted seal, a new sealed session, an acknowledgement
and a second restart. THE RULE (`apps/core-server/src/engine/restart-fault.ts:52-75`): the fault `POWER_FAIL` with `coreNotRunning: true` (`faults.active[]`, `session.fault`, its alert, its `FAULT_RAISED` row) is active ONLY while the session it was raised for is still open as that faulted session, i.e. `session.fault.coreNotRunning === true` and `session.state` is `FAULT`, `RECOVERY` or `FINALIZING`.
In every other state - the session SEALED (interrupted), closed (ended UNSEALABLE, closed INCOMPLETE), or no session - the fault is cleared with ONE `FAULT_CLEARED` row (`details { kind: POWER_FAIL, evt, target: null, coreNotRunning: true }`, message "The Core is running again — the fault of the time it was not running is cleared", `CORE_NOT_RUNNING_CLEARED_SENTENCE`; `packages/shared/src/sim/faults.ts:531-540`), the entry leaves `faults.active`, and the alert reads
`active: false` with `resolvedAt`. WHERE it runs: in the unit that ends the session (`completeSeal` and `endSessionUnsealable`, `apps/core-server/src/engine/host.ts:1259`, `:1314`, so the clear row commits with the seal / the end), and at every process start after the start's own raise (`engine/rehydrate.ts:381-387`): a database that already holds the stuck fault heals at the NEXT START of its Core with one `FAULT_CLEARED` row
at the start and the alert resolved, with no reset; the engine's start line then says `restartFaultEnded: true`, once (`engine/host.ts:1048`, a boolean). A start with no session open raises nothing and clears nothing; a second start while the faulted session is still open leaves the fault active. The hosted `recover` keeps the simulator's own clear (a session closed INCOMPLETE). `session.fault` of the SEALED session still reads
`{ kind: POWER_FAIL, fromState: RECORDING, coreNotRunning: true }`, and a closed session's history entry and an interrupted seal still name `POWER_FAIL` (PE-WI-21's `CORE_STOPPED` cause is the next task). KNOWN LIMIT: the `FAULT_CLEARED` row carries the `sessionId` of the session that is CURRENT when it is written (`packages/shared/src/sim/faults.ts:524`, `:529-541`); at a seal that is the faulted session, at the heal of a stuck fault it is the Core's current (later,
sealed) session, not the one the fault was raised for; nothing reads it as the fault's session and the extract of a sealed package is not touched. No new member, no new audit type, no schema change.

**Erratum PE-WK-12 (decisions D220, D224; re-gate 75 finding G75c-06; fix wave K driver S1, `implementation/139_fix_wave_k_s1.md` section 1 row 7a; `delegation_progress/contract_wave_k.md` S1 section 6; `implementation/147_docs_errata_wave_k.md`):** the timeline item of a capture fault that does NOT end the session now carries the cause: `params.reason` (a key of
`CAPTURE_FAULT_SENTENCES`: `DEMO_CAPTURE_FAULT`, `WORKER_KILLED`, ...) beside `kind`, `evt`, `target`, `critical: false` (`packages/shared/src/sim/faults.ts:429-436`; absent when the fault names no cause). The sentence on the timeline is CLIENT-DRAWN from that member: a row WITH a reason reads "The demo control raised a capture fault. The recording is not affected." or "The capture worker process was killed.";
only a row WITHOUT one falls back to "The capture stopped unexpectedly ... The recording was interrupted." (web `captureFaultSentence(params.reason, null)`, `apps/core-web/src/features/session-monitor/timeline-panel.tsx:84`; tablet `apps/mobile/src/features/session-live/session-live.math.ts:202` `captureFaultRowDetail`). A web client that meets a Core without the member takes the reason of the `CAPTURE_FAULT` alert raised within 2 s of the row
(`apps/core-web/src/features/session-monitor/sim-adapter.ts:147`). ONE row per interruption: an interrupted capture whose fault the capture side already told the timeline of adds no second row (`packages/shared/src/sim/capture-session.ts:179` `interruptedCaptureTransition`; the web also folds the same fault at the same instant, `sim-adapter.ts:166`). The open map `params` takes the key with no schema change.

**Erratum PE-WM-04 (decisions D234, D237; final re-check 75 finding G75e-03; fix wave M driver M-S, `implementation/158_fix_wave_m_s.md` section 3; `contract_wave_m.md` "M-S 3"; `implementation/165_batch_n_docs.md`) - `CAPTURE_SUPERVISOR_FAULT_OVER` IS AN INFO LINE, NOT A FAULT.** The capture supervisor's own CLEARED of an EARLIER session's fault, arriving after the next session had started, was written by the log listener as an error-level fault line. It is now ONE info log line, code `CAPTURE_SUPERVISOR_FAULT_OVER`, with `faultOfSessionId` and `faultOfCorrelationId` and NO `sessionId` member (`apps/core-server/src/capture/index.ts:135`); nothing is appended to the error log. No state, slice, alert or audit row is involved - before or after: this is a log code, not a member of the contract, and it is stated here so that a reader of a Core log does not take it for a fault of the open session. Gate state: 0 error lines at the confirmation session; the late event itself was not provoked there (verification section 2.1, M5 C3).

**Not built (ruling D217 (6)):** `captureDevices.devices[].checkedAt` - proposed in
`delegation_progress/contract_wave_i_a2.md` section 4 - is NOT a member of this contract; it is
deferred to the next task. `online` / `streamState` of slices 29 / 30 therefore still mean "as
registered" on an idle real-capture Core until the Core reads the device (a pre-check, operation
97, or the telemetry of a recording); the client rule is `masterplan/08_client_ux_spec.md`
erratum PE-WI-15.

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
| `CAPTURE_CONNECTION_TEST_MAX_FAILURES` | `2` | outcomes | number | `AUTHENTICATION_FAILED` per host inside the window below — a conservative default (D86 C-2; see above). **Erratum PE-128-19**. **Erratum PE-FM4-03 (decision D181, ruling 3; review row 69, finding R69-13): the guard counts REJECTED CREDENTIAL-BEARING REQUESTS, not outcomes** — a test that ends `AUTHENTICATION_FAILED` without any request that carried the credential (reason `SCHEME_NOT_ALLOWED`: the camera offered only a sign-in method the Core refuses; or no credential was supplied) is not counted, does not lower `failedAttemptsRemaining`, never sets `guardTripped`, and resets nothing; an adapter that does not report the number of such requests is counted as one per `AUTHENTICATION_FAILED` test |
| `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` | `1_800_000` | ms | number | window of the lock-out guard (30 minutes); counted per Core by host, in memory (a Core restart clears it — accepted, D86 C-2). **Erratum PE-128-19** |
| `CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS` | `5_000` | ms | number | between two local-input re-reads per Core |
| `CAPTURE_CANDIDATE_ID_PATTERN` | `/^CND-[0-9A-F]{12}$/` | — | RegExp | candidate ids (48 random bits) |
| `CAPTURE_SEARCH_ID_PATTERN` | `/^DSC-[0-9]{6,}$/` | — | RegExp | search ids. **Erratum PE-WI-08** (§2.6): the number goes on across restarts of the Core |

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
