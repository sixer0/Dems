---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: FXR-W (post-review fix pass, web; decision D242)
date: 2026-10-07
agent: coder-execution (tier R)
source: verification/11_code_review_shared_web.md (W92-1..28); decisions/decisions.md D242
status: complete
---

# FXR-W: post-review fix pass for `apps/core-web` and `packages/shared`

**Scope (D242).** Fixed: W92-2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14 and 16, plus the cheap Nits W92-18 to W92-26. Deferred and **not touched**: W92-1 (the `live-sim.ts` split), W92-6, W92-12, W92-15, W92-17 and W92-27. W92-28 belongs to the final report (W102).

**Paths.** Changes are only under `apps/core-web/**` and `packages/shared/**`. Nothing was changed under `apps/core-server/**` or `apps/mobile/**`. The shared changes are additive i18n keys, one removed dead key, one constant moved inside `src/api`, and comments. Because mobile imports shared, mobile typecheck was run (exit 0).

**Rules kept.** No servers, Vite, Metro or emulators were started. No commits were made. No secrets were printed. Load was checked before each full run: 10.3 before the shared run and 11.1 before the core-web run, both under the pause limit of 14.

**W92-15.** This finding is deferred. FXR-W did not need to export any constant for the server, so there is nothing to hand to FXR-S.

## 1. Per finding

**How to read the "Test (fail before / pass after)" column.**
- **Red** means the test was run against the pre-fix code and was seen to fail, then passed after the fix.
- **Static** means the guard reads the source. It fails on the pre-fix tree by construction, because the pre-fix tree has the duplicate, the `refetch()` or the hard-coded role.
- **Mutation** means a one-shot in-memory change to the fixed code (`mutate.py`: apply, run vitest, restore). The file was restored after each run, and no `.fxrw-bak` file remains (checked: count 0).

| ID | Status | Fix (file:line) | Test (fail before / pass after) | Mutation |
|---|---|---|---|---|
| W92-2 | fixed | `main.tsx:58` `start()` holds the three start-up imports, `bootCoreRuntime`, the Live refusal chunk and `createAppRouter`. The one `try` at `:86` shows the same static sentence and writes one `main.boot` record (class only). | `test/live-runtime-boot-failure.test.tsx`: 4 new cases. `./router` and `./i18n` reject through `vi.doMock`, the router throws while it is built, and the refusal chunk rejects. **Red:** 4 failed before the fix. Pass: 8/8. | Guard moved out of the `try` → **killed** (8/8 fail) |
| W92-3 | fixed | `features/evidence/use-evidence-media.ts:71-74` adds `useCoreSignedIn()` to `enabled`. The drawer reads through `lib/core-queries.ts:80` `usePairedDevicesGate` (Live, signed in, link, PAIRING_MANAGE) at `device-drawer.tsx:368`. `useCoreSignedIn` (`lib/core-queries.ts:65`) requires both the replica and the Live source. The Users list gate gained the same term (`users-roles/queries.ts`). | `lib/__tests__/core-queries.test.tsx` "W92-3": 10 cases. Signed out by the replica or by the source, while the permission hint and the link still say yes, sends no call. **Red** for evidence: the pre-fix `enabled: live !== null` is mutant m2, killed. Page-level sign-out guards: `test/live-fxr-w-evidence-media-signout.test.tsx` (2 cases) and `live-devices-drawer.test.tsx` "W92-3" (1 case). | Base gate without signed-in, evidence without signed-in, signed-in ignoring the source, registry gate without PAIRING_MANAGE: all 4 **killed**. **Note:** the two page-level sign-out tests passed before the fix too, because the page leaves before it re-renders and PAIRING_MANAGE also drops at sign-out. They stay as regression guards; the hook-level tests are the red proof. This matches the reviewer's "not proven on a lane". |
| W92-4 | fixed | `lib/core-queries.ts:149` `retryCoreQuery` invalidates with `exact` instead of calling `refetch()`. Used by all 5 Retry presses at the 4 sites: `device-drawer.tsx:389`, `paired-devices/devices-panel.tsx:71`, `security-audit/rbac-panel.tsx:149`, `users-roles/index.tsx:131` and `:134`. | `core-queries.test.tsx` "W92-4". A failed query whose observers are all disabled is not fetched by a Retry; the control group shows `refetch()` fetching it. An enabled query refetches only its own key. Static: no `.refetch()` under `features/`, `components/` or `routes/` (it fails on the pre-fix tree). | Retry that bypasses the gate, and one site back on `query.refetch()`: both **killed** |
| W92-5 | fixed | `components/shell/root-error.tsx:26`: the record is written from an effect, once per error object (ref guard), with a fixed sentence and the class. It goes to `webErrorSink`; `routes/__root.tsx` imports it. `features/devices/panel.tsx:99` now uses `reportDevicesError` with a fixed sentence (the `logDevicesError` that wrote message and stack is removed from `motion.ts`). `features/login/report.ts:55` writes a fixed sentence and `errorName`, with no stack, to `webErrorSink`. | `test/fxr-w-dev-console-logging.test.tsx` (5 cases): StrictMode plus 3 re-renders give 1 record, a new error gets its own record, and no marker appears in records, own console lines or the page. **Red:** 5/5 failed with RootError moved verbatim first. `login-model.test.tsx` was changed by design: it had pinned `message: 'boom'` and the stack. | Once-guard removed, record in the render body, root message equal to error.message, panel message text, login message text, login not recorded: all 6 **killed** |
| W92-7 | fixed | `lib/download.ts:26` `downloadBlob` revokes after `DOWNLOAD_REVOKE_DELAY_MS = 30_000`. `saveBytes`, `downloadText`, `downloadJson` and `downloadAuditFile` all call it (via `downloadJsonFile` where the file is JSON). | `lib/__tests__/download.test.ts` (8 cases): one click on an attached anchor; no revoke at 0 ms or 999 ms; one revoke later; each of the four exports keeps the 1 s floor. Static: `URL.createObjectURL` appears only in `lib/download.ts` and the Login still image (it fails on the pre-fix tree, which has 4 copies). | Delay 0, revoke in the click turn, the API Reference copy back at 0 ms, anchor not attached: all 4 **killed** |
| W92-8 | fixed | One factory per key in `lib/core-queries.ts`: `pairedDevicesQueryOptions` (`:107`) and `roleMatrixQueryOptions` (`:120`) with the gate inside. Each `queryFn` only reads and throws `CoreReadError` (status and code; the failed call kept non-enumerable). Presentation moved to the components through `useQueryFailure` (`:133`): one presentation per new failure per observer, none for a failure cached at mount, StrictMode-safe. The Paired Devices 403-once rule is kept (`live-data.ts`). The health key is `lib/health-query.ts:19` `healthQueryOptions()`; Login spreads it. | `core-queries.test.tsx` "W92-8" and "static". Each shared key has one query definition, in `lib/` (it fails on the pre-fix tree: drawer plus Paired Devices, users-roles plus rbac-panel, home plus login). Both readers use the factory. `useQueryFailure` once per failure, with and without StrictMode, and not for a cached failure. Two static pins of the old structure were changed by design: `live-security-audit-page.test.tsx` rules 1 and 3, and `live-users-roles-model.test.tsx` rule 1. | Drawer back on its own `queryFn`, `useQueryFailure` presenting cached failures: both **killed** |
| W92-9 | fixed | `features/home/use-health.ts` **moved** to `lib/health-query.ts` (the move was asked by D242; the pre-image is in rollback). `home-page.tsx` and `api-reference/service-banner.tsx` import it from `lib/`. | `core-queries.test.tsx` static: no feature imports `features/home/use-health`, and the old file is gone | Covered by the static guard (fails on the pre-fix tree) |
| W92-10 | fixed | `features/evidence/integrity-tab.tsx:99-101`: the record's value is pinned per run at the first render of the run, which still holds the old record. It is held while running and released at the end, as the mobile CF-M2 rule does. | `live-efix-evidence.test.tsx` "W92-10" (Live, delta-first). After the press the replica holds FAIL while the chip is RUNNING, the line still says "PASS · 09:59:00 · Budi", and after the run it moves to "FAIL · 10:00:00 · Andi". **Red:** before the fix the line already read "Last verification FAIL … AKP Andi Pratama" mid-run, the lane's +107 ms observation. | No pin, pin never released: both **killed** |
| W92-11 | fixed | `features/evidence/detail-page.tsx:204`: in Live mode with `media.status === 'unavailable'` the placeholder reads `evidence.live.mediaUnavailable`. The placeholder carries `data-testid="evidence-detail-still-empty"`. | `live-efix-evidence.test.tsx` "W92-11": a failed operation 40 shows "Media reference unavailable" and no "No DEMO media"; a NONE answer keeps "No DEMO media". **Red:** 1 failed before the fix (with only the testid added). | Condition on `loading` → **killed** |
| W92-13 | fixed | Option `afterAcceptedCommand` (`lib/core-errors.ts:105`, `:265`, `:268`) selects the new shared keys `common.coreErrors.offlineAfterAccepted` and `startingAfterAccepted` (`packages/shared/src/i18n/en/common.ts:636`). Passed by both walks: `system/export-logs-dialog.tsx:128` and `security-audit/export-audit-dialog.tsx:183`. | `lib/__tests__/live-core-errors.test.tsx`: new case for the flag, plus a check that the default sentences are unchanged. `live-system-export.test.tsx` and `live-security-audit-export.test.tsx` changed by design: the outage during the walk shows "Core server unreachable." and no "Nothing was changed". These two assertions fail on the pre-fix code (mutants m1 and m2). | Each page without the flag, and the presenter ignoring the flag: all 3 **killed** |
| W92-14 | fixed | `lib/device-command-gate.ts:50` `deviceCommandGate` and `:71` `useDeviceCommandGate`. Test signal and Identify are gated by DIAGNOSTICS_RUN and Restart by DEVICE_MANAGE (the table of operations 48 to 50). Restart is blocked while recording. LB-1 busy applies. The role is computed with `requiredRoleForPermission`. Both menus use it: `dashboard/devices-panel.tsx:145` and `devices/device-menu.tsx:48` (the hard-coded "TECHNICIAN" and the local selectors are gone). | `lib/__tests__/device-command-gate.test.ts` (7 cases: permissions checked against the contract operations, role computed, recording, busy; static check that both menus call the gate and hard-code nothing). `live-dashboard-devices.test.tsx` changed by design: "a restart while recording keeps the friendly toast" became "while recording Restart is disabled with the Devices page's reason; a press sends nothing". It fails on the pre-fix Dashboard, which offered Restart. | No recording rule, Identify on DEVICE_MANAGE, Dashboard ignoring the Test block, Devices menu never disabling Identify, busy ignored: all 5 **killed** |
| W92-16 | fixed | `test/live-evidence-export.test.tsx` (A5 outage) and `test/live-paired-devices-issue.test.tsx` (429 one warning toast): the tests spy on `toast.success/danger/warning/info` and assert **one call** after a flush and a 50 ms wait | — (test-quality fix) | A late second outage toast and a late second limit toast added in the presenter: both **killed** |
| W92-18 | fixed | `paired-devices/devices-panel.tsx`: the comment now says the panel defers through `deferEffectStart`, while the drawer invalidates directly and is the guard's allowed exception | wording only | — |
| W92-19 | fixed | `api-reference/realtime-panel.tsx:112`, `:260`: `role="group"` added | `test/fxr-w-nits.test.tsx` "W92-19" | One `role` removed → **killed** |
| W92-20 | fixed | `packages/shared/src/i18n/en/api-reference.ts`: `realtime.live.everySlice` removed (grep of `apps/*/src`: no user) | `packages/shared/test/fxr-w-nits.test.ts` "W92-20" | static |
| W92-21 | fixed | `api-reference/server-strip.tsx`: `ServerStripProps` is now a union keyed by `mode` (Live takes no switch props). The dummy props are gone from `api-reference/index.tsx`. | `fxr-w-nits.test.tsx` "W92-21": two `@ts-expect-error` lines, so `tsc -b` fails if the union widens | type-level |
| W92-22 | fixed | `components/composed/glow-ring.tsx:174` `measuringContext()`: one module-level 2D context (an absent context is cached too) | `components/composed/__tests__/glow-ring-fit.test.tsx` "W92-22": three fitted rings ask `getContext` at most once | New canvas per fit → **killed** (the first test version survived, because a rerender did not change the word; it was rewritten to three rings) |
| W92-23 | fixed | `packages/shared/src/api/administration.ts`: the comment now says strictness is "top level" only and names the nested objects | wording only | — |
| W92-24 | fixed | `packages/shared/src/api/operation-parts.ts:19` exports `WEB_SESSION_REFUSED`. `identity.ts` and `pairing.ts` import it (same string). `gen-openapi --check`: up to date (75 / 0.2.1; offline 10 / 0.1.0). | `fxr-w-nits.test.ts` "W92-24": one definition under `src/api`, and at least 5 operations still carry the text | static |
| W92-25 | fixed (label) | `packages/shared/src/api/examples.ts`: the example `version` is labelled synthetic and not tied to `apps/core-server/package.json`. The value is unchanged, and the server package is not read. | wording only | — |
| W92-26 | fixed | `api-reference/use-live-realtime-feed.ts`: the tap keeps the epoch and revision of each reading (`getPosition`, a stable object, and a change notifies). The hook reads it with `useSyncExternalStore` (`:185`) instead of calling `live.socketStatus()` in render. | `test/live-api-reference-document.test.tsx`: 2 new cases (the tap position, and the feed showing a new revision with no entry) | Hook back on `socketStatus()` in render, a position change that does not notify: both **killed** |

**Mutation total.** The final tests killed 36 of 36 mutants: W92-2 1, W92-3/4/8 8, W92-5 6, W92-7 4, W92-10 2, W92-11 1, W92-13 3, W92-14 5, W92-16 2, W92-19 1, W92-22 1, W92-26 2. Three earlier runs survived, and each led to a stronger test:
- the two W92-3 mutants (signed-in term removed) survived the page-level sign-out tests, so the hook-level gate tests were written;
- the first W92-22 draft survived, because a rerender kept the same word; the test was rewritten to three rings.

## 2. Suite ledger

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` | exit 0 (re-run after the last test edits: exit 0) |
| `npm run lint -w @dems/core-web` (oxlint) | exit 0, no output (re-run: exit 0) |
| `npm run typecheck -w @dems/shared` | exit 0 |
| `npm run lint -w @dems/shared` | exit 0 |
| `npm run typecheck -w @dems/mobile` (shared i18n and api changed) | exit 0 |
| `node --import tsx scripts/gen-openapi.ts --check` (shared) | "openapi/openapi.json is up to date (all: 75 operations, 2 security schemes, version 0.2.1; offline: 10 operations, 0 security schemes, version 0.1.0)" |
| shared full `npx vitest run --maxWorkers=2` (08:25, load 10.3) | **Test Files 71 passed (71), Tests 1851 passed (1851)**, 22.3 s. Was 70 / 1,848; +1 file / +3 tests (`test/fxr-w-nits.test.ts`). |
| core-web full `npx vitest run --maxWorkers=2` (08:26 to 08:30, load 11.1 to 7.4) | **Test Files 115 passed, 2 failed (117); Tests 1493 passed, 2 failed (1495)**, 239.7 s. The 2 failures were static structure pins that FXR-W changed by design: `live-security-audit-page.test.tsx` rule 2 (it pinned `presentCoreError(caught.reason.failure)` without the W92-13 flag) and `live-users-roles-model.test.tsx` rule 1 (it pinned `getRoleMatrix` as a call of the page; W92-8 moved it to `lib/`). Both pins were updated and the two files re-run: **31 passed (31)**. The whole suite was not re-run, per the "once each" rule. Expected whole-suite result after the fix: 117 / 1,495, all passing. Was 111 / 1,436; +6 files (4 new web test files and 2 new lib test files) and +59 tests. |

**Focused runs during the work** (all green at the end): boot-failure 8/8; core-queries 23/23; download 8/8; dev-console logging 5/5; device-command-gate 7/7; nits 2/2; efix-evidence 7/7; live-core-errors 31/31; system and audit exports 54 (with presenter); dashboard and devices menus 82/82; api-reference-document 111/111; glow-ring 45 → 8/8 in fit; a 10-file Live sweep (drawer, paired devices ×3, users-roles ×2, security-audit page, strict-mode starts, evidence verify, efix) 148/150 before the two static-pin updates, then green.

## 3. Changes by design to existing tests

Each of these changes keeps an assertion's intent or makes it stricter. None weakens a behavioural check.

| File | Change | Why |
|---|---|---|
| `features/login/__tests__/login-model.test.tsx` | `message: 'boom'` and `stack` contains 'boom' → `errorName: 'Error'`, no 'boom', no stack | W92-5: the old assertions pinned the defect |
| `test/live-security-audit-page.test.tsx` rules 1, 2, 3 | Operation 10 is read in `lib/core-queries.ts` through `roleMatrixQueryOptions`; the presenter call carries `afterAcceptedCommand` | W92-8, W92-13 |
| `test/live-users-roles-model.test.tsx` rule 1 | `getRoleMatrix` is no longer a call of the page; `queries.ts` uses the factory | W92-8 |
| `test/live-system-export.test.tsx`, `test/live-security-audit-export.test.tsx` (outage during the walk) | Toast `offlineAfterAccepted`, and no "Nothing was changed" | W92-13 |
| `test/live-dashboard-devices.test.tsx` (Simulated, recording) | Restart is now disabled with its reason; a press sends nothing | W92-14 |

## 4. Decisions and notes (for the controller)

- **DN-W1 (W92-8):** presentation moved out of `queryFn` into the components (`useQueryFailure`), as the reviewer's fix direction says. Page records keep their sources: `features/devices.pairedDevices`, `features/paired-devices.<op>`, `features/users-roles.getRoleMatrix` and `SecurityAudit.RbacPanel.roleMatrix`. Toasts now appear one commit later (after render); no existing test needed a change for that.
- **DN-W2 (W92-8):** the role matrix gate now includes the link (rule 6) on the Security & Audit panel too. With the link down and no answer yet, the panel shows its loading line instead of asking a read that would fail. Users & Roles narrows the same factory by `USER_ADMIN`.
- **DN-W3 (W92-10):** the pin covers Live mode, the lane case. In Simulated mode the simulator's verify updates the record in the same event batch as the run's start, so the pinned value may already be the new one. That is the same as before; nothing regresses.
- **DN-W4 (W92-7):** one revoke delay of 30 s for every download (the value the Evidence zip already used; at least 1 s).
- **DN-W5 (W92-9):** `features/home/use-health.ts` was removed by the move D242 asked for. `release/web/BUILD-INPUTS.txt:168` pins the old path's hash. That manifest is already stale for many `src` files (D9 DN-1), so it is not touched here; the packaging row regenerates it.
- **DN-W6 (W92-5):** `reportLoginIssue` now writes to the page's own log in every build (before, it wrote to the console in dev only). The record is in memory only and never sent anywhere.
- **For FXR-S:** nothing. W92-15 is deferred, and no constant was exported for the server.

## 5. Rollback

`/Users/gsp-budi/Documents/DEMS/.cache/rollback/FXR-W/`:
- `files/` holds 42 pre-images and `pre.sha256` (verified intact at the end: 42 OK, 0 mismatched).
- `reconstructed/` holds 5 pre-images of files that had no copy before their first edit, rebuilt by removing FXR-W's insertions, with `reconstructed.sha256`. A diff against HEAD contains no "FXR-W" text.
- `head_restorable.txt` lists 8 tracked files whose only uncommitted change is FXR-W's; restore those with `git show HEAD:<path>`.
- `created.txt` lists the 12 files FXR-W created, plus the move.
- `post.sha256` holds the hashes of the 66 files in their state after FXR-W.
