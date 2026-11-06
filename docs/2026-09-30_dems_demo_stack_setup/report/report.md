# Final Report — DEMS Demo Stack, Web Console, Mobile App and Release Packages

- **Task folder:** `docs/2026-09-30_dems_demo_stack_setup/`
- **Period:** 2026-09-30 to 2026-10-01 (closing records written 2026-10-04)
- **Mode:** master-controller, full autonomy from D39, fast-track from D112
- **Final commit:** `acaff20` (`acaff203288d4d7b4ad1e744b1aff8716817c52c`) on `main`, local only (no remote), above baseline `33e4c95`; 2,194 files. This report and the controller-owned trackers are committed with the next docs commit

## 1. Highlight

Web console (10 pages + Start Session flow), Android app (phone portrait + tablet), shared simulator with demo media and evidence, and installable packages for other PCs are built and verified. Tests green: shared 508, core-web 438, mobile 833, mock-core 19. Security reviews: CAUTION, nothing critical or high. Android package PASS; web packages PASS after one rebuild.

## 2. What was delivered

| Area | Result | Evidence |
|---|---|---|
| Host toolchain | JDK 17, Android SDK 36 + NDK + CMake, 3 AVDs, Maestro, ffmpeg, eSpeak NG | `initialization/01_env_check.md`; D23, D47, D64, D105 |
| Monorepo | npm workspaces: `packages/shared`, `apps/core-web`, `apps/mobile`, `apps/mock-core` | baseline commit 33e4c95 (D44) |
| Web console | Login, Dashboard, Session Monitor, Start Session flow, Evidence, Devices & Inputs, Storage, Network & Time, Security & Audit, System & Maintenance (+ Demo Control), API Reference (Scalar) | D76–D91, D101; visual audit fixed (D96, D109) |
| Mobile app | Login, Pairing, Home, Start Session, Session Monitor, Finalization, Summary, Recovery, Sessions, Evidence, Devices, Storage, Network & Time, Operator Audit, Settings | D83–D114 |
| Shared | Design tokens, i18n (13 namespaces), simulator (session state machine, faults, auth, audit chain), OpenAPI 3.1 (10 operations), demo media (56 videos, 56 audio tracks), 14 demo evidence packages with Ed25519 signatures, one tampered package (EV-20260930-0005) | D52, D54, D61, D62, D64, D67, D115 |
| Tagline | "SECURE BY DESIGN. TRUSTED BY LAW." (user decision, urgent) | D128, D129 |
| Release: Android | `release/android/DEMS-Demo-0.1.0.apk`, 142,592,154 B, SHA-256 `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd`; install guide `INSTALL-ANDROID.md`; licences | D117, D126, D130; verified on the tablet in airplane mode (D127) |
| Release: Web | 6 packages in `release/web/` (table in §3), guide `release/RUN-ON-ANOTHER-PC.md` | D118, D131, D132 |
| Docs | Root `README.md` (297 lines), `THIRD_PARTY_NOTICES.md` | D121, D123 |

## 3. Web packages (build 2026-10-01 11:45 WIB)

| File | Size (B) | SHA-256 | Role |
|---|---|---|---|
| `DEMS-Web-Demo-0.1.0-windows-x64.zip` | 76,213,194 | `5ba6368f7785fe8acaa1484d7c31528b39ffb0bd3b1caed12845b9eac7d87e65` | primary, Windows 10/11 x64 |
| `DEMS-Web-Demo-0.1.0-macos-arm64.zip` | 80,746,025 | `4f0f9e83c5ff9cfb49d918022155e0bd029b17514c626f396df71933dae97c59` | primary, Apple-chip Mac |
| `DEMS-Web-Demo-0.1.0-linux-x64.tar.gz` | 83,886,762 | `78ae50d8dd3cf67ce4e7972af4e7d511a8672859624d49f7cc8dd3f4824b05eb` | primary, Linux x64 |
| `DEMS-Web-Demo-0.1.0-macos-x64.zip` | 83,136,920 | `a24dcbd37291b0d70b62c2864d4e8ab75782f70000e4c32a06322de67a0b8583` | primary, Intel Mac |
| `DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip` | 76,256,035 | `0859baa495125c8f5bdb054099105bf04accbeb1a61935d593b75dbdbf1ca6ae` | fallback (Smart App Control / antivirus) |
| `DEMS-Web-Demo-0.1.0-any-os-node.zip` | 37,196,089 | `a5c50d058cc3479ce82e3350dac354fb240e4f06e1682b63579ddf93596e0226` | fallback (any OS with Node 22+) |

`release/` is git-ignored: the packages are not in the repository. Copy them by USB stick or local share.

## 4. Verification evidence

| Check | Result | Source |
|---|---|---|
| Root typecheck, lint, tests | shared 508, core-web 438, mobile 833, mock-core 19 — all pass | `verification/01_verification.md` (step 61, D120) |
| Re-run after the tagline change | shared `Tests 508 passed (508)` at 12:06:39; mobile `Tests: 833 passed, 833 total` (72 suites, 35.3 s); core-web 438 passed at 11:42 | controller run 2026-10-01 12:06; `implementation/78_web_packager_rebuild.md` §5 |
| Security review, web + launcher | CAUTION, no critical or high; fixes applied in the rebuild | `verification/02_security.md`, D124, D131 |
| Security review, mobile + APK | CAUTION, nothing high or critical | `verification/09_mobile_security.md`, D125 |
| Package verification | APK PASS; web FAIL on F96-1 (Evidence Verify never finished: Vite inlined small files as `data:` URIs that the CSP blocks) | `verification/12_package_verification.md`, D127 |
| Rebuild + re-verification | F96-1 closed with `build.assetsInlineLimit: 0`; 7 of 7 checks PASS; checksums 6/6 OK; Verify PASS 8/8 on EV-20260929-0001, FAIL on AUDIO-02 only on EV-20260930-0005; 0 CSP events; 0 external requests | `verification/13_package_reverification.md`, D132 |
| Controller checksum re-check | `shasum -a 256 -c SHA256SUMS.txt` → 6 x OK | controller run 2026-10-01 |

**Limit:** the Windows x64, Linux x64, Intel-Mac and Windows signed-runtime packages were checked statically only. They were never executed (this host cannot run them). Run `--self-test` on the target PC the day before the demo (KI-22).

## 5. Decisions

All 133 decisions are in `decisions/decisions.md`. The ones that shaped the result:

| Topic | Decision | Ref |
|---|---|---|
| Stack | HeroUI v3 (web) + HeroUI Native (mobile) on one token file; Vite 8, React 19.2.3, Tailwind 4, Motion; Expo SDK 57, RN 0.86.3, Reanimated, Skia; ready-made kits are mandatory | D6, D10, D16, D31 |
| Scope growth | Stack setup → full web build (10 pages) + mobile build in the same task, in parallel | D15–D26, D33, D38 |
| Data | In-app simulator in `packages/shared`; mock-core stays health + heartbeat | D19 |
| Demo content | Generated videos, dual audio, signed evidence packages, one tampered | D50, D64, D67 |
| Autonomy | Full autonomy with decision and drift log | D39 |
| Parallelism | 6/8, then 12/16 agents; fast lane for page steps | D34, D71, D72, D75 |
| Packaging | Release APK (3 ABIs, DEMO keystore outside git) + 6 web packages (Node SEA + fallbacks), loopback only with CSP | D94, D104, D117, D118 |
| Fast-track | Packaging first; full end pass, deep code reviews and long device passes deferred as known issues | D112 |
| Tagline | "SECURE BY DESIGN. TRUSTED BY LAW." | D128 |
| Zod / CSP | `main.tsx` boot order changed so Zod runs without its JIT | D131 |

## 6. Drift log (planned → actual)

The full table (DR-01..DR-50, with reasons) is in `decisions/decisions.md` under "Drift Log". Summary by type:

| Type | Items |
|---|---|
| Scope | DR-01 full web + mobile build in this task; DR-06 responsive phone + tablet; DR-13 mobile built now; DR-25 demo media and evidence; DR-44 release packages; DR-49 tagline |
| Tech | DR-04 HeroUI; DR-05 designer fonts and palette; DR-07 simulator in shared; DR-11 Scalar; DR-18/19 mobile typography and jest setup; DR-21 hero 3:2; DR-23/24 sidebar fill and Scalar CSS; DR-26/34 eSpeak NG instead of macOS voices and Piper; DR-27 13 i18n namespaces; DR-29 RollingNumber; DR-31 shell sizes in CSS; DR-32 seven sealed-today items; DR-35 router view-transition; DR-47 3 ABIs and extra fallbacks; DR-50 `main.tsx` boot order |
| Process | DR-02/37 concurrency overrides; DR-12 one end pass; DR-14/15 emulator lifetime and row splits; DR-20 three heartbeat clients; DR-36 extra package.json slot; DR-38/39 audits in parallel; DR-40 fast lane; DR-48 packaging before the end pass |
| Sequence | DR-03 early installs; DR-43 step 54 in parallel with 53 |
| Environment | DR-08 `~/.zprofile`; DR-09 no watchman; DR-10 `lockf`; DR-16 IPv4-first; DR-17 Build-Tools 35 auto-installed; DR-22 Maestro logs; DR-28 Metro bundle location; DR-30 Vite ports 5176–5178; DR-33 ffmpeg install method; DR-41 emulators killed by a lane; DR-42 emulator priority blocked; DR-45 host sleep; DR-46 third AVD |

## 7. Known issues (not fixed)

Full list: `verification/01_verification.md` KI-01..KI-29. Grouped:

| Group | Items |
|---|---|
| Deferred verification | KI-01 tablet captures; KI-02 Maestro flows never authored; KI-03 MA-30 toast capture; KI-04 web end pass at 4 sizes; KI-06 cold-start measurements; KI-29 deep code reviews 64/65 |
| Mobile polish | KI-07 13 SIM-GAP IDs not adopted on mobile; KI-08 eight copies of the sheet hook; KI-09 Stepper badge and warnings; KI-10 pane layout freezes on rotation; KI-11 LogBox banner; KI-12 RollingNumber shows "09%" for 99 %; KI-13 pulse timings and BottomSheet under reduced motion |
| Simulator and web | KI-14 no HDD SMART fault; KI-15 markers/notes UI; KI-16 flag-label i18n map; KI-18 stale `core-api.ts:427` description; KI-20 motion spec §9.4 |
| Tooling | KI-19 `device-session.sh` Metro port range; KI-21 `expo prebuild` wipes `android/`; KI-23 `npm ls --all` exits 1 (`ajv-formats`); KI-24 flaky test under load |
| Packages | KI-22 four web packages never executed; Windows SEA binary keeps a leftover Authenticode block (F-62-06); nested `undici` advisory; `?debug=1` overlay present in release; old tagline strings remain as unused data inside the APK bundle; Login shows the designer version label "v2.4.1" while the package is 0.1.0; an unreleased APK copy stays in `apps/mobile/android/app/build/outputs/apk/release/` |
| Closed since the list was written | KI-17 Zod CSP probe (closed by D131) |

## 8. Items that need the user's decision

| # | Item | Why it is the user's call |
|---|---|---|
| 1 | Global App Nap opt-out for faster emulator cold start | Persistent system setting; not applied |
| 2 | Free Google developer account to avoid the 24-hour tap-install flow in Indonesia | Needs an account; ADB install is documented instead |
| 3 | Keep the Mac awake during long runs | Lid close paused all agents for two hours |
| 4 | `sandbox.network.allowLocalBinding: true` | Removes most sandbox bypass prompts |
| 5 | Show the new tagline on the mobile Login | Needs an APK rebuild; mobile never rendered the tagline |
| 6 | Test the Linux package in Docker | Docker is not used without an explicit OK |
| 7 | Review `docs/` before any git remote | It contains design-book extracts (KI-28) |

## 9. Agents used and artifacts

request-translator, task-architect, document-reader, data-collector, data-analyst, image-analyst, image-specialist, git-specialist, coder-execution, verifier, security-review, senior-code-reviewer, test-expert.

| Artifact | Path |
|---|---|
| Blueprint (rev 6, 102 steps) | `identification/02_structured.md` |
| Specs and plans | `masterplan/01_specs.md` … `06_packaging_spec.md` |
| Step logs | `implementation/01…81_*.md`, `34_git_final_commit.md` |
| Verification | `verification/01_verification.md` … `13_package_reverification.md` |
| Decisions and drift | `decisions/decisions.md` |
| Delegation trail | `delegation_progress_report.md`, `delegation_progress/*.md` |

---
*Controller report. Follow-up work (backend, RBAC, pairing) continues in `docs/2026-10-04_dems_backend_rbac_pairing/`.*
