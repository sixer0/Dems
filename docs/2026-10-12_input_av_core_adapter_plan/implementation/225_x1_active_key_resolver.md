---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 225
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (wave 10, agent K1)
tier: T3
requirements: GATE SX-09 (a), (b), (e); UD-5; SX-17 (boot files untouched)
status: complete
---

# Row 225 - the active signing key id: one resolver

## Gate condition SX-09, before the first line

The claims line (`delegation_progress/file_claims.md`, "rows 225, 226") names, by symbol:

- THE ONE RESOLVER: `activeSigningKeyId` in `apps/core-server/src/capture/signer/host-key.ts`.
- ITS CALL SITES: the key-id default of `loadSoftwareSigner` and of `readStoredCertificate` (same file). Through them, with no key id passed anywhere: boot checks 4 and 4b (`storedSigningKeyReaders`, `storedSigningKeyProblem`, `storedSigningKeyIsDevelopment` of `capture/boot/index.ts`), the seal (`loadSealingSigner` of `sealing/signing.ts`, taken by `signingNow` of `sealing-host/index.ts`), transcript revisions (`loadCoreSigner` of `modules/transcripts/routes.ts`), verify (`trustedCertificateSha256` of `sealing-host/index.ts`), the boot audit entry (`storedBootSigningKey` of `capture/fence/boot-key.ts`, row 209).

## What was built (paths relative to `apps/core-server/`)

| File | Change |
|---|---|
| `src/capture/signer/host-key.ts` | `ACTIVE_KEY_POINTER_NAME`, `signingKeySeriesNumber`, `activeSigningKeyId`, `nextSigningKeyId`, `activateSigningKey` (new, exported); `pointedKeyId`, `keyIdSpent`, `storeEntryNames` (new, local); `loadSoftwareSigner` and `readStoredCertificate`: the key-id default asks the resolver; `provisionSigningKey`: one added refusal (a spent id); header paragraph; two names added to the file-system import (`readdirSync`, `renameSync`) |
| `src/capture/signer/types.ts` | three refusal codes: `ACTIVE_KEY_POINTER_INVALID`, `ACTIVE_KEY_NOT_NEWER`, `KEY_SERIES_EXHAUSTED`; the comment of the first key id |
| `src/capture/signer/index.ts` | five names added to the export of `host-key` |
| `src/sealing/signing.ts` | header comment only (one paragraph) |
| `src/capture/signer/__tests__/active-key.test.ts` | new, 9 cases |
| `src/capture/signer/__tests__/active-key-write.test.ts` | new, 3 cases |
| `src/sealing/__tests__/active-key-call-sites.test.ts` | new, 4 cases |

NOT edited: `capture/boot/checks.ts` (blob `1697e4b9dec975226974ae9f2053e2145166a0f2`, the row-205 baseline), `capture/boot/index.ts` (sha256 `47946c29...82b2f3d`, the value row 211 left), `sealing-host/index.ts`, `modules/transcripts/routes.ts`, `capture/fence/*`, every existing test file.

## The rules, as built

| Rule | Built |
|---|---|
| The pointer | `<data dir>/signer/ACTIVE`: exactly one key id of the series `CORE-KEY-EVSIGN-01` .. `-99` and one line end; mode 0600 |
| Absent pointer | the first key id (`CORE_EVIDENCE_SIGNING_KEY_ID`); also for an absent or empty store. Asking writes nothing |
| Read under the key-file rules | through `readStored`, the one reader of row 210, as a PRIVATE file: the directory looked at first (its codes unchanged: `KEY_UNREADABLE`, `KEY_MODE`), the file opened without following a link, kind / owner / mode / size asked of the open handle, read from that handle |
| Malformed or unreadable | `ACTIVE_KEY_POINTER_INVALID` (a `SignerError` with no key id): a link, a non-file, a foreign owner, ANY bit for group or others, larger than 16 KiB, or content that is not exactly `<id of the series>\n`. Never a fall-back; never repaired. At boot it is the reason of check 4's existing refusal `CAPTURE_SIGNING_KEY_UNUSABLE` |
| A pointer to a key that does not load | that key's own code and id (`KEY_ABSENT`, `KEY_COMPROMISED`, `CERTIFICATE_NOT_VALID_NOW`): never another key |
| Written (for row 226) | `activateSigningKey`: refusals first (id of the series, LATER than the active one, the key loads at `now`); then a new private file `ACTIVE.<id>.next` created exclusively, written, synced; ONE rename onto `ACTIVE`; the directory synced. No clean-up exists |
| Never reused (SX-09 (e)) | `provisionSigningKey` refuses (`KEY_EXISTS`) an id of which any entry `<id>.*` is left, and an id at or before the pointer's - also when its key files are gone. `nextSigningKeyId` = one after the highest id named by any entry, staged file or the pointer; `KEY_SERIES_EXHAUSTED` after `-99` |

## Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| New resolver cases | `npx vitest run --project unit src/capture/signer/__tests__/active-key.test.ts --maxWorkers=2` | run 1: `1 failed, 8 passed` - my OWN new case (it assumed a certificate keeps milliseconds; validity is whole seconds). Run 2: passed |
| New write cases | `... active-key-write.test.ts` | passed on its first run; `Test Files 2 passed (2)`, `Tests 12 passed (12)` for the two files together |
| New call-site cases | `... src/sealing/__tests__/active-key-call-sites.test.ts` | first run: `Tests 4 passed (4)` |
| Every database-free suite that provisions or loads a key, and the static rules | `npx vitest run --project unit src/capture/signer src/sealing src/capture/boot src/evidence-verify src/sealing-host src/modules/transcripts src/capture/fence src/capture/__tests__/static.test.ts test/static --maxWorkers=2` | `Test Files 73 passed (73)`, `Tests 1270 passed (1270)` |
| Existing database suites that load a key, on throw-away clones | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2` on `transcript-routes.db`, `transcripts.db`, `finalize-transcript.db`, `last-resort.db`, `stt-states.db`, `production-key-proof.db`, `capture/__tests__/boot.db` | `Test Files 7 passed (7)`, `Tests 90 passed (90)`; `0 remain with the run prefix` |
| Typecheck | `npx tsc --noEmit` | run 1: one error in my new test (a cast) and one of another row (`modules/capture-discovery/connect/index.ts(274)`, in flight); run 2: no error |
| Existing tests unedited | sha256 after the row: `signer.test.ts 7dbe1aed...`, `signer-sync.test.ts acecbd1d...`, `boot.test.ts 12f1d4c3...` (row 211's value), `checks.test.ts 04a3dd69...` (baseline), `one-load.test.ts e37773d3...`, `signing.test.ts 8db2e2aa...` | not written by this row |

Not run (the controller's, per commit): the kill matrix and `seal-e2e.db.test.ts` (processes and ports), the acceptance suites.

The Verification cell, case by case:

| Cell | Case |
|---|---|
| a test holds the call sites to the same answer | `active-key-call-sites.test.ts` case 1: resolver, boot (the real `runCaptureBootChecks` for `REAL_PRODUCTION` over `storedSigningKeyReaders` with a witness around the loader: it was handed NO key id), seal (`loadSealingSigner`) and the public read give the same key id and certificate fingerprint without a pointer (`-01`), with one (`-02`), and the same refusal with one that cannot be taken. Case 3: the exact line of each call site |
| fails on a planted second resolver | case 4: eleven planted forms in a synthetic source, and one planted key id in the REAL text of `sealing/signing.ts`, `sealing-host/index.ts`, `modules/transcripts/routes.ts`, `capture/boot/index.ts` - each is reported on that file; a comment that only talks about the pointer is not |
| absent pointer: the first id loads, existing tests unchanged | `active-key.test.ts` case 1; the unedited suites above |
| malformed, linked or group-readable pointer refuses the start by a named code | `active-key.test.ts` cases 3 and 4 (18 contents, 3 links, 10 modes, a directory); `active-key-call-sites.test.ts` case 1 step 3: check 4 refuses with reason `ACTIVE_KEY_POINTER_INVALID` while BOTH keys are there and load by their id |
| (brief) a crash leaves the old or the new pointer | `active-key-write.test.ts` case 2: a stop at each of six steps (create, half a write, sync, before and after the rename, directory sync), without and with an earlier pointer - 12 states, each the earlier pointer or the new one, whole, and the store loads that key |
| (brief) nothing prints key material | `active-key.test.ts`: every case runs with standard output, standard error and the console captured; the capture is asserted empty |

## SX-09, letter by letter

| Letter | State |
|---|---|
| (a) one resolver, held equal by a test | DONE |
| (b) pointer under the key-file rules; malformed or unreadable refuses | DONE |
| (c) retained set | row 227 |
| (d) compromised key never a plain pass in verify | row 227 |
| (e) a key id never reused | DONE at the store (provisioning and next id); the commands are row 226 |

## Doubles and what stays unproven

- A pointer file of ANOTHER OWNER cannot be made without root: the owner test of the open handle is the same statement that row 210 proved for key files; here only the directory-level owner refusal is exercised (`ownerUid` one above the process user).
- "A stop of the process" is a thrown error at the step (the function has no clean-up, asserted): a loss of unsynced bytes at a power loss is argued in the test header, not produced.
- Linux (`O_NOFOLLOW`, rename and directory sync on ext4): macOS only here - the X-G gate and 9A/H-nn of the installation chapter.
- The transcript and verify takers are held by the static rule and the text of their line, not called (they need a database); the unedited database suites of both passed.

## DRIVER DECISIONS (for the controller)

1. **The resolver is asked inside the loader's default, not on a line in each call-site file.** The profile expected "one call-site line each" in four files. Built instead: no product caller passes a key id, so no call site CAN pass the resolver by, and a static rule fails when one starts to. Consequence: `boot/index.ts`, `sealing-host/index.ts` and `transcripts/routes.ts` are untouched (SX-17 trivially held).
2. **One new code for every pointer refusal**, plus two for the write (`ACTIVE_KEY_NOT_NEWER`, `KEY_SERIES_EXHAUSTED`). No pin on the set of signer codes was found.
3. **The pointer is a PRIVATE file (0600)**, although the design guessed 0644: the Verification cell says group-readable refuses.
4. **The pointer names an id of the series only** (`CORE-KEY-EVSIGN-NN`), not any key id.
5. **Forward only**; a malformed pointer is never repaired by a write: the installer looks at it.
6. **`readStoredCertificate` without a key id reads the ACTIVE certificate** (it read the first). Row 209's `storedBootSigningKey` therefore states the active key with no change (information line left).
7. **Provisioning refuses a spent id** (`KEY_EXISTS`): the design's row "key lost: the first id is free again" no longer holds once anything of that id, or a pointer at or past it, is in the store. An installation that has sealed nothing can still start over with an EMPTY store directory.
8. Three new test files instead of new cases in `signer.test.ts`: the hashes of the existing files are the proof of "unedited" (as row 211 DD-1).

## FINDING, not this row's

`sealing-host/index.ts` loads the signer ONCE per process (`signingNow`). A Core that is running keeps signing with the key it loaded after a rotation or a compromise mark, until it is restarted; transcript revisions load per request and see the change at once. The commands of row 226 say "stop the Core first"; they cannot see a process.

## Files

Changed with the Edit tool: `host-key.ts`, `types.ts`, `index.ts` (signer), `sealing/signing.ts`, `delegation_progress/file_claims.md`. New with Write: the three test files, this record, `delegation_progress/row_225.md`.

---
*Generated: 2026-10-13*
