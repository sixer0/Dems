---
task_slug: input_av_core_adapter_plan
row: 64
milestone: M4 / WP-07a
date: 2026-10-13
agent: coder-execution
status: complete
tier: T3
---

# Row 64 - the card listing parser behind an injected enumerator

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AUD` = `CS/src/capture/adapters/audio`, `IAV` = `apps/input-av/nvr` (read only; nothing under `apps/input-av/data/` and no `.env` was opened).

## 1. What was built

| File | State | What it is |
|---|---|---|
| `AUD/card-listing.ts` | NEW | The parser, the text rule, the injected source (`CardListingSource`), the enumerator (`createCardEnumerator`), the named refusal, the one-room rules. Imports `@dems/shared/api` (the patterns and bounds of row 63) and `../types` (the error of row 20) and nothing else: no module of the host |
| `AUD/card-listing-reader.ts` | NEW | The ONE file that touches the file system, for reading only (SR-1, entry 3): `<root>/cards`, `<root>/card<N>/usbid`, `<root>/card<N>/stream<D>`, root `/proc/asound`. N and D are integers 0 to 31, checked before a path is made. The two texts only a program gives (`arecord -l`, the hardware parameter dump) are handed in |
| `AUD/__tests__/card-listing.test.ts` | NEW | 41 cases on fixed texts (24, and 17 hostile names through one case) |
| `AUD/__tests__/card-listing-reader.test.ts` | NEW | 5 cases on a directory of fixed files below the temporary directory |
| `CS/src/capture/__tests__/static.test.ts` | MOD | section 4 |

NOT touched: `AUD/usb-audio.ts` (still the class-C stub, no opener), `adapters/types.ts`, `adapters/index.ts`, `real.ts`, `registry.ts`. Nothing is registered and nothing calls the new files yet (rows 67, 68, 70, 85).

## 2. The logic, and where it comes from

| Rule of input-av's tested scheme | Source | Here |
|---|---|---|
| Capture devices from the lines of `arecord -l` | `IAV/audio.py:29-32` | `parseCaptureDeviceList` |
| Present cards from `/proc/asound/cards` | `IAV/audio.py:328-335` | `parsePresentCards` (also the cross-check of the list; row 68 can use it for loss) |
| USB identity: the `usbid` file; the product is the first line of `stream0` before ` at usb-` | `IAV/audio.py:82-89` | `parseUsbIdentity`; additionally the port after `usb-` (for AD-07 (4), row 70 / 156) |
| Native channel count = the largest `Channels:` of the capture part of `stream<D>`; rates; bits | `IAV/audio.py:118-133` | `parseStreamCapture` |
| Second source, the hardware parameter dump (`CHANNELS`, `FORMAT`, `RATE`) | `IAV/audio.py:134-142, 408-410, 435` | `parseHwParams` |
| Native format: the first of S32_LE, S24_3LE, S24_LE, S16_LE the card lists, else S32_LE | `IAV/audio.py:396, 401-414` | `CARD_FORMAT_PREFERENCE`, `CaptureCard.nativeFormat` |
| One rate per card: the wanted one, else 48 000, else the lowest | `IAV/audio.py:430-439` | `cardSampleRate` |
| ALL channels are opened, inputs are SELECTED, never mixed | `IAV/recorder.py:104-116` | `selectCardInputs`: `openChannels` = the native count, `channelIndexes` = input number minus 1 |
| An input above the card's count is refused | `IAV/service.py:53-56`, `routers/audio.py:113-117` | `AudioInputBeyondCardError` (`AUDIO_INPUT_BEYOND_CARD`), raised by `selectCardInputs` and `allocateCardInput` |
| One input belongs to one source; all sources of a card share one rate | `IAV/routers/audio.py:83-105` | `allocateCardInput` (`INPUT_TAKEN`, `RATE_DIFFERS`) |

Deliberately NOT ported: the generic source that takes the first USB card (`IAV/audio.py:44-51, 77-79, 99-106`). A card is obtained only by `findCaptureCard(listing, cardId, deviceIndex)`, which needs exactly one match. Also not ported: the caches of channel count and format (`audio.py:115, 397`): the unit keeps no state; a card with no stated count is marked `factsSource: ASSUMED` (count 2) instead.

### AD-07 in this row

| Requirement | Where |
|---|---|
| (1) one function before text leaves the adapter | `cardText`: printable ASCII, 1 to 64 after the spaces at the ends, else the fixed word `UNKNOWN`; never cut, never cleaned. `cardUsbId`: the form, else `0000:0000`. A card id not of the kernel's form: the entry is not listed |
| (2) integers and text apart | `CaptureCard.cardIndex`, `deviceIndex`, `channelCount`, `CardInputSelection.channelIndexes` (0 to 63) are the integers; every call of `CardListingSource` takes integers only (asserted) |
| Text cannot move an integer | the device index is the LAST `], device N:` of a line, the port the LAST ` at usb-`; with the kernel's table present, a listed entry must name a card of it; a USB entry with no stream file is not believed |
| Cut text | a text over 65 536 characters is not read; a last line without a line end states nothing (a cut `Channels: 1` of `16` is never read) |

Each `CaptureCard` of the fixtures is accepted by `CaptureAudioCardSchema` of row 63 (asserted).

## 3. Evidence

| Check | Command (from `CS`) | Result |
|---|---|---|
| Targeted run, once | `npx vitest run --project unit --maxWorkers=2` on the two new files, `src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts`, `test/static/credentials.test.ts` | `Test Files 1 failed \| 4 passed (5)`, `Tests 1 failed \| 128 passed (129)` |
| The one failure | rule A-5 of `adapters/__tests__/static.test.ts` | `src/capture/worker-arguments.ts:31 imports the adapter layer and is not a unit that wires it`: a file row 47 is editing now (its claim line). Not a file or a rule of this row; not re-run; filed in `file_requests.md` |
| Typecheck, once | `npm run -s typecheck` | exit 0 |
| Lint of the new code | `npx oxlint src/capture/adapters/audio src/capture/__tests__/static.test.ts` | exit 0 |

Verification cell of the row: fixed listings give the expected cards and inputs (blocks 1 to 3 of the test: a 2-input card, a 6-channel interface, two USB cards with an onboard card, an onboard card alone, no card, 17 hostile names, malformed and cut text, more than 32 entries); an input beyond the card is refused by name (block 4); a search of the area for a card choice made by the code finds 0, with a control that finds 3 on a planted text (block 6), and the export list of the unit is pinned.

## 4. Static rule lists (this row is the writer of the batch)

`CS/src/capture/__tests__/static.test.ts`, on SR-1 entry 3 only: one constant `CARD_LISTING_READER`; its entry in the G-R2 allowlist; its entry in the exact list of file-system importers (4 -> 5); one new case holding "for reading only" (one import, `open(path, 'r')` once, no writing, removing or starting call; the parser imports two modules, neither of the host). The list of process importers and G-R8 are unchanged. Nothing of SR-4 was touched (its entries take effect with row 66). `adapters/__tests__/static.test.ts` and `test/static/credentials.test.ts`: not edited (no list of theirs counts a file-system importer).

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| DD-1 | Parser and reader are two files; only the reader is in the lists | SR-1 admits "the card listing reader"; the parser then needs no entry |
| DD-2 | The reader takes the listing program's texts as functions handed in; it starts nothing | SR-1 admits no fourth process file; the program goes through the production door (rows 67 / 70 / 85). The reader's `root` parameter exists for tests; production code hands in nothing |
| DD-3 | Fixed word `UNKNOWN`; fixed USB id `0000:0000`; a text with `<` or `>` is replaced although printable | Row 63 left the word open. A malformed USB id must stay valid for the schema and the stored CHECK, and null would call a USB card not USB. The `<` `>` rule is narrower than the schema; row 155 may restate it |
| DD-4 | A card id outside `^[A-Za-z0-9_]{1,32}$` is not listed (not replaced) | It is the key of a registration; a replaced key would name another card |
| DD-5 | A card with more than 64 channels is not listed | It could not be opened with all its channels within the contract's bound |
| DD-6 | No cache; `ASSUMED` marks a guessed count of 2 | Row 70 should refuse to store an `ASSUMED` count |
| DD-7 | A file that exists and cannot be read raises `CardListingReadError` (short system code, no path); nothing is logged here | The capture folder logs in one place (static rule); the caller logs |

## 6. The double, and what stays unproven

The double is a table of texts written by hand in the forms input-av parses, with synthetic names, and a temporary directory in place of `/proc/asound`. No text was recorded from a host. Unproven until hardware:

| Unproven | Proven by |
|---|---|
| That `arecord -l`, `/proc/asound/cards`, `usbid` and `stream<D>` of the target host have the forms of the fixtures, also for the service account and with an empty environment (the list's wording follows the locale; the fixtures are the untranslated form) | `9A/H-07` steps .1, .2, criterion 1 (three equal channel figures) |
| That the real interface's card id fits the kernel form the schema allows (an id with `-` would not be listed) and its product name passes the text rule | `9A/H-07` .2 |
| Identity after a re-plug on the same port; the port text on another port | `9A/H-07` .5, .6, .8, criterion 5 |
| The refusal on a real card | `9A/H-07` .4, criterion 4 |
| Which of the listed channels are sockets: the listing cannot tell a loopback channel from a microphone input and offers both | `9A/H-07` section 5, last paragraph (written down by the bench) |
| That the native format and the one rate chosen here open, on both inputs, with all channels | `9A/H-08` |
| The hardware parameter dump of an onboard card (no bench observation exists for it; the product targets USB cards) | not in the package; `factsSource` shows it |

## 7. Requirements

| Identifier | State |
|---|---|
| S3-2 (the named refusal is raised) | closed on fixed listings; on hardware `9A/H-07` |
| P12-F04 (static rules amended by list, row 64's entry) | closed: SR-1 entry 3 |
| P12-F05 (b) (card listing as an extra, `enumerate()` unchanged) | the listing exists; the registry member `audioCards()` is row 85 |
| AD-07 (1), (2) | the adapter half built here; row 155 states the text rule finally, row 66 builds the argument from the two integers |
| AD-07 (3), (4) | not here: single flight and spacing are row 70, the match of a stored row is rows 70 / 156 (`usbId`, `usbPort` are supplied) |

Requests left in `delegation_progress/file_requests.md`: the barrel exports (non-blocking); the A-5 finding against row 47's file.

---
*Generated: 2026-10-13*
