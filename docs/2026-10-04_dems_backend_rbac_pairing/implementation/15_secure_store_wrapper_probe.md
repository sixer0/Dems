---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
step: 37
plan_row: W15
date: 2026-10-04
agent: coder-execution
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
status: complete
tier: 3
---

# Step 37 (W15): early proof (g), the secure-store wrapper, its jest mocks and the emulator probe

Time box 60 minutes: started 11:16:27 WIB, last gate 11:36 WIB. Kept.

## 1. Result at a glance

| Point | Result | Evidence |
|---|---|---|
| The wrapper | `apps/mobile/src/runtime/secure-credentials.ts` (410 lines): the only importer of `expo-secure-store`; read, write and delete of the three items; the MB-6a rule; a debug-only probe export | Section 3; `assets/15_release_transform.log` |
| jest mocks | `expo-secure-store` (in-memory map with switches) and `expo-device` (switchable `isDevice`) in `apps/mobile/jest.setup.ts`; additive | Section 4; `assets/15_jest_setup.diff` |
| Tests | 2 new suites, 37 new tests. `@dems/mobile`: 72 suites / 833 tests before, **74 suites / 870 tests, exit 0** after | Section 8 |
| Static test (AC-C-66) | Exactly one file under `apps/mobile/src/` names the package: `runtime/secure-credentials.ts` | Section 5 |
| Probe on the three AVDs | 14 PASS, 0 FAIL on each, twice (6 sessions, each exit 0). Every session: **without enrolment** | Section 6 |
| Unprotected item | Write, read (equal), delete, read (nothing): works on all three | Section 6.2 |
| Protected item | The write is refused before any prompt: `ERR_AUTHENTICATION`, message class "no biometrics enrolled". Nothing is stored, so the protected read and the rotation write have nothing to act on. No system window appeared | Section 6.2 |
| `isDevice` | `false` on all three; API level 36 | Section 6.2 |
| MB-5 case | **Case (c) on all three AVDs**: the token is stored without `requireAuthentication` (allowed by MB-6a: `isDevice` is false and the build is a debug build) | Section 7 |
| Unobserved | The protected path WITH an enrolled fingerprint (write, read, rotation write, and whether each prompts) | Section 7.2 |
| Probe item afterwards | Absent: final read gives nothing; `shared_prefs/SecureStore.xml` holds 0 entries on each device | Sections 6.2, 6.3 |
| Release bundle | No probe text: 0 of 11 texts in the release bundle; positive controls present | Section 9 |
| Device security | Unchanged: `isKeyguardShowing=false`, `CredentialType: NONE`, fingerprint count 0 at the start and at the end of every session and at 11:33:01 | Section 6.3 |
| One-command re-probe | `/bin/sh docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/15_run_w15.sh phone tablet` | Section 10 |

## 2. Files

| Path | Change | SHA-256 (11:34:10) |
|---|---|---|
| `apps/mobile/src/runtime/secure-credentials.ts` | Created (410 lines) | `0fce0575...5f22b1` |
| `apps/mobile/src/runtime/secure-credentials.test.ts` | Created (382 lines, 33 tests) | `6738214c...0cc33d` |
| `apps/mobile/src/runtime/secure-store-import.test.ts` | Created (74 lines, 4 tests) | `35a95ee6...e09361` |
| `apps/mobile/jest.setup.ts` | Modified: 178 lines added, 1 changed (`import { beforeEach, jest }`) | `55120261...e30f36` |
| `apps/mobile/src/runtime/dev-probes.ts` | Modified: 148 lines added, 1 changed (the log prefix line) | `5f150d35...2baac1` |

Not touched: `apps/mobile/src/runtime/debug.ts` (`793af43d...1f4a71`, as before), `apps/mobile/scripts/device-session.sh`, any `package.json`, any native file. No `npm install`, no Gradle.

Pre-images (P23), saved at 11:18:37 before the first edit:

| Path | Pre-image | Note |
|---|---|---|
| `apps/mobile/src/runtime/dev-probes.ts` | `.cache/rollback/W15/dev-probes.ts.pre`, SHA-256 `79d2a7a9...a59ba2` | The file is not in `acaff20` (W12 created it; untracked), so `git diff acaff20` gives nothing for it. The copy is the pre-image |
| `apps/mobile/jest.setup.ts` | `.cache/rollback/W15/jest.setup.ts.pre`, SHA-256 `f42f0ebf...dd75bc` | Equal to `acaff20` (`git diff acaff20` was empty) |
| both | `.cache/rollback/W15.pre.patch` | 0 bytes, for the two reasons above |

Diffs against the pre-images: `assets/15_dev_probes.diff`, `assets/15_jest_setup.diff`.

## 3. The wrapper (`apps/mobile/src/runtime/secure-credentials.ts`)

### 3.1 Storage rules

| Item | Key | Value | Authentication requirement | Written by |
|---|---|---|---|---|
| Device credential | `dems.live.device.v1` | JSON of `PairingRedeemed` (`@dems/shared/api`): device ID, credential, `pairedAt`, Core identity | None: the gate reads it at start (spec 9.1) | `writeDeviceCredential` |
| Biometric token | `dems.live.bio.v1` | The `bio_...` string | `requireAuthentication: true`; none only where `Device.isDevice === false` or the build is a debug build (MB-6a) | `writeBiometricToken`, `rotateBiometricToken` |
| Biometric marker | `dems.live.bio.meta.v1` | JSON: `operatorId`, `displayName`, `deviceId`, `protected` | None: not a secret | Only together with the token |
| Probe item (debug builds only) | `dems.live.probe.v1` | A meaningless value made on the device | Either, as the probe asks | `secureStoreDevProbe` |

Rules the module keeps:

| Rule | Where |
|---|---|
| A value is never logged, never in an error, never in a failure result. A failure carries a code, a message class and the native error code | `failureOf`, `record` |
| The native error text is read only to pick the message class; it is never passed on | `reasonOf` |
| Every failure of the three items is written to the persistent runtime log (`./log`, `reportRuntimeIssue`), with the item's name and the codes. Levels: `info` for a cancelled prompt, `warn` for another authentication failure, `error` for everything else | `record` |
| The unprotected biometric item is written only where `isDevice` is false or the build is a debug build; anywhere else the write is refused with `UNPROTECTED_NOT_ALLOWED` and both biometric items are deleted (MB-6a, AC-C-105) | `isUnprotectedBiometricItemAllowed`, `writeBiometricToken`, `rotateBiometricToken` |
| A failed biometric write never leaves a token behind: both items are deleted (MB-6) | `biometricOff` |
| A fallback from protected to unprotected is never silent: a `warn` record `runtime.secureCredentials.biometricFallback`, and the result says `protected: false` | `writeBiometricToken` |
| A cancelled OS prompt is not a reason to fall back, and a failed read deletes nothing (MB-4) | `writeBiometricToken`, `readBiometricToken` |
| Deleting the device credential deletes both biometric items (MB-2) | `deleteDeviceCredential` |
| A stored text of another shape is `CORRUPT_ITEM`; the caller treats the item as absent (MP-4) | `parseStored` |

### 3.2 Public API (exact signatures)

```ts
export const SECURE_ITEM_KEYS = {
  deviceCredential: 'dems.live.device.v1',
  biometricToken: 'dems.live.bio.v1',
  biometricMarker: 'dems.live.bio.meta.v1',
} as const;

export type SecureStoreErrorCode =
  | 'AUTHENTICATION' | 'READ_FAILED' | 'WRITE_FAILED' | 'DELETE_FAILED'
  | 'INVALID_VALUE' | 'CORRUPT_ITEM' | 'BIOMETRIC_NOT_STORED' | 'UNPROTECTED_NOT_ALLOWED';
export type SecureStoreFailureReason =
  | 'NO_BIOMETRICS_ENROLLED' | 'NO_BIOMETRIC_HARDWARE' | 'USER_CANCELED' | 'LOCKOUT'
  | 'IN_PROGRESS' | 'NOT_IN_FOREGROUND' | 'KEY_INVALIDATED' | 'OTHER';
export interface SecureStoreFailure {
  readonly ok: false;
  readonly code: SecureStoreErrorCode;
  readonly reason: SecureStoreFailureReason | null;   // null for a refusal of the wrapper itself
  readonly nativeCode: string | null;                 // e.g. 'ERR_AUTHENTICATION'
}
export type SecureStoreOutcome = { readonly ok: true } | SecureStoreFailure;
export type SecureStoreRead<T> = { readonly ok: true; readonly value: T | null } | SecureStoreFailure;
export type BiometricWriteResult = { readonly ok: true; readonly protected: boolean } | SecureStoreFailure;

export type StoredDeviceCredential = PairingRedeemed;                 // from @dems/shared/api
export type BiometricOwner = { operatorId: string; displayName: string; deviceId: string };
export type BiometricMarker = BiometricOwner & { protected: boolean };
export type BiometricWriteMode = 'protected' | 'unprotected' | 'protected-with-fallback';

export function readDeviceCredential(): Promise<SecureStoreRead<StoredDeviceCredential>>;
export function writeDeviceCredential(value: StoredDeviceCredential): Promise<SecureStoreOutcome>;
export function deleteDeviceCredential(): Promise<SecureStoreOutcome>;        // also deletes both biometric items

export function isUnprotectedBiometricItemAllowed(): boolean;                 // Device.isDevice === false || __DEV__ === true
export function readBiometricMarker(): Promise<SecureStoreRead<BiometricMarker>>;   // never prompts
export function readBiometricToken(prompt?: string): Promise<SecureStoreRead<string>>;
export function writeBiometricToken(token: string, owner: BiometricOwner, mode: BiometricWriteMode, prompt?: string): Promise<BiometricWriteResult>;
export function rotateBiometricToken(token: string, prompt?: string): Promise<BiometricWriteResult>;
export function deleteBiometric(): Promise<SecureStoreOutcome>;

export interface SecureStoreDevProbe { /* itemKey, canUseBiometricAuthentication(), write, read, remove */ }
export const secureStoreDevProbe: SecureStoreDevProbe | null;                 // null in a release build
```

No function throws. `operatorId` must match `OPERATOR_ID_PATTERN`, `deviceId` `DEVICE_ID_PATTERN`, the token `BIOMETRIC_TOKEN_PATTERN`, the device credential `PairingRedeemedSchema` (all from `@dems/shared/api`); anything else is `INVALID_VALUE` and nothing is written.

### 3.3 The biometric write, by mode

| Mode | Protected write passes | Protected write fails (not a cancel) | Protected write cancelled by the operator |
|---|---|---|---|
| `protected` | Stored protected; marker `protected: true` | Both items deleted; the failure is returned | Both items deleted; the failure is returned |
| `unprotected` | (not tried) Where MB-6a allows: stored unprotected, marker `protected: false`. Elsewhere: `UNPROTECTED_NOT_ALLOWED`, both items deleted | same | same |
| `protected-with-fallback` | Stored protected | Where MB-6a allows: stored unprotected, marker `protected: false`, a `warn` record. Elsewhere: both items deleted, the protected failure is returned (a second record says `UNPROTECTED_NOT_ALLOWED`) | Both items deleted; no fallback |

`rotateBiometricToken` writes the new token with the options the marker records (MB-6: "the same options as the old one"); the marker stays. A failing write deletes both items. Without a marker: `BIOMETRIC_NOT_STORED`. An unprotected marker in a place where MB-6a does not allow it: `UNPROTECTED_NOT_ALLOWED`, both items deleted.

### 3.4 The probe-only export

`secureStoreDevProbe` is written as `__DEV__ ? { ... } : null`, with the probe item's name only inside that expression. `dev-probes.ts` calls it; it does not import the package. It writes nothing to the runtime log (the probe prints its own lines). Metro's release transform turns it into `null` (section 9).

## 4. The jest mocks (`apps/mobile/jest.setup.ts`, TS-16)

| Mock | What it is | Switches |
|---|---|---|
| `expo-secure-store` | An in-memory map of `key -> { value, protectedItem }`. `setItemAsync`, `getItemAsync`, `deleteItemAsync`, `setItem`, `getItem`, `isAvailableAsync`, `canUseBiometricAuthentication` (all `jest.fn`), the seven accessibility constants. As on Android, the stored item (not the caller's option) decides whether a read is a protected read | `protectedRead`, `protectedWrite`: `'prompt'` (default: records a prompt, then succeeds), `'pass'` (succeeds without one), `'fail'` (rejects with `code: 'ERR_AUTHENTICATION'` before anything is stored). `failure`: `'not-enrolled'` (default), `'no-hardware'`, `'user-canceled'`, `'lockout'`. `failNext('read' \| 'write' \| 'delete', count)`: a non-authentication failure (`ERR_DECRYPT`, `ERR_WRITE`, `ERR_DELETE`). `canUseBiometricAuthentication`. `prompts`, `seed`, `has`, `isProtected`, `peek`, `keys`, `reset` |
| `expo-device` | The package's own exports (jest-expo already mocks its native module with `isDevice: false`), with `isDevice` and `platformApiLevel` as getters | `isDevice` (default `false`), `platformApiLevel` (default 36), `reset` |

A test reaches the switches through two globals, `__DEMS_SECURE_STORE_MOCK__` and `__DEMS_DEVICE_MOCK__` (typed by a `declare global` in `jest.setup.ts`), so that no file under `src/` has to name the secure-store package. A `beforeEach` in the setup file resets both before every test. The failure texts and codes are the native module's own (`node_modules/expo-secure-store/android/src/main/java/expo/modules/securestore/SecureStoreExceptions.kt`; code inference `expo-modules-core/.../exception/CodedException.kt:33,48-51`), and the device run confirmed `ERR_AUTHENTICATION` with the "no biometrics enrolled" class.

Existing tests: none changed. The 72 suites that existed pass unchanged (section 8).

## 5. The static test (`secure-store-import.test.ts`, AC-C-66)

It reads every `.ts` and `.tsx` file under `apps/mobile/src/` (427 files, tests included) and asserts:

| Test | Assertion |
|---|---|
| the matcher finds every way of naming the package, and nothing else | Six import forms match (`import`, `require`, dynamic `import`, `jest.mock`, `jest.requireActual` of a sub-path, double quotes); four near-misses do not |
| reads the whole source tree | More than 200 files, among them the wrapper, `dev-probes.ts` and the test itself |
| exactly one file names the package: the wrapper | `filesMatching(SPECIFIER)` equals `['runtime/secure-credentials.ts']` |
| no file reaches the native module by its own name | No quoted native module name anywhere (a `requireNativeModule` call would go around the package) |

The package name is put together in the test, so the test file does not hold the text it looks for.

## 6. The probe on the emulators

### 6.1 What ran

Probe `secure-store` in `apps/mobile/src/runtime/dev-probes.ts`, started by the existing debug hook (`debug.ts`, unchanged): `demsdemo:///?probe=secure-store&run=<id>`. Its lines carry the tag `[DEMS-PROBE-W15 run=<id>]`. The W12 probe is unchanged (its tag and its lines; `LOG_TAGS[name] ?? LOG_TAG`).

| Step | What it does | PASS means |
|---|---|---|
| S0 | `Device.isDevice`, API level, `canUseBiometricAuthentication()`, the three read-only queries of `expo-local-authentication` | The wrapper exports the probe |
| S1 | Reads the probe item | Absent (a leftover would be deleted and reported) |
| U1 to U4 | Unprotected: write, read, delete, read | Each as expected (these must work) |
| P1 to P6 | Protected (`requireAuthentication: true`): write, read, rotation as delete and write of a new value, write over the stored value (the wrapper's own rotation path), read | **An observation was recorded**, whatever the step did: `ok`, `threw` (code, message class, native code) or `pending` (not settled within 8 s: an OS prompt is waiting) |
| Z1, Z2 | Delete of the probe item; final read | Absent |

Device commands: `assets/15_device_w15.sh`, run inside `apps/mobile/scripts/device-session.sh` by `assets/15_run_w15.sh`. It records the lock state at the start and at the end (read-only), the app's stored names and sizes before and after, a focus timeline (`dumpsys window`, every change of the focused window; a window that is neither the app nor the launcher is photographed and left alone), and two screencaps.

| Session | Device | Metro port | Time | Exit | Folder under `assets/15_runs/` |
|---|---|---|---|---|---|
| Run 1 | `dems2_phone` (`emulator-5554`) | 8082 | 11:29:16 to 11:29:28 | 0 | `phone-w15x112916` |
| Run 1 | `dems2_tablet` (`emulator-5556`) | 8083 | 11:29:37 to 11:29:49 | 0 | `tablet-w15x112937` |
| Run 1 | `dems2_phone2` (`emulator-5558`) | 8084 | 11:29:49 to 11:30:02 | 0 | `phone2-w15x112949` |
| Run 2 | `dems2_phone` | 8082 | 11:31:35 to 11:31:57 | 0 | `phone-w15x113135` |
| Run 2 | `dems2_tablet` | 8083 | 11:31:57 to 11:32:21 | 0 | `tablet-w15x113157` |
| Run 2 | `dems2_phone2` | 8084 | 11:32:21 to 11:32:43 | 0 | `phone2-w15x113221` |

The Metro port is the runner's choice (`device-session.sh` takes `METRO_PORT` from its caller): 8082, 8083 and 8084. One session at a time. No `DEMS_CORE_HOST_PORT`, no `tcp:4420` rule. Run 2 exists because run 1's screencap fell into the app's opening animation; run 2 adds a second screencap 7 s later and is the one-command run of all three devices (`15_run_w15.sh` without arguments, exit 0, 68 s).

### 6.2 Observations per AVD (all sessions: without enrolment)

Lock state at the start of every session (read-only): `isKeyguardShowing=false`, user 0 `RUNNING_UNLOCKED`, `CredentialType: NONE`, `"count":0` fingerprints.

| | `dems2_phone` | `dems2_tablet` | `dems2_phone2` |
|---|---|---|---|
| Enrolment label | without enrolment | without enrolment | without enrolment |
| `Device.isDevice` | `false` | `false` | `false` |
| API level | 36 | 36 | 36 |
| `Device.deviceType` | 1 (phone) | 2 (tablet) | 1 (phone) |
| `SecureStore.canUseBiometricAuthentication()` | `false` | `false` | `false` |
| `expo-local-authentication` | hardware `true`, enrolled `false`, level 0 | same | same |
| Unprotected write / read / delete / read | ok 90 ms / equal 25 ms / ok 12 ms / absent 5 ms | ok 167 / equal 7 / ok 8 / absent 1 | ok 230 / equal 46 / ok 34 / absent 3 |
| **MB-8 (1) protected write succeeds?** | **No.** Threw in 3 ms (run 2: 47 ms): `AUTHENTICATION`, class `NO_BIOMETRICS_ENROLLED`, native `ERR_AUTHENTICATION`. No prompt | **No.** 3 ms (36 ms), the same codes. No prompt | **No.** 12 ms (33 ms), the same codes. No prompt |
| **MB-8 (2) protected read prompts?** | **No prompt.** The read settled in 2 ms (45 ms) with "absent": the write stored nothing, so there is no protected item to read | **No prompt.** 0 ms (11 ms), absent | **No prompt.** 13 ms (94 ms), absent |
| **MB-8 (3) rotation write prompts?** | **No prompt.** Delete ok; the write of the new value threw in 2 ms (32 ms), the same codes; the write in place threw in 1 ms (9 ms) | **No prompt.** Threw in 1 ms (34 ms); in place 1 ms (47 ms) | **No prompt.** Threw in 2 ms (8 ms); in place 1 ms (3 ms) |
| System window during the probe | None: the focus stayed on `com.dems.demo.tablet/.MainActivity`; 0 other windows in both runs | None | None |
| Probe item after the run | Absent (Z2 read; 0 entries in `SecureStore.xml`) | Absent | Absent |
| Probe result | 14 PASS, 0 FAIL, twice | 14 PASS, 0 FAIL, twice | 14 PASS, 0 FAIL, twice |
| **MB-5 case that follows** | **(c)** | **(c)** | **(c)** |
| Screencap at the end of the probe (run 1) | `assets/15_dems2_phone_probe.png` | `assets/15_dems2_tablet_probe.png` | `assets/15_dems2_phone2_probe.png` |
| Screencap 7 s later (run 2) | `assets/15_dems2_phone_settled.png` | `assets/15_dems2_tablet_settled.png` | `assets/15_dems2_phone2_settled.png` |

What the screencaps show (read by this row): the three `_probe` images show the app's opening animation, about one second after the probe's last line, with no dialog over it. The three `_settled` images show the sign-in screen: "Core online", "Core: DEMS-IR-01 • paired (simulated)", "Biometrics not set up on this device", no dialog, no error toast.

All lines of all six runs: `assets/15_observations_summary.txt` (made from the six `logcat_probe.txt` files). Run 1 on `dems2_phone`, verbatim from the device log (`adb logcat -d -s ReactNativeJS:V`):

```
10-04 11:29:23.942 I ReactNativeJS: [DEMS-PROBE-W15 run=w15x112916] START secure-store
10-04 11:29:24.831 ... S0 environment PASS {"isDevice":false,"platformApiLevel":36,"osVersion":36,"model":"sdk_gphone64_arm64","deviceType":1,"debugBuild":true,"canUseBiometricAuthentication":false,"unprotectedBiometricItemAllowed":true,"localAuthentication":{"hasHardware":true,"isEnrolled":false,"enrolledLevel":0},"item":"dems.live.probe.v1","waitMs":8000}
10-04 11:29:24.896 ... S1 probe item absent before the run PASS {"outcome":"ok","ms":61,"leftoverDeleted":false}
10-04 11:29:24.986 ... U1 unprotected write PASS {"outcome":"ok","ms":90}
10-04 11:29:25.011 ... U2 unprotected read gives the written value PASS {"outcome":"ok","ms":25,"read":"equal","length":34}
10-04 11:29:25.025 ... U3 unprotected delete PASS {"outcome":"ok","ms":12}
10-04 11:29:25.031 ... U4 read after the delete gives nothing PASS {"outcome":"ok","ms":5,"read":"absent"}
10-04 11:29:25.035 ... P1 protected write PASS {"outcome":"threw","ms":3,"code":"AUTHENTICATION","messageClass":"NO_BIOMETRICS_ENROLLED","nativeCode":"ERR_AUTHENTICATION"}
10-04 11:29:25.038 ... P2 protected read PASS {"outcome":"ok","ms":2,"read":"absent"}
10-04 11:29:25.038 ... P3 rotation: delete of the old value PASS {"outcome":"ok","ms":0}
10-04 11:29:25.040 ... P4 rotation: protected write of a new value PASS {"outcome":"threw","ms":2,"code":"AUTHENTICATION","messageClass":"NO_BIOMETRICS_ENROLLED","nativeCode":"ERR_AUTHENTICATION"}
10-04 11:29:25.041 ... P5 rotation in place: protected write over the stored value PASS {"outcome":"threw","ms":1,"code":"AUTHENTICATION","messageClass":"NO_BIOMETRICS_ENROLLED","nativeCode":"ERR_AUTHENTICATION"}
10-04 11:29:25.042 ... P6 protected read after the rotation PASS {"outcome":"ok","ms":0,"read":"absent"}
10-04 11:29:25.044 ... Z1 delete of the probe item PASS {"outcome":"ok","ms":1}
10-04 11:29:25.045 ... Z2 probe item absent after the run PASS {"outcome":"ok","ms":1,"read":"absent","protectedStepPending":false}
10-04 11:29:25.045 ... DONE secure-store pass=14 fail=0
```

(`...` stands for `5954 5985 I ReactNativeJS: [DEMS-PROBE-W15 run=w15x112916]`.) A PASS on a P line means "observed", not "succeeded": the `outcome` member says what the step did. Nothing was done to make a protected step pass.

### 6.3 The app and the devices afterwards (`assets/15_after_state.txt`, 11:33:01, read-only)

```
=== emulator-5554  avd=dems2_phone
reverse --list: [;]
isKeyguardShowing=false
user 0: State: RUNNING_UNLOCKED
CredentialType: NONE
fingerprints: "count":0
app process (pidof; empty = not running): []
secure-store entries: [0] (count of <string> entries in shared_prefs/SecureStore.xml)
AsyncStorage keys: [dems.mobile.log.v1|3056 dems.sim.v1|119907 ]
=== emulator-5556  avd=dems2_tablet
reverse --list: [;]
isKeyguardShowing=false
user 0: State: RUNNING_UNLOCKED
CredentialType: NONE
fingerprints: "count":0
app process (pidof; empty = not running): []
secure-store entries: [0] (count of <string> entries in shared_prefs/SecureStore.xml)
AsyncStorage keys: [dems.mobile.log.v1|557 dems.sim.v1|119881 ]
=== emulator-5558  avd=dems2_phone2
reverse --list: [;]
isKeyguardShowing=false
user 0: State: RUNNING_UNLOCKED
CredentialType: NONE
fingerprints: "count":0
app process (pidof; empty = not running): []
secure-store entries: [0] (count of <string> entries in shared_prefs/SecureStore.xml)
AsyncStorage keys: [dems.mobile.log.v1|557 dems.sim.v1|119864 ]
== host listeners on 8081-8086 (lsof; none = no Metro left):
lsof exit=1
```

| Point | State | Evidence |
|---|---|---|
| Reverse rules | None on any device. Set and removed by `device-session.sh` (`tcp:8081`, `tcp:4400`); this row set none | above |
| Lock state | Equal at the start and at the end of each of the six sessions, and at 11:33:01: no keyguard, `CredentialType: NONE`, 0 fingerprints. The user's helper did not run in this window | `15_runs/*/lock_state_start.txt`, `lock_state_end.txt`; above |
| Device security | Nothing typed, pressed or set: no `locksettings` write, no `emu finger`, no `settings put`, no settings activity, no `input` at all in `15_device_w15.sh` | `assets/15_device_w15.sh` |
| App | Force-stopped by each session's cleanup; first-run state, Simulated: the same two AsyncStorage keys as before (`dems.sim.v1`, `dems.mobile.log.v1`), no `dems.mobile.prefs.v1` (the Core link source is its default) | above; `15_runs/*/app_data_before.txt`, `app_data_after.txt`, `app_prefs_after.txt`; the `_settled` screencaps |
| What stays (1) | The runtime log holds one more `info runtime.sim.hydrated` record per launch (two launches per device: 2,686 to 3,056 bytes on the phone, 187 to 557 on the other two). The probe and the wrapper wrote no record | read-only listing of record sources at 11:34 (phone: 12 records, the last two `runtime.sim.hydrated` at 04:29:23Z and 04:31:45Z; tablet: 3 records) |
| What stays (2) | An empty `shared_prefs/SecureStore.xml` (65 bytes, 0 entries), created by the first unprotected write | `app_data_after.txt` |
| What stays (3), inferred from the library source, not listed on the device | The Keystore AES key of the unauthenticated alias (`key_v1` family), created by the first unprotected write (`SecureStoreModule.kt:203`, `getOrCreateKeyEntry`); `deleteItemImpl` (`:243`) removes the entry, not the key. It holds nothing and goes with the app's data | source reading |
| `dems.sim.v1` | Rewritten by each launch (a few bytes of difference), as in W12 | above |
| Emulators | PIDs 68181, 68876, 70102: the same as before; none started, stopped, rebooted or wiped | `15_after_state.txt` |
| Host | No listener on 8081 to 8086. Metro PIDs 19852, 20241, 20591, 21416, 21854, 22262 were started and stopped by the six sessions | `15_runs/*/session.log` |

## 7. DP-2 / MB-5: the conclusion

### 7.1 The case on these emulators

**MB-5 case (c) on `dems2_phone`, `dems2_tablet` and `dems2_phone2`**, observed without enrolment: the protected write throws, so the biometric token is stored without `requireAuthentication`, the marker records `protected: false`, and the existing OS prompt of `expo-local-authentication` is the gate. MB-6a allows it there: `isDevice` is `false` on all three, and the build is a debug build (`unprotectedBiometricItemAllowed: true` in S0). This is the outcome D49 and DEPARTURE-6 (D15, D16) expected.

On these emulators as they are, biometric sign-in is unavailable in any case: nothing is enrolled (`isEnrolled: false`), and the sign-in screen says "Biometrics not set up on this device". The biometric parts of the mobile rows are verified by jest (D49).

Cases (a) and (b) presuppose a protected item. On Android without enrolment no protected item can exist: the library refuses the write (finding F37-3).

### 7.2 What is unobserved

No fingerprint is enrolled on any AVD, so the protected path with enrolment was not observed on a device:

| Unobserved | What the library's source says (not a device observation) |
|---|---|
| Does a protected write succeed with enrolment, and does it prompt? | It prompts: `createEncryptedItem` calls `authenticateCipher(cipher, requireAuthentication, ...)` at every protected write (`encryptors/AESEncryptor.kt:88`), which opens a `BiometricPrompt` (`AuthenticationHelper.kt:22-24`) |
| Does a protected read prompt? | It prompts at every read of a protected item (`AESEncryptor.kt:131`); the stored item's flag decides, not the caller's option (`SecureStoreModule.kt:130`) |
| Does the write after a rotation prompt? | It is a protected write: it prompts again (`AESEncryptor.kt:88`). The package's own text: "On Android, user authentication is required for all operations" (`build/SecureStore.d.ts:56`) |

So by the source, a protected token on an Android device with an enrolled fingerprint means one prompt at enrolment and two per biometric sign-in (the read, then the rotation write): the double prompt that DEPARTURE-6 names. That is a hypothesis until a device shows it; the re-probe of section 10 is built to show it.

## 8. Gate (P24) and test ledger

| Check | Command | Result | Log |
|---|---|---|---|
| Mobile tests | `npm run test -w @dems/mobile -- --maxWorkers=2` | **exit 0**; 74 suites, 870 tests passed (11:30:17 to 11:31:02, after the last source edit) | `assets/15_gate_mobile_test.log` |
| Typecheck | `npm run typecheck -w @dems/mobile` | **exit 0** (11:33:35) | `assets/15_gate_static.log` |
| Lint | `npm run lint -w @dems/mobile` | **exit 0** (11:33:41 to 11:33:57) | `assets/15_gate_static.log` |
| Release-gate test | `src/features/settings/heartbeat-release-gate.test.tsx` | PASS, file unchanged (`git hash-object` = `6aa6db7e...f9ac`, equal to `acaff20`) | `assets/15_gate_mobile_test.log` |
| Release bundle | `expo export` (release and development) | No probe text in the release bundle | Section 9 |

```
$ npm run test -w @dems/mobile -- --maxWorkers=2   (start 11:30:17)
PASS src/runtime/secure-credentials.test.ts
PASS src/runtime/secure-store-import.test.ts
PASS src/features/settings/heartbeat-release-gate.test.tsx
Test Suites: 74 passed, 74 total
Tests:       870 passed, 870 total
Snapshots:   0 total
Time:        44.682 s
Ran all test suites.
exit=0   (end 11:31:02)
```

```
$ npm run typecheck -w @dems/mobile   (11:33:35)
> tsc --noEmit
exit=0
$ npm run lint -w @dems/mobile   (11:33:41)
> eslint .
exit=0   (11:33:57)
```

Ledger, `@dems/mobile`: before 72 suites / 833 tests (controller baseline 11:10 to 11:14; the same totals in `assets/12c_gate_mobile_test.log`); after 74 / 870. Added: `src/runtime/secure-credentials.test.ts` (33 tests), `src/runtime/secure-store-import.test.ts` (4 tests). 833 + 37 = 870. No other workspace was run or changed by this row.

Both full runs printed jest's note "A worker process has failed to exit gracefully" once, with exit 0. The second run (`assets/15_gate_mobile_test_run2.log`, 11:34:56 to 11:36:12, load average 6.96): 74 suites, 870 tests passed, exit 0. The note is not new: it is note N-4 of the baseline gate (`initialization/02_baseline_gate.md:276`) and is in `assets/22b_gate_mobile_test.log`, a run of 72 suites / 833 tests from before this row (finding F37-8).

## 9. The release bundle holds no probe (`assets/15_release_bundle_check.log`)

Metro's release transform of the two files (`node assets/15_release_gate_w15.cjs`, the method of W12's `12_release_gate_w12.cjs`):

```
debug build  (dev=true)  debug.ts              {"required":[...,"./log","./dev-probes"],"hasProbeModule":true,"hasProbeHook":true}
debug build  (dev=true)  secure-credentials.ts {"required":[...,"expo-device","expo-secure-store","zod","@dems/shared/api","./log"],"hasProbeItemName":true,"hasProbePromptTitle":true,"probeExport":"object","hasDeviceItemName":true,"hasUnprotectedRule":true}
    debug build holds the probe=ok
release build (dev=false) debug.ts              {"required":["react","react-native","@dems/shared/sim","./core-link","./log"],"hasProbeModule":false,"hasProbeHook":false}
release build (dev=false) secure-credentials.ts {"required":[...],"hasProbeItemName":false,"hasProbePromptTitle":false,"probeExport":"null","hasDeviceItemName":true,"hasUnprotectedRule":true}
    release build holds no probe=ok release build keeps the wrapper=ok
    MB-6a rule as a release build holds it: return Device.isDevice === false || false;
exit=0
```

Two real bundles of the whole app (`expo export`, output in a temp folder, nothing served; 11:32:53 to 11:33:00):

```
## 2. Release bundle
$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --platform android --no-bytecode --output-dir <tmp>/release
Android Bundled 2236ms node_modules/expo-router/entry.js (5889 modules)
release exit=0
bundle bytes: 9942919
probe text (must be 0):
  DEMS-PROBE-W15                     0
  DEMS-PROBE-W12                     0
  dev-probes                         0
  runDevProbe                        0
  devProbeFromUrl                    0
  probe=                             0
  secure-store-wait                  0
  dems.live.probe.v1                 0
  DEMS secure-store probe            0
  secureStoreDevProbe                0
  PROBE_W15_                         0
the wrapper itself (0 today: its only importer is the debug-only probe module; W51 and W56 will import it):
  secure-credentials                 0
  dems.live.device.v1                0
  ExpoSecureStore                    0
  isUnprotectedBiometricItemAllowed  0
positive controls (text that must be there):
  runtime.sim.hydrated               1
  scenario=                          1

## 3. Development bundle (positive control: the same texts are found where they must be)
Android Bundled 2102ms node_modules/expo-router/entry.js (6090 modules)
dev exit=0
bundle bytes: 13180281
  DEMS-PROBE-W15                     1
  DEMS-PROBE-W12                     1
  runtime/dev-probes.ts              1
  dems.live.probe.v1                 1
  runtime/secure-credentials.ts      1
  dems.live.device.v1                1
  ExpoSecureStore                    2
  runtime.sim.hydrated               1
```

The release bundle has the same size as in W12's last check (9,942,919 bytes, `assets/12c_release_bundle_check.log`): today the wrapper reaches the app only through the debug-only probe module. When W51 and W56 import the wrapper, it enters the release bundle; the transform above shows that the probe export is then `null` and the probe item's name is gone.

## 10. The one-command re-probe

If the user sets a PIN and enrols a fingerprint with their own command, the protected steps are re-probed by ONE command, run outside the sandbox from any directory:

```
/bin/sh docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/15_run_w15.sh phone tablet
```

| Point | Behaviour |
|---|---|
| Devices | The targets named, one session each, in turn (no argument: `phone tablet phone2`). Metro 8082 / 8083 / 8084 |
| Label | Each session reads the lock state first and labels its observations "with enrolment" or "without enrolment" (`enrolment.txt`) |
| A prompt | A protected step that does not settle within 8 s is reported as `pending`; the window that took the focus is photographed (`other_window_<n>_<avd>.png`) and listed in `focus_timeline.txt`; the later protected steps are reported as `skipped`; the item is deleted (a delete needs no authentication); the session's cleanup force-stops the app, which closes the prompt. **Nothing is pressed and no fingerprint touch is sent.** The observation is then "prompt shown, not answered" |
| A locked device | `device-session.sh` stops with 77; the runner prints it and goes on to the next target |
| Output | `implementation/assets/15_runs/<target>-<run id>/` |
| The variant in which the user answers the prompts | `W15_WAIT=1 /bin/sh .../15_run_w15.sh phone` uses the probe name `secure-store-wait`: 60 s per protected step, so that the USER can touch the sensor at each prompt (their action; no agent does it). Then all three MB-8 observations with enrolment are recorded in one run |

With enrolment and nobody answering, one run shows only the first observation (the write prompts). The read and the rotation write need the variant with the user at the sensor.

## 11. Findings, deviations, decisions

### Findings

| ID | Finding | Source |
|---|---|---|
| F37-1 | On all three AVDs, without enrolment: a protected write is refused in 1 to 47 ms with `ERR_AUTHENTICATION`, class "no biometrics enrolled"; no prompt; nothing stored. `canUseBiometricAuthentication()` is `false`. The unprotected item works | Section 6.2 |
| F37-2 | `Device.isDevice` is `false` on all three (CA-06 confirmed); API 36; fingerprint hardware present, nothing enrolled | Section 6.2, S0 |
| F37-3 | The library checks enrolment before it creates the protected key: `getOrCreateKeyEntry` calls `assertBiometricsSupport()` (`SecureStoreModule.kt:333-338`), which requires `BIOMETRIC_STRONG` (`AuthenticationHelper.kt:59-67`). So on Android a protected item cannot exist without an enrolled strong biometric | Library source; matches F37-1 |
| F37-4 | The premise of MB-5 ("emulators do not require authentication to read a protected item") is the package's note about iOS simulators (`build/SecureStore.d.ts:62`: "unlike real iOS devices"). On an Android emulator the write is refused without enrolment; with enrolment the source prompts as on a device. MB-5 case (b) therefore does not occur on these AVDs | Library source; F37-1 |
| F37-5 (hypothesis, source only) | With enrolment every protected write and read prompts (`AESEncryptor.kt:88`, `:131`): one prompt at enrolment, two per biometric sign-in. That is the DEPARTURE-6 condition for every Android build, not only for emulators | Section 7.2; unobserved |
| F37-6 | On Android the `requireAuthentication` option of a READ is ignored; the stored item's own flag decides (`SecureStoreModule.kt:130`). The wrapper still passes the marker's flag | Library source |
| F37-7 | The native error text names the key and the keychain, never the value (`SecureStoreExceptions.kt`). The wrapper passes on none of it | Library source |
| F37-8 | Both full suite runs printed "A worker process has failed to exit gracefully" once; exit 0, 870 of 870 both times. The note predates this row and comes and goes: baseline gate note N-4 (`initialization/02_baseline_gate.md:276`), `assets/22b_gate_mobile_test.log` (72 suites / 833 tests) have it; W12's three logs (`12_`, `12b_`, `12c_gate_mobile_test.log`) do not. The two new suites alone run in 1.2 s without it. Which suite leaves the worker busy was not determined | `assets/15_gate_mobile_test.log`, `15_gate_mobile_test_run2.log` |
| F37-9 | What the probe leaves on a device: an empty `SecureStore.xml`, one `runtime.sim.hydrated` log record per launch, and (inferred) one empty-purpose Keystore key | Section 6.3 |
| F37-10 | A sandboxed `adb devices` (before the first session) could not reach the adb server and its own daemon start failed ("ADB server didn't ACK"). The running adb server was not affected: the next command, outside the sandbox, listed the three devices | Command log, 11:29:08 |

### Deviations

| ID | Deviation | Why |
|---|---|---|
| DV37-1 | The wrapper exports more than "read, write and delete for the three items" (MP-1): `rotateBiometricToken`, `isUnprotectedBiometricItemAllowed`, and the debug-only `secureStoreDevProbe`. And less: the marker has no write or delete of its own; it is written with the token and deleted with it | The rules of MB-2, MB-6 and MB-6a then hold for every caller, and the probe keeps the single-importer rule |
| DV37-2 | `deleteDeviceCredential` also deletes both biometric items | MB-2 |
| DV37-3 | `dev-probes.ts`: one existing line changed (the log prefix now looks the tag up per probe name); a second probe name, `secure-store-wait` | W12's lines are unchanged; the 60 s variant makes the re-probe with the user at the sensor one command |
| DV37-4 | `jest.setup.ts`: the import line changed (`beforeEach` added); a `beforeEach` resets both mocks before every test of every suite; two `declare global` variables are visible to the type checker in the whole mobile workspace | The switches must be reachable without naming the package under `src/` |
| DV37-5 | `expo-device` got an explicit mock although jest-expo supplies one | TS-16 asks for one only "if jest-expo does not supply one"; AC-C-105 needs a switchable `isDevice` |
| DV37-6 | The probe adds a step the row does not list: P5, a protected write over the stored value | It is the wrapper's own rotation path (`rotateBiometricToken` does not delete first) |
| DV37-7 | Two runs per device instead of one | Run 1's screencap showed the opening animation; run 2 adds the settled screencap |
| DV37-8 | Raw run output is under `implementation/assets/15_runs/`; the pre-images are file copies under `.cache/rollback/W15/` | Section 2 |
| DV37-9 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Shared files in a parallel run (P8); this document and the progress file carry the row |

### Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| DN37-1 | DP-2: record the case per AVD | MB-5 case (c) on `dems2_phone`, `dems2_tablet`, `dems2_phone2`, observed without enrolment (AC-C-71) |
| DN37-2 | Which mode W56 passes to `writeBiometricToken` | `'unprotected'`, pending the re-probe. Reason: F37-5; with `'protected-with-fallback'` an AVD that gets a fingerprint later would store a protected token and ask twice per sign-in. On a physical device in a release build `'unprotected'` is refused and biometric sign-in stays off, which is the U4 state MB-6a describes. If the re-probe shows a single prompt, `'protected-with-fallback'` becomes the better choice |
| DN37-3 | The re-probe after the user's enrolment | The command of section 10; the `W15_WAIT=1` variant if all three observations with enrolment are wanted |
| DN37-4 | F37-4: the premise of MB-5 case (b) | Record as drift of the client spec; no code consequence |
| DN37-5 | DV37-1, DV37-2, DV37-4: the wrapper's surface and the two test globals | Accept |
| DN37-6 | F37-8 | No action for this row: the note is the known N-4 of the baseline gate |

## 12. Rollback

| Class | Path | Command |
|---|---|---|
| R-PRE | `apps/mobile/src/runtime/dev-probes.ts` | `cp .cache/rollback/W15/dev-probes.ts.pre apps/mobile/src/runtime/dev-probes.ts` (SHA-256 `79d2a7a9...a59ba2`). The file is not in `acaff20`, so `git checkout acaff20` does not apply to it |
| R-CO | `apps/mobile/jest.setup.ts` | `git checkout acaff20 -- apps/mobile/jest.setup.ts` (the pre-image equals `acaff20`) |
| R-NEW | `apps/mobile/src/runtime/secure-credentials.ts`, `secure-credentials.test.ts`, `secure-store-import.test.ts` | Remove the three files, after `dev-probes.ts` is restored (it imports the wrapper) |

After a rollback: `npm run test -w @dems/mobile -- --maxWorkers=2` must give 72 suites / 833 tests. The devices need nothing: the probe item is gone and no setting was changed.

## 13. Commands run (in order)

| Time | Command | Sandbox |
|---|---|---|
| 11:16 to 11:22 | Reading: blueprint row and P1 to P25, client spec 9.1 and 9.3, plan W15, decisions, documents 12, 13 and 06, `dev-probes.ts`, `debug.ts`, `jest.setup.ts`, the library's Kotlin and type files | inside |
| 11:18:37 | `git diff acaff20 -- <two paths> > .cache/rollback/W15.pre.patch`; two file copies | inside |
| 11:27:29 | `npm run typecheck -w @dems/mobile` (exit 0) | inside |
| 11:28 | `npm run test -w @dems/mobile -- --maxWorkers=2 <the two new files>` (2 suites, 37 tests, exit 0) | inside |
| 11:29:08 | `sh -n` on the two scripts; `adb devices` (failed: F37-10); `eslint` on the five files (exit 0) | inside |
| 11:29:16 to 11:29:28 | `/bin/sh .../15_run_w15.sh phone` | outside (adb, Metro's port) |
| 11:29:37 to 11:30:02 | `/bin/sh .../15_run_w15.sh tablet phone2` | outside |
| 11:30:17 to 11:31:02 | `npm run test -w @dems/mobile -- --maxWorkers=2` (exit 0) | inside |
| 11:30:24 | Read-only after-state queries | outside |
| 11:31 | `node .../15_release_gate_w15.cjs` (exit 0) | inside |
| 11:31:35 to 11:32:43 | `/bin/sh .../15_run_w15.sh` (all three, exit 0) | outside |
| 11:32:53 to 11:33:00 | Two `expo export` runs into a temp folder (exit 0, 0) | inside |
| 11:33:01 | Read-only after-state queries (`15_after_state.txt`) | outside |
| 11:33:35 to 11:33:57 | `npm run typecheck -w @dems/mobile`; `npm run lint -w @dems/mobile` (exit 0, 0) | inside |
| 11:34 | Read-only listing of the runtime log's record sources on two devices | outside |
| 11:34:56 to 11:36:12 | Second full suite run (F37-8): 74 suites, 870 tests, exit 0 | inside |

No `timeout` command, no `rm`, no `cd` into a subfolder, no `npm install`, no Gradle.

## 14. Assets (`implementation/assets/`)

| File | Content |
|---|---|
| `15_run_w15.sh`, `15_device_w15.sh` | The one-command runner and the device commands |
| `15_runs/<target>-<run>/` (6 folders) | `session.log`, `session_exit.txt`, `logcat_probe.txt`, `logcat_reactnativejs_tail.txt`, `lock_state_start.txt`, `lock_state_end.txt`, `enrolment.txt`, `focus_timeline.txt`, `app_data_before.txt`, `app_data_after.txt`, `app_prefs_after.txt`, `metro_tail.txt`, `screen_<avd>.png`; run 2 also `screen_settled_<avd>.png` |
| `15_run2_all_devices.log` | The full output of the one-command run of all three devices |
| `15_observations_summary.txt` | Every probe line of the six runs, one per step |
| `15_dems2_phone_probe.png`, `15_dems2_tablet_probe.png`, `15_dems2_phone2_probe.png` | Screencap at the end of the probe (run 1) |
| `15_dems2_phone_settled.png`, `15_dems2_tablet_settled.png`, `15_dems2_phone2_settled.png` | Screencap 7 s later (run 2): the sign-in screen, Simulated |
| `15_after_state.txt` | Read-only state of the three devices and the host at 11:33:01 |
| `15_gate_mobile_test.log`, `15_gate_mobile_test_run2.log`, `15_gate_static.log` | The gates |
| `15_release_gate_w15.cjs`, `15_release_transform.log`, `15_release_bundle_check.log` | The release-bundle proof |
| `15_dev_probes.diff`, `15_jest_setup.diff` | Diffs against the pre-images |

---
*Generated: 2026-10-04 11:38*
