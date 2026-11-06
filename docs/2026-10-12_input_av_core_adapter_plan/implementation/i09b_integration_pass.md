---
task_id: 2026-10-12_input_av_core_adapter_plan
row: I-9b (integration pass, track D; a fixed list of 11 items)
date: 2026-10-13
agent: coder-execution (driver of pass I-9b)
tier: T3
builds_on: implementation/i09a_integration_pass.md; h2_helper_r119_fixes.md; v6b_acceptance_clock_guard.md; w4_live_readers.md; r1b_video_absence_signed.md; test/h3_helper_parser_captures.md; delegation_progress/file_ownership.md ("D3 landed")
status: needs-review - 7 items done, 2 already done / nothing to move, 2 SKIPPED as larger than a few lines (items 3 and 4); every check green; three driver decisions to confirm
---

# Integration pass I-9b

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`, `SH` = `packages/shared`, `WEB` = `apps/core-web`. No real device, no network command, no credential, no schema change (pins stay `[13, 'dbc-14']`, 30 migration files). Throw-away databases only; the instance on 4423 / 5178 was not touched.

## 1. Per item

| # | Item | Result | What was done, and its result line |
|---|---|---|---|
| 1 | `boot-checks-runner.test.ts:81` red | DONE | The rule: the core exports ONE boot function beside the registration. `SYSTEM_BOOT_SIGNING_DETAIL_RULES` is no function; it matches the test's word search by the audit type's name. The pinned list gained the name with its reason, and a second line holds the rule itself by TYPE (the exports that are functions are the two). Export not removed. `boot-checks-runner.test.ts` green |
| 2 | the client knows 36 of 41 helper codes | DONE | `host-alias/protocol.ts`: 38, 46, 47, 48, 55 with the helper's names. `host-alias/caller.ts` (the table that maps each code to a named Core refusal `HELPER_<NAME>` and its kind): 38 = INSTALLATION, 46 / 47 / 48 = HOST_STATE, 55 = TOOL; effect NOT_DONE for all five (the helper answers them before an address is set). The static test EXISTED (`caller.test.ts`, "the table is the helper's ... read from the delivered file") and was red; it passes. Pins by delta: 36 -> 41 (four lines of `caller.test.ts`), connections 72 -> 82 (`src/__tests__/host-alias-socket.test.ts:182`). Helper NOT edited: SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` at the end |
| 3 | journal: `NOT_MARKED` on a removal | SKIPPED | Larger than a few lines, and it needs two files that are not the journal's: see section 3 |
| 4 | the demo reset's kept tables | SKIPPED | The requests agree; applying them is reset code and eight pin files: see section 3 |
| 5 | operation 109 answers the clock reason | DONE | The two CAN be told apart from the statement's result, and already were: an ERROR 23505 by the in-force index = "in force"; NO ROW from the statement's own condition = "clock behind". `service.ts`: `ACCEPT_CLOCK_BEHIND_REASON` = `INSTALLATION_CLOCK_BEHIND_RECORD`. Four pins moved (two in `service.test.ts`, two in `routes.db.test.ts`, one of them the case "one in force AND the clock behind it": the condition writes nothing before the index is asked, so the clock reason is the true one there) |
| 6 | stale schema pins | NOTHING TO MOVE - 0 lines | Search of `apps` and `packages` for `dbc-9` to `dbc-13`, the `[8..12, 'dbc` forms, `schemaVersion` / `schema_version` 8 to 12 and a migration count other than 30: every hit is a file that states an OLD version on purpose (`test/db/set9..set14.db.test.ts`, `contract-v8..v12-delta.ts`, `contract-inventory*`, `catalog.db.test.ts`, `db/schema/*`, `db/commands/migrations.ts`, the migration files themselves) |
| 7 | planted control for `aliasTransport`, `aliasInterfaceFile` | ALREADY DONE | `capture/__tests__/static.test.ts:1975` plants `cardPrograms`, `aliasTransport`, `aliasInterfaceFile` and `commissioningInputs` in one loop (rows 106b / 106c, 111b) |
| 8 | the helper's suite reads the captures | DONE | New class `CapturedTexts` (5 cases) in `scripts/host/netalias/test_dems_core_netalias.py`; section 2. Suite: 75 -> 80 tests, OK. Helper unchanged |
| 9 | `bitrateMbps` nullable | DONE, with a driver decision | `SH`: `CamerasSliceSchema` (`state-slices.ts`), the video track status (`core-api.ts`), `CameraStatus` (`sim/types.ts`), `ApiVideoTrack` (`sim/api.ts`). `WEB`: `measuredFiguresShown` reads the member (null is never drawn, in any mode); tile and drawer hold the null. Section 4, decision 1 |
| 10 | the F3-06 sentences into the shared tree | DONE | `SH/src/i18n/en/common.ts`: `captureConnect.networkNotConfigured`, `.networkNotConfiguredDetail`, text unchanged. `WEB/src/i18n-web.ts`: the two web members are a reference to them; `camera-connect-dialog.tsx` reads the shared keys |
| 11 | a report line for `audio.absentOnRestart` | DONE | `SH/src/evidence-verify/types.ts`: `VERIFY_NOTICE.AUDIO_ABSENT_ON_RESTART`, `audioAbsentOnRestartReport`; `verify.ts`: the line, only when the member is present; `api/evidence.ts`: one sentence of the notice description. A package without the member has the notices of before (held by the new case) |

## 2. Item 8: how the captures are fed

The suite never imports the delivered file. The new class executes the text of a TEST COPY (the bench's constants: the two tools are the recording doubles, every path in the temporary folder) without its last line, the call of `main`, and calls the helper's own functions.

| Capture | Function | Verdict held |
|---|---|---|
| `arping/` 10 texts | `conflict_verdict(status, bytes, interface, address)` with the interface, address and exit status of the capture | the table of `captured/README.md` = section 5 of `test/h3_helper_parser_captures.md`: FREE x3 (one of them the no-carrier text), ADDRESS_IN_USE, CONFLICT_RESULT_UNKNOWN x4, CONFLICT_CHECK_FAILED x2 |
| `ip/` 3 listings + the route text | `default_route_interfaces`, `host_state` (the listing is the standard output of the `ip` double, byte for byte), `refuse_unless_askable` per port | section 4 of the record: 14 port states over the three listings; every flag word read; lifetimes 4294967295, 300, 288 |
| the same, through the helper as a process | `add` on the captured `eth0` with the captured free text: OK, the exact vectors; `add` on `h3nc` (no carrier) with the captured free text planned: `INTERFACE_DOWN`, the conflict tool never started (observation O-1) | |
| `dpkg/` two record pairs | `_expected_conflict_tool` | byte for byte with a stand-in program: refused (state 7); the same records with ONE field replaced, the checksum, by the stand-in's own: passes (the form of state 1); the other package's records: refused (states 5, 6) |
| `dpkg/dpkg_S_usr_bin_arping.txt` | no function reads it | equals `<CONFLICT_PACKAGE>: <ARPING_TOOL>` of the delivered constants |
| `dpkg/ls_ln_dpkg_info.txt`, `README.md` | no function reads them | listed as "not an input"; one case holds that every file under `captured/` is read by a case or is on that list (21 files) |

NOT PROVEN by this: the positive program check on the real program file (it is not in the repository; the checksum of the capture is its own) - installation step `check`, hardware check `9A/H-25`.

## 3. The two skipped items

**Item 3.** The ruling asks: close as `NOT_ADDED` only when the row's own add never got "added"; else `EXPIRED` if past its time, else the removal's reason "with the helper's code in the audit detail". (a) No durable fact says an add was confirmed: `expires_at` is written at the intent and re-dated at the result; the journal's memory does not survive the restart after which the boot sweep meets `NOT_MARKED`; `HostAliasUnit` writes audit entries and reads none. (b) The rule of `HOST_ALIAS_REMOVED` (`CS/src/core/audit-details.ts:528`) is a closed list without a member for a code, and the audit writer refuses another key. Needs a ruling (a column, or a read of the row's `HOST_ALIAS_ADDED` entry) and the audit vocabulary. Nothing was edited; the close is as before.

**Item 4.** Requests read: rows 51, 99 + 192, 114, 117 (and 17, 51b, 108). They AGREE on the four tables of the list; rows 17 and 51b ask `capture_audio_inputs` (T-45) too, which the list does not name. Not applied because it is not a list edit: `capture_device_streams` has a two-column key and `kept()` carries by one key column (`table.key` is read at six statement sites of `kept-tables.ts`); row 108 asks a reload of the network reader after the reset's commit; the set and the rebuilt count are pinned in eight files (`reset/__tests__/kept-tables.test.ts`, `static.test.ts`, `reset.db.test.ts`, `m2-guard-keepset.db.test.ts`, `m4-sec-reset.db.test.ts`, `m2-sttcfg-seed-kept.db.test.ts`, `modules/demo/__tests__/reset.db.test.ts`, `test/support/reset.ts`). A row for the reset module.

## 4. Driver decisions (for the controller to confirm)

1. **Item 9: the web's mode rule stays beside the null rule.** A Core in real capture still serves the simulator's literal 9 (`CS/src/modules/devices/status.ts:234`; the `cameras` slice). Going by null ALONE would draw "9 Mbps" beside a real camera again (finding R-01). So: null is never drawn, in any mode; in real capture the figure is still never drawn. The mode's part goes when the Core states null (request line).
2. **Item 2: the kinds of the five codes** (38 INSTALLATION; 46, 47, 48 HOST_STATE; 55 TOOL) follow the helper's own grouping of its table; all five are NOT_DONE.
3. **Item 5: a clock behind an acceptance that IS in force answers the clock reason**, not "in force": the statement's condition writes nothing before the index is asked, and correcting the clock is what has to happen first.

## 5. Files changed

| File | Change |
|---|---|
| `CS/src/engine/__tests__/boot-checks-runner.test.ts` | the pinned list + one line (item 1) |
| `CS/src/capture/host-alias/protocol.ts`, `caller.ts` | five codes, five kinds, comments (item 2) |
| `CS/src/capture/host-alias/__tests__/caller.test.ts`, `CS/src/__tests__/host-alias-socket.test.ts` | pins by delta, two lines for the five |
| `CS/src/modules/capture-config/installation-acceptance/service.ts`, `__tests__/service.test.ts`, `__tests__/routes.db.test.ts` | the reason; pins (item 5) |
| `scripts/host/netalias/test_dems_core_netalias.py` | one block appended: class `CapturedTexts` (item 8) |
| `SH/src/api/state-slices.ts`, `api/core-api.ts`, `sim/types.ts`, `sim/api.ts` | `bitrateMbps` nullable (item 9) |
| `SH/src/i18n/en/common.ts` | two sentences (item 10) |
| `SH/src/evidence-verify/types.ts`, `verify.ts`, `SH/src/api/evidence.ts` | the notice, its line, one sentence (item 11) |
| `SH/test/evidence-package.test.ts`, `evidence-verify.test.ts` | one case; the notice list +1 |
| `SH/openapi/openapi.json` | regenerated ONCE by the repository's generator (`npm run openapi:gen`): the two nullable members and the description sentence; 110 operations |
| `WEB/src/features/devices/source-state.ts`, `camera-tile.tsx`, `device-drawer.tsx`, `camera-connect-dialog.tsx`, `WEB/src/i18n-web.ts`, `__tests__/source-state.test.tsx` | items 9, 10 |
| docs | this record; `delegation_progress/row_i09b.md`; one line each in `file_claims.md`, `file_requests.md` |

## 6. Checks (one run each; the socket test twice, its count pin was mine to move)

| Check | Command | Result |
|---|---|---|
| typecheck | `tsc --noEmit` in `SH`, `CS`, `apps/mobile`; `tsc -b` in `WEB` | all exit 0 (the web once red on `camera-tile.tsx:167`, the null handed to the unit text: held) |
| static set of the Core | `vitest run --project unit test/static` + the 28 `__tests__/static.test.ts` | `Test Files 45 passed`, `Tests 778 passed` |
| touched and notice-affected unit tests of the Core | boot-checks-runner, host-alias caller / lifecycle, acceptance service, sealing pipeline, evidence-export, evidence-verify, devices, sealing-host, evidence | `Test Files 34 passed`, `Tests 781 passed` |
| `host-alias-socket.test.ts` | sandbox off (a local socket) | first `1 failed, 17 passed` (72 -> 82); second `18 passed` |
| database, under `.locks/db-migrate.lock` | the acceptance pair (`contract.test.ts`, `rbac-matrix.test.ts`), acceptance `routes.db.test.ts`, `lifecycle.db.test.ts` | `Test Files 4 passed`, `Tests 107 passed`, `0 remain` |
| composition on PostgreSQL | `capture-composition.db.test.ts` | `15 passed`, `0 remain` |
| shared, after the regeneration | `vitest run` in `SH` (the openapi tests among them) | `Test Files 105 passed`, `Tests 2892 passed` |
| web | source-state, camera-connect-canary, camera-no-preview, camera-connect, real-core-facts | `Test Files 5 passed`, `Tests 145 passed` |
| the helper's suite | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` | `Ran 80 tests ... OK` (75 before) |
| the helper's hash | `shasum -a 256`, `shasum -c SHA256SUMS` | `1e758a24...c7d015b1`, three files OK |

Counts after: 110 operations, 83 audit types, 15 permissions, 51 action operations - none moved. Verify notices 6 -> 7 (item 11).

Reds seen that are not this pass's: none in what was run. The heavy-host lock was never needed (nothing started the worker, a relay or a port).

## 7. Rules kept

Existing files were changed with the Edit tool only; new files with Write. `openapi.json` was written by the repository's own generator. Nothing staged or committed. The helper file, its build step and `SHA256SUMS` were not edited.

---
*Generated: 2026-10-13 19:00 WIB*
