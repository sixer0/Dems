# Row 101 (R2.1) shared word changes - status: complete

Edited with Python exact single-match replace (additive; no sed). Files: packages/shared/src/i18n/en/common.ts, devices.ts. Tests not edited (no pin needed).

W-A1 card.boundTo, W-A8 card.notTellable, W-A2 release, W-A7 releaseHint, W-A3 released, W-A5 CARD_CHANGED (text), W-A6 AUDIO_INPUT_NOT_REGISTRABLE (alternative text), W-A4 AUDIO_CARD_ALREADY_BOUND (new), W-N4 typedAddress.notAllowed (api_ui:259 text), devices.micLines.onOtherLine.PRIMARY/STANDBY. W-A9 not built.

```
794:      notAllowed: 'The Core does not ask this address. It asks only private addresses on a network the Core is connected to. Nothing was sent.',
1059:      boundTo: 'Bound to {{device}}',
1060:      notTellable: 'Two sound cards of this model state no serial number. The Core cannot tell which one {{device}} uses, so neither is offered.',
1065:    release: 'Move {{device}} to another input',
1066:    releaseHint: '{{device}} will move to the input you choose and stop using its present input. Choose the input, then register it.',
1067:    released: '{{released}} now uses input {{number}} of this sound card. Its old input was released.',
1078:      CARD_CHANGED: 'Input {{number}} is {{device}}, which was stored for another sound card. It now names this sound card.',
1083:      AUDIO_INPUT_NOT_REGISTRABLE: 'This Core cannot capture from this sound card, or cannot find it again, so the input was not registered. Nothing was saved.',
1084:      AUDIO_CARD_ALREADY_BOUND: 'This sound card is already used by {{device}}. List the sound cards again, or release it from {{device}} first. Nothing was saved.',
```

Tests: vitest run test/i18n.test.ts test/i18n-vocabulary-sync.test.ts: 2 files, 55 tests passed. npm run typecheck -w shared: exit 0.
Note: W-A4 text says 'release it from {{device}} first' (spec text kept verbatim, though bundle M wording is 'move').
