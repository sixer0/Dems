# Row 135 - shared words removal and W-A4 re-word (status: complete)

File: packages/shared/src/i18n/en/common.ts (single edit session, python line edit; no other lines touched)

1. Removed `common.captureConnect.networkNotConfigured` and `networkNotConfiguredDetail` (were :871-872).
2. W-A4 `errors.AUDIO_CARD_ALREADY_BOUND` (now :1082)
   - old: `This sound card is already used by {{device}}. List the sound cards again, or release it from {{device}} first. Nothing was saved.`
   - new: `This sound card is already used by {{device}}. List the sound cards again, or move {{device}} to another input first. Nothing was saved.`
   - basis: bundle M wording of W-A2 ("Move {{device}} to another input"), specs_rflex 6.2.

Verification
- grep networkNotConfigured apps packages (*.ts, *.tsx, node_modules excluded): 0 hits
- vitest packages/shared test/i18n.test.ts + i18n-vocabulary-sync.test.ts: 2 files passed, 55 tests passed
- shared typecheck: exit 0
- core-web typecheck: 0 `error TS` lines
