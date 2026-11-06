---
row: 110 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
---

# Row 110: static pins reconciled with the R-FLEX source

## Suites, before and after (one run each, `npm test -w @dems/core-server -- <path> --maxWorkers=2`)
| Suite | Before | After |
|---|---|---|
| src/capture/__tests__/static.test.ts | 4 failed / 78 passed (82) | not edited; 4 failed / 78 passed (82) (same 4, all pre-existing) |
| src/capture/adapters/__tests__/static.test.ts | 2 failed / 33 passed (35) | `Tests 35 passed (35)` |
| src/modules/capture-config/__tests__/static.test.ts | `Tests 17 passed (17)` | unchanged, not edited |
| src/modules/capture-discovery/__tests__/static.test.ts | `Tests 14 passed (14)` | unchanged, not edited |
| test/static (17 files) | `Test Files 17 passed (17)`, `Tests 210 passed (210)` | unchanged, not edited (network.test.ts untouched) |
| core-server typecheck (heavy-host lock) | - | exit 0, 0 `error TS` |

## Classified failures
| # | Suite / test (assertion line) | Received | Class | Cause |
|---|---|---|---|---|
| 1 | capture static, G-R10/G-R11 "SR-5, entry 2 ..." (:729) | extra `src/lcd/bridge.ts 1` | PRE-EXISTING task-4 | untracked `src/lcd/bridge.ts` (in `.data/rflex-restore-20261022/untracked.tar.gz`) |
| 2 | capture static, P25 "config.ts: every added line is one of the capture keys" (:1091) | hash `340261be...` vs `de6f7bc9...` | PRE-EXISTING task-4 | `src/config.ts` LCD lines (`DEMS_LCD_BACKEND_URL`, `parseLcdBackendUrl`); `git diff src/config.ts` byte-identical (cmp) to its hunk in the pre-R-FLEX `tracked.diff` |
| 3 | capture static, G-R16 "no production file compares the capture mode ..." (:2081) | `src/lcd/index.ts compares the capture mode itself` | PRE-EXISTING task-4 | untracked `src/lcd/index.ts` |
| 4 | capture static, row 157 / AD-08 (c) "the DEMS_* names of src/ ..." (:2656) | `src/config.ts names the key DEMS_LCD_BACKEND_URL` | PRE-EXISTING task-4 | `src/config.ts` LCD key |
| 5 | adapters static, A-10 (a) admission counts (:643) | `destination-rule.ts: 5` (pinned 4) | R-FLEX row 102 | new admission `decideGlobal` (destination-rule.ts:488) |
| 6 | adapters static, A-10 (b) binders (:650) | extra `src/capture/destination-rule.ts` | R-FLEX row 102 | `GLOBAL_PURPOSES` list names `DestinationPurpose.STORED_CAMERA` (destination-rule.ts:126) |

Failures 1-4 match D20 exactly and are left for row 140 (not re-pinned).

## Changed pins (apps/core-server/src/capture/adapters/__tests__/static.test.ts)
| Pin | Change | RF id |
|---|---|---|
| `ADMISSION_VALUES` (:569) + its doc comment (:560-563) | `destination-rule.ts` 4 -> 5; the comment names the global admission | RF-N1 (spec 2.5 step 8) |
| `RULE_DECLARATION` / `GLOBAL_PURPOSE_LIST` (new consts after `RULE_BINDERS`) + test (b) | the one exact `GLOBAL_PURPOSES` line of the rule file is set aside from the binder scan; the test asserts the rule file names `STORED_CAMERA` exactly once and at that line, so any other naming in the rule file still counts as a binder | RF-N1 (spec 2.5) |

Pins removed: 0. `RULE_BINDERS`, the "one binder binds once" assertion and every other pin are unchanged. The spec 2.6 item (`:585,632,657` "C if the pinned text is the C1/C2 doc comment") needed no change: those assertions pass.
