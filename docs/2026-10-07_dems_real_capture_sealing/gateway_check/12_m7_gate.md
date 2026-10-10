---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 89 - M7 milestone gate (evidence package v2)
date: 2026-10-10
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`, decision D193)
tree: f293221 (`git diff --stat HEAD -- apps packages scripts`: three README files only)
narrative_tier: 2
status: needs-review
verdict: FAIL (four blocking items, section 1; the cryptographic core of the package holds)
---

# 12 - M7 milestone gate (row 89)

Run window 14:15-14:45 WIB on the standing environment of `initialization/05_gate_environment_up.md`.
No product or test file was changed, no git write, no install. No local device (`CAM-03` / `MIC-03`)
was selected, pre-checked or started; no attendance variable was set; the fingerprint sensor was never
touched; no lock was set, changed or removed. No camera file was played or viewed: camera files were
read as bytes only (hashing, `xxd` of 48 + 32 bytes for box structure). No session key file was
opened. Evidence files of this gate are under the git-ignored `.cache/gates/89/`.

Surfaces: **W2** = web console lane 2 (REAL_DEVELOPMENT, 5177, headless Chromium over CDP),
**T** = tablet `emulator-5556` on lane 2, **W1** = web console lane 1 (SIMULATED), **P** = phone
`emulator-5554` on lane 1, **API** = the lane's Core, **FILE** = a sealed package's non-media files
read as text, **OWN** = my own script `.cache/gates/89/verify_own.mjs` (Node `crypto` only, imports
nothing of the product), **PV** = the product's verifier (`verifyPackageV2` through `corePorts`) run on
a folder COPY outside the media root by my scratch `.cache/gates/89/product_verify.mts`.

## 0. Read this first: what an outside verifier can and cannot establish

For a package of this build, held by somebody with NO access to the Core (no database, no session
key), the following was established by me on the two packages I sealed, outside the product:

| CAN be established from the folder alone | Evidence |
|---|---|
| The manifest has not changed since it was signed: SHA-256 of the canonical body (keys sorted, compact JSON, UTF-8, `manifestSha256` set to null, `signature.value` left out) = `manifestSha256` = `signature.sig.signedDigest` | OWN: "compact sorted reproduces manifestSha256" for both packages |
| The signature is a real Ed25519 signature over the 32 digest bytes, made by the key of `device-certificate.pem` (self-signed, valid at `signedAt`); a digest with one bit flipped does not verify | OWN: `V-09 ... OK`, negative control `OK` |
| Every sealed camera byte is the byte that was signed: per-fragment stored-bytes SHA-256, the chain from `SHA-256("")`, the running prefix hash of every fragment, the whole-file hash, gapless ranges, `seq` 1..N | OWN: 28 + 27 fragments (clean), 16 + 15 (interrupted): all equal; one flipped bit named exactly `(VIDEO-01, 5)` |
| `fragments/fragments.json` is the manifest's `files[]` | OWN |
| What the Core DECLARED: source classes, `developmentSources`, interrupted flag, transcript state and configuration snapshot, audio intervals, operator, case | FILE |

| CANNOT be established | Why | Seen at this gate |
|---|---|---|
| That the package was signed by the Core at all | The certificate is self-signed and lies in the folder. Without the Core's certificate hash obtained out of band, a package re-signed with any key verifies | PV on a copy I re-signed with a throw-away key, every class edited to `PRODUCTION`, certificate subject without the development unit: **`overall PASS`, "Sources: declared as production devices by the Core that sealed this package.", `developmentKey: false`**. With the Core's certificate hash as anchor: `V-13 CERTIFICATE_NOT_TRUSTED`. With the Core's recorded digest: `V-03 MANIFEST_NOT_OF_ITEM`. This is the stated limit (ev C.3 SEC35-06, H.5, H.6), not a new defect - but it means **both development marks are worth exactly as much as the certificate anchor** |
| Anything in `audit-session-extract.jsonl` | No manifest field holds its hash (R88-06, ruled; notice `AUDIT_EXTRACT_NOT_SIGNED`) | PV: a row removed + an invented row added: `PASS`; the file emptied to 0 bytes: `PASS`, the notice still reads "present" |
| That the extract's rows are true even when unaltered | G75-01: the simulator writes invented integrity rows into a real session's audit | 5 of 10 rows of my clean package's extract are invented (section 5) |
| That the time source, the Core's device identity and the camera model / firmware in the SIGNED manifest are facts | They are the simulator dataset's values (finding G89-01) | `timeSource {GNSS, LOCKED}`, `softwareVersion 2.4.1` (the Core is `0.2.0`), `serialNumber DEC-2026-IR01-000117`, camera `firmware 3.8.14` for a generated source |
| Lost audio, a camera that was given up, any capture fault | Only audit rows say it; they are in the unsigned extract (R74-04 / D177; C3 below) | not producible with FAKE sources |
| The plaintext hash | Needs the session key (V-05); the Core's op 41 runs it | op 41: V-05 PASS on both of my packages |
| Model provenance of a server STT backend | The server's word (ev B.7 PE-D9-01) | not run live (user's rule); my packages are `DISABLED` |
| Whether `clockOffsetMs: 0` was measured | 0 is also the stand-in (R88-16, open) | C2 below |
| Certificate hash with `shasum` | `device.certificate.sha256` is the SHA-256 of the DER, not of the PEM file; the spec does not say which | OWN (finding G89-10) |

## 1. Verdict

**FAIL.** What M7 is about at the byte level works and was re-proven independently: two packages
sealed by the product (one clean, one after a worker kill) reproduce their manifest hash, signature,
fragment hashes and chains outside the product; op 41 answers PASS 15 of 15 on API, web and tablet with
both development marks and the not-signed notice shown; one altered bit is named exactly; an edited
source class fails V-03 (V-09 when re-hashed) and is not printed as fact; no plaintext is left after a
seal; the reset guard behaves as designed; every BLOCKER / MAJOR of review 88 is fixed or ruled. The
gate fails on what the package and its surfaces SAY beside those bytes:

| # | Blocking item | Finding | Owner |
|---|---|---|---|
| B-1 | The sealed audit extract of a REAL session holds simulator-invented integrity rows, and the Monitor states invented integrity facts ("Encryption Active AES-256 Passing" while the recording is plaintext on disk) | G75-01 (MAJOR, open; reproduced and quantified, section 5) | coder-execution (shared generator / engine in real capture) |
| B-2 | The SIGNED manifest of a REAL package states simulator-dataset values as facts: time source `GNSS` / `LOCKED`, Core device identity and software version, camera model and firmware | G89-01 MAJOR (new) | coder-execution (`sealing-host/session-reader.ts`) + spec owner (ev B.2 / B.3 / B.4, H) |
| B-3 | An interrupted recording is not named on the session surfaces: web seal dialog and Monitor, tablet Finalizing and Summary, session history (`faultKind: null`), evidence list and item header; it is named only in a verify result and in the custody table | G75-03 (MAJOR, open; reproduced) with G75-08 | coder-execution (web Monitor, mobile summary, item surfaces) |
| B-4 | B9: the logcat criterion of row 87 ("0 lines") fails on every hand-over: 70 lines on the tablet (twice), 110 on the phone | G89-02 MAJOR (named criterion; B9 / FXR-DEV-2, MB-04 High) | coder-execution (mobile Finalizing / Summary) |

Not blocking by themselves but to rule before sign-off: G89-03 (a real signature labelled "simulated"
/ "DEMO KEY" on three surfaces; G81-02 widened), and the NOT PROVEN list of section 9 (the kill matrix
and the seal e2e were last run BEFORE pass F-Z changed `sealing-host/index.ts`; the phone never saw a
v2 package; `M7-CONN-W-CRED` not driven).

## 2. Start state

| Step | Result |
|---|---|
| `lane.sh stop 2` | `lane 2 stopped (was PID 65709); port 4422 is free`; log ends `engine stopped`, `pipeline closed ... "drained":true,"abandoned":0`, `shutdown complete` |
| Store before the reset | the two demo packages + gate 81's `SESSION-SES-20261010-0024` / `-0025` (REAL, development) |
| `lane.sh reset 2` (first reset-guard observation, section 4.5) | exit 0, permitted; `audit head seq 83`; demo packages regenerated |
| `lane.sh start 2` (output to a file) | `lane 2 is ready on 127.0.0.1:4422 (PID 68044)`; health `ready {database:true, engine:true}`; boot log 0 warn / error lines; `transcripts.heads items 2` |
| Selector | `CAM-01`, `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked: false` |
| STT | `stt_config` is a KEPT table (`db/reset/kept-tables.ts:4`): it still read `revision 3`, `updatedAt` of gate 81. Set to `enabled: false` by me through op 91 as SUPERVISOR (revision 4); put back to enabled at the end (revision 5) |
| Lane 1 | `stop 1`, `reset 1` (`v2 demo packages: NOT generated (NOT_A_DEVELOPMENT_CAPTURE_CORE)`, seq 83), `start 1` before its checks |
| Devices | both `emulator-5554` / `-5556` attached, unlocked, paired as `DEV-0001`; sign-in by the username / password path through "Demo operators" |

## 3. Entry condition - review 88: 1 BLOCKER, 8 MAJOR

Code read at `f293221` (last commit of every folder below: `f293221`). Run by me once, now:
core-server unit, 14 files (`pipeline-one-camera`, `pipeline-prefix`, `way-out`,
`pipeline-frozen-facts`, `sealed-plaintext`, `pipeline-development-key`, `fix-m7-verify`,
`fix-m7b-export-notice`, `fix-m7c-revision-pending`, `r88-19-codes`, `real-evidence-m7`,
`capture/boot checks`, `evidence-volume-private`, `per-store-session-keys`): `Test Files 14 passed (14)
/ Tests 166 passed (166)`; shared, 3 files (`evidence-m7-one-camera`,
`evidence-verify-development-key`, `sim-m7b-unsealable`): `3 passed / 22 passed`. Logs
`.cache/gates/89/entry_*.log`. The db files (`real-evidence-m7.db`, `unsealable-doors.db`,
`sealing-notice-doors.db`) are in gate 64's db run on `f293221` (2381 passed), not re-run.

| Finding | State | Evidence in code | Live at this gate |
|---|---|---|---|
| R88-01 BLOCKER one-camera session never sealable | FIXED | `evidence-package/layout.ts:18` `isSealedTrackList`, `manifest.ts:320` ("1 or 2 track records"), `sealing/pipeline/pipeline.ts:318` (`NOT_RECORDED`), `:641` (`absentTracks` in the signed step record); spec erratum PE-M7-01 | NOT DRIVEN: a lane cannot stop one FAKE camera. Unit proof only (11 + 7 cases) |
| R88-02 no way out of a failed seal | FIXED | `sealing/pipeline/way-out.ts:61` (`delaysMs [5000, 30000, 120000]`, `nonRecoverableAttempts 3`), `:76-79`; `sealing-host/index.ts:388, 397, 518` (`retryFailedSeal`), `:474` (`SEALING_QUARANTINE_HOLDS_SESSIONS`); `engine/unsealable-doors.ts` | NOT DRIVEN LIVE (no supported seam on a running lane without breaking files). `test/06` A2 case (c) - run before pass F-Z, see section 9 |
| R88-03 `MANIFEST_NOT_REPRODUCIBLE` permanent | FIXED | `pipeline.ts:108` (`FrozenBuild`), `:150`, `:660-661` (a resume builds from the frozen input) | not producible live; visible effect: `timeline.sealedAt` = `signedAt` = the BUILD_MANIFEST instant (G89-08) |
| R88-04 plaintext-until-sealed in no spec; store root readable | FIXED | `capture/boot/checks.ts:108, 202` (`READABLE_BY_OTHERS` for any group / other bit), `:165-168` (private folders); ev A.3 PE-M7-02, H.6; `README.md:444-448` "Evidence at rest" | lane 2: root, every package folder and `.sealing` / `.transcriber` / `.capture-session` `drwx------`, every file `-rw-------`; during the recording two plaintext `VIDEO-0n.mp4` (0600) in the session folder |
| R88-05 plaintext outlives SEALED silently | FIXED | `sealing/pipeline/sealed-plaintext.ts`, called at `pipeline.ts:851`; `sealing-host/index.ts:238` (`sweepSealedSessions`), `:559` | both sessions: no `VIDEO-0n.mp4` in the session folder after the seal, `.sealing/` empty, no `.quarantine`. The sweep, the orphan removal and the kept-plaintext alert themselves were NOT seen (nothing to sweep; the boot is silent then) |
| R88-06 audit extract unsigned | RULED (D178; ev H.6 "open decision") - a LIMIT, not a fix | `evidence-verify/types.ts:390, 431-433`; `verify.ts:1097` | reproduced as the stated limit (section 4.2). **Its weight is larger than the ruling assumed: see G75-01** |
| R88-07 clients ignore `developmentKey` | FIXED | `verify-v2.ts:378` (web) / `:383` (mobile); `verify-v2-report.tsx:34` / `:38`; `integrity-tab.tsx:315-317`, `live-integrity-tab.tsx:280-282` | W2 and T: the line in the verify result AND on the detail's signature entry (section 4.1) |
| R88-08 mark not anchored; no boot refusal | FIXED | `evidence-verify/verify.ts:285-286` (`CERTIFICATE_SUBJECT_MISMATCH`), `:1091` (`null` unless trusted); `capture/boot/checks.ts:60`; `pipeline.ts:779` | PV: `developmentKey: null` and "Signing key: not established" when V-03 or V-09 fails. The boot refusal and the seal refusal are tests only (no production lane) |
| R88-09 reset beside an unsealed recording | FIXED | `db/commands/evidence-store.ts` `readEvidenceStore` (only `ENOENT` is "no store"; else `unreadable`), quarantine listed; `db/reset/real-evidence.ts:151` (`UNION ALL`), `:394` (`RESET_STORE_UNREADABLE`) | refusals are tests only (section 4.5) |

Entry condition: **met** (0 BLOCKER / MAJOR of review 88 open; R88-06 by ruling). MINORs still open
as the fix notes say (R88-10, -12, -13 first half, -14, -16, -17, -18 two headers); R88-12 and R88-16
were met live (G89-06, C2).

## 4. Checks

### 4.1 The two product-sealed packages (lane 2, FAKE sources, STT disabled)

**A** = `SES-20261010-0024` -> `EV-20261010-0014`: created, pre-checked (8 of 8), started, one audio
switch (MIC 1 -> MIC 2, confirm dialog) and ended ("Gate 89 clean stop") on the WEB console as OPR-001;
followed on the tablet. Recording 68.4 s, 68.5 MB.
**B** = `SES-20261010-0025` -> `EV-20261010-0015`: started on the web the same way; at 14:30:33
`pkill -KILL -f build/capture-worker` while it recorded (durable). 43.5 s, 41.8 MB.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Folder contents against ev A.1 | FILE | PASS | A and B: `session-manifest.json`, `signature.sig`, `device-certificate.pem`, `audit-session-extract.jsonl`, `fragments/VIDEO-01.mp4`, `fragments/VIDEO-02.mp4`, `fragments/fragments.json`; no `transcript/` (DISABLED, ev B.7a); folders 0700, files 0600 |
| No plaintext left; scratch state | files | PASS | session folder holds no `VIDEO-0n.mp4`; `.sealing/` empty; `.transcriber/sessions/` empty; no `.quarantine`; no `capture-worker` process after either session. `.capture-session/<id>.json` stays (R88-27, G89-07) |
| Sealed file is ciphertext with a clear init segment | bytes | PASS | `xxd -l 48`: `ftyp iso5 ... moov ... mvhd`; at the first fragment offset 1249 no box header; `grep -c -a moof` on the sealed file: 0 |
| `tracks[]`, codec | FILE | PASS | 2 records in A and B, `VIDEO-01` / `VIDEO-02`, `codec: "H264"`, `mediaType video/mp4`, `keyframeAligned true`, `fragmentCount` 28 / 27 (A), 16 / 15 (B) |
| Field 40 `clockOffsetMs` (C2) | FILE + facts + Core log | PASS with a caveat | section 7 |
| Source classes | FILE | PASS | `tracks[].sourceClass FAKE` x2; A: two audio intervals `MIC-01 PRIMARY START 21-21291` and `MIC-02 STANDBY MANUAL 21291-68801 switchedBy OPR-001`, both `FAKE`; `developmentSources: true`; `integrity: REAL`, `demo: false`, notice "DEVELOPMENT - sealed by a Core in development capture mode; ..." |
| Interrupted flag, `stoppedAt` | FILE | PASS (as specified) | A: `interrupted false`, `stoppedAt 1791616853241` = `durableEndMs`. B: `interrupted true`, **`stoppedAt null`**, `durableEndMs 1791617433083`, `recordingDurationMs 43541` (media-based); `sealing.steps[CLOSE_TRACKS].checkpoint {interrupted true, tracks 2, truncatedTails 0}` |
| Fragment records | FILE + OWN | PASS | every record has `gcmIv` (24 hex), `gcmTag` (32 hex), `keyId KID-<sessionId>`; distinct IVs 28 / 28, 27 / 27, 16 / 16, 15 / 15; `sha256Plain` on every record. B: `interrupted: true` on 16 / 16 and 15 / 15; **`truncated` on none**: the kill left no torn tail in either file (`truncatedTails 0`), so `truncated` on a cut file was NOT seen live (unit: `pipeline-prefix.test.ts`) |
| Transcript record + snapshot | FILE | PASS | `state DISABLED`, `disabledReason DISABLED_BY_CONFIGURATION`, `backendUnreachable false`, `configSnapshot {backend cpu-local, diarization true, enabled false, model ggml-large-v3-turbo, revision 4}` - revision 4 is my change of 14:17, so the snapshot is the session's; every document / model member null |
| Signature block, certificate hash | FILE + OWN | PASS | `algorithm Ed25519`, `keyId CORE-KEY-EVSIGN-01`, `simulated false`, `signature.value` = `signature.sig.signature`; `device.certificate.sha256` = `signature.certificate.sha256` = `signature.sig.certificateSha256` = SHA-256 of the certificate's DER; subject `CN=CORE-KEY-EVSIGN-01,OU=DEVELOPMENT KEY - NOT FOR PRODUCTION,O=DEMS Core` and serial equal to the certificate's |
| Manifest hash, recomputed by me (ev B.10) | OWN | PASS | A `e967cf1e...dae234`, B `223ad17f...399937`: canonical body -> SHA-256 = `manifestSha256` = `signedDigest` = the item's `manifestHash` of op 40 = the `EVIDENCE_SEALED` audit row (B: seq 126) |
| Fragment hashes and chain, recomputed by me (V-04 / V-06 / V-07 / V-02) | OWN | PASS | `.cache/gates/89/own_verify_A.txt` / `_B.txt`: every line `OK`, 0 `FAIL` (A: 28 + 27 fragments, chain head = `fragmentChainHead`, whole-file hash = `tracks[].sha256`, prefix hash 28 / 28 and 27 / 27, ranges gapless from byte 1249 to the file end, 0 trailing bytes; B the same for 16 + 15) |
| Ed25519 signature against the certificate's key | OWN (Node `crypto`) | PASS | verifies over the 32 digest bytes; the same digest with one bit flipped does not |
| Session key not in package, log, audit, manifest | grep of the key ID only | PASS | `KID-SES-20261010-0024`: 1 line in the manifest, 1 in `fragments.json` (the ID, by design), 0 in the extract, `signature.sig`, the Core log, the worker log. The key file is `credential-store/session-keys-<scope>/KID-<id>.key`, 0600 in 0700 folders, outside the media root; not opened by me. Finding G89-06 on its age |
| Op 41 | API | PASS | A: `overall PASS`, V-01..V-15 all PASS, `interrupted false`, `sources {code DEVELOPMENT, development true}`, `signature {developmentKey true}`, `notices [AUDIT_EXTRACT_NOT_SIGNED]`, `transcriptState DISABLED_BY_CONFIGURATION`. B: the same with `interrupted true`. Again after a Core restart: unchanged |
| Op 41 on the web (`M7-VV-WEB`, W-VV, `M7-DEVSRC-EVID-W`) | W2 | PASS | A (`w2_05_verify_pass.png`): verdict PASS; first block "DEVELOPMENT SOURCES - this package was not recorded from production devices." with four entries; "Signed with a DEVELOPMENT key - not a production signature"; "Transcript disabled by configuration"; VIDEO-01 / VIDEO-02 file rows "Stored bytes PASS - decrypted bytes PASS - fragment chain PASS", 28 / 27 fragments; "Manifest and package PASS"; "Signature and certificate PASS"; "15 of 15 checks passed" V-01..V-15; "Not covered by the package signature - Audit extract: present, NOT covered by the package signature."; the detail's signature entry repeats the development-key line (`data-testid evidence-signature-key`, `DEVELOPMENT`). Badge "Development source" on the row and the header |
| Op 41 on the tablet (`M7-DEVSRC-EVID-T`) | T | PASS | view tree: `evidence-verify-v2-PASS`, `evidence-v2-sources-DEVELOPMENT` first with four entries, `evidence-v2-signing-key-DEVELOPMENT`, four result rows `-ok`, "15 of 15 checks passed", `evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED`, detail `evidence-signature-key-DEVELOPMENT` (`t2_05`); badge `evidence-row-development-...` and `evidence-detail-development` |
| Op 41 on the phone for a v2 item (`M7-VV-PHONE`, `M7-DEVSRC-EVID-P`) | P | **NOT PROVEN** | the phone is paired with lane 1 (SIMULATED), which holds no v2 package; a re-point costs a new pairing (E-2) and was not in this gate's device plan. Jest only |
| Clause "a v1 item reads 'not recorded'" of `M7-DEVSRC-EVID-*` | W2, T, P | **FAIL (clause)** | G89-05: the text exists (`i18n/en/common.ts:871`) and no client references it; a v1 item shows no source line (never "production") |

### 4.2 Tamper (copies outside the media root, and the seed's demo item)

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Control: untouched copy | PV | PASS | `overall PASS`, V-05 SKIPPED (no key), 14 PASS |
| One bit flipped in one fragment (`M7-TP-1`, V-08) | PV + OWN | PASS | bit 0 of byte 5488727 of the copy's `VIDEO-01.mp4` (inside seq 5). PV: `overall TAMPERED`; V-04 `FRAGMENT_HASH_MISMATCH (VIDEO-01, 5)` + `FILE_HASH_MISMATCH`; V-06 `CHAIN_BROKEN (VIDEO-01, 5)`; V-08 `FRAGMENT_TAMPERED (VIDEO-01, 5)`; every other check PASS; failed fragments `[{VIDEO-01, 5, TAMPERED}]`; class TAMPERED, not CORRUPT. OWN: "27 of 28 equal; FAILED seq 5", "broken from seq 5" |
| Tamper demo `EV-20261009-0005` | API | PASS | `overall TAMPERED`; `fragments [{trackId VIDEO-02, seq 3, reason TAMPERED}]`, `failedFragmentCount 1`; V-04 / V-06 / V-08 FAIL, V-05 skipped, 11 PASS; `manifestOk true`, `signatureOk true`; the clean `EV-20261008-0001`: PASS 15 of 15 |
| Tamper demo on the web (W-TP) | W2 | PASS | `w2_06_tamper_demo.png`: FAIL; VIDEO-01 file PASS, VIDEO-02 file FAIL; "Where it failed - VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)"; "11 of 15 checks passed"; manifest and signature rows PASS; both development lines and the notice shown. Finding G89-09 on the bundled-package panel below it |
| Tamper demo on the tablet (T-FF flow of the brief) | T | PASS | `t2_07`: "FAIL: VIDEO-02 does not match the sealed manifest", the same "Where it failed" sentence (`evidence-v2-fragment-VIDEO-02-3`), VIDEO-02 file FAIL, three other rows PASS, 11 of 15 |
| Audit extract altered (one row removed, one invented row added) | PV | PASS + notice = the known limit R88-06 | `overall PASS`, notice `AUDIT_EXTRACT_NOT_SIGNED`. Emptied to 0 bytes: `PASS`, the notice says "present" |
| `sourceClass` edited, digest left (`M7-DEVSRC-TAMPER-1`) | PV | PASS | V-03 `MANIFEST_HASH_MISMATCH`; `sources {code NOT_TRUSTWORTHY, development null, tracks []}`; report "Sources: not trustworthy - the manifest was altered", "Signing key: not established ..."; the edited class is printed nowhere |
| Every class `PRODUCTION`, flag false, digest and `signedDigest` recomputed | PV | PASS | with the Core's digest as anchor: V-03 `MANIFEST_NOT_OF_ITEM` + V-09 `SIGNATURE_INVALID`; with the copy's own digest (no Core record): V-09 `SIGNATURE_INVALID`; sources not trustworthy in both |
| The same, re-signed with a throw-away key and its own certificate | PV | the stated limit | section 0: PASS without an anchor; `CERTIFICATE_NOT_TRUSTED` with the Core's certificate hash |

### 4.3 Failure exits

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Interrupted session sealed and verifiable | Core, FILE, OWN, API | PASS | log: `CAPTURE_WORKER_DOWN ... "signal":"SIGKILL","restartInMs":null`, `CAPTURE_INTERRUPTED ... "outcome":"INTERRUPTED","durable":true`, `SEALING_COMPLETE ... EV-20261010-0015 ... "interrupted":true` 0.4 s after the kill; audit seq 124 `FAULT_RAISED`, 125 `RECOVERY_STARTED`, 126 `EVIDENCE_SEALED`, 127 `RECOVERY_COMPLETED`; custody `RECORDING_INTERRUPTED / CAPTURE_FAULT`, `SEALED / Durable prefix sealed (interrupted)`; OWN all OK; op 41 PASS 15 of 15, `interrupted true` |
| The flag in the verify result (V-12) | W2, T | PASS | "Interrupted recording: the durable part is sealed and was verified." (W2 text; T `evidence-v2-interrupted`) |
| The interruption named on the session surfaces | W2, T, API | **FAIL** | G75-03 reproduced. W2 page log: 50 ms "SESSION ACTIVE & SECURE / Capture fault", then the dialog "Finalizing evidence" 0 -> 16 -> 66 -> 100 %, "Evidence sealed ... SEALED ... Evidence EV-20261010-0015 sealed" (`w2_07_after_kill.png`), banner "SESSION SEALED / Evidence EV-20261010-0015 sealed - Ready for the next session", header "CRITICAL An integrity check failed". T Summary: "SEALED", Duration 00:00:43, no word of it. API: session `state SEALED`, `stoppedAt null`, history `outcome SEALED, faultKind null`. Evidence list row and item header on W2 and T: "Sealed", "Development source" only |
| G75-08 | API, W2 | reproduced | `elapsedMs 67568` 24 s after a 43.5 s recording and `550890` nine minutes later; the web Monitor's Duration kept counting (00:00:57 and on) |
| Retried / blocked / UNSEALABLE seal; kept plaintext; on-demand retry | - | **NOT DRIVEN LIVE** | no supported seam on a running lane without breaking files. `test/06` A2 case (c) and the unit / db files of section 3 |

### 4.4 Recovery

| Check | Result | Evidence |
|---|---|---|
| Core stopped while FINALIZING | NOT DRIVEN LIVE | the seal of both sessions took 0.4-0.6 s (op 83 poll, 60 ms); not catchable with the lane script. Kill matrix `test/06` A3 (35 of 35) - see section 9 for its tree |
| Plain `stop 2` / `start 2` with four packages present | PASS | boot steps `engine.rehydrate`, `transcripts.heads items 4`, `sealing.resume`, `evidenceExport.sweepPartials` all "boot step passed"; `B-8 rowsChecked 134 ... linkBreaks 0`; 0 warn / error lines. The file list of the store before and after is identical (30 files, `diff` empty): no plaintext reappeared. Op 41 after it: A PASS, B PASS `interrupted true`, `EV-...-0005` TAMPERED `(VIDEO-02, 3)` |
| Boot log names quarantine / sweeps | as designed, nothing to name | the sealed-session sweep and the quarantine line write only when they act (`SEALING_QUARANTINE_HOLDS_SESSIONS` needs a quarantine; none existed). The step line is `sealing.resume` |

### 4.5 Reset guard (lane 2, real-development items present; run twice)

| Check | Result | Evidence |
|---|---|---|
| Reset permitted, development packages exempt | PASS | 14:15 (gate 81's two items) and 14:42 (my two): "this reset erases 2 development-source package record(s) ... (SES-20261010-0024, SES-20261010-0025): sealed from development sources only, exempt from the real-evidence guard (dbc-4 N.10). 4 package folder(s) on disk carry the signed development mark"; "removed 4 development-source package folder(s)"; the guard names the root it judges and that it equals the recorded one |
| Session folders removed, demo items regenerated with fresh keys | PASS | store after: the two demo folders only. Digests `EV-20261008-0001`: `15462d2e` -> `c9e70eba` -> `6ca82fd5` -> `3a099cf1`; `EV-20261009-0005`: `f5fd30f6` -> `4fdceb27` -> `222b5f05` -> `1d70ae06` (four seeds, four values); the two demo key files re-created at each reset (file times 14:15:51-52, 14:42:02-03) |
| What the reset leaves | finding | G89-06 (session keys of removed development sessions), G89-07 (`.capture-session/*.json`) |
| Production-side refusals | PASS (tests only, cited) | `db/reset/__tests__/real-evidence-m7.test.ts` (13, run by me), `real-evidence-m7.db.test.ts` and `test/db/m4-sec-reset.db.test.ts` (gate 64's db run). No production evidence was fabricated on a lane |

### 4.6 Clients: progress, B9, verify views

| Check | Surface | Result | Evidence |
|---|---|---|---|
| `M7-FF-WEB` first half (percent never falls) | W2 | PASS | page log at 40 ms, session A: 0, 0, 16, 50, 83, 100 %; "Estimating the time left..." throughout (the Core's `etaMs` is null in real capture); steps only advance; closable at SEALED. Session B: 0, 16, 66, 100. API op 83 (60 ms): 0, 16, 50, 83, 100, `resumed false` |
| `M7-FF-TAB` first half | T | PASS | frames `seq/tA_04..14`: 0 % "Ending recording and closing tracks...", 16 %, 50 %, 83 %, then Session Summary; "Estimating the time left..."; never a step back. The tablet drew these states 2-7 s AFTER the Core had sealed (NOTE G89-13) |
| `M7-FF-PHONE` first half | P (simulated seal, lane 1) | PASS | frames `seq/pP_strip.png`: 0, 14, 33, 49, 66, 81 %; API 13, 27, 40, 52, 64, 74, 87, 100. ETA line: G89-11 |
| Second half: after a RECOVERY resume the client shows max-seen, "Resumed after restart" | W2, T, P | **NOT PROVEN** | needs a Core restart inside a 0.5 s seal; component tests only |
| B9 logcat at Monitor -> Finalizing -> Summary (criterion of `42_m7_clients_verify.md` section 6: `grep -c "Unable to find SurfaceMountingManager"` from the stop to the Summary = 0) | T, P | **FAIL** | G89-02. T session A: **70** lines; T session B: **70**; P: **110**. No empty frame was caught in my frames |
| v1 item, unchanged behaviour | W1, P, W2, T | PASS | W1 `EV-20261010-0013`: "6 of 6 checks", four track rows + manifest + signature PASS, "Bundled demo package ... PASS", 0 v2 nodes, no development badge. P: "Verified by the Core", "PASS: every hash matches the sealed manifest", "Bundled demo package: PASS (DEMO - precomputed)", four tracks. The same on W2 and T for lane 2's v1 item |
| G81-02 | T, W2 | reproduced and wider | G89-03 |

### 4.7 Software checks of the row (by mapping; D122)

| Check | Result | Evidence |
|---|---|---|
| `M7-RG-*` core-server unit + db | PASS | gate 64 on `f293221` (`08_m3_gate.md:48-50`): 309 files / 6247 passed; 177 files / 2381 passed, 6 skipped |
| `M7-RG-*` shared, capture-protocol, core-web, transcriber, mock-core, mobile | PASS by `test/06` B3-B9 as mapped by gate 64 (2476; 31; 1900; 561; 19; mobile 249 of 250 + the one file re-run green) | tree since: README files only |
| `M7-QA-1` | PASS | `test/06` B1 / B2 (7 workspaces), gate 64 re-run for the two F-Z workspaces |
| `M7-VV-SRV`, `M7-TP-1`, `M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1`, `M7-DEVSRC-BUILD-1` (read), `M7-STTCFG-VERIFY`, `M7-CONN-CRED-1` (read), `M7-FF-UNIT` | PASS (mapped) | `evidence-verify/__tests__/{verify-v2, dev-source-mark, source-class-agreement}.test.ts`, `sealing/__tests__/stt-states-verify.test.ts`, `capture-discovery/connect/__tests__/connect.db.test.ts`, the clients' `sealing-progress` tests: all inside the whole-project runs above. Live +1 of the first four: sections 4.1, 4.2. `M7-STTCFG-VERIFY` live for DISABLED only (4 packages); unreachable-PARTIAL not run live (user's rule) |
| `M7-SEC-SRC-2` | PASS on lane 2 through the API; other lanes by record | op 39: the four v2 items `developmentSources true` (2 REAL, 2 DEMO_PACKAGE); lanes 1 / 3 / main hold no v2 item (`NOT generated`). The SQL over `evidence_items` was not run by me (no database access by rule); `m4-sec-reset.db.test.ts` in gate 64's run |
| `M7-REF-1`, `M7-KM-*` (35 cells; P1 cells = failed start, D84) and seal e2e | **PASS on the pre-F-Z tree; NOT RE-RUN on `f293221`** | `test/06` A3 "35 passed (35)", A2 "3 passed (a, b, c)". Not re-run now: the lanes are up and the harness would contend for 8554 / 8556 with lane 2's worker. See section 9, item 1 |
| `M7-CONN-W-CRED` | **NOT PROVEN** | not driven (needs the fake ONVIF stub flow on a lane; not in this gate's plan); no earlier gate report names it |

## 5. G75-01 reproduced once and quantified

New session A (clean, 68 s), `audit-session-extract.jsonl` as sealed: **10 rows, 5 of them invented**:

| seq | type | details | Truth |
|---|---|---|---|
| 98 | `FRAME_HASH` | `{sha256 945d3e5d..., segment 1, trackId AUDIO-01}` | no such hash exists in the package; there are no "segments" |
| 99 | `WRITE_VERIFIED` | `{volume HDD-EVIDENCE, bytesWritten 9455056}` | invented |
| 101 | `WRITE_VERIFIED` | `{bytesWritten 60165222}` | invented |
| 102, 104 | `FRAME_HASH` | `VIDEO-01`, `VIDEO-02`, random digests | equal to no fragment or file hash of the manifest |

Session B (43 s): 7 rows, 2 invented (`WRITE_VERIFIED bytesWritten 47888000` - more than the 41,791,460
bytes the session holds; one `FRAME_HASH`). No `TIMESTAMP_CONFIRMED` fell into these two short
sessions; `RECORDING_STARTED` carries `{timeSource: "GNSS"}` (G89-01).

On the Monitor during the REAL recording (W2 text at 14:20:08, `t2_02`): "Encryption Active - AES-256 -
Passing" (the recording was two plaintext files, ruling D147), "Hash Chain Active", "Secure Timestamp
Synced - GNSS", "Storage Write Verified - Continuous", "CHAIN HEAD 7ea62c62897e" (the audit chain's,
shown as the evidence's), "Evidence Auto-Save - Segment 1 saved (9.5 MB)", "Write Speed 2.3 MB/s",
"Session Size 53 MB", audit feed "Video frame hash recorded", "Storage write verified".

**What it means for the package.** The signed part is not touched by it: no invented value is in the
manifest's hashes. But (1) the one file of the package that speaks about the recording in the Core's
own words is unsigned (R88-06) AND half invented, so it cannot serve the purposes D177 / PE-M7-01
gave it (lost audio, the absent camera's `CAPTURE_DEVICE_UNREACHABLE` row): a reader cannot tell a true
row from a generated one; (2) the invented rows are in the Core's own hash-chained audit log
(`B-8 linkBreaks 0`), so the chain attests them; (3) signing the extract (the "open decision" of ev
H.6) BEFORE fixing this would put invented statements under the signature. Still MAJOR, still open.

## 6. Findings

| ID | Sev. | What | Steps / evidence | Spec |
|---|---|---|---|---|
| G89-01 | **MAJOR** | The signed manifest of a REAL package carries simulator-dataset values as facts. `timeline.timeSource {source GNSS, state LOCKED}` on a computer without a GNSS receiver; `device.serialNumber DEC-2026-IR01-000117` (`packages/shared/src/sim/dataset.ts:73`), `hardwareUuid`, `softwareVersion 2.4.1` (the Core reports `0.2.0`); `tracks[].model "Dual-lens IP camera DL-2"`, `firmware 3.8.14` for a generated source. The clients repeat it (tablet Summary: Start / End Time chips "GNSS"; history `startTimeSource GNSS`) | both manifests; `sealing-host/session-reader.ts:310-311` reads `state.time` / `state.device`; `:286`. `STAND_INS` (`:70-75`) lists four values and says "nothing ... made up": these are not in it. No decision and no section of ev H names it (`grep -i gnss decisions.md`: 0) | ev B.2 field 17 "network-time module", B.3 field 24 "Core build"; H lists the limits a verifier must know. A signed evidence time source that is a simulator constant is a false statement under the signature |
| G89-02 | **MAJOR** | B9 not met. `Unable to find SurfaceMountingManager for tag` (Reanimated, `RetryableMountingLayerException`) from the stop to the Summary: tablet A 70 lines (tags 5798 x2, 6168 x4, 6550 x6, 6944 x8, 7350 x10, 7768 x40; 14:20:56-14:21:00), tablet B 70 lines (22536 x2 ... 24212 x10, 24630 x40), phone 110 lines (6452 x5, 6956 x7, 7350 x9, 7636 x11, 7924 x13, 8228 x15, 8534 x50; one burst per pipeline step at 14:37:32, :35, :37, :39, :42, :44, the last at :46) | `logcat_A.txt`, `logcat_B.txt`, `logcat_P.txt` (`adb logcat -d -T <stop time>`). The phone's figures are FXR-DEV-2's own (5, 7, 9, 11, 13, 15 + one large tag): the change of row 87 did not remove the per-step view | `42_m7_clients_verify.md` section 6 "0 lines; if not 0, the tags and counts go back with the frame log" |
| G89-03 | MAJOR (G81-02 was rated MINOR; rated up because three surfaces state the opposite of op 40 about the signature of real evidence, beside the correct line) | A REAL Ed25519 signature (`simulated: false`) is labelled simulated or demo: W2 Hash & Integrity "SEALED VALUES - Manifest signature (simulated) - A simulated signature for this demo, not a real cryptographic signature." directly above "Signed with a DEVELOPMENT key ..."; T Session Summary chip "SIMULATED" beside Signature (`summary-signature-simulated`, `t2_03`); T detail "SIGNATURE (ED25519, DEMO KEY)" over `Key: CORE-KEY-EVSIGN-01` (`t2_05`) | items `EV-20261010-0014` / `-0015` of lane 2 | op 40 `signature {algorithm Ed25519, keyId CORE-KEY-EVSIGN-01, simulated false}`; ev C.2 |
| G89-04 | MINOR | A v2 item shows the v1 rows before a verify run in the page: W2 "VIDEO-01 ... AUDIO-01 - MIC 1 ... AUDIO-02 - MIC 2 ... Manifest digest, Ed25519 signature: Pending" (a v2 package has no AUDIO-02); T / P "PER-TRACK SHA-256" lists MIC 1 / MIC 2 with "-" | `w2_04`, `t2_05` | `42` section 1: "a v2 item never shows the six v1 rows" |
| G89-05 | MINOR | The v1 source line is not built: `common.sourceClass.verify.v1` ("Sources: not recorded (v1 package)") has no reader in either client; a v1 item shows no source line on W1 / W2 / T / P | `grep "verify\.v1" apps/*/src`: 0 | `10_test_strategy.md` `M7-DEVSRC-EVID-*`; ev B.12 compatibility |
| G89-06 | MINOR (R88-12 live) | A reset that removes a development session's package keeps its session key, and the next session with the same ID seals under it: `KID-SES-20261010-0024.key` is dated 13:26:47 (gate 75); the sessions of gate 81 and my session A (three database epochs, three different recordings) were sealed under that one key. Demo keys ARE renewed | file names and times under `credential-store/session-keys-<scope>/` (no content read) | cap D.2 "one random key per session, no reuse"; ev H.7 item 1 states the bound as "the fragments of ONE session" - not true on a lane |
| G89-07 | NOTE (R88-27 live) | `.capture-session/<sessionId>.json` survives the seal and the reset; a new session with the same ID overwrites it (checked: `startRecordedAt` was the new one), `-0025.json` of the earlier epoch lay beside my session A | store listing | - |
| G89-08 | NOTE (explains G81-08) | `timeline.sealedAt` = `signature.signedAt` = the BUILD_MANIFEST instant, before SIGN and STORE ran; op 83 then reports `STORE_SEALED_PACKAGE startedAt 1791616853858 > completedAt 1791616853801`, `durationMs 0`. The signed manifest's `sealing.steps[]` holds 3 of the 6 steps (it cannot hold its own later steps) | manifest A; op 83 poll | ev B.8 "one entry per step" |
| G89-09 | MINOR | The item page of a v2 DEMO item shows the bundled v1 package's values under "SEALED VALUES - DEMO": four track hashes incl. AUDIO-02, manifest hash `6f93e793...`, "DEMO key DEMO-KEY-EVSIGN-01", signed 30 Sep - beside the Core's verdict on the v2 package whose manifest hash is another and whose key is `CORE-KEY-EVSIGN-01`; "Bundled demo package ... FAIL" | W2 `EV-20261009-0005` | two packages' facts under one ID |
| G89-10 | NOTE | `device.certificate.sha256` is the SHA-256 of the certificate's DER; `shasum device-certificate.pem` gives another value. The spec says "its sha256" | OWN | ev D V-13, B.3 field 27 |
| G89-11 | MINOR | Simulated seal: the phone reads "About 1 s left" from 0 % to 81 % (about 11 s) while op 83 answered `etaMs` 4644 falling to 693 | `seq/pP_strip.png`; the limit `42` section 5 names | R-6 AC-2 "the Core's ETA" |
| G89-12 | NOTE | Track `durationMs` exceeds the wall span of the session: A `VIDEO-01 68878` against `stoppedAt - startedAt = 68405`. Cause not determined (held first frame / camera timeline) | manifest A | - |
| G89-13 | NOTE | The tablet drew Finalizing 0 / 16 / 50 / 83 % between 14:20:55 and 14:21:01 although the Core was SEALED at 14:20:53.9. Emulator speed or a paced draw: not determined | `seq/tA_*` file times | - |
| G89-14 | NOTE | Reproduced: G75-05 (`FAULT_RAISED` of the worker kill carries no `reason`), G75-10 (web header "CRITICAL An integrity check failed" after the interrupted seal; the alert was inactive after the Core restart), G81-10 ("No DEMO media" on a REAL item), G81-13 (a first tap on "Evidence" from Home did not navigate on the PHONE; the second did), R88-21 (`interrupted: false` answered beside a failed V-03); the phone's verify text says "this tablet shows it as it is" | W2, T, P | - |
| G75-01, G75-03, G75-08 | as before | reproduced: sections 5, 4.3 | - | - |

## 7. C2 and C3 (hand-over of gate 64)

**C2 - field 40 in a product-sealed package, against the worker's measurement.**
`tracks[].clockOffsetMs` = **0** for `VIDEO-01` and `VIDEO-02` in A and B. It IS the value the Core
recorded from the built worker (`capture-worker/0.5.0`): facts file
`.capture-session/SES-20261010-0024.json` `measuredClockOffsetMs: 0` (both cameras; `clockOffsetMs: 0`
of the adapter beside it, `syncLevel F_FULLFSYNC`); Core log 404 ms after the start record:
`CAPTURE_CLOCK_OFFSET_MEASURED ... "deviceId":"CAM-01","offsetMs":0,"advisoryMs":500,"above":false`
and the same for `CAM-02`. Rule in code: `capture-session/index.ts:749-752`, the first
`TELEMETRY.clocks[].lagMs` per worker attempt, `Math.round(-lagMs)`. **Sign:** camera minus Core by
that rule; **not demonstrable from these packages - a zero has no sign.** **Size:** below 0.5 ms
(the raw first `lagMs` is logged nowhere I may read). The worker's own log shows another statistic,
`camera_clock_floor lag_ms 30.6` / `30.0` (the smallest lag of the first 58 packets), 1.7 s later; the
"about 20 ms" of note 118 decision 4 was not seen in field 40. So: source chain PASS; a non-zero value
with a sign has still only been seen with the fake worker in the db test of note 118. And 0 is also the
stand-in (R88-16): from the manifest alone nobody can tell this measured 0 from "not measured".

**C3 - does a sealed package mark a track whose camera was given up by the clock floor?** **No.**
Nothing in the manifest schema, the pipeline or the evidence spec names it (`grep -i "clock floor\|
CAMERA_CLOCK_OUT_OF_BOUND"` over `06_evidence_package_spec.md`, `evidence-package/*.ts`,
`sealing/pipeline/*.ts`, `sealing-host/*.ts`: 0 hits; `R63-16` is in no decision). What a package
would carry: the camera's file with whatever was written, or its absence (`absentTracks` in the signed
`CLOSE_TRACKS` record, PE-M7-01) - and the reason only as the `FAULT_RAISED` row in the UNSIGNED
extract. NOT DRIVEN LIVE (a FAKE source's clock cannot be offset on a lane). Neither ruled nor
recorded as a limit: open, with G75-01 making the extract an unfit carrier.

## 8. Docs sentences marked "Gate 89" (`47_m9_docs.md` section rows 4, 6-9)

| Row | Sentence | Result |
|---|---|---|
| 4 | `tracks[].clockOffsetMs` in a product-sealed package | seen: 0 (C2) |
| 6 | the INCOMPLETE state on both clients; `SEAL_BLOCKED` in a running Core | NOT DRIVEN LIVE |
| 7 | removal by proof; the kept-plaintext alert in a running Core | removal seen (two sessions, no plaintext left); the alert NOT DRIVEN |
| 8 | the notices and the development marks as both clients show them; the server-backend model line | PASS on W2 and T; the model line not run (server backend, user's rule) |
| 9 | the version-2 tamper demonstration in the clients | PASS on W2 and T |

## 9. Not covered, and why

1. **Kill matrix (35 cells) and seal e2e (3 cases) on `f293221`.** `test/06` ran them before pass F-Z;
   gate 64 records that F-Z then changed `sealing-host/index.ts` and `modules/sessions/routes.ts`
   (`08_m3_gate.md:40`), and both suites are env-gated, so they were among the "3 skipped" files of
   gate 64's db run. They have not run on the committed tree. Not run by me: the lanes are up (ports
   8554 / 8556). My sessions A and B are the live equivalent of e2e cases (a) and (b) only. Owner:
   row 95 (final regression), one run each with the lanes stopped.
2. Everything that needs a broken or absent file: one-camera seal, prefix seal with `truncated`,
   retry, `SEAL_BLOCKED`, UNSEALABLE on both clients, the kept-plaintext alert, the boot sweep acting.
3. A seal resumed by RECOVERY as the clients show it ("Resumed after restart", max-seen): the seal is
   too short to interrupt with the lane script.
4. The phone on a v2 package (`M7-VV-PHONE`, `M7-DEVSRC-EVID-P`, the phone half of the tamper demo).
5. `M7-CONN-W-CRED`; the unreachable-PARTIAL package; the server-backend model line; revisions
   (V-11 after an append: no transcript with segments exists, gate 81 C1 / C2).
6. `M7-SEC-SRC-2` as SQL over every lane; the boot refusals of a production Core.
7. Simulated-mode badge rule of `M7-DEVSRC-EVID-*` (no v2 item exists on a simulated lane).
8. `masterplan/02_plan.md` and `implementation/99_implementation_report.md` were not written: the
   task asked for this one file.

## 10. Skipped

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the tablet's "Enable biometric sign-in" offer was declined once ("Not now") |
| Local devices, attendance variables | never selected or set; no local-device notice was part of a flow here |
| STT server | never called; no STT timing figure is stated anywhere in this report (D230; the durations quoted are sealing steps) |

## 11. Screenshots (`.cache/gates/89/`)

Read by me:

| File | Shows |
|---|---|
| `t2_01_small.png` | tablet Home during session A: "Recording SES-20261010-0024", REC 00:00:29, the biometric offer over it |
| `t2_02_small.png` | tablet Active Session: Recording 00:00:41, MIC 2 Active after the web's switch, development-source chips, timeline "Evidence Auto-Save - Autosave segment 1", test picture captioned "LIVE / DEMO" |
| `seq/s_tA_04, 07, 09, 11, 13, 14.png` | tablet Finalizing 0 % -> 16 % -> 50 % -> 83 % -> 83 % -> Session Summary "SEALED ... Sealed 0.6 s after the recording ended" |
| `t2_03_small.png` | tablet Session Summary of A: six steps done, hashes, "Signature SIMULATED", Start / End Time chips "GNSS" |
| `t2_05_small.png` | tablet Evidence Details of A: MIC 1 / MIC 2 track rows with "-", "SIGNATURE (ED25519, DEMO KEY)", "Key: CORE-KEY-EVSIGN-01", "Signed with a DEVELOPMENT key - not a production signature" |
| `t2_07_small.png` | tablet tamper demo: FAIL, development sources block, development-key line, VIDEO-02 file FAIL, "Where it failed - VIDEO-02 fragment 3 tampered ...", 11 of 15 |
| `w2_05_verify_pass.png` | web item A, Hash & Integrity: PASS, "DEVELOPMENT SOURCES ..." with four entries, development-key line, "Transcript disabled by configuration", toast "Integrity verified: EV-20261010-0014 PASS" |
| `w2_06_tamper_demo.png` | web `EV-20261009-0005`: FAIL, both development blocks, VIDEO-01 file PASS, VIDEO-02 file FAIL; the demo poster picture above |
| `w2_07_after_kill.png` | web dialog after the worker kill: "Evidence sealed", six steps done, "SEALED - Evidence EV-20261010-0015 sealed"; no word of an interruption |
| `p1_01_small.png` | phone Home, lane 1: Ready for Recording (after a first tap on Evidence that did not navigate) |
| `p1_03_small.png` | phone Home during the simulated session: "Session in progress", REC 00:00:17 |
| `seq/pP_strip.png` | six phone frames of Finalizing: 0, 14, 33, 49, 66, 81 %, each "About 1 s left" |

Taken but NOT read as pictures (their text was read from the DOM or the view tree): `w2_01`, `w2_02`,
`w2_03`, `w2_04`, `w2_08`, `w1_01`, `t2_04`, `t2_06`, `t2_08`, `t2_09`, `t2_10`, `p1_02`, `p1_04`,
the rest of `seq/`.

## 12. Tooling lapses to record

- My `pkill -KILL -f build/capture-worker` also ended my own background shells whose command line
  held that string: the tablet screenshot burst of session B stopped after two frames (so the tablet's
  Finalizing of B was not captured; its Summary was read afterwards). A gate that kills the worker
  should start its observers in another command.
- My 60 ms poll of `session/current` reached the Core's rate limit once (`RATE_LIMITED ... operator:
  OPR-002`, 14:30:50): my tool's doing.
- The view tree printed the published demo password line of the Login's "Demo operators" list into
  my tool output; it is in no file I wrote.
- After the end reset I ran op 41 twice on the demo items; lane 2 was therefore reset once more
  (third reset) so that it is the pristine seed.

## 13. Environment as left - what later gates must know

| Item | State |
|---|---|
| Lanes | 1 and 2 RUNNING (PIDs 72245 / 72529), web 5176 / 5177 and Metro up; both reset to the seed at the end (`audit head seq 83`), nothing done on them after it but two anonymous health reads; 0 warn / error lines in both logs |
| Lane 2 store | the two seed demo packages only: `EV-20261008-0001` (`manifestSha256 3a099cf1...`), `EV-20261009-0005` (`1d70ae06...`, altered); no session open, no alert, selector unlocked. Left by design of the product: `.capture-session/SES-20261010-0024.json` / `-0025.json`, session keys `KID-SES-20261010-0024` / `-0025` (13:26 / 13:29) |
| Lane 2 STT | enabled, `cpu-local`, as the seed; `revision 5` (kept table: off at 14:17, on at 14:42) |
| Devices | tablet and phone relaunched to Login, "Core online", "paired as DEV-0001"; reverse rules intact (4422 / 4421); no re-pairing, no lock change, biometric not enabled |
| Processes | no `capture-worker`, no headless browser of mine; every cookie jar removed; my package copies and the throw-away key deleted (`.cache/gates/89/copy_*`, `attacker/`) |
| Kept under `.cache/gates/89/` | `verify_own.mjs`, `product_verify.mts`, `cdp.mjs`, `ui.mjs`, `tap.mjs`, `poll_seal.mjs`; `own_verify_A.txt` / `_B.txt`; `op41_*.json`; `core_lane2_run1.log` (the Core log of sessions A and B, the lane log is truncated at each start); the three logcat files; lane logs; screenshots |
| For gate 94 and the fix rows | (1) a REAL item carries "simulated" / "DEMO KEY" labels and "No DEMO media" (G89-03, G81-10): judge the playback surfaces knowing it; (2) session IDs repeat after every reset and the session key is reused (G89-06): an export / decrypt test should not assume a fresh key; (3) the seal of a short FAKE session takes about half a second: nothing in FINALIZING can be caught by hand; (4) do not start observers in the same command line as a `pkill -f`; (5) `stt_config` survives a reset |

---
*Generated: 2026-10-10 14:50 WIB*
