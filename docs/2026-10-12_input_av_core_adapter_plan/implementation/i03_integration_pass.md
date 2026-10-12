---
task_id: 2026-10-12_input_av_core_adapter_plan
row: integration pass I-3 (track D)
date: 2026-10-13
agent: coder-execution
tier: T3
status: needs-review (every item of the fixed list built; one red left that belongs to row 177; six driver decisions to confirm, DD-1 first)
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Integration pass I-3 - the remainders of rows 21, 45, 47, 54, 55, 64, 77, 180

Paths are relative to the repository root. `CS` = `apps/core-server`. Every edit of an existing file was made with the Edit tool after reading the lines; no scripted replace. The one new source file and the two records were written with the Write tool (they did not exist). Claims: `delegation_progress/file_claims.md`, the two lines "integration I-3".

## 1. What was done, by item of the fixed list

| # | Item | Change | Where |
|--:|---|---|---|
| 1 | Fence test: the three address pins | The plan's pin compares the stated prefix `rtsp://127.0.0.1:<port>/<session>/<track>` and holds the last element by form (`^[A-Za-z0-9_-]{22}$`, the two tracks differ); the two helper pins compare with the address of the worker's own `START` frame, byte for byte, and count one loopback address per helper. No literal element anywhere. Also DD-2 | `CS/src/capture/fence/__tests__/development-session.db.test.ts:277-286, 296-309` |
| 2 | The production window reaches the worker | `const operation = captureOperationOf(app.config)` read once; the launcher line passes `operation === CaptureOperation.REAL_PRODUCTION`; the export line of `./worker-arguments` gains `CAPTURE_WORKER_PRODUCTION_SETTINGS`, `PRODUCTION_INGEST_OPEN_WINDOW_MS`. One new case in the unit test of the file | `CS/src/capture/index.ts:64, 150-151, 170-171`; `CS/src/capture/__tests__/module.test.ts` (last case) |
| 3 | The address function in a neutral unit | New `CS/src/capture/ingest-address.ts`: `captureIngestAddress(sessionId, trackId, chance)`, `CAPTURE_INGEST_PORT`, `CAPTURE_INGEST_SECRET_BYTES`, `CAPTURE_INGEST_CHANCE_REFUSED`, two types. It imports nothing. Exported by `export * from './ingest-address'`. The session file loses the function and its two constants, imports the function through the capture index and hands in `randomBytes`. Row 47's test follows (section 3). NO static list edited (DD-1) | `CS/src/capture/ingest-address.ts`; `CS/src/capture/index.ts:65-66`; `CS/src/capture-session/index.ts:89, 131, 180-184, 1188`; `CS/src/capture-session/__tests__/ingest-address.test.ts` |
| 4 | The loader reads the two keys | `captureRelayPath`, `captureGuardPath` parsed from `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD` and handed to `createConfig`; two cases in the loader's test. Path rule: section 4 | `CS/src/plugins/config/load-config.ts`; `CS/src/plugins/config/__tests__/load-config.test.ts` |
| 5 | Camera format with an absent rate | Mobile live chip: `cameraFormatNoRate` when `fps === null`. Web: dashboard tile chip and Inputs panel line use `cameraFormatNoRate`; the drawer's Format fact uses `cameraFormatCodecNoRate`. The `realCapture` branches are unchanged. One case each. `session-new/devices-step.tsx:433` left as it is | `apps/mobile/src/features/session-live/live-feed.tsx:216-219`; `apps/core-web/src/features/dashboard/devices-panel.tsx:323-324`; `.../session-monitor/inputs-panel.tsx:80-85`; `.../devices/device-drawer.tsx:237-245`; tests: `connecting-meters.test.tsx`, `dashboard.test.tsx`, `session-monitor.test.tsx`, `devices-page.test.tsx` |
| 6 | Seed helper: the `kill` guard | One closure `signalChild`: `if (!over && started.pid !== undefined) started.kill('SIGKILL')`, used by the exit handler and by the time limit. One spy case (no real signal can leave it) | `CS/src/db/seed/demo-helper.ts:74-84`; `CS/src/db/seed/__tests__/demo-helper.test.ts` (last block) |
| 7 | Exports | The adapter barrel exports the production door (7 values, 6 types: row 21's list) and the card listing (7 values, 4 types of `card-listing`; 2 values of `card-listing-reader`: row 64's list). `core/index.ts` exports `CAPTURE_CREDENTIAL_REVEAL_REASONS` and its type. No exact export-list pin exists for either index (the targeted runs name none) | `CS/src/capture/adapters/index.ts`; `CS/src/core/index.ts:65` |
| 8 | Host profile: PostgreSQL items | Section 3.10 with HOST-50 to HOST-56 in the document's five columns, each Confirm cell "to confirm on the host"; the first line of "Outside this profile" changed. The test: the document holds 49 + 7 items; the seven are held by id, by their Confirm text and by number against the printed steps (DD-5) | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`; `scripts/host/test_host_profile_scripts.sh` |

## 2. Item 3 against the static rules (read before the file was written)

| Rule | What it says of a new file under `CS/src/capture/` | How the unit meets it |
|---|---|---|
| G-R8, chance (`capture/__tests__/static.test.ts:268-272`) | no file but the signer's key file imports the cryptography module or names `Math.random`, `randomUUID`, `getRandomValues` | the unit imports nothing; the caller hands in the function that draws |
| G-R4, shapes (`:220-222`) | no file of the folder holds the text of an RTSP address | the address is composed from `INGEST_SCHEME` and `INGEST_HOST`, the form `adapters/credential.ts:111` already uses for a camera locator (DD-3) |
| G-R4, the file that logs (`:214-218`) | `capture/index.ts` names no plan, address member, credential, password or the like | the two export lines and their comment name none; the run is green |
| A-5, `test/static/imports.test.ts` | the session reaches the capture unit through its index only | `export *` in the index; the session imports from `../capture` |
| SR-1 to SR-4 (`decisions/003_amendment_rows.md`) | admit the door, the ALSA writer, the card reader, one unicast destination, a second ONVIF importer, the `alsa` format | none admits a second source of chance: no list entry was possible, none was made |

## 3. Row 47's test after the move (`capture-session/__tests__/ingest-address.test.ts`, 11 cases as before)

- It imports the function from `capture/ingest-address` and calls it with `randomBytes`, as the session does.
- "the source of the element": `randomBytes` stands in the session at its import and at the one call, nowhere else; the unit has no import and asks `chance` once for 16 bytes; the element is exactly the drawn bytes; a draw of 0, 1, 15, 17 or 32 bytes, or a text, builds no address.
- "ONE function builds": no production source writes an RTSP address as text; exactly two compose one from a scheme constant (`capture/adapters/credential.ts`, a camera locator; the unit); the builder line is pinned; the function has one call in the server.
- The closed list of sources that name `ingestUrl` is unchanged (the unit does not name the member).

## 4. Item 4: the path rule, as asked

The loader applies no rule generically: it calls `parseCapturePath(<key>, <value>)` once per program key (`DEMS_CAPTURE_WORKER`, `DEMS_MEDIA_DIR`, `DEMS_CAPTURE_HELPER_FFMPEG`). The two new keys use the same call, as row 21's request wrote it. That function is the whole rule of the existing keys at this level (absolute, no NUL; unset or empty is null), and `createConfig` already applied it to both members (`CS/src/config.ts:402-403`); the loader's own call makes the refusal come before any file is opened. NOT built: any check of the file itself (owner, mode, private directories) - that is the boot checks' rule for the worker and the helper, and no row of this pass.

## 5. Checks (this Mac; one run each, a second only after a failure)

| Check | Command | Result |
|---|---|---|
| Typecheck, five workspaces | `npm run typecheck` in `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/mock-core` | exit 0 each, no `error TS` line |
| Core unit: touched files, the three static-rule files, all of `test/static/`, capture-config static and reader | `npx vitest run --project unit --maxWorkers=2` on 26 files | `Test Files 1 failed | 25 passed (26)`, `Tests 3 failed | 371 passed (374)`; the failed file is `tidy-fy.test.ts`, section 6 |
| Core unit: session, adapter barrel, card listing, core, notices | same runner on 5 folders | `Test Files 22 passed (22)`, `Tests 425 passed (425)` |
| Database: capture-session tests and the fence test of item 1 (lock `.locks/db-migrate.lock`, sandbox off, throw-away databases) | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__ src/capture/fence/__tests__/development-session.db.test.ts` | run 1: `Test Files 1 failed | 1 passed (2)`, `Tests 2 failed | 62 passed (64)`: `session-capture.db.test.ts` 59 of 59; the fence file failed at the helper ORDER (DD-2), its address pins passed. After the fix, the fence file alone: `Test Files 1 passed (1)`, `Tests 5 passed (5)`; `0 remain` each time |
| Row 47's test after a lint fix | the one file | `Tests 11 passed (11)` |
| Core web, three files | `npx vitest run --maxWorkers=2` | `Test Files 3 passed (3)`, `Tests 56 passed (56)` |
| Mobile, one file | `npx jest src/features/session-live/connecting-meters.test.tsx --maxWorkers=2` | `Tests: 12 passed, 12 total` |
| Host profile scripts | `bash scripts/host/test_host_profile_scripts.sh` | `RESULT: 171 passed, 0 failed` (167 before; shellcheck not installed: skipped, as before) |
| Lint of the changed files | `npx oxlint <files>` in the three workspaces | one warning in row 47's test (fixed); one warning at `connecting-meters.test.tsx:137`, a line this pass did not write |
| Secret-scan needles on the touched trees | `node scripts/secret-scan/count-only.mjs apps/core-server/src apps/core-server/test apps/core-web/src apps/mobile/src scripts/host` | `ingest-secret: 0`; no file of this pass among the hits |

Not run: `npm test`, `npm run test:db`, any worker, relay, scenario suite or emulator.

Doubles and what stays unproven: item 2 is shown by the source pin of the launcher line and by the builder's answer per operation, not by a started production worker (row 90, `9A/H-21`). Item 6 is shown with the signal calls replaced by spies. Item 8 is a document: none of the seven items has run on any host.

## 6. Remaining reds

| Red | File:line | Belongs to |
|---|---|---|
| 3 cases of `CS/src/capture/__tests__/tidy-fy.test.ts` (`:122` "HELLO names the release word"; the stub-process case; "every start path ... the SAME number") | cause: `CS/test/support/capture-stub-worker.mjs:77` still says `capture-worker/0.5.0` while `CS/src/capture/boot/checks.ts:285` is `0.6.0` | row 177 (its own request line in `file_requests.md`, five pins). The launcher pin of that file (`:272`) holds: checked by hand against the source (`1` launcher call, pattern matches) |

By row 177's line the same cause fails 11 cases of `ipc.test.ts` and one each of `fault-lifecycle.test.ts`, `boot.test.ts`, `modules/system/__tests__/routes.test.ts`; not run here.

## 7. DRIVER DECISIONS (for the controller to confirm)

1. **DD-1: the address function takes its source of chance as a parameter.** Rule G-R8 and SR-1 to SR-4 leave no way to import the cryptography module in a new file under `CS/src/capture/`, so the unit imports nothing and no list moved. Consequence for row 179: the supervisor needs a source of chance handed in (request line filed, blocking for its design).
2. **DD-2: the fence test names each camera helper by the listener it pushes to (8554, 8556), not by start order.** Beyond the three pins, same test file: since row 47 opens the cameras in the same turn the first helper started was the generated source, and the positional `[local, generated]` failed (measured, run 1).
3. **DD-3: the address is composed from a scheme constant**, so the text of an RTSP address stands in no file of the capture folder (G-R4 unchanged). Row 47's test was widened to find that form and now lists `adapters/credential.ts` beside the unit as the two composers.
4. **DD-4: a refusal `CAPTURE_INGEST_CHANCE_REFUSED`** for a draw that is not exactly 16 bytes: the unit can no longer see where the bytes come from, so it holds their number.
5. **DD-5: `95-database.sh` was not edited (not in the list).** It still prints DB-01 to DB-07; the document says DB-0n is HOST-5n; the test counts 49 script items plus 7 document items instead of "49 -> 56". Request line filed for the script's header and ids.
6. **DD-6: item 2 uses the inline comparison of row 47's request** (`operation === CaptureOperation.REAL_PRODUCTION`), with the operation read once into a constant; its test is a source pin plus the builder's answer for each of the three operations.

Smaller: the new unit declares its own track type (`'VIDEO-01' | 'VIDEO-02'`) rather than importing the recording module's; the barrel still exports `startMessageBytes` (row 21's optional removal not taken).

## 8. Requests closed (file not edited) and left

Closed in `delegation_progress/file_requests.md`: row 21's loader line and barrel line; row 64's barrel line; row 45's `core/index.ts` line; row 47's fence-test line, `capture/index.ts` line and way (2) of its row-179 line; row 54's three-readers line; row 55's live-feed line; row 180's seed-helper line; row 77's profile-document line (document half).

Left, three new lines "integration I-3": row 179's source of chance; `95-database.sh` header and ids; the optional typing of the credential reader's table.

---
*Generated: 2026-10-13*
