---
task_slug: input_av_core_adapter_plan
pass: I-7 (blueprint section 8.4; decisions C43, C46)
date: 2026-10-13
agent: coder-execution (integration pass, sole code writer outside apps/capture-worker while it ran)
tier: T3
status: needs-review
---

# Integration pass I-7

Status is `needs-review` for two reasons, both stated in section 5: one edit outside the literal list (`db/mapping/rows.ts`, one line, DD-1) and one finding that can turn the database suite red (the clone limit, section 4).

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `SH` = `packages/shared`. Every existing file was changed with the Edit tool only; no scripted replace, no shell append. Nothing was committed, staged, stashed or cleaned. Nothing under `apps/capture-worker/` or `apps/input-av/` was opened for writing; no schema file, no migration, no fence source file was edited.

## 1. The eight items

| # | Item | Result | Where |
|---|---|---|---|
| 1 | Schema pins `[7, 'dbc-8']` -> `[8, 'dbc-9']` | NOTHING LEFT TO MOVE. Both named lines already read `[8, 'dbc-9']` (agent D moved them; row 99 record section 4). Search of `apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/mock-core`, `packages`, `scripts`, `README.md` for `dbc-8`, `[7, 'dbc`, `schemaVersion: 7`, `schema_version: 7`: every hit is a per-set history file (`test/db/set8.db.test.ts`, `set9.db.test.ts`, `contract-v7-delta.ts`, `contract-inventory.ts` comments, migration `0016`, schema comments). Both files pass (section 3) | `CS/src/capture/fence/__tests__/fence.db.test.ts:114`, `CS/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts:159` |
| 2a | C43 (2): acceptance on the real registrar | DONE. `registrar: standInRegistrar` and its import are out; the block registers through the product's registrar, reads operation 77 after the registration (pair, then the registered microphone, once, capability `AUDIO`, adapter `USB_AUDIO`); AC-B-70 keeps the pair rule for every list of audio and holds the device registry of operation 77 to its own rule (pair first, then `MIC-NN` in rising number, none twice), must have seen the registry with AND without a registered microphone, and carries a control of the rule (3 accepted, 7 refused forms) | `CS/test/acceptance/contract.test.ts` (import line 77; the sound-card block; the AC-B-70 case) |
| 2b | C43 (3): capability `AUDIO` | DONE, with one line outside the list (DD-1). The action states `['AUDIO']`; the row mapping reads it back for a `USB_AUDIO` microphone. NO REGISTRY RULE FORBIDS IT: the registry table has no capability column (the rule row 185 DD-4 named), which is why the read-back had to follow - the precedent is `ADOPTED_CAMERA_CAPABILITIES` for an adopted camera | `SH/src/sim/capture-registry.ts` (the action), `CS/src/db/mapping/rows.ts` (read-back, 1 line + 2 constants); expectations: `SH/test/sim-capture-discovery.test.ts`, `CS/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` (:98 stand-in entry, :331, :483-484), new case in `CS/src/db/mapping/__tests__/from-rows.test.ts` |
| 3 | `adapters/types.ts` | `sourceFacts?(inputId)` declared on `AudioInputAdapter` with the type `AudioSourceStatement` (eight `unknown` members). `CameraSourceTarget.attempt` and `.sessionId` EXIST since row 46: verified, not duplicated. The session's one target line now fills both: `{ ingestUrl: address, sessionId, attempt: current.supervisor.status().attempt, ... }` (the supervisor steps `attempt` BEFORE it tells the session the addresses of a later worker, `CS/src/capture/supervisor.ts` `launch`, so the attempt read at the open is the one the address in force belongs to). NOT DONE: the fence's `AudioCardStatement` was not moved or re-exported (fence source files are closed to this pass) - request line filed | `CS/src/capture/adapters/types.ts`, `CS/src/capture-session/index.ts` (1 line), pin `CS/src/capture-session/__tests__/ingest-address.test.ts` (2 places) |
| 4 | Static lists | A-9: `audio/mic-loss` added to `BUILT` with a planted importer. Row-81 pin: NOT MOVED, and correctly so - `boot/index.ts` re-EXPORTS `hostCommandRunnerOver` and CALLS it nowhere (`grep hostCommandRunnerOver src`: definition in `host-checks.ts:59`, export in `boot/index.ts:96`), so `toEqual([HOST_CHECKS])` is true today; it moves with the change that makes the entry point hand in host facts (C46, row 85). Requests SC and B refused: untouched | `CS/src/capture/adapters/__tests__/static.test.ts` (A-9), `CS/src/capture/__tests__/static.test.ts:1338` (read only) |
| 5 | The three named reds | ALL THREE ARE GREEN in the tree as found, before any edit of this pass: `test/static/log-calls.test.ts:163`, `test/static/search-path.test.ts:94`, adapters `static.test.ts:313` (first run of section 3: 18 files, 260 passed). Two were closed by their owner (row 50's line in `file_requests.md`: the log member is `relayWord`, `stream-probe.ts` says HEVC). HOW the third went green was NOT traced: `search-path.test.ts` names neither migration `0018` nor `alsa-config-writer.ts` in a list today, so its owner closed it another way (the source wording, by the rule of that test); only the result was measured. Nothing edited | - |
| 6 | `otherMicInput` | Mobile: DELETED with its test block (no caller: search of `apps/` and `packages/` finds the function and its own test only). Web: KEPT - `apps/core-web/src/features/session-monitor/audio-source.ts:177` calls it (`selectStandbyInputId`), and `features/devices/__tests__/mic-input-name.test.tsx:66` tests it. `packages/shared` holds no function of that name | `apps/mobile/src/features/capture-selector/mic-input-name.ts`, `mic-input-name.test.ts` |
| 7 | ONVIF time-read facade | BUILT: `createOnvifTimeReader(options)` / `OnvifTimeReader.read(candidate, signal) -> { answered, cameraUtcMs }` - the shape of `CameraTimeReader` of `camera-watch.ts`. One `GetSystemDateAndTime` through the file's own `exchange` (same agent, bounds, address rule `targetOf`), credential `null` by a literal. Wired NOWHERE (row 85). Static pin of the export list moved by the two names, plus three assertions (the frozen `{ read }`, the literal `null`, the two-parameter signature). Six unit cases against the fake ONVIF stub and the scripted device | `CS/src/capture/adapters/camera/onvif-session.ts`, `__tests__/onvif-session.test.ts`, `CS/src/capture/__tests__/static.test.ts` (rule "the client never leaves the file") |
| 8 | i18n of row 187 | Two sentences in a new group `common.captureSlotRefusal`, keyed by the word of `details.reason` (the form of `captureAudioCards.refusal`). Not in `common.captureFault.reason`: that table is the wording of a capture FAULT and each entry needs a severity; these are refusals of a selector edit. Not in `common.captureSlot`: its key list is pinned exactly to the four slots and three words (`SH/test/i18n.test.ts`). One new test case pins the keys and the rule "no default is promised". No count pin moved; `openapi.json` not regenerated (no schema changed; the drift test passes) | `SH/src/i18n/en/common.ts`, `SH/test/i18n.test.ts` |

Blueprint 8.4 item 8 (the guard's invocation form): row 23 answered in `file_requests.md` - the form is the one row 67 assumed, `guardedArguments` needs no change. Nothing edited.

## 2. The time read, exactly

| Device does | `answered` | `cameraUtcMs` | Requests that reached it |
|---|---|---|---|
| answers its clock with a `UTCDateTime` element | true | that instant, whole seconds | 1, nothing offered |
| keeps the clock behind authentication (401 Digest; or a fault "not authorized") | true | null | `GetSystemDateAndTime` only, none with a header or a token |
| answers with no instant, a local time only, a UTC element that is no date, the element name only inside a text | (not pinned) | null | 1 |
| no ONVIF answer (HTML), a closed port, silence until the caller's deadline, an endless body (byte cap) | false | null | - |
| signal already aborted / candidate that may not be contacted | rejects `CAPTURE_ADAPTER_ABORTED` / `CAPTURE_LOCATOR_INVALID` | - | 0 |

Why the `UTCDateTime` test: package `onvif` 0.8.3 (`node_modules/onvif/lib/cam.js:547-556`) answers `new Date()` - the Core's own clock - for an answer without an instant and reads `localDateTime` as UTC when no UTC element stands; either would state a false offset. The raw answer is tested for that one element name and dropped.

Why the refusal is read from the answer: the package repeats a refused clock read by itself and then reports an error of its own (`cam.js:578-600`), in which the device's refusal is lost; the facade reads it by the fixed words `failureOf` already reads a fault by.

## 3. Checks (one run each; a second only where a first failed)

| Check | Command (from `CS` unless said) | Result |
|---|---|---|
| The three static files and `test/static`, tree as found | `npx vitest run --project unit --maxWorkers=2 test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` | `Test Files 18 passed (18)`, `Tests 260 passed (260)` |
| Unit: static files again after the edits, ingest-address, db/mapping, fixtures build, capture-config static and slices, capture-inputs, hosted-actions, fault-wording, adapters/audio, fence unit, open-sources | same command with those paths | `Test Files 39 passed (39)`, `Tests 942 passed (942)` |
| Unit on loopback (sandbox off, heavy-host lock): `src/capture/adapters/camera`, `src/capture-session` | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock ... npx vitest run --project unit --maxWorkers=2 ...` | `Test Files 13 passed (13)`, `Tests 263 passed (263)` |
| Shared: registry action, i18n, vocabulary sync, openapi (no drift), openapi scope, bindings, domain operations | from `SH`: `npx vitest run --maxWorkers=2 test/sim-capture-discovery.test.ts test/i18n.test.ts test/i18n-vocabulary-sync.test.ts test/openapi.test.ts test/api-openapi-scope.test.ts test/live-source-bindings.test.ts test/api-domain-operations.test.ts` | `Test Files 7 passed (7)`, `Tests 277 passed (277)` |
| Mobile: the microphone name file | from `apps/mobile`: `npx jest --maxWorkers=2 src/features/capture-selector/mic-input-name.test.ts` | `Tests: 5 passed, 5 total` |
| The two acceptance files, alone (sandbox off, `.locks/db-migrate.lock`, throw-away databases) | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Test Files 2 passed (2)`, `Tests 78 passed (78)`; `0 remain` |
| Database, first run of seven files together | fence.db, audio-cards routes.db, session-capture.db, bulk-fixture.db, the two device-upsert files, write-through.db | `Test Files 3 failed | 4 passed (7)`, `Tests 30 failed | 161 passed (191)`: 1 = this pass's own pin (`routes.db.test.ts:483-484` still said `[]`; moved), 29 = the clone limit (section 4) |
| Database, second run, each of the three failed files alone | the same command per file | routes.db `17 passed (17)`; fence.db `42 passed (42)`; session-capture.db `86 passed (86)`; `0 remain` each |
| Typecheck | `npm run -s typecheck` in `SH`, `CS` (twice: after the edits and at the end), `apps/core-web`, `apps/mobile`, `apps/mock-core` | exit 0, all five |
| Lint of the touched files | `npx oxlint <files>` in `CS` and `SH`; `npx eslint` on the two mobile files | exit 0 |

No demo or lane database was touched; no `db:migrate` was run. No real camera, microphone or host address was contacted: every candidate of the new cases is `127.0.0.1` on the fixture ports.

## 4. Remaining reds and findings

| # | What | File:line | Belongs to |
|---|---|---|---|
| R-1 | NO test is red in the tree after this pass, in the files run. | - | - |
| F-1 | THE CLONE LIMIT. In one run of seven database files, 29 cases failed with `DbTestHelperError: 99 databases of the run ... exist at the same time` and nothing else; each file alone passes. Cause not traced further (hypothesis: both files hold a clone per case until the file ends). The database project runs two files side by side (`vitest.config.ts`, `maxWorkers: 2`), so the suite run of the commit can meet it | `CS/test/helpers/db/names.ts:186`; `CS/src/capture/fence/__tests__/fence.db.test.ts` (4 cases), `CS/src/capture-session/__tests__/session-capture.db.test.ts` (25 cases) | row 33 (fence file, +26 cases); rows 71 / 188 (session file); or the helper's limit - controller |
| F-2 | The ONVIF time has ONE-SECOND resolution: the offset the watch computes is exact to 1 s against a 2,000 ms bound | `CS/src/capture/adapters/camera/onvif-session.ts` (`OnvifTimeReader`) | row 85 (wiring), hardware check `9A/H-09` |
| F-3 | "Answered" is as weak as step 1 of the connection test: anything at the address that challenges or says "not authorized" counts as present | same | row 85; `9A/H-10` |
| F-4 | The same eight members are stated three times (`AudioSourceStatement` in `adapters/types.ts`, `AudioCardStatement` in `fence/sources.ts`, `UsbAudioSourceStatement` in `usb-audio-production.ts`) | - | a pass that may edit fence sources (request filed) |
| F-5 | No client reads the two new sentences; no test holds the server's two words equal to the keys | `apps/core-web/src/features/devices/capture-selector.ts:295`, `apps/mobile/src/features/capture-selector/capture-selector-model.ts:360` | the selector client rows after row 187 |
| F-6 | Agent SC's two A-9 entries (`camera/camera-watch`, `camera/onvif-network`) are not in the list | `CS/src/capture/adapters/__tests__/static.test.ts` (A-9 `BUILT`) | the static-adapters writer of the next pass |

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | ONE LINE OUTSIDE THE LIST: `CS/src/db/mapping/rows.ts` reads `['AUDIO']` back for a microphone of adapter kind `USB_AUDIO` (two constants beside `ADOPTED_CAMERA_CAPABILITIES`) | Without it the capability the action states is lost at the first restart (the registry has no capability column; row 185 DD-4 said so), and C43 (3) would be true until a restart only. No schema, no migration. The two `USB_AUDIO` microphones of the bulk fixture now read back with `AUDIO` too; no test pins their capability (bulk-fixture.db, device-upsert x2, write-through.db, fixtures build: all green) |
| DD-2 | The stand-in adapter entry of `routes.db.test.ts:98` states `['AUDIO']` | Blueprint 8.4 item 3 names the line; every adapter of class MIC states it (`fake/audio.ts:53`, `local/mic-adapter.ts:85`, `fence/generated-sources.ts:180`) |
| DD-3 | AC-B-70: the device registry has its own rule instead of an exemption | An exemption (row 190's proposal) would let any list through; the rule still refuses a missing or swapped pair, a repeat and a foreign id, and has a control |
| DD-4 | `AudioSourceStatement` is declared in `types.ts` under a NEW name; the fence's type is left | The brief closes fence source files; the same name in two files would read as one declaration |
| DD-5 | The time read hands out an instant only for an answer with a `UTCDateTime` element, and reads a refusal from the answer text | Section 2: the package's two fallbacks would state a false offset; its own repeat loses the refusal |
| DD-6 | The sentences of row 187 are a new group `common.captureSlotRefusal` | Section 1 item 8 |
| DD-7 | A planted control line was added to rule A-9 for the new entry | Row 67's entry was asked "with a planted control"; the same form |
| DD-8 | The pin of `routes.db.test.ts:483-484` (the same microphone, a second place) was moved although the brief names :98 and :331 only | The same expectation, found by the run |

## 6. Doubles, and what stays unproven

The fake ONVIF stub and the scripted device on `127.0.0.1`; throw-away PostgreSQL databases; a SIMULATED Core with an enumerator over fixed listing texts in the acceptance file. Unproven: the time read against a real camera (whether it answers without a login, which instant it names: `9A/H-09`, `9A/H-10`) and over TLS (the stub speaks none); the target's `attempt` and `sessionId` on a production adapter with a real supervisor (no production adapter is registered: rows 85, 89); a registered microphone on a real card (`9A/H-07`).

---
*Generated: 2026-10-13*
