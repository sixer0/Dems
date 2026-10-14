---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N5
date: 2026-10-14
agent: coder-execution
tier: T3
work_package: N5 of masterplan/06_design_macos_microphone.md revision 3 (sections 4.6, 7.1, 10.1)
requirement: SM-12 (3) as widened, SM-35 (7) (verification/08b); S13-02 (b) and AD-06 kept on the new channel
status: complete
---

# Row N5: the production door hands on standard error line by line

## Why

The macOS audio helper says `FIFO queue full` / `FIFO queue flushed`, its stream line and its refusal line on
STANDARD ERROR while it runs (test/mm2, test/mm3; design 4.6). The door as built by row 21 kept standard error
only as a bounded head for the end. The reader of those lines (row N8) and the adapter (row N9) need them as
they arrive.

## What was built

| File | Change | Description |
|---|---|---|
| `apps/core-server/src/capture/adapters/production-door.ts` | modify (+235 / -1, Edit tool) | one optional member of the options, `onDiagnostics`; its event type; four exported constants; one internal function `diagnosticsObserver`; two call places (the `data` listener of standard error, the end of the child) |
| `apps/core-server/src/capture/adapters/__tests__/production-door.test.ts` | modify (+363 / -0, Edit tool) | one import statement added and four blocks APPENDED (8 cases). No existing case, helper or import was edited |
| `apps/core-server/test/support/production-door-stderr-double.mjs` | new | the double: a node script that writes to standard error (modes `bursts`, `no-line-end`, `flood`, `forever`, `shapes`). The existing double is not edited |

Not edited: both `static.test.ts` files, `test/static/credentials.test.ts`, `credential.ts`, `adapters/index.ts`,
`adapters/local/*`, the existing double.

## The observer

```ts
readonly onDiagnostics?: (event: ProductionDiagnosticsEvent) => void;

export type ProductionDiagnosticsEvent =
  | { readonly kind: 'line'; readonly text: string; readonly cut: boolean }
  | { readonly kind: 'dropped'; readonly lines: number }
  | { readonly kind: 'quiet' };
```

| Bound | Constant | Value | What happens at it |
|---|---|---|---|
| per line | `PRODUCTION_DIAGNOSTICS_LINE_CHARS` | 512 characters (= bytes, see "text") | a line of 512 is whole; a longer one is told ONCE with its first 512 characters and `cut: true`; the rest is searched for its line end and never made into text |
| per second | `PRODUCTION_DIAGNOSTICS_LINES_PER_SECOND` | 200 lines | the second starts with its first line (`PRODUCTION_DIAGNOSTICS_SECOND_MS` = 1,000 on the door's `timers`); lines over 200 are not made into text, only counted; `{ kind: 'dropped', lines }` is told when the second ends, or at the child's end |
| per life | `PRODUCTION_DIAGNOSTICS_LIFE_LINES` | 20,000 lines | `{ kind: 'quiet' }` once; after it no byte of this child is read for the observer. At most 20,000 x 512 characters are ever handed on |
| waiting (internal) | `DIAGNOSTICS_WAITING_LINES` | 200 lines | a line that would be the 201st waiting for the observer is dropped and counted like a line over the rate |
| per turn (internal) | `DIAGNOSTICS_EVENTS_PER_TURN` | 8 events | see "no back-pressure" |

The three exported bounds are fixed in the file: a caller cannot raise them.

**Text.** Bytes become text through a table of 256 one-character strings: printable ASCII (0x20 to 0x7E) as it
is, a tab as a space, EVERY other byte as `?` (control characters, the escape byte, zero, and each byte of a
multi-byte character, so also direction overrides). A line ends at a line feed or a carriage return; an empty
line is not a line; a last line without a line end is told at the child's end. Every told line passes
`blankCredentialLocators` (S13-02 (b), as the bounded head does); a CUT line first loses a locator the cut went
through (scheme, no `@` and no slash yet), because the blanking pattern needs the `@` to see a user part.

**The door keeps and logs nothing of a line** (AD-06, SM-35 (7)): a line lives in the waiting list until it is
told, at most 200 of them. Rule A-8's "no log sink in the door" passes unedited.

## No back-pressure: how

1. The `data` listener of standard error stays as it was: the stream is never paused, the bounded head is fed
   first, and the observer's side (`push`) only does bounded work on the chunk. `push` NEVER calls the observer.
2. The observer is told in a LATER turn (`timers.after(0, ...)`), at most 8 events per turn; the event loop
   reads the streams between two turns.
3. What the observer returns is not waited for. A returned promise is not awaited; its rejection is answered.
4. When the observer does not keep up, the waiting list (200 lines) fills and further lines are dropped and
   counted. Memory is bounded whatever the observer does.
5. At the child's end (`close`) what still waits is told in that turn, then `ended` settles: the caller has
   every line (the refusal line of a helper that ends at once) before `ended`, and nothing after it.

Stated honestly: in a one-thread runtime an observer that computes for a long time inside its call holds the
whole Core for that time, every pipe included. The door bounds it to 8 calls per turn and 200 lines a second;
it cannot interrupt a call. Point 5 means such an observer also delays `ended` by at most the waiting events.

## The proof that the door without the observer is unchanged

- `git diff --numstat`: the door `235 1` - the one removed line is the `data` listener of standard error, now
  the same call followed by `lines?.push(chunk)`, where `lines` is `null` without an observer. The other place
  is `lines?.end()` before `resolve`. The test file `363 0`.
- The 10 cases of row 21 run unedited and pass (the kill guard, the zero-filled bytes, the seven refusals).
- New case: the same child ends with an EQUAL `ProductionExit` with and without the observer, and without it
  the door asks its timers for nothing (0 calls); with it, more than 0 (control).
- Both static files and `test/static/credentials.test.ts` pass unedited: one process start, one `env:`, two
  text makers by A-8's pattern, no log sink, no global timer, no system time.

## Checks (this Mac; no device, no network, no port; sandbox on)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Door tests | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/__tests__/production-door.test.ts` | run 1 (7 new cases): `Tests 17 passed (17)`; after the case of the waiting bound was added and the double's `bursts` changed: `Test Files 1 passed (1)`, `Tests 18 passed (18)`, 11.3 s |
| Static rules (not edited) | same runner: `src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static/credentials.test.ts` | `Test Files 3 passed (3)`, `Tests 123 passed (123)` |
| Typecheck, once | `npm run typecheck` | exit 2, ONE error, not this row's: `src/capture/adapters/audio/__tests__/macos-card-listing.test.ts(308,24)` TS2345 (row N6's new file, in flight). 0 in this row's files |
| Lint | `npx oxlint` on the three files | exit 0 |
| Secret scan | `node scripts/secret-scan/count-only.mjs` on the three files | `TOTAL: 0` |

### Mutations (rule 6 of the wave brief)

Made on a COPY of the door in the session scratch folder, put in the door's place for the test run by a
resolver of a scratch runner configuration; the repository's door was never written for a mutation. Control:
the unmutated copy through the same runner, 18 of 18 (17 of 17 at the first round).

| Mutation | Case that went red |
|---|---|
| the cut taken out of the reader | "a line of the bound is whole ..." and "a child that never ends a line ..." |
| the table of harmless characters made the identity | "a line of the bound is whole ..." |
| the take-off of an open locator at the cut removed | "a line of the bound is whole ..." |
| the rate taken out of `full` | "the first 200 lines of a second ..." (and the count of the three-observer case) |
| the bound of the waiting lines taken out of `full` | "an observer that is not reached at all ..." |
| the life bound taken out of `admit` | "after 20,000 lines ..." (no `quiet`) |
| the events told in the turn that read the bytes | "a slow observer ..." (200 in one turn) |
| events per turn 8 -> 200 | "a slow observer ..." |
| the guard taken out of `say` | "an observer that never answers, one that throws ..." (uncaught error) |
| the answer to a rejecting promise removed | same case (unhandled rejections counted) |

FOUND BY THE FIRST ROUND: the rate case did not go red on the rate mutation - 5,000 lines in one chunk are
held to 200 by the waiting bound alone. The double's `bursts` now writes 100 lines at a time with a pause, so
the rate is what holds, and a case of its own was added for the waiting bound. One slow run was seen under
host load (the 8 MiB case at 5.2 s against the default 5 s): the new cases carry a 60 s bound (120 s for the
life case).

## The double, and what stays unproven

The double is a node script started with `process.execPath`. It is not FFmpeg.

| Unproven here | Check |
|---|---|
| The real helper's lines arrive whole and in time through this observer (the stream line within 3,000 ms, the queue lines, the refusal line before the exit) | rows N9 and N15; the user's own session (design 9.3) |
| The volume a real helper writes at start (the banner) stays under 200 lines in its first second | row N9 on the pinned helper with a generated source; if not, the reader sees `dropped` and the number is a decision |
| Anything on Linux (pipe size, a write that blocks) | the hardware package |

## DRIVER DECISIONS (for the controller to confirm)

1. **Bounds in LINES, not bytes.** SM-35 (7) words a byte budget per second and per life; the brief words lines
   dropped and counted. Chosen: lines, each of at most 512 characters, so the byte budgets follow (102,400
   characters a second, 10,240,000 a life). Bytes that are read past are not counted against anything.
2. **The numbers 200 and 20,000.** No document gives them. 200 a second leaves room for a start banner; 20,000
   is 100 seconds of a flood at the rate, and hours of a helper that writes a few lines a minute. A helper run
   with a progress line every half second would spend its life in under three hours: the macOS row has none
   (design 7.1); a row that turns one on must know this bound.
3. **ASCII only.** A device name with other characters arrives with `?` in their place. The four forms the
   reader matches are ASCII. Stricter than "control characters made harmless", and it also removes direction
   overrides.
4. **A cut line carries its first 512 characters** (the design's reader drops it unread; the brief asks for
   "cut and marked").
5. **Told in a later turn, on the door's `timers`.** Consequence for a test of another row that gives the REAL
   door manual timers: no line is told and no second ends until it fires them (said in the member's comment).
   A fake door calls the observer directly and is not concerned.
6. **One event type with three kinds** rather than three callbacks: one new member of the options.
7. **No pin was moved and none must move.** The table of harmless characters is a third maker of text from an
   output stream that A-8's pattern does not see; it was written so that A-8 passes unedited, and this is told
   to the rule's writer in the request line rather than left silent.
8. **A new double file** instead of new modes in the existing one, so that "every existing door test passes
   unedited" covers its support file too.

Observation, not this row's: the bounded HEAD can end inside a locator at its 64 KiB cap in the same way a cut
line can; it is unchanged here.

## Request left in `file_requests.md`

One line (to N4, then the writer of the adapters static file and of the barrel), not blocking: no pin must
move; three additive offers (a "never pauses" and a timer-count pin in G-R8's door case; a named pin of the
new text maker in A-8; the barrel export of the four constants and the event type). State at 08:58: the first
offer is SERVED by N4 (`capture/__tests__/static.test.ts:287-295`; that file re-run with the door as built:
`Tests 79 passed (79)`); the A-8 pin and the barrel export stay OPEN.
