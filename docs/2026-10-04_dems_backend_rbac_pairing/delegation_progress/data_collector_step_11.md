---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: 11
agent: data-collector
status: complete
date: 2026-10-04
last_updated: 2026-10-04 02:45
---

# Progress: row 11, device credential and QR collection

## Status

complete

## Files created or updated

| Path | Kind |
|---|---|
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/02f_collection_device_credential_qr.md` | Deliverable (Tier 2), 475 lines |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_collector_step_11.md` | This progress file |

No other workspace file was written. `delegation_progress_report.md` and `status_tasks.md` were not touched (parallel run).

## Milestones

1. Read row 11 of `identification/02_structured.md`, `apps/mobile/package.json`, `apps/mobile/app.json` and quoted the installed Expo modules and plugins with file:line (section 2 of the deliverable).
2. Topic A (credential storage): 3 candidates (expo-secure-store 57.0.4, react-native-keychain 10.0.0, react-native-sensitive-info 6.1.5) plus 3 reference items (expo-local-authentication, AsyncStorage, react-native-mmkv) and Android platform sources (Keystore, Auto Backup, adb, emulator fingerprint).
3. Topic B (QR rendering, React 19 web): 5 candidates (qrcode.react 4.2.0, react-qr-code 2.2.0, qrcode 1.5.4, uqr 0.1.3, react-qrcode-logo 4.1.0).
4. Topic C (QR scanning, RN 0.86 on Expo): 4 candidates (expo-camera 57.0.6 with two Android modes, react-native-vision-camera 5.2.3 with barcode-scanner 5.2.3, react-native-camera-kit 18.0.1, react-native-data-scanner 0.1.2) plus 1 excluded item (expo-barcode-scanner, no SDK 57 version).
5. Every candidate row carries version, licence, SDK 57 compatibility as sourced, native rebuild need and a URL; FD is 2026-10-04.
6. Query log (9 WebSearch strings, 11 WebFetch URLs, curl and npm lookups) scanned for project and design terms: no match.

## Facts the controller may want to record (collected, not analysed)

- No secure-storage module and no camera module is installed in `apps/mobile`; `expo-local-authentication ~57.0.3` is installed and its plugin is at `apps/mobile/app.json:47`.
- Expo SDK 57 bundles expo-secure-store `~57.0.4` and expo-camera `~57.0.6` (`node_modules/expo/bundledNativeModules.json:80`, `:34`). None of react-native-keychain, react-native-sensitive-info, react-native-vision-camera, react-native-camera-kit, react-native-mmkv is in that list.
- All credential-storage and scanning candidates need native code, hence a new debug binary. All five QR-rendering candidates are web-only with no native need.
- The three host AVDs are Google APIs images with `PlayStore.enabled=no` and `hw.camera.back=none`, `hw.camera.front=none` (`~/.android/avd/*/config.ini`).
- expo-secure-store docs state emulators "do not require biometric authentication when retrieving secrets"; on Android its data is not preserved on uninstall.
- Android emulator docs state QR images can be imported into the camera's virtual scene (Extended controls).

## Blockers

None. The deliverable is complete for the row 11 verification (at least 2 candidates per topic with version, licence, SDK 57 compatibility, URL with fetch date; native rebuild need per candidate; clean query log).

## Items marked "not confirmed" (see deliverable section 9)

Biometric item behaviour on the host AVDs; Keystore outcome of `adb install -r`; vendor statements naming Expo SDK 57 / RN 0.86 for the third-party native libraries; expo-camera preview and Google code scanner on the camera-less Google APIs AVDs; star and issue counts for react-native-vision-camera (GitHub API rate limit); React 19 primary-source statements for react-qr-code, qrcode and uqr.

## Deviations and decisions to record

1. One command ran `avdmanager list avd | head -2` (read-only listing, starts a Java tool; no emulator, no adb) plus `ls ~/.android/avd`. The AVD facts then came from a `grep` of eleven keys in three `config.ini` files. Disclosed in deliverable section 8.
2. Fetched documents were stored in the session scratch folder (`$TMPDIR/c11`) outside the workspace for grepping.
3. The unauthenticated GitHub API rate limit was exhausted late; later facts came from raw.githubusercontent.com and unpkg.com.
4. `apps/mobile/signing/` was not opened. Five lines of `apps/mobile/plugins/with-dems-release-signing.js` were read (a plugin file outside `signing/`).
5. No sandbox bypass was used. No install, no server, no emulator, no adb.
6. Decision (collector, no design effect): react-native-mmkv and expo-local-authentication are listed as reference items, not as Keystore-backed candidates, because the former encrypts with a caller-supplied key and the latter only returns a prompt verdict; expo-barcode-scanner is listed as excluded because npm has no SDK 57 version and the v57 docs page returns 404.
