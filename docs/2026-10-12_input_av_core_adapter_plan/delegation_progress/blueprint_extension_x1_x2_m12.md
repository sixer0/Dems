---
task_id: 2026-10-12_input_av_core_adapter_plan
agent: task-architect
type: delegation progress - blueprint extension for U15 to U19 (M11, M12, findings of batches 7 and 8)
date: 2026-10-13
state_time: 2026-10-13 09:05 (the last update of delegation_progress/file_ownership.md)
status: complete
file_changed: identification/03_implementation_blueprint.md (targeted edits in place; no row renumbered or moved; new rows at the end)
application_files_changed: 0
---

# Blueprint extension: X-1, X-2 (M11), real devices (M12), findings since the 05:35 refresh

## 1. What was read

`decisions/decisions.md` rows U15 to U19, P10, P11, C29, C41 to C44; `masterplan/05_design_x1_x2.md` in full; `verification/07_security_x1_x2.md` in full; `delegation_progress/file_ownership.md` from "Batch 7" to its end (09:05); `delegation_progress/batch_8_brief.md`; the blueprint in full. From the code, read-only, to ground paths and the capture operation of M12: Glob over the folders cited, `modules/capture-discovery/index.ts:136-165` and `:246-285`, `scripts/lane/lane.sh:1-70`, Grep hits named in section 14 of the blueprint. No shell, no application file edited.

## 2. Step numbers

**Written out (existed only in a brief):** 192 (in flight, agent D).

**Added (43):** 193 to 235.

| Milestone | Rows | What |
|---|---|---|
| M4 | 192, 199, 200 | the serial and port-path columns (in flight); the module stores and matches them; the adapter matches at open and start |
| M5 | 193 | the worker, its static rules, unit checks and relay tests build and pass in the Ubuntu 24.04 image (L-1 to L-5); before rows 79 and 141 |
| M8 | 194, 195, 196, 197, 198 | re-address of a registered camera: contract operation `confirmCaptureDeviceAddress` (pins 99 to 100), shared registry action, engine door, wiring of `readdress.ts`, web dialog |
| M11 bench tier | 201 to 224 | X-C: 201 (audit vocabulary), 202 (schema step, version 8 to 9, own commit), 203 (its commit), 204 (pin lines, sonnet); 205 (SX-17 baseline); X1-1: 206, 207 (scan needles), 208 (proof on the real boot function and seal); X1-2: 209; X1-3: 210, 211 (boot unit: one load, exported predicate); X2-1: 212; X2-2: 213; X2-3: 214 (probe for H2, H3, grants), 215 (command), 216 (database acceptance); X-D: 217 (installer note), 218 (README), 219 (hardware frame); X-G: 220 (bench boot session), 221 (security review as built), 222 (code review), 223 (gate M11), 224 (commit) |
| M11 rotation tier | 225 to 231 | X1-4: 225 (one resolver), 226 (rotate and mark-compromised commands), 227 (retained set in verify), 229 (scenario); X1-5: 228 (check 4b-2); 230 (security review as built); 231 (commit) |
| M12 | 232, 233, 234, 235 | start a Core of this branch on a spare port in `REAL_DEVELOPMENT`; the USER's search and connection test, observed; findings with owners; stop |

**Changed (open rows only, plus a mark on done rows):**

| Rows | Change |
|---|---|
| 41, 42, 43, 44, 46, 59, 86, 186 | the mark "[relay client = CANDIDATE (a) ...]" removed (U17); nothing else |
| 88 | the same mark and its clause "does not start before that ruling" removed; dependency `200:B` added |
| 59, 79, 82, 141 | dependency `193:B` added; 82's scope names row 193 |
| 73 | dependencies `192:B, 199:B, 200:B`; scope names them |
| 101 | its commit also holds row 192's paths (the same migration files) |
| 120, 122 | dependencies `197:B, 198:B` (120); scope names rows 194 to 198 |
| 136 | 107 identifiers instead of 87; dependencies `223:B, 230:B` |
| 137 | reads SX-01 to SX-20 from rows 221 and 230; dependencies `223:B, 230:B` |
| 138, 139 | dependencies `224:B, 231:B` (138) and `229:B` (139) |

No cell of the task or the check of a row that is done or in flight was changed.

## 3. Sections of the blueprint changed or added

Front matter (`governed_by`); section 0 (state bullet at 09:05); section 4 (packages X-C, X1, X2, X-D, X-G, M12 and the additions to WP-07, WP-08, WP-12, WP-14); section 6 (two standing rules: secrets in M11; real devices); the breakdown and the profile (44 lines each); the paragraph "Rows added by the extension"; "Honesty of the profile" (extension paragraph); "Row status changes at 2026-10-13 09:05"; section 7 (additions line and six new tokens: `signer-key`, `boot-unit`, `cs-pkg`, `secret-scan`, `readme`, `m12-instance`); section 8.3 (totals, waves, critical paths, pace, duration); section 8.4 (integration pass I-7, eight items); section 9 (gates M11 and M12; Track D at 107); section 9.2 (condition 7 met, condition 9 added, "what the lift waits for", exit condition 5); section 10; sections 11.5 (C38, C39), 11.6 (SX-01 to SX-20), 11.7 (rulings); section 12 (seven lines added or rewritten, the X-1 / X-2 paragraph superseded); section 13 (five risks, decisions 22 to 29, the next plan); section 14 (46 paths); section 15; section 16; footer.

## 4. New totals (hand count; sizes and models are estimates)

| Measure | Before (05:35) | Now (09:05) |
|---|---|---|
| Rows | 189 | 233 |
| Size S / M / L | 113 / 76 / 0 | 142 / 91 / 0 |
| Model opus / sonnet / not delegated | 170 / 18 / 1 | 208 / 24 / 1 |
| Done / in flight / skipped / open | 79 / 14 / 2 / 94 | 98 / 16 / 2 / 117 |
| Requirement identifiers carried | 87 | 107 (SX-01 to SX-20 added) |
| Rulings carried beside them | 10 | 16 |
| Distinct `EXISTS:` paths | 131 | 177 |

Done 98 = 77 committed + 21 landed and uncommitted; 5 of them returned `needs-review` with the remainder routed to new rows (78 -> 193; 97 -> 194 to 197; 98 -> 198; 156 -> 192, 199; 190 -> I-7 and row 85). The working tree is further than the ownership file for rows 42 and 50 (records and code seen by Glob and Read); the counts are a floor.

## 5. Paths and estimate

- To gate M6 (row 92): 42 -> 43 -> 153 -> 141 -> 86 -> 88 -> 89 -> 90 -> 151 -> 91 -> 92; 11 levels; about 8 to 16 clock hours.
- To the first real-device observation (row 233): 42 -> 50 -> 51 -> the commit that holds them -> 232 -> 233; about 3 to 6 hours until the instance is ready, then the user's time.
- Gate M11, bench tier (row 223): 81 -> commit -> 205 -> 211 -> 215 -> 216 -> 220 -> 221 -> 223; beside the camera path; about 6 to 12 hours.
- Track D closed (row 140): about 15 to 26 hours.
- Basis: 82 rows landed in 595 minutes (8.3 rows per clock hour; 5.4 in the last 210 minutes, which hold a network outage), 30 to 75 minutes per level of the critical path as measured in section 8.2. Uncertainty about 40 % either way.

## 6. For the controller

1. Decision 22 (the user): a production recording of a real examination needs operator creation and a production seed; M11 serves a bench test only.
2. Decision 23 (the user, restated): the working defaults UD-1 to UD-12; UD-13 (escrow) is not built.
3. Decision 24: whether row 233 waits for row 44 (the credential search of the relay) before the user types a real camera password.
4. Decision 25: row 193 before row 43 on the worker folder (recommended), or overlap on disjoint claims.
5. Decision 26: the schema step X-C at version 9 before set C (recommended).
6. Decision 27: row 209 writes `fence/index.ts` before row 85 starts or after row 88; `fence/boot.ts` stays unedited.
7. Decision 28: row 228 (check 4b-2 in `checks.ts`) after gate M6 unless wanted earlier.
8. Decision 29: confirm row 97's DD-1 to DD-7 (permission, client kinds) before row 194 moves the operation pins.
9. Departures from the launching instruction, each disclosed in the blueprint: M12 (a) is two rows (start 232, stop 235); the follow-up of row 192 is two rows (199, 200); the re-address is five rows; the SX-17 baseline is a row (205) instead of a controller act; I-7 has an eighth item taken from the ownership updates.
10. Not verified here: the name of the port-path column of set B; how the web console is served for a spare instance; whether AM-1 is recorded in `decisions/decisions.md`; every line number quoted from the design and its review.
