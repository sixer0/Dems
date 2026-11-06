# row N11a (wave 12, agent N11a) - status: needs-review (lines complete; suite not green for reasons outside the lines)

Record: implementation/n11a_core_on_protocol_5.md

- Request lines 537-544: 8 of 8 applied, 0 stopped. Edit tool only.
- Files changed: capture/__tests__/{fault-lifecycle,forwarder-advisories,forwarder-engine,protocol-pins,records,ipc,tidy-fy}.test.ts; capture/fence/__tests__/development-session.db.test.ts; test/support/capture.ts; capture/adapters/mic-transport.ts (all under apps/core-server).
- Core tsc: 8 -> 1 (adapters/__tests__/real.test.ts:67, row 88 in flight).
- capture/__tests__ unit run: 13 files pass, 4 fail (22 tests): stub worker capture-stub-worker.mjs:40 still version 4 (20), supervisor.test.ts:53 (1), forwarder.test.ts:62 (1). Two request lines appended to file_requests.md.
- development-session.db.test.ts (throw-away DB): 4 pass, 1 fail = schema pin 14/dbc-15 vs actual 15/dbc-16 (not mine, schema writer's pin).
- Lint: clean.
- Nothing running, no lock held.
