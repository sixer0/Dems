# File ownership - track D

Source of truth: the Ownership Area column of `identification/03_implementation_blueprint.md` (Execution Profile) and its section 7 (single-writer resources). This file records rulings and the batches.

## Batch 1 (2026-10-12 22:30) - rows 2, 3, 4, 27, 87, 103, 160 (docs only), 13, 20, 95, 147 (code)
| Row | Owner area |
|---|---|
| 13 | one unit test in the capture area of apps/core-server (executor declares) |
| 20 | apps/core-server/src/capture/adapters/types.ts |
| 95 | NEW under apps/core-server/src/capture/: destination rule (+ its test) |
| 147 | apps/core-server/src/capture/adapters/credential.ts (+ its test) |
No overlap. Held back for load (1-minute load about 10 at launch, another session active): heavy rows 6, 10, 12, 39; database row 17; single-writer rows 19, 63.

## Update 22:30 - rows landed: 2, 4, 13, 20, 160
- Row 20 driver decisions DD-1..DD-4 ACCEPTED (profile optional until row 47 passes it; the named error is its own constant, not a sixth wire code; it lives in types.ts; start takes an optional signal).
- Row 13: no mic-transport.test.ts exists; its test went into adapters/__tests__/static.test.ts (A-3 block). ACCEPTED. static.test.ts is a shared file: later rows that add a static rule there make one small additive Edit after re-reading.
- Requests routed: (a) adapters/index.ts barrel exports of AUDIO_INPUT_BEYOND_CARD / AudioInputBeyondCardError -> held for the first integration pass (non-blocking; rows 64, 67 import ../types directly); (b) capture-session/index.ts:1131 pass `profile`, :950 drop the cast -> row 47 (its writer), told in its brief.
- Row 2 finding: the operation-count pin is core-api.ts:1079 plus seven test lines; sim/api.ts:767 is a comment (the simulator marks operation 97 at sim/api.ts:1479). Told to rows 63 and 94.

## Batch 2 (22:32) - rows 19 (audit vocabulary, single writer), 38 (packages/shared/src/api/capture-discovery.ts), 52 (packages/shared/src/api/state-slices.ts, sim/types.ts). Row 94 waits for row 38 (same file).

## Update 22:36 - row 147 landed
- Driver decisions 1-6 ACCEPTED (one JSON line, access nested, trailing line feed; zero or one access per message; malformed message refused with CAPTURE_LOCATOR_INVALID until a dedicated code exists; one-reader check in credential.test.ts; the injection result exposes no member; unpaired surrogate refused). Row 21 (the door) and row 40 (the relay) read this line format - told in their briefs.
- Requests held for the first integration pass: adapters/index.ts exports (startMessageBytes and types, plus row 20's two values); a dedicated refusal code in adapters/errors.ts; optional move of the one-reader check into rule A-2 of static.test.ts.

## Update 22:42 - rows 3, 38 landed
- Row 38 DD-1..DD-3 ACCEPTED (no sixth outcome member; no codec member on the answer; the contract text leads the server until row 50). Deviation noted: its five edits were applied by a uniqueness-asserted script, not the Edit tool - inside its own file, result reviewed by diff at the commit; the rule stands for shared files.
- core-web / mobile typecheck red at state-slices.ts:531-539 and sim/api.ts:344 = row 52 in flight (attributed to row 52; re-run when it lands).
- Requests routed: i18n NOT_H264 strings (common.ts:790,797) and onvif-session.ts:222,491-492 -> row 50; three Core comment lines -> first integration pass; regenerate openapi.json -> after row 52, by row 52 or the integration pass (single writer of openapi.json per batch: row 52 now).
- Row 94 (same file as row 38) may start after rows 52 and 19 land.

## Update 23:05 - rows 27, 87, 103, 52 landed (52 = needs-review)
- Row 52: driver decisions 1-4 judged. (1) its out-of-area edit of packages/shared/src/api/core-api.ts (three members of VideoTrackStatusSchema) is ACCEPTED - core-server did not compile without it; told to row 63 (operation pins live in the same file: re-read before editing). Scripted replace noted again; rule restated in every later brief. (2) codec in screen form `H.264` | `HEVC` ACCEPTED. (3) bounds 100-9999 / 1-240 ACCEPTED. (4) `fps` left non-null = the row's "not built" part.
- Row 52's remainder becomes integration pass I-1 (one small agent, after row 19 lands, exclusive owner of the listed lines): regenerate packages/shared/openapi/openapi.json ONCE (rows 19, 38, 52); nullable `fps` with its three core-web readers (devices-panel.tsx:323, device-drawer.tsx:237, session-monitor/model.ts:386); adapters/index.ts barrel exports (rows 20, 147); a dedicated refusal code in adapters/errors.ts (row 147); three Core comment lines (row 38).
- Test reds attributed: 2 x openapi drift -> I-1; the 67->77 audit pin -> row 19 (in flight).

## Update 23:15 - row 19 landed (needs-review -> remainder to I-1)
- Row 19: 77 audit types (33 with a key list). Driver decisions ACCEPTED: alias types are SECURITY; detail keys DD-1..DD-8 as recorded (reviewed by the security row at the close); fixture reveal reason CONNECTION_TEST. Three shared test files were not in the baseline pin list - added to research knowledge: i18n-vocabulary-sync.test.ts, api-registry.test.ts, api-domain-operations.test.ts. Scripted insertion into vocabulary.ts noted (third time): later briefs state "Edit tool only" as a hard limit.
- Integration pass I-1 LAUNCHED (sole code writer now): i18n labels of the ten types, the 67->77 pin in api-capture-discovery.test.ts, AUDIO_CARDS scope, nullable fps + three core-web readers, adapters/index.ts exports, errors.ts dedicated code, three comment lines, openapi.json regenerated once. No other code row starts until I-1 reports.

## Update 23:30 - I-1 landed, all checks green
- Confirmed: labels English only (the repository has no Indonesian resource: packages/shared/src/i18n/ holds en/ only); a null fps hides the whole format line in the three web readers until row 54 adds a rate-less string.
- Carried to their rows: row 54 (camera-tile.tsx:53, session-monitor/model.ts:455 use `fps ?? 25`), row 55 (mobile live-feed.tsx:216, device-detail.tsx:550), row 63 (stale comment core/audit-details.ts:187).
- Quiet point: no code row in flight. Full-suite run (sonnet runner) then commit of phase M0/M2-part.
