# src/features/evidence

Up: [src/features](../README.md)

## Purpose

The Evidence pages of the web console: the evidence list (`/evidence/`) and the detail page of one item (`/evidence/$evidenceId`).

- The list: KPI cards, a toolbar with the status and subject filters and the search (kept in the URL), the evidence table (`@tanstack/react-table`, 10 rows per page), a sticky preview beside the table, and row actions (open, verify, export, archive).
- The detail page: a header with the item's status, id and time range, and three tabs (`?tab=`): Media (the sealed player with the camera files, the audio-source band, the camera and microphone pairs, the transcript pane and its revisions), Metadata (the manifest fields as stored) and Hash and Integrity (the integrity checks, the Verify run and its v2 report).
- Export: the export wizard queues an export (operation 42), follows the background job (operation 87) until it is finished, and downloads the file.

In Live mode the Core server is the source of truth for every fact; in Simulated mode the simulator and the bundled DEMO packages stand in. A member the code cannot read is shown as "not reported", never guessed (`item-facts.ts`, `item-v2.ts`, `verify-v2.ts`).

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and component tests of this folder, with test beds and fixtures (see Tests) |
| [`audio-source-band.tsx`](audio-source-band.tsx) | The audio-source band of the player: a static overlay of the item's audio intervals over the recorded span |
| [`cause-words.ts`](cause-words.ts) | A cause code as the operator reads it, through the one map in `src/lib/event-words` |
| [`check-list.tsx`](check-list.tsx) | The list of integrity checks: `full` (expected and found values, Integrity tab) or `compact` (export wizard) |
| [`chips.tsx`](chips.tsx) | Status, subject-type and verdict chips; an item whose stored verification failed never reads plain "Sealed" |
| [`choreography.ts`](choreography.ts) | Motion timings and variants of the list and detail pages |
| [`clipboard.ts`](clipboard.ts) | Copy helper for the hash and id copy buttons, with a toast on success and failure |
| [`demo-assets.ts`](demo-assets.ts) | Resolves media, metadata, integrity and export files of a DEMO package from the package index; the assets context and fetch loader |
| [`detail-page.tsx`](detail-page.tsx) | `EvidenceDetailBody`: the detail header and its Media, Metadata and Hash and Integrity tabs (lazily loaded) |
| [`development-source.tsx`](development-source.tsx) | The development-source marks of an item and of a verified source, drawn with the one badge of `src/features/devices/source-badge.tsx` |
| [`evidence-table.tsx`](evidence-table.tsx) | The evidence table with its row actions; busy while an archive of an item is out |
| [`evidence.css`](evidence.css) | Styles of the Evidence pages |
| [`export-download.ts`](export-download.ts) | Export downloads: the download plan, the prebuilt DEMO zip checked against its own manifest hash before saving, the export manifest notices |
| [`export-job-model.ts`](export-job-model.ts) | Pure rules of the background export job of operations 42 and 87: statuses, terminal job, progress, poll interval |
| [`export-job-status.tsx`](export-job-status.tsx) | The status of an accepted export (id `EXP-NNNNNN`) while its job runs, and its download |
| [`export-job.ts`](export-job.ts) | Reads the export job (operation 87, `getEvidenceExportJob`) through the query client until it is finished; starts the download |
| [`export-outcome.ts`](export-outcome.ts) | Pure reading of the Core's answers to an export request (accepted, denied, refused) for the wizard |
| [`export-wizard.tsx`](export-wizard.tsx) | The export wizard: kind, destination (default from operation 40), checks, then the request (`exportEvidence` action) and the job status |
| [`finished-exports.tsx`](finished-exports.tsx) | The finished exports of the item that operation 40 lists for this operator, each with "Download export" |
| [`index.tsx`](index.tsx) | `EvidenceListPage` and `EvidenceDetailPage`, the route components (root test ids `page-evidence` and `page-evidence-detail`) |
| [`integrity-tab.tsx`](integrity-tab.tsx) | The Hash and Integrity tab: lifecycle stages, sealed values, the Verify run (operation 41) and its report |
| [`item-facts.ts`](item-facts.ts) | One defensive reader of what the Core states about one item beyond its v2 members (media source, finished exports, sealed track profiles, key class, signature) |
| [`item-marks.tsx`](item-marks.tsx) | Marks that state a fact of the item (interrupted, not sealed, demonstration record, no media), drawn only from `item-facts.ts` |
| [`item-v2.ts`](item-v2.ts) | One defensive reader of the schema-v2 members of an evidence item: camera files, pair audio files, missing audio tracks, transcript state, signature |
| [`json-tokens.ts`](json-tokens.ts) | Tokenizer of JSON text for the read-only viewer |
| [`json-view.tsx`](json-view.tsx) | Read-only JSON (or JSON lines) viewer that shows the text exactly as stored |
| [`labels.ts`](labels.ts) | i18n labels computed from ids (`checkLabel`) |
| [`list-page.tsx`](list-page.tsx) | `EvidenceListBody`: KPI cards, toolbar, table and the sticky preview (beside the table from 1280 px) |
| [`lock-shackle.tsx`](lock-shackle.tsx) | The lock icon shown with a role (RBAC) denial; only the shackle animates |
| [`log.ts`](log.ts) | The page's structured error record, written to the console's error sink in `src/runtime` |
| [`manifest-summary.ts`](manifest-summary.ts) | One-line summaries of the manifest fields for the Metadata tab |
| [`media-session.ts`](media-session.ts) | The signed media session of operation 88 `createEvidenceMediaSession`: request, refusals, renewal before expiry; the URL is a bearer value and is kept only where it is needed |
| [`media-tab.tsx`](media-tab.tsx) | The Media tab: camera switch, microphone tracks kept in sync with the video, the player and the transcript |
| [`metadata-tab.tsx`](metadata-tab.tsx) | The Metadata tab: the package files and manifest; in Live mode it says when the Core's media reference (operation 40) did not answer |
| [`model.ts`](model.ts) | The page model: pure joins of a simulator item to its DEMO package, filters, row building, stored verification |
| [`pair-audio.tsx`](pair-audio.tsx) | The audio of the camera and microphone pairs of one item: one row per sealed AUDIO-0N file, with its hash and the camera file it is in |
| [`pending-actions.ts`](pending-actions.ts) | One-shot hand-offs from the list to the detail page (auto-verify on arrival, header origin for the grow animation) |
| [`playback-link.ts`](playback-link.ts) | The link between the sealed player and the transcript: the current position marks a segment; a click on a segment seeks |
| [`preview-card.tsx`](preview-card.tsx) | The sticky preview beside the table: poster, id, time range, key values, package line, Open details and Export |
| [`sealed-format.tsx`](sealed-format.tsx) | The sealed format of an item: the per-track profile from the signed manifest (operation 40, `evidence.files[].profile`) |
| [`sealed-playback.ts`](sealed-playback.ts) | Pure playback rules: band segments, resync tolerance, seek clamping, time format, development sources, permission gate |
| [`sealed-player.tsx`](sealed-player.tsx) | The player of the sealed camera files, through the media session of operation 88 |
| [`selectors.ts`](selectors.ts) | Page-local `useSim` selectors (`selectOperators`) |
| [`session-annotations.tsx`](session-annotations.tsx) | The markers and notes the operator added to the session, read from the item; a marker time seeks the player |
| [`sim-adapter.ts`](sim-adapter.ts) | Reads and writes over the simulator: simulated tamper, failed tracks, recording a package verification, latest audit row |
| [`status-label.ts`](status-label.ts) | The one word of an item's status, with a failed verification of record said on it |
| [`toolbar.tsx`](toolbar.tsx) | The list toolbar: search, status and subject filters with their counts |
| [`transcript-model.ts`](transcript-model.ts) | Pure transcript rules: the sealed machine transcript is never overwritten; revisions are shown beside it; text and note limits |
| [`transcript-pane.tsx`](transcript-pane.tsx) | The transcript pane and its revision list; asks nothing when operation 40 says the operator may not read the transcript |
| [`transcript-revise-dialog.tsx`](transcript-revise-dialog.tsx) | The dialog that revises one segment (operation 85) |
| [`transcript.ts`](transcript.ts) | Operations 84 `getTranscript`, 85 `createTranscriptRevision` and 86 `listTranscriptRevisions` in both data modes, with their query hooks |
| [`use-archive.ts`](use-archive.ts) | The archive action (`archiveEvidence` through `useCoreActions` and `settle`) for the row menu and the detail "More" menu |
| [`use-evidence-media.ts`](use-evidence-media.ts) | In Live mode, which bundled media belongs to an item, as operation 40 `getEvidence` states it |
| [`use-evidence-table.ts`](use-evidence-table.ts) | The table model (`@tanstack/react-table`): URL filters, local sorting, page size 10 |
| [`use-retry-cooldown.ts`](use-retry-cooldown.ts) | Rate-limited retry: 3 s, 6 s, 12 s, at most 3 retries, with a countdown |
| [`use-row-motion.ts`](use-row-motion.ts) | Row reveal motion for the kit table, using a MutationObserver |
| [`use-verification.ts`](use-verification.ts) | The integrity re-verification: recomputes track SHA-256 and manifest digests of a bundled package in the browser, or runs operation 41 (`verify` action) in Live mode |
| [`verify-v2-report.tsx`](verify-v2-report.tsx) | The schema-v2 result of one Verify run: the source line first, then the files, findings and checks |
| [`verify-v2.ts`](verify-v2.ts) | One defensive reader of the v2 answer of operation 41 `verifyEvidence` (null for a v1 answer) |

## Main exports

- `EvidenceListPage` and `EvidenceDetailPage` (`index.tsx`), the route components.
- Used by other folders: `src/features/sessions` imports `causeWords` (`cause-words.ts`) and the date and duration formatters of `model.ts`; `src/components/composed/audio-source-band.tsx` follows the band rule of `sealed-playback.ts`.

Routes: `/evidence/` (`src/routes/_app/evidence/index.tsx`) and `/evidence/$evidenceId` (`src/routes/_app/evidence/$evidenceId.tsx`).

## Core operations, state and shared modules

| Operation | Name | Where |
|---|---|---|
| 39 | the evidence list; with operation 40 it carries `developmentSources` as recorded at the seal | `development-source.tsx` |
| 40 | `getEvidence`: the item, its media reference, finished exports, export destination default, transcript access, sealed profiles | `use-evidence-media.ts`, `item-facts.ts`, `export-wizard.tsx`, `transcript-pane.tsx` and others |
| 41 | `verifyEvidence` (`verify` action) | `use-verification.ts`, `verify-v2.ts`, `integrity-tab.tsx` |
| 42 | export an item (`exportEvidence` action); answers "queued" | `export-wizard.tsx`, `export-job-model.ts` |
| 84, 85, 86 | `getTranscript`, `createTranscriptRevision`, `listTranscriptRevisions` | `transcript.ts` |
| 87 | `getEvidenceExportJob` | `export-job.ts` |
| 88 | `createEvidenceMediaSession` | `media-session.ts`, `sealed-player.tsx` |

Also the `archiveEvidence` action (`use-archive.ts`). Operations that are not actions are called through `useWebLive()?.client.call(...)` in Live mode and the simulator's router in Simulated mode.

State read through `useSim`: the evidence items, `sessionHistory`, the operators, the audit rows and the clock.

Shared package modules: `@dems/shared/api`, `@dems/shared/demo-data`, `@dems/shared/domain`, `@dems/shared/evidence-rules`, `@dems/shared/i18n`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`, `@dems/shared/tokens`.

Console folders used: [`src/lib`](../../lib/) (core-errors, core-queries, event-words, effect-start, pending-control, download, utils), [`src/runtime`](../../runtime/), [`src/motion`](../../motion/), [`src/components`](../../components/) (shell, composed, media, ui, role-reason), [`src/features/devices`](../devices/) (the development-source badge), [`src/features/sessions`](../sessions/) (session model).

## Tests

- [`__tests__/`](__tests__/): `cf-web-custody-media`, `efix-integrity-metadata`, `evidence-export`, `evidence-integrity`, `evidence-media`, `export-job`, `item-exports`, `item-facts`, `item-v2`, `media-session-canary`, `sealed-player`, `sealed-playback`, `transcript-follows-revision`, `transcript`, `verify-v2-signing-key`, `verify-v2` (`.test.tsx`), `playback-link.test.ts`, the beds `harness.ts`, `live-evidence-bed.ts`, `real-item-bed.ts` and the folder `fixtures/`.
- Page-level tests in [`src/test`](../../test/): `evidence-table`, `live-cf-web-media`, `live-evidence-archive`, `live-evidence-media-signout`, `live-evidence-export`, `live-efix-evidence`, `live-evidence-verify`, `live-strict-mode-starts`, `live-w0-evidence-words`, `real-core-facts` (all `.test.tsx`).

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D5, D21: camera and microphone pairing VIDEO-0N with MIC-0N, and per-channel microphone files declared and sealed; the web shows the pairing.
- D119 (row 154): web wording for the three new audio codes routed to row 159.
- D133 (row 159): the Integrity tab lists AUDIO-0N "in VIDEO-0N" with its hash and the signed missing-microphone statement; the verify view words the AUDIO rows and the new codes; the web reader limits follow the contract.
