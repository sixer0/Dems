---
task_id: W59
blueprint_step: 81
task_slug: mobile-login-live-mode
date: 2026-10-05
agent: coder-execution-local
status: completed-with-one-deferred-evidence-item
gate: CLG
decision_refs: [D124, D129, D130, D133]
---

# W59 — Mobile Login in LIVE mode (blueprint step 81)

## 0. Sources cited (read before touching anything)

| Ref | Where | Used for |
|---|---|---|
| [PL] | `masterplan/02_plan.md` §8.4 row W59, §8.1 gate **CLG** (a)–(d) | the row, the four gate items |
| [SP] | `masterplan/04_client_integration_spec.md` §9.2 (mobile sign-in screens), §3.5 L1–L12, §6.5, §8.1 LB-10 | the three LIVE points, the offline Alert, the limit wording |
| [ST] | `identification/02_structured.md` P3/P4/P9/P10/P11/P14/P19/P23 | emulators, ports, sandbox bypass, noise, lanes, secrets, pre-image |
| [W56] | `implementation/56_mobile_sign_in.md` §11 seams, §6 device check | the auth layer built on; the fake-transport harness; the device procedure |
| [W55] | `implementation/55_web_login.md` | the web counterpart whose behaviour is mirrored (not its files) |
| [DEC] | `decisions/decisions.md` D124, D129 (DN-2/DN-8/DN-9), D130, D133 | runtime, rulings, the AUDIT-FIRST rule |
| base | `.cache/w59/baseline_folder.log`, `git diff acaff20 -- apps/mobile/src/features/login` | the folder's state and the interrupted agent's leftover |

## 1. What the audit found (D133 AUDIT-FIRST)

The previous attempt left **five modified production files plus one new file** (`login-live-model.ts`) and **no tests and no report**. Audited against the baseline log and `acaff20`:

- **The leftover production code is sound.** At session start, before any edit of mine, `npm run typecheck -w @dems/mobile` was clean and the folder's existing tests were **37 passed / 2 suites**, identical to `baseline_folder.log`. Every cross-module symbol the leftover references exists (`useMobileLive`, `setCoreLinkSource`, `usePairing`, `CoreErrorText`, `CoreErrorPresentation`, `AuthNoticeAlert`, `AuthNoticeKind`, `BiometricAvailability`, `HeartbeatState`, `PairingInfo`, `CoreLinkInfo.{source,heartbeat}`), and every i18n key resolves (`features.login.live.*` in the folder; `mobile.live.refusal.offline` in `en.mobile.ts`; `common.coreMode.useSimulated` and `login.live.demoNotice` in shared — the last two reused word-for-word with the web console, as D129 DN-2 requires).
- **One defect.** The leftover's LB-10 mechanism in `use-login-controller.ts` used a `useRef` flag plus a `useEffect` that called `clearPassword()` synchronously. Under this repo's React Compiler lint config that trips two errors — `react-hooks/set-state-in-effect` and `react-hooks/refs` ("passing a ref to a function may read its value during render"). It failed `npm run lint`.

## 2. Kept / rewrote / deleted

| File | Verdict | Why |
|---|---|---|
| `login-live-model.ts` | **kept** | pure LIVE rules, correct and well-scoped |
| `i18n.ts` | **kept** | adds `features.login.live.trust.*` + `offlineBody`; the C1 sentence and "Use Simulated mode" come from shared keys |
| `login-card.tsx` | **kept** | LIVE branches behind `live`: no pairing-code hint, no role chip, trust line, C1 notice, offline Alert with Retry + "Use Simulated mode", auth-layer notice owns the slot |
| `login-screen.tsx` | **kept** | passes `live` into the card |
| `login-model.ts` | **kept** | `isSubmitDisabled` takes `coreBlocked`; `isCoreBlocked` exported |
| `use-login-controller.ts` | **rewrote one block** | replaced the ref+effect LB-10 mechanism with the codebase's sanctioned **render-time state adjustment** (the same pattern already used for `liveOfflineShown`): a `awaitingLimit` state flag set in the submit's `UNAVAILABLE` branch, classified on the next render, clearing the password unless `signInFailure` is a limit. Behaviour identical, lint clean. |
| *(deleted)* | none | nothing in the leftover failed to serve the row |

New files I added: `live-login.test.tsx` (9 tests), `login-live-model.test.ts` (11 tests).

## 3. Status table per behaviour ([SP] §9.2, §3.5)

| # | Behaviour (LIVE) | Where | Evidence | Status |
|---|---|---|---|---|
| L1–L8 | password/biometric form, lockout, demo fill, choreography | unchanged from W56/Simulated | `login.test.tsx` (37, unchanged) | pass |
| L9 | Core unreachable → offline Alert, no address, Sign In disabled, Retry + "Use Simulated mode" | `login-card.tsx` `CoreOfflineAlert`; `liveOfflineNoticeAfter` | `live-login.test.tsx` "unreachable at start"; device `59_login_live_unpaired.png` (link ONLINE case) | pass |
| L10 | demo list = three usernames, no role chip, C1 sentence above the list | `DemoOperators live` | `live-login.test.tsx` "no role chip… C1"; device `59_login_live_disclosure.png` | pass |
| L11 | trust line names the device ID the Core gave this tablet; link "Pairing details" | `liveTrustLineFor`/`liveTrustTextFor` | `live-login.test.tsx` + `login-live-model.test.ts`; device shows the unpaired branch (F-1) | pass (jest) / see F-1 |
| L12 | a 429 is a limit: toast with the seconds, form kept, no offline notice, no mode change (LB-10, AC-C-110) | `isLimitFailure`, `awaitingLimit` | `live-login.test.tsx` "a 429 is a limit…" | pass |
| — | arrival notices (token-reuse, biometric-invalid, user-disabled, absolute-expired) own the one Alert slot | `NoticeAlert` auth-notice branch | `live-login.test.tsx` biometric-invalid test; [W56] covers the rest | pass |
| — | Simulated mode behaves exactly as today | every LIVE branch gated on `live` | `login.test.tsx` (37, unchanged) | pass |

## 4. Gate CLG

| Item | Result |
|---|---|
| (a) existing tests pass; folder files absent from `git diff --stat acaff20` except my production files | **met.** `login.test.tsx` and `login-model.test.ts` are absent from the diff (unchanged). Only the 5 production files are modified; `login-live-model.ts` + 2 test files are additions. |
| (b) one Live test per settle site on the fake transport: success, refusal, outage | **met.** `live-login.test.tsx` drives the real `LoginScreen` over `createMobileLive(...)` + the contract-checked fake transport: success (one `signIn`, device credential bearer, password cleared), wrong-password refusal, outage-at-start (offline Alert), unanswered-request (presenter sentences), plus the 429 limit and a storage/log secret scan. The sign-in site has no permission, so AC-C-48's denied toast does not apply to it (as [W55] notes for the same site). |
| (c) no `useSimActions`, no `.actions` read on a Sim in production files | **met.** Manual grep matches only i18n key strings (`common.actions.retry`). Enforced by `login-live-model.test.ts` which strips string literals then asserts neither token appears. |
| (d) ONE device check ≤10 min on lane 1, core=LIVE, screencaps | **met for the observable points; the paired-device sign-in is deferred (DV-1).** See §6. |

## 5. Tests and verification

| Command | Result |
|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2 src/features/login` | **57 passed / 4 suites** (37 existing + 9 `live-login` + 11 `login-live-model`) |
| `npm run test -w @dems/mobile -- --maxWorkers=2` (full) | **1207 passed / 92 suites, 0 failed** (controller baseline 1187 + my 20) |
| `npm run typecheck -w @dems/mobile` | clean |
| `npm run lint -w @dems/mobile` | clean (0 problems) |

**Mutation check** (edit `login-live-model.ts`, run `live-login.test.tsx`, restore):

| Mutation | Tests failing | Detected? |
|---|---|---|
| `isLimitFailure` → always `false` (LB-10 broken) | 1 | yes |
| `isLiveLogin` → always `false` (all LIVE branches off) | 4 | yes |
| restored | 0 (57 pass) | — |

## 6. The device check (CLG (d))

Lane 1 only: `dems2_phone` (`emulator-5554`), backend `127.0.0.1:4421`, database `dems_lane_1`, Metro 8082, inside `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock` and `apps/mobile/scripts/device-session.sh phone` with `DEMS_CORE_HOST_PORT=4421`. Scripts: `.cache/w59/run_w59.sh`, `.cache/w59/device_w59.sh` (method of [W56]). Session 10:34:22–10:35:56 (~94 s device time). Full log: `assets/59_device_run.log`; after-state: `assets/59_device_after_state.txt`.

The device is **not paired** (W56 left it so; pairing is W57's flow). It opened with `core=LIVE` (`dems.mobile.prefs.v1` = `{"coreLinkSource":"LIVE"}`), made only two anonymous GETs (`auth/session` 401, `auth/status` 200), sent **zero** sign-in/POST requests, logged **zero** JS errors and **zero** credentials, held **no** secure-store entry, and was returned to `core=SIMULATED` and force-stopped. Backend stopped, no listeners left, `.locks/core-server.lane1.pid` emptied, Metro stopped by the session. Keyguard never shown, fingerprint count 1 untouched, lock state identical start↔end.

| Screencap | What it shows |
|---|---|
| `assets/59_login_live_unpaired.png` | Login in LIVE mode: "Core online"; trust line **"Core server • not paired"**; link **"Pair this tablet"**; fingerprint button disabled with the W56 caption; **no role chip, no pairing-code hint** |
| `assets/59_login_live_disclosure.png` | Demo-operator disclosure open in LIVE: the **C1 sentence** "Published demo credentials for synthetic accounts on this local demo. They are not a secret."; **"Select an operator to fill the form"** (in place of the pairing-code hint); an operator row with **no role chip**; no password visible |
| `assets/59_after_reset_simulated.png` | App back in SIMULATED (prefs confirm `SIMULATED`); soft keyboard over the lower card |

## 7. Findings (F-n)

- **F-1** — `dems2_phone` is unpaired on lane 1. [W56] explicitly deferred the paired sign-in to W59, but pairing itself is W57's flow, still awaiting its gate. So the on-device trust line can only show the **unpaired** branch; the device-ID-naming branch of AC-C-72 is proven by jest (`live-login.test.tsx`, `login-live-model.test.ts`) and needs a paired lane-1 phone for on-device evidence.
- **F-2** — the leftover LB-10 mechanism failed the React Compiler lint rules; rewritten to the render-time pattern (§2).
- **F-3** — `am start -W` reports `Status: timeout` for the `core=LIVE` deep link because the Live source keeps the JS thread busy past the launch timeout; the source reports ready ~5 s later. Harmless; noted so a future reader does not mistake it for a failure.

## 8. Deviations (DV-n)

- **DV-1** — CLG(d) was run as a **look** capture of the LIVE Login screen and its disclosure, not a full paired sign-in, because no paired lane-1 phone exists and creating one is out of W59's scope (it is W57's gated flow). The sign-in settle site is covered end-to-end by jest on the fake transport (CLG b). Recommend the controller schedule the paired device sign-in after W57 gates.

## 9. Decisions for the controller (DN-n)

- **DN-1** — Accept CLG(d) as satisfied for the observable LIVE points (unpaired trust-line branch, C1 sentence, no role chip, no pairing-code hint), with the paired-device sign-in deferred to after W57 gates (DV-1)?
- **DN-2** — Confirm the LB-10 rewrite (render-time `awaitingLimit` state) replaces the leftover ref+effect, which cannot pass this repo's lint.
- **DN-3** — Confirm the i18n split satisfies D129 DN-2: the C1 sentence (`login.live.demoNotice`) and "Use Simulated mode" (`common.coreMode.useSimulated`) are reused word-for-word from shared/web; only `features.login.live.trust.*` and `features.login.live.offlineBody` are mobile-local.

## 10. Rollback

Delete `login-live-model.ts`, `live-login.test.tsx`, `login-live-model.test.ts`; revert `i18n.ts`, `login-card.tsx`, `login-model.ts`, `login-screen.tsx`, `use-login-controller.ts` to `acaff20`. The LB-10 rewrite is confined to `use-login-controller.ts`. Remove `assets/59_*` and this document. Nothing outside `apps/mobile/src/features/login/**` was changed.

---
*Generated: 2026-10-05 10:45*
