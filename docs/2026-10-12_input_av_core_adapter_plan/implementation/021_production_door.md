---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 21
date: 2026-10-13
agent: coder-execution
tier: T3
work_package: WP-02
requirement: SR-1 entry 1 (G-R2, G-R8); AD-03 point 6 (the door's half); AD-09 point 3 (the door's half); S13-02 (b), (d); BR-07 (4) (the door's half); addendum 2.3 step 4, 8.2 "Configuration keys"
status: complete
---

# Row 21: the production process door

## What was built

| File | Change | Description |
|---|---|---|
| `apps/core-server/src/capture/adapters/production-door.ts` | new | `startProductionProcess(options)`: the one file that starts a production program. Also `ProductionDoorRefusal`, `ProductionDoorError`, `PRODUCTION_ENVIRONMENT_KEYS`, `coreFileLimitOfThisProcess`, `START_MESSAGE_WRITE_BOUND_MS` (5 s), `PRODUCTION_OUTPUT_CAP_BYTES` (64 KiB), the types |
| `apps/core-server/src/capture/adapters/__tests__/production-door.test.ts` | new | 10 tests on a real child process (the double) |
| `apps/core-server/test/support/production-door-double.mjs` | new | the double: a node script with four modes (`report`, `never-read`, `exit-early`, `echo-locator`) |
| `apps/core-server/src/config.ts` | modify | two keys in the four places of the earlier capture keys: `DEMS_CAPTURE_RELAY` -> `captureRelayPath`, `DEMS_CAPTURE_GUARD` -> `captureGuardPath` (absolute path or null) |
| `apps/core-server/src/capture/__tests__/static.test.ts` | modify | G-R2 and G-R8 amended by row 3's decision text (SR-1 entry 1): constant `PRODUCTION_DOOR`, its entry in the allowlist, in the process-importer list and in the process-starter list; one new case pinning the door's start line; the config block: 16 waived lines, ENV pin 8 -> 10 |
| `apps/core-server/src/capture/adapters/__tests__/static.test.ts` | modify | new rule A-8 with its control |
| `apps/core-server/test/static/credentials.test.ts` | modify | a fourth exact list of process importers, moved by one entry (driver decision 6) |

Not edited: `adapters/local/*` (the local door keeps `stdio: ['ignore', 'pipe', 'pipe']`; G-R12 still pins it), `credential.ts`, `errors.ts`, `adapters/index.ts`, the fence, `load-config.ts`.

## The door, as built

1. Order of a start: absolute path -> environment -> core-file limit -> message to bytes -> spawn -> write -> zero-fill. Every refusal before the spawn starts nothing; the first three happen before the message is made into bytes at all.
2. Start line: `shell: false`, `detached: false`, `stdio: ['pipe', 'pipe', 'pipe']`, `env: environment` where `environment` is built in the file from the closed list `PRODUCTION_ENVIRONMENT_KEYS` (one key, `ALSA_CONFIG_PATH`, value an absolute path). Default: empty. Nothing of the server's environment is read.
3. The start message is a `StartMessage` (or null). The door calls `startMessageBytes` itself, so the Buffer exists in this file only. It is written to the child's standard input with one `write`, and zero-filled when the write completed, failed or met its bound. On a refusal the stream is destroyed before the fill, so no cleared byte is sent.
4. Bounded write: `timers.after(writeBoundMs ?? 5000)` of the capture unit's timers (no global timer in the file, G-R8). At the bound: the input is destroyed, the bytes cleared, the child killed with `SIGKILL`, `started` rejects with `PRODUCTION_START_MESSAGE_TIMEOUT`.
5. Standard input stays open after the message: `endInput()` is the order to stop; it also ends when the Core ends. Every live child is killed in the Core's exit handler.
6. `started` (resolves or rejects with a `ProductionDoorError`: a code and a fixed sentence, no cause) and `ended` (never rejects; settles on `close`, so the child has been waited for). Seven codes: `PRODUCTION_PROGRAM_NOT_ABSOLUTE`, `PRODUCTION_ENVIRONMENT_NOT_ALLOWED`, `PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO`, `PRODUCTION_START_MESSAGE_INVALID`, `PRODUCTION_PROGRAM_NOT_STARTED`, `PRODUCTION_START_MESSAGE_NOT_TAKEN`, `PRODUCTION_START_MESSAGE_TIMEOUT`.
7. Both output streams are read into 64 KiB buffers and handed on only through `blankCredentialLocators` (S13-02 (b)). The door logs nothing.
8. Core-file limit (AD-09): the door starts a child only when the Core's own soft core-file limit is 0, because a child inherits it. The limit is read once from the runtime's in-memory process report (no file, no program, network part left out). Not 0 or not readable: `PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO`.

## Finding of this row (measured)

`child.kill('SIGKILL')` on a child whose start FAILED (`pid` undefined, handle still present), called in the same turn as the start, ends the caller's whole process group: the signal goes to process ID 0.

- Evidence 1: the first three runs of the new test file ended their own runner and shell with no output.
- Evidence 2, isolated (`node` v26.8.2, script in its own process group, program `/nonexistent/dems/relay`): without the call `exit 0` and "still alive"; with the call `exit 137`.
- In the door: one function, `signalChild`, signals only a child that has an ID. Test: `missing.kill('SIGKILL')` in the turn of a failed start, and the run goes on.
- The two existing doors have the same unguarded call (`local/process-door.ts:106-108,148-150`, `capture/ipc.ts:69,76,136-137`). Not edited; one line in `file_requests.md`.

## Checks (this Mac; no device, no network, no port; sandbox on)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Door tests, run 1 to 3 | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/__tests__/production-door.test.ts` | ended the runner (the finding above) |
| Door tests after the guard | same | `Test Files 1 passed (1)`, `Tests 10 passed (10)` |
| Door, both static files, credential, config loader, local static, every file of `test/static` | same runner, 23 files | `Test Files 2 failed | 21 passed (23)`, `Tests 2 failed | 359 passed (361)`. Both failures name `src/modules/capture-config/__tests__/credential-reader.db.test.ts` (another row's file, in flight): `test-support-imports.test.ts:44`, `audit-protection.test.ts:78`. No failure names a file of this row |
| Typecheck, once | `npm run typecheck` | exit 2, 3 errors, all in `src/modules/capture-config/__tests__/credential-reader.db.test.ts` (lines 59, 91, 243; another row). 0 in this row's files |
| Lint | `npx oxlint` on the four source files | exit 0 |
| Credential-form needle on the new files | pattern of `scripts/secret-scan/count-only.mjs` | 0 matches (the double builds its placeholder from parts) |

The row's verification cell:

| Item | Where | Result |
|---|---|---|
| every argument is a literal | capture `static.test.ts`, case "the production door: one spawn ..."; A-8 | the start line is pinned word for word; the argument list is the caller's, spread once, the door adds and computes none; the one `env:` is the door's own object |
| no string of the message is made | adapters `static.test.ts`, A-8 | the name of the bytes stands in 6 closed forms; the file has 2 text or view makers, both on an output stream; the serialiser has 1 caller in the product; control on 5 planted uses |
| the door's unit tests pass | above | 10 of 10 |
| G-R2, G-R8 pass in their amended state | capture `static.test.ts` | pass; lists stay exact (`toEqual`), three process files |

What the 10 tests assert on the double: the message arrives byte-exact (hex of what the child read equals the serialiser's bytes; one JSON line, access nested as `locator`, `username`, `secret`, line feed last); the argument list and the environment the child reports hold none of it (with a control: the same search finds it in what the child read); the environment has exactly the given listed key, or none; the buffer the door was given is all zero afterwards, on every path; the child lives while its input is open and exits by itself when it ends (code 7); a child that never reads is given up at 300 ms, killed, waited for; a child that exits before it took a 4 MiB message gives `PRODUCTION_START_MESSAGE_NOT_TAKEN` and the error prints no part of the message; after `ended` the process ID does not exist (a zombie would still answer signal 0); the seven refusals.

## The double, and what stays unproven

**The double** is `test/support/production-door-double.mjs`, started with `process.execPath`: a node process, not the relay and not FFmpeg. The test wraps the serialiser (does not replace it) to keep the buffer the door was given and a copy made before the door had it.

| Unproven here | Why | Check |
|---|---|---|
| The relay reads this line and overwrites its own copy; it sets its own core-file limit and is not dumpable | no relay exists (rows 40 to 43) | rows 41, 44; `9A/H-01` |
| Anything on Linux: the pipe's size and the bound, the inherited limit as the process table shows it, the kill and wait | no Linux run in this row | container check of AD-09 (2) (row 79); `9A/H-24` |
| No child survives an abrupt end of the Core | the exit handler does not run on `SIGKILL`; this rests on "the child ends when its input ends", which the double does and FFmpeg may not (HA-11) | E-7, rows 22 and 25; `9A/H-02` |
| The limit a real Core runs with is 0 | the door only refuses when it is not; the service unit sets it | host profile, boot check of AD-09 (1) (rows 80, 81); `9A/H-01` |
| The search of process listing and environment during a real session (S13-02 (g), E-12) | needs the relay and a session | row 44 and the E-12 row |
| The 25 s bound of a stopped relay (AD-09 (3)) | the bound is the adapter's; the door gives `endInput`, `kill` and `ended` | the camera adapter rows (46, 49) |
| On macOS the child's runtime sets `__CF_USER_TEXT_ENCODING` itself | seen in the double's report; the door hands over no such key (the test names and filters this one key) | none needed |

Not built in this row, on purpose: the program-path rule for the relay and the guard (S13-02 (e)). It needs the file system, which SR-1 does not give this file; it is the boot check's (WP-20). The door itself only refuses a path that is not absolute.

## DRIVER DECISIONS (for the controller to confirm)

1. **The door takes the message, not the Buffer.** The blueprint says "taken as the Buffer of row 147"; addendum 2.3 step 3 says "the door serialises the message whole". Chosen: the door calls `startMessageBytes`, so no other file ever holds the bytes, and rule A-8 pins the door as the one caller.
2. **Closed environment list with one key, `ALSA_CONFIG_PATH`.** No document lists the keys. The research records that input-av passes its sound configuration by that variable. Rows 65 and 66 confirm or remove it; another key is a decision.
3. **Core-file limit by refusal, not by a wrapper.** The runtime cannot set a limit for a child without a shell, and the door starts no shell. The door refuses unless the Core's own limit is 0. Consequence: a Core, or a test run, started from a shell with another limit starts no production program (the test file's first case says so by name).
4. **A child that exits after a short message entered the pipe is not a refused start.** The write succeeded; the exit is seen through `ended`. The named refusal covers a write that failed or did not complete. An acknowledgement of the message is the relay protocol's (row 41, RC-3).
5. **Key names** `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD`; the audio helper's path is not a key of this row (WP-08). The loader does not read them yet (request).
6. **`test/static/credentials.test.ts` edited** (one constant, two list entries). It holds a fourth exact list of process importers that the review did not name (it names three pins). SR-1 entry 1 is the authority; the delegation named only the two capture static files. Declared in `file_claims.md` as an addition.
7. **The refusal codes live in the door file**, not in `adapters/errors.ts` (not this row's file).
8. **No size limit on a start message**; the bound is in time only.
9. **The double sits in `test/support/`** beside `capture-stub-worker.mjs`.

## Requests left in `file_requests.md`

Four lines, none blocking for this row: the loader reads the two keys; the barrel export; the leftover call for the production programs in the fence (beside row 24's); the finding about `kill` on a failed start in the two existing doors.
