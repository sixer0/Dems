# Row MH1 - status: needs-review (record: implementation/mh1_mic_helper_leftover.md)

- **Cause, a product defect.** `leftover.ts` read `ps -axo pid=,comm=` from the door's 64 KiB head. This Mac's table is 82 KB / 901 rows, and `ps -ax` lists processes with a terminal last. So the test's helper stood past the cut and the check answered `[]`. The scratch probe with the product's function missed a live `/bin/sleep` at load 6.04 and at 3.98 (`checkSawPid:false`). The fixed check finds it (`true`). It is not a test race and not host load. The `(ffmpeg)` seen afterwards was the door's exit-handler kill after the failed case.
- **Fix.** The whole table is read from `onOutput`, bounded at `LEFTOVER_TABLE_LIMIT_BYTES` (4 MiB). A table past the bound, or a full head with no stream, answers null (fail-closed).
- **Tests.** One case appended to `camera-helper.test.ts`, and one name added to its import line. One `alive(pid)` assertion added to `mic-helper.generated.test.ts`.
- **Mutants M0-M3** were all RED and then restored.
- **Results:**
  - camera-helper 38/38
  - mic-static + adapters static 45/45
  - tsc rc 0
  - oxlint rc 0
- **NOT RUN:** the real-FFmpeg case under the heavy-host lock. The lock was held for the full 20-minute wait (capture-worker python job pid 80403, plus a queued db fence run). The controller should run the command in record section 6.
- Edit tool only on existing files. Nothing committed. Nothing left running.
