---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 92
type: spec (R-FLEX API, openapi and console UI delta, with words)
narrative_tier: 1
confidence: HIGH for "today" facts (re-read in the repo this session); MEDIUM for the delta where it depends on rows 88 / 96 (marked)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 92, line 260; RQ-A3, RQ-A5, RQ-N4 lines 97, 99, 109)
names_from: masterplan/01_specs_rflex_register.md (row 87) - only source of names
inputs: research/01_explore_rflex_audio_ui.md, research/01_explore_rflex_network_ui_docs.md, research/01_explore_rflex_audio_identity.md, decisions/decisions.md D10-D12
last_updated: 2026-10-22
---

# R-FLEX API, openapi and console UI delta (row 92)

## 0. Scope and 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The changed shared-API operations (98, 99, 101/102 text, 93 and 100 text), their request/response shapes, the console screens they reach, every screen state with its word key, and the tests that pin each. No new operation (register OP-0: not recommended; this spec confirms it is not needed) |
| Who | Consumers: row 95 (reconcile), row 96 (decision sheet), code row 99 (shared API contract, single writer of the shared api index), row 101 (word catalogues, single writer), the web rows that change `apps/core-web/src/features/devices/*` and `features/commissioning/*`, row 94 (impact) |
| When | Spec wave S2 (after row 87), 2026-10-22; docs only |
| Where | `packages/shared/src/api/capture-audio-cards.ts`, `capture-commissioning.ts`, `capture-discovery.ts`, `packages/shared/openapi/openapi.json` (generated), `packages/shared/src/i18n/en/common.ts`, `apps/core-web/src/i18n-web.ts`, `apps/core-web/src/features/devices/{audio-cards-panel.tsx,audio-cards.ts,audio-input-card.tsx,capture-selector-panel.tsx,capture-selector.ts,camera-search-panel.tsx,camera-connect.ts,camera-connect-dialog.tsx}`, `features/session-new/devices-step.tsx`, `features/commissioning/{index.tsx,model.ts}` |
| Why | D10(1): USB audio free of port, a bound card is exclusive, re-bind releases the old binding. D10(2) "Global penuh": the one-camera-interface rule is lifted. D11 risk accepted. D12: U-RF3 (search answers on the camera port only, AC7 unchanged), AC9 added ("a bound card is not offered for a new binding"; "a port move keeps the binding") |
| How | Each "today" fact re-read in the working tree this session (file:line below); each change mapped to a register id (OP-*, AU-*, RM-*, NW-*, W-*); a name the register lacks went to `delegation_progress/file_requests.md` and is written here as `<REQ:name>` |
| Alternatives | Per item, in the text; open choices in section 10 "For row 96" |
| Assumptions | (A1) Q-R1 = (a) "physical card is the exclusivity unit" (register recommendation); states for (b) are given where they differ. (A2) Q-R4 = "scan and set-IP stay interface-bound" (register recommendation); the variant text for "global" is given. (A3) Q-R5 = "line means a DEMS input (MIC-nn)". (A4) Row 88 owns the release mechanism (slot clear and/or disable vs retire); UI states that depend on it are marked `dep: row 88` |
| Gaps | Section 11 |

## 1. Today facts this delta builds on (re-read 2026-10-22)

| # | Fact | Evidence |
|---|---|---|
| T1 | Op 98 listing entry members: cardId, deviceIndex, usbId, usbSerial?, usbPort?, product, channelCount, sampleBits, registered[{inputNumber, deviceId}]; no bound/available member | `packages/shared/src/api/capture-audio-cards.ts:124-157` |
| T2 | `registered` is filtered by kernel key (cardId + device) AND by the identity rule (SAME_CARD), so a card bound under another kernel card id shows `registered: []` | `apps/core-server/src/modules/capture-inputs/audio-cards/service.ts:298-313` |
| T3 | Op 99 body = cardId, deviceIndex, inputNumber (strictObject); answer = deviceId, change, inputNumber, channelCount | `capture-audio-cards.ts:175-192` |
| T4 | Op 99 contract text: "by its serial number where it states one ... and by its port otherwise" and 409 text "also for a USB card that states neither a serial number nor a port" | `capture-audio-cards.ts:289`, `:305` |
| T5 | `CaptureAudioInputChange` = REGISTERED, CARD_CHANGED, REENABLED; pinned as exactly these three | `capture-audio-cards.ts:94`; `packages/shared/test/api-capture-discovery.test.ts:764` |
| T6 | Op 99 registration path: key lookup, then REENABLED or CARD_CHANGED; no physical-card exclusivity check | `service.ts:470-535` |
| T7 | Panel draws per card: product, inputs count, device index, USB id / not USB, sample bits; per input a Radio with chip `registeredAs`; radios disabled only by block/busy | `apps/core-web/src/features/devices/audio-cards-panel.tsx:38-80` |
| T8 | Panel result alert by `result.<change>`, refusal alert by `refusal.<reason>` | `audio-cards-panel.tsx:86-108` |
| T9 | Op 101/102 descriptions and the `configured` member say "until then the commissioning functions answer COMMISSIONING_NOT_CONFIGURED" | `packages/shared/src/api/capture-commissioning.ts:393`, `:583`, `:599-` |
| T10 | `interfaceName` / `cameraSubnet` nullable in answer and update; the console form accepts empty for both (sends null) | `capture-commissioning.ts:394-395,414-415`; `apps/core-web/src/features/commissioning/model.ts:242-243` |
| T11 | Commissioning form shows `web.commissioning.settings.notConfigured` when `!config.configured` | `apps/core-web/src/features/commissioning/index.tsx:296-304`; text `apps/core-web/src/i18n-web.ts:759` |
| T12 | Op 93 typed-address text: "reached from the camera interface and from no other"; op 100 text: "a private IPv4 address the camera interface reaches ... never the subnet of another interface" | `capture-discovery.ts:637`, `:1261` |
| T13 | Search answer carries `interfaceCount`: "a count, never a name or an address" | `capture-discovery.ts:258` |
| T14 | Camera search panel shows `common.captureSearch.networksSearched` with `search.interfaceCount` | `apps/core-web/src/features/devices/camera-search-panel.tsx:256`; words `packages/shared/src/i18n/en/common.ts:778-779` |
| T15 | The connection test answers 409 `COMMISSIONING_NOT_CONFIGURED` when the rule is not configured; web maps it to `NETWORK_NOT_CONFIGURED` and reads `common.captureConnect.networkNotConfigured(Detail)` | `apps/core-server/src/modules/capture-discovery/connect/service.ts:385`; `apps/core-web/src/features/devices/camera-connect.ts:205,229`; `camera-connect-dialog.tsx:625,661-665` |
| T16 | Selector: 4 slots VIDEO-01, VIDEO-02, PRIMARY, STANDBY; mic menu = "Not assigned" first, then every `kind === 'MIC'` device; the other line's mic is a disabled option with `devices.micLines.onOtherLine.<role>` | `packages/shared/src/api/devices.ts:152`; `capture-selector-panel.tsx:448-460,549-558,651` |
| T17 | Capture device slice carries `online` (registry `enabled` flag) and `retiredAt`/`retiredBy` (present only on a retired device) | `packages/shared/src/api/state-slices.ts:1193,1221-1230` |
| T18 | Session-new device check names a meter from the selector in force; an empty line reads `common.captureSlot.notAssigned`; an unassigned slot item reads `common.captureNotice.start.sourceNotAssigned` | `apps/core-web/src/features/session-new/devices-step.tsx:329-355,97`; `common.ts:916,922-930` |
| T19 | Audio input card (channel tile) shows `common.captureSlot.notAssigned` when its line has no input | `apps/core-web/src/features/devices/audio-input-card.tsx:122` |
| T20 | Openapi: 45 operations in the offline document, byte-for-byte drift check | `packages/shared/test/openapi.test.ts:205,255` |

## 2. Operations: request/response delta

### 2.1 Op 98 `searchCaptureAudioCards` (POST `/api/v1/capture/audio-cards/search`) - CHANGED (OP-98, AU-L1)

Request: unchanged (no body).

Response `CaptureAudioCardSearch` = `{ searchedAt, cards: CaptureAudioCard[], truncated }` unchanged; `CaptureAudioCard` gains one member:

| Member | Type | Required | Text (description) |
|---|---|---|---|
| `boundTo` (AU-L1) | `string` matching `HARDWARE_DEVICE_ID_PATTERN` (e.g. `MIC-03`) or `null` | yes (nullable). The simulator answers `null` for both test cards | "The microphone that holds this sound card, by the identity rule (its serial number where it states one, else its USB id; never its port). A card with a microphone is not offered for a new binding: registering another input of it is refused `AUDIO_CARD_ALREADY_BOUND` unless the request releases the holder. Null: no microphone holds the card." |

Members kept: `usbSerial`, `usbPort` (AU-L2 keep, Q-R3 recommendation; `usbPort` description gains "informational: it is no longer compared"). `registered[]` keeps its meaning (inputs of THIS listing key that are registered microphones).

Relation of the two members (rule for the client, stated in the description):
- `boundTo === null` -> `registered` is `[]` (a card no microphone holds has no registered input).
- `boundTo !== null` and `registered` names `boundTo` -> the holder is on this card under this kernel id (the normal case).
- `boundTo !== null` and `registered` is `[]` -> the holder was registered under another kernel card id (renamed card, `01_explore_rflex_audio_identity.md` §5) and is still this physical card.
- Under Q-R1 (b) (card input as the unit) `boundTo` would have to move into `registered[]`; that variant is not specified here (section 10, Q-92-2).

Operation description (`capture-audio-cards.ts` op 98, third paragraph) adds: "and, per card, the microphone that holds it (`boundTo`), or null."

Server side (for row 88/98, not this row's design): `cardAnswer` (`service.ts:298`) computes `boundTo` from all non-retired input rows by the identity rule (DB-A2 `READ_BOUND_AUDIO_INPUTS`), not from the kernel key.

### 2.2 Op 99 `registerCaptureAudioInput` (POST `/api/v1/capture/audio-cards/inputs`) - CHANGED (OP-99, AU-B1, AU-B2, AU-R1, AU-A1)

Request `CaptureAudioInputRegisterRequest` (strictObject):

| Member | Type | Required | Text |
|---|---|---|---|
| cardId, deviceIndex, inputNumber | unchanged | yes | unchanged |
| `release` (AU-B1) | boolean | no, default `false` | "True: register this input and release the microphone that holds the same sound card (decision D10 (1)). False or absent: a card another microphone holds is refused." |

Response `CaptureAudioInputRegistration` (strictObject):

| Member | Type | Required | Text |
|---|---|---|---|
| deviceId, inputNumber, channelCount | unchanged | yes | unchanged |
| `change` | enum `REGISTERED`, `CARD_CHANGED`, `REENABLED` - written as an inline 3-value enum, NOT `z.enum(CaptureAudioInputChange)`, because AU-A1 adds `RELEASED` to `CaptureAudioInputChange` (an audit-only value; op 99 never answers it) | yes | CARD_CHANGED text changes: "the stored input now has another card behind it (another USB id, or a serial number that differs, appears or disappears). A port move is not a change." |
| `releasedDeviceId` (AU-B2) | `MIC-NN` or `null` | yes (nullable) | "The microphone this registration released (`release: true` and the card was held by another microphone); null otherwise." |

Status / reason table (delta in bold):

| Status | When | `details` |
|---|---|---|
| 201 | new microphone; `releasedDeviceId` set when a holder was released | - |
| 200 | REENABLED / CARD_CHANGED (the holder is this same input: `releasedDeviceId: null`; `release: true` is then a no-op, not a refusal) | - |
| **409 INVALID_STATE** | **the physical card is held by another microphone and `release` is not true** | **`reason: AUDIO_CARD_ALREADY_BOUND` (AU-R1), `deviceId: <holder MIC-NN>`** |
| 409 INVALID_STATE | AUDIO_INPUT_BEYOND_CARD, AUDIO_CARD_SEARCH_IN_PROGRESS, AUDIO_INPUT_NOT_REGISTRABLE; CAPTURE_CONFIG_LOCKED (session open) | unchanged |
| 404, 400, 401, 403, 422 | unchanged | unchanged |

Text changes in the operation description:
- `:289` replace "A USB card is the stored one by its serial number where it states one (it is then found on any port) and by its port otherwise; a serial that appears or disappears is another card." with: "A USB card is the stored one by its serial number where it states one, and by its USB id otherwise, on any port: moving a card to another port keeps its microphone. A serial number that appears or disappears is another card. **A sound card is held by one microphone at a time** (decision D10 (1)): registering an input of a card another microphone holds is refused `409 INVALID_STATE` with `details.reason: AUDIO_CARD_ALREADY_BOUND` and the holder's id, unless the body says `release: true`; the Core then releases the holder in the same unit and names it in `releasedDeviceId`."
- Audit paragraph adds: "A release writes a second CAPTURE_AUDIO_INPUT_CHANGED row for the released microphone with `change: RELEASED`." (AU-A1). If row 88 also clears the holder's selector slot: "and one CAPTURE_CONFIG_CHANGED row, scope MIC, for the slot it emptied; `captureConfig` is then published" (AU-A2, `dep: row 88`).
- `:305` 409 text "also for a USB card that states neither a serial number nor a port" -> `dep: row 88` (RM-A5): recommended "also for a USB card the Core could not find again (it states no USB id)"; if row 88 keeps the predicate, the phrase "nor a port" is still removed.
- Simulator paragraph unchanged; the simulator never answers `AUDIO_CARD_ALREADY_BOUND` (it registers nothing).

Release form itself (slot clear / disable / retire, AU-X1) is row 88's; this contract states only the observable facts above.

### 2.3 Ops 101 `getCaptureNetworkConfig` / 102 `updateCaptureNetworkConfig` - TEXT ONLY (OP-101/102, DB-N1)

Request and response schemas unchanged (`interfaceName`, `cameraSubnet` already nullable, T10). `configured` keeps its computation (both set).

| Place | Today | New text (Q-R4 = stay bound, recommended) | Variant (Q-R4 = global) |
|---|---|---|---|
| `configured` description `capture-commissioning.ts:393` | "False: the commissioning functions answer `COMMISSIONING_NOT_CONFIGURED`." | "True when both the camera interface and the camera subnet are set. False: the factory address scan and the camera address change answer `COMMISSIONING_NOT_CONFIGURED`; the camera search, a typed address and the connection of a camera do not need them." | "True when both are set. Informational: no operation needs them." |
| Op 101 description `:583` | "...until then the commissioning functions answer `COMMISSIONING_NOT_CONFIGURED`." | "...until then the factory address scan (103) and the camera address change (106) answer `COMMISSIONING_NOT_CONFIGURED`. The camera search (93), a typed address, the connection tests (95, 108) and a stored camera are not bound to this interface (decision D10 (2))." | drop the sentence; add "No operation is bound to this interface." |
| Op 102 description `:599-` | "...`interfaceName` and `cameraSubnet` may be set to null: the commissioning functions then answer 'not configured'." | "... may be set to null: the factory address scan and the camera address change then answer `COMMISSIONING_NOT_CONFIGURED`." | "... may be set to null." |
| `DESTINATION` constant `:559` (ops 103, 106) | "a private IPv4 address the camera interface reaches, never ... inside the subnet of another interface" | unchanged (scan and set-IP stay bound) | rewrite as 2.4 |

### 2.4 Ops 93 and 100 - TEXT ONLY (OP-93..97, RM-N1, RM-N2, RM-N4)

Schemas unchanged. Search answer `interfaceCount` unchanged (NW-S1 FIRM: a count, never a name; T13).

| Place | Today | New text |
|---|---|---|
| Op 93 typed address `capture-discovery.ts:637` | "inside 10/8, 172.16/12 or 192.168/16; reached from the camera interface and from no other; never loopback..." | "inside 10/8, 172.16/12 or 192.168/16; on the subnet of an up interface of the host, which is the interface it is asked from (no route through a gateway); never loopback..." (NW-R1 wording; `dep: row 89/90` for the off-link refusal) |
| Op 100 `confirmCaptureDeviceAddress` `:1261` | "a private IPv4 address the camera interface reaches, never loopback, never the Core's own, never the subnet of another interface" | "a private IPv4 address on the subnet of an up interface of the host, never loopback, never the Core's own" |
| Op 95/108 connection tests | contract text does not name `COMMISSIONING_NOT_CONFIGURED` (grep of `capture-discovery.ts`: no hit) | no text change; behaviour: no longer answers `COMMISSIONING_NOT_CONFIGURED` for an empty interface/subnet (RM-N4) |

### 2.5 Operations NOT changed

78/79/80 (selector), 103-107 (commissioning, under Q-R4 recommendation), 108-111, 1-92. Registry count stays 111; openapi offline document stays 45 operations (T20).

## 3. Screen: Audio cards panel (`features/devices/audio-cards-panel.tsx`, `audio-cards.ts`)

### 3.1 Changes

1. A card with `boundTo !== null` draws a chip on the card row: W-A1 `common.captureAudioCards.card.boundTo` ("Bound to {{device}}", `device` = `captureDeviceName(t, boundTo)`), `data-bound-to=<id>`.
2. Inputs of a bound card are disabled for a plain registration EXCEPT the input whose `registered.deviceId === boundTo` (registering it again is REENABLED, not a new binding). Under Q-R1 (a) every other input of the card is disabled.
3. A bound card has a secondary button W-A2 `common.captureAudioCards.release` that switches THAT card into release mode: its inputs become selectable, a hint `<REQ:common.captureAudioCards.releaseHint>` is shown, and the register button sends `release: true`. A Cancel button (`common.actions.cancel`, exists `common.ts:40`) leaves release mode. Only one card in release mode at a time; release mode ends on list-again.
4. The panel still does not draw `usbSerial` / `usbPort` (T7); no word added for them.
5. `audio-cards.ts` refusal mapping (`registerRefusal` `:90`, switch `:298-312`) gains `ALREADY_BOUND` (reason `AUDIO_CARD_ALREADY_BOUND`, carries `details.deviceId`).

### 3.2 States and words

| State | Condition | Drawn | Word key(s) |
|---|---|---|---|
| Not listed yet | no listing | intro + action | `common.captureAudioCards.description`, `.action` |
| Listing | busy | spinner | `common.captureAudioCards.busy` (another listing) |
| Locked | session open | disabled | `common.captureAudioCards.locked` |
| Not ready / failed | 503 / error | alert | `.notReady`, `.listFailed` |
| Empty | `cards: []` | text | `.empty` |
| Truncated | `truncated` | warning | `.truncated` |
| Free card | `boundTo === null` | inputs selectable | `.card.*`, `.input`, `.inputsLabel`, `.pickHint`, `.register` |
| Bound card, own input | `boundTo !== null`, input `deviceId === boundTo` | chip on input + chip on card; this input selectable | `.registeredAs` + **W-A1 `.card.boundTo`** |
| Bound card, other input | `boundTo !== null`, input not the holder | input disabled; card shows release button | **W-A1**, **W-A2 `.release`** |
| Bound elsewhere (renamed) | `boundTo !== null`, `registered: []` | all inputs disabled; release button | **W-A1**, **W-A2** |
| Release mode | operator pressed W-A2 | inputs selectable, hint, Cancel | **`<REQ:common.captureAudioCards.releaseHint>`**, `common.actions.cancel`, `.register` |
| Ambiguous | two entries with the same `usbId`, both `usbSerial === null`, both `boundTo` the same id (Q-R2 (iii), client-derived, no new member) | both cards bound, note under each | W-A1 + **`<REQ:common.captureAudioCards.card.notTellable>`** (provisional - row 96 Q-R2) |
| Registered | 201 REGISTERED | success alert | `.result.REGISTERED` |
| Re-enabled | 200 REENABLED | success alert | `.result.REENABLED` |
| Card changed | 200 CARD_CHANGED | success alert | **W-A5 `.result.CARD_CHANGED`** (new text, 3.3) |
| Released | 2xx with `releasedDeviceId !== null` | success alert of the change + a second line | `.result.<change>` + **W-A3 `.released`** (`released` = name of `releasedDeviceId`) |
| Refused: already bound | 409 `AUDIO_CARD_ALREADY_BOUND` (race: another operator bound it between list and register) | warning | **W-A4 `.refusal.AUDIO_CARD_ALREADY_BOUND`** |
| Refused: other | 404 / BEYOND / NOT_REGISTRABLE / FAILED | warning / danger | `.refusal.NOT_FOUND`, `.AUDIO_INPUT_BEYOND_CARD`, **W-A6 `.AUDIO_INPUT_NOT_REGISTRABLE`** (text check, `dep: row 88`), `.FAILED` |

### 3.3 Word texts (row 101 applies these; register drafts replaced)

| Key | Text |
|---|---|
| W-A1 `common.captureAudioCards.card.boundTo` | `Bound to {{device}}` |
| W-A2 `common.captureAudioCards.release` | `Release from {{device}}` |
| W-A3 `common.captureAudioCards.released` | `{{released}} no longer uses this sound card.` (+ ` It was removed from its microphone line.` only if row 88 clears the slot) |
| W-A4 `common.captureAudioCards.refusal.AUDIO_CARD_ALREADY_BOUND` | `This sound card is already used by {{device}}. List the sound cards again, or release it from {{device}} first. Nothing was saved.` (`device` from `details.deviceId`; fallback without the name is NOT worded: the reason always carries it) |
| W-A5 `common.captureAudioCards.result.CARD_CHANGED` | `Input {{number}} is {{device}}, which was stored for another sound card. It now names this sound card.` |
| W-A6 `common.captureAudioCards.refusal.AUDIO_INPUT_NOT_REGISTRABLE` | unchanged unless row 88 changes the predicate; if it does: `This Core cannot capture from this sound card, or cannot find it again, so the input was not registered. Nothing was saved.` |
| `<REQ:common.captureAudioCards.releaseHint>` | `{{device}} will stop using this sound card. Choose the input for the new microphone, then register it.` |
| `<REQ:common.captureAudioCards.card.notTellable>` | `Two sound cards of this model state no serial number. The Core cannot tell which one {{device}} uses, so neither is offered.` |

## 4. Screen: Audio input card (`features/devices/audio-input-card.tsx`)

No word change. Behaviour delta:

| State | Condition | Word key |
|---|---|---|
| Assigned, ok | slot holds a MIC | existing `devices.status.*`, `devices.audio.*` |
| Not assigned | slot empty (T19) | `common.captureSlot.notAssigned` |
| Port moved (serial-less card) | today a MIC_DISCONNECTED fault (PORT_DIFFERS); after R-FLEX the same card on another port is SAME_CARD: no fault | existing ok words (RM-A1/A2) |
| Released holder | `dep: row 88`: if the release clears the slot -> "Not assigned" row above; if it does not, the tile keeps the MIC and shows its status chip (`devices.status.*`) as the runtime reports it | existing |
| Ambiguous (Q-R2 iii) | open refused CARD_AMBIGUOUS -> no fault raised (`mic-loss.ts:295` undecided) | existing status words; no new key |

`devices.audio.noSignalHelp` ("No signal on {{port}}. Check the XLR cable...") names the line, not the USB port: unchanged.

## 5. Screen: Capture selector (`features/devices/capture-selector-panel.tsx`, `capture-selector.ts`)

4 slots unchanged: VIDEO-01, VIDEO-02 (cameras), PRIMARY, STANDBY (mics) (T16).

Mic menu rules (per mic row):

| # | Rule | Today | Delta | Word key |
|---|---|---|---|---|
| M1 | "Not assigned" is the first option; saving it unassigns (op 78) | `:549`, `:465` | unchanged | `common.captureSlot.notAssigned` |
| M2 | Every MIC device is an option | `:651` (no filter) | **exclude a device with `retiredAt` present** (it is refused anyway, `CAPTURE_DEVICE_RETIRED`); needed if row 88 picks retire as the release (AU-X1) | none |
| M3 | The other line's mic is a disabled option, labelled | `:458`, `:553` | unchanged | `devices.micLines.onOtherLine.PRIMARY/STANDBY` |
| M4 | A released microphone | does not exist | `dep: row 88`: (i) release = retire -> covered by M2; (ii) release = slot clear + `enabled=false` -> the device has `online: false` (T17) and is a disabled option labelled `<REQ:devices.micLines.released>` ("no sound card - register one on Sound cards"); (iii) slot clear only, row unchanged -> the console cannot tell, NOT acceptable (two MIC rows would match one card) | `<REQ:devices.micLines.released>` (only for (ii)) |
| M5 | Two MICs on one physical card | possible today | impossible after R-FLEX (exclusive binding): no menu rule | none |
| M6 | Server refusals of a slot edit | `slot-refusal.ts:68` | unchanged | `common.captureSlotRefusal.*` |

Camera slots: unchanged UI; a camera on any host interface is assignable (D10(2)), no word change.

States: empty selector (`selector-empty`), read failed, forbidden, locked, slot assigned, slot not assigned, saved toast (`devices.selector.saved`) - all unchanged keys.

## 6. Screen: Session-new device check (`features/session-new/devices-step.tsx`)

No word change; it reads the selector in force (T18).

| State | Word key |
|---|---|
| Meter line assigned | `micName` + role `web.waveM.micLine.<role>` |
| Meter line empty | `common.captureSlot.notAssigned` |
| Slot unassigned check item (e.g. holder released and slot cleared, `dep: row 88`) | `common.captureNotice.start.sourceNotAssigned` with `common.captureSlot.<slot>` |
| Mic unreachable (incl. ambiguous serial-less pair) | `common.captureNotice.start.activeMicrophone` / `.noStandby` / `.oneMicrophone` / `.noMicrophone` |
| Port-moved serial-less mic | now PASS (no fault); previously a no-signal / unreachable reason |

## 7. Screen: Commissioning network form (`features/commissioning/index.tsx` SettingsForm `:237-392`)

The form is already optional (T10): no field, schema or model change. Only words change.

| State | Condition | Word key |
|---|---|---|
| Not configured | `!config.configured` (alert `com-not-configured`) | **W-N1 `web.commissioning.settings.notConfigured`** |
| Field hints | always | **W-N2 `web.commissioning.settings.interfaceName.hint`**, **`.cameraSubnet.hint`** |
| Field errors | invalid form | `.interfaceName.error`, `.cameraSubnet.error` (unchanged) |
| Saved / unchanged / never written / read failed / not production / simulated | as today | unchanged keys |

Texts (Q-R4 = stay bound; variant in brackets for Q-R4 = global):

| Key | Text |
|---|---|
| W-N1 | `No camera interface or no camera subnet is chosen. The camera search and the connection of cameras do not need them; until both are set, a factory address scan and a camera address change are refused.` [global: `No camera interface or no camera subnet is chosen. Nothing needs them; they are kept for reference.`] |
| W-N2 interfaceName.hint | `The network interface the factory address scan and the camera address change use, for example eth1 or enP3s0: letters of either case, digits, "_", "." and "-", the first a letter or a digit, at most 15 characters. Cameras on other interfaces are still found and connected. Leave it empty for "not chosen".` |
| W-N2 cameraSubnet.hint | `The private IPv4 network a camera address change gives cameras, as a.b.c.d/n with a prefix length of 16 to 30, for example 192.168.10.0/24. Leave it empty for "not chosen".` |

## 8. Screen: Camera search panel (`features/devices/camera-search-panel.tsx`, `camera-search-address.tsx`) and connect dialog

| State | Word key | Delta |
|---|---|---|
| Intro / searching / finishing | `common.captureSearch.intro`, `.searching`, `.searchingHint`, `.finishing` | none |
| Results + summary | `.summary`, `.networksSearched` (`interfaceCount`), `.columns.*`, `.status.*` | none: count kept, no per-result interface (NW-S1; T13) |
| Empty | `.emptyTitle`, `.emptyBody` | none |
| Failed (e.g. `NO_ELIGIBLE_INTERFACE`) / unavailable / busy / expired | `.failed`, `.unavailable`, `.busy`, `.expired` | none |
| Typed address refused (422 `DISCOVERY_ADDRESS_NOT_ALLOWED`) | `common.captureSearch.typedAddress.notAllowed` | **text change, key not in register -> `<REQ:common.captureSearch.typedAddress.notAllowed>`**: `The Core does not ask this address. It asks only private addresses on a network the Core is connected to. Nothing was sent.` |
| Connect test: network not configured | **W-N3 `common.captureConnect.networkNotConfigured`, `.networkNotConfiguredDetail`** | remove both keys, the `NETWORK_NOT_CONFIGURED` branch of `camera-connect.ts:205,229` and `camera-connect-dialog.tsx:625,661-665`, and the web reference `web.*.networkNotConfigured` (`i18n-web.ts:~130-134`). Readers re-grepped: only these (non-test). Provisional per register until row 90 confirms the test path no longer raises it |

Per-result interface: NOT in this delta. `capture-discovery.ts:258` states the answer reports an interface COUNT, never a name or an address; a per-result interface is a contract change that needs row 96 (Q-92-1).

Note (U-RF3, no word change): `networksSearched` may count up to 4 interfaces (`DISCOVERY_MAX_INTERFACES`, NW-K1) while the host firewall admits answers on the camera port only (HOST-23). "Searched 3 networks" is literally true (probes left on 3) - recorded for row 93/96, not reworded.

## 9. Tests that pin these (row 99 / web rows extend existing files; no new per-wave test file)

| Pin | File:line | What changes |
|---|---|---|
| Ops 98/99 registry row, statuses, examples | `packages/shared/test/api-capture-discovery.test.ts:613`, `:637`, `:661` | 409 reason list gains `AUDIO_CARD_ALREADY_BOUND`; examples gain `boundTo`, `releasedDeviceId` |
| Device-text rule of op 98 members | same `:679` | `boundTo` is an id, not device text (pattern) |
| Op 99 request is three members | same `:733` ("a card id ... and two integers") | becomes "... two integers and an optional boolean"; still no device text |
| Op 99 answer + audit row; change list | same `:762`, `:764` (`toEqual(['REGISTERED','CARD_CHANGED','REENABLED'])`) | audit list gains `RELEASED`; answer enum stays three values |
| Simulator listing | same `:775` | `boundTo: null` on both test cards |
| Registry count 111 | `packages/shared/test/api-registry.test.ts:199-200,360-401` | unchanged (no new operation) |
| Openapi 45 ops, no drift | `packages/shared/test/openapi.test.ts:205,255` | regenerate `openapi.json`; count unchanged |
| Openapi scope | `packages/shared/test/api-openapi-scope.test.ts` | unchanged scope; regenerated text |
| Ops 101/102 statuses, reasons | `packages/shared/test/api-capture-commissioning.test.ts:99,157,406` | text only; `COMMISSIONING_NOT_CONFIGURED` stays a reason (scan/set-IP) |
| Audit change list equality | `apps/core-server/src/core/__tests__/writers.test.ts:352,479,534` | `RELEASED` in both lists |
| Core contract / RBAC | `apps/core-server/test/acceptance/contract.test.ts`, `rbac-matrix.test.ts` | contract shape of 98/99 |
| Server routes | `apps/core-server/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts`, `service.test.ts` | 409 ALREADY_BOUND, release, boundTo (row 88 enumerates) |
| Web audio panel | `apps/core-web/src/features/devices/__tests__/audio-cards.test.tsx:51,69,113,183,237,300` | bound/release/ambiguous states; ALREADY_BOUND sentence; released line |
| Web selector | `__tests__/selector-microphones.test.tsx` (`:200` other-line option) | M2 / M4 |
| Web connect | `__tests__/camera-connect.test.tsx`, `camera-connect-canary.test.tsx` | NETWORK_NOT_CONFIGURED branch removed |
| Web commissioning | `apps/core-web/src/features/commissioning/__tests__/commissioning.test.tsx` | W-N1 text |
| Words | `packages/shared/test/i18n.test.ts`, `i18n-vocabulary-sync.test.ts` | new keys present, removed keys absent |

## 10. For row 96 (open questions this row cannot close)

| Id | Question | Options | Recommendation |
|---|---|---|---|
| Q-92-1 | Per-result interface in the camera search answer | (a) keep the count only (`capture-discovery.ts:258`); (b) add a per-candidate interface name (contract change, reverses the stated "never a name" rule; mobile mirror needs a word) | (a): D12 U-RF3 confines answers to the camera port, so a per-result name says nothing new on the bench |
| Q-92-2 | Q-R1 (b) "card input is the unit" | `boundTo` per input inside `registered[]` instead of per card | follow Q-R1 (a); spec for (b) only if the user picks it |
| Q-92-3 | Released microphone in the mic menu (M4) | (i) retire; (ii) slot clear + disable, disabled option with `<REQ:devices.micLines.released>`; (iii) slot clear only | (ii) if row 88 keeps op 111 unrouted (F6); (i) otherwise. (iii) not acceptable |
| Q-92-4 | Q-R4 wording variant for W-N1, W-N2, op 101/102 text | stay bound / global | stay bound (register Q-R4) |

## 11. Gaps

- Row 88 (release mechanism, RM-A5 predicate) and row 90 (whether the connection test still raises NOT_CONFIGURED) were not yet written when this row ran; dependent items are marked `dep: row 88/90`.
- `openapi.json` line numbers not re-read (generated file; register cites `:24928`, `:25197`, `:25988`, `:26218`).
- Mobile: op 98/99 are web-console only (`CAPTURE_AUDIO_CARD_ACCESS`, `capture-audio-cards.ts:239`); mobile search mirror unchanged (W-X).
- Test line numbers are `it(` lines read this session; per-assertion lines are row 94's.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
