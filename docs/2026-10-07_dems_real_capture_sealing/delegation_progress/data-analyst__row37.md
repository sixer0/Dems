# Row 37 progress — data-analyst

Date: 2026-10-07
Agent: data-analyst-local
Row: 37 [M0|B, tier 1] Write the implementation plan.
Output: `masterplan/02_plan.md` (this row's only product) + this progress file.

## Status: DONE

## What was done

- Read the full spec suite before planning: rows 28-36 (`01_specs.md`, `03_api_contract.md`,
  `04_database_contract.md`, `05_capture_architecture_spec.md`, `06_evidence_package_spec.md`,
  `07_transcript_spec.md`, `08_client_ux_spec.md`, `09_security_design_review.md`,
  `10_test_strategy.md`), the register (`research/03_analysis.md`), `decisions/decisions.md`
  (D1-D14), and `status_tasks.md`.
- Used the **post-remediation** row-29 numbers (89 ops / 34 GET / 55 POST / 14 new ops / 24 modified /
  62 audit types / 40 error codes / slices 28->30 / 0.3.0 + offline 0.2.0), not the older 88
  (D14(c)).
- Built the W-row catalogue for **M2-M9: 44 W-rows** — 40 scheduled class A/B, 3 class C
  (M4-W5, M8-W4, M9-W5), 1 conditional (G-13/14). Every row names class, milestone, files/modules,
  register rows, spec sections, row-36 check IDs, owner agent, dependencies, concrete rollback and a
  single output artifact.
- M2-W1 is the first M2 row: **lane re-creation + per-lane pairing** (DP-7, RK-10, E-24), gating all
  lane-based gates.
- Wave plan: **19 waves, max size 4** (<= 8), with single-writer resources (lockfile, Homebrew,
  mobile/core-web/core-server runners, oMLX, media ports 8554-8564, emulator) and an output-path
  collision map (44+2 distinct paths, 0 collisions).
- Register coverage: SH 25/25, CS 25/25, WB 11/11, MB 13/13, DOC 6/6, NM 14/14 = 94/94.
- Spec-section mapping: 123/123 sections of rows 28-36 mapped.

## Decisions carried (not re-litigated)

- Deferred rows 13/14 (GStreamer) carried as a conditional sub-plan (trigger = user approval of the
  libexec-upgrade install, D12(d)); row 15 memo refreshes before any M1 re-run.
- Backlog placement from `structured` §8 + row-25 (F2/F3/F4) and row-26 (F1-F4) follow-ups; B14 and
  A5 explicitly not scheduled with reasons.
- Three second-gate flags (SEC35-16, SEC35-09, SEC35-02) each with confirm/reject landing, no
  re-planning.

## Row-36 pick-ups handed to row 40 (P-1..P-4)

| # | Stale row 36 | Truth | Fix |
|---|---|---|---|
| P-1 | M2-API-1: 88 ops / 34 GET / 54 POST | 89 / 34 / 55 | re-pin |
| P-2 | M2-API-2: "88-1"; offline 22 | 89-1; offline 23 | re-pin |
| P-3 | M2-AUD-1: 7 new types 53->60; codes 38 | 9 new types 53->62; codes 31->40; forbidden keys 25 | re-pin |
| P-4 | gate artifacts 06_m2..13_m9 | `06` taken by `06_security_remediation.md` | shift to 07_m2..14_m9 |

## Constraints honoured

- Plan only: no code change, no spec edit (rows 28-36 read-only), no external service.
- Wrote only the two allowed files.
- No emoji; English; tables over prose; every W-row cites spec section / check ID / decision ID /
  register row.

## Files written

- `docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md`
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/data-analyst__row37.md`
