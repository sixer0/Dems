# CP-M1 — the mobile Live foundation, code review (blueprint step 84, plan row W62)

**Input**: plan row W62 (checkpoint **CP-M1**). Rows reviewed: **W15** (secure-store wrapper and
probe), **W51** (mobile runtime), **W56** (mobile sign-in), **W57** (mobile pairing flow),
**W59** (mobile Login in LIVE mode), **W60** (mobile pairing gate). Read-only review: no source
file was changed. Method and bar: decision **D144** (the web checkpoint's method — read the code
and prove every claim with `file:line`, run the suites, mutate nothing).
**Time**: about 68 minutes of work; the four commands ran once each (P9), no watcher left behind.
**Verdict**: **PASS WITH FIXES**. **Open blockers: 0.**
**Severity counts**: Blocker 0 · Medium 3 · Low 7 · Info 6 (16 findings, `CPM1-1` … `CPM1-16`).

Assets: `assets/09_command_totals.txt`, `assets/09_scope_and_write_paths.txt`,
`assets/09_credential_and_bundle_checks.txt`.

---

## 1. Method

Read: the plan rows W15/W51/W56/W57/W59/W60/W62 and §8.1 (gates SG, CLG) and §11.3; the structured
brief P1–P25; the gate report's M1–M16; the integration spec §7.2, §9 (MP-1..MP-12, MB-1..MB-9),
§16 and the acceptance rows AC-C-28, AC-C-59, AC-C-65..AC-C-85, AC-C-101..AC-C-110; the six rows'
own reports; decisions D71, D124, D125, D129, D137, D138, D141, D143, D144; the web checkpoint
(report 08) for the method and for its ten-rule list.

Ran, once each, from the repo root (P10: never `cd` into the project):

| Command | Result |
|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` | **94 suites / 1,230 tests passed, exit 0**, 50.7 s |
| `npm run test -w @dems/shared -- --maxWorkers=2` | **68 files / 1,814 tests passed, exit 0**, 9.6 s |
| `npm run typecheck -w @dems/mobile` | exit 0 |
| `npm run lint -w @dems/mobile` | exit 0 — and `npx eslint src --format json`: **0 errors, 0 warnings** over all of `apps/mobile/src` |
| `sh apps/mobile/scripts/emulator-user-lock.sh status` (read-only, allowed by P3) | phone `CredentialType=PIN`, fingerprint 1, no keyguard; tablet the same; phone2 `NONE`, 0 — **unchanged from D125**; nothing was set, changed or cleared |

The mobile totals match the ledger after D143 (§11.3, mobile 94 / 1,230). No `test:db`, no lane
backend, no Metro, no device session, no Maestro flow (D141, P24). Two other agents were live
throughout (the gate on 4420, the core-web fix round); no port was opened or freed by this review.

Read the code, not the reports: every file the six rows created or changed under `apps/mobile/src`,
plus the settings and motion files they depend on. §8 names which of them were read end to end and
which across every region the rows touched.
plus the two shared files they lean on directly (`packages/shared/src/realtime/heartbeat-context.tsx`,
`packages/shared/src/realtime/index.ts`) and the config that decides which lint rules are live. The
typed client's `credentials: 'omit'` and the Live source's storage surface were read through the
assertions that pin them (`live-no-raw-fetch.test.tsx:180-186`, the `createLiveSim` call at
`sim-adapters.ts:498-527`), not through the shared files themselves.

## 2. Verdict by dimension

| Dimension (the row's own words) | Verdict | Findings |
|---|---|---|
| Mode isolation | **PASS** | CPM1-7 (Low), CPM1-12, CPM1-13, CPM1-15 (Info) |
| Credential storage | **PASS** | CPM1-1 (Medium, owned by W82), CPM1-11 (Info) |
| Hook naming under the React Compiler | **PASS** | none of that class; CPM1-16 (Info) |
| Release-build behaviour | **PASS** | CPM1-2 (Medium, owned by W82), CPM1-7 (Low) |
| Structure, reuse, error handling, i18n, tests | **PASS WITH FIXES** | CPM1-3 (Medium), CPM1-4..CPM1-6, CPM1-8..CPM1-10 (Low), CPM1-14, CPM1-16 (Info) |

### 2.1 Mode isolation — proven, not assumed

* **The decision is in one place.** `effectiveCoreLinkSource` (`runtime/core-link.ts:41`) is the
  only release gate, `decideCoreLinkSource` (`sim-runtime-provider.tsx:136`) the only switch rule, and
  `SimRuntimeProvider` (`runtime/sim-runtime-provider.tsx:161`) the only place that turns the
  preference into a data source. Nothing else re-reads the preference: screens read
  `useCoreLink().source` or the presence of `useMobileLive()`.
* **SIMULATED and HEARTBEAT never touch the Core server.** The Live source is built only when the
  decided source is LIVE (`sim-runtime-provider.tsx:163`); `createMobileSim` (`sim-adapters.ts:125`)
  opens nothing; the typed client and the Core socket exist only inside `createMobileLive`'s
  `if (__DEV__)` block (`sim-adapters.ts:322`, `:388`, `:501`). Health follows the same split
  (`features/home/use-health.ts:26`). What *does* open a socket in SIMULATED mode is the
  predecessor's mock-core heartbeat: `HeartbeatProvider` starts one client on mount
  (`packages/shared/src/realtime/heartbeat-context.tsx:42`) and `AppProviders` mounts it always
  (`providers/app-providers.tsx:110`, unchanged from `acaff20`). It dials `ws://127.0.0.1:4400`
  (mock-core), never `:4420`, and W51 stops it while LIVE is mounted
  (`sim-runtime-provider.tsx:172`, `:221-245`). Page rows must not read a mock-core socket as a Core
  request.
* **No raw request anywhere.** `live-no-raw-fetch.test.tsx:149-159` pins three rules over every
  production file: only `runtime/dev-probes.ts` calls a network API, only
  `runtime/sim-adapters.ts` + that probe name the Core address, and the adapters make no request but
  their socket factory. The reviewer's own grep found exactly those files (`core-link.ts:11` also
  matches textually — a header comment, invisible to the rule because `code()` strips comments at
  `live-no-raw-fetch.test.tsx:60`).
* **No silent fallback from LIVE in the data path.** `LiveRuntime` exists only on that branch and
  starts the source in an effect (`sim-runtime-provider.tsx:372-376`), a foreign Live source throws
  (`sim-runtime-provider.tsx:166-170`); a LIVE preference with an injected simulator reads
  SIMULATED (`simulatorLinkSource`, `sim-runtime-provider.tsx:128`, used at `:314`);
  `snapshotAllowed()` returns `undefined` forever when LIVE is not selectable (`:148-151`); the
  auth layer takes its mode from the runtime's word and cannot guess it
  (`auth/auth-provider.tsx:89-98`); and the `liveUnavailable` branch (`sim-runtime-provider.tsx:175-181`) is unreachable in a debug build —
  it is the "log and show the truth" line MD-6 asked for. One real gap is CPM1-7.
* **The release bundle.** W51's Metro measurement (report 51 §5, re-run by W56 and W59): the three
  secure-store item names, `Bearer `, `redeemPairingCode`, the typed client's operation table and
  the probe module are all absent. The residual is CPM1-13 (the socket-client class ships,
  unreachable).

### 2.2 Credential storage — MP-1 and DEPARTURE-6 hold

* **One importer.** The only `import ... from 'expo-secure-store'` in the app is
  `runtime/secure-credentials.ts:26`; the other two textual hits are prose (the wrapper's own header at
  `secure-credentials.ts:5`, and `dev-probes.ts:19`). `secure-store-import.test.ts:67-72` asserts it over the whole tree, and its
  matcher needs the name in quotes, so a comment can neither satisfy nor break it (`:49-55`). The
  wrapper reaches the release bundle by no path: all three importers are behind `__DEV__` requires
  (`sim-adapters.ts:326`, `live-auth-provider.tsx:101`) or behind a dev-only module
  (`dev-probes.ts:39`), and `live-auth-provider.tsx:51` is a type-only import.
* **DEPARTURE-6, condition by condition.** (1) The unprotected item is written only where
  `isDevice` is false **or** the build is debug: `isUnprotectedBiometricItemAllowed`
  (`secure-credentials.ts:256-258`) is the single expression, checked before any unprotected write
  (`:334`, and the rotation path at `:366`), and the mode is chosen once by `biometricWriteMode`
  (`auth/live-biometric.ts:59-67`); pinned by the four-row tables at
  `secure-credentials.test.ts:246-256` and `live-biometric.test.ts:51-56`. (2) A failing protected
  write or read turns biometric sign-in off — `readBiometricToken`/`rotateBiometricToken` call
  `biometricOff()` (`secure-credentials.ts:296`, `:361-364`) and the caller deletes both items and shows
  the MB-3 Alert (`live-biometric.ts:196-204`, `live-auth-provider.tsx:198-218`); the
  physical-device non-debug case is pinned at `live-biometric.test.ts:70`. (3) No text claims
  hardware protection: `live-auth-static.test.ts:149-153` fails if a sentence in `auth/` pairs
  "fingerprint" with "secure/safe/protected/encrypted/hardware", and the offer dialog is the only
  place that says "screen-lock check", gated on `screenLockNote: marker?.protected !== true`
  (`live-auth-provider.tsx:597`, `auth/i18n.ts:26`). The one screen that still says something
  untrue in LIVE is CPM1-1.
* **The scans are real, with positive controls.** `live-auth.test.tsx:1263-1306` walks pairing, a
  wrong password, enrolment and two biometric sign-ins, then proves the secrets *do* exist in the
  three secure items and are absent from AsyncStorage (all keys), the persistent log
  (`dems.mobile.log.v1`), the replica and the printed console; `pairing-live.test.tsx:499-502`
  scans storage + log + errors + store + stdout for the device credential and for any
  `dvc_`/`ses_`/`bio_` value; `live-login.test.tsx:346` repeats it for Login. Marker codes are
  assembled from parts in the tests, so no scan finds a whole value (values are deliberately not
  reproduced in this report).
* **Nothing secret in the six rows' documents or assets**: a scan over reports 15/51/56/57/59/60,
  their `assets/5*_` and `assets/60_` trees and `gateway_check/06a_*` for a credential-shaped
  literal returned **0** matches.

### 2.3 Hook naming under the React Compiler — the D138 class is absent

`eslint-plugin-react-hooks` 7.1.1 through `eslint-config-expo` 57.0.2 runs `set-state-in-render`,
`set-state-in-effect`, `refs`, `purity`, `immutability`, `static-components` and
`invalid-reactive-dependencies` at error level (verified with `--print-config`). Lint is clean with
**zero warnings** across `apps/mobile/src`. Every state adjustment found is the sanctioned
"adjust during render" shape, never a ref+effect:
`sim-runtime-provider.tsx:163` (owned source), `:522` (banner),
`use-pairing-flow.ts:160-162` (link/offline), `use-login-controller.ts:111-114` and `:152-155`
(the awaiting-limit latch D138 DN-2 asked for). Refs are never read during render: `linkRef`,
`pairingRef` (`live-auth-provider.tsx:167-172`), `alive` (`:174`), `mounted`/`flight`/`unjudged`/
`left` (`use-pairing-flow.ts`), `stoppedHere` (`sim-runtime-provider.tsx:221`), `debugSnapshot`
(`:319`) are written and read in effects and callbacks only. Hook names follow `use*`; the one
`use`-prefixed non-hook is the zustand store `useCoreLinkPrefsStore` (`core-link.ts:111`), which is
never called as a hook and says so at its comment `:107-110`. The three `'use no memo'` sites are pre-existing
or explained (`use-login-controller.ts:66` F-70-1, `login-card.tsx:127`, `root-navigator.tsx:100`,
`:118`). Note the nuance for page rows: `'use no memo'` skips the compiler's *memoisation*, but the
standalone rules still fire in those bodies — which is exactly what D138's failure and fix showed in
that very file.

### 2.4 Release-build behaviour

`heartbeat-release-gate.test.tsx` is **byte-equal to `acaff20`** (blob `6aa6db7…`), and it is not
alone: **none of the 72 baseline mobile test files changed** (`assets/09_scope_and_write_paths.txt`
§5 — the intersection of the baseline test list with the changed list is empty). The LIVE segment's
release case went into a new file beside it, as D17 required (`live-settings.test.tsx:72-75` asserts
`settings-core-link-LIVE` is `disabled: true` in a release build; `:65-66` asserts it is live in a
debug build). A protected-store failure turns biometric sign-in off rather than falling back
(§2.2 above). The release gate itself (`core-link.ts:41`) maps a stored HEARTBEAT/LIVE to SIMULATED;
the switch path logs a warn when refused (`:140`) but the hydration path does not — CPM1-7.

## 3. Findings

| # | Sev | Owning row | Where | What | Do what |
|---|---|---|---|---|---|
| CPM1-1 | 🟡 Medium | **W82** (routed by D129, from W56's F-6) | `features/settings/security-section.tsx:59`, `i18n/en.mobile.ts:57`; `:61` `isDisabled` | In LIVE the biometric switch still reads "Simulated identity binding" while the data is the Core's, and it never reads `session.biometric.changeBlocked`, so AC-C-68 ("disabled in a biometric session") is unmet. It does not claim hardware protection, so MB-6a(3) is not breached — but §3.2's truthful labelling is | Keep both in W82's brief verbatim; add `changeBlocked` to `biometricSwitchView`'s inputs and mode the description on `marker.protected` |
| CPM1-2 | 🟡 Medium | **W82** (interim accepted by D124 ruling 3) | `sim-runtime-provider.tsx:161-164`; the `createLiveSim` call at `sim-adapters.ts:498` passes no `owedSignOut` (the name appears nowhere in the file) | Crossing the LIVE boundary from the Settings segment signs nobody out and asks nothing: the LIVE→SIMULATED switch drops the Core session locally and leaves it open server-side until idle expiry (the web has owed-sign-out storage, mobile has none). Debug-only, and scheduled — but it is the one incoherent step left in the LIVE path | W82 lands the §3.3 dialog + sign-out across the boundary; the owed-sign-out residual goes to W100 with the web's |
| CPM1-3 | 🟡 Medium | **W57 + W59** (fix in W51's `runtime`) | `pairing-live-model.ts:51-62` vs `login-live-model.ts:79-89` | One rule — "show the offline notice, do not flicker" — exists twice, over two different representations of the same link (`LiveLinkState` vs `HeartbeatState`). Ten page rows now need it; without one home this becomes the Live layer's KI-08 | Extract one helper (and one link view) into `@/runtime` before W66 starts; both callers then read the same function |
| CPM1-4 | 🟢 Low | W59 | `features/login/login-model.ts:78-80` vs `auth/live-auth-model.ts:24-26` | `isCoreBlocked` re-implements `isSignInBlockedBy` verbatim (its own comment says "Mirrors"); `@/auth` already exports `isSignInBlocked` | Delegate to the exported one; delete the duplicate expression |
| CPM1-5 | 🟢 Low | W57 + W59 | `pairing-code-panel.tsx:67-74` vs `login-card.tsx:378-386` | The Alert entrance animation (reduced: `FadeIn` 150 ms; else `FadeInDown` base + `EASING.luxe` + `riseSm`) is written twice, while `@/motion` owns every other entering builder (`motion/builders.ts:226`) | Add `enterAlert(m)` to `@/motion` and use it in both; a third copy must not appear in W66..W82 |
| CPM1-6 | 🟢 Low | W57 | `features/pairing/i18n.ts:144`, pinned by `pairing-live-static.test.ts:107-108` | "Use Simulated mode" is a local pairing copy while Login reuses the shared `common.coreMode.useSimulated` (`login-card.tsx:435`) — the reuse D138 DN-3 ruled for is applied in one row and not the other | Point the button at the shared key; the static test's "only live-mode text naming simulated" check still passes because it scans the folder's own tree |
| CPM1-7 | 🟢 Low | W51 | `core-link.ts:126` (vs `:140`) | A stored HEARTBEAT/LIVE value that reaches a release build is mapped to SIMULATED at hydration with **no record**, while the switch path logs one. That is the only silent step down out of LIVE in the app | One `reportRuntimeIssue('info', 'runtime.coreLink.releaseFallback', …)` when the stored value differs from the effective one |
| CPM1-8 | 🟢 Low | W56 | `live-auth-static.test.ts:83-93` | The MD-6 guard asserts the *whitespace shape* of `biometricStoreOf` (an exact tail `'}\n  return null;'`), so a reformat breaks a gated row with no behaviour change. The `__DEV__`-gating intent is right; the exact-text tail is over-specified | Keep "the require is inside the `if (__DEV__)`"; drop the byte-exact tail assertion |
| CPM1-9 | 🟢 Low | W56 + W57 | `live-auth-static.test.ts:23-37`, `pairing-live-static.test.ts:43-54` | Both pin their folder's exact production-file list. Legitimate anti-drift, but any fix round that adds one file to `auth/` or `features/pairing/` now fails a closed row | Keep, and say so in the carry list; or compare a prefix set instead of an equality list |
| CPM1-10 | 🟢 Low | W56 built it, **W59 left the grant unused** | `auth/i18n-bundle.ts:23` + `live-auth-provider.tsx:75`; `src/i18n/features.ts:28-35`; `live-auth-static.test.ts:143-146` | The auth sentences register themselves at import time because `features.ts` was outside W56's paths; D129 DN-2 granted that one line to W59, which did not take it, so the app keeps two mechanisms for English copy — and the static test now *asserts* the workaround ("the registry has no `features.auth`") | Add `auth: authEn` to `features.ts`, delete `i18n-bundle.ts` and its side-effect import, and retarget that assertion to "the registry owns it" |
| CPM1-11 | ℹ️ Info | predecessor (step 73), relied on by W51/W56/W57 | `runtime/log.ts:33`, `:87-88` | The log filters context by **key name** and stores `error.message` and `stack` verbatim; unlike the web's error sink it has no value-level redaction (report 08 §3.2, CPW1-12). Raw errors reach it from ~20 sites (`sim-adapters.ts:444`, `:522`, `:566`; `live-auth-provider.tsx:372`; `use-pairing-flow.ts:215`, `:322`). What actually keeps secrets out today are the three value scans, not the filter | Add a `redactCredentials`-style value pass (message, stack, context values) mirroring the web sink; W100's, with the web's |
| CPM1-12 | ℹ️ Info | W51 | `sim-runtime-provider.tsx:163`, `sim-adapters.ts:646` | `createMobileLive()` runs during render and registers the object in a module WeakMap; StrictMode's double render orphans one object per mount (harmless today: `autoStart:false`, no socket, no timers, no storage read — as the comment at `:158-160` says) | Leave. Page rows must not copy "build a source during render" for anything that acquires a resource |
| CPM1-13 | ℹ️ Info | W51 F-5 (shared layout), accepted by D124 | `packages/shared/src/realtime/index.ts:2` | `createLiveSocketClient` ships in the release bundle (1 line) because the realtime barrel re-exports it; unreachable, no address, no credential | Belongs to the shared package's review list, not to a mobile row |
| CPM1-14 | ℹ️ Info | W57 | `features/home/home-screen.tsx:217` | One line outside the row's plan write path, granted by D124 ruling 2 and covered by `stack-check-service-name.test.tsx`. Inside `apps/mobile`, so the W62 scope check is unaffected | Nothing to do; recorded so the audit trail names it |
| CPM1-15 | ℹ️ Info | W51/W57/W59 | `use-health.ts:23`, `use-pairing-flow.ts:133`, `login-live-model.ts:25` | Three idioms answer "is this LIVE": `useMobileLive() !== null`, `useCoreLink().source === 'LIVE'`, `isLiveLogin(link)`. All agree inside the app (a foreign Live source throws at `sim-runtime-provider.tsx:166-170`), but ten rows will copy whichever is nearest | Pick one for screens (`useCoreLink().source`) and one for callers that need the client (`useMobileLive()`); state it in W66's brief |
| CPM1-16 | ℹ️ Info | W60 / predecessor | `navigation/root-navigator.tsx:103`; `use-pairing-flow.ts:296`, `:304`, `:312`; log-source styles | Three small consistency items: `usePairing()` is called inside an `if` condition (legal — the call is unconditional — but a shape a reader may copy into a genuinely conditional position); `pair`/`cancel`/`unpair` are plain closures recreated each render while `setCode` is a `useCallback` (the predecessor's style, kept); the log's `source` field is `PairingScreen.*` in one folder and `login.*` in another while `log.ts:41` documents the lowercase form | Prefer a named local (`const pairing = usePairing(); if (isPairingBlocked(pairing)) …`); leave the rest, but tell page rows which source style to copy |

### 3.1 Challenges put to the executor, and how they resolved

1. **"A provider that switches its data source in a render-phase `setState` is a footgun."**
   Confirmed and accepted: it is React's sanctioned adjustment pattern, the object is inert until
   `start()` (`autoStart:false`), and the alternative (an effect) is what D138 rejected for Login.
   CPM1-12 records the only residue.
2. **"Does one delete path really retire all three items?"** Yes: `deleteDeviceCredential`
   (`secure-credentials.ts:239-245`) calls `deleteBiometric()` first and tries all three, returning
   the first failure — MP-4's "all three items" in one call. And there is exactly one caller in the
   app: `removeStored` (`sim-adapters.ts:413-416`), used by the unpair and forget paths. No screen
   and no other module deletes a credential.
3. **"`rotateBiometricToken` writes the new token with the *old* marker's owner — could a marker
   mismatch survive?"** It cannot: `:359-371` reads the marker first and refuses a corrupt one by
   turning biometric sign-in off, and the owner ids come from one redeem answer written by
   `storeTokenAndMarker` (`secure-credentials.ts:301-305`). But the marker is never rewritten on
   rotation, which is exactly why the crash residual in answer 1 needs a marker change.
4. **"Is the `unprotected` mode a silent fallback?"** No: it is a chosen mode (D71), it is refused
   outside `isDevice===false || __DEV__` (`secure-credentials.ts:334-336` → `UNPROTECTED_NOT_ALLOWED`
   + both items deleted), and the marker records `protected:false`, which is what every MB-6a(3)
   wording test reads. What *is* missing is a runtime record of which MB-5 case a build is in — the
   only trace is the marker's boolean. Info, folded into answer 1's recommendation.
5. **"Twenty-plus `reportRuntimeIssue` calls pass a raw error; who says the message is clean?"**
   Nobody statically — the log has no value redaction (CPM1-11). The claim is carried by three
   behaviour tests that read the persisted log back and scan it, with positive controls. Accepted
   for a demo, named for W100.

### 3.2 Done well (worth keeping as the standard)

* **The storage orderings are enforced by construction, not by convention**: `devicePaired` (`sim-adapters.ts:473-486`)
  awaits `store.writeDeviceCredential` and throws before anything says "paired" if the write did not
  land (`:474-483`), and `commit` waits `commitAt` *and* the link *and* the credential
  (`use-pairing-flow.ts:190-199`). MP-6 is tested at the moment the UI says "paired"
  (`pairing-live.test.tsx:520-538`) and by killing the app between answer and settle (`:540`).
* **`describeCoreError` is the one presenter** (`runtime/core-errors.ts:177-200`) and both new rows
  *consume* it instead of re-wording: the 429 branch precedes everything (`:143`) and sets
  `outage:false`, which is what makes LB-10 structurally impossible to get wrong; the pairing model reads `kind` and
  `retryAfterSeconds` off it (`pairing-live-model.ts:120-126`) and the login model only its `kind`
  (`login-live-model.ts:96-101`). The web checkpoint had to say this about two parallel presenters; here
  there is genuinely one.
* **The two-provider split kept the Simulated path honest**: `auth-provider.test.tsx` and
  `biometric.test.ts` are byte-equal to `acaff20` and pass unedited (D129's condition), and
  `live-auth-static.test.ts:136-141` pins that a second port registration changes nothing.
* **Tests pin behaviour and name their criterion.** 22 new test files holding 299 `it(` sites; the names carry the
  AC ids; the marker scans have positive controls. The static tests are confined to their own
  folders except the two workspace-wide security rules (raw fetch, one importer), which is the
  acceptable kind per D144.
* **Refusals never touch a credential** — the one thing the web checkpoint found as a High
  (CPW1-10). `runBiometricSignIn` checks the gate and the link *before* it reads the store
  (`live-auth-provider.tsx:443-446`) and the 401/403 branch deletes only after operation 8 has been
  answered (`:198-218`); `setPairing` cannot overwrite a paired device except by an explicit re-pair
  or `DEVICE_REVOKED` (`sim-adapters.ts:343-353`).

## 4. The four questions, answered by name

**1. The residual of D129 DN-1 (a process that dies between a biometric request and its answer
leaves the sent token in the store) — acceptable, or is there a small change in
`apps/mobile/src/auth/**`?**

As built it **fails safe for the account but not for the audit trail**. The token is released to the
Live source only after the prompt succeeds (`live-biometric.ts:183-211`), and it is rotated on
success (`:219`) or deleted when spent (`:249`); a death in between leaves the used token in
`dems.live.bio.v1`, so the next launch hands the same token out again. The server then does its job:
`TOKEN_REUSE` ends the family's open sessions (SD-10), the app's 401 path deletes both items and
shows the §6.5 Alert (`live-auth-provider.tsx:198-218`, `live-auth-model.ts:86-97`), and the device
credential survives. So nobody is locked out and no credential leaks. What it costs is worse than
"nothing": the tablet *causes* a reuse of its own token, which ends the operator's other sessions and
writes an `AUTH_FAILED`/`TOKEN_REUSE` row that reads exactly like a copied credential — the same
argument the plan uses for GC-05 about a `DEVICE_CREDENTIAL_ROTATED` row. And the enrolment is lost
anyway, so the fail-safe buys nothing over losing it earlier.

There **is** a small change that closes it, and it does not need to write a secret back (which is
what W56's own F-3 said stopped it): carry a **non-secret `presented` flag in the marker**.
(i) `runtime/secure-credentials.ts`: add `presented: boolean` (default false) to
`BiometricMarkerSchema` (`secure-credentials.ts:94`) plus a `markBiometricPresented()` that rewrites the marker only —
the marker is not a secret (§9.1), it is written unprotected today (`:305`) — and clear the flag in
`rotateBiometricToken` (`:359`) and on an `end('kept')`. (ii) `auth/live-biometric.ts`: set it inside
`port.token()` **before** returning the value (`:183-211`), and in `marker()` (`:158-180`) treat a
marker with `presented === true` as a void enrolment — delete both items, return `null` — exactly
like the existing "marker of an earlier pairing" branch (`:172-178`). Cost: one extra unprotected
write per biometric attempt; the failure mode becomes "the enrolment is gone, use the password"
instead of "the device reported a reuse against itself". It is two files, one of them W15's, so it
needs a grant. **Recommendation: keep the current fail-safe for the demo (D129 already routed it to
W100) and decide the flag there; if it is wanted before the device rows, it is a W56 slot with W15's
wrapper touched under a grant.**

**2. W59's F-4 (the Login screen was not Live-aware when W56 gated) and W60's split device evidence
(D143 DN-1) — is the mobile LIVE path coherent end to end?**

**Yes for the chain the six rows own; the two loose ends are both W82's, and the device proof is
deferred to W94 by decision, not by omission.** F-4 is closed: the Login screen is Live-aware now —
`use-login-controller.ts:69` reads the link, `:111-114` and `:152-155` implement the offline and limit
rules, and `login-card.tsx` shows the C1 sentence (`:540`) and the trust line (`:590`) and drops the role
chip and the pairing-code hint in LIVE, with the auth layer's notice taking the one Alert slot
(`:392-398`) — AC-C-72 and AC-C-104 are pinned by `live-login.test.tsx:231` and `:257`. The chain
reads in one direction: gate (`root-navigator.tsx:71-79`, boot `/pair` at `:103`) → pair (credential
before settle, `sim-adapters.ts:473-486`) → LIVE sign-in (`live-auth-provider.tsx`) → Home, with one
presenter and one banner rule throughout; jest (94/1,230) covers it, and D143's device evidence
includes a real `POST /api/v1/auth/sign-in → 200` on lane 1 with the pairing intact. The
split-screen evidence is accepted with D143's standing condition that **W94 shows one continuous
session** (pair → sign-in → Lock → fingerprint) on one emulator, not two halves. What is *not* yet
coherent is the boundary *into and out of* LIVE from Settings: no confirmation dialog, no sign-out,
and no owed-sign-out storage on mobile (CPM1-2, interim per D124 ruling 3), plus the Settings
biometric description that still says "Simulated" in LIVE (CPM1-1). Both are W82's brief today; if
either is dropped, the LIVE path stops being coherent at its entry point, not in its middle.

**3. What the ten mobile page rows W66..W82 must carry as rules** (the mobile equivalent of report
08 §8):

1. **One way in.** `useCoreActions()` + `settle` for an action;
   `useMobileLive()?.client.call(operationId, input)` for an operation the simulator has no action
   for (`runtime/index.ts`'s surface table; `sim-adapters.ts:402-410`). Never `useSimActions`, never
   `.actions` outside a translation key, never `sim`/`live.source`/your own client/a second socket.
   Four static scans fail the workspace if you do: `live-no-raw-fetch.test.tsx`,
   `live-auth-static.test.ts`, `pairing-live-static.test.ts`, `login-live-model.test.ts:85-101`.
2. **Hand every rejection to the presenter first**: `if (presentCoreError(error)) return;`
   (`core-errors.ts:259-286`). Rows 2–8 coalesce at 3 s **per app** (module-level `appCoalescer`
   `:226`) — call `resetCoreErrorPresenterForTests()` in `beforeEach` or your second toast silently
   disappears; `DENIED`, `REFUSED` and `NOT_AVAILABLE` never coalesce; a 429 is a limit
   (`outage:false`, LB-10) so it may never drive a link notice or a chip; `DEVICE_NOT_PAIRED` has no
   wording on purpose (D118, `:112-117`) — the pairing gate is the only thing that may say so.
3. **Never name the Core address and never call a network API.** Rule 2 of
   `live-no-raw-fetch.test.tsx:157` allows exactly two files (`runtime/sim-adapters.ts`, and the
   debug probe by name). Read `useCoreLink().source/state/heartbeat`; a countdown is derived from
   `retryAfterSeconds`.
4. **Never touch a credential.** Only `runtime/secure-credentials.ts` may import the package
   (AC-C-66, `secure-store-import.test.ts:67-72`) — a Settings row that wants the marker reads
   `useAuthSession().biometric.protected`, not the store. No `dvc_`/`ses_`/`bio_` value, marker
   password or marker code in AsyncStorage, the log, a test name or a document; the log filters by
   **key name** only (`log.ts:33`), so never pass a secret under a benign key (CPM1-11).
5. **One LIVE idiom.** `useCoreLink().source === 'LIVE'` on a screen, `useMobileLive()` when you
   need the client (CPM1-15). Never re-derive the mode from a preference, a mode string or storage,
   and never add a fourth offline/flicker rule — fix CPM1-3 first and call the one helper.
6. **React Compiler is on.** `react-hooks/set-state-in-render`, `set-state-in-effect`, `refs`,
   `purity` are error-level and the tree is at 0 errors **and 0 warnings**. Use the render-time
   "adjust state when the input changed" shape (`sim-runtime-provider.tsx:522`,
   `use-pairing-flow.ts:160`, `use-login-controller.ts:152`), never a ref+effect (D138); keep refs
   out of render; `'use no memo'` only for a mutable third-party object, with the reason in the
   comment.
7. **Timers on the store's clock, never `setTimeout`** ([CS:§8.1]): `useSim((s) => … s.clock.now)`
   plus a store subscription, as the pairing flow does for its commit, its hand-off and its countdowns
   (`use-pairing-flow.ts:179` reads `lockSecondsAt(retryAt, s.clock.now)` through `useSim`); in LIVE
   the store *is* the Live source, so a countdown follows the server's clock (`pairing-model.ts:152`,
   `pairing-live-model.ts:96`).
8. **Chips and copy (MD-8, AC-C-30, W66's own row):** the Core chips read "Simulated" unless the
   source is LIVE, and a screen showing server data says nothing about a simulation.
   `pairing-live-static.test.ts:104-109` (no "simulat" in a live-mode text) is the model for the
   check. Do not add a `SIM-GAP` marker anywhere: KI-07 is 13 IDs / 62 markers, identical to
   `acaff20`; a gap is `needs-review`, per P12.
9. **Do not touch:** `runtime/**` except through its barrel, `src/app/**` layouts,
   `navigation/**`, `auth/**`, `features/login/**`, `features/pairing/**` (W51–W60 own them),
   `jest.setup.ts`, `package.json`, `app.json`, `scripts/**`, the **72 baseline test files** (all
   byte-equal to `acaff20` — keep it that way), `heartbeat-release-gate.test.tsx` (AC-C-83), and
   anything under `packages/shared/**`, `apps/core-web/**` or `apps/mock-core/**` (P6). An interface
   you need is `needs-review`, not an edit — the CP-W1 lesson (report 08 §8 rule 9).
10. **Ledger and pre-image.** `@dems/mobile` is **94 suites / 1,230 tests exit 0**, typecheck 0,
    lint 0/0; `@dems/shared` 68 files / 1,814 exit 0. Device checks: every `core=LIVE` check ends
    with `core=SIMULATED` (D124 ruling 6); never touch a keyguard, a fingerprint or a device
    security setting (D125, D141); lane 1 keeps `DEV-0001` and lane 2 keeps its pairing (D137 DN-6,
    D143 DN-2) — reset only through `db:reset`; `dems2_phone2` stays lock-free and unpaired until
    W94; `apps/mock-core` is read-only (P5).

**4. Any exposure of KI-07 (13 SIM-GAP markers in mobile) and KI-08 (eight copies of the sheet hook)
that this task's Live work makes worse?**

**KI-07: not worse, measurably.** The plan's own command (`grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+"
apps/mobile/src`) returns **13 IDs / 62 markers now and 13 IDs / 62 markers at `acaff20`** — the
per-ID counts are identical (asset §D). None of the 31 changed files and none of the new files holds
a marker, and the six folders contain no `CONTRACT-GAP`, `SCHEMA-GAP`, `BE-GAP`, `TODO` or `FIXME` at
all. The Live work added no marker mechanism and needed none: it did not touch a screen with a gap.
**KI-08: not worse in count, but the Live work started the same disease in a new organ.** The eight
`use-sheet-presence.tsx` copies (67–97 lines, eight distinct blobs) and the two
`use-held-value.ts` copies are untouched by all six rows. The exposure is the *analogue*: the rule
"follow the link without flicker" now exists twice with two different input types
(`pairing-live-model.ts:51` on `LiveLinkState`, `login-live-model.ts:79` on `HeartbeatState`), and
`features/pairing/use-dialog-presence.ts` — its own header says it is "copied from step 79's
pattern" — is already a ninth instance of that class (it predates this task; W57 left it unchanged,
and it uses the render-time adjustment shape correctly). Ten page rows sit in front of that helper, each of which will need to know whether the
Core link is down. Left as is, W66..W82 produce the Live layer's KI-08 — which is why CPM1-3 is the
only Medium the reviewer would fix **before** the page wave rather than in W100.

## 5. Fix-order proposal

| Order | What | Why now | Owner |
|---|---|---|---|
| 1 | CPM1-3 (one offline/flicker helper + one link view in `@/runtime`) | Cheapest while it is two copies; ten rows copy it otherwise | a small slot on W51's files, agreed with W57/W59 |
| 2 | CPM1-1 and CPM1-2 | Already W82's brief; confirm the two items are written into it verbatim so the LIVE entry point stops lying and stops dropping a session | W82 |
| 3 | CPM1-4, CPM1-5, CPM1-6 | Three one-line de-duplications; batch them with step 1's slot | W59, W57 |
| 4 | CPM1-7, CPM1-10 | One log line; then the i18n registry entry plus deleting the escape hatch and retargeting its assertion | W51, W59 |
| 5 | CPM1-8, CPM1-9 | Loosen the two over-specified pins when those files next change — not worth a slot of their own | W56, W57 |
| 6 | CPM1-11 and the answer-1 `presented` flag | Both are security-review items with a device consequence; W100 decides with the web's CPW1-12 and the owed-sign-out residual | W100 |
| 7 | CPM1-12 … CPM1-16 | Instruction and close-out notes; carry them into W66's brief and the close-out report | controller |

## 6. The required scope check of the row

The row's own words: *"`git diff --stat acaff20` shows no write of a mobile row under
`packages/shared`, `apps/core-web` or `apps/mock-core`."* Verified, with the method's limit stated:

```
$ git diff --stat acaff20 -- apps/mobile
 apps/mobile/jest.setup.ts                          | 191 ++++++-
 apps/mobile/package.json                           |   3 +-
 apps/mobile/scripts/device-session.sh              | 185 ++++++-
 apps/mobile/src/auth/auth-dialogs.tsx              |  19 +-
 apps/mobile/src/auth/auth-provider.tsx             | 241 ++++-----
 apps/mobile/src/auth/biometric.ts                  |  62 ++-
 apps/mobile/src/auth/index.ts                      |  33 +-
 apps/mobile/src/features/home/home-screen.tsx      |   2 +-
 apps/mobile/src/features/home/use-health.ts        |  46 +-
 apps/mobile/src/features/login/i18n.ts             |  17 +
 …
 apps/mobile/src/runtime/core-link.ts               |  32 +-
 apps/mobile/src/runtime/debug.ts                   | 119 ++++-
 apps/mobile/src/runtime/index.ts                   |  78 ++-
 apps/mobile/src/runtime/sim-adapters.ts            | 571 ++++++++++++++++++++-
 apps/mobile/src/runtime/sim-runtime-provider.tsx   | 348 ++++++++++++-
 31 files changed, 2784 insertions(+), 432 deletions(-)
```

* `git diff --name-only acaff20 -- apps/mobile` → **31 tracked files, every one under
  `apps/mobile`**; `git status --porcelain apps/mobile | grep '^??'` → **35 new files**
  (34 under `src/`, one under `scripts/`), again every one under `apps/mobile`
  (asset `09_scope_and_write_paths.txt` §2–§4 and §6 list both).
* **`apps/mock-core`: 0 files** changed, and `release/` + `scripts/release/`: 0 (P5/P6 hold).
* `packages/shared`: **28** files changed, `apps/core-web`: **28** — **none claimed by any of the six
  rows.** Each of the six reports states its own write paths and each says so in terms: W15 "five
  files under `apps/mobile/`" and "Not touched: any `package.json`"; W51 `runtime/**` +
  `features/home/use-health.ts` + `i18n/en.mobile.ts` + tests; W56 "every file under
  `apps/mobile/src/auth/`", "Nothing outside `apps/mobile/src/auth/` was touched"; W57
  `features/pairing/**` plus the one granted line; W59 `features/login/**`; W60
  `navigation/root-navigator.tsx` + `navigation/testing/router-harness.tsx`. The shared files the
  mobile rows *import* are owned by other rows on the plan's own table (W12 client, W18/W44 Live
  light/source, W42/W48 realtime, W16 sim vocabulary, W19/W22/W27 contract chain, W50/W54/W55 web
  rows), and the two `packages/shared/src/sim/` files outside W16's grant (`evidence-actions.ts`,
  `session-machine.ts`) belong to the controller's W22b slot, not to a mobile row.
* **These counts are a snapshot of 17:28 WIB.** The core-web fix round was writing
  `apps/core-web/src/**` while this review ran (P11), so a later reader will count more files there
  than the 28 quoted above; `apps/mobile` did not change during the window (no mobile row ran), and
  the reviewer wrote no file outside `gateway_check/09_*`, its assets and its own progress file.
* **The limit, stated as the web checkpoint stated its own:** nothing was committed after
  `4b708c8`, so git cannot attribute a hunk to a row; the attribution above is by each row's declared
  file list cross-checked against the actual changed list. Within that method the check passes.
* **Inside `apps/mobile`, one line sits outside its row's plan write path**:
  `features/home/home-screen.tsx:217`, granted by D124 ruling 2 and covered by
  `stack-check-service-name.test.tsx` (CPM1-14). It is inside `apps/mobile`, so the row's criterion
  is unaffected.
* **AC-C-101 / CLG (a)**: of the **72** mobile test files at `acaff20`, **0** changed;
  `heartbeat-release-gate.test.tsx`, `guard.test.tsx`, `auth-provider.test.tsx`,
  `biometric.test.ts`, `pairing-screen.test.tsx`, `pairing-model.test.ts`, `login.test.tsx`,
  `login-model.test.ts`, `runtime.test.tsx`, `sim-adapters.test.ts`, `app-providers.test.tsx`,
  `runtime-contract.test.tsx` are all blob-equal (asset §5). The only setup change is
  `jest.setup.ts` (W15's secure-store mock, recorded in D71 R-CO).

## 7. Not verified, and the limits of this context

1. No device, no Metro, no lane backend, no `test:db` (D141, P24, and the gate agent owns 4420).
   Everything about a real bundle rests on W51's Metro measurement and W60's device logs; the
   emulator lock state was read back unchanged and nothing else device-side was touched.
2. Attribution is by declared file lists, not by commits (§6).
3. `packages/shared/**` was read only where the mobile rows lean on it: the two realtime files named
   in §8, and nothing else. The shared Live source's internals were seen only through the
   `createLiveSim` call site at `sim-adapters.ts:498-527` (which is what shows the Live source is given
   no persist storage), and the typed client's `credentials: 'omit'` only through the assertion that
   pins it at `live-no-raw-fetch.test.tsx:180-186`. The shared package's own review is report 07's.
4. Whether the compiler validates a `'use no memo'` body was settled empirically from D138's own
   failure-and-fix in that file, not from the plugin's source.
5. The `presented`-flag proposal (answer 1) was **not** prototyped or run; it is a design sketch with
   its two files named, offered for W100 to decide.
6. The reviewer's footprint: four test/lint/typecheck commands, one read-only `status`, and the
   deletion of one empty directory this review had itself just created under
   `gateway_check/assets/` (`rmdir`, nothing in it). No `rm` of content, no `mv`, no `chmod`, no kill,
   no git write of any kind.

## 8. Files reviewed (the code, not the reports)

**Read end to end.** `apps/mobile`: `runtime/secure-credentials.ts`, `runtime/contract.ts`,
`runtime/core-link.ts`, `runtime/sim-adapters.ts`, `runtime/sim-runtime-provider.tsx`,
`runtime/core-errors.ts`, `runtime/log.ts`, `runtime/debug.ts`, `runtime/secure-store-import.test.ts`,
`auth/live-biometric.ts`, `auth/live-auth-model.ts`, `auth/live-auth-provider.tsx`,
`auth/auth-provider.tsx`, `auth/auth-session.tsx`, `auth/auth-notice.tsx`, `auth/i18n-bundle.ts`,
`auth/live-auth-static.test.ts`, `features/pairing/pairing-live-model.ts`,
`features/login/login-live-model.ts`, `features/login/login-live-model.test.ts`,
`features/login/use-login-controller.ts`, `features/home/use-health.ts`,
`navigation/root-navigator.tsx`, `providers/app-providers.tsx`, `i18n/features.ts`, `i18n/index.ts`,
`features/settings/heartbeat-release-gate.test.tsx`, `package.json`, `eslint.config.js`.
`packages/shared`: `src/realtime/heartbeat-context.tsx`, `src/realtime/index.ts`.

**Read across every region the six rows changed** — the diff against `acaff20` plus the surrounding
component: `runtime/connection-banner.ts`, `runtime/index.ts`, `runtime/dev-probes.ts`,
`runtime/live-no-raw-fetch.test.tsx`, `runtime/live-settings.test.tsx`, `auth/biometric.ts`,
`auth/auth-dialogs.tsx`, `auth/index.ts`, `auth/i18n.ts`, `auth/live-auth.test.tsx`,
`auth/live-biometric.test.ts`, `runtime/secure-credentials.test.ts`,
`features/pairing/{use-pairing-flow,pairing-model,i18n}.ts`,
`features/pairing/{pairing-connection,pairing-code-panel,pairing-screen,unpair-dialog}.tsx`,
`features/pairing/{pairing-live.test.tsx,pairing-live-static.test.ts}`,
`features/login/{login-model.ts,login-card.tsx}`, `features/login/live-login.test.tsx`,
`features/home/home-screen.tsx`, `features/settings/security-section.tsx`, `i18n/en.mobile.ts`,
`i18n/resources.ts`, `motion/builders.ts`, `apps/mobile/jest.setup.ts`.

**Named but not read**: the runtime files no row of this task changed (`runtime/internals.ts`,
`keep-awake.ts`, `resync-bus.ts`, `route-sync.ts`, `session-route-sync.tsx`,
`use-audio-shared-values.ts`, `testing/test-sim.tsx`), `auth/operators.ts`, `auth/auth-prefs.ts`,
`motion/prefs.ts`, and the two files checked only for blob equality
(`navigation/__tests__/guard.test.tsx`, `features/pairing/stack-check-service-name.test.tsx`); plus
every file under `packages/shared/src/live/` and `packages/shared/src/client/` (see §7 item 3).

---

**Verdict: PASS WITH FIXES — 0 open blockers, 3 Medium, 7 Low, 6 Info.** The mobile Live foundation
is safe to build the ten page rows on: the source decision is in one place, no simulated path
reaches the Core server, one module owns the secure store and three behaviour tests prove nothing
secret leaves it, the release bundle holds no Live source and no probe, and the React Compiler rules
are clean at 0 errors and 0 warnings. Fix CPM1-3 before W66 opens; keep CPM1-1 and CPM1-2 pinned to
W82's brief; send CPM1-11 and the `presented` flag to W100 with the web's security items.
