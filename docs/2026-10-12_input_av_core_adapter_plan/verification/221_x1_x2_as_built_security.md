---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 221
date: 2026-10-13
agent: security-review
type: security review of code AS BUILT (bench tier of M11: rows 201, 202, 206 to 216, 220)
reviewed_tree: branch task4/input-av-core-port, working tree over head 0f5d2a8e (uncommitted)
requirements: SX-01 to SX-08, SX-11 to SX-20 (verification/07_security_x1_x2.md); R-X1-1 to R-X1-9, R-X2-1 to R-X2-11 (masterplan/05_design_x1_x2.md)
decisions_read: U19, U20, C42, C44, C53, C54, C62, C64, C66, C67, C68, C69
status: complete
overall: CAUTION
---

# Row 221 - security review of X-1 and X-2 as built, bench tier

## 1. Verdict

**CAUTION. No FAIL. Nothing in this review stops the work.**

| Count | Result |
|---|---|
| Requirements rated | 38 (18 SX, 9 R-X1, 11 R-X2) |
| Met | 31 |
| Caution | 7 (SX-04, SX-08, SX-13, SX-19, SX-20, R-X1-8, R-X2-2) |
| Failed | 0 |
| Cautions to route | 11 (section 6), each with a row |

The two commands do what the design and the first review asked. Neither secret reaches an argument, a variable, an output line, a log, an error or an audit detail. The boot conditions 4, 4b and 4c are the baseline's, byte for byte. The password command writes through the Core's own unit of work as the runtime role. No real password and no real private key was typed, generated for real use or read by an agent in rows 201 to 220 (section 8: the statement is MADE, with three stated facts beside it).

What keeps the verdict at CAUTION, in order of weight:

1. **320 fixture data directories lie under the repository's `.data/`, 316 of them with a private key file a test made, with a certificate that carries NO development mark and is valid today.** They are not leftovers of the bench-tier rows (none carries a bench row's name), but they are exactly the state SX-19 and R-X1-8 exist to prevent, and a Core pointed at any of them passes checks 4 and 4b (section 5.1).
2. The hidden prompt has never been used by a person on a real terminal (H5), and the confirmation line followed by the hidden prompt on one terminal is unproven (section 7 (i)).
3. A per-run HMAC key made with Web Crypto lives in the identity folder and two static rules do not see it (section 7 (a)).
4. A `REAL_PRODUCTION` Core off Linux starts with a warning instead of the host profile (section 7 (e)).

**For the bench gate (row 223):** may proceed, with cautions C-1 to C-11 carried as stated limits or fixed by their rows. **For a real examination:** list A of review 07 section 6 stands unchanged; this review adds to it the items of section 7 (c), (e), (g) and (i).

## 2. Subject, stakeholders, scope, method

**Subject.** The code of the bench tier as it lies in the working tree: `apps/core-server/cli/production-key-command.ts`, `production-key.ts`, `operator-set-password-command.ts`, `operator-set.ts`, `secret-prompt.ts`; `src/capture/signer/host-key.ts`; `src/capture/boot/index.ts`, `checks.ts`; `src/capture/fence/boot-key.ts`; `packages/shared/src/api/password-policy.ts`; `src/modules/identity/password-policy.ts`, `index.ts`, `biometric/store.ts`; `test/support/host-command-unit.ts`; `scripts/secret-scan/count-only.mjs`; the scripts block of `apps/core-server/package.json`.

**Stakeholders.** The user (owner of the decisions named in section 7 (e) and 5.1); the installer and the operators (who type at these commands); a receiver of a sealed package; the controller (routes the cautions); rows 222, 223, 224 (which depend on this row) and row 230 (which reviews the rest of `host-key.ts`).

**Out of scope.** Rows 225 and 226 (active key pointer, rotation, compromise command) are in `host-key.ts` and `cli/` but belong to row 230. Section 9 says what was seen of them. Rows 217 and 219 (documents) were read only where a requirement names a runbook text.

**Method.** Read-only. Every file above was read in full, except `host-key.ts` lines of rows 225/226, which were read and are reported in section 9 only. Records read: implementation 201, 202, 206, 207, 209, 210, 211, 212, 213, 215, 215b, V3 item 6; test 208, 214, 216, 220; gateway_check 205. The Graft graph was not queried (a query refreshes it, which writes).

**Commands run** (each read-only on source):

| Command | Result |
|---|---|
| `git rev-parse HEAD:apps/core-server/src/capture/boot/checks.ts`; `git hash-object` of the tree file | both `1697e4b9dec975226974ae9f2053e2145166a0f2` |
| `shasum -a 256 apps/core-server/src/capture/boot/checks.ts` | `d201004b6710458674ad0fc861d872e4355fa05b607a03f313aec53ba510dd94` (the baseline's) |
| `git diff --stat -- apps/core-server/src/capture/boot/` | `boot.test.ts` 114 lines, `index.ts` 197 lines; `checks.ts` absent from the list |
| sha256 of the line `export const SELECT_STORED_HASH_SETS ...` of the tree | `5cddf11b39c6ff0edda4c96b4f93444ca7eb6a0137be93bd6cf7abc812d484e1` (the baseline's) |
| `git hash-object` and `git rev-parse HEAD:` of `boot/__tests__/checks.test.ts` | both `13245e75283d6e0a354a70d5c294a02257361361` (unedited) |
| `npx vitest run --project unit src/capture/boot/__tests__/checks.test.ts --cache=false` | `Test Files 1 passed (1)`, `Tests 74 passed (74)` |
| `node scripts/secret-scan/count-only.mjs --tracked` | `private-key-pem: 3`, `database-password-line: 1`, `argon2-encoded: 0`, `key-file-name: 0`, `connection-file-name: 0` |
| the same scan over `cli/`, `test/support`, the signer, boot, fence and identity folders, the shared policy and this task's docs folder (568 files) | the three new needles 0; the only hit is `camera-credential=3` in `research/02_collection_rulings.md` (an older needle, not this tier) |
| the same scan over `.cache/task4-row220` | `TOTAL: 0 in 0 file(s)` |
| names only: `find` for `*.p8`, `*.wrap`, `pg.env`, `pg.owner.env`, `ACTIVE`, `*.handover.txt`, `*.provisioned.json` outside `.data`, `.git`, `node_modules`; `ls` of `.data` reduced to counts | section 5 |

**Secrets rule kept.** No file under `.data/`, no `pg.env`, no `.p8`, `.wrap` or `.pem` was opened. Under `.data/` only names, modes, owners and modification times were read, and only counts are reported. The three `private-key-pem` hit lines were printed with every run of 24 or more key-like characters masked; they hold a header only (section 7 (h)).

**Evidence rule.** `path:line` and `path` + symbol were read on 2026-10-13 in the working tree. Anything not read or not run is marked HYPOTHESIS or "not verified".

## 3. SX requirements against the built code

| Id | Rating | Evidence (file, symbol) | Note |
|---|---|---|---|
| SX-01 | MET | `cli/operator-set-password-command.ts`: `OTHER_SESSIONS` (every role, `pid <> pg_backend_pid()`), asked in step 4 before the summary and again inside the unit at step b, after the unit's chain lock; `STOPPED_LIMIT` says "connections, not a process" and "answers 503 for a moment and reloads" before the word `SET`; refusal text of `DATABASE_IN_USE` says it too | The requirement as written is met. What it cannot give is section 7 (g) |
| SX-02 | MET | same file, step e: `unit.audit.append(...)` inside `unitPipeline.run('operator.setPassword', ...)` built by `createPipeline`; no statement of the file names the audit table; acceptance: chain verifies and a Core boots (test/216 points 5 to 7; test/214 section 3) | - |
| SX-03 | MET | step 3: `fields.user !== RUNTIME_ROLE` and the host refused (`CONNECTION_NOT_RUNTIME`); step 4: `SESSION_IDENTITY` refuses another role, a superuser, another database (`ROLE_NOT_RUNTIME`); `cli/operator-set.ts`: `openPool: createRuntimePool`; grants: test/214 section 5, none missing | No owner role anywhere in the command |
| SX-04 | CAUTION | `cli/secret-prompt.ts` `createSecretPrompt`: `isTerminal()` first, nothing lifts it; bytes 0x03 / 0x04 abort; escape and control bytes refuse the entry and the rest of the line is discarded; bytes kept across reads and the whole line checked with `isUtf8`; nothing written per key; `finish` restores on every path; `processInterruptions` watches SIGTERM, SIGHUP, `uncaughtExceptionMonitor`; the header states "stops the accident, not a pseudo-terminal" | Built as required. CAUTION because the read path is proven through a terminal double only: C-9 (H5) and C-10 |
| SX-05 | MET | `cli/production-key-command.ts` `directoryRefusal`: `signer` and `handover` looked at with `lstat` (`inspectEntry`), link refused, owner, `signer` 0700; `writeRecord` and `host-key.ts` `writeNew`: `O_CREAT \| O_EXCL \| O_NOFOLLOW`; before OK: `loadSealingSigner` and `loaded.subject !== expectedSubject` | The command makes `signer` itself, non-recursively, so the store's own `mkdir` never follows a link |
| SX-06 | MET | `organisationOf`: `ORGANISATION_FORM`, 2 to 64, no trailing or double space, first character a letter or digit, the development mark refused in any case; `installationDeviceIdOf` CALLS `parseInstallationDeviceId` of `src/config.ts:314` (the loader's, `load-config.ts:99`); both before any directory or key | - |
| SX-07 | MET | step 4 of `runProductionKeyCommand`: `present`, `absent`, `store loads: yes / yes - DEVELOPMENT / no (<code>)`; runbook: `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md:118-123`; hand-over after the first production start: last line of `SELF_SIGNED_LIMITS` | - |
| SX-08 | CAUTION | `SELF_SIGNED_LIMITS` (six sentences) printed before the word, after OK, and written by `handoverRecordText`; installer note `:131` | The README third is not written: `git diff --stat -- README.md` is empty and no record of row 218 exists. C-11 |
| SX-11 | MET | `SET_CREDENTIAL` is an UPDATE with `RETURNING`; `updated.rows.length !== 1` throws `UnitStop(CREDENTIAL_ROW_COUNT)` and the unit rolls back; no INSERT of a credential in the file; `--data-dir` required and absolute in `parseArguments`; database, data directory, connection file and the operator list shown before `ports.ask` | The runtime role cannot INSERT a credential either (test/214 section 5: 42501) |
| SX-12 | MET | `checkSchemaVersion(pool)` then `SELECT_REASON_CONSTRAINTS`: both CHECKs must hold `'CREDENTIAL_REPLACED'` or `REASON_NOT_IN_SCHEMA`; `REPLACED_REASON` is the one reason; no other reason in the file | - |
| SX-13 | CAUTION | `packages/shared/src/api/password-policy.ts` `checkNewPasswordAgainst`: length in code points, control characters, printable ASCII, the demonstration password and the username folded and as a part, one-character rule; `createRunRepeatGuardWith`; `src/modules/identity/password-policy.ts` `createRunRepeatGuard` | The rules are met. CAUTION for C-1 (the run key and the static rules) and C-2 (`guard.remember(...).catch(() => undefined)`) |
| SX-14 | MET | `src/core/audit-details.ts:604-610`: five keys, closed (`targetOperatorId`, `method`, `sessionsEnded`, `earlierWasDemo`, optional `invokerUid`); `:667` severity WARNING, read by `fixedSeverityOf` in the command | No key can carry the password, its length, salt, tag or parameters |
| SX-15 | MET | `src/capture/fence/boot-key.ts` `storedBootSigningKey`: `readStoredCertificate` only, never throws, null pair on any failure; `fence/index.ts:717` is the one writer; the file header states the order (fence before `capture.boot`) and what the entry does NOT say | See section 7 (d) for the missing details rule |
| SX-16 | MET | `host-key.ts` `writeNew` (`fsyncSync` on each file), `syncDirectory`, `syncParentOf`; `boot/index.ts` `loadedOnce`, `storedSigningKeyReaders`, `signingKeyQuestionsOf`: one load per run of the boot step, outcome or thrown error shared by 4 and 4b | - |
| SX-17 | MET | `checks.ts` equals the baseline by blob and sha256 (section 2); `SELECT_STORED_HASH_SETS` equals the baseline line by sha256; in `boot/index.ts` the catch of `storedSigningKeyIsDevelopment` (answers `false`) and of `storedDemoPasswordOperators` (answers `null`) stand; the count moved into the exported `demoPasswordHashSetsAmong` with the same loop; `checks.test.ts` is unedited and passes 74 of 74 | `boot/__tests__/boot.test.ts` IS edited, by row 85 (C46), not by an X row: every mount gets the test host and five expectations gain the line `CAPTURE_HOST_PROFILE_NOT_ASKED`. No assertion on a refusal of 4, 4b or 4c changed. Gate 223 should say "unedited" of `checks.test.ts` and name this edit |
| SX-18 | MET | `scripts/secret-scan/count-only.mjs` `NEEDLES` (three new), `NAME_RULES`, applied to `--tracked` and `--staged`; positives and negatives: implementation/207 | Baseline: section 7 (h) |
| SX-19 | CAUTION | Synthetic values from `randomBytes` in every test file of the tier (`test/cli/operator-set-password.test.ts:13`, `.db.test.ts:158`, `secret-prompt.test.ts:14`, `.cache/task4-row220/bench-session.mts:84`); keys of rows 206, 208, 216, 220 in `mkdtemp` directories, removed and asserted gone; organisation text obviously synthetic; no `dems-row2*` or `dems-secret*` entry in the temporary folder today | Two departures: C-3 (the command's database tests name the default data directory) and C-4 (fixture key stores under `.data/`) |
| SX-20 | CAUTION | Installer note `:159` (host account is full control), `:160` (necessary conditions, not proof) | README half not written (row 218). C-11 |

## 4. R-X1 and R-X2 against the built code

| Id | Rating | Evidence |
|---|---|---|
| R-X1-1 | MET | `production-key-command.ts` imports no cryptography module; it receives a `SigningCertificate` only; `host-key.ts` `provisionSigningKey` returns the certificate and zeroes the wrap secret; `SignerError` holds a code and a key id. Note: `fileWrapSecrets(dir).get` is exported and returns the wrap secret - it has no caller in `src/` or `cli/` outside `host-key.ts` and `signer/index.ts` (grep) |
| R-X1-2 | MET | `src/sealing/__tests__/production-key.test.ts:376-480`: needles are the wrap secret, the key file, the opened key and the seed in five encodings, and the marker; searched in every line, both records |
| R-X1-3 | MET | `expectedEntries` loop: kind, owner, mode of the directory and three files; `STORE_NOT_AS_WRITTEN` and the line "What was written is LEFT" |
| R-X1-4 | MET | `cli/production-key.ts` reads no environment variable (grep: none); `ProvisionOptions` has no random member; static test `production-key.test.ts:484-495` |
| R-X1-5 | MET | as SX-06 |
| R-X1-6 | MET | no `unlink`, `rm`, `rename` in the two files (grep; the command's own static test) |
| R-X1-7 | MET | `directoryRefusal`: every ancestor a real directory of root or the caller, not writable by group or others; the data directory a real directory of the caller; `ROOT_REFUSED`, `USER_UNKNOWN` |
| R-X1-8 | CAUTION | The tests of rows 206, 208, 216, 220 provision into temporary directories only, and no record reports an open of `.data/signer`. But row 209's database cases provision test keys in row 61's fixture, a folder BELOW the repository's `.data/` (`src/capture/fence/__tests__/fence.db.test.ts:339`; `src/capture/boot/__tests__/support.ts:66`; implementation/209 line 100). The letter "no test names `.data/`" is not met. C-4 |
| R-X1-9 | MET | `src/evidence-verify/__tests__/development-key.test.ts:33`; the command asks both predicates (`isDevelopmentKeySubject`, `isDevelopmentSigningCertificate`) |
| R-X2-1 | MET | `parseArgs` strict, four options; `PASSWORD_VARIABLE_NAME` on names only; `--password` usage error tested (implementation/215 line 117) |
| R-X2-2 | CAUTION | Nothing is written per key and `finish` restores; proven on a double only. C-9, C-10 |
| R-X2-3 | MET | `runSetPasswordCommand` step 2 `ports.isTerminal()` (`isatty(0)` in the entry); `readSecretLine` refuses again; no flag |
| R-X2-4 | MET | test/216 section 3: 8 places x 44 needles = 352 searches, 0 hits, positive control found |
| R-X2-5 | MET | the one credential write is `SET_CREDENTIAL` with the record of `ports.hasher` = `hashPassword` in the entry |
| R-X2-6 | MET | `checkNewPassword` before `ports.hasher`; the demonstration constant bound by import in `identity/password-policy.ts:47`; missing fact throws |
| R-X2-7 | MET | steps c, d, e inside one `unitPipeline.run`; one transaction id (test/216) |
| R-X2-8 | MET | `DATABASE_IN_USE` twice; `SCHEMA_NOT_CURRENT`, `REASON_NOT_IN_SCHEMA` |
| R-X2-9 | MET, by the records | section 8 |
| R-X2-10 | MET | the file holds one UPDATE of `operator_credentials` and the two identity functions; the role cannot insert an operator (test/214 line 111) |
| R-X2-11 | MET | `storedHashSetIsDemoPassword`, `demoPasswordHashSetsAmong`, `SELECT_STORED_HASH_SETS` imported from `src/capture/boot` and used for the list and for the last line |

## 5. Findings of this review that no ruling named

### 5.1 Fixture key stores under the repository's `.data/` (MEDIUM) - C-4

Facts, by name, mode and time only:

- `.data/` holds **320 directories `test-row61-*`**, made between 9 October 23:00 and 13 October 12:00; 317 have a `signer` directory and **316 hold a `.p8` file**.
- Their names: `row140` (63), `row140d131` (49), `waveia2_adopt` (35), `d10volume` (33), `wavehd_stub` (31), `waveia2_restart` (29), `passj_restart` (27), `wavek_s1_restart` (27), `row140e2e` (15), `wavehspeech` (5), `row71b` (2), `boot`, `c1`, `d1b`, `wave-h-f` (1 each). **None is named after a bench-tier row** (`row208`, `row220`, `fence`): the bench rows' own counts of 0 hold today.
- The fixture makes its key with `provisionSigningKey({ dir, now: FIXTURE_NOW })` (`src/capture/boot/__tests__/support.ts:66`) and removes the folder in its own `remove()` (`:69`). `FIXTURE_NOW = 1_760_000_000_000` (`:17`), which is 9 October 2025; with 1,825 days the certificate is valid until October 2030. The subject is the DEFAULT one of `host-key.ts` (`DEFAULT_SUBJECT`): it carries no development mark.

Consequence: each of the 316 stores is the first case of finding F1-1 of review 07 - a key an agent's test made, which loads and which check 4b does not refuse. A `REAL_PRODUCTION` Core whose data directory is one of these folders passes 4 and 4b. It needs a deliberate wrong path, and 4c, 4d and 4e still stand; no key file was opened by this review, so "default subject" is read from the fixture's code, not from a certificate.

Why it is a caution of this tier although no bench row left them: row 209 extended a test file that provisions into this fixture; SX-19 says "temporary key directories are removed, also on failure"; R-X1-8 says no test names `.data/`. The fixture lives below `.data/` for a real reason (the worker path rule refuses a program below a world-writable temporary folder), so the rule's letter cannot be met by moving it without changing that rule.

Routing: (1) a test-hygiene row, new, proposed to the controller: the fixture marks its key as a development key (`provisionDevelopmentSigningKey`, or the development unit in the subject) wherever the case does not need a production-shaped one, and a start-of-run sweep reports folders of earlier runs; (2) **removal of the 320 folders is a deletion inside `.data/` and is the user's word** (global red line), not an agent's initiative; (3) row 228 (check 4b-2, whole-unit equality) ends the acceptance of a default-subject key in production and is the code answer.

### 5.2 The repeat check fails open after a commit (LOW) - C-2

`operator-set-password-command.ts`, after the unit of one operator: `await guard.remember(accepted).catch(() => undefined)`. The shared guard is written so that "a repeat is never 'not found' because the comparer broke" (`password-policy.ts`, `createRunRepeatGuardWith`), and the command undoes that for the remember half: if the digest fails once, the next operator may be given the same password and nothing says so. The failure is improbable (the key was imported a moment before). Fix: on a failed remember the walk stops with a named line "set and committed: ...; the repeat check is no longer available", as every other stop of the walk does. Row 215's owner, re-checked by row 222.

### 5.3 The command's database tests name the default data directory (LOW) - C-3

`test/cli/operator-set-password.db.test.ts:161` and `:448` pass `--data-dir db.run.dataDir`; `test/helpers/db/run.ts:384` makes that `DEFAULT_DATA_DIR`, the repository's `.data/`. So the command under test opened `.data/pg.env` itself in rows 215, 216 and 220 (their records say so: implementation/215 line 85, test/216 line 47, implementation/215b line 22). SX-19 says "no test resolves the default data directory".

Assessment: the command only READS there (it writes nothing into a data directory; its error log is a double in tests), the value is the development cluster's runtime-role credential that every database test of this repository has read through the same helper since task 2, and it reached no output (sweeps and scan: 0). It is also the only place where a file-borne credential authenticates end to end (section 7 (f)). Accepted for the bench as a stated exception; it must be written down as one. Row 223 states it; no code change asked.

### 5.4 Type-ahead between two hidden entries (LOW, HYPOTHESIS) - C-10

`createSecretPrompt.finish` puts the terminal back into its normal mode after EVERY entry, and the command hashes (one Argon2id derivation) and runs a transaction before the next label. In that interval the terminal echoes. A person who starts typing the next password before its label appears would see those characters. Not verified: no terminal was driven. It belongs in the attended check as one more step ("type before the label appears: nothing may show"); if it shows, the prompt keeps hidden input for the whole walk (row 213's file).

Also HYPOTHESIS, for the same check: after the echoed `SET` line the line reader has closed, and its key decoder is still attached to standard input until the next read; from the runtime's source as remembered it detaches without decoding. If that is wrong the typed bytes would pass through a text decoder inside the process - no disclosure, but a copy that cannot be zeroed.

## 6. Cautions and their rows

| Id | Caution | Severity | Row |
|---|---|---|---|
| C-1 | Web Crypto run key and HMAC in `identity/password-policy.ts`, unseen by identity static rule 2 and SR-61 | LOW | named entry in `src/modules/identity/__tests__/static.test.ts` at integration pass I-9 (row 212's owner); re-checked by row 222 |
| C-2 | `guard.remember` failure swallowed: the repeat check lapses silently | LOW | row 215's owner (fix wave); re-checked by row 222 |
| C-3 | The command's database tests name the default data directory (SX-19 letter) | LOW | row 223 states the exception |
| C-4 | 320 fixture folders under `.data/`, 316 with a test-made key that passes 4 and 4b; row 61's fixture is not a temporary directory (R-X1-8 letter) | MEDIUM | new test-hygiene row (controller); removal = the user's word; row 228 closes the acceptance in code |
| C-5 | Ancestors of the store checked at provisioning, not at each load | LOW | installer note `:168` already states it (row 217); the host-checks follow-up row of C49 (2) asks it at boot before a real examination |
| C-6 | `SYSTEM_BOOT` has no details rule; when the writer gets one it must admit null | LOW | next audit-vocabulary step (row 201's file set); named for row 86 |
| C-7 | Off Linux a `REAL_PRODUCTION` Core starts with a warning, the host profile unasked | MEDIUM | the follow-up row of C66 (1)(a); the user's decision C66 (1)(c); row 223 states list B8 |
| C-8 | "Core stopped" is known from connections only; no lock the command can test | MEDIUM for real examinations, LOW for the bench | new row before real examinations: a lock held by the running Core; hardware package `9A` measures the idle-connection hypothesis |
| C-9 | H5: no person has typed at the prompt on a real terminal | MEDIUM | the user, installer note 2.4 / `PREP-09` step 1 (rows 217, 219); row 223 lists it open |
| C-10 | Type-ahead echo between entries; the line reader before the hidden prompt | LOW | one added step in the attended check text (row 217); row 213's file if it shows |
| C-11 | README statements of SX-08 and SX-20 not written | LOW | row 218 (gate 223 depends on it) |

## 7. The items put to this review by name

**(a) C53 (2) / C67 (2): the per-run keyed digest. A named exception entry IS required; the helper is acceptable as built.**
The helper (`identity/password-policy.ts` `createRunRepeatGuard`): 32 bytes from the runtime's generator, imported as a non-extractable HMAC-SHA-256 key, the bytes zeroed in `finally`; only hex digests kept, in a `Set`, in memory; nothing written, nothing leaves the process; a failure is `RunRepeatGuardError`, never "no repeat". That is what SX-13 asked for, and it signs nothing that anyone verifies - it is a comparer, not a signature.
The rules: `CRYPTO` (`static.test.ts:32`) matches the text `'node:crypto'` and `Math.random`; `SIGNING` (`:37`) matches `createHmac`. `globalThis.crypto`, `getRandomValues` and `subtle.sign('HMAC', ...)` match neither, so "only tokens.ts names the crypto module" and "no signing secret" are green while the folder holds a second random source and an HMAC key. A rule that is green because of the spelling of the API is not met. Required: both patterns widened to see Web Crypto (`globalThis.crypto`, `crypto.subtle`, `getRandomValues`, `webcrypto`), and ONE named entry: `password-policy.ts`, for the run guard, with the three properties above asserted by the test (non-extractable import, no export call, no write). A third use then fails. C-1.

**(b) C64 / SR-9: the entry file's name. Purpose met; no exception entry required; the note must live where the rule lives.**
The rule (`test/static/credentials.test.ts:91-99`) tests the COMMAND text of each script for `passw|secret|token|credential|.data/`: a heuristic for "the script line carries a secret or reads the data directory". `tsx cli/operator-set.ts` carries neither, under either file name. Unlike (a), nothing the rule protects exists here under another spelling: there is no secret in the line to hide. But SR-9 is recorded in `decisions.md` only (grep of `test/static` and `src`: no `SR-9`). Asked: in `credentials.test.ts`, one assertion that pins the exact command of `operator:set-password` and says why the file has this name, so that the next reader does not "repair" the name or widen the script. Folded into the pass of C-1.

**(c) C54 (4): ancestors checked at provisioning only. Accepted, as a stated residual.**
`readStored` checks the store directory and each file on the open handle (`host-key.ts` `storeDirectoryPresent`, `readStored`). Whoever can write a parent can exchange the store between the look and the open; that person can also replace the Core's programs and its connection file, so the key store is not the weakest point of such a host. Walking the ancestors at every load would refuse every signer test on a Mac. Bench: accepted. Real examination: the parents are a host fact and belong to the host checks at boot (4d asks owner and mode of the programs already); installer note `:168` states the standing requirement. C-5.

**(d) C62 / row 209: `SYSTEM_BOOT` without a details rule. Accepted for the bench.**
Today the audit writer accepts any member on `SYSTEM_BOOT` (`audit-writer.ts` `checkAllowList` returns when the type has no rules); the one writer (`fence/index.ts:717`) goes through `systemBootDetailsOf`, which refuses a malformed member and half a pair. Both values are public. The risk is a mislabelled boot entry by another writer of the type, not a disclosure. Condition for the row that adds the rule: `SYSTEM_BOOT_SIGNING_DETAIL_RULES` marks both members OPTIONAL, and an optional rule still refuses a present `null` (`checkAllowList`: only `undefined` is "absent"). The boot writes the NULL pair when no certificate can be read. A writer rule taken as it stands would therefore fail the fence step of exactly the boots SX-15 says must not be altered. The rule must admit null for both, and case D2 of row 209 must still pass. C-6.

**(e) C66 (1): `CAPTURE_HOST_PROFILE_NOT_ASKED`. CAUTION.**
`checks.ts:459-463` (baseline, not an X row's change): off Linux the questions of the Linux host profile are not asked; the process's own facts and the two programs are still judged; one warning goes to the log and to the persistent error log. It is not in the audit chain and not in a manifest.
For a BENCH test all of these must be true: (1) the gate report and the README say this start is not a production gate (list B8); (2) the warning is present in the error log of that start and is quoted by the gate; (3) nothing recorded is evidence of a real examination; (4) the listeners stay on loopback.
Before a REAL examination: a start on Linux that logs `CAPTURE_HOST_CHECKS_PASSED` with the profile asked, OR the user's written decision that a named non-Linux host is allowed, in which case the skipped profile is a fact of the evidence (boot audit entry and manifest: C66 (1)(a)), not only of a log. Recommendation to the user: refuse off Linux by default and allow it by an explicit setting, so that the exception is a recorded decision and not a warning. C-7.

**(f) C66 (2), (3) and C68.**
- *The launcher instead of `src/index.ts`*: accepted for the bench. `src/index.ts:117-118` hands the host facts in exactly as `.cache/task4-row220/launch.mts:131-132` does; the launcher differs in the database name, data directory, port and error log. Unproven and stated: `src/index.ts` as a started `REAL_PRODUCTION` process. That is the first start on the production host (`9A/H-16`). Row 223 says so.
- *The connection-file checks of row 215b*: accepted as hardening. `connectionFileProblem` refuses a missing entry, a link, a non-file, a foreign owner and any group or other bit before the reader opens the file, and the summary shows the full path before the word. Two limits: the check and the open are two calls by name (a parent's writer could exchange the file in between - same class as (c)); a negative uid skips the owner check (a platform without user ids).
- *The in-memory credential in one database test*: accepted. That case proves the hand-over file -> pool with a synthetic value, which cannot authenticate. The file-borne credential authenticating end to end IS exercised - by the main cases of rows 215 and 216, on the default data directory (5.3). So nothing of the path is unproven on this Mac; what is unproven is an installation's own file on its own host.

**(g) Row 214: "Core stopped" from `pg_stat_activity` only. Accepted for the bench; not sufficient as the standing state.**
SX-01 as written is met. The integrity of the chain does not rest on it (trigger, chain lock, `AUDIT_HEAD_DIVERGED`). What stays: a Core that holds no connection at the two instants is not seen, and row 214's argument that a listening Core always holds one (5 s sweep, 10 s idle close) is a reading, not a measurement. The sound control is the one review 07 section 10 recorded: a lock the running Core holds and the command tests. C-8.

**(h) The three `private-key-pem` hits and the baseline. Accepted.**
`core/__tests__/writers.test.ts:616` (1), `evidence-export/__tests__/export.test.ts:272-273` (2): each is the bare opening line as a refused or detected test value, with no key body. `plugins/config/__tests__/load-config.test.ts:52` (`database-password-line`): a template with a marker constant. Row 207's hypothesis "planted fixtures" is confirmed by reading the lines. The baseline 3 / 1 / 0 with both name rules at 0 is confirmed by this review's own run. Recommendation, not a caution: pin the baseline by FILE and count, so that a hit moving to another file fails even when the total stays 3; keep 0 as the hard gate for logs, this task's docs and `.cache` (0 today).

**(i) H5, the attended check no agent ran. Open, and rightly so.**
No agent may run it (R-X2-9; an agent at a pseudo-terminal is the very thing the rule forbids). It does not block the bench gate, whose values are synthetic and go through the port. It BLOCKS the first real password on each host kind: one person, a throw-away value, macOS and Ubuntu 24.04, by installer note 2.4. Asked to be added to its steps: the word `SET` followed by the hidden prompt on one terminal (already named, note `:231`); Ctrl-C at the second entry; typing before the label appears (5.4). C-9, C-10.

## 8. The statement

**MADE, from the records:** no agent typed, generated for real use or read a real password or a real private key in rows 201 to 220.

| Row | What its record says |
|---|---|
| 201 | "no database, no process, no terminal, no key and no password in this row" (line 97) |
| 202 | "No device, no credential, no key"; throw-away databases dropped (lines 69, 121) |
| 206 | every key in a `mkdtemp` directory, removed and asserted gone; synthetic organisation (lines 69, 143) |
| 207 | planted values built at run time from `randomBytes`, joined from pieces; planted folder removed (line 58) |
| 208 | three key stores per run in temporary directories, gone after a failed run too; no key in the `.data` fixture (lines 90-95) |
| 209 | test keys made and removed with their folders; "no file of the repository's own `.data/signer` was opened"; the fixture below `.data/` (line 100) |
| 210, 211 | keys provisioned by the tests into directories of their own; a counting double (210 line 68; 211 line 77) |
| 212 | every value built in the run; the demonstration constant by import, its value in neither file (line 73) |
| 213 | every typed value from `node:crypto`; the read path through a double; no pseudo-terminal opened (lines 72-76) |
| 214 | the credential value from `randomBytes`; "this agent opened no credential file" (lines 59, 115) |
| 215, 215b | "no real password typed, read or kept; no credential file opened by this agent"; `.data/pg.env` stat-ed once, not read (215 line 142; 215b line 87) |
| 216 | run-generated values; 352 searches, 0 hits; "This agent opened no credential file" (lines 32, 47) |
| 220 | `randomBytes(24)` per operator; an injected prompt port; "no credential typed or read by this agent"; everything created shown gone (lines 24, 88) |

Three facts stand beside the statement and do not unmake it:

1. **Test PROCESSES started by agents read the two database connection files of the development cluster** (`.data/pg.env`, `.data/pg.owner.env`) through the database test helper, and the password command under test read `.data/pg.env` itself (5.3). These are role credentials of a local database, not an operator password and not a private key; no agent's tool opened them and no value reached an output (sweeps 0; scan needle `database-password-line` 0 in this task's records).
2. **Row 209's database cases made test keys in a fixture folder below `.data/`**, not in a temporary directory (5.1). They are test keys; none was made for real use.
3. **No agent drove a terminal entry**: `cli/operator-set.ts`, `cli/production-key.ts` and the attended check were never started by an agent (213, 215, 216, 220).

The limit of a statement from records: it says what the agents wrote down and what this review could check from outside (the scans, the names and modes of what is left). It cannot say what an agent did and did not record.

## 9. What was seen of rows 225 and 226 in `host-key.ts` (for row 230; nothing here breaks a bench-tier requirement)

- Boot checks 4 and 4b, the boot audit entry and the production key command's load all resolve the key through `activeSigningKeyId` (no caller hands a key id). SX-16 and SX-17 hold with the pointer in place; a store without a pointer loads as before.
- `production-key-command.ts` looks for the four names of the FIRST key id only (`SIGNER_STORE_NAMES`) while `loadSealingSigner` loads the ACTIVE one. On a rotated store whose first key's files were removed by hand, the command asks for the two values and the word and then fails at `provisionSigningKey` with `KEY_EXISTS` (the id is spent). Fail-closed and nothing is written, but late and with a store report that names the wrong id. Suggested for row 230: refuse before the prompts when the store holds a pointer or any entry of the series.
- `markSigningKeyCompromised` writes the mark without the directory look that every read has. For row 230.
- `activateSigningKey` uses one `renameSync`. R-X1-6 is a rule of the production key command, whose two files hold no rename; not a break.
- C69 (1), the signer cached per process, is row 226b's and is not judged here.

## 10. Alternatives weighed, assumptions, gaps

**Alternatives.** For (a): moving the run key into `tokens.ts`, the folder's one named user of the crypto module, was weighed and not asked - it would put a comparer beside the session token maker for the sake of a pattern; a named entry says the truth. For (b): renaming the file back with an allow-list entry was weighed; it buys nothing the pinned assertion does not. For 5.3: a temporary data directory with a copy of the real connection file was rejected - it would make an agent's test copy a credential file.

**Assumptions.** That the 316 fixture keys carry the default subject (read from the fixture's code; no key or certificate file was opened). That the row-61 fixture's `remove()` is skipped when a run is killed (the leftovers' spread over four days fits; not traced per folder). The two HYPOTHESES of 5.4.

**Not done.** No suite, no database, no terminal, no process start other than one unit test file and the scan. The database acceptance of rows 215, 216 and 220 is taken from their records, not re-run. `sealing/__tests__/production-key-proof.db.test.ts` was not read in full. The README was not reviewed beyond "the statements are absent". Row 217's and row 219's documents were read by grep for the passages a requirement names.

**Files written by this row.** This report and `delegation_progress/row_221.md`. No source file, no test file, no `decisions.md`, no tracking file. The agent definition's plan update and `implementation/99_implementation_report.md` were not written, on the launching instruction.

---
*Generated: 2026-10-13 13:10*
*Last Updated: 2026-10-13 13:10*
