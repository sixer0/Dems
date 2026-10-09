---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: database-specialist
blueprint_row: 129a (controller-added, D99)
source_plan: masterplan/04_database_contract.md section N.7, erratum PE-129a-01; finding F-84-1 (implementation/39_m7_encryption.md)
tier: 3
status: needs-review
---

# Row 129a - migration set 5 (`0010`), schema version 4 / `dbc-5`: the runtime role can replace a stored camera credential

Status `needs-review` only for the three points of section 6; every check passes. No commit, no
lockfile write, 0 edits to `0000`-`0009`, no reseed, no reset, no Core started, `.data/pg*.env`
not read, `dems_admin` not used.

## 1. The choice

**Column grant, not a definer function.** `GRANT SELECT (device_id) ON capture_device_credentials
TO dems_app`. The contract's privilege model (dbc-3 B.3 / D) expresses writes as grants and keeps
one `SECURITY DEFINER` function per store, for the read. A definer write function would write with
owner rights past the six-column UPDATE list, would need its own EXECUTE narrowing and static rule,
and would hide nothing more: `dems_app` already holds EXECUTE on the reveal function, and what the
grant opens - which device ids have a row, and their count - is the `credentialSet` fact of the
API. The six other columns stay `42501` in every statement form (section 3, M4A-4).

**Version: stepped to `(4, 'dbc-5')`.** MG-5 (dbc-2 8.1): the last file of every set sets the
version, +1 after the first. The `0007` exception (re-affirming the same pair) is tied by N.9 /
D-DB-17 to "before any reader existed"; here the reader exists (the store of row 84, the rotation
of row 142), and without a step the replacing code would pass B-3 on a database without the grant
and fail `42501` at the first rotation.

**`stt_config`: no treatment needed.** Its write is `UPDATE ... WHERE singleton AND revision = $n`
and `0007` granted SELECT on both columns. Measured without `0010`: two secret writes in a row as
`dems_app`, the second replaces the first, the three hidden columns stay `42501` (M4A-7).

**Finding F-129a-1 (corrects the statement F-84-1 proposed).** With the grant,
`INSERT ... ON CONFLICT (device_id) DO UPDATE SET username = EXCLUDED.username, ...` is **still
refused `42501`**: PostgreSQL asks for SELECT on the target column behind every `EXCLUDED`
reference. What works: `UPDATE ... SET username = $2, ... WHERE device_id = $1`, and the one-statement
upsert with bind parameters in SET (`... DO UPDATE SET username = $2, secret_ciphertext = $3, nonce
= $4, key_ref = $5, rotated_at = $6`), by column and by constraint name. Rows 142 / 66 must send
that form.

## 2. What was written

| Item | Where |
|---|---|
| `0010_credential_replace_privileges.sql` (hand-written, `generate --custom`): GRANT of one column, boundary REVOKE of the other six (no-op, `0007` precedent), version row. sha256 `f06d2c29...93d6fb` | `apps/core-server/src/db/migrations/` + `meta/0010_snapshot.json`, journal idx 10 |
| Drift proof | `db:generate` prints `No schema changes, nothing to migrate` |
| Constants `4` / `dbc-5`; eleven tags | `src/db/schema/meta.ts`, `src/db/commands/migrations.ts`, comment in `src/db/schema/index.ts` |
| New test file, 15 cases (M4A-1..8) | `apps/core-server/test/db/set5.db.test.ts` |
| Pins moved (by delta) | `test/db/boot-checks.db.test.ts`, `migrate.db.test.ts`, `commands.db.test.ts`, `set4.db.test.ts`, `contract-inventory.test.ts` (11 files, 7 hand-written), `privileges.db.test.ts` (matrix `selectColumns: ['device_id']` + a new catalog/live case: SELECT per column over all 426 columns, exactly 9 unreadable); `src/db/seed/__tests__/seed.db.test.ts`, `src/db/reset/__tests__/{m4-sec-reset,reset-failures}.db.test.ts`, `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` |
| Row 84's test | `src/modules/stt-config/__tests__/credential-store.db.test.ts`: the assertion is now `['answered', '42501', '42501']` (UPDATE-where works; the two EXCLUDED upserts stay refused), the REPLACE case runs as the runtime role (second write replaces the first, one row, secret SELECT and `RETURNING secret_ciphertext` `42501`). **One more line had to move there**: `SELECT count(*)` left the 42501 list (it answers now) and three column probes joined it |
| Contract | `masterplan/04_database_contract.md` section N.7, paragraph **PE-129a-01** |

## 3. Checks (throw-away databases, under `lockf -k .locks/db-migrate.lock`)

| Check | Result | Negative control |
|---|---|---|
| M4A-1 defect on a real `(3,'dbc-4')` database | first INSERT ok; UPDATE-where and three upsert forms `42501` | - (it is the control of M4A-3) |
| M4A-2 apply | applies exactly `0010`; `(4,'dbc-5')`; ledger 11; object count and stored rows identical; second run applies nothing | - |
| M4A-3 replace as `dems_app` | UPDATE-where, upsert by column and by constraint replace the row (owner reads the new values, the other camera untouched); CHECK still binds (32-byte ciphertext `23514`) | M4A-1; EXCLUDED form `42501` |
| M4A-4 secret unreadable | 6 column SELECTs + 14 statement forms (`*`, whole-row, WHERE / ORDER BY on a hidden column, `RETURNING`, `SET x = x`, INSERT..SELECT, conflict WHERE, COPY, DELETE, TRUNCATE) all `42501` | M4A-5: after a planted `GRANT SELECT ON ALL TABLES` both secret columns answer |
| M4A-6 B-3 | code `(3,'dbc-4')` refused on the migrated database; this code refused on `(3,'dbc-4')` naming `db:migrate`; this code passes on `(4,'dbc-5')` | both directions |
| M4A-7 `stt_config` | section 1 | `RETURNING secret_ciphertext` `42501` |
| M4A-8 file | three statements, no blanket form; `0008` / `0009` hash to the values the live ledgers store | - |

Runs: `test/db` + `src/db` + the credential-store file, db project: **25 files, 560 passed, 0
failed**; the four central files a second time: green. Unit `src/db test/db test/static`: 772
passed, 6 failed, none mine - `test/static/credentials.test.ts` (`src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:175`),
`imports.test.ts` (`src/modules/capture-config/{index,plan,routes}.ts`, `src/transcription`),
`network.test.ts` (`src/capture/adapters/camera/ws-discovery.ts:35`). Typecheck: 0 errors in my
paths; 2 in `src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts` (earlier in the session
1 in `src/sealing/__tests__/support.ts`). Lint: 0 findings in my paths. The whole db project was
not run.

## 4. The four development databases

Pre-flight: `pg:status: OK, running` (PID 32505, HA-1..4 PASS); nothing listening on 4420-4423.
Per database: `db:status` / `db:migrate` under the lock / `db:status` / `db:migrate` again.

| Database | Before | After | Run 1 | Run 2 | Files applied before / after | Row counts |
|---|---|---|---|---|---|---|
| `dems_lane_1` | 3 (dbc-4) | 4 (dbc-5) | applied `0010` | nothing | 10 / 11, ledger matches | unchanged |
| `dems_lane_2` | 3 (dbc-4) | 4 (dbc-5) | applied `0010` | nothing | 10 / 11, ledger matches | unchanged |
| `dems_lane_3` | 3 (dbc-4) | 4 (dbc-5) | applied `0010` | nothing | 10 / 11, ledger matches | unchanged |
| `dems_demo` | 3 (dbc-4) | 4 (dbc-5) | applied `0010` | nothing | 10 / 11, ledger matches | unchanged |

"Unchanged" = `diff` of the full `db:status` output before vs after with the migration lines
removed: the only differing lines are the schema-version line and the closing `db:status:` lines.
All 41 row-count lines, `seeded_at`, the audit head and the lineage line are identical
(`capture_devices 5`, `evidence_items 13`, `capture_device_credentials 0` on all four;
`paired_devices` 1 / 1 / 1 / 5). After: `pg:status: OK, running`; nothing on 4420-4423. Raw
outputs: session scratchpad `row129a/`.

## 5. Not proven here

- Operations 89 / 96 themselves (rows 142, 66): the statements are run as `dems_app`, not through a route.
- "Old code refused" is the B-3 function called with the old pair, not a booted older build.

## 6. For the controller

1. **Two red tests until one line each moves** (row 78's files, not edited; request filed in
   `file_requests.md` 09:52:07Z): `modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts:66`
   and `modules/transcripts/__tests__/transcripts.db.test.ts:166`, `[3, 'dbc-4']` -> `[4, 'dbc-5']`.
2. **F-129a-1**: the store of rows 142 / 66 must use bind parameters in SET, never `EXCLUDED`.
3. **Row 84's file**: besides the assertion named in the brief, the `count(*)` line moved (section 2).
   A Core built from code older than this row is now refused by B-3 on all four databases.

---
*Generated: 2026-10-09*
