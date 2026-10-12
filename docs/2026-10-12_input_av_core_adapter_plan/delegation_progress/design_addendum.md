# Delegation progress: design addendum

| Item | Value |
|---|---|
| Agent | data-analyst |
| Date | 2026-10-12 |
| Status | needs-review (security review is the next step by C13) |
| Created | `masterplan/04_design_addendum.md`; this file |
| Edited | none (no source file, no other plan document) |
| Run | read-only inspection only; nothing built, started or migrated |
| Not opened | `apps/input-av/data/`, any `.env`; the Graft graph (it refreshes itself, which writes outside the task folder) |

## Decisions taken in the addendum

| # | Item | Chosen |
|---|---|---|
| 1 | P12-B1 | The fence and the boot checks are unchanged. The selector learns an unassigned slot (six columns nullable in set A; an `unassign` member on operation 78). A production Core with unassigned slots boots and refuses a session start. 21 states enumerated |
| 2 | P12-B2 | A credential reader as constructor dependency of the production camera adapter; reveal and audit entry in one unit; injection inside `openSource`; no signature change; `pullUrl` untouched (it has no caller); start message on standard input; the relay is the one holder of a URL with a user part |
| 3 | F03 | Cameras opened in parallel, each bounded; production ingest window 30 s (hypothesis); a camera absent at start stays lost for the session |
| 4 | F05 | Five mismatches decided (one found in this pass: the opener is not told the profile). Microphone registration = two new operations, permission `CAPTURE_CONFIG`, audit `CAPTURE_AUDIO_INPUT_CHANGED` |
| 5 | F10/F11 | The relay gates on a keyframe after every re-open. E-11 selects branch A (Core only), B (worker compares the path, WP-11b) or C (the worker pulls, cost stated) |
| 6 | F01/F02 | Adapters in new files, tested at adapter level before the lift; first full session in WP-13c; WP-13 is M, split a/b/c |
| 7 | F08 | The profile code of a production stream is the stream's statement, minted by the stream test; the sealed notice rule is not edited |
| 8 | Splits | WP-03, 06, 07, 19, 22 split into S and M parts; WP-13, 10, 23, 26 as well; single-writer files listed per file set |
| 9 | Requirements | 61 identifiers, each with a package and a check |

## Blockers

None.

## For the controller

- Security review of section 1 (and of 2, 5) before the blueprint adopts the addendum (C13).
- Three readings were taken as controller-level and are reversible: `unassign` as an optional member of operation 78 (AS-A3); the nullability change inside set A, not a fourth set (AS-A2); microphone registration under `CAPTURE_CONFIG` (4.2).
- A decision row is due before WP-19b closes: root service against `sudo` (S13-09).
- Items for the user are in section 10 of the addendum.
- Facts not verified in this pass are listed in section 12; each is the first step of a named package.
