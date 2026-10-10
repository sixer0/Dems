# coder-execution — integration pass D10

Status: **needs-review**. Note: `implementation/104_integration_pass_d10.md`.

| Item | State |
|---|---|
| 1 simulator situation C | done |
| 2 device shape | NOT wired (shape + pure rule built; door and caller requested; `.fails` kept) |
| 3 CS-09 boot call | done |
| 4 `resetDemo 409` | done |
| 5 `transcript.revision` | clients done; Core half requested |
| 6 server-backend model in the verify report | done |
| 7 two client tests | green, nothing to fix |

## Files

NEW
- `packages/shared/src/sim/capture-session.ts`
- `packages/shared/test/sim-capture-start.test.ts`
- `apps/core-server/src/engine/__tests__/capture-session-parity.test.ts`
- `apps/core-server/src/modules/storage/__tests__/volume-at-boot.db.test.ts`
- `apps/core-server/src/evidence-verify/__tests__/transcript-model.test.ts`
- `apps/core-web/src/features/session-monitor/__tests__/simulator-start.test.tsx`
- `apps/core-web/src/features/evidence/__tests__/transcript-follows-revision.test.tsx`
- `apps/mobile/src/features/session-live/simulator-start.test.tsx`
- `apps/mobile/src/features/evidence/transcript-follows-revision.test.tsx`

EDITED — product
- `packages/shared/src/sim/{constants.ts,session-machine.ts,engine.ts,actions.ts,scenarios.ts,api.ts,index.ts,types.ts,core-facts.ts}`
- `packages/shared/src/api/{state-slices.ts,evidence.ts}`; `packages/shared/openapi/openapi.json` (generator)
- `packages/shared/src/evidence-verify/{types.ts,verify.ts,report.ts}`
- `apps/core-server/src/capture/boot/index.ts`
- `apps/core-server/src/modules/demo/reset.ts`
- `apps/core-server/src/evidence-verify/index.ts`
- `apps/core-web/src/features/evidence/{transcript.ts,transcript-pane.tsx}`
- `apps/mobile/src/features/evidence/{transcript.ts,transcript-pane.tsx}`

EDITED — tests
- `packages/shared/test/{session-machine,sim-api,sim-gap-closure,sim-v2-parity,sim-core-driven-seal,integration-c1,sim-core-facts}.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/{routes.test.ts,operations.db.test.ts}`
- `apps/core-server/src/engine/__tests__/commands.db.test.ts`
- `apps/core-server/src/capture/boot/__tests__/boot.test.ts`
- `apps/core-server/src/modules/demo/__tests__/{reset-order.test.ts,static.test.ts}`
- `apps/core-server/src/evidence-verify/__tests__/{support.ts,core-verification.test.ts}`
- `apps/core-server/test/acceptance/contract.test.ts`

DOCS
- `delegation_progress/file_claims.md` (three lines), `delegation_progress/file_requests.md` (six lines)

## Open, by request line

- `engine/errors.ts`: `details.reason` of a simulator refusal
- `engine/capture-session.ts`: re-export the shared transitions, drop the parity file
- engine fact door + caller for the source facts (item 2)
- `modules/transcripts`: heads at boot (item 5)
- row 92: the model line in the client verify report
- finding: `toApiSession` does not carry `captureDurable`

Scratch logs: `.cache/d10/` (not in git).
