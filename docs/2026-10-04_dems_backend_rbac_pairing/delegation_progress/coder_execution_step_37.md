# coder-execution, step 37 (plan row W15): early proof (g), the secure-store wrapper, its jest mocks and the emulator probe

| Field | Value |
|---|---|
| Step / row | 37 / W15 |
| Agent | coder-execution |
| Status | **complete** |
| Result line | **Secure storage works on the three debug-build AVDs for the unprotected item. A protected write is refused without enrolment (`ERR_AUTHENTICATION`, "no biometrics enrolled"), with no prompt. DP-2: MB-5 case (c) on `dems2_phone`, `dems2_tablet`, `dems2_phone2`, observed without enrolment.** No fallback row is needed |
| Unobserved | The protected path with an enrolled fingerprint (whether the write, the read and the rotation write prompt). The re-probe is one command (below) |
| Started | 2026-10-04 11:16:27 WIB |
| Last gate | 11:36:12 WIB (second full suite run); device sessions 11:29:16 to 11:32:43 |
| Time box | 60 min; kept (about 22 min to the last device session, document at 11:38) |
| Output document | `implementation/15_secure_store_wrapper_probe.md` |
| Write paths used | The five files of the row; the output document; `implementation/assets/15_*`; `.cache/rollback/W15.pre.patch`, `.cache/rollback/W15/`; this file; temp files under `$TMPDIR` (two `expo export` outputs, one run log) |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md` |

## Files created or updated

| Path | Change |
|---|---|
| `apps/mobile/src/runtime/secure-credentials.ts` | Created: the wrapper, the only importer of `expo-secure-store` (410 lines) |
| `apps/mobile/src/runtime/secure-credentials.test.ts` | Created: 33 tests |
| `apps/mobile/src/runtime/secure-store-import.test.ts` | Created: 4 tests (static scan, AC-C-66) |
| `apps/mobile/jest.setup.ts` | Modified: mocks of `expo-secure-store` and `expo-device`, two test globals, a `beforeEach` reset (178 lines added, 1 changed) |
| `apps/mobile/src/runtime/dev-probes.ts` | Modified: probe `secure-store` and its 60 s variant `secure-store-wait`; per-probe log tag (148 lines added, 1 changed) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/15_secure_store_wrapper_probe.md` | Created: the output document (Tier 3) |
| `docs/.../implementation/assets/15_run_w15.sh`, `15_device_w15.sh` | Created: the one-command runner and the device commands |
| `docs/.../implementation/assets/15_runs/` | Created: six run folders (`phone-w15x112916`, `tablet-w15x112937`, `phone2-w15x112949`, `phone-w15x113135`, `tablet-w15x113157`, `phone2-w15x113221`) |
| `docs/.../implementation/assets/15_dems2_phone_probe.png`, `15_dems2_tablet_probe.png`, `15_dems2_phone2_probe.png`, `15_dems2_phone_settled.png`, `15_dems2_tablet_settled.png`, `15_dems2_phone2_settled.png` | Created: screencaps |
| `docs/.../implementation/assets/15_observations_summary.txt`, `15_after_state.txt`, `15_run2_all_devices.log` | Created |
| `docs/.../implementation/assets/15_gate_mobile_test.log`, `15_gate_mobile_test_run2.log`, `15_gate_static.log` | Created: the gates |
| `docs/.../implementation/assets/15_release_gate_w15.cjs`, `15_release_transform.log`, `15_release_bundle_check.log` | Created: the release-bundle proof |
| `docs/.../implementation/assets/15_dev_probes.diff`, `15_jest_setup.diff` | Created: diffs against the pre-images |
| `.cache/rollback/W15.pre.patch` (0 bytes), `.cache/rollback/W15/dev-probes.ts.pre`, `.cache/rollback/W15/jest.setup.ts.pre` | Created: pre-images (P23) |
| `docs/.../delegation_progress/coder_execution_step_37.md` | Created: this file |

## Verification (quoted)

| Check | Result |
|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` | exit 0; `Test Suites: 74 passed, 74 total`, `Tests: 870 passed, 870 total` (11:30:17 to 11:31:02; again 11:34:56 to 11:36:12) |
| Ledger | 72 / 833 before, 74 / 870 after: `secure-credentials.test.ts` (33), `secure-store-import.test.ts` (4) |
| Static test | `PASS src/runtime/secure-store-import.test.ts`: exactly one file names the package, `runtime/secure-credentials.ts` |
| `npm run typecheck -w @dems/mobile` | exit 0 (11:33:35) |
| `npm run lint -w @dems/mobile` | exit 0 (11:33:57) |
| Release gate | `PASS src/features/settings/heartbeat-release-gate.test.tsx`; release bundle (9,942,919 bytes): 0 lines with any of 11 probe texts; positive controls 1 and 1 |
| Probe, per AVD | 14 PASS, 0 FAIL, twice, on each of the three; six sessions with exit 0 |
| Probe item afterwards | `Z2 probe item absent after the run PASS {"outcome":"ok",...,"read":"absent"}` on each; 0 entries in `shared_prefs/SecureStore.xml` on each |
| `adb reverse --list` | Empty on each device at 11:33:01 |
| Lock state | `isKeyguardShowing=false`, `CredentialType: NONE`, `"count":0` on each device at the start and at the end of every session and at 11:33:01 |

## Observations per AVD (all without enrolment)

| | `dems2_phone` | `dems2_tablet` | `dems2_phone2` |
|---|---|---|---|
| `isDevice` | `false` | `false` | `false` |
| Protected write succeeds | No: `ERR_AUTHENTICATION`, no biometrics enrolled; no prompt | the same | the same |
| Protected read prompts | No prompt; nothing to read (absent) | the same | the same |
| Rotation write prompts | No prompt; the write is refused the same way | the same | the same |
| MB-5 case | (c) | (c) | (c) |
| Screencaps | `15_dems2_phone_probe.png`, `15_dems2_phone_settled.png` | `15_dems2_tablet_probe.png`, `15_dems2_tablet_settled.png` | `15_dems2_phone2_probe.png`, `15_dems2_phone2_settled.png` |

## Re-probe (one command, outside the sandbox)

```
/bin/sh docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/15_run_w15.sh phone tablet
```

It labels each session "with enrolment" or "without enrolment" from the lock state it reads first. A protected step that shows a prompt is recorded as `pending` with a screencap of the window; nothing is pressed and no fingerprint touch is sent. `W15_WAIT=1` in front waits 60 s per protected step for a run in which the user answers the prompts.

## Findings

| ID | Finding |
|---|---|
| F37-1 | Without enrolment a protected write is refused in 1 to 47 ms with `ERR_AUTHENTICATION` ("no biometrics enrolled"); no prompt; nothing stored. The unprotected item works on all three AVDs |
| F37-2 | `Device.isDevice` is `false` on all three; API 36; fingerprint hardware present, nothing enrolled |
| F37-3 | The library refuses to create the protected key without an enrolled strong biometric (`SecureStoreModule.kt:333-338`, `AuthenticationHelper.kt:59-67`) |
| F37-4 | The premise of MB-5 case (b) ("emulators do not require authentication to read a protected item") is the package's note about iOS simulators; it does not describe Android |
| F37-5 | Hypothesis from the library source, not observed: with enrolment every protected write and read prompts (`AESEncryptor.kt:88`, `:131`), so a protected token means one prompt at enrolment and two per biometric sign-in on any Android build |
| F37-6 | On Android the `requireAuthentication` option of a read is ignored; the stored item's flag decides |
| F37-7 | The native error text names the key and the keychain, never the value; the wrapper passes none of it on |
| F37-8 | jest's "A worker process has failed to exit gracefully" note appeared in both full runs (exit 0). It predates this row: baseline gate note N-4, and `22b_gate_mobile_test.log` at 72 / 833 |
| F37-9 | The probe leaves on each device: an empty `SecureStore.xml`, one `runtime.sim.hydrated` log record per launch, and (inferred) one Keystore key of the unauthenticated alias |
| F37-10 | A sandboxed `adb devices` fails ("ADB server didn't ACK"); the running adb server is not affected |

## Deviations

| ID | Deviation |
|---|---|
| DV37-1 | The wrapper also exports `rotateBiometricToken`, `isUnprotectedBiometricItemAllowed` and the debug-only `secureStoreDevProbe`; the marker has no write or delete of its own |
| DV37-2 | `deleteDeviceCredential` also deletes both biometric items (MB-2) |
| DV37-3 | `dev-probes.ts`: one existing line changed (per-probe log tag); a second probe name `secure-store-wait` |
| DV37-4 | `jest.setup.ts`: import line changed; a `beforeEach` in every suite; two `declare global` variables |
| DV37-5 | An explicit `expo-device` mock although jest-expo supplies one (for the `isDevice` switch) |
| DV37-6 | Probe step P5 (a protected write over the stored value) is beyond the row's list |
| DV37-7 | Two runs per device (the second adds the settled screencap) |
| DV37-8 | Pre-images are file copies: `dev-probes.ts` is not in `acaff20`, so the P23 patch is empty |
| DV37-9 | The shared trackers and the implementation report were not written |

## Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| DN37-1 | DP-2: the case per AVD | MB-5 case (c) on the three AVDs, observed without enrolment (AC-C-71) |
| DN37-2 | The mode W56 passes to `writeBiometricToken` | `'unprotected'`, pending the re-probe (F37-5) |
| DN37-3 | The re-probe after the user's enrolment | The command above |
| DN37-4 | F37-4 as drift of the client spec | Record; no code consequence |
| DN37-5 | The wrapper's surface and the two test globals (DV37-1, DV37-2, DV37-4) | Accept |
| DN37-6 | F37-8 | No action for this row |

## Blockers

None.

---
*Generated: 2026-10-04 11:40*
