# test-expert-local — row 41 (M0 / pickup P-4 gate-artifact renumber, tier 3)

Status: DONE — renumber applied and verified. Date: 2026-10-08. Session: test-expert-local subagent (row 41 delegation, phase C, blueprint rev 2.1).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/masterplan/10_test_strategy.md` refreshed in place (Tier 3). Edit WAS required — RV-SPEC had not performed the renumber (AU3-07 / errata OUT-4 left it to this row; pre-edit grep confirmed the old tokens present).

## What changed

Gate-artifact names renumbered +1 across all m2..m9 references: `06_m2_gate`->`07_m2_gate`, `07_m3_gate`->`08_m3_gate`, `08_m4_gate`->`09_m4_gate`, `09_m5_gate`->`10_m5_gate`, `10_m6_gate`->`11_m6_gate`, `11_m7_gate`->`12_m7_gate`, `12_m8_gate`->`13_m8_gate`, `13_m9_gate`->`14_m9_gate`. Rationale matches disk state: `gateway_check/06_security_remediation.md` occupies slot 06, so the milestone gates start at 07. 10 token occurrences on 9 lines (:56 convention pair, :120 M2, :150 M3, :171 M4, :190 M5, :204 M6, :236 M7, :264 M8, :281 M9). AU3-07 cited :56/:120/:262 as representative stale sites; the row's Verification ("present where the m2..m9 gates are referenced") required every site, so all 9 lines were fixed.

## Verification evidence (commands run in the task folder)

- BEFORE grep -c per old token: 06_m2_gate=2, 07_m3_gate=1, 08_m4_gate=1, 09_m5_gate=1, 10_m6_gate=1, 11_m7_gate=1, 12_m8_gate=1, 13_m9_gate=2 (total 10). File clean vs git (`git status --porcelain` empty), sha256 `69597dcb...`.
- AFTER grep -c per old token: all eight = 0. Row-required keys `06_m2_gate` and `13_m9_gate`: 0 hits each.
- AFTER grep -c per new token: 07_m2_gate=2, 08_m3_gate=1, 09_m4_gate=1, 10_m5_gate=1, 11_m6_gate=1, 12_m7_gate=1, 13_m8_gate=1, 14_m9_gate=2 — same distribution as before, on the same line numbers (:56, :120, :150, :171, :190, :204, :236, :264, :281).
- `git diff --stat`: `1 file changed, 9 insertions(+), 9 deletions(-)` — one file only, this file. Full `git diff -U0` shows each of the 9 changed lines is exactly one gate-artifact naming line; no other text altered on those lines beyond the number token.
- Count lines untouched: :137 (89 ops, 34 GET / 55 POST), :138 (13 simulated ops), :140 (pin 89 / 30), :143 (53 -> 62, 31 -> 40) still carry the W12/D15(c) values; `git diff | grep -E "^[-+].*(89|55| 13 |/ 62 |/ 40)"` printed nothing. File length unchanged at 597 lines.
- No other file touched by this row: the other modified paths in repo porcelain (`decisions/decisions.md`, `identification/01_translated.md`, `status_tasks.md`, an untracked `request-translator__resume_phaseC.md`) are concurrent controller/peer changes, not this session's.

## Scope notes for the controller (deliberate non-edits)

- :53 "paths numbered after the existing `gateway_check/01..05`; row 37 and row 40 confirm the final names" — descriptive prose about the numbering scheme plus a historical confirmation record, not a gate-artifact name; left as-is per "diff limited to naming lines". If the controller wants it restated as `01..06`, that is a separate editorial call.
- :588 "Row 40 (rev 2): ... confirm the `gateway_check/06..13` naming" — historical changelog of what row 40 did at rev 2; rewriting it would falsify history. Left as-is; flagged here for visibility.
- M0/M1 gate names (`05_m0_spec_gate`, `04_m1_spike_gate`) correctly untouched — the shift applies to m2..m9 only.

Files written: `masterplan/10_test_strategy.md` (in place) and this progress note. Blockers: none. Rows depending on 41 (per rev 2.1 wave table) can treat the gate naming as canonical at `07..14`.
