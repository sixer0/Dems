# Row 92 - data-analyst - R-FLEX API/openapi/console UI delta

- Status: complete (with items marked `dep: row 88/90` and 4 questions for row 96)
- Date: 2026-10-22
- Output: masterplan/01_specs_rflex_api_ui.md
- Also appended: delegation_progress/file_requests.md (4 lines, row 92)

## Milestones
- Op 98: `boundTo` (MIC-NN | null, required nullable, sim null). Op 99: body `release` (optional, default false), answer `releasedDeviceId` (required nullable), 409 `AUDIO_CARD_ALREADY_BOUND` with `details.deviceId`; answer `change` stays a 3-value inline enum because `RELEASED` (AU-A1) is audit-only. Ops 101/102, 93, 100: text only. No new operation (111 / 45 openapi ops unchanged).
- Screens with every state + word key: audio cards panel, audio input card, capture selector (mic menu rules M1-M6), session-new device check, commissioning form, camera search panel / connect dialog.
- Wording given for W-A1..W-A6, W-N1, W-N2; W-N3 removal with all non-test readers.
- Test pins listed (shared, server, web), extend existing files only.

## Blockers / dependencies
- Row 88: release form (retire vs slot clear + disable) decides audio input card / selector M4 / W-A3 suffix / W-A6 text.
- Row 90: confirm the connection test no longer raises COMMISSIONING_NOT_CONFIGURED before W-N3 is removed.

## Requests (file_requests.md)
- common.captureAudioCards.releaseHint; common.captureAudioCards.card.notTellable (row 96 Q-R2); common.captureSearch.typedAddress.notAllowed (text change of existing key); devices.micLines.released (conditional on row 88).

## For row 96
- Q-92-1 per-result interface in search answer (rec: keep count only); Q-92-2 Q-R1 (b) variant; Q-92-3 released mic in menu (rec: (ii) or (i), never (iii)); Q-92-4 Q-R4 wording variant (rec: stay bound).
