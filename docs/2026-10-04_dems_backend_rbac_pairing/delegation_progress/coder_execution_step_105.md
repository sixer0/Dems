# coder-execution, step 105 (plan row W83), phase 1

| Field | Value |
|---|---|
| Row | W83 Contract close-out and OpenAPI, phase 1 only (ledger and ruling sheet) |
| Mode | Read-only on the whole tree |
| Status | needs-review: rulings DQ-1 to DQ-9 and R-C1 to R-E11 are required before phase 2 |
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
