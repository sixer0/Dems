# Integration pass I-6 - short record

Status: complete (one driver decision to confirm). Full record: `implementation/i06_integration_pass.md`. No commit. No scripted edit: Edit tool only; `openapi.json` by the generator, once.

| Item | Result |
|---|---|
| 1 search-path red | Wording, not a new place: the writer's local name is `staging`. `ALLOWED` not edited. Three text pins of G-R2 in `capture/__tests__/static.test.ts` follow the name (DRIVER DECISION, to confirm) |
| 2 routes.test red | The test's scope is right; the two routes of row 70 (operations 98, 99) added to its `OTHER_UNITS` |
| 3 mobile PENDING-SHARED | The three local names deleted; shared N7, N8, N12 in use; `precheckSentence` keeps the "no item" guard |
| 4 server seams | `slotColumn` removed (type only: six columns still nullable text at run time); `StoredSelectorSlots` and its cast removed. Compiles everywhere; `store.ts` needed nothing |
| 5 shared | `unassign` request example of operation 78; `openapi.json` regenerated (8 added lines); five sentences in the capture-fault wording table (two of row 48, three of row 182's members). No example pin moved |
| 6 reader callers | None exists in the product; rows 46, 50, 85 |
| 7 wording | Row 63's counts (33 / 32 / 99), row 94's mobile comment, row 47's comment on `profile` |

Checks: server unit 18 files `434 passed` of 435 at run 2, the last file `53 passed` at run 3; shared `7 files, 137 passed`; mobile `36 suites, 432 passed`; database `6 files, 73 passed` (fence 2 files and capture-notices 1 file among them, 0 databases left); web reference `3 files, 130 passed`; typecheck exit 0 in the five workspaces; lint exit 0.

Remaining: oxlint warning `apps/core-server/src/capture-session/index.ts:145` (unused import `CaptureWarningReason`) - row 182, in flight. No red test, no type error.

Requests left (three lines in `file_requests.md`): no client words `details.cause` of a refused start; nine files with stale operation counts outside row 63's list; the three sentences of row 182 are in, for its confirmation.

Not run: `db:generate` (the migration writer's command).
