---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore
scope: row 82 - R-FLEX audio: RQ-A1, RQ-A2, RQ-A3 (code), RQ-A4 (code), RQ-A6. Code reading only, no host access.
tier: 2
---

# R-FLEX audio identity: what the code does today

All paths below are under `/Users/gsp-budi/Documents/DEMS/apps/core-server/src` unless stated. Method: direct reading with grep (no graft graph was queried; all line numbers read from the files in this session). Nothing was run.

## 0. Findings that change how the RQs read

1. **Two copies of the identity rule exist.** `identifyRegisteredCard` (`capture/adapters/audio/usb-audio-production.ts:331`) is the RUNTIME match (open, loss watch, fence). `matchStoredCard` (`modules/capture-inputs/audio-cards/service.ts:423`) is the REGISTRATION/LISTING match (op 98, op 99). The first says it is "the same rule as" the second and does not import it (comment `usb-audio-production.ts:~300`). Both carry the serial-else-port logic. Any D10 change touches both.
2. **There is no "binding" object besides the `capture_audio_inputs` row.** A card is "bound" to a DEMS input when a `capture_audio_inputs` row (device_id = `MIC-nn`) holds its `(card_id, card_device, input_number)` + `usb_id/usb_serial/usb_port`. There is no separate assignment table. The MIC slot is a different thing: `capture_config.mic_primary_id` / `mic_standby_id` point at a `MIC-nn` device id.
3. **Row identity of an input is the kernel `card_id`, not the USB identity.** The registration finds an existing row by `(card_id, card_device, input_number)` (`statements.ts:37`, `store.ts inputOf`), then asks the identity rule whether the live card is the stored one. On Linux the kernel `card_id` derives from the product name (`card-listing.ts`, `alsa-config.ts:12-16`), so two identical cards collide on card_id (kernel suffixes are not modelled in code read here: unknown). On macOS `cardId = usb_<port>` (`capture/adapters/audio/macos-card-tie.ts:134`), so the card id itself is the port there.
4. **Retired rows**: `retired_at` was added by migration 0032 and the unique index is partial (`WHERE retired_at IS NULL`). `READ_AUDIO_INPUT_OF_CARD` and `READ_REGISTERED_AUDIO_INPUTS` (`modules/capture-inputs/audio-cards/statements.ts:31,37`) do NOT filter on `retired_at`. The only writer of `retired_at` named in the repo is operation 111 (`retireCaptureDevice`); its server module is not in `modules/` (no file found by grep for `retireCaptureDevice|retired_at` under `modules`, `capture`, `plugins`, `engine`): only the simulator action `packages/shared/src/sim/capture-registry.ts:345` and the audit type exist. Whether op 111 is built server-side: unknown (the WIP checkpoint commit 6d6553e3 says RD1/RD2 stopped mid-work; not verified here).

## 1. The stored data

### Columns of `capture_audio_inputs` (schema `db/schema/capture.ts:429-471`)
| Column | Origin | Constraint |
|---|---|---|
| `device_id` text PK | 0015 | CHECK `^MIC-[0-9]{2,}$`; FK to `capture_devices.id` |
| `usb_id` text null | 0015 | CHECK `^[0-9a-f]{4}:[0-9a-f]{4}$` or null |
| `card_id` text, `card_device` smallint, `input_number` smallint, `native_channels` | 0015 | CHECKs card, input range; input_number <= native_channels |
| `sample_rate`, `sample_bits`, `updated_by`, `updated_at` | 0015 | rate = 48000 |
| `usb_serial` text null | 0017:44 | CHECK `usb_serial IS NULL OR ~ '^[A-Za-z0-9:._-]{1,64}$'` (0017:51) |
| `usb_port` text null | 0017:45 | same CHECK form (0017:52) |
| `retired_at` bigint null | 0032:3 | mirror of `capture_devices.retired_at`; guard trigger 0033 |

### Uniqueness today
- `capture_audio_inputs_card_input_key` UNIQUE(card_id, card_device, input_number): created 0015:12 as a constraint; dropped (0032:1) and re-created as a PARTIAL unique index `WHERE retired_at IS NULL` (0032:7; `db/schema/capture.ts:~472`).
- No unique constraint or index on `usb_serial`, `usb_port` or `usb_id`. No constraint ties a card to one input across different `input_number`s of the same card (by design: one card has up to 64 inputs; two MIC rows may share a card).
- `capture_config_mic_check`: `mic_standby_id <> mic_primary_id` (`db/schema/capture.ts:306`): the only DB rule about two MIC slots.
- Guard trigger `capture_audio_inputs_retired_guard` (0033:48-55, function body 0033:~26-37): once `retired_at` is set, any UPDATE other than `last_seen_at`/`enabled` raises ZD001. The column is never cleared.

### Migrations touching the table
0015 (create), 0016 (grants: SELECT, INSERT, UPDATE of 8 columns; no DELETE, no TRUNCATE; sample_rate not updatable; `0016:33-41`), 0017 (usb_serial, usb_port + CHECKs), 0018 (`GRANT UPDATE (usb_serial, usb_port)`, 0018:40), 0032 (drop constraint, add retired_at, partial unique index), 0033 (grant UPDATE(retired_at), guard trigger). Snapshots 0015-0033 contain the table. Runtime role has NO DELETE: an input row is never removed by the app (`statements.ts` header).

### Where the columns are read or written
| What | file:line |
|---|---|
| Write on register (INSERT) | `modules/capture-inputs/audio-cards/statements.ts:49` (`INSERT_AUDIO_INPUT`), bound by `store.ts insertInput` + `cardIdentityValuesOf` |
| Write on re-register (UPDATE by device_id; sets usb_id, usb_serial, usb_port, channels, bits) | `statements.ts:57` (`REFRESH_AUDIO_INPUT`) |
| Read for op 98 listing (all rows, no retired filter) | `statements.ts:31` |
| Read for a registration (by key, joins `capture_devices.enabled`, no retired filter) | `statements.ts:37` |
| Read for runtime open/watch (by device_id) | `capture-composition.ts:212-214` (`READ_STORED_MICROPHONE`), reader `storedProductionFactsOf` `capture-composition.ts:244-268`, row type `StoredProductionMicrophone` `:223-232` |
| Row-shape guard, held again in code | `usb-audio-production.ts` `isRegisteredAudioInput` (~`:272-279`) |
| Fence snapshot facts `usbSerial`, `usbPort` | `capture/fence/sources.ts:146-148, 177, 222` |

## 2. Every caller of `identifyRegisteredCard` (definition `capture/adapters/audio/usb-audio-production.ts:331`)

Production code (grep over `apps/` and `packages/`, whole word, excluding node_modules):
| # | Caller | file:line | Role |
|---|---|---|---|
| 1 | `locateIn` of the Linux adapter (open path) | `capture/adapters/audio/usb-audio-production.ts:602` | refuses open with the match's refusal + detail |
| 2 | `identifyMacosRegisteredCard` (wrapper) | `capture/adapters/audio/usb-audio-macos.ts:399` | calls it, then maps no-match to AMBIGUOUS when the listing has an undecided device |
| 3 | `locateIn` of the macOS adapter (open path) | `capture/adapters/audio/usb-audio-macos.ts:490` | direct call on the tied listing |
| 4 | Fence wiring of the production loss watch (Linux), passed as `identify:` | `capture/fence/index.ts:869` (import `:45`) | the mic loss watch |
Indirect: the macOS watch uses wrapper #2: `capture/fence/index.ts:769` (`identifyMacosRegisteredCard`, import `:47`), which then adds `confirm`/`miss` calls.
Passed-through by name (documentation/types only): `capture/adapters/audio/mic-loss.ts:14,58,159-160` (option `identify`, the watch itself never imports it); comments `usb-audio-macos.ts:25`, `macos-card-listing.ts:6`, `usb-audio-production.ts:10,20`.

Tests that call or pin it (will change):
- `capture/adapters/audio/__tests__/usb-audio-production.test.ts` (import `:46`; calls `:654, :682, :686, :692, :694`; describe `:678`; comment `:1082`)
- `capture/adapters/audio/__tests__/macos-card-listing.test.ts` (import `:32`; describe `:816`; calls `:839, :898`)
- `capture/adapters/audio/__tests__/mic-loss.test.ts` (import `:20`; `identify:` `:140`)
- `__tests__/capture-composition.test.ts` (import `:25`; `identify:` `:578, :1212, :1230, :1316, :1343`)
- `capture/adapters/__tests__/real.test.ts:444` (mutant comment)
- `capture/adapters/__tests__/static.test.ts:523` (static fixture text names `identifyRegisteredCard` in FENCE_INDEX imports)
Also `matchStoredCard`'s own tests: `modules/capture-inputs/audio-cards/__tests__/service.test.ts`, `routes.db.test.ts`.

The Linux-only watch passes `identifyRegisteredCard` by reference, so wrapping it at the fence (`index.ts:869`) or inside `createMicLossWatch` option `identify` (`mic-loss.ts:160`) are the call-site seams.

## 3. RQ-A1 - how "the same bound card" is recognised without a port lock

**Today** (`usb-audio-production.ts:331-361`), in order:
1. Rows with `usb_id = null` (not a USB card): match by kernel `card_id` + device index only (`:333-338`).
2. `usb_id` = fixed replacement word: `CARD_UNIDENTIFIED` (`:339`).
3. No stored serial AND no stored port: `CARD_UNIDENTIFIED`/`IDENTITY_NOT_STORED` (`:342-343`).
4. Candidates = entries at the stored device index with the stored USB id (`:344`). None: `CARD_CHANGED`/`USB_ID_DIFFERS` if the card id is held by another model, else `CARD_ABSENT` (`:345`).
5. Stored serial: the one live unit stating it, on ANY port (`:347-355`). Two units share the serial: needs the stored port, else `CARD_AMBIGUOUS`/`SERIAL_SHARED` (`:353-355`). None states it: `CARD_CHANGED`/`SERIAL_DIFFERS`.
6. No stored serial: the unit at the stored port (`:357-361`); elsewhere: `CARD_CHANGED`/`PORT_DIFFERS` ("the same model elsewhere is never opened in its place"); the unit there states a serial where none was stored: `CARD_CHANGED`/`SERIAL_DIFFERS`.
The match never reads a card index (only text + device index), so a moved card index is tolerated.
Registration side: `matchStoredCard` (`service.ts:423-444`) the same outcomes under other names (`StoredCardMatch`), plus `NOT_TELLABLE`.
A serial-less USB card with no port either is refused at registration (`unidentifiable`, `service.ts:446,479`, `notIdentifiable` `:203`).

**Source of each identity value** (Linux): `usb_id` from `/proc/asound/cardN/usbid`; port is the text after ` at usb-` in the first stream file (`card-listing.ts:349-358, 382-396`, topological place, "not the bus and device number"); serial from `<devicesRoot>/cardN/device/../serial` (`card-listing-reader.ts:104`). macOS: port = location id hex, serial from the USB tree (`macos-usb-tree-reader.ts:113-114`); `cardId = usb_<port>` (`macos-card-tie.ts:134`).

**Options the code structure allows (no choice made):**
- (a) kernel card id/name: already in the row (`card_id`) and already a filter in the Linux match (`named`, `:332`) but only used for non-USB rows and for the CHANGED-vs-ABSENT decision. On macOS card id equals the port, so (a) there is the port lock itself.
- (b) bus path recorded at bind and refreshed on re-plug: the column `usb_port` plus the writer `REFRESH_AUDIO_INPUT` (`statements.ts:57`, sets usb_port) and its grant (0018) exist; refresh occurs only inside a registration (op 99), not on a loss-watch pass or an open. A refresh-on-match site would be a new write from the runtime path (the stored-row reader at `capture-composition.ts:244` is read-only); whether the runtime role may update (yes, 0018 grants UPDATE of usb_port) is a fact, whether the fence/adapters may write is a static-rule question (the static rules limit writers: `CAPTURE_AUDIO_CARD_WRITES`, `statements.ts:61`).
- (c) live-session handle until unplug: no such state exists today in the adapter; `identifyRegisteredCard` is a pure function of (listing, stored row). A handle would need new in-memory state in the watch (`mic-loss.ts`) and adapters, and gives nothing after Core restart.
- (d) USB id + serial where a serial exists, else "any unit of the model": serial branch exists (`:347`). "Any unit of the model" is the step `same` (`:344`) with the port comparison at `:357` removed; the code already computes `same` (all units of the model at the device index). Two identical serial-less units then both match (RQ-A2).
**Unknowns:** whether the HANMUS mic states a serial on the bench host (03_deployment_check D2 says no; host access not available in this wave); Linux kernel card-id suffix behaviour for two identical cards (no code in read files models it).

## 4. RQ-A2 - two identical serial-less cards without the port as a key

**Today:** the port is the only separator; "two units of one model that state no serial, exchanged on the SAME socket, are one identity" is a stated blind spot (`usb-audio-production.ts` doc above `:331`; `service.ts` doc above `:423`). `onPort.length > 1` gives `CARD_AMBIGUOUS` (`:360`), `SERIAL_SHARED` covers two equal serials (`:353-355`).
- At registration, a listing with two identical serial-less cards is listed with two rows; `registered` is filtered per card with `matchStoredCard`, so the registered input shows on whichever card matches the stored port (`service.ts:309-311`).
- Both units share `usb_id`, product name; on Linux the kernel card id differs only by the kernel's own scheme (unknown, see 0.3); the card index (0..31) differs but is never stored or compared.

**Options the structure permits:** (i) refuse the second identical serial-less card as non-bindable (a registration-time check next to `unidentifiable`, `service.ts:446`); (ii) keep the port as an informational tiebreak only when `same.length > 1` (the branch `onPort` at `:354` is already written that way for the serial-shared case); (iii) treat `CARD_AMBIGUOUS` (already a refusal word) as the answer whenever `same.length > 1` and no serial: this is the path `mic-loss.ts:295` already treats as "undecided" (no MIC_DISCONNECTED fault raised, `report(CARD_UNDECIDED...)`), so the watch has a defined behaviour; (iv) bind by kernel card id for the pair (Linux only, unstable across reboots).
**Unknowns:** how a second serial-less unit appears in the listing at the kernel level (host test needed); whether the product allows two on the bench (R-FLEX D5: second mic out of scope).

## 5. RQ-A3 - where exclusivity is enforced; what the listing returns for a bound card

**Today, "one bound input per card input":** DB partial UNIQUE (card_id, card_device, input_number) WHERE retired_at IS NULL (0032:7). Service: `inputOf(key)` then the identity rule decides REENABLED vs CARD_CHANGED (`service.ts:497-512`); no explicit lock besides the registration unit (`host.unit`, `:485`) and the session-open lock (`unit.sessionOpen()` -> `409 CAPTURE_CONFIG_LOCKED`, `:486, :17`). The unit is the engine's unit of work; a concurrent-registration serialisation beyond the DB constraint is not visible in the file (a listing gate `createListingGate` `:237` allows one listing at a time per Core, `409 AUDIO_CARD_SEARCH_IN_PROGRESS`).
**There is no rule today that stops a physical card being bound to two DEMS inputs by identity**: a second input row of the same card with a DIFFERENT `input_number` is allowed (and intended); a second row for the SAME card_id/device/input is refused by the unique index; the same physical card under another kernel `card_id` (renamed, see `renamed` flag `usb-audio-production.ts:~325,350`) can get a second row, because the key is the kernel name and the identity is not a key. D10's "bound card is exclusive" has no equivalent in code.
**MIC slot assignment** (`capture_config.mic_primary_id/mic_standby_id`): op 78/80 in `modules/capture-config/routes.ts` (`edit`, `:430-470`); `assertStorable` (`:293-297`, line `deviceId == inputId`), `assertAssignable` (`:309-327`, registry RG-3), the simulator action `setCaptureConfig` `packages/shared/src/sim/capture-config.ts:182-211` (refuses two lines for one role; `MIC_ON_BOTH_INPUTS` when a single line names the other role's input, `:198`). DB: `capture_config_mic_check` (primary <> standby). The code refuses duplicates at three levels (sim action, DB CHECK) but only for the SLOT, not for the CARD: two different MIC ids on the same physical card pass both.
**Listing for a bound card:** op 98 returns every live card with `registered: [{inputNumber, deviceId}]` per card (`cardAnswer`, `service.ts:298-313`) filtered by key and identity. A bound card is SHOWN with its registered inputs; nothing marks it "not selectable". Cards with no registered inputs show `registered: []`. Contract: `packages/shared/src/api/capture-audio-cards.ts`.

**Options the structure permits:** DB-level: a partial unique index on (usb_id, usb_serial) WHERE retired_at IS NULL AND serial NOT NULL would cover the serial case only (serial-less cards have no DB-visible identity except usb_port); or on `usb_port` (the discarded lock). Service-level: a check inside `host.unit` of `registerAudioInput` (a new query next to `inputOf`, `store.ts`) using the identity rule over ALL non-retired rows; needs a lock for two concurrent registrations (the engine unit's isolation level is not read here: unknown). Both together are possible. Listing: `cardAnswer` is the one place to hide or flag a card (it already has `registered`).
**Unknowns:** isolation level and lock behaviour of `host.unit`; whether op 98 consumers (`packages/shared/src/api/capture-audio-cards.ts`, core-web, mobile) tolerate a new field; MIC rows for different inputs of one card (multi-input card): D10's wording "bound to ONE DEMS input" vs the multi-input case is a ruling gap.

## 6. RQ-A4 - "re-bind to another line releases the old binding": effect on the old input row, the 4-slot selector, audits

**Row operations available today:** the runtime role has SELECT, INSERT, UPDATE (8+2+1 columns: `usb_id, card_id, card_device, input_number?`...). Exact: 0016 grants UPDATE on every column but key and rate (`0016:35-41`), + `usb_serial, usb_port` (0018), + `retired_at` (0033). **No DELETE, no TRUNCATE** (`0016:41`). Therefore "delete" is not available to the app; "retire" (set `retired_at`, one-way, trigger-guarded; frees the partial unique index) and "update the key columns" (card_id/card_device/input_number are updatable per the 0016 grant text: not verified column by column here) are the code-possible release forms. There is no "unassign" column on this table: unassign = clearing the slot in `capture_config` (`mic_*_id` nullable since schema v7, `db/schema/capture.ts:246-251`) or the sim `unassign` member of op 78 (`sim/capture-config.ts:29, 269-300`).
**Existing writers of `retired_at`:** only op 111 (not found server-side, see 0.4); it needs an operator-driven retire with `CAPTURE_DEVICE_RETIRED` audit; a retired input is never assignable again (`packages/shared/src/sim/capture-registry.ts:323-326` `isCaptureDeviceRetired`, "never assignable again"); a retired MIC id is never reused: re-registering the card mints a NEW `MIC-nn` (`db/schema/capture.ts:~449-454` comment).
**Slot effect:** a MIC in a slot cannot be changed while a session is open (`isSessionActive` -> `CAPTURE_CONFIG_LOCKED`, `routes.ts:450`). The FK `capture_config_mic_*_id_fkey` is ON DELETE RESTRICT to `capture_devices`; retiring does not clear a slot (no code read does it: unknown whether RD3 does).
**Audit entries today:** register/re-enable/card-changed: one `CAPTURE_AUDIO_INPUT_CHANGED` per call (`service.ts:513-520`; change codes `REGISTERED|CARD_CHANGED|REENABLED`, `core/audit-details.ts:207`; key list `:673-680`: deviceId, change, inputNumber, channelCount, operationId, permission; no serial/port/usb id by rule). Slot changes: `CAPTURE_CONFIG_CHANGED` per slot (`routes.ts:9-11, 95`). Retire: `CAPTURE_DEVICE_RETIRED` (`audit-details.ts:968-978`). Listing: `CAPTURE_DISCOVERY_SEARCHED` scope `AUDIO_CARDS` (`audit-details.ts:~201`). **There is no "unassign" or "released" audit change code** for the audio input table: a release needs a new value of `CAPTURE_AUDIO_INPUT_CHANGES` or reuse of CAPTURE_DEVICE_RETIRED/CAPTURE_CONFIG_CHANGED. The closed list is an enum used by a static/contract test (`test/db` contract files and `audit-details` tests: not read in full).
**Options:** (1) retire the old MIC (existing guard, one-way; re-bind then mints a new id); (2) update the old row's identity columns to the new card (not possible when retired; possible otherwise; breaks "row never changed" assumption of the history); (3) clear the old slot only and keep the row inert; (4) delete: not allowed for the app role. Each needs an audit entry word (new or reused).
**Unknowns:** op 111 server implementation; whether the selector/4-slot UI (RQ-A5, row 83) uses retired filtering; what a running session record keeps of a retired mic (sessions are out of scope here).

## 7. RQ-A6 - rows already stored with `usb_port`

**Today:** `usb_port` is written at registration and refreshed at each re-registration (`REFRESH_AUDIO_INPUT`, `statements.ts:57`); it is read by the runtime match (`capture-composition.ts:213`) and the registration match. Rows created before 0017 have both `usb_serial` and `usb_port` NULL and are refused: `IDENTITY_NOT_STORED`, said as CARD_CHANGED until re-registered (`usb-audio-production.ts:342-343`, `service.ts` header ~`:50`). Both columns are nullable with CHECK form only; no NOT NULL, no index.
**Options the code makes possible:** keep the column as an informational/refresh field (it is already written by the refresh path; the CHECK stays); stop comparing it (change at both rules, `:357-361` and `service.ts:439-444`); drop it: needs a migration (next number after 0033; the migrations folder is `db/migrations`, snapshots in `db/migrations/meta`), plus removal from `READ_STORED_MICROPHONE` (`capture-composition.ts:213`), `StoredProductionMicrophone`, `RegisteredAudioInput.usbPort` (`usb-audio-production.ts:~255-261`), fence facts (`capture/fence/sources.ts:146-148,177,222`), both statements, contract inventory (`test/db/contract-inventory.json:5072, 5136`, `contract-v7-delta.ts`) and the 14 test files listed in section 8. A data migration for existing rows: none needed for "keep"; for "drop" none either (the column holds nothing that other data depends on); a row with serial NULL and port set would, under any rule that ignores the port, become "any unit of the model".
**Unknowns:** whether the bench host DB holds rows (the controller's DB snapshot is outside this wave); whether any consumer outside core-server reads `usbPort` from op 98: `packages/shared/src/api/capture-audio-cards.ts` exposes `usbSerial`/`usbPort` in the card answer (`service.ts:303-304`), console use not read (row 83).

## 8. Tests and static rules that pin these behaviours (they will change)

Behavioural (identity rule, refusals, columns):
- `capture/adapters/audio/__tests__/usb-audio-production.test.ts` (match + PORT_DIFFERS)
- `capture/adapters/audio/__tests__/macos-card-listing.test.ts` (section `:816`)
- `capture/adapters/audio/__tests__/usb-audio-macos.test.ts`, `mic-loss.test.ts`, `card-listing.test.ts`, `card-listing-reader.test.ts`, `alsa-config.test.ts`
- `capture/adapters/__tests__/real.test.ts`, `capture/adapters/__tests__/static.test.ts:523`
- `capture/adapters/local/__tests__/mic-helper-args.test.ts`
- `capture/fence/__tests__/fence.test.ts`
- `__tests__/capture-composition.test.ts`, `__tests__/capture-composition.db.test.ts`
- `modules/capture-inputs/audio-cards/__tests__/service.test.ts`, `routes.db.test.ts`, `fixtures.ts`
- `modules/capture-config/__tests__/e2e/first-full-session.db.test.ts`
- `core/__tests__/writers.test.ts`
DB contract / schema pins (apps/core-server/test/db): `constraints.db.test.ts`, `privileges.db.test.ts`, `set8.db.test.ts`, `set9.db.test.ts`, `set16.db.test.ts`, `catalog.db.test.ts`, `contract-inventory.test.ts` + `contract-inventory.json` (lines 5066-5136), `contract-v7-delta.ts`, `contract-v8-delta.ts`, `contract-v15-delta.ts`, `fixtures.ts`; `test/support/seed.ts`.
Reset/fixtures: `db/reset/__tests__/` (`m2-guard-keepset`, `kept-tables`, `reset`, `cli`), `db/fixtures/__tests__/` (`bulk-fixture`, `support`, `build`), `db/fixtures/minimums.ts`.
Shared: `/Users/gsp-budi/Documents/DEMS/packages/shared/test/api-capture-commissioning.test.ts`, `api-capture-discovery.test.ts`; OpenAPI `packages/shared/openapi/openapi.json`.
(`grep -l` over names, not every test asserts the port rule; relevant ones are those naming `PORT_DIFFERS|matchStoredCard|IDENTITY_NOT_STORED|capture_audio_inputs_card_input_key`: macos-card-listing, usb-audio-production, audio-cards routes.db/service tests, test/db contract-inventory, contract-v7-delta, contract-v15-delta, set8, set16.)

## 9. Loss watching (RQ-A1 side effect)
`createMicLossWatch` (`capture/adapters/audio/mic-loss.ts`) takes `identify` and `isRow` options (`:159-161`). Absent card -> `CARD_ABSENT`, changed -> `CARD_CHANGED` both raise the `CAPTURE_FAULT` `MIC_DISCONNECTED` for the registry id (`:227, :291-294`); any other refusal (including `CARD_AMBIGUOUS`, `CARD_UNIDENTIFIED`) is reported as undecided and raises no fault (`:295`). So under a flexible rule: a card found renamed keeps `ok: true` (`renamed` flag); a card now "changed" (today PORT_DIFFERS) is a MIC_DISCONNECTED fault today. On macOS the watch also calls `confirm`/`miss` by result (`capture/fence/index.ts:769-773`).

## Gaps / needs investigation
- Kernel card-id behaviour for two identical cards, HANMUS serial presence: needs the host (not this wave).
- Server implementation of operation 111 (retire) and whether it clears slots: not found in `modules/`.
- Isolation level of `host.unit` for concurrent registrations (engine, not read).
- Exact grant column list of 0016 (read only the header lines 29-41).
- No graft graph queried; direct grep/read.

*Generated: 2026-10-22*
