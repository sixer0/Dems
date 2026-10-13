---
task_id: 2026-10-12_input_av_core_adapter_plan
row: HC3
date: 2026-10-13
agent: coder-execution (agent HC3, track D)
tier: T3
decisions: C103 (reverses C49 (2)); C102 (3)
answers: implementation/hc_host_checks_follow_up.md item 3; test/hc2_nft_listing_unprivileged.md
baseline_in: `boot/checks.ts` 90b3a1e6, `boot/index.ts` 63fe763e, `boot/host-checks.ts` fd7e637d, `boot/program-checks.ts` 15680a74
baseline_out: `boot/checks.ts` 90b3a1e6 (unchanged), `boot/index.ts` 63fe763e (unchanged), `boot/host-checks.ts` 9d5d1341, `boot/program-checks.ts` 15680a74 (unchanged)
status: complete
---

# Row HC3: item 3 of row HC taken out - the Core does not read the rule table

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `BOOT` = `CS/src/capture/boot`. Nothing here has run on a Linux host; the command runner is a double in every test (`BOOT/__tests__/host-support.ts`) and no host command was started.

## 1. Why

Row HC2 measured it (`test/hc2_nft_listing_unprivileged.md`, 3 of 3, container kernel 6.8.0-117): a process with the Core unit's identity and no capability gets `Operation not permitted` from `/usr/sbin/nft list table inet dems_loopback`, exit 1, nothing on standard output - whether the table is there or not. The row HC built turned that into `RULE_TABLE_ABSENT_OR_NOT_READABLE`, so every production start on a correctly prepared Linux host was refused. Decision C103 reverses C49 (2).

## 2. The blobs at the start (hashed before the first edit)

| File | Blob at start | Blob at end | Lines |
|---|---|---|---|
| `BOOT/checks.ts` | `90b3a1e6ee910c5933f0b43f08ce0c239ea4e1ca` | the same | 695 |
| `BOOT/index.ts` | `63fe763e3d43425d49f503b5e40200f42b9d4c57` | the same | 704 |
| `BOOT/host-checks.ts` | `fd7e637d6002ebe6751e3abbcdf1f9ae877dcefc` | `9d5d134177e3113d199e61d055b257a37dae7357` | 479 -> 453 |
| `BOOT/program-checks.ts` | `15680a7441d64c1efaf214a8f6aadfea2c8dc1d3` | the same | 341 |
| `BOOT/__tests__/host-support.ts` | 43ad110a | `8928710a24d974508e04235819d17b87f0fda627` | 246 -> 215 |
| `BOOT/__tests__/host-checks.test.ts` | cea15de6 | `7dd09599e7c9343cf2fe74ce47d2537dd64010db` | |
| `BOOT/__tests__/checks.test.ts` | 5c4b315f | `56bf3f9d63bd01f0b6e5649a070ebc9313dc7703` | |
| `CS/src/capture/__tests__/static.test.ts` | (not hashed at start) | `fafaa269d70b43fea8ae5ec530a9fd2c5ef5e9fc` | |

**The diff of `checks.ts` and `index.ts` against the start blobs: EMPTY, zero hunks.** Item 3 lived in `host-checks.ts` only: it was one row of the table the boot already walks, so step 4d of `checks.ts` and the mount needed nothing for it and need nothing now. THE NEXT BASELINE: `boot/checks.ts` 90b3a1e6, `boot/index.ts` 63fe763e (as C102 set them).

DRIVER DECISION D-1 (to confirm): both files keep ONE comment word of item 3 - the decision list `C49 (2)` in `checks.ts:68` ("ROW HC (decisions C55 DD-2, C53 (4c), C49 (2), C94 (j)) - three additions around 4d and 4e") and in `index.ts:134`. Neither line describes the table check (the three additions named are 4d-0, 4d-3 and 4e; the exports are of items 1, 2, 4). They were left so that the two fence baselines do not move for a comment word. Taking the two words out is a one-line edit each and a new baseline, if the controller wants it.

## 3. How "as before row HC" was established

The task expected `git diff` to be of no use. It is of use: `git rev-parse HEAD:apps/core-server/src/capture/boot/host-checks.ts` = `a88c6a1a`, which is the blob row HC's record names as ITS start (section 3 of that record). So the committed file IS the file before row HC, and `git diff HEAD` of the four files showed item 3 exactly, hunk by hunk, mixed with item 1. Read-only git commands only (`git show`, `git diff`, `git rev-parse`, `git hash-object`); nothing staged, restored or checked out. Cross-checked with `implementation/080_host_checks.md` (check 5 of its table: `systemctl is-active dems-loopback-rule.service` -> `active`, reason `RULE_UNIT_NOT_ACTIVE`; "the program literals are exactly eight").

Result, checked mechanically: `BOOT/__tests__/host-support.ts` hashes to the committed blob `8928710a` again (row HC had touched it for item 3 only). `git diff HEAD` of `host-checks.ts` and `host-checks.test.ts` now shows item 1 (the status `ABSENT`, `aliasSocket`) and the comments of this row, and nothing else.

## 4. What was removed (`BOOT/host-checks.ts`, four hunks against fd7e637d)

| # | Where | What |
|---|---|---|
| 1 | header, the paragraph "THE LOOPBACK RULE IS ASKED TWICE" (9 lines) | REPLACED by "THE LOOPBACK RULE IS ASKED BY THE STATE OF ITS UNIT, AND THE RULE TABLE IS NOT READ" (11 lines): why, the measurement, "do not add it again", the stated limit. The paragraph of item 1 (the absent socket) is untouched |
| 2 | `HostCheckReason` | -6 lines: `RULE_TABLE_ABSENT_OR_NOT_READABLE`, `RULE_CHAIN_MISSING`, `RULE_NOT_IN_CHAIN` with their comments |
| 3 | constants | -6 lines: `PACKET_FILTER` (`/usr/sbin/nft`), `RULE_TABLE`, `RULE_CHAIN`, `RULE_PARTS`. `ALIAS_SOCKET_INSTALLED_PATH` (item 2) stays |
| 4 | `HOST_COMMAND_CHECKS` | -20 lines: the second row (the listing and its parser, the `judge`). +4 comment lines at the first row (the unit's state), in the file's style: the table is not read, the Core's unit has no capability and the kernel refuses the listing (decision C103, `test/hc2_nft_listing_unprivileged.md`), a row that lists it refuses every start of a prepared host, the limit that follows |

The first row itself - command, items `HOST-25`, `HOST-41`, judge - was not changed by row HC and is not changed now: it is byte for byte the row of row 80.

**Codes.** Grep over `apps/`, `packages/`, `scripts/` before removing:

| Word | Other users | Done |
|---|---|---|
| `RULE_TABLE_ABSENT_OR_NOT_READABLE`, `RULE_CHAIN_MISSING`, `RULE_NOT_IN_CHAIN` | none in product, contract (`packages/shared`), web or `scripts/`; only the task's own records (HC, HC2, decisions, requests) | REMOVED. No pin of another owner moved: nothing counts the members of `HostCheckReason` |
| `CAPTURE_HOST_LOOPBACK_RULE_MISSING` and its sentence in `HOST_REFUSAL_TEXT` | the unit's check of row 80 (its own code), four test files, the hardware chapter | STAYS, unchanged. Row HC had not edited the sentence (it already reads "the unit dems-loopback-rule.service is active"), so there was nothing to restore |
| `RULE_UNIT_NOT_ACTIVE` | the unit's check | stays |

No member is kept as an unused word.

## 5. Tests restored (expectations row HC had moved for item 3) and removed

| File | Restored to the text of before row HC | Removed |
|---|---|---|
| `BOOT/__tests__/host-support.ts` | `fakeHost.run`: `const code = options.codeOf(command)` and `HOST_ANSWERS[code]?.present` | `RULE_TABLE_KEY`, `RULE_TABLE_PROGRAM`, `tableOf`, `CHAIN`, `RULE`, `RULE_TABLE_ANSWERS` (1 present, 8 absent, 6 malformed). The file is the committed blob again |
| `BOOT/__tests__/host-checks.test.ts` | "every question ..., no code is asked twice": `new Set(codes).size === length`, `HOST_ANSWERS` keys = the codes, `CaptureHostRefusal` has `ALL_CHECKS` members (was `ALL_CHECKS - 1`), "the loopback rule is the FIRST question"; the word-for-word list of the questions (9 rows, the `nft` line out); the loop over the questions keyed by `check.code` again (names, `results.find` by code) | the case "the rule table is asked by ONE fixed read-only row"; the case "the table deleted while its unit is ACTIVE is refused"; the four loop cases of the table row (present, absent, malformed, not started) fall away with the row |
| `BOOT/__tests__/checks.test.ts` | "every prerequisite, removed one at a time": `HOST_ANSWERS[check.code]` and the key `check.code`; the import line | the case "C49 (2), 9A/H-16 criterion 6: the rule table deleted while its unit is active REFUSES the start" (a three-line comment says where it went); the words "the rule table is read;" out of the block's title |
| `CS/src/capture/__tests__/static.test.ts`, block "row 80", case "every question is a row of the one table" | the two assertions on the file itself: the program literals are exactly eight; the refused list (which names the packet filter's tool) matches nothing in the file | the named entry (`PACKET_FILTER_DECLARATION`, `PACKET_FILTER_ROW`, the one-declaration and one-row assertions, `RULE_TABLE`) and its control (the refused verbs `add|delete|flush|...`, the copy `withoutTheEntry`). A three-line comment says the entry is gone and why. No list entry of G-R2, G-R8 or SR-1 was touched |

Kept as row HC left them, NOT edited (items 1, 2, 4): in `host-checks.test.ts` the `aliasSocket` members, the `SOCKET_ABSENT` branch and the case "the diagnostics show an absent socket node as ABSENT"; in `checks.test.ts` the `SOCKET_ABSENT` filter and every case of the block of row HC but the one of item 3; `program-checks.test.ts`, `boot.test.ts`, `fence.test.ts`, `fence.db.test.ts`, `writers.test.ts` - not opened for writing.

What holds the removal from now on: the word-for-word list of the nine questions (a tenth row fails it), "no code is asked twice", and the static refused list in which the tool stands.

## 6. Items 1, 2 and 4 stay - proven by their tests, unedited

`CAPTURE_HOST_ALIAS_HELPER_ABSENT` and the `SYSTEM_BOOT` member `addressHelperSocket` (item 1), `CAPTURE_HOST_ALIAS_SOCKET_PATH` / `CONFIGURED_PATH_NOT_THE_INSTALLED_ONE` (item 2), `CAPTURE_HOST_FACTS_NOT_HANDED_IN` / `NO_HOST_FACTS` (item 4): their product files (`checks.ts`, `index.ts`, `program-checks.ts`, `fence/boot-key.ts`, `fence/index.ts`, `core/audit-details.ts`) were not edited, and their cases pass in the runs below.

## 7. Checks

| Check | Command | Result |
|---|---|---|
| unit: boot folder, fence, writers, capture static, `test/static` (one run) | from `CS`: `npx vitest run --project unit --maxWorkers=2 src/capture/boot src/capture/fence/__tests__/fence.test.ts src/core/__tests__/writers.test.ts src/capture/__tests__/static.test.ts test/static` | `Test Files  30 passed (30)`, `Tests  799 passed (799)` - 806 of row HC less the 7 cases of item 3 (4 of the loop, 2 in `host-checks.test.ts`, 1 in `checks.test.ts`) |
| database, the suites that boot production on the test host; throw-away clones, `.locks/heavy-host.lock` and `.locks/db-migrate.lock`, sandbox off | `npx vitest run --project db --maxWorkers=2 src/capture/fence/__tests__/fence.db.test.ts src/capture/__tests__/boot.db.test.ts src/__tests__/capture-composition.db.test.ts` | `Test Files  1 failed | 2 passed (3)`, `Tests  1 failed | 68 passed (69)`, `0 remain with the run prefix` - the one is not this row's (below) |
| typecheck | `npx tsc --noEmit` in `CS` | no output, exit 0 |
| lint | `npx oxlint` on the 4 boot product files, the 3 boot test files and the capture static test | no output, exit 0 |

Red seen, NOT this row's, file not edited: `CS/src/__tests__/capture-composition.db.test.ts:924` (row 111b: expected `COMMISSIONING_ADDRESS_NOT_ALLOWED`, received `null` behind `[422, 'INVALID_INPUT']`) - the same red row HC reported, agent V6, R119-04. It was not run a second time: it is a known red in a file of another row.

## 8. Request left (one line, `delegation_progress/file_requests.md`)

THE DOCUMENT ROW, `scripts/hardware-acceptance/HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md`, `9A/H-16` criterion 6 (and step `.9`, line :311, and the gap sentence of `9A/H-04` :251): the criterion cannot be met by the Core as designed. The text is in the request line: what the Core checks (the unit's state, `CAPTURE_HOST_LOOPBACK_RULE_MISSING` / `RULE_UNIT_NOT_ACTIVE`), what it cannot know (the table: no capability, the kernel refuses, same answer present or absent), and that a table deleted while the unit is active is NOT detected at a start. Line 2 of row HC's requests (outcome (i) expected at step `.9`) is withdrawn in that point.

## 9. Unproven until a Linux host

| Unproven | Check |
|---|---|
| The refusal of the listing on the real host's kernel (HC2 is a container result) - if a real host DID allow it, this row is still right for the design: the Core holds no capability by `HOST-39` | `9A/H-16`, with `grep -E '^Cap' /proc/<core-pid>/status` |
| An unprivileged account may ask `systemctl is-active` under file G, and the answers have the form judged | `9A/H-01`, `9A/H-16.8` |
| The limit itself: table deleted, unit active, the Core starts | `9A/H-16.9`, expected outcome (ii) |

## 10. Rules kept

Edit tool only for every existing file (4 edits of `host-checks.ts`, 3 of `host-support.ts`, 6 of `host-checks.test.ts`, 5 of `checks.test.ts`, 1 of `static.test.ts`, 1 line each in `file_claims.md` and `file_requests.md`); the two records are new files (Write). No commit, no stage, no restore. No full suite. No host command started by a test, no port bound. `packages/shared`, the commissioning modules, `checks.ts`, `index.ts`, `program-checks.ts`, the fence files and `apps/input-av/` were not edited. One committed copy of `host-checks.ts` was written to the session's temporary directory for a `diff`.

---
*Generated: 2026-10-13 17:25*
