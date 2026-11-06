---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 24
date: 2026-10-12
agent: coder-execution
tier: T3
requirement: HA-12 (review finding P12-F12 b; WP-02)
status: complete
---

# Row 24: leftover-process detection reads the program path behind a platform seam

## What was built

| File | Change | Description |
|---|---|---|
| `apps/core-server/src/capture/adapters/local/leftover.ts` | modify | the seam `ProgramPathReader`, the Linux reading `linuxProgramPathReader`, the chooser `programPathReaderFor(platform, door, timers)`, `processShortName`, `leftoverPrograms` (several programs, each leftover named by its program), `LEFTOVER_CANDIDATE_LIMIT`. `leftoverHelperPids` keeps its four parameters and its answers, gains an optional fifth (the reader) and is now a thin caller of `leftoverPrograms` |
| `apps/core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts` | modify | one import line; one `describe` of 3 tests beside the existing leftover case |

No new file: the folder's static file list (`camera-helper.test.ts`, list `OWN`) and the capture static rule lists learn nothing. `leftover.ts` still imports no process module and no file system; it reads no environment, no clock, no `process` member (the platform is a parameter).

## How it works

1. The table is read as before: `/bin/ps -axo pid=,comm=` through the door, bound 5 s.
2. A row whose second column equals a program path is that program. This is the macOS form; behaviour unchanged.
3. With a reader, a row whose second column equals the short name of a program (file name cut at 15 characters) is a candidate. Its program path is read through the seam:
   - equal to a program of the list: named under that program;
   - another path: not counted (somebody else's program of the same name);
   - not readable (null): counted, under the program whose short name it carries.
4. More than 64 candidates in one check: the answer is null, as for a table that could not be read. The caller already treats null as "not known, do not start".
5. The Linux reading: `/usr/bin/readlink /proc/<pid>/exe` through the same door, bound 5 s, killed at the bound; a non-zero exit, an output that is not one absolute path, or a pid that is not a positive integer gives null. The ` (deleted)` mark Linux appends for a replaced program file is removed before the comparison.
6. `programPathReaderFor('linux', ...)` gives that reading; every other platform gives none, so macOS never starts the second program.

Nothing is killed by this code, as before.

## Verification (the row's cell: "fixture process listings in the macOS form and in the Linux short-name form: a planted leftover is named in both")

| Check | Command | Result |
|---|---|---|
| Targeted test file, one run | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/local/__tests__/camera-helper.test.ts` (in `apps/core-server`) | `Test Files  1 passed (1)`, `Tests  36 passed (36)` |
| macOS form | test "the macOS form: ..." | planted helper (pid 202) and planted relay (pid 203) named by program; calls to the door: the table only |
| Linux short-name form | test "the Linux short-name form: ..." | without the reader: `[]` (the finding, reproduced); with it: 302 (helper), 305 (relay under its cut name), 306 (not readable), 307 (replaced file) named; 303 (other path) and 304 (the Core's own) not |
| Bounds | test "the reader is bounded: ..." | a reading that does not end is killed with SIGKILL at 5 s and gives null; 65 candidates give null after 64 readings |
| Static rules, one run | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/capture/adapters/local/__tests__/mic-static.test.ts` | `Tests  1 failed | 74 passed (75)`. The failure is rule A-6 naming `src/capture/adapters/camera/onvif-session.ts` (another row's file, in flight); no rule names `leftover.ts` |
| Typecheck, once | `npm run typecheck` in `apps/core-server` | exit 2 with 2 errors, both in `test/support/fake-onvif-stub.ts` (lines 524, 877; another row's file, in flight). 0 errors in the two files of this row |

Not run: `mic-helper.generated.test.ts` (it starts the real FFmpeg program; its three calls use the four-parameter form, whose answers are unchanged).

## The double, and what stays unproven

**The double** is a `HelperDoor` that starts nothing. It answers `/bin/ps` with a recorded table (macOS form or Linux short-name form) and `/usr/bin/readlink /proc/<pid>/exe` from a fixed map of pid to link text. The Linux table and the link texts are written by hand from the documented behaviour; no Linux host and no container was read.

**Unproven, for the container check (row 79) and hardware check `9A/H-24`:**
- that the Linux table prints exactly the 15-character short name for the delivered programs (HA-12 is still a hypothesis until read on a host);
- that `/bin/ps` and `/usr/bin/readlink` exist at those paths on Ubuntu 24.04 and that the Core's user may read the link of its own leftover children;
- that the configured program paths are link-free: the link target is the resolved path, so a program configured through a symbolic link would never compare equal;
- a file name with characters outside ASCII: the cut is made by characters here and by bytes in the kernel.

**Not wired.** No caller passes the reader yet: `fence/index.ts:457,515` is not this row's file. Until the request below is applied, a Linux Core still names nothing at run time.

## Requirements

- HA-12 / P12-F12 b: the mechanism is built and tested on a double. Open: the wiring (request), the proof on Linux (`9A/H-24`, row 79).
- S13-02, AD-09 (3) (a stopped relay is killed and reaped): not closed here. This row only makes a surviving relay visible by name; the kill and reap are rows 46 and 44.
- SR-1: no process importer added; the readings go through the injected door.

## Requests left (`delegation_progress/file_requests.md`)

1. `fence/index.ts`: pass `programPathReaderFor(process.platform, door, mount.timers)`; use `leftoverPrograms` for the production programs.
2. `adapters/local/index.ts:28`: export the new names.
3. Host profile HOST-17 and the `9A/H-24` script: the reading is the link, not `args=`; three points to confirm on the host.

## DRIVER DECISIONS (to confirm)

1. The Linux reading is the kernel's link `/proc/<pid>/exe`, not the `args=` column that HOST-17 mentions: an argument list is written by the process itself and is cut at spaces; the link is not.
2. A candidate whose path cannot be read is counted (fail closed). Cost: a foreign process of the same short name owned by another user, or one that ends between the two readings, is counted once.
3. The candidate limit of 64, answered as null.
4. The change stays inside `leftover.ts` instead of a new file, to move no static list.
5. `leftoverHelperPids` keeps its name and form; the reader is an optional fifth parameter, so nothing changes for a caller that does not pass it.
