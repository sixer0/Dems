---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 193
package: WP-14 (milestone M5)
date: 2026-10-13
agent: coder-execution (single writer of apps/capture-worker and scripts/host/container while it ran)
tier: T2
subject: the capture worker, its static rules, its unit checks and the relay and guard tests build and pass in the Ubuntu 24.04 container; causes L-1 to L-5 of row 78
status: complete - L-1 to L-5 closed 5 of 5; macOS changed results 0; no security rule relaxed or skipped; 3 driver decisions for the controller (section 7); the fixture runs in the container are not possible yet and are row 141's (section 6)
---

# Row 193 - the worker's first Linux build

ALL CONTAINER RESULTS BELOW ARE CONTAINER RESULTS: Ubuntu 24.04.5 user space, arm64, clang 18.1.3, glibc 2.39, the self-built FFmpeg 9.0.2 of the image, on the kernel of this Mac's virtual machine. None settles an item for the production host (`9A/H-01`, `9A/H-03`).

## 1. What was asked and what was found

Row 78 built the image and found that `make -C apps/capture-worker` ended 2 in it, with five causes. This row closes them with changes that mean the same on both systems, and shows that every macOS result is as before.

| Question | Answer | Evidence |
|---|---|---|
| `make -C apps/capture-worker` in the container | **rc 0**, twice: live in a fresh container, and recorded in the image built from the final tree | `.cache/task4-row193/04_container_live.log:248`, `11_image_recorded_build.log:248,546` |
| The same target on macOS, after the changes | **rc 0**, every check line as in the run before the changes | `01_mac_baseline.log` against `02_mac_after.log`, section 4 |
| The three programs in the container | all present (section 5) | `04_container_live.log:509,522,533` |
| Library pins, worker version | unmoved: `libavformat.pin`, `imports.pin`, `src/worker.h` have no difference from HEAD; `capture-worker/0.6.0`; `make versions` 63.1.102 / 63.1.102 / 12.1.102 / 7.1.102 / 61.1.102 on both systems (BR-06) | `git diff HEAD --quiet` on the three files; `04_container_live.log:47-52` |
| A source of the worker changed | **none**. No file under `apps/capture-worker/src` was written by this row: one build line, one line of the self-test, the import reader, two test files | section 2 |

All logs are under `.cache/task4-row193/` (untracked).

## 2. The five causes

Each cause was confirmed again in a throw-away container before it was called closed (`06_container_confirm.log`); L-3 and L-4, which row 78 had seen only in what-if runs, were confirmed on the real files as they stood at HEAD.

| # | Confirmed how | The change | Where | Why it is the same on macOS |
|---|---|---|---|---|
| L-1 | the five sources without the macro: 4 + 5 + 7 + 2 + 4 = **22 errors**, row 78's count | `-D_DEFAULT_SOURCE` on the worker's compile line - the macro the relay's and the guard's lines already carry | `apps/capture-worker/Makefile:47-52` | Apple's headers do not read the macro. Proven by bytes: the worker built on this Mac with and without it, without debug information, gives the same eight objects and the **same binary** (SHA-256 `5c7f235c...6463` both times; `07_mac_l1_identity.txt`). The alternative macros are NOT equivalent, see below |
| L-2 | the old label does not link on ELF; this compiler's prefix of a C name is the empty text there | the planted program takes its label from the compiler's own prefix of a C name (`__USER_LABEL_PREFIX__`: `_` in a Mach-O object, nothing in an ELF one) followed by `creat`, in the place of the literal `"_creat"` | `apps/capture-worker/check.sh:273-279` | on macOS the macro expands to `_`: the label is the text it was. The self-test line is unchanged: `refused as required (R-6, import net): creat() reached through an assembler label` on both systems |
| L-3 | the reader of HEAD on the ELF worker: **all six pins called stale**, rc 1 (`open@GLIBC_2.17` is not `open`); the reader of this tree: the six pinned names and no other, rc 0 | the reader takes the object format from the first four bytes of the binary itself. Mach-O: one underscore and the `$SUFFIX` cut, exactly the reading it had. ELF: no underscore cut, the symbol version cut, and a function is read under its other linker names of glibc as well (`open64`, `__open_2`, `__open`). A file that is neither format is refused. A self-test of the reader on 20 spellings of both formats runs in `check.sh --selftest` on both systems (silent when it holds) | `apps/capture-worker/test/static/pinned_calls.py:323-401`, `:427`; `check.sh:276` | the Mach-O branch is the old code path, moved into a function. The same binary gives the same names: the worker's import net and the self-test's two lines are unchanged on macOS |
| L-4 | the writer test of HEAD against this tree's `sink.c`: **5 checks FAILED**, the five of row 78 | the test states the strongest sync of the platform ITSELF (`PLATFORM_SYNC`: `F_FULLFSYNC` on macOS, `FSYNC` elsewhere) and requires the build to ask for exactly that. The checks of the fallback and of the changed level run where a full sync exists; where it does not, the test requires `FSYNC` at the first checkpoint and at the close, every checkpoint given, the seam never asked, and no level stated before a sync | `apps/capture-worker/test/writer_test.c:52-63`, `:456-458`, `:471`, `:484-518` | on macOS every check that ran before runs unchanged and one more is added that passes silently; the negative control still fails on its 4 checks. See "the sync level" below |
| L-5 | row 78 observed it in a real run (abort, exit 134); the cause is the kernel's cap on an unprivileged socket buffer | the test writes what the socket pair takes at once; what is left is written by a thread of the test as the relay reads, and the camera's end follows the last byte. `wire_close` ends the relay's side first and joins the thread | `apps/capture-worker/test/relay_unit_test.c:19-22`, `:1054-1094`, `:1110-1114`, `:1306` | this Mac's socket pair takes the 612,760 bytes of the largest case at once, so no thread is started there and the test runs as it did: 918 checks, 34 of 34 cases, on both systems |

### L-1: why this macro and not another

`-D_POSIX_C_SOURCE=200809L` would also make the Linux build compile. On macOS it hides `F_FULLFSYNC`, and `sink.c` selects the full sync with `#ifdef F_FULLFSYNC` (`src/sink.c:320`, `:340`): the worker would then sync with `fsync()` only and call it `FSYNC`, a weaker writer with no compile error. Measured on this Mac: `writer_test.c` built that way fails 6 checks, the first being `this build asks for FSYNC first, the strongest sync of the platform is F_FULLFSYNC`. The comment at `Makefile:47-51` says so, and the test now holds it.

### L-4: the sync level is evidence-relevant, so it is stated and not asserted away

- **The worker's behaviour did not change.** `sink.c` already had the seam: with `F_FULLFSYNC` defined it asks for the full sync and falls back to `fsync()` by name; without it, it calls `fsync()` and the level is `SYNC_FSYNC`. On Linux every camera file therefore states `FSYNC` in `FIRST_DURABLE_FRAGMENT.syncLevel`, and never `F_FULLFSYNC`.
- **What the Core does with it** (read, not changed): a file that states `FSYNC` goes to the persistent error log at every start of a recording (`apps/core-server/src/capture/index.ts:219-228`). The boot refusal `NO_SYNC` (`capture/boot/checks.ts:261`) comes from the Core's own probe of the volume, not from this word. On Linux the operator will therefore see that notice for every file until someone rules what `fsync()` is worth on the evidence disk: host profile open point 1, hardware check `9A/H-03`. That is a ruling, not a portability change, and it was not anticipated here.
- **The macOS guarantee is tighter than before**, not weaker: the test no longer takes the expected level from the unit it tests.
- **The negative control on Linux proves less, and says so.** `-DDEMS_PROOF_SILENT_SYNC_FALLBACK` makes the writer state the level the build would like. On macOS that is a false `F_FULLFSYNC` after a fallback: 4 checks fail. On Linux there is one level, so the only false statement left is a level before any sync (a file never synced, a file whose first write failed): 2 checks fail. The count differs by platform and is reported as a difference in section 4.

### L-5: not the larger buffer that was expected

The brief named "a larger socket buffer in a test". That cannot pass in the container as it is run: row 78's what-if W3 showed that forcing the size needs the capability NET_ADMIN, which `docker run --rm --network none` does not give. The thread is a change of the test only and needs nothing of the system. DRIVER DECISION 1.

## 3. Security rules: none relaxed, none skipped

| Rule set | On Linux |
|---|---|
| `check.sh src` (the worker's static rules) | the same rule line, every tag, rc 0 |
| `check.sh --selftest` | **95 refused, 1 accepted**, the same 96 lines as on macOS, each by its rule; the import-net control and its refusal run on real ELF binaries |
| the import net after the link of `build/capture-worker` | runs and passes: the watched names read from the ELF binary are `fopen ftruncate link open rename unlink`, of 157 imported symbols |
| `relay-check.sh` and its self-test | 51 refused, the same lines; `build/capture-relay: import net OK` (it read ELF already) |
| guard test | static rules, import net (28 imported names on ELF, 19 on Mach-O, none forbidden), 83 behaviour checks |

The port of the import net was made to hold what it holds on macOS. Cutting the version suffix alone would have left a gap that does not exist on macOS: glibc exports a watched function under more names than its own. Shown in the container: a program that calls `creat64` is **not** named by the reader of HEAD and **is refused** by the reader of this tree (`imports creat, which is not a pinned file-making function`); a program with `open64`, `fopen64`, `ftruncate64` is read as the six pinned functions. The checked spelling `__open_2` did not occur in a real binary here (this clang does not emit it); it is covered by the reader's self-test only. DRIVER DECISION 2.

A negative control of the new self-test line: a scratch copy of the folder with the ELF version cut removed fails `check.sh --selftest` with rc 1 and the line `the reader of the import net does not name a function under every spelling of the two object formats` - on this Mac, so a regression of the Linux reading is caught without a container.

**A limit that is not new but is now visible:** functions that exist on Linux only and make or run a file - `renameat2`, `memfd_create`, `execveat`, `fexecve`, `open_by_handle_at` - are not in the watched list `FILE_MAKING`, as `mkdtemp` is not on either system. The list is a decided list (a new entry bans the name in the sources too), so none was added. For the security review to rule. DRIVER DECISION 3.

## 4. The two result tables

macOS: `make -C apps/capture-worker`, `02_mac_after.log`. Container: the same target, `04_container_live.log:57-247`. After removing the compile lines, run times and the counts that differ from run to run, the two outputs are 185 lines each and differ in **4 lines** (below the table).

| Check line | macOS | Container |
|---|---|---|
| `check.sh: src: static rules OK (...)` | yes, libavformat 63.1.102 | the same line |
| `check.sh selftest` | 95 refused as required, 1 accepted as required | the same 96 lines |
| `anchor_test`, 5 negative controls | all hold, each control fails as required | the same |
| `micwatch_test` + control | holds (M5-WARN-1) | the same |
| `announce_test` | all 187 checks hold | the same |
| `sink_kill_test` | 200 kills, violations 0 | 200 kills, violations 0 |
| `writer_test` | all checks hold, **sync wanted F_FULLFSYNC** | all checks hold, **sync wanted FSYNC** |
| writer control, no truncation | fails on the 2 truncation checks and on nothing else | the same |
| writer control, no size bound | fails on the 3 checks of that rule | the same |
| writer control, silent sync | fails on the **4** checks of that rule | fails on the **2** checks of that rule |
| `start_checks` | all checks hold (R63-06, R63-07) | the same |
| `log_test` + control | holds, 200 written of 60,000 | the same |
| import net of `build/capture-worker` | passes (silent) | passes (silent) |
| `relay-check.sh` rules, self-test | OK; 51 refused | the same |
| `relay_unit_test` | 918 checks passed, 34 of 34 cases | the same |
| `relay-asan` | the same 918 under AddressSanitizer and UndefinedBehaviorSanitizer; 3 negative controls fail as required (1 sanitizer report; 3 and 6 failed check lines) | the same lines, the same three counts |
| `relay_fuzz` | 8 entry points, 16.0 s, seed 186, 0 failures (1,460,544 inputs) | 8 entry points, 16.0 s, seed 186, 0 failures (917,120 inputs) |
| `relay-check.sh: build/capture-relay: import net OK` | yes | yes |
| `guard_test` static rules | 13 planted lines and 7 mutations refused | the same |
| `guard_test` import net | **19** imported names, none forbidden | **28** imported names, none forbidden |
| `guard_test` behaviour | all 83 checks hold | all 83 checks hold |

**Every difference between the two result outputs:**

1. `writer_test: ... sync wanted F_FULLFSYNC` against `sync wanted FSYNC`: the truth of each platform (section 2, L-4).
2. The silent-sync negative control: 4 failed checks against 2 (section 2, L-4).
3. `guard_test: import net ... 19 imported names` against 28: an ELF binary imports more names of the C runtime; none is a forbidden one. Row 78 saw the same.
4. One line of the fuzz table has one space more: its input count has one digit fewer. No content.

Numbers that vary from run to run on one system (kill timings, fuzz input counts, the guard's milliseconds) are not differences of the platform and are not listed.

**Sanitizers on Linux:** AddressSanitizer and UndefinedBehaviorSanitizer both, as on macOS, with the same flags (`-fsanitize=address,undefined -fno-sanitize-recover=all`); the runtime is `libclang-rt-18-dev`, which the profile's package list brings. LeakSanitizer is part of AddressSanitizer on Linux and is active there by default (it is not on Apple's clang): no leak was reported. No libFuzzer is used on either system (the fuzz driver is the test's own).

**macOS before and after** (`01_mac_baseline.log` against `02_mac_after.log`): the same check lines; what differs is the run-to-run numbers above and five compile lines (the build file changed, so the worker, the relay and the guard were rebuilt). Changed results: 0. One more targeted check: `apps/core-server/test/static/guard-family.test.ts`, which reads `check.sh` and the build file, 4 of 4 pass.

### The fixtures on macOS, once each

| Fixture | Result |
|---|---|
| `row58_gate.py all` | 12 runs, 12 PASS |
| `row176_camera_end.py all` | 6 runs, 6 PASS |
| `row175_log_hygiene.py repeat`, then `scan` | 2 PASS; 14 runs scanned, 14 PASS, path text in any worker log 0 |
| `br09_gate.py` through the series runner (`--only br09 --runs 1`) | 38 checks (33 expected PASS, 5 negative controls expected FAIL): 38 as expected, aggregate exit code 0 |
| `row041_relay.py all` | **second run**: 28 runs, 28 PASS |
| `row042_probe.py all` | **second run**: 21 runs, 21 PASS |
| `row043_reopen.py` drop, back, refused, gone, control | **second run**: each rc 0; 11 recorded runs, 11 PASS |
| `row186_bounds.py all` | **second run**: 23 runs, 23 PASS |

Why four of them ran twice: their first run ended `RuntimeError: the test camera did not start`, after seven passes of row 41. The harness named the holder itself: `ports were busy ... the holder was not of this check` - a worker of `.cache/row046-camera-adapter/`. Another session's `npm run test:db` was running `test-fixtures/row046_adapter_listener.py` from a vitest worker with a test camera on port 8565 and a worker on 8559 / 8561, under the database lock only, while this row held the heavy-host lock (`05_mac_fixtures.log:94,251`; the process table at that moment showed pids 41767, 43041, 43061). Not a result of the changes: the second run, after that suite had ended and with 0 listeners on the six ports, passed whole (`09_mac_fixtures_second_run.log`). The collision is reported in `file_requests.md`.

## 5. The container

| | |
|---|---|
| Runtime | colima, already running with another project's containers. Nothing started or stopped but this row's own `--rm` containers. `docker ps -a` after the last run: the same three entries of the other project |
| Image | `dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2`, rebuilt from the final tree: `cdacf98a3f10` (all layers up to the copy of the tree from the cache; no network needed). The definition was not edited. The earlier images `c8ef7251e672` (row 78) and `77c58e01f89a` (this row's first build) lost the tag and were not removed |
| Build context | 128 files: `apps/capture-worker` 68, `scripts/hardware-acceptance` 37, `scripts/host` 23; **0 paths under `apps/input-av`**. Nothing of the repository left the machine; runs with `--network none` |
| Programs | `capture-worker` 392,768 bytes, ELF PIE aarch64, links the five pinned libraries under `/opt/dems/ffmpeg-9.0.2/lib`, names itself `capture-worker/0.6.0`; `capture-relay` 241,920 bytes; `capture-guard` 80,976 bytes. The same three SHA-256 values in the live run and in the image's recorded build |
| Locks | the heavy-host lock per build and per run, on the host and for the container. One exception, stated: a one-second read of the context listing from the image ran without it |

## 6. What row 141 still has to do

The brief asked for `row58_gate.py` and `row041_relay.py` in the container if it has what they need. It does not; nothing was run, and nothing was changed to force it. Measured in the container (`06_container_confirm.log`, `08_container_fixtures_probe.log`):

1. `make fixtures` ends 2: `Makefile:260`, `:265`, `:274` (`fake_mic`, `m5_mic`, the vendored skeleton) compile with `-std=c11` and no feature-test macro: 9, 8 and 4 errors. The same cause as L-1 on three other lines; with the macro all three compile (what-if on a copy). Left to row 141 because the row's own target is `make`, and a further edit of the build file after the macOS runs would have put them in question.
2. `lsof` is not in the image; the harness reads listeners and sockets with it (`test/m3worker.py:93,184,193,209`).
3. `ffmpeg` and `ffprobe` are not on the search path (they are in `/opt/dems/ffmpeg-9.0.2/bin`).
4. The image's FFmpeg has no `libx264` and no `libx265`, and every camera fixture encodes with one of them. A second FFmpeg for the fixtures only, or recorded streams; the worker's library does not change (BR-06).
5. Then BR-10 itself: the announce line's text, level and instant on this Linux library, and the BR-09 series. `make proof` already ends 0 in the container (10 proof builds, among them `capture-worker-noannounce`).

What stays unproven after this row: everything at run time on Linux (no session was recorded there), the sync level on the real disk (`9A/H-03`), amd64, the real host (`9A/H-01`).

## 7. Driver decisions, for the controller to confirm

1. L-5 by a feeding thread in the test, not by a larger buffer, which needs a capability the container run does not have.
2. The ELF reader folds glibc's other linker names of a function onto the watched name. Without it the net is weaker on Linux than on macOS.
3. No Linux-only function was added to the watched list; the gap is named in section 3 and in the worker's README.

Also seen, not acted on: `apps/capture-worker/test-fixtures/row044_door_parent.mts` appeared in the folder during this row's turn. It is not this row's file.

## 8. Rules kept

Claims line first. Edit tool only for existing files (nine: the five of section 2, two READMEs, `file_claims.md`, `file_requests.md`; no scripted replace, no shell append; the one `sed` of this row ran on a scratch copy outside the tree, for the negative control of section 3). New files with Write. Nothing committed, staged or stashed. No full suite. `apps/input-av` not opened. No real device, no credential.
