# database-specialist-local - row 45 (M2-W2 typed schema v2, tier 3)

Status: **NEEDS-REVIEW** (schema source complete and verified; root `typecheck` cannot reach exit 0 inside this row's file set). Date: 2026-10-08. Session: database-specialist subagent (fallback slot), phase C milestone M2, blueprint rev 2.1; dependency row 106 verified satisfied before start.

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/10_m2_schema_check.md` (Tier 3) plus this note. No live database was migrated, no migration file was created, no tracker/masterplan file was edited, no commit was made.

## Result summary

| Measure | Count |
|---|---:|
| New capture/evidence/transcript tables authored (dbc-3 §B) | 9 / 9 |
| Changed tables authored (§B.10-§B.12) | 3 / 3 (`active_session` +5, `evidence_items` +3, `evidence_tracks` +7 columns) |
| FAULT_KIND CHECK sites swapped (§C.1-§C.3) | **3 / 3**, each with before/after file:line in §6.1 of the artifact |
| Other CHECK swaps named by the row (§C.4-§C.6) | 4 / 4 (`:335`, `:336`, new `signature_value`, `:340`, `:354`, `:260`) + both audit key sites `:199`/`:220` 17 -> 25 |
| `value-sets.ts` FAULT_KIND | 14 values; 9 new closed sets added |
| Typed-schema totals | 39 tables, 405 columns, 156 CHECKs, 38 FKs (v1: 30 / 302 / 98 / 25) |
| `npm run lint` root | exit 0 |
| `npm run typecheck` root | exit 2 - 14 errors, **0 of them under `src/db/schema/`** |
| core-server unit suite (`--maxWorkers=2`) | 8 failed / 3946 passed (3954), 3 files - all v1 count pins |
| Static CHECK-site harness (this row, `exit 0` on pass / `exit 1` on any miss) | 47 PASS, 0 FAIL |
| Databases touched | **none** - `dems_demo`, `dems_lane_1..3` all still `(1,'dbc-2')`, 30 base tables, journal 4 rows; no throw-away DB created |

## Verification state of the three named checks

* **M2-MT-3** and **M2-DB-CHK-1**: accept/reject decisions executed against the CHECK text the typed
  schema generates (drizzle dialect, no connection): 14-kind lists in all three sites, a 15th value
  outside them, Ed25519 + 128-hex accepted, Ed25519 + 64-hex rejected, SIMULATED + 64-hex still valid,
  simulated-flag rule separated from the encoding CHECK. **Runtime INSERTs against a migrated database
  are row 46** (dbc-3 §G puts all three in the db project and allows only a throw-away copy of
  `dems_demo` / fresh lanes).
* **M2-MT-8**: "same commit" half satisfied (value-sets is in this change set) and the three generated
  lists equal the 14-entry constant in order; the **shared-constant half is not yet true** - `FaultKind`
  (`packages/shared/src/sim/vocabulary.ts:193-206`) is still 12 values and belongs to row 47 (SH-01).
  Catalog-text comparison against `pg_get_constraintdef` needs the migrated DB (row 46).

## Routed to the controller (detail in §8 of the artifact)

* **Sequencing conflict.** Widening the DB-side value sets and adding columns necessarily breaks their
  consumers: 6 errors in `src/db/mapping/rows.ts` (needs the v2 row shapes - row 49 - and the widened
  shared `FaultKind`/`IntegritySource`/entity field types - row 47) and 8 in `src/db/fixtures/operations.ts`
  (the 14-kind fixture maps - row 49). Both files are outside this row's allowed file set
  ("touch only the schema/value-set source files named above"), so root `typecheck` stays red until 47 and
  49 land. Recommended: commit 45 with 47 and 49 (dbc-3 §G MT-8 already asks for value-sets and the shared
  constant in one commit). Option 2 (a 3-line `packages/shared` enum extension here) removes 10 of 14
  errors, still not green, and duplicates row 47 - not recommended.
* **D-a: inventory-pin mechanism.** `test/db/contract-inventory.ts:26-30` parses the **v1** contract
  (`docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md`) as the expected
  inventory. Refreshing it for v2 means amending a closed task's contract doc or re-pointing the parser at
  dbc-3 (different table shapes). Controller decision; 6 unit tests wait on it.
* **D-b: enum order.** Row 47 must append `MIC_SILENT`, `CAPTURE_FAULT` to `FaultKind` in that order so
  CL-12 compares two equal ordered lists.
* Also for row 48: `src/core/__tests__/writers.test.ts:159` pins `toHaveLength(17)` and
  `src/core/payload-rules.ts:11` says "the 17 key names" - both need 25 (`M2-AUD-1`).
* Deliberate non-change recorded for row 46: `meta.ts:16`/`:18` stay `1` / `'dbc-2'` in this commit; bumping
  them without a migration would break boot check B-3 against the still-unmigrated `dems_demo` and lanes.
* `stt_config` (dbc-3 §B.13) was **not** authored: proposed, pending Q-STT-CFG; the count stays 39 tables.

## Files

Created: `implementation/10_m2_schema_check.md`, this note.
Source: new `apps/core-server/src/db/schema/{capture,recording,transcript}.ts`; modified
`{value-sets,checks,evidence,sessions,index}.ts` (same folder only; `git status --porcelain -- apps packages`
lists nothing else).
