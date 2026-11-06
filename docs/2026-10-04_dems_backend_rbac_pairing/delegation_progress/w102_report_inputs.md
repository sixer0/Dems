---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W102 (blueprint 117), report inputs
agent: data-analyst (tier R, no override)
date: 2026-10-07
status: needs-review
---

# W102: progress file

## Result

- **Report:** `report/01_report_inputs.md` (Tier 1; sections SC outcome, decision-log integrity, open items, host state, ledger, agent/model notes; Appendices A-C).
- **Status:** `needs-review`. SC9 closes after the controller rules on section 2.6 of the report: one D257 entry accepting, by reference, the decision requests and deviations that are not recorded by ID. This row may not edit `decisions.md`.

## Key figures

- `decisions.md`: D1-D256 (256), DR-01-DR-14 (14), F1-F79 (79). No gaps, no duplicates. DR rows are stored as DR-01, then DR-14 down to DR-02 (cosmetic). 165 task-file references, 0 missing.
- Row logs scanned: 338. All are tied to a gate entry.
- Decision requests: 783 defined; 518 quoted by ID in the row's own gate. **23 unique items confirmed unrecorded** (11 of them W41 DN-n; all Low or Info). **93 unique items not confirmed one by one** (Appendix A).
- No plan drift is missing from the DR log. D220 calls itself drift but is a next-phase requirement change.
- Deviations: 663 in 100 logs. For 50 logs the gate entry never mentions deviations (Appendix B).
- Row-local findings: 796 in 88 logs. For 20 logs the gate never mentions findings (Appendix C; mostly converted to DN items).
- Open items: 43 distinct items, 0 blocking. (a) 6, (b) 17, (c) 9, (d) 11.
- Host state matches plan section 14 and W90. New and unregistered:
  - N-1: adb reverse `tcp:8081` on 5554, 5556 and 5558
  - N-2: five orphaned `adb logcat` processes (PIDs 58999, 2673, 5928, 6550, 8932)
  - N-3: 55 per-row `.cache/` scratch folders (about 1.25 GB), outside RB-17
  - N-4: `.cache/manual/`
- Accountability trail: no rows for about 22 delegations after W97, incl. the T1 and T2 sonnet overrides.

## Commands run (all read-only)

- Python scripts over `decisions/decisions.md` and the row logs (scratchpad `.../scratchpad/w102/xcheck*.py`, outside the repo).
- In the sandbox: `date`, `uptime`, `git log`, `git status --porcelain`, `git remote -v`, `git ls-files --others [--ignored]`, `ls`, `du`, `stat`, `lsof -nP -iTCP -sTCP:LISTEN`.
- Outside the sandbox (`ps` and `adb` are refused inside it):
  - `ps -axo pid,ppid,user,lstart,command` (filtered)
  - `adb devices -l`
  - `adb -s <serial> reverse --list` and `adb -s <serial> emu avd name`, for 5554, 5556 and 5558

## Rules held

- No tracked file was edited; no process was started or stopped.
- `.data/pg.*` were never read or printed; the names were counted and withheld.
- Files written: this file, `report/01_report_inputs.md`, and one appended row in `delegation_progress_report.md`.
