---
row: CF-M2 (closing fix round CF, decision D214)
title: Five Low mobile screen defects from the re-test round (R-P-3, R-T-1, R-T-2, R-T-3, R-T-4)
date: 2026-10-06
agent: coder-execution
status: complete in code and jest; the tablet and phone pixels await the device re-test after CF
narrative_tier: 2
sources: decisions/decisions.md D212, D213, D204, D214; test/08c_retest_tablet.md (R-T-1..4); test/08b_retest_phone.md (R-P-3)
---

# 12b — Closing fix CF-M2: mobile screens

## 1. Result

| # | Defect | State | Files changed (all inside CF-M2's paths) | Proof |
|---|---|---|---|---|
| 1 | R-P-3: Settings > Device Settings stacks the Devices list over an open device detail; three Backs to Settings | **Fixed** | new `navigation/tab-root.ts`; `navigation/index.ts` (export); `features/settings/settings-screen.tsx`; `features/settings/settings-screen.test.tsx` (expectation of the old push replaced) | 5 route-tree tests (red before: 2 failed); mutants P1–P4 detected |
| 2 | R-T-1: disabled Archive item in the Evidence More menu has no visible title | **Fixed** (same pair also fixed in the list row menu) | new `features/evidence/menu-item-text.tsx`; `features/evidence/evidence-detail.tsx`; `features/evidence/evidence-row.tsx` | 3 tests; mutants M1–M4 detected |
| 3 | R-T-2: tablet Hash & Integrity heading always "Verified by the Core" | **Fixed** (phone and tablet: one component) | `features/evidence/evidence-model.ts`; `features/evidence/live-integrity-tab.tsx`; `features/evidence/i18n.ts`; `features/evidence/live-evidence-stored-verification.test.tsx` (new); `features/evidence/live-evidence-static.test.ts` (guard lists) | 7 tests; mutants I1–I6 detected |
| 4 | R-T-3: Network & Time "Bandwidth" label clipped by its chart on the tablet | **Fixed** | `features/network-time/network-status-card.tsx` | 4 tests; mutants N1–N4 detected |
| 5 | R-T-4: Sessions hub list column too narrow on the tablet | **Fixed** (phone row unchanged) | `features/sessions/sessions-screen.tsx`; `features/sessions/session-row.tsx` | 4 tests; mutants S1–S5 detected |

Verification (commands and output in §7):

- Typecheck: exit 0. Lint: exit 0.
- Mutation run, in memory: control 6 files and 34 tests pass. **23 of 23 mutants were detected.** The 10 tree files the mutants touch had the same hashes before and after.
- Full mobile suite, run 1: 165 suites, 1,857 tests, 2 failed. Both failures were the evidence folder's static guard, which lists every production file and every Live-only copy key. The guard did not know the new file and keys. Updated (§6).
- Full mobile suite, run 2: 165 suites, 1,857 tests, **1 failed: a 5 s timeout in `features/pairing/pairing-handoff-routes.test.tsx`**. That file is outside CF-M2's paths (CF-M1's pairing folder, an untracked file). It passed in run 1, and passed alone twice (20/20 both times). Every CF-M2 suite and the evidence static guard passed in run 2.

Rules held:

- No file outside CF-M2's paths was edited.
- No emulator, Metro, Vite, mock-core or server was touched. Nothing ran on *:5432.
- No commit was made. No file was deleted or renamed in the tree.
- The two full-suite logs this row wrote (21 MB each) were moved out of `/docs` to `.cache/cf_m2_mut/`. Trimmed summaries took their place. They were never part of the tree.
- No secret was printed. A count-only scan of every log and asset for the demo password constant found 0 hits. The scan read the constant inside a driver and printed counts only.
- `uptime` was checked before each heavy run. The mutation driver pauses while the load is above 14, and it paused once.

Rollback copies are in `.cache/rollback/CF-M2/`:

- 12 files, with `SHA256SUMS.pre.txt` and `SHA256SUMS.post.txt`.
- `NEW_FILES.sha256.txt` lists the 7 files this row created.

## 2. R-P-3 — Settings > Device Settings opens the Devices list at its root

- **What was found.** The System rows of Settings ran `router.push(href)`. The old line is at `features/settings/settings-screen.tsx:51` in the rollback copy. Here is what happens when the Devices tab still holds a pushed detail (`[list, detail]`):
  1. Expo Router 57 turns the push into a NAVIGATE on the tab navigator, because the tab navigator is not a stack (`node_modules/expo-router/build/global-state/getNavigationAction.js:51-56`).
  2. The NAVIGATE carries the nested params `{ screen: 'index' }`.
  3. The Devices stack receives a navigate to `index`. Its top route is the detail, so the StackRouter pushes a new list (`react-navigation/routers/StackRouter.js:177-251`): `[list, detail, list]`.
  4. Back then shows the old detail, a second Back the list, and a third Back reaches Settings.

  This is exactly what the phone re-test saw (`45_…`, `38_…`, `39_…`).
- **Why it matters.** Settings is reached from More on the phone. Leaving a detail open in the Devices tab is the normal case after looking at a camera.
- **The change.** A new `navigation/tab-root.ts` adds `useOpenTabRoot()`:
  - It finds the nearest `tab` navigator above the calling screen, through the screen's own navigation object (`findTabNavigation`, `:38`).
  - It dispatches `{ type: 'JUMP_TO', payload: { name, resetOnFocus: true } }` (`:64`). This is the action the kit's tab trigger sends with its documented `resetOnFocus` option (`expo-router/ui` `useTabTrigger().switchTab`, `SwitchToOptions`: "Navigate and reset the history on route focus").
  - The kit's `ExpoTabRouter` handles it by dropping the tab's nested state (`ui/TabRouter.js`). The Devices stack starts again from its list.
  - The tab history (`backBehavior="history"`) records the jump, so one Back returns to Settings.
  - Settings now uses the hook for its three route rows (`settings-screen.tsx:55-56`).
  - When no tab navigator is found (a feature bed without the tab layout), the hook logs `warn` `navigation.tabRoot.open` through the shell's structured log and falls back to `router.navigate`. A dispatch error is logged as `error` and also falls back.
  - The trigger hook itself was not used because it throws outside a `<Navigator>`. The live settings bed mounts Settings without the tab layout.
- **Tests.** The new file is `navigation/__tests__/settings-tab-root.test.tsx`. It runs on the real route tree (router harness).
  - Phone with Camera 1 left open: the row shows the list (no `screen-device-detail`), and **one** `router.back()` returns to `/settings`. No warn or error navigation record is written.
  - Phone without a detail behaves as before.
  - After the reset, a detail opened later pops back to the list, then to Settings.
  - Tablet with `?selected=CAM-01`: the list opens without the selection, and one Back returns to Settings.
  - Storage Management and Network & Time: one Back to Settings.
  - `settings-screen.test.tsx` mocks the hook, and now expects `/devices`, `/storage` and `/network-time` through it. The old expectation encoded the defect.
- **Before the fix** (run against the unfixed code): 2 failed, 3 passed. The first failure: `Expected: "/settings" Received: "/devices/CAM-01"`. The tablet case already passed before the fix. There the stack's top route is the list itself, so the NAVIGATE re-uses it (`StackRouter.js:190-192`). R-P-3 was a phone (single-pane) defect. The tablet test stays as a guard.
- **Mutation.** All four mutants were detected:
  - P1: the old `router.push`.
  - P2: `resetOnFocus: false`.
  - P3: `router.navigate` instead of the jump.
  - P4: the tab navigator is never found.

## 3. R-T-1 — the disabled Archive item keeps its title

- **What was found.** `Menu.Item` lays out its children in a row: `.menu__item { flex-direction: row }` (`node_modules/heroui-native/src/styles/components/menu.css`). `Menu.ItemTitle` has `flex: 1`, which in React Native means a zero basis. The disabled item had a `Menu.ItemDescription` as a second child (`evidence-detail.tsx:344-345` in the rollback copy). That description took its full text width, and the title was squeezed to nothing. This matches the tablet capture `misc/p07e_more_menu_crop_brightened.png`, where the title area is flat with no glyph.

  The list row menu had the same pair for Export and Archive (`evidence-row.tsx:124-125`, `:133-134` in the rollback copy). The kit documents the fix: an item with a description wraps both texts in a `flex-1` View (`heroui-native/src/components/menu/menu.md`, "With Item Descriptions"). Start Session's profile menu already does this (`session-new-header.tsx:62-68`, the "surrounding pattern").
- **The change.** A new `features/evidence/menu-item-text.tsx` holds `MenuItemText`: title and optional description in one `flex: 1` column. The title keeps the item's danger variant through the item's context. It is used for the detail's Archive item (`evidence-detail.tsx:346`) and the row menu's Export and Archive items (`evidence-row.tsx:126`, `:138`). The copy did not change.
- **Tests.** The new file is `features/evidence/evidence-more-menu-title.test.tsx`. It uses the Simulated harness with the real kit menu.
  - INVESTIGATOR in the detail's More menu: "Archive" and its reason share one column of their own (flex 1, not a row, inside the item), and a press opens no dialog.
  - INVESTIGATOR in the row menu: the same structure.
  - SUPERVISOR: Archive shows its title without a reason, and still opens the dialog.
  - Jest has no layout engine, so the test proves the structure that decides the layout. The device re-test confirms the pixels.
- **Mutation.** All four mutants were detected:
  - M1: the old detail item (rollback copy).
  - M2: the old row menu (rollback copy).
  - M3: the column without flex.
  - M4: no column.

## 4. R-T-2 — the Live Hash & Integrity card reads the Core's stored verification

- **What was found.**
  - The heading was the fixed key `features.evidence.integrity.verifiedByCore` (`live-integrity-tab.tsx:133-135` in the rollback copy).
  - The view model `coreIntegrityView` reads only a verdict given on this screen (`evidence-model.ts:349`, unchanged). It never reads the item's `verification`.
  - So EV-20261006-0017, whose Core record says `NOT_RUN`, read "Verified by the Core" (`J28_tablet_evidence_hash_integrity.png`).
  - The web reads the record since E2E-W1-3 (`apps/core-web/src/features/evidence/model.ts:134-160` `storedVerification`, `integrity-tab.tsx:44-67`, `:105-114`; read only).
- **The change.**
  - **Model** (`evidence-model.ts:375-428`):
    - `storedVerification(item)` follows the web's rule. It returns the verdict, its time, and the actor of the custody entry of that verdict at that instant. If no entry has that instant, it uses the latest entry of that verdict. It returns null for `NOT_RUN`.
    - It is written without `Array.prototype.findLast`, so nothing depends on the device's JS engine having it.
    - `coreVerificationState(stored, revealed)`: this screen's revealed verdict wins, then the record, then `NOT_RUN`.
    - `CORE_HEADING_KEYS` maps PASS to "Verified by the Core", FAIL to "Verification failed on the Core", and NOT_RUN to "Not verified yet".
  - **Tab** (`live-integrity-tab.tsx`):
    - The heading follows that state (`:158`, `:166-167`, testID `evidence-integrity-heading-<state>`).
    - When the record holds a verification, a line under the note reads "Last verification PASS · 6 Oct 2026 12:47:58 UTC+07:00 · AKP …". It uses the web's shared keys `evidence.verify.last.*` and `common.verificationStatus.*`, and the shared formatter with its zone (`lastVerificationLine`, `:246`).
    - Then comes the shared hint "Verify again to see each check." (`:194`), and the button says "Verify again".
    - With nothing stored, a new caption reads "The Core holds no verification of this item yet. Verify asks the Core now." (`:199`). It keeps the `evidence-verdict-pending` testID that the existing tests use.
    - **A new Verify updates it, but only after its paced reveal.** The replica's delta arrives before the answer (CL-16). Without care, the heading would turn to PASS during "Asking the Core…". So the card pins the record as it was when the run started (`:91-93`), and unpins it when the verdict is revealed or when there is none.
  - **Copy:** three Live-only keys in `features/evidence/i18n.ts:157-159`. No Simulated copy changed.
  - The Simulated `IntegrityTab` is unchanged: its heading is the DEMO package's precomputed verdict by decision D51.
- **Phone and tablet.** The detail renders `LiveIntegrityTab` in Live mode on both (`evidence-detail.tsx:283-290`). The tests run each case on `phonePortrait` (detail screen) and `tabletLandscape` (detail pane).
- **Tests.** The new file is `features/evidence/live-evidence-stored-verification.test.tsx`. It uses the app's real Live source over the contract-checked fake transport.
  - A unit test checks the model against the web's rule, including a later VERIFIED by another operator.
  - On each window:
    - **NOT_RUN** shows "Not verified yet" and no line. During "Asking" the replica already holds PASS, yet the card still shows NOT_RUN. After the reveal it shows "Verified by the Core" and the exact line with the run's time and operator.
    - **A PASS the Core holds** (set on the Core's engine before sign-in) shows "Verified by the Core", the exact line, the hint, "Verify again", and no screen verdict.
    - **A FAIL the Core holds** (tamper, then verify) shows "Verification failed on the Core" and its line. A new Verify one Core-minute later keeps FAIL and moves the line to the new run.
  - The existing `live-evidence-verify.test.tsx` (outage, 404, tablet kebab) passed in both full runs.
- **Mutation.** All six mutants were detected:
  - I1: the old tab (rollback copy).
  - I2: the heading ignores the record.
  - I3: no pinning.
  - I4: the actor taken from the latest entry.
  - I5: FAIL headed "Verified by the Core".
  - I6: the line without time and operator.

## 5. R-T-3 — the Bandwidth label keeps its room

- **What was found.** On the tablet the Network Status card is one of three panes, about 290 dp wide.
  - Width: the tablet capture `P12_network_time.png` is 2560 px wide at 2 px per dp. The card spans about 644 px, so about 322 dp. Minus the card padding, the list row is about 290 dp.
  - Need: the one-line row needs the item padding (2 × 16), the icon (36), two gaps (12 each), "Bandwidth" (about 72 dp), the bars at their 56 dp minimum, a 10 dp gap and the readout (about 84 dp). That is 314 dp.
  - Result: the suffix row is right-aligned (`justifyContent: 'flex-end'`, `network-status-card.tsx:152` in the rollback copy), so it overflowed to the LEFT, over the end of the label: "Bandwidt".
  - The phone row is about 348 dp (`31_network_time.png`: 71.5 dp label, 83.6 dp readout), so it fits.
- **The change** (`network-status-card.tsx`):
  - `BANDWIDTH_ROW_METRICS` and `bandwidthInlineMinWidth(fontScale)` (`:40-58`) compute the one-line need. They use the kit's padding and gap, the shared icon and chart constants, and the two text widths read off the capture. The text widths are scaled by the system font scale, capped at the texts' `maxFontSizeMultiplier` of 1.2.
  - The row measures itself (`onLayout`, `:154`).
  - When the row is narrower than that need (`:134`), the label sits on its own line with the sparkline under it in the content column (`:161`, the bars in their own row so their `flex: 1` sizes the width). The readout keeps the right side.
  - Before the first layout, multi-pane windows start stacked, so the tablet never draws the overlapping frame.
  - A phone at font scale 1 keeps the MB 9 one-line row.
- **Tests.** The new file is `features/network-time/bandwidth-row-fit.test.tsx`.
  - Budget: 314 dp is above 290 and at most 348. Scales below 1 and above 1.2 count as 1 and 1.2.
  - Tablet: stacked before the first layout and at 290 dp.
  - Phone: inline before the first layout and at 348 dp.
  - A 297 dp row (a 360 dp phone) stacks, and a 420 dp row goes back to one line.
  - The existing `network-time-screen.test.tsx` and `live-network-time.test.tsx` pass.
- **Mutation.** All four mutants were detected:
  - N1: the old card (rollback copy).
  - N2: never stacked.
  - N3: the budget forgets the readout.
  - N4: stacked but the bars stay beside the readout.

## 6. R-T-4 — every value of a Sessions row fits on one line in a list pane

- **What was found.** The expanded layout splits filters 280 dp | list flex 2 | detail flex 3 (`sessions-screen.tsx:100` in the rollback copy).
  - List width: at 1280 dp with the 232 dp extended rail, after the 12 dp padding and two 24 dp gaps, the list is 40% of 708 dp, about 283 dp.
  - Row width: the row kept the phone's 88 dp poster (`session-row.tsx:149` in the rollback copy). After the list padding (2 × 12), the card padding (2 × 10), the poster, two 12 dp gaps and the 70 dp "Sealed" chip, the text column is about 57 dp. The chip width is read off `P04_sessions_hub.png`.
  - Result: "Tersangka" wrapped on three lines, "00:01:" / "23" on two, and the ID and date were cut.
- **The change.**
  - `sessions-screen.tsx:71-80`, `:110`: the expanded list is 40% but at least `LIST_MIN_WIDTH` = 360 dp, the medium list width. The detail pane takes the rest: about 348 dp with the extended rail, about 492 dp with the rail collapsed.
  - `session-row.tsx`, in a list pane only (`isMultiPane`):
    - a 64 × 50 dp poster (`PANE_ROW`, `:53`, `:168`);
    - the chip line may wrap between chip and duration, never inside a value (`:112`, `:190`);
    - the duration is held to one line (`:121`, `:155`).
    - The phone row (`PHONE_ROW`, 88 × 68, 12 dp gap) is unchanged.
  - With 360 dp the text column is 158 dp. That holds the ID "SES-20261006-0017" (132.6 dp, mono 13 at 0.6 em) and chip + gap + duration (76 + 8 + 57.6 = 141.6 dp; the 76 dp chip is an estimate, labelled in the test).
- **Tests.** The new file is `features/sessions/hub-pane-row-fit.test.tsx`.
  - Budget: the old pane gives a text column under 60 dp. The new one holds the ID and the chip line.
  - Expanded: `pane-list` has `minWidth` 360 and flex 2, and rows use the pane poster, the wrapping chip line and a one-line duration and ID.
  - Medium: the 360 dp list with the pane rows.
  - Phone: 88 × 68 poster, no wrap, no line cap, no panes.
  - The existing sessions suites pass (4 files, 34 tests).
- **Mutation.** All five mutants were detected:
  - S1: no minimum.
  - S2: the pane keeps the phone poster.
  - S3: no wrap.
  - S4: the phone takes the pane poster.
  - S5: the pane poster back at 88 dp.
- **To check on the device:**
  - the 348 dp detail pane at 1280 dp with the extended rail;
  - a row that also carries the "Summary pending" chip. Its trailing column is wider (about 120 dp), so its ID can still end in an ellipsis. That is unavoidable in that row unless the trailing column changes.

### Static guard update

`features/evidence/live-evidence-static.test.ts` lists every production file of the folder and the Live-only copy keys. That is how it proves that every file is scanned, and that the Simulated copy is still the copy of `acaff20` (185 texts, same digest).

- `menu-item-text.tsx` joins the file list.
- The three Live keys join `LIVE_KEYS`.
- The Simulated digest is unchanged, and the Live keys contain no "simulat".

## 7. Commands and output (suite ledger)

| What | Command | Result |
|---|---|---|
| R-P-3 red (before the fix) | `npx jest src/navigation/__tests__/settings-tab-root.test.tsx` | 2 failed, 3 passed; `Expected: "/settings" Received: "/devices/CAM-01"` and `"/devices/CAM-02"` |
| R-P-3 + settings | `npx jest src/navigation/__tests__/settings-tab-root.test.tsx src/features/settings/settings-screen.test.tsx` | 2 suites, 16 tests pass |
| R-T-2 | `npx jest src/features/evidence/live-evidence-stored-verification.test.tsx --silent` | 1 suite, 7 tests pass |
| R-T-1 | `npx jest src/features/evidence/evidence-more-menu-title.test.tsx --silent` | 1 suite, 3 tests pass |
| R-T-3 + neighbours | `npx jest src/features/network-time/bandwidth-row-fit.test.tsx …network-time-screen.test.tsx …live-network-time.test.tsx --silent` | 3 suites, 19 tests pass |
| R-T-4 + neighbours | `npx jest src/features/sessions --silent` | 4 suites, 34 tests pass |
| Static guard | `npx jest src/features/evidence/live-evidence-static.test.ts --silent` | 12 tests pass |
| Typecheck + lint | `npm run typecheck`; `npm run lint` | `TYPECHECK_EXIT=0`, `LINT_EXIT=0` (`assets/12b_cf_m2_typecheck_lint.log`) |
| Mutations, in memory | `python3 .cache/cf_m2_mut/mutate.py control`, then `P M`, then `I N S` | control 6 files / 34 tests, exit 0. **23 of 23 detected.** Tree files unchanged (10 checked) (`assets/12b_cf_m2_mutations.log`; driver `assets/12b_cf_m2_mutate.py.txt`; transformer `assets/12b_cf_m2_mutating_transformer.cjs.txt`; config `assets/12b_cf_m2_jest_mut_config.cjs.txt`) |
| Full suite, run 1 (14:07, load 7-9) | `npm run test -- --maxWorkers=2` | exit 1 in 223 s; 165 suites (164 passed), 1,857 tests (1,855 passed). 2 failed in `live-evidence-static.test.ts` (the file list and the 185-text count did not know `menu-item-text.tsx` and the 3 Live keys); fixed in §6 (`assets/12b_cf_m2_full_suite_run1.txt`) |
| Full suite, run 2 (14:11, load 9-11) | same | exit 1 in 261 s; 165 suites (164 passed), 1,857 tests (1,856 passed). 1 failed: `pairing-handoff-routes.test.tsx` › "the re-pair after a revocation (step 6)" `Exceeded timeout of 5000 ms` (`assets/12b_cf_m2_full_suite_run2.txt`) |
| That pairing file alone, twice (load 10-11) | `npx jest src/features/pairing/pairing-handoff-routes.test.tsx --silent` | 20 passed, 20 total, both times; it also passed in run 1 |
| Secret scan | python driver: count of the demo password constant in every log and asset, counts only | 0 hits in all 9 files |

## 8. Observations for the controller (not changed)

- **O-CF-M2-1.** Export wizard, Live source check (`features/evidence/export-sheet.tsx:529`): the Alert under a Core **FAIL** still has the description "Verified by the Core · Core record". It is the same key that R-T-2 fixed in the card. It is not one of the re-test defects, so it was left as it is.
- **O-CF-M2-2.** `features/pairing/pairing-handoff-routes.test.tsx` (CF-M1's path, untracked) has a test that uses the default 5 s jest timeout. Under the shared load of the run (about 11) it timed out once.
