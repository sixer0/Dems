# coder-execution - blueprint row 132 (R-9 search and candidate-list API)

Date: 2026-10-09. Status: **needs-review**. Full report: `implementation/63_r9_search_api.md`.

## Done

- Part 1 (D106): shared contract of operations 93 to 97, `WEB_CONSOLE_SESSION` on 89 / 95 / 96 with
  stage-6 support, simulator answers, OpenAPI regenerated, Try-it deny list, every count pin
  (97 / 36 / 61 / 67 / 40 / 31 / 6 / 10). Marker: `delegation_progress/contract_93_97_landed.md`
  (with an addendum for D114 / D117).
- Part 2: `apps/core-server/src/modules/capture-discovery/` (operations 93, 94), mounted in `app.ts`
  under D114 together with `modules/capture-inputs` (waived edits 19 to 22).
- Coordinator message 1: db pins at `[5, 'dbc-6']`; audit-type pins 63 -> 67 under
  `src/db/**`; four minimal fixture rows added in `src/db/fixtures/operations.ts`.
- Coordinator message 2: `searchClosed` on every closed search, `provideDiscovery`, db test for
  situation A and the pre-check search.
- Coordinator message 3: INTERNAL `registerCaptureDevice` + `registerCaptureDeviceIn`; optional
  `adapter` / `sourceClass` on the device slice; tester barrel export, mount lines,
  `CREDENTIAL_STORE_USERS` entry; D117 limits; redaction account-name rule.
- Flow test on the booted Core against row 60's stub, N = 1: 93 -> 95 -> 96 -> 79, passed.

## Results

| Run | Result |
|---|---|
| `packages/shared` (82 files) | 2251 passed; `gen-openapi --check` up to date |
| module unit tests (5 files) | 61 passed |
| db: capture-discovery, connect, capture-inputs | 36 passed |
| `rbac-matrix.test.ts` | 39 passed |
| `contract.test.ts` | 25 passed, 11 failed (was 13); none of the 11 lists operation 89 or 93 to 97 as wrong |
| db: `src/db`, `src/engine`, capture-config, devices | 320 passed, 1 failed (A-4, row 136's) |
| typecheck (server, web, mobile), lint (server, shared, web) | clean |

## Files of other rows touched, each in the smallest way

- Row 133: `modules/capture-inputs/__tests__/support.ts`, `no-device.db.test.ts` (no second registration).
- Row 142: `connect/index.ts` (`replaceForTest`), `connect/__tests__/connect.db.test.ts` (uses it).
- Row 66: `modules/capture-config/__tests__/routes.test.ts` (the routes of other units under `/capture`).
- Acceptance: `rbac-matrix.test.ts` / `.support.ts`, `contract.test.ts` (pins and lists by delta;
  the matrix gets a find-nothing discovery adapter and a window per permitted search).

## Open

- `contract.test.ts`: 11 red blocks for the walk's owner (earlier count pins, later rows' routes,
  no area yet for 89 and 93 to 97).
- `file_requests.md`: mobile `deviceConsole: true` (open); row 131's loopback guard and
  `net.createConnection` (new line); the `app.ts` line is marked applied.
- Not written by this row: `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`.
