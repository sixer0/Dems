---
row: E-fix FX-C (core + shared engine)
agent: coder-execution
date: 2026-10-06
status: complete
report: gateway_check/11a_efix_core.md
---

# FX-C — delegation progress

## Status

complete. Three defects fixed with tests; every mutant killed; final suites green (shared 70 files /
1848 tests, Core unit 155 / 3926, Core db 124 / 1751 on helper clones, typecheck and lint exit 0 in
shared, core-server, core-web, mobile). Full evidence: `gateway_check/11a_efix_core.md`.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 11:13 | Inputs read (D198, D200, D201; 07a, 07d, 07e; engine host W26); rollback copies taken |
| 11:30 | Defect 1 first cut (session members `startedBy`/`stoppedBy`) — refused by the Core's lossless round trip (22 unit failures); reverted, member-free design via audit rows (FXC-1) |
| 11:35 | Defects 1 and 3 green in shared; Core unit suite green |
| 11:39 | Defect 2: hub debounce, `device.session` publication, identity paths; unit, db and acceptance tests |
| 11:45-11:48 | Mutation runs on copies: 15/15 killed; pre-fix acceptance run reproduces E2E-S-2 (0 hints) |
| 11:55 | Final full db suite green; report written |

## Decisions (for `decisions/decisions.md`)

- **FXC-1** Custody start/stop actor = actor of the session's own RECORDING_STARTED / RECORDING_STOPPED
  audit row (newest first; creator only if the row left the 1,000-row ring). No new session member: the
  Core stores the session as `active_session` columns and its round trip (MR-1) refuses an unstored
  member; a column is a database contract revision (`masterplan/03_database_contract.md`, 302 columns /
  25 FKs asserted by `contract-inventory.test.ts`), migration 0004, schema version 2 and `db:migrate` of
  the four live databases — outside FX-C's paths. Proposed follow-up (MAJOR) only if the start actor of
  >2 h sessions started by a non-creator must be exact.
- **FXC-2** New publication kind `device.session` (device IDs only). The hub folds it with device socket
  admission/departure into ONE `admin.changed DEVICES` after 1 s without change, capped at 5 s from the
  first change; an immediate DEVICES hint clears the wait. Published by password and biometric sign-in,
  sign-out, expiry, `endForOperator`, `endBiometricSessions`; not by `endForDevice` (its callers publish
  at once).
- **FXC-3** Note label by the author's role at write time, in the NOTE timeline item's params
  (`authorRole`); i18n `session.timeline.noteBy.*`, neutral `kind.NOTE` "Note Added", type labels
  "Note added". No record or contract change (the note record already has `authorId`).

## Blockers

None. Nothing outside FX-C's paths was needed.

## Notes for the controller

- Restart needs no extra step: no migration, no schema version, no contract or OpenAPI change
  (`openapi.json` byte-identical to before).
- Already-sealed items with the old `RECORDING_STOPPED` attribution (not rewritten): lane 3
  EV-20261006-0014; lane 2 EV-20261006-0015, -0016; lane 1 EV-20261006-0019, -0020, -0021 (the last
  mapping inferred). `dems_demo` unaffected in the logged window. A read-only SQL to list all is in the
  report §5.
- Stale doc comments in `apps/core-web` (`devices-panel.tsx:31-35`, `device-drawer.tsx:364-367`) still
  call RESIDUAL-W70-1 open: for FX-W. The web "Session note" drawer title still reads "Investigator note"
  (`i18n/en/session.ts:166`, not in the finding).
- Re-test hints: Paired Devices updates about 1-1.5 s after a device sign-in/out; a supervisor's note
  reads "Supervisor Note Added" on the tablet and the web; older notes read "Note Added".
- Related, out of scope: RESIDUAL-W77-1 (Users & Roles active sessions) still gets no `admin.changed
  USERS` on a sign-in or sign-out elsewhere.
