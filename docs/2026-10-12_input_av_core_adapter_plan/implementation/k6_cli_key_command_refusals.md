---
task_id: 2026-10-12_input_av_core_adapter_plan
row: K6
package: M11 | X1-1, X1-4
date: 2026-10-13
agent: coder-execution (driver, agent K6)
tier: T3
requirements: decisions C84 (R-4, R-5), C86; the left-over requests of rows 228b ("the key commands still accept reserved ids") and 226d ("a spent key id refused before its prompts")
status: complete
---

# Row K6 - the cli key commands refuse a reserved installation id as typed, and a spent or unfit store before the first prompt

## 1. What was asked and what is built

| Item | Before | Now | State |
|---|---|---|---|
| (1) reserved installation id | `evidence:production-key` and `evidence:rotate-key` made a key for `DEMS-TEST-01`, `DEMS-IR-01`, `DEMS-JKT-07`; the production start then refused the installation (boot check 4b-3) | Both commands refuse the id as soon as it is typed (after the form rule, before the summary and the word): `INSTALLATION_ID_RESERVED`. No word is asked, no key is made, nothing is written, the id is not repeated in the output | done |
| (2a) `evidence:production-key`, spent first key id | The command's look named the four files of the first id only. A store that names a later id (an entry, a copy, a record, the pointer) passed it, three prompts were asked, and the store refused at the provisioning: `FAILED, KEY_EXISTS` | After the look and before the first prompt the command asks the STORE for its next key id (`nextSigningKeyId`). Any answer but the first id: `REFUSED, KEY_EXISTS`, no prompt. A store that cannot answer (pointer that cannot be taken): `REFUSED, STORE_REFUSED` with the store's code, no prompt | done |
| (2b) `evidence:rotate-key`, store not in the needed state | Steps 4 and 5 already ran before the first prompt | NO code change was needed. Now pinned by a case: `NO_STORE`, `NOTHING_TO_ROTATE`, `RECORD_EXISTS`, `KEY_SERIES_EXHAUSTED`, `ACTIVE_KEY_STATE` each with 0 prompts and the store byte-identical (`DEVELOPMENT_STORE`, `STORE_REFUSED` and `SIGNER_MODE` were pinned with 0 prompts by row 226) | done (tests only) |

## 2. The words printed (verbatim)

Reserved id, both commands (`<command>` = `evidence:production-key` or `evidence:rotate-key`):

```
<command>: REFUSED, INSTALLATION_ID_RESERVED
  This installation device id is reserved for tests and demonstration data: no installation may carry it, and a production start refuses it.
  No key was made and nothing was written. Give the installation an id of its own and run the command again.
```

Spent first key id (`evidence:production-key`):

```
evidence:production-key: REFUSED, KEY_EXISTS
  The key id CORE-KEY-EVSIGN-01 is SPENT: the store names a later key of the series, in an entry or in its pointer.
  A key id is never used for a second key, and this command makes the FIRST key of an installation only.
  Nothing was asked and nothing was written. What was removed from a store by hand is put back by hand: no command repairs it.
```

A store that does not say which id is next (`evidence:production-key`):

```
evidence:production-key: REFUSED, STORE_REFUSED
  the store says: ACTIVE_KEY_POINTER_INVALID
  The store does not say which key id is next. This command never repairs, replaces or removes what it cannot take:
  what the entry is and how it came there is for the installer to find out, at the host. Nothing was asked and nothing was written.
```

## 3. Files

| File | Change |
|---|---|
| `apps/core-server/cli/production-key-command.ts` | imports `nextSigningKeyId` (capture index) and `isReservedInstallationId` (`../src/capture/boot/checks`, where boot check 4b-3 takes it); two refusal words `STORE_REFUSED`, `INSTALLATION_ID_RESERVED`; exported `installationIdIsReserved` and `RESERVED_INSTALLATION_ID_NOTE`; the store question after step 4; the reserved check after the form check; header text of steps 4 and 5 |
| `apps/core-server/cli/rotate-key-command.ts` | refusal word `INSTALLATION_ID_RESERVED`; the reserved check after the form check, through the sibling's `installationIdIsReserved` (no new server import); header text |
| `apps/core-server/test/static/cli.test.ts` | ONE allowed import moved: `cli/production-key-command.ts` may import `src/capture/boot/checks`. It shows in three places of the rule, all three edited: the line of `SERVER_IMPORTS` with its reason (decision C86, row K6; reach `INSIDE` - the boot index does not export the list and `boot/index.ts` is not this row's), the file's line in `SERVER_IMPORTS_OF`, the pinned list of `INSIDE` reaches. Re-read immediately before the edit; the entry of `cli/verify-export.ts` (agent V5) untouched |
| `apps/core-server/src/sealing/__tests__/production-key.test.ts` | new group "row K6" (2 cases); ONE existing case changed, see section 4 |
| `apps/core-server/src/sealing/__tests__/rotate-mark-commands.test.ts` | two new cases "row K6"; ONE existing case changed, see section 4 |

`installationDeviceIdOf` is unchanged (the form rule; `DEMS-JKT-07` is still well-formed). The prompt still prints `for example DEMS-JKT-07`: `reserved-ids.test.ts` pins that the prompt's example is a reserved id ("an installer who copies it is refused by name") - it is now refused by the command itself, before a key exists.

## 4. Existing tests: two cases pinned the behaviour this row was asked to change (DRIVER DECISION)

The instruction was "existing tests unedited and green". Two existing cases asserted exactly the left-over (three prompts, then `FAILED, KEY_EXISTS`); the first run after the code change showed these two and no other red (`2 failed | 24 passed (26)`), each `expected [1, 'KEY_EXISTS', 0] to deeply equal [1, 'KEY_EXISTS', 3]`. That run is the red-before-green evidence of item (2a).

| Case | What moved |
|---|---|
| `rotate-mark-commands.test.ts`, "row 226d (R-5) ..." | two expectations: prompts `3` -> `0`; `FAILED, KEY_EXISTS` -> the first two lines of the `REFUSED, KEY_EXISTS` answer. Scene, the "nothing written" comparison and the rotation half unchanged. Unavoidable: this is the request itself |
| `production-key.test.ts`, "a provisioning that fails says FAILED ..." part (a) | (a) used an `inspect` port blind to the store, so the store refused after the word. The store is now asked directly, so (a) ends `REFUSED, KEY_EXISTS` with 0 prompts (expectation moved). So that the `FAILED, KEY_EXISTS` path after the word stays covered, (a2) was added: an entry of the key id (a text, not a key) planted while the word is asked. Part (b) unchanged |

The decision behind the second one: the question goes to the store (`nextSigningKeyId`), not through the `inspect` port. Through the port only fixed names could be asked; the store sees every entry that names an id of the series (a copy, a staged pointer), which is exactly the hand-edited store of R-5. For the controller to confirm.

Other driver decisions: (D-2) a new word `STORE_REFUSED` for the production key command (the rotation's word, same meaning) rather than folding an unreadable pointer into `KEY_EXISTS`; (D-3) the reserved id is not repeated in the output (the command's rule "a refused value is not repeated").

## 5. Tests (through the commands' functions, injected ports; no terminal entry driven)

- Reserved, production key: each of the three ids -> code 1, `INSTALLATION_ID_RESERVED`, 2 prompts, the three lines exactly, id not in the output, the data directory empty. The list is the boot check's (`Object.values(ReservedInstallationId)`, and pinned as the three ids). Control: `DEMS-JKT-08` provisions (code 0, 3 prompts).
- Reserved, rotation: on an installed store, each id -> code 1, 2 prompts, tree byte-identical, the earlier key still active. Control: `DEMS-JKT-08` rotates.
- Spent, production key: six planted stores (later id as certificate, as a copy, as a record, as a mark; a pointer naming the first id; a pointer naming the second) -> `KEY_EXISTS`, 0 prompts, the four lines, tree byte-identical. Three pointers that cannot be taken -> `STORE_REFUSED`, 0 prompts. Controls: an empty store directory and two entries naming no id of the series -> the key is made.
- Rotation, store states: five states, 0 prompts each, tree byte-identical.

Secrets rule: every key is made by the command inside a root made with `mkdtemp` below the OS temporary directory and removed in `afterAll` (which asserts each root gone); planted entries are fixed texts; nothing below the repository's `.data/`; no key content read or printed by this row. After the runs: 0 `dems-row2*` directories left in the temporary directory.

## 6. Checks

| Check | Result |
|---|---|
| the two command files, before the test edits (red evidence) | `Tests  2 failed | 24 passed (26)` - the two cases of section 4 |
| the two command files + `test/static/cli.test.ts` + `capture/boot/__tests__/reserved-ids.test.ts` | `Test Files  4 passed (4)`, `Tests  81 passed (81)` |
| static set: `test/static/` (17 files), every `static.test.ts` under `src/` (28), plus `active-key-call-sites.test.ts`, `boot/__tests__/boot.test.ts` | `Test Files  47 passed (47)`, `Tests  823 passed (823)` - no red, of this row or another |
| typecheck (`tsc --noEmit`, core-server) | exit 0 |

NOT run by this row (database suites, the controller's): `src/sealing/__tests__/production-key-proof.db.test.ts` and `test/cli/operator-set-password.db.test.ts`. Both call `runProductionKeyCommand` on a fresh store with the ids `DEMS-TEST-208` / `DEMS-TEST-216`, which are not reserved; by reading they are not affected.

## 7. Left

- Nothing of the two items.
- For the document row (R-9 of review 230; not this row's files): installer or README text that says a spent id ends `FAILED, KEY_EXISTS` after the prompts should say `REFUSED, KEY_EXISTS` before them, and name `INSTALLATION_ID_RESERVED`.
- `evidence:mark-compromised` types no installation id; not touched.
- No requests in `file_requests.md`.

Edit tool only on existing files: kept (the two records are new files).
