# Row 107 (R2.1) - coder-execution - status: complete

- Report: implementation/59_rflex_audio_identity.md
- Files edited: apps/core-server/src/capture/adapters/audio/usb-audio-production.ts; __tests__/usb-audio-production.test.ts; __tests__/macos-card-listing.test.ts; __tests__/mic-loss.test.ts
- File new: apps/core-server/test/support/stored-card-identity-cases.ts (T-1 table; row 131 consumes its `registration` column)
- Tests: 62/62, 44/44, 30/30, static test-support-imports 2/2. PORT_DIFFERS grep in capture + test = 0.
- Typecheck core-server: exit 2, only service.ts:299 (boundTo) and :533 (releasedDeviceId) - rows 108/131.
- Decisions: CardMismatch.IDENTITY_NOT_STORED removed (RM-A3, Q96-09); MODEL_SHARED added (AU-R2, Q96-03). Open->start `CARD_MOVED` re-check kept (per-handle guard, not a stored-port lock). real.test.ts not edited (no port-rule mention).
