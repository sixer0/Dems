---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 206
package: X1-1 (M11)
date: 2026-10-13
agent: coder-execution (batch 9, agent R9)
tier: T3
status: complete
---

# Row 206 - the production key command `evidence:production-key`

## 1. What was built

| File | Change | What |
|---|---|---|
| `apps/core-server/cli/production-key-command.ts` | new | The command without a process: `runProductionKeyCommand(args, ports)` returns `{ code, lines, refusal }`. Ports: `now`, `uid`, `ask` (one echoed line), `out`, optional `inspect` (entry facts; default `lstat`) |
| `apps/core-server/cli/production-key.ts` | new | The thin process entry: process arguments, standard output, exit status, host clock, `process.getuid`, a `readline` question that answers null when standard input is no terminal. Reads no environment variable |
| `apps/core-server/package.json` | one line | `"evidence:production-key": "tsx cli/production-key.ts"` beside `evidence:dev-key` |
| `apps/core-server/src/sealing/signing.ts` | header comment, one sentence | "no production key is provisioned by anything in this folder" keeps standing and now points to the command in `cli/` |
| `apps/core-server/src/sealing/__tests__/production-key.test.ts` | new | 12 cases (section 4). It lies with the sealing unit's tests because it runs the command against that unit's loader, its development command and the boot step |

Not touched: `capture/boot/checks.ts`, `capture/boot/index.ts` (SX-17), `capture/signer/host-key.ts` (row 210), every static list, `scripts/secret-scan`, `packages/shared`.

## 2. H1 - settled first

**May a file outside the capture unit import the provisioning function? Yes.** `provisionSigningKey` is exported by the capture unit's index (`src/capture/index.ts` -> `./signer`); `test/static/imports.test.ts` rule 2 asks only that a closed unit is imported through its index. `src/sealing/signing.ts` already does exactly that.

**Where the logic lies - DRIVER DECISION DD-1.** The profile says "logic under `apps/core-server/src/`, in a folder H1 decides". Every place under `src/` was found pinned by a static rule this row does not own, each MEASURED by a red run:

| Place tried or examined | The pin that refuses it |
|---|---|
| a new folder `src/provisioning/` (the design's proposal) | `test/static/imports.test.ts`, "the one unit that is not closed is the command folder": a new top folder is a new unit and must be listed in `CLOSED_UNITS` with an index (read, not run) |
| `src/sealing/production-key.ts` (built first, beside the development command) | `src/sealing/__tests__/stt-states.test.ts:612`: the production files of the sealing unit are pinned by name, whole - RED with the new file |
| any file under `src/` that names the installation setting in a prompt | `src/sealing-host/__tests__/installation-identity.test.ts:160`: no source but the reader and the two configuration files names the variable - RED |

The logic therefore lies in `cli/production-key-command.ts`, beside its entry `cli/production-key.ts` (the folder of the receiver's entry and of row 213's prompt). No static list was edited and all three tests pass unedited. What the server's rules would have held for a file under `src/` is asserted by the row's own test instead: no cryptography import, no environment read, no removing or renaming call, no random seam, and NO production source under `src/` imports either file (the server cannot load the command). The installation setting is named through the imported constant `ENV_INSTALLATION_DEVICE_ID`, not written again. This departs from the profile's "under `src/`": if the controller wants it there, it is a move of one file plus one entry in the list of `stt-states.test.ts` (request left in `file_requests.md`, not blocking).

## 3. Behaviour

Command line (the only form; strict parsing, any other option is exit 2):

```
npm run evidence:production-key -w @dems/core-server -- --data-dir <absolute directory>
```

Order - everything that can refuse runs before anything is made:

1. Arguments: `--data-dir` required, absolute, as written (no `..`, no trailing separator, no default). Else exit 2.
2. Caller: uid 0 -> `ROOT_REFUSED`; a host that cannot say the user -> `USER_UNKNOWN`.
3. Directory rule (R-X1-7, SX-05): every directory above the data directory is a real directory of root or the caller, not writable by group or others (`ANCESTOR_*`); the data directory is a real directory of the caller, no link, not writable by group or others (`DATA_DIR_*`); `signer`, where it exists, is a real directory of the caller with mode 0700 (`SIGNER_*`); `handover`, where it exists, a real directory of the caller not writable by group or others (`HANDOVER_*`).
4. Store (R-X1-6, SX-07): any of the four names `CORE-KEY-EVSIGN-01.{p8,wrap,crt,compromised}` present -> `KEY_EXISTS`, with the names present, the names absent, and `store loads: yes | yes - it is a DEVELOPMENT key ... | no (<signer code>)`. Nothing is replaced, completed, removed or renamed. A record without a key -> `RECORD_EXISTS`.
5. Two typed values, echoed, not secret (SX-06, R-X1-5). Organisation: ASCII letters, digits, space, hyphen, full stop; 2 to 64; begins with a letter or digit; no trailing space, no double space; never the development mark (any case). Installation device id: `parseInstallationDeviceId` of `src/config.ts`, CALLED (the loader's one pattern; not copied - a test holds that the source has no second copy). A refused value is not repeated in the output. No line readable -> `NOT_A_TERMINAL`.
6. Summary (directory, key id, algorithm, subject, validity in UTC, the six limit sentences of SX-08) and the word `PROVISION`; anything else -> `NOT_CONFIRMED`.
7. `mkdir signer` (exclusive, 0700, only when absent) and `provisionSigningKey({ dir, now, keyId, subject: { organization, organizationalUnit: 'Evidence signing <id>' } })`. The random source is the store's own: no option, port or environment variable selects another (R-X1-4).
8. R-X1-3: `lstat` of what was written - 0700, 0600, 0600, 0644, each the caller's - else `STORE_NOT_AS_WRITTEN`.
9. SX-05: the REAL load, `loadSealingSigner({ dataDir, now })` (= `loadSoftwareSigner` on `<data dir>/signer`, the call of boot checks 4 and 4b and of the seal); the parsed subject must EQUAL `CN=CORE-KEY-EVSIGN-01,OU=Evidence signing <id>,O=<organisation>`, the fingerprint must equal the provisioned one, and neither development predicate may hold. Else `LOAD_FAILED` / `SUBJECT_MISMATCH`.
10. Two records, each created exclusively, set to 0644 and synced with its directory: `signer/CORE-KEY-EVSIGN-01.provisioned.json` (public facts, the uid, the command version; "a note, not evidence") and `handover/CORE-KEY-EVSIGN-01.handover.txt` (the certificate, its sha256, the limits, the receiver's `--trust` line). Failure -> `RECORD_NOT_WRITTEN`, with subject and fingerprint printed.

After step 7 nothing is ever removed: a failure names the state and says the files are left.

What it prints on success (synthetic values; the fingerprint here is a placeholder, not a real one):

```
evidence:production-key: about to provision the PRODUCTION evidence signing key of this installation
  directory:         /srv/dems-data/signer
  key id:            CORE-KEY-EVSIGN-01
  algorithm:         Ed25519, a software key in a file of this host, readable by its owner only
  subject:           CN=CORE-KEY-EVSIGN-01,OU=Evidence signing DEMS-TEST-206,O=SYNTHETIC TEST ORG - NOT AN INSTALLATION
  valid from (UTC):  2026-10-13T04:00:00Z
  valid until (UTC): 2031-10-12T04:00:00Z
  Check the clock of this host ... character for character.
  (six limit sentences: self-signed, names typed not proven, the signer's own clock, no revocation channel,
   fingerprint by another channel with the list of receivers, hand over only after the first production start)
evidence:production-key: OK, the PRODUCTION evidence signing key was provisioned and loads
  directory:         /srv/dems-data/signer
  key id:            CORE-KEY-EVSIGN-01
  subject:           CN=CORE-KEY-EVSIGN-01,OU=Evidence signing DEMS-TEST-206,O=SYNTHETIC TEST ORG - NOT AN INSTALLATION
  certificate:       sha256 <64 hex of the certificate>
  valid from (UTC):  2026-10-13T04:00:00Z
  valid until (UTC): 2031-10-12T04:00:00Z
  hand-over record:  /srv/dems-data/handover/CORE-KEY-EVSIGN-01.handover.txt
  (the six limit sentences again)
  Keep this output with the installation papers. Do not copy the signer directory into a backup: back up certificates only.
```

Exit status: 0 provisioned; 1 refused or failed; 2 usage.

## 4. Checks

| Check | Command | Result |
|---|---|---|
| The row's test file | `npx vitest run --project unit src/sealing/__tests__/production-key.test.ts --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 12 passed (12)` - passed on its first run; run again after the move to `cli/` and after row 210: same line |
| Everything that provisions or loads a key without a database, and the static rules | `npx vitest run --project unit src/capture/signer src/sealing src/capture/boot src/evidence-verify src/sealing-host src/capture/__tests__/static.test.ts test/static --maxWorkers=2` | first run with the logic under `src/sealing`: 2 failed (the two pins of section 2, both caused by this row); after the move: `Test Files 60 passed (60)`, `Tests 1030 passed (1030)` |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | errors only in files of rows in flight (section 6); a filter of the output for this row's files (`production-key`, `host-key`, `signer`, `sealing/`) finds none |
| The entry, refusal paths only | `node --import tsx cli/production-key.ts` -> usage, exit 2; with `--data-dir <temporary directory>` and no terminal -> `REFUSED, ANCESTOR_LINK`, exit 1, 0 entries in the directory | as stated |

What the 12 cases assert, against the row's Verification cell:

| Cell | Case |
|---|---|
| exit 0, modes 0700 / 0600 / 0600 / 0644, the store loads, parsed subject equals the expected text | case 1 (also: the word is asked before anything exists; both records, their modes and members; the key signs) |
| second run `KEY_EXISTS` naming the names, directory byte-identical | case 2 (tree of names, modes and bytes before = after; nothing is asked) |
| SX-07 an incomplete store is refused, never completed | case 3: each single file and each pair of a store; a compromise mark alone; a development store named as one; a record without a key |
| each refused input leaves 0 files | cases 4 to 8: 21 organisation forms, 8 installation id forms, 5 confirmation words, 3 ended inputs, uid 0 and -1 through the port, 10 argument forms, a link at the data directory / at `signer` / at `handover` / on the way, an ancestor writable by group or others (four modes, also with the real inspector), a data directory open to group / of another user / absent, `signer` of mode 0755 |
| sweep counts 0 | case 9: standard output, standard error and the console captured during 8 runs (success, each refusal with the key in the store, a failure after the key at the load, a failure at the records), every returned line, the results as objects, both records and the certificate of three stores - against the wrap secret, the key file, the opened PKCS#8 and the 32-byte seed in hex (both cases), base64, base64url and raw, the PEM body, the JWK member, halves of the values, and the marker; positive control: each needle is found when planted, and in the key files themselves |
| the command's files import no `node:crypto` | case 10 (both files; also no environment read, no random seam, no call that removes or renames) |
| "OK" = boot checks 4 and 4b pass (the brief's proof) | case 11 (section 5) |

## 5. The proof that "OK" means checks 4 and 4b pass

`mountCaptureBootChecks` on a `REAL_PRODUCTION` configuration whose data directory is the command's, with NEITHER key seam handed in: the step's own `storedSigningKeyProblem` and `storedSigningKeyIsDevelopment` read the store. Checks 1 to 3 get passing facts; check 4c, the one directly after 4b, is told "7 operators".

| Store | Refused at | Code, reason |
|---|---|---|
| made by the command | 4c | `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`, `operators=7` -> 4 and 4b PASSED |
| made by `evidence:dev-key` (negative control) | 4b | the development-key refusal -> the check is not weakened |
| none | 4 | signing key unusable, `KEY_ABSENT` |
| the command's, certificate removed | 4 | signing key unusable, `CERTIFICATE_INVALID` |

`checks.ts` and `boot/index.ts` are unedited. The full proof through `runCaptureBootChecks` and the seal's sign step is row 208.

## 6. Reds seen in files this row does not own (not edited)

| Place | Likely owner |
|---|---|
| `test/static/audit-protection.test.ts:78` named `test/support/host-command-unit.db.test.ts:389` (seen 10:51; green at 11:05) | row 214 (R11) |
| `src/capture/__tests__/static.test.ts:733` (index.ts pin), `:899` (config.ts digest), `:1343` (`host-facts.ts`) (seen 10:51; green at 11:05) | rows 85 (R1) and 105 (R7), in flight |
| Typecheck: `src/capture/__tests__/supervisor.test.ts(1069,56)` TS2353; later also `src/capture/fence/index.ts(345..411)`, `src/capture/adapters/__tests__/real.test.ts(13,23)`, `src/modules/devices/__tests__/source-class.db.test.ts(41,52)` - a moving set | rows 191 (R2) and 85 (R1), in flight |
| `git diff` shows `src/capture/boot/index.ts` and `boot/__tests__/boot.test.ts` MODIFIED in the tree | not this row (row 85's host facts, C46). Said here because of SX-17: this row edited neither boot file |

## 7. Requirements

| Id | State |
|---|---|
| R-X1-1 | done: no key byte crosses into the command's files (they hold no cryptography import); the store returns the certificate only |
| R-X1-2 | done (case 9). Note of the review kept: the stored key is DER, so the marker alone never matches it - the byte forms do the work |
| R-X1-3 | done (step 8; files left on failure, case 9) |
| R-X1-4 | done (no option, port or environment variable for randomness; case 10) |
| R-X1-5, SX-06 | done (cases 4, 5) |
| R-X1-6 | done (cases 2, 3; the source holds no removing or renaming call, case 10) |
| R-X1-7, SX-05 | done (case 8; real load and exact subject, case 1) |
| R-X1-8 | done: every key in a `mkdtemp` directory under the real path of the temporary folder, removed in `afterAll`, which also asserts each root is gone |
| R-X1-9 | already held: `src/evidence-verify/__tests__/development-key.test.ts:33` asserts `DEVELOPMENT_KEY_SUBJECT_MARK === 'OU=' + DEVELOPMENT_KEY_UNIT`; run here, passes. The command checks BOTH predicates |
| SX-07 | command half done (names present, names absent, loads or not, never completed). Runbook half: X-D |
| SX-08 | command and hand-over record done (six sentences). README half: X-D |
| SX-16 | row 210 (the store's sync). The two records of this row are synced by the command |
| SX-17 | untouched: the two boot files are not edited |
| SX-18 | row 207 (R10): one request left |

## 8. Driver decisions (for the controller to confirm)

| # | Decision |
|---|---|
| DD-1 | Logic in `cli/production-key-command.ts`, not under `src/` (section 2: three pins, two of them measured red) |
| DD-2 | The launch brief said "subject fields taken from required arguments"; the row cell, the design (2.5) and SX-06 say "typed at the prompt, echoed, `--data-dir` only". The CELL was followed. Consequence: the command cannot be scripted (no terminal -> `NOT_A_TERMINAL`), which the design intends |
| DD-3 | The ancestors may be owned by root or the caller (the trust rule of boot check 2); a world-writable sticky directory is refused like any other. On this Mac the temporary folder lies below one, so the tests STATE the directories above their own root (one double, described in the test header); everything at and below the root is the real file system |
| DD-4 | `handover` is created with mode 0700 (the record in it is 0644): the installer hands the file over himself |
| DD-5 | `KEY_EXISTS` is answered before anything is asked; the "store loads" line uses the Core's loader only, on whatever store is at the given directory |
| DD-6 | The organisation must begin with a letter or a digit (beyond SX-06's list): a name of punctuation only is no name |

## 9. Not proven here

A person at a real terminal (the `readline` question of the entry was exercised only on its no-terminal answer); the npm script form under this sandbox (the `tsx` launcher's own local pipe is refused by the sandbox - the same holds for `evidence:dev-key`; `node --import tsx` ran the entry); a whole `REAL_PRODUCTION` start (gate 223 / X-G). Two process notes, said plainly. (1) Before its first run, corrections of this row's own NEW, never-committed test file were made with one scripted replace (nine exact, counted substitutions), and the NEW logic file was moved from `src/sealing/` to `cli/` with `mv`; every file that existed before this row - `package.json`, `signing.ts`, `host-key.ts`, `signer.test.ts`, the shared delegation files - was changed with the Edit tool only. (2) The first full neighbour run was RED because of this row (the two pins of section 2); it was found by running the neighbours, not by the row's own file, which was green throughout.

---
*Generated: 2026-10-13*
