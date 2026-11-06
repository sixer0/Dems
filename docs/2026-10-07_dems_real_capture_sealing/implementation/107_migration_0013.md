---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: migration 0013 - schema version 6 / `dbc-7` (controller rulings D146, D162, D166, D167)
date: 2026-10-10
agent: database-specialist (single migration writer; rules D94 / D122 / D163, ownership D95)
source_plan: masterplan/04_database_contract.md section N.18, erratum PE-0013-01; requests of passes D1b, D6, D11
narrative_tier: 3
status: needs-review - the migration, the pins and the three consumers are done and proven; three db reds and one unit red remain, none from this change (section 5); five decisions for the controller (section 6)
---

# 107 - Migration set 7 (`0013` + `0014`): key-id form, fault reason, media store root

No commit. No lockfile write. `0000`-`0012` not edited. Only throw-away databases of the test
support were created, migrated or reset; `dems_demo` and the lanes were not touched, `.data/pg*.env`
was not read, `dems_admin` was not used, no local device was selected. `C` = `apps/core-server/`,
`S` = `packages/shared/`.

## 1. The migration

"Migration 0013" is a SET OF TWO FILES (MG-2 / MG-5 / MG-6, the `0008` + `0009` precedent of N.8):

| File | Kind | Content | sha256 |
|---|---|---|---|
| `C/src/db/migrations/0013_key_id_fault_reason_media_root.sql` | generated (`db:generate --name=key_id_fault_reason_media_root`) | CREATE TABLE `core_media_store`; ADD COLUMN `alerts.reason`; ADD `alerts_reason_check`; DROP + ADD `transcript_revisions_key_id_check`. No statement writes a row | `96232829...65a544a3` |
| `C/src/db/migrations/0014_key_id_fault_reason_media_root_privileges.sql` | hand-written (`--custom`) | GRANT SELECT, INSERT + UPDATE (`media_root`, `recorded_at`) on `core_media_store`; boundary REVOKE DELETE, TRUNCATE; boundary REVOKE UPDATE (`reason`) on `alerts`; the version row `(6, 'dbc-7')` | `86aab8c0...9b99fd77c7` |

Journal idx 13, 14; snapshots `meta/0013_snapshot.json`, `0014_snapshot.json`. Drift proof after
the last edit: `db:generate` prints `No schema changes, nothing to migrate`.

| Part | What | Typed schema |
|---|---|---|
| (a) | `transcript_revisions.signature_key_id`: `CODE` -> key-id form `^[A-Z0-9][A-Z0-9_-]{0,63}$` (new helper `keyId`). A superset of `CODE` and of the signer's rule `^[A-Z0-9][A-Z0-9-]{2,62}$`: every stored revision stays valid, the CHECK validates without a rewrite | `C/src/db/schema/checks.ts`, `transcript.ts` |
| (a) other key-id columns | `evidence_items.signature_key_id` has NO rule (NOT NULL only) and always took the product key: unchanged. No other column holds a key id (`key_ref` of the credential tables is another vocabulary). Nothing narrower existed, so nothing else was widened | - |
| (b) | `alerts.reason text NULL`, declared last; `alerts_reason_check` (NULL or `CODE`); no UPDATE grant. The active fault itself is `hardware_snapshot.faults` (jsonb): its entry gains the optional member `reason`, no DDL. **No unique index** - see D-0013-2 | `C/src/db/schema/core.ts` |
| (c) | NEW table T-43 `core_media_store` (`singleton` PK, `media_root`, `recorded_at`), CHECK: 1..1,024 characters, starts with `/`, no control character, no `://`. KEPT across a reset (thirteenth kept table, mode `upsert`). The contract has no general kept settings table - `console_settings` is the engine's typed row of slice `settings` - so a table of its own (D-0013-3) | `core.ts`; `C/src/db/reset/kept-tables.ts` |

Totals: 43 tables (+1), 440 columns (+4), 182 CHECKs (+3), 43 primary keys, 85 index relations,
INSERT for `dems_app` on 27 tables, 13 kept tables, 15 files / 9 hand-written. Contract: new section
**N.18, erratum PE-0013-01** in `masterplan/04_database_contract.md` (an addition; nothing rewritten;
the two strings `contract-inventory.test.ts` pins are byte-identical).

## 2. Consumers

**1 - operation 85 with the PRODUCT signer.** No product line needed to change: the route already
stored `signer.signer.keyId`. `C/src/modules/transcripts/routes.ts`: comments only; the named
refusal `SIGNING_KEY_ID_NOT_STORABLE` stays as the answer of a rule that should ever disagree with
the signer again - no key the signer loads reaches it (its rule is a subset of the table's).
`provideRevisionSigner` is kept. Proof, `transcript-routes.db.test.ts` last block (was the
"FINDING" block holding the 503): the key the product loads (`CORE-KEY-EVSIGN-01`) -> 201 -> one row
with that id, a real Ed25519 signature bound to the key's certificate -> the package record holds
the same id, and so does the item row -> **verify V-11 PASS**, every other check too; sealed files
byte-equal; a second revision continues the chain. Control: the verifier expecting no revision
refuses the same package.

**2 - the fault key (kind, reason, device).**

| Layer | Change |
|---|---|
| Shared model | `S/src/sim/types.ts` (`FaultsSlice` entry `reason?`), `derive.ts` (`isFaultActive(…, reason?)`), `faults.ts` (`raiseFaultAtKey` keys by the reason, `clearFaultAtKey(…, reason?)`, `resolveAlerts` by the alert's `params.reason`, `FAULT_CLEARED` details carry it), `capture-telemetry.ts` (the reason travels for a fault ABOUT a device too; `evidenceFiles` stays for the capture as a whole; a clear names its reason) |
| Slice schema | `S/src/api/state-slices.ts` `FaultsSliceSchema`: optional `reason` in the code form. OpenAPI regenerated under `npm.lock`: 5 lines, 97 operations / offline 31 unchanged |
| Mapping | `C/src/db/mapping/rows.ts`: `alertReasonOf` (column = `params.reason` when it is a code), `alertToRow`, `alertFromRow` (a row whose column and `params` differ is refused `ROW_SHAPE`; a row older than 0013 - NULL - reads back as it was). The planner already refuses a changed non-life-cycle column |
| Engine | `C/src/engine/write-plan.ts` `sameFault` compares the reason (one health-snapshot row per raised fault) |
| Forwarder | `C/src/capture/forwarder.ts`: ONE ENGINE FAULT PER (code, device, reason) - was one per (code, device) with a set of reasons. Raised with the worker's reason, cleared (after the hold) under the same reason |

Rule for a fault WITHOUT a device (the capture as a whole): one at a time; its cause is a fact of the
alert and audit row, not a key (D-0013-1). Found by `capture-session-parity.test.ts`: with a strict
key the forwarder's raise and the failed start's raise - two tellers of one event that name
different codes - became two alerts and two `FAULT_RAISED` rows.

Proofs: `S/test/sim-fault-key.test.ts` (NEW, 8 cases: two causes on one camera = two entries /
alerts / audit rows; clear of one; clear without a cause; one microphone with silent + disconnected
+ a second cause + the rate advice = four alerts; the whole-capture rule both ways; a fault without
a cause as before); `C/src/capture/__tests__/forwarder.test.ts` + `forwarder-engine.test.ts` (from
worker frames through the supervisor and the forwarder into a real simulator);
`C/src/db/mapping/__tests__/to-rows.test.ts` (+1 case) and NEW `fault-key.db.test.ts` (raise ->
rows with the cause in its column and in the stored snapshot -> the column cannot be updated,
`42501`, control on the life-cycle columns -> **restart** reads faults and alerts back equal -> a
clear of one cause resolves that row alone -> a pre-0013 row reads back as the alert it was).

**3 - the reset and the media store root.**

| Piece | Where |
|---|---|
| Statements and helpers (no connection, no clock) | NEW `C/src/db/commands/media-store-root.ts`: `recordMediaStoreRoot`, `readMediaStoreRoot`, `storableMediaStoreRoot` |
| Boot step `db.mediaStoreRoot` | `C/src/plugins/db/index.ts`, added in `onReady` so it runs after every registered step (B-3, the engine): as `dems_app`, `INSERT … ON CONFLICT DO UPDATE … WHERE the root differs`. A start with the same root writes nothing (AC-B-04: a restart moves no stored row). A root that cannot be stored STOPS the start (`MEDIA_STORE_ROOT_NOT_RECORDED`). The log line states the fact, not the path (no server line names a directory below the data directory; pinned by `demo/gate.db.test.ts`) |
| Routine | `C/src/db/reset/routine.ts`: new option `resolveEvidenceStoreDir(stored)`, called at R-3 inside the read-only pass, after the schema-version check; `errors.ts`: `RESET_STORE_ROOT_UNKNOWN`, `RESET_STORE_ROOT_CONFLICT` |
| Command line | `C/src/db/reset/cli.ts` `resetStoreRootOf`: `DEMS_MEDIA_DIR` of the command, else the stored root; PRINTS `media store root the real-evidence guard judges: <root> (<source>)` before the guard reads it; neither -> `RESET_STORE_ROOT_UNKNOWN`; both and different -> `RESET_STORE_ROOT_CONFLICT`; exit 1, "the database is unchanged". The default-folder fallback is gone. A first build (no database yet) asks for no root |
| Server | unchanged: `app.config.mediaStoreDir` (D165) |

Proof, NEW `C/src/db/reset/__tests__/store-root.db.test.ts` (10 cases): A the boot writes the root
as `dems_app` after B-9 and the engine; same root again = the row byte-equal; another root replaces
it, normalised; a missing grant stops the start at that step. B the command WITHOUT the variable
prints the stored root, finds a SIGNED PRODUCTION package there (root outside the data directory, no
row in the tables) and blocks - control: the folder it judged before does not hold the package.
C neither source / conflict / relative variable: refused, target OID unchanged. D **the removal of
a permitted reset below a configured root**: an exempt development item with its signed package
under that root is removed; a live-session folder and a file beside it, and the same package folder
in ANOTHER root, stay file for file; the stored root crosses the reset (`core_media_store 1` among
the kept counts); control: with a production package beside it the reset is refused and removes
nothing.

## 3. Pins moved

Version `[5, 'dbc-6']` -> `[6, 'dbc-7']`, 42 -> 43 tables, 436 -> 440 columns, 179 -> 182 CHECKs,
13 -> 15 files, 12 -> 13 kept tables, 26 -> 27 insertable tables, 84 -> 85 index relations - each by
delta.

| Area | Files |
|---|---|
| Constants | `C/src/db/schema/meta.ts`, `schema/index.ts` (header), `commands/migrations.ts` (15 tags), `store/store.ts` (`ALL_TABLES`), `fixtures/minimums.ts` (43 entries), `fixtures/validate.ts` (the two rules) |
| `C/test/db` | `boot-checks.db`, `migrate.db`, `commands.db`, `commands`, `catalog.db`, `constraints.db` (+3 refused rows, +6 valid rows), `privileges.db` (matrix row), `set4.db`, `set5.db`, `set6.db` (its set now stops at `0012`: a genuine `(5, 'dbc-6')` database), `contract-inventory.test`, `contract-inventory.ts` + NEW `contract-v6-delta.ts` + regenerated `contract-inventory.json`, `fixtures.ts` (`mediaStore`), `integration-d4.db`; `C/test/support/seed.ts` |
| `C/src/db` tests | `seed/__tests__/{seed.db,cli,cli.db}`, `reset/__tests__/{m4-sec-reset.db,reset-failures.db,cli.db,kept-tables,m2-sttcfg-seed-kept.db}`, `fixtures/__tests__/{build,support,bulk-fixture.db}` |
| One-line pins in other rows' files (exact-string, nothing else touched) | `capture/fence/__tests__/{fence.db,development-session.db}`, `plugins/permission-guard/__tests__/session-holder.db`, `capture-session/__tests__/session-capture.db`, `transcription/__tests__/snapshot-store.db`, `sealing/__tests__/{stt-states.db,last-resort.db}`, `modules/transcripts/__tests__/transcripts.db`, `modules/transcript-chunks/__tests__/transcript-chunks.db`, `modules/capture-discovery/__tests__/{session-expiry.db,capture-discovery.db}`, `modules/capture-discovery/connect/__tests__/connect.db` (+ 42 -> 43), `modules/storage/__tests__/volume-at-boot.db`, `modules/capture-config/__tests__/{integration-d1b.db,integration-c1.db}`, `modules/sessions/__tests__/audio-intervals.db`, `engine/__tests__/{fact-doors.db,recording.db}` |
| Behaviour pins that follow the fault key | `capture/__tests__/{forwarder,forwarder-engine,fault-lifecycle}.test.ts`, `S/test/sim-core-facts.test.ts` (one case) |
| Generated | `S/openapi/openapi.json` |

No pin of the version or the table count exists outside `apps/core-server` (grep of the repository:
web, mobile, shared and scripts hold none; docs state it as history only).

## 4. Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| Up from an empty database (`migrate.db`, `catalog.db`, `privileges.db`, `constraints.db`) | green: the live catalog equals the composed inventory, the grant matrix holds on 43 tables / 440 columns |
| Up from version 5 WITH rows (`set7.db.test.ts`, 41 cases, M7S-1..8) | green on the first run: exactly `0013`, `0014`; `(6, 'dbc-7')`; +2 catalog objects; digests of sessions, items, transcripts, revisions, alerts (without the new column) and devices identical before / after; all five alerts read `reason` NULL; the re-added CHECK is validated; a second run applies nothing; negative control without `0014`; B-3 both ways |
| Generated-file rules | green: `contract-inventory.test.ts` (set, hand-written files, ASCII), M7S-8 (no data statement, no hand line in `0013`; five statements in `0014`, no blanket form; `0011` / `0012` hash to the values the development ledgers hold) |
| `test/db` folder | 15 files, 453 tests: 3 red at first (2 my pins, fixed and re-run green; 1 foreign) |
| Whole db project, once (`lockf` + `--project db --maxWorkers=2`) | 171 files (3 skipped), 2,335 tests: 2,311 passed, 19 failed, 5 skipped. 17 were mine - 15 in `test/acceptance/restart.test.ts` (the boot step rewrote `recorded_at` at every start, so the table "moved"), 1 `bulk-fixture.db` (report line count), 1 `demo/gate.db` (the boot line named a path below the data directory) - fixed, and those files plus `store-root.db` and `set7.db` re-run: 5 files, 103 tests, 102 passed. **Left red: 3, none mine (section 5)** |
| Whole unit project, once (`--project unit --maxWorkers=4`) | 273 files, 5,904 tests: 8 failed. 7 from this change (1 static rule on a fixture string, 5 parity cases, 1 lifecycle case) - fixed, the affected folders re-run: 142 files, 3,067 tests, 1 red. **Left red: 1, not mine** |
| Shared suite | 92 files, 2,395 tests, green (2 OpenAPI drift reds at first; regenerated, re-run green) |
| Typecheck + lint, core-server and shared | 0 errors, lint exit 0 |

The whole db project was NOT run again after the two last edits (write only when the root differs;
the boot line without the path): the five affected files were. One whole-suite run by the test
runner is the controller's planned next step (D164).

## 5. Reds that are not this change's

| Test | What | Whose |
|---|---|---|
| db `test/db/device-upsert.db.test.ts` "the same for a LOCAL_DEVICE row and for a seeded built-in" | expects 1 change for two devices; the planner writes one UPDATE per device since pass D4 (`db/mapping/changes.ts`, uncommitted) | pass D4 / pass D1b's test |
| db `modules/capture-config/__tests__/integration-d1b.db.test.ts` "REAL_DEVELOPMENT: MIC-03 …" | stored slices vs committed state: the built-ins carry `adapter: FAKE` / `sourceClass: DEVELOPMENT` in the state and not in the tables | pass D11 item 1 (announced in its note, section 5) |
| db `test/acceptance/restart.test.ts` "two restarts with a command between them" (bulk fixture) | 60 error lines `the revision head of an item was not published at the start` - the fixture's revisions have no package on disk | pass D11 item 2 (`transcripts.heads` boot step) |
| unit `capture/adapters/__tests__/static.test.ts` A-5 | `src/capture/index.ts:44` and `src/sealing-host/index.ts:41` import the adapter layer | held since row 65 (D95 section 7) |

`demo/reset.db` did NOT show `RESET_BLOCKED_REAL_EVIDENCE` in this combined run. The sealing
kill-matrix / e2e files were skipped as configured.
Also noted: the lifecycle case "a microphone that is disconnected AND at its rate limit is one
CAPTURE_FAULT" was red since pass D9 made that reason an advice; it is rewritten to the rule of
today (two cases).

## 6. Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| D-0013-1 | A fault WITHOUT a device (the capture as a whole) is one at a time; its cause is stored (`params.reason`, `alerts.reason`) but is not a key. The key (kind, reason, device) holds wherever a device is named | a strict key everywhere: every failed start then raises two alerts and two audit rows (measured by the parity test) |
| D-0013-2 | No unique index for the fault key. There was none on (kind, target) either: the rule is the engine's, and the table keeps resolved alerts of the same key. A partial unique index would have to validate against the four development databases and the bulk fixture | `UNIQUE (kind, coalesce(reason,''), coalesce(target,'')) WHERE active` |
| D-0013-3 | The media store root is a table of its own (T-43) | a column of `console_settings` - that row is engine state; the reasoning of N.3 / N.17 |
| D-0013-4 | `evidence_items.signature_key_id` gets NO check (it had none): a tightening that must validate against rows this row may not read | the key-id CHECK on both columns - say so and it is one more generated statement after a look at the four databases |
| D-0013-5 | Variable and stored root disagree -> the command refuses (`RESET_STORE_ROOT_CONFLICT`) | the variable wins, with a printed note. Stricter than the brief; a stale shell variable would otherwise point the guard at an empty folder |
| D-0013-6 | The forwarder (`capture/forwarder.ts`, closed) and one line of `engine/write-plan.ts` were edited: without them the reasons never reach the engine apart and "end to end" is not true. Declared in `file_claims.md` before the edit | a request line and a seam |
| D-0013-7 | The boot step lives in the pool plugin, added at `onReady` (the precedent of `devices.sourceFacts`): no edit of the frozen `app.ts`, no new unit, no step-order pin moved | a step after B-9 in `core/boot-checks.ts` (moves the pins of `rbac/matrix.db` and the core unit's boot tests) |

## 7. The four standing databases - NOT done here

Until they are migrated, B-3 refuses this tree on all four (`expects 6 (dbc-7)`), and code older
than this tree is refused on a migrated one. Stop every Core first (ports 4420-4423). Per database,
lanes first, `dems_demo` last:

```
npm run db:status  -w @dems/core-server -- --database dems_lane_1
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database dems_lane_1
npm run db:status  -w @dems/core-server -- --database dems_lane_1
```

Expect before: `5; contract revision dbc-6`, `13 file(s)` + 2 pending. After: `6; contract revision
dbc-7; this code expects 6 (dbc-7)`, `15 file(s); ledger matches`, 43 tables, `core_media_store 0`,
every other count as before. A second `db:migrate` applies nothing. The migration fails as a whole
(nothing applied) only if a stored revision held a key id outside the new form - none can: the old
rule was narrower.

No reseed is needed for the migration. For the reseed the controller planned: `db:reset` now needs
to know the media store root. Either start the Core of that database once (it records its root),
or state it:

```
DEMS_MEDIA_DIR=<absolute media store root of that instance> /usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -w @dems/core-server -- --database dems_demo
```

It prints the root it judges; without either source it answers `RESET_STORE_ROOT_UNKNOWN` and
changes nothing.

## 8. Not proven / limits

- Nothing ran on the four standing databases; "old code refused" is B-3 called with the old pair.
- The boot step on a REAL capture boot is proven on the simulated boot of the test app only (the
  step reads nothing of the capture mode).
- The path is stored as written (normalised, symlinks not resolved): the command's variable and the
  server's must name the same spelling, or the conflict refusal answers.
- Web and mobile were not run. The shared `faults` slice gained an optional member and the OpenAPI
  document five lines: a client test that compares that document or the slice exactly belongs to
  the whole-suite run.
- An alert of a device raised BEFORE this tree (no `params.reason`) and a fault entry without a
  reason are keyed as before; nothing is backfilled.

## 9. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2 </dev/null` | `db-migrate` | red only: the three db cases of section 5 (and the known `demo/reset.db` isolation case if it appears) |
| `npx vitest run --root apps/core-server --project unit --maxWorkers=4 </dev/null` | none | red only: adapters static A-5 |
| `npm test -w @dems/shared` | none | green |
| `npm test -w @dems/core-web`; `npx -w apps/mobile jest --maxWorkers=2` | none | attention: a test that pins the `faults` slice shape or `openapi.json` bytes |

---
*Generated: 2026-10-10*
