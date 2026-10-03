---
task_id: 2026-09-30_dems_demo_stack_setup
step: 51
plan_row: 02_plan §4 W-17 (Security & Audit page)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D28, D41(d), D49, D61, D63, D67, D70, D71, D72, D74 (review-40 page rules R1–R10)
---

# Step 51: Web Security & Audit page (`/security-audit`)

**Outcome: PASS.** Every row-51 check passes (§3), with command output and browser measurements.

- The step-38 stub is replaced. The export name `SecurityAuditPage` and the root `data-testid="page-security-audit"` are kept (19_app_shell §2).
- The page has ten regions:
  - header banner;
  - posture shield (the hero moment);
  - nine-item controls checklist;
  - keys and certificates (the DEMO Ed25519 certificate, D67);
  - hash-chain strip with the EVT-30 discontinuity Alert;
  - virtualised audit log (TanStack Table v8 model; kit `Table` inside React Aria `Virtualizer` + `TableLayout`);
  - authentication, tamper and custody lenses;
  - RBAC view of the three demo operators;
  - RBAC-gated "Export audit" dialog. The reason is required (SIM-GAP-W51-1).
- **AC-55 UI path.** After `inject('AUDIT_TAMPER')` the chain view reports FAIL at exactly the index the simulator's `verifyAuditChain()` returns. This is shown in the unit test and in the browser (index 77, entry #78, `HASH_MISMATCH`, at both viewports).
- **Gates.** core-web typecheck, lint and test exit 0 (26 files, 320 tests; 18 of them are this step's). The shared i18n test gives 14/14; shared typecheck and lint exit 0.
- **Browser.** Headless Chromium on the shared Vite 127.0.0.1:5178 (P14), at 1920×1080 and 1440×900:
  - idle: 60 fps with no long task after mount;
  - at most 2 of 4 ambient slots used;
  - reduced motion: 0 loops and 0 running animations;
  - 20 screenshots, `implementation/assets/30_*.png`.

Run 2026-10-01 05:30–06:53 WIB from `/Users/gsp-budi/Documents/DEMS`.
- No `npm install`; no `package.json` or lockfile edit.
- `packages/shared/src/sim/**` was not written, and no other feature, shell file or route was touched.
- Nothing was committed.

## 1. Files

**Feature folder `apps/core-web/src/features/security-audit/`** (all new except `index.tsx`, which replaced the stub):

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 105 | `SecurityAuditPage`: grid; the deferred audit context; staged mount (DR-51-6) |
| `security-audit.css` | 909 | Feature-scoped `sa-*` styles (theme tokens only, opacity/transform motion only) |
| `model.ts` | 470 | Pure logic: `verifyChain` (per-row chain status, same rule and first break as the simulator), identity-stable row views, filters, `stripBlocks`, the 9 controls, posture and escalation, lens predicates, RBAC matrix, expiry |
| `sim-adapter.ts` | 256 | SIM-GAP-W51-1 `exportAuditWithReason`; SIM-GAP-W1 (D67) key entries from `@dems/shared/demo-data`; guarded package join (M4/R2): `guardedPackageOf`, `packageIntegrity`, `packageExportOf` |
| `use-security-data.ts` | 91 | `useDeferredAudit`, `usePosture`, `useControls`, 1 Hz and 1-minute clocks (R8), `useEscalationCount` (R8 one pulse) |
| `audit-context.ts` | 19 | `AuditLogContext`: the deferred audit slice for the panels |
| `panel.tsx` | 115 | `Panel` (kit `Card` plus the mockup header and the M-PG-SEC beat) and `PanelErrorBoundary` (rate-limited retry 3 s → 6 s → 12 s, max 3) |
| `choreography.ts` | 72 | M-PG-SEC beats, hero variants, stagger containers |
| `status-banner.tsx` | 67 | Page-header banner (posture, controls count, chain state; one halo pulse on escalation) |
| `posture-panel.tsx` | 159 | Posture shield hero (Lucide ShieldCheck / ShieldAlert / ShieldX / ShieldQuestion), bloom on enter, icon cross-fade, halo on escalation, stats |
| `controls-panel.tsx` | 112 | Read-only `ListBox`; the check paths draw 80 ms apart |
| `keys-panel.tsx` | 121 | `Label` / `Description` / `Chip` (DEMO, SIMULATED, hardware-bound, expiry) |
| `chain-panel.tsx` | 305 | `TagGroup` / `Tag` strip of the last 12 blocks; the head breathes; a broken block holds a red breath until acknowledged; discontinuity `Alert` (Show in log, Acknowledge); Verify chain (Spinner → TextScramble → PASS/FAIL chip) |
| `audit-log-panel.tsx` | 663 | Filters (`SearchField`, `Select` × 3), Live `Switch`, the virtualised `Table` (TanStack model), row reveal (M-C-11 / M-C-07), focus from the strip, RBAC export trigger |
| `export-audit-dialog.tsx` | 237 | `Modal`: reason `TextField`/`TextArea`/`FieldError`, chain-break warning, custody `Stepper` (pipeline), result |
| `feed.tsx`, `use-newest.ts` | 57, 29 | Lens lists through MU `AnimatedListItem` (M-C-07); the newest-arrival highlight; stable lists |
| `auth-panel.tsx`, `tamper-panel.tsx`, `custody-panel.tsx`, `rbac-panel.tsx` | 95, 93, 101, 113 | The four lenses (§2) |
| `tones.ts`, `log.ts` | 57, 26 | Tone maps; structured dev-console error record |
| `__tests__/security-audit.test.tsx` | 441 | 18 tests (§3.2) |

**Shared i18n namespace (P6):** `packages/shared/src/i18n/en/security-audit.ts`, 313 lines, about 231 leaves.
- The change is additive: all 39 step-34 keys keep their values.
- New groups: `banner`, `posture.*`, `controls.items/status`, `audit.*` (filters, Live, count), `chain.*`, `keys.*`, `exportAudit.*`, `auth`, `tamper`, `custody`, `rbac`.
- The shared i18n rules still hold (no "stop session/recording", well-formed placeholders, `_one`/`_other` pairs).

**Evidence (my renders, no designer pixels):** `implementation/assets/30_{1920,1440}_{enter_mid, idle, lower, tamper, tamper_in_log, live_recording, reduced, export_running, export_done, export_rbac_tooltip}.png`.

## 2. What the page shows (01_specs §14.5.7; research/04 §5.5; brief)

| Region | Data (simulator / demo-data) | Kit and items | Motion (03_motion_spec) |
|---|---|---|---|
| Header banner | Posture, controls count, chain state | Page-header `status` slot | Label cross-fade 120 ms; one halo on escalation (R8, M-C-10) |
| Posture shield (hero) | `security.posture`, raised to CRITICAL when the page finds a chain break; UNKNOWN until hydrated | `Card`, Lucide shields | Scale 0.9 → 1 with a bloom (hero, M-PG-SEC); icon cross-fade; halo plus GlowLayer bloom on escalation |
| Controls (9) | TPM 2.0, Secure Boot, key custody, AES-256-GCM, Ed25519 manifest signature (DEMO), audit hash chain (the page's own verification), secure timestamp (GNSS/NTP locked; RTC → attention), enclosure tamper switch, signed firmware | Read-only `ListBox`, `Chip` summary | Check paths draw 80 ms apart |
| Keys & certificates | DEMO device certificate (Ed25519, CN, SHA-256 fingerprint, serial, validity), DEMO signing key (key ID, public key), TLS server (simulator, SIMULATED), TPM-resident hardware root | `Label`, `Description`, `Chip` (DEMO / SIMULATED / expiry at > 90 d green, ≤ 90 d amber, expired red) | Static |
| Hash chain | Last 12 `audit.rows` as blocks (entry number, short hash, category bar), head, genesis; a break older than the strip is pinned in front of it with a gap marker | `TagGroup` / `Tag` (single selection → inspect line), `Alert`, `Button`, `Spinner`, `Chip` | Links light 0.3 → 1, 80 ms apart; the head breathes (`glowBreath`, the page's 1 ambient loop, §9.4); a broken block holds a red breath until acknowledged (P7); the Alert slides in 240 ms; Verify: Spinner 480 ms, TextScramble 0.8 s over `0-9a-f`, bouncy chip, no shake (M-C-21) |
| Audit log | All kept rows (ring ≤ 1,000): entry, time and date, event label with refs / fault kind / auth method, actor (operator, System, or Unverified user for failed sign-ins), category chip, severity dot, chain-link status plus short hash | TanStack Table v8 (sorting, column filters, global search) → kit `Table` in `Virtualizer` + `TableLayout`; `SearchField`, `Select` Type / Severity / Operator, `Switch` Live | First-load rows stagger 30 ms (first 10); filter and sort cross-fade 160 ms (M-C-11); live rows enter from −12 px / 0.98 with the vendor spring and a 0.18 → 0 gold highlight over 1.5 s (M-C-07 values) |
| Authentication | Sign-ins and failures in the ring; live lockout (whole seconds in the selector, R8); failures in the 5-minute window; newest 5 AUTH rows | `Chip`, feed | `AnimatedListItem` insertion |
| Tamper & integrity | Enclosure switch; the chain; DEMO packages "12 PASS • 1 FAIL" ("DEMO - precomputed", EV-…-0005 AUDIO-02); newest tamper rows (EVT-12, EVT-30, verify failures) | Tiles, `Chip` | As above |
| Export & chain of custody | EVIDENCE_EXPORTED, EXPORT_DENIED, AUDIT_EXPORTED rows with operator, reason and destination; the DEMO package export `EXP-000031` with zip SHA-256 and authorization `AUD-000039` (§19.2, §19.3) | Feed | As above |
| Access control | The 3 demo operators (initials, rank and name, ID, role, last sign-in, "You"); the role × 9-permission matrix from `ROLE_PERMISSIONS` | `Avatar`, `Chip`, kit `Table` | Static (memoised) |
| Export audit | `selectCan(AUDIT_EXPORT)`. The Investigator gets a disabled trigger whose Tooltip reads "Requires the Supervisor role" (S20). The Supervisor gets the dialog: reason ≥ 5 characters, sim `exportAudit()`, result (export ID, entries, chain head, chain at export, reason) | `Tooltip`, `Modal`, `TextField` / `TextArea` / `FieldError`, `Stepper` | Stepper pipeline 220 ms per step (reduced: instant) |

**Error handling (frontend rules):**
- Layer 1: friendly toasts and inline messages on verify, acknowledge and export failures, and on refusals (403 / 401 / 422).
- Layer 2: a structured record (level, source, message, stack, context, timestamp) through `log.ts`. It goes to the dev console only, because mock-core has no client log endpoint (D41(g)). The export reason is never logged, only its length.
- Layer 3: each panel has its own error boundary with the shared rate-limited retry.

## 3. Verification (fresh)

### 3.1 Row-51 checks

| # | Check (row 51) | Command / method | Result |
|---|---|---|---|
| 1 | Render test asserts the page and the §14.5.7 panel test IDs | `npx vitest run src/features/security-audit --maxWorkers=2 --reporter=verbose` (cwd `apps/core-web`) | ✓ "renders the page, the header banner and every §14.5.7 panel with no missing i18n key". Checked IDs: `page-security-audit`, `page-header`, `security-banner`, `panel-{posture,controls,keys,chain,audit,auth,tamper,custody,rbac}`, `audit-table`, `chain-strip`, `rbac-matrix`; 9 control options; 12 strip blocks; `getMissingI18nKeys()` = [] |
| 2 | After `inject AUDIT_TAMPER` the chain view reports FAIL at the tampered index (AC-55 UI path) | same run; browser (§3.3) | ✓ "AC-55 UI path…". `chain-status` gets `data-chain-status="FAIL"`, and `data-break-index` / `data-break-seq` equal `sim.actions.verifyAuditChain()`'s `index` / `seq`. The Alert reads "breaks at entry #<seq>". The strip block and the table row have `data-chain="BROKEN"`. Banner and shield go CRITICAL and the HASH_CHAIN control FAILs. "Verify chain" gives FAIL. `clearFault` returns PASS. Browser: `{"ok":false,"checked":77,"index":77,"seq":78,"reason":"HASH_MISMATCH"}` against page `FAIL 77 78 CRITICAL` at both viewports |
| 3 | core-web typecheck, lint, test exit 0 | `npm run typecheck -w @dems/core-web`; `npm run lint -w @dems/core-web`; `npm test -w @dems/core-web -- --maxWorkers=2` (06:52 WIB) | exit 0 / exit 0 / exit 0; `Test Files 26 passed (26)`, `Tests 320 passed (320)` |

### 3.2 Unit tests (18, `__tests__/security-audit.test.tsx`)

The fixture: the manual clock is set to 2026-10-01 10:00 WIB, so the dataset joins the step-93 packages. The viewport is mocked to 600 × 1600, so React Aria virtualises about 15 rows, as it does in the browser.

| Group | Tests |
|---|---|
| `verifyChain` = simulator | Pristine PASS with every row LINKED (cached per slice). AUDIT_TAMPER at the default and at a targeted index gives the same index, seq and reason as `verifyAuditChain`, with exactly one BROKEN row. Seq gap and head mismatch follow the simulator order. An old break is pinned in front of the strip |
| Model and adapters | 9 controls: all OK when pristine; HASH_CHAIN FAIL on a break; RTC → attention; UNKNOWN before hydration. `roleFor(AUDIT_EXPORT)` = SUPERVISOR. A short reason gives 422 and the simulator is **not** called. A valid export returns the AUDIT_EXPORTED receipt. The keys show Ed25519 DEMO rather than ECDSA. Packages: 1 FAIL (0005, AUDIO-02), the guard rejects a mismatched subject. Tamper-row classification |
| Page | Render (row check 1). AC-55 (row check 2). Virtualised table (fewer DOM rows than entries; newest first; search "evidence sealed", type Authentication, Clear filters; Live off holds back "1 new entry" and resumes). Export gate for the Investigator (`aria-disabled`, label "Requires the Supervisor role"). Supervisor export: an empty reason shows the inline error and does not call the simulator; a valid reason writes AUDIT_EXPORTED, the result shows the ID and reason, and the custody lens lists it. DEMO certificate and package verdicts, 3 operators, 10 matrix rows. Five failed sign-ins show "Locked, N s left" while the signed-in operator stays signed in. A live row carries the fresh highlight |

**Mutation checks (tests are not vacuous).** Each file was restored from its backup and `cmp` confirmed it identical.
- (a) Disabling the hash recomputation in `verifyChain`: **3 failed** (both model chain tests and the AC-55 page test).
- (b) Bypassing the RBAC gate (`canExport || true`): **1 failed** (the Investigator gate test).

### 3.3 Browser (headless Chromium, CDP)

**Method:**
- **Browser and server.** `chrome-headless-shell` 1243 over CDP (a scratch harness, `scratchpad/s51/cdp-check.mjs`), against the shared Vite dev server on 127.0.0.1:5178 (P14).
- **Sign-in.** `dems.auth` was seeded in sessionStorage with OPR-001, and OPR-002 for the export run.
- **Measurements.** fps from a rAF counter; long tasks from PerformanceObserver; ambient loops from the `?debug=1` overlay's `data-*` attributes.
- **Faults.** Injected through the page's own simulator, found via the React fiber (inspection only).

| Scenario | 1920×1080 | 1440×900 |
|---|---|---|
| Idle, `?debug=1`, 5 s after enter | **60.1 fps** (worst frame 17 ms). 1 long task, at mount (116 ms). Ambient **2/4** slots: `clock-colon, secure-dot, topo-drift` (1 shell slot) + `chain-head` | **60.0 fps** (17 ms). 1 long task at mount (121 ms). Ambient 2/4, chain head included |
| AUDIT_TAMPER escalation (3 s) | 60.3 fps (17 ms). FAIL 77 / 78, banner CRITICAL. Loops `…, secure-beam, chain-break` (≤ 4). 1 long task, 74 ms. Show in log focuses entry 78. `clearFault` → PASS | 60.2 fps. Same verdict. Long tasks 54–70 ms × 4. Entry 78 focused and scrolled into view |
| Recording scenario, 12 s live stream (4 new rows) | 56.8 fps (worst 183 ms). 4 long tasks: 157 ms at scenario load, then 141, 132 and 177 ms on insertions | 55.7 fps (worst 267 ms). 5 long tasks: 163 ms at load, then 250, 118, 82 and 132 ms |
| Reduced motion (`prefers-reduced-motion: reduce`, reload) | `data-motion="reduced"`, **0 ambient loops, 0 running animations**, 58.2 fps | same; 57 fps |
| Export (OPR-002) | Dialog → Stepper → result `EXP-000001`, 82 entries, chain PASS, reason shown. Last audit row is `AUDIT_EXPORTED` | same |
| RBAC (OPR-001) | Trigger `data-disabled="true"`; keyboard focus shows the tooltip "Requires the Supervisor role" | same |
| Overflow and console | No horizontal page overflow. Console: no errors. The only warning is Motion's dev notice under emulated reduced motion | same |

**Context for the numbers (P11):**
- **Dev server.** The numbers come from the dev server: unminified React with StrictMode double renders.
- **Machine load.** Up to 16 agents were running at the same time. The load average was 5–36 over the session (5–15 during the final pass).
- **Earlier runs.** Before the optimisations in DR-51-6 and DR-51-7, the same live run showed 46.7 fps and long tasks up to 667 ms.
- **What counts for AC-71.** AC-71 (≥ 55 fps; ≤ 3 long tasks in 30 s of Session Monitor recording) is measured by step 58 on the production build in windowed Chrome with GPU (D70).
- **Budgets met here.** Loops ≤ 4 at all times. Reduced motion is static.

**Motion greps (my folder):**
- MS-01 `grep -rnE "animate=\{\{[^}]*(width|height|top|left)"`: exit 1.
- MS-02 `box-shadow` with `animate|transition` in `*.tsx`: exit 1.
- MS-03 `will-change`: exit 1.

**Visual check against D1 G and SM N / T:**
- The gold-on-charcoal card language matches the mockups: tracked uppercase card titles with gold icons, the oblique gradient page title, and a status banner in the SM style.
- The controls read like SM N; the audit rows read like SM T, extended to a full table.
- The hash chain is new, derived UI, built from kit parts.

## 4. SIM-GAPs (P6, R10) and relays

| ID | Gap | Local handling | Owner |
|---|---|---|---|
| **SIM-GAP-W51-1** | `exportAudit()` takes no request. The AUDIT_EXPORTED row has no purpose or reason (§19.2 item 8, §19.3 rule 2), while `exportEvidence` takes `{reason, destination}`, returns 422 under 5 characters, and writes `details.reason` | `sim-adapter.ts` `exportAuditWithReason` enforces `EXPORT_REASON_MIN_LENGTH` (422 without calling the simulator), calls `exportAudit()`, and reads the new row for entries, head and chainOk. The reason is shown only in the dialog result ("Shown here only: the demo simulator does not record the export reason yet") | Step 54: add `exportAudit(request: ExportRequest)` with 422 and `details.reason` / `destination`; then pass the request through and drop the note |
| SIM-GAP-W1 (D67 (c), existing) | The simulator lists the device certificate as ECDSA P-256 and the signing key as SIMULATED-SHA256; the packages use Ed25519 | `keyEntries()` shows the package certificate and key (DEMO), and keeps the simulator's TLS server (SIMULATED) | Step 54 (review-40 §5.c) |

`grep -rn SIM-GAP- apps/core-web/src/features/security-audit` lists the markers in `sim-adapter.ts`, the doc comments and two test names.

## 5. Decisions, drift and findings

| ID | Kind | Item |
|---|---|---|
| DR-51-1 | drift (layout) | Row 1 is posture 3 \| controls 5 \| keys 4, then the chain strip (12), then the audit log (12), then the lenses (4/4/4), then access control. research/04 §5.5 proposes posture 4 \| controls 8 / log / chain 8 \| keys 4. Moving the strip above the table keeps the EVT-30 story (strip, Alert, shield) in the first viewport at 1920 and 1440. The enter choreography follows reading order with the shield first (R1, R3) |
| DR-51-2 | decision (brief over spec) | The audit log is **virtualised**, as the brief asks, instead of §14.5.7's `Pagination`. It uses React Aria `Virtualizer` + `TableLayout` (re-exported by `@heroui/react`; the HeroUI table CSS supports virtualised mode) with TanStack Table v8 as the model. No new package: `@tanstack/react-virtual` is not a dependency (P1) |
| DR-51-3 | drift (spec) | §14.5.7's `DateRangePicker` is not built. The brief names the filters type / severity / operator, and the ring spans about two days (82 rows at load). The key `securityAudit.audit.dateRange` is kept for a later addition |
| DR-51-4 | decision | The "Type" filter uses the 8 audit categories (`common.auditCategory`) instead of 44 raw types. Free-text search covers the event labels |
| DR-51-5 | decision (M-C-07 in a virtualised table) | Live table rows take M-C-07's values (−12 px / 0.98 → rest, vendor spring {350, 40}, gold 0.18 → 0 over `HIGHLIGHT_FADE_MS`, imported from `animated-list.tsx`) inside the cells. The copy-in `AnimatedListItem` with `layout` would fight the virtualizer's positioning. The lens feeds use `AnimatedListItem` itself |
| DR-51-6 | decision (performance) | Staged mount: the first commit renders the header, row 1 and the strip; the audit table and then the lenses and RBAC follow in two React transitions, with placeholders reserving their height. The mount long task went from 595–773 ms to 116–300 ms (dev) |
| DR-51-7 | decision (performance, §9.3) | The page subscribes to `s.audit` once and gives the panels a `useDeferredValue` copy through `AuditLogContext`. The panels are memoised and take primitives. The row views are identity-stable (cached per audit row object), so React Aria's collection renders only new rows (probed: 4 appends → 4 row renders). Lens lists stay stable when unrelated entries arrive. Live-stream fps went from 46.7 to 56.8 at 1920 |
| DR-51-8 | decision | Strip blocks use single-selection `TagGroup` plus an inspect line (full entry, previous hash, hash, Show in log) instead of a Tooltip per block (§14.5.7 lists Tooltip). Tooltips inside grid tags conflict with tag keyboard navigation, and the inspect line is readable on a presentation screen |
| DR-51-9 | decision | The export dialog's custody Stepper (authorize → verify → build → hash and seal → write custody event, §19.3) plays at 220 ms per step over **one** synchronous `exportAudit()` call made before the animation. Each step's status reflects the real result: verify shows `warn` when `chainOk` is false. Reduced motion: instant |
| DR-51-10 | decision | The i18n change is additive. The step-34 keys stay (for example `controls.tpm`, `chain.block`, `keys.keyReference`) because the mobile lane reuses web namespaces. The page renders the new `controls.items.*` copy |
| DR-51-11 | decision | The page verifies the chain itself (`model.verifyChain`, the simulator's rule and order, tested equal on pristine, tampered, gap and head cases), because the table needs a status per row. "Verify chain" calls the simulator's `verifyAuditChain()`. Row hashes are cached per row object, so an append costs one SHA-256 |
| DR-51-12 | decision | The shown posture is the simulator's, raised to CRITICAL whenever the page finds a break. The simulator already does this for AUDIT_TAMPER; the rule covers any other break |
| DR-51-13 | decision (P13, R2/M4) | Package verdicts are the generator's precomputed report, labelled "DEMO - precomputed", joined by evidence suffix **and** case number plus subject. At load that gives 12 PASS and 1 FAIL (EV 0014 exists only after the recording scenario seals). The page never shows `actions.verify()` as a package verdict (M3 (a)) |
| DR-51-14 | decision | The RBAC-disabled "Export audit" is a `Tooltip.Trigger` styled as a disabled outline button (`aria-disabled`, name plus hint), because a disabled kit Button cannot open a tooltip. Keyboard focus shows it (verified) |
| DR-51-15 | bug found and fixed (browser, test-first) | React Aria's Virtualizer reuses row views for other items, so a new row reused a cell with the old per-mount state and showed no fresh highlight. `RowReveal` is now keyed by row ID; the test "appends a live row with the fresh highlight" covers it |
| DR-51-16 | bug found and fixed (browser) | At 1440 the strip overflowed and hid the head block, which also paused its loop (R10). Narrower gaps below 1600 px plus auto-scroll to the head fixed it: `chain-head` runs at 1440 |
| F-51-1 | finding (P11, shared Vite) | The first visit optimised `@tanstack/react-table` in the shared deps cache and triggered one full reload ("optimized dependencies changed. reloading"). Other TanStack pages (step 47) see this once. Later runs were clean. Other steps' HMR (`index.css`, evidence files, `dashboard.ts`) reloaded the page once during a 1440 run; it was re-run |
| F-51-2 | finding (steps 58, 40) | The dev server double-renders under StrictMode, which inflates long tasks. AC-71 should be read on the production build (step 58), as D70 notes for AC-71 |
| F-51-3 | incident (P6), disclosed | While probing the simulator at 05:37 WIB, a helper command copied my scratch probe into `packages/shared/.audit-probe.tmp.ts` for a few seconds. It was never imported or run from there. It was deleted at once (`ls … \| grep -c probe` → 0). No other out-of-scope write |
| F-51-4 | note (P7 / P14 hand-over) | I started the shared Vite server (PID 95238, `.locks/vite.pid`, log `.locks/vite.5178.log`). At release `.locks/vite.users` still held `step-47`, so under P14 the server keeps running and the last user stops it. Every headless Chrome I launched (for example PIDs 96869, 97719, 24444, 26781, 28178) was stopped by the harness. Afterwards `pgrep` found none of my profiles, and ports 9451–9460 were free |
| F-51-5 | P11 record | 05:58 WIB: `tsc` showed 40 errors, all in `features/evidence/**` and `features/devices/**` (steps 47 and 48 mid-edit), 0 in mine. 06:01: `routes.test.tsx` failed 4 tests on missing `devices.css` / `storage.css` (steps 48 and 49 mid-edit); `/security-audit` passed. Final runs at 06:44 and 06:52: typecheck 0 errors; 26/26 files, 320/320 tests |

**Review-40 page rules applied (D74 relay):**
- R1: no `useSim(selectSystemState)`; every selector returns primitives or store-owned references.
- R8: 1 Hz and 1-minute clocks; lockout seconds are derived inside the selector.
- R9: `demoIdSuffix` / `getDemoEvidencePackage` are reused; there is no new suffix parser.
- R10: gaps are logged in `sim-adapter.ts`.
- R2 / M4: the guarded join is used.

## 6. Parallel-run notes (P1–P18)

- **P1:** no install; no manifest or lockfile edit.
- **P6:** wrote only the feature folder, the `security-audit.ts` namespace, my test, this report, the 20 screenshots and `delegation_progress/coder_execution_step_51.md`. See F-51-3.
- **P9:** vitest ran with `--maxWorkers=2`; no `vite build`.
- **P10:** per-command sandbox bypass for the Vite bind, local HTTP/CDP and Chrome.
- **P14:** acquired and released under `/usr/bin/lockf -k .locks/vite.lock`; see F-51-4.
- **P8:** the shared tracking files (`masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `99_implementation_report.md`) were not written.

---
*Generated: 2026-10-01 06:55 WIB*
