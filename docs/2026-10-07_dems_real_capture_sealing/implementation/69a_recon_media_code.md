---
task_id: RECON-F1 (row 55 follow-up ITEM 2 only — media-profile CODE erratum, task 3 phase C)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution-local (sole npm.lock holder, sole packages/shared writer this turn)
source_plan: implementation/68_recon_snapshot_code.md §3+§5 (ITEM 2 rehearsed packet), gateway_check/15_m2_code_review.md §5 (Adjudication 3), implementation/65_recon_core_wiring.md (B2a bridge), decisions D54-D55
status: completed — ITEM 2 landed coherently; snapshot version untouched at 1
tier: 3
---

# RECON-F1 — media-profile CODE erratum (`H264-1080P25` → `H264_1080P25`)

## 0. Scope as received

ITEM 2 ONLY. Four files (+ the openapi byte-drift pin):

1. `packages/shared/src/sim/initial-state.ts:84` — canonical underscore CODE.
2. `packages/shared/src/api/state-examples.ts:335-336` — the two hyphenated example values.
3. `apps/core-server/src/db/mapping/rows.ts:~612` — shrink the B2a bridge to a validated identity
   that fails closed; delete the silent `replace(/-/g,'_')` normalisation.
4. `packages/shared/openapi/openapi.json` — regenerate so the embedded CODE values match, then
   re-pin the byte-drift expectation.

Explicitly OUT of this row (RECON-F2's job): `sim/constants.ts`, `sim/types.ts`,
`api/state-slices.ts`, the Core boot check, and anything that moves `SIM_SNAPSHOT_VERSION`. The
snapshot version MUST stay 1 at handoff (§7 proves it). Also out: core-web/mobile, mock-core/release,
controller trackers, `docs/2026-10-04_*`, and the 12 R4 route-walk deferrals.

## 1. Baselines measured before any edit (quoted)

- PostgreSQL: `pg:status: OK, running` (127.0.0.1:4432). Host :5432 never contacted.
- Shared suite BEFORE (full, `CI=true … --maxWorkers=2 --run </dev/null`):
  `Test Files 72 passed (72); Tests 1875 passed (1875)` → `SHARED_BASELINE_EXIT:0`.
- Core-server mapping unit BEFORE (`vitest run --project unit src/db/mapping`):
  `Test Files 4 passed (4); Tests 137 passed (137)` → `MAPPING_BASELINE_EXIT:0`.
- Hyphen inventory BEFORE (`grep -rn "H264-" packages/shared/src packages/shared/test apps/*/src apps/*/test`):
  `sim/initial-state.ts:84`, `api/state-examples.ts:335`, `api/state-examples.ts:336`,
  `db/mapping/rows.ts:612` (comment) — plus 12 embedded values in `openapi/openapi.json`.
  No test file under `packages/shared/test` holds a hyphenated CODE.

## 2. Steps landed

### STEP 1 — `packages/shared/src/sim/initial-state.ts:84` (done)

`CAPTURE_PROFILE_1080P25` `'H264-1080P25'` → `'H264_1080P25'`, with an erratum comment citing
C3 §1 (`SCREAMING_SNAKE_CASE` machine codes), dbc-3 §B.1 (`CODE` format on `video_0*_profile`) and
the 0004 CHECK `^[A-Z][A-Z0-9_]{0,63}$` that admits no hyphen. No other line in the file touched;
`SIM_SNAPSHOT_VERSION` is not read or written by this edit.

### STEP 2 — `packages/shared/src/api/state-examples.ts:335-336` (done)

Both `EXAMPLE_SLICES.captureConfig` camera examples now carry `profile: 'H264_1080P25'`. These two
literals are what the integrity guard `api-state-examples.test.ts > eighteen slices equal the state`
compares against `createIdleState()`; moving the constant without them is exactly the failure
RECON-E measured (§3 of 68). No test file was edited — the guard stays as written.

### STEP 3 — `apps/core-server/src/db/mapping/rows.ts` bridge shrink (done)

The B2a two-way spelling table is gone:

| Removed | Replaced by |
|---|---|
| `STORAGE_PROFILE_OF` / `STATE_PROFILE_OF` maps | nothing — the identity needs no table |
| `profile.replace(/-/g,'_')` fallback in `profileToCode` | `PROFILE_CODE_FORM.test(profile)` gate, then return the value unchanged |
| `codeToProfile(code)` pass-through (`?? code`) | `codeToProfile(code, place)` — same `^[A-Z][A-Z0-9_]{0,63}$` gate on the STORED value, so a bad row is refused on read too |
| unused `CAPTURE_PROFILE_1080P25` import (`:35`) | dropped from the `@dems/shared/sim` import list |
| comment naming the old spelling literally | prose ("a hyphen between the codec and the resolution") so the grep proof stays clean |

Both directions refuse with `MappingError('ROW_SHAPE', 'capture_config.video_0[12]_profile', …)`;
the read call site (`captureConfigFromRow`) now passes the column as the place. An open-set CODE
that operation 77 may write still travels both ways unchanged.

Fail-closed proof — throwaway `tsx` probe at the public mapping boundary (`.cache/reconF1/probe.ts`,
gitignored, deleted after the run; `PROBE_EXIT:0`):

```
SLICE     profiles -> H264_1080P25, H264_1080P25
CANONICAL toRow    -> video01Profile=H264_1080P25 video02Profile=H264_1080P25
CANONICAL fromRow  -> H264_1080P25, H264_1080P25 equalToSlice=true
OPEN-SET  both ways-> stored=H264_720P30 readBack=H264_720P30
REFUSED   WRITE slice profile "H264-1080P25" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   WRITE slice profile "BAD-CODE" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   WRITE slice profile "X-MUX_RAW" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   WRITE slice profile "h264_1080p25" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   WRITE slice profile "" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   WRITE slice profile "H264_1080P25-PLUS-9" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   READ  stored  "H264-1080P25" -> code=ROW_SHAPE place=capture_config.video_01_profile
REFUSED   READ  stored  "BAD-CODE" -> code=ROW_SHAPE place=capture_config.video_01_profile
```

The F8 case (the retired hyphenated spelling) now refuses instead of being silently normalised, in
both directions. No test file was added or changed: the brief's file set does not include
`to-rows.test.ts`, so the four fail-closed cases RECON-E drafted stay as a routed suggestion (§6).

### STEP 4 — `packages/shared/openapi/openapi.json` regeneration (done, no re-pin needed)

Ran under `/usr/bin/lockf -k .locks/npm.lock` in one hold (check → write → determinism recheck),
non-interactive `</dev/null`, from `packages/shared` via `node --import tsx scripts/gen-openapi.ts`
(the D49 sandbox form):

```
== check BEFORE ==        openapi/openapi.json is stale: run npm run openapi:gen -w @dems/shared   CHECK_BEFORE_EXIT:1
== regen ==               wrote openapi/openapi.json (all (committed): 89 operations, 2 security schemes,
                          version 0.3.0; offline: 23 operations, 0 security schemes, version 0.2.0; 1132176 bytes)  GEN_EXIT:0
== determinism recheck == openapi/openapi.json is up to date (…)                                  CHECK_AFTER_EXIT:0
```

Operation counts and versions are unchanged (89 / 2 schemes / 0.3.0 committed, 23 / 0.2.0 offline):
this erratum adds no operation, so no version pin moves. The CODE surface converted is exactly the
12 embedded example values measured at receipt (`grep -c "H264-"` = 12 lines) → now 12 occurrences
of `H264_1080P25` and **0** of the hyphen form.

**No byte-drift re-pin was required.** Both guards are green against the regenerated file as
written: `openapi.test.ts:200` ("matches the builder byte for byte") and
`api-openapi-scope.test.ts:280` ("AC-B-11: is the committed openapi.json, byte for byte, with 89
operations and two security schemes"). The section SHA-256 pins in that file are baseline-component
pins and the capture components are already on its widened/changed-by-M2 lists, so the CODE change
touches none of them. Editing a pin that did not move would have been a fabricated change, so none
was made — the fifth allowed file was not needed.

## 3. Verification (quoted)

| Check | Command | Result |
|---|---|---|
| Grep proof (src) | `grep -rn "H264-" packages/shared/src apps/*/src --include="*.ts" --include="*.tsx"` | no output, exit 1 (zero hits) |
| Grep proof (incl. tests) | same over `packages/shared/{src,test} apps/*/{src,test}` | no output (zero hits) |
| Grep proof (repo-wide) | `grep -rn "H264-" .` excl. docs, node_modules, .git, .cache, .data | no output (zero hits) |
| Fail-closed | throwaway tsx probe | quoted in STEP 3 |
| Shared suite | `CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null` | `Test Files 72 passed (72); Tests 1875 passed (1875)` → exit 0 |
| Mapping unit | `vitest run --project unit src/db/mapping` | `Test Files 4 passed (4); Tests 137 passed (137)` → exit 0 |
| Core-server unit | `vitest run --project unit` | `Tests 3 failed \| 4048 passed (4051)` — the same three MODG route deferrals |
| Core-server db | `vitest run --project db` under `lockf .locks/db-migrate.lock` | `Test Files 1 failed \| 125 passed (126); Tests 12 failed \| 1836 passed (1848)` — the same 12 R4 deferrals |
| Typecheck | `tsc --noEmit` per workspace | `SHARED_TSC_EXIT:0`, `CORE_TSC_EXIT:0` |
| Lint | `oxlint .` per workspace | `SHARED_LINT_EXIT:0`, `CORE_LINT_EXIT:0` |

Before → after counts:

| Suite | Before | After |
|---|---|---|
| shared (full) | 72 files / 1875 passed, exit 0 | 72 files / 1875 passed, exit 0 |
| core-server mapping unit | 4 files / 137 passed, exit 0 | 4 files / 137 passed, exit 0 |
| core-server unit (full) | 3 failed / 4048 passed (4051) | 3 failed / 4048 passed (4051) — identical set |
| core-server db (full) | 12 failed / 1836 passed (1848) | 12 failed / 1836 passed (1848) — identical set |

The named failures are unchanged and were NOT re-pinned: unit = `evidence/routes.test.ts` MODG x1 +
`sessions/routes.test.ts` MODG x2; db = `test/acceptance/contract.test.ts` AC-B-09 x2, AC-B-10 x2,
AC-B-14 x4, AC-B-93 x1, SC6 x3. Teardown: `dropped 8 database(s) … 0 remain with the run prefix
dems_test_local_tmm0zih4_`; the stale sweep dropped 0. No project database was migrated, seeded or
reset by this row; PostgreSQL left running.

## 4. Snapshot version untouched (RECON-F2's half)

| Site | Value at handoff | mtime |
|---|---|---|
| `sim/constants.ts:24` | `SIM_SNAPSHOT_VERSION = 1` | 04:59:09 (predates this session) |
| `api/state-slices.ts:124` | `schemaVersion: z.literal(1)` | 04:59:09 (predates) |
| `sim/types.ts:192` | `schemaVersion: 1` | 13:52:31 (predates) |
| `db/mapping/rows.ts:236` / `:317` | `!== 1` boot checks, both still 1 | file edited by STEP 3, version lines untouched |

Behavioural corroboration: `to-rows.test.ts` still injects stored version 2 as the WRONG value and
still expects a `MappingError`, and the mapping suite is 137/137 green — the boot check therefore
still refuses 2 and accepts 1 exactly as before this row.

## 5. Files changed

| File | Type | Change |
|---|---|---|
| `packages/shared/src/sim/initial-state.ts` | modify | canonical `CODE` + erratum comment (1 constant) |
| `packages/shared/src/api/state-examples.ts` | modify | two example values |
| `apps/core-server/src/db/mapping/rows.ts` | modify | bridge shrink to validated identity, fail closed both ways, unused import dropped, read call sites pass `place` |
| `packages/shared/openapi/openapi.json` | regenerate | 12 embedded CODE values; deterministic recheck exit 0; ops/versions unchanged |

No test file was edited, added, skipped or weakened; no timeout raised; no assertion deleted; no
`.skip`/`.todo`/`.only` introduced; no R4 deferral re-pinned; no git write, no push, no sudo.

## 6. Residuals routed to others (not this row's file set)

1. `apps/core-server/src/db/seed/seed.ts:251` — the comment still says "the simulator's hyphen
   spelling", which this row just made false. Cosmetic; RECON-E §5 ITEM 2 point 5 already routed it.
   Owner: whoever next touches `seed.ts` (RECON-F2 or the row-56 gate fixes).
2. The C3 §6 / dbc-3 doc erratum itself (standardising the profile `CODE` spelling in the contract
   text) stays with the data-analyst lane, per `15_m2_code_review.md` §5.
3. RECON-E's four drafted fail-closed cases for `to-rows.test.ts` are still unwritten — they belong
   to a row whose file set includes that test. The behaviour they assert is proven here by probe,
   not yet pinned by a test.
4. ITEM 1 (SH-10 snapshot bump + live-dev-DB `sim_schema_version` update + lane-Core boot) remains
   entirely RECON-F2's, unchanged by this row.

## 7. Issues & decisions log

- D-F1-1: the brief anticipated a byte-drift re-pin; empirically none was needed (STEP 4). Reported
  rather than manufactured.
- D-F1-2: `git diff` on `openapi.json` against HEAD is large (+13070/-6895) because HEAD predates
  the whole uncommitted M2 wave (v0.2.1 / 75 operations, no capture slices). That drift is rows
  47/50/51's pending work, not this row's; this row's contribution is the 12 CODE values, bounded by
  the 12→0 hyphen count and the unchanged 89-operation / 0.3.0 pins.
- D-F1-3: `timeout`/`gtimeout` is absent on this host (as RECON-E recorded in D-RE-4); every command
  used `</dev/null` plus the tool's own timeout, CI=true and `--run`. Nothing hung.
- D-F1-4: the erratum comments deliberately avoid quoting the retired literal so the required grep
  proof returns zero hits across the source trees.

