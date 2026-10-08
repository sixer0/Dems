# RV-BP — task-architect — blueprint rev 2.1

| Field | Value |
|---|---|
| Row | RV-BP (revision round D19, relaunched with R-8 per D20) |
| Agent | task-architect (design only; no execution, no shell) |
| Date | 2026-10-08 |
| Status | complete (blueprint ready for the second BLUEPRINT_APPROVAL; the controller still has to gate RV-SPEC/RV-CODE) |
| File written | `identification/02_structured.md` (rev 2.1, 79 rows: 41-119) |
| Files read | identification/02_structured.md (rev 2.0); verification/20, 21, 22; decisions/decisions.md D4, D7, D10, D12-D20; masterplan/01_specs.md (R-5, R-7, R-8, C-N1), 02_plan.md (F-5/F-6/F-9/F-11, H-10), 10_test_strategy.md (M3-AV-1/2, M3-KC-2/4, M5-GAP-1, M6-TF-1, M6-DF-1, §A.6a), 05_capture_architecture_spec.md (OP-GOP, OP-CLICK, H-4), 04_database_contract.md (kept set); research/04_collection_stt.md (F-01..F-60) |
| Not written | masterplan/* (RV-SPEC), code (RV-CODE), status_tasks.md, delegation_progress_report.md (parallel-run rule) |

## Change summary

- **CPU-only STT made real on this Mac (AU3-01/AU2-01/AU2-02):** new rows 107 (whisper.cpp source build under `.cache/stt/`, GPU/Metal off, cmake from an isolated venv, Xcode clang, no Homebrew change), 108 (HF -> ggml conversion of `~/.omlx/models/whisper-large-v3-turbo` in an isolated venv; writes the missing `research/09`), 109 (CPU-only functional check, 2 runs, `-ng` quoted), 110 (+1 verifier addendum). Rows 76/77/81 now exercise both backends; M6-DF-1 runs on `cpu-local`.
- **Q-D7 rewritten** (3 options, (a) recommended, "already coded" removed); **Q-STT-ROUTE** added.
- **Q-WORKER** added; new row 111 proves H-4 (one AAC encoder -> both camera files) and H-10 (two clocks) FIRST; row 58 depends on it.
- **AU2-03..08:** rows 59, 60, 64, 71, 72, 75, 82 use the sample-exact analyser, the 2 ms regression bound + -80 ms case, sample-count + continuity, per-chunk switch bound, filtering-thread rule, tail validation and long-GOP loss; **Q-GOP** and **Q-CLICK** added.
- **REV-4 + Minors:** section 10 rebuilt from Depends On (43 levels, acyclic); row 84 deps 59/64/81; row 91 deps 83/89 + licence check; row 41 cut to the P-4 renumber; row 42 marked done; single completion-line definition; §5.5 citation repaired; B16 in row 46; row 105 phase identification.
- **AU1:** AU1-1/2/5/6 cited as done by RV-CODE (row 97 re-checks only); AU1-3 root-advisory basis in row 99 / AR-1.
- **R-8 (D20):** rows 112 (`stt_config` kept table), 114 (seed + kept 11 -> 12), 113 (ops 90-92 in M6, re-pin), 115 (runtime, snapshot, test connection), 116 (DISABLED / unreachable seal states), 117 (web menu), 118 (tablet/phone read-only), 119 (manifest + verify); **Q-STT-CFG** added with 13 default items.
- **Revision round:** row 106 reconciles masterplan/* with RV-SPEC before M2 opens.

## Self-check (evidence)

- 7 columns: grep raw-pipe counts — rows 42/105 8 raw/0 escaped; 69 rows 9 raw/1 escaped; rows 112-119 10 raw/2 escaped -> 8 unescaped pipes in all 79 rows.
- Agents: coder-execution 49 + {verifier, database-specialist, data-analyst, test-expert, senior-code-reviewer, security-review, task-architect} 30 = 79; all in `~/.claude/agents/`.
- Phases: masterplan, implementation, gateway_check, test, initialization, research, identification.
- DAG: every row at a level strictly above its dependencies (section 10); higher-numbered dependencies intentional (CF-9).
- Outputs: one path per row, no duplicates; new paths implementation/51-59, gateway_check/25-26, initialization/04, research/09, research/13.
- Concurrency: max 4 rows per wave, max 3 of one type.

## Blockers / decisions for the controller

- `RV` dependency: rows 41/43 (then 106 and all of M2) wait until the controller gates RV-SPEC and RV-CODE.
- CF-12: `M6-STTCFG-OFF` in test §A.6a includes a v2-verify clause that can only run in M7; row 106 routes the split to test-expert.
- Controller-owned Minors not in the blueprint: AU3-10 (tracker rows 16/29), AU3-11/12 (Drift Log entries incl. the D5 deviation), AU3-17 (provenance label), AU3-19 (decisions-table blank lines), AU1-4 (D13(c) erratum).
