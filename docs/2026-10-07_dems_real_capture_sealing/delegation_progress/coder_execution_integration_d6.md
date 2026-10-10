# coder-execution — integration pass D6

Status: **needs-review** (2026-10-09). Note: `implementation/100_integration_pass_d6.md`.

Done: 1, 3, 4, 5, 6 (Core side), 8, 9, 11, 13 (D159), 14 (D160). Stopped: 2 (migration proposal).
Built except one foreign line: 7 (row 61's boot step). Half: 10 (media 201 produced; `resetDemo 409`
is a product defect in `modules/demo`, F-D6-1). Not built except the Live part: 12 (D156).
Pass D9's announced request (verify report line / V-10 with a server backend) had NOT appeared in
`file_requests.md` when this pass ended (last read 2026-10-09 ~17:40Z): not applied.

New files: `packages/shared/src/sim/core-facts.ts`, `packages/shared/test/sim-core-facts.test.ts`,
`apps/core-server/src/engine/fact-doors.ts`, `apps/core-server/src/engine/__tests__/fact-doors.db.test.ts`,
`apps/core-server/src/plugins/permission-guard/__tests__/session-holder.db.test.ts`.

Edited: see the note §1 and §7 (D6-7). Requests filed: seven lines in `file_requests.md` (pass D6).
No commit, no migration, no lockfile write; OpenAPI regenerated under `.locks/npm.lock`.

Item 15 (D161, device shape `adapter` / `sourceClass` / `sourceOpen`): NOT taken, nothing started; for the next pass.
