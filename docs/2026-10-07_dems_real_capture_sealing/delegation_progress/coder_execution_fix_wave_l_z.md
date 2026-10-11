# coder-execution - fix wave L, closing pass L-Z

Status: **needs-review** (2026-10-11 12:20 WIB). Note: `implementation/156_fix_wave_l_z.md`.

| Item | State |
|---|---|
| 1 selector snapshot of a sealed session - ONE shared helper, shared / web / mobile readers, tests | done |
| 2 the Core's blocked-seal sentences name "Retry sealing", who, where; the device mapping removed | done (engine door bound 400 -> 600: decision 2) |
| 3 mobile leftovers of the one rule (USB, model values, the chip), tablet and phone tests | done (web R-4 closed with it: decision 4) |
| 4 G94c-02 under StrictMode after the `deferEffectStart` move | confirmed by test, no product change |
| 5 whole unit suites once (shared 2605 green; web 2197 green; mobile 5 red -> fixed / attributed, files re-run green), typecheck + lint x4, core-server touched folders + static (831 green) | done; whole mobile not run a second time |

Files: section 6 of the note. Not proven on a device or in a browser. Lane 2 was not called.
