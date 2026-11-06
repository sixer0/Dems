---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 89 - M7 milestone gate (evidence package v2), FINAL RE-CHECK after fix wave L
date: 2026-10-11
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`, decisions D229, D231, D234)
tree: 7b1aded (`git status --porcelain -- apps packages scripts`: empty at the end)
narrative_tier: 2
status: needs-review
verdict: PASS WITH CONDITIONS (the three must-fix items of D229 are closed; no BLOCKER, no MAJOR, no MINOR open by my rating; six NOTES; conditions = what is still tests-only or not driven by me, section 1)
supersedes: nothing - `12_m7_gate.md`, `12b_m7_regate.md`, `12c_m7_recheck.md` stay the records
---

# 12d - M7, final re-check (row 89)

Run window 13:56-14:14 WIB on the standing environment of note 09 (lane 1 PID 13944 SIMULATED, lane 2
PID 13991 REAL_DEVELOPMENT, both devices on lane 2). The seven items of the task, one run each. No
product or test file changed, no git write, no install, no lane restart, no reset; seal rig read only
(`OFF` at 13:56 and 14:14). No local device (`CAM-03` / `MIC-03`) selected, pre-checked or started; no
attendance variable; fingerprint sensor never touched, the biometric offer answered "Not now" once on
the tablet and once on the phone (skipped by the user's instruction, never passed); no lock set,
changed or removed. Nothing was played ("Play" / "Open playback" not pressed), nothing exported.
No `.data/pg*.env`, no pwfile, no key file, no fixture file opened. Of lane 2's packages I read, in
place: five manifests, two audit extracts, file names / sizes / modes. No media bytes were read.

Surfaces: **W2** = web console lane 2 (5177, headless Chromium over CDP at 1440 x 900, helper
session cookie), **W1** = the same on lane 1 (5176, a second browser profile), **T** = tablet
`emulator-5556` = `DEV-0001`, **P** = phone `emulator-5554` = `DEV-0002`, **API** = lane 2's Core,
**FILE** = package files read in place.

## 1. Verdict for M7

**PASS WITH CONDITIONS.** From 12 / 12b / 12c plus this run:

- D229's three must-fix items are **closed**, each driven in the browser: G89c-03 (the Monitor's
  integrity card of a sealed real session shows only the Core's rows), G89c-01 (Dashboard: the
  manifest hash of the item with no suffix), G89c-02 (the tamper tile is built from this Core's
  verify rows and names `VIDEO-02` fragment 3). Lane 1 keeps the demonstration on both.
- G89c-04, -05, -07, -08 are closed. G75e-08 is judged a NOTE: no sealed fact is wrong (section 4.4).
- Nothing I met is rated above NOTE.

| # | Condition | Owner |
|---|---|---|
| F-1 | G89c-03 was driven by me on the state reachable without a restart (a session sealed minutes before, capture member present). The state 12c met - a sealed session read back after a Core restart, capture member absent - was NOT driven by me (lane 2 must not be restarted); it rests on the driver's browser run (note 154 section 4.4) and on the test I ran once (`wave-l-w-real-core.test.tsx -t G89c`: 10 passed) | controller: accept, or have it read once after the next planned lane 2 start |
| F-2 | Still tests only, as 12b C-8 / 12c K-6: one-camera seal, truncated tail, kept-plaintext alert, boot sweep acting, every REAL_PRODUCTION refusal, unreachable-PARTIAL package, server-backend model line | row 95 / user |
| F-3 | The whole suites on `7b1aded` were not run by me; I rely on nothing but name the controller's record (`test/11_precommit_wave_l.md`, D231) as the place where that is stated | row 95 / test runner |
| F-4 | NOTES G89d-01 .. -06 (section 5): none blocks; G89d-01 asks for one sentence in the spec when a time service is added | controller (next task) |

## 2. Start state (13:56)

| Check | Result |
|---|---|
| `lane.sh status` | lane 1 RUNNING PID 13944, lane 2 RUNNING PID 13991; seal rig `OFF` |
| `GET health` lane 2 | `ok`, `ready {database true, engine true}`, `ws.clients 2` |
| Devices | both attached, `isKeyguardShowing=false`, Login, both sign-in fields showing only their hint, "Core online", "paired as DEV-0001" / "DEV-0002"; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both |
| Lane 2 | `session/current` null; selector `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; 39 items; 46 alerts, none active; audit chain `ok`, 963 rows |

## 3. Items table

| Item | Surface | Result |
|---|---|---|
| 1 ONE session from the web, sealed | W2 | **done**: `SES-20261011-0057` -> `EV-20261011-0043`, 48.0 s (not 45), sealed 8.6 s after the end |
| 1 G89c-03: integrity card of the sealed real session = the Core's facts, no simulator rows; screenshot | W2 | **PASS** (state: capture member present); after-restart state: F-1 |
| 1 the same card on lane 1 keeps its demo rows | W1 | **PASS** |
| 2 G89c-01: Dashboard, no "NO MEDIA PACKAGE"; the hash shown = the manifest's own | W2, API, FILE | **PASS** |
| 2 G89c-02: tamper tile free of the bundled index; agrees with op 41 on `EV-20261009-0005` | W2, API | **PASS** |
| 2 G89c-02: against the lane's item count | W2, API | **PASS** as worded ("last verify run per item": 28 items have a row, the lane holds 40); G89d-02 NOTE |
| 2 lane 1 keeps the demonstration panel | W1 | **PASS** |
| 3 G89c-04: per-track profile on the item page = op 40 `files[].profile` = manifest | W2, T, P, API, FILE | **PASS** (three surfaces, two items) |
| 3 G89c-04: `EV-20261011-0025` fractional label AND its notice | W2, T, P | **PASS**: label and notice present on all three (the alert is within the newest 100: the lane holds 47) |
| 3 G89c-05: "Manifest signature" status agrees with its sentence | W2 | **PASS** ("Active"; "2 of 9 active · 7 not reported") |
| 3 G89c-07: scroll cue on the Monitor integrity card | W2 | **PASS** (recording and sealed) |
| 3 G89c-08: Dashboard at 1440 x 900 | W2 | **PASS** (screenshot) |
| 4 G75e-08: `timeSource: "RTC"` on a host-clock Core | API, FILE, W2, T, docs | **no sealed fact is wrong; NOTE** (G89d-01) |
| 5 op 41 PASS n of n from web, tablet, phone; rows `null` / `DEV-0001` / `DEV-0002` + `operationId` | W2, T, P, API | **PASS**, 15 of 15 three times |
| 5 manifest states `H264_720P30` | FILE | **PASS** (both tracks) |
| 5 audit extract: only that session's rows; sending device where a device sent them | FILE | **PASS** (4 rows, web-sent, `deviceId null`; device case read on `SES-20261011-0051`: `DEV-0001`) |
| 5 no plaintext recording left; modes 0700 / 0600 | FILE | **PASS** |
| 6 op 41 on a blocked-then-sealed item; manifest claims about attempts / resumed | API, FILE | **PASS** (`EV-20261011-0038` 15 of 15; `attempt 5` is true; no `resumed` member) |
| 6 quarantined-session folders | FILE | three now (`-0041`, `-0045`, `-0052`), each 0700, names and modes only |
| 7 logcat over items 3 and 5 | T, P | **PASS**: 0 `ReactNativeJS` lines above level I, 0 FATAL / ANR, 0 error-level lines of the app during the item flows; mount warnings counted: 167 (T), 213 (P); G89d-04 NOTE |

## 4. Evidence per item

### 4.1 Item 1 - the session and G89c-03

Session made in the web UI as the supervisor: New Session -> "Fill in the next case number"
(`LP/2026/1011-9610`), Saksi, subject "Gate 89d Final Recheck" -> Next -> device check (PASS, TIME
row a note) -> Next -> "Start Recording" (13:57:43; countdown; `RECORDING` `startedAt` 13:57:46.915,
`captureDurable true`) -> Monitor "End Session" with the reason "Gate 89d final recheck ended"
(`POST session/SES-20261011-0057/stop` 202; `stoppedAt` 13:58:34.868) -> `SEALED` 13:58:43.423.
Recording 47,953 ms. Seal dialog (`w2_02`): "Evidence sealed / ... / Sealed 8.6 s after the recording
ended / Manifest SHA-256 / Signature Ed25519, Core key CORE-KEY-EVSIGN-01 / Signed with a DEVELOPMENT
key — not a production signature / Recorded from development sources - not from production devices."

Monitor card EVIDENCE INTEGRITY, read from the DOM at 13:58:54 after "Close" and again after a full
page reload at 13:59 (`w2_03`), `data-capture-facts="true"`:

> Capture - The recording has ended - Standby | Media Protection - Encrypted at seal - Passing |
> Audit Log Hash Chain - SHA-256 - Passing | Time Source - Core system clock (UTC+07:00) - Standby |
> Durable Fragments - 38 fragments saved · 47 MB / Camera 1 (CAM-01) · 19 fragments saved · 24 MB /
> Camera 2 (CAM-02) · 19 fragments saved · 23 MB | CHAIN HEAD (12 hex) | Re-verify | More below - scroll

Word search on the page's `main`: "Encryption Active", "Secure Timestamp", "Storage Write Verified",
"AES-256", "RTC", "Hash Chain Active", "DEMO", "imulated": **0 hits each**. The rows agree with the
package: 19 + 19 fragments (manifest), 24,124,902 + 23,373,557 bytes, stored hash differs from the
plain hash per file (encrypted).

The code has two branches for such a Core (`apps/core-web/src/features/session-monitor/
integrity-panel.tsx:111`, `:200-202`): the capture member present (what I drove) and absent
(`ownCoreChecks`: "Evidence EV-... is sealed. Verify it on its Evidence page."). The second is the
state 12c found broken; it needs a Core restart after the seal and was not driven by me (F-1).
Test run once on the unchanged tree: `npx vitest run --root apps/core-web
src/test/wave-l-w-real-core.test.tsx -t "G89c"` -> `Tests 10 passed | 25 skipped (35)`.

Lane 1 (W1, no session open, `w1_01`): "Encryption Active - AES-256 - Passing | Hash Chain Active -
SHA-256 - Passing | Secure Timestamp Synced - GNSS (UTC+07:00) - Passing | Storage Write Verified -
Standby" - the demonstration rows, kept.

### 4.2 Item 2 - G89c-01, G89c-02

**Dashboard, lane 2** (14:00:16, `w2_05`), card ACTIVE SESSION: "Sealed / Evidence sealed /
Evidence ID EV-20261011-0043 / Sealed at 11 Oct 2026 13:58:43 UTC+07:00 / **Manifest hash** /
`eaa6eb47…34d6` / View evidence / Start New Session". "NO MEDIA PACKAGE", "PACKAGE NOT READABLE",
"DEMO", "imulated": 0 hits on the page. The same value three ways:

| Source | Manifest hash |
|---|---|
| Dashboard `sealed-manifest` (shows first 16 + last 8) | `eaa6eb47…34d6` |
| op 40 `evidence.manifestHash` (`integritySource REAL`, `sealedPackage PRESENT`, `manifestVersion 2`) | `eaa6eb47…34d6` |
| package `session-manifest.json` member `manifestSha256` | `eaa6eb47…34d6` |
| my own SHA-256 of the canonical body (sorted keys, compact, `manifestSha256` null, `signature.value` out - the rule the manifest states in `signature.covers`) | equal |
| audit seq 968 `EVIDENCE_SEALED` `details.manifestHash` | equal |

**Security & Audit, lane 2** (14:00:51 / 14:01:14, `w2_06`, `w2_07`), panel TAMPER & INTEGRITY:
"ENCLOSURE Not reported | AUDIT CHAIN Intact | **LAST VERIFY RUN PER ITEM / 27 PASS • 1 FAIL** /
**EV-20261009-0005: VIDEO-02 fragment 3 failed verification** / From the verify rows of this Core in
the audit view", then the Core's own "Evidence verification failed" rows (`AUD-000880`, `-000685`,
...). "12 PASS", "AUDIO-02", "DEMO", "precomputed": 0 hits.

- Against op 41: "Verify again" pressed on `EV-20261009-0005` in the web UI at 14:02:10 -> 200, "FAIL /
  VIDEO-02 file FAIL / Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL / Where it
  failed: VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3) /
  11 of 15 checks passed"; audit seq 970 `EVIDENCE_VERIFY_FAILED`, `failedFragments VIDEO-02:3`.
  The tile agrees.
- Against the audit list (all 968 rows walked at 14:00): 28 items have a verify row; the newest row
  per item is PASS for 27 and FAIL for 1 (`EV-20261009-0005`, seq 880). The tile agrees.
- Against the item count: the lane holds 40 items (27 `integritySource REAL`, 13 seed
  demonstration items). The tile counts verify runs, says so in its label and chip, and claims no
  total - see G89d-02.

**Lane 1** (`w1_02`): "EVIDENCE PACKAGES / 12 PASS • 1 FAIL / EV-20261010-0005: AUDIO-02 hash
mismatch / DEMO - precomputed / No tamper events recorded"; "Manifest signature - Ed25519, DEMO
device key - Active". Kept.

### 4.3 Item 3 - G89c-04, -05, -07, -08

**G89c-04.**

| Item | manifest `tracks[].profile` (FILE) | op 40 `files[].profile` | W2 | T | P |
|---|---|---|---|---|---|
| `EV-20261011-0043` | `H264_720P30` x2 | `H264_720P30` x2; no `streamProfileNotice` | "SEALED FORMAT (SIGNED MANIFEST) / VIDEO-01 H264_720P30 / VIDEO-02 H264_720P30" (`w2_08`) | "Sealed format (signed manifest) / Camera 1: H264_720P30 / Camera 2: H264_720P30" (`t_01`) | the same (`p_01`) |
| `EV-20261011-0025` | `H264_720P27.67` / `H264_720P26` | the same; `streamProfileNotice.tracks` = both, each `configured H264_720P30` | the two labels + "The Core noted for this session that the recorded stream differs from the configured profile: VIDEO-01 recorded H264_720P27.67, configured H264_720P30; VIDEO-02 recorded H264_720P26, configured H264_720P30." (`w2_10`) | the two labels + "The recorded stream was not the configured profile / Camera 1: recorded H264_720P27.67, configured H264_720P30 / Camera 2: recorded H264_720P26, configured H264_720P30" (`t_03`) | the same (`p_03`) |
| `EV-20261009-0005` | - | `H264_720P30` x2 | the same two labels | - | - |

The notice of `-0025` is present: its alert `ALR-000033` is in the list (47 alerts, the reader takes
the newest 100). No page says "no notice"; an item without the member draws nothing. `profileId` is
still `STANDARD_1080P25` on op 40 for all three (D224 (5): next task) and is drawn on no item page
("1080", "fps", "STANDARD_1080P25": 0 hits on W2's page of `-0043`). The web New Session form still
offers "Recording Profile / Standard (1080p / 25 fps)" (remainder R-1 of note 154, ruled out of this
task in D231).

**G89c-05** (W2 Security & Audit, CONTROLS): "Manifest signature | Ed25519, Core key
CORE-KEY-EVSIGN-01 - the key the sealed items of this Core are signed with. The Core says this is a
DEVELOPMENT key - not a production signature. | **Active**"; header "2 of 9 active · 7 not reported".
Status and sentence agree. Beside it: "Evidence encryption | This Core reports no encryption status
here. Each sealed item states how it is encrypted. | Not reported" - consistent with itself.

**G89c-07** (W2 Monitor at 1440 x 900): while recording (13:58:02, `w2_01`) the card body is 124 px
high with 245 px of content and a visible strip "More below - scroll" (`.sm-scroll-cue`, 271 x 16 px
at the card's foot); after the seal (`w2_03`) 104 px / 245 px, the strip still there.

**G89c-08** (`w2_05`): status strip - "Time / Host system clock" wraps to two lines inside its own
cell (x 1049, w 68) and ends before the Security icon; the four DEVICES & INPUTS tiles are whole
(badge on one line, "No preview / Camera 1 · CAM-01 · ... / Not checked" inside the frame, "Primary" /
"Standby" chips whole, "NO SIGNAL" inside). No collision, no clipped tile. Ellipses remain on long
captions ("Sealed Eviden...", "This Core reports no ...").

### 4.4 Item 4 - G75e-08, the time source

What each member says for `SES-20261011-0057` / `EV-20261011-0043`:

| Member | Where | Says | Signed? |
|---|---|---|---|
| manifest `timeline.timeSource` | `session-manifest.json` | `source "RTC"`, `state "HOST_SYSTEM_CLOCK"`, `fallbackOrder []` | yes (in the signed body) |
| audit row seq 966 `RECORDING_STARTED` `details.timeSource` | `audit-session-extract.jsonl` (inside the package) and `GET audit` | `"RTC"` | **no** - the extract is covered by no hash and no signature; every verify result says so (`AUDIT_EXTRACT_NOT_SIGNED`) |
| pre-check TIME item | `session/current` at 13:57:27 | `status WARN`, `value "HOST_SYSTEM_CLOCK"`, "Time source: host system clock (no GNSS)"; outcome PASS; drawn as "NOTE" on W2 | not in the package |
| op 40 `startTimeSource` / `endTimeSource` | API | `RTC` / `RTC` | - |
| words on the clients | W2 Monitor "Time Source - Core system clock (UTC+07:00)"; W2 Security "Host system clock. No time service is configured: nothing is locked and nothing is in holdover."; T Summary "Time source Host system clock" (start and end); W2 item page: no time-source text | - |

The four blocked-then-sealed manifests and `SES-20261011-0036` state the same three values.

What `RTC` means there:
- `masterplan/06_evidence_package_spec.md:49` (errata index PE-WI-26): "The time source of a sealed
  package is the Core's host clock: `RTC`, `HOST_SYSTEM_CLOCK`, an empty order; no network-time
  module exists".
- `:260-262` (fields 17-19) and the erratum text `:271-277`: the three fields are a constant of the
  sealing host (`apps/core-server/src/sealing-host/session-reader.ts:105` `CORE_TIME_SOURCE` - read:
  it is that line); the enumeration `GNSS | NTP | RTC` is not widened; "`RTC` is the one value that
  claims no external reference, and `state` says in words which clock it is"; "A package is read as:
  `RTC` + `HOST_SYSTEM_CLOCK` = the Core's own host system clock, no GNSS, no network time, nothing
  locked or measured".
- `masterplan/03_api_contract.md:1267-1271` (PE-WH-05 (2)): on a Core in its own capture "the time is
  the host system clock and there is no time service; `source` is then `RTC` ... never GNSS ...
  `RECORDING_STARTED.timeSource` follows the slice"; `:1272-1275` (3): the TIME item is a note with
  the value `HOST_SYSTEM_CLOCK`.
- Code: the audit row takes `state.time.source` (`packages/shared/src/sim/session-machine.ts:813`).

**Judgement: no sealed fact is wrong.** The signed manifest says `RTC` together with
`HOST_SYSTEM_CLOCK`, which is the documented reading; the audit row's `RTC` is the documented value
of the time slice on such a Core and claims no external reference; no member says GNSS, NTP, locked
or synced; every screen I read words it as the host / Core system clock. **NOTE (G89d-01)**, for one
remaining weakness: the audit row carries the bare enum without the `state` text, so the extract read
alone says "RTC" for what is a host operating-system clock; the meaning is in the spec, not in the row.

### 4.5 Item 5 - spot-check on `EV-20261011-0043`

| Check | Result |
|---|---|
| op 41 from W2 ("Verify", 14:01:31, `w2_09`) | 200; "PASS", both files "Stored bytes PASS · decrypted bytes PASS · fragment chain PASS / 19 fragments", "Checks of this run · 15 of 15 checks passed", V-01..V-15 PASS, "Audit extract: present, NOT covered by the package signature."; audit seq **969** `EVIDENCE_VERIFIED`, `deviceId null`, `operationId verifyEvidence` |
| op 41 from T (14:04:59, `t_02`) | "Verified by the Core / PASS: every hash matches the sealed manifest", "15 of 15 checks passed"; seq **974**, `deviceId DEV-0001`, `operationId verifyEvidence` |
| op 41 from P (14:07:20, `p_02`) | the same, "15 of 15 checks passed"; seq **977**, `deviceId DEV-0002`, `operationId verifyEvidence` |
| op 41 through the API (helper) | `overall PASS`, 15 of 15, `manifestOk` / `signatureOk` true, notices `[AUDIT_EXTRACT_NOT_SIGNED]`, `interrupted false`; seq 971, `deviceId null` |
| manifest | `schema dems.evidence-manifest/2`, `integrity REAL`, `demo false`, `developmentSources true`; `tracks[].profile` `H264_720P30` twice (`CAM-01`, `CAM-02`, `sourceClass FAKE`, model "Generated test source (no camera)"); `signature.keyId CORE-KEY-EVSIGN-01`, `simulated false`; device identity `NOT_CONFIGURED`; transcript `ASSEMBLED`, `revisionHead 0`; `sealing.steps` three entries `attempt 1` |
| audit extract | 4 rows, seq 964-967: `SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED`, `RECORDING_STOPPED` - all `sessionId SES-20261011-0057`, actor `OPR-002`, `deviceId null` (sent from the web console: no device), hash-linked to seq 963. Device case, read on the extract of `SES-20261011-0051` (tablet-started): `RECORDING_STARTED` seq 911 carries `deviceId DEV-0001` |
| no plaintext left | package folder: `session-manifest.json`, `signature.sig`, `device-certificate.pem`, `audit-session-extract.jsonl`, `fragments/{VIDEO-01.mp4, VIDEO-02.mp4, fragments.json}`, `transcript/{transcript.json, .srt, .vtt, transcript-revisions.json}` - nothing else. Per file the stored hash differs from the plain hash (manifest) and V-05 "plaintext hash after decryption" passed. The capture run folder `.data/run/capture/SES-20261011-0057` is empty. No other file under the media root names the session. No `capture-worker` / `ffmpeg` / `whisper` process |
| modes | every directory `0700` (package, `fragments`, `transcript`, `sessions`, `.quarantine` and its three folders), every file `0600` (11 files); the two session-key files `0600` (names and sizes only) |

### 4.6 Item 6 - blocked-then-sealed items and the quarantine

Op 41 on `EV-20261011-0038` (`SES-20261011-0051`, blocked by the rig at re-check 75, sealed by
"Retry sealing"): `overall PASS`, 15 of 15, `manifestOk` / `signatureOk` true, `interrupted false`.

What the four manifests say about the attempts (read in place):

| Item / session | `timeline` | `sealing.steps` | Other |
|---|---|---|---|
| `-0038` / `-0051` | `interrupted false`; `sealedAt` = `signature.signedAt`, 247.8 s after `stoppedAt` | `CLOSE_TRACKS`, `FINALIZE_HASHES`, `FINALIZE_TRANSCRIPT`: `DONE`, **`attempt 5`**, completed 247.6-247.8 s after the stop | no member named `resumed`, `retry` or `blocked` anywhere |
| `-0029` / `-0040` | 275.8 s | the same, `attempt 5` | the same |
| `-0033` / `-0044` | 202.9 s | the same, `attempt 5` | the same |
| `-0036` / `-0047` | 591.7 s | the same, `attempt 5` | the same |

`attempt 5` is true: four runs failed while the rig held the session (t+0, +5 s, +35 s, +155 s; 10e
section on G75d-02), the fifth - the retry - sealed it; the audit list has `RECOVERY_STARTED
{reason SEAL_RETRY, cause SEALER_FAILED, step CLOSE_TRACKS}` (seq 913) 0.4 s before `EVIDENCE_SEALED`
(914), and the package's extract holds that row. The spec defines the member as the journal's attempt
count (`06_evidence_package_spec.md:590`, `:597`). The manifests say nothing false about the blocked
attempts: they give the count and the instants and make no statement about a restart.

Quarantine: `.quarantine/SES-20261011-0041`, `-0045`, `-0052` (the third made by re-check 75), each
`0700`; nothing opened. The ids `EV-20261011-0030`, `-0034`, `-0039` do not exist in the list.

### 4.7 Item 7 - logcat

Writers started at 14:02:47 (T) / 14:02:51 (P) after `logcat -c`, stopped at 14:08:58 / 14:09:00;
they cover the sign-in, items 3 and 5 and the sign-out on each device.

| | Tablet (pid 20030) | Phone (pid 28404) |
|---|---|---|
| Lines | 46,817 | 49,580 |
| Item flows | 14:03:45-14:05:40: two item openings, one Verify press, one export sheet opened by a mis-tap and closed | 14:06:55-14:08:30: two item openings, one Verify press |
| `ReactNativeJS` lines | 25, all level I | 23, all level I |
| `FATAL EXCEPTION` / `ANR in` | 0 | 0 |
| Level E / F lines of the app's process **during the item flows** | **0** | **0** |
| Level E lines of the app's process outside them | 29: 14:03:06 (1), 14:03:30 (16, the screen change after the sign-in), 14:03:41 (1), 14:06:13-14 (11, the sign-out) | 17: 14:06:29 (5, sign-in), 14:06:51 (1), 14:08:41 (11, sign-out) |
| Their tags | `EGL_emulation` 10, `Surface` 4, SurfaceTexture "EGLConsumer is not attached to an OpenGL ES context" 15 | `EGL_emulation` 6, `Surface` 2, SurfaceTexture 9 |
| "Unable to find SurfaceMountingManager" | **167** | **213** |

Zero app error lines in the item flows: PASS. The 46 lines at sign-in / sign-out are the emulator's
graphics layer inside the app's process (no JS line, no crash); 12c cleared its logcat after the
sign-in and so did not count that moment (G89d-04, NOTE). Mount warnings: counted only (D224 (2)).
Files: `logcat_T.txt`, `logcat_P.txt`.

## 5. Findings of this re-check

| ID | Severity | What | Evidence | Spec / ruling |
|---|---|---|---|---|
| **G89d-01** | NOTE (the judgement asked for G75e-08) | `RECORDING_STARTED.details.timeSource` is the bare enum `RTC` on a host-clock Core - in the audit list and in the package's unsigned audit extract; op 40 `startTimeSource` / `endTimeSource` `RTC` too. The signed manifest pairs it with `state HOST_SYSTEM_CLOCK`. No member claims an external or locked source | 4.4 | documented: `06_evidence_package_spec.md:49`, `:260-262`, `:271-277`; `03_api_contract.md:1267-1275`. The spec itself says the three definitions must be read again when a time service exists |
| G89d-02 | NOTE | W2 tamper tile "27 PASS • 1 FAIL": true for the 28 items that have a verify row; 12 of the lane's 40 items were never verified and the tile does not say how many items have no run | 4.2 | G89c-02 is closed (label and chip state the source); a reader may still take 28 for the item count |
| G89d-03 | NOTE | T item page, first position: the tab strip (y 1443) lies under the fixed Play / Export / More bar (y 1464); a tap at the reported centre of "Hash & Integrity" opened the EXPORT sheet (closed with its X; nothing sent). The tab is reachable after one scroll. Same list: the duration at the row's right edge is cut to "00:00" with the row's menu dots drawn over it | 4.5; `t_01`, `t_02` | 12c section 11 item 3 named the tap zone, not the overlap |
| G89d-04 | NOTE | 29 (T) / 17 (P) error-level lines of the app's process at sign-in and sign-out, all from the emulator's graphics stack; none during an item flow, none from the JS runtime | 4.7 | D224 (1): "zero app ERROR lines" was counted over item flows at 12c; this is the first count that includes the sign-in |
| G89d-05 | NOTE | W2 Monitor of a sealed session at 1440 x 900 (`w2_03`): "No preview / Camera 1 ..." shows faintly through the "Session sealed" card; in AUDIO MONITOR "NO SIGNAL" runs over "Audio source"; in CAMERA & INPUT STATUS the "MIC 1" / "MIC 2" labels sit on the lower border of the camera tiles | `w2_03` | the audio panel part is G70d-06 (known, wave M if one-line); the other two are new |
| G89d-06 | NOTE | The same card after the seal still ends "Fragment hashes and the signature are stated on the evidence item once the session is sealed." (future tense on a sealed session) | 4.1 | - |

Known findings met again, not re-reported: G75e-02 (web device check: "MIC 1 - Interviewer" /
"MIC 2 - Subject"), R-1 / D224 (5) (`profileId`, New Session "Standard (1080p / 25 fps)"), R-2
("READY" chips beside "Not checked"), G89-14 (phone: "this tablet shows it as it is", `p_02`), the
mount warnings.

## 6. State of 12c's findings and conditions

| Item | State |
|---|---|
| G89c-01 (must-fix, D229 (2)) | **closed** (4.2) |
| G89c-02 (must-fix, D229 (2)) | **closed** (4.2); G89d-02 NOTE |
| G89c-03 (must-fix, D229 (1)) | **closed** on the driven state (4.1); after-restart state: F-1 |
| G89c-04 | **closed** on web, tablet, phone, incl. the notice block on both devices (note 155 had it by test only) |
| G89c-05, -07, -08 | **closed** (4.3) |
| G89c-06 | not looked at (the seal dialog was read once, 2 s after the seal: the development-key line was there) |
| K-5 | controller's record (D231); F-3 |
| K-6 | unchanged: tests only (F-2) |
| G75e-08 (handed over by D234 (5)) | judged: NOTE, G89d-01 |

## 7. Skipped / user-attended

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); offer answered "Not now" on T and on P; never passed |
| Local devices, attendance variables | never selected or set |
| Playback, export, download | not pressed (the tablet's export sheet opened by a mis-tap was closed at its first step) |
| Seal rig, lane restart, reset, camera search, stub, `CAM-04` / `CAM-05` | not touched; rig `status` read twice: `OFF` |
| Server STT backend, port 8000 | not touched |

## 8. What stays NOT PROVEN

1. G89c-03 on a sealed session read back after a Core restart, by my own eyes (F-1).
2. Everything of F-2 (tests only).
3. The whole suites on `7b1aded` (F-3); I ran one filtered test file (10 cases).
4. The "PACKAGE NOT READABLE" suffix of the Dashboard (no such item exists on the lane).
5. A `streamProfileNotice` that has left the newest 100 alerts (the lane has 47): the page then
   draws the label and no notice - by reading the code and note 153 decision 5 only.
6. G89c-06 timing (one sample).
7. `masterplan/02_plan.md` and `implementation/99_implementation_report.md`: the task asked for this
   one file and nothing else under `docs/`.

Lapses of mine: (a) the recording ran 48.0 s, not 45; (b) the mis-tap of G89d-03; (c) one op 41 on
`-0043` more than asked (the API helper, seq 971); (d) I typed a wrong route (`/security`) once and
read "Page not found" before using `/security-audit`; (e) three reads printed PUBLIC values in full
into my own tool output (two manifest hashes in audit rows, file names under `.data/postgres`); no key
material; none is in this report or in a file name; (f) leaving the tablet's Summary wrote
`SUMMARY_ACKNOWLEDGED` (seq 973, `DEV-0001`).

## 9. Screenshots (`.cache/gates/89d/`, each read as a picture)

| File | Shows |
|---|---|
| `w2_01_monitor_recording.png` | W2 Monitor at REC 00:00:15: banner "SESSION ACTIVE", integrity card with four Core rows and the strip "More below - scroll", "Configured profile VIDEO-01: H264_720P…" |
| `w2_02_seal_dialog.png` | W2 dialog "Evidence sealed", six steps done, `EV-20261011-0043`, Core key line, development-key and development-sources lines |
| `w2_03_monitor_sealed_integrity.png` | W2 Monitor after the seal: banner "SESSION SEALED", card rows "Capture - The recording has ended / Media Protection - Encrypted at seal / Audit Log Hash Chain - SHA-256 / Time Source - Core system clock", scroll strip; the overlaps of G89d-05 |
| `w2_05_dashboard_1440x900.png` | lane 2 Dashboard: ring "SYSTEM READY", "Evidence sealed / EV-20261011-0043 / Manifest hash" with the shortened hash and no suffix, whole device tiles, "Host system clock" in its own cell |
| `w2_06_security_audit.png` | lane 2 Security & Audit top: posture "Not reported", "2 of 9 active · 7 not reported", "Manifest signature" with a green tick, "DEVELOPMENT KEY" |
| `w2_07_tamper_panel.png` | lane 2 TAMPER & INTEGRITY: "LAST VERIFY RUN PER ITEM 27 PASS • 1 FAIL", "EV-20261009-0005: VIDEO-02 fragment 3 failed verification", "From the verify rows of this Core in the audit view", four failed-verify rows |
| `w2_08_item_0043_sealed_format.png` | W2 item `-0043`: block "SEALED FORMAT (SIGNED MANIFEST) VIDEO-01 H264_720P30 VIDEO-02 H264_720P30" |
| `w2_09_item_0043_verify.png` | W2 Hash & Integrity of `-0043` after Verify: "PASS / Verdict of the Core server", development blocks, both files PASS 19 fragments |
| `w2_10_item_0025_format_notice.png` | W2 item `-0025`: "H264_720P27.67" / "H264_720P26" and the amber notice sentence |
| `w1_01_monitor_lane1.png` | lane 1 Monitor, no session: "Encryption Active AES-256 / Hash Chain Active / Secure Timestamp Synced GNSS / Storage Write Verified" |
| `w1_02_tamper_panel_lane1.png` | lane 1 TAMPER & INTEGRITY: "EVIDENCE PACKAGES 12 PASS • 1 FAIL", "EV-20261010-0005: AUDIO-02 hash mismatch", "DEMO - precomputed" |
| `t_01_item_0043_detail.png` | tablet `-0043`: facts, "Sealed format (signed manifest) / Camera 1: H264_720P30 / Camera 2: H264_720P30", action bar over the next block |
| `t_02_item_0043_verify.png` | tablet `-0043` Hash & Integrity: "Verified by the Core", "PASS: every hash matches the sealed manifest", development-sources block |
| `t_03_item_0025_detail.png` | tablet `-0025`: the fractional labels and the amber "The recorded stream was not the configured profile" lines |
| `p_01_item_0043_detail.png` | phone `-0043`: facts and "Sealed format (signed manifest) / Camera 1: H264_720P30 / Camera 2: H264_720P30" |
| `p_02_item_0043_verify.png` | phone `-0043`: "Verified by the Core", PASS, development-sources block |
| `p_03_item_0025_detail.png` | phone `-0025`: the fractional labels and the amber notice lines |

Other files there: `op40_0043.json`, `op40_0025.json`, `op40_0005.json`, `op41_0043.json`,
`op41_0038.json`, `audit_l2.json`, the two logcat files, `chrome_w1.log`, `chrome_w2.log`, my scratch
scripts (copies of the earlier gates' `cdp.mjs`, `d.py`, `fld.py`, `login.sh`, `g.py`, `aud.py`,
`api.sh`, `ses.py`, `al.py`, `pane.sh`, `pverify.sh`, `openrow.sh`, `t_signout.sh`, `w.sh`).

## 10. Environment as left (14:14)

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 13944, 2 RUNNING PID 13991 - neither restarted nor reset; web 5176 / 5177, Metro, PostgreSQL untouched; health ok, `ws.clients 2` |
| Seal rig | `OFF` (read; never switched) |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (never changed) |
| Session | none open; `session/current` = `SES-20261011-0057` SEALED, summary acknowledged from the tablet. Next session `SES-20261011-0058`, next item `EV-20261011-0044` |
| **New on lane 2** | **`EV-20261011-0043`** = `SES-20261011-0057`: clean, 48.0 s, 47.5 MB, 19 + 19 fragments, made in the WEB UI as OPR-002 (rows without a device), case `LP/2026/1011-9610`, transcript assembled, revision head 0, no export, verify PASS 15 of 15 four times (web, API, tablet, phone). The lane holds 40 items |
| Alerts | 47, **none active**. New: `ALR-000089` INFO `MIC_RATE_AT_LIMIT`, inactive |
| Audit | chain `view.ok true`, `stored.ok true`, 979 rows at 14:14, then my sign-out. Rows of this run: seq 964-980 (one session, four `EVIDENCE_VERIFIED` on `-0043`, one on `-0038`, one `EVIDENCE_VERIFY_FAILED` on `-0005`, sign-ins / sign-outs) |
| Lane 1 | one supervisor helper sign-in / sign-out (two pages read) |
| Devices | tablet and phone signed out through the app, on Login, both fields showing only their hint, "Core online", "paired as DEV-0001" / "DEV-0002"; `pairing/devices` both `PAIRED`, online, no operator; both reverse rules read back on both; no re-pairing, no lock change, no reboot, biometric not enabled, media volume not touched |
| Helpers | both helper sessions signed out (204; lane 2 then 401), no jar left; both headless browsers stopped, their profiles removed; logcat writers stopped; no `capture-worker` / `whisper` / `ffmpeg` process |

## 11. What final re-check 94 must know

1. `session/current` of lane 2 is a SEALED session again (`SES-20261011-0057`), with its capture
   member still present (no restart since): the Monitor's integrity card shows the capture rows.
2. `EV-20261011-0043` is a fresh clean item: no export, no revision, no media session ever opened,
   four PASS verify rows. `EV-20261009-0005` got one more failed-verify row (seq 970).
3. Tablet item page: scroll the detail pane once before tapping a tab - at the first position the
   tab strip is under the Play / Export / More bar and the tap opens Export (G89d-03).
4. The web route is `/security-audit`; `/security` is "Page not found".
5. Cookies are per host, not per port: drive lane 1 and lane 2 in two browser profiles, or the
   second helper cookie replaces the first.
6. The sign-in and the sign-out on a device each write about 10-16 error-level lines of the
   emulator's graphics stack in the app's process (G89d-04): count app errors by tag, or clear the
   logcat after the sign-in and say so.
7. The item pages print full hashes and the signature value; audit rows of `EVIDENCE_SEALED` print
   the full manifest hash: mask hex runs in what you read.
8. A helper session lasts 15 minutes from its last POST: mine was kept alive by the verify presses
   (13:56 -> 14:14, no expiry).

---
*Generated: 2026-10-11 14:20 WIB*
