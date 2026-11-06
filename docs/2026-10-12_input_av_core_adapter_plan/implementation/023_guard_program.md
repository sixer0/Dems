---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 23
date: 2026-10-13
agent: coder-execution (batch 7, agent W)
tier: T3
work_package: WP-02 (condition "guard needed": met by experiment E-7, test/022_e7_without_guard.md)
requirement: design addendum 8 WP-02 ("the guard ends its child when its own standard input ends"); AD-09 (3) (the guard's half: no surviving child); AD-03 (6) / BR-07 (4) (nothing of a start message in the guard); HA-11 (answered by row 22, acted on here)
status: complete on this Mac's doubles; the Linux parent-death signal is implemented behind a compile-time seam and UNPROVEN until hardware check 9A/H-02 / row 79
---

# Row 23: the capture guard

Paths are under `apps/capture-worker/` unless they begin with `docs/`.

## 1. What was built

| File | State | What |
|---|---|---|
| `src/guard/guard.c` | new | the program, 185 lines, the system's library only. Binary `build/capture-guard` |
| `test/guard_double.c` | new | the double of a helper: it never ends because its input ended (the property E-7 measured on FFmpeg), and reports what it was started with |
| `test/guard_test.py` | new | the guard's static rules, its import net and its behaviour, each with controls |
| `Makefile` | additive | `GUARD_BIN`, `GUARD_SRC`, `GUARD_CFLAGS`; target `guard`, part of `all`; the double's build line |
| `README.md` | additive | one section |

Not touched: the worker's sources, the relay, `check.sh`, `relay-check.sh`. The guard sits in `src/guard/`, a folder neither rule file reads, and its binary is not a `capture-worker-<name>` (the name of a proof build).

## 2. The program

```
capture-guard <absolute path of the program> [its arguments ...]
```

| Subject | As built | Where |
|---|---|---|
| One child, no shell | `fork`, then `execve(argv[1], argv + 1, environ)`: the argument vector from its second word on, unchanged; no search path (`execve`, and a first word that is not an absolute path is refused, code 120) | `guard.c:142`, `:167` |
| Environment | handed on as given: the third argument of `execve` is the guard's own environment pointer; the guard reads and changes no entry | `guard.c:167` |
| Core-file limit 0 | `setrlimit` soft and hard, read back, before anything is started; code 121 otherwise. The child inherits it and cannot raise the hard limit | `guard.c:143` |
| Ends the child | every 50 ms it looks at: the child, its own standard input, its parent (`getppid()` no longer the process that started it), a signal (SIGTERM, SIGINT, SIGHUP). On any of the last three: SIGTERM, after 2,000 ms SIGKILL | `guard.c:171-182` |
| Reaps, passes the exit on | `waitpid` in every path; the guard's exit is the child's status, or 128 + the signal's number | `guard.c:119-135`, `:183-184` |
| Its own words | none: it writes nothing to any descriptor. Codes 120 usage, 121 core-file limit, 122 input is no pipe or socket, 123 fork failed, 126 not executed | header of `guard.c` |
| Linux seam | `#ifdef __linux__`: `prctl(PR_SET_PDEATHSIG, SIGKILL)` in the child between fork and exec, then one look at its parent. Not compiled on macOS | `guard.c:159-166` |

## 3. How a start message reaches the child (the decision asked for)

**The guard does not forward a first line. It never reads its standard input.**

1. The production door writes the message to the standard input of the program it started (`docs/.../implementation/021_production_door.md`, point 3), here the guard.
2. The child inherits that same descriptor at `fork` / `execve`. The kernel hands the bytes to the child's own read; they are never in the guard's address space.
3. The guard learns "the input has ended" without a read: `poll` reports a hang-up or an error, or it reports "readable" while the count of waiting bytes (`ioctl FIONREAD`, a number) is 0. Three looks 2 ms apart must agree, for one race: the child may take the waiting bytes between the guard's two questions. Bytes that wait unread belong to the child and are not an end.

**Proof that no byte is kept or logged:**

| What | Check | Result |
|---|---|---|
| The source has no call that reads, writes, prints, opens, reads the environment or starts a shell (comments removed) | `guard_test.py static`, rules READ, WRITE, SHELL, ENV, OPEN, ARGV | holds; 13 planted lines and 7 mutations are each refused by their rule; the same texts inside a comment are not code |
| The linked binary imports no such function, whatever the spelling was | `guard_test.py imports` (`nm -u`) | 19 imports: `_clock_gettime _environ _execve _fork _fstat _getpid _getppid _getrlimit _ioctl _kill _nanosleep _poll _setrlimit _sigaction _waitpid __exit ___error` and the stack check; none forbidden. Control: a program that reads is refused |
| On the wire | run (2): a 205-byte start-message line (synthetic account, built from parts) written to the guard's input, through a pipe and through a socket pair (what Node gives a child) | the child read it byte for byte (same length, same FNV-1a hash); the guard's two streams held 0 bytes |

Consequence for the callers: a helper that takes no start message (the audio helper has no credential) simply never reads; a helper that does take one reads it itself. The guard needs its input to be a pipe or a socket (code 122 otherwise): a file or `/dev/null` has no end that means "the Core is gone".

## 3a. THE REAL INVOCATION FORM, against what row 67 assumed (`file_requests.md`, row 67's line to agent W)

| Subject | As built | Row 67's assumption |
|---|---|---|
| Argument vector | `<DEMS_CAPTURE_GUARD> <absolute helper program> <helper arguments ...>`; no option of the guard, no `--`; the child's vector is the guard's from its second word on, unchanged (the helper's `argv[0]` is its own path). A helper path that is not absolute: guard exit 120, nothing started | **the same**: `guardedArguments` = `[helperProgram, ...helperArguments]` needs no change, provided `helperProgram` is an absolute path |
| Environment | the guard's own, handed on unchanged (the door's one key reaches the helper) | the same |
| Standard output, standard error | the child inherits both; the guard writes nothing to either, so the helper's `-progress pipe:1` report arrives as the helper wrote it | the same |
| **Standard input** | **the child INHERITS the guard's standard input** (the same descriptor). The guard never reads it; it only asks whether it is at its end. A start message, if the door writes one, is read by the child itself; a helper started with `-nostdin` reads nothing. The input must be a pipe or a socket (else exit 122) | **DIFFERS**: row 67 expected "the guard's own input is never handed to the child". Nothing breaks for the audio helper (no start message, `-nostdin`); but a helper that reads its input would read what the door writes, and the door must not write bytes meant for the guard - there are none: the guard takes no message |
| End | the child is ended when the guard's input ends (`endInput()`), when the guard's parent is gone, or on SIGTERM / SIGINT / SIGHUP to the guard: SIGTERM to the child, SIGKILL after 2,000 ms | the same for input end and SIGTERM |
| Exit code | the child's exit status as the guard's own; 128 + the signal's number when the child was ended by a signal (143 after the guard's SIGTERM, 137 after its SIGKILL). The guard's own codes: 120, 121, 122, 123, 126 | "exits with the child's status": the same, with the 128 + n form for a signal to be read by the adapter as "stopped", not as a failure of the helper |
| Door's `kill` | a SIGKILL of the guard itself leaves the helper on macOS (Linux: parent-death signal, unproven here) | the adapter should stop with `endInput()` and keep `kill` for its bound |

For the integration pass: one decision is open - whether the helper may hold the door's input (as built; section 3 says why) or must get an empty one. The second is a change of about five lines in `guard.c` (open nothing: hand the child a pipe end the guard keeps closed) and makes a start message unreachable for a guarded helper. DRIVER DECISION 1 stands until the controller rules.

## 4. Checks (this Mac, arm64, Apple clang 21; 2026-10-13 05:42 local; no port, no worker, no FFmpeg; 1-minute load 3.9)

Command: `make -C apps/capture-worker guard` (repository root). Result lines:

```
guard_test: static rules OK over src/guard/guard.c; 13 planted lines and 7 mutations refused, each by its rule
guard_test: import net OK over build/capture-guard (19 imported names, none forbidden); a program that reads is refused
guard_test: all 83 checks hold (child gone after the guard's input ended: 17 to 23 ms over 20 runs, bound 500 ms; after a SIGKILL of the guard's parent: at most 66 ms over 6 runs; a child that ignores SIGTERM: killed after 2018 ms; orphans: 0)
```

| Case of the delegation | How it was run | Measured |
|---|---|---|
| The child ends when the guard's input ends, within a measured bound | 20 runs: the double is running, the test closes the guard's input; time until the child's process ID no longer exists | 17 to 23 ms; asserted bound 500 ms; the guard's exit 143 (128 + SIGTERM) in every run |
| Control | nothing done for 1 s | child and guard still there |
| Bytes waiting unread are not an end | 101 bytes written, never read, 0.5 s | child and guard stay; then the input ends: gone inside the bound |
| The guard's parent is killed with SIGKILL | a wrapper process of the test starts the guard and is killed. 3 runs with the input held OPEN by the test (only the parent watch can act), 3 with the input held by the wrapper | child gone after at most 66 ms, the guard too; 6 of 6 |
| Control: no guard | the same wrapper starts the double directly and is killed; then its input ends as well | the double survives both (still there 1 s and 1.3 s later): E-7's result on the double, and proof that the check finds a survivor |
| The child's exit is passed on | the double ends by itself with 0, 7, 255, and by SIGKILL, the guard's input open | guard exit 0, 7, 255, 137 |
| A child that ignores SIGTERM is killed after the bound | the double ignores SIGTERM; the input ends | gone after 2,018 ms (bound 2,000 ms; asserted window 1.9 to 2.7 s); guard exit 137; reaped |
| SIGTERM to the guard | - | child gone inside the bound; exit 143 |
| No orphan after 20 runs | every child and every guard of the whole run asked for at the end | 0 left |
| Vector, environment, limit | 12 awkward words (blank, empty, `$HOME`, `;|&>`, quotes, a backslash, `*`, a non-ASCII letter, `-`, `--`); 2 environment entries; the guard started with a soft core-file limit of 1 MiB | the double's vector and environment equal what was given, nothing added; its limit is 0 / 0 |
| Refusals | no program; a relative path; a bare name; input `/dev/null`; a program that does not exist | 120, 120, 120, 122, 126; nothing written, no child |

Secret scan of the new files: `node scripts/secret-scan/count-only.mjs apps/capture-worker/src/guard apps/capture-worker/test/guard_test.py apps/capture-worker/test/guard_double.c` -> `TOTAL: 0 in 0 file(s)`.

The whole build with the guard inside it: `make -C apps/capture-worker` under the heavy-host lock, `make rc=0` (twice: `.cache/row042/make_1.out`, and the final run `.cache/row142/make_final.out`, where the guard's line reads `all 83 checks hold (... 16 to 24 ms over 20 runs ...; at most 64 ms over 6 runs; ... killed after 2020 ms; orphans: 0)`).

## 5. The double, and what stays unproven

- **The double** is `test/guard_double.c`, not FFmpeg. It has the one property that matters (it does not end on the end of its input; shown by the control). The real audio helper under the guard is not run here: rows 25 (E-7 with the guard) and 67 / the microphone path.
- **Linux**: the parent-death signal, `prctl`, the limits as the process table shows them, the behaviour of `poll` and `FIONREAD` on Linux pipes and sockets, the build with `-pie` and relro. The seam compiles on Linux only; nothing of it ran. Hardware check 9A/H-02 and row 79 (container); 9A/H-24.
- **A SIGKILL of the guard itself on macOS**: the child lives on until its consumer goes (E-7). The guard cannot handle its own SIGKILL; on Linux the seam covers it. The door's `kill` is a SIGKILL of the guard: the adapter should prefer `endInput()` and reach for `kill` only at its bound (the guard needs at most 2.1 s after the end of its input).
- **A child that starts programs of its own**: only the child is signalled, not a process group.
- **Inherited descriptors**: the guard closes none (the door gives three). Row 79 may add a close of the rest; on this Mac the loop costs 0.38 s at this shell's descriptor limit (row 186, L-6).
- **The guard through the real door** (`production-door.ts`): not run; the socket-pair case stands for it.

## 6. Driver decisions (for the controller to confirm)

1. **No forwarding**: the child inherits the input; the guard never reads (section 3).
2. **End of input detected by `poll` and the count of waiting bytes**, three looks; an input that is no pipe or socket is refused (code 122).
3. **Constants**: look every 50 ms; SIGTERM, then SIGKILL after 2,000 ms.
4. **A killed child is passed on as 128 + signal**; the guard's own codes are 120 to 123 and 126 and can coincide with a child's.
5. **The program must be an absolute path**; no search path.
6. **Signals to the guard (TERM, INT, HUP) end the child**; the guard installs handlers, never "ignore" (an ignored signal would be inherited by the helper).
7. **One more file than the claim named**: `test/guard_double.c` (declared in the closing line of `file_claims.md`).
8. **The guard is built with the relay's hardening flags** and checked by a Python script rather than a third shell rule file.

## 7. Requests

None blocking. For information to rows 25, 67 and 46: the command form of section 2, the codes, and "prefer `endInput()`; `kill` leaves the helper on macOS".

---
*Generated: 2026-10-13*
