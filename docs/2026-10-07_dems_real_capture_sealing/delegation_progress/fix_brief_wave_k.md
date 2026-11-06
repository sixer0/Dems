# Fix wave K — common brief (controller, 2026-10-11, decision D223)

Tree: commit `57b80a9`. Wave K fixes the findings of the five re-gates:
`gateway_check/09b_m4_regate.md`, `10c_m5_regate.md`, `11b_m6_regate.md`,
`12b_m7_regate.md`, `13b_m8_regate.md`. Rulings: decisions D220..D223.

## Rules (binding; on top of `fix_brief_wave_h.md` and `driver_rules_d94.md`)

1. No git write of any kind (no add, commit, stash, restore, checkout). No formatter
   `--write` over a file you did not change.
2. Declare your files in `delegation_progress/file_claims.md` BEFORE writing (one line,
   "wave K <driver>"). A file claimed by another wave K driver is not yours: write a line
   to `delegation_progress/file_requests.md` and continue with the rest.
3. Contract totals do not move: 97 operations (36 GET / 61 POST), 67 audit types,
   schema 6 / dbc-7, no migration. Additive OPTIONAL members only, each with an exported
   contract example in `packages/shared`; consumers' tests IMPORT the example and read the
   member BY THE NAME written in `delegation_progress/contract_wave_k.md` (producers write
   their names there within their first 20 minutes; consumers poll that file).
4. Targeted tests only (your files, one run; a second run only after a fail), typecheck
   and lint of the workspaces you touched. Whole suites belong to the test runner: list
   them under "Checks for the test runner".
5. Every fix has a test that fails without it. Where a red-first run is impossible without
   git, keep a control case in the same file.
6. Never read `.data/pg*.env`; PostgreSQL 127.0.0.1:4432 only through the project's
   scripts; never touch ports 5173-5175, 8000, 5432; no installs.
7. Never write the camera stub's fixture account, a password, a token or key material into
   a note, a test name or a log you keep.
8. No LOCAL_DEVICE source is ever selected, pre-checked or started; no attendance variable
   is set; no recording is played aloud; biometrics are not touched.
9. A manifest, an audit row and a screen state only FACTS the Core has. A fact the Core
   does not have is "Not reported" / absent, never a constant.

## Environment during the wave

- Lane 1 is STOPPED (driver S2 stops it at its start) so that db tests have slots.
  Nobody starts it.
- Lane 2 (Core 4422, web 5177) and the tablet `emulator-5556` stay UP and belong to driver
  M1 ALONE, for diagnosis on the device. Lane 2's Core runs the code it booted with; it
  is restarted only by M1, and only after S1 and S2 say in `contract_wave_k.md` that
  their server work is at a consistent point. Nobody else calls lane 2.
- Metro serves the JS as it is edited: M1 may see M2's edits arrive on the device.
- The phone `emulator-5554` is idle; nobody uses it.

## Drivers and areas

| Driver | Area |
|---|---|
| S1 | core-server engine / faults / rehydrate, sealing pipeline + sealing host, manifest assembly, capture session + worker arguments, transcript assembly, `scripts/lane` |
| S2 | core-server modules: transcript revisions, evidence verify / export routes, audit device plumbing, STT config; `packages/shared` sim + api for those |
| W | `apps/core-web` |
| M1 | `apps/mobile`: evidence player, session summary, the animation / pending-control runtime (mount warnings) — WITH the tablet |
| M2 | `apps/mobile`: everything else named in its prompt — NO device |

## Deliverables of each driver

Code + tests; a note `implementation/<nn>_fix_wave_k_<driver>.md` (per finding: cause with
file:line, change, test output line, "Checks for the test runner", "re-drive list" for the
re-check); a final response with status (complete | blocked | needs-review), the files
created / changed, decisions for the controller, open items.
