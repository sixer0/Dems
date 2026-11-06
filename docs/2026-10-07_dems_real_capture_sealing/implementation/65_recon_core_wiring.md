---
task_id: RECON-B2a (D44 R5 — source-wiring half of the task-3 M2 core-server reconciliation)
task_slug: recon-core-wiring
date: 2026-10-08
agent: coder-execution (paid; D45 tiering fallback after three local attempts died)
status: completed
---

# Implementation Report — RECON-B2a: R5 M2 source wiring in `apps/core-server`

Scope per D44/D45: **R5 ONLY** (durable `captureConfig`/`captureDevices` wiring through the
engine-host / realtime / DB round-trip path; mapping fidelity; purity; role-name; audit 62).
R1/R2/R3/R4 belong to row B2b. Edits only under `apps/core-server/**`.

## Situation found at start (10:22Z)

The third FAILED-EMPTY local row (RECON-B2-local, D45) had actually LANDED most of the R5
classification work at 09:42–10:06Z before dying silently: `db/mapping/slices.ts` re-classified
(15 STORED + 15 snapshot = 30 = `REPLICATED_SLICE_NAMES`), the unit suite re-enumerated to only
**17 failing tests / 4014 passed (6 files)** — the 46 B1 items RECON-B counted were already green
at unit level. No `.skip`/`.todo` anywhere; `delta.test.ts` was TIGHTENED (strict set equality vs
`REPLICATED_SLICE_NAMES`); `writers.test.ts` asserts all 62 types accepted; `audit-details.test.ts`
:149 asserts the fixture covers every `AuditType` value with the attribution counts (ALLOW-LIST 18
/ MODULE 11 / SIMULATOR 33) — the residue is genuine, not assertion-weakening.

What was still NOT wired (found this row by running the db project): the DB round-trip half.

## Changes Made (this row)

| File | Type | Description |
|------|------|-------------|
| `src/db/mapping/rows.ts` | modify | (R5-1/2) Symmetric media-profile CODE mapping: `profileToCode`/`codeToProfile` — the sim slice keeps `H264-1080P25` (hyphen, shared-frozen constant `CAPTURE_PROFILE_1080P25`), the row stores `H264_1080P25` (the 0004 CHECK `^[A-Z][A-Z0-9_]{0,63}$` admits no hyphen); unknown hyphenated codes fail closed with `MappingError`; op-77 underscore codes pass through. `BUILT_IN_TRANSPORTS` table (CAM RTSP / MIC USB / POE SNMP, dbc-3 §B.2/§E.3) as the `transportOf` fallback so an engine write no longer clobbers the seeded transport to `UNKNOWN`. |
| `src/db/seed/seed.ts` | modify | (R5-1) Removed the hand-built capture override at the seed (`rows = {...rows, captureDevices: captureBuiltInDevices(), ...}`) — `toRows` is now the ONE builder of the capture row shape (ST-3 pins exactly this equality); CS-21 comment rewritten. Row counts unchanged (5 devices + 1 config). |
| `src/engine/__tests__/restart.db.test.ts` | modify | R5 consequence: rehydration unit reads 18 tables (16 + `capture_config` + `capture_devices`) — measured, decomposed in the comment. |
| `test/acceptance/shared-state.test.ts` | modify | R5 consequence: snapshots hold `REPLICATED_SLICE_NAMES.length` (30) slices, derived not hardcoded; support code already iterated the registry. |
| `src/db/reset/__tests__/m2-guard-keepset.db.test.ts` | modify | R5 consequence: the seed now writes the five built-ins, so the guard plants its discovery by UPDATE on the built-ins + one CAM-99 INSERT + credential (kept count `capture_devices: 6`). Intent preserved: mutated rows must cross a reset by upsert, never by rebuild. |
| `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` | modify | R5 item 5 db view: audit-mix exact count re-derived from the landed vocabulary (`Object.values(AuditType).length` = 62) instead of the v1 literal 53; the fixture now demonstrably writes all 62 types. |
| `src/modules/__tests__/contract-values.test.ts` | modify | Completed B2b's half-landed R3 re-derivation to unblock tsc: the assertion referenced `contract.DEVICE_COMMAND_OF_OPERATION`, which does not exist in the landed shared API; replaced with the distinct-operation count derived from the landed `DEVICE_COMMAND_OPERATIONS` table (POE_CYCLE reaches `restartDevice`, so 4 entries → 3 operations). No magic number. |
| `src/plugins/permission-guard/__tests__/decision.test.ts`, `denial.test.ts` | modify | Type-only: `(ROLE_PERMISSIONS[role] as readonly Permission[]).includes(...)` — the landed shared table is a readonly tuple; zero behavior change. Needed for tsc exit 0 (B2b residue had left the typecheck red). |
| `test/db/contract-inventory.ts` | modify | Type-only: `valueSets[name] = [...swap]` (readonly delta tuples into the mutable inventory shape). Needed for tsc exit 0. The 10 inventory re-point test failures REMAIN OPEN for B2b (R1 ruling). |

Root cause this row closed (the genuine remaining R5 gap): the classification landed by
B2-local made the 30-slice set internally consistent, but the row layer had no inverse of the
CODE-format normalization, so `fromRows(rows)` returned `H264_1080P25` while every durable-slice
equality test (ST-3, ST-5-later, write-through ×4, recording AC-B-52, restart rehydrate) compares
against the sim's hyphen spelling — and `captureDevicesToRows` had no source for the seeded
cameras' transport, so stored-vs-`toRows` column-by-column (ST-3) and the engine-write path could
not agree. Both fixed at the mapping seam; no migration, no `packages/shared`, no contract doc
touched. The routed erratum asking C3 to settle the canonical profile spelling is forwarded by
this row's board note (the state↔row bridge implemented here works under either final ruling).

## Verification (quoted)

- **Unit before → after** (full suite, `CI=true … --maxWorkers=2 --run </dev/null`):
  - BEFORE: `Test Files 6 failed | 158 passed (164); Tests 17 failed | 4014 passed (4031)`
  - AFTER: `Test Files 5 failed | 159 passed (164); Tests 16 failed | 4015 passed (4031)`
  - All 14 R5-attributable unit files green: hub.state/hub.lifetime/hub.control/
    hub.principal-cap/messages/delta (6 files, 141 tests) and to-rows/round-trip/changes/
    mapping-static/devices-static/audit-details/build/writers (8 files, 311 tests) — quoted at
    10:24Z and re-confirmed post-edit (mapping+devices+delta 167/167 after the rows.ts change).
- **typecheck**: `npx tsc --noEmit` → 0 errors, `npm run typecheck` **TSC-EXIT:0**.
- **lint**: `npm run lint` (oxlint) **LINT-EXIT:0**.
- **db, R5-touched files** (targeted run under `lockf -k .locks/db-migrate.lock`, throwaways):
  `Test Files 4 failed | 4 passed (8); Tests 17 failed | 106 passed (123)` — GREEN: write-through
  (was 4), restart (was 1), shared-state (was 2), m2-guard-keepset (was 1), seed ST-3 ×2 (were
  failing), seed-clock ST-5 slice (was failing), recording AC-B-52 (was failing), bulk-fixture
  audit mix (was failing). RECON-B's trio (effects.db / cli.db / reset-failures.db) stays green
  in the full run. Teardown: "dropped 8 database(s) ... 0 remain with the run prefix".
- **db, full project before → after** (first-ever full run; RECON-B only ran 3 files):
  BEFORE `Tests 121 failed | 1604 passed (1725)` / 27 failed files → AFTER
  `Tests 108 failed | 1617 passed (1725)` / 23 failed files. Teardown: `dropped 8 database(s) in
  170 ms; 0 remain with the run prefix`. None of the 108 remaining failures is capture-wiring-
  attributable (classification below).
- **Live databases untouched**: every statement targeted `dems_test_local_*` throwaways;
  `dems_demo` and lane DBs never named. PG left RUNNING: TCP probe 127.0.0.1:4432 →
  `PG STILL RUNNING` after all suites; `db-migrate.lock` released.

## Remaining failures — ownership

R4-deferred (unit; need a LIVE handler whose milestone is later — left untouched per ruling):
| File | Test | Owning milestone |
|------|------|------------------|
| `src/modules/sessions/__tests__/routes.test.ts` | MODG "registers operations 24 to 38 ... and nothing else" | switchAudioSource→M5, listAudioSourceIntervals→M5/M7, getSealingProgress→M7 |
| `src/modules/sessions/__tests__/routes.test.ts` | MODG "the tag Session of the registry is exactly the module's list" | same |
| `src/modules/evidence/__tests__/routes.test.ts` | MODG "the area of the registry is these five and no other" | createEvidenceMediaSession/createTranscriptRevision/getTranscript/listTranscriptRevisions/getEvidenceExportJob → M7/M8 |

B2b (R1/R2/R3) — unit (13 tests): `test/db/contract-inventory.test.ts` ×10 (v1 §4 inventory vs
dbc-3 40 tables), `test/db/commands.test.ts` ×1 (30-table pin), `src/db/seed/__tests__/cli.test.ts`
×1 (§9.4 line count 35→38), `src/modules/evidence/__tests__/routes.test.ts` ×1 (op-42 literal
`EXPORTED` vs landed `QUEUED` schema — clean stale pin, needs NO later handler).

B2b (R1/R3 stale pins) — db (108 tests, 23 files): v1-doc-dependent families (rbac-matrix 29,
matrix.db 9, privileges 6, catalog 6, commands.db 6, migrate 5, constraints 4, boot-checks B-3 4,
bulk-fixture §11 minimums 8, seed.db §9.4/AC-B-02 6, seed-clock 1, seed/reset cli 3, demo/db reset
7, immutability/bulk/commands-evidence `EXPORTED`→`QUEUED` 8, users.db/identity `14 permissions`
era 3) plus the `contract.test.ts` suite-load failure (the acceptance walker meets `cameras[]` in
the new op-77 body schema) and the `ticks.db`/`recording.db` meter-`"channels"` naming pin (SH-17
`inputs` re-key). None is attributable to the capture slices or to this row's seed/mapping change;
all were already failing at baseline.

## Issues / Decisions

| Issue | Resolution |
|-------|-----------|
| `timeout` binary does not exist on this macOS host | Anti-hang honored via `CI=true` + `--run` + `</dev/null` + background-process readiness patterns; every suite exited on its own. |
| Hyphen/underscore profile-code contradiction (shared constant vs 0004 CHECK; migration and `packages/shared` are not this row's to change) | Symmetric CODE bridge inside `db/mapping/rows.ts` only; fail-closed on unknown forms; canonical-spelling erratum to C3 forwarded via board (as row 49 flagged). |
| B2b's half-landed edits left `tsc` red (nonexistent symbol, readonly-tuple narrowing) | Minimal type-level completion (no assertion semantics changed), documented above so B2b does not double-fix. |
| Keepset guard assumed "the seed writes none of the capture rows" | Superseded by the R5 seed wiring; guard now mutates seeded built-ins instead of inserting them — same proof intent. |

## Next Steps (other rows)
- B2b: R1 inventory re-point (the 10+1 unit and the v1-doc db families), R3 literal re-pins
  (`EXPORTED`→`QUEUED` ×11, §9.4 seed counts, 14-permission era answers), R4 deferred-test
  enumeration (table above).
- Row 46 follow-up: the `contract.test.ts` acceptance walker must learn request `array` members.
- C3/dbc-3: erratum — settle the canonical profile CODE spelling (`H264_1080P25` stored form vs
  the sim's hyphen constant); this row's bridge works under either outcome.

---
*Generated: 2026-10-08 11:05* — RECON-B2a
