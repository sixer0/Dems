# coder-execution — step 94c (release APK rebuild for the new hero tagline, D128) progress

Status: complete

| Time (WIB) | Event |
|---|---|
| 11:31 | Started. `implementation/80_tagline.md` not there yet; polling every 30 s (max 20 min). Read implementation/69_release_apk.md, verification/09_mobile_security.md F63-05, verification/12 F96-5, device-session.sh, build-release-apk.sh |
| 11:33 | Debug APK backed up to the session scratchpad: SHA-256 cb6b1f51…0be5 (324,503,614 B), matches the expected hash. Old release APK (0009f33d…5ecd), SHA256SUMS.txt, BUILD-INFO.txt and INSTALL-ANDROID.md also copied there for comparison |
| 11:33 | Observation for the controller: mobile Login renders `common.brand.tagline` (login-brand.tsx:124) and `common.brand.triplet` (login-screen.tsx:118, tablet), not `heroLine1/heroLine2`. No file under apps/mobile/src references heroLine1/2. Waiting for 80_tagline.md to see what step T1 changed on mobile |
| 11:33 | F96-5 applied to release/android/INSTALL-ANDROID.md (section 5 first bullet + the Indonesian "Masuk" line): tap **Demo operators** to expand, tap an operator, tap **Sign In**. Step 94b's additions untouched |
| 11:33:58 | `implementation/80_tagline.md` found (written 11:33). T1 confirms the mobile app does not render heroLine1/2 |
| 11:34:14 | `build-release-apk.sh` started (outside the sandbox; it takes `.locks/gradle.lock` itself). Prebuild printed "Clearing android … Cleared android code" again (same as DR-94-1), so `app-debug.apk` is gone from android/ until restored from the backup |
| 11:34 | **Controller change D129 received after the build had started: do NOT rebuild.** Per the instruction the running build is left to finish, its output is discarded, the debug APK is restored byte-identical and release/android/DEMS-Demo-0.1.0.apk stays 0009f33d…5ecd. `.apk.sha256` also backed up (the script overwrites it, SHA256SUMS.txt and BUILD-INFO.txt at its end) |
| 11:40:26 | Build ended: `BUILD SUCCESSFUL in 6m 8s`, script exit 0. It wrote a new APK (142,592,150 B, SHA-256 4fd194ad…1298) and new checksum/BUILD-INFO files into release/android/ |
| 11:40:35 | Discarded: release APK, `.apk.sha256`, `SHA256SUMS.txt`, `BUILD-INFO.txt` restored from the backups (`cmp`: all identical; `shasum -c`: 8 OK; APK 0009f33d…5ecd). Debug APK restored, `cmp` identical, cb6b1f51…0be5 |
| 11:41 | (a) grep: 0 mobile references to heroLine1/2, 0 hits for the old tagline in apps/mobile and packages; controls hit. Old release bundle holds the old strings as unused data (1/1), new strings 0/0; discarded build is the reverse. Build log password count 0 (control 1). 3 emulators still `device`, 5173/4400/8081 still listening, 0 Gradle processes. No device session was run |
| 11:42 | Wrote implementation/81_release_apk_rebuild.md |

## Files

- Modified: `release/android/INSTALL-ANDROID.md` (F96-5, 2 lines)
- Regenerated build output: `apps/mobile/android/**` (prebuild + Gradle; debug APK restored into it)
- Unchanged after restore: `release/android/DEMS-Demo-0.1.0.apk`, `.apk.sha256`, `SHA256SUMS.txt`, `BUILD-INFO.txt`, `licenses/**`
- Docs: `implementation/81_release_apk_rebuild.md`, this file

## Blockers / decisions for the controller

- None blocking.
- The released APK's bundle still contains the old hero strings as unused data (never rendered). See 81 §4 N-94c-1.
- An unreleased, unverified APK (4fd194ad…1298) remains at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- Not written (parallel run): masterplan/02_plan.md, status_tasks.md, delegation_progress_report.md, 99_implementation_report.md.
