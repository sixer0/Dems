# Row N5b - complete (2026-10-14)

Record: implementation/n5b_door_cap_and_group_kill.md.

- Door: optional `outputCapBytes` (default 64 KiB unchanged; max `PRODUCTION_OUTPUT_CAP_MAX_BYTES` 1 MiB, above = `OUTPUT_CAP_NOT_ALLOWED`, nothing started) and optional `processGroup` (detached + kill of the negative PID). No existing caller passes either; only the macOS listing runner does (all three rows, each its own cap).
- USB tree 512 KiB = `MACOS_USB_TREE_TEXT_BYTES` (one constant, macos-plist.ts) for the row cap and the reader bound; reader nodes 8,192 -> 65,536 (DRIVER DECISION). Reader parse 128,941 chars 1.16 ms / 520,149 chars 4.55 ms: linear.
- Group kill: without option 1 of 1 forked child survives; with it 0 of 2; unrelated processes 2 of 2 alive.
- Mutations M1-M4 RED. Checks: unit green except NB's pin at capture static :1780 (not mine); composition db 15/15; tsc 9 errors none mine (N13 protocol); lint 0 errors.
- Also done: C134 (SR-15 (1) N9 entry), C136 (S06 import entry).
- Request left: credential.ts `USER_PART` quadratic blanking (blocking for hardware) with an exact linear regex.
