---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 219
package: M11 | X-D
date: 2026-10-13
agent: document-writer role (wave 10, agent D1)
tier: T1
requirements: U19, U20; SX-01 (its text), SX-07, SX-08 (the frame's half)
status: complete (one item of the Verification cell cannot be met inside the frame: section 6)
---

# Row 219 - the frame of the hardware procedure: the X-1 and X-2 passages

## 1. Subject, reader, scope

| | |
|---|---|
| Subject | `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, the passages on X-1 and X-2. Row 181 (the consistency pass) had already replaced "no command of the repository" by "two commands are being built" and left two marks "to confirm" that waited for rows 206, 215 and this row (`implementation/181_hw_procedure_consistency.md:60`, `:125`, `:132`) |
| Reader | the user and the persons who run the acceptance day |
| When | 2026-10-13, after rows 181, 206 and 215 (decisions C49, C54, C64) |
| Scope | the named passages of ONE file. Chapters 2, 3 and 4, every script and every source: not touched |
| Not done | nothing was run on a host |

## 2. The comparison row 181 left for this row

| Passage | The line row 181 wrote (from the design) | The built line (`apps/core-server/package.json`, records 206 and 215) | Difference |
|---|---|---|---|
| `PREP-09` step 5 | `npm run operator:set-password -w @dems/core-server -- --database dems_demo --data-dir <data-dir> --all-demo` | script `operator:set-password` (line 25 of the file); arguments `--database <name> --data-dir <absolute directory> --all-demo` | 0 |
| `PREP-10` step 1 | `npm run evidence:production-key -w @dems/core-server -- --data-dir <data-dir>` | script `evidence:production-key` (line 23); argument `--data-dir <absolute directory>` | 0 |

Both lines stand as they were; what changed is the text around them. Row 181's note (`:125`) that the design names the owner role and the review the runtime role: built with the runtime role through the Core's own connection file (record 215, SX-03); the frame never named a role and needs no change for it.

What the built commands print differs from the design's wording in two places, corrected in the steps: the validity lines are `valid from (UTC)` and `valid until (UTC)`, not "not-before, not-after"; the password command asks for the word `SET` before the first prompt.

## 3. Passages changed (line numbers of today)

| Passage | Line | Change |
|---|---|---|
| Revision 3 paragraph, new | `:15` | says what this revision is, which passages it changed, that order and pass criteria are unchanged, that neither command has been run on a host |
| Ringkasan, one new sentence "Revisi 3" | `:25` | the two commands are built; who types; not yet run on a host |
| Section 4, lines X-1 and X-2 | `:117`, `:118` | "the command the development is building" -> "the command built"; performer per command; the fingerprint after `9A/H-16`; each operator their own password, the Supervisor first |
| `PREP-09` step 1 | `:275` | the operators ready, the Supervisor first; the attended check of the prompt once on the host, with its expected result, by reference to the installer note 2.4 |
| `PREP-09` step 5 | `:279` | the mark that waited for rows 215 / 219 replaced by the built form and a mark that names what the host shows; the summary and the word `SET`; connections, not a process; each operator types their own; no recorder, remote session or screen share; `DATABASE_IN_USE` |
| `PREP-09` step 6 | `:280` | one sentence: a skipped operator, exit status 1 |
| `PREP-10` step 1 | `:283` | the mark that waited for rows 206 / 219 replaced likewise; `KEY_EXISTS` with present, absent and "store loads"; removal of an incomplete store is `USER`'s act; the printed lines as built; the fingerprint after `9A/H-16`, by another channel, list of receivers; no backup of the signer directory |
| `PREP-10` step 3 | `:285` | "the commands have not landed" -> "a command does not start on the host"; the refusal's code is recorded |
| Section 11 item 8, first two sentences | `:483` | "once X-1 and X-2 have landed" -> "now that X-1 and X-2 are built"; names both commands and U20. Lists A and B unchanged |
| Section 12, line "A production boot and session", second cell | `:526` | "are being built" -> what was shown on the Mac (rows 208, 215) and that no person typed at a real terminal |
| Section 13, open point 1 | `:536` | settled for the commands; open: a host run and the attended check; settled-by cell names the checks |

Not changed although they mention X-1 / X-2: the bullet of Revision 2 (`:11`, "two commands are being built ... once they land") and its count of marks (`:13`), and the Indonesian sentence of Revisi 2 (`:21`). They are the record of what Revision 2 said; the Revision 3 paragraph directly below says how to read them. If the controller prefers them rewritten, it is three small edits.

## 4. Verification, against the row's cell

| Cell | Check | Result |
|---|---|---|
| passages that still say no command exists: 0 | `grep -n -i -E 'no command\|not in the tree\|have not landed'` over the frame | `no command`: 3 lines, none says that X-1 or X-2 has none (`:11` "are no longer no command", `:483` "the first issue said ... Revised", `:551` the removal of a throw-away database, another subject); `not in the tree`: 0; `have not landed`: 0 |
| the built commands | `grep -o -E '`npm run (operator\|evidence:production)[^`]*`'` against `package.json` | 2 lines, 2 entries, differences 0 |
| `9A/H-16` names both commands with the performer of each step and 0 agent steps | the frame's preparation of `9A/H-16`: section 4 lines X-1, X-2 ("Done before `9A/H-16`"), `PREP-09` step 5, `PREP-10` step 1, section 11 item 8, open point 1 | each names its command and `USER` (and the operators for the passwords); agent steps 0. **The check `9A/H-16` itself is written in chapter 2 and is outside this row's file: see section 6** |
| order and pass criterion of every other check unchanged | by construction: no line of section 6 (the order table), of section 9 or of chapters 2 to 4 was edited | holds for this row's edits. `git diff` cannot show it alone: the file already carried the uncommitted edits of row 181 (`git diff --stat`: 160 lines for both rows together) |
| count-only scan | `node scripts/secret-scan/count-only.mjs` on the two files | `TOTAL: 0 in 0 file(s)`, exit 0 |

## 5. Marks "to confirm" in the passages of this row

| Where | What | Check that settles it |
|---|---|---|
| `PREP-09` step 5 | the line starts as written for a person acting as `<service-user>`, an account without a login shell | that step, on the host |
| `PREP-10` step 1 | the same for the key command; the path of `HOST-06` passes the command's directory rule (no directory above the data directory writable by a group or others) | that step, on the host |
| Open point 1 | no person has typed at the hidden prompt on a real terminal | the attended check, `PREP-09` step 1 |

The file's other marks (`PREP-06` step 1, section 9.5) are row 181's and unchanged.

## 6. Found wrong and NOT changed (outside the cell)

| Where | What |
|---|---|
| Chapter 2, `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md:263` (`9A/H-16`, precondition) | says "X-2 and X-1 provided with their two commands" and names neither command. The Verification cell asks that `9A/H-16` names both; that sentence is in a chapter this row may not edit. One sentence there would close it: the two script names and "`USER`; each operator their own password" |
| Chapter 2, `:281-282`, `:307` | refer to `PREP-10` and `PREP-09` step 5 for the refusal codes: still correct |
| Frame, performer table (`:82`) | `USER` does "everything with a key or an operator password". With U20 (1) each operator types their own password; the steps say so, the table's cell was left as it is (not an X-1 / X-2 passage) |
| Collector suites | decision C49 (5): suites that hash the chapter folder are part of the next full run; this row changed one file of that folder and ran no suite |

## 7. DRIVER DECISIONS (for the controller to confirm)

1. A new "Revision 3" paragraph instead of rewriting the bullets of Revision 2 (section 3, last paragraph).
2. The attended check is written by reference to the installer note, without a command line: its start line is not a script entry of `package.json` (see record 217, decision 1).
3. The first sentences of section 11 item 8 were edited although the first claim line did not name them; declared in the closing line of `file_claims.md`.

## 8. Edit-only statement

The frame was changed with the Edit tool only: eleven edits, each on one passage, each after reading it. No scripted or anchored replacement and no shell write. New files (this record, `delegation_progress/row_219.md`) with Write.

---
*Generated: 2026-10-13*
