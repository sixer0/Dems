---
task_slug: input_av_core_adapter_plan
row: 12
agent: senior-code-reviewer
date: 2026-10-12
status: complete
---

# Row 12: plan review - progress record

| Item | Value |
|---|---|
| Status | complete |
| Artifact | `verification/03_plan_review.md` |
| Overall verdict | SOUND WITH CHANGE: 2 blocking design gaps, 16 items for the implementation blueprint, 8 notes |
| Files written | `verification/03_plan_review.md`; this file |
| Files changed outside the task folder | none |
| Programs run | `ffmpeg -h demuxer=rtsp`, `-h muxer=rtsp`, `-devices` (help text only). No build, test, worker, server or migration |
| Not opened | `apps/input-av/data/`, any `.env` |
| Graft | not queried (a query refreshes the graph, which writes outside the task folder); read-only `grep` instead |

## Blocking (a design decision is missing; phase 1, WP-24 and WP-02 are not stopped)

| Id | One line | Rework row |
|---|---|---|
| P12-B1 | No path to a first `REAL_PRODUCTION` boot with production sources: the boot refuses a selector that assigns development sources (`fence/boot.ts:147-149`), the slots are NOT NULL and seeded with fakes, and production devices are assignable only in the production operation | row 8, row 13, then the plan |
| P12-B2 | The stored camera credential has no read path: the reveal function has no caller, the named module does not exist, `openSource` and `pullUrl` take no credential | row 8, row 13 |

## For the implementation blueprint

P12-F01 phase 3 and 4 completion checks cannot run before WP-13. P12-F02 WP-13 is size M, not S. P12-F03 session-start timing (15 s window, sequential open, camera absent at start). P12-F04 about twelve static rules not named. P12-F05 four contract mismatches. P12-F06 operation-count and contract pins for every new operation. P12-F07 a permission is stored data. P12-F08 HEVC and the sealed profile statement. P12-F09 WP-03, WP-06, WP-07, WP-19, WP-22 are size L. P12-F10 relay behaviour left open. P12-F11 SA-2 may have no home. P12-F12 Linux first-contact risks. P12-F13 WP-08's double. P12-F14 section 9A order and five missing checks. P12-F15 audit vocabulary as a hot file set. P12-F16 stale and missing pin statements.

## Decisions and blockers for the controller

- None taken by this row. P12-B1 changes a security control and P12-B2 crosses the write-only credential store: both need a decision row and row 13's rating before the implementation blueprint defines WP-06, WP-13, WP-19 and WP-22.
- Six statements in the report are marked HYPOTHESIS (HR-1 to HR-6): they rest on the reviewer's knowledge of FFmpeg, Linux and browsers, not on a line or a run.
- The agent's standing instruction to update `masterplan/02_plan.md` and to append to an implementation report was not followed: this task's limits forbid changing a plan document, and no implementation report exists for a plan-only task.
