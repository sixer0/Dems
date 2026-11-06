---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 89 - M7 milestone gate (evidence package v2), TARGETED RE-CHECK after fix wave K and fix 151
date: 2026-10-11
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`, decisions D222, D224..D228)
tree: b05106b + the uncommitted fix 151 (`git status --porcelain -- apps packages scripts`: the same 6 lines at the start and at the end - 4 modified, 2 new, all of fix 151)
narrative_tier: 2
status: needs-review
verdict: PASS WITH CONDITIONS (both MAJOR items held by D222 are closed; three new MINOR findings, section 5)
supersedes: nothing - `12_m7_gate.md` and `12b_m7_regate.md` stay the records of the gate and the re-gate
---

# 12c - M7, targeted re-check (row 89)

Run window 09:02-09:24 WIB on the standing environment (lane 1 PID 52989 SIMULATED, lane 2 PID 70017
REAL_DEVELOPMENT, both devices on lane 2). NOT a full gate: the nine items of the task, one run each.
No product or test file changed, no git write, no install, no lane restart, no reset, seal rig read
only (`OFF` at the start and at the end). No local device (`CAM-03` / `MIC-03`) selected, pre-checked
or started; no attendance variable; the fingerprint sensor never touched, the biometric offer answered
"Not now" on the tablet and on the phone (skipped by the user's instruction, never passed); no lock
set, changed or removed. Nothing was played ("Play" / "Open playback" not pressed). No `.data/pg*.env`,
no pwfile, no key file, no fixture file opened. Of the lane's packages I read manifests, the clear
init segments (first 1,249 bytes of camera files: box headers only), one transcript header, and made
two folder COPIES under `.cache/gates/89c/work/`.

Surfaces: **W2** = web console lane 2 (5177, headless Chromium over CDP at 1440 x 900, helper session
cookie), **W1** = the same on lane 1 (5176), **T** = tablet `emulator-5556` = `DEV-0001`, **P** = phone
`emulator-5554` = `DEV-0002`, **API** = lane 2's Core, **FILE** = package files read in place,
**PV** = the product's verifier (`verifyPackageV2` through `corePorts`, scratch `pv.mts` as 12b ran it)
on a folder copy without a session key.

## 1. Verdict for M7

**PASS WITH CONDITIONS.** Taken from 12b's results plus this run:

- The two items the controller held at MAJOR (D222 (1), (2)) are **closed**: the web Security & Audit
  page of the real-capture Core states no DEMO key, no TPM residence and no attestation, and names the
  key its packages are signed with; the signed manifest of four packages sealed after fix 151 states
  `H264_720P30` on both tracks, which is what the files' own init segments declare (1280 x 720, 30 per
  second), with no notice.
- 12b's conditions C-3 (phone on a v2 package), C-6 (G89b-04), C-7 (G89b-05, -06) are closed;
  C-5 (G89b-02) is a documented limit with unchanged behaviour; C-1 (G89b-03) is met as ruled by
  D224 (2): zero app ERROR lines, mount warnings counted.

| # | Condition | Finding | Owner |
|---|---|---|---|
| K-1 | The web Dashboard of the real-capture Core says "Manifest hash · NO MEDIA PACKAGE" under an item whose sealed package the Core holds and verifies | G89c-01 MINOR | coder-execution (core-web), wave L |
| K-2 | The web Security & Audit page of the real-capture Core says "EVIDENCE PACKAGES 12 PASS • 1 FAIL / EV-20261009-0005: AUDIO-02 hash mismatch" (labelled "DEMO - precomputed"); the Core's own verification of that item names `VIDEO-02` fragment 3, the item has no `AUDIO-02` file, and the lane holds 31 items | G89c-02 MINOR | coder-execution (core-web), wave L |
| K-3 | The web Monitor's Evidence Integrity card of a SEALED real session reads "Encryption Active / Secure Timestamp Synced - RTC / Storage Write Verified" - the simulator's rows - on the Core whose Security page says "nothing is locked" | G89c-03 MINOR (ruling asked: same class as C-2, on a page D222 did not name) | controller (ruling) + coder-execution (core-web) |
| K-4 | Field 36 is shown on no client; op 40 still answers `profileId STANDARD_1080P25` for items whose manifest says `H264_720P30` (D224 (5): next task; web Monitor label = G75d-05, known) | G89c-04 NOTE | controller (next task) |
| K-5 | Fix 151 is uncommitted and the whole suites were not re-run after notes 149-151; the seal e2e and the kill matrix did not run on fix 151 | not run (note 151 section 7 item 7) | row 95 / test runner |
| K-6 | Still tests only, as at 12b C-8: one-camera seal, truncated tail, kept-plaintext alert, boot sweep acting, every REAL_PRODUCTION refusal, unreachable-PARTIAL package, server-backend model line | NOT DRIVEN LIVE | row 95 / user |

No BLOCKER, no MAJOR by my rating. K-3 is put to the controller because D222 held the same class
of sentence at MAJOR on another page.

## 2. Start state (09:02)

| Check | Result |
|---|---|
| `lane.sh status` | lane 1 RUNNING PID 52989, lane 2 RUNNING PID 70017; web 5176 / 5177 answer 200; Metro `packager-status:running`; seal rig `OFF` |
| `GET health` lane 2 | `ok`, `ready {database true, engine true}`, `ws.clients 2` |
| Devices | both attached, no keyguard, Login, "Core online", "paired as DEV-0001" / "DEV-0002"; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both |
| Lane 2 | `session/current` = `SES-20261011-0042` SEALED; selector `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; 30 items; 28 alerts, one active by `GET alerts`: `ALR-000049` (known, G75d-01); audit chain `ok`, 655 rows |

## 3. Items table

| Item | Surface | Result |
|---|---|---|
| 1 G89b-01: signed manifest `tracks[].profile` = `H264_720P30` on both tracks, post-fix packages | FILE | **PASS** (4 packages) |
| 1 the init segment declares the same | FILE | **PASS**: `avc1` 1280 x 720, SPS 30 per second |
| 1 no fraction, no notice | FILE, API | **PASS** |
| 1 evidence detail carries no "1080p • 25 fps" | W2, T, P | **PASS** - and no profile text at all (G89c-04) |
| 1 older packages verify PASS 15 of 15 and keep their labels | API, FILE | **PASS** |
| 2 C-2: Security & Audit lane 2 free of the false claims; key shown = `signature.keyId` | W2, FILE | **PASS** |
| 2 lane 1 unchanged | W1 | **PASS** |
| 2 tablet / phone Security and About | T, P | **PASS** |
| 3 G89b-04: verify rows from tablet / phone / web | T, P, W2, API | **PASS** |
| 4 G89b-05: web seal dialog of a real item | W2 | **PASS** |
| 4 G89b-06: "decrypted bytes Not run" on the tamper demonstration | W2, T, P | **PASS** |
| 5 G89b-02: limit stated in the spec; behaviour unchanged | docs, PV | **PASS as a documented limit** |
| 6 G89b-03 / B9: zero app ERROR lines | logcat T, P | **PASS**; mount warnings 408 (T), 454 (P), counted, not failed (D224 (2)) |
| 7 G89b-11: Monitor integrity card at 1440 x 900, no overlap | W2 | **PASS** |
| 7 Dashboard "NO MEDIA PACKAGE" on a real item | W2 | judged: **G89c-01** |
| 7 Security & Audit "AUDIO-02 hash mismatch" | W2, W1 | judged: **G89c-02** |
| 8 M7 v2 package on the phone | P | **PASS** (was NOT PROVEN) |
| 9 op 41 on a clean, an interrupted (after wave K) and the blocked-then-sealed item | API | **PASS** 15 of 15, three times |
| 9 RBAC of op 41 for one forbidden role | API | **no role is forbidden by the registry**; TECHNICIAN 200, no session 401 |

## 4. Evidence per item

### 4.1 Item 1 - G89b-01 (MAJOR)

Packages sealed on the fix 151 code (lane 2 processes 55401, 59263, 70017 all ran the working tree):

| Item / session | Manifest `tracks[].profile` (read from `session-manifest.json`) | Init segment of the package's own files (read by my `init.py`) | Notice |
|---|---|---|---|
| `EV-20261011-0026` / `SES-20261011-0037` (clean) | `VIDEO-01` `H264_720P30`, `VIDEO-02` `H264_720P30` | both files: `ftyp` 28 + `moov` 1221 = 1,249 clear bytes; `tkhd` 1280 x 720; sample entry `avc1` 1280 x 720; `avcC` one SPS: profile_idc 66, level_idc 31, coded 1280x720, `num_units_in_tick 1`, `time_scale 60`, `fixed_frame_rate_flag 1` = **30 per second**; `mdhd` 90000; `trex` default duration 0; audio `mp4a` 1 channel 48000; no box header after the init segment | none |
| `EV-20261011-0031` / `-0042` (interrupted, worker kill) | `H264_720P30` twice | the same on both files | none |
| `EV-20261011-0029` / `-0040` (blocked, then sealed) | `H264_720P30` twice | not read | none |
| **`EV-20261011-0032` / `-0043` (made by this run, 09:06:33-09:07:21, API, FAKE sources)** | `H264_720P30` twice (`firstVideoSamplePts` 141833 / 277534: the holds of 1.58 s / 3.08 s were there again) | the same on both files | none |

`GET alerts` after my session: 29 alerts; the only one with `params.reason STREAM_PROFILE_DIFFERS` is
`ALR-000033` of `SES-20261011-0036` (inactive). My session added one INFO `MIC_RATE_AT_LIMIT`
(`ALR-000056`, resolved).

Older packages, not rewritten: `EV-20261010-0015` manifest `H264_1080P25` twice; `EV-20261011-0025`
manifest `H264_720P27.67` / `H264_720P26` with `ALR-000033`. Their init segments declare the same
1280 x 720 at 30 as above (read). Op 41 on both: `overall PASS`, 15 of 15.

Clients: W2 item page of `-0026` (Media, Metadata, Hash & Integrity tabs, verify result), of `-0025`
and of `-0015`; T detail of `-0032` and `-0015`; P detail of `-0017` and `-0032`: the page text holds
no "1080", "720", "fps" or "profile" (DOM search on W2, view-tree search on T and P: 0 hits). So
nothing false stands beside the manifest - and the manifest's value is not repeated either: op 40
carries no member for it (it carries `profileId STANDARD_1080P25`, the session's input; D224 (5)).
See G89c-04. The Monitor's "Recording Profile / Standard (1080p / 25 fps)" was met again during my
recording (G75d-05, known). The tablet's Session Live chip was not re-driven by me (10d passed it).

Code: `fix-151-declared-profile.test.ts` run once by me: `Test Files 1 passed (1) / Tests 14 passed (14)`.

### 4.2 Item 2 - C-2 (MAJOR)

W2 Security & Audit (09:04:33, text read from the DOM, picture `w2_01`):

| Asked | Read |
|---|---|
| "DEMO device key" | absent. Manifest signature: "Ed25519, Core key CORE-KEY-EVSIGN-01 - the key the sealed items of this Core are signed with. The Core says this is a DEVELOPMENT key - not a production signature." |
| `DEMO-KEY-EVSIGN-01` | absent. Evidence signing key: "DEVELOPMENT KEY / Ed25519 • CORE-KEY-EVSIGN-01 / The key the sealed items of this Core are signed with (newest: EV-20261011-0031)." |
| The key shown = the packages' key | `signature.keyId` read from the manifests of `SES-20261011-0037`, `-0040`, `-0042`, `-0043`, `-0036` and `SES-20261010-0025`: `CORE-KEY-EVSIGN-01`, `Ed25519`, `simulated false` in all six. Equal |
| "Hardware root key - TPM 2.0 ... resident, never exported" | absent. "Hardware root key / Not reported / This Core reports no hardware root key. It does not read a TPM." |
| Attestation claim | absent. "TPM 2.0 attestation / This Core does not read a TPM or the Secure Boot state. / Not reported"; the same for Secure Boot and Key custody |
| The rest | posture "Not reported", "1 of 9 active · 8 not reported"; Device certificate and TLS certificate "Not reported"; Secure timestamp "Host system clock. No time service is configured: nothing is locked and nothing is in holdover."; Enclosure "This Core has no enclosure switch to read."; Signed firmware "This Core reports no firmware signature."; footer "As this Core reports them. It reports no device certificate, no TLS certificate and no hardware root key." |

W1 Security & Audit (lane 1, 09:04:53, `w1_01`): "SECURITY POSTURE SECURE / 9 of 9 controls active",
"TPM 2.0 attestation - Attestation OK", "Key custody - TPM-wrapped, never exported", "Manifest
signature - Ed25519, DEMO device key", "Evidence signing key DEMO - DEMO-KEY-EVSIGN-01", "Hardware root
key - Hardware-bound - TPM 2.0 (fw 7.2.3.1) - Resident in TPM 2.0, never exported", "DEMO certificate
and key: not for production". Unchanged.

T and P (supervisor signed in): Settings > Security & Privacy holds only biometric sign-in, auto-lock,
Core pairing, operator audit, lock, sign out - no key, TPM or attestation line (`t_03`, `p_06` by
view tree). Settings > About: block "Configuration identity (design book §24.1)" under the chip
"DEMO" and the line "Synthetic demo values", with "TPM / SE firmware - Not reported" (`t_04`, `p_07`).
Tablet Audit screen: view-tree search for "DEMO-KEY", "TPM 2.0", "never exported", "attestation",
"DEMO device key": 0 hits. Item pages on T and P: "MANIFEST SIGNATURE (ED25519, CORE KEY
CORE-KEY-EVSIGN-01)", "Key: CORE-KEY-EVSIGN-01", "Signed with a DEVELOPMENT key — not a production
signature".

Two remarks on the W2 page, not failed on: the control "Manifest signature" states the key in its
sentence and carries the status "Not reported" (G89c-05); the tamper panel is G89c-02.

### 4.3 Item 3 - G89b-04

Audit rows read through `GET audit` (lane 2):

| Seq | Sent from | Row |
|---|---|---|
| 663 | W2 "Verify again" on `EV-20261011-0026` | `EVIDENCE_VERIFIED`, `deviceId null`, `details.operationId verifyEvidence` |
| 664 | W2 "Verify again" on `EV-20261009-0005` | `EVIDENCE_VERIFY_FAILED`, `deviceId null`, `operationId verifyEvidence`, `failedTracks VIDEO-02`, **`failedFragments VIDEO-02:3`**, `failedFragmentCount 1` |
| 673, 674, 675 | T Verify x3 on `EV-20261011-0032` | `EVIDENCE_VERIFIED`, **`deviceId DEV-0001`**, `operationId verifyEvidence` |
| 676, 677 | T Verify x2 on `EV-20261009-0005` | `EVIDENCE_VERIFY_FAILED`, `DEV-0001`, `operationId`, `failedFragments VIDEO-02:3` |
| 680, 681 | P Verify x2 on `EV-20261010-0017` | `EVIDENCE_VERIFIED`, **`deviceId DEV-0002`**, `operationId verifyEvidence` |
| 682 | P Verify on `EV-20261011-0032` | the same, `DEV-0002` |
| 683, 685 | P Verify x2 on `EV-20261009-0005` | `EVIDENCE_VERIFY_FAILED`, `DEV-0002`, `operationId`, `failedFragments VIDEO-02:3` |
| 656-660, 662 | helper sessions through the API | `deviceId null`, `operationId verifyEvidence` |

The tablet's own Audit screen shows the device on these rows ("EV-20261009-0005 · DEV-0001").
Sign-in / sign-out / `SUMMARY_ACKNOWLEDGED` rows of the devices carry `DEV-0001` / `DEV-0002` too
(670, 671, 678, 679, 686).

### 4.4 Item 4 - G89b-05, G89b-06

G89b-05, W2 Monitor, seal of my session `SES-20261011-0043` (sampler log `l2_S.log`, picture
`l2_S_seal_dialog`): "Evidence sealed / Session SES-20261011-0043 / 100% complete / ... / SEALED /
Evidence EV-20261011-0032 sealed / Sealed 8.6 s after the recording ended / Manifest SHA-256 / (first
24 hex) / Signature - Ed25519, Core key CORE-KEY-EVSIGN-01 / Signed with a DEVELOPMENT key — not a
production signature / Recorded from development sources - not from production devices. / Close /
View in Evidence". Test ids `sm-final-real-key`, `sm-final-development-key`,
`sm-final-development-sources` present. "No DEMO package exists for this item." and the chip "LIVE":
absent. During "Finalize transcript" (09:07:21.9-09:07:30.1) the dialog showed no time-left line.
Remark: the development-key line was missing in the first sample of the sealed dialog (09:07:30.170)
and present 0.6 s later (G89c-06, NOTE).

G89b-06, `EV-20261009-0005` after a Verify press: "VIDEO-02 file / FAIL / Stored bytes FAIL ·
decrypted bytes Not run · fragment chain FAIL · 4 fragments" on W2 (`w2_04`), T (`t_02` shows the
row's head; the sentence read from the view tree) and P (`p_05`); "Where it failed / VIDEO-02 fragment
3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)"; W2 "V-05 · Plaintext hash
after decryption / Not run: an earlier check failed", "11 of 15 checks passed". `VIDEO-01` row:
"decrypted bytes PASS".

### 4.5 Item 5 - G89b-02 as a documented limit

Spec: `masterplan/06_evidence_package_spec.md` errata index row PE-WK-17 (line 57) and §H.8
(line 1163, first limit row, line 1169): a copy whose revision list lost its last revision, or all,
"verifies PASS without the Core and with no notice"; why (`revisionHead` is 0 for ever); what holds it
on the Core (`REVISION_COUNT_MISMATCH` against the database) and in an export (`X-04
ENTRY_HASH_MISMATCH`, gate 94). Stated.

Behaviour, on APFS clones of `SESSION-SES-20261010-0031` (`EV-20261010-0020`, four revisions) under
`.cache/gates/89c/work/`, anchored to op 40's `manifestHash` and the manifest's certificate hash
(`revision_control.txt`):

| Copy | PV |
|---|---|
| `0020_untouched` | `overall PASS ok true`, V-05 `SKIPPED (KEY_UNAVAILABLE)`, 14 of 15, notices `[AUDIT_EXTRACT_NOT_SIGNED]` |
| `0020_drop_last` (list rewritten with 3 of 4) | **`overall PASS ok true`, 14 of 15, the same single notice** - unchanged from 12b |

The lane's own list still holds 4 revisions (read after the run). My first PV run of both copies
failed V-03 `MANIFEST_NOT_OF_ITEM`: I had handed it the SHA-256 of the manifest FILE as the anchor
instead of the Core's recorded manifest hash - my error, repeated once with the right anchor.

### 4.6 Item 6 - G89b-03 / B9

| | Tablet | Phone |
|---|---|---|
| logcat cleared | 09:09:32 (Evidence list open) | 09:15:30 |
| Item openings | 3: `-0032`, `-0015`, `-0005` | 3: `-0017`, `-0032`, `-0005` |
| Verify presses | 5: `-0032` x3 (09:10:08, 09:10:25, 09:11:20), `-0005` x2 (09:12:53, 09:13:08) | 5: `-0017` x2 (09:16:33, 09:17:16), `-0032` (09:18:02), `-0005` x2 (09:19:11, 09:19:44) |
| dumped | 09:13:16, 85,367 lines | 09:19:53, 93,610 lines |
| **Level E / F lines of the app's process** | **0** (pid 5797) | **0** (pid 16373) |
| `ReactNativeJS` lines | 13, all level I | 14, all level I |
| Level E lines of other processes | 25 `BluetoothPowerStatsCollector`, 4 composer, 5 platform | not listed |
| "Unable to find SurfaceMountingManager" lines | **408** (66,444 `Reanimated` W lines with their traces): 43 + 27 at openings, 77 / 77 / 34 / 71 / 79 at the five presses | **454**: 31 + 43 at openings, 77 / 77 / 77 / 79 / 70 at the presses |

Zero app ERROR lines: PASS. The mount warnings are the ruled limit (D224 (2)): counted. The phone's
count is now of the tablet's order (12b counted 11 on a simulated item of lane 1).
Files: `logcat_T_evidence_verify.txt`, `logcat_P_evidence_verify.txt`.

### 4.7 Item 7

**G89b-11** - W2 Monitor at 1440 x 900 while `SES-20261011-0043` recorded (09:06:45 and 09:06:53,
`l2_S_monitor_recording_1`): the Evidence Integrity card draws "Capture - Recording. The first
fragme…", "Media Protection - Not encrypted du…", "Audit Log Hash Chain - SHA-256", "Time Source -
Core system clock (U…" as four separate rows. Geometry of the 20 text leaves of the card body, pair
by pair: **0 overlaps** in both samples; "Durable Fragments" is its own 247 px wide block (not an
18 px column). PASS. Remark: the card body is 104 px high with 223 px of content and
`overflow-y: auto`, so the "Durable Fragments" lines (6, then 15 fragments saved, per camera) lie
below the visible part and are reached only by scrolling inside the card; nothing shows that there is
more (G89c-07, NOTE).

**Dashboard "NO MEDIA PACKAGE"** - lane 2, W2 Dashboard at 09:08 (`w2_05`), card ACTIVE SESSION:
"Sealed / Evidence sealed / Evidence ID EV-20261011-0032 / Sealed at 11 Oct 2026 09:07:30 UTC+07:00 /
**Manifest hash · NO MEDIA PACKAGE** / a61de8afe2b8c3fc…49922c72". The Core says of the same item
(op 40): `integritySource REAL`, `sealedPackage PRESENT`, `media {source LIVE_STREAM, fileIds
[VIDEO-01, VIDEO-02]}`, 47.2 MB; op 41 (tablet and phone, seq 673-675, 682): PASS. The suffix is
chosen in `apps/core-web/src/features/dashboard/sim-adapter.ts` (`manifestSuffixKey`: a digest whose
source is not a bundled DEMO package reads "NO MEDIA PACKAGE" in Live mode). False on a real item:
**G89c-01**.

**Security & Audit "AUDIO-02 hash mismatch"** - lane 2, W2, panel TAMPER & INTEGRITY: "EVIDENCE
PACKAGES / 12 PASS • 1 FAIL / EV-20261009-0005: AUDIO-02 hash mismatch / DEMO - precomputed". The Core
says of that item (op 41, six times in this run): `TAMPERED`, `failedTracks VIDEO-02`,
`failedFragments VIDEO-02:3`; its files are `VIDEO-01` and `VIDEO-02` (no `AUDIO-02` exists in a v2
package); the lane holds 31 items, 18 of them real. Lane 1 (W1) shows the same panel with its own
dataset id: "EV-20261010-0005: AUDIO-02 hash mismatch / DEMO - precomputed". Source:
`features/security-audit/tamper-panel.tsx:79-83` over the bundled DEMO index
(`sim-adapter.ts:19-20`). On the simulated lane it is the labelled demonstration; on the real-capture
Core it is a count and a track name that are not the Core's, directly above the Core's own
"Evidence verification failed" rows: **G89c-02**.

### 4.8 Item 8 - a v2 package on the phone

Phone, supervisor, `EV-20261010-0017` (`p_01`, `p_03`, view tree):

| Asked | Read |
|---|---|
| Development marks | list row and detail chip "Development source"; in the verify result, first: "DEVELOPMENT SOURCES — this package was not recorded from production devices." with "VIDEO-01: CAM-01 · Test source", "VIDEO-02: CAM-02 · Test source", "Audio interval 1: MIC-01 · Test source"; then "Signed with a DEVELOPMENT key — not a production signature"; on the signature block "MANIFEST SIGNATURE (ED25519, CORE KEY CORE-KEY-EVSIGN-01)" and the development-key line |
| Interrupted line | header: "Sealed — recording was interrupted / Cause: CAPTURE_FAULT" (`evidence-detail-interrupted`); result: "Interrupted recording: the durable part is sealed and was verified." (`evidence-v2-interrupted`) |
| Verify result | "Verified by the Core / PASS: every hash matches the sealed manifest"; files 12 and 11 fragments "Stored bytes PASS · decrypted bytes PASS · fragment chain PASS"; "Checks of this run · 15 of 15 checks passed", V-01..V-15 |
| Not-signed notice | "Not covered by the package signature / Audit extract: present, NOT covered by the package signature." (`evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED`) |
| Transcript model block | "Transcript model / Name: ggml-large-v3-turbo / Version (declared by the installation): large-v3-turbo / Quantisation: f16 / Model file SHA-256: (64 hex)"; "Transcript assembled", "Inside the sealed package", "speaker labels unavailable" |

Also on the phone: `-0032` PASS; the tamper demonstration FAIL with `evidence-v2-fragment-VIDEO-02-3`
(`p_05`). 12b's C-3 is closed for the evidence detail and verify. Known and unchanged: the phone's
sentence "this tablet shows it as it is" (12b section 7, G89-14).

### 4.9 Item 9 - spot-check

| Check | Result |
|---|---|
| Op 41 `EV-20261011-0026` (clean) | 200, `overall PASS`, 15 of 15, `manifestOk` / `signatureOk` true, `signature {developmentKey true}`, notices `[AUDIT_EXTRACT_NOT_SIGNED]`, `interrupted false` |
| Op 41 `EV-20261011-0031` (interrupted, after wave K) | PASS, 15 of 15, `interrupted true`; its `transcript.json`: `qa_flags ["intervals_incomplete", "speaker labels unavailable"]`, `intervals [{MIC-01, from_ms 21, to_ms null}]` |
| Op 41 `EV-20261011-0029` (blocked, then sealed) | PASS, 15 of 15, `interrupted false` |
| RBAC | The registry gives op 41 to `EVIDENCE_VIEW`, which every seeded role holds (`packages/shared/src/api/evidence.ts:12`, `:725` "every seeded role holds EVIDENCE_VIEW"): **there is no forbidden role to try**. Driven: TECHNICIAN (outside the case) on `-0026`: 200 PASS (seq 662); no session: 401 `NOT_SIGNED_IN`. As 12b section 4.5 |

Answers: `op41_*.json`.

## 5. Findings of this re-check

| ID | Severity | What | Steps / evidence | Spec / ruling |
|---|---|---|---|---|
| **G89c-01** | MINOR | Web Dashboard, lane 2: "Manifest hash · NO MEDIA PACKAGE" under a REAL sealed item whose package the Core holds (`sealedPackage PRESENT`, two camera files, verify PASS) | 4.7; `w2_05`; `dashboard/sim-adapter.ts` `manifestSuffixKey` | D204: a real item's surfaces state the Core's facts; class of G89b-05 (which is fixed in the dialog) and of G75c-11 |
| **G89c-02** | MINOR | Web Security & Audit, lane 2: "EVIDENCE PACKAGES 12 PASS • 1 FAIL / EV-20261009-0005: AUDIO-02 hash mismatch / DEMO - precomputed". Count and track are the bundled index's; the Core's verification names `VIDEO-02` fragment 3 and the lane holds 31 items | 4.7; `security-audit/tamper-panel.tsx:79-83` | the page D222 (1) ruled on: it states what THIS Core reports; the label says "precomputed" but not that it is not this Core's result |
| **G89c-03** | MINOR (ruling asked) | Web Monitor, lane 2, session SEALED (`SES-20261011-0042` at 09:06, before my recording): card EVIDENCE INTEGRITY reads "Encryption Active / AES-256 / Passing", "Hash Chain Active / SHA-256 / Passing", "**Secure Timestamp Synced** / RTC (UTC+07:00) / Warning", "Storage Write Verified / Standby". While a session RECORDS the card reads the Core's rows ("Capture", "Media Protection - Not encrypted during recording", "Time Source - Core system clock"); once it is sealed the simulator's rows are back. "Secure Timestamp Synced" stands on the Core whose Security page says "nothing is locked and nothing is in holdover" | DOM text read once at 09:06 (quoted in full: "EVIDENCE INTEGRITY | Encryption Active | AES-256 | Passing | Hash Chain Active | SHA-256 | Passing | Secure Timestamp Synced | RTC (UTC+07:00) | Warning | Storage Write Verified | Standby | Standby | CHAIN HEAD | … | Re-verify"). No picture of this state was taken | note 141's sweep (Session Monitor); D222 (1) class |
| G89c-04 | NOTE | No client shows manifest field 36: item pages on W2, T, P carry no format; op 40 has no member for it and answers `profileId STANDARD_1080P25` for an item whose manifest says `H264_720P30`. Nothing false is drawn on the evidence detail; an auditor at a console cannot read the sealed format, and the notice of `EV-20261011-0025` (`STREAM_PROFILE_DIFFERS`) is not shown on its item page | 4.1 | D222 (2) "clients repeat the manifest"; D224 (5) `profileId`: next task |
| G89c-05 | NOTE | W2 Security & Audit, control "Manifest signature": the sentence states the key ("Ed25519, Core key CORE-KEY-EVSIGN-01 … DEVELOPMENT key") and the status chip beside it says "Not reported"; the header counts it among "8 not reported" | 4.2; `w2_01` | - |
| G89c-06 | NOTE | The web seal dialog reached "Evidence sealed" with the Core-key and development-sources lines; the development-key line appeared 0.6 s later (it comes with the item) | `l2_S.log` 09:07:30.170 against 09:07:30.786 | - |
| G89c-07 | NOTE | Monitor Evidence Integrity card at 1440 x 900: the "Durable Fragments" block is below the visible 104 px of the card body and no cue says the card scrolls; the row sentences are cut with an ellipsis ("Recording. The first fragme…") | 4.7; `l2_S_monitor_recording_1` | - |
| G89c-08 | NOTE | Dashboard at 1440 x 900 (`w2_05`): in the status strip "Host system clock" runs under the Security icon; in DEVICES & INPUTS the camera tiles are cut at "No preview", the MIC 1 "Primary" chip is half hidden, the last "NO SIGNAL" is cut at the card edge | `w2_05` | - |

Known findings met again, not re-reported: **G75d-01** - with one manifestation 10d did not list:
during my healthy recording the web Monitor banner read "FAULT / Recording continues • This recording
could not be sealed. Its files were kept in quarantine on the Core. (SESSION_KEY_NOT_OF_SESSION)"
(the active `ALR-000049` of `SES-20261011-0041` drawn as a fault of `SES-20261011-0043`), beside the
header pill "SECURE / All systems operational" with a "1" on the bell (`l2_S_monitor_recording_1`);
G75d-05 (Monitor "Standard (1080p / 25 fps)"), G75d-06 ("Camera 1 · CAM-01 · Dual-lens IP camera
DL-2" on Monitor and Dashboard), G75d-03 (Dashboard ring), G75c-03 ("Cause: CAPTURE_FAULT"),
G89-14 (phone "this tablet"), the mount warnings (D224 (2)). G70c-01 tiles were not read.

## 6. State of 12b's findings and conditions

| Item | State |
|---|---|
| C-2 / G89-03 remainder (MAJOR, D222 (1)) | **closed** (4.2); G89c-02, -03 are what is left of the class on other blocks |
| G89b-01 (MAJOR, D222 (2)) | **closed** for the signed manifest (4.1); client half: nothing false on the evidence detail, G89c-04; Monitor label G75d-05 (known) |
| G89b-02 | documented limit, behaviour unchanged (4.5) |
| G89b-03 | ruled limit; 0 app ERROR lines (4.6) |
| G89b-04 | **closed** (4.3) |
| G89b-05, -06 | **closed** (4.4) |
| G89b-07, -08, -10 | recorded by D222 (6); not in this re-check |
| G89b-09 | gate 94's |
| G89b-11 (a) | **closed** (4.7); (b) phone "More" tap: not met again (two taps on More navigated at once) |
| C-3 phone on a v2 package | **closed** for detail + verify (4.8); the phone's hand-over logcat Monitor -> Finalizing -> Summary was not driven here (10d counted it) |
| C-8 | unchanged: tests only |

## 7. Skipped / user-attended

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the offer answered "Not now" once on the tablet and once on the phone; never passed |
| Local devices, attendance variables, the local-device notice | never selected or set; no such flow here |
| Playback, export, the receiver command | gate 94; not pressed |
| Seal rig, lane restart, reset, camera search, stub, `CAM-04` / `CAM-05` | not touched (rig `status` read twice: `OFF`) |
| Server STT backend, port 8000 | not touched |

## 8. What stays NOT PROVEN

1. Everything of K-6 / 12b C-8 (tests only).
2. The whole suites, the seal e2e and the kill matrix on the tree with fix 151 (K-5). I ran one test
   file (14 tests).
3. The tablet's Session Live chip and the tablet / phone hand-over on a session of this run (the
   session was driven through the API; 10d drove both).
4. G89c-03 on the tablet / phone Session screens after a seal: not looked at.
5. A "forbidden role" for op 41: none exists; the case-scope refusals of ops 84-88 are gate 94's.
6. `masterplan/02_plan.md` and `implementation/99_implementation_report.md`: the task asked for this
   one file and nothing else under `docs/`.

Lapses of mine, for the record: (a) two of my reads printed PUBLIC signature values of manifests into
my own tool output (the web Metadata tab's Core record of `-0026`, the tablet's signature block of
`-0032`); no key material; none is in this report or in a file name; later reads masked hex runs.
(b) My first tap on the tablet's `-0015` row landed under the screen edge, so the third tablet press
went to `-0032` again; `-0015` was then opened and not verified on the tablet. (c) The first PV run
used a wrong anchor (4.5). (d) The technician's helper session and my first supervisor helper session
ended by idle expiry (seq 684, 687) instead of a sign-out. (e) Each Verify added a row and a custody
entry: seq 656-685 hold 12 `EVIDENCE_VERIFIED` and 6 `EVIDENCE_VERIFY_FAILED` of this run.

## 9. Screenshots (`.cache/gates/89c/`)

Read by me as pictures:

| File | Shows |
|---|---|
| `w2_01_security_audit.png` | lane 2 Security & Audit: posture "Not reported", "1 of 9 active · 8 not reported", Evidence signing key "DEVELOPMENT KEY / Ed25519 • CORE-KEY-EVSIGN-01", Hardware root key "Not reported" |
| `w1_01_security_audit.png` | lane 1 the same page: "SECURE", "9 of 9 active", DEMO device key, `DEMO-KEY-EVSIGN-01`, "TPM 2.0 (fw 7.2.3.1) / Resident in TPM 2.0, never exported" |
| `w2_03_0026_verify.png` | web `EV-20261011-0026` Hash & Integrity after Verify: PASS, the development-sources block, the development-key line, "Transcript sealed", toast "Integrity verified" |
| `w2_04_0005_tamper_verify.png` | web `EV-20261009-0005`: FAIL, both development blocks, VIDEO-01 PASS, VIDEO-02 row red under the toast "Integrity FAILED … VIDEO-02" |
| `w2_05_dashboard.png` | lane 2 Dashboard: ring "SYSTEM READY", ACTIVE SESSION "Evidence sealed / EV-20261011-0032 / Manifest hash · NO MEDIA PACKAGE", clipped device tiles, "Posture: not reported / 1 active alert" |
| `l2_S_monitor_recording_1.png` | web Monitor at REC 00:00:11: banner "FAULT / Recording continues • This recording could not be sealed…", Evidence Integrity card with four separate rows, "Recording Profile Standard (1080p / 25 f…", header "SECURE" with bell "1" |
| `l2_S_seal_dialog.png` | web dialog "Evidence sealed", six steps done, SEALED `EV-20261011-0032`, "Signature Ed25519, Core key CORE-KEY-EVSIGN-01", the development-key and development-sources lines, Close / View in Evidence |
| `t_01_0032_verify_pass.png` | tablet `EV-20261011-0032`: "Verified by the Core", PASS, the two development blocks, "Transcript sealed", VIDEO-01 PASS 20 fragments |
| `t_02_0005_tamper_not_run.png` | tablet `EV-20261009-0005`: "Verification failed on the Core", "FAIL: VIDEO-02 does not match the sealed manifest", VIDEO-01 PASS, the head of the red VIDEO-02 row |
| `t_03_settings_security.png` | tablet Settings > Security & Privacy: biometric sign-in (switch on the device's state, not touched), auto-lock 15 min, Core pairing "Paired", Lock console, Sign out |
| `t_04_about.png` | tablet About: Product (DEMO), "Configuration identity … / Synthetic demo values" (DEMO) with "TPM / SE firmware - Not reported" |
| `p_01_0017_detail.png` | phone `EV-20261010-0017`: chips "Development source" / "Sealed", "Sealed — recording was interrupted / Cause: CAPTURE_FAULT", facts, tabs |
| `p_03_0017_verify_a.png` | phone verify result: development-key line, "Transcript sealed", "Interrupted recording: the durable part is sealed and was verified.", five PASS rows, "15 of 15 checks passed" |
| `p_05_0005_tamper.png` | phone tamper demonstration: FAIL, both development blocks, "VIDEO-02 file FAIL / Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL · 4 fragments" |
| `p_07_about.png` | phone About: the same two DEMO blocks, "Synthetic demo values", "TPM / SE firmware - Not reported" |

Taken, NOT read as pictures (their text was read from the DOM or the view tree and is quoted above):
`w2_02_0026_metadata`, `l2_S_monitor_recording_2`, `p_02_0017_transcript_model` (taken one scroll
below the model block: it shows segments), `p_04_0017_verify_b`, `p_06_settings_security`.

Other files there: `l2_S.log` (Monitor sampler), `op40_*.json`, `op41_*.json`, `ev_list.json`,
`audit_l2.json`, `revision_control.txt`, the two logcat files, `chrome_w2.log`, my scratch scripts
(`init.py`, `man.py`, `mon.mjs`, `fld.py`, `login.sh`, `pane.sh`, `pverify.sh`, `openrow.sh`, copies of
the earlier gates' `cdp.mjs`, `d.py`, `g.py`, `aud.py`, `api.sh`, `pv.mts`).

## 10. Environment as left (09:24)

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 52989, 2 RUNNING PID 70017 - neither restarted nor reset; web 5176 / 5177, Metro, PostgreSQL untouched; stub and its fixture file untouched |
| Seal rig | `OFF` (read; never switched) |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read after everything; never changed) |
| Session | none open; `session/current` = `SES-20261011-0043` SEALED, summary acknowledged from the tablet (seq 671, `DEV-0001`). Next session `SES-20261011-0044`, next item `EV-20261011-0033` |
| **New on lane 2** | **`EV-20261011-0032`** = `SES-20261011-0043`: clean, 47.2 s, 47.2 MB, 20 + 18 fragments, made through the API as OPR-002 with investigator OPR-001 (rows without a device), case `LP/2026/1011-9301`, transcript assembled, revision head 0, manifest `H264_720P30` twice, verify PASS 15 of 15. The lane holds 31 items |
| Alerts | 29; active by `GET alerts`: `ALR-000049` only (known). New: `ALR-000056` INFO `MIC_RATE_AT_LIMIT`, resolved |
| Audit | chain `ok`, 688 rows at 09:23, then my sign-out. Rows of this run from seq 655 |
| Lane 1 | one supervisor helper sign-in / sign-out (page read only) |
| Devices | tablet and phone signed out through the app, on Login, "Core online", "paired as DEV-0001" / "DEV-0002"; `pairing/devices` both online; both reverse rules read back on both; no re-pairing, no lock change, no reboot, biometric not enabled, media volume not touched |
| Helpers | no jar left; my headless browser stopped, its profile removed; no `capture-worker` / `whisper` / `ffmpeg` process |
| My copies | only `.cache/gates/89c/work/`: `0020_untouched`, `0020_drop_last` - **370 MB as `du` counts it** (APFS clones). The lane's store was not written |

## 11. What re-check 94 must know

1. A helper session ended "after 15 min idle" (seq 687, about 09:22) although it had sent GET reads
   seconds before; its last POST was the stop at 09:07:21. Observed once: treat reads as NOT keeping a
   session alive, and sign in again before a late step.
2. An empty Login field shows its hint as the field text in the view tree (8 characters each): judge
   "empty" by `text == hint`, never by printing the text. `.cache/gates/89c/login.sh` does that and
   refuses to type into a field that is not empty or not of the expected kind.
3. On the tablet a list row whose centre is below about y 1500 does not take a tap: scroll it to mid
   screen first. On the phone the Verify control needs the pane scrolled to the tab strip
   (`pverify.sh`).
4. While `ALR-000049` is active the web Monitor draws it as "FAULT / Recording continues" over any
   recording: do not read that banner as a fault of your session; read `GET alerts`.
5. The item pages print the full signature value and hashes: mask hex runs in what you read.
6. `EV-20261011-0032` is a fresh clean item with no export, no revision and three device-made verify
   rows; `EV-20261010-0020` still has four revisions and its export `EXP-000033` in the store.
7. Each Verify press on a device costs about 77 mount warnings; expect the same at every pending
   control of the player and the export sheet.

---
*Generated: 2026-10-11 09:30 WIB*
