---
task_id: 2026-09-30_dems_demo_stack_setup
step: 40
checkpoint: CP-1
plan_row: 02_plan §4.1 W-02b rule, applied early (read-only senior review of the web and shared foundation)
reviewed_steps: 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 92, 93, 93b
date: 2026-10-01
agent: senior-code-reviewer
tier: 2
status: complete
verdict: PASS (0 open blockers)
---

# Step 40 (CP-1): Senior review of the web and shared foundation

## 0. Verdict

**PASS: 0 blockers, 8 major, 12 minor, 7 nits.** Steps 43 and 46–53 may start, subject to the mandatory page rules in §6.

- None of the findings stops a page step from building correctly. Each major finding has one of three things: a safe interim rule that the page step must follow (§6), an owning step later in the plan (mostly step 54), or a one-line controller ruling that is needed before a named step starts (M7 before step 53, M8 before steps 43 and 52).
- Overall rating: **APPROVED WITH COMMENTS**. The simulator core is well built: it is deterministic, platform-neutral, uses pure transitions with one `setState` per action, and has thorough tests. The weak spots are at the edges of the contract:
  - one unstable selector;
  - the simulator and the step-93 DEMO packages disagree, and their join key is ambiguous;
  - session commands have no RBAC check and audit rows can be attributed to the wrong operator;
  - the documented create-session schema is not enforced;
  - the core-web test glob silently ignores `*.test.ts`;
  - some shared state has no owner.

| Domain | Verdict | Issues |
|---|---|---|
| Code structure | PASS | 1 minor (m11) |
| Dependency impact | CAUTION | M5, M7; m12 |
| Duplication | CAUTION | M2; m5, m7 |
| Maintainability | CAUTION | m4, m8, m9 |
| Reference integrity (contract) | CAUTION | M1, M3, M4, M6 |
| Simulator: determinism, platform neutrality, SCR-01/02 | PASS | none |
| Security-relevant items | CAUTION | M5; n6, n7 |
| Dependency hygiene (D42 anchored greps, D45 routing) | PASS | none |
| Bundle split (static; no build allowed, P9) | PASS, to be re-measured in step 58 | m12 |
| Motion system (MS-01..03, ≤4 loops, reduced motion) | PASS | m10 |
| Licences and notices | CAUTION | m2 |
| Stub contract readiness for steps 42–53 | PASS | M8 (one missing shared state) |

Severity scale used here:
- **blocker**: must be fixed before the gated steps start, because no safe workaround exists.
- **major**: a real correctness, security or verification-integrity defect. It has an interim rule or a later owner, and must be closed before steps 56 and 58.
- **minor**: a maintainability risk, a drift risk or low user impact.
- **nit**: cosmetic, or already accepted.

## 1. Scope and method

**Reviewed:** everything listed below. No code was edited and no `npm install` was run. No Vite server was needed: the static reading plus Node probes answered every question, so port 5179 was never used.

- `packages/shared/src/{sim,api,i18n,brand,tokens,realtime,demo-data}/**`
- `packages/shared/scripts/**`
- the structure of `packages/shared/assets/{brand,hero,demo-media,demo-evidence}`
- `apps/core-web/src/{motion,components/{shell,ui,composed,media},routes,router.tsx,i18n.ts,main.tsx}`, plus `vite.config.ts`
- `THIRD_PARTY_NOTICES.md`
- implementation logs 08–20 and 64–66
- decisions D42–D69

**Method:**
1. Read the sources and logs above.
2. Mapped every Data item of `masterplan/01_specs.md` §14.5 and every SCR-01/SCR-02 item to an export (§4).
3. Ran the fresh checks listed in §7.
4. Ran four scratch Node probes (`node --import tsx`). They were written to the session scratchpad only and import the repository sources read-only:
   - selector stability;
   - i18n ↔ vocabulary coverage;
   - SECURE pill checklist vs `systemStatus()`;
   - simulated-API edge cases.
5. Ran Graft queries (`graft callers systemStatus`, `graft callers selectSystemState`, `graft grep "Suffix"`) for duplication and consumers.

## 2. Findings

Each finding lists its file:line evidence, why it matters, how it was verified, and the owning step.

### 2.1 Blockers

None.

### 2.2 Major

| ID | Domain | File:line | Finding and evidence | Why it matters | Recommendation | Owner |
|---|---|---|---|---|---|---|
| **M1** | Reference integrity (selector contract) | `packages/shared/src/sim/selectors.ts:223-257` (fresh `flags` array at L224, export at L257); `react.ts:67-70` (`useSim` = `useStore` + `useShallow`); contract comment `selectors.ts:2-4` | `selectSystemState` returns `{state, flags}` with a new `flags` array (of new objects) on every call. So the shallow comparison never matches, and `useSim(selectSystemState)` hits "getSnapshot should be cached" and then "Maximum update depth exceeded" (step 39 H-1, `20_compositions.md:88,257`). **Probe:** I called every single-argument `select*` export twice on one state in the idle, recording and fault-demo scenarios. Only `selectSystemState` fails `shallow()`. Consumers already work around it in three different ways: web `integrity-checks.ts:27-32` (selects `.state`); mobile `use-home-data.ts:44-48` (serialises flags to strings); mobile `home-model.ts:100-102` (regex-parses the English `message` "Time source …" to recover the source). Step 44, now in flight, uses `.state` correctly (`live-feed-panel.tsx:202`, via Graft) | The most obvious call for Dashboard A (§14.5.1 Data `systemState`, `flags`) crashes the page. The workarounds duplicate logic, and one of them depends on English copy | Step 54: make `selectSystemState` referentially stable, add `selectSystemStateValue` and `selectSystemFlagIds`, give `SystemFlag` structured `params`, export a finite `SYSTEM_FLAG_IDS`, and add a selector-stability test (spec §5.b). Interim rule R1 (§6) for every page | **54**; interim **42–53** |
| **M2** | Duplication / correctness | `apps/core-web/src/components/media/demo-media.ts:88-119` (`evidenceSuffixOf`, `evidenceMedia`); `packages/shared/src/demo-data/packages.generated.ts:1266,1270` | Step 39's web resolver builds evidence media URLs from the folder convention `demo-media/evidence/<NNNN>/<TRACK>`. It ignores the step-93 package index. For the TAMPERED item EV-0005, `evidenceMedia('0005')` returns the pristine `demo-media/evidence/0005/AUDIO-02.m4a`. The sealed package stores the altered copy at `demo-evidence/SESSION-SES-20260930-0015/media/AUDIO-02.m4a` (`altered: true`). For EV-0014 the resolver returns `null` (its test pins this, `20_compositions.md:198`), yet the package points at the live loops | If step 47 plays or hashes through `evidenceMedia()`, the tampered item shows PASS, which breaks the D50 demo moment and the step-58 check "tampered evidence shows FAIL". EV-0014 would have no media. There are now two sources of truth for media paths (P13: resolve through `@dems/shared/demo-data`) | Step 47 resolves **all** media, metadata, integrity and export URLs from `getDemoEvidencePackage(id)` (`tracks[].stored.path`, `files.*`, `export.*`), through one glob over `demo-media/**` and `demo-evidence/**` (F-93-1). It never uses `evidenceMedia()` for playback or hashing. Later: `evidenceMedia()` either delegates to the package paths or is documented as live-feed and thumbnail only. That needs a controller P6 hand-over, because step 39 owns `components/media` and is closed | **47**; follow-up **controller** |
| **M3** | Reference integrity (SIM-GAP-W1, D67 c) | `packages/shared/src/sim/dataset.ts:753` (`tampered: false` for every item); `initial-state.ts:235,251` (`ECDSA P-256`); `evidence.ts:60-120` (synthetic track and manifest hashes, `SIMULATED-SHA256`); `demo-data/types.ts:161,240` (`Ed25519`) | Three places where the simulator and the packages disagree: (a) EV-0005 is pristine in the simulator, so `actions.verify('EV-…-0005')` returns PASS and writes EVIDENCE_VERIFIED, while `verifyDemoPackage` and `precomputedReport` FAIL on `track:AUDIO-02`; (b) the Security & Audit key list says ECDSA P-256 while the package certificate and key are Ed25519 (DR-93-6); (c) the simulator's manifest and track hashes are synthetic (DR-93-5), so Dashboard D "Manifest hash" (`i18n/en/dashboard.ts` `activeSession.sealed.manifestHash`) will differ from the Evidence integrity tab for the same item | The demo contradicts itself on screen and in the audit trail (the audit log says "verified" while the UI shows FAIL). This is the trust story the demo exists to show | Step 54 does SIM-GAP-W1 as specified in §5.c: align the key algorithms and IDs, mark EV-0005 as tampered on AUDIO-02, add a demo-data alignment test, and apply the UI "package digests win" rule. Interim rules R2 and R3 (§6) | **54**; interim **47, 42** |
| **M4** | Reference integrity (join key) | `packages/shared/src/demo-data/index.ts:24-52` (`demoIdSuffix` ignores the date and the content); idle counters 24 / 8 / 14 (`13_sim_engine.md` §2.6); DR-93-3 | From idle, the next session the presenter creates is SES-…-**0024** and seals as EV-…-**0014**. Those are exactly the suffixes of the recording-scenario package (Ahmad Fauzi). A suffix-only join therefore attaches that package (its subject, media and an integrity PASS) to any session the presenter creates through Start New Session (AC-62 then AC-63) | Wrong metadata and media are shown for a real demo flow, and the integrity verdict is attributed to another interview | Step 47 (and mobile step 83) accept a package only when `pkg.caseNumber === item.caseNumber && pkg.subjectName === item.subjectName` (and the session suffix matches). Otherwise: no package, and the simulator's integrity labelled "simulated". Durable fix: one shared `joinDemoPackage(item)` in `@dems/shared/demo-data`, which needs a controller P6 hand-over (for example to step 54) | **47, 83**; durable **controller → 54** |
| **M5** | Security / RBAC / audit integrity | `packages/shared/src/sim/session-machine.ts:434,486,519,563,582` (`actorId: signedInOperatorId(state) ?? session.createdBy`); `:302-308` (idempotency before auth); `api.ts:379-423` (start and stop handlers) | `beginPrecheck`, `acknowledgePrecheckWarnings`, `startRecording`, `stopRecording` and `cancel` check neither sign-in nor permission. **Probe results:** a signed-out `POST /api/v1/session/{id}/stop` returns **202**, and RECORDING_STOPPED is attributed to **OPR-001**, the session creator; a TECHNICIAN stop also returns 202; a signed-out create with a different body returns 409 carrying the active session ID | Audit rows name an operator who did not act (§6.4, §20.1). The §14.7 role table gives start and stop to INVESTIGATOR and SUPERVISOR, not to TECHNICIAN. The UI guards make this hard to reach today, but the contract is wrong and the API Reference Try-it exposes it | Step 54 (spec §5.e): require a signed-in operator with SESSION_START for start, stop, cancel and acknowledge; take the actor only from the signed-in operator; move the auth checks ahead of idempotency; add 401/403 cases to the tests. Documenting 401/403 in OpenAPI for start and stop needs a controller hand-over of `api/core-api.ts`. Interim rule R4 | **54**; interim **44, 46, 53** |
| **M6** | Contract (D62 confirmed) | `packages/shared/src/sim/api.ts:349-366` (create handler); `session-machine.ts:194-209` (`isValidSessionInput`: case ≤ 64 characters); `api/session-schema.ts:76-79` (pattern `LP/YYYY/MMDD-NNNN`) | **Probe:** signed in, `POST /api/v1/session` with `caseNumber: "ABC"` returns **201**. The documented schema rejects it (F-33-1) | Try-it contradicts the OpenAPI document that sits next to it on the same page, and the UI path and the API path validate differently | Step 54 as specified in §5.d | **54** |
| **M7** | Verification integrity | `apps/core-web/vite.config.ts:19` (`include: ['src/**/*.test.tsx']`) | Blueprint rows 53 and 56 and 01_specs §14.13 name `src/test/scalar-config.test.ts` and `src/test/sim-fetch.test.ts`. Vitest never collects files with those names, and `vitest run` still exits 0 (no `*.test.ts` exists in core-web today: `find src -name '*.test.ts'` is empty) | AC-57 and AC-58 would "pass" without running, which is false verification evidence | A controller ruling **before step 53 starts**. Either (a) step 53 names the files `*.test.tsx` and records the drift, or (b) grant step 53 (or 56) the one-line edit `include: ['src/**/*.test.{ts,tsx}']`. Step 56 also asserts the list of collected test files | **controller → 53/56** |
| **M8** | Stub contract (shared state without an owner) | 01_specs §14.8 (Login Disclosure "hidden in presentation mode"), §14.5.8 (Demo Control Panel `Switch` "presentation mode"); `i18n/en/system.ts:99`; `sim/dataset.ts:130` | Presentation mode is read by Login (step 43) and set by System (step 52). No slice, hook or module holds it. P6 lets each page write only its own feature folder | Without a ruling, steps 43 and 52 will each invent storage (duplication or disagreement), or one will import the other's feature folder | Controller ruling before steps 43 and 52. Recommended: key `sessionStorage['dems.presentation'] = '1'`, read by step 43's `sim-adapter.ts` and written by step 52's, both logged as SIM-GAP. Step 54 then moves it into a simulator `settings.presentationMode` slice with a `setPresentationMode(on)` action, included in the snapshot, and removes both adapters | **controller → 43, 52 → 54** |

### 2.3 Minor

| ID | Domain | File:line | Finding and evidence | Recommendation | Owner |
|---|---|---|---|---|---|
| m1 | Maintainability (D52) | `packages/shared/test/i18n.test.ts:146-182` covers `src/domain` enums only | The i18n ↔ `sim/vocabulary.ts` sync test that D52 asked for does not exist. **Probe:** all 23 vocabulary-keyed maps are complete today. The only extras are the allowed ones: `evidenceStatus.PENDING`, and `IDLE` and `INCOMPLETE` in `enums.sessionState`. `DeviceCommand` is keyed in camelCase in `common.deviceMenu` | Add the test exactly as specified in §5.a | **54** |
| m2 | Licences | `THIRD_PARTY_NOTICES.md:73` ("never baked into the files"), `:77` (the hero "Used by" column) | The step-92 demo videos, posters and thumbnails are derivatives of the Pexels still with grading, drift and OSD **baked in**, and the mobile copies are too. The notices still say "only resized and re-encoded … never baked" and do not list demo-media or mobile media as uses. There is no eSpeak NG (GPL-3.0 tool) usage note and no "no macOS system voices" statement. Both exist only in `packages/shared/assets/demo-media/README.md` ("Provenance and licences"). The 13 copy-in items and the hero entry are complete (`:101-115`, `:77`) | Append a demo-media row: derived from Pexels 3906592; `packages/shared/assets/demo-media/**` and `apps/mobile/assets/media/**`; eSpeak NG 1.52.0 used as a tool (GPL output FAQ); ffmpeg as the encoder; no macOS voices (D51). Fix the preamble sentence. P6 lists no remaining writer, so it needs a controller hand-over (suggested: step 60), checked by step 62 | **controller → 60**; check **62** |
| m3 | Contract: Data gaps (§4) | `sim/types.ts:616-642` (no `caseType`); `:549-554` (no uptime); `:459-472` (no write-rate series); `:565-573` (system health series only) | Missing data: the Evidence "Case Type" filter (§14.5.3; route search `caseType`); the Services "uptime" column (`i18n/en/system.ts` `services.columns.uptime`; the SYSTEM_BOOT row can fall out of the 1000-row audit ring during a long demo); the SM S write-rate sparkline (already SIM-GAP-W44-1); per-device health series (Devices drawer); `settings` (§14.5.8) | Page steps log these as `SIM-GAP-W<step>-<n>` with adapters (47: caseType; 52: uptime and settings; 48: device series). Step 54 adds `EvidenceItem.caseType` (synthetic), `device.bootedAt`, and a bounded write-rate series | **47, 48, 52 → 54** |
| m4 | Maintainability (i18n contract) | `sim/types.ts:319-326` (`TimelineEvent.label/detail`), `SimAlert.message` (no params), `selectors.ts:211-216` (`SystemFlag.message`), `PrecheckItem.reason`, `DiagnosticCheck.label/detail` | The simulator emits English display strings with no structured parameters. UIs parse them (SIM-GAP-W44-2; mobile regex). `SimEvent` and `AuditRow` already carry `params` and `details` | Step 54 adds `params: Details` (and codes where missing) to these types. The §5.a test covers the matching i18n keys | **54** |
| m5 | Duplication / consistency | `apps/core-web/src/components/shell/integrity-checks.ts:34-60` | The SECURE pill checklist re-derives fault rules independently of `systemStatus()`. **Probe:** with POWER_FAIL injected at idle, the ring and pill show CRITICAL but every checklist row is OK. FAN_STALL maps to "recording" (`:56`). This makes three derivations of one rule set (the simulator, the web shell, and the mobile `flagLineFor`) | Step 54 adds `selectIntegrityChecklist(s)` to the simulator, including power. A controller hand-over then lets `integrity-checks.ts` consume it (the step-41 owner is closed) | **54 + controller** |
| m6 | Contract (never-throws) | `packages/shared/src/sim/api.ts:475` (`decodeURIComponent` sits outside the `try` at L477-483); docstring L458-461 | **Probe:** `sim.request({path: '/api/v1/session/%E0%A4%A/start'})` **throws** `URIError: URI malformed`. The contract says it never throws | Move the decode into the `try` and answer 400 `INVALID_PATH`. Interim: step 53's `simAwareFetch` wraps `sim.request` in try/catch and returns a 400 `Response` | **54**; interim **53** |
| m7 | Duplication | Suffix parsing ×4: `demo-data/index.ts:30` `demoIdSuffix`, `core-web media/demo-media.ts:88` `evidenceSuffixOf`, `mobile features/dashboard/home-model.ts:255` `idSuffix`, mobile `media/demo-media.ts:258` (Graft `grep "Suffix"`). Excerpt rule `p mod L`: web `demo-media.ts:133-138`, and mobile again. dBFS thresholds: web `composed/dbfs-meter.math.ts:7`, mobile `composed/dbfs-meter.math.ts:8`. Web and mobile each have their own GlowRing math. `media/use-sim-clock.ts:20-39` `useSimSecond` duplicates `useSim(selectClockSecond)` (`shell/top-bar.tsx:131-136`) | The same pure helpers are re-implemented across web, mobile and shared. Each copy is tested against the spec literal, so drift risk is low today, but new pages would add more copies | New page code reuses `demoIdSuffix` and `getDemoEvidencePackage`, and `useSimSecond` or `selectClockSecond` (R8, R9). Moving the pure meter, ring and excerpt maths into `@dems/shared` is deferred: record it as accepted debt, or give it to step 91 with a hand-over | **42–53** (reuse); **controller** (debt) |
| m8 | Maintainability (error types) | `packages/shared/src/sim/errors.ts:19-31` (English `detail` only), `:6-16` (`SimNotImplementedError` is exported but never thrown, S32-18) | UI toasts must be localised, but errors carry no machine-readable reason (short stop reason vs illegal state vs checks still running) | Add `readonly code: 'ILLEGAL_STATE' \| 'REASON_TOO_SHORT' \| 'NOTE_INVALID' \| 'CHECKS_RUNNING' \| 'SESSION_ACTIVE_UPDATE' \| 'POLICY_RANGE'`, and remove or deprecate `SimNotImplementedError`. Interim: pages pre-validate (reason ≥ 5, note 1–2000 characters) and use a generic toast key | **54**; interim **44, 46** |
| m9 | Performance (§9.3: ≤ 1 Hz for clocks) | `selectors.ts:57-62` (`selectElapsedMs`), `:47` (`selectLockout` → `retryInMs`) | Both change on every 100 ms clock tick, so a component that uses them re-renders at 10 Hz | Pages derive whole seconds inside the selector (`(s) => Math.floor(selectElapsedMs(s) / 1000)`). Step 54 adds `selectElapsedSeconds` and `selectLockoutSeconds` | **42, 43, 44**; **54** |
| m10 | Motion (ambient cap, reduced motion) | `apps/core-web/src/components/ui/border-beam.tsx:100-105` (`repeat: Infinity` on `offsetDistance`, no `useAmbientLoop`); `features/home/home-page.tsx:95` | BorderBeam is a verbatim, unregistered infinite loop. `MotionConfig reducedMotion="user"` does not stop `offsetDistance`. Only `SecurePill` gates it (`secure-pill.tsx:157-170`). `/stack-check` runs it always, including under reduced motion | Step 43 (Login "one lap on entry"): `transition={{ repeat: 0 }}`, mounted only when `useMotionPolicy().ambient`. Any other consumer mounts it only while a `useAmbientLoop` slot is `running`. `/stack-check`: the controller either accepts it as a diagnostic page outside AC-70 or assigns a gate | **43**; **controller** |
| m11 | Code structure (layering) | `packages/shared/src/api/core-api.ts:34,48`, `api/session-schema.ts:24`; claim in `sim/index.ts:4-5` | The root barrel pulls in `sim/vocabulary` and `sim/constants` through `api`. Both are leaf modules with no imports (verified), so mock-core stays free of React and zustand, but "root never loads the simulator" is not literally true. D62's fix would add a sim → api edge (a directory cycle, though not a runtime cycle) | Step 54 imports `sessionCreateSchema` only in `sim/api.ts` (and in `session-machine.ts` if §5.d option 1 is chosen), and documents the leaf-only rule. A cleaner fix, moving `SubjectType` and `RecordingProfileId` into `src/domain`, needs a hand-over of `api/session-schema.ts` | **54** |
| m12 | Bundle (AC-73; static only) | `apps/core-web/src/routes/__root.tsx:20` (`HEALTH_QUERY_KEY` from the `@dems/shared/api` barrel); `packages/shared/src/demo-data/{packages,documents}.generated.ts` (140 KB and 129 KB raw) | (a) The api barrel's module-level zod schemas (`core-api.ts`, 92 `z.` calls) are not provably pure, so they are probably retained in the entry chunk. (b) `@dems/shared/demo-data` re-exports both generated modules, so any import from it costs about 270 KB raw. (c) Importing the `@/components/media` barrel from the shell would pull the demo-media URL map into the entry chunk. Baseline (the 03:21 step-38 build, before steps 39, 41 and 33): entry 164,431 B gzip -9, no `scalar`, no `.mp4` | Step 58 re-measures AC-73. Steps 47 and 53 import demo-data only inside their lazy feature chunks. The shell never imports media or composed barrels. Optional: `"sideEffects": false` in the shared `package.json` (needs a P1 serial slot) | **58, 47, 53**; optional **controller** |

### 2.4 Nits

| ID | File:line | Item | Owner |
|---|---|---|---|
| n1 | `packages/shared/src/tokens/tokens.ts:62` | "Stop Session" in a code comment (D52: left as is unless touched) | accepted |
| n2 | `sim/session-machine.ts:352-390` (`evaluatePrecheck`) | Lens "configurable block" (book §5.3) is hard-coded to BLOCK; no policy object. Optional: export `PRECHECK_POLICY` | 54 (optional) |
| n3 | `session-machine.ts:381-382` | The book calls Time Sync informational. The simulator returns WARN, which needs acknowledgement (the 01_specs G8 demo policy, accepted). A tooltip could say so | 46 |
| n4 | `session-machine.ts:354-355`; `i18n/en/session-new.ts:61` | The CORE check follows `tabletLink` (correct for the tablet, MA-10). On the Core console the "Core Machine" row would read OFFLINE when only the tablet is offline, and mock-core's heartbeat is ignored | 46 (label or copy) |
| n5 | `apps/core-web/src/routes/_app/session/new.tsx:15-19` | The guard checks RBAC only. With an active session the page must send the operator to `/session`, not start a second session (S26) | 46 |
| n6 | `packages/shared/test/demo-evidence.test.ts:253` | The no-private-key check greps for "PRIVATE KEY" only. As defence in depth, also assert that the 32-byte seed hex never appears in any output | 56 or 62 |
| n7 | `sim/auth.ts:353-365` (`restoreAuth`) | Any `{operatorId, issuedAt}` in `sessionStorage['dems.auth']` signs in (by design: P4 seeding in a client-only demo). Record as accepted for the security review | 62 (record) |

## 3. Focus areas: answers

| Question | Answer and evidence |
|---|---|
| Determinism | **PASS.** No `Math.random`, `crypto.` or `randomUUID` under `src/sim` (grep exit 1). mulberry32 streams are keyed by seed, salt and epoch (`rng.ts`). AC-51 test exists (`test/sim-determinism.test.ts`, 8 tests). A wall-clock start is intentional (dates never go stale); tests use `createManualClock` |
| State machine vs book §6.2 / §5.3 | **PASS with notes.** Every §14.7 row is implemented (`session-machine.ts`; AC-52 has 27 tests). Accepted additive drifts: S32-4 (STOPPING can fault), S32-6 (idempotent for any non-SEALED session, per §5.6). RECOVERY never seals (SYS-008). Book §6.4 rule 4 is honoured (FINALIZING → FAULT). The §5.3 gate follows the 01_specs G8 policy (n2, n3, n4). Missing: RBAC and actor checks on commands (M5) |
| Error types | Four classes (`errors.ts`). Actions that return results report refusals in the result, not by throwing. `SimNotImplementedError` is dead code. No machine-readable reason code (m8) |
| Selector stability, and is a stable selector needed? | **Yes** (M1). Only `selectSystemState` is unstable (probe). Dashboard A needs the flags, and three consumers already work around it. Spec in §5.b |
| Dependency hygiene | **PASS.** D42 anchored greps give `react@19.2.3`, `react-dom@19.2.3` and `react-native@0.86.3` (one of each). `npm ls @scarf/scarf` is `(empty)`. The §14.1 pins are exact (zustand 5.0.15, @noble/hashes 2.4.0, @scalar/openapi-parser 0.29.9, @scalar/api-reference-react 0.9.76, i18next 26.4.2, react-i18next 17.0.15, zod 4.6.5). No `@scalar` import exists anywhere yet. The Scalar advisories are routed by D45 to step 53 (agent and AI features off), 62 and 63 |
| Bundle split | **PASS (static).** No Scalar import. Demo media is imported only by `components/media`, which only pages import. The debug overlay is a lazy chunk (`motion/debug-overlay-gate.tsx:5`). Hazards and the re-measure are in m12 |
| Motion (MS-01..03, ≤ 4 loops, reduced motion) | **PASS.** MS-01 and AC-72 grep: no output. MS-02 grep: no output. MS-03: no `will-change`; the only `willChange` is on the GlowRing rotating group (`glow-ring.tsx:355`), an allowed place per §9.3. The registry caps at `ambientMaxPerViewport` (4), page loops win over shell loops, and groups share a slot (`motion/ambient-registry.ts:53-115`). Reduced motion comes from the OS, the in-app override or `?motion=off` (`policy.ts:68-77`), and CSS loops stop under `data-motion="reduced"` (`motion.css`). Static `boxShadow` sits on pre-rendered layers and only opacity animates. Exception: m10 |
| Security items | DEMO key: derived in memory, never written (`scripts/gen-demo-evidence.ts:350-358`). The index labels the seed phrase and the notice DEMO. The certificate subject reads "DEMO — NOT FOR PRODUCTION". The repository holds 14 `device-certificate.pem` files, all `BEGIN CERTIFICATE`, with no `PRIVATE KEY` outside the test guard and the generator's leak check. External requests: none in web code (URLs appear only in attribution comments and SVG `xmlns`). No CDN or Google Fonts (fonts are `@fontsource-variable`, `main.tsx:1-3`). Network constants are loopback only (`api/constants.ts`). AC-50: `dems.auth` holds `{operatorId, issuedAt}` only. The snapshot excludes `auth`. The Login stub clears the password after every attempt (`features/login/index.tsx:31`). No `dangerouslySetInnerHTML` or `innerHTML`. The redirect search param is guarded against open redirects (`routes/-search.ts:34-39`). The open item is M5 |
| Licences and notices | 13 copy-in items with URL, upstream SHA-256 and licence, and the hero photo, are complete. The demo-media derivation, the eSpeak NG note and the no-macOS-voices statement are missing (m2) |
| i18n ↔ vocabulary sync (D52) | Specified in §5.a; owner is step 54 |
| SIM-GAP-W1 (D67) | Specified in §5.c; owner is step 54 |
| Create-session validation (D62) | Confirmed by probe (M6); specified in §5.d; owner is step 54 |
| Stub contract for steps 42–53 | **PASS.** `19_app_shell.md` §2 (binding per D60) lists the export name, root test ID and owner for every page. Route files hold only `createFileRoute` and `validateSearch`. `getRouteApi` is the pattern for params. The composition APIs are in `20_compositions.md` §2. The one missing shared state is M8 |

## 4. §14.5 Data column and SCR-01 / SCR-02 → export map

Status key:
- **OK**: a named export exists.
- **OK-raw**: read a store slice directly with `useSim((s) => s.<slice>)`. Slices are store-owned references, so this is shallow-stable.
- **CAVEAT**: exists, but with a finding.
- **GAP**: no data yet. Log it as SIM-GAP and add a sim-adapter.

All exports come from `@dems/shared/sim` unless another module is named.

### 4.1 Dashboard (§14.5.1)

| Panel | Data item | Export | Status |
|---|---|---|---|
| A | `systemState` | `selectSystemState(s).state` (select `.state` only) | CAVEAT M1 |
| A | `flags` | `selectSystemState(s).flags` (unstable; no web i18n keys for the flag IDs) | CAVEAT M1, m4 |
| B | recording copy | `selectIsRecording`, `selectSession` | OK |
| C | `cameras`, `mics`, `storage` | `selectCameras`, `selectMics`, `selectDeviceStats`, `selectStorage` | OK |
| C, G | `time`, `security`, `network` | `s.time`, `s.security`, `s.network` | OK-raw |
| D | `session` | `selectSession`, `selectSessionState`, `selectElapsedMs` (m9), `selectPrecheck` (setup progress), `selectFinalization`, `selectLastSealedSession`, `selectEvidenceBySessionId`, `selectSessionHistory` ("start with last profile") | OK |
| D | sealed "Manifest hash" | `EvidenceItem.manifestHash` (synthetic) vs the package digest | CAVEAT M3 |
| E | `cameras`, audio (transient), device menu | `selectCameras`, `useAudioChannel`, `actions.deviceCommand` | OK |
| F | `storage` | `selectStorage` (usedPercent 20, freeBytes; AC-75) | OK |
| H | `sealedHourly[24]`, `sealedToday` | `selectSealedHourly`, `selectSealedToday` (7 at load, D61) | OK |
| I | `events` (latest 6) | `selectRecentEvents(s, 6)` (`message` in English plus `params`) | OK |
| J | RBAC | `selectCan(s, Permission.X)` | OK |

### 4.2 Session Monitor (§14.5.2)

| Panel | Data item | Export | Status |
|---|---|---|---|
| K | `session.state`, worst alert | `selectSessionState`, `selectWorstAlert` | OK |
| L | `session`, `activeCameraId` | `selectSession`; `s.activeCameraId` with `actions.setActiveCamera` | OK-raw |
| M | `session` | `selectSession`, `selectElapsedMs` | OK (m9) |
| N | `security`, `audit.chainHead` | `s.security`, `selectChainHead`, `s.storage.lastWriteVerifiedAt`, `s.time` | OK |
| O, R | audio channel, `cameras` | `useAudioChannel`, `selectCameras` | OK |
| P | actions | `actions.addMarker`, `addNote`, `snapshot`, `stopRecording` | CAVEAT M5, m8 |
| Q | `session.timeline` | `selectTimeline` (English label and detail) | CAVEAT m4 (SIM-GAP-W44-2) |
| S | `storage`, `session` | `selectStorage`, `session.bytesWritten`; no write-rate series | GAP m3 (SIM-GAP-W44-1) |
| T | `audit` (latest 12) | `selectAuditTail(s, 12)` | OK |
| Finalization overlay | `session.finalization` | `selectFinalization` | OK |

### 4.3 Evidence (§14.5.3)

| Region | Data item | Export | Status |
|---|---|---|---|
| Header and KPIs | `evidenceStats` | `selectEvidenceStats` (total 13, sealed 10, pending 1, sealedToday 7) | OK |
| Toolbar | Case Type | none | GAP m3 |
| Toolbar | Investigator, dates | `s.operators`; `EvidenceItem.investigatorId`, `recordedAt` | OK |
| Table | `evidence` | `selectEvidence` (13 rows, so page 2 exists); thumbnails from the demo-data package | OK |
| Detail | `evidenceById` | `selectEvidenceById`; `lifecycleStage`; `custody` | OK |
| Detail tabs | Media, Metadata, Integrity | `getDemoEvidencePackage`, `verifyDemoPackage`, `getDemoEvidenceDocuments` (`@dems/shared/demo-data`); `actions.verify` | CAVEAT M2, M3, M4 |
| Detail actions | export, archive | `actions.exportEvidence` (202/401/403/404/409/422); package `export.zip` (EV 0004 only); `actions.archiveEvidence` | OK |

### 4.4 Devices, Storage, Network & Time, Security & Audit (§14.5.4–§14.5.7)

| Page | Data item | Export | Status |
|---|---|---|---|
| Devices | `cameras`, `mics`, audio | `selectCameras`, `selectMics`, `useAudioChannel` | OK |
| Devices | `deviceStats`, `tabletLink`, `deviceById` | `selectDeviceStats`, `selectTabletLink`, `selectDeviceById` | OK |
| Devices | `otherDevices`, `ports` | `s.otherDevices`, `s.ports` | OK-raw |
| Devices | drawer Log | `s.events` / `s.audit.rows` filtered by `deviceId` | OK-raw |
| Devices | drawer Health (per device) | none | GAP m3 |
| Storage | `storage` | `selectStorage` plus `s.storage.writeBytesPerSec` and `bitrateMbps` | OK |
| Storage | `storage.history`, `storage.volumes` | `s.storage.history` (24 points), `s.storage.volumes` | OK-raw |
| Storage | `sealedHourly` | `selectSealedHourly` | OK |
| Storage | `events` filtered to storage | `SimEvent` has no category: filter by type, or use audit category STORAGE | CAVEAT (minor) |
| Storage | `storagePolicy` | `selectStoragePolicy`, `actions.setStoragePolicy` | OK |
| Network & Time | `clock` | `selectClockSecond` | OK |
| Network & Time | `time`, `time.history`, `network`, `network.domains` | the matching raw slices | OK-raw |
| Security & Audit | `security.posture`, `security.controls` | the matching raw slices | OK-raw |
| Security & Audit | `audit` | `s.audit.rows` (with category and hashes) | OK-raw |
| Security & Audit | `audit.chain` | `actions.verifyAuditChain`, `selectAuditChainBreak`, `selectChainHead` | OK |
| Security & Audit | `security.keys` | `s.security.keys` (ECDSA vs Ed25519) | CAVEAT M3 |
| Security & Audit | `auth.role`, export audit | `selectRole`, `selectCan`, `actions.exportAudit` | OK |

### 4.5 System & Maintenance (§14.5.8)

| Region | Data item | Export | Status |
|---|---|---|---|
| Services | `services` | `s.services` | OK-raw |
| Services | uptime column | none | GAP m3 |
| Health | `health.series` | `s.health.series` | OK-raw |
| Software update | `update` | `selectUpdate`, `actions.startSoftwareUpdate` | OK |
| About | `device.identity` | `s.device.identity` | OK-raw |
| Settings | `settings` | none (UI-local is acceptable; the reduce-motion switch uses motion `setReducedOverride`, D59) | GAP m3 |
| Demo Control Panel | inject, scenario, reset | `actions.inject`, `clearFault`, `resetClip`, `loadScenario` | OK |
| Demo Control Panel | presentation mode | none | GAP M8 |
| Run Diagnostics | diagnostics | `actions.runDiagnostics`, `selectDiagnostics` | OK |

### 4.6 Start New Session, Login and API Reference (§14.5.11, §14.8, §14.9)

| Area | Data item | Export | Status |
|---|---|---|---|
| Session Info (step 1) | form | `sessionCreateSchema` (`@dems/shared/api`), `OPERATORS`, `ROOMS`, `RECORDING_PROFILES`, `caseNumberFor(s.meta.counters.caseNumber, now)`; step 46 adds 5 message keys (S33-5) | OK |
| Devices Check (step 2) | `sim.precheck()` | `actions.beginPrecheck`, `selectPrecheck`, `evaluatePrecheck` (live preview), `acknowledgePrecheckWarnings`, `retryPrecheck` | OK |
| Ready (step 3) | start and cancel | `actions.startRecording`, `actions.cancel` | CAVEAT M5 |
| Login | sign-in paths, lockout, expiry | `signIn` and `signInWithSecurityKey` (return `SignInResult`), `selectLockout` (m9), `AuthStatus.EXPIRED`, idle expiry (15 min; the shell calls `actions.touch()`, `app-shell.tsx:103`) | OK |
| Login | Core offline | `useHeartbeat` | OK |
| Login | Demo operators Disclosure | `OPERATORS`, `DEMO_OPERATOR_PASSWORD` | OK |
| Login | presentation mode | none | GAP M8 |
| API Reference | document and Try-it | `createOpenApiDocument()` (`@dems/shared/api`, D62), `sim.request` (m6, M5, M6), `hasActiveSession`, `DEMO_EVIDENCE_INDEX.apiExamples`, `@dems/shared/theme/scalar.css` | CAVEAT m6, M5, M6 |

### 4.7 SCR-01 (the surface the mobile lane consumes)

| Request | Export and evidence | Status |
|---|---|---|
| `storage` adapter (`PersistStorage`; web default) | `CreateSimOptions.storage` (`types.ts:146`); `createDefaultPersistStorage` (`platform.ts`) | OK |
| `visibility` adapter `{isHidden, subscribe}` | `CreateSimOptions.visibility` (`types.ts:150`); `ALWAYS_VISIBLE` fallback | OK |
| `ready: Promise<void>` after hydration | `Sim.ready`, `isReady`, `useSimReady` (`engine.ts`, `react.ts:77-91`) | OK |
| No unguarded web globals; IDs from the seeded RNG | The grep finds only 4 guarded `platform.ts` lines (34, 35, 41, 52); none of `randomUUID`, `crypto.` or `Math.random` | OK |
| Audio frames are plain numbers and booleans | `AudioFrame` (`types.ts:428-439`) | OK |
| `test/sim-platform-neutral.test.ts` | exists (8 tests; part of the shared suite, 393/393) | OK |

Mobile consumes all of it: step 73 PASS, D66.

### 4.8 SCR-02

| Request | Export and evidence | Status |
|---|---|---|
| `pairing` slice, `pair(code)`, `unpair()` with audit rows | `PairingSlice` (`types.ts:251-259`), `selectPairing`, `actions.pair`/`unpair`; rows PAIRING_SUCCESS, PAIRING_FAILED, PAIRING_LOCKED and UNPAIRED | OK |
| `signInWithBiometric(operatorId)`, audit method BIOMETRIC | `actions.signInWithBiometric`; `test/auth.test.ts` asserts `details.method === 'BIOMETRIC'` | OK |
| `lastSealedSessionId` + `acknowledgeSummary(id)` | state fields; `selectPendingSummaryId`, `selectLastSealedSession`, `actions.acknowledgeSummary` (SUMMARY_ACKNOWLEDGED) | OK |
| `sessionHistory` including incomplete sessions | `selectSessionHistory` (newest first; 13 entries at load, 1 INCOMPLETE) | OK |
| `setTabletLink(state)` input | `actions.setTabletLink` (TABLET_LINK_CHANGED audit row and event; OFFLINE → CORE BLOCK) | OK (n4 on web) |

SCR-03..07 (outside the table requirement, checked for completeness):
- SCR-03: `@dems/shared/brand` emblem plus 3 PNGs in `assets/brand/`.
- SCR-04: `assets/hero/room-1600.jpg`.
- SCR-05: the `./i18n` export and an arithmetic `formatDate` (no `Intl` anywhere in shared or web).
- SCR-06: `TOPO_SVG`.
- SCR-07: spring tokens, covered by `test/motion-tokens.test.ts`.

All present.

## 5. Specifications for step 54 (the W-02 owner)

### 5.a i18n ↔ `sim/vocabulary.ts` sync test (D52; the reviewer specifies it, step 54 adds it)

**File:** `packages/shared/test/i18n-vocabulary-sync.test.ts`. It imports `* as V from '../src/sim/vocabulary'` and `{ en } from '../src/i18n'`. Domain enums are already covered by `i18n.test.ts:146-182` and must not be repeated.

**Helper:** `expectExactKeys(name, values: string[], map: Record<string, string> | undefined, allowExtra: string[] = [])`. It asserts four things:
1. The map exists; a missing path fails with its dotted path.
2. Every value is a key whose value is a non-empty string.
3. Every key is a value or appears in `allowExtra`.
4. No key is a `_one` or `_other` plural fragment of a vocabulary value.

**Pairs.** Step 54 re-reads the final namespace files after steps 42–53 and updates any path a page step moved:

| Vocabulary | i18n path(s) | allowExtra |
|---|---|---|
| `OperatorRole` | `common.roles` | none |
| `SubjectType` | `common.subjectType`, `common.subjectTypeGloss` | none |
| `EvidenceStatus` | `common.evidenceStatus` | `PENDING` |
| `PrecheckStatus` | `common.precheckStatus` | none |
| `Severity` | `common.severity` | none |
| `SessionOutcome` | `common.sessionOutcome` | none |
| `VerificationStatus` | `common.verificationStatus` | none |
| `AuthMethod` | `common.authMethod` | none |
| `PairingState` | `common.pairingState` | none |
| `TabletLinkState` | `common.tabletLinkState` | none |
| `ServiceStatus` | `common.serviceStatus` | none |
| `DiagnosticStatus` | `common.diagnosticStatus` | none |
| `UpdateState` | `common.updateState` | none |
| `FaultKind` | `common.faultKind`, `system.demo.faults` | none |
| `SystemState` | `common.systemState`, `dashboard.systemRing.caption`, `dashboard.systemRing.ariaLabel` | `UNKNOWN` |
| `SecurityPosture` | `common.posture` | none |
| `AuditType` | `common.auditType` | none |
| `AuditCategory` | `common.auditCategory` | none |
| `SimEventType` | `common.eventType` | none |
| `PrecheckCheckId` | `sessionNew.devices.checks` | none |
| `TimelineKind` | `session.timeline.kind` | none |
| `RetentionPolicyId` | `storage.manage.policies` | none |
| `ScenarioName` | `system.demo.scenarios` | none |
| `DeviceCommand` | `common.deviceMenu`, through an explicit map `{TEST_SIGNAL: 'testSignal', RESTART: 'restart'}` (the keys are camelCase today) | the other menu keys |
| `SYSTEM_FLAG_IDS` (new, §5.b) | the flag namespace chosen for §5.b (`common.systemFlag`, or `dashboard.systemRing.flag` if no hand-over of `common.ts` is granted) | none |

**Evidence to record in the log:**
- A mutation check: delete `common.auditType.SYSTEM_BOOT` in a scratch copy and show that the test fails, then restore it and show it passes.
- Today's probe result: every pair passes, apart from the listed extras and the DeviceCommand key style.

### 5.b Stable system-state selectors (M1)

1. `selectSystemState` returns **the same object** while its inputs are referentially equal. Use a single-entry memo on `[s.session, s.faults, s.storage, s.security, s.cameras, s.mics, s.time, s.health, s.tabletLink]`, plus structural reuse: when the recomputed `{state, flags}` deep-equals the previous result, return the previous object. Returning a cached result only for identical input references is correct across several sim instances.
2. Add `selectSystemStateValue(s): SystemState` and `selectSystemFlagIds(s): string[]`.
3. `SystemFlag` gains `params: { track?: TrackId; source?: TimeSource; name?: string }`. Export a finite `SYSTEM_FLAG_IDS`: the fixed IDs plus `CAMERA_VIDEO-01`, `CAMERA_VIDEO-02`, and `MIC_AUDIO-0{1,2}_{NO_SIGNAL,CLIP}`. Consumers then never parse `message`. Step 91 removes the mobile regex parser (`home-model.ts:100-102`) and the `statusKey` serialiser.
4. Test `packages/shared/test/sim-selector-stability.test.ts`:
   - for the idle, recording and fault-demo scenarios, and for every exported `select*` of arity 1, `shallow(sel(s), sel(s)) === true`;
   - after `sim.tick()` changes only `audio` and `clock`, `expect(selectSystemState(next)).toBe(selectSystemState(prev))`.
5. Optional: a development-only guard in `useSim` (`react.ts`). It calls the selector twice on the same state and, when `!shallow`, warns once with `selector.name`.
6. Optional: `selectIntegrityChecklist(s)`, including POWER_FAIL (m5).

### 5.c SIM-GAP-W1 (D67 c): align the simulator with the DEMO packages without importing demo-data into `src/sim`

Do **not** import `@dems/shared/demo-data` into `src/sim`. `main.tsx` imports the simulator into the entry chunk, so that would add about 270 KB raw (AC-73). It would also force a step-93 re-run, because the audit extracts are generated from simulator rows (DR-93-5).

1. **Keys** (`initial-state.ts:231-256`):
   - `DEVICE_CERT` → `algorithm: 'Ed25519'`, label "Device certificate (DEMO)", fingerprint equal to the DEMO certificate SHA-256.
   - `EVIDENCE_SIGNING_KEY` → `algorithm: 'Ed25519'`, `id` or label carrying `DEMO-KEY-EVSIGN-01`, fingerprint derived from the DEMO public key.
   - The TLS key stays "ECDSA P-256 (simulated)".
   - The fingerprint constants live in the simulator's `constants.ts`. The test below guards them against the index, which satisfies P13 ("never hard-code hashes" is enforced by the test).
2. **Tamper state** (`dataset.ts`): EV-0005 → `tampered: true, tamperedTrackId: 'AUDIO-02'` at load. Then `verify('EV-…-0005')` fails on exactly AUDIO-02 (EVIDENCE_VERIFY_FAILED), which matches `precomputedReport`. Update the pinned tests (`sim-contract`, `hash-chain`) and the mobile tests.
3. **Displayed hashes:** keep the simulator's synthetic hashes. Adopt and document the UI rule: *when a package joins (under the M4 guard), every displayed track hash, manifest digest, signature and verdict comes from the package; the simulator's values appear only for items without a package, labelled "simulated"*. This covers Dashboard D (sealed), the Evidence detail and SM N.
4. **Test** `packages/shared/test/sim-demo-data-alignment.test.ts` (a test-time import of demo-data is fine). With a manual clock at `DEMO_EVIDENCE_INDEX.asOf`, create an idle sim. For every package whose origin is DATASET:
   - an item with the same evidence suffix exists, with equal `caseNumber`, `subjectName`, `subjectType`, `investigatorId`, `status`, `tampered` and `tamperedTrackId`;
   - `security.keys` DEVICE_CERT and EVIDENCE_SIGNING_KEY algorithms equal the index `certificate` and `key` algorithms, and the fingerprints match;
   - for the RECORDING_SCENARIO package, sealing the recording scenario yields that evidence suffix and the same case number and subject.
5. Then remove the SIM-GAP-W1 adapters that steps 47 and 42 logged.

### 5.d Create-session validation (D62, F-33-1; M6)

1. **`sim/api.ts` handler for `POST /api/v1/session`,** in this order:
   1. not signed in → 401 `NOT_SIGNED_IN`;
   2. no SESSION_START → 403 `NOT_PERMITTED`;
   3. `sessionCreateSchema.safeParse(body)` fails → 422 with the unchanged `ApiErrorBody` shape `{error:{code:'INVALID_INPUT', message:'<path>: <i18n key>'}}`, using the first issue;
   4. `actions.createSession(parsed.data)` → 201, 200 (same body) or 409.
2. **`createSessionTransition`** (`session-machine.ts:296-323`): move the auth checks ahead of the idempotency branch (L302). Keep `isValidSessionInput` for "the investigator exists and holds SESSION_START". **Option 1 (recommended):** also run `sessionCreateSchema.safeParse` there, so the UI and API paths agree. The case number then changes from "≤ 64 characters" to the pattern, so record a controller note against D61's "limits stay stable". No consumer calls `createSession` yet (grep).
3. **Layering (m11):** import only from `../api/session-schema`. It is leaf-safe: it imports `sim/vocabulary`, `api/patterns` and zod.
4. **Tests** (new `test/sim-api-validation.test.ts`; extending `openapi.test.ts` needs a hand-over of step 33's file):
   - signed in, `caseNumber: 'ABC'` → 422 `INVALID_INPUT`;
   - signed out, valid body while a session is active → 401 (not 200 or 409);
   - TECHNICIAN → 403;
   - valid → 201, then the same body → 200;
   - every response passes `validateCoreApiResponse`.

### 5.e Session-command RBAC and audit attribution (M5)

1. `beginPrecheck`, `acknowledgePrecheckWarnings`, `retryPrecheck`, `startRecording`, `stopRecording` and `cancel` require a signed-in operator with `SESSION_START`. A void action throws `SimPermissionError`; the API returns 401 or 403.
2. For user actions, `actorId` is always the signed-in operator. Remove the `?? session.createdBy` fallback at `session-machine.ts:434,486,519,563,582`. Engine-timed transitions (auto-arm after PASS) may keep `createdBy`, labelled `details.by: 'system'`.
3. Documenting 401/403 for `startSession` and `stopSession` in OpenAPI needs a controller hand-over of `api/core-api.ts`. Otherwise, record it as a documented deviation.

### 5.f `sim.request` never throws (m6)

Move `decodeURIComponent` (`api.ts:475`) inside the `try`, and map `URIError` to 400 `INVALID_PATH`. Add a test with `%E0%A4%A`.

## 6. Mandatory rules relayed to the page steps

These are binding before and during steps 42–53, including step 44, which is already running.

| # | Applies to | Rule |
|---|---|---|
| R1 | all pages, especially 42, 43, 46, 51, 52 | Never `useSim(selectSystemState)`. Use `useSim((s) => selectSystemState(s).state)` and `useSim((s) => selectSystemState(s).flags.map((f) => f.id))`. Any inline selector returns primitives, or arrays and objects whose members are store-owned references: a nested fresh object loops (M1) |
| R2 | 47 (and 83 on mobile) | Resolve media, metadata, integrity and export files only through `getDemoEvidencePackage(item.id)` paths (`tracks[].stored.path`, `files.*`, `export.*`), with one glob over `demo-media/**` and `demo-evidence/**`. Never call `evidenceMedia()` for playback or hashing (M2). Apply the join guard `pkg.caseNumber === item.caseNumber && pkg.subjectName === item.subjectName` (M4). Until step 54 aligns EV-0005, do not show `actions.verify()`'s verdict as the integrity result for package-backed items, and log `SIM-GAP-W47-n` (M3). Label precomputed checks "DEMO - precomputed" (P13) |
| R3 | 42 | Dashboard D (sealed) shows the package manifest digest when a guarded package joins; otherwise the simulator hash labelled "simulated" (M3). Import demo-data only if needed (it stays in the lazy dashboard chunk) |
| R4 | 44, 46, 53 | Gate End Session, Start, Cancel and Acknowledge on `selectCan(s, Permission.SESSION_START)` until step 54 enforces it (M5). Pre-validate the stop reason (≥ 5 characters) and notes (1–2000 characters) so no English `SimTransitionError` text reaches a toast (m8). Step 46 sends the operator to `/session` when a session is already active (n5) |
| R5 | 43, 52 | Presentation mode follows the controller's M8 ruling |
| R6 | 53 | Name tests `*.test.tsx`, or wait for the include ruling (M7). Wrap `sim.request` in try/catch (m6). Use `content: createOpenApiDocument()` (D62) and the D45 privacy and agent flags. Keep every `@scalar` import and the demo-data import inside `features/api-reference` (AC-73) |
| R7 | 43 | BorderBeam "one lap on entry": `transition={{ repeat: 0 }}`, mounted only when `useMotionPolicy().ambient` (m10) |
| R8 | all | 1 Hz UI through `selectClockSecond` or `useSimSecond`. Derive whole seconds inside selectors for elapsed time and lockout countdowns (m9) |
| R9 | all | Reuse `demoIdSuffix` and `getDemoEvidencePackage` (`@dems/shared/demo-data`); write no new ID-suffix parser (m7). Never import the `@/components/media` or `@/components/composed` barrels from the shell (m12) |
| R10 | all | Log gaps as `SIM-GAP-W<step>-<n>` in `features/<page>/sim-adapter.ts`, following step 44's pattern. Step 54 closes them (`grep -rn SIM-GAP- apps/core-web/src`). Known gaps to log: 47 caseType; 48 per-device health series; 52 services uptime, settings and presentation mode (m3, M8) |

## 7. Checks run (fresh evidence, 2026-10-01 WIB)

| Check | Command | Result |
|---|---|---|
| Shared suite | `npx vitest run --root packages/shared --maxWorkers=2` (05:36) | `Test Files 23 passed (23)`, `Tests 393 passed (393)` |
| Shared typecheck | `npm run typecheck -w @dems/shared` | exit 0 |
| core-web suite | `npx vitest run --maxWorkers=2` in `apps/core-web` (05:36) | `Test Files 13 passed (13)`, `Tests 161 passed (161)` |
| core-web typecheck | `npx tsc -b` | exit 0. Sandbox keychain noise ("failed to copy trust settings") has no effect. Step 44 was writing `features/session-monitor` at the same time (P11), and the run was clean anyway |
| D42 React | `npm ls react react-dom --all \| grep -oE '(^\| )react(-dom)?@[0-9.]+' \| sed 's/^ //' \| sort -u` | `react-dom@19.2.3`, `react@19.2.3` |
| D42 React Native | `npm ls react-native --all \| grep -oE '(^\| )react-native@[0-9.]+' \| sed 's/^ //' \| sort -u` | `react-native@0.86.3` |
| No Scarf | `npm ls @scarf/scarf` | `(empty)` |
| Pins | `npm ls -w @dems/core-web --depth=0`; the same for `-w @dems/shared` | every §14.1 pin exact (§3) |
| MS-01 / AC-72 | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` | no output (exit 1) |
| MS-02 | `grep -rn "box-shadow" apps/core-web/src --include='*.tsx' \| grep -E "animate\|transition"` | no output (exit 1) |
| MS-03 | `grep -rnE "will-change" apps/core-web/src` | no output. The camelCase `willChange` appears only at `glow-ring.tsx:355` (allowed) |
| Web globals in the simulator | `/usr/bin/grep -rnwE "document\|window\|sessionStorage\|localStorage\|navigator" packages/shared/src/sim` | `platform.ts:34,35,41,52` only (all guarded) |
| Randomness in the simulator | `grep -rnE "randomUUID\|crypto\.\|Math\.random" packages/shared/src/sim` | exit 1 |
| Root barrel | `grep -n sim packages/shared/src/index.ts` | no match |
| demo-data Node APIs | `grep -rc "node:" packages/shared/src/demo-data` | 0 in all 5 files |
| Private keys | `grep -rln "PRIVATE KEY" packages apps/core-web/src apps/mock-core/src --exclude-dir=node_modules` | only `test/demo-evidence.test.ts` (the guard) and `scripts/gen-demo-evidence.ts:1456` (the leak check). The 14 `.pem` files are all `BEGIN CERTIFICATE` |
| External hosts | `grep -rnE "https?://" apps/core-web/src`; CDN grep across web and shared | attribution comments and SVG `xmlns` only; no CDN |
| `Intl` | `grep -rn "Intl\." packages/shared/src/{realtime,sim,i18n} apps/core-web/src` | none |
| Test glob | `find apps/core-web/src -name '*.test.ts'`; `vite.config.ts:19` | none present; include is `src/**/*.test.tsx` only (M7) |
| Stale entry-chunk baseline | `gzip -9c apps/core-web/dist/assets/index-DkSL4CLC.js \| wc -c` (step-38 build, 03:21) | 164,431 B; `grep -l -i scalar` and `grep -l "demo-media\|\.mp4"` both exit 1. Baseline only: steps 39, 41 and 33 landed later, and step 58 re-measures |
| Probe: selector stability | scratchpad `selector-stability.ts` | `idle / recording / fault-demo shallow-UNSTABLE single-arg selectors: selectSystemState` |
| Probe: i18n coverage | scratchpad `i18n-sync.ts` | 23 vocabulary maps complete; extras `EvidenceStatus: PENDING` and `SessionState: IDLE, INCOMPLETE`; DeviceCommand keys are camelCase |
| Probe: pill vs status | scratchpad `pill-vs-status.ts` (12 fault kinds) | `POWER_FAIL ring=CRITICAL pill=CRITICAL flags=[POWER_FAIL] checklistNonOK=[]`; the other 11 are consistent |
| Probe: API edges | scratchpad `api-edge.ts` | `1 malformed %: THREW URIError`; `2 signed-out stop: 202 … auth= SIGNED_OUT`; `3 signed-out create (other body): 409 … SES-20261001-0024 is active`; `4 signed-in off-schema caseNumber: 201`; `5 TECHNICIAN stop: 202`, last audit `RECORDING_STOPPED actor= OPR-003` (probe 2's row named OPR-001) |
| Graft | `graft callers systemStatus -d all`; `graft callers selectSystemState -d 1`; `graft grep "Suffix"` | 3 consumers and workarounds (M1); 4 suffix parsers (m7) |

## 8. Positive findings

- **Simulator architecture:**
  - pure `(state, now) → state` transitions, one `setState` per action (`actions.ts:95-107`);
  - derived values in selectors rather than stored (one event stream, 04 §9 #12–#18);
  - errors inside a subsystem are reported without stopping the loop (`engine.ts` tick).
- **Platform neutrality done properly:**
  - injected storage, visibility, timers and scheduler;
  - a hydration gate that drops writes until ready (`store.ts:94-129`);
  - a compile-time proof that `SNAPSHOT_KEYS` is complete (`store.ts:56-59`);
  - the snapshot excludes audio, clock and auth.
- **Audit chain:** canonical JSON that throws on lossy values; real SHA-256 via `@noble/hashes` (identical on web, Node and Hermes); a ring anchor rule; exact-index tamper detection (AC-55).
- **Simulated API conformance** is enforced by a real test: every documented status of the 9 simulated operations is produced, and every body passes the zod schemas (`test/openapi.test.ts:270-360`).
- **Routing:**
  - the guards read the simulator outside React through router context (`router.tsx:18-22`, `_app.tsx:10-14`);
  - search params are lenient with `.catch`, and there is an open-redirect guard (`routes/-search.ts`);
  - the stub contract is explicit (`19_app_shell.md` §2).
- **Motion system:**
  - the ambient registry is a plain external store, grants slots with page priority and supports groups;
  - loops pause off-screen and in a hidden tab;
  - the CSS side stops keyframe loops under the in-app override as well as the OS setting;
  - the debug overlay is a lazy chunk.
- **Compositions:** DbfsMeter writes frames straight to Motion values and the DOM (ARIA at 1 Hz, readout at ≤ 4 Hz) and renders React only on CLIP or NO SIGNAL flips (`dbfs-meter.tsx:130-200`). The accessibility contracts in §14.6 are implemented (`role="img"`, `role="meter"`, `<ol>` with `aria-live`, `aria-current="step"`).
- **DEMO evidence:**
  - the key is held in memory only;
  - DEMO labels appear in the index, the certificate subject, the signature files and the precomputed results;
  - the generator runs a leak check;
  - a pure verify helper uses a WebCrypto fallback labelled "precomputed";
  - the output is byte-identical across runs.
- **Dependency hygiene:** exact pins; one React; no install-time analytics; only local fonts; loopback-only network constants.

## 9. Files reviewed

- **Blueprint and decisions:**
  - `identification/02_structured.md` (rows 27–41, 42–54, 90–93; P1–P13; waves; single-writer scan)
  - `decisions/decisions.md` (D37–D69)
  - `status_tasks.md` (wave tracker)
- **Specifications:**
  - `masterplan/01_specs.md` §14 (§14.1–§14.16)
  - `masterplan/03_motion_spec.md` §7–§9, §11
  - `masterplan/04_mobile_specs.md` SCR-01..07
  - `research/01_explore.md` §5.3–§6.4
- **Logs:**
  - `implementation/12_sim_contract.md`, `13_sim_engine.md`, `14_api_contract.md` (findings), `19_app_shell.md` §2, `20_compositions.md` (§2, §5, §6)
  - `65_demo_evidence.md` (§4, §5, §8)
  - `64_demo_media.md` (licence and notices lines)
  - `delegation_progress/coder_execution_step_39.md`, `coder_execution_step_93b.md`
  - logs 08–11, 15–18 and 66, scanned for open findings
- **Shared:**
  - `src/sim/{selectors,react,store,index,errors,actions,engine,api,session-machine (L60-600),auth (lockout, touch, restore),events (L1-140),evidence (L60-140),vocabulary,types,initial-state (keys),dataset (grep)}.ts`
  - `src/api/{index,session-schema,constants,core-api (grep),health (grep)}.ts`
  - `src/index.ts`
  - `src/i18n/{index.ts, en/dashboard.ts, en/system.ts (parts), en/session.ts (parts), en/session-new.ts (parts), en/storage.ts (parts), en/common.ts (outline)}`
  - `src/demo-data/{index,types (L140-260)}.ts`, `packages.generated.ts` (EV-0005 entries)
  - `src/brand/index.ts`, `src/tokens/tokens.ts` (exports)
  - `package.json`, `vitest.config.ts`
  - `scripts/gen-demo-evidence.ts` (key handling, spawn), `scripts/gen-demo-media.ts` (voices, spawn)
  - `assets/demo-media/README.md`
  - `test/{openapi (L270-420),i18n (L146-182)}.test.ts`
- **core-web:**
  - `main.tsx`, `router.tsx`, `i18n.ts`, `vite.config.ts`
  - `routes/{__root,_app,login,-search}.tsx|ts` and every `routes/_app/**` file
  - `features/{dashboard,evidence,login,stack-check}/index.tsx`, `features/home/home-page.tsx`
  - `components/shell/{integrity-checks.ts,secure-pill.tsx,notifications-bell.tsx,top-bar.tsx (L125-224)}`
  - `components/composed/{dbfs-meter.tsx (L1-260),dbfs-meter.math.ts,glow-ring.tsx (grep)}`
  - `components/media/{demo-media.ts,index.ts,use-sim-clock.ts,procedural-feed.ts (imports)}`
  - `components/ui/border-beam.tsx`
  - `motion/{ambient-registry,use-ambient-loop,policy,debug-overlay-gate}.ts(x)`, `motion/motion.css`
  - `features/session-monitor/sim-adapter.ts` (in flight, grep only)
- **Mobile (duplication only):** `features/dashboard/{use-home-data.ts,home-model.ts,i18n.ts}` (parts), `components/media/{demo-media.ts,emblem-paths.ts}` (headers), `components/composed/dbfs-meter.math.ts` (grep)
- **Repository root:** `THIRD_PARTY_NOTICES.md`

## 10. Parallel-run notes (P1–P13)

- **Read-only.**
  - No repository source, test, config, `package.json` or lockfile was edited.
  - No `npm install` was run, and no git command was run.
- **Processes.**
  - No Vite or mock-core process was started, because the static and probe evidence was enough. Ports 5174 and 5175 were never touched.
  - The only processes were short-lived `vitest`, `tsc`, `npm ls`, `graft` and `node --import tsx` runs. All of them exited.
- **Side effects.**
  - Vitest's cache and `tsc -b`'s `.tsbuildinfo` are the standard by-products of the typecheck and test commands every step runs.
  - The four probe scripts live only in the session scratchpad and import repository sources read-only.
- **Shared files (P8).** Only this file and `delegation_progress/senior_code_reviewer_step_40.md` were written. `masterplan/02_plan.md`, `implementation/99_implementation_report.md`, `status_tasks.md` and `delegation_progress_report.md` were left to the controller.
