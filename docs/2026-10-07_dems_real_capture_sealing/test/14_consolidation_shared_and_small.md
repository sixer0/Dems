---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
step: test-suite consolidation, step 2 - owner of packages/shared, packages/capture-protocol, apps/transcriber, apps/mock-core
decision: D233, D238
tree: a5d75ed + this work (uncommitted; no git write)
basis: test/13_suite_consolidation_audit.md sections 3c, 3d, 4, 7.4, 7.5; delegation_progress/consolidation_brief.md
status: complete
---

# Test-suite consolidation: shared, capture-protocol, transcriber, mock-core

Tests and test support only. No product file changed (`git status --short packages/shared/src
packages/shared/scripts packages/capture-protocol apps/mock-core apps/transcriber/src` shows only
`__tests__` paths). No git write, no install, no lane, no database, no `test/real/**`, no port 8000.
Tools of this step: `scratchpad/c14small/` (`merge.mjs`, `hashes.mjs`, `cmp.mjs`, the two plans, the
logs, the backups `bak/`, the mutation copies `mut/`).

## 1. Before / after

Commands: the ones of `test/12_precommit_wave_m.md` (`npm run test -w @dems/<ws>`; shared and
capture-protocol inside the sandbox, transcriber and mock-core with the sandbox off). One run each.

| workspace | files before -> after | tests before -> after | wall before | wall after | load (1 min) before / after |
|---|---|---|---|---|---|
| shared | 121 -> 101 | 2612 passed -> 2612 passed | 12.62 s | 4.95 s | 4.9 rising to 30.9 / 3.6 |
| capture-protocol | 1 -> 1 | 31 -> 31 | 0.26 s | 0.12 s | same runs |
| transcriber | 20 -> 18 | 567 (564 passed, 3 skipped) -> 567 (564 passed, 3 skipped) | 30.09 s | 15.14 s | 30.9 / 5.4 |
| mock-core | 4 -> 4 | 19 -> 19 | 4.79 s | 3.89 s | 30.9 falling / 5.2 |

**The wall times are not a result.** My "before" runs fell into a load peak of the other owners
(1-minute load 30.9, read by the `uptime` in the same command as the transcriber run; I gated the
"after" runs on load below 8, I did not gate the first ones - my error). The quiet-host reference is
test/12: shared 5.29 s, transcriber 15 s, mock-core 4 s, capture-protocol 0.1 s. Against that
reference the after-runs are unchanged within noise (shared 4.95 s: 20 fewer workers at about 70 ms
start-up each is below what one run can show). The audit predicted "5 s -> 5 s"; that holds.

Typecheck and lint after the work: `npm run typecheck -w @dems/<ws>` 0 `error TS` x 4;
`npm run lint -w @dems/<ws>` exit 0 x 4.

Test support added (shared): `packages/shared/test/support/` - 6 modules, 295 lines (section 4).
Lines of `*.test.ts` in shared: 39,226 -> 39,013.

## 2. The test count, to the single test

| workspace | before | deleted | added | after |
|---|---|---|---|---|
| shared | 2612 | 0 | 0 | 2612 |
| transcriber | 567 | 0 | 0 | 567 |
| capture-protocol | 31 | 0 | 0 | 31 |
| mock-core | 19 | 0 | 0 | 19 |

Proof for the moves (`hashes.mjs` = the audit's `collect.mjs` normalisation, plus a hash of the call
around the body so an `.each` table or a timeout cannot change unseen; `cmp.mjs` compares the
multiset of (title, body hash, call hash)):

- shared: 1,862 static `it` sites before and after. 1,850 are identical in title, body and call;
  191 of them now sit in another file. The other 12 are the sites changed ON PURPOSE and are listed
  one by one in sections 5 and 6 (5 AC-C-02 bodies, 3 erasable-syntax bodies, 2 scan pins, 1 title,
  1 example loop).
- transcriber: 331 sites before and after; after the merge all 331 identical, 25 in another file;
  then 1 site changed on purpose (T2).

No test was deleted, so no covering-test / mutation entry of rule 5 applies. Step 3 (the example
constants) added assertions to an existing test, not a test (section 6).

## 3. Files merged

`MERGE` = top-level `describe` blocks moved with the declarations and imports they use; the source
file deleted when its last block left. Every `it` body is character for character the source's
(only the indentation changes where a block went under a subject `describe`; never inside a
multi-line template literal). The header comment of each source went with its blocks.

The audit's home table (3c) for shared was derived from the most specific common import, which
sent 13 of 19 files to `api-capture-discovery.test.ts`. The controller's instruction named homes by
subject; the homes below are by subject. Where no feature-named file of the subject existed the
merged file IS the home (five new files, as the audit does for core-web W2).

### shared - 25 files removed, 5 home files created, 191 `it` sites moved

| from (removed) | sites | to |
|---|---|---|
| `sim-wave-l-z-selector-in-force.test.ts` | 16 | `sim-selector-in-force.test.ts` (new) - ONE file; the static rule "no second spelling in packages/shared/src" and its two controls are in it, unchanged |
| `sim-wave-i-a1-seal-blocked.test.ts` | 5 | `sim-seal-blocked-unsealable.test.ts` (new) |
| `sim-wave-l-s-unsealable-notice.test.ts` | 9 | `sim-seal-blocked-unsealable.test.ts` |
| `sim-m7b-unsealable.test.ts` | 7 | `sim-seal-blocked-unsealable.test.ts` |
| `sim-wave-i-a2-sending-device.test.ts` | 7 | `sim-sending-device.test.ts` (new) |
| `sim-wave-k-s2-sending-device.test.ts` | 7 | `sim-sending-device.test.ts` |
| `sim-fx-switch-device.test.ts` | 2 | `sim-sending-device.test.ts` |
| `sim-capture-config-sending-device.test.ts` | 3 | `sim-sending-device.test.ts` |
| `sim-wave-h-b-session.test.ts` (15) | 2 | `sim-sending-device.test.ts` (G75-02) |
| | 4 | `sim-core-driven-seal.test.ts` (G75-03 / G75-08) |
| | 6 | `sim-capture-fault.test.ts` (new) (G75-10, -05, -06, -09) |
| | 3 | `sim-capture-start.test.ts` (G75-11, G75-07 (c), (d)) |
| `sim-m5-fault-wording.test.ts` | 8 | `sim-capture-fault.test.ts` |
| `sim-wave-k-s1-timeline-fault.test.ts` | 4 | `sim-capture-fault.test.ts` |
| `sim-m5-review.test.ts` (8) | 4 | `sim-capture-fault.test.ts` (R74-01, R74-11) |
| | 4 | `sim-capture-config.test.ts` (R74-02, R74-05) |
| `sim-wave-h-a-generator.test.ts` | 5 | `sim-own-capture.test.ts` (new) |
| `sim-wave-h-z1-time.test.ts` | 8 | `sim-own-capture.test.ts` |
| `sim-pass-hy-host-clock-derive.test.ts` | 4 | `sim-own-capture.test.ts` |
| `sim-pass-j.test.ts` (12) | 8 | `sim-own-capture.test.ts` (G75b-06, G75b-03) |
| | 4 | `sim-capture-start.test.ts` (G75b-10, the refused start) |
| `sim-wave-h-z1-connect-hold.test.ts` | 4 | `sim-capture-start.test.ts` |
| `sim-wave-h-a-seal-steps.test.ts` | 2 | `sim-core-driven-seal.test.ts` |
| `integration-c1.test.ts` (9) | 6 / 2 / 1 | `sim-capture-config.test.ts` / `sim-capture-start.test.ts` / `sim-evidence-item-kind.test.ts` |
| `integration-d1b.test.ts` (25) | 14 / 3 / 3 / 3 / 2 | `sim-capture-config.test.ts` / `sim-capture-discovery.test.ts` / `sim-capture-telemetry.test.ts` / `api-domain-operations.test.ts` / `sim-evidence-item-kind.test.ts` |
| `sim-fy-clock-offset.test.ts` | 6 | `sim-capture-telemetry.test.ts` (the advisory notices) |
| `api-wave-k-z1-seek-index.test.ts` (PROTECTED) | 5 | `api-domain-operations.test.ts` - case for case; the totals case "97 operations (36 GET / 61 POST), 67 audit types" keeps its explicit numbers |
| `api-wave-h-z1-demo-fault-strict.test.ts` (PROTECTED) | 2 sites (6 tests) | `api-schemas.test.ts` - both `.each` tables unchanged |
| `fxr-w-nits.test.ts` | 3 | `api-closeout.test.ts` |
| `api-fx-descriptions.test.ts` | 3 | `api-closeout.test.ts` |

Sites are static call sites; the run counts are the audit's (for example `sim-wave-h-b-session`
15 tests = 2 + 4 + 6 + 3).

Six of the 25 are not in the audit's list of 19: `sim-m5-fault-wording`, `sim-m7b-unsealable`,
`sim-fx-switch-device`, `sim-fy-clock-offset`, `api-fx-descriptions` (gate / pass names; the
instruction's "`sim-m*` gate families and the like") and `sim-capture-config-sending-device`
(feature-named, born in fix wave H for G70-05; merged so that the sending device has ONE file).
See "Decisions" 1 and 2.

`describe` titles that changed (wave / pass prefix or the pass's item number removed; the finding
ids were already in the titles and stay):

| before | after |
|---|---|
| `closing pass L-Z, item 1 - the ONE shared helper` | `the ONE shared helper (L-Z item 1)` |
| `closing pass L-Z, item 1 - the shared readers, sealed session THEN the selector changed` | `the shared readers, sealed session THEN the selector changed (L-Z item 1)` |
| `fix 157 - the audio pair in force (sealed session THEN the microphone changed)` | `the audio pair in force (sealed session THEN the microphone changed; fix 157)` |
| `closing pass L-Z, item 1 - no second spelling in packages/shared/src (static)` | `no second spelling in packages/shared/src (static; L-Z item 1)` |
| `D216 (2), wave K: the rows wave I did not name carry the sending device` | `D216 (2): the rows the session actions did not name carry the sending device` |
| `1. security.platformNotReported (G75b-06, D217 (7))` and `2. coreNotRunning: ...`, `3. the generator holds ...`, `7. a refused start ...` | the same without the number |
| `1. the mic input id rule is MIC-NN`, `2. captureDurable on the session payload`, `3. the sealed columns of a v2 evidence item` | `... (pass C1, seam 1 / 2 / 3)` |
| `1. operation 78: ...`, `2. the session audio source ...`, `3. developmentSources ...`, `8. an audit row ...`, `10. meter channel ...`, `12. operations 42, 87 and 88 ...`, `13. advisory notices ...` | the same without the number, `(pass D1b, seam N)` at the end |

No `it` title changed in a merge. Where several sources share a home, each group sits under a
subject `describe` (for example `describe('session actions: create, pre-check, start, stop, cancel')`),
so a test's full name gains that level.

### transcriber - 2 files removed, 25 sites moved (T1)

| from (removed) | sites | to |
|---|---|---|
| `src/__tests__/row77-review-fixes.test.ts` | 20 | `src/__tests__/checkpoint-runner.test.ts`, under `navigator findings on the runner: N-1, N-5, N-6, N-9, N-10 and the temporary audio (D-77-1)` |
| `src/__tests__/row79-carried.test.ts` | 5 | `src/__tests__/assembly.test.ts`, under `carried review items: N-4 (unbroken speech), N-7 (failed chunks) and D-EV-1 (no text for a failed chunk)` |

### capture-protocol, mock-core

Nothing: the audit lists no action (T3 KEEP).

## 4. Helpers (rule 3: no duplicate helper)

- A helper whose text equals a top-level helper of the home is not copied: the home's is used
  (`START`, `INPUT`, `hex`, `sealInput` in `sim-core-driven-seal`; `START` in `sim-capture-start`,
  `sim-capture-config`, `sim-capture-telemetry`; `SECOND` in `checkpoint-runner`).
- A source that was split over several homes would have carried its test bed into each. Its
  declarations moved once, verbatim, into a support module, and each group takes what it uses with
  one line (`const { harness, report } = sessionFaultBed;`):

| support module | from | used by |
|---|---|---|
| `test/support/session-fault-bed.ts` | `sim-wave-h-b-session` | `sim-core-driven-seal`, `sim-capture-fault`, `sim-capture-start`, `sim-sending-device` |
| `test/support/failed-start-bed.ts` | `sim-m5-review` | `sim-capture-fault`, `sim-capture-config` |
| `test/support/own-capture-bed.ts` | `sim-pass-j` | `sim-own-capture`, `sim-capture-start` |
| `test/support/mic-id-bed.ts` | `integration-c1` | `sim-capture-config`, `sim-capture-start` |
| `test/support/mic-pair-bed.ts` | `integration-d1b` | `sim-capture-config`, `sim-evidence-item-kind`, `sim-capture-telemetry`, `api-domain-operations` |
| `test/support/platform-rules.ts` | new (section 5) | the five `*-platform-neutral` files |

- A source that went whole into one home keeps its own bed inside its subject `describe`
  (different case numbers, clocks and moves per finding: they are not copies of one another).

One import note: `sim-capture-start.test.ts` already imported `ActiveSessionSchema` from
`../src/api/state-slices`; the moved blocks of `integration-c1` used the same schema through
`../src/api`. The home's binding is used (same object through the barrel; typecheck and the cases
confirm).

## 5. S2 - identical static rules from one table; list pins -> rules

`packages/shared/test/support/platform-rules.ts` holds the rule text once:
`AC_C_02_NAMED`, `ERASABLE_SYNTAX_RULES` (enum / namespace / parameter property, each named in the
failure message) and `expectScanCovers` (rule R1). Each unit's file still applies the rule to ITS
files and keeps its own positive control; no case was dropped or folded (PROTECTED).

| site (title unchanged unless stated) | file | change |
|---|---|---|
| `AC-C-02: no file names node:, react-native, expo, window or document (comments included)` | `client-`, `live-light-`, `live-source-`, `live-testing-platform-neutral.test.ts` | the pattern literal -> `AC_C_02_NAMED` |
| `AC-C-02: the file names no node:, ...` | `realtime-live-platform-neutral.test.ts` | the same; its two positive controls stay |
| `uses erasable syntax only: no enum, no namespace, no parameter property` | `live-light-`, `live-source-`, `realtime-live-platform-neutral.test.ts` | three pattern literals -> the loop over `ERASABLE_SYNTAX_RULES` |
| `scans the thirteen files of the folder` -> `scans every source file of the folder: an independent listing finds no file the scan missed (rule R1)` | `live-source-platform-neutral.test.ts` | the list of 13 names -> `expectScanCovers`; the constant `FILES` removed |
| `scans the eight files of the fake transport` (its list held nine) -> `scans every source file of the fake transport: ... (rule R1)` | `live-testing-platform-neutral.test.ts` | the list -> `expectScanCovers` |
| `has exactly 15 namespace files and one en key per file` -> ``every namespace file is registered and holds one en key (`NAMESPACE_FILES` is the list)`` | `i18n.test.ts` | title only: the body was the rule already and names no number |

`live-testing`'s own erasable-syntax case is NOT on the table: its parameter-property pattern is a
different, stricter rule with three controls.

Rule R1 (`expectScanCovers`): the scan is not empty, holds the unit's entry, names every source file
that an independent recursive listing of the folder finds, and names nothing the folder does not
hold.

Mutation proofs, run once each, product files restored from copies and compared with `cmp`
(`git status --short packages/shared/src` empty afterwards):

| mutation | expected | result |
|---|---|---|
| `// window` and `enum PlantedForMutation { A }` appended to `src/live/constants.ts`; a new file `zz-planted.ts` (`export {};`) in `src/live/source` and in `src/live/testing`; the six `*platform-neutral*` files run | red for the live-light unit only; R1 green with a new file | `Test Files 1 failed | 5 passed (6)`, `Tests 2 failed | 78 passed (80)`: `live-light ... AC-C-02 ... expected [ 'constants.ts' ] to deeply equal []` and `... erasable syntax ... enum: expected [ 'constants.ts' ] to deeply equal []`; both R1 cases green |
| the scan's own filter narrowed in the two test files (`replica.ts`, `socket.ts` skipped) | R1 red | `source files the scan did not read: expected [ 'replica.ts' ] to deeply equal []`; `... expected [ 'socket.ts' ] ...` (and two cases of the same file that read the narrowed scan) |

Kept as explicit lists, on purpose:

- `live-light-platform-neutral.test.ts` `LIGHT_FILES` ("scans the seven files of the light API"):
  the files at the top level of `src/live` ARE the light entry; a new member is a decision about
  what a light client loads, not a scan check.
- Every "imports only ..." allow-list of the five files (what a unit may import) and
  `live-testing`'s TS-15 list of app folders: security / architecture boundaries.
- `evidence-verify.test.ts:19` "holds the five files of the unit", `evidence-package.test.ts:101`,
  the counts of `demo-evidence`, `evidence-package`, `sim-demo-data-alignment`: PROTECTED or S3 KEEP.
- `api-registry.test.ts` (97 operations, 67 audit types), `openapi.test.ts`, `api-text-rule.test.ts`
  (35 bodies), `api-examples.test.ts` (87): contract totals, explicit numbers, untouched.

### transcriber T2

`src/__tests__/static.test.ts:60`: `scans the production files of the workspace: the list is
pinned, so an empty scan cannot pass` (26 paths) -> `scans every production file of the workspace:
an independent listing of src finds no file the scan missed, and the files the path rules name are
among them (rule R1)`. The body: the scan's production files equal an independent recursive listing
of `src` (not `walk`, not `isTestFile`), the listing is not empty, and each of the eight files a
path-bound rule names (`CONFIG`, `CPU_LOCAL`, `KEY_LOADER`, `LOG`, `MEDIA_TIME`, `OMLX_HTTP`,
`PHYSICAL_CORES`, `RUNNER`) is in the scan - the second half is new and closes what the list also
gave: a rule tied to a path that no longer exists would pass on nothing. The "at least 12 test
files" assertion stays.

| mutation | expected | result |
|---|---|---|
| a new production file `src/zz-planted.ts` | green (the pin was red on this) | `Tests 111 passed (111)` |
| the scan's filter narrowed (`wav.ts` skipped) | red | `Tests 1 failed | 110 passed (111)`, the R1 case, `- "src/wav.ts"` |

File restored from a copy, `cmp` identical; the planted file removed.

## 6. The 15 exported example constants named by no test

Traced with a throw-away probe (removed) over the real modules:

| constant | reaches an aggregate test? | how |
|---|---|---|
| `IDENTITY_EXAMPLES`, `PAIRING_EXAMPLES`, `SESSION_EXAMPLES`, `EVIDENCE_EXAMPLES`, `DEVICE_EXAMPLES`, `SECURITY_AUDIT_EXAMPLES`, `SYSTEM_EXAMPLES`, `ALERT_EXAMPLES`, `DEMO_EXAMPLES`, `STT_CONFIG_EXAMPLES` (8 + 9 + 14 + 9 + 12 + 6 + 5 + 2 + 5 + 3 = 73 operations) | RESPONSES yes, REQUESTS no | every key is an operation of the registry and `CORE_API_EXAMPLES[key]` is the very same object; `api-examples.test.ts:53` (the 87) and `api-state-examples.test.ts` "the examples of all 97 operations" parse every response example with its schema. The request examples were only checked to EXIST; the two typed-client loops (`api-registry.test.ts:1130`, `client-core.test.ts:123`) send the FIRST one only |
| `ERROR_EXAMPLES` (13 members), `BASIC_403_EXAMPLES` (2) | yes | each member is used by at least one operation's examples, so the response loops parse it and `api-examples.test.ts` checks its request ID |
| `EXAMPLE_SUPERVISOR`, `EXAMPLE_INVESTIGATOR` | yes | the operators of `getAuthSession` `webConsole` / `pairedDevice`: schema loop, and `api-examples.test.ts` "follow the canonical dataset" (`OPERATORS` contains them) |
| `SERVER_EXAMPLE_IDS` (4 ids) | yes | each id is used in examples whose members carry `DEVICE_ID_PATTERN` / `PAIRING_CODE_ID_PATTERN` |

The gap this found: **no test parsed a named request example beyond the first of its operation.**
Added to the existing loop of `api-state-examples.test.ts` ("every operation has an example for
every status with a body, and for no status it does not document"), not as a new test:

1. every named request example of every operation parses with the operation's request-body schema;
2. the key set of `CORE_API_EXAMPLES` equals the registry's operation ids (an example set outside
   the registry would be parsed by no loop);
3. the number of request examples parsed is at least the number of operations with a body.

All request examples of the tree pass. Negative control, run once: the second request example of
`updateSttConfig` corrupted in `src/api/transcription.ts` (`diarization: 'no'`), then
`api-state-examples`, `api-examples`, `api-registry`, `client-core` run:
`Test Files 1 failed | 3 passed (4)`, `Tests 1 failed | 142 passed (143)`,
`AssertionError: updateSttConfig request reference: expected false to be true`. The three files
that existed before stayed green on the corrupt example, which is the gap. File restored from its
copy, `cmp` identical.

## 7. Leak / flake / waits

None in these four workspaces (audit sections 5.1 to 5.5 name none). Nothing changed.

## 8. Not done, and why

- `evidence-m7-one-camera.test.ts` (gate name, inside the PROTECTED evidence globs): no action in
  the audit's table and no file of the same subject to take it; left.
- Homes of the audit's table 3c for shared were not followed (section 3 says why).
- No timing claim: see section 1.
- `sim-capture-config.test.ts` is now 873 lines and `api-domain-operations.test.ts` 851 (the largest
  shared test file is 2,376). Not split further: each group is one subject `describe`.

## 9. Needs a change outside my files

1. PRODUCT comment, one line: `packages/shared/src/sim/selector-in-force.ts:28` names
   `test/sim-wave-l-z-selector-in-force.test.ts`; the file is now `test/sim-selector-in-force.test.ts`.
   Not edited (rule 1).
2. core-web owner: `apps/core-web/src/test/fxr-w-nits.test.tsx:4` names
   `packages/shared/test/fxr-w-nits.test.ts`; W92-20 and W92-24 are now in
   `packages/shared/test/api-closeout.test.ts`.
3. Implementation notes and gate reports under `docs/` name the removed files; they are history and
   were not edited. The table of section 3 is the map.

## 10. Decisions taken (for the controller's log)

1. Homes by subject, five new home files, instead of the import-derived homes of audit 3c.
2. Six files beyond the audit's 19 merged (listed in section 3); one of them,
   `sim-capture-config-sending-device.test.ts`, carried a feature name. "The events' test file" of
   the instruction had no existing counterpart in shared: `sim-sending-device.test.ts` is the one
   file for the sending device on audit rows.
3. Split sources keep ONE test bed in `test/support/` rather than a copy per home.
4. `LIGHT_FILES` kept as an explicit list (an architecture boundary), the two scan lists turned
   into rule R1.
5. Step 3 added assertions to an existing loop; the count did not move.

---
*Generated: 2026-10-11 17:30*
