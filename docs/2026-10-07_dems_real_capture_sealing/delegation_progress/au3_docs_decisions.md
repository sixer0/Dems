---
row: AU-3 (D16 independent audit)
agent: verifier
date: 2026-10-08
status: needs-review
---

# AU-3 — docs and decisions audit (delegation record)

| Field | Value |
|---|---|
| Status | needs-review (audit complete; rev 2 needs revisions before the second approval) |
| Artifact | `verification/22_audit_docs_decisions.md` |
| Mode | Read-only. No server, no test suite, no install, no commit. Wrote only this file and the report. |
| Findings | 0 Blocker, 4 Major (AU3-01..04), 9 Minor (AU3-05..14), 5 Nit (AU3-15..19) |
| Verdict | Rev 2 NOT READY as written. Ready after REV-1..REV-4 (document-only) |

## Key results

- Conformance: every predecessor requirement and 27/29 D4 answers carried correctly, with spec-line quotes. No forbidden pattern found (multitrack, two audio tracks, auto mic switch, benchmark on this Mac, media in git, reuse of `AdminResource.DEVICES`, LAN listener).
- Major: the CPU-only STT path (D222/D230; OD-24; Q-INSTALL item 1; approved rev-1 rows 10-12) has no install, conversion or CPU check in rev 2 (`02_structured.md:349`). R-5 AC-1 cannot be met on this Mac. Q-D7 leaves out the option D7(b) recorded. The capture-worker implementation form (C program vs binding) is undecided and missing from the gate list.
- Counts all verified against the code: 75 ops (27/48) -> 89 (34/55); 30 -> 39 tables; 3 CHECK sites; 17 keys; kept 8+3; permissions 12 -> 14, grants 18 -> 22; P25 12 edits / 36 anchors; errata 31; register 94; plan 44; rev 2 65. 70+ citations, 0 wrong.
- V1-V4 and V6 PASS. V5: DAG PASS, but the wave table conflicts with dependencies (rows 65, 71, 76), and rows 84/91 can bypass their gates. V7: rows 41/42 repeat work already done.
- Process: D1-D16 continuous. No commit since `2a4f4ea`, no remote. No rev-2 row executed. 2 absent artifacts (row 11 skip record cited by rev 2; row 14 deferred). Drift Log empty. Tracker rows 16 and 29 stale.

## Proposed revisions (for the controller to route)

1. REV-1 -> task-architect + test-expert + data-analyst: add the whisper.cpp install (dry-run guard first), the conversion and a `cpu-local` 2+1 check in M6; restore the CPU clause in M6-TF-1; run M6-DF-1 on `cpu-local`.
2. REV-2 -> task-architect: rewrite Q-D7 with 3 options (recommended: oMLX for development + proven `cpu-local` on this Mac).
3. REV-3 -> task-architect: add Q-WORKER (worker form) and an H-4 proof as row 58's first deliverable.
4. REV-4 -> task-architect: recompute §10 from the DAG; add gate dependencies to rows 84/91; re-scope row 41 to P-4 only; mark row 42 done.
5. Controller: Drift Log entries (AU3-11/12), tracker rows 16/29, blank lines in the decisions table.
