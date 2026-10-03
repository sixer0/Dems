---
task_id: 2026-09-30_dems_demo_stack_setup
step: 87
plan_row: 05_mobile_plan M-15 part a (Operator Audit View, 04_mobile_specs §4.16)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete (fast lane D75; device tamper frames deferred to step 59, D112)
decisions: D17, D55, D66, D73, D75, D78, D82, D87, D100, D103, D105, D112
---

# Step 87: Mobile Operator Audit View (`/audit`)

**Outcome: PASS on the fast-lane gates (D75).** At 10:30 WIB:
- `npm run typecheck -w @dems/mobile` exit 0;
- `npm run lint -w @dems/mobile` exit 0;
- `npx jest src/features/audit --maxWorkers=2` exit 0, with 2 suites and 12 tests.

One phone-portrait device check passed on dems_phone: list, entry sheet, hashes and Verify PASS. The AUDIT_TAMPER frames were not captured on the device (§3). Jest covers them, and they move to step 59 (D112).

## 1. Files (all under `apps/mobile/src/features/audit/`, P6)

| File | Role |
|---|---|
| `audit-screen.tsx` | `AuditScreen` (step 70 stub replaced; export name and `SafeScreen id="audit"` kept). Header (back on phones, "Audit", chain chip), chain strip, tamper Alert, filters, `FlashList` newest first. Phone: row → BottomSheet. Tablet: `pane-list` 360 dp (medium) or 40% (expanded) \| `pane-detail` |
| `audit-model.ts` | Pure logic: newest-first filtering (category, severity, operator incl. "system or unverified", search over the shown text, `#seq`, IDs, hash), actor rule (null actor on AUTH_FAILED / AUTH_LOCKED = unverified user, otherwise system; same rule as web step 51), `faultKindOf`, `authMethodOf`, `shortHash` (8 hex), `chainLinkOf`, `stripEntries` (pins a break older than the strip), `eventRecordJson` (the hashed fields, **without** `message`) |
| `use-audit-data.ts` | Flat `useSim` selectors (F74-13): ring rows, total, head, `selectAuditChainBreak(s)?.seq ?? null`, operators. `useAuditText` builds labels by code from `common.auditType`. `useAuditFeed` holds the list still while Live is off |
| `audit-row.tsx` | Memo row: time (mono, WIB) + day, severity dot, event label, actor, secondary line (method, fault kind, refs), category chip, chain dot, short hash. Live rows: M-C-07 enter + gold highlight 0.18 → 0 over 1,500 ms, once per entry. Broken row: red GlowLayer `breathe` (2.4 s) until acknowledged, then a steady red edge. Tablet selection: glow e2 |
| `chain-strip.tsx` | `ChainStatusChip` (Chain OK / Discontinuity; one red halo pulse on a new break, `totalMs` passed explicitly, D73). `ChainStrip`: 8 linked blocks, lit in sequence 80 ms apart; the head breathes (`audit-chain-head`, the one ambient loop, off when unfocused, reduced or broken); head hash, entry count. Verify runs the simulator's `verifyAuditChain()` → PASS pop / FAIL single pulse with no shake, plus the entries checked at the **sim** time. `TamperAlert`: danger Alert with the web's copy, "Show entry", "Acknowledge" |
| `audit-entry-detail.tsx` | Category, severity and chain chips; broken-entry Alert; key-values (entry, entry ID, time `D MMM YYYY HH:mm:ss UTC+07:00`, actor, method, fault, session, evidence, device); event record JSON (mono, selectable); previous hash and hash (full, selectable) |
| `audit-sheet.tsx`, `use-sheet-presence.tsx` | Kit BottomSheet on step 79's mount-on-demand pattern (copied; one addition: a `style` prop on `SheetContentSignal` for the fixed-height sheet). 88% snap, scroll body; `overrideReduceMotion` fix from step 83 |
| `audit-filters.tsx` | `SearchField`; category `TagGroup` (All + 8 categories); "More filters" `Menu` (severity, operator); Live `Switch`; "N new entries · Resume live" |
| `audit-boundary.tsx` | Region error boundary (copy of network-time's): fallback card, persistent `reportRuntimeIssue` log, rate-limited retry 3/6/12 s, at most 3 |
| `audit-tones.ts`, `i18n.ts` | Severity tones; `features.audit.*` copy (shared keys reused: `common.auditType/auditCategory/severity/faultKind/authMethod`, `securityAudit.chain.*`, `securityAudit.audit.*`) |
| Tests | `audit-model.test.ts` (5), `audit-screen.test.tsx` (7); test-only `testing/{audit-test-setup.ts, audit-harness.tsx, kit-helpers.ts}` (copies of step 83's mocks and helpers, with the real `/audit` route) |

Not written: `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/runtime/**`, `src/components/**`, any `package.json` or jest config. No `npm install`. Nothing committed.

## 2. Tests (row-87 check)

| Test | Proves |
|---|---|
| renders newest first, chain intact | `screen-audit`; Chain OK; rows in descending `seq`; "N of N entries"; no rendered text equals the simulator's English `message` |
| **AUTH_SUCCESS (BIOMETRIC) + MA-29 events** | After a simulator biometric sign-in and a full session flow (create → precheck → record → stop with a reason → SEALED), the list shows "Sign-in succeeded · Biometric · AKP Budi Santoso" and SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED, RECORDING_STOPPED and EVIDENCE_SEALED for that session, under their i18n labels |
| filters | Category chip, operator (menu), severity (menu), search, then empty → Clear filters |
| entry sheet | Time ends `UTC+07:00`; prev/self hash equal the row; JSON parses and excludes `message`; Close unmounts |
| AUDIT_TAMPER | Discontinuity chip; Alert "entry #<sim seq>"; exactly one BROKEN row with a glow; the strip block is labelled broken; Verify FAIL text equals the simulator's `verifyAuditChain()` seq and reason; Show entry → broken note; Acknowledge; `clearFault` → Chain OK and Verify PASS |
| Live | A new row enters with the fresh highlight; with Live off it is held back ("1 new entry · Resume live"); Resume shows it |
| tablet | `audit-panes`; placeholder; a row opens in the pane with the selected glow; no sheet |

Every test asserts `getMissingKeys()` = [] (MA-21). Console noise is the kit's known jest colour warnings (`colorKit.RGB`, "invalid is not a valid color"); step 83's suite shows the same.

## 3. Device check (dems_phone 1080×2424, portrait, 10:28–10:29 WIB)

- **Lane.** The helper only accepts Metro 8081–8089, so the brief's lane 8090 ran as `NO_METRO=1 device-session.sh` with a wrapper. The wrapper started Metro on 8090 in its own process group, mapped device tcp:8081 → host 8090, and afterwards stopped that group and removed only its own rule.
- **Emulators.** Neither emulator was killed or rebooted (D78). The installed APK is step 72's (`lastUpdateTime 06:07:21`).
- **Sign-in.** Login's fingerprint button plus `adb emu finger touch 1` (D103: nothing typed).
- **Frames:**

| Frame | Shows |
|---|---|
| [01_list](assets/mobile/87_dems_phone_01_list.png) | Header + green "Chain OK"; strip of 8 linked blocks with a gold head, `HEAD <hash>`, entry count, Verify; search; category chips; More filters; Live on; rows newest first with time, label by code, actor, refs, category chip, chain dot, short hash. The persisted simulator was recording (SES-…-0024), so integrity rows stream live |
| [02_entry_sheet](assets/mobile/87_dems_phone_02_entry_sheet.png) | BottomSheet "Sign-in succeeded": Authentication / Info / Linked chips; entry #285, AUD-000285, `1 Oct 2026 10:28:32 UTC+07:00`, AKP Budi Santoso, **Method Biometric**; event record JSON with `"method": "BIOMETRIC"` |
| [03_entry_sheet_hashes](assets/mobile/87_dems_phone_03_entry_sheet_hashes.png) | Scrolled: full previous hash and hash. The green bar is a text selection started by the scripted swipe on selectable text |
| [04_after_close](assets/mobile/87_dems_phone_04_after_close.png), [05_verify](assets/mobile/87_dems_phone_05_verify.png) | Back closes the sheet. Verify → "PASS · Checked 287 entries at 10:28:53"; the Sign-in row reads "Biometric" |

- **Deferred to step 59 (D112): tamper frames on the device.** Injecting AUDIT_TAMPER needs the `__DEMS_DEBUG__` handle; there is no mobile UI for it yet.
  - My CDP client reached Metro's inspector: a 401 was fixed with an allowed `Origin`.
  - The Bridgeless target then never answered `Runtime.evaluate` (no message at all) in four short sessions.
  - Uiautomator could not idle while rows streamed, so the final session tapped by screencap coordinates.
  - The tamper path is covered by the jest test above. No fault was left injected: every inject call returned NO_ANSWER.
- **Lock use and cleanup.** Total lock time was about 10 minutes over 7 short sessions: 3 on the tablet and 4 on the phone, taking whichever lock was free first (D100). Login-screen captures from failed sign-ins were deleted. Afterwards nothing listened on 8090 and none of my scratch processes ran.

## 4. Decisions, drift, SIM-GAPs

| ID | Kind | Item |
|---|---|---|
| SIM-GAP | none | `selectAuditChainBreak`, `verifyAuditChain`, `audit.rows/head/total` and `operators` cover the view; no `sim-adapter.ts` |
| DR-87-1 | decision | The chain status comes from the simulator's `selectAuditChainBreak` (cheap, live). Full verification runs only on Verify, because hashing a ring of up to 1,000 rows on Hermes on every change is wasteful. Web step 51 verifies per row; both agree on the same index for AUDIT_TAMPER (tested) |
| DR-87-2 | decision | Filters: category chips (spec) plus severity and operator in one "More filters" Menu (brief; web parity D82). Pairing and System chips are added to §4.16's list because pairing rows are PAIRING rows |
| DR-87-3 | drift (layout) | Expanded tablet uses 2 panes (filters above the list \| detail), not §2.4's 3 columns "Filters \| list \| detail" (brief: list/detail split) |
| DR-87-4 | decision | The event record omits the English `message` (MA-21: labels by code only) |
| DR-87-5 | decision | Live rows: FlashList `maintainVisibleContentPosition.autoscrollToTopThreshold` 64, so a reader at the top sees new rows while a reader further down keeps their place. The strip always shows the live chain, even while the list is held |
| F-87-1 | finding (helper, step 61/60) | `device-session.sh` rejects METRO_PORT 8090, which the controller assigned. Widen the range or use NO_METRO lanes |
| F-87-2 | finding (step 59/63) | `__DEMS_DEBUG__` through Metro's inspector: the proxy needs `Origin: http://localhost:<port>`, and the Bridgeless target did not answer `Runtime.evaluate` in this run. Step 59 should use the method of steps 79/81 or a debug link for faults |
| F-87-3 | P11 | One intermediate typecheck failed in `packages/shared/src/sim` (step 54 mid-edit: missing `./devices`). The final run was clean |

## 5. P-rules

- P6: wrote only the feature folder, this log, 5 screencaps and `delegation_progress/coder_execution_step_87.md`.
- P7: my Metro groups (PIDs 5273, 11915, 14835, 16596, 18351, 19604, 21265, 22894) stopped through the wrapper's trap; my `tcp:8081` rules removed.
- P8/D: `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` were not written (parallel run).

---
*Generated: 2026-10-01 10:31 WIB*
