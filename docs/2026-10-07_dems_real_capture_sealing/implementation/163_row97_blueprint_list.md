---
task_id: 2026-10-07_dems_real_capture_sealing
row: 97, second pass (the row's OWN list: B8, B12, row-25 F2..F4, row-26 F1..F4, AU1 re-checks)
date: 2026-10-11
agent: coder-execution
base_commit: 951c80e + the uncommitted first hygiene pass (implementation/162_row97_hygiene.md)
status: needs-review (section 1 was written BEFORE any change)
---

# Row 97, second pass: the blueprint's own list

TF = `docs/2026-10-07_dems_real_capture_sealing/`, P = `docs/2026-10-04_dems_backend_rbac_pairing/`.
Row text: `TF/identification/02_structured.md:429`. Routing tables: `02_structured.md:527-540`
(section 8), `TF/masterplan/02_plan.md:268` (M9-W3) and `:474-491` (G.1). Check `M9-HYG-1`:
`TF/masterplan/10_test_strategy.md:649` ("B8 mobile items, B12 RC-2..RC-7 nits closed or carried
with a named decision").

## 1. Item table (state on the tree BEFORE this pass)

| Item | What it asks (quoted) | Where defined | State today |
|---|---|---|---|
| B8 / W93-10 | "Draw `PairingScreen` in place when `useBootHref()` is `/pair` ... skip the enter rise for that hand-off ... Pre-rasterise the topo texture ... Measure on the W98 release build" | `P/verification/12_code_review_mobile.md:93`; not done at FXR-M: `P/decisions/decisions.md:252` (D246: "documented — an in-place Pair would mount two pairing flows") | OPEN. Product behaviour (navigation, entrance motion) and a device measurement: not hygiene |
| B8 / W93-18 | "Three copies of the same module-level 'one slot' mark ... `createHandoffMark()` in `src/lib`, used three times" | `P/verification/12_code_review_mobile.md:101` | OPEN. `apps/mobile/src/features/session-live/monitor-handoff.ts:17-29`, `session-summary/summary-handoff.ts:13-25`, `session-finalizing/handover.ts:16-28` are still three copies. A pure move: within hygiene |
| B8 / W93-19 | "Three hand-rolled 'React-held final state + overlay with an id, removed after a budget' hooks ... `useTransientOverlay(trigger, budgetMs)`" | `P/verification/12_code_review_mobile.md:102` | OPEN. Judged in section 3 after reading the three hooks |
| B8 / W93-26 | "The stacked/inline decision depends on hand-measured text widths ... Measure label and readout with `onLayout`" | `P/verification/12_code_review_mobile.md:109` | OPEN. `apps/mobile/src/features/network-time/network-status-card.tsx:41-48` still holds `label: 72`, `readout: 84`. A layout behaviour change that only a device shows: not hygiene |
| B8 / W93-27 | (Info) "In LIVE, when `useCoreLinkNotice().offline`, word the row 'Unknown — Core link down'" | `P/verification/12_code_review_mobile.md:110` | OPEN. `apps/mobile/src/features/devices/devices-model.ts:103-104` unchanged. New UI wording = product behaviour and a vocabulary decision: not hygiene |
| B8 / B15 empty frame | "an empty frame Login to Home on the tablet" (observation) | `P/report/01_report_inputs.md:214` (D249); routed `02_structured.md:527` | OPEN. An observation on a device with no code cause named; needs a device to reproduce. (B15's other two halves are done: tiles row 73, `TF/implementation/32_m5_mobile_mic.md:42`; device ID row 48) |
| B12 / RC-2 | "`EMPTY_TEMPLATE = 'template0'` now has no importers ... Delete the export" | `P/verification/13_post_review_recheck.md:110` | OPEN. `apps/core-server/test/helpers/db/constants.ts:30`, 0 importers |
| B12 / RC-3 | "After `prepared = true`, a log folder removed from outside makes the next append fail, and that entry is lost ... Optional: in the `catch`, if `prepared` was true, run one `mkdir` + append retry" | `P/verification/13_post_review_recheck.md:111` | OPEN. `apps/core-server/src/plugins/logger/error-log.ts:186-203`; pinned as is by `error-log-rotation.test.ts:100-108` (3 appends, 1 line). A defect fix the row assigns: failing-first test |
| B12 / RC-4 | "The 250 ms lag sampler runs during every session window in all modes ... Gate the sampler (and the record) on a Live source, or drop it after W98 has its data" | `P/verification/13_post_review_recheck.md:112` | OPEN, and changed since: row 62 built the late-stop record on the same sampler and pins the simulator case (`apps/mobile/src/runtime/session-diagnostics.test.tsx:175`). Judged in section 3 |
| B12 / RC-5 | "The boundary record also carries `componentStack` ... Drop `componentStack`, or keep it and say so in the header" | `P/verification/13_post_review_recheck.md:113` | OPEN. `apps/core-web/src/features/devices/panel.tsx:100-104` header still says "a fixed sentence, the panel and the error's class"; `:112` sends `componentStack` |
| B12 / RC-6 | "`pid()` returns `undefined` when a line has no `[pid]` ... Add `expect(pid(line)).toBeDefined()` before the comparison" | `P/verification/13_post_review_recheck.md:114` | OPEN. `apps/core-server/test/db/pg-behaviours.db.test.ts:272-278` |
| B12 / RC-7 | "The waiting screen has no on-screen way out and no time limit ... Optional: a 'Back to Home' link on the screen, or a note in the runbook" | `P/verification/13_post_review_recheck.md:115` | OPEN. `apps/mobile/src/features/session-new/start-entry-checking.tsx` has no link. The link is new UI; the runbook note is a documentation edit |
| row-25 F2 | "its `afterEach` awaits the shared `clearToasts()`, which sleeps a real 350 ms when exiting toast keys exist ... converts `clearToasts` to the shared fake clock" | `TF/gateway_check/02_b10_test_hygiene_review.md:120` | OPEN, grown: the helper is in 35 core-web files today (was 30) |
| row-25 F3 | "`waitForSheetExit` still sleeps `SHEET_EXIT_MS + 50` real ms ... converting the harness helper to a runner-clock advance, with the two caller files in scope" | `TF/gateway_check/02_b10_test_hygiene_review.md:121` | OPEN. `apps/mobile/src/features/session-live/testing/monitor-harness.tsx:33-37`; callers `live-session-live-sites.test.tsx:179`, `session-live-screen.test.tsx:105,123` |
| row-25 F4 | "20 mobile test files still carry `jest.setTimeout(30_000)` ... re-times each `30_000` file and removes the override where the config default 20000 has headroom" | `TF/gateway_check/02_b10_test_hygiene_review.md:122` | OPEN. 22 files at 30_000 today, plus `sealed-player.test.tsx:27` at 40_000 (added by this task) |
| row-26 F1 | "Correct the citation to `packages/shared/src/sim/session-machine.ts:705`" | `TF/gateway_check/03_rc1_review.md:61` | DONE by the W9 row-22 follow-up: `TF/implementation/07_rc1_recording_elapsed_monotonic.md:10` and its section 8 (`:241`, "F1 ... APPLIED") |
| row-26 F2 | "Add a 4th case: stop A, start B, assert B draws 0 then grows from its own start" | `03_rc1_review.md:62` | DONE (same follow-up): `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx:236` "session boundary: a NEW session after a stop does not inherit the held second" |
| row-26 F3 | "add a `createElapsedTicker` unit case ... that calls `freeze()`" | `03_rc1_review.md:63` | DONE: `apps/mobile/src/features/session-live/elapsed-ticker.test.ts:93,112` |
| row-26 F4 | "Reword to 'consistent with D255's demo display tolerance; not explicitly ruled'; add 'hub row: no step-back across the SEALED->history swap' as a follow-up" | `03_rc1_review.md:64` | DONE and overtaken: ruling D19(b) (`TF/decisions/decisions.md:31`) and RV-CODE (`TF/implementation/09_rv_code_audit_fixes.md`) removed the hold; see AU1-2 |
| B5 / B6 / B7 | "splits only per OD-26 (not scheduled here)" | `02_structured.md:524-526`, `:597` | NO LONGER APPLIES to this row (OD-26 default (b): after M9 or a separate task) |
| B13 | "only if a release build is made" | `02_structured.md:532`; `P/report/01_report_inputs.md:212` | NO LONGER APPLIES: no release build in this task (`release/` and `.cache/release/` are dated 2026-10-01, before the task) |
| AU1-1 | re-check: "`:132` scramble deterministic" | `TF/verification/20_audit_code_tests.md:273`; fix `TF/implementation/09_rv_code_audit_fixes.md:18` | DONE BY RV-CODE (D21, `decisions.md:33`); re-checked in section 4 |
| AU1-2 | re-check: "SEALED-swap fake-clock test green" | `20_audit_code_tests.md:274`; ruling (b) `decisions.md:31` | DONE BY RV-CODE; re-checked in section 4 |
| AU1-5 | "Change to `expect(drawn()).toBe(ticked)` at the three sites" | `20_audit_code_tests.md:277` | DONE BY RV-CODE: 0 `toBeGreaterThanOrEqual` in `live-rc1-elapsed-stop-hold.test.tsx`; re-checked in section 4 |
| AU1-6 | "replace it with a fresh one, or document the invariant" | `20_audit_code_tests.md:278` | DONE BY RV-CODE: `apps/mobile/src/runtime/recording-elapsed.ts:151,162-166,190-191`; re-checked in section 4 |
| "each hygiene edit a separate small commit" | verification column of the row | `02_structured.md:429` | NOT POSSIBLE in this run (no git write by the driver rules); the edit groups are listed in section 7 for the commit |
| dependency review | (the brief's example) unused or duplicate dependencies | `TF/gateway_check/01_b2_dependency_review.md:249` | NOTHING ROUTED: the review's only finding R24-01 is "No code action"; row 97 names no dependency item. No `package.json` is touched |

Items of note 162's open list given to this pass: (1) SEC35-41 (c) guard on dead code, (3)
`.gitignore`, (4) the three dated-history lines, (8) the stale PENDING comment, (9) the missing
direct comparison of the two adapter-kind lists. Their states are in section 5.

## 2. Result per item (short)

| Item | State after this pass |
|---|---|
| B8 / W93-18 | DONE (3.1) |
| B8 / W93-10, W93-19, W93-26, W93-27, B15 empty frame | NOT DONE: each needs a product behaviour change, a device, or a decision (section 6) |
| B12 / RC-2 | DONE (3.2) |
| B12 / RC-3 | DONE, defect fix with a failing-first test (3.3) |
| B12 / RC-4 | NOT DONE: needs a decision (section 6) |
| B12 / RC-5 | DONE, the "say so in the header" branch (3.4) |
| B12 / RC-6 | DONE (3.5) |
| B12 / RC-7 | DONE, the "note in the runbook" branch (3.6); the on-screen link is not built |
| row-25 F2 | NOT DONE: the remedy as written cannot work; two real routes, each a decision (section 6) |
| row-25 F3 | DONE (3.7) |
| row-25 F4 | DONE: 23 overrides removed after re-timing (3.8) |
| row-26 F1..F4 | already done (section 1); nothing changed |
| AU1-1, -2, -5, -6 | re-checked green, test names quoted (section 4); no residual found |
| B5 / B6 / B7, B13 | no longer apply to this row (section 1) |
| note 162 (1) SEC35-41 (c) | DONE: guard re-pointed at the live writer, dead exports removed (5.1) |
| note 162 (3) `.gitignore` | DONE (5.2); one reading of the brief to confirm |
| note 162 (4) three history lines | DONE: plain wording back, rule made precise in M9-PIN-1 (5.3) |
| note 162 (8) PENDING comment | DONE (5.4) |
| note 162 (9) adapter-kind comparison | DONE: rule A-7 (5.5) |

## 3. Items of the row worked

### 3.1 W93-18: one hand-off mark
New module `apps/mobile/src/lib/handoff-mark.ts` (`createHandoffMark()`: `mark`, `is`,
`resetForTests`). The three modules keep their exported names and signatures and hold one mark
each: `features/session-live/monitor-handoff.ts`, `features/session-summary/summary-handoff.ts`,
`features/session-finalizing/handover.ts` (bodies only; no caller changed). One difference, not
reachable: `handover.ts` used `!== null`, so an EMPTY-string id was markable there; the shared rule
uses the truthiness the other two used. Session ids are never empty.
Test: `apps/mobile/src/lib/handoff-mark.test.ts` (new module, so its own file, named after it; 2
cases: the rule; the three hand-offs hold separate slots). The nine existing hand-off test files
(`monitor-handoff-in-place`, `summary-handoff-in-place`, `live-stop-handover`, ...) run unchanged
and green in the mobile suite.

### 3.2 RC-2
`apps/core-server/test/helpers/db/constants.ts`: the unused `EMPTY_TEMPLATE` and its comment
removed (2 lines). `rg EMPTY_TEMPLATE\b apps packages scripts` = 0. The one constant is
`EMPTY_DATABASE_TEMPLATE`, `apps/core-server/src/db/commands/statements.ts:13`.

### 3.3 RC-3: the entry after an outside removal of the log folder is no longer lost
Cause: `apps/core-server/src/plugins/logger/error-log.ts`, `append`: in the steady state
(`prepared === true`) no `mkdir` runs, so the append after the folder was removed failed and only
the NEXT append prepared the folder again.
Change: `error-log.ts:191-217`: the body is one `write()`; when it fails in the steady state the
folder is prepared again and THIS entry written once more; a failure while preparing is not tried
twice; nothing throws. Header `:23-26` states it.
Tests, in the existing `src/plugins/logger/__tests__/error-log-rotation.test.ts`: the old case
"a failed append never throws, and the next append prepares the file again" (which pinned the loss:
3 appends, 1 line) is REPLACED by `:103` "the folder removed from outside: the next entry is not
lost, the file is made again with mode 0600" and `:119` "a failed append never throws, also when
the second try fails; a later append prepares the file again".
Failing first: before the fix `1 failed | 8 passed (9)`, `ENOENT ... gone/errors.log` at the new
`:109`; after: logger folder `5 files, 62 passed`.

### 3.4 RC-5
`apps/core-web/src/features/devices/panel.tsx:100-105`: the header now says that the record carries
React's `componentStack` (as eight other error boundaries of the console do) and never the error's
message or its own stack. No code change.

### 3.5 RC-6
`apps/core-server/test/db/pg-behaviours.db.test.ts:278-280`: `expect(pid(line)).toBeDefined()`
before the same-backend comparison. Green in the db suite; it can fail (a line without `[pid]`
gives `undefined`).

### 3.6 RC-7
`README.md:781`, Troubleshooting: a row for "Start Session stays on 'Checking your permissions…'"
(what it waits for, that it has no button and no time limit by design, how to leave). The
on-screen "Back to Home" link is new UI and was not built.

### 3.7 F3: `waitForSheetExit` without a real wait
`apps/mobile/src/features/session-live/testing/monitor-harness.tsx:32-61`: new
`holdSheetExitClock()` (one hand-over on a real 0 ms timer, then the runner's fake clock with
`nextTick` / `queueMicrotask` / `setImmediate` real, the pattern of
`live-session-live-link.test.tsx`), called BEFORE the press or delta that closes the sheet;
`waitForSheetExit()` advances `SHEET_EXIT_MS + 50` on that clock and restores the real timers.
Callers: `session-live-screen.test.tsx:103,108,125,127`, `live-session-live-sites.test.tsx:173,182`;
both files restore the real timers in `afterEach` (`:16`, `:30`) for a test that fails in between.
Why the hand-over: without it the first run was RED (`TypeError: Cannot set properties of undefined
(setting 'startTime')`, `FrameCallbackRegistryUI.ts:120`): the worklets mock registers a frame
callback on a real 0 ms timer, and the unregistration ran on the fake clock before it. Timers of one
delay fire in the order set, so one 0 ms hand-over orders them. X-FC-1 class of that line
(`monitor-harness.tsx:47`): a 0 ms hand-over, not a sleep.
Runs: both files `37 passed`; negative control (advance `SHEET_EXIT_MS - 50`): `3 failed, 34
passed` - exactly the three sheet tests; restored.

### 3.8 F4: per-file timeouts
Why they existed: chosen before decision T1, against jest's 5 s default, for slow rendering under a
loaded host (the two files that said so: `pairing-live.test.tsx`, `pairing-handoff-routes.test.tsx`,
"the budget is only for slow rendering"). None of the 23 files waits on a real engine or process:
their clocks are the bed's fake transport or the simulator's. Since T1 the workspace default is
20 s (`apps/mobile/jest.config.js:10`), and `masterplan/10_test_strategy.md:923` names it "the
single workspace ceiling".
Re-timed before the change (the 23 files alone, 2 workers, load 2.6 to 3.3): 295 tests passed;
slowest single test per file between 124 ms and 1,393 ms (`live-storage-sites`); 20 s is 14 times
the slowest.
Removed: `jest.setTimeout(30_000)` in 22 files and `jest.setTimeout(40_000)` in
`features/evidence/sealed-player.test.tsx` (added without a reason by the consolidation commit
`951c80e`; its slowest test: 310 ms); the two "Row CF-M1" comment blocks that explained the
override went with it; the `jest` binding was trimmed from the import in the 14 files where the
timeout was its only use. `rg 'jest\.setTimeout\(' apps/mobile` = 0.
After, in the whole mobile suite (2 workers): slowest test of the 23 files 1,385 ms; slowest test
of the suite 3,308 ms (`devices-states.test.tsx`).
Seen, not changed (outside F4's wording, same class): 58 per-test ceilings `}, 30_000)` /
`}, 40_000)` / `}, 15_000)` in `evidence-detail.test.tsx` (50), `media-session-canary.test.tsx`
(5), `login.test.tsx:169`, `devices-states.test.tsx:117`; their slowest tests in the same run:
1,879 / 789 / 310 / 3,308 ms.

## 4. Re-checks of the RV-CODE items (test names quoted; all green in this pass)

| Item | Test | Result |
|---|---|---|
| AU1-2 "SEALED-swap fake-clock test" | `apps/mobile/src/features/sessions/live-d19b-stop-duration.test.tsx`: "RECORDING (ticker 7 s ahead, no step back) -> late stop: one correction -> FINALIZING -> SEALED: exactly the recorded duration" | passed |
| AU1-2 | `features/session-live/live-rc1-elapsed-stop-hold.test.tsx`: "stop learned 7 s late while the ticker was 7 s ahead of the held store clock: ONE correction to the recorded duration"; "after the stop the recorded duration never moves: Core-clock and store time advance, no timer stays armed"; "a stop instant known while the replica still says RECORDING already ends the ticker half" | passed |
| AU1-5 | same file: 0 `toBeGreaterThanOrEqual` (rg) | holds |
| AU1-6 | same file: "AU1-6: if a stopped recording re-entered RECORDING it would count again on the Core clock, not show a frozen second"; code `apps/mobile/src/runtime/recording-elapsed.ts:151` (a frozen ticker is replaced), `:190-191` (the freeze runs in an effect) | passed |
| row-26 F2 / F3 | "session boundary: a NEW session after a stop does not inherit the held second, it counts from its own start"; `elapsed-ticker.test.ts` "RC-1: freeze() stops the advancement at the last drawn second and drops the armed timer", "RC-1: freeze() is idempotent, ..." | passed |
| AU1-1 "`:132` scramble deterministic" | `apps/core-web/src/test/live-paired-devices-issue.test.tsx`: `issueMarker()` `:92-104` fakes `setInterval` / `clearInterval` only, advances `SCRAMBLE_SETTLE_MS = 1_000`, asserts `vi.getTimerCount() === 0`, then the exact digits; no other `setInterval`, `setTimeout(` or `await new Promise` in the file | 20 passed |

Run: mobile `4 suites, 15 passed` (the three files + the new mark test); core-web that file `20
passed`. No residual of RV-CODE found; nothing changed in these files.

## 5. Items of note 162's open list

### 5.1 (1) SEC35-41 (c): the guard now reads the live writer
What the guard is for (`masterplan/09_security_design_review.md:639`): "(c) `DEFAULT 'FAKE'` makes
an INSERT that forgets the column a development device: safe for the manifest, unsafe for the reset
guard ... A static pin: every INSERT into `capture_devices` names `adapter_kind`".
Where the built-in FAKE devices are really defined: a seed writes its rows through `toRows`
(`apps/core-server/src/db/seed/seed.ts`, `rows = toRows(state, ...)`), so the five built-ins get
their kind in `apps/core-server/src/db/mapping/rows.ts`: `adapterKind: adapterKindOf(device)`
(`:859`), which returns `DEFAULT_CAPTURE_ADAPTER_KIND` = `'FAKE'` (`:813`, `:826`) for a slice
device that names no adapter. `captureBuiltInDevices` / `captureBuiltInConfig` /
`CAPTURE_SEED_PROFILE` had no caller on any path (rg over `apps`, `packages`, `scripts`; no dynamic
import of the seed names them).
Change: `apps/core-server/src/capture/__tests__/static.test.ts:887-909` (title "... and the one
builder of a typed row carries it"): the mapping names the member, states the default kind as the
literal `'FAKE'` and returns it for an unnamed adapter; the seed calls `toRows` and contains no
`adapterKind`, `adapter_kind` or `CaptureDeviceRow` (no second builder). Then the three dead exports
and the two type imports they needed were removed from `seed.ts` (66 lines).
Failing first: with the dead builders in place the new rule was RED (`expected ... not to match
/\badapterKind\b|.../`); after the removal the static guards are `19 files, 246 passed`. Negative
control: `DEFAULT_CAPTURE_ADAPTER_KIND = 'ONVIF_RTSP'` -> `1 failed`; restored (`git diff` of
`rows.ts` empty). On a database the same fact is `seed.db.test.ts:90` (M4-MT-15: the five built-ins
are `FAKE`), green in the db suite.

### 5.2 (3) `.gitignore`
Checked first: tracked `*.key`, `*.p12`, `*.jks`, `*.keystore`, `*.pfx`, `*.gguf`, `*.bin`, `*.onnx`,
`*.safetensors`: 0 each (the first five patterns were already there, `:31-37`). Tracked `*.pem`:
14, all `packages/shared/assets/demo-evidence/SESSION-*/device-certificate.pem`, each beginning
`-----BEGIN CERTIFICATE-----` (public certificates of the version-1 demo packages). Tracked media:
265 (`apps/mobile/assets/media` 28 mp4 + 28 m4a; `packages/shared/assets/demo-media` 56 + 56;
`packages/shared/assets/demo-evidence/**/media` 1 m4a; `docs/2026-10-04_dems_backend_rbac_pairing`
96 mp4).
Added, `.gitignore:84-122`: `*.pem` with the re-include
`!packages/shared/assets/demo-evidence/**/device-certificate.pem`; `*.gguf`, `*.onnx`,
`*.safetensors`, `ggml-*.bin`, `**/models/**/*.bin` (a `*.bin` elsewhere stays visible); twelve media
extensions with re-includes for the three asset folders and the predecessor's `*.mp4`.
Proof: `git ls-files -ci --exclude-standard` (tracked files that are ignored) = 0 before and 0
after; `git status --porcelain` before / after differs by the one line ` M .gitignore`;
`git check-ignore -v` samples: `x.pem`, `certs/server.pem`, `.../SESSION-X/private.pem`,
`models/ggml-large.bin`, `x.gguf`, `apps/transcriber/models/vad/a.bin`, `x.mp4`, `recordings/a.mkv`,
`a.wav`, `docs/2026-10-07_.../gateway_check/a.mp4` ignored; `apps/core-server/test/fixtures/frame.bin`
not ignored; the tracked certificate and a tracked demo clip match their `!` rule (`--no-index`).
`scripts/pg/init.test.mjs` "CR-7: git ignores the cluster, the three credential files and the logs"
(reads rule matches for path NAMES only): passed.
TO CONFIRM: the brief says for key material "if one [tracked file] is [newly ignored], stop on this
item". With a bare `*.pem` 14 would be; with the re-include none is, so the item was finished that
way. If the controller reads the sentence as "stop", the two `*.pem` lines are the ones to take out.

### 5.3 (4) Dated-history lines
Plain wording back (as at `951c80e`): `apps/core-server/src/plugins/permission-guard/__tests__/decision.test.ts:111`,
`packages/shared/src/api/core-api.ts:1058`, `packages/shared/test/api-registry.test.ts:171`.
Rule: an erratum in the M9-PIN-1 row of `masterplan/10_test_strategy.md:647` - a dated-history line
names the row or milestone at which the total held, is exempt, is not reworded, and is listed by
file:line; the check is "every line the literal grep prints is on the list".
Grep under that rule (scope of `test/16`): 3 lines, the three on the list, 0 others.

### 5.4 (8) The stale PENDING comment
`apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts:486-493`. The skip it spoke
of is gone and the cause is fixed: every start that rebuilds the ring clears the tamper overlay
(`apps/core-server/src/engine/host.ts:964-973`, finding F73, decision D106). Comment rewritten to
that; the title "PENDING (engine): ..." became "the engine alone: after a start in the mode resync,
the fault list and the audit view agree about AUDIT_TAMPER (F-5, closed by F73)". No skip, no
assertion changed; green in the db suite.

### 5.5 (9) The two adapter-kind lists, compared directly
`apps/core-server/src/capture/adapters/__tests__/static.test.ts:280`, rule "A-7: the adapter kinds
of the layer are the value set of the schema": `CAPTURE_ADAPTER_KINDS` (`capture/adapters/kinds.ts`)
equals `CAPTURE_ADAPTER_KIND` (`db/schema/value-sets.ts:143`), list against list, and the object's
keys too; three planted differences are seen. `kinds.ts:13-16` names the rule.

## 6. NOT DONE, with what each needs

| Item | Why not in this pass | Needs |
|---|---|---|
| W93-10 in-place Pair, no dark frame Login -> Pair | Changes navigation and the Pair entrance; D246 recorded that an in-place Pair mounts two pairing flows; the finding itself asks to "measure on the W98 release build" | a design decision, a device, a release build |
| W93-19 one `useTransientOverlay` hook | The three hooks (`nav-item.tsx:48-60`, `use-indicator.ts:83-97`, `app-tabs.tsx:112-127`) share only the five-line "remove after a budget" effect; their triggers and payloads differ (state change with the previous value; a frame change with from / to; the rising edge of focus). Merging them rewrites the FX-M2b code that fixed lost updates seen on the tablet | a device check of the bottom bar, the rail and tab fades after the merge |
| W93-26 measure the bandwidth row with `onLayout` | A layout behaviour change (stacked / inline) | a device or a decision to accept the measured constants |
| W93-27 "Unknown - Core link down" on the TABLET row | New UI wording in LIVE (Info finding) | a vocabulary and behaviour decision |
| B15 empty frame Login -> Home on the tablet | An observation with no code cause named | a tablet to reproduce and time it |
| RC-4 gate the 250 ms lag sampler on a Live source | Since the finding, row 62 built `runtime.diag.lateStop` on the same sampler, and `session-diagnostics.test.tsx:175` pins the simulator case ("no Core clock (a simulator): the Core waits are null, not invented"). Gating changes what the diagnostics record in SIMULATED and in release builds | a decision: gate (and re-pin the simulator case), drop after W98, or carry |
| RC-7 on-screen "Back to Home" | New UI | a decision (the runbook note is done) |
| F2 `clearToasts()` 350 ms, now 35 files, 73 call sites | The remedy "convert to the shared fake clock" cannot work in the helper: the kit arms the exit timer on the REAL clock when a toast closes during the test (`node_modules/@heroui/react/dist/components/toast/toast-queue.js:202-210`), before the helper runs, and a clock installed later cannot advance it. Two real routes: (a) the runner's fake timers for the whole test in 35 files (RTL polling and the beds would run under it); (b) `queue.destroy()` then a second `clear()` - no wait, but `destroy()` also drops the exit subscriptions of a MOUNTED provider, and 6 call sites are mid-test (`live-shell-notices.test.tsx:492`, `live-session-new-local-notice.test.tsx:279`, `live-session-monitor-actions.test.tsx:429`, `live-session-monitor-panels.test.tsx:250,291`, `live-system-maintenance.test.tsx:183`). How often the 350 ms branch runs was NOT measured | a decision: route (a), route (b) for the 67 hook call sites only, or carry as a named wall-clock exception |
| 58 per-test ceilings in four mobile files | Outside F4's wording | a go to remove them (3.8 has their timings) |
| "each hygiene edit a separate small commit" | No git write in this run | the commit, by the groups of section 7 |
| Notes 162 items not given to this pass: (5) R69-09 / R80-10, (6) unused contract names, (7) `test/real` file names, (10) README text against a generator run, (11) commented-out code and test-file literals, (12) gated e2e not executed, (13) FFmpeg licence and data clean-up | not in this brief | as note 162 section 9 says |

## 7. Files changed in this pass (commit groups)

1. W93-18: `apps/mobile/src/lib/handoff-mark.ts` (new), `handoff-mark.test.ts` (new),
   `features/session-live/monitor-handoff.ts`, `features/session-summary/summary-handoff.ts`,
   `features/session-finalizing/handover.ts`.
2. RC-2: `apps/core-server/test/helpers/db/constants.ts`.
3. RC-3: `apps/core-server/src/plugins/logger/error-log.ts`, `__tests__/error-log-rotation.test.ts`.
4. RC-5: `apps/core-web/src/features/devices/panel.tsx`. RC-6: `apps/core-server/test/db/pg-behaviours.db.test.ts`. RC-7: `README.md`.
5. F3: `apps/mobile/src/features/session-live/testing/monitor-harness.tsx`, `session-live-screen.test.tsx`, `live-session-live-sites.test.tsx`.
6. F4: 23 mobile test files (`rg -l` list of section 3.8: audit 2, devices 2, evidence 9, network-time 1, pairing 2, session-finalizing 1, session-summary 1, sessions 1, settings 3, storage 1).
7. SEC35-41 (c): `apps/core-server/src/capture/__tests__/static.test.ts`, `src/db/seed/seed.ts`.
8. A-7: `apps/core-server/src/capture/adapters/__tests__/static.test.ts`, `src/capture/adapters/kinds.ts` (comment).
9. `.gitignore`.
10. History lines: `decision.test.ts`, `packages/shared/src/api/core-api.ts`, `packages/shared/test/api-registry.test.ts`; `masterplan/10_test_strategy.md` (erratum).
11. `apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts`.
12. Docs: this note, `README.md` of the task folder (one index line), `delegation_progress/coder_execution_row97.md`.

No `package.json`, no lockfile, no formatter run, no git write, no install, nothing under `.data/` or
`.cache/` touched, no lane or device started, `.data/pg*.env` not read (the CR-7 test passes those
paths to `git check-ignore` by name). `status_tasks.md`, `delegation_progress_report.md` and
`masterplan/02_plan.md` not written (driver rules). Contract totals 97 / 36 / 61 / 67 and schema
6 / dbc-7: no pin touched; the suites that assert them are green.

## 8. Proof (one run each; 1-minute load below 4 before each)

| Check | Command | Result |
|---|---|---|
| typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core), after the last code edit | exit 0 x 7, 0 `error TS` |
| lint x 7 | `npm run lint -w @dems/<ws>` | exit 0 x 7 |
| shared | `npm run test -w @dems/shared` (load 3.1) | 101 files, 2614 passed, 0 failed |
| core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` (load 3.97) | 324 files, 6702 passed, 0 failed, 63 s (6700 + 1 RC-3 + 1 A-7) |
| core-web | `npm run test -w @dems/core-web` (load 3.96) | 164 files, 2224 passed, 0 failed, 74 s |
| mobile | `npx -w apps/mobile jest --maxWorkers=2` (load 3.9) | 273 suites, 2917 passed, 0 failed, 180 s (272 / 2915 + the mark test) |
| core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` (load 3.7) | 181 files: 178 passed, 3 skipped; 2430 tests: 2423 passed, 7 skipped, 0 failed, 211 s; teardown: 0 databases remain |
| M9-PIN-1 under the corrected rule | the literal grep of section 5.3 | 3 lines, all three on the exempt list; 0 stale |
| X-FC-1 over the test and test-support files of this pass | the grep of `10_test_strategy.md` B.3 | 1 new hit, `monitor-harness.tsx:47`, a 0 ms hand-over (3.7); `pg-behaviours.db.test.ts:160 sleep(10)` is an older line, not touched |

Second runs happened only after a red: F3 (red, then green) and the two failing-first tests.
The core-server unit, core-web, mobile and db suites ran outside the command sandbox (loopback
binds and PostgreSQL, as the driver rules say). transcriber, capture-protocol and mock-core: no file
touched in this pass, suites not run. Not run: gated e2e, real-engine tests, any browser or device.

---
*Generated: 2026-10-11*
