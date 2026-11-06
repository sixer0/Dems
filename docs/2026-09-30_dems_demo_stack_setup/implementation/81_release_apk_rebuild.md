---
step: 94c
decision: D128, D129
agent: coder-execution
tier: 3
status: complete
date: 2026-10-01
window: 11:31–11:42 WIB
---

# 81: Release APK rebuild for the new tagline: not needed (step 94c, D129)

**Result: rebuild not needed. The released APK is unchanged.** `release/android/DEMS-Demo-0.1.0.apk` is still the step-94 build verified by step 96: 142,592,154 B, SHA-256 `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd`.

## 1. Why no rebuild

The mobile app never renders the hero tagline, so a rebuild changes nothing a user can see.

| Check (11:34 WIB) | Command | Result |
|---|---|---|
| Mobile references to the hero lines | `/usr/bin/grep -rIn -E "heroLine1\|heroLine2" apps/mobile` (minus node_modules, android, .expo, dist) | 0 hits |
| Old tagline in mobile or shared source | `/usr/bin/grep -rIn -i -E "trusted recording\|safer tomorrow" apps/mobile packages` (same exclusions) | 0 hits |
| Positive control: what mobile Login does render | `/usr/bin/grep -rIn -E "common\.brand\.(tagline\|triplet)" apps/mobile/src` | `login-brand.tsx:124` (`tagline`), `login-screen.tsx:118` (`triplet`) |
| Positive control: who uses the hero lines | same pattern over `apps/core-web/src packages/shared/src` | web only: `dashboard/hero-panel.tsx:137`, `login/brand-panel.tsx:240-241`; source `i18n/en/common.ts:16-17` |
| All `common.brand.*` keys read by mobile | `grep -rIhoE "common\.brand[.\[]…"` over `apps/mobile/src` | `name`, `tagline`, `triplet`, `version`, `wordmark` only; no dynamic key access |
| Text baked into images | viewed `assets/images/brand/splash-1024.png`; step-94 Login screenshot `94_dems_phone_release_login.png` | emblem only; Login shows "Digital Evidence Recording Controller" |

Same finding as step T1 (`implementation/80_tagline.md`, Findings).

## 2. What happened in this step

| Time | Event |
|---|---|
| 11:33 | Backups to the session scratchpad: `app-debug.apk` (`cb6b1f51…0be5`), the release APK, `.apk.sha256`, `SHA256SUMS.txt`, `BUILD-INFO.txt`, `INSTALL-ANDROID.md` |
| 11:33:58 | `80_tagline.md` appeared |
| 11:34:14 | `apps/mobile/scripts/build-release-apk.sh` started (outside the sandbox; it holds `.locks/gradle.lock`) |
| 11:34 | D129 arrived after the build had started. As instructed, the build was left to finish |
| 11:40:26 | `BUILD SUCCESSFUL in 6m 8s`. The script overwrote the APK, `.apk.sha256`, `SHA256SUMS.txt` and `BUILD-INFO.txt` in `release/android/` |
| 11:40:35 | All four restored from the backups; debug APK restored. For about 9 s (11:40:26–11:40:35) `release/android/` held the discarded build |

Restore evidence (`cmp` against the backups, 11:40): "apk identical", "sums identical", "buildinfo identical", "sha256 file identical", "debug apk identical". `shasum -a 256 -c SHA256SUMS.txt` → 8 OK (APK + 7 `licenses/` lines from step 94b). Debug APK: `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5`.

No device session ran. Only read-only adb queries were made (`adb devices`; `getprop`, `pm list packages`, `reverse --list` on emulator-5556 and -5558 at 11:33). emulator-5554 was not addressed. After the build: three emulators still `device`; listeners on 5173, 4400 and 8081 still present; 0 Gradle processes left.

## 3. INSTALL-ANDROID.md (F96-5)

Two lines changed, nothing removed from step 94b's additions:

- Section 5, first bullet: tap **Demo operators** below the sign-in card to expand the list (it starts collapsed), tap an operator to fill in the username and password, then tap **Sign In**; typing the username and `demo-2026` still works.
- Section 8, "Masuk" line: the same in Indonesian.

Checked against the code: the list is a collapsed `Accordion` and a row only fills the form (`login-card.tsx:473, 489`). `SHA256SUMS.txt` does not list `INSTALL-ANDROID.md`, so it needed no refresh.

## 4. Notes for the controller

| ID | Type | Note |
|---|---|---|
| N-94c-1 | fact | The released APK carries the **old** hero strings as unused data. `grep -c -a -F` on `assets/index.android.bundle` of `0009f33d…`: "TRUSTED RECORDING" 1, "FOR A SAFER TOMORROW" 1, "SECURE BY DESIGN." 0, "TRUSTED BY LAW." 0. The shared `common` tree is bundled whole; no mobile screen reads these two keys (§1). Visible only to someone who inspects the bundle |
| N-94c-2 | fact | The discarded build: 142,592,150 B, SHA-256 `4fd194ade7d20ac2a285e3c8204d2a2dd7d2fe2e30220c818686d1a8651a1298`; its bundle has the new strings (1 and 1) and not the old ones (0 and 0). It was not verified further (no apksigner, badging, media or device checks) and is **not released**. It still sits at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (git-ignored build output); I did not delete it |
| N-94c-3 | incident (mitigated) | `expo prebuild` cleared `android/` again ("Clearing android … Cleared android code"), the same as DR-94-1 / F63-05, and removed `app-debug.apk`. Restored byte-identical from the backup. The regenerated `android/` is from 11:34, not the step-94 tree |
| N-94c-4 | hygiene | Keystore password: count-only grep of the build log → 0 (positive control 1); 0 files under `release/android/` or this step's docs contain it |
| N-94c-5 | open choice | If the tagline should appear on the tablet, that is a mobile UI change (a new text on Login), then a rebuild with a PATCH bump to 0.1.1 / 101 per 06 §2.5. Not done; not in this step's scope |

Files written: `release/android/INSTALL-ANDROID.md`; `apps/mobile/android/**` (regenerated build output); this file; `delegation_progress/coder_execution_step_94c.md`. Not written: `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `99_implementation_report.md` (parallel run, controller-owned). Nothing committed; no npm install.

---
*Generated: 2026-10-01 11:42 WIB*
