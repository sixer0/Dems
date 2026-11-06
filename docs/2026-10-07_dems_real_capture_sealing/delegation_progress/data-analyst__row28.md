---
task_id: 2026-10-07_dems_real_capture_sealing
row: 28
agent: data-analyst-local
milestone: M0
class: B (all answered ODs)
tier: 1
status: complete
last_updated: 2026-10-07 09:24
---

# Row 28 — phase spec (progress)

## Status

complete. Fresh run (the prior attempt was cancelled before any durable work; its stale
`masterplan/01_specs.md` and progress file were replaced in place). Deliverable
`masterplan/01_specs.md` written. No file outside this task folder was edited; the blueprint,
`decisions/decisions.md` and the register were **read-only** inputs.

## Inputs read (in order)

| # | Input | Used for |
|---|---|---|
| 1 | `identification/02_structured.md` (row 28 + Verification; §5 work classes + completion line; §6 M0-M9; §7 requirement trace; §8 backlog; §9 class-C pack; Gate Questions OD-01..OD-26/Q-AUTO/Q-INSTALL/Q-HW) | scope, milestones, gate-answer table, out-of-scope, class-C |
| 2 | `decisions/decisions.md` D1-D12 (D4 answers; D7 STT reuse re-scope; D8 W1 corrections; D10 W2 findings; D12 W3 gate, vitest correction, GStreamer deferral) | authority for every gate answer and mechanism fact |
| 3 | `research/03_analysis.md` (errata 31/31; register 94/94; gate mapping 29/29; R trace 7/7; superseded 5; W1 corrections; RK delta) | primary register the spec is written against |
| 4 | `research/02_collection.md`, `research/04_collection_stt.md`, `research/05_b2_dependency_triage.md` | media/STT/B2 facts and licences |
| 5 | `research/06_spike_s1_*.md`, `research/07_spike_s2_*.md`, `research/08_spike_s4_*.md` | measured mechanism evidence (S1 5/5, S2 12/12, S4 9/9) |
| 6 | `initialization/01_env_check.md`, `initialization/02_stt_runtime_install.md`, `initialization/03_gstreamer_install.md` | host truth; installed STT/TTS; the GStreamer deferral evidence |
| 7 | `identification/01_translated.md` (G1-G7; C-REQ/C-TECH/C-SAFE) | goals and constraints the spec satisfies |

## Output

| File | Content |
|---|---|
| `masterplan/01_specs.md` | 5W1H frame; A scope + completion line + out-of-scope; B R-1..R-7 with measurable acceptance criteria; C non-functional (STT CPU/GPU split, `--maxWorkers=2` for all workspaces per D12c) + licence obligations; D 29 gate items + 5 superseded; E six mechanism chapters (capture/ingest, audio, transcript, evidence/sealing, lifecycle, clients); F M0-M9 success criteria; G completion line + C-1..C-9; H backlog + OD-26 + GStreamer deferral with re-evaluation trigger; I self-gate |

## Corrections applied over the cancelled attempt

| # | Correction | Authority |
|---|---|---|
| 1 | vitest 5.0.3 **does** honour `--maxWorkers`; use `--maxWorkers=2` for **all** workspaces (jest and vitest). The earlier `--poolOptions.threads.maxThreads=2` substitution is wrong. Register line W1-C7 (`research/03_analysis.md` ~line 335) is corrected in parallel by an errata task; this spec cites D12(c) and did not edit the register | D12(c) |
| 2 | GStreamer rows 13/14 deferred; documented with the 11-upgrade blast radius and a re-evaluation trigger | D12(d); `initialization/03_gstreamer_install.md` |
| 3 | S4 measured evidence added (aligned -1.333 ms; injected 80 ms flagged 78.667 ms; through the S1 pipeline) | D12(a); `research/08_spike_s4_av_sync_fixture.md` |
| 4 | STT split stated explicitly: production path CPU-only; Mac-side `omlx-server` engine uses the Apple GPU by design and is **not** shipped | D7(b)/(c); `initialization/02_stt_runtime_install.md` §4 |
| 5 | B2 baseline stated as 54/51 (not 99); braces + node-forge have no published fix | D8; `research/05_b2_dependency_triage.md` §1/§3 |

## Self-gate results

| Check | Result |
|---|---|
| R-1..R-7 with >= 1 measurable acceptance criterion | 7/7 |
| Answered gate items cited by decision ID | 29/29 (26 OD + Q-AUTO + Q-INSTALL + Q-HW) |
| Superseded items only as superseded | 5/5 |
| 5W1H frame present | yes (section 0) |
| Every factual claim cited | yes |

## Notes / issues

- The register is treated as the contract; where the raw impact map and `research/03_analysis.md`
  disagree, the register wins (task instruction; register §Overview; D10(a)).
- No `masterplan/02_plan.md` contribution: row 28 writes the phase spec only; row 37 owns the plan
  and row 40 produces the M2-M9 implementation rows (`structured` rows 28, 37, 40).
- D7 `TranscriberAdapter` (`omlx-server` + `cpu-local`) touches the OD-24 default and remains flagged
  for confirmation at the second blueprint gate (row 40) — recorded in the spec's summary, D OD-24 and
  E.3 (register §F W1-C12).
- OD-21 remains unresolved legal confirmation (no external authority, `coll3` F-102); restated as such,
  not as clearance.
- In-flight W4 sibling rows (e.g. row 12 STT functional check, rows 14/15 GStreamer, the errata task
  correcting the vitest register line) are not dependencies of row 28; their future outputs may refresh
  row 15/38 but do not change this spec.

---
*Generated: 2026-10-07 09:24*
