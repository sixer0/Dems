---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 92 (M8-W3, class B) — playback UI + revisions
date: 2026-10-09
agent: coder-execution (single driver; rules D94 / D122, ownership D95 §9, optimistic start D133)
source_plan: identification/02_structured.md row 92; masterplan/08_client_ux_spec.md flows 5 and 6; implementation/43_m8_media_stream.md, 44_m8_export_composite.md (client contract of rows 90 / 91); 72_r11_manifest_dev_mark.md
narrative_tier: 3
status: needs-review — software complete and green; NOT proven: anything in a browser or on a device, real media through the media route, a package sealed by the Core (row 82); mobile playback waits for one runtime member (§5)
---

# Row 92 — playback of the sealed files, audio-source band, transcript and revisions, export job, development marks

Paths: `W` = `apps/core-web/src/features/evidence/`, `M` = `apps/mobile/src/features/evidence/`.

## 1. What was built

| Piece | Where (file:line) | Real or stand-in |
|---|---|---|
| **Fix first (red since the checkpoint).** The verify reader knows V-01..V-15 and the third skip reason; reads `sources` (absent = null = nothing drawn; DEVELOPMENT only for code + `development === true`; DECLARED_PRODUCTION only for code + `false`; everything else, also `null`, UNKNOWN and an unreadable block = NOT_TRUSTWORTHY, named in `malformed`); `failedFragmentCount` | `W/verify-v2.ts:280`, `M/verify-v2.ts:285` (one text, semicolons apart) | real, on answers RECORDED from the real verifier through `contractBodyOf` (6 packages incl. development / declared production / edited mark) |
| The source line FIRST in the result, never collapsible, with one entry per source; "not trustworthy" as a danger state; declared production as plain text | `W/verify-v2-report.tsx:33`, `:96`; `M/verify-v2-report.tsx:37`, `:98` | real |
| Defensive reader of the v2 item members (`files` with both hashes, `audioSourceIntervals`, `transcript`, `developmentSources`: only the booleans, else null = not recorded) and the item-badge rule (only `true`, only Live data) | `W/item-v2.ts:156`, `:189`; `M/item-v2.ts` (twin) | real; compiles with and without the member on the sim type |
| Media session of op 88: only the PATH of `url` (`/media/mts_…`), body `{ fileId }` (sent without a body when the registry of the build does not know the member), `INTEGRITY` refusal from `FRAGMENT_NOT_AUTHENTIC`, staleness on the Core's clock. The path lives in a `MediaSession` (prints / serialises without it) and on the player only | `W/media-session.ts:42`, `:94`, `:128`; `M/media-session.ts:37`, `:166` (`mediaTransportOf`) | real against the contract-checked fake transport |
| Player: one element / expo-video player per camera file, first leads and is audible, second muted and re-aligned beyond 0.25 s; opening is a press (G7 Checking); renewal ON DEMAND (before Play / seek on a stale session, once after a player error, back to the same position); a second error at the same place stops with its position; integrity sentence from op 88 or from the page's last verify run | `W/sealed-player.tsx:103`, `:205` (src), `:264`; `M/sealed-player.tsx:92`, `:244` | real in code; no real media was played |
| Audio-source band from the item's intervals (static; only the playhead moves, from the media clock), legend, "audio at the playhead" | `W/sealed-playback.ts:47`, `W/audio-source-band.tsx:31`; `M/audio-source-band.tsx` | real |
| Transcript pane: ASSEMBLED / PARTIAL / UNAVAILABLE / DISABLED (DISABLED asks nothing), badge exactly "speaker labels unavailable" unless the document says LABELLED, "Inside the sealed package", "Sealed original — immutable"; revisions newest first with author, base and signature | `W/transcript-pane.tsx:45`, `M/transcript-pane.tsx:45`; rules `transcript-model.ts:157` (`deriveSegments`) | real; both data modes (Live client / `sim.request`) |
| Revise (ops 85 / 86): one segment, `baseRevision` = current, the sealed text is never edited — the revision is drawn BESIDE it as "derived, not part of the sealed transcript"; 409 conflict = fixed sentence, revisions re-read, typed text kept | `W/transcript-revise-dialog.tsx:37`, `M/transcript-revise-sheet.tsx:37`, `W/transcript.ts:159` | real |
| Export job (ops 42 / 87): after the 202 the job is polled (query client, 2 s) to COMPLETE / FAILED; percent forward-only; COMPLETE shows manifest hash + signature and "The export is stored on the Core"; `COMPOSITE_ENCODER_NOT_SELECTED` reads "Composite video is not available in this build" as a state; NO download control for a Core-sealed item | `W/export-job-model.ts:47`, `W/export-job.ts:53`, mounted `W/export-wizard.tsx:474`, `M/export-sheet.tsx:449` | real |
| Development badge: list row + item header from `developmentSources`; camera file + band legend from the verify result's `sources` (never the device list) | `W/evidence-table.tsx:241`, `W/detail-page.tsx:109`; `M/evidence-row.tsx:80`, `M/evidence-detail.tsx:117` | real; web reuses the console's ONE badge component |
| MB-05 Summary: stored + decrypted hash per camera file, transcript hash, label status, note of a REAL signature; nothing for a v1 item | `apps/mobile/src/features/session-summary/sealed-members.tsx:31`, mount `session-summary-screen.tsx:193` | real |
| Dev proxy entry `/media` (same-origin player) | `apps/core-web/vite.config.ts:42` | real |
| Words | `packages/shared/src/i18n/en/evidence.ts:455` (new blocks `sources`, `playback`, `transcript`, `exportJob`, `sealedMembers`; `V-15`, `OUT_OF_SCOPE`, `fragment.more_*` in row 87's block) | — |

## 2. Commands and results (each once; a re-run only after a fail)

```
typecheck   npm run typecheck -w @dems/core-web | -w @dems/mobile | -w @dems/shared      0 / 0 / 0 errors
lint        npm run lint -w @dems/core-web 0 · -w @dems/mobile 0 errors (1 foreign warning runtime/log.test.ts:160) · -w @dems/shared 1 foreign warning (test/integration-c1.test.ts:23)
web         npx vitest run --root apps/core-web --maxWorkers=4 src/features/evidence src/test/live-row87-verify-v2.test.tsx src/test/live-evidence-{archive,export,verify}.test.tsx src/test/live-efix-evidence.test.tsx src/test/live-w0-evidence-words.test.tsx src/test/live-fxr-w-evidence-media-signout.test.tsx src/test/evidence-table.test.tsx src/test/live-runtime-static.test.tsx src/test/live-strict-mode-starts.test.tsx src/test/live-static-ac-c-53.test.ts
            23 files, 205 tests passed (first run: 5 static pins red — see §6 D-92-9; after the fix green)
mobile      npx -w apps/mobile jest --maxWorkers=2 src/features/evidence src/features/session-summary
            25 suites: 24 passed, 185 tests; the 25th (live-evidence-static.test.ts, a pin I had mangled) re-run alone: 12 passed
shared      npx vitest run --root packages/shared test/i18n      2 files, 50 passed
mutations   a logged media path in the player (web, then mobile): the canary test goes red in both; files restored byte-exactly (SHA compared)
```

New tests: web `__tests__/{item-v2 (7), sealed-playback (11), media-session-canary (13), transcript (10), export-job (6)}.test.tsx`, `verify-v2.test.tsx` 25 -> 33; mobile `item-v2.test.ts` (5), `sealed-playback.test.ts` (6), `export-job.test.ts` (5), `media-session-canary.test.tsx` (9), `verify-v2.test.tsx` 18 -> 24, `session-summary/sealed-members.test.tsx` (3). Fixture regenerated: `TSX_TSCONFIG_PATH=apps/core-server/tsconfig.json node --import tsx .cache/row92/gen-fixture.mts <out.json>`.

## 3. Not proven

- No browser, emulator, build or real media. The player was driven with jsdom media elements / a fake expo-video player.
- The renewal design was not measured against a real player: whether a browser or ExoPlayer issues a new range request (and so an error) during plain playback past 60 s is a device question (row 90's D-90-9).
- A media element cannot read the body of the media route's 409, so "failed at <file> fragment <n>" comes from op 88's answer or from the last verify run of the page; without either the stop names the position and points to Verify (D-92-3).
- No package sealed by the Core; the transcript segments and revisions are scripted answers of the contract's shape.

## 4. Gate 94 flows (one scripted flow each; not run)

| Check | Flow | Pass |
|---|---|---|
| M8-PB-W | web, a REAL sealed item: Media tab -> Open playback -> two players, play, seek back / forward, play past 60 s, seek after 60 s (renewal), band names the mic at the playhead | both files play in step; the band matches `audioSourceIntervals`; no "stopped" state; DevTools: the only requests with `mts_` are `/media/…` same-origin |
| M8-PB-T / M8-PB-P | tablet / phone: same on the Media tab (needs the runtime member of §5) | same; logcat / runtime log hold no `mts_` value |
| M8-REV-1 | INVESTIGATOR: Revise one segment -> "Revision 1 appended"; the sealed text unchanged, the derived line with author; second console revises the same segment first -> conflict sentence, save again -> revision 2; TECHNICIAN sees no Revise | op 86 lists both, signed by the Core key; V-11 of a later Verify passes |
| M8-EXP-1 / M8-CMP-1 (client part) | SUPERVISOR: Export -> job Queued / Running / Complete, "The export is stored on the Core", no download button; a composite job -> "Composite video is not available in this build" | as stated |
| M7-DEVSRC-EVID-W / -T / -P | Live, a development item: badge on the row and the header -> Verify -> the first line is "DEVELOPMENT SOURCES — …" with its entries and a PASS verdict; an edited mark -> "not trustworthy"; a v1 item -> no line; Simulated client mode -> no badge, the verify result still carries the line | as stated |

## 5. To wire

| When | What |
|---|---|
| runtime (request filed, blocking for M8-PB-T / -P) | `mediaTransport()` on the mobile Live source (own Core origin + `Authorization` header). Until then the mobile player says "The media session could not be opened." and asks nothing of the Core (`M/media-session.ts:166`) |
| D1b: op 88 request schema | nothing: `requestMediaSession` already sends `{ fileId }` and falls back without a body |
| D1b: `ExportRequest.kind`, `EXPORT_IN_PROGRESS` in the hosted action | a control that STARTS a composite, and the 409 wording (key `evidence.exportJob.inProgress` exists) |
| D1b / row 91: `jobId` on the 202 | one function `exportJobIdOf` (follows the simulator's rule EXP-n -> EXPJ-n today) |
| a download operation | a download control in `export-job-status.tsx` (none exists now, by the contract) |
| row 82 | every flow of §4 on a product-sealed item |

## 6. Decisions taken (for the controller)

| ID | Decision | Alternative |
|---|---|---|
| D-92-1 | The media session is renewed ON DEMAND (stale before Play / seek; once after a player error, resume at the same position), not on a timer: a timed renewal would reload both players and write two audit rows every minute, also while paused | renew every ~45 s by a timer |
| D-92-2 | A second error at the same place (±1.5 s of media time) is not renewed again: no loop; "Open again" is manual and rate-limited (3 s, 6 s, 12 s; three tries) | keep renewing |
| D-92-3 | Integrity wording comes from op 88's 409 or from the page's last verify result; no probe request of the media route is made by the page (a probe cannot know the byte offset, and would put a token in a second request) | a small status operation on the Core that names the failed fragment of a session |
| D-92-4 | Transcript pane lives on the Media tab under the player (no fourth tab: the route's `tab` enum is a closed router file) | a `transcript` tab by request to the router owner |
| D-92-5 | Web segment list is not virtualised by a library (none in the stack, no new dependency): `content-visibility: auto` on each segment | add a virtual-list dependency by decision |
| D-92-6 | Per-file / per-microphone development marks need a verify run on that page (the item carries only the package boolean) | per-file classes on ops 39 / 40 |
| D-92-7 | MB-05 words are in the shared `evidence.sealedMembers` block: the Summary's own copy is digest-pinned to step 80. A simulated signature gets no second note (the card above marks it SIMULATED; the Live summary test forbids any other simulation wording) | — |
| D-92-8 | `features/evidence/audio-source-band.tsx` is new although `components/composed/audio-source-band.tsx` exists (the Monitor's live band, keyed by the live session and in pass D2's hands). To merge at the M8 review | one shared component |
| D-92-9 | Pins moved by delta, outside the two folders: `src/test/live-evidence-archive.test.tsx` (the folder's `client.call` list +6; `backendUnreachable` exempted from the "no own outage sentence" rule — it is a contract member), `src/test/live-runtime-static.test.tsx` (proxy entry `/media`), `M/live-evidence-static.test.ts` (+13 files, +3 call sites), `session-summary/summary-live-static.test.ts` (+1 file). The evidence folders import nothing from `@dems/shared/client` (MD-6): the usage error is told by its name | — |
| D-92-10 | Both Live beds answer op 87 by default (COMPLETE), because every accepted export now reads its job; existing export tests are unchanged | script it in each test |
| D-92-11 | `packages/shared/src/i18n/en/evidence.ts`: two of my edits inside my own new blocks were made with a script instead of the Edit tool (exact-string, additive); the file was re-read before | — |
