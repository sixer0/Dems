---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 180
date: 2026-10-13
agent: coder-execution
tier: T3
source: finding of row 21 (implementation/021_production_door.md, "Finding of this row (measured)")
status: complete
---

# Row 180: the kill guard in the two existing process doors

## The finding, in one line

A signal sent through the handle of a child whose start FAILED (no process ID), in the same turn as the start, goes to process ID 0: the caller's whole process group (row 21 measured exit 137). The production door guards it (`production-door.ts:252-254`). The two older doors did not.

## Why the guard is repeated and not imported

`production-door.ts` exports no helper for it: `signalChild` (:252) is a closure over that door's own child and its `over` flag. Nothing can be imported, and a new export would be an edit of a file this row does not own. An import between the doors would also add an import line to two files the exact-list static rules watch. The three-line guard is repeated locally, in the same form and with the same name.

## The two diffs, in words

| File | Lines (after) | Change |
|---|---|---|
| `apps/core-server/src/capture/adapters/local/process-door.ts` | 106-113 | New closure `signalChild(signal)`: `if (!over && started.pid !== undefined) started.kill(signal)`. `killAtExit` now calls `signalChild('SIGKILL')` (before: `started.kill('SIGKILL')` with no condition) |
| same | 153 | The returned `kill` is `signalChild` (before: `if (!over) started.kill(signal)`, no process-ID condition) |
| `apps/core-server/src/capture/ipc.ts` | 69-70 | The branch "no standard streams": `if (child.pid !== undefined) child.kill('SIGKILL')` (before: no condition) |
| same | 76-83 | New closure `signalChild(signal)`: `if (!ended && child.pid !== undefined) child.kill(signal)`. `killAtExit` calls it |
| same | 142 | The channel's `kill` is `signalChild` (before: `if (!ended) child.kill(signal)`) |

Nothing else in the two files moved: the start lines (`shell`, `detached`, `env`, `stdio`), the imports and the exported names are as they were. `git diff --stat`: process-door.ts 13 lines, ipc.ts 16 lines.

## The tests

Both extend the existing test file of their subject. THE REPRODUCTION IS SAFE: `ChildProcess.prototype.kill` and `process.kill` are replaced by spies that send nothing (`vi.spyOn(...).mockImplementation(() => true)`), restored in `finally`. No real signal can leave the test, with or without the guard.

| Test | Where | What it does and asserts |
|---|---|---|
| "a program that could not be started is never signalled: not by kill, not by the exit handler; the door still reports spawnFailed" | `src/capture/adapters/local/__tests__/camera-helper.test.ts:576`, block "the process door" | Starts `/nonexistent/dems/ffmpeg`; in the same turn calls `kill('SIGKILL')`, `kill('SIGTERM')` and the door's own exit handler (found as the one new listener of `exit`); both spies have zero calls; `ended` resolves to `{ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' }`; `alive()` is false; the exit handler is removed; a late `kill` sends nothing |
| "a worker that could not be started is never signalled: not by kill, not by the exit handler; the channel still reports spawnFailed" | `src/capture/__tests__/ipc.test.ts:178` | The same on `createProcessLauncher` with `/nonexistent/dems/capture-worker`; the channel reports `exit` once with `{ exitCode: null, signal: null, spawnFailed: true }` (the supervisor's `SPAWN_FAILED`, already covered by the case above it at :166) |

The test process survives by construction: every assertion after the signal calls is made by it.

## Checks (this Mac, load 4.0; no device, no port)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| RED, before the guard (the two new cases only, by `-t`) | `npx vitest run --project unit --maxWorkers=2 <the two files> -t "could not be started is never signalled"` | `Test Files 2 failed (2)`, `Tests 2 failed | 52 skipped (54)`; both at the same assertion: the handle spy received `SIGKILL`, `SIGTERM`, `SIGKILL` (three signals that would have gone to process ID 0) |
| GREEN, after the guard: the two test files whole, the three static-rule files, the microphone static file; under `.locks/heavy-host.lock`, sandbox off (the file starts the stand-in worker) | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/local/__tests__/camera-helper.test.ts src/capture/__tests__/ipc.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static/credentials.test.ts src/capture/adapters/local/__tests__/mic-static.test.ts` | `Test Files 6 passed (6)`, `Tests 145 passed (145)` |
| Typecheck, once | `npm run typecheck` | exit 0, no output from `tsc --noEmit` |

No static list was edited. Lint was not run to a result (the sandboxed `oxlint` call printed only certificate-store errors); not a check of this row.

## Could the finding have occurred in production before the fix?

Yes, in a narrow window; it was never observed there.

It needs two things in the same turn of the event loop:

1. A start that fails AFTER `spawn` returned (the failure arrives as the `error` event one tick later, and until then the handle exists with no process ID). The path rule runs before the door, so this is: the program removed or made non-executable between the check and the start, or the operating system refusing a new process (process or descriptor limit) - the state of a host already in trouble.
2. A signal before that `error` event is delivered. Two senders exist in the code:
   - the exit handler of the door (`process-door.ts` old :106-108, `ipc.ts` old :75-77): the Core ends (`process.exit`, as `fatal` in `src/index.ts:43,63` does) in that turn;
   - a `kill` by a caller in that turn: `supervisor.ts:617` (a worker going down) and `:1165` (stop of a worker that never shook hands), `camera-helper.ts:235`, `mic-pipe.ts:56` (an abort).

The timer-driven kills (`camera-helper.ts:231`, `mic-pipe.ts:52`, `leftover.ts:64,101`, `worker-probe.ts:47`) run on a later turn, when the handle is already gone: not reachable.

Effect when it occurs: the signal ends every process of the Core's process group, the Core included. Capture mode `real` with a worker path is the precondition for `ipc.ts`; a local-device source for `process-door.ts`.

Labelled as not measured: whether a queued supervisor step can run between the start and the `error` event (HYPOTHESIS, read from the code, not run); the behaviour on Linux (row 21 measured macOS, node v26.8.2; hardware check `9A/H-24`).

## What stays unproven

| Unproven | Why |
|---|---|
| `ipc.ts:70` (no standard streams) has no test | With `stdio: ['pipe', 'pipe', ...]` the branch is not reachable by a program path; the guard is the same one condition |
| The real signal to process ID 0 is not reproduced here | On purpose: row 21 measured it in isolation; this row asserts on spies only |

## DRIVER DECISIONS

1. The guard is repeated locally under the name `signalChild` rather than exported from `production-door.ts` (reason above).
2. The door's test is in `camera-helper.test.ts`: the door has no test file of its own, and the block "the process door (HL-2, HL-4, HL-7)" there is its existing subject. One new import of the process module in that TEST file (for the prototype spy); the static rules judge production sources only and stayed green.
3. The red run before the guard was restricted to the two new cases with `-t`, so that the one full run of the files is the green one.

## Request left in `file_requests.md`

One line, not blocking: `apps/core-server/src/db/seed/demo-helper.ts:74,78` holds the same unguarded call (a seed tool outside the capture area; not this row's file).
