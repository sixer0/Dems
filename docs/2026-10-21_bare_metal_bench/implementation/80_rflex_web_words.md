# Row 134 - web console words (R2.1)
File: apps/core-web/src/i18n-web.ts (Edit only; LCD edits untouched)
- web.commissioning.settings.notConfigured = W-N1 bound variant (spec text verbatim).
- interfaceName.hint, cameraSubnet.hint = W-N2 (spec text verbatim).
- Removed W-N3 mirror web.source.networkNotConfigured (title/detail) with its comment; removed now-unused `en` import (was TS6133).
Verify: grep networkNotConfigured apps/core-web/src = 0; commissioning.test.tsx 31/31 passed; web typecheck: errors only in audio-cards-panel.tsx:105 and audio-cards.ts:365 (other rows, ALREADY_BOUND); none from i18n-web.ts.
