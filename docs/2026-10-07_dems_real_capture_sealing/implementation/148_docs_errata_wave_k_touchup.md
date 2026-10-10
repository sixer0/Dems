---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (documentation touch-up after closing passes K-Z1 and K-Z2)
scope: documents only - three specifications under masterplan/ (03, 05, 08) and this note; no code, no test, no script, no README, no lane, no git write
status: needs-review
---

# 148 - Documentation touch-up for the indexed view and the closing passes (PE-WK-36 .. PE-WK-46)

Documents only. Edited: `masterplan/03_api_contract.md`, `masterplan/05_capture_architecture_spec.md`,
`masterplan/08_client_ux_spec.md`. Created: this note. Nothing else was written: not `06` / `07`, not the
README, not `decisions/decisions.md`, `status_tasks.md`, the tracking table of `02_plan.md`,
`file_requests.md` (the docs-owner line of "wave K Z1", 19:42:01Z, is not marked done), `file_claims.md`
(note 147 appended one line there; this task allowed no other file), notes 136 / 137 / 147 / 145 / 146,
nothing under `apps/*`, `packages/*`, `scripts/`, any test. No command of the product, no suite, no lane was run;
no git write (one read-only `git status`).

Convention continued from note 147: numbered errata in place, each naming its decisions and its notes, one row
in the file's errata index, a mention in the file's `last_updated` (prepended). The last id before this pass was
`PE-WK-35`; this pass uses `PE-WK-36 .. PE-WK-46` (11 errata). Ids are unique across the specs (checked: each id
appears as one erratum paragraph and one index row). No earlier sentence was deleted: a superseded sentence stays,
with a bracketed or capitalised mark that says what supersedes it.

Sources read: note 147 (convention, open item 1), 145, 146, `delegation_progress/contract_wave_k.md` ("Z1",
lines 146-162), the "wave K Z1" docs-owner line of `file_requests.md` (line 282), decision D225 (`decisions.md:238`),
and the code named in the "Source" column. Every `file:line` below was read in the tree on 2026-10-11 before it was
written. What the notes say was proven on a device was NOT re-run; each erratum says so.

## 1. Errata

### In-place updates of existing errata

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-35 (updated) | 03 §2.4 Media (88); errata index row | Header says "contract named, producer not yet live when first written; built by closing pass K-Z1"; the "STATE:" sentence is marked superseded and kept; new paragraph "AS BUILT" (8 points): request and answer, the index (fields, constants, `reference_ID` 1, limits), exact-or-none with the seven refusal codes, route rule 1 (offsets of the view; the token's claim; refusal position), route rule 2 (`409 SEEK_INDEX_NOT_AVAILABLE`, never plain bytes), audit row in file offsets, what is unchanged (web, sealed package, export, Verify, totals), what was proven and not | D224 (1), D225 (1) (2); `media-stream/seek-index.ts:105`, `:54-68`, `:92-93`, `:155-182`; `source.ts:91-93`, `:197-198`, `:254-263`; `token.ts:54-55`, `:73-74`, `:109`, `:147-154`; `service.ts:142`, `:168`, `:231-237`, `:341-342`, `:358`, `:437-462`, `:495-501`; `contract_wave_k.md:157`; note 145 sections 1, 2, 3 |
| PE-WK-24 (superseded) | 08 §6.6 (flow 5); errata index row | Title says "SUPERSEDED BY ERRATUM PE-WK-37 ... HOLDS ONLY FOR A SESSION WHOSE ANSWER STATES NO INDEX"; closing sentence adds that its "stay exactly as built until K-Z1 reports", "starts again from 0:00" and "prototype only" sentences now apply to a session without `seekIndex` only | D224 (1), D225 (1); PE-WK-37 |
| PE-WK-23 (open part marked built) | 08 §6.6; errata index row | A bracket after "Until then ..." says the open part (the tablet's four rows, the once-per-fragment proposal) is built (PE-WK-42, PE-WK-36); the two sentences stay | D225; PE-WK-36, PE-WK-42 |
| PE-WK-26 (pointer) | 08 §6.6 | Bracket: corrected for the tablet / phone by PE-WK-46 | `mobile .../verify-v2.ts:466-471` |
| PE-WK-27 (pointer) | 08 §6.6 | Bracket: the tablet's band legend IS live (PE-WK-45); the end sentence is still not built | `sealed-player.tsx:594` |

### New errata

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-36 | 03 §5.2 `EVIDENCE_MEDIA_SERVED`, after the table of PE-WH-04 | The WARNING row of a media stop is written ONCE per (operator, sign-in session, item as sealed, file, fragment, code) within 60 s, not once per request that stops; a repeat is refused the same way and is a `warn` log line `repeated: true`; the memory (256 entries, filled after the commit, forgotten at a restart); row in file offsets on a session of the view; measured 1 row / 4 requests; PE-WH-04's own line cites moved (issue row `:346-354`, stop row `:385-394`, Range log line `:373`) | D225 (2), D224; `media-stream/service.ts:144`, `:297-298`, `:370-408` (key `:377`, repeat `:380-383`, row `:385-394`, memory `:395-405`); `packages/shared/src/api/capture.ts:107`; contract Z1 section 2; note 145 sections 3.5, 4, 10 (3) |
| PE-WK-37 | 08 §6.6 (flow 5) | The tablet / phone scrubber SEEKS on the indexed view; how the app asks (`SEEK_INDEX_MEMBER`, the `422` fallback), that the player's own report still decides; what remains of PE-WK-24 (a stream that reports no duration) and what does not; position kept across a renewal; proven on the tablet (25 / 50 / 90 %, 296 s item, interrupted item); not proven (phone, held finger drag, one-camera); limits seen (0:29 / 0:31, dev toast) | D224 (1), D225 (1); `mobile .../media-session.ts:109`, `:116-118`, `:130-146`, `:160`; `sealed-playback.ts:111-117`; `sealed-player.tsx:182-184`, `:333-345`, `:383`, `:391-396`, `:402`, `:559`, `:573-577`; `sealed-player-i18n.ts:12`; note 145 sections 0, 3, 11 |
| PE-WK-38 | 05 §D.4, after the paragraph (before CAP-M7-01); errata index row | POINTER: a session that asks `seekIndex: true` is served the indexed view of the same bytes; the one-fragment decrypt unit, per-fragment tag and stop-before-a-failed-fragment rules of §D.4 hold for it (one reader); Range offsets are the view's; §D.1-§D.3, the package, the export and Verify unchanged; refers to C3 PE-WK-35 / 36 and UX PE-WK-37; cross-reads §C.6 ("the sealing step computes its own index") | D224 (1), D225 (1); `seek-index.ts:105`; `source.ts:197-198`, `:254-263`; `05 §C.6` (lines 1172-1178); evidence spec fields 64-67, 72 |
| PE-WK-39 | 08 §6.6 (flow 5) | The renewal rule of the media session as ruled in D225 (1): on demand (Play, seek) at the session's end with a 5 s margin; after a player error ONLY then; a player error on a live session stops with its position and "Open again" (replaces wave H's "renew once after a player error", G94-07); "Open again" rate-limited and leaves the player paused; after a renewal the player resumes at the playhead (two writes, the new stream's 0:00 not shown, the old source's end report ignored, controls keep reading Pause); proven on the tablet; three pinned tests moved | D225 (1), D224; `sealed-player.tsx:16-27`, `:104-107`, `:154-155`, `:261-262`, `:271`, `:309`, `:313-319`, `:321-343`, `:347-364`, `:372-375`, `:387-393`, `:400-404`, `:434-444`, `:531-551`; `media-session.ts:193`, `:196`; `shared/src/i18n/en/evidence.ts:481`, `:487`, `:715`; note 145 sections 3.4, 4, 6, 10 (1) |
| PE-WK-40 | 08 §6.6 (flow 5) | The item's action bar reads "Pause" (existing `evidence.media.pause`) with the pause icon while the sealed player plays, and the press pauses it; reads "Play" again when the player goes | D225, D224; `sealed-player.tsx:66-72`, `:157-161`, `:425-426`; `evidence-detail.tsx:127-128`, `:424-425`; `shared/src/i18n/en/evidence.ts:175`; note 145 sections 0, 4 |
| PE-WK-41 | 08 §6.6 (flow 5) | The stepper's badge `Chip` is keyed by variant + colour and mounted anew when its look changes (a chip that changed variant in place stopped painting its check / number); cause as far as isolated; reproduced under reduced motion (the overlay hypothesis does not hold); the component is shared by every stepper of the app; proven in the wizard up to "Destination", export not run to "Complete" | D225, D224; `mobile src/components/composed/stepper.tsx:362-370`, header `:1-12`; note 145 section 4 "G94b-13" |
| PE-WK-42 | 08 §6.6 (flow 5) | A tamper stop is ONE WARNING row (Core once per stop + app no renewal of a live session); the measured "before" (8 requests = 2 sets of cut + three 409) and "after" (1 row, 4 requests), the row's figures; same sentence as before with "Open again"; on the web the probe adds log lines by the rule, NOT driven in a browser; closes the open part of PE-WK-23 | D225 (1) (2), D224; `service.ts:376-401`; note 145 sections 3.5, 4 |
| PE-WK-43 | 08 §6.6 (flow 5) | Web export job sentences for a finished job without a download: `archiveOnCore` true -> "The export is stored on the Core ({{exportId}}).", false -> "Demonstration: no archive is written.", not stated -> "The Core server states no archive for this export."; read by name; same three states as the tablet; an older Core no longer says "stored on the Core" | D224, D225 (K-Z2); `core-web .../export-job-model.ts:96-103`; `export-wizard.tsx:527`; `export-job-status.tsx:129-134`; `core-web src/i18n-web.ts:162-163`; `shared/src/i18n/en/evidence.ts:588`; note 146 item 2 and open item 3 |
| PE-WK-44 | 08 §6.6 (flow 5) | The web wizard pre-selects the option whose recorded text equals `exportDestinationDefault` of op 40 (the operator's own choice first; else the first option); the list-page wizard keeps the first option | D224, D225 (K-Z2); `core-web .../item-facts.ts:36`, `:99-101`, `:112`, `:152`; `detail-page.tsx:405`; `export-wizard.tsx:66-72`, `:129`, `:143-145`; `shared/src/i18n/en/evidence.ts:707`; note 146 item 3 and open item 2 |
| PE-WK-45 | 08 §6.6 (flow 5) | Updates PE-WK-27: the tablet's band legend is live (`itemIntervals={item.audioIntervals}`); the camera tiles and the tablet's end sentence are as before | D225; `sealed-player.tsx:594`; note 145 section 4 "G94b-07" |
| PE-WK-46 | 08 §6.6 (flow 5) | CORRECTION of PE-WK-26: the tablet / phone `v2FilePartOutcome` takes `storedOk`, `plainOk`, `chainOk` and the checks only; `plainChecked` appears nowhere in `apps/mobile/src`; it words "Not run" by V-05 of the result; the web does read the member. Found by the citation re-check; OPEN for the mobile owner | D222 (6), D224; `mobile .../verify-v2.ts:466-471`; `core-web .../verify-v2.ts:471`; a search of `apps/mobile/src` for `plainChecked` (0 hits); note 144 line 204 |

### Errata count

| Document | New errata | Updated in place | Ids |
|---|--:|--:|---|
| 03_api_contract.md | 1 | 1 | PE-WK-36; PE-WK-35 updated |
| 05_capture_architecture_spec.md | 1 | 0 | PE-WK-38 |
| 08_client_ux_spec.md | 9 | 4 | PE-WK-37, 39 .. 46; PE-WK-23, 24, 26, 27 marked |
| Total | 11 | 5 | PE-WK-01 .. PE-WK-46 now exist |

## 2. Line citations of PE-WK-01 .. PE-WK-35 re-checked

Scope: every citation in the errata paragraphs of 03, 05 and 08 that points into `packages/shared/src/api/evidence.ts`,
`apps/core-server/src/media-stream/*`, `apps/mobile/src/features/evidence/*`, `apps/core-web/src/features/evidence/*`;
also, because the same pass edited them, `apps/core-web/src/i18n-web.ts` (lines 147-155, 173-182) and
`packages/shared/src/i18n/en/evidence.ts:482`. The 06 / 07 errata (PE-WK-16 .. 20) cite none of these paths
(`06:982 items.ts:54` belongs to an earlier erratum and holds).

### Corrected

| Erratum | Document | Was | Now | What it points to |
|---|---|---|---|---|
| PE-WK-35 | 03 | `media-stream/seek-index.ts:1-50` | `:1-41` | the file's header (the file is complete: 182 lines) |
| PE-WK-35 | 03 | `evidence.ts:545-557` | `:548-557` | the two example constants (545 is inside the comment above them) |
| PE-WK-35 | 03 | `mobile .../media-session.ts:107` | `:109` | `SEEK_INDEX_MEMBER` |
| PE-WK-22 | 08 | `media-stream/service.ts:39-52`, `:395-405` | `:42-51` (header), `:454-462` (first piece before the status line), `:484-492` (the cut) | the 409 at the first fragment; the cut in flight |
| PE-WK-23 | 08 | `service.ts:338-353`, `:397-405` | `:370-408` (`recordServed`, the row `:385-394`), `:456-462`, `:484-492` | the WARNING row on a stop |
| PE-WK-24 | 08 | `mobile .../sealed-playback.ts:109-117` | `:111-117` | `seekAvailabilityOf` |
| PE-WK-24 | 08 | `mobile .../sealed-player.tsx:510` | `:559` | `isDisabled={seek === 'NONE'}` |
| PE-WK-24 | 08 | `mobile .../sealed-player.tsx:526` | `:573-577` | the `noSeek` caption |
| PE-WK-25 | 08 | `mobile .../evidence-detail.tsx:213` | `:214-216` | `exportRefused` |
| PE-WK-25 | 08 | `mobile .../evidence-detail.tsx:500-503` | `:504-508` | the "Export requires the Supervisor role." caption |

### Held (read, unchanged)

| Erratum | Citations that held |
|---|---|
| PE-WK-01, 02, 06, 07, 08 | `packages/shared/src/api/evidence.ts:402` (the `from` rule), `:443` (`reason`), `:164` (`exportDestinationDefault`), `:278` (`plainChecked`), `:308` (`failedFragmentCount`); and for PE-WK-35 `:507-512`, `:533-538` |
| PE-WK-22 | `core-web .../sealed-player.tsx:54`, `:278`, `:306-318`, `:476`, `:661-678`; `core-web src/i18n-web.ts:173-182` (the strings are at 175-182); `packages/shared/src/i18n/en/evidence.ts:482` |
| PE-WK-23 | `core-web .../media-session.ts:206-209`, `:265` |
| PE-WK-24 | `mobile .../sealed-player-i18n.ts:12` |
| PE-WK-25 | `mobile .../evidence-detail.tsx:426-433`; `export-sheet.tsx:38-59`, `:639-662`; `export-job-status.tsx:71`; `evidence/i18n.ts:276-284` |
| PE-WK-26 | `core-web .../verify-v2.ts:471`; `mobile .../verify-v2.ts:466` (the line holds; the claim about it is PE-WK-46) |
| PE-WK-27 | `core-web .../sealed-player.tsx:581-600`, `:681-684`; `core-web .../sealed-playback.ts:84-92`; `i18n-web.ts:182`; `mobile .../audio-source-band.tsx:35` |
| PE-WK-28 | `mobile .../use-evidence-media-ref.ts:55`; `export-job.ts:41` |
| PE-WK-29 | `core-web .../transcript-model.ts:137-150`, `transcript-pane.tsx:340-341`; `i18n-web.ts:154`, `:155`; `mobile .../transcript-pane.tsx:101`, `:144`, `:348`; `transcript-model.ts:170` |
| PE-WK-30 | `core-web .../transcript-pane.tsx:270-312`; `i18n-web.ts:147-153`; `mobile .../transcript-pane.tsx:240`; `evidence/i18n.ts:266-272` |

Not examined (outside the four paths): the citations of PE-WK-03 .. 05, 09 .. 21, 31 .. 34 into `sealing`, `engine`, `modules`,
`session-monitor`, `session-live`, `lib/`, `components/`, `scripts/` and the like. Note 147 read those on 2026-10-11 and the
files named were not reported as edited since.

## 3. Checks

No validation command applies to markdown; none was run. Checked by reading, counting and one scan: each of
`PE-WK-36 .. PE-WK-46` appears exactly once as an erratum paragraph and once as an index row in its file (03: 36; 05: 38; 08: 37, 39-46);
the `last_updated` line of each of the three files was prepended; no emoji-like character in the three files (a range scan,
0 hits). The registry totals are unchanged and PE-WK-35 says so: 97 operations / 36 GET / 61 POST / 67 audit types, schema 6.
Behaviour statements are the code's as read (file:line above) or the driver's measurement (marked "proven by the driver ... not
re-run"); every client erratum ends "Not yet gate-verified".

## 4. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | README block "Fix wave K: additions and corrections" (note 147) still says the tablet player cannot seek yet and cites PE-WK-24 / PE-WK-35 as the state; it is stale after Z1 | The README was outside this task; the owner of the README should read PE-WK-37 |
| 2 | Stale line cites outside PE-WK-01..35, in `03_api_contract.md`: PE-WH-02 `service.ts:195` (that line is now a closing brace; the sealed-package test is `hasSealedPackage`, `service.ts:223`) and `service.ts:263` (the case scope is `holdsCase` `:226-228` and `holdScope` `:289-294`); PE-WH-04 `:314-323`, `:344-353`, `:341` (moved; PE-WK-36 states the current lines at its end) | Outside the ids this task named; not edited |
| 3 | Code comments that still state the old renewal rule: `apps/mobile/src/features/evidence/media-session.ts:20` ("and once after a player error") and `sealed-player.tsx:92-93` (StopCause PLAYER: "failed twice at one place on a session that had NOT ended") | The code now stops at the first error on a live session (PE-WK-39); comments are the code owner's; documents only here |
| 4 | PE-WK-46: the tablet / phone does not read `plainChecked`; note 144 line 204 says M2 does | The change is code; whether a real result shows the difference was not examined |
| 5 | Nothing in this pass is gate-verified. Proven only by the driver on the tablet (note 145): not re-run here. Not proven anywhere: the PHONE; a held finger drag; the one-camera package on a device; the export run to "Complete" (six badges); a launch without reduced motion (stepper overlays); the web probe's row count in a real browser; the web's `archiveOnCore` / `exportDestinationDefault` sentences in a browser (tests only) | Targeted re-check of gates 70, 75, 89, 94 has not run (D225 "Next") |
| 6 | Reading of "the two route rules" of the request (item 1): taken as rule 1 (offsets, `content-length`, `content-range`, `416` are the view's) and rule 2 (`409 SEEK_INDEX_NOT_AVAILABLE`, never plain bytes at the view's offsets); the audit row in file offsets (point 6) and "one row per stop" (PE-WK-36) are stated too, so any other reading is covered | Request wording |
| 7 | D225 (3) (tablet media volume stays at 4 of 15) and (4) (the 409 body example of the media route to be exported by the shared package so the web player test imports it) are not documented as behaviour: (3) is the environment, (4) is on the post-gate list | Not behaviour of the product |
| 8 | Not edited, by the task's rule: `decisions.md` (D225 counts "35 errata PE-WK-01..35"; there are now 46), `status_tasks.md`, the tracking table of `02_plan.md`, `file_requests.md` (the "wave K Z1" docs-owner line, line 282, is not marked done), `file_claims.md` | Controller's files |
| 9 | Behaviour in the code was read in the working tree of 2026-10-11 (HEAD `57b80a9` plus uncommitted wave K edits); a later edit by a driver can move the line numbers again | Files in flight; the test runner was executing the suites |

---
*Generated: 2026-10-11*
