# Row N4 (wave 12, agent N4) - the macOS microphone table and static rule SR-15

Status: built and checked as briefed. NOT CLOSED in the design's sense: the one run of design 4.3.3 (four helper forms on a generated source) was outside this agent's brief; two sentences of SR-15 stay provisional. Record: `implementation/n4_mic_table_and_rule.md`.

## Files
- `apps/core-server/src/capture/adapters/local/mic-helper-args.ts` - appended `:438-673`: the two templates, `macMicDeviceWord`, `macMicPushArguments`, `macMicPrecheckArguments`, the three listing rows, two table objects. One import line gained one name. Linux and development rows untouched.
- `apps/core-server/src/capture/__tests__/static.test.ts` - a new `describe` for SR-15 (`:1436-1848`, seven cases) and two pins for N5 in the G-R8 door case (`:287-296`). One import line added.
- `apps/core-server/src/capture/adapters/local/__tests__/mic-helper-args.test.ts` - one appended block (`:566-716`, ten cases) and import names.
- docs: `implementation/n4_mic_table_and_rule.md`, this file; lines in `file_claims.md` (one) and `file_requests.md` (three).
- git-ignored, in no commit: `.cache/task4-n4/` (mutation harness, lists, result logs).

## Result lines
- capture static file: `Test Files 1 passed (1)`, `Tests 79 passed (79)`.
- whole static set (46 files): `Tests 794 passed (794)`. Reds not mine: none.
- table unit tests + Linux adapter + development helper: `Test Files 3 passed (3)`, `Tests 157 passed (157)`.
- `npx tsc --noEmit` in `apps/core-server`: exit 0.
- mutations: 130, each red where stated (88 on the 44 forbidden lines, 17 on the template / listing / start-vector lines, 23 on the table, 2 on N5's pins); baselines green before and after.

## The `fifo` check
`.data/helpers/ffmpeg` (9.0.2, SHA-256 `c8173e97...f4e4e1a8`), `-h muxer=fifo`: eleven options; the four of the row exist by these names; `-drop_pkts_on_overflow` defaults to false and `-queue_size` to 60. Names only - behaviour is not settled by a help text.

## Requests
- Served: N5 (two pins of the production door).
- Written: to N7 / N9 (the "no caller yet" pin moves with their caller pins); to the controller (the run of 4.3.3).

## Driver decisions
DD-1 the run of 4.3.3 not made (brief); DD-2 the builder orders the sections ascending; DD-3 forbidden list of 44 ids, `aresample` in any form; DD-4 listing bounds in the table; DD-5 the "no caller yet" pin; DD-6 SR-15 (7) as a rule over a vector, pinned at no caller; DD-7 unit tests in the existing table test file; DD-8 `SPAudioDataType` pinned as an argument only.

## Edit-only
Kept: existing files by the Edit tool only; new files by Write; the harness wrote only under `.cache/task4-n4/`. Nothing committed.
