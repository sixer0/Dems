---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst
blueprint_row: 34
milestone: M0
class: B (GA:OD-09, OD-10, OD-12, OD-13)
tier: 1
type: mechanism-spec (client UX: web, tablet, phone)
status: draft-for-M0-gate
confidence: >-
  HIGH for the per-flow client states, operation/slice/audit mapping, gate and error behaviour
  (mechanical over masterplan/03_api_contract.md, 05_capture_architecture_spec.md and
  07_transcript_spec.md, decisions D4 and the errata-applied register research/03_analysis.md);
  MEDIUM for the exact sealing step list because masterplan/06_evidence_package_spec.md (row 32) owns
  it and is not yet written (this spec binds to the op-83 step envelope and the SH-01 enum, flagged in
  section 9).
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md
source_phase_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md
source_api_contract: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md
source_capture_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/05_capture_architecture_spec.md
source_transcript_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/07_transcript_spec.md
source_predecessor_drift: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D4, D8, D10, D12; rev 2.3 client delta: D72(k), D73-D78, D80, D81)
last_updated: 2026-10-11 (docs touch-up after closing passes K-Z1 and K-Z2: PE-WK-37 (the tablet / phone scrubber seeks on the indexed view; PE-WK-24 superseded), PE-WK-39 (the media-session renewal rule), PE-WK-40 (action bar "Pause"), PE-WK-41 (stepper badge remount), PE-WK-42 (one WARNING row per tamper stop; PE-WK-23's open part built), PE-WK-43 and PE-WK-44 (web export job sentences; the wizard pre-selects `exportDestinationDefault`), PE-WK-45 (tablet band legend live), PE-WK-46 (correction of PE-WK-26 for the tablet / phone); line cites of PE-WK-22, 23, 24, 25 re-checked; `implementation/148_docs_errata_wave_k_touchup.md`; decisions D225, D224); 2026-10-11 (docs errata pass for fix wave K: PE-WK-21..PE-WK-34 - the seal screens' time-left line, the web player's integrity stop and its probe, the tablet scrubber's no-seek sentence, the export control, the verify "Not run" part, the transcript pane's model block, reason line and per-operator caches, the connecting states on Home, the sweep of simulator constants, reduced motion and the mount-warning limit; `implementation/147_docs_errata_wave_k.md`; decisions D220-D224); 2026-10-10 (docs errata follow-up PE-WI-33..PE-WI-38: the surfaces of closing pass J - blocked seal turns the header critical, "Core was not running", "Not reported" from the Core's own member, mobile Network & Time and web Storage session size, the refused-start sentences, the connect-dialog key; `implementation/137_docs_errata_followup.md`; decisions D217, D218); 2026-10-10 (docs errata pass for fix waves H and I: PE-WH-11..PE-WH-13, PE-WI-10..PE-WI-18, each marked in place and listed in the errata index; `implementation/136_docs_errata_wave_h_i.md`; decisions D196, D203, D205-D210, D216, D217); 2026-10-09 (row-128 spec-gate fix pass PE-128-72..83 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 125, PE-125-01..19: client delta for R-9..R-11 — flows 9-13, gated controls G13-G18, sections 8b-8g, 14, 15; D73-D81); 2026-10-09 (status sweep PE-R8-12..13: §8a Flow 8 CONFIRMED by D24, Q-STT-CFG answer (a); status wording only); 2026-10-08 (RV-SPEC: D19(b) recording-duration refinement; §8a Flow 8 STT configuration added as a proposal, R-8/D20; 2026-10-07 row-35 cross-refs SEC35-12/13)
---

# Client UX Spec — web, tablet and phone (blueprint row 34, M0)

## Errata index (fix passes of 2026-10-10)

> Added on 2026-10-10 by blueprint row 96 (register DOC-02). An index only: no text of this spec was
> changed, and each erratum stays where it stands. It lists the errata paragraphs the review-fix
> passes of 2026-10-10 added to THIS file (commit `f293221`). Errata of earlier passes (`PE-12x-…`,
> `PE-R8-…` and others) are marked inline as before and are not repeated here. Decision numbers
> refer to `decisions/decisions.md`.

| Erratum | Where | What it changes, in one line | Decision |
|---|---|---|---|
| PE-FM4-01 | §8d.3 The password prompt, row Fields | The bound of the camera user name is 1..120, not 1..255 | D117, D178 |
| PE-FM4-02 | §8d.3 The password prompt, row Fields | The two credential fields are plain uncontrolled inputs with the kit's field classes, not the kit `TextField` | D134, D178 |
| PE-WI-10 | §4.5 Error / empty / loading states (flow 3) | A seal that is retried or blocked: the web seal dialog, the tablet / phone Finalizing screen, Home / Sessions "Sealing blocked"; every such surface can be left | D216, D217 |
| PE-WI-14 | §4.5 (flow 3) | The web header's critical sentence names the kind of the critical fault; "An integrity check failed" stays for the audit chain and the security platform | D217 |
| PE-WI-11 | §5.5 (flow 4) | "Resumed after restart" is never derived from `attempt`; it is not shown beside a session of the Core's own capture | D217 |
| PE-WH-13 | §6.6 Per-client definition (flow 5) | The web item page lists the finished exports, each with "Download export"; the player source is decided by one rule per app | D204, D205, D208 |
| PE-WH-11 | §8.5 (flow 7) | A Core in its own capture: the pre-check TIME item is a note with its own chip; time chips read "Host system clock" | D203 (1), D209, D210 |
| PE-WI-16 | §8.5 (flow 7) | Host-clock and "not reported" wording on the web Dashboard, Network & Time and header checklist and on the mobile Home chip | D217 |
| PE-WI-18 | §8.5 (flow 7) | Still loaders (no kit Spinner) on the pre-check rows, the pending Next / Start / "Run checks again" and the Stepper's running badge | D207, D217 (2) |
| PE-WI-12 | §8d.3 row "Development source"; §14.2 key `common.captureConnect.noPasswordNeeded` | The development-source sentence of the connect dialog | D215, D217 |
| PE-WI-13 | §8d.4 row `AUTHENTICATION_FAILED` | The result of a test sent without a credential; the remaining-attempts line only for a refused credential | D181 (3), D217 |
| PE-WH-12 | §8f.2 | "No preview" in real capture: camera tiles and session rows show no stock picture | D196, D206, D210 |
| PE-WI-17 | §8f.2 | "No preview" also on the tablet / phone Home "Recent Sessions" in real capture | D217 |
| PE-WI-15 | §8f.2 | The state words of a source on a real-capture Core: "Reachable" / "Not reachable"; "Stream live" only while a session is RECORDING | D217 (6) |
| PE-WI-33 | §4.5 (flow 3) | A blocked seal turns the web header pill and the tablet / phone Home status CRITICAL by the Core's own alert; the pill's second line reads "Sealing is blocked"; removes the limit stated in PE-WI-14 | D217, D218 |
| PE-WI-34 | §8.5 (flow 7) | "Core was not running" and its sentence wherever the restart fault of a Core in its own capture is named, on the web and on the tablet / phone, from the member `coreNotRunning` | D217 (5), D218 |
| PE-WI-35 | §8.5 (flow 7) | "Not reported" for TPM, Secure Boot and posture is worded from the Core's member `security.platformNotReported`, on the web Dashboard, Security & Audit, About and header, and the mobile Home chip and About; replaces the client-side rule of PE-WI-16 | D217 (7), D218 |
| PE-WI-36 | §8.5 (flow 7) | Mobile Network & Time names a host clock as "Host system clock" (no "RTC (holdover)"); the web Storage page's session size is the durable bytes of the capture checkpoints; closes the two OPEN clauses of PE-WI-16 | D217, D218 |
| PE-WI-37 | §8.5 (flow 7) | A start the Core refuses for the session key shows the Core's own two sentences under the start-failed title on web and mobile, not "The Core server is starting" | D217, D218 |
| PE-WI-38 | §8d.3 row "Development source"; §14.2 key `common.captureConnect.noPasswordNeeded` | The shared key now holds the ruled sentence (equal to the web hint, `i18n-web.ts:76`); closes the open clause of PE-WI-12 | D217 (4), D218 |
| PE-WK-21 | §4.5 (flow 3) | No "about N s left" line unless the Core states a measured `etaMs` (null draws nothing, not "Estimating the time left"); while an interrupted recording is still being sealed the screens say it is being sealed, "Sealed — recording was interrupted" only once SEALED | D220, D224 |
| PE-WK-22 | §6.6 (flow 5) | The web player asks the media route about a file that shows no life, stops a file that does not authenticate with the Core's own file and fragment, says so, and the other file plays on | D221, D223, D224 |
| PE-WK-23 | §6.6 (flow 5) | The integrity probe is a range request the Core records: the stop of one tampered file leaves more audit rows than one; the tablet's four-row stop and the once-per-fragment proposal were open - BUILT, see PE-WK-42 | D223 (2), D224, D225 |
| PE-WK-24 | §6.6 (flow 5) | Tablet / phone: on a stream with no seek index the scrubber is disabled and says "A position cannot be chosen: ..."; SUPERSEDED by PE-WK-37 (the indexed view has landed); holds only for a session whose answer states no index | D224 (1), D225 (1) |
| PE-WK-25 | §6.6 (flow 5) | Tablet / phone export follows the web wizard's rule: Export disabled with "Export requires the Supervisor role." where the Core refused; opening the wizard sends nothing; the explicit "Request authorization" press stays; the Core's default destination; the archive sentence | D223 (1), D224 (4) |
| PE-WK-26 | §6.6 (flow 5), step 6 of §6.2 | A verify file row reads "decrypted bytes Not run" (not FAIL) for a check that did not run (`plainChecked: false`, else check V-05 SKIPPED) | D222 (6), D224 |
| PE-WK-27 | §6.6 (flow 5) | The web player before Verify: development marks from the item, the first interval at 0:00, a sentence at the end of an interrupted recording; the tablet's band legend and end sentence are not live | D224 |
| PE-WK-28 | §7.4 (flow 6) | Tablet / phone: every cached read that depends on the operator carries the operator in its key and is dropped at an operator change or sign-out | D221 (3), D224 |
| PE-WK-29 | §7.5 (flow 6) | The revision "Reason" line from the revision's own `reason` (web fallback: the audit row, else "Reason: not reported"); a case-scope refusal reads "You are not assigned to the case of this item ..." on the tablet / phone | D221 (3), D224 |
| PE-WK-30 | §7.6 (flow 6) | The "Transcript model" block on web and tablet / phone from `transcriptModel`; a server backend shows the name and the Core's report sentence only | D221 (3), D224 |
| PE-WK-31 | §8.5 (flow 7) | Connecting states on tablet / phone Home: header chip CONNECTING, mic tiles without meters, "Connecting cameras…" on the no-preview tile, a fixed slot for the Session Live clock | D220, D224 |
| PE-WK-32 | §8.5 (flow 7) | The sweep of simulator constants on a Core in its own capture, page by page (web) and on tablet / phone Storage, About and Session Live; the signing key a page names; the configured-profile label; the appliance model left as is | D220, D222 (1) (2), D224 (3) |
| PE-WK-33 | §8.5 (flow 7) | Reduced motion is no pane re-flow animation (tablet / phone); a reduced layout transition left a grown pane with its old height and dead taps | D224 |
| PE-WK-34 | §8.5 (flow 7) | The mount-warning limit: B9 counts the app's ERROR lines; the library's `synchronouslyUpdateUIProps failed` warning is a documented limit with its cause and a listed cure | D224 (2) |
| PE-WK-37 | §6.6 (flow 5) | Tablet / phone: the scrubber SEEKS on the indexed view the Core now serves (`seekIndex`); PE-WK-24's sentence and disabled scrubber remain only for a session whose answer states no index; the position is kept across a renewal of a session of the view; proven on the tablet, not on the phone | D224 (1), D225 (1) |
| PE-WK-39 | §6.6 (flow 5) | A media session is renewed on demand (Play, seek) when it is at its end, and after a player error ONLY then; a player error on a live session STOPS with its position and "Open again" (replaces wave H's "renew once after a player error"); after a renewal the player resumes at the playhead | D225 (1), D224 |
| PE-WK-40 | §6.6 (flow 5) | Tablet / phone: the item's action bar reads "Pause" while the sealed player plays, and pauses it | D225, D224 |
| PE-WK-41 | §6.6 (flow 5) | Tablet / phone: the stepper's badge chip is mounted anew when its look changes (a chip that changed variant in place stopped painting its check / number); shared by every stepper of the app | D225, D224 |
| PE-WK-42 | §6.6 (flow 5) | A tamper stop is ONE WARNING row (Core: once per stop; app: no renewal of a live session); 4 requests remain; closes the open part of PE-WK-23; the web probe adds log lines only, by the rule, not driven | D225 (1) (2), D224 |
| PE-WK-43 | §6.6 (flow 5) | Web: a finished export job without a download says "stored on the Core" for `archiveOnCore: true`, "Demonstration: no archive is written." for `false`, "The Core server states no archive for this export." when not stated | D224, D225 |
| PE-WK-44 | §6.6 (flow 5) | Web: the export wizard pre-selects the option whose recorded text equals `exportDestinationDefault` of operation 40 (own choice first, else the first option) | D224, D225 |
| PE-WK-45 | §6.6 (flow 5) | The tablet's audio-source band legend is live (updates PE-WK-27); the end sentence of an interrupted recording is still not built | D225 |
| PE-WK-46 | §6.6 (flow 5) | CORRECTION of PE-WK-26: the tablet / phone `v2FilePartOutcome` does not read `plainChecked` (V-05 of the result only); the web does | D222 (6), D224 |

> **Authority in force.** Blueprint row 34 (`identification/02_structured.md:214`) is the hard gate:
> *"Each flow defined for all 3 clients; P-01..P-16 each marked applied or not applicable with reason;
> every gated control has the 'Checking your permissions...' state."* Decisions: **D4 OD-09** (hot
> standby; the switch toggle is for the session holder with `SESSION_START` + SUPERVISOR; web-only
> recording stays "no"), **D4 OD-10** (`CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; selector editable
> ONLY while idle), **D4 OD-12** (NO live preview of real cameras in this phase; the demo loop stays),
> **D4 OD-13** (loopback only; emulators for tests; physical devices are class C), **D4 OD-11**
> (`MIC_SILENT` warning, never an auto-switch) and **D4 OD-15** (`TRANSCRIPT_REVISE` for INVESTIGATOR
> + SUPERVISOR; Core key signs; no approval flow; sealed original immutable).
>
> This spec owns the client presentation only. The API contract is method/path/access/audit/slice from
> `masterplan/03_api_contract.md` (row 29); the mic-switch mechanics are
> `masterplan/05_capture_architecture_spec.md` (row 31) §E; the transcript data shape is
> `masterplan/07_transcript_spec.md` (row 33); the sealing step list and checkpoints are owned by
> `masterplan/06_evidence_package_spec.md` (row 32 — not yet written; this spec binds to it, section 9).
> No file outside this task folder is edited by this row; M4/M5/M7/M8 implement (red line).
>
> **Rev 2.3 delta (blueprint row 125, `identification/02_structured.md:377`; erratum PE-125-01).**
> Flows 9-13 (sections 8b-8g) add the client side of R-9 (camera search, connect flow), R-10
> (no-device notifications) and R-11 (development sources). Authority: `specs` §B.2, the contract
> delta `C3 §2.6, §3.1, §5.4` (row 121), `06_evidence_package_spec.md` §B.12 / §D.1 (row 124) and
> the controller rulings **D80** and **D81**, which are binding and override the row text where they
> differ (a camera password is entered on the **web console only**, D80(3)). Changed cells of the
> existing sections carry a `PE-125-nn` mark; the totals are restated once, in section 13.1.

**Citation short forms.**

| Short | Source |
|---|---|
| `C3 §x`, `op N` | `masterplan/03_api_contract.md` (row 29): operation N |
| `capture-spec §x` | `masterplan/05_capture_architecture_spec.md` (row 31) |
| `transcript-spec §x` | `masterplan/07_transcript_spec.md` (row 33) |
| `specs §x` / `R-n` / `C-Nn` | `masterplan/01_specs.md` (row 28) |
| `register §x` / `WB-nn`/`MB-nn`/`SH-nn`/`CS-nn` | `research/03_analysis.md` (row 6) |
| `drift §2.1 P-nn` / `drift §6 E-nn` | `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` |
| `Dn` / `OD-nn` | `decisions/decisions.md` (D4 = approved gate answers) |
| `file:line` | the existing client source at HEAD (read-only input) |

---

## 0. Gate answers and the standing client rules

| Gate (D4) | Answer | How this UX spec applies it |
|---|---|---|
| **OD-09** | hot standby; the mic toggle is for the **session holder** with `SESSION_START` **+ SUPERVISOR**; web-only recording stays "no" | Flow 2: the toggle is enabled only for the session holder or a supervisor (op 81 access = `PERMISSION SESSION_START` + the new `SESSION_HOLDER` condition, C3 §2.2); web still needs a paired tablet to record |
| **OD-10** | new `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN, editable **only while idle** | Flow 1: reads open to every role (`AUTHENTICATED`); the edit controls are gated by `CAPTURE_CONFIG` and additionally locked while a session is open (`409 CAPTURE_CONFIG_LOCKED`, C3 §4) |
| **OD-11** | below −50 dBFS for 10 s → `MIC_SILENT` warning; disconnect debounce 2 s; contract constants | Flow 2: the banner is `WARNING` severity and never switches the source; the 2 s debounce is presented as a pending state |
| **OD-12** | no live preview of real cameras in this phase | Flows 1 and 5: the monitor keeps the demo loop; the selector shows device state text, never a decoded frame |
| **OD-13** | keep loopback; LAN is class C (C-5) | Flow 5 and section 7: signed media URLs are loopback (`127.0.0.1`), tests run on emulators; physical devices change the host only |

**Standing client rules reused (all verified live by row 1 and the B10 rows).**

| Rule | Source of truth | Where used |
|---|---|---|
| Every gated control shows **"Checking your permissions..."** while the role/link is unresolved — never a silent hide, never an instant enable | `drift §2.1 P-13` (DEC-FXR-M-3); `drift §6 E-16`; `specs C-N12` | every flow (section 5 inventory) |
| Web gated reads "wait for the link" | `apps/core-web/src/lib/core-queries.ts:65-77` (`useCoreSignedIn`, `useCoreReadBase`, `LiveLinkState.ONLINE`) | flows 1, 3, 5, 6 |
| Web one query factory per Core key, gate inside the factory; presenter first, then the page record | `apps/core-web/src/lib/core-queries.ts:1-23,106-151` | flows 1, 3, 5, 6 (WB-11) |
| Web device commands go through one gate (`devices-panel`, `device-menu`) | `apps/core-web/src/lib/device-command-gate.ts:50-61,71-84` | flow 1 (PoE cycle) |
| Web one Blob-URL download, revoke ≥ 1 s | `apps/core-web/src/lib/download.ts:15,26-41` | flow 5 (export/download) |
| Mobile forward-only time from Core instants (`coreClockOf`); the larger value is drawn **while the Core reports RECORDING**; once the Core reports the stop, the Core's recorded duration wins (one bounded correction; ruling D19(b), AU1-2) | `apps/mobile/src/runtime/recording-elapsed.ts:1-21,75,128-144`; `apps/mobile/src/runtime/core-clock.ts:52-94,104-106` | flows 2, 3, 4, 7 |
| Mobile tablet list rows use a constant card border (`SelectionGlow` always mounted, React-drawn) | `apps/mobile/src/components/composed/selection-glow.tsx:1-21,40,43,45-56` | flows 1, 5, 6 |
| Mobile in-place hand-offs, `animation: 'none'` on `finalizing`/`summary` | `apps/mobile/src/features/session-live/monitor-handoff.ts:1-29`; `apps/mobile/src/features/session-summary/summary-handoff.ts`; `apps/mobile/src/navigation/stacks.tsx:59` | flows 3, 4, 7 |
| Reanimated only for removable overlays; final UI state drawn by React (lost-update family) | `selection-glow.tsx:1-21`; `drift §6 E-13`; risk MB-04 **High** | flows 1, 3, 4 |
| Session states and the v1 step enum | `packages/shared/src/domain/enums.ts:14-25,223-239` | flows 3, 4, 7 |
| Contract constants live in `@dems/shared/api` and are imported, not copied | `drift §2.1 P-02`; `specs C-N9`; `C3 §7` (`packages/shared/src/api/capture.ts`) | flows 1, 2, 3 |

**Rev 2.3 rulings applied by flows 9-13 (erratum PE-125-02).**

| Ruling | Answer | How this UX spec applies it |
|---|---|---|
| **D80(3)**, D81 | a camera user name and password is entered on the **web console only**; the server refuses operations 89, 95, 96 from a tablet or phone session (`WEB_CONSOLE_SESSION`) | Flow 10 exists on the web console; tablet and phone show Connect disabled with "Connect this camera from the web console." (§8d.1, §8d.10) |
| **D80(4)** | searching is allowed while a session is open; every connect step answers `409 CAPTURE_CONFIG_LOCKED` | Flow 9 has no locked state; in flow 10 the lock is a **disabled, explained state**, never an error toast (§8d.5) |
| **D80(2)** | an operator without `CAPTURE_CONFIG` sees the outcome of the pre-check search as a notification only | §8e.3: no list, no Connect, Search again disabled with the role sentence |
| **D80(5)** | microphones are local inputs; "Search again" for a microphone re-reads them (op 97); no network microphone discovery | Flow 13 (§8g.1) |
| **D80(6)**, **D81**, D72(k) | both cameras or both microphones unreachable = blocked; one camera or the standby microphone unreachable = warning, degraded session allowed; the selected ACTIVE microphone unreachable = blocked until the operator makes a reachable microphone active, then degraded with a warning; no camera connected at session start = the session FAULTS with `NO_CAMERA_CONNECTED` and nothing claims to record | §8g.3 (start rule), §8e.2 (situation C) |
| **D80(7)** | before row 84 an adoption with a password answers `503 CREDENTIAL_STORE_NOT_READY`; development sources without a password are adoptable | §8d.5, worded for an operator |
| **D80(9)**, D81 | the development mark is a per-source class and covers every package whose sources are not production devices | Flow 12: one badge on every surface, drawn from the Core's data (§8f) |
| **D80(10)** | typed-address entry is not in scope | no address field anywhere (§8c.1) |
| **D80(11)** | a local device that cannot be opened is never silently replaced by a fake; no frame or audio excerpt of a local-device recording in `docs/` | §8f.3 |

---

## 1. Flow catalogue — operations, slices, audit

Each flow below maps to exactly the operations, realtime slices and audit types of row 29. `read` =
`NONE-R` (no audit row); `denial` = `ACCESS_DENIED` on a refused call (`C3 §2.1-§2.2`).

| # | Flow | Requirement | Operations (row 29) | Realtime slices | Audit types | D4 |
|--:|---|---|---|---|---|---|
| 1 | Device selector | R-1 | 76 `getCaptureConfig`, 77 `getCaptureDevices`, 78 `updateCaptureConfig`, 79 `setCaptureCameraSource`, 80 `setPrimaryMic`; modified 44/45/46/47; existing 48 (PoE, camera) | `captureConfig` (29), `captureDevices` (30); re-keyed `meters.audio`; `session` (44/45 read shapes) | `CAPTURE_CONFIG_CHANGED` (78/79/80); `CAMERA_POE_CYCLED` (48); denial `ACCESS_DENIED` | OD-10, OD-12, OD-22 |
| 2 | Mic toggle + warning | R-3 | 81 `switchAudioSource`, 82 `listAudioSourceIntervals`; modified 44 `getDeviceHealth`, 45 `getAudioStatus` | `session` (`audioSource`); re-keyed `meters.audio` (`MIC-01`/`MIC-02` + `activeInputId`) | `AUDIO_SOURCE_SWITCHED` (81, carries sending device id); `MIC_SILENT` (warning raiser); denial `ACCESS_DENIED` | OD-09, OD-11 |
| 3 | Sealing progress + ETA | R-6 | 83 `getSealingProgress`; modified 27 `getCurrentSession` | `session` (`finalization` v2 steps) | `EVIDENCE_SEALED` once at seal; denial `ACCESS_DENIED` | OD-08 |
| 4 | Resumed sealing after crash/restart | R-6, OD-08 | 83 (re-read, `resumed: true`); modified 38 `listSessionHistory` (`interrupted`), modified 27, modified 39 `listEvidence` (v2, `interrupted`) | `session` (`recovery` + `finalization`) | `RECOVERY_STARTED`, `RECOVERY_COMPLETED`, `EVIDENCE_SEALED` (unchanged types, C3 §5.3) | OD-08 |
| 5 | Playback with audio-source band | R-3/R-4 | 82 `listAudioSourceIntervals`; 88 `createEvidenceMediaSession`; modified 39, 40 `getEvidence`, 41 `verifyEvidence`; existing 42 `exportEvidence` + 87 `getEvidenceExportJob` | `evidence` (`mediaRef`/`transcript`/`exportJob`) | `EVIDENCE_MEDIA_SERVED` (88); `EVIDENCE_EXPORTED`/`EVIDENCE_EXPORT_FAILED` (42/87); denial `ACCESS_DENIED`/`EXPORT_DENIED` | OD-12, OD-13, OD-16 |
| 6 | Transcript pane | R-5 | 84 `getTranscript`, 85 `createTranscriptRevision`, 86 `listTranscriptRevisions` | `evidence` (transcript summary) | `TRANSCRIPT_REVISED` (85); denial `ACCESS_DENIED` | OD-15 |
| 7 | Session gating | R-6 | existing 24 `createSession` (`409 SESSION_ACTIVE`), existing 25 `startSession`, 27 `getCurrentSession` | `session` | `SESSION_ACTIVE` is a typed refusal, **no** audit row; denial `ACCESS_DENIED` | OD-08 |
| 8 | STT configuration menu (section 8a; restated here, **PE-125-03**) | R-8 | 90 `getSttConfig`, 91 save, 92 test connection (`C3 §2.5`) | none | `STT_CONFIG_CHANGED`; denial `ACCESS_DENIED` | D20, D24 |
| 9 | Search for cameras (section 8c) **PE-125-03** | R-9, R-10 | 93 `startCaptureDiscovery`, 94 `getCaptureDiscovery` | **none** for the list (owner session only); `alerts` for the outcome | `CAPTURE_DISCOVERY_SEARCHED`; denial `ACCESS_DENIED` | D73-D76, D80 |
| 10 | Connect a camera — web console only (section 8d) **PE-125-03** | R-9 | 95 `testCaptureCandidateConnection`, 96 `adoptCaptureCandidate`; then existing 78 / 79; later 89 | `captureDevices` (the adopted device); `captureConfig` (lock flag, assignment) | `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_CREDENTIAL_SET`; denial `ACCESS_DENIED` (`WEB_CONSOLE_ONLY`); a locked step writes no row | D76, D80(3), D80(4), D80(7), D81 |
| 11 | No-device notifications (section 8e) **PE-125-03** | R-10 | no new read; modified `beginPrecheck` / `retryPrecheck`; 93, 97 as the offered actions | `alerts`, `captureDevices`, `captureConfig`, `session` | `CAPTURE_DISCOVERY_SEARCHED` (A), `CAPTURE_DEVICE_UNREACHABLE` (B; C degraded), `FAULT_RAISED` (C) — all written by the Core | D72(h)(i)(k), D80(2), D80(6), D80(8) |
| 12 | Development sources: label and local-device rows (section 8f) **PE-125-03** | R-11 | reads 76, 77, 94, 27, 39 / 40, 41 | `captureConfig`, `captureDevices`, `session`, `evidence` | none of its own | D73, D74, D78(2), D80(9), D80(11), D81 |
| 13 | Microphones: Search again and the active-microphone rule (section 8g) **PE-125-03** | R-10 | 97 `rescanCaptureInputs`; modified `beginPrecheck` / `retryPrecheck`, existing `acknowledgePrecheckWarnings` | `captureDevices`, `session` | `CAPTURE_DISCOVERY_SEARCHED` (`scope: MIC_LOCAL`); `PRECHECK_BLOCKED` / `PRECHECK_PASSED` (existing) | D80(5), D80(6), D81 |

**Slices are additive and correctly named.** `captureConfig` and `captureDevices` are the two new
replicated slices (28 → 30); capture devices **never** reuse `AdminResource.DEVICE[S]` (E-04/P-06;
`C3 §6`, `C3 §9 N-2`). The `meters.audio` slice is re-keyed from `AUDIO-01`/`AUDIO-02` channels to
inputs `MIC-01`/`MIC-02` plus `activeInputId` (E-02; `C3 §6`; current shape
`packages/shared/src/api/state-slices.ts:375-395`).

---

## 2. Flow 1 — Device selector (R-1)

### 2.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | Operator opens Devices (web), Devices (tablet), Settings/Devices (phone) and enters the capture section |
| Entry state | Any session state; reads always allowed; edits allowed only when **no session is open** (OD-10) |
| Data read on entry | op 76 `getCaptureConfig`, op 77 `getCaptureDevices`; slice `captureConfig`/`captureDevices` |
| Preview | **None** (OD-12): state is text/icon only (`online`, `streamState: LIVE\|LOST`, `role`), because no real-camera preview exists in this phase; the Monitor keeps the demo loop (`specs §A.3`, `C3 §9 N-5`) |

### 2.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Reading config/devices | Loading skeleton; controls show "Checking your permissions..." (gated read) | 76/77; E-16 |
| 2 | Resolved, idle | Two camera rows (`VIDEO-01`,`VIDEO-02` → `CAM-01`/`CAM-02` or one dual-lens profile) and two mic rows (`MIC-01` PRIMARY, `MIC-02` STANDBY). **PE-125-04:** a camera row may name any registered camera, including one added by flow 10 (`CAM-NN`); a row whose line has `sourceClass: DEVELOPMENT` carries the "Development source" badge (flow 12) | 76; `C3 §2.4`, `§2.6` "Device shapes", `§3.1`; OD-05 |
| 3 | Edit affordance | Edit/enable only if `CAPTURE_CONFIG` and idle; otherwise the control is shown disabled with a reason sentence | OD-10; `C3 §2.2` note |
| 4 | Save camera source | Optimistic-free: the row shows a pending state until `captureConfig` republishes | 79; `C3 §2.3` |
| 5 | Save primary mic | The chosen mic becomes `PRIMARY`, the other `STANDBY` in the same republish | 80; `C3 §2.4` |
| 6 | Locked (attempted edit during a session) | `409 CAPTURE_CONFIG_LOCKED`; the control returns to the locked state with the message "The capture configuration cannot be changed while a session is open." and **no** audit row | `C3 §4`; OD-10 |

### 2.3 Operations, slices, audit

| Operation | Access (marker) | Slice published/read | Audit |
|---|---|---|---|
| 76 `getCaptureConfig` | `AUTHENTICATED` | reads `captureConfig` | `NONE-R` |
| 77 `getCaptureDevices` | `AUTHENTICATED` | reads `captureDevices` | `NONE-R` |
| 78 `updateCaptureConfig` | `PERMISSION CAPTURE_CONFIG` | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 79 `setCaptureCameraSource` | `PERMISSION CAPTURE_CONFIG` | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 80 `setPrimaryMic` | `PERMISSION CAPTURE_CONFIG` | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 44 `getDeviceHealth` / 45 `getAudioStatus` / 46 `getVideoStatus` / 47 `getDeviceInventory` | existing | read re-keyed `mics`/`audio` shapes | unchanged |
| 48 `restartDevice` (camera = PoE cycle) | existing `DEVICE_MANAGE` | publishes `captureConfig` (gap marked) | `DEVICE_COMMAND` + `CAMERA_POE_CYCLED` |

### 2.4 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused / locked |
|---|---|---|---|---|
| G1 Selector edit (open/save) | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN) | "Checking your permissions..." until the role and link resolve | Editable when idle | Not permitted → disabled + "Requires the SUPERVISOR or TECHNICIAN role" (`403 NOT_PERMITTED`); open session → locked with the OD-10 sentence (`409 CAPTURE_CONFIG_LOCKED`) |
| G2 Camera-source edit | `CAPTURE_CONFIG` + idle | same | Assign a device to `VIDEO-01`/`VIDEO-02` | same two refusals; `404 NOT_FOUND` for an unknown device id |
| G3 Primary-mic edit | `CAPTURE_CONFIG` + idle | same | Set `MIC-01`/`MIC-02` PRIMARY | same; the other input becomes STANDBY |
| G9 Camera PoE cycle | `DEVICE_MANAGE` **and** the stream is `LOST` **and** not RECORDING | "Checking your permissions..." | Confirmed cycle (`{ confirm: true }`) | `409 CAMERA_NOT_LOST` when the stream is healthy; `409 RECORDING_ACTIVE` during recording (`C3 §4`; P-05) |

### 2.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading | Skeleton on the two panels; controls in Checking | Skeleton; controls in Checking | Skeleton; controls in Checking | E-16 |
| Not live / link down | "Waiting for the link" (never an instant enable) | Waiting-state row | Waiting-state row | `core-queries.ts:65-77`; P-13 |
| `403 NOT_PERMITTED` | Read-only selector; reason under the disabled edit | same | same | E-16 |
| `409 CAPTURE_CONFIG_LOCKED` | Locked banner + disabled edit | Locked banner | Locked banner | OD-10; `C3 §4` |
| `422 INVALID_INPUT` | Field-level message; no config change | same | same | `C3 §2.3` |
| `503 NOT_READY` (`details.reason: CAPTURE_NOT_READY`) | "Capture is not ready yet" with Retry (invalidates the key) | same | same | `C3 §4`; `core-queries.ts:149-151` |
| Empty device list | "No capture devices configured" + the action **Search for cameras** (G13, flow 9) **PE-125-04** | same | same | op 77 empty; R-10 AC-1 |
| `422 INVALID_INPUT` (`DEVELOPMENT_SOURCE_NOT_ALLOWED`) **PE-125-04** | Field message "This source can only be used in the development configuration."; no config change | same | same | `C3 §3.1` (78 / 79); R-11 AC-2 |
| `LOST` stream | Row shows LOST; PoE cycle (G9) offered only then | same | same | OD-22 |

### 2.6 Per-client definition

| Aspect | Web (`apps/core-web`) | Tablet (`apps/mobile`) | Phone (`apps/mobile`) |
|---|---|---|---|
| Surface | Devices page/drawer (WB-05), System entry (WB-07) | Devices screen (MB-08), Settings → capture (MB-09) | Settings → Devices (MB-09) |
| Read factory | New `captureConfigQueryOptions`/`captureDevicesQueryOptions` in `lib/core-queries.ts` (WB-11, E-17) | replicated slices via `useSim` | same |
| List rows | Device rows + kebab through `device-command-gate.ts` | Constant card border via `SelectionGlow` (`selection-glow.tsx:40`) | Compact rows; constant border |
| Edit affordance | Inline selects with a "Save" per field (ops 79/80) | Bottom sheet per field | Full-screen sheet per field |
| Source options **PE-125-04** | Every registered camera of op 77 (seeded or added by flow 10), each development source with the badge; never a row of the search list (a found camera is not selectable until it was added on the web console) | same options in the sheet | same |
| Demo loop | Monitor keeps the demo loop (OD-12) | same | same |

### 2.7 Forward-only rule

No timer is drawn here. The `locked` flag and `streamState` are snapshot values; a stale snapshot is
refreshed by the slice republish, never by a client-side countdown.

---

## 3. Flow 2 — Mic toggle + warning (R-3)

### 3.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The session holder (or a supervisor) presses the mic toggle during `RECORDING`, or presses "switch to standby" on the `MIC_SILENT` banner |
| Entry state | A session in `RECORDING`; `AUDIO-01` carries the active mic; both inputs are fed (hot standby, OD-09) |
| Data read | slice `session.audioSource` (`activeInputId`, `standbyInputId`) + `meters.audio` (`MIC-01`/`MIC-02` levels + `activeInputId`) |
| Manual only | The Core never auto-switches (OD-11; `capture-spec §E.1`); the warning offers the operator the switch |

### 3.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Idle meters | Two input meters (`MIC-01`, `MIC-02`); the active one marked PRIMARY | `meters.audio`; E-02 |
| 2 | Toggle pressed | Confirmation step (web dialog; mobile confirm); "Checking your permissions..." resolves first | E-16; OD-09 |
| 3 | Pending | The toggle shows a pending state until op 81 answers with the new active/standby state | op 81; `C3 §2.3` |
| 4 | Switched | Active moves to the other input; one `AUDIO_SOURCE_SWITCHED` audit row; the interval is appended | op 81; `C3 §5.2` |
| 5 | Denied | `403 NOT_PERMITTED` (not the session holder and not a supervisor) → reason sentence, no state change | OD-09; `C3 §2.2` |
| 6 | Conflict | `409 AUDIO_SOURCE_CONFLICT` ("The requested microphone cannot become the active source.") | `C3 §4` |
| 7 | Not recording | `409 INVALID_STATE` when the session is not `RECORDING` | `C3 §4` |
| 8 | `MIC_SILENT` warning | Banner, severity WARNING: sustained level below −50 dBFS for 10 s; text names the silent input; a "switch to standby" action is offered but **never** taken automatically | OD-11; `C3 §5.2`; `capture-spec §E.1` |
| 9 | Disconnect debounce | While a mic drops, a 2 s debounce shows "Input interrupted — verifying" before any warning/fault is raised | OD-11; `capture-spec §E.1` |

### 3.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 81 `switchAudioSource` | `PERMISSION SESSION_START` + `SESSION_HOLDER` | publishes `session`; updates `meters.audio.activeInputId` | `AUDIO_SOURCE_SWITCHED` (`fromInput`,`toInput`,`fromMs`,`toMs`,`sendingDeviceId`) |
| 82 `listAudioSourceIntervals` | `AUTHENTICATED` | reads `session` (intervals) | `NONE-R` |
| 44 `getDeviceHealth` / 45 `getAudioStatus` | existing | re-keyed inputs + `activeInputId` | unchanged |

No `trigger` key exists in `AUDIO_SOURCE_SWITCHED` because every switch is operator-initiated
(`C3 §5.2`). The sending device id is recorded (E-30/B15), never a credential.

### 3.4 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G4 Mic toggle | `SESSION_START` **and** `SESSION_HOLDER` | "Checking your permissions..." until the role + holder status resolve | Session holder or supervisor switches | `403 NOT_PERMITTED`; no state change |
| G5 Banner "switch to standby" | same as G4 | same | Performs op 81 after confirm | same |

### 3.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading role | Toggle disabled with Checking label | same | same | E-16 |
| `409 AUDIO_SOURCE_CONFLICT` | Banner with the fixed message; meters unchanged | same | same | `C3 §4` |
| `409 INVALID_STATE` | Toggle hidden-with-reason (session not recording) | same | same | `C3 §4` |
| `404 NOT_FOUND` | "That session is not the open session" | same | same | `C3 §4` |
| `MIC_SILENT` | WARNING banner + optional action | same | same | OD-11 |
| Both inputs down | Capture-fault presentation (session-level), never an auto-switch | same | same | `capture-spec §A.7` |

### 3.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Session Monitor (WB-01), Dashboard mic tiles (WB-02) | Session Live mic cards (MB-03), Home mic tiles (MB-01) | Session Live mic cards (MB-03) |
| Interaction | Confirm dialog + pending spinner | Confirm + haptic + pending | Confirm + haptic + pending |
| Home tile defect | n/a | Home mic tiles must not show "No signal" while recording (B15, folded by MB-01) | same |
| Meter key | `useAudioChannel` keyed by mic input (SH-22, `react.ts`) | same | same |
| Development-source badge **PE-125-05** | On a mic meter or tile whose input is a development source (flow 12; from the session's `captureConfig` snapshot) | on the mic card and the Home tile | on the mic card |

### 3.7 Forward-only rule

Any "silent for Ns" counter, the 2 s disconnect debounce, and any switch latency read derive from
**Core instants** via `coreClockOf` and only grow (`recording-elapsed.ts:1-21,128-144`;
`core-clock.ts:82-88`); they never step back (E-13; RC-1). **Refinement D19(b) for the recording
duration:** the forward-only hold applies only while the Core still reports RECORDING; it can exceed
the stored duration by the stop-learning delay (erratum AU1-4 — it does not "never overshoot"), so
once the Core reports the stop, the Core's authoritative recorded duration wins with one bounded
correction and the evidence record never shows more than the sealed duration. The meters themselves are push frames
(20 Hz, `CAPTURE_METER_RATE_HZ`), not client-timed.

---

## 4. Flow 3 — Sealing progress + ETA (R-6)

### 4.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The session enters `FINALIZING` after `STOPPING`; the client mounts the progress view |
| Entry state | `FINALIZING`; the finalization slice carries v2 steps with `progress`/`etaMs`/`attempt` |
| Step ownership | **Row 32 (`masterplan/06_evidence_package_spec.md`) owns the definitive step list**; this spec binds to op 83's step envelope and the SH-01 enum `CLOSE_TRACKS`..`STORE_SEALED_PACKAGE` (`register §B.1`; op 27; `C3 §2.4`). The v1 six-step enum (`enums.ts:223-239`) is replaced by the v2 set |
| Cadence | `SEALING_PROGRESS_INTERVAL_MS = 1_000` recompute (`C3 §7`); op 83 reads the `session.finalization` slice |

### 4.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | `CLOSE_TRACKS` … `STORE_SEALED_PACKAGE` | Ordered stepper; each step `PENDING` → `RUNNING` (with `%` + ETA) → `DONE`/`FAILED` | op 83; op 27 |
| 2 | Overall progress | `progressPct` (0-100) and `etaMs`; the transcript step is included in the list (R-5; `transcript-spec §D.3`) | op 83 |
| 3 | Long step | The step shows its own `startedAt`/`durationMs`; the ETA may be absent (`null`) rather than guessed | op 83 shape (`C3 §2.3`) |
| 4 | Completed | On `EVIDENCE_SEALED` the client hands off to the Summary (mobile, in place) or shows the sealed item | `C3 §5.3`; P-11 |
| 5 | Failed step | Step `FAILED` with `error_code`; the client shows the failure, never a lower percentage | op 83 |

### 4.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 83 `getSealingProgress` | `AUTHENTICATED` | reads `session.finalization` | `NONE-R` |
| 27 `getCurrentSession` | `AUTHENTICATED` | `session` with `captureConfig` snapshot + v2 `finalization` | `NONE-R` |
| engine INTERNAL `applySealingProgress` / `completeSeal` | server-side seam (no client call) | publishes `session` | `EVIDENCE_SEALED` once at seal |

### 4.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Notes |
|---|---|---|---|
| Progress view (read) | `AUTHENTICATED` (link + signed-in on web) | The view shows "Checking your permissions..." while the link resolves; then the stepper | E-16; `core-queries.ts:65-77` |
| No write control | — | — | There is no "advance seal" or "retry" control (RECOVERY drives it, flow 4) |

### 4.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading | Stepper skeleton | same | same | E-16 |
| `409 INVALID_STATE` (sealing not started) | "Sealing has not started" | same | same | `C3 §4` |
| ETA absent | Show elapsed + "estimating…" (no fabricated number) | same | same | op 83 `etaMs?` |
| Failed step | Step marked FAILED; RECOVERY state if a fault follows | same | same | flow 4 |

**Erratum PE-WI-10 (decisions D216, D217; re-gate 75 finding G75b-02; fix wave I drivers A1, B, C: `delegation_progress/contract_wave_i.md` section 3.3; `implementation/133_fix_wave_i_b.md` section 2.1; `implementation/134_fix_wave_i_c.md` section 1 rows G75b-02 and decision 3):** the row "Failed step" above does not
cover a seal the Core retries or that is blocked. As built, every surface takes ONE reading, the
shared `sealAttentionOf({ session, alerts })` (`packages/shared/src/sim/seal-blocked.ts:141`; C3
erratum PE-WI-07), and Home / Dashboard surfaces `sealBlockedNoticeOf` (`seal-blocked.ts:97`):

| Kind | Web | Tablet / phone |
|---|---|---|
| `RETRYING` (the Core runs the seal again by itself) | Seal dialog: heading "Sealing is being retried", the Core's own retry sentence (it holds "retry n of N, in s s"), "The recording is kept on the Core." and the closing note. Monitor banner "SEALING RETRIED", Dashboard panel "Sealing is being retried" (tone warning) | Finalizing: title "Sealing is being retried", the Core's retry sentence, "The Core runs the seal again by itself. You can leave this screen; the session stays open on the Core until it is sealed." Back is not held |
| `BLOCKED` (the retries are used up; the alert `params.reason: SEAL_BLOCKED` is active) | Seal dialog: heading "Sealing is blocked", the failed step's sentence, the fixed sentence of the detail code (`SEAL_BLOCKED_DETAIL_SENTENCE`), the alert's whole message (what restores it), "The recording is kept on the Core.", "What you can do: tell the administrator of this Core. No new session can be recorded until this one is sealed." and "You can close this window. The session stays open on the Core." Monitor banner "SEALING BLOCKED" + the Core's sentence + "The recording is kept on the Core." (tone danger); Dashboard panel "Sealing blocked", no spinner, no step progress | Finalizing: title "Sealing is blocked", the alert's whole message, the fixed sentence of the detail code, "The recording is kept on the Core.", "A technician or the administrator of the Core has to resolve the cause on the Core.", that the session stays open on the Core, and "Go to Home". Home: status card "Sealing blocked" with `<session> · The recording is kept on the Core.`, quick action "Sealing blocked: view" and the line "A new session cannot be started: sealing of session {{sessionId}} is blocked, and the Core records no new session until it is sealed." Sessions: chip "Sealing blocked" (danger), "Sealing of this session is blocked. The recording is kept on the Core."; the disabled Start button and a refused `/session/new` link name the blocked seal by session |

Rules for both kinds. (1) The surface MUST be leavable: the web dialog has Close, Escape and click
outside (`apps/core-web/src/features/session-monitor/finalization-modal.tsx`); on tablet and phone
Back is not held and "Go to Home" is offered
(`apps/mobile/src/features/session-finalizing/session-finalizing-screen.tsx`). (2) While the seal
needs attention NO percentage and NO ETA is drawn (the notice stands in the place of the progress
bar; the step list stays, it shows which step failed), and no surface says "takes a few seconds"
or that the screen closes by itself. (3) The reason, the detail sentence and "The recording is
kept on the Core." are the Core's / the shared constants' words; only the headline, the next step
and the closing note are the client's (`apps/core-web/src/i18n-web.ts:57-68`;
`apps/mobile/src/features/session-finalizing/i18n.ts:61-71`). (4) The blocked Finalizing screen
offers NO recovery action (ruling D217 (3)): the row "No write control" of §4.4 stands. (5) The
web console has no Sessions list; its rows of the session are the Monitor banner and the Dashboard
panel. (6) A cause no retry gets past ends the session as UNSEALABLE and the Finalizing screen
leaves as it does for every UNSEALABLE (unchanged). Proven in the clients' tests only: re-gates 70 and 75 have NOT passed, so this is not yet gate-verified.

**Erratum PE-WI-14 (decision D217; re-gate 75 finding G75b-07; fix wave I driver B, `implementation/133_fix_wave_i_b.md` section 2.4):** the web header pill no longer says "An integrity check failed" for
every critical state. A critical flag of the audit chain or of the security platform keeps that
sentence; ONE other critical kind reads "Critical fault: {{kind}}" (the kind in the operator's
words, `common.faultKind.*`); several read "{{count}} critical faults"
(`apps/core-web/src/components/shell/integrity-checks.ts:70`, `:87`;
`apps/core-web/src/i18n-web.ts:17-20`). LIMIT, stated by the driver and not fixed: the pill's STATE
comes from fault flags, not alerts, so a blocked seal alone (alert kind SYSTEM, no flag) does not
turn the pill CRITICAL; the blocked seal is stated by the Monitor banner, the Dashboard panel, the
dialog and the bell (PE-WI-10). Proven in the clients' tests only: re-gates 70 and 75 have NOT passed, so this is not yet gate-verified.

**Erratum PE-WI-33 (decisions D217, D218; re-gate 75 finding G75b-02 and closing pass J item 4, `implementation/135_fix_wave_i_pass_j.md` item 4; `implementation/137_docs_errata_followup.md`) - REMOVES THE LIMIT STATED IN PE-WI-14:** a blocked seal now turns
the Core's state critical on the clients, by the Core's own alert and with no fault flag (the shared reader `sealBlockedNoticeOf`, C3 erratum PE-WI-07). WEB: `selectPillState` is CRITICAL when a blocked seal is reported
(`apps/core-web/src/components/shell/integrity-checks.ts:42`); the pill's cause is `SEAL_BLOCKED` when there is no critical flag (`:97-98`) and its second line reads "Sealing is blocked" (`:113-114`, `web.sealBlocked.title`,
`apps/core-web/src/i18n-web.ts:59-60`); a critical flag keeps its own sentence of PE-WI-14 and wins over the blocked seal; the header checklist row `recording` reads CRITICAL, so the popover never reads all-OK under a CRITICAL pill
(`selectIntegrityChecks`, `:46-56`). TABLET / PHONE: the Home status state is CRITICAL on the same reader (`apps/mobile/src/features/dashboard/use-home-data.ts:60-62`), which turns the Home status ring and card critical
beside the card text of PE-WI-10. `SYSTEM_FLAG_IDS` of the shared selector was not touched (a pinned finite set); the blocked seal is not a fault flag. Proven in the clients' tests only: not yet gate-verified (to be driven at re-gate 75 on a lane
with a blocked seal, if one can be produced).

**Erratum PE-WK-21 (decisions D220, D224; re-gate 75 findings G75c-05 and G75c-10; fix wave K drivers W and M2, `implementation/141_fix_wave_k_w.md` section 2.7, `implementation/143_fix_wave_k_m2.md` section 1; `delegation_progress/contract_wave_k.md` S1 sections 5 and 6; `implementation/147_docs_errata_wave_k.md`):** two sentences of the seal screens.
(1) NO TIME-LEFT LINE WITHOUT `etaMs`. The line "about {{seconds}} s left" (`session.sealingEta.step`) is drawn ONLY when the Core states a measured `etaMs` (API contract erratum PE-WK-03): `etaMs === null` draws no line at all - not "0 s", not a dash with a unit, and no longer "Estimating the time left…". WEB: `apps/core-web/src/features/session-monitor/finalization-modal.tsx:221` (`etaMs !== null && etaMs > 0`); TABLET / PHONE:
`apps/mobile/src/features/session-finalizing/session-finalizing-screen.tsx:364` (`phase === 'finalizing' && progress.etaMs !== null && attention === null`). The Core states none for the step "Finalize transcript" (it gave about 1,680 s, the bound of the wait); that step's own progress sentence is `steps[].detail` ("1 of 3 chunks") for a client that reads the session slice - the web stepper draws the percent, not the detail (open, no finding asked for it).
(2) AN INTERRUPTED RECORDING IS NOT "SEALED" WHILE THE SEAL RUNS. "Sealed — recording was interrupted" (the naming of PE-WI-10 and gate 75) is said once the session IS sealed, not at 0 %. While the seal runs WEB reads "The recording was interrupted" with the cause and "The Core is sealing the recording up to the interruption." (`apps/core-web/src/i18n-web.ts:142-143`; `features/session-monitor/interrupted-seal.tsx`), TABLET / PHONE
"Recording was interrupted — sealing what was recorded" (`apps/mobile/src/features/session-finalizing/i18n.ts:21`; `interrupted-seal.tsx`, prop `sealing`). NOT changed: the passing state of the Core itself before `FINALIZING` - the web banner "SESSION ACTIVE / Capture fault / Start recovery" for about 120 ms and the tablet's recovery screen for a moment are the Core's own `FAULT` state, drawn as the state says (a client that hid a state for a time would be guessing; hiding it on the
tablet needs a Core fact "this fault is being sealed by the Core", none exists; ruling D224 (5): next task). Proven in the clients' tests only: not yet gate-verified.

### 4.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Session Monitor finalization (WB-01); Dashboard progress tile (WB-02) | Session Finalizing stepper (MB-04); Home progress tile (MB-01) | Session Finalizing stepper (MB-04) |
| Animation | React-drawn stepper; no Reanimated for final state | React-drawn rest values (`drift §6 E-13`); `SelectionGlow` constant border if list rows | same |
| Hand-off | In-place card swap on the monitor | In-place `finalizing → summary` (`stacks.tsx:59`, `summary-handoff.ts`, `animation:'none'`) | same |
| Risk | — | MB-04 **High**: lost Reanimated updates cluster in Finalizing/Stepper — React must draw the final state | same |

### 4.7 Forward-only rule

Progress is **forward-only and derived from Core instants** (`coreClockOf`), never the client wall
clock (`C3 §2.4`; `specs §E.5`; E-13; `register E-13`). The client aggregates per step with
`max(previous, server)` and counts `DONE` steps monotonically; a resumed attempt (flow 4) may
legitimately rewrite a step's `progress`, but the displayed overall must never rewind
(`04_database_contract.md:270`). ETA uses the monotonic `recording-elapsed.ts` ticker pattern
(`specs §E.5`).

---

## 5. Flow 4 — Resumed sealing after a crash/restart (R-6, OD-08)

### 5.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | A crash during `RECORDING` (durable part sealed `interrupted`) or a crash during sealing, followed by `RECOVERY` |
| Entry state | `FAULT → RECOVERY → SEALED` (or `INCOMPLETE`); `SealingProgress.resumed` is set on a resumed seal |
| Data read | op 83 (`resumed: true`, `attempt` ≥ 2), op 27 (`session.recovery` + `finalization`), op 38 (`interrupted: boolean`), op 39 (v2 item carries `interrupted`) |
| No user action | The client never offers a "restart seal" or "resume" button; RECOVERY is engine-driven (OD-08) |

### 5.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | `RECOVERY` scan | Recovery view: `RECOVERY_SCAN` → `INCOMPLETE_SESSION_ANALYSIS` with a progress read | `session-machine.ts:971-1015`; MB-06 |
| 2 | Resumed sealing | The stepper shows `attempt ≥ 2` and a "resumed after restart" note; progress forward-only | op 83; E-13 |
| 3 | Interrupted package | If the durable part was sealed, the item/tile is marked **"interrupted"** (not a normal seal) | op 38 `interrupted`; op 39; OD-08 |
| 4 | Completion | RECOVERY ends `SEALED`; `EVIDENCE_SEALED`; hand-off to Summary | `specs §E.5`; P-11 |
| 5 | Transcript | The transcript covers the durable timeline and records `intervals_incomplete` if the interval map was truncated | `transcript-spec §A.1` |

### 5.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 83 `getSealingProgress` | `AUTHENTICATED` | `session.finalization` (`resumed`, `attempt`) | `NONE-R` |
| 27 `getCurrentSession` | `AUTHENTICATED` | `session.recovery` + `finalization` | `NONE-R` |
| 38 `listSessionHistory` | existing | session list with `interrupted` | `NONE-R` |
| 39 `listEvidence` | existing | v2 item with `interrupted` | `NONE-R` |
| engine INTERNAL `applySealingProgress`, `completeSeal` | server-side | publishes `session` | `RECOVERY_STARTED`, `RECOVERY_COMPLETED`, `EVIDENCE_SEALED` |

### 5.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Notes |
|---|---|---|---|
| Recovery view (read) | `AUTHENTICATED` | "Checking your permissions..." while the link resolves | E-16 |
| Resumed progress (read) | `AUTHENTICATED` | same | forward-only |
| No write control | — | — | RECOVERY-driven only |

### 5.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Crash during sealing | Progress resumes; "Resumed after restart" note | same; in-place recovery hand-off | same | E-13 |
| Crash during recording | Durable part presented as "interrupted" | same | same | OD-08 |
| No committed transcript | Transcript shows UNAVAILABLE/partial note; no fake text | same | same | `transcript-spec §A.5` |
| `409 INVALID_STATE` | "Sealing has not started" | same | same | `C3 §4` |

**Erratum PE-WI-11 (decision D217; re-gate 75 finding G75b-02; `delegation_progress/contract_wave_i.md` section 4; `implementation/133_fix_wave_i_b.md` decision D-2; `implementation/134_fix_wave_i_c.md` decision 2):** the note "Resumed after restart" (§5.2 step 2 and the row "Crash
during sealing" above) is NOT derived from `attempt ≥ 2`. `attempt` grows with every run of the
seal, the Core's automatic retries included, so at re-gate 75 the note appeared with no restart.
The truthful fact is `resumed` of operation 83 (C3 erratum PE-WI-06). As built: from `attempt > 1`
a surface may say only that the seal was run again; the web seal dialog and the mobile Finalizing
screen do not poll operation 83, so beside a session of the Core's OWN capture the note is not
shown (the web shows it only for a session of the simulator's capture or when the dialog followed
the session through RECOVERY; mobile only in the in-app simulator, and never beside a seal
notice of PE-WI-10). To show the truthful fact in Live mode a surface would have to read
operation 83's `resumed`: not built. Proven in the clients' tests only: re-gates 70 and 75 have NOT passed, so this is not yet gate-verified.

### 5.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Monitor finalization + dashboard tile (WB-01/WB-02) | Session Recovery (MB-06) → Finalizing (MB-04) → Summary (MB-05) | same, compact |
| Hand-off | Card swap | In-place, `animation:'none'` | same |
| "Interrupted" badge | On the evidence item/tile | same | same |

### 5.7 Forward-only rule

On resume, `attempt` increments and a step's `progress` may be rewritten (`04_database_contract.md:270`),
but the client must not draw a lower value than it already showed for a `DONE` step, and the overall
percentage must never decrease. All reads come from Core instants (`coreClockOf`); E-13 applies.

---

## 6. Flow 5 — Playback with the audio-source band (R-3/R-4)

### 6.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The operator opens a sealed evidence item and plays it |
| Entry state | A `SEALED` v2 item with two files (`VIDEO-01.mp4`, `VIDEO-02.mp4`), each carrying the single `AUDIO-01` track, and `audioSourceIntervals[]` |
| Whole file | One whole file per camera with the single audio track (R-4; OD-21); Range-request streaming |
| No live preview | OD-12: playback is of the sealed files, not a live real camera (the Monitor keeps the demo loop) |

### 6.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Open item | op 40 `getEvidence`; `media.source: LIVE_STREAM` means a signed media session is required | op 40; `C3 §3` |
| 2 | Media session | op 88 `createEvidenceMediaSession` returns a signed, loopback-only URL with `ranges: true`; `EVIDENCE_MEDIA_SERVED` audited (never the URL) | op 88; E-31 |
| 3 | Stream | Two players, one per camera file, synchronised on the shared `AUDIO-01` timeline; Range requests map to the fragment quantum | op 88; `capture-spec §D.4` |
| 4 | Audio-source band | A band under the timeline drawn from `audioSourceIntervals` (`fromMs`/`toMs`, media-pts) marks which mic was active when | op 82; `capture-spec §E`; `C3 §2.4` |
| 5 | Transcript pane | Sealed transcript alongside (flow 6) | op 84 |
| 6 | Verify | op 41 v2 verify: per-file chain (both hashes) + transcript hash + real signature; pinned verdict per run. **PE-125-06:** for a package with development sources the line "DEVELOPMENT SOURCES — this package was not recorded from production devices." is shown first, above the checks, never collapsed; the verdict (PASS when the checks pass) is unchanged (flow 12, §8f.2) | op 41; P-16; `06_evidence_package_spec.md` §D.1 (V-15) |
| 7 | Export / composite | op 42 creates a job (`202`, `status: QUEUED`); op 87 polls; composite marked `derived` | op 42/87; OD-16 |
| 8 | No media | `409 MEDIA_NOT_AVAILABLE` → "No playback media is available for this evidence item." | `C3 §4` |

### 6.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 82 `listAudioSourceIntervals` | `AUTHENTICATED` | reads `session` intervals | `NONE-R` |
| 88 `createEvidenceMediaSession` | `PERMISSION EVIDENCE_VIEW` (live only) | none (not replicated) | `EVIDENCE_MEDIA_SERVED` (`fileId`,`bytesServed`,`range*`,`signed`,`expiresAt?`) |
| 39 `listEvidence` / 40 `getEvidence` / 41 `verifyEvidence` | existing | reads `evidence` | `NONE-R` |
| 42 `exportEvidence` / 87 `getEvidenceExportJob` | `PERMISSION EVIDENCE_EXPORT` | reads `evidence.exportJob` | `EVIDENCE_EXPORTED`; failure `EVIDENCE_EXPORT_FAILED` |

### 6.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G7 Playback (open media session) | `EVIDENCE_VIEW` | "Checking your permissions..." while the role resolves; the player then opens | Op 88 signed URL (HMAC-signed, bound to `(operatorId, sessionId, evidenceId, fileId)`, TTL `EVIDENCE_MEDIA_SESSION_TTL_MS` — SEC35-12; `03_api_contract.md §2.4`) | `403 NOT_PERMITTED`; `409 MEDIA_NOT_AVAILABLE` |
| G8 Export / composite | `EVIDENCE_EXPORT` (SUPERVISOR) | same | Op 42 job | `403` (`EXPORT_DENIED`); `409 EXPORT_IN_PROGRESS` |

### 6.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading media | Player skeleton; Checking label on the play control | same | same | E-16 |
| `409 MEDIA_NOT_AVAILABLE` | Fixed message, no player | same | same | `C3 §4` |
| `409 EXPORT_IN_PROGRESS` | Job progress already shown | same | same | `C3 §4` |
| Failed export job | `status: FAILED` (HTTP 200), `EVIDENCE_EXPORT_FAILED` | same; FAIL wording (`drift E-11`, P-16) | same | OD-16 |
| Tampered fragment | Exactly that fragment fails the v2 verify; verdict pinned per run | same | same | op 41; P-16 |

### 6.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Player | HTML5/media element with Range streaming; download via `lib/download.ts:26-41` | expo-video with signed-URL **headers** (F-31; MB-07) | expo-video with headers (MB-07) |
| Two files | Two synchronised players + band | Two synchronised players + band | Two synchronised players + band (compact) |
| Band | Canvas/SVG band from intervals | Drawn band from intervals | Drawn band from intervals |
| Development-source label **PE-125-06** | Badge on the item header and on each camera file recorded from a development source; band segments of a development microphone carry it in their legend. Data: the manifest mark (fields 124-126) or the verify result — never the current device list | same on the evidence sheet | same, compact |
| Blanking | Signed-URL prefix `mts_` added to the web error sink `runtime/error-sink.ts:52` (E-31/P-07; SEC35-13; `06_evidence_package_spec.md §G.4`) | Added to `runtime/log.ts:46` blanking; both regexes become `\b(ses|dvc|bio|mts)_` (E-31/P-07; SEC35-13) | same |

**Erratum PE-WH-13 (decisions D204, D205, D208; gate 94 findings G94-01, G94-02, G94-05; wave H drivers C1, C2 and reconcile pass R, `implementation/123_fix_wave_h_c2.md`, `implementation/127_fix_wave_h_r.md` sections 2-3; request line 10:20:00Z of `delegation_progress/file_requests.md`):** as built. (1) The web item page lists the finished exports the Core reports for
the item (operation 40 `exports`, newest first), each with "Download export"
(`apps/core-web/src/features/evidence/finished-exports.tsx:22-23`; `detail-page.tsx:358`); a
finished export is no longer downloadable only from the dialog that requested it. Tablet and
phone show the pointer to the web console. (2) The player source is decided by ONE rule per app
from the contract's members (`media.source`, `media.fileIds`, `access.play`; C3 erratum PE-WH-03):
streamable -> the sealed player; a bundled demonstration item -> bundled media WITH its demo
label; anything else -> no player and no picture, "This recording has no playable media on this
Core." + the reason. A real signature is never labelled simulated; an interrupted item is named in
the list row and the header. A client that reads `access.readTranscript: false` does not ask
operations 84 / 86. Not yet gate-verified: re-gate 94 has not run on this tree.

**Erratum PE-WK-22 (decisions D221, D223, D224; re-gate 94 finding G94b-02, MAJOR; fix wave K driver W, `implementation/141_fix_wave_k_w.md` section 2.1; `implementation/147_docs_errata_wave_k.md`) - THE WEB PLAYER STOPS A FILE THAT DOES NOT AUTHENTICATE, AND SAYS SO:** the media route stops a stream BEFORE a fragment that fails its integrity check and destroys the connection; a range that STARTS in the failed fragment answers `409 MEDIA_NOT_AVAILABLE`
with `details { reason: FRAGMENT_NOT_AUTHENTIC, fileId, seq }` (`apps/core-server/src/media-stream/service.ts:42-51` the header, `:454-462` the first piece read before the status line, `:484-492` the cut). A media element reports nothing of this (the gate saw `readyState 0`, no `error`) and cannot read the body of a `409`, so the web player ASKS the route: a file that gives no sign of life, or waits, for `STALL_CHECK_MS` = 4 s is asked about once per file and session
(`apps/core-web/src/features/evidence/sealed-player.tsx:54`, `:306-318` `watch`, `:278` `askCore`), and so is a file whose element reports an error, BEFORE any renewal of the media session (`:476` `onMediaError`). What the operator sees (`:661-678`): an alert (`role="alert"`) whose title is the shared sentence "This recording failed its integrity check at {{file}} fragment {{seq}}."
(`evidence.playback.integrity`, `packages/shared/src/i18n/en/evidence.ts:482`) with the file and the fragment THE CORE NAMED; its description "The Core server refused the fragment: it does not match the sealed package, and none of its bytes was sent." + "{{stopped}} is stopped. {{playing}} plays on." + "Run Verify for the full result." (`apps/core-web/src/i18n-web.ts:173-182`); the tile of the stopped file reads
"Stopped: this file failed its integrity check at fragment {{seq}}."; THE OTHER FILE PLAYS ON and leads (it carries the same audio track, R-4) and Play stays usable. When every file is refused the line reads "Playback is stopped." and Play is disabled. A file the Core SERVES that still shows no life reads "This file has not loaded." and never an integrity sentence. The stopped file stays off through every renewal of the media session.
Proven by component tests with a stubbed route and stream (`apps/core-web/src/features/evidence/__tests__/wave-k-w-player.test.tsx`, 19 cases); what a REAL browser does with a cut media stream (whether `fetch` delivers the bytes before the cut and then rejects; whether Chrome fires `waiting` / `stalled` or stays silent) is NOT proven: it is the re-check on lane 2. Not yet gate-verified.

**Erratum PE-WK-23 (decisions D223 (2), D224; re-gate 94 notes G94b-10 and G81b-10; fix wave K driver W, `implementation/141_fix_wave_k_w.md` section 2.1 and decision D-6, request line 18:20:30Z of `delegation_progress/file_requests.md`; `implementation/147_docs_errata_wave_k.md`) - THE INTEGRITY PROBE WRITES AUDIT ROWS OF ITS OWN:** the question of PE-WK-22 is a range request to the media route
(`apps/core-web/src/features/evidence/media-session.ts:265` `probeMediaSession`: a same-origin `fetch` with `Range: bytes=<start>-`, never cached; where the answer is cut it asks again from the byte of the cut; at most `MEDIA_PROBE_MAX_REQUESTS` = 4 requests, `MEDIA_PROBE_MAX_BYTES` = 16 MiB, `MEDIA_PROBE_TIMEOUT_MS` = 10 s, `:206-209`), and the Core records every range that stops on the package the way it records the media element's own
(API contract erratum PE-WH-04): one WARNING row `EVIDENCE_MEDIA_SERVED` ("Media stream stopped: {file} fragment {seq} ({code})") for a stream cut before a failed fragment, and one for a range refused at its first fragment (`apps/core-server/src/media-stream/service.ts:370-408` `recordServed`, the row at `:385-394`; the first fragment `:456-462`, the cut `:484-492`). So the stop of ONE tampered file on the web shows, beside the browser's own requests, a served row and a WARNING row from the probe's
question, and the audit page shows more than one row for one stop (note 141 re-drive 1). The probe asks once per file and session. The probe and its outcome hold no media path (asserted by the canary test); `media-session.ts` is a THIRD place the bearer path goes, same-origin, inside that module (note 141 decision D-7). D223 (2) closed G81b-10 as "rows are per media-session issue" (PE-WH-04). OPEN, not built: G94b-10 (the TABLET's tamper stop wrote four WARNING rows; cause read in code and not
verified on a device: the player renews once and re-asks the refused range, and the native player may repeat a failed load) and the PROPOSAL to the owner of `src/media-stream` that the Core write the "Media stream stopped" row ONCE per (media session, file, fragment) so that the count no longer depends on the client (requests 17:51:51Z and 18:20:30Z; note 143 section 6). Until then PE-WH-04's "ONE row when serving stops" holds per REQUEST that stops, not per tamper stop. [UPDATED by erratum PE-WK-42 and API contract erratum PE-WK-36 (closing pass K-Z1, decision D225): the open part is BUILT - the Core writes the row once per stop and the app no longer renews a live media session by itself; the two sentences above ("OPEN, not built", "Until then") are kept as written and no longer hold.]

**Erratum PE-WK-24 (decisions D224 (1); re-gate 94 finding G94b-01, MAJOR; fix wave K driver M1, with the tablet, `implementation/142_fix_wave_k_m1.md` sections 1.1-1.5 and 8; `implementation/147_docs_errata_wave_k.md`) - THE TABLET / PHONE SCRUBBER STATES THAT A POSITION CANNOT BE CHOSEN. SUPERSEDED BY ERRATUM PE-WK-37 (THE INDEXED VIEW HAS LANDED: D225 (1)); IT NOW HOLDS ONLY FOR A SESSION WHOSE ANSWER STATES NO INDEX:** cause, proven on the tablet: the sealed camera file the Core serves is `ftyp moov(mvex) (moof mdat)*` with no `sidx` and no
`mfra` (by design, `skip_trailer`), so the Android player (expo-video / Media3) has no duration for it and maps every seek to 0; the web seeks through its own range probing. A prototype with ONE `sidx` box placed after `moov` seeks correctly (taps at 25 / 50 / 90 % landed within 1 s). THE CLIENT now decides from what its PLAYER reports (`apps/mobile/src/features/evidence/sealed-playback.ts:111-117` `seekAvailabilityOf`: a duration means the stream can be sought; none, 0, NaN, infinity or Android's unset marker means it cannot): on a stream
that cannot be sought the scrubber is DISABLED (`sealed-player.tsx:559`), nothing is written to a player on a seek and the second file is no longer re-aligned (that write restarted it at 0), and the caption under it reads "A position cannot be chosen: the Core server sent this recording without a seek index. Play and Pause work." (`apps/mobile/src/features/evidence/sealed-player-i18n.ts:12`, key `features.evidence-player.noSeek`; `sealed-player.tsx:573-577`). One `warn` line `evidence.playback.seek` is written to the
persistent runtime log (item, file, whether the Core said it sent an index; never the source). After a renewal of the media session (a pause past 60 s, then Play) a stream without an index starts again from 0:00; the time shown is the player's own. THIS IS A STATE, NOT THE DESIGN: ruling D224 (1) is that the tablet / phone player MUST seek, through an INDEXED VIEW served by the media route (the same media bytes plus one index built from the signed manifest's fragment table; nothing in the sealed package or the export changes; operation 88
states it additively), built by the closing pass K-Z1. When that view lands the scrubber is enabled for it and this erratum and its sentence are replaced; the client asks for the view only when the contract of its build holds the request member (`apps/mobile/src/features/evidence/media-session.ts` `SEEK_INDEX_MEMBER`, `registryKnowsSeekIndex()`), and a Core that answers 422 to it is asked again without it, once. K-Z1's contract is named (`delegation_progress/contract_wave_k.md` Z1 section 1; API contract erratum PE-WK-35: the optional request / answer name `seekIndex` of operation 88), but its producer was not live when this erratum was written: the sentence and the disabled scrubber stay exactly as built until K-Z1 reports and the device has seeked an indexed view. Proven on the tablet (lane 2, real stream, before and after the lane restart) and by tests; the playback with the index was proven on a prototype file only. Not yet gate-verified. SUPERSEDED (erratum PE-WK-37, closing pass K-Z1, 2026-10-11): the producer is live and the tablet has seeked the indexed view of real items; the sentences "the sentence and the disabled scrubber stay exactly as built until K-Z1 reports", "a stream without an index starts again from 0:00" and "the playback with the index was proven on a prototype file only" are kept as written and apply only to a session whose answer states no `seekIndex`.

**Erratum PE-WK-25 (decisions D223 (1), D224 (4); re-gate 89 finding G89b-09 and re-gate 94 finding G94b-05, G94b-06, G94b-12; fix wave K driver M2, `implementation/143_fix_wave_k_m2.md` section 1 and decision 1; `implementation/147_docs_errata_wave_k.md`) - THE EXPORT CONTROL ON THE TABLET / PHONE FOLLOWS THE WEB WIZARD'S RULE: NO PRESS THAT ONLY PRODUCES A REFUSAL.** The web wizard stands (it states the
required role before anything is sent, D223 (1)); the tablet / phone now does the same. (1) On the item: when operation 40 says the caller may not export (`access.export === false`, on a Core) the Export control is DISABLED and a caption above the action bar reads "Export requires the Supervisor role." (`features.evidence.waveK.export.controlRequiresRole`, `apps/mobile/src/features/evidence/i18n.ts`; `evidence-detail.tsx:214-216`, `:426-433`, `:504-508`); no press reaches the Core, so no `EXPORT_DENIED` row
is written by a mere press. (2) In the wizard (`export-sheet.tsx:38-59`, `RequiredRole` `:639-662`): OPENING it sends NOTHING in either data mode (the old automatic probe after 400 ms is gone). A caller the Core refused, or whose role has no `EVIDENCE_EXPORT`, reads "Exporting evidence requires the Supervisor role." and "Nothing has been sent to the Core server."; where the Core already refused this caller there is NO control that sends the request; where only the role hint says so (the Core stated nothing), the explicit "Request authorization"
press (with "A request sent with your role is refused by the Core server and recorded in the audit log.") sends the audited attempt - the web wizard's own step; EVT-26 stays reachable. `access.export: true` wins over the hint: the Core's word decides; the wizard waits for operation 40's answer before it shows either. If the ruling is read as "no refusal-only press at all", that ONE button is to be removed (`coreRefused` always true) - a decision recorded in note 143 (D224 (4): the press stays). (3) DESTINATIONS: the wizard offers the case-file option FIRST, then
USB and network (the web's order); the option pre-selected is the one whose RECORDED text equals `exportDestinationDefault` of operation 40 (API contract erratum PE-WK-06); none stated = the first option; one stated that this app has no option for = nothing pre-selected and Next disabled. (4) AFTER the job: when the job ends COMPLETE or FAILED the item's own query is invalidated once, so the list "Finished exports" shows the export at once and "Exported" is no longer beside "No finished export" (`export-job-status.tsx:71`). (5) "The export is stored on the Core" is said only for a job that states its archive and
whose `202` did not say `archiveOnCore: false`; otherwise "Demonstration: no archive is written." or, when the job states none, "The Core server states no archive for this export." Proven in the app's tests only (the five cases that pinned the automatic probe were moved with the fix and were not run red first; the control is the new assertion of 0 requests / 0 rows before the press): not yet gate-verified.

**Erratum PE-WK-26 (decisions D222 (6), D224; re-gate 89 finding G89b-06; fix wave K drivers W and M2, `implementation/141_fix_wave_k_w.md` section 2.4, `implementation/143_fix_wave_k_m2.md` section 1; `implementation/147_docs_errata_wave_k.md`) - THE VERIFY FILE ROW READS "NOT RUN" FOR A CHECK THAT DID NOT RUN:** each file row of a v2 verify reports three parts, stored bytes, decrypted bytes and fragment chain. The decrypted-bytes part is "Not run", never FAIL, when the file row says
`plainChecked === false` (API contract erratum PE-WK-07), and - for a Core that does not send the member - when check V-05 of the SAME result is SKIPPED; stored bytes and chain are always the answer's flags. The tamper demonstration therefore reads "Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL". WEB: `apps/core-web/src/features/evidence/verify-v2.ts:471` `v2FilePartOutcome`; TABLET / PHONE: `apps/mobile/src/features/evidence/verify-v2.ts:466` (same function name), `verify-v2-report.tsx`. The rule of §6.2 step 6 (verdict, pinned per run) is unchanged. Not yet gate-verified. [CORRECTED for the TABLET / PHONE by erratum PE-WK-46: its function does not read `plainChecked`.]

**Erratum PE-WK-27 (decision D224; re-gate 94 findings G94b-07, G94b-08, G94b-09; fix wave K driver W, `implementation/141_fix_wave_k_w.md` section 2.5, and driver M2, `implementation/143_fix_wave_k_m2.md` section 1; `implementation/147_docs_errata_wave_k.md`) - THE WEB PLAYER BEFORE VERIFY:** (1) development marks: while no verify run of the page states a class per file, each camera tile carries the ITEM's own mark ("Development source", no kind word) when the item says
`developmentSources === true`, and the legend of the audio-source band is drawn from the item's `audioSourceIntervals[].sourceClass` (`apps/core-web/src/features/evidence/sealed-player.tsx:581-600`, `audio-source-band.tsx`); a microphone stated PRODUCTION carries none; a verify result, once it exists, wins. LIMIT: the item states no class per CAMERA file, so a tile's mark is the item's, not the file's, until Verify runs. The tablet / phone band legend is built in the same way from the item
(`apps/mobile/src/features/evidence/item-v2.ts`, `audio-source-band.tsx:35`) but it is NOT live until M1's one line in `sealed-player.tsx` passes the member (`itemIntervals`; request 17:51:51Z), and its camera tiles carry no mark before Verify; the header mark stands (D224 (4)). (2) "No interval" at 0:00: a playhead before the first interval that reads the same SECOND as the interval's start (0 ms beside a start at 21 ms; the band shows times by the second) is inside it; a gap
between intervals stays "no interval" (`sealed-playback.ts:84-92` `segmentAt`; the contract states no tolerance, the display's own resolution is a second). (3) An interrupted recording ends with a word: at the end of the leading file of an item whose `interrupted` fact is true the web reads "End of the sealed recording at {{at}}: the recording was interrupted, so it ends here." (`apps/core-web/src/i18n-web.ts:182`; `sealed-player.tsx:681-684`); the tablet's equivalent (G94b-09) is the sealed player of M1 and was NOT built. Not yet gate-verified. [UPDATED by erratum PE-WK-45: the tablet's band legend IS live since closing pass K-Z1; its end sentence is still not built.]

**Erratum PE-WK-37 (decisions D224 (1), D225 (1); re-gate 94 finding G94b-01, MAJOR; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` sections 0, 1 and 3; `delegation_progress/contract_wave_k.md` Z1; `implementation/148_docs_errata_wave_k_touchup.md`) - THE TABLET / PHONE SCRUBBER SEEKS ON AN INDEXED VIEW; THIS SUPERSEDES PE-WK-24 EXCEPT FOR A SESSION WHOSE ANSWER STATES NO INDEX:** the Core now serves the sealed camera file as an indexed view (API contract erratum PE-WK-35: the same decrypted bytes plus one `sidx` box built from the signed fragment table) and the app asks for it. The body of operation 88 carries `seekIndex: true` while the contract of the build holds the member (`apps/mobile/src/features/evidence/media-session.ts:109` `SEEK_INDEX_MEMBER`, `:116-118` `registryKnowsSeekIndex`, `:130-146` the request; a Core that answers `422` to the member is asked again without it, once); `MediaSession.indexed` is what the Core answered (`:160`). Whether a seek WORKS is still the player's own report, PE-WK-24's rule unchanged (`sealed-playback.ts:111-117` `seekAvailabilityOf`; `sealed-player.tsx:391-396` the `sourceLoad` handler). On the indexed view the player reports the duration of the recording (60.795 s for the item whose manifest says 60 795 ms), the scrubber is ENABLED (`:559`: disabled only for a stream that reports none), a tap or drag on it is written to both players (`:333-345` `seekTo`; the second file is re-aligned, `:182-184`, `:383`), and the sentence "A position cannot be chosen: ..." is not drawn. The sentence and the disabled scrubber REMAIN (`:559`, `:573-577`, `sealed-player-i18n.ts:12`, with the `warn` line `evidence.playback.seek`, `:395`) for a stream that reports no duration - a session whose answer states no `seekIndex` (an older Core, or a file whose signed table yields no exact index: API contract erratum PE-WK-35 (3)) - and so does PE-WK-24's other statement: such a stream starts again at 0:00 after a renewal of the media session (the place is written to nothing, `:402`). For a session of the view the position is KEPT across a renewal (erratum PE-WK-39). PROVEN by the driver on the tablet against the real Core (lane 2, note 145 section 3, not re-run by this pass): taps at 25 / 50 / 90 % of the 60.8 s item land on the second handed over (15.0 / 30.0 / 55.0 s; both files within 0.07 s) and play goes on; on the 296 s item seeks to 70 / 148 / 273 s, beyond what the player had buffered, close the two streams and open ranges at the new place and play goes on there; the interrupted item (29.605 s, the sealed prefix) seeks to 16 and 28 s and plays to its end. NOT PROVEN: the PHONE was not driven (the same player code; the phone-layout tests are green); a held drag with a finger (the tap was driven) is the re-check; a one-camera package was sealed in a test only. LIMITS seen and not changed (note 145 section 11): the time of an interrupted item reads "0:29 / 0:31" (the scrubber's total is the item's duration, the leading file ends at 29.6 s); the development toast over the action bar swallows the first tap after a launch. Not yet gate-verified (the targeted re-check of gate 94 has not run).

**Erratum PE-WK-39 (decisions D225 (1), D224; re-gate 94 finding G94b-10; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` section 4 and section 10 decision 1; `implementation/148_docs_errata_wave_k_touchup.md`) - THE MEDIA SESSION IS NOT RENEWED BY ITSELF WHILE IT LIVES (TABLET / PHONE); THIS REPLACES WAVE H'S "RENEW ONCE AFTER A PLAYER ERROR" (finding G94-07):** the session lives 60 s (`EVIDENCE_MEDIA_SESSION_TTL_MS`) and the player renews it ON DEMAND, never on a timer (`apps/mobile/src/features/evidence/sealed-player.tsx:16-27` the header). THE RULE AS BUILT: (1) a press of Play, or a seek, on a session that is at its end by the Core's clock (5 s margin: `media-session.ts:193`, `:196`; `sealed-player.tsx:309`) renews first and goes on from the same position, playing if it was playing (`:321-331`, `:339-343`). (2) A PLAYER ERROR renews by itself ONLY on a session that is at its end (`:356`), not at the place of the last renewal (1.5 s, `:104`, `:352`) and within the rate limit of "Open again" (`:314-319`). On a session that has NOT ended the error is the Core's answer for that place - the native player has already asked the Core for it again by itself before it reports an error - and a new media session cannot change that answer, so NOTHING is renewed: the player pauses, playback stops with its position, and the operator reads "Playback stopped at {{at}} and did not resume. A recording that fails its integrity check stops at the failed fragment: run Verify to see which." (`evidence.playback.stoppedAt`, `packages/shared/src/i18n/en/evidence.ts:481`; `sealed-player.tsx:540-551`) with the control "Open again" (`:439-444`, `evidence.ts:487`). A transient player fault of a live session therefore STOPS, with its position, where wave H retried it once and silently; that retry is what produced the second set of refused requests of a tamper stop (erratum PE-WK-42). A session at its end that fails again is worded as the session's end, never as integrity: "Playback paused: the media session ended. Press Play to continue." (`:531-539`, `evidence.ts:715`). (3) "Open again" is the operator's, rate-limited by the Core's clock (3 s, 6 s, 12 s, three tries: `:105-107`, `:313-319`, `:434-438`); it renews at the playhead and leaves the player PAUSED (`play: false`, `:437`); a press of Play then plays. (4) AFTER A RENEWAL THE PLAYER RESUMES AT THE PLAYHEAD: the place goes to the new players once when the new source is handed over (`:261`, `:271`) and again when the leading player reports the stream loaded (`:400-404`; a write made before the index was read is dropped by the Android player); the new stream's own "0:00" is not shown meanwhile (`:372-375`); taking the old source off a player makes it report the end of the stream, which is not a Pause, so that report is ignored from the hand-over until the new source has loaded (`:154-155`, `:262`, `:387-389`, `:393`) and the controls keep reading "Pause" while it plays. (4) holds for a session of the indexed view (erratum PE-WK-37); a stream without an index starts again at 0:00 (erratum PE-WK-24, the part that remains). PROVEN on the tablet (lane 2, note 145 section 3.4, not re-run by this pass): a pause of 62 s on the 60.8 s item, then Play: two new media sessions, back at 18.9 s, playing on, the control reading Pause; a seek 66 s into one playing session of the 296 s item: the session was renewed, the players at 148.0 s, playing on. Three tests of the app's suite were moved with the rule - they let the session elapse before asserting the one renewal (`media-session-canary`, `wave-h-c2-exports-playback`, `wave-k-m2-phone-layout`; note 145 section 6). The PHONE was not driven. Not yet gate-verified.

**Erratum PE-WK-40 (decisions D225, D224; re-gate 94 finding G94b-04, second half; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` section 4; `implementation/148_docs_errata_wave_k_touchup.md`) - THE ACTION BAR READS "PAUSE" WHILE THE SEALED PLAYER PLAYS (TABLET / PHONE):** the Play action of the item screen read "Play" while the sealed player played. The player tells its screen whenever it starts or stops playing (`apps/mobile/src/features/evidence/sealed-player.tsx:66-72` `onPlayingChange`, `:157-161`; it reads "Play" again when the player goes, `:161`); while it plays the action bar's label is "Pause" (the existing `evidence.media.pause`, `packages/shared/src/i18n/en/evidence.ts:175`) with the pause icon (`evidence-detail.tsx:127-128`, `:424-425`), and a press on it pauses the player (`sealed-player.tsx:425-426`). The bundled demonstration media of a simulated item keeps its own control; the rule is for the sealed player only. PROVEN on the tablet (note 145 section 0: a picture with the player and the action bar both reading Pause, and the press pausing) and by two tests. Not yet gate-verified.

**Erratum PE-WK-41 (decisions D225, D224; re-gate 94 finding G94b-13; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` section 4; `implementation/148_docs_errata_wave_k_touchup.md`) - THE STEPPER BADGE IS MOUNTED ANEW WHEN ITS LOOK CHANGES (TABLET / PHONE):** the export wizard's stepper on the tablet drew the check of a finished step and the number of the step that became current for the badge that was current from its mount only; the others were blank (the view tree held the check glyph, the screen did not). It was seen with reduced motion on, where no overlay runs, so the overlay hypothesis of the earlier note does not hold. The cause, as far as isolated: a kit `Chip` that was mounted as a PENDING badge and then changes its variant in place stops painting what is inside it. The badge's `Chip` now has a `key` made of its variant and colour, so a chip of another look is another chip and is mounted anew with its content (`apps/mobile/src/components/composed/stepper.tsx:362-370`; test id `<stepper>-badge-<i>-chip`). The component is the one stepper of the app - the export wizard, the new-session wizard, the finalizing pipeline, recovery and update use it - so the rule is the component's, not the export wizard's. The kit's own defect was not diagnosed further. PROVEN on the tablet in the wizard of one item up to "Destination" with reduced motion (the check of step 1 and of step 2 and the number "3" are drawn; note 145 section 4) and by four tests. NOT proven: the export was not run to "Complete" (all six badges is the re-check); a launch without reduced motion (the overlays with the remounted chip) is tested, not driven. Not yet gate-verified.

**Erratum PE-WK-42 (decisions D225 (1) (2), D224; re-gate 94 finding G94b-10; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` sections 3.5 and 4; `implementation/148_docs_errata_wave_k_touchup.md`) - A TAMPER STOP IS ONE WARNING ROW; THIS CLOSES THE OPEN PART OF PE-WK-23:** PE-WK-23 left open that the stop of one tampered file wrote several WARNING rows, and proposed that the Core write the row once. Both halves are built. The Core writes the "Media stream stopped" row ONCE per (operator, sign-in session, item as sealed, file, fragment, code) within 60 s; a repeat is refused the same way and logged (API contract erratum PE-WK-36; `apps/core-server/src/media-stream/service.ts:376-401`). The app does not renew a live media session after a player error (erratum PE-WK-39). Measured by the driver on the tablet before any change: one stop was 8 refused requests - two sets of (the cut and three `409` at +0.1 s, +1 s and +2 s), the three being the native player's own retry schedule (expo-video offers no switch for it) and the second set the app's renewal. After: ONE WARNING row for a playback of the tamper demonstration item (device DEV-0001, `rangeStart` 0, `rangeEnd` 4287352 in the file's offsets, `bytesServed` 2257513; two playbacks wrote seq 494 and seq 507) and 4 requests - the cut and the native retries; "one request" is not reachable from app code. The Core log holds one error line and three or four "stopped again" warn lines. The operator reads the same sentence as before, "Playback stopped at 0:03 and did not resume. A recording that fails its integrity check stops at the failed fragment: run Verify to see which.", with "Open again". ON THE WEB the same Core rule applies to the player's integrity probe (erratum PE-WK-23), which asks the place the media element asked: by the rule it adds log lines and no second row. That is read in the code and NOT driven in a real browser. LIMIT seen and not changed: the stop says "0:03" beside a clock reading "0:04". Not yet gate-verified.

**Erratum PE-WK-43 (decisions D224, D225 (K-Z2); re-gate 94 finding G94b-06; closing pass K-Z2, `implementation/146_fix_wave_k_z2.md` item 2; `delegation_progress/contract_wave_k.md` S2 section 3 and KR section 3; `implementation/148_docs_errata_wave_k_touchup.md`) - THE WEB EXPORT JOB SAYS WHAT THE CORE SAID ABOUT THE ARCHIVE (WEB):** the web reads `archiveOnCore` of the 202 of operation 42 BY THAT NAME (`apps/core-web/src/features/evidence/export-job-model.ts:96-103` `answeredArchiveOnCoreOf`: a boolean, else null; handed on by `export-wizard.tsx:527`) and a finished job WITHOUT a download says (`export-job-status.tsx:129-134`): `true` - "The export is stored on the Core ({{exportId}})." (`evidence.exportJob.onCore`, `packages/shared/src/i18n/en/evidence.ts:588`; test id `export-job-on-core`); `false` - "Demonstration: no archive is written." (`web.exportJob.noArchive`, `apps/core-web/src/i18n-web.ts:162`; test id `export-job-no-archive`); NOT STATED - "The Core server states no archive for this export." (`web.exportJob.archiveNotStated`, `i18n-web.ts:163`; same test id, `data-archive-on-core="not-stated"`). The same three states and sentences as the tablet / phone (erratum PE-WK-25 (5)). A COMPLETE job with a download shows the download row instead. Consequence for an older Core that does not send the member: the web claims no stored archive (the contract rule of API contract erratum PE-WK-06), so such a job no longer says "stored on the Core". Proven by tests that import the contract examples (`EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE` and a control for each of the other two states); not driven in a browser. Not yet gate-verified.

**Erratum PE-WK-44 (decisions D224, D225 (K-Z2); re-gate 94 findings G94b-11 and G94b-12; closing pass K-Z2, `implementation/146_fix_wave_k_z2.md` item 3; `delegation_progress/contract_wave_k.md` S2 section 2; `implementation/148_docs_errata_wave_k_touchup.md`) - THE WEB EXPORT WIZARD PRE-SELECTS THE CORE'S DEFAULT DESTINATION (WEB):** the web reads `exportDestinationDefault` of operation 40 (`apps/core-web/src/features/evidence/item-facts.ts:36`, `:99-101`, `:112`, `:152`: text of at most 120 characters, else null) and the detail page hands it to the wizard (`detail-page.tsx:405`; `export-wizard.tsx:66-72`). The option selected is: the operator's OWN choice if one was made; else the option whose RECORDED text equals the Core's default; else the first option (`export-wizard.tsx:129`, `:143-145`). The text the request records is the label of the selected option, so the Core's own default is what is recorded ("Case file transfer" on a real item, `packages/shared/src/i18n/en/evidence.ts:707`; a demonstration item reads "... (simulated)"). The wizard that opens from the LIST of several items has no answer of operation 40 and keeps the first option (the recorded text is the same on a Core in its own capture). Proven by 4 tests with the contract example, including a control with the Core naming the USB option (USB selected) and one without the member (first option); not driven in a browser. Not yet gate-verified.

**Erratum PE-WK-45 (decision D225; re-gate 94 finding G94b-07; closing pass K-Z1, `implementation/145_fix_wave_k_z1.md` section 4; `implementation/148_docs_errata_wave_k_touchup.md`) - THE TABLET'S BAND LEGEND IS LIVE (UPDATES PE-WK-27):** PE-WK-27 said the tablet / phone legend of the audio-source band was built but not live until one line of `sealed-player.tsx` passed the item's intervals. That line is in: `<AudioSourceBand ... itemIntervals={item.audioIntervals} />` (`apps/mobile/src/features/evidence/sealed-player.tsx:594`). Seen on the tablet: "Development source" beside MIC 1 and MIC 2 with no verify run (note 145 section 0). Camera tiles are unchanged and carry no mark before Verify; the header mark stands (D224 (4)). The end sentence of an interrupted recording (G94b-09, tablet half) is still NOT built. Not yet gate-verified.

**Erratum PE-WK-46 (decisions D222 (6), D224; found by the re-check of the line citations of this touch-up; `implementation/148_docs_errata_wave_k_touchup.md`) - CORRECTION OF PE-WK-26 FOR THE TABLET / PHONE:** PE-WK-26 says the decrypted-bytes part reads "Not run" for `plainChecked === false`, on the web and on the tablet / phone. That holds for the WEB, whose function takes `plainChecked` (`apps/core-web/src/features/evidence/verify-v2.ts:471` `v2FilePartOutcome`). The TABLET / PHONE function (`apps/mobile/src/features/evidence/verify-v2.ts:466-471` `v2FilePartOutcome`) takes `storedOk`, `plainOk`, `chainOk` and the list of checks only, and the string `plainChecked` appears nowhere in `apps/mobile/src` (a search of the tree): it words "Not run" only when check V-05 of the SAME result is SKIPPED, which is the older-Core rule of PE-WK-26. The two rules can word a result differently when V-05 ran for one file and not for another (the member is per file, the check per result); whether a real result shows that difference was not examined. Note 144 (line 204) says that W and M2 read `plainChecked`; for M2 the tree does not show it. OPEN: the tablet / phone does not read the per-file member; the change is the mobile owner's. Not yet gate-verified.

### 6.7 Forward-only rule

The playhead follows the media clock; the audio-source band is a static manifest overlay, not a
client timer. The v2 verify verdict is pinned per run and never flips mid-run (`drift §1.4 WB-04`,
P-16).

---

## 7. Flow 6 — Transcript pane (R-5)

### 7.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The operator opens the transcript pane of a sealed item (web evidence page; mobile evidence sheet) |
| Entry state | The sealed machine transcript is inside the package; revisions are append-only and signed |
| Data shape | `TranscriptDocument { documentVersion, language, speakerState, segments[], sha256, machineTranscriptHash, assembledAt, revision }` (op 84; `C3 §2.3`) |
| Fixture note | `TtsFixtureProvider` is **dev-side only** (`transcript-spec §B.6`); it never appears in a production client |

### 7.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Load transcript | op 84; Loading while not ready | op 84 |
| 2 | Not ready | `409 TRANSCRIPT_NOT_READY` → "The transcript is not available yet." | `C3 §4` |
| 3 | Segments | Each segment with a timestamp (`start`/`end`) and, when LABELLED, a speaker label | op 84; `transcript-spec §A.5` |
| 4 | UNAVAILABLE | Exact state string **"speaker labels unavailable"**; segments still shown unlabelled | `transcript-spec §A.4`; R-5 |
| 5 | Revise | op 85 with `baseRevision` + `changes[]`; `201` signed revision (Core Ed25519, author recorded, no approval flow) | op 85; OD-15 |
| 6 | Revision list | op 86 lists the append-only revisions with author and number | op 86 |
| 7 | Conflict | `409 TRANSCRIPT_REVISION_CONFLICT` → "The transcript revision is based on a revision that is no longer current." | `C3 §4` |
| 8 | In-package indicator | The pane marks the transcript as **inside the sealed package** (immutable original) | `transcript-spec §A.5`; R-5 |

### 7.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 84 `getTranscript` | `PERMISSION EVIDENCE_VIEW` | reads `evidence` (transcript summary) | `NONE-R` |
| 85 `createTranscriptRevision` | `PERMISSION TRANSCRIPT_REVISE` | publishes `evidence` | `TRANSCRIPT_REVISED` (`revisionId`,`authorId`,`number`,`baseRevision`,`changeCount`,`machineTranscriptHash`,`reason?`,`permission?`) |
| 86 `listTranscriptRevisions` | `PERMISSION EVIDENCE_VIEW` | reads `evidence` | `NONE-R` |

`TRANSCRIPT_REVISED` carries counts and the binding hash, never the transcript body (`C3 §5.2`).

### 7.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Allowed | Refused |
|---|---|---|---|---|
| Transcript read | `EVIDENCE_VIEW` (every role) | "Checking your permissions..." while the role resolves | Segments + revisions visible | `403 NOT_PERMITTED` |
| G6 Revise | `TRANSCRIPT_REVISE` (INVESTIGATOR + SUPERVISOR) | same | Signed revision appended | `403`; `409 TRANSCRIPT_NOT_READY`; `409 TRANSCRIPT_REVISION_CONFLICT` |

**Erratum PE-WK-28 (decisions D221 (3), D224; re-gate 81 finding G81b-02; fix wave K driver M2, `implementation/143_fix_wave_k_m2.md` section 1 row G81b-02 and section 2; `implementation/147_docs_errata_wave_k.md`) - A CACHED ANSWER THAT DEPENDS ON THE OPERATOR CARRIES THE OPERATOR IN ITS KEY (TABLET / PHONE):** after an operator change on the tablet the answer of operation 40 was kept under a key with no operator and
used while it refetched, so the next operator's page view asked operations 84 / 86 with the PREVIOUS operator's `access` and wrote two `ACCESS_DENIED` rows. The rule now: every cached read of the app whose answer depends on the signed-in operator's role or case scope has `operatorScope(operatorId)` (`operator:<id>`) as the LAST element of its key (`apps/mobile/src/lib/operator-query-scope.tsx:26`), and `OperatorQueryScope` (mounted once in `AppProviders`,
`apps/mobile/src/providers/app-providers.tsx:117`; `operator-query-scope.tsx:49`) removes every operator-scoped query when the operator changes or signs out, so nothing of one operator is drawn or used for the next. The app holds six cached reads (a search of `queryKey` over `apps/mobile/src`): item answer / `access` / media (operation 40; `features/evidence/use-evidence-media-ref.ts:55`), transcript document (84), transcript revisions (86), export job (87;
`export-job.ts:41`), STT configuration (90; `features/transcription/use-stt-config.ts:54`) - all five scoped - and the health read (`HEALTH_QUERY_KEY`), which depends on no operator and is unchanged. Every invalidation site passes the operator. Module-level maps were read too: none holds an answer of the Core. THE WEB console was not examined in this wave (the finding was driven on the tablet); its keys are not documented here: open. Proven by tests with a mutation run
(scope made constant and clearing removed: 3 of 16 failed); the tablet was not driven. Not yet gate-verified.

### 7.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Not ready | Fixed message | same | same | `C3 §4` |
| UNAVAILABLE | "speaker labels unavailable" badge; no fabricated speaker | same | same | R-5 |
| Conflict | Reload revisions, then re-edit | same | same | OD-15 |
| Empty revisions | "No revisions" | same | same | op 86 |

**Erratum PE-WK-29 (decisions D221 (3), D224; re-gate 81 findings G81b-07 and G81b-09; fix wave K drivers W and M2, `implementation/141_fix_wave_k_w.md` section 2.6, `implementation/143_fix_wave_k_m2.md` section 1; `delegation_progress/contract_wave_k.md` KR section 2; `implementation/147_docs_errata_wave_k.md`):** two lines of the transcript pane.
(1) THE REVISION REASON LINE. Each revision of the list shows the reason its author gave: "Reason: {{reason}}" (WEB, `apps/core-web/src/i18n-web.ts:154`; `features/evidence/transcript-pane.tsx:340-341`; TABLET / PHONE, the label "Reason" and the text, `apps/mobile/src/features/evidence/transcript-pane.tsx:348`). The source is the revision's own `reason` member of operations 85 / 86 (API contract erratum PE-WK-02), read first (`apps/core-web/src/features/evidence/transcript-model.ts:137-150` `revisionReasons`). Only for an entry WITHOUT the member (a Core older than the member) does the web read
the `details.reason` of the `TRANSCRIPT_REVISED` row of the same item and revision id in the console's audit slice, for a role that reads that slice; if neither exists the web reads "Reason: not reported" (`reasonNotReported`, `i18n-web.ts:155`) - never a guess; the tablet / phone draws no reason line for an entry that states none. Absent = "not stated".
(2) A REFUSAL BY CASE SCOPE IS ABOUT THE CASE, NOT THE ROLE (TABLET / PHONE). A `403` of operation 84 with `details.reason: EVIDENCE_CASE_SCOPE` reads "You are not assigned to the case of this item, so its transcript is not shown." (`features.evidence.waveK.transcript.deniedCaseScope`); a `403` with no reason keeps the role sentence "Your role cannot read this transcript."; another reason reads the neutral sentence (`apps/mobile/src/features/evidence/transcript-model.ts:170` `deniedReadKindOf`).
A caller operation 40 already refused (`access.readTranscript: false`) gets ONE sentence in the pane, not that one beside "You are not permitted…" (`transcript-pane.tsx:101`, `:144`). The web was not changed for (2). Not yet gate-verified.

### 7.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Evidence → transcript pane (WB-04) | Evidence sheet → transcript (MB-07) | same, compact |
| Segment list | Virtualised list; constant card border if rows | `SelectionGlow` constant border (`drift E-15`) | compact rows; constant border |
| Author/number | Shown per revision | same | same |
| Original immutable | "Sealed original — immutable" note | same | same |

**Erratum PE-WK-30 (decisions D221 (3), D224 and D160; re-gate 81 finding G81b-06; fix wave K drivers W and M2, `implementation/141_fix_wave_k_w.md` section 2.6, `implementation/143_fix_wave_k_m2.md` section 1; `implementation/147_docs_errata_wave_k.md`) - THE TRANSCRIPT MODEL BLOCK:** which model made the sealed transcript was stated on no client, so the sentence of D160 reached no operator. The pane now shows a block "Transcript model" from the item's
`transcriptModel` (API contract erratum PE-WK-05), by name, for an item that states one. LOCAL backend: the model name, "Version (declared by the installation)", "Quantisation" and "Model file SHA-256", each as the item states it (a member that is `null` reads "Not reported" on the web, "not stated" on the tablet / phone). SERVER backend (`reportedByServer: true`): the name and the Core's own sentence in `report` (reported by the STT server, not verified by the Core), and NO version,
quantisation or hash line. An item without the member draws nothing - no default, no placeholder. WEB: `apps/core-web/src/features/evidence/transcript-pane.tsx:270-312` `TranscriptModelFacts`, labels `web.transcript.model.*` (`i18n-web.ts:147-153`: "Transcript model", "Model", "Version (declared by the installation)", "Quantisation", "Model file SHA-256"); TABLET / PHONE: `apps/mobile/src/features/evidence/transcript-pane.tsx:240` `TranscriptModelLines`, labels
`features.evidence.waveK.transcript.model.*` (`features/evidence/i18n.ts:266-272`: "Transcript model", "Name: {{name}}", "Version (declared by the installation): {{version}}", "Quantisation: {{quantisation}}", "Model file SHA-256: {{hash}}"), not drawn beside a refusal of access. An item that was already read by a RUNNING Core gets the member at that Core's next start. Not yet gate-verified (the clients' tests import the contract examples).

### 7.7 Forward-only rule

Timestamps are media-pts (segment `start`/`end`); no client timer drives them. The transcript revision
number is monotonic and append-only (op 86); the pane never hides a newer revision.

---

## 8. Flow 7 — Session gating (R-6)

### 8.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | An operator tries to create/start a session while the previous one is not `SEALED` |
| Entry state | Any open session; a new session is blocked until the previous reaches `SEALED` (rooms may wait) |
| Behaviour | `createSession` refuses with `409 SESSION_ACTIVE`; **no** audit row (a typed refusal) |

### 8.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | New session pressed | "Checking your permissions..." resolves first | E-16 |
| 2 | Blocked | Blocking presentation: "A session is still being sealed"; the Seal progress is linked | `C3 §4` (`78-80 vs 24` note); op 27 |
| 3 | Sealed reached | The blocker clears; the new-session action enables | op 27 |
| 4 | Start checks | `startSession` precheck states (existing). **PE-125-07:** each run also checks every configured camera and microphone for reachability; the camera and microphone rows follow the start rule of §8g.3 (blocked / warning with acknowledgement / the active-microphone rule), and an unreachable device raises the notification of flow 11 (situation B) | op 25; `beginPrecheck` / `retryPrecheck` (`C3 §3.1`); D80(6), D81 |
| 5 | Accepted start, before the first durable fragment | **Erratum PE-128-79:** Session Monitor (WB-01) and Session Live (MB-03) read **"Connecting cameras…"** — no recording timer, no recording indicator, no meter presented as recording; "Recording" appears only from the first durable fragment (D84) | the session payload member `captureDurable` (ruling R-1 option A, D91); D84; D82(f) |

### 8.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 24 `createSession` | `PERMISSION SESSION_START` | reads/publishes `session` | `409 SESSION_ACTIVE` = no row |
| 25 `startSession` | `PERMISSION SESSION_START` | `session` | existing |
| 27 `getCurrentSession` | `AUTHENTICATED` | `session` + v2 `finalization` | `NONE-R` |

### 8.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Blocked | Refused |
|---|---|---|---|---|
| G10 Session start (New/Start) | `SESSION_START` | "Checking your permissions..." | Blocked while a session is open (not SEALED) | `403 NOT_PERMITTED`; `409 SESSION_ACTIVE` |

### 8.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading | New-session button in Checking | same | same | E-16 |
| Previous not sealed | Blocking card with a link to progress | same | same | R-6 |
| Permission refused | Disabled + role sentence | same | same | E-16 |
| A configured camera or microphone is unreachable **PE-125-07** | The row names the device (label and id) and, for a camera, the count of the one search the pre-check ran; blocked or warning `Alert` per §8g.3; Search again (G13 / G17) and Retry | same in `DevicesCheckStep` | same | R-10 AC-2; §8e.2, §8g.3 |
| No camera connected at session start **PE-125-07** | Fault presentation "No camera connected. Nothing was recorded." — no timer, no recording indicator, no meters | same | same | D72(k); §8e.2 situation C |

**Erratum PE-WH-11 (decisions D203 (1), D209, D210; gates 75 / 89 findings G75-01, G89-01; closing passes Z1 and Z2, `implementation/128_fix_wave_h_z1.md` item 1, `implementation/129_fix_wave_h_z2.md` items 1a, 1d, 1e and "+"):** a Core in its own capture
states the host system clock (`time.hostClock: true`; C3 erratum PE-WH-05), and the clients word
it so. (1) The pre-check TIME item is a NOTE: its own neutral chip "NOTE" on web and mobile (not
WARN), the text "Time source: host system clock (no GNSS)"; it is not counted as a warning, the
outcome stays PASS and no acknowledgement is asked. (2) The mobile Session Live chip reads "TIME
Host system clock" (tone info, never "LOCKED"); the mobile Summary Start / End chips read "Host
system clock" in a neutral chip. (3) Beside a session of the Core's own capture the web Monitor
banner reads "SESSION ACTIVE" + the capture state (not "SESSION ACTIVE & SECURE / All integrity
checks passing"), and draws no write speed, write-rate curve or Auto-Save figure; the capture
checkpoint facts (`session.captureCheckpoints`) are drawn on both apps, absent = nothing, never
0. Simulated capture is drawn as before. Re-gate 75 has NOT passed: not yet gate-verified.

**Erratum PE-WI-16 (decision D217; re-gate 75 finding G75b-06; fix wave I drivers B and C, `implementation/133_fix_wave_i_b.md` section 2.3 and decision D-1; `implementation/134_fix_wave_i_c.md` section 1 row G75b-06):** the host-clock wording outside a
session, on the one mark `time.hostClock`. WEB: Dashboard strip "Time - Host system clock";
Dashboard card time column "HOST CLOCK" (the tooltip quotes no stratum, offset or last sync) and
platform column "NOT REPORTED - TPM: not reported - Secure Boot: not reported", both neutral and
not counted as "need attention"; Network & Time: banner "Host system clock" with "no time service
configured", the hierarchy panel states the one fact (no constellation, tiers, lock, stratum, last
sync, offset or server), the offset panel says "Not measured", no "RTC holdover" toast; header
checklist rows "Host system clock" and "Not reported"; the Monitor's session size is the durable
bytes of the capture checkpoints, a dash when none is stated
(`apps/core-web/src/i18n-web.ts:21-48`; `apps/core-web/src/lib/own-capture.ts`). MOBILE: the Home
time chip reads "Time: Host system clock" (tone info) instead of "GNSS / Time: RTC"
(`apps/mobile/src/features/dashboard/home-model.ts:432-433`; `use-home-data.ts:183`). "Not
reported" is worded by the CLIENT on that mark; the Core's own statement about the TPM is ruling
D217 (7), outside this erratum. OPEN, not built: the mobile Network & Time screen still words a
host clock as "RTC (holdover)" (`implementation/134_fix_wave_i_c.md` section 5); the web Storage page KPI "session size"
and the web Security Posture column were not changed (`implementation/133_fix_wave_i_b.md` decision D-1, section 7). Proven in the clients' tests only: re-gates 70 and 75 have NOT passed, so this is not yet gate-verified.

**Erratum PE-WI-18 (decisions D207, D217 (ruling 2); gate 89 finding G89-02, re-gate 75 finding G75b-05; fix wave I driver C, `implementation/134_fix_wave_i_c.md` section 1 row G75b-05 and decision 1):** STILL LOADERS. On tablet and phone
a running pre-check row, the pending sign of Next / Start Recording / "Run checks again" and the
running badge of the wizard Stepper show a STILL loader glyph drawn by React, not the kit
`Spinner` / `PendingSpinner` the tables of §8b, §8c and §8g name for those places; the Stepper
replays its entering motion only on the first copy of a visit. Reason: a kit Spinner that is
removed while its animation runs wrote the Reanimated lines the logcat criterion (B9, 0 lines)
counts - the same cure wave H used at the Finalizing hand-over (D207). Nothing is silenced. It is
accepted "to be confirmed by logcat = 0 at the re-gate": NOT yet gate-verified.

**Erratum PE-WI-34 (decisions D217 (5), D218; re-gate 75 finding G75b-03; closing pass J item 2, `implementation/135_fix_wave_i_pass_j.md`; `implementation/137_docs_errata_followup.md`):** the restart fault of a Core in its own capture (C3 erratum PE-WI-21) is worded from
its member `coreNotRunning`, never from its kind. **Label** "Core was not running" wherever a surface would name the fault kind (instead of "Power failure"); **sentence** "The Core was not running while this session was active. It does not know why it stopped."
where a sentence stands (alert, event, audit row, Finalizing alert). Recovery rows read "{product} is running again. It was not running while this session was active" and "The Core is running again - the fault of the time it was not running is cleared".
WEB: header pill "Critical fault: Core was not running" (`apps/core-web/src/components/shell/integrity-checks.ts:90-91`, `:108`, `:115`); Session Monitor banner reason (`features/session-monitor/status-banner.tsx:32-34`) and timeline
(`timeline-panel.tsx:84`); Security & Audit log, where the row's `details.coreNotRunning` decides (`features/security-audit/model.ts:187-188`, `:231`; `audit-log-panel.tsx:432`). TABLET / PHONE: Home flag line (`apps/mobile/src/features/dashboard/use-home-data.ts:64-73`),
Recovery screen (`features/session-recovery/session-recovery-screen.tsx:594-596`), Sessions hub active card (`features/sessions/hub-top.tsx:76`, `:132`), Finalizing interrupted alert (`features/session-finalizing/session-finalizing-screen.tsx:444-446`), Audit list
(`features/audit/use-audit-data.ts:89-90`) and audit entry detail (`features/audit/audit-entry-detail.tsx:49`). The label and the sentence are the shared `common.coreNotRunning.label` / `.sentence` (`packages/shared/src/i18n/en/common.ts:1114-1117`).
Absent member = the fault is what its kind says: the SIMULATED lane and the in-app simulator keep "Power failure" / "Power fail detected". LIMITS, not built (ruling 3 of D218; they go with the cause `CORE_STOPPED` of the next task): the mobile Sessions detail and the history entry of an
INCOMPLETE session that ended this way still read "Power failure" (the history keeps `faultKind: POWER_FAIL` with no member), and an interrupted seal still names `POWER_FAIL`; the web Devices page still draws the AC input port down while a `POWER_FAIL` fault is active
(`features/devices/sim-adapter.ts:181`). Proven in the clients' tests only: not yet gate-verified (re-drive list of note 135 section 6).

**Erratum PE-WI-35 (decisions D217 (7), D218; re-gate 75 finding G75b-06; closing pass J item 1, `implementation/135_fix_wave_i_pass_j.md`; `implementation/137_docs_errata_followup.md`) - REPLACES THE CLIENT-SIDE RULE OF PE-WI-16:** PE-WI-16 said "Not reported" is worded by the client on the mark `time.hostClock` and that the Core's own statement was outside it.
The Core now states it (C3 erratum PE-WI-20: `security.platformNotReported`), and every surface reads THAT member by name, each row from its own member (the platform from `security.platformNotReported`, the time from `time.hostClock`). Wording (shared,
`packages/shared/src/i18n/en/common.ts:1122-1128`): value "Not reported", "TPM: not reported", "Secure Boot: not reported", "Posture: not reported", note "This Core does not read a TPM or the Secure Boot state."; neutral tone, never counted as "need attention".
WEB: Dashboard strip Security cell (`features/dashboard/status-strip.tsx:39-40`, `:103-104`); Dashboard card platform column and **posture column** (`features/dashboard/security-panel.tsx:135-169`, `:219-227`; `dashboard-model.ts:171-177`) - the
column PE-WI-16 left unchanged; header checklist row `platform` (`components/shell/integrity-checks.ts:125-136`); Security & Audit: posture panel and banner read "Not reported" (`features/security-audit/status-banner.tsx:16-30`, `:63`) and the TPM, Secure Boot
and Key custody rows read "Not reported" with status UNKNOWN (`security-audit/model.ts:333-380`; `controls-panel.tsx:77-81`); System > About TPM row (`features/system/about-panel.tsx:91-92`). TABLET / PHONE: Home Security chip
(`apps/mobile/src/features/dashboard/home-model.ts:413-436`; `use-home-data.ts:197`, `:211`) and Settings > About TPM field (`features/settings/about-section.tsx:25`, `:40-41`). A posture that names a fault keeps the fault (the statement is made when the posture reads
`SECURE`). On such a Core no surface draws "TPM 2.0 Verified", "SECURE / All controls active" or "Attestation OK". The three required members keep their placeholder values (C3 PE-WI-20): the lists that read them directly - the web Devices "other devices"
TPM entry and the mobile Devices list (`packages/shared/src/sim/devices.ts:93`) - still say "OK" and are OPEN (ruling 1 of D218). Simulated capture is drawn as before. Proven in the clients' tests only: not yet gate-verified.

**Erratum PE-WI-36 (decisions D217, D218; re-gate 75 finding G75b-06; closing pass J item 3, `implementation/135_fix_wave_i_pass_j.md`; `implementation/137_docs_errata_followup.md`) - CLOSES THE TWO "OPEN, NOT BUILT" CLAUSES OF PE-WI-16:** (1) MOBILE Network & Time on a Core whose `time` slice says
`hostClock` (`TimeView.hostClock`, `apps/mobile/src/features/network-time/network-time-model.ts:154-172`): the time card names the clock with one sentence, "Time" / "Host system clock" and "This Core takes its time from the host system clock. GNSS, network time and a hardware clock
are not configured, so no lock, stratum, offset or last synchronisation exists." - no orbit, no tier row, no last sync, no server (`features/network-time/time-sync-card.tsx:49-72`; `common.hostClockTime.*`, `packages/shared/src/i18n/en/common.ts:1134-1138`); the system time chip reads
"Host system clock" in a neutral tone, not "RTC (holdover)", "Free-running" or "Synchronized" (`system-time-card.tsx:46`, `:55`); no holdover toast (`use-network-time.ts:83-102`). (2) WEB Storage page, KPI "session size" (`apps/core-web/src/features/storage/kpi-cards.tsx:37-44`, `:88-94`):
beside a session of the Core's own capture it is the **durable bytes of the capture checkpoints** (`captureCheckpointsOf(session).bytes`, the reader the Monitor's storage panel uses, in GB), not the simulator's formula `session.bytesWritten`; when no checkpoint states a byte count it is a dash whose accessible label reads
"No durable recording data yet" (`web.ownCore.sessionSizeNotStated`, `i18n-web.ts:45`). The simulated lane keeps `session.bytesWritten`. The web "Security Posture column" clause of PE-WI-16 is closed by PE-WI-35. Proven in the clients' tests only: not yet gate-verified.

**Erratum PE-WI-37 (decisions D217, D218; re-gate 75 finding G75b-01; closing pass J item 7, `implementation/135_fix_wave_i_pass_j.md`; `implementation/137_docs_errata_followup.md`):** a start the Core refuses before recording because of the session key (C3 erratum PE-WI-22: `503 NOT_READY`, `details.reason`
`SESSION_KEY_NOT_OF_SESSION` or `SESSION_KEY_STORE_UNAVAILABLE`) shows the Core's own sentence as the description of the danger toast whose title is the start-failed title of that client, instead of "The Core server is starting". The sentences
(`common.startRefused.<reason>`, `packages/shared/src/i18n/en/common.ts:1144-1148`, word for word the Core's `SESSION_KEY_START_TEXT`): `SESSION_KEY_NOT_OF_SESSION` - "This session cannot be started: a session key of an earlier session with this session number is in the Core's key store, so its recording
could not be sealed. Nothing was recorded. Cancel this session and create a new one." `SESSION_KEY_STORE_UNAVAILABLE` - "This session cannot be started: the Core's key store cannot be used, so its recording could not be sealed. Nothing was recorded." Title: web "Recording could not start. Check the devices and try again."
(`sessionNew.errors.start`); mobile "Recording could not start. Please try again." (`startFailed`). WEB: `features/session-new/index.tsx:397-399`; MOBILE: `features/session-new/use-session-new.ts:205-208` (the action is logged at `warn`). The pre-check is not concerned (the refusal belongs to `startSession` only); the session stays ARMED and can be cancelled. Any other
503, and one without a reason, keeps the general "starting" wording. Not changed (open): `CAPTURE_HELPERS_LEFT` is a `503 NOT_READY` too and is still worded "starting". NOT proven by a test: the rendered toast on either client (the reader, the travel of the reason and the sentences are) - a gate check.

**Erratum PE-WK-31 (decisions D220, D224; re-gate 75 findings G75c-07 and, with it, G81b-08; fix wave K driver M2, `implementation/143_fix_wave_k_m2.md` section 1; `implementation/147_docs_errata_wave_k.md`) - CONNECTING STATES ON HOME (TABLET / PHONE):** a session is "connecting cameras" from the accepted start until the first durable fragment (`session.captureDurable === false`, C3 erratum PE-128-34, D84). Home drew it as recording. Now:
(1) the header status chip reads CONNECTING in the neutral tone, never RECORDING (`apps/mobile/src/features/dashboard/home-header.tsx:62-63`, `:83-85`; label `common.session.trackConnecting` = "CONNECTING"); (2) the microphone tiles draw the word CONNECTING in the place of the meter - no meter, no dBFS figure, no Active / Standby state (`features/dashboard/device-tiles.tsx:114`, `:171-185` `MicConnecting`); (3) the no-preview tile of a camera that has no named cause (no active notice)
and is not "On" reads "Connecting cameras…" (`common.session.connectingCameras`) and not the roster's "Not reachable", which nothing has established yet; a named cause and "On" keep their own words (`features/devices/camera-preview.tsx:118-130`). (4) The Session Live clock has a slot of fixed height from the first layout (`features/session-live/session-live-screen.tsx:699`, `:769`, `MONITOR_TIMER_SLOT_HEIGHT` = the `display` line height), so the card does not keep the connecting height when the timer
appears (G81b-08, "clock half covered"); that is a layout RULE proven by test - the cause in the layout engine was not established without a device and the pixels are a re-drive. The recovery screen that shows for a moment at an interruption is NOT a connecting state: see PE-WK-21. Not yet gate-verified.

**Erratum PE-WK-32 (decisions D220, D222 (1), D222 (2), D224 (3); re-gates 75 and 89 findings G75c-04, C-2 (held MAJOR by D222 (1)), G89b-01 mobile half; fix wave K drivers W and M2, `implementation/141_fix_wave_k_w.md` sections 2.2, 2.9 and 3, `implementation/143_fix_wave_k_m2.md` section 3; `implementation/147_docs_errata_wave_k.md`) - THE SWEEP OF SIMULATOR CONSTANTS ON A CORE IN ITS OWN CAPTURE:** extends PE-WI-16 and PE-WI-35 from the TPM / posture / time sentences to every
sentence of the same class. THE RULE (web): a Core is a Core in its own capture when its state carries `security.platformNotReported` OR `time.hostClock`, both read by name (`apps/core-web/src/lib/own-capture.ts:75` `isSelfCaptureCore`); each surface keeps its own member (TPM / Secure Boot / posture / controls / keys from `platformNotReported`, the time from `hostClock`, throughput from either); a value that shows a FAULT keeps it everywhere (an open enclosure, a failed TPM, a broken chain are facts of the state);
the signing key a page names is the key THE CORE REPORTS - the `signature.keyId` of its newest sealed item whose signature is not the simulated stand-in (`own-capture.ts:100` `reportedSigningKeyOf`), or, with no such item, "No sealed item of this Core names a signing key yet." (no member of the state names the key: request 18:20:20Z asks for one; open). THE SIMULATED LANE reads neither member and is UNCHANGED, and every page has a control case that pins it. What changed on a Core in its own capture, by page
(the full sentence-by-sentence table, with each source member, is note 141 section 3): SECURITY & AUDIT - no "DEMO" key or certificate, no "TPM 2.0 (fw ...)" or "never exported", no "RTC holdover": "Ed25519 • CORE-KEY-EVSIGN-01" with "DEVELOPMENT KEY" when the Core says so, "1 of 9 active · 8 not reported", Encryption, Signed firmware, Enclosure tamper switch, device certificate, TLS certificate and hardware root key "Not reported" with a sentence that the Core does not read or report them, the secure timestamp "Host system clock. No time service is configured: nothing is locked and nothing is in holdover."; DEVICES - GNSS and an unread TPM
are not counted in the banner ("7/7"), the TPM and GNSS rows and drawers, the LCD lines ("HOST CLOCK", "TPM NOT REPORTED · SECURE BOOT NOT REPORTED", "REMAINING TIME NOT REPORTED") and the camera tile format, camera drawer model / firmware / format / bitrate / port say "Not reported" or are not drawn; DASHBOARD - "Platform security: not reported", "OPERATIONAL • NO FAULT REPORTED"; STORAGE - write speed and estimated remaining "Not reported" with the reason, no "at 8.2 GB per hour"; NETWORK & TIME - the A/V sync strip "Not measured";
SESSION MONITOR - "Est. Remaining" "Not reported", the inputs panel's "1080p • 25 fps" not drawn, the seal dialog of a REAL item shows the manifest digest, "Ed25519, Core key CORE-KEY-EVSIGN-01", "Signed with a DEVELOPMENT key — not a production signature" and "Recorded from development sources - not from production devices." and never "No DEMO package exists for this item." (`apps/core-web/src/features/session-monitor/real-seal-facts.ts:17`, `finalization-modal.tsx:175`); SYSTEM - About "Device certificate" and "Camera firmware" "Not reported", Settings "Time source: Host system clock", Diagnostics "Security (TPM, Secure Boot)" "Not reported" (FAIL / WARN stay);
HEADER CHECKLIST - Evidence encryption and Enclosure tamper seal "Not reported". TABLET / PHONE: Storage write speed and time left read "—" and "Not reported" (`apps/mobile/src/features/storage/storage-kpis.tsx:36-47`; the session size stays the Core's count), Settings > About "TPM model / firmware" reads "Not reported" (`features/settings/about-section.tsx:25`, `:41`; now tested on phone and tablet), and the Session Live format chip "1080p • 25 fps" is not drawn beside a recording of the Core's own capture
(`features/session-live/live-feed.tsx:209-214`; relabelling it "configured" was not chosen). CONFIGURED PROFILE (client rule of C3 erratum PE-WK-13): the web Monitor's details row "Profile" reads "Configured profile" with the Core's sentence when the session carries the notice `STREAM_PROFILE_DIFFERS` (`apps/core-web/src/features/session-monitor/sim-adapter.ts:128` `streamProfileNoticeOf`; `i18n-web.ts:138`); the item pages carry no "profile" label and were not changed; the mobile app does not read the notice. NOT CHANGED, by ruling D224 (3) (accepted; "to be looked at in
the judging session"): the rest of the appliance model a development Core still carries, listed in note 141 section 3 as "model" - PoE switch and port map, relay lamp, tablet link, network interfaces, bandwidth and VLANs, services and uptimes, CPU / temperature / fan, update slots, the System volume and its SMART values, and the identity fields under their "Synthetic demo values" chip (the mobile Devices screen lists no TPM / attestation / GNSS entry for a registered device; its Network & Time is pass J's). They claim no security property and no measurement of the recording; wording each as "Not reported" would empty four pages, which is a
product decision (hide the appliance pages on a Core in its own capture, or word them). STILL OPEN as code: the three readers still fed by the platform placeholders named in C3 erratum PE-WI-20. Proven in component tests only (`apps/core-web/src/test/wave-k-w-real-core.test.tsx`, 26 cases; `apps/mobile` `features/storage`, `features/settings/wave-k-m2-about-facts.test.tsx`): not yet gate-verified.

**Erratum PE-WK-33 (decisions D224; re-gate 81 finding G81b-03, MAJOR; fix wave K driver M1, with the tablet, `implementation/142_fix_wave_k_m1.md` sections 3.2, 3.3 and decision 3; `implementation/147_docs_errata_wave_k.md`) - REDUCED MOTION IS NO PANE RE-FLOW ANIMATION (TABLET / PHONE):** under reduced motion the shared `Pane` carries NO `layout` prop, and `layoutTransition()` returns `undefined` when reduced; under full motion the spring re-flow is unchanged.
CAUSE, proven on the tablet with a minimal pane: on this stack (Reanimated 4.5.1, new architecture) a layout transition that is REDUCED - `ReduceMotion.System` while the app is set to reduce, or a zero-length `ReduceMotion.Always` transition - is skipped WITHOUT the new frame being applied, so a pane whose content grew after its mount kept its old height and its lower content lay outside its box, where Android delivers no touch. The Session Summary's right pane did exactly this when "Sealed files" arrived
from the Core: "Done", "View in Evidence" and the sealed rows took no tap (the box ended at y = 580 while the content drew to about 1490). It hit every user with reduced motion and every gate (the gates launch with `motion=off`). After the fix, on a fresh session, the box held its content and the three controls answered real taps. Where: `apps/mobile/src/layout/pane-layout.tsx:20-33`, `:107-117` (`paneReflowFor(policy)`), `apps/mobile/src/motion/builders.ts:252-272` (`layoutTransition`); the one other caller,
`features/dashboard/system-status-card.tsx:85`, takes `undefined` as it is; the only other Reanimated layout transition, `components/composed/session-timeline.tsx`, already had none when reduced, and a static rule now pins that no layout transition is applied when reduced. The phone was NOT driven (its lane was stopped): by code and test its Summary had the same transition. Launching WITHOUT `motion=off` (the spring path) was tested, not driven. Not yet gate-verified.

**Erratum PE-WK-34 (decisions D224 (2); re-gates 75 and 89 findings G75c-02 and G89b-03; fix wave K driver M1, `implementation/142_fix_wave_k_m1.md` section 4; `implementation/147_docs_errata_wave_k.md`) - THE MOUNT-WARNING LIMIT: B9 COUNTS THE APP'S ERROR LINES, THE LIBRARY WARNING IS A DOCUMENTED LIMIT.** The criterion B9 (FXR-DEV-2, "0 lines" of Reanimated mount warnings in the logcat, quoted by PE-WI-18) is read as: the number of ERROR lines of the app is 0 at every gate. It is NOT read as "no line of
the library". NO native patch and no Gradle build is made now. THE LINE: `Reanimated: synchronouslyUpdateUIProps failed for tag N`, with the exception `RetryableMountingLayerException: Unable to find SurfaceMountingManager`, logged at WARN level by the library (`node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt:248-262`, a `Log.w` in the `catch` of `synchronouslyUpdateUIProps`). THE CAUSE, read to the line in two libraries and proven on the device by the owner of every failing tag:
every `react-native-svg` element dispatches a layout event from INSIDE Android's draw pass when its rectangle is new (`node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/VirtualView.java:608-620`); Reanimated, listening to every event, pushes the props of EVERY view in its registry straight to the native views in that pass (`ReanimatedModuleProxy.cpp:815-824`, `UpdatesRegistry.cpp:165-175`); a view React has just REMOVED stays in that registry until the mount hook runs after the draw of the same frame
(`ReanimatedMountHook.cpp:51`), and a tag with no mounted view makes React Native throw. So WARNINGS = (kit-animated views removed in a commit) x (SVG elements first drawn in the same frame). Nothing is wrong on screen: the props of a removed view have no target. The class is every kit control with press feedback (each `Button`, each row, each `Select`) plus the kit `Spinner`, which is why wave I's screen-by-screen spinner swap (PE-WI-18) could not reach 0 and why no product file was
changed for this item: no shared JavaScript place stops a kit control from being in the registry or stops the SVG events. Measured on the tablet (lines): the pre-check commit of Session New 192 and 208 (two runs), the Session Live mount 8, an item opening 79 and 19, each Verify press 77 (five presses, 385), the player open 6, the export wizard to "Reason" 2, the Evidence list mount 395 once; 0 at Session New open, to Ready, and at Monitor -> Finalizing -> Summary. THE CURE, listed for the release-build session before handover, not done: A (recommended) skip, in
`NativeProxy.kt`, a tag that has no mounted view before `updatePropsSynchronously` (3-4 lines, through the project's patch mechanism; one Gradle build); B dispatch the svg layout event only when an `onLayout` handler exists; C accept the re-worded criterion (this erratum). Not yet gate-verified: the counts above are a driver's measurements.

### 8.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Session New (WB-03) | Session New (MB-02) | Session New (MB-02) |
| Blocking presentation | Inline blocking card + progress link | Modal + progress link | Full-screen card + progress link |
| Hand-off on start | Monitor | In-place `monitor-handoff.ts` | same |

### 8.7 Forward-only rule

The blocker reads the session state (not a local countdown); when `SEALED` arrives the UI unblocks. No
client timer decides the unblock.

---

## 8a. Flow 8 (CONFIRMED) — STT configuration menu (R-8; D24, Q-STT-CFG answer (a)) **Erratum PE-R8-13 (D24)**

> **Status: confirmed (D24, 2026-10-08: Q-STT-CFG answered (a), all 13 defaults; D20).** With it: flows
> 8/8 (24 client definitions), gated controls G11-G12 added. The 7/7 flow and 10/10 gated-control figures
> and the self-gate elsewhere in this file were not restated by the status sweep (**Erratum PE-R8-13**,
> status wording only). Operations 90-92 (`C3 §2.5`), audit `STT_CONFIG_CHANGED`; no new slice.

| Aspect | Web console (edit) | Tablet | Phone |
|---|---|---|---|
| Entry | System → **Transcription (STT)** configuration page next to the capture devices entry (WB-07 pattern) | Settings → Transcription status (MB-09 pattern), **read-only** | same as tablet, **read-only** |
| Content | enabled/disabled switch; backend (`omlx-server` / `cpu-local`); endpoint (loopback URL, server backend only); model; language (Indonesian, fixed); speaker labelling on/off; credential field (write-only, never pre-filled; shows "set" / "not set" and kind REFERENCE/ENCRYPTED only); last connection test result | enabled/disabled, backend, model, labelling, last test result, "applies to the next session" note when pending | same |
| Actions | Save (op 91; optimistic `revision`); **Test connection** (op 92) | none | none |
| Gated control | G11 "Save STT configuration" and G12 "Test connection": `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN); every other role sees the **"Checking your permissions..."** state, then the disabled control with its reason | read-only view for every role (op 90 is `AUTHENTICATED`) | same |
| Saved while a session is open | banner "Saved — applies to the next session" (`appliesFrom: NEXT_SESSION`); the session monitor keeps showing the current session's transcript state | status shows "pending for the next session" | same |
| Disabled state elsewhere | sealing progress shows the transcript step as "disabled by configuration" (completed, not failed); the evidence transcript pane shows "Transcript disabled by configuration" instead of an error (flows 3, 6) | same | same |
| Errors | `422 INVALID_INPUT` with `ENDPOINT_NOT_LOOPBACK` → field message "Only a local (loopback) address is allowed"; revision conflict → reload prompt; test result `reachable: false` → inline "Not reachable" (not an error toast) | — | — |
| Secrecy | the credential value is never displayed, logged or cached client-side; it is sent once on save and cleared from the form state (E-31; both log-blanking lists) | never received | never received |
| Checks | `M6-STTCFG-WEB` (2 + 1) | `M6-STTCFG-TAB` (2 + 1) | `M6-STTCFG-PHONE` (2 + 1) |

---

## 8b. Rev 2.3 client delta — frame for flows 9-13 (R-9, R-10, R-11; D73, approved D78; rulings D80, D81) **Erratum PE-125-08**

> **Status: spec delta of blueprint row 125.** Target for rows 137 (web), 138 (tablet, phone), 133 and
> 139 (server side of the notifications). **Nothing here is built**: the capture selector itself is
> not in the clients yet (`grep -rl "captureConfig\|captureDevices" apps/core-web/src apps/mobile/src`
> = 0 files on 2026-10-09), and operations 93-97 are a contract target (`C3 §2.6` status line).
> Flows 1-8 keep their text except the cells marked PE-125-04..07.

| Axis | Content |
|---|---|
| Subject | What the three clients draw for: a camera search and its list (flow 9), the connect flow (flow 10), the three no-device notifications (flow 11), the development-source label and the local-device rows (flow 12), the microphone re-read and the active-microphone rule at pre-check (flow 13) |
| Stakeholders | The user (D73-D78); the controller (D80, D81); rows 126, 127, 128 (review, checks, spec gate); rows 133, 137, 138, 139 (builders); operators with `CAPTURE_CONFIG` (SUPERVISOR, TECHNICIAN) and operators who only start sessions |
| Timeline | Spec row of 2026-10-09; built in M4 (137, 138, 133) and M5 (139); adoption **with** a password works after row 84 (M7) |
| Scope — in | Screens, states, texts, gated controls, placement of notifications, the badge, the i18n keys proposed, counts, hand-over |
| Scope — out | Typed-address entry (D80(10)); network microphone discovery (D80(5)); removing an adopted camera (D81 gap); a camera password on tablet or phone (D80(3)); live preview of a real camera (OD-12); code, the i18n file itself, any other spec |
| Rationale | D73 -> `specs` §B.2 (R-9 16 AC, R-10 6 AC, R-11 10 AC) -> D80 / D81 rulings -> `C3 §2.6, §3.1, §5.4` (row 121) and `06_evidence_package_spec.md` §B.12, §D.1 (row 124) -> this delta |
| Method | Read this file whole, `specs` §B.2, `C3 §2.6, §3.1, §4, §5.2, §5.4, §7`, the records of rows 121 and 124, D72-D81; read the client sources named in the tables below (read-only, working tree of 2026-10-09, HEAD `101ce62`) to name existing building blocks; every state is mapped to a contract answer |
| Alternatives not chosen | (1) Camera password on tablet / phone — overruled by D80(3). (2) Ask for the password twice (once for the test, once for adding) — rejected: two typings double the chance of a typo against a guard of 2 failures per camera in 30 minutes (**erratum PE-128-74**, D86 C-2); the form keeps the typed values until the dialog closes instead (§8d.3). (3) A numeric countdown during a search or after a rate limit — rejected by R-10 AC-4 and §2.7. (4) A second badge wording per source kind — rejected: one badge everywhere (R-11 AC-6), the kind is a secondary text. (5) An error toast for "session open" or "web console only" — rejected by the ruling: both are disabled, explained states |
| Assumptions | A-1: `captureConfig.locked` (`packages/shared/src/api/state-slices.ts:894-901`) is the flag the clients read to grey the connect controls. A-2: the session's `captureConfig` snapshot (op 27, `C3 §3`) carries `sourceClass` per line like op 76. A-3: an alert reaches every client through the `alerts` slice with `params.reason` (`C3 §5.4`) |
| Gaps | Open items OP-125-1..7 in §15.3 — four of them are members or operations the contract does not carry yet |

**Building blocks the delta is specified with (the apps' own kit; nothing hand-built).**

| Need | Web (`apps/core-web`, `@heroui/react` 3.2.6) | Tablet and phone (`apps/mobile`, `heroui-native` 1.0.10) |
|---|---|---|
| Page and panel | `PageHeader` (`features/devices/index.tsx:33`); `DevicesPanel` (`features/devices/panel.tsx:32`); kit `Card` | `SafeScreen`, `Pane` / `PaneLayout` (`@/layout`); `SectionCard` (`components/kit/section-card.tsx`, as `devices-screen.tsx:110`) |
| List | kit `Table` (as `device-drawer.tsx:2`, `users-roles/users-panel.tsx:2`) | kit `ListGroup` rows (as `devices/device-row.tsx:14`) with the always-mounted `SelectionGlow` and `ROW_CARD_BORDER` (`device-row.tsx:21,214`) |
| Detail surface | kit `Drawer` (`features/devices/device-drawer.tsx:88-132`) for a registered device | `DeviceDetail` (`devices/device-detail.tsx:93`); kit `BottomSheet` with `useSheetPresence` (`devices/diagnostics-sheet.tsx:53-95`) |
| Dialog with a form | kit `Modal` + `TextField`, `Label`, `Description`, `FieldError`, `Button`, `Spinner`, `Alert` (as `users-roles/role-dialog.tsx:2`); `react-hook-form` 7.89.0 | **none — no password field exists on tablet or phone** (D80(3)) |
| Banner | `DevicesBanner` (`features/devices/devices-banner.tsx:16,46`, `role="status" aria-live="polite"`); kit `Alert` (as `other-devices.tsx:137-141`) | kit `Alert` (as `devices-screen.tsx:176-180`, test id `devices-attention`) |
| Empty state | kit `EmptyState` (as `device-drawer.tsx:533`) | `SectionCard` with title and description (as `devices-screen.tsx:194`) |
| Badge / chip | `StatusChip` (`features/devices/status-chip.tsx:23`); kit `Chip` | `StatusChip` (`components/kit/status-chip.tsx`), `DeviceStatusChip` (`devices/device-status-chip.tsx`) |
| Loading | kit `Skeleton`, `Spinner`, `ProgressBar` (as `evidence/integrity-tab.tsx:2`) | kit `SkeletonGroup` (as `devices-screen.tsx:135-137`), `Spinner`, `PendingSpinner` + `busyState` (`@/runtime`) |
| Pending press | `usePendingControl` (`lib/pending-control`) | `usePendingPress` (`devices/use-pending-press.ts`) |
| Command path | `useCoreActions` + `settle` (`@dems/shared/live`); `useCoreErrorPresenter` (`lib/core-errors`) | `useCoreActions` + `settle`; `useCoreErrorPresenter` (`@/runtime`) |
| Gated read | one query factory per Core key in `lib/core-queries.ts`, gate inside the factory (§0; WB-11) | replicated slices through `useSim`; for op 94 (no slice) a read through the Core client with the same gate |
| Permission state | "Checking your permissions…" then the reason `common.rbac.requiresRole` (`packages/shared/src/i18n/en/common.ts:585`) | `useRoleGate` (`features/rbac/use-role-gate.ts:18,46`); text `rbac.checking` (`apps/mobile/src/i18n/en.mobile.ts:35`) |
| Alert centre | `NotificationsBell` (`components/shell/notifications-bell.tsx:38-67`: kit `Badge` + `Popover`, latest 5 active alerts, severity icon map `:19-22`) | Home header bell (`features/dashboard/home-header.tsx:175-233`, test id `home-alerts`) |
| Pre-check list | `DevicesStep` (`features/session-new/devices-step.tsx:82`; blocked `Alert` at `:169-175`) | `DevicesCheckStep` (`features/session-new/devices-check-step.tsx:59`; blocked `Alert` `:110-116`, warning `Alert` `:124-128`) |

---

## 8c. Flow 9 — Search for cameras (R-9 AC-1..AC-4, AC-11..AC-13; R-10 AC-1, AC-4) **Erratum PE-125-09**

### 8c.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | An operator presses **"Search for cameras"** (first search) or **"Search again"** (any later one). Both are the same control (G13) and the same operation (op 93). A search is never started by opening a screen, by a timer or by a read (R-9 AC-1; op 94 never probes) |
| Entry points — web | Devices page (WB-05): the action in the `PageHeader` action area and in the "Camera search" panel; the empty state of §2.5; "Search again" on each camera notification of flow 11. System (WB-07): a link "Search for cameras" that opens the Devices page at the search panel — a link, not a second implementation |
| Entry points — tablet | Devices screen (MB-08): the header action and the empty state; Settings -> capture section (MB-09): a row that opens the Devices screen at the search panel; "Search again" on each camera notification of flow 11 |
| Entry points — phone | Settings -> Devices (MB-09): the same panel, compact; "Search again" on each camera notification of flow 11 |
| Entry state | Signed in, link online, **any session state** — a search is allowed while a session is open (D80(4); op 93 never answers `409 CAPTURE_CONFIG_LOCKED`) |
| Read on entry | op 94 `getCaptureDiscovery` once: it restores the caller's own live result after a navigation or a reload (`search: null` = idle) |
| Not offered | No address, subnet, port or filter field anywhere: op 93 has no request member, and typed-address entry is not in scope (D80(10)). A camera that does not answer the search cannot be listed — the empty-state text says what to check, it does not promise a manual way |

### 8c.2 States, per client

Every state is drawn from an answer of op 93 / op 94; none is inferred by the client.

| # | State | Contract answer | Web | Tablet | Phone |
|--:|---|---|---|---|---|
| S1 | Checking | role or link unresolved | Search button disabled with "Checking your permissions…"; panel body is a `Skeleton` | same; `SkeletonGroup` | same |
| S2 | Idle | op 94: `search: null` | Panel with one sentence ("Search the network for cameras. Searching connects to nothing.") and the enabled **Search for cameras** button | same in a `SectionCard` | same, compact |
| S3 | Searching (bounded) | op 93 `202` (or `200`, `created: false`); op 94: `state: RUNNING` | Button pending (`Spinner`, disabled); a kit `ProgressBar` whose value is `(Core now − startedAt) / windowMs`, clamped to 0..100 and never lowered; text "Searching the network for cameras…" and "This takes up to {{seconds}} seconds." (`windowMs / 1000`, a fixed number, **not** a countdown); the list area is empty. op 94 is polled no faster than once per second. At 100 % the text becomes "Finishing the search…" until op 94 answers `COMPLETE` or `FAILED` — the bar never decides the end | same; the bar inside the `SectionCard` | same |
| S4 | Results | op 94: `state: COMPLETE`, `candidates.length ≥ 1` | Summary line "{{count}} found · {{newCount}} new · {{registeredCount}} already registered"; "Searched {{count}} network(s)." from `interfaceCount` (**erratum PE-128-77**); kit `Table` (§8c.3); the freshness line (§8c.4); **Search again** | `ListGroup` rows with the constant border; same summary and freshness line | compact rows; same |
| S5 | Empty | `COMPLETE`, `responderCount: 0` | kit `EmptyState`: title "No camera answered the search", body "Check that each camera is powered and on the same network as the Core, then search again.", action **Search again**. The situation-A alert of flow 11 is raised by the Core, not by this screen | `SectionCard` with the same title, body and action | same |
| S6 | Only registered cameras | `COMPLETE`, `newCount: 0`, `registeredCount ≥ 1` | The list as S4 with every row "Already registered"; **no** empty state and no alert (R-10 AC-1) | same | same |
| S7 | Truncated | op 94: `truncated: true` | A line above the list, drawn as a warning (**erratum PE-128-77**): "More than {{max}} devices answered. The first {{max}} are listed." (`CAPTURE_DISCOVERY_MAX_CANDIDATES`) | same | same |
| S8 | Error | op 94: `state: FAILED` (`failureReason` is a code and is not shown as text); or the request failed | kit `Alert` (danger): "The search could not be completed. Nothing was changed." + **Search again**. A link outage uses the existing presenter sentences (`common.coreErrors.offline`, `…timedOut`) | same | same |
| S9 | Search unavailable | op 93: `503 NOT_READY` (`DISCOVERY_NOT_READY`) | kit `Alert` (warning): "Camera search is not available on this Core yet." with **Retry** that repeats the call once per press (the §2.5 `503` pattern); no automatic retry | same | same |
| S10 | Another search is running | op 93: `409 INVALID_STATE` (`DISCOVERY_IN_PROGRESS`) | Inline note (not a toast): "Another operator is searching right now. Search again when their search has finished." The button stays enabled; nothing is polled for the other search | same | same |
| S11 | Too many searches | op 93: `429 RATE_LIMITED` (`DISCOVERY_RATE_LIMITED`, `retry-after`) | The existing sentence `common.coreErrors.limited` with the seconds value of the answer as a fixed number; the button is disabled until that instant and re-enables by itself; **no ticking label, no automatic search** (R-10 AC-4) | same | same |
| S12 | Result no longer kept | op 94 answers `search: null` after a result was drawn (expiry, sign-out, Core restart, replaced by the owner's new search) | The list is removed and the panel reads "This search result is no longer kept. Search again to see the cameras." + **Search again** | same | same |
| S13 | Not permitted | role without `CAPTURE_CONFIG` (op 93 / op 94 `403 NOT_PERMITTED`) | Button disabled with `common.rbac.requiresRole` ("Requires the SUPERVISOR or TECHNICIAN role"); **no list is requested or drawn**; the notifications of flow 11 are still shown | same | same |
| S14 | Search not available while recording | op 93 `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`), or the session state is `RECORDING` before the lift | The Search button is disabled with "Camera search is not available while a session is recording." (drawn from the session state; never a toast). **Erratum PE-128-80 (D86 C-4)** | same | same |

### 8c.3 Candidate row content

A row is one `CaptureCandidate` of op 94 (`C3 §2.6`). Order = the order op 94 returns; the client never
re-sorts, filters or merges (the list is forward-only during its life).

| Content | Field | Drawn as | Rule |
|---|---|---|---|
| Address | `host` | monospace text | plain text, never a link and never a URL; it is the address the answer came from |
| Make and model | `vendor`, `model` | one text "{{vendor}} {{model}}" | either may be null: the missing part is omitted; both null -> "Make and model not announced" |
| Name hint | `name` | secondary line | omitted when null |
| Trust note | — | one caption per list, not per row: "Make, model and name are what each device announced. They are not checked." | the three texts are **untrusted device text**: drawn as text nodes only (never as markup, never as a link), one line with an ellipsis, bidirectional text isolated (`<bdi>` on web), the full text in the accessible label; maximum 120 characters by contract |
| Registered or new | `status`, `deviceId` | chip **"New"**, or chip **"Already registered"** followed by the device label (for example "CAM-01 · Camera 1") | a registered row offers "View device" (web: opens `DeviceDrawer`; mobile: opens `DeviceDetail`) and no Connect |
| Cannot be connected | `testable: false` | chip "Cannot be connected" + "This device announced an address that is not its own." | listed, never connectable (D80(11)) |
| Two devices, one identity | `conflict: true` | chip "Cannot be connected" + "Two devices announce the same identity. Neither can be connected." | listed, never connectable (D86 SEC35-28; **erratum PE-128-77**) |
| Address changed | `addressChanged: true` | "This camera now answers from another address than the registered one." | a registered row; the registered address is not overwritten (D86 SEC35-30; **erratum PE-128-77**) |
| Last test | `lastTest` | web only: chip with the outcome word of §8d.4 and the time | always null on tablet and phone: a test can only be run by the web session that owns the list, and each client session has its own list |
| Development source | `sourceClass: DEVELOPMENT`, `adapter` | the row sits in a **separate group "Development sources"** under the network cameras, with the one badge of flow 12 and the kind text "Test source" (`adapter: FAKE`) | the group and its header are drawn only when op 94 lists at least one such candidate (a `FAKE` candidate; a `LOCAL_DEVICE` source is never a candidate: it is a registered device row, D83 O-8 — **erratum PE-128-76**); with the development flag off the Core lists none (R-11 AC-2) and the client has no switch or filter of its own |
| Action — web | — | **Connect** (G14) on a row that is `NEW` and `testable` | flow 10 |
| Action — tablet, phone | — | **Connect** drawn disabled with the sentence "Connect this camera from the web console." | flow 10, §8d.7 |
| Never drawn | `candidateId`, `searchId`, `endpointRef` (row), `failureReason` | — | ids are keys and test ids only; `endpointRef` appears once, in the connect dialog header on web |

### 8c.4 Result freshness and who sees it

| Point | Rule | Source |
|---|---|---|
| Who sees the list | **Only the operator session that ran the search**, on the client it ran on. Another operator, another role and the same operator on another client see nothing of it; they run their own search. The panel says so once: "Only you see this list, on this device." | op 94 owner session only; `C3 §2.6` "Candidate state: ownership" |
| What everyone sees | The outcome as a notification (flow 11): an alert when nothing answered. Never the list | `C3 §5.4` |
| Freshness line | "Searched at {{time}}. Kept until {{time}}." — two clock times formatted from `completesAt` and `expiresAt` with the existing `formatClock` (`@dems/shared/realtime`); no countdown | op 93 / 94 `CaptureDiscoverySearch` |
| Expiry | Detected by the next op 94 read (on focus, on entering the screen, before opening the connect dialog) -> state S12. A client clock never removes the list | §2.7; `CAPTURE_DISCOVERY_RESULT_TTL_MS` |
| Search again | Replaces the list: the old rows and their test results are gone the moment the new search is accepted (state S3). While the caller's own search is `RUNNING` a second press changes nothing (op 93 `200`, `created: false`) | `C3 §2.6` "lifetime", "Idempotency" |
| Sign-out, session expiry, Core restart | The list is gone; after signing in again the panel is idle (S2) | R-9 AC-4 |
| Cache | The op 94 answer is kept only in the query cache of the signed-in session and is dropped at sign-out; it is not persisted to storage and is not part of any slice | `C3 §2.6` "Why no slice" |

### 8c.5 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 93 `startCaptureDiscovery` | `PERMISSION CAPTURE_CONFIG`; web, tablet, phone; any session state | none; raises or resolves the situation-A alert in `alerts` when the window closes | `CAPTURE_DISCOVERY_SEARCHED` once per search |
| 94 `getCaptureDiscovery` | `PERMISSION CAPTURE_CONFIG`; owner session only | **none** | `NONE-R` |

### 8c.6 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G13 Search for cameras / Search again | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN); any session state except `RECORDING` until the lift of D86 C-4 (**erratum PE-128-80**) | "Checking your permissions…" until the role and link resolve | starts a search (S3) | not permitted -> disabled + the role sentence (S13); `409` S10; `429` S11; `503` S9 |
| Candidate list (gated read, op 94) | `CAPTURE_CONFIG`; owner session | the panel shows the Checking state, then S2 / S4 | the caller's own list | `403`: no list, role sentence |

### 8c.7 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Devices page (WB-05), panel "Camera search" under `DevicesBanner`; entry link on System (WB-07) | Devices screen (MB-08), list pane; entry row in Settings -> capture (MB-09) | Settings -> Devices (MB-09) |
| Read | new factory `captureDiscoveryQueryOptions` in `lib/core-queries.ts` (gate inside the factory; polling only while `RUNNING`) — WB-11 | Core client read behind the same gate; polled only while `RUNNING` | same |
| List | kit `Table`: Address, Make and model, Name, Status, action | `ListGroup` rows, constant border (`ROW_CARD_BORDER`) | compact `ListGroup` rows, constant border |
| Row action | Connect (flow 10) | Connect disabled + web-console sentence | same |
| Leaving the screen | does not cancel the search; returning restores the state from op 94 | same | same |

### 8c.8 Forward-only rule

The progress value derives from **Core instants** (`startedAt`, `windowMs`, `coreClockOf`) and only
grows; the end of a search is the answer of op 94, never the bar. The list never shrinks or reorders
while it lives. No countdown is drawn for the search window, the result lifetime or a rate limit, and
nothing retries by itself (R-10 AC-4; §2.7).

---

## 8d. Flow 10 — Connect a camera (web console only; R-9 AC-5..AC-10, AC-12, AC-13) **Erratum PE-125-10**

### 8d.1 Which client may enter a camera password — and the source

| Client | May enter a camera user name and password | Source |
|---|---|---|
| **Web console** | **Yes** — the only client | **D80(3)** (`decisions/decisions.md:93`): "credential entry for a camera is WEB CONSOLE ONLY in this phase"; enforced by the server through the access condition `WEB_CONSOLE_SESSION` on operations 89, 95, 96 (`C3 §2.6` access notes; D81) |
| Tablet | **No** — search, list, statuses, notifications, label; a pointer to the web console | D80(3); a forced call answers `403 NOT_PERMITTED` (`WEB_CONSOLE_ONLY`) before the body is used (**erratum PE-128-29**, SEC35-45) |
| Phone | **No** — as the tablet | D80(3) |

This overrides the wording of blueprint row 125 ("web System/Devices and tablet/phone Devices") and the
proposal in `specs` R-9 AC-12. Precedent: the R-8 secret field of §8a is web-only.

### 8d.2 Trigger and entry state (web)

| Item | Definition |
|---|---|
| Trigger | **Connect** (G14) on a row of the caller's own live result that is `NEW` and `testable` |
| Entry state | `CAPTURE_CONFIG`; a web console session; **no session open** (`captureConfig.locked: false`); the result not expired (op 94 is re-read before the dialog opens) |
| Surface | kit `Modal` titled "Connect {{name}}" (the announced name, else the address). Header lines: address, make and model, hardware hint, device reference (`endpointRef`) — all as plain text — and "This device has not been verified. Its name and model are what it announced." **Erratum PE-128-77 (D86 SEC35-31, SEC35-37).** |
| Order | Connect -> user name and password -> the operator ticks "I have checked that {{address}} is this camera" (**Test connection is enabled only after the tick**) -> **Test connection** (op 95) -> outcome -> **Add as camera** (op 96) -> result -> assign in the selector (flow 1). No step can be skipped: Add as camera exists only after a *reachable* outcome (`adoptable: true`) |

### 8d.3 The password prompt

| Rule | Definition | Source |
|---|---|---|
| Fields | "Camera user name" (kit `TextField`, 1..255 characters; **Erratum PE-FM4-01 (decisions D117, D178; review row 69, finding R69-11): the bound of the camera user name is 1..120, not 1..255** - the bound of the stored column (`capture_device_credentials_username_check`), of the shared constant `CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH` and of the request schema of operations 89, 95 and 96; a longer name is `422 INVALID_INPUT` before any network request. **Erratum PE-FM4-02 (D134, D178; finding R69-04): the two credential fields are NOT the kit `TextField`** - react-aria always controls its input, so React would write the typed text into the `value` attribute; they are plain uncontrolled inputs with the kit's field classes, a `Label`, and the description / error joined by `aria-describedby`.) and "Camera password" (kit `TextField` with `type="password"`, 1..1024 characters), each with a kit `Label`; a `Description`: "Enter the user name and password set on this camera. They are used for this connection only and are never shown again." The description gains: "Sent as a digest: not readable in transit, but a device that receives it can test guesses against it. Use a password that is used for this camera only." A field message names the accepted characters (printable ASCII; `422 INVALID_INPUT`). **Erratum PE-128-77** | op 95 `CaptureConnectionTestRequest`; `devices.ts:149-156`; D86 SEC35-31, SEC35-35 |
| Always empty | Both fields are empty every time the dialog opens. Nothing is pre-filled: no stored value exists on the client, the Core returns none (0 response shapes carry a credential, `C3 §2.6`), and the browser is told not to fill them (`autocomplete="off"` on the user name, `autocomplete="new-password"` on the password, no `name` a password manager would match); the fields carry a neutral `name` / `id`, `spellcheck="false"`, `autocapitalize="off"`, `autocorrect="off"`, and no native form submission (**erratum PE-128-77**, D86 SEC35-37) | R-9 AC-7; §8a "Secrecy" |
| No "show stored" | There is no control that shows a stored password, a stored user name, a hint, a length or a last-changed value — on any client. A reveal control for the value being typed is allowed (D86 C-1): off by default; back to hidden on blur, on submit and on close; never for a stored value (none exists); never on in a gate capture. **Erratum PE-128-73** | row 125 verification; C-N15 |
| Where the typed values live | In the form state of the open dialog only (`react-hook-form`, local to the `Modal`). They are sent in the body of op 95 and, unchanged, in the body of op 96, through `useCoreActions` + `settle` — not through a query or mutation cache. They are never written to the URL, router state, browser storage, a toast, a log line or the error sink | `C3 §2.6` "Credential in memory"; P-07 |
| Kept for two requests, not asked twice | After a *reachable* outcome the two fields become read-only and keep their values so that **Add as camera** sends exactly what was tested. "Change" re-enables them and removes the outcome (a new test is needed) | row 121 hand-over ("decide whether the form keeps it"); frame, alternative (2) |
| Cleared | The password is cleared after an *authentication failed* outcome (the user name is kept). **Both fields are cleared when the dialog closes** — by Close, by Escape, by a completed adoption, by navigation, by sign-out — and the form unmounts | R-9 AC-8 |
| Development source | For a candidate of `sourceClass: DEVELOPMENT` the dialog shows "This development source needs no password." and no field; a kit `Switch` "Enter a user name and password" reveals the two fields for a test camera that has them. **Erratum PE-WI-12 (decisions D215, D217; re-gate 70 finding G70b-02; ruling of fix wave I driver A2, `delegation_progress/contract_wave_i_a2.md` section 1; built by driver B, `implementation/133_fix_wave_i_b.md` section 2.2):** "This development source needs no password." states more than the Core knows before a test (a development source MAY need none; the lane's stub camera has one fixture account). The web dialog shows instead: **"A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password"."** (`apps/core-web/src/i18n-web.ts:74`). No server change. Re-gate 70 has not passed: not yet gate-verified | op 95: `credential` optional for `DEVELOPMENT` |
| Validation | Empty field on Test -> `FieldError` "Enter the camera user name and password." before any request (and for `422 CREDENTIAL_REQUIRED`) | `C3 §4` |

### 8d.4 Per-step states and outcomes (web)

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Dialog open | Fields empty and enabled; **Test connection** enabled once both have text; no **Add as camera** | §8d.3 |
| 2 | Test running | **Test connection** pending (`Spinner`), fields read-only, Close disabled; text "Testing the connection…" and "This can take up to {{seconds}} seconds." (`CAPTURE_CONNECTION_TEST_TIMEOUT_MS / 1000`, fixed number). One request; nothing repeats it | op 95 |
| 3 | Outcome | one kit `Alert` under the fields, see the table below; focus moves to it | op 95 `200 CaptureConnectionTest` |
| 4 | Adding | **Add as camera** pending, Close disabled; "Adding the camera…" | op 96 |
| 5 | Added | The dialog body is replaced by the result (§8d.6) | op 96 `201` |

A failed test is a **result**, not an error: it is drawn as an outcome in the dialog, never as an error toast.

| Outcome (`outcome`) | Tone | Message | What the fields do | Next action offered |
|---|---|---|---|---|
| `REACHABLE` | success | "Connection works. This camera can be added." (with "{{count}} usable video profile(s)" from `usableProfileCount`) | read-only, values kept | **Add as camera**; "Change" |
| `UNREACHABLE` | warning | "The camera did not answer. Check its power and network cable, then test again." | unchanged | **Test connection** again (a new operator action) |
| `AUTHENTICATION_FAILED` | danger | "The camera refused this user name or password." and, from `failedAttemptsRemaining`: "{{count}} more attempt(s) before testing this camera is paused." | password cleared, focus in the password field | type again, **Test connection**; at `0` remaining the button is disabled with the lock-out sentence below. **Erratum PE-WI-13 (decisions D181 (3), D217; re-gate 70 findings G70b-02, G70b-05; `delegation_progress/contract_wave_i_a2.md` sections 1-2; `implementation/133_fix_wave_i_b.md` section 2.2):** three cases, told by the answer of op 95. (a) `authenticated === true && reason === undefined` (a credential was sent and refused): unchanged - this sentence and the remaining-attempts line. (b) `authenticated === false` (no credential was sent): "This camera asks for a user name and a password. None was sent." and under it "Turn on "Enter a user name and password", type them, then test again." - never "The camera refused this user name or password.", and NO remaining-attempts line. (c) `reason === "SCHEME_NOT_ALLOWED"`: no remaining-attempts line (nothing was counted: the credential was not sent). The remaining-attempts line is drawn ONLY in case (a); `failedAttemptsRemaining` is a required member the Core always sends, with the host's unchanged count in (b) and (c). The lock-out sentence is unchanged (`apps/core-web/src/features/devices/camera-connect.ts` `connectionTestWording`; `apps/core-web/src/i18n-web.ts:75-76`). Re-gate 70 has not passed: not yet gate-verified |
| `WRONG_PROFILE` | warning | "The camera answered, but it offers no video profile this system can use. Change the video settings on the camera, then test again." | unchanged | **Test connection** again |
| `NOT_H264` | warning | "The camera answered, but none of its video profiles is H.264. Set the camera to H.264, then test again." | unchanged | **Test connection** again |

### 8d.5 Refusals (web) — each is an explained state in the dialog or on the row

| Answer | Where it is drawn | Message | Next action |
|---|---|---|---|
| `429 RATE_LIMITED` (`CONNECTION_TEST_LOCKOUT_GUARD`) | dialog, kit `Alert` (warning); Test and Add disabled until the instant of `retry-after` | "Testing this camera is paused so that the camera does not lock its account. Try again after {{time}}." (a clock time, not a countdown) | Close; test again after that time |
| `429 RATE_LIMITED` (`CONNECTION_TEST_RATE_LIMITED`) | dialog, inline | `common.coreErrors.limited` with the fixed seconds value | the button re-enables by itself; no automatic test |
| `409 CAPTURE_CONFIG_LOCKED` | **before the dialog:** the row's Connect is disabled with "A camera cannot be connected while a session is open." (from `captureConfig.locked`). **Inside an open dialog** (a session opened meanwhile): the same sentence in a kit `Alert` (`status="accent"`, as `evidence/integrity-tab.tsx:246` — not a danger state), Test and Add disabled | as written | Close; search stays available; **never a toast** (D80(4)) |
| `404 NOT_FOUND` | dialog | "This search result is no longer kept. Search again." | **Search again** closes the dialog and starts flow 9 |
| `409 INVALID_STATE` (`CANDIDATE_ALREADY_REGISTERED`) | dialog | "This camera is already registered as {{device}}." | "View device" |
| `409 INVALID_STATE` (`CANDIDATE_NOT_TESTABLE`) | row (Connect is not offered, §8c.3) | "This device announced an address that is not its own." | none |
| `409 INVALID_STATE` (`CONNECTION_TEST_IN_PROGRESS`) | dialog | "A connection test for this camera is already running." | wait; the button re-enables when the pending request answers |
| `409 INVALID_STATE` (`CANDIDATE_NOT_TESTED`) on Add | dialog | "The connection test is too old. Test the connection again." | fields enabled, **Test connection** |
| `409 INVALID_STATE` (`CONNECTION_TEST_FAILED`, `details.outcome`) on Add | dialog | "The camera did not pass the final check, so it was not added." followed by the message of that outcome (§8d.4) | as for that outcome |
| **`503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) on Add — the state before row 84** | dialog, kit `Alert` (warning), `role="alert"` | "This Core cannot store camera passwords yet, so this camera cannot be added. Nothing was saved." | **Close**. The candidate stays "New". A development source without a password can be added in this state |
| `503 NOT_READY` (`DISCOVERY_NOT_READY`) | dialog | "Camera search is not available on this Core yet." | Close |
| `403 NOT_PERMITTED` (role) | the row's Connect is disabled after the Checking state with the role sentence | `common.rbac.requiresRole` | none |
| `422 INVALID_INPUT` (`CREDENTIAL_REQUIRED`; schema) | `FieldError` on the field | "Enter the camera user name and password." | type, test |
| link down / time-out | dialog | the existing presenter sentences (`common.coreErrors.offline`, `…timedOut`) | Close or test again |

### 8d.6 Adoption result and assignment

| Step | Drawn | Source |
|---|---|---|
| Added | "{{device}} was added." (for example "CAM-03"), the make and model, and one of: "Password stored." (`credentialSet: true`) / "No password is used for this source." (`credentialSet: false`). **No value is shown** — only that fact | op 96 `201 CaptureCandidateAdoption` |
| What "added" means | A line: "The camera is registered but not yet used. Assign it to Camera 1 or Camera 2." Adoption changes no track (`captureConfig` is not changed) | `C3 §2.6` "Adoption is not assignment" |
| Assign | **Assign to a camera slot** closes the dialog and opens the camera-source edit of **flow 1** (G2; ops 78 / 79) — the existing selector, in which the new device is now an option. No track is preselected. **Done** only closes | R-9 AC-5; §2 |
| In the lists | After the answer the Devices page shows the new device (slice `captureDevices`) with its label and, for a development source, the badge; the candidate row reads "Already registered as {{device}}" at the next op 94 read | op 96 realtime; op 94 `status` |
| Replacing the password later | Not in this flow: it is op 89 on the registered device (web only), with the same field rules; removing an adopted camera is not designed (D81 gap) | `C3 §2.6` "Adoption and operation 89" |

### 8d.7 Abandon and close — nothing is registered, and what the UI shows

| Exit | What the UI shows afterwards | Registered |
|---|---|---|
| Close or Escape before a test | The dialog is gone, both fields cleared. The row is unchanged: "New", Connect enabled | nothing |
| Close after any failed outcome | The row stays "New" with the last-test chip of that outcome (from `lastTest`); opening Connect again shows two empty fields | nothing |
| Close after *reachable* without adding | The row stays "New" with the chip "Connection works"; opening Connect again shows two empty fields — the password must be typed again to add | nothing |
| Close while a test or an adoption is pending | Not possible: Close and Escape are disabled until the answer arrives (the request cannot be recalled). If the page is left or the browser closed, the next visit shows what op 94 and the `captureDevices` slice say | whatever the Core answered — never a half state |
| Sign-out, session expiry, Core restart in mid-flow | After signing in again: no dialog, the search panel idle (S2), no new device | nothing |

In none of these exits does a device row, a "password set" mark or a pending row appear: a device
exists only after op 96 answered `201` (`C3 §2.6`, R-9 AC-8). No "draft" is kept on the client.

### 8d.8 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 95 `testCaptureCandidateConnection` | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | none | `CAPTURE_CONNECTION_TESTED`, one row per attempt, every outcome |
| 96 `adoptCaptureCandidate` | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | publishes `captureDevices` | `CAPTURE_CANDIDATE_ADOPTED` (+ `CAPTURE_CONNECTION_TESTED`; + `CAPTURE_CREDENTIAL_SET` when a password is stored) |
| 78 / 79 (assignment, flow 1) | `PERMISSION CAPTURE_CONFIG`; idle only | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 89 `setCaptureDeviceCredential` (later replacement) | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | publishes `captureConfig` | `CAPTURE_CREDENTIAL_SET` |

### 8d.9 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused / locked |
|---|---|---|---|---|
| G14 Connect (opens the prompt) | `CAPTURE_CONFIG` + web console + idle | "Checking your permissions…" | web: opens the dialog | web: role sentence; session open -> disabled + "A camera cannot be connected while a session is open." **Tablet, phone: always disabled + "Connect this camera from the web console."** |
| G15 Test connection (op 95) | same; web only | inherits the dialog's state | one test | the refusals of §8d.5 |
| G16 Add as camera (op 96) | same; `adoptable: true`; web only | inherits | adoption | the refusals of §8d.5 |

### 8d.10 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Connect flow | The whole flow of §8d.2-§8d.7 | **Not available.** Each `NEW` row shows Connect disabled with "Connect this camera from the web console." and one panel note: "Camera passwords are entered on the web console only. Open Devices on the web console and search there." | same as the tablet |
| Why "search there" | — | A list belongs to the session that searched (§8c.4): the tablet's list is not on the web console, so the operator runs the search again there | same |
| Session open | Connect disabled, explained (§8d.5) | The web-console sentence stays; no second reason is stacked on it | same |
| Password field | two kit `TextField`s in the `Modal` | **none in the component tree** | **none in the component tree** |
| After a camera was added on the web | row "Already registered"; device in the lists | the device appears through the `captureDevices` slice; the selector (flow 1) offers it | same |

### 8d.11 Forward-only rule

No timer is drawn. The test duration, the lock-out pause and the validity of a *reachable* outcome
(`CAPTURE_CONNECTION_TEST_VALIDITY_MS`) are decided by the Core: the client learns an expired outcome
from `adoptable: false` at the next op 94 read or from `409 CANDIDATE_NOT_TESTED`, never from its own clock.

---

## 8e. Flow 11 — No-device notifications (R-10) **Erratum PE-125-11**

### 8e.1 Rules for all three situations

| Rule | Definition | Source |
|---|---|---|
| One alert, drawn everywhere | Each notification is one alert raised by the Core and read by every client from the `alerts` slice; a client never raises, counts or stores its own copy | R-10 AC-6; `C3 §5.4` |
| Told apart by reason | The title and body come from `params.reason` (+ `phase`, `deviceKind`, `cause`), **not** from `common.faultKind.*`: the WARNING cases have the kind `SYSTEM`, which has no fault label or icon of its own — the severity icon of the alert centre is used (`notifications-bell.tsx:19-22`) | `C3 §5.4`; row 121 hand-over |
| Names, never values | Texts name the device by label and id ("Camera 2 (CAM-02)"), and counts. Never an address, a user name, a password or a URL | R-10 AC-6; E-30 / E-31 |
| Cleared by the Core only | A banner, a row mark or an alert-centre item disappears at the first state update after the Core resolved the alert. No client hides it by a timer; "Acknowledge" in the alert centre keeps its existing meaning (the unread count) and resolves nothing | R-10 AC-5; D72(h) |
| No countdown, no automatic retry | — | R-10 AC-4 |

### 8e.2 The three situations — placement, severity, text, action

| Situation (alert) | Severity | Web | Tablet | Phone | Text keys (§14.2) | Action offered |
|---|---|---|---|---|---|---|
| **A — a search found nothing** (`SYSTEM`, `reason: CAPTURE_DISCOVERY_EMPTY`) | WARNING | (1) the searching operator: the empty state S5 in the search panel; (2) everyone: `DevicesBanner` on the Devices page; (3) alert centre item in `NotificationsBell` | (1) empty state S5 on the Devices screen; (2) the `devices-attention` `Alert` on the Devices screen; (3) Home header bell | (1) and (2) in Settings -> Devices; (3) Home header bell | `captureNotice.discoveryEmpty.*` | **Search again** (G13) |
| **B — a configured camera or microphone is unreachable at pre-check** (`SYSTEM`, `reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: PRECHECK`; one alert per device) | WARNING (the pre-check item itself is WARN or BLOCK by the start rule of §8g.3) | (1) **Session New** (WB-03): the item's row in `DevicesStep` names the device and, for a camera, the count of the one search the pre-check ran; the blocked or warning `Alert` of that step lists the devices; (2) Devices page: the device row reads "Not reachable" and the banner names it; (3) alert centre item | (1) **Session New** (MB-02): the row in `DevicesCheckStep` and its blocked / warning `Alert`; (2) Devices screen row + `devices-attention`; (3) Home header bell | same as the tablet, compact | `captureNotice.unreachable.precheck.*`, `captureNotice.cause.*` | Camera: **Search again** (G13). Microphone: **Search again** = re-read of the local inputs (G17, flow 13). In Session New also the existing **Retry** of the pre-check (`retryPrecheck`, `SESSION_START`) |
| **C — no camera connected at session start** (`CAPTURE_FAULT`, `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`) | **CRITICAL** | (1) **Session Monitor** (WB-01): the fault presentation of `StatusBanner` — "No camera connected. Nothing was recorded."; (2) Dashboard (WB-02): the session tile shows the fault, both camera tiles NO SIGNAL; (3) alert centre item; (4) Devices banner | (1) **Session Live** (MB-03) fault presentation, then the existing fault hand-off; (2) Home (MB-01) session and camera tiles; (3) Home header bell; (4) Devices `devices-attention` | (1) Session Live; (3) Home header bell; (4) Settings -> Devices | `captureNotice.noCamera.*` | **Search again** (G13; it works while the faulted session is still open, D80(4)). Connecting is refused while a session is open (flow 10) |
| **C, degraded — one camera of two connected** (`SYSTEM`, `reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: SESSION_START`) | WARNING | Session Monitor: a warning banner naming the missing camera; that camera's tile reads NO SIGNAL; the recording timer and the other tile run normally; alert centre item | Session Live: warning banner + NO SIGNAL tile; Home header bell | same | `captureNotice.unreachable.sessionStart.*` | **Search again** (G13) — disabled with the S14 sentence while the session records, until the lift (**erratum PE-128-80**); no connect while the session is open |

**Between the accepted start and the first durable fragment (D84; erratum PE-128-79).** Session Monitor (WB-01) and Session Live (MB-03) read **"Connecting cameras…"** — no recording timer, no recording indicator, no meter presented as recording; "Recording" appears only from the first durable fragment (D84; the session payload member `captureDurable` is `false` until then, ruling R-1 option A, D91).

What situation C must **not** draw (D72(i), D72(k), R-10 AC-3): a running recording timer, a recording
indicator, generated audio meters, a camera loop presented as live, or any wording that suggests
evidence exists. The texts say "Nothing was recorded." in full.

### 8e.3 The operator without `CAPTURE_CONFIG`

| Point | What this operator gets | Source |
|---|---|---|
| Pre-check search | It runs once for the pre-check they started (no `CAPTURE_CONFIG` needed) and they see **its outcome as the notification only**: the pre-check row "Camera 2 (CAM-02) is not reachable. A search found {{count}} camera(s)." (count from `params.searchResponderCount`) and the alert-centre item | D80(2); `C3 §2.6` "Search trigger" |
| Candidate list, Connect | **None.** No list is requested (op 94 would answer `403`) and no Connect control is drawn for them | R-9 AC-12 |
| Search again | Drawn after "Checking your permissions…" as **disabled** with "Requires the SUPERVISOR or TECHNICIAN role" | R-10 AC-4 |
| What they can do | The existing **Retry** of the pre-check (their `SESSION_START`), which checks reachability again and runs the one search again; acknowledge a warning and start degraded when the start rule allows it; otherwise ask a supervisor or technician | `C3 §3.1` |
| Situations A and C | The same banners and alert-centre items as everyone, with the disabled Search again | R-10 AC-6 |

### 8e.4 Clearing on a later success

| Notification | Cleared when the Core resolves the alert after | What every client then shows |
|---|---|---|
| A | the next search of **any** session with at least one responder | banner and alert item gone; the searching operator sees the list |
| B | a later pre-check run in which that device is reachable | the row passes; banner and alert item gone; the Devices row returns to its normal status |
| C | the capture side, when a camera connects in a later session (`FAULT_CLEARED`; never the demo fault operation 74) | fault presentation gone with that session's end state; alert item gone |
| C, degraded | the capture side, when that camera connects in a later session | warning banner and alert item gone |

A later occurrence is a **new** alert (new id, new audit row): it is drawn as new and counted as unread
again. After clearing, 0 stale banners remain after the next state update (R-10 AC-5).

### 8e.5 Operations, slices, audit

| Read / operation | Access | Slice | Audit |
|---|---|---|---|
| alerts (existing) | `AUTHENTICATED` | `alerts` | none by the client; the Core wrote `CAPTURE_DISCOVERY_SEARCHED` (A), `CAPTURE_DEVICE_UNREACHABLE` (B; C degraded), `FAULT_RAISED` (C) |
| device state | `AUTHENTICATED` | `captureDevices`, `captureConfig` (`online`, `streamState`) | `NONE-R` |
| pre-check result, session fault | existing | `session` | existing |
| 93 (Search again), 97 (microphones) | `CAPTURE_CONFIG` | see flows 9, 13 | see flows 9, 13 |

### 8e.6 Per-client definition and forward-only rule

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Banner component | `DevicesBanner` (new banner kinds ranked in `features/devices/model.ts` beside the existing ones); kit `Alert` in `DevicesStep`; `StatusBanner` on the monitor | kit `Alert` (`devices-attention`; `DevicesCheckStep`); the Session Live banner | same, compact |
| Alert centre | `NotificationsBell` popover | Home header bell | Home header bell |
| Announcement | banners are `role="status"`; the CRITICAL fault is `role="alert"` | `accessibilityLiveRegion="polite"` / `"assertive"` for CRITICAL | same |

No notification carries a timer. Each is a snapshot of the `alerts` slice and changes only when the slice does.

---

## 8f. Flow 12 — Development sources: one label everywhere, and the local-device rows (R-11 AC-2, AC-5, AC-6) **Erratum PE-125-12**

### 8f.1 The badge

| Property | Definition |
|---|---|
| Wording | **"Development source"** — one text on every surface and every client (`common.sourceClass.badge`) |
| Form | One small presentational badge per client, built on the kit chip (web kit `Chip` / the devices `StatusChip`; mobile `StatusChip` from `@/components/kit`), tone `warning`, with an icon **and** the text — never colour alone. The same component is used on every surface below; no surface draws its own variant |
| Kind text | A secondary text beside or under the badge names the kind: "This Mac's camera" / "This Mac's microphone" (`adapter: LOCAL_DEVICE`; on tablet and phone "Core Mac's camera" / "Core Mac's microphone", because the tablet is not the Mac — OP-125-7) or "Test source" (`adapter: FAKE`) |
| Never hidden | The badge is not collapsible, not behind a tooltip, not dropped on a compact layout: when space is short the name is shortened, the badge stays |
| Decided by the Core | The client draws the badge **only** from a `sourceClass` the Core sent. It has no development switch, no filter and no local rule ("loopback address means development") |

### 8f.2 Where it is drawn, and from which data

| Surface | Web | Tablet | Phone | Data source (never client state) |
|---|---|---|---|---|
| Devices rows | camera tiles and audio-input cards of the Devices page (WB-05); the device drawer header | `DeviceRow`, `DeviceDetail` (MB-08) | Settings -> Devices rows (MB-09) | `CaptureDevice.sourceClass`, `adapter` (op 77; slice `captureDevices`) |
| Selector (flow 1) | each camera and mic line, and each option of the source selects | each line and each sheet option | same | `CaptureConfig` line `sourceClass` (op 76); options from op 77 |
| Search list (flow 9) | the separate group, each row | same | same | `CaptureCandidate.sourceClass` (op 94) |
| Pre-check (flow 7, 11) | camera and microphone rows of `DevicesStep` (WB-03) | rows of `DevicesCheckStep` (MB-02) | same | the session's `captureConfig` snapshot (op 27) |
| Session Monitor tiles | camera tiles and mic meters (WB-01); Dashboard tiles (WB-02) | Session Live camera tiles and mic cards (MB-03); Home tiles (MB-01) | Session Live (MB-03) | the session's `captureConfig` snapshot (op 27); `audioSource` for the active mic |
| Sealed evidence item | evidence list row, preview card, detail header (WB-04) | evidence row, detail header, Session Summary (MB-07, MB-05) | same | the **package** mark: manifest field 126 `developmentSources`; per file, field 124 `tracks[].sourceClass` (`06_evidence_package_spec.md` §B.12) — see OP-125-3 for the response member |
| Verify result | integrity tab (WB-04): the line **"DEVELOPMENT SOURCES — this package was not recorded from production devices."** first, above the per-check results, never collapsed, then one entry per source; the verdict chip follows unchanged | integrity tab / live integrity (MB-07) and Session Summary (MB-05): same line first | same | the `sources` block of the verify result (V-15, `06_evidence_package_spec.md` §D.1) |

Rules for the sealed item (row 124, `06` §D.1, lines 644-648). (1) The label of a sealed item comes
from the manifest or the verify result, **never** from the current device list — a camera re-registered
later does not change an old package. (2) A development package verifies **PASS**; the badge and the
PASS verdict are shown together and neither replaces the other. (3) "REAL" in an integrity field does
not mean "production": no text may present a development package as production. (4) When verification
fails on the manifest (V-03 / V-09) the source line reads "Sources: not trustworthy — the manifest was
altered" and no class is printed as fact. (5) An all-production package reads "Sources: declared as
production devices by the Core that sealed this package." (the word *declared* is required). (6) A v1
item reads "Sources: not recorded (v1 package)". (7) The two vocabularies are not mixed: device shapes
say `PRODUCTION` / `DEVELOPMENT` with `adapter` `LOCAL_DEVICE` / `FAKE` (`C3 §2.6`); the manifest says
`PRODUCTION` / `LOCAL_DEVICE` / `FAKE` (`06` §B.12). Both map to the one badge: badge = not `PRODUCTION`.

**Erratum PE-WH-12 (decisions D196 (ruling on G70-03), D206, D210; gate 70 finding G70-03; wave H driver D and closing pass Z2, `implementation/124_fix_wave_h_d.md`, `implementation/129_fix_wave_h_z2.md` item 6):** on a Core in REAL capture no stock
or demo picture stands as a camera preview. The camera tiles of the web Devices page and of the
mobile Devices / device detail show a neutral "No preview" tile with the device's name and its
true state (`apps/core-web/src/features/devices/camera-tile.tsx:101`;
`apps/mobile/src/features/devices/device-detail.tsx:373`; `packages/shared/src/i18n/en/devices.ts:440`),
and the mobile session rows use the "No preview" thumb on every row, closed rows included, with
no LIVE badge over it. The accessible label says so: "{{name}}. No preview: this build shows no
live picture." (`apps/mobile/src/features/capture-selector/i18n.ts:252-257`). Simulated capture and
the in-app simulator keep the demo loop. This build has no live preview of a real camera.
Re-gate 70 has not passed: not yet gate-verified.

**Erratum PE-WI-17 (decision D217; re-gate findings G70b-04 / G75b-09; fix wave I driver C, `implementation/134_fix_wave_i_c.md` section 1 row G70b-04):** the same rule now holds for the tablet / phone Home "Recent
Sessions": in real capture the thumb is the neutral "No preview" thumb, labelled "<id>. No
preview: this build shows no live picture." (`apps/mobile/src/features/dashboard/recent-sessions.tsx`).
Simulated capture is unchanged. Proven in the clients' tests only: re-gates 70 and 75 have NOT passed, so this is not yet gate-verified.

**Erratum PE-WI-15 (decision D217 (ruling 6); re-gate 70 finding G70b-06; `delegation_progress/contract_wave_i_a2.md` section 4 (the client rule, RULED); `implementation/133_fix_wave_i_b.md` section 2.7; `implementation/134_fix_wave_i_c.md` section 1 rows "Home microphone state" and G70b-06):** the state
words of a source on a real-capture Core (`captureOperation` is not `SIMULATED`). `online` /
`streamState` of slices 29 / 30 are "as registered" until the Core reads the device, so: a line
says "Reachable" / "Not reachable" (from `online`); **"Stream live" / "Live" is drawn only while a
session of this Core is RECORDING** (a LOST stream stays); the web camera tile draws no PoE port,
and a bitrate only while recording; the mobile Home microphone tile says what the Core reported
for the microphone ON its line. Simulated capture is drawn as before. NOT BUILT on the server:
the member `captureDevices.devices[].checkedAt` ("Not checked"); both clients read it by name and
draw as today while it is absent (C3 §6, note under PE-WI-05). Proven in the clients' tests only: re-gates 70 and 75 have NOT passed, so this is not yet gate-verified.

### 8f.3 The local-device rows

In the development configuration camera 1 is this Mac's camera and microphone 1 this Mac's microphone;
camera 2 and microphone 2 are test sources (D74(2); R-11 AC-3). Each local device is one ordinary
device row with the badge and one of these states:

| State | Shown when | Chip | Sentence | Action |
|---|---|---|---|---|
| Ready | the device is present and reachable (`online`; for a microphone op 97 `present: true`, `errorCode: null`) | "Ready" (success) | — | the normal row actions |
| Permission needed | `PERMISSION_DENIED` (op 97 `errorCode` for a microphone; `params.cause` of the active situation-B alert for a camera) | "Permission needed" (warning) | Camera: "macOS has not allowed camera access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Camera, allow it, then search again." Microphone: the same with "Microphone" | **Search again** (G13 camera / G17 microphone). **No control opens or changes a system setting** — allowing access is the user's own action on the Mac (R-11 AC-9) |
| Busy | `DEVICE_BUSY` | "In use" (warning) | "Another application is using this camera (microphone). Close that application, then search again." | Search again |
| Not connected | `DEVICE_NOT_FOUND` | "Not found" (danger) | "This Mac's camera (microphone) was not found." | Search again |
| Could not be opened | `OPEN_FAILED` or `HELPER_EXITED` | chip "Could not be opened" (warning) | "This Mac's camera (microphone) could not be opened. Check its permission on the Mac that runs the Core, then search again." | Search again (**erratum PE-128-81**, cap HL-10) |

**'Is on' indicator (SEC35-44 (4); erratum PE-128-78).** Whenever a `LOCAL_DEVICE` camera or microphone is open (`sourceOpen: true`; the short pre-check open included) every client shows a fixed, non-dismissable state: "This Mac's microphone is on" / "This Mac's camera is on" on the web console, "Core Mac's …" on tablet and phone. Checks `M5-SEC-PRIV-2-W/T/P`.

**Never silently replaced (D80(11); R-11 AC-5).** A local device in any state but Ready stays the same
row with the same name and the same badge, reads as not reachable, and ends in the notification of
flow 11 (situation B at pre-check; the degraded warning or situation C at session start). The client
never shows a test source in its place, never renames the row, and offers no "use a test source
instead" shortcut; choosing another source is an ordinary selector edit (flow 1) by an operator.

**Not in the production configuration (R-11 AC-2).** In `REAL_PRODUCTION`, ops 76 / 77 list 0
development devices and a search lists 0 development candidates, so: 0 badges, no "Development sources"
group and header, no local-device rows, no option in any select. An assignment that names one answers
`422 INVALID_INPUT` (`DEVELOPMENT_SOURCE_NOT_ALLOWED`), shown as the field message "This source can
only be used in the development configuration."

**Simulated client mode (row 121 asked; D83).** The in-app simulator's devices are `adapter: FAKE`,
`sourceClass: DEVELOPMENT` (`C3 §2.6` "Simulator"), so the data alone would badge every device. **Simulated client mode (D83):** the badge is NOT shown on devices and demo items — the mode banner says it; the mark stays in the manifest and in the verify result. **Ruling R-2 option A (D91):** the development / test-source badge is drawn only in real capture — the client knows the mode from the demo status (op 71 answers `demo: 'DISABLED'` in real-capture mode) — and never when the Core runs `SIMULATED`; on a sealed item the badge follows `developmentSources = true` and `demo = false`. **Erratum PE-128-75.** The empty state S5 is not reachable in Simulated mode (the simulator always
answers two candidates); it is covered by component tests and by the Core with the fake stub set empty.

**Privacy (D80(11); R-11 AC-8).** No frame and no audio excerpt of a local-device recording appears
in any document, screenshot evidence or fixture under `docs/`; checks of this flow record text, ids,
counts and DOM / view-tree facts only.

### 8f.4 Operations, permissions, per-client definition

| Aspect | Definition |
|---|---|
| Operations | none of its own: reads 76, 77, 94, 27, 39 / 40, 41; the row actions are G13 / G17 |
| Gated control | none new; the badge and the rows are visible to every signed-in role (ops 76 / 77 are `AUTHENTICATED`) |
| Web | badge on the surfaces of §8f.2; local rows in the Devices page panels |
| Tablet | same surfaces through `DeviceRow` / `DeviceDetail`, constant border |
| Phone | same, compact |
| Forward-only | the badge is a property of the data and never changes during a session: the adapter of a device is written once (`C3 §2.6`), and a sealed item's mark is in the signed manifest |

---

## 8g. Flow 13 — Microphones: "Search again" re-reads the local inputs, and the active-microphone rule at pre-check (R-10 AC-2; D80(5), D80(6), D81) **Erratum PE-125-13**

### 8g.1 Trigger, entry state, states

| Item | Definition |
|---|---|
| Trigger | **Search again** (G17) on a microphone notification, on a microphone row that is not reachable, or in the microphone panel of Devices. Visible label "Search again" (R-10 AC-4: one action name on every notification); accessible name "Search again for microphones"; description under it: "Re-reads the microphones connected to the Core. Microphones are not searched on the network." |
| What it is | Operation 97 `rescanCaptureInputs`: one request, one answer. **No network search, no list of candidates, nothing to connect, no password** — microphones are local inputs (D80(5); OD-06) |
| Entry state | `CAPTURE_CONFIG`; web, tablet, phone; any session state (op 97 is not locked by an open session, `C3 §2.6` "Config lock"; whether it is safe during RECORDING is row 123's open point — if the contract restricts it, the control is disabled with that reason while recording) |

| # | State | Contract answer | Web | Tablet | Phone |
|--:|---|---|---|---|---|
| 1 | Checking | role / link unresolved | button disabled, "Checking your permissions…" | same | same |
| 2 | Idle | — | button enabled | same | same |
| 3 | Reading | request pending | button pending (`Spinner`); no progress bar, no polling | same (`PendingSpinner`) | same |
| 4 | Result | op 97 `200 CaptureInputScan` | each registered microphone row reads present ("Ready") or not, with the sentence for its `errorCode` (§8f.3); "Checked at {{time}}" from `scannedAt`; the rows also follow the `captureDevices` slice | same | same |
| 5 | Other inputs present | `unregisteredCount ≥ 1` | one line: "{{count}} other microphone(s) are connected to the Core but not registered." No action — registering a microphone is not designed in this phase | same | same |
| 6 | Too soon | `429` (`INPUT_RESCAN_RATE_LIMITED`) | `common.coreErrors.limited`, fixed seconds; re-enables by itself | same | same |
| 7 | Not ready | `503` (`CAPTURE_NOT_READY`) | "Capture is not ready yet" + Retry (§2.5) | same | same |
| 8 | Not permitted | `403` | disabled + role sentence | same | same |

### 8g.2 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 97 `rescanCaptureInputs` | `PERMISSION CAPTURE_CONFIG`; web, tablet, phone | publishes `captureDevices` (`online` of the microphones) | `CAPTURE_DISCOVERY_SEARCHED` with `scope: MIC_LOCAL` |

### 8g.3 The start rule at pre-check (binding: D80(6), D81, D72(k))

Drawn in Session New on all three clients (WB-03 `DevicesStep`; MB-02 `DevicesCheckStep`), on the
existing blocked (`PRECHECK_BLOCKED`) and warning (`PRECHECK_WARNINGS` + acknowledge) paths.

| Reachability at pre-check | Row(s) | Start | What the operator is told and offered |
|---|---|---|---|
| Both cameras unreachable | both camera rows BLOCK | **Blocked** | "No camera is reachable. A session cannot start." + the search count; Search again (G13); Retry |
| One camera unreachable | that row WARN | **Allowed, degraded** after acknowledging | "Camera 2 (CAM-02) is not reachable. The session will record one camera only." Acknowledge; Search again; Retry |
| Both microphones unreachable | both microphone rows BLOCK | **Blocked** | "No microphone is reachable. A session cannot start." Search again (G17); Retry |
| **The selected ACTIVE microphone unreachable, the other reachable** | active-microphone row BLOCK | **Blocked.** | "MIC 1 (MIC-01) is the active microphone and is not reachable. Cancel this session, make MIC 2 the primary microphone on Devices, then start again." No control switches the microphone at pre-check (D83; **erratum PE-128-72**) |
| An assigned device of a kind that cannot be recorded in this phase | that row BLOCK | **Blocked** | "{{device}} cannot be recorded by this version of the system." (`SOURCE_KIND_NOT_RECORDABLE`; D82, D86 C-5; **erratum PE-128-81**) |
| The standby microphone unreachable | that row WARN | **Allowed, degraded** after acknowledging | "MIC 2 (MIC-02) is not reachable. The session will record with no standby microphone." Acknowledge; Search again (G17); Retry |
| At session start: no camera connects within the ingest-open window | — | the session **FAULTS**, reason `NO_CAMERA_CONNECTED` | flow 11, situation C: "No camera connected. Nothing was recorded." Nothing claims to record |

The client never switches the active microphone by itself (OD-11) and never starts a degraded session
without the operator's acknowledgement.

**Ruled (D83):** no operation and no control G18; the row is drawn with the blocked sentence above. **Erratum PE-128-72 (D83, OP-125-1).**

### 8g.4 Permissions and per-client definition

| Control | Permission / condition | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G17 Search again (microphones) | `CAPTURE_CONFIG` | "Checking your permissions…" | re-reads the inputs | role sentence; `429`; `503` |

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Devices audio-input cards (WB-05); Session New `DevicesStep` (WB-03) | Devices microphone rows (MB-08); Session New `DevicesCheckStep` (MB-02) | Settings -> Devices (MB-09); Session New (MB-02) |
| Forward-only | "Checked at" is a Core instant (`scannedAt`); no timer, no automatic re-read | same | same |

---

## 9. P-01..P-16 pattern application (16/16)

Each pattern from `drift §2.1` is applied to this UX spec or marked NOT APPLICABLE with a reason.

| Pattern | Applied in flow(s) | Status and reason |
|---|---|---|
| P-01 mobile recording time from one source; progress forward-only from Core instants | 2, 3, 4, 7 | **Applied** — all timers use `coreClockOf`/`recording-elapsed.ts:1-21,128-144`; `core-clock.ts:82-88`; never steps back (E-13) while RECORDING; after the Core reports the stop the authoritative recorded duration wins (D19(b)) |
| P-02 server imports contract constants; extend `contract-values.test.ts` | 1, 2, 3 | **Applied** — the UI reads thresholds/enums from `@dems/shared/api` (`packages/shared/src/api/capture.ts`, CS-25); no copied literal (OD-11 values, v2 step codes) |
| P-03 device command map derived from the contract | 1 (G9) | **Applied** — the PoE cycle is the contract entry op 48 (`C3 §3`), rendered through the existing gate |
| P-04 web query factories + `lib/download.ts` + `device-command-gate.ts` | 1, 3, 5, 6 | **Applied** — new factories in `core-queries.ts` (WB-11, E-17); download via `download.ts:26-41`; G9 via `device-command-gate.ts:50-61`. **PE-125-14:** flows 9, 10 add one factory `captureDiscoveryQueryOptions` for op 94 (gate inside the factory, polling only while `RUNNING`); the typed camera password never enters a query or mutation cache (§8d.3) |
| P-05 Restart disabled while recording | 1 (G9) | **Applied** — PoE cycle refused during `RECORDING` (`409 RECORDING_ACTIVE`, `C3 §4`) |
| P-06 `AdminResource.DEVICES` is the paired-client registry | 1 | **Applied** — capture uses `captureConfig`/`captureDevices`, their own slice/kind (E-04; `C3 §6`) |
| P-07 blank `ses_`/`dvc_`/`bio_` values in web/mobile logs | 5 | **Applied** — the signed media URL prefix `mts_` and the camera-credential form `rtsp://user:pass@host` are added to the web error sink and `runtime/log.ts` (E-31/P-07; SEC35-13/SEC35-04). **PE-125-14:** flow 10 adds the request members `username`, `secret` and the nested `credential` object of ops 95 / 96 to the web blanking list (the mobile clients never hold them) |
| P-08 mobile jest timeouts/`maxWorkers`; fake clocks | 2, 3, 4, 7 | **Applied** — every timing state (toggle latency, sealing progress, debounce) gets a fake-clock test; no wall-clock waits (notes for row 36) |
| P-09 static guards outside `src`; test-support imports | all (test notes) | **Applied** — new `capture/` guards follow the test-support rule; noted for row 36 (`drift §2.1 P-09`) |
| P-10 `selection-glow.tsx` constant border | 1, 5, 6 | **Applied** — new tablet list rows (selector, intervals, revisions) use `ROW_CARD_BORDER` (`selection-glow.tsx:40`). **PE-125-14:** the search-list rows of flow 9 too |
| P-11 in-place hand-offs, `animation:'none'` | 3, 4, 7 | **Applied** — mobile uses `monitor-handoff.ts`, `summary-handoff.ts`, `stacks.tsx:59` |
| P-12 session diagnostics for sealing progress / mic-switch latency | 2, 3 | **Applied** — `session-diagnostics.ts` is the instrumentation for the tablet gates; named for row 36 |
| P-13 "Checking your permissions..." on every gated control; web waits for the link | all flows | **Applied** — section 5 inventory (10 controls + 6 reads). **PE-125-14:** with flow 8 and flows 9-13 the inventory of section 11 holds 17 controls + 8 reads (G18 removed, D83) |
| P-14 `sweeper.ts` core-timer template | 3 | **Applied** — the 1 Hz progress recompute (`SEALING_PROGRESS_INTERVAL_MS`) is the server-side source; the UI consumes the slice |
| P-15 `statements.ts` one `CREATE DATABASE` text | — | **NOT APPLICABLE** — a database-command rule with no client surface (row 30 owns it) |
| P-16 pinned verify verdict (web) / FAIL wording (mobile) | 5, 6 | **Applied** — the v2 verify verdict is pinned per run; export-failure and revision-conflict wording is fixed (`drift §1.4 WB-04`, E-11) |

**Count: 15 applied, 1 NOT APPLICABLE (P-15, with reason) = 16/16 accounted.**

---

## 10. E-13..E-17 handling (5/5)

| Errata | Content (`drift §6`) | How this spec applies it | Status |
|---|---|---|---|
| **E-13** | MB-04/MB-05/MB-06: use in-place hand-offs + `animation:'none'`; progress forward-only from Core instants; MB-04 risk → High | Flows 3, 4, 7 (mobile): in-place `finalizing → summary` and `monitor`; all progress forward-only from Core instants; MB-04 High acknowledged; React draws final stepper state | **Applied** |
| **E-14** | MB-01: fold B15 (tablet Home mic tiles "No signal") and RC-1 (`recording-elapsed.ts:129`); risk Low → Low-Medium | Flow 2: Home mic tiles (MB-01) never show "No signal" while recording; the forward-only timer (RC-1) is reused; Home progress tile in flow 3 | **Applied** |
| **E-15** | MB-08/MB-09/MB-12: new tablet list rows use `SelectionGlow` constant border | Flows 1, 5, 6: selector device rows, audio-source intervals, transcript revisions use `ROW_CARD_BORDER` | **Applied** |
| **E-16** | MB-03/MB-08/MB-09, WB-01/WB-05: gated controls show "Checking your permissions..."; web "waits for the link" | Section 5: 10 controls × 3 clients + 6 gated reads; web `core-queries.ts:65-77` | **Applied** |
| **E-17** | new WB-11: query factories for capture config/devices, transcript, export job | Flows 1, 3, 5, 6: `captureConfigQueryOptions`, `captureDevicesQueryOptions`, `transcriptQueryOptions`, `exportJobQueryOptions` added to `lib/core-queries.ts` | **Applied** |

**Count: 5/5 applied.**

---

## 11. Gated controls and the "Checking your permissions..." state (inventory)

Every gated control shows the **"Checking your permissions..."** state while the role/link resolves —
never a silent hide, never an instant enable (`drift §2.1 P-13`, `drift §6 E-16`, `specs C-N12`).

| ID | Control | Flow | Permission / condition | Client instances |
|---|---|---|---|---|
| G1 | Selector edit | 1 | `CAPTURE_CONFIG` + idle | web, tablet, phone |
| G2 | Camera-source edit | 1 | `CAPTURE_CONFIG` + idle | web, tablet, phone |
| G3 | Primary-mic edit | 1 | `CAPTURE_CONFIG` + idle | web, tablet, phone |
| G4 | Mic toggle | 2 | `SESSION_START` + `SESSION_HOLDER` | web, tablet, phone |
| G5 | Banner "switch to standby" | 2 | `SESSION_START` + `SESSION_HOLDER` | web, tablet, phone |
| G6 | Transcript revise | 6 | `TRANSCRIPT_REVISE` | web, tablet, phone |
| G7 | Playback (media session) | 5 | `EVIDENCE_VIEW` | web, tablet, phone |
| G8 | Export / composite | 5 | `EVIDENCE_EXPORT` | web, tablet, phone |
| G9 | Camera PoE cycle | 1 | `DEVICE_MANAGE` + `LOST` + not recording | web, tablet, phone |
| G10 | Session start | 7 | `SESSION_START` | web, tablet, phone |
| G11 | Save STT configuration (section 8a; restated, **PE-125-15**) | 8 | `CAPTURE_CONFIG` | web (tablet and phone are read-only) |
| G12 | Test STT connection (section 8a; restated, **PE-125-15**) | 8 | `CAPTURE_CONFIG` | web |
| G13 | Search for cameras / Search again **PE-125-15** | 9, 11 | `CAPTURE_CONFIG`; any session state except `RECORDING` until the lift of D86 C-4 (**erratum PE-128-80**) | web, tablet, phone |
| G14 | Connect (opens the password prompt) **PE-125-15** | 10 | `CAPTURE_CONFIG` + web console + idle | web (active); tablet, phone (always disabled with the web-console sentence) |
| G15 | Test connection (op 95) **PE-125-15** | 10 | `CAPTURE_CONFIG` + web console + idle | web |
| G16 | Add as camera (op 96) **PE-125-15** | 10 | `CAPTURE_CONFIG` + web console + idle + a reachable test | web |
| G17 | Search again for microphones (op 97) **PE-125-15** | 13, 11 | `CAPTURE_CONFIG` | web, tablet, phone |

**Gated interactive controls: 10/10** — each of the 30 client instances shows the state. **Gated reads
that also render the state: 6/6** — capture config (76), capture devices (77), sealing progress (83),
transcript (84), revisions (86), evidence item/media (39/40). Every one transitions
`Checking → allowed` or `Checking → refused-with-reason`; none hides or enables instantly.

**Restated for flow 8 (D24) and flows 9-13 (erratum PE-125-15).** Gated interactive controls:
10 (G1-G10) + 2 (G11-G12, flow 8) + 5 (G13-G17, flows 9-13) = **17/17** (G18 removed, D83; **erratum PE-128-72**). Client instances:
30 (G1-G10 on three clients) + 2 (G11, G12: web only) + 11 (G13: 3, G14: 3, G15: 1, G16: 1,
G17: 3) = **43**. Gated reads that render the state: 6 + 1 (STT configuration, op 90 —
flow 8, not counted before) + 1 (the search list, op 94 — `CAPTURE_CONFIG`, owner session) = **8/8**.
The "10/10" and "6/6" figures above are the row-34 baseline and stay as written.

---

## 12. Class C note — what changes when physical devices arrive

This spec is written for **emulators and loopback** (OD-13; C-5; `C3 §9 N-5`). When physical devices
arrive, the client behaviour changes only as follows (no UX redefinition):

| Aspect | Emulator / loopback (this phase) | Physical LAN (class C, C-5) |
|---|---|---|
| Host | Signed media URL host is `127.0.0.1:<port>`; `adb reverse tcp:8081/tcp:4420` | LAN host; `adb reverse` no longer maps the Core; the URL host changes |
| Listener | Loopback only | LAN listener + TLS + origin rules; demo password replaced; B3 (W99-2/W99-3) applied first |
| Live preview | None; demo loop stays (OD-12) | Still none unless OD-12 is revisited (C-6) |
| Device e2e | Emulators; 2 + 1 per check | Physical tablet/phone e2e at M4/M5/M8 (2 + 1); release build preferred for timing (C-5) |
| Media at rest | `.data/` git-ignored (OD-25) | unchanged; long AV-drift run and repeated kill loops only pre-handover (C-9) |
| Camera/mic/PoE | `FakeOnvifStub`, fake mics, `FakePoeController` | Real ONVIF (C-1), real `CameraAdapter` (C-2), real `PoeController` (C-3), real `AudioInputAdapter` (C-4) |
| Camera search and development sources **PE-125-16** | Flows 9-13 are checked on the fake stub and fixture cameras on loopback; in the development configuration camera 1 / microphone 1 are this Mac's own devices and every such surface carries the "Development source" badge | The same screens list real cameras; the connect flow needs the Core credential store (row 84); with the development flag off no badge, no "Development sources" group and no local-device row exists. Development-mode results close no class-C item (D80(11)) |
| STT | Mac oMLX (`omlx-server`), no benchmark (D230) | `cpu-local` whisper.cpp on the Core; benchmark (RTF/RAM/WER/labelling) on the Core device (C-7) |
| Signer | Software Ed25519 (OD-04) | TPM/PKCS#11 adapter (C-8) |

The UX contract (flows, states, gated-control behaviour, forward-only rule) is unchanged; only the
transport host, the auth preconditions and the device adapters change.

---

## 13. Self-gate (this document's own acceptance)

| Gate check (from `structured row 34`) | Result |
|---|---|
| **Each flow defined for all 3 clients** | **7/7 flows × 3 clients = 21/21** — each flow has a per-client table for web, tablet and phone (sections 2.6, 3.6, 4.6, 5.6, 6.6, 7.6, 8.6) |
| **P-01..P-16 each marked applied or not applicable with reason** | **16/16** — 15 applied, 1 NOT APPLICABLE (P-15, with reason) (section 9) |
| **E-13..E-17 accounted** | **5/5** applied (section 10) |
| **Every gated control has the "Checking your permissions..." state (count them, n/n)** | **10/10 controls** (30 client instances) + **6/6 gated reads** (section 11); each transitions `Checking → allowed` or `Checking → refused-with-reason` |
| **OD-09/OD-10/OD-11/OD-12/OD-13 cited by decision ID** | **5/5** — OD-09 (flows 1, 2, 7), OD-10 (flow 1), OD-11 (flow 2), OD-12 (flows 1, 5), OD-13 (flows 5, section 12); all D4 |
| **Every flow maps to operations/slices from row 29** | **7/7** — operations: F1 76-80/44-48; F2 81-82/44-45; F3 83/27; F4 83/27/38/39; F5 82/88/39/40/41/42/87; F6 84-86; F7 24/25/27 (section 1) |
| **No emoji; English; tables over prose** | PASS |
| **Every choice cites file:line / decision ID / register row / op** | PASS (sections 0-12) |
| **Row 32 dependency stated, not redefined** | PASS — flow 3/4 bind to the op-83 envelope and SH-01 enum; row 32 owns the step list (section 4.1, section 9) |

### 13.1 Self-gate of the rev 2.3 delta (blueprint row 125) **Erratum PE-125-17**

| Gate check (row 125 as amended by D80 / D81) | Result |
|---|---|
| **Each flow has its states listed for web, tablet and phone** | **5/5 new flows** — flow 9: §8c.2 (14 states × 3 clients; S14 added, **erratum PE-128-80**); flow 10: §8d.4-§8d.7 (web) and §8d.10 (the tablet and phone state: Connect disabled with the web-console sentence); flow 11: §8e.2 (4 notifications × 3 clients), §8e.3; flow 12: §8f.2 (7 surfaces × 3 clients), §8f.3 (5 local-device states); flow 13: §8g.1 (8 states × 3 clients), §8g.3 (7 start-rule cases) |
| **The client set allowed to write a camera password is stated with its source** | **Web console only** — §8d.1, source **D80(3)** (`decisions/decisions.md:93`), enforced by `WEB_CONSOLE_SESSION` on operations 89, 95, 96 (`C3 §2.6`; D81) |
| **0 flows show a stored credential** | **0/13** — table below |
| Every flow maps to operations of the contract | 5/5 — F9: 93, 94; F10: 95, 96, 78 / 79, 89; F11: `alerts` + pre-check + 93 / 97; F12: reads 76, 77, 94, 27, 39 / 40, 41; F13: 97 + pre-check |
| Every gated control has the "Checking your permissions…" state | 17/17 controls, 43 client instances, 8/8 gated reads (section 11) |
| Rulings applied | D80(2), (3), (4), (5), (6), (7), (9), (10), (11) and D81 — table in section 0 |
| Specified with the apps' existing kit | PASS — table in §8b; no hand-built component is introduced |
| No emoji; English; tables over prose; every choice cited | PASS |

**Stored credential shown, per flow.**

| Flow | Does any state show a stored user name, password or secret? |
|---|---|
| 1 Device selector | No — no credential member in ops 76-80 |
| 2 Mic toggle | No |
| 3 Sealing progress | No |
| 4 Resumed sealing | No |
| 5 Playback | No (the signed media URL is never drawn; P-07) |
| 6 Transcript | No |
| 7 Session gating | No |
| 8 STT configuration | No — "set" / "not set" and the kind only (§8a) |
| 9 Search for cameras | No — no response shape of ops 93 / 94 carries one |
| 10 Connect a camera | No — the fields open empty; the operator sees only what they are typing (masked); after adding only "Password stored." |
| 11 No-device notifications | No — ids, labels and counts only |
| 12 Development sources | No |
| 13 Microphones | No — a microphone has no password |
| **Total** | **0 of 13** |

**Totals restated once (arithmetic).**

| Total | Row 34 | + flow 8 (D24) | + flows 9-13 (row 125) | Now |
|---|--:|--:|--:|--:|
| Flows | 7 | 1 | 5 | **13** |
| Client definitions (flows × 3) | 21 | 3 | 15 | **39** |
| Gated interactive controls | 10 (G1-G10) | 2 (G11-G12) | 5 (G13-G17) | **17** |
| Client instances of those controls | 30 | 2 | 11 | **43** |
| Gated reads | 6 | 1 (op 90) | 1 (op 94) | **8** |
| Flows that show a stored credential | 0 | 0 | 0 | **0** |
| Proposed i18n keys (§14.2) | — | — | 120 − 1 + 18 = **137** | **137** |

**Register items touched (`research/03_analysis.md` §B.3, §B.4; no new id is minted here).**
Web, by screen: WB-01 (monitor: situation C, degraded warning, badge), WB-02 (dashboard tiles),
WB-03 (Session New pre-check rows), WB-04 (evidence badge, verify line), WB-05 (Devices: search,
list, connect, banner, local rows — its register text already names "discovery list, write-only
credential entry", `research/03_analysis.md:193`), WB-07 (System entry link), WB-11 (one query
factory) = **7 of 11**; by label only: WB-08 (four audit-type labels), WB-09 (Try-it denial of 95 /
96). Mobile, by screen: MB-01, MB-02, MB-03, MB-05, MB-06, MB-07, MB-08, MB-09 = **8 of 13**; by
label only: MB-12. The alert centre (web `components/shell/notifications-bell.tsx`, mobile
`features/dashboard/home-header.tsx`) has no register id.

**Existing flows and controls whose text changed (everything else is unchanged).**

| Place | Change | Mark |
|---|---|---|
| Front matter, authority note, footer | decisions and dates; the rev 2.3 paragraph | PE-125-01 |
| Section 0 | new table "Rev 2.3 rulings applied by flows 9-13" | PE-125-02 |
| Section 1 catalogue | rows 8-13 added; rows 1-7 unchanged | PE-125-03 |
| Flow 1 — §2.2 step 2 | adopted cameras; badge | PE-125-04 |
| Flow 1 — §2.5 "Empty device list" | gains the action Search for cameras | PE-125-04 |
| Flow 1 — §2.5 | new row `DEVELOPMENT_SOURCE_NOT_ALLOWED` | PE-125-04 |
| Flow 1 — §2.6 | new row "Source options" (affects what G2 offers; the texts of G1-G3, G9 are unchanged) | PE-125-04 |
| Flow 2 — §3.6 | new row: badge on mic meters and tiles | PE-125-05 |
| Flow 5 — §6.2 step 6, §6.6 | verify line first; badge on the item and files | PE-125-06 |
| Flow 7 — §8.2 step 4, §8.5 | reachability, start rule, two new situations | PE-125-07 |
| Section 9 — P-04, P-07, P-10, P-13 | one sentence each | PE-125-14 |
| Section 11 | rows G11-G17; restated counts | PE-125-15 |
| Section 12 | one row | PE-125-16 |
| Flows 3, 4, 6, 8 (§4, §5, §7, §8a) and controls G4-G8, G10-G12 | **0 changes** | — |

**Open items carried to the M0 gate (row 39) — no blocker.**

1. Row 32 (`masterplan/06_evidence_package_spec.md`) is not yet written; this spec binds to its step
   list. The client renders whatever ordered step list op 83 returns and hard-codes only the label map,
   so a row-32 step-list change needs no UX change.
2. The `SESSION_HOLDER` access condition is proposed, not yet in `contract-model.ts` (`C3 §10`); M2
   materialises it. This spec assumes the op 81 gate exactly as `C3 §2.2` describes.
3. OD-13 loopback/class-C: physical-device behaviour is class C (C-5) and is not implemented here.

---

## 14. Vocabulary, proposed i18n keys and accessibility for flows 9-13 **Erratum PE-125-18**

### 14.1 Vocabulary — the operator's words

The UI uses the product's English vocabulary (`packages/shared/src/i18n/en/common.ts`: "Camera 1",
"MIC 1", "Retry", "Requires the {{role}} role"). Contract words stay in the contract.

| Contract / spec term | UI word | Never shown to an operator |
|---|---|---|
| discovery, probe | "Search for cameras", "Search again" | "discovery", "probe", "WS-Discovery", "ONVIF", "multicast" |
| candidate | "camera found"; in the list simply a row | "candidate", `CND-…` ids |
| `status: NEW` / `REGISTERED` | "New" / "Already registered" | — |
| credential (`username`, `secret`) | "Camera user name", "Camera password" | "credential", "secret" |
| connection test | "Test connection" | outcome codes (`WRONG_PROFILE`, …) as raw text |
| adopt | "Add as camera" | "adopt", "adoption" |
| assignment (ops 78 / 79) | "Assign to a camera slot"; "Camera 1" / "Camera 2" | "track", `VIDEO-01` as the only name (it may follow the label) |
| `sourceClass` not `PRODUCTION` | "Development source" | "sourceClass", "DEVELOPMENT" as a raw code |
| `adapter: LOCAL_DEVICE` | "This Mac's camera", "This Mac's microphone" | "LOCAL_DEVICE", "helper", "loopback" |
| `adapter: FAKE` | "Test source" (not "Simulated": that word names the Simulated mode of the clients) | "fake", "stub", "fixture" — except in the verify report line, whose text is fixed by `06` §D.1 |
| development configuration / production configuration | "development configuration" = capture operation `REAL_DEVELOPMENT`; "production configuration" = `REAL_PRODUCTION` (**erratum PE-128-81**, D82(e)) | the operation names as raw codes |
| `CAPTURE_CONFIG_LOCKED` | "…while a session is open." | the code |
| `WEB_CONSOLE_ONLY` | "…from the web console." | the code |
| `CREDENTIAL_STORE_NOT_READY` | "This Core cannot store camera passwords yet…" | "sealer", "credential store", "row 84" |
| lock-out guard | "Testing this camera is paused so that the camera does not lock its account." | "rate limit", "guard" |
| op 97 | "Search again" (microphones), "Re-reads the microphones connected to the Core." | "rescan", "enumerate" |

### 14.2 Proposed keys (not applied — this row edits no code)

All under `common` in `packages/shared/src/i18n/en/common.ts`, because each text is used by web and
mobile and by more than one feature (Devices, Session New, Monitor, Evidence). Plural texts written
"(s)" here use the i18next `_one` / `_other` forms. Rows 137 / 138 add them; the vocabulary-sync test
(`test/i18n-vocabulary-sync.test.ts`) and the mobile missing-key check (`getMissingKeys`, `@/i18n`) apply.

| Key | English text |
|---|---|
| `common.captureSearch.action` | Search for cameras |
| `common.captureSearch.again` | Search again |
| `common.captureSearch.intro` | Search the network for cameras. Searching connects to nothing. |
| `common.captureSearch.searching` | Searching the network for cameras… |
| `common.captureSearch.searchingHint` | This takes up to {{seconds}} seconds. |
| `common.captureSearch.finishing` | Finishing the search… |
| `common.captureSearch.summary` | {{count}} found · {{newCount}} new · {{registeredCount}} already registered |
| `common.captureSearch.freshness` | Searched at {{searchedAt}}. Kept until {{keptUntil}}. |
| `common.captureSearch.ownerNote` | Only you see this list, on this device. |
| `common.captureSearch.trustNote` | Make, model and name are what each device announced. They are not checked. |
| `common.captureSearch.emptyTitle` | No camera answered the search |
| `common.captureSearch.emptyBody` | Check that each camera is powered and on the same network as the Core, then search again. |
| `common.captureSearch.truncated` | More than {{max}} devices answered. The first {{max}} are listed. |
| `common.captureSearch.failed` | The search could not be completed. Nothing was changed. |
| `common.captureSearch.unavailable` | Camera search is not available on this Core yet. |
| `common.captureSearch.busy` | Another operator is searching right now. Search again when their search has finished. |
| `common.captureSearch.expired` | This search result is no longer kept. Search again to see the cameras. |
| `common.captureSearch.developmentGroup` | Development sources |
| `common.captureSearch.columns.address` | Address |
| `common.captureSearch.columns.makeModel` | Make and model |
| `common.captureSearch.columns.name` | Name |
| `common.captureSearch.columns.status` | Status |
| `common.captureSearch.makeModelUnknown` | Make and model not announced |
| `common.captureSearch.status.NEW` | New |
| `common.captureSearch.status.REGISTERED` | Already registered |
| `common.captureSearch.registeredAs` | Already registered as {{device}} |
| `common.captureSearch.notTestable` | Cannot be connected |
| `common.captureSearch.notTestableBody` | This device announced an address that is not its own. |
| `common.captureSearch.viewDevice` | View device |
| `common.captureSearch.a11y.progress` | Camera search in progress |
| `common.captureSearch.a11y.done` | Search finished: {{count}} found, {{newCount}} new. |
| `common.captureConnect.action` | Connect |
| `common.captureConnect.webOnly` | Connect this camera from the web console. |
| `common.captureConnect.webOnlyNote` | Camera passwords are entered on the web console only. Open Devices on the web console and search there. |
| `common.captureConnect.locked` | A camera cannot be connected while a session is open. |
| `common.captureConnect.title` | Connect {{name}} |
| `common.captureConnect.reference` | Device reference |
| `common.captureConnect.intro` | Enter the user name and password set on this camera. They are used for this connection only and are never shown again. |
| `common.captureConnect.username` | Camera user name |
| `common.captureConnect.password` | Camera password |
| `common.captureConnect.required` | Enter the camera user name and password. |
| `common.captureConnect.noPasswordNeeded` | This development source needs no password. **Erratum PE-WI-12:** the web dialog no longer draws this sentence; it draws `web.connect.developmentHint` of the web's own resources (`apps/core-web/src/i18n-web.ts:74`; ruling D217 (4): web sentences stay in the web's own i18n file). The shared key still holds the old sentence in `packages/shared/src/i18n/en/common.ts` (notice filed 13:45:00Z in `delegation_progress/file_requests.md`; open)**Erratum PE-WI-38 (decisions D217 (4), D218; closing pass J item 6, `implementation/135_fix_wave_i_pass_j.md`; `implementation/137_docs_errata_followup.md`) - CLOSES THAT OPEN CLAUSE:** the shared key now holds the ruled sentence, the same as the web hint: "A development source can be tested without a password. If the test asks for one, turn on \"Enter a user name and password\"." (`packages/shared/src/i18n/en/common.ts:778`; `apps/core-web/src/i18n-web.ts:76` - the line cited as `:74` in PE-WI-12 moved). The two are held equal by tests; no client reads the shared key directly today. The same sentence applies to the row "Development source" of §8d.3 |
| `common.captureConnect.enterPassword` | Enter a user name and password |
| `common.captureConnect.change` | Change |
| `common.captureConnect.test` | Test connection |
| `common.captureConnect.testing` | Testing the connection… |
| `common.captureConnect.testingHint` | This can take up to {{seconds}} seconds. |
| `common.captureConnect.outcome.REACHABLE` | Connection works. This camera can be added. |
| `common.captureConnect.outcome.UNREACHABLE` | The camera did not answer. Check its power and network cable, then test again. |
| `common.captureConnect.outcome.AUTHENTICATION_FAILED` | The camera refused this user name or password. |
| `common.captureConnect.outcome.WRONG_PROFILE` | The camera answered, but it offers no video profile this system can use. Change the video settings on the camera, then test again. |
| `common.captureConnect.outcome.NOT_H264` | The camera answered, but none of its video profiles is H.264. Set the camera to H.264, then test again. |
| `common.captureConnect.outcomeShort.REACHABLE` | Connection works |
| `common.captureConnect.outcomeShort.UNREACHABLE` | No answer |
| `common.captureConnect.outcomeShort.AUTHENTICATION_FAILED` | Password refused |
| `common.captureConnect.outcomeShort.WRONG_PROFILE` | No usable profile |
| `common.captureConnect.outcomeShort.NOT_H264` | Not H.264 |
| `common.captureConnect.profiles` | {{count}} usable video profile(s) |
| `common.captureConnect.attemptsLeft` | {{count}} more attempt(s) before testing this camera is paused. |
| `common.captureConnect.lockoutGuard` | Testing this camera is paused so that the camera does not lock its account. Try again after {{time}}. |
| `common.captureConnect.inProgress` | A connection test for this camera is already running. |
| `common.captureConnect.add` | Add as camera |
| `common.captureConnect.adding` | Adding the camera… |
| `common.captureConnect.added` | {{device}} was added. |
| `common.captureConnect.passwordStored` | Password stored. |
| `common.captureConnect.noPasswordUsed` | No password is used for this source. |
| `common.captureConnect.addedNext` | The camera is registered but not yet used. Assign it to Camera 1 or Camera 2. |
| `common.captureConnect.assign` | Assign to a camera slot |
| `common.captureConnect.storeNotReady` | This Core cannot store camera passwords yet, so this camera cannot be added. Nothing was saved. |
| `common.captureConnect.testTooOld` | The connection test is too old. Test the connection again. |
| `common.captureConnect.finalCheckFailed` | The camera did not pass the final check, so it was not added. |
| `common.captureConnect.alreadyRegistered` | This camera is already registered as {{device}}. |
| `common.captureConnect.resultGone` | This search result is no longer kept. Search again. |
| `common.captureNotice.discoveryEmpty.title` | No camera found |
| `common.captureNotice.discoveryEmpty.body` | The last search found no camera on the network. |
| `common.captureNotice.unreachable.precheck.title` | {{device}} is not reachable |
| `common.captureNotice.unreachable.precheck.camera` | It did not answer the pre-check. A search found {{count}} camera(s). |
| `common.captureNotice.unreachable.precheck.microphone` | It did not answer the pre-check. |
| `common.captureNotice.unreachable.sessionStart.title` | {{device}} is not connected |
| `common.captureNotice.unreachable.sessionStart.body` | The session is recording one camera only. |
| `common.captureNotice.noCamera.title` | No camera connected |
| `common.captureNotice.noCamera.body` | Nothing was recorded. |
| `common.captureNotice.cause.UNREACHABLE` | It did not answer. |
| `common.captureNotice.cause.AUTHENTICATION_FAILED` | It refused the stored password. Set the camera password again on the web console. |
| `common.captureNotice.cause.NOT_CONNECTED` | It did not connect in time. |
| `common.captureNotice.cause.PERMISSION_DENIED` | macOS has not allowed access for the Core. |
| `common.captureNotice.cause.DEVICE_BUSY` | Another application is using it. |
| `common.captureNotice.cause.DEVICE_NOT_FOUND` | It was not found. |
| `common.captureNotice.start.noCamera` | No camera is reachable. A session cannot start. |
| `common.captureNotice.start.oneCamera` | {{device}} is not reachable. The session will record one camera only. |
| `common.captureNotice.start.noMicrophone` | No microphone is reachable. A session cannot start. |
| `common.captureNotice.start.activeMicrophone` | {{device}} is the active microphone and is not reachable. Cancel this session, make {{other}} the primary microphone on Devices, then start again. |
| `common.captureNotice.start.activeMicrophoneFallback` | Cancel this session, make {{other}} the primary microphone on Devices, then start again. |
| `common.captureNotice.start.noStandby` | {{device}} is not reachable. The session will record with no standby microphone. |
| `common.captureNotice.start.oneMicrophone` | {{device}} is not reachable. The session will record with one microphone and no standby. |
| `common.sourceClass.badge` | Development source |
| `common.sourceClass.kind.localCamera` | This Mac's camera |
| `common.sourceClass.kind.localMicrophone` | This Mac's microphone |
| `common.sourceClass.kind.test` | Test source |
| `common.sourceClass.notAllowed` | This source can only be used in the development configuration. |
| `common.sourceClass.verify.development` | DEVELOPMENT SOURCES — this package was not recorded from production devices. |
| `common.sourceClass.verify.production` | Sources: declared as production devices by the Core that sealed this package. |
| `common.sourceClass.verify.untrusted` | Sources: not trustworthy — the manifest was altered |
| `common.sourceClass.verify.v1` | Sources: not recorded (v1 package) |
| `common.localDevice.state.READY` | Ready |
| `common.localDevice.state.PERMISSION_DENIED` | Permission needed |
| `common.localDevice.state.DEVICE_BUSY` | In use |
| `common.localDevice.state.DEVICE_NOT_FOUND` | Not found |
| `common.localDevice.permissionCamera` | macOS has not allowed camera access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Camera, allow it, then search again. |
| `common.localDevice.permissionMicrophone` | macOS has not allowed microphone access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Microphone, allow it, then search again. |
| `common.localDevice.busyCamera` | Another application is using this camera. Close that application, then search again. |
| `common.localDevice.busyMicrophone` | Another application is using this microphone. Close that application, then search again. |
| `common.localDevice.notFoundCamera` | This Mac's camera was not found. |
| `common.localDevice.notFoundMicrophone` | This Mac's microphone was not found. |
| `common.captureInputs.againLabel` | Search again for microphones |
| `common.captureInputs.description` | Re-reads the microphones connected to the Core. Microphones are not searched on the network. |
| `common.captureInputs.checkedAt` | Checked at {{time}} |
| `common.captureInputs.unregistered` | {{count}} other microphone(s) are connected to the Core but not registered. |
| `common.rbac.checking` | Checking your permissions… |
| `common.captureConnect.reveal.show` | Show password |
| `common.captureConnect.reveal.hide` | Hide password |
| `common.captureConnect.confirmDevice` | I have checked that {{address}} is this camera |
| `common.captureConnect.unverified` | This device has not been verified. Its name and model are what it announced. |
| `common.captureConnect.digestNote` | Sent as a digest: not readable in transit, but a device that receives it can test guesses against it. Use a password that is used for this camera only. |
| `common.captureConnect.charset` | Use letters, digits and common symbols only (printable ASCII). |
| `common.captureSearch.conflict` | Two devices announce the same identity. Neither can be connected. |
| `common.captureSearch.addressChanged` | This camera now answers from another address than the registered one. |
| `common.captureSearch.networksSearched` | Searched {{count}} network(s). |
| `common.captureSearch.recordingLocked` | Camera search is not available while a session is recording. |
| `common.sourceClass.microphoneOn.web` | This Mac's microphone is on |
| `common.sourceClass.cameraOn.web` | This Mac's camera is on |
| `common.sourceClass.microphoneOn.mobile` | Core Mac's microphone is on |
| `common.sourceClass.cameraOn.mobile` | Core Mac's camera is on |
| `common.session.connectingCameras` | Connecting cameras… |
| `common.localDevice.openFailed.chip` | Could not be opened |
| `common.localDevice.openFailed.body` | This Mac's camera (microphone) could not be opened. Check its permission on the Mac that runs the Core, then search again. |
| `common.captureNotice.start.notRecordable` | {{device}} cannot be recorded by this version of the system. |

Keys added by the spec gate (**erratum PE-128-82**, row 128): the 18 rows above, from `common.captureConnect.reveal.show` to `common.captureNotice.start.notRecordable`; `common.captureNotice.start.useOther` is removed (G18, D83). Count: 120 − 1 + 18 = **137**.

Notes. (1) `common.rbac.checking` exists today only in the mobile file
(`apps/mobile/src/i18n/en.mobile.ts:35`); the web sources and the shared i18n tree contain no such
string (`grep -rn "ermissions…\|ermissions\.\.\." apps/core-web/src packages/shared/src` = 0 lines), so
the web console needs it for every gated control of this file — proposed as a shared key with the
mobile text, which uses the ellipsis character. (2) Existing keys reused, not duplicated:
`common.rbac.requiresRole` (`common.ts:585`), `common.actions.retry` / `close` / `cancel` / `acknowledge`
(`common.ts:27-61`), `common.coreErrors.offline` / `timedOut` / `limited` (`common.ts:651-664`),
`common.devices.camera1` / `camera2` / `mic1` / `mic2` (`common.ts:500-507`). (3) The labels of the
four new audit types (`CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`,
`CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE`) go to `common.auditType.*` and its mirror
with the rows that add the types (132 / 142); proposed texts: "Camera search performed", "Camera
connection tested", "Camera added", "Capture device not reachable". (4) On tablet and phone the two
`kind.local*` texts are overridden in the mobile file as "Core Mac's camera" / "Core Mac's
microphone" (OP-125-7).

### 14.3 Accessibility

| Point | Web | Tablet and phone |
|---|---|---|
| Search progress | the status text is `role="status"`, `aria-live="polite"` (the pattern of `devices-banner.tsx:46`, `session-new/devices-step.tsx:154`); the `ProgressBar` has the label `captureSearch.a11y.progress` and no spoken seconds; the end is announced once with `captureSearch.a11y.done` | `accessibilityLiveRegion="polite"`; `accessibilityState={{ busy: true }}` through `busyState` |
| Disabled with a reason | the reason is **visible text** beside the control and is tied to it with `aria-describedby`; never a tooltip only | the reason is visible text in the row and part of the `accessibilityLabel`; `accessibilityState={{ disabled: true }}` |
| Connect dialog | kit `Modal` focus trap; first focus on the user-name field; each field has a `Label`; errors through `FieldError`; the outcome `Alert` is `role="status"` for *reachable* and `role="alert"` otherwise and receives focus; Escape closes except while a request is pending; closing returns focus to the row's Connect button | not applicable (no dialog) |
| Password field | `type="password"` with a reveal button that has an accessible name and state; no value in any attribute, title or label (**erratum PE-128-73**, D86 C-1) | not applicable |
| Device text | one line with an ellipsis; the full text in the accessible name; `<bdi>` isolation | `numberOfLines={1}`; full text in `accessibilityLabel` |
| Badge | icon + text; the text is the accessible name; contrast from the shared tone tokens (`toneChipProps`, `@dems/shared/tokens`) | same through the kit `StatusChip` |
| Notifications | WARNING banners `role="status"`; the CRITICAL "nothing was recorded" presentation `role="alert"`; the alert-centre popover keeps its heading (`notifications-bell.tsx:66-67`) | polite / assertive live regions; touch targets of the actions at least 44 pt |
| Motion | no decorative animation carries a state; the final state of the list, the bar and the outcome is drawn by React (§0, E-13); reduced-motion follows the existing policy (`@/motion`) | same; `SelectionGlow` always mounted |
| Language | English UI vocabulary of §14.1; sentences say what happened, what was not changed, and what to do next | same |

---

## 15. Hand-over, proposed checks and open items of the rev 2.3 delta **Erratum PE-125-19**

### 15.1 What each row must take

| Row | Takes from this delta |
|---|---|
| **126 security review** | (1) §8d.3: the typed user name and password live in the dialog's form state for two requests (95, then 96) and are cleared on close — judge against "in memory for that request"; the command path must not keep request variables in a query or mutation cache. (2) OP-125-6: no reveal control for the typed password, against a guard of 3 failed tests per camera in 15 minutes. (3) Browser autofill: the `autocomplete` values of §8d.3 and the check that a saved login of the console origin is not offered. (4) Untrusted device text (§8c.3): text nodes only, bidirectional isolation, 120 characters. (5) The address of a found camera is shown to the searching `CAPTURE_CONFIG` operator and to nobody else; alert texts carry no address. (6) Both log-blanking lists (P-07) must cover the members `username`, `secret` and the nested `credential` object of ops 95 / 96 on the web console. (7) The verify report must never print an edited source class as fact (§8f.2 rule 4). (8) The macOS permission sentence only tells the user what to do; no control opens or edits a system setting |
| **127 test catalogue** | The named checks of §15.2 with method, depth and owning row; the two depths of the connect check (before and after row 84); R-9 AC-5 "2 + 1 on each client that row 125 allows" = **the web console only**, with the tablet and phone pointer checks in its place |
| **133 server notifications (A, B)** | The alert `params` the texts need: A `reason`, `searchId`, `trigger`; B `reason`, `deviceId`, `deviceKind`, `phase`, `cause`, `searchResponderCount` (camera). The device **label** is resolved by the client from the id — the alert carries no label text and no address. One active alert per (`reason`, `target`), so five empty searches give one banner. Resolution must republish `alerts` so that 0 stale banners remain (§8e.4) |
| **137 web Devices** | Flows 9, 10 (whole), 11, 12, 13 on the web console with the building blocks of §8b; the factory `captureDiscoveryQueryOptions` (WB-11); G13-G17 with the Checking state; the keys of §14.2; the System entry link (WB-07); badge on WB-01..WB-05; Try-it stays denied for 95 / 96 (row 142). Its own acceptance "the credential is never rendered" = §8d.3 |
| **138 tablet and phone Devices** | Flows 9, 11, 12, 13; from flow 10 **only** the disabled Connect with the web-console sentence and the panel note (§8d.10) — **no password field, no call of 95 / 96 / 89**. The blueprint wording "the connect flow for the roles and clients row 125 allows" therefore means: none on these clients (D80(3)). The mobile overrides of the two local-device names (OP-125-7) |
| **139 session-start notification** | Situation C and the degraded warning of §8e.2: the fault presentation must show no timer, no recording indicator and no generated meters; `params.reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`; the degraded alert names the missing camera's device id. OP-125-5: which state follows the fault when nothing is durable, so that the tablet hand-off is defined |
| 128 spec gate | OP-125-1..5 (contract members and one operation); the wording of blueprint rows 125, 137, 138 and of `specs` R-9 AC-5 / AC-12 against D80(3) |
| 141 mark + verify | The report lines of §8f.2 verbatim; the `sources` block reaching the clients through op 41 |

### 15.2 Named checks proposed to row 127

Depth "2 + 1" = two runs and one verification. Emulator lanes as in `masterplan/10_test_strategy.md`
(`M4-SEL-T`: `dems2_tablet`, emulator-5556, lane 2; `M4-SEL-P`: `dems2_phone`, emulator-5554, lane 1).
No agent types a device PIN; every check uses the fake ONVIF stub and fixture cameras on loopback.

| Check | Client | What it proves | Method | Depth | Row |
|---|---|---|---|---|---|
| `M4-DISC-W` | web | search with N stub devices: states S1 -> S3 -> S4, N rows, "New" / "Already registered", the development group, freshness line, Search again replaces the list | agent-browser on a lane | 2 + 1 | 137 |
| `M4-DISC-T` / `M4-DISC-P` | tablet / phone | the same on each emulator | emulator lane | 2 + 1 each | 138 |
| `M4-DISC-EMPTY-W` / `-T` / `-P` | all three | stub empty: empty state, one banner, one alert-centre item, Search again; five searches still one alert; a later search with a responder leaves 0 banners | agent-browser / emulator | 2 + 1 each | 137, 138, 133 |
| `M4-DISC-RBAC-W` / `-T` / `-P` | all three | a role without `CAPTURE_CONFIG`: Checking state, then disabled with the role sentence; 0 calls of op 94 | agent-browser / emulator + request log | 2 + 1 each | 137, 138 |
| `M4-DISC-OWNER-W` | web | a second operator session sees no list and the alert only | two browser sessions | 2 + 1 | 137 |
| **`M4-CONN-W`** | web | **the connect flow with a fake camera**: both fields empty on open; each of the five outcomes once with its message and next action; a development source added without a password, then assigned through the selector; before row 84 an add with a password ends in "This Core cannot store camera passwords yet…". After each run the fixture password string has **0** occurrences in the page text, the DOM snapshot, the field values after close, `localStorage`, `sessionStorage`, the URL and the console log | **agent-browser** on a lane with fixture credentials on the fake stub | 2 + 1 | 137 |
| `M7-CONN-W-CRED` | web | after row 84: add with a password succeeds, "Password stored." and no value anywhere | agent-browser | 2 + 1 | 137 (re-run at M7) |
| `M4-CONN-ABANDON-W` | web | each exit of §8d.7: the UI state described there and 0 new rows in `capture_devices` / `capture_device_credentials` | agent-browser + row count | 2 + 1 | 137 |
| `M4-CONN-LOCK-W` | web | with a session open: Connect disabled with its sentence, 0 toasts, search still works | agent-browser | 2 + 1 | 137 |
| `M4-CONN-GUARD-W` | web | two refused passwords: the attempts-left text follows the server's value, then the lock-out sentence and a disabled Test (D86 C-2; **erratum PE-128-74**); no client-side countdown | agent-browser, fake clock on the Core | 2 + 1 | 137 |
| `M4-CONN-PTR-T` / `-P` | tablet / phone | Connect disabled with the web-console sentence; **0 password fields in the view tree**; 0 calls of 95 / 96 / 89 | emulator + static test over `apps/mobile/src` | 2 + 1 each | 138 |
| `M4-NODEV-B-W` / `-T` / `-P` | all three | pre-check with one fake camera stopped: warning row naming the device with the search count, start allowed after acknowledging; both stopped: blocked; a later reachable run leaves 0 banners | agent-browser / emulator | 2 + 1 each | 133, 137, 138 |
| `M4-NODEV-NOCFG-T` | tablet | an operator with `SESSION_START` and without `CAPTURE_CONFIG`: the notification only, Search again disabled, Retry works, no list | emulator | 2 + 1 | 138 |
| `M4-MIC-RESCAN-W` / `-T` / `-P` | all three | Search again on a microphone: one request, per-microphone result, 0 network probes | agent-browser / emulator | 2 + 1 each | 137, 138 |
| `M4-MIC-ACTIVE-W` / `-T` / `-P` | all three | active microphone unreachable: blocked with its sentence; no toggle control exists at pre-check; after the operator cancels, makes the other microphone primary on Devices and starts again: a warning and a degraded start (D83) | agent-browser / emulator | 2 + 1 each | 137, 138 |
| `M5-NODEV-C-W` / `-T` / `-P` | all three | no camera at start: fault presentation "Nothing was recorded.", 0 timer, 0 recording indicator, 0 meters; one camera: warning banner and a NO SIGNAL tile | agent-browser / emulator | 2 + 1 each | 139 |
| `M4-DEVSRC-LABEL-W` / `-T` / `-P` | all three | the badge on Devices rows, selector, search list, pre-check and monitor tiles in the development configuration; with the flag off 0 badges, 0 local rows, no group header | agent-browser / emulator | 2 + 1 each | 137, 138 |
| `M7-DEVSRC-EVID-W` / `-T` / `-P` | all three | sealed development package: badge on the item, the verify line first with a PASS verdict; an edited mark reads "not trustworthy" | agent-browser / emulator | 2 + 1 each | 141 with 137 / 138 |
| `M4-DEVSRC-LOCAL` | component | local-device row states (ready, permission needed, busy, not found) from a stub helper; the row keeps its name and badge, no test source appears; 0 media frames written to `docs/` | jest `--maxWorkers=2` on web and mobile | per run | 137, 138 |
| `M4-UX-UNIT` | component | fields cleared on close and unmounted; no request variables in the query cache; a device name containing markup is drawn literally; progress is forward-only under a fake clock; the list order equals the answer order | jest `--maxWorkers=2`, fake clocks (P-08) | per run | 137, 138 |

### 15.3 Open items (none decided silently)

**Closed at the spec gate (row 128):** OP-125-1 (D83: no operation, no G18); OP-125-2 (not carried in this phase, C3 §2.6); OP-125-3 (carried, C3 §3.1); OP-125-4 (accepted limit: the situation-B alert only); OP-125-5 (D84); OP-125-6 (D86 C-1); OP-125-7 (D83). **Erratum PE-128-83.**

| ID | Open item | Why it matters for the UI | Owner |
|---|---|---|---|
| OP-125-1 | **No operation exists for "make the other microphone active" at pre-check.** D81 rules the behaviour; op 80 is locked once a session exists, op 81 is valid only in RECORDING; `C3 §3.1` still carries the older proposal | G18 cannot be built as a one-press action until the contract names it; the fallback path of §8g.3 works today | rows 121 / 128; controller |
| OP-125-2 | `CaptureDevice` (op 77) has no `credentialSet` member; only the answer of op 96 has | a registered camera row cannot say "Password set" after the dialog closed; nothing is inferred client-side | row 128 |
| OP-125-3 | `03_api_contract.md` carries neither the package mark on ops 39 / 40 nor the `sources` block on op 41 (0 matches of `developmentSources` in that file on 2026-10-09; row 124 A-2 and its hand-over) | the evidence-list badge and the verify line have no response member yet | rows 121 / 128; row 122 for a column |
| OP-125-4 | The named cause for a **local camera** (`PERMISSION_DENIED`, `DEVICE_BUSY`) reaches the client only inside the situation-B alert of a pre-check; op 97 reports microphones only | on the Devices page a local camera reads "Not reachable" without its reason until a pre-check ran | rows 123 / 128 |
| OP-125-5 | closed (D84): after situation C with nothing durable there is no Recovery hand-off — the fault presentation, then the idle state; no evidence item is shown. **Erratum PE-128-79** — was: which session state follows the situation-C fault when nothing is durable | the tablet's fault hand-off (MB-03 -> MB-06) must not show a recovery of evidence that does not exist | rows 71 / 139 |
| OP-125-6 | closed: D86 C-1 — a reveal control for the typed password is allowed (§8d.3); the guard is 2 failures per camera in 30 minutes (D86 C-2). **Erratum PE-128-73** | a typing mistake costs one of two attempts | closed |
| OP-125-7 | closed: (a) "Core Mac's camera / microphone" on tablet and phone accepted (D83); (b) overruled (D83): no badge in Simulated client mode. **Erratum PE-128-75** | (a) departs from the wording in the row brief; (b) the look of the demo is unchanged | closed |

---

*Generated: 2026-10-07 17:30*
*Last Updated: 2026-10-09 (row-128 spec-gate fix pass PE-128-72..83 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 125, PE-125-01..19: client delta for R-9..R-11 — flows 9-13, sections 8b-8g, 14, 15; D73-D81); 2026-10-09 (status sweep PE-R8-12..13: §8a Flow 8 confirmed by D24); 2026-10-08 (RV-SPEC: D19(b) refinement in §0/§3.7/§9 P-01; §8a Flow 8 added as a proposal, R-8/D20; earlier: row-35 cross-refs SEC35-12/SEC35-13)*
