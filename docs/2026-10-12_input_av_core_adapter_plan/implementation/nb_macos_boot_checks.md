---
row: NB (= design 06 revision 3, section 10.1, row N13 "THE BOOT"; the wave-12 agent label "N13" is the design's N1 + N3 - decision C135 (1))
date: 2026-10-14
agent: coder-execution (agent NB, wave 12, track D)
status: complete (three request lines open; one is a static pin of N5b's file)
size: S
---

# Row NB - the boot on macOS: the path rule of the two system listing programs, and `microphonePermission`

Sources read: `delegation_progress/driver_rules.md`, `batch_9_brief.md`, `wave_12_brief.md`; design `masterplan/06_design_macos_microphone.md`
(section 5 :551-560, section 8 table :744, section 10.1 rows N13 :1138 and :1187, section 10.2 :1224); review
`verification/08_security_macos_microphone.md` SM-13 (:175-176), SM-15 (:191-196); addendum `08b` (:305, :318 - both unchanged);
`implementation/n4_mic_table_and_rule.md` (rows L1, L2), `n2_mic_contract.md` section 5 (:161 - the boot member left to this row);
`decisions/decisions.md` C97 (:135), C102 (:140), C135 (:179).

## 1. Baselines BEFORE the first edit (decision C97)

| File | git blob (the form decisions.md records) | SHA-256 | Recorded baseline | Changed since? |
|---|---|---|---|---|
| `apps/core-server/src/capture/boot/checks.ts` | `90b3a1e6` | `16a68ef07152c3f389d7448209511f925cedf0b9db80d9a9cfff47ad64307471` | C102 (decisions.md:140): `90b3a1e6`; wave_12_brief.md:3 | no - `git diff 1fbeada7 -- capture/boot/` empty; HEAD blob = working blob |
| `apps/core-server/src/capture/boot/index.ts` | `63fe763e` | `8e4d66b2e35082ecf5037fe47f2776df4d4f636155d2e768639ec261a1c38b5e` | C102: `63fe763e`; wave_12_brief.md:3 | no - same |

Note: the design's row N13 cell (:1187) still names row P1's baseline (`dfb1a117` / `5a264525`, C97). Row HC (C102) moved it since;
the current values match C102 exactly, so no other row touched either file after HC. No row to list.

AFTER this row: `checks.ts` UNCHANGED (blob `90b3a1e6`, SHA-256 `16a68ef0...7471`). `boot/index.ts` blob `8207475a`, SHA-256
`8eb68ef7e31e2c14f8b81c90a7a58cfd9c5d0ba92cb4af07704cbbbfd6fcdb01`: +10 lines, 0 replaced (one import with its comment, one
exported constant with its doc, one member with its comment). The registry builder call and the opener list are NOT touched.

## 2. What the boot states on `darwin`

### 2.1 The path rule of the two system listing programs (step 4e, "check 5" of `program-checks.ts`)

- WHICH: `MACOS_USB_TREE_PROGRAM` and `MACOS_SYSTEM_AUDIO_PROGRAM` of row N4's table (`capture/adapters/local/mic-helper-args.ts:646`,
  `:649`), in its order (L1, L2). The mount holds them once: `export const SYSTEM_LISTING_PROGRAMS` (`capture/boot/index.ts`), handed
  to step 4e as the new optional member `DeliveredProgramDeps.systemListingPrograms`. No key of the configuration names them.
- THE RULE, THE SAME FORM AS 4e: `checks.ts:673` already hands 4e the worker's rule
  `(candidate) => workerProgramProblemOf(candidate, deps.inspect)` - the ONE rule of the worker, the relay and the guard (absolute;
  exists; regular file; owner root or the server's user; not writable by group or others; no directory on the way writable by them;
  executable). The new lines use exactly that `programProblem`; nothing new in `checks.ts`.
- WHEN: `REAL_PRODUCTION`, only when `deps.programs` is handed in (as 4e), after the four delivered-program checks, before the worker
  (step 5). One result line per program, items `L1` / `L2`. NOTHING IS STARTED for them and no listing is run or waited for
  (design :1187 "the boot never waits for a listing"): the runner is asked the relay alone (test: `mac.host.asked == [RELAY]`).
- REFUSAL: `CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE` (a member of `CaptureProgramRefusal`, spread into `CaptureBootRefusal`), the
  reason is the rule's own word (`NOT_FOUND`, `NOT_A_FILE`, `FILE_OWNER`, `FILE_WRITABLE`, `DIRECTORY_OWNER`, `DIRECTORY_WRITABLE`,
  `NOT_EXECUTABLE`, `NOT_ABSOLUTE`, `NOT_SET`). The text names `DEMS_CAPTURE_MODE` and the remedy, no path and neither program's name
  (the static pins `capture/__tests__/static.test.ts:1834-1835` keep both names in the table file alone - still green).
- PASSED: the existing line `CAPTURE_PROGRAM_CHECKS_PASSED` counts them - on darwin `programChecks: 3, notAsked: 3` (was 1 / 3).
- LINUX AND EVERY OTHER PLATFORM: no line, the rule is never asked of the paths; Linux results are the ones of before, line for line
  (tests compare with and without the member). `REAL_DEVELOPMENT` and `SIMULATED`: not asked.
- ON THIS MAC, REAL FACTS: both programs pass the real rule (`boot.test.ts`, `it.runIf(darwin)`; design M11: `root:wheel`, 755, root's
  directories) and the db suite's darwin production boot with the REAL inspector passes (fence.db 49/49).

### 2.2 `microphonePermission` (the `SYSTEM_BOOT` entry; `capture/fence/boot-key.ts`)

- `REAL_PRODUCTION` on `darwin`: ONE member more, LAST, `microphonePermission: 'NOT_KNOWN'` (`bootMicrophoneStatementOf`,
  `SYSTEM_BOOT_MICROPHONE_MEMBERS`, `BootMicrophonePermission`). A fact, not a pass (SM-15; design :555, :744).
- WHY NOT KNOWN, said in so many words: macOS asks the user at the FIRST OPEN of a microphone and names the launching application
  (design section 5, F12). The permission CANNOT be read without opening a device. The boot opens none, waits for no listing, and
  does not read the system's privacy database (SM-15). Whether recording is allowed shows only at the first open - the pre-check's
  non-zero sample (SM-14).
- Linux, other platform words, `REAL_DEVELOPMENT`, no boot checks mounted: not written (the entry of before). It is written from the
  `hostPlatform` the fence already passes (`fence/index.ts:731`, unchanged), so no fence file other than `boot-key.ts` changed.
- The audit writer's FORM for it is a request line (section 6): `core/audit-details.ts` is not this row's. Until it lands the open
  `SYSTEM_BOOT` rule takes the member under its general rules - written and read back exactly by the db suite (`bootRowOf`).

## 3. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| D1 | The path-rule RESULT is not an entry member. It is stated as the refusal (code + word, error log) or by the passed line's count | The entry is committed BEFORE the step `capture.boot` runs (P1's reasoning, boot-key.ts:254-260): it cannot hold a result. The design table :744 says "one optional member" |
| D2 | SM-13's last clause ("state in the boot's entry whether the first listing answered") is NOT stated by the boot | Design row N13 (:1187): "the boot never waits for a listing". The confined case (`NO_SYSTEM_INPUT`) is the listing's (rows N6 / N7) |
| D3 | The paths reach `program-checks.ts` through an optional deps member that the mount always hands in; absent = not asked | `program-checks.ts` imports types only (pinned, program-checks.test.ts:324). Same pattern as `installationId` / `configuredAliasSocket`. That the mount hands it in is proven (`boot.test.ts`, row NB; mutant M3) |
| D4 | Asked in `REAL_PRODUCTION` only | As 4d and 4e. The design states the members for production; `REAL_DEVELOPMENT` asks no host check by design |
| D5 | `fence/__tests__/fence.db.test.ts`: ONE line (`bootRowOf`'s darwin production row + `microphonePermission`), claimed before writing | The exact-row pins at :860 / :943 move with the member. D4a's schema pin at :165 untouched |

## 4. Mutations (each made in place on this row's own file, run, reverted at once; restoration grep-checked)

| # | Mutant | Seen RED in |
|---|---|---|
| M1 | `program-checks.ts`: the check on `linux` instead of `darwin` | 7 cases: program-checks.test (3 of row NB), checks.test (3 of row NB), boot.test (1) |
| M2 | `program-checks.ts`: the rule's answer dropped (`(programProblem(program), null)`) | 3 cases: checks.test, program-checks.test, boot.test |
| M3 | `boot/index.ts`: the mount hands no `systemListingPrograms` | 1 case: boot.test "the list is the two literals ... refused by its own code" |
| M4 | `boot-key.ts`: the member on every production platform (`platform === undefined` guard) | 3 cases: fence.test P1, HC, NB |
| M5 | `boot-key.ts`: the member's spread removed from the entry | 3 cases: fence.test P1, HC, NB |

## 5. Checks (fresh, after the mutants were reverted)

| Check | Command | Result line |
|---|---|---|
| Boot + fence unit | `npx vitest run --project unit src/capture/boot/__tests__ src/capture/fence/__tests__/fence.test.ts --maxWorkers=2` | `Test Files 11 passed (11)` / `Tests 382 passed (382)` |
| (first run, before mutants) | the four touched unit files | 1 red in my own new case (expectation missed the darwin `CAPTURE_HOST_PROFILE_NOT_ASKED` warn row); fixed; `Tests 285 passed (285)` |
| Fence db (throw-away clones, `.locks/db-migrate.lock`, sandbox off) | `lockf -k -t 1800 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2 src/capture/fence/__tests__/fence.db.test.ts` | `Test Files 1 passed (1)` / `Tests 49 passed (49)` |
| Capture static rules | `npx vitest run --project unit src/capture/__tests__/static.test.ts` | `Tests 1 failed | 79 passed (80)` - the ONE red is the pin this row moves (`:1780`, request line to N5b) |
| Repository static rules | `npx vitest run --project unit test/static` | `Test Files 17 passed (17)` / `Tests 210 passed (210)` |
| Core typecheck | `npx tsc --noEmit` | 15 errors, NONE in a file of this row. Others' (hypothesis on owner): TS2739 level members in `capture/__tests__/fault-lifecycle.test.ts:205`, `forwarder-advisories.test.ts:47`, `forwarder-engine.test.ts:77-78`, `fence/__tests__/development-session.db.test.ts:396-397`, `test/support/capture.ts:262` and TS1360/TS7053 in `capture/adapters/mic-transport.ts:88,91` - the worker protocol's new level members / input kind (agent N13 = N1+N3, in flight); TS2345 x6 in `modules/capture-config/__tests__/capture-config.db.test.ts:872-984` - the selector slice contract (V7b, packages/shared, in flight) |
| Lint | `npx oxlint src/capture/boot src/capture/fence/boot-key.ts src/capture/fence/__tests__/fence.test.ts src/capture/fence/__tests__/fence.db.test.ts` | 0 errors; 1 warning in `boot/__tests__/support.ts:95` (unchanged since 1fbeada7, not this row's) |

Nothing left running; no process started but the suites' own stand-ins; no device opened; no listing program run (only its path
metadata read); no key or credential file read; the db clones are the suite's own (template-clone helper drops each).

## 6. Requests (delegation_progress/file_requests.md, three lines)

1. N5b - `capture/__tests__/static.test.ts:1780`: + `'src/capture/boot/index.ts'` (exact text in the line). Blocking for a green static suite.
2. Controller -> writer of `core/audit-details.ts` + `core/__tests__/writers.test.ts`: `SYSTEM_BOOT_MICROPHONE_DETAIL_RULES` (one word
   `NOT_KNOWN`, never null), the open-rule member, the `:965` key pin, a case; then one equality line in fence.test "row NB". Not blocking.
3. V7b - optional: `packages/shared/src/api/security-audit.ts:145` darwin example gains `microphonePermission: 'NOT_KNOWN'`. Not blocking.

Not taken: request line 558 (V7b, tidy item: the interface-name pattern copy at `program-checks.ts:121` -> the shared constant). It is
addressed to row 88 / N7, and an import of a value would break this file's pinned "types only" import (program-checks.test.ts:324).

## 7. What stays unproven (hardware package)

- The real macOS grant: who is asked and what a denial looks like (design section 5, H-18) - not touched by this row; the boot says NOT_KNOWN.
- A production Mac's real path facts under its launcher (System Integrity Protection, another volume layout): proven on THIS Mac only.
- A LINUX machine running the suites: the test host states `darwin` (`test/support/capture-host.ts:38`) and the mount inspects the two
  programs with the REAL inspector; where they do not exist (Linux) a darwin production boot of a db suite is refused `NOT_FOUND`. The
  suites run on this Mac; a Linux runner of the Core suites would need `mount.inspect` or a test-host seam (not built - a note for row 193 /
  the controller).

## 8. Files

Code: `apps/core-server/src/capture/boot/program-checks.ts` (+26: one code, its text, one optional member, the darwin lines, a header
paragraph), `apps/core-server/src/capture/boot/index.ts` (+10), `apps/core-server/src/capture/fence/boot-key.ts` (+43, 1 replaced:
the `SystemBootDetails` type line). Tests: `boot/__tests__/program-checks.test.ts` (1 pin + 1 block), `boot/__tests__/checks.test.ts`
(1 import + 1 block), `boot/__tests__/boot.test.ts` (imports + 1 block), `fence/__tests__/fence.test.ts` (1 import, 2 pins moved by
delta, 1 case), `fence/__tests__/fence.db.test.ts` (1 line). Docs: this record, `delegation_progress/row_nb.md`, `file_claims.md`
(claim + two widenings before writing), `file_requests.md` (three lines).

EDIT-ONLY: every existing file was changed with the Edit tool after reading it - no scripted replace, no shell append, no generated
rewrite. New files (this record, row_nb.md) with Write. Nothing committed, staged or stashed.
