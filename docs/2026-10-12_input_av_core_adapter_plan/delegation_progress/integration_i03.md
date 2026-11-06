# Integration pass I-3 (track D) - short record

Status: needs-review (all eight items built; one red left that is row 177's; six driver decisions, DD-1 first). Full record: `implementation/i03_integration_pass.md`. Nothing committed, nothing staged.

## Done (items of the fixed list)
1. `apps/core-server/src/capture/fence/__tests__/development-session.db.test.ts`: the three address pins hold the prefix `<session>/<track>` and the form of the element (22 URL-safe characters), never a value; helpers named by listener port (DD-2).
2. `apps/core-server/src/capture/index.ts`: the launcher passes `operation === CaptureOperation.REAL_PRODUCTION`; two names added to the export of `./worker-arguments`; one case in `__tests__/module.test.ts`.
3. NEW `apps/core-server/src/capture/ingest-address.ts` (imports nothing; `captureIngestAddress(sessionId, trackId, chance)`); exported by the capture index; the session imports it and hands in `randomBytes`; row 47's test follows. No static list edited.
4. `apps/core-server/src/plugins/config/load-config.ts` reads `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD` through `parseCapturePath` (the per-key call of the existing program keys; nothing generic, no file check built); two cases in its test.
5. Rate-less format: mobile `session-live/live-feed.tsx`; web `devices-panel.tsx`, `inputs-panel.tsx`, `device-drawer.tsx`; one case each.
6. `apps/core-server/src/db/seed/demo-helper.ts`: `signalChild` guard; one spy case.
7. `capture/adapters/index.ts` exports the production door and the card listing; `core/index.ts` exports the reveal reason list. No export-list pin exists.
8. `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` section 3.10, HOST-50 to HOST-56, each "to confirm on the host"; `test_host_profile_scripts.sh` counts 49 + 7.

## Checks
- Typecheck, five workspaces: exit 0 each.
- Core unit, 26 files: 1 failed | 25 passed, 3 failed | 371 passed (the failed file is `tidy-fy.test.ts`, row 177). Core unit, 5 folders: 22 files, 425 passed.
- Database: `session-capture.db.test.ts` 59 of 59; fence file 2 failed in run 1 (helper order), 5 of 5 after DD-2; 0 databases remain.
- Core web 3 files: 56 passed. Mobile 1 file: 12 passed. Host scripts: 171 passed, 0 failed.
- Secret scan: `ingest-secret: 0`.
- Not run: `npm test`, `npm run test:db`.

## Remaining red
`apps/core-server/src/capture/__tests__/tidy-fy.test.ts` (3 cases, first at `:122`): the stand-in worker `test/support/capture-stub-worker.mjs:77` says `capture-worker/0.5.0`, the Core expects `0.6.0` (`capture/boot/checks.ts:285`) -> row 177.

## Driver decisions
DD-1 chance is a parameter of the address function (G-R8; no list entry). DD-2 helpers named by port in the fence test. DD-3 the address composed from a scheme constant (G-R4). DD-4 refusal `CAPTURE_INGEST_CHANCE_REFUSED`. DD-5 `95-database.sh` not edited; the test counts 49 + 7. DD-6 inline comparison at the launcher line.

## Left in `file_requests.md` (three lines "integration I-3")
Row 179: a source of chance handed to the supervisor. `scripts/host/95-database.sh`: header and ids. `credential-reader.ts`: optional typing by the exported reason type.
