# Row C2 (wave 12) - row 218 and the controller's document list

Status: complete. Documents only; nothing run on a host, no product command, test or build run.

Files changed (Edit tool only, no scripted replacement):
- `README.md` - corrected: the paragraph "The signing key", the installation identity table (reserved ids), the receiver's command (`--compromised`, exit status 3, line numbers); NEW block "Task 4: production key, operator passwords, real cameras, commissioning" before Known limits; Known limits 7, 25, 30, 34 rewritten, 37 one sentence added, 46 to 58 added.
- `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` - Revision 3: sections 2.11 (transcriber), 2.12 (installation id), 2.13 (rotation and the mark) new; 2.1, 2.3, 2.9, section 4 (steps 3, 6, 7a, 8, 9 and the first note), section 6 and the Ringkasan corrected.

Files created:
- `implementation/c2_readme_and_installer_note.md` (Tier 1 record)
- `implementation/218_xd_readme_x1_x2.md` (row 218's Expected Output: its verification cell item by item)
- this file

Checks:
- command lines against `apps/core-server/package.json`: `operator:set-password`, `evidence:production-key`, `evidence:rotate-key`, `evidence:mark-compromised`, `evidence:verify-export`, `db:migrate`, `db:seed` - each script entry present once;
- 107 back-quoted names of the added text searched in the product: all found; five names of my own guessing were not found and were not written (record section 5);
- "fit to record" / "certified" in the added lines: 0; no example password; lists A 9 of 9, B 8 of 8, gaps 6 of 6.

Requirement identifiers: SX-20, SX-08 (the README halves; C71 C-11); R-9 of review 230 (README and installer text for rotation); C66 (3) (transcriber in the installer note); C101 (helper not released, stated).

Requests left in `file_requests.md`: none.

Driver decisions (for the controller to confirm): one dated block in the README's "additions and corrections" pattern; the three configuration keys as a new table of that block; installer note 2.11's console remedy marked "to confirm on the host"; the README states the product's answer `COMMISSIONING_NOT_CONFIGURED` where decision C70 still words `CANDIDATE_NOT_TESTABLE`.

Not written, by the brief: the macOS production microphone (row N16).

Found wrong and left (outside the list): README line 441 and the body's refusal row for check 4c (state of `713d83f`), the totals under **Tests**, the Ringkasan at the top; `apps/core-server/src/config.ts:29` gives the reserved id `DEMS-IR-01` as an example (product source).
