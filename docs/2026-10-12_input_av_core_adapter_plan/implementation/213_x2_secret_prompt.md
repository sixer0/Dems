---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 213
date: 2026-10-13
agent: coder-execution (batch 9, agent R10)
tier: T3
package: X2-2
requirements: SX-04; R-X2-2, R-X2-3
status: complete
---

# Row 213: the terminal secret prompt as a port, with its real implementation

## What was built

| File | Change | Content |
|---|---|---|
| `apps/core-server/cli/secret-prompt.ts` | new | the port `SecretPromptPort.readSecretLine(label)`; the real implementation `createSecretPrompt({ terminal, interruptions })`; the real terminal `standardInputTerminal()`; the real watch `processInterruptions()`; `terminalSecretPrompt()` for a command's entry; the attended check `runAttendedCheck` and its process entry |
| `apps/core-server/test/cli/secret-prompt.test.ts` | new | 27 tests |

No existing file was edited. No script was added to `apps/core-server/package.json` (row 215 holds its scripts block).

## The port (what row 215 imports)

```ts
interface SecretPromptPort { readSecretLine(label: string): Promise<SecretLine> }
type SecretLine =
  | { kind: 'LINE'; secret: Buffer }                       // UTF-8 bytes, no line end; THE CALLER ZEROES IT
  | { kind: 'ENTRY_REFUSED'; code: 'CONTROL_CHARACTER' | 'ESCAPE_SEQUENCE' | 'INVALID_TEXT' | 'TOO_LONG' | 'INPUT_AFTER_LINE_END' }
  | { kind: 'ABORTED'; cause: 'INTERRUPT_BYTE' | 'END_BYTE' | 'INPUT_ENDED' | 'SIGTERM' | 'SIGHUP' | 'UNCAUGHT_ERROR' }
// rejects with SecretPromptError { code: 'NOT_A_TERMINAL' | 'TERMINAL_ERROR' | 'BUSY' } - a code and fixed words
```

A command's entry takes `terminalSecretPrompt()`; a test hands in any object of the port's shape.

## Behaviour, against the cell

| Cell | As built | Where |
|---|---|---|
| refused unless standard input is a terminal; no flag or variable lifts it | the first statement of `readSecretLine`; the file reads no environment variable and no argument (its one use of the argument list is "was this file started") | `secret-prompt.ts` `readSecretLine`, `standardInputTerminal` (`isatty(0)`: the descriptor, not the stream, so a refusal opens nothing) |
| raw mode | `setRawMode(true)` before the label is written; `false` on every way out | `createSecretPrompt` |
| nothing written per key, not even a mask | two writes per read: the label, and one line break after the entry | `finish`, test "a line typed at the terminal" |
| bytes 0x03 and 0x04 abort | checked before anything else for every byte, also inside an already refused entry | `data` |
| any other control character or escape sequence refuses the entry | below 0x20, 0x7F, the second block (0xC2 0x80-0x9F), 0x1B. A refused entry is read to its line end and thrown away | `data`, `endOfLine`, `holdsSecondBlockControl` |
| UTF-8 decoded across reads | bytes are kept as they arrive; the whole line is checked as UTF-8 at its end (`node:buffer` `isUtf8`), so no text object of the secret is made here | `endOfLine` |
| restored on success, error, abort, SIGTERM, SIGHUP, an uncaught error | one way out, `finish`, for all of them; the signals and the uncaught-error monitor through `SecretInterruptions` | `finish`, `processInterruptions` |
| the file states what the terminal test is | header paragraph "WHAT THE TERMINAL TEST IS AND IS NOT": it stops the accident, not a pseudo-terminal; R-X2-9 is the rule for agents | file header; pinned by the test "says what the terminal test is and is not" |

Beyond the cell (each small, each tested): a line above 1,024 bytes is refused (a bound on memory, far above the password bound); input after the line end in the same read is refused (the line end of two bytes is accepted); a second read while one is open is `BUSY`; a line that was typed is NOT handed out when the terminal could not be restored; this file's copy and every chunk it was handed are zeroed.

## Checks

| Check | Command | Result |
|---|---|---|
| The row's tests | `npx vitest run --project unit --maxWorkers=2 test/cli/secret-prompt.test.ts` (in `apps/core-server`) | run 1: `Tests 1 failed \| 26 passed (27)` - the failure was a pattern of the NEW test (it counted the line printer's parameter name); run 2 after the test fix: `Test Files 1 passed (1)`, `Tests 27 passed (27)` |
| Typecheck | `npx tsc --noEmit` (in `apps/core-server`) | exit 2 with 3 errors, NONE in this row's files (see "Reds of other rows") |
| Lint of the two files | `npx oxlint cli/secret-prompt.ts test/cli/secret-prompt.test.ts` | exit 0 |
| Static rules a new `cli/` file could meet | `npx vitest run --project unit --maxWorkers=2 test/static/{scan-coverage,scan-skips,scaffold,imports,logging,network,credentials}.test.ts` | `Tests 1 failed \| 128 passed (129)`; the one red is not this row's (below) |
| The entry by hand, piped and without input | `printf ... \| node --import tsx cli/secret-prompt.ts --allow-pipe`; `... < /dev/null` | both: the fixed refusal line on standard error, `exit=1` |

The verification cell, item by item (all in the test file):

| Cell item | Test | How |
|---|---|---|
| bytes written while typing 0 | "is returned as its bytes; nothing is written while it is typed..." | after every typed piece the double's write list is the label alone; at the end: label, one line break |
| both abort bytes abort | "both abort bytes abort, at the start and in the middle of an entry..." | 4 cases |
| a control character and an escape sequence refuse | two tests | 8 control cases, 3 sequences (arrow key, function key, bracketed paste) |
| a multi-byte character split over two reads is decoded | "a character whose bytes arrive in two reads is joined..." | characters of 2, 3 and 4 bytes, every cut position |
| standard input a pipe: the entry exits 1 having read no byte; a lifting flag and a lifting variable get the same refusal | "the process entry, started for real" (3 tests, 7 started processes) | pipe: exit 1, fixed line, nothing of the piped bytes in either stream. File: the same, and the open file is still at its first byte afterwards (the child shares the position of the parent's descriptor). No input: the same. Each with six flags and with five variables |
| the raw-mode double records a restore on each of the six exit paths | "the terminal is restored on every exit path", tests 1 to 6 | the double's mode list is `[true, false]`, nobody listens, nobody watches |

**Which paths are real and which go through the port:** the REFUSAL paths are tested for real (started processes). The READ path is tested through the terminal double and the interruption double; the real watch of the process is tested by calling its own listeners (no signal is sent). No pseudo-terminal is opened.

**No echo, asserted:** the test file captures `process.stdout.write`, `process.stderr.write` and six console methods for its whole run and fails if any value typed into a double, or its bytes, appears there. The prompt has no log sink: the file imports `node:buffer` and `node:tty` only (pinned by a test), and has no console call.

**Synthetic values:** every typed value is drawn from `node:crypto` in the run. The one file written (64 random bytes as the "file" input) lies in a temporary folder that is removed; after the run `ls $TMPDIR | grep -c dems-secret-prompt` printed `0`.

## Not proven here

The real raw mode of a real terminal with a person at it, on macOS and on Ubuntu 24.04 (design assumption H5). It is the attended check of design 3.11: from `apps/core-server`, `npx tsx cli/secret-prompt.ts`, with a throw-away value - nothing appears while typing, the terminal echoes again afterwards, and again after Ctrl-C at the prompt. It prints the outcome only, never the value or its length. It belongs to the attended test package (U13) and to the installer's note (row 217).

## Reds of other rows seen (not edited)

| Where | What | Likely owner |
|---|---|---|
| `src/capture/__tests__/supervisor.test.ts:1069` | TS2353 `maxRestarts` | R2, row 191 (in flight) |
| `src/capture/adapters/audio/__tests__/alsa-config.test.ts:196`, `card-listing.test.ts:526` | TS2322 / TS2345 `usbSerial` missing | R4, row 199 (in flight) |
| `test/static/imports.test.ts:307` | `test/support/host-command-unit.db.test.ts:51` imports from a `__tests__` folder | R11, row 214 (in flight) |

## DRIVER DECISIONS (to confirm)

1. The result is a tagged value with the buffer inside (`{ kind: 'LINE', secret }`), not a bare buffer: an abort and a refused entry are ordinary outcomes the command must tell apart, and an error stays "no line can be asked for at all".
2. Backspace refuses the entry (the cell: "any other control character"). A person who mistypes presses Enter and types again; the command's second prompt ("Again:") catches the rest.
3. A refused entry is read to its line end before the answer, so that what was typed after the bad key is not taken as the next entry.
4. The label goes to standard error, so that the command's standard output holds its result lines only.
5. After the restore a signal is sent again only when no other listener of it is left; the uncaught error is watched through the monitor event, which does not keep the process alive.
6. The attended check is this file's own process entry (no script in `package.json`).
7. The test lies under `apps/core-server/test/cli/`: the unit project includes `src/**` and `test/**`, not `cli/**`.

## Requests

None.
