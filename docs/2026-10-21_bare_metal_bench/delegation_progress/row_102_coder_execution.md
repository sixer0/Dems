# row 102 (R2.1) coder-execution - 2026-10-22
status: needs-review
files: apps/core-server/src/capture/destination-rule.ts (edit), apps/core-server/src/capture/__tests__/destination-rule.test.ts (edit), implementation/54_rflex_destination_rule.md (new), this file (new); file_claims.md (4 lines appended)
tests: destination-rule.test.ts 195/195 passed
typecheck core-server (heavy-host lock): exit 2, errors only in src/modules/capture-inputs/audio-cards/service.ts:299,532 (and in run 1 macos-card-listing.test.ts) - other rows; 0 in row-102 files
not touched: test/support/loopback-destination.ts, stored-camera-address.ts (no interfaceSubnets need)
decisions: D-102-1..4 in implementation/54 (class before step 0; malformed context still NOT_CONFIGURED for TP/SC; alias entries excluded as sources; optional member, inline element type)
heads-up rows 103-106: TP/SC contexts without interfaceSubnets now refuse NOT_CONFIGURED
