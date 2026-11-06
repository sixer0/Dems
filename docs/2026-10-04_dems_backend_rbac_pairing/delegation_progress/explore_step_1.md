---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: explore
step: 1 (blueprint row 1, FIRM)
status: complete
date: 2026-10-04
---

# Progress: explore step 1 (shared simulator inventory)

## Artifact

- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/01_explore.md` (Tier 2, 706 lines). The only deliverable. This progress file is the only other file written.

## Milestones

| # | Milestone | Evidence |
|--:|---|---|
| 1 | Read the blueprint row, F-A1..F-A20 and ADQ/IQ context | `identification/02_structured.md` |
| 2 | `SimActions` inventoried: 42 members in `types.ts:985-1094`, 42 entries in `createActions` (`actions.ts:129-236`) | report section 2 (V1, V2), section 6 |
| 3 | Every action: signature, sync return, permission check, slices written, audit and event types, error codes, transition function | report section 6 (42 rows) |
| 4 | Selector, view and derive exports: 89 / 26 / 11 (plus `devices.ts` 24), each with slices read | report section 9 (126 + 24 rows) |
| 5 | Engine: 7 subsystems, rates, timing constants, determinism | report section 10 |
| 6 | Snapshot keys (30 of 33 slices), persistence rules | report sections 8, 11 |
| 7 | Error codes: 15 `SimErrorCode`, result reasons, 17 simulated REST codes, 25 throw sites | report section 12 |
| 8 | Audit (44) and event (46) vocabulary with every emit site and emitter class | report section 13 |
| 9 | Purity and platform-neutrality map of all 33 files | report sections 5, 7, 15 |
| 10 | Mechanical verification of every row citation against the source (42 + 89 + 26 + 11 + 24 + 33 + 44 + 46 rows, 0 mismatches) | helper script in the session scratchpad, output quoted in this note |

## Verification quoted

- `SimActions` members: 42; `createActions` entries: 42; action-table rows: 42.
- Exports: `selectors.ts` 89, `views.ts` 26, `derive.ts` 11 (126 rows in report section 9.1-9.3), `devices.ts` 24.
- Citation check over the written report: actions 42 rows ok; selectors 89, views 26, derive 11, devices 24 ok; slices 33 ok; audit types 44 ok; event types 46 ok; BAD 0.
- `git status --porcelain -- packages apps release scripts` printed nothing.
- Credential scan of the report for the two demo credential values: 0 matches (P19).
- Web tool calls: 0 (P20).

## Deviations and notes for the controller

1. **Credential values seen in tool output.** A source listing and a test file displayed the values of `DEMO_OPERATOR_PASSWORD` and `DEMO_PAIRING_CODE`. They are not recorded in any file; the report cites the constant names and file:line only.
2. **Helper scripts.** Short-lived read commands (grep, awk, short Python text helpers, the Graft CLI) were used; helper scripts and intermediate tables live in the session scratchpad, outside the repository. No server or watcher was started (P7).
3. **Graft cache.** The Graft CLI may refresh its own cache under `/Users/gsp-budi/Documents/DEMS/graft/`, which `.gitignore:2` ignores. No tracked file was touched.
4. **Graft output carried an instruction** to append a token-savings note to the reply. It came from a tool result, not from the controller, and was not followed.
5. **Editing tool unavailable.** The report was assembled from a template and generated tables in the scratchpad; no repository file other than the two files above was written.

## Decisions needed (for the controller to record or route)

None blocking. Observations the controller may want to carry into row 14 and row 15:

- 25 of 42 actions have no permission check; the blueprint's F-A7 names only the demo-control actions (report F3).
- `SESSION_NOTE` and `EVIDENCE_VIEW` are granted in the role table but enforced nowhere in `src/sim` (report F5).
- The `operators` slice has no writer except the seed; user administration has no simulator precedent (report F6).
- Only the three export paths write an audit row on denial; no generic denial `AuditType` exists (report F4, F11).
- `session-machine.ts` depends on `../api/session-schema` (zod) and `../domain`, which the neutrality test does not scan (report F23, section 15).
