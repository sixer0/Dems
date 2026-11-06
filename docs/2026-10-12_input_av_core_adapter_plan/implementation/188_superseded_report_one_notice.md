---
task_slug: input_av_core_adapter_plan
row: 188
milestone: M3 / WP-06b
date: 2026-10-13
agent: coder-execution (batch 8, agent K/P/N)
status: needs-review (C37 is built and proven as the cell states it; C40 (2) gives the operator ONE critical notice, but the audit log holds three fault rows for that arrival, not one - section 4)
tier: T3
requirement: controller rulings C37 and C40 (2); C34 and C35 unchanged; BR-08 unchanged
---

# Row 188 - a report for a superseded attempt is dropped; one arrival, one critical notice

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src/capture-session`. Everything is closed on doubles: the relay's report is a fake of the injected source, the worker is the fake worker of the rig, "production" is the port `operationOf` over the fake adapters.

## 1. What was built

| File | Change |
|---|---|
| `CS/ingest-pairing.ts` | `wasSuperseded(attempt)`: a whole number from 1 up to, not including, the attempt in force. A relay report of such an attempt is dropped, counted (`supersededReports()`) and told to the new optional listener `superseded({ deviceId, attempt, inForce, count })`. `ATTEMPT_MISMATCH` stays for every other attempt that is not the one in force: a later one, 0, a negative or broken number. No other rule changed; the unit still imports nothing |
| `CS/index.ts` | (a) the pairing's `superseded` listener: ONE log line per dropped report, code `CAPTURE_RELAY_REPORT_SUPERSEDED` (level info) with the session, camera, the attempt named, the attempt in force and the running count `dropped`; the first `SUPERSEDED_REPORT_LINES` (8) of a capture, the rest counted and said once at the end (`CAPTURE_RELAY_REPORTS_SUPERSEDED_TOTAL`). (b) `Live.gateRefusals`: by camera, the gate's word and the attempt, kept BEFORE the pairing judges the refusal. (c) `foldGateNotice`, run after `captureEnded` when the pairing ended the capture: if the gate refused the SAME camera in the SAME attempt and the session is in FAULT by its capture, the camera's own notice is resolved through the engine (`clearCaptureWarning` with the gate's reason); one log line `CAPTURE_GATE_NOTICE_FOLDED`; a failure is `CAPTURE_GATE_NOTICE_NOT_FOLDED` in the error log. (d) the error-log entry `CAPTURE_INGEST_NOT_PAIRED` names `gateReason` beside the pairing's reason. Two members of `Live`, one constant, the header paragraph |
| `CS/__tests__/ingest-pairing.test.ts` | ONE existing case corrected (its earlier-attempt half asserted the old rule; it now asserts "completes nothing, no fault"); one new block of 11 cases |
| `CS/__tests__/session-capture.db.test.ts` | the two cases "BR-08 with the frame member" now assert ONE active notice (they asserted two, row 182's decision 3); three new cases in the row-48 block (the other order, the control, C37 through a worker restart) |

Not touched: `capture/forwarder.ts`, `capture/index.ts`, `capture/supervisor.ts`, `facts.ts`, `statements.ts`, the adapters, `packages/*`.

## 2. C37: which attempts are "superseded"

The attempts of a session are the supervisor's count of its workers (1, then one more per worker); the session stamps every open and every report with it (rows 46, 179). So every whole number below the attempt in force was issued by the Core - also an attempt whose worker never came to listen (the pairing is then told to begin with the next number and was never told the first). An attempt above the one in force does not exist yet; 0 is the relay's "none stated".

| Report of the relay names | Before | Now |
|---|---|---|
| the attempt in force | pairs | pairs (unchanged) |
| an attempt from 1 to in-force minus 1 | `ATTEMPT_MISMATCH`, capture ended | dropped; counted; one log line; no fault, no audit entry; the pair of the attempt in force keeps its state and its timer |
| a later attempt, 0, negative, not a whole number | `ATTEMPT_MISMATCH` | `ATTEMPT_MISMATCH` (unchanged) |

## 3. C40 (2): one arrival said twice

The worker's gate refuses a push: the capture forwarder raises the camera's critical fault under the gate's word, at once, by itself (`capture/forwarder.ts`, not this row's). When the relay of that camera also reported, the pairing ends the capture (`WORKER_REFUSED`, or `WORKER_REPORT_MISSING` at the bound when the relay's line came after the worker's frame): the critical fault of the capture, `CAMERA_INGEST_NOT_PAIRED`. THE STRONGER CAUSE is the end of the capture (DD-1): once the session is in FAULT by its capture, the camera's own notice is resolved. The operator has one active critical notice.

Not touched by it: a gate refusal WITHOUT a pairing end (no relay reported: the camera keeps its critical notice and the capture goes on, C40 (2) first sentence); the notice of another camera; a refusal of another attempt.

## 4. NOT MET AS WRITTEN: "1 audit entry"

The cell says "exactly 1 CRITICAL notice and 1 audit entry". Measured (the two frame-member cases):

| | Before | Now |
|---|---|---|
| Active critical notices | 2 | **1** (`CAMERA_INGEST_NOT_PAIRED`, the capture) |
| Audit entries that name the pairing's cause | 1 | **1** |
| Fault rows of the audit log for the arrival | 2 (`FAULT_RAISED` camera, `FAULT_RAISED` capture) | **3** (`FAULT_RAISED` camera, `FAULT_RAISED` capture, `FAULT_CLEARED` camera) |

One audit row in total cannot be reached from the session unit: the camera's `FAULT_RAISED` is written by the forwarder before the pairing has judged, and the session can only resolve it afterwards. To have ONE row the forwarder must not raise it: a veto asked at the moment of its raise (it raises one microtask after the supervisor's event, when the session's listener has already run). That is one predicate of this unit and two lines in `capture/forwarder.ts` and `capture/index.ts`: request line in `file_requests.md`, with the question whether the gate's own audit row SHOULD disappear (it is the only stored trace of the worker's word; the error-log entry now carries it too).

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | "The stronger cause" is the end of the capture (`CAMERA_INGEST_NOT_PAIRED`), and the notice that is resolved is the camera's | it says that nothing is recorded any more; the gate's word is kept in the audit row, the log line and the error-log entry |
| DD-2 | The fold uses the engine's existing clear, which writes `FAULT_CLEARED` | the only door the session has; the same act the next recording start does for every capture fault (D84 R-4), earlier |
| DD-3 | Both orders of the arrival are folded (gate first then relay; relay first then gate) | the two reports travel on two channels and race |
| DD-4 | Superseded = every whole attempt below the one in force, not "the attempts the pairing was told to begin" | an attempt whose worker never listened was still issued (its cameras were opened with it) |
| DD-5 | One log line per dropped report up to 8 per capture, then a total at the end | "one log line and counted" without letting a relay that repeats itself fill the log |
| DD-6 | The log line is level info and is no error-log entry | C37: not a fault |
| DD-7 | One existing unit case was corrected, not only extended | its second half pinned the rule C37 replaces |

## 6. Evidence

| Check | Command | Result |
|---|---|---|
| Session unit tests, first run | from `apps/core-server`: `npx vitest run --project unit --maxWorkers=2 src/capture-session` | `1 failed, 44 passed (45)`: `ingest-address.test.ts:235` - a pin on every line of the session file that holds the word `target`; the first form of the fold read `alert.target`. Reworded (it reads the session's fault), no pin edited |
| The same, second run | the same | `Test Files 3 passed (3)`, `Tests 45 passed (45)` |
| Session database test, throw-away databases under the lock, sandbox off | from the repository root: `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__/session-capture.db.test.ts'` | `Test Files 1 passed (1)`, `Tests 86 passed (86)`; 2 databases dropped, 0 remain |
| Neighbours: capture static, capture-notices | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts src/capture-notices` | `Test Files 5 passed (5)`, `Tests 105 passed (105)` |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | no output (0 errors) |
| Lint | `npx oxlint src/capture-session` | no output |

Verification cell, clause by clause:

1. "a report for a superseded attempt gives 0 faults, 0 audit entries and 1 counted log line while the current attempt still pairs" - database case "row 188, C37": after the worker was replaced, reports of attempt 1 for two cameras give 2 lines `CAPTURE_RELAY_REPORT_SUPERSEDED` (`dropped: 1`, `dropped: 2`), 0 lines `CAPTURE_INGEST_NOT_PAIRED`, 0 audit entries of the fault, the fault rows unchanged, session `RECORDING`, no STOP, and `CAM-01@2` paired. Unit block: 5 cases.
2. "a report for a never-issued attempt is still the fault with 1 entry" - the same case, attempt 3: `CAM-02@3 ATTEMPT_MISMATCH`, session `FAULT`, 1 audit entry; the existing case of row 48 (attempts 2 and 0) unchanged; unit: 6 numbers.
3. "one event with a gate refusal and a pairing end gives exactly 1 CRITICAL notice and 1 audit entry" - 1 active critical notice: yes (three cases, both orders). 1 audit entry: of the pairing's cause yes; in total no (section 4).

## 7. Unproven

| Unproven | Proven by |
|---|---|
| That a real relay of a superseded attempt writes its line after its worker went down (the case this rule is for), and how many | rows 43 / 44 (the relay's reconnect), row 59 |
| That a real gate refusal and a real relay report for one push arrive within the pairing bound in either order | row 178 (BR-09), `9A/H` checks of the relay |
| The security acceptance of the rule (a local process cannot use a low attempt number to do harm: a dropped report pairs nothing and opens nothing) | row 86 |
