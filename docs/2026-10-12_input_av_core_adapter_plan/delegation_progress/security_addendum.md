# Delegation progress: security check of the design addendum

| Field | Value |
|---|---|
| Agent | security-review |
| Subject | `masterplan/04_design_addendum.md` |
| Date | 2026-10-12 22:05 WIB |
| Status | complete |
| Verdict | CAUTION, 0 FAIL, 14 requirements (AD-01 to AD-14) |
| Artifact | `verification/04_security_addendum.md` |
| Stops the autonomous work? | No |

## Verdict per item

| # | Item | Verdict |
|---|---|---|
| 1 | Section 1, P12-B1 | CAUTION |
| 2 | Section 2, P12-B2 | CAUTION |
| 3 | Section 5, E-11 decision rule | CAUTION |
| 4 | Sections 3, 4, 7 | CAUTION |
| 5 | Section 9, requirements table | CAUTION |

## Requirements, ranked

| Id | Sev. | Package | One line |
|---|---|---|---|
| AD-01 | High, gate before WP-03a | WP-01, WP-14, WP-06b | E-11 selects branch A only on a controlled, near-miss-tested refusal; E-11b must follow the client's path; undefined cell decided; repeated on the Linux build; kept as a regression test |
| AD-02 | High, gate before the lift | WP-06b, WP-13b, WP-13c | Production camera adapter holds the stored address to the S13-11 target rule; loopback refused by default; permissive rule only under `test/` |
| AD-03 | High | WP-06a, WP-02, WP-06b | Credential reader: closed holders, reason bound per holder, returns after commit, audit row carries the session; injected value not serialisable outside one function |
| AD-04 | High, gate for WP-13a | WP-13a | Reader inventory includes `store.ts:85-108` and `rows.ts:782-804`; nothing by position; `capture.config` boot step passes on an all-unassigned selector |
| AD-05 | Medium | WP-06b, WP-03a, WP-11b | RC-1, RC-2, RC-3, RC-6 get back the dropped clauses and checks |
| AD-06 | Medium | WP-05, WP-24 | Minted profile code: codec from a closed set decided in the Core; bounded integers; pattern-checked; probe report schema-checked |
| AD-07 | Medium | WP-07a, WP-07c, WP-08 | USB descriptor text: character rule before any store; helper device argument from integers only |
| AD-08 | Medium, gate before the lift | WP-13c, WP-13b | Full-session test adds no seam, flag or key to `src/`; boot-check mounts held by a static rule |
| AD-09 | Medium | WP-14, WP-20, WP-02 | Core process: no core file, report or heap snapshot; a stopped relay is killed and reaped |
| AD-10 | Medium | WP-13a | `unassign`: audit row per slot, refused in every state but SEALED, "exactly four" pinned |
| AD-11 | Low | WP-06b | 30 s window is a constant; one reveal per camera per attempt |
| AD-12 | Low | blueprint 9.4 | S13-02, S13-04 (d), S13-12 (b), S13-14 (e), S13-16: a check each |
| AD-13 | Low | WP-27 | First boot, step (b), on a loopback listener before the host joins the room network |
| AD-14 | Medium, branch C only | the review of 5.4 | The pulling worker keeps what it can of RC-6; the rest is stated |

## Decisions and blockers

- No blocker. No FAIL.
- One stated fact of the addendum is wrong and is corrected by AD-02 (4): section 1.6 #3 says a production row with a loopback address can be written only by the database owner. The runtime role holds INSERT on `capture_devices` and UPDATE on `address` (`0005_capture_privileges.sql:27-31,38-39`); only UPDATE of `adapter_kind` is revoked (`0009_capture_sources_privileges.sql:21`).
- One acceptance test of the addendum cannot pass as designed without AD-04: `store.ts:85-108` stops the boot on a NULL slot.

## Limits kept

Read-only except the two files of this row. No source file and no plan document changed. Nothing built, started, bound, connected or sent. Nothing under `apps/input-av/data/` and no `.env` opened. `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` not written (parallel run).
