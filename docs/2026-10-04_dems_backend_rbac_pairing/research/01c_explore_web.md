---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: explore
blueprint_row: 3
scope: apps/core-web consumption of the shared simulator (@dems/shared/sim); read-only inventory
narrative_tier: 2
status: complete
---

# Web console: how `apps/core-web` consumes the simulator (row 3)

## 0. Summary for the controller

Everything below is structure and evidence. No design is proposed. Paths are relative to `/Users/gsp-budi/Documents/DEMS/` unless a column says `apps/core-web/src/`-relative. A finding that is a hypothesis is labelled so.

| Check the controller asked for | Result | Evidence |
|---|---|---|
| Files under `apps/core-web/src` matching `@dems/shared/sim` | **167** (equals the blueprint-time count; no drift) | `grep -rl '@dems/shared/sim' apps/core-web/src \| wc -l` printed `167` at run time (section 13) |
| Every one of those files appears in exactly one group | G1-G18 below hold 167 rows, 167 distinct paths, 0 missing, 0 duplicated | script diff quoted in section 13 |
| Call sites that use an action's synchronous return value | 14 value-returning actions exist in `SimActions`; the web consumes the return value of **11** of them at **14 production sites** (section 5.1), plus 4 test sites that consume a return value and 1 that relies on the synchronous effect (section 5.7) | `file:line` in section 5.1 |
| Storage keys and guards quoted from code | 2 shared keys and 6 web-owned keys (section 7); 3 route guards plus 1 in-shell leave path (section 4.3) | quotes with `file:line` |

Headline facts a Live data source must respect (each is expanded in the register, section 2):

1. The web makes **one** `Sim` in `main.tsx` and hands it to the router context and to `SimProvider`; every page reads state through `useSim(selector)` and writes through `useSimActions()` or `sim.actions` (W-01, W-02).
2. Roles and permissions are decided **in the client** from a static table (`ROLE_PERMISSIONS`, `roleHas`, `selectCan`) bundled in `packages/shared`; the web has no code that reads a server-supplied permission (W-07).
3. Sign-in, lockout and the 15-minute idle expiry run inside the simulator; the web only displays them, and its sign-in code depends on a synchronous `SignInResult` (W-04, W-09).
4. Three route guards read `context.sim.store.getState()` synchronously outside React (W-06).
5. The audit hash chain is **re-verified in the browser** from the store's audit ring (W-13), and evidence packages are verified in the browser from bundled demo files (W-14).
6. The Core origin in the web is one of two values, `http://127.0.0.1:4400` or the page origin; there is no setting for a third origin, and the packaged CSP `connect-src` allows loopback `ws://` only (W-15, W-16).
7. 24 `createSim(` call sites in 19 test files plus `main.tsx` depend on the in-process `Sim` object, its `tick`/`flush`/`ready`/`stop` members and direct `store.setState` (W-19).

## 1. Scope, method, sources

| Item | Statement |
|---|---|
| Read-only | No file under `apps/`, `packages/`, `release/` or `scripts/` was modified (`git status --porcelain apps packages scripts release` printed nothing before this file was written). No server or process was started. A temporary parse script ran under the session scratchpad only. |
| Graft (CLAUDE.md §10) | `graft/` exists. Used: `graft map` (orientation: 903 files, 5368 symbols, 16738 edges), `graft skeleton packages/shared/src/sim/react.ts`, `graft grep` over `--in apps/core-web/src` for the value-returning actions (24 hits, 14 files, confirmed every site in 5.1), `graft callers` for `exportAuditWithReason`, `scanCaseNumber`, `restartCoreServices`, `recordPackageVerification`, `useStartDiagnostics`, `useSimCommand`, `readLastAuthEvent`, `useSimActions`, `useSimInstance`, `createSim`. |
| Direct inspection | `Grep`/`Read`/`Bash grep` for everything else: file lists, import lists, storage keys, `try/catch` extents, tests, CSP, config. Graft indexes 343 of the 360 files under `apps/core-web/src`, skips non-code files, and does not see variable-renamed callers of `useSimCommand` (it listed only one of five callers), so counts that decide the 167-file groups come from `grep`. |
| Heuristics | The per-file table columns "Named selectors", "Slices read inline", "Actions" and "store access" come from a regex pass over each file (imports from `@dems/shared/sim`; `s.<slice>`/`state.<slice>` property reads; `actions.<name>`/`sim.actions.<name>` calls; `.store.getState, .subscribe or .setState`). They are a lower bound: selectors defined in feature-local modules (for example `features/session-monitor/model.ts`) and slices read through them appear in the "Note" column, not in the inline-slice column. The sync-return sites in section 5 were each read in context, not taken from the regex. |
| Password and token values | None is printed. Demo credentials are cited by constant name and `file:line` only (`DEMO_OPERATOR_PASSWORD` at `packages/shared/src/sim/dataset.ts:153`). |

## 2. Findings register (Tier 2)

| ID | What was found | Why it matters for this task | How verified | Source |
|---|---|---|---|---|
| W-01 | One simulator per page load. `main.tsx` dynamically imports `createSim` after `z.config({ jitless: true })`, calls `createSim({ onError })` with no storage option (so the default web `sessionStorage` adapters apply), builds the router with `{ sim, queryClient }`. `RouterContext.sim: Sim`. `routes/__root.tsx` wraps the tree in `SimProvider sim={sim} autoStart`, which calls `sim.start()` on mount and `sim.stop()` on unmount. | The single injection point for a data source is `main.tsx:37-38` plus `router.tsx:18-22` plus `routes/__root.tsx:73`. A Live source must satisfy whatever the web uses of `Sim` (W-02) at all three. | Read of the three files; `graft callers createSim` lists `main.tsx` | `apps/core-web/src/main.tsx:19,37,38`; `apps/core-web/src/router.tsx:18-22`; `apps/core-web/src/routes/__root.tsx:71-73`; `packages/shared/src/sim/react.ts:45-57` |
| W-02 | The web uses these members of `Sim`: `store.getState`, `store.subscribe` (with selector), `store.setState` (tests only), `actions.*` (36 distinct actions in production code, section 3), `request` (one place), and through the provider and hooks `start`, `stop`, `ready`, `isReady`. Tests also call `tick`, `flush`, `destroy`, `ready`. `Sim` also has `clock`, `rng`, `seed`, `errors`, `wasRestored`, `isRunning`: no web file reads them. | Defines the minimum surface a Live implementation of the `Sim` contract (ADQ-2) has to cover for the web. | `Grep` for `\bsim\.(request\|start\|stop\|flush\|tick\|isReady\|wasRestored\|ready\|errors\|clock\|rng\|seed\|destroy\|isRunning)` in production code (only `sim.request` in `features/api-reference/sim-adapter.ts:44`) and in tests | `packages/shared/src/sim/engine.ts:63-97`; `packages/shared/src/sim/react.ts:60-91` |
| W-03 | Read side: 88 production files call `useSim`; 32 distinct named `select*` selectors are imported; 26 of the 33 `SimState` slices are read inline by property name (`activeCameraId, alerts, audit, auth, cameras, clock, device, diagnostics, events, evidence, faults, health, meta, mics, network, operators, pairing, ports, security, services, session, storage, storagePolicy, tabletLink, time, update`). The 20 Hz `audio` slice is read by `useAudioChannel` in 3 files and by `store.getState().audio` in 1. | Components bind to slice shapes, not to an API. A Live source behind `useSim` has to deliver the same slice shapes, including whole rings (`s.audit`, `s.events`) and 1 Hz histories. This is the data-layer size of ADQ-2. | `node` pass over the 167 files (named selectors: 32; `useSim` files: 88; inline slices: 26), spot-read of the heaviest files | per-file rows in section 11; `apps/core-web/src/features/security-audit/use-security-data.ts:30` (`useSim((s) => s.audit)`) |
| W-04 | Sign-in is client-side and synchronous. `useLoginController` calls `actions.signIn(typedUsername, typedPassword)` and `actions.signInWithSecurityKey()` inside a `schedule()` timer, inside `try`, and passes the returned `SignInResult` to `settle()`, which branches on `result.ok`, `result.operatorId`, `result.reason` (`INVALID_CREDENTIALS` or locked) and `result.attemptsRemaining`. The password state is cleared in `finally` (`setPassword('')`). Lockout and its countdown come from `selectLockout`. A short UI beat (`VERIFY_BEAT_MS`, `SECURITY_KEY_PROMPT_MS`) exists only because the simulator answers synchronously. | The result shape and the lockout display are contract points between the web and any server-side sign-in. The beat constants become unnecessary under a network call. | Read in full | `apps/core-web/src/features/login/use-login-controller.ts:90,149-170,180-222`; `apps/core-web/src/features/login/login-model.ts:31-33` |
| W-05 | Stored session: the web never touches storage for auth. The shared simulator saves `{ operatorId, issuedAt }` under `dems.auth` in `sessionStorage` after sign-in, clears it on sign-out, and `restoreAuth` turns it back into a SIGNED_IN auth slice at construction. The simulator snapshot lives under `dems.sim.v1` in `sessionStorage`. | In Simulated mode a page reload keeps the operator signed in with no credential check. A Live session needs a different stored-session model; the two existing keys must not be deleted (U8, E10). | Read of `platform.ts`, `constants.ts`, `engine.ts`, `auth.ts`; `Grep` for the key names in `apps/core-web/src` (only a test imports `AUTH_STORAGE_KEY`) | section 7; `packages/shared/src/sim/engine.ts:198-214`; `packages/shared/src/sim/auth.ts:373-387` |
| W-06 | Three route guards read the store synchronously outside React (`beforeLoad`), plus one in-shell leave path inside React. | A guard that must wait for a network answer turns `beforeLoad` async or needs a locally cached session; this is the place where "signed in" is decided before any page renders. | Read of the four files | section 4.3 |
| W-07 | Permission gating is client-side. `selectCan(state, permission)` = `roleHas(selectRole(state), permission)` over the static `ROLE_PERMISSIONS` table in `packages/shared`. 13 production files (16 call lines) call `selectCan`; 4 files call `roleHas` directly; 3 feature models import `ROLE_PERMISSIONS` to name the "Requires the X role" role (`requiredRoleFor`, `roleFor`, `roleGrants`). Nothing in the web reads a permission list from a session or server. The navigation (`nav-items.ts`) has no permission field: every role sees every page. | Server-defined RBAC (goal 2) means these sites need a different permission source, and any "role changed while signed in" handling (E2) has no existing client code. | `Grep` for `selectCan\|roleHas\|ROLE_PERMISSIONS\|Permission\.` | section 4.4; `packages/shared/src/sim/selectors.ts:44-50`; `packages/shared/src/sim/auth.ts:53-72` |
| W-08 | Pairing is displayed read-only. The login trust line shows "paired (simulated)" or "not paired (simulated)" from `s.pairing.state` (`PAIRED` only). The Devices drawer shows `common.pairingState.*` and `s.tabletLink`. Network and Time and the LCD/port views read `s.tabletLink.state`. The web calls none of `pair`, `unpair`, `signInWithBiometric`, `recordBiometricFailure` and `setTabletLink` outside tests. | The portal has no pairing management today; the "Paired Devices" page (Q9) is new UI. The existing displays say "(simulated)" and read the simulator's `pairing` slice, which in Live mode would describe the mobile pairing. | `Grep` for `pairing\|tabletLink\|paired\|TABLET` and for the five action names | section 4.5 |
| W-09 | Value-returning actions: 14 in the interface. The web consumes the return value of 11 at 14 production sites; 3 (`signInWithBiometric`, `recordBiometricFailure`, `pair`) have no web call site. | A network call cannot return synchronously: each site needs an asynchronous contract. | each site read in context; `graft grep` cross-check (24 hits in 14 files, includes comments and tests) | section 5.1 |
| W-10 | Failure is signalled by synchronous `throw`, not by return value, at 36 void-action call sites (23 with their own `try/catch`, 13 behind `useSimCommand`): `SimPermissionError` and `SimTransitionError` are tested with `instanceof` in 4 production files and `.permission`, `.from`, `.event` are read in `useSimCommand`. | Under Live these errors arrive as HTTP statuses or rejected promises; every `try/catch` around an action is an adaptation point and the error classes carry data the toasts use. | `Grep` for `instanceof Sim`, read of each `try/catch` | section 5.2 |
| W-11 | Seven sites call a void action and then read its effect straight from the store in the same tick ("read-your-write"). | A write that resolves later makes these reads stale; they need the action's response or a wait for the store update. | read in context | section 5.3 |
| W-12 | `actions.touch()` runs on every `pointerdown` and `keydown` in the shell. The simulator throttles it to once a second internally. | At network cost this is up to one request per second of activity unless the Live source throttles it too. | read | `apps/core-web/src/components/shell/app-shell.tsx:96-111` |
| W-13 | The audit chain is verified in two places: the simulator's `verifyAuditChain()` action (two buttons) and a web-side `verifyChain(log)` that recomputes `chainHash(prevHash, auditBody(row))` over the audit ring held in the store, for the Security and Audit chain strip. | A Live audit table must deliver `prevHash`, `hash`, `seq`, `dropped` and the whole row body in the same shape, or the web's own check reports a break. | read of `model.ts:1-120` and the chain panel | `apps/core-web/src/features/security-audit/model.ts:6-16,57-85` |
| W-14 | Evidence packages are verified in the browser. `useEvidenceVerification` fetches bundled files (`import.meta.glob` of `packages/shared/assets/demo-media/**` and `demo-evidence/**`), recomputes hashes, then records the outcome in the simulator through `recordPackageVerification` (which first mirrors a tamper with `inject(TAMPER)` and then calls `verify`). Demo media for live camera feeds come from `components/media/demo-media.ts` the same way. Both are bundle-time globs, not network reads of a Core. | IQ-8 (who serves media in Live mode): today the files are baked into the web build. | read | `apps/core-web/src/features/evidence/demo-assets.ts:30-37,77`; `apps/core-web/src/features/evidence/sim-adapter.ts:84-97`; `apps/core-web/src/components/media/demo-media.ts:28-29` |
| W-15 | Core origin: `coreHttpOrigin()` is `CORE_HTTP_ORIGIN` (`http://127.0.0.1:4400`) or `window.location.origin` when `VITE_DEMS_CORE_ORIGIN === 'same-origin'`; `coreWsUrl()` is `CORE_WS_URL` or `ws(s)://<page host>/ws`; `allowedPageOrigins()` is `WEB_DEV_ORIGINS` (port 5173 only) or the page origin. `vite.config.ts` has no `server.proxy`. | A backend on another port is unreachable from the web without a change here, in `vite.config.ts` or in shared constants (F-A10). | read | section 9.1 |
| W-16 | The packaged CSP is built from `packagedCspDirectives`; `connect-src` is `'self' ws://127.0.0.1:<port> ws://localhost:<port>`. The same text is duplicated in the launcher and pinned by a test. | A packaged build that talks to a backend over `http://` would need a `connect-src` change in two places and in the test; the packaged build is E8 (Live must stay inert). | read; `Grep` of `connect-src` in the launcher | section 9.2 |
| W-17 | API Reference: the page builds one `simAwareFetch` per `Sim` and hands it to Scalar as `customFetch`. Only `GET /api/v1/health` goes to the network; every other `{core}/api/v1/*` request is answered by `sim.request(...)` through `answerSimulated`; anything else rejects with `BlockedRequestError`. The page's own function is `async`, so it is not synchronous-return dependent; `sim.request` underneath is. | When every operation is live (IQ-23), the split in `sim-fetch.ts:105-122` and the "Show simulated endpoints" switch change meaning. | read | section 9.3 |
| W-18 | Sign-in is already gated on a Core network link: `isCoreBlocked(coreLink)` (heartbeat OFFLINE) disables Sign In and the security key; the heartbeat client points at `coreWsUrl()`. | Today "Core offline" means mock-core is down, although sign-in itself does not use the Core. A Live backend becomes the real subject of that gate. | read | `apps/core-web/src/features/login/login-model.ts:41-58`; `apps/core-web/src/features/login/use-login-controller.ts:86-89,142-147` |
| W-19 | Tests: 39 test files exist under `apps/core-web/src`; 26 import `@dems/shared/sim` (28 rows in the groups, because two helper modules `harness.ts` and `test-utils.ts` are also in the 167). 24 `createSim(` calls in 19 files build a private in-process simulator: all pass `storage: null` except `features/login/__tests__/login-page.test.tsx:105` (default `sessionStorage` adapters); all pass a no-op `scheduler` except `test/integrity-checks.test.ts:17` (it never calls `start`); 3 pass no `authStorage` option (`login-page.test.tsx:105`, `core-endpoint.test.tsx:202`, `system-model.test.tsx:87`). 6 more test files get a simulator through the two helper modules. 7 files write state directly with `store.setState` (8 call sites). Tests drive time with `tick()`, `flush()` and a manual clock `advance`. | Any change that makes the web's data layer asynchronous or network-bound must keep these suites runnable in Simulated mode (NFR6). | `grep -c "createSim("` per file; read of option blocks | section 12 |
| W-20 | There is no web code for: a permission or role change while signed in, a revoked device, a session invalidated by the server, a Users or Paired Devices page, or a mode selector. `AppLayout` reacts to `auth.status` leaving SIGNED_IN (SIGNED_OUT, LOCKED, EXPIRED) only. | Confirms these are new work in the client integration spec (rows 17 and later), not adaptations. | `Grep` of `routes/`, `components/shell/`, `features/` | `apps/core-web/src/components/shell/app-layout.tsx:34-62` |
| W-21 | Six web-owned browser-storage keys exist besides the two simulator keys (section 7). None holds auth, session or simulator state; one (`dems.system.prefs.v1`) mirrors the simulator's `settings` slice. | The mode selector's persistence and E10 (keys never deleted) need a key that does not collide. | `Grep` for `STORAGE_KEY\|getItem\|setItem` | section 7 |

## 3. The simulator seam (how the web gets and uses a `Sim`)

| Layer | Code | Behaviour | Source |
|---|---|---|---|
| Creation | `const sim = createSim({ onError: reportSimError })` | default storage adapters (web `sessionStorage`); error sink logs to console in DEV only | `apps/core-web/src/main.tsx:37`, `31-35` |
| Router context | `RouterContext { sim: Sim; queryClient; socketFactory? }`; `createAppRouter` used by `main.tsx` and by tests the same way | guards read `context.sim` | `apps/core-web/src/router.tsx:18-22,29-43` |
| Provider | `<SimProvider sim={sim} autoStart>` inside `HeartbeatProvider` inside `QueryClientProvider` | start on mount, stop on unmount | `apps/core-web/src/routes/__root.tsx:71-73`; `packages/shared/src/sim/react.ts:45-57` |
| Read hook | `useSim<T>(selector)` = `useStore(sim.store, useShallow(selector))` | shallow compare; 88 production files | `packages/shared/src/sim/react.ts:67-70` |
| Write hook | `useSimActions()` = `useSimInstance().actions` | 22 production files, 25 call sites | `packages/shared/src/sim/react.ts:72-74` |
| Instance hook | `useSimInstance()` throws outside a provider | 14 production files, 15 call sites; used for `sim.store.getState()` and `sim.request` | `packages/shared/src/sim/react.ts:60-64` |
| Ready hook | `useSimReady()` waits for `sim.ready` | `components/shell/secure-pill.tsx`, `features/evidence/list-page.tsx`, `features/security-audit/use-security-data.ts` | `packages/shared/src/sim/react.ts:77-91` |
| 20 Hz channel | `useAudioChannel(channel, onFrame)` subscribes to `state.audio.channels[channel]` with `fireImmediately` and never renders | `components/composed/dbfs-meter.tsx`, `features/devices/audio-input-card.tsx`, `features/devices/context.ts:45-46` | `packages/shared/src/sim/react.ts:97-112` |
| Outside a provider | `useSimSecond()` and `useSimNowReader()` read `SimContext` directly and fall back to the wall clock | `components/media/use-sim-clock.ts` | `apps/core-web/src/components/media/use-sim-clock.ts:22-44` |

SimActions has 42 members (`packages/shared/src/sim/types.ts:985-1094`, counted: auth 6, session 13, evidence and audit 6, faults and scenarios 6, devices and maintenance 6, settings 2, pairing 3). The web's production code calls 36 distinct ones: `acknowledgeAlert, acknowledgePrecheckWarnings, addMarker, addNote, archiveEvidence, beginPrecheck, cancel, clearFault, createSession, deviceCommand, exportAudit, exportEvidence, exportLogs, inject, loadScenario, recover, resetClip, resetDemo, restartServices, retryPrecheck, runDiagnostics, scanCaseNumber, setActiveCamera, setPresentationMode, setStoragePolicy, signIn, signInWithSecurityKey, signOut, snapshot, startRecording, startSoftwareUpdate, stopRecording, touch, updateSettings, verify, verifyAuditChain`. Not called by production web code: `signInWithBiometric`, `recordBiometricFailure`, `acknowledgeSummary`, `pair`, `unpair`, `setTabletLink` (tests call `setTabletLink`). The `Grep` behind this list uses the regex `(?<![\w.])actions` and `sim\.actions` so `t('common.actions.cancel')` translation keys are excluded.

## 4. Sign-in, stored session, guards, permission gating, pairing display

### 4.1 Sign-in code

| Piece | Where | What the code does |
|---|---|---|
| Form, submit, security key | `apps/core-web/src/features/login/use-login-controller.ts:180-222` | `submit()` validates fields, sets `pending`, `schedule(beatMs(VERIFY_BEAT_MS), ...)`, then `result = actions.signIn(typedUsername, typedPassword)` in `try` (196-199); `finally` clears the password (200-203); `settle(result)` (204) |
| Result handling | `use-login-controller.ts:149-170` | OK: `setAccepted(operators.find(...))`, `onAccepted(result.operatorId)`. Not OK: `INVALID_CREDENTIALS` keeps `attemptsRemaining`; otherwise "LOCKED: the Alert comes from the live lockout state" |
| Lockout display | `use-login-controller.ts:74-81,90` | `selectLockout` reduced to `{ locked, retryInSeconds }` inside the selector |
| Core gate | `login-model.ts:56-58`, `use-login-controller.ts:88-89,142-147` | `isCoreBlocked(coreLink)` when heartbeat is OFFLINE disables submit |
| Demo operators | `use-login-controller.ts:91`, `auth-card.tsx:20,286-288,413-455`, `use-login-controller.ts:249-254` | `s.operators` (usernames, roles) is read before sign-in; the "Demo operators" disclosure shows `DEMO_OPERATOR_PASSWORD` and `fill()` puts it into the password field; hidden in presentation mode (`usePresentationMode`, `features/login/sim-adapter.ts:17-21`) |
| Security key | `auth-card.tsx:280-283`; `use-login-controller.ts:208-222` | "Use security key (simulated)" calls `actions.signInWithSecurityKey()`; the shared constant `SECURITY_KEY_OPERATOR_ID` signs in the SUPERVISOR operator |
| Biometric | none | `Grep -ri biometric apps/core-web/src` returns nothing (mobile only) |
| After sign-in | `features/login/index.tsx:77-110` | `onAccepted` preloads the target; `finishHandOff` calls `navigate({ href: target, replace: true })` (107); the `/_app` guard then reads the signed-in store (4.3) |
| Arrival notice | `features/login/sim-adapter.ts:27-33`; `login-model.ts:156-180` | `readLastAuthEvent(sim)` reads `selectLastSignOut(sim.store.getState())` once on mount for "signed out / console locked / session expired" |
| Redirect parameter | `apps/core-web/src/routes/-search.ts:34-39` | `searchRedirect = z.string().max(512).regex(/^\/(?![/\\])[^\s]*$/).optional().catch(undefined)` (open-redirect guard) |
| Sign-out and lock | `components/shell/user-menu.tsx:20-23` | `actions.signOut(SignOutReason.LOCK)` or `(SignOutReason.USER)`; no `try/catch` |
| Idle | `components/shell/app-shell.tsx:96-111`; `packages/shared/src/sim/constants.ts:54`; `packages/shared/src/sim/engine.ts:121-132` | `touch()` on every `pointerdown`/`keydown`; the engine's `auth-idle` subsystem expires the session after `AUTH_IDLE_TIMEOUT_MS = 15 * 60_000` |

### 4.2 Stored session

Quoted from code. `packages/shared/src/sim/constants.ts:12,16`:

```ts
export const SIM_STORAGE_KEY = 'dems.sim.v1';
export const AUTH_STORAGE_KEY = 'dems.auth';
```

`packages/shared/src/sim/platform.ts:123-127` (what is saved; no password, no token):

```ts
storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ operatorId: record.operatorId, issuedAt: record.issuedAt }))
```

`packages/shared/src/sim/platform.ts:155-161` (default store): "web session storage key `dems.auth` when present, else memory". `packages/shared/src/sim/auth.ts:373-387` `restoreAuth(operators, record, now)` returns `status: AuthStatus.SIGNED_IN` for a stored record whose operator exists, with `method: null`.

### 4.3 Route guards and the in-shell leave path (quoted)

| Guard | File and lines | Code |
|---|---|---|
| Signed-in required | `apps/core-web/src/routes/_app.tsx:9-14` | `beforeLoad: ({ context, location }) => { if (!selectIsSignedIn(context.sim.store.getState())) { throw redirect({ to: '/login', search: { redirect: location.href } }) } }` |
| Signed-in visit to login | `apps/core-web/src/routes/login.tsx:8-14` | `beforeLoad: ({ context }) => { if (selectIsSignedIn(context.sim.store.getState())) { throw redirect({ to: '/dashboard', replace: true }) } }` |
| Session start permission | `apps/core-web/src/routes/_app/session/new.tsx:15-19` | `beforeLoad: ({ context }) => { if (!selectCan(context.sim.store.getState(), Permission.SESSION_START)) { throw redirect({ to: '/dashboard', replace: true }) } }` |
| `/` | `apps/core-web/src/routes/_app/index.tsx:4-8` | always redirects to `/dashboard` |
| In-shell leave | `apps/core-web/src/components/shell/app-layout.tsx:34-62` | `const status = useSim((s) => selectAuth(s).status)`; when not `AuthStatus.SIGNED_IN` it navigates to `/login`, with `search: status === AuthStatus.EXPIRED ? { redirect: hrefRef.current } : {}` after a leave guard timer (`LEAVE_GUARD_MS`, 55-62) |

`selectIsSignedIn` is `s.auth.status === AuthStatus.SIGNED_IN` (`packages/shared/src/sim/selectors.ts:45`). The other routes (`dashboard`, `devices`, `session` index, `evidence`, `evidence/$evidenceId`, `storage`, `network-time`, `security-audit`, `system`, `developer/api`, `stack-check`) have no guard of their own beyond `_app`.

### 4.4 Permission gating (production code)

| Mechanism | Sites (file:line) |
|---|---|
| `selectCan(s, Permission.X)` inside `useSim` | `features/evidence/detail-page.tsx:73` (EVIDENCE_REVIEW); `features/evidence/list-page.tsx:63` (EVIDENCE_REVIEW); `features/evidence/export-wizard.tsx:86` (EVIDENCE_EXPORT); `features/session-new/index.tsx:80` (SESSION_START); `features/dashboard/active-session-panel.tsx:70` (SESSION_START); `features/dashboard/devices-panel.tsx:40` (DEVICE_MANAGE); `features/devices/device-menu.tsx:33` (DEVICE_MANAGE); `features/storage/manage-drawer.tsx:21` (EVIDENCE_REVIEW or MAINTENANCE); `features/system/diagnostics.tsx:25-27` (DIAGNOSTICS_RUN, MAINTENANCE, AUDIT_EXPORT); `features/system/update-panel.tsx:13` (MAINTENANCE); `features/security-audit/audit-log-panel.tsx:232` (AUDIT_EXPORT); `features/session-monitor/model.ts:69-70` (SESSION_START, SESSION_NOTE); route guard `routes/_app/session/new.tsx:16` |
| `selectRole` + `roleHas(role, permission)` | `features/dashboard/quick-actions-panel.tsx:34,87`; `features/system/quick-actions.tsx:7,65`; `features/session-new/index.tsx:104` (default investigator); `features/session-new/info-step.tsx:79` (investigators list) |
| Static `ROLE_PERMISSIONS` lookups naming the required role | `features/dashboard/dashboard-model.ts:320-324` (`requiredRoleFor`); `features/system/model.ts:19-23`; `features/security-audit/model.ts:434-455` (`PERMISSION_ORDER`, `ROLE_ORDER`, `roleGrants`, `roleFor`) |
| Disabled control plus "Requires the X role" | `features/system/diagnostics.tsx:47-` (`RbacGate`); `features/dashboard/devices-panel.tsx:53`; `features/dashboard/active-session-panel.tsx:108`; `features/system/update-panel.tsx:76`; `features/evidence/export-wizard.tsx:245,269` |
| Read-only RBAC matrix | `features/security-audit/rbac-panel.tsx:8,24,38-52` (roles from `ROLE_ORDER`, operators from `s.operators`, last sign-in from audit rows) |
| Refusal handled after the fact | `SimPermissionError` branches in `features/evidence/detail-page.tsx:162`, `features/evidence/list-page.tsx:142`, `features/system/use-sim-command.ts:30-35` |
| Navigation | `components/shell/nav-items.ts:50-58,71-75` carry no permission field |

The role table the web relies on (`packages/shared/src/sim/auth.ts:53-67`): INVESTIGATOR holds the base set, SUPERVISOR adds EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT, TECHNICIAN holds EVIDENCE_VIEW, DEVICE_MANAGE, DIAGNOSTICS_RUN, MAINTENANCE. The web imports this table by value in 3 modules (W-07).

### 4.5 Pairing display code

| Where | Code |
|---|---|
| Login trust line | `apps/core-web/src/features/login/auth-card.tsx:290-295`: `{paired ? t('login.trustLine', { deviceId }) : t('login.trustLineUnpaired', { deviceId })}`; `paired` comes from `use-login-controller.ts:92,294` (`useSim((s) => s.pairing.state)`, `pairing === 'PAIRED'`) |
| Wording | `packages/shared/src/i18n/en/login.ts:40-43`: `trustLine: 'Console: {{deviceId}} • paired (simulated)'`, `trustLineUnpaired: 'Console: {{deviceId}} • not paired (simulated)'`, `trustTooltip: 'Certificate-bound console pairing (design book §20.1), simulated in this demo.'` |
| Devices drawer (TABLET) | `apps/core-web/src/features/devices/device-drawer.tsx:278-288`: `useSim((s) => s.tabletLink)`, `useSim((s) => s.pairing.state)`, rows `common.tabletLinkState.*` and `common.pairingState.*` (`packages/shared/src/i18n/en/common.ts:169-173`: Not paired, Paired, Pairing failed) |
| Tablet link views | `features/network-time/network-panel.tsx:167`; `features/network-time/use-network-time-alerts.ts:32,55` (alert on CONNECTED to OFFLINE edge); `features/devices/lcd-display.tsx:66,168`; `features/devices/other-devices.tsx:35,128` (`tablet-offline-alert`); `features/devices/sim-adapter.ts` (`rearPorts(state)` reads `tabletLink`) |
| Audit tone | `features/security-audit/tones.ts:38`: `PAIRING: 'info'` |
| Not present | any `pair`, `unpair`, device list, revoke, code issue or QR code in `apps/core-web/src`; no QR library in `apps/core-web/package.json` (F-A15) |

## 5. Synchronous dependencies

Legend. Class A: the action's return value is consumed. Class B: failure is a synchronous `throw` caught around the call. Class C: a void action followed at once by a store read of its effect. Class D: ordering between consecutive actions. Class E: store read outside React (guards). Class F: fire and forget with no result and no `try/catch`.

### 5.1 Class A: the return value is used (14 production sites, 11 actions)

| # | Action (return type, `types.ts` line) | Call site (`file:line`) | How the return value is used | Wrapped by |
|---|---|---|---|---|
| A1 | `signIn` (`SignInResult`, 988) | `apps/core-web/src/features/login/use-login-controller.ts:196` | `settle(result)` at 204: branches on `ok`, `operatorId`, `reason`, `attemptsRemaining` (149-170) | `try/catch/finally` 194-203 |
| A2 | `signInWithSecurityKey` (`SignInResult`, 994) | `use-login-controller.ts:215` | `settle(result)` at 220 | `try/catch` 213-219 |
| A3 | `createSession` (`CreateSessionResult`, 1005) | `apps/core-web/src/features/session-new/index.tsx:203` and `:207` (second call after `cancel()` at 206) | `result.ok`, `result.reason === 'SESSION_ACTIVE'`, message key `sessionNew.errors.create.${result.reason}` (204-212) | `try/catch` 200-216 |
| A4 | `scanCaseNumber` (`string`, 1024) | `apps/core-web/src/features/session-new/sim-adapter.ts:21` (`return sim.actions.scanCaseNumber()`), consumed at `apps/core-web/src/features/session-new/index.tsx:226` (`form.setValue('caseNumber', scanCaseNumber(sim), ...)`) | the string is written into the form immediately; the adapter's `catch` falls back to `selectNextCaseNumber(sim.store.getState())` (22-24) | `try/catch` in adapter |
| A5 | `exportEvidence` (`ExportResult`, 1035) | `apps/core-web/src/features/evidence/export-wizard.tsx:145` | stored as `ExportOutcome.result`, read at 115, 155, 161, 174, 323, 330, 336, 340, 344 (`ok`, `exportId`, `reason`); line 133 calls it for the audit side effect only and discards the result | `try/catch` 144-153 and 132-137 |
| A6 | `verify` (`EvidenceVerifyResult`, 1034) | `apps/core-web/src/features/evidence/use-verification.ts:232` | `simulatedChecks(result)` at 233 (tracks, `manifestOk`, `signatureOk`), verdict `result.ok` at 243; `apps/core-web/src/features/evidence/sim-adapter.ts:96` returns it from `recordPackageVerification`, whose only caller (`use-verification.ts:226`) discards it | outer `try/catch/finally` 203-263; the package-mode `recordPackageVerification` has its own `try/catch` 225-229 |
| A7 | `exportAudit` (`ExportResult`, 1042) | `apps/core-web/src/features/security-audit/sim-adapter.ts:66` | `result.ok`, `result.reason`, `result.status`, `result.exportId` (70-80); then an audit row read from the store at 77 for entries, head, chainOk; sole caller `apps/core-web/src/features/security-audit/export-audit-dialog.tsx:76` uses the synchronous `outcome` | `try/catch` 64-69 |
| A8 | `exportLogs` (`ExportResult`, 1048) | `apps/core-web/src/features/system/diagnostics.tsx:103` (through `runCommand`) | `result.ok`, `result.status`, `result.exportId` (104-113); then `sim.store.getState()` at 114 supplies the audit rows, events, services, diagnostics that are downloaded (115-127) | `useSimCommand` wrapper |
| A9 | `verifyAuditChain` (`ChainVerifyResult`, 1050) | `apps/core-web/src/features/security-audit/chain-panel.tsx:94` and `apps/core-web/src/features/session-monitor/integrity-panel.tsx:67` | chain-panel spreads it into state with `at: sim.store.getState().clock.now` (95) and renders `verified.checked`/`ok` (281-297); integrity-panel keeps it in `verify.result` (69) and renders `result.ok`, `result.checked`, `result.index` (157-171) | `try/catch` 93-97 and 66-70 |
| A10 | `runDiagnostics` (`string`, 1065) | `apps/core-web/src/features/system/use-sim-command.ts:56` | `id !== undefined` becomes the boolean returned by `useStartDiagnostics` (57); `apps/core-web/src/features/system/index.tsx:43` uses it: `if (startDiagnostics()) setDiagnosticsOpen(true)`; `diagnostics.tsx:251` creates the hook for the modal and `diagnostics.tsx:301` calls `start()` from its "run again" button, ignoring the result | `useSimCommand` wrapper |
| A11 | `restartServices` (`number`, 1081) | `apps/core-web/src/features/system/sim-adapter.ts:67` (`return sim.actions.restartServices()`), consumed at `apps/core-web/src/features/system/diagnostics.tsx:95-99` | `count !== undefined` gates the success toast, which prints `count` | `useSimCommand` wrapper |

Value-returning actions with **no** production web call site: `signInWithBiometric` (990), `recordBiometricFailure` (992), `pair` (1090).

The generic wrapper itself is a synchronous contract: `useSimCommand` calls `command()` inside `try`, returns `T | undefined`, and maps `SimPermissionError` and `SimTransitionError` to toasts (`apps/core-web/src/features/system/use-sim-command.ts:26-45`). Its callers: `features/system/demo-panel.tsx:135` (five commands at 162, 185, 200, 215, 228, each returns `true`; `if (!done) return` then toasts), `features/system/settings-panel.tsx:97,202` (`setActiveCamera`, result ignored), `features/system/update-panel.tsx:43,66` (`startSoftwareUpdate`, `ok` gates a toast), `features/system/diagnostics.tsx:86,95,103`, and `useStartDiagnostics` (`use-sim-command.ts:53`).

### 5.2 Class B: synchronous throw caught around void actions

| Action | Site | `try` .. `catch` | Error handling |
|---|---|---|---|
| `archiveEvidence` | `features/evidence/detail-page.tsx:159`; `features/evidence/list-page.tsx:139` | 158-168; 138-148 | `SimPermissionError` → denied toast; `SimTransitionError` → not-sealed warning; else logged |
| `addMarker`, `addNote`, `snapshot`, `stopRecording` | `features/session-monitor/action-bar.tsx:218,289,376,554` | 217-223; 288-293; 375-381; 553-562 | generic failure toast; `stopRecording` logs `caught.event` when `SimTransitionError` (558) |
| `recover` | `features/session-monitor/index.tsx:86` | 85-90 | toast `session.recovery.failed` |
| `setActiveCamera` | `features/session-monitor/live-feed-panel.tsx:67` | 66-70 | logged only |
| `acknowledgeAlert` | `features/security-audit/chain-panel.tsx:109` | 108-114 | generic toast |
| `beginPrecheck` | `features/session-new/index.tsx:189` (resume), `:214` (after create) | 188-195; inside 200-216 | toast `sessionNew.errors.precheck` |
| `acknowledgePrecheckWarnings`, `retryPrecheck`, `startRecording`, `cancel` | `features/session-new/index.tsx:234,246,259,297` (and `cancel` at 206) | 233-240; 245-252; 257-266; 296-303 | per-action toasts |
| `setStoragePolicy` | `features/storage/manage-drawer.tsx:53` | 52-59 | `storage.manage.failed` toast |
| `deviceCommand` | `features/devices/index.tsx:80,85,89`; `features/dashboard/devices-panel.tsx:64` | 74-93; 63-75 | friendly toast plus structured log |
| `resetClip` | `features/devices/audio-input-card.tsx:50` | 49-52 | toast |
| all `useSimCommand` commands | `features/system/use-sim-command.ts:28` | 27-44 | role/transition/generic toasts |

`SimPermissionError` and `SimTransitionError` are tested with `instanceof` at `features/evidence/detail-page.tsx:162-163`, `features/evidence/list-page.tsx:142-143`, `features/system/use-sim-command.ts:30,36`; `.permission` at `use-sim-command.ts:31,35` and `.from`, `.event` at `38`; `caught.event` at `features/session-monitor/action-bar.tsx:558`.

### 5.3 Class C: void action followed by an immediate store read of its effect

| Site | Action then read |
|---|---|
| `features/session-monitor/action-bar.tsx:218` then `224-225` | `addMarker(...)` then `sim.store.getState().clock.now` and `.session?.markerCount` to label the flying chip and toast |
| `features/session-monitor/action-bar.tsx:376` then `383-385` | `snapshot()` then `sim.store.getState()` for the active camera name and `clock.now` |
| `features/session-new/index.tsx:203-214` | `createSession` then `sim.store.getState().session?.state === SessionState.CREATE` decides whether to call `beginPrecheck()`; line 202 reads `session` before the call (to decide on discarding a setup session) |
| `features/session-new/index.tsx:259` | `startRecording()` after `sim.store.getState().session?.id` was read at 256 for the toast |
| `features/evidence/export-wizard.tsx:145-148` | `exportEvidence` then `sim.store.getState()` and `latestAuditRowFor(state, row.id, 'EVIDENCE_EXPORTED')` for `auditRowId`, `auditHash`, `exportedAt` |
| `features/security-audit/chain-panel.tsx:94-95` | `verifyAuditChain()` then `sim.store.getState().clock.now` |
| `features/system/demo-panel.tsx:162-170` then `151` | every Demo Control Panel command is followed by `auditNote()`, which reads `sim.store.getState().audit.rows.at(-1)` for the toast text |

### 5.4 Class D: ordering between consecutive actions

| Site | Order |
|---|---|
| `features/evidence/sim-adapter.ts:94,96` | `inject(TAMPER, { evidenceId, trackId })` must take effect before `verify(evidenceId)` |
| `features/session-new/index.tsx:206-207` | `cancel()` then `createSession(values)` |
| `features/session-new/index.tsx:203-214` | `createSession` then `beginPrecheck` |
| `features/system/demo-panel.tsx:165-168,187,203-204,217-219` | `clearFault` then `resetClip`; loops of `clearFault` then two `resetClip`; `resetDemo` or `loadScenario` |
| `features/devices/index.tsx:80-81` | `deviceCommand(IDENTIFY)` then local state `setIdentify` |
| `features/evidence/export-wizard.tsx:131-137` | one `exportEvidence` per selected row in a loop (denied path), each audited |

### 5.5 Class E: store reads outside React (see 4.3)

`routes/_app.tsx:11`, `routes/login.tsx:11`, `routes/_app/session/new.tsx:16` read `context.sim.store.getState()` in `beforeLoad`. `features/login/sim-adapter.ts:28` and `features/session-new/sim-adapter.ts:23` read `store.getState()` in plain functions.

### 5.6 Class F: fire and forget with no `try/catch` and no result

`components/shell/app-shell.tsx:103` (`touch`, per interaction); `components/shell/user-menu.tsx:21-22` (`signOut`); `components/composed/dbfs-meter.tsx:360` (`resetClip` on press); `features/system/sim-adapter.ts:80,98,103` (`setPresentationMode`, `updateSettings`; called during render effects and handlers).

### 5.7 Tests that rely on synchronous returns or effects

Return value consumed: `features/security-audit/__tests__/security-audit.test.tsx:140,155,301` (`verifyAuditChain()` result compared with the web's `verifyChain`) and `features/system/__tests__/system-page.test.tsx:273` (`verifyAuditChain().ok`). Synchronous effect relied on: `security-audit.test.tsx:415` (five `signIn` calls with a wrong password in a loop trigger the lockout; the return value is ignored). Every `act(() => sim.actions.X())` in section 12 depends on the effect being in the store when the call returns.

## 6. Direct store access in production code

| File:line | Access | Purpose |
|---|---|---|
| `routes/_app.tsx:11`; `routes/login.tsx:11`; `routes/_app/session/new.tsx:16` | `context.sim.store.getState()` | route guards (4.3) |
| `features/login/sim-adapter.ts:28` | `store.getState()` via `selectLastSignOut` | arrival notice, read once |
| `features/login/use-login-controller.ts:97` | `sim.store.getState().auth.status` | arrival notice input |
| `features/session-new/index.tsx:130,202,214,217,256,294` | `sim.store.getState()` | initial form values, before/after create, ids for logs and toasts, cancel decision |
| `features/session-new/sim-adapter.ts:23` | `store.getState()` | next case number fallback |
| `features/session-monitor/action-bar.tsx:224,225,383` | `sim.store.getState()` | read-your-write (5.3) |
| `features/session-monitor/sim-adapter.ts:36,52` | `store.getState()` and `store.subscribe(selector, listener)` | write-rate series sampled every 5 simulator seconds |
| `features/evidence/sim-adapter.ts:89`; `features/evidence/export-wizard.tsx:146,171` | `sim.store.getState()` | tamper mirror input; export audit row and device slice for the manifest |
| `features/security-audit/sim-adapter.ts:77`; `features/security-audit/chain-panel.tsx:95` | `sim.store.getState()` | audit row for the export receipt; clock for the verify stamp |
| `features/system/demo-panel.tsx:151`; `features/system/diagnostics.tsx:114` | `sim.store.getState()` | newest audit row for the toast; log-export payload (`audit`, `events`, `services`, `diagnostics`) |
| `features/devices/health-chart.tsx:44` | `sim.store.getState()` | `healthSeries` snapshot |
| `components/composed/dbfs-meter.tsx:148` | `sim.store.getState().audio.channels[channel]` | seed frame at mount |
| `components/media/use-sim-clock.ts:24,29,44` | `sim.store.subscribe` and `getState` | 1 Hz clock second and a clock reader for canvas painters |
| `packages/shared/src/sim/react.ts:105-110` (shared hook used by 3 web files) | `sim.store.subscribe(state => state.audio.channels[channel], cb, { fireImmediately: true })` | 20 Hz audio frames |

`store.setState` appears in no production web file. It appears in 7 test files, 8 call sites (section 12).

## 7. Storage keys

| Key | Storage | Owner | Definition (`file:line`) | Content |
|---|---|---|---|---|
| `dems.sim.v1` | `sessionStorage` (when present, else memory) | shared simulator | `packages/shared/src/sim/constants.ts:12`; adapter `platform.ts:87-93`; `main.tsx:37` passes no `storage` option | persisted snapshot of 30 slices (not audio, clock, auth) |
| `dems.auth` | `sessionStorage` (when present, else memory) | shared simulator | `packages/shared/src/sim/constants.ts:16`; `platform.ts:96-135,157-161` | `{ operatorId, issuedAt }`; "never a password" (`constants.ts:15`) |
| `dems.system.prefs.v1` | `localStorage` | web | `apps/core-web/src/features/system/sim-adapter.ts:110` (read 122, write 138) | `{ timeFormat, notifyWarnings, notifySound }`, mirror of the simulator `settings` slice |
| `dems.system.demoControls.v1` | `sessionStorage` | web | `features/system/sim-adapter.ts:146` (read 150, write 158) | `'1'` or `'0'` (Demo Control Panel open) |
| `dems.motion.reduced` | `localStorage` | web | `apps/core-web/src/motion/policy.ts:23` (read 90, write 104-105) | `'1'` or absent |
| `dems.shell.rail` | `localStorage` | web | `apps/core-web/src/components/shell/use-shell-layout.ts:21` (read 56, write 64) | `'1'` or `'0'` (rail collapsed) |
| `dems.presentation.v1` | `sessionStorage` | web | `apps/core-web/src/lib/presentation-mode.ts:25` (read 61, write 74) | `'1'` or `'0'` |
| `dems.shell.intro` | `sessionStorage` | web | `apps/core-web/src/components/shell/shell-entrance.ts:20` (read 46, write 58) | `'1'` once the intro played |

No production web file reads or writes `dems.sim.v1` or `dems.auth` itself. One test imports `AUTH_STORAGE_KEY` (`features/login/__tests__/login-page.test.tsx`).

The six web-owned keys, quoted from code:

```ts
// apps/core-web/src/features/system/sim-adapter.ts:110,146
export const PREFS_STORAGE_KEY = 'dems.system.prefs.v1'
export const DEMO_CONTROLS_STORAGE_KEY = 'dems.system.demoControls.v1'
// apps/core-web/src/motion/policy.ts:23
export const REDUCED_MOTION_STORAGE_KEY = 'dems.motion.reduced'
// apps/core-web/src/components/shell/use-shell-layout.ts:21
export const SHELL_RAIL_STORAGE_KEY = 'dems.shell.rail'
// apps/core-web/src/lib/presentation-mode.ts:25
export const PRESENTATION_MODE_STORAGE_KEY = 'dems.presentation.v1'
// apps/core-web/src/components/shell/shell-entrance.ts:20
export const SHELL_INTRO_STORAGE_KEY = 'dems.shell.intro'
```

## 8. `sim-adapter.ts` inventory (11 web files)

| Adapter | Lines | Reads | Writes (actions) | Re-exports from `@dems/shared/sim` | Sync-return or store use |
|---|---|---|---|---|---|
| `features/api-reference/sim-adapter.ts` | 49 | `Pick<Sim,'request'\|'store'>`; `SIM_API_HEADERS` | none; `sim.request` (44) | none | `answerSimulated` is synchronous and never throws (try/catch 43-48 returns a 500 `SIMULATOR_ERROR`) |
| `features/dashboard/sim-adapter.ts` | 53 | `selectSystemState`; `useSealedManifestDigest`, `selectRingPrimitives` over `s.session`, `s.evidence` | none | `selectSystemStateValue` (15) | none |
| `features/devices/sim-adapter.ts` | 292 | pure helpers over `SimState` (`bookPoe`, `rearPorts`, `healthSeries`, `auditRowDevice`, `deviceLog`, `MicLevelSampler`) | none | `DEVICE_HEALTH_METRIC`, `DEVICE_HEALTH_POINTS`, `frontPanelLeds`, `IDENTIFY_BLINKS`, `IDENTIFY_PERIOD_MS`, `LED_IDS`, `LED_RANK` (32-41) | none |
| `features/evidence/sim-adapter.ts` | 119 | `latestAuditRowFor`; `simTamperedTrack` | `inject(TAMPER)` (94), `verify` (96) | none | A6 and D (5.1, 5.4); `store.getState()` at 89 |
| `features/login/sim-adapter.ts` | 33 | `selectPresentationMode`, `selectLastSignOut` | none (comment names `setPresentationMode`) | none | `readLastAuthEvent` reads `store.getState()` (28) |
| `features/network-time/sim-adapter.ts` | 28 | none (re-exports only) | none | `domainState`, `EXPORT_TRANSFER_WINDOW_MS`, `lastExportAt`, `networkTimeSource as eventSource`, `selectAvSync`, `selectDomainStates`, `selectNetworkTimeEvents`, types (16-28) | none |
| `features/security-audit/sim-adapter.ts` | 253 | `keyEntries`, `packageIntegrity`, `guardedPackageOf` (demo-data join); `EXPORT_REASON_MIN_LENGTH` | `exportAudit({ reason })` (66) | none | A7 and store read (62-92) |
| `features/session-monitor/sim-adapter.ts` | 98 | `selectWriteRateHistory`, `recordingBytes`; `useWriteRateSeries` | none | none | `store.getState` (36) and `store.subscribe` (52) |
| `features/session-new/sim-adapter.ts` | 25 | `selectNextCaseNumber` | `scanCaseNumber` (21) | none | A4 (5.1) |
| `features/storage/sim-adapter.ts` | 47 | `driveHealth`, `driveTemperature`; `selectVolumeTemperature(Series)` over `s.health` | none | `DRIVE_TEMP_LIMITS`, `isStorageActivityEvent`, `selectStorageActivity`, `STORAGE_ACTIVITY_EVENT_TYPES` (23-28) | none |
| `features/system/sim-adapter.ts` | 162 | `selectPresentationMode`, `selectSettings`; `uptimeAnchors` over `s.audit` | `updateSettings` (98, 103), `restartServices` (67), `setPresentationMode` (80) | `releaseInfo`, `selectServicesSince`, `SERVICES_RESTART_SCOPE`, `ReleaseInfo` (28) | A11; also owns the `localStorage` and `sessionStorage` keys in section 7 |

The adapters are not a complete boundary: 28 production files call actions or `store` directly (section 6 and 5), and 88 call `useSim` with selectors imported straight from `@dems/shared/sim`.

## 9. `core-endpoint.ts`, `packaged-csp.ts`, API Reference

### 9.1 `apps/core-web/src/lib/core-endpoint.ts`

| Function | Behaviour (lines) | Consumers |
|---|---|---|
| `isSameOriginCore()` (37-39) | `import.meta.env.VITE_DEMS_CORE_ORIGIN === SAME_ORIGIN_CORE` where `SAME_ORIGIN_CORE = 'same-origin'` (`packaged-csp.ts:36`) | `coreHttpOrigin`, `coreWsUrl`, `allowedPageOrigins` |
| `coreHttpOrigin(location?)` (42-44) | same-origin → `page(location).origin`, else `CORE_HTTP_ORIGIN` (`http://127.0.0.1:4400`, `packages/shared/src/api/constants.ts:10`) | `features/api-reference/{index.tsx:23,sim-fetch.ts:21,server-strip.tsx:7,service-banner.tsx:8,api-document.ts:26}`, `features/login/login-model.ts:22,64` (`coreAddress`) |
| `coreWsUrl(location?)` (47-51) | not same-origin → `CORE_WS_URL` (`ws://127.0.0.1:4400/ws`); else `ws(s)://<host>${WS_PATH}` | `routes/__root.tsx:25,72` (app-wide `HeartbeatProvider`), `features/api-reference/{realtime-panel.tsx:11,use-realtime-feed.ts:27,142,api-document.ts:26}` |
| `allowedPageOrigins(location?)` (54-56) | same-origin → `[page origin]`, else `WEB_DEV_ORIGINS` (`['http://127.0.0.1:5173','http://localhost:5173']`, `packages/shared/src/api/constants.ts:27`) | `features/api-reference/{realtime-panel.tsx:43,use-realtime-feed.ts:137}` |
| `fetchCoreHealth(fetchImpl?)` (63-75) | calls shared `fetchHealth` (re-pointed in packaged mode through its `fetchImpl` seam) | `features/home/use-health.ts:3`, `features/api-reference/service-banner.tsx:8,31` |

The file states "Any value other than `same-origin` keeps the dev defaults" (header, lines 11-12). `apps/core-web/src/env.d.ts` declares only `VITE_DEMS_CORE_ORIGIN?: string`. `vite.config.ts:18` pins `server: { host: '127.0.0.1', port: 5173, strictPort: true }` and has no `proxy`. A test file pins the resolvers: `apps/core-web/src/lib/__tests__/core-endpoint.test.tsx` (counted in G15).

### 9.2 `apps/core-web/src/lib/packaged-csp.ts`

Quoted from code (`packaged-csp.ts:35-36,52-66`): the env key and value are `CORE_ORIGIN_ENV_KEY = 'VITE_DEMS_CORE_ORIGIN'` and `SAME_ORIGIN_CORE = 'same-origin'`; the directive list is `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `media-src 'self' blob:`, `font-src 'self' data:`, `worker-src 'self' blob:`, `connect-src 'self' ws://127.0.0.1:${wsPort} ws://localhost:${wsPort}` (line 60), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, plus `frame-ancestors 'none'` for header delivery only. The meta tag is injected only by `vite build` with `VITE_DEMS_CORE_ORIGIN=same-origin` (`isPackagedBuild`, 77-79; plugin 94-105; registered at `vite.config.ts:14`). The header form is duplicated in the launcher (`apps/mock-core/standalone/dems-web-launcher.cjs:91,97,108`) and the file header says a widening "must change this module and the launcher header together" (`packaged-csp.ts:7-8`). `apps/core-web/src/lib/__tests__/packaged-csp.test.ts` pins the exact spec text (`SPEC_HEADER_4410`, line 17-21; 5 `it` cases in `packagedCsp` and 4 in the plugin block). `connect-src` contains no `http://` loopback source other than `'self'`.

### 9.3 API Reference simulated-fetch path

| Step | Code | Source |
|---|---|---|
| Page gets a `Sim` | `const sim = useSimInstance()` | `apps/core-web/src/features/api-reference/index.tsx:34` |
| One fetch per `Sim` | `const customFetch = useMemo(() => createSimAwareFetch({ sim, onExchange }), [sim, onExchange])` | `index.tsx:42` |
| Handed to Scalar | `RendererPanel customFetch={customFetch}` → `createScalarConfiguration({ content: document, customFetch, customCss })` | `index.tsx:60-64`; `renderer-panel.tsx:52` ; `scalar-config.ts:60-65` |
| Routing table | `GET {core}/api/v1/health` goes to the network (`networkFetch`, 106-110); any other `{core}/api/v1/*` is `answerSimulated(sim, { method, path, body })` and turned into a `Response` with the `x-dems-simulated` header (113-122); anything else throws `BlockedRequestError` (99-103) | `apps/core-web/src/features/api-reference/sim-fetch.ts:88-123` |
| Simulated answer | `sim.request({ method, path, body? })` in `try`, catch → 500 `SIMULATOR_ERROR` | `apps/core-web/src/features/api-reference/sim-adapter.ts:41-49` |
| Document | `buildApiDocument(includeSimulated)` = `applyDemoExamples(pointAtCoreOrigin(createOpenApiDocument({ includeSimulated })))`; `includeSimulated` starts `true` (`index.tsx:35`); the switch is in `server-strip.tsx`; operation count comes from the document | `features/api-reference/api-document.ts:116-134,142-148`; `index.tsx:38,56` |
| Examples | DEMO dataset payloads for `createSession` and `exportEvidence` from `DEMO_EVIDENCE_INDEX.apiExamples` | `api-document.ts:25,40-64` |
| Live pieces | `ServiceBanner` (heartbeat plus a 10 s health query), `RealtimePanel` (panel-scoped second heartbeat client, origin check) | `service-banner.tsx:29-31`; `use-realtime-feed.ts:101-142` |
| Tests | `src/test/sim-fetch.test.ts` (creates a sim, 28), `src/lib/__tests__/core-endpoint.test.tsx` ("simAwareFetch routing", sim at 202, 264), `src/test/scalar-config.test.ts` (no sim) | section 12 |

## 10. Other Core and data touchpoints that are not the simulator

| Touchpoint | What it is | Source |
|---|---|---|
| Heartbeat WebSocket (app-wide) | `HeartbeatProvider url={coreWsUrl()} onResync={resync}`; `resync` invalidates `HEALTH_QUERY_KEY`; readers: login (`use-login-controller.ts:86-89`), `features/api-reference/service-banner.tsx:29`, `features/home/home-page.tsx:116,187` | `apps/core-web/src/routes/__root.tsx:57-60,72` |
| Panel heartbeat client | second `createHeartbeatClient` in the Realtime panel | `apps/core-web/src/features/api-reference/use-realtime-feed.ts:141` |
| Health fetch | `fetchCoreHealth()`; the only direct `fetch` of a Core in the web | `lib/core-endpoint.ts:63-75`; `features/home/use-health.ts:12` |
| Demo media and packages (evidence) | `import.meta.glob(... '?url', eager)` of `packages/shared/assets/demo-media/**` and `demo-evidence/**`; `createFetchLoader` fetches those bundled URLs; certificate PEM from `DEMO_DEVICE_CERTIFICATE_PEM` | `features/evidence/demo-assets.ts:30-37,77` |
| Demo media (live camera views) | the same kind of glob for `demo-media/live` and `demo-media/evidence` | `components/media/demo-media.ts:28-29` |
| Demo data joins | `matchDemoPackage`, `DEMO_EVIDENCE_INDEX` (keys, certificate, export records) read by Security and Audit and API Reference | `features/security-audit/sim-adapter.ts:26,131,193-253`; `features/api-reference/api-document.ts:25` |
| `/stack-check` and `features/home` | diagnostic page using heartbeat and health; no simulator import | `routes/_app/stack-check.tsx`, `features/stack-check/index.tsx`, `features/home/*` (not in the 167-file groups: they do not match `@dems/shared/sim`) |

## 11. The 167 files, in 18 groups

Every file under `apps/core-web/src` that matches `@dems/shared/sim` appears in exactly one group below (G1-G18); the check is quoted in section 13. Paths are workspace-relative. Group rule: `components/<folder>` and `features/<folder>` by folder, `routes` (the five route files that import the simulator), `lib` (only a test file there imports it; `core-endpoint.ts` and `packaged-csp.ts` do not, see section 9), `main.tsx` plus `router.tsx`, and `src/test` (cross-feature tests). `features/home`, `features/stack-check`, `components/ui` and `motion` contain no match and are not listed.

Column legend. **Named selectors / views**: names imported from `@dems/shared/sim` that start with `select` (value imports; re-exports through an adapter are listed in section 8). **Slices read inline**: `SimState` slices read by property name in the file (`s.session`, `state.audit`, ...). **Hooks**: `S` = `useSim`, `A` = `useSimActions`, `I` = `useSimInstance`, `R` = `useSimReady`, `C` = `useAudioChannel`. **Actions (line)**: `actions.<name>` or `sim.actions.<name>` calls with line numbers. **store access (line)**: `.store.getState`, `.store.subscribe`, `.store.setState` lines. The first six columns are a regex pass (a lower bound, see section 1); the **Note** column was added by hand after reading the file or its key lines.

### G1 components/composed (6 files; 3 source, 3 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/components/composed/__tests__/dbfs-meter.test.tsx` | - | - | - | inject:158 | 26,170 | test; sim from test-utils (createTestSim); drives audio via inject |
| `apps/core-web/src/components/composed/__tests__/session-timeline.test.tsx` | - | - | - | - | - | test; type import only (TimelineEvent) |
| `apps/core-web/src/components/composed/__tests__/test-utils.ts` | - | audio | - | - | 29 | test helper createTestSim: createSim with scenario, storage null, authStorage null, ALWAYS_VISIBLE, no-op scheduler (17-23); writes audio via store.setState (29) |
| `apps/core-web/src/components/composed/dbfs-meter.tsx` | - | - | CAI | resetClip:360 | 148 | 20 Hz meter: useAudioChannel; seed frame from store.getState().audio.channels (148); clip reset on press, no try/catch (360) |
| `apps/core-web/src/components/composed/session-timeline.math.ts` | - | - | - | - | - | type only (TimelineKind) |
| `apps/core-web/src/components/composed/session-timeline.tsx` | - | - | - | - | - | type re-export only (TimelineEvent, line 12) |

### G2 components/media (2 files; 2 source, 0 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/components/media/procedural-feed.ts` | - | - | - | - | - | imports seeded RNG mulberry32 only (19); reads no state |
| `apps/core-web/src/components/media/use-sim-clock.ts` | - | clock | - | - | 24,29,44 | reads SimContext (optional, wall-clock fallback outside a provider); clock.now via store.subscribe/getState (24, 29, 44) |

### G3 components/shell (8 files; 8 source, 0 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/components/shell/app-layout.tsx` | selectAuth | - | S | - | - | signed-out leave path: selectAuth().status (34); on not SIGNED_IN navigates to /login, adds ?redirect only for EXPIRED (48-52) |
| `apps/core-web/src/components/shell/app-shell.tsx` | - | - | A | touch:103 | - | operator activity: actions.touch() on every pointerdown and keydown (103); no try/catch |
| `apps/core-web/src/components/shell/integrity-checks.ts` | selectIntegrityChecklist, selectSystemSeverity | - | - | - | - | wrappers selectPillState / selectIntegrityChecks over selectSystemSeverity and selectIntegrityChecklist |
| `apps/core-web/src/components/shell/notifications-bell.tsx` | selectActiveAlerts, selectUnacknowledgedAlertCount | - | S | - | - | alerts bell: selectActiveAlerts, selectUnacknowledgedAlertCount |
| `apps/core-web/src/components/shell/secure-pill.tsx` | - | - | SR | - | - | security pill: local selectPillState and selectIntegrityChecks; useSimReady gates the UNKNOWN state |
| `apps/core-web/src/components/shell/sidebar.tsx` | - | - | - | - | - | SOFTWARE_VERSION constant only; nav items carry no permission field (nav-items.ts:50-58) |
| `apps/core-web/src/components/shell/top-bar.tsx` | selectClockSecond | device | S | - | - | clock second, s.device id and name, DEVICE_IDENTITY and SOFTWARE_VERSION constants |
| `apps/core-web/src/components/shell/user-menu.tsx` | selectOperator | - | SA | signOut:21,22 | - | selectOperator (name, role, initials); actions.signOut(LOCK or USER) (21, 22); no try/catch; profile and role items are read-only |

### G4 features/api-reference (2 files; 2 source, 0 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/api-reference/index.tsx` | - | - | I | - | - | useSimInstance (34) feeds createSimAwareFetch({ sim, onExchange }) (42) |
| `apps/core-web/src/features/api-reference/sim-adapter.ts` | - | - | - | - | - | adapter; Pick<Sim, request or store> (19); sim.request (44) inside try/catch, 500 SIMULATOR_ERROR on throw (45-48) |

### G5 features/dashboard (14 files; 12 source, 2 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/dashboard/__tests__/dashboard-model.test.tsx` | - | - | - | - | - | test; pure model; constants only |
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | selectSealedToday | evidence, events, clock | - | inject:308 | 219,232,334,347,362,364,367,374 | test; creates sim (82); store.setState (347, 367); inject (308) |
| `apps/core-web/src/features/dashboard/active-session-panel.tsx` | selectCan, selectOperatorById | session | S | - | - | session card, precheck and finalization progress, selectCan(SESSION_START) (70), requiredRoleFor (108) |
| `apps/core-web/src/features/dashboard/dashboard-model.ts` | - | - | - | - | - | static ROLE_PERMISSIONS lookup requiredRoleFor (320-324); QUICK_ACTIONS permissions (345-347) |
| `apps/core-web/src/features/dashboard/devices-panel.tsx` | selectCan | cameras, mics | SA | deviceCommand:64 | - | selectCan(DEVICE_MANAGE) (40); actions.deviceCommand TEST_SIGNAL or RESTART (64) in try/catch (63-75) |
| `apps/core-web/src/features/dashboard/hero-panel.tsx` | - | session | S | - | - | local selectRecordingCopy over s.session |
| `apps/core-web/src/features/dashboard/quick-actions-panel.tsx` | selectRole | - | S | - | - | selectRole + roleHas(role, spec.permission) gating (34) |
| `apps/core-web/src/features/dashboard/recent-events-panel.tsx` | selectRecentEvents | operators, clock | S | - | - | selectRecentEvents (as selectEvents), s.operators for actor names, minute clock |
| `apps/core-web/src/features/dashboard/sealed-today-panel.tsx` | selectSealedHourly, selectSealedToday | evidence, clock | S | - | - | selectSealedHourly, selectSealedToday, newest sealed id |
| `apps/core-web/src/features/dashboard/security-panel.tsx` | - | time, network, security, alerts, clock | S | - | - | local selectTimeDetails and selectSecurityView over s.time, s.network, s.security, s.alerts |
| `apps/core-web/src/features/dashboard/sim-adapter.ts` | selectSystemState | session, evidence | S | - | - | adapter: selectRingPrimitives, useSealedManifestDigest; re-exports selectSystemStateValue (15) |
| `apps/core-web/src/features/dashboard/status-strip.tsx` | selectDeviceStats | mics, time, network, security | S | - | - | selectDeviceStats plus local mic, storage, time, posture and link cells |
| `apps/core-web/src/features/dashboard/storage-panel.tsx` | selectEvidenceStats | - | S | - | - | selectEvidenceStats via local selectEvidenceCounts; storageSummary helper |
| `apps/core-web/src/features/dashboard/system-ring-panel.tsx` | - | - | S | - | - | selectRingPrimitives (dashboard adapter) |

### G6 features/devices (16 files; 15 source, 1 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/devices/__tests__/devices-page.test.tsx` | - | network | - | deviceCommand:203,397,398; inject:233,240,253,334,336,374,393,411; clearFault:255; setTabletLink:264,268,394 | 259,292,313,333,335,337,339,347,349,351,353,355,360,361,370,375,377,388,399,410,412 | test; creates sim (54); store.setState (361); deviceCommand, inject, clearFault, setTabletLink |
| `apps/core-web/src/features/devices/audio-input-card.tsx` | selectMicById | - | CSA | resetClip:50 | - | selectMicById; useAudioChannel (20 Hz); actions.resetClip in try/catch (49-52) |
| `apps/core-web/src/features/devices/camera-tile.tsx` | selectCameraById | - | S | - | - | selectCameraById |
| `apps/core-web/src/features/devices/context.ts` | - | - | C | - | - | useAudioChannel for AUDIO-01 and AUDIO-02 (45, 46) feeds MicLevelSampler |
| `apps/core-web/src/features/devices/device-drawer.tsx` | selectCameraById, selectMicById | pairing, tabletLink, time, network, security, health, ports, audit | S | - | - | per-device drawer; reads s.pairing.state (279) and s.tabletLink (278), shown through common.pairingState (288); also time, network, security, health, ports, audit |
| `apps/core-web/src/features/devices/device-menu.tsx` | selectCan | - | S | - | - | selectCan(DEVICE_MANAGE) (33) |
| `apps/core-web/src/features/devices/devices-banner.tsx` | - | - | S | - | - | local selectBanner |
| `apps/core-web/src/features/devices/front-panel.tsx` | - | - | S | - | - | frontPanelLeds selector, selectIsRecordingNow |
| `apps/core-web/src/features/devices/health-chart.tsx` | - | - | I | - | 44 | store.getState() for healthSeries (44); useSimSecond clock |
| `apps/core-web/src/features/devices/index.tsx` | - | - | A | deviceCommand:80,85,89 | - | actions.deviceCommand IDENTIFY, TEST_SIGNAL, RESTART (80, 85, 89) in try/catch (74-93) |
| `apps/core-web/src/features/devices/lcd-display.tsx` | selectSystemState | device, tabletLink, session, cameras, mics, time, network, security | S | - | - | LCD model: s.tabletLink.state (66) plus device, session, cameras, mics, time, network, security |
| `apps/core-web/src/features/devices/model.ts` | - | tabletLink, session, cameras, mics, time, security | - | - | - | pure SimState selectors selectStatusMap, selectSummary, selectBanner, selectIsRecordingNow (tabletLink, session, cameras, mics, time, security) |
| `apps/core-web/src/features/devices/other-devices.tsx` | - | time | S | - | - | deviceStatus(state, TABLET) (35); tablet OFFLINE alert (128) |
| `apps/core-web/src/features/devices/port-map.tsx` | - | network | S | - | - | selectPortCodes, bookPoe, s.network.linkSpeedMbps |
| `apps/core-web/src/features/devices/sim-adapter.ts` | - | tabletLink, session, network, ports, faults | - | - | - | adapter: pure helpers over SimState (rearPorts, healthSeries, bookPoe, MicLevelSampler); no actions |
| `apps/core-web/src/features/devices/summary-cards.tsx` | - | - | S | - | - | local selectSummary |

### G7 features/evidence (17 files; 14 source, 3 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/evidence/__tests__/evidence-export.test.tsx` | - | device, operators, evidence, audit, clock | - | - | 65,112,136,189 | test; sim from harness; asserts through store.getState() |
| `apps/core-web/src/features/evidence/__tests__/evidence-integrity.test.tsx` | - | evidence, audit | - | inject:111 | 55,78,99,148,154 | test; sim from harness; inject TAMPER (111); store.setState (154) |
| `apps/core-web/src/features/evidence/__tests__/harness.ts` | - | - | - | - | 136 | test helper: createSim with manual clock DATASET_NOW (83-89); mountEvidence, stopSims |
| `apps/core-web/src/features/evidence/chips.tsx` | - | - | - | - | - | type only (EvidenceStatus, SubjectType) |
| `apps/core-web/src/features/evidence/detail-page.tsx` | selectCan | - | SA | archiveEvidence:159 | - | selectCan(EVIDENCE_REVIEW) (73); archiveEvidence (159) with SimPermissionError and SimTransitionError branches (162, 163) |
| `apps/core-web/src/features/evidence/export-download.ts` | - | - | - | - | - | toWibIso helper; types (DeviceSlice, SimOperator, EvidenceVerifyResult) for the manifest; reads no state |
| `apps/core-web/src/features/evidence/export-wizard.tsx` | selectCan, selectOperator | device, clock | SAI | exportEvidence:133,145 | 146,171 | selectCan(EVIDENCE_EXPORT) (86), selectOperator (85); exportEvidence returns ExportResult (145); store reads (146, 171) |
| `apps/core-web/src/features/evidence/index.tsx` | selectEvidenceStats | evidence | S | - | - | selectEvidenceStats (50); s.evidence.find by route id (72) |
| `apps/core-web/src/features/evidence/integrity-tab.tsx` | - | - | S | - | - | operators via local selectOperators |
| `apps/core-web/src/features/evidence/list-page.tsx` | selectCan, selectEvidence, selectEvidenceStats | - | SAR | archiveEvidence:139 | - | selectEvidence, selectEvidenceStats, selectCan(EVIDENCE_REVIEW) (63), useSimReady (59); archiveEvidence (139) in try/catch (138-148) |
| `apps/core-web/src/features/evidence/metadata-tab.tsx` | - | - | - | - | - | toWibIso helper only |
| `apps/core-web/src/features/evidence/model.ts` | - | - | - | - | - | pure helpers (EvidenceStatus, SubjectType, formatDuration, wibDateParts) |
| `apps/core-web/src/features/evidence/selectors.ts` | - | operators | - | - | - | selectOperators = (s) => s.operators (7) |
| `apps/core-web/src/features/evidence/sim-adapter.ts` | - | evidence, audit | - | inject:94; verify:96 | 89 | adapter: recordPackageVerification calls inject then verify (94, 96); store.getState (89) |
| `apps/core-web/src/features/evidence/toolbar.tsx` | - | - | - | - | - | type only |
| `apps/core-web/src/features/evidence/use-evidence-table.ts` | - | - | - | - | - | type only (EvidenceStatus) |
| `apps/core-web/src/features/evidence/use-verification.ts` | - | - | I | verify:232 | - | useSimInstance (122); sim.actions.verify returns EvidenceVerifyResult (232); recordPackageVerification (226) |

### G8 features/login (8 files; 6 source, 2 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/login/__tests__/login-model.test.tsx` | - | - | - | - | - | test; pure model |
| `apps/core-web/src/features/login/__tests__/login-page.test.tsx` | - | events, alerts, audit, auth | - | signOut:356,366 | 250,286,302,321,410,432,465 | test; creates sim (105, 109); tick/flush/clock.advance; signOut (356, 366) |
| `apps/core-web/src/features/login/auth-card.tsx` | - | device | S | - | - | trust line paired vs unpaired (294); demo operators disclosure shows DEMO_OPERATOR_PASSWORD (20, 427); s.device.id (43) |
| `apps/core-web/src/features/login/device-strip.tsx` | selectClockSecond, selectSystemState | device, time | S | - | - | unauthenticated reads: s.device.id and name, s.time.source, selectSystemState, selectClockSecond |
| `apps/core-web/src/features/login/index.tsx` | - | - | - | - | - | SOFTWARE_VERSION constant; hand-off navigate({ href: target, replace: true }) after sign-in (107) |
| `apps/core-web/src/features/login/login-model.ts` | - | - | - | - | - | AuthStatus, SignOutReason; arrivalNoticeFor (180); coreAddress via coreHttpOrigin (22, 64) |
| `apps/core-web/src/features/login/sim-adapter.ts` | selectLastSignOut, selectPresentationMode | - | S | setPresentationMode:7 | 28 | adapter: usePresentationMode (selectPresentationMode); readLastAuthEvent (selectLastSignOut over store.getState, 28) |
| `apps/core-web/src/features/login/use-login-controller.ts` | selectLockout | operators, pairing | SI | signIn:8,196; signInWithSecurityKey:215 | 97 | actions.signIn (196) and signInWithSecurityKey (215) return SignInResult; reads s.operators (91), s.pairing.state (92), selectLockout (90), auth.status (97) |

### G9 features/network-time (13 files; 11 source, 2 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/network-time/__tests__/network-time-model.test.tsx` | - | tabletLink, time, events, update, clock | - | - | 20 | test; creates sim (14) |
| `apps/core-web/src/features/network-time/__tests__/network-time-page.test.tsx` | - | time, network, events, clock | - | inject:176,189,214,220; clearFault:196; setTabletLink:208 | 124,234,236,243 | test; creates sim (64); store.setState (243); inject, clearFault, setTabletLink |
| `apps/core-web/src/features/network-time/charts.tsx` | - | - | - | - | - | type only (BandwidthPoint, TimeHistoryPoint) |
| `apps/core-web/src/features/network-time/domains-panel.tsx` | - | network, ports | S | - | - | s.network and s.ports for the segmentation diagram |
| `apps/core-web/src/features/network-time/events-panel.tsx` | - | clock | S | - | - | selectNetworkTimeEvents via adapter; clock |
| `apps/core-web/src/features/network-time/hierarchy-panel.tsx` | selectClockSecond | time, faults | S | - | - | s.time and s.faults; clock second |
| `apps/core-web/src/features/network-time/model.ts` | - | - | - | - | - | type only (SimState and history points) |
| `apps/core-web/src/features/network-time/network-panel.tsx` | - | tabletLink, network, ports | S | - | - | tablet link: s.tabletLink.state (167); network and ports |
| `apps/core-web/src/features/network-time/offset-panel.tsx` | - | time | S | - | - | s.time.history, offsetMs, source |
| `apps/core-web/src/features/network-time/sim-adapter.ts` | - | - | - | - | - | adapter: re-exports only (domainState, selectAvSync, selectDomainStates, selectNetworkTimeEvents, networkTimeSource, lastExportAt, EXPORT_TRANSFER_WINDOW_MS, types); import regex finds no import in this file |
| `apps/core-web/src/features/network-time/status-banner.tsx` | - | time, network | S | - | - | banner view over s.time and s.network |
| `apps/core-web/src/features/network-time/system-time-panel.tsx` | selectClockSecond | time | S | - | - | s.time; selectClockSecond |
| `apps/core-web/src/features/network-time/use-network-time-alerts.ts` | - | tabletLink, time | S | - | - | tablet link edge alert: s.tabletLink.state (32) |

### G10 features/security-audit (15 files; 14 source, 1 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx` | - | time, security, audit, clock | - | inject:138,177,258,259,300,362; verifyAuditChain:140,301; clearFault:327; signIn:415 | 125,139,153,160,178,191,218,221,228,233,236,245,260,336,341,346,354,379,385,390,394,419,428,437 | test; creates sim (64); store.setState (428); inject, clearFault, verifyAuditChain, signIn (415) |
| `apps/core-web/src/features/security-audit/audit-context.ts` | - | audit | - | - | - | type only (AuditLogSlice) |
| `apps/core-web/src/features/security-audit/audit-log-panel.tsx` | selectCan | operators | S | - | - | selectCan(AUDIT_EXPORT) (232); AuditCategory, Severity; operators for filter |
| `apps/core-web/src/features/security-audit/auth-panel.tsx` | selectLockout | operators | S | - | - | selectLockout; AUTH_MAX_FAILURES; operators |
| `apps/core-web/src/features/security-audit/chain-panel.tsx` | - | alerts | SAI | verifyAuditChain:94; acknowledgeAlert:109 | 95 | verifyAuditChain (94) then store clock read (95); acknowledgeAlert (109); alerts |
| `apps/core-web/src/features/security-audit/custody-panel.tsx` | - | operators, evidence | S | - | - | operators, evidence for custody rows |
| `apps/core-web/src/features/security-audit/export-audit-dialog.tsx` | - | audit | SI | - | - | useSimInstance (40); exportAuditWithReason(sim, reason) returns outcome (76) |
| `apps/core-web/src/features/security-audit/keys-panel.tsx` | - | device, security | S | - | - | s.security keys, s.device |
| `apps/core-web/src/features/security-audit/model.ts` | - | - | - | - | - | client-side chain verification verifyChain with chainHash, auditBody, GENESIS_HASH (6-16, 57-60, 72); static ROLE_PERMISSIONS roleGrants and PERMISSION_ORDER (434-455) |
| `apps/core-web/src/features/security-audit/rbac-panel.tsx` | - | operators | S | - | - | role matrix table from ROLE_PERMISSIONS (model.ts) and s.operators (24) |
| `apps/core-web/src/features/security-audit/sim-adapter.ts` | - | - | - | exportAudit:66 | 77 | adapter: exportAuditWithReason (62-92): exportAudit (66) then audit row read from store (77); key entries from demo-data |
| `apps/core-web/src/features/security-audit/tamper-panel.tsx` | - | security, evidence | S | - | - | s.security, s.evidence; demo package integrity |
| `apps/core-web/src/features/security-audit/tones.ts` | - | - | - | - | - | type only; PAIRING category tone (38) |
| `apps/core-web/src/features/security-audit/use-newest.ts` | - | - | - | - | - | type only (AuditRow) |
| `apps/core-web/src/features/security-audit/use-security-data.ts` | selectClockSecond, selectOperator | device, time, security, audit, clock | SR | - | - | whole audit slice useSim((s) => s.audit) (30); posture, time, device; selectOperator; useSimReady |

### G11 features/session-monitor (15 files; 14 source, 1 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/session-monitor/__tests__/session-monitor.test.tsx` | - | - | - | inject:373,377,396,427 | 170,218,222,224,233,244,258,259,261,298,303,313,315,317,323,337,381,426,428,430,432 | test; creates sim (53, 425, 429, 431); inject |
| `apps/core-web/src/features/session-monitor/action-bar.tsx` | - | session, activeCameraId, cameras, clock | SAI | addMarker:218; addNote:289; snapshot:376; stopRecording:554 | 224,225,383 | addMarker (218), addNote (289), snapshot (376), stopRecording (554) each in try/catch; store reads after marker (224-225) and snapshot (383) |
| `apps/core-web/src/features/session-monitor/audio-panel.tsx` | - | mics | S | - | - | s.mics |
| `apps/core-web/src/features/session-monitor/audit-panel.tsx` | selectAuditTail | - | S | - | - | selectAuditTail |
| `apps/core-web/src/features/session-monitor/details-panel.tsx` | - | - | S | - | - | local selectDetails; RECORDING_PROFILES; useSimSecond |
| `apps/core-web/src/features/session-monitor/finalization-modal.tsx` | - | session, evidence | S | - | - | nine useSim selectors over s.session: finalization steps, evidenceId, timestamps, input (55-113) and recovery stage (311) |
| `apps/core-web/src/features/session-monitor/index.tsx` | - | - | SA | recover:86 | - | local selectPageModel (63); actions.recover in try/catch (85-90) |
| `apps/core-web/src/features/session-monitor/inputs-panel.tsx` | - | cameras, mics | S | - | - | s.cameras, s.mics |
| `apps/core-web/src/features/session-monitor/integrity-panel.tsx` | - | - | SA | verifyAuditChain:67 | - | verifyAuditChain returns ChainVerifyResult (67) in try/catch (66-75) |
| `apps/core-web/src/features/session-monitor/live-feed-panel.tsx` | selectSystemState | - | SA | setActiveCamera:67 | - | selectFeed, selectSystemState; setActiveCamera in try/catch (66-70) |
| `apps/core-web/src/features/session-monitor/model.ts` | selectCan, selectWorstAlert | operators, session, activeCameraId, cameras, storage, time, security, audit, faults | - | - | - | page model selectors (selectPageModel, selectBanner, selectFeed, selectDetails, selectIntegrity, selectStorage); canStart and canNote via selectCan (69-70) |
| `apps/core-web/src/features/session-monitor/sim-adapter.ts` | selectWriteRateHistory | clock | I | - | 36,52 | adapter: useWriteRateSeries via store.getState (36) and store.subscribe (52) |
| `apps/core-web/src/features/session-monitor/status-banner.tsx` | - | - | S | - | - | local selectBanner |
| `apps/core-web/src/features/session-monitor/storage-panel.tsx` | - | - | S | - | - | local selectStorage |
| `apps/core-web/src/features/session-monitor/timeline-panel.tsx` | - | session | S | - | - | s.session.timeline, startedAt |

### G12 features/session-new (8 files; 6 source, 2 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/session-new/__tests__/session-new-model.test.tsx` | - | - | - | - | - | test; pure model (PRECHECK_ORDER) |
| `apps/core-web/src/features/session-new/__tests__/session-new.test.tsx` | - | session, audit | - | setTabletLink:204,225; inject:237 | 195,211,214,216,222,227,243,245,246,257,278,286,288,305,308,310,317,324,345,350,351 | test; creates sim (64) with manual clock and scheduler; setTabletLink, inject |
| `apps/core-web/src/features/session-new/devices-step.tsx` | - | session, cameras | S | - | - | s.session precheck, s.cameras |
| `apps/core-web/src/features/session-new/index.tsx` | selectCan, selectOperator, selectSessionState | operators, session | SAI | beginPrecheck:189,214; createSession:203,207; cancel:206,297; acknowledgePrecheckWarnings:234; retryPrecheck:246; startRecording:259 | 130,202,214,217,256,294 | wizard: createSession returns CreateSessionResult (203, 207); cancel, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording each in try/catch; 6 store reads (130, 202, 214, 217, 256, 294) |
| `apps/core-web/src/features/session-new/info-step.tsx` | - | operators | S | - | - | s.operators filtered with roleHas(role, SESSION_START) (79) |
| `apps/core-web/src/features/session-new/model.ts` | - | - | - | - | - | types and SubjectType |
| `apps/core-web/src/features/session-new/ready-step.tsx` | - | - | - | - | - | OperatorRole constant (requires-role hint, 145) |
| `apps/core-web/src/features/session-new/sim-adapter.ts` | selectNextCaseNumber | - | - | scanCaseNumber:5,21 | 23 | adapter: scanCaseNumber returns string (21); fallback selectNextCaseNumber via store.getState (23) |

### G13 features/storage (15 files; 13 source, 2 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/storage/__tests__/storage-model.test.tsx` | selectStorage | storage, health, clock | - | inject:147,148 | 75,101,114,129,140,149,156 | test; creates sim (31); inject |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | - | - | - | inject:190 | 176,258,260 | test; creates sim (58); inject |
| `apps/core-web/src/features/storage/activity-panel.tsx` | - | - | S | - | - | selectStorageActivity via adapter (34) |
| `apps/core-web/src/features/storage/capacity-panel.tsx` | selectEvidenceStats, selectStorage | - | S | - | - | selectStorage, selectEvidenceStats |
| `apps/core-web/src/features/storage/kpi-cards.tsx` | selectIsRecording, selectStorage, selectStoragePolicy | session, storage | S | - | - | selectStorage, selectStoragePolicy, selectIsRecording, s.session, s.storage.writeBytesPerSec |
| `apps/core-web/src/features/storage/manage-drawer.tsx` | selectCan, selectStoragePolicy | - | SA | setStoragePolicy:31,53 | - | selectCan(EVIDENCE_REVIEW) or selectCan(MAINTENANCE) (21); setStoragePolicy in try/catch (52-59) |
| `apps/core-web/src/features/storage/model.ts` | - | - | - | - | - | pure helpers (GB, TB, thresholds) |
| `apps/core-web/src/features/storage/policy-panel.tsx` | selectStorage, selectStoragePolicy | - | S | - | - | selectStorage, selectStoragePolicy |
| `apps/core-web/src/features/storage/retention-calculator.tsx` | selectStorage | storagePolicy | S | - | - | selectStorage; s.storagePolicy |
| `apps/core-web/src/features/storage/sealed-chart.tsx` | selectSealedHourly | clock | S | - | - | selectSealedHourly |
| `apps/core-web/src/features/storage/sim-adapter.ts` | - | health | - | - | - | adapter: pure helpers (volumeHealth, selectVolumeTemperature and series over s.health); re-exports selectStorageActivity and thresholds |
| `apps/core-web/src/features/storage/status-banner.tsx` | selectStorage | - | S | - | - | selectStorage |
| `apps/core-web/src/features/storage/usage-chart.tsx` | - | storage | S | - | - | s.storage history |
| `apps/core-web/src/features/storage/use-storage-alerts.ts` | selectStorage | - | S | - | - | selectStorage |
| `apps/core-web/src/features/storage/volumes-panel.tsx` | selectStorage | storage | S | - | - | selectStorage; s.storage volumes |

### G14 features/system (14 files; 12 source, 2 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/features/system/__tests__/system-model.test.tsx` | - | audit | - | - | 88 | test; creates sim (87); stop |
| `apps/core-web/src/features/system/__tests__/system-page.test.tsx` | - | meta, session, mics, storage, audit, faults | - | verifyAuditChain:273 | 85,141,156,165,177,179,186,188,191,194,203,209,213,232,249,278,287 | test; creates sim (59); tick and clock.advance; verifyAuditChain (273) |
| `apps/core-web/src/features/system/about-panel.tsx` | - | device, network, update, clock | S | - | - | s.device, s.network, s.update |
| `apps/core-web/src/features/system/demo-panel.tsx` | selectClockSecond | meta, session, audit, faults | SAI | inject:165,188; clearFault:167,187,217; resetClip:168,218,219; resetDemo:203; loadScenario:204; recover:230 | 151 | Demo Control Panel: inject, clearFault, resetClip, resetDemo, loadScenario, recover through useSimCommand; store read of newest audit row after the action (151) |
| `apps/core-web/src/features/system/diagnostics.tsx` | selectCan | device, services, events, audit, diagnostics, clock | SAI | exportLogs:103 | 114 | restartCoreServices returns count (95); exportLogs returns ExportResult (103) then store read (114); RbacGate (47-); selectCan DIAGNOSTICS_RUN, MAINTENANCE, AUDIT_EXPORT (25-27) |
| `apps/core-web/src/features/system/health-panel.tsx` | - | health | S | - | - | s.health |
| `apps/core-web/src/features/system/model.ts` | - | - | - | - | - | static ROLE_PERMISSIONS lookup requiredRoleFor (22-23) |
| `apps/core-web/src/features/system/quick-actions.tsx` | selectRole | - | S | - | - | selectRole + roleHas gating (7, 65) |
| `apps/core-web/src/features/system/services-panel.tsx` | selectClockSecond | services | S | - | - | s.services; selectClockSecond |
| `apps/core-web/src/features/system/settings-panel.tsx` | selectOperator | device, activeCameraId, cameras, storagePolicy, time, auth | SAI | setActiveCamera:202 | - | selectOperator for account block; setActiveCamera via useSimCommand (202); prefs via useConsolePrefs |
| `apps/core-web/src/features/system/sim-adapter.ts` | selectPresentationMode, selectSettings | meta, audit | SA | updateSettings:8,98,103; restartServices:9,67; setPresentationMode:11,80; exportLogs:13; resetDemo:14 | - | adapter: updateSettings (98, 103), restartServices (67), setPresentationMode (80), localStorage mirrors (110-162) |
| `apps/core-web/src/features/system/status-banner.tsx` | - | services, update | S | - | - | s.services, s.update |
| `apps/core-web/src/features/system/update-panel.tsx` | selectCan | audit, update | SA | startSoftwareUpdate:68 | - | selectCan(MAINTENANCE) (13); startSoftwareUpdate via useSimCommand (68) |
| `apps/core-web/src/features/system/use-sim-command.ts` | - | - | A | runDiagnostics:56 | - | generic sync wrapper command() in try/catch (26-28); useStartDiagnostics returns boolean from runDiagnostics (56-57) |

### G15 lib (1 files; 0 source, 1 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/lib/__tests__/core-endpoint.test.tsx` | - | - | - | - | - | test; creates sim (202, 264) for the simAwareFetch routing and router wiring checks |

### G16 main.tsx and router.tsx (2 files; 2 source, 0 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/main.tsx` | - | - | - | - | - | dynamic import of createSim after z.config jitless (19); createSim({ onError }) (37); sim handed to createAppRouter (38) |
| `apps/core-web/src/router.tsx` | - | - | - | - | - | RouterContext.sim: Sim (19); createAppRouter({ sim, queryClient, socketFactory? }) |

### G17 routes (5 files; 5 source, 0 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/routes/__root.tsx` | - | - | - | - | - | SimProvider sim={sim} autoStart (73) inside HeartbeatProvider (72) and QueryClientProvider (71) |
| `apps/core-web/src/routes/_app.tsx` | selectIsSignedIn | - | - | - | 11 | guard: selectIsSignedIn(context.sim.store.getState()) else redirect /login?redirect=href (10-14) |
| `apps/core-web/src/routes/_app/evidence/index.tsx` | - | - | - | - | - | EvidenceStatus enum for search validation (11) |
| `apps/core-web/src/routes/_app/session/new.tsx` | selectCan | - | - | - | 16 | guard: selectCan(state, SESSION_START) else redirect /dashboard (15-19) |
| `apps/core-web/src/routes/login.tsx` | selectIsSignedIn | - | - | - | 11 | guard: selectIsSignedIn then redirect /dashboard (10-14) |

### G18 src/test (cross-feature tests) (6 files; 0 source, 6 test)

| File | Named selectors / views | Slices read inline | Hooks | Actions (line) | store access (line) | Note |
|---|---|---|---|---|---|---|
| `apps/core-web/src/test/evidence-table.test.tsx` | selectEvidenceStats | evidence | - | - | 39,60,112,131,135 | test; sim from evidence harness; store.setState (135) |
| `apps/core-web/src/test/integrity-checks.test.ts` | selectSystemState | - | - | inject:37,46,53,60 | 25,26,31,32,38,47,48,54,55,61,69,71 | test; creates sim (17) with manual clock; sim.tick (70); inject |
| `apps/core-web/src/test/routes.test.tsx` | - | - | - | signOut:193 | 174,311 | test; creates sim (71); real router; signOut (193) |
| `apps/core-web/src/test/shell-motion.test.tsx` | selectUnacknowledgedAlertCount | - | - | inject:241,269,276,297,301; clearFault:281,282; signOut:438 | 295,298,302 | test; creates sim (63); inject, clearFault, signOut |
| `apps/core-web/src/test/sim-fetch.test.ts` | - | - | - | - | 99,113,125,135,181,186,189 | test; creates sim (28); await sim.ready (36); sim.destroy (22); simAwareFetch against the simulator |
| `apps/core-web/src/test/visual-audit-45b.test.tsx` | - | - | - | inject:100,108 | - | test; sim from test-utils; inject (100, 108) |

## 12. Tests that construct a simulator

Counts from `grep -rn "createSim(" apps/core-web/src` and `graft callers createSim`: 24 call sites in 19 test files, plus the production call in `main.tsx:37`. Every file below is also a row in section 11.

| Test file (`apps/core-web/src/`) | `createSim(` line(s) | Options seen | Actions called | Direct state writes and engine calls |
|---|---|---|---|---|
| `components/composed/__tests__/test-utils.ts` (helper `createTestSim`) | 17 | `scenario`, `storage: null`, `authStorage: null`, `ALWAYS_VISIBLE`, no-op `scheduler` | none | `store.setState` 29 |
| `features/evidence/__tests__/harness.ts` (helper `createDatasetSim`) | 83 | `clock: createManualClock(DATASET_NOW)`, `storage: null`, memory `authStorage`, `ALWAYS_VISIBLE`, no-op `scheduler` | none | none; `sim.stop()` 107 |
| `test/routes.test.tsx` | 71 | `storage: null`, memory `authStorage` (pre-signed-in operator), `ALWAYS_VISIBLE`, no-op `scheduler`; builds the real router (`createAppRouter`) | `signOut` 193 | `sim.stop()` 121 |
| `test/shell-motion.test.tsx` | 63 | same as routes | `inject` 241, 269, 276, 297, 301; `clearFault` 281-282; `signOut` 438 | `sim.stop()` 131 |
| `test/sim-fetch.test.ts` | 28 | same plus `scenario` | none (answers via `simAwareFetch`) | `await sim.ready` 36; `sim.destroy()` 22 |
| `test/integrity-checks.test.ts` | 17 | `clock: createManualClock(START)`, `storage: null`, `authStorage: null`, `scenario`; **no** `scheduler` option | `inject` 37, 46, 53, 60 | `sim.tick()` 70 |
| `features/dashboard/__tests__/dashboard.test.tsx` | 82 | `scenario`, `storage: null`, memory `authStorage`, no-op `scheduler` | `inject` 308 | `store.setState` 347, 367 |
| `features/devices/__tests__/devices-page.test.tsx` | 54 | `scenario`, `storage: null`, memory `authStorage`, no-op `scheduler` | `deviceCommand` 203, 397, 398; `inject` 233, 240, 253, 334, 336, 374, 393, 411; `clearFault` 255; `setTabletLink` 264, 268, 394 | `store.setState` 361 |
| `features/login/__tests__/login-page.test.tsx` | 105 (default storages), 109 | 105 (the `webStorage` branch): `ALWAYS_VISIBLE`, no-op `scheduler`, optional manual `clock`, **no** `storage`/`authStorage`; 109: `storage: null` and memory `authStorage` | `signOut` 356, 366 | `sim.tick()` 293, 307, 313, 378; `sim.flush()` 455; `clock.advance` 306, 312, 377 |
| `features/network-time/__tests__/network-time-model.test.tsx` | 14 | memory `authStorage`, `ALWAYS_VISIBLE`, no-op scheduler | none | none |
| `features/network-time/__tests__/network-time-page.test.tsx` | 64 | `scenario`, `storage: null`, memory `authStorage`, no-op scheduler | `inject` 176, 189, 214, 220; `clearFault` 196; `setTabletLink` 208 | `store.setState` 243 |
| `features/security-audit/__tests__/security-audit.test.tsx` | 64 | `storage: null`, memory `authStorage`, `clock: createManualClock(DEMO_NOW)`, no-op scheduler | `inject` 138, 177, 258, 259, 300, 362; `verifyAuditChain` 140, 155, 301; `clearFault` 327; `signIn` 415 | `store.setState` 428 |
| `features/session-monitor/__tests__/session-monitor.test.tsx` | 53, 425, 429, 431 | 53: `scenario`, memory `authStorage`, injectable `scheduler` (default no-op) and optional manual `clock`; 425, 429, 431: `authStorage: null`, scenarios recording, idle, finalizing | `inject` 373, 377, 396, 427 | `clock.advance` 196 |
| `features/session-new/__tests__/session-new.test.tsx` | 64 | `scenario`, `storage: null`, memory `authStorage` (pre-signed-in), `ALWAYS_VISIBLE`, injected `scheduler` and `clock` | `setTabletLink` 204, 225; `inject` 237 | `clock.advance` 75 |
| `features/storage/__tests__/storage-model.test.tsx` | 31 | `storage: null`, memory `authStorage`, no-op `scheduler` | `inject` 147, 148 | none |
| `features/storage/__tests__/storage-page.test.tsx` | 58 | memory `authStorage` | `inject` 190 | `sim.stop()` 105 |
| `features/system/__tests__/system-model.test.tsx` | 87 | `storage: null`, manual clock, `ALWAYS_VISIBLE`, no-op scheduler; **no** `authStorage` option | none | `sim.stop()` 93 |
| `features/system/__tests__/system-page.test.tsx` | 59 | `storage: null`, memory `authStorage`, injected manual `clock`, no-op scheduler, `scenario` default `idle` | `verifyAuditChain` 273 | `sim.tick()` 246, 284; `clock.advance` 245, 283 |
| `lib/__tests__/core-endpoint.test.tsx` | 202, 264 | 202: `storage: null`, `ALWAYS_VISIBLE`, no-op scheduler, **no** `authStorage` option; 264: memory `authStorage` | none | none |

Test files that import `@dems/shared/sim` but get a simulator through a helper (6): `components/composed/__tests__/dbfs-meter.test.tsx` and `.../session-timeline.test.tsx` and `test/visual-audit-45b.test.tsx` (through `test-utils.ts`), `features/evidence/__tests__/evidence-export.test.tsx`, `.../evidence-integrity.test.tsx` and `test/evidence-table.test.tsx` (through `harness.ts`). Pure tests with no simulator (3): `features/dashboard/__tests__/dashboard-model.test.tsx`, `features/login/__tests__/login-model.test.tsx`, `features/session-new/__tests__/session-new-model.test.tsx`.

Test files under `apps/core-web/src` that do **not** import `@dems/shared/sim` (13, outside the 167): `components/composed/__tests__/{glow-ring,stepper}.test.tsx`, `components/media/__tests__/{camera-feed,live-decode-budget}.test.tsx`, `components/ui/__tests__/copy-in-items.test.tsx`, `features/evidence/__tests__/evidence-media.test.tsx`, `lib/__tests__/packaged-csp.test.ts`, `motion/__tests__/{ambient,debug-overlay,glow-layer,motion-policy}.test.tsx`, `test/home-page.test.tsx`, `test/scalar-config.test.ts`. Test environment: `vite.config.ts:26-31` (`environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `include: ['src/**/*.test.{ts,tsx}']`); `npm test` in this workspace is `vitest run` (`apps/core-web/package.json`, scripts block).

## 12b. Findings mapped to the blueprint's impact questions

| Impact question (blueprint "Open design questions research must close") | Web-side findings that answer part of it |
|---|---|
| IQ-1 Live and Simulated coexistence, UI in each mode | W-01, W-02, W-03, W-20 (no mode selector or mode label exists; `main.tsx` creates exactly one `Sim`) |
| IQ-13 WebSocket authentication; what a signed-out client receives | W-18 (the heartbeat client connects before sign-in and gates the login form; `routes/__root.tsx:72` mounts it above `/login`) |
| IQ-14 Audit trail | W-13 (web re-verifies the chain from the ring; shape dependency) |
| IQ-16 CORS and the packaged content-security policy | W-15, W-16 (origins; `connect-src`; duplicated launcher header and pinning test) |
| IQ-17 Biometric and security-key sign-in | W-04 (the web has the "Use security key (simulated)" button and no biometric code) |
| IQ-19 How clients learn of a permission or pairing change while signed in | W-07, W-08, W-20 (all gating is `useSim` over the store, so it is reactive to store changes; no other channel exists) |
| IQ-20 Pairing lifecycle | W-08 (display only; no pairing management UI in the web) |
| IQ-21 Complete endpoint list, realtime schema | W-17, section 5.1 (the sync-return sites are the web's de facto operation list) |
| IQ-23 API Reference page when every operation is live | W-17 (routing split in `sim-fetch.ts:105-122`, `includeSimulated` switch) |
| IQ-8 Where demo media live in Live mode | W-14 (bundle-time globs today) |
| IQ-24 Test strategy | W-19 (suites to keep green; helpers that carry the sim) |
## 13. Verification evidence

Run at 2026-10-04 from `/Users/gsp-budi/Documents/DEMS` (cwd never changed to a subfolder).

| Check | Command | Output |
|---|---|---|
| A. Files matching `@dems/shared/sim` under `apps/core-web/src` (count quoted at run time) | `grep -rl '@dems/shared/sim' apps/core-web/src \| wc -l` | `167` (blueprint-time count 167: no drift) |
| B. Rows in the group tables of section 11 | `grep -o '^\| \`apps/core-web/src/[^\`]*\`' <this file> \| wc -l` | `167` |
| C. Distinct paths in those rows | `... \| sort -u \| wc -l` | `167` |
| D. In the grep list but not in any group row | `comm -23 <grep list> <table list> \| wc -l` | `0` |
| E. In a group row but not in the grep list | `comm -13 <grep list> <table list> \| wc -l` | `0` |
| F. A path in more than one group row | `uniq -d <table list> \| wc -l` | `0` |
| G. Group sizes | generated with the tables | G1 6, G2 2, G3 8, G4 2, G5 14, G6 16, G7 17, G8 8, G9 13, G10 15, G11 15, G12 8, G13 15, G14 14, G15 1, G16 2, G17 5, G18 6 = 167 (139 source files, 28 test files) |
| H. Files under `apps/core-web/src` | `find apps/core-web/src -type f \| wc -l` | `361` at the end of the run (`360` at the start: the difference is `apps/core-web/src/.DS_Store`, ignored by `apps/core-web/.gitignore:19`; not created by this row's commands). 218 `.tsx`, 125 `.ts`, 15 `.css`, 2 `.svg`, 1 `.DS_Store` |
| I. Test files under `apps/core-web/src` | `find apps/core-web/src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) \| wc -l` | `39` (26 import the simulator, 13 do not; section 12) |
| J. `SimActions` members | read of `packages/shared/src/sim/types.ts:985-1094` | 42 members; 14 return a value |
| K. Graft cross-check of the value-returning call sites | `graft grep "actions\.(createSession\|signIn\|...)\(" --in apps/core-web/src` | `24 hits in 19 symbols across 14 files (searched 343 indexed files)`; every production line number in 5.1 appears in that output (196, 215, 203, 207, 21, 133, 145, 232, 96, 66, 56, 67, 94, 67, 103); the 24 hits are 15 production code lines, 4 comment lines and 5 test lines |
| L. Source files untouched | `git status --porcelain apps packages scripts release \| wc -l` | `0` |
| M. No server or process started | none was; the only scripts run were two Node parse scripts and one Python text-edit script under the session scratchpad | n/a |

## 14. Gaps, deviations, needs investigation

| # | Item | Status |
|---|---|---|
| 1 | The per-file regex columns are a lower bound (section 1): selectors that live in feature-local model modules (for example `features/devices/model.ts`, `features/session-monitor/model.ts`, `features/dashboard/*`) and the slices they read are named in the Note column but not exhaustively enumerated slice by slice. The synchronous-dependency tables (section 5) were read in context and are not regex-derived. | Open by design; row 4 of the data-analyst work can enumerate slices per selector from `packages/shared/src/sim/{selectors,views,derive}.ts` (row 1 owns that inventory) |
| 2 | `graft callers useSimCommand` listed only one of the five web callers (`useStartDiagnostics`); the other four are in `demo-panel.tsx:135`, `settings-panel.tsx:97`, `update-panel.tsx:43`, `diagnostics.tsx:86`, found by `grep`. Graft also reports mobile's separate `useSimCommand` in `apps/mobile/src/features/settings/maintenance-section.tsx` (row 4 scope). | Resolved with `grep`; no gap in the web list |
| 3 | `apps/core-web/src/routeTree.gen.ts` (generated by the TanStack router plugin) and `apps/core-web/.tanstack/tmp` were not read; the route list in 4.3 comes from `src/routes/**`. | Not needed for the inventory |
| 4 | Whether pages render before the simulator's `ready` promise resolves (hydration from `dems.sim.v1`). Only 3 files call `useSimReady`; the others read the store directly. **Hypothesis**: they render the freshly built initial state and re-render after hydration replaces it. Not tested here. | Open (relevant to a Live first-paint state) |
| 5 | Behaviour of `touch()` throttling, `signIn` lockout arithmetic, error codes and which actions throw `SimPermissionError` live in `packages/shared/src/sim` (row 1). This file cites them only where the web depends on them. | Out of scope for row 3 |
| 6 | Real-browser behaviour of the packaged CSP and of `same-origin` mode is covered by unit tests (`packaged-csp.test.ts`, `core-endpoint.test.tsx`) and by the release verification of the predecessor task, which this row did not re-read. | Open (row 5 and the test row) |
| 7 | `apps/core-web/.oxlintrc.json` and the root `tsconfig` were not read (not needed for the inventory). | n/a |
| 8 | Two other results about the web that the spec writer may want: `features/login/use-login-controller.ts:249-254` fills the password field with the published demo password for a picked demo operator, and `auth-card.tsx:427` displays it; a Live sign-in that shows demo credentials is a security-design topic for row 20 (cited by constant name only; no value is quoted here). | Passed on to rows 17 and 20 |

Deviations from the row text: none. The row asked for "selectors read, actions called" per group; the tables give named selectors and inline slices per file (a lower bound) and the full action list per file with line numbers. The asked-for "pairing-display code" is section 4.5; the "stored-session" code is sections 4.2 and 7.

Decisions needed (for the controller to record, not made here):

1. **Scope of the Live contract in the web.** The inventory shows the web needs three kinds of change if the Live source sits behind the existing `useSim`/`useSimActions` contract (ADQ-2): asynchronous results at the 14 Class A sites; error mapping at 36 void-action call sites (Class B) (HTTP statuses to `SimPermissionError`/`SimTransitionError`-like outcomes, or a changed `instanceof` check); and a different source for the 3 route guards and the static permission table (W-06, W-07). Row 14 decides; no web file has been changed.
2. **Keep the 28 test rows green in both modes** (NFR6): the tests construct `createSim` directly (19 files), so Simulated mode must remain a first-class, synchronous `Sim`. Whether Live-mode tests need their own helper belongs to the test strategy (row 18).

---
*Generated: 2026-10-04*
*Last Updated: 2026-10-04*
