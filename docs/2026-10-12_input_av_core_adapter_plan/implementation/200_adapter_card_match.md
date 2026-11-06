---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 200 (M4 / WP-08; follow-up of row 192; before the lift; requirement AD-07 (4))
date: 2026-10-13
agent: coder-execution (batch 9, agent R4)
tier: T3
status: complete on doubles - needs-review: the STORED session row does not hold the two facts yet (one request to the fence's writer), and three driver decisions (section 6)
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Row 200 - the production microphone adapter matches the stored row to a live card by serial, else by port path

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AU` = `CS/src/capture/adapters/audio`. The adapter is still REGISTERED NOWHERE (class-C, before the lift): this row changes what it will do when it is.

## 1. Why

`identifyRegisteredCard` took "the ONE connected card that carries the stored USB id". ONE unit swapped for another unit of the same model - on the same port or another - was opened without a word; two connected units were refused `AUDIO_CARD_AMBIGUOUS`, so a room with two identical interfaces could not record (`implementation/067_usb_audio_adapter.md`; `implementation/192_audio_input_serial_port.md` section 1). Row 199 stores the serial and the port path; this row reads them at `open` and again at `start`.

## 2. What was built (`AU/usb-audio-production.ts`)

| Item | Change |
|---|---|
| `RegisteredAudioInput` | two OPTIONAL members `usbSerial`, `usbPort` (`string \| null`); absent is read as null. `isRegisteredAudioInput` holds both to the closed form of the columns (a row with a serial of another shape is `AUDIO_INPUT_NOT_REGISTERED`, before any listing) |
| `identifyRegisteredCard` | the rule of section 3. Its failure carries an optional `detail`, a word of the closed set `CardMismatch` (`USB_ID_DIFFERS`, `SERIAL_DIFFERS`, `PORT_DIFFERS`, `IDENTITY_NOT_STORED`, `SERIAL_SHARED`), which becomes the DETAIL WORD of the `UsbAudioError` - a code, never a serial, a port or a USB id |
| `start` | unchanged in its course: it lists again and calls the same match, so a card swapped since the open is refused before the door is called; the "same place" test additionally compares the live serial and port with those of the open (`AUDIO_CARD_MOVED`) |
| `UsbAudioCardFacts`, `UsbAudioSourceStatement`, `sourceFacts` | `usbSerial`, `usbPort`: the values of the card that was OPENED, from the listing of the open - the serial and port ACTUALLY USED, not the stored ones |
| Refusal codes | NO new code: `AUDIO_CARD_CHANGED` (a same-model card that is not the registered unit), `AUDIO_CARD_UNIDENTIFIED` (no stored identity), `AUDIO_CARD_AMBIGUOUS` (two units state the stored serial and the port names neither). All three are `DEVICE_NOT_FOUND` on the wire, as before |
| The argument vector | NOT touched: the two table calls, the door calls and `guardedArguments` are byte-identical (SR-4 and the argument-origin test pass unchanged) |

Tests: `AU/__tests__/usb-audio-production.test.ts` (+6 cases in block "row 200"; the fixture card may state a serial; the stored row of the fixture holds serial and port; 1 case turned, section 5; the planted-value case plants a serial too), `AU/__tests__/mic-loss.test.ts` (fixture only; 1 case re-stated). Edit tool only for every existing file.

## 3. The rule (the same as the registration's `matchStoredCard`, which this layer does not import)

Among the cards of the stored device index, never by a card index:

| Stored row | Live | Answer |
|---|---|---|
| not a USB card | the one entry of the stored kernel name, not USB | found (unchanged) |
| USB id is the fixed word | - | `AUDIO_CARD_UNIDENTIFIED` (unchanged) |
| no serial AND no port | anything, also nothing | `AUDIO_CARD_UNIDENTIFIED` / `IDENTITY_NOT_STORED` |
| any | no card of the USB id | `AUDIO_CARD_CHANGED` / `USB_ID_DIFFERS` when a card carries the stored name, else `AUDIO_CARD_ABSENT` (unchanged) |
| a serial | ONE unit states it, on any port | found (the card was moved; `renamed` when its kernel name differs) |
| a serial | no unit states it (another serial, or none) | `AUDIO_CARD_CHANGED` / `SERIAL_DIFFERS` |
| a serial | two units state it | the one on the stored port, else `AUDIO_CARD_AMBIGUOUS` / `SERIAL_SHARED` |
| no serial, a port | the unit on that port, stating no serial | found |
| no serial, a port | no unit on that port | `AUDIO_CARD_CHANGED` / `PORT_DIFFERS` - the same model elsewhere is never opened in its place |
| no serial, a port | the unit on that port states a serial | `AUDIO_CARD_CHANGED` / `SERIAL_DIFFERS` |

## 4. The cases the cells left open - decided (the same decisions as row 199, section 4)

| Case | Decision | What the operator sees |
|---|---|---|
| Serial today, none when registered; or the reverse | REFUSED, `AUDIO_CARD_CHANGED` / `SERIAL_DIFFERS` | the microphone reads not present (`DEVICE_NOT_FOUND`); the technician registers the card (operation 99: `CARD_CHANGED`), then it opens |
| A hub renumbers ports after a reboot | with a serial: found on any port. Without: `AUDIO_CARD_CHANGED` / `PORT_DIFFERS` until registered again. The stored form is the kernel's topological path (controller address and port chain) | the same |
| A row of before the columns (both NULL), or a reader that hands neither over | REFUSED, `AUDIO_CARD_UNIDENTIFIED` / `IDENTITY_NOT_STORED` - not matched by USB id with a warning: nothing would exclude a different unit | the microphone reads not present until it is registered again |
| Two units without a serial exchanged on ONE socket | NOT DETECTABLE (USB id and port path are equal). Stated | nothing |

A consequence in a file this row did not edit: the loss watcher (`AU/mic-loss.ts`, row 68) is handed this match. A same-model card on another port mid-session is now `AUDIO_CARD_CHANGED`, which the watcher counts as THE REGISTERED CARD IS NOT THERE (a loss); a row with no stored identity is `MIC_LOSS_CARD_UNDECIDED` (reported, no loss). Its 23 cases pass.

## 5. Verification cell

| Cell | Case (`usb-audio-production.test.ts`, block "row 200") | Result |
|---|---|---|
| T-1 with a door double: a swapped same-model card on another port is refused by the named code with 0 helper starts | "A SWAPPED SAME-MODEL CARD ON ANOTHER PORT is refused by AUDIO_CARD_CHANGED with 0 helper starts ..." - `door.calls = []` (not even the pipe maker), no pipe directory, no configuration file; the same for the pre-check and the enumeration; no serial, port, USB id or product in the refusal | green |
| the same card after a re-plug on its port opens | "THE SAME CARD AFTER A RE-PLUG ON ITS PORT opens - at another card index too - and the helper starts once" (absent while unplugged; 1 guard after the start) | green |
| again at `start` | "AGAIN AT START: a card swapped between the open and the start is refused before the door is called" (three swaps; `door.guards = []` each) | green |
| the argument-origin static test of row 67 passes unchanged | `capture/__tests__/static.test.ts` "SR-4 at the production microphone adapter" and this file's "argument origin" case: not edited, green; "no text of the stored row ... (planted values)" now plants a serial and a port in the STORED ROW as well: 0 hits in every argument, the environment and the configuration | green |

TURNED, one case of row 67: "two connected cards carry the stored USB id: AUDIO_CARD_AMBIGUOUS" -> the unit on the stored port is opened (both inputs of a twin pair open); AMBIGUOUS is kept for two units that state the stored serial with no port to tell them apart.

Result lines (2026-10-13, from `CS`):

| Check | Result |
|---|---|
| `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/modules/capture-inputs` | run 1: `Tests 1 failed \| 303 passed (304)` - the red in `mic-loss.test.ts:288`, a case whose fixture relied on "two units = ambiguous" (the turned rule; its fixture was re-stated) |
| `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio` | run 2: `Test Files 6 passed (6)`, `Tests 180 passed (180)` |
| `npx tsc --noEmit` | no output, exit 0 |
| `npx oxlint src/modules/capture-inputs src/capture/adapters/audio` | exit 0 |

No process was started by this row beyond what the existing file already runs (the pipe maker and the stand-in guard of block 7, through the real door, in a temporary directory); no port, no database, no sound card.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | NO new refusal code: the swap is `AUDIO_CARD_CHANGED`, the missing identity `AUDIO_CARD_UNIDENTIFIED`, the reason a detail word | both codes existed with exactly these meanings; a new code would be a new member of the lists other rows pin (wire table, loss watcher) |
| DD-2 | The two new members of the stored row are OPTIONAL, and absent means "no identity" = refused | the reader of the stored row is row 85's; a reader that does not yet hand the columns over must fail closed, not match by USB id |
| DD-3 | Two units of one model on two ports are no longer `AUDIO_CARD_AMBIGUOUS`: each input opens the unit on its stored port | the port now tells them apart; the old refusal was the stated cost of having no port |

## 7. Requests (`delegation_progress/file_requests.md`)

1. The fence's writer (`capture/fence/sources.ts`): two keys in `MIC_SOURCE_FACT_KEYS`, two members of `AudioCardStatement` / `AudioSourceStatement`, two lines in `micSourceFactsOf`. UNTIL THEN the adapter STATES the serial and port actually used and the stored session row drops them (the fence copies its eight closed keys only). This is the one part of the brief ("the source facts of the session state the serial and port actually used") that is true of the adapter's statement and NOT yet of the database row.
2. Row 85 (agent R1): the stored-row reader must select `usb_serial`, `usb_port`; else every USB microphone is refused at the lift.
3. The hardware package: the steps of `9A/H-07` (shared with row 199).

## 8. The double, and what stays unproven

Doubles: the real parser over fixed listing texts (a swap, a re-plug and a move are a change of those texts); a door that starts nothing and counts what it was asked; the real configuration writer and a real named pipe in a temporary directory. Unproven until `9A/H-07` / `9A/H-08`: everything of section 8 of row 199's record (the serial file, the stability of the port path, the undetectable same-socket swap), and that a real helper opens the card the match found.

## 9. Identifiers

AD-07 (4): closed in the adapter on doubles. Open in the product until row 85's reader hands the two columns over and the lift registers the adapter.

---
*Generated: 2026-10-13 11:15*
