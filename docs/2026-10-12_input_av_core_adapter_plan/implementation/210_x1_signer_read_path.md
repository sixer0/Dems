---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 210
package: X1-3 (M11)
date: 2026-10-13
agent: coder-execution (batch 9, agent R9)
tier: T3
status: complete
---

# Row 210 - signer store: read path and write sync (S99-06; SX-16 first half; UD-11)

## 1. What was changed

| File | Change |
|---|---|
| `apps/core-server/src/capture/signer/host-key.ts` | the read path, the write path, one option (`git diff --numstat`: 193 added, 38 removed) |
| `apps/core-server/src/capture/signer/__tests__/signer.test.ts` | 5 new cases in one new block at the end, one new import line (`--numstat`: 158 added, 0 removed - the 16 existing cases are unedited) |
| `apps/core-server/src/capture/signer/__tests__/signer-sync.test.ts` | new, 2 cases (DD-2) |

`host-key.ts` stays the one signer file that imports the file system and `node:crypto`; no other file of the signer was touched, and the unit's index is unchanged.

## 2. The read path, as built

Every stored file - key, wrap secret, certificate - is read by ONE function, `readStored`:

| Step | Rule | Refusal (existing codes only) |
|---|---|---|
| The store directory, as it is (`lstat`) | absent -> "nothing stored" (the caller's `KEY_ABSENT` / `CERTIFICATE_INVALID`, as before) | - |
| | a link, or no directory | `KEY_UNREADABLE` |
| | of another user; or any bit for group or others (0755, 0750, 0701, 0710) | `KEY_MODE` |
| The file is opened with `O_NOFOLLOW` (and `O_NONBLOCK`: a pipe cannot hold the load) | absent -> null, as before | - |
| | a link, or it cannot be opened | `KEY_UNREADABLE` / `CERTIFICATE_INVALID` |
| The questions are asked of the OPEN HANDLE (`fstat`) | not a regular file | `KEY_UNREADABLE` / `CERTIFICATE_INVALID` |
| | owner is not the store's user | `KEY_MODE` / `CERTIFICATE_INVALID` |
| | private file with a bit for group or others; certificate that group or others may WRITE | `KEY_MODE` / `CERTIFICATE_INVALID` |
| | larger than 16 KiB | `KEY_UNREADABLE` / `CERTIFICATE_INVALID` |
| The bytes are read from THAT handle, never past the bound (a file that grows after `fstat` is refused); the read buffer is zeroed | | |

`loadSoftwareSigner` looks at the directory before anything else; `readStoredCertificate` and `fileWrapSecrets(dir).get` go through the same reader. "Is the name taken" (the compromise mark at load; key, certificate and mark before a provisioning) is now asked with `lstat`: a link that leads nowhere is an entry - never provisioned over, and a mark of that kind is a mark.

No new error text: a refusal is a `SignerError` of an existing code and the key id. A test holds that no error of the read path contains the temporary folder, a file name of the store or an error word of the operating system.

**The owner.** `KeyStoreOptions.ownerUid?` (also on `readStoredCertificate`, and the second parameter of `fileWrapSecrets`): the user the store must belong to; default, and the product's only value, the user of this process. See DD-1.

## 3. The write path, as built (SX-16 first half)

| What | Before | Now |
|---|---|---|
| A new file (`writeNew`: wrap secret, key, certificate, compromise mark) | `writeFileSync(..., 'wx')`, `chmodSync` by name | `open(O_WRONLY \| O_CREAT \| O_EXCL \| O_NOFOLLOW, mode)`, `fchmod` on the handle, write, **`fsync`**, close. `EEXIST` -> `KEY_EXISTS` as before |
| After the three files of a provisioning | nothing | **`fsync` of the store directory** (failure -> `KEY_UNREADABLE`); when this call made the directory, the directory that holds it is synced too, where it can be opened (DD-3) |
| After the compromise mark | nothing | `fsync` of the store directory |
| The store directory at provisioning | `mkdir -p`, `chmod` (both follow a link) | `mkdir -p`, then `lstat`: a link or non-directory -> `KEY_UNREADABLE`, a foreign owner -> `KEY_MODE`, BEFORE `chmod` (SX-05, the store's own half; the command of row 206 refuses the link before it gets here) |

Provisioning is still three exclusive creates in a row, not one atomic step: a stop between two writes leaves an incomplete store, which the command of row 206 names and never completes (SX-07). Making it atomic (a temporary directory and one rename) would change the layout rule of row 225's retained set; not done here, said.

SX-16 second half - "boot checks 4 and 4b judge ONE loaded certificate" - is row 211; `capture/boot/checks.ts` and `boot/index.ts` were not edited by this row.

## 4. Checks

| Check | Command | Result |
|---|---|---|
| Signer tests | `npx vitest run --project unit src/capture/signer --maxWorkers=2` | run 1: 1 failed - this row's OWN new case (its control padded a certificate, which the certificate parser does not accept); the 16 existing cases passed. Run 2 after correcting the new case: `Test Files 2 passed (2)`, `Tests 23 passed (23)` |
| Every unit suite that provisions or loads a key, and the static rules | `npx vitest run --project unit src/capture/signer src/sealing src/capture/boot src/evidence-verify src/sealing-host src/capture/__tests__/static.test.ts test/static --maxWorkers=2` | `Test Files 60 passed (60)`, `Tests 1030 passed (1030)` |
| The static rule "`host-key.ts` is the one signer file with the file system and `node:crypto`" | in `src/capture/__tests__/static.test.ts` (G-R2, G-R8), part of the run above | passes unedited |
| Typecheck | `npx tsc --noEmit` | errors only in files of rows in flight (listed in `206_x1_production_key_command.md` section 6); none in `host-key.ts` or the signer tests |

Not run by this row (the controller's, per commit): the database suites that load a key (`src/modules/transcripts/__tests__/transcript-routes.db.test.ts`, `test/acceptance/contract.transcripts.ts`, the sealing `*.db.test.ts`, the kill matrix). Each provisions through `provisionSigningKey` into a directory of its own, which gives a 0700 directory of the process user - the state the new checks accept; that is an argument from reading, not a run.

The row's Verification cell, case by case:

| Cell | Case (`signer.test.ts`, block "the read path of the store") |
|---|---|
| a link is refused with an existing code | case 1: a link in the place of the key, the secret, the certificate (each leading to the very file that loaded a moment before), a link as the store directory (load, certificate read, secret read), provisioning through a link (the directory behind it stays empty), names taken by a link that leads nowhere |
| a foreign owner, through an injected port | case 2: `ownerUid` one above the process user and `0` -> `KEY_MODE` at load, at the secret source and at provisioning, `CERTIFICATE_INVALID` at the certificate read; the default is the process user |
| a directory of mode 0755 | case 3: 0755, 0750, 0701, 0710 -> `KEY_MODE`; 0700 loads; no store is still `KEY_ABSENT` and creates nothing |
| (bound; one handle) | case 4: 16 KiB + 1 as key, secret, certificate -> refused; EXACTLY 16 KiB is read whole (control); a directory in the place of the key; a certificate writable by group or others |
| no new error text that names a path | case 5 |
| the three files and the directory synced | `signer-sync.test.ts`: each file's sync comes after its last write, then the directory, then its parent; 5 syncs in all; a second key syncs the directory and not the parent; the mark syncs file and directory; control: the recorder sees a write without a sync |
| existing signer tests unedited | `--numstat` 158 / 0 |

## 5. Driver decisions (for the controller to confirm)

| # | Decision |
|---|---|
| DD-1 | The cell says "a foreign owner (through an injected stat port)". Built as ONE stated number, `ownerUid`, not a replaceable `stat`: with a `stat` port a caller could change what the file system says about a key file (mode, kind, size); with the number it can only say whom the store must belong to. No source of the product passes it |
| DD-2 | The sync case is its own new test file. A sync cannot be observed from outside, so the case wraps the file-system module in a recorder (every function the real one); a module-level double in `signer.test.ts` would have put the 16 existing cases on a doubled module. The profile names `signer.test.ts` only: this is one file more |
| DD-3 | The launch brief says "owner and mode checked on every component of the path"; the row cell says the directory and the file. Built: the store directory and each file. The directories ABOVE the store are not walked at load: on this Mac every temporary directory lies below a world-writable sticky one, so the existing signer and sealing tests - which must pass unedited - would all be refused; and a data directory below such a place is refused where it matters, by the command of row 206 before a production key exists. Residual, stated in the file header: a parent that others may write lets the store directory be exchanged between the look and the open (no `openat` in the runtime). If the controller wants the ancestors held at load, it is a rule for row 211 or 225 with a test seam for the temporary folder |
| DD-4 | The parent of a directory this call created is synced "where it can be opened": a failure there is not a refusal (a parent the Core's user may enter but not read is a legitimate place). It is the one failure of the file that is not a refusal, and it is commented as such |
| DD-5 | A certificate that group or others may WRITE is refused (`CERTIFICATE_INVALID`), beyond the cell's list: the certificate decides what a verifier is told, and provisioning writes 0644 |
| DD-6 | 16 KiB as the bound (a wrapped key is about 150 bytes, a certificate about 600) |

## 6. Requirements

| Id | State |
|---|---|
| S99-06 (no link followed, owner checked, check and read on one handle, directory mode at load) | done, with the stated residual of DD-3 |
| SX-16 first half (sync the three files and the directory) | done |
| SX-16 second half (one loaded certificate for checks 4 and 4b) | row 211 |
| UD-11 (hardening in this task) | done by this row |
| SX-17 | untouched: neither boot file edited |
| F1-8 (two loads at boot, noted for X1-3) | not changed here: the loads are in `boot/index.ts`, row 211's |

## 7. What stays unproven here

Linux: `O_NOFOLLOW`, `fsync` of a directory and the modes were exercised on macOS (APFS) only - hardware check of the production host (the X-G gate, 9A/H-nn of the installation chapter). A store on a volume whose directories cannot be synced would now refuse to provision (`KEY_UNREADABLE`): fail closed, and unobserved.

---
*Generated: 2026-10-13*
