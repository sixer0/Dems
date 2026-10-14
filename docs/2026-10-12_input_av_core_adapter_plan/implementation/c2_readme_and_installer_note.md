---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 218 (and the controller's document list of wave 12, agent C2)
date: 2026-10-14
agent: coder-execution (agent C2, wave 12, track D)
tier: 1
status: complete (documents only; nothing run on a host)
---

# C2 - the root README and the installer note after X-1 / X-2, rotation, platforms, real cameras and commissioning

## 1. Subject, reader, scope

| | |
|---|---|
| Subject | Two documents: `README.md` (root) and `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` |
| Readers | README: whoever runs, reviews or continues the product. Installer note: the installer of a production Core on Ubuntu 24.04 |
| Stakeholders | The user (owner of the open decisions U20 (5), (6), U21); the controller; the security reviewers of rows 221, 230, 119, 119b (their statements are the content); row N16 (writes the macOS microphone part later) |
| Timeline | Written 2026-10-14 on the tree at checkpoint commit `1fbeada7` |
| In scope | Row 218 as its cells say, and the list the controller collected in `delegation_progress/file_ownership.md` from "Update 2026-10-13 - rows 217, 219 (D1) landed" to the end, with decisions U20, U21, C54, C60, C63, C64, C66, C69, C70, C71, C73, C77, C79, C81, C84, C86, C91, C94 (j), C97, C99, C100, C101, C103, C105, C108, C111 |
| Out of scope | The macOS production microphone (U25, row N16); `scripts/hardware-acceptance/**` and the host profile (agent C1); every product source file |

## 2. Method

1. Read `driver_rules.md`, `batch_9_brief.md`, `wave_12_brief.md`; row 218's two cells; the ownership log from line 583 to its end; the decision rows above in full; `verification/07_security_x1_x2.md` section 6; the gaps table of `masterplan/05_design_x1_x2.md`; the request lines of rows 209, 226, 191c, V5 (two) and P1 in `delegation_progress/file_requests.md`.
2. Read both documents before the first edit (README lines 392-810 in full; the installer note in full).
3. Every command line taken from the script entries of `apps/core-server/package.json` and the header of the command file it starts; every code and member name searched in the product before it was written (section 5).
4. Edits with the Edit tool only, each after reading the place; no scripted replacement, no shell append. The two record files and this file are new files (Write).

No command of the product, no test, no build and no host was run. The only commands run were read-only searches (`grep`, `sed -n`, `wc`, `git diff`, `git log`).

## 3. What was changed

### 3.1 README.md (170 lines added or changed)

| Place | Change | Source |
|---|---|---|
| "Capture operation", paragraph **The signing key** | The sentences "no command provisions a production signing key" and "cannot be brought up today" corrected in place, with a pointer to the new block | rows 206, 215; U19, U20 |
| "Fix waves H and I", installation identity table | The example `DEMS-JKT-07` is now marked as reserved, with the other two ids | C86 |
| "Fix waves H and I", export / receiver's check | The command line gains the repeatable `--trust` and `--compromised`; line numbers of the two `package.json` files corrected (62, 26); exit status 3 | `apps/core-server/src/evidence-export/receiver-cli.ts:1-41`; C91 |
| NEW block **Task 4: production key, operator passwords, real cameras, commissioning**, before Known limits | Thirteen passages, listed in 3.2 | see 3.2 |
| Known limits, head sentence | Says what the fourth task rewrote and added | - |
| Known limit 7 | Rewritten with the request line of row 191c, word for word, plus the verify notice and the video twin | `file_requests.md:402`; C73, C108; I-9b item 11 |
| Known limit 25 | Rewritten to the built command and what the key is | rows 206; C54 |
| Known limit 30 | Rewritten: rotation is built; what remains | C69, C77, C84, C91, U21 (3) |
| Known limit 34 | A new head paragraph with the built command, and a state paragraph at its end; the 2026-10-11 text between them kept for its sources and marked as such | C64, C66, C71; gaps G1-G4 |
| Known limit 37 | One sentence added: it is about the session keys only; the signing key is limit 47 | row 218's cell ("kept apart with the two-keys table") |
| Known limits 46 to 58 | Thirteen new rows | 3.3 |

### 3.2 The passages of the new block

| Passage | The brief's item | Sources |
|---|---|---|
| Read this first | - | U26; ownership log :1077; C108 |
| The two commands of a first production boot | (1) | `package.json` scripts `operator:set-password`, `evidence:production-key`; C54, C64 |
| What a production boot checks (4, 4b, 4b-2, 4b-3, 4c) | (1) | header of `capture/boot/checks.ts:29-47`; C79, C81, C86 |
| Four statements (necessary conditions; host account; self-signed; bench boot, no escrow, no hardware store) | (1); row 218 | security review section 6, SX-20; U20 (5), (6) |
| Two keys, opposite risks | row 218 (limit 37) | installer note section 2.8; Known limit 37 |
| The review's two lists, A1-A9 and B1-B8 | row 218 | `verification/07_security_x1_x2.md:211-236`; A4's state from C84; B4's from C69 |
| Gaps G1 to G6 | row 218 | `masterplan/05_design_x1_x2.md:435-440` |
| Rotation and the compromise mark | (2) | `cli/rotate-key-command.ts:1-48`, `cli/mark-compromised-command.ts:1-42`; C69, C77, C81, C84, C91; `file_requests.md:335, :424, :425` |
| What the signing members of `SYSTEM_BOOT` mean | (3) | `file_requests.md:323` (verbatim) and `:425` |
| Platforms of a production Core | (4) | U21 (2), C66 (1), C97; `checks.ts:194-195` |
| Real cameras | (5) | C60, C70; `packages/shared/src/i18n/en/common.ts:928-940`; `connect/service.ts:52-61`; `capture-discovery.ts:14` |
| New facts of the evidence | (6) | C73, C99, C108; `manifest.ts:937-940`; `evidence-verify/types.ts:417-421` |
| Commissioning | (7) | C94 (j), C101, C102, C105; `capture-commissioning.ts:9-15, :291-295`; `checks.ts:76-86` |
| Configuration keys of production capture | (7) | `config.ts:32-41, :72-75`; `host-checks.ts:135-136` |

### 3.3 Known limits added

| # | Limit | Source |
|---|---|---|
| 46 | A production boot is a bench boot on the seeded database; no operation creates operators | U20 (5) |
| 47 | The signing key: software key, no hardware store, no escrow; the host account's full control; self-signed, no revocation | U20 (6); SX-20 |
| 48 | The firewall rule's table is not read by the Core | C103 |
| 49 | "Core stopped" is known from connections only | C71 (C-8) |
| 50 | Boot checks are necessary conditions; the directories above the data directory are not re-asked at load | C54 (4), C71 (C-5) |
| 51 | Two same-model sound cards without serials on one socket | C56 |
| 52 | A dual-lens camera as one device on both tracks is refused | C93 |
| 53 | The count of devices on a factory address is not built | C94 (a), C105 |
| 54 | A receiver learns of a compromise mark only out of band | C84 (R-2), C91 |
| 55 | The relay's parameter sets must come back byte-identical after a re-open | record 043, driver decision 5; `relay.c:503` |
| 56 | The ONVIF reply caps were fitted to the fake camera's answers | C100 |
| 57 | A Mac is not held to the host profile; the helper is Linux only and not released | U21 (2), C97, C94 (j), C101 |
| 58 | No session with a production camera recorded; the video-absence member shown with test-supplied relay reports | C108 |

### 3.4 scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md (Revision 3; 79 lines added or changed)

| Place | Change | Source |
|---|---|---|
| Head | Paragraph "Revision 3" | - |
| Ringkasan | Step (f) says the helper is optional; one paragraph for the id rule, the restart after a rotation, retired keys kept, the transcriber | as below |
| 2.1, step 3 | The typed id follows 2.12; a reserved id is refused at once | K6 (ownership log :800) |
| 2.3 | The three key commands see no Core at all; the Core-held lock is not built | `cli/rotate-key-command.ts:28-30`; C71 (C-8) |
| 2.9 | The line "one key id, no rotation" corrected; the "necessary conditions" sentence names the installation binding | C69, C79 |
| NEW 2.11 | The transcriber configuration a production boot needs | C66 (3); `test/220_m11_bench_boot_session.md:35` |
| NEW 2.12 | The installation device id: binding, reserved ids, typed at the prompt, a renamed installation | C54 (2), C79, C81, C86 |
| NEW 2.13 | Rotation and the mark: the two lines, restart, retired keys kept, the next start's entry, the order after a compromise | C69, C77, C81, C84, C91, U21 (3); `file_requests.md:335, :424, :425` |
| 4, step 3 | The argument form of the four database commands | `apps/core-server/package.json:16-20`; `src/db/commands/migrate.ts:5` |
| 4, steps 6, 7a, 8, 9 | Transcription off in the first boot; 7a and 9 only where the helper is wanted; the refusal codes of step 8 | C94 (j), C101, C102 |
| 4, notes on the order | The first note rewritten: optional, all or none, not released | `checks.ts:80-86`; C94 (j), C101, C102 |
| 6 | The `db:migrate` line is no longer "unconfirmed form"; four new "to confirm" lines | - |

Section 2.10 (the directories above the data directory) was already written by row 217 and is unchanged.

## 4. The command lines, checked against `apps/core-server/package.json`

| Line as written | Script entry | Arguments from |
|---|---|---|
| `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <dir> (--username <u> \| --all-demo)` | `operator:set-password` -> `tsx cli/operator-set.ts` | decision C64; installer note 2.1 (row 217) |
| `npm run evidence:production-key -w @dems/core-server -- --data-dir <dir>` | `evidence:production-key` -> `tsx cli/production-key.ts` | installer note 2.1 (row 217) |
| `npm run evidence:rotate-key -w @dems/core-server -- --data-dir <absolute directory>` | `evidence:rotate-key` -> `tsx cli/rotate-key.ts` | `cli/rotate-key-command.ts:2`, `:151` |
| `npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <absolute directory> --key-id <key id>` | `evidence:mark-compromised` -> `tsx cli/mark-compromised.ts` | `cli/mark-compromised-command.ts:2`, `:91` |
| `npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>] [--trust <certificate sha256>]... [--compromised <certificate sha256>]...` | root `package.json:62` -> `evidence:verify-export` -> `tsx cli/verify-export.ts` | `src/evidence-export/receiver-cli.ts:4`, `:25` |
| `npm run db:migrate -w @dems/core-server -- --database <name>` (and `db:seed`) | `db:migrate` -> `tsx src/db/commands/migrate.ts`; `db:seed` -> `tsx src/db/seed/cli.ts` | the two files' headers |

In the installer note the placeholder is `<data-dir>` (the note's own word since row 135) where the README says `<dir>` or `<absolute directory>`.

## 5. The code and member names

107 back-quoted names of the two diffs were each searched in `apps/core-server/src`, `apps/core-server/cli`, `packages/shared/src`, `apps/capture-worker/src` and `scripts/host/netalias` (test folders excluded): all found.

Names I looked for and did NOT find in the product, and therefore did not write: `CAPTURE_LOOPBACK_RULE_UNIT_NOT_ACTIVE`, `NO_SOURCE_PROFILE`, `PARAMETER_SETS`, `CAPTURE_PRODUCTION_SOURCE_IN_DEVELOPMENT`, `SOURCE_CLASS` (all five were my own guesses at a name, none comes from a decision row). The names of the decision rows were all found.

One correction made while checking: decision C70 words a missing network configuration as `409 CANDIDATE_NOT_TESTABLE`; the product (after row R2) answers `409` with reason `COMMISSIONING_NOT_CONFIGURED` and keeps `CANDIDATE_NOT_TESTABLE` for the other refusals of the rule (`connect/service.ts:52-61`). The README states the product.

## 6. What is NOT claimed

- No sentence says that a host, a real camera or a real recording proved something. The block's "Read this first" says that everything rests on tests on the development Mac with doubles, that the full suite did not run on `1fbeada7`, and that no session with a production camera was recorded.
- No sentence says or implies "fit to record" or "certified" (searched: 0 hits in the added lines). No example password appears.
- List A is printed 9 of 9 and list B 8 of 8, in the review's words, shortened only in the "why" column of list A, which the README does not carry.

## 7. Alternatives considered

| Alternative | Why not taken |
|---|---|
| Rewrite the body of "Real capture" (state block, refusal table) to the tree of task 4 | The README's own rule is that its body describes a named commit and later blocks correct it; a rewrite would exceed row 218's cell ("the passages on the signing key and the operator passwords only") |
| Replace Known limit 34 whole | Its 2026-10-11 text carries file-and-line sources of the earlier review; kept between a new head and a new end, and marked as not read again |
| Put the new refusals into the table "What refuses to start" | That table describes commit `713d83f`; the block carries its own table, as the block of waves H and I did |

## 8. Assumptions, gaps, driver decisions

- DRIVER DECISION: the passages were written as ONE dated block in the README's existing pattern ("Fix waves ...: additions and corrections") plus in-place corrections, not scattered over the body.
- DRIVER DECISION: a README has no table named "configuration keys"; the three keys are a new table at the end of the block (`DEMS_CAPTURE_GUARD` is named in the row of `DEMS_CAPTURE_RELAY`, because `config.ts` defines the two together).
- DRIVER DECISION: installer note 2.11 gives "switch transcription off in the `SIMULATED` first boot" as a remedy and marks it "to confirm on the host", because the bench session changed the stored configuration by a database statement and never through the console.
- ASSUMPTION: the reserved-id sentence of the key commands (`INSTALLATION_ID_RESERVED`) is as the ownership log :800 states it; the name was found in three product files, the sentence was not re-read.
- GAP: the hash of the helper file is not printed in the installer note; it points to the hardware chapter, which decision C101 (C-3) says still printed the old hash - agent C1's file.

## 9. Found wrong and NOT changed (outside this row's list)

| Where | What | Why not changed |
|---|---|---|
| `README.md`, "State at commit `713d83f`", row "Not proven" (line 441) | "A `REAL_PRODUCTION` Core cannot operate in this tree at all ... no command provisions a production signing key" | It describes that commit; the new block and the corrected paragraph of "The signing key" say the present state |
| `README.md`, "What refuses to start", row `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` | "Built in batch N, uncommitted at the time of writing"; line numbers `checks.ts:410-416`, `index.ts:183` are stale | The body of the third task; not in the list |
| `README.md`, "Fix waves H and I", bullet on `INSTALLATION_IDENTITY_NOT_CONFIGURED` | On a production boot check 4b-2 now refuses first | Stated in the new block's table; the bullet itself left as the third task wrote it |
| `README.md`, Ringkasan and "What this is" at the top | No word of the fourth task | Not in the list |
| `README.md` **Tests** and the totals (97 operations, 67 audit types, schema 6) | The tree is at 110 operations, 83 audit types, schema 13 | Not in the list; the full suite has not run (U26) |
| `apps/core-server/src/config.ts:29` (product comment) | Gives `DEMS-IR-01` as an example of an installation id; that id is reserved | Product source, not mine |
| `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`, section 2.6 | "A complete store ... holds three files of the key id `CORE-KEY-EVSIGN-01`" does not mention the pointer `ACTIVE` or a second key id after a rotation | Left as row 217 wrote it; section 2.13 states both |

## 10. Requests

None written to `file_requests.md`. For the controller: the README does not state the macOS production microphone (row N16); Known limit 57 and the block's head say only that it is not described.

---
*Generated: 2026-10-14*
