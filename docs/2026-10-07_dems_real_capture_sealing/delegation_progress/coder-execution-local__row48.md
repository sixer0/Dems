# Row 48 — coder-execution-local (phase C, M2-W7) — FINAL

## Status: COMPLETE
Restored `packages/shared` to green after the interrupted attempt (D33/D34 compaction failure).

## Gates (fresh, quotable)
- typecheck `timeout 300 npx tsc --noEmit -p packages/shared </dev/null` → **exit 0**
- lint `npm run lint -w @dems/shared </dev/null` → **exit 0**
- suite `timeout 1200 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null` → **Tests 1849 passed / 18 failed; Test Files 70 passed / 2 failed**
- counts: **89 ops / 34 GET / 55 POST**, offline 23, auditTypes **62** (53→62), errorCodes **40** (31→40), conditions **5** (+SESSION_HOLDER), deviceCommands 4 (+POE_CYCLE), duplicate ids none.

## Remaining red (ONLY the two designated files)
- `api-openapi-scope.test.ts` (12) + `openapi.test.ts` (6) = 18.
- 15 = OpenAPI-vs-registry drift → **row 50** regenerates openapi.json + bumps versions + re-pins.
- 3 (`openapi.test.ts` #16/#17/#18) = simulator parity for capture ops + op-44 device-health shape → **row 51 re-run** (they exercise sim/api.ts directly, NOT openapi.json; regen won't clear them; sim/** is off-limits here).
- None is a row-48 defect. Full attribution in artifact §6.

## Secret-key proofs
- No secret-named detail key in `audit-details.ts`; the 40 keys across the nine new types are identifiers/counts/flags/codes/hashes only. Credential types carry `deviceId` (+operationId/permission/reason code) only.
- Op 89 write-only: request `{username,secret}`, response `CaptureConfigSlice`; no capture slice/device schema holds a credential; `host` never a credential URL.

## Deferrals honoured
- `SIM_SNAPSHOT_VERSION` left at 1 (row 51 atomic bump; D14).
- openapi.json NOT regenerated; lockfile untouched; openapi.ts versions unchanged (row 50).
- src/sim/** untouched except vocabulary.ts (already complete); core-web/mobile/mock-core/release/controller trackers untouched.

## Notable reconciliation
- Reverted a premature out-of-contract `MicClipResetRequest` inputId re-key (op 52 not in C3 §3; sim action unchanged) back to HEAD `channel`.
- Fixed real defects: missing examples (restartDevice req+400, 4 capture write-op 200s, resetDemo 409), op-88 CORE_SERVER_NOTE, `TranscriptSegment.speaker` API-13 (raw string → apiText), op-42 export EXPORTED→QUEUED consumers.

## Files
Artifact: implementation/15_m2_api_contract.md (Tier 3). Tracker: status_tasks.md row 48 → COMPLETE.
Full changed-file list in artifact §7.
