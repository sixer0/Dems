# Row MH1 - the RED "M4-SEC-HELPER-1 leftovers" case (decision C148 (f), request line 574)

Status: **needs-review**. The product is fixed and proven on doubles plus a real-process probe. The real-FFmpeg case was NOT re-run: the heavy-host lock was held for the whole 20-minute wait (13:18:31 to 13:38:31). Agent MH1, wave 12, 2026-10-14. Edit tool only on existing files. Nothing committed.

## 1. Cause: a defect in the PRODUCT's leftover check, not a test race and not host load

`leftoverPrograms` (`apps/core-server/src/capture/adapters/local/leftover.ts`) read the process table `/bin/ps -axo pid=,comm=` from `exit.output`. That is the door's **bounded head** of standard output: `HELPER_OUTPUT_CAP_BYTES` = 64 KiB (`process-door.ts:27`, `boundedText`). The check treated that head as the whole table.

Evidence (every command run with the sandbox off; ps cannot run inside it):

| Fact | Command / source | Result |
|---|---|---|
| This host's table is longer than the head | `ps -axo pid=,comm= \| wc -lc` | 901 rows, 82,172 bytes (> 65,536) |
| The order puts a terminal-started process LAST | `ps -axo pid=,tty=` | rows 1-904 have no terminal; rows with a terminal start at row 905. `ps -ax` sorts by terminal, then pid |
| The head ends mid-row | `ps ... \| head -c 65536 \| tail -2` | the cut fell at about row 746, inside a path |
| The OLD check misses a live process past the cut, with no load and no race | scratch probe `scratchpad/mh1/probe.mts`: the product's own `leftoverHelperPids` against a live `/bin/sleep 30` started through the real door | `{"tableBytes":83271,"rowOffset":68309,"rowPastCap":true,"checkResult":0,"checkSawPid":false}` (load1 6.04). The same on mutant M0: `rowOffset 67161 ... checkSawPid:false` (load1 3.98) |
| The FIXED check sees it | the same probe after the fix (two runs) | `{"tableBytes":84271,"rowOffset":69321,"checkResult":1,"checkSawPid":true}` (load1 5.16); `{"tableBytes":81945,"rowOffset":68506,"checkSawPid":true}` (load1 3.34) |

How this explains the two REDs reported by row 88. The test's helper is a child of a vitest started from a terminal, so its row comes after every non-terminal row, past the 64 KiB cut. The check therefore returned `[]`, which is exactly `expected [] to include <pid>`. The case then failed before `stream.close()`, so the helper was killed by the door's exit handler when the worker ended. That is the `(ffmpeg)` that `ps` showed afterwards: an exiting process whose arguments can no longer be read. It is not the cause. A zombie prints `<defunct>` on this macOS (checked with a `/bin/sleep` child: alive `/bin/sleep`, killed and not reaped `<defunct>`, reaped gone).

The failure comes and goes with the size of the table. Below 64 KiB (fewer processes: no emulators, fewer agents) the case passes. Host load is not the cause: the probe misses the row at load 3.98 just as at 6.04.

Why this is a REAL defect: in a REAL_DEVELOPMENT boot (`capture/fence/index.ts` `run`, about `:971`), a leftover helper of an earlier run, started from a terminal on a busy host, was answered "nothing is left". Capture then started beside it. That breaks the file's own rule: "a check that cannot see does not answer 'nothing is left'".

## 2. The fix (`leftover.ts`, about 25 lines, additive)

- The table is read **whole** from the stream. The door's `onOutput` observer collects it as it arrives, up to a new bound `LEFTOVER_TABLE_LIMIT_BYTES` = 4 MiB, which is exported. The `ps` program and arguments are unchanged, so the row-24 pins `[['/bin/ps', ['-axo','pid=,comm=']]]` hold.
- A table longer than the bound answers `null`, the same as a table that cannot be read.
- A door that streamed nothing (a double, or an empty table) is read from its kept head. If that head **fills the cap**, the answer is `null`, because the table may have been cut.
- The import became `import { HELPER_OUTPUT_CAP_BYTES, type HelperDoor } from './process-door'`.
- Unchanged: the Linux short-name seam, the candidate limit, the reading bound, and the fact that nothing is killed.

The callers need no change. The fence treats `null` as `DEV_HELPER_LEFTOVER`, count -1, and refuses (fail-closed). That is unchanged. On this host the real table (82 KB) is now read whole, so a development boot is not refused because of the table's length.

## 3. Tests

- `camera-helper.test.ts` (the subject's existing file, row-24 describe): ONE appended case, "the whole table is read, not the door's head (row MH1)". One name was added to the import line at `:42`. The double is a door that streams a recorded table in 16 KiB chunks and keeps a 64 KiB head, as the real door does. The table has the shape of this Mac's: 1,000 rows, the planted helper after the cut. Assertions:
  - control: the table is longer than the head, and the head lacks the row;
  - the helper is named `[4242]`, and `[]` when it is the Core's own;
  - a full head with no stream gives `null`;
  - a table past the bound gives `null`.
- `mic-helper.generated.test.ts` (the real-FFmpeg case): one assertion, `expect(alive(pid)).toBe(true)`, made before the first check, plus a comment. A miss is now told apart from a helper that already ended. Nothing is weakened: the three leftover assertions are unchanged.

## 4. Mutation (each seen RED on the new case, `-t "row MH1"`, then restored)

| Mutant | Change | Result |
|---|---|---|
| M0 | HEAD's reading (`table = exit.output`, guard off) | `AssertionError: expected [] to deeply equal [ 4242 ]`, the reported failure's shape |
| M1 | the stream is ignored (`onOutput` does not keep) | `expected null to deeply equal [ 4242 ]` |
| M2 | the full-head guard is removed | `expected [] to be null` |
| M3 | the 4 MiB bound is ignored | `expected [ 4242 ] to be null` |

`grep -c "MUTANT\|false &&" leftover.ts` gives 0 after the restore.

## 5. Result lines (fixed tree)

- `vitest run --project unit --maxWorkers=2 .../camera-helper.test.ts`: `Tests 38 passed (38)` (37 before, plus 1)
- `vitest run ... local/__tests__/mic-static.test.ts adapters/__tests__/static.test.ts`: `Test Files 2 passed (2) / Tests 45 passed (45)`
- `tsc --noEmit -p apps/core-server`: rc 0
- `npx oxlint` on the three touched files: rc 0
- Nothing left running: `ps` shows no `/bin/sleep` and no `ffmpeg` of mine.

## 6. NOT done: the real-FFmpeg case under the lock

The task asked for up to 10 runs of `mic-helper.generated.test.ts` under `.locks/heavy-host.lock`. I queued 3 rounds on HEAD's reading (mutant M0, which behaves the same as the committed code), and the fixed rounds were to follow. `lockf -t 1200` gave up with `already locked`, rc 75, after 20 minutes. The holders were:

- pid 80403: a capture-worker `python3` job under `lockf -t 1800`;
- pid 39319/39323: a queued `vitest --project db` run of `capture/fence/__tests__/fence.db.test.ts`, waiting on both locks.

The tree is back on the fix. **For the controller:** run once under the lock:

```
cd apps/core-server && /usr/bin/lockf -k -t 1800 ../../.locks/heavy-host.lock ../../node_modules/.bin/vitest run --project unit --maxWorkers=2 src/capture/adapters/local/__tests__/mic-helper.generated.test.ts
```

The expected result is green: the probe shows the fixed check finds a real live child past the cut in this host's real table. The runner script `scratchpad/mh1/runs.sh` (probe plus case, N rounds, load logged) can be reused.

## 7. Driver decisions (for the controller to confirm)

- **DRIVER DECISION D-1:** the bound is 4 MiB. That is about 50,000 rows of today's average 91 bytes, or about 4,000 rows at the longest possible path. Past it the answer is null, which makes the boot refuse.
- **DRIVER DECISION D-2:** the cause was in the product, so I claimed `leftover.ts` and the subject's test file `camera-helper.test.ts` before editing. Both were free in `file_claims.md`. The claim line was widened before writing.
- **Unproven, for the hardware package:** the Linux table is far shorter (short names), but the same fix covers it. The real Linux reading stays check `9A/H-24`.
