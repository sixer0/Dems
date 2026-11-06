---
task_id: 2026-10-12_input_av_core_adapter_plan
row: I-9c (integration pass, wave 12, track D)
date: 2026-10-14
agent: coder-execution (I-9c)
narrative_tier: 2
decision: C126 (the fixed list); C117, C122, C61 (5); review 120 F-6; review 120b S2-01 (c)
status: needs-review (items 2 and 3 done; items 1 and 4 stopped by their own condition, each with a request line)
---

# Integration pass I-9c

Tree: branch `task4/input-av-core-port`, head `1fbeada7`, uncommitted. Existing files changed with the Edit tool only; the two
records and the git-ignored mutant runner `.cache/task4-i9c/mutant.vitest.config.ts` are new files (Write). Nothing staged or
committed. Throw-away databases only (run prefixes `dems_test_local_tmvp*`, each teardown "0 remain"); no demo, lane or
`dems_test_m12_row232` database named; no key or credential file read; nothing left running.

## 1. Items

| # | Item | State | Proof |
|---|---|---|---|
| 1 | R-5 red, `capture-config/__tests__/static.test.ts:175` | STOPPED (the brief's own condition) | see section 2 |
| 2 | The demo reset keeps the tables of F-6 / NF and reads the network settings again | DONE, one binding left as a request | sections 3, 6 |
| 3 | README: V7's sentence, R119c-03, the stale parts row C2 found | DONE | section 4 |
| 4 | `config.ts:29` gives the reserved id `DEMS-IR-01` | STOPPED (a test pins the text) | section 5 |

## 2. Item 1 - R-5 is not loosened

The rule's purpose (`static.test.ts:53-57`): the three reveal reasons of the camera credential (`SESSION_OPEN`,
`RELAY_RESTART`, `CONNECTION_TEST`) are written as a text only by the credential reader, the audit writer and its fixture, so
no holder can say a reason. `src/modules/capture-discovery/adopted-profiles.ts:55-59` writes `'SESSION_OPEN'` as a value of
ANOTHER closed list, `ProfilesNotStoredCause` ("a session opened while the camera was being asked", used at `:151`). It is not a
reveal-reason writer. Naming the whole file in `REVEAL_REASON_WRITERS` would let a real reason pass unseen in the module that
holds the stored-credential connection test. Not added. Request line `row I-9c item 1`: rename the cause (one word) and its
expectations in `adopted-test.test.ts`.

- Red on the tree: `npx vitest run src/modules/capture-config/__tests__/static.test.ts` -> `Tests 1 failed | 16 passed (17)`;
  `[row144] files that write a reveal reason: src/core/audit-details.ts, src/db/fixtures/operations.ts,
  src/modules/capture-config/credential-reader.ts, src/modules/capture-discovery/adopted-profiles.ts`.
- Its planted control (`:160`, "finds a caller that says a reason ... (positive control)") passed in the same run: the rule
  still detects a planted caller.

## 3. Item 2 - the demo reset

**What it did before (source `apps/core-server/src/db/reset/kept-tables.ts:75-89` at `1fbeada7`).** Thirteen kept tables; the
five tables of task 4's schema sets A to C (T-44 `capture_device_streams`, T-45 `capture_audio_inputs`, T-46
`capture_network_config`, T-47 `host_network_aliases`, T-48 `installation_acceptances`) were rebuilt EMPTY by a reset (pins
"rebuilt 29" in `reset.db.test.ts:248` and `modules/demo/__tests__/reset.db.test.ts:368`). `kept()` carried by ONE key column
and T-44's key is `(device_id, profile)`. The resume of `modules/demo/reset.ts` named pool, boot checks, matrix, engine - nothing
told the camera network reader (NF case (c)).

**What changed.**

| File | Change |
|---|---|
| `src/db/reset/kept-tables.ts` | `KeptTable.keys` (every key column; `key` stays the first); `kept()` takes one column or a list; the read `ORDER BY`, the insert `ORDER BY`, the update join and the upsert `ON CONFLICT` use every key column (single-key statements are byte-identical: the existing exact-text pins pass). Five `kept(...)` lines before the lineage, in the design's modes (schema design 03 section 3.3): T-44 `upsert` on `(device_id, profile)`, T-45 `upsert`, T-46 `upsert`, T-47 `insert`, T-48 `insert`. Kept set 13 -> 18 |
| `test/support/reset.ts` | the dumps and the contract checksum order by every key column (a dump of T-44 ordered by `device_id` alone is not stable) |
| `src/modules/demo/reset.ts` | `ResetHost.reloadNetworkFacts?()` (optional); called after the engine reload / resync and BEFORE the hold is released, whether or not the reset happened; a door that throws is one warn line and one persistent entry `DEMO_RESET_NETWORK_FACTS_NOT_RELOADED`, the reset stands |
| pins | `kept-tables.test.ts` (list, modes, keys incl. the table-level primary key, two new cases); `m4-sec-reset.db.test.ts:386` and `m2-sttcfg-seed-kept.db.test.ts:122` 13 -> 18; `reset.db.test.ts:248` and `modules/demo/__tests__/reset.db.test.ts:368` 29 -> 24; `cli.db.test.ts:177` the printed kept counts (+5 names, 0 each); `modules/demo/__tests__/static.test.ts` `{ err:` 7 -> 8 |
| new cases | `m2-guard-keepset.db.test.ts` "I-9c (review 120 F-6)": a camera with TWO stream rows, a registered input, the network settings, an OPEN and a closed alias and an acceptance cross a real reset, each table checksum-equal; `reset-order.test.ts` "I-9c": four cases + one control |

**The binding is NOT made** (request line `row I-9c item 2`): `modules/demo` may not import a value of `modules/capture-config`
(rule 5, `test/static/imports.test.ts:141`, `MODULE_TO_MODULE` holds two edges, "only where a decision says so"), and `app.ts` is
frozen (P25). With the table now KEPT, the row behind the reader after a reset is the row it held (the reset quiesces first), so
case (c) no longer leaves the reader stale; the door call is defence in depth and waits for the ruling.

**Checks.**

| Check | Result |
|---|---|
| unit: `kept-tables.test.ts`, `db/reset/static.test.ts`, `demo/reset-order.test.ts`, `demo/static.test.ts`, `demo/host.test.ts` | run 1: `2 failed | 137 passed (139)` - both mine (a slice length in my new case; the folder's `{ err:` pin, +1 by my warn line); run 2: `Test Files 5 passed (5)`, `Tests 139 passed (139)` |
| db: `m2-guard-keepset`, `m2-sttcfg-seed-kept`, `m4-sec-reset`, `db/reset/reset.db`, `demo/reset.db` | `Test Files 5 passed (5)`, `Tests 38 passed (38)`; teardown 0 remain |
| the new db case by name (evidence of its log line; not a retry) | `[i9c] kept rows of the five tables: capture_device_streams 2, capture_audio_inputs 1, capture_network_config 1, host_network_aliases 2, installation_acceptances 1`; `Tests 1 passed | 4 skipped (5)` |
| db: the other users of the reset support (`cli.db`, both `reset-failures.db`, `store-root.db`, `reset-store-root.db`, `gate.db`, `faults.db`, `clock-floor.db`, `restart.db`, security-audit `reset.db`, `bulk.db`) | run 1: `1 failed | 180 passed (181)` - mine: `cli.db.test.ts:177` pins the printed kept counts; pinned; run 2 of that file: `Tests 8 passed (8)` |

**Mutations (in memory, `.cache/task4-i9c/mutant.vitest.config.ts`; no file of the tree mutated).**

| Mutant | Red |
|---|---|
| M1 T-44 carried by `device_id` alone | `kept-tables.test.ts` 3 failed |
| M2 `keyList` takes the first key column only | 1 failed (the two-column statements case) |
| M3 the call `await host.reloadNetworkFacts()` removed | `reset-order.test.ts` 3 failed |
| M4 the hold released before the call | 2 failed (both order cases) |
| M5 the T-44 `kept(...)` line removed (db) | the new db case failed: `expected { registry_counters: 2, …(16) } to match object { capture_device_streams: 2, …(4) }` |

Unproven: a reset on a database with real adopted cameras (doubles only); the door against a booted `REAL_PRODUCTION` Core (demo
operations are refused there); the server's binding of the door (request).

## 4. Item 3 - README.md (Edit only)

| Place | Change | Source of each fact |
|---|---|---|
| Ringkasan (top) | one bullet on the fourth task | `apps/core-server/package.json:24,27`; README block **Task 4** ("Read this first"); C108; `git branch --contains 1fbeada7` = the task-4 branch only |
| "What this is" | one sentence on the fourth task | the same |
| Live mode, "A reset keeps ..." | what a reset keeps now (18 tables) | `kept-tables.ts` after this pass |
| "What refuses to start", row `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` | line numbers `checks.ts:631-636`, `capture/boot/index.ts:689` (were `410-416`, `183`); "uncommitted" -> committed in `035150b2`; the set-password command | `grep -n` of both files; `git log` subject of `035150b2`; README Task 4 X-2 row (C64) |
| "State at commit `713d83f`", row "Not proven" (C2's "line 441") | a dated correction after the sentence "cannot operate at all" | `package.json:24,27`; commit `0f5d2a8e` subject; Known limits 34, 46, 58; C108 |
| **Real cameras** | row V7's sentence, VERBATIM (`file_requests.md:522`), as a bullet with its sources | V7's line; C115, C126 (2) |
| **Commissioning**, "NOT RELEASED ..." | the statement IS MADE for SHA-256 `3621e79c...4914`, replaces the earlier one, holds for that file only; S13-10 (a) and the host checks remain | `verification/119c_helper_statement_3621e79c.md` section 1 (C-1 to C-4); decision C122; `scripts/host/netalias/SHA256SUMS:1` = `shasum -a 256` of the helper (equal) |
| **Tests** | "Correction (2026-10-14)": the counts of the fourth task are "TO BE REFRESHED AFTER THE FINAL FULL SUITE"; no count invented; contract 110 operations / 83 audit types at `1fbeada7` | decision U26; `delegation_progress/wave_12_brief.md:3` |

Not changed: the 713d83f tables as history; Known limit 57 (consistent with the new sentence).

## 5. Item 4 - `config.ts:29` not edited

`config.ts` is pinned by digest: `capture/__tests__/static.test.ts:913-935` lists every waived line verbatim; line 29's text stands
at `:930`. Changing it alone turns that test red, and that file is N4's in wave 12. Request line `row I-9c item 4`: ONE paired
change - `config.ts:29` and `static.test.ts:930` to "e.g. `DEMS-SITE-21`" (not in `ReservedInstallationId`,
`capture/boot/checks.ts:423-430`; matches `^[A-Z][A-Z0-9-]{0,31}$`, `config.ts:313-317`). Grep: in apps/core-server only those two
files carry the text; `config.ts:313` (pinned at `:1020`) and three contract sources of packages/shared give the same example
(named in the line, not asked).

## 6. Requests left (`delegation_progress/file_requests.md`, three lines `row I-9c`)

1. item 1 - rename `ProfilesNotStoredCause.SESSION_OPEN` (owner of capture-discovery / row PR).
2. item 2 - a ruling for the edge `src/modules/demo -> src/modules/capture-config`, then one member in `createResetHost`.
3. item 4 - the paired change of `config.ts:29` and `capture/__tests__/static.test.ts:930`.

## 7. Workspace checks

- `npx vitest run --project unit test/static src/db/reset/__tests__ src/modules/demo/__tests__ src/modules/capture-config/__tests__/static.test.ts`:
  `Test Files 1 failed | 34 passed (35)`, `Tests 1 failed | 622 passed (623)` - the one red is R-5 (item 1, not mine).
- `npx tsc --noEmit -p .` (apps/core-server): 32 error lines in 9 files, NONE in a file of this pass: `capture-config/network/__tests__/service.test.ts` 21 (`onvifPorts`, V7b in flight), `test/support/capture.ts` 1, `capture/adapters/mic-transport.ts` 2, `capture/__tests__/forwarder-engine.test.ts` 2, `forwarder-advisories.test.ts` 1, `fault-lifecycle.test.ts` 1, `capture/fence/__tests__/development-session.db.test.ts` 2, `capture-config/__tests__/adopted-camera-test.db.test.ts` 1, `camera-adapter-open.db.test.ts` 1.
- `npx oxlint` (apps/core-server): exit 0; 14 warning lines, none in `db/reset`, `modules/demo` or `test/support/reset.ts`.

## 8. Driver decisions (for the controller to confirm)

- DD-1: item 2 read as F-6's FIVE tables (the brief names F-6 and NF; NF names only `capture_network_config`). Order: after
  `core_media_store`, before the lineage - the design's "after `capture_devices`" holds and the earlier order is unchanged.
- DD-2: `reloadNetworkFacts` is OPTIONAL on `ResetHost` and its failure is a warning, not a resume failure (the real door never
  rejects; a stand-in's throw must not leave the server held).
- DD-3: the README additions are dated in-place corrections in the README's own style, not rewrites of the 713d83f record.

---
*Generated: 2026-10-14*
