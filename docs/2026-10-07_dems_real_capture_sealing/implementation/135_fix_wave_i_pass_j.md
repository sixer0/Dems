---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: fix_wave_i_pass_j
date: 2026-10-10
agent: coder-execution
source_plan: /docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md
decisions: D216, D217 (5), (7)
status: completed
---

# 135 - Fix wave I, closing pass J (one driver: core-server, shared, core-web, mobile)

Tree: `74fd1f1` + fix wave I (notes 131..134), not committed. No commit, no migration (schema 6 /
`dbc-7`), lanes down, no emulator, no Gradle, no device / browser driven. Contract totals unchanged:
**97 operations / 36 GET / 61 POST / 67 audit types** (generator: `97 operations ... 1355799 bytes`,
`unchanged` on the second run; the OpenAPI diff of this pass is +15 lines = three optional members).

## 0. The member names fixed by this pass (one name end to end)

| Member | Where | Meaning | Contract example (client tests IMPORT it) | Reader (by name) |
|---|---|---|---|---|
| `security.platformNotReported?: true` | slice `security` (`packages/shared/src/api/state-slices.ts:617`, `sim/types.ts` `SecuritySlice`) | this Core reads no TPM, no Secure Boot state and computes no posture; `tpm`, `secureBoot`, `posture` and the `TPM` / `SECURE_BOOT` controls are then NOT readings. Absent = the simulated device (today's meaning) | `SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE` (`@dems/shared/api`) = `{ platformNotReported: true }` | `isPlatformNotReported(security)`, `platformNotReportedTransition(state)` (`@dems/shared/sim`, `core-facts.ts`) |
| `coreNotRunning?: true` | `session.fault` (`state-slices.ts:342`), an entry of `faults.active` (`:936`), and - in open maps, no schema change - the `params` of the fault's alert and event, the `details` of its `FAULT_RAISED` / `FAULT_CLEARED` row and of the `SYSTEM_BOOT` row of its recovery, the `params` of its timeline item | the restart fault of a Core in its own capture: the Core was not running while the session was active and does not know why. KIND stays `POWER_FAIL`, `fromState` unchanged, no `reason` | `CORE_NOT_RUNNING_FAULT_EXAMPLE` (`@dems/shared/api`) = `{ coreNotRunning: true }` | `isCoreNotRunning(record)`, `isCoreNotRunningKind(state, kind)`, `coreNotRunningFaultOf(state)`, `faultKindLabelKey(kind, ...records)` (`@dems/shared/sim`, NEW `core-not-running.ts`) |
| `details.reason` of `503 NOT_READY` of `startSession`: `SESSION_KEY_NOT_OF_SESSION`, `SESSION_KEY_STORE_UNAVAILABLE` (A1's values, now named for the clients) | error envelope; on the client the code travels as `LiveTransportError.detailReason` (optional class member, `packages/shared/src/live/errors.ts`) | the start was refused for the session key; nothing was recorded | `START_REFUSED_SESSION_KEY_EXAMPLE` (`@dems/shared/api`, `sessions.ts:151`) | `START_REFUSED_REASONS`, `startRefusedReasonOf(error)`, `startRefusedSentenceKey(reason)` (`@dems/shared/sim`, NEW `start-refused.ts`) |

Shared sentences (append-only blocks of `packages/shared/src/i18n/en/common.ts`):
`common.coreNotRunning.{label,sentence}` (= the constants `CORE_NOT_RUNNING_LABEL` "Core was not
running", `CORE_NOT_RUNNING_SENTENCE` "The Core was not running while this session was active. It
does not know why it stopped."), `common.platformNotReported.{value,tpm,secureBoot,posture,note}`,
`common.hostClockTime.{label,value,notice}`, `common.startRefused.<reason>` (the Core's own two
sentences of `sealing-host` `SESSION_KEY_START_TEXT`, word for word), and the corrected
`common.captureConnect.noPasswordNeeded`.

## 1. Per item

### Item 1 - G75b-06 at the source (D217 (7))

Cause. The `security` slice of a real-capture Core is the dataset's (`packages/shared/src/sim/initial-state.ts:415-417`:
`posture: SECURE`, `tpm.ok: true`, `secureBoot: true`) and is re-derived from the fault list only
(`sim/derive.ts` `deriveSecurity`); the engine start corrected the TIME slice alone
(`apps/core-server/src/engine/host.ts`, the time block). The web inferred "not reported" from
`time.hostClock` (`apps/core-web/src/lib/own-capture.ts` `isOwnCaptureCore`, note 133 decision 1).

Change.
- shared: the optional member (section 0); `platformNotReportedTransition` /
  `ownCaptureCoreFactsTransition` (`sim/core-facts.ts`); set in the first state of a simulator
  created with `capture: 'external'` (`sim/engine.ts`) and held at each health tick (`sim/health.ts`).
  `deriveSecurity` patches the slice member-wise, so the member survives every derivation (tested).
- server: `apps/core-server/src/engine/host.ts:1000` (own block "Platform block") states it on the
  state every start reads, beside the time block. The slice is stored as JSON
  (`db/mapping/rows.ts:304`): no column, no migration.
- **Decision (for the controller): the three required members keep their placeholder values.** The
  closed shape requires `tpm.ok: boolean`, `secureBoot: boolean` and a posture of three values, none
  of which can say "unknown"; turning them to `false` would make every reader that does not know
  the member say "TPM failed" (`sim/devices.ts:93`, `sim/maintenance.ts:100-102`, operation
  `getDeviceStatus` `tpmOk`). The member is the statement; the schema text says the values are not
  readings where it is present.
- web, read BY NAME (`isPlatformNotReportedCore` / `usePlatformNotReported`, `lib/own-capture.ts`;
  `isOwnCaptureCore` is now the TIME rule only): Dashboard card platform column and posture column
  (`features/dashboard/security-panel.tsx`, `dashboard-model.ts` `securityColumns`), strip Security
  cell (`status-strip.tsx`), header checklist row `platform` (`components/shell/secure-pill.tsx`,
  rule `ownCoreRow` in `integrity-checks.ts`, each row from its own member), Security & Audit page:
  posture panel and banner read "Not reported" (`postureOf(..., platformNotReported)` ->
  `UNKNOWN`), the TPM / Secure Boot / Key custody rows read "Not reported" with status `UNKNOWN`
  (`security-audit/model.ts` `buildControls`, `PLATFORM_CONTROLS`), About panel TPM row
  (`features/system/about-panel.tsx`). A posture that names a fault keeps it.
- mobile: Home Security chip (`features/dashboard/home-model.ts` `chipRowFor`,
  `use-home-data.ts`), Settings > About TPM field (`features/settings/about-section.tsx`). The
  mobile app has no other surface that shows a TPM, Secure Boot or posture (grep of `apps/mobile/src`
  for `security.` / `tpm` / `posture`: these two and `session-new-model.ts` `securityState`, which is
  the pre-check's own item).

### Item 2 - G75b-03, PRECHECK / ARMED / RECORDING / STOPPING (D217 (5))

Cause. `apps/core-server/src/engine/rehydrate.ts` `applyProcessStart` raised the simulator's fault
(`injectFaultTransition(..., POWER_FAIL)`), whose words are `describeFault`'s "Power fail detected -
recovery marker written" (`packages/shared/src/sim/faults.ts:155-156`); the recovery then wrote
"... restarted after power fail" (`sim/session-machine.ts` `recoverTransition`) and the clear
"Power fail detected ... - cleared" (`faults.ts` `clearFaultAtKey`).

Change (no new cause, `fault.fromState` and what an interrupted seal reads untouched).
- shared: `coreNotRunningFaultTransition(state, at)` (`sim/faults.ts`) = the same raise (same kind,
  key, session move) with `message: CORE_NOT_RUNNING_SENTENCE` and the member on the active fault,
  the alert params, the event params and the row details; `enterFault` copies the member to
  `session.fault` and words the timeline item; `recoverTransition` and the `FAULT_CLEARED` row of
  that fault say "The Core is running again ..." (`CORE_NOT_RUNNING_RESTART_SENTENCE`,
  `CORE_NOT_RUNNING_CLEARED_SENTENCE`). The member rides on `POWER_FAIL` only (a raise of another
  kind with it throws).
- server: `rehydrate.ts:368` calls it when `ownCapture`; the SIMULATED lane calls what it called.
- web labels from the member: header pill (`integrity-checks.ts` cause `CORE_NOT_RUNNING`), Session
  Monitor banner and timeline (`session-monitor/status-banner.tsx`, `timeline-panel.tsx`), audit
  table (`security-audit/model.ts` view member `coreNotRunning`, `audit-log-panel.tsx`).
- mobile labels from the member: Home flag line (`dashboard/use-home-data.ts` `statusKey`), Recovery
  screen, Sessions hub active card, Finalizing interrupted alert, Audit list and entry detail.

### Item 3 - small leftovers

| Leftover | Cause | Change |
|---|---|---|
| Mobile Network & Time "RTC (holdover)" | `features/network-time/time-sync-card.tsx` / `system-time-card.tsx` / header chip / `use-network-time.ts` read `time.source` with no host-clock branch (`i18n.ts:33`) | `TimeView.hostClock` (`isHostClockTime`); the card names the clock with one sentence (no orbit, tier row, last sync, server); chips "Host system clock", neutral; no holdover toast |
| Web Storage page "session size" | `features/storage/kpi-cards.tsx:35` read `session.bytesWritten` | beside a session of the Core's own capture: `captureCheckpointsOf(session).bytes` (the console's one reader); none stated = a dash |
| Phone History badge | `features/session-live/use-monitor.ts:87` counted the raw timeline | counts `timelineOfCaptureFacts(...)` - the rows the sheet draws (the held START row is not counted) |
| Web Dashboard "Recent Events" | **NOT CHANGED - see decision 2.** While connecting the row already reads "Recording start accepted" (`dashboard.captureStart.CONNECTING`, wave H Z2, finding G75-11), never "Recording started"; it is pinned by `features/dashboard/__tests__/wave-h-z2-failed-start-event.test.tsx:111-112` | - |

### Item 4 - a blocked seal turns the header critical through the alert

Cause. `selectPillState` read `selectSystemSeverity` only (fault flags); no flag stands for a
blocked seal. Change: web `components/shell/integrity-checks.ts` - `selectPillState` is CRITICAL
when `sealBlockedNoticeOf(state) !== null`, `selectPillCause` returns `SEAL_BLOCKED` ("Sealing is
blocked", `web.sealBlocked.title`), the checklist's `recording` row is CRITICAL (stable array).
Mobile equivalent (Home status ring / card): `dashboard/use-home-data.ts` `statusKey` gives
`CRITICAL` on the same reader. `SYSTEM_FLAG_IDS` of the shared selector was not touched (a pinned
finite set).

### Item 5 - G75b-10

Cause. `packages/shared/src/sim/generator.ts` ran the recording integrity stream from the accepted
start, i.e. during the simulator's connecting time (`captureDurable: false`), so a start that then
FAILED had `FRAME_HASH` / `WRITE_VERIFIED` / `TIMESTAMP_CONFIRMED` rows (red: 4 rows in a 30 s
connecting window). Change: `generator.ts:252` - while `captureDurable === false` the arrivals are
HELD (schedule and random draws unchanged) and written, each at its own scheduled time, once the
start is durable; a failed start drops them. A start that happened has exactly the rows it had (the
control compares connecting times 0 / 1,000 / 30,000 ms: identical row lists), so no audit count
moves; only the position of rows that fell inside the connecting second can be up to that second
later in the chain. The Core's own capture was already silent.

### Item 6 - `common.captureConnect.noPasswordNeeded`

Now the ruled wording of `contract_wave_i_a2.md` section 1, identical to the web's
`web.connect.developmentHint` (held equal by `pass-j.test.tsx` and by the two moved pins). No client
reads the shared key directly today.

### Item 7 - the two `details.reason` values of a refused start

Finding: **missing on both clients.** A `503 NOT_READY` is classified as a Core that is not ready
(`packages/shared/src/client/core-client.ts:381`), rebuilt as `LiveTransportError` without the
reason, and worded "The Core server is starting" (web `lib/core-errors.ts:149`; the mobile presenter
likewise) - a generic toast, the wrong one. Change: the reason code travels on the error
(`live/source/rebuild-error.ts:107`, `LiveTransportError.detailReason`); both start handlers ask
`startRefusedReasonOf` BEFORE their presenter and show `common.startRefused.<reason>` under their
"could not start" title (web `features/session-new/index.tsx` `startNow`; mobile
`features/session-new/use-session-new.ts` `fail`). Pre-check is not concerned (the refusal is of
`startSession` only). `CAPTURE_HELPERS_LEFT` has the same defect and was NOT changed (open item).

### Item 8 - the pair of db tests

Evidence. One run of the pair through the db project (`--project db`, two workers, lanes down):
`Failed Tests 38`, 34 x `remaining connection slots are reserved for roles with the SUPERUSER
attribute`. Cause: NOT a new test of wave I (neither file has a diff against `74fd1f1`, and the
six new `wave-i-*.db.test.ts` files are not in the pair) and not the workers' default: it is an
accumulation in `src/capture-session/__tests__/session-capture.db.test.ts` - 26 cases built a rig
(an app with a runtime pool of up to 10, `plugins/db/index.ts:58`, plus an owner pool) that stayed
open until the FILE ended (`target.onCleanup`); only the later "fix-pass" cases were closed per case
(the file's own comment said so). Alone it fitted the server's 97 usable slots, beside a second db
file it did not. Fix (test file only): every rig registers itself and is closed after its case -
supervisor, app and both pools of its database (`rigDatabases`, `closeResources()`), line 249 and
the `afterEach`. Second run of the pair: `Test Files 2 passed (2) / Tests 82 passed (82)`.
Whether wave I raised the per-app connection count cannot be said without the base tree (no git
write allowed); with the fix it no longer matters for this pair.

## 2. Test output (each line one run after its last change; a second run only after a red)

| Command | Result |
|---|---|
| `npx -w packages/shared vitest run test/sim-pass-j.test.ts` with the generator hold disabled (red proof of item 5) | `1 failed | 9 passed`: `expected [ 'WRITE_VERIFIED@8603', ...(3) ] to deeply equal []` |
| `npx -w packages/shared vitest run test/sim- test/live test/api- test/openapi.test.ts test/i18n` | `Test Files 82 passed (82) / Tests 1722 passed (1722)` (first run of `test/live`: 4 red in `live-light-platform-neutral.test.ts` - my reader imported `src/api` from the light Live API; moved to `sim/start-refused.ts`, second run green) |
| `npx -w apps/core-server vitest run --project unit src/engine/__tests__/pass-j-core-not-running.test.ts src/engine/__tests__/wave-i-a2-graceful-restart.test.ts` | `Test Files 2 passed (2) / Tests 8 passed (8)` |
| `npx -w apps/core-server vitest run --project unit test/static src/engine/__tests__ src/core/__tests__/writers.test.ts` | `Test Files 35 passed (35) / Tests 503 passed (503)` |
| `lockf .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/engine/__tests__/pass-j-restart-recording.db.test.ts` | `Test Files 1 passed (1) / Tests 2 passed (2)` (first run red on my harness: the pre-check blocked without a tablet link) |
| same, `wave-i-a2-graceful-restart.db.test.ts` | `Test Files 1 passed (1) / Tests 2 passed (2)` |
| same, the pair `restart.db.test.ts` + `session-capture.db.test.ts` | before the fix `38 failed`; after `Test Files 2 passed (2) / Tests 82 passed (82)` |
| `npx -w apps/core-web vitest run src/test/pass-j.test.tsx src/test/wave-i-b-own-core-facts.test.tsx src/test/wave-i-b-header-critical.test.ts src/features/devices/__tests__/{wave-i-b-connect-wording,camera-connect}.test.tsx src/features/{session-new,storage,security-audit,dashboard,system}` | `Test Files 24 passed (24) / Tests 219 passed (219)` |
| `npx -w apps/core-web vitest run src/features/session-monitor src/features/system src/test/live-{storage-page,shell-indicator,shell-notices}.test.tsx` | `Test Files 20 passed (20) / Tests 207 passed (207)` |
| `npx -w apps/mobile jest src/features/{dashboard,network-time,session-live,session-new,audit,sessions,session-finalizing,session-recovery,settings}` | `Test Suites: 104 passed / Tests: 748 passed` |
| `npx -w apps/mobile jest src/features/dashboard/pass-j-home.test.tsx src/features/network-time/pass-j-host-clock.test.tsx src/features/session-new` | `Test Suites: 16 passed / Tests: 118 passed` |
| typecheck + lint, `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile` | 0 errors each; lint clean except one warning in `apps/mobile/src/runtime/log.test.ts:160` (not a file of this pass) |

Pins moved by delta: `apps/core-web/src/features/devices/__tests__/camera-connect.test.tsx` and
`wave-i-b-connect-wording.test.tsx` (the shared key now IS the ruled sentence: the assertion became
"equal to the web hint" + "never 'needs no password'"); `apps/core-web/src/test/wave-i-b-own-core-facts.test.tsx`
(its Core fixture now sends the platform member, as a real-capture Core does).

What is NOT proven by a test: the rendered toast of a refused start in either client (the reader,
the travel of the reason and the sentences are; the toast is a gate check).

## 3. Decisions for the controller

1. **`tpm.ok` / `secureBoot` / `posture` keep their placeholder values on a real-capture Core; the
   member `platformNotReported` is the statement** (item 1). D217 (7) asked for "the smallest
   additive truthful statement"; the alternative (placeholders set to `false` / a derivation guard)
   is listed with its readers in item 1. Readers NOT changed and still fed by the placeholders:
   the platform device list `TPM ... OK` (`sim/devices.ts:93`, web Devices "other devices", mobile
   Devices), `sim/maintenance.ts` self-test line, operation `getDeviceStatus` `security.tpmOk`.
2. **Web "Recent Events" was not changed.** The row of a connecting start reads "Recording start
   accepted" since wave H Z2 (G75-11, pinned); it does not say the recording started. Holding the
   row as the timelines do would undo that ruled row. If the hold is wanted: filter
   `outcome === 'CONNECTING'` in `recent-events-panel.tsx` and move the Z2 pin.
3. **`coreNotRunning` is a member, not a cause.** No `reason`, no new kind (`CORE_STOPPED` stays
   for the next task). An interrupted seal of such a session still names the code `POWER_FAIL`
   (`interruptedSealCauseSentence`: "ended at a fault (POWER_FAIL)"), and a CLOSED session's history
   entry still carries `faultKind: POWER_FAIL` with no member (the history is column-mapped,
   `db/mapping/rows.ts:363`: a member there needs a migration) - so the mobile Sessions detail of an
   INCOMPLETE session that ended this way still reads "Power failure." Both are the next task's
   `CORE_STOPPED`.
4. **`session-capture.db.test.ts` was edited** (test file, item 8), declared in `file_claims.md`.
5. The reader of a refused start lives in `@dems/shared/sim` (`start-refused.ts`), not in
   `@dems/shared/live`: the light Live API may import nothing from `src/api` and its export list is
   pinned (`live-light-platform-neutral.test.ts`).
6. For the docs owner (C3): §6 slice `security` one optional member; §6 `session.fault` and
   `faults.active[]` one optional member each; §5.2 `FAULT_RAISED` / `FAULT_CLEARED` / `SYSTEM_BOOT`
   one optional detail key `coreNotRunning`; ux :827 / :1418 the corrected sentence. Filed in
   `file_requests.md`.

## 4. Open items

- The readers of decision 1 (platform device list, self-test, `getDeviceStatus`).
- The history entry and the interrupted-seal cause of decision 3.
- `CAPTURE_HELPERS_LEFT` (same `503 NOT_READY`, same wrong "starting" toast on both clients): the
  reader takes a third value and a sentence in one edit; not in this pass's list.
- Web Devices page: `features/devices/sim-adapter.ts:181` draws the AC input port down while a
  `POWER_FAIL` fault is active - also for the restart fault of a real-capture Core.
- Simulator rows inside the connecting second are appended up to that second later (item 5): if a
  suite pins the POSITION of the first integrity row right after `RECORDING_STARTED`, it moves; the
  shared suites run here do not.

## 5. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db` (sandbox off) | db-migrate | the baseline of the commit; `restart.db.test.ts` + `session-capture.db.test.ts` no longer fail together; `pass-j-restart-recording.db.test.ts` 2 passed |
| `npm test -w @dems/core-server` (unit) | - | baseline; `pass-j-core-not-running.test.ts` 4 passed (3 cases, one of them for two states) |
| `npm test -w @dems/shared` | - | 0 failed (`sim-pass-j.test.ts` 12) |
| `npm test -w @dems/core-web` | - | 0 failed (`src/test/pass-j.test.tsx` 17) |
| `npm test -w @dems/mobile` (jest) | - | 0 failed (`pass-j-home.test.tsx` 7, `pass-j-host-clock.test.tsx` 3) |
| capture / seal e2e with the built worker (`seal-e2e`, `development-session-e2e`) | heavy-host | unchanged: the generator hold touches the SIMULATED stream only; the real-capture restart path changes words, not states |

## 6. Re-drive list for the gates (device / browser, after the environment is rebuilt)

| Gate / finding | Where | What to see |
|---|---|---|
| 75 G75b-06 | lane 2 (real capture) web: Dashboard strip Security cell, card platform + posture columns, header checklist, Security & Audit (posture, banner, TPM / Secure Boot / Key custody rows), System > About TPM row | "Not reported"; never "TPM 2.0 Verified", "SECURE / All controls active", "Attestation OK" |
| 75 G75b-06 | lane 2 tablet / phone: Home Security chip, Settings > About, Network & Time | "Not reported"; "Host system clock", no "RTC (holdover)", no "Free-running", no tier row |
| 75 G75b-06 control | lane 1 (simulated) the same surfaces | unchanged ("TPM 2.0 Verified", "Secure", GNSS) |
| 75 G75b-03 | lane 2: stop the Core (`lane.sh stop 2`) while a FAKE-source session is RECORDING, start it | audit row "The Core was not running while this session was active. It does not know why it stopped."; header "Critical fault: Core was not running"; Monitor banner, tablet Recovery screen and Home flag the same words; no "Power fail" anywhere; after Recover: "... is running again ..." rows |
| 75 G75b-03 control | lane 1: the same stop / start | "Power fail detected" as before |
| 75 G75b-02 / item 4 | lane 2 blocked seal (if one can be produced) | header pill CRITICAL "Sealing is blocked", checklist row Recording critical; tablet Home ring critical - with no fault in the list |
| 75 G75b-10 | lane 1: a start with both cameras lost (demo control) | no "Secure timestamp confirmed" / "Frame hash" / "Storage write verified" row for the failed start |
| 75 G75b-06 | lane 2 web Storage page during a recording | session size = the durable bytes of the Monitor's "Durable Fragments" line |
| 75 G75b-08 | lane 2 phone, start a session | History badge shows no unseen item while "Connecting cameras..." |
| 75 G75b-01 (A1) + item 7 | a start refused with `SESSION_KEY_NOT_OF_SESSION` (only if the state can be produced on a lane) | web and tablet: "Recording could not start" + the Core's sentence, not "The Core server is starting" |
| 70 G70b-02 | web connect dialog, development source | the hint sentence unchanged on screen (the key behind it is now the shared one's twin) |

---
*Generated: 2026-10-10 21:20 WIB*
*Last Updated: 2026-10-10 21:20 WIB*
