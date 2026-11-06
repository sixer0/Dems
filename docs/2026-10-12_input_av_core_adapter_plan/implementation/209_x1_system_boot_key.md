---
task_slug: input_av_core_adapter_plan
row: 209
package: M11 | X1-2
date: 2026-10-13
agent: coder-execution (wave 10)
tier: T3
status: complete
requirements: SX-15 (verification/07_security_x1_x2.md, finding F1-7); design 05 section 2.7 point 3; decision C62 (the writer enforces the two forms)
---

# Row 209 - `SYSTEM_BOOT` states which key the Core started with

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. Stated first: the order, and what the two members mean

**The order (verified in the code, then by two whole boots).**

| Fact | Evidence |
|---|---|
| The capture unit mounts the fence, then the boot checks | `CS/capture/index.ts:309` (`mountCaptureFence`), `:327` (`mountCaptureBootChecks`) |
| Each mount adds one boot step: `capture.fence`, then `capture.boot` | `CS/capture/fence/index.ts` (`app.readiness.addBootStep`), `CS/capture/boot/index.ts:432` |
| The runner runs the steps in the order they were added and stops at the first that throws | `CS/plugins/readiness/index.ts`, `boot()`: `for (const step of steps)` ... `throw new BootError(step.id, cause)` |
| The fence step writes the `SYSTEM_BOOT` entry inside its own unit of the pipeline (`capture.fence.boot`), which commits when the step's work returns | `CS/capture/fence/boot.ts:249-261`, `CS/capture/fence/index.ts` (`inUnit`) |
| Checks 4 (the key loads), 4b (no development key in production) and 4c are asked by `capture.boot` | `CS/capture/boot/checks.ts:442`, `:444` |

So the entry is written and committed BEFORE check 4 has judged the key. This answers the "not verified" of finding F1-7.

**What the members mean.** `signingKeyId` and `signingCertificateSha256` state ONE fact: the certificate that lay in the signer store (`<data dir>/signer`) at the moment the fence step passed - the key id under which it is stored and the SHA-256 of its DER bytes.

They do NOT state that the private key loads, that it belongs to this certificate, that the certificate is valid now, that the key is not marked compromised, that it is not a development key, or that this boot went on to start. A boot that check 4, 4b or 4c refuses leaves the same entry behind. "The Core stated this key" is not "the key passed the checks". Whether the boot was refused is in the error log (step `capture.boot`, its code and reason); which certificate signed a package is in the package.

Both halves are held by tests on PostgreSQL (section 4, cases D2 and D3): a store with no key writes the null pair and is then refused `KEY_ABSENT`; a key marked compromised is STATED by the entry and then refused `KEY_COMPROMISED`.

The same text is the header of the new file `boot-key.ts`, so a reader of the code meets it where the members are made. One sentence for the README is a request (section 6).

## 2. What was built

| File | Change |
|---|---|
| `CS/capture/fence/boot-key.ts` | NEW. `storedBootSigningKey(dataDir, read = readStoredCertificate)`: the pair from the PUBLIC certificate, never throws, the null pair on any failure or malformed value. `systemBootDetailsOf(operation, key)`: the details of the entry, the two members held to their forms BEFORE the append; refuses by `SystemBootSigningMemberError` (`SYSTEM_BOOT_SIGNING_MEMBER_INVALID`, names the member, never the value). `bootSigningKeyProblemOf`, `isSystemBootSigningValue`, `BOOT_SIGNING_KEY_NOT_READ`, `SYSTEM_BOOT_SIGNING_MEMBERS` |
| `CS/capture/fence/index.ts` | the details of the ONE boot append: `systemBootDetailsOf(operation, storedBootSigningKey(app.config.dataDir))` in the place of `{ captureOperation: operation }`; one import line, one export line, four header lines. Nothing else of the file |
| `CS/capture/fence/__tests__/fence.test.ts` | five cases in the existing block "the boot audit row (SEC35-41 (b))" |
| `CS/capture/fence/__tests__/fence.db.test.ts` | three cases; five existing expectations of the boot row re-stated with the two members (`bootRowOf`); three small helpers |

NOT edited: `fence/boot.ts`, `fence/operation.ts` (`git diff --stat` of the two: empty), `capture/boot/index.ts`, `checks.ts`, `core/audit-details.ts`, `core/audit-writer.ts`, `packages/shared`.

### How it behaves

| Operation | The entry |
|---|---|
| `REAL_PRODUCTION`, `REAL_DEVELOPMENT` | `{ captureOperation, signingKeyId, signingCertificateSha256 }` - the pair of the stored certificate, or both null. A development boot states its key exactly as a production boot does: whether it is a development key is check 4b's question |
| `SIMULATED` | no entry of the fence at all (`BOOT_AUDIT_OPERATIONS`, unchanged), so neither member; no certificate is read (the read sits inside the callback `boot.ts` calls for the real operations only) |

**Only the public certificate.** The helper imports one name of the signer, `readStoredCertificate`; no loader of a key and no wrap secret. Held by a behaviour test (the answer does not move after the key file and the wrap secret are removed from the store) and by a source test.

**Never changes a boot.** The read is one synchronous read of one small file through the store's own bounded reader (row 210: at most 16 KiB, `O_NONBLOCK`). Every failure is the null pair. The helper logs nothing and keeps no reason: check 4 names the state of the store with its own code a moment later.

**The writer's enforcement (C62).** The audit writer accepts any member on `SYSTEM_BOOT` (finding of row 201). The one writer of the boot entry now builds its details through `systemBootDetailsOf`, which refuses a member that is neither null nor of its form, and half a pair. The reader hands on only a pair of the forms or the null pair, so the refusal cannot be reached from a stored certificate: it guards the writer against a later change of the reader.

## 3. Why `audit-details.ts` was not edited

The brief allowed one additive edit there "if that file is where such rules live". They live there since row 201: `SYSTEM_BOOT_SIGNING_DETAIL_RULES` (both members, both forms). Nothing was missing in that file, so it was not touched (agent V3 is editing it).

What IS missing is the way from that rule to the fence: the core unit is closed (`test/static/imports.test.ts`, "a closed unit is imported through its index") and its index does not export the name (row 201's second request, still open). `boot-key.ts` therefore states the two forms a second time (`MEMBER_FORM`), and the case U4 holds them equal to row 201's rule on 34 values per member. The request to end the double statement is in section 6.

## 4. Checks (2026-10-13)

| # | Check | Command (from `apps/core-server`) | Result |
|---|---|---|---|
| 1 | Unit and static | `npx vitest run --project unit --maxWorkers=2 src/capture/fence/__tests__/fence.test.ts src/capture/__tests__/static.test.ts test/static src/core/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` | `Test Files 20 passed (20)`, `Tests 390 passed (390)` (final code) |
| 2 | Database, throw-away clones, sandbox off | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture/fence/__tests__/fence.db.test.ts` | `Test Files 1 passed (1)`, `Tests 47 passed (47)`; `0 remain with the run prefix` |
| 3 | Typecheck | `npm run -s typecheck` | first run exit 2, ONE line, mine (`fence/index.ts(717)`: an interface is not a record of detail values); the two shapes became type aliases; second run exit 0 |
| 4 | The two fence files | `git diff --stat -- apps/core-server/src/capture/fence/boot.ts apps/core-server/src/capture/fence/operation.ts` | empty |
| 5 | Secret scan of the fence folder | `node scripts/secret-scan/count-only.mjs apps/core-server/src/capture/fence` | `TOTAL: 0 in 0 file(s)` (20 files) |

Runs: the unit file once before the type change (112 passed) and once after, with the static files (row 1). The database file ONCE, before the type change of check 3; that change touched two type declarations and no statement, so the run was not repeated.

The fixture folders of the database cases (`.data/test-row61-fence*`, row 61's fixture) were counted after the run: 0.

### The cases

| Case | Holds |
|---|---|
| U1 (unit) | a key provisioned by the test in a folder of the system's temporary directory: both members; the fingerprint equals the SHA-256 of the certificate file's DER, computed by the test; the same answer for a key marked compromised and with the key file and the wrap secret removed; a certificate others may write, and no certificate: the null pair; the folder is gone at the end |
| U2 (unit) | five failing readers and twelve malformed certificates: the null pair, nothing thrown; the one directory asked is `<data dir>/signer` |
| U3 (unit) | the writer: a pair and the null pair in both real operations, key order `captureOperation, signingKeyId, signingCertificateSha256`; ten refused inputs by member name, the message holds no part of the value |
| U4 (unit) | the two forms equal row 201's `SYSTEM_BOOT_SIGNING_DETAIL_RULES`, value by value |
| U5 (unit, source) | the helper's three imports; one append of a boot row in the fence, through the rule; the read sits behind `BOOT_AUDIT_OPERATIONS`; `boot.ts` and `operation.ts` name neither member |
| D1 (database) | `SIMULATED` on a data directory that HOLDS a readable certificate: no boot row, and no audit row of any type holds either member |
| D2 (database) | a development boot on a store with no key: `{ REAL_DEVELOPMENT, null, null }`; the fence passes with its usual outcome; `capture.boot` refuses `CAPTURE_SIGNING_KEY_UNUSABLE` / `KEY_ABSENT`; no other log line names a signing code |
| D3 (database) | a key marked compromised: the entry states its id and fingerprint; `capture.boot` refuses `CAPTURE_SIGNING_KEY_UNUSABLE` / `KEY_COMPROMISED` |
| re-stated (database) | five existing expectations: two development boots; the 21-state table (every passing REAL_DEVELOPMENT and REAL_PRODUCTION state); the remedy sequence (a development boot, then a production boot) - each boot row equals `{ operation, 'CORE-KEY-EVSIGN-01', SHA-256 of the fixture's certificate file }`, computed by the test |

Verification cell, cell by cell: "a boot in each real operation writes both members equal to the stored certificate's" - the re-stated expectations (production: the 21-state table and the remedy sequence); "a `SIMULATED` boot writes neither" - D1; "with an unreadable certificate both are null and the boot's outcome and refusal code are those of a boot without the read" - D2, U1, U2.

## 5. The double, and what stays unproven

The keys are made by the tests (`provisionSigningKey`) and removed with their folders; no file of the repository's own `.data/signer` was opened. The database cases use row 61's fixture, a private folder the test makes below the git-ignored `.data/` and removes (the system's temporary directory fails the path rule of the worker program); the test reads the PUBLIC certificate file of its own fixture to compute the fingerprint.

Unproven here: a boot row carrying the id and fingerprint of a key made by the production key command on a real host (the command's store is proven loadable by row 208; the first production start is hardware package `9A`). "Outcome and refusal code are those of a boot without the read" is held by D2 against check 4's own code, not by a run of the tree before this row.

## 6. Requests (`delegation_progress/file_requests.md`, four lines, none blocking)

1. `CS/core/index.ts:65`: export `SYSTEM_BOOT_SIGNING_DETAIL_RULES`; then `boot-key.ts` drops its own table of the two forms. The first value import of the core by the capture unit: the unit-graph rule must be asked first.
2. `CS/core/audit-writer.ts`: when the audit writer itself enforces the two forms (row 201's request), it must ADMIT NULL for both. Until then any OTHER writer of a `SYSTEM_BOOT` entry is unchecked.
3. README (SX-20) and row 86: the one sentence of section 1; the header of `fence/boot.ts` is short by the two members.
4. FINDING: the scan needle `private-key-pem` counts 1 in `core/__tests__/writers.test.ts` and 2 in `evidence-export/__tests__/export.test.ts` (refused test values, no key).

Seen in files of others, not edited: `src/core/__tests__/writers.test.ts`, 5 reds, all on the type `HOST_ALIAS_ADD_FAILED` (agent V3's vocabulary step in flight). `test/static/credentials.test.ts:88` and `:98` were red at 12:26 on `test/cli/operator-set-password.test.ts:321` and the script `operator:set-password` (agent X1, row 215) and green at the final run.

## 7. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The read and the rule live in a NEW file `fence/boot-key.ts`; `index.ts` holds the write only | `index.ts` may have no error path (static rule G-R14: it builds the development sources), and "null when it cannot be read" needs one |
| DD-2 | A value not of its form is the null pair at the READER and a refusal at the WRITER | SX-15: the read never alters a boot; C62: the writer enforces. The two rules cannot meet from a stored certificate |
| DD-3 | Half a pair is refused | a key id without its certificate states no key |
| DD-4 | The forms are written a second time in the fence, held equal by a test | the core is a closed unit and its index does not export the rule; editing the barrel is not this row's |
| DD-5 | No log line and no error-log entry when the certificate cannot be read | an added entry would be a change of the boot; check 4 persists the store's state with its code a moment later. The audit entry with the null pair is the persistent trace |
| DD-6 | `REAL_DEVELOPMENT` states its key like `REAL_PRODUCTION` | the cell says "each real operation" |
| DD-7 | `audit-details.ts` not edited | the rule of the two members is there since row 201 |

Existing files were edited with the Edit tool only; the new files were written with Write.

---
*Generated: 2026-10-13*
