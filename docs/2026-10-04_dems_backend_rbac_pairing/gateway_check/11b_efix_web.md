---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: FX-W (E-fix pass, D201)
date: 2026-10-06
agent: coder-execution
status: complete
inputs: decisions D152 (F63-1), D197, D198, D201 (ruling R3); test/07a_e2e_web_supervisor.md §20, §23; test/07b_e2e_web_roles_consoles.md (E2E-W2-1); implementation/63_web_dashboard.md, 69_web_evidence.md
narrative_tier: 2
---

# 11b — E-fix FX-W: six web-console defects of the end-to-end round

Scope: `apps/core-web/**` (not the session-timeline note-label lines, which belong to FX-C) and `packages/shared/src/i18n/en/evidence.ts` (the only shared i18n file this row touched). Every defect was reproduced on lane 3 first (`http://127.0.0.1:5178`, Live, Core 4423), fixed, proven by vitest tests that fail on the old code (in-memory mutations, 23 of 23 caught), and re-captured on lane 3.

| # | Defect (severity) | Root cause | Change | New / changed tests | Mutations caught | Before → after on lane 3 |
|---|---|---|---|---|---|---|
| 1 | E2E-W1-2 = E2E-W2-1 (Medium, ruling R3): Dashboard Test signal disabled, "Requires the Technician role" | `features/dashboard/devices-panel.tsx:44,138,158` gated both commands on `DEVICE_MANAGE` | Test signal follows `DIAGNOSTICS_RUN` (operation 49), Restart stays on `DEVICE_MANAGE` (operation 48) | `src/test/live-dashboard-devices.test.tsx` (+2 Live, 1 Simulated rewritten) | 3/3 | Test signal disabled → enabled, sent, toast "Test signal sent to Camera 1" |
| 2 | E2E-W1-3 (Medium): integrity card "Not verified" on every open while the Core holds a PASS | `features/evidence/integrity-tab.tsx:53-54` read only this view's run (`state.verdict ?? 'NOT_RUN'`), never `item.verification` | The card opens on the record's verdict with result, time and operator; a new Verify replaces it | `efix-integrity-metadata.test.tsx` (6), `live-efix-evidence.test.tsx` (2) | 3/3 | after reload NOT_RUN (Core PASS) → PASS "Last verification PASS · 6 Oct 2026 … · AKP Andi Pratama" |
| 3 | E2E-W1-4 (Medium): Metadata of EV-20261006-0012 shows package EV-20261001-0012 as its own | `features/evidence/metadata-tab.tsx:95,145` showed ANY joined package as the item's manifest; the D84 join (`packages/shared/src/demo-data/join.ts:43-54`) ignores dated parts by design | A package describes the item only when its evidence ID, session ID and case number equal the item's; otherwise the Core's record first, a notice, and the package's documents labelled "Bundled DEMO package · EV-…" | `efix-integrity-metadata.test.tsx` (3), `live-efix-evidence.test.tsx` (2) | 3/3 | manifest of EV-20261001-0012 as "Manifest fields" → Core record + notice + labelled package documents |
| 4 | E2E-W1-5 (Low): "ATTENTION" overflows the ring at 1440x900 and 390x844 | `components/composed/glow-ring.tsx:305-313`: the state word was Orbitron at the fixed display size (32 px), with no fit | `RingWord`: measures the word's ink and shrinks the font only when the ink would cross the inner ring | `glow-ring-fit.test.tsx` (7) | 5/5 | 214 px word over a 191 px inner ring → 24.6 px, 13 px inside each side (1440); 32 px → 29.3 px (390) |
| 5 | E2E-W1-6 (Low): 390x844 status strip labels overlap | `features/dashboard/dashboard.css:88-89` set the wrap basis on `.dems-strip-cell`, but the flex items are the wrappers `status-strip.tsx:167` (`flex min-w-0 flex-1`, a utility that also beats the components layer); `.dems-strip-value` (`dashboard.css:421-428`) could not end inside its cell | Wrapper `.dems-strip-item` with its basis in the stylesheet; 3 per row (sm), 2 per row (xs); below 1024 px the value text ends in an ellipsis | `status-strip-narrow.test.tsx` (2) | 6/6 (M5a-M5f) | 1 row, 5 overruns → 3 rows, 0 overruns; 1440 strip unchanged |
| 6 | E2E-W1-7 (Low): custody times break mid-token | `features/evidence/integrity-tab.tsx:279` one `.evi-mono` span; `evidence.css:311-316` `.evi-mono { word-break: break-all }` (for hashes) | Date and clock as two `nowrap` tokens, `word-break: normal` on the cell | `efix-integrity-metadata.test.tsx` (2) | 3/3 | "6 Oct 20 / 26 11:2 / 7:23" → "6 Oct 2026 / 11:27:23" |

Suite ledger (section 8): full core-web suite with `--maxWorkers=2` 108 files / 1422 tests passed (exit 0), typecheck exit 0, lint exit 0.

---

## 1. E2E-W1-2 = E2E-W2-1 — Dashboard Test signal follows `DIAGNOSTICS_RUN` (ruling R3)

**Root cause.** `apps/core-web/src/features/dashboard/devices-panel.tsx` (pre-fix, rollback copy):
- `:44` `const selectCanManage = (s: SimState) => selectCan(s, Permission.DEVICE_MANAGE)`;
- `:138` `const role = requiredRoleFor(Permission.DEVICE_MANAGE)`;
- `:158` `disabledKeys={canManage && !busy ? [] : ['test', 'restart']}`, with the same role hint on both items (`:169`, `:176`).

The Core grants operation 49 `testDeviceSignal` on `DIAGNOSTICS_RUN` (`packages/shared/src/api/devices.ts:13`; the simulator likewise, `packages/shared/src/sim/maintenance.ts:207`). Every seeded role holds it (`packages/shared/src/sim/auth.ts:45-71`), and the Devices page (`features/devices/device-menu.tsx:43-52`) gates only Restart. The two pages of one console disagreed. D152 F63-1 had kept the stricter Dashboard; D201 R3 amends it.

**Change.** `devices-panel.tsx`: a `selectCanTest` selector on `DIAGNOSTICS_RUN`. `disabledKeys` is computed per command: while a command is out (LB-1) both stay disabled; otherwise Test signal follows `canTest` and Restart follows `canManage`. Each item's role hint names the first role that holds its own permission (`requiredRoleFor`). The component docblock (the spec comment that quoted S20's grouping) now states R3 and the amendment of F63-1.

**Tests** (`apps/core-web/src/test/live-dashboard-devices.test.tsx`):
- new Live "R3 gating": a SUPERVISOR session (`DIAGNOSTICS_RUN`, no `DEVICE_MANAGE`) sees Test signal enabled with no role hint. Pressing it sends one `POST /api/v1/device/CAM-01/test-signal` and shows the Live toast. Restart stays disabled with "Requires the Technician role";
- new Live: LB-1 still holds for that role (both disabled while a Test signal is out, enabled again after);
- rewritten Simulated case "an INVESTIGATOR sees both commands disabled …": Test signal is now enabled and writes one `DEVICE_COMMAND` audit row as OPR-001; Restart stays disabled with the Technician role.

```
$ npx vitest run src/test/live-dashboard-devices.test.tsx
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

**Mutation** (`gateway_check/assets/11b_mutations.log`): M1a Test signal back on `DEVICE_MANAGE` → 3 failed; M1b the old `disabledKeys` → 3 failed (M1a and M1b are the pre-fix shapes: the tests fail before and pass after); M1c busy no longer disables Test signal → 2 failed.

**Lane 3** (SUPERVISOR andi.pratama, Camera 1 menu): before `[Test signal "Requires the Technician role", disabled]` → after `[Test signal, enabled]`, Restart unchanged (disabled, Technician). The after run pressed Test signal once: toast "Test signal sent to Camera 1".
- before: `assets/11b_before_d1_dashboard_camera1_menu.png`
- after: `assets/11b_after_d1_dashboard_camera1_menu.png`, `assets/11b_after_d1_dashboard_test_signal_toast.png`

## 2. E2E-W1-3 — the integrity card opens on the Core's last verification

**Root cause.** `apps/core-web/src/features/evidence/integrity-tab.tsx:53-54` (pre-fix):
`state.phase === 'running' ? 'RUNNING' : state.phase === 'error' ? 'ERROR' : (state.verdict ?? 'NOT_RUN')`. `state` is this view's run (`use-verification.ts:110-122`, `initialState`: `verdict: null`), so every page load opened on "Not verified". Meanwhile the list preview reads `row.item.verification.status` (`preview-card.tsx:107`), which the Core keeps (its delta writes `verification: {status, at}` and a `VERIFIED` / `VERIFY_FAILED` custody entry with the actor).

**Change.**
- `features/evidence/model.ts`: `storedVerification(item)` returns the record's verdict, its time, and the actor of the matching custody entry (same verdict at the same instant, else the latest of that verdict), or null for `NOT_RUN`.
- `integrity-tab.tsx`: while nothing has run in this view, the chip shows the stored verdict (`state.verdict ?? stored?.status ?? 'NOT_RUN'`). A line under the mode text reads "Last verification PASS · 6 Oct 2026 11:57:47 UTC+07:00 · AKP Andi Pratama" (`data-testid="evidence-verify-last"`) in every phase, so the Core's delta after a new Verify moves it to the new run (CL-16). The button says "Verify again". Instead of "0 of 6 checks" (the per-check list belongs to a run) the card says "Verify again to see each check.". `data-verdict-source` is `record` / `none` / `run`. A run in the view shows its own verdict, as before.
- `packages/shared/src/i18n/en/evidence.ts`: `evidence.verify.last.{full,noActor,resultOnly}`, `evidence.verify.storedHint` (additive).

The behaviour is the same in both modes (in Simulated mode the simulator keeps `item.verification`, `sim/evidence-actions.ts:67`). Seeded items are `NOT_RUN`, so an unverified item looks as before.

**Tests.** `src/features/evidence/__tests__/efix-integrity-metadata.test.tsx`: `storedVerification` (none for NOT_RUN; exact-instant actor over a later entry; FAIL; actor unknown; system actor); the tab opens on PASS with the full line, "Verify again" and the hint, without "0 of 6 checks"; it opens on FAIL; a never-verified record is unchanged; a run's RUNNING/FAIL verdict wins; the Simulated detail page (real router) opens on PASS. `src/test/live-efix-evidence.test.tsx`: the Core's record holds a PASS → PASS on open with time and operator, 0 `verifyEvidence` requests, 0 demo operations, no "simulated" word; a new Verify answering FAIL with its delta → chip FAIL, the line moves to the run's time and operator.

```
$ npx vitest run src/features/evidence/__tests__/efix-integrity-metadata.test.tsx
 Test Files  1 passed (1)
      Tests  11 passed (11)
$ npx vitest run src/test/live-efix-evidence.test.tsx
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**Mutation:** M2a the chip back to `state.verdict ?? 'NOT_RUN'` (the pre-fix line) → 5 failed (both files); M2b `storedVerification` always null → 6 failed; M2c actor from the latest entry instead of the entry of that instant → 1 failed.

**Lane 3** (EV-20261006-0012). Before: on open NOT_RUN (Core `NOT_RUN`) → Verify → PASS (Core `{status: PASS, at: …843146}`, custody `VERIFIED OPR-002`) → reload → "NOT_RUN" while the Core still holds PASS (the defect). After: on open PASS, "Last verification PASS · 6 Oct 2026 11:57:47 UTC+07:00 · AKP Andi Pratama", "Verify again". Verify again → PASS, line "… 12:03:06 …"; reload → the same.
- before: `assets/11b_before_d2_integrity_on_open.png`, `assets/11b_before_d2_integrity_after_verify.png`, `assets/11b_before_d2_integrity_after_reload.png`
- after: `assets/11b_after_d2_integrity_on_open.png`, `assets/11b_after_d2_integrity_after_verify.png`, `assets/11b_after_d2_integrity_after_reload.png`

## 3. E2E-W1-4 — the Metadata tab shows a bundled package only for its own record

**Root cause.** The matching rule is the shared join `matchDemoPackage` (`packages/shared/src/demo-data/join.ts:43-54`): evidence suffix, session suffix, case sequence and subject name. Dated parts are ignored on purpose (D84 on F-47-1), so the packages (generated `asOf` 2026-10-01, `packages.generated.ts:10`) join the re-dated dataset on any day. In Live mode the Core's media reference names the same package (lane 3: `GET /api/v1/evidence/EV-20261006-0012` → `media: {source: DEMO_PACKAGE, packageSuffix: "0012"}`; `use-evidence-media.ts:95-104`). The Metadata tab (`metadata-tab.tsx:95`, pre-fix) had only two branches. It showed the record for no package, and ANY joined package's `manifest.json` as "Manifest fields" of the item (`:145` `data-package="demo"`). On 6 Oct, EV-20261006-0012 (SES-20261006-0022, LP/2026/1005-0004) therefore showed EV-20261001-0012's manifest (SES-20261001-0022, LP/2026/0930-0004, 1 Oct) with no notice.

**Change.** The join and MS-2 stay as they are (the demo media still play; the header chip still says "DEMO package").
- `features/evidence/model.ts`: `packageDescribesItem(pkg, item)` is true only when the package's evidence ID, session ID and case number equal the item's.
- `metadata-tab.tsx` has a third branch for a joined package of another record (`data-package="foreign"`):
  - left: an info Alert (kit `Alert`, like the Integrity tab's "Two results"): "The bundled DEMO package is another record. This item plays the demo media of the bundled package EV-20261001-0012 (session SES-20261001-0022, recorded 1 Oct 2026). Its documents describe that package, not this item. This item's metadata is the Core record." Under it, "Record of this item" with the Core record JSON, exactly as for an item without a package (its note names the other package);
  - right: "Bundled DEMO package · EV-20261001-0012" with the DEMO chip, and the package's raw documents. Each document's accessible name is prefixed with that title. The 13 manifest fields and the package tree are shown only for the package's own record.
  - The document viewer moved into a small `PackageDocumentsView` used by both package branches; the own-package and no-package branches are unchanged.
- i18n: `evidence.metadata.foreign.{title, body, recordTitle, packageTitle}` (additive).

The same rule applies in Simulated mode, where the simulator also re-dates its dataset. Every existing test runs at the packages' `datasetNow` (2026-10-01), where IDs match exactly and nothing changes.

**Tests.** `efix-integrity-metadata.test.tsx`: the join still gives the package to a re-dated copy of item 0012, but `packageDescribesItem` is false (also with only the case number changed). The package's own record is unchanged (manifest fields, tree, `demo`). The re-dated record gets `foreign`, the notice with the package ID and session, its own record JSON (`simulated`, its IDs, the note naming the package), and the package documents labelled. `live-efix-evidence.test.tsx`: the Core names package 0012 for EV-20261006-0012 → header chip `demo`, tab `foreign`, `record: CORE` JSON with the item's IDs, labelled documents, no "simulated" in the console's own words; EV-20261001-0012 with package 0012 keeps the manifest fields. The existing `copy-round-metadata-media.test.tsx` passes unchanged.

**Mutation:** M3a the old two-branch rule (`if (false)`) → 2 failed; M3b `packageDescribesItem` = any joined package → 3 failed; M3c without the case-number check → 1 failed.

**Lane 3** (EV-20261006-0012, Metadata): before `data-package="demo"`, JSON `EV-20261001-0012` → after `data-package="foreign"`, regions "Core record" (EV-20261006-0012) and "Bundled DEMO package · EV-20261001-0012 · manifest.json", notice present.
- before: `assets/11b_before_d3_metadata_tab.png`
- after: `assets/11b_after_d3_metadata_tab.png`

## 4. E2E-W1-5 — the ring's state word fits the ring

**Root cause.** `apps/core-web/src/components/composed/glow-ring.tsx:305-313` (pre-fix) rendered the state word as Orbitron 700 at the fixed display size (`font-display text-display`, 32 px), with nothing relating it to the ring's size. Measured on lane 3 at 32 px (`assets/11b_measure_words.log`): READY 131.8, CRITICAL 171.7, UNKNOWN 197.3, ATTENTION 213.6 px (RECORDING is never drawn as a word: the centre shows REC). The Dashboard ring is 258 px at 1440x900 (inner ring 191 px) and 284 px at 390x844 (inner ring 210 px). English is the only language the console ships (`packages/shared/src/i18n/` has `en` only), so ATTENTION is the longest word drawn.

**Change.**
- `glow-ring.math.ts`: `ringWordBudget(size, dy, air)` is the widest ink allowed inside the inner edge of the inner ring's stroke at a vertical reach `dy`. `ringWordScale(naturalWidth, size, dy)` returns 1 while the ink clears the ring by the trigger air (0.8 % of the size, ≈2 px). Otherwise it returns the scale that keeps the fit air (1.6 %, ≈4 px), three decimals, floor 0.5. `INNER_RING_STROKE` now names the inner ring's stroke width (2.5), which the SVG uses too.
- `glow-ring.tsx`, `RingWord`: the word sits in an inline-block wrapper that carries the same classes. In a layout effect, and again on every resize of its own box (the web font arriving, a new size), it measures the word's ink with canvas text metrics of its computed font at its position in the ring. If the ink would cross the ring it sets `font-size: calc(var(--text-display) * s)` and `data-fit-scale`; a word that clears the ring gets no inline style. The ring root is found from the DOM (`closest('[data-ring-root]')`), not from the parent's ref: on mount a child's layout effect runs before the parent's ref is attached. The first lane check only worked because the measured ring size changed later; test M4d keeps that path covered. Only the Dashboard hero draws the default word (Login passes its own centre; Start Session uses `mini`).

**Effect per word, from the measured ink geometry** (`assets/11b_ring_geometry.log`, `11b_ring_geometry_final.log`; ink corner clearance at 32 px):

| Viewport (ring) | READY | CRITICAL | UNKNOWN | ATTENTION |
|---|---|---|---|---|
| 1440x900 (258 px) | +16.1 px → unchanged | −1.2 px → fitted, 0.934 | −12.0 px → fitted, 0.818 | −19.5 px → fitted, 0.756 |
| 390x844 (284 px) | +34.7 px → unchanged | +15.6 px → unchanged | +3.9 px → unchanged | −3.9 px → fitted, 0.918 |
| 1920x1080 (322 px) | unchanged | unchanged | unchanged | +9.1 px → unchanged |

So a word whose ink clears the ring keeps its look. At 1440x900 CRITICAL and UNKNOWN crossed the ring as well (by 1.2 and 12 px), and the same fit corrects them. On lane 3 the ring could only be shown in ATTENTION (no fault may be raised); the other words' rows above come from the measured geometry and are encoded in the tests.

**Tests.** `src/components/composed/__tests__/glow-ring-fit.test.tsx`:
- pure tests with the lane-3 numbers: unchanged words, ATTENTION fitted at both sizes within the fit air, CRITICAL/UNKNOWN at 1440, edge cases;
- component tests with a faked layout: ATTENTION gets `data-fit-scale` and `calc(var(--text-display) * s)` with its classes kept; READY gets neither; plain jsdom scales nothing.

The existing `glow-ring.test.tsx` and `visual-audit-45b.test.tsx` pass unchanged.

```
$ npx vitest run src/components/composed/__tests__/glow-ring-fit.test.tsx src/components/composed/__tests__/glow-ring.test.tsx src/test/visual-audit-45b.test.tsx
 Test Files  3 passed (3)
      Tests  28 passed (28)
```

**Mutation:** M4a scale not applied → 1 failed; M4b no fit (scale always 1, the pre-fix look) → 4 failed; M4c trigger at the fit air (UNKNOWN at 390 would change) → 1 failed; M4d no ring root at mount (the parent-ref timing bug) → 1 failed; M4e vertical reach ignored → 3 failed.

**Lane 3:** 1440x900: 32 px, 214 px wide, 11 px outside the inner ring each side → 24.6 px, 164 px, 13 px inside. 390x844: 32 px, 2 px outside → 29.3 px, 196 px, 7 px inside.
- before: `assets/11b_before_d4_ring_1440x900.png`, `assets/11b_before_d4_ring_390x844.png`, `assets/11b_before_d4d5_dashboard_1440x900.png`, `assets/11b_before_d4d5_dashboard_390x844.png`
- after: `assets/11b_after_d4_ring_1440x900.png`, `assets/11b_after_d4_ring_390x844.png`, `assets/11b_after_d4d5_dashboard_1440x900.png`, `assets/11b_after_d4d5_dashboard_390x844.png`

## 5. E2E-W1-6 — the status strip at 390x844

**Root cause.** `apps/core-web/src/features/dashboard/dashboard.css:85-93` (pre-fix) made the strip wrap at the sm/xs tiers and set `flex: 1 1 30%` on `.dems-strip-cell`. The strip's flex items, however, are the cells' motion wrappers (`status-strip.tsx:167`, `className="flex min-w-0 flex-1"`). The rule reached the link inside the wrapper, and `flex-1` is a Tailwind utility, which beats the stylesheet's `@layer components` whatever the selector. Nothing wrapped: six cells shared one 390 px row (lane 3: 1 row, 5 overruns). `.dems-strip-value` (`dashboard.css:421-428`) is `nowrap` with nothing to stop a value at its cell's edge.

**Change.**
- `status-strip.tsx`: the wrapper is `.dems-strip-item flex min-w-0` (no `flex-1`), and the value text sits in `<span class="dems-strip-value-text">`;
- `dashboard.css`: `.dems-strip-item { flex: 1 1 0 }` as the base (the utility's old effect, now overridable). At sm/xs the items take `flex: 1 1 30%` (3 per row) and at xs `flex-basis: 45%` (2 per row), with `row-gap: 2px`. At sm/xs `.dems-strip-value` takes `max-width: 100%` and the text span `min-width: 0; overflow: hidden; text-overflow: ellipsis`.
- Wider tiers keep their look. A first version applied the ellipsis at every tier. The after capture at 1440 showed "Synchroniz…", because there the value sits a fraction of a pixel past its text box. So the truncation was scoped to sm/xs, the after set was re-taken, and the M5 mutations were re-run.
- The link's accessible name still carries the whole value.

**Tests.** `src/features/dashboard/__tests__/status-strip-narrow.test.tsx`:
- DOM at the xs tier: six `.dems-strip-item` wrappers without `flex-1`, each value in its truncating span, full accessible names;
- stylesheet rules, read from disk (vitest blanks CSS imports, so `?raw` gives `""`; the precedent is `live-shell-indicator.test.tsx`): the base basis, the 30 % and 45 % rules, the narrow-only truncation, no `max-width` or truncation outside the narrow rules, and the old `.dems-strip-cell` rule gone.

The existing `dashboard.test.tsx` strip test (accessible names) passes unchanged.

```
$ npx vitest run src/features/dashboard/__tests__/status-strip-narrow.test.tsx
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

**Mutation** (CSS mutations transform the stylesheet text the test reads, in memory; each anchor is checked to occur exactly once): M5a `flex-1` back on the item → 1 failed; M5b basis back on `.dems-strip-cell` → 1 failed; M5c no ellipsis → 1 failed; M5d no text span → 1 failed; M5e no 45 % basis → 1 failed; M5f truncation at every tier → 1 failed. Two runs were not valid: a first M5c whose plain `.replace` anchor did not occur (a silent no-op), and a first re-run of M5c whose anchor guard threw. Both were discarded and re-run with exact anchors (`11b_mutations.log`).

**Lane 3** (390x844): 1 row, overlaps `cameras→mics→storage→time→security→network` → 3 rows, 0 overlaps, no value truncated. At 1440x900 the strip is unchanged (1 row, 0 overlaps, "Synchronized" in full).
- before: `assets/11b_before_d5_strip_390x844.png` (and the full page `11b_before_d4d5_dashboard_390x844.png`)
- after: `assets/11b_after_d5_strip_390x844.png`, `assets/11b_after_d4d5_dashboard_390x844.png`, `assets/11b_after_d4d5_dashboard_1440x900.png`

## 6. E2E-W1-7 — custody times break only between date and time

**Root cause.** `apps/core-web/src/features/evidence/integrity-tab.tsx:279` (pre-fix) printed `formatWibDateTime(entry.at)` in one `<span class="evi-mono evi-caption">`. `evidence.css:311-316` gives `.evi-mono` `word-break: break-all`, meant for hashes, so the narrow Time column at 1440x900 broke anywhere (lane 3: three lines "6 Oct 20 / 26 11:2 / 7:23").

**Change.** `integrity-tab.tsx`: the cell holds `<span class="evi-custody-date">6 Oct 2026</span> <span class="evi-custody-clock">11:27:23</span>` inside `.evi-custody-time`, with the same words as before (`formatWibDate` + `formatWibClockSeconds` = `formatWibDateTime`). `evidence.css`: `.evi-mono.evi-custody-time { word-break: normal; overflow-wrap: normal }` (more specific than `.evi-mono`) and `.evi-custody-date, .evi-custody-clock { white-space: nowrap }`. A narrow column puts the clock on a second line; a wide one keeps one line. Hashes keep breaking anywhere.

**Tests.** `efix-integrity-metadata.test.tsx`: every custody cell is a date token (`/^\d{1,2} [A-Z][a-z]{2} \d{4}$/`) and a clock token (`/^\d{2}:\d{2}:\d{2}$/`) whose text equals `formatWibDateTime(at)`; the stylesheet has the override and the `nowrap` rule, and `.evi-mono` still has `break-all`.

**Mutation:** M6a the old single span → 1 failed; M6b no `word-break` override → 1 failed; M6c no `nowrap` → 1 failed.

**Lane 3** (EV-20261006-0012 custody, 1440x900): before 3 lines per cell, broken mid-token → after 2 lines, `["6 Oct 2026", "12:03:06"]` … for each of the five rows.
- before: `assets/11b_before_d6_custody_1440x900.png`
- after: `assets/11b_after_d6_custody_1440x900.png`

## 7. Mutation method

`assets/11b_mutate_config.mts.txt` merges the app's `vite.config.ts` with a `pre` transform plugin that rewrites ONE module as Vite serves it to vitest: a source file, or (for CSS fixes) the test module's `readFileSync(...)` expression, so that the stylesheet text the test reads is mutated in memory. `assets/11b_mut.sh.txt` runs the named tests with one mutation (anchor and replacement in base64) and logs the vitest summary; the plugin throws if the anchor does not occur exactly once. No tree file was changed for any mutation. Totals: M1 3/3, M2 3/3, M3 3/3, M4 5/5, M5 6/6 (two invalid M5c attempts discarded and re-run), M6 3/3: **23 valid mutations, 23 caught**, with a no-mutation baseline per group passing.

## 8. Suite ledger

| Check | Command (in `apps/core-web`) | Result |
|---|---|---|
| Targeted, fix 1 | `npx vitest run src/test/live-dashboard-devices.test.tsx` | 1 file, 15 passed |
| Targeted, fixes 2, 3, 6 | `npx vitest run src/features/evidence/__tests__/efix-integrity-metadata.test.tsx src/test/live-efix-evidence.test.tsx` | 2 files, 15 passed |
| Targeted, fix 4 | `npx vitest run src/components/composed/__tests__/glow-ring-fit.test.tsx src/components/composed/__tests__/glow-ring.test.tsx src/test/visual-audit-45b.test.tsx` | 3 files, 28 passed |
| Targeted, fix 5 | `npx vitest run src/features/dashboard/__tests__/status-strip-narrow.test.tsx` | 1 file, 2 passed |
| Neighbours | `npx vitest run --maxWorkers=2 src/features/evidence src/features/dashboard src/components/composed src/test/live-evidence-{verify,export,archive}.test.tsx src/test/live-dashboard-{page,devices}.test.tsx src/test/visual-audit-45b.test.tsx src/test/live-w0-evidence-words.test.tsx src/test/evidence-table.test.tsx src/test/live-efix-evidence.test.tsx` | 22 files, 194 passed |
| Shared i18n | `npx vitest run test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` (in `packages/shared`) | 2 files, 50 passed |
| Typecheck | `npm run typecheck` (`tsc -b`) | exit 0 on the final tree (the first run, at 11:36, failed only in `components/composed/session-timeline.tsx:199`, FX-C's in-flight note-label edit, not this row's file; every later run was clean) |
| Lint | `npm run lint` (`oxlint`) | exit 0 |
| Full suite (once, final tree) | `npm run test -- --maxWorkers=2` (12:03:58-12:06:57, load 8.65 at start) | **108 files, 1422 tests passed, exit 0**, 178 s (`assets/11b_full_suite.log`) |

The mobile app reuses `evidence.*` but its suites were not run (FX-M1/FX-M2 own `apps/mobile/**` and are in flight); the i18n change is additive keys only.

## 9. Lane-3 evidence: method, what was sent, state left

- Browser: the Playwright-cache `chrome-headless-shell` (build 1243), raw CDP, `--remote-debugging-port=0`. The port was read from `DevToolsActivePort` and its listening socket checked to belong to the spawned PID (`lsof -a -p <pid>`). Each run used a fresh profile in `$TMPDIR` (removed after) and Fetch interception that fails any request to an origin other than `http://127.0.0.1:5178` (0 blocked in every run). Driver: `assets/11b_driver_cdp.mjs.txt`, `11b_driver_capture.mjs.txt`, `11b_driver_probe.mjs.txt`, `11b_ring_geometry.mjs.txt`, `11b_measure_words.mjs.txt`. The password is read from the README Quick start table inside the driver and is never printed or written.
- The sandbox refuses local TCP connections (`curl 127.0.0.1:5178` → "Couldn't connect" while `lsof` showed node listening), so the driver runs were made outside the Bash sandbox.
- Sent to Core 4423 as andi.pratama (SUPERVISOR):
  - 9 sign-ins, each followed by a sign-out `POST /api/v1/auth/sign-out → 204`: probe 11:25, before 11:27, three dry checks 11:38-11:43, two geometry reads 11:41 and 11:58, after 11:57 (superseded) and 12:02;
  - reads;
  - Verify of EV-20261006-0012 at 11:27:23, 11:57:47 and 12:03:06 (each PASS, custody `VERIFIED` OPR-002);
  - Test signal on Camera 1 at 11:57 and 12:02.
  
  Two more runs opened only the Login page (word widths, 11:35 and 12:04). No demo reset, scenario, fault, session, Restart or Install update; no other lane or port.
- Captures: before 11:27 WIB (`11b_before_*`, `11b_before_capture.log`, `11b_before_measurements.json`). After: 12:02-12:03 WIB on the final code (`11b_after_*`, `11b_after_capture.log`, `11b_after_measurements.json`); this set replaced an 11:57 after set taken before the strip truncation was scoped to sm/xs. 0 page exceptions in every run.
- State left on `dems_lane_3`: EV-20261006-0012 `verification = PASS` at 12:03:06 with three new `VERIFIED` custody entries; two `DEVICE_COMMAND` audit rows; sign-in/sign-out audit pairs; everything else as found (ring ATTENTION, 13 items). Signed out; no browser or profile left (`ps` and `$TMPDIR` checked at 12:07).

## 10. Incidents and secret hygiene

- **IN-FXW-1 (11:22).** While locating the Quick start table, this agent ran `grep -n "Quick start\|andi.pratama" README.md`. That printed whole README lines, including the published demo password, the README's pairing code and the emulator PIN, into the agent's own tool output once. Nothing was written to any file, and the driver reads the value itself from then on. README §228 says the seeded demo credentials are published for synthetic local accounts; the row's rule ("never print") was still broken once and is recorded here. The values are not repeated in this report.
- **IN-FXW-2 (11:25-11:36).** The first probe run crashed on an unhandled CDP rejection (`Fetch.continueRequest: Invalid InterceptionId`) before signing in. Its headless browser (PID 23621, OS-assigned port, own profile) kept running because the sandboxed `ps` showed nothing. Found at 11:36 with an unsandboxed `ps`, its command line was verified to hold this row's profile name, and it was stopped; the profile was removed. It never signed in. The driver now ignores late interception replies and kills its browser on any exit.
- Count-only scan (12:07) of this row's outputs: this report, `delegation_progress/fx_w_web.md` and every `gateway_check/assets/11b_*` file; 40 files, 23 PNG byte-scanned. Demo password 0 occurrences; `ses_`/`dvc_`/`bio_` tokens 0. There are 8 six-digit or 3+3 digit matches, all in this report and none a code: seven source line ranges (`glow-ring.tsx`, `dashboard.css` ×2, `evidence.css` ×2, `use-verification.ts`, and the same `glow-ring.tsx` range again) and the tail of an epoch-millisecond value. The contexts were checked with the digits masked. No pairing code was shown or captured: no page with a code was opened.

## 11. Files

Changed (each with a rollback copy and SHA-256 in `/Users/gsp-budi/Documents/DEMS/.cache/rollback/FX-W/`, `SHA256SUMS` verified OK; lines counted against the rollback copy):
- `apps/core-web/src/features/dashboard/devices-panel.tsx` (+18 −8)
- `apps/core-web/src/test/live-dashboard-devices.test.tsx` (+61 −9)
- `apps/core-web/src/features/evidence/integrity-tab.tsx` (+51 −11)
- `apps/core-web/src/features/evidence/model.ts` (+43)
- `apps/core-web/src/features/evidence/metadata-tab.tsx` (+174 −86)
- `apps/core-web/src/features/evidence/evidence.css` (+13)
- `apps/core-web/src/components/composed/glow-ring.tsx` (+111 −11)
- `apps/core-web/src/components/composed/glow-ring.math.ts` (+37)
- `apps/core-web/src/features/dashboard/status-strip.tsx` (+7 −2)
- `apps/core-web/src/features/dashboard/dashboard.css` (+30 −1)
- `packages/shared/src/i18n/en/evidence.ts` (+22, additive keys)

Created: `apps/core-web/src/components/composed/__tests__/glow-ring-fit.test.tsx`, `apps/core-web/src/features/dashboard/__tests__/status-strip-narrow.test.tsx`, `apps/core-web/src/features/evidence/__tests__/efix-integrity-metadata.test.tsx`, `apps/core-web/src/test/live-efix-evidence.test.tsx`, this report, `delegation_progress/fx_w_web.md`, and the `gateway_check/assets/11b_*` files: 23 PNG (11 before, 12 after), `11b_{before,after}_capture.log`, `11b_{before,after}_measurements.json`, `11b_ring_geometry.log`, `11b_ring_geometry_final.log`, `11b_measure_words.log`, `11b_mutations.log`, `11b_full_suite.log`, and the driver and mutation tooling as `.txt` (`11b_driver_cdp.mjs.txt`, `11b_driver_capture.mjs.txt`, `11b_driver_probe.mjs.txt`, `11b_ring_geometry.mjs.txt`, `11b_measure_words.mjs.txt`, `11b_mutate_config.mts.txt`, `11b_mut.sh.txt`).

Not touched: `packages/shared/src/i18n/en/{dashboard,shell}.ts` (no change was needed), session-timeline, every FX-C/FX-M path, git (no commit).

## 12. Notes for the controller

1. R3 is implemented: F63-1 (D152) is amended in code and in the component docblock. `masterplan/` and the dashboard spec text (S20's grouping) are outside this row's paths; the controller may want to note the amendment there.
2. E2E-W1-3: the stored verdict shows in both modes. The line names the actor from the custody entry; when no matching entry exists it falls back to "Last verification PASS · <time>".
3. E2E-W1-4: the shared join (D84) and MS-2 are unchanged. The new rule is that a joined package is presented as the item's metadata only when it is the item's own record. This is a client-side rule, and it also changes Simulated mode on any day other than 1 Oct. The 13 manifest fields then appear only for the package's own record. **Superseded by row FX-W2 (below): the rule applies in Live mode only.**
4. E2E-W1-5: at 1440x900 CRITICAL and UNKNOWN were also crossing the ring, and the same rule fits them; at 390 and 1920 only ATTENTION (at 390) changes.
5. The re-test round can reuse `assets/11b_driver_capture.mjs.txt`. Lane 3 now holds a PASS on EV-20261006-0012, which the E2E-W1-3 re-test needs.

---

## FX-W2 (follow-up row, 2026-10-06 12:08-12:20)

Controller gate of FX-W: PASS (its re-run of the five FX-W test files: 39/39). This row covers three follow-ups with the same rules, paths and rollback folder; `packages/shared/src/i18n/en/session.ts` was added to the paths after FX-C finished. Rollback copies of the state before this row's edits: `.cache/rollback/FX-W/fx-w2/` (8 files, `SHA256SUMS` verified OK). The pre-FX-W originals stay in `.cache/rollback/FX-W/`.

| # | Item | Change | Tests | Mutations caught |
|---|---|---|---|---|
| W2-1 | Ruling: the own-record rule (E2E-W1-4) in **Live mode only** | `metadata-tab.tsx`: the foreign-package branch needs `live && !packageDescribesItem(…)`. In Simulated mode a re-dated record keeps the package as its metadata (manifest fields, tree, no notice) on every day. The branch's dead Simulated alternatives were removed; docblock and the i18n comment (`evidence.metadata.foreign`) now say "Live mode only" | `efix-integrity-metadata.test.tsx`: the Simulated "another record" case rewritten to prove the opposite (re-dated row → `data-package="demo"`, manifest fields, tree, no notice); new route test with a simulator dated **2026-10-06** (item 0012's ID `EV-20261006-0012` ≠ package `EV-20261001-0012`, join still gives package 0012) → detail page Metadata `demo`, manifest fields, no notice. Live: `live-efix-evidence.test.tsx` unchanged; it proves the notice appears for `EV-20261006-0012` | 2/2 |
| W2-2 | Stale RESIDUAL-W70-1 comments | Comments only. `features/paired-devices/devices-panel.tsx:31-35` (+ the inline comment at `:50`) and `features/devices/device-drawer.tsx:364-367` (+ the inline comment at `:392`) now say the residual was closed by FX-C (R4 of D201, gated in D202). The Core publishes one debounced `admin.changed DEVICES` (1 s quiet, 5 s cap) on device socket admission/departure and device sign-in/out. The tablet-link refetch stays as a second path | none needed; a check confirmed that no changed line in the two files is code (every `+`/`-` line of the diff against the rollback copy is a comment) | n/a |
| W2-3 | The note drawer's title follows the signed-in role | `session-monitor/action-bar.tsx` `NoteAction`: `useSim(selectRole)`; the drawer heading and dialog name are `session.actions.sessionNote.drawerTitleBy.<role>` ("Supervisor note" / "Investigator note" / "Technician note"), the same words as FX-C's timeline labels. **Decision:** the action's subtitle follows the role too ("Add supervisor note" / "Add investigator note"), because it carried the same mislabel. The neutral keys, used only without a role, became "Session note" / "Add a session note". `data-role` on the drawer | new `src/test/live-session-note-role.test.tsx` (4): Simulated SUPERVISOR → "Supervisor note" heading, dialog name and subtitle, no "investigator note"; Simulated INVESTIGATOR → "Investigator note"; the words match FX-C's `timeline.noteBy` and the neutral fallback names no role; Live SUPERVISOR session → "Supervisor note" | 3/3 |

### Mutations (`assets/11b_mutations.log`, section "FX-W2")

- W2-M1 rule in both modes again (the FX-W shape) → 2 failed (both Simulated tests).
- W2-M2 rule dropped in Live too → 1 failed (the Live notice test).
- W2-M3 drawer title back to the fixed key → 3 failed.
- W2-M4 subtitle back to the fixed key → 3 failed.
- W2-M5 `drawerTitleBy.SUPERVISOR` = "Investigator note" (the old wording) → 2 failed.

5 of 5 caught; the no-mutation baseline of the three files passed 20/20.

### Ledger

| Check | Command | Result |
|---|---|---|
| Targeted | `npx vitest run src/features/evidence/__tests__/efix-integrity-metadata.test.tsx src/test/live-efix-evidence.test.tsx src/test/live-session-note-role.test.tsx` | 3 files, 20 passed |
| Neighbours | `npx vitest run --maxWorkers=2 src/features/session-monitor src/test/live-session-monitor-{actions,panels}.test.tsx src/test/live-session-note-role.test.tsx src/features/evidence src/test/live-efix-evidence.test.tsx src/test/live-evidence-verify.test.tsx src/test/live-paired-devices-list.test.tsx src/test/live-devices-drawer.test.tsx src/components/composed` | 18 files, 172 passed |
| Shared | `npx vitest run test/i18n.test.ts test/i18n-vocabulary-sync.test.ts test/session-custody-actor.test.ts` (in `packages/shared`) | 3 files, 58 passed |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Full suite (once, final tree) | `npm run test -- --maxWorkers=2` (12:16:03-12:18:11, load 4.67 at start) | **109 files, 1427 tests passed, exit 0**, 127 s (`assets/11b_w2_full_suite.log`) |

### Files (FX-W2)

Changed (lines counted against `.cache/rollback/FX-W/fx-w2/`):
- `apps/core-web/src/features/evidence/metadata-tab.tsx` (+18 −16)
- `apps/core-web/src/features/evidence/__tests__/efix-integrity-metadata.test.tsx` (+62 −28)
- `apps/core-web/src/features/paired-devices/devices-panel.tsx` (+9 −5, comments)
- `apps/core-web/src/features/devices/device-drawer.tsx` (+7 −5, comments)
- `apps/core-web/src/features/session-monitor/action-bar.tsx` (+13 −3)
- `packages/shared/src/i18n/en/session.ts` (+17 −2)
- `packages/shared/src/i18n/en/evidence.ts` (+3 −3, comment)

Created: `apps/core-web/src/test/live-session-note-role.test.tsx`.

No lane, browser, server or device was used in this row; no git write.

### Notes for the controller

1. In Live mode, EV-20261006-0012 on lane 3 still shows the notice (captured in FX-W, `11b_after_d3_metadata_tab.png`). Simulated mode is back to the pre-FX-W presentation on every day; the stored-verification display is unchanged in both modes.
2. W2-3 changed two neutral values: `sessionNote.subtitle` "Add investigator note" → "Add a session note", and `drawerTitle` "Investigator note" → "Session note". Both are used only by `action-bar.tsx` and are shown only without a role. Nothing in `apps/mobile` reads them (searched).

