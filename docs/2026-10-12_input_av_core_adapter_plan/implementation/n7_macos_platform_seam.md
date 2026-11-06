---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: N7 (wave 12, track D; work package N7 of masterplan/06_design_macos_microphone.md revision 3, section 10.1)
date: 2026-10-14
agent: coder-execution (agent N7)
source_plan: masterplan/06_design_macos_microphone.md (revision 3) sections 2.2, 2.3, 3.3, 8.1, 10.1
head: 1fbeada7 plus the uncommitted work of wave 12 (nothing committed by this row)
status: complete
tier: 1
---

# Row N7 - the platform seam of the card listing: the runner of the three macOS rows

## 0. Frame (5W1H)

| | |
|---|---|
| What | The platform seam of the card listing in the fence (`production-parts.ts`): `linux` the existing ALSA reader (unchanged), `darwin` the macOS listing of row N6 fed by a runner of the three fixed rows of row N4's table through the production door, any other platform the named "not available" answer. The composition hands the seam's enumerator to the audio-cards module through its existing `provideEnumerator` |
| Why | Decision U22 (production microphones on macOS under `USB_AUDIO`); design 2.2 (alternative D), 2.3, 3.3; review SM-10 (bounds, exits, descendants, load), SM-21 (the platform alone chooses), SM-08 (pins at the caller); decision C118 (the real lists: 42 KiB tree, index valid for one start); decision C123 (the two files are N7's in this wave) |
| Who | Agent N7. Consumers: row N9 (the adapter, reads `listTied`), the audio-cards module (operations 98 / 99), the microphone watch (row N10's wiring). Not touched: the adapter, the registry, `packages/shared`, the door, the table, the readers, the camera parts |
| When | 2026-10-14 |
| Where | `apps/core-server/src/capture/fence/production-parts.ts:324-579`, `apps/core-server/src/capture-composition.ts:469` (and the header, member 6), tests in `src/__tests__/capture-composition.test.ts:706-1018` and `.db.test.ts:117-118, 146-147`, the static list `src/capture/__tests__/static.test.ts` |
| How | Measured the three rows on this Mac first (section 3), built the runner against the measured facts, tested every exit rule on door doubles and on the REAL door with stand-in programs, ran the whole listing on this Mac's real texts through the seam AND through operation 98's own service function (section 5), mutation runs (section 7) |

## 1. Files

| File | Change |
|---|---|
| `src/capture/fence/production-parts.ts` | edit (Edit tool): header; imports; `MacosListingRow` and the new member `row` of `CardListingProgramError` (`:324-345`); `hostCardEnumeratorOf` takes `helperProgram` and has the `darwin` branch (`:406-416`); NEW section `:418-579`: `MACOS_CARD_LISTING_PLATFORM`, `MACOS_LISTING_ROW_LIMITS`, `MacosListingRunnerParts`, `macosListingRowText` (one run of one row), `macosListingSourceOf` (the runner), `macosCardEnumeratorOf` (single-flight enumerator) |
| `src/capture-composition.ts` | edit: `:469` the hand-over passes `helperProgram: ports.audioHelperProgram`; header member 6 |
| `src/__tests__/capture-composition.test.ts` | edit: new `describe` "row N7" (8 cases + the real-text case, skipped unless asked); the two existing cases that named macOS "not available" (`:345`, `:673-685`) now state `LISTING_PROGRAM_NOT_HANDED_IN` for a darwin Core without a helper, and the title of the second says "another platform" |
| `src/__tests__/capture-composition.db.test.ts` | edit: `:117`, `:146-147` only - the darwin word of a Core whose configuration names no helper (HA's line 715 not touched) |
| `src/capture/__tests__/static.test.ts` | edit: ONE named case "row N7" (SR-15 block, `:1853-1888`) and three existing pins my change moved, each commented (section 6) |

`src/capture/fence/index.ts` is NOT edited: it re-exports the whole file (`export * from './production-parts'`).

## 2. The seam

```
hostCardEnumeratorOf({ platform, door, timers, helperProgram })
  'darwin'  helperProgram a string -> macosCardEnumeratorOf({ door, timers, helperProgram })   unavailable: null
            otherwise              -> named answer LISTING_PROGRAM_NOT_HANDED_IN; nothing started
  'linux'   -> cardEnumeratorOf('linux', cardListingProgramsOf(host))   (unchanged; helperProgram never read)
  other     -> named answer NOT_AVAILABLE_ON_THIS_PLATFORM; nothing started
```

The platform is what the entry point states (`input.platform`); the fence reads no `process.platform`, no environment and no configuration key (SM-21; pinned). The pinned entry statement of `src/index.ts` is unchanged: the helper comes from `ports.audioHelperProgram`, which the app-bound composition already read from `config.captureAudioHelperPath`. AD-08 / row 157's members are unchanged.

### 2.1 The runner of the three rows (`macosListingSourceOf`, `macosListingRowText`)

Each method of the source is ONE new run of its fixed row; no method takes an argument. Each row: the door with the table's program literal and the table's row function called with nothing, `env: {}`, `message: null`; input ended as soon as the start settled; killed (SIGKILL) at its bound, and the wait ends AT THE BOUND (`Promise.race` with the halt - a descendant that holds a stream open does not hold the caller). The text goes UNCHANGED to row N6's readers.

| Row | Program | Read from | Exit rule (SM-10 (2)) | Bound | Cap, EACH stream (SM-10 (1)) |
|---|---|---|---|---|---|
| USB_TREE (L1) | `MACOS_USB_TREE_PROGRAM` | standard output | ended by itself, exit 0 | 5,000 ms (table) | 65,536 B (the door's) |
| SYSTEM_AUDIO (L2) | `MACOS_SYSTEM_AUDIO_PROGRAM` | standard output | ended by itself, exit 0 | 10,000 ms (table) | 32,768 B |
| CAPTURE_DEVICES (L3) | the configured helper, VOUCHED FOR by the path rule (`helperProgramRefusal(inspectProgram(path))`) before EVERY start (SM-10 (6)) | diagnostics | ended by itself with an exit code (any; 251 by design), not by a signal; "audio section line once" is the reader's (`NO_AUDIO_SECTION`, `SECTION_REPEATED`) | 5,000 ms (table) | 32,768 B |

Refusals (closed words, the row named, no path, no text): `NOT_STARTED` (the door refused, the program missing, the path rule refused the helper, the inspector threw), `TIMED_OUT`, `ENDED_NONZERO` (a signal, or an exit code the row does not take), `OUTPUT_TOO_LONG` (EITHER stream at its cap). A list its reader refuses raises row N6's `MacosCardListingError`. Never an empty text, never a guess.

### 2.2 The enumerator (`macosCardEnumeratorOf`)

Row N6's `createMacosCardEnumerator` over the runner, SINGLE-FLIGHT (SM-10 (4)): calls that fall together share the listing in flight; none queues a second; NOTHING is kept after it settles (a failure neither). So an index of the capture list is never answered from an earlier listing (C118: it was 0, then 1, then 2). Residual for N9 (request line): a caller that joins gets texts read from when that listing began (about 0.3 s at most measured). ONE object per Core: the composition gives the same enumerator to `provideEnumerator` (operations 98 / 99), the audio bundle and the microphone watch bundle (tested).

## 3. The caps: measured on this Mac (U23 (3); counts and sizes only, nothing of a device written)

One run of each row outside the command sandbox (inside it L1 fails and L2 is empty - SM-13), script in the session scratchpad, empty environment as the door gives:

| Row | Exit | Time | Read stream | Other stream | Shape |
|---|---|---|---|---|---|
| L1 | 0 | 20 ms | 45,342 B, 1,579 lines | 0 B | 5 devices: 6,722 / 6,768 / 8,916 / 10,329 / 12,435 B; 11 interface-class keys; 2 audio-streaming children |
| L2 | 0 | 269 ms | 1,471 B, no final line end | 0 B | 3 items (321 / 330 / 445 B), 2 inputs, 1 USB input |
| L3 | 251 | 266 ms | 613 B (diagnostics), 12 lines | 0 B | video section first (4 entries), audio section once (2 entries), longest line 68 characters |

| Row | Cap chosen | Margin, stated |
|---|---|---|
| L1 | 65,536 B = the door's `PRODUCTION_OUTPUT_CAP_BYTES` (the door keeps no more) and the reader's own bound (65,536 characters, row N6) | 20,194 B (31% of the cap) = about two more devices of the measured median size. NOT NARROWED: `-p IOUSB` gave 14,791 B and `-d 1` 14,051 B, both with 0 of 11 interface-class keys - the audio rule (class 1 / sub-class 2, SM-02) would be lost; and the row's words are pinned by SR-15 (6) (a word change is a STOP of the design, not a row's choice). The cap cannot be RAISED by this row: the door (N5) and the reader (N6) move together - request line to the controller |
| L2 | 32,768 B | 32 items (the reader's maximum) of 1 KiB each, more than twice the largest measured item; 22 times the measured text |
| L3 | 32,768 B | 64 lines of the reader's 512-character maximum (32 video + 32 audio entries at the longest); 53 times the measured text |

DRIVER DECISION 1: the two caps below the door's (L2, L3) are stricter than the door, so a flood of either is refused earlier; they are the seam's, not the table's (the table holds program, literals and bound - N4's file).

## 4. SM-10 (3): what a killed row leaves behind - measured

`system_profiler` forks ONE child in every run (seen as `(system_profiler)` under the parent). Killed with SIGKILL at 20, 40, 80, 120, 160, 200 and 230 ms after its start: 0 of its descendants alive when the parent's streams closed, 0 after 1.5 s (7 of 7). `ioreg` and the helper's list forked none. So the door's kill of the program alone (the door signals its own child, `detached: false`) leaves nothing on this Mac for the real rows.

The STAND-IN of the review (a program that forks a hanging child holding standard output): the runner answers `TIMED_OUT` at the bound (400 ms bound, answered in well under 5 s) - before row N7 the Linux-style wait on `ended` would have waited the full 30 s of the child; BUT the forked child SURVIVES the kill (the test states it). That is the door's limit, not the runner's: request line to N5 (an optional process-group kill). Not blocking: the real rows leave none.

The guard was NOT used for L2: it reaps its own child only ("its own children are not the guard's", `apps/capture-worker/src/guard/guard.c` header), so it would not cover a grandchild either, and SR-15 (6) hands each row to the door unchanged.

## 5. THE FIRST RUN OF THE WHOLE LISTING ON THIS MAC'S REAL TEXTS, THROUGH THE PRODUCT

Command (from `apps/core-server`, outside the command sandbox; read-only; no device opened):
`DEMS_N7_REAL_LISTING=1 DEMS_N7_HELPER=<repository>/.data/helpers/ffmpeg npx vitest run --project unit --maxWorkers=2 --silent=false src/__tests__/capture-composition.test.ts -t "REAL TEXTS"`

It calls `hostCardEnumeratorOf({ platform: process.platform, door: <the real production door>, timers, helperProgram })` - the seam with the real runner, the real door and the real path rule - twice, then operation 98's own service function (`searchAudioCards` of the audio-cards module) on the same enumerator with a store that holds no registered input, and holds the answer to the contract's schema (`CaptureAudioCardSearchSchema`). Output (counts and closed words only):

| | Listing 1 | Listing 2 |
|---|---|---|
| ok | true | true |
| time | 384 ms | 292 ms |
| cards | 1: `cardIndex` 1, `deviceIndex` 0, `channelCount` 6, `ratesHz` [96000], `factsSource` SYSTEM_PROFILE, `usb` true, serial stated: NO, port: eight hex digits, card id: `usb_` + eight hex digits | the same |
| undecided | 0 | 0 |
| refused devices of the tree | 0 | 0 |
| passed over (not USB: the built-in input) | 1 | 1 |
| capture-list audio entries | 2 | 2 |
| `skipped` | 0 | 0 |

Operation 98 (the module's own function): schema VALID; 1 card, 6 channels, serial answered: no, port answered: yes, registered inputs 0; truncated false; one audit entry written in the double's unit (`CAPTURE_DISCOVERY_SEARCHED`).

So on this Mac operations 98 / 99 now list the USB interface: one card of six inputs, identified by its port (no serial). On Linux nothing changed (the Linux runner's tests pass unedited; the seam asks `/usr/bin/arecord -l` exactly as before - tested).

Worth a line: the interface states 96,000 Hz (as after the restart, C118 "put to the user"); the listing STATES it, it does not refuse it - the 48,000 Hz rule is the adapter's (N9, SM-16). Operation 99 was not run against the database here (it writes rows): its listing is the same enumerator with the purpose `REGISTRATION`, and a card with a port is identifiable by the module's rule.

## 6. The static list (C123: the ONE named entry, and the pins it moved)

- NEW case "row N7" in the SR-15 block (`static.test.ts:1853-1888`): each listing-row function named ONCE in the fence and called with nothing; the runner's ONE door call `door({ command: program, args, env: {}, message: null, timers })` beside the two commissioning calls; the three lines that hand a row to the runner, verbatim; the program defaults; the path rule before the helper's row; `MACOS_CARD_LISTING_PLATFORM = 'darwin'` and the one branch; no `process.platform`, `process.env` or `DEMS_CAPTURE_AUDIO_HELPER` in the fence file; only the fence names the runner; the program overrides and limits are declared in the fence alone (a test's). Controls: an argument from data, a program from the configuration, a door call with an environment key - each seen by the same pattern.
- MOVED, each with its comment: SR-15 (1)'s caller pin (`:1772-1777`) split - the listing names now in `[table, production-parts.ts]`, the push / pre-check / device-word names still the table's alone (N4's request line foresaw it); row 85c (d)'s composition literal (`:1316-1317`, `helperProgram: ports.audioHelperProgram` added); row 111b (c)'s door-call list (`:1375-1379`, +1 line: the runner's call). A request line asks the static writer / controller to confirm.
- No new import of the fence trips a rule: `local/helper-program`, `local/process-door` (`inspectProgram`, already imported by the Linux production adapter), `audio/macos-card-listing`; the fence file still starts nothing and imports no process module (row 85c's two pins green).

## 7. Mutation honesty (wave 12 rule 6) - planted in `production-parts.ts`, one run per round, reverted; the file's SHA-256 before and after: `7b0ad150...6fa6929`, identical (`cmp`)

| Mutation | Seen RED |
|---|---|
| the capture-list row accepts an end by a signal | "THE EXIT RULES PER ROW" (alone, round 1b) |
| the other stream is not held to the cap (x1000) | "THE EXIT RULES PER ROW" (round 1) |
| single-flight off (every call reads anew) | "SINGLE-FLIGHT" (9 runs instead of 3) |
| the path rule's refusal ignored | "THE PATH RULE before EVERY start"; static "row N7" (b) |
| the wait waits for the door's end after the kill | the stand-in case "A ROW THAT DOES NOT END" (timed out at 5,000 ms) |
| the `darwin` branch removed | "THE SEAM", "THE COMPOSITION on darwin", "platform darwin: ... NAMED reason", row 85c's composition case, static "row N7" (c) |
| a settled listing kept (never cleared) | "AN INDEX IS NEVER KEPT" (index 1 kept where the list said 0), "SINGLE-FLIGHT" (3 runs instead of 6), "THE PATH RULE" (inspected once instead of twice) |

## 8. Checks (after the last edit; the reverts restored the identical bytes)

| Check | Command (from `apps/core-server`) | Result line |
|---|---|---|
| composition unit tests (with the seam's cases) | `npx vitest run --project unit --maxWorkers=2 src/__tests__/capture-composition.test.ts` | first run: `Tests 76 passed \| 1 skipped (77)` (the skipped one is the real-text case) |
| real-text run | section 5 command, sandbox off | `Tests 1 passed \| 76 skipped (77)` |
| composition database test | `lockf .locks/db-migrate.lock` + `npx vitest run --project db --maxWorkers=2 src/__tests__/capture-composition.db.test.ts`, sandbox off | `Tests 15 passed (15)` |
| audio-cards module, database | same lock, `src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` | `Tests 22 passed (22)` |
| static sets + audio-cards service + audio adapters + composition | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static src/modules/capture-inputs/audio-cards/__tests__/service.test.ts src/capture/adapters/audio src/__tests__/capture-composition.test.ts` | `Test Files 4 failed \| 26 passed (30)`, `Tests 5 failed \| 717 passed \| 1 skipped (723)` - ALL FIVE REDS NOT N7's (below) |
| typecheck | `npx tsc --noEmit` | 15 errors, NONE in a file of this row: N13's protocol work in flight (`nonZero`, `PCM_FIFO_GAPPED`: 8 test files + `mic-transport.ts`), the network module's `onvifPorts` (`modules/capture-config/network/service.ts`, 3), two capture-config database tests (a stored-address decision type) |

Reds not mine, with their owner:
- `src/capture/__tests__/static.test.ts:1777` (SR-15 (1): push / pre-check names in `src/capture/adapters/audio/usb-audio-macos.ts`), `src/capture/adapters/__tests__/static.test.ts:456` (A-9) and `:717` (A-11), `src/capture/adapters/audio/__tests__/usb-audio-production.test.ts:1080` (T-3) - all from N9's in-flight `usb-audio-macos.ts:81, 93`. The listing half of the moved SR-15 (1) pin runs FIRST and is green.
- `test/static/guard-family.test.ts:66` - the worker guard's rule tags 25 against 24 (N13's `apps/capture-worker`).

## 9. Requirement identifiers

| Id | State |
|---|---|
| SM-10 (1) both streams held to the cap, the read one tested | CLOSED (tests; mutation) |
| SM-10 (2) exit rules per row | CLOSED (tests; mutation) |
| SM-10 (3) no descendant after the bound | MEASURED for the real rows (0 of 7); the stand-in's forked child survives - the door's limit, request line to N5 |
| SM-10 (4) single-flight | CLOSED at the seam; the program-starts-per-minute figure with two microphones and the watch is the watch's (N10 / N14 / N15) |
| SM-10 (5) a hung row in a search answers within its bound | CLOSED (bound + kill; the wait ends at the bound); the boot does not list (the composition starts nothing - tested) |
| SM-10 (6) path rule before every start of L3 | CLOSED (tests; mutation; static) |
| SM-21 the platform alone chooses | CLOSED at the seam (static (c); tests); the registry half is N10's |
| SM-08 (pins) | the listing caller pinned (static "row N7"); the push / pre-check caller pin is N9's |

## 10. Driver decisions (for the controller to confirm)

1. Caps L2 and L3 at 32 KiB each, stricter than the door (section 3).
2. A darwin Core whose configuration names no audio helper answers the EXISTING word `LISTING_PROGRAM_NOT_HANDED_IN` (the helper IS the program of row L3), not a new word.
3. The capture-list row takes ANY exit code (0 included) that is not a signal: the design says "only the text counts" and the reader requires the audio section line once.
4. `CardListingProgramError` gains an optional member `row` (null on Linux): the Linux error is unchanged in code, reason and text.
5. Single-flight shares a failure too, and keeps nothing after it.
6. Tests extend the subject's existing test file (driver rule 7) instead of the new file first claimed; the claim line was corrected.
7. Three existing static pins moved (section 6) besides the one named case.
8. The guard is not used for L2 (section 4).

## 11. Unproven here (hardware list)

- A host with more USB devices than the 64 KiB tree holds (about 7 of this Mac's size).
- `system_profiler` under load or hung for real (its bound was exercised with stand-ins only).
- The listing inside a per-user launcher (SM-15): measured from a terminal-started process only.
- Operation 99 against the database on this Mac's real card.

## 12. Edit-only statement

Existing files were changed with the Edit tool only (`production-parts.ts`, `capture-composition.ts`, the two composition test files, `static.test.ts`, `file_claims.md`, `file_requests.md`); the mutations were planted and reverted with the Edit tool, and the file's bytes were compared with a copy kept in the session scratchpad (identical). New files with Write: this record, `delegation_progress/row_n7.md`, and two measuring scripts in the session scratchpad (outside the repository). Nothing committed, staged or stashed; no device opened; nothing written under `.data/`.

---
*Generated: 2026-10-14*
