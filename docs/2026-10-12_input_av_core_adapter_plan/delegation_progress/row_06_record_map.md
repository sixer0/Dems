# Row 6 progress: record-keeping map (data-analyst)

| Field | Value |
|---|---|
| Row | 6 |
| Agent | data-analyst (reasoning tier, per the Execution Profile) |
| Date | 2026-10-12 17:40 |
| Status | complete (lines for Q3, Q6, Q8, Q10 provisional, as the blueprint allows) |
| Artifact | `research/03_analysis_record_map.md` |

## Verification criteria of the row

| Criterion | Result | Where |
|---|---|---|
| Every record of step 3 appears once with one outcome | 121 units: 45 OWNED_BY_CORE, 63 DROPPED, 13 GAP_IN_CORE; tallied by grep and awk over the tables, no duplicate identifier; reconciled against every section of row 3 | sections 3, 4, 5 |
| Closing count "record kinds with two owners after the port" equals 0 | 0, with five conditions (TC-1 to TC-5) and the cases that make it non-zero | section 10 |
| Each of the four tools has a line | Four lines; none writes "no record the Core owns" as built; each names what must move or go | section 8.1 |
| Existing data tied to Q3 | One line, marked waiting; folder not opened | section 9 |

## Limits observed

- No source file modified (U3). Nothing under `apps/input-av/data/` opened, listed or stat-ed. No `.env` read. input-av not started.
- Files written: `research/03_analysis_record_map.md`, `delegation_progress/row_06_record_map.md`. Nothing outside the task folder.
- Source lines opened read-only to settle doubts are listed in section 13 of the artifact.

## Milestones

- Map of 121 records in nine groups (tables and settings keys, 53 audit call sites, token material, environment, files, external state, installer, scripts, deploy).
- The 13 gaps consolidated into six (G-1 to G-6); nine field-level items (FG-01 to FG-09) for rows 7 and 8.
- Tool table with the outcome under each answer to Q10.

## Decisions for the controller to record

1. Reading used for the count: an "owner" is the system that writes a record after the port; a frozen archive is not an owner (assumption AS-1). Under another reading the count for sessions, evidence and audit depends on Q3.
2. The blueprint fixes three outcomes. Tool-local working state (alias list, factory parameters) is placed under DROPPED with Q10 named, not under a fourth outcome.
3. `cameras` is split into three units and the `site` settings key into six, so that no line carries two outcomes.

## Findings for the controller to route

1. None of the four tools satisfies C13 as built. "Keep as a tool" (Q10) means changing input-av code: for rows 8 and 9.
2. All four tools sit behind the input-av API and its own users; a kept tool keeps a second user base unless it gets another entry: for rows 8 and 13.
3. The wizard stores a camera password in plain text and set camera IP receives one in its request (`nvr/registration.py:62-64`, `nvr/routers/devices.py:81-99`): for row 13.
4. Running the doctor, the meter or the application from the source tree writes into the folder of the existing data: the data directory defaults to `data` (`nvr/config.py:11`) and the doctor's `init_db()` can issue `ALTER TABLE` (`nvr/db.py:254-264`). Derived from the code, not observed: for rows 9, 10, 13 and for Q3.
5. Dropping the playback copy leaves the question of how sealed H.265 is played in a browser (risk R-3): for row 7.
6. Reconnect as numbered, separately hashed files has no place in the Core's track key (FG-07): for rows 7 and 8.
7. G-6 (no operation creates an operator) existed before this task (D241) and is not a work item of the port.

## Blockers

None.

## Not verified

The exact detail keys of the Core audit types; whether `capture_devices.profiles` can express a dual-lens grouping; where the Core sets its storage thresholds; any content of `apps/input-av/data/`.

## Note on instructions

The agent's base instructions say not to write report files; the delegation and the Documentation Contract require these two artifacts. The delegation was followed.
