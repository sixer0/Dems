# row W6 - complete (2026-10-14)

Record: `implementation/w6_clients_words_and_op108.md`.

- (1) Operation 108 is wired in the web console. "Test connection" appears under the NO_PROFILE sentence of a selector row and in the drawer of a production camera. It sends no body and no credential. A `PROFILES_STORED` answer brings the profile into the selector without a reload, and the camera can then be saved to Camera 1/2 (page test). `STREAM_PROFILE_DIFFERS` and every refusal have their own words. The NO_PROFILE sentence names the remedy in both apps; the tablet's points to the web console, because operation 108 is web-console only.
- (2) `CAMERA_PROFILE_WITHOUT_STREAM` closes the web list pin (:586 green) and is in the tablet's `PROFILE_REFUSAL_REASONS`. A null stream state reads "Stream not read" on the web and "Not read" on the tablet, never Live, Lost or Online. This covers the selector line, the No-preview tile `data-state`, the drawer / detail, and the tablet sheet (its LIVE fallback is gone). Operations 44/46 have no client.
- (3) `onvifPorts` is the seventh setting: one field, the stored order, validated, sent whole only when the order or entries differ. The interface hint says "letters of either case"; `enP3s0` is sent.
- Checks: web 42 files / 585 passed, tsc 0, oxlint 0; tablet 86 suites / 1039 passed, tsc 0, eslint 0. 11 mutants RED. 2 expectations moved (the NO_PROFILE sentence, by C117).
- New request line "row W6" (controller): the remedy "adopt the camera again" has no path from a screen.
- Edit tool only for existing files. Nothing committed, nothing left running.
