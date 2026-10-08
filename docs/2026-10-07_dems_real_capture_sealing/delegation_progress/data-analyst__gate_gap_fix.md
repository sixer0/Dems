---
task_id: 2026-10-07_dems_real_capture_sealing
row: 39 (gate-gap remediation -> feeds row 40 rev 2)
agent: data-analyst-local
milestone: M0
type: gate-gap remediation (GAP-01, GAP-02)
status: complete
last_updated: 2026-10-07 22:30
---

# Gate-gap remediation — GAP-01 and GAP-02 (progress)

## Status

complete. Two rev-2-items from the M0 spec gate (`gateway_check/05_m0_spec_gate.md`,
`blueprint_row: 39`) are closed in the two routed spec files. GAP-03..GAP-05 (informational) were
NOT edited, per the gate ("no edit required"). The authoritative post-remediation numbers are taken
from `decisions/decisions.md` D14(c).

## Files edited (exactly two; plus this progress file)

| File | Gap | Change |
|---|---|---|
| `masterplan/10_test_strategy.md` | GAP-01 | 5 stale-count lines corrected (see below) |
| `masterplan/05_capture_architecture_spec.md` | GAP-02 | mic-switch path normalised plural -> singular (line 499) |
| `delegation_progress/data-analyst__gate_gap_fix.md` | — | this progress file |

## GAP-01 — stale counts in `masterplan/10_test_strategy.md` (5 occurrences fixed)

Target values (D14(c)): registry **89** ops (34 GET / **55** POST); **13** simulated; **9** new
types (**53 -> 62**); **9** new codes (**31 -> 40**); forbidden-key CHECK **17 -> 25**; section-C
family B **75 -> 89**; offline **10 -> 23**.

| # | Line | Old (quoted) | New (quoted) |
|---|---|---|---|
| 1 | 137 (M2-API-1) | `` `all` document version 0.3.0, 88 ops, 34 GET / 54 POST, registry==document drift test green `` | `` `all` document version 0.3.0, 89 ops, 34 GET / 55 POST, registry==document drift test green `` |
| 2 | 138 (M2-API-2) | `` `offline` constant 0.2.0 with the 12 simulated ops visible, 88-1 live-only op excluded `` | `` `offline` constant 0.2.0 with the 13 simulated ops visible (offline grows 10 -> 23), 89-1 live-only op excluded `` |
| 3 | 140 (M2-PIN-1) | ``category B/C/D files now pin 88 / 30 / v2+`dbc-3` `` | ``category B/C/D files now pin 89 / 30 / v2+`dbc-3` `` |
| 4 | 143 (M2-AUD-1) | ``the 7 new types (53 -> 60) write rows ... category map gains exactly 7 entries`` | ``the 9 new types (53 -> 62) write rows ... category map gains exactly 9 entries; the 9 new codes (31 -> 40) and the forbidden-key CHECK 17 -> 25 hold (C3 §4/§5; `dbc-3` §C)`` |
| 5 | 360 (section C, family B) | ``| B — operation count | `75 -> 88` (projected `34 GET / 54 POST`) |`` | ``| B — operation count | `75 -> 89` (projected `34 GET / 55 POST`) |`` |

Occurrence count: **5** edits on **5** lines (137, 138, 140, 143, 360) — matches the gate's GAP-01
line list.

**Offline note.** No literal `22` existed in the file for offline; the stale item at line 138 was
the simulated count (12) and `88-1`. The fix changes 12 -> 13 and `88-1` -> `89-1`, and adds the
explicit post-remediation offline total `(offline grows 10 -> 23)` per plan P-2 /
`03_api_contract.md §8`.

**Unrelated `88` uses verified and deliberately left unchanged** (grep `88`): line 73 (`1,988`
mobile tests), line 131 (`0001_tables.sql:...:488` line number), line 135 (`22 grants` + decision
`D88`), line 139 (decision `D88`), line 251 (op **88** `createEvidenceMediaSession` — a real
operation, correct), line 364 (`1,988` floor), line 538 (`1,988` ledger). Also `34 GET` was left
unchanged (correct in both occurrences). No line numbers, byte sizes or unrelated counts were
touched.

**Not done (out of GAP-01 scope):** plan item **P-4** (gate-artifact renumber
`gateway_check/06..13` -> `07..14`) was NOT applied — it is not part of GAP-01's stale counts and
remains routed to row 40 by `02_plan.md:82`.

## GAP-02 — plural mic-switch path in `masterplan/05_capture_architecture_spec.md:499`

| | Text |
|---|---|
| Old | ``| Who may trigger | session holder with `SESSION_START` + SUPERVISOR (OD-09); operation from row 29 (`switchAudioSource`, `POST /api/v1/sessions/{id}/audio-source`, SH-13) | OD-09 (D4); SH-13; RBAC `CAPTURE_CONFIG` for the selector (OD-10) is separate |`` |
| New | ``| Who may trigger | session holder with `SESSION_START` + SUPERVISOR (OD-09); operation from row 29 (`switchAudioSource`, `POST /api/v1/session/{id}/audio-source` — singular per row 29 §1, which flags the plural `sessions` spelling as the erratum; SH-13) | OD-09 (D4); SH-13; RBAC `CAPTURE_CONFIG` for the selector (OD-10) is separate |`` |

Occurrence count: **1**. The surrounding mechanism description (who may trigger; the
`SESSION_START` + SUPERVISOR access; `SH-13`; the separate `CAPTURE_CONFIG` selector) is intact.
`masterplan/03_api_contract.md` (row 29, the path authority) was NOT edited.

## Self-gate re-verification after the edits

### Row 36 (`10_test_strategy.md` §K/§L)

| Item | Result (unchanged) |
|---|---|
| milestones 10/10 | line 537 holds "**10/10** gates mapped (M0 wave-A + M1-M9 ...)", unchanged |
| named checks 205 active | line 537 holds "**Total named checks: 205 active (+10 conditional ...)**", unchanged (values changed, no check added/removed: M0 7, M1 21, M2 28, M3 18, M4 14, M5 13, M6 14, M7 51 + 10, M8 17, M9 16, X 6) |
| pin files 63 | line 538 holds "**14 + 18 + 31 = 63 pin files + 2 OpenAPI constants/json + 7 ledger floors**", unchanged |
| 0 checks with >= 10 loops | line 539 holds "**0 scheduled checks with >= 10 loops**", unchanged |
| biometric absent | line 540 holds "**0 checks**" (grep `biometric` = §G exclusion + K/L statements only), unchanged |

The check catalogue itself is unchanged; only pin VALUES were corrected on the five lines above.

### Row 31 (`05_capture_architecture_spec.md` self-gate)

| Item | Result |
|---|---|
| NM 9/9 | line 628 holds "**9/9**"; line 633 holds "NM 9/9" |
| P25 12/12 | line 630 holds "**12/12**" (6 app.ts / 4 config.ts / 2 index.ts); line 633 holds "P25 12/12" |
| no non-existent muxer options | `rg frag_type\|default_prft\|frag_start_number` = **no raw literals**; only bracketed-idiom mentions at lines 414, 631, 640 — unchanged |
| hypotheses §J intact | H-1..H-9 all present (lines 608-616); line 633 holds "H-1..H-9 counts unchanged" |

## No third file touched

`git status --porcelain -- masterplan/` shows **no tracked modifications** in `masterplan/`; the two
edited specs are untracked task artifacts (`?? .../10_test_strategy.md`, `?? .../05_capture_architecture_spec.md`),
as expected for this task folder. The tracked files that appear modified under `docs/`
(`decisions/decisions.md`, `delegation_progress_report.md`, `status_tasks.md`) were changed by
concurrent actors (their mtimes 21:28 / 15:08 / 22:24 precede my edits at 22:28-22:29) — this row
never wrote to them. `masterplan/03_api_contract.md` and every other spec are untouched.

## Note for row 40

The M0 gate report (`05_m0_spec_gate.md`) routed P-1..P-3 to row 40; those count pick-ups are now
folded into row 36 by this fix, so **row 40 can rely on row 31 (singular mic-switch path) and row 36
(corrected counts) as consistent**. P-4 (gate-artifact renumber `06..13` -> `07..14`) remains for
row 40, and GAP-03/GAP-04/GAP-05 stay informational (not edited).

## Blockers

None.
