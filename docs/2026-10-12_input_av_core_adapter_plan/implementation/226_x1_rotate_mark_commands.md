---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 226
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (wave 10, agent K1)
tier: T3
requirements: SX-09 (e); R-X1-1 to R-X1-8 for the new key; UD-5
status: complete
---

# Row 226 - the commands `evidence:rotate-key` and `evidence:mark-compromised`

## What was built (paths relative to `apps/core-server/`)

| File | Change | What |
|---|---|---|
| `cli/rotate-key-command.ts` | new | the rotation without a process: `runRotateKeyCommand(args, ports)` returns `{ code, lines, refusal }` |
| `cli/rotate-key.ts` | new | thin process entry (the ports of row 206's entry, `terminalPorts`) |
| `cli/mark-compromised-command.ts` | new | the mark without a process: `runMarkCompromisedCommand(args, ports)` |
| `cli/mark-compromised.ts` | new | thin process entry |
| `cli/production-key-command.ts` | the word `export` on five helpers (`inspectEntry`, `utcText`, `directoryRefusal`, `writeRecord`, `handoverRecordText`) and one comment clause | so that the directory rule and the records of row 206 are USED, not written a second time. No behaviour changed; row 206's 12 cases pass unedited |
| `package.json` | two lines | `"evidence:rotate-key": "tsx cli/rotate-key.ts"`, `"evidence:mark-compromised": "tsx cli/mark-compromised.ts"` |
| `src/sealing/__tests__/rotate-mark-commands.test.ts` | new | 8 cases |

Laid out as row 206 (C54): logic and entry in `cli/`, outside `src/`; no file of the server imports them (asserted).

**The script names and the static rule (C64).** `test/static/credentials.test.ts` refuses the words `passw`, `secret`, `token`, `credential` and `.data/` in a script's COMMAND text. Neither command text (`tsx cli/rotate-key.ts`, `tsx cli/mark-compromised.ts`) holds one of them, and the file names are the plain names of the commands: no name was chosen to pass a rule, and no note of the SR-9 kind is needed. Asserted in the row's test.

## The two command lines

```
npm run evidence:rotate-key -w @dems/core-server -- --data-dir <absolute directory>
npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <absolute directory> --key-id <key id>
```

Exit status of both: 0 done, 1 refused or failed, 2 usage. Both are run by a person at a terminal of the Core host, as the Core's OS user (uid 0 refused), with the Core STOPPED. Neither reads an environment variable.

## `evidence:rotate-key`, as built

Everything that can refuse runs before anything is made:

1. Arguments: `--data-dir` only (required, absolute, as written). Else exit 2.
2. Caller: `ROOT_REFUSED`, `USER_UNKNOWN`.
3. The directory rule of row 206, CALLED (`directoryRefusal`): `ANCESTOR_*`, `DATA_DIR_*`, `SIGNER_*`, `HANDOVER_*`.
4. The store: `NO_STORE`; `STORE_REFUSED` when the store does not say which key is active (a pointer that cannot be taken is never repaired, replaced or removed here); `NOTHING_TO_ROTATE` when nothing of the active id is there (the first key is row 206's command); `DEVELOPMENT_STORE`; `ACTIVE_KEY_STATE` when the active key does not load for a reason a new key is no answer to (`KEY_MODE`). A rotation IS the answer when the active key loads, or does not load with `KEY_COMPROMISED`, `CERTIFICATE_NOT_VALID_NOW`, `KEY_ABSENT`, `KEY_UNREADABLE`, `CERTIFICATE_INVALID`.
5. The next key id: `nextSigningKeyId` of row 225 - one after the highest the store has ever named (`KEY_SERIES_EXHAUSTED` after `-99`).
6. The two typed values under row 206's forms, CALLED (`organisationOf`, `installationDeviceIdOf`): echoed, not secret, a refused value not repeated. `NOT_A_TERMINAL` when no line can be read.
7. Summary and the word `ROTATE` (`NOT_CONFIRMED`).
8. `provisionSigningKey` with the next id and the production subject (`O` = organisation, `OU` = `Evidence signing <id>`, `CN` = the new key id); the store's own source of chance, no option or port selects another (R-X1-4). Then R-X1-3 (0700, 0600, 0600, 0644, the caller's: `STORE_NOT_AS_WRITTEN`) and the load of the new key BY ITS ID with the exact subject (`LOAD_FAILED`, `SUBJECT_MISMATCH`) - before the pointer names it.
9. `activateSigningKey` of row 225 (staged file, synced, ONE rename, directory synced): `NOT_ACTIVATED`. Then the Core's own loader `loadSealingSigner` must answer with the new key (`ACTIVE_KEY_NOT_NEW`), and the earlier certificate is read again and must be what it was (`EARLIER_CERTIFICATE_CHANGED`).
10. Two records of the new key, created exclusively and synced (row 206's `writeRecord`): `signer/<new id>.provisioned.json` (record `DEMS_EVIDENCE_SIGNING_KEY_ROTATED`, with the earlier key id, its fingerprint and its state) and `handover/<new id>.handover.txt`. `RECORD_NOT_WRITTEN` says that the key IS active.

After step 7 nothing is ever removed. A stop between 8 and 9 leaves a new key that is NOT active and the earlier one in force; its id is spent and the next run takes the id after it. A stop inside 9 leaves the earlier pointer or the new one, whole (row 225's test).

What it prints on success (synthetic values; fingerprints are placeholders):

```
evidence:rotate-key: the active key is CORE-KEY-EVSIGN-01
  subject:           CN=CORE-KEY-EVSIGN-01,OU=Evidence signing DEMS-TEST-226,O=SYNTHETIC TEST ORG - NOT AN INSTALLATION
evidence:rotate-key: about to make a NEW evidence signing key the active one of this installation
  directory:           /srv/dems-data/signer
  earlier key id:      CORE-KEY-EVSIGN-01 (loads)
  earlier certificate: sha256 <64 hex> - KEPT
  new key id:          CORE-KEY-EVSIGN-02
  algorithm:           Ed25519, a software key in a file of this host, readable by its owner only
  new subject:         CN=CORE-KEY-EVSIGN-02,OU=Evidence signing DEMS-TEST-226,O=SYNTHETIC TEST ORG - NOT AN INSTALLATION
  valid from (UTC):    2026-10-13T06:00:00Z
  valid until (UTC):   2031-10-12T06:00:00Z
  (the clock sentence; four rotation notes: stop the Core, nothing of the earlier key changed, keep the earlier
   certificate and fingerprint, no database; the six limit sentences of row 206)
evidence:rotate-key: OK, the new evidence signing key was provisioned, loads and is the ACTIVE one
  directory:           /srv/dems-data/signer
  earlier key id:      CORE-KEY-EVSIGN-01 (loads)
  earlier certificate: sha256 <64 hex> - KEPT
  new key id:          CORE-KEY-EVSIGN-02 - ACTIVE
  subject:             CN=CORE-KEY-EVSIGN-02,OU=Evidence signing DEMS-TEST-226,O=SYNTHETIC TEST ORG - NOT AN INSTALLATION
  certificate:         sha256 <64 hex>
  valid from (UTC):    2026-10-13T06:00:00Z
  valid until (UTC):   2031-10-12T06:00:00Z
  hand-over record:    /srv/dems-data/handover/CORE-KEY-EVSIGN-02.handover.txt
  (the notes and limits again)
  Start the Core again: it loads the new key. Keep this output with the installation papers. Do not copy the signer directory into a backup: back up certificates only.
```

## `evidence:mark-compromised`, as built

1. Arguments: `--data-dir` and `--key-id`, both required; the key id is one of the series, as written; NO default to the active key. Else exit 2.
2. Caller and 3. the directory rule, as above; `NO_STORE`.
4. `KEY_NOT_IN_STORE` when nothing of that id is there (no mark for a key that never was). A key marked already: said, exit 0, nothing asked, nothing written.
5. Summary - the key id, the subject and fingerprint of ITS certificate, whether it is the active key - and the word `COMPROMISED` (`NOT_A_TERMINAL`, `NOT_CONFIRMED`).
6. The mark, through the EXISTING `markSigningKeyCompromised` (one new file `<id>.compromised`, created exclusively and synced; `NOT_MARKED`). Nothing else is written.
7. The mark is re-read as written (`MARK_NOT_AS_WRITTEN`) and must HOLD: the key asked for by its id is refused with `KEY_COMPROMISED`, and when it is the active key the Core's loader is too (`MARK_NOT_EFFECTIVE`).

A pointer that cannot be taken does not keep a key from being marked: the line reads `the active key: cannot be told (ACTIVE_KEY_POINTER_INVALID)`.

What it prints on success:

```
evidence:mark-compromised: about to mark an evidence signing key COMPROMISED
  directory:      /srv/dems-data/signer
  key id:         CORE-KEY-EVSIGN-01
  subject:        CN=CORE-KEY-EVSIGN-01,OU=Evidence signing DEMS-TEST-226,O=SYNTHETIC TEST ORG - NOT AN INSTALLATION
  certificate:    sha256 <64 hex>
  the active key: yes
  The Core REFUSES TO START (boot check 4: KEY_COMPROMISED) and seals nothing until evidence:rotate-key has made a new key the active one.
  (six notes: the mark cannot be taken back; key file and certificate stay, nothing sealed is rewritten; STOP the Core;
   no revocation channel - tell every receiver of the fingerprint; a package of a compromised key is not proven by its
   signature alone; no database)
evidence:mark-compromised: OK, the key is MARKED COMPROMISED and loads for nobody
  (the five facts again)
  marked at (UTC): 2026-10-13T06:00:00Z
  (the consequence and the notes again)
  Keep this output with the installation papers.
```

## The database: NOT TOUCHED by either command

Neither command opens a connection, reads a connection file or imports anything of the database (asserted statically for the four files). So "refuse while a Core is connected to the database" has no test to run: there is nothing to test it by, and neither command can see a running Core. Both say so and tell the installer to stop the Core. See the finding below.

## Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| The row's test | `npx vitest run --project unit src/sealing/__tests__/rotate-mark-commands.test.ts --maxWorkers=2` | first run: `Tests 8 passed (8)`. One assertion of my own was then found to be swallowed by a `.catch` (the store-mode refusal) and re-stated; it is in the run below |
| Everything database-free that provisions or loads a key, the commands' tests, the static rules | `npx vitest run --project unit src/capture/signer src/sealing src/capture/boot src/evidence-verify src/sealing-host src/modules/transcripts src/capture/fence src/capture/__tests__/static.test.ts test/static test/cli --maxWorkers=2` | `Test Files 76 passed (76)`, `Tests 1343 passed (1343)` |
| Typecheck | `npx tsc --noEmit` | no error |
| The two entries, refusal paths only (no key made) | `node --import tsx cli/rotate-key.ts` -> usage, exit 2; `--data-dir <a temporary directory>` without a terminal -> `REFUSED, ANCESTOR_WRITABLE`, exit 1; the same two for `cli/mark-compromised.ts` | as stated; 0 entries in the directory, which was then removed |
| Baseline | `git hash-object src/capture/boot/checks.ts` | `1697e4b9dec975226974ae9f2053e2145166a0f2`; `boot/index.ts` sha256 `47946c29...82b2f3d` (row 211's value) |

Database suites: this row changed no file the server loads; the database runs of row 225 (7 files, 90 passed) stand for both rows.

The Verification cell, case by case:

| Cell | Case |
|---|---|
| after a rotation the active id is the new one | case 1: the resolver, `loadSealingSigner`, and the real `runCaptureBootChecks` for `REAL_PRODUCTION` over the boot unit's own readers; the new key's signature verifies under the new certificate and not under the earlier |
| both certificates exist | case 1 (and all three after a second rotation, to another installation name) |
| the earlier key files are byte-identical | case 1: EVERY entry of the data directory before the rotation is in the tree after it, by name, mode and bytes; the six added entries are named |
| a marked key loads for nobody | case 5: by its id, through the loader without an id, through the seal's loader |
| the start is refused until a rotation | case 5: `CAPTURE_SIGNING_KEY_UNUSABLE` / `KEY_COMPROMISED` after the mark and again after a second mark run; row 206's command answers `KEY_EXISTS`; after `evidence:rotate-key` the start passes with `-02`, and `-01` is still marked and still there |
| the output sweep of row 206 counts 0 for both commands | case 7: 15 runs of both commands (successes, each refusal with keys in the store, the two failures after the new key was made, a spoiled pointer) with standard output, standard error and the console captured; every line; the results as objects; all 18 non-key files of both data directories (records, certificates, hand-over records, pointers, marks) - against SIX keys in the forms of row 206's sweep. Positive control: each needle found when planted and in the key files |
| (brief) nothing sealed rewritten; no file replaced, deleted or renamed except the pointer | case 1 (tree); static case 8: the four files hold no call that removes, renames, cuts, copies or writes in place, and the rotation's one file-system import is `mkdirSync`; row 225's write test: the store's only rename is the pointer's |
| (brief) crash leaves old or new pointer | row 225 `active-key-write.test.ts`; here case 2: a rotation stopped after the key was made leaves `-01` active, and the next run takes `-03` |

## SX-09 (e), R-X1-1..8 for the new key

| Id | State |
|---|---|
| SX-09 (e) | DONE: next id from the store; row 206's command refuses the first id again after a mark and after rotations (asserted) |
| R-X1-1, R-X1-2 | DONE (sweep; no cryptography import) |
| R-X1-3 | DONE (re-read as written; files left on every failure) |
| R-X1-4 | DONE (no option, port or environment variable for chance; static) |
| R-X1-5 | DONE (row 206's two validators, called) |
| R-X1-6 | DONE (nothing replaced, removed, renamed; the pointer's own write only) |
| R-X1-7 | DONE (row 206's directory rule, called; uid 0) |
| R-X1-8 | DONE (every key in a `mkdtemp` root under the real path of the temporary folder; `afterAll` removes and asserts each root gone; the entry check used an empty temporary directory, removed) |

## Doubles and what stays unproven

- The directories above the test root: row 206's one double (`aboveIsSound`).
- A person at a real terminal (the entries were run on their no-terminal refusals only); the npm script form (the `tsx` launcher's pipe is refused by the sandbox, as for row 206).
- Linux; a whole `REAL_PRODUCTION` start after a rotation (row 229, the rotation scenario, and gate X-G).
- What the Core's verify says about packages of the earlier or of a compromised key: row 227.

## DRIVER DECISIONS (for the controller)

1. **The typed values are asked again for the new key** (not copied from the earlier certificate): a renamed installation needs exactly this, and R-X1-5 applies to the new key.
2. **`--key-id` is required for the mark; no default to the active key.**
3. **A second run of the mark is exit 0** ("marked already"), nothing asked.
4. **A rotation is refused on a pointer that cannot be taken, on a development store, and on `KEY_MODE`**; it is allowed when the active key is lost or its certificate unreadable (then the summary says that what that key signed cannot be verified from this store).
5. **An interrupted rotation is never resumed**: the provisioned, never-active key stays and the next run takes the following id. Whether its certificate is trusted is row 227's (information line left).
6. **No audit entry and no audit type** (none added, none requested): the commands run without a database; the next `SYSTEM_BOOT` states the new key id (row 209).
7. **Five helpers of row 206's file exported** rather than its directory rule written twice.
8. The mark is still set when the pointer cannot be taken (an urgent act must not wait for another repair).

## FINDING (request left in `file_requests.md`)

`sealing-host/index.ts` loads the signer once per process: a Core that is RUNNING keeps sealing with the key it loaded - a key just marked compromised included - until it is restarted. The commands cannot see a process. Not in my area; to be closed or stated before real examinations.

## Files

Changed with the Edit tool: `cli/production-key-command.ts`, `package.json`, `delegation_progress/file_requests.md`. New with Write: the four `cli/` files, the test, this record, `delegation_progress/row_226.md`.

---
*Generated: 2026-10-13*
