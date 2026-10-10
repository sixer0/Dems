# coder-execution - wave H, closing pass Z1 (server / shared leftovers)

- Status: **needs-review** (ten of ten items built, green in tests; nothing driven live)
- Note: `implementation/128_fix_wave_h_z1.md`
- No commit, no migration, no git write, no formatter run, gate environment not used.

## Files

NEW
- `packages/shared/test/sim-wave-h-z1-time.test.ts`
- `packages/shared/test/sim-wave-h-z1-connect-hold.test.ts`
- `packages/shared/test/api-wave-h-z1-demo-fault-strict.test.ts`
- `apps/core-server/src/engine/capture-checkpoint-doors.ts`
- `apps/core-server/src/engine/__tests__/capture-checkpoint-doors.test.ts`
- `apps/core-server/src/engine/__tests__/wave-h-z1-connect-hold.test.ts`
- `apps/core-server/src/sealing-host/installation-identity.ts`
- `apps/core-server/src/sealing-host/__tests__/wave-h-z1-installation-identity.test.ts`
- `apps/core-server/src/capture/fence/__tests__/wave-h-z1-speech-fixture-format.test.ts`
- `apps/core-server/test/support/speech-fixture-setup.test.ts`

EDITED (shared)
- `packages/shared/src/sim/{core-facts,generator,health,engine,selectors,session-machine,capture-session,constants,types,api}.ts`
- `packages/shared/src/api/{state-slices,demo-controls}.ts`
- `packages/shared/test/{sim-wave-h-a-generator,sim-capture-discovery}.test.ts`

EDITED (core-server)
- `src/config.ts`, `src/plugins/config/load-config.ts` (waived, D207)
- `src/engine/{host,headless-sim,index}.ts`, `src/engine/__tests__/static.test.ts`
- `src/capture-session/index.ts`, `src/capture-session/__tests__/session-capture.db.test.ts`
- `src/sealing/pipeline/controller.ts`, `src/sealing/__tests__/pipeline.test.ts`
- `src/sealing-host/{session-reader,index}.ts`, `src/sealing-host/__tests__/{sealing-host,wave-h-a-manifest-facts}.test.ts`
- `src/capture/adapters/local/{process-door,index}.ts`
- `src/capture/fence/{fake-mic,boot,index}.ts`, `src/capture/fence/__tests__/fake-mic.test.ts`
- `src/capture/__tests__/static.test.ts`
- `src/modules/demo/__tests__/routes.test.ts`
- `src/modules/sessions/__tests__/journey.db.test.ts`, `src/db/fixtures/__tests__/audit-details.test.ts` (pins of driver B's fixes)
- `apps/core-server/test/support/config.ts`

EDITED (other)
- `scripts/capture/speech-fixture.mjs`
- `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` (erratum PE-WH-01 + index line)
- `delegation_progress/file_claims.md` (two lines), `delegation_progress/file_requests.md` (three lines)

## Request lines filed

- 10:30:00Z to Z2: member names (`session.captureCheckpoints`, `time.hostClock`, the pre-check note, `isHostClockTime`, `isPrecheckNote`).
- 10:58:00Z to Z2: simulator op 97 without source class, strict fault request, no idle event, empty time history, REST session not extended.
- 10:58:00Z to the docs owner: the two env keys, evidence spec fields 20 / 21, the fixture format rule, the time note, no env key for the connect hold.

## Open

- Decisions 1-9 of the note, section 2.
- Runs for the test runner: note, section 5.
