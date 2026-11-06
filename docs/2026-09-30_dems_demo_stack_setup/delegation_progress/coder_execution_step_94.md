---
step: 94
agent: coder-execution
status: complete
started: 2026-10-01T10:25+07:00
finished: 2026-10-01T10:48+07:00
---

# Step 94: Android release APK (progress)

| Time (WIB) | Event |
|---|---|
| 10:25 | Inputs read: row 94 (rev 6), 06_packaging_spec §1.2, §2, §4.1–4.2, D110, D112. `.gitignore` already has `/release/` and `apps/mobile/signing/` (step 100): `git check-ignore -v` → `.gitignore:61:/release/` and `.gitignore:62:apps/mobile/signing/`. Nothing appended |
| 10:27 | `apps/mobile/scripts/create-demo-keystore.sh` written and run: PKCS12, alias `dems-demo`, DN with DEMO ONLY, cert SHA-256 `99:5C:1E:38:…:16:47`; both files mode 600; password never printed |
| 10:28 | `apps/mobile/plugins/with-dems-release-signing.js` written (idempotence probe: marker count 1 after two applications); `app.json`: versionCode 100, allowBackup false, 3 blockedPermissions, plugin entry; `expo config --type introspect` resolves it |
| 10:30 | Heartbeat gating (D112, step 91 item): `isCoreLinkSourceAvailable` / `effectiveCoreLinkSource` in `src/runtime/core-link.ts`, Settings option disabled in release with a developer-only hint; new `heartbeat-release-gate.test.tsx` 5/5 |
| 10:33 | Inputs 59, 61, 74 already present → Phase B now. Quick gate: tsc 0, eslint 0, jest 811/833 (failures listed in the log); my plugin broke one plugin-list assertion in `brand-media.test.ts` → updated |
| 10:34 | `build-release-apk.sh` started under `.locks/gradle.lock` (outside sandbox). Debug APK backed up first (sha256 `cb6b1f51…0be5`) |
| 10:34–10:41 | Prebuild cleared `android/` as "malformed" even without `--clean` (DR-94-1), and the debug APK went with it. Gradle `BUILD SUCCESSFUL in 6m 31s`. Debug APK restored afterwards, byte-identical (`cb6b1f51…0be5`) |
| 10:41 | `release/android/DEMS-Demo-0.1.0.apk`: 142,592,154 B, SHA-256 `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd`. AC-PK-A1..A7 PASS (A8 left to step 63) |
| 10:42–10:46 | A9 on `dems_phone` (emulator-5554), no Metro and no reverse rules. Debug app uninstalled, release installed (vc 100, not debuggable). Login, then Demo operator, then Home; Settings shows Heartbeat disabled; 0 FATAL. Debug APK reinstalled (vc 1, DEBUGGABLE). 8 screenshots `94_dems_phone_release_*.png` |
| 10:47 | Log `implementation/69_release_apk.md` written |

**Status: complete.**

**Files written:**
- `apps/mobile/scripts/create-demo-keystore.sh` and `apps/mobile/scripts/build-release-apk.sh`
- `apps/mobile/plugins/with-dems-release-signing.js`
- `apps/mobile/signing/{dems-demo-release.p12,release-signing.properties}` (git-ignored, mode 600)
- `apps/mobile/app.json` (versionCode, allowBackup, blockedPermissions, plugin)
- `apps/mobile/src/runtime/core-link.ts` and `src/runtime/index.ts` (Heartbeat gate)
- `apps/mobile/src/features/settings/preferences-section.tsx` and `i18n.ts`
- `apps/mobile/src/features/settings/heartbeat-release-gate.test.tsx` (new)
- `apps/mobile/src/components/media/brand-media.test.ts` (plugin-list pin)
- `release/android/{DEMS-Demo-0.1.0.apk,.apk.sha256,SHA256SUMS.txt,BUILD-INFO.txt,INSTALL-ANDROID.md}`
- `implementation/69_release_apk.md` and `implementation/assets/mobile/94_dems_phone_release_*.png` (8 screenshots)

**For the controller (P8, left to you):**
1. Set row 94 to done in `02_plan.md` and `status_tasks.md`.
2. The step-91 release item (Heartbeat disabled in release) is implemented and tested here.
3. Jest has 21 failures, none from step 94: 18 are step-70 navigation stubs, 2 are step 54 (keep-awake, EV-0005; D115/91a) and 1 is the MA-20 haptics offenders in `storage-screen.test.tsx`.
4. DR-94-1: any later prebuild may clear `android/` again. Back up `app-debug.apk` before it.
