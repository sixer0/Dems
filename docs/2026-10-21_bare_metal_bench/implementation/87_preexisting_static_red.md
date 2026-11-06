# 87 - Pre-existing red: apps/core-server/src/capture/__tests__/static.test.ts (row 140, HIL record)

Tier 3. Changes no repo source or test file. Source of the list: implementation/62_rflex_static_pins.md (row 110, table lines 23-26).
Result per row 110: 4 failed / 78 passed (82), identical before and after R-FLEX, so all 4 are pre-existing.
Cause: task-4's uncommitted LCD work (untracked src/lcd/*, modified src/config.ts). Line numbers below were read from the test file (no rerun needed; they match row 110).

| # | Test name (static.test.ts) | Assertion line | LCD file / key cited |
|---|---|---|---|
| 1 | SR-5, entry 2: the time read takes the source address as its third parameter ... every production caller is bound (control) (it at :725) | :729 `expect(callers).toEqual([...])` | src/lcd/bridge.ts (extra caller "src/lcd/bridge.ts 1") |
| 2 | config.ts: every added line is one of the capture keys (spec I edits 7 to 10 and 15 to 18); without them the file is the frozen one (P25, it at :917) | :1091 `expect(digest(withoutWaived(current))).toBe(FROZEN_CONFIG_TS)` | src/config.ts LCD lines (DEMS_LCD_BACKEND_URL, parseLcdBackendUrl); hash 340261be... vs de6f7bc9...; config.ts diff byte-identical to the pre-R-FLEX restore-point hunk |
| 3 | no production file compares the capture mode but the one function and the readers from before it; the list has no entry that is gone (G-R16, it at :2080) | :2081 `expect(violations(production)).toEqual([])` | src/lcd/index.ts ("compares the capture mode itself") |
| 4 | (c) the DEMS_* names of src/ are the closed list, none says test; ... (AD-08(c), row 157, it at :2655) | :2656 `expect(keyViolations(production)).toEqual([])` | key DEMS_LCD_BACKEND_URL in src/config.ts |

## User's word (decisions.md D28)

"Baris 140: biarkan merah (pre-existing task 4 LCD), laporkan di 115 sebagai pre-existing; pin ulang nanti saat pekerjaan LCD di-commit."

## Disposition

- The 4 stay red; reported in row 115 as pre-existing. Nothing was edited or re-pinned here.
- Follow-up OUTSIDE this blueprint: re-pin these 4 assertions when the task-4 LCD work is committed.
