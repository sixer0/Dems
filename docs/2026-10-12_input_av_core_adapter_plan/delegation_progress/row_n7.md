# Row N7 - the platform seam of the card listing (wave 12, agent N7)

Status: complete. Record: `implementation/n7_macos_platform_seam.md`.

- Seam (`capture/fence/production-parts.ts`): `linux` unchanged; `darwin` = row N6's listing over a runner of the three fixed rows of row N4's table through the production door (`macosListingSourceOf`, `macosCardEnumeratorOf`, single-flight, nothing kept after a listing settles); other platforms the named "not available". A darwin Core without an audio helper: `LISTING_PROGRAM_NOT_HANDED_IN`, nothing started.
- Composition: `hostCardEnumeratorOf({ platform: input.platform, door, timers, helperProgram: ports.audioHelperProgram })` - the same object to `provideEnumerator` (operations 98 / 99), the audio bundle and the microphone watch.
- Caps (measured 2026-10-14): USB tree 45,342 B / 5 devices -> cap = the door's 65,536 B (margin 20,194 B, about 2 devices; not narrowable without losing the interface class; raising it = N5 + N6 + controller); system audio 1,471 B -> 32 KiB; capture list 613 B -> 32 KiB.
- SM-10 (3): real `system_profiler` forks one child; 0 of 7 survived a kill. A stand-in's forked child survives the door's kill (door's limit; request to N5); the runner no longer waits for it.
- Real-text run through the product: 2 of 2 listings ok, 1 card (6 channels, 96,000 Hz stated, no serial, port eight hex), 0 undecided, 1 passed over, 2 capture entries, ~0.3 s; operation 98's own service function answers 1 card, schema-valid.
- Checks: composition unit 76 passed + 1 skipped; composition db 15/15; audio-cards db 22/22; static + adapters + composition 717 passed, 5 red NOT mine (N9's `usb-audio-macos.ts` x4, N13's guard tags x1); typecheck: 15 errors, none in this row's files.
- Static: one named case "row N7"; three existing pins moved (SR-15 (1), 85c (d), 111b (c)) - confirmation asked.
- Requests: 6 lines in `file_requests.md` (N9 words + its reds; N5 group kill; tree cap ruling; static confirmation; N13 red; README words). Edit tool only for existing files; nothing committed.
