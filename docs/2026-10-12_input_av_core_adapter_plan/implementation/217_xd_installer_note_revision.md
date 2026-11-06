---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 217
package: M11 | X-D
date: 2026-10-13
agent: document-writer role (wave 10, agent D1)
tier: T1
requirements: SX-07 (runbook half), SX-08 (runbook half), SX-20 (runbook half), SX-01 (its text)
status: complete
---

# Row 217 - revision of the installer note for a first production boot

## 1. Subject, reader, scope

| | |
|---|---|
| Subject | `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`, written by row 135 before ruling U19. Its two stated limits (no production key command, no password tool) are replaced by the sequence that uses the two built commands |
| Reader of the note | the installer who brings a Core into production operation on the Ubuntu 24.04 host |
| Stakeholders | the user (owner of the installation, rulings U19 and U20); the operators (they type their own passwords); whoever will verify packages (receives the fingerprint); the X-1 / X-2 security acceptance (row 221) |
| When | 2026-10-13, after rows 206, 210, 211, 213 and 215 landed (decisions C54, C64) |
| Scope | one document file. No source, no script, no other chapter, `apps/core-server/package.json` read only |
| Not done | nothing was run on a host; neither command was started by this agent |

## 2. What was changed, section by section

| Section of the note (line today) | Change |
|---|---|
| Status head (`:3`) | the sentence "adds no procedure of its own" replaced: the note now carries two command lines, copied from `package.json`, and the file wins where they differ |
| Revision 2 paragraph (`:5`), new | says what the revision is and that neither command has been run on a host |
| "Stated first" (`:7`) | "NOT reachable" replaced by: the boot this gives is for a BENCH TEST on the seeded database (U20) |
| Ringkasan, Indonesian (`:9-22`) | the two "belum disediakan" items rewritten to the two commands, who types, the fingerprint rule, the limits, no backup of `signer`; item (d) of the short order |
| Section 1 (`:24`) | three cells: scope, performers (the installer; the operator for a password), secrets (no example password, not even an invented one) |
| Section 2 (`:34`), rewritten | title and table: X-2 and X-1 each with its command and its performer; sources; the no-workaround sentence |
| 2.1 (`:49`), new | the four-step sequence with performer, command line and result per step; the argument table; exit statuses; one mark "to confirm" |
| 2.2 (`:72`), new | who types each password: each operator their own, the Supervisor first; the skip; the policy as built; what ends and what the audit entry says; reseed |
| 2.3 (`:82`), new | SX-01 text: the "Core stopped" test sees connections, not a process; 503 and reload; the hypothesis; the installer's rule |
| 2.4 (`:93`), new | the attended check of the prompt (H5), four steps, performer USER |
| 2.5 (`:104`), new | no terminal recorder, no remote session, no screen share while a password is typed |
| 2.6 (`:114`), new | SX-07 runbook half: what an incomplete key store is; `KEY_EXISTS` and its three lines; removing it is the installer's own act |
| 2.7 (`:126`), new | SX-08 runbook half: the fingerprint only after the first successful production boot, by another channel than the packages, the list of receivers kept |
| 2.8 (`:136`), new | what not to back up; the credential store kept apart as the user's decision |
| 2.9 (`:148`), new | the limits of U20; the two SX-20 statements (host account, checks are necessary conditions); lists A and B by reference to the frame |
| 2.10 (`:164`), new | the residual of C54 (4): parents of the data directory, checked at provisioning, not at each load |
| Section 4, step 7 (`:182` table) | rewritten to the two commands with performers and a measurable result; step 8 gets the sentence on the fingerprint |
| Section 5, last paragraph | "a started REAL_PRODUCTION Core has not been seen" replaced by what row 208 showed on the Mac and that no host start exists |
| Section 6, second bullet | rewritten to six "to confirm" lines, each naming its check |

Sections 3, 4 (other steps), 5 (table) and the notes on the order are unchanged.

## 3. The command lines, and their source

Source: `apps/core-server/package.json`, read on 2026-10-13: line 23 `"evidence:production-key": "tsx cli/production-key.ts"`, line 25 `"operator:set-password": "tsx cli/operator-set.ts"`. The arguments are those of the records `implementation/206_x1_production_key_command.md` (section 3) and `implementation/215_x2_set_password_command.md` (section "The command line").

| Line as written in the note | Script entry | Arguments from |
|---|---|---|
| `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <data-dir> --all-demo` | `operator:set-password` | record 215 |
| `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <data-dir> --username <username>` | `operator:set-password` | record 215 |
| `npm run evidence:production-key -w @dems/core-server -- --data-dir <data-dir>` | `evidence:production-key` | record 206 |

Difference between a record and `package.json`: none on the script names. One difference of wording only: the records write the placeholder `<absolute directory>`; the note writes `<data-dir>`, the placeholder of the host profile, and says that it is an absolute path. The design (`masterplan/05_design_x1_x2.md`, section 12 table) named the entry files `cli/set-password.ts` and `src/provisioning/production-key.ts`; the built entries are `cli/operator-set.ts` and `cli/production-key.ts` (decisions C54 (1), C64): `package.json` wins, and the note names neither file.

The database scripts (`db:create`, `db:migrate`, `db:seed`, `db:status`, `db:reset`) and `evidence:dev-key` are named by script name only, as before; each is an entry of the same file.

## 4. Why each statement is in the note (evidence chain)

| Statement | Source |
|---|---|
| Supervisor first | `cli/operator-set-password-command.ts:160` (the order of the operator read); record 215, "The walk: Supervisor first"; U20 (1) |
| typed twice, nothing shown, empty first entry skips | record 215, the synthetic walk and driver decision 4; record 213 |
| the policy refusals | `packages/shared/src/api/password-policy.ts:59-70` (the refusal texts) |
| sessions end, biometric tokens revoked, one audit entry | record 215, "per operator ONE transaction" |
| connections, not a process; 503 and reload | `cli/operator-set-password-command.ts:288-293` (`STOPPED_LIMIT`); review F2-1; `test/214`, section 7 (the hypothesis) |
| attended check H5 | record 213, "Not proven here"; design 3.11; C53 (1) |
| recorder, remote session, screen share | review F2-4 item 5 |
| `KEY_EXISTS`, present / absent / store loads; never completes | `cli/production-key-command.ts:378-396`; review F1-3; record 210, section 3 (three exclusive creates, not atomic) |
| six limit sentences, fingerprint after the first production start, another channel, list of receivers | `cli/production-key-command.ts:169-176` (`SELF_SIGNED_LIMITS`); review F1-5, SX-08 |
| do not back up the signer directory | `cli/production-key-command.ts:490`; design 2.2 and 2.3; credential store: README Known limit 37, U20 (6) |
| bench test only | U20 (5), (6); C42, C44; review section 6 |
| host account is full control; checks are necessary conditions | review 4.2 (the quoted paragraph), section 5; SX-20 |
| parents of the data directory | C54 (4); record 206, step 3; record 210, DD-3 |
| what was shown without a host | `test/208_x1_boot_and_seal_proof.md`, sections 1 and 6 |

## 5. Verification, against the row's cell

| Cell | Check | Result |
|---|---|---|
| every command line equals the script entry (differences 0) | `grep -o -h -E '`npm run [^`]*`'` over the note, compared with `grep '"(evidence:production-key\|operator:set-password)"' apps/core-server/package.json` | 3 lines, 2 script names, both entries of the file: differences 0. No other command line (`npx`, `node --`, `sudo -u`) in the note: count 0 |
| every step names who performs it; agent steps 0 | reading: the four steps of 2.1, the four of 2.4, the three of 2.7 and step 7 of section 4 each name USER (or the operator for a password) | agent steps 0; the only line with the word "agent" is the Performers cell, which says 0 |
| no example password, not even a synthetic one | reading; the note describes rules and never a value | 0 |
| the count-only scan counts 0 | `node scripts/secret-scan/count-only.mjs scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` | `scanned 2 file(s)`, every needle 0, `TOTAL: 0 in 0 file(s)`, exit 0 |

No test and no typecheck apply: no source was touched.

## 6. Marks "to confirm" left, each with its check

| # | What only a host can show | Check |
|---|---|---|
| 1 | the two lines start as written for a person acting as `<service-user>` (an account without a login shell, `HOST-04`) | `PREP-09` step 5, `PREP-10` step 1 |
| 2 | the hidden prompt on a real terminal on Ubuntu 24.04; the word `SET` then the hidden prompt on one terminal | attended check H5 (note 2.4), then the first prompt of `PREP-09` step 5 |
| 3 | the key store on the host's file system; the path of `HOST-06` passing the directory rule | `PREP-10` step 1 |
| 4 | a production start with the user's key and operators | `9A/H-16` |
| 5 | a session sealed with that key, verified against the printed fingerprint | `9A/H-17` |
| 6 | an idle Core always holds a connection | none; kept as a hypothesis, the installer's rule does not depend on it |

## 7. Alternatives considered

- Repeating lists A and B of the review in the note: not done, they stand in full in the frame, section 11 item 8; one copy to keep right.
- Renumbering the path of section 4 into the four steps: not done; the path has twelve steps that other documents cite by number. The four-step sequence is 2.1 and points into the path.

## 8. DRIVER DECISIONS (for the controller to confirm)

1. **The attended check has no command line in the note.** Its start line (record 213, the header of `cli/secret-prompt.ts`) is not a script entry of `package.json`, and the brief says every command line is copied from that file. The note names the file and where its start line is written. If the controller wants the line in the note, either a script entry is added (a row with `package.json` in its area) or the rule is relaxed for this one line.
2. **X-2 is started as `<service-user>`.** Record 215 does not say which account; it follows from the connection file the command reads (owner-only, in the data directory) and from the review's sentence on the host account. The command does not refuse root as the key command does; the note still says `<service-user>`.
3. The placeholder `<data-dir>` instead of the records' `<absolute directory>` (section 3).

## 9. Found wrong in the note and NOT changed (outside the cell)

| Where | What | Why it is wrong |
|---|---|---|
| Section 4, steps 7a and 9, and the first note on the order (also Ringkasan item (f)) | the helper is installed AFTER the first production boot, only its group before; "whether a production Core without an installed helper refuses to start ... is open" | decision C49 (1) and the frame, Revision 2: `HI-01` to `HI-07` come before `9A/H-16`; a production Core on Linux refuses to start without the helper |
| Section 6, last bullet | the argument form of `db:migrate` and `db:seed` "is to be confirmed" | the frame's open point 9 says it is settled |
| Section 2.10 relies on the host profile | the host profile (`HOST-06`) does not yet state the requirement on the parents of the data directory that C54 (4) routes to it | not this row's file |

## 10. Edit-only statement

The note and `delegation_progress/file_claims.md` were changed with the Edit tool only, each edit after reading the passage. No scripted or anchored replacement, no shell write into either file. New files (this record, `delegation_progress/row_217.md`) with Write.

---
*Generated: 2026-10-13*
