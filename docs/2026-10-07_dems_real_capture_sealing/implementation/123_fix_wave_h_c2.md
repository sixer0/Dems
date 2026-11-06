---
task_slug: dems_real_capture_sealing
date: 2026-10-10
agent: coder-execution (wave H, driver C2 — evidence clients)
source: delegation_progress/fix_brief_wave_h.md ; decision D200
status: needs-review
---

# Fix wave H — driver C2: what web, tablet and phone show for an evidence item

Area: `apps/core-web/src/features/evidence/**`, `apps/mobile/src/features/evidence/**`, the signature
lines of `apps/mobile/src/features/session-summary/**`, one appended i18n block
(`packages/shared/src/i18n/en/evidence.ts`, `itemFacts`). No commit, no migration, no device, no browser.
The web and the mobile halves were built by two sub-drivers of this driver under one common brief; the
lead wrote the i18n block, the request lines, and ran the checks of section 3 once more over both.

Status is **needs-review** for three stated reasons: (a) four web cases were written after their fix
(no red seen: the "no answer" case, the list-row thumbnail case, the interrupted list row, `access.play`);
(b) the one "Core's real shape" test per app is expected-failing until C1 adds a `LIVE_STREAM` example to
the contract; (c) G94-13 was not reproduced and not changed.

## 1. Findings

| Finding | Reproduced (red seen) | Fix | Test | Status |
|---|---|---|---|---|
| G94-02 BLOCKER (+ G94-14, G81-10): bundled picture / "No DEMO media" on a REAL item | yes, web and mobile (mobile: "No DEMO media for this item on this device.", Play opened `evidence-player-none`) | ONE rule per app, `item-facts.ts` `mediaKindOf`: streamable -> sealed player; `DEMO_PACKAGE` AND `isDemoItem` -> bundled media with the demo label; anything else / absent -> no player, no picture, `itemFacts.media.none` + reason. Web: `model.ts` (join only for a demo item in Live), `use-evidence-media.ts` `rowForMedia`, `detail-page.tsx`, `media-tab.tsx`, `preview-card.tsx`, `metadata-tab.tsx`, `item-marks.tsx`. Mobile: `evidence-detail.tsx` (hero, panel, Play, sheet), `evidence-row.tsx`, `play-sheet.tsx`, `metadata-tab.tsx` | web `__tests__/wave-h-c2-media.test.tsx`; mobile `wave-h-c2-media.test.tsx` (pane = tablet, screen = phone) | fixed |
| G94-01, client half | yes (one-camera item asked for two sessions; header wording) | the sealed player takes `media.files`, else the item's own VIDEO entries, else what op 88 answers; one-camera sentence | same files; every `getEvidence` 200 example of the contract is rendered; ONE expected-failing case per app waits for C1's `LIVE_STREAM` example | fixed; 2 expected-fail |
| G89-03 / G81-02 MAJOR: real signature labelled simulated / DEMO KEY | yes | a signature with `simulated: false` reads `itemFacts.signature.real`; qualifier only `developmentKey` (item member or verify result), else `keyClassUnknown`; a simulated item keeps its label. Web `integrity-tab.tsx`; mobile `live-integrity-tab.tsx`, `session-summary/sealed-members.tsx`, `session-summary-screen.tsx` (HashesCard signature lines) | web `wave-h-c2-integrity`; mobile `wave-h-c2-item-lines`, `session-summary/wave-h-c2-signature` | fixed |
| Interrupted item in the list row and the header | yes (web list-row case written after the fix) | `interrupted === true` -> "Sealed — recording was interrupted" + cause. Web `item-marks.tsx` `InterruptedMark` in `evidence-table.tsx`, `detail-page.tsx`, `preview-card.tsx`; mobile `interrupted-line.tsx` in row and hero | web media file "G75-03" x3; mobile item-lines | fixed |
| G89-04 / G89-09: v1 rows and the bundled v1 package on a v2 item | yes | a v2 item's rows come from its own members; no AUDIO rows, no bundled hashes / demo key / bundled check. Web `use-verification.ts`, `integrity-tab.tsx`; mobile `live-integrity-tab.tsx`, bundled package joined for a demo item only | integrity / item-lines | fixed |
| G89-05: `common.sourceClass.verify.v1` unused | yes | the sources line of a v1 item | same | fixed |
| G81-01: simulated item says "not available yet" | yes | the refusal keeps `details.reason`; `SIMULATED_ITEM` -> `itemFacts.transcript.simulatedItem` | web `wave-h-c2-transcript`; mobile `wave-h-c2-transcript-access` | fixed |
| No speech shown as a success | yes | ASSEMBLED with zero segments -> `itemFacts.transcript.noSpeech`, neutral chip, no revise control | same | fixed |
| G81-07: a page view writes `ACCESS_DENIED` | yes for the transcript (op 84 was called with `access.transcript: false`); `access.play` landed with G94-02 | `access.transcript === false` -> no op 84 / 86; `access.play === false` -> no op 88; absent -> asks as before | same | fixed |
| G94-05: finished exports | yes | web `finished-exports.tsx` on the detail, "Download export" through op 87 by `jobId`; mobile `finished-exports.tsx` with "Download from the web console." | web `wave-h-c2-export-playback`; mobile `wave-h-c2-exports-playback` | fixed |
| G94-09: DEMO chip / "(simulated)" / "No archive exists" on a REAL item's export dialog | yes | none of the three for a package sealed on this Core; the destination is sent and shown without "(simulated)"; a demo / simulated item keeps them | same | fixed |
| G94-07: TTL stop worded as an integrity failure | yes | a stop by the end of the media session reads `itemFacts.playback.sessionEnded`, Play renews; the integrity sentence only for an integrity answer | same | fixed |
| G94-08: browser prints the signed path of a refused request (web) | yes | renewal BEFORE expiry while playing; on a refused request the element's source is detached and replaced, never retried | same, x2 | fixed with a stated limit |
| G94-13: first tap on "View in Evidence" | NO | none: the control is outside this area; lines read, no cause found | none | NOT FIXED — not reproduced; request line filed |

### Bundled-media fallbacks found and removed for non-demo items
Web (lines before the fix): `model.ts:105` (join by evidence number), `list-page.tsx:59`, `use-evidence-media.ts:98`,
`detail-page.tsx:215-221` (poster, "No DEMO media"), `media-tab.tsx:199-208`, `evidence-table.tsx:184`,
`preview-card.tsx:53-58,112-115`, `metadata-tab.tsx:129`, `integrity-tab.tsx:166,298-340`, `use-verification.ts:273`,
`export-wizard.tsx:489-541`. No procedural feed exists in the web feature.
Mobile: `evidence-detail.tsx:212` (hero `HERO_STILL`), `evidence-media.ts:30-36` `posterForEvidence` (guarded in
`evidence-row.tsx`), `play-sheet.tsx:212` (`CameraFeed` with the session clock — the G94-02 picture), `evidence-detail.tsx:345`
(Play always opened the sheet), `media-tab.tsx:36`, `metadata-tab.tsx:158`, `live-integrity-tab.tsx` `bundled={pkg}`.

## 2. Contract with C1 as read
Names are those C1 landed in the tree (`packages/shared/src/api/{evidence,state-slices}.ts`), held in ONE `MEMBER`
table per app: `media.source / packageSuffix / files / reason`, `access.play / transcript / export`, `exports[]`
(`exportId`, `jobId`, `kind`, `completedAt`), item `interrupted`, `interruptedCause`, `signature.simulated /
developmentKey`, `integritySource`, `manifestVersion`, `files`, `tracks`. Not read: `sealedPackage`,
`exports[].exportedBy / archiveBytes / archiveSha256`, `audioSourceIntervals[].sourceClass`. C1 wrote no line in
`file_requests.md`; the names were taken from its schema.

## 3. Checks (run once; the lead's run after both halves and its own two edits)
| Command | Result |
|---|---|
| `npx -w packages/shared vitest run test/i18n.test.ts test/i18n-vocabulary-sync.test.ts test/fxr-w-nits.test.ts` | 3 files, 53 passed |
| `npm run typecheck -w packages/shared` ; `npm run lint -w packages/shared` | no output (clean) |
| `npm run test -w apps/core-web -- src/features/evidence/__tests__` | 17 of 18 files passed, 186 passed, 1 expected fail, 1 FAILED: the lead's own edit (four more worded reason codes) against a case that used one of them as the unworded code. Case changed to another code; that file re-run: 13 passed, 1 expected fail |
| `npm run typecheck -w apps/core-web` ; `npm run lint -w apps/core-web` | clean |
| `npm run test -w apps/mobile -- --maxWorkers=2 --silent src/features/evidence src/features/session-summary` | 34 suites passed, 281 tests passed (the `it.failing` case counts as passed) |
| `npm run typecheck -w apps/mobile` ; `npm run lint -w apps/mobile` | 0 errors; 1 warning in `src/runtime/log.test.ts:160` (not this driver's) |

Not run: whole-workspace suites; anything on a device or in a browser.

## 4. Decisions for the controller
1. Demo item = `integritySource` DEMO_PACKAGE or SIMULATED AND not sealed on this Core (tested by `signature.simulated === false`; evidence `apps/core-server/src/db/mapping/rows.ts:472-491`). The two apps spell the "sealed here" half slightly differently (mobile also asks `developmentSources: true` of a DEMO_PACKAGE item); for every row the mapping can produce they agree. C1's new `sealedPackage` member could replace both: not done.
2. No answer from op 40: web keeps "Media reference unavailable", mobile says "The Core server reported no media source for this item."; neither says `media.none` (the Core said nothing). No picture and no player in both.
3. A REAL item's export destination is shown and SENT without "(simulated)" (supersedes D158 DC-4 for packages sealed on this Core); `exportReal.note` was checked against the code path (the destination is a label in the signed export manifest, `package-export.ts:475`).
4. "Finished exports: not reported" is drawn only on an EXPORTED item; an absent list on another item draws nothing.
5. Demo items keep their list thumbnails without a per-row demo label (the detail carries the label).
6. `developmentKey: null` (C1: could not be established) reads the same as absent: "Signing key class: not reported".
7. Unused leftovers kept because pins name them: mobile `features.evidence.media.unavailable`; web `itemFacts.web.sourcesV1Title`; i18n reasons `QUARANTINED`, `UNSEALABLE` (C1 answers neither code).

## 5. Limits that remain (G94-08)
A request already refused is still printed once by the browser; paused playback does not renew by itself (the next Play
or seek renews first); the `video` element's `src` holds the live path while a session is open; each renewal reloads
the element at the same position about every 55 s of playback.

## 6. Checks for the test runner
- `npm run test -w apps/core-web` and `npm run test -w apps/mobile -- --maxWorkers=2` (whole workspaces, once per commit): expected green except the two expected-failing cases, which turn RED when C1's `LIVE_STREAM` example lands (then remove `.fails` / `.failing`).

## 7. Gate checks to re-drive (browser W2 and tablet T / phone P, lane 2)
- M8-PB-W / -T / -P on a REAL item: the sealed player opens (needs C1's op 40), no demo picture, no "No DEMO" words in list, header, Media tab; a one-camera item; an item with NONE shows the sentence + reason, Play disabled, no sheet.
- List thumbnails of REAL items numbered 0001-0014 (mobile joined them by number).
- A demo item on lane 1: bundled media with its label.
- Hash & Integrity before and after Verify on a REAL item, on `EV-20261009-0005` (v2 demo) and on a v1 item: no AUDIO rows, no bundled panel, no "simulated" / "DEMO KEY", the development-key line, the v1 sources line.
- Tablet Session Summary signature row (G81-02).
- The interrupted item `EV-20261010-0015`: list row and header.
- Transcript pane: a simulated item (lane 1), a no-speech item, a technician outside the case scope with the audit showing NO new `ACCESS_DENIED` row on a page view.
- EXPORTED item: "Finished exports" + "Download export" on the web; the list with "Download from the web console." on the tablet; the export dialog / sheet of a REAL item.
- Playback longer than 60 s: renewal before expiry, no `mts_` line in the browser console; a throttled stall reads "media session ended" and Play resumes.
- G94-13: the first tap on "View in Evidence".

## 8. Request lines filed (`delegation_progress/file_requests.md`)
09:47:11Z (proposed names; superseded), then two lines: to C1 (the `LIVE_STREAM` example; confirmation of the transcript reason / no-speech reading; the names as read) and to the owner of the mobile navigation (G94-13).
