# coder-execution - fix wave K, driver M2 (apps/mobile, no device)

Status: **needs-review** (three items: G81b-09 member not delivered; G94b-10 and G94b-13 are in M1's / the Core's area - requests filed). Everything else: complete, tested.

Note: `implementation/143_fix_wave_k_m2.md` (findings table, key sweep, facts sweep, decisions, seams, checks for the test runner, re-drive list, file list).

Request lines filed in `file_requests.md`: 17:37:07Z (S2: revision `reason`), 17:51:51Z x4 (M1: G94b-10; controller / media-stream owner: one row per stop; M1: G94b-07 one line; M1: G94b-13).

Reds that are not M2's at the time of writing: `features/evidence/live-evidence-static.test.ts` "reads the folder" (M1's new `sealed-player-i18n.ts`); typecheck `wave-k-m1-seek.test.tsx` (3 errors); lint `sealed-player.tsx:238`.

No git write. No device, emulator, Gradle or lane call. No file under `.data/`. No install.
