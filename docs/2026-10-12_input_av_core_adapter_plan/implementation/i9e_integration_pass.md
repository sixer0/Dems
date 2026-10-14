# Row I-9e - integration pass (wave 12, track D), decision C132

Status: complete. Edit tool only on every existing file (one small edit after re-reading); no whole-file write, no scripted replace; no commit.

## 1. Rename of the cause
`ProfilesNotStoredCause.SESSION_OPEN` -> `SESSION_ACTIVE` (key and value). Grep of `apps/core-server/src/modules/capture-discovery` found 4 lines, all this cause (none a reveal reason), now 0 left:
- `adopted-profiles.ts:56` (key and value, one line), `:151` (the use)
- `__tests__/adopted-test.test.ts:1052` (`cause`), `:1128` (`storedProfilesWords` input)
`adopted-test.ts:402` only carries `profilesCause: profiles.cause`, no literal. Nothing in packages/ or other apps uses the type.
R-5 (`capture-config/__tests__/static.test.ts:175`): green, test file unchanged; its planted control (:160) green (detects).

## 2. Module edge and member
- `test/static/imports.test.ts`: `MODULE_TO_MODULE` gains `src/modules/demo -> src/modules/capture-config` (kept in sorted order) and its reason in the header comment ("C132: the demo reset reloads the network facts (review 120b S2-01 (c), row NF)").
- `modules/demo/host.ts`: value import `captureNetworkConfigControl` from `../capture-config` (barrel `capture-config/index.ts:106`, defined `network/index.ts:143`; signature `(app: { stages: object })`, `reload(): Promise<void>` at :109 - unchanged by V7b at the time of reading, no adaptation). Member `reloadNetworkFacts: () => captureNetworkConfigControl(app).reload()` in `createResetHost`; header comment line added. `app.ts` not touched.
- CONSEQUENCE (not in the list, minimal): `modules/demo/__tests__/static.test.ts` pins the exact set of import sources of the folder; one entry `'../capture-config'` added (after `'../../realtime'`). Reported for the controller.
- Test: `modules/demo/__tests__/host.test.ts`, one appended case "the network facts after a reset": a stand-in `app` and `vi.mock` of the door (partial mock, `importOriginal` spread because `support.ts` loads `app.ts`); proves the member exists, calls `reload` once per call on the app handed in, and nothing before. Double: the recorder; unproven: the real `reload` against the table (covered by the I-9c / network tests).
- Mutation honesty: RED on the member removed from `createResetHost` (`expected undefined to be type of 'function'`), restored, green.

## Checks
- unit: capture-discovery + capture-config static + modules/demo + test/static/imports.test.ts: 16 files, 373 tests passed.
- host.test.ts alone: 13 passed (12 before the new case); mutant run: 1 failed | 12 passed.
- db (throw-away harness, `.locks/db-migrate.lock`): modules/demo, 5 files, 47 tests passed (the three reset db files: 25 passed).
- `tsc --noEmit`: 11 errors, none in a file of this row: capture/__tests__/fault-lifecycle.test.ts (1), forwarder-advisories.test.ts (1), forwarder-engine.test.ts (2), capture/adapters/mic-transport.ts (2), capture/fence/__tests__/development-session.db.test.ts (2), capture-config/__tests__/adopted-camera-test.db.test.ts (1), camera-adapter-open.db.test.ts (1), test/support/capture.ts (1). Not fixed.
- `oxlint` on src/modules/demo, src/modules/capture-discovery, test/static: exit 0, no output.
- Nothing left running; no port bound by me.
