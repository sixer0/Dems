---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: data-analyst
blueprint_row: 128 (fix pass of the reconciliation gate)
type: delegation record (tier 3 — mechanical edits with grep evidence)
status: complete
spec: gateway_check/27_r9_r11_spec_gate.md (section 2.1 how to use, 2.2 fix list, 2.3 i18n keys, 6 erratum rows)
rulings_used: D91 (R-1 = option A, R-2 = option A); names of gate 4.2 accepted
last_updated: 2026-10-09
---

# Row 128 fix pass — working record

## 1. Result

| Item | Value |
|---|---|
| Fix rows applied | **94 of 94** (APPLIED); NOT APPLIED: **0** |
| Re-check command of gate §2.4 | `failing: 0` over **128** patterns — 94 `FX-*` all ok, 34 `BP-*` also ok at run time (the blueprint had been edited by its owner when the command ran) |
| Erratum rows appended to `masterplan/11_audit_errata.md` | §5.9 11, §5.10 15, §5.11 15, §5.12 15, §5.13 19, §5.14 5, §5.15 18 (= **98**), §5.16 **94** |
| Table column-count check | 0 new violations; the 9 pre-existing hits (05: 2, 06: 2, 08: 1, 09: 4) are unchanged from `git HEAD` and none was touched by this pass; `10_test_strategy.md` 1 -> 0 (the PE-127-11 repair, uncommitted) |
| i18n keys | 120 - 1 + 18 = 137, counted by script over §14.2 (`^| \`common.` rows between the headings of §14.2 and §14.3): 137, 0 duplicates |
| Constants of the `03` delta | 14 -> 17 (counted); reason values 15 -> 17 (counted) |

Files edited (and only these): `masterplan/01_specs.md`, `02_plan.md`, `03_api_contract.md`, `04_database_contract.md`, `05_capture_architecture_spec.md`, `06_evidence_package_spec.md`, `08_client_ux_spec.md`, `09_security_design_review.md`, `10_test_strategy.md`, `11_audit_errata.md`; this record. `07_transcript_spec.md` — no fix row names it, not edited. Not touched: the blueprint, decisions, trackers, the gate file, code.

## 2. The 94 rows

Mark = `PE-128-nn` of gate §6.8. "First line" = first line carrying the mark after the pass.

| Fix | Mark | File | Severity | First line | Status | Note |
|---|---|---|---|---|---|---|
| FX-01-01 | PE-128-01 | `01_specs.md` | must-fix | 283 | APPLIED | split: clause in the narrative chain + sentence on the no-opener consequence at the end of the narrative |
| FX-01-02 | PE-128-02 | `01_specs.md` | should-fix | 288 | APPLIED |  |
| FX-01-03 | PE-128-03 | `01_specs.md` | must-fix | 291 | APPLIED | also adds the row-84 proof sentence of the required text |
| FX-01-04 | PE-128-04 | `01_specs.md` | must-fix | 293 | APPLIED |  |
| FX-01-05 | PE-128-05 | `01_specs.md` | must-fix | 298 | APPLIED |  |
| FX-01-06 | PE-128-06 | `01_specs.md` | must-fix | 299 | APPLIED |  |
| FX-01-07 | PE-128-07 | `01_specs.md` | should-fix | 313 | APPLIED | R-1 option A (D91): `captureDurable` named |
| FX-01-08 | PE-128-08 | `01_specs.md` | should-fix | 315 | APPLIED |  |
| FX-01-09 | PE-128-09 | `01_specs.md` | must-fix | 325 | APPLIED |  |
| FX-01-10 | PE-128-10 | `01_specs.md` | should-fix | 326 | APPLIED |  |
| FX-01-11 | PE-128-11 | `01_specs.md` | must-fix | 327 | APPLIED |  |
| FX-01-12 | PE-128-12 | `01_specs.md` | must-fix | 331 | APPLIED |  |
| FX-01-13 | PE-128-13 | `01_specs.md` | should-fix | 400 | APPLIED |  |
| FX-01-14 | PE-128-14 | `01_specs.md` | cosmetic | 398 | APPLIED |  |
| FX-01-15 | PE-128-15 | `01_specs.md` | cosmetic | 224 | APPLIED |  |
| FX-01-16 | PE-128-16 | `01_specs.md` | cosmetic | 347 | APPLIED |  |
| FX-03-01 | PE-128-17 | `03_api_contract.md` | must-fix | 1011 | APPLIED |  |
| FX-03-02 | PE-128-18 | `03_api_contract.md` | must-fix | 1019 | APPLIED |  |
| FX-03-03 | PE-128-19 | `03_api_contract.md` | must-fix | 1007 | APPLIED | hypothesis paragraph replaced; both constants re-pinned |
| FX-03-04 | PE-128-20 | `03_api_contract.md` | must-fix | 445 | APPLIED | 3 constants added/changed + :443 parenthesis + rate-limits rule; constants 14 -> 17 together with FX-03-05 |
| FX-03-05 | PE-128-21 | `03_api_contract.md` | must-fix | 409 | APPLIED | op 93 cell, Config lock rule, one new reason row, constant `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` |
| FX-03-06 | PE-128-22 | `03_api_contract.md` | must-fix | 421 | APPLIED | three statements deleted/replaced; `:411` and `:421` edited |
| FX-03-07 | PE-128-23 | `03_api_contract.md` | must-fix | 426 | APPLIED |  |
| FX-03-08 | PE-128-24 | `03_api_contract.md` | must-fix | 457 | APPLIED | adapter and sourceClass rows of "Device shapes"; adoption "what it stores" now names the column |
| FX-03-09 | PE-128-25 | `03_api_contract.md` | must-fix | 483 | APPLIED |  |
| FX-03-10 | PE-128-26 | `03_api_contract.md` | must-fix | 409 | APPLIED |  |
| FX-03-11 | PE-128-27 | `03_api_contract.md` | must-fix | 221 | APPLIED |  |
| FX-03-12 | PE-128-28 | `03_api_contract.md` | must-fix | 815 | APPLIED | audit tables gain rows (`host?`, `endpointRef?`, `guardTripped?`, `interfaceCount`), self-gate 12 + 11 + 10 + 6 |
| FX-03-13 | PE-128-29 | `03_api_contract.md` | should-fix | 97 | APPLIED | §0 table row 97 and the access notes |
| FX-03-14 | PE-128-30 | `03_api_contract.md` | must-fix | 450 | APPLIED |  |
| FX-03-15 | PE-128-31 | `03_api_contract.md` | should-fix | 452 | APPLIED |  |
| FX-03-16 | PE-128-32 | `03_api_contract.md` | must-fix | 554 | APPLIED | three rows added to §3.1 (39 / 40 as one row, 41 as one row) |
| FX-03-17 | PE-128-33 | `03_api_contract.md` | must-fix | 552 | APPLIED | start-rule cell + the closing paragraph of §3.1 |
| FX-03-18 | PE-128-34 | `03_api_contract.md` | must-fix | 553 | APPLIED | recording-start row + one new §4 reason row; R-1 option A (D91): `captureDurable` named |
| FX-03-19 | PE-128-35 | `03_api_contract.md` | must-fix | 462 | APPLIED |  |
| FX-03-20 | PE-128-36 | `03_api_contract.md` | should-fix | 476 | APPLIED |  |
| FX-03-21 | PE-128-37 | `03_api_contract.md` | should-fix | 882 | APPLIED | new row in §5.3 |
| FX-03-22 | PE-128-38 | `03_api_contract.md` | must-fix | 474 | APPLIED |  |
| FX-03-23 | PE-128-39 | `03_api_contract.md` | cosmetic | 1163 | APPLIED |  |
| FX-04-01 | PE-128-40 | `04_database_contract.md` | must-fix | 752 | APPLIED | N.10 row + erratum paragraph under §E.2 + O-5 closed |
| FX-04-02 | PE-128-41 | `04_database_contract.md` | should-fix | 1028 | APPLIED |  |
| FX-04-03 | PE-128-42 | `04_database_contract.md` | should-fix | 1091 | APPLIED | MR-S1 append, MR-S6 row, new static pin as a paragraph under N.12 (not a table row, so the 15-group count of N.12 is unchanged) |
| FX-04-04 | PE-128-43 | `04_database_contract.md` | should-fix | 1142 | APPLIED | N.5 two cells, N.6 key list, G-2 closed |
| FX-04-05 | PE-128-44 | `04_database_contract.md` | must-fix | 338 | APPLIED |  |
| FX-04-06 | PE-128-45 | `04_database_contract.md` | cosmetic | 1459 | APPLIED |  |
| FX-05-01 | PE-128-46 | `05_capture_architecture_spec.md` | must-fix | 172 | APPLIED | slot table rows 1 and 3, paragraph under the table, HL-11, A.6.5 sentence, ML-7, `AudioStreamHandle` comment |
| FX-05-02 | PE-128-47 | `05_capture_architecture_spec.md` | must-fix | 204 | APPLIED |  |
| FX-05-03 | PE-128-48 | `05_capture_architecture_spec.md` | must-fix | 155 | APPLIED |  |
| FX-05-04 | PE-128-49 | `05_capture_architecture_spec.md` | must-fix | 481 | APPLIED |  |
| FX-05-21 | PE-128-50 | `05_capture_architecture_spec.md` | must-fix | 481 | APPLIED |  |
| FX-05-05 | PE-128-51 | `05_capture_architecture_spec.md` | must-fix | 489 | APPLIED |  |
| FX-05-06 | PE-128-52 | `05_capture_architecture_spec.md` | must-fix | 556 | APPLIED |  |
| FX-05-07 | PE-128-53 | `05_capture_architecture_spec.md` | must-fix | 571 | APPLIED | outcomes table, CT-1, CT-2, gap paragraph |
| FX-05-08 | PE-128-54 | `05_capture_architecture_spec.md` | must-fix | 584 | APPLIED |  |
| FX-05-09 | PE-128-55 | `05_capture_architecture_spec.md` | must-fix | 596 | APPLIED |  |
| FX-05-10 | PE-128-56 | `05_capture_architecture_spec.md` | must-fix | 860 | APPLIED |  |
| FX-05-11 | PE-128-57 | `05_capture_architecture_spec.md` | must-fix | 1248 | APPLIED |  |
| FX-05-12 | PE-128-58 | `05_capture_architecture_spec.md` | should-fix | 480 | APPLIED |  |
| FX-05-13 | PE-128-59 | `05_capture_architecture_spec.md` | should-fix | 721 | APPLIED | R-1 option A (D91) added: stored state `RECORDING`, payload member `captureDurable` |
| FX-05-14 | PE-128-60 | `05_capture_architecture_spec.md` | must-fix | 1194 | APPLIED |  |
| FX-05-15 | PE-128-61 | `05_capture_architecture_spec.md` | should-fix | 1290 | APPLIED | edits 7-10 "Landed by" cells (anchors mapped in the order listed in the fix row), count line, note deleted, planned-edits waiver sentence |
| FX-05-16 | PE-128-62 | `05_capture_architecture_spec.md` | should-fix | 1385 | APPLIED | H-22..H-26 copied from `09:710-714`, H-27 added |
| FX-05-17 | PE-128-63 | `05_capture_architecture_spec.md` | must-fix | 212 | APPLIED |  |
| FX-05-18 | PE-128-64 | `05_capture_architecture_spec.md` | must-fix | 688 | APPLIED |  |
| FX-05-19 | PE-128-65 | `05_capture_architecture_spec.md` | should-fix | 139 | APPLIED |  |
| FX-05-20 | PE-128-66 | `05_capture_architecture_spec.md` | should-fix | 488 | APPLIED |  |
| FX-06-01 | PE-128-67 | `06_evidence_package_spec.md` | must-fix | 490 | APPLIED |  |
| FX-06-02 | PE-128-68 | `06_evidence_package_spec.md` | must-fix | 528 | APPLIED |  |
| FX-06-03 | PE-128-69 | `06_evidence_package_spec.md` | must-fix | 864 | APPLIED | new row, "Open with the fence" row replaced by the definition, "On this computer" row replaced |
| FX-06-04 | PE-128-70 | `06_evidence_package_spec.md` | must-fix | 697 | APPLIED |  |
| FX-06-05 | PE-128-71 | `06_evidence_package_spec.md` | should-fix | 439 | APPLIED |  |
| FX-08-01 | PE-128-72 | `08_client_ux_spec.md` | must-fix | 1106 | APPLIED | G18 rows, key `useOther`, totals 17/17 and 43, §15 pointers, `M4-MIC-ACTIVE` text |
| FX-08-02 | PE-128-73 | `08_client_ux_spec.md` | must-fix | 810 | APPLIED |  |
| FX-08-03 | PE-128-74 | `08_client_ux_spec.md` | must-fix | 656 | APPLIED |  |
| FX-08-04 | PE-128-75 | `08_client_ux_spec.md` | must-fix | 1049 | APPLIED | R-2 option A (D91) sentence added in §8f.3; OP-125-7 closed |
| FX-08-05 | PE-128-76 | `08_client_ux_spec.md` | should-fix | 732 | APPLIED |  |
| FX-08-06 | PE-128-77 | `08_client_ux_spec.md` | must-fix | 704 | APPLIED |  |
| FX-08-07 | PE-128-78 | `08_client_ux_spec.md` | must-fix | 1034 | APPLIED |  |
| FX-08-08 | PE-128-79 | `08_client_ux_spec.md` | must-fix | 577 | APPLIED | flow-7 table gets step 5; §8e.2 paragraph; OP-125-5 closed; R-1 option A (D91): `captureDurable` |
| FX-08-09 | PE-128-80 | `08_client_ux_spec.md` | must-fix | 714 | APPLIED | S14 row; G13 condition (§8c.4 and §11); C-degraded action; states 13 -> 14 |
| FX-08-10 | PE-128-81 | `08_client_ux_spec.md` | should-fix | 1032 | APPLIED | fifth local-device state; §8g.3 row; §14.1 row |
| FX-08-11 | PE-128-82 | `08_client_ux_spec.md` | must-fix | 1502 | APPLIED | 18 keys added after `common.rbac.checking`, `useOther` removed (FX-08-01), count 137 verified by script |
| FX-08-12 | PE-128-83 | `08_client_ux_spec.md` | cosmetic | 1581 | APPLIED |  |
| FX-09-01 | PE-128-84 | `09_security_design_review.md` | should-fix | 672 | APPLIED |  |
| FX-09-02 | PE-128-85 | `09_security_design_review.md` | must-fix | 605 | APPLIED |  |
| FX-09-03 | PE-128-86 | `09_security_design_review.md` | should-fix | 638 | APPLIED |  |
| FX-09-04 | PE-128-87 | `09_security_design_review.md` | cosmetic | 718 | APPLIED |  |
| FX-10-01 | PE-128-88 | `10_test_strategy.md` | must-fix | 461 | APPLIED | F.1 paragraph, F.2 label, A.7 rows (604, 607), index row 461 |
| FX-10-02 | PE-128-89 | `10_test_strategy.md` | should-fix | 468 | APPLIED |  |
| FX-10-03 | PE-128-90 | `10_test_strategy.md` | should-fix | 369 | APPLIED |  |
| FX-10-04 | PE-128-91 | `10_test_strategy.md` | must-fix | 236 | APPLIED |  |
| FX-10-05 | PE-128-92 | `10_test_strategy.md` | should-fix | 271 | APPLIED | also `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` in (b), ST list in CR-1 |
| FX-02-01 | PE-128-93 | `02_plan.md` | should-fix | 242 | APPLIED | M7-W2 and M7-W4 |
| FX-02-02 | PE-128-94 | `02_plan.md` | should-fix | 278 | APPLIED | new subsection B.10 with 14 tracking rows AP3-129..AP3-142 generated from `02_structured.md` rows 129-142 (title = the text before the first colon / dash / semicolon of the Task cell, owner, output, dependencies, check IDs from the Verification cell; Rollback "not stated in the blueprint") |

## 3. Re-check (the command of gate §2.4, run from the task folder, 2026-10-09 after the last edit)

```
ok   FX-01-01 A 0
ok   FX-01-02 P 1
ok   FX-01-03 A 0
ok   FX-01-04 A 0
ok   FX-01-05 A 0
ok   FX-01-06 P 1
ok   FX-01-07 P 1
ok   FX-01-08 A 0
ok   FX-01-09 P 1
ok   FX-01-10 P 1
ok   FX-01-11 A 0
ok   FX-01-12 P 1
ok   FX-01-13 A 0
ok   FX-01-14 P 1
ok   FX-01-15 P 1
ok   FX-01-16 P 3
ok   FX-03-01 P 1
ok   FX-03-02 P 1
ok   FX-03-03 P 1
ok   FX-03-04 P 2
ok   FX-03-05 P 3
ok   FX-03-06 A 0
ok   FX-03-07 A 0
ok   FX-03-08 P 1
ok   FX-03-09 P 2
ok   FX-03-10 P 2
ok   FX-03-11 P 4
ok   FX-03-12 A 0
ok   FX-03-13 P 2
ok   FX-03-14 P 1
ok   FX-03-15 P 1
ok   FX-03-16 P 1
ok   FX-03-17 A 0
ok   FX-03-18 P 2
ok   FX-03-19 P 2
ok   FX-03-20 P 2
ok   FX-03-21 P 1
ok   FX-03-22 P 1
ok   FX-03-23 P 1
ok   FX-04-01 P 2
ok   FX-04-02 A 0
ok   FX-04-03 P 1
ok   FX-04-04 A 0
ok   FX-04-05 P 1
ok   FX-04-06 P 1
ok   FX-05-01 A 0
ok   FX-05-02 A 0
ok   FX-05-03 A 0
ok   FX-05-04 A 0
ok   FX-05-21 A 0
ok   FX-05-05 P 1
ok   FX-05-06 A 0
ok   FX-05-07 A 0
ok   FX-05-08 A 0
ok   FX-05-09 A 0
ok   FX-05-10 A 0
ok   FX-05-11 A 0
ok   FX-05-12 A 0
ok   FX-05-13 P 1
ok   FX-05-14 P 1
ok   FX-05-15 A 0
ok   FX-05-16 P 1
ok   FX-05-17 P 2
ok   FX-05-18 P 1
ok   FX-05-19 P 1
ok   FX-05-20 P 1
ok   FX-06-01 A 0
ok   FX-06-02 A 0
ok   FX-06-03 A 0
ok   FX-06-04 P 1
ok   FX-06-05 A 0
ok   FX-08-01 A 0
ok   FX-08-02 A 0
ok   FX-08-03 A 0
ok   FX-08-04 A 0
ok   FX-08-05 A 0
ok   FX-08-06 P 2
ok   FX-08-07 P 3
ok   FX-08-08 P 3
ok   FX-08-09 P 1
ok   FX-08-10 P 1
ok   FX-08-11 P 3
ok   FX-08-12 P 1
ok   FX-09-01 A 0
ok   FX-09-02 P 1
ok   FX-09-03 A 0
ok   FX-09-04 P 1
ok   FX-10-01 A 0
ok   FX-10-02 A 0
ok   FX-10-03 A 0
ok   FX-10-04 P 1
ok   FX-10-05 P 1
ok   FX-02-01 P 1
ok   FX-02-02 P 15
ok   BP-128 A 0
ok   BP-129 P 1
ok   BP-130 P 1
ok   BP-131 A 0
ok   BP-132 A 0
ok   BP-133 P 1
ok   BP-134 A 0
ok   BP-135 P 1
ok   BP-136 P 1
ok   BP-137 P 1
ok   BP-138 A 0
ok   BP-139 P 1
ok   BP-140 P 1
ok   BP-141 P 1
ok   BP-142 A 0
ok   BP-70 P 2
ok   BP-75 P 1
ok   BP-89 P 2
ok   BP-60 P 2
ok   BP-61 P 1
ok   BP-65 P 1
ok   BP-66 P 1
ok   BP-67 P 2
ok   BP-68 P 2
ok   BP-71 P 1
ok   BP-83 A 0
ok   BP-84 P 1
ok   BP-85 P 1
ok   BP-86 P 1
ok   BP-121 P 1
ok   BP-125 P 1
ok   BP-X1 A 0
ok   BP-X2 A 0
ok   BP-X3 A 0
failing: 0
```

Before the pass the gate recorded `failing: 128`. FX patterns still failing: **none**, so there is no "why" to give.

## 4. Same-fix occurrences the list had missed (fixed; no mark of their own)

| # | File and place | What | Same fix row |
|--:|---|---|---|
| 1 | `05` §J H-20 | "underrun fill for `MIC-01`" -> "for the local microphone" | FX-05-01 |
| 2 | `05` §I, Erratum PE-57-08 paragraph | "Edits 7-10 are not landed: `config.ts` has no diff ..." -> landed with row 58 | FX-05-15 |
| 3 | `08` §9 P-13 | "18 controls + 8 reads" -> 17 | FX-08-01 |
| 4 | `08` §13.1 change list | "rows G11-G18" -> "G11-G17" | FX-08-01 |
| 5 | `08` §13 table "Each flow has its states listed" | "(13 states ..." -> 14; "(4 local-device states)" -> 5; "(6 start-rule cases)" -> 7 | FX-08-09, FX-08-10 |
| 6 | `08` §8c.4 permission table, G13 row | condition "any session state" -> "except RECORDING until the lift" (the inventory row of section 11 was in the list, this one was not) | FX-08-09 |
| 7 | `08` §8f.3 "Not in the production configuration" | "With the development flag off, ops 76 / 77 list 0 ..." -> "In `REAL_PRODUCTION`, ..." (D83 O-2 consequence; same wording as FX-03-09) | FX-03-09 |
| 8 | `08` §8d.1 (tablet row) and `10` M4-CONN-WEBONLY-1 | "before the body is read" -> "before the body is used" | FX-03-13 |
| 9 | `10` rows `M7-KM-P1..P4-0`, `M7-KM-P1..P4 x S1..S6`, the F.1 index row of §A.4a.10, F.2 label | P1 asserts a failed start (the fix row names "A.7 assertions of the P1 cells") | FX-10-01 |
| 10 | `10` `M4-DEVSRC-LABEL-W/-T/-P` | one case added: live client on a Core in `SIMULATED`: 0 badges on devices and demo items (gate §4.1, R-2 option A) | FX-08-04 (R-2) |
| 11 | `04` MR-S1, `05` A.6.5, `01` R-10 AC-3, `03` recording-start row, `08` flow 7 / §8e.2 | the R-1 option A member name `captureDurable` is stated where the fix row says "pending R-1" | FX-04-03, FX-05-13, FX-01-07, FX-03-18, FX-08-08 |
| 12 | front matter `last_updated` and footer of each edited file | one clause naming the PE-128 range | — |

## 5. Left unchanged — for the controller to decide

1. `03` §3.1 row 78 / 79 and §4 reason `DEVELOPMENT_SOURCE_NOT_ALLOWED` still read "while the development flag is off"; under D83 O-2 (stored kinds inert in `SIMULATED`, the `FAKE` built-ins listed and assignable as today) the condition should read "in `REAL_PRODUCTION`". The fix list has no row for it (FX-03-09 covers ops 76 / 77 only). `03` §2.6 "Credential required" also says "(loopback only, development flag on)" for a `DEVELOPMENT` candidate, which FX-03-06 now limits to a `FAKE` candidate reached through the injected loopback target.
2. `08` §8e.2 situation C, tablet cell: "then the existing fault hand-off" — OP-125-5 is now closed by D84 ("no Recovery hand-off — the fault presentation, then the idle state"). Not in the fix list.
3. `05` §A.8.1: ST-4 now says any RTSP connection "is recorded as a violation by ST-5", but ST-5's own text lists only operations outside the CT-1 list. Not in the fix list.
4. FX-05-15: the four anchors (`config.ts:43-44`, `:177-181`, `:263-267`, `:294-312`) are assigned to edits 7, 8, 9, 10 in the order the fix row lists them.
5. FX-02-02: `02_plan.md` B.10 was generated from `02_structured.md` rows 129-142 as they stood when the pass ran (the blueprint owner had already applied §5 of the gate); if the blueprint changes again the Checks and Deps cells of B.10 need a refresh. The plan has no rollback column content for these rows in the blueprint, so the cell says so.
6. FX-08-11: `common.captureNotice.start.activeMicrophoneFallback` was kept (the count 120 - 1 + 18 = 137 requires it); its text now equals the new `activeMicrophone` text.
7. The 9 table-column hits listed in section 1 are pre-existing (literal pipes in code spans); a future edit may want to escape them.

## 6. Commands used for the checks

- Re-check: the python block of gate §2.4 (output in section 3).
- Column count: a script that splits every table row on unescaped `|` and compares it with the header row of its table, run on the ten files and on `git show HEAD:` of each.
- Superseded values: `grep -n -F` over the nine spec files for `` `CAPTURE_DISCOVERY_WINDOW_MS` | `5_000` ``, `TEST_TIMEOUT_MS ... 10_000`, `900_000`, `three refused`, `3 per 10 minutes`, `<= 256 char`, `Minimum 5 s between`, `46 client`, `18/18`, `G13-G18`, `row 58 (not landed)`, `only through operation 89`, `only through write-only operation 89`, `operation-89 entry written`, `reveal toggle`, `ST-1..ST-5`, `secret.fill`, `adopted fixture camera`, `three failures`, `before the body is read`: 0 hits except one — the `08` front-matter `last_updated` line, which names G13-G18 as the history of row 125 and is left as written. (Other spellings of the old values remain only in the "Spec A says / Spec B says" columns of `10` §A.4a.11 and in `11_audit_errata.md`, where they describe the disagreement the fix resolved.)
