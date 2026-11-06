# Row V7c (wave 12, agent V7c) - status: complete

Record: `implementation/v7c_idle_state_and_reason.md`.

- (1) C126 (b): selector line `streamState` NULLABLE (null = NOT READ, as the registry entry's); a registered camera (entry with `adapter`) is null at assignment and restart, LIVE only while an open session's ingest says CONNECTED, null again when the ingest ends outside a recording, and after a stream fault's last clear LIVE only while RECORDING. Built-in demo cameras unchanged; simulator tests unedited.
- (2) C130: `CAMERA_PROFILE_WITHOUT_STREAM` + its sentence in `common.captureSlotRefusal`; Core `PROFILE_WITHOUT_STREAM_REASON` = the new word; S86a expectations follow.
- (3) C139: `SYSTEM_BOOT_HOST_DETAILS_EXAMPLE` + `microphonePermission: 'NOT_KNOWN'` (does not reach openapi.json).
- OpenAPI regenerated (110 operations; the three `streamState` schemas only). Counts unchanged.
- Mutations M1-M6 (9 in all) seen RED, reverted.
- Checks: shared 998 + 55 green, tsc/oxlint 0; Core unit 706 green (20 loopback stub tests of camera-network / factory-scan EPERM in the sandbox; the re-run waited 23 min on the heavy-host lock behind another session's e2e and was stopped - not re-run, files untouched by this row), db 57/57, tsc only N13's 9 known errors; web tsc/lint 0, 1 red = W6's `named` pin; mobile tsc/lint 0, 485 green.
- Requests: 5 lines (W6 web pin - blocking that test; W6 mobile word; W6 null words; op 44 fallback; slices.ts builders).
- Edit tool only for existing files; nothing committed; nothing left running.
