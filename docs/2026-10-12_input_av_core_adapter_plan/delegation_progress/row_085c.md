# Row 85c - the remainder of the production composition

Status: **needs-review**. Record: `implementation/085c_composition_remainder.md`.

| Member | State |
|---|---|
| (b) runner of the card listing program | built: fixed row `/usr/bin/arecord -l` through the production door; Linux no longer answers `LISTING_PROGRAM_NOT_HANDED_IN`; macOS keeps the named answer |
| (c) audio helper key | built: `DEMS_CAPTURE_AUDIO_HELPER` -> `captureAudioHelperPath` -> `dependencies.audio.helperProgram` |
| (d) watch fault sink, C60 (2) | built: `watchFaultSinkOf`; the camera watch clears only what its own raise raised |
| (e) `sourceLost` attempt-awareness | built: option `superseded`, answered from the supervisor's phase `RESTARTING` |
| (f) wider device read | built: capability by class, stored profile list of a camera |
| (g) admission after the boot | at the door: the builder admits through `admitDevice` of an adapter; neither built adapter has it (request) |

Checks (apps/core-server): unit last run `1 failed, 33 passed (34)` files, `2 failed, 747 passed (749)` tests - both reds in `capture/__tests__/static.test.ts` from sources of row 143b in flight; database `capture-composition.db.test.ts` 7 of 7 and `fence.db.test.ts` 44 of 44, `0 remain`; typecheck 0 errors in this row's files, errors in files in flight of rows 143b, 108, 109 and the shared contract.

Requests: four lines in `file_requests.md`. Driver decisions: DD-1 to DD-11 of the record. Edit tool only for existing files: kept.
