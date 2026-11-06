# DEMS team audit report, 2026-11-06 (public version)

This is the sanitized summary of an audit, fix and tablet-adaptation task on the DEMS bench host, 2026-11-05 to 2026-11-06. It is written for the team audit of this repository.

- Network addresses, account names, credentials, host file paths and log request identifiers have been left out on purpose.
- Commit hashes, decision numbers (Dn) and blueprint row numbers are kept, so that every claim can be traced.
- The full decision log (D1-D277) and the detailed reports are kept with the task documents, **outside this repository**.

## 1. Executive summary

**Mission 1: audit and fix. Closed (D158).**
- 163 inventoried functions in 11 channels were judged and triaged into 56 defect rows.
- They were fixed in three waves: W1, W2 and W3.
- Each wave was deployed to the bench production install from a separate git worktree. The backup was taken first.
- Migrations 0042, 0043 and 0044 were applied.
- The user's new camera N <-> mic N pairing (D5) is built end to end:
  - contract;
  - capture protocol 6;
  - capture-worker 0.8.0;
  - sealing manifest /2.1;
  - verifier.
- **No real 4+4 recording has proven it yet** (D153).

**W4 fix wave: live as 8962f16b (D246).** It fixed:
- mic levels for channels 3/4;
- microphone reach;
- previews on Dashboard and Session monitor;
- the LCD camera lamp.

**Mission 3: tablet app adapted to the new Core.**
- Cycle 1 committed as cf59429e; full jest 3428/3428.
- Cycle 2 committed as d6146ce4.
- The Core server address setting, which the user requested, committed as f41972f9.
- A release APK for a real-device test was built from f41972f9.
- The cycle-2 fixes have **no on-device proof**. The emulator re-judge was blocked by a stale JS bundle (D262), and the user then stopped all missions (D273).

**Mission 2 (end-to-end UI judging panel): postponed.** Only its fix items ran, as W4.

**This repository.** The full history of branch audit/fix-20261105 was merged into main as 8b829aba (D272). The pre-publication scan gave CAUTION with no blocker.

**Not done.** The full end-of-mission verification gate that D1 requires was never run.

## 2. Scope and the user's instructions

| Mission | Content | Status |
|---|---|---|
| M1 | Audit and fix of the team's updates (commits e05a1567..53513b0c plus the tablet LIVE-only work); D5 pairing | Closed (D158) |
| M2 | End-to-end UI judging panel (rows 51-58) | Postponed (D262, D273) |
| M3 | Tablet app aligned to the new Core (D8) | Code complete; cycle 2 not proven on a device (D273) |

Key instructions from the user:

| D | Instruction | Effect |
|---|---|---|
| D1 | "gate full hanya dikerjakan di akhir misi..." | Full gate once at the end, minimal gates during the work |
| D2 | "Branch di host + pause agen lain" | Fixes in a worktree, deploy per file with backup |
| D4 | Tablet judged on an emulator | Emulator on the Mac |
| D5 | "mic ditentukan dari setup, ... pair camera 1-mic 1 sampai camera 4-mic4" | VIDEO-0N <-> MIC-0N pairing |
| D7 | Two failed fix cycles: park the function and move on | Parking rule |
| D8 | Add Mission 3 (tablet) | M3 |
| D11 | Fix root causes upstream to downstream and check the domino effect | Every fix row |
| D12, D16 | Full autonomy, every decision logged, no questions until the end | Controller decisions |
| D148 | "tukar setelah misi1, misi3 terlebih dahulu" | M3 before M2 |
| D232 | Fixes first | W4 wave |
| D236 / D247 | Pause after the Core update / "Checked, continue" | User check of W4 |
| D248 | Speed up Mission 3 | Fast path for cycle 2 |
| D262 | Close after the tablet mission, postpone M2, deliver an APK | Release APK |
| D263 | Make the tablet's Core host address configurable | Rows 236/237 |
| D270 | Publish publicly for a team audit; make it private afterwards | Public repository |
| D273 | "stop all mission, fokus ke push ke github dan dokumentasi komprehensif akhir" | All missions stopped |

Overrides of earlier specs were allowed, and each was logged. They never overrode security rules, boot checks, identity gates, evidence/audit integrity, or the user's word on hard actions (D6, D12).

## 3. Environment

- **The bench host** runs the DEMS units: core API, web console, LCD backend, PostgreSQL 18 cluster, plus a loopback firewall rule and a Wi-Fi watchdog. All are bound to loopback and reached over an SSH forward from the Mac.
- **The team's source tree** stayed on branch task4/input-av-core-port at 53513b0c, with 17 uncommitted tablet files (the HOLD lane).
- **All fixes went into a separate worktree** on branch audit/fix-20261105. Deploys copied single files into the runtime install after a backup.
- **Other writers.** Another local agent toolchain was paused, and a remote agent was isolated by the worktree (D17).
- **Tablet builds** were made on the Mac from a separate clean clone of the branch.
- **Judging** ran on an Android emulator through adb reverse. A second Metro bundler served the worktree for the emulator; the team's own bundler was left alone (D161, D166).

Branch chain: 53513b0c -> b11950d6 (W1) -> 7bc77bfa (W1 cycle 2) -> 5191c8d7 (W2) -> e5dea409 (W2c2) -> 37891824 (W3) -> cf59429e (M3 c1) -> 8962f16b (W4) -> d6146ce4 (M3 c2) -> f41972f9 (Core address) -> e9f48469 (README).

## 4. Mission 1 (W1-W3)

**First fix (D15).** The deployed capture-worker predated the 4-camera/4-mic changes and refused every 4+4 plan (PLAN_INVALID), while its boot check still passed.
- It was rebuilt and deployed, and the faulted session SES-20261105-0032 was recovered.
- Guard against a repeat: worker 0.7.0, a build stamp and boot check 5b (D44, D48).

**W1** (D89). Fixes:
- 12-item pre-check (D53).
- Migration 0042: missing camera FKs and renamed mic FKs (D36).
- Migration 0043: the purge keeps evidence-chain audit types, and the reseal function never NULLs the head (D51, D68).
- The engine adopts a resealed chain (D43).
- Mic ids derived from the capture configuration (D39, D82, D87).
- Source facts (D42).
- Camera link watch with a sweep on link-up (D41, D61).
- Default camera credential limited to the camera /24 (D64).
- Production console LIVE-only lock (D47).
- "Not reported" instead of synthetic values (D52, D57).
- System principal hardening (D37).
- op 66 refused on an own-capture Core (D83).
- LCD 'both' logo refused, and validation before save (D35, D79).
- openapi regenerated (D59).

**W2** (D115). Fixes:
- checkedAt/reach state (D90, D94).
- Device status from the assigned device plus reach in web, Core and pre-check (D97, D100, D104).
- Registered lists (D92).
- Reach-gated previews (D95, D98).
- System principal permissions frozen; purge-kept accounts terminal (D91, D93).
- Device commands refused instead of writing "(simulated)" audit rows (D96).

**W3, the D5 pairing:**
- Contract (D116).
- Protocol 6 with worker 0.8.0 in lockstep (D117).
- Migration 0044 accepts AUDIO-01..04 fragments (D118).
- Plan pairs each camera with its mic (D124).
- Per-channel worker encoder (D135).
- Sealing /2.1 with a signed missing-mic statement and quarantine instead of deletion (D128).
- The verifier reads /2.1; legacy packages verify byte-identical (D119, D122).
- op 81 retired (D136).
- Pair rows and a confirmed swap in the web (D125, D126).
- Durability counts camera files only (D151).

**Deploys:**

| Deploy | Commit | Files | Downtime | Migrations / worker | D |
|---|---|---|---|---|---|
| W1 | b11950d6 | 173 | about 9.2 s | 0042 + 0043; worker 0.7.0 + stamp | D73 |
| W1 cycle 2 | 7bc77bfa | 20 | about 2.5 s | none | D87 |
| W2 | 5191c8d7 | 90 | about 5.3 s | none | D110 |
| W2c2 | e5dea409 | 7 | console only | none | D115 |
| W3 | 37891824 | 197 | about 7.8 s | 0044; worker 0.8.0 + stamp | D156 |
| W4 | 8962f16b | 33 | about 1.2 s | none | D246 |

**DB tests.** They need the production database port, so they ran only in announced DB windows: dump, stop, test, restore and smoke (D32). Each window is logged with its duration and its backup.

**Re-judges:**
- W1: 11 PASS (D76); 33 PASS / 1 FAIL, then fixed (D81); 9 PASS / 2 FAIL, then fixed (D77).
- W2: 28 PASS / 0 FAIL (D113); 18 PASS / 0 FAIL (D112).
- W3: 18 PASS / 0 FAIL (D158); 0 FAIL (D157).

**Residual (D153).** Gated D5 end-to-end tests cannot run on this host: the product's own trust rules refuse the test setups. D5 is proven by its parts (unit, DB, real-worker media pairs, verifier, sealing tests). **The first real 4+4 session is a mandatory acceptance test before operational use.**

## 5. W4 fix wave (D232-D246)

| Row | Change | D |
|---|---|---|
| W4-1 | Dashboard and Session monitor thumbnails use the reach-gated live preview; streams close on a hidden tab | D239 |
| W4-2 | Devices view route, PoE not counted on self-capture, one mic status reader | D238 |
| W4-3 | Diagnosis: idle mic levels were forwarded by role (ch1 primary, ch2-4 standby), and standby mapped only to MIC-02, so channels 3/4 never showed a level | D235 |
| W4-6 | Levels carry the mic id and are resolved by id first | D240 |
| W4-7 | The Core states mic reach from its idle level reading | D243 |
| W4-8 | Session New preview closes on a hidden tab | D241 |
| W4-4 | LCD camera lamp lit only on stated reach (or a live stream) | D234 |
| W4-5 | Stale "8 checks" comments | D233 |
| U-18 | Not reproduced; parked with a capture plan | D242 |

- **Gate (DBW4):** green; shared 3013/3013, core-web 1904/1904 (D244).
- **Commit and deploy:** 8962f16b (33 files), about 1.2 s downtime (D245, D246).
- **CPU (D249):** 4 preview pipelines at 26.5-31.5 % of one core each. The load during a recording is still to be measured.

## 6. Mission 3 (tablet)

**Accepted rows**, all in the decision log:

| Rows | Change | D |
|---|---|---|
| 169, 170, 171, 174, 175, 223 | HOLD lane adopted; release builds LIVE-only; no simulated switch in release | D160, D169, D174, D199, D208, D190 |
| 172, 224 | Sign-out gaps; owed sign-out kept and paid on link-up | D188, D211 |
| 181, 182, 183, 184 | 12-item pre-check (crash fixed), live readiness, 4-pair previews, count pins | D167, D197, D172, D206 |
| 185, 186, 187, 188, 189 | op 81 retired, paired-mic notices, swap body, confirm dialog | D177, D170, D200, D175, D210 |
| 190, 191, 192, 222 | Roster and status from the assigned device; registered detail route | D173, D187, D195, D220 |
| 193, 194, 195, 196 | Live camera preview: renderer spike, reach gate, one transport file, 4 mounts | D202, D185, D218, D219 |
| 197, 198, 199, 200 | Core id and "Not reported" rules | D168, D213, D205, D212 |
| 201, 202, 203 | Device commands blocked on own capture; offline alert; fault-cleared mark | D198, D203, D182 |
| 204-208 | 8-track order, verify bound 10, pair audio in integrity and verify views | D180, D184, D171, D209, D201 |
| 209, 210, 211, 226, 227 | Pair words, hygiene, integration pass, attention line | D194, D191, D207, D214, D215 |
| 176, 177 | Cleartext plugin (later replaced), spec line | D183, D181 |
| 229-235 | Cycle 2: defects F1-F6 and L7 from judging round 1 | D250-D256 |
| 236, 237 | Core server address setting; release cleartext config | D265, D264 |

**Gates:**
- Gate 213: tsc 0; jest 290/290 suites, 3428/3428 tests; lint 0 errors (D221).
- Gate 218: tsc 0; green after one test-expectation fix-up (D258).
- Rows 236/237: jest 3523/3523 (D265).

**Commits:** cf59429e (140 files, D222); d6146ce4 (28 files, D260); f41972f9 (29 files, D266); README e9f48469 (D271).

**APKs** (kept outside the repository):

| APK | sha256 | State |
|---|---|---|
| debug, from cf59429e | 448b3f3726aab93c15c39b93eb0b45fdd9266a162084ff1fcfadada1ce5c09e1 | Installed on the emulator (D224) |
| release, from cf59429e | 1aa42b423ce115aca22c803b0a908e235efff2694947f1deef34cd6f2b429813 | Built and checked, not installed (D225) |
| release, from f41972f9 | 21315b538da7bdcaa1519a951b0eb6e11ae09f680b680ed05cdbe6ab87f76258 | For the user's real-device test. Demo signing key (signer SHA-256 995c1e389ed7df89f3e79a1690b2c14dc7376d928249bbf01de3c83272fd1647), not debuggable, includes the Core address screen (D267) |

Real-device caveats:
- Replacing a debug install needs an uninstall, which removes the pairing.
- LAN http/ws from a real device is not proven yet.
- Tablet builds older than the W1-W3 contracts cannot talk to this Core (D90).

**Re-pair (D204, D226).**
- The emulator's old credential came from a different Core, which is why production answered 401.
- The emulator was re-paired as **DEV-0002**.
- A real tablet already paired with production (DEV-0001) belongs to someone else and was never touched.

**Judging round 1 (D237).** 90 scored lines:

| Verdict | Count |
|---|---|
| PASS | 56 |
| FAIL (6 defects, F1-F6) | 10 |
| BLOCKED-HARDWARE | 7 |
| BLOCKED-CREDENTIAL | 1 |
| BLOCKED (no-save limit) | 2 |
| data-absent | 14 |

There were no retired calls, and no auth errors. All six defects were fixed in cycle 2.

**Round 2: UNVERIFIED-ON-DEVICE (D262, D273).** The re-judge found the tablet still running an old JS bundle, so it judged nothing. The user then stopped the work. Cycle 2 is proven by jest, tsc and eslint only. The user's real-device test of the f41972f9 APK replaces the re-judge.

**Core address feature (D263-D266).**
- Host and port are entered on the Pair screen, with a loopback default on port 4420, and shown read-only in Settings.
- One source supplies the Core origin for HTTP, WS and preview.
- Changing the address deletes the stored device credential.
- Public IPv4, IPv6 and any scheme or path are refused.
- Release builds allow cleartext in the base network config to reach a LAN Core. **TLS is the proper fix** (residual R263-TLS).

## 7. Mission 2: postponed

M2 never started as a panel. Its queue:
- The real 4+4 acceptance recording (needs a 4th mic and the missing camera back).
- The U-18 capture.
- Capture-configuration save and restore.
- The LCD save path.
- A LAN-down soak.
- Legacy verify through the UI, plus evidence and export views.
- The first real session's source facts.
- Recording-time CPU.

## 8. Deviations and controller lapses

| What | D |
|---|---|
| A draft session SES-20261106-0033 was created on production during tablet judging. The brief demanded a marker that is reachable only by pressing Next. It was armed, nothing was recorded, and it was cancelled. Three audit rows (AUD-002606, AUD-002607, AUD-002613) stay in the hash chain as the honest trail | D237 |
| A shared-file edit during tablet judging made the bundler hot-reload, which signed the tablet out. A code-freeze rule was added | D237 |
| The bundler served a stale bundle, so the cycle-2 re-judge was void | D262 |
| The controller stopped before entering the production sign-in credential and asked the user to sign in | D225, D226 |
| Scratch files on the host or in the docs during read-only rows; broad process kills that may have ended other rows' runs | D17, D49, D50, D80, D83 |
| W1 deployed in one lockstep deploy, not in the planned order; the migrate route was missing, so a reviewed harness was used | D71, D72 |
| The Core id update was skipped because its safety check could not be proven | D72 |
| The HIL-1 pause of the other writers was decided by the controller under autonomy | D17 |
| Earlier controller readings were corrected | D75, D89, D204, D229 |
| **The full end-of-mission gate (D1) never ran** | D1, D273 |
| End-of-task cleanup (test sessions, host scratch, emulator pairing) not done | D267, D273 |

## 9. GitHub publication

- The user asked for a push with README documentation (D268), and chose a **public** repository for the team audit, to be made private afterwards (D270).
- **README:** commit e9f48469 (D271).
- **Pre-publication scan** of the full history: **CAUTION, no blocker** (D272).
  - No real secret, key, keystore, token, signing material, DB dump or APK.
  - The demo accounts named in the README do not exist on production, and production refuses to boot with a demo credential.
- **CAUTION items:**
  - C1: demo credentials in the README and seed source (not live);
  - C2: an author mailbox address in commit metadata;
  - C3: deployment details in older docs;
  - C4: about 1.6 GB of history;
  - C5: screenshots and recordings not viewed one by one;
  - C6: a missing ignore rule for a root signing folder;
  - C7: two committed .pyc files.
- **Merge** 8b829aba: the audit branch merged into main with unrelated histories allowed, the initial commit kept, 142 commits on main (D272).
- **Push.** main was pushed and verified at 8b829aba (D276). A second push adds the bench configuration (`deploy/bench-config/`: systemd units, nft rule, `core.env.example` and a deploy-time self-configuration guide; the real production env file is not published, D274/D275) and this report.
- **What this repository holds:**
  - the code;
  - the earlier tasks' docs;
  - the README;
  - this report.
- **What it does not hold:** this task's decision log and detailed reports.

## 10. Open items and residuals

**Blocked:**
- Credential: storing the camera interface needs a technician account (D80); LCD setup live probe (D89); biometric sign-in.
- Environment: gated D5 end-to-end (D153); libx264 test build (D142).
- Hardware: PoE replug (row 47); the real 4+4 recording (row 168, D153), which needs a 4th mic (D229); one camera not answering (D228).
- Device: the cycle-2 tablet re-judge (D262, D273).

**Decisions for the user:**

| Item | D |
|---|---|
| R225-F1: runbook step before a DB-restoring rollback | D204 |
| R225-F2: unique Core id per install | D204 |
| R225-F3: tablet checks the Core id before sending its credential (partly done by D263) | D204 |
| R263-TLS: TLS between tablet and Core | D263 |
| R174-G5: biometric sign-in in release | D199 |
| R224-1 / R224-2: owed sign-out edge cases | D211 |
| U-18: parked | D242 |
| The 4+4 acceptance recording | D153 |
| Scan items C1-C7 | D272 |
| The DB-window script's worker version check (expects 0.7.0, production runs 0.8.0) | D244 |

**Later hygiene.** Retired i18n keys, test-only helpers, an optional Try-again prop, simulator leftovers, and debug log volume from MJPEG frames (D138, D214, D239, D247, D253, D256).

## 11. Recommended next steps

1. Switch the repository to private after the team audit. Share the real environment file only privately, never through git (D274).
2. Real-device test of the f41972f9 release APK.
3. Run the 4+4 acceptance recording once a 4th mic and all cameras are connected.
4. Run the D1 full gate once: verifier, security review, full suites, code review.
5. Resume Mission 2 if wanted.
6. Decide the items in section 10.
7. Clean up the test artifacts on the user's word.

## 12. Artifact index

- **In this repository:**
  - this file;
  - README.md (commit e9f48469);
  - the code of branch audit/fix-20261105 (commits listed in section 3).
- **Outside this repository, with the task documents:**
  - the decision log D1-D273;
  - the status log;
  - deploy, commit, judging, gate and scan reports;
  - the APK files.

---
*Generated: 2026-11-06*
