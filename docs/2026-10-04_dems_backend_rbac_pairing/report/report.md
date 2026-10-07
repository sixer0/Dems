# Final report — DEMS backend (PostgreSQL), integrated RBAC and portal-mobile pairing

**Task folder:** `docs/2026-10-04_dems_backend_rbac_pairing/` · **Dates:** 2026-10-04 to 2026-10-07 · **Controller:** master-controller (main thread) · **Report inputs:** `report/01_report_inputs.md` (W102, gated D257) · **Final verification:** `verification/01_verification.md` (W101, gated D256)

## 1. Outcome

The demo stack now runs against a real backend: a Fastify Core server on PostgreSQL 18 (project-local, `127.0.0.1:4432`), 75 contract operations with server-side RBAC and audit, portal-to-mobile pairing with revocation, and both clients (web console and mobile app) working in Live mode through every page and screen. Simulated mode and the 0.1.0 release packages are unchanged.

| Success criterion | Result | Evidence |
|---|---|---|
| SC1 spec and plan before implementation | PASS | `4b708c8` 06:25:02 before W01 06:26:37 |
| SC2 documented start, migrations, seed, restart survival | PASS | W90 `verification/03_clean_state_rebuild.md`, D240 |
| SC3 both clients on the backend, actions shown on the other | PASS | W95 `verification/04_e2e_shared_state.md`, D249 |
| SC4 RBAC per endpoint, audited denial, live role change | PASS | W47 `test/02_rbac_matrix.md`, W96 `verification/05_e2e_rbac.md`, D249 |
| SC5 pairing gate, listing, revocation, audit per step | PASS | W48 `test/04_pairing_lifecycle.md`, W94 `verification/06_e2e_pairing.md`, D249 |
| SC6 OpenAPI covers every endpoint, drift test, live API Reference | PASS | D185, D187, D247 |
| SC7 existing suites and new backend tests pass | CAUTION (acknowledged) | every workspace green on the final tree; the all-cores root run shows load flakes that pass alone — D256 |
| SC8 Simulated mode and 0.1.0 packages still work | PASS | W97 `verification/07_regression_simulated_release.md`, D253 |
| SC9 decisions, drift, findings recorded | PASS after D257 | D1-D257, DR-01-DR-15, F1-F79, continuous |
| SC10 no secret committed, nothing sent out | CAUTION (acknowledged) | W99/W100 (D248, D251): 0 secret hits; `npm audit` 99 high / 0 critical, none on the Core runtime path |
| SC11 README gives the exact Live commands | PASS | D188; W90 "README deviations: none" |

**Open blockers: zero.**

## 2. Verification evidence (highlights)

- **Final test ledger (final tree):** shared 71 files / 1,851 tests; core-web 117 / 1,495; mobile 192 suites / 1,988; core-server unit 160 / 3,954; core-server db 124 / 1,751; mock-core 19; pg-scripts 57; root typecheck and lint exit 0 (D247, D254, D256).
- **End-to-end round in Live mode (D194-D237):** every web page as Supervisor (189 commands), as Investigator and Technician, two consoles live; every phone screen (27/27) and tablet screen (36/38); shared state, live role change, pairing/revoke; 24 defects found in round 1 (1 High: the chain of custody named the session creator as the one who stopped a recording), fixed in three fix rounds and re-tested; final independent check 7/7 (D237). Evidence galleries: `report/e2e_evidence_gallery_round1.html` (770 captures) and `report/e2e_evidence_gallery_final.html` (625 captures, before/after pairs).
- **After the clean rebuild (W90):** short confirmations W94-W96 PASS on the main instance with all three devices re-paired (D249); regression W97 PASS (D253); reduced performance W98 recorded (D252): Core under 1.2 % of one core with three clients, zero meter-frame rows stored, 0 long tasks on Session Monitor.
- **Reviews:** code reviews W91/W92/W93 approved with comments, fixed in FXR-S/W/M and re-checked (RC, D255); security reviews W99/W100 CAUTION acknowledged (D248, D251); secret sweeps of all captures (D215, SW2).

## 3. Open items (43, none blocking — full table in `report/01_report_inputs.md` §4)

**Pre-handover verification session (release build, detailed testing as the user decided in D233):** revoke-to-Pair under 1 s (A1); monitor timer lag and stale monitor under load, frame statistics (A2); the tablet learning of a web stop late under load — cause not established, data points to an overloaded app thread (A3, D252); the Sessions hub duration stepping back once after a late stop (A4, D255); the biometric device test, skipped by the user (A5, D231); repeated test campaigns (A6).

**Next phase:** the decided scope D219-D230 (device selector, real capture worker behind the API, one active microphone with a manual toggle, one whole file per camera, local CPU transcription with speaker labels inside the sealed package, rooms blocked until sealed; impact map `research/10_next_phase_impact_map.md`); dependency refresh for the `npm audit` highs (B2); W99-2/3/4 hardening before any use beyond one loopback computer (B3, B4); the `live-sim.ts` split and other deferred review items (B5-B9, B12); tests independent of wall-clock time (B10); packaging leftovers (B13); QR scanning (B14).

**Statements carried into this report (from the inputs, D184/D172/D242/D251):** the W83 contract residuals R-C1..R-C6 and R-D2..R-D5 stay documented in `implementation/83_contract_closeout.md`; RESIDUAL-W77-1 (Users & Roles not refreshed when someone signs in or out elsewhere) is accepted; the R3 change moves Test signal to `DIAGNOSTICS_RUN` (amends spec S20 grouping); an offline sign-out on the phone is not retried, the server session idles out after 15 minutes (accepted, W100-2). The published demo credentials in the README are for synthetic accounts only; any network exposure beyond loopback first needs them replaced.

## 4. Decisions waiting for the user (defaults apply if nothing is said)

| # | Decision | Default |
|---|---|---|
| C1 | Delete the realtime test-support shim that has no importers (D245) | Keep |
| C2 | Delete the predecessor's AVDs `dems_*` (15.4 GB) | Keep |
| C3 | After handover: delete this task's AVDs `dems2_*` (7.0 GB) and remove your own emulator lock | Keep |
| C4 | Point the backend at the host's PostgreSQL on `*:5432` (not this task's) | Keep the project-local instance |
| C5 | Allow a web-only Live demo to record without a paired tablet (F69) | As specified (no) |
| C6 | Remove `.git/refs/.DS_Store` (makes `git fsck` exit 8) | Leave |
| C7 | Biometric device test at handover | Skip stays (D231) |
| C8 | Host clean-up after handover (section 5) | Nothing removed |
| C9 | Standing handover information (password replacement before network exposure; Live package for another PC is a separate task; STT runtime install needs your approval) | Information only |

## 5. Host state left behind

Project-local PostgreSQL 18 (data in `.data/`, scripts in `scripts/pg/`, running on `127.0.0.1:4432`), three booted emulators `dems2_phone`, `dems2_tablet`, `dems2_phone2` paired to the main instance (DEV-0003, DEV-0004, DEV-0005), adb reverse `tcp:8081` and `tcp:4420` on each, `.cache/` (rollback copies, scratch folders, manual-stack logs; ~1.25 GB), `.locks/`, and the Playwright browser cache (pre-existing). The orphaned `adb logcat` readers found by W102 were stopped (D257). Removal commands for each item: `report/01_report_inputs.md` §5 (4.4); none are run without the user's instruction (C8).

## 6. Commit

Local commit only, no remote (D1). Staging rules for W103 are in D257: evidence logs enter via `!docs/**/assets/*.log` after a count-only secret scan; the six frame-dump folders are ignored with `docs/**/rec/*_frames/`; `release/`, `.data/`, `.cache/`, `.locks/`, env files, credential files, `apps/mobile/signing/` and the design book are never staged. **Commit `0a9e31728af6a917e2f67f7692825985ec2f5a55`** on `main` (parent `057fc17`): 4,601 files, staged blobs 1,203 MiB; credential scan of the staged content 0 hits; `git remote -v` empty; `.git` now 1.5 GB (local; evidence can be moved out later, e.g. to Git LFS or an archive, if the repository is ever pushed). Details: `report/02_git_final_commit.md` (W103, D259). A follow-up docs commit carries this report's final state.

## 7. Agents and models

Delegation trail: `delegation_progress_report.md`. All rows ran on the reasoning tier (Opus 5.5) except two mechanical configuration rows downgraded to Sonnet 5.5 per CLAUDE.md §11 (T1 jest timeout, T2 jest worker cap; D247, D256). Stream stalls on the agent side were resumed from their last state (D196 period, D245, RF-PH).
