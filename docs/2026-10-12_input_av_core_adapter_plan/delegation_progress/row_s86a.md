# Row S86a - complete

C-1 of row 86 (C127): a production camera's listed profile without its stored stream row (`capture_device_streams`) is refused at ASSIGNMENT (operations 78 / 79, held slot included), real capture only.

- Files: `apps/core-server/src/modules/capture-config/routes.ts`, `store.ts`, `__tests__/routes.test.ts`, `__tests__/capture-config.db.test.ts`.
- Refusal: 422 `INVALID_INPUT`, `details.reason` = `CAMERA_PROFILE_NOT_OF_DEVICE` behind seam `PROFILE_WITHOUT_STREAM_REASON`; message = re-adopt sentence (`PROFILE_WITHOUT_STREAM_TEXT`).
- Real vs simulated: registry provided + adapter `ONVIF_RTSP` (row 187's gate); Simulated makes no read.
- Mutants M1-M4 RED. Unit 125/126 (R-5 static.test.ts:175 = I-9c), routes.test 28/28, db file 36/36, tsc errors none in my files, oxlint exit 0.
- Requests: new reason word + i18n + clients (V7b / W5), README sentence (C2).
- Record: `implementation/s86a_assignment_stream_row.md`. Edit tool only for existing files.
