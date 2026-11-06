---
task_id: 2026-10-07_dems_real_capture_sealing
row: 101 (M9 chain 4/4, final senior code review)
date: 2026-10-11
agent: senior-code-reviewer
commit: 713d83f (main, local)
range_reviewed: f293221..713d83f (fix waves G/H..M, consolidation, hygiene), and the task as a whole where structure matters
status: complete
tier: 2
---

# 22 - Final code review (blueprint row 101)

Nothing was changed: no product file, no test, no git write, no install, no lane, no device, no
browser, no whole suite. `.data/pg*.env` not read. One targeted test file was run (section 1).
The blueprint names `gateway_check/24_review_final.md` as this row's output; the controller's brief
names this path, and this file is the one written.

## 0. Verdict

**Is the code in a state to hand over as "done on this Mac with fake devices"? YES WITH CONDITIONS.**

No BLOCKER. The server side of the waves is in good order: bounded retries, timers released at
close, no product file importing test support, development switches reachable only through the
fence, the guard family intact. What is not in good order is structural, and it is the same thing
three times: a rule that should exist once exists two or more times and has started to differ.

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 5 |
| MINOR | 19 |
| NOTE | 9 |

Conditions of the YES (small; none reopens a gate):

1. **R101-03**: the verify part-outcome rule gives a different word on web and on mobile for the
   same answer. Make it one rule, or record a ruling that the difference is wanted.
2. **R101-05**: one documented command (a package script and a README line) for the three gated
   scenario suites. Today `npm test` is green without the seal e2e, the development-session e2e and
   the kill matrix having run, and their switches are named only in task notes.
3. **R101-01, R101-02, R101-04** are recorded as known structural debt where the next engineer
   reads first (README "Known limits" or the handover), with the cut proposed in section 4.

## 1. What was reviewed, and how

- Read: row 101 (`identification/02_structured.md:433`), the driver rules D94, reviews 16..21 by
  their finding tables, the wave F fix notes 111..116 by their "not fixed" rows, decisions
  D213..D240, `test/13` section 6, notes 161, 162, 163, the five contract notes of waves I..M.
- Code: `git diff f293221..713d83f` is 967 files, +82,632 / -8,594 (824 files, +57,193 / -8,556
  outside `docs/`). Read in full or in the changed part: the three lane rigs and the launcher,
  `media-stream/service.ts` and `source.ts`, `sealing-host/index.ts` (tracking, way-out wiring,
  close), `sealing/pipeline/way-out.ts` (retry timer), `evidence-facts/index.ts`,
  `engine/restart-fault.ts`, `capture/fence/index.ts`, `capture-notices/probe.ts` (scan),
  `sim/events.ts`, `sim/session-machine.ts` (sending device), both clients' `own-capture`,
  `source-state`, `source-class`, `seal-attention`, `verify-v2`, `item-v2`, `transcript-model`,
  `sealed-playback`, the web `sealed-player.tsx` stall watch and the web probe.
- Measured by script (scratchpad `r101/`): web / mobile pair differences after stripping
  semicolons, comments and imports; identical English sentences across the three i18n trees;
  references per workspace of 37 contract members; mentions of deleted test files.
- NOT read in full: `capture/supervisor.ts`, `capture-session/index.ts`, `engine/host.ts`, the
  mobile `sealed-player.tsx` beyond its hooks and listeners, the worker (C). Their findings below
  are by scan and are marked.
- Row 101's three literal checks:
  - **Tree clean**: code is clean. Two docs entries are not committed:
    `M decisions/decisions.md`, `?? delegation_progress/git_specialist_row97_commits.md` (R101-31).
  - **Static-rule family intact**: `npx vitest run --root apps/core-server --project unit
    test/static/guard-family.test.ts` at a 1-minute load of 6.0: 1 file, 4 passed, 0 failed.
    Nothing under `apps/*/src` or `packages/*/src` (tests excluded) imports from `test/`
    (`rg "from '...(/test/|test/support)'"`: 0 lines).
  - **No residual waiver edits beyond OD-14**: `app.ts` and `index.ts` unchanged in the range.
    `config.ts` +49 lines in `74fd1f1`: two keys beyond the OD-14 list, each marked in the file
    with its ruling (`config.ts:25` D198, `:28` D207). Ruled, so not a finding; listed (R101-30).

## 2. Findings

`R101-NN` | severity | where | what | why it matters | remedy.

### MAJOR

| ID | Where | What | Why it matters | Remedy |
|---|---|---|---|---|
| **R101-01** | `apps/core-web/src/features/devices/source-class.ts:36-59`; `apps/core-web/src/lib/own-capture.ts:15,36,56,75,97`; `apps/mobile/src/features/devices/camera-preview.tsx:46-49`; `apps/mobile/src/features/capture-selector/source-state.ts:143-146`; `apps/mobile/src/features/session-live/own-capture.ts:22`; both `item-facts.ts` (`isRealItem`) | **The Core states nowhere, for every role, which capture operation it runs. The clients infer it, by at least seven rules from five different members**: `session.captureDurable`, `time.hostClock`, `security.platformNotReported`, `hostClock OR platformNotReported` (`isSelfCaptureCore`), "a device carries `sourceClass`, or the device list is empty" (web `isRealCaptureCore`, mobile `realCaptureView` and its copy `realCaptureSources`), `integritySource === 'REAL'`, `signature.simulated === false`. The file says so itself: "The console has no operation that names the Core's capture operation for every role, so it is told apart by the Core's data" (`source-class.ts:42-43`). 178 non-test references on the two clients read one of these | This is the cause behind the recurring class of waves H..L (G75-01, G89-01, G89-03, G94-02, C-2, G89c-01..03): a simulator value on a real-capture surface. Each was closed on its screen, by one more inference. An empty device list reads as "real capture" on a Live client; a new surface picks one of seven rules and can pick wrong. The separation is by per-screen rule, not by structure | One member, stated by the Core in a slice every signed-in role receives (for example `core.captureOperation: SIMULATED / REAL_DEVELOPMENT / REAL_PRODUCTION`; the server already computes it, `capture/fence/operation.ts`), with ONE shared reader. The seven rules become that reader. `useRealCapture()` (which means "Live console", `source-class.ts:36`) is renamed on the way |
| **R101-02** | `packages/shared/src/sim/index.ts` (one entry point); 127 non-test files of `apps/core-server/src` import `@dems/shared/sim`; dataset values at `modules/capture-config/slices.ts:69,74`, `modules/devices/status.ts:101,288`, `db/mapping/rows.ts:768`, `modules/evidence/export-request.ts:58`, `sealing-host/progress.ts:56`, `capture/adapters/fake/index.ts:52`; the admission in `sealing-host/session-reader.ts:33-37` | **The real Core's engine state is the simulator's state, and the simulator's dataset is one import away from every Core module.** `@dems/shared/sim` is three things under one name: (a) the state model and its transitions, which the Core runs; (b) the simulator proper (dataset, generator, scenarios, fault timeline); (c) readers of Core facts for the clients (`core-facts.ts`, `core-not-running.ts`, `seal-blocked.ts`, `selector-in-force.ts`). `session-reader.ts` states it: "The engine's state is the hosted SIMULATOR's ... each was a false statement" | What keeps a dataset value out of a signed manifest today is the reader's own list of what it does NOT take, and tests. Nothing structural stops the next module from importing `DEFAULT_CAPTURE_DEVICES` or reading `state.time`. G89-01 (simulator GNSS, serial and camera model in a signed manifest) was exactly this | Three entry points in `packages/shared`: `state` (types, transitions), `sim` (dataset, generator, scenarios, rng), `facts` (the client readers). Then one static rule in the existing guard family: under `apps/core-server/src` only `db/fixtures`, `db/seed`, `modules/demo`, `capture/adapters/fake` and `engine/headless-sim.ts` may import `@dems/shared/sim`. The six sites above either move behind that line or take their value from the registry |
| **R101-03** | `apps/core-web/src/features/evidence/verify-v2.ts:471-477` against `apps/mobile/src/features/evidence/verify-v2.ts:475-481`; `verify-v2-report.tsx:183` (web) against `:190` (mobile); `item-v2.ts:111,125-128` (web) against `item-v2.ts:193` (mobile); `transcript-model.ts:125` (web) against `readRevisionReason` (mobile) | **The duplicated client rule files have diverged in behaviour, and the divergence is accidental.** Code lines identical after stripping comments, imports and semicolons: `verify-v2.ts` 295 of 302, `transcript-model.ts` 128 of 143, `item-v2.ts` 127 of 134, `sealed-playback.ts` 76 of 84, checkpoint reader 24 of 24. What differs: (1) **`v2FilePartOutcome`**: web answers FAIL for a stored or chain part that is not ok, always; mobile answers SKIPPED when check V-04 / V-06 is SKIPPED. A row without a file reads "FAIL" on web and nothing on mobile. (2) transcript-model text bounds: `report` up to 1,024 characters on web, 1,000 on mobile; `name` / `version` 256 against 200. (3) a revision reason is bounded untrimmed on web and trimmed on mobile; web also fills a missing reason from the audit ring (`revisionReasons`), mobile does not. (4) `sourceClass` absent on web, `null` on mobile | Two clients can show different words for the same verification answer of the same package. Whether case (1) is reachable was not determined: it needs a report in which V-04 or V-06 is SKIPPED while a file row exists. R80-10 and R88-17 predicted this ("will be fixed twice"); note 162 measured 76 / 74 differing lines; no note states a reason for any of the four differences | Move the five pure files to `packages/shared` (they import nothing of a client kit). Decide the four differences once, there. Until then: at least `v2FilePartOutcome` and the two readers under one shared test with the same vectors |
| **R101-04** | `apps/core-web/src/features/evidence/sealed-player.tsx:193-220, 290-425` (834 lines, 22 hooks); `apps/mobile/src/features/evidence/sealed-player.tsx` (671 lines, 25 hooks) | **The stall watch is a state machine written as eight parallel refs inside a component.** Per camera file its state is spread over `alive`, `waitingFor`, `watches`, `probing`, `stallAsked`, `stopsRef`, plus `busy`, `detached`, `mounted`, `renewedAtMs`, `resume`. The transitions are closures (`refresh`, `onReceived`, `watch`, `askOnce`, `askUnsettledAtEnd`, `askCore`). The mobile player holds an unrelated second machine | This unit failed three gates in a row (G94b-02, G94c-01, G94d-01), each time on an order of real media events the fake element did not produce. `test/13` section 6 item 3 says what is worth keeping is "the STATE MACHINE around the platform, written against recorded real event sequences". As written there is no machine to feed a recorded sequence to: it cannot be called without rendering the component | Extract a pure reducer `(fileState, event) -> (fileState, effects)` with an explicit state per file (`UNSEEN / WAITING / SETTLED / ASKED / STOPPED`), the component only translating DOM events and running effects. Record the three real sequences of the gates as fixtures. `STALL_CHECK_MS` and `SAME_PLACE_MS` go with it (R101-10) |
| **R101-05** | `apps/core-server/package.json:12-13`; root `package.json:37`; `src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts:238`, `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts:419`, `src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts:258`; `README.md` | **The scenario tests that cover the "booted order" defect class do not run in any documented command.** `npm test` runs core-server `--project unit` only. The seal e2e, the development-session e2e and the kill matrix are skipped unless `DEMS_SEAL_E2E=1`, `DEMS_DEV_SESSION_E2E=1`, `DEMS_KILL_MATRIX=<cells>`; no package script sets them and `rg` finds none of the three names in `README.md` | `test/13` section 6 item 1 names exactly these as the tests that would have caught G70b-01, G75b-01, G75c-01, G70c-01. A next engineer gets a green `npm test` and has not run them. The knowledge of how is in gate notes | Three scripts (`test:seal-e2e`, `test:dev-session-e2e`, `test:kill-matrix`) with the lock they need, and one README paragraph "what `npm test` does not run" |

### MINOR

| ID | Where | What | Why it matters | Remedy |
|---|---|---|---|---|
| R101-06 | web `features/devices/source-state.ts:42-62` (17 references), mobile `capture-selector/source-state.ts` (16); `delegation_progress/contract_wave_i_a2.md:81,121` | `checkedAt` is read by name on both clients and sent by no Core: 0 references in `apps/core-server` and in `packages/shared/src` outside one i18n key. The contract note says "NOT BUILT" | A member the Core does not send, scripted by client tests, is pattern 2 of `test/13` section 6 (G94-01, G94-04). Behaviour is right without it today (`sourceOpen` and `recording` carry the rule) | Build it (slice 30) or remove the branches and their test vectors |
| R101-07 | web `features/evidence/transcript-model.ts:138-153` + `transcript-pane.tsx:92`; mobile `features/transcription/stt-status-model.ts:58`; web `features/paired-devices/issue-panel.tsx:50`; both `deviceLog(s.audit.rows, ...)`; the tamper tile (GM-02, D239) | Clients derive facts from the replicated audit ring, which holds the newest 1,000 rows (`AUDIT_RING_SIZE`, `sim/constants.ts:48`) | Each such fact silently disappears or drifts when rows rotate. GM-02 is one measured case (21 shown, 18 true) and is still open by D239 | The Core states the fact where it is needed (revision reason on the revision, the never-verified count on a slice); the ring is for the audit page only |
| R101-08 | web `lib/own-capture.ts:97-112` (`reportedSigningKeyOf`); web `lib/seal-attention.ts:55-62` (`sealRetryingSessionOf`) | Two more server facts inferred: the Core's signing key from the newest sealed item's signature ("Not reported" until something is sealed); "the Core is running a retry" from `step.attempt > 1` plus `isOwnCapture` | Same class as R101-01, smaller. Mobile has no equivalent of the second, so the two clients can disagree on "retried" | `security.signingKey` and `finalization.retrying` stated by the Core |
| R101-09 | mobile `features/session-summary/summary.model.ts:55-58`; `sealing-host/session-reader.ts:105`; `packages/shared/src/evidence-package/manifest.ts:113-117` | `timeSource` is the bare enum `GNSS / NTP / RTC`. A real-capture Core signs `source: 'RTC', state: 'HOST_SYSTEM_CLOCK'`; the summary of a PAST session is labelled "host clock" when the CURRENT `time.hostClock` is true and the stored source is `RTC` | A session's time source is read through today's Core state. A database that changes operation shows the wrong word for old sessions | Next manifest revision: `HOST_SYSTEM_CLOCK` as a value of field 17; the session entry stores it; no reader combines it with the live slice |
| R101-10 | `packages/shared/src/realtime/use-retry-cooldown.ts:3-5`; web `features/evidence/use-retry-cooldown.ts:8-9`; mobile `evidence/sealed-player.tsx:124-125`, `export-job-status.tsx:30-31`, `transcript-pane.tsx:66-67`; nine `*-boundary.tsx` files; `SAME_PLACE_MS` in both players | The retry cool-down (3 s base, 3 retries) is implemented three times and its base is written 13 times; `SAME_PLACE_MS = 1_500` twice | One rule, many places. The two hooks already differ (one caps at 15 s) | One hook and one constant set in `packages/shared`. Magic numbers that ARE in one place and need no change: `EVIDENCE_MEDIA_SESSION_TTL_MS` (`api/capture.ts:107`, reused by the export link), `SEAL_RETRY_DEFAULTS` 5 / 30 / 120 s (`way-out.ts:61`), `MEDIA_STOP_MEMORY_ENTRIES`, `MEDIA_SESSION_CHECK_EVERY_PIECES`, `STALL_CHECK_MS` |
| R101-11 | `packages/shared/src/i18n/en/*`, `apps/core-web/src/i18n-web.ts` (328 lines), 25 mobile `i18n` files | 78 English sentences of 28 characters or more are identical in more than one tree (68 shared + mobile, 8 web + mobile, 2 shared + web); a lower bound (one-line entries only). `i18n-web.ts` exists because "the shared resources were closed to this driver in wave I" (`:4`) | A wording ruling must be applied in two or three places; D236 already had to make one sentence equal on web, tablet and phone by hand | Fold `i18n-web.ts` and the 76 mobile duplicates into the shared tree; a test that fails on an identical sentence in two trees |
| R101-12 | `apps/core-server/test/support/lane-seal-rig.ts`, `lane-source-rig.ts`, `lane-camera-stub-cli.ts:48-140` against `src/index.ts:25-109` | The two rigs repeat `once()`, the ENOENT read, the `report` port and `prepare*` branch for branch. The launcher repeats the entry point's `refuseToStart` / `fatal` / `shutdown` / signal wiring | Every gate lane with the stub ran through the launcher, not through `src/index.ts`: a change of the entry point's shutdown is not what the gates exercise | `startCore(app, hooks)` exported from `src/` and called by both; one `createSwitchFileRig` for the two rigs |
| R101-13 | `apps/core-server/src/capture/fence/index.ts:250-251, 262-284, 305-311` | Two adapter lists beside the registry (note 161 section 9). `fakeAdapterOf` pushes into the list and into `closers` before `registry.register` runs: a refused registration leaves an adapter the registry does not hold. Nothing ever leaves the lists | The M-S2 defect was a second list out of step with the first | `probeAdapters()` from the registry's own cameras and microphones; register first, then keep the closer |
| R101-14 | `packages/shared/src/sim/events.ts:254-281`; `sim/session-machine.ts:346,584,811,857,1000` (`sentFrom(sendingDeviceOf(...))`); the same regular expression at `events.ts:255` and `session-machine.ts:887` | The central rule of wave K stamps the sending device on every row; the per-row members of wave I are still there. The old path is redundant, not dead: `:623` (an engine-timed row taking the pre-check's device) is the one site the central rule does not cover | Two paths for one rule; the next reader cannot tell which one is in force | Keep `:623`; remove the five others with a test that the rows are unchanged; one exported pattern |
| R101-15 | `apps/core-server/src/media-stream/service.ts:481, 488-494` | (a) Any error in the stream that is not a `MediaSourceError` becomes `FRAGMENT_NOT_OPENED` and the original error is logged nowhere; the WARNING audit row then names a fragment. (b) `sessionOpen(...).catch(() => false)`: a database error during the check ends the stream and the log line says "its sign-in session ended" | A fail-closed cut is right; the stated cause can be wrong, in the audit trail, for a fault that is not about the evidence | Log the original error with its own code before the conversion; a separate reason for "the session could not be read" |
| R101-16 | 3,357 lines in 768 non-test files of the four trees name a wave, a pass, a finding or a decision; `engine/restart-fault.ts:1-46` (46 lines of history for 20 lines of code) | Comments explain how the code came to be. The rule of the code is in them, but so is what was wrong before | The history is in git and in the notes; in the file it hides the one sentence a reader needs, and it ages | Keep the rule and the "why"; move "what was wrong" to the note it cites. Not a sweep to do before handover |
| R101-17 | `test/14_consolidation_*.md`, `test/15`; 73 notes under `implementation/` and `gateway_check/` | The consolidation removed 167 test files that exist nowhere now. All 167 are named in the six consolidation reports, so a map exists, but in six tables. 461 mentions in 73 older notes, and `test/13` section 6 (the protected list), still use the old names. In code: 56 mentions, all "Moved here from ..." provenance lines | A reader of a gate report cannot open the test it cites | One file `test/17_test_file_map.md`: old path, new path, generated from the six reports; one line at the top of `test/13` pointing at it |
| R101-18 | `README.md` "Known limits" (33 items) | The platform class of `test/13` section 6 item 3 (media stack, layout hit boxes, native mounting: G94b-01, G94b-02, G94c-01, G94d-01, G81b-03, G89-02) is stated only in `test/13`. README says nothing of what is provable only on a device or in a browser, nor that `expo-video` is a mock in Jest (`apps/mobile/jest.setup.ts:69`) and jsdom has no media stack | The next engineer will trust a green player test | One README limit with the list of flows that need a device or a browser, pointing at the scripted flows of the gates |
| R101-19 | mobile `features/evidence/evidence-detail.test.tsx` (35), `media-session-canary.test.tsx` (5), `pairing/*` (4), others: 58 `}, 30_000)`; web `clearToasts()` in 35 files (note 163:260) | Per-test ceilings six times the default, and a real 350 ms wait per test | A ceiling hides a test that became slow; the wait is part of the 38-54 % of file time `test/13` measured as waiting | As note 163 proposes: remove the ceilings with the measured timings; the toast exit on the runner's fake timers |
| R101-20 | `apps/core-server/src/credential-store/index.ts:277-285` | R69-09, still open: `retainOnly` has no product caller (`graft callers retainOnly --depth 2`: none). The gap is stated in the two comments and as README limit 22 | Replaced credential key files accumulate | An owner-side unit; next task |
| R101-21 | `apps/core-server/src/db/migrations/0001_tables.sql:257, 282` | `profile_id IN ('STANDARD_1080P25')` is a CHECK with one value while real capture records and signs what the stream is (`H264_720P30` on the generated sources, D229). D231: "the New Session `profileId` label [is] not in this task" | The session's stored profile and the manifest's profile are two unrelated statements | Either the session input stops carrying a profile, or the CHECK takes the registry's codes |
| R101-22 | audit type set (67); D237 "G75e-07 NOT built" | No audit type fits an acknowledgement that closes nothing | The next acknowledgement feature will bend an existing type | The 68th type as the first contract change of the next task |
| R101-23 | `apps/core-server/src/db/mapping/rows.ts:767-769`; D231 | Dataset `model`, `firmware`, `poePort` of FAKE rows stay stored and are hidden by each client; built-in capabilities come from the simulator dataset by device id | "Stored and not drawn" is a per-surface promise (R101-01 again) | Null these columns for FAKE rows in the seed; capabilities from the adapter |
| R101-24 | `packages/shared/src/sim/selector-in-force.ts`; mobile wrapper `capture-selector/selector-in-force.ts` | The session slice keeps the selector snapshot of a SEALED session; 14 readers preferred it (G70c-01) until one helper. Nothing stops a fifteenth reader from reading the snapshot directly | The defect returns with the next screen | A static rule: the snapshot member is read only inside `selector-in-force.ts` |

### NOTE

| ID | Where | What |
|---|---|---|
| R101-25 | `apps/core-web/src/components/shell/integrity-checks.ts:95-120` | The pill cause is a string protocol (`'KIND:x'`, `'COUNT:n'`) parsed with `slice(5)` / `slice(6)`. A tagged union costs nothing more with a value-comparing selector |
| R101-26 | 24 sites in 15 mobile files, e.g. `session-finalizing/seal-attention.tsx:46-62` | Selectors return `JSON.stringify(...)` and the hook parses it back, for stability; the web reads the same store with flat objects. One convention would do |
| R101-27 | `sealing-host/index.ts:239-247` | `track()` drops a rejection without a line. Every tracked function read (`sweepSealedScratch`, `sweepSealedSessions`, `reportQuarantine`, `finishUnsealable`, `nothingDurable`, `rejected`, `noteProfileDiffers`) catches inside, so nothing is lost today; the convention is not enforced |
| R101-28 | `test/support/lane-seal-rig.ts:119-120, 196-203` | Development only: the switch file is read synchronously at every fragment; `qualified` and `said` grow with the sessions of a run; the bind is read, then a database read, then a write (one seal at a time, so no race today) |
| R101-29 | `media-stream/service.ts:377-394` | The one-row-per-stop memory is in the process: after a restart the same stop writes one more row within the 60 s. The concurrent case (G94d-02) is closed correctly: the mark is set in the same turn as the test and taken back when the row fails |
| R101-30 | `apps/core-server/src/config.ts:25-31` | Two waived edits beyond the OD-14 list, each ruled and marked (D198, D207) |
| R101-31 | working tree | `decisions/decisions.md` modified and one progress note untracked: docs, for the closing commit |
| R101-32 | notes 162 section 3.3, 163:258 | Left by row 97 and accepted here: 7 contract values and 28 types of this task unused, 118 names and 21 i18n keys that predate it, RC-4 (the 250 ms lag sampler in all modes) waiting for a decision. `SEAL_BLOCKED_MESSAGE_MAX = 600` (`engine/sealing-notice-doors.ts:123`) is a server constant only; `rg` finds no bound for it in the shared schemas |
| R101-33 | `features/devices/source-state.ts` (web) and `capture-selector/source-state.ts` (mobile) | The "Not checked / Reachable / Not reachable" rule is written twice in different shapes (2 identical code lines of 27 / 65). They agree by the ruling of wave L; a shared function with both clients' vectors would hold them there |

## 3. Answers to the brief's questions that are not findings

**Layering (question 2).** Sound. No file under `src/` imports `test/`. The rigs and the launcher
import `src/`, never the reverse; `src/` offers two fenced seams
(`sealingHost(app).replace({ developmentSealer })`, refused outside REAL_DEVELOPMENT by the host
itself, `sealing-host/index.ts:146-148`; `captureFenceControl(app).installDevelopmentSourceSwitch`).
Each rig asks the fence first and throws for REAL_PRODUCTION before `app.ready()`. The production
entry point cannot load the stub.

**Shared or duplicated (question 1).** Shared and read through one function on both clients:
`selector-in-force`, `sealAttentionOf` / `sealBlockedNoticeOf` / `unsealableNoticeOf`,
`captureFactsOf`, `isHostClockTime`, `isPlatformNotReported`, the capture-fault wording.
Duplicated: `verify-v2`, `item-v2`, `transcript-model`, `sealed-playback`, the checkpoint reader
(R101-03); `source-state` (R101-33); the retry cool-down (R101-10); `media-session` (50 identical
code lines of 176 / 98) and `item-facts` (47 of 211 / 216) share little and are platform-shaped.

**Resource safety (question 6).** By reading: the seal retry is bounded (three delays, then
BLOCKED), its timer is cancelled per session and at close (`way-out.ts:392-405`,
`sealing-host/index.ts:665-670`). The pre-check probe is bounded by a timeout with `finally`
(`capture-notices/probe.ts:79-110`). The media readers hold no file handle across a `yield`
(`source.ts:201-213`). The web probe clears its timer on every path (`media-session.ts:329-357`).
The web player clears its watches at unmount (`sealed-player.tsx:416-423`); the mobile player
removes every subscription (`:439, :463`). The supervisor uses injected timers (scan only).
Exceptions: R101-15, R101-27.

**Test design (question 7).** The four classes of `test/13` section 6: (1) booted order: covered by
scenario files, three of which are gated and undocumented (R101-05);
`capture-discovery.booted.db.test.ts` and `restart.db.test.ts` run in the db suite. (2) producer
missing: the contract-example tests and the fake transport's check exist; R101-06 is a live
instance they do not catch (an optional member no producer writes). (3) platform: not coverable;
stated only in `test/13` (R101-18); the state machine around it is not extractable (R101-04).
(4) true statement in the wrong mode: covered by `real-core-facts.test.tsx`,
`real-capture-one-rule.test.tsx` and the manifest-facts tests, per surface; structurally open
(R101-01, R101-02).

## 4. The largest product files the waves touched

CSS, generators and the OpenAPI document excluded. "Split" is a judgement by size and role; files
marked (scan) were not read in full.

| Lines | File | Split? |
|---|---|---|
| 2,694 | `packages/shared/src/live/source/live-sim.ts` | (scan) yes, by slice family |
| 1,971 | `packages/shared/src/sim/session-machine.ts` | yes: the sending-device rule, the pre-check and the finalization are three machines (R101-02, R101-14) |
| 1,937 | `packages/shared/src/sim/api.ts` | (scan) yes, by operation family |
| 1,754 | `packages/shared/src/sim/types.ts` | no: types |
| 1,440 | `packages/shared/src/api/evidence.ts` | no: contract |
| 1,432 | `apps/core-server/src/capture-session/index.ts` | (scan) yes: wiring and fact writing |
| 1,408 | `apps/core-server/src/engine/host.ts` | (scan) the doors already moved out; continue |
| 1,334 | `packages/shared/src/api/core-api.ts` | no: registry |
| 1,314 | `apps/core-server/src/db/reset/routine.ts` | (scan) yes |
| 1,274 | `packages/shared/src/api/state-slices.ts` | no: contract |
| 1,215 | `apps/core-server/src/capture/supervisor.ts` | (scan) reviewed at M3 |
| 976 | `apps/core-server/src/sealing/pipeline/pipeline.ts` | (scan) no |
| 905 | `apps/mobile/src/features/session-recovery/session-recovery-screen.tsx` | (scan) yes |
| 887 | `apps/core-server/src/capture/fragments.ts` | (scan) no |
| 834 | `apps/core-web/src/features/evidence/sealed-player.tsx` | **yes (R101-04)** |

Also asked for: mobile `session-new-screen.tsx` 789 (17 hooks; split the steps' data from the
screen), mobile `sealed-player.tsx` 671 (R101-04), `sealing-host/index.ts` 749 (a composition
root with four boot steps; acceptable, the boot steps could be a file), `media-stream/service.ts`
513 of which about 100 are header (fine), `capture/fence/index.ts` 529 (fine; R101-13),
mobile `status-tiles.tsx` 162 (fine).

## 5. The earlier reviews' deferred items, and their state

| Item | State at 713d83f |
|---|---|
| R69-09 replaced credential keys never destroyed | OPEN, recorded (README limit 22; R101-20) |
| R80-10 duplicate client rule files; R88-17 duplicated client model | OPEN and worse: the copies now differ in behaviour (R101-03) |
| R96-1 asset README notes | CLOSED (`f48fe86`: the generators write the notes; a test holds them). Residual: the text above the note is not compared with a generator run (note 162 item 10) |
| `seed.ts` dead builders kept by guard SEC35-41 (c) | CLOSED (`a02e305`: the guard reads the live writer; the builders are gone) |
| R80-05 `TIMEOUT` signed as "backend unreachable" | OPEN, recorded (README limit 28) |
| R80-08 orphan signed revision after a failed commit | OPEN, recorded (README limit 9) |
| R74-08 stop and end on one chain | OPEN; not in the README list |
| R74-14 (2) wrong sentence in the first moments after a crash | OPEN, recorded (README limit 27) |
| R88-10, R88-12 unsealed development folder blocks reset; session keys not destroyed | OPEN, recorded (README limits 29, 23) |
| R88-14 trusted set = current certificate | OPEN, recorded (README limit 30) |
| R88-16 `clockOffsetMs` stand-in | OPEN, recorded (README limit 31) |
| R88-15 re-hash before removal; R88-19 nine codes without a test; R88-18 two stale headers; R88-13 first half | OPEN; not found in the README list (not re-checked in code) |
| R63-16 video of a camera given up by the floor | OPEN, recorded (README limit 4) |
| G70b-06 `checkedAt` | OPEN (R101-06) |
| G75e-07 acknowledgement audit type | OPEN (R101-22) |
| GM-01, GM-02 (D239) | deferred by ruling to the batch after the UI judging session; not re-checked in code |
| Row 97 blueprint list (B8, B12, row-25 / row-26 items) | as note 163 reports; RC-4, `clearToasts`, the 58 ceilings open (R101-19, R101-32) |

## 6. Legacy-code risk (question 5), in one table

| Leaned on, not owned | Risk if the next task builds on it as is | Smallest sound change |
|---|---|---|
| The in-app simulator as the Core's engine state | R101-02 | Three entry points and one import rule |
| The engine's fault model (`POWER_FAIL` + `coreNotRunning: true` as "the Core was not running") | A fault kind that means two things by a flag; every reader must test the flag (`integrity-checks.ts:108`, `use-home-data.ts:69`) | A fault kind of its own |
| Device slice with dataset values for FAKE rows (D231) | R101-23 | Null the columns for FAKE rows |
| `profileId` under a CHECK | R101-21 | Drop it from the session input or widen the CHECK from the registry |
| `timeSource: RTC` as a bare enum | R101-09 | A fourth value in the next manifest revision |
| The audit type set | R101-22 | The 68th type |
| Session slice keeping sealed snapshots | R101-24 | A static rule on the member |

## 7. If I owned this next: ten changes, best ratio of risk removed to effort first

1. Scripts and a README paragraph for the three gated scenario suites (R101-05). An hour.
2. `v2FilePartOutcome` and the two item readers under one shared test with one set of vectors; decide the four differences (R101-03, first half). Half a day.
3. Move `verify-v2`, `item-v2`, `transcript-model`, `sealed-playback` and the checkpoint reader to `packages/shared` (R101-03, second half; closes R80-10 and R88-17). A day.
4. `core.captureOperation` stated by the Core, one shared reader, the seven inferences replaced (R101-01). Two days; removes the defect class of five gates.
5. The import rule for `@dems/shared/sim` in the Core's guard family, first as a list of today's six exceptions (R101-02). Half a day for the rule; the split of the package follows.
6. The stall watch as a pure reducer with the three recorded gate sequences as fixtures (R101-04). Two days.
7. Remove the `checkedAt` branches or build the member (R101-06). Half a day.
8. One test-file map and one README limit for device-only and browser-only checks (R101-17, R101-18). Two hours.
9. `startCore()` shared by `src/index.ts` and the launcher; one switch-file rig (R101-12). Half a day.
10. Log the original error at the media route's cut and name the session-read failure (R101-15). An hour.

## 8. What was done well

- Development tooling is outside `src/`, enters through two fenced seams, and is refused twice in production.
- Every failure of the seal has a bounded way out, with named settings and a timer that is released.
- The media route authenticates the first fragment before the status line, holds no handle across a yield, and closes the concurrent-stop race in one turn.
- The real-capture manifest reader lists, field by field, what it refuses to take from the engine state.
- `selector-in-force` and the seal-attention readers show the pattern the rest should follow: one shared function, both clients.
- The hygiene pass reported its own wrong removal and put it back.

## 9. Not proven by this review

- Whether case (1) of R101-03 is reachable with a real verification answer.
- `supervisor.ts`, `capture-session/index.ts`, `engine/host.ts` and the mobile player were scanned, not read.
- OpenAPI against registry against examples was not re-derived; it rests on the pins the suites run (`api-registry.test.ts`, `api-openapi-scope.test.ts`).
- The i18n count is a lower bound (one-line entries of 28 characters or more).
- No suite was run; counts of passing tests are the final test run's, not this review's.

---
*Generated: 2026-10-11*
