---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: security-review
type: security review of a design (no code exists yet)
reviewed: masterplan/05_design_x1_x2.md (X-1 production evidence signing key, X-2 non-demo operator passwords)
decisions_read: U12, U15, U16, U17, U18, U19, P11, C29 (decisions/decisions.md:24, :56, :69-75)
status: complete
overall: CAUTION
---

# Security review: design X-1 and X-2

## 1. Verdicts

| Part | Subject | Verdict | Blocking for code? |
|---|---|---|---|
| 1 | X-1: production evidence signing key | CAUTION | No. Requirements SX-05 to SX-10, SX-15, SX-16 go into the rows |
| 2 | X-2: operator passwords from the host | CAUTION | No. Requirements SX-01 to SX-04, SX-11 to SX-14 go into the rows; H2 must be settled before any line of X2-3 |
| 3 | Boot checks 4, 4b, 4c after provisioning | CAUTION | No. Not weakened by the design; they are necessary conditions, not proof (section 5), and the acceptance diff has no baseline today (SX-17) |
| 4 | The design's own findings (G1 to G6) | CAUTION | Not for code. Blocking for a production recording of a real examination (section 6) |
| 5 | Tests on this Mac without a real secret | CAUTION | No. The design names no scan needle and does not say how a synthetic password is made (SX-18, SX-19) |
| - | **Overall** | **CAUTION** | **No FAIL. The task-architect may cut rows once every SX requirement below is carried by its work package** |

No finding is a FAIL: the design adds no cryptographic code, changes no boot condition, keeps both secrets out of arguments, environment, output and logs, and names its own limits. Every CAUTION below has a concrete requirement and an owner package.

What this review is and is not: a review of a design text against the code it rests on. Nothing was built, started, bound or connected. No file under `.data/` was opened; names and modes only. No file was changed except this report. The plan file `masterplan/02_plan.md` and `implementation/99_implementation_report.md` were not written, on the launching instruction "you change no file except your report".

## 2. Subject, stakeholders, method

**Subject.** Two host commands the user added by U19: `evidence:production-key` (X-1) and `operator:set-password` (X-2). Without them a `REAL_PRODUCTION` Core stops at boot checks 4, 4b, 4c.

**Stakeholders.** The user (owner of decisions UD-1 to UD-11); the installer; operators; a receiver or court-side verifier; the task-architect (cuts rows from this report and the design's section 8).

**Method.** Read-only reading of the design and of the code it cites, with `grep` and file reads. The Graft graph was not queried, for the reason the design gives (a query refreshes it, which writes). Commands run: `ls`, `grep`, `sed -n`, `git show`, `git status`. The value of the seed's demo password constant was masked in every read.

**Evidence rule.** A sentence with `path:line` was read on 2026-10-13 in the working tree of branch `task4/input-av-core-port`. Anything else is marked HYPOTHESIS or "not verified".

**Citation drift (finding, LOW).** The design cites `capture/boot/checks.ts:423-427`, `:429-435` and `capture/boot/index.ts:141-149`, `:157-163`, `:166`, `:179-198`. In the working tree the same code is at `checks.ts:440-452` and `boot/index.ts:198-262`; at HEAD (`3b388746`) checks 4, 4b, 4c are at `checks.ts:404-415`. Both files are modified and uncommitted (`git status`: ` M capture/boot/checks.ts`, ` M capture/boot/index.ts`). The CONTENT the design quotes is confirmed; the line numbers are not. Consequence: SX-17.

## 3. Part 1 - X-1, the production signing key: CAUTION

### 3.1 What is confirmed (PASS items)

| Question | Finding | Evidence |
|---|---|---|
| Algorithm | Ed25519, fixed by the code; no parameter selects another | `capture/signer/host-key.ts:189`; `capture/signer/types.ts:13` |
| Randomness actually used | `generateKeyPairSync('ed25519')`, `randomBytes(32)` for the wrap secret, `randomBytes(16)` for the serial: the operating system generator through OpenSSL. `ProvisionOptions` has `now`, `validityDays`, `subject`, `dir`, `keyId`, `wrapSecrets` and NO random source | `host-key.ts:31`, `:165-170`, `:189-197` |
| Where and with which modes | directory created 0700 and re-set by `chmodSync`; `.wrap` and `.p8` created with `flag: 'wx'` and mode 0600, then `chmodSync`; `.crt` 0644 | `host-key.ts:76-85`, `:181-182`, `:205-207` |
| Overwrite | Refused twice: the pre-check on four names (`KEY_EXISTS`), and exclusive create on each write | `host-key.ts:186-188`, `:78`, `:82-83` |
| What is returned and printed | The function returns the certificate (public). The development command prints directory, key id, subject, certificate sha256; an error is a code | `host-key.ts:208`; `sealing/dev-key-cli.ts:33-46` |
| Key at rest | PKCS#8 DER, encrypted AES-256-CBC with a 256-bit random secret; the secret buffer is zeroed after use | `host-key.ts:193`, `:209-211` |
| Load fails closed | compromised mark, absent, group/other bit, does not open, not Ed25519, certificate not this key's, not valid now | `host-key.ts:223-252` |
| The development mark is inside the signed certificate | The mark is the OU attribute of the subject, part of the to-be-signed bytes; a certificate whose self-signature fails is refused, so EDITING the subject text in the `.crt` yields `CERTIFICATE_INVALID` | `capture/signer/der.ts:83-87`, `:100-110`; `host-key.ts:129` |
| The mark is checked by boot AND by the seal AND read by the verifier | boot 4b; the sign step of the seal; the verifier's report line. One predicate, `isDevelopmentKeySubject` | `checks.ts:444`; `boot/index.ts:213-219`; `sealing/pipeline/pipeline.ts:799-801`; `packages/shared/src/evidence-verify/report.ts:28`, `:38-40` |
| The verifier holds the manifest's subject to the certificate | `CERTIFICATE_SUBJECT_MISMATCH` | `evidence-verify/verify.ts:285-286` |
| Trust is by CERTIFICATE digest, not by key | a re-issued certificate of the same key has another sha256 and is `CERTIFICATE_NOT_TRUSTED` for whoever pinned the first | `verify.ts:282-283`; `sealing-host/index.ts:725-732` |

### 3.2 Findings and requirements

**F1-1 (MEDIUM). "Production" is the absence of a mark; 4b is a blocklist.** Check 4b and the seal test one thing: the subject does not contain the development unit (`checks.ts:444`; `pipeline.ts:799`). Therefore 4b is satisfied by ANY loadable key without the mark, not only by one the new command made:

1. a key made by calling `provisionSigningKey` with no subject (default `O=DEMS Core, OU=Evidence signing`, `host-key.ts:46`, `:196`) - a three-line script, or a test helper pointed at the wrong directory;
2. the DEVELOPMENT key itself with a NEW certificate: whoever can read `.p8` and `.wrap` (the Core's OS user, `host-key.ts:16-21`) can sign a fresh self-signed certificate for the same key with any subject. The loader checks only "self-signature valid" and "public key equals the key's" (`host-key.ts:129`, `:247`), so it loads, and 4b passes.

Case 2 cannot be closed by any subject rule: a positive mark would be as self-asserted as a negative one. What a subject rule CAN close is case 1 (accident). The proposed installation binding (X1-5) does exactly that: with "OU equals `Evidence signing <configured id>`" a default-subject key and a test key no longer pass. This is the strongest reason for UD-4 = yes.
Requirement SX-10 (X1-5) and the statement of SX-08 (X1-1, X-D).

**F1-2 (MEDIUM). The directory rule must reach the leaf.** R-X1-7 tests the DATA directory. `provisionSigningKey` then runs `mkdirSync(dir, { recursive: true })` and `chmodSync(dir)` on `<data dir>/signer` (`host-key.ts:181-182`); both follow a link. A `signer` entry that is a link to another place sends key and wrap secret there. Requirement SX-05.

**F1-3 (MEDIUM). Provisioning is not atomic and not synced.** Order: wrap secret, key file, certificate (`host-key.ts:205-207`); no `fsync`, no temporary name. A stop between two writes leaves a store for which every later run answers `KEY_EXISTS` (`host-key.ts:186`) and which does not load (`KEY_ABSENT` or `CERTIFICATE_INVALID`). R-X1-6 ("never deletes") is right, but the installer must be told which state he is in, or he will delete a directory by hand without knowing whether it held a working key. A power loss shortly after "OK" can also lose files whose fingerprint was already handed over. Requirements SX-07 (X1-1, X-D) and SX-16 (X1-3).

**F1-4 (LOW). Typed subject text.** The DER writer stores the text as UTF8String without any escaping (`der.ts:29`, `:84-86`); the subject the Core and the verifier compare is Node's rendering, reversed and comma-joined (`host-key.ts:138`). A value with a comma, `=`, a quote, a leading or trailing space or a line break renders in another form than it was typed; a comma would let one attribute read as two. R-X1-5 refuses comma, `=`, line break and the mark, and leaves "letters" open. Requirement SX-06: ASCII only, and an exact round-trip comparison after provisioning. Not verified here: how Node renders a non-ASCII or escaped value (the reason for "ASCII only").

**F1-5 (MEDIUM, stated limit). What a self-signed certificate lets a verifier conclude.**

| A verifier CAN conclude | A verifier CANNOT conclude |
|---|---|
| With a fingerprint received from a person he trusts, by a channel other than the package: the package was signed by the holder of that key and has not changed since | Who the organisation is. The `O` and `OU` texts are typed by the installer; anyone with a key can write any name |
| The certificate's validity covered the stated signing instant (`verify.ts:280-281`) | WHEN it was signed. `signedAt` is the signer's own clock; the holder of the key can state any instant |
| The key was not a development key, IF the certificate is the pinned one | That the key is uncompromised. There is no revocation channel: a receiver who pinned a fingerprint learns of a compromise only if somebody tells him |
| Without a pinned fingerprint: the package is consistent with itself, nothing more | That the Core's software was unmodified, or that the host account was not misused (design 2.3 "outside what X-1 can defend": correct) |

Acceptable for this stage under the design's two conditions (printed by the command; hand-over as a runbook step) plus two it does not state: the fingerprint must travel by ANOTHER channel than the packages (a hand-over file on the same medium as an export proves nothing), and the list of everyone who received the fingerprint is kept, because they are who must be told after a compromise. Requirement SX-08.

**F1-6 (MEDIUM). Rotation and the retained set (Known limit 30).** Facts: one key id is loadable (`types.ts:11`; `sealing/signing.ts:36-38`; `sealing-host/index.ts:275`); `markSigningKeyCompromised` exists with no caller outside tests (`host-key.ts:260-265`; grep of `src/`, `cli/`, `scripts/`, `package.json`); the Core's verify trusts the current certificate only (`sealing-host/index.ts:725-732`).

Ruling on "one key id, no way out without X1-4":

- ACCEPTABLE for the first production boot and for bench recordings, if stated. Failure is closed in every case: an expired or marked key refuses the start (`host-key.ts:226`, `:248-250`; `checks.ts:441-442`). Nothing forged, nothing silently unsigned.
- NOT ACCEPTABLE as the standing state for recordings of real examinations. A suspected compromise then has one honest response - stop sealing - with no command to mark the key and no way to a new one; recordings made meanwhile wait in the store in plaintext (the boot text itself says so, `checks.ts:110`). The only improvised way out is deleting the key files and provisioning `-01` again, which reuses one key id for two keys and discards the certificate that verifies everything sealed before. The design's row "Key lost ... the first key id is free and the command works as on day one" (section 2.9) describes that reuse as normal; it should be the exception of an installation that has sealed nothing.
- So: X1-4 in this task (UD-5 = yes, concur), gating real examinations, not the first boot. Requirement SX-09.

On the design's open question "a package signed by a COMPROMISED key: notice, not failure" - ruling: never a plain pass. After a compromise the holder of the key can make a package with any `signedAt`. The Core's own verify has an independent record: the manifest digest it stored when it sealed (`sealing-host/index.ts:720`, `manifestSha256: item.manifestHash`). Pass WITH a named state is acceptable only where the manifest digest equals the one the Core's database holds for that evidence; any other package under a compromised key fails. A receiver's verifier has no such record and must say "signed by a key later marked compromised" as its own state. The spec's rule "a sealed manifest is never rewritten" is untouched by this.

On the proposed `ACTIVE` file: a mutable pointer in the signer directory decides which key signs. It needs the read rules of a key file (SX-09), and a malformed or unreadable pointer must refuse the start, not fall back to `-01`.

**F1-7 (LOW). `SYSTEM_BOOT` and the key (X1-2).** The row is appended by the capture FENCE boot step (`capture/fence/index.ts:480-491`), which is mounted before the boot checks (`boot/index.ts`, "Called once, by the capture unit, after the fence"). Not verified: the run order of the two steps. If the fence step runs first, the row is written before check 4 has accepted any key. Requirement SX-15.

**F1-8 (LOW). Two loads at boot.** Check 4 and check 4b each load the store (`boot/index.ts:198-205`, `:213-219`), and the seal loads it a third time, lazily and once per process (`sealing-host/index.ts:275`). `storedSigningKeyIsDevelopment` answers `false` when its load throws (`:216-218`): safe only because check 4 ran first. No requirement on the design; noted for X1-3 (SX-16), which already owns the read path.

**The installation-binding check (X1-5): concur, with conditions.** It is additive and `REAL_PRODUCTION` only; it catches a signer directory copied from another installation (a cloned host image is the realistic case: A8 says one room per Core) and the accident of F1-1. It proves nothing against the holder of the key. The comparison must be EQUALITY of the whole OU value with `Evidence signing <configured id>`: a test by `includes` or `endsWith` lets `DEMS-JKT-07` pass for a configured `JKT-07`. It must land with X1-4, not before: with one loadable key id a renamed installation would refuse to start with no way out.

**Smaller confirmations.** Refusing uid 0: concur. `--data-dir` required and absolute, no default: concur; on this Mac `.data/signer` already holds the three files with modes `-rw-------`, `-rw-------`, `-rw-r--r--` in a `drwx------` directory (names and modes only), so a run against the repository answers `KEY_EXISTS`. The confirmation word and the UTC validity window: concur. The provisioning record: a note, not evidence - the design says so; it must never become an input of any check.

## 4. Part 2 - X-2, operator passwords from the host: CAUTION

### 4.1 What is confirmed (PASS items)

| Question | Finding | Evidence |
|---|---|---|
| Hashing wrapper and parameters | Argon2id through `node:crypto`, 19,456 KiB, 2 passes, parallelism 1, 16-byte salt from `randomBytes`, 32-byte tag, compared with `timingSafeEqual`; errors carry a code only | `modules/identity/password-hash/password-hash.ts:33-55`, `:26-28`, `:276-279`, `:295-300` |
| The seed writes the one published constant for every operator | yes, one derivation each | `db/seed/seed.ts:232-240` |
| Lockout | per console, in memory, cleared by a restart; no lockout column on an account | `modules/identity/lockout.ts:5-7`; `limits.ts:11-16` |
| Sessions can be ended in one statement | `END_SESSIONS_OF_OPERATOR` | `modules/identity/session-store.ts:209-220` |
| Closed reason sets | eight session-end reasons, six biometric-revoke reasons; none fits a replaced credential | `db/schema/value-sets.ts:104-122` |
| The chain is enforced by the database | a BEFORE INSERT trigger refuses a row that does not continue the head and moves the head; a separate trigger makes the table append-only | `db/migrations/0002_audit_guards.sql:14-52`, `:67` |
| A running Core notices a foreign append | its next unit fails with `AUDIT_HEAD_DIVERGED` (503) and the engine reloads from the database | `core/audit-writer.ts:303-316`; `engine/host.ts:483-510` |
| No operation creates an operator at run time | the runtime role's INSERT list holds no `operators` | `db/migrations/0003_privileges.sql:20-23` |

### 4.2 Findings and requirements

**F2-1 (MEDIUM). "Core stopped" is a snapshot, taken minutes before the write.** The design reuses the reset's test: a count of other sessions in `pg_stat_activity` (`db/reset/routine.ts:129-131`, `:583-590`). Three weaknesses:

1. It is read once, then a person types passwords for minutes; a Core started meanwhile is not seen.
2. It sees CONNECTIONS, not a process. The Core's pool sets no idle rule (`plugins/db/index.ts:135-149`: no `idleTimeoutMillis`, no minimum), so the driver's default applies. HYPOTHESIS, not verified: an idle Core can for a moment hold no connection at all.
3. The Core takes no lock a command could test: the only advisory lock in the server is the reset's own (`routine.ts:121`; grep for `advisory`).

The consequence of a missed Core is bounded, and that is why this is not a FAIL: integrity of the chain is held by the trigger and by the chain lock every unit opens with (`core/unit-of-work.ts`, header, AP-2), not by "stopped"; a Core that was running fails closed and reloads (table above); a session is looked up for each request (`session-store.ts:55-60`, "as read for this request"), so ended sessions stop working. What remains is a Core that answers 503 until it has reloaded, in the middle of whatever it was doing - possibly a recording. Requirement SX-01.

**F2-2 (HIGH for the row, not for the design). The audit row must come from the Core's writer.** The design leaves this as H2. The hash of a row is NOT checked by the database (`core/audit-writer.ts:184-185`, "the digest, which the database does not check (GD-01)"): the trigger checks sequence and previous hash only (`0002_audit_guards.sql:34-37`). A hand-written INSERT with a wrong digest would be ACCEPTED and would break verification of the chain later, at the worst moment. So: the command builds its row with the shared code through the existing unit of work and audit writer, on its own pool, or it does not get written. If H2 does not hold, the row stops and returns for review; "its own append under the same protocol" (design 3.7) is not approved by this review. Requirement SX-02.

Can a host command append correctly without the Core? Yes in principle: the unit of work needs a pool, the writer needs a clock, a logger and an error log (`audit-writer.ts:93-97`), and the type must be in the shared vocabulary with a details rule (`audit-writer.ts:101-103`, `:122-146`) - which is package X-C. Not verified here: whether the engine expects an `events` row or a counter beside a server-native audit row, and whether any reader requires `at` to be non-decreasing along the chain (the command's clock is the host's, read after the Core stopped). Both are tested by the acceptance of SX-02.

**F2-3 (MEDIUM). The owner role is more than the job needs.** The design connects as `dems_owner` (`db/commands/owner-connection.ts:4-7`). That role owns the tables: it can disable the append-only trigger (a test does exactly that: `core/__tests__/boot-checks.db.test.ts:119`), insert operators and alter constraints. The job needs four things, and the RUNTIME role has precisely those: UPDATE of the seven credential columns (`0003_privileges.sql:31`), UPDATE of `ended_at`, `end_reason` on sessions (`:33`), UPDATE of `revoked_at`, `revoke_reason` on biometric tokens (`:41`), INSERT into `audit_log` (`:20-23`) and EXECUTE on the chain lock (`:66`). Running as `dems_app` through the Core's own connection file (`config.ts:127-135`) makes the database itself hold R-X2-10 ("creates no operator, changes no role"), makes H2 the natural case (the unit of work is written for the runtime pool), and removes the question of who may name the owner file. Not verified: the grants of the later migrations (0013 onward). Requirement SX-03.

This does not change who can run it: whoever has the Core's OS account can read either connection file.

**F2-4 (MEDIUM). The terminal prompt.** Nothing exists (design B23: confirmed by grep for `setRawMode`, `stty`, `read -s`: no match in `src/`, `cli/`, `scripts/`). The design's rule is right - refuse when standard input is not a terminal, no flag lifts it, no argument, no environment variable, nothing echoed, not even a mask. Missing from it:

1. In raw mode Ctrl-C is a byte, not a signal: the port must treat bytes 0x03 and 0x04 as "abort" itself, and restore the terminal on SIGTERM, SIGHUP and an uncaught error too.
2. Escape sequences (arrow keys, a bracketed paste, a function key) arrive as bytes; taken silently they become part of a password nobody can type on a tablet. Any control character is a refusal of that entry.
3. UTF-8 arrives in pieces; a multi-byte character split over two reads must be decoded across them.
4. The test "is a terminal" does not stop a program that opens a pseudo-terminal. It stops the accident (a pipe, a here-document, a CI job), not an agent that wants around it. R-X2-9 is a RULE for agents, not a control; the document must say which is which.
5. A terminal recorder that logs input, a remote session and a screen share are outside the command's reach: runbook text.

Requirement SX-04. The shell history holds the command line with `--username` or `--all-demo` and the database name only: no secret.

**F2-5 (MEDIUM). One code path; no second meaning for a reason.** The design offers that bootstrap need not wait for the `CREDENTIAL_REPLACED` migration because a first boot has no sessions. Ruling: no. One path, and it already has the rule (R-X2-8: refused on a database not migrated to the current schema). Reusing `SIGNED_OUT` is rejected, as the design says. Requirement SX-12.

**F2-6 (LOW). The credential write must hit exactly one row.** The design says "write the seven credential columns". An operator without a credential row (possible only by a direct edit) must be an error and a rollback, not an INSERT - and with the runtime role an INSERT is refused by the database anyway. Requirement SX-11.

**F2-7 (LOW). Policy.** Concur with the design's numbers: minimum 12, maximum 128 code units (`password-hash.ts:57-58`), no composition rules, the demo password and the username refused, no expiry. Additions, requirement SX-13:

- The hash takes the bytes as typed, without normalisation (`password-hash.ts:23-24`, `:195`). A character outside ASCII can leave three keyboards (macOS, Android tablet, Android phone) as different bytes; the operator then cannot sign in and the only remedy is the host command again. Default: printable ASCII only; a decision for the user (UD-12 below), an availability rule, not a strength rule.
- The web console trims the USERNAME (`apps/core-web/src/features/login/use-login-controller.ts:322`); not verified: whether any client trims the password. The row reads the three sign-in forms and refuses whatever a client cannot send unchanged.
- Refuse the demo password and the username case-insensitively, and a value that merely contains the username.
- "No reuse of one password for all unless explicitly typed": the design says equality cannot be seen without keeping plaintext. Within ONE run it can: keep a keyed digest (a random key made for the run, in memory only) of each value set in this run and refuse a repeat. Nothing is written; the limit is "within one walk".
- Length counted in code points for the minimum; the maximum stays the wrapper's.

A word list of common passwords is not required by this review; the online brake is five attempts per console and minute-long locks (`lockout.ts:5`), and the first defence is the length.

**F2-8 (LOW). The audit row.** Concur: type `OPERATOR_PASSWORD_SET`, actor null, no password, no length, no salt, no tag, no parameters. Additions (SX-14): severity WARNING so it stands out in the security view; a details rule in the allow-list so no other key can enter (`audit-writer.ts:122-146`); optionally the numeric uid of the invoking OS user - a fact, not a proof.

**Recovery of the last Supervisor, and the backdoor question - said plainly.** There is no account lockout to clear: the lock is per console, 60 s, in memory (`lockout.ts:5-7`). "Locked out" can only mean "forgot the password". The host command is the break-glass, and it is not a new capability:

> Whoever can log in to the host as the Core's OS user can already read both database connection files and the signing key with its wrap secret. That person can set any operator's password, can remove the audit row that says so (the owner role can disable the append-only trigger), and can sign evidence. X-2 adds no power to that account; it adds a correct hash, ended sessions and an audit row that an honest installer leaves behind. The audit row proves THAT and WHEN, never WHO, and it is not proof against the host account itself.

This sentence belongs in the README (SX-20). It is also why "who has the host account" is the one control that everything else rests on.

**Lockout state.** Nothing to reset: memory only, and the Core is stopped. Confirmed, no requirement.

## 5. Part 3 - the boot checks after provisioning: CAUTION

The exact conditions, as in the working tree:

| Check | Condition that REFUSES | Evidence |
|---|---|---|
| 4 | `deps.signingKeyProblem() !== null`, i.e. `loadSoftwareSigner({ dir, now })` threw | `checks.ts:441-442`; `boot/index.ts:198-205` |
| 4b | `operation === REAL_PRODUCTION && deps.signingKeyIsDevelopment()` | `checks.ts:444`; `boot/index.ts:213-219` |
| 4c | `REAL_PRODUCTION` and (the count is null, not a safe integer or negative -> `OPERATORS_UNREADABLE`; or the count is above 0) | `checks.ts:447-452` |
| 4c reader | every row of `operator_credentials`, no filter; each verified against the constant; any throw gives null | `boot/index.ts:222`, `:239-254` |

**Are they satisfied ONLY by correct provisioning? No - and the design should not be read as saying so.** They are necessary conditions.

- Check 4: any key that loads.
- Check 4b: any key without the mark (F1-1).
- Check 4c: any state in which no row verifies against the one constant. That includes an EMPTY credential table (count 0: the Core starts and nobody can sign in), a row whose hash was written by SQL, and a password one character away from the published one set by SQL. A malformed row refuses (the verifier throws `RECORD_INVALID`, `password-hash.ts:304`; the reader returns null).

None of these is reachable without the host account, which is why this is a statement and not a defect. X-2's policy is enforced by the COMMAND, not by the boot.

**Are they edited or weakened by a work package?** By the design as written: no. Risks in the packages, each with a requirement:

| Package | Touches | Risk | Requirement |
|---|---|---|---|
| X2-3 | `boot/index.ts`: export the per-row predicate | a refactor that adds a filter (`enabled`), drops the fail-closed catch or changes the statement | SX-17: `SELECT_STORED_HASH_SETS` byte-identical, the catch stays, existing tests of the check run unedited |
| X1-4 | the loader (`sealing/signing.ts`, `host-key.ts`): active key id | boot checks 4 / 4b test one key id while the seal signs with another | SX-09: ONE resolver of the active id for boot, seal, transcripts and verify, held equal by a test |
| X1-3 | `host-key.ts` read path | none: it tightens check 4 | existing signer tests unedited |
| X1-5 | `checks.ts`: new check 4b-2 | an edit that reorders or merges 4b | SX-10: added lines only, after 4b, `REAL_PRODUCTION` only |
| X1-2 | fence boot step | a failure to read the certificate that changes or stops the boot differently | SX-15 |

**The acceptance criterion has no baseline today.** Design 10 (2) asks that `git diff` of `checks.ts` show no change to 4, 4b, 4c. The file is modified and uncommitted now, by other rows of this task (host checks 4d, 4e). Requirement SX-17.

## 6. Part 4 - the design's own findings: CAUTION

Confirmed in the code: three operators with fixed names and usernames (`packages/shared/src/sim/dataset.ts:113-146`); the seed is the only writer of operators and writes the dataset with them (`db/seed/seed.ts:232-240`; `checks.ts:33-34`: "until it exists, a seeded database is not a production one"); the cards print the published demo password (README Known limit 34, with its file lines; S99-01 at `docs/2026-10-07_dems_real_capture_sealing/verification/02_security.md:56`). Not verified by this review: the mobile card's lines, and what else of the dataset (cases, evidence items, paired devices, alerts) a seeded production database holds - the design marks that inventory as not made (G2), and it must be made.

### The list for the user

**A. Must be closed BEFORE a production recording of a real examination**

| # | What | Why it cannot wait |
|---|---|---|
| A1 | Real, named operator accounts (G1; UD-8) | Every audit row and every custody entry names its actor. With the seeded accounts they would name three persons of the demo dataset, not the officers who acted |
| A2 | A production seed: roles and permissions without demo persons, demo cases and demo evidence; `db:seed` and `db:reset` refuse a production environment (G2; S99-01 (b)) | Demonstration items would stand in the same evidence register and the same audit chain as real evidence |
| A3 | The sign-in cards show no demo disclosure in `REAL_PRODUCTION` (G3) | After X-2 the printed password opens nothing, but the card still lists usernames and presents the installation as a demonstration; SR-63 C4 makes it mandatory the moment a listener leaves loopback |
| A4 | Rotation, the compromise mark and the retained certificate set (X1-4; Known limit 30) | F1-6: without it a suspected compromise has no clean response |
| A5 | Read-path hardening of the signer store (X1-3; S99-06) | First time the store holds a key that matters |
| A6 | The fingerprint handed over to whoever will verify, by a channel other than the packages, and the list of receivers kept | Without it a package is "consistent with itself" only (F1-5) |
| A7 | Each operator's password known to that operator alone: typed by the operator at the installation (UD-7 default), OR a signed-in password change exists (G4) | A password the installer typed is known to two people; actions under it cannot be attributed to one |
| A8 | The user's decision on Known limit 37 (no escrow of the session keys; SEC35-09) | Loss of `<data directory>/credential-store` makes every sealed recording unreadable for ever. Not an attack; a custody decision that must be taken knowingly before real evidence exists |
| A9 | One complete `REAL_PRODUCTION` start on the production host, Linux (G6; X-G) and the attended hardware acceptance | On this Mac the Linux host questions are not asked at all (`checks.ts:459-462`: a warning); a production Core has never started |

**B. Acceptable for a bench test on the user's bench, IF STATED in the README and the gate report**

| # | What | Condition |
|---|---|---|
| B1 | The three demo persons as accounts | with non-demo passwords set by X-2; recordings are test recordings, named as such |
| B2 | The demo dataset in the database | no real examination is recorded into it |
| B3 | The cards still print the (now useless) demo password | loopback only |
| B4 | One key id, no rotation, no compromise command | the key protects test recordings only |
| B5 | Self-signed certificate, no hand-over yet | nobody outside receives a package as evidence |
| B6 | No console password change; every change needs the host | stated |
| B7 | No escrow of session keys | bench recordings are disposable |
| B8 | macOS host: the Linux host profile unchecked | stated as the reason the gate is not a production gate |

Still in force and unchanged by X-1 / X-2: agents search and test connections only, record nothing from the real devices and change no camera address (U18); real-device work uses a spare lane with its own database and media store, never the user's lanes or the demo database (C29, P11 (2)); the bench input-av is not for real examinations (U12 B7).

## 7. Part 5 - tests on a development Mac without a real secret: CAUTION

**Confirmed.** X-1 needs no typed secret, so its tests are real and throw-away (design 2.11): sound. The design forbids any test from naming the repository's `.data/` (R-X1-8) and puts password tests on a throw-away test database (R-X2-9, C29): sound. `.gitignore` ignores `/.data/` as a place and `*.p8`, `*.wrap`, `*.blob` by form (`.gitignore:71`, `:104-106`). Thirteen existing test files already call the provisioning functions; not verified one by one that each uses a temporary directory.

**Findings.**

1. **The design names no needle for the count-only scan.** The scan has six pattern needles and, by its own header, no value needle (`scripts/secret-scan/count-only.mjs:36-45`, `:17-18`). A typed password cannot be a needle; a FORM can. Requirement SX-18.
2. **R-X1-2's marker never matches the key file.** The private key is exported as DER, not PEM (`host-key.ts:193`): the bytes hold no `PRIVATE KEY` text. Keep the marker (it catches a future PEM leak) and rely on the two byte checks the requirement already lists.
3. **How a synthetic password is made is not said.** A constant in a test file is a new published password of this repository, one `git grep` away - the very thing X-2 removes. Requirement SX-19.
4. **A leftover of the gate.** X-G provisions a key with a PRODUCTION subject and sets passwords on a database. If the temporary directory or the database outlives the run, a later Core pointed at them passes 4, 4b and 4c with a key and passwords an agent made. Requirement SX-19.

## 8. Ranked requirements

Rank 1 = settle before the first line of that row. Rank 2 = part of the row's acceptance. Rank 3 = text and tests.

| Rank | Id | Package | Requirement |
|---|---|---|---|
| 1 | SX-02 | X2-3 | The audit row is built by the existing unit of work and audit writer with the shared chain code, on the command's own pool. No hand-written INSERT into `audit_log`. If H2 fails: stop, report, new review. Acceptance: after the command, the Core's own chain verification passes and a Core boots on that database |
| 1 | SX-03 | X2-3 | Connect as the runtime role `dems_app` through the Core's connection file; the grants needed exist (`0003_privileges.sql:20-23`, `:31`, `:33`, `:41`, `:66`; the row checks the later migrations). The owner role only with a written reason accepted by the controller; never DDL, never a trigger change |
| 1 | SX-17 | X-G (baseline taken by the controller before the first X row) | Record the sha256 of `capture/boot/checks.ts` and `capture/boot/index.ts` at the commit the X rows start from. Acceptance compares the three conditions and `SELECT_STORED_HASH_SETS` by symbol against that baseline; the existing tests of checks 4, 4b, 4c run unedited. Rows cite code by symbol, not by the design's line numbers |
| 1 | SX-09 | X1-4 | (a) ONE function resolves the active key id for boot checks 4 / 4b, the seal, transcript revisions and verify; a test holds them equal. (b) A pointer file is read under the key-file rules; malformed or unreadable = refuse the start, never a fall-back. (c) The retained set: each certificate parsed and self-verified; development-marked certificates never trusted by a `REAL_PRODUCTION` Core. (d) A package under a COMPROMISED key is never a plain pass: a named state, passing only where the manifest digest equals the one the Core's database stored; otherwise fail. (e) A key id is never reused for another key once rotation exists. Gates real examinations, not the first boot |
| 2 | SX-01 | X2-3 | The "no other session on this database" test runs before the first prompt AND again inside each operator's transaction after the chain lock; it counts every role and excludes its own backend. The runbook and the refusal text say that the test sees connections, not a process, and that a Core started during the run will answer 503 and reload |
| 2 | SX-04 | X2-2 | Refuse unless standard input is a terminal, no flag or variable lifts it. Bytes 0x03 / 0x04 abort; SIGTERM, SIGHUP and an uncaught error restore the terminal. Any control character or escape sequence refuses the entry. UTF-8 decoded across reads. Nothing written per key. The document states that the terminal test stops accidents, not a pseudo-terminal: R-X2-9 is the rule for agents |
| 2 | SX-05 | X1-1 | The directory rule covers the `signer` and `handover` entries themselves (`lstat`; not a link; if present: owned by the caller, 0700 for `signer`). Every new file is created exclusively. Before "OK" the command runs the real load (`loadSoftwareSigner` with the instant) and compares the parsed subject with the expected text, exactly |
| 2 | SX-06 | X1-1 | Organisation: ASCII letters, digits, space, hyphen, full stop; 2 to 64; no leading, trailing or double space. Installation id: the ONE pattern the configuration loader applies to `DEMS_INSTALLATION_DEVICE_ID`, imported, not copied. Refused before any key exists |
| 2 | SX-07 | X1-1, X-D | On `KEY_EXISTS` the command says which of the four names exist (names only) and whether the store loads. The runbook describes an incomplete store and that removing it is the installer's own act. The fingerprint is handed over only after the first successful production boot |
| 2 | SX-10 | X1-5 | Equality of the whole OU value with `Evidence signing <configured id>`; `REAL_PRODUCTION` only; added lines after 4b; lands with X1-4, not before. The negative controls: a default-subject key and a key of another installation are refused |
| 2 | SX-11 | X2-3 | The credential UPDATE must affect exactly one row, else roll back; no INSERT of a credential. `--data-dir` is required (no default to the repository's `.data/`), and database, data directory and operator list are shown and confirmed before the first prompt |
| 2 | SX-12 | X2-3, X-C | One path: the command refuses a schema without `CREDENTIAL_REPLACED`. No reuse of `SIGNED_OUT`. Bootstrap waits for X-C |
| 2 | SX-13 | X2-1 | Minimum counted in code points. Control characters refused. Printable ASCII only unless the user rules otherwise (UD-12). Whatever a client's sign-in form cannot send unchanged is refused (the row reads the three forms). Demo password and username refused case-insensitively, also as a part. Within one run a value already set in this run is refused (keyed digest, memory only, never written) |
| 2 | SX-16 | X1-3 | Besides S99-06: sync the three files and the directory at provisioning; boot checks 4 and 4b judge ONE loaded certificate |
| 2 | SX-19 | X2-3, X-G | Synthetic passwords are generated from randomness at run time; none is a literal in a source file, fixture, log or report. Test databases carry the test name pattern and are dropped at the end; temporary key directories are removed, also on failure. A test key's organisation is one fixed, obviously synthetic text. No test resolves the default data directory. The gate report lists what it created and proves it gone |
| 3 | SX-08 | X1-1, X-D | Printed by the command, in the hand-over record and in the README: self-signed, no authority; the names in the certificate are typed, not proven; the signing instant is the signer's own clock; there is no revocation channel; the fingerprint travels by another channel than the packages; keep the list of receivers |
| 3 | SX-14 | X2-3, X-C | Audit row severity WARNING; a details rule in the allow-list (target operator id, method, sessions ended, earlier credential was the demo one; optionally the numeric uid); never the password, its length, salt, tag or parameters |
| 3 | SX-15 | X1-2 | The two new members come from the PUBLIC certificate (`readStoredCertificate`), never from a private-key load; null when it cannot be read; reading them never fails, delays or alters a boot. The row verifies the order of the fence step and the boot checks and says what the row means when written before check 4 |
| 3 | SX-18 | X1-1 (one writer of `scripts/secret-scan`); run by X-G | New needles: `private-key-pem` (a PEM private-key header of any kind), `database-password-line` (the two password keys of the connection files followed by a value), `argon2-encoded` (the encoded hash form). New by-name hits for `--tracked` and `--staged`: a file ending `.p8` or `.wrap`, or named as one of the two connection files. Each needle with a planted positive and a negative in `count-only.test.mjs` |
| 3 | SX-20 | X-D | README states: the host account of the Core's user is full control of every operator account, of the audit log and of the signing key; checks 4, 4b, 4c are necessary conditions, not proof of correct provisioning; the two lists of section 6; no example password anywhere |

## 9. What the user must be told and must decide

**To be told (no decision needed).**

1. After X-1 and X-2 a production Core can START. It is not thereby fit to record a real examination: list A of section 6.
2. The certificate is self-signed. It proves "same key, unchanged", and only to someone who received the fingerprint from a person, separately from the evidence.
3. Whoever has the Core's host account controls every operator account, the audit log and the signing key. Both commands leave a trace an honest installer cannot avoid; neither is a control against that account.
4. The boot checks refuse the known bad states (no key, development key, published password). They do not prove that provisioning was done properly.
5. Agents will never type or hold a real password; the terminal prompt gets one attended check by the user.

**To decide.** The design's defaults, with this review's position.

| Id | Decision | Design's default | Review |
|---|---|---|---|
| UD-1 | Algorithm | Ed25519, fixed by the code | Concur |
| UD-2 | Key in a file, or hardware | File, as built | Concur for now; the hardware key is the only measure against the host account |
| UD-3 | Self-signed, or a chain | Self-signed, stated | Concur, with SX-08 |
| UD-4 | Refuse a key that names another installation | Yes, with rotation | Concur; exact match (SX-10). It also closes the accident of F1-1 |
| UD-5 | Rotation and the retained set in this task | Yes, not gating the first boot | Concur, and tighter: it gates real examinations (A4) |
| UD-6 | Password policy | 12 to 128, no composition rules, demo password and username refused, no expiry | Concur, with SX-13 |
| UD-7 | Who types each password | Each operator, present; the Supervisor first | Concur. The alternative (the installer types all) is not acceptable for real examinations until a signed-in change exists (A7) |
| UD-8 | The three demo persons as production accounts | Not for a real examination; enough for search and connection test | Concur (A1) |
| UD-9 | Validity | 1,825 days | Concur. No command parameter now; if one is added later it is bounded |
| UD-10 | Backup of the signing key | None; certificates only | Concur |
| UD-11 | Signer read-path hardening in this task | Yes (X1-3) | Concur, and before the first production recording (A5) |
| UD-12 (new) | Characters outside ASCII in a password | - | Recommend: refused, because sign-in does not normalise and three keyboards differ (SX-13) |
| UD-13 (new) | Known limit 37, escrow of session keys | open since D241 | Must be ruled before real evidence exists (A8). This review does not recommend a design for it |

## 10. Alternatives considered, assumptions, gaps

**Alternatives this review weighed.** A positive "production" mark in the certificate (rejected: as self-asserted as the negative one; the installation binding gives the useful part). The owner role for X-2 (the design's choice; replaced by the runtime role, SX-03). A lock held by the running Core that a command could test (the sound fix for F2-1; it is a change to the Core's start and is not required here because the failure is closed - recorded as a hardening). A common-password word list (not required).

**Assumptions, each marked where used.** The pool's idle behaviour (F2-1, HYPOTHESIS). The order of the fence boot step and the boot checks (F1-7). The grants of migrations after 0012 (F2-3). Node's rendering of unusual subject text (F1-4). Whether any reader of the chain requires non-decreasing times (F2-2).

**Not read.** The evidence package spec lines the design cites for rotation (`06_evidence_package_spec.md:826-829`, `:1124`, `:1133-1135`); the mobile sign-in card; `sealing/__tests__`; the content of any file under `.data/`. The three security findings were read at `docs/2026-10-07_dems_real_capture_sealing/verification/02_security.md:56` (S99-01), `:61` (S99-06), `:117` and `:174` (SEC35-09); README Known limits 25, 30, 34, 37 and the paragraph "The signing key" at `README.md:503`.

**Next step.** The task-architect cuts rows from the design's section 8 with section 8 of this report attached row by row; a security acceptance of the BUILT commands precedes X-G (design section 7, step 6).

---
*Generated: 2026-10-13*
*Last Updated: 2026-10-13*
