# coder-execution, row 97 (M9 hygiene)

Status: **needs-review**. Date 2026-10-11. Base `951c80e`, working tree, nothing committed.

Note: `implementation/162_row97_hygiene.md`.

Done: M9-PIN-1 literal grep 37 -> 0 (34 stale lines corrected, 3 dated-history lines reworded);
five wave-named support files renamed with their importers; 12 unused names and 3 unused i18n keys
of this task removed; 2 `TODO` notes resolved; skip reasons in five describe titles; the web player
test reads the shared 409 example; R96-1 notes are generator text with a test; two load-sensitive
tests commented; one mobile lint warning fixed; task README index rewritten; repository checks and
data candidates listed.

Put back: the removal of two unused builders in `apps/core-server/src/db/seed/seed.ts` (a security
static test reads the file as text; the removal turned it red).

Proof (one run each): typecheck and lint x 7 exit 0; shared 2614 / 0; core-server unit 6700 / 0
(second run; the first was 1 failed, see above); db 2423 passed, 7 skipped, 0 failed; core-web
2224 / 0; mobile 2915 / 0; transcriber 564 passed, 3 skipped.

Files created: `implementation/162_row97_hygiene.md`, this file,
`packages/shared/scripts/demo-readme-notes.ts`, and the five renamed support files
(`real-fragment-tables.ts`, `real-init-segments.ts`, `real-item-bed.ts`,
`speech-fixture-pipeline-child.ts`, `sealed-fixture-pipeline-child.ts`).

Not written: `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`.

Open for the controller: section 9 of the note (13 items).

## Second pass (the row's own list), 2026-10-11

Status: **needs-review**. Note: `implementation/163_row97_blueprint_list.md` (item table with
citations in its section 1).

Done: W93-18 (one hand-off mark), RC-2, RC-3 (defect fix, failing first), RC-5, RC-6, RC-7 (runbook
note), F3 (sheet exit on the runner clock), F4 (23 per-file timeouts removed after re-timing);
AU1-1 / -2 / -5 / -6 and row-26 F1..F4 re-checked, no residual; note 162 items (1) SEC35-41 (c)
guard on the live writer + dead seed exports removed, (3) `.gitignore`, (4) history lines + M9-PIN-1
erratum, (8) PENDING comment, (9) rule A-7.

Not done (each needs a decision, a device or a build; note section 6): W93-10, W93-19, W93-26,
W93-27, B15 empty frame, RC-4, the RC-7 link, F2, 58 per-test ceilings, separate commits.

Proof (one run each): typecheck and lint x 7 exit 0; shared 2614 / 0; core-server unit 6702 / 0;
core-web 2224 / 0; mobile 273 suites, 2917 / 0; db 2423 passed, 7 skipped, 0 failed.

Files created: `implementation/163_row97_blueprint_list.md`, `apps/mobile/src/lib/handoff-mark.ts`,
`apps/mobile/src/lib/handoff-mark.test.ts`.
