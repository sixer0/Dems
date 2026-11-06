---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 88
type: spec (R-FLEX audio functional delta)
narrative_tier: 1
confidence: HIGH for "today" facts (re-read in the repo this session); MEDIUM for decisions that depend on row 96 answers (marked)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 88 :256; RQ-A1..A6 :95-100; AC9 :61)
names_from: masterplan/01_specs_rflex_register.md (row 87) ONLY
inputs: research/01_explore_rflex_audio_identity.md (row 82), research/01_explore_rflex_audio_ui.md (row 83), delegation_progress_report.md (last two rows), decisions/decisions.md D10-D12, 03_deployment_check_20261022.md D2/D3
last_updated: 2026-10-22
---

# R-FLEX audio functional delta (row 88)

## 0. Summary

D10 ruling 1 has three parts. This file turns each into code behaviour:

1. **No port lock.** The identity rule changes in both matchers, the runtime `identifyRegisteredCard` and the registration/listing `matchStoredCard`. The new rule is "USB id plus serial where one exists, else any unit of the model" (RQ-A1 option d). The removal of `PORT_DIFFERS` (RM-A1, RM-A2) was already FIRM in the register.
2. **A bound card is exclusive.** Operation 98 (op 98) marks a bound card with `boundTo` and does not offer it for a new binding. Operation 99 (op 99) refuses a new binding with `AUDIO_CARD_ALREADY_BOUND`. The check runs in the service and is serialised (RQ-A3).
3. **A re-bind releases the old binding.** A port move is not a re-bind: the binding is kept. Two re-bind paths exist, and which one the user means is Q-R5 (row 96). One is moving a microphone between selector lines, which clears the old line. The other is moving a card's binding to another input through op 99 with `release`, which moves the holding microphone (RQ-A4).

The analysis turned up one finding that changes the question. **The bench microphone has only one input** (BOMGE, 3347:2430, no serial; 03_deployment_check D2). With one input, op 99 has no "other input" to re-bind it to. So the HIL test in row 126 ("re-binds the mic to another line") can only run on the bench if "line" means a selector line (PRIMARY/STANDBY). See §6 and Q-R5.

### 0.1 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | Required behaviour for: USB audio identity without a port lock, card exclusivity, release on re-bind, the case of two identical cards with no serial, audit entries, the loss watch, the selector, and the console listing |
| Who | Owners of the code rows: 107 (adapter identity + loss watch), 108 (audio-cards exclusivity/release), 109 (wiring/audit registry), 111 (console panel + selector). Spec peers: 91 (DB), 92 (API/UI words), 94 (impact). The user decides via row 96. Bench HIL: rows 125-127 |
| When | Spec stage S2 (after register row 87), 2026-10-22. Code lands before the install (D10 ruling 3) |
| Where | `apps/core-server/src/capture/adapters/audio/`, `apps/core-server/src/modules/capture-inputs/audio-cards/`, `apps/core-server/src/modules/capture-config/` (read only, no change unless Q-R5 ≠ B), `apps/core-web/src/features/devices/`, `packages/shared/src/api/capture-audio-cards.ts` |
| Why | D10(1) verbatim: "bebas sepenuhnya, tapi jika device sudah pairing ke 1 input dalam system dems, jangan open lagi ke pairing baru. jika terjadi di pairtr ulang dengan line tertentu maka line yang lama harus di lepas". AC9 (02_structured.md:61): "a bound card is not offered for a new binding, a re-bind releases the old one, a port move keeps the binding" |
| How | Today's code was re-read this session (evidence §1). Each RQ is decided only where the code and the rulings leave one consistent choice; every other choice goes to row 96 with options and a recommendation (§9) |
| Alternatives | Recorded per decision (§3-§6) |
| Assumptions | A1: the bench DB is created fresh by the bare-metal install (row 44), so no older `capture_audio_inputs` rows exist there. Older data elsewhere is row 91's. A2: there is one Core process per host, so the in-process listing gate is a valid lock. A3: AC9 as worded in 02_structured.md:61 is the approved target (D12 U-RF4) |
| Gaps | §11 |

## 1. Facts this spec builds on (verified this session)

| # | Fact | Evidence |
|---|---|---|
| E1 | Runtime matcher. With no stored serial, it takes the unit at the stored port; a unit of the same model elsewhere gives `CARD_CHANGED`/`PORT_DIFFERS`; two units on that port give `CARD_AMBIGUOUS`. It never reads the card index. A card found under another kernel card id gives `renamed: true` | `apps/core-server/src/capture/adapters/audio/usb-audio-production.ts:331-361` (port branch `:357-361`, `renamed` `:345`) |
| E2 | Registration matcher, same rule. `PORT_DIFFERS` covers both "ports differ" and "live card states no port" | `apps/core-server/src/modules/capture-inputs/audio-cards/service.ts:423-439` (`:439`) |
| E3 | Op 99 finds the existing row **by key** `(cardId, deviceIndex, inputNumber)`, then applies the identity rule. SAME_CARD gives REENABLED; anything else gives CARD_CHANGED, which refreshes the identity and does not re-enable | `service.ts:483-511` |
| E4 | Op 98 `registered[]` is filtered **by key first** (`input.cardId === card.cardId`), then by identity | `service.ts:309-311` |
| E5 | macOS: `cardId = usb_<port>`, so the key itself changes when the card moves | `apps/core-server/src/capture/adapters/audio/macos-card-tie.ts:134` |
| E6 | The open path uses the LIVE card found by the match | `usb-audio-production.ts:742` (`opened.card.cardId`) |
| E7 | Loss watch: `CARD_ABSENT`/`CARD_CHANGED` mean a cause (fault `MIC_DISCONNECTED`). Any other refusal (incl. `CARD_AMBIGUOUS`) is reported as `CARD_UNDECIDED` with no fault. Return after a fault: fault cleared, state `RETURNED` | `apps/core-server/src/capture/adapters/audio/mic-loss.ts` `presenceOf` (~:288-296), clear/RETURNED (~:276-286) |
| E8 | macOS wrapper maps no-match to `CARD_AMBIGUOUS` when the listing holds an undecided device | `usb-audio-macos.ts:398-402` |
| E9 | Grants for `dems_app` on `capture_audio_inputs`: UPDATE of `usb_id, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at` (0016), `usb_serial, usb_port` (0018), `retired_at` (0033). No DELETE | `db/migrations/0016_capture_streams_audio_inputs_privileges.sql:33-35`; `0018_network_commissioning_privileges.sql:40`; `0033_capture_device_retirement_privileges.sql:16,18` |
| E10 | The engine does not model retirement yet; a `retired_at` write "comes with row RD3" | `apps/core-server/src/db/mapping/rows.ts:891-895` |
| E11 | Units of work run at READ COMMITTED | `apps/core-server/src/core/unit-of-work.ts:8,56` |
| E12 | The listing gate wraps only the listing call of op 98/99, not the op 99 unit | `service.ts:270-280` (`seams.gate.run(purpose, ...)`) |
| E13 | `REFRESH_AUDIO_INPUT` does not touch the key columns; the module's write list holds two statements | `apps/core-server/src/modules/capture-inputs/audio-cards/statements.ts:56-61` |
| E14 | Registration refuses a USB card that states neither serial nor port (`unidentifiable`) | `service.ts:446-447`, `:479` |
| E15 | Selector: 4 slots `VIDEO_01, VIDEO_02, PRIMARY, STANDBY`. The web disables the other line's mic option ("already on the primary/standby line") and sends nothing when one mic would sit on both lines | `packages/shared/src/api/devices.ts:152`; `apps/core-web/src/features/devices/capture-selector-panel.tsx:458`; `capture-selector.ts:230-237` |
| E16 | Op 78 judges cameras "as the edit would leave it (`unassign` first ...), so ... a move after a clear [is] not refused". For mics the same order is **not shown** in the lines read | `apps/core-server/src/modules/capture-config/routes.ts:76-84`, `:345` |
| E17 | Bench mic: HANMUS "BOMGE USB AUDIO" 3347:2430, card 1, port 1-1, no serial. ALSA card numbers shift with USB devices | `03_deployment_check_20261022.md` D2, D3 |

## 2. Requirements

Functional (each traced to D10(1) or AC9):

- **FR-1** (D10 "bebas sepenuhnya"; AC9 "a port move keeps the binding"): a bound USB card is recognised on any USB port, on Linux and macOS, at open, in the loss watch and in op 98/99.
- **FR-2** (D10 "jangan open lagi ke pairing baru"; AC9 "not offered"): a card that a microphone holds is shown as bound (`boundTo`) and is not offered for a new binding. Op 99 refuses a new binding of it (`AUDIO_CARD_ALREADY_BOUND`).
- **FR-3** (D10 "line yang lama harus di lepas"; AC9 "a re-bind releases the old one"): a re-bind leaves exactly one binding. The old one is released and audited.
- **FR-4** (RQ-A2): two identical cards with no serial never cause a recording from the wrong unit without notice.
- **FR-5**: every state change is audited with the existing types. Audit details carry no serial, port or USB id (existing rule, `core/audit-details.ts` key list per row 82 §6).

Non-functional:

- **NFR-1**: the exclusivity check is race-free under READ COMMITTED (E11).
- **NFR-2**: no new operation, no new environment name, no new audit type (register §2, §5, §8).
- **NFR-3**: existing tests are extended, not duplicated (`feedback-test-suite-consolidation`; 02_structured.md:45).

## 3. RQ-A1: recognising "the same bound card" without a port lock — DECIDED

**Decision: option (d).** USB id plus serial where the card states one; otherwise any unit of the model. Same rule in both matchers.

| Option | Verdict | Reason (evidence) |
|---|---|---|
| (a) kernel card id/name | Rejected | On macOS the card id IS the port (E5), so it would keep the lock. On Linux the id comes from the product name and does not separate units (row 82 §0.3) |
| (b) bus path recorded at bind, refreshed on re-plug | Rejected | It is the port lock with a refresh. The refresh would need a write from the runtime path, which today is read-only (E13, static list `CAPTURE_AUDIO_CARD_WRITES`) |
| (c) live-session handle until unplug | Rejected | It does not exist (row 82 §3c) and is lost on a Core restart |
| **(d)** | **Chosen** | It is the existing `same` set (`usb-audio-production.ts:344`) with the port comparison removed. It keeps the serial branch unchanged. It is the only option with no port semantics |

**Rule after the change.** Rows marked "changed" differ from today; all others are unchanged.

| Stored row | Live listing (units of the stored USB id at the stored device index) | Runtime `identifyRegisteredCard` | Registration `matchStoredCard` |
|---|---|---|---|
| `usb_id` null (not USB) | unchanged | unchanged | unchanged |
| `usb_id` = replacement word | - | `CARD_UNIDENTIFIED` (unchanged) | n/a |
| no serial, no port | - | provisional - row 96 Q-R3 (RM-A3): recommended treat as "no serial" (next row) | same (RM-A4) |
| serial stored | exactly one unit states it, any port | match (unchanged) | `SAME_CARD` (unchanged) |
| serial stored | two units state it | stored port as tie-break, else `CARD_AMBIGUOUS`/`SERIAL_SHARED` (unchanged; a tie-break only, not a lock: a lone moved card still matches) | stored port as tie-break, else `NOT_TELLABLE` (unchanged) |
| serial stored | none states it | `CARD_CHANGED`/`SERIAL_DIFFERS` (unchanged) | `SERIAL_DIFFERS` (unchanged) |
| **no serial stored** (changed) | exactly one unit that states no serial, **on any port** | **match**; `renamed` = live card id ≠ stored card id | **`SAME_CARD`** |
| no serial stored (changed) | 0 serial-less units, ≥1 unit stating a serial | `CARD_CHANGED`/`SERIAL_DIFFERS` | `SERIAL_DIFFERS` |
| no serial stored (changed) | ≥2 serial-less units | provisional - row 96 Q-R2: recommended `CARD_AMBIGUOUS`/`MODEL_SHARED` (AU-R2) | recommended `NOT_TELLABLE` (AU-R3) |
| any USB row | no unit of the USB id | `CARD_CHANGED`/`USB_ID_DIFFERS` if the card id is held by another model, else `CARD_ABSENT` (unchanged) | `USB_ID_DIFFERS` (unchanged) |

Consequences, all decided:

- **D-A1.1** `PORT_DIFFERS` is gone from both enums and both doc comments: `usb-audio-production.ts:287,323-326,358`, `service.ts:380,417,439` (register RM-A1, RM-A2).
- **D-A1.2** `usb_port` stays written and is refreshed at op 99 as an **informational** field. No matcher compares it, except as the tie-break in `SERIAL_SHARED`/`NOT_TELLABLE`. Keeping or dropping the column is Q-R3 (register DB-A3, AU-L2).
- **D-A1.3** There is no runtime write. The adapters and the loss watch stay pure readers. The stored `usb_port` and, on macOS, the stored `card_id` refresh only at the next op 99 for that input (D-A4.1).
- **D-A1.4** The registration refusal predicate `unidentifiable` (RM-A5) changes to "the USB id is the replacement word". The reason code `AUDIO_INPUT_NOT_REGISTRABLE` stays, and its text is re-checked by row 92 (W-A6). Reason: under (d) a serial-less card is identified by its model, so a missing port no longer makes it unidentifiable. A card whose USB id cannot be read still matches nothing at runtime (`CARD_UNIDENTIFIED`), so storing it would create a dead microphone.
- **D-A1.5** The two matchers stay two functions (no import across layers, `usb-audio-production.ts:~300` comment). One shared table-driven test case list pins both to the same outcomes (§10, T-1).

## 4. RQ-A2: two identical serial-less cards — PUT TO THE USER (row 96, Q-R2)

Today the port is the only thing that tells them apart (E1, E2). Under (d) both units look like "the bound card".

| Option | Runtime effect | Registration effect | Risk |
|---|---|---|---|
| (i) second unit not bindable | (needs ii or iii for runtime) | The second unit matches MIC-a's identity, so it is shown `boundTo` MIC-a and refused `AUDIO_CARD_ALREADY_BOUND`. **Under (d) and FR-2 this follows on its own**; no extra code | none new |
| (ii) port as tie-break only when ≥2 serial-less units are present | the unit on the stored port is opened | the stored port separates them in the listing | Two units swapped between the same two sockets record the wrong unit without notice (today's stated blind spot, `service.ts` doc above `:423`). Brings back a partial port meaning |
| (iii) `CARD_AMBIGUOUS`/`MODEL_SHARED`, no fault | open refused (`AUDIO_CARD_AMBIGUOUS`, surfaces as `DEVICE_NOT_FOUND`, `usb-audio-production.ts:159-160`); loss watch: `CARD_UNDECIDED`, no `MIC_DISCONNECTED` (E7) | `NOT_TELLABLE`; both units shown `boundTo` MIC-a (conservative) | Plugging a second identical mic stops recording on the first until one is removed |

**Recommendation: (i) + (iii).** No silent wrong-unit recording, and both paths already have a defined behaviour in the code (E7). On the bench the case cannot occur, because only one mic is in scope (U-RF5, D12). The cost of (iii) applies only to a setup the bench does not have.

Hypothesis, not verified: on Linux the kernel gives the second identical card a suffixed card id (e.g. `_1`). No code read models this (row 82 §0.3). Row 107 needs a host check before relying on it. The decided rule does not depend on it.

## 5. RQ-A3: where exclusivity is enforced; what the listing shows — DECIDED (unit of exclusivity: Q-R1)

**D-A3.1 Service check, mandatory.** Inside the op 99 unit, before insert or refresh, the service reads every non-retired row of the live card's USB id (register DB-A2 `READ_BOUND_AUDIO_INPUTS`) and applies `matchStoredCard` to each. A matching row other than the one being registered or re-enabled is a holder. One holder and no `release` gives `409 INVALID_STATE`, `details.reason = AUDIO_CARD_ALREADY_BOUND`, `details.deviceId` = holder (AU-R1). The unit rolls back with no audit row (same as every refusal raised in the unit today, E3).
- Unit of exclusivity, per register Q-R1. (a) physical card: any holder of the card counts. (b) card input: only a holder of the same `input_number` counts. Recommendation (a), §9.

**D-A3.2 Serialisation.** Units run at READ COMMITTED (E11), so a read-then-insert check alone can race between two op 99 calls. **Decision:** run the op 99 unit inside the existing listing gate (`seams.gate.run`, E12) and not only its listing. Concurrent op 98/99 calls then answer the existing `409 AUDIO_CARD_SEARCH_IN_PROGRESS`. Reasons:
- no new name;
- one Core per host (A2);
- op 99 is an operator action at human pace.

Rejected alternatives:
- an advisory transaction lock: no such pattern exists in the request path; it is used only in `db/reset/routine.ts:121`;
- relying on DB-A1 alone: it cannot cover serial-less cards (register DB-A1).

**D-A3.3 DB index DB-A1 (`capture_audio_inputs_usb_identity_key`)** is defence in depth for serial-stating cards only. Row 91 decides whether to add it; its columns follow Q-R1. This spec does not require it.

**D-A3.4 Existing reads must skip retired rows.** `READ_REGISTERED_AUDIO_INPUTS` and `READ_AUDIO_INPUT_OF_CARD` do not filter `retired_at` (`statements.ts:31,37`). Rows 91/108 add `retired_at IS NULL` to every read used by op 98/99 and by DB-A2. Otherwise a retired row and a live row under one key make `inputOf` ambiguous, since the partial index allows both (0032:7).

**D-A3.5 Listing (op 98).** Each card answers `boundTo` (AU-L1): the `MIC-nn` that holds it by identity, or `null`. `registered[]` is computed **by identity over all non-retired rows**, no longer key-first (E4). Without this change, a macOS card moved to another port (new `cardId`, E5) would be listed as unbound, which breaks FR-1 and FR-2.
- Card shown, never hidden. A user who cannot see their mic in the list would read that as "not detected", so a bound card stays visible and is marked bound.
- Console (row 111, words row 92):
  - the card shows "Bound to {{device}}" (W-A1);
  - every input radio of a card with `boundTo !== null` is disabled for a new binding, except the input the holder already uses (a re-register gives REENABLED);
  - under Q-R1 (a) with a multi-input card, the other inputs offer the release action (W-A2) instead of plain register.

## 6. RQ-A4: what a re-bind does — DECIDED where the code allows; meaning of "line" is Q-R5

### 6.1 A port move is NOT a re-bind (decided, AC9)

- **D-A4.1 Linux.** The kernel card id does not depend on the port (hypothesis for the BOMGE; to be confirmed in row 127 by the listing's `cardId` before and after). So the key is unchanged, the identity is `SAME_CARD`, and op 99 answers `REENABLED` for the same `MIC-nn` with `usb_port` refreshed. Today it answers `CARD_CHANGED` (`PORT_DIFFERS`).
- **D-A4.2 macOS (and a Linux `renamed` card).** The key's `card_id` differs (E5), so `inputOf(key)` finds no row. The exclusivity check (D-A3.1) finds the holder MIC-a, which has the same physical card and the **same input number**. That is the same binding, not a new one. Op 99 then:
  - refreshes MIC-a's key `card_id`/`card_device` (granted, E9) together with the identity;
  - answers `REENABLED` for MIC-a, with no `release` needed and no new MIC.

  If another non-retired row already holds the new key, the unit rolls back with `AUDIO_INPUT_NOT_REGISTRABLE` (existing reason; partial unique index `capture_audio_inputs_card_input_key`, DB-A4). This is the stale-key collision; see risk R-3.
- **D-A4.3 Runtime needs no op 99 at all.** Open and the loss watch already find the card through D-A1 (`renamed` tolerated, live card opened, E6). So a moved mic records without operator action. Op 99 only tidies the stored key/port.

### 6.2 Re-bind through op 99 (reading A of Q-R5): applies only to another input of a held card

With D-A4.2, op 99 never mints a second MIC for the same physical card and input. A re-bind through op 99 can therefore only be **a request for input j of a card that MIC-a holds at input i** (multi-input card, Q-R1 (a)). The BOMGE has one input, so this path **cannot occur on the bench**.

Release forms the code allows:

| Form | Verdict | Reason |
|---|---|---|
| Retire MIC-a (`retired_at`) and mint MIC-b | Rejected now | The engine does not model retirement (E10); a direct write would leave the replicated slice out of step. Op 111 is unrouted (register F6) and refuses an assigned device. Usable only after RD3 |
| Disable MIC-a and mint MIC-b | Rejected | There is no disable writer in the module (the registrar only sets `enabled = true`, `registrar.ts:35-36`). The CARD_CHANGED path already leaves mics disabled, so disabled cannot mean released, and a plain re-register (REENABLED) would bring back a double binding |
| Delete | Not possible | No DELETE grant (E9) |
| **Move MIC-a to input j** | **Chosen** | Uses only granted columns (E9). Exactly one row holds the card. The selector slot keeps MIC-a, so the line in use carries on from the new input. No engine change |

- **D-A4.4** Op 99 with `release: true` (AU-B1) for input j of a card held by MIC-a at input i:
  - one unit: MIC-a's row is re-keyed to `input_number = j` (and the current `card_id`/`card_device`) and its identity refreshed;
  - answer: `deviceId = MIC-a`, `change = REENABLED`, `releasedDeviceId = MIC-a` (AU-B2: "the microphone whose old binding was released");
  - audit: two `CAPTURE_AUDIO_INPUT_CHANGED` entries for MIC-a, first `change = RELEASED` (AU-A1) with `inputNumber = i`, then `change = REENABLED` with `inputNumber = j`;
  - refused like every op 99 while a session is open (`CAPTURE_CONFIG_LOCKED`);
  - if input j already has its own row, the unit rolls back with `AUDIO_INPUT_NOT_REGISTRABLE`.
- **D-A4.5** Without `release`, the same request gives `AUDIO_CARD_ALREADY_BOUND` (D-A3.1).
- AU-X1 (`REBOUND`) and DB-A5 (`retired_at`) are **not used** by this spec (register: provisional - row 88; now decided "not used"). AU-A2 is used only by §6.3.

The literal (A) reading, where a new `MIC-nn` takes the card and the old one is released, needs a lasting "released" mark. Today that means either engine retirement (RD3) or a new column. The register has no name for a new column, so this reading is offered to the user in Q-R5 with that cost.

### 6.3 Re-bind on the selector (reading B of Q-R5): move a mic between PRIMARY and STANDBY

- **D-A4.6** Choosing MIC-a on the other line, while MIC-a sits on line X, moves it: line X becomes "Not assigned" and the chosen line holds MIC-a, in one op 78 edit (`unassign: [X]` plus the new line). Today the option is disabled (E15).
  - Web change, row 111: the option is no longer disabled; its label uses the existing key `devices.micLines.onOtherLine` with text changed by row 92 to say the mic moves.
  - Server: no change, **provided** op 78 judges mic lines `unassign` first, as it does for cameras (E16). This is not shown for mics in the lines read. Row 108 checks it with a test. If op 78 refuses, the server rule for mics follows the camera rule (`routes.ts:76-84`), which is a code change on op 78 and goes to row 97.
  - Audit: the existing `CAPTURE_CONFIG_CHANGED`, scope `MIC`, field `MICS`, per slot (AU-A2).
  - `capture_audio_inputs` is untouched. Refused while a session is open (`CAPTURE_CONFIG_LOCKED`, `routes.ts:28-30`).
- VIDEO-01/VIDEO-02: no change (camera slots are outside D10(1)).

## 7. Loss watch and runtime behaviour

| Event | Before | After (this spec) | Evidence for "after" |
|---|---|---|---|
| Bound serial-less card moved to another port while the Core runs | `CARD_CHANGED` gives `MIC_DISCONNECTED` until op 99 re-registers | Unplug: `CARD_ABSENT` gives `MIC_DISCONNECTED` (unchanged). Re-plug on any port: match, so fault cleared and state `RETURNED`. No op 99 needed | E1 (rule change), E7 |
| Same, macOS | as above; on macOS the key also changes | as above (the wrapper keeps working, E8); stored key refreshed at the next op 99 (D-A4.2) | E5, E8 |
| Two identical serial-less units present | port separates | per Q-R2; recommended `CARD_AMBIGUOUS`, `CARD_UNDECIDED`, no fault, open refused | E7 |
| A unit stating a serial on a row with none stored | `CARD_CHANGED`/`SERIAL_DIFFERS` | unchanged | E1 |
| Fence snapshot facts `usbPort` | stored value | stored value (not compared); row 94 confirms no fence rule compares it | `capture/fence/sources.ts:146-148,177,222` (row 82 §1) |

Op 99 refreshes the key and port only when no session is open (`host.sessionOpen()` → `CAPTURE_CONFIG_LOCKED`, `service.ts:470,485`). So a running recording never sees its stored row change.

## 8. Audit (summary)

| Action | Audit entries | Names |
|---|---|---|
| First binding | 1 × `CAPTURE_AUDIO_INPUT_CHANGED` `REGISTERED` | unchanged |
| Re-register same card, any port (D-A4.1/2) | 1 × `REENABLED` (was `CARD_CHANGED` for a port move) | unchanged values |
| New binding of a held card | none (refusal, unit rolled back) | AU-R1 |
| Op 99 release (D-A4.4) | `RELEASED` (old input) + `REENABLED` (new input), same MIC | AU-A1 |
| Selector move (D-A4.6) | `CAPTURE_CONFIG_CHANGED` per changed slot | AU-A2 |
| Listing | `CAPTURE_DISCOVERY_SEARCHED` scope `AUDIO_CARDS` (unchanged) | - |

`RELEASED` is added to both lists, which must stay equal: `core/audit-details.ts:207` and `packages/shared/src/api/capture-audio-cards.ts:94` (register AU-A1). No audit detail carries a serial, port or USB id.

## 9. For row 96 (questions for the user)

| Id | Question | Options | Recommendation | Consequence of the recommendation |
|---|---|---|---|---|
| Q-R1 | Unit of exclusivity: the physical card, or one input of a card? | (a) physical card: one microphone per card; (b) card input: other inputs of a bound card stay bindable | **(a)**. It is the literal reading of "device sudah pairing ke 1 input"; on the bench (1-input BOMGE) (a) and (b) behave the same | A future 2-input interface can feed only one line (PRIMARY or STANDBY). With (b) it could feed both |
| Q-R5 | What "line" means in "pair ulang dengan line tertentu ... line yang lama harus di lepas" | (A) a DEMS microphone input (op 99 re-bind, §6.2); (B) a selector line PRIMARY/STANDBY (§6.3); (C) both, each where it applies | **(C)**. Only (B) can be run on the bench (1-input mic), and it is what row 126 tests. (A) covers multi-input cards under Q-R1 (a). (B) is a web change only, if op 78 already accepts the clear-then-fill edit for mics (E16) | Row 111 changes the mic-line menu; row 108 adds the op-78 mic move test. If the user wants the literal (A) with a NEW MIC id and the old one released, that needs engine retirement (RD3) or a new column (no register name), and becomes a MAJOR change at row 97 |
| Q-R2 | Two identical serial-less cards (RQ-A2) | (i) / (ii) / (iii), §4 | **(i) + (iii)** | A second identical mic is shown "Bound to MIC-a" and cannot be bound; while both are plugged in, MIC-a does not open and no fault is raised |
| Q-R3 | Stored `usb_port` (RQ-A6), and rows with neither serial nor port | keep as information / drop; for rows with neither: treat as "no serial" / keep refusing | **keep**; **treat as "no serial"** (register RM-A3/A4 remove) | No migration; the console can still show the port; old rows start matching any unit of their model |

## 10. Acceptance criteria (Given / When / Then)

Test levels: **U** = unit test in the existing file, **DB** = routes db test, **W** = web feature test, **H** = bench HIL (rows 125-127). Every "Then" can be checked against a value in a response body, a row, an audit entry or a test exit code.

| # | Level | Given | When | Then |
|---|---|---|---|---|
| T-1 | U | One shared case table holding every row of the §3 rule table | both `identifyRegisteredCard` and `matchStoredCard` run over it | both give the outcome the table names for every case; 0 cases mention `PORT_DIFFERS` (grep of both test files: 0 hits) |
| T-2 | U | Stored row: USB id 3347:2430, serial null, port `1-1`; listing: one unit of 3347:2430, serial null, port `1-2` | `identifyRegisteredCard` | `ok: true`; `renamed: false` when card id is unchanged |
| T-3 | U | as T-2, macOS listing (`cardId = usb_<port>` differs from stored) | `identifyMacosRegisteredCard` | `ok: true`, `renamed: true` |
| T-4 | U | Loss watch with a stored serial-less row; pass 1 listing without the card, pass 2 listing with it on another port | two passes | pass 1: `MIC_DISCONNECTED` raised (`CARD_ABSENT`); pass 2: fault cleared, state `RETURNED`; 0 `CARD_CHANGED` causes |
| T-5 | U | Two serial-less units of the stored model | runtime match / loss-watch pass | per Q-R2; with the recommendation: `CARD_AMBIGUOUS` + `MODEL_SHARED`, report `CARD_UNDECIDED`, 0 faults raised |
| T-6 | DB | MIC-01 bound to card X input 1 (serial-less) | op 98 | X answers `boundTo: "MIC-01"`, `registered: [{inputNumber: 1, deviceId: "MIC-01"}]` |
| T-7 | DB | as T-6, X now listed under another `cardId` and port (macOS move) | op 98 | X answers `boundTo: "MIC-01"` (identity, not key) |
| T-8 | DB | as T-7 | op 99 `{cardId: <new>, deviceIndex: 0, inputNumber: 1}` | `200`, `deviceId: "MIC-01"`, `change: "REENABLED"`; stored row's `card_id` = new id and `usb_port` = new port; non-retired row count unchanged; 1 audit `REENABLED` |
| T-9 | DB | Q-R1 (a): MIC-01 holds 2-input card X at input 1 | op 99 for input 2, no `release` | `409`, `details.reason: "AUDIO_CARD_ALREADY_BOUND"`, `details.deviceId: "MIC-01"`; 0 new rows; 0 audit rows |
| T-10 | DB | as T-9 | op 99 for input 2 with `release: true` | `200`, `deviceId: "MIC-01"`, `releasedDeviceId: "MIC-01"`; MIC-01 row `input_number = 2`; exactly 1 non-retired row with X's identity; audits: `RELEASED` (inputNumber 1) then `REENABLED` (inputNumber 2) |
| T-11 | DB | two op 99 calls for two inputs of an unbound card X, started together | both complete | exactly one `201`; the other answers `409` (`AUDIO_CARD_SEARCH_IN_PROGRESS` or `AUDIO_CARD_ALREADY_BOUND`); exactly 1 non-retired row with X's identity |
| T-12 | DB | session open | op 99 with `release: true` | `409 CAPTURE_CONFIG_LOCKED`; no row or audit change |
| T-13 | DB | selector PRIMARY = MIC-01, STANDBY empty (Q-R5 B/C) | op 78 `{unassign: [PRIMARY], STANDBY: MIC-01}` | `200`; PRIMARY empty, STANDBY = MIC-01; `CAPTURE_CONFIG_CHANGED` scope `MIC` for each changed slot |
| T-14 | W | as T-13, console mic-line menu | operator opens STANDBY | MIC-01 option is enabled with the move label; saving sends one edit with `unassign` of PRIMARY |
| T-15 | W | op 98 answer with `boundTo: "MIC-01"` on card X | panel renders | "Bound to MIC-01" shown; X's other input radios disabled (Q-R1 a); the holder's own input stays selectable |
| T-16 | DB | USB card listed with the replacement USB id | op 99 | `409 AUDIO_INPUT_NOT_REGISTRABLE` (D-A1.4); serial-less card with a USB id and no port: `201` |
| **H-1** (row 125) | H | Bench host, fresh DB, BOMGE (3347:2430, no serial) in port 1-1 | the user registers its input 1 in the console | op 99 `201`, `MIC-01` (or next free id); op 98 shows the card `boundTo` that id; its input not offered again; 1 audit `REGISTERED` |
| **H-2** (row 126) | H | H-1 done, MIC on PRIMARY, no session open | the user puts that MIC on STANDBY (Q-R5 B/C) | STANDBY = MIC, PRIMARY = "Not assigned" in the console and in op 77/78 state; 2 × `CAPTURE_CONFIG_CHANGED` (scope MIC). If the user picked (A) only: row 126 records N/A with the reason "1-input card" |
| **H-3** (row 127) | H | H-2 done; Core running; BOMGE moved from port 1-1 to any other USB socket | wait for the next completed loss-watch pass, then the user lists cards | `MIC_DISCONNECTED` (if raised during the unplug) is cleared, with state `RETURNED` in the Core log; op 98 shows the card with `usbPort` ≠ `1-1` and `boundTo` = the same MIC id; `cardId` before vs after recorded (confirms or refutes D-A4.1's hypothesis); 0 log lines or audit entries naming `CARD_CHANGED` for this MIC; re-register answers `REENABLED` with the same MIC id; non-retired MIC row count unchanged |

## 11. Risks and gaps

| Id | Risk | Trigger | Mitigation |
|---|---|---|---|
| R-1 | Two identical serial-less mics: the first stops opening | a second identical unit is plugged in | Q-R2 recommendation makes this visible (no silent wrong recording); out of scope on the bench (U-RF5) |
| R-2 | Op 78 refuses the mic clear-then-fill edit | mic rule does not order `unassign` first (E16 not shown for mics) | T-13 decides; if it fails, row 97 adds the op 78 change (camera rule as the model) |
| R-3 | Stale macOS key collides with a new card on the old port | another card takes `usb_<old port>` before MIC-a is re-registered | rollback with `AUDIO_INPUT_NOT_REGISTRABLE`; the operator re-registers MIC-a first (console text by row 92) |
| R-4 | Listing gate around the op 99 unit makes a concurrent listing answer busy | two operators at once | existing `409 AUDIO_CARD_SEARCH_IN_PROGRESS` with its word; operator-paced action |
| R-5 | Older stored data breaks the new rule (two MIC rows on one card) | a DB not created fresh | row 91 states the rule for older rows (A1 covers the bench only) |

Gaps:
- The Linux kernel card id across a port move and for two identical cards is not modelled in code. H-3 records it.
- Whether a refusal-path audit invariant expects `CAPTURE_DEVICE_RETIRED` for every `retired_at` write: not needed, because this spec writes no `retired_at`.
- The exact lines of the mic rule in op 78 were not read (E16); T-13 closes this.
- Loss-watch pass interval not read; H-3 uses "next completed pass", seen in the Core log.

## 12. Files and modules involved (for row 97)

| Path | Change |
|---|---|
| `apps/core-server/src/capture/adapters/audio/usb-audio-production.ts` | rule §3; `PORT_DIFFERS` removed; `MODEL_SHARED` per Q-R2 |
| `apps/core-server/src/capture/adapters/audio/usb-audio-macos.ts`, `mic-loss.ts` | no code change expected; tests T-3, T-4, T-5 |
| `apps/core-server/src/modules/capture-inputs/audio-cards/service.ts` | `matchStoredCard` §3; `unidentifiable` D-A1.4; op 99 exclusivity/re-key/release §5-6; op 98 `boundTo`, identity-based `registered` |
| `.../audio-cards/statements.ts`, `store.ts` | `READ_BOUND_AUDIO_INPUTS`; retired filter; a re-key write (added to `CAPTURE_AUDIO_CARD_WRITES`) |
| `packages/shared/src/api/capture-audio-cards.ts`, `core/audit-details.ts` | AU-L1, AU-B1, AU-B2, AU-R1, AU-A1 |
| `apps/core-web/src/features/devices/audio-cards*.ts(x)`, `capture-selector*.ts(x)` | §5 display, §6.3 move |

Implementation order: 107 (rule) → 108 (exclusivity, re-key, release; T-6..T-13) → 109 (wiring, audit list) → 111 (console). The order follows the B/C edges of 02_structured.md rows 107-111.

No `masterplan/02_plan.md` is written by this row. Code planning is row 97's.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
