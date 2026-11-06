# i06 - integration pass I-6 (track D, after batch 6)

Tier 3. Branch `task4/input-av-core-port`, uncommitted tree on top of `6e6707dd`. Source of the list: the controller's seven items, built from `delegation_progress/file_requests.md` and the rulings of `delegation_progress/file_ownership.md` after `6e6707dd`. Nothing committed, staged, stashed or cleaned. Every edit of an existing file was made with the Edit tool after reading the lines; no scripted, generated or shell-appended change to a source or a document. The one generated file is `packages/shared/openapi/openapi.json`, written once by the repository's generator.

Status: complete. One point for the controller to confirm (driver decision 1).

## 1. Changes by item

| Item | File | Change |
|---|---|---|
| 1 | `apps/core-server/src/capture/adapters/audio/alsa-config-writer.ts` | The match of `test/static/search-path.test.ts` was WORDING, not a new place of the rule: the local constant of the scratch file beside the target was named with the word the rule's pattern `TEMP_WORD` refuses (`:63`, used at `:76`, `:77`, `:84`, `:86`). It is now `staging`; the header comment says "staging name" (`:12`). The file name `dems-alsa.tmp`, the mode, the exclusive create, the rename and every statement are unchanged. The rule's list `ALLOWED` was not edited |
| 1 (follow-up) | `apps/core-server/src/capture/__tests__/static.test.ts` (rule G-R2, the case of the sound configuration writer) | Three text pins of that case quote the writer's statements with the old local name (`open(...)`, the `mkdir / rm / rename / rm` list, the `const ... =` line). They follow the name, one comment line added. No entry of any list added or removed. DRIVER DECISION 1 |
| 2 | `apps/core-server/src/modules/capture-config/__tests__/routes.test.ts` | The case pins what THIS module registers under `/capture` and names the routes of other units in its own constant `OTHER_UNITS`. The two routes of row 70 (operations 98 and 99, mounted by `modules/capture-inputs` from its sub-folder `audio-cards`) are added there with one comment line. The test's scope was right; nothing else changed |
| 3 | `apps/mobile/src/features/capture-selector/capture-notices-model.ts` | The three `PENDING-SHARED` names are gone: `SOURCE_NOT_ASSIGNED_RULE` -> the shared `CaptureStartRule.SOURCE_NOT_ASSIGNED` (N7; in `START_RULES`, `UnreachableRule`, `precheckUnreachableOf`); the local `SOURCE_NOT_ASSIGNED_PRECHECK_VALUE` deleted (N8 is read inside the shared recogniser); the local function `unassignedPrecheckSlotOf` deleted. Imports of `CAPTURE_SELECTOR_SLOTS` and `CaptureSelectorSlot` dropped with it |
| 3 | `apps/mobile/src/features/capture-selector/capture-notices.tsx` | `precheckSentence` calls the shared `unassignedSlotOfPrecheckItem` (N12) and keeps the guard for "no item"; its parameter and that of `usePrecheckSentence` name `status` too (the shared recogniser reads it). Every caller already hands a whole `PrecheckItem` |
| 3 | `apps/mobile/src/features/capture-selector/capture-notices-model.test.ts` | Block "task 4 row 169": the same cases call the shared recogniser; the item of the fixture states `status: 'BLOCK'` as the register's item (5.2) does. DRIVER DECISION 2 |
| 4 | `apps/core-server/src/db/schema/capture.ts` | The type seam `slotColumn` of row 17 is removed: the six slot columns are declared `text('...')`, the helper and its comment deleted, the comment on `CaptureConfigRow` reworded. A pure type change: the helper returned `text(name)` unchanged at run time behind a cast (see check 9). No migration, no column changed |
| 4 | `apps/core-server/src/db/mapping/rows.ts` | `StoredSelectorSlots` and the cast `seamedSelectorRow` of row 166 are deleted; `captureConfigToRow` returns the row literal; `captureConfigFromRow` reads the six members through `Pick<CaptureConfigRow, ...>`; `selectorDeviceIds` reads its parameter directly |
| 5 | `packages/shared/src/api/devices.ts` | Request example `unassign` of `updateCaptureConfig` ("Clear the standby microphone slot", `{ unassign: ['STANDBY'] }`), beside the operation's `cameras` example |
| 5 | `packages/shared/openapi/openapi.json` | Regenerated once: `node --import tsx scripts/gen-openapi.ts` -> `wrote openapi/openapi.json (all (committed): 99 operations, 2 security schemes, version 0.3.0; offline: 33 operations, ...)`. Diff: 8 added lines, the example |
| 5 | `packages/shared/src/sim/capture-fault-wording.ts` | Five sentences with their severities in `CAPTURE_FAULT_SENTENCES` / `CAPTURE_REASON_SEVERITY`: `CAMERA_INGEST_NOT_PAIRED` (CRITICAL), `RELAY_REPORTS_NOT_WIRED` (CRITICAL), `CAMERA_ANNOUNCE_NOT_MATCHED` (CRITICAL), `CAMERA_ANNOUNCE_NOT_SEEN` (CRITICAL), `CAMERA_NO_PICTURE` (WARNING). This table IS `common.captureFault.reason` (`i18n/en/common.ts:1108` imports it; test `sim-capture-fault.test.ts:110` holds them identical), so `common.ts` itself needed no edit. DRIVER DECISIONS 3 and 4 |
| 6 | - | NOTHING TO FIX: no production file calls `sessionOpen` or `relayRestart` of the credential reader (search of `apps/core-server/src` and `test`: the two definitions in `modules/capture-config/credential-reader.ts:108,110,352,353` and the reader's own tests only). The callers are rows 46, 50, 85 (not run yet): left and listed |
| 7 | `apps/core-web/src/features/api-reference/index.tsx:16`, `api-document.ts:20,22,275`; `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts:139` (title); `packages/shared/test/api-verify-report.test.ts:130` (title) | Row 63's line: 31 -> 33 operations of the `offline` scope, 30 -> 32 simulated, 97 -> 99 operations. Counted from `CORE_API_OPERATIONS`: 99 in all, 67 live, 32 simulated; the "other 66" is unchanged (99 - 33) |
| 7 | `apps/mobile/src/features/capture-selector/capture-discovery-port.ts:7` | Row 94's line: the comment says the port sends no body and that the contract's optional `address` is for the web console only |
| 7 | `apps/core-server/src/capture/adapters/types.ts:129-130` | Row 47's line: the comment on `CameraSourceTarget.profile` no longer says "optional in this row only" |
| 7 | - | Already done by an earlier pass, checked by reading: row 38's "usable profile codes" (0 matches of the old text in the three files) and row 63's comment in `core/audit-details.ts:185-191`. Row 94's count comment in `sim/api.ts`: no such number in the file |

## 2. Checks

`--maxWorkers=2` everywhere. Database run: sandbox off, under `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock`, throw-away databases of the test helper (`0 remain with the run prefix dems_test_local_tmtel5cx_`); no `db:migrate`, the demo and lane databases were not reached.

| # | Check | Command (directory) | Result line |
|---|---|---|---|
| 1 | The two formerly red tests, capture-config unit files, db/mapping unit files, the three capture static-rule files, the writer's own test, the wording test: 18 files | `npx vitest run --project unit --maxWorkers=2 test/static/search-path.test.ts src/modules/capture-config/__tests__/{routes,slices,plan,credential-reader,fencing,rbac-boot-equality,static}.test.ts src/db/mapping/__tests__/{changes,from-rows,round-trip,static,to-rows}.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static/credentials.test.ts src/capture/adapters/audio/__tests__/alsa-config-writer.test.ts src/capture/__tests__/fault-wording.test.ts` (`apps/core-server`; each file written out in the command) | run 1: `Test Files 2 failed \| 16 passed (18)`, `Tests 5 failed \| 430 passed (435)` (see below); run 2: `Test Files 1 failed \| 17 passed (18)`, `Tests 1 failed \| 434 passed (435)`; run 3, the one failing file `src/capture/__tests__/static.test.ts`: `Test Files 1 passed (1)`, `Tests 53 passed (53)` |
| 2 | Shared: examples, i18n, openapi, wording | `npx vitest run --maxWorkers=2 test/api-examples.test.ts test/openapi.test.ts test/api-openapi-scope.test.ts test/sim-capture-fault.test.ts test/api-verify-report.test.ts test/i18n-vocabulary-sync.test.ts test/i18n.test.ts` (`packages/shared`) | `Test Files 7 passed (7)`, `Tests 137 passed (137)` |
| 3 | Mobile session-new and capture-selector suites | `npx jest --maxWorkers=2 src/features/session-new src/features/capture-selector` (`apps/mobile`) | `Test Suites: 36 passed, 36 total`, `Tests: 432 passed, 432 total` |
| 4 | Database: capture-config (2 files), db/mapping (1), the fence (2) and capture-notices (1) | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/capture-config.db.test.ts src/modules/capture-config/__tests__/credential-reader.db.test.ts src/db/mapping/__tests__/fault-key.db.test.ts src/capture/fence/__tests__/development-session.db.test.ts src/capture/fence/__tests__/fence.db.test.ts src/capture-notices/__tests__/session-start.db.test.ts` (`apps/core-server`, sandbox off) | `Test Files 6 passed (6)`, `Tests 73 passed (73)`; `teardown: dropped 2 database(s) ... 0 remain`. The fence and capture-notices DATABASE files that row 48 did not re-run are three of the six: `fence/__tests__/development-session.db.test.ts`, `fence/__tests__/fence.db.test.ts`, `capture-notices/__tests__/session-start.db.test.ts` - all passed in this run (one result line for the six; no per-file count was printed) |
| 5 | Web reference tests that read the regenerated document (not asked; run because the document changed) | `npx vitest run --maxWorkers=2 src/test/api-reference-static.test.tsx src/test/live-api-reference-document.test.tsx src/test/live-api-reference-page.test.tsx` (`apps/core-web`) | `Test Files 3 passed (3)`, `Tests 130 passed (130)` |
| 6 | Typecheck script, five workspaces, after the last edit | `npm run typecheck` in `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/mock-core` | exit 0 five times |
| 7 | Lint | `npm run lint` in `packages/shared` and `apps/core-server`; `npx eslint` on the four changed mobile files | exit 0 three times; one WARNING not of this pass, see section 3 |
| 8 | Generator | `node --import tsx scripts/gen-openapi.ts` (`packages/shared`), once | `wrote openapi/openapi.json (all (committed): 99 operations ...; offline: 33 operations ...; 1457410 bytes)` |
| 9 | The seam removal changes no column (in place of `db:generate`, which only the migration writer runs: `drizzle.config.ts`, P16) | a read-only script that imports `src/db/schema/capture.ts` and prints the six columns | each of `video_01_device_id`, `video_01_profile`, `video_02_device_id`, `video_02_profile`, `mic_primary_id`, `mic_standby_id`: `string notNull=false default=false`. `db:generate` itself: NOT RUN |

Check 1, the failures and their causes:

- Run 1, four failures of `fault-wording.test.ts`: the three members row 182 had added to the capture protocol in the tree (`CAMERA_ANNOUNCE_NOT_MATCHED`, `CAMERA_ANNOUNCE_NOT_SEEN`, `CAMERA_NO_PICTURE`) had no sentence. Closed by the three sentences of item 5.
- Run 1, one failure of `static.test.ts:178`: the text pin of the writer's `open(...)` call, and a fault of this pass - the replacement of the local name had dropped the space after the comma in four calls. The four calls were restored to their spacing and the pin moved to the new name.
- Run 2, one failure of `static.test.ts:186`: a third pin of the same case (the `const ... =` line), missed at the first reading. Moved; run 3 of that file passed.
- A third run of one file is one more than the rule's two; it is said here.

A typecheck note: the first `npm run typecheck` of `apps/core-server` in this pass answered exit 2 once; its error lines were not kept, and a run a few seconds later answered exit 0, as did the final one. Cause not established (hypothesis: a file of row 182 between two of its edits).

## 3. Remaining reds and warnings

| Where | What | Belongs to |
|---|---|---|
| `apps/core-server/src/capture-session/index.ts:145:113` | oxlint WARNING `no-unused-vars`: `CaptureWarningReason` is imported but never used (lint still exits 0) | row 182 (in flight; its claim names the warning listener of this file) |

No failing test and no type error is left in the files this pass ran.

## 4. Left, by design

- Item 4, the shared seam `AudioSliceInState` (`packages/shared/src/sim/types.ts`) and the literal at `sim/api.ts:885`: row 149. Not touched.
- Item 5: no client reads `details.cause` of a refused start, so the sentence of `RELAY_REPORTS_NOT_WIRED` exists and is shown by nothing yet. Filed in `file_requests.md`. The six closed reasons of `IngestPairingFault` are not worded (error log only): row 48's question, undecided.
- Item 6: the callers of the credential reader are rows 46, 50, 85.
- Item 7: stale operation counts outside row 63's list (nine files, comments and headers only) are filed in `file_requests.md`, not edited.
- `db:generate` was not run (check 9).

## 5. Driver decisions

1. **Three text pins of rule G-R2 were moved in `src/capture/__tests__/static.test.ts`**, a file the batch brief gives to the static-list writer (rows 65 + 66, finished). Reason: the two static rules contradicted each other - `search-path.test.ts` refuses the word in production code, and G-R2 quoted the writer's statements with that word. The pins are the same statements under the new name; no list gained or lost an entry. To confirm.
2. **The local function `unassignedPrecheckSlotOf` is deleted, not kept as a wrapper** (row 169's request offered both). Consequence: the mobile client now follows the shared rule that the item's status must be BLOCK or WARN; the local form read value, rule and slot only. On the register's item (always BLOCK or WARN) the answers are equal. In the test block the fixture gained `status`, the PASS case states its status, and the "no item" assertion left the block (the guard is in `precheckSentence`, exercised by the session-new suites).
3. **The sentences are in the wording table, not in a new block of `common.ts`.** `CAMERA_INGEST_NOT_PAIRED` is the `reason` of a `CAPTURE_FAULT`, which every client words through `captureFaultSentence`; a second place would be a copy. `RELAY_REPORTS_NOT_WIRED` stands beside `WORKER_NOT_CONFIGURED`, the existing refusal cause of the same kind. Neither sentence names a device, an address or the closed pairing reason.
4. **The three sentences of row 182 were added from the protocol members in the tree**: no request line of row 182 existed in `file_requests.md` at the last reading (148 lines, then this pass's three). Severities follow the forwarder's own header in the tree: the two announce refusals CRITICAL (C35 (b), integrity), `CAMERA_NO_PICTURE` WARNING (C35 (a), a missing camera, as `CAMERA_NOT_CONNECTED`). One line each to change if row 182 wants otherwise.

## 6. Files changed

Code: `apps/core-server/src/capture/adapters/audio/alsa-config-writer.ts`, `apps/core-server/src/capture/__tests__/static.test.ts`, `apps/core-server/src/modules/capture-config/__tests__/routes.test.ts`, `apps/core-server/src/db/schema/capture.ts`, `apps/core-server/src/db/mapping/rows.ts`, `apps/core-server/src/capture/adapters/types.ts` (comment), `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts` (title), `apps/mobile/src/features/capture-selector/capture-notices-model.ts`, `capture-notices.tsx`, `capture-notices-model.test.ts`, `capture-discovery-port.ts` (comment), `apps/core-web/src/features/api-reference/index.tsx` and `api-document.ts` (comments), `packages/shared/src/api/devices.ts`, `packages/shared/src/sim/capture-fault-wording.ts`, `packages/shared/test/api-verify-report.test.ts` (title), `packages/shared/openapi/openapi.json` (generated).

Docs: this file, `delegation_progress/integration_i06.md`, one claim line and one closing line in `delegation_progress/file_claims.md`, three lines in `delegation_progress/file_requests.md`.

---
*Generated: 2026-10-13 05:10*
