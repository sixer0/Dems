# Status — DEMS Backend (Postgres), Integrated RBAC and Pairing

| Phase | Step | Status | Notes |
|---|---|---|---|
| A. Identification | A.1 Title + history screen | done | Related history: `docs/2026-09-30_dems_demo_stack_setup/` (specs, mobile specs, decisions D1–D132, known issues KI-01..KI-29) |
| A. Identification | A.2 Seed folder | done | README.md, status_tasks.md, decisions/decisions.md |
| A. Identification | A.3 request-translator | done | REQUEST_TRANSLATED; A1–A10, Q1–Q16 defaults adopted (D4); U1–U9 stay the user's call |
| A. Identification | A.4 task-architect | done | blueprint rev 1: 118 rows (1–22 firm, 23–118 provisional), P1–P22 |
| A. Identification | A.4a Pre-HIL validation V1–V7 | done — all PASS | D7 |
| A. Identification | A.5 BLUEPRINT_APPROVAL | pre-granted by the user's instruction (D1); blueprint summary reported (D7, D8); B.9 second gate: MAJOR, pre-granted, reported (D22) | |
| B. Research | Rows 1–12 (5 explore + 7 data-collector) | done — all gated PASS | findings F4–F19 |
| B. Research | Row 13 baseline root gate (verifier) | done — PASS-WITH-NOTES | shared 508, mock-core 19, mobile 833 green; core-web 436/438 (two calendar-dependent tests, D10 / F20) |
| B. Research | Row 14 analysis (data-analyst) | done | 23 decision records accepted (D11, D12) |
| B. Research | Row 15 system specification (data-analyst) | done | 75 operations, 3 roles × 12 permissions, 67 SR, 71 AC-B (D13) |
| B. Research | Rows 16 (database contract) ∥ 17 (client integration spec) | done | 29 tables (D14); 101 AC-C (D15) |
| B. Research | Row 20 security design review | done — CAUTION (5 Medium, 0 High) | D16: fix now |
| B. Research | Row 18 plan rev 1; rows 20a / 20b security corrections in 03, 01, 04 | done | D17, D18, D19: specs at rev 2 (SR-82, AC-B-93, AC-C-110; 30 tables) |
| B. Research | Contract patch rev 2.1 ∥ plan rev 2 | done | D19, D20: 105 work rows, coverage 93 / 110 / 82 |
| B. Research | Rows 19 (consistency check) ∥ 21 (blueprint refinement) | done | D21 PASS-WITH-NOTES (text fixes applied: specs rev 2.1, contract rev 2.2); D22 blueprint rev 2, 127 rows, V1–V7 PASS, class MAJOR |
| B. Research | Plan rev 2.1, specs rev 2.2, contract rev 2.2, blueprint rev 2.1 | done | D23; controller quality gate before implementation: PASS (gateway_check/01_gate_report.md) |
| B. Research | Row 22 docs commit (git-specialist) | running | then implementation wave E1 (steps 23–27) |
| B. Research | rows 14 (analysis) → 15, 16, 17 (specs) → 18 (plan) → 19, 20 (checks) → 21 (refine) → 22 (docs commit) | pending | |
| C. Implementation | — | pending | |
| D. Verification | — | pending | |
| E. Close | — | pending | |

## Controller pre-screen evidence (read-only, 2026-10-04)

- Git: branch `main`, HEAD `33e4c95` (baseline); the predecessor task's final commit (its step 66) never ran — the previous session ended while it was starting. Working tree: 967 untracked, 32 modified, 1 deleted. Step 66 is re-delegated now so this task starts from a committed baseline.
- Toolchain: node v26.8.2, Homebrew present. **Missing:** `psql`, `postgres`, `pg_ctl` (no PostgreSQL on the host). `docker` CLI exists at `/opt/homebrew/bin/docker` (daemon state not probed; Docker is not used without the user's explicit OK — predecessor rule).
- Ports: nothing listens on 4400, 5173–5178, 8081 or 5432. The predecessor's manual-test servers (mock-core, Vite, Metro) are gone — the host session ended.
- Emulators: `adb` cannot start its daemon inside the sandbox; device state not probed yet.
