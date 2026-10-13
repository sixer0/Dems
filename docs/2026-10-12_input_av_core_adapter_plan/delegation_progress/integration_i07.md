# Integration pass I-7 - short record (2026-10-13)

Status: **needs-review** (one edit outside the literal list, DD-1; one finding that can turn the database suite red, F-1). Full record: `implementation/i07_integration_pass.md`.

Edit tool only for every existing file. No commit, no stage, no stash. Nothing under `apps/capture-worker/` or `apps/input-av/`; no schema, migration or fence source file.

## Items
1. Schema pins: nothing left to move (both named lines already `[8, 'dbc-9']`; the search finds history files only); both files green.
2. C43 (2): `test/acceptance/contract.test.ts` runs on the product's registrar; AC-B-70 corrected (the registry of operation 77: the pair, then registered microphones). C43 (3): the action states `['AUDIO']`; no registry rule forbids it - the read-back in `db/mapping/rows.ts` follows (DD-1).
3. `adapters/types.ts`: `sourceFacts?` + `AudioSourceStatement`; `CameraSourceTarget.attempt` / `.sessionId` existed; the session's target line fills both. Fence type NOT moved (closed file) - request filed.
4. A-9: `audio/mic-loss` added. Row-81 pin not moved: `hostCommandRunnerOver` has no caller yet (C46, row 85).
5. The three named reds: green as found, nothing edited.
6. `otherMicInput`: deleted in mobile with its test; kept in web (caller `features/session-monitor/audio-source.ts:177`).
7. `createOnvifTimeReader` in `camera/onvif-session.ts` with six unit cases; export pin moved by two names; wired nowhere.
8. `common.captureSlotRefusal` (two sentences) with one test case.

## Code files changed
- `packages/shared/src/sim/capture-registry.ts`, `src/i18n/en/common.ts`, `test/sim-capture-discovery.test.ts`, `test/i18n.test.ts`
- `apps/core-server/src/db/mapping/rows.ts`, `src/db/mapping/__tests__/from-rows.test.ts`
- `apps/core-server/src/capture/adapters/types.ts`, `src/capture/adapters/camera/onvif-session.ts`, `src/capture/adapters/camera/__tests__/onvif-session.test.ts`
- `apps/core-server/src/capture-session/index.ts` (one line), `src/capture-session/__tests__/ingest-address.test.ts`
- `apps/core-server/src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts`
- `apps/core-server/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts`, `test/acceptance/contract.test.ts`
- `apps/mobile/src/features/capture-selector/mic-input-name.ts`, `mic-input-name.test.ts`

Docs: this file, `implementation/i07_integration_pass.md`, one line in `file_claims.md`, five lines in `file_requests.md`.

## Checks (result lines)
- static, as found: `Test Files 18 passed (18)`, `Tests 260 passed (260)`
- unit after the edits: `Test Files 39 passed (39)`, `Tests 942 passed (942)`
- unit on loopback (camera adapters, capture session): `Test Files 13 passed (13)`, `Tests 263 passed (263)`
- shared (registry action, i18n, sync, openapi no drift): `Test Files 7 passed (7)`, `Tests 277 passed (277)`
- mobile: `Tests: 5 passed, 5 total`
- acceptance, the two files alone: `Test Files 2 passed (2)`, `Tests 78 passed (78)`
- database, seven files together: `Tests 30 failed | 161 passed (191)` - 1 own pin (moved), 29 the clone limit; then each failed file alone: routes.db `17 passed (17)`, fence.db `42 passed (42)`, session-capture.db `86 passed (86)`
- typecheck: shared, core-server, core-web, mobile, mock-core exit 0; `openapi.json` not regenerated (no schema changed)

## Remaining
- No red test in the files run.
- F-1 (controller, before the suite run): `test/helpers/db/names.ts:186` refuses the 100th live clone; fence.db (row 33) and session-capture.db (rows 71, 188) met it when run side by side.
- F-2 / F-3 (row 85, `9A/H-09`, `9A/H-10`): the ONVIF time is exact to one second; "answered" includes a device that keeps its clock behind authentication.
- F-4: the card statement is declared in three places until the fence may be edited.
- F-5: no client reads the two new sentences.
- F-6: agent SC's two A-9 entries (`camera/camera-watch`, `camera/onvif-network`) not added (not in the list).

## Driver decisions
DD-1 the read-back line in `db/mapping/rows.ts`; DD-2 the stand-in entry states `AUDIO`; DD-3 a rule, not an exemption, for the registry in AC-B-70; DD-4 a new type name in `types.ts`; DD-5 an instant only from a `UTCDateTime` element, a refusal read from the answer; DD-6 the group `common.captureSlotRefusal`; DD-7 a planted control for the A-9 entry; DD-8 the second pin of the same microphone in `routes.db.test.ts`.
