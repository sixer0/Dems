# Row 60e - fifth reading pass of the phase-3 code review

- **Agent:** senior-code-reviewer
- **Date:** 2026-10-14
- **Status:** needs-review (lists C and D read in part; five named gaps in list A)
- **Reviewed:** commit `1fbeada7`, from an export of the commit (the working tree is being edited)
- **Verdict:** PASS WITH FOLLOW-UPS - blocking for the lift: 0; follow-ups 17; notes 4
- **Artifact:** `verification/060e_m3_review_fifth_pass.md`

## What was done

Read-only review of the product code of rows R1, R1b, R2, B1 (call sites), B2, V6, V6b, 143c, 85d, 106 / 106b / 106c, 111 / 111b, 108, 117, of the discovery product files, and in part of the live source and the tablet selector. Nothing was run; no source file was changed.

## For the controller

- **Lift (row 88), to tick:** E-01 (the Core states `LIVE` for an enabled camera: `capture-config/slices.ts:125, 163-164` - the source of Q-05), E-02 (one more fail-open optional member, `onvif-relay.ts:305`; S-03 unchanged at head), E-03 (the camera watch keeps loss state across sessions), E-05 (V6b's guard is missing in `onvif-session.ts:638-646, 705`), E-18 (M2 F-02 in the lift's context).
- **Before M6:** E-04 (watch and session disagree on a re-open after a skipped line), E-06 (a retried absence entry makes the manifest refuse the session), E-07 (the "last attempt" is inferred from audit rows).
- **May wait:** E-08 to E-15, E-17, notes E-16, E-19, E-20, E-21.

## Not read, to be stated as unread

`capture/host-alias/caller.ts`, `protocol.ts`, `store.ts`; `stored-address.ts` and `stream-probe.ts` as changed since pass 1; the courses of `onvif-session.ts`; about 1,850 unchanged lines of `capture-session/index.ts`; `live-sim.ts` but for a search and five ranges, and nine other files of the live source; eleven files of the tablet's `capture-selector/`; the implementation records of the rows (none was opened).

## Decisions and blockers

None taken, none met. No tracking file and no `decisions.md` was written.

## Files written

- `docs/2026-10-12_input_av_core_adapter_plan/verification/060e_m3_review_fifth_pass.md`
- `docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/row_060e.md`
