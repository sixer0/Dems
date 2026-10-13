---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 71
milestone: M4 / WP-07c
date: 2026-10-13
agent: coder-execution (batch 7, agent S)
tier: T3
requirement: schema design 2.3 (column `source_facts`, D-31); S13-13 (no free JSON, device text bounded); AD-07 (1) (one function for every string of a card listing, for the screen and the store alike)
status: complete on doubles; the production adapter does not state its card yet (request to row 67)
---

# Row 71: the card facts of a session's microphones in `source_facts`

## 1. What was built

At a session start the unit that persists `RECORDING` writes the four `session_capture_sources` rows in one statement (MR-S1). Each row now carries `source_facts`: for a microphone slot, a point-in-time copy of WHICH physical device recorded; for a camera slot `{}` (camera facts are WP-04, not this row).

| Piece | Where | What |
|---|---|---|
| The closed key list | `apps/core-server/src/capture/fence/sources.ts`, `MIC_SOURCE_FACT_KEYS` | `model`, `usbId`, `cardId`, `cardDevice`, `inputNumber`, `nativeChannels`, `sampleRate`, `sampleBits` |
| THE TYPE row 17 asked for | same file, `SessionSourceFacts` | a flat map of those keys to a string or an integer; `NO_SOURCE_FACTS` is the one empty map |
| What an adapter states | same file, `AudioCardStatement`, `AudioCardFactsSource` | `product`, `usbId`, `cardId`, `cardDevice`, `inputNumber`, `nativeChannels`, `sampleRateHz`, `sampleBits`; every member is typed `unknown` and read as untrusted |
| The builder | same file, `micSourceFactsOf(statement)` | pure, never throws; the only maker of a non-empty map |
| The read through the adapter | same file, `audioCardStatementOf(adapter, inputId)` | finds the optional member `sourceFacts` by its name |
| The write | `apps/core-server/src/capture-session/statements.ts`, `INSERT_SESSION_CAPTURE_SOURCES` | a sixth column, `$n::jsonb`, per row: 18 parameters instead of 14 |
| The call | `apps/core-server/src/capture-session/index.ts`, `sourceFactsOf` inside `createSessionCapture`, called in `recordingStartedIn` | per source row; camera slot: `{}`; microphone slot: the builder over the adapter's statement |

The fence's index exports the new names (`capture/fence/index.ts`, the existing export of `./sources`).

## 2. The rules of the builder

| Member | Rule | When it fails |
|---|---|---|
| `model` | `cardListingText(NAME, product)`: printable ASCII, 1 to 64 characters after the outer spaces are dropped, no `<` or `>` | the fixed word `UNKNOWN` |
| `usbId` | `cardListingText(USB_ID, usbId)`; a statement with `null` (a card that is not USB) has no key | the fixed id `0000:0000` |
| `cardId` | `cardListingText(CARD_ID, cardId)` | no key (the rule has no word for a card id) |
| `cardDevice` | integer 0 to 31 | no key |
| `inputNumber`, `nativeChannels` | integer 1 to 64 | no key |
| `sampleRate` | integer 8,000 to 192,000 | no key |
| `sampleBits` | 16, 24 or 32 | no key |
| the whole map | at most 2,048 bytes (`SOURCE_FACTS_MAX_BYTES`); the largest map the builder can make measures under 260 bytes | `{}` (unreachable; held so that the column's CHECK is never what refuses a start) |

Only a key of the list is ever written: a statement that carries `password`, `mediaUrl`, a nested object or any other member loses it. The database's three CHECKs of schema set A (flat, no denied key, bound) stay the backstop.

## 3. Why the fence's file and not the session file

`cardListingText` is not exported by the adapter layer's index, and static rule A-5 lets a file outside `src/capture/` name that index only. The fence's source builder (the second place the row's Ownership Area names) is inside the capture unit and may import `adapters/audio/card-listing` by file. So the rule is applied in the fence and the session file only calls it. The four static files pass unchanged.

## 4. Never a refused start

| Case | Stored | Log and error log |
|---|---|---|
| adapter has no member, or answers null (fakes, generated and local sources) | `{}` | nothing |
| the same for an input of kind `USB_AUDIO` | `{}` | one warning `CAPTURE_SOURCE_FACTS_NOT_STATED` (session, device, slot) |
| the member throws | `{}` for that microphone; the other keeps its facts | one warning `CAPTURE_SOURCE_FACTS_NOT_READ` (session, device, slot, `cause`: the code of a `CaptureAdapterError`, else `UNEXPECTED`) |

The message of what an adapter threw is NOT logged: it may quote the card, and the log is a store as well.

## 5. Checks (this Mac; doubles)

| Check | Result line |
|---|---|
| `vitest --project unit` on `capture/fence/__tests__/fence.test.ts`, `capture/__tests__/static.test.ts`, `capture/adapters/__tests__/static.test.ts`, `test/static/imports.test.ts` | `Test Files 4 passed (4)`, `Tests 158 passed (158)` |
| `vitest --project db` on `capture-session/__tests__/session-capture.db.test.ts`, under `.locks/db-migrate.lock`, throw-away databases | `Tests 83 passed (83)` (80 before, 3 new); `0 remain with the run prefix` |
| `tsc --noEmit` in `apps/core-server` | first run: 1 error, not of this row: `packages/shared/src/sim/types.ts(1475,10): TS2304 Cannot find name 'AudioSliceInState'` (agent T was removing that seam at that moment). Re-run after rows 30 and 158: no error |
| `vitest --project unit` on `src/capture-session src/capture-notices src/modules/capture-config src/capture/fence`, the two capture static files and `test/static` (after row 158) | `Test Files 37 passed (37)`, `Tests 573 passed (573)` |

New cases: 17 in the fence file (builder and member), 3 in the session file (the row's two verification points and the controls).

| Verification of the row | Case | Result |
|---|---|---|
| a session start with doubles writes the card facts for both microphones | `r71_facts` | both microphone rows hold their facts, both camera rows `{}`, one `recorded_at`, the session records |
| an oversized product name is cut to the bound | `r71_hostile` | a 300-character name is stored as `UNKNOWN`; measured on the rows: at most 2,048 bytes, no text over 120 characters |

## 6. The double, and what stays unproven

The double is the fake microphone adapter of the adapter layer with a `sourceFacts` member added in the test's registry. No card was listed and no process was started.

Unproven here, for hardware check `9A/H-07`: that the production microphone adapter states the card it actually opens (it has no such member yet: `file_requests.md`), and that the stored identity equals the card found at `open`. The branch `CAPTURE_SOURCE_FACTS_NOT_STATED` has no case: no `USB_AUDIO` input can start a session on this Mac (no production opener in the registry's list).

## 7. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | "Cut to the bound" of the row's verification cell is met as "replaced by the fixed word": an over-long name is stored as `UNKNOWN`, never as its first characters | row 155's rule (the later record): a text is never cut to fit; the brief says only text that passed `cardListingText` may be stored |
| DD-2 | An eighth key, `sampleRate`, beside the seven of schema design 2.3 | the brief asks for "rate and format"; the rate is a column of `capture_audio_inputs` |
| DD-3 | The adapter member is optional and found by name; `adapters/types.ts` is not edited | the contract file has another writer in this batch; the precedent is `start` of a handle before row 20 |
| DD-4 | The member is synchronous and reads no device | it is called inside the unit of work of the start; the row is written before any microphone is opened and cannot be updated afterwards (`0016`) |
| DD-5 | A fact never refuses a start | a recording matters more than its description; the gap is in the error log |
| DD-6 | The seam of row 17 (`SessionCaptureSourceRow` alias, bulk fixture) is left, with a request | the schema and fixture folders are not this row's area in batch 7 |
