---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave L, driver L-W (apps/core-web) - web findings of re-checks 70, 75 + 81, 89, 94
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit b05106b + fix 151 + the working tree of wave L (no commit, no git write)
contract: delegation_progress/contract_wave_l.md (sections 1-5, 7; members read BY NAME, examples imported)
decisions: D227, D228, D229, D230b
status: needs-review
---

# 154 - Fix wave L, driver L-W (core-web)

Area: `apps/core-web` only (55 files changed, 7 new; list in section 8). `packages/shared`,
`apps/core-server`, `apps/mobile`, `scripts` untouched. No git write. Lane 2's web console was driven in
a real browser: **Google Chrome (headless=new, `--mute-audio`) over CDP at 1440 x 900**, with the
helper's session cookie as the gates did (no password typed or printed). Nothing was played aloud; no
LOCAL_DEVICE source was selected, pre-checked or started; no attendance variable; `.data/pg*.env` not
read. Paths are relative to `apps/core-web/src/` unless they start with another root. Run window
10:13 - 11:02 WIB. Evidence: `.cache/gates/wave-l-w/` (git-ignored).

Status **needs-review**, for four stated reasons: (1) four wordings are my decisions and differ from
what a contract line or the mobile app says (D-1 .. D-4 in section 6); (2) the whole-workspace suite was
not run after the last edits (the folders I touched ran once: 11 red pins, moved by delta, re-run green
by file); (3) lane 1 was read after the changes but I hold no "before" text of it (it was stopped when I
started), so "unchanged" rests on marker strings and the pinned control cases; (4) the sweep leaves
listed remainders (section 3.3).

## 1. Findings

| Finding | Cause (file:line before) | Change | Test | LIVE in the browser |
|---|---|---|---|---|
| **G94c-01 MAJOR** | `features/evidence/media-session.ts:265-295` waited for a cut stream to END; through the dev origin it never ends | 2.1 | player file, 6 new cases | **PROVEN**: (a) (b) (c) (d) (e), section 4.1 |
| **G75d-02** (must-fix) | no screen sent operation 33 for a BLOCKED seal (`status-banner.tsx:146` offered recovery for FAULT only) | 2.2 | wave L file "G75d-02" (4) | **PROVEN** with the rig: blocked -> release -> "Retry sealing" -> sealed, 4.2 |
| **G75d-01** (must-fix) | header pill / ring read the system flags only; the bell had no acknowledge control; `session-monitor/model.ts:252-257` took the worst alert of the whole Core | 2.3 | "G75d-01 / -03" (6) | **PROVEN**: `ALR-000049` acknowledged from the bell, 4.3 |
| G75d-03 | `dashboard/system-ring-panel.tsx` read `selectRingPrimitives` only | 2.3 | same | **PROVEN** (ring CRITICAL while blocked) |
| **G89c-01** | `dashboard/sim-adapter.ts` `selectDigest`: only `DEMO_PACKAGE` was a package | 2.4 | "G89c-01" (2) | PROVEN (no suffix under `EV-20261011-0032` / `-0033`) |
| **G89c-02** | `security-audit/tamper-panel.tsx:79-83` over `packageIntegrity` (bundled index) | 2.4 | "G89c-02" (3) | PROVEN: "19 PASS • 1 FAIL / EV-20261009-0005: VIDEO-02 fragment 3 failed verification" |
| **G89c-03** | `session-monitor/integrity-panel.tsx`: `facts === null` fell back to `demoChecks` | 2.4 | "G89c-03" (2) | PROVEN after the lane 2 restart (the state that produces it) |
| G75d-05 | `details-panel.tsx:67` label of `session.input.profileId` | 2.4 | "G75d-05" (3) | PROVEN: "Configured profile / VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30" |
| G89c-04 | no reader of field 36 on the item | 2.4 | "G89c-04" (2) | PROVEN on `-0033`, `-0005` (720P30) and `-0025` (the notice) |
| G75d-06 | `devices/camera-preview.tsx:38`, `capture-selector-panel.tsx:102`, audio card, drawers drew `model` / gain / phantom | 2.4 | "G75d-06" (1), "G75d-07" Devices case | PROVEN on Dashboard, Monitor, Devices |
| G75d-07 | one chip (System > About); `devices/model.ts:228` counted GNSS and TPM in "OTHER DEVICES" | 2.4 | "G75d-07" (4) | PROVEN: 16 chips on four pages; "3/3" |
| G70c-02 web | `source-state.ts:46` REACHABLE from `online`; `camera-preview.tsx` "Online"; roster "Ready" | 2.4 | "G70c-02" (3) | PROVEN, incl. `CAM-05` (dead port) on a track: "Not checked" |
| G89c-05 | `security-audit/model.ts:415` SIGNATURE always `notReported` on such a Core | 2.4 | "G89c-05" (1) | PROVEN: "Manifest signature ... Active", "2 of 9 active · 7 not reported" |
| G75d-04 | `finalization-modal.tsx`: the dialog of an ENDED session drew progress; `sealing-progress.ts:109` `resumed: attempt > 1` | 2.5 | "G75d-04" (2) | **PROVEN** with the rig (unsealable), 4.4 |
| G94c-02 | the finished-exports list is part of operation 40, read once at the opening | 2.5 | export-job file "G94c-02" (2) | PROVEN: `EXP-000040` listed with no reload |
| G89c-07 | `.sm-integrity-body` scrolled with no cue | 2.5 | none (layout; jsdom has none) | PROVEN by picture at 1440 x 900 |
| G89c-08 | strip value `white-space: nowrap`; tiles taller than their row | 2.5 | none (layout) | PROVEN by picture at 1440 x 900 |
| G70c-08 | `registered-devices-model.ts`: built-in ids never got a card | 2.5 | "G70c-08" (2) | PROVEN: `CAM-02` card while `CAM-05` fed Camera 2 |

## 2. Per finding

### 2.1 G94c-01 - the web tamper demonstration

**Reproduced first** (10:14, `EV-20261009-0005`, lane 2, before any edit): `VIDEO-02` `readyState 0`,
"This file has not loaded.", the probe's one request `bytes=0-` -> 206, cancelled by the page 10.0 s
later (`net_repro.log`), no integrity element. Exactly the verifier's measurement.

**Change.**
- `features/evidence/media-session.ts` `probeMediaSession` rewritten: it walks the file in SMALL BOUNDED
  ranges (`bytes=a-b`, `MEDIA_PROBE_CHUNK_BYTES` 2 MiB), each with a short limit
  (`MEDIA_PROBE_REQUEST_TIMEOUT_MS` 4 s for the headers). `drain` now knows three ways an answer stops:
  the read rejects, the body ends short, **or no byte arrives for `MEDIA_PROBE_IDLE_MS` (1.5 s) short of
  the stated length**. In each case the next range starts AT THE BYTE REACHED - the first byte of the
  fragment the Core would not send - and the `409` is read. A range served whole is followed by the next
  one; an answer silent twice at one place is `UNKNOWN`; silence alone is never an integrity failure.
  Bounds: 12 requests, 16 MiB, 15 s.
- `features/evidence/sealed-player.tsx`: the question starts from what the element HOLDS
  (`bufferedEndMs`, or the playhead when further, three fragments back; a file that never loaded: 0);
  a running stall watch keeps its time (a Play or a seek pushed the question back - on the 8 s item the
  other file ended before it was asked: the verifier's run 2); a `timeupdate` of an element that holds
  nothing (`currentTime 0`, `readyState 0`, fired by the pause at the end of the other file) is no sign
  of life - that is what erased the sentence at the end.
- Unchanged: the sentence, the "Stopped" tile, the other file playing on (wave K).

**Requests and audit rows of one stop** (measured, 4.1): the probe sent **3 requests** (0-2097151 served
whole; 2097152-4194303 silent at byte 2,257,425; the third at 2,257,425 -> 409). Audit rows of one stop:
2 "Media session opened" (the element's own sessions) + the Core's "Media stream stopped" WARNING rows.
Run (a) wrote TWO such rows (seq 760, 761: `rangeStart 1146880` and `2228224` - both the media
ELEMENT's own range requests, none the probe's); the reproduction before the fix wrote ONE (756); run
(b) wrote none (inside the Core's 60 s window). So the probe added no row in these runs; the count
varies with the element's requests and the Core's window, not with this fix.

**Both origins.** The project has no built web path that serves Live mode without the dev proxy
(README: the packaged web launchers are Simulated-only). What I could run instead: the PRODUCT's
`probeMediaSession` straight at lane 2's Core (`.cache/gates/wave-l-w/tools/direct-probe.mts`), where a
cut stream CLOSES the connection: `NOT_AUTHENTIC VIDEO-02 seq 3` in 16 ms with the same three requests;
the clean item `SERVED`. So the probe holds whether the cut hangs (1.5 s) or closes (at once).

**Not done, by choice:** contract section 7 (b) (make the dev proxy pass the cut on). The player no
longer depends on it, and `vite.config.ts` is pinned by its security comment (an entry holds `target`
and the path-blanking hook only).

### 2.2 G75d-02 - the retry of a blocked seal

NEW `features/session-monitor/seal-retry.tsx` `SealRetryControl`: for a role with
`canRetryBlockedSeal(role)` the button "Retry sealing" (operation 33, `actions.recover()` through
`settle`, pending state, refusal to the presenter then a toast); every role reads "Sealing stopped after
3 automatic retries." (`SEAL_AUTOMATIC_RETRIES`) and "An investigator or a supervisor can retry." Drawn
on the Monitor banner (`status-banner.tsx`, while `data-seal="BLOCKED"`) and in the seal dialog
(`seal-attention.tsx`).

### 2.3 G75d-01 / G75d-03 - the open notice and the blocked seal on the status surfaces

- `components/shell/secure-pill.tsx`: with `openUnsealableNoticesOf(state).length > 0` and no fault the
  pill reads "OPEN NOTICE / 1 recording could not be sealed" (amber, `data-open-notice`), never
  "SECURE / All systems operational". A real fault keeps its own words.
- `features/dashboard/system-ring-panel.tsx` + `sim-adapter.ts` (three primitive selectors): a BLOCKED
  seal (`sealAttentionOf`) makes the ring CRITICAL "NO NEW SESSION UNTIL IT IS SEALED / Sealing of
  session ... is blocked ..."; an open notice makes it ATTENTION "OPEN NOTICE • RECORDING NOT BLOCKED /
  A recording could not be sealed (SES-...) ... Recording is not blocked."
- `components/shell/notifications-bell.tsx` `UnsealableNoticeRow`: the plain sentence
  (`SEAL_UNSEALABLE_PLAIN_SENTENCE`), "Session SES-... · Cause code: ...", and for
  `canResolveUnsealable(role)` the button "Acknowledge and close" (operation 70, also on an alert that
  is already acknowledged and still active); the other roles read "A supervisor acknowledges this notice
  to close it."
- `features/session-monitor/model.ts` `worstAlertOfSession` (the contract's exact test): an alert with
  `alertBlocksRecording(alert) === false` is never a state of a session; an alert that names a session
  counts only for that session.

### 2.4 The sweep (the one rule)

Rule used everywhere: `useSelfCaptureCore()` (`lib/own-capture.ts`: `security.platformNotReported` or
`time.hostClock`) and, where the rule was already the Live-only one, `useRealCaptureCore()`. The
simulated lane reads neither and is unchanged.

- **G89c-01** `dashboard/sim-adapter.ts` `manifestDigestSourceOf`: `sealedPackage: PRESENT` = a package
  (no suffix); `NOT_READABLE` = "PACKAGE NOT READABLE"; no member = as before.
- **G89c-02** NEW `security-audit/core-verify-rows.ts` `coreVerifyOutcomes`: the newest
  `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` row of each item among the rows the page holds, with
  the place the Core named (`details.failedFragments` "VIDEO-02:3"). The tile reads "Last verify run per
  item / n PASS • m FAIL", the chip "From the verify rows of this Core in the audit view"; no row: "Not
  reported". The bundled index is not read on such a Core.
- **G89c-03** `integrity-panel.tsx`: with no capture member the card of such a Core shows "Capture -
  Evidence EV-... is sealed. Verify it on its Evidence page." (or "No recording is running."), the audit
  chain (real) and the clock the Core reads. No "Encryption Active", "Secure Timestamp Synced", "Storage
  Write Verified".
- **G75d-05** `session-monitor/sim-adapter.ts` `configuredProfileLinesOf`: the session's selector
  snapshot, else the selector in force, one "VIDEO-0n: <profile>" per track, label "Configured profile".
- **G89c-04** `evidence/item-facts.ts` reads `evidence.files[].profile` and
  `evidence.streamProfileNotice` by name; NEW `evidence/sealed-format.tsx` draws "Sealed format (signed
  manifest)" per track and the Core's notice. An item that states neither draws nothing.
- **G75d-06** NEW `devices/own-core-words.ts`: `adapter: FAKE` reads "Generated test source" on the
  camera tile, the selector lines and options, the registered-device drawer; the audio card names the
  line ("MIC 1", "MIC-01 · AUDIO-01") and draws no gain / phantom row; the mic drawer reads "Not
  reported" for channel, port, gain, phantom, converter; Monitor "MIC 1" / "MIC 2" without the dataset
  roles; the camera tile "VIDEO-01" without "Lens 1"; the Devices summary without "Dual-lens DL-2 on PoE
  CAM 1" / "Balanced XLR · 48 V phantom".
- **G75d-07** NEW `components/synthetic-values-chip.tsx`; drawn by the panel components of four pages
  for their model blocks: Devices (OTHER DEVICES, FRONT PANEL, PORT MAP, the two model cards of the
  summary), Network & Time (NETWORK STATUS, NETWORK DOMAINS), Storage (USAGE OVER 24 H, VOLUMES &
  HEALTH, RETENTION CALCULATOR), System (the banner, SERVICES, HEALTH, SOFTWARE UPDATE, DIAGNOSTICS &
  MAINTENANCE; ABOUT had its own). "OTHER DEVICES" counts what the banner counts (`countedDevicesOf`):
  "3/3" beside "7/7". "GNSS SMA" reads "Not configured" on a host clock. Dashboard: Network column and
  strip cell "Not reported"; ring caption "No fault is reported. A new session can be started."; the
  Network & Time banner no longer prints the model's address.
- **G70c-02** `source-state.ts`: at rest `online: true` is NOT_CHECKED ("Not checked"); REACHABLE needs
  a stated `checkedAt` or a recording; `online: false` and a LOST stream stay. The "No preview" tile uses
  the same rule; a registered source reads "Ready" only when the Core opened or checked it
  (`rosterStateNotChecked`), else "Not checked".
- **G89c-05** `security-audit/model.ts`: a signing key the Core's items name makes the control stated
  ("Active"), not "Not reported".

### 2.5 The small ones

- **G75d-04** NEW `session-monitor/unsealable-cause.ts` (`selectUnsealableCause`: the alert of THAT
  session, open or resolved); `finalization-modal.tsx`: a session that ended unsealable draws the title
  "Recording not sealed", the plain sentence, "Cause code: ...", Close - no progress bar, no percentage,
  no steps, no "Resumed after restart"; "Resumed" is otherwise said only while the session is still open.
- **G94c-02** `evidence/export-job-status.tsx`: when the job reaches COMPLETE / FAILED the item's
  operation 40 query is invalidated once (through `deferEffectStart`, the StrictMode rule of `features/`).
- **G89c-07** `session-monitor/panel.tsx` (`bodyRef`), `integrity-panel.tsx`, CSS `.sm-scroll-cue`: a
  sticky opaque strip "More below - scroll" while the body can scroll down.
- **G89c-08** `dashboard/dashboard.css`, `status-strip.tsx`, `devices/camera-preview.tsx`: a long strip
  value wraps in its own cell; in a Dashboard tile the badge is one line, the four lines of "No preview"
  fit, nothing is drawn outside a tile.
- **G70c-08** `registered-devices-model.ts`: a built-in source on NO selector line gets its card.

## 3. The sweep - every reader, page by page

### 3.1 `sim-adapter.ts` files

| File | Page | What it reads | On a real-capture Core now |
|---|---|---|---|
| `features/dashboard/sim-adapter.ts` | Dashboard | ring state, manifest digest source | ring: 2.3; "Manifest hash" without suffix for `sealedPackage: PRESENT` (K -> **L**) |
| `features/security-audit/sim-adapter.ts` | Security & Audit | `keyEntries` (bundled index), `packageIntegrity`, `packageExportOf` | keys: the Core's key (wave K); tamper tile: the Core's verify rows (**L**); `packageExportOf` joins DEMO packages to demonstration items only (custody panel, unchanged: a real item matches none) |
| `features/session-monitor/sim-adapter.ts` | Monitor | timeline, stream-profile notice, **configured profile** | "Configured profile" from the selector (**L**) |
| `features/devices/sim-adapter.ts` | Devices | PoE book values, port codes, LCD | under the chip (FRONT PANEL, PORT MAP, OTHER DEVICES) (**L**) |
| `features/storage/sim-adapter.ts` | Storage | volumes, history | VOLUMES & HEALTH, USAGE OVER 24 H under the chip (**L**); capacity is the evidence volume the Core reads |
| `features/network-time/sim-adapter.ts` | Network & Time | A/V sync, banner | A/V "Not measured" (K); banner without the address (**L**) |
| `features/system/sim-adapter.ts` | System | services, health, update, diagnostics | each block under the chip (**L**) |
| `features/evidence/sim-adapter.ts` | Evidence | Simulated-mode verify / export records | not used in Live mode (the Core's answers are) |
| `features/session-new/sim-adapter.ts` | New Session | start / pre-check actions | the Core's pre-check; the form's "Recording Profile" choice: remainder R-1 |
| `features/login/sim-adapter.ts` | Login | device strip | Simulated mode only (Live shows the Core's service facts) |
| `features/api-reference/sim-adapter.ts` | API Reference | example payloads | a developer page of examples, labelled as such |

### 3.2 Bundled index / dataset readers

| Reader | Page, sentence | On a real-capture Core now |
|---|---|---|
| `security-audit/tamper-panel.tsx` (`packageIntegrity`) | "EVIDENCE PACKAGES 12 PASS • 1 FAIL / ...: AUDIO-02 hash mismatch / DEMO - precomputed" | not drawn; the Core's rows (**L**) |
| `security-audit/use-security-data.ts:66` (`DEMO_EVIDENCE_INDEX.key.algorithm`) | the algorithm in "Manifest signature" | the algorithm of the Core's own key (wave K); the bundled value only on the simulated lane |
| `evidence/integrity-tab.tsx:375-380` (DEMO certificate block) | Hash & Integrity of a DEMO package | drawn for a demonstration item with a bundled package only; a real item draws the Core's verify result (12c read it: no DEMO word) |
| `evidence/export-download.ts:139-141` | the export manifest of a SIMULATED export | Simulated-mode download only; a Core export is the Core's archive |
| `evidence/model.ts`, `session-monitor/finalization-modal.tsx` (`matchDemoPackage`) | DEMO package joins | a real item (`integritySource: REAL`) matches none (waves H, K) |
| `system/demo-panel.tsx` | demo controls | not shown on lane 2 (demo controls unset) |
| `api-reference/api-document.ts` | example payloads | labelled DEMO dataset |
| `devices/camera-preview.tsx`, `capture-selector-panel.tsx`, drawers (`captureDevices[].model`) | "Dual-lens IP camera DL-2", "USB condenser microphone UM-1", "FAKE-CAM-1" | "Generated test source" (**L**) |
| `devices/audio-input-card.tsx`, `device-drawer.tsx` (`mics[].gainDb`, `.phantom`, `.channel`) | "GAIN 32 dB", "PHANTOM POWER 48 V ON" | not drawn / "Not reported" (**L**) |
| `session-monitor/audio-panel.tsx` (`mics[].name`) | "MIC 1 – Interviewer" | "MIC 1" (**L**) |

### 3.3 Hard-coded status words, and the remainders (NOT changed - listed)

Words counted on lane 2's nine pages after the change (`.cache/gates/wave-l-w/after/*.txt`): "DEMO" 0,
"imulated" 0, "Dual-lens" 0, "UM-1" 0, "Interviewer" 0, "Reachable" 0, "Encryption" 0, "AES" 0.

| # | Remainder | Where | Why left |
|---|---|---|---|
| R-1 | "Recording Profile / Standard (1080p / 25 fps)" on the New Session form | `/session/new` | the form's choice (`session.input.profileId`), ruled "next task" (D224 (5)) |
| R-2 | tile chips "READY" of the two tracks and the two lines; strip "2 Cameras Ready / 2 Microphones Ready"; Devices banner "ALL DEVICES READY 7/7 / Every input and link is operating normally" | Dashboard, Monitor, Devices | the track state of the engine (`cameras[].online / .lens`, contract section 5 "facts as far as the capture session drives them"); at rest nothing drives them. Decision D-2 |
| R-3 | "CONNECTED" in the Network & Time banner title; "Evidence HDD · 1.0 TB" under the capacity ring; "Sealed evidence - Protected" in the policy | Network & Time, Storage | one word each beside a chip-marked block; the policy is stored configuration |
| R-4 | "USB input" on the selector's microphone lines | Devices | the line's own `transport` member (selector), not the dataset's model |
| R-5 | words under a chip: "GNSS, NTP and RTC management" (services), "Online" (other devices), the address in System > About | System, Devices | marked as synthetic by the chip |

## 4. Proven LIVE in the browser (lane 2, Chrome headless muted)

### 4.1 G94c-01

| | Run | Result |
|---|---|---|
| (a) | open `EV-20261009-0005`, wait, Play, to the end | 5 s after the open: alert "This recording failed its integrity check at VIDEO-02 fragment 3." + "The Core server refused the fragment ... Camera 2 is stopped. Camera 1 plays on. Run Verify for the full result."; tile "Stopped: this file failed its integrity check at fragment 3."; Camera 1 0 -> 8.02 s; **at 0:08 / 0:08 the alert and the tile are still there** (`a1_`, `a2_tamper_*.png`) |
| (b) | open, click the scrubber at 80 %, Play | Camera 1 plays 7.4 -> 8.02 and ends; the sentence and the tile appear after the end and stay (`b1_`) |
| (c) | the clean `EV-20261008-0001` right after | both files `readyState 4`, 0 -> 8.02 s, no alert, no "has not loaded"; 21 x 206, no 409 (`c1_`) |
| (d) | network panel (`net_a.log`, tokens blanked at write) | `bytes=0-2097151` 206; `bytes=2097152-4194303` 206, cancelled by the page 1.5 s later; **`bytes=2257425-4354576` -> 409**, len 305 |
| (e) | audit rows of one stop | (a): seq 758, 759 opened + 760, 761 WARNING "Media stream stopped: VIDEO-02 fragment 3 (FRAGMENT_NOT_AUTHENTIC)"; (b): 762, 763 opened only; (c): 764, 765 opened |

### 4.2 G75d-02 (seal rig, announced in `contract_wave_l.md`)

`seal-rig 2 blocked` 10:39; `SES-20261011-0044` through the API, 49 s, stopped 10:40:29; BLOCKED 10:43:04.
Supervisor: banner "SEALING BLOCKED ... Sealing stopped after 3 automatic retries. An investigator or a
supervisor can retry. [Retry sealing]"; dialog the same two sentences + "When the cause is resolved,
retry the seal here." + the button; pill "CRITICAL / Sealing is blocked"; Dashboard ring CRITICAL "NO NEW
SESSION UNTIL IT IS SEALED". Technician: no button on either, both read who can. `seal-rig 2 release`
10:43:32 (the session stayed blocked); **"Retry sealing" pressed in the dialog 10:43:52 -> "Evidence
sealed" `EV-20261011-0033` at 10:43:54**; seq 793 `RECOVERY_STARTED {reason SEAL_RETRY}`, 794
`EVIDENCE_SEALED`; verify PASS 15 of 15; no "Resumed after restart"; rig OFF. Pictures `l2_*.png`.

### 4.3 G75d-01 / -03

After the lane 2 restart: pill "OPEN NOTICE / 1 recording could not be sealed"; ring ATTENTION "OPEN
NOTICE • RECORDING NOT BLOCKED / A recording could not be sealed (SES-20261011-0041) ..."; bell row with
the plain sentence, "Session SES-20261011-0041 · Cause code: SESSION_KEY_NOT_OF_SESSION", "Acknowledge and
close". **Pressed: `ALR-000049` `active false, acknowledged true, resolvedAt` set; seq 781 `FAULT_CLEARED`
(`reason UNSEALABLE`, `operationId acknowledgeAlert`, session `SES-20261011-0041`); pill "SECURE", ring
READY, bell "No new alerts".** Then, beside a NEW active notice (4.4), a clean recording
(`SES-20261011-0046`): banner "SESSION ACTIVE / Recording. The first fragment is durable ...", pill "OPEN
NOTICE" - no FAULT of another session (`l3_monitor_recording_beside_open_notice.png`).

### 4.4 Items 4 and 5

- G89c-03 (after the restart, `SES-20261011-0043` sealed, no capture member): card "Capture - Evidence
  EV-20261011-0032 is sealed. Verify it on its Evidence page. / Audit Log Hash Chain SHA-256 / Time
  Source Core system clock"; `data-own-core`. G75d-05 on the same page.
- G89c-04: `-0033` and `-0005` "VIDEO-01 H264_720P30 / VIDEO-02 H264_720P30"; `-0025` "H264_720P27.67 /
  H264_720P26" + "The Core noted for this session that the recorded stream differs from the configured
  profile: VIDEO-01 recorded H264_720P27.67, configured H264_720P30; ...".
- G70c-08 / G70c-02: `CAM-05` (dead port) on VIDEO-02 through operation 79 for 25 s, select only: roster
  card "Camera CAM-02 · Not checked · Not assigned"; selector line "VIDEO-02 · CAM-05 · Generated test
  source · Profile H264_720P30" `NOT_CHECKED`; put back (`CAM-01` / `CAM-02`, read back).
- G75d-04 (rig `unsealable`, `SES-20261011-0045`): dialog "Recording not sealed / Session
  SES-20261011-0045 / This recording could not be sealed. Its files were kept in quarantine on the Core. /
  Cause code: SESSION_KEY_NOT_OF_SESSION / Close" - no percentage, no steps, no "Resumed"
  (`l5_unsealable_end_dialog.png`).
- G94c-02: export of `-0033` through the wizard (`EXP-000040`, Complete 10:46:07): the page behind the
  open wizard lists "EXP-000040 · Package / Finished 11 Oct 2026 10:46:07 / Download export", no reload.
  Nothing was downloaded. (Driven before the invalidation was moved under `deferEffectStart`; after that
  move it rests on the component test.)
- G89c-07, G89c-08: `l4_monitor_1440x900.png`, `l4_dashboard_1440x900.png` read as pictures.

### 4.5 Lane 1 (SIMULATED, started again by L-S, PID 85523)

Read at 10:47 on the wave L code, seven pages (`.cache/gates/wave-l-w/lane1/`): "Synthetic demo values"
only on System (1); 0 x "Not checked", "Generated test source", "OPEN NOTICE", "Last verify run"; still
there: "DEMO-KEY-EVSIGN-01", "Resident in TPM", "Dual-lens" (10 on Devices), "GAIN", "PHANTOM POWER",
"Interviewer", "Lens 1", "Recording Profile", "Encryption Active", "EVIDENCE PACKAGES 12 PASS • 1 FAIL /
EV-20261010-0005: AUDIO-02 hash mismatch / DEMO - precomputed", "OTHER DEVICES 4/5", "192.168.10.21",
"Connected". Its ring read "ATTENTION / 1 ISSUE" (the system's own flag; not looked into).

## 5. Tests and commands (one run each; a second run only after a red)

| Check | Command (repo root) | Result |
|---|---|---|
| Player | `npx vitest run --root apps/core-web src/features/evidence/__tests__/wave-k-w-player.test.tsx` | `Tests 25 passed (25)` (19 + 6 new "G94c-01 (wave L)"; imports `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE`) |
| Wave L file | `... src/test/wave-l-w-real-core.test.tsx` | `Tests 35 passed (35)` (first run 3 red: two assertions of the test, one input shape of the test) |
| Export job | `... src/features/evidence/__tests__/export-job.test.tsx` | `Tests 20 passed (20)` (2 new) |
| Touched folders | `npm test -w apps/core-web -- src/features src/components src/lib src/test` | once: `7 failed | 170 passed (177)`, `11 failed | 2134 passed` - section 5a |
| The 7 files + 2, after the fixes | the nine files by name | `Test Files 9 passed (9) / Tests 166 passed (166)` |
| Typecheck / lint | `npm run typecheck -w apps/core-web`, `npm run lint -w apps/core-web` | clean, no warning |

Red-first: G94c-01 was red IN THE BROWSER before the edit (2.1); the new "stream that stays open" route
cannot pass with the old probe (it waits its whole limit). Every rendered wave L case has a CONTROL on
the simulated lane in the same file.

### 5a. The 11 red cases of the one folder run

All were pins of the behaviour this wave changes, or static lists; each moved by delta with a comment:
`features/devices/__tests__/wave-i-b-source-state.test.tsx` (2: idle REACHABLE -> NOT_CHECKED),
`camera-no-preview.test.tsx` (2: "Online" / "Offline" -> "Not checked" / "Not reachable"),
`registered-devices.test.tsx` (2: unassigned built-ins now have cards), `session-monitor/__tests__/
unsealable-notice.test.tsx` (2: the bracket sentence; a resolved alert of the session still states its
end), `test/wave-k-w-real-core.test.tsx` (1: "1 of 9 · 8" -> "2 of 9 · 7"; and its SIGNATURE pin),
`test/live-shell-admin.test.tsx` (1: the bell is a third `useCoreActions` call site), and ONE defect of
mine found by a static guard: `test/live-strict-mode-starts.test.tsx` (an effect of `features/` started
a query invalidation outside `deferEffectStart`) - fixed in `export-job-status.tsx`.

## 6. Decisions for the controller

- **D-1 (G70c-02 word).** The web says **"Not checked"** for a source at rest. `contract_wave_l.md`
  section 5 says "Client rule unchanged: 'Reachable' at rest"; my task says "word only what the Core
  states", and the Core states only that the row is enabled (a camera on a dead port read "Reachable").
  If the mobile app keeps "Reachable", the two clients differ - one rule should be chosen.
- **D-2 (R-2).** The "READY" chips of the two tracks and the Devices banner "ALL DEVICES READY 7/7" are
  left: they are the engine's track state. Under a strict reading of the one rule they would read "Not
  checked" at rest; that changes the Dashboard strip, three pages of tiles and the banner's count.
- **D-3 (G89c-05).** "Manifest signature" reads **"Active"** when a sealed item of the Core names its
  key (the alternative: a new word "Stated").
- **D-4 (G75d-04).** The alert of a session that was acknowledged and RESOLVED still states that
  session's end in its dialog (the earlier control said "nothing is drawn"): otherwise a dialog left
  open falls back to "Finalizing evidence / 0% complete".
- **D-5 (the console line).** Chrome prints "Failed to load resource: ... 409" WITH the signed path for
  the probe's refused request (the browser's own line; the token lives 60 s; no page record, log or
  markup holds it - asserted). It was the same for the wave K probe.
- **D-6 (state left on lane 2).** I left the UNSEALABLE alert of `SES-20261011-0045` active for L-M and
  the re-check; it was resolved by another session before 10:59 (not by me).
- **D-7 (shared helper jar).** The helper writes ONE jar path per lane and role; L-W and L-M both used
  `session_lane2_SUPERVISOR.jar`. I signed my last session out at 11:00 and removed that jar; noted for
  L-M in the contract file.

## 7. Checks for the test runner, and the re-drive list

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/core-web` (whole workspace, once per commit) | none | 0 failed |
| `npm run typecheck -w apps/core-web && npm run lint -w apps/core-web` | none | clean |
| `npm test -w packages/shared` (holder of the examples imported here) | none | 0 failed |

Re-drive (browser, lane 2, through the web origin): (1) G94c-01 - `EV-20261009-0005`, Open playback,
Play: the alert within about 6 s, the "Stopped" tile, both still there at the end; then
`EV-20261008-0001` clean. (2) G75d-02 - rig `blocked`, a 45 s session, wait 155 s, `release`, "Retry
sealing". (3) G75d-01 - rig `unsealable`: pill "OPEN NOTICE", ring, bell "Acknowledge and close" as the
supervisor; as another role the sentence. (4) the pages of section 3 on lane 2 and their lane 1
controls. (5) G94c-02 - one export, the list without a reload (re-drive after the `deferEffectStart`
move). (6) NOT driven by me: the "PACKAGE NOT READABLE" suffix; a recording with `CAM-04` on a track; the
integrity card's cue on a taller window.

## 8. Files

NEW: `components/synthetic-values-chip.tsx`, `features/devices/own-core-words.ts`,
`features/evidence/sealed-format.tsx`, `features/security-audit/core-verify-rows.ts`,
`features/session-monitor/seal-retry.tsx`, `features/session-monitor/unsealable-cause.ts`,
`test/wave-l-w-real-core.test.tsx`.
CHANGED (production): `components/shell/{notifications-bell.tsx,secure-pill.tsx,shell.css}`;
`features/dashboard/{dashboard.css,security-panel.tsx,sim-adapter.ts,status-strip.tsx,system-ring-panel.tsx}`;
`features/devices/{audio-input-card,camera-preview,camera-tile,capture-selector-panel,device-drawer,index,panel,port-map,registered-device-drawer,registered-devices,summary-cards}.tsx`,
`{model,registered-devices-model,source-state}.ts`;
`features/evidence/{detail-page.tsx,export-job-status.tsx,item-facts.ts,media-session.ts,sealed-player.tsx}`;
`features/network-time/{panel,status-banner}.tsx`; `features/security-audit/{controls-panel.tsx,model.ts,tamper-panel.tsx}`;
`features/session-monitor/{audio-panel,details-panel,finalization-modal,integrity-panel,panel,seal-attention,status-banner,unsealable-notice}.tsx`,
`{model,sim-adapter}.ts`, `session-monitor.css`; `features/storage/panel.tsx`;
`features/system/{panel,status-banner}.tsx`; `i18n-web.ts` (new keys `web.dashboard`, `web.waveL`,
`web.realCore.dashboard.notReportedChip`).
CHANGED (tests, by delta): the nine files of section 5 / 5a.
Docs: this note; `delegation_progress/file_claims.md` (one line); `contract_wave_l.md` (announcement
lines only). Plan table, `status_tasks.md`, `99_implementation_report.md`: not written (driver rules).

## 9. State left (11:02)

| Item | State |
|---|---|
| Lane 2 | RUNNING PID 86337, **restarted ONCE by me** (10:38:23 stop, 10:38:26 ready; no reset), on the wave L tree. In L-M's hands since 10:57 |
| My sessions | `SES-20261011-0044` -> `EV-20261011-0033` (blocked, then sealed by the web retry; exported once, `EXP-000040`); `SES-20261011-0045` UNSEALABLE (quarantined; `EV-20261011-0034` does not exist); `SES-20261011-0046` -> `EV-20261011-0035` (clean, verify PASS 15 of 15). None open |
| Session open at 10:59 | `SES-20261011-0047` FINALIZING - **L-M's** (rig `BLOCKED`, announced by L-M 10:57); not touched |
| Seal rig | OFF after each of my two uses (read); at 10:59 `BLOCKED` by L-M |
| Selector | `CAM-01` / `CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY (read 10:59; `locked true` while L-M's session is open) |
| Alerts | 35, none active at 10:59. `ALR-000049` resolved by my acknowledgement (seq 781) |
| Quarantine | two folders: `SES-20261011-0041` (found), `SES-20261011-0045` (mine) - a later reset of lane 2 needs the FAKE-only option |
| Audit chain | `ok`, 833 rows at 10:59 |
| Lane 1 | RUNNING PID 85523 (L-S); one helper sign-in / sign-out of mine, pages read only |
| Browser, helper | Chrome stopped, its profile removed, the observer stopped; my helper sessions signed out (204, then 401), my jar removed |
| Scratch | only `.cache/gates/wave-l-w/` (pictures, texts, logs with tokens blanked, tools; `start_2.log` 0600) |

---
*Generated: 2026-10-11 11:02 WIB*
