# coder-execution-local — RECON-F1 (media-profile CODE erratum)

Status: COMPLETE. Artifact: `implementation/69a_recon_media_code.md` (Tier 3).

## Landed (4 files, ITEM 2 only)

1. `packages/shared/src/sim/initial-state.ts:84` — `CAPTURE_PROFILE_1080P25` now `'H264_1080P25'` + erratum comment (C3 §1 SCREAMING_SNAKE_CASE, dbc-3 §B.1 CODE format, 0004 CHECK).
2. `packages/shared/src/api/state-examples.ts:335-336` — both example profiles to underscore.
3. `apps/core-server/src/db/mapping/rows.ts` — B2a bridge shrunk to a validated identity: `STORAGE_PROFILE_OF`/`STATE_PROFILE_OF` and the silent `replace(/-/g,'_')` fallback deleted; both `profileToCode` and `codeToProfile` now gate on `^[A-Z][A-Z0-9_]{0,63}$` and throw `MappingError('ROW_SHAPE', capture_config.video_0[12]_profile)`; unused import dropped; read call sites pass the column as `place`.
4. `packages/shared/openapi/openapi.json` — regenerated under `/usr/bin/lockf -k .locks/npm.lock` (check exit 1 → write exit 0 → determinism recheck exit 0), 89 ops / 2 schemes / 0.3.0 unchanged; 12 embedded CODE values converted, 0 hyphen left.

## Proofs

- Grep: `grep -rn "H264-" packages/shared/src apps/*/src` → zero hits; also zero across `packages/shared/test`, `apps/*/test`, and repo-wide (excl. docs/node_modules/.git/.cache/.data).
- Fail-closed probe (throwaway tsx at the public mapping boundary, deleted after): WRITE refuses `H264-1080P25`, `BAD-CODE`, `X-MUX_RAW`, `h264_1080p25`, ``, `H264_1080P25-PLUS-9`; READ refuses stored `H264-1080P25` and `BAD-CODE`; canonical round-trips equal; open-set `H264_720P30` travels both ways.
- Shared suite 72 files / 1875 tests exit 0 (state-examples guard + both byte-for-byte openapi guards green).
- Core-server mapping unit 4 files / 137 tests exit 0.
- tsc exit 0 and oxlint exit 0 for packages/shared and apps/core-server.

## Before → after

| Suite | Before | After |
|---|---|---|
| shared full | 72 / 1875 passed, exit 0 | 72 / 1875 passed, exit 0 |
| core-server mapping | 4 / 137 passed, exit 0 | 4 / 137 passed, exit 0 |
| core-server unit | 3 failed / 4048 (4051) | 3 failed / 4048 (4051), same MODG set |
| core-server db | 12 failed / 1836 (1848) | 12 failed / 1836 (1848), same R4 set |

No new failures; the 12 R4 route-walk deferrals were NOT re-pinned. Teardown dropped 8 throwaway DBs, 0 remain; no project DB migrated/seeded/reset; PostgreSQL left running.

## Notes for the controller

- No byte-drift re-pin was needed — both byte-for-byte guards pass against the regenerated file as written, so the fifth allowed file stayed untouched (reported, not manufactured).
- Snapshot version confirmed untouched at 1: `constants.ts:24`, `state-slices.ts:124`, `types.ts:192`, and the `!== 1` boot checks at `rows.ts:236/:317`; `to-rows.test.ts` still refuses stored 2 and passes. RECON-F2 owns ITEM 1 unchanged.
- Routed residuals: stale comment `db/seed/seed.ts:251` ("the simulator's hyphen spelling") is now false — outside F1's file set; the C3 §6/dbc-3 doc erratum stays with data-analyst; RECON-E's four drafted fail-closed cases for `to-rows.test.ts` are still unwritten (needs a row whose file set includes that test).
