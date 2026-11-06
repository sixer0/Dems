---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
step: 63 (mobile security review, incl. the release APK; FAST-TRACK D112, parallel with step 95/96)
date: 2026-10-01
agent: security-review
tier: 2
status: complete
verdict: CAUTION (0 FAIL; 0 high or critical findings in the APK; 6 low-risk CAUTION items, each with an owner)
sources: identification/02_structured.md row 63 (rev 6); masterplan/06_packaging_spec.md §2.2, §2.6, §2.9, §2.10, §6.2; decisions D44, D45, D47, D50, D51, D94, D104, D112, D117; implementation/40-61, 69, 72, 74
evidence_window: 10:50-11:12 WIB (read-only; no servers, no device session, no build)
apk_under_review: release/android/DEMS-Demo-0.1.0.apk, 142,592,154 B, SHA-256 0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd
---

# 09 Mobile security review (step 63)

## 1. Verdict

**CAUTION. Nothing blocks step 96 or the demo hand-over.**

- No check failed.
- The APK has no high or critical finding.
- The six CAUTION items are low-risk. Each has an owner: a step-96 touch-up or a recorded known issue (§4).
- Every item in the step-63 checklist and in 06 §6.2 "63, security, mobile" has command output or file:line evidence (§3).

| Gate check (security-review-gate) | Result | Summary |
|---|---|---|
| Credential leak | PASS | The keystore password was not found in the repo, git history, docs, release/, the APK or the step-94 Gradle daemon log. Every grep ran with a positive control (D44). No key or token patterns in mobile/shared source or in the APK |
| Destructive operation | CAUTION | `build-release-apk.sh` runs `expo prebuild`, and prebuild can clear `android/`. It did so once (DR-94-1; the debug APK was restored from a backup). See F63-05 |
| External call | PASS (one dev-tool CAUTION) | The release app makes no egress. Its only network targets are loopback, and the release manifest blocks cleartext. The Maestro `e2e` script does not disable the update check (F63-06; dev only) |
| Injection | PASS | Deep-link parsers use allow-lists and length caps (`runtime/debug.ts:26-37`, `motion/policy.ts:139-160`). The native-intent hook never logs URLs (`app/+native-intent.tsx:9-17`). The scripts interpolate no untrusted input |
| Permission escalation | PASS | `signing/` is mode 700 and both files are 600. Android permissions are minimal and need no runtime grant. Two exported components, both expected |

Review level: L3 (signing material and credential handling, read-only).

## 2. Method and controls

- **Search tools.** Pattern scans used `/usr/bin/grep` or `git grep`, never the shell `grep` wrapper (D44). Each scan type had a positive control:
  - stdin plant: `printf 'abc%sxyz' "$PW" | grep -cF "$PW"` gave `1`;
  - signing folder as the known hit: `grep -rlaF "$PW" apps/mobile/signing` listed `release-signing.properties`;
  - `git grep --no-index` on the signing folder found the file;
  - secret regexes: a planted `AKIA…` line and a `BEGIN PRIVATE KEY` line gave `2`, and a planted file in the scratchpad gave `planted.txt:1`;
  - URL regex: a planted `https://planted.example.invalid` was found.
- **Password handling.** The password was read into a shell variable from the git-ignored properties file, only to grep for it. Every grep printed file names or counts only, and the variable was unset after each command. The password does not appear in this report, in any command output or in any file written by this step.
- **APK internals.** The APK was unzipped into the session scratchpad. The Hermes bytecode was disassembled with the repo's own compiler: `node_modules/hermes-compiler/hermesc/osx-bin/hermesc -b -dump-bytecode assets/index.android.bundle`. The output covers 50,306 functions, 63,435 strings and bytecode version 98. The string table and the disassembly give exact strings, so they replace guesswork from `strings(1)`, whose output merges Hermes' suffix-shared strings.
- **Tools.** Android build-tools 36.0.0 (`aapt2`, `apksigner`, `zipalign`) and JDK 17 (`/opt/homebrew/opt/openjdk@17`).
- **Not done (read-only, D112).** No device session and no rebuild. On-device behaviour relies on the step-94 run (implementation/69 §5) plus the static and bytecode proofs below.

## 3. Checklist results

### 3.1 Keystore and password (AC-PK-A8, 06 §2.2, §6.2)

| Check | Evidence | Result |
|---|---|---|
| Files, permissions | `ls -la apps/mobile/signing/` → `drwx------ .`, `-rw------- dems-demo-release.p12` (2,750 B), `-rw------- release-signing.properties` (276 B) | PASS |
| Random password, never on argv | `create-demo-keystore.sh:44` `openssl rand -hex 16`. `:47-51` keytool gets it through `-storepass:env`/`-keypass:env` with output discarded. `:15` `umask 077`. `:27-31` refuses to overwrite. `:36-39` aborts unless `signing/` is git-ignored. `:65-66` prints only the Owner and SHA-256 lines. `:67` unsets the variable. The properties file has 32-hex-character store and key passwords and they are equal (awk length/equality check; values not printed) | PASS |
| Git ignore | `git check-ignore -v` → `.gitignore:62:apps/mobile/signing/` for both files, and `.gitignore:61:/release/` for the APK. The keystore is also matched by `apps/mobile/.gitignore:17:*.p12` (double ignore). `git ls-files release apps/mobile/signing` → 0 files. `git ls-files` filtered for `signing/`, `.p12`, `.jks`, `.keystore`, `.properties`, `.pem`, `.key` → no output (rc=1). `git status --porcelain --ignored` → `!! apps/mobile/signing/`, `!! release/` | PASS (see I-04) |
| Password nowhere else (AC-PK-A8) | `grep -rlaF "$PW"` over `docs/` → rc=1. Over `release/` (including the APK binary) → rc=1. Over the extracted APK → rc=1. Over the whole workspace except `node_modules`, `.git` and `signing` (62 s; covers `apps/mobile/android/**` build intermediates) → rc=1; `signing` is the only directory with that name outside node_modules. `git grep -lF` on tracked files → rc=1. `git grep --untracked` → rc=1. `git grep` over all revisions → rc=1. Step-94 Gradle daemon log `~/.gradle/daemon/9.3.1/daemon-26732.out.log` (mtime 10:41, the build end) → 0 hits | PASS |
| AGP intermediates | Only `intermediates/signing_config_versions/release/.../signing-config-versions.json` exists. AGP no longer writes passwords there, and the workspace grep above covered it | PASS |
| DN labelled DEMO, cert matches | Read with `keytool -list -v -storepass:env` (password through the environment only): `Keystore type: PKCS12`, 1 entry, alias `dems-demo`, Owner = Issuer `CN=DEMS Demo Release (DEMO ONLY - NOT FOR PRODUCTION), OU=Demo, O=DEMS Demo, C=ID`, valid 2026-10-01 to 2054-02-16, `SHA256withRSA`, 2048-bit RSA, SHA-256 `99:5C:1E:38:…:FD:16:47`. This equals the APK signer (§3.2) | PASS |
| Fail fast without the properties file (no debug-signed release) | `plugins/with-dems-release-signing.js:31-37` throws a `GradleException` for any release task when the file is missing. The generated block appears exactly once (`grep -c "@dems-release-signing" android/app/build.gradle` → `1`; block at `build.gradle:184-203`). `build.gradle:5` puts `projectRoot` at `apps/mobile`. A second guard: `build-release-apk.sh:28-29` preflight. The template's `signingConfig signingConfigs.debug` (`build.gradle:115`) is overridden at `:196` | PASS (static only, I-03) |
| No secret in `app.json` or the plugin | `app.json` has no `owner`, `projectId`, `updates` or `extra.eas`. The plugin reads the properties file at Gradle time and embeds no value (`with-dems-release-signing.js:19-30`) | PASS |

### 3.2 APK signature, provenance and manifest (AC-PK-A1, A2, A5, A6; 06 §2.6)

| Check | Evidence | Result |
|---|---|---|
| Provenance | `shasum -a 256 -c SHA256SUMS.txt` → `DEMS-Demo-0.1.0.apk: OK`, same for `.apk.sha256`. The digest equals the frontmatter and BUILD-INFO.txt | PASS (I-07) |
| apksigner | `Verifies`; v1 false, **v2 true**, v3/v3.1/v4 false; `Number of signers: 1`; DN as in §3.1; cert SHA-256 `995c1e389ed7df89f3e79a1690b2c14dc7376d928249bbf01de3c83272fd1647` (= BUILD-INFO `signer_sha256`); RSA 2048; 0 warnings. With minSdk 24, v2 alone is valid (DR-94-3) | PASS |
| zipalign | `zipalign -c -P 16 4` → exit 0 | PASS |
| Not debuggable | `aapt2 dump badging \| grep -ciE 'debuggable\|testOnly'` → `0`. Control: one `package:` line. xmltree: no `debuggable` attribute | PASS |
| Cleartext | xmltree `grep -ciE "cleartext\|networkSecurityConfig\|debuggable\|testOnly"` → `0`. targetSdk 36, so the platform default denies cleartext. Source sets: `usesCleartextTraffic="true"` only in `android/app/src/debug/AndroidManifest.xml:6` and `src/debugOptimized/AndroidManifest.xml:6`. `src/main/AndroidManifest.xml` has none (AC-26) | PASS |
| allowBackup | xmltree `allowBackup(0x01010280)=false`. Source: `app.json` `android.allowBackup: false`. This keeps AsyncStorage out of `adb backup` and cloud backup | PASS |
| Permissions | `aapt2 dump permissions`:<br>- INTERNET, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, ACCESS_NETWORK_STATE, WAKE_LOCK, plus `com.dems.demo.tablet.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (protectionLevel 0x2 = signature, androidx);<br>- none of SYSTEM_ALERT_WINDOW or READ/WRITE_EXTERNAL_STORAGE: `tools:node="remove"` at `src/main/AndroidManifest.xml:3,4,8`.<br>All of these are normal or signature level; none needs a runtime grant. Biometric = USE_BIOMETRIC + USE_FINGERPRINT (expo-local-authentication). The rest is Expo/RN/media plumbing | PASS |
| Exported components | `exported=true` count = 2:<br>1. `MainActivity`: LAUNCHER plus a VIEW/BROWSABLE `demsdemo` scheme. Expected; deep-link handling is in §3.3.<br>2. `androidx.profileinstaller.ProfileInstallReceiver`: guarded by `android.permission.DUMP` (shell or system only).<br>Not exported: `FileSystemFileProvider` (`exported=false`, from expo-file-system via expo), `BrowserProxyActivity` (`exported=false`), `InitializationProvider` (`exported=false`), and `FullscreenPlayerActivity` (no intent filter, so not exported at target 36) | PASS |
| No EAS, expo-updates or projectId (AC-27, MA-26) | `node_modules/expo-updates` is absent. Dex count of `Lexpo/modules/updates/` is `0`; control `Lexpo/modules/localauthentication/` is `3`. The manifest's `expo.modules.updates.ENABLED=false` meta-data comes from the prebuild template (`@expo/config-plugins/build/android/Updates.js`) and has no runtime behind it. The embedded `assets/app.config` has no projectId, owner or updates URL. `apps/mobile/eas.json` does not exist | PASS |
| Package hygiene (V-S5 style) | `unzip -l` filtered for `.map`, `.DS_Store`, `signing`, `.p12`, `.jks`, `.keystore`, `.properties`, `.env`, `.docx`, `.pem`, `.key` → only `META-INF/com/android/build/gradle/app-metadata.properties`, which holds just `appMetadataVersion=1.1` and `androidGradlePluginVersion=8.12.0`. Control: `index.android.bundle` count `1`. No source map is shipped | PASS |

### 3.3 Release-only behaviour: debug handle, `&scenario=`, Heartbeat (D112)

| Check | Evidence | Result |
|---|---|---|
| `__DEMS_DEBUG__` handle inert in release | **Source.** `runtime/debug.ts:101-120`: `useDebugHandle(sim, snapshot, enabled = __DEV__)`, with `if (!enabled) return` at `:107`. It is called with two arguments at `runtime/sim-runtime-provider.tsx:146`.<br>**Bytecode** (`Function<useDebugHandle>`): `LoadParam r5, 3; LoadConstFalse r10; JStrictEqual L1, r5, undefined; Mov r10, r5; L1: StoreToEnvironment r4, 2, r10`. So a missing third argument becomes the constant `false`. Metro inlined `__DEV__=false`.<br>The effect closure starts `LoadFromEnvironment r1, r5, 2; JmpTrue L1, r1; LoadConstUndefined r0; Ret r0`, so it returns before `PutByIdStrict … "__DEMS_DEBUG__"`. The call site is `Call3 r16, r16, r3, r15, r20` (sim, ref; no third argument).<br>The string stays in the string table because the gate is a runtime default, not dead-code removal. It is unreachable. A non-debuggable release also has no inspector through which to reach it | PASS |
| `&scenario=` deep links inert in release | `runtime/debug.ts:43-45`: `useDebugScenarioLinks(sim, enabled = __DEV__)`, returns early. Called with one argument at `sim-runtime-provider.tsx:144`. Bytecode `Function<useDebugScenarioLinks>`: `LoadConstFalse r9; JStrictEqual L1, r3, undefined`. Call site `Call2 r20, r20, r3, r15`. The regex `[?&]scenario=([^&#]*)` is still present (string s31600) but unreachable. The parser accepts only the four scenario names and URLs up to 512 characters (`debug.ts:26-37`) | PASS |
| Other `__DEV__` gates folded | The dev-only i18n key `features.settings.preferences.coreLinkHint` has **no** string-table entry. Only `…coreLinkHintRelease` exists, so the ternary at `preferences-section.tsx:67` was constant-folded. `app/dev-gallery.tsx:51` redirects in release. `more-screen.tsx:74` passes `debug={__DEV__}`. Logging mirrors are gated (`runtime/log.ts:158,166`, `motion/log.ts:26`, `navigation/log.ts:25`) | PASS |
| `?debug=1` motion overlay | **Not** gated. See **F63-02** | CAUTION |
| Heartbeat disabled in release | `runtime/core-link.ts:32-39`: `isCoreLinkSourceAvailable(source, isDevBuild = __DEV__)`. Bytecode: `LoadParam r2, 2; LoadConstUndefined r0; JStrictNotEqual L1, r2, r0; LoadConstFalse r2`, so HEARTBEAT → false in release. The block is applied three times:<br>- hydration falls back to SIMULATED (`:117`);<br>- the setter refuses and logs a warn row (`:128-133`);<br>- Settings renders the option disabled (`preferences-section.tsx:73`).<br>Tests: `npx jest heartbeat-release-gate.test.tsx …` → PASS (with 4 other suites, 57/57; §3.6). Step 94 checked this on the device (implementation/69 §5: option greyed out; a tap keeps Simulated) | PASS |
| Effect of the cleartext policy on Heartbeat | `HeartbeatProvider` is always mounted (`providers/app-providers.tsx:110-117`). In release it still tries `ws://127.0.0.1:4400/ws` (`packages/shared/src/api/constants.ts:18`) with a 500 ms-8 s backoff. Android's cleartext policy blocks it; loopback only, never egress. Accepted by 06 §2.6 [H-PK-5]. See I-02 | PASS (info) |
| No Metro or dev-server URL | The only `:8081` string is `http://localhost:8081/`, RN's `FALLBACK` in `node_modules/react-native/Libraries/Core/Devtools/getDevServer.js:15`. It is used only when the bundle comes from a server (`bundleLoadedFromServer`, `:39`), and here it is embedded. Bytecode strings `maestro`, `debuggerWorker` and `exp://` → 0 | PASS |

### 3.4 Network hosts in the release bundle (MA-25)

Every string in the Hermes string table matching `(https?|wss?|ftp)://` was listed (§2). Each falls into one of these classes:

| Class | Strings | Assessment |
|---|---|---|
| Loopback, the only connect targets | `ws://127.0.0.1:4400/ws`, `http://127.0.0.1:4400` (`shared/src/api/constants.ts:10,18`) | Allowed (loopback). Blocked by the release cleartext policy |
| Loopback, allow-list data only | `http://127.0.0.1:5173`, `http://localhost:5173`, `http://localhost:4400` (`constants.ts:27,29`: `WEB_DEV_ORIGINS`, `SELF_ORIGINS`) | Not fetched |
| RN fallback | `http://localhost:8081/` (§3.3) | Inert in an embedded bundle |
| URL-parsing placeholders | `http://hostname/` (`expo-router/build/link/href.js:48`), `https://e`, `http://[`, `https://`, `http://` | Not hosts |
| XML/JSON namespaces | `w3.org` (svg, xhtml, xlink, xmlns, XML), `json-schema.org` draft IDs | Identifiers, never fetched |
| Text inside error and warning messages | docs.swmansion.com, reactnavigation.org, docs.expo.dev, react.dev, shopify.github.io, react.i18next.com, dev.to, github.com | Display text only |
| Library CDN constant | `https://classic-assets.eascdn.net/~assets/` | Used only when `NativeModules['ExponentKernel']` exists, that is inside Expo Go (`expo-asset/build/AssetSources.js:51-54`). Unreachable in a standalone APK |

- **Network APIs in source.** Mobile `src` makes no direct `fetch(`, `new WebSocket`, `XMLHttpRequest`, `openURL(` or `WebBrowser.` call. The two network paths come from shared: `fetchHealth` (`shared/src/api/health.ts:46-47`, used only by the proof screen `features/home/home-screen.tsx:205`) and the heartbeat client (`shared/src/realtime/heartbeat-client.ts:94`). Both use the loopback constants above.
- **Telemetry endpoints.** Dex plus bundle hold 0 hits each for firebase, crashlytics, sentry.io, segment.io, app-measurement, google-analytics, mixpanel, bugsnag, datadog and api.expo.dev.
- **Other matches checked.**
  - `exp.host`, `expo.io` and `exp.direct` come from a hostname list (an Expo-hosting check), not a request target.
  - The `amplitude` hits are the audio/animation word.
  - Dex URL strings are XML/DASH/XMP namespaces and documentation links.
- **Result: PASS.** The release bundle's only connect targets are loopback.

### 3.5 Secrets, storage, logs and demo credentials

| Check | Evidence | Result |
|---|---|---|
| Keys, tokens, private keys | `git grep --untracked -c -E <PAT>` over `apps/mobile` and `packages/shared` (excluding `android/`) → rc=1 (0). PAT covers PEM private keys, AKIA, AIza, ghp_, github_pat_, xox*, sk-, sk_live_, JWT and `client_secret`. Hermes string table → 0. Raw bundle: 3 `sk-…` matches, all false positives across neighbouring strings (`mask-composite…`, `mask-origin…`, `mask-type…`). `docs/` and `release/android/{INSTALL-ANDROID.md,BUILD-INFO.txt}` (adding `storePassword=`/`keyPassword=`/`DEMS_KS_PASS=` value patterns) → rc=1; control on the signing folder → 1 file | PASS |
| DEMO evidence key (D51) | No private-key file. The 14 `device-certificate.pem` files hold only `BEGIN CERTIFICATE` (14/14). Subject `… OU=DEMO — NOT FOR PRODUCTION, CN=DEMS-IR-01 (DEMO — NOT FOR PRODUCTION)`. `DEMO_SEED_PHRASE` is only in `packages/shared/scripts/gen-demo-evidence.ts:126`. Bundle strings `DEMO_SEED_PHRASE`/`createPrivateKey` → 0 | PASS |
| AsyncStorage keys (04 §5.3) | Writers found by `git grep` for `AsyncStorage.(setItem\|mergeItem…)`:<br>- `dems.mobile.auth.v1` holds only `{lastOperatorId, biometricEnabled}` (`auth/auth-prefs.ts:4-6,43-47`; the id is validated `^[A-Z]{2,5}-\d{1,6}$` at `:24`).<br>- `dems.mobile.prefs.v1` holds only flags (`motion/prefs.ts:47`, `navigation/rail-prefs.ts:31`, `runtime/core-link.ts:88`, `features/settings/settings-prefs.ts:88`).<br>- `dems.sim.v1` drops the `auth`, `audio` and `clock` slices (`shared/src/sim/store.ts:73-76`, `partialize: toSnapshot` at `:114`; `types.ts:76`).<br>- `dems.mobile.log.v1` is described in the next row.<br>The demo password is only compared, never stored (`shared/src/sim/auth.ts:285-293`; `dataset.ts:150-153` "never written to state, events, audit rows or storage"). The pairing code never reaches state (`sim/pairing.ts:6`). Audit rows carry operator ids, not typed usernames (`auth.ts:214-226`) | PASS |
| Runtime log `dems.mobile.log.v1` | `runtime/log.ts:33` drops context keys matching `/(pass\|pin$\|^pin\|token\|secret\|credential\|user(name)?$\|^code$\|pairingcode\|otp)/i`. Values are primitives only, truncated to 200/500/2000 (`:29-31,65-74`). Capacity 200. Login, auth and pairing call sites pass no credential (`git grep reportRuntimeIssue(` over login/auth/pairing: 21 calls, contexts limited to `key`, `reason`, `outcome`, `phase`, `componentStack`). Sim auth errors carry no input (`sim/auth.ts:86-88`). `log.test.ts` PASS | PASS |
| Password field | `features/login/login-card.tsx:259-263`: `secureTextEntry`, `autoComplete="current-password"`, `autoCorrect={false}`, `autoCapitalize="none"` | PASS |
| Demo credentials labelled and gated | Labels: `shared/src/i18n/en/login.ts:34-38` ("Demo operators", "Demo password: {{password}}"); `features/login/i18n.ts:40` ("Demo pairing code"). Rendered only by `DemoOperators`, which returns `null` unless presentation mode is known to be off (`login-card.tsx:465-471`). A read failure counts as "on" and withholds the list (`presentation-mode.ts:33-47`). The install guide repeats `demo-2026` by design (06 §2.9 #5) | PASS |
| Demo data labelled (D50) | Bundle strings: `DEMO - precomputed`, `DEMO - recomputed`, `DEMO - synthetic evidence package … signed with a DEMO …`, and many `(simulated)` labels | PASS |
| Demo media synthetic (D50) | Hero still: "empty meeting room … no people, no insignia, no readable text", Pexels License (`THIRD_PARTY_NOTICES.md:77`). OSD watermark "DEMS-IR-01 \| DEMO" (implementation/64 §2, line 36). Voices are eSpeak NG formant synthesis with no recorded human samples (implementation/64:120). 84/84 mobile media embedded (implementation/69 A4) | PASS |
| Design-book text | `python3 dbcheck.py` over the docx (`word/document.xml`: 1,607 paragraphs; 332 sentence fragments of 40+ characters; 496 eight-word shingles) against the string table: **0 shingle hits**. Five sentence hits, each a short catalogue label (at most 51 characters) used as UI domain data: `shared/src/i18n/en/system.ts:40,41,50,52` (SVC-01/02/11/13 descriptions) and `shared/src/demo-data/types.ts:54`. No paragraph text. The docx is not in the APK | PASS |

### 3.6 Biometric handling (expo-local-authentication 57.0.3)

- **Prompt options.** `auth/biometric.ts:87-95` passes `biometricsSecurityLevel: 'strong'` (Class 3) and `disableDeviceFallback: true`: no PIN fallback inside the prompt, so the password is the fallback.
- **Gating.** Hardware and enrolment are checked first (`:42-50`). OS errors map to the §6.3 table, and only `authentication_failed` counts toward the lockout (`:55-75`, `:140-166`).
- **No biometric data.** No template or biometric data reaches the app; only the OS verdict does (`:22-23`).
- **Binding.** The binding is the operator id in `dems.mobile.auth.v1` ("simulated identity binding", 04 §6.3). It uses no CryptoObject or Keystore key, which is accepted for the demo (I-06).
- **Tests.** `npx jest --ci --maxWorkers=2` on `heartbeat-release-gate`, `runtime/log`, `auth/auth-provider`, `auth/biometric` and `runtime/runtime` → `Test Suites: 5 passed, 5 total; Tests: 57 passed, 57 total`.
- **Result: PASS.**

### 3.7 Host tooling: Maestro (D47) and `device-session.sh`

| Check | Evidence | Result |
|---|---|---|
| Maestro analytics off | `~/.maestro/analytics.json` → `"enabled" : false`, `cachedToken` / `email` / `user_id` / `orgId` all `null` (uuid redacted here) | PASS |
| Maestro footprint | `du -sh` → `~/.maestro` 346M, `~/Library/Logs/maestro` 20K (5 zips of 138-328 B). `~/.zprofile` mentions maestro 0 times (no other profile file exists). `command -v maestro` → not on PATH. Rollback per D47: `rm -rf ~/.maestro ~/Library/Logs/maestro` | PASS |
| Maestro not in the APK | Dex `maestro` count 0; bundle string table 0 | PASS |
| `e2e` npm script | `apps/mobile/package.json:13` sets `MAESTRO_CLI_NO_ANALYTICS=true` but not `MAESTRO_DISABLE_UPDATE_CHECK=true` or `--test-output-dir`. Its flow folder `e2e/maestro` does not exist. See **F63-06** | CAUTION |
| `device-session.sh` signals only its own groups | `scripts/device-session.sh:244-253`: each started group is recorded in `$STATE/pgids` and signalled only as a group (`kill -SIG -PGID`). `:254-264` TERM, then KILL. `:273-286` `bounded` kills only its own unreaped child. The watchdog (`:288-334`) signals the recorded groups, the session shell and that shell's direct children in its own process group, never itself (`:321-326`). It never stops a booted emulator (comment `:31`, setsid boot at `:222`). `rm -rf "$STATE"` removes only its own `mktemp -d` folder (`:243`). Cleanup only force-stops the app and removes the reverse rules this session added (`cleanup`, `:345-370`; loops at `:359-362`) | PASS (I-08) |

### 3.8 Install guide (06 §2.9, §6.2)

| Requirement | Evidence (`release/android/INSTALL-ANDROID.md`) | Result |
|---|---|---|
| ADB preferred | §2 "Method A: ADB from a laptop (recommended)" (`:19-32`); ID summary `:87` | PASS |
| Play Protect upload declined | `:48-52` "installs **without** sending the app … must not be uploaded anywhere"; `:90` | PASS |
| Advanced flow, 7 days | `:41-43` "choose **7 days** (recommended, it limits the exposure)"; `:89` | PASS |
| Checksums before install | `:6-8` | PASS |
| Protections never disabled globally | Play Protect scanning stays on (`:51`). However, `:37-38` tells Android 7 users to turn on the **global** *Unknown sources* switch, and `:24-27` turns on *Developer options* and *USB debugging*. No step turns them off again after install. See **F63-01** | CAUTION |

### 3.9 Dependency audit (A.12.6)

`npm audit --omit=dev -w @dems/mobile --json` (registry.npmjs.org; summary only):

- **Totals:** `{"info":0,"low":0,"moderate":41,"high":1,"critical":0,"total":42}`, prod 1,283 dependencies.
- **12 root advisories:**
  - **undici@7.29.0** (1 high entry; 10 advisories, including GHSA-rfgv-xxqx-mfg5 and GHSA-w293-vg96-wgc3). Path: `@dems/shared → @scalar/openapi-parser@0.29.9 → @scalar/json-magic@0.15.3 → undici` (`npm ls undici`). It is **not in the APK**: bundle strings `undici`, `@scalar`, `json-magic`, `openapi-parser` and `permessage-deflate` → 0. These are the D45 Scalar items: web/Node only, owned by step 62.
  - **uuid@7.0.3** (GHSA-w5hq-g745-h8pq). Path: `expo-splash-screen → @expo/config-plugins → xcode → uuid`. Prebuild-time only; bundle `xcodeproj`/`pbxproj` → 0. This one advisory is why about 35 Expo packages show as "moderate via expo".
  - **decode-uri-component@0.2.2** (GHSA-vcc3-ghjq-m6fr, DoS through malformed percent-encoding). Path: `expo-router → query-string@7.1.3 → decode-uri-component`. It **is in the runtime bundle**: strings `(%[a-f0-9]{2})\|([^%]+?)`, `(%[a-f0-9]{2})+` and the function name `decodeComponents` are present. npm reports `fixAvailable: false`. See **F63-04**.
- **Result: CAUTION (F63-04).** No high or critical advisory reaches the APK.

## 4. Findings

Severity follows the gate mapping (FAIL = high, CAUTION = medium, informational = low). The "Risk" column gives the risk in context: a DEMO-signed, Simulated-only app with synthetic data.

### 4.1 CAUTION items (each with a remediation owner)

| ID | Gate severity / risk | Location | Finding | Remediation | Owner |
|---|---|---|---|---|---|
| F63-01 | Medium / low | `release/android/INSTALL-ANDROID.md:24-27, :37-38` | On Android 7, the guide turns on the global *Unknown sources* switch. On every version it leaves *USB debugging* on after installing. No step turns either off again. This conflicts with 06 §6.2 "protections are never disabled globally" | Add a step after install: "Android 7: turn *Unknown sources* off again. Turn *USB debugging* off (optionally *Revoke USB debugging authorisations*) after the app is installed." Also in the ID summary | **Step 96** (two-line doc touch-up in the step-94 file before hand-over); else known issue |
| F63-02 | Medium / low | `apps/mobile/src/motion/policy.ts:139-160, :205-209`; `motion/motion-policy-provider.tsx:56-70, :119` | The `?debug=1` deep link turns on the performance overlay in release builds. `demsdemo://` is an exported VIEW/BROWSABLE scheme, so any app or web link can show the FPS/loop overlay on the presenter's screen (no data exposed; `?debug=0` clears it). The Settings switch for the same overlay is `__DEV__`-gated (`preferences-section.tsx:106-114`) | Ignore the `debug` flag when `!__DEV__` in `parseMotionLink`/`applyLinkingUrl`. Keep `motion=` | Known issue (post-demo; former step-91 scope) |
| F63-03 | Medium / low | `release/android/` (no notices file); `apps/mobile/src/features/settings/i18n.ts:99-105`; `THIRD_PARTY_NOTICES.md:3` | Settings > About points to "THIRD_PARTY_NOTICES.md at the root of the repository", which an APK recipient does not have. The release folder ships no licence texts. The bundled fonts (Inter, Orbitron, JetBrains Mono; 9 `res/*.ttf`) are OFL-1.1, which requires the licence to travel with redistributed copies. MIT/Apache notices for the bundled JS and native libraries are also not shipped (A.18) | Add `release/android/licenses/` with `THIRD_PARTY_NOTICES.md`, the three `node_modules/@expo-google-fonts/*/LICENSE_FONT` texts and a generated npm licence list (prod deps of `@dems/mobile`). Or reword the About line to "provided with the release package" | **Step 96** (package completion, alongside the web `licenses/` check of 06 V-S5); else known issue |
| F63-04 | Medium (npm moderate) / low | `node_modules/decode-uri-component` (0.2.2; `npm ls`: `expo-router@57.0.24 → query-string@7.1.3 → decode-uri-component@0.2.2`) | GHSA-vcc3-ghjq-m6fr is in the runtime bundle. Through the exported deep-link handler, a crafted `demsdemo://` URL can at worst hang the app (local DoS). npm: no fix without an Expo change | Track the next Expo SDK / expo-router patch. Do not force an override below the Expo pins (D45 "no downgrades below pins") | Known issue (post-demo dependency update) |
| F63-05 | Medium / low | `apps/mobile/scripts/build-release-apk.sh:43-51` | `expo prebuild` (even without `--clean`) clears a malformed `android/`. That deleted `app-debug.apk` once (DR-94-1, D117; restored byte-identical from a manual backup). The script does not take that backup itself | Before prebuild, copy `android/app/build/outputs/apk/debug/app-debug.apk` to a git-ignored backup if it exists, and restore it if it is missing afterwards | Known issue (D117 already orders a manual backup before any prebuild; **step 96** must follow it if it rebuilds) |
| F63-06 | Medium / low | `apps/mobile/package.json:13` | The `e2e` script omits `MAESTRO_DISABLE_UPDATE_CHECK=true` and `--test-output-dir`, which D47 requires on every Maestro call. Running it lets Maestro contact its update server. Its target `e2e/maestro` does not exist | Add the variable and an output directory under the git-ignored tree, or remove the script | Known issue (dev tooling only; note in README step 60) |

### 4.2 Informational (no action needed for the demo)

| ID | Location | Note |
|---|---|---|
| I-01 | `lib/<abi>/{libappmodules,librnskia,libreact_codegen_*}.so` (6 libraries per ABI) | Native libraries embed host build paths such as `/Users/gsp-budi/.gradle/caches/9.3.1/transforms/…`, which reveals the macOS account name. Normal for RN builds. A `-ffile-prefix-map` would strip them. Low information disclosure |
| I-02 | `providers/app-providers.tsx:110-117` | The release build still mounts the heartbeat client. It retries loopback WS that the cleartext policy blocks (06 §2.6 accepted). Step 94 saw no cleartext logcat line while Simulated was selected, so H-PK-5 is still unobserved. No egress either way |
| I-03 | `plugins/with-dems-release-signing.js:31-37` | The fail-fast branch was verified statically only; no test runs it. Code review 65 is deferred (D112), so this goes to the known-issues list |
| I-04 | `.gitignore:62` | `release-signing.properties` is matched by one rule. The keystore is matched by two (`apps/mobile/.gitignore:17`). Optional hardening: add `signing/` to `apps/mobile/.gitignore` |
| I-05 | `app/stack-check.tsx`, `navigation/stack-check-route.tsx` | The public `/stack-check` proof route is reachable in release by deep link. It shows only heartbeat/health widgets and starts the 10 s loopback health poll. Optional `__DEV__` gate, like `dev-gallery.tsx:51` |
| I-06 | `auth/biometric.ts` | Event-bound biometric (OS verdict, no Keystore-bound key) is the specified "simulated identity binding". It is not production-grade A.9 |
| I-07 | `release/android/*.sha256` | The checksums sit beside the APK, so they prove integrity, not authenticity. The guide could add the signer certificate SHA-256 (`995c1e38…1647`, already in BUILD-INFO.txt) for an `apksigner verify --print-certs` check |
| I-08 | `device-session.sh:265-272` | `record_group` records the PID even if the group died before it was recorded. In theory that PGID could be reused before cleanup. Negligible in practice |
| I-09 | npm audit | The high undici advisories are web/Node-only (D45). Not in the APK; tracked by step 62 |
| I-10 | No `FLAG_SECURE` | Screenshots are allowed, which the demo capture needs. On a production build, consider blocking them on evidence screens |

## 5. GDPR compliance assessment (demo scope)

All personal-looking data in the app is **synthetic**: fictional operators and subjects, an empty-room photo and synthetic voices (D50, §3.5). Nothing leaves the device (§3.4). The articles below are therefore assessed as "fit for a demo, required before production".

| GDPR article | Check | Status | Finding | Remediation |
|---|---|---|---|---|
| Art. 5 Data minimisation | Stored fields | Compliant | AsyncStorage holds an operator id, flags, a sanitised log and the sim snapshot without auth (§3.5) | none |
| Art. 5 Storage limitation | Retention | Partial | Log ring buffer capped at 200 records (`log.ts:25`). The sim snapshot persists until Reset to Idle or uninstall | Production: retention policy |
| Art. 7 Consent | Consent before PII | N/A (synthetic) | No real personal data is processed | Production: consent and lawful-basis flow |
| Art. 15 / 20 Access, portability | Export | N/A (demo) | No real data subject | Production: export endpoint |
| Art. 17 Erasure | Deletion | Partial | Uninstall or `adb uninstall` deletes all app data (INSTALL `:71`); `allowBackup=false` leaves no backup copy | Production: per-subject deletion |
| Art. 25 Privacy by design | Architecture | Compliant | Credentials never persisted; log privacy filter; demo list hidden in presentation mode; Simulated-only release; backups off | none |
| Art. 30 Records of processing | Register | N/A (demo) | none | Production |
| Art. 32 Security of processing | Technical measures | Partial | Lockout after 5 failures and a 15-minute idle lock (`auth-provider.tsx:183`); strong biometric. AsyncStorage is unencrypted at rest (synthetic data only) | Production: encrypted storage (Keystore-backed) |
| Art. 33 Breach notification | Alerting | N/A (demo) | none | Production |
| Art. 35 DPIA | Assessment | N/A (demo) | Required before any real interview or evidence data | Production |

**GDPR non-compliances for the demo: 0.** Production gaps: Art. 5 retention, 17, 30, 32 (at-rest encryption), 33, 35.

## 6. ISO 27001 Annex A control mapping (demo scope)

| Control | Check | Status | Finding | Remediation |
|---|---|---|---|---|
| A.9 Access control | Auth, least privilege | Partial | Simulated auth with lockout, idle lock, role gating (sim) and strong biometric without fallback. The binding is event-based (I-06) | Production: Keystore-bound biometric, a real IdP |
| A.10 Cryptography | Signing, key management | Compliant (demo) | RSA-2048 / SHA256withRSA DEMO key; random 128-bit password, mode 600, git-ignored, never logged (§3.1). No transport crypto needed (no egress) | Production: managed signing identity (Play App Signing or HSM) |
| A.12.4 Logging | Security events | Compliant | Persistent, privacy-filtered runtime log (`log.ts`); sim audit chain | none |
| A.12.6 Vulnerability management | Dependency scan | CAUTION | F63-04 in the bundle. The high advisories are web-only (§3.9) | Known issue |
| A.13 Communications | Network exposure | Compliant | No egress; release cleartext blocked; loopback only (§3.4) | none |
| A.14.2 Secure development | Dev/release separation | Compliant with one exception | `__DEV__` gates proven in bytecode (§3.3). Exception: F63-02 | F63-02 |
| A.16 Incident management | Response plan | N/A (demo) | none | Production |
| A.18 Compliance | Licences, regulatory | CAUTION | F63-03 (notices not shipped). Install guide follows the Indonesian developer-verification rules (06 §2.9) | F63-03 |
| ISO 27701 PII | PIMS | N/A (synthetic data) | none | Production |

**ISO control gaps for the demo: 2** (A.12.6 via F63-04, A.18 via F63-03); A.14.2 has one exception (F63-02).

## 7. Summary counts

- Total findings: 16. That is 6 CAUTION items (F63-01 to F63-06) and 10 informational notes (I-01 to I-10).
- Critical or high: 0.
- Medium (gate mapping of CAUTION): 6, each of low risk in context.
- Low or informational: 10.
- GDPR non-compliances (demo scope): 0.
- ISO control gaps (demo scope): 2.

## 8. Next steps

1. **Step 96:** apply F63-01 (install-guide lines) and F63-03 (release licence folder) if time allows; otherwise move both to the known-issues list. If step 96 rebuilds the APK, back up the debug APK before prebuild (F63-05, D117) and re-run AC-PK-A8 on the new artefacts.
2. **Known issues (final report):** F63-02, F63-04, F63-05, F63-06, plus I-01 to I-08 as optional hardening.
3. **Step 62:** owns the undici/Scalar advisories (D45) on the web side.
4. **Production readiness (outside the demo):** the GDPR gaps in §5 and the A.9/A.10 items in §6.

---
*Generated: 2026-10-01 11:12 WIB*
*Last Updated: 2026-10-01 11:12 WIB*
