---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave K, closing pass K-Z1 - the tablet / phone sealed player must SEEK (ruling D224 (1)); G94b-04 second half, G94b-07, G94b-10, G94b-13, the caller of `layoutTransition()`
date: 2026-10-11
agent: coder-execution
narrative_tier: 3
tree: 57b80a9 + the working-tree edits of wave K (no commit, no git write)
status: complete
---

# 145 - Fix wave K, closing pass Z1 (core-server + shared + mobile, tablet `emulator-5556`, lane 2)

Status **complete**. One thing is left as found and reported, not hidden: the tablet's media volume
reads 4, not 5 (section 9). Scratch, logs and pictures: `.cache/gates/wave-k-z1/` (not in git).

## 0. What was proven where

| Item | On the TABLET (lane 2, real Core, the new code loaded) | By test |
|---|---|---|
| Indexed view, clean item `EV-20261010-0015` | the player reports a duration (60.795 s = the manifest's 60 795 ms); seeks to 25 / 50 / 90 % land on the second handed over and play goes on, both files (section 3.1) | index builder on the real tables; route + ranges (sections 5) |
| Range requests over the view | paused seek = two `GET /media/:token 206`; on the 296 s item `EV-20261010-0014` seeks to 70 / 148 / 273 s (beyond what the player had buffered) | 11 range cases, 416, the shifted refusal |
| Interrupted item `EV-20261010-0017` | duration 29.605 s, seeks to 16 and 28 s land, plays to its end | index of the real interrupted tables |
| Renewal after a seek | pause 62 s, Play: new sessions, back at 18.9 s, plays on; and a seek 66 s into one playing session: renewed, at 148 s, plays on | 5 tests |
| Tamper demo `EV-20261009-0005` | stops with the same sentence as before; ONE WARNING row per playback (seq 494, seq 507) | 3 tests + controls |
| G94b-04 "Pause" in the action bar | picture `c6.png`: both the player and the action bar read Pause; the action bar pauses | 2 tests |
| G94b-07 band legend | "Development source" beside MIC 1 and MIC 2 with no verify run (`c1.png`) | 2 tests |
| G94b-13 stepper badges | reproduced (`e1c.png`), cause isolated, fixed (`e2.png`, `e3.png`) | 4 tests |
| `layoutTransition()` caller | not driven | 8 tests |
| One-camera package | not on a device (lane 2 holds none) | sealed by the product pipeline in the test |
| Phone | NOT driven (idle, its lane stopped) | the same player code; M2's phone-layout tests green |

## 1. Design of the indexed view

**What it is.** `view = file[0, at) | sidx | file[at, size)`, `at` = the first fragment's `byteOffset`
(the end of the init segment). The same decrypted bytes plus ONE `sidx` box (ISO/IEC 14496-12
8.16.3, version 1). The box exists in the answer of the media route only: nothing is written, the
sealed package, the export archive and Verify never see it.

**Where the numbers come from** - the SIGNED manifest's fragment table only
(`files[].fragments[]`, fields 64-67, 72); no box of the file is parsed, nothing is estimated:

| `sidx` member | Value |
|---|---|
| `referenced_size` | the fragment's `byteLength` |
| `subsegment_duration` | the distance to the NEXT fragment's `mediaStartMs`; the last fragment's own `mediaDurationMs`. (A fragment's own duration spans its audio and video, so neighbours overlap by some ms - real tables: sum of durations 62 330 ms for a 60 795 ms track. The starts are the table's gapless clock.) |
| `timescale` | 1000 (the table counts whole ms of file time) |
| `earliest_presentation_time` / `first_offset` | the first `mediaStartMs` / 0 |
| `starts_with_SAP` | the fragment's `keyframe` |
| `reference_ID` | 1 - the one member the table does not hold (decision 2, section 10) |

**Exact or none.** An index is built only when the table says by itself that the references are the
whole of the file behind the init segment: first fragment after byte 0, each fragment starting where
the last ended, the last ending at the file's end, starts strictly ascending, at most 65 535
fragments. Otherwise a `SeekIndexRefusal` code, the session states no indexed view, the client keeps
its no-seek sentence. An interrupted recording's sealed prefix holds the rule (real tables) and gets
an index for what exists.

| File:line | What |
|---|---|
| NEW `apps/core-server/src/media-stream/seek-index.ts:105` | `buildSeekIndex(fileBytes, fragments)` - pure; `:54` refusal codes; `:155` `indexedViewSize`; `:167` `partsOfViewRange` (a view range = file bytes before the box, a part of the box, file bytes behind it); `:179` `fileOffsetOfViewOffset` |
| `media-stream/source.ts:91`, `:197` | `MediaFilePlan.seekIndex` / `seekIndexRefusal`, built with the plan from the same believed manifest (cached with it) |
| `source.ts:254` | `readIndexedView`: each file stretch goes through `readPlain` - a fragment is opened and authenticated exactly as in the plain stream |
| `media-stream/token.ts:55`, `:109`, `:147` | the view is a CLAIM of the token, under its MAC: the high bit of the file byte. Same length (91), a token cannot be moved between views |
| `media-stream/service.ts:168`, `:231` | body `{ fileId?, seekIndex?: true }` (strict) |
| `service.ts:341`, `:358` | indexed = asked AND the plan has an index; the answer states `seekIndex: true` then; a refusal of the table is a log line with its code |
| `service.ts:439-454` | the route: size, `content-length`, `content-range`, the 416 and the Range offsets are the VIEW's on such a session; a session of the view whose file has no index = `409` `SEEK_INDEX_NOT_AVAILABLE` (never plain bytes at view offsets) |
| `service.ts:450` | the log line and the audit row of a stop name the range in FILE offsets; `bytesServed` as sent |

**The refusal position.** Behind the box every view offset = file offset + box length. A range that
starts at the view offset the index names for a failed fragment maps to that fragment: clean `409`
`FRAGMENT_NOT_AUTHENTIC` naming it, not one byte. A range that reaches it later is cut before it.
Media-session rules unchanged (`mts_`, 60 s, binding, renewal). The web player sends no `seekIndex`
and gets exactly the stream of before.

## 2. The member and its example

One name, `seekIndex`, additive and optional, on operation 88 (written in
`delegation_progress/contract_wave_k.md` under "Z1" before the code, status LIVE there now):

- request `EvidenceMediaSessionRequest.seekIndex?: true` (`packages/shared/src/api/evidence.ts:507`)
- answer `EvidenceMediaSession.seekIndex?: true` (`:533`) - present exactly when THIS session serves
  the indexed view; never `false`
- examples `EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE` (`:548`), `EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE`
  (`:557`), both also in the operation's examples (`:1352`, `:1369`)
- OpenAPI regenerated by the generator under `.locks/npm.lock`: 97 operations; totals 97 / 36 / 61 / 67
  held by `packages/shared/test/api-wave-k-z1-seek-index.test.ts`
- mobile: `SEEK_INDEX_MEMBER` (`apps/mobile/src/features/evidence/media-session.ts`) was already
  this name; only its comment changed

## 3. On the tablet (supervisor, media volume 0, `motion=off`, lane 2 restarted 01:59:36 WIB)

Positions are the players' own `currentTime`, read through temporary log lines in the player
(removed; `grep KZ1 apps/mobile/src` = 0). The app was relaunched once after the contract change: a
running bundle kept its old answer validator and refused the new member as a contract violation -
a fresh launch reads it.

### 3.1 Clean item `EV-20261010-0015` (60.8 s; 25 / 23 fragments of 2-3 s)

`sourceLoad` duration 60.795 (before the index: unset). Taps on the scrub track while playing:

| Tap | Scrubber handed over | Leading player 0.1 s later | 3.5 s later (lead / follow) |
|---|---|---|---|
| 25 % | 15 s | 15.000 | 18.166 / 18.152 |
| 50 % | 30 s | 30.016 | 33.200 / 33.133 |
| 90 % | 55 s | 55.000 | 58.197 / 58.129 |

Each lands on the second asked (inside the fragment that holds it), play continues, both files
within 0.07 s. Final bundle without the log lines: 90 % tap reads 0:57 2.5 s later, both pictures
(`f_90c.png`). The no-seek sentence is gone; the scrubber is enabled.

### 3.2 Ranges on the wire

The 60 s file is buffered whole by the player, so its seeks ask the Core nothing new. Shown
separately: a PAUSED seek on `-0015` = two `GET /media/:token 206`; on `EV-20261010-0014` (296 s,
151 MB) seeks to 70, 148 and 273 s each close the two streams and open ranges at the new place,
and play goes on there (70.0 -> 74.5, 148.0 -> 153.9).

### 3.3 Interrupted item `EV-20261010-0017`

Duration 29.605 s (the sealed prefix). 50 % -> 16.04, 90 % -> 28.03, plays to 29.606 and pauses.
The time reads "0:29 / 0:31": the scrubber's total is the item's duration (camera 2 is 31.1 s), the
leading file ends at 29.6 - as before this pass.

### 3.4 Renewal after a seek (position kept)

- `-0015`: seek to 15 s, pause at 18.9 s from the action bar, 62 s later Play: two new sessions,
  `GET 200` (header + index) then `GET 206`, players at 18.892, play on (25.9 s seven seconds later),
  control reads Pause.
- `-0014`: seek to 73 s, play 66 s on the same session (one 206 answer ran 66 s: the token gates the
  start of a request), seek to 50 %: `stale true`, two new sessions, at 148.0, plays on.

### 3.5 Tamper demo `EV-20261009-0005`

Stops with "Playback stopped at 0:03 and did not resume. A recording that fails its integrity check
stops at the failed fragment: run Verify to see which." + "Open again" - the sentence of before.
Audit: ONE row per playback, `WARNING Media stream stopped: VIDEO-02 fragment 3
(FRAGMENT_NOT_AUTHENTIC)`, device `DEV-0001`, `rangeStart 0`, `rangeEnd 4287352` (file offsets),
`bytesServed 2257513` (seq 494 at 02:19:06, seq 507 at 02:38:37). Core log: one error line, three or
four "stopped again" warn lines, no second set of sessions.

### 3.6 Logcat (final pass on the final bundle, 43 747 lines)

0 `FATAL EXCEPTION` / `ANR in`; **0 error lines of the app's JavaScript**; 0 token shapes. Error-level
lines of the app process are the platform's known ones (`ExpoVideo` picture-in-picture x12,
`MediaCodec` x8, `EGL_emulation`, `SurfaceTexture`, the dev loading view) and ONE ExoPlayer
`Source error ... Response code: 409` (the tamper demonstration, expected). Mount warnings 161
(ruling D224 (2): a documented limit).

## 4. The other findings

### G94b-10 - one tamper stop wrote several WARNING rows

**Measured on the tablet before any change** (old Core, wave K client): one stop = 8 refused
requests = 2 sets of (the cut + three `409` at +0.1 s, +1 s, +2 s). Two causes:

1. The native player repeats a failed load three times before it reports an error (+0.1 / +1 / +2 s
   is its retry schedule). expo-video gives no switch for it.
2. The app then renewed the media session and re-opened at the same place: the second set.

Fixed at both:

| Where | Change |
|---|---|
| `apps/mobile/src/features/evidence/sealed-player.tsx:356` | a player error is renewed by itself only on a session at its END by the Core's clock; on a live session playback stops with its position ("Open again" stays the operator's, rate-limited) |
| `apps/core-server/src/media-stream/service.ts:377-401` | the WARNING row is written ONCE per (operator, sign-in session, item as sealed, file, fragment, code) within one media-session lifetime; a repeat is refused the same way and is a warn log line `repeated: true`. IDs and an instant in memory, never a token; a restart forgets it (never fewer rows than stops) |

Result: 1 row, 4 requests (the cut + the native retries). "ONE request" is not reachable from app
code.

### G94b-04, second half - the action bar read "Play" while the player played

`sealed-player.tsx:72`, `:159-161` `onPlayingChange`; `:426` the screen's action pauses a playing
player; `evidence-detail.tsx:128`, `:424-425` the label and icon ("Pause", the existing
`evidence.media.pause`).

### Renewal lost its Pause state (found while proving 3.4)

Taking the old source off a player makes it report `playToEnd`; the handler paused, so after a
renewal the players played while both controls read "Play". `sealed-player.tsx:155`, `:262`, `:388`,
`:393`: the end report is ignored from the hand-over until the leading player has loaded the new
source. Also `:153`, `:261`, `:372-374`, `:400-402`: the place of a renewal is written again at
`sourceLoad` if a player is not there, and the new stream's own 0:00 is not shown meanwhile.

### G94b-07 - `sealed-player.tsx:594` passes `itemIntervals={item.audioIntervals}`. Camera tiles unchanged (ruling D224 (4)).

### G94b-13 - stepper badges not painted

Reproduced without making an export (wizard of `EV-20261010-0022` to "Destination", `motion=off`):
badge 1 drew its check; badge 2 was done, its check glyph WAS in the view tree at its place and NOT
on screen; badge 3 had just become current and showed no number. Only the badge that was current
from its mount drew its content. No overlay runs under reduced motion, so M2's overlay hypothesis
does not hold. Cause as far as isolated: a kit `Chip` mounted as a pending badge that changes its
variant in place stops painting its children. Fix `components/composed/stepper.tsx` (the badge
`Chip`): `key` of variant + colour, so a chip of another look is mounted anew (+ a `testID`). Same
wizard, same steps afterwards: both checks and the "3" are drawn (`e2.png`, final bundle `e3.png`).
The export was not run to "Complete" (no export made); the re-check should look at all six.

### `layoutTransition()` caller - `system-status-card.tsx:85` takes `undefined` as it is (not edited).

## 5. Tests (each once after its fix; a second run only after a fail)

| Command | Result |
|---|---|
| `npx -w @dems/core-server vitest run --project unit src/media-stream src/modules/media-stream src/modules/evidence/__tests__/{routes,static}.test.ts test/static` | 24 files, 402 passed |
| - `media-stream/__tests__/wave-k-z1-seek-index.test.ts` | real tables (clean x2, interrupted x2: box read back member by member, every fragment's byte and start exact, duration = the track's), 11 refusals + control, every range of a view byte for byte, one-camera package sealed by the product pipeline, the token's view claim |
| - `modules/media-stream/__tests__/wave-k-z1-indexed-view.test.ts` | op 88 (stated / not asked / 422 / no exact index), whole view hashes to the sealed plaintext without the box, 11 range cases with the fragments opened, 416, nothing written, TTL + binding, refusal position (start-in and reach-later), ONE row + four controls |
| `npx -w @dems/shared vitest run test/api-wave-k-z1-seek-index.test.ts test/openapi.test.ts test/api-{examples,schemas,registry,openapi-scope,fx-descriptions,closeout,domain-operations}.test.ts` | 9 files, 167 passed |
| `npx -w @dems/mobile jest src/features/evidence src/components/composed src/layout src/motion src/features/dashboard/wave-k-z1-status-card-layout.test.tsx` | first run 2 red (M2's phone-layout renewal tests, moved by delta), re-run green: 50 suites, 517 tests |
| - `features/evidence/wave-k-z1-player.test.tsx` 15, `components/composed/wave-k-z1-stepper-badge.test.tsx` 4, `features/dashboard/wave-k-z1-status-card-layout.test.tsx` 8 | passed |
| typecheck + lint, `@dems/shared`, `@dems/core-server`, `@dems/mobile` (whole) | 0 errors; mobile's one known warning (`runtime/log.test.ts:160`) |

Red-first: no git write, so no run on the old code; controls are in the same files, and the device
tables of sections 3 and 4 are the "before" (8 requests, the unpainted badge, Play while playing).

## 6. Pins moved (by delta)

| Pin | Move |
|---|---|
| `core-server/src/media-stream/__tests__/static.test.ts` | file list + `seek-index.ts`; the answer line of op 88 + the optional member |
| `mobile/src/features/evidence/{media-session-canary,wave-h-c2-exports-playback,wave-k-m2-phone-layout}.test.tsx` | "the first error is renewed by itself" now elapses the session first (5 places): the rule is an ENDED session |
| `packages/shared/openapi/openapi.json` | regenerated |

## 7. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run -w @dems/core-server test` | none | 0 failed beyond the baseline |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run -w @dems/core-server test:db` (holds `modules/media-stream/__tests__/media-stream.db.test.ts`, `test/acceptance/contract.test.ts`) | db-migrate | 0 failed beyond the baseline; NOT run by me |
| `npm run -w @dems/shared test` | none | 0 failed |
| `npm run -w @dems/mobile test` | none | 0 failed |
| `npm run -w @dems/core-web typecheck` and its evidence tests | none | unchanged: the web reads no new member (K-Z2's tree; not run by me) |

## 8. Re-drive list

1. Tablet AND phone, clean item: three seeks, a drag with a finger (start beside the thumb; a held
   drag - M1's open point), Play from there.
2. A seek after 60 s and a pause past 60 s: the position is kept, the controls read Pause.
3. Interrupted item: seek; one-camera item if one exists.
4. Tamper demo, tablet and WEB: the same sentence as before; one WARNING row per playback (the
   web's probe asks the same place again: no extra row now).
5. Export wizard to "Complete": six badges drawn. Session New wizard and the Finalizing pipeline use
   the same stepper: look once.
6. Launch once WITHOUT `motion=off`: stepper overlays with the remounted chip (tested, not driven).

## 9. State left (02:42 WIB)

| Item | State |
|---|---|
| Lane 2 | RUNNING, PID 29919, restarted by me once at 01:59:36 (`stop 2`, `start 2 --with-camera-stub --speech-mic`, output to `.cache/gates/wave-k-z1/start_2.log`, 0600, not read into this note). New stub ports and fixture account (not read) |
| Selector | `CAM-01` / `CAM-02` (`H264_720P30`) / `MIC-01` PRIMARY / `MIC-02` STANDBY; no local device selected at any time |
| Session | none started by this pass; no active alert |
| Lane 2 data | media-session and audit rows of my playbacks on `-0005`, `-0014`, `-0015`, `-0017`; 10 WARNING stop rows on `-0005` (8 from the "before" measurement on the old Core, 2 after); two export wizards opened and closed before "Reason" (no export, no item state changed) |
| Seal rig | OFF (status read) |
| Tablet | on Login, "Core online", "paired as DEV-0001"; signed out through Settings; reverse rules 8081 and 4420 -> 4422; no lock touched, no fingerprint, biometric offer not taken |
| **Media volume** | **4 of 15, not 5.** Set to 0 with volume-down keys for playback; five volume-up keys and `cmd media_session volume --set 5` both leave it at 4 (as M1 found). I changed no audio setting to force it |
| Helper sessions | signed out (204), jar removed |
| Temporary code | none (`grep KZ1` = 0) |
| Phone, lane 1 | not touched |

## 10. Decisions for the controller

1. **The player no longer renews by itself after an error on a session that has not ended.** This
   moves wave H's rule (G94-07: "once after a player error") and three pinned tests. A transient
   player fault on a live session now stops with its position and "Open again" instead of one silent
   retry. It is what removes the second set of refused requests; the Core's one-row rule alone would
   also give one row (with 8 requests).
2. **`reference_ID` = 1** in the index: a constant, not a manifest fact. The player this view is for
   does not read it. If it must be the video track's real ID, the Core would read it from the file's
   own init segment (as CLOSE_TRACKS already does for the codec).
3. **One row per stop is keyed by operator + sign-in session, for 60 s**, not by media token: a
   renewed session at the same place is the same stop. A later playback, another operator, another
   fragment or file are their own rows (tested).
4. **The audit row of a stop on an indexed session names FILE offsets**; `bytesServed` includes the
   index's bytes.
5. The stepper fix is a remount of the badge chip on a look change; the kit's own defect is not
   diagnosed further.

## 11. Open items

- Media volume 4 (section 9).
- Phone not driven; one-camera item not on a device; export not run to "Complete".
- `core-server` db suite and the web's suites not run by me (section 7).
- The API contract document needs the member and the two route rules (request line to the docs
  agent in `file_requests.md`).
- Seen, not changed: the time of an interrupted item reads "0:29 / 0:31"; the tamper stop says
  "0:03" beside the time "0:04" (G94b-10's first half); the dev toast over the action bar swallows
  the first tap after a launch (note 06 section 7.4).

---
*Generated: 2026-10-11 02:45 WIB*
