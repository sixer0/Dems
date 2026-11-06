---
task_id: 2026-09-30_dems_demo_stack_setup
step: 47
plan_row: 02_plan §4 W-13 (Evidence list, detail and export wizard; blueprint row 47, rev 4)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D28, D38, D41(d)(g), D49, D50, D61, D63, D67, D70, D71, D72, D74 (review-40 relay)
---

# Step 47: Evidence list, detail and export wizard

**Outcome: PASS.** Every row-47 check passes (§2), and the browser check at 1920×1080 and 1440×900 passes (§3).

- **List (`/evidence`).** Built from the simulator's 13 items with the TanStack Table models rendered through the kit `Table`: sort, status/subject-type/investigator/date filters, search, and 10 rows per page (AC-64). Rows reveal, FLIP and cross-fade.
- **Detail (`/evidence/$evidenceId`).** Three tabs:
  - **Media** plays VIDEO-01/02 and the separate MIC 1/MIC 2 tracks from the package's own paths, in sync and under the excerpt rule.
  - **Metadata** shows the §11.3 fields, the §11.2 package tree and the raw documents.
  - **Hash & Integrity** runs the **real** `verifyDemoPackage` re-verification. EV 0001 gives PASS with every check recomputed in the browser. The tampered EV 0005 gives FAIL on `track:AUDIO-02` only.
- **Export wizard.** Steps run Reason → Authorise (RBAC through the simulator) → Verify source → Export.
  - The export writes a custody entry and an EVIDENCE_EXPORTED audit row.
  - EV 0004 downloads the real `EXP-000031.zip`. Its SHA-256 `d888f544…ea059e97` equals its `export-manifest.json`.
  - Other items download a DEMO export manifest JSON.
- **Gates.** core-web typecheck, lint and test exit 0: 26 files, 320 tests, of which 28 are new (§2). Four mutations make 5 tests fail (§2).
- **Review 40 relay (D74).** Rules R1–R10, M2, M3, M4 and m12 are applied (§5). Four SIM-GAPs are logged for step 54 (§6).

Run on 2026-10-01, 05:45–07:00 WIB, from `/Users/gsp-budi/Documents/DEMS`. No `npm install`, no `package.json` or lockfile edit, no write under `packages/shared/src/sim/**`, and nothing committed.

## 1. Files

**Feature folder `apps/core-web/src/features/evidence/`** (replaces the step-38 stub; export names `EvidenceListPage` / `EvidenceDetailPage` and root test IDs `page-evidence` / `page-evidence-detail` kept):

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 104 | Light page shells: header and banner, and the not-found state. The bodies are `React.lazy`, with a Skeleton fallback (DR-47-4) |
| `list-page.tsx` | 242 | List body: KPI row, toolbar, table and sticky preview, bulk bar, wizard host. The URL search holds the filters |
| `evidence-table.tsx` | 289 | Kit `Table` with selection checkboxes, sortable headers, a kebab `Dropdown`, `Pagination`, `Skeleton` and `EmptyState` |
| `use-evidence-table.ts` | 114 | TanStack Table v8 models: sorting, filtering (global search plus column filters) and pagination (10 per page, clamped) |
| `use-row-motion.ts` | 105 | M-C-11 row reveal, FLIP and cross-fade with Motion `animate()` on the kit rows, through a MutationObserver (DR-47-5) |
| `toolbar.tsx` | 192 | Kit `SearchField` and a status `ToggleButtonGroup` whose indicator uses `layoutId="tab-active-status"`. Subject-type and investigator `Select`s, and a from/to date range (DR-47-1) |
| `preview-card.tsx` | 141 | Sticky preview: package poster, key-values, package digest line, Open details and Export |
| `detail-page.tsx` | 319 | Detail body: header block, the H-M1 stored-rect header flight, the tabs (URL `?tab=`), and the More menu (Archive, Copy ID, Download manifest) |
| `media-tab.tsx` | 343 | Player with a camera switch, the MIC switch (both MIC tracks loaded and synced; the switch unmutes one) and the excerpt-rule scrub bar |
| `metadata-tab.tsx`, `manifest-summary.ts`, `json-view.tsx`, `json-tokens.ts` | 228 / 80 / 36 / 28 | §11.3 fields, the §11.2 package tree, and exact-bytes JSON viewers (kit `ScrollShadow`) |
| `integrity-tab.tsx`, `check-list.tsx`, `labels.ts` | 250 / 106 / 13 | Verify card, per-check list (M-C-21), sealed values from the package, lifecycle Stepper (M-C-09) and custody `Table` |
| `use-verification.ts` | 267 | The real re-verification hook: paced reveal, labels, the simulated branch, and the audit record |
| `export-wizard.tsx`, `export-download.ts`, `lock-shackle.tsx` | 511 / 195 / 24 | The §19.3 wizard, zip hash check and download, the §19.2 DEMO export manifest, and the RBAC lock shackle |
| `demo-assets.ts` | 106 | ONE glob over `demo-media/{evidence,live}` and `demo-evidence/**`, plus the injectable loader context (DR-47-3) |
| `model.ts`, `selectors.ts`, `choreography.ts`, `chips.tsx` | 222 / 7 / 52 / 138 | Guarded package join (M4), filters, WIB formatting, tones, M-PG-EVID beats, and the status, subject and verdict chips |
| `sim-adapter.ts` | 120 | SIM-GAP-W47-1..4 adapters (§6) |
| `pending-actions.ts`, `use-retry-cooldown.ts`, `clipboard.ts`, `log.ts` | 48 / 59 / 19 / 42 | List-to-detail hand-offs; rate-limited retry (3 s → 6 s → 12 s, maximum 3); copy with a toast; structured error log |
| `evidence.css` | 983 | Feature styles in `@layer components`. Only transform and opacity animate |

**Tests** (own files): `apps/core-web/src/test/evidence-table.test.tsx` (160 lines, the AC-64 file named in 01_specs §14.13) and `features/evidence/__tests__/{harness.ts, evidence-integrity.test.tsx, evidence-export.test.tsx, evidence-media.test.tsx}` (152 / 197 / 191 / 99 lines).

**i18n:** `packages/shared/src/i18n/en/evidence.ts` is now 317 lines, extended additively. Every step-34 key and value is kept, because mobile reuses the web namespaces (DR-47-7).

**Evidence images:** `implementation/assets/26_{list_1920, list_1440, list_sealed_1920, list_sealed_1440, list_reduced_1920, verify_running_pass_1920, verify_running_fail_1440, integrity_pass_1920, integrity_fail_1440, media_1920, metadata_1440, export_denied_1440, export_zip_1920}.png`.

## 2. Row-47 verification (fresh)

| Row-47 check | Command / method | Result |
|---|---|---|
| Evidence-table test (AC-64) passes with a fixture of ≥ 11 rows so page 2 exists | `npx vitest run src/test/evidence-table.test.tsx --maxWorkers=2` | **8/8 PASS**. The fixture is the simulator dataset: 13 rows (asserted ≥ 11 and = 13). Page 1 shows 10 rows and "1–10 of 13"; page 2 shows 3 rows, `?page=2`, with no overlap. Status Sealed shows only SEALED rows (10), both by toggle and by URL. Search matches the ID (`EV-20260930-0005` → 1 row), the case number (`LP/2026/0930-0003` → 0003, 0007, 0009) and the subject (`maya lestari` → 0004). The subject type, investigator and date filters work; a stale page number is clamped |
| Integrity test: PASS for a pristine package, FAIL on exactly one track for the tampered one | `…/__tests__/evidence-integrity.test.tsx` | **9/9 PASS**. EV 0001 through the UI: all 8 checks pass, all `source: computed` (Node WebCrypto), label "DEMO - recomputed", custody VERIFIED and audit EVIDENCE_VERIFIED. EV 0005: failed checks exactly `['track:AUDIO-02']` and 7 passed; the simulator record is tampered on AUDIO-02 with verification FAIL and audit EVIDENCE_VERIFY_FAILED, and there is no "verified" row. A Demo Control Panel tamper on EV 0001 VIDEO-02 gives FAIL on exactly `track:VIDEO-02`. With `subtle: null` the result falls back to labelled precomputed checks (signature and certificate only). The M4 guard, the simulated branch and one-glob path resolution for all 14 packages are also tested |
| A test hashes the prebuilt export zip bytes and matches its export manifest | `…/__tests__/evidence-export.test.tsx` | **7/7 PASS**. `sha256Hex(EXP-000031.zip)` equals `export-manifest.json` `package.sha256`, and the size is 2,276,249 B. `prepareZipDownload` gives `exportPackage ok`. The wizard: reason ≥ 5 characters; an investigator gets the denial Alert with an EXPORT_DENIED audit row; a supervisor exports EV 0004 (custody EXPORTED, EVIDENCE_EXPORTED with exportId and reason) and downloads a Blob of type `application/zip` named `EXP-000031.zip`; EV 0001 downloads the DEMO manifest JSON with all eight §19.2 keys; EV 0005 is blocked after its source FAIL |
| An audio-switch test selects AUDIO-02 | `…/__tests__/evidence-media.test.tsx` | **4/4 PASS**. After the switch, AUDIO-02 is unmuted, AUDIO-01 muted, `data-active="true"` and the radio is checked. EV 0005's AUDIO-02 `src` is the package's altered copy (`demo-evidence/SESSION-SES-20260930-0015/media/AUDIO-02.m4a`). Play starts 3 media elements; the camera switch changes the `src`; the header Play opens the Media tab; the EV 0014 package resolves to the live loops |
| core-web typecheck, lint and test exit 0 | `npm run typecheck -w @dems/core-web`; `npm run lint -w @dems/core-web`; `npm test -w @dems/core-web -- --maxWorkers=2` (06:59 WIB, after the last edit) | **exit 0 / exit 0 / exit 0**. `Test Files 26 passed (26)`, `Tests 320 passed (320)`. oxlint JSON on the feature and the test: 0 diagnostics in 35 files |

**Extra checks**

| Check | Result |
|---|---|
| Shared i18n rules (no "stop session", `{{name}}` placeholders, `_one`/`_other` pairs, no stray whitespace) | `npx vitest run test/i18n.test.ts test/demo-evidence.test.ts` in `packages/shared`: 32/32 PASS. `npm run typecheck -w @dems/shared`: exit 0 |
| Tests are not vacuous | 4 mutations (page size 13; no tamper mirror; audio never muted; join guard without the subject) → **5 tests fail**. All 4 files restored, `cmp` identical |
| AC-72 / MS-01, MS-02, MS-03 on the feature | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)"`: exit 1. `box-shadow` with animate or transition in `*.tsx`: exit 1. `will-change`: exit 1 |
| R2: no `evidenceMedia()` or `evidenceSuffixOf` in the feature | `grep`: exit 1 |
| No write to sim, routes, shell, motion, package manifests or the lockfile | `find … -newer <05:45>`: only `packages/shared/src/i18n/en/evidence.ts` (mine) plus other steps' namespace files. No `src/sim`, `routes`, `components`, `motion`, `vite.config.ts`, `package.json` or `package-lock.json` |

## 3. Browser check (headless Chromium 153, `chrome-headless-shell` 1243, shared Vite 127.0.0.1:5178)

`dems.auth` was seeded in sessionStorage (OPR-001; OPR-002 for the supervisor export). The simulator ran on the real clock, 2026-10-01 06:4x WIB, so the IDs match the packages. The scratch harness is `scratchpad/evi47/cdp-47.mjs`.

| Check | 1920×1080 | 1440×900 |
|---|---|---|
| fps (rAF, 3 s after load) | **60.2** | **60.3** |
| Long tasks over 50 ms after the first 2 s | **0** | **0** |
| Ambient loops (`?debug=1` overlay) | "ambient 1/4": the shell group (clock colon, SECURE dot, topo drift). The page adds 0 (§9.4 "Evidence 0–1") | same |
| Row reveal (M-C-11) | Rows at opacity 0 until the beat, then first row 0.03 → 1 over 1,867–2,095 ms and 10th row → 1 by 2,400 ms (30 ms stagger). The final opacity 1 is committed | same |
| Filter re-flow (FLIP) | Sealed filter: 8 rows FLIP (transform), 2 new rows fade (opacity < 1 at 151–252 ms) | — |
| Status filter / pagination | Sealed → 10 rows, `?status=SEALED`; page 2 → "11–13 of 13" | same |
| Real verify, pristine EV 0001 | **PASS**, 8/8 `computed`; Ed25519 via WebCrypto supported; label "DEMO - recomputed"; custody top VERIFIED; mid-run frame shows 4 done, 1 running, 3 pending | — |
| Real verify, tampered EV 0005 | — | **FAIL**, failed exactly `track:AUDIO-02`, all 8 `computed`; custody top VERIFY_FAILED |
| Media (EV 0005) | Video t = 2.49 s playing (1280 px). AUDIO-01 and AUDIO-02 both playing, drift ≤ 0.16 s. After MIC 2: AUDIO-02 unmuted, AUDIO-01 muted. After Camera 2: the same position (4.57 s) with drift ≤ 0.03 s. fps 60.2 while playing | Metadata: 13 §11.3 fields |
| Export | Supervisor, EV 0004: source verify PASS → accepted (simulator `EXP-000001`) → Download. The zip check `data-ok=true`, and the browser saved **`EXP-000031.zip`, 2,276,249 B, SHA-256 `d888f5449d1eb552c9113cb98a144aa7a9d21f14fa393a2de9c52efcea059e97`**, equal to `export-manifest.json` `package.sha256` | Investigator, EV 0001: denial Alert with the lock shackle ("Export not permitted … recorded in the audit log") |
| Reduced motion (`prefers-reduced-motion: reduce`) | Page `data-motion="reduced"`; rows at opacity 1 and `transform: none` 60 ms after the body appears; ambient loops 0; verify still FAIL on `track:AUDIO-02` (text shown at once) | — |
| Header flight (H-M1 stored rect) | Open details from the preview: the heading starts at `matrix(0.893, …, 681, 507)` (the preview's heading) and settles to `none` over about 1 s, 51 distinct frames | — |
| Console | No exception, no React or i18n warning. Only the mock-core WS and health `ERR_CONNECTION_REFUSED` (mock-core is not started; off 5173 the Core link is offline, P4) and Motion's own "Reduced Motion enabled" notice in the reduced run | same |

The fps and long-task numbers are informational: headless SwiftShader, and AC-71 is measured in windowed Chrome in step 58 (D70).

## 4. Design as built (short)

- **Join and data (D61, P13, review 40 M4/R2).**
  - `joinDemoPackage(item)` accepts a package only when the evidence suffix, the case number, the subject name and the session suffix all match.
  - Every media, metadata, integrity and export file comes from the package index paths.
  - The integrity view shows PACKAGE hashes, the Ed25519 signature and the DEMO certificate. The simulator's synthetic values appear only for items without a package, labelled SIMULATED.
- **Verification (M-C-21).**
  - The computation is real and fast. Results are revealed one per 160 ms (`fast`, time-scaled; immediate under reduced motion): pending → Spinner → check or cross, with the found hash resolving through TextScramble (800 ms, 0-9a-f).
  - PASS pops on the `bouncy` spring with one green glow. FAIL gets a red chip with one glow pulse, no bounce and no shake (P4, P7).
  - A failed run offers a rate-limited retry.
- **Export (§19.2, §19.3, C9).**
  - The order is reason → authorise → verify source → build/record.
  - A denied role calls `exportEvidence`, so the simulator writes EXPORT_DENIED (rule 2).
  - A FAIL source blocks the export (rule 3). The source package is never touched (rule 1).
  - The zip is hash-checked in the browser before it is saved (rule 4).
- **Motion.** The list beats are KPIs at 80 ms (stagger 60), the toolbar at 320, the table at 400 and the rows at 520 plus 30 ms stagger. The detail header comes at 0 and the tabs at 160.
  - Lifecycle Stepper connectors fill stage by stage on mount (70 ms steps).
  - The status toggle indicator glides via `layoutId="tab-active-status"`.
  - The camera switch cross-fades over 320 ms.
  - Reduced motion is opacity only (§8).
- **Error handling.** Every async path has a friendly toast or inline Alert, a structured dev-console record (`log.ts`: level, source, message, stack_trace, context, correlation ID, timestamp; no reason text, only its length) and a fallback: Skeleton, EmptyState, retry with cooldown, or the simulated branch. No persistent endpoint exists (D41(g)).

## 5. Review 40 rules (D74 relay)

| Rule | Applied |
|---|---|
| R1 | No `useSim(selectSystemState)`. Page selectors return store-owned references or primitives (`selectors.ts`, `selectEvidenceStats` members) |
| R2 / M2 | All files come from package paths through one glob (`demo-assets.ts`). `evidenceMedia()` is never used (grep exit 1). EV 0005 plays and hashes its altered AUDIO-02; EV 0014 resolves to the live loops (tested). Precomputed checks carry the label "DEMO - precomputed" |
| M3 | The integrity verdict shown is always the package verdict. The simulator's `verify()` result is shown only for items without a package. SIM-GAP-W47-1 keeps the audit trail consistent |
| M4 | The join guard covers case number, subject and session suffix (tested). A presenter-created EV 0014 with another case or subject shows SIMULATED |
| m12 | demo-data, the DEMO URL map and the verify helpers load only in the lazily loaded body chunk behind the page shell (DR-47-4); nothing from the feature reaches the entry chunk |
| R8 | No 10 Hz selectors. The player text updates on `timeupdate` (≈ 4 Hz) |
| R9 | `demoIdSuffix` and `getDemoEvidencePackage` are reused, with no new suffix parser. The excerpt rule reuses `excerptPositionSec` (module import, not the barrel) |
| R10 | Gaps are logged in `features/evidence/sim-adapter.ts` as SIM-GAP-W47-1..4 (§6). The caseType gap is W47-2 |

## 6. SIM-GAPs for step 54

| ID | Gap | Local adapter | Step-54 fix |
|---|---|---|---|
| SIM-GAP-W47-1 | The simulator's integrity is synthetic, and EV 0005 is pristine in the dataset (D67 (c), review 40 M3) | (1) A package FAIL on one track mirrors into the simulator through its own tamper hook (`inject('TAMPER', {evidenceId, trackId})`) before `verify(id)` records it. This raises a WARNING tamper alert and a FAULT_RAISED row, so the bell shows 1 after verifying EV 0005. (2) A Demo Control Panel tamper on a pristine package flips one byte of that track in memory, so the real hash fails on exactly that track | Seed EV 0005 as `tampered: true, tamperedTrackId: 'AUDIO-02'` at load (review 40 §5.c); the mirror then becomes a no-op. Align the DEVICE_CERT and EVIDENCE_SIGNING_KEY algorithms to Ed25519 |
| SIM-GAP-W47-2 | `EvidenceItem` has no case type, but the route carries `caseType` (review 40 m3) | `caseType` filters by subject type (TERSANGKA / SAKSI / LAINNYA); the Select is labelled "Subject type" | Add `EvidenceItem.caseType` (synthetic); the page then maps the Select to it |
| SIM-GAP-W47-3 | Stored evidence keeps no markers or notes | The Metadata tab shows the package's reason for ending and its custody entries; the scrub bar has no markers | Optional: keep timeline markers on `SessionHistoryEntry` / `EvidenceItem` |
| SIM-GAP-W47-4 | A re-export gets a new simulator ID, but only `EXP-000031.zip` exists. The simulator counter also restarts at **EXP-000001**, below the dataset's EXP-000031 | The prebuilt zip is downloaded, labelled "DEMO prebuilt export package EXP-000031", and the new ID is recorded in the audit trail | Seed the EXP counter past the dataset's highest export ID (≥ 32) |

## 7. Decisions and drift

| ID | Kind | Item |
|---|---|---|
| DR-47-1 | drift (spec §14.5.3 `DateRangePicker`) | The date range uses two kit `Input type="date"` fields. The kit `DateRangePicker` value type needs `@internationalized/date`, which is not a declared core-web dependency (P1, P12). The URL format (`from`/`to` as YYYY-MM-DD) is unchanged |
| DR-47-2 | decision (layout) | The table uses two-line cells (ID over recorded time, subject over its chip, case over investigator, duration over size), so it fits the 8-of-12 column at 1440 (≈ 790 px). The thumbnail column shows at ≥ 1600 px only. Every §14.5.3 column's data is present |
| DR-47-3 | drift (environment) | Vite's default `server.fs.deny` refuses `*.pem` in development, so `device-certificate.pem` is served from `DEMO_DEVICE_CERTIFICATE_PEM` (step 93 generated both from the same file). A test asserts the module text equals the file byte for byte. The certificate check still recomputes the DER fingerprint and self-signature |
| DR-47-4 | decision (performance) | The page shells (header, banner, not found) render at once, and the bodies are `React.lazy` behind a kit Skeleton (M-C-24). Reason: under load average 30–40 the heavier route chunk made the step-41 test "keeps the wrapper for search-only changes" (1 s `findBy`) time out, and the step-38 route test is also cold-load sensitive. It also keeps demo-data out of the first paint (m12) |
| DR-47-5 | drift (M-C-11) | Rows are animated with Motion `animate()` from a MutationObserver, because the kit commits `<tr>`s in its own pass after the collection is built. A parent effect sees no rows, and rows cannot be Motion components. Rows leaving a filter are removed by the kit without the 120 ms fade |
| DR-47-6 | decision | Row click selects the preview at ≥ 1280 px and opens the detail below 1280 px. "Open details", the kebab View and Verify always navigate. Verify hands over through `requestAutoVerify` (the detail search schema carries only `tab`) |
| DR-47-7 | decision (P6, mobile reuse) | The i18n namespace was only extended. The step-34 keys `toolbar.caseType*`, `exportWizard.steps.destination/confirm`, `exportWizard.exporting/success` and `detail.integrity.pass/fail/failDetail` are kept although the web page does not use them all |
| DR-47-8 | decision (§19.3) | The wizard steps are Reason, Authorise, Verify source and Export, following the §19.3 order in research/01, instead of step 34's labels Reason, Destination, Confirm (kept, see DR-47-7). The destination is chosen in step 1 |
| DR-47-9 | decision (H-M1 fallback) | The `evidence-<id>-header` shared element is a stored-rect FLIP with Motion `animate()` (spring `gentle`, after the route delay). The list route has unmounted before the detail mounts, so `layoutId` cannot fly. It is StrictMode-safe (the origin is kept per item). Reduced motion cross-fades |
| DR-47-10 | decision (D6) | The detail tab indicator is the kit's own sliding `Tabs.Indicator` (React Aria SelectionIndicator), not a Motion `layoutId="tab-active-evidence"` |
| DR-47-11 | decision | The detail ID shows the dated prefix dimmed and the join-key suffix bright. The accessible name stays the full ID. The page-header subtitle is the evidence ID, as in the stub, so the step-38 route test's `getByText(id)` stays unique |
| DR-47-12 | decision (D41(g)) | Error records go to the dev console (structured, with a correlation ID), as on steps 38, 39 and 44. No client log endpoint exists |
| DR-47-13 | decision | Both MIC tracks load and play in sync, and the switch unmutes one (a gapless switch). Drift over 0.25 s re-aligns on `timeupdate`. The clip loops while the full-recording clock runs on (`base += excerpt`); p mod excerpt uses `excerptPositionSec` |

## 8. Findings and hand-offs

| ID | To | Item |
|---|---|---|
| **F-47-1** | **controller, 54, 60** | **The strict M4 guard is date-sensitive.** The simulator's case numbers take the date of the dataset's day −1 and day −2 relative to its clock, while the packages carry the `--as-of` day (2026-10-01). On any other calendar day no package joins, and the page falls back to SIMULATED data: no real media and no real verify. Either regenerate steps 92 and 93 with `--as-of <demo day>` before the demo (the step-60 README), or let step 54's durable `joinDemoPackage` compare the case sequence and subject instead of the full dated case number |
| F-47-2 | 54 | SIM-GAP-W47-4: the simulator EXP counter restarts at EXP-000001 |
| F-47-3 | pages with kit `Tabs` (43, 48–53), 56 | jsdom lacks `Element.getAnimations`, which React Aria's SharedElementTransition (the Tabs indicator) calls. `__tests__/harness.ts` stubs it. Other page tests that switch tabs will need the same stub |
| F-47-4 | 41 owner / controller | The step-41 shell tests (`shell-motion.test.tsx`) and the step-38 route tests wait with the default 1 s `findBy`. Under load average 30–40, the cold route-chunk loads time them out (§9, P11). A longer `findBy` timeout in those files would remove the flakiness |
| F-47-5 | 58 | Re-measure AC-71 in windowed Chrome on `/evidence` and during playback. The bulk export (checkbox selection → wizard with N items) is unit-covered through the shared wizard code but was not driven in the browser |
| F-47-6 | 62 | The export reason is written into the downloaded DEMO manifest JSON (user-entered text on the user's machine) and into the simulator audit row. It is never logged to the console (length only) |

## 9. Parallel-run notes (P1–P18)

- **P1:** no install; no manifest or lockfile edit.
- **P6:** wrote only the feature folder, `packages/shared/src/i18n/en/evidence.ts`, the own tests (`src/test/evidence-table.test.tsx`, `features/evidence/__tests__/*`), this log, the `26_*` screenshots and `delegation_progress/coder_execution_step_47.md`.
- **P7 / P14, processes:**
  - `chrome-headless-shell` PIDs 20469 and 34312 were started and killed; port 9347 is free and the scratch profiles are deleted.
  - The shared Vite: I registered `.locks/vite.users/step-47` while the Vite of another step was running (npm 95238 / node 95266). As the last registered user I stopped it under `.locks/vite.lock` (P14 "last user stops it").
  - For a final probe I started Vite again (npm 34217 / node 34240, `.locks/vite.pid` updated), registered, and stopped it again as the last user.
  - Port 5178 is free.
- **P9:** vitest with `--maxWorkers=2`; no `vite build`.
- **P10:** per-command sandbox bypass for the Vite and Chrome port binds, the kills and the CDP harness.
- **P11, noisy runs recorded:**
  - 06:31 (load average 30–40, before DR-47-4): 315/319 with 4 failures, all `findBy` 1 s timeouts in step-41 `shell-motion.test.tsx`. One of them, "keeps the wrapper for search-only changes", was on `/evidence` and was mine: my page's cold chunk load was too slow, fixed by DR-47-4. The other three were shell tests that mount `/dashboard`, the page of step 42, which was being written at the same time. At least one of them demonstrably timed out on `page-dashboard`.
  - 06:37: 316/319 with 3 failures. Two `shell-motion` tests waited on `page-dashboard` (step 42). The third, the step-38 route test "accepts the evidence detail tabs", was mine: `getByText(id)` ran before the lazy body loaded, fixed by DR-47-11.
  - 06:40: 318/319 with 1 failure and 1 failed suite. The failure was "escalation pulses", waiting on the dashboard's ambient slots; the failed suite was step 42's deleted probe file `zz-import-timing.test.tsx`.
  - 06:54 and 06:59 (load average 5): **26/26 files, 320/320**, exit 0.
  - The first typecheck run failed only in `features/session-monitor/details-panel.tsx` (step 44, concurrent); every later run was clean.
- **P8:** `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md` were not written; they are controller files in the parallel run.

## 10. Persistent issues

None. Every failure found was fixed within one repair cycle:
- the kit rows committing after the parent effect (MutationObserver);
- StrictMode cancelling the first verification or flight (refs and cleanup);
- Vite's `*.pem` deny (DR-47-3);
- jsdom's missing `getAnimations`;
- the cold-load test timeouts (DR-47-4).

---
*Generated: 2026-10-01 07:00 WIB*
