---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 155
milestone: M4 / AD-07
date: 2026-10-13
agent: coder-execution (batch 6, agent D)
tier: T3
requirement: AD-07 point 1 (one function before a string of a card listing leaves the adapter); S13-12 (b) for the card listing
status: complete
---

# Row 155: the card text rule

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `AUD` = `apps/core-server/src/capture/adapters/audio`.

## What was changed

| File | Change | Description |
|---|---|---|
| `AUD/card-listing.ts` | modify | The ONE function `cardListingText(kind, raw)`, its rule table `CARD_STRING_RULES`, the closed set `CardStringKind`, the field table `CARD_LISTING_STRING_FIELDS` with the type `CardStringFieldsOf`, the private exit `passCardStrings`. The three rule functions of row 64 (`cardText`, `cardUsbId`, `isKernelCardId`) are now calls of the one function. The four producers of a result that carries text build it through the exit |
| `AUD/__tests__/card-listing.test.ts` | extend | one new block of 5 cases (`row 155: ...`); the export pin gains three names. No earlier case was changed |

Not edited: `card-listing-reader.ts`, `alsa-config*.ts` (agent H), the barrel `adapters/index.ts`, the three capture static files (they pass unchanged; the parser still imports the same two modules), `packages/shared`.

## What row 64 left, and what is different now

| Row 64 | Now |
|---|---|
| three rule functions and one pattern applied inline (the USB port) | one function; the five patterns are applied in one table and nowhere else in the file (a test reads the source) |
| `parseCaptureDeviceList` answered the card name of the list RAW (its interface said so); `buildCaptureCard` applied the rule later | the card name has a kind and is passed where it is produced. This was the one string that left an exported function unchecked |
| `formats`, `nativeFormat`, `factsSource` were words of the file's own lists by construction | they have a kind too (`FORMAT`, `FACTS_SOURCE`) and pass the same function; a word outside the list is dropped, also when a caller of the exported composer hands one in |
| nothing said which members are strings | `CARD_LISTING_STRING_FIELDS` names the kind of every string member of `ListedCaptureDevice`, `PresentCard`, `CardUsbIdentity`, `CaptureCard`; each entry `satisfies` the string members of its interface |

Behaviour on every fixture of row 64: unchanged (its 41 cases pass without an edit).

## The rule

`cardListingText(kind, raw)` answers the text when it is inside the rule of its kind, else the kind's fixed replacement. It never cuts and never cleans. A value that is no string, a text longer than a line of a listing (512), and a kind that is none are refused before a pattern reads them.

| Kind | Closed character set and cap | Replacement |
|---|---|---|
| `NAME` | printable ASCII, 1 to 64 after the spaces at both ends are dropped, no `<`, no `>` | the word `UNKNOWN` |
| `USB_ID` | four lower-case hexadecimal digits, a colon, four more | `0000:0000` |
| `CARD_ID` | letters, digits, underscore, 1 to 32 (the kernel's form) | none: the entry is not listed (row 64, DD-4) |
| `USB_PORT` | letters, digits and `: . _ -`, 1 to 64 | none: the member is `null`, "no port offered" |
| `FORMAT` | one of `S32_LE`, `S24_3LE`, `S24_LE`, `S16_LE` | none: dropped from the list |
| `FACTS_SOURCE` | one of `STREAM`, `HW_PARAMS`, `ASSUMED` | none: the card is not listed |

The patterns of `NAME`, `USB_ID` and `CARD_ID` are the contract's (`@dems/shared/api`), the same the answer's schema holds; the last two equal the CHECKs of the stored row (read from the migration by a test).

## The test that a string member cannot bypass the rule

1. BY TYPE. `CardStringFieldsOf<T>` is "one kind for every member of `T` that holds a string, a string or null, or a list of strings; no other key". The table is written `satisfies` that type for each of the four interfaces, so a string member added to an interface without a kind fails the typecheck of the workspace. The test holds four controls that MUST fail to compile (`@ts-expect-error`: a plain string, an optional or nullable one, a list of strings, a closed word), one control that must compile (number, boolean and number-list members need no kind) and one for a surplus entry. An unused `@ts-expect-error` is itself an error, so the controls are checked by the typecheck.
2. BY CONSTRUCTION. Each of the four results is built at one place, by `passCardStrings` with its table (a test reads the source: exactly four calls, one per interface). The exit applies the one function to every member the table names.
3. BY A WALK. Over 15 hostile texts put in every place a device or a host can write one (the name of the list, the kernel's table, the product, the port, the USB id file, a format word), every string of every result is collected, at any depth, and each must (a) stand in a member the table gives a kind and (b) be what the one function answers for that kind, unchanged. The same for the exported composer handed raw text. Six controls show the walk finds a member without a kind (top level and nested), and a text that did not pass (a name, a tag, a format word, a USB id).

## Verification (the row's cell)

| Asked | Where | Result |
|---|---|---|
| listings with control, bidirectional and zero-width characters and an oversized name: the fixed word in the answer | "the answer and the STORED ROW ..." and the walk | `product` = `UNKNOWN` for each; the answer passes `CaptureAudioCardSchema`; the raw text does not |
| ... and in the stored row | the same case | the values a registration writes from the card (`usbId`, `cardId`) pass the two CHECKs of `capture_audio_inputs` (migration `0015`, read as text); the raw text fails the USB id CHECK. See "unproven" for the stored row itself |
| a malformed USB id is replaced | the same case, last lines; row 64's case with 8 forms | `0000:0000`, the card stays a USB card |

Commands, from `apps/core-server`:

```
npx vitest run --project unit src/capture/adapters/audio/__tests__/card-listing.test.ts src/capture/adapters/audio/__tests__/card-listing-reader.test.ts --maxWorkers=2
  run 1: Test Files 2 passed (2); Tests 51 passed (51)
npx vitest run --project unit src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static/credentials.test.ts src/capture/adapters/audio/__tests__/ --maxWorkers=2
  Test Files 7 passed (7); Tests 199 passed (199)   (the capture static lists read, not edited)
npx tsc --noEmit
  run 1: one syntax error in packages/shared/src/sim/api.ts(417) (agent A, in flight): no semantic check ran
  run 2: 1 error, this row's: card-listing.ts(214) TS2322 (a spread of the generic result); fixed by one cast
  run 3: exit 2, 3 errors, all packages/shared/src/sim/api.ts(717, 727, 732) "Cannot find name 'CaptureSelectorSlot'" (agent A, row 165, in flight); 0 errors in apps/core-server
npx oxlint on card-listing.ts and its test: exit 0
final run of the three rows' unit files (card-listing, status, credential-reader): Test Files 3 passed (3); Tests 119 passed (119)
```

The typecheck of the workspace is therefore NOT green at this moment, by a file of `packages/shared` this agent may not edit; no error is in a file of rows 150, 145 or 155. The controller's run after agent A's rows will show exit 0 or name a line.

## Double, and what stays unproven

- The double is row 64's: a table of fixed texts in the forms of a Linux host; no host and no card.
- THE STORED ROW ITSELF is not written by this row. The store is row 70 (`src/modules/capture-audio-cards/`, in flight in this batch): its service copies `card.usbId` and `card.product` of the listing as given, which is the value proven here. That a registration of a card with a hostile name stores the fixed id and puts the fixed word where it puts a product is a database case of row 70's own test file (one request line).
- On hardware: that a real interface's product name and card id pass the rule (`9A/H-07` .2), as row 64 recorded.

## Driver decisions

1. DRIVER DECISION: the one function answers `string | null`. A fixed WORD stands in where a member must say something (a name; the id of a card that is a USB card). For a card id, a port, a format word and a facts source it answers nothing, and the exit turns that into "entry not listed", `null`, "dropped", "card not listed". A made-up word there would be a claim: a card id is the key of a registration and a port is used to tell two cards apart. This keeps row 64's behaviour (DD-3, DD-4) exactly.
2. DRIVER DECISION: the three functions of row 64 stay exported as named calls of the one function (other files and tests use them); the rule itself exists once.
3. DRIVER DECISION: closed words of the file's own lists (`FORMAT`, `FACTS_SOURCE`) are strings of the result and got a kind, although no device can write them: the type test then has no exception list.
4. DRIVER DECISION: a text over 512 characters (the longest line a listing is read with) is refused before a pattern runs.
5. A registry id a CALLER hands in (`CardInputHolder.deviceId`, `CardAllocation.heldBy`, the id in `AudioInputBeyondCardError`) is not text of a listing and is not in the table.

## For the controller

- A USB card whose id file is malformed is listed with the fixed id `0000:0000`. Two such cards then carry the same id. Whether row 70 may REGISTER a card with the fixed id, and how rows 70 / 156 match a stored row whose id is the fixed one, is theirs to decide (AD-07 (4)); row 64's DD-3 already named it. One request line.

## Requests left in `file_requests.md`

One line, not blocking: row 70's database case for the stored row, and the question of the fixed id above.

---
*Generated: 2026-10-13*
