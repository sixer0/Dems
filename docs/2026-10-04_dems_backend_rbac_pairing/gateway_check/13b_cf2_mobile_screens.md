---
row: CF2-B (second closing round CF2, decisions D227, D232, D233)
title: Three mobile screen defects from the final tablet re-test (RF-T-1, RF-T-2, RF-T-5)
date: 2026-10-06
agent: coder-execution
status: complete — fixed in code, jest (fail before / pass after, 19 of 19 in-memory mutants caught) and on the tablet (2 runs + 1 verification per defect)
narrative_tier: 2
sources: decisions/decisions.md D208, D216, D227, D232, D233; test/10b_final_retest_tablet.md (RF-T-1, RF-T-2, RF-T-5); gateway_check/12b_cf_mobile_screens.md
device: dems2_tablet = emulator-5556 only (lane 2), Core 4422, LIVE, operator budi.santoso (INVESTIGATOR)
---

# 13b — Closing fix CF2-B: mobile screens

## 1. Result

| # | Defect | State | Cause (file:line, before the fix) | Change | Jest | Device |
|---|---|---|---|---|---|---|
| 1 | **RF-T-1** (Medium) the Evidence row that loses the selection is drawn as an empty card | **Fixed.** The same defect was found in the Sessions hub rows and fixed there too | Two things changed inside the row on deselection: the `GlowLayer` (3 Reanimated views) was removed in place (`features/evidence/evidence-row.tsx:42`), and the kit `Card` lost its 1 dp border (`evidence-row.tsx:51` + `:154`, `cardSelected: { borderColor, borderWidth: 1 }`). The device showed the border is the trigger (§2.3); the native mechanism is a hypothesis | New `features/evidence/selection-glow.tsx`: `SelectionGlow` (always mounted, last child, plain `View`, opacity set by React) and `ROW_CARD_BORDER` (1 dp in both states, only the colour changes). Used by `evidence-row.tsx` and `sessions/session-row.tsx` | `evidence-row-deselect-drawn.test.tsx` (4), `session-row-deselect-drawn.test.tsx` (1); mutants R1–R11 caught | Before: 2/2 empty (Evidence), 1/1 (Sessions). Run 1 (glow only): **still empty**. Run 2 (glow + border): drawn. Verification: drawn, also after scrolling |
| 2 | **RF-T-2** (Medium) Sessions hub detail pane squeezed to about 206 dp | **Fixed** | `features/sessions/sessions-screen.tsx:110` (CF-M2): list `flex: 2, minWidth: 360` on a zero basis beside a `flex: 3` detail. Yoga raises the basis to the minimum, then still gives the list 2/5 of the rest: 360 + 0.4 × 344 = 497.6 dp, detail 206.4 dp | Each pane starts at the width it needs and only the extra is split 2 : 3: list `{ flexGrow: 2, flexShrink: 1, flexBasis: 360 }`, detail `{ flexGrow: 3, flexShrink: 1, flexBasis: 340 }` (`LIST_PANE_FLEX`, `DETAIL_PANE_FLEX`). Medium layout unchanged | `hub-pane-split.test.tsx` (3, with a Yoga model calibrated on the device); `hub-pane-row-fit.test.tsx` updated; mutants S1–S5 caught | Before: 995 \| 413 px = 497.5 \| 206.5 dp. After: 723 \| 685 px = **361.5 \| 342.5 dp**, every label and value on one line (run 1, run 2, verification) |
| 3 | **RF-T-5** (Low) Network & Time: "Last Sync" shows only the date, "Time Source" ellipsised | **Fixed** | `features/network-time/time-sync-card.tsx:113-121`: every value `numberOfLines={1}` in a 133.5 dp (Last Sync) and 114.5 dp (Time Source) box | No line cap; values wrap between words, right-aligned (`textAlign: 'right'`) | `time-sync-fit.test.tsx` (4); mutants T1–T3 caught | Before: "6 Oct 2026" / "GPS (GNSS Str…". After: "6 Oct 2026" over the time, "GPS (GNSS" over "Stratum-1)" (run 1, run 2, verification) |

Verification summary (outputs in §5):

- Typecheck exit 0, lint exit 0 (`assets/13b_typecheck_lint.log`).
- In-memory mutation run: control 5 files / 16 tests pass; **19 of 19 mutants caught**; the 5 tree files the mutants touch had the same hashes before and after (`assets/13b_mutations.log`).
- Full mobile suite, once (`--maxWorkers=2`, load 5.7 at start): 180 suites, 1,929 tests, **1 failed**: the Evidence folder's static guard `live-evidence-static.test.ts` lists every production file and did not know the new `selection-glow.tsx`. The list was updated (§3). The three touched feature folders were then run again: **24 suites / 166 tests pass** (`assets/13b_full_suite.txt`, `assets/13b_targeted_after_static_fix.txt`).
- Device: 0 crash-class lines; the tablet ends LIVE, signed out, on Login (`assets/13b_end_signed_out_login.png`).

## 2. RF-T-1 — the row that loses the selection

### 2.1 Reproduction before the fix (same bundle as the final re-test)

Device times (driver events, `assets/13b_driver_events.log`):

| Step | Capture | Finding |
|---|---|---|
| Evidence, select EV-…-0018, then EV-…-0017 (20:46:56, 20:47:00) | `13b_rft1_before_evidence_0018_row_empty.png` (q/009) | EV-0018 drawn as an empty card. The node is in the tree with its bounds (`evidence-row-EV-20261006-0018` [496,824][1238,1028], `13b_device_id_dumps.txt` block `b_evidence_deselected`) |
| Select EV-…-0019 (20:47:22) | `13b_rft1_before_evidence_two_rows_empty.png` (q/011) | EV-0018 still empty, EV-0017 empty too |
| Sessions hub, select SES-…-0027, then SES-…-0028 (20:48:18, 20:48:31) | `13b_rft1_before_sessions_row_empty.png` (q/015) | **The Sessions hub has the same defect**: SES-0027 is an empty card. (The re-test only reported it for Evidence.) |
| Devices, select Camera 1, then Camera 2 (20:49:19, 20:49:22) | `13b_devices_rows_deselect_ok_untouched.png` (q/019) | Device rows are fine: Camera 1 is drawn after deselection. Its row is not a kit `Card` in a FlashList; **not changed** |

### 2.2 What changes inside a row on deselection (old code)

- `evidence-row.tsx:42`: `{selected ? <GlowLayer … /> : null}` — the first child of the row, three Reanimated `Animated.View`s, removed in place.
- `evidence-row.tsx:51` and `:154`: the kit `Card` style went from `{ borderColor: gold, borderWidth: 1 }` to no border. The kit `Card` is a `Surface` (`node_modules/heroui-native/src/styles/components/surface.css`: `overflow: hidden`, a corner radius, `box-shadow`). Removing the border changes the card's border insets, the 1 dp position of the content, and the padding-box clip of its children (React Native Android clips an `overflow: hidden` view to its padding box, `ReactAndroid/.../uimanager/BackgroundStyleApplicator.kt:512-534`).
- `session-row.tsx:65` and `:81` + `:165`: the same two changes.

### 2.3 Device runs (D232/D233: 2 runs + 1 verification)

| Run | Code on the device | Steps | Result |
|---|---|---|---|
| Run 1 (20:57:49 relaunch, 20:58:25 sign-in) | `SelectionGlow` only: glow always mounted, plain view; card border still selected-only | Evidence: select 0018, then 0017 (20:59:01, 20:59:05) | **FAIL: EV-0018 still an empty card** (`13b_rft1_run1_glow_only_still_empty.png`, q/026). The dump shows the new glow (`evidence-row-glow-…-0017` with no `-e2` child), so the new bundle was running. **The hypothesis of the re-test (the glow removal) was not the cause on its own** |
| Change | `ROW_CARD_BORDER`: the card keeps a 1 dp border in both states, transparent when not selected, gold when selected | — | — |
| Run 2 (21:01:01 relaunch, 21:01:50 sign-in) | `SelectionGlow` + constant border | Evidence: select 0018, then 0017, then 0019 (21:02:16, 21:02:20, 21:02:34). Sessions: select 0027, then 0028 (21:03:03, 21:03:07) | **PASS**: EV-0018 and EV-0017 drawn after losing the selection (`13b_rft1_run2_evidence_0018_drawn.png`, `13b_rft1_run2_evidence_0017_drawn.png`); SES-0027 drawn (`13b_rft2_run1_sessions_panes.png`) |
| Verification | same | Evidence: select 0020, then 0016, scroll down and back (21:04:13–21:04:27). Sessions: select 0030, then 0026 (21:04:49, 21:04:53) | **PASS**: 0020 drawn, still drawn after scrolling (`13b_rft1_verification_after_scroll.png`: after selection, scrolled, scrolled back); SES-0030 drawn (`13b_rft2_run2_sessions_panes.png`) |

Conclusion: on this tablet the border change of the kit `Card` on deselection is what leaves the card empty; with it constant, the row draws. **Why** Android then stops drawing the children is a hypothesis (a stale padding-box clip of an `overflow: hidden` view with a `boxShadow` when its border insets change); it was not traced in React Native's source. The glow change stays: it is the D208 pattern (no in-place removal, final state drawn by React) and removes the Reanimated views from every row.

### 2.4 Tests

`features/evidence/evidence-row-deselect-drawn.test.tsx` (tablet landscape, real route tree; every `useAnimatedStyle` frozen at its first render, the model of FX-M2b's `chrome-lost-updates.test.tsx`):

1. A selection change mounts or removes nothing inside a row: the row's host children are `[evidence-row-<id>, evidence-row-glow-<id>]` before, while and after selection.
2. A selection change is a border colour change only: the card's flattened style without `borderColor` is equal in all three states, `borderWidth` 1, colour `transparent` / gold / `transparent`.
3. With every animation update lost: every text of the deselected row has effective opacity 1, its glow opacity 0; the new row's glow 1; the glow is one plain view (no children), `collapsable={false}`, `pointerEvents="none"`, hidden from TalkBack, with a `boxShadow`.
4. `selectionGlowOpacity`.

`features/sessions/session-row-deselect-drawn.test.tsx`: the same checks for the Sessions hub rows.

Shared helpers: new `features/evidence/testing/row-tree.ts`.

## 3. RF-T-2 — Sessions hub panes

### 3.1 Cause

Device before the fix (`13b_device_id_dumps.txt`, block `b_sessions_selected`): `pane-filters` [464..1024], `pane-list` [1072..2067], `pane-detail` [2115..2528] px at 2 px/dp. List + detail space: (2528 − 464) / 2 − 280 − 2 × 24 = **704 dp**. The list got 497.5 dp, the detail 206.5 dp.

React Native's Yoga (`node_modules/react-native/ReactCommon/yoga/yoga/algorithm/CalculateLayout.cpp`, `distributeFreeSpaceFirstPass` from line 853 and `distributeFreeSpaceSecondPass` from line 654) bounds each basis by its min first (`boundAxisWithinMinAndMax(computedFlexBasis)`), then adds `remainingFreeSpace / totalFlexGrowFactors × flexGrow`. With basis 0 → 360 for the list: remaining = 704 − 360 = 344; list 360 + 344 × 2/5 = 497.6; detail 344 × 3/5 = 206.4. That is the device measurement to 0.1 dp.

### 3.2 Change (`features/sessions/sessions-screen.tsx`)

- `LIST_PANE_FLEX = { flexGrow: 2, flexShrink: 1, flexBasis: 360 }`, `DETAIL_PANE_FLEX = { flexGrow: 3, flexShrink: 1, flexBasis: 340 }` for the expanded layout. No minimum left for Yoga to raise.
- Medium (tablet portrait) unchanged: list `width: 360`, detail takes the rest.
- Model results: tablet with extended rail 361.6 | 342.4 dp; rail collapsed 422.4 | 433.6 dp; a 1,000 dp window shrinks both in proportion 360 : 340.

### 3.3 Device

| Run | Panes (uiautomator bounds) | Detail pane |
|---|---|---|
| Run 1 (21:02:54, 21:03:10) | `pane-list` [1072..1795] = 361.5 dp, `pane-detail` [1843..2528] = 342.5 dp | SES-0028: every label and value on one line, the subject name drawn ("Uji Satu" + chip); scrolled to the end, Duration, Size and Evidence ID on one line each (`13b_rft2_run1_sessions_panes.png`, `13b_rft2_run1_detail_scrolled.png`) |
| Run 2 (21:04:56) | same bounds | SES-0026: the subject "Dewi Lestari" wraps between its two words beside the chip (the field allows 2 lines); labels on one line (`13b_rft2_run2_sessions_panes.png`) |
| Verification (21:05:38, after visiting Devices) | same bounds | SES-0029, all one line (`13b_rft2_rft5_verification.png`, left) |

The list rows keep every value on one line at 361.5 dp (all captures above).

### 3.4 Tests

`features/sessions/hub-pane-split.test.tsx`: `yogaRow` follows Yoga's two passes for one line (grow, shrink, basis, min) and `itemFromStyle` applies React Native's non-web defaults. (1) Fed CF-M2's styles at 704 dp it gives 497.5 | 206.5 dp (the device). (2) The **rendered** `pane-list` / `pane-detail` styles (read from the tree, not the constants) have no minimum and give list ≥ 360, detail ≥ 340, sum 704; with the rail collapsed the extra splits 2 : 3; a narrower row shrinks both in proportion. (3) Medium: list 360 fixed, detail basis 0 grow 1. `hub-pane-row-fit.test.tsx` (CF-M2) expectation updated from `minWidth 360, flex 2` to `flexBasis 360, flexGrow 2`.

## 4. RF-T-5 — Network & Time values

Before (`13b_rft5_before_network_time_card.png`, dump block `b_network_time`): `network-time-last-sync-value` "6 Oct 2026 20:48:42" in [2197..2464] px = 133.5 dp, only "6 Oct 2026" drawn; `network-time-source-value` "GPS (GNSS Stratum-1)" in [2235..2464] = 114.5 dp, drawn "GPS (GNSS Str…".

Change (`features/network-time/time-sync-card.tsx`): the three values have no `numberOfLines`, and `factValue` gets `textAlign: 'right'`. Labels keep their one line.

Device: run 1 (21:03:42) and run 2 (21:05:14) show "6 Oct 2026" over the time and "GPS (GNSS" over "Stratum-1)", right-aligned, Server on one line (`13b_rft5_run1_network_time_card.png`, `13b_rft5_run2_network_time_card.png`); verification 21:05:44 (`13b_rft2_rft5_verification.png`, right). The uiautomator dump timed out on this screen in the after-runs (12 s), so the after-proof is the pixels.

Tests: `features/network-time/time-sync-fit.test.tsx` — the budget (19 mono characters × 7.8 dp = 148.2 > 133.5 dp; "6 Oct 2026" 78 dp and the time 62.4 dp fit) and, on tablet landscape, tablet portrait and phone portrait, no line cap, no ellipsis, right-aligned, the whole text in the node. The phone pixels were not checked (lane 2 is the tablet only); on the phone the values are expected to stay on one line where they fit.

## 5. Commands and output

| Check | Command | Output |
|---|---|---|
| Typecheck | `npx tsc --noEmit` (apps/mobile) | exit 0 |
| Lint | `npx eslint .` (apps/mobile) | exit 0 (one `array-type` warning in the new helper fixed before) |
| New and updated suites | `npx jest` on the 6 files | `evidence-row-deselect-drawn` 4, `session-row-deselect-drawn` 1, `hub-pane-split` 3, `hub-pane-row-fit` 4, `time-sync-fit` 4: all pass |
| Fail before | the same tests against the rollback copies, in memory (mutants R1, R2, S1, T1) | R1: 3 of 5 failed; R2: 1 of 5; S1: 3 of 7; T1: 3 of 4 |
| Mutations | `python3 .cache/cf2_b_mut/mutate.py control`, then `R S T` (transformer `13b_mutating_transformer.cjs.txt`, config `13b_jest_mut_config.cjs.txt`, driver `13b_mutate.py.txt`, R6 mutant `13b_mutant_selection_glow_reanimated.tsx.txt`) | control 5 files / 16 tests exit 0; **19 of 19 detected**: R1 old Evidence row, R2 old Sessions row, R3/R4 glow mounted only while selected, R5 glow before the content, R6 glow back on Reanimated `GlowLayer`, R7 glow ignores the selection, R8 glow may be flattened, R9/R10 border only while selected (the run-1 device state), R11 no border width; S1 old hub, S2 zero basis + 360 minimum, S3 detail basis 0, S4 detail start 200, S5 medium detail with the expanded flex; T1 old card, T2 two-line cap, T3 not right-aligned. Tree files unchanged (5 checked) |
| Full mobile suite (once) | `npx jest --maxWorkers=2 --silent` (21:07:57–21:11:46, load 5.7 → 9.4) | 180 suites, 1,929 tests: 1,928 pass, **1 failed** — `live-evidence-static.test.ts` "reads the folder" (the new `selection-glow.tsx` not in its list) |
| After the static list fix | `npx jest --maxWorkers=2 --silent src/features/evidence src/features/sessions src/features/network-time` | **24 suites / 166 tests pass**, exit 0 |
| Crash scan | driver verb `crash` since 20:44:30 (`13b_crash_scan.txt`) | 0 lines of FATAL / addViewAt / Tried to remove view / handleHostException / reactInstance is null / IndexOutOfBounds. 70 `AndroidRuntime` lines belong to the uiautomator process. 2,459 Reanimated `SurfaceMountingManager` warnings, all at screen changes (sign-in 21:01:51–52, biometric offer + tab 21:02:12–13, sign-out 21:06:47–48, relaunch 20:58), none in the selection minutes |

## 6. Rules held, deviations

Held: only paths in `apps/mobile/src/features/{evidence,sessions,network-time}`; rollback copies of every pre-existing file before its edit in `.cache/rollback/CF2-B/` with `SHA256SUMS` (9 files); tablet emulator-5556 only; no PIN, lock, fingerprint, locksettings, `adb emu finger` or device settings; the biometric offer answered "Not now" both times; no `device-session.sh`, no `adb reverse` change; servers, Metro, Vite, mock-core and emulators untouched (the app itself was force-stopped and started twice to load the new bundle, as FX-M2b's D208 asks); `/` never launched with `motion=`; no commit; no file deleted. The password was typed only by the driver from the dataset constant into an IME password field and never printed (secret scan in the progress file).

Deviations:

- **D-CF2-B-1 — one uiautomator dump on Home** (q/004, 20:45:31). The rail tap to Evidence at 20:45:28 did not take (Choreographer skipped 38 frames at 20:45:22) and the dump was sent in the same command without checking the screen first. It holds ids, texts and bounds of Home (no field values of Login). From then on every dump followed a capture of the screen.
- **D-CF2-B-2 — first capture after the first sign-in at 1.8–2.4 s.** The password command ended before the key event that finished at 20:45:08.436; capture q/003 came at 20:45:10.233 (lower bound 1.80 s, the sign-in already answered 200 at 20:45:08.122, the capture shows Home). The driver's `sleep` takes milliseconds, so the intended 3 s pause was 3 ms. The two later sign-ins waited 3.5 s after the 200: captures 6.6 s and 5.8 s after the key event.
- **D-CF2-B-3 — RF-T-1 needed a second change between run 1 and run 2** (§2.3). Within the 2 + 1 budget: run 1 failed, run 2 and the verification passed.

## 7. Decisions

- **DEC-CF2-B-1** The selection glow of Evidence and Sessions rows changes at once; the 240 ms cross-fade of `GlowLayer` is not used for it (D208: final state drawn by React, nothing to lose).
- **DEC-CF2-B-2** Evidence and Sessions row cards keep a 1 dp border in both states (transparent / gold). The content sits 1 dp further in than on the old unselected card, the same in both states.
- **DEC-CF2-B-3** Sessions hub expanded split: start widths 360 | 340 dp and the extra 2 : 3, instead of 40 | 60 with a minimum.
- **DEC-CF2-B-4** Network & Time values wrap (no line cap) rather than stacking label over value.
- **DEC-CF2-B-5** The Sessions hub rows got the RF-T-1 fix in this row (same defect, found in the before-captures, inside CF2-B's paths). Device rows were not changed (drawn correctly on the device).

## 8. Observations (not fixed, not in this row's defects)

- **O-CF2-B-1** Home header clock: the seconds held at `:00` while the minute ran (20:45:00 in captures at 20:45:10, :33 and :51; 20:46:00 at 20:46:29); at 20:58:32 it read 20:58:30. Probably the dropped-Reanimated-update family on the rolling digits (as R-P-2's timer). Owner outside CF2-B's paths.
- **O-CF2-B-2** Sessions detail pane: the "Sealed" chip on the hero image is drawn faded in every capture (before and after), likely an entering fade left part-way. `features/sessions/session-detail.tsx`; not one of the three defects.
- **O-CF2-B-3** The first rail tap after sign-in was ignored once (20:45:28) during a 38-frame skip; the second worked.
- **O-CF2-B-4** The kit `Card` / `Surface` (`overflow: hidden` + `boxShadow`) may show the same empty-content draw anywhere else a border width changes with state. A grep for this pattern in other features was not part of this row.

## 9. Files

Code (all under `apps/mobile/src/features/`):

| File | Change |
|---|---|
| `evidence/selection-glow.tsx` | **new**: `SelectionGlow`, `selectionGlowOpacity`, `ROW_CARD_BORDER` |
| `evidence/evidence-row.tsx` | glow → `SelectionGlow` after the pressable; card `ROW_CARD_BORDER` + gold colour when selected; `testID evidence-row-card-<id>` |
| `sessions/session-row.tsx` | the same; `testID session-row-card-<id>` |
| `sessions/sessions-screen.tsx` | `DETAIL_MIN_WIDTH`, `LIST_PANE_FLEX`, `DETAIL_PANE_FLEX`; expanded panes use them; doc table |
| `network-time/time-sync-card.tsx` | values without `numberOfLines`, `textAlign: 'right'` |
| `evidence/evidence-row-deselect-drawn.test.tsx` | **new** (4 tests) |
| `evidence/testing/row-tree.ts` | **new** (test helpers) |
| `sessions/session-row-deselect-drawn.test.tsx` | **new** (1 test) |
| `sessions/hub-pane-split.test.tsx` | **new** (3 tests) |
| `network-time/time-sync-fit.test.tsx` | **new** (4 tests) |
| `sessions/hub-pane-row-fit.test.tsx` | expectation `flexBasis 360, flexGrow 2` |
| `evidence/live-evidence-static.test.ts` | folder list + `selection-glow.tsx` |

Evidence: `gateway_check/assets/13b_*` (29 files, listed in the progress file).
