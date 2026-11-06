---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: integration pass E3 - the reds left after migration 0013, the seed hook of the v2 demo packages, item 7 (decision D170)
date: 2026-10-10
agent: coder-execution (single driver; rules D94 / D122 / D163, ownership D95)
source_plan: implementation/107_migration_0013.md section 5; 105_integration_pass_d11.md section 7; 37c_m7_seal_fixes_demo_seed.md section 6
narrative_tier: 3
status: needs-review - 7 of 7 items done and proven; two edits in closed foreign files, each one condition (E3-1, E3-2); one consequence of a shared media root to rule on (E3-3)
---

# 109 - Integration pass E3

Baseline `e296ce7` plus the tree. No commit, no migration (schema `[6, 'dbc-7']`, asserted by the db
files run), no lockfile write. Only throw-away databases; `dems_demo` and the lanes not touched;
`.data/pg*.env` not read by me (the product loader reads the runtime file inside two tests, as every
db test does). No local device selected, pre-checked or started. `C` = `apps/core-server/`.

## 1. Per item

| # | Status | What |
|---|---|---|
| 1 | done - THE TEST was wrong | `C/test/db/device-upsert.db.test.ts`. The planner's own rule (pass D4, `C/src/db/mapping/changes.ts` `diffCapture`): a device whose transport the state holds goes into the ONE batched UPSERT; a device whose transport the state does NOT hold (a local device, an adopted camera) is ONE UPDATE of its own, so the registry's transport is never overwritten. CAM-08 + MIC-01 = 2 changes by that rule. Neither 0013's line (`sameFault`) nor D11's facts touch it. The case now expects 2 and asserts each shape (`insert` holding MIC-01, `update` keyed CAM-08 with `set { enabled }`) |
| 2 | done - DERIVED | Contract dbc-4 N.2 / D-DB-11: "the source class is not stored: it is derived from the adapter kind"; the stored row of a built-in surfaces no adapter (`captureDeviceFromRow`), and the registry of the RUNNING operation says it at boot (`devices.sourceFacts`). `sourceOpen` likewise. `C/src/modules/capture-config/__tests__/integration-d1b.db.test.ts`: the round trip compares through `withoutBootDerivedSourceFacts` (says so in its header), which first REQUIRES `FAKE` / `DEVELOPMENT` on exactly the four built-ins; a device that is not built in keeps both members in the comparison. Control: without the exclusion the comparison is not equal |
| 3 | done | `C/src/modules/transcripts/heads.ts`. Cause: the bulk fixture holds 30 revisions on `SIMULATED` items - no package in this store by design - and the step read a document for each. Now silent for: an item without a sealed v2 package here by its own facts (`hasSealedPackageHere`: not REAL v2 and not seed-sealed), a revision of an item the state does not hold, a head already on its item. A failure (an item that HAS a package here and whose document cannot be read, a bad row, a refused door): ONE log line + ONE persisted entry per start, `TRANSCRIPT_HEAD_NOT_PUBLISHED_AT_BOOT`, true count + at most 10 IDs. Tests: NEW `__tests__/heads.test.ts`; the one-line pin in `transcript-routes.db.test.ts`; the bulk fixture = `restart.test.ts` long-history case, green |
| 4 | done - two NAMED entries, no importer moved | `C/src/capture/adapters/__tests__/static.test.ts` A-5. Both offenders already import the INDEX and only the constant `CaptureOperation`; neither builds an adapter. `src/capture/index.ts:44` - the capture unit's own composition root (mounts fence and boot; real or unconfigured launcher). `src/sealing-host/index.ts:41` - mounts nothing in SIMULATED, chooses the manifest notice. Named by FILE: a sibling stays refused, a named file past the index stays refused (controls planted); a named entry that names no importer fails. `capture/index.ts` is pass E2's, so it could not be moved to read the constant elsewhere |
| 5 | done | `C/test/acceptance/contract.test.ts`: every server of the file gets its own media root, `<run dataDir>/test-contract-media-<pid>/<server>/sessions`, removed at the end. Proof: `contract.test.ts` + `modules/demo/__tests__/reset.db.test.ts` in ONE run, 45 of 45; the shared `.data/media/sessions` holds nothing afterwards. No "before" run was made to reproduce D11's red |
| 6 | done | section 2 |
| 7 | done - EPHEMERAL | The range is NOT required: the product accepts any port 1-65535 (`onvif-session.ts:171`, `ws-discovery.ts:138`); only the stub's own two assertions held it to 8554-8564. `C/test/support/fake-onvif-stub.ts`: `freeFakeOnvifPorts` binds port 0 on 127.0.0.1 (two TCP, one UDP); a stub refuses any port below 32768 and any port of the protocol's media range (`CAPTURE_MEDIA_PORT_MIN` / `MAX` of `@dems/capture-protocol` - the one shared place; every harness port is inside it by the protocol's rule); a port busy at start is `FakeOnvifPortBusyError` (`FAKE_ONVIF_PORT_BUSY`), never another port. Test: 40 allocations, none in the harness set; busy = named; 13 refused numbers. No harness number changed, no request needed |

## 2. Item 6 - v2 demo packages at seed time

| Part | Where |
|---|---|
| (a) which Core, which items | NEW `C/src/db/seed/demo-core.ts`: the command asks the Core's own loader (`loadConfig`) and the one function `captureOperationOf` over ITS ENVIRONMENT; only `REAL_DEVELOPMENT` gets the port, every other answer is a named skip. NEW `demo-packages.ts` (pure): the tamper item (sequence 5) and the first clean SEALED demo item - both or none |
| (a) the hook | NEW `C/src/sealing-host/demo-seed/seed-hook.ts` `createDemoPackageSeeder`: `sealDemoPackages` over that Core's signer, credential store and store. STAGED in `<store>/.demo-seed/`, PLACED by one rename each after the rows are committed; never over a folder. Skips by name: `STORE_OUTSIDE_DATA_DIR`, `STORE_ROOT_MISMATCH`, `SIGNING_KEY_NOT_USABLE`, `NOT_A_DEVELOPMENT_KEY`, `PACKAGE_FOLDER_IN_THE_WAY`, `GENERATION_FAILED` |
| (a) the helper | NEW `C/src/db/seed/demo-helper.ts`: one `spawn` (no shell, empty environment, bounded, stderr dropped) of the configured helper with the generated-source table. Command-line only: `src/db/` is outside the server-runtime process rule. Absent helper: `HELPER_ABSENT`, the path and the fix are printed, the seed goes on WITHOUT the v2 items |
| (b) rows | `seed.ts`: `SeedDependencies.demoPackages`; `prepareSeed` seals before mapping, overlays the two items (`withSeedSealedPackages`) and adds four `session_capture_sources` rows (FAKE) per session; `writeSeed` inserts them. Mapping: `signatureFromRow` admits the real pair on `DEMO_PACKAGE` + version 2 + `development_sources` true (one more writer, named). No audit row is touched |
| (c) reset | `real-evidence.ts`: the one statement also reads `DEMO_PACKAGE` v2 rows with a non-simulated signature; such a row never blocks, and anchors its folder only under rules (1) and (2) of a development item; the folder clears by rules (4), (5) unchanged and is removed by (6)-(8). Counted apart (`seedSealedDemoSessions`), stated in its own sentence. `routine.ts`: `ResetOptions.demoPackages` - seal at R-5 (told the cleared folders and the judged root), place after the swap and the removal, discard on a failure before the swap. `cli.ts` of both commands wired |
| (d) op 41 | `C/src/evidence-verify/index.ts`: `isSeedSealedDemoItem` (DEMO_PACKAGE, version 2, development sources, Ed25519 not simulated) and `hasSealedPackageHere`; `sealing-host/index.ts` `findItem`: one import member + its one condition |

The session key of a demo session is made once and KEPT: a reseed seals under the key the store holds (E3-4).

**Proof** (`C/test/acceptance/demo-seed-v2.test.ts`, throw-away database + scratch data directory, the REAL helper, 4 of 4):
seed exit 0, `2 sealed with the development key`, 2 rows v2 / 11 rows v1, 8 source rows, 2 folders, no staging root ->
boot `REAL_DEVELOPMENT`, no error line -> op 41 clean item: 15 checks, all PASS, `overall PASS`, `sources.development: true`,
`signature.developmentKey: true` -> op 41 EV 0005: `TAMPERED`, fragments exactly `[(VIDEO-02, 3)]`, count 1 -> control: a v1
demo item still answers the hosted verify -> `db:reset` exit 0: "replaces 2 seed-sealed demo package record(s)",
"removed 2 development-source package folder(s)", sealed again, both digests DIFFERENT, same verdicts.
Control without the helper: `NOT generated (HELPER_ABSENT)` naming the path, 13 v1 rows, no source row; a SIMULATED
environment: `NOT_A_DEVELOPMENT_CAPTURE_CORE`. Heavy-host lock: NOT taken (no worker; ffmpeg for about 1 s per run).
The 14 frozen v1 packages: sha256 over the 89 tracked files = `005e8f85...1fd4b1`, unchanged; `gen-demo-evidence.ts` untouched.

## 3. Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| typecheck core-server, shared; lint core-server, shared | 0 errors, lint clean |
| Core unit: `src/db`, `sealing-host`, `sealing`, `evidence-verify`, `modules/{evidence,transcripts,devices,capture-config,demo,sealing}`, capture static + adapters + fence, `credential-store`, `engine`, `test/static`, `test/support`, `test/db` | 138 files, 2,693 tests; 1 red (my statement pin in `test/db/set4-rules.test.ts`), fixed, that file green |
| Core db (lock, `--maxWorkers=2`): items 1, 2, `restart.test.ts`, `modules/transcripts`, `db/seed`, `db/reset`, `db/mapping`, `capture-discovery` (+ connect), `modules/evidence`, `modules/devices`, `modules/demo`, `demo-seed-v2` | 35 files, green |
| `contract.test.ts` + `demo/reset.db.test.ts` together; `rbac-matrix.test.ts` | green (first run: 5 red in `reset.db` - my two new report members broke its exact key list; the members are now stated only when the port is handed in; second run 45 of 45) |
| Shared: `sim-core-driven-seal.test.ts` | 21 of 21 |
| Mutants (files restored): guard without the source-row proof; mapping without the development mark; item predicate without the signature | 3 of 3 red (the third survived the first test - a direct test of the predicate was added, then red) |
| `demo-seed-v2` first run | 2 red: the engine's verdict recorder refused a non-REAL item (E3-2); after it 4 of 4 |

## 4. Not proven / limits

- Nothing ran on a standing database, in a browser or on a device. Whole-workspace suites not run.
- Item 5 has no reproduced "before".
- The seed helper is checked for "absolute, a regular file, executable" - not the owner / writable-directory rule of SEC35-43 (that rule's functions are not reachable from outside the capture unit).
- Playback (op 88), export and the clients were not examined for the two v2 demo items (two notice lines filed).
- A package that cannot be placed after a reset (a folder in the way that the guard cleared and the removal then left) leaves a row that names a package that is not there; it is reported (`RESET_DEMO_PACKAGE_NOT_PLACED`) and not repaired.
- The item rows state what was sealed (8 s, the seed instant); their custody and audit rows are the dataset's.

## 5. Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| E3-1 | `sealing-host/index.ts` (row 82c's, closed): one import member + the one condition of `findItem`, as its own request 4 asks | a seam in my area - there is none: the lookup is that line |
| E3-2 | `packages/shared/src/sim/session-machine.ts` (row 82's, closed), found by the proof: ONE condition in `recordEvidenceVerificationTransition` - it refused every non-REAL item, so op 41 answered 409 for a seed-sealed item. Declared in `file_claims.md` before the edit; one test with four controls | stop at a blocking request - op 41 could then not be proven |
| E3-3 | TO RULE: with ONE media root shared by several databases (today all four share `.data/media/sessions`), the v2 demo folders of one database BLOCK the reset of every other (a v2 folder no row of that database names is unprovable - the guard's existing rule for any development package). Section 6 gives the development Core a root of its own | seed v2 items into one database only and keep the shared root: the other three resets are then blocked |
| E3-4 | No session key is removed at a reset: the reseed reuses `KID-<sessionId>` | removal needs a new user of the credential store (its pinned list) |
| E3-5 | The seed's process start lives in `src/db/seed/` (a command, outside the server-runtime rule), not behind the fence's door; server-side resets get no port (they exist in SIMULATED only) | a one-shot door exported by `capture/fence` (row 82c's request 1) |
| E3-6 | The command learns the Core from its ENVIRONMENT through `loadConfig` + `captureOperationOf` - no flag is read in `src/db` (G-R15 holds) | new command-line options |
| E3-7 | Item 7: ephemeral ports; `FAKE_ONVIF_PORT_MIN` is now 32768 | a fixed sub-range inside 8554-8564: parallel test files would collide on it, and `e2e.py` would have to give numbers up |

## 6. Standing databases - migrate, then reseed with the v2 demo items

Stop every Core (ports 4420-4423). Migrate all four as note 107 section 7 says (lanes first, `dems_demo` last).
Once per machine: `npm run capture:dev-setup` (the helper copy; present today) and
`npm run evidence:dev-key -w @dems/core-server` (`.data/signer` is absent today; refuses if a key exists).

The database whose Core runs development capture (here `dems_demo`), with a media root of its own (E3-3):

```
DEMS_CAPTURE_MODE=real DEMS_CAPTURE_DEV_SOURCES=1 \
DEMS_CAPTURE_HELPER_FFMPEG="$PWD/.data/helpers/ffmpeg" DEMS_MEDIA_DIR="$PWD/.data/media/dems_demo/sessions" \
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -w @dems/core-server -- --database dems_demo
```

Expect: `media store root the real-evidence guard judges: .../dems_demo/sessions`, then
`v2 demo packages: 2 sealed with the development key ...` and `in the evidence store: SESSION-..., SESSION-...`.
Any other answer is one line `v2 demo packages: NOT generated (<REASON>): ...` and a dataset of 13 v1 items.
Start that Core with the SAME four variables (and `DEMS_DEMO_CONTROLS` unset): another `DEMS_MEDIA_DIR` is refused at the next reset (`RESET_STORE_ROOT_CONFLICT`).

The three lanes (simulated Cores, no v2 item), unchanged from note 107:

```
DEMS_MEDIA_DIR="$PWD/.data/media/sessions" /usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -w @dems/core-server -- --database dems_lane_1
```

## 7. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2 </dev/null` | `db-migrate` | green; none of the three db reds of note 107 section 5; no `RESET_BLOCKED_REAL_EVIDENCE` in a reset file |
| `npx vitest run --root apps/core-server --project unit --maxWorkers=4 </dev/null` (sandbox off: loopback) | none | green; A-5 green; while the worker e2e series runs beside it, no "ports busy" there |
| `npm test -w @dems/shared` | none | green |
| worker e2e series `--ports 8563,8564` WHILE the unit project runs | heavy-host | the 22 checks of D170 are judged |
| `npm test -w @dems/core-web`; `npx -w apps/mobile jest --maxWorkers=2` | none | unchanged (no client file touched) |

## 8. Device / browser checks for the gate

| Check | Flow | Pass |
|---|---|---|
| DEMO-V2-PASS | development Core reseeded as section 6; Evidence, the clean v2 item, Verify | 15 of 15, the development-source and development-key marks |
| DEMO-V2-TAMPER | the same Core, EV 0005, Verify | Tampered; exactly one fragment named: VIDEO-02, fragment 3 |
| DEMO-V2-PLAY | the same two items, playback and export | to rule after the notice lines of this pass are answered |

---
*Generated: 2026-10-10*
