---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 80
date: 2026-10-13
agent: coder-execution (batch 7, agent B)
tier: T3
work_package: WP-20
requirement: BR-12 / RC-5 (S13-07), AD-09 (1), S13-09 with C19 (request R-1 (b) of row 103), P12-F12 (c), the two requests of row 76
status: complete (built and tested on a double; NOT WIRED into the composition - one request line)
---

# Row 80: host checks in the boot checks and diagnostics, behind an injected command runner

Nothing here has run on a Linux host. Every command goes to a runner that starts nothing; its answers are recorded-style texts written by hand from what `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` states each command prints.

## 1. What was built

| File | Change |
|---|---|
| `apps/core-server/src/capture/boot/host-checks.ts` (new) | The vocabulary (13 codes, 19 reasons, all fixed words), the one table of 9 questions to the host (absolute program, literal arguments), 4 checks of the Core's own process and programs, the diagnostics (`hostCheckResults`: every check with its status), the boot form (`hostCheckOutcomeOf`: the first that is missing), the runner's interface (`HostCommandRunner`) and `hostCommandRunnerOver(door, timers)`, which wraps a door it is HANDED. The file imports two types and nothing else: no process module, no file system, no timer |
| `apps/core-server/src/capture/boot/checks.ts` (fence file, additive) | One import line; `...CaptureHostRefusal` at the end of `CaptureBootRefusal`; `...HOST_REFUSAL_TEXT` at the end of the texts; the optional member `host?: CaptureHostDeps` of `CaptureBootDeps`; two message constants; step 4d (10 lines) between the operator check and the worker handshake; 7 comment lines in the header. No existing check, order, code, text or log line was changed: the 62 cases of `checks.test.ts` from before the row and `boot.test.ts` pass unchanged |
| `apps/core-server/src/capture/boot/__tests__/host-support.ts` (new) | The double: per question a "present" answer, the "absent" answers with the reason each must give, and malformed answers that carry a canary text |
| `apps/core-server/src/capture/boot/__tests__/host-checks.test.ts` (new) | 48 cases: the table, present / absent / malformed / command not found / time-out for each of the 9 questions, the 4 own-process checks, the platform, the runner over a fake door |
| `apps/core-server/src/capture/boot/__tests__/checks.test.ts` | Two import lines and one block of 7 cases at the end (the wiring into the boot) |
| `apps/core-server/src/capture/__tests__/static.test.ts` | One block of 3 cases at the end. No list entry added, removed or changed |

## 2. The checks and their codes

Asked in `REAL_PRODUCTION` only, and only when the composition hands `deps.host` in. `REAL_DEVELOPMENT` and `SIMULATED` never ask (tested with a host on which everything is wrong: 0 questions, no line). Order as below; the first that is missing refuses the start through the existing `refuse` (same log line, same error-log row, code and reason).

| # | Code | Profile item | How it is asked | Reasons when missing |
|---|---|---|---|---|
| 1 | `CAPTURE_HOST_CORE_FILE_LIMIT` | HOST-35 (AD-09 (1)) | the limit reader handed in (no command); every platform | `LIMIT_ABOVE_ZERO`, `LIMIT_UNREADABLE` |
| 2 | `CAPTURE_HOST_DIAGNOSTIC_SWITCH` | HOST-36 (AD-09 (1)) | the runtime's start arguments and "option variable set" handed in; every platform | `DIAGNOSTIC_SWITCH_SET`, `NODE_OPTIONS_SET` |
| 3 | `CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE` | HOST-05, HOST-15 | `DEMS_CAPTURE_RELAY` under the path rule of check 2 (`workerProgramProblemOf`); every platform | `NOT_SET`, the words of the path rule, `NOT_EXECUTABLE` |
| 4 | `CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE` | HOST-05, HOST-15 | `DEMS_CAPTURE_GUARD`, same rule | same |
| 5 | `CAPTURE_HOST_LOOPBACK_RULE_MISSING` | HOST-25, HOST-41 (BR-12, RC-5) | `/usr/bin/systemctl is-active dems-loopback-rule.service` -> `active` | `RULE_UNIT_NOT_ACTIVE` |
| 6 | `CAPTURE_HOST_CAN_GAIN_PRIVILEGES` | HOST-38 (C19, R-1 (b)) | `/usr/bin/grep -E ^NoNewPrivs: /proc/self/status` -> `NoNewPrivs:` then 1 | `NO_NEW_PRIVILEGES_OFF` |
| 7 | `CAPTURE_HOST_CRASH_COLLECTOR` | HOST-37 (AD-09 (1); request (b) of row 76) | `/usr/sbin/sysctl -n kernel.core_pattern fs.suid_dumpable` | `CORE_PATTERN_PIPES_TO_A_PROGRAM`, `SUID_DUMPABLE_NOT_ZERO` |
| 8 | `CAPTURE_HOST_FORWARDING_ON` | HOST-20 (S13-03 (b)) | `/usr/sbin/sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding` -> 0 twice | `FORWARDING_ON` |
| 9 | `CAPTURE_HOST_ARPING_VARIANT` | HOST-18 (P12-F12 (c)) | `/usr/bin/dpkg -S /usr/bin/arping` -> `iputils-arping: /usr/bin/arping` | `ARPING_NOT_INSTALLED`, `ARPING_OF_ANOTHER_PACKAGE` |
| 10 | `CAPTURE_HOST_AUDIO_GROUP` | HOST-26, HOST-40 | `/usr/bin/id -nG` (the groups of the Core's own process) holds `audio` | `NOT_IN_AUDIO_GROUP` |
| 11 | `CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED` | HOST-31 | `/usr/bin/timedatectl show -p NTPSynchronized --value` -> `yes` | `CLOCK_NOT_SYNCHRONISED` |
| 12 | `CAPTURE_HOST_MAY_SLEEP` | HOST-29 | `/usr/bin/systemctl is-enabled` on the four sleep targets -> `masked` 4 times | `SLEEP_TARGET_NOT_MASKED` |
| 13 | `CAPTURE_HOST_ALIAS_SOCKET` | HOST-44 (C19) | `/usr/bin/stat -c '%F %U %G %a' /run/dems-core-netalias/socket` -> `socket root dems-netalias 660` | `SOCKET_ABSENT`, `SOCKET_OWNER_GROUP_OR_MODE` |

Every question (5 to 13) also has three reasons of its own kind: `HOST_COMMAND_NOT_STARTED` (program not there, or a runner that throws), `HOST_COMMAND_TIMED_OUT` (5 s bound), `HOST_ANSWER_NOT_UNDERSTOOD` (another form, or more than 4,096 characters). A check that cannot see refuses: it never answers "in place".

Off Linux in `REAL_PRODUCTION`: checks 1 to 4 run, the nine questions are not asked, and that is said as a warning with an error-log row (`CAPTURE_HOST_PROFILE_NOT_ASKED`); the start is not refused for it.

What leaves the module: a code, a reason, the item ids. The output of a command is judged and dropped. Tests plant a canary (a home path, an account and a password-like word) in the refused outputs and assert that neither it nor any of `/usr/`, `/run/`, `/proc/`, `/home/` is in the message, the reason, a log line or an error-log row. Refusal texts name the profile item and the remedy, no host path.

## 3. The SR-1 decision for row 80 (the point C17 left open)

SR-1 (`decisions/003_amendment_rows.md:155`) admits "exactly three entries"; "a fourth file of either kind fails the test until a further decision row admits it". Its open point 4 (`:246`) names the route for rows 80 and 105: the process is started "by injection". Its rejected alternative (`:263`) is "widening SR-1 now to cover rows 80 and 105".

Decided: SR-1 does NOT cover row 80, and the rule was not stretched. `host-checks.ts` starts nothing; the runner is a dependency the composition supplies; only the fake is in the capture area's tests. No entry of G-R2 or G-R8 was added. The new static block holds the route: the file's imports are two type imports; it has no occurrence of the process, file-system, socket, timer, environment, time or random patterns; the runner is called in one place with a row of the table; the program literals are exactly eight; no program that changes the host and no shell; `hostCommandRunnerOver` has no caller in the product yet.

## 4. Requests served, refused, left

| Request | Result |
|---|---|
| Row 76 (a): read the unit state instead of listing the rule set; say "not readable" apart from "missing" | served: check 5 asks `is-active`; an unreadable state has its own reasons, an inactive unit has `RULE_UNIT_NOT_ACTIVE` |
| Row 76 (b): also name a core pattern that pipes to a collector | served: check 7. A pattern that names a file passes (nothing is written at limit 0); a pipe to anything but `/bin/false` is refused |
| Row 103 (b): a production boot names a Core without the no-new-privileges state | served: check 6 |
| Row 71 (agent S): a new rule on `source_facts` and `cardListingText` in the capture static file | REFUSED: it is a new rule, not an entry SR-1 (process and file-system importers) or SR-4 (helper arguments) admits. It needs its own decision text; offered, not needed for green |
| Rows 46, 67 (agents Y, Z) | no capture-static request was filed (checked once before finishing) |
| Row 24 / row 21: `fence/index.ts:457,515` pass the Linux program-path reader | left requested: the fence index is not in row 80's area |

## 5. Tests

| Command | Result |
|---|---|
| `npx vitest run --project unit --maxWorkers=2` on `host-checks.test.ts`, `checks.test.ts`, `boot.test.ts`, `capture/__tests__/static.test.ts` (run 1) | `Tests 1 failed / 195 passed (196)`: the failure was in my own new case (a wrong name of a path-rule word in the test) |
| the same (run 2, after the fix) | `Test Files 4 passed (4)`, `Tests 196 passed (196)` |
| `test/static`, `capture/adapters/__tests__/static.test.ts`, `src/capture/boot` (once) | `Tests 1 failed / 355 passed (356)`; the failure is not row 80's (below) |
| `npx tsc --noEmit` in `apps/core-server` | 1 error, not row 80's (below); no error in a file of this row |

Reds in files of other rows, seen and not edited:

- `apps/core-server/src/capture/adapters/__tests__/static.test.ts:126` (rule A-2, "the injection point has no caller in the product yet"): `camera/relay-start.ts` is now a caller. Owner: agent Y, row 46 (writer of that list in this batch; the change is announced in request line 62).
- `apps/core-server/src/capture/adapters/audio/usb-audio-production.ts:600` TS2741 (`sampleBits` missing in `UsbAudioCardFacts`). Owner: agent Z, row 67, in flight.

Verification cell: per prerequisite 2 tests (present, missing) - 13 of 13 have both, all passing; with a "missing" fixture the boot names that prerequisite (each of the 9 questions removed one at a time through `runCaptureBootChecks`, plus the 4 own-process checks); no existing refusal text changed.

## 6. Driver decisions (for the controller to confirm)

1. Not wired. `capture/boot/index.ts` is outside the row's area, so `deps.host` is optional and absent today: no production start runs a host check until the request line is applied. This is also what keeps every existing test unchanged.
2. Off Linux the nine questions are skipped with a warning, not refused. Whether a production Core off Linux must be refused is a ruling, not a host check.
3. Checks 1 to 4 run on every platform in `REAL_PRODUCTION`. Once wired, a production start on this Mac needs a core-file limit of 0, no diagnostic switch, and both program keys set.
4. The path rule of relay and guard is here (the task names it); row 81 keeps the stated library version.
5. `id -nG` asks the groups of the running process, not the account database (`id -nG <service-user>` of the profile): what the unit gave the Core is what opens a sound device, and no account name becomes an argument.
6. Added beyond the row's list, from the profile: HOST-36, HOST-29, HOST-38. Not built: HOST-39 (capability sets), HOST-42 (umask), HOST-32 (start after time sync), the forwarding flag of the camera port itself and HOST-24 (both need the interface name: row 81's interface file), HOST-34.
7. The door behind `hostCommandRunnerOver` is typed as the local helper door (`HelperDoor`), as the process listing of rows 21 and 24 uses it: the questions carry no secret and need no start message. Which door is handed in is the composition's choice.

## 7. What is unproven without the host, and the check that proves it

| Unproven | Check |
|---|---|
| The eight program paths exist on Ubuntu 24.04 (`/usr/sbin/sysctl`, `/usr/bin/dpkg`, ...) and run with an EMPTY environment (the door's default), `systemctl` and `timedatectl` included | 9A/H-01, 9A/H-04 |
| Each answer has the form the profile states; exit codes (`is-active` 3 or 4, `is-enabled` non-zero for masked, `dpkg -S` 1, `stat` 1) | 9A/H-01 |
| A start with one prerequisite removed names exactly that one (HOST-49) | 9A/H-04 |
| The unit state stands for the rule: the rule can be deleted while the one-shot unit stays `active`. The owner rule itself, and its counter, are only seen by the administrator | 9A/H-01 (HOST-25), 9A/H-04 |
| A Core with no capability can ask all nine questions; `NoNewPrivs` of the child equals the Core's | 9A/H-05, 9A/H-06, 9A/H-17 |
| The crash collector: whether a piped core pattern is served at limit 0 (hypothesis D-4 of row 76); a host without IPv6 answers the forwarding question in another form and would be refused as "not understood" | 9A/H-01 |
| The socket node as the service manager creates it; `%F` prints `socket` | 9A/H-05 |
| `/usr/bin/arping` is where the iputils package puts the tool, and the helper uses that path | 9A/H-25 |
| No leftover of input-av (HOST-02, HOST-47) is asked by the Core at all | 9A/H-27 |
| No child of the runner outlives the Core; a question that hangs is stopped at 5 s | 9A/H-02 |
| The production start command carries no diagnostic switch (HOST-36 as started by the unit) | 9A/H-16 |

## 8. Rules kept

Edit tool only for every existing file (`checks.ts`, `checks.test.ts`, `static.test.ts`, `file_claims.md`, `file_requests.md`); new files with Write. No commit, no stage. No full suite. No process started, no port bound, no heavy lock needed. `apps/input-av/data/` not opened; `apps/input-av/nvr/doctor.py` read only.
