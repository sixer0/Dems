# Row N5 (wave 12, track D) - the production door's observer of standard error

- Agent: coder-execution (N5). Date: 2026-10-14 08:55 (host `date`).
- Status: **complete**.
- Record: `implementation/n5_door_stderr_observer.md`.

## Files

| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/production-door.ts` | modify, Edit tool, +235 / -1 |
| `apps/core-server/src/capture/adapters/__tests__/production-door.test.ts` | modify, Edit tool, +363 / -0 (appended; no existing case edited) |
| `apps/core-server/test/support/production-door-stderr-double.mjs` | new |
| `delegation_progress/file_claims.md`, `file_requests.md` | one line each, Edit tool |

## For rows N8 and N9

```ts
readonly onDiagnostics?: (event: ProductionDiagnosticsEvent) => void;
type ProductionDiagnosticsEvent =
  | { kind: 'line'; text: string; cut: boolean }   // printable ASCII, at most 512 characters, locators blanked
  | { kind: 'dropped'; lines: number }              // lines not handed on since the last such event
  | { kind: 'quiet' };                              // once: the life bound is spent
```

- Bounds: 512 characters a line, 200 lines a second, 20,000 lines a life of the child.
- Told in a later turn than the read, 8 events per turn, on the door's `timers`; everything that waits is told
  before `ended` settles; nothing after it.
- A REAL door with manual timers tells nothing until the test fires them.
- A line ends at a line feed or a carriage return; empty lines are not told.

## Checks

| Check | Result |
|---|---|
| door tests | `Test Files 1 passed (1)`, `Tests 18 passed (18)` (10 of row 21 unedited + 8 new) |
| capture static, adapters static, credentials static (not edited) | `Test Files 3 passed (3)`, `Tests 123 passed (123)` |
| typecheck | exit 2, one error, not this row's: `src/capture/adapters/audio/__tests__/macos-card-listing.test.ts(308,24)` (row N6, in flight) |
| oxlint on the three files | exit 0 |
| mutations (scratch copy of the door) | 10 mutants, each red on its case; control green |

## Requests

One line in `file_requests.md` to N4 and the writers of the adapters static file and the barrel: no pin must
move; three additive offers. State at 08:58: offer (1) SERVED by N4 (`capture/__tests__/static.test.ts:287-295`,
the "pauses no stream" and three-timer pins with their control; the file re-run green, 79 of 79); offers (2)
adapters static rule A-8 and (3) the barrel stay OPEN, not blocking.

## Driver decisions

Eight, listed in the record: bounds in lines; the numbers 200 and 20,000; ASCII only; a cut line carries its
head; told in a later turn on the door's timers; one event type; no pin moved; a new double file.

## Rules kept

Edit tool only for existing repository files (the mutation copies and their runner were written in the
session scratch folder, outside the repository). Nothing committed, staged or stashed. No full suite. No
device, network or port.
