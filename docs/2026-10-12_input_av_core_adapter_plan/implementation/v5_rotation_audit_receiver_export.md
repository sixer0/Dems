---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: v5_rotation_audit_receiver_export
date: 2026-10-13
agent: coder-execution (agent V5, track D)
source: decisions/decisions.md C84 (with C69, C77, C81, C83); verification/230_x1_rotation_as_built_security.md (cautions R-1, R-2, R-3; answers (a), (b), (c))
status: complete (three items landed; driver decisions in section 8 for the controller to confirm)
tier: 1
---

# Row V5 - the audit chain, the receiver and the export after a rotation or a compromise mark

Abbreviations: `SH` = `packages/shared`, `CS` = `apps/core-server`.

## 1. What this step is

Review 230 closed item A4 "in code on the Core" and left three MEDIUM cautions that a compromise
needs OUTSIDE the signer: the audit chain does not know of a rotation or a mark (R-1), a receiver
cannot learn of a mark (R-2), and evidence sealed before a compromise cannot be exported (R-3).
Decision C84 made them one contract-and-code step. They were built in that order, each verified
before the next was started.

- Stakeholders: the user (list "before a real examination"), the installer (runs the key commands
  and hands fingerprints to receivers), a receiver or examiner (verifies an export with no Core),
  the reader of the audit, rows 139 (code review) and the document row.
- Counts after: **110 operations (39 GET / 71 POST), 82 audit types, 51 actions** - unchanged.
  Schema `[12, 'dbc-13']` - no schema change was needed, so no item was stopped.
- `SH/openapi/openapi.json` was regenerated ONCE, at the very end, by the repository's generator
  (`node --import tsx scripts/gen-openapi.ts` in `SH`).
- The rule of all three, held: NOTHING changes what an existing sealed package or an existing
  export verifies as. Every new member is optional and absent before (section 5).

## 2. R-1 - the audit chain knows of a rotation and of a mark

### 2.1 The design choice: members of `SYSTEM_BOOT`, no new audit type

The two commands stay database-free (ruled). The NEXT BOOT says what changed. Chosen: **four
optional members on the boot's existing `SYSTEM_BOOT` entry**, under its open details rule - not the
new types `SIGNING_KEY_ROTATED` / `SIGNING_KEY_MARKED_COMPROMISED`.

Why (the alternatives weighed):

| Alternative | Why not |
|---|---|
| Two new audit types, one entry per event | 82 -> 84 types moves every count pin and every `at(-n)` position pin of the vocabulary for no fact the boot entry cannot carry. And the entries would still need a memory of what earlier boots stated - which is the boot entry itself |
| State members only, no comparison (the literal words of review 230 (a)) | a reader would have to compare two rows by hand to see that a key was marked; the brief asks that the boot records what changed |
| A full list of fingerprints in the entry | a detail value is a string of at most 500 characters and a payload has at most 16 keys (`core/limits.ts`): 99 fingerprints do not fit. So the entry states a COUNT, the marked keys by their two-digit PLACE in the series, and ONE digest over the whole retained set |

### 2.2 What the next boot records - the members, verbatim

On the `SYSTEM_BOOT` entry of a real boot (`REAL_PRODUCTION`, `REAL_DEVELOPMENT`), beside
`captureOperation`, `signingKeyId`, `signingCertificateSha256`:

| Member | Value |
|---|---|
| `signingKeysRetained` | how many certificates the retained set holds (0 to 99) |
| `signingKeysCompromised` | the places `01`..`99` of the retained keys that carry the mark, comma-joined, ascending; the empty text = none |
| `signingCertificatesSha256` | SHA-256 over one line `<key id> <certificate SHA-256>` per retained certificate, in series order |
| `signingStoreChange` | `NO_EARLIER_STATEMENT`, `NONE`, `NOT_READ`, or one or more of `KEY_ROTATED`, `KEY_MARKED_COMPROMISED`, `KEY_MARK_REMOVED`, `RETAINED_SET_CHANGED`, comma-joined in this order |

- The comparison is against **the previous boot entry of the same database** - one read inside the
  unit of the boot entry (`READ_PREVIOUS_BOOT_STATEMENT`, no bind value; an entry of the fence is
  one that carries `captureOperation`).
- `KEY_ROTATED`: both entries state an active key and its id or its certificate differs.
  `KEY_MARKED_COMPROMISED`: a key is marked now that the earlier entry did not state as marked; an
  earlier entry that states no list (written before this step, or with an unreadable store) counts
  as stating none, so a mark is named at least once. `KEY_MARK_REMOVED`: stated as marked before,
  not marked now. `RETAINED_SET_CHANGED`: both state the digest and it differs.
- An entry that names a change is severity **WARNING**; otherwise INFO as before.
- The three state members are null together when the store cannot be read (`NOT_READ`).
- Public facts only: the retained-set reader of the signer (public certificates, the presence of a
  mark file). No key, no wrap secret is opened. The read never changes a boot.
- LIMIT, stated in the code and in the request line: like the two key members, the entry states
  what LAY IN THE STORE when the fence step passed - before checks 4, 4b, 4c judged a key. A boot
  refused a moment later leaves the entry. (The other half of R-1's sentence, "`SYSTEM_BOOT` names a
  key before check 4 judged it", is NOT changed by this row: `capture/boot/*` is not mine.)
- A mark is in the chain only after the next start. If the marked key is the active one the start
  is refused by check 4 - and the entry is written all the same (test, section 6).

### 2.3 A verification that passes only by the compromised-key rule is audited as such

- `VerdictRecord.notice` (`CS/src/evidence-verify/index.ts`): present - `SIGNED_BY_COMPROMISED_KEY` -
  exactly when the run's `signingKey` is not `NOT_COMPROMISED`.
- The shared transition `recordEvidenceVerificationTransition` (`SH/src/sim/session-machine.ts`),
  input member `notice` (optional): with the one code, a PASS is recorded with
  `details.notice: SIGNED_BY_COMPROMISED_KEY`, severity **WARNING**, the message "Evidence <id>
  verified as the digest recorded at the seal: its signing key is marked compromised", the custody
  text "Signing key marked compromised: verified as the digest recorded at the seal", and a WARNING
  event. A FAILURE under the mark carries `details.notice` too. Any other value, or none: the row of
  before, member for member (tested with four values).
- No file of `sealing-host` was edited: its recorder spreads the verdict into the engine's door.

### 2.4 Files

| File | Change |
|---|---|
| `CS/src/core/audit-details.ts` | `SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES`, `SYSTEM_BOOT_SIGNING_STORE_CHANGES`, `SYSTEM_BOOT_SIGNING_KEYS_MAX`; four members added to the open rule of `SYSTEM_BOOT` (each of its form or null) |
| `CS/src/capture/fence/boot-key.ts` | `storedBootSigningStore`, `bootSigningStoreChangeOf`, `READ_PREVIOUS_BOOT_STATEMENT`, `systemBootSeverityOf`, `BootSigningStoreChange`, `SYSTEM_BOOT_SIGNING_STORE_MEMBERS`; `systemBootDetailsOf` takes an optional third argument (without it: the two members, as before) |
| `CS/src/capture/fence/index.ts` | the ONE boot append: the read, the details, the severity; one import line, one export line |
| `CS/src/evidence-verify/index.ts` | `VerdictRecord.notice`; the hand-over in `run` |
| `SH/src/sim/session-machine.ts` | `EvidenceVerdictInput.notice`, `EVIDENCE_VERDICT_COMPROMISED_KEY_NOTICE`, `EVIDENCE_VERDICT_COMPROMISED_KEY_CUSTODY`, the transition |
| `SH/src/api/security-audit.ts`, `SH/src/api/evidence.ts` | `SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE`; one sentence in the description of operation 41 |

`fence/boot.ts`, `fence/operation.ts`: empty diff. `capture/boot/checks.ts`: blob `694846fa`, not edited.

## 3. R-2 - a receiver can learn of a mark

### 3.1 The input

- Shared verifier: `VerifyExpectations.compromisedCertificateSha256?: readonly string[]`
  (`SH/src/evidence-verify/types.ts`) - the marked fingerprints (SHA-256 of the DER of the public
  certificate, the form of the hand-over record), supplied out of band.
- The receiver's command: `npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>]
  [--trust <certificate sha256>]... [--compromised <certificate sha256>]...`.

### 3.2 The receiver's verdict - the words

The design is silent (its "a notice, not a failure" is marked HYPOTHESIS and speaks of the Core's
verify). So the brief's default was built, in its own words:

> **`RESULT: NOT A PASS - signature valid, key reported compromised by the list supplied`** - a
> state of its own, exit status **3**.

- In the shared verifier, with the input: the seal's certificate listed -> V-13 fails
  `CERTIFICATE_KEY_COMPROMISED`; a revision's certificate listed -> V-11 fails
  `REVISION_CERTIFICATE_KEY_COMPROMISED`; the notice `SIGNED_BY_COMPROMISED_KEY` with the line
  `COMPROMISED_KEY_NO_RECORD`; `signature.compromisedKey` = `COMPROMISED` | `NOT_MARKED` |
  `NOT_ESTABLISHED`. A listed certificate is not relied on even when it is also trusted: the mark
  wins. This is NOT the Core's verdict word for word, and cannot be: the Core passes such a package
  as the digest its database stored; a receiver has no such record. The Core does not use the input.
- The state is shown only when NOTHING ELSE failed. A tampered export under a listed certificate is
  `RESULT: FAIL`, exit 1: the mark never hides a tamper finding.
- A receiver who also took the fingerprint out of his `--trust` list gets `RESULT: FAIL` (the export
  certificate is not trusted) with the mark named on the X-05 line.
- The export signature's own certificate in the list: X-02 `EXPORT_CERTIFICATE_KEY_COMPROMISED`.

### 3.3 Without the input: byte for byte the behaviour of before

Proven two ways. (1) Every existing verifier and export test ran UNEDITED and passed before a new
case was added to those files: Core `src/evidence-export src/evidence-verify src/sealing
src/sealing-host src/capture/signer test/static` 68 files / 957 tests; shared verifier files 5 / 228.
(2) New cases compare the results: without the input the result has no `compromisedKey` member and
no new notice; with a list that names nothing, the result minus that one member EQUALS the result
without the list (`toEqual`, shared and Core); the receiver's result has its eight members and no
`keyMark`; the parsed command has its three members.

### 3.4 Files

`SH/src/evidence-verify/types.ts`, `verify.ts`; `CS/src/evidence-export/receiver-verify.ts`
(`ReceiverVerifyInput.compromisedCertificateSha256`, `ReceiverVerifyResult.keyMark`),
`receiver-cli.ts` (`--compromised`, `receiverVerdictOf`, `RECEIVER_EXIT.KEY_REPORTED_COMPROMISED`,
the two verdict lines); `CS/cli/verify-export.ts` (header text only: the option and exit status 3).
`CS/test/static/cli.test.ts` was NOT edited: no import and no process member of the cli file changed.

## 4. R-3 - earlier evidence under a marked key is exportable with the notice

### 4.1 What changed

- `exportPackage` verifies its source by **the Core's own function**,
  `verifySealedPackageUnderCoreTrust` (`CS/src/evidence-verify/index.ts`) - the two runs and the rule
  "under a compromised key" of row 227, moved out of operation 41's run unchanged and called by both.
  Operation 41 and an export cannot disagree on a package.
- `ExportPorts.compromisedCertificateSha256?` (optional). `provideCoreEvidenceExport` hands a job
  both lists of ONE read of the store (`exportVerifyTrust`, `CoreExportWiring.verifyTrust`) and the
  head of the transcript revisions the database holds (`revisionHeadSha256`).
- Source under a marked key AND the stored digest and revision head match -> **the export
  proceeds**. Source under a marked key and not the one of record -> the job still fails, by name:
  **`SOURCE_SIGNED_BY_COMPROMISED_KEY`** (kept: the non-matching case needs a name; an operator who
  reads `SOURCE_VERIFY_FAILED` is not told that a mark is the cause). A job that is handed no marked
  list fails `SOURCE_VERIFY_FAILED` as before.

### 4.2 What an export under a marked key carries

In the export manifest - which is signed by the ACTIVE key, never the marked one - the one optional
top-level member:

```
"sourceSigningKey": { "state": "MARKED_COMPROMISED", "certificateSha256": ["<fingerprint>", ...], "verifiedAs": "STORED_DIGEST" }
```

- `certificateSha256`: the marked certificates the package rests on (the seal's, a revision's),
  ascending, each once. The time of the statement is `export.exportedAt`.
- The trust material of the archive, unchanged in form: the marked certificate itself travels as the
  seal's own `device-certificate.pem` (or a retained `certificates/<sha256>.pem`), the export
  signer's as `certificates/<sha256>.pem`. PUBLIC certificates only; asserted (section 6).
- Nothing sealed is rewritten; no manifest is signed again (asserted by tree hashes).

### 4.3 What a receiver sees

- With NO marks list: every check passes and the result is
  **`RESULT: PASS - UNDER A SIGNING KEY MARKED COMPROMISED: verified by the exporting Core against
  the digest it recorded at the seal, as this export states`** (exit 0), with a line naming the
  marked fingerprint. Never the plain `RESULT: PASS`.
- With the list AND `--trust`: the export's statement covers the listed fingerprint - the same
  named pass. WITHOUT `--trust` the statement covers nothing (the holder of the marked key could
  have made the export and its certificate himself): "not a pass", exit 3. DRIVER DECISION D-4.
- A statement about a certificate that is not in the archive: X-01
  `EXPORT_SOURCE_KEY_STATEMENT_UNFOUNDED`. A statement removed from the manifest: X-02
  `EXPORT_SIGNATURE_NOT_OF_MANIFEST`.

### 4.4 Files

`CS/src/evidence-export/export-manifest.ts` (the optional member, two constants),
`package-export.ts` (step 2, the member, the failure code, the port), `host.ts` (`exportVerifyTrust`,
`verifyTrust`, the revision head, the header), `CS/src/evidence-verify/index.ts`
(`verifySealedPackageUnderCoreTrust`, `markedCertificatesOfPackage`; the notice constants are now the
shared ones by reference), `SH/src/api/evidence.ts` (the code named in the description of
`failureReason`).

## 5. Nothing existing verifies differently

| Thing | Why it is unchanged |
|---|---|
| A sealed package at the Core (operation 41) | the Core hands the shared verifier no marked list; the moved function is the same statements; unedited suites pass |
| A sealed package at a receiver without `--compromised` | no finding, notice or member is added without the input (compared by `toEqual`) |
| An existing export | its manifest has no `sourceSigningKey` key; the member is `.optional()` on the strict schema, so the canonical bytes and the digest are those of before; the receiver's result has no `keyMark` |
| A new export of a package no mark touches | no member; BYTE FOR BYTE the archive of a job without the marked list (same archive hash and manifest digest, tested while another key of the store is marked) |

Stated and NOT fixed (as V4 D-5): a receiver's verifier that predates this step refuses an export
manifest that CARRIES the member (strict schema) - a failure, never a plain pass. Request line.

## 6. Checks (2026-10-13)

| Check | Command | Result |
|---|---|---|
| R-1 unit and static | `npx vitest run --project unit --maxWorkers=2` on `fence.test.ts`, `writers.test.ts`, `src/evidence-verify`, the capture / core / adapters static files, `test/static`, `db/fixtures/__tests__/audit-details.test.ts` | first run: `Test Files 33 passed (33)`, `Tests 769 passed (769)` |
| R-1 shared | `npx vitest run --maxWorkers=2 test/sim-core-driven-seal.test.ts` | `Tests 34 passed (34)` |
| R-1 database, throw-away clones, `.locks/db-migrate.lock`, sandbox off | `fence.db.test.ts`, `engine/__tests__/seal-actions.db.test.ts` | `Test Files 2 passed (2)`, `Tests 57 passed (57)`, `0 remain` |
| R-2 existing tests UNEDITED | Core `src/evidence-export src/evidence-verify src/sealing src/sealing-host src/capture/signer test/static`; shared verifier files | `68 passed`, `957 passed`; `5 passed`, `228 passed` |
| R-2 / R-3 new cases | `export.test.ts`, `receiver-cli.test.ts`, `verify-v2.test.ts` | run 1: 4 failed in my own new cases (one product finding: the source-mark line under a listed key, fixed in `receiver-verify.ts`; one test's count of a text); run 2: `Tests 44 passed (44)` for the two export files; `verify-v2` passed in run 1 |
| R-3 database | `export-trust-list.db.test.ts`, `export-e2e.db.test.ts`, `export-restart.db.test.ts` | `Test Files 3 passed (3)`, `Tests 4 passed (4)`, `0 remain` |
| Shared suite, after the one regeneration | `npx vitest run --maxWorkers=2` in `SH` | `Test Files 105 passed (105)`, `Tests 2881 passed (2881)` (before it: 2 failed, the two "committed openapi.json byte for byte" cases, as expected) |
| Core unit, closing | the units above + `src/core src/modules/evidence` | `Test Files 90 passed (90)`, `Tests 1720 passed (1720)` |
| Core database, closing: the acceptance pair, fence, the three export files, seal actions, production-key proof | 8 files | `Test Files 8 passed (8)`, `Tests 148 passed (148)`, `0 remain` |
| Typecheck | `npx tsc --noEmit` in `SH`, `CS`, `apps/core-web`, `apps/mobile`, `apps/mock-core`, `apps/transcriber` | exit 0, six of six |
| The row-229 driver, ONE run | `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && node --import tsx ../../.cache/task4-row229/rotation-session.mts'` | `DIFFERENCES FROM THE DESIGN: 0`; `RESULT: every expectation of the session held (46 held, 1 recorded as observations, 0 difference(s) from the design)`; exit 0 |
| Left behind | `.data/test-row61-*`; `dems-rowv5*`, `dems-row229*`, `dems-verify-export*` in the temporary folder | 322 (unchanged); 0 |
| Secret scan of the three folders | `node scripts/secret-scan/count-only.mjs` on fence, evidence-export, evidence-verify | `TOTAL: 5 in 2 file(s)` - the counts of before this row (row 209's finding 4), none added |

The driver's own boots show the entries on a production Core: boot 1 `NO_EARLIER_STATEMENT`; the
restart after the rotation `KEY_ROTATED,RETAINED_SET_CHANGED`; the boot after the mark
`KEY_MARKED_COMPROMISED` with `signingKeysCompromised: "01"`; later boots `NONE`.

RED SEEN, NOT MINE: `CS/src/engine/__tests__/boot-checks-runner.test.ts:81` - the core index exports
`SYSTEM_BOOT_SIGNING_DETAIL_RULES` since 13:14 (another row; `core/index.ts` not touched by V5) and
the test's list of names matching /boot/i is short by it. Request line.

Not run: any full suite; `seal-e2e`, the kill matrix, the row-220 bench driver; web and mobile test
suites (no client file changed; both typecheck).

## 7. Expectations of existing tests that these items changed (each by Edit)

| File | Expectation | Why |
|---|---|---|
| `CS/src/capture/fence/__tests__/fence.db.test.ts` | `bootRowOf` and the two literal boot rows: + the four store members; second boots state `NONE` | R-1 |
| `CS/src/capture/fence/__tests__/fence.test.ts` | the source pin of row 209: the helper's imports (3 -> 4 lines), the text of the one append | R-1 |
| `CS/src/core/__tests__/writers.test.ts` | named members of the open rule of `SYSTEM_BOOT`: 2 -> 6 | R-1 |
| `CS/src/evidence-export/__tests__/export-trust-list.db.test.ts` | the export of the marked key's item: `FAILED SOURCE_VERIFY_FAILED` -> `COMPLETE` with the statement; the case title and two header lines | R-3, the item's subject |
| `.cache/task4-row229/rotation-session.mts` | step 4e: `A: FAILED, SOURCE_VERIFY_FAILED` -> `A: COMPLETE` with `sourceSigningKey`; B has none | R-3 |
| `SH/test/evidence-verify.test.ts` | one comment of V4's case ("not ruled yet") | R-2 |

Count pins of operations, audit types and actions: **0 moved** (the counts did not change).

New cases extend existing files: `fence.test.ts` (+2), `fence.db.test.ts` (+1), `writers.test.ts`
(lines in one case), `retained-certificates.test.ts` (lines in one case), `verify-v2.test.ts`
(+1 block of 3), `export.test.ts` (+1 block of 4), `receiver-cli.test.ts` (+1 block of 3),
`SH/test/sim-core-driven-seal.test.ts` (+1), `SH/test/evidence-verify.test.ts` (+1).

## 8. Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative way |
|---|---|---|
| D-1 | R-1 is members of `SYSTEM_BOOT`, not new audit types | section 2.1; counts stay 82 |
| D-2 | A removed mark has its own code (`KEY_MARK_REMOVED`) | review 230 (a) names "a mark that disappeared"; the mark file is a 0644 file the Core's user can remove |
| D-3 | The receiver's state is shown only when nothing else failed; exit status 3 for it | a mark must never hide a tamper finding; review 230 (c) 2 asks "its own exit status" |
| D-4 | The export's statement covers a listed fingerprint only in an ANCHORED run | without `--trust` the export signature is held to a certificate inside the archive, which the holder of a marked key can make |
| D-5 | `SOURCE_SIGNED_BY_COMPROMISED_KEY` is kept for the non-matching case | section 4.1 |
| D-6 | Files of row 91 edited: `export-manifest.ts`, `package-export.ts`, `receiver-verify.ts`, `receiver-cli.ts` | the brief names `host.ts` and `cli/verify-export.ts`; the manifest schema, the job and the receiver's command live in those four. Declared in the claims line before the first edit; no row in flight claimed them |
| D-7 | The verdict under a marked key is recorded by the SHARED transition (`session-machine.ts`), not by a second writer in the Core | one writer of the verification row; the engine's door is unchanged |
| D-8 | A pass under the mark is a WARNING row; the boot entry that names a change is WARNING | neither type has a fixed severity (V4 D-2) |
| D-9 | The tests of this row open no key file: the absence of a private key is asserted by the PEM armour and the PKCS#8 head of an unencrypted Ed25519 key, and by the exact member lists | the secrets rule's letter ("never read key content"); the existing cases of row 227b that read their own test store's key files were not edited |
| D-10 | `COMPROMISED_KEY_NOTICE_CODE` / `_REPORT` of the Core are the shared constants by reference | V4's request line (a); one wording |

## 9. Doubles, and what stays unproven

- Packages are the row-85 builder's (real Ed25519, real AES-256-GCM); the rotation and the mark are
  the store functions and, in the driver, the functions of the two commands. The receiver is the
  product's, on archives unpacked by the system's `unzip`.
- The boot entries were proven on PostgreSQL in `REAL_DEVELOPMENT` (the fence case) and in
  `REAL_PRODUCTION` with the explicit test host (the driver).
- Every key was generated by a test into a directory of the OS temporary folder that the test
  removes; none under `.data/`; installation ids are synthetic non-reserved ones (`DEMS-TEST-ROWV5`,
  the fixture's default). No real key, device or host. macOS only.
- Unproven: the entries on a real installation after a real rotation (hardware package 9A, with the
  first production start); a receiver on another machine with a list received by a real channel.
- Not built, by design of the brief: the procedure text (request line); a public notice record
  written by `evidence:mark-compromised` into `handover/` (review 230 (c) 3) - the cli key command
  files are agent K6's.

## 10. Request lines written (`delegation_progress/file_requests.md`, each beginning `row V5`)

1. The document row: the receiver's procedure (who sends the list, by which channel, the verdicts
   verbatim, anchors, re-export after a mark, the old verifier).
2. The document row: the audit trail after a rotation or a mark, for the README and the installer note.
3. The controller: the red of `boot-checks-runner.test.ts:81`; the double statement of forms in `boot-key.ts`.
4. The client rows and the next contract step: the notice on the audit row; whether the job answer names the statement.
5. Row 139: R-11 stands for operation 41; the one function; the four files of row 91.

Edit-only rule: every existing file was changed with the Edit tool, after reading it, by small
additive edits. No scripted replace, no shell append, no rewrite. The one generated file is
`openapi.json` (the repository's generator, once). New with Write: this record and `row_v5.md`.

---
*Generated: 2026-10-13 16:05*
