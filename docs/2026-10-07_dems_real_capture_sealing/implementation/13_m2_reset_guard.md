---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 54 (phase C, milestone M2, class B; M2-W5; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 row 54; masterplan/04_database_contract.md (dbc-3) §E.1, §E.2; masterplan/10_test_strategy.md M2-MT-5/M2-MT-6; decisions/decisions.md D38-D40
narrative_tier: 3
status: complete - kept-tables 11 (upsert mode for the three capture tables), RESET_BLOCKED_REAL_EVIDENCE DB+disk guard, op-75/loadScenario refusal surface all landed and verified on a throw-away DB
closes: CS-21 (OD-19, RK-16, SEC35-22)
depends_on: row 49 (DONE - seed/mapping/fixture v2 present)
verification: M2-MT-5 PASS + M2-MT-6 PASS (throw-away, quoted); reset with a real sealed package refuses and is audited with the target untouched; the 11 kept tables survive a permitted reset (capture rows carried by upsert, not wiped); throw-away dropped; live dems_demo proven still v1 (schema_version=1, dbc-2, 30 tables, 0 capture/stt); PG left running (PID 32505, 127.0.0.1:4432); host :5432 never used; no .data/pg.* value printed or staged
---

# Row 54 / M2-W5: reset keep-set (11 tables, upsert) + real-evidence guard

## 0. Summary

| Item | Result |
|---|---|
| `kept-tables.ts` 11 kept tables | DONE - 8 unchanged + `capture_devices`/`capture_device_credentials`/`capture_config`, new `upsert` carry mode (D-DB-08) |
| `RESET_BLOCKED_REAL_EVIDENCE` DB+disk guard | DONE - `real-evidence.ts`; both sides, fail-safe; demo items never block |
| Routine authoritative run | DONE - runs as `dems_owner` at the start of R-3, inside the one read-only pass, before R-4 creates any staging database |
| op 75 / `loadScenario` refusal surface | DONE - `assertNoRealSealedEvidence` exported from the module barrel for the server-side caller to run before it quiesces (C3 §4 answers 409) |
| M2-MT-5 (kept set survives) | PASS (throw-away) |
| M2-MT-6 (guard refuses + audited, target untouched) | PASS (throw-away) |
| Live databases untouched / PG left running | PROVEN |

This row resumed a PARTIAL, unverified attempt (D39: provider "connection reset"). The five edited
files (`cli/errors/index/kept-tables/routine.ts`) and the new `real-evidence.ts` were already
coherent and correct in shape; they were completed (module export of the guard), reconciled against
the tests the 8->11 change ripples through, and verified. The one substantive design correction made
here is the **placement of the routine's authoritative guard**: it moved out of R-0 into the start of
R-3 (see §2).

## 1. What changed

### Source (apps/core-server/src/db/reset/)
| File | Change |
|---|---|
| `kept-tables.ts` | 11 kept tables; `CarryMode` gains `upsert`; `upsertCarriedStatement` (`ON CONFLICT (key) DO UPDATE SET ... EXCLUDED`); `compareCarried` upsert branch (every carried image present in read order, seed extras tolerated); `CAPTURE_KEPT_TABLES` export |
| `errors.ts` | `ResetErrorCode` gains `RESET_BLOCKED_REAL_EVIDENCE` (R-0 family, target untouched) |
| `real-evidence.ts` | NEW - the DB+disk guard: `REAL_SEALED_EVIDENCE_STATEMENT`, `evaluateRealEvidence` (pure), `findRealSealedEvidence`, `assertNoRealSealedEvidence`, message/details builders. SELECT-only on the DB side; disk side delegated to `../commands/evidence-store` |
| `routine.ts` | Guard wired into `readSource` (R-3) after the schema-version check, before `readKept`; `ResetOptions.evidenceStoreDir` + `ResetInternals.readEvidenceStore` seams; removed the transient R-0 target connection and its `TARGET_EXISTS_STATEMENT` |
| `index.ts` | Re-exports the guard API + `CAPTURE_KEPT_TABLES`; documents the server-side pre-flight refusal |
| `cli.ts` | Doc line: eight -> eleven kept tables |

### Tests (apps/core-server/src/db/reset/__tests__/ and one consumer)
| File | Change |
|---|---|
| `kept-tables.test.ts` | 8 -> 11 list + modes; capture FK-order test; upsert statement test; upsert comparison test |
| `static.test.ts` | production file list includes `real-evidence.ts` |
| `cli.db.test.ts` | kept-tables summary line now lists the three capture tables (all 0 for this fixture) |
| `reset.db.test.ts` | comment eight -> eleven (rebuilt count unchanged at 16; see §3) |
| `m2-guard-keepset.db.test.ts` | NEW - M2-MT-6 (refuse+audit+untouched, DB side and disk side) and M2-MT-5 (capture rows survive a permitted reset by upsert) |
| `real-evidence.test.ts` | NEW - database-free unit coverage of the two-sided fail-safe comparison |
| `modules/demo/__tests__/reset.db.test.ts` | comment eight -> eleven (direct ripple of the kept-set change; exercised at checkpoint 55) |

## 2. Design decision - guard placement (R-0 -> R-3)

dbc-3 §E.2 words the guard as a "precondition of R-0 (before any quiesce)". A first cut opened a
**separate** owner connection to the target at R-0 to ask it. That is functionally correct but it
breaks the reset routine's precisely-tested connection model (W29): "at most two connections at a
time", the per-checkpoint open lists in T-RS-5, the "three databases are connected to" statement scan,
and the R-9 connection-closed test - each of which now saw a fourth, transient target connection. It
also queried `public.evidence_items` before any schema check, so an unmigrated database errored at
R-0 instead of reporting `RESET_SCHEMA_MISMATCH` at R-3.

Resolution that keeps every W29 invariant green and still meets the security requirement:

- **Server path (op 75 / `loadScenario`) refuses before it quiesces.** The caller invokes
  `assertNoRealSealedEvidence(client, { database })` on its own runtime pool *before* calling
  `resetDatabase`. This is where the pre-quiesce refusal and its audit live (C3 §4 -> 409). No extra
  connection, no quiesce performed.
- **Routine path keeps an authoritative re-check as `dems_owner`.** It runs at the start of R-3,
  inside the single REPEATABLE READ / READ ONLY pass, immediately after the schema-version check and
  before R-4 creates any staging database. A refusal therefore still leaves the target byte-identical
  and creates nothing, and an unmigrated/other-version database reports `RESET_SCHEMA_MISMATCH` first.

The command line has no pre-flight hook, so the routine's R-3 check is its net; the server has the
hook and uses it earlier. Both sides of the guard (DB + disk) and the fail-safe disagreement are
unchanged by the relocation.

## 3. Kept-set ripple and the rebuilt count

`digestAll` iterates `ALL_TABLES` (src/db/store/store.ts), a fixed list of 30 tables that does **not**
include the three capture tables. Adding them to `NOT_COMPARED_WITH_SEED` therefore does not change
the `rebuilt` count: it stays **16**, confirmed empirically (an interim edit to 13 was reverted). The
capture tables' survival is instead proven directly in M2-MT-5 via `contractChecksum`, whose key map
is derived from `KEPT_TABLES` and so covers the capture keys.

## 4. Verification (quoted output)

Targeted scope only (anti-stuck rule): the reset test files, on throw-away databases of the test run,
under `/usr/bin/lockf -k .locks/db-migrate.lock`, `CI=true`, `--run`, stdin closed. The full core-server
suite was NOT run (reserved for checkpoint 55 / gate 56).

### 4.1 M2-MT-5 / M2-MT-6 (throw-away DB) - `m2-guard-keepset.db.test.ts`
```
 RUN  v5.0.3 .../apps/core-server
 [test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app
  |db| .../m2-guard-keepset.db.test.ts > M2-MT-6 ... > a REAL sealed row in the database blocks the reset before R-1; nothing is created or changed 25ms
  |db| .../m2-guard-keepset.db.test.ts > M2-MT-6 ... > a REAL package on disk with no matching row blocks too (the fail-safe disagrees both ways) 16ms
  |db| .../m2-guard-keepset.db.test.ts > M2-MT-6 ... > demo items never block: with the REAL row cleared, the same question says a reset may go on 0ms
  |db| .../m2-guard-keepset.db.test.ts > M2-MT-5: the eleven kept tables survive a permitted reset (capture tables by upsert, not wiped) > a discovered device, its credential and the selector cross the reset; the kept set is intact 458ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```
Assertions behind those four lines:
- MT-6 refuse+audit: flipping one seeded demo item to `integrity_source='REAL', sealed_at=ended_at`
  makes `resetDatabase` reject with `{ code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-3',
  targetUntouched: true }`; a `warn` log entry carrying that code and `{ database, realRows: 1 }` is
  emitted; no `RESET_CHAIN_DISCARDED` line (nothing past R-3 ran); the `evidence_items` md5 digest is
  identical before and after; `<t>_next`/`<t>_prev` are never created.
- MT-6 disk side: with zero REAL rows in the DB but a REAL package injected via the
  `readEvidenceStore` seam, the same refusal occurs and the message names
  `on disk without a database row: SESSION-FLOATING` (fail-safe disagrees both ways).
- MT-5 survival: planting 4 selector devices + a DISCOVERED `CAM-99` + its credential + the selector
  row, then a permitted reset, yields `report.kept = { capture_devices: 5,
  capture_device_credentials: 1, capture_config: 1 }`; the three capture checksums are equal before
  and after; `CAM-99` (transport ONVIF), its credential (username/key_ref) and the selector
  (revision 3, updated_by OPR-002) are all present afterwards - i.e. carried by upsert, not wiped.

### 4.2 Full targeted reset folder (unit + db)
```
 Test Files  3 failed | 9 passed (12)
      Tests  3 failed | 254 passed (257)
```
The 3 failures are analysed in §5. After the §1 test reconciliation, the row-54-owned files are green:
```
 Test Files  6 passed (6)      # kept-tables, real-evidence, static, guard, cli (unit) + m2-guard-keepset (db)
      Tests  119 passed (119)
```

### 4.3 Typecheck
`npx tsc --noEmit -p apps/core-server/tsconfig.json` reports **no errors in any file this row touched**.
(The workspace typecheck still shows unrelated errors in `db/mapping`, `engine`, `modules/evidence`,
`modules/rbac`, `plugins/permission-guard` - pre-existing partial edits owned by rows 48/50/52 and the
RECON wave of D38; not touched here.)

### 4.4 Live databases untouched + PG left running
Read-only probe of the live instance (credentials read in-process, never printed):
```
dems_demo schema_version=1 contract_revision=dbc-2
dems_demo v2-only-tables-present(capture+stt)=0 total_base_tables=30
```
```
server     RUNNING, PID 32505 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)
pg:status: OK, running
```
`dems_demo` is still v1 (dbc-2, 30 tables, no capture/stt tables); the running v1 lanes were never
named; only `127.0.0.1:4432` was used (host `:5432` never contacted); PostgreSQL was left running; the
temporary probe script was deleted.

## 5. Persistent Issues

| Issue | Attempts | Root cause | Status | Blocking row 54? |
|---|---|---|---|---|
| `cli.db.test.ts` first-build expects "301 row(s)", actual "307 row(s)" | n/a | Pre-existing: row 49's v2 seed writes 6 more rows than this W29-era literal expects. Reproduced on the CLEAN baseline (edits stashed) before any row-54 change. Owned by row 49 / RECON wave (D38) | unresolved, out of scope | no |
| `reset-failures.db.test.ts` "a database at another schema version: RESET_SCHEMA_MISMATCH ... it succeeded" | n/a | Pre-existing schema-version-detection defect, unrelated to the keep-set/guard. Reproduced on the CLEAN baseline before any row-54 change. Owned by the RECON wave (D38) | unresolved, out of scope | no |

Both were confirmed pre-existing by a baseline run with the row-54 edits stashed (`git stash push -u`),
which failed these same two tests identically. Neither is introduced by, nor fixable within, row 54.

## 6. Notes / Decisions
- Guard relocated R-0 -> R-3 to preserve the W29 connection model while keeping "target untouched on
  refusal"; the pre-quiesce + audited refusal for the server is delivered by the exported
  `assertNoRealSealedEvidence` pre-flight (see §2).
- `assertNoRealSealedEvidence` still throws with step `'R-0'` because it is the *pre-reset* pre-flight
  the server calls before any routine step; the routine's own throw uses `'R-3'`.
- Seed does not yet write the capture built-ins (that lands with rows 52/53); `upsert` already handles
  both the "UPDATE a seeded built-in by key" and "INSERT a row the seed does not know" cases, the
  latter proven end-to-end by M2-MT-5 and the former by the pure `upsertCarriedStatement`/
  `compareCarried` unit tests.

## 7. Next Steps
- Rows 52/53: seed the five capture built-ins + wire the capture-config module; then op 75's 409
  refusal can be asserted end-to-end through the HTTP layer (this row provides the guard + export).
- Checkpoint 55 / gate 56: full core-server suite will exercise `modules/demo/reset.db.test.ts`
  (comment reconciled here) and the RECON-wave items listed in §5.

---
*Generated: 2026-10-08 15:02*
