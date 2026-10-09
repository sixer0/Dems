---
task_id: 2026-10-07_dems_real_capture_sealing
agent: task-architect
date: 2026-10-09
row: blueprint maintenance, rev 2.2 -> rev 2.3 (Part A: routing of D70-D72; Part B: new scope D73-D76)
status: complete
proposed_class: Part A MINOR (controller confirms); Part B MAJOR (needs the approval gate, token AP3)
---

# Task-architect record: blueprint rev 2.3

## 1. Result

`identification/02_structured.md` was edited in place as rev 2.3 (902 lines). The revision has two
parts that are kept apart in the file and classified separately.

| Part | Content | Class |
|---|---|---|
| A | Owners named for work the specifications already require, plus the findings the pair reviews of rows 58 and 76 routed to later rows (D70-D72). 13 rows reworded, no row added, no Depends On cell changed, wave table of section 10 unchanged | proposed MINOR |
| B | NEW SCOPE from the user (D73-D76): R-9 camera discovery + connect flow, R-10 no-device notification, R-11 development fallback to this Mac's camera and microphone. 23 new rows 120-142; rows 69, 74, 88 gain dependencies; rows 70, 75, 89 gain check clauses; section 10.1 recomputes the levels | MAJOR |

Part B was added on the coordinator's four mid-task messages (D73, D74, D75, D76). All four
decisions are present in `decisions/decisions.md:86-89`.

## 2. Part A — what changed (line numbers of the file after the last edit)

| # | Where | Line | Change | Source |
|---|---|---|---|---|
| H | front matter | 6-9 | revision 2.3, status, `revision_2_3_note` (two parts) | this pass |
| S | section 0 | 22, 32 | heading; "Next approval" = none pending for rev 2.1 (D24) | D24 |
| L | section 0.3 | 89-126 | change log Part A (13 entries), the table of existing dependency paths | D70-D72 |
| 1 | row 59 | 311 | fsync policy stated and applied, truncate on a failed write, `FRAGMENT_CHECKPOINT` on the lossless path within the D72(j) ceiling, takes over `sink.c` under "temp name, then link"; one Verification clause | D72(b), (j), (l); D58-8; F-3 |
| 2 | row 60 | 312 | absorbs the row-58 harness behind one target with an aggregate exit code, outside `npm test`, re-run after an FFmpeg upgrade; fake mic with its own clock and stop-and-return; M3-AV-2 scoped to cases (a), (b); one Verification clause | D72(j), (l); F-4, F-14 |
| 2b | row 62 | 314 | SR-drift fake camera, case (c) of M3-AV-2, named where cap §A.8 (2) and the catalogue put it; one Verification clause | D66; `10_test_strategy.md:158` |
| 3 | row 61 | 313 | one definition of mode `real` vs the demo flag with boot refusal; worker path validated; `-PROOF` worker refused; concatenation-proof static rule; row 58's O_EXCL pin in the guard count; Verification extended | D72(a), (l); A-3, A-9, A-12, F-10 |
| 4 | row 65 | 317 | upsert must not null four columns; `AudioInputAdapter` transport replaces fixture `PCM_FIFO`; one Verification clause | D72(e), (l); A-11; D58-6 |
| 5 | row 66 | 318 | `CapturePlan` pure builder + test, device-ID subjects; one Verification clause. The row text named no plan before | D72(g), (l); cap §A.3, §B.2 |
| 6 | row 71 | 323 | "CS-07 session route" now says it wires session start/stop to `app.capture.start` / `stop` with row 66's plan; consumes capture-side fault clearing; mic disconnect; `nearBound` rework; one Verification clause | D72(h), (l); D58-7; A-2, F-5 |
| 7 | row 77 | 329 | phantom-tail clamp with a named verification; imports the media-time constant and states which audio it chunks; niceness gate outside the sandbox; sibling rule "engine lower than the capture worker" | D70, D71, D72(d) |
| 8 | row 78 | 330 | lands SH-09, W1-C5 and the DOC-05 remainder for the M6 components; one Verification clause | D70, D71 |
| 9 | row 115 | 367 | CS-22 boot step for the transcriber; op-91 endpoint validation aligned before mounting; `nicePath` / `priority` at defaults; one Verification clause | D70, D71; N-9, N-12 |
| 10 | rows 76, 58 | 328, 310 | closes lists corrected | D70, D71, D72 |
| 11 | row 57 Verification | 309 | respawn sentence scoped by option C | D67 |
| 12 | section 5.6 | 268, 275 | SH family (58 + 66 + 82 for SH-18, 48 not, SH-09 at 78) and one note line on moved closures | D65(b), D70-D72 |
| 13 | DP-2; section 10 ceiling sentences; P0; "Parallelizable work" | 595, 613, 659, 752, 767 | approval wording = satisfied (D24); ceiling = D63(d), 8 in flight, a pair = two | D24, D63(d) |
| SC | self-check | 818-831 | "Rev 2.3 re-check, Part A" | this pass |
| CL | classification | 870-886 | Part A table | this pass |

### Checks made for Part A

| Check | Result |
|---|---|
| Row 71 -> row 66 | already transitive: 71 -> 70 -> 69 -> 66. No edge added. **Section 10 wave table untouched by Part A** |
| tx §C and the sibling rule | tx §C (`07_transcript_spec.md:290`) fixes the direction "capture (ingest + mux + hash) outranks STT" and names no mechanism. Row 77 already owns the CPU-priority rule and M6-CP-1, so the sibling rule is placed at row 77. This is my reading; if the controller reads tx §C as not requiring it, the clause moves to row 115 as D71 allows |
| SR-drift fixture | the catalogue (M3-AV-2 (c)), cap §A.8 (2), cap §F and errata PE-111-01/-05 all say "row 62". Blueprint row 62 is the tablet B11 instrumentation row. I followed the catalogue and flagged the atomicity cost |
| Phantom-tail check name | no catalogue ID exists (0 hits for "phantom" / "clamp" in `10_test_strategy.md`); row 77 quotes the assertion |
| `openapi.json` and the endpoint pattern | the loopback pattern is in `packages/shared/openapi/openapi.json` (2 hits), so row 115's alignment regenerates it; operation counts unchanged. Written into row 115 |

## 3. Part B — new rows

Token `AP3` = the approval of rows 120-142 is recorded by the controller. No row 120-142 starts
without it. Every implementation row 129-142 runs as a driver + navigator pair (D63(c)).

| Row | Milestone | What | Agent | Output | Depends On | Level (10.1) |
|---|---|---|---|---|---|---|
| 120 | spec | specs R-9, R-10, R-11 | data-analyst | masterplan/01_specs.md | AP3 | L0 |
| 121 | spec | API contract delta (search, candidates, adopt, connection test, states, alert/audit types, `LOCAL_DEVICE`, op 89 before row 84, totals) | data-analyst | masterplan/03_api_contract.md | 120 | L1 |
| 122 | spec | database contract delta, migration `0008` or "no schema change" | database-specialist | masterplan/04_database_contract.md | 120, 121 | L2 |
| 123 | spec | capture architecture delta | data-analyst | masterplan/05_capture_architecture_spec.md | 120 | L1 |
| 124 | spec | evidence package delta (development-source mark) | data-analyst | masterplan/06_evidence_package_spec.md | 120 | L1 |
| 125 | spec | client UX delta | data-analyst | masterplan/08_client_ux_spec.md | 121 | L2 |
| 126 | spec | security design review delta (SEC35-23 exception, SSRF/port-scan, credential reuse, rate limit, fence, privacy) | security-review | masterplan/09_security_design_review.md | 121, 122, 123, 124, 125 | L3 |
| 127 | spec | test catalogue delta | test-expert | masterplan/10_test_strategy.md | 121-126 | L4 |
| 128 | spec gate | reconciliation of 120-127 | verifier | gateway_check/27_r9_r11_spec_gate.md | 127 | L5 |
| 129 | M4 (cond) | migration `0008` | database-specialist | implementation/60_r9_migration_0008.md | 128; row 122 specifies a schema change | L6 |
| 130 | M4 (cond) | apply `0008` to four dev databases | coder-execution | implementation/61_r9_lane_migration.md | 129 | L7 |
| 131 | M4 | WS-Discovery, probe only | coder-execution | implementation/62_r9_onvif_discovery.md | 128, 65 | L19 |
| 132 | M4 | search + candidate-list API, pre-check trigger, re-pin | coder-execution | implementation/63_r9_search_api.md | 131, 66, 130 | L20 |
| 133 | M4 | no-device alerts (search empty, pre-check unreachable) | coder-execution | implementation/64_r10_no_device_alerts.md | 132 | L21 |
| 134 | M4 | local camera helper | coder-execution | implementation/65_r11_local_camera_helper.md | 128, 60 | L13 |
| 135 | M4 | local microphone helper | coder-execution | implementation/66_r11_local_mic_helper.md | 128, 65 | L19 |
| 136 | M4 | `LOCAL_DEVICE` adapter kind + boot fence + plan | coder-execution | implementation/67_r11_local_device_kind.md | 134, 135, 66, 130 | L20 |
| 137 | M4 | web Devices delta | coder-execution | implementation/68_r9_web_devices.md | 133, 136, 142, 67 | L22 |
| 138 | M4 | tablet/phone Devices delta | coder-execution | implementation/69_r9_mobile_devices.md | 133, 136, 142, 68 | L22 |
| 139 | M5 | session-start no-camera alert (D72(k)) | coder-execution | implementation/70_r10_session_start_alert.md | 71, 133 | L26 |
| 140 | M5 | local-device session end to end | coder-execution | implementation/71_r11_local_device_session.md | 71, 136 | L26 |
| 141 | M7 | manifest + verify development-source mark | coder-execution | implementation/72_r11_manifest_dev_mark.md | 83, 85, 136 | L31 |
| 142 | M4 | connect flow (adopt, credential-gated connection test) | coder-execution | implementation/73_r9_connect_flow.md | 132, 66 | L21 |

Rows 120-142 are at lines 372-394 of the blueprint.

### Existing rows changed by Part B

| Row | Line | Change |
|---|---|---|
| 69 (M4 review) | 321 | Depends On + `131-138, 142`; areas extended; a grep that no code path authenticates without an operator-entered credential |
| 70 (M4 gate) | 322 | check list + the R-9..R-11 M4 checks; Verification + the +1 real-LAN probe ("N responders found", N = 0 ends in the R-10 notification = pass) and the refused credential-less connection test. Depends On unchanged (69) |
| 74 (M5 review) | 326 | Depends On + `139, 140` |
| 75 (M5 gate) | 327 | check list + session-start no-camera check and local-device session; states why M5 and not M3 |
| 88 (M7 review) | 340 | Depends On + `141` |
| 89 (M7 gate) | 341 | Verification + development-mode package verifies PASS with the mark |
| 66, 67, 68 | — | NOT changed; the new work sits in rows 132, 142, 137, 138 that depend on them |

Gate choice for local-device capture: **M5 gate (row 75)**, not the M3 gate. A local device enters
through the adapter layer (row 65), which starts after the M3 gate (row 64), and an end-to-end
session needs the session-to-supervisor wiring of row 71. Helpers, the adapter kind and the boot
fence are verified at the M4 gate.

### Section 10 with AP3

Section 10.1 (line 661). Levels L0-L22 keep every existing row and add the new ones; from row 69 on
every existing row moves by exactly +2 levels (69: L21 -> L23 ... 101: L42 -> L44); 45 levels,
acyclic. Without AP3 the rev-2.1 wave table stands. L20 is exactly at the ceiling (4 paired rows);
L26 would be 9 agents and is released in two steps.

### Other places updated for Part B

Row conventions (token `AP3`, new output paths), section 0.3 "NEW SCOPE (D73)" block (line 128),
section 5 completion line, section 6 (one row), section 7 (R-9, R-10, R-11), section 8 (two rows),
section 9 (note on C-1 / H-7), G-4 (line 575), Dependencies DP-11..DP-14 (line 604), risks
RK-33..RK-39 (line 726), P0 (line 753), agent mapping (line 783), self-check Part B (line 833),
classification Part B (line 888).

## 4. G-4 — recorded as ANSWERED

| # | ID | Answer in force | Source |
|---|---|---|---|
| 1 | Q-DISC | tests on the fake ONVIF stub on loopback; real LAN probe only on an operator action (search button or operator-started pre-check), never at boot or in the background; agents may probe this Mac's current network, probes only, no authentication, no configuration change, identifying results only in `.data/` / `.cache/`, real-LAN check 2 + 1 with "N responders found" and N = 0 a valid pass through the R-10 notification | D74 (1), D75 |
| 2 | Q-DEV-FILL | camera 1 = this Mac's camera, camera 2 = fake; mic 1 = this Mac's microphone, mic 2 = fake; Desk View not used | D74 (2) |
| 3 | Q-DEV-PRIVACY | local recordings only under git-ignored `.data/`; the user answers the macOS permission prompt; no agent touches the permission database or system settings | D74 (3) |
| 4 | Q-CONNECT | a search yields a list only; every connectivity action is operator-initiated and credential-gated through write-only operation 89; no default, guessed or reused credential; agents never type, store or receive a real camera credential | D76 |

No genuine further question for the user. Open is the approval of the row set itself (AP3).

## 5. Classification

| Part | Class | Basis |
|---|---|---|
| A | proposed MINOR | no new scope, agent, module, edge or wave; effort in the order of 5 % of the remaining rows (estimate). Single rows grow more: 62 roughly doubles, 71 about a third, 60 and 61 a quarter to a third, 59 / 66 / 77 / 115 about 15-20 %, 65 / 78 under 10 % |
| B | **MAJOR** | new scope (3 requirements), new modules (discovery adapter + npm dependency, two helper processes, adapter kind, new operations and audit types, possibly migration `0008`), flow restructured (+2 levels from row 69, three rows gain dependencies), bounded exception to OD-13 / SEC35-23, completion line grows. 23 rows against roughly 50 still to run: +45 % by count, an estimated +25-35 % by effort (9 of the 23 are spec or gate rows). Not sized by a spike |

## 6. Items for the controller

| # | Item |
|---|---|
| C-1 | Part B needs the approval gate. D74-D76 answer design questions; they do not approve rows 120-142 |
| C-2 | Row 62 now mixes the tablet instrumentation with a C-side RTCP fixture because every spec document says "row 62". Alternative: move the fixture to row 60 after a test-expert erratum |
| C-3 | Row 71 is the broadest remaining row. A split is a new row, so no longer MINOR |
| C-4 | D70 says the DOC-05 remainder goes to "rows 77/78"; the brief put it at row 78. Row 78 carries both entries (Silero VAD, sherpa-onnx) |
| C-5 | My reading of D75 "this network": the network the Mac is on today; elsewhere the real-LAN check is recorded "not run". Not written into row 131; stated in G-4. Confirm or correct |
| C-6 | My reading for R-11: a development-mode package may be sealed and verifies PASS with the mark reported (row 141). Confirm or correct |
| C-7 | DP-14: whether operation 89 can hold a camera credential before row 84 is not known to me. Row 121 must state it; if it needs the sealer, real-camera connection waits for row 84 |
| C-8 | Whether the shared endpoint pattern's mirrored table CHECK should also be tightened (pair-76 R3.8) is not in row 115; that would be a migration and a ruling |
| C-9 | Pair-review findings that have a suggested heir but were outside the twelve edits of this brief, so not written into any row: A-5 / A-10 (record consumer bound and content validation, rows 59 / 82), F-12 (last telemetry, row 59), F-2 (4) (boot pin of the libavformat version, row 61), F-6 (camera wall-clock sanity bound, row 62 / class C), F-7 (PCM tap closes on first `EAGAIN`, rows 76 / 77), A-15 (ingest-state hysteresis, row 66), D-5a (`sinceMs` on the frame, row 71), pair-76 R-2 (static rule residue, row 77) |
| C-10 | Facts I did not verify: the avfoundation device list and "no install needed" (coordinator's measurement); the ONVIF npm package is not named here (row 123) |
| C-11 | Still in the tense of 2026-10-08 by design: row 48's Task Description names SH-18; the "Gate Questions (rev 2.1)" heading; the first paragraph of "Change Classification"; the "Immediate next step" bullet |

## 7. Checks run after the last edit

| Check | Result |
|---|---|
| 7 cells in every row | Grep, pattern accepting only 8 unescaped pipes on a row line, steps 41-142: 102 of 102 |
| Row lines present | 102 (79 existing + 23 new) |
| Dependencies | every number names a row in 41-142; tokens `AP3`, "row 122 specifies a schema change"; levels in section 10.1 strictly increasing along every edge |
| Output paths | `implementation/60-73`, `gateway_check/27` unused before; eight masterplan files refreshed once each |

## 8. Files

| File | Action |
|---|---|
| `identification/02_structured.md` | updated in place (rev 2.3) |
| `delegation_progress/task_architect_rev_2_3.md` | created (this file) |

Not written, by the parallel-run rule: `delegation_progress_report.md`, `status_tasks.md`.
