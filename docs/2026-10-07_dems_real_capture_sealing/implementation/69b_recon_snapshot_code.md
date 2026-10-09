---
task_id: RECON-F2a (row 55 F1/SH-10 ITEM 1 CODE half — SIM_SNAPSHOT_VERSION 1→2, task 3 phase C)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution-local (sole npm.lock holder, sole packages/shared writer this turn)
source_plan: implementation/68_recon_snapshot_code.md §5 (ITEM 1 packet), implementation/69a_recon_media_code.md (F1 landed, snapshot still 1), gateway_check/15_m2_code_review.md row 55 F1/SH-10, decisions D54-D56
status: completed — SH-10 CODE half landed atomically; v2 emits and resumes, boot check accepts 2; live DBs untouched (still store 1, RECON-F2b's job)
tier: 3
---

# RECON-F2a — SH-10 `SIM_SNAPSHOT_VERSION` 1→2 (CODE half only)

## 0. Scope as received

ITEM 1 CODE HALF ONLY: bump `SIM_SNAPSHOT_VERSION` 1→2 atomically across every coupled site so the
tree stays coherent, regenerate `openapi.json`, and re-pin the tests that assert the old value.

In scope (per brief):
1. `packages/shared/src/sim/constants.ts:24` — the constant.
2. `packages/shared/src/sim/types.ts:192` — `MetaSlice.schemaVersion` interface literal.
3. `packages/shared/src/api/state-slices.ts:124` — `z.literal(1)`.
4. `packages/shared/src/sim/initial-state.ts` — the idle-state `schemaVersion` literal.
5. `apps/core-server/src/db/mapping/rows.ts` — the Core `sim_schema_version` boot checks: accept
   stored 2, refuse a wrong value.
6. `packages/shared/openapi/openapi.json` — regenerate under `/usr/bin/lockf -k .locks/npm.lock`,
   non-interactive, so the embedded `MetaSlice.schemaVersion` const becomes 2.
7. Re-pin shared/core-server tests that assert the old value (byte-drift, state-examples,
   snapshot emit/resume, mapping fixtures). Explicitly NOT the 12 R4 route-walk deferrals.

Explicitly OUT (RECON-F2b): any live-database mutation, any lane-Core restart. After this row the
CODE is v2 while the four project DBs still store 1, so lane Cores are EXPECTED not to boot until
F2b advances them — an intended transient state (D56). Also out: `apps/core-web`/`apps/mobile`,
`apps/mock-core`/`release`, controller trackers, `docs/2026-10-04_*`. No assertion weakened,
skipped or deleted; no timeout raised; no git push; no sudo.

## 1. Baselines measured before any edit (quoted)

- PostgreSQL: `pg:status: OK, running` → `PG_STATUS_EXIT:0` (127.0.0.1:4432; host :5432 never contacted).
- Live project DBs, READ-ONLY probe (`.cache/reconF2a/probe-version.mjs`, SELECT only, credentials
  never printed, under `lockf -k .locks/db-migrate.lock`) → `PROBE_EXIT:0`:
  ```
  dems_demo:   core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  dems_lane_1: core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  dems_lane_2: core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  dems_lane_3: core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  ```
  This is RECON-F2b's work item; this row changes none of it.
- `db:status` (read-only) for all four databases at receipt: all four `OK … at the schema version
  this code expects and the ledger matches the files` (`schema_meta` is `(2,'dbc-3')`, a different
  axis from `sim_schema_version`).
- Shared targeted BEFORE (`sim-store`, `sim-v2-parity`, `api-state-slices`, `openapi`;
  `CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run …` </dev/null):
  `Test Files 4 passed (4); Tests 150 passed (150)` → `SHARED_TARGETED_BEFORE:0`.
- Core-server mapping unit BEFORE (`vitest run --project unit src/db/mapping`):
  `Test Files 4 passed (4); Tests 137 passed (137)` → `MAPPING_BEFORE:0`.
- Full-suite baselines carried from RECON-F1 on this same tree (re-measured at the end of this row):
  shared 72 files / 1875 passed exit 0; core-server unit 3 failed / 4048 passed (4051); core-server
  db 12 failed / 1836 passed (1848); tsc/lint both workspaces exit 0.
- Working tree at receipt: 296 tracked changes uncommitted since `0024068` (the M2 wave), untouched
  by this row until its own edits.
- SHA-256 of every file this row may touch recorded in `.cache/reconF2a-sha-before.txt`.

## 2. Coupling inventory (read-only survey at receipt)

| Site | Pins | Action |
|---|---|---|
| `sim/constants.ts:24` | `SIM_SNAPSHOT_VERSION = 1` | bump to 2 + rewrite the routing comment |
| `sim/types.ts:192` | `interface MetaSlice { schemaVersion: 1 }` | bump to 2 |
| `api/state-slices.ts:124` | `schemaVersion: z.literal(1)` | bump to `z.literal(2)` |
| `sim/initial-state.ts:247` | idle state `schemaVersion: 1` | bump to 2 |
| `live/source/neutral-state.ts:158` | neutral `SimState` `schemaVersion: 1` | **extra coupled site found by this row** — same `SimState['meta']` type, TS2322 if left |
| `db/mapping/rows.ts:236/:244` | `metaFromRows` boot check `!== 1` + returned literal | accept 2, refuse wrong |
| `db/mapping/rows.ts:317` | `snapshotSlicesFromRow` boot check `!== 1` | accept 2, refuse wrong |
| `sim/store.ts:92/:116` | reads `SIM_SNAPSHOT_VERSION` (guard + envelope `version`) | no edit needed — follows the constant |
| `openapi/openapi.json` | `MetaSlice.schemaVersion = {"type":"number","const":1}` | regenerate |
| DB CHECK `core_state_sim_schema_version_check` | `sim_schema_version >= 1` | no migration needed — 2 already admitted by the stored constraint |
| test pins | see §4 list | re-pin, never weaken |

## 3. Steps landed

### STEP 1 — `packages/shared/src/sim/constants.ts:24` (done)

`SIM_SNAPSHOT_VERSION = 1` → `= 2`, and the routing comment rewritten: it no longer defers the bump
to "rows 48/49/52" (that deferral is what SH-10 was about) and instead names the coupled sites that
now carry 2, the openapi `"const": 2` consequence, the drop-not-migrate rule of `store.ts`, and the
optional-key behaviour of `ADDED_SNAPSHOT_KEYS`. No other line in the file touched.

### STEP 2 — `packages/shared/src/sim/types.ts:192` (done)

`MetaSlice.schemaVersion: 1` → `2`, with a one-line doc naming its two partners (`SIM_SNAPSHOT_VERSION`
and the wire literal). This is the site RECON-E proved required by TS2322/TS2367 (68 §2); the compiler
confirmed it again here — with only STEP 1 applied, `initial-state.ts` and `neutral-state.ts` fail to
typecheck against the interface.

### STEP 3 — `packages/shared/src/api/state-slices.ts:124` (done)

`schemaVersion: z.literal(1)` → `z.literal(2)` plus a comment naming the constant and the type it
mirrors. The api layer deliberately keeps its own literal (it imports no `sim/*` module today); the
openapi drift test is the mechanical guard that the three stay equal.

### STEP 4 — the two state builders (done)

- `sim/initial-state.ts:247` idle state `schemaVersion: 1` → `2`.
- `live/source/neutral-state.ts:158` neutral `SimState` `schemaVersion: 1` → `2`.
  **New coupling found by this row** (not in RECON-E's packet): `createNeutralState()` returns
  `SimState`, so the same TS2322 applies. It is inside `packages/shared`, which this row owns, and
  leaving it would have broken `tsc`; reported rather than hidden.

### STEP 5 — `apps/core-server/src/db/mapping/rows.ts` boot checks (done)

Both checks now compare against the imported `SIM_SNAPSHOT_VERSION` instead of a second hand-typed
literal, so the Core accepts exactly what the shared code emits and refuses anything else:

| Site | Before | After |
|---|---|---|
| `metaFromRows` guard | `state.simSchemaVersion !== 1` | `!== SIM_SNAPSHOT_VERSION` (accepts 2) |
| `metaFromRows` message | `this mapping reads version 1.` | interpolates `${SIM_SNAPSHOT_VERSION}` |
| `metaFromRows` return | `schemaVersion: 1` | `schemaVersion: SIM_SNAPSHOT_VERSION` |
| `snapshotSlicesFromRow` guard | `row.simSchemaVersion !== 1` | `!== SIM_SNAPSHOT_VERSION` (accepts 2) |
| `snapshotSlicesFromRow` message | `this mapping reads version 1.` | interpolates `${SIM_SNAPSHOT_VERSION}` |
| import line 35 | `DEFAULT_CAPTURE_DEVICES, EVIDENCE_FILE_TRACKS, eventCategory` | `+ SIM_SNAPSHOT_VERSION` |

Compiler evidence after STEPS 1-5 (`npx tsc --noEmit -p … </dev/null`, exit codes quoted in §5):
shared src+test exit 0; core-server reported exactly one error, the stale hand-built literal in
`engine/__tests__/ring.test.ts:104` (`Type '1' is not assignable to type '2'`), re-pinned in §4.
No production consumer broke: `grep -rn "schemaVersion|SIM_SNAPSHOT_VERSION"` over
`apps/core-web`, `apps/mobile`, `apps/mock-core` and `scripts` returns no hits at all, so the bump
has no client-side surface.

### STEP 6 — `packages/shared/openapi/openapi.json` regenerated (done)

One `lockf -k .locks/npm.lock` hold, non-interactive `</dev/null`, check → write → determinism
recheck (`node --import tsx packages/shared/scripts/gen-openapi.ts`, cwd-independent by design):

```
== check BEFORE ==        packages/shared/openapi/openapi.json is stale: run npm run openapi:gen …   CHECK_BEFORE_EXIT:1
== regen ==               wrote packages/shared/openapi/openapi.json (all (committed): 89 operations,
                          2 security schemes, version 0.3.0; offline: 23 operations, 0 security
                          schemes, version 0.2.0; 1132176 bytes)                                      GEN_EXIT:0
== determinism recheck == packages/shared/openapi/openapi.json is up to date (…)                      CHECK_AFTER_EXIT:0
```

The embedded component is now `"schemaVersion": { "type": "number", "const": 2 }`. Operation counts
and both document versions are unchanged (89 / 2 schemes / 0.3.0 committed, 23 / 0.2.0 offline): the
bump adds no operation, so no version pin moves. The file is exactly **1132176 bytes** — byte-for-byte
the size RECON-F1 recorded after its own regeneration — which bounds this row's contribution to the
single digit of that const. `git diff --stat` against HEAD is large (+13070/-6895) only because HEAD
predates the whole uncommitted M2 wave (same note as F1's D-F1-2).

**No byte-drift re-pin was needed**: `openapi.test.ts` and `api-openapi-scope.test.ts` compare the
committed file against a fresh render, so they are green against the regenerated file as written
(`Test Files 2 passed (2); Tests 45 passed (45)` → `OPENAPI_DRIFT_EXIT:0`). Likewise
`state-examples.ts` carries no `schemaVersion` value at all (`grep` = 0 hits): the brief anticipated
a re-pin there and none exists, reported rather than manufactured.

### STEP 7 — test re-pins (done; nothing weakened)

| File | Before | After | Strength |
|---|---|---|---|
| `shared/test/sim-v2-parity.test.ts:57-62` | `toBe(1)` + "not yet bumped" deferral comment | `toBe(2)` + comment naming the five coupled sites | same pin, now SH-10-closed |
| `shared/test/sim-store.test.ts:65` | `expect(parsed.version).toBe(1)` | `toBe(2)` | same pin (emit envelope) |
| `shared/test/sim-store.test.ts:370` | `toContain('"schemaVersion":1')` | `'"schemaVersion":2'` | same pin (stored dump) |
| `shared/test/api-state-slices.test.ts:751` | refuses `schemaVersion: 2` | accepts 2, refuses 1 **and** 3 | 1 assertion → 3 |
| `core-server/src/engine/__tests__/ring.test.ts:104` | hand-built `schemaVersion: 1` | `2` | TS2322 fix |
| `core-server/src/db/mapping/__tests__/to-rows.test.ts:322` | injected stored `2` as the wrong value | injects `1` and `3`, on `core_state` **and** `hardware_snapshot` | 1 refusal → 3 |
| `core-server/src/db/mapping/__tests__/to-rows.test.ts` (new `it`) | — | asserts stored 2 is ACCEPTED and reads back as `meta.schemaVersion === 2` | new positive pin |
| `core-server/test/db/fixtures.ts:385,401` | `sim_schema_version: 1` | `2` | fixtures follow the code |
| `core-server/src/db/seed/__tests__/seed.db.test.ts:98` | seeded `sim_schema_version: 1` | `2` (seed writes via `toRows`) | follows the constant |
| `core-server/src/engine/__tests__/restart.db.test.ts:179` | half-seeded INSERT with `1` | `2` — keeps the test's real intent ("state row present, no engine state") so the refusal still comes from `engine.rehydrate`, not from the version check | unchanged intent |

The 12 R4 route-walk deferrals in `test/acceptance/contract.test.ts` and the 3 MODG unit deferrals
were not touched, not re-pinned and not skipped. No `.skip`/`.todo`/`.only`, no timeout raised, no
assertion deleted.

## 4. Verification (quoted output)

Every command ran non-interactive with `</dev/null`, CI mode and `--run` (never watch). The host has
no `timeout`/`gtimeout` binary (D-RE-4 stands), so each command used the session tool's own timeout.

| Check | Command | Result |
|---|---|---|
| Shared suite (full) | `CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null` | `Test Files 72 passed (72); Tests 1875 passed (1875)` → `SHARED_FULL_EXIT:0` |
| Shared targeted (emit/resume/optional-keys/slices/openapi/examples) | same + six file names | `Test Files 6 passed (6); Tests 194 passed (194)` → `SHARED_TARGETED_AFTER:0` |
| OpenAPI byte-drift | `--run test/openapi.test.ts test/api-openapi-scope.test.ts` | `Test Files 2 passed (2); Tests 45 passed (45)` → `OPENAPI_DRIFT_EXIT:0`, const 2 |
| Core-server mapping unit | `vitest run --project unit src/db/mapping` | `Test Files 4 passed (4); Tests 138 passed (138)` → `MAPPING_AFTER:0` (baseline 137, +1 = the new acceptance test) |
| Core-server unit (full) | `vitest run --project unit --maxWorkers=2` | `Test Files 2 failed \| 162 passed (164); Tests 3 failed \| 4049 passed (4052)` — the same three MODG deferrals, **no new failure** |
| Core-server db (full) | `lockf -k .locks/db-migrate.lock vitest run --project db --maxWorkers=2` | `Test Files 1 failed \| 125 passed (126); Tests 12 failed \| 1836 passed (1848)` — the same twelve R4 deferrals, **no new failure** |
| Typecheck | `tsc --noEmit -p packages/shared`, `-p apps/core-server` | `SHARED_TSC_EXIT:0`, `CORE_TSC_EXIT:0` (empty logs) |
| Lint | `oxlint .` per workspace | `SHARED_LINT_EXIT:0`, `CORE_LINT_EXIT:0` |

### 4.1 v2 snapshot EMITS and RESUMES (row-51 optional-capture-keys path intact)

Verbose run of `sim-store.test.ts` + `sim-gap-closure.test.ts` → `EMIT_RESUME_EXIT:0`:

```
✓ persisted snapshot (dems.sim.v1) > excludes the audio, clock and auth slices and keeps everything else
✓ ready resolves after hydration (injected async storage) > holds the fresh state until the storage answers, then restores the snapshot
✓ ready resolves after hydration (injected async storage) > rejects a snapshot written with another seed and reports it
✓ throttled snapshot writes > coalesces changes into at most one write per second; flush() writes at once
✓ System & Maintenance (W52-…) > settings persist in the snapshot, and a snapshot from before step 54 (no settings) still resumes
```

The first is the EMIT proof — it asserts the persist envelope `version === 2`; the second is the
RESUME proof — a snapshot written by one sim hydrates into another with `wasRestored() === true` at
version 2; the last is the row-51 optional-key merge (`ADDED_SNAPSHOT_KEYS`) still resuming a state
that lacks a later slice. `sim-store.test.ts:370` additionally pins the stored JSON dump itself to
`"schemaVersion":2`. Nothing was migrated across versions by design: `store.ts` `migrate()` drops an
old-version snapshot instead of converting it.

### 4.2 The boot check ACCEPTS stored 2 and REFUSES a wrong value

Verbose run of `to-rows.test.ts` → `BOOTCHECK_EXIT:0`:

```
✓ what the mapping refuses > rows that do not form a state: two core_state rows, a head that disagrees with the newest row
✓ what the mapping refuses > SH-10: the boot check ACCEPTS the stored version 2 and reads it back as the meta schema version
```

The first now injects `simSchemaVersion: 1` and `3` on `core_state` and `3` on `hardware_snapshot`
and still gets a `MappingError` on the right place for each; the second is new and proves the happy
path: both stored columns carry 2 and `fromRows(rows).meta.schemaVersion === 2`. Because both checks
compare against the imported `SIM_SNAPSHOT_VERSION`, "accepts 2" and "accepts whatever the shared
code emits" are the same statement — the coupling cannot silently drift again.

### 4.3 OpenAPI regenerated, no byte drift

```
== check BEFORE ==        … openapi.json is stale: run npm run openapi:gen …   CHECK_BEFORE_EXIT:1
== regen ==               wrote … 89 operations, 2 security schemes, version 0.3.0; offline: 23 …, version 0.2.0; 1132176 bytes   GEN_EXIT:0
== determinism recheck == … openapi.json is up to date (…)                   CHECK_AFTER_EXIT:0
```

`"schemaVersion": { "type": "number", "const": 2 }` at line 23827 of the committed document, and the
two drift guards green (45 tests). File size unchanged from RECON-F1's regeneration (1132176 bytes),
bounding this row's diff to the single digit.

### 4.4 Before → after test counts

| Suite | Before (received tree) | After (delivered tree) | Delta |
|---|---|---|---|
| shared (full) | 72 files / 1875 passed, exit 0 | 72 files / 1875 passed, exit 0 | none (assertions inside one `it` went 1 → 3) |
| shared targeted (the four version-pinning files) | 4 files / 150 passed | 6 files / 194 passed | +2 files chosen for the emit/resume + examples guards, all green |
| core-server mapping unit | 4 files / 137 passed | 4 files / 138 passed | **+1** new acceptance test |
| core-server unit (full) | 3 failed / 4048 passed (4051) | 3 failed / 4049 passed (4052) | +1 passing, same 3 named deferrals |
| core-server db (full) | 12 failed / 1836 passed (1848) | 12 failed / 1836 passed (1848) | identical set |
| tsc / lint (both workspaces) | 0 / 0 | 0 / 0 | unchanged |

Named deferrals, untouched and NOT re-pinned: unit `evidence/routes.test.ts` MODG ×1 +
`sessions/routes.test.ts` MODG ×2; db `test/acceptance/contract.test.ts` AC-B-09 ×2, AC-B-10 ×2,
AC-B-14 ×4, AC-B-93 ×1, SC6 ×3 (verified by name against the log, identical to the RECON-D/F1 set).

## 5. Live databases untouched (RECON-F2b owns them)

No migration, seed, reset or write of any kind was executed against `dems_demo` or `dems_lane_1..3`
by this row. The only database commands were read-only: `db:status` per database (before AND after)
and the SELECT-only probe `.cache/reconF2a/probe-version.mjs` (credentials read from
`.data/pg.owner.env`, never printed), both under `lockf -k .locks/db-migrate.lock`.

Before and after are byte-identical in content:

```
db:status: OK: dems_demo   is at the schema version this code expects and the ledger matches the files.
db:status: OK: dems_lane_1 is at the schema version this code expects and the ledger matches the files.
db:status: OK: dems_lane_2 is at the schema version this code expects and the ledger matches the files.
db:status: OK: dems_lane_3 is at the schema version this code expects and the ledger matches the files.

dems_demo:   core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
dems_lane_1: core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
dems_lane_2: core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
dems_lane_3: core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
```

The db test project created only `dems_test_local_*` throwaways: `[test:db] teardown: dropped 8
database(s) in 167 ms; 0 remain with the run prefix dems_test_local_tmm1fuwz_`. Host :5432 was never
contacted. PostgreSQL left running (`pg:status: OK, running`).

**Intended transient state:** the CODE is now v2 while the four project DBs store 1, so a lane Core
started now would be refused at `engine.rehydrate` (`core_state.sim_schema_version`) until RECON-F2b
advances them (D56). No lane Core was started or restarted here — the three `.locks/core-server.laneN.pid`
files hold no live pid (`pid none not running`), so nothing was broken mid-flight either.

## 6. Files changed

| File | Type | Change |
|---|---|---|
| `packages/shared/src/sim/constants.ts` | modify | `SIM_SNAPSHOT_VERSION` 1→2 + comment rewritten |
| `packages/shared/src/sim/types.ts` | modify | `MetaSlice.schemaVersion` literal 1→2 + doc line |
| `packages/shared/src/api/state-slices.ts` | modify | wire `z.literal(1)`→`z.literal(2)` + comment |
| `packages/shared/src/sim/initial-state.ts` | modify | idle-state `schemaVersion` 1→2 |
| `packages/shared/src/live/source/neutral-state.ts` | modify | neutral-state `schemaVersion` 1→2 (coupling found by this row) |
| `apps/core-server/src/db/mapping/rows.ts` | modify | both boot checks + returned literal compare/emit `SIM_SNAPSHOT_VERSION`; import extended |
| `packages/shared/openapi/openapi.json` | regenerate | `MetaSlice.schemaVersion` const 1→2; ops/versions unchanged |
| `packages/shared/test/sim-v2-parity.test.ts` | re-pin | pin 2 + SH-10-landed comment |
| `packages/shared/test/sim-store.test.ts` | re-pin | envelope `version` 2, dump `"schemaVersion":2` |
| `packages/shared/test/api-state-slices.test.ts` | re-pin | accepts 2, refuses 1 and 3 (1 assertion → 3) |
| `apps/core-server/src/engine/__tests__/ring.test.ts` | re-pin | hand-built meta literal 1→2 (TS2322) |
| `apps/core-server/src/db/mapping/__tests__/to-rows.test.ts` | re-pin + add | wrong-value injections 1/3 on both columns + new accepts-2 test |
| `apps/core-server/test/db/fixtures.ts` | re-pin | both fixture rows 1→2 |
| `apps/core-server/src/db/seed/__tests__/seed.db.test.ts` | re-pin | seeded `sim_schema_version` 1→2 |
| `apps/core-server/src/engine/__tests__/restart.db.test.ts` | re-pin | half-seeded INSERT 1→2 (intent preserved) |

Not touched: `apps/core-web`, `apps/mobile`, `apps/mock-core`, `release/`, `scripts/`, controller
trackers (`status_tasks.md`, `delegation_progress_report.md`), `docs/2026-10-04_*`, any migration SQL
(the stored CHECK `sim_schema_version >= 1` already admits 2), any live database. No git write at all
(no add, commit, push or remote). Note: `decisions/decisions.md` shows a 05:30:05 mtime from the
controller's own D56 entry — not this row's edit.

## 7. Residuals routed to others

1. **RECON-F2b (next, authorised by D56):** the one-shot `UPDATE … SET sim_schema_version = 2` on
   `core_state` + `hardware_snapshot` in `dems_demo` + `dems_lane_1..3` (kept tables and pairing
   preserved), then restart the lane Cores to restore M2-LANE-1 boot. Until then the lanes do not
   boot — intended.
2. `apps/core-server/src/db/seed/seed.ts:251` still carries the stale "hyphen spelling" comment
   routed by RECON-E/F1; this row had no reason to open that file.
3. RECON-E's four drafted fail-closed CODE cases for `to-rows.test.ts` remain unwritten (F1 residual
   3); this row added only the SH-10 cases it needed.
4. The C3 §6 / dbc-3 media-CODE doc erratum stays with the data-analyst lane (F1 residual 2).

## 8. Issues & decisions log

- D-F2a-1: **one coupling beyond the brief's list** — `live/source/neutral-state.ts:158` builds a
  `SimState` and carries the same literal. Left alone it breaks `tsc -p packages/shared`; it is
  inside this row's write boundary, so it was bumped rather than escalated.
- D-F2a-2: the Core boot checks were switched from hand-typed literals to the imported
  `SIM_SNAPSHOT_VERSION`. This makes "accepts 2" self-maintaining and removes the duplication the
  register complained about; the error messages interpolate the same value.
- D-F2a-3: no byte-drift re-pin and no `state-examples.ts` change were required (both anticipated by
  the brief). Reported rather than manufactured, same class as F1's D-F1-1.
- D-F2a-4: `restart.db.test.ts`'s half-seeded case had to move to 2 to keep testing what it claims
  ("state row present, no engine state"). Leaving it at 1 would have made the refusal come from the
  version check instead, i.e. silently changed the test's meaning — the opposite of a re-pin.
- D-F2a-5: nothing skipped, weakened or deleted: no `.skip`/`.todo`/`.only`, no timeout raised, no
  assertion removed; two test bodies gained assertions, none lost.
