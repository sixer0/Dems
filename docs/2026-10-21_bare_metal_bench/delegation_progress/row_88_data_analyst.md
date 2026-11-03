# Row 88 - data-analyst - R-FLEX audio functional delta

- Status: complete
- Date: 2026-10-22
- Output: masterplan/01_specs_rflex_audio.md
- Read-only on the repo; no code, host or git writes. Names only from 01_specs_rflex_register.md; no file request needed.

## Decisions
- RQ-A1 DECIDED: option (d), USB id + serial, else any unit of the model; PORT_DIFFERS removed from both matchers; usb_port kept as information only; no runtime write. Registration refusal predicate becomes "USB id is the replacement word".
- RQ-A3 DECIDED: a service check in the op 99 unit (READ_BOUND_AUDIO_INPUTS), run inside the existing listing gate, because units are READ COMMITTED (core/unit-of-work.ts:8,56). Op 98 computes `boundTo`/`registered` by identity, not by key (fixes the macOS usb_<port> case). Reads gain a `retired_at IS NULL` filter. DB-A1 is optional (row 91).
- RQ-A4 DECIDED: a port move is not a re-bind (REENABLED, same MIC; macOS key refreshed). An op 99 re-bind moves the holding MIC to the new input (RELEASED + REENABLED audits). Retire is rejected: the engine does not model retirement (db/mapping/rows.ts:891-895). A selector-line move clears the old line (CAPTURE_CONFIG_CHANGED). AU-X1/DB-A5 are not used.
- RQ-A2: put to the user (Q-R2), recommendation (i)+(iii).

## For row 96
- Q-R1 (a) physical card; Q-R5 (C) both readings. Key finding: the bench BOMGE has 1 input, so an op-99 re-bind cannot happen on the bench, and row 126 can only run under the selector-line reading. Q-R2 (i)+(iii); Q-R3 keep usb_port, rows with neither serial nor port count as "no serial".

## Open checks for code rows
- T-13: does op 78 accept the mic clear-then-fill edit (shown for cameras only, routes.ts:76-84)?
- H-3: does the Linux card id stay the same across a port move?
