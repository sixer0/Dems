---
task: 2026-10-12_input_av_core_adapter_plan
row: 106c
milestone: M10 / WP-19b (the remainder of row 106b; decision C82, named amendment SR-11)
agent: coder-execution (driver)
date: 2026-10-13
tier: T3
status: needs-review - built, wired and green on doubles; TWO driver decisions change the letter of C82 (section 3) and three small edits lie outside the row's list (section 4); UNPROVEN ON LINUX
closes_requirements: review finding F-07 in the product (the ONE name of the helper's interface file is a live fact source of every `add`); C82 "NOT WIRED"
---

# Row 106c - the interface file of the address helper as the alias lifecycle's third fact source

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`.

**Plain statement.** The runner is a DOUBLE in every test: a function that records the question and answers from a script. No program was started, no file under `/etc` was read, no `ip`, `arping`, `cat` or other host command ran, no host address was read or changed, no socket of the helper was opened. The instance on ports 4423 / 5178 was not touched. Nothing here is proven on Linux (section 7).

## 1. What is wired

| Step | Where | Text |
|---|---|---|
| The entry makes ONE more runner and hands it in as the third member of the entry statement | `CS/src/index.ts:120` | `composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app), hostRunner: captureHostRunnerOf(createSystemTimers()) });` |
| The input takes it | `CS/src/capture-composition.ts`, `ProductionCaptureInput.hostRunner?: HostCommandRunner` | optional, as `network` is: a test composes without it |
| THE ONE HAND-OVER | `CS/src/capture-composition.ts`, `hostAliasInterfaceFileOf(input)` | `return input.aliasInterfaceFile ?? hostAliasInterfaceFileSourceOf(input.platform === 'linux' ? (input.hostRunner ?? null) : null, INTERFACE_FILE_COMMAND);` |
| The lifecycle's source | `mountHostAliasOf` | `fileInterface: hostAliasInterfaceFileOf(input),` |

**The fixed command row** (declared once, `CS/src/capture/boot/program-checks.ts:128`, with `INTERFACE_FILE = '/etc/dems/netalias-interface'` at `:100`; NOT edited - it is the row the boot's program check 4 already asks):

```
export const INTERFACE_FILE_COMMAND: HostCommand = Object.freeze({ program: '/usr/bin/cat', args: Object.freeze([INTERFACE_FILE]) });
```

One program by an absolute literal, one argument by a literal, no parameter, frozen: no argument is made from data (rules G-R12 / SR-4). The row does not live in the helper table (`adapters/local/*-helper-args.ts`); that file was not touched.

**When it is asked.** At every `add` (the facts reader of row 106), never at composition, never for a removal, the boot sweep or the shutdown. The answer is read by `interfaceFileNameOf` of row 106b: exit code 0, at most 256 characters, exactly ONE line of the form `^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$`; anything else is "unreadable".

**Fail closed, kept.**

| The file / the host | The `add` |
|---|---|
| any platform but `linux` (this Mac); no runner handed in | `INTERFACE_FILE_UNREADABLE` - NOTHING IS RUN |
| the program does not start, does not end in 5 s, ends with another code (file absent, not readable) | `INTERFACE_FILE_UNREADABLE` |
| empty; two names; characters outside the form; a path; longer than 15; more than 256 characters; a runner that throws | `INTERFACE_FILE_UNREADABLE` |
| a well-formed name that is not the stored camera interface (whether or not the host has such an interface) | `INTERFACE_FILE_DIFFERS_FROM_ROW` |
| file and row agree on a name the host's interface table does not hold (the network reader then has no facts) | `HOST_FACTS_UNREADABLE` |
| the ONE name the stored row holds, on a host that has it | goes on to the wrong-network guard and the helper |

Every refusal is before the helper is asked: 0 lines to the helper, 0 audit entries, 0 rows.

**macOS.** The platform seam of `src/host-alias-socket.ts` still answers `NOT_AVAILABLE_ON_THIS_PLATFORM` first; and even with a helper double in its place the source runs nothing off `linux` (database case, second half).

## 2. The static rules moved (all in `CS/src/capture/__tests__/static.test.ts`, each with a comment naming SR-11 and decision C82)

| Pin | Before | After |
|---|---|---|
| the entry's lines that name capture (block P25) | import of three names; the statement with two members | the import gained ONE name (`captureHostRunnerOf`); the statement is the constant `ENTRY_COMPOSITION` with three members; no line that names capture was added (13 lines, as before) |
| `MOUNT_MEMBERS` of `composeProductionCaptureOf` (row 157) | `platform`, `network` | + `hostRunner` (one line, with its decision) |
| the literal of the entry statement (row 157, last line of case (a)) | C76's text | the text of section 1 |
| who gets a runner (block of row 80, beside `:1441`) | `hostCommandRunnerOver(` called from `[host-checks.ts, host-facts.ts]` | THAT LIST IS UNCHANGED; added: `captureHostRunnerOf(` is called from `[host-facts.ts, src/index.ts]`, the maker's body and its use by the host facts are pinned, the entry calls it once, and no source outside `src/capture/` names `hostCommandRunnerOver` or `startHelperProcess` |
| NEW rule `runnerViolations` | - | every line of the composing file that names the runner, its type, a maker, the door or the fixed row is one of THREE pinned lines (the import, the member, the one use on `linux` with the row), each exactly once; the input is never spread or taken apart; the row is declared once and named by four files; `hostRunner` is named by the composing file and the entry only |
| NEW planted control "a second use of the runner from the composing file" | - | 9 mutations, each named: another question (`/usr/sbin/ip`), the runner handed on, a second runner by either maker, the row asked directly, the input destructured, the input spread, the one use twice, the one use without the `linux` condition |
| the planted control that held `cardPrograms` (row 157 (a) control) | one seam member | three: `cardPrograms`, `aliasTransport`, `aliasInterfaceFile` (C82 (3)), plus the runner taken away and a second runner under another member name |

The provideHost statement and its four facts are unchanged and still pinned literally.

## 3. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why / the alternative |
|---|---|---|
| D-1 | The entry hands in a runner OF THE SAME MAKE, not the same object "it already makes" | The runner of the boot checks is made INSIDE `captureHostOfProcess(...)`, which stands inline in the provideHost statement; that statement is pinned literally up to `await app.readiness.boot();` and C82 moves only two pins. Sharing the object needs a `const` before the statement (the provideHost pin and its member list would move) or a door on the boot control (the option C82 did not take). The runner is stateless: a door and a timer source |
| D-2 | The maker is `captureHostRunnerOf(timers)` in `capture/boot/host-facts.ts`; the list of `hostCommandRunnerOver(` callers did NOT move | First built as C82's letter suggests (the entry calling `hostCommandRunnerOver(startHelperProcess, ...)`, list + `src/index.ts`): rule A-5 of `capture/adapters/__tests__/static.test.ts` went red - the local helper door may leave the capture unit through no index. That rule was not touched; the design was taken back. Now the door and the ONE call stay in `host-facts.ts`; the entry gets a runner, never the means to start a program of its own. What moved "by exactly that" is the maker's caller list |
| D-3 | Three edits outside the row's list, each additive and declared in `file_claims.md` BEFORE it was made: `capture/boot/host-facts.ts` (the maker, 3 lines of code, and one line of `captureHostOfProcess` now calling it), `capture/boot/index.ts` (ONE name in the export line of host-facts; re-read first - row 226c is in that file), `capture/index.ts` (ONE export line: `INTERFACE_FILE_COMMAND`, `captureHostRunnerOf`, `type HostCommandRunner`) | The closed capture unit offers neither the row nor a runner to a file outside it; without them the entry statement cannot be written. Request line of row 106b, option (a), already named the export of the row. Reported in `file_requests.md` |
| D-4 | The source is asked on `linux` only (the condition is in the pinned line) | The brief: on macOS nothing is run. A `cat` of a path that does not exist would be harmless, but "nothing is run" is the stated behaviour and the planted control holds it |
| D-5 | `hostAliasInterfaceFileOf` is an exported function of the composing file | so that the ONE hand-over is tested without an app (17 unit cases) and pinned as one line |

## 4. Files

| File | Change |
|---|---|
| `CS/src/index.ts` | one header line; one name in the import of `./capture`; two comment lines; the statement's third member |
| `CS/src/capture-composition.ts` | two names in the import of `./capture`; the member `hostRunner`; `hostAliasInterfaceFileOf`; the source line of `mountHostAliasOf`; three comment places (row 111 added its mount line to the same file in this wave: re-read before each Edit) |
| `CS/src/capture/boot/host-facts.ts` (D-3) | `captureHostRunnerOf`; `run: captureHostRunnerOf(timers)` |
| `CS/src/capture/boot/index.ts` (D-3) | one name in one export line |
| `CS/src/capture/index.ts` (D-3) | one export line with its comment |
| `CS/src/capture/__tests__/static.test.ts` | section 2; 68 -> 70 cases |
| `CS/src/capture/host-alias/__tests__/lifecycle.test.ts` | 13 cases appended to the block "the facts reader and the candidates" (12 refusals through the lifecycle, 1 passing) |
| `CS/src/__tests__/capture-composition.test.ts` | one import name; one block of 19 cases |
| `CS/src/__tests__/capture-composition.db.test.ts` | one case in the block of row 106b (two booted production Cores: `linux` stated with a runner double, `darwin`) |

Not edited: `capture/boot/program-checks.ts`, `checks.ts`, the helper table, `capture/host-alias/*.ts` (product), `signer/host-key.ts`, `scripts/host/*`, `packages/shared`, any other static list.

## 5. Checks (2026-10-13, in `CS`, `--maxWorkers=2`; database runs with the command sandbox off, under `.locks/db-migrate.lock`, on throw-away databases, "0 remain" each time)

| Check | Command | Result |
|---|---|---|
| The capture static file | `npx vitest run --project unit src/capture/__tests__/static.test.ts` (with the two below) | last run: `Tests 1 failed / 211 passed (212)` over the three targets; the one red is NOT mine: `G-R9 ... SR-2` now lists `src/modules/capture-config/camera-network/service.ts` (row 111, in flight) |
| The whole static set (46 files: every `static.test.ts`, `test/static/*.test.ts`) with host-alias, the composition unit file and `src/capture/boot` | `npx vitest run --project unit <46 files> src/capture/host-alias src/__tests__/capture-composition.test.ts src/capture/boot` | `Test Files 3 failed / 55 passed (58)`, `Tests 3 failed / 1153 passed (1156)`. Reds, none mine: `test/static/cli.test.ts` (`cli/mark-compromised-command.ts:165 string: wrap`); `test/static/search-path.test.ts` (`src/db/migrations/0027_alias_removal_reasons_privileges.sql`, agent D2's new migration); the SR-2 line above |
| Host-alias unit tests | in the runs above | `Test Files 2 passed`, `Tests 89 passed (89)` (run 1 of the new cases: 1 red of mine - the passing case had no scripted helper answer; fixed, run 2 green) |
| The composition unit file | in the runs above | green (53 cases) |
| Database: the composition and the lifecycle | `npx vitest run --project db src/__tests__/capture-composition.db.test.ts src/capture/host-alias/__tests__/lifecycle.db.test.ts` | `Test Files 2 passed (2)`, `Tests 21 passed (21)` - twice (before and after the correction of D-2) |
| Database: the C46 case on the real mount (it calls `captureHostOfProcess`) | `... --project db src/capture/fence/__tests__/fence.db.test.ts -t "C46"` | `Tests 1 passed / 46 skipped` |
| The seam's caller pin | `... src/__tests__/host-alias-socket.test.ts -t "the mechanism has one caller"` | `Tests 1 passed / 17 skipped` |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 |
| Lint | `npx oxlint <the nine changed files>` | exit 0 |

**The two reds of row 226c** (`signer/host-key.ts` at `:220`, the C46 text in `boot/index.ts`): NOT RED at my end - neither appeared in any of my runs of the capture static file.

## 6. The host profile

`scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, item **HOST-46** grants the read of the file: "one line that names `<camera-interface>`, owner root, mode 0644" (world-readable, so the service user reads it; `80-helper-state.sh` checks `stat -c '%U %a'` = `root 644`). NOT STATED by any item: the mode of the folder `/etc/dems` (HOST-34 only implies the service user can pass it) and that the Core's unit (file G) hides neither that folder nor `/usr/bin/cat`. Request line filed for the document row; nothing under `scripts/host/` was changed.

## 7. Unproven without the host

| Unproven | Check |
|---|---|
| `/usr/bin/cat` of the file as `<service-user>` from inside the Core's unit, through the local helper door with an empty environment | `9A/H-05` |
| The runner's 5 s bound against a file on a slow or hung mount | `9A/H-05` |
| A real `add` after the file was read (the helper's own reading of the same file agrees) | `9A/H-05`, `9A/H-06` |

## 8. Rules kept

Edit tool only for every existing file; the two documents of this row with Write. The claims line was the first act; its two added lines preceded the edits they name. No commit, no stage. No full suite. No port bound, no process started by this row beyond the test runner. `apps/input-av/data/` not opened; no `.env` read.

---
*Generated: 2026-10-13*
