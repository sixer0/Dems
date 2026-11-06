# Wave 12 brief (2026-10-14) - read with driver_rules.md and batch_9_brief.md; where they differ, this file wins

Head: 1fbeada7 (a CHECKPOINT: light checks only; the full suite is postponed to the end of development, decision U26). Schema [13,'dbc-14'], 30 migration files. Contract: 110 operations, 83 audit types, 51 actions, 7 verify notices. Baselines: capture/boot/checks.ts 90b3a1e6, boot/index.ts 63fe763e; helper dems-core-netalias SHA-256 1e758a24...c7d015b1.

## Rules that changed since batch 9
1. Locks: take `.locks/db-migrate.lock` BEFORE `.locks/heavy-host.lock` when you need both; never hold the heavy-host lock idle; every fixture or scenario run is bounded in time. The Mac was restarted: a lock FILE left from before the restart is stale only if no process holds it - follow the lock helper, do not delete lock files by hand.
2. Ports: worker listeners 8559-8564; test camera 8565-8570 are TAKEN by named test files (test/t3_mutation_and_ports.md has the table) - a new test takes 8571-8574 or an ephemeral port and says which; ONVIF double: its closed list. 8554/8556 belong to the kill matrix (agent A1 only).
3. Keys: only through the test fixture `realBootFixture` (OS-temporary directory, a NON-RESERVED synthetic installation id; `DEMS-TEST-01`, `DEMS-IR-01`, `DEMS-JKT-07` are refused by a production boot). Nothing is written under the repository's `.data/`.
4. A production boot on the test host needs: `provideTestCaptureHost(app)` (platform `darwin`), two stand-in programs, a key whose organisational unit matches the test's installation id.
5. No row runs a full suite. Targeted tests of what you touched + the workspace typecheck + the static rule sets. A red that is not yours: report file:line and the area; do not fix it.
6. Mutation honesty: a new test that guards a rule states the mutation it was seen RED on.
7. Real devices (decisions U23, U24): only rows that say so in their brief. Everyone else: doubles only. The built-in microphone and camera of this Mac: never.
8. Docker is not running; do not start it. PostgreSQL runs; do not start, stop or reset it; throw-away databases only; never the demo, lane or `dems_test_m12_row232` databases.
9. Shared files, one writer in this wave:

| File or area | Writer |
|---|---|
| packages/shared (all), every operation / audit / action / notice count pin, openapi.json | N2 |
| packages/capture-protocol | nobody in this wave (N1 waits for A1) |
| apps/capture-worker/** | A1 runs it, nobody edits it |
| capture/adapters/local/mic-helper-args.ts + capture/__tests__/static.test.ts | N4 |
| capture/adapters/production-door.ts | N5 (a pin it needs in the capture static list: a request line to N4) |
| capture/adapters/audio/ NEW macOS listing files + card-listing.ts (one word) | N6 |
| capture/adapters/audio/ NEW pure reader of the helper's lines | N8 |
| apps/core-web, apps/mobile | W5 |
| modules/devices/status.ts (bitrate) + the four surviving tests | CB |
| scripts/hardware-acceptance/**, scripts/host/HOST-PROFILE*, scripts/host/INSTALLER-NOTE* is C2's | C1 (chapters, collectors, host profile) |
| README.md, scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md | C2 |
| capture-session, sealing, sealing-host (diagnosis: tests and reading; a fix only if it is a few lines) | D1 |
| capture/fence/*, capture-composition.ts, capture/boot/*, capture/adapters/camera/*, capture/signer/* | NOBODY in this wave (reserved for the lift, row 88) - request lines only |

10. Requests go to delegation_progress/file_requests.md (one line); claims to file_claims.md FIRST, with the Edit tool.
11. Report: status, files, result lines, decisions, requests - under the word limit of your brief.
