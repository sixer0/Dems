---
task_id: 2026-10-07_dems_real_capture_sealing
date: 2026-10-09
agent: task-architect
pass: blueprint maintenance rev 2.3 -> rev 2.4
status: needs-review
files_updated: identification/02_structured.md
files_created: delegation_progress/task_architect_rev_2_4.md
proposed_class: MINOR (three cautions; the controller confirms)
---

# Task-architect record — blueprint rev 2.4

## 1. Status

**needs-review.** The edit is complete and the file is internally consistent by the checks I could make
without a shell. It is "needs-review" and not "complete" for three reasons: the controller's re-check
command is the check of record and I cannot run it; one row (115) now carries a point the controller
must rule on; and I did not verify the execution state of rows 59-62 that received new clauses.

Files touched: `identification/02_structured.md` (edited in place, now rev 2.4) and this record. Nothing
else was written. No spec file, tracker, decision file or code file was touched.

## 2. What was read

- `identification/02_structured.md` rev 2.3: front matter and sections 0-5.6, table rows 41-89 and
  111-142, G-4, Dependencies, sections 10 and 10.1, Verification, Risks, Recommendation, the self-check
  and the classification. **Not read: table rows 90-110** (not edited; their pipe count is covered by
  the 102-of-102 search below).
- `gateway_check/27_r9_r11_spec_gate.md`: sections 1, 2.1, 2.2 (first rows), 4, 5 and 7.2-7.3. Sections
  2.3, 2.4, 3, 6, 7.1, 7.4, 7.5 and 8 were not read.
- `decisions/decisions.md` rows D84-D91 in full. D80-D83 were not read; their content is used only as
  the gate file quotes it.
- `pair_58_navigator_a.md` RC-2 (R-1..R-8), `pair_58_navigator_b.md` re-check table (R-1..R-8) and its
  carried-findings lines, `pair_77_navigator.md` section 2 (N-4..N-17), the "What row 115 must pass"
  paragraph and section 5.
- `test_expert_row127.md` section 5 was **not** read: the gate file section 5 states that it corrects
  it, and the gate text was used as given.

## 3. BP edits — applied 34 of 34 (plus the two "no edit" entries left alone)

Re-check from the task folder with `grep -c -F -- '<pattern>' identification/02_structured.md`.
Mode A = count must be 0. Mode P = count must be >= 1. "Line" is the line of the row or place in the
file as it stands now (table rows 41-142 are lines 373-474).

| Gate ID | Row / place | Mode | Pattern (fixed string) | Line where the required text stands | My search result |
|---|---|---|---|---|---|
| BP-128 | 128 | A | `each gap routed to its owning author and re-checked` | 460 | 0 hits |
| BP-129 | 129 | P | `` `M4-MT-9` (2 runs `` | 461 | hit at 461 |
| BP-130 | 130 | P | `` `M4-DB-APPLY-1` passes `` | 462 | hit at 462 |
| BP-131 | 131 | A | `plus reading the responders' unauthenticated device information` | 463 | 0 hits |
| BP-132 | 132 | A | `pins equal the C3 totals of row 121` | 464 | 0 hits |
| BP-133 | 133 | P | `` `M4-NODEV-A-1` and `M4-NODEV-B-1` 2 runs each `` | 465 | hit at 465 |
| BP-134 | 134 | A | `` the helper's listener is on `127.0.0.1` only `` | 466 | 0 hits |
| BP-135 | 135 | P | `` `M4-LOCAL-MIC-1` 2 runs `` | 467 | hit at 467 |
| BP-136 | 136 | P | `` `M4-SEC-FENCE-1` (the five boot refusals `` | 468 | hit at 468 |
| BP-137 | 137 | P | `` `M4-CONN-ABANDON-W` `` | 469 | hit at 469 |
| BP-138 | 138 | A | `the connect flow for the roles and clients row 125 allows` | 470 | 0 hits |
| BP-139 | 139 | P | `` `M5-NODEV-C-1` 2 runs on fakes `` | 471 | hit at 471 |
| BP-140 | 140 | P | `` `M5-LOCAL-CLAP-1` once with the user present `` | 472 | hit at 472 |
| BP-141 | 141 | P | `` `M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1` and `M7-SEC-SRC-2` 2 runs `` | 473 | hit at 473 |
| BP-142 | 142 | A | `takes its credential only from the write-only operation 89` | 474 | 0 hits |
| BP-70 | 70 (gate) | P | `the 43 M4 checks` | 402 | hits at 402 and 173 (change log) |
| BP-75 | 75 (gate) | P | `` the record of `M5-LOCAL-CLAP-1` read, not repeated `` | 407 | hit at 407 |
| BP-89 | 89 (gate) | P | `verify runs 15 checks` | 421 | hits at 421 and 175 (change log) |
| BP-60 | 60 | P | `ST-4 removed` | 392 | hits at 392 and 176 (change log) |
| BP-61 | 61 | P | `` only reader of `DEMS_CAPTURE_DEV_SOURCES` `` | 393 | hit at 393 |
| BP-65 | 65 | P | `` `M4-MT-12` (upsert half) `` | 397 | hit at 397 |
| BP-66 | 66 | P | `` with row 71 the four `session_capture_sources` rows `` | 398 | hit at 398 |
| BP-67 | 67 | P | `` `M4-SEL-W` as amended `` | 399 | hits at 399 and 180 (change log) |
| BP-68 | 68 | P | `` `M4-SEL-T` and `M4-SEL-P` as amended `` | 400 | hits at 400 and 181 (change log) |
| BP-71 | 71 | P | `` `M5-SRC-REC-1` passes `` | 403 | hit at 403 |
| BP-83 | 83 | A | `120-field manifest` | 415 | 0 hits |
| BP-84 | 84 | P | `` `M7-CONN-CRED-1` passes `` | 416 | hit at 416 |
| BP-85 | 85 | P | `` V-15 and the `sources` block of the result are added by row 141 `` | 417 | hit at 417 |
| BP-86 | 86 | P | `the P1 cells assert a failed start` | 418 | hit at 418 |
| BP-121 | 121 (closed) | P | `Erratum rev 2.3.1 (D80(7), D81)` | 453 | hit at 453 |
| BP-125 | 125 (closed) | P | `Erratum rev 2.3.1 (D80(3))` | 457 | hit at 457 |
| BP-X1 | section 0.3 R-9 line; G-4 item 4 | A | `which travels only through the write-only operation 89` | 135 and 664 | 0 hits |
| BP-X2 | row 69; RK-38 | A | `` migration `0008` if any `` | 401; RK-38 near 813 (line computed, not searched) | 0 hits |
| BP-X3 | DP-11, DP-13, DP-14 | A | `the row set of rev 2.3 Part B has not been approved` | 684, 686, 687 | 0 hits |
| BP-115 | 115 | — | no edit asked | — | not touched by a BP edit |
| BP-117 | 117 | — | no edit asked | — | not touched |

How these results were obtained: the file search tool (ripgrep), one alternation of the 10 mode-A
strings (0 matches in the whole file) and one alternation of the 24 mode-P strings (lines above). I
escaped the strings as regular expressions; the controller's `grep -F` run is the authoritative one.

Five mode-P patterns also occur in the new change log (section 0.4). Each has its own hit on the row
line, so the row is not masked — but a count of 2 is expected for those five.

**Places where I had to choose how to join the required text** (the gate writes "..." or "rest
unchanged"):

1. Row 131 Task: the new sentences stand directly before "the adapter has NO authenticated call"; the
   old sentence "ONVIF npm dependency per Q-INSTALL item 6 (D4), this row is the sole lockfile writer"
   stays after it.
2. Row 134 Task: the phrase "in front of the worker's unchanged stream-copy ingest" is gone; the gate's
   sentence replaces it.
3. Row 136 Task: the added sentence stands after "(D74; Desk View is not used)".
4. Row 133 Task: the added sentence stands after "(D72(h) pattern)".
5. Gate 70 Verification: the rev-2.3 AP3 clause is kept and the new clause is appended, as the gate says
   "append". The cell therefore says "identifying results stay in `.data/`" twice.
6. G-4 item 4: joined with a dash; the sentence is a little awkward.
7. The two dated notes are labelled "Erratum rev 2.3.1" as the gate requires, although this pass is
   rev 2.4.

## 4. Carried findings placed (Task Description only; no Verification cell changed for these)

| Row | Line | Finding | Source | Was it already in the row? |
|---|---|---|---|---|
| 71 | 403 | Fault lifecycle R-1..R-4 | D84; navigator A RC-2 | no — added |
| 71 | 403 | The four rules for D72(k) | D84 | no — added by BP-71, nothing extra |
| 71 | 403 | Microphone pinned at ±5,000 ppm is reported | D85; navigator B R-3 | no — added |
| 65 | 397 | Mic transport states the ±5,000 ppm range and bounds lateness | D85; navigator B R-3 | no — added |
| 59 | 391 | R-5 two tests; R-7 protocol version; `.part` hard link; log quota per source | D84, D85 | no — added (four clauses) |
| 61 | 393 | Static-rule evasions; libavformat version pin | D84 R-6, D85 R-8, D85 | no — added; the row had the O_EXCL pin and the concatenation rule only |
| 62 | 394 | `nearBound` per-camera baseline; camera wall-clock sanity bound | D85 (R-2, F-6) | no — added. Row 71 already says "reworks `nearBound`" (rev 2.3); the two rows now both name it, as D85 routes it to "row 62 / class C" |
| 79 | 411 | N-7 `failedChunks` over-count | D90 | no — added |
| 81 (gate) | 413 | N-13 M6-DF-1 +1 against `recording_fragments` | D90 | no — added to the Task cell |
| 80 (review) | 412 | N-15 limits of the transcriber static rules | D90 | no — added |
| 115 | 447 | N-17 torn checkpoint; composition values | D90; pair-77 section 3 | no — added |

Row 78 (line 410): labelling approach per D90 and the row-77 fixes N-1, N-2, N-5, N-6, N-9, N-10, N-11
plus temp-audio hygiene. Its Verification cell gained three clauses (reason shown with UNAVAILABLE; 0
code paths load the Rev model; lost tap ends PARTIAL and no engine or session audio is left after a
kill). I did not state which runtime computes the CAM++ embedding: D90 does not say.

## 5. Points the controller must decide or know

1. **Row 115, `priority`.** The navigator's list for row 115 names `priority: 'required'`. The row's
   rev-2.3 clause (D70/D71, pair-76 R3.8) says it "leaves `nicePath` / `priority` at their defaults".
   D90 does not settle it. I wrote both into the row with the sentence "the controller rules before the
   row starts". A row should not carry an open choice; one line from the controller removes it.
2. **Execution state of rows 59-62.** New clauses went into rows 59, 60, 61 and 62. I did not verify
   which of them are open, in flight or closed (`status_tasks.md` shows row 60 as launched; D85 released
   it). A clause added to a closed row is fix-round work that the controller routes.
3. **Wording I authored for the carried findings.** The decisions name the findings in a few words.
   The clauses take their fix from the navigator's "suggested fix" column (for example "buffer held
   near the level to keep", "per-camera baseline learnt at session start", "counts and places every
   creating call"). They are suggestions of the navigators, not rulings. Row 61's clause leaves the
   navigator B alternative open ("or the rule is stated as a tripwire with its limits").
4. **`.part` hard link and log quota.** D85 routes them to "rows 59/61/82". The brief put both at row
   59. Row 82 (recovery) is not edited and has no clause about `.part` names.
5. **Findings named in the decisions that this pass did not place** (not in the brief's list): D84 R-8
   `tapActive` (owner "row 77 with row 71" — the row-71 half has no clause); D85 navigator B R-1, R-7,
   the ±100 ppm case and F-14 (owner row 60 — not checked against row 60's text beyond what rev 2.3
   wrote); D85 F-7 pipe-tap end handling (row 77).
6. **Rows 133 and 142 share level L21 and both re-pin `openapi.json`.** Row 133's intermediate pins hold
   only if it lands before row 142. I wrote this as a note under section 10.1, not as a dependency.
7. **Heavy-host lock: the list of rows is my reading.** D90 gives the rule by kind of job. The row list
   in section 0.4 is derived from the row texts and is marked as such.
8. **Check IDs.** Copied from the gate file. I searched 12 of them in `masterplan/10_test_strategy.md`
   (44 hits in total, so at least some exist); the rest were not searched, and that file is being edited
   by the parallel fix pass.

## 6. Depends On, sections 10 and 10.1

Three Depends On cells changed in text only: row 129 (`128`), row 132 (`131, 66, 130`), row 136
(`134, 135, 66, 130`). No edge was added or removed. Every reference names an existing row. No level
moves, so **the wave tables of sections 10 and 10.1 were not changed.** One paragraph "Rev 2.4 notes" was
added under the section 10.1 table (line 778): no edge change, pairing off, the release rule for rows
129 / 131 / 134, the 133 / 142 order, the heavy-host lock.

## 7. Format check

- 102 of 102 row lines for steps 41-142 have exactly 8 unescaped pipes (search with a pattern that
  accepts only that shape, run after the last row edit). No row added, removed or renumbered.
- No Agent_to_Invoke and no Expected Output cell was changed: where a replaced span crossed those cells
  they were carried over unchanged.

## 8. Classification

Proposed **MINOR**, table and three cautions in "Change Classification — Rev 2.4" (line 1007 of the
blueprint): (1) row 78 may make speaker labels UNAVAILABLE in practice — inside D226's wording, but
worth one line to the user if they have not seen D90; (2) rows 71 and 78 are broad and a split would
be a separate revision; (3) the spec fix pass runs in parallel, so a late change there needs the cells
here to follow.

## 9. Leftovers not edited, by instruction

Listed in the last row of the rev-2.4 re-check in the blueprint: the stale `cond` prefix of rows 129 and
130 and the "unless row 122 states no schema change" remark in section 5; "conditional on row 122" at
the end of RK-38; the pair-counting sentences of section 10 and the L20 / L26 cells; three places that
still call AP3 pending (Summary "Next approval", P0 (rev 2.3), "Rev 2.3 next step").
