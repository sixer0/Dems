# Row 112 (R2.1) - NETWORK_NOT_CONFIGURED branch removed from the console camera connection test

Status: needs-review (own tests green; 6 canary tests red from a cause outside the row; typecheck red only in a file outside the row)

Changes (apps/core-web/src/features/devices/):
- camera-connect.ts: removed the `'NETWORK_NOT_CONFIGURED'` union member and its doc comment, the `COMMISSIONING_NOT_CONFIGURED` mapping in `connectRefusal`, and the now-unused `CaptureCommissioningReason` import. A 409 with that reason now falls to `'OTHER'`.
- camera-connect-dialog.tsx: removed the `REFUSAL_TONE` entry and the `case 'NETWORK_NOT_CONFIGURED'` of `RefusalNotice`.
- __tests__/camera-connect.test.tsx: removed the NETWORK_NOT_CONFIGURED expectation; added `of(409, ..., 'COMMISSIONING_NOT_CONFIGURED') -> 'OTHER'` control (the 503 control kept).
- __tests__/camera-connect-canary.test.tsx: removed the F3-06 test (whole `it`, its NOT_TESTABLE control is covered in camera-connect.test.tsx) and the now-unused `enWeb` import.
- No i18n file touched (keys left for row 135).

Verification:
- `grep -rni networkNotConfigured apps/core-web/src/features` = 0 hits.
- `npx vitest run camera-connect.test.tsx camera-connect-canary.test.tsx --maxWorkers=2`: Test Files 1 failed | 1 passed; Tests 6 failed | 19 passed (25). camera-connect.test.tsx passes. The 6 canary failures all read `FakeTransportUnscriptedError: no answer is scripted for GET /api/v1/device/health (getDeviceHealth)` - tests I did not edit (R69-12, R69-13, row-of-tested-candidate, observer test); cause is the uncommitted devices/index.tsx / other row's health poll, not this removal. Not fixed (outside ownership).
- `npm run typecheck -w @dems/core-web`: only remaining error `src/features/devices/__tests__/audio-cards.test.tsx(29,75): TS2322 boundTo undefined` (not my file; shared-package/other-row change). An earlier red in packages/shared/src/api/capture-audio-cards.ts (syntax) was transient from a parallel row and cleared. My own error (unused enWeb) was fixed.
