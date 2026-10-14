# Row N6 (wave 12, track D) - the card listing of a macOS host

- Agent: N6 (coder-execution). Date: 2026-10-14. Head 1fbeada7.
- Status: **complete**. Record: `implementation/n6_macos_listing.md`.
- PURE code: no process started by the product code, no device opened, no file read. The three listing programs were run ONCE each by a shape script (decision U23 (3)); nothing of their output was kept or written.

## Files

- New, `apps/core-server/src/capture/adapters/audio/`: `macos-plist.ts`, `macos-usb-tree-reader.ts`, `macos-system-audio-reader.ts`, `macos-helper-list-reader.ts`, `macos-card-tie.ts`, `macos-card-listing.ts`.
- New tests: `__tests__/macos-card-listing.test.ts` (43 tests); 21 text fixtures under `__tests__/fixtures/macos/` (synthetic names, serials, locations).
- Edited with the Edit tool: `card-listing.ts` - the word `SYSTEM_PROFILE` in `CardFactsSource`, and "three" to "four" in its comment.
- Docs: this file, `implementation/n6_macos_listing.md`; one claim line in `file_claims.md`, two lines in `file_requests.md`.

## What the next rows build on

- `createMacosCardEnumerator(source: MacosListingSource): MacosCardEnumerator` - `list()` in the Linux shape (`CardListing`), `listTied()` with the undecided devices.
- `MacosListingSource`: `usbTree()`, `systemAudio()`, `captureDevices()` - three texts, no argument.
- Port path: the location id as eight lower-case hex digits; card id `usb_<those digits>`. The column `capture_audio_inputs.usb_port` accepts it.
- Undecided reasons: `NAME_NOT_TIEABLE`, `NAME_SHARED`, `NO_SYSTEM_INPUT`, `NO_CAPTURE_ENTRY`, `LISTS_DISAGREE`, `TRANSPORT_NOT_USB`, `NO_USB_DEVICE`. Whole listing: `USB_TREE_UNREADABLE`, `SYSTEM_LIST_UNREADABLE`, `CAPTURE_LIST_UNREADABLE` (raised by `list()` as `MacosCardListingError`).

## Checks

- My tests: `Tests 43 passed (43)` (first run 42 + 1 red of my own new test, an off-by-one of my depth bound; fixed).
- Audio adapter suite and the static sets: `Test Files 27 passed (27)`, `Tests 584 passed (584)`. No red.
- Typecheck of `@dems/core-server`: clean (second run; the first had one typing error in my test).
- Six mutations seen RED (10 tests), reverted.

## Open

- Ten driver decisions (record, section 10) for the controller.
- Not proven: the readers on this Mac's real texts (row N7's first check); a hostile device; the location id across a reboot.
