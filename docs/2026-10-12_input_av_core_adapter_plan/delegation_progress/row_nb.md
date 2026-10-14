# row NB (= design 06 row N13, THE BOOT) - complete

Record: `implementation/nb_macos_boot_checks.md`.

- Baselines before (C97/C102): `boot/checks.ts` blob 90b3a1e6 / SHA-256 16a68ef0...7471; `boot/index.ts` blob 63fe763e / SHA-256 8e4d66b2...8b5e - equal to C102, unchanged since 1fbeada7. After: checks.ts unchanged; index.ts blob 8207475a / SHA-256 8eb68ef7...db01 (+10, 0 replaced).
- darwin, REAL_PRODUCTION: step 4e holds the two system listing programs (N4's constants, L1/L2) to the worker's path rule, starts nothing, refuses `CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE` + the rule's word; the boot entry states `microphonePermission: NOT_KNOWN` (no device opened, no privacy database read). Linux / other / development: unchanged.
- Mutants M1-M5 all RED; reverted.
- Checks: unit 382/382 (11 files); fence.db 49/49; test/static 210/210; capture static 79/80 (the moved pin :1780, request to N5b); tsc 15 errors, none mine; oxlint 0 errors.
- Requests: N5b static pin :1780; audit-details rule + writers pin (controller routes); V7b optional example.
- Driver decisions D1-D5 in the record (section 3).
- Edit tool only for existing files; nothing committed; nothing left running.
