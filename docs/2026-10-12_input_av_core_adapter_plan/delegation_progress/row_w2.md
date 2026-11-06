# Agent W2 - rows 113, 118 and the clean-up after row V4 (single writer of apps/core-web, 2026-10-13)

Status: **complete**. No dev server was started; ports 5173 / 5178 / 4423 were not touched. NO BROWSER CHECK WAS MADE (the scripted browser session is part of the gate). Nothing was committed or staged.

| Item | Status | Record |
|---|---|---|
| (1) Row 113, the set-IP screens | complete | `implementation/113_set_ip_web.md`, `delegation_progress/row_113.md` |
| (2) Row 118, the installation acceptance form and its revocation | complete | `implementation/118_acceptance_web.md`, `delegation_progress/row_118.md` |
| (3) Clean-up after the fourth contract step (`implementation/v4_fourth_contract_step.md` item 4) | complete | this file |

## (3) The selector panel reads `common.captureSlotRefusal` as its ONE source

| File (`apps/core-web/src`) | Change |
|---|---|
| `i18n-web.ts` | `web.captureSlotRefusal` lost `source` and `reason` (the two members kept "by reference"); `code` stays (the shared tree has no member for it); the import of `en` is gone |
| `features/devices/slot-refusal.ts` | the kind `WEB` and the type `WebSlotRefusalReason` are gone; every worded reason is `SHARED` (a key of `en.common.captureSlotRefusal`); `wordedSlotRefusalReasons` reads the shared group and the one development word |
| `features/devices/capture-selector-panel.tsx` | ONE line: `t('common.captureSlotRefusal.<word>', { source: t('common.captureSlotSource.<kind>') })` (a sentence without `{{source}}` ignores the noun) |
| `features/devices/__tests__/selector-microphones.test.tsx` | the two cases of row 234 follow: `web.captureSlotRefusal` holds `code` only; THE PIN, word for word: "This camera was not assigned: it is a production device, and this Core runs in development capture operation. This camera can be assigned only on a Core running in production capture operation. Nothing was changed."; the rendered sentence of the panel is still compared with it through the shared tree |

Nothing of `packages/shared` was edited (agent V5 is its writer); no line of V5 for this agent was found in `file_requests.md` at the last reading.

## Checks (in `apps/core-web`, `--maxWorkers=2`)

| Command | Result |
|---|---|
| `npx vitest run` of `commissioning.test.tsx`, `selector-microphones.test.tsx`, `capture-selector.test.tsx`, `live-api-reference-document.test.tsx`, `live-api-reference-page.test.tsx`, `scalar-config.test.ts`, `live-shell-admin.test.tsx`, `core-queries.test.tsx`, `box-check.test.ts` | `Test Files 9 passed (9)`, `Tests 299 passed (299)` |
| `commissioning.test.tsx` after the last source edit, with nine suites that walk the source tree | `Test Files 10 passed (10)`, `Tests 270 passed (270)` |
| `npx tsc -b` | exit 0 |
| `npx oxlint` | exit 0, no warning |

The first run of `commissioning.test.tsx` alone: 1 failed of 29, in my own new negative control (record 113 section 6); fixed, then the runs above.

## Requests left (`file_requests.md`, three lines `rows 113 / 118 (agent W2) | ...`)

1. the writer of `packages/shared`: the sentence of `COMMISSIONING_NOT_AVAILABLE` (true of a production Core without host inputs too) and the `429` of an address change;
2. row 181 / the controller: the step list of an acceptance;
3. the owner of the production scan: what the set-IP panel cannot show until SR-13.

## Rules

The claims line was the first act. Edit tool only for every existing file; new files with Write. No scripted replace, no shell append, no generated rewrite.
