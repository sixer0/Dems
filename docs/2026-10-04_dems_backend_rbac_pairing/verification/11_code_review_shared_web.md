> Saved verbatim by the controller from the senior-code-reviewer's final response (the agent's rules forbid it writing report files; same procedure as D189), 2026-10-07.

# W92 — Code review: `packages/shared` and `apps/core-web` (plan row W92, step 114)

**Reviewer:** senior-code-reviewer (tier R), read-only. **Date:** 2026-10-07, 05:27–05:45 WIB, load 3.3–4.3.
**Scope:** `git diff 057fc17 -- packages/shared apps/core-web`: 92 files, +2,349/−558, plus 20 untracked files (18 tests and 2 source files: `features/api-reference/try-it.ts`, `use-live-realtime-feed.ts`). Each routed item was also traced into the unchanged code it touches.
**Pass rule (plan row W92):** every finding has file:line and severity; zero open blockers; `npm ls react react-dom zustand --all` quoted, one copy each; AC-C-02.

## 1. Verdict

| Domain | Verdict | Issues |
|---|---|---|
| Code structure | CAUTION | 4 |
| Dependency impact and bundle hygiene | PASS | 0 |
| Duplication | CAUTION | 8 |
| Maintainability | CAUTION | 7 |
| Reference integrity | PASS | 2 (Nit) |
| React / TanStack Query use | CAUTION | 5 |
| RBAC consistency | CAUTION | 3 |
| Accessibility | PASS (1 Nit) | 1 |
| i18n completeness | PASS (1 Nit) | 1 |
| Test quality | CAUTION | 1 |

**Overall: APPROVED WITH COMMENTS.** No blocker. The one Major is a maintainability item routed by D84; a recorded deferral decision is enough to resolve it.

## 2. Evidence (commands run, read-only)

**Dependency hygiene (AC-C-02):** `npm ls react react-dom zustand --all` from the repo root. The sandbox's certificate warning lines are removed; 286 lines remain, 163 of them `deduped`.
```
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
+-- @dems/core-server@0.2.0 -> ./apps/core-server
| `-- react@19.2.3 overridden
+-- @dems/core-web@0.1.0 -> ./apps/core-web
| +-- react-dom@19.2.3 overridden
| +-- react@19.2.3 deduped
| `-- zustand@5.0.15
...
| `-- zustand@5.0.15 deduped            (apps/mobile)
`-- @dems/shared@0.1.0 -> ./packages/shared
  +-- react@19.2.3 deduped
  `-- zustand@5.0.15 deduped
```
- Distinct versions: `react@19.2.3`, `react-dom@19.2.3`, `zustand@5.0.15`. There are no invalid, missing or extraneous entries.
- Physical copies (`find . -path '*/node_modules/{react,react-dom,zustand}/package.json'`, excluding `docs/`): only `./node_modules/react`, `./node_modules/react-dom` and `./node_modules/zustand`. That is one copy each, versions 19.2.3 / 19.2.3 / 5.0.15.
- The root `overrides` pin react, react-dom, react-test-renderer, @types/react and @types/react-dom.
- **PASS.** Observation for W91, not a W92 finding: `@dems/core-server` lists `react` as a dependency.

**Runs (one worker each):**

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` / `-w @dems/shared` | exit 0 / exit 0 |
| `npm run lint -w @dems/core-web` / `-w @dems/shared` | exit 0 / exit 0 (oxlint, no output) |
| `npx vitest run --maxWorkers=1` (shared, full) | `Test Files 70 passed (70)`, `Tests 1848 passed (1848)`, 13.4 s |
| `npx vitest run --maxWorkers=1` (core-web, full) | `Test Files 111 passed (111)`, `Tests 1436 passed (1436)`, 244.9 s |
| Focused run: the 18 new or changed web test files | 18 files / 205 tests passed |
| Focused run: 8 new or changed shared test files | 8 files / 160 tests passed |

Both full runs match the D239 ledger (shared 70/1,848; core-web 111/1,436).

**Graft (working tree against HEAD = 057fc17):**
- `graft blast --depth 1`: 210 files changed, 333 seed symbols, 79 impacted. `logApiReference` is flagged: 8 of 52 impacted symbols are reached by a test. Its signature changed (a new 4th parameter `message`), and every caller compiles.
- `graft grep "URL.createObjectURL"`: 5 symbols in 5 files (W92-7).
- `graft grep "CORE_QUERY_KEYS.pairedDevices"` and `"CORE_QUERY_KEYS.roleMatrix"`: two query definitions per key (W92-8).
- `graft grep "function DeviceMenu"`: 2 implementations (W92-14).
- `graft grep "WEB_SESSION_REFUSED ="`: 2 copies (W92-24).

## 3. Findings

| ID | Severity | Domain | File:line | What | Why it matters | Fix direction |
|---|---|---|---|---|---|---|
| W92-1 | **Major** | Maintainability | `packages/shared/src/live/source/live-sim.ts:474-2683` | The file is 2,683 lines. `createLiveSim` is one closure of about 2,200 lines. D84 left the split to W92 when the file was 2,036 lines. Since 057fc17 only comments changed (`:1340`, `:1473`). | Every later change to the layer both runtimes depend on goes into one closure with shared mutable state: owed sign-out, the timers in `TIMER_NAMES :279`, socket adoption, device cleanup. Review cost and regression risk grow with it. No decision records keeping it as is. | **DR-1 (recommended):** record a deferral decision now. The layer passed three review rounds (D84, D100, D107) and 1,848 tests, so a refactor right before W101 costs more than it saves. If you split anyway, cut along the timer and subsystem seams into modules that take the closure state as an object. Change no behaviour, and gate on shared 70/1,848 plus mobile. |
| W92-2 | Minor | Structure / robustness | `apps/core-web/src/main.tsx:23-25`, `:78`, `:89`; comment `:47-48` | C2-R4 is confirmed. The three dynamic imports (`./runtime/boot`, `./i18n`, `./router`) run before the `try` at `:55`. So do `await import('./runtime/live-host-refusal')` at `:78` and `createAppRouter` at `:89`. If any of them rejects, the page stays white. The CPW1-7 comment says the fix covers "a chunk that fails to load", but the boot chunk itself is not covered. | The white-page case CPW1-7 meant to close still exists, for example after a rebuild invalidates chunk names in an open tab. | Put `:23-25` and `:78`/`:89` under the same `try`, showing the same static sentence. Add one case to `test/live-runtime-boot-failure.test.tsx` that rejects `./router` or `./i18n`. |
| W92-3 | Minor | RBAC / TanStack Query | `apps/core-web/src/features/evidence/use-evidence-media.ts:71`; `features/devices/device-drawer.tsx:380` | These two queries do not have the signed-in gate that the F75-2 rule (D176) puts on reads: one is `enabled: live !== null`, the other `enabled: live !== null && linkUp`. The bridge removes `['core', …]` when a session ends (`runtime/query-bridge.ts:104`). If a still-mounted page re-renders before the shell leaves, the query is rebuilt and asks again. **Not proven on a lane**; it is the same shape as F75-2, which was seen on lane 3. No test covers either query after sign-out: grep of `src/test` for a sign-out together with `getEvidence` or `listPairedDevices` finds only `live-paired-devices-memory`. | A refused 401 read after sign-out. The presenter shows nothing for it (`lib/core-errors.ts:29`, row 9), so the cost is request noise and an inconsistent rule. | Add a `signedIn` term to `enabled` as `security-audit/rbac-panel.tsx:150-154` does, plus one sign-out test per query. |
| W92-4 | Minor | RBAC / TanStack Query | `features/users-roles/index.tsx:127`, `:130`; `features/security-audit/rbac-panel.tsx:163-165`; `features/paired-devices/devices-panel.tsx:65-67`; `features/devices/device-drawer.tsx:402-404` | The routed D182 DC-5 item is confirmed. The Retry buttons call `query.refetch()`, which ignores `enabled` and so skips the signed-in, permission and link gates. There is a fourth site that D182 did not list: the drawer. | Reachable only by a press on a failed panel that is still on screen, but it gets around the gate the page relies on. | Retry with `queryClient.invalidateQueries({ queryKey })`, which refetches only active, enabled queries, or with `if (enabled) refetch()`. |
| W92-5 | Minor | Logging hygiene | `features/devices/motion.ts:82-93`; `routes/__root.tsx:132-141`; `features/login/report.ts:50-51`, `:57-69` | Dev-console writers that log `error.message` and `error.stack`. `motion.ts` is the routed D182 DC-6 item and is confirmed. `RootError` also logs from inside the render body, so it fires on every render and twice under StrictMode. | Live mode exists only in dev builds, so a Live error's text, which may quote input, reaches the console. This is the pattern D182 removed from W84's page. | Route these through `createPageReporter` / `webErrorSink` with a fixed sentence and the error's class. Move the root record into an effect or the router's `onError`. |
| W92-6 | Minor | Duplication | `features/evidence/log.ts:24-62`; `features/session-new/log.ts`; `features/storage/log.ts:22-59`; `features/network-time/log.ts:21-39`; `features/session-monitor/log.ts`; `features/login/report.ts:34-90` | Confirmed (D182, `gateway_check/08b_w1_web_closing.md` §6.3): six hand-rolled page loggers and correlation-ID makers sit beside the shared `lib/page-report.ts`, which six pages already bind. | Six copies of the record shape mean six places to fix the next logging rule. | Move them onto `createPageReporter`. Keep the Login page's own entry only if a decision says so. |
| W92-7 | Minor | Duplication / correctness risk | `features/evidence/export-download.ts:180-195`; `features/api-reference/actions.ts:24-47` (revoke at `:37`); `features/system/live-log-export.ts:148-161`; `features/security-audit/export-file.ts:107-118` | Four near-copies of the Blob-URL download. They use three different revoke delays: 30 s, 0 ms and 1,000 ms. D182 listed two of them. | Revoking at 0 ms in the same turn as `click()` can cancel the download in some browsers. This is a hypothesis; this review did not test it in a browser. | Write one `lib/download.ts` with one revoke delay of 1 s or more, and use it from all four. |
| W92-8 | Minor | TanStack Query / duplication | `features/paired-devices/live-data.ts:102-115` with `features/devices/device-drawer.tsx:378-391` (`CORE_QUERY_KEYS.pairedDevices`); `features/users-roles/queries.ts:90-107` with `features/security-audit/rbac-panel.tsx:152-161` (`CORE_QUERY_KEYS.roleMatrix`); `features/home/use-health.ts:13` with `features/login/live-adapter.ts:25-33` (`HEALTH_QUERY_KEY`) | Each key has two `useQuery` definitions with different `enabled`, `retry` or `refetchInterval` settings and different error reporting inside `queryFn`. | In TanStack Query, the observer that starts a fetch decides which `queryFn` runs and which error path reports. The same failure is reported differently depending on which component mounted first. The health pair is "by design" (CPW1-9); the other two have no recorded decision. | Write one `queryOptions()` factory per key in `lib/`, and present page-specific errors in the component, not inside `queryFn`. |
| W92-9 | Minor | Structure | `features/api-reference/service-banner.tsx:6` | CPW1-9 (D187 ruling 5) said the health query moves to `lib/` in W92. It has not moved. The API Reference feature now imports from `@/features/home/use-health`, one feature reaching into another. | The query has no single home, and the layering rule is broken. | Move `useHealth` to `lib/` (with W92-8) and import it from both places. |
| W92-10 | Minor | Correctness (UI state) | `features/evidence/integrity-tab.tsx:134-143`, `:173-177` | D227 O-RF-T-3 is confirmed in the code. The "Last verification …" line is drawn whenever the record holds a verdict, including while `state.phase === 'running'`. In Live mode the Core's delta updates `item.verification` before the run reveals its checks. The lane saw "VERIFYING … Last verification PASS · 16:44:59 · AKP Andi Pratama · Verifying… 0 of 6 checks" at +107 ms (`test/10b_final_retest_tablet.md:129`). | The card shows the new verdict before its own run shows it, which CF-M2 fixed on mobile. | While running, freeze the line at the value it had when Verify was pressed, or hide it, matching CF-M2. Add one Live test with the delta arriving mid-run. |
| W92-11 | Minor | Copy consistency | `features/evidence/detail-page.tsx:198-205` (chip `:188-189`) | The D217 observation is confirmed. When the media lookup fails, the poster placeholder says "No DEMO media" (`evidence.media.noMedia`), next to the chip "Media reference unavailable". | The two lines contradict each other. CF-W fixed the same contradiction on the Media and Metadata tabs. | When `media.status === 'unavailable'`, use `evidence.live.mediaUnavailable` in the placeholder. |
| W92-12 | Minor | Diagnostics | `packages/shared/src/live/source/rebuild-error.ts:155`; `apps/core-web/src/lib/page-report.ts:25-31` | FW76-1 (D190 O-4) is still open. A 409 or 422 rebuilt as `SimTransitionError` carries no `status`, and the page reporter records `status` only when the error has one. | That record cannot be matched to the HTTP answer. | Add `status` and `requestId` to the rebuilt error. The change is additive, so the closed layer's API does not change. |
| W92-13 | Minor | Copy consistency | `features/system/export-logs-dialog.tsx:127-129`; `features/security-audit/export-audit-dialog.tsx:181-188`; `packages/shared/src/i18n/en/common.ts:629` | FW76-3 is still open and also happens in the audit export. On an outage during the paged walk, the presenter's toast says "Core server unreachable. Nothing was changed." Next to it, the page says "The Core server recorded export …". | The two sentences contradict each other: the export was recorded. | Give the presenter a context flag (`afterAcceptedCommand`) that drops "Nothing was changed.", or let the page word the outage itself. |
| W92-14 | Minor | RBAC consistency / duplication | `features/dashboard/devices-panel.tsx:139-193` against `features/devices/device-menu.tsx:36-109` | The two DeviceMenu implementations differ in three ways. (a) The Dashboard gates Test signal on `DIAGNOSTICS_RUN` (R3, `:46`, `:150`); the Devices page never gates Test signal or Identify (`:50`). (b) The Devices page disables Restart while recording (`:45-49`, because the Core answers 409 `RECORDING_ACTIVE`, `masterplan/01_specs.md:912`); the Dashboard does not (`:150`). (c) The Devices page hard-codes the role "TECHNICIAN" (`:46`) instead of using `requiredRoleFor`. | The two menus agree today only because every seeded role holds `DIAGNOSTICS_RUN` and the matrix is read-only (RB-9). The Dashboard offers a Restart that the Core will refuse. | Use one gate model for both menus, for example a `deviceCommandGate(can, recording)` function in `lib/` or `devices/model.ts`. |
| W92-15 | Minor | Duplication (cross-package) | `packages/shared/src/api/pairing.ts:92-102`; `demo-controls.ts:149-155`; `identity.ts` (`BiometricTokenRefusalReason`); `sim-actions.ts:110` | Constants added by the W83 close-out have no production consumer; only `test/api-closeout.test.ts` imports them. The server keeps its own copies: `core/audit-details.ts:33`, `modules/demo/reset.ts:147-149`, `modules/pairing/limits.ts`. `deviceCommandOfOperation`'s docblock says the Core server uses it; it does not. | Two sources of truth for the same values. | Have the server import the contract's constants (owner: W91), or reword the docblocks as mirrors and drop `deviceCommandOfOperation`. |
| W92-16 | Minor | Test quality | `apps/core-web/src/test/live-evidence-export.test.tsx:176-188`; `test/live-paired-devices-issue.test.tsx:350-356` | W87-F3 is confirmed. These test titles claim one toast, but they count rendered toasts after `waitFor(... toHaveLength(1))`, which resolves on the first toast. Neither file spies on toast calls. | A second identical toast that arrives later passes. D179 DC-6 requires counting toast calls. | Spy on `toast.*` and assert the call count after a flush. |
| W92-17 | Minor | Duplication | `features/api-reference/realtime-panel.tsx:224-244` ~ `:76-96`; `:246-266` ~ `:98-118`; `:316-336` ~ `:164-184` | `LiveRealtimePanel` copies three blocks of `SimulatedRealtimePanel`: the URL row, the hero dot with `seq`, and the message list. | About 60 duplicated JSX lines that will drift. | Extract `RealtimeUrlRow`, `RealtimeHero` and `RealtimeMessageList`. |
| W92-18 | Nit | Stale comment | `features/paired-devices/devices-panel.tsx:37` | The comment says the refresh works "as the drawer does, through `deferEffectStart`". The drawer calls `invalidateQueries` directly (`device-drawer.tsx:396-400`) and is the guard's one allowed exception (`test/live-strict-mode-starts.test.tsx:222-227`). | The comment misdescribes the code. | Reword it. |
| W92-19 | Nit | Accessibility | `features/api-reference/realtime-panel.tsx:112`, `:260` | `aria-label` sits on a plain `div` with no role. | ARIA 1.2 does not allow naming a generic element, and assistive technology may ignore it. This existed before; W84 copied it. | Use `role="group"` or visually hidden text. |
| W92-20 | Nit | i18n / dead code | `packages/shared/src/i18n/en/api-reference.ts:121` | `apiReference.realtime.live.everySlice` is never used (grep of `apps/*/src`). | Dead key. | Remove it or use it. |
| W92-21 | Nit | API design | `features/api-reference/index.tsx:132-133`; `server-strip.tsx:12-13` | Live mode passes a dummy `includeSimulated` and `onIncludeSimulatedChange={() => undefined}` because those props are required. | The props do not match the modes. | Make the props a union keyed by `mode`. |
| W92-22 | Nit | Performance | `components/composed/glow-ring.tsx:182` | A new `<canvas>` is created on every fit, and fits run on every ResizeObserver callback. | Small, avoidable cost. | Reuse one 2D context at module level. |
| W92-23 | Nit | Comment accuracy | `packages/shared/src/api/administration.ts:73` | The comment says "Strict, like every answer of the Core server". Strictness is top-level only, as the test name says (`test/api-closeout.test.ts:305`). Nested Core-only objects still accept unknown members: `OperatorSchema` (`identity.ts:133`), `PairingCodeStatusSchema` (`pairing.ts:131`), `CoreIdentitySchema` (`pairing.ts:159`), and the `grants` items (`administration.ts:66`). | The comment overstates the guarantee. | Write "top-level". |
| W92-24 | Nit | Duplication | `packages/shared/src/api/identity.ts:111`; `pairing.ts:105` | `WEB_SESSION_REFUSED` is the same string in two files. | Two copies. | Move it to `operation-parts.ts`. |
| W92-25 | Nit | Drift risk | `packages/shared/src/api/examples.ts:161` | The F84-3 example hard-codes `version: '0.2.0'`, which is the server's package version (`apps/core-server/package.json:3`). No test ties the two. | It will go stale at the next version bump. | Label it synthetic, or test it against the server's version. |
| W92-26 | Nit | React | `features/api-reference/use-live-realtime-feed.ts:163` | `live.socketStatus()` is read during render without a subscription. | epoch and revision can lag until the next entry triggers a render. | Keep them in the tap and read them with `useSyncExternalStore`. |
| W92-27 | Nit | Kit coupling | `features/evidence/evidence.css` (custody block: `.table__content`, `.table__column`, `.table__cell`, `tr.table__row`) | The CF-W layout overrides the kit's internal class names and relies on winning specificity inside the same layer. | It may break when HeroUI is upgraded (pinned at 3.2.6). CF-W accepted it (D217). | Note it in the upgrade checklist. |
| W92-28 | Nit | Documentation | `masterplan/` (S20); D204 | The R3 change to the S20 grouping (Test signal moves to `DIAGNOSTICS_RUN`) is recorded only in code (`dashboard/devices-panel.tsx:131-137`) and in D204. `report/report.md` does not exist yet. | The spec text and the code disagree until the report notes it. | Note it in the final report (W102). |

## 4. Routed items

| Item (source) | Result | Evidence / finding |
|---|---|---|
| C2-R4: three unguarded imports before boot (D195) | Confirmed, plus two more sites | W92-2. The lines are now `main.tsx:23-25` (`:22` is `z.config`); also `:78` and `:89`. |
| C2-R5: the log bound is 24 h, not bytes (D195) | Confirmed. Outside W92's paths, so no W92 finding; for W100 / W91. | `scripts/pg/init.mjs:80` hourly file name, `:82` `log_rotation_age = 1h`, `:83` `log_rotation_size = 0` |
| Retry `refetch()` skips the signed-in gate (D182 DC-5) | Confirmed, with a fourth site | W92-4 |
| `devices/motion.ts:82` logs message and stack (D182 DC-6) | Confirmed | W92-5 |
| Page loggers not on `createPageReporter` (D182) | Confirmed, six remain | W92-6 |
| Near-copy download helpers (D182) | Confirmed; there are four, not two | W92-7 |
| W77 checked for the F75-2 pattern (D176) | Compliant: `users-roles/queries.ts:62-67` requires live, `USER_ADMIN` and the link. The Retry exception is W92-4. The same pattern exists in two other queries: W92-3. | — |
| F84-3: the `all` scope's health example (D187 ruling 3) | Done in C1 and confirmed | `openapi.json` 200 examples are `['coreServer', 'live']`, `info.version` is 0.2.1; `examples.ts:158`. Side note: W92-25. |
| CPW1-9: health query to `lib/` (D187 ruling 5) | **Not done** | W92-9 (and W92-8) |
| W87-F3: older "one toast" titles (D189) | Confirmed in two web files | W92-16 |
| FW76-1 (D190 O-4) | Still open | W92-12 |
| FW76-3 (D190 O-4) | Still open; also in the audit export | W92-13 |
| O-6 / O-10 stale comments (D190) | Done in C2 and confirmed | `packages/shared/test/i18n.test.ts:2` says "15 namespaces"; `common.ts:567-570` |
| Stale RESIDUAL-W70-1 comments (D202, D204, D207) | Done and confirmed, with one new inaccuracy | `paired-devices/devices-panel.tsx:32-39`, `devices/device-drawer.tsx:364-368`; W92-18 |
| Web note drawer title follows the role (D202, D207) | Done and confirmed | `session-monitor/action-bar.tsx:350+`; `i18n/en/session.ts` `sessionNote.subtitleBy` / `drawerTitleBy`, with role-free fallbacks |
| RESIDUAL-W77-1 (D202) | Stays a residual, and the code says so | `users-roles/index.tsx:20`, `users-panel.tsx:42` |
| FX-W (D204): R3 gating, stored verdict, own-record rule, ring fit, strip, custody time | Reviewed; correct as built | Side findings W92-10, W92-14, W92-22 |
| FX-W2 (D207): own-record rule in Live only | Confirmed | `evidence/metadata-tab.tsx:136` (`live && !packageDescribesItem`) |
| CF-W (D217): custody layout, Live Media wording | Reviewed; correct | The comment's accessibility claim checks out: react-aria sets explicit `grid`/`row`/`gridcell`/`columnheader` roles (`node_modules/react-aria*`), so the CSS display changes keep table semantics. Side note: W92-27. |
| D-CFW-2: optional dedicated Live sentence in `i18n/en/evidence.ts` | Not done. It was optional and the reuse is acceptable, so no finding. | `media-tab.tsx:205-206` uses `evidence.live.noPackage` (`evidence.ts:348`) |
| Header poster "No DEMO media" on a failed lookup (D217) | Confirmed | W92-11 |
| The web shows a new verdict during its own Verify (D227 O-RF-T-3) | Confirmed in the code | W92-10 |
| S20 spec amendment for R3 (D204) | Not yet recorded | W92-28 |
| `live-sim.ts` split (D84) | Open; the file grew to 2,683 lines | W92-1 |
| F48: type-level tests against the full registry | Satisfied | `packages/shared/test/client-types.test.ts:174`: a client built with the default table (the full literal registry) |
| Shared client layer closed until W92 (D100, D107) | Diff since 057fc17 reviewed: comments, `bindings.ts` `DEVICE_COMMAND_OPERATION_INDEX` now read from the contract table (bounded by `satisfies`), and the permission label in `rebuild-error.ts`. No defect found. | W92-1, W92-12 |

## 5. Key challenges

1. **One rule, applied unevenly.** F75-2 says reads run only while signed in. Three pages follow it, two queries do not (W92-3), and every Retry goes around it (W92-4). Because of W92-8, the same key can be fetched under different gates depending on which component mounted first. One `queryOptions` factory per key, with the gate inside it, fixes all three.
2. **CPW1-7's fix is narrower than its comment.** The comment promises to cover a chunk that fails to load, but the boot chunk import is outside the guard (W92-2).
3. **Two DeviceMenus.** R3 fixed the Dashboard's menu only. The Devices page's menu has its own gating, its own recording rule and a hard-coded role name (W92-14).

## 6. Positive findings

- Bundle hygiene: one copy each of react, react-dom and zustand, with versions pinned by root `overrides`.
- `try-it.ts` refuses the six secret-carrying operations before any request. It checks both the raw path and a normalised one (percent-decoded, lower case, folded slashes), and allows `GET /pairing/code` beside the denied `POST`.
- `use-live-realtime-feed.ts` opens no second socket, prints no state payload, and is safe under StrictMode: the tap lives in `useState`, and the effect's second run adds no entry.
- `log.ts` follows AR-9: only method, path (no origin or query) and status; no message, stack or body.
- `storedVerification` and the "Verify again" path; `packageDescribesItem` is pure and tested.
- `RingWord` measures real ink extents and leaves words that already fit unchanged; its math (`glow-ring.math.ts`) is pure and tested against lane-measured geometry.
- Shared changes are additive or documentation; `openapi.json` is regenerated; `api-closeout.test.ts` holds the new constants to their descriptions.
- Every existing test change is a rename from `CONTRACT-GAP` to `RESIDUAL` or a wording change. No assertion was weakened (diff read in full).

## 7. Decisions

- **DR-1 (for the controller):** for W92-1, record a deferral of the `live-sim.ts` split to after handover, or schedule a split row. This review recommends deferral.
- No user decision is needed. The routing of the fixes to a post-review fix pass is the controller's call.

## 8. Files reviewed

- **Diff:** all 92 changed files (shared src, tests and generated OpenAPI; web src and tests) and the 20 untracked files.
- **Traced in full or in part:** `main.tsx`; `runtime/error-sink.ts`; `runtime/query-bridge.ts`; `lib/core-errors.ts`; `lib/page-report.ts`; `lib/core-endpoint.ts`; `features/home/use-health.ts`; `features/login/{live-adapter,report}.ts`; `features/users-roles/{index.tsx,queries.ts}`; `features/security-audit/{rbac-panel,export-audit-dialog}.tsx`; `features/security-audit/export-file.ts`; `features/system/{export-logs-dialog.tsx,live-log-export.ts}`; `features/paired-devices/{devices-panel.tsx,live-data.ts}`; `features/devices/{device-drawer,device-menu}.tsx`; `features/devices/motion.ts`; `features/evidence/{detail-page,preview-card,integrity-tab,media-tab,metadata-tab}.tsx`; `features/evidence/{use-verification,use-evidence-media,export-download,model,log}.ts`; `routes/__root.tsx`; `test/live-strict-mode-starts.test.tsx`; `test/live-runtime-boot-failure.test.tsx`; `components/composed/__tests__/glow-ring-fit.test.tsx`; `test/live-static-ac-c-53.test.ts`; `packages/shared/src/sim/react.ts`; `live/source/{live-sim,rebuild-error,bindings}.ts`; `test/{api-closeout,client-types}.test.ts`; `scripts/pg/init.mjs:60-90`.
- **Task docs:** `masterplan/02_plan.md` row W92; `decisions/decisions.md` (D84, D100, D107, D176, D182, D184, D187, D189, D190, D195, D202, D204, D207, D217, D227, D239, F48); `gateway_check/08b_w1_web_closing.md` §5–6; `gateway_check/11b_efix_web.md`; `test/01_test_report.md` (W87-F3); `test/10b_final_retest_tablet.md:129`; `implementation/76_*.md` (FW76).
