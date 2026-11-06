---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-analyst
step: 15 (blueprint row 15, FIRM)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 03:14
---

# Progress: data-analyst, step 15 (system specification, server side)

## Status

complete

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` | created (Tier 1, 1,901 lines, 19 sections) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_analyst_step_15.md` | created (this file) |

No other file was written. `git status --porcelain -- apps packages scripts release package.json package-lock.json` printed 0 lines after the work. No install, no code, no process. One `sed -i` call set the final timestamps in `01_specs.md` (four lines); everything else was written with the file tools.

## Milestones

1. Read the decision record (`research/03_analysis.md`, all 979 lines), `decisions/decisions.md` (D1-D12, DR-01, DR-02, F1-F22), `identification/01_translated.md`, blueprint rows 15-22 and 23-118 with the protocol P1-P22, `research/01_explore.md` (all 42 actions, slices, engine, error codes, both vocabularies) and `research/01b_explore_contract_dataset.md` in full; the cited lines of `01c`, `01d`, `01e`, `02c`, `02e`, `02f`.
2. Read the shapes in code: `packages/shared/src/api/` (`core-api.ts`, `constants.ts`, `health.ts`, `realtime-messages.ts`, `patterns.ts`, `session-schema.ts`), `packages/shared/src/sim/types.ts`, `vocabulary.ts`, `auth.ts`, `constants.ts`, parts of `pairing.ts`, `api.ts`, `selectors.ts`, `dataset.ts` (credential constants excluded from the output).
3. Checked how the clients gate today's unchecked actions (read-only greps): notes and markers on `SESSION_NOTE`, recovery on `SESSION_START`.
4. Wrote the specification: architecture and ports; state ownership for all 33 slices and 25 stored entities; RBAC (12 permissions, 18 grants, plain-language role table, change propagation); identity; pairing (state tables T1-T9); 75 operations in 13 area tables; the 42 actions mapped; engine with restart recovery; realtime protocol; mode contract; media decision; demo controls; audit; secrets and origins; SR-01 to SR-67; AC-B-01 to AC-B-71; traceability; gap register; decisions for the controller.
5. Mechanical checks on the written file (commands run, output quoted):
   - operation rows: `count: 75  GET: 27  POST: 48`; distinct operationIds `75`; row numbers 1 to 75 with no gap
   - access rules: `PUBLIC 4`, `DEVICE 5`, `AUTHENTICATED 25`, `ANY-OF 1`, single permission `40` (sum 75)
   - action table: `42` rows; execution kinds `31 hosted`, `1 hosted, internal`, `1 not available`, `9 server-native`; "rule today: none" in `25` rows (equals F14)
   - `SR: 67`, `AC: 71` distinct IDs
   - every "section n.m" reference resolves to an existing heading; no build marker left in the file

## Controller verification list (row 15) and where it is met

| Check | Where |
|---|---|
| Each of the 13 feature areas has an operation table | Sections 7.4-7.16; map in 17.5 |
| Every `SimActions` member maps to an operation or a recorded exclusion | Section 7.17 (40 mapped, exclusions X-1 `signInWithSecurityKey`, X-2 `setTabletLink`) |
| The matrix covers every role and permission | Section 4.4 (3 roles by 12 permissions) |
| The pairing state table names an audit type per transition | Sections 6.2 and 6.3 (T1-T9) |
| Every AC-B is testable and traces to a success criterion | Section 16 (each row has a "Tested by" and an "SC" cell) |
| Impact questions 1-3, 8-21 answered with section anchors | Section 17.4 |
| No U1-U9 item is required | Section 17.6 |
| Any departure from a Q1-Q16 default is flagged | Section 17.3: none (DR-02 was recorded before this row) |
| The file ends with "Decisions for the controller to record" | Section 19 |

## Decisions for the controller to record (summary; full text in section 19 of the spec)

1. **New permissions**: `PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL`, all held by SUPERVISOR. Matrix: 18 grants (INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4). `SESSION_NOTE` and `EVIDENCE_VIEW` gain enforcement points.
2. **New audit types (9)**: `ACCESS_DENIED`, `PAIRING_CODE_ISSUED`, `PAIRING_CODE_CLOSED`, `DEVICE_REVOKED`, `DEVICE_CREDENTIAL_ROTATED`, `ROLE_CHANGED`, `USER_ENABLED`, `USER_DISABLED`, `BIOMETRIC_ENROLLMENT_CHANGED`. "Device paired" uses the existing `PAIRING_SUCCESS`. Three of the nine go beyond ADQ-9's list. No new event type. 15 new error codes.
3. **DEPARTURE-3 (needs a decision)**: the three export operations keep the existing `EXPORT_DENIED` denial type instead of the generic one.
4. **DEPARTURE-4 (needs a decision, wording of TD-07)**: the guard runs in `onRequest`, before the body is read, not in `preHandler`.
5. **Choices D11 left open** (section 19.4, 15 items), the largest: 75 operations with GET and POST only; media not served by the server (row 41 SKIPPED, `@fastify/static` not installed); a reset keeps sessions, devices and settings; the `AUDIT_TAMPER` demo fault touches only the engine-held ring; a session in flight at a restart goes to FAULT and is closed as INCOMPLETE; pairing parameters (6 digits, 300 s, one active code, 3 failures lock, 5 close the code); sign-in only from an allowlisted web Origin or a paired device; biometric unlock by a rotating server-issued token; migrations by a command under the owner role.
6. **No departure from a Q1-Q16 default.**

## Findings and open points

- For row 16: 25 stored entities (E-01 to E-25); the reset must carry sessions and devices across the database re-creation (SA-08); migrations by the owner role.
- For row 17: nine open points (client reactions to the control events, the registry's mode model for 75 live operations, rebuilding the simulator error classes from `error.details`, the settle on the revision header, the `touchSession` throttle, a new socket after sign-in and sign-out).
- For row 18: row 41 SKIPPED; row 27 may need a split (zod schemas for 28 slices and about 17 new bodies); five early proofs (SA-01 to SA-05, SA-10).
- For row 20: deviations G-08, G-10, G-11, G-12 (SR-63); GS-01 to GS-09 (no password change, no view permission, the forged-Origin limit of the pairing requirement, bearer session on mobile, in-memory lockout, unaudited server start, unaudited 429, unfiltered state topic, six-digit code hash); whether the eight parity actions should gain audit rows; the parameters chosen without a source.
- The drift test's comparison of documented statuses with the simulator must be limited for the six reads that gain a 401 (section 7.19): the simulator is not rewritten.

## Blockers

None.
