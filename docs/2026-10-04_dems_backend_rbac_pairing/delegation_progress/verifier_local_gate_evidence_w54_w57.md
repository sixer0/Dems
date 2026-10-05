# Progress: verifier-local — gate evidence for W54 (step 76) and W57 (step 79), request D135

Status: **evidence complete** (2026-10-05, 10:06 to 10:24 WIB). Nothing ruled.

Report: `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/06a_w54_w57_gate_evidence.md`.

Scope given: measure the two `needs-review` rows and report; the controller rules (D135). The tree was
touched read-only: no source, test or document file outside this folder pair was created, changed or
deleted; no `git` write; no `test:db` (owned by another agent per D131/D132); `@dems/mock-core` not run
(P5 reserves it for W89/W97). `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`,
`masterplan/**` and `gateway_check/01_gate_report.md` were not written.

## Timeline

| Time (WIB) | What |
|---|---|
| 10:06 to 10:07 | Inputs read: `implementation/54_web_shell_admin_routes.md` (§18 F76-1..12, §19 D-1..14, §20 decisions 1..14, §16, §22, §23), `coder_execution_step_76.md`, `implementation/57_mobile_pairing_flow.md` (§5 F-1..11, §6 DV-1..15, §7 DN-1..8, §4.2/§4.5/§4.6/§4.7, §8, §13), `coder_execution_step_79.md`, `masterplan/02_plan.md` rows W54/W57 + §8.1 (SG, CLG, W01's state) + §11.3 (L-1..L-6), `identification/02_structured.md:487-578` (P1-P25), decisions D121, D124, D125, D126, D128, D129, D130, D135. Load at 10:07: `load averages: 4.33 4.09 3.04`; Node v26.8.2, npm 11.19.1 |
| 10:07:48 | `npm run test -w @dems/core-web -- --maxWorkers=2` → **55 files / 759 tests / 0 failed / exit 0** (59.88 s) |
| 10:09 | `npm run test -w @dems/mobile -- --maxWorkers=2` → **90 suites / 1,187 tests / 0 failed / exit 0** (48.891 s). W59's `features/login/live-login.test.tsx` was born 10:14:33, after this run started, so it is not among the 90 |
| 10:11:12 | `npm run test -w @dems/shared -- --maxWorkers=2` → 68 / 1,814 / exit 0 (exit code lost through a pipe; re-run at 10:15:13 with `SHARED_TEST_EXIT=0`) |
| 10:11:35 | `bash apps/mobile/scripts/emulator-user-lock.sh status` (read-only) → phone/tablet PIN + one fingerprint + no keyguard, phone2 lock-free: equal to D125 |
| 10:12 to 10:14 | Protected-file checks: `git diff --stat acaff20` empty for `routes.test.tsx`, `packaged-csp.ts`, `core-endpoint.test.tsx`, `packaged-csp.test.ts`; blob equality proven for `routes.test.tsx` `7a04c97d…`, `packaged-csp.ts` `78c8898e…`, `shell-motion.test.tsx` `4d82e08e…`. The two `*-test` names do not exist at `acaff20` or now (clause is vacuous — reported as CANNOT VERIFY) |
| 10:13 to 10:14 | Granted lines verified by `git diff --numstat` + text: `home-page.tsx` `1 1` at :178 (D121), `packages/shared/test/i18n.test.ts` `3 1` at :58/:59/:93 (D126), `home-screen.tsx` `1 1` at :217 (D124 ruling 2). Pairing's two existing test files blob-equal to `acaff20` (`c882a126…`, `6d14036c…`) |
| 10:14 to 10:15 | Structural reads: mode indicator + its pure state (four states, RECONNECTING covers CONNECTING+RESYNCING), `top-bar.tsx:76`, `nav-items.ts:75-76`, `sidebar.tsx:84/:126/:71`, the two route files and `-guard.ts:19-23`, `route-permissions.ts:14-18`, `routeTree.gen.ts:22-23/:80-86`, both page stubs (page contract only), the two namespaces registered in `i18n/index.ts`, the shell keys in `en/shell.ts` |
| 10:15:2x-41 | Typecheck per workspace: shared **0**, core-web **0**, mobile **2** — one error, `src/features/login/live-login.test.tsx(151,9) TS2367` (W59, untracked, born 10:14:33) |
| 10:16:08-20 | Lint per workspace: shared **0**, core-web **0**, mobile **1** — `✖ 5 problems (2 errors, 3 warnings)`, all in `features/login/live-login.test.tsx` and `features/login/use-login-controller.ts:154/:157` |
| 10:17:10-30 | P11 second run of both mobile checks: typecheck exit 2 with the same single error; lint exit 1, now `✖ 4 problems (2 errors, 2 warnings)` — the file changed between the two runs (another row writing). Both runs recorded; no finding names any file of W54 or W57 |
| 10:17:49 | Targeted run of W54's three shell test files → **3 files / 84 tests / exit 0** |
| 10:18:09 | Targeted run of `src/test/live-runtime-startup.test.tsx` → **1 file / 22 tests / exit 0**; the granted assertion sits at :399 with D128's comment at :398 → F76-1 does not reproduce |
| 10:18:42 | Targeted jest of `apps/mobile/src/features/pairing` with `--json` → **6 suites / 66 tests / exit 0**; per file 27 / 12 / 10 / 2 (new) + 7 / 8 (existing) — exact match to the row's 21:55 claim |
| 10:19 to 10:21 | Secret scan over 75 files (2 documents, 2 progress files, 43 `54_*` + 28 `57_*` assets) by a temp script that imports the seeded constants and prints counts only: password literal **0**, pairing-code literal **0**, `ses_`/`dvc_`/`bio_` values **0**, bearer values **0**, cookie name **0**, positive control `DEMO_OPERATOR_PASSWORD` name **15**, `set-cookie` word 3 (a header-name grep filter), six-digit runs 52 — all 26 text runs characterised digit-masked as hashes, byte counts, stored-value lengths, log-line counts, run ids, `PCD-######`, epoch millis, audit hash |
| 10:19 to 10:20 | Listeners: `lsof -nP -iTCP:4421-4423 / :5176-5178 / :8081-8086 -sTCP:LISTEN` → exit 1 each, no output; 4400/4420/5173-5175 also free; 4432 = postgres pid 19121 (the standing instance). `.locks/core-server.lane*.pid`: four files, all 0 bytes |
| 10:20 | Extra read-only measurement for DN-6: `npm run db:status -w @dems/core-server -- --database dems_lane_2` → exit 0, `paired_devices 1`, `device_credentials 1`, `pairing_codes 1`, `audit_log 95` |
| 10:22 to 10:24 | Wrote the report, then this file |

## What the measurement turned up that the two documents do not say

| # | Observation | Evidence in the report |
|---|---|---|
| 1 | **Neither row ever filled its gate block.** W54: `GATE_WEB_LINE`, `GATE_MINE`, `GATE_SHARED_LINE`, `MUT_LINE`, `GATE_BLOCK`, `MUT_BLOCK`, `GATE_TIME`, `GATE_SUMMARY`; W57: `@@GATE_SUMMARY@@`, `@@GATE_BODY@@`, `@@MUT_SUMMARY@@`, `@@RUN2@@`, `@@GENERATED@@`, plus `@@LATER@@` in its progress file. No runner total of either row is quotable from its own document | §0 point 1 |
| 2 | W54's **mutation check is incomplete on the record**: no `54_*` gate/mutation asset, the record is git-ignored `.cache/w54/mut/`, and G05, W11, N39, N40 survived their last run with no re-test; the last entry is 22:05:15 — the session break | §B.5 |
| 3 | W57's `57_gate_final.log` and `57_live_tests_verbose.txt`, named in its section 13, are **absent** from `assets/`; its mutation logs are present and run 2 reads 27/27 detected, tree identical | §C.4 |
| 4 | `@dems/mobile` **typecheck and lint are red on the current tree**, entirely inside W59's `features/login/**` (one TS error, two lint errors, two to three warnings). Mobile **tests** are green because jest does not typecheck. Not W57's; both P11 runs recorded | §A.4, §A.5, §I.10 |
| 5 | The plan's protected-file clause names two files that **do not exist** (`apps/core-web/src/test/core-endpoint.test.tsx`, `packaged-csp.test.ts`); the real protected artefacts are `lib/packaged-csp.ts` (blob-equal, P6 read-only) and `lib/core-endpoint.ts` (modified by W50, which owns it) | §B.3, claim 8 |
| 6 | Four existing web test files differ from `acaff20` — `sim-fetch.test.ts` and `storage-page.test.tsx` (W01), `dashboard/__tests__/dashboard.test.tsx` (W01b), `security-audit/__tests__/security-audit.test.tsx` (W01c). None is W54's | §B.3 |
| 7 | The two copies of the confirmed mode change are **both pinned through one shared set of test IDs** (`mode-switch-dialog/-confirm/-cancel`): three files of W54 and `live-login-page.test.tsx` of W55 | §E |
| 8 | Measured ledger numbers for the controller's L-2 correction: W54 adds **84 tests in 3 web files**, W57 adds **51 tests in 4 mobile files** (folder total 6 suites / 66 with the existing 15) | §B.1, §C.1, §I.9 |

## Totals measured (the short version)

| Workspace | Files / suites | Tests | Failed | Exit | Ledger expectation |
|---|--:|--:|--:|--:|---|
| `@dems/core-web` | 55 | 759 | 0 | 0 | ≥ 759 / 55 → met |
| `@dems/mobile` | 90 | 1,187 | 0 | 0 | ≥ 1,187 / 90 → met |
| `@dems/shared` | 68 | 1,814 | 0 | 0 | ≥ 1,814 / 68 → met |
| typecheck | shared 0 · core-web 0 · **mobile 2** (W59's file) | | | | reported |
| lint | shared 0 · core-web 0 · **mobile 1** (W59's files) | | | | reported |

Leftovers counted: **4** empty `.locks/core-server.lane*.pid` files (9 if the three empty lane locks and
the two lane-3 logs are included). No listener left by either row on 4421-4423, 5176-5178 or 8081-8086;
device lock state unchanged from D125.

## Files written by this verification

* `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/06a_w54_w57_gate_evidence.md`
* `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/verifier_local_gate_evidence_w54_w57.md` (this file)

Scratch stayed outside the tree: `/var/folders/…/T/kilo/w54_w57_secret_scan.mts`,
`masked_context.mts`, and the runner logs under `/tmp/kilo_*.log` (plus `/tmp/kilo_pairing.json`).

## Next (the controller's)

Rulings listed in report §I: W54 decisions 1, 2, 3 and 9 (with D128 point 4), the disposition of its four
un-retested mutation survivors, W57 DN-1 to DN-8, the ledger additions (84 / 51 tests), the two missing
asset sets, and the attribution of the `@dems/mobile` typecheck/lint reds to W59.
