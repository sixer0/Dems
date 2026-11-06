# coder-execution — row 91 (M8-W2 export + composite)

Status: **needs-review** — export, jobs, ops 42 / 87, receiver verify, sweep: complete and tested on test-builder packages. Composite encoder: **blocked: licence decision**. Production composition: waits for row 82. No commit.

## Files

New: `apps/core-server/src/evidence-export/{index,zip-store,export-manifest,package-export,composite,secret-sweep,jobs,receiver-verify,host}.ts`, `__tests__/{support,zip-store.test,export.test,jobs.test}.ts`; `apps/core-server/src/modules/evidence-export/index.ts`, `__tests__/routes.test.ts`; `docs/.../implementation/44_m8_export_composite.md`.

Edited: `apps/core-server/src/modules/evidence/index.ts` (op 42 block + 1 import), `src/modules/evidence/__tests__/static.test.ts` (import pin +1), `src/app.ts` (1 import, 1 mount line), `test/static/scaffold.test.ts` (1 row, 26->27, 18->19), `test/static/imports.test.ts` (1 `CLOSED_UNITS` entry), `THIRD_PARTY_NOTICES.md` (1 appended section), `delegation_progress/{file_claims,file_requests}.md`.

Not written (claimed, dropped): `src/evidence-export/__tests__/static.test.ts`.

## Checks for the test runner

| ID | Command (repo root) | Lock | Expected |
|---|---|---|---|
| M8-EXP-1, M8-CMP-1 (stand-in), sweep, M8-XAU-1 | `npm exec -w @dems/core-server -- vitest run --project unit src/evidence-export src/modules/evidence-export` | none | 4 files, 38 tests green |
| unit suite | `npm test -w @dems/core-server` | none | baseline failures only; `permission-guard/__tests__/static.test.ts:210` red from row 90's `src/media-stream/store-door.ts` |
| evidence db tests (op 42 unchanged without a runtime) | `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/evidence` | db-migrate | as before this row |
| contract / rbac walks | `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- test/acceptance` | db-migrate | RED BY DESIGN on `LANDED_UNROUTED` and `DEFERRED_ROUTE` until the two list entries of op 87 are removed (request filed); then op 87 joins the walks: 401 / 403 + denial row / 404 / 422 / 200 |

## Open for the controller

Requests in `file_requests.md` (4 lines, row 91). Decisions D-91-1..8 and the licence decision in the note.

## Follow-up (ruling D139)

`zip-store.ts` now writes through `yazl` 3.3.1 (interface unchanged). Also edited: `apps/core-server/package.json` (`yazl` dependency, `@types/yazl` devDependency, exact pins), `package-lock.json` (+3 entries, under `.locks/npm.lock`), `THIRD_PARTY_NOTICES.md` (one more appended section), `__tests__/export.test.ts` (+1 test: byte-identical archives). Status unchanged: needs-review; composite encoder blocked: licence decision.

## Follow-up 2 (ruling D143)

Edited: `apps/core-server/src/capture/__tests__/static.test.ts` (2 waived lines + 3 shifted indices), `apps/core-server/src/plugins/permission-guard/__tests__/without-domain-modules.ts` (stub + list entry).
