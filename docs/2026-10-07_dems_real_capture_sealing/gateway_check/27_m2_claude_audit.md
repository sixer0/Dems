# M2 software gate — independent re-run by the Claude Code controller

- Date: 2026-10-09, 08:48-09:10 WIB
- Scope: re-run of every M2 suite on the uncommitted working tree on top of `0024068` (Kilo rows 41-56a, RECON-A..G). Stands in for row 56 (independent +1) on the software side. Device gate 56b is NOT covered.
- Method: commands run by the controller, not read from Kilo reports. Per-workspace, `--maxWorkers=2`, `</dev/null`. Suites that bind loopback ports or reach PostgreSQL ran outside the Bash sandbox (inside it: `listen EPERM`).
- Verdict: **M2 software gate CONFIRMED, with one gate-scope gap (A-1) and two notes (A-2, A-3).** No Kilo figure was found to be wrong.

## 1. Results

| Check | Command | Result | Kilo claim | Match |
|---|---|---|---|---|
| shared typecheck / lint | `npm run typecheck\|lint -w @dems/shared` | exit 0 / exit 0 | 0 / 0 | yes |
| core-server typecheck / lint | `npm run typecheck\|lint -w @dems/core-server` | exit 0 / exit 0 | 0 / 0 | yes |
| mock-core typecheck / lint | same, `-w @dems/mock-core` | exit 0 / exit 0 | not re-run at 56a | - |
| core-web typecheck | `npm run typecheck -w @dems/core-web` | **exit 2**, 2 errors in `src/features/session-new/devices-step.tsx:27,267` | not in gate scope | see A-1 |
| mobile typecheck | `npm run typecheck -w @dems/mobile` | **exit 2**, 1 error in `src/features/session-new/check-icon.tsx:9` | not in gate scope | see A-1 |
| core-web / mobile lint | `npm run lint -w ...` | exit 0 / exit 0 | - | - |
| M2-RG-SHARED | `npm run test -w @dems/shared` | 72 files, 1875 passed, exit 0 | 72 / 1875 | yes |
| M2-RG-WEB | `npm run test -w @dems/core-web` | 117 files, 1496 passed, exit 0 | 117 / 1496 | yes |
| M2-RG-MOB | `npm run test -w @dems/mobile` | 194 suites, 1997 passed, exit 0 | 194 / 1997 | yes |
| M2-RG-MOCK | `npm run test -w @dems/mock-core` | 4 files, 19 passed, exit 0 | 4 / 19 | yes |
| M2-RG-CSU | `npm run test -w @dems/core-server` | 3 failed, 4049 passed (164 files) | 3 deferred | yes |
| M2-RG-CSD | `npm run test:db` | 12 failed, 1836 passed (126 files) | 12 deferred | yes |
| M2-RG-PG | `npm run test:pg-scripts` | exit 0 | carried from row 53, not re-run at 56a | now re-run |
| DB state | `npm run db:status -w @dems/core-server -- --database <db>` x4 | all four: schema version 2, `dbc-3`, 8 migrations, ledger matches | (2,'dbc-3') | yes |
| PostgreSQL | `npm run pg:status` | `OK, running` before and after | running | yes |

## 2. The 15 red tests

- Unit (3): `modules/sessions/__tests__/routes.test.ts` (2) and `modules/evidence/__tests__/routes.test.ts` (1) — MODG route-list equality.
- Db (12): all in `test/acceptance/contract.test.ts`.
- Root cause observed in the run output, one cause for all 15: the registry holds 89 operations and the booted router does not register 14 of them — `GET|POST /capture/config`, `GET /capture/devices`, `POST /capture/cameras/{id}/source`, `POST /capture/mics/{id}/primary`, `POST /capture/devices/{id}/credential`, `GET|POST /session/{id}/audio-source`, `GET /session/{id}/sealing`, `GET /evidence/{id}/transcript`, `GET|POST /evidence/{id}/transcript/revisions`, `GET /evidence/exports/{id}`, `POST /evidence/{id}/media-sessions`. These are blueprint rows 66 (M4) and later (M5-M8). The reviewer's ruling in `15_m2_code_review.md` §4 holds.
- The `422 INVALID_INPUT` on `GET /api/v1/evidence/` (empty id) is a cascade, not a defect: the sessions area walk stops at `contract.test.ts:703` (11 expected, 14 found) before it seals a session, so `sealedEvidenceId` stays empty for the evidence walk.

## 3. Findings

| ID | Finding | Evidence | Action |
|---|---|---|---|
| A-1 | The 56a gate scoped M2-QA-1 to shared + core-server. Root `npm run typecheck` is red: 3 errors in core-web and mobile, `Record<PrecheckCheckId, ...>` missing `MIC_PRIMARY`/`MIC_STANDBY`. Known and routed to rows 67/68 by RECON-C (`62_recon_clients.md` §6), but the gate report and the status line "all suites green" do not list it as an exception. | `07_m2_gate.md:83`; run above | Carry as a named M2 gate exception; rows 67/68 must close it; M4 gate must run the root typecheck. |
| A-2 | `test/acceptance/contract.test.ts` — the main acceptance walk of the API — stays red from M2 until the last deferred route lands (M8). While it is red its 12 blocks cannot catch a regression in already-built operations. | run above | Each of M4/M5/M7/M8 gates must show the failing set shrinking against the list in §2, and name any block that fails for a new reason. |
| A-3 | `status_tasks.md` ledger: rows 50a and 51a still read "queued" (their scope was done by RECON-B/B2b and row 51a W7), row 56b appears twice; `delegation_progress_report.md` was last written 2026-10-08 08:34 and lacks the local/paid model overrides of D45, D46, D55. A stray `delegation_progress/coder-execution__reconB2b.md` sits at the repository root instead of the task folder. | file timestamps, ledger lines 96, 99, 123, 126 | Kilo to reconcile on resume; nothing renamed or deleted by this audit. |

## 4. Not covered

- 56b device kill-matrix UAT (two locked emulators; user action).
- Hands-on boot of the lane Cores and Vite (rows 53, RECON-F2b) — taken from Kilo's logs, not re-run.
- CPU STT track 107-110 — audited on 2026-10-08 (D18), not re-run.
