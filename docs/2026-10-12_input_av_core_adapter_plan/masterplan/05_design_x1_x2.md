---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: data-analyst
type: design (security functions X-1 and X-2; decision U19)
confidence: MEDIUM
status: needs-review (security review of this design is the next step, P11 (3); no code before it)
based_on: decisions/decisions.md (U12, U13, U15-U19, P11, C29); README.md "Real capture, sealing and transcript"; the source files cited by line below
last_updated: 2026-10-13 08:53
---

# Design: X-1 production evidence signing key, X-2 non-demo operator passwords

## 0. Reading guide

**Subject.** Two functions the user added to this task on 2026-10-13 (U19, `decisions/decisions.md:74`): X-1 provisions a PRODUCTION evidence signing key; X-2 gives operators NON-DEMO passwords. Without both, a Core in capture operation `REAL_PRODUCTION` stops at boot (checks 4, 4b, 4c), so no production recording from a real device is possible.

**Stakeholders.** The user (owner of every decision in section 9); the installer (runs both commands at the host's terminal); operators (type their own passwords); a receiver or court-side verifier (reads the certificate); the security reviewer (next reader, P11 (3)); the task-architect (cuts rows from section 8).

**Scope.** Design only. No source file was modified, nothing was built, started or migrated. Not opened: any `.env`, `apps/input-av/data/`, the content of any key or credential file under `.data/` (existence and modes only, section 2.1).

**Method.** Read-only inspection of the files cited as `path:line`. The Graft graph was not queried: it refreshes itself on a query, which writes outside the task folder.

**Evidence rule.** A sentence that carries `path:line` or a document name is a fact as read on 2026-10-13 on branch `task4/input-av-core-port`. Everything else is marked **HYPOTHESIS** (a design proposal or an unverified assumption). Names of new commands, files, codes and audit types are all proposals, marked once here: every identifier in this document that does not carry a `path:line` is a **HYPOTHESIS** name.

**The two decisions in one paragraph.**
X-1: a host-side command, run by the installer as the Core's OS user, that calls the existing `provisionSigningKey` with a production certificate subject naming the organisation and the installation; software Ed25519, self-signed, file store with the modes the code already enforces. No change to checks 4 and 4b.
X-2: a host-side command, run with the Core stopped, that sets the password of one named operator or walks every operator who still has the demo password; the password is typed at the terminal with echo off, hashed with the existing Argon2id wrapper. No change to check 4c. A signed-in password change in the console is a later row.

---

## 1. What "a production Core cannot start" means today (facts)

| # | Fact | Source |
|---|---|---|
| F1 | Boot check 4: the signing key must load. `signingKeyProblem()` returns a code when `loadSoftwareSigner` throws | `apps/core-server/src/capture/boot/checks.ts:423-424`; `capture/boot/index.ts:141-149` |
| F2 | Boot check 4b refuses when `operation === REAL_PRODUCTION && deps.signingKeyIsDevelopment()` | `checks.ts:426-427` |
| F3 | "Development" is ONE test: the certificate's subject TEXT contains `OU=DEVELOPMENT KEY - NOT FOR PRODUCTION` | `capture/boot/index.ts:157-163`; `packages/shared/src/evidence-verify/report.ts:28`, `:38-40` |
| F4 | The same mark is defined a second time in the server (`DEVELOPMENT_KEY_UNIT`, `isDevelopmentSigningCertificate`) | `apps/core-server/src/sealing/signing.ts:29`, `:41-43` |
| F5 | Boot check 4c refuses when the count of stored hash sets that verify against the published demo password is above 0, or when the count cannot be read (`OPERATORS_UNREADABLE`) | `checks.ts:429-435` |
| F6 | The count reads EVERY row of `operator_credentials` (no filter on `enabled`) and verifies each with the product's verifier against the constant `DEMO_OPERATOR_PASSWORD` | `capture/boot/index.ts:166`, `:179-198` |
| F7 | The seal refuses a development key on a package whose sources are all production | `apps/core-server/src/sealing/pipeline/pipeline.ts:798-801` |
| F8 | A production Core also refuses without `DEMS_INSTALLATION_DEVICE_ID` and `DEMS_INSTALLATION_NAME` | `apps/core-server/src/sealing-host/installation-identity.ts:18-25`, `:76-89` |
| F9 | No command provisions a production key; no operation changes a password | `README.md` "Capture operation" (paragraph "The signing key"), Known limits 25 and 34; `sealing/signing.ts:17-18`; `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md:557` (ID-11), `:2044` (GS-01) |
| F10 | A real Core writes one `SYSTEM_BOOT` audit row per boot, with `details.captureOperation` | `apps/core-server/src/capture/fence/index.ts:490-491` |

---

# PART A - X-1: provisioning of the production evidence signing key

## 2. X-1 decision

**Chosen: option A - a host-side command that provisions a software Ed25519 key through the existing store, with a production certificate subject that states the organisation and the installation.** It is the only option that can be built and tested on this Mac, it adds no cryptographic code (the one pinned file `host-key.ts` is not edited by the first package), and checks 4 and 4b pass on their existing conditions.

### 2.1 Facts as built

| # | Fact | Source |
|---|---|---|
| A1 | Algorithm is fixed by the code: Ed25519, `generateKeyPairSync('ed25519')`. The seam names one other algorithm, ECDSA-P256, for a TPM / PKCS#11 adapter that does not exist | `capture/signer/host-key.ts:189`; `capture/signer/types.ts:5-7`, `:13` |
| A2 | At rest: directory 0700; `<keyId>.p8` PKCS#8 encrypted (AES-256-CBC), 0600; `<keyId>.wrap` 32-byte secret, 0600; `<keyId>.crt` 0644; `<keyId>.compromised` = signs nothing | `host-key.ts:9-21`, `:38-41`, `:193`, `:205-207` |
| A3 | The wrap secret lies beside the key file: the encryption defends against a copied key FILE, not against a reader of the directory. Stated by the code itself | `host-key.ts:16-21` |
| A4 | Modes are set explicitly after the write (`chmodSync`), files are created exclusively (`flag: 'wx'`) | `host-key.ts:76-85` |
| A5 | Provisioning never replaces: `KEY_EXISTS` when key, certificate, compromise mark or wrap secret of that id exists | `host-key.ts:186-188` |
| A6 | Randomness: key from `generateKeyPairSync`, wrap secret `randomBytes(32)`, serial `randomBytes(16)`, all `node:crypto`. `ProvisionOptions` has no random-source parameter; only `now` and `validityDays` are injectable | `host-key.ts:31`, `:165-170`, `:189-197` |
| A7 | The certificate is SELF-SIGNED: issuer and subject are the same name, signed with the key itself; not a CA; keyUsage digitalSignature | `capture/signer/der.ts:81-110` (name twice at `:104`, `:106`; extensions `:95-97`) |
| A8 | The subject has exactly three attributes: O, OU, CN. Defaults: `O=DEMS Core`, `OU=Evidence signing`, `CN=<keyId>`; the caller may override each | `der.ts:59-67`, `:83-87`; `host-key.ts:46`, `:169`, `:196` |
| A9 | Validity 1,825 days by default; a certificate that does not cover "now" is refused at load (`CERTIFICATE_NOT_VALID_NOW`) | `host-key.ts:44`, `:199`, `:248-250` |
| A10 | Load fails closed: compromised, absent, mode with any group/other bit (`KEY_MODE`), unreadable, certificate not this key's | `host-key.ts:60-74`, `:223-252` |
| A11 | Weakness of the read path, open: `statSync` follows a link, the owner is not checked, check and read are two calls, the directory's mode is not checked at load (S99-06, LOW, carried) | `docs/2026-10-07_dems_real_capture_sealing/verification/02_security.md:61`; D241 (`decisions.md:254` of that task) |
| A12 | Key id is one constant, `CORE-KEY-EVSIGN-01`; every loader passes no key id, so the Core can load only that id | `types.ts:11`; `sealing/signing.ts:36-38`; `sealing-host/index.ts:275`; `modules/transcripts/routes.ts:223` |
| A13 | The same signer signs sealed manifests AND transcript revisions | `sealing-host/index.ts:275`; `modules/transcripts/routes.ts:223` |
| A14 | The Core's verify trusts exactly one certificate: the sha256 of the currently loaded one. The option is already a LIST | `sealing-host/index.ts:725-732`; `packages/shared/src/evidence-verify/verify.ts:282-283`; `evidence-verify/types.ts:537-538` |
| A15 | `markSigningKeyCompromised` and `readStoredCertificate` exist; no non-test caller was found for either (grep of `src/` and `cli/` on 2026-10-13) | `host-key.ts:260-277` |
| A16 | The development command: `runDevKeyCommand(args, now)` returns exit code and lines; prints directory, key id, subject, certificate sha256 only | `sealing/dev-key-cli.ts:23-48` |
| A17 | The sealing folder states that it provisions no production key | `sealing/signing.ts:17-18` |
| A18 | `host-key.ts` is the ONE signer file allowed to import the file system and `node:crypto`, pinned by a static test | `host-key.ts:5-7`; `capture/__tests__/static.test.ts:67-68` |
| A19 | On this Mac `.data/signer` exists with mode `drwx------` and holds `CORE-KEY-EVSIGN-01.p8` (`-rw-------`), `.wrap` (`-rw-------`), `.crt` (`-rw-r--r--`). Contents not read | `ls -la` on 2026-10-13, names and modes only |
| A20 | The spec's rotation rule: a new key id and certificate; packages keep the certificate set; nothing sealed is rewritten. Compromise runbook steps (a)-(e) | `docs/2026-10-07_dems_real_capture_sealing/masterplan/06_evidence_package_spec.md:826`, `:829` |
| A21 | The spec's threat model: the signer defends integrity; "the trust anchor is out-of-band certificate distribution" | same file `:827` |
| A22 | `.gitignore` ignores `*.p8`, `*.wrap`, `*.blob` | `README.md` "State at commit 713d83f" (S99-07) |

### 2.2 The specific questions

**Is "production" only the absence of the development mark?** In the code today: yes (F3). In this design: no. A certificate provisioned without a subject would read `CN=CORE-KEY-EVSIGN-01,OU=Evidence signing,O=DEMS Core` on EVERY installation (A8), so the certificate would tell a verifier nothing about who sealed. The manifest already names the installation under the signature (fields 20, 21 from the two installation settings, F8), but the certificate is what is handed over out of band (A21), and it should say whose it is. **Decision: a production certificate states its organisation and its installation.**

- `O` = the organisation, typed by the installer.
- `OU` = `Evidence signing <installation device id>`, where the id has the form of `DEMS_INSTALLATION_DEVICE_ID` (F8).
- `CN` = the key id, unchanged (no reader of the common name was found, but none is risked).

**HYPOTHESIS** (design): the installation goes into `OU` because the DER writer has three attributes only (A8); adding a fourth attribute to `der.ts` is the alternative and costs an edit of the certificate writer and its tests. The security review should rule which.

What this identity is worth must be said plainly: it is SELF-ASSERTED. Whoever holds a key can write any organisation into a self-signed certificate. The identity helps a verifier sort certificates; it proves nothing. What binds a certificate to an installation is the hand-over of its fingerprint by a person (section 2.6, the hand-over record).

**Is the certificate self-signed, and is that acceptable?** Yes, self-signed (A7), as the development one. **Stated limit, not a silent choice: there is no certificate authority and no chain.** A verifier can establish "this package was signed by the key of this certificate, and has not changed since"; it cannot establish "this certificate belongs to that organisation" from the certificate alone. That second statement rests on the out-of-band fingerprint (A21; `evidence:verify-export --trust <certificate sha256>`, `README.md` fix wave H block). Acceptable at this stage under two conditions: the limit is printed by the command and written in the README, and the fingerprint hand-over is a step of the installation runbook. Whether evidence must chain to an organisational or national CA is the user's decision (section 9, UD-3).

**Key backup and escrow - two different keys, kept apart.**

| | Evidence SIGNING key (`<data dir>/signer`) | Session ENCRYPTION keys (`<data dir>/credential-store`) |
|---|---|---|
| Protects | integrity and origin of a sealed package | confidentiality: the fragments are AES-256-GCM encrypted at seal time (`README.md` "Evidence at rest") |
| Loss costs | NEW seals are impossible until a new key exists (boot check 4 refuses, F1; a recorded, unsealed session stays blocked). Everything already sealed stays readable and stays verifiable by anyone who holds the certificate fingerprint. The Core's own verify stops trusting old packages once a new key is the current one (A14, Known limit 30) | every sealed recording becomes unreadable, for ever (Known limit 37, SEC35-09) |
| Theft costs | the thief can sign forged packages that verify against the real certificate | the thief can decrypt sealed recordings he also holds |
| Backup | **NOT recommended.** A copy of a signing key is a second forging capability, and the loss is recoverable by provisioning a new key id. Back up the CERTIFICATES (public) only | **needed**, and not designed here: it is Known limit 37, open, the user's decision (D241) |

X-1 neither opens nor closes limit 37. The design must not let the two be confused in the README: one sentence per key, as above.

### 2.3 Threat model

**Who may run it, where.** The installer, at a terminal of the Core host, as the OS user the Core runs as. Never over the network, never by the Core process, never by an agent on a production data directory. An agent may run it against a temporary directory in a test (section 2.8).

| Mistake | What an attacker gains | Control in this design |
|---|---|---|
| Private key or wrap secret printed, logged or returned | a forging capability from a terminal scrollback, a log file or a support bundle | the command prints the lines of A16 only; the provisioning function returns the certificate (public); a test scans every output line and every error for key material (R-X1-2) |
| Key file or directory readable by group or others | any local account copies key and wrap secret (A3) | modes 0600 / 0700 already set explicitly (A4) and refused at load (A10); the command re-reads and asserts them before it reports OK (R-X1-3) |
| Key generated from weak or injected randomness | the key can be reproduced | no random seam exists (A6) and none may be added on the production path (R-X1-4) |
| Run as root, or as another user than the Core's | root-owned files the Core cannot read (boot fails closed) or, worse, a habit of running the Core as root | the command refuses uid 0 and reports the owner it wrote (**HYPOTHESIS**: refusing uid 0 is a proposal) |
| Provisioned into a directory an attacker controls (a link, a parent writable by others) | key written where the attacker reads it; or the attacker swaps key AND certificate later and the Core signs with his key (A21) | the command checks the data directory path: real directory, owned by the caller, no link on the way, no ancestor writable by group or others - the rule boot check 2 already applies to the worker program (`checks.ts:21-24`). At load: package X1-3 (S99-06) |
| A development key left in place under a production data directory | none - the Core refuses (F2) | the command names it: `KEY_EXISTS`, and says that a production installation uses its own data directory. It never deletes, renames or overwrites (A5; Red Line "never delete") |
| Typed organisation text that carries the development mark, a comma, `=` or a line break | a subject that reads as another subject, or as development | the two typed values are held to a narrow form before any key is made (R-X1-5). A text containing the development mark would be refused by check 4b anyway (F3): the failure is closed |
| Wrong host clock at provisioning | no attacker gain; the certificate is not valid now, or packages get `CERTIFICATE_NOT_VALID_AT_SIGNING` (`verify.ts:281`) | the command prints the validity window in UTC and the installer confirms it |
| The fingerprint is never handed over | a verifier trusts whatever certificate is inside the package: "consistent with itself" only (`README.md` fix wave H block, receiver's command) | the hand-over record of section 2.6 |
| A copy of `.data/signer` in a backup | a forging capability outside the host | README states: exclude `signer/*.p8` and `signer/*.wrap` from backups; `.gitignore` already covers the forms (A22) |

**Outside what X-1 can defend** (stated, not solved): a person who can run as the Core's OS user can read key and wrap secret (A3) and can change the Core's code; that adversary can forge (spec section H.5, `06_evidence_package_spec.md:1133-1135`). Only a hardware key (option C) moves that line.

### 2.4 Options

| Option | What | Cost | Verdict |
|---|---|---|---|
| **A** | Host command over the existing software store; production subject; file modes as built | S for the command, S for the hand-over record; no cryptographic code | **CHOSEN** |
| B | A, plus the wrap secret held outside the directory (OS keychain or the Core credential store) through the existing `KeyWrapSecrets` seam (`types.ts:42-52`) | M; the production host is Linux Ubuntu 24.04 (U12 A2), so the secret store is a Linux one that cannot be tested on this Mac; ties the signing key to the credential store, whose loss is limit 37 - the two keys would no longer be apart | Not now. Recorded as a hardening the seam already allows |
| C | Hardware key: TPM / PKCS#11 signer, ECDSA-P256 (`types.ts:5-7`; spec section C.3, class C-8) | L; needs a device with a TPM, a second `Signer` implementation, a certificate chain; not executable on this Mac | Deferred, as the spec already says (`06_evidence_package_spec.md:1124`). The user's decision UD-2 |
| D | Import a key or certificate issued by an organisational CA | M to L; no CA exists; an import path is a new way for key material to travel | Not now; follows UD-3 |

Why A and not "A with nothing else": the first package makes the Core start. Two more things are needed for the key to be operable for years, and they are separate packages so the first production boot does not wait for them: the retained certificate set with rotation (limit 30, section 2.9) and the read-path hardening (A11).

### 2.5 Interface

A first production boot has no Core running and no signed-in operator, so the interface is a host command. It needs no database, no network and no Core.

```
npm run evidence:production-key -w @dems/core-server -- --data-dir <absolute directory>
```

| Element | Rule |
|---|---|
| Arguments | `--data-dir` only, REQUIRED and absolute (no default: the development command defaults to the repository's `.data/`, `dev-key-cli.ts:27`, which is exactly where a production key must not go by accident). Strict parsing: an unknown option is a usage error |
| Typed at the prompt (NOT secret, echoed) | the organisation; the installation device id. Neither is a credential. The installation device id is compared, character for character, with what the installer will set as `DEMS_INSTALLATION_DEVICE_ID` |
| Confirmation | the command prints subject, validity window (UTC), directory and the self-signed limit, and asks for the word `PROVISION` before any key exists |
| Output on success | directory, key id, subject, certificate sha256, not-before, not-after, the path of the hand-over record. Nothing else |
| Exit status | 0 provisioned; 1 refused (`KEY_EXISTS`, directory rule, uid 0, not a terminal); 2 usage |
| No secret is typed | X-1 asks for no password or passphrase: the wrap secret is generated (A6). An agent can therefore run it on a temporary directory without touching a credential |
| Shape | as the development command: a function `runProductionKeyCommand(args, ports)` that returns code and lines (A16), and a thin process entry. The entry lies outside `src/sealing` (A17). **HYPOTHESIS**: `apps/core-server/cli/production-key.ts` beside `cli/verify-export.ts`, logic under a new `src/provisioning/`; the static import rules of the capture folder must be checked by the row before the place is fixed |

It calls `provisionSigningKey({ dir: <data dir>/signer, now, keyId: CORE_EVIDENCE_SIGNING_KEY_ID, subject: { organization, organizationalUnit } })` - the function and its parameters exist (`host-key.ts:165-212`).

### 2.6 What is stored where

| Path under `<data dir>/signer/` (dir 0700) | Mode | Content | Written by |
|---|---|---|---|
| `CORE-KEY-EVSIGN-01.p8` | 0600 | encrypted private key | existing code (A2) |
| `CORE-KEY-EVSIGN-01.wrap` | 0600 | wrap secret | existing code (A2) |
| `CORE-KEY-EVSIGN-01.crt` | 0644 | certificate (public) | existing code (A2) |
| `CORE-KEY-EVSIGN-01.provisioned.json` | 0644 | **HYPOTHESIS** (new): the provisioning record - key id, certificate sha256, subject, serial, not-before, not-after, the instant, the command's version, the numeric uid. Public facts only | package X1-1 |
| `<data dir>/handover/CORE-KEY-EVSIGN-01.handover.txt` | 0644 | **HYPOTHESIS** (new): the hand-over record - a copy of the certificate PEM, its sha256, the self-signed limit in one sentence, and the `--trust` line of the receiver's command. This is the file the installer gives to whoever will verify | package X1-1 |

Nothing of X-1 is stored in the database, in the media store or in the repository.

### 2.7 What is audited, and where

The Core is not running and a database may not exist yet, so the act cannot write an audit row when it happens. Three records, in order of strength:

1. **The provisioning record** on disk (section 2.6), written by the command. It is a file the Core's user can rewrite: it is a note, not evidence.
2. **The certificate itself**: serial, validity and subject are inside every sealed package and under every signature (manifest fields 25-27; `types.ts:29-34`).
3. **The audit chain, at the next boot.** The Core already appends `SYSTEM_BOOT` with `details.captureOperation` (F10). **HYPOTHESIS** (design): add `signingKeyId` and `signingCertificateSha256` to that row's details. Then the chain states, for every boot, which key the Core started with, and a change of key between two boots is visible in the chain without a new audit type. Both values are public. Cost: the details rule of `SYSTEM_BOOT` in `src/core/audit-details.ts` and the contract example.

The command's own terminal output is the installer's fourth record; the runbook says to keep it with the installation papers.

### 2.8 What must NEVER happen (requirements the rows carry)

| Id | Requirement |
|---|---|
| R-X1-1 | The private key and the wrap secret never leave `host-key.ts`'s functions: not returned, not printed, not logged, not put into an error, not written to any file but the two of A2 |
| R-X1-2 | A test scans every line the command can print, on success and on each refusal, and the provisioning record and hand-over record, for: the bytes of the wrap secret, the base64 of the key file, the marker `PRIVATE KEY` |
| R-X1-3 | Before reporting OK the command stats what it wrote: directory 0700, `.p8` and `.wrap` 0600, owner = the caller. Any other result is exit 1 with a code, and the files are LEFT (never deleted): the installer decides |
| R-X1-4 | No parameter, environment variable or test seam selects the random source on the production path. The command reads no environment variable at all |
| R-X1-5 | Organisation: 2 to 64 characters from letters, digits, space, hyphen, full stop (**HYPOTHESIS**: the exact set). Installation device id: the form of `DEMS_INSTALLATION_DEVICE_ID`. Refused before any key is generated: comma, `=`, line break, the development mark |
| R-X1-6 | The command never replaces, deletes, renames or moves a file. `KEY_EXISTS` is final |
| R-X1-7 | The command refuses a data directory that is a link, is not owned by the caller, or has an ancestor writable by group or others; and refuses uid 0 |
| R-X1-8 | Tests and agents provision into a fresh temporary directory only. No test names `.data/` of the repository or any production directory; the existing `.data/signer` (A19) is never opened, listed for content or written |
| R-X1-9 | The two definitions of the development mark (F3, F4) are held equal by a test. **HYPOTHESIS**: no such test was looked for; the row checks `sealing/__tests__/signing.test.ts` first |

### 2.9 Failure and recovery

| Case | What happens today | Design |
|---|---|---|
| Key lost (directory deleted, disk replaced) | check 4 refuses: `KEY_ABSENT` -> `CAPTURE_SIGNING_KEY_UNUSABLE` (F1). Sealed packages stay readable (their keys are in the credential store) | provision again. If the `.crt` is gone too, the first key id is free and the command works as on day one. Old packages: verified by a receiver with the old fingerprint; the Core's own verify says `CERTIFICATE_NOT_TRUSTED` for them (A14) until package X1-4 exists |
| Key compromised | the function exists, nothing calls it (A15) | package X1-4: `evidence:mark-compromised` (runbook step b) then rotation (step c). Re-verification of old packages against the retained certificate (step d) is the retained set |
| Certificate expires (1,825 days, A9) | the Core refuses to start: `CERTIFICATE_NOT_VALID_NOW` | rotation is the only way out, so rotation cannot stay unbuilt for ever. It is not needed for the first boot |
| Rotation | impossible: one key id is loadable (A12), provisioning refuses an existing id (A5) | package X1-4 (M): a second key id (`CORE-KEY-EVSIGN-02`, ...), an explicit statement of which id is active, and the loaders read it. **HYPOTHESIS** (design): the active id is a small file `<data dir>/signer/ACTIVE` (0644, one key id), written only by the rotate command; absent = `-01`, so today's stores keep working |
| Packages sealed with the earlier key (Known limit 30) | trusted only while that key is current (A14) | the trusted list becomes "the sha256 of every `.crt` in the signer directory that is not this run's development key" - the option is already a list (A14). A package signed by a COMPROMISED key keeps verifying its signature and gets a notice that names the mark (**HYPOTHESIS**: a notice, not a failure - the spec says a compromised key never rewrites a manifest, A20; the reviewer rules) |
| Transcript revisions after rotation | same signer (A13); the database keeps the certificate sha256 per revision (A20) | covered by the retained set; a row of X1-4 tests one revision signed before and one after a rotation |
| Installation renamed after provisioning | nothing notices | section 2.10, the optional binding check |

### 2.10 What changes in the boot checks

**Nothing in checks 4 and 4b. They pass on the conditions they test today:**

- Check 4 passes when `loadSoftwareSigner` does not throw (F1): files with no group/other bit, key opens with the wrap secret, certificate is this key's and covers now (A10). The command writes exactly that state (A2, A4).
- Check 4b passes when the subject text does NOT contain `OU=DEVELOPMENT KEY - NOT FOR PRODUCTION` (F2, F3). The production subject's unit is `Evidence signing <id>`, and R-X1-5 refuses any typed text that carries the mark.
- The seal's refusal (F7) tests the same predicate and passes for the same reason.

No line of `checks.ts` is edited for this. The proof is a test that runs the real `runCaptureBootChecks` for `REAL_PRODUCTION` against a store the command made (section 2.11).

**One ADDITIVE check, the user's decision (UD-4).** **HYPOTHESIS** (design): check 4b-2, `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`, refuses a production start when the certificate's unit does not name the configured `DEMS_INSTALLATION_DEVICE_ID`. It makes "the certificate says which installation" a fact the Core holds, and it catches a key directory copied from another installation. Its cost: renaming an installation then needs a rotation, so it should land with or after X1-4. It tightens; it weakens nothing.

### 2.11 How it is tested on this Mac without a real secret

X-1 has no secret that a person types, so every test is real and throw-away: a key generated into a `mkdtemp` directory is a real Ed25519 key that protects nothing and is deleted with the directory.

| Test | Proves |
|---|---|
| Command on a temporary directory | exit 0; the four output facts; modes 0700 / 0600 / 0600 / 0644; the two records exist with public facts only (R-X1-2, R-X1-3) |
| Second run on the same directory | `KEY_EXISTS`, nothing changed (byte comparison of the directory before and after) |
| Subject | `isDevelopmentKeySubject(subject) === false`; subject carries organisation and installation id; each refused input of R-X1-5 makes no file |
| Boot checks | `runCaptureBootChecks` with operation `REAL_PRODUCTION` and the real `storedSigningKeyProblem` / `storedSigningKeyIsDevelopment` on that directory passes 4 and 4b; the same directory provisioned with the DEVELOPMENT function still refuses 4b (the negative control that the check was not weakened) |
| Seal | the sign step with all-production sources does not throw `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES`; mirror of `sealing/__tests__/pipeline-development-key.test.ts` |
| Directory rule | a link, a group-writable ancestor: refused, no file made |
| Static | the command's files import no `node:crypto` (A18 stays true) |

Not provable here: a whole started `REAL_PRODUCTION` Core. Whether check 4d (the host checks, `checks.ts:36-37`) can pass on macOS was not inspected; the README says a production Core has never started (`README.md` "Not proven"). That start is its own gate (package X-G).

---

# PART B - X-2: non-demo passwords for operators

## 3. X-2 decision

**Chosen: option A - a host-side command, run with the Core stopped, that sets the password of one named operator or walks every operator whose stored credential still verifies against the demo password. The password is typed at the terminal with echo off, twice, and stored only as the Argon2id hash set the identity module already uses.** It is the only form that works for a first production boot (no production operator can be signed in before it), it also serves recovery, and it satisfies check 4c without touching it. **The signed-in password change in the console is NOT in scope now: it is its own later row**, because check 4c can be satisfied without it.

### 3.1 Facts as built

| # | Fact | Source |
|---|---|---|
| B1 | The seed hashes ONE constant, the published demo password, for every operator, each with a fresh salt | `apps/core-server/src/db/seed/seed.ts:232-240`; `packages/shared/src/sim/dataset.ts:150-153` |
| B2 | The dataset has three operators, one per role: investigator, supervisor, technician | `packages/shared/src/sim/dataset.ts:118-146` (usernames at `:122`, `:131`, `:140`) |
| B3 | No operation creates or deletes an operator; the runtime role has no INSERT or DELETE on `operators` | `apps/core-server/src/db/schema/rbac.ts:76` |
| B4 | Stored per operator, one row: algorithm, memory, passes, parallelism, salt, hash, hashed-at. Never the password. CHECKs: `argon2id`; memory >= 19,456 KiB, passes >= 2, parallelism >= 1; salt >= 16 bytes, hash = 32 bytes | `rbac.ts:108-143` |
| B5 | Hashing: Argon2id through Node's `crypto.argon2`, 19,456 KiB, 2 passes, parallelism 1, 16-byte salt from `randomBytes`, 32-byte tag; no pepper | `modules/identity/password-hash/password-hash.ts:33-55`, `:19-21`, `:294-300`; SR-05, SR-61 (`01_specs.md:1568`, `:1664` of the 2026-10-04 task) |
| B6 | Verification recomputes with the stored parameters and compares with `timingSafeEqual` | `password-hash.ts:275-279`, `:302-306` |
| B7 | The only password rule today: a string of 1 to 128 UTF-16 code units, taken as sent - not trimmed, folded or normalised. No minimum strength, no history, no expiry | `password-hash.ts:23-24`, `:57`, `:187-196`; `packages/shared/src/api/identity.ts:74-78`; ID-P10 (`01_specs.md:529`) |
| B8 | The only writer of a credential after the seed: the re-hash after a successful sign-in, a compare-and-set UPDATE on the hash that was just verified | `modules/identity/sign-in.ts:258-277`; `modules/identity/session-store.ts:387-409` |
| B9 | The runtime role may UPDATE the credential columns | `apps/core-server/src/db/migrations/0003_privileges.sql:31` |
| B10 | Lockout is per CONSOLE, not per account: 5 attempts in 300 s lock the console for 60 s; counters are memory and reset at a restart | `modules/identity/lockout.ts:5-7`; `modules/identity/limits.ts:11-16`; SR-22, SR-25 (`01_specs.md:1595`, `:1598`) |
| B11 | Session ends are a closed set of eight reasons; none says "password changed". Biometric revocation reasons are a closed set of six | `apps/core-server/src/db/schema/value-sets.ts:104-122` |
| B12 | Sessions of an operator can be ended in one statement; disabling a user ends sessions and revokes biometric tokens in one unit | `session-store.ts:209`, `:218-220`; `modules/admin/changes.ts:13-16`, `:41` |
| B13 | User administration: list, assign role, enable, disable - permission `USER_ADMIN`. The rule `LAST_ADMIN` refuses a change that leaves no enabled holder of it | `packages/shared/src/api/administration.ts:11-15`, `:123`, `:181` |
| B14 | Identity operations of the contract: sign-in, status, session, sign-out, biometric. None changes a password | `packages/shared/src/api/identity.ts:281-340`; `modules/identity/operations.ts:2-3`; ID-11 (`01_specs.md:557`) |
| B15 | The database commands run as the owner role `dems_owner`, whose connection file `<data dir>/pg.owner.env` (0600) the command reads itself; nothing goes through the environment or the arguments | `apps/core-server/src/db/commands/owner-connection.ts:1-19`, `:27-40` |
| B16 | A database command is `runCommand(name, argv, options, work)` with injectable options for tests | `apps/core-server/src/db/seed/cli.ts:32-48`, `:68-69` |
| B17 | The audit writer is the only server-runtime path into `audit_log`, pinned by a static test; a unit opens with the lock of the chain head; a second writer makes the running Core fail units with `audit head diverged` | `apps/core-server/src/core/audit-writer.ts:5-7`, `:11-27` |
| B18 | An audit row's actor is an operator id or null; null means the system | `core/audit-writer.ts:112-116`, `:160-161` |
| B19 | `audit_log.type` is held by a CHECK on its FORM (`code(t.type)`); the audit types are a shared vocabulary with a category map | `apps/core-server/src/db/schema/audit.ts:75`; `packages/shared/src/sim/vocabulary.ts:348-422`, `:504-518` |
| B20 | The reset detects a running Core of a database through `pg_stat_activity` and refuses (`RESET_TARGET_IN_USE`) | `apps/core-server/src/db/reset/routine.ts:130`, `:586` |
| B21 | Open after the boot refusal: `db:seed` and `db:reset` still write the demo password in a production environment; the two sign-in cards print the demo password and fill it in | `README.md` Known limit 34; `02_security.md:56` of the 2026-10-07 task (S99-01 (b), (d)) |
| B22 | The published-password rule of the identity design: a move off loopback "MUST first replace the seeded password and remove the disclosure" | SR-63 C4 (`01_specs.md:1666` of the 2026-10-04 task) |
| B23 | No code in `src/`, `cli/` or `scripts/` reads a hidden line from a terminal (grep for `setRawMode`, `stty -echo`, `read -s` on 2026-10-13: no match) | grep, no output |

### 3.2 Threat model

**Who may run it, where.** A person at a terminal of the Core host, as the OS user that can read `pg.owner.env` (B15), with the Core stopped. Each password is typed by the person who will use it, or by the installer who then hands it over (UD-7). Never an agent with a real password; never over the network.

**The capability it grants is not new.** Whoever can read the owner connection file can already rewrite any row of the database. The command adds nothing to what host access means; it adds a correct hash, ended sessions and an audit row. That must be said in the README: **host access to the Core's user is full control of every operator account.**

| Mistake | What an attacker gains | Control in this design |
|---|---|---|
| Password as a command argument or environment variable | readable by every local process (`ps`), kept in shell history | no such option exists; strict argument parsing refuses `--password`; the command reads no environment variable for it (R-X2-1) |
| Password echoed | read from the screen, a recording of the terminal, the scrollback | echo off; nothing is printed per key, not even a mask character (a mask reveals the length) (R-X2-2) |
| Password read from a pipe or a file | automation with a stored password; an agent supplying one | the process entry refuses unless standard input IS a terminal (R-X2-3) |
| Password, or a value derived from it, in a log, an error, an audit detail or the output | recovery of the password, or an offline guess against a leaked hash | the hash wrapper's errors carry a code only (`password-hash.ts:26-28`); the command prints usernames and counts only; a test sweeps every output for the typed synthetic value, the salt and the tag (R-X2-4) |
| Password stored reversibly | recovery of every password from a database copy | the only write is the hash set of B4 through `hashPassword` (B5); no other column, table or file (R-X2-5) |
| The demo password accepted as the new one | check 4c would refuse the boot - no gain, but a wasted installation | refused by comparison with the constant before any hash is computed (R-X2-6) |
| A trivially weak new password | online guessing; the lockout is 5 tries per console per minute (B10), so a guessable password falls in hours from one console | the policy of section 3.5 |
| Old sessions and biometric tokens survive the change | a session opened with the demo password stays valid for up to 8 hours (`limits.ts:26`) | the same transaction ends the operator's sessions and revokes the biometric tokens (R-X2-7) |
| The command run while the Core runs | no attacker gain; the running Core's chain head and session registry are in memory and diverge (B17) | refused while a Core of that database is connected, by the test the reset uses (B20) (R-X2-8) |
| The wrong database (a lane, the demo database) | none, but the user's working state is changed (C29) | `--database` is required and is echoed with the operator list before the first prompt; the installer confirms |
| An operator left with the demo password (a disabled account, a forgotten one) | a known password on an account that can be enabled later | check 4c counts every row, enabled or not (F6); the walk uses the same predicate, and the command ends by printing the count check 4c will compute |
| `db:reset` after provisioning | every password is the demo password again (B21) | check 4c refuses the next production boot: fails closed. The reset is refused once real evidence exists (`README.md` "Reset rules"). Stated in the runbook |

**An honest limit of the runtime.** A JavaScript string cannot be wiped; the typed password lives in the process memory until the process exits. The command is a short-lived process that does one thing and exits; the limit is stated, not solved.

### 3.3 Options

| Option | What | Cost | Verdict |
|---|---|---|---|
| **A** | Host command, Core stopped, terminal prompt; one operator or the walk | S for the prompt, M for the command with transaction, sessions and audit, S for one vocabulary step | **CHOSEN** |
| B | A password-change operation in the console (signed-in operator changes own password; Supervisor resets another's) | M to L: a new contract operation with a secret body, web console and two mobile clients, lockout interplay, tests on three clients. And it cannot bootstrap: before the first production boot nobody can be signed in | Later row. Needed for day-to-day use, not for the boot check |
| C | The seed takes the passwords (a seed-time override; GS-21, `01_specs.md:2064`) | S to M; but the seed runs as a batch command where a prompt per operator is awkward, it gives no recovery path, and a reset would ask again | Rejected: it solves bootstrap only |
| D | A one-time setup code printed at first boot, used in the console to set the first Supervisor's password | M; the Core would have to START without passing check 4c, which is exactly the weakening the brief forbids | Rejected |

### 3.4 Interface

```
npm run operator:set-password -w @dems/core-server -- --database <name> --username <username>
npm run operator:set-password -w @dems/core-server -- --database <name> --all-demo
```

**One command, two forms** - this answers "one command that walks them, or one per operator": both, in one program, because bootstrap wants the walk and recovery wants the single account.

| Element | Rule |
|---|---|
| `--username <u>` | sets the password of that operator, whatever it has now. Bootstrap of one account, and recovery of a forgotten password |
| `--all-demo` | reads every stored hash set, finds each operator whose set verifies against the demo password (the predicate of check 4c, F6), lists them by username and role, and prompts for each in turn. An operator may be skipped; the command then ends with exit 1 and the remaining count |
| Prompt | per operator: "New password for `<username>` (`<role>`):" with echo off, then "Again:". The two must be equal. Three failed tries for one operator end the command with nothing written for that operator |
| No secret in arguments, environment, standard input pipe or output | section 3.2 |
| Connection | the owner role through `pg.owner.env`, the scaffold of the database commands (B15, B16). No network listener, no Core |
| Core must be stopped | refused with a code when a Core of that database is connected (B20) |
| One transaction per operator | lock the audit chain head (B17); lock the operator row; write the seven credential columns; end the operator's sessions; revoke the operator's biometric tokens; append the audit row; commit. Any failure rolls all of it back |
| Final lines | per operator: `<username>: password set, <n> session(s) ended`. Then: `operators that still have the demo password: <count>` - the number check 4c will compute. Exit 0 only when the asked work is done; with `--all-demo`, only when that count is 0 |
| Exit status | 0 done; 1 refused or incomplete; 2 usage |
| Shape | `runSetPassword(argv, options)` with an injectable prompt port and hasher, as `runSeed` (B16); a thin process entry that owns the terminal. **HYPOTHESIS**: the entry in `apps/core-server/cli/`, the logic beside the database commands; the static rule on who may name the owner file (`owner-connection.ts:9-12`) decides the folder |

**The terminal prompt.** **HYPOTHESIS** (design, nothing exists - B23): a small port `readSecretLine(label)` whose real implementation puts the terminal into raw mode, reads until the line end, restores the terminal on every exit path (success, error, interrupt), and writes nothing per key. The command's logic sees only the port, so tests hand in a port that returns a synthetic value.

**Bootstrap sequence for a first production boot** (each step exists unless marked):

1. `pg:init`, `db:create`, `db:migrate`, `db:seed` on the production database - as today. The seed writes the three operators with the demo password (B1) and the roles and permissions the RBAC boot step needs (`modules/rbac/index.ts:14-20`).
2. **X-2**: `operator:set-password --all-demo` - count reaches 0.
3. **X-1**: `evidence:production-key --data-dir <dir>`.
4. Set `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`, the capture keys; start. Checks 4, 4b, 4c pass.

### 3.5 Password policy and hashing

**Hashing: reused unchanged.** The command calls `hashPassword` (B5). Parameters, salt length, tag length and the CHECK floors (B4) are the identity module's; no second set of numbers.

**Policy for a NEW password: none exists today beyond 1 to 128 code units (B7), so the numbers are the user's (UD-6).** Recommended default, all **HYPOTHESIS** until ruled:

| Rule | Default | Reason |
|---|---|---|
| Minimum length | 12 characters | length over composition; the console lockout (B10) is the only online brake |
| Maximum length | 128 UTF-16 code units | the existing bound (B7); the sign-in schema refuses more |
| Composition rules (digits, symbols) | none | they lower real strength and raise forgotten passwords |
| Refused values | the demo password; the operator's own username; a password of one repeated character | cheap, no word list to maintain |
| Taken as typed | no trim, no case fold, no Unicode normalisation | the existing rule of the hash (B7): sign-in must hash the same bytes |
| Expiry, history | none | no mechanism exists; not needed for the boot check |
| Two operators with the same password | not checked | hashes are salted (B5): equality cannot be seen without keeping plaintext, which is forbidden |

The policy is ONE module in the shared package, so the later console operation applies the same rule (package X2-1).

### 3.6 What is stored where

| Where | What | Mode / protection |
|---|---|---|
| `operator_credentials`, the operator's one row | the new hash set, seven columns (B4), `hashed_at` = the instant | the table's rule: no column logged or returned (`rbac.ts:108-111`) |
| `auth_sessions`, the operator's open rows | ended, with a reason | closed value set (B11) |
| biometric tokens of the operator | revoked, with a reason | closed value set (B11) |
| `audit_log` | one row per operator | chain guard (B17) |
| Disk | nothing. No file is written by X-2 | - |

**One vocabulary step is needed.** No session-end reason and no biometric-revoke reason fits (B11). **HYPOTHESIS** (design): add `CREDENTIAL_REPLACED` to both sets - a migration of two CHECK constraints, hence a single-writer resource. Reusing `SIGNED_OUT` would write a false statement into the session history and is rejected. On a FIRST boot there are no sessions, so the value matters for recovery only; the security review may rule that recovery waits for the migration while bootstrap does not.

### 3.7 What is audited, and where

The Core is stopped, the database is up: the audit row is written by the command itself, in the transaction of the change, under the chain lock (B17).

| Member | Value |
|---|---|
| type | `OPERATOR_PASSWORD_SET` (new; category `SECURITY` as `USER_ENABLED`, `vocabulary.ts:506-507`). No migration for the type itself: the CHECK is on the form (B19) |
| actor | null = the system (B18). The command cannot know which person sat at the terminal, and must not pretend to |
| details | the target operator id; `method: HOST_COMMAND`; the number of sessions ended; whether the earlier credential was the demo one. NEVER: the password, its length, the salt, the tag, the parameters |
| message | fixed text naming the operator, no typed value |

Because the actor is null, the audit row proves THAT a password was set from the host and WHEN, not BY WHOM. Who has host access is an operating procedure outside the product; the README says so.

**HYPOTHESIS** (unverified): the audit writer can be used on an owner-role transaction outside the Fastify app. If it cannot, the command needs its own append under the same protocol and the static test that pins "one writer" (B17) is amended by a decision - the row must settle this first and report before writing.

The next `SYSTEM_BOOT` row follows in the chain, so the order "passwords set, then first production start" is readable from the chain alone.

### 3.8 What must NEVER happen (requirements the rows carry)

| Id | Requirement |
|---|---|
| R-X2-1 | No option, environment variable, file or configuration key carries a password into the command. A test passes `--password` and expects a usage error |
| R-X2-2 | Nothing is written to the terminal while a password is typed; the terminal state is restored on every exit path, an interrupt included |
| R-X2-3 | The process entry refuses when standard input is not a terminal. There is no flag that lifts this |
| R-X2-4 | A test sweeps standard output, standard error, the audit row and the server-side error log for the synthetic password, the salt and the tag after a success and after each refusal |
| R-X2-5 | The only write of credential material is the hash set through `hashPassword`. No reversible form, no hint, no "temporary password" column |
| R-X2-6 | The demo password is refused as a new password, before hashing. The policy of section 3.5 is applied before hashing |
| R-X2-7 | Sessions ended and biometric tokens revoked in the SAME transaction as the credential write |
| R-X2-8 | Refused while a Core of the database is connected; refused on a database that is not migrated to the current schema |
| R-X2-9 | **Agents never type, receive, generate-and-keep or read a real password.** Every real password is typed by the user or an operator at the terminal prompt. Tests use synthetic values, built in the test, on a throw-away test database and never on the user's lanes or the demo database (C29, `decisions.md:56`) |
| R-X2-10 | The command creates, deletes, enables, disables and renames no operator and changes no role. It writes one thing: a credential |
| R-X2-11 | The walk's predicate IS check 4c's: one function, used by both, so the command's final count and the boot check cannot disagree |

### 3.9 Failure and recovery

| Case | Design |
|---|---|
| A forgotten password | `operator:set-password --username <u>` at the host, Core stopped. A stop of the Core is required: recording must not be running. Until the console operation exists (later row) this is the ONLY way, and it needs host access |
| The last Supervisor locked out | Two different things. (1) The lockout of B10 is per console, 60 s, in memory: nobody is locked out of an ACCOUNT, and a restart clears it. (2) The last holder of `USER_ADMIN` cannot be disabled or demoted (`LAST_ADMIN`, B13). So "locked out" can only mean "forgot the password": the row above. The host command is the break-glass, and the audit row with actor null is its trace |
| Typing error | the confirmation prompt; nothing is written on a mismatch |
| The command dies between two operators of the walk | each operator is one transaction: those done are done, the rest still have the demo password, check 4c refuses the boot and names the count. Run the walk again |
| The command dies inside one operator's transaction | rolled back: the old credential stands |
| A password set on the wrong account | set it again; the audit chain holds both rows |
| A reset reintroduces the demo password | check 4c refuses (section 3.2) |

### 3.10 What changes in the boot checks

**Nothing in check 4c. It passes on the condition it tests today:** the number of rows of `operator_credentials` whose stored set verifies against `DEMO_OPERATOR_PASSWORD` is 0, and the rows could be read (F5, F6). After the walk every such row has been replaced by a hash of a password that R-X2-6 guarantees is not the demo password, so each verification answers false and the count is 0. No line of `checks.ts` or `capture/boot/index.ts` is edited to make it pass; the one allowed refactor is to EXPORT the per-row predicate so that the command uses the same function (R-X2-11) - the check's behaviour and its tests stay as they are, and the row proves that by running the existing check tests unchanged.

### 3.11 How it is tested on this Mac without a real secret

| Test | Proves |
|---|---|
| Unit, injected prompt port, fake pool | the order of statements; a mismatch writes nothing; the policy refusals; `--password` is a usage error; the final count line |
| Database test on a throw-away test database (the name pattern the seed command already insists on, `seed/cli.ts:99-105`) | seed, walk with three synthetic values: the per-row predicate returns 0; sign-in with each synthetic value succeeds through the real sign-in; sign-in with the demo password fails; sessions opened before are ended; exactly one audit row per operator, chain intact |
| Boot check | `runCaptureBootChecks` for `REAL_PRODUCTION` with the real `storedDemoPasswordOperators` on that database passes 4c after the walk and refuses with `operators=3` before it (negative control) |
| Secret sweep | R-X2-4 |
| Not a terminal | the entry exits 1 when standard input is a pipe - this test hands in NO password |
| Core connected | refused (a second connection of the runtime role in the test stands in for the Core) |

What an agent cannot test: the real terminal prompt with a real person. The raw-mode port gets one attended check by the user (type a throw-away value, see nothing echoed, see the terminal restored after Ctrl-C). It is listed in the hardware and attended test package the task already keeps (U13).

---

# PART C - shared

## 4. What X-1 and X-2 do NOT make true (gaps found, not in scope)

A production Core will START after X-1 and X-2. These remain, and the README must not read as if they were closed:

| # | Gap | Source | Proposed handling |
|---|---|---|---|
| G1 | The operators of a production database are the three persons of the demo dataset, by name and username; no operation creates an operator (B2, B3) | `dataset.ts:118-146`; `rbac.ts:76` | The user's decision UD-8. X-2 changes passwords, not people |
| G2 | A production database is a SEEDED database: `db:seed` is the only source of roles, permissions and operators, and it writes the demo dataset with them | `seed.ts:312`; `checks.ts:33-34` ("until it exists, a seeded database is not a production one"); S99-01 (b) | A production seed profile is a task of its own. **HYPOTHESIS**: what else of the dataset reaches a production database was not inventoried here |
| G3 | Both sign-in cards still print the demo password and fill it in | Known limit 34; S99-01 (d) | A later row; it conflicts with SR-63 C4 (B22) the moment a listener leaves loopback |
| G4 | No signed-in password change: every change needs the host and a stopped Core | B14 | Later row (section 3.3, option B) |
| G5 | Credential-store escrow | Known limit 37 | The user's decision, unchanged |
| G6 | A whole `REAL_PRODUCTION` start has never been run | `README.md` "Not proven" | Package X-G |

## 5. Rationale chain, alternatives, assumptions

**Why host commands for both.** The first production boot has no signed-in operator and a Core that refuses to start. Any design that needs a running Core either cannot bootstrap or must weaken a boot check (X-2 option D). Both existing precedents are host commands of this shape: the development key (A16) and the database commands (B15, B16).

**Why no new cryptography.** The signer store (A2-A10) and the hash wrapper (B5, B6) were built, reviewed and tested in earlier tasks. Both new commands are callers. The one file pinned to hold key material (A18) is edited only by the hardening package X1-3.

**Assumptions** (each a **HYPOTHESIS** to be closed by the row that depends on it):

| # | Assumption | Closed by |
|---|---|---|
| H1 | A file outside `src/sealing` may import `provisionSigningKey` from the capture unit without breaking a static rule | X1-1, first step |
| H2 | The audit writer and the unit of work can run on an owner-role transaction outside the app | X2-3, first step |
| H3 | Ending sessions and revoking biometric tokens can be reused from the identity module in a command | X2-3 |
| H4 | The `SYSTEM_BOOT` details rule admits two new keys by an edit of `audit-details.ts` and the contract example only | X1-2 |
| H5 | Raw-mode terminal input behaves the same on macOS and Ubuntu 24.04 | X2-2, attended check on each |
| H6 | Check 4d and the other production refusals can pass on this Mac for a gate | X-G |
| H7 | Adding one audit type moves the pinned contract totals (the README states 67 audit types at `713d83f`) and the simulator's category map | X-C |

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The self-signed limit is read as "certified" by a non-technical reader | Medium | High (evidential weight) | printed by the command, in the hand-over record, in the README; UD-3 asked |
| Rotation stays unbuilt and a certificate expires or a key is compromised | Low now, certain in 5 years | High (no new seal) | X1-4 in this task, not gating the first boot |
| A production key provisioned under the repository's `.data/` | Medium | Medium | `--data-dir` required, no default; `KEY_EXISTS` on this Mac (A19) |
| An agent supplies a password to make a test or a gate pass | Low | High (the repository's rule) | R-X2-3, R-X2-9; the entry cannot read a pipe |
| The second audit writer diverges the chain | Low | High | Core must be stopped (R-X2-8); chain lock; H2 settled before code |
| Three seeded demo persons are used as real accounts in a real examination | High if G1 is not ruled | High | UD-8 before any production recording |

## 7. Order of work

1. X-C (vocabulary and migration) and X2-1, X2-2, X1-1 in parallel - they share no file.
2. X1-2 after X-C (it needs the details rule); X2-3 after X-C, X2-1, X2-2.
3. X1-3 alone on `host-key.ts` (one writer).
4. X1-4 after X1-3 (same file).
5. X-D documentation after the commands exist; X-G last.
6. Security review of this design BEFORE row 1 (P11 (3)); security acceptance of the built commands before X-G.

## 8. Work packages (for the task-architect)

Sizes: S or M. Paths marked (new) are future files and are **HYPOTHESIS** names; paths marked (edit) exist.

| Id | Size | What | Files | Tests | Security requirements carried | Depends on |
|---|---|---|---|---|---|---|
| X-C | M | Vocabulary and contract: audit type `OPERATOR_PASSWORD_SET` with its details rule; two keys on `SYSTEM_BOOT` details; value `CREDENTIAL_REPLACED` in the session-end and biometric-revoke sets with ONE migration and its privileges file; contract totals and examples | `packages/shared/src/sim/vocabulary.ts` (edit); `apps/core-server/src/core/audit-details.ts` (edit); `apps/core-server/src/db/schema/value-sets.ts` (edit); migration `0019_*` and `0020_*` (new); `packages/shared/src/api` examples (edit) | vocabulary pins; details-rule tests refuse a password-shaped key; migration up on a throw-away database (C29) | no detail key may hold a secret; single migration writer | - |
| X1-1 | S | Production key command: subject rules, directory rule, uid rule, confirmation, provisioning record, hand-over record | `apps/core-server/cli/production-key.ts` (new); `apps/core-server/src/provisioning/production-key.ts` (new); `apps/core-server/package.json` script (edit) | section 2.11 rows 1-4, 6, 7 | R-X1-1 to R-X1-9 | H1 settled first |
| X1-2 | S | `SYSTEM_BOOT` states key id and certificate sha256 | `apps/core-server/src/capture/fence/index.ts` (edit, near `:491`); `capture/fence/boot.ts` (edit) | boot test reads both members; simulated operation writes neither | public data only | X-C |
| X1-3 | S | Read-path hardening of the signer store (S99-06): no link followed, owner checked, check and read on one handle, directory mode checked at load | `apps/core-server/src/capture/signer/host-key.ts` (edit) | a link, a foreign owner, a 0755 directory: each refused with the existing codes; existing signer tests unchanged | fail closed; no new error text that names a path | one writer of `host-key.ts` |
| X1-4 | M | Rotation and the retained certificate set (Known limit 30): active key id, `evidence:rotate-key`, `evidence:mark-compromised`, loaders read the active id, verify trusts every retained certificate | `host-key.ts` (edit); `sealing/signing.ts` (edit); `sealing-host/index.ts` (edit, near `:725`); `cli/rotate-key.ts`, `cli/mark-compromised.ts` (new) | a package sealed before a rotation verifies after it; a revision before and after; a compromised key loads for nobody and its packages carry the notice; expiry forces rotation | R-X1-1 to R-X1-8 apply to the new key; never rewrite a sealed manifest (A20) | X1-3 |
| X1-5 | S | OPTIONAL (UD-4): boot check 4b-2, certificate names the configured installation | `capture/boot/checks.ts`, `capture/boot/index.ts` (edit) | match passes; mismatch refuses; development and simulated never ask; ALL existing check tests unchanged | additive only | X1-1; best with X1-4 |
| X2-1 | S | Password policy, one shared module | `packages/shared/src/api/password-policy.ts` (new) | each rule of section 3.5; the demo password refused | R-X2-6 | UD-6 or its default |
| X2-2 | S | Terminal secret prompt port | `apps/core-server/cli/secret-prompt.ts` (new) | scripted pseudo-input at the port level; not-a-terminal refusal; restore on interrupt. One attended check by the user | R-X2-2, R-X2-3 | - |
| X2-3 | M | The set-password command: one operator and the walk; transaction; sessions and biometric tokens; audit; Core-connected refusal; the shared predicate exported from the boot unit | `apps/core-server/cli/set-password.ts` (new); `apps/core-server/src/db/commands/set-password.ts` (new); `capture/boot/index.ts` (edit: export the per-row predicate only); `package.json` script (edit) | section 3.11 | R-X2-1 to R-X2-11 | X-C, X2-1, X2-2; H2, H3 settled first |
| X-D | S | Documentation: installer runbook (the four-step sequence, the hand-over, what not to back up); README Known limits 25 and 34 rewritten, 30 if X1-4 landed, 37 kept apart; section 4's gaps stated | `README.md` (edit); a runbook under `docs/` (new) | a reader check against the built commands (each command line copied from `package.json`) | no example password anywhere, not even a synthetic one that looks usable | X1-1, X2-3 |
| X-G | S to M | Gate: on a throw-away database and a temporary data directory, checks 4, 4b, 4c pass through the real boot function; a started `REAL_PRODUCTION` Core if H6 holds, else the reason it cannot on this Mac | none (a gate report) | the report quotes the boot log lines | synthetic passwords only; no real device opened (U18) | all above; security acceptance |

**Later rows, named so they are not lost (not in this cut):** the console password-change operation (M); hiding the demo disclosure on the sign-in cards outside `SIMULATED` (S); `db:seed` / `db:reset` refusing or profiling a production environment (M); operator creation (M); wrap secret outside the signer directory (M).

## 9. What stays the user's decision

Each has a default so that work is not blocked. A default is used until the user says otherwise and is recorded in `decisions/decisions.md` when applied.

| Id | Decision | Recommended default | If decided otherwise |
|---|---|---|---|
| UD-1 | Key algorithm and size | Not open for a software key: the code fixes Ed25519 (A1) | - |
| UD-2 | Where the private key lives: a file on the host with owner-only mode, or a hardware token / TPM | The file, as built (option A) | option C: a hardware signer, class C-8, a task of its own on the production device |
| UD-3 | Self-signed certificate with out-of-band fingerprint, or a chain to an organisational CA | Self-signed, stated as a limit, with the hand-over record | option D; needs a CA that exists |
| UD-4 | Must the Core refuse a key whose certificate names another installation (check 4b-2) | Yes, built with rotation (X1-5 after X1-4) | leave it out: the certificate's identity stays descriptive |
| UD-5 | Rotation and the retained certificate set in this task | Yes, as X1-4, not gating the first boot | defer: Known limit 30 stays, and a compromised or expired key has no command |
| UD-6 | Password policy numbers | minimum 12, maximum 128, no composition rules, demo password and own username refused, no expiry | the numbers the user names; one module changes |
| UD-7 | Who types each password at the first boot | each operator types their own, present at the installation; the Supervisor first | the installer types all three and hands them over - then a forced change at first sign-in is wanted, which needs the console operation (G4) |
| UD-8 | The three demo persons as the production accounts (G1) | NOT acceptable for a real examination: decide before any production recording. For the real-device search and connection test now allowed (U18) they suffice | operator creation or renaming becomes a row |
| UD-9 | Certificate validity | 1,825 days, as the code (A9) | a parameter of the command |
| UD-10 | Backup of the signing key | none; certificates only (section 2.2) | a documented offline copy - a second forging capability to guard |
| UD-11 | Signer read-path hardening (S99-06) in this task | Yes (X1-3): it is the first time the store holds a production key | stays carried debt |

## 10. Acceptance criteria for the design's implementation

1. On a temporary data directory and a throw-away database, after the two commands and nothing else, the real boot function for `REAL_PRODUCTION` passes checks 4, 4b and 4c; with either command left out it refuses with the existing code.
2. `git diff` of `capture/boot/checks.ts` shows no change to the conditions of 4, 4b, 4c (an added check 4b-2 only, if UD-4 is yes); the existing tests of those checks pass unedited.
3. The secret sweeps of R-X1-2 and R-X2-4 pass.
4. No test, script, document or commit contains a real password; no agent typed one.
5. The README states the self-signed limit, the two-keys table, host access = full control of accounts, and the gaps of section 4.

## 11. No implementation plan file

`masterplan/02_plan.md` was not edited: the cut into rows is the task-architect's after the security review (P11 (3)). Section 8 is the input.

---
*Generated: 2026-10-13 08:53*
*Last Updated: 2026-10-13 08:53*
