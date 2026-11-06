---
row: CF-W (closing fix round CF, web)
date: 2026-10-06
agent: coder-execution
status: complete
defects: R-W-1 (Low), O-RT-1 (Low)
references: decisions D204, D207, D209, D210, D212, D214; test/08a_retest_web.md; test/08c_retest_tablet.md; gateway_check/11b_efix_web.md
narrative_tier: 2
---

# CF-W: closing fixes on the web console (R-W-1, O-RT-1)

## Summary

| Defect | Cause | Change | Tests | Mutations | Lane 3, before -> after |
|---|---|---|---|---|---|
| **R-W-1** The chain-of-custody table is wider than its card when a row has a multi-word Detail | The kit's automatic table layout never makes a table narrower than its columns' longest unbreakable words plus 16 px padding a side: 106 + 187 + 87 + 92 = **472 px**. The words are the date token (E2E-W1-7), `RECORDING_STOPPED` (no break opportunity), "Pratama" and "supervisor" (`integrity-tab.tsx:293-333` original; kit `table.css:263-264`) | Fixed table layout with set column widths. A `<wbr>` after each `_` of an action code. When the card is narrow (< 26rem of content, the 1280 layout), Detail moves under the action. On a phone-width card (< 20rem), the actor moves there too | 6 tests (2 component, 4 stylesheet) | 12 / 12 caught | 1440: table 472 in 441 (31 px over, Detail 62 of 92 px visible) -> **441 in 441**, Detail 112 of 112. 1280: 97 px over, Detail 0 px visible -> **375 in 375**, Detail 275 of 275, under the action. 1920: 631 in 631 -> 631 in 631. Date and clock 1 box each at every width |
| **O-RT-1** In Live mode, the Media tab of an item with no DEMO package says "Its record comes from the simulator" | `media-tab.tsx:187-195` (original) always showed `evidence.media.noMediaBody`. Plan row W0 item 9 (D158) made the Metadata tab and the preview card follow the mode, but not the Media tab (`src/test/live-w0-evidence-words.test.tsx:10-14`) | Live mode: "No DEMO package for this item: the Core server's record only." (the preview card's sentence). If operation 40 did not answer: "Media reference unavailable" (the chip's words) and nothing else. Simulated mode keeps its words. | 1 Simulated test + 2 Live tests | 4 / 4 caught | "...Its record comes from the simulator." beside a "Core record" chip -> "No DEMO package for this item: the Core server's record only." |

Full core-web suite on the final code: **111 files, 1,436 tests passed**, exit 0. Typecheck exit 0. Lint: 0 warnings, 0 errors. Secret scan: 44 files (24 PNG scanned as bytes), 0 hits. No commits.

## 1. Environment and rules kept

- **Lane 3:** web `http://127.0.0.1:5178` (Vite, pid 59869, cwd `apps/core-web`, i.e. this working tree), Live mode, Core on 4423 (pid 48927). I only checked that they were listening (`lsof`); I did not stop, start or restart any server, Vite, Metro, mock-core or emulator. Nothing touched `*:5432`.
- **Browser:** the Playwright-cache headless shell `chromium_headless_shell-1243`, driven over raw CDP. The CDP port is OS-assigned (`--remote-debugging-port=0`) and read from `DevToolsActivePort`; the driver checks with `lsof` that the listening socket belongs to the browser it spawned. Each run gets a fresh profile in `$TMPDIR`, killed on exit and removed afterwards (`ls $TMPDIR | grep -c cfw_profile_` -> 0 at the end). Every request to an origin other than `127.0.0.1:5178` is failed by the Fetch domain; blocked requests were 0 in every run. The driver is a copy of `11b_driver_cdp.mjs` (`assets/12c_driver_cdp.mjs.txt`). Browser runs used the sandbox off, as the brief requires.
- **Sign-in:** andi.pratama (SUPERVISOR). The driver reads the password from the README Quick start row in its own process (`readPassword`) and types it with `Input.insertText`. It is never printed or written, and I never grepped the README. No screenshot shows the login page.
- **No demo reset, scenario or fault.** No Verify, export or archive. The Core received only sign-ins, GET reads (`/api/v1/evidence`, `/api/v1/evidence/{id}`) and sign-outs (`204`).
- **Rollback:** before the first edit, copies of `integrity-tab.tsx`, `evidence.css`, `media-tab.tsx` and `detail-page.tsx` went into `.cache/rollback/CF-W/` with `SHA256SUMS`. Those hashes matched the tree at copy time. `packages/shared/src/i18n/en/evidence.ts` was **not edited** (decision D-CFW-2), so it has no copy.

## 2. R-W-1: the custody table fits its card

### Cause (evidence chain)

1. The custody table is a HeroUI `Table` (`integrity-tab.tsx:293-333`, original) inside `.table__scroll-container` (`overflow-x: auto`, kit `table.css:20-23`). Its `<table>` is `width: 100%` (`table.css:102-103`) under the browser's **automatic table layout**: the table is never narrower than the sum of its columns' min-content widths.
2. Kit cell padding is `px-4`, 16 px a side (`table.css:263-264`). Each column's min-content is its longest unbreakable word plus 32 px. Measured in lane 3's page (`assets/12c_design_probe.json`, `text`):
   - Time: date token "6 Oct 2026" 74.4 px, kept whole by E2E-W1-7's `nowrap` (`evidence.css:786-789`, original) -> **106**
   - Action: `RECORDING_STOPPED` 154.7 px at 600 14px Inter; an underscore is not a line-break opportunity -> **187**
   - Actor: "Pratama" 54.7 px -> **87**
   - Detail: "supervisor" 60.2 px -> **92**
   - Sum **472 px**, against 441 px of card content at 1440x900 and 375 px at 1280x800.
3. Before the fix, measured on lane 3 (`assets/12c_before_measurements.json`): table 472 in 441 at 1440 (31 px of sideways scroll, Detail 62 of 92 px visible); 472 in 375 at 1280 (97 px, **0 px** of the Detail visible); 631 in 631 at 1920. These match R-W's own numbers (`test/08a_retest_web.md:107`). E2E-W1-7's share is the date token: R-W measured Time 91 -> 106 px.

### Design decision (D-CFW-1), with evidence

At 1280 a 4-column table cannot fit cleanly. The minimum widths with 10 px padding are Time 94, Action 112 ("INCOMPLETE" 91.6 + 20), Actor 75, Detail 80, about 361 px of the 375 available. A fixed 4-column layout there leaves the Detail about 80 px wide, so "supervisor" breaks mid-word. The prototype, injected into the driver's page only, shows it: `assets/12c_design_prototype_fixed4col_1280x800.png` reads "superviso / r". At 1440 the same 4-column layout reads well (`assets/12c_design_prototype_fixed4col_1440x900.png`). Hence:

- **Every width:** `table-layout: fixed`, so the table is never wider than its card. Padding is 10 px a side. Columns: Time 6.25rem (holds the 74.4 px date token whole), Action 30%, Actor 22%, Detail the rest. An action code gets a `<wbr>` after each underscore, so it wraps as "RECORDING_ / STOPPED", never inside a word. Action, actor and Detail use `overflow-wrap: anywhere` only as a last resort for a word longer than its column; the time cell never gets it (E2E-W1-7 holds).
- **Narrow card, < 26rem of content (1280 px layout, 375 px):** each row is a 3-column grid (Time | Action | Actor). The Detail sits under the action, across the action and the actor. The query measures the card's content box: 441 px at 1440 and 631 px at 1920 keep four columns. The Detail heading and the dash of an empty Detail are hidden **visually only** (`clip-path`, not `display: none`), so assistive technology still reads four columns, and the DOM order is unchanged.
- **Phone-width card, < 20rem (390 px viewport, 286 px):** each row has 2 columns: the time, then the action with the actor and the Detail under it. Three columns would need the time column plus "RECORDING_" at 110 px plus "Pratama" at 75 px, 285 px or more. A first version broke "RECORDIN / G_" there (seen in a scratch capture), and this step fixes that. The 390 width is not in the brief's list; it is a regression check.

### Change

| File | Lines (current) | What |
|---|---|---|
| `apps/core-web/src/features/evidence/integrity-tab.tsx` | 29-47 | `breakableCode()`: a `<wbr>` after each `_`; the text is unchanged |
| same | 74-81 | docblock: cause and layout |
| same | 326-341 | column classes `evi-custody-col-time/-action/-actor/-detail` |
| same | 348-368 | row `data-detail`; cell classes `evi-custody-time-cell`, `evi-custody-action-cell`, `evi-custody-actor`, `evi-custody-detail` (+ `data-empty="true"` for no Detail); action code through `breakableCode` |
| `apps/core-web/src/features/evidence/evidence.css` | 790-915 | container on `.evi-custody-card`; fixed layout, padding, column widths, word guard; `@container evi-custody (width < 26rem)` (829-870); `@container evi-custody (width < 20rem)` (877-915) |

The kit's table rules are in the same `components` cascade layer as `evidence.css` (`@heroui/styles/dist/index.css:14`), so specificity decides. Every override has at least two classes. The phone-width action-cell border uses `tr.table__row` to outweigh the kit's `.table-root--secondary .table__row .table__cell` (0,3,0); a scratch capture showed a stray line under "SEALED" until then.

### Tests

`apps/core-web/src/features/evidence/__tests__/cf-web-custody-media.test.tsx` (new):

| Test | Proves |
|---|---|
| R-W-1: the custody cells -> "an action code may break only after an underscore..." | each action cell holds a `<wbr>` after every `_`, preceded by text ending in `_`; `textContent` equals the code |
| ... -> "the columns and cells carry the classes..." | the four column classes in order; the cell classes; `data-detail`; `data-empty="true"` and "—" only for an entry with no Detail; the repro reason appears once, whole |
| R-W-1: the stylesheet -> "lays the table out with fixed column widths..." | `table-layout: fixed;`, `padding-inline: 10px;`, widths 6.25rem / 30% / 22% |
| ... -> "wraps the action, the actor and the Detail by words..." | the `overflow-wrap: anywhere` guard covers action, actor and Detail; the time keeps `overflow-wrap: normal` and the `nowrap` tokens; `.evi-mono` keeps `break-all` for hashes |
| ... -> "on a narrow card (< 26rem of content...)" | the container; the 26rem block: grid rows, Detail `grid-column: 2 / -1`, time cell spans 2 rows when there is a Detail, widths reset to `auto` in grid rows, the Detail heading and an empty Detail visually hidden (not `display: none`), no line between the action and its Detail |
| ... -> "on a phone-width card (< 20rem of content)..." | the 20rem block comes after the 26rem block; 2 tracks; actor and Detail in column 2; time spans 2 or 3 rows; the Actor heading visually hidden; the action-cell border rule outweighs the kit |

Fails before, passes after. `assets/12c_red_before_fix.log` holds the 8 tests that existed before the fix: 8 failed. The phone-width test was added later with its own red run, before its CSS existed: "3 failed | 4 passed (7)", including the 2 cell and narrow tests whose new assertions it extended. After the fix, everything passes (§4).

### Mutations (in memory; tree untouched)

The harness is `assets/12c_mutate_config.mts.txt` + `assets/12c_mut.sh.txt`, derived from FX-W's 11b harness. A source mutation is a Vite load-time transform of the served module. A stylesheet mutation wraps the test's single `readFileSync(EVIDENCE_CSS)` call with `.replace(from, to)` inside the served test module. The runner checks that each anchor occurs exactly once. Media-tab and evidence.css hashes were identical before and after two recheck runs (`7d0a351a...`, `797d5b9b...`). Log: `assets/12c_mutations.log`.

| # | Mutation | Result |
|---|---|---|
| M0 | none (baseline through the mutation config) | 2 files, 9 tests passed |
| M1a | no `<wbr>`: `{entry.action}` | 1 failed (underscore test) |
| M1b | `table-layout: auto;` | 1 failed (fixed widths) |
| M1c | narrow: Detail `grid-column: auto;` | 1 failed (narrow) |
| M1d | time column `width: 4rem;` | 1 failed (fixed widths) |
| M1e | empty Detail not marked | 1 failed (classes) |
| M1f | narrow: Detail heading `display: none;` | 1 failed (narrow) |
| M1g | narrow: no width reset (`width: inherit;`) | 1 failed (narrow) |
| M1h | Detail column class missing | 1 failed (classes) |
| M1i | phone: three columns kept | 1 failed (phone) |
| M1j | phone: time spans 2 rows with a Detail | 1 failed (phone) |
| M1k | phone: action border rule loses to the kit | 1 failed (phone) |
| M1l | action cell class missing | 1 failed (classes) |

**12 / 12 caught.**

### Before / after on lane 3 (EV-20261006-0014, Hash & Integrity -> Chain of custody)

The item is the R-W repro: RECORDING_STOPPED by AKP Andi Pratama with the reason "R-W re-test: interview ended by the supervisor from the web console", then SEALED. Measurements come from `assets/12c_before_measurements.json` (13:42:48-13:43:08 WIB) and `assets/12c_after_measurements.json` (14:18:24-14:18:55 WIB).

| Viewport | Before: content / table / sideways overflow / columns | Before: Detail visible | After: content / table / overflow / columns | After: Detail | Date + clock |
|---|---|---|---|---|---|
| 1280x800 | 375 / 472 / **97** / 106, 187, 87, 92 (auto) | **0 of 92 px** | 375 / 375 / **0** / 100, 162, 112, [1 = hidden heading] (fixed, 3-column grid) | 275 of 275 px, 2 lines, **under the action** | 1 box each, before and after |
| 1440x900 | 441 / 472 / **31** / 106, 187, 87, 92 | **62 of 92 px** | 441 / 441 / **0** / 100, 132, 97, 112 | 112 of 112 px, 7 lines, own column | 1 box each |
| 1920x1080 | 631 / 631 / 0 / 129, 187, 109, 206 | 206 of 206 px | 631 / 631 / **0** / 100, 189, 139, 203 | 203 of 203 px, 3 lines | 1 box each |
| 1024x768 (regression check) | not captured | — | 848 / 848 / 0 / 100, 254, 187, 307 | 307 px, 2 lines | 1 box each |
| 390x844 (regression check) | not captured | — | 286 / 286 / 0 / 100, 186, [hidden], [hidden] (2-column grid) | 186 of 186 px, 3 lines, under the action and actor; action on 1 line | 1 box each |

After the fix, no cell's content is wider than its cell at any width, apart from the 1 px visually hidden empty Detail, which is excluded by design. The action wraps only at the underscore ("RECORDING_ / STOPPED" at 1280 and 1440). The before log's "action lines" field counted range rectangles, not lines; the final driver measures line count from the span's height. The before-capture driver is the same script without that refinement and without the after-only steps. The metrics in the table are computed identically in both runs.

Screenshots (`gateway_check/assets/`):
- before: `12c_before_rw1_custody_1280x800.png`, `12c_before_rw1_custody_1440x900.png`, `12c_before_rw1_custody_1920x1080.png`; whole page: `12c_before_rw1_integrity_page_{1280x800,1440x900,1920x1080}.png`
- after: `12c_after_rw1_custody_1280x800.png` (stacked), `12c_after_rw1_custody_1440x900.png`, `12c_after_rw1_custody_1920x1080.png`, `12c_after_rw1_custody_1024x768.png`, `12c_after_rw1_custody_390x844.png`; whole page: `12c_after_rw1_integrity_page_{...}.png`
- design evidence: `12c_design_prototype_fixed4col_1280x800.png` (why 1280 stacks), `12c_design_prototype_fixed4col_1440x900.png` (why 1440 keeps four columns), `12c_design_prototype_stacked_1280x800.png` (early stacked prototype, before the header width reset)

## 3. O-RT-1: the Live Media tab says where the record comes from

### Cause

`apps/core-web/src/features/evidence/media-tab.tsx:187-195` (original) rendered the empty state of an item with no package with `t('evidence.media.noMediaBody')` = "This item has no DEMO package, so there is nothing to play. Its record comes from the simulator." (`packages/shared/src/i18n/en/evidence.ts:182`). It did this in both modes. Plan row W0 item 9 (D158) gave the Live twins to the Metadata tab's record label and the preview card's package line only (`src/test/live-w0-evidence-words.test.tsx:10-14`). The Media tab was never in that list, so no test caught it. `detail-page.tsx:337` (original) also did not pass operation 40's state to the tab, so the tab could not tell "no package" from "reference unknown".

### Change (decision D-CFW-2: reuse existing Live keys, no shared i18n edit)

| File | Lines (current) | What |
|---|---|---|
| `apps/core-web/src/features/evidence/media-tab.tsx` | 29-35 | prop `mediaUnavailable` (Live: operation 40 did not answer), documented as in `MetadataTab` |
| same | 66-69, 71-74 | docblock; `useCoreMode()` read with the other hooks |
| same | 199-209 | `data-source` = `simulated` / `core` / `unavailable`. Simulated: unchanged title and body. Live: "No DEMO media" with `evidence.live.noPackage`. Live and unavailable: title `evidence.live.mediaUnavailable`, no body (claims no absence, as the Metadata tab's empty state does, W83 ledger #95) |
| `apps/core-web/src/features/evidence/detail-page.tsx` | 337 | passes `mediaUnavailable={media.status === 'unavailable'}` to the Media tab, as already done for the Metadata tab |

**Why not a new sentence in `packages/shared/src/i18n/en/evidence.ts`?** The brief allowed that file. But every core-web Vite server (5173, 5176, 5177, 5178) serves this tree, and `apps/core-web/src/i18n.ts` has no HMR boundary. The mobile app imports `@dems/shared/i18n` too (`apps/mobile/src/i18n/index.ts:3`), and Expo's Metro watches the workspace (`apps/mobile/metro.config.js:1-2`). An edit to a shared resource module would very likely full-reload every open console page. On Metro it would reload the running phone and tablet apps' JavaScript while CF-M1 runs device loops for an intermittent crash (R-P-1), where a reload could pass for the crash. The existing Live sentence is the one the preview card already shows for the same fact (D158), and the existing chip label covers the unavailable case. So the fix needs no shared edit. If a sentence parallel to the Simulated one is wanted ("...Its record comes from the Core server."), it is a one-key follow-up for a window with no device runs.

### Tests

- `apps/core-web/src/test/live-cf-web-media.test.tsx` (new; the Live bed of plan row W69 with the contract-checked fake transport, item `EV-20261001-0007`, operation 40 answers `NONE` by default):
  - "operation 40 answers NONE...": chip `core`; empty state `data-source="core"`; "No DEMO media" + `evidence.live.noPackage`; no `/simulat/i` in the empty state; the Simulated sentence absent.
  - "operation 40 does not answer...": `failOnce('getEvidence')`; chip `unavailable`; empty state `data-source="unavailable"`, text "Media reference unavailable" only; no "simulat", no "No DEMO media", no "no DEMO package"; the existing offline toast once.
- `cf-web-custody-media.test.tsx` -> "O-RT-1: Simulated mode keeps its words": `data-source="simulated"`, the unchanged title and body (which still says "comes from the simulator"). `mediaUnavailable` changes nothing in Simulated mode.

Fails before: all 3 failed in `assets/12c_red_before_fix.log`. M2a below reproduces the pre-fix wording in Live and shows the text assertion itself catches it, not only the new attribute.

### Mutations (in memory)

| # | Mutation | Result |
|---|---|---|
| M2a | Live body = the Simulated sentence (the pre-fix wording) | 1 failed: "operation 40 answers NONE..." |
| M2b | unavailable reference treated as NONE | 1 failed: "operation 40 does not answer..." |
| M2c | detail page does not pass the media state | 1 failed: "operation 40 does not answer..." |
| M2d | mode inverted | 3 failed (Simulated + both Live) |

**4 / 4 caught.**

### Before / after on lane 3

No lane-3 item answers media `NONE`: all 14 join a DEMO package (`assets/12c_probe_inventory.log`). The R-W item EV-20261006-0014 is the Recording scenario's session, which joins package 0014 by design (`evidence-integrity.test.tsx:135-142`). The brief allows only 5178, so lane 2's EV-20261006-0017 was out of reach. The driver therefore rewrote the single answer of `GET /api/v1/evidence/EV-20261006-0014` **in its own browser only**: `media {source: DEMO_PACKAGE, packageSuffix: "0014"}` -> `{source: NONE, packageSuffix: null}`, the answer the Core gives a Live-recorded item (`apps/core-server/src/modules/evidence/media.ts`, `NO_MEDIA`). This is the exact client path of O-RT-1. For the unavailable variant (after only), the driver failed the same request. The Core was not touched. Both rewrites are listed in `12c_*_measurements.json` -> `rewrites`.

| | Before (13:43:07 WIB) | After (14:18 WIB) |
|---|---|---|
| Header chip | "Core record" (`core`) | "Core record" (`core`) |
| Media tab title | "No DEMO media" | "No DEMO media" |
| Media tab body | "This item has no DEMO package, so there is nothing to play. **Its record comes from the simulator.**" | "No DEMO package for this item: **the Core server's record only.**" |
| Operation 40 unavailable | not captured | chip "Media reference unavailable"; tab "Media reference unavailable", no body; toast "Core server unreachable. Nothing was changed." (existing presenter) |

Screenshots: `12c_before_ort1_media_tab_1440x900.png`, `12c_before_ort1_media_empty_1440x900.png`; `12c_after_ort1_media_tab_1440x900.png`, `12c_after_ort1_media_empty_1440x900.png`, `12c_after_ort1_media_unavailable_1440x900.png`.

## 4. Suite ledger

All commands ran in `apps/core-web` unless noted. Logs are in `gateway_check/assets/`.

| # | Time (WIB) | Command | Result |
|---|---|---|---|
| 1 | 13:54 | `npx vitest run src/features/evidence/__tests__/cf-web-custody-media.test.tsx src/test/live-cf-web-media.test.tsx` (before the fix) | **2 files failed, 8 tests failed** (`12c_red_before_fix.log`) |
| 2 | ~13:57 | same 2 files + `efix-integrity-metadata`, `live-evidence-verify`, `evidence-media`, `live-w0-evidence-words` | 6 files, 39 tests passed |
| 3 | ~14:10 | `cf-web-custody-media.test.tsx` with the new phone-width test, before its CSS | 3 failed, 4 passed (7) |
| 4 | ~14:11 | `cf-web-custody-media`, `live-cf-web-media`, `efix-integrity-metadata` | 3 files, 21 tests passed |
| 5 | 14:10-14:12 | mutation set on the final code (`12c_mutations.log`) | baseline 9 passed; **16 / 16 mutations caught**; 2 rechecks, tree hashes unchanged |
| 6 | 14:13 | `npm run typecheck` (`tsc -b`) | exit 0 (`12c_typecheck_lint.log`) |
| 7 | 14:13 | `npx oxlint --format default` (the `lint` script is `oxlint`) | "Found 0 warnings and 0 errors." on 488 files, exit 0 |
| 8 | 14:02:19-14:06:06 | `uptime` (11.62) then `npm run test -- --maxWorkers=2` | 111 files, 1,435 tests passed, exit 0. **Superseded**: the phone-width step changed code afterwards (`12c_full_suite_run1_superseded.log`) |
| 9 | 14:13:44-14:18:17 | `uptime` (12.01; 11.08 at start) then `npm run test -- --maxWorkers=2` on the final code | **111 files, 1,436 tests passed, exit 0**, 271.9 s; load at end 8.00 (`12c_full_suite.log`) |

The brief asked for the full suite once. Run 8 no longer described the final code after the phone-width change, so run 9 gives fresh evidence. The 1-minute load stayed under 14 throughout (checked with `uptime` before each run). The previous gate was FX-W2 with 109 files and 1,427 tests (D207). This row adds 2 files and 9 tests: 109 + 2 = 111 files, 1,427 + 9 = 1,436 tests.

## 5. State changes and side effects

- **Lane 3 Core:** 9 browser sessions from 13:41 to 14:19 WIB (probe, before, design probe, prototype, 4 scratch dry runs, final after), each a sign-in, GET reads and a sign-out `204`. Nothing else. No item, verification or custody entry changed.
- **Vite HMR:** the edits to `integrity-tab.tsx`, `media-tab.tsx`, `detail-page.tsx` and `evidence.css` hot-updated the evidence chunk on every core-web Vite server. That happens only where a page had loaded the evidence modules; they are component modules (Fast Refresh) and a stylesheet. No shared or root module was edited, so no forced full reload should have come from this row.
- **Browsers:** none of mine left (0 `cfw_profile_` dirs). A headless shell with profile `cf-m1-phone-w1-profile-*` was running; it belongs to CF-M1 and I did not touch it.
- **Files outside the tree:** drivers and scratch captures in this session's scratchpad. Rollback copies in `.cache/rollback/CF-W/`.

## 6. Observations (not fixed; for the controller)

- **O-CFW-1 (cosmetic, pre-existing):** when operation 40 does not answer, the header's still placeholder still says "No DEMO media" (`detail-page.tsx:203`). The chip beside it says "Media reference unavailable". The words are not wrong (no media is shown), and this was outside O-RT-1.
- **O-CFW-2:** at 1440x900 the 4-column table gives the Detail 112 px, so a 66-character reason takes 7 lines. It fits and every word is whole. Stacking applies only below 26rem of content; if a shorter row at 1440 is preferred, raising the query to about 28rem would stack 1440 too (prototype shown in §2).
- **O-CFW-3:** the shared Simulated sentence (`evidence.ts:182`) is unchanged and still correct for Simulated mode. A dedicated Live sentence can be added later without device runs in progress (D-CFW-2).

## 7. Decisions for the controller to record

- **D-CFW-1:** custody table layout. Fixed table layout with set column widths at every width, a `<wbr>` after each `_` of an action code, Detail under the action below 26rem of card content (the 1280 layout), actor under the action too below 20rem (phone). Headings hidden visually only. Evidence in §2.
- **D-CFW-2:** O-RT-1 reuses `evidence.live.noPackage` and `evidence.live.mediaUnavailable`. `packages/shared/src/i18n/en/evidence.ts` is not edited, to avoid HMR full reloads on four consoles and a Metro reload of the device apps during CF-M1's runs.
- **D-CFW-3:** the O-RT-1 before/after on lane 3 uses a browser-local rewrite of one operation-40 answer, because no lane-3 item answers `NONE`. The Core is untouched.
- **D-CFW-4:** the full suite ran twice. Run 1 was superseded by a code change; run 2 is on the final code.

## 8. Files of this row

Created:
- `apps/core-web/src/features/evidence/__tests__/cf-web-custody-media.test.tsx`
- `apps/core-web/src/test/live-cf-web-media.test.tsx`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/12c_cf_web.md` (this file)
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/cf_w_web.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/12c_*` (42 files: 24 PNG, 2 measurement JSON + design-probe and inventory JSON, logs, drivers as `.txt`, mutation harness)
- `.cache/rollback/CF-W/` (4 copies + `SHA256SUMS`)

Modified:
- `apps/core-web/src/features/evidence/integrity-tab.tsx`
- `apps/core-web/src/features/evidence/evidence.css`
- `apps/core-web/src/features/evidence/media-tab.tsx`
- `apps/core-web/src/features/evidence/detail-page.tsx`

Not modified: `packages/shared/src/i18n/en/evidence.ts` (D-CFW-2); no file under `apps/mobile/**`; no commit.
