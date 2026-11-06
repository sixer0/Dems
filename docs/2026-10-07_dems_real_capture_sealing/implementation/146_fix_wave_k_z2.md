---
task_id: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (wave K, closing pass Z2)
status: complete (item 5 open by design)
scope: apps/core-web ONLY
---

# 146 - Fix wave K, closing pass Z2 (core-web)

Contract read: `contract_wave_k.md` S2 sections 2 and 3, KR sections 1, 2, 3. Every new test imports the
contract example from `@dems/shared/api`. Nothing outside `apps/core-web` and this note was written;
claims line "wave K Z2" is in `delegation_progress/file_claims.md`.

## Per item

### 1. Revision reason (op 86 `reason`, KR section 2)
- Read: `features/evidence/transcript-model.ts:125` (`readTranscriptRevision`) already read `reason` BY NAME
  (the web driver's work). Rule now stated and kept: `revisionReasons` (`:130-150`) takes the entry's own
  member first and reads the audit row `TRANSCRIPT_REVISED` only for an entry WITHOUT it; neither gives
  "Reason: not reported". The stale comment "operation 86 answers no reason today" was replaced (`:130-135`).
  No behaviour change was needed in code.
- Tests (`features/evidence/__tests__/wave-k-w-evidence.test.tsx`, describe "G81b-09"): the hand-typed `wire`
  payload is now the contract's `listTranscriptRevisions` 200 example minus `reason`; NEW cases
  - "operation 86 (contract example): the entry's own `reason` ..." - `readTranscriptRevisions` of the example
    page, `readTranscriptRevision` of the `createTranscriptRevision` 201 example, both equal
    `TRANSCRIPT_REVISION_REASON_EXAMPLE`; a disagreeing audit row does not replace it; the list renders
    "Reason: Koreksi nama jalan" with `data-reason="stated"`;
  - "an entry WITHOUT the member ... falls back to the audit row; with neither ... not reported".
- Output line: joint first run passed this file (see run section); rerun of the file alone after removing an unused
  constant: `Test Files 1 passed (1) / Tests 12 passed (12)`.

### 2. `archiveOnCore` (S2 section 3, KR section 3)
- `features/evidence/export-job-model.ts:94-103` NEW `answeredArchiveOnCoreOf(result)`: the 202 result's
  `archiveOnCore` read by that name, boolean or `null`.
- `features/evidence/export-wizard.tsx:527` passes it to `ExportJobStatus`; `export-job-status.tsx:24-25, 44, 129-134`
  the finished-job line without a download: `true` -> `evidence.exportJob.onCore` ("The export is stored on the
  Core (EXP-...)", testid `export-job-on-core`); `false` -> "Demonstration: no archive is written." (testid
  `export-job-no-archive`); not stated -> "The Core server states no archive for this export." Same three
  states and sentences as the mobile driver; the mobile keys are mobile-local (`apps/mobile/.../i18n.ts:283-284`),
  not in the shared i18n, so the web's own keys were added: `i18n-web.ts:161` `web.exportJob.noArchive`,
  `web.exportJob.archiveNotStated`.
- Tests (`__tests__/export-job.test.tsx`, appended describe "G94b-06"): the model reads the member by name;
  `EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE` -> no archive sentence, no "stored on the Core"; control `true`
  (the example with the Core's statement turned) -> "stored on the Core"; control example without the member
  -> "states no archive". The helper's default 202 body (`exportSealed`) now carries `archiveOnCore: true`
  (by delta: the two older cases that assert "stored on the Core" are a Core that says an archive is written).

### 3. `exportDestinationDefault` (S2 section 2)
- NOT read before. NEW: `features/evidence/item-facts.ts:36, 99-101, 112, 152` (`MEMBER.exportDestinationDefault`,
  `DetailFacts.exportDestinationDefault`, read as text <= 120, else `null`);
  `detail-page.tsx:405` hands `media.facts?.exportDestinationDefault` to the wizard;
  `export-wizard.tsx:66-72, 130-137` prop `destinationDefault`; the selected option is
  `chosenDestination ?? the option whose RECORDED text equals the default ?? first option`, so the operator's own
  choice always wins and the text the request records is the Core's own.
- Tests (NEW `__tests__/wave-k-z2-export.test.tsx`, 4 cases, bed of `wave-h-c2-bed.ts`, op 40 answer held to the
  strict contract schema): the `getEvidence.productSealed` example states `exportDestinationDefault` and the reader
  returns it (controls: absent / non-text / empty -> null); with the example the wizard shows "Case file transfer"
  and the `exportEvidence` request records `destination: "Case file transfer"`; control with the Core naming the USB
  option -> USB selected (this fails if the member is not read); control without the member -> first option.

### 4. `plainChecked` (KR section 1)
- Already done by the web driver: `__tests__/wave-k-w-evidence.test.tsx:139` imports
  `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` (import line 14), reads the rows through `readVerifyV2` and asserts
  `plainChecked === false` -> "NOT_RUN" per file, whatever V-05 says. Only checked, nothing added.

### 5. Media-route refusal body (decision 7) - OPEN
- `packages/shared/src/api` exports no example of the `409 MEDIA_NOT_AVAILABLE / FRAGMENT_NOT_AUTHENTIC` body of the
  media route (grep for `FRAGMENT_NOT_AUTHENTIC` finds only the operation 88 description, `evidence.ts:812`).
  `__tests__/wave-k-w-player.test.tsx:44` `ROUTE_REFUSAL` stays hand-typed. Request line of 18:20:00Z stays open.

## Run (once)
- `rtk npx vitest run wave-k-w-evidence.test.tsx wave-k-z2-export.test.tsx export-job.test.tsx` -> first run
  `Test Files 1 failed | 2 passed (3)`, `Tests 2 failed | 32 passed (34)`: the two failures were my NEW z2 file (the
  first draft opened an item that is a demo item, so its destinations read "(simulated)"); rewritten on the REAL-item
  bed, rerun of that file only: `Test Files 1 passed (1) / Tests 4 passed (4)`. The other two files passed in the first run.
- `rtk tsc -b` (apps/core-web): `TypeScript: No errors found`.
- `rtk npx oxlint` (apps/core-web): no finding (one unused constant `H` in `wave-k-w-evidence.test.tsx` was removed;
  rerun clean).

## Checks for the test runner
- `apps/core-web` full vitest (touched: `features/evidence/**`, `i18n-web.ts`); in particular any test that pins
  the `MEMBER` table or the key set of `web.*` (none failed in the touched files).

## Open items
1. Media-route refusal example (item 5): needs the shared owner to export it; then one import line in
   `wave-k-w-player.test.tsx`.
2. The list page's wizard (several items, no op 40 answer) cannot read `exportDestinationDefault`: it keeps the first
   option. Recorded text is the same on a real-capture Core ("Case file transfer").
3. `archiveOnCore` absent (an older Core): the web claims no stored archive (contract rule), so a COMPLETE job of such a
   Core without a download no longer says "stored on the Core".
