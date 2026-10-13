---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 228
package: X1-5 (M11)
date: 2026-10-13
agent: coder-execution (K3, track D)
requirements: SX-10; UD-4 (working default, C42 / C44); caution C-4 of verification/221 (iii)
status: complete
tier: T3
---

# Row 228 - boot check 4b-2: the active certificate names this installation

## What was built

A `REAL_PRODUCTION` start is refused by the named code **`CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`**
unless the WHOLE organisational unit of the ACTIVE certificate equals
`Evidence signing <configured installation id>`. `REAL_DEVELOPMENT` and `SIMULATED` never ask.

| Part | Where | What |
|---|---|---|
| The decision | `apps/core-server/src/capture/boot/checks.ts` | added lines after 4b: asks `deps.signingKeyInstallationProblem()`; a word is a refusal by the one code, the word is the reason |
| The rule | `boot/index.ts` `signingKeyInstallationProblemOf(units, installationId)` | pure; exactly ONE unit, equal as a whole to prefix + one space + id |
| The parser | `boot/index.ts` `organisationalUnitsOf(pemText)` | walks the certificate's DER to the SUBJECT and returns the values of every attribute `2.5.4.11`; never a part of the subject text |
| The reader | `boot/index.ts` `storedSigningKeyReaders().organisationalUnits` | third reader over the SAME one load as checks 4 and 4b (row 211's `loadedOnce`): no second load |
| The id | `CaptureBootControl.provideInstallationId(id)` and the seam `CaptureBootMount.installationId` | the door; called once by `sealing-host/index.ts` with `installationIdentityOf(app.config).deviceId` |

Reasons (fixed words, no value in any of them): `INSTALLATION_ID_NOT_KNOWN`, `INSTALLATION_ID_FORM`,
`SUBJECT_UNREADABLE`, `NO_ORGANISATIONAL_UNIT`, `SEVERAL_ORGANISATIONAL_UNITS`, `OTHER_INSTALLATION`.

## Where "the configured installation id" comes from

`DEMS_INSTALLATION_DEVICE_ID` -> `config.installationDeviceId` (form `^[A-Z][A-Z0-9-]{0,31}$`,
`config.ts` `parseInstallationDeviceId`) -> THE one reader `installationIdentityOf`
(`sealing-host/installation-identity.ts`), the same value boot step `sealing.installation-identity`
refuses a production Core without (`INSTALLATION_IDENTITY_NOT_CONFIGURED`).

The capture unit cannot read it itself: the static rule of
`sealing-host/__tests__/installation-identity.test.ts` admits one reader of the setting, and
`test/static/imports.test.ts` closes `src/sealing-host` (no deep import; the sealing host imports the
capture unit, not the reverse). So the unit that holds the identity HANDS the id in, as the entry point
hands in the host facts (C46): one statement in `mountSealingHost`, after its one read.

Fail closed: no id handed in, or `null` (none configured) = `INSTALLATION_ID_NOT_KNOWN`. An id that is not of
the configuration's form is NEVER compared (`INSTALLATION_ID_FORM`), so an id with a comma, an equals sign or a
line break cannot match even a certificate that repeats it byte for byte.

## Parsed attribute, not a substring

`SigningCertificate.subject` is a joined text (`CN=...,OU=...,O=...`); a comma typed into the organisation
makes that text contain `OU=Evidence signing <id>` (tested: the text contains it, the parsed unit does not).
The check therefore reads the certificate's own bytes: SEQUENCE certificate -> to-be-signed -> (version),
serial, algorithm, issuer, validity, SUBJECT -> each SET -> each attribute. Strict: definite lengths of at
most four bytes, single-byte tags, no overrun; a unit must be a UTF8String or PrintableString of visible ASCII
(0x20-0x7E) - the command of row 206 writes nothing else. Anything else is `SUBJECT_UNREADABLE`.
The bytes are those of the certificate the loader verified (its own signature) and that 4 and 4b judged.

## Diff against the baseline (gateway_check/205; `checks.ts` blob `1697e4b9`)

`git diff -U0`: 5 hunks, 26 insertions, 0 deletions. No line of the baseline is changed or removed.

| Hunk | Place | Content |
|---|---|---|
| 1 | `@@ -29,0 +30,7` header comment | 7 comment lines: the description of 4b-2 |
| 2 | `@@ -83,0 +91,5` `CaptureBootRefusal` | the code `SIGNING_KEY_INSTALLATION_MISMATCH` with its comment |
| 3 | `@@ -112,0 +125,2` `TEXT` | the sentence of the code (names the form and the rotation command; no environment key) |
| 4 | `@@ -355,0 +370,7` `CaptureBootDeps` | the optional member `signingKeyInstallationProblem?: () => string \| null` |
| 5 | `@@ -444,0 +466,5` `runCaptureBootChecks` | the 5 lines of 4b-2, directly after the statement of 4b and before the comment of 4c |

Checks 4, 4b, 4c: no condition, statement or catch changed (the hunks are insertions only; the lines
`const signing = ...`, `if (signing !== null) ...`, the 4b `if`, and the 4c block are byte-identical).
`SELECT_STORED_HASH_SETS` in `boot/index.ts` untouched.

**NEW BASELINE**

| File | git blob | sha256 |
|---|---|---|
| `capture/boot/checks.ts` | `3dfea759bb85768f2ef812fe5919f201508839e5` | `55f010b6a71d8b79c374c90de816253871068fd4198d22f69ea1b39ad48add18` |
| `capture/boot/index.ts` | `473020879962284bb19129fc42b9dcd54d1c5bac` (before this row: `1d65bd79...`) | `4d41309c5e1bfd7e9f11f4f591f79aead310165205c3d8d2f50d7ca2fb782d9c` |

`boot/index.ts`, this row's edits (all additive except the two noted): import `certificateDer`;
`storedSigningKeyReaders` gains the member `organisationalUnits` (return type widened, body + 1 line);
new block (prefix, problem words, id form, rule, DER reader, `organisationalUnitsOf`,
`storedSigningKeyUnits`); `signingKeyQuestionsOf` gains a fourth parameter and the third question
(signature CHANGED - it is the function follow-up F-01 names; the two existing members are byte-identical);
`CaptureBootMount` gains `signingKeyUnits`, `installationId`; `CaptureBootControl` gains
`provideInstallationId`; `CaptureInstallationIdError`, `INSTALLATION_ID_NOT_TAKEN`; in the mount one `let`,
the door's body, and the call of `signingKeyQuestionsOf` gains its fourth argument (one line CHANGED).

## Tests (all keys made by the test)

New cases: 5 in `checks.test.ts` (the decision), 11 in `boot.test.ts` (rule, parser, mount, door), 1 in
`production-key-proof.db.test.ts` (through the real app).

- Stores: `provisionSigningKey` into `mkdtemp(<tmpdir>/dems-row228-*)`, removed in `afterAll` (verified: no
  `dems-row228*` left in the temporary folder, none under `.data/`). Not row 61's fixture.
- Certificates the store's writer cannot make (no unit, two units, a unit in a set of two, IA5): a key pair
  made in memory by `generateKeyPairSync`, a certificate signed by it with a small DER writer of the test,
  read back by the store's public reader `readSigningCertificate`. Nothing is written or printed.
- No key content under `.data/` was read.

| Verification cell | Proof |
|---|---|
| a matching certificate passes | `boot.test.ts`: real store, real mount, boots `REAL_PRODUCTION`; six database suites boot on matching keys |
| a key of another installation | refused `OTHER_INSTALLATION` (mount, and through the real app on the command's store) |
| a default-subject key (C-4) | refused `OTHER_INSTALLATION`; its parsed unit is `Evidence signing` |
| a key with no organisational unit (C-4) | refused `NO_ORGANISATIONAL_UNIT`, one load |
| an id that only contains the configured one | 8 units (suffix, prefix, shorter, spaces, case, bare id) and the reverse: all refused |
| crafted | unit text inside O; `<unit>,O=...`; `<unit>+OU=<unit>`; line break; non-ASCII digit; two units; multi-valued set; 8 crafted ids; non-certificates |
| development and Simulated never ask | decision (a reader that throws) and mount |
| lines of 4, 4b, 4c unchanged, their tests unedited | diff above; `one-load.test.ts` and every earlier case of `checks.test.ts` untouched and green |
| ONE loaded certificate | the counting loader: 4, 4b and 4b-2 = 1 load (reader level; the mount-level pin is row 215c's file) |

## Checks run

| Check | Result |
|---|---|
| `tsc --noEmit` (core-server) | exit 0 |
| `vitest --project unit src/capture/boot/__tests__` | 9 files, 219 passed (203 before the new cases) |
| unit: capture, capture-session, capture-config, devices, sealing-host, sealing, src/__tests__, test/static, test/cli | 2925 passed, 134 failed in 10 files, none of this row: 8 files `listen EPERM` (sandboxed run; they bind sockets), `capture-config/__tests__/static.test.ts` R-5 and factory-scan (rows in flight) |
| database (throw-away clones, `.locks/db-migrate.lock`): capture-composition, fence, capture-config, source-class, production-key-proof, operator-set-password, capture boot | 7 files, 123 passed; then production-key-proof again with the new case: 4 passed |
| static rule files (`capture/__tests__/static.test.ts`, `adapters/__tests__/static.test.ts`, `test/static/*`, installation-identity) | green for this row's files; `active-key-call-sites` green after the pin moved by delta |

## Suites swept

Booting `REAL_PRODUCTION` with a test key: `boot.test.ts`, `capture-composition.db.test.ts`,
`fence.db.test.ts`, `capture-config.db.test.ts`, `source-class.db.test.ts`,
`production-key-proof.db.test.ts`, `operator-set-password.db.test.ts` (7).

| Suite | Fix |
|---|---|
| `boot/__tests__/support.ts` (row 61's fixture, 27 importers) | `provisionKey(installationId = 'DEMS-TEST-01')` writes the unit of the test configuration's id: four database suites pass with NO edit of their own |
| `boot/__tests__/boot.test.ts` (mine) | six bare mounts gain the seam `...TEST_INSTALLATION` |
| `sealing/__tests__/production-key-proof.db.test.ts` (row 208) | the Core's configuration names the id the test types at the command (`DEMS-TEST-208`); one case added |
| `test/cli/operator-set-password.db.test.ts` | none needed: it types `DEMS-TEST-01` |
| `sealing/__tests__/active-key-call-sites.test.ts` (row 225; not a boot) | count pin 2 -> 3 by delta |

No bypass in `src/`.

## DRIVER DECISIONS (for the controller)

1. One statement and one import in `src/sealing-host/index.ts` (K2's area), made by this row: the only legal
   provider of the id. K2 has seen it (file_requests line 371).
2. `signingKeyInstallationProblem` is OPTIONAL in `CaptureBootDeps` (absent = not asked), as `host` /
   `programs` were: required, it breaks `one-load.test.ts`, which this row may not edit and which must pass
   unedited. The MOUNT always hands it in and has no passing default.
3. Row 61's fixture names the test installation by default (above), instead of an edit in each suite.
4. A unit that is not UTF8String / PrintableString of visible ASCII is refused rather than decoded.
5. The form of the id is a copy of the configuration's rule in `boot/index.ts` (the capture unit imports no
   configuration code); a test holds the two together.

## Not proven here / remainder

- A production start on Linux with a real key (hardware package; unchanged by this row).
- The README text for the new refusal and the rotation as the way out of a rename (rows 217 / 218).
- `INSTALLATION_IDENTITY_NOT_CONFIGURED`: step `capture.boot` runs before `sealing.installation-identity`, so
  a production Core with a loadable key and NO configured id is now refused by 4b-2
  (`INSTALLATION_ID_NOT_KNOWN`) first. Both refuse; which code an installer sees first changed.
- The 320 fixture folders under `.data/` remain (the user's word); their keys are now refused in code.

Edit tool only on every existing file; new files with Write; nothing committed.
