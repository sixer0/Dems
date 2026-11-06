---
task_id: RECON-E (row 55 follow-up, last pre-gate M2 code fixes, task 3 phase C)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution (paid; sole db-runner)
source_plan: docs/2026-10-07_dems_real_capture_sealing/gateway_check/15_m2_code_review.md (row 55 F1/SH-10 + §5 media-CODE), decisions D52-D53, dbc-3 §0.1 "same commit" rule (masterplan/04_database_contract.md:55)
status: needs-review — both items proven correct in behavior but BLOCKED by out-of-set coupling; tree restored byte-identical
tier: 3
---

# RECON-E — SH-10 snapshot bump (1→2) + media-profile CODE erratum

## 0. Scope, constraints carried in, and the bottom line

Brief: (1) land the atomic `SIM_SNAPSHOT_VERSION` 1→2 across the three named coupled sites;
(2) fix `sim/initial-state.ts:84` to the canonical underscore CODE and shrink the B2a mapping
bridge so it maps canonical codes directly and fails closed. Hard constraint: edit ONLY
`packages/shared/src/sim/constants.ts`, `packages/shared/src/api/state-slices.ts`,
`packages/shared/src/sim/initial-state.ts`, `apps/core-server/src/db/mapping/rows.ts`
(+ their tests); NEVER touch `openapi.json`, the lockfile, web/mobile/mock-core/release/trackers.

**Bottom line (both items hit the D-RD-2 class the brief pre-authorized reporting instead of
expanding):**

- ITEM 1 additionally requires `packages/shared/src/sim/types.ts:192` (the `MetaSlice` interface
  literal `schemaVersion: 1`) — a NON-allowed src file whose compiler errors prove it — and a
  regeneration of `packages/shared/openapi/openapi.json` (the committed doc embeds
  `"schemaVersion":{"type":"number","const":1}` and `openapi.test.ts:200` asserts byte equality)
  — an explicitly FORBIDDEN file. It also requires a one-shot live-data step: all four project
  DBs store `sim_schema_version = 1` today (§1.3).
- ITEM 2 additionally requires `packages/shared/src/api/state-examples.ts:335-336` (the wire/doc
  examples hardcode `'H264-1080P25'`) — a NON-allowed src file whose drift guard
  (`api-state-examples.test.ts:66` "eighteen slices equal the state") fails when only the
  constant moves — and, transitively, `openapi.json` regeneration (the examples are embedded
  there in 12 places).

Neither item can therefore land inside the allowed file set while keeping `tsc` exit 0, the
shared suite exit 0 and the openapi drift test green. Per the brief ("If you find the evidence
'two-files-per-item' flip is required for these items, DO NOT expand scope — report it as a
separate decision"; "return NEEDS-REVIEW with an exact remaining list"), **no edits were landed**
and **the tree was restored byte-identical to how it was received** (§4.1). Everything the
controller needs to rule in minutes is below, with the landing already executed once as a
throwaway experiment and proven behaviorally correct (§2, §3).

## 1. Baselines and facts measured before touching anything

### 1.1 Toolchain baselines (quoted)

- PostgreSQL: `pg:status: OK, running` (127.0.0.1:4432). Host :5432 never used or probed.
- Shared suite BEFORE (full): `Test Files 72 passed (72); Tests 1875 passed (1875); SHARED:0`.
- Core-server unit BEFORE (full): `Test Files 2 failed | 162 passed (164); Tests 3 failed | 4048 passed (4051)`
  — the 3 FAILs named: evidence `routes.test.ts` MODG x1 + sessions `routes.test.ts` MODG x2 (pre-existing R4 deferrals).
- Core-server db BEFORE: row-66/RECON-D baseline (tree untouched since): `12 failed | 1836 passed (1848)`
  = exactly the 12 named R4 route-walk deferrals.
- tsc/lint: both workspaces exit 0 on the received tree (proven again at the end, §4).

### 1.2 Coupling survey (read-only) — the sites that pin the version

| Site | Pins | In allowed set? |
|---|---|---|
| `sim/constants.ts:24` | `SIM_SNAPSHOT_VERSION = 1` | yes |
| `api/state-slices.ts:124` | wire `MetaSlice.schemaVersion: z.literal(1)` | yes |
| `sim/initial-state.ts:238` | idle state literal `schemaVersion: 1` | yes |
| `db/mapping/rows.ts:236,244` + `:317` | `metaFromRows` boot check + `snapshotSlicesFromRow` (`!== 1`) | yes |
| `sim/types.ts:192` | `interface MetaSlice { schemaVersion: 1; … }` — the static type of every `SimState['meta']` | **NO** |
| `sim/store.ts:92` | `meta.schemaVersion === SIM_SNAPSHOT_VERSION` — literal-vs-literal TS2367 guard | **NO** (src) |
| `openapi/openapi.json` | `components.schemas.MetaSlice.schemaVersion = {"type":"number","const":1}` | **NO (never touch)** |
| test pins | shared: `sim-v2-parity.test.ts:62` (`toBe(1)`), `sim-store.test.ts:370` (`"schemaVersion":1` dump + snapshot-content test), `api-state-slices.test.ts:751` (refuses 2), `api-state-examples`/realtime type-guards; core-server: `to-rows.test.ts:322` (injects 2 as the WRONG value), `seed.db.test.ts:94-98` (seeded `sim_schema_version: 1`), `test/db/fixtures.ts:385,401` (`sim_schema_version: 1` fixtures), `restart.db.test.ts:176-183` (INSERTs version 1 as the half-seeded refusal case), `engine/__tests__/ring.test.ts:104` (hand-built `meta.schemaVersion: 1`) | gray — re-pins required by any landing |

### 1.3 Live-data facts (read-only owner probe under `lockf`, creds in-process, never printed)

```
dems_demo:   core_state=1 hardware_snapshot=1 video_01_profile=H264_1080P25
dems_lane_1: core_state=1 hardware_snapshot=1 video_01_profile=H264_1080P25
dems_lane_2: core_state=1 hardware_snapshot=1 video_01_profile=H264_1080P25
dems_lane_3: core_state=1 hardware_snapshot=1 video_01_profile=H264_1080P25
```

Consequences: (a) the SH-10 bump needs a one-shot `UPDATE … SET sim_schema_version = 2`
(`core_state` + `hardware_snapshot`) on the four project DBs (or a reseed) in the same change,
or every lane Core fails `engine.rehydrate` at the gate UAT — currently UNOWNED by any row;
(b) the stored profile CODEs are ALREADY the canonical underscore form, so ITEM 2 needs no
data migration — the live rows and the fixed constant agree even before the bridge shrink.

## 2. ITEM 1 experiment — the bump executed once as a throwaway, then reverted

Applied to the allowed files only (`constants.ts:24`→2, `state-slices.ts:124`→`z.literal(2)`,
`initial-state.ts:238`→2, `rows.ts` checks→2). Files backed up first
(`.cache/reconE/backup-item1`, shas in `.cache/reconE/sha-before.txt`). Results, quoted:

- `tsc -p packages/shared` (src failures, the blockers):
  `src/sim/initial-state.ts(238,7): error TS2322: Type '2' is not assignable to type '1'`
  `src/sim/store.ts(92,5): error TS2367: … types '1 | undefined' and '2' have no overlap`
  (+ cascade errors in `test/api-realtime.test.ts:103/146/353/511`, `test/api-state-slices.test.ts:77/…`)
  → the `types.ts:192` interface literal must change; `types.ts` and `store.ts` are NOT editable by this row.
- `tsc -p apps/core-server`: `src/db/mapping/rows.ts(244,5): error TS2322: Type '2' is not assignable to type '1'` (same root cause via `SimState['meta']`).
- `openapi.test.ts` (full-suite share): **FAIL** `the committed openapi/openapi.json matches the builder byte for byte (no drift)` —
  the diff is exactly `const: 1` vs `const: 2` in `components.schemas.MetaSlice`.
  → regeneration of `openapi.json` (this row's forbidden file; row-50 lane) is mandatory.
- Behavior proof (what the landing must keep): shared targeted 4 files under the bump:
  `Tests 5 failed | 145 passed (150)` — the 5 are ALL stale pins/drift (parity pin, store dump pins,
  `refuses(schemaVersion:2)`, doc drift); every RESUME test passed: v2 snapshots emit (envelope
  `version: 2`) and hydrate (`restored` paths green), and the row-51 optional-capture-keys path
  still behaves (snapshots without `captureConfig`/`captureDevices` merge from fresh state).
- Core-server mapping under the bump: `src/db/mapping` run `1 failed | 102 passed (103)` —
  the single failure is `to-rows.test.ts:322` "expected a MappingError, and nothing was thrown":
  the boot check ACCEPTS stored 2 (exactly the required "accepts version 2"), and the test's
  wrong-value injection must flip to 1 (or 3) as part of the landing.

## 3. ITEM 2 experiment — the CODE erratum executed once, verified, then reverted

Applied (`initial-state.ts:84`→`'H264_1080P25'`; `rows.ts` bridge shrunk: `STORAGE_PROFILE_OF`/
`STATE_PROFILE_OF` + `replace(/-/g,'_')` deleted, `profileToCode`/`codeToProfile` = validated
identity on `^[A-Z][A-Z0-9_]{0,63}$`, failing closed; unused `CAPTURE_PROFILE_1080P25` import
dropped; 4 new fail-closed tests in `to-rows.test.ts`). Results, quoted:

- Targeted green: core-server mapping `4 files, 141 tests, EXIT:0`; shared 7 files (parity, store,
  slices, openapi, demo-data-alignment, selector-stability) `211 passed, EXIT:0`; tsc/lint both 0.
- Fail-closed proof (throwaway tsx probe at the public mapping boundary):
  ```
  INJECT H264-1080P25         -> REFUSED code=ROW_SHAPE place=capture_config.video_01_profile
  INJECT X-MUX_RAW            -> REFUSED code=ROW_SHAPE place=capture_config.video_01_profile
  INJECT h264_1080p25         -> REFUSED code=ROW_SHAPE place=capture_config.video_01_profile
  INJECT H264_1080P25-PLUS-9  -> REFUSED code=ROW_SHAPE place=capture_config.video_01_profile
  READ   stored BAD-CODE      -> REFUSED code=ROW_SHAPE place=capture_config.video_01_profile
  CANONICAL pass-through      -> stored video01Profile=H264_1080P25 video02Profile=H264_1080P25
  ```
  The F8 case (the retired hyphenated spelling) now refuses instead of being silently normalized.
  Valid open-set CODEs (e.g. `H264_720P30`, what op 77/OD-05 can write) still travel both ways.
- Full shared suite under the constant fix: `1 failed | 1874 passed (1875)` — the failure is the
  integrity guard doing its job: `api-state-examples.test.ts > eighteen slices equal the state` —
  `EXAMPLE_SLICES.captureConfig` (hardcoded `'H264-1080P25'` in `state-examples.ts:335-336`) vs
  the now-underscore `createIdleState()`. Fixing it = editing `state-examples.ts` (not allowed)
  and regenerating `openapi.json` (12 embedded example values; forbidden). Fixing the TEST instead
  would weaken the assertion — forbidden.
- Dependency proof for the pair: bridge-shrunk + constant-still-hyphen (half landing) →
  core-server mapping `45 failed | 30 passed (75)` — the two ITEM-2 sites are atomic together and
  with `state-examples.ts`; nothing partial may land.
- Post-fix grep (as it stands on the restored tree, which equals the received tree):
  `rg -n "H264-" packages/shared/src apps/*/src -t ts` →
  `sim/initial-state.ts:84` (the constant, the fix target), `api/state-examples.ts:335,336` (the
  doc examples, D-RE-2 blocker), `db/mapping/rows.ts:612` (the bridge comment, fixed by D-RE-2's
  row), plus `seed.ts:251` (a stale comment referencing the simulator's hyphen spelling — cosmetic
  residual for the same follow-up row). No engine, module, fixture or seed CODE path emits the
  hyphen form: the live DBs already store the underscore (§1.3).

## 4. Tree state and verification on the restored (delivered) tree

### 4.1 Byte-identical restore

`shasum -a 256 -c .cache/reconE/sha-before.txt` over all nine touched/prospected files:

```
packages/shared/src/sim/constants.ts: OK
packages/shared/src/api/state-slices.ts: OK
packages/shared/src/sim/initial-state.ts: OK
packages/shared/src/sim/types.ts: OK
apps/core-server/src/db/mapping/rows.ts: OK
packages/shared/test/sim-store.test.ts: OK
packages/shared/test/api-state-slices.test.ts: OK
packages/shared/test/sim-v2-parity.test.ts: OK
apps/core-server/src/db/mapping/__tests__/to-rows.test.ts: OK
```

### 4.2 Gates on the delivered tree (final runs, quoted verbatim)

- Shared suite (full): `Test Files 72 passed (72); Tests 1875 passed (1875)` → `SHARED:0`.
  before→after: **1875 passed → 1875 passed (no change)**.
- `packages/shared`: `tsc --noEmit` → `SHARED-TSC:0`; `oxlint .` → `SHARED-LINT:0`.
- `apps/core-server`: `tsc --noEmit` → `CORE-TSC:0`; `oxlint .` → `CORE-LINT:0`.
- Core-server unit (full): `Tests 3 failed | 4048 passed (4051)` — identical to the baseline;
  the 3 FAILs are the same named pre-existing route deferrals (`evidence/routes.test.ts` MODG,
  `sessions/routes.test.ts` MODG x2). **No new failures.**
- Core-server db (full, under `lockf`): `Test Files 1 failed | 125 passed (126);
  Tests 12 failed | 1836 passed (1848)` — identical to the RECON-D baseline; all 12 are the named
  R4 route-walk deferrals in `test/acceptance/contract.test.ts` (AC-B-09 x2, AC-B-10 x2,
  AC-B-14 x4, AC-B-93, SC6 x3). Teardown: `dropped 8 database(s) … 0 remain with the run prefix
  dems_test_local_tmm0d2dq_`. **No new failures; the 12 R4 deferrals were NOT re-pinned.**

### 4.3 Live DBs untouched; PostgreSQL left running

- No migrate/seed/reset was ever run against a project database by this row; the only DB commands
  were read-only `db:status` (before AND after) and the read-only §1.3 probe, both under
  `lockf -k .locks/db-migrate.lock`. Host :5432 was never contacted (the one stray `psql` probe
  failed before executing — `psql` is not on PATH — touching nothing).
- Final `db:status` after all work, all four project databases:
  ```
  db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.
  db:status: OK: dems_lane_1 is at the schema version this code expects and the ledger matches the files.
  db:status: OK: dems_lane_2 is at the schema version this code expects and the ledger matches the files.
  db:status: OK: dems_lane_3 is at the schema version this code expects and the ledger matches the files.
  ```
  and `pg:status: OK, running` — PostgreSQL RUNNING on 127.0.0.1:4432 at handoff.
- Test runs created only `dems_test_local_*` throwaways; every teardown reported "0 remain";
  nothing to drop by hand.

## 5. Exact remaining lists for the follow-up row (the decision packet)

Recommended single follow-up (call it RECON-F, paid, sole npm.lock + db-runner): file set
`sim/constants.ts, api/state-slices.ts, sim/initial-state.ts, sim/types.ts, api/state-examples.ts,
openapi/openapi.json (via openapi:gen), db/mapping/rows.ts, db fixtures/seed/test pins` + the
live-DB one-shot UPDATE. Both items then land coherently in one commit per dbc-3 §0.1.

ITEM 1 — SH-10 atomic bump 1→2:
1. `packages/shared/src/sim/constants.ts:24` `1`→`2` + rewrite the routing comment (`:13-23`).
2. `packages/shared/src/api/state-slices.ts:124` `z.literal(1)`→`z.literal(2)`.
3. **OUT-OF-SET APPROVAL NEEDED** `packages/shared/src/sim/types.ts:192` `schemaVersion: 1`→`2`
   (or `typeof SIM_SNAPSHOT_VERSION`) — required by TS2322/TS2367 (proven §2).
4. `packages/shared/src/sim/initial-state.ts:238` `schemaVersion: 1`→`SIM_SNAPSHOT_VERSION` (or 2).
5. `apps/core-server/src/db/mapping/rows.ts:236,244,317` boot checks 1→2 + messages.
6. **OUT-OF-SET APPROVAL NEEDED** `openapi.json` regeneration — `openapi.test.ts:200` byte drift
   (proven §2); doc version 0.3.0 unchanged (no new ops).
7. Test re-pins (all enumerated, none weakened): shared `sim-v2-parity.test.ts:57-62` (pin 2 +
   replace the deferral comment), `sim-store.test.ts:370` (`"schemaVersion":2`) and the
   snapshot-content test flagged in §2, `api-state-slices.test.ts:751` (refuses 3 — 2 becomes the
   accepted value); core-server `to-rows.test.ts:322` (wrong value 2→1), `test/db/fixtures.ts:385,401`
   (`sim_schema_version: 1`→`2`), `seed.db.test.ts:94-98` (seeded row 1→2 — the seed writes via
   `toRows`, so its stored value follows the constant), `engine/__tests__/ring.test.ts:104`
   (meta literal), `restart.db.test.ts:176-183` (the half-seeded INSERT — under the bump it is
   refused for the version reason too; change the inserted value to 2 to preserve the test's
   actual intent, "no engine state", and re-verify the cause code).
8. **NEW, UNOWNED**: live-data step — `UPDATE core_state/hardware_snapshot SET sim_schema_version = 2`
   on `dems_demo` + `dems_lane_1..3` (read-only fact: all four hold 1, §1.3) — otherwise the gate
   UAT lane Cores fail boot immediately after the bump. Decide: one-shot UPDATE vs reseed `dems_demo`
   vs the D50/OD-02 lane procedure; add a boot-check acceptance test for stored 2 + a refusal test
   for stored 1/3.
9. Proofs required at landing (already rehearsed, §2/§3): v2 emit+resume green; boot accepts 2,
   rejects wrong; row-51 optional-keys path intact (all measured in the experiment).

ITEM 2 — media CODE erratum:
1. `packages/shared/src/sim/initial-state.ts:84` `'H264-1080P25'`→`'H264_1080P25'` (+ erratum comment).
2. `apps/core-server/src/db/mapping/rows.ts:610-636` bridge shrink (validated identity, fail-closed
   both directions, `replace(/-/g,'_')` deleted) + drop the now-unused import (`:35`) + comment fix.
3. **OUT-OF-SET APPROVAL NEEDED** `packages/shared/src/api/state-examples.ts:335-336` example values
   → underscore (guarded by `api-state-examples.test.ts:66`; measured failure §3), then
4. **OUT-OF-SET APPROVAL NEEDED** `openapi.json` regeneration (the 12 embedded example values).
5. Optional same-commit hygiene (non-blocking, owner's call): stale comment `seed.ts:251`
   ("the simulator's hyphen spelling"), and the C3/dbc-3 doc erratum itself (data-analyst lane,
   row 55 §5).
6. Test additions proven ready: the 4 fail-closed cases drafted in `to-rows.test.ts` (quoted green
   at 141/141 in §3) — they strengthen, never weaken.

## 6. Issues & decisions log

- D-RE-1 (blocker → controller ruling): ITEM 1 cannot land atomically inside the allowed file set.
  Out-of-set src coupling `sim/types.ts:192` (TS2322/TS2367, quoted §2) + forbidden
  `openapi.json` byte drift (quoted §2) + an unowned live-data step (four DBs hold version 1, §1.3).
- D-RE-2 (blocker → controller ruling): ITEM 2 cannot land fully inside the allowed file set: the
  doc examples `state-examples.ts:335-336` are guarded by an equality test against the very state
  this item fixes (failure quoted §3) and are embedded in the forbidden `openapi.json`. The
  two in-set sites are only atomic together (45-failure proof §3).
- D-RE-3 (finding): the bump's boot check currently refuses stored 1, so the SH-10 landing MUST
  ship the live-DB `sim_schema_version` update (or a reseed) or break M2-LANE-1 at the gate.
- D-RE-4 (process note): the anti-hang contract's `timeout` binary does not exist on this host
  (`which timeout gtimeout` → not found). All commands instead used the session tool's own
  timeouts with `</dev/null`; no command hung; the full db project finished in ~2 min.
- Nothing was skipped, weakened or deleted: no `.skip/.todo/.only`, no timeout raised, no
  assertion edited. All experiments were fully reverted; the delivered tree is byte-identical
  to the received tree (§4.1).
