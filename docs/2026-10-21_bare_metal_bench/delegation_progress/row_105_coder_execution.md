# Row 105 (R2.1) - coder-execution - complete

- Report: implementation/57_rflex_capture_config.md
- Files edited: apps/core-server/src/modules/capture-config/network/facts.ts, network/index.ts, network/__tests__/service.test.ts, network/__tests__/routes.db.test.ts
- Tests: service.test.ts 37/37 pass; routes.db.test.ts 21/21 pass (db-runner lock, outside sandbox); typecheck reds only audio-cards (row 131)
- AC-5 met: networkFactsOf(null, interfaces) non-null, allowedPorts [80]; zero-MAC/tunnel/no-MAC//32//0 absent from interfaceSubnets; form checks unchanged and green
- Decisions: D-105-1..4 (report). Outside-ownership effects: fixtures without `mac` in 4 other test files; B6 host-alias throw now needed
