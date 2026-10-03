---
task_id: 2026-09-30_dems_demo_stack_setup
step: 45
checkpoint: CP-2 (parallel audit, D71)
agent: verifier
tier: 3
status: complete
verdict: FAIL (1 high, 2 medium, 4 low, 1 nit; all routed)
report: verification/07_visual_checkpoint.md
---

# Step 45 progress (verifier)

| Time (WIB) | Event |
|---|---|
| 09:17 | Read the inputs: 02_structured row 45 and the Parallel Execution Protocol, decisions D59–D85, 01_specs §14.14, 03_motion_spec §3–§9, research/04 §2–§3, implementation logs 21–24 |
| 09:20 | Started mock-core under P5 (`lockf -k .locks/mock-core.lock`): sh 53661 → npm exec 53663 → tsx 53684 → node 53686 (listener 127.0.0.1:4400). Wrote 53686 to `.locks/mock-core.pid` and created `.locks/mock-core.users/step-45` |
| 09:21 | Started Vite on 127.0.0.1:5173 with a private config (`scratchpad/step45/vite.step45.config.mjs`: private cacheDir, hmr off, watch off): npx 54006 → node 54024. Did not touch 5174/5175 or [::1]:5173 (SMART WMS, PID 3489) |
| 09:22–09:32 | Headless audits: shell 1920 (AC-59 at 4 breakpoints, route transitions); Dashboard 1920 and 1440; SM 1920 and 1440 (30 s soak, End Session → SEALED); Login 1920 and 1440 (flight, hand-off pause); reduced 1920 |
| 09:33–09:35 | Probes: `fault-demo` (D80), overflow at 900/1200, AC-74 in one session, reduced hand-off, Evidence detail |
| 09:36–09:38 | Windowed Chrome for Testing 153 (Metal, Apple M5): SM AC-71 reading 60.0 fps, 0 long tasks over 30 s; Dashboard 30.0 fps; controls isolate the two playing tile videos (paused or hidden → 60) |
| 09:40 | Stopped Vite 54024/54006. Released mock-core under the lock as its last user and stopped 53686/53684/53663/53661 |
| 09:41–09:42 | Re-measured the reduced hand-off on the correct elements: the first probe read a non-animated wrapper, so the "brand side cuts" claim was dropped before reporting. mock-core run 2: sh 74243 → 74245 → 74264 → listener 74265. Vite run 2: npx 74278 → node 74296. Both stopped the same way; `.locks/mock-core.users/` is empty |
| 09:45 | Wrote `verification/07_visual_checkpoint.md`, 47 screenshots `verification/assets/45_*.png` and `verification/assets/45_measurements.json` |

**Findings routed** (details in the report, §4):

| Finding | Severity | Summary | Owner |
|---|---|---|---|
| F45-01 | High | Dashboard at 30 fps in windowed GPU Chrome while 2 tile videos play | 42 (39; relay 47, 48, 58) |
| F45-02 | Medium | SECURE beam starved on the Dashboard when CRITICAL while recording | 42 (or 41) |
| F45-03 | Medium | Pill shows SECURE during recording with active warnings | 41 + 54 |
| F45-04 | Low | AC-74 zone label missing on SM M Start Time and on Evidence | 44, 47 |
| F45-05 | Low | 1440 SM meter peak line overlaps the MIC label | 44 (or 39) |
| F45-06 | Low | CRITICAL ring caption says "blocks recording" while recording continues | 42 |
| F45-07 | Low | Below 1024 px, panel A's hairline arc overflows across the hero | 42 |
| F45-08 | Nit | "Items sealed today" wraps onto 3 lines | 42 |

**Not written** (P8, parallel run): `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md`. No code or configuration file was written.
