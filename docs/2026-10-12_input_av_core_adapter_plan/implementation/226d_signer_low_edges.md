---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 226d
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (driver of row 226d, agent K5)
tier: T3
requirements: review 230 cautions R-5, R-6, R-7 (LOW) and its answers (g), (i); decisions C81, C84; SX-09 (e)
status: complete
---

# Row 226d - three LOW edges of the signer: an id reused by hand, a mark without a look, the null door

Branch `task4/input-av-core-port`, working tree over `0f5d2a8e` with the uncommitted work of the waves. Nothing committed. Existing files were changed with the Edit tool only; new files: this record and `delegation_progress/row_226d.md`. Paths below are relative to `apps/core-server/`.

## 1. The three edges

| Edge | As it was (review 230) | Now | Status |
|---|---|---|---|
| R-5 | `keyIdSpent` looked at entries of THAT id and at the pointer. With the pointer and every entry of an early id removed by hand and a later id left, the first id was provisioned a second time and became active | For an id of the series, ANY entry whose name holds an id of the series AT OR AFTER it spends it (key file, certificate, mark, record, staged pointer, a copy). `provisionSigningKey` refuses `KEY_EXISTS`, nothing written | done in the store; the command's "before its prompts" half is a request (section 5) |
| R-6 | `markSigningKeyCompromised` wrote without the directory look every read has; the command wrote and only then said `MARK_NOT_EFFECTIVE` | The store's function looks at the directory first (`KEY_ABSENT`, `KEY_UNREADABLE`, `KEY_MODE`), also when a mark is already there. The command asks the store what it holds of that key id, SHOWS it, refuses a store the signer unit does not take BEFORE the word, and looks AGAIN after the word | done |
| R-7 | A take while the door `judgedSigningKey` answers null got a signer bound to nothing but its own load | The sealing host refuses `BOOT_KEY_NOT_JUDGED` before anything of the store is loaded. The host is mounted in the two real operations only | done; `SIMULATED` and the seed command left as accepted, said in a comment at the place |

## 2. What was built

| File | Change |
|---|---|
| `src/capture/signer/host-key.ts` | `keyIdSpent`: the third question (R-5), with its limit stated: a store emptied of EVERYTHING of the series has no memory. `markSigningKeyCompromised`: the directory look first; optional `ownerUid` (as `KeyStoreOptions` has, for a test). NEW `lookAtSigningKeyStore({ dir, keyId })` and type `SigningKeyStoreLook { key, opener, certificate, mark }`: names only, no file opened; null = no store; a directory that cannot be listed is `KEY_UNREADABLE`, never "nothing found". NEW `refuseHoldWithoutBootKey(hold)`: pure, throws `BOOT_KEY_NOT_JUDGED`. `signerHeldToBoot`, `loadSoftwareSigner`, `activateSigningKey`, `nextSigningKeyId`: unchanged, line for line |
| `src/capture/signer/types.ts` | ONE new member of `SignerRefusal`: `BOOT_KEY_NOT_JUDGED` |
| `src/capture/signer/index.ts` | exports `lookAtSigningKeyStore`, `refuseHoldWithoutBootKey`, `type SigningKeyStoreLook` |
| `src/sealing-host/index.ts` | `signingNow`: ONE added line, `refuseHoldWithoutBootKey(hold);`, after the hold is built and before the `try` that holds the one load. One import name. The comment block above it: the two sentences "where no boot check loaded a key ... the key rule is as before this row" are replaced by "THE NULL DOOR REFUSES", which names `simulated` and the seed command as left on purpose (review 230 items (d), (f)). The five lines the 226c wiring case pins are unchanged |
| `cli/mark-compromised-command.ts` | Step 4 "THE LOOK": the store is asked; `STORE_NOT_TAKEN` (with the store's code) before anything is asked; a new summary line `  found:          key file <present or absent>, wrap secret ..., certificate ..., mark ...` beside the existing `the active key:` line, in every summary (about to mark, marked already, OK). Step 6: the look again after the word - `STORE_NOT_TAKEN`, or `STORE_CHANGED` when what was shown is no longer what is there; nothing written. Two new members of `MarkCompromisedRefusal`. Header paragraph. Imports: two more NAMES from `../src/capture`, no new module |
| `cli/mark-compromised-command.ts`, `cli/rotate-key-command.ts` | The two note texts review 230 routes to this row (R-8): `COMPROMISE_NOTES[2]` and `ROTATION_NOTES[0]` no longer say a running Core "keeps signing with the key it loaded"; they say what rows 226b and 226c built (`KEY_COMPROMISED`, `ACTIVE_KEY_CHANGED`). The header of the mark command likewise. No logic of the rotate command was touched |

`test/static/cli.test.ts`: NOT edited. No cli file was added and no import MODULE of a cli file changed.

### R-7: where the refusal lives, and why there

- `mountSealingHost` answers `INERT` for `SIMULATED` before anything is built, so `signingNow` exists only in `REAL_DEVELOPMENT` and `REAL_PRODUCTION`. Row 226c read that boot check 4 loads and judges the key in BOTH. So in this unit a null door is never "nothing to hold to".
- The refusal is in the host, not in `signerHeldToBoot`: the hold stays what it is for a unit without a boot, and the argument of the hold (`signing ??= loadSealingSigner(...)`) is never evaluated - no key of the store is loaded for a refused take.
- Every taker goes through `signingNow` (the seal port, the export jobs, the transcript revisions; pinned by the 226c wiring case), so the three are refused alike. What a caller sees is what it sees for any signer refusal: a seal step `SIGNER_FAILED` with the signer's code in the error log, an export job `SIGNER_UNAVAILABLE` with `signerReason`, a revision 503 `SIGNING_KEY_UNAVAILABLE`.

## 3. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| D-1 | A NEW refusal code `BOOT_KEY_NOT_JUDGED` instead of reusing `ACTIVE_KEY_CHANGED` | nothing changed and no key id can be named; a reader of the error log must be able to tell "rotated, restart" from "this process never passed its key checks". `SignerRefusal` is not mirrored in `packages/shared` and no test pins its member list (grep) |
| D-2 | `cli/production-key-command.ts` NOT edited | it is not in this row's list ("rotate / mark command files"). The store refuses, so the edge is closed; "before its prompts" is one request line |
| D-3 | The command looks AGAIN after the word and has a second refusal, `STORE_CHANGED` | the brief asks for the refusal "before it writes"; the person may wait at the prompt between the look and the write |
| D-4 | The two note texts of R-8 were corrected here | review 230 section 6 routes them to row 226d; they are one string each |
| D-5 | A key of which only the certificate is left can still be marked | marking is the safe direction, and a rotated-out key whose private half was removed by hand is exactly a key someone may want marked; it is SHOWN as it is |

## 4. Tests

All new cases extend existing files (driver rule 7). Every key is generated by the test in a directory of the temporary folder that the file's `afterAll` removes and asserts gone. No key under the repository's `.data/`; none through the row-61 fixture (`realBootFixture` is not called by any new case). No new case reads a byte of a key file: they compare entry names, modes, sizes and write instants, and read the mark file (a fact and an instant).

| File | Case added | What it holds |
|---|---|---|
| `src/capture/signer/__tests__/active-key.test.ts` | row 226d (R-5) | the hand-edited store (pointer and the first id's three files removed, the second left): the first id refused `KEY_EXISTS`, nothing written; the third id is next and is provisioned. Six kinds of entry of a later id each spend the first, second and third id; CONTROLS: a longer number, another series, a bare prefix spend nothing; an id outside the series is not held to the series |
| `src/capture/signer/__tests__/sign-time-guard.test.ts` | row 226d (R-6) | the store's mark: no store `KEY_ABSENT` and nothing made; reachable by group `KEY_MODE`; of another user `KEY_MODE`; a link to the real store `KEY_UNREADABLE` and nothing written behind it; a directory that cannot be listed `KEY_UNREADABLE`; the look's answers; CONTROL: a sound store is marked by one new entry; marked already and not sound: still refused |
| same file | row 226d (R-7) | with the REAL mounted boot step: before the boot passed, after a refused boot (4c) and after a boot on key seams the take is `BOOT_KEY_NOT_JUDGED` and the store was loaded 0 times; CONTROL of the edge as it was (the hold alone signs unheld); CONTROL: after the pass the same Core takes its signer and signs |
| `src/sealing-host/__tests__/sealing-host.test.ts` | row 226d (R-7), wiring | in `signingNow` the order is hold, refusal, `try`, load; one call of the refusal; the mount answers `INERT` for `SIMULATED` first; the comment at the place names `simulated` and the seed command |
| `src/sealing/__tests__/rotate-mark-commands.test.ts` | row 226d (R-5), command | a rotated installation edited by hand: `evidence:production-key` ends `FAILED, KEY_EXISTS`, nothing written; `evidence:rotate-key` answers `NOTHING_TO_ROTATE` - no command repairs such a store |
| same file | row 226d (R-6), command | the `found:` line before the word (present, absent, marked, active yes / no); absent refused without a prompt; a store the unit does not take, with the command's own facts stated as sound: `STORE_NOT_TAKEN` + `KEY_MODE` / `KEY_UNREADABLE`, 0 prompts; CONTROL: with real facts the directory rule refuses the link first (`SIGNER_LINK`), as before; changed AT THE PROMPT (a link, a group bit, the certificate removed, marked by another run): nothing written, `STORE_NOT_TAKEN` / `STORE_CHANGED`; CONTROL: nothing changed - marked |

**Existing tests changed: NONE.** Expectations that PINNED an edge this row closed:

- `sign-time-guard.test.ts`, "WHERE NO BOOT CHECK LOADED A KEY (bootKeyId null): the key rule is the one of before this row". It pins `signerHeldToBoot`, which is unchanged, so it stays true and green. It no longer describes what a RUNNING CORE does: the host refuses before it reaches the hold. For row 139: the title could say "the hold alone".
- No existing expectation pinned R-5 or R-6. One existing string of MY first version tripped the cli rule "no output names a secret" (`found.wrap` in an output expression); the member is named `opener` - my code changed, not the rule.

Not red-run: the R-5 case was written after the fix and not run against the earlier `keyIdSpent` (that needs a revert of a shared file in a busy tree). It asserts `KEY_EXISTS` where the earlier function, by its text, answered "not spent" and provisioned.

## 5. Checks (from `apps/core-server`, `--maxWorkers=2`)

| Check | Result line |
|---|---|
| My four test files, first run after the edits | `Test Files 4 passed (4)`, `Tests 62 passed (62)`. `rotate-mark-commands.test.ts` after the command-level R-5 case: run 1 `1 failed, 9 passed` (my expectation that a rotation goes on to the third id; the product refuses `NOTHING_TO_ROTATE`, expectation corrected), run 2 `Tests 10 passed (10)` |
| Unit: signer, sealing, sealing-host, evidence-export, evidence-verify, capture/boot, capture/fence, capture static, modules transcripts / sealing / evidence, `test/static`, `test/cli` | `Test Files 2 failed, 112 passed (114)`, `Tests 2 failed, 2295 passed (2297)`. The two are other rows' in this wave: `capture/__tests__/static.test.ts` SR-2 names `modules/capture-config/camera-network/service.ts` (row 111); `capture/boot/__tests__/reserved-ids.test.ts` "every test file that makes a boot fixture removes it" lists seven db test files (row 228b, in flight). Neither names a file of this row |
| Database (sandbox off, `.locks/db-migrate.lock`): export-e2e, export-restart, export-trust-list, transcript-routes, transcripts, finalize-transcript, last-resort, production-key-proof, stt-states, modules/evidence (7 files), fence, sealing-notice-doors | `Test Files 1 failed, 17 passed (18)`, `Tests 7 failed, 240 passed (247)`; teardown `dropped 3 database(s) ... 0 remain`. All 7 are in `capture/fence/__tests__/fence.db.test.ts`, each a REAL_PRODUCTION boot refused `RESERVED_INSTALLATION_ID` - row 228b's new check meeting that file's fixture id, K4's work in flight. Not re-run: no line of this row is in that path |
| Typecheck `tsc --noEmit` | exit 0, no output |
| Row-229 driver, ONE run, unedited (`/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && node --import tsx ../../.cache/task4-row229/rotation-session.mts'`) | `DIFFERENCES FROM THE DESIGN: 0`, `RESULT: every expectation of the session held (46 held, 1 recorded as observations, 0 difference(s) from the design)`, exit 0; `dropped 3, remaining 0, failed 0`; key search 0 hits |
| Secret scan (`scripts/secret-scan/count-only.mjs`) over the signer folder, the two commands, the command test, the host | `TOTAL: 0 in 0 file(s)` |

NOT RUN: the full suites (the controller's); `transcription/__tests__/probe.test.ts` and `encrypted-credential.test.ts` failed once inside the sandbox on their listeners (not this row's subject, not re-run); `seal-e2e`, `kill-matrix`, `development-session-e2e` (capture worker and ports a driver may not use).

## 6. Request

One line in `delegation_progress/file_requests.md`, not blocking: `cli/production-key-command.ts` refuses before its prompts when the store holds anything of the series (`nextSigningKeyId(...) !== CORE_EVIDENCE_SIGNING_KEY_ID`); and for the installer text (R-9), that no command repairs a store whose pointer was removed by hand.

## 7. What stays unproven, and limits

- R-7 on a STARTED Core: no test starts a Core whose boot step did not pass and then asks it to seal - the readiness plugin does not serve such a Core. The refusal is proved with the real boot step's door and the function the host calls, and the host's order by the wiring case; the database suites and the row-229 driver are the control that every Core whose boot passed still signs.
- R-5: a store emptied of everything of the series is an empty store; the first id is given again. Nothing in the store can know otherwise.
- R-6: between the store's look and its write the directory could still be exchanged by whoever may write its parent (no `openat`; the limit `host-key.ts` states for every read).
- The doubles: temporary directories on this Mac; `ownerUid` stated for the foreign-owner case. No Linux host, no hardware: nothing of this row depends on one.

---
*Generated: 2026-10-13 15:05*
