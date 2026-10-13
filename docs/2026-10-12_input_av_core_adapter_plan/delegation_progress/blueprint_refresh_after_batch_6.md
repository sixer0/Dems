---
task_slug: input_av_core_adapter_plan
agent: task-architect
date: 2026-10-13
state_of: 2026-10-13 05:35 (last update of delegation_progress/file_ownership.md)
status: needs-review
edited: identification/03_implementation_blueprint.md (targeted edits; no row renumbered, no column added)
---

# Blueprint refresh after batch 6

Design only. No application file was opened for writing, no command was run. Counts are hand counts.

## 1. Step numbers changed

| Step | Change |
|---|---|
| 41, 42, 43, 44, 46, 59, 86, 88 | mark "relay client = CANDIDATE (a); the user rules between (a) and (c)". Rows 41 (done), 42 and 46 (in flight) carry the mark only |
| 35 | scope text and dependencies: + 180:B, 187:B; reads C36 (no import of the simulator's default profile; the six scripted edits) |
| 60 | scope text and dependencies: + 182:B, 186:B, 188:B |
| 73 | scope text and dependencies: + 184:B, 185:B, 190:B, 191:B (191 met by its skip record if it does not run) |
| 85 | dependency + 190:C |
| 86 | scope text (C34, C37, C39) and dependencies: + 186:B, 188:B |
| 88 | dependency + 190:B; does not start before the ruling on C38 (section 9.2 condition 7) |
| 131 | dependency + 181:B |

## 2. Step numbers added

| Step | State | One line |
|---|---|---|
| 180 | done, 6e6707dd | kill guard in the two existing process doors (controller's row, written out) |
| 181 | open, held | procedure consistency pass over the frame and three chapters, 12 fixed items (controller's row, written out) |
| 182 | done, 3b388746 | protocol reason members for the gate's refusals (controller's row, written out) |
| 186 | done, 3b388746 | relay client hardening, fixes F-1 to F-9 on candidate (a) (controller's row, written out) |
| 184 | new, S, test-expert | measure the microphones of a session across a worker restart; draft the rule for a production audio opener; deps 67:B, 179:B |
| 185 | new, S | shared: the INTERNAL action that adds and re-enables a `USB_AUDIO` microphone in the registry; deps 63:B, 70:C |
| 190 | new, M? | server: the microphone registrar handed to the audio-cards module, so that operation 99 stops answering 503; deps 185:B, 70:B; before 88 (B) and 85 (C) |
| 187 | new, S | Core: operation 78 refuses a production-kind camera in an empty slot without a profile of its own (C36 (1)); deps 29:B, 162:B, 17:B |
| 188 | new, S | Core pairing: a report for a superseded attempt is dropped; one notice, not two (C37, C40 (2)); deps 46:B, 48:B, 179:B, 182:B, 71:B |
| 191 | new, M?, conditional on 184 | session: microphones started again for a later worker; deps 184:B, 67:B, 188:B |

Not used: 183 (never issued), 189 (no row: row 125's chapter already carries the first-open sample and the silent-audio rule, `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md:466, 478, 488, 504`; row 67 had no record yet).

## 3. Sections added or extended in the blueprint

`Row status at 2026-10-13 05:35` (after the Execution Profile); 8.2 (totals, remaining path, measured pace, duration, cost of the outcomes of C38); 9.2 entry conditions 7 and 8; 11.5 (C34 to C40); the X-1 and X-2 paragraph of section 12; decisions 15 to 21 of section 13; section 14 (23 paths verified in this pass); section 16 (refresh lines).

## 4. New totals

| Measure | Count |
|---|---|
| Rows | 189 |
| Done / in flight / skipped / open | 79 / 14 / 2 / 94 (held 10; conditional and pending 4: 34, 56, 57, 191) |
| Size S / M / L | 113 / 76 / 0 |
| Model opus / sonnet / not delegated | 170 / 18 / 1 |
| Still to run | 108 rows: S 58, M 50 |
| Levels | 19 in the design; 15 remaining from the rows in flight |
| Identifiers carried | 87 of 87; controller rulings carried 10 (C23, C24, C25, C34 to C40) |

## 5. Remaining duration (estimate)

Basis: 63 rows landed in 385 clock minutes (23:10 to 05:35), 9.8 rows per clock hour; per batch 9.2 (batch 3), 16.6 (batches 4 and 5), 7.5 (batch 6). Critical levels measured at 15 to 109 minutes each.

| To | Clock hours of controller-run time |
|---|---|
| Gate M3 (row 61) | about 4 to 8 |
| The lift committed (row 93) | about 9 to 17, plus the wait for the user's ruling on C38 and for the container-runtime decision |
| Close (row 140) | about 13 to 24 |

Uncertainty about 40 % either way. Outcome (c) of C38 adds about 4 to 8 hours and four rows (about 2 M + 2 S).

## 6. For the controller to decide or confirm

1. Ask the user C38 now ((a) or (c)): row 88 waits for it.
2. X-1 and X-2: the user's scope decision; without them 21 of the 27 hardware checks cannot run.
3. Row 12 is on the path to gate M3 (12 -> 14 -> 34 or 57 -> 59 -> 61): run it at the next quiet point, not at the gate.
4. Row 188 is a row of its own and was not folded into rows 43 and 44 (they own the relay source and a test run, not the Core's pairing file).
5. Splits beyond the numbers asked for: 190 (server half of 185) and 191 (conditional build behind 184).
6. Row 187: in which operations the refusal applies (the executor states it against C36 (1)).
7. Row 135 is held without a recorded reason.
8. Batch 7: the brief lists 14 rows, the status file says 15.
9. Row 76: its landing line and commit are not in the ownership file (7969f0fa or b7ed4c60).
