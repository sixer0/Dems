---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: integration pass D11 — the seams passes D9 / D10 left open (decision D164)
date: 2026-10-10
agent: coder-execution (single driver; rules D94 / D122 / D163, ownership D95 §9)
source_plan: implementation/104_integration_pass_d10.md (items 2, 5, its two findings, its request lines of 17:57:17Z)
narrative_tier: 3
status: needs-review — 8 of 8 items done; one deviation from the brief's wording in item 1 (D11-1), one contract gap decided in item 4 (D11-3)
---

# 105 — Integration pass D11

Baseline `e296ce7` plus the wave D tree. No commit. No migration (schema `[5, 'dbc-6']`, asserted by
the db files run). No local device was selected, pre-checked or started; the attended variables
were not set. Paths: `C` = `apps/core-server/`, `S` = `packages/shared/`, `M` = `apps/mobile/src/`.

## 1. Per item

| # | Status | What (file:line) |
|---|---|---|
| 1 | done | Door `applyCaptureSourceFacts` beside the seam: `C/src/engine/fact-doors.ts:13,36,40`; host, four own blocks marked "Source-fact block": import `host.ts:75`, the held list `:308`, the door `:1226`, and `:951` in the rehydrate — the host applies the list it last took to every state it reads back INSIDE the process (reset, reload, resync), and drops it at a process start. Caller: NEW `C/src/modules/devices/source-facts.ts` (`mountCaptureSourceFacts` `:99`, boot step `devices.sourceFacts` `:136`, added in `onReady` so that it runs after `capture.fence`). Class: every CAMERA / MIC the registry of the running operation lists, with its kind — the built-ins read `FAKE` / `DEVELOPMENT` in REAL_DEVELOPMENT, nothing in REAL_PRODUCTION (its registry lists none), and SIMULATED never calls the door. `sourceOpen`: see D11-1. Both `it.fails` of row 140 are plain cases |
| 2 | done | NEW `C/src/modules/transcripts/heads.ts`: boot step `transcripts.heads` (`:91`, registered after the engine's) reads the newest revision number per item (`statements.ts:67`), reads the state of the sealed document of the item's package, and hands both to pass D6's door (`publishRevisionHeads` `:48`). Never refuses the start; a head that cannot be published is logged + persisted (`TRANSCRIPT_HEAD_NOT_PUBLISHED_AT_BOOT`), never guessed |
| 3 | done | `C/src/engine/errors.ts:117` (the one line). The op 26 text lost its first four words (`S/src/api/core-api.ts:853`); OpenAPI regenerated under `npm.lock`: one line differs, 97 operations / offline 31 |
| 4 | done | `C/src/modules/demo/reset.ts:304` step 1b: the caller-side guard (`findRealSealedEvidence` on the server's own pool, `host.ts:86`) is asked BEFORE the routine. Refused: no hold, no engine stop, no pool reopen, epoch unchanged, `409 RESET_BLOCKED_REAL_EVIDENCE`, one audit row (`host.ts:87`, D11-3). A guard that cannot be asked: `503` `RESET_FAILED`, nothing stopped. A permitted reset is unchanged. The 409 after the routine's own refusal at R-3 is kept (evidence sealed between the two looks) |
| 5 | done | `S/src/sim/api.ts:342` (`toApiSession`) + the member on `ApiSession`. The Core's `modules/sessions/current.ts` uses that function, so no Core line changed |
| 6 | done | `M/runtime/live-no-raw-fetch.test.tsx`: rule 3 allows ONE line by its exact text (the media transport object) and requires its header to stay non-enumerable; a planted `fetch(` in that file, a fourth use of the address, and an enumerable header each fail. `M/runtime/link-notice-static.test.ts`: C1 allows the camera chip by file AND shape (the two strip files, the quoted literal, no link word on the line; five lines pinned). The chip stays where it is: it is a camera state taken from `captureDurable`, not the link's transient |
| 7 | done | `C/src/capture/fence/__tests__/development-session.db.test.ts`: the worker's warning raises the NAMED advisory alert on `MIC-03` (target, INFO, text, device, session) with no capture fault; said twice = one alert; CLEARED resolves it; the audio source is equal before and after and the worker got no `SWITCH_AUDIO_SOURCE`. Controls: the same warning without the reason IS a capture fault; the notice for a camera is refused |
| 8 | done | `C/src/engine/__tests__/capture-actions.db.test.ts`, the fixture of the real boot. Two causes, in boot order: (a) the seed's STT row is enabled with `cpu-local` (`db/seed/seed.ts` `STT_CONFIG_SEED_DEFAULT`) and the fixture states no speech runtime → `transcriber.config` refused `CPU_LOCAL_RUNTIME_MISSING`; (b) behind it, the seed's selector assigns the four FAKE built-ins and the fixture had no development flag → `capture.fence` refused `DEV_SOURCE_WITHOUT_FLAG`. Now: STT disabled in the clone (as the other real-mode fixtures) and the boot is REAL_DEVELOPMENT with helper `/bin/echo`. A-4 asserts what it always did: the meters of a recording read NO SIGNAL without a fresh telemetry frame in capture mode real, the frame's levels while fresh, and generated levels in simulated mode |

## 2. Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| typecheck + lint core-server, shared; typecheck mobile; eslint of the two mobile files | 0 errors each |
| Core unit: `src/engine`, `modules/{devices,demo,sessions,transcripts}`, `test/static`, capture static | 44 files, 881 tests, green |
| Core db (lock), item 1 + 7: `source-class.db`, `development-session.db` | 10 of 10 (run again after the feed's last change: 10 of 10) |
| Core db, item 2: `transcript-routes.db` | my 3 new cases green; 5 older cases red, foreign (§3) |
| Core db, items 3 + 5: `sessions/operations.db` | green |
| Core db, item 4: `demo/reset-failures.db` (15), `demo/reset.db` | green (first run of my new case failed on my own log filter; fixed, run again) |
| Core db, item 8: `capture-actions.db` | 8 of 8 (two fails on the way: each showed the next boot refusal) |
| Core db, once at the end: `contract.test.ts`, `rbac-matrix.test.ts`, `fact-doors.db`, `restart.db` | 5 files with `reset.db`, 113 tests, green |
| Shared: `sim-api`, `sim-core-facts`, `openapi`, `api-openapi-scope` | 75 tests, green |
| Mobile jest `--maxWorkers=2`, the two files | 15 of 15 (both were red before) |

Controls per edge, item 1: SIMULATED — no boot step, door never called (unit + db). Class — an empty
registry changes nothing; POE switch carries none; the stored `adapter_kind` rows are equal before
and after; the marks survive `stop()` + `reload()`. `sourceOpen` — absent after every boot; set on
`CAM-03` / `MIC-03` (never a test source) at the start of the scripted-helper session; absent after
the stop; a stopped engine is handed nothing; a failed hand-over is logged + persisted, never thrown.

## 3. Not proven / limits / foreign reds

- Nothing ran in a browser or on a device. Whole-workspace suites were not run.
- Item 1: "is on" was proven through the rig's own registry (scripted door), told to the feed through
  its port — not through the fence's own registry with a real helper (an agent run opens no device).
  The failed-start and interrupted close paths are proven at the pure level (the whole list of the
  moment is handed in, and an absent device loses the member), not by a db session each.
- Item 2: an item WITHOUT a revision is not touched — after a restart it still carries no `transcript`
  summary at all (the same staleness, one step earlier; not in the list).
- Item 4: both guards read `<dataDir>/media/sessions`, not `config.mediaStoreDir` (finding filed).
- Item 7: three lines of that case's telemetry frame (`ingest`, `fragments`, `clocks`, all empty) were
  re-typed from the protocol's shape after an over-wide replacement; the file is untracked, so no
  copy existed to compare.
- Foreign red, in a file I touched: `transcript-routes.db.test.ts`, 5 cases, `V-10
  TRANSCRIPT_MODEL_MISMATCH` since pass D10 item 6 (the rig's document against the builder's manifest).
  Finding filed; not fixed (not in the list).
- A few early unit runs used `cd apps/core-server`; every later run used `-w` from the root.

## 4. Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| D11-1 | `sourceOpen` = what the FENCE says is open (`openSources()`), not the session's handle list. Contract C3 §2.6 (PE-128-38): true only for a `LOCAL_DEVICE`, the short pre-check open included, "always false for other kinds". The fence set is exactly that, and drops a device on every close path and when a source is lost. The capture-session events are used as the brief says, read-only — as TRIGGERS for a new hand-over | the brief's wording (the session's open handles): would mark the FAKE test sources "on", miss the pre-check open, and keep a lost source "on" until the stop |
| D11-2 | The engine host keeps the last list and re-applies it in its rehydrate (one own block inside `rehydrate`) | the caller re-applies after each reset / resync — it has no signal for a resync |
| D11-3 | The audited refusal of a reset is `ACCESS_DENIED` with `details { operationId, reason: RESET_BLOCKED_REAL_EVIDENCE }`, actor = the operator. The contract says "audits the refusal" and names NO type; this is the one existing type whose detail rule carries an operation and a reason code. `loadScenario` is audited the same way | a 68th audit type (moves the count pins of every workspace) |
| D11-4 | The feed lives in `modules/devices` with ports a rig may replace (`captureSourceFacts(app).replace`), and adds its boot step from `onReady` (the module registers before the capture unit). The module's static guard was amended by name and count for that one file | the feed in the capture unit (not my area) |
| D11-5 | Item 2 publishes heads for items WITH a revision only | a summary with revision 0 for every sealed transcript (changes the state every restart test reads) |
| D11-6 | Item 8: the fixture boots REAL_DEVELOPMENT on test sources | a production selector in the clone (needs adopted devices; nothing of A-4 is about them) |
| D11-7 | A guard that cannot be asked refuses the reset (503), it does not fall through to the routine | fall through: the routine's own guard still protects, after a quiesce |

## 5. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm run test:db -w @dems/core-server` (whole) | `db-migrate` | red only: the 5 cases of `transcript-routes.db` (§3). A case of another file that reads a device list of a REAL_DEVELOPMENT boot with exact equality now sees `adapter: FAKE` / `sourceClass: DEVELOPMENT` on the built-ins → back to this pass |
| `npm test -w @dems/core-server` (unit) | none | green except the 31 sealing cases of pass D9's request to row 82c |
| `npm test -w @dems/shared` | none | green; a snapshot of the simulator's session answer taken inside the connecting second now holds `captureDurable: false` |
| `npm test -w @dems/core-web` | none | same kind as above (the REST session answer) |
| `npx -w apps/mobile jest --maxWorkers=2` | none | the two static pins green; no other change of mine in mobile |

## 6. Device / browser checks for the gate

| Check | Flow | Pass |
|---|---|---|
| W-DEVSRC / tablet / phone | REAL_DEVELOPMENT Core on test sources, Devices page | the four built-in sources show "Development source — Test source"; the switch shows none; after a demo reset (when permitted) they still do |
| M5-SEC-PRIV-2 (USER run only, D163) | this Mac's camera / microphone selected; pre-check, start, stop | the "is on" state appears at the pre-check's short open and at the start, goes at the stop, never on a test source |
| RESET-BLOCKED | a Core with one real sealed item; System, Reset demo | the refusal text; the page does not reconnect (no new epoch); Audit shows one "Access denied" row naming the reset |
| TR-REV-RESTART | revise a transcript, restart the Core, open the item | the revision number is shown without a new revision |
| SIM-STOP-CONNECTING | Simulated Core, Start, End Session within the first second (API client) | 409 with `details.reason: CAPTURE_NOT_DURABLE` |

## 7. Follow-up (controller decision D165) — the two findings of §3

Status: **needs-review**, both done. No commit, no migration, no local device. `C` = `apps/core-server/`.

### 7.1 Reset guard root (safety defect) — done

| What | Where |
|---|---|
| The server hands the media root of its configuration (`app.config.mediaStoreDir`) to BOTH guards: the caller-side guard (`storeRoot`) and the routine (`evidenceStoreDir`) | `C/src/modules/demo/host.ts` (`mediaStoreDir` getter, `realEvidence`), `C/src/modules/demo/reset.ts` (`ResetHost.mediaStoreDir`, the routine call) |
| The command line (`db:reset`) resolves the root by the configuration's own rule over its environment: `DEMS_MEDIA_DIR`, else `<dataDir>/media/sessions`; a value that is no absolute path is refused, never replaced | NEW `evidenceStoreRootOf` in `C/src/db/commands/evidence-store.ts`; `C/src/db/reset/cli.ts` |
| `EVIDENCE_STORE_SUBPATH` IS the configuration's `MEDIA_STORE_SUBPATH` (imported, no second literal) | `evidence-store.ts` |
| The removal of a permitted reset and its containment rule work below `facts.storeRoot` — the root the guard read (`real-evidence.ts`, unchanged code): they follow the same root by construction | — |

The resolver: there is no function in `sealing-host` or `capture-session` to import — both read
`app.config.mediaStoreDir` directly (`sealing-host/index.ts:138`, `capture-session/index.ts:701`).
The one rule is `createConfig` (`config.ts:316`); the server uses its result, the command line its
two parts (`ENV_MEDIA_DIR`, `parseCapturePath`). Nothing of row 82c's files was touched or copied.

Test: NEW `C/src/modules/demo/__tests__/reset-store-root.db.test.ts` (3 cases, green on the first
run) — a server whose media root lies outside its data directory, a signed package of production
sources in it, no row in the tables:
1. the caller-side guard blocks: 409, no hold, no engine stop, epoch 1; its log line names the
   configured root. CONTROL: the old path logic (`{ dataDir }`) on the same state answers
   `blocked: false` — it would have permitted the reset;
2. the routine's own guard reads the same root: a package planted at the routine's first checkpoint
   (after the caller-side guard passed) stops it at R-3, target untouched, server back, 409;
3. `evidenceStoreRootOf`: the variable, the default, the refusal of a relative path.

Limits. (a) The removal below a configured root has no case of its own (it needs an exempt
development item with its signed package); it is the same `facts.storeRoot`. (b) A `db:reset` run
from a shell that does NOT carry the server's `DEMS_MEDIA_DIR` still reads the default directory:
no table says where an installation keeps its media. The tables side blocks a REAL sealed row
either way; a package without a row would be missed. An operator rule, or a stored root — a decision.

### 7.2 `transcript-routes.db.test.ts`, 5 cases on `V-10 TRANSCRIPT_MODEL_MISMATCH` — a rig inconsistency, fixed in the rig

The rig built its package with the verify builder (manifest = the builder's example model) and then
wrote its OWN `transcript.json` (model `whisper` / `1` / `q5` / `ab…`) over the builder's. No seal
writes such a pair. Fix: the rig passes its document's backend and model to the builder
(`transcriptModel`), so the signed manifest states what the document's header states.
Product side, checked in my area: the revision path and the transcript-package unit write the
revision list and a retained certificate only — nothing there writes or rewrites `transcript.json`
(`C/src/transcript-package/index.ts`: two writers, `writeRevisionList`, `retainCertificate`). The
seal's own pair (document + manifest from pass D9's one provenance rule) is row 82c's and was not
examined further. No product defect found; no request filed.

### 7.3 Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| typecheck + lint core-server | 0 errors |
| Core unit: `src/db/reset`, `src/db/commands`, `test/static` | 22 files, 350 tests, green |
| Core unit: `modules/demo` | 148 green (three pins moved by the new member, by name: the routine's option list x2, the static count of the media root) |
| Core db (lock): `reset-store-root.db` (new) | 3 of 3 |
| Core db: `transcript-routes.db` | 14 of 14 (the 5 are green; my 3 of the first part stay green) |
| Core db: `db/reset` `cli.db`, `m4-sec-reset.db`; `demo/reset-failures.db`; `contract.test.ts` | green |
| Core db: `demo/reset.db` | 2 red in the combined run, 7 of 7 alone — NOT this change: see below |

New finding (filed, not fixed): the contract walk copies a real package into
`<run dataDir>/media/sessions`, which every db file of a run shares; while it lies there another
file's reset guard refuses (`reset.db` 'loadScenario recording' answered 409 once, in one command
with `contract.test.ts`). Older than this pass. For the test runner: a red `RESET_BLOCKED_REAL_EVIDENCE`
in a reset db file of a whole-suite run is this, until the contract server has a media root of its own.

### 7.4 Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| D11-8 | The server's root is `app.config.mediaStoreDir` handed in; the command line resolves the same rule from its environment (one new function, built from the configuration's own exports) | a resolver exported by the sealing composition — there is none, and its files are closed |
| D11-9 | A `db:reset` without the server's environment keeps the default root (limit (b)) | refuse a command-line reset unless the root is stated; or store the root in a kept table (migration 0013) |
| D11-10 | The V-10 reds were the rig's; nothing changed in the product | — |
