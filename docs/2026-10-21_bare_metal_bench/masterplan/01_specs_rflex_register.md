---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 87
type: spec (R-FLEX names-and-constants register)
narrative_tier: 1
confidence: HIGH for "exists today" facts (re-read in the repo this session); MEDIUM for proposed names (provisional where marked)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 87, section 1.6 lines 95-111)
inputs: research/01_explore_rflex_{audio_identity,audio_ui,network_core,network_ui_docs,security_history}.md; delegation_progress_report.md (last row); decisions/decisions.md D10-D12
last_updated: 2026-10-22
---

# R-FLEX names-and-constants register (row 87)

## 0. How to use this register

- **Single source of names** for rows 88-95 and the R-FLEX code rows 98-114 (driver_rules.md, "Spec waves": "R-FLEX names come ONLY from masterplan/01_specs_rflex_register.md"). A name missing here goes to `delegation_progress/file_requests.md` as `row N | register | name | why` and is used as `<REQ:name>`.
- **One value per name.** Where the spec row may still decide that a name is *not used*, the value is still fixed here; only its use is open.
- **Status words.** `FIRM` = follows from a fixed ruling (D10, D11, D12, AC9 as approved in D12) and needs no further decision. `provisional - row 96` = the name's value is fixed, but whether it is used depends on a still-open user question (row 96 sheet). `provisional - row NN` = the spec row NN decides use without the user.
- **Paths** are relative to `/Users/gsp-budi/Documents/DEMS` unless stated. "Today" facts were re-read in the repo on 2026-10-22 (working tree of branch `task4/input-av-core-port`, read-only).

### 0.1 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The fixed list of identifiers (operations, refusal codes, DB objects, migration numbers, audit words, word keys, config names) the R-FLEX change adds, changes or removes |
| Who | Consumers: spec rows 88 (audio), 89 (security), 90 (network), 91 (DB), 92 (API/UI/words), 93 (host docs), 94 (impact), 95 (reconcile), 96 (decision sheet); code rows 98-114 |
| When | Stage S1 of the spec waves (before 88-94), 2026-10-22 |
| Where | Workspaces `apps/core-server`, `packages/shared`, `apps/core-web`, `apps/mobile` (word mirror only) |
| Why | D10 ruling 1 (USB audio: no port lock; a bound card is exclusive; re-bind releases the old binding) and ruling 2 ("Global penuh": the single camera-interface rule is lifted), D11 (risk accepted), D12 (U-RF3: search answers on the camera port only; AC9 added) |
| How | Each name traced to its owner file and to the research line that motivates it; every removed code's callers re-listed by `grep` this session; migration number read from the drizzle journal |
| Alternatives | Recorded per name where a spec row may still choose; the register gives one value and a recommendation |
| Assumptions | (A1) AC9 text in 02_structured.md:61 is the approved acceptance target. (A2) Code rows follow the repo's existing migration pattern (generated + hand-written privileges/version file). (A3) No other branch adds migrations or operations before row 98 |
| Gaps | Listed in section 9 |

## 1. Fixed facts the register builds on (verified this session)

| # | Fact | Evidence |
|---|---|---|
| F1 | Last migration in the journal is idx 33, tag `0033_capture_device_retirement_privileges`; 34 entries | `apps/core-server/src/db/migrations/meta/_journal.json:233` (idx 32), `:240` (idx 33); `python3` count of `entries` = 34 |
| F2 | Migration output folder of drizzle-kit is `./src/db/migrations` | `apps/core-server/drizzle.config.ts:23` |
| F3 | Current version row: schema version 15, contract revision `dbc-16`; written by the hand-written file of the set | `apps/core-server/src/db/schema/meta.ts:121,123`; `0033_capture_device_retirement_privileges.sql:89` |
| F4 | Latest migration set is set 16 (0032 + 0033); latest contract delta is `contract-v15-delta.ts`; latest set test is `set16.db.test.ts` | `apps/core-server/test/db/set16.db.test.ts:1-2`; `ls apps/core-server/test/db` |
| F5 | The Core API has 111 operations; 111 = `retireCaptureDevice` | `packages/shared/test/api-registry.test.ts:362`; `packages/shared/src/api/core-api.ts:1157-1158` |
| F6 | Operation 111 is in the contract but NOT routed in the Core (landed unrouted "until task 4 row RD3") | `apps/core-server/test/acceptance/contract.test.ts:233-235`; no server file names `CAPTURE_RETIRE_OPERATIONS` (grep of `apps/core-server/src`) |
| F7 | The uncommitted LCD work adds an optional `lcd` member to an existing schema, NOT a new operation | `git diff packages/shared/src/api/core-api.ts` (+import, +`lcd:` in `DeviceHealthResponseSchema`) |
| F8 | Destination-rule refusal codes are Core-internal; the API answers with `DISCOVERY_ADDRESS_NOT_ALLOWED` (422) or `COMMISSIONING_NOT_CONFIGURED` (409) | `apps/core-server/src/modules/capture-discovery/routes.ts:28,71`; `connect/service.ts:364,385`; `packages/shared/src/api/capture-discovery.ts:173` |
| F9 | The search answer deliberately carries `interfaceCount`, "a count, never a name or an address" | `packages/shared/src/api/capture-discovery.ts:258` |
| F10 | `capture_network_config.interface_name` and `camera_subnet` are already NULLABLE; write side accepts null | `0017_network_commissioning.sql:3-4,13-14`; `research/01_explore_rflex_network_ui_docs.md` RQ-N4 "Write side" |
| F11 | Runtime role has no DELETE on `capture_audio_inputs`; it may UPDATE `usb_serial`, `usb_port`, `retired_at` | `0016` grants per `01_explore_rflex_audio_identity.md` §1; `0018:40`; `0033_capture_device_retirement_privileges.sql:17` |
| F12 | Only one i18n language tree exists (`packages/shared/src/i18n/en`); web words in `apps/core-web/src/i18n-web.ts`; mobile mirror for capture search in `apps/mobile/src/features/capture-selector/i18n.ts` | `ls packages/shared/src/i18n`; `01_explore_rflex_audio_ui.md` §5; `01_explore_rflex_network_ui_docs.md` (mobile `:159`) |

## 2. Operations (shared API and openapi)

**Recommendation: no new operation.** Every R-FLEX behaviour fits existing operations 98, 99, 101/102 and the internal destination rule. The next free number is fixed here so that a spec row that still needs one does not invent it.

| Id | Name | Value | Status | Owner file | Motivation |
|---|---|---|---|---|---|
| OP-0 | Next free operation number | `112` (registry total becomes 112) | reserved, NOT recommended | `packages/shared/src/api/core-api.ts:1158`; count pinned `packages/shared/test/api-registry.test.ts:362,878-879,1287` | F5 |
| OP-98 | `searchCaptureAudioCards` (POST `/api/v1/capture/audio-cards/search`) | CHANGED: listing entry gains member `boundTo` (AU-L1) | FIRM (AC9 "a bound card is not offered for a new binding") | `packages/shared/src/api/capture-audio-cards.ts:125-157`; openapi `packages/shared/openapi/openapi.json:24928` | `01_explore_rflex_audio_ui.md` §1 ("no bound/exclusive/available member") |
| OP-99 | `registerCaptureAudioInput` (POST `/api/v1/capture/audio-cards/inputs`) | CHANGED: body member `release` (AU-B1), answer member `releasedDeviceId` (AU-B2), reason `AUDIO_CARD_ALREADY_BOUND` (AU-R1), contract text `:289` and `:305` | FIRM (D10(1): exclusive + release on re-bind) | `capture-audio-cards.ts:175-192,276-315`; openapi `:25197` | `01_explore_rflex_audio_identity.md` §5-6; `01_explore_rflex_audio_ui.md` §2 RQ-A4 |
| OP-101/102 | `getCaptureNetworkConfig` / `updateCaptureNetworkConfig` | CHANGED: descriptions of `configured` and of the operation (no longer "every commissioning function"); no schema change | FIRM text change; exact scope provisional - row 96 (RQ-N2) | `packages/shared/src/api/capture-commissioning.ts:393,583`; openapi `:25988`, `:26218` | `01_explore_rflex_network_ui_docs.md` RQ-N4 options 1, 4 |
| OP-93..97 | `startCaptureDiscovery` / `getCaptureDiscovery` / `testCaptureCandidateConnection` / `adoptCaptureCandidate` | Unchanged names and schemas; behaviour text of the typed address and of the connection test changes (no `COMMISSIONING_NOT_CONFIGURED` from the test path once stored-camera dials are global, NW-R4) | FIRM | `packages/shared/src/api/capture-discovery.ts:510,538,629,669` | D10(2); `connect/service.ts:385` |
| OP-111 | `retireCaptureDevice` | Unchanged. NOT used as the release mechanism unless row 88 chooses it (see AU-X1) | provisional - row 88 | `packages/shared/src/api/capture-retire.ts:2-9,172` | F6 (unrouted) |

## 3. Refusal codes

### 3.1 Removed (with every caller, re-grepped 2026-10-22)

| Id | Code | Owner (definition) | Status | Production callers (file:line) | Test callers (file:line or file:count) | Motivation |
|---|---|---|---|---|---|---|
| RM-A1 | `CardMismatch.PORT_DIFFERS` (detail word of `AUDIO_CARD_CHANGED`) | `apps/core-server/src/capture/adapters/audio/usb-audio-production.ts:287` | **FIRM remove** (D10(1); AC9 "a port move keeps the binding") | `usb-audio-production.ts:358` (raise in `identifyRegisteredCard`); doc comment `:323-326` | `capture/adapters/audio/__tests__/usb-audio-production.test.ts:545,629,670,972`; `capture/adapters/audio/__tests__/macos-card-listing.test.ts:864,867,877` | `01_explore_rflex_audio_identity.md` §3 step 6 |
| RM-A2 | `StoredCardMatch.PORT_DIFFERS` | `apps/core-server/src/modules/capture-inputs/audio-cards/service.ts:380` | **FIRM remove** | `service.ts:439` (raise in `matchStoredCard`); doc `:417` | `modules/capture-inputs/audio-cards/__tests__/service.test.ts:455,480,539,551,552,622`; `.../__tests__/routes.db.test.ts:533` | same |
| RM-A3 | `CardMismatch.IDENTITY_NOT_STORED` | `usb-audio-production.ts:289` | provisional - row 96 (RQ-A6); recommended remove (with no port compare, a row holding a USB id and no serial is "any unit of the model", so the "nothing to re-find it by" case no longer exists) | `usb-audio-production.ts:342` | `usb-audio-production.test.ts:610,672`; `macos-card-listing.test.ts:889,890` | `01_explore_rflex_audio_identity.md` §7 |
| RM-A4 | `StoredCardMatch.IDENTITY_NOT_STORED` | `service.ts:382` | provisional - row 96 (RQ-A6), same as RM-A3 | `service.ts:430`; doc `:50`, `:406` | `service.test.ts:499,513,545-549`; `routes.db.test.ts:533` | same |
| RM-A5 | Registration refusal "states no serial AND no port" (`unidentifiable` -> `AUDIO_INPUT_NOT_REGISTRABLE` with sentence of `notIdentifiable`) | `service.ts:446` (predicate), `:203` (sentence) | provisional - row 88; recommended: predicate changes to "states no USB id" only; reason code `AUDIO_INPUT_NOT_REGISTRABLE` itself stays (it is also the simulator's answer, `capture-audio-cards.ts:104-105`) | `service.ts:479` | `service.test.ts` (row 88 to enumerate) | `01_explore_rflex_audio_identity.md` §3 last line |
| RM-N1 | `DestinationRefusal.OTHER_INTERFACE_SUBNET` | `apps/core-server/src/capture/destination-rule.ts:66` | **FIRM: no longer raised for `TYPED_PROBE`, `STORED_CAMERA`** (D10(2)). Deletion of the constant: provisional - row 96 (RQ-N2: whether `COMMISSIONING_SCAN`/`SET_IP` stay interface-bound) | `destination-rule.ts:353` (`decideDestination`), `:425` (`decideNewCameraAddress`) | `capture/__tests__/destination-rule.test.ts`:3; `capture/adapters/camera/__tests__/stored-address-cases.ts`:1; `__tests__/capture-composition.test.ts`:1; `__tests__/capture-composition.db.test.ts`:1; `modules/capture-discovery/__tests__/adopted-test.test.ts`:1; `modules/capture-config/network/__tests__/routes.db.test.ts`:1; `.../network/__tests__/service.test.ts`:1; `modules/capture-config/__tests__/credential-reader.db.test.ts`:1; `.../credential-reader.test.ts`:1; `.../camera-adapter-open.db.test.ts`:1; `modules/capture-discovery/connect/__tests__/service.test.ts`:1 | `01_explore_rflex_network_core.md` N2, N5 point 2; `01_explore_rflex_security_history.md` §2 |
| RM-N2 | `DestinationRefusal.OUTSIDE_CAMERA_SUBNET` | `destination-rule.ts:70` | same as RM-N1 | `destination-rule.ts:364` (`decideDestination`), `:426` (`decideNewCameraAddress`, set-IP: the new address inside the camera subnet; kept if SET_IP stays bound) | `test/support/loopback-destination.ts`:1; `capture/adapters/camera/__tests__/onvif-relay.test.ts`:1, `onvif-network.test.ts`:1, `camera-watch.test.ts`:3, `stored-address-cases.ts`:1; `capture/__tests__/destination-rule.test.ts`:9; `__tests__/capture-composition.test.ts`:2, `.db.test.ts`:2; `modules/capture-discovery/__tests__/search.test.ts`:2, `adopted-test.test.ts`:1, `readdress.test.ts`:4; `modules/capture-config/network/__tests__/service.test.ts`:7, `routes.db.test.ts`:18; `modules/capture-config/__tests__/credential-reader.test.ts`:1, `camera-adapter-open.db.test.ts`:1, `adopted-camera-test.db.test.ts`:1 | same |
| RM-N3 | `DestinationRefusal.NO_CAMERA_SOURCE` | `destination-rule.ts:72` | same as RM-N1; **extra caller to rewrite if deleted**: it is the form-check sentinel `FORM_ACCEPTED` | `destination-rule.ts:360`; `apps/core-server/src/modules/capture-config/network/facts.ts:174` (`FORM_ACCEPTED`, read by `formAccepted` `:177-180`, used by `cameraSubnetAccepted` `:186-189` and `factoryAddressAccepted` `:192-195`) | `capture/__tests__/destination-rule.test.ts`:1; `modules/capture-config/network/__tests__/service.test.ts`:2, `routes.db.test.ts`:3 | same; sentinel found this session |
| RM-N4 | `DestinationRefusal.NOT_CONFIGURED` **in its "no camera interface / no camera subnet" meaning** | `destination-rule.ts:68` | **FIRM: no longer raised for `TYPED_PROBE` / `STORED_CAMERA` because interface or subnet is empty.** The constant STAYS (also used for malformed requests and unreadable gateway/registry: `:345`, `:413`, `:433`, `:446`) | `destination-rule.ts:351` (facts null), `:420`; Core consumer that maps it to the API word: `modules/capture-discovery/connect/service.ts:364` (`RULE_NOT_CONFIGURED`), `:385` -> `COMMISSIONING_NOT_CONFIGURED`; null-facts stand-in `capture/fence/production-parts.ts:74` (`HOST_NOT_CONFIGURED`), used `:91`, `:116`, `:810` | as RM-N1 plus `test/acceptance/contract.test.ts:1306,1424-1425` | `01_explore_rflex_network_ui_docs.md` RQ-N4 read side |

Not removed (kept by name, confirmed by row 86): point 1 codes `NOT_AN_ADDRESS`, `HOST_NAME`, `MALFORMED_IPV4`, `IPV6_LITERAL`, `IPV4_MAPPED_IPV6`, `LOOPBACK`, `UNSPECIFIED`, `LINK_LOCAL`, `MULTICAST`, `BROADCAST`, `PUBLIC_ADDRESS`, `NETWORK_ADDRESS`, `SUBNET_BROADCAST`, `HOST_ADDRESS`; point 3 `PORT_OUT_OF_RANGE`, `PORT_NOT_LISTED`, `PORT_LIST_INVALID`; set-IP `DHCP_NOT_CARRIED`, `GATEWAY_ADDRESS`, `REGISTERED_CAMERA_ADDRESS`, `GATEWAY_OUTSIDE_SUBNET` (`destination-rule.ts:36-86`; `01_explore_rflex_security_history.md` §2 "Points 1, 3, 4 are independent of which interface is used"). Their keep/drop list is row 89's; row 89 uses these names unchanged.

### 3.2 Added

| Id | Code | Value | Layer / owner | Status | Motivation |
|---|---|---|---|---|---|
| AU-R1 | `CaptureAudioCardReason.AUDIO_CARD_ALREADY_BOUND` | `'AUDIO_CARD_ALREADY_BOUND'`, `409 INVALID_STATE`, `details.reason`; `details.deviceId` = the MIC id holding the card | `packages/shared/src/api/capture-audio-cards.ts:102-111` (reason list) + Core `modules/capture-inputs/audio-cards/service.ts` | FIRM (D10(1) "jangan open lagi ke pairing baru") | `01_explore_rflex_audio_identity.md` §5 ("D10's 'bound card is exclusive' has no equivalent in code") |
| AU-R2 | `CardMismatch.MODEL_SHARED` (detail of the existing `AUDIO_CARD_AMBIGUOUS`) | `'MODEL_SHARED'`: two or more live units of the stored USB id, none states a serial, so the rule cannot say which is the bound one | `usb-audio-production.ts:283-293` | provisional - row 96 (RQ-A2) | `01_explore_rflex_audio_identity.md` §4 option (iii) (`mic-loss.ts:295` treats AMBIGUOUS as "undecided", no fault) |
| AU-R3 | `StoredCardMatch.NOT_TELLABLE` (existing word, widened use) | unchanged value `'NOT_TELLABLE'`, now also for AU-R2's case at registration/listing | `service.ts:384` | provisional - row 96 (RQ-A2) | same; re-use rather than a second word |
| NW-R1 | `DestinationRefusal.NO_SOURCE_INTERFACE` | `'NO_SOURCE_INTERFACE'`: no up, non-internal IPv4 interface of the host holds a subnet containing the target, so no source address is named and nothing is dialled (no silent route through a gateway) | `destination-rule.ts:36-86` | provisional - row 89/90 (source-selection rule; row 89 decides whether a routed, off-link target is refused) | `01_explore_rflex_security_history.md` §2 ("a global rule needs a new source-selection statement"); `01_explore_rflex_network_core.md` N2 `:357-366` |

No new API-level reason for the network side: refusals keep surfacing as `DISCOVERY_ADDRESS_NOT_ALLOWED` / `COMMISSIONING_NOT_CONFIGURED` (F8).

## 4. Database objects

### 4.1 Migration numbers (cited from the journal)

| Id | Name | Value | Status | Evidence |
|---|---|---|---|---|
| DB-M1 | Next generated migration | `0034_audio_input_binding.sql` (journal idx 34; snapshot `meta/0034_snapshot.json`) | used only if row 91 adds a schema object (DB-A1 or DB-A3) | F1, F2 |
| DB-M2 | Next hand-written migration (grants + version row) | `0035_audio_input_binding_privileges.sql` (journal idx 35; snapshot `meta/0035_snapshot.json`) | same | pattern: every set ends with a hand-written `*_privileges.sql` that writes `schema_meta` (17 files, `grep -l schema_meta`), e.g. `0033:89` |
| DB-M3 | Migration set number | `17` | same | F4 |
| DB-M4 | Version row after the set | `schema_version = 16`, `contract_revision = 'dbc-17'`; constants `DB_SCHEMA_VERSION = 16`, `DB_CONTRACT_REVISION = 'dbc-17'` | same | F3 |
| DB-M5 | Contract delta file / set test | `apps/core-server/test/db/contract-v16-delta.ts`; `apps/core-server/test/db/set17.db.test.ts` (cases `M17S-1..n`, pattern of `set16.db.test.ts:17-30`) | same | F4 |

If row 91 concludes that no DB object changes (all R-FLEX rules enforced in the service), DB-M1..M5 are NOT used and the version stays (15, `dbc-16`). Row 91 must say which.

### 4.2 `capture_audio_inputs`

| Id | Object | Value | Status | Owner | Motivation |
|---|---|---|---|---|---|
| DB-A1 | Partial unique index for card exclusivity (serial-stating cards) | name `capture_audio_inputs_usb_identity_key`; columns `(usb_id, usb_serial)`; `WHERE retired_at IS NULL AND usb_serial IS NOT NULL` | provisional - row 96 (Q-R1 in section 8: exclusivity per physical card vs per card input) and row 91 (DB vs service). Serial-less cards have no DB-visible identity without the port, so the service check (DB-A2) is needed in any case | `apps/core-server/src/db/schema/capture.ts:429-472`; migration DB-M1 | `01_explore_rflex_audio_identity.md` §5 options |
| DB-A2 | Service-level exclusivity query (not a DB object; named here so tests can name it) | statement constant `READ_BOUND_AUDIO_INPUTS` in `modules/capture-inputs/audio-cards/statements.ts` (non-retired rows of one USB id) | FIRM (needed for serial-less cards) | `statements.ts` (next to `:31`, `:37`) | same; `statements.ts:31,37` do not filter `retired_at` |
| DB-A3 | `usb_port` column | name unchanged; recommended KEEP as an informational field still refreshed by `REFRESH_AUDIO_INPUT` and no longer compared; CHECK `capture_audio_inputs_usb_port_check` unchanged | provisional - row 96 (RQ-A6). If the user picks "drop": `ALTER TABLE capture_audio_inputs DROP COLUMN usb_port` in DB-M1 (drops the CHECK with it), grant line `0018:40` becomes moot | `0017_network_commissioning.sql:45,52`; `schema/capture.ts` | `01_explore_rflex_audio_identity.md` §7 |
| DB-A4 | Existing key `capture_audio_inputs_card_input_key` (partial UNIQUE `(card_id, card_device, input_number) WHERE retired_at IS NULL`) | unchanged | FIRM keep | `0032_capture_device_retirement.sql:7` | §1 "Uniqueness today" |
| DB-A5 | `retired_at` | unchanged column; used by the release only if row 88 picks "retire" (AU-X1) | provisional - row 88 | `0032:3`, guard `0033` | §6 option (1) |

No new column is registered. A "released" state does not need one under either recommended release form (slot clear, or retire via the existing `retired_at`).

### 4.3 `capture_network_config`

| Id | Object | Value | Status | Motivation |
|---|---|---|---|---|
| DB-N1 | `interface_name`, `camera_subnet` | unchanged: nullable, no default, CHECKs `capture_network_config_interface_name_check` / `_camera_subnet_check` unchanged | FIRM: no DB change needed for optionality | F10; `01_explore_rflex_network_ui_docs.md` RQ-N4 option 4 |
| DB-N2 | other columns (`factory_addresses`, `alias_host`, `alias_minutes`, `camera_ip_start`, `onvif_ports`) | unchanged | FIRM | same |

### 4.4 `capture_config`

| Id | Object | Value | Status | Motivation |
|---|---|---|---|---|
| DB-C1 | `mic_primary_id`, `mic_standby_id`, CHECK `capture_config_mic_check` (primary <> standby), FKs `ON DELETE RESTRICT` | unchanged | FIRM | `db/schema/capture.ts:246-251,306` per `01_explore_rflex_audio_identity.md` §5-6; a release that clears a slot writes NULL, which is already allowed |

## 5. Audit words

| Id | Name | Value | Status | Owner | Motivation |
|---|---|---|---|---|---|
| AU-A1 | New `change` of `CAPTURE_AUDIO_INPUT_CHANGED` for the OLD microphone when its card is re-bound | `'RELEASED'`; details keys unchanged (`deviceId`, `change`, `inputNumber`, `channelCount`, `operationId`, `permission`; no serial/port/usb id) | FIRM (a release must be audited; no word exists) | Both lists, which must stay equal: `apps/core-server/src/core/audit-details.ts:207` (`CAPTURE_AUDIO_INPUT_CHANGES`) and `packages/shared/src/api/capture-audio-cards.ts:94` (`CaptureAudioInputChange`); pins `apps/core-server/src/core/__tests__/writers.test.ts:352,479,534` | `01_explore_rflex_audio_identity.md` §6 ("There is no 'unassign' or 'released' audit change code") |
| AU-A2 | Audit of the slot clear (if the release also empties a selector slot) | existing `CAPTURE_CONFIG_CHANGED`, scope `MIC`, field `MICS` (no new value) | provisional - row 88 | `audit-details.ts:523-534` | §6 option (3) |
| AU-X1 | Retire reason if release = retire | `CaptureDeviceRetireReason.REBOUND` = `'REBOUND'` | provisional - row 88; **not recommended**: op 111 is unrouted (F6) and refuses an assigned device (`CAPTURE_DEVICE_ASSIGNED`, `capture-retire.ts:80-82`) | `packages/shared/src/api/capture-retire.ts:47-55` | F6 |

No new audit TYPE. `CAPTURE_DISCOVERY_SEARCHED` (scope `AUDIO_CARDS`) and `CAPTURE_NETWORK_CONFIG_CHANGED` unchanged.

## 6. Schema members (shared API) added or changed

| Id | Member | Value | Status | Owner | Motivation |
|---|---|---|---|---|---|
| AU-L1 | `CaptureAudioCardSchema.boundTo` | `MIC-NN` id (pattern `HARDWARE_DEVICE_ID_PATTERN`) or `null`: the microphone that holds this physical card; a card with `boundTo !== null` is not offered for a new binding | FIRM name; per-card vs per-input meaning provisional - row 96 (Q-R1) | `capture-audio-cards.ts:125-157` | AC9; `01_explore_rflex_audio_ui.md` §1 |
| AU-L2 | `usbPort` member of the listing | unchanged name; kept (answer stays informational) unless DB-A3 "drop" is chosen | provisional - row 96 (RQ-A6) | `capture-audio-cards.ts:73,136-142` | §7 |
| AU-B1 | Op 99 body `release` | boolean, optional, default `false`; `true` = register this input and release the binding that holds the same physical card | FIRM | `capture-audio-cards.ts:175-181` | D10(1) "line yang lama harus di lepas" |
| AU-B2 | Op 99 answer `releasedDeviceId` | `MIC-NN` or `null` | FIRM | `capture-audio-cards.ts:185-192` | same |
| NW-S1 | Per-candidate interface name in the search answer | NOT registered: the contract states `interfaceCount` is "a count, never a name or an address" (F9). Row 92 keeps the count; a request for a name goes to row 96 | FIRM (no new member) | `capture-discovery.ts:258` | F9 |
| NW-C1 | `DestinationContext.otherInterfaceSubnets` -> replaced by `interfaceSubnets` (every up IPv4 interface: name, address, network, prefix length) | name `interfaceSubnets` (Core-internal type, not API) | provisional - row 90 | builder `modules/capture-config/network/facts.ts:137-166`; consumer `destination-rule.ts:289-315` | `01_explore_rflex_network_core.md` N1 builders |
| NW-K1 | `DISCOVERY_MAX_INTERFACES` | value `4` unchanged (point-4 resource bound; bench host lists fewer eligible interfaces after Docker removal: hypothesis, not counted in this row) | provisional - row 89/90 (RQ-N3) | `apps/core-server/src/capture/adapters/camera/discovery-collector.ts:32` | N3 |

## 7. Word (i18n) keys

Drafted English text is a placeholder for row 92, which owns the wording. Key names are fixed here.

| Id | Key | Catalogue file | Change | Status | Motivation |
|---|---|---|---|---|---|
| W-A1 | `common.captureAudioCards.card.boundTo` | `packages/shared/src/i18n/en/common.ts` (block `:1043-1085`, under `card` `:1052-1059`) | add, draft "Bound to {{device}}" | FIRM | AU-L1 |
| W-A2 | `common.captureAudioCards.release` | same | add (action label), draft "Move this microphone here" | FIRM | AU-B1 |
| W-A3 | `common.captureAudioCards.released` | same | add, draft "{{released}} no longer uses this sound card." | FIRM | AU-B2 |
| W-A4 | `common.captureAudioCards.refusal.AUDIO_CARD_ALREADY_BOUND` | same (`refusal` `:1075-1080`) | add | FIRM | AU-R1 |
| W-A5 | `common.captureAudioCards.result.CARD_CHANGED` | same `:1073` | change text: no longer "a sound card at another place" (a port move is now SAME_CARD) | FIRM | RM-A1/A2 |
| W-A6 | `common.captureAudioCards.refusal.AUDIO_INPUT_NOT_REGISTRABLE` | same `:1078` | text check only (RM-A5) | provisional - row 88 | RM-A5 |
| W-N1 | `web.commissioning.settings.notConfigured` | `apps/core-web/src/i18n-web.ts:759` | change text: "until both are set, a scan [and a camera address change] is refused" (search and connection no longer depend on it) | FIRM text change; bracket provisional - row 96 (RQ-N2) | `01_explore_rflex_network_ui_docs.md` Console |
| W-N2 | `web.commissioning.settings.interfaceName.hint`, `web.commissioning.settings.cameraSubnet.hint` | `apps/core-web/src/i18n-web.ts:760-770` | change text: say what the field is still used for | FIRM (wording row 92) | same |
| W-N3 | `common.captureConnect.networkNotConfigured`, `common.captureConnect.networkNotConfiguredDetail` | `packages/shared/src/i18n/en/common.ts:871-872`; mirrored `apps/core-web/src/i18n-web.ts:132-134`; readers `apps/core-web/src/features/devices/camera-connect-dialog.tsx:661-665`, `camera-connect.ts:205,229` | remove (the connection test no longer answers `COMMISSIONING_NOT_CONFIGURED`, RM-N4) | provisional - row 92 (confirm no other reader; `i18n-vocabulary-sync` test) | RM-N4 |
| W-X | Mobile mirror | `apps/mobile/src/features/capture-selector/i18n.ts` | no key added (NW-S1 adds no member) | FIRM | NW-S1 |

No word exists or is added for `PORT_DIFFERS`, `CARD_AMBIGUOUS` or for audit change values (verified: `REENABLED` appears in i18n only at `common.ts:1072`).

## 8. Config / environment names

| Id | Name | Value | Status | Evidence |
|---|---|---|---|---|
| CF-1 | New `DEMS_*` environment names | none | FIRM | existing set read from `apps/core-server/src/config.ts` and `src/plugins/config/load-config.ts` (21 names, e.g. `DEMS_CAPTURE_MODE`, `DEMS_CAPTURE_ALIAS_SOCKET`, `DEMS_LCD_BACKEND_URL`); none concerns the camera interface or audio identity |
| CF-2 | Helper interface file | `/etc/dems/netalias-interface` unchanged | FIRM unless RQ-N2 makes scan/set-IP global (provisional - row 96) | `capture/boot/program-checks.ts:129` |
| CF-3 | Boot check names `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`, `INTERFACE_FILE_ABSENT`, `INTERFACE_FILE_NOT_ONE_NAME`, `INTERFACE_FILE_DIFFERS_FROM_ROW`, host-alias `NETWORK_NOT_CONFIGURED` | unchanged | same as CF-2 | `program-checks.ts:75,111,285-294`; `capture/host-alias/caller.ts:110,113,262` |

## 9. For row 96 (open questions this register cannot close)

| Id | Question | Options | Recommendation | Names affected |
|---|---|---|---|---|
| Q-R1 | Exclusivity unit: D10(1) says a card bound to "1 input" is not offered again. A multi-input card (up to 64 inputs) may today hold several MIC rows. Is the unit the physical card or one card input? | (a) physical card: one MIC per card; (b) card input: other inputs of a bound card stay bindable | (a) for the bench (the HANMUS mic has one input, 03_deployment_check D2), simplest reading of the ruling | AU-L1 meaning, DB-A1 columns, AU-R1 trigger |
| Q-R2 | RQ-A2: two identical serial-less cards | (i) refuse the second at registration; (ii) port as tiebreak only when two are present; (iii) `AUDIO_CARD_AMBIGUOUS` / `MODEL_SHARED`, no fault | (iii) (existing "undecided" path, `mic-loss.ts:295`), out of scope on the bench (U-RF5) | AU-R2, AU-R3 |
| Q-R3 | RQ-A6: stored `usb_port` | keep informational / drop | keep (no migration, no data loss, AU-L2 stays) | DB-A3, AU-L2, RM-A3/A4 |
| Q-R4 | RQ-N2: do `COMMISSIONING_SCAN` and `SET_IP` stay bound to the configured interface? | stay bound / global | stay bound (they use the root helper on one interface, HOST-46; S13-08 pt 2/3 survive, row 86 §2) | RM-N1..N3 constant deletion, W-N1 bracket, CF-2, CF-3 |
| Q-R5 | Meaning of "line" in "re-bind ... line yang lama harus di lepas": a DEMS input (MIC-nn) or a selector line (PRIMARY/STANDBY, `devices.micLines`) | input / selector line | input (the selector already refuses one mic on both lines, `capture-config/routes.ts` per `01_explore_rflex_audio_ui.md` §4) | AU-B1, AU-A1, AU-A2 |

## 10. Gaps

- Line numbers of `openapi.json` cited as the first `operationId` line of each operation; the openapi file is generated and will be regenerated.
- Test caller lists for RM-N1..N3 are per-file counts from `grep -c`, not per-line; row 94 enumerates lines.
- RM-A5 test lines not enumerated (row 88).
- Whether the bench DB holds `capture_audio_inputs` rows (affects Q-R3 consequences) was not checked (no host access in spec waves).
- `DB-A1` column choice depends on Q-R1; its name is fixed regardless.

## 11. Additions by row 95 (reconciliation, 2026-10-22)

Additive section; sections 0-10 above are unchanged. Source of every decision: `masterplan/01_specs_rflex.md` (row 95). Where an entry below changes the status of an id above, the row-95 spec section is cited.

### 11.1 Names added

| Id | Name | Value / meaning | Owner file | Status | Requested by |
|---|---|---|---|---|---|
| NW-R2 | `DestinationRefusal.SOURCE_INTERFACE_AMBIGUOUS` | `'SOURCE_INTERFACE_AMBIGUOUS'`: for `TYPED_PROBE` / `STORED_CAMERA`, two or more different eligible interfaces hold the target at the same longest prefix, so no source can be named. Raised even if one of them is the stored camera interface. Distinct from NW-R1 (none). Replaces `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>` (row 89) and `<REQ:SOURCE_INTERFACE_AMBIGUOUS>` (row 90) | `apps/core-server/src/capture/destination-rule.ts:36-86` | FIRM (controller ruling D14) | rows 89, 90 |
| W-A7 | `common.captureAudioCards.releaseHint` | hint shown while a bound card is in release (move) mode; text per spec 6.2 | `packages/shared/src/i18n/en/common.ts` (block `:1043-1085`) | FIRM | row 92 |
| W-A8 | `common.captureAudioCards.card.notTellable` | note under two serial-less cards of one model that one MIC holds (Q-R2 (iii)) | same, under `card` `:1052-1059` | provisional - row 96 (Q-R2) | row 92 |
| W-A9 | `devices.micLines.released` | mic-menu label of a microphone whose card binding was released | `packages/shared/src/i18n/en/devices.ts` block `micLines` `:429` | provisional - row 96: used ONLY if the user picks release bundle C (spec 2.1); not built under bundle M. Row 92's condition "slot clear + enabled=false" is unreachable (no spec sets `enabled=false`) | row 92 |
| W-N4 | `common.captureSearch.typedAddress.notAllowed` | TEXT CHANGE of an existing key: "a network the Core is connected to" (was "the network the cameras are connected to") | `packages/shared/src/i18n/en/common.ts:794` | FIRM | row 92 |
| DB-A6 | `REKEY_AUDIO_INPUT` | statement constant: UPDATE of `card_id`, `card_device`, `input_number` and the identity columns of one live row by `device_id` (`WHERE retired_at IS NULL`, row count 1); added to `CAPTURE_AUDIO_CARD_WRITES`. Used by the macOS/renamed port move (row 88 D-A4.2) and by the release (bundle M, row 88 D-A4.4). Grants exist (0016:35-36, 0018:40) | `apps/core-server/src/modules/capture-inputs/audio-cards/statements.ts` (next to `:57`, list `:61`) | FIRM | row 95 (row 88 §12 left it unnamed) |
| DB-A7 | `RELEASE_AUDIO_INPUT` | statement constant: `usb_serial = NULL, usb_port = NULL` by `device_id` `WHERE retired_at IS NULL` (row 91 §4.2) | same | provisional - row 96: bundle C only | row 91 |
| DB-M0 | `0034_audio_input_binding_data.sql` | hand-written data step before the generated index file (0021 precedent). If used, DB-M1 becomes `0035_audio_input_binding.sql` and DB-M2 `0036_audio_input_binding_privileges.sql`; snapshots and journal idx shift by one | `apps/core-server/src/db/migrations/` | provisional - row 96: only with option B (index) on data that needs it; not used on the recommended path | row 91 |
| RB-1 | `rflex_only_diff` | `.data/rflex-restore-20261022/rflex-only.diff` plus its line in that folder's `SHA256SUMS`; written by row 120; used by rollback R-FLEX-R-B (row 94 §7.2) | `/Users/gsp-budi/Documents/DEMS/.data/rflex-restore-20261022/` | FIRM name | row 94 |

Conflict check before this edit: each name above was grepped in this register (0 hits each) and in `apps/` + `packages/` `*.ts(x)` (0 hits each; `typedAddress.notAllowed` exists by design, W-N4 changes its text). Result: 0 name conflicts.

Not added (INSTALL register, rows 12/17): `ufw_revert_unit`, `pg_socket_dir`, `pg_conf_dir`, `pg_common_conf`, `pg_log_file`, `host_baseline_dir`, `install_backup_dir`, `disk_free_threshold`, `cli_cache_dir`.

### 11.2 Status changes of ids above (decided by rows 88-94 and reconciled by row 95)

| Id | New status | Basis |
|---|---|---|
| RM-A5 | decided: predicate = "USB id is the replacement word"; reason code kept | row 88 D-A1.4 |
| AU-X1, DB-A5, OP-111 | not used | row 88 §6.2 |
| AU-A2 | used by the selector move (Q-R5 reading B); by op 99 only under bundle C | spec 2.1 |
| DB-A1, DB-M1..M5 | not used on the recommended path (no migration; version stays 15 / `dbc-16`) | row 91 §6.1 |
| NW-C1 | `interfaceSubnets` is ADDED beside `otherInterfaceSubnets`, which keeps its name and meaning (not "replaced by"). Absent `interfaceSubnets` = facts unreadable, so `NOT_CONFIGURED` | spec 2.7 (row 94 I-3), O-5, O-6 |
| NW-R1 | used for TYPED_PROBE / STORED_CAMERA (on-link only pending row 96 Q96-06) | spec 2.5 |
| NW-K1 | stays 4 | row 90 §5.2 |
| W-N3 | remove: FIRM | row 90 U4 |
| W-A2, W-A3 | key names unchanged; texts per spec 6.2 under bundle M | spec 2.4 |
| RM-A3/A4, DB-A3, AU-L1, AU-R2/R3, RM-N1..N3 deletion, W-N1 bracket, CF-2/CF-3 | still provisional - row 96 (spec section 8 ids Q96-09, Q96-09, Q96-01, Q96-03, Q96-04) | spec 8 |

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
