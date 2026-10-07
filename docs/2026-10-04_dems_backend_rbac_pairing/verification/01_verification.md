---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
row: W101 (blueprint 116) - Final verification of SC1 to SC11
agent: verifier (tier R)
date: 2026-10-07
source_plan: masterplan/02_plan.md row W101 (line 780); SC map section 13.4 (lines 1349-1363); masterplan/01_specs.md SC table (lines 1872-1884)
closing_test_rule: decisions/decisions.md D239 (root npm test once more at the final pre-commit gate)
narrative_tier: 1
status: needs-review
verdict: 8 PASS, 3 CAUTION, 0 FAIL; both security verdicts are acknowledged CAUTIONs; 0 open blockers
---

# W101: final verification of SC1 to SC11

## 1. Verdict

**SC1 to SC11 are all marked. Eight PASS (SC1-SC6, SC8, SC11), three CAUTION (SC7, SC9, SC10), no FAIL. Both security verdicts are CAUTIONs the controller has already acknowledged (D248, D251). No blocker is open.** Plan row W101 (02_plan.md:780) is met.

The status is `needs-review` because one CAUTION is new and has no ruling yet: **SC7**.

- **What happened.** The closing root `npm test` that D239 asked for exited **1** once, just like at W89. 3 mobile tests in 2 suites failed while host load went from 6.95 to 27.5-30.7. The root script gives jest and Vitest every core.
- **Re-runs.** Each failing file passed when run alone right after, at load 4.43: 14/14 and 8/8.
- **Totals.** Every other count equals the D247/D254 ledger. The mobile totals (192 suites, 1,988 tests) also equal the ledger. Typecheck, lint, `test:pg-scripts` and `test:db` all exit 0.
- **Why T1 did not prevent it.** Neither failure hit jest's `testTimeout`, which T1 raised to 20 s. Both fail inside the tests' own wall-clock waits (section 5.3).
- **Controller decision needed.** Accept SC7 as a recorded load flake, as D239 did, or order one root `npm test` run at low load. Per the brief and D232/D233, I did not repeat the run.

The other two CAUTIONs depend on rows the plan puts after W101. They are not defects:

- **SC9** waits on W102.
- **SC10** carries the acknowledged W99-1 dependency advisories and waits on the final-commit scan of W103.

**SC3** is PASS but has an open timing residual (O-4, section 6).

## 2. SC table

Result key:
- **PASS**: the criterion is proven by gated evidence.
- **CAUTION**: met, or met as far as the plan allows at this row, with an acknowledged residual or a pending later row.
- **FAIL**: not met.

| SC | Criterion (02_plan.md 13.4; 01_specs.md:1872-1884) | Result | Evidence pointer (file:section or decision) | Notes |
|---|---|---|---|---|
| SC1 | Spec and plan dated before the first implementation log | **PASS** | `git log`: `4b708c8 2026-10-04T06:25:02+07:00 docs: backend, RBAC and pairing — research, specs, plan` (contains `masterplan/01_specs.md`, `02_plan.md`, `03_database_contract.md`, `04_client_integration_spec.md`; `git show --stat 4b708c8`). `delegation_progress/git_specialist_step_22.md` "Result" table: "Commit time (SC1 reference) `2026-10-04T06:25:02+07:00`". W01 log `implementation/01_baseline_test_fix.md` header table: "Row window 2026-10-04 06:26:37 to 06:36:32 WIB" | Margin: 1 min 35 s. Earliest implementation-log birth times (`stat -f %SB`): `coder_execution_step_24.md` 06:30:25, `01_baseline_test_fix.md` 06:37:47, `coder_execution_step_23.md` 06:38:51. The only two older progress files are `database_specialist_step_16.md` (03:54) and `_20a.md` (06:06). Both are spec rows (the database contract), and both are inside commit `4b708c8` (`git show --name-only`) |
| SC2 | Documented start, migrations from empty, seed, state survives a restart | **PASS** | W53 `test/06_restart_recovery.md` (status complete). W58 `gateway_check/06_backend_gate.md` ("W58: PASS-WITH-NOTES"). W90 `verification/03_clean_state_rebuild.md` §2 (19/19 README steps exit 0 as written; `pg:remove-data` then init, create, `applied 4 migration(s)`, seed 301 rows), §4 (30/30 seed counts = W20), §5 and §13 F-1, ruled by **D240** (28/30 tables equal; the 2 differences are the specified `core_state.epoch` +1 and the telemetry). Closing run: `test:db` `Test Files 124 passed (124)` / `Tests 1751 passed (1751)`, which includes `test/acceptance/restart.test.ts` (section 5) | F-1 is a ruling, not drift (D240) |
| SC3 | Both clients take data from the backend; an action on one is visible on the other | **PASS** | W49 `test/05_shared_state_realtime.md` (complete). W95 `verification/04_e2e_shared_state.md` "Evidence table": web start to phone 0.93 s / 0.76 s; phone stop to web +9 ms / +2 ms; phone start to web +32 ms / +35 ms; web stop to phone Finalizing 1.46 s / 1.06 s; network page-origin only (3,387 requests, all to `http://127.0.0.1:5173`). Gated **D249** | Open residual, not a FAIL: under host load the tablet can learn of a web stop late (RF2-2 / FXR-DEV-1 / W93-28: 21.2 s at load ~14 in D249; +11.3 s at load 9.2 in W98 `08_performance_realtime.md` §6). The data points to an overloaded app thread in the debug build (D252). Routed to the release-build session (section 6) |
| SC4 | Role-by-endpoint test; denial refused and audited; a role change follows on both clients | **PASS** | W47 `test/02_rbac_matrix.md` (complete; 375 cells). W96 `verification/05_e2e_rbac.md` "Evidence table": run 2 lock web +38 ms, phone +0.55 s; denied `POST /api/v1/session` 403 with **AUD-000157** and **AUD-000161** `ACCESS_DENIED`; ROLE_CHANGED rows; final roles `OPR-001:INVESTIGATOR`. Gated **D249**. W87 `test/01_test_report.md` §1: denial tests 41/41 | The run-1 lock instant was not captured (D-1 in W96). Run 2 measured it, so 1 + 1 holds (D233) |
| SC5 | Pairing gate, listing, revocation, an audit row per step | **PASS** | W48 `test/04_pairing_lifecycle.md` (complete). W94 `verification/06_e2e_pairing.md` §3: steps 1-5 plus verification V-a..V-c all PASS. Code issued AUD-000087 (blurred), redeem to Login, operator column live +1.11 s / +1.26 s, revoke to Pair (4403, `DEVICE_REVOKED` AUD-000091), re-pair as DEV-0002. Controller cross-check of the server log in **D249** | The release-build revoke-to-Pair < 1 s target is moved to the pre-handover session (D218, D250). Debug figures: 436 ms in W94, 1.23 s record-only in W98 §7 |
| SC6 | OpenAPI describes every endpoint; drift test; API Reference shows them as live | **PASS** | W52 `test/03_contract_conformance.md` (complete). W83 PASS **D185** (`gen-openapi --check` up to date, 75 operations, 0.2.1; 0 `CONTRACT-GAP-`). W84 PASS **D187** (75 operations `LIVE` in Live mode, the six denied Try-its refused before any request). FXR-W re-check **D247** (OpenAPI check up to date, 75 ops, 0.2.1). This row: `git grep -c 'CONTRACT-GAP-' -- apps packages` exits 1 (none) and the untracked grep finds 0 files. The shared suite, which holds `packages/shared/test/openapi.test.ts`, passed 71/1,851 in the closing run | - |
| SC7 | Existing suites and new backend tests pass | **CAUTION** | W87 PASS **D189** (75/75 operations with a success test, coverage lines 96.93 %). W89 PASS with one recorded flake **D239**. **Closing run (section 5):** typecheck 0, lint 0; shared 71/1,851, core-server unit 160/3,954, core-web 117/1,495, mock-core 19, pg-scripts 57, `test:db` 124/1,751, all equal to the ledger. Root `npm test` **exit 1**: mobile `Test Suites: 2 failed, 190 passed, 192 total` / `Tests: 3 failed, 1985 passed, 1988 total` at load 27.5-30.7. Re-runs alone exit 0 (14/14, 8/8) | Same load-flake class as D239/D246/D247. Needs a controller ruling (section 5.3). Totals equal the ledger, so no test was lost |
| SC8 | Simulated mode and the 0.1.0 packages still work | **PASS** | W97 `verification/07_regression_simulated_release.md` §1: all six criteria PASS (61 simulator-dependent files pass; release checksums OK; arm64 launcher `"ok": true`; mock-core 19/19 and an empty diff; every `packages/shared/src/sim` change has a decision; Simulated and HEARTBEAT walks leave 0 Core request lines, with a positive control). Gated **D253** (F-1 accepted by name, F-2 closed by DR-14). This row: `shasum -a 256 -c` gives 6 OK (web) and 8 OK (android); `git diff acaff20 -- apps/mock-core scripts/release` has 0 lines; mock-core `Tests 19 passed (19)` in the closing run | - |
| SC9 | Decisions, drift and findings recorded | **CAUTION** (pending W102 by plan order) | W88 `implementation/99_implementation_report.md` ACCEPTED **D190**. `decisions/decisions.md`: D1..D255 continuous with no gap (count script; D255 was added during this row), DR-01..DR-14 present, 79 F rows | W102 (02_plan.md:781) cross-checks every D, DR and F against the row logs. It depends on W101, so SC9 closes there. Nothing missing was found here |
| SC10 | No secret committed, no real personal data, nothing sent out | **CAUTION** (acknowledged) | W99 `verification/02_security.md` "Verdict": CAUTION, "0 Critical, 0 High, 1 Medium, 3 Low, 9 Info", 0 FAIL; count-only scan of the three DB passwords finds 0 hits in tracked and untracked files, logs and `git log -p --all`. Acknowledged in **D248**. W100 `verification/09_security_clients.md` §1: CAUTION, "0 FAIL. Nothing blocks"; device log 0 `dvc_`/`ses_`/`bio_` in 329,236 lines. Acknowledged in **D251**. W104/W105 commits clean (`implementation/97_*`, `98_*`; D183). This row: `git remote -v` is empty; `git ls-files .data .locks .cache apps/mobile/signing` = 0 and `git ls-files release` = 0; `git check-ignore -v` shows `.data/pg.env`, `.data/pg.pwfile` and `.data/pg.owner.env` ignored by `.gitignore:70:/.data/` | The CAUTION comes from W99-1 alone: `npm audit` 99 high / 0 critical, none on the Core server's runtime path. It is a final-report item; the dependency refresh is next phase. The final-commit scan (W103, plus the O-1 count-only scan of the evidence logs, D190) runs after this row |
| SC11 | README gives the exact Live-mode commands | **PASS** | W86 PASS **D188**. W90 `verification/03_clean_state_rebuild.md` §2: "README deviations: none". Every README command exits 0 as written; the exit 4 for "no cluster" is the documented answer. §10: AC-B-92 C1 and C4 PASS, the password literal on 0 lines of the Live section. This row: `git diff acaff20 -- README.md` has 0 removed and 191 added lines; `## Live mode` at `README.md:220`; each AC-B-92 sentence present (1 match each) | - |

**Security verdicts:**
- W99 CAUTION, acknowledged in D248.
- W100 CAUTION, acknowledged in D251. It carries only W99-1 over.

Both meet "PASS or an acknowledged CAUTION".

**Blocker count:**

| Source | Blocker | Major | Majors resolved by |
|---|--:|--:|---|
| W91 | 0 | 1 | DN-W91-1, D241 |
| W92 | 0 | 1 | DR-1 deferral, D242 |
| W93 | 0 | 2 | Fixed by FXR-M, D246/D247 |
| RC post-review re-check | 0 | 0 | D255 |
| W99 | 0 | 0 | - (0 Critical, 0 High, 0 FAIL) |
| W100 | 0 | 0 | - (0 Critical, 0 High, 0 FAIL) |

The closing tests found no product defect.

## 3. Tier 1 frame (5W1H)

| Item | Content |
|---|---|
| **Subject** | Whether the DEMS backend, RBAC and pairing task meets its eleven success criteria (01_identification RT:298-308, 02_plan.md 13.4), judged on the working tree at HEAD `057fc17` plus uncommitted changes, as it stands after PT (D254) |
| **Stakeholders** | The user, who owns the demo and decides on CAUTIONs and handover. The controller, which rules SC7 and runs W102/W103. W102 (report inputs: the SC outcome and open items). W103 (final commit: SC10 scan, O-1) |
| **Timeline (WIB, 2026-10-07)** | 10:51 brief read, load 5.11. 10:52:27 `pg:status` (running, PID 32434). 10:52:28 `pg:stop`. 10:52:28 `pg:status` stopped (exit 3). 10:52:28-10:52:56 typecheck. 10:52:56-10:53:10 lint. 10:53:11-11:01:36 root `npm test` (exit 1). 11:12:25-11:12:48 two single-file re-runs. 11:13:00 pg-scripts. 11:13:01 `pg:start` (PID 34939). 11:13:08-11:15:06 `test:db`. 11:15:06 final `pg:status` OK. Report written about 11:20 |
| **Scope** | In scope: each SC against the evidence rows named in 02_plan.md 13.4; the D239 closing test run; cheap read-only spot checks (git, README, release checksums, ignore rules, contract-gap markers). Out of scope by rule: no device, browser, Core server, Vite, Metro or emulator work; no edit of tracked files; no credential file read, printed or passed; no `*:5432` |
| **Rationale and evidence chain** | Every SC result points to (a) the row that proves it in plan 13.4, (b) the controller's gate decision on that row, which quotes the controller's own re-runs, and (c) where cheap, a fresh check from this row. The closing run is fresh evidence for SC2, SC6, SC7 and SC8 |
| **Methodology** | (1) Read the W101 row, the SC definitions and D230-D255. (2) Read each evidence document's verdict, acceptance table and findings. (3) Ran the D239 sequence in a scratchpad script, with the load printed before every step and logs kept outside the repo. (4) Re-ran each failing file once, alone, after load fell below 14. (5) Spot checks as listed in the table. (6) Compared the `git status --porcelain` hash before and after, and looked for source files changed after 10:50 |
| **Alternatives considered** | (a) Re-running root `npm test` at low load until green: rejected, because the brief says "do not loop" and D232/D233 apply. (b) A per-workspace mobile run with `--maxWorkers=2` as extra evidence, as W89 did: not run. The totals already equal the ledger and both files pass alone; it stays available to the controller. (c) A fresh count-only credential scan: not run, because it would read `.data/pg.*` in-process. W99 ran it today, and W103 repeats it on the commit |
| **Assumptions** | The controller's gate decisions (D185-D255) quote its own re-runs faithfully; I did not repeat device or browser evidence. `test:db`'s 124 files include `test/acceptance/restart.test.ts` (W53 runs it under `test:db`). This is inferred from the project layout, because the Vitest summary does not list passing files |
| **Gaps** | SC9 and SC10 finish only at W102/W103. Release-build measurements are deferred (section 6). The SC7 flake mechanism is reasoned from the test code (section 5.3), not proven by instrumentation |

## 4. How each SC was checked (methods worth noting)

- **SC1.**
  - Commit time from `git log --format='%h %ad %cd'`. The W01 row window comes from its log's header.
  - Birth times of every `implementation/*.md`, `delegation_progress/coder_*.md` and `database_specialist_*.md` came from `stat -f %SB`, sorted.
  - The only two files older than the commit are spec rows that the commit contains.
- **SC6.** `git grep -c 'CONTRACT-GAP-' -- apps packages` gives rc=1 (no tracked match). `grep -rIl 'CONTRACT-GAP-' apps packages --exclude-dir=node_modules` gives 0 files.
- **SC8.** `cd release/web && shasum -a 256 -c SHA256SUMS.txt` gives 6 `: OK`; `release/android` gives 8 `: OK`.
- **SC10.**
  - `git remote -v` printed nothing.
  - `git ls-files .data .locks .cache apps/mobile/signing | wc -l` gives 0; `git ls-files release | wc -l` gives 0.
  - `git check-ignore -v` on the three `.data/pg.*` names prints only the matching rule `.gitignore:70:/.data/`. No contents were read.
- **SC11.**
  - `git diff acaff20 -- README.md`: `grep -c '^-[^-]'` gives 0; `grep -c '^+'` gives 192, which is 191 lines plus the `+++` header. D188 recorded +190; the extra line is C1's F86-1 correction line (D193).
  - `grep -n '^## Live mode' README.md` gives line 220.

## 5. Closing test evidence (D239)

### 5.1 Table

Logs: `$TMPDIR`-side session scratchpad `.../scratchpad/w101/` (outside the repo; the brief allows only two files in TASK). The count lines below are copied verbatim.

| # | Command | PostgreSQL | Load before (1/5/15 min) | Exit | Count line (verbatim) | Ledger (D247/D254) | Result |
|---|---|---|---|--:|---|---|---|
| 0 | `npm run pg:status` | running | 7.54 6.69 5.59 | 0 | `server     RUNNING, PID 32434 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)` / `pg:status: OK, running` | - | baseline |
| 1 | `npm run pg:stop` | -> stopped | 7.54 | 0 | `pg:stop: stopped PID 32434; 127.0.0.1:4432 is free` | - | PASS |
| 2 | `npm run pg:status` | stopped | 7.54 | **3** | `server     NOT RUNNING. Start it with "npm run pg:start".` / `HA-4 not run (the server is stopped)` / `pg:status: stopped (file checks passed)`; `lsof -nP -iTCP:4432 -sTCP:LISTEN` rc=1 | reports stopped | PASS (exit 3 = documented "stopped") |
| 3 | `npm run typecheck` (root; shared, core-server, core-web, mobile, mock-core) | stopped | 7.54 6.69 5.59 | 0 | five `tsc` runs, no diagnostics; 28 s | exit 0 | PASS |
| 4 | `npm run lint` (root; oxlint x4, eslint for mobile) | stopped | 7.78 6.78 5.65 | 0 | no diagnostics; 15 s | exit 0 | PASS |
| 5 | `npm test` (root, no worker limit) | stopped | 6.95 6.64 5.62 (rose to **27.50** at 10:54, **29.20** at 10:55, **30.67** at 11:01) | **1** | shared `Test Files  71 passed (71)` / `Tests  1851 passed (1851)`; core-server unit `Test Files  160 passed (160)` / `Tests  3954 passed (3954)`; core-web `Test Files  117 passed (117)` / `Tests  1495 passed (1495)`; **mobile `Test Suites: 2 failed, 190 passed, 192 total` / `Tests:       3 failed, 1985 passed, 1988 total`** (`Time: 385.821 s`); mock-core `Test Files  4 passed (4)` / `Tests  19 passed (19)` | 71/1,851; 160/3,954; 117/1,495; 192/1,988; 19 | **CAUTION** (load flake, 5.2) |
| 5-r1 | `npx jest src/features/session-live/live-session-live-link.test.tsx` (apps/mobile, alone) | stopped | 4.43 7.48 10.76 (11:12) | 0 | `Test Suites: 1 passed, 1 total` / `Tests:       14 passed, 14 total` | - | PASS |
| 5-r2 | `npx jest src/features/settings/live-settings-boundary.test.tsx` (alone) | stopped | about 4 (11:12, right after r1) | 0 | `Test Suites: 1 passed, 1 total` / `Tests:       8 passed, 8 total` | - | PASS |
| 6 | `npm run test:pg-scripts` | stopped | 3.88 6.89 10.37 | 0 | `ℹ tests 57` / `ℹ pass 57` / `ℹ fail 0` | 57 | PASS (equal) |
| 7 | `npm run pg:start` | -> running | 3.88 | 0 | `pg:start: started, PID 34939, listening on 127.0.0.1:4432 (TCP only, no Unix socket)` | - | PASS |
| 8 | `npm run pg:status` | running | 3.88 | 0 | `server     RUNNING, PID 34939 (...connect probe: open)` / `HA-4 PASS \| a connection as dems_app with a wrong password: SQLSTATE 28P01` / `pg:status: OK, running` | OK | PASS |
| 9 | `npm run test:db` | running | 3.67 6.74 10.28 | 0 | `Test Files  124 passed (124)` / `Tests  1751 passed (1751)`; `[test:db] teardown: dropped 8 database(s) in 153 ms; 0 remain with the run prefix dems_test_local_tmirpwip_` (Duration 117.88 s) | 124/1,751 | PASS (equal) |
| 10 | `npm run pg:status` (final) | running | 7.16 6.94 9.90 | 0 | `server     RUNNING, PID 34939`; HA-1, HA-2, HA-3 PASS; `HA-4 PASS`; `pg:status: OK, running`; `lsof`: `postgres 34939 ... TCP 127.0.0.1:4432 (LISTEN)` | left running | PASS |

**Sandbox.** The PostgreSQL scripts, root `npm test` (mock-core binds loopback ports), `test:pg-scripts` and `test:db` ran outside the sandbox for local TCP. Typecheck, lint and the two jest re-runs needed no bypass.

### 5.2 The three failures

| Suite / test | Symptom (verbatim) | Re-run alone |
|---|---|---|
| `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` › "link back: "Resynced", the actions return, a snapshot goes through" (`:137-147`) | `Unable to find an element with testID: monitor-banner-resynced` (file took 59.972 s) | PASS, 14/14 |
| `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` › "LIVE → SIMULATED (§3.3; CPM1-2) › the dialog holds while the Core is asked; the sign-out (operation 5) is sent once and answered; then SIMULATED, on /login" | `boundary test: timed out waiting for the sign-out request (path /login, source SIMULATED, signed in false, requests getAuthSession,getDeviceRegistration,getSignInStatus,signIn)` at `:168` (file took 65.784 s) | PASS, 8/8 |
| same file › "LIVE → HEARTBEAT crosses the boundary too: dialog, sign-out at the Core, then the simulator with the mock-core link" | `expect(fake.log.requestsOf('signOut')).toHaveLength(1)` at `:417`: `Received length: 0` | (same run) PASS |

Also seen: jest printed "A worker process has failed to exit gracefully" once. This is the accepted residual C1-R1 (D193). It did not cause a failure.

### 5.3 Why T1 did not cover these failures (reasoned from code, a hypothesis)

T1 (D247) set `testTimeout: 20000` (`apps/mobile/jest.config.js:10`). Neither failure is a jest timeout.

- **`live-session-live-link.test.tsx:137-147`.** The test advances the fake clock (`b.elapse(10_000, 250)`) and then calls `getByTestId('monitor-banner-resynced')` at once. The test's own comment at `:134-135` says: "with it [wall-clock time], the runtime's banner can fall back to "offline" after "Resynced" although the link is ONLINE (finding F-1 of report 68)". Under load, real wall time passes during the outage, which is the case the comment describes.
- **`live-settings-boundary.test.tsx:162-168`.** `until()` counts 160 iterations of a real 50 ms wait (`ms = 8_000`). The app did reach the target mode (`/login`, SIMULATED or HEARTBEAT), but **no** `signOut` request was recorded.
  - **Hypothesis, not verified:** under the stall, the runtime treated the link as not ONLINE (the heartbeat went stale) and took the DR-11 local sign-out path, which sends the sign-out when the link returns.
  - That would be the specified offline behaviour taken because of the stall, not a product defect. The pass alone (8/8) is consistent with this.

**Proposal (not applied; read-only row).** Pick one:
- (a) Record SC7 as a load flake, as D239 ruled for W89.
- (b) Have the controller run root `npm test` once at low load, or with `--maxWorkers` for jest, before W103.
- (c) Next phase: make both tests independent of wall time. The candidates are fake timers through the outage in `live-session-live-link`, and a link-state guard before the sign-out wait in `live-settings-boundary`.

## 6. Open items (non-blocking) and where they are routed

| # | Item | Severity / kind | Route | Source |
|---|---|---|---|---|
| O-1 | **SC7 closing flake** (section 5) | CAUTION, needs a ruling | Controller, before W103 | this row |
| O-2 | Release-build revoke-to-Pair < 1 s | measurement deferred | Pre-handover session | D218, D250; W98 §11 |
| O-3 | Release-build timer lag and stale monitor under load; mobile frame statistics on release | measurement deferred | Pre-handover session | D236, D250; W98 §11 |
| O-4 | RF2-2 / FXR-DEV-1 / W93-28: the tablet learns of a web stop late under load | Medium, cause not established (data supports app-thread starvation in debug) | Next phase / release-build session | D237, D249, D252 |
| O-5 | RC-1: Sessions hub duration can step back once when a stop is learned late (`apps/mobile/src/runtime/recording-elapsed.ts:129`) | Minor | Next phase / pre-handover | D255 |
| O-6 | Biometric device test not run | User decision | Final report open item | D231 |
| O-7 | W98 Simulated-mode web comparison not run | gap | Final report | D252; W98 §11 |
| O-8 | W99-1 `npm audit` 99 high / 0 critical, none on the Core runtime path; `undici` >= 7.29.1 bump; dependency refresh (proposed W106) | Medium (acknowledged CAUTION) | Final report; next phase | D248, D251 |
| O-9 | W99-2 (F76 shared pairing bucket), W99-3 (F79 socket cap; undecodable paths unthrottled) | Low | Final report: "before any use beyond one loopback computer" | D248 |
| O-10 | W99-4 `DEVICE_CREDENTIAL_REQUIRED` refusal writes no audit row | Low | Next phase | D248 |
| O-11 | W100-2 sign-out while the Core is unreachable is not retried (accepted risk); W100-3/6/7 info; W100-4 `localhost` in packaged CSP and mock-core origins; `release/web/BUILD-INPUTS.txt:168` old path | Low / Info | Accepted / next packaging | D247, D251 |
| O-12 | DR-1 / W92-1 split of `packages/shared/src/live/source/live-sim.ts`; W92-6, 12, 15, 17 refactors; W92-27 upgrade checklist; W92-28 S20 amendment | Major (deferred) / refactors | Next phase; W92-28 to the final report | D242 |
| O-13 | W91-10 file splits; W91-17 `scripts/pg/server.mjs` runbook; HBX-13 static scanners to lint rules | Minor / governance | After W103 / next phase | D241, D245 |
| O-14 | W93-10 (in-place Pair), W93-18/19/26, W93-27 info; FXR-DEV-2 Reanimated "Unable to find SurfaceMountingManager" warnings | Minor / Low | Next phase | D246, D249 |
| O-15 | RC-2..RC-8 Nits (incl. redundant 20 s per-test timeouts after T1) | Nit | Next phase | D255 |
| O-16 | The realtime test-support shim has zero importers and is kept, not deleted (red line) | user decision | Final report, for the user | D245 |
| O-17 | Contract residuals R-C1..R-C6, R-D2..R-D5; RESIDUAL-W77-1 | accepted residuals | README / final report sentences | D184, D172 |
| O-18 | F69: whether a web-only Live demo may record (needs a demo control that marks the tablet link connected) | product question, default "as specified" | User, final report | decisions.md F69 |
| O-19 | W90 F-4 (one `STATEMENT:` line per error under terse logging), F-6 (lock message wording), F-7 / C2-R2 not exercised | Info | W102 errata | D240 |
| O-20 | D249 observations: an empty frame Login -> Home on the tablet; tablet mic tiles "No signal" while recording; audit rows of phone-sent session commands without a device ID | observation | Final report | D249 |
| O-21 | O-1 of D190: the `.gitignore` exception `!docs/**/assets/*.log` plus a count-only secret scan of the evidence logs | plan step | W103 | D190 |
| O-22 | SC9 completion (D/DR/F cross-check, host state and removal commands) | plan step | W102 | 02_plan.md:781 |

## 7. Open blockers

**Zero.** Every review and security row reports 0 Blocker or 0 Critical/High (section 2). No SC is FAIL. The closing tests found no product defect: all three failures pass alone, and every total equals the ledger. O-1 (SC7) needs a ruling, but it does not block under D239's precedent.

## 8. Rules, state and deviations (disclosed)

- **Tracked files.** Not modified by this row. The `git status --porcelain` md5 changed from `ac725d8e...` (10:52) to `5a2ec92c...` (11:15). The cause is a parallel row: RC wrote `verification/13_post_review_recheck.md` (11:04) and `delegation_progress/rc_post_review_recheck.md` (11:05:04), and the controller appended D255 to `decisions/decisions.md` (11:05:47), all per `stat`. `find apps packages scripts README.md package.json package-lock.json -newermt "2026-10-07 10:50" -type f` (excluding `node_modules`) printed **nothing**, so the tree that was tested is the current tree. `git ls-files | grep -c tsbuildinfo` gives 0.
- **Credentials.** No `.data/pg.*` file was read, printed, staged or passed as an argument. The logs mention those names only in `pg:status`'s mode lines and its key-name lines (`DEMS_PG_*_PASSWORD` as a key name).
- **Ports.** `*:5432` was not touched. Only `npm run pg:*` against `127.0.0.1:4432` was used. No Core server, Vite, Metro, mock-core or emulator was started.
- **Load guard.** I checked load before every step; every start was below 14. During root `npm test` load reached 30.67, because the root script uses every core. A run cannot be paused mid-way. Before the re-runs I waited until load was back to 4.43.
- **Process slips.**
  - **Load-wait loop.** My first load-wait loop called `sysctl` inside the sandbox, where it is denied, so it never released. I stopped it (`pkill -f vm.loadavg`). It had no effect on the tree.
  - **Runner script.** I stopped my runner script after root `npm test` (`pkill -f scratchpad/w101/run.sh`, while it waited on the load guard) so the re-runs would come before `test:pg-scripts` and `test:db`. I then ran the remaining steps by hand in the planned order. `test:pg-scripts` still ran with PostgreSQL stopped, as at W89.
- **Plan tracking.** `masterplan/02_plan.md` was not edited. The brief allows only this report and the progress file, so the W101 status update is left to the controller.

## 9. Final state

- PostgreSQL **running**: PID 34939 on `127.0.0.1:4432`, `pg:status: OK, running`, HA-1..HA-4 PASS.
- Nothing else was started by this row.

---
*Generated: 2026-10-07 11:20 WIB*
*Last Updated: 2026-10-07 11:20 WIB*
