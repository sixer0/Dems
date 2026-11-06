---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: N6 (wave 12, track D)
date: 2026-10-14
agent: coder-execution (agent N6)
source_plan: masterplan/06_design_macos_microphone.md (revision 3), sections 2, 3, 10.1
status: complete
tier: 1
---

# Row N6 - the card listing of a macOS host: three strict readers, the tie, the enumerator

## 0. Frame (5W1H)

| | |
|---|---|
| What | Pure code under `apps/core-server/src/capture/adapters/audio/`: a strict reader of the property-list form of the USB tree, a strict JSON reader of the system audio list, a reader of the capture program's own device list, the one-to-one tie of the three by device name, and an enumerator in the shape the audio-cards module consumes on Linux (`CardEnumerator`) |
| Why | Decision U22 (production microphones on macOS under `USB_AUDIO`); design 2 (alternative D) and 3; gate SM-02 (the text form of the USB tree is forgeable by a device's product string, decision C96 (2)); also SM-01, SM-03, SM-05, SM-11, SM-13, SM-22, SM-25 |
| Who | Agent N6. Consumers: row N7 (the runner of the three rows hands the texts in), row N9 (the adapter). Not touched: `mic-helper-args.ts` and the capture static list (N4), the platform seam (N7), `packages/shared` (N2) |
| When | 2026-10-14, head 1fbeada7, branch `task4/input-av-core-port` |
| Where | Six new source files, one test file, 21 text fixtures, one existing file edited (`card-listing.ts`) |
| How | Hand-written fixtures in the measured forms, a small writer of the same forms in the test for one-member variants, the existing match `identifyRegisteredCard` called unedited. NO process is started by the product code, no device opened, no file read |

## 1. Files

| File | Kind | What |
|---|---|---|
| `src/capture/adapters/audio/macos-plist.ts` | new | `parseMacosPlist`: the strict subset of the property-list XML |
| `.../macos-usb-tree-reader.ts` | new | `parseMacosUsbTree`: list L1 - USB audio devices with identity from INTEGERS |
| `.../macos-system-audio-reader.ts` | new | `parseStrictJson`, `parseMacosSystemAudio`: list L2 - four members by type |
| `.../macos-helper-list-reader.ts` | new | `parseMacosHelperList`: list L3 - index and name of the audio entries |
| `.../macos-card-tie.ts` | new | `tieMacosLists`, `isTieableName`, the reasons of an undecided device |
| `.../macos-card-listing.ts` | new | `MacosListingSource`, `readMacosListing`, `createMacosCardEnumerator`, `MacosCardListingError` |
| `.../card-listing.ts` | edit (Edit tool) | ONE word added to `CardFactsSource` (`SYSTEM_PROFILE`), and the count word in its comment ("three" to "four") |
| `.../__tests__/macos-card-listing.test.ts` | new | 43 tests |
| `.../__tests__/fixtures/macos/*.txt` | new | 21 text fixtures, 24,817 bytes, all synthetic |

`macos-helper-lines.ts` in the same folder is row N8's (the helper's stream line); it is another file and another reader.

## 2. The property-list reader (SM-02, the gate)

**Which parser: a small strict one of our own. No dependency added, the lockfile untouched.** The only property-list parser in `package-lock.json` is `@expo/plist` (with `bplist-parser`), a transitive dependency of the mobile tool chain; it is no dependency of `@dems/core-server`, and it reads through a general XML parser that is not bounded. It is not used (08b line 112: a strict reader of our own needs nobody's word).

Read: the fixed three-line head compared as ONE string (nothing of it is parsed), one top value, the fixed foot; elements `dict`, `array`, `key`, `string`, `integer`, `real`, `date`, `data`, `true`, `false`; the five predefined entities.

Refused, each with a closed word (`PlistRefusal`), never repaired:

| Word | When |
|---|---|
| `TOO_LONG` | more than 65,536 characters (the door's cap; checked before anything is read) |
| `HEAD` | not the fixed head - so any other document type, an internal subset, an entity declaration, a byte-order mark |
| `FOOT` | not the fixed foot: a cut text, or text after the end |
| `MARKUP` | a comment, a processing instruction, a CDATA section, an attribute, an unknown element, text between elements, a second top value |
| `ENTITY` | any `&` that is not one of the five (no numeric reference, no declared entity) |
| `KEY` | a key empty, over 256 characters, or TWICE in one dictionary |
| `VALUE` | an integer that is not plain decimal; a real, date or data element not of its form |
| `DEPTH` / `NODES` | more than 12 nested containers / more than 8,192 elements |

A dictionary is a `Map` (a key of the text is never a property name of an object). An integer beyond the exact whole numbers is kept as "an integer with no usable value".

**The disagreement of two measurements (design 2.3, fifth bullet) - settled by this row's one run:** the property-list form at depth 2 DOES carry `bInterfaceClass` and `bInterfaceSubClass` on the direct children (as row MM saw, not as the review's run saw). The class rule stands. If a host prints no children, no audio device is CLAIMED by the tree, and a USB input of the system list is then `NO_USB_DEVICE` (never a card).

**Residual, stated:** that a string stays one element rests on the system program escaping `<` and `&`. Measured here: no entity and no markup inside any string of this Mac's tree; a device with hostile strings was not connected. The twin case is covered by a fixture: a string that is NOT escaped and writes a second `locationID` is a key twice, and the whole tree is refused (`KEY`).

## 3. The three lists, what is read

L1 (`parseMacosUsbTree`). Of a device: `idVendor` (1 to 65,535), `idProduct` (0 to 65,535), `locationID` (1 to 4,294,967,295), `IORegistryEntryLocation` (eight hex digits stating the SAME number), `USB Serial Number`, `USB Product Name`, `IORegistryEntryChildren`; of a child `bInterfaceClass`, `bInterfaceSubClass` (0 to 255; a child with neither is passed over). Audio = a direct child with class 1, sub-class 2. Refused and counted: a read key of another type, an identity member missing or out of range, the two locations differing, children not of the form; and EVERY audio device whose location another device of the tree states too. A serial outside the closed rule is NO serial (the Linux rule, C56). A device that is no audio device is not judged. The whole tree is undecided for: no property list, a top that is no list of dictionaries, more than 32 devices. An EMPTY text is a tree of no device (the program prints nothing when no USB device is connected); a FAILED row is the runner's fact.

L2 (`parseMacosSystemAudio`). An own JSON reader, because the built-in one cannot tell `6` from `6.0`, keeps the last of a key stated twice, and builds before a depth can be checked. Bounds: 65,536 characters, depth 8, 4,096 values, 32 items. Top: exactly one member `SPAudioDataType`, a list of at most one object, whose `_items` is the list. Of an item: `_name` (string, else the list is refused), `coreaudio_device_input` (absent = no input; integer 1 to 64; anything else = the item is UNREADABLE), `coreaudio_device_srate` (integer 8,000 to 192,000 for an input, else unreadable), `coreaudio_device_transport` (the one USB word; missing, unknown or no string = not USB). The manufacturer and source members are never read. An empty list in each of its forms is a list of no item, never another shape.

L3 (`parseMacosHelperList`). The audio section line exactly once, as the WHOLE line with the tag; no line before it is an audio entry; after it every tagged line is an entry `[<n>] <name>` with the tag of the section line itself, `<n>` in canonical decimal and equal to 0, 1, 2 ... in order, at most 32, the name not empty; no entry after a line without the tag; no over-long line. Any of these broken refuses the WHOLE list. A last line without a line end states nothing.

## 4. The tie (design 3.3) and the undecided states

A device of the tree becomes a card only when ALL hold; the first that fails names the reason:

| Reason | When |
|---|---|
| `NAME_NOT_TIEABLE` | no product string; or the NAME rule of `cardListingText` does not answer it unchanged (markup, a control character, a letter beyond ASCII, over 64, outer spaces); or it holds `://` or `@` |
| `NAME_SHARED` | another audio device of the tree states the same string; or more than one input item (of ANY transport) or more than one audio entry has it |
| `NO_SYSTEM_INPUT` | no readable input item has that name (also the confined, empty system list; a USB output-only device; a count or rate as a float or a string) |
| `NO_CAPTURE_ENTRY` | no audio entry of the capture list has that name |
| `LISTS_DISAGREE` | the readable input items and the audio entries are not the same multiset of names: EVERY device |
| `TRANSPORT_NOT_USB` | the one item of that name does not state the USB word |
| `NO_USB_DEVICE` | (no device of the tree) a readable input states the USB word and no audio device of the tree has its name |

A built-in, virtual, aggregate, wireless or network input, or one with no transport word, is never a card: it is counted in `passedOver` and is NOT an undecided device (a listing with only the built-in input: 0 cards, `skipped` 0). An undecided device is stated by USB id, port, serial and reason - never by a name.

A LIST THAT FAILED ITS BOUNDS makes the whole listing undecided: `USB_TREE_UNREADABLE`, `SYSTEM_LIST_UNREADABLE`, `CAPTURE_LIST_UNREADABLE`, each with the reader's closed word. `listTied()` answers it as `ok: false`; `list()` (the Linux shape) RAISES `MacosCardListingError`. It never answers a listing of no card.

## 5. The card, and the port path

| Member | Value | Rule it passes |
|---|---|---|
| `usbId` | `vvvv:pppp` from the two integers | `CAPTURE_AUDIO_USB_ID_PATTERN` |
| `usbPort` | the location id as EIGHT LOWER-CASE HEX DIGITS from the integer, e.g. `01120000` (synthetic) | USB_PORT |
| `usbSerial` | the stated serial through USB_SERIAL, else null | USB_SERIAL |
| `cardId` | `usb_<the eight digits>` (12 characters) | `CAPTURE_AUDIO_CARD_ID_PATTERN` |
| `cardIndex` | the index of the device's entry in L3 of THIS listing | 0 to 31 |
| `deviceIndex` | 0 | |
| `channelCount`, `ratesHz` | `coreaudio_device_input`, the one current rate (96,000 is stated, not hidden) | 1 to 64 |
| `product` | the product string through `cardListingText(NAME)`, unchanged or no card | NAME |
| `factsSource` | `SYSTEM_PROFILE` | FACTS_SOURCE |
| `usb` | always true (SM-01 (b)) | |
| `formats`, `sampleBits` | empty | |

**Does the column accept the port path? YES, with nothing left over.** `capture_audio_inputs.usb_port` holds `^[A-Za-z0-9:._-]{1,64}$` (migration `0017_network_commissioning.sql:52`); eight characters of `[0-9a-f]` are inside it. The test reads the CHECK out of the migration file and matches the port against it, against `CAPTURE_AUDIO_USB_PORT_PATTERN` and against the listing's own rule, for the lowest, a middle and the highest location.

Every string member is passed through `cardListingText` by the kinds of the exported table `CARD_LISTING_STRING_FIELDS.CaptureCard` (the Linux exit `passCardStrings` is not exported and `buildCaptureCard` cannot state the new facts source; the table is the same).

## 6. Fixtures (all synthetic; `__tests__/fixtures/macos/`)

| Case of the brief | Files |
|---|---|
| one USB interface with six inputs beside a built-in input | `tree-`, `system-`, `helper-one-interface` |
| two same-model interfaces on two ports (one with a serial) | `*-two-same-model` |
| two same-NAMED devices of different models, a third with its own name | `*-two-same-named` |
| a virtual device | `system-`, `helper-virtual` (with `tree-one-interface`) |
| an aggregate, a wireless, a network device, one with no transport word | `system-`, `helper-aggregate` |
| hostile product strings: markup, a forged plist key (escaped), 4 KiB | `*-hostile-strings` (the 4 KiB text replaces the marker `@@FOUR_KIB@@` in the test) |
| a quote, a line break, a forged text-form header, a forged entry | `*-hostile-line-break` |
| a forged member NOT escaped | `tree-forged-unescaped` |
| a document type with an internal subset and entity declarations | `tree-entity-declaration` |
| truncated and oversized lists | made in the test from the fixtures: EVERY proper beginning of the three one-interface texts, and each text one character over its bound |

The transport words other than the USB one and the built-in one are NOT measured (no such device on this Mac); the reader does not depend on them: every word but the one is "not USB".

## 7. The one run of the three programs (decision U23 (3)) - shapes only

Run once each, outside the command sandbox, by a script that printed counts, types and lengths and kept nothing; no name, serial or location id was written anywhere.

| List | Seen (form only) | Against my forms |
|---|---|---|
| L1 | exit 0; 42,381 bytes, 1,478 lines, 5 devices (row MM: 34,693 bytes, 4 devices); the head lines and the foot exactly as fixed; elements `plist array dict key integer string data true false` and no other; one attribute (`version`); no entity, no comment, no CDATA; 428 integers, all plain decimal and not negative; depth 6; every `IORegistryEntryLocation` eight lower-case hex digits equal to `locationID`; the interface class present on the children; one child per device without interface keys; one device with a serial; `data` content on lines of its own | MATCH. Two notes: the text has more lines than the 2,048-line rule of the Linux texts could take with a few more devices, so L1 is bounded by characters, depth and count, NOT by lines; at 42 KiB for 5 devices the 64 KiB cap is nearer than the design's figure says |
| L2 | exit 0; 1,471 bytes; one top member, a list of one object with `_items` and `_name`; the four members with the types the design states; depth 5; NO line end at the end of the text | MATCH. The rule "a last line without a line end is a cut line" (design 2.3, first sentence) cannot hold for L2; a cut text is refused as no JSON instead |
| L3 | exit 251; 613 bytes of diagnostics; one tag, the same on every line; video section first (4 entries), audio section once (2 entries); three error lines after | MATCH |
| Tie | the L2 input names and the L3 audio names are the same multiset (2 and 2); the one USB audio device of L1 has its name once in each | MATCH |

Observed and worth a line: the USB interface stood at helper index 1 in this run and at 0 in row MM (the Mac was restarted in between). The index is not stable across a restart; the design never keeps it.

**NOT DONE, stated:** my readers were NOT run on the real texts - the one permitted run was the shape script, and the texts were discarded. That the readers read this Mac's real lists is row N7's first check.

## 8. Tests (43, all in the new file; the Linux tests are unedited)

Property-list reader 4, USB tree 5, system list 5, capture list 3, the tie 15, the enumerator 3, the identity into the existing match 8.

The identity, fed to `identifyRegisteredCard` UNCHANGED: found in the same socket at another index; WITH a serial found on another port (`renamed`: the card id follows the socket); WITHOUT a serial found by its port and `CARD_CHANGED / PORT_DIFFERS` elsewhere; a same-model unit elsewhere NOT matched (`SERIAL_DIFFERS`, `PORT_DIFFERS`, `USB_ID_DIFFERS`); a pre-column row refused (`CARD_UNIDENTIFIED / IDENTITY_NOT_STORED`); no row of a card that is not USB finds a card.

Mutation honesty (wave 12 rule 6) - six mutations planted together in my own new files, one run, 10 tests RED, then reverted:

| Mutation | Tests seen RED |
|---|---|
| the "key twice" refusal of the property list removed | the refusals of the reader; the whole-tree test (forged, not escaped); the enumerator's undecided cases |
| the comparison of `IORegistryEntryLocation` with `locationID` removed | the typed twins |
| the "location stated twice" rule disabled | SM-02 (4) |
| the tag comparison of the capture list disabled | the capture list's refusals; the line-break fixture |
| `LISTS_DISAGREE` disabled | SM-03 (1) |
| `TRANSPORT_NOT_USB` disabled | SM-03 (5) |

## 9. Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| My tests | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio/__tests__/macos-card-listing.test.ts` | run 1: 42 passed, 1 FAILED (my own new depth test: an off-by-one of my bound, fixed in both readers); run 2: `Tests 43 passed (43)`; after the typing fix of the test: `Tests 43 passed (43)` |
| Audio adapter suite + the static sets | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio src/capture/adapters/__tests__/static.test.ts src/capture/__tests__/static.test.ts test/static` | `Test Files 27 passed (27)`, `Tests 584 passed (584)` - no red, mine or another's |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | run 1: one error in my test (a union of object literals); run 2: clean |
| Lint | - | the workspace has no ESLint configuration (`eslint.config.*` not found): not run |

No static rule pins the files of this folder by a closed list that the new files break: both static files pass with no edit, so NO request line for a list's owner is needed.

## 10. Driver decisions (for the controller to confirm)

1. TWO reason words beyond the design's five: `TRANSPORT_NOT_USB` and `NO_USB_DEVICE` (the brief asks a named reason for a device that is never offered as `USB_AUDIO`; SM-03 (4) names both cases). They are words of this folder, not contract members.
2. A non-USB input that shares no name with a USB unit is `passedOver`, not `skipped`: counting the built-in microphone as skipped on every listing of every Mac would make the search screen's count meaningless.
3. A device with a product string that fails the NAME rule is stated as UNDECIDED (`NAME_NOT_TIEABLE`, with its identity from integers) instead of being only counted by the tree reader (design 2.3 says "refused, counted"): the adapter can then tell the operator the right thing. It is counted in `skipped` either way.
4. An unreadable list RAISES from `list()` instead of answering an empty listing (the Linux reader raises too). The design gives the runner's failures a code and is silent on a text that the reader refuses.
5. `nativeFormat` is `S32_LE` (the Linux default for a card that lists none): the type demands a word; no list states a format. The macOS adapter must not read it.
6. `captureOrderMark`: a 32-bit sum over the ordered capture list, so that row N9 can compare "the same ordered list" between two listings (design 3.3) without a name being kept. A change detector, not a proof.
7. The comment word "three" in `card-listing.ts` was changed to "four" with the one word of the list: two one-word edits, not one.
8. A capture list in which an audio input's name holds a line break is refused as a whole (the one-to-one rule would make every device undecided anyway). Cost: such a device, while connected, stops every microphone of the host from being listed.
9. Vendor 0 is refused (the id `0000:0000` is the fixed word of an unreadable id).
10. A USB output-only device is `NO_SYSTEM_INPUT` (the design's set has no word for "is no input"): `skipped` is then non-zero on a host with a USB loudspeaker.

## 11. Unproven here (hardware list)

- The readers on the REAL texts of this Mac (row N7).
- A device with hostile strings: that the system program escapes them (section 2).
- The location id after a reboot and after a re-plug in the same socket (design 3.1; 9A/H-07, H-08).
- The transport words of a virtual, aggregate, wireless and network device.
- A hub with many devices against the 64 KiB cap (42 KiB for 5 devices today).

## 12. Requests

Two lines in `delegation_progress/file_requests.md`, neither blocking: the README statements of SM-01 (d) and SM-03 (6) to C2; the words rows N7 and N9 build on (no file change asked).

---
*Generated: 2026-10-14*
