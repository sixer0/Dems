---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 89 - M7 milestone gate (evidence package v2), RE-GATE after fix waves H and I
date: 2026-10-10
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`, decisions D193, D212, D219)
tree: 57b80a9 (`git status --porcelain -- apps packages scripts`: 0 lines at the start and at the end)
narrative_tier: 2
status: needs-review
verdict: PASS WITH CONDITIONS (eight conditions, section 1; no blocking item of the first gate is left open where it could be driven)
supersedes: nothing - `12_m7_gate.md` stays the record of the first gate
---

# 12b - M7 milestone gate, re-gate (row 89)

Run window 23:06-23:36 WIB on the standing environment of `initialization/07_gate_environment_wave_i.md`
as changed by re-gates 75 and 81 (lane 2 PID 82871, started 22:57). No product or test file was changed,
no git write, no install, no lane restart, no reset. No local device (`CAM-03` / `MIC-03`) was selected,
pre-checked or started; no attendance variable was set; the fingerprint sensor was never touched and
each biometric offer was answered "Not now"; no lock was set, changed or removed. No recording was
played or viewed: camera files were read as bytes only (box headers of the clear init segment, byte
counts, hashes). No session key file, signing key file or pwfile was opened; the key folder was listed
by name, mode, size and time only. The camera stub, its fixture account and `CAM-04` were not touched.

Surfaces: **W2** = web console lane 2 (REAL_DEVELOPMENT, 5177, headless Chromium over CDP, signed in
with the helper's session cookie), **T** = tablet `emulator-5556` on lane 2, **P** = phone
`emulator-5554` on lane 1 (SIMULATED), **API** = lane 2's Core through 5177, **FILE** = files of a
sealed package read in place, **PV** = the product's verifier (`verifyPackageV2` through `corePorts`,
the code operation 41 runs) started by my scratch `.cache/gates/89b/pv.mts` on a folder COPY under
`.cache/gates/89b/work/`, without a session key.

**One thing differs from the brief and is said first:** the project's offline command
(`npm run evidence:verify-export`, `apps/core-server/cli/verify-export.ts`) verifies an EXPORT
ARCHIVE (a zip made by operation 87), not a package folder, and lane 2 holds no export. No command of
the project verifies a copied package folder. The negative controls were therefore run through PV.
The receiver command itself was not driven on an archive (making an export changes an item to
EXPORTED and is gate 94's subject); its own test file was run once (section 6).

## 1. Verdict

**PASS WITH CONDITIONS.** Read as an auditor, five product-sealed packages (clean, interrupted,
interrupted + resumed, speech with four revisions, and one sealed by me at 23:25) state only what the
Core has: host clock, its own version, `NOT_CONFIGURED` identity, generated sources named as such,
real hashes, a real signature with the development mark; their audit extracts hold only the
session's own rows (0 invented). The media is ciphertext with a clear init segment; a recording is
plaintext on the store only until its seal completes; no key material is in a package. Operation 41
answers 15 of 15 on all five and names `(VIDEO-02, 3)` on the tamper demonstration on API, web and
tablet; of 23 changed copies, 19 failed on the check the spec names and 4 passed: the staged
revision file (by design, with its notice), the unsigned audit extract (the known limit) and two
shortened revision lists (new, G89b-02). The four blocking
items of the first gate are closed where they could be driven.

| # | Condition | Finding | Owner |
|---|---|---|---|
| C-1 | B9 is not met on the evidence detail + verify flow: 467 Reanimated mount warnings on the tablet (one burst per Verify press, 5 of 5, and three at an item opening), 11 on the phone | G89b-03 MINOR (named check FAIL) | coder-execution (mobile: the verify button / item loader), then one logcat re-check |
| C-2 | The web Security & Audit page of the real-capture Core still says "Manifest signature - Ed25519, DEMO device key", "Evidence signing key - DEMO-KEY-EVSIGN-01", "Hardware root key - Hardware-bound - TPM 2.0 (fw 7.2.3.1) - Resident in TPM 2.0, never exported". Every package of this lane is signed with `CORE-KEY-EVSIGN-01` and the lane has no TPM | known as G75c-04 (rated MINOR, D220). **For M7 this is the open remainder of first-gate G89-03 (rated MAJOR there, "to rule before sign-off"): I ask the controller to rule the weight** | controller (ruling) + coder-execution (core-web) |
| C-3 | The phone has never shown a v2 package: `M7-VV-PHONE`, `M7-DEVSRC-EVID-P`, the phone half of the tamper demonstration; and first-gate G89-02 (110 warnings at the phone's hand-over) was not re-driven on the phone | NOT PROVEN (phone is paired to lane 1; the brief allowed one new session) | controller: a phone pass on a real-capture lane (new pairing) or row 95 |
| C-4 | The signed manifest says `tracks[].profile: H264_1080P25` for files whose own init segment says 1280 x 720; the clients repeat "1080p - 25 fps" | G89b-01 MINOR (ruling asked) | spec owner (erratum for field 36) + coder-execution (client labels) |
| C-5 | A package copy whose revision list was shortened (last revision removed, or all four) verifies PASS without the Core, with no notice; the limit is in no section of ev H | G89b-02 MINOR | spec owner (limit + a notice) |
| C-6 | Audit rows of a verify carry no sending device (tablet) and no `operationId`; the failed row names the file, not the fragment | G89b-04 MINOR (ruling asked, class of G75c-09) | controller (ruling) + coder-execution |
| C-7 | Wording: the web seal dialog of a REAL item ends "No DEMO package exists for this item." and names neither the development key nor the sources; the verify result says "decrypted bytes FAIL" for a check that did not run | G89b-05, G89b-06 MINOR | coder-execution (core-web, mobile) |
| C-8 | Still tests only, as at the first gate: one-camera seal, a truncated tail, retry / blocked / UNSEALABLE on the clients, the kept-plaintext alert, the boot sweep acting, every REAL_PRODUCTION refusal, the unreachable-PARTIAL package, the server-backend model line (user's rule) | NOT DRIVEN LIVE | row 95 / user (server backend) |

## 2. Start state (23:06)

| Check | Result |
|---|---|
| `lane.sh status` | lane 1 RUNNING PID 49865 (SIMULATED), lane 2 RUNNING PID 82871 (REAL_DEVELOPMENT); web 5176 / 5177, Metro 8081, PostgreSQL 4432 listening |
| `GET health` lane 2 | `dems-core-server 0.2.0`, `ready {database true, engine true}`, `ws.clients 1` |
| Devices | both attached, awake, `isKeyguardShowing=false`, reverse rules 4421 / 4422 intact, both on Login "Core online / paired as DEV-0001" |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` |
| Session | none open; `session/current` = `SES-20261010-0032` SEALED |
| Store `.data/media/dems_lane_2/sessions/` | 10 package folders (2 demo + `-0024`..`-0028`, `-0030`..`-0032`), `.capture-session` / `.sealing` / `.transcriber/sessions` EMPTY, no `.quarantine`; 680 MB |
| Audit | chain `ok`; my rows start at seq 212 |

## 3. Entry condition - the blocking items and the MAJOR of the first gate

| First-gate item | State | Evidence of this run |
|---|---|---|
| B-1 / G75-01 invented integrity rows in the sealed extract; "Encryption Active AES-256 Passing" during a plaintext recording | **CLOSED** | Five extracts read row by row (4.1): 4 to 5 rows each, every one a row of that session (`SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED {timeSource RTC}`, `AUDIO_SOURCE_SWITCHED`, `RECORDING_STOPPED`, `FAULT_RAISED`, `RECOVERY_STARTED`); no `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`. W2 Monitor at 23:24:11 while `SES-...-0033` recorded: "Capture - Recording. The first fragment is durable on the evidence volume", "Media Protection - Not encrypted during recording. The media is encrypted when the session is sealed - Standby", "Audit Log Hash Chain", "Time Source - Core system clock" (`w2_12`) - at that instant `VIDEO-01.mp4` on the store was 6.8 MB of plaintext with 6 `moof` boxes |
| B-2 / G89-01 simulator values in the SIGNED manifest | **CLOSED** for the fields it named | 4.1: `timeSource {source RTC, state HOST_SYSTEM_CLOCK, fallbackOrder []}`, `device.softwareVersion 0.2.0` (= `GET health`), `deviceId` / `name` / `serialNumber` / `hardwareUuid` all `NOT_CONFIGURED`, `tracks[].model "Generated test source (no camera)"`, `firmware "None (generated test source)"` in all five manifests; T Summary chips "Host system clock" (view tree). Code `sealing-host/session-reader.ts:105, :107, :112, :380, :382`; `wave-h-a-manifest-facts.test.ts` and `wave-h-z1-installation-identity.test.ts` run once by me (section 6). One value of the same class is left: G89b-01 |
| B-3 / G75-03 (+ G75-08) an interrupted recording not named | **CLOSED** | W2 list rows and item header of `EV-...-0017` / `-0018`: "Sealed - recording was interrupted / Cause: CAPTURE_FAULT" (`POWER_FAIL`); T list rows (`evidence-row-interrupted-...`) and detail (`evidence-detail-interrupted`); op 40 `interrupted true`, `interruptedCause`; custody `RECORDING_INTERRUPTED` + "Durable prefix sealed (interrupted)"; verify line on W2 and T. The cause words are codes (G75c-03, known, ruled D218 (3)) |
| B-4 / G89-02 B9 at Monitor -> Finalizing -> Summary | **CLOSED on the tablet**; phone NOT RE-DRIVEN (C-3) | T, session `SES-...-0033`: logcat cleared at the stop (23:24:52), dumped at 23:25:32 after the Summary: **0** lines "Unable to find SurfaceMountingManager" (`logcat_T_stop_to_summary.txt`, 474 lines in all; frames `seq/tS_16` Finalizing, `tS_19` 41 %, `tS_22` Summary). The same warning class is NOT gone from the app: G89b-03 |
| G89-03 MAJOR a real signature labelled "simulated" / "DEMO KEY" | **CLOSED on the three surfaces it named**; one surface left (C-2) | W2 Hash & Integrity: "Manifest signature (Ed25519, Core key CORE-KEY-EVSIGN-01)" + "Signed with a DEVELOPMENT key - not a production signature" (`w2_02`); T detail "MANIFEST SIGNATURE (ED25519, CORE KEY CORE-KEY-EVSIGN-01)", `evidence-signature-key-class-DEVELOPMENT`; T Summary "Signature - Ed25519, Core key CORE-KEY-EVSIGN-01" + the development line (`summary-signature-real`, `t2_10`). A simulated item keeps "SIGNATURE (SIMULATED)" (P, lane 1; T, v1 demo item) |

Entry condition: **met** with C-2 put to the controller. Review 88's nine findings were confirmed at
the first gate on `f293221`; `git log -1` of `sealing`, `sealing-host`, `evidence-verify`,
`evidence-export`, `packages/shared/src/evidence-verify`, `evidence-package` is `57b80a9`, whose
whole-suite record is `test/09_precommit_wave_i.md` (section 6).

## 4. Checks

### 4.1 The package as an auditor (FILE)

Items: `EV-20261010-0015` (`SES-...-0025`, clean, one microphone switch, made on the tablet),
`-0017` (`-0027`, interrupted: worker killed), `-0018` (`-0028`, interrupted: Core stopped, sealed by
the boot resume), `-0020` (`-0031`, speech, four revisions), and `-0022` (`-0033`, sealed by me).

| Field group | Result | What the five manifests say |
|---|---|---|
| Identity (1-8, 126) | PASS | `schema dems.evidence-manifest/2`, `manifestVersion 2`, `integrity REAL`, `demo false`, `developmentSources true`, notice "DEVELOPMENT - sealed by a Core in development capture mode; see the source classes of this manifest." The capture operation (`REAL_DEVELOPMENT`) is no field: the notice and the classes carry it |
| Timeline (9-19) | PASS | `timezone +07:00`; `sealedAt` = `signature.signedAt` in all five (PE-WI-25); clean: `stoppedAt` = `durableEndMs`, `interrupted false`; interrupted: `stoppedAt null`, `interrupted true`, `recordingDurationMs` = the longer file's media end (31122 / 26537); time source `RTC` / `HOST_SYSTEM_CLOCK` / `[]` (PE-WI-26) - no GNSS, no lock claimed |
| Device (20-27) | PASS | four `NOT_CONFIGURED` (PE-WH-08, PE-WI-27; the boot warns `INSTALLATION_IDENTITY_NOT_CONFIGURED`), `softwareVersion 0.2.0`, certificate subject `CN=CORE-KEY-EVSIGN-01,OU=DEVELOPMENT KEY - NOT FOR PRODUCTION,O=DEMS Core`; `device.certificate.sha256` = `signature.certificate.sha256` = SHA-256 of the certificate's DER (`openssl x509 -outform der`, `8350f180...`), the same certificate in all five |
| Operator, subject (28-33) | PASS | `OPR-001` / INVESTIGATOR, the session's subject and case as entered |
| Tracks (34-51, 124, 127-128) | PASS with G89b-01 | 2 records, `CAM-01` / `CAM-02`, `sourceClass FAKE`, model / firmware by adapter kind (PE-WI-28), `codec H264` (init segment: `avc1`), `fragmentCount` = `files[].fragments.length`, `bytes` = the file size on disk, `keyframeAligned true`, `firstVideoSamplePts` 141915 / 277494 at 90000, `avOffsetMs null`. **`profile H264_1080P25` is the configured profile, not the file's (G89b-01).** `clockOffsetMs 0` in all ten records: the known limit of field 40 (PE-WI-29) - a 0 that does not say "measured" |
| Audio (52-61, 125) | PASS | `AUDIO-01` in both files; `-0015`: `MIC-01 PRIMARY START 21-26321`, `MIC-02 STANDBY MANUAL 26321-60741 switchedBy OPR-001`; the others one interval; every `sourceClass FAKE`; `codec "AAC-LC mono 48 kHz"` is a constant (PE-WI-30) and agrees with the init segment (`mp4a`, 1 channel, 48000) |
| Fragments (62-78) | PASS | seq 1..N, first offset 1249, last end = file size, every record `gcmIv` 24 hex, `gcmTag` 32 hex, `keyId KID-<its own session>`, IVs distinct inside each file, `sha256Plain` and `prefixSha256` on every record; `interrupted true` on 12 + 11 and 11 + 10 fragments of the two interrupted items, `false` elsewhere; `truncated false` everywhere (no torn tail was produced) |
| Transcript (79-94, 121-123) | PASS | `state ASSEMBLED`, `failedChunks 0`, `backendUnreachable false`, snapshot `{enabled true, backend cpu-local, model ggml-large-v3-turbo, diarization true, revision 7 / 9 / 11}` (11 = the lane's current revision for my session), model `name ggml-large-v3-turbo`, `version large-v3-turbo` (declared by the installation, PE-D9-01), `quantisation f16`, `modelSha256 1fc70f77...` equal to the transcript document's header; `speakerState UNAVAILABLE` (header `speaker_reason ENGINE_NOT_CONFIGURED`). `revisionHead 0` in every manifest, also in `-0020` whose revision list holds four: the manifest is sealed before any revision exists (see G89b-02, G89b-08) |
| Sealing steps (95-101) | PASS (as PE-WI-32) | three entries, `attempt 1`, `status DONE`; `CLOSE_TRACKS.checkpoint {interrupted, tracks 2, truncatedTails 0}`; no `endedTracks` (no camera was given up) |
| Signature (102-111) | PASS | `Ed25519`, `CORE-KEY-EVSIGN-01`, `simulated false`, `covers` = the rule of ev B.10 |
| Audit extract | PASS | only the session's rows; **the tablet-made sessions carry `deviceId DEV-0001` on every operator row and `sendingDeviceId` on the switch row** (`-0015` seq 100-104, `-0020` seq 160-165); API / web sessions `null`; interrupted: `FAULT_RAISED {kind CAPTURE_FAULT, reason WORKER_KILLED}` "The capture worker process was killed." and `{kind POWER_FAIL, coreNotRunning true}` "The Core was not running while this session was active. It does not know why it stopped.", then `RECOVERY_STARTED`. See G89b-07 for the device id on the fault rows |
| "Interrupted / resumed stated" | PARTIAL by design | interrupted: stated (signed). **Resumed is not a manifest fact** (`-0018` reads like `-0017`; `attempt 1`): only operation 83 said it. The cause of an interruption is in the unsigned extract and in op 40 only (G89b-08) |
| Worker version | not a manifest field | the boot log states `capture-worker/0.5.0`; the clear init segment carries the muxer tag `Lavf63.1.102` (G89b-08) |

On disk:

| Check | Result | Evidence |
|---|---|---|
| Folder contents and modes | PASS | each of the five: manifest, `signature.sig`, certificate, audit extract, `fragments/VIDEO-01.mp4`, `VIDEO-02.mp4`, `fragments.json`, `transcript/` (json, srt, vtt, revisions); every folder `drwx------`, every file `-rw-------`; a `find` over the store for anything else or any other mode: nothing but the three empty scratch folders |
| Init segment clear, fragments ciphertext | PASS | 5 files of 4 packages: bytes 0..1249 parse exactly as `ftyp` + `moov` (two `trak`: `avc1` 1280 x 720 at timescale 90000, `mp4a` at 48000) + `mvex` + `udta`; at offset 1249 no box header; in the rest of the file 0 `moof`, 0 `mdat`, 0 `mfhd`, 0 `trun`, 0 `avcC`; byte entropy of the first 4 MB after the init segment 8.0000 bits per byte |
| D147: plaintext until the seal completes, none after | PASS (driven) | `SES-...-0033` while RECORDING: `SESSION-.../VIDEO-01.mp4` and `VIDEO-02.mp4` (0600) with `ftyp` and `moof` boxes in clear, `.capture-session/<id>.json`, `.transcriber/sessions/<id>/tap.pcm`; no key file of the session yet. After SEALED (10 s later): the two recordings gone, `fragments/` and `transcript/` there, the three scratch folders empty, no `.quarantine`, no `capture-worker` / `whisper` / `ffmpeg` process |
| No key material in a package | PASS | PEM blocks in the 10 certificate files: 10 x `BEGIN CERTIFICATE`, nothing else; no `PRIVATE KEY` text in any json / pem / sig / jsonl / srt / vtt of the store; member names of a manifest matching key / secret / wrap / priv / token / pass: `keyId`, `keyframe`, `keyframeAligned` only; `signature.sig` members: algorithm, certificate, certificateSha256, digestAlgorithm, keyId, purpose, schema, signature, signedAt, signedDigest, signedFile |
| Session keys (first-gate G89-06) | PASS | key folder listing (names, modes, sizes, times only): one `KID-<sessionId>.key` (40 bytes, 0600) and one `.blob` (29 bytes) per real session, each dated at ITS session's stop (`-0025` 22:03:57 ... `-0033` 23:24); the two demo keys dated at the reset (21:49); no key of a session the lane does not hold. `wave-h-a-session-key-no-reuse.test.ts`, `wave-i-a1-session-key.test.ts` run once (section 6) |

### 4.2 Verify

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Op 41 on `-0015`, `-0017`, `-0018`, `-0020`, `-0022` | API | PASS | each `overall PASS`, V-01..V-15 all `PASS` (V-05 run: the Core has the key), `manifestOk`, `signatureOk` true, `signature {developmentKey true}`, `sources {code DEVELOPMENT, development true}` with the classes, `notices [AUDIT_EXTRACT_NOT_SIGNED]` only, `interrupted true` exactly for `-0017` / `-0018`, `transcriptState {code READY, sealedState ASSEMBLED}`, `transcriptModel` with "version large-v3-turbo (declared by the installation)". `REVISION_APPEND_PENDING` absent on all (true: no staged file exists). Answers kept as `op41_*.json` |
| Tamper demonstration `EV-20261009-0005`, clean `EV-20261008-0001` | API | PASS | `overall TAMPERED`: V-04 `FRAGMENT_HASH_MISMATCH (VIDEO-02, 3)` + `FILE_HASH_MISMATCH`, V-06 `CHAIN_BROKEN (VIDEO-02, 3)`, V-08 `FRAGMENT_TAMPERED (VIDEO-02, 3)`, V-05 `SKIPPED (BLOCKED)`, 11 PASS, `manifestOk` / `signatureOk` true; the clean one PASS 15 of 15 |
| The same on the web | W2 | PASS | `-0015`: "PASS ... DEVELOPMENT SOURCES - this package was not recorded from production devices." with four entries first, "Signed with a DEVELOPMENT key - not a production signature", "Transcript sealed", two file rows "Stored bytes PASS - decrypted bytes PASS - fragment chain PASS" 25 / 23 fragments, "15 of 15 checks passed", "Not covered by the package signature - Audit extract: present, NOT covered by the package signature." (`w2_03`). `-0017` / `-0018`: the same + "Interrupted recording: the durable part is sealed and was verified." (`w2_04`). `-0020`: PASS, 37 / 38 fragments. `-0005`: "FAIL ... VIDEO-02 file FAIL ... Where it failed - VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3) ... 11 of 15 checks passed", V-05 "Not run: an earlier check failed" (`w2_07`); no bundled v1 panel under it |
| The same on the tablet | T | PASS | `-0017`: `evidence-verify-last-PASS`, `evidence-v2-sources-line` first with three entries, the development-key line, "Transcript sealed", `evidence-v2-interrupted`, four result rows, "15 of 15 checks passed" V-01..V-15, `evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED`. `-0020`, `-0015`: PASS 15 of 15. `-0005`: "FAIL: VIDEO-02 does not match the sealed manifest", `evidence-v2-fragment-VIDEO-02-3`, 11 of 15 (`t2_05`) |
| A v2 package on the phone | P | **NOT PROVEN** (C-3) | lane 1 holds 15 items, 0 of them v2 |
| Copy, untouched (4 packages) | PV | PASS | `overall PASS`, V-05 `SKIPPED (KEY_UNAVAILABLE)`, 14 of 15 PASS, notices `[AUDIT_EXTRACT_NOT_SIGNED]`, `interrupted true` for the two interrupted copies; report lines begin with the development-sources block and the development-key line |

Negative controls, each on its own COPY (APFS clone) of `-0017` unless said, anchored to the Core's
recorded manifest hash and certificate hash; full output `.cache/gates/89b/negative_controls.txt`:

| Change to the copy | Outcome | Check and code |
|---|---|---|
| one bit in fragment seq 7 of `VIDEO-01` (copy of `-0015`, clean) | `TAMPERED`, 11 of 15 | V-04 `FRAGMENT_HASH_MISMATCH (VIDEO-01, 7)` + `FILE_HASH_MISMATCH`; V-06 `CHAIN_BROKEN (VIDEO-01, 7)`; V-08 `FRAGMENT_TAMPERED (VIDEO-01, 7)`; every other check PASS; one failed fragment listed |
| the same on the interrupted copy | `TAMPERED` | the three above + V-12 `INTERRUPTED_PREFIX_NOT_VERIFIED (VIDEO-01)` |
| one bit in the clear init segment of `VIDEO-02` | `TAMPERED` | V-04 `FILE_HASH_MISMATCH (VIDEO-02)` (no fragment named: the init segment is in no fragment) + V-12 |
| manifest: last digit of `caseNumber` | `TAMPERED` | V-03 `MANIFEST_HASH_MISMATCH`; `sources NOT_TRUSTWORTHY`, `developmentKey null` |
| manifest: time source edited to `GNSS` / `LOCKED` | `TAMPERED` | V-03 `MANIFEST_HASH_MISMATCH`; the same two |
| manifest: first byte flipped | `UNREADABLE` | V-01 `MANIFEST_UNREADABLE`; V-02..V-13, V-15 `SKIPPED (BLOCKED)` |
| one bit in a segment text of `transcript.json`; one bit in `transcript.srt` | `TAMPERED` | V-10 `TRANSCRIPT_HASH_MISMATCH` naming the file |
| one bit in the `to` text of revision 2 (copy of `-0020`) | `TAMPERED` | V-11 `REVISION_BODY_HASH_MISMATCH revisionNo 2` |
| last fragment cut off `VIDEO-01`; the bytes of fragment 5 removed | `TAMPERED` | V-04 `FILE_SIZE_MISMATCH` + `FRAGMENT_BYTES_TRUNCATED (12)` / `FRAGMENT_HASH_MISMATCH (5..12)`; V-06 `CHAIN_BROKEN` from 12 / 5; V-08 |
| `fragments/VIDEO-02.mp4` removed | `MISSING` | V-04 `CAMERA_FILE_MISSING`; V-14 `DECLARED_FILE_MISSING` |
| `notes.txt` added; `fragments/VIDEO-03.mp4` added | `TAMPERED` | V-14 `UNEXPECTED_FILE` naming it |
| one bit in a `gcmTag` of `fragments.json` | `TAMPERED` | V-02 `FRAGMENTS_JSON_MISMATCH` |
| first digit of the signature in `signature.sig` | `TAMPERED` | V-09 `SIGNATURE_FILE_MISMATCH`; `developmentKey null` |
| one bit in the certificate file | `TAMPERED` | V-13 `CERTIFICATE_HASH_MISMATCH` x2 + `CERTIFICATE_UNREADABLE`; V-09 `SIGNATURE_KEY_UNAVAILABLE`; V-11 `REVISION_CERTIFICATE_MISSING` |
| `transcript.vtt` removed; the audit extract removed | `MISSING` | V-10 `TRANSCRIPT_FILE_MISSING` + V-14; V-14 `DECLARED_FILE_MISSING` |
| `transcript/transcript-revisions.json.next` added (copy of `-0020`) | `PASS` + notice | `REVISION_APPEND_PENDING` appears, V-14 does not fail (ev H.7 item 4) - the notice is shown exactly where the file is |
| last audit row removed | `PASS` + notice | the stated limit R88-06 (`AUDIT_EXTRACT_NOT_SIGNED`) |
| **last revision removed; all four revisions removed (copy of `-0020`)** | **`PASS`, no notice** | **G89b-02** |

The lane's own store was not written: SHA-256 of the lane's `-0027/fragments/VIDEO-01.mp4` after all
controls = the value operation 40 states (`603313fa...`).

### 4.3 The surfaces' wording about the package

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Development-source mark | W2, T | PASS | badge "Development source" on the W2 list rows of the eight real items (page 1) and on every v2 header opened (`-0015`, `-0017`, `-0018`, `-0020`, `-0005`); on the T list rows and details, the two v2 demo items included (`t2_05`); none on a v1 item |
| Development-key wording | W2, T | PASS | before a verify, on the item's signature entry; after it, as the second block of the result; T Summary under the hashes |
| Interrupted wording | W2, T | PASS | section 3, B-3 |
| Time / signature / TPM on the evidence detail and the verify result | W2, T, P | PASS | no line about a TPM, secure element, GNSS or a locked clock on any of them for a real item; the time shown is "UTC+07:00"; T Summary chips "Host system clock" |
| The same question on the Security & Audit page | W2 | **known, open: C-2** | `w2_11`: three "Not reported" rows ("This Core does not read a TPM or the Secure Boot state.") beside "Evidence encryption - AES-256-GCM per session - Active", "Manifest signature - Ed25519, DEMO device key - Active", "Secure timestamp - RTC holdover, not locked", "Signed firmware - v2.4.1 signature verified", "Device certificate DEMO - CN=DEMS-IR-01 - fingerprint 76:0B:E9:29..." (not the certificate `8350f180...` that signs this lane's packages), "Evidence signing key DEMO - DEMO-KEY-EVSIGN-01", "Hardware root key - Hardware-bound - TPM 2.0 (fw 7.2.3.1) - Resident in TPM 2.0, never exported" |
| "No DEMO package exists for this item." (G75c-11) | W2 | judged: **G89b-05** | `w2_13`, dialog of `SES-...-0033` |
| Transcript model shown nowhere (G81b-06) | W2, T | known, unchanged | both panels say only "Transcript sealed"; op 41 answers the model line |
| v2 item never shows v1 rows; no bundled v1 values on a v2 demo item (G89-04, G89-09) | W2, T | PASS | before a verify: "SEALED VALUES OF THIS ITEM / CORE RECORD", two "sealed file" rows, manifest hash, version, signature; no AUDIO row, no "Bundled demo package", no `DEMO-KEY` on `-0005` |
| v1 sources line (G89-05) | W2, T, P | PASS | "Sources: not recorded (v1 package)" on `EV-20261010-0013` (W2, P) and `EV-20261008-0002` (T, `evidence-sources-v1`); the v1 six-row form and "Bundled demo package" unchanged |
| B9, hand-over Monitor -> Finalizing -> Summary | T | PASS | 0 lines (section 3, B-4) |
| B9, evidence detail + verify flow | T | **FAIL: G89b-03** | logcat cleared 23:16:42, dumped 23:20:16 |
| The same | P | **FAIL: G89b-03** | 11 lines (simulated item, lane 1) |

### 4.4 Development-key rules

| Check | Result | Evidence |
|---|---|---|
| The mark is derived from the certificate that verified | PASS | `packages/shared/src/evidence-verify/verify.ts:1091` (`developmentKey: trusted && certificateSubject !== null ? isDevelopmentKeySubject(...) : null`), `report.ts:38`; V-13 holds manifest fields 25 / 26 to the certificate (`verify.ts:285-286`, `CERTIFICATE_SUBJECT_MISMATCH`). Live: `true` on every PASS above; `null` and `sources NOT_TRUSTWORTHY` on the manifest, signature and certificate controls of 4.2. `packages/shared/test/evidence-verify-development-key.test.ts` (`:96` verified + mark = true, `:105` control false, `:112` certificate says DEVELOPMENT and field 25 omits it = V-13 fails, answer null) run once: 3 files, 42 passed |
| What a REAL_PRODUCTION Core refuses (tests only; no lane was reconfigured) | PASS (tests) | boot with a development signing key: `capture/boot/__tests__/checks.test.ts:292-294` (`CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`); a seal of all-PRODUCTION sources with a development key: `sealing/__tests__/pipeline-development-key.test.ts:39-47` (`SIGN_MANIFEST` fails `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES`, nothing signed; rule `pipeline.ts:793-794`); boot without the installation identity: `sealing-host/__tests__/wave-h-z1-installation-identity.test.ts:96-113`; the camera stub: `capture/fence/__tests__/development-discovery.test.ts:33` (`DEV_CAMERA_STUB_IN_PRODUCTION`) - these four files run once by me. The speech microphone outside development capture (`fence/__tests__/fake-mic.test.ts:66, :157`): not run by me, inside the unit run of `test/09` |
| The stated limit | unchanged | a self-signed certificate in the folder: without the Core's certificate hash received out of band a re-signed package verifies (ev H.5, H.6; first gate section 0). Not re-driven |

### 4.5 RBAC and audit rows of a verify

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Ops 39 / 40 / 41 per role | API | PASS (as the registry says: `EVIDENCE_VIEW`, `modules/evidence/index.ts:8`) | TECHNICIAN, INVESTIGATOR, SUPERVISOR: 200 on all three operations for `-0020` and for `-0005`; op 40 `access`: technician `{play false, readTranscript false, export false}`, investigator `{true, true, false}`, supervisor `{true, true, true}`. No session: 401 `NOT_SIGNED_IN`; no origin: 403 `ORIGIN_NOT_ALLOWED`; unknown item: 404. Verify is not held to the case scope: the technician outside the case verifies and reads the package facts (hashes, signature, model line), not the recording or the transcript |
| The same on the clients | W2, T | PASS | technician W2: "You are not permitted to play this recording." / "...to read this transcript.", Play and Open playback disabled, Verify runs and shows the full result (`w2_09`); technician T on `-0021`: the two sentences, Play disabled, Verify PASS 15 of 15 (`t2_07`). The Export button is ENABLED for the technician and the investigator on W2 and T although `access.export` is false: NOTE G89b-09, gate 94's |
| Audit row of a verify | API | PASS for what the row holds; **G89b-04** for what it lacks | `EVIDENCE_VERIFIED` INFO `{manifestOk, signatureOk, failedTracks ""}` / `EVIDENCE_VERIFY_FAILED` CRITICAL `{eventKind TAMPER, ..., failedTracks "VIDEO-02"}` with actor and `evidenceId`; one row and one custody entry per run. No `operationId` member; the five rows of the tablet's runs (seq 237-241) have `deviceId null` while the tablet's sign-in row (seq 236) has `DEV-0001` |
| Chain | API | PASS | `audit/chain`: view and stored `ok`, 258 rows checked at the end |

### 4.6 Spot-checks of what the first gate passed (one per group)

| Group | Result | Evidence |
|---|---|---|
| 4.1 package contents | PASS | 4.1 above (five packages instead of two, with a transcript) |
| 4.2 tamper | PASS | 4.2 |
| 4.3 interrupted seal verifiable | PASS | `-0017` op 41 PASS `interrupted true` on API, W2, T |
| 4.4 recovery | PASS (by what is there) | `-0018` was sealed by a boot resume and the lane has been restarted twice since: op 41 still PASS, the store holds no plaintext. No restart by me |
| 4.5 reset guard | NOT RE-RUN | a reset would remove the items gate 94 needs; `db/reset/__tests__/` in `test/09` |
| 4.6 progress forward-only | PASS | session `-0033`: op 83 (150 ms poll) 0, 16, 41, 100, `resumed false`, steps only advance, `startedAt <= completedAt` on all six (first-gate G89-08 closed); W2 dialog 0, 16, 41, 50, 100 %; T frames 0 %, 41 %, Summary |
| v1 item unchanged | PASS | 4.3 |

## 5. Findings of this re-gate

| ID | Severity | What | Steps / evidence | Spec / ruling |
|---|---|---|---|---|
| **G89b-01** | MINOR (ruling asked; same class as G89-01, smaller) | The signed manifest states `tracks[].profile: "H264_1080P25"` for both files of all five packages; the files' own clear init segment says 1280 x 720 (`tkhd` and the `avc1` entry), and the generator is `testsrc2=size=1280x720:rate=30` (`capture/adapters/local/camera-helper-args.ts:51`). The value is the selector's configured profile (`session-reader.ts:347`, from `captureConfig`). The clients state it as a fact of the recording: op 40 `profileId STANDARD_1080P25`; W2 Monitor "Recording Profile - Standard (1080p / 25 fps)" and tiles "1080p - 25 fps"; T Session Live "1080p - 25 fps" (`t2_09`). The W2 tiles also still read "Camera 1 - CAM-01 - Dual-lens IP camera DL-2" for the generated source the manifest calls "Generated test source (no camera)" | 4.1; `w2_12`, `t2_09` | ev B.4 field 36 "capture config snapshot" - as built it IS that, but no erratum says "requested, not measured" as PE-WI-29 / -30 do for fields 40 and 53, and the manifest has no field with the file's real picture size. Either an erratum + neutral client wording, or the profile of a generated source worded as what it is |
| **G89b-02** | MINOR | A copy of `EV-...-0020` whose `transcript-revisions.json` was rewritten without its last revision, or with an empty list, verifies `PASS` 14 of 15 through the product's verifier with no notice. Each revision is signed and chained to its parent, so a revision cannot be altered or inserted (V-11 control above), but the END of the list is held by nothing in the folder: the manifest's `revisionHead` is 0 for ever. On the Core the count is held to the database (`verify.ts:661-662`, `REVISION_COUNT_MISMATCH`; `evidence-verify/index.ts:338`) | 4.2 last row | ev H lists the audit extract as not covered and gives it a notice; the revision list's completeness is the same kind of limit and is neither stated nor announced. For an export the export manifest covers the file (gate 94) |
| **G89b-03** | MINOR (named check FAIL; class and rating of G75c-02) | B9 on the evidence detail + verify flow. Tablet, 23:16:42-23:20:16: **467** lines `Reanimated: ... RetryableMountingLayerException: Unable to find SurfaceMountingManager for tag` (76,423 warning lines with their stack traces), 8 tags, one burst each: 23:17:31 x77, 23:18:12 x77, 23:18:48 x76, 23:19:25 x79, 23:20:00 x21 = the five Verify presses (the instants of the five "Last verification" lines), and 23:16:57 x31, 23:17:57 x79, 23:18:34 x27 at the opening of an item. The stack ends in `com.horcrux.svg.VirtualView.setClientRect`: an animated SVG glyph removed while its animation is still driven - the mechanism note 134 names for the kit Spinner. Phone: 11 lines (2 at the opening, 9 at the Verify). No empty frame or visual fault was seen. App lines at level E: one, `Surface: freeAllBuffers` (platform) | `logcat_T_evidence_verify.txt`, `logcat_P_evidence_verify.txt` | row 87's criterion (`42_m7_clients_verify.md` section 6): 0 lines |
| **G89b-04** | MINOR (ruling asked; class of G75c-09) | The audit rows of a verify sent by the paired tablet carry no device (`deviceId null`, seq 237-241), no `operationId`, and the failed row names only the file (`failedTracks "VIDEO-02"`) while the custody entry says "Mismatch: VIDEO-02 fragment 3". From the audit trail nobody can tell a verify made on the tablet from one made at the console | 4.5; `packages/shared/src/sim/session-machine.ts:1633-1640` | D216 (2) "every audit row of an action sent by a paired device" |
| **G89b-05** | MINOR (G75c-11 judged) | The web "Evidence sealed" dialog of a REAL item shows "Manifest SHA-256", a chip "LIVE", the first 24 hex and "No DEMO package exists for this item." The sentence is true and it is demo vocabulary on real evidence (the item page was freed of it by D204); the dialog that announces the seal names neither the development key nor the development sources, which the tablet's Summary and the item page do | `w2_13` | D204: a real item's surfaces carry no DEMO wording; ev D.1: the mark is shown where the sealed item is shown |
| **G89b-06** | MINOR | On the tamper demonstration the file row reads "Stored bytes FAIL - decrypted bytes FAIL - fragment chain FAIL" on W2 and T while V-05 of the same result reads "Not run: an earlier check failed": the decrypted bytes were not checked | `w2_07`, `t2_05` | ev D: V-05 skipped is not a failure of the plaintext |
| G89b-07 | NOTE | A package names its Core twice: the manifest says `NOT_CONFIGURED` four times; the `FAULT_RAISED` rows of its own audit extract say `deviceId: "DEMS-IR-01"` (the stored device record; `session-reader.ts:53` states that audit rows and clients keep it). The clients show "Device ID DEMS-IR-01 / Interview Room 1" in the web header and "Core: DEMS-IR-01" on the Login, and every item "Location: Interview Room 1" | `-0027`, `-0028` extracts; `w2_01` | PE-WH-08 explains the manifest side only |
| G89b-08 | NOTE | What the signed manifest does not state: that a seal was resumed after a restart; the cause of an interruption (extract and op 40 only); the capture worker's version; the capture operation as a field. `transcript.revisionHead` stays 0 in a package that holds revisions | 4.1 | for the spec owner's list of limits (ev H) |
| G89b-09 | NOTE (for gate 94) | The Export button is enabled for the technician and the investigator on W2 and T while op 40 answers `access.export: false`. Not pressed | 4.5 | - |
| G89b-10 | NOTE | No command of the project verifies a package FOLDER; `evidence:verify-export` reads an export archive only (said at the top). The receiver command was not driven on an archive at this gate | `cli/verify-export.ts`, `evidence-export/receiver-cli.ts:1-26` | D205 |
| G89b-11 | NOTE | (a) W2 Monitor at 1440 x 900: the rows of the "Evidence Integrity" card overlap ("Durable Fragments" drawn over the next lines, `w2_12`). (b) Phone Home: a tap on the avatar showed nothing in the view tree and the next tap on "More" did not navigate; the second did (`p1_02`). Cause not looked for | - | - |

Known findings met again, not re-reported: G75c-01 (header "CRITICAL / Core was not running", tablet
"Recording Blocked", Monitor banner "FAULT / Recording continues" during my healthy recording),
G75c-03 (cause codes), G75c-04 (C-2), G75c-05 ("This step: about 1678 s left" / "1680 s"), G75c-08
(9 error-level `ASSEMBLY_REFUSED / TRANSCRIPT_NOT_COMPLETE` lines during my seal), G75c-09
(`SUMMARY_ACKNOWLEDGED` of the tablet's Back without a device, seq 253), G81b-01 (revision 4 of
`-0020` with its false `from` is in the package and passes V-11 - it is correctly signed), G81b-04
(`to_ms null` in the transcript header of the interrupted items), G81b-06, G81-11 (step durations on
the Summary and the dialog; no figure repeated here), G89-12 (track `durationMs` 60795 against a
wall span of 60263 on `-0015`), G89-13 (tablet still at 41 % two seconds after the Core had sealed).

## 6. Regression and quality (`M7-RG-*`, `M7-QA-1`, kill matrix, seal e2e)

Mapped to `test/09_precommit_wave_i.md` (run on the tree that became `57b80a9`) and
`implementation/138_pin_moves_wave_i.md`:

| Check | Result | Record |
|---|---|---|
| typecheck + lint, 7 workspaces | PASS | `test/09` rows 1, 2 |
| shared 2570; capture-protocol 31; core-server unit 6517; core-web 2069; transcriber 561; mock-core 19 | PASS | `test/09` rows 3-4, 6, 8 |
| core-server db 2419 passed, 3 failed; mobile 2692 passed, 1 failed | the 4 reds were stale pins; moved in note 138 and those three files re-run green (51 + 10 tests). **The whole db and mobile suites were NOT run again after the pin moves** (D219: row 95) | `test/09` rows 5, 7; note 138 |
| Kill matrix 35 of 35; seal e2e 3 of 3; development-session e2e 2 passed | PASS | `test/09` rows 9-11 - this closes item 1 of the first gate's "not covered" (they had not run on the committed tree) |
| The offline command's tests | PASS | `apps/core-server/src/evidence-export/__tests__/receiver-cli.test.ts`, run once by me |

Run by me, once, now (logs `.cache/gates/89b/tests_core_unit.log`, `tests_shared.log`): core-server
unit, 8 files (`sealing/__tests__/pipeline-development-key`, `capture/boot/__tests__/checks`,
`sealing-host/__tests__/wave-h-z1-installation-identity`, `wave-h-a-manifest-facts`,
`wave-h-a-session-key-no-reuse`, `wave-i-a1-session-key`, `evidence-export/__tests__/receiver-cli`,
`capture/fence/__tests__/development-discovery`): `Test Files 8 passed (8) / Tests 111 passed (111)`;
shared, 3 files (`evidence-verify-development-key`, `evidence-verify-sources`, `evidence-verify`):
`3 passed / 42 passed`. Nothing else was run: no whole suite, no db file, no kill matrix, no e2e
(the lanes are up).

## 7. First-gate findings and open points: state

| Item | State |
|---|---|
| G75-01 (B-1), G89-01 (B-2), G75-03 / -08 (B-3) | closed |
| G89-02 (B-4) | closed on the tablet's hand-over; phone not re-driven (C-3); the class lives on in G89b-03 |
| G89-03 | closed on W2 item page, T detail, T Summary; remainder = C-2 |
| G89-04, G89-09 | closed (W2, T) |
| G89-05 | closed (W2, T, P) |
| G89-06 | closed (key listing; two test files) |
| G89-07 | closed: `.capture-session` is empty after every seal (log `SEALING_CAPTURE_FACTS_REMOVED`) |
| G89-08 | closed: step instants monotonic in op 83; `sealedAt` defined by PE-WI-25, the three-step list by PE-WI-32 |
| G89-10 | open (NOTE, docs): the spec still says "its sha256" without "of the DER" |
| G89-11 | not re-driven (no simulated seal on the phone) |
| G89-12, G89-13 | unchanged (NOTE) |
| G89-14 | G75-05 closed (`reason WORKER_KILLED` on the row); G81-10 closed on the item page (dialog: G89b-05); the phone still says "this tablet shows it as it is" (`p1_01`); R88-21 not re-driven |
| C2 (field 40) | unchanged: 0 in ten track records; the limit is now in the spec (PE-WI-29) |
| C3 (a camera given up) | built (`endedTracks`, PE-WI-31; `wave-h-a-camera-end.test.ts`), not drivable with generated sources |
| First-gate "not covered" 1 | closed by `test/09` |
| 2, 3 | still tests only (C-8); a resumed seal as the clients show it: not driven |
| 4 | open (C-3) |
| 5 | revisions: closed (V-11 live + control); `M7-CONN-W-CRED`: driven at re-gate 70 (`09b_m4_regate.md` rows "Add as camera" / assign), not by me; unreachable-PARTIAL and the server model line: not run |
| 6 | `M7-SEC-SRC-2` through the API: lane 2 holds 11 v2 items, 11 with `developmentSources true`; lane 1 holds 0 v2 items. Not as SQL (no database access by rule) |
| 7 | unchanged: no v2 item exists on a simulated lane |

## 8. Skipped / user-attended

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the offer was answered "Not now" three times on the tablet and once on the phone; never passed |
| Local devices, attendance variables, the local-device notice | never selected or set; no such flow here |
| The STT server backend, its model line in a verify result | user's rule; port 8000 never called |
| Playback of any recording, the sealed player, export, the receiver command on an archive | gate 94; "Play" and "Open playback" were not pressed |
| Camera search, stub, fixture account, `CAM-04` | not touched |
| Reconfiguring a lane to REAL_PRODUCTION | not done; tests cited (4.4) |
| Lane restart, reset, kill of a worker or a Core | not done (the interrupted and resumed items of re-gate 75 were used) |

## 9. Not covered, and why

1. The phone on a v2 package and the phone's hand-over logcat (C-3).
2. Everything of C-8.
3. The reset guard and the boot behaviour with packages present (no reset, no restart by me).
4. `M7-FF-*` second half ("Resumed after restart" on a client).
5. A second operator inside one web page; the tablet's Audit screen for the verify rows.
6. `masterplan/02_plan.md` and `implementation/99_implementation_report.md`: the task asked for this one file.

Lapses of mine, for the record: (a) my reader of the revision list printed the revisions' public
signature values and certificate hash into my tool output (public values of the package; none is in
this report); (b) the tablet frame burst started 22 s before the stop, so 17 of its 40 frames show
the recording; (c) each Verify press of mine added a row and a custody entry: seq 212-258 hold 22
`EVIDENCE_VERIFIED` and 6 `EVIDENCE_VERIFY_FAILED` (the tamper demonstration), the items of 4.1 now
have three to nine "VERIFIED" custody entries; (d) the technician's helper session had expired when
I signed it out (401).

## 10. Screenshots (`.cache/gates/89b/`)

Read by me:

| File | Shows |
|---|---|
| `w2_01_0015_metadata.png` | web Evidence Details `EV-20261010-0015`: "No preview picture", Sealed / Core record / Development source, Metadata tab with the Core's record; header "Device ID DEMS-IR-01", pill CRITICAL (G75c-01) |
| `w2_02_0015_integrity_before.png` | the same item, Hash & Integrity before a verify in the page: PASS of the last run, "SEALED VALUES OF THIS ITEM - CORE RECORD", two sealed-file rows |
| `w2_03_0015_verify_pass.png` | after Verify: the DEVELOPMENT SOURCES block with four entries, the development-key line, "Transcript sealed", toast "Integrity verified: EV-20261010-0015 PASS" |
| `w2_04_0017_interrupted_verify.png` | `EV-...-0017`: chip "Sealed - recording was interrupted", "Cause: CAPTURE_FAULT", PASS, "Interrupted recording: the durable part is sealed and was verified." |
| `w2_07_0005_tamper_demo.png` | `EV-20261009-0005`: FAIL, both development blocks, "Transcript disabled by configuration", VIDEO-01 PASS, VIDEO-02 row red, toast "Integrity FAILED ... VIDEO-02" |
| `w2_11_security_audit.png` | web Security & Audit on lane 2: posture "Not reported", "5 of 9 active", the DEMO key rows and "Hardware root key - Hardware-bound - TPM 2.0 ... never exported" (C-2) |
| `w2_12_monitor_recording.png` | web Session Monitor while `SES-...-0033` records: REC 00:00:15, "No preview", Evidence Integrity card with overlapping rows, tiles "1080p - 25 fps", banner "FAULT / Recording continues - Core was not running" |
| `w2_13_seal_dialog.png` | web "Evidence sealed" dialog: six steps done, SEALED, `EV-20261010-0022`, "Manifest SHA-256 / LIVE", "No DEMO package exists for this item." |
| `t2_05_0005_tamper.png` | tablet Evidence with `EV-20261009-0005` open: "Verification failed on the Core", FAIL, the two development blocks, VIDEO-02 file FAIL, "Where it failed" beginning; room pictures on the v1 demo rows of the list |
| `t2_08_home_recording.png` | tablet Home during my recording: bar "Recording SES-20261010-0033", ring CRITICAL "Recording - critical fault ... Core was not running", four development-source tiles "No preview" |
| `t2_09_session_live.png` | tablet Active Session: Recording 00:00:34, "No preview", "CAM 1 - Interview Room 1 / 1080p - 25 fps", "TIME Host system clock", "25 fragments saved" |
| `t2_10_summary_lower.png` | tablet Session Summary scrolled: "Signature - Ed25519, Core key CORE-KEY-EVSIGN-01", "Signed with a DEVELOPMENT key - not a production signature", "Sealed files" with stored / decrypted hashes |
| `seq/tS_16`, `tS_17`, `tS_19`, `tS_22` | tablet Finalizing 0 % ("Ending recording and closing tracks..."), the same 6 s later, "41% complete / This step: about 1678 s left", then Session Summary SEALED with "Host system clock" chips |
| `p1_01_sim_item_verify.png` | phone, simulated item of lane 1: "Verified by the Core", "...this tablet shows it as it is.", PASS, "SIGNATURE (SIMULATED) / Key: KEY-EVSIGN-01", Play dimmed |
| `p1_02_after_more.png` | phone Home after the tap on More that did not navigate: Ready for Recording, room pictures in Recent Sessions (simulated lane) |

Taken, NOT read as pictures (their text was read from the DOM or the view tree and is quoted
above): `w2_05_0018_resumed_verify`, `w2_06_0020_speech_verify`, `w2_08_0013_v1_verify`,
`w2_09_0020_technician`, `w2_10_0020_supervisor`, `t2_01_0017_detail`, `t2_02_0017_verify_top`,
`t2_03_0020_verify`, `t2_04_0015_verify`, `t2_06_0002_v1_verify`, `t2_07_0021_technician_verify`,
the other 36 frames of `seq/`.

Other files there: `manifest_0025 / 0027 / 0028 / 0031 / 0033.txt` (the manifests with the fragment
arrays summarized), `op40_*.json`, `op41_*.json`, `op39.json`, `negative_controls.txt`,
`l2_web_session.log`, `l2_seal_poll.log`, `session_new.log`, the three logcat files, the two test
logs, my scratch scripts (`pv.mts`, `tamper.py`, `manifest_read.py`, and copies of the earlier
gates' `cdp.mjs`, `run.mjs`, `webwatch.mjs`, `ui.py`, `api.sh`, `ses.sh`, `sealpoll.sh`, `tap.sh`,
`shot.sh`, `tab_signin.sh`).

## 11. Environment as left - what gate 94 inherits

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 49865, 2 RUNNING PID 82871 - neither restarted nor reset by me; web 5176 / 5177, Metro, PostgreSQL untouched; stub, its ports, its fixture file and the preset untouched |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` - never changed |
| Lane 2 session | none open; `session/current` = `SES-20261010-0033` SEALED, summary acknowledged (tablet Back, seq 253). Next session `-0034`, next item `EV-20261010-0023` |
| **New item on lane 2** | **`EV-20261010-0022`** = `SES-20261010-0033`: clean, 57.4 s, 57.2 MB, made through the API as OPR-001 (rows without a device), no microphone switch, transcript `ASSEMBLED`, revision head 0, verify PASS 15 of 15 |
| Lane 2 alerts | `ALR-000016` (G75c-01) still the one active alert; nothing else active |
| Lane 2 audit | chain `ok`, 258 rows at 23:33, then my last sign-outs. Rows of this gate from seq 212: sign-ins / sign-outs / two idle expiries, 22 `EVIDENCE_VERIFIED`, 6 `EVIDENCE_VERIFY_FAILED`, the session's five rows + `EVIDENCE_SEALED` + `SUMMARY_ACKNOWLEDGED`. No `ACCESS_DENIED`, no `EVIDENCE_MEDIA_SERVED` (nothing was played) |
| Lane 2 store | 11 package folders, the three scratch folders empty, no `.quarantine`; nothing under the store or the key folders was written by me |
| Lane 1 | one supervisor helper sign-in / sign-out, the phone's sign-in / sign-out, one verify run from the phone (`EV-20261010-0015` of lane 1, PASS; `-0013` opened, not verified) |
| Devices | tablet and phone signed out, on Login, "Core online", "paired as DEV-0001", reverse rules intact (4422 / 4421); no re-pairing, no lock change, no reboot, biometric not enabled |
| Helpers | four helper sessions signed out, jars removed; my headless browser stopped and its profile removed; no `capture-worker` / `whisper` / `ffmpeg` / watcher process |
| My copies | only under `.cache/gates/89b/work/`: 4 untouched copies and 23 tampered ones, **1.1 GB as `du` counts it** (APFS clones of the lane's files; the blocks not changed are shared) |

For gate 94:

1. Lane 2 holds no export. The receiver command (`npm run evidence:verify-export -- <archive.zip>
   [--sha256] [--trust]`) and its negative controls on an ARCHIVE (a changed entry, a removed entry,
   an added entry, a wrong `--trust`) are yours; this gate proved the package folder only.
2. An export should carry `transcript/transcript-revisions.json` under the export manifest: check
   that a shortened list fails THERE (G89b-02 is the folder's limit). `-0020` has four revisions,
   the fourth with a false `from` (G81b-01); `-0017` has one.
3. The Export button is enabled for roles whose `access.export` is false (G89b-09).
4. The manifests say `profile H264_1080P25`; the pictures are 1280 x 720 at 30 per second
   (G89b-01): a player or an export manifest may show the real size.
5. The tamper demonstration: what the players show for `(VIDEO-02, 3)` (PE-WH-07) was not opened.
6. Expect the Reanimated warnings of G89b-03 at every item opening and every pending control on
   the tablet: count them over the player and export flows.
7. The items of 4.1 carry many "VERIFIED" custody entries of gates 75, 81 and 89; the tamper
   demonstration carries "VERIFY_FAILED" entries. A helper session expires after 15 idle minutes.
8. G81b-10 (the band says "no interval" at 0:00) and G81b-03 (tablet Summary's lower controls: I
   left the Summary with the header Back) are unchanged.

---
*Generated: 2026-10-10 23:40 WIB*
