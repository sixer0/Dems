# Row 36 delegation progress — test-expert

- Blueprint row: 36 (class B, milestone M0, tier 1)
- Task: Write the test strategy — named checks per milestone gate with run counts (2 + 1),
  fake-clock rule, pinned-count files (categories B/C/D), static rules for new folders, lane
  re-creation with per-lane pairing, kill matrix as distinct checks, long campaigns only
  pre-handover, no biometric steps.
- Status: COMPLETE
- Date: 2026-10-07 10:55

## Output

| Artifact | Path |
|---|---|
| Test strategy (Tier 1) | `masterplan/10_test_strategy.md` (578 lines) |
| This progress note | `delegation_progress/test-expert__row36.md` |

## Inputs read (source of truth)

| Input | Path / location used |
|---|---|
| Blueprint row 36 + Verification column | `identification/02_structured.md:216`; §6 milestone table `:224-240`; §Verification `:387-397`; rows 27/38/39 `:207/:218/:219`; §9 class-C pack `:286-298` |
| Phase spec success/acceptance criteria | `masterplan/01_specs.md` §B (R-1..R-7 measurable ACs), §C (C-N1..C-N12), §F (per-milestone success criteria) |
| API contract | `masterplan/03_api_contract.md` §1 (75+13=88, 34 GET/54 POST), §5 (7 new audit types, E-30/E-31 rule), §6 (slices 28->30, E-04), §8 (0.3.0 / offline 0.2.0, pinned-count edits) |
| Database contract | `masterplan/04_database_contract.md` §B.3 (credentials, RK-12), §C (CHECK sites), §D (privileges), §E (kept set, reset guard), §F (lane re-creation, referenced not restated), §G (MT-1..MT-8 + run counts + command forms) |
| Capture architecture | `masterplan/05_capture_architecture_spec.md` §A.4 (S1 restart-per-session), §B.2, §C.4 (muxer options), §C.5 (drop-fragment), §D.4 (Range), §E (mic switch, warning raiser), §G (static rules G-R1..G-R8, guard test files), §H (media paths) |
| Evidence package | `masterplan/06_evidence_package_spec.md` §D (V-01..V-14, V-08 quote), §E (6+2 sealing steps, resume rules, forward-only), §E.4 (OD-08 crash path), §F (tamper re-script), §G (export, composite, G.4 blanking) |
| Transcript spec | `masterplan/07_transcript_spec.md` §A (stages), §B (adapter), §C (CPU priority), §D (chunk resume), §E (M6 criteria 1-8, row-12 reference evidence) |
| Client UX spec | `masterplan/08_client_ux_spec.md` §1-§8 (7 flows x 3 clients), §9 (P-01..P-16), §11 (gated controls inventory) |
| Register pinned-count references | `research/03_analysis.md` E-06 (:61 ledger), E-01 (:56 CHECK sites), SH-16/SH-19 (:144/:147), W1-C6 (:334 B2 54/51), **W1-C7 (:335 `--maxWorkers=2` all workspaces, D12c-corrected)**, `:105` (strategy must use errata values) |
| Explore facts | `research/01_explore.md` §2.4 (21 guards + 13-file scanner suite + 2 rule libs), §2.5 (where 75 is pinned, exact lines; OpenAPI versions), §2.7 (CHECK line nuance :335/:336) |
| B2 baseline | `research/05_b2_dependency_triage.md` via register W1-C6 (54 high / 51 omit-dev) |
| Spike artifacts (criteria + recipes) | `research/06` (S1 5/5, G-1), `research/07` (S2 12/12), `research/08` (S4 9/9), `research/10` (TT 7/7 criteria table, row-38 +1 recipe §9.2), `research/12` (PICK 12 criteria) |
| Ledger baseline | `report/report.md` §7 (shared 71/1,851; core-web 117/1,495; mobile 192/1,988; cs 160/3,954; db 124/1,751; mock-core 4/19; pg-scripts 57) + row 19 re-confirmation (W5) |
| Standing rules | `decisions/decisions.md` D4 (all OD defaults), D7 (oMLX reuse + host rules), D10 (S1 G-1, S2 libavfilter, mobile jest form), D12 (vitest honours `--maxWorkers` — W1-C7 correction; S4 results); `report/report.md` §6 (D232/D233 2+1 + pre-handover, D231 no biometric, emulator-PIN rule + `emulator-user-lock.sh`, D258 pairing-capture rule) |
| Predecessor category convention | `docs/2026-10-04_.../research/10_next_phase_impact_map.md` §7.1/§7.2 (families B 14 / C 18 / D 31 / S 21 files, union 165) and its §7.3 new-test-layers table |
| W-rows commands + flake practice | `docs/2026-10-04_.../test/01_test_report.md` (per-workspace command forms incl. mock-core `--maxWorkers=2`); rows 16-21 implementation notes (grep patterns, "no timeout raised", `worker force exited` residual) |
| Workspace scripts | re-checked this session: root / `@dems/shared` / `@dems/core-server` (test + test:db) / `@dems/core-web` / `@dems/mobile` / `@dems/mock-core` / `test:pg-scripts` (`node --test scripts/pg/`) |

## Self-gate (row 36 hard gate, from `10_test_strategy.md` §K/§L)

| Check | Result |
|---|---|
| Every gate M1-M9 maps to named checks with run counts | **10/10 gates mapped** (M0 wave-A + M1..M9). Milestone counts: M0 7, M1 21, M2 28, M3 18, M4 14, M5 13, M6 14, M7 51 (+10 fallback-conditional), M8 17, M9 16, standing X 6. **Total 205 active named checks (215 with conditional); 82 run 2+1, 123 run once per checkpoint.** Every M2-M9 spec-§F / `structured` §6 gate line item is covered by at least one named check; MT-1..MT-8 are referenced to `dbc-3` §G, not duplicated. |
| Pinned-count file list matches row 6 | section C = register-corrected values: 63 pin files (B 14 / C 18 / D 31, `map` §7.2 with `explore` §2.5 exact lines) + 2 OpenAPI constants + regenerated `openapi.json` + 7 ledger floors (E-06: 71/1,851; 160/3,954; 124/1,751; 117/1,495; 192/1,988; mock-core 4/19; pg-scripts 57). Re-pin mechanism in C + D.4 reference. |
| 0 checks with >= 10 loops outside pre-handover | execution-count grep over all run-count cells: **no hits**; loop/campaign phrasing appears only as negations (§0, A.7, B.1, F) or inside F.3/A.9 pre-handover and class-C lines. Kill matrix = 35 scheduled distinct cells each 2+1 (max 3 executions), never a loop. |
| No biometric step | grep: only §G exclusion (D231) + K/L statements — **0 biometric checks**. |
| Every check cites its spec section | all catalogue rows carry a Cites column (spec section / decision ID / register row / blueprint row / spike artifact). |
| `--maxWorkers=2` for all workspaces, command forms | B.4 table: 7 existing + 2 new workspaces, forms verified against each `package.json` this session; node:test (`pg-scripts`) documented as the flag exception with `--test-concurrency` equivalence; source W1-C7/D12(c). |

## Notes / decisions taken in this row

| # | Note / decision | Rationale |
|---|---|---|
| 1 | Kill matrix axes: 4 recording phases (P1 pre-first-durable, P2 partial-tail, P3 open-interval+chunk, P4 post-STOP pre-seal) x 8 sealing steps (S1-S6 normal, S7-S8 OD-21 fallback); 35 default cells scheduled, 10 fallback cells conditional | phases derived from `ev` §E.4 / `cap` §C.5 / `dbc-3` §B.5; steps from row 32 §E.1/§E.3 (the 8 of the brief) |
| 2 | Gate-artifact naming convention `gateway_check/06..13` proposed and flagged for row 37/40 confirmation (numbered after existing 01..05) | rev-2 rows do not exist yet; convention, not invention of row outputs |
| 3 | M1 checks are the row-38 gate re-assertions of rows 7/8/9/12/15 criteria (2 runs already produced by the spike rows); TT checks anchor on the sealed fixture per `research/10` §9.2 | `structured` §6 intro + row 38 |
| 4 | Category A (behavior-model files) deliberately excluded from the pin list; category S reconciled so the 21 existing guards, 13-file scanner suite, 2 rule libs and new guards never double-count (expected progression 21 -> 24 src guards by M8) | `map` §7.1 convention + `explore` §2.4 |
| 5 | New-folder guard set extended beyond `cap` §G's two files to all seven new workspaces/modules named in register §402 and `map` §7.2 S (capture-config, evidence-media, capture-protocol, evidence-package, transcriber), each with created-at milestone | row 36 brief ("plus any other new folder") |
| 6 | No test, command, emulator, lane or external call was executed by this row beyond read-only file inspection and the self-gate greps over my own output | row brief red lines |

## Blockers

None. Open point routed to row 37/39: `structured` §6 M1 wording "row 12 if it ran" is settled — row
12 executed 7/7 PASS (no SKIPPED record), so M1-TT-* checks anchor on `research/10`; and the 10
conditional KM fallback cells stay unscheduled unless OD-21's fallback is activated (legal
confirmation outstanding, `ev` §H.1).

## Next steps (from the masterplan sequence)

- Row 37 (`masterplan/02_plan.md`) embeds these check IDs into W-rows' Verification columns (§M of
  the strategy).
- Row 39 (M0 gate) cross-checks this file against row 6's register values.
- Rows 23-27 (wave-A) produce the M0 ledger re-pin that sets the floors from M2 onward.

---
*Generated: 2026-10-07 10:55*
*Last Updated: 2026-10-07 10:55*
