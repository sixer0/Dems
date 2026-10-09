# coder-execution — row 141 (development-source mark, V-15, op 41 report members, reset-guard disk side)

Status: **complete** (server side). Note: `implementation/72_r11_manifest_dev_mark.md`.

## Files

New:
- `packages/shared/src/evidence-verify/report.ts`
- `packages/shared/test/evidence-verify-sources.test.ts`, `packages/shared/test/api-verify-report.test.ts`
- `apps/core-server/src/evidence-verify/source-class-agreement.ts`
- `apps/core-server/src/evidence-verify/__tests__/dev-source-mark.test.ts`, `source-class-agreement.test.ts`

Edited:
- `packages/shared/src/evidence-verify/{types,verify,index}.ts`
- `packages/shared/src/api/evidence.ts` (op 41 response + one example); `packages/shared/openapi/openapi.json` (regenerated, unchanged by my run)
- `packages/shared/test/{evidence-verify,evidence-package,api-examples}.test.ts`
- `apps/core-server/src/evidence-verify/index.ts`, `__tests__/{support,verify-v2,core-verification,real-fragment-cipher}.ts`
- `apps/core-server/src/db/reset/{real-evidence,index}.ts`, `__tests__/{m4-sec-reset.db,real-evidence}.test.ts`
- `delegation_progress/file_claims.md` (2 lines), `file_requests.md` (4 lines)

Not touched: `packages/shared/src/sim/**`, `packages/shared/src/evidence-package/**` production files, `db/commands/**`, `capture/**`.

## Checks for the test runner

| Check | Command | Lock | Expected |
|---|---|---|---|
| shared whole suite | `npm run -w @dems/shared test` | none | green except what C1 has in flight |
| core-server unit suite | `npm run -w @dems/core-server test` | none | baseline 3 MODG + `test/db/set4-rules.test.ts` (names `modules/capture-discovery/adoption.ts:28`, not row 141) |
| core-server db suite | `npm run -w @dems/core-server test:db` (sandbox off) | `/usr/bin/lockf -k .locks/db-migrate.lock` | baseline 12 in `test/acceptance/contract.test.ts`; `src/db/reset` 99 pass |
| op 41 through the route (db) | `... test:db -- src/modules/evidence` | same | green (the schema is additive) |
| mutation proof (already run once: 13 of 15 red, 2 explained) | 15 single-line mutations listed in the note §3 | db lock for the 5 `RST-*` | no repeat needed |
| client files of row 87 | web `src/features/evidence/__tests__/verify-v2.test.tsx`, mobile twin | none | 2 red by design until row 87 follows (request filed) |
| M7-SEC-SRC-2 over the lanes and `dems_demo` | gate row 89 | — | 0 v2 rows with `development_sources` false or NULL |
| M7-DEVSRC-EVID-W / -T / -P | device session at the gate | — | note §6 |

## Blockers / decisions for the controller

See the note §7 (D-141-1..8) and the four lines of `file_requests.md` stamped row 141.
