# coder-execution, step 105 (plan row W83), phase 1

| Field | Value |
|---|---|
| Row | W83 Contract close-out and OpenAPI, phase 1 only (ledger and ruling sheet) |
| Mode | Read-only on the whole tree |
| Status | phase 1 needs-review (ruled by D184); phase 2 complete at 04:24 (DV-4 to ratify; DQ-3 heartbeat half on fallback (b)) |
| Started / ended | 2026-10-06 about 03:00 / 03:25 |
| Files written | `implementation/83_contract_closeout.md`; this file |
| Files not written (by the brief) | `masterplan/02_plan.md`, `status_tasks.md`, `decisions/decisions.md`, `delegation_progress_report.md`, `gateway_check/01_gate_report.md`, `implementation/99_implementation_report.md` |

## Progress

| Time | Step | Result |
|---|---|---|
| 03:00 | Read the plan row W83 (`02_plan.md:762`), KI-18 (`:1538`), D84, every decision naming W83 (31 rows), gap IDs or "close-out" (40 more) | Item list started |
| 03:04 | Marker grep over `apps` and `packages`; compared with `acaff20` | 34 task `CONTRACT-GAP-*` IDs on 88 lines in 43 files; 33 predecessor KI-07 `SIM-GAP-*` IDs set aside (present at `acaff20`) |
| 03:06 | Row logs (`implementation/`, `test/`, `gateway_check/`) | Gap tables with exact texts of W32, W34, W35, W36, W39, W40, W41, 24b, W42, W43, W44, W52, the page rows; the conformance row's table of known gaps |
| 03:10 | Current state of each item in `packages/shared/src/api/**` (greps; tsx scripts printing the operation table, 403 examples, response texts, body-less POSTs) | 101 ledger rows: A 34, B 13, C 7, D 5, E 28, F 7, closed 7 |
| 03:12 | Constraints read in the tests: the offline pin, unscoped examples, the pinned absence of `notPermitted` examples, `KNOWN_CODE_GAPS` and the coverage rule, the Live source's public-API pin | They decide DQ-1 to DQ-3 and R-E1 |
| 03:16 | `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | exit 0: up to date, all 75 / offline 10, version 0.2.0 |
| 03:17-03:25 | Wrote the ledger, the totals, the ruling sheet and the phase-2 plan (8 landings + optional errata landing, grants, by-design test changes, gate) | Document complete |

## Decisions asked of the controller

DQ-1 response-level all-scope text (model extension) for W34-2 / W35-2; DQ-2 envelope-level 400 `INVALID_JSON`;
DQ-3 strictness scope (Core-only schemas, Core-union heartbeat); DQ-4 CONTRACT-GAP-6 by description; DQ-5 rename
residual markers to `RESIDUAL-W<row>-<n>`; DQ-6 B errata as appended sections (grants); DQ-7 F copy sweep as a
separate round; DQ-8 OpenAPI version 0.2.1; DQ-9 report file name differs from the plan's artifact list.

## Blockers

None for phase 1. Phase 2 needs the grants of section 7.2 of the report and must start after checkpoint commit 2
(W1 writes `apps/core-web/**` now; marker line numbers there will move).

# Phase 2 (decision D184; tree 057fc17)

| Time | Landing | Result |
|---|---|---|
| 03:33 | L0: `.locks/contract.lock` taken; fresh marker grep (87 lines / 43 files; `$TMPDIR` list); pre-images of 98 files in `.cache/rollback/W83/` + `.cache/rollback/W83.pre.sha256`; baseline shared 68 / 1,814, `--check` exit 0 | ready |
| 03:50 | L1: texts, examples and constants on Core-only operations (ledger 4 const, 6, 8-12, 14, 16, 21-23, 26-31, 33-35, 39, 59, 75); new `test/api-closeout.test.ts` (18 tests); by design `api-registry.test.ts:591` (+ `webConsoleSession`) | gen exit 0, `--check` exit 0 (75 / 10, 0.2.0), offline pins unchanged; shared 69 / 1,832; web 95 / 1,255; mobile 140 / 1,721; server unit 154 / 3,916 — all exit 0 |
| 03:44 | L2: PIPELINE envelope 400 `INVALID_JSON` (ledger 18, 25); close code 1009 (32); by design `api-envelope.test.ts:110`, `api-openapi-scope.test.ts:552`, `api-realtime.test.ts:787` | gen/`--check` exit 0; shared 69 / 1,834; typecheck server, web, mobile exit 0 |
| 03:49 | L3: `CoreApiResponseSpec.coreServerDescription` (DQ-1) on `stopSession` and `exportEvidence` 422 (13, 17); `contract.support.ts` reads both texts; `KNOWN_CODE_GAPS` emptied (10, 13, 17, 39); by design `api-openapi-scope.test.ts:485` | shared 69 / 1,835; `test:db test/acceptance/contract.test.ts` 34 / 34 exit 0 (the code block passes with no known gap) |
| 03:55 | L4: `DEVICE_COMMAND_OPERATIONS` + `deviceCommandOfOperation` in `sim-actions.ts`; the Live source's index and the server's table derived from it (names kept); `BEARER_SECRET_PREFIXES` adopted by the typed client; by design `client-credentials.test.ts`, `live-source-platform-neutral.test.ts:235-247`, `devices/__tests__/routes.test.ts` (title, one assertion; the W36-1 print becomes an assertion of `ok`); gap citations in new text written as "gap N" | shared 69 / 1,836; server unit 154 / 3,916; `test:db devices/effects.db.test.ts` 3 / 3; typecheck shared and server exit 0 |
| 04:03 | L5: example `permission: EVIDENCE_REVIEW_OR_MAINTENANCE`; `ANY_OF_DENIAL_SEPARATOR`, `denialPermissionOf`, `permissionsOfDenialLabel` in the contract; R-D1 in `live/source/rebuild-error.ts:129`; by design `apps/mobile/src/features/storage/live-storage-sites.test.tsx:190` and `:219` (the twin test of the same file, same assertion), comment in `storage-screen.tsx:199` | shared 69 / 1,837; web 95 / 1,255 (the web storage tests unchanged and green); mobile 140 / 1,721 |
| 04:08 | L6: KI-18, `core-api.ts:601` reworded; by design `api-openapi-scope.test.ts` hashes `paths` and `getServiceHealth` (acaff20 values kept as comments) and two titles; the other nine operation hashes, `info`, `servers`, `tags` unchanged | shared 69 / 1,838; `--check` exit 0; web `scalar-config` + `sim-fetch` 29 / 29 |
| 04:12 | L7: 17 Core-only answer schemas of contract A strict (DQ-3 (a), ledger 71); the strict union heartbeat (ledger 38) was tried and REVERTED to fallback (b): it turned `apps/core-server/test/acceptance/shared-state.test.ts:856` red (1 test, W49's own pin of the gap, outside the grants); 8 by-design pins in owned tests for the heartbeat tried and reverted; `api-schemas.test.ts:189` by design (PairedDevice refuses an extra member); DQ-8: `info.version` 0.2.1 | measurement with both halves: web 95 / 1,255, mobile 140 / 1,721, server unit 154 / 3,916 all exit 0; server `db` 121 / 122 files, 1,739 / 1,740 (the one red above); after the revert `shared-state.test.ts` 6 / 6; shared 69 / 1,840; `--check` exit 0 (75 / 10, 0.2.1) |
| 04:18 | L8: marker sweep — closed gaps reworded as "gap N, closed by W83" (contract.test.ts, commands.db.test.ts, revoke-dialog.tsx, live-storage-policy.test.tsx, live-devices-bed.tsx); residual markers renamed `RESIDUAL-W<row>-<n>` with "W83 ledger #n" at the first use in each of 31 files; `live-source-platform-neutral.test.ts` checks no gap marker and the two residuals; `contract.test.ts:928` now asserts the validator accepts the seven body-less 400s; **deviation DV-4**: `apps/mobile/src/features/dashboard/home-more-live-static.test.ts:150` (W66's static pin of the marker, built from parts, missing from my section-4 list) changed in one line to `RESIDUAL-W66-1`, pre-image saved | `grep CONTRACT-GAP-` 0 lines; shared 69 / 1,840; web 95 / 1,255; server unit 154 / 3,916; mobile dashboard folder 7 / 55 after DV-4 |
| 04:24 | L9: "Errata (W83)" appended to `masterplan/01_specs.md` (13 rows), `03_database_contract.md` (3), `04_client_integration_spec.md` (4); note appended to `implementation/41_biometric_token.md`; three code comments (`owner-connection.ts:10`, the two mobile `sim-adapter.ts`, KI-07 marker counts unchanged) | `git diff --numstat` of the four documents: additions only (24/13/14/9, 0 deletions) |
| 04:21 | Final gate (part 1 §7.4): 1 `CONTRACT-GAP-` 0 lines; 2 KI-18 phrases 0 lines; 3 `--check` exit 0, 75 / 75, 0.2.1; 4 typecheck and lint exit 0; 5 shared 69 / 1,840; 6 server unit 154 / 3,916, db 122 / 1,740 (0 databases left); 7 web 95 / 1,255, mobile 140 / 1,721; 8 53 files outside the owned paths changed, all granted or L9, plus DV-4 | PASS |
| 04:24 | Part 2 appended to `implementation/83_contract_closeout.md`; `.locks/contract.lock` released | complete (DV-4 needs ratification; DQ-3 heartbeat half took fallback (b)) |
