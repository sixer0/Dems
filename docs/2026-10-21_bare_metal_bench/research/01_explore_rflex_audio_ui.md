---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore (row 83, wave W-a, read-only)
scope: R-FLEX audio UI/API, RQ-A3 (UI side), RQ-A4 (UI side), RQ-A5. Rulings D10, D12. Narrative tier 2.
method: direct grep/sed (graft MCP tools not loaded in this run); line numbers are from the working tree of 2026-10-22.
---

# R-FLEX audio UI / API, code-only findings

No design here; options the code makes possible are listed. "unknown" = not found in code.

## 1. Operations (shared contract)

| # | operationId | Method path | Access | Audit | Where |
|--:|---|---|---|---|---|
| 98 | searchCaptureAudioCards | POST /api/v1/capture/audio-cards/search | CAPTURE_CONFIG + WEB_CONSOLE_SESSION | CAPTURE_DISCOVERY_SEARCHED scope AUDIO_CARDS | packages/shared/src/api/capture-audio-cards.ts:248-275 (paths :235-236, access :239); openapi.json:24926 |
| 99 | registerCaptureAudioInput | POST /api/v1/capture/audio-cards/inputs | same | CAPTURE_AUDIO_INPUT_CHANGED | capture-audio-cards.ts:276-315; openapi.json:25195 |
| 78/79/80 | updateCaptureConfig / setCaptureCameraSource / setPrimaryMic | selector edits | | | packages/shared/src/api/devices.ts:514, :542, :571 |
| 111 | retire (camera or mic) | | | | packages/shared/src/api/capture-retire.ts (i18n `common.captureRetire`, common.ts:~970) |

Registered in core-api.ts:90 (import), :719 (`CAPTURE_AUDIO_CARD_SCHEMAS`), :1142 (`CAPTURE_AUDIO_CARD_OPERATIONS`, "98-99").

Contract facts:
- Listing entry `CaptureAudioCardSchema` (capture-audio-cards.ts:125-157): cardId, deviceIndex, usbId, usbSerial?, usbPort?, product, channelCount, sampleBits, `registered[{inputNumber, deviceId}]` (:147-155). **There is no "bound/exclusive/available" member**; a card is described only by which of its inputs have a microphone.
- Register body (:175-181): cardId, deviceIndex, inputNumber only. Answer (:185-192): deviceId, change (REGISTERED | REENABLED | CARD_CHANGED, :94), inputNumber, channelCount.
- Reasons (:102-111): AUDIO_CARD_SEARCH_IN_PROGRESS, AUDIO_INPUT_BEYOND_CARD, AUDIO_INPUT_NOT_REGISTRABLE (409), AUDIO_CARD_SEARCH_RATE_LIMITED (429). 404 when the Core's own listing lacks the card. Also CAPTURE_CONFIG_LOCKED while a session is open.
- Contract text states: "A USB card is the stored one by its serial where it states one (found on any port) and by its port otherwise; a serial that appears or disappears is another card" (:289). `CARD_CHANGED` does NOT enable the mic; the same call again answers REENABLED (:289). A USB card with neither serial nor port is refused NOT_REGISTRABLE (:305).
- The USB port is a contract member: `usbPort` pattern at :73, member :136-142.

## 2. Server routes / service (apps/core-server/src/modules/capture-inputs/audio-cards/)
- routes.ts (75 lines) binds both operations from the registry (:42); service.ts: `searchAudioCards` :321-352 (approx.), `registerAudioInput` :463-534; store.ts, statements.ts (INSERT :50, UPDATE :58), registrar.ts.
- RQ-A3 (UI side): the listing marks a registered input per card: `cardAnswer` filters `registered` rows to those whose stored identity is SAME_CARD for that live card (service.ts:308-311) - a stored input whose card is "another card" is NOT shown as registered on the live card. A bound card is therefore shown (never hidden), with `registered` rows; nothing makes it unselectable on the server.
- Registration uniqueness today: lookup by key (cardId, cardDevice, inputNumber) via `store.inputOf` (service.ts:~490); existing row -> `matchStoredCard` (service.ts:405-440) -> SAME_CARD = REENABLED, else CARD_CHANGED + `refreshInput` (identity rewritten, mic not re-enabled, service.ts:503-511). Insert path :494-498. DB key `capture_audio_inputs_card_input_key UNIQUE(card_id, card_device, input_number)` (per structured.md). No check "this physical card/serial already bound to another input": unknown (not found in service.ts; no second index named).
- Match rule codes `StoredCardMatch` (service.ts:372-386): SAME_CARD, USB_ID_DIFFERS, SERIAL_DIFFERS, PORT_DIFFERS (:380), IDENTITY_NOT_STORED, NOT_TELLABLE. `unidentifiable` (:446) -> NOT_REGISTRABLE refusal (:477-478).
- Port lock location: usb-audio-production.ts `identifyRegisteredCard` :287-361 (PORT_DIFFERS :287, :358; CARD_CHANGED :92; CARD_AMBIGUOUS :94, :354, :359; texts :135-136; error mapping to DEVICE_NOT_FOUND :159-160). macOS twin: usb-audio-macos.ts:398-402, :494.
- Audit text per change: MESSAGE_OF_CHANGE service.ts:455-459; details via `captureAudioInputChangedDetails` (core/audit-details.ts).
- RQ-A4 (server-visible only): re-binding exists only as "same key, other card" (CARD_CHANGED). A "re-bind a card to ANOTHER line releases the old line" path does not exist: no unassign/retire/delete call in audio-cards/service.ts. Options the code offers: (a) refresh like CARD_CHANGED does for the old key, (b) unassign slot via op 78 `unassign` (capture-selector.ts:354, :420-432), (c) retire via op 111, (d) set device enabled=false via registrar (registrar.ts exists; `reenable` is called at service.ts:508).

## 3. Console components (apps/core-web/src/features/devices/)
- index.tsx:48 imports `AudioCards`, :281 renders it.
- audio-cards-panel.tsx (269 lines): `Card` :38-80 (shows inputs count :46, device :47, USB id or "not USB" :49, sample bits :51; per input a Radio :65 with `data-registered`; chip "Registered as <MIC>" :75). Radios are NOT disabled for registered inputs (only `disabled` prop of the whole card :38/:55 = block/busy). Result alert :92-95 (`result.<change>`), refusal alert :100-105. The panel does not draw serial or port even though 98 answers them (grep: no `usbSerial|usbPort` in the panel).
- audio-cards.ts (326 lines): `audioCardsGate` :51, `listRefusal` :78 (BUSY etc.), `registerRefusal` :90 -> NOT_FOUND | BEYOND_CARD | NOT_REGISTRABLE | FAILED, `cardKeyOf` :146, `inputsOf` :158-163 (inputs 1..channelCount with deviceId or null), `withRegistration` :170 (local merge), outcome type :186-189, controller :212, refusal switch :298-312.
- mic-rescan.tsx (91 lines) + capture-inputs.ts: operation `/api/v1/capture/inputs/rescan` (capture-inputs.ts:26); local-device state mapping :86-150; it is the rescan of local (built-in) devices, not USB cards.
- RQ-A5 / selector: capture-selector-panel.tsx (749 lines); `MicRow` :418-600 (doc :407-416); mic candidates = every registered MIC device, `microphones` :651, passed :711; options list :553-558, "Not assigned" first :549; the OTHER line's mic is a disabled option labelled "already on the primary/standby line" (:553, label :458); a held slot saved as "Not assigned" -> `commands.unassign(role)` (:465); else `commands.setMicPair(pair)`.
- capture-selector.ts: `micPairFor` :230-237 (empty slot -> one line; same device on both roles -> null, nothing sent), `selectorSlotRows` :266-269 (slots VIDEO_01, VIDEO_02, PRIMARY, STANDBY :253-254), `selectorEditGate` :124, `SelectorRefusal` :289, `selectorRefusal` :291. `CAPTURE_SELECTOR_SLOTS = [VIDEO_01, VIDEO_02, PRIMARY, STANDBY]` devices.ts:152.
- Session start/record input views: features/session-new/devices-step.tsx (MicMeter :329-355, named from `selectorInForce(s).mics`, unassigned row :375-388); features/session-monitor/inputs-panel.tsx (2 camera + 2 mic tiles, `MIC_SHORT` AUDIO-01/02 :21; `micTiles` model.ts); session-monitor/audio-source.ts, audio-panel.tsx. All read the selector in force; none lists USB cards. Mic names come from `useMicInputName` (devices/source-class.ts).

## 4. Selector slot rules (what is assignable / refused)
- 4 slots: VIDEO-01, VIDEO-02 (cameras), PRIMARY, STANDBY (mics) - devices.ts:152.
- Server (capture-config/routes.ts): one camera on both video slots refused 422 `CAMERA_ON_BOTH_TRACKS` (assertOneSlotPerCamera :335-350, doc :70-80). A mic line must satisfy `deviceId === inputId` else 422 INVALID_INPUT "A microphone input holds the microphone of the same ID." (assertStorable :286-296, text :234). One mic behind both inputs refused (doc :33-34). Web refuses the same mic on both lines before sending (micPairFor).
- Assignment refusals `CaptureAssignmentRefusal` (routes.ts:148-152, mapping :175-177): DEVELOPMENT_SOURCE_NOT_ALLOWED, PRODUCTION_SOURCE_NOT_ALLOWED, CAPTURE_DEVICE_NOT_SERVED, CAPTURE_DEVICE_CLASS_MISMATCH; plus camera-profile words, SLOT_UNASSIGNED_AND_ASSIGNED, CAPTURE_DEVICE_RETIRED. Word table: slot-refusal.ts:1-74 (`slotRefusalWording` :68).
- RQ-A4 (UI side): a re-bind of a card changes the device row (op 99), not the selector. The selector stores the DEVICE ID per slot (comment routes.ts:278-285, "mic_primary_id / mic_standby_id are DEVICE IDs"), so a slot keeps its MIC-nn through CARD_CHANGED; the slot is emptied only by an explicit `unassign` (op 78) or retire (111). Duplicate handling for a physical card: none at selector level; a MIC-nn is the unit.
- A registered MIC with enabled=false: the device list still contains it; selector offers every `kind === 'MIC'` device (:651) without an enabled filter (unknown whether retired ones are filtered elsewhere; retirement is refused at assignment: CAPTURE_DEVICE_RETIRED).

## 5. Word keys (refusals)
- `common.captureAudioCards.*` packages/shared/src/i18n/en/common.ts:1043-1085: title, action, again, description, empty, truncated, trustNote, card.{inputs,sampleBits,usbId,notUsb,device}, input, registeredAs :1065, pickHint, register, locked, busy, notReady, listFailed; `result` :1070-1074 (REGISTERED, REENABLED, **CARD_CHANGED** :1073 "stored for a sound card at another place. It now names this sound card."); `refusal` :1076-1081: NOT_FOUND, AUDIO_INPUT_BEYOND_CARD, AUDIO_INPUT_NOT_REGISTRABLE, FAILED.
- `common.captureSlotRefusal` common.ts:935-955; `common.captureSlotSource` :957; `common.captureRetire` ~:966; `common.captureSlot.*` (assignLabel, notAssigned, PRIMARY/STANDBY).
- `devices.micLines.label/onOtherLine` packages/shared/src/i18n/en/devices.ts:429-437; `devices.selector.mics`.
- `PORT_DIFFERS` and `CARD_AMBIGUOUS` have NO UI word: they exist only in adapter/service code (`AUDIO_CARD_CHANGED`, `AUDIO_CARD_AMBIGUOUS` -> DEVICE_NOT_FOUND, usb-audio-production.ts:92-94, :135-136, :159-160) and reach the console as a mic fault, not a refusal text. `usbSerial`/`usbPort` have no word either (panel does not draw them). i18n-web.ts: no audio-card keys (grep).
- Only one i18n language tree exists (packages/shared/src/i18n/en).

## 6. Tests that pin this
Web: apps/core-web/src/features/devices/__tests__/audio-cards.test.tsx (:42 gate, :51 refusals, :69 inputs of a card, :113 flow, :183 REGISTERED/REENABLED/CARD_CHANGED, :237 refusal sentences, :279-:334 list states, locked, role); selector-microphones.test.tsx (:200 same mic on both lines = disabled option); capture-selector.test.tsx; mic-input-name.test.tsx; src/test/live-devices-capture-selector.test.tsx, selector-in-force.test.tsx, live-session-monitor-audio-source.test.tsx, real-core-facts.test.tsx.
Shared: packages/shared/test/api-capture-discovery.test.ts (schema shape :718, usbSerial/usbPort :721, sim listing :775); api-registry.test.ts (:199 row 98 registry, :389 count); openapi.test.ts; api-openapi-scope.test.ts; sim-capture-discovery.test.ts; i18n.test.ts, i18n-vocabulary-sync.test.ts; sim-selector-in-force.test.ts.
Server: audio-cards/__tests__/service.test.ts (:426 USB_ID_DIFFERS, :447 other port = CARD_CHANGED, :470 same card REENABLED, :502 no stored identity, :603-:662 serial/port cases and shared serial, :651 mic stays on through CARD_CHANGED), routes.db.test.ts; adapters/audio/__tests__/usb-audio-production.test.ts (PORT_DIFFERS/AMBIGUOUS), usb-audio-macos.test.ts, card-listing.test.ts, macos-card-listing.test.ts; modules/capture-config/__tests__/routes.test.ts, selector-reader-inventory.test.ts; test/acceptance/contract.test.ts, rbac-matrix.test.ts; plugins/permission-guard tests; __tests__/capture-composition(.db).test.ts.
Changing the listing/registered members touches: schema (capture-audio-cards.ts), openapi.json (generated, openapi.test.ts), examples.ts, sim/api.ts + sim/capture-registry.ts, the three i18n trees entries above.

## Gaps
- Graft MCP not used; line numbers from sed (small drift possible, +-3 around service.ts:321-352, :490).
- Mic enabled/retired filtering in selector candidates and the rescan/mic-rescan scope: not fully read.
- Audit entries for a "release old binding": none exist today; would be new (unknown).
