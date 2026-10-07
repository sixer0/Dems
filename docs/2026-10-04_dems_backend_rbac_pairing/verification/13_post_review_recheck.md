---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: RC (post-review re-check; plan §622, DN-W91-3)
agent: senior-code-reviewer
date: 2026-10-07
status: complete
narrative_tier: 2
verdict: approve with comments
counts: { blocker: 0, major: 0, minor: 1, nit: 7 }
---

# RC: re-check of the changes made after the W91, W92 and W93 code reviews

**Verdict: approve with comments.** 0 Blocker, 0 Major, 1 Minor, 7 Nit. All 6 rows fix the findings they say they fix. I found no regression in RBAC gating, query gates, secrets or logging hygiene. The one Minor (RC-1) is a timer that can step back at the moment a recording stops. It comes from FXR-M's shared ticker and is visible only in the Sessions hub, in LIVE mode, under load. It is a hypothesis from reading the code and was not run on a device. It should be added to the W94-W96 device checks or fixed with a small hold. Nothing here blocks the final commit.

## 1. Scope and method

**What was checked.** Rows C3, FXR-S, FXR-W, FXR-M, T1 and PT, the changes made after the three reviews `verification/10_code_review_backend.md` (W91), `11_code_review_shared_web.md` (W92) and `12_code_review_mobile.md` (W93). Rulings: D241-D247 and D254 in `decisions/decisions.md`.

**How.** Each changed file was diffed against its before-image in `.cache/rollback/<row>/`. Every new file was read in full. The hash manifests were checked first:

| Row | Before-image | Hash check (run now) | Files |
|---|---|---|---|
| C3 | `C3/…/pg-behaviours.db.test.ts.pre` | current file = `C3.post.sha256` (`783013da…`) | 1 changed |
| FXR-S | `FXR-S/` + `FXR-S.pre.sha256` | `shasum -c FXR-S.pre.sha256` 63/63 OK; `FXR-S.post.sha256` 70/70 OK from the repo root | 63 changed + 7 new |
| FXR-W | `FXR-W/files/` (42), `reconstructed/` (5), `head_restorable.txt` (8, `git show HEAD:`) | `post.sha256` all OK | 42+5+8 changed, 12 new, 1 move |
| FXR-M | `FXR-M/<path>` + `FXR-M.mobile.pre.sha256` | pre 55/55 OK. post: 2 mismatches, `runtime/log.ts` and `runtime/sim-adapters.ts`. Both are PT's later edits: PT's before-images hash to exactly FXR-M's post values (`6527fc8a…`, `ccdc7efa…`), so no third writer came in between | 55 changed + 15 new |
| T1 | `T1/jest.config.js` | diff: +2 lines | 1 changed |
| PT | `PT/{log.ts,log.test.ts,sim-adapters.ts,sim-adapters.test.ts}` | `sim-adapters.test.ts` unchanged; 3 changed + 1 new | 4 |

FXR-M's diff was taken against PT's before-images for the two shared files, so each row's change was judged on its own.

**Owned paths (no file outside a row's paths).** Every file under `apps/`, `packages/` and `scripts/` modified after 2026-10-07 05:30 was compared with the union of the six manifests (211 paths). Command: `find … -newer <05:30 stamp>` piped to `comm -23` against the manifests. Two files were left over, and both are git-ignored build artifacts: `apps/mobile/expo-env.d.ts` (`apps/mobile/.gitignore:10`) and `packages/shared/tsconfig.tsbuildinfo` (`.gitignore:18`). Each row stayed inside its declared scope: C3 one server test file, FXR-S `apps/core-server/{src,test}`, FXR-W `apps/core-web` + `packages/shared`, FXR-M `apps/mobile`, T1 `apps/mobile/jest.config.js`, PT `apps/mobile/src/runtime`. **PASS.**

## 2. Per row: is each finding resolved?

### C3: `pg-behaviours.db.test.ts` on the terse cluster (C2-R1, DN-W91-3)

**Resolved.** The settings pin now expects `terse` (`:171`), and it proves that neither project role can `SET log_error_verbosity` to `verbose` or `default` (`:181-183`). The log check reads the collector file through `current_logfiles` (`:118-131`) and handles an hour change by reading two segments (`:150-153`). The old findings are inverted: 0 `DETAIL:`, 0 `Failing row`, 0 `Key (` and no hash marker anywhere in the window (`:263-268`). Each of the 7 tagged `STATEMENT` lines directly follows its own `ERROR` from the same backend, and the 7 messages are exactly the expected constraint texts (`:272-293`). The `pg_ctl -l` file gets nothing (`:296`). `console.info` now prints counts only (`:298-302`), so no log content is echoed.

**Why the whole-window DETAIL count is sound.** Verbosity is a server setting that only a superuser can change (the settings test above), so no line from a concurrent test can carry DETAIL either. The ERROR and STATEMENT lines also cannot interleave across backends: PostgreSQL appends the STATEMENT to the same log message as its ERROR. I checked the default `log_line_prefix` assumption: `scripts/pg/init.mjs` does not set it, so the default `%m [%p] ` applies and `[pid]` is present. See RC-6 for a weak spot.

### FXR-S: core-server (W91-2..9, 11-16; D241, D245)

| Finding | Re-check result | Evidence |
|---|---|---|
| W91-2 stale FX-C comments | Resolved. The publication rule is stated once, on `SessionRegistry` | `identity/sessions.ts:102-108`, `admin/changes.ts:157-160`, `biometric/index.ts:33-38` |
| W91-3 debounce cap coupling | Resolved. Own `DEVICES_CHANGED_MAX_WAIT_MS`, carried through `REALTIME_LIMITS`, used at `hub.ts:462`. The new test decouples the two limits (2 s vs 4 s) | `realtime/limits.ts:102,128,148`; `hub.devices-changed.test.ts:125-147` |
| W91-4 / W92-15 copied constants | Resolved. Re-exported from `@dems/shared/api`; close reasons typed `satisfies readonly PairingCodeCloseReason[]`; `ResetRefusal` reads `DemoRebuildRefusalReason` | `pairing/limits.ts:21-26`, `biometric/tokens.ts:24`, `audit-details.ts:36-40`, `demo/reset.ts:151-153`; `modules/__tests__/contract-values.test.ts` |
| W91-5 values typed again | Resolved. `SessionEndedReason` comes from the contract; one 401 text `NOT_SIGNED_IN_TEXT` at all 5 production sites and 3 test doubles; `RegistryOperationId` moved to core and applied with `satisfies` | `api-failure.ts:101`, `engine/errors.ts:61,77`, `core/types.ts:16`; `engine/__tests__/errors.test.ts:111-118`. Repo grep: "Sign in to continue" remains only in a mobile i18n hint, as the row says |
| W91-6 small copies | Resolved. One `createEmptyDatabaseStatement` used by `db:create`, the reset R-4 staging statement and the test helper. `GENESIS_HASH` re-exported from the simulator. `EVENT_COUNTER_NAME satisfies EngineCounterName`. **Leftover: RC-2** | `db/commands/statements.ts:23`; `test/db/create-statement.test.ts` |
| W91-7 `process.env` mutated per request | Resolved. The routine scrubs only `options.driverEnvironment` (`routine.ts:475`); the CLI passes `process.env` (`reset/cli.ts:192`). The server passes nothing, and its entry already scrubs once at start (`src/index.ts:46`, `removeDriverEnvironment`). Server caller: `modules/demo/index.ts:143` | `reset/__tests__/guard.test.ts:218-243` |
| W91-8 error log | Resolved as ruled by D241 (accepted, with a rotation test). The non-`.log` path now rotates to `<path>.1`. 2 sync calls per append in the steady state. It stays synchronous because the fatal-then-`process.exit(1)` path needs it (DN-FXR-S-2). **Trade-off: RC-3** | `logger/error-log.ts:49,184-203`; `__tests__/error-log-rotation.test.ts` (8 tests) |
| W91-9 shims | Resolved for the importers. `grep` finds 0 imports of `src/{core,engine,realtime}/__tests__/support` from outside their folders, and a static guard keeps it at 0. The shim file is not deleted, by red line; it is listed for the user (D245) | `test/static/test-support-imports.test.ts` |
| W91-11 sweeper | Resolved. Moved unchanged to `core/sweeper.ts`; pairing imports it from core; `identity/sweeper.ts` is a one-line re-export used only by `identity/index.ts:38`; the public identity re-export was removed | `core/sweeper.ts`, `core/__tests__/sweeper.test.ts` |
| W91-12 | Resolved. The table is derived by inversion and frozen; the test ties it to `deviceCommandOfOperation` | `devices/operations.ts:48-53` |
| W91-13, -14, -15, -16 | Resolved. Comment cites the real test; 9 closed-gap prints removed and the stale "printed, not pinned" comment fixed; FX-C journey marked `{ concurrent: false, shuffle: false }` with a read-the-first-failure note; the tautology removed; `deviceIds` documented as diagnostic | `value-sets.ts:7`, `contract.test.ts:931`, `devices-live.test.ts:86-90`, `publication.ts:47-50` |
| W91-10, W91-17 | Not fixed, by ruling (after W103; outside the row's paths) | D245 |

No regression found. The `NOT_SIGNED_IN` text change is a deliberate, visible behaviour change (DN-FXR-S-1, ratified). `DEVICE_SIGN_IN_OPERATIONS` and the other operation-ID lists keep their `readonly string[]` run-time type, so the `Set`/`includes` lookups are unchanged.

### FXR-W: core-web + shared (W92-2..5, 7..11, 13, 14, 16, 18-26; D242, D247)

| Finding | Re-check result | Evidence |
|---|---|---|
| W92-2 boot imports outside the guard | Resolved. All three start-up chunks, the data-source start, the router build and the Live refusal chunk run inside `start()`, under one `try`. `z.config({ jitless: true })` still runs before any schema-building import | `main.tsx:58-101`; `test/live-runtime-boot-failure.test.tsx` (4 new cases) |
| W92-3 signed-in gate | Resolved. `useCoreSignedIn` needs both the replica and the Live source (`core-queries.ts:65-69`); applied to evidence media (`use-evidence-media.ts:71-74`), the drawer (through `usePairedDevicesGate`) and the Users list (`users-roles/queries.ts:66-72`) | `lib/__tests__/core-queries.test.tsx` |
| W92-4 Retry bypasses gates | Resolved. `retryCoreQuery` = `invalidateQueries({ exact: true })` at all 5 Retry presses; `grep` finds no `.refetch()` left in production `src` | `core-queries.ts:149-151` |
| W92-5 dev-console logging of message/stack | Resolved. `RootError` writes once per error object from an effect, with a fixed sentence and the class (`components/shell/root-error.tsx:25-36`); `logDevicesError` removed; Login writes a fixed sentence and `errorName`, with no stack. **Small leftover: RC-5** | `test/fxr-w-dev-console-logging.test.tsx` |
| W92-7 downloads | Resolved. One `downloadBlob`, revoked after 30 s, used by all 4 former copies | `lib/download.ts:26-41` |
| W92-8 / W92-9 | Resolved. One factory per shared key, with the gate inside it; `queryFn` only reads and throws `CoreReadError`, whose failed call is not enumerable; presentation is in components through `useQueryFailure` (once per new failure per observer). The Paired Devices 403-once rule still holds: the re-arm effect is declared before the failure hooks (`live-data.ts:83-85`). Health moved to `lib/health-query.ts` | Observer count checked by grep: each shared key has one presenting observer per screen (`users-roles/index.tsx:87`, `rbac-panel.tsx:80`, `device-drawer.tsx:332`, `paired-devices/index.tsx:56`), so "once per observer" cannot double a toast |
| W92-10 verdict line during a run | Resolved. Pinned per `runId` with the guarded "adjust state in render" pattern; released at the end of the run | `integrity-tab.tsx:93-101`; `live-efix-evidence.test.tsx` W92-10 |
| W92-11, -13, -14, -16 | Resolved. Placeholder matches the chip; `afterAcceptedCommand` drops "Nothing was changed" on both export walks; one `deviceCommandGate` for both menus (Identify and Test signal on DIAGNOSTICS_RUN, Restart on DEVICE_MANAGE and not while recording; `selectIsRecording` equals the old `selectIsRecordingNow`); one-toast tests count calls | `detail-page.tsx:204`, `core-errors.ts:265-268`, `lib/device-command-gate.ts:50-85` |
| Nits W92-18..26 | Resolved as described. `WEB_SESSION_REFUSED` is now one export (`operation-parts.ts:19`); the removed i18n key has no user (grep) | — |

The changes to existing tests (5 files) encode ruled behaviour and do not weaken any assertion. The two static pins now assert the new structure positively (`live-security-audit-page.test.tsx:312-336`).

### FXR-M: mobile (W93-1..9, 11..17, 20..25, 28; D243, D246, D247)

| Finding | Re-check result | Evidence |
|---|---|---|
| W93-3 / W93-1 rolling number, bottom bar | Resolved. React holds each column's rest cell; the roll is an offset on a wrapper whose rest value is 0, so a dropped Reanimated update leaves the final picture (`rolling-number.tsx:230-259`). `rollCells` keeps rest cells in 0..19 (checked: previous ≤ 9, up ≤ 9). `TimerReadout` now delegates to `RollingNumber`, which keeps an accessibility label for numeric values (`rolling-number.tsx` label fallback). The bar reads `useRecordingElapsedSeconds` | `rolling-number-drawn.test.tsx`, `live-mini-bar-core-clock.test.tsx` |
| W93-12 ticker dies on a throw | Resolved. Re-arms in `finally` and does not double-arm (`handle === null` guard) | `runtime/recording-elapsed.ts:69-92`; `elapsed-ticker.test.ts` W93-12 |
| DEC-FXR-M-1 shared ticker for Home and hub | Behaves as described while RECORDING. **At the stop: RC-1** | `recording-elapsed.ts:109-144`, `use-home-data.ts:97-100`, `use-sessions-data.ts:139-142` |
| W93-2 / W93-4 rows | Resolved. 1 dp border in every state; `SelectionGlow` always mounted as the last child | `audit-row.tsx:82,126,159-161`, `device-row.tsx:186,214,259-260` |
| W93-24 (part) | Resolved. Glow moved to the kit; the five boundary countdown updaters are now pure, and the interval is cleared in `componentDidUpdate` | `*/panel-boundary.tsx`, `audit-boundary.tsx`, `card-boundary.tsx` |
| W93-5, -6, -8, -9, -25 | Resolved. FAIL wording; `animation: 'none'` on `finalizing` and `summary/[sessionId]` (the real route file, test-checked); wrap rules; opaque chip plate; actor only on an exact-instant match | `export-sheet.tsx:529-532`, `stacks.tsx:39,58-60`, `session-detail.tsx:138,294,336-337`, `evidence-model.ts:410-411` |
| W93-7 Stepper rest values | Resolved. `useChangeOverlay` keeps every rest value in React; overlays are keyed per change and removed after their budget; `animate={false}` starts nothing | `stepper.tsx:233-249` (`useChangeOverlay`), `:265` (`ConnectorHalf`), `:303` (`FillMotion`), `:328` (`StepBadge`), `:390` (`FadeMotion`) |
| W93-11 ruling | Resolved as ruled. Unknown role gives "Checking your permissions…" on every gated control (`use-role-gate.ts:55-59`); a deep link waits (`use-start-entry-guard.ts:53-54`, `session/new.tsx:21`), then applies the same gate; `entered` keeps a lost permission the screen's own rule. **UX note: RC-7** | `role-gate-r2.test.tsx` W93-11 |
| W93-13, -14 | Resolved. Route error recorded once from an effect; the app has no `StrictMode` (grep), so the effect runs once. warn now goes to `console.info` in the motion and navigation sinks | `navigation/route-error-fallback.tsx:25-27`; `motion/log.ts:25-31`, `navigation/log.ts:25-31` |
| W93-15, -16 | Resolved as briefed. A command time-out is measured and never re-sent. A late keystore write is logged with its outcome and timing (value never logged), and it is removed when the registration was abandoned. I traced the race: `abandonRegistration` clears `memory.device` before its own `removeStored()` (`sim-adapters.ts:580-582`), so a write that lands before, during or after the abandonment is deleted either by that call or by `onLate` (`:633`) | `probe-failure.test.ts`, `live-device.test.tsx:1130` |
| W93-17, R16 | Resolved (explicit 20 s budgets; counted one-toast tests; haptic counts asserted). **Redundant after T1: RC-8** | — |
| W93-20..23 | Resolved (dead code removed; direct `summaryAcknowledged` read; `eventsById` map) | `root-navigator.tsx:107-111`, `session-live-screen.tsx:150-156` |
| W93-28 diagnostics | Added as briefed: one quiet record per transition, persisted and never printed. **Scope note: RC-4** | `runtime/session-diagnostics.ts` |
| W93-10, -18, -19, -26, -27 | Not done, documented (D246) | — |

### T1: mobile jest default timeout (D247)

**Resolved.** `testTimeout: 20000` with a comment citing D239/D246 (`apps/mobile/jest.config.js:9-10`). It is config only and closes FXR-M's residual (the first `chrome-lost-updates` test had no explicit timeout). Cost: a real hang now takes 20 s to fail instead of 5 s. That is accepted by the decision.

### PT: W100-1, W100-5 (D254)

**Resolved.** `redactCredentials` uses the web sink's regex and replacement (`log.ts:46-51`). It is applied before truncation through `keepText` (`:83-85`) to source, message, stack, string context values and a caller correlation id, in both record builders (`toRuntimeLogRecord` `:109-122`, `fromSibling` `:264-274`). I checked for over-redaction: no non-credential string in `apps/mobile/src` matches `\b(ses|dvc|bio)_` (grep: only the credential helpers themselves). Session IDs (`SES-…`) do not match. The `[DEMS-LIVE]` line is behind `__DEV__ && !IN_JEST` (`sim-adapters.ts:479`), with a static guard. The two tests were seen red before the fix (PT report §3).

## 3. Findings

| ID | Severity | Row | File:line | Finding | Recommendation |
|---|---|---|---|---|---|
| RC-1 | Minor | FXR-M (DEC-FXR-M-1) | `apps/mobile/src/runtime/recording-elapsed.ts:12-13,129`; `features/sessions/use-sessions-data.ts:139-142`; shown by `session-row.tsx:154-159` and `session-detail.tsx:239-240` | **The hub timer can step back when a recording stops (hypothesis, from the code; not run).** In LIVE the shared ticker counts Core-clock seconds while the replica says RECORDING. The client learns of the stop δ seconds late: RF2-2 measured 7.7 s / 12.4 s under load (D243). During δ the ticker keeps counting past the real stop. When the state leaves RECORDING, `useRecordingTickerSeconds` drops to 0 (`:129` gates on `'RECORDING'`), and the hub row falls back to the store value frozen at `stoppedAt`. The drawn time then moves back by up to δ (for example 00:00:19 to 00:00:11). Home's RecRow and the mini-bar unmount at the stop (`system-status-card.tsx:175`), and the monitor is replaced in place, so only the Sessions hub row and its detail pane, which stay mounted, show the jump. The module header's "the time never steps back" (`:12-13`) holds only while RECORDING. This contradicts DEC-FXR-M-2. | Either hold the larger of (last drawn value, store value) per session in `useLiveElapsedSeconds` until the store's frozen value catches up, or accept the correction to the Core's stop instant and reword the header. Add "stop under load: hub duration never steps back" to the W94-W96 device checks either way |
| RC-2 | Nit | FXR-S (W91-6) | `apps/core-server/test/helpers/db/constants.ts:30` | `EMPTY_TEMPLATE = 'template0'` now has no importers (grep). It is a leftover copy of the constant W91-6 unified in `src/db/commands/statements.ts` (`EMPTY_DATABASE_TEMPLATE`) | Delete the export (deleting a line, not a file), or re-export the statements constant |
| RC-3 | Nit | FXR-S (W91-8) | `apps/core-server/src/plugins/logger/error-log.ts:190,202` | After `prepared = true`, a log folder removed from outside makes the next append fail, and that entry is lost. Before the fix, `mkdirSync` on every append recreated the folder. The test pins this (`error-log-rotation.test.ts`, "a failed append never throws": 3 appends, 1 line). The stream logger still has the entry, so this is a documented trade-off | Optional: in the `catch`, if `prepared` was true, run one `mkdir` + append retry |
| RC-4 | Nit | FXR-M (W93-28) | `apps/mobile/src/runtime/session-diagnostics.ts:146-163`; mounted at `app/(app)/_layout.tsx:18` | The 250 ms lag sampler runs during every session window in all modes, SIMULATED and release builds included. W98 only needs LIVE, and in SIMULATED the record carries `live: false` and no counters. The cost is small (4 wakeups a second), but it falls in the load-sensitive window | Gate the sampler (and the record) on a Live source, or drop it after W98 has its data |
| RC-5 | Nit | FXR-W (W92-5) | `apps/core-web/src/features/devices/panel.tsx:99` | The boundary record also carries `componentStack`: multi-line, unbounded, component names. The row's header and report describe the record as "a fixed sentence, the panel and the error's class". It holds no error text and the sink redacts credentials, so this is a contract-wording mismatch, not a leak | Drop `componentStack`, or keep it and say so in the header |
| RC-6 | Nit | C3 | `apps/core-server/test/db/pg-behaviours.db.test.ts:272-278` | `pid()` returns `undefined` when a line has no `[pid]`. The "same backend" check would then pass trivially (`undefined === undefined`) if `log_line_prefix` were ever changed. It holds today: the default prefix applies | Add `expect(pid(line)).toBeDefined()` before the comparison |
| RC-7 | Nit | FXR-M (W93-11) | `apps/mobile/src/features/session-new/start-entry-checking.tsx`; `use-start-entry-guard.ts:54` | The waiting screen has no on-screen way out and no time limit. If the first snapshot never arrives (link down), the operator must use hardware back. That follows the ruling ("waits for the role"), but on a tablet with gesture navigation this is a dead end | Optional: a "Back to Home" link on the screen, or a note in the runbook |
| RC-8 | Nit | FXR-M (W93-17) / T1 | `live-session-new-followups.test.tsx:47`, `more-live.test.tsx:36`; `jest.config.js:10` | After T1, the explicit `LOAD_TOLERANT_TIMEOUT_MS = 20_000` budgets equal the new global default and no longer change anything. Five older files also call `jest.setTimeout(20_000)` | Keep as documentation, or remove in a later cleanup. No action needed for the commit |

**No finding** for RBAC gating (the web device menus now follow the Core's per-operation permissions; the mobile gate never lets an unknown role through), query gates (signed-in, permission and link, also on Retry), secrets (no credential reaches a log or record: CoreReadError keeps the failed call non-enumerable, the late-write record carries no value, PT redacts the mobile log), effects and timers (no leaked interval; ticker and sampler stop when unsubscribed or unmounted; boundary updaters are pure), or Reanimated/Fabric patterns (every rest value is React-held; motion lives only in keyed, removable overlays).

## 4. Tests prove behaviour

Each row ran red-before or mutation proof. I sampled the evidence and found it consistent with the code:

- C3: 3 mutants, each failing only its own test.
- FXR-S: 9 of 9 mutations caught.
- FXR-W: 36 of 36 mutants killed. The 3 surviving drafts led to stronger tests.
- FXR-M: 33 of 33 mutants caught.
- PT: red runs quoted.

I read the new tests above. They assert behaviour (drawn columns under the lost-update model, gate decisions, record contents), not only structure. The static guards (test-support imports, `.refetch()`, `createObjectURL`, `[DEMS-LIVE]` guard) each fail on the pre-fix tree by construction.

Suite ledgers come from the row reports and the controller's own runs (D245, D247, D254): server unit 160/3,954, server db 124/1,751, shared 71/1,851, core-web 117/1,495, mobile 192/1,988.

**This re-check's own runs:** 20 targeted files, 201 tests, all passing (§4a).

## 4a. Targeted runs by this re-check

The load was 31.5 at the start of this row (W101's closing gates were running). A background job polled `uptime` every 10 s and started only when the 1-minute load fell below 14. It ran at 11:02:59 (load 13.83). One worker each, no db tests, no full suites. Command output, verbatim (scratchpad `rc_tests.out`):

```
=== core-server unit (targeted, 1 worker) load 13.83
 Test Files  8 passed (8)
      Tests  91 passed (91)
exit 0
=== core-web (targeted, 1 worker) load 13.52
 Test Files  5 passed (5)
      Tests  51 passed (51)
exit 0
=== mobile (targeted, 1 worker) load 12.60
Test Suites: 7 passed, 7 total
Tests:       59 passed, 59 total
exit 0
```

Files run:

- core-server: `npx vitest run --project unit --maxWorkers=1` on `modules/__tests__/contract-values`, `plugins/logger/__tests__/error-log-rotation`, `core/__tests__/sweeper`, `test/static/test-support-imports`, `engine/__tests__/errors`, `realtime/__tests__/hub.devices-changed`, `db/reset/__tests__/guard`, `test/db/create-statement` (a unit-project file: it matches none of the `DB_TEST_FILES` globs, `vitest.config.ts:15-19`).
- core-web: `npx vitest run --maxWorkers=1` on `lib/__tests__/{core-queries,download,device-command-gate}`, `test/fxr-w-dev-console-logging`, `test/live-runtime-boot-failure`.
- mobile: `npx jest --maxWorkers=1` on `runtime/log`, `runtime/dems-live-console-static`, `session-live/elapsed-ticker`, `composed/rolling-number-drawn`, `composed/stepper-rest-values`, `navigation/__tests__/route-error-fallback`, `rbac/role-gate-r2`.

Total: 20 files, 201 tests, all passing on the current tree.

## 5. Files reviewed

- Reports: `gateway_check/14_c3_pg_behaviours.md`, `15a_fxr_server.md`, `15b_fxr_web.md`, `15c_fxr_mobile.md`, `16_t1_mobile_jest_timeout.md`, `17_pt_tidy_up.md`; reviews `verification/10_*.md` (W91-5..17 read in full), `11_*.md`, `12_*.md` (through D242/D243); `decisions/decisions.md` D241-D248, D253, D254.
- Diffs: all 63 + 55 + 55 changed files listed in the manifests, the C3, T1 and PT files, and FXR-W's 8 `head_restorable` files against `git show HEAD:`.
- New files read in full: `core/sweeper.ts`, `db/commands/statements.ts`, `modules/__tests__/contract-values.test.ts`, `logger/__tests__/error-log-rotation.test.ts`, `test/static/test-support-imports.test.ts`, `test/db/create-statement.test.ts`; `lib/core-queries.ts`, `lib/download.ts`, `lib/device-command-gate.ts`, `lib/health-query.ts` (diffed against the old `use-health.ts`), `components/shell/root-error.tsx`; `runtime/recording-elapsed.ts`, `runtime/session-diagnostics.ts`, `components/composed/selection-glow.tsx`, `navigation/route-error-fallback.tsx`, `features/session-new/start-entry-checking.tsx`, `runtime/dems-live-console-static.test.ts`.
- Context read: `src/index.ts:46,99`, `plugins/db/index.ts:149`, `owner-connection.ts:93`, `modules/demo/index.ts:143`, `lib/page-report.ts`, `runtime/error-sink.ts`, `packages/shared/src/sim/selectors.ts:106-119`, `system-status-card.tsx:175,200-215`, `sim-adapters.ts:560-660`, `scripts/pg/init.mjs:74-84`.
- Not run: db tests and full suites (rule of this row: W101 is using the cluster).
