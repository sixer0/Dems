---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 230
date: 2026-10-13
agent: security-review
type: security review of code AS BUILT (rotation and installation binding of M11: rows 225, 226, 226b, 226c, 227, 227b, 228, 229, contract step V4 item 7)
reviewed_tree: branch task4/input-av-core-port, working tree over head 0f5d2a8e (uncommitted)
requirements: SX-09 (a) to (e), SX-10 (verification/07_security_x1_x2.md); item A4 of its section 6
decisions_read: C69, C71, C72, C77, C79, C81, C83; UD-4, UD-5; design 2.5, 2.7, 2.10, A2
status: complete
overall: CAUTION
---

# Row 230 - security review of key rotation and the installation binding as built

## 1. Verdict

**CAUTION. No FAIL: nothing found stops the work for the user.**

| Requirement | Rating | In a few words |
|---|---|---|
| SX-09 (a) one resolver | PASS | `activeSigningKeyId` is the only reader of the pointer; boot, seal, export, revisions and verify reach the store without a key id |
| SX-09 (b) the pointer | PASS | read as a private key file, refused by one code, never a fall-back; written staged, synced, one rename, directory synced |
| SX-09 (c) the retained set | PASS | each certificate parsed and self-verified; never-active and development-marked ones are not trusted |
| SX-09 (d) under a compromised key | CAUTION | the Core's ANSWER is never a plain pass; the audit and custody row of that verification IS one; the receiver's verifier has no input for a mark; such a package cannot be exported |
| SX-09 (e) no id reuse | PASS, one LOW caution | holds for every act of the commands; a store edited by hand can bring the first id back |
| SX-10 the installation binding | PASS, one caution | equality of the one parsed unit, `REAL_PRODUCTION` only, added lines only; the test fixtures' id `DEMS-TEST-01` is not reserved |

Eleven cautions (section 6): three MEDIUM that belong on the list "before a real examination", one MEDIUM of documentation, seven LOW. Each has a row.

**The A4 statement is MADE, with its limits (section 8).**

## 2. Subject, stakeholders, scope, method

- **Subject.** The evidence signing key of a Core after rotation exists: which key signs, what a compromise mark does, which certificates the Core trusts, and whether a production Core accepts a key that does not name its installation.
- **Stakeholders.** The user (owner of the list "before a real examination" and of every decision routed to him here); the installer at the host (runs the three key commands); an examiner or receiver who verifies an exported package; the controller (routes the cautions); rows 231 (commit) and 139 (code review).
- **Timeline.** Design review 07 on 12 October; rows 225 to 229 and 226b, 226c, 227b on 13 October; this review 13 October, 14:10 to 14:45, on the uncommitted tree.
- **Scope.** Read: `src/capture/signer/host-key.ts`, `types.ts`; `src/sealing-host/index.ts` (the doors and `signingNow`); `src/capture/boot/checks.ts` (diff against head), `boot/index.ts`; `src/sealing/signing.ts`; `src/evidence-verify/index.ts` and `src/evidence-export/host.ts` (changed lines); `src/sealing-host/demo-seed/seed-hook.ts`; `cli/rotate-key-command.ts`, `cli/mark-compromised-command.ts`, `cli/rotate-key.ts`; the headers and case names of `test/static/cli.test.ts` and `src/sealing/__tests__/active-key-call-sites.test.ts`; the records named in the brief.
- **Method.** Reading by symbol; `git diff HEAD` and `git hash-object`; grep of every call that loads a signer or signs; ONE unit file run. No suite, no database, no process started other than that file. No key, wrap, pointer or certificate file under `.data/` was opened: names, modes and counts only.

Evidence produced by this review:

| Check | Command | Result |
|---|---|---|
| `checks.ts` is the stated blob | `git hash-object src/capture/boot/checks.ts` | `3dfea759...`; head holds `1697e4b9...` |
| Only added lines | `git diff HEAD -- src/capture/boot/checks.ts` | 5 hunks, 26 insertions, 0 deletions; the lines of checks 4, 4b and 4c are context lines, unchanged |
| The sign-time guard | `npx vitest run src/capture/signer/__tests__/sign-time-guard.test.ts` | 1 file, 11 tests passed |
| Who signs | grep of `sign(null`, `.sign(`, `loadSealingSigner`, `loadSoftwareSigner` over `src/` and `cli/` without tests | section 5 |
| Fixture stores today | `ls -d .data/test-row61-*`, `find ... -name '*.p8'` (names only) | 322 folders, 319 with `signer`, 318 with a `.p8`, 0 with a pointer (221 counted 320 / 317 / 316) |

`boot/index.ts` is blob `7a2a2e6a` now; C79 recorded `47302087` after row 228. The difference is row 226c's (record: +26 lines, one changed: the door `judgedSigningKey`); it was read here in full from line 160.

## 3. SX-09 against the built code

### (a) One resolver - PASS

- `host-key.ts` `activeSigningKeyId` -> `pointedKeyId` is the one place the pointer is read. `loadSoftwareSigner` and `readStoredCertificate` call it when no key id is handed in; `readRetainedCertificates` and `activateSigningKey` call it for the bound.
- Takers, none with a key id: boot checks 4, 4b, 4b-2 (`boot/index.ts` `storedSigningKeyReaders`, one load); the seal, the export jobs and the transcript revisions (`sealing-host/index.ts` `signingNow` -> `loadSealingSigner`); verify and the export's trust list (`sealing/signing.ts` `sealingVerifyTrust` -> `readRetainedCertificates`); the boot audit entry (`capture/fence/boot-key.ts` `storedBootSigningKey` -> `readStoredCertificate` without an id).
- Held by `sealing/__tests__/active-key-call-sites.test.ts` (behaviour on three stores, a static rule over `src/` and `cli/`, planted controls). Not re-run here; its record is row 225's.
- Note for row 139: the header table of that test still names the transcript route's own loader and `signingNow().certificate` as the verify's source. Both changed in rows 226c and 227 (R-8).

### (b) The pointer - PASS

- **Read** (`pointedKeyId`, `readStored` with `POINTER_FILE`): the directory looked at by `lstat` (link, foreign owner, any group or other bit refused); the file opened with `O_NOFOLLOW | O_NONBLOCK`; kind, owner, mode and size asked of the open handle; bytes read from that handle, bounded. Every refusal of the pointer is `ACTIVE_KEY_POINTER_INVALID`.
- **Content**: latin1 text that ends in one line feed and whose rest matches `^CORE-KEY-EVSIGN-(\d{2})$` with place 1 to 99. Refused: empty, `-00`, CR LF, a second line, a space, a longer number.
- **No fall-back**: `activeSigningKeyId` answers the first id only when `pointedKeyId` answered null, which is "no store" or `ENOENT` and nothing else.
- **Written** (`activateSigningKey`, the one writer): the id must be later than the active one and its key must LOAD at `now` first; a staged file created exclusively, mode 0600, synced; one `renameSync`; the directory synced.
- The built mode is 0600; the design said 0644. Stricter, and what SX-09 asked.

### (c) The retained set - PASS

- `readRetainedCertificates`: only `<id>.crt` of the series at or before the active id; read through `readStored` as a public file; `readSigningCertificate` parses it and verifies the self-signature; anything else is listed in `refused` and never trusted. A store that cannot be taken throws.
- `sealing/signing.ts` `sealingVerifyTrust`: with `production: true` a development-marked certificate is in neither list; a marked key's certificate is in `compromised`, never in `trusted`; a throw gives two empty lists.
- Callers hand `production` from the one operation reader: `sealing-host/index.ts` (operation 41) and `evidence-export/host.ts` `exportTrustedCertificates`.
- Stated limit, unchanged from the design (2.3): whoever writes the signer directory as the Core's user can add a self-verifying certificate at or before the active id. A retained certificate is not held to the installation binding; that is right (a renamed installation keeps its earlier certificate).

### (d) Under a compromised key - CAUTION

What is met, in `evidence-verify/index.ts` (`createRealEvidenceVerification`):

- A marked certificate is not trusted, so the first run fails. A second run admits it and may pass ONLY when `admitted.ok`, the stored manifest digest is a real digest, and the head of the package's revisions equals the head the database holds. Then `COMPROMISED_KEY_STORED_DIGEST` with the notice `SIGNED_BY_COMPROMISED_KEY`; every other package is `COMPROMISED_KEY_NOT_STORED_DIGEST` and fails. A last line throws if such a package were about to pass.
- The signer side: `loadSoftwareSigner` and `stillSigns` refuse `KEY_COMPROMISED` at load and before each signature.

What is not met:

1. **The chain records a plain pass (R-1).** `options.record(...)` is handed `ok`, `manifestOk`, `signatureOk`, the failed tracks and `custodyDetailOf(report)`. `signingKey` is not among them. A verification that passed only "as the stored digest, under a compromised key" stands in the audit log and the custody trail as an ordinary pass.
2. **The receiver's verifier has no input (R-2).** V4 item 7 landed the notice member, the wording and a result type; `VerifyExpectations` has no list of marked fingerprints and `verifyPackageV2` sets no state. `cli/verify-export.ts` takes `--sha256` and `--trust` only.
3. **Such a package is not exported (R-3).** `exportTrustedCertificates` returns `trusted` only; the job fails `SOURCE_VERIFY_FAILED`.
4. LOW (R-11): operation 41 reads `trusted` and `compromised` through two separate calls of `sealingVerifyTrust`. A mark set between the two reads gives one plain pass; the next run is right.

### (e) A key id is never used twice - PASS, one LOW caution

- `provisionSigningKey` refuses when any of the four names exists and when `keyIdSpent` is true (any entry `<id>.*`, or an id at or before the pointer's). `nextSigningKeyId` takes the place after the HIGHEST number found in any entry name or in the pointer, so a staged pointer, a record and an orphan of an interrupted rotation all count.
- The rotate command takes its id from `nextSigningKeyId` only; a failure after step 8 says "the key id is spent".
- R-5: `keyIdSpent` looks at entries of THAT id and at the pointer. A store in which the pointer and every `CORE-KEY-EVSIGN-01.*` entry were removed by hand, while entries of later ids remain, lets `evidence:production-key` provision a second key under the first id and makes it active. `production-key-command.ts` `SIGNER_STORE_NAMES` still names the first id's four files only (221 section 9, not taken up). It needs two deliberate deletions by the Core's user; it is the last open edge of (e).

## 4. SX-10 against the built code

**PASS, one caution.**

| Part | Built | Where |
|---|---|---|
| Equality of the whole unit | `units[0] === 'Evidence signing ' + id`, exactly one unit | `boot/index.ts` `signingKeyInstallationProblemOf` |
| The PARSED value | the organisational-unit attributes are read from the certificate's DER by object identifier 2.5.4.11, not from the subject text | `organisationalUnitsOf`, `derItems` |
| `REAL_PRODUCTION` only | the one added condition | `checks.ts`, the lines after 4b |
| Added lines only | 26 insertions, 0 deletions against head | `git diff HEAD` |
| The same certificate as 4 and 4b | third reader over the one load | `storedSigningKeyReaders.organisationalUnits` |
| Lands with rotation | same tree as rows 225 and 226 | - |
| Negative controls | default unit, other installation, none, several, unknown id, malformed id | `boot/__tests__/boot.test.ts` (20 lines name the four words), record of row 228 |
| Fail closed | no id handed in, an id not of the form, an unreadable subject: each refuses | `InstallationBindingProblem` |

The product mount (`capture/index.ts`, `mountCaptureBootChecks`) hands in no key seam and no id seam; the id comes once through `provideInstallationId` from `sealing-host/index.ts`, and a second or late call is refused.

The caution is R-4 (item (e) of section 7).

## 5. Who signs, and through what

| Path | Signer | Held to the boot |
|---|---|---|
| Seal (`SealingPorts.signing` getter) | `signingNow()` | yes |
| Export jobs (`provideCoreEvidenceExport`) | `signingNow`, wrapped by `exportSignerWithRefusal` (adds nothing but the kept refusal) | yes |
| Transcript revisions (`provideRevisionSigner`) | `signingNow()` | yes, wherever the sealing host is mounted |
| Transcript revisions, default `loadCoreSigner` in `modules/transcripts/routes.ts` | `loadSealingSigner`, unheld | no - reached only where no provider was set: capture mode `simulated` |
| Demo seed hook (`seed-hook.ts`, from `db/seed/cli.ts`) | `loadSealingSigner`, unheld | no - a command process; development key only |
| The three key commands in `cli/` | load to check, never call `sign` | - |
| `provisionSigningKey` | signs the new certificate's own body | - |

Only `host-key.ts` holds an asymmetric signing call (`sign(null, ...)` twice); no other file of `src/` or `cli/` creates a private key object.

## 6. Cautions and their rows

| Id | Caution | Severity | Row |
|---|---|---|---|
| R-1 | A rotation and a compromise mark leave no entry in the audit chain; a verification that passed only as the stored digest under a compromised key is recorded as a plain pass; `SYSTEM_BOOT` names a key before check 4 judged it and also on a refused start (229 item 6) | MEDIUM | NEW row, the next audit-vocabulary step (the file set of V4a: `core/audit-details.ts`, `capture/fence/boot-key.ts`, the engine's `recordEvidenceVerification`); before a real examination |
| R-2 | A receiver cannot learn of a mark: no verifier input, no notice record, no procedure | MEDIUM | NEW row: `packages/shared` verifier input and verdict, `cli/verify-export.ts` option, a public notice record written by `evidence:mark-compromised` into `handover/`; before a real examination |
| R-3 | Evidence sealed before a compromise cannot be exported at all | MEDIUM | the same NEW row as R-2 (one contract step: `SOURCE_SIGNED_BY_COMPROMISED_KEY`, the export input); OR the user's written decision on how such evidence is delivered |
| R-4 | `DEMS-TEST-01` is the unit of the fixtures' keys and is not a reserved id; 322 fixture folders under `.data/` (318 with a key), two more than at review 221 | MEDIUM | NEW small row 228b (reserve the id: refuse it in `REAL_PRODUCTION` and in both key commands); the test-hygiene row of C71 C-4 (i), still open; removal of the folders is the user's word |
| R-9 | No installer text exists for rotation, the mark, the restart after a rotation, an interrupted rotation, the reserved id or the notice to receivers (`implementation/217`, `135` and the README do not name the commands) | MEDIUM | a revision row of the installer note (as row 217) and of the README (as row 218); before the commands are used on an installation |
| R-5 | The first key id can be provisioned again in a store edited by hand; the first-key command looks at the first id's four names only | LOW | NEW small row 226d (`host-key.ts` `keyIdSpent`: any entry of the series at or after the id spends it; `production-key-command.ts` refuses before its prompts when the store holds a pointer or any entry of the series) |
| R-6 | `markSigningKeyCompromised` writes without the directory look every read has; the mark command goes on when `signer` is a link or cannot be read, writes, and only then answers `MARK_NOT_EFFECTIVE` | LOW | row 226d |
| R-7 | Where the door `judgedSigningKey` answers null the signer is held to the clock and its own questions only; the transcript route keeps an unheld default loader; the callers of `loadSealingSigner` are not a closed list | LOW | row 226d (a null answer in a real operation refuses); a static rule in the code review of row 139 (closed list of callers) |
| R-8 | Texts that are no longer true: `ROTATION_NOTES` and `COMPROMISE_NOTES` say a running Core "keeps signing with the key it loaded"; the header of `mark-compromised-command.ts` says the same; the table in the header of `active-key-call-sites.test.ts` | LOW | row 139; the two note texts with row 226d |
| R-10 | The private half of a rotated-out key that is not marked stays in the store for ever; no command retires it | LOW | the installer-note row of R-9 states it; whether a retire step is wanted is the user's decision |
| R-11 | Two reads of the trust lists in one verification | LOW | row 139 (one snapshot per run) |

Standing cautions of review 221, as they are after these rows:

- **C-4**: answered in section 7 (e); continues as R-4.
- **C-5** (ancestors of the store not re-asked at load): unchanged. Both new commands apply `directoryRefusal` when they run; the Core's load does not. Its row stays the host-checks follow-up of C49 (2).
- **C-7** (production off Linux starts with a warning): unchanged, not touched by these rows.
- **C-8** (no lock a command can test): for the two X-1 commands the consequence is closed by rows 226b and 226c - a marked key signs nothing in a running Core at the next signature, and a rotated store makes a running Core refuse until restart. It stands as it was for `operator:set-password`.

## 7. The items put to this review by name

**(a) C69 (2): a rotation and a mark write no audit entry of their own. Database-free commands: ACCEPTED. No trace in the chain: CAUTION (R-1).**
The commands must stay database-free. A compromise response that needs the database and its connection file would fail in exactly the hour it is needed, and would make the key commands a second writer of the chain (the difficulty SX-02 and SX-03 had to solve for the password command). What is not acceptable for real examinations is the result:
- a mark on a key that is no longer active leaves nothing in the chain at all;
- a mark on the active key shows only as a later boot that names another key;
- the mark file is a 0644 file the Core's user can remove, and nothing would show that it was there.

Required: the NEXT BOOT records it, not the commands. After the checks passed, the boot writes the state of the store as public facts - for each retained key id its certificate digest and whether it is marked - and the entry says that this is the key the checks JUDGED. A rotation, a mark and a mark that disappeared are then each a difference between two boot entries. The verification row carries the signing-key state (section 3 (d) 1).

**(b) C77 / 227b: a package under a marked key is not exported. RIGHT as built; NOT the standing state (R-3).**
Refusing is the correct interim: an export without the state would be a plain pass at the destination. But it means that one compromise makes all evidence sealed before it undeliverable, although the Core can still prove each item against its stored digest. Before a real examination it must be exportable with the notice: the export manifest - signed by the NEW active key - states that the source's signing key is marked, since when, and that the Core verified the source against its stored digest; the receiver's verifier shows that as a named state. Until that row lands, the user decides in writing how such evidence is delivered.

**(c) C83: what must exist before a real examination (R-2).**
1. A verifier input: marked certificate fingerprints, as `VerifyExpectations.compromisedCertificateSha256` and an option of `evidence:verify-export`.
2. A verdict rule: a package whose manifest or revision rests on a listed certificate is never a plain pass. Alone it is "no verdict" (`COMPROMISED_KEY_NO_RECORD`) with its own exit status; inside an export attested by a trusted, unmarked key as in (b) it is the named pass.
3. A notice record: public facts only (key id, certificate digest, the instant of the mark), written by the mark command beside the hand-over record, for the installer to give to every receiver.
4. The procedure: the list of receivers that SX-08 asks for, who tells them, by a channel other than the packages. A receiver who was told and has no new verifier yet removes the fingerprint from his `--trust` list; the package then fails as not trusted, which is safe but does not say why.

**(d) Row 226c's request, the seed hook's unheld signer: ACCEPTED.**
`createDemoPackageSeeder` runs in the seed command's process (`db/seed/cli.ts` is its only caller), where no boot judged a key, so there is nothing to hold it to. It signs with a development-marked key only (`NOT_A_DEVELOPMENT_KEY` otherwise), which a production Core never trusts. Its signer still asks the mark and the pointer before each signature. Residual: validity is asked at the load only, over a run of seconds. Condition: it stays a command; the closed list of R-7 would hold that.

**(e) C79 and C-4: does 4b-2 close C-4 in code? YES, for every installation id but one (R-4).**
A default-unit key (`Evidence signing`) is `OTHER_INSTALLATION`; so is any key of another id. The residual: the fixture now provisions with `FIXTURE_INSTALLATION_ID = 'DEMS-TEST-01'` (`boot/__tests__/support.ts`), and nothing in `config.ts`, `boot/index.ts` or the key commands refuses that id. A production Core configured with it and pointed at one of the fixture folders passes 4, 4b and 4b-2 with a key a test made. How many of the 318 stores carry that unit is not known: no certificate under `.data/` was opened. C79 answers with a sentence for the installer; a sentence is not a control. The folders still grow, and the test-hygiene row of C71 has not run.

**(f) C81: is the sign-time guard complete? YES for the three operations of a running Core, with two LOW edges (R-7).**
- Bound to the boot's key id: `signingNow` builds the hold from `captureBootControl(app).judgedSigningKey()` at each take; `signerHeldToBoot` refuses `ACTIVE_KEY_CHANGED` when the hold is made and before each signature. The door is set only after `runCaptureBootChecks` returned (`refuse` throws), in both real operations.
- Validity on the Core's clock: `hold.now` is `app.clock.now`, the clock of boot check 4; both bounds.
- Mark and pointer before each signature: the held `sign` calls the inner `sign`, whose `stillSigns` asks the directory, the mark and the pointer.
- Outside the held signer: the seed hook (d) and the transcript route's default loader in capture mode `simulated`; neither is an operation in which a boot judged a key. No test helper signs in production code; `provideRevisionSigner` is a seam any unit of the server could call, with one caller today.
- Edges: a take while the door still answers null is not bound to a key; a new caller of `loadSealingSigner` would be unheld.
- Stated limit, accepted: the questions are asked before the signature, not during it.

**(g) The pointer file: PASS.** Read and written as section 3 (b) says.
- *Crafted*: anything but one id of the series and a line feed refuses the start. A pointer to an id without files gives `KEY_ABSENT` at check 4. A pointer moved BACK by hand is taken; the earlier key then loads if unmarked, its boot entry names it, every package of a later key becomes untrusted (`NEVER_ACTIVE`), and the next rotation still takes the id after the highest ever named. A pointer moved FORWARD by hand to a never-activated key is taken; check 4b-2 still holds that key to the installation.
- *Who*: only the Core's user can write it (directory 0700 of that user, asked at every read).
- *An id reused*: section 3 (e) and R-5.

**(h) UD-4 compares the parsed value: PASS.** `organisationalUnitsOf` walks the DER to the subject and takes attribute values by object identifier. A comma, an equals sign or `OU=...` typed into another attribute is that attribute's value and no unit. Refused: two units (also in one multi-valued name), none, a unit that is not a UTF-8 or printable string, any byte outside visible ASCII, a different case, a trailing space, a length form the reader does not follow. The limit is the one of F1-1: the certificate is self-signed, so the check stops accidents and copied directories, not the holder of a key.

**(i) An interrupted rotation is never resumed: ACCEPTED. What the installer finds and must do:**

| Stopped | The store holds | Active key | The installer |
|---|---|---|---|
| before the word `ROTATE` | nothing new | the earlier | runs the command again |
| while the new key was written (step 8) | some of `<new id>.wrap`, `.p8`, `.crt` | the earlier; the Core starts as before | runs the command again: it takes the NEXT id. The orphan is never trusted (`NEVER_ACTIVE`) and is left |
| between key and pointer | the new key whole, perhaps `ACTIVE.<new id>.next` | the earlier | the same |
| after the rename (step 9) | the new pointer, no records of the new key | the NEW key | does NOT run it again: he confirms which key is active and writes the fingerprint down himself |

In every state the pointer is whole and the Core fails closed or starts with a key that loads. Two gaps for R-9: no command only SAYS which key is active (the installer reads the pointer, or the Core's boot entry), and no text tells him the table above. An installer who removes an orphan by hand frees its id (R-5).

## 8. The A4 statement

**MADE: item A4 is closed in code on the Core, on the tree as read.**

Rotation, the compromise mark and the retained certificate set exist. A suspected compromise now has a clean response on the host: the mark stops every signature, in a running Core too; a rotation gives a new key under a new id; the Core is held to the key its boot judged; everything sealed before still verifies, and under a marked key only as the stored digest and with a named state; nothing sealed is rewritten.

Its limits:

1. It is a statement of the code as read and of the rows' own tests. It is conditional on the full suite run c06 on this tree (C79: no commit before it) and on the commit of row 231. No started production Core has exercised any of it.
2. It does not cover what a compromise needs OUTSIDE the Core host. These are not A4 as written, and they must go on the list "before a real examination" as items of their own: the receiver's side (R-2), export of earlier evidence (R-3), the record in the chain (R-1), the installer's text (R-9), the reserved fixture id (R-4).

## 9. Alternatives weighed, assumptions, gaps

**Alternatives.**
- For (a): an audit entry written by the commands, as `operator:set-password` does. Rejected: it ties the compromise response to the database and its credential.
- For (b): exporting with a notice in the log only. Rejected: the state must be under a signature the receiver verifies.
- For R-4: moving the fixture to a temporary directory alone. Not enough: the 318 existing stores remain and their removal is the user's.
- For A4: refusing the statement until R-1 to R-3 land. Rejected: A4 names three mechanisms and all three are built and fail closed; the remainder is real and is listed as its own items, so that "A4 closed" is not read as "a compromise is fully handled".

**Assumptions.**
- The test counts of rows 225 to 229 are taken from their records (229 after 226c: 46 held, 0 differences); only one unit file was run here.
- The engine runs no seal before the boot step passed (the null-door edge of R-7); not traced.
- No certificate of a fixture store was read, so which unit each carries is not known.

**Not done.**
- No suite, no database, no started Core, no terminal.
- `evidence-verify/index.ts` and `evidence-export/host.ts` were read as changed lines, not in full.
- `test/static/cli.test.ts` was read by its header and case names; `production-key-command.ts` by grep.
- The shared verifier in `packages/shared` was not read: V4's record is the source for "no input exists".
- Row 139's code review of these rows has not happened.
