---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 218 [M11|X-D] [SX-20, SX-08]
date: 2026-10-14
agent: coder-execution (agent C2, wave 12)
tier: 1
status: complete (document; nothing run on a host)
---

# Row 218 - root README, the passages on the signing key and the operator passwords

This is the Expected Output path of row 218. The row was executed by agent C2 of wave 12 together with the controller's wider document list; the full record (subject, method, every change with its source, the command and name checks, alternatives, assumptions, what was found wrong and left) is `implementation/c2_readme_and_installer_note.md`. This file holds row 218's own verification cell, item by item.

## Verification: "each named statement is present with its source line; list A 9 of 9 and list B 8 of 8; no sentence says or implies 'fit to record' or 'certified', and no example password appears"

All places are in `README.md`, section "Real capture, sealing and transcript". Block = the block **Task 4: production key, operator passwords, real cameras, commissioning**.

| Statement of the cell | Where in the README | Source |
|---|---|---|
| Known limit 25 rewritten to the built command | Known limits, row 25 | `apps/core-server/package.json` script `evidence:production-key`; decisions U19, U20, C54 |
| Known limit 34 rewritten to the built command | Known limits, row 34 (new head paragraph and new end) | script `operator:set-password`; decisions C64, C66, C71 |
| Known limit 30 by the state of row 226 (rotation IS built) | Known limits, row 30 | scripts `evidence:rotate-key`, `evidence:mark-compromised`; decisions C69, C77, C84, C91, U21 (3) |
| Known limit 37 kept apart, with the two-keys table | Known limits, row 37 (one sentence added) and row 47; block, table "Two keys, opposite risks" | row 218's cell; installer note section 2.8 |
| The host account of the Core's user is full control of every operator account, of the audit log and of the signing key | block, the four statements, second bullet; Known limit 47 | `verification/07_security_x1_x2.md`, SX-20; installer note section 2.9 |
| Checks 4, 4b, 4c are necessary conditions and not proof of correct provisioning | block, first bullet (with 4b-2 and 4b-3, built since); Known limit 50 | SX-20; `apps/core-server/src/capture/boot/checks.ts:29-47` |
| The certificate is self-signed with typed names, the signer's own clock and no revocation channel | block, third bullet; Known limits 25 and 47 | SX-20, SX-08; installer note section 2.7 |
| List "before a real examination" | block, table A, rows A1 to A9: 9 of 9 | `verification/07_security_x1_x2.md:211-223` |
| List "acceptable for a bench test" | block, table B, rows B1 to B8: 8 of 8 | `verification/07_security_x1_x2.md:225-236` |
| Gaps G1 to G6 of the design | block, paragraph "What a production Core that starts still lacks": 6 of 6 | `masterplan/05_design_x1_x2.md:435-440` |

Two states are added in square brackets to the lists, each from a later decision row and each marked as "in code, on this Mac": A4 (rotation is built; the review of rotation as built made the statement, conditional on the full suite and its commit - C84) and B4 (the two commands are built since the list was written - C69).

Negative checks, on the lines this row added to `README.md` and to the installer note (`git diff -U0`, added lines only):

| Check | Result |
|---|---|
| the words "fit to record" or "certified" | 0 lines |
| an example password | none; the published demo password is referred to as "the published demo password" / "the demo password" only |
| a statement that a host or a real recording proved something | none; the block's "Read this first" says the opposite |

The command lines and the 107 code and member names of the added text were checked against `apps/core-server/package.json` and by search in the product: sections 4 and 5 of `implementation/c2_readme_and_installer_note.md`.

Edit tool only for the two existing documents; no scripted replacement.

---
*Generated: 2026-10-14*
