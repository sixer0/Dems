---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: security-review
step: 20 (blueprint row 20, FIRM)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 04:26
---

# Progress: security-review, step 20 (security design review)

## Status

complete

Verdict of the review: **CAUTION** (no FAIL; 5 Medium, 18 Low, 6 Info findings; 29 in all).

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/03_security_design_review.md` | created (Tier 1, 440 lines, 11 sections, verdict CAUTION) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/security_review_step_20.md` | created (this file) |

No other file was written. `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` were not touched. `git status --porcelain -- apps packages scripts release package.json package-lock.json` printed 0 lines after the work. No install, no process, no listener, no code change: this row reviewed documents only.

Two instructions of the agent definition were not followed, because the row brief overrides them: no `implementation/99_implementation_report.md` was written (the brief allows exactly one output file), and the tracking table of `masterplan/02_plan.md` was not updated (another agent was writing that file).

## Milestones

1. Read `~/.claude/skills/security-review-gate/SKILL.md` and applied its five checks to the design (review section 9: overall CAUTION).
2. Read `masterplan/01_specs.md` sections 1 to 9, 12 to 16, 18 and 19; `masterplan/03_database_contract.md` sections 1.8, 1.9, 2, 4.4 to 4.11, 5 to 8 and 13; `masterplan/04_client_integration_spec.md` sections 1.8, 2 to 6, 9 to 11, 13.3 to 13.11, 16 and 17; `research/03_analysis.md` TD-01, TD-02, TD-05 to TD-08, TD-10, ADQ-6, ADQ-7, the Host Impact Register, the gap register and section 11; `research/02e_collection_identity_security.md` topics A to D, E1, E2 and the parameter table; `decisions/decisions.md` in full; U1-U9 in `identification/01_translated.md`.
3. Checked nine repository facts read-only (file and line in review section 1.6). The three credential constants were printed with their values redacted.
4. Wrote the review: a verdict per checklist item (18 of 18, each with the spec sections checked), 29 findings each with evidence, correction and owning row, the guessing probability of the pairing code, the three options for GD-02 with the exact change for the recommended one, rulings on every point the three files handed to row 20, 24 corrections ordered for the plan, 17 residual risks.
5. Checked the file with a script: verdict line present; 18 checklist rows, each citing a section of a specification file; 29 finding rows, each with seven cells; every Markdown table has a constant cell count; a search for the two credential literals (read into shell variables, never printed) returns 0 matches.

## Verification the controller will apply

| Criterion | Where in the file |
|---|---|
| Verdict stated | Header and line 18: `VERDICT: CAUTION` |
| Every checklist item cites a spec section | Section 3, column "Sections checked" (18 of 18) |
| Each CAUTION or FAIL names the owning row and the expected correction | Section 4 (SD-01 to SD-29); section 7 (ordered list with the row each correction must precede) |
| No finding requires a U1-U9 action | Section 10 |
| Tier 1 block | Section 1 |

## Blockers

None.

## Gaps of the review (for the controller)

| ID | Gap |
|---|---|
| RG-1 | `masterplan/02_plan.md` did not exist at 04:20 and was not reviewed. Corrections owned by row 18 are inputs to it |
| RG-2 | Nothing was executed. Every statement about PostgreSQL, V8, browsers and React Native that the research does not carry is labelled a hypothesis with the row that confirms it |
| RG-3 | Whether the API Reference renderer keeps request or response history in web storage is not established (SD-16 asks for a test) |

## Decisions for the controller to record

| # | Decision proposed | Finding |
|--:|---|---|
| 1 | **GD-02: option (a).** A third database role `dems_owner` (not a superuser, may create databases) owns the databases and performs migrations, seed, reset and test databases. `dems_admin` (the bootstrap superuser) is used only at provisioning. The server never reads the superuser's password file. Amends "two roles" of the decision record (analysis line 273) and closes F23 for GD-02. The provisioning trial gains the steps of review section 5.2 | SD-01 |
| 2 | **GD-01 accepted** as it is: the database checks the chain link, not the digest | section 6 |
| 3 | **Two Origin lists**, decided now instead of as the SA-03 fallback: web console origins for the cookie and for the web sign-in rule; the instance's own origin only on requests without a cookie | SD-02 |
| 4 | **A denial budget** at the throttle stage (proposal: 20 audited refusals per key in 60 s, then 429), so that "one audit row per refused call" cannot be used to flood the trail | SD-03 |
| 5 | **Atomic server-native state changes**: one unit in the pipeline, an attempt consumed before the verification, compare-and-set transitions. The 5-in-a-million bound of the pairing code depends on it | SD-04 |
| 6 | **The request log holds the route pattern, never the raw URL**; parse errors are logged by code only | SD-05 |
| 7 | **G-08, G-10, G-11 accepted**; G-08 lapses if a listener ever leaves loopback or TLS is added | sections 5.3, 5.6, 6 |
| 8 | **G-12 and SR-63 accepted with conditions C1 to C4**: the demo-operator disclosure may stay in Live mode; Live mode with the published password is permitted only while every listener is on loopback, and a change under U4 must first replace the seeded password | SD-17 |
| 9 | **DEPARTURE-6 accepted with conditions**: the fallback without `requireAuthentication` only on emulators or debug builds; no silent fallback elsewhere; truthful wording | SD-18 |
| 10 | **GS-01 to GS-09 accepted** as residual risks (review section 8, R-01 to R-17) | section 6 |
| 11 | **`@fastify/helmet` 13.1.1 adopted** for the response headers of the Core server, plus `Cache-Control: no-store` | SD-14 |
| 12 | **`TOKEN_REUSE` joins the closed set of session end reasons before the first migration** | SD-10 |
| 13 | **The Core's Origin allowlist drops `http://localhost`**: another project on this host listens on `[::1]:5173` | SD-07 |
| 14 | **The cookie name is per instance** (`dems_session_<backend port>`), so lanes do not sign each other out | SD-08 |
| 15 | Choose one form for the durable lineage of discarded audit chains: a kept table, or a file under `.data/` | SD-19 |
| 16 | The remaining Low and Info corrections (SD-06, SD-09, SD-11 to SD-13, SD-15, SD-16, SD-20 to SD-29) go to rows 18 and 21 as listed in review section 7 | section 7 |

## Notes for other rows

| Row | Note |
|---|---|
| 18, 21 | Review section 7 gives, for each correction, the row it must precede. Corrections 1, 6, 7 and 13 change the provisioning and migration rows (23, 28) and should be folded first |
| 19 | The consistency check should see the three files as they stand; the corrections are not yet applied to them |
| 50, 111, 112 | Re-check SD-01 to SD-23 against code; the five tests of SD-04 and the extended log capture of SD-05 are the ones most likely to be skipped |

---
*Generated: 2026-10-04 04:26*
*Last Updated: 2026-10-04 04:26*
