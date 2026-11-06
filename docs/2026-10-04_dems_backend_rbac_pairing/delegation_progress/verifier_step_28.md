# Progress: verifier, step 28 (plan W06, environment check)

| Field | Value |
|---|---|
| Status | **complete** |
| Verdict | PASS-WITH-NOTES |
| Run window | 2026-10-04 06:31:48 to 06:36:34 WIB |
| Output document | `initialization/01_env_check.md` (Tier 3; first line `VERDICT: PASS-WITH-NOTES`; PORTS section first) |
| Port section available from | About 06:36 WIB (written to the output document before the other sections; the full document followed at 06:39) |

## Files

| Action | Path |
|---|---|
| Created | `docs/2026-10-04_dems_backend_rbac_pairing/initialization/01_env_check.md` |
| Created | `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/verifier_step_28.md` |
| Removed | `.locks/mock-core.users/user-manual-test` |
| Removed | `.locks/vite.users/user-manual-test` |
| Created outside the repository | Session scratchpad `w06/apk_cert_digest.py` (helper script, read-only on its input) |
| Changed outside the repository, as a side effect | `~/.maestro/analyze-notification.json` (Maestro's own state, written by the one `maestro --version` start) |

Not written, on purpose: `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md` (controller only, P8); `masterplan/02_plan.md`, `implementation/99_implementation_report.md`, `verification/01_verification.md` (shared files during a parallel run; this row's write list holds only the two removals and its output document).

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 06:31:48 | Port probe inside the sandbox: all task ports free |
| 06:32:26 | Port probe outside the sandbox with `netstat` cross-check: same; foreign listener on 5432 found |
| 06:33:37 | Three emulators read: running, booted, DEMS app installed, no reverse rule, airplane mode off |
| 06:34 | Build class: DEBUG on all three; APK hash on each device; certificate digest from the APK Signing Block; keystore match |
| 06:35:19 | node v26.8.2, npm 11.19.1, 671 GiB free |
| 06:35:22 | Maestro CLI 2.11.0 starts outside the sandbox, exit 0 |
| 06:36:16 | The two stale markers removed |
| 06:36:34 | Closing snapshot: ports unchanged, no process of this row left, emulators and adb server unchanged |

## Results for the controller

- **4432 FREE. 4420 FREE.** All ports this task binds are free. Step 29 (W07) can start.
- **DP-1 input: three of three emulators hold the DEBUG build.**

| Emulator | Running | DEMS build class | Usable for Live checks as it is | What would be needed |
|---|---|---|---|---|
| `dems_phone` (`emulator-5554`) | yes | DEBUG, 0.1.0 / versionCode 1 | yes | Only W13's `adb install -r`; no uninstall |
| `dems_tablet` (`emulator-5556`) | yes | DEBUG, 0.1.0 / versionCode 1 | yes | The same |
| `dems_phone2` (`emulator-5558`) | yes | DEBUG, 0.1.0 / versionCode 1 | yes | The same |

Signing certificate SHA-256 on all three: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (`CN=Android Debug`). Release certificate (on none): `995c1e389ed7df89f3e79a1690b2c14dc7376d928249bbf01de3c83272fd1647`. Installed APK SHA-256 on all three: `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5` (the predecessor's debug APK; equal to the host's `app-debug.apk`).

Recommendation: record DP-1 A with the list `dems_phone`, `dems_tablet`, `dems_phone2`; the "3" line of 02_plan section 5.5 applies (lane 1 `dems_phone`, lane 2 `dems_tablet`, `dems_phone2` reserved). Option B is not needed.

## Findings (candidates for F-n)

| # | Finding | Evidence | Suggested action |
|---|---|---|---|
| a | A PostgreSQL 18 server of the host listens on `*:5432`: `postgres`, PID 312, user `postgres`, `/Library/PostgreSQL/18/bin/postgres -D /Library/PostgreSQL/18/data`, running since 2026-10-01 16:47:43. It corrects F1 (F1 looked only on the `PATH`). No collision with 4432 | 01_env_check.md section 1.4 | Amend F1. Tell W07 and later rows to pass port 4432 explicitly in every command and connection (a fallback to the default port would reach this server). Never touch it. Report to the user that it exists and listens on all interfaces |
| b | All three emulators hold the identical debug APK (324,503,614 bytes), `DEBUGGABLE`, v2-signed with the debug certificate | sections 2.3, 2.4 | Record the DP-1 outcome |
| c | `~/.android/debug.keystore` does not exist on this host. Debug signing uses `apps/mobile/android/app/debug.keystore` (`build.gradle:100-106`), which lives in the folder that prebuild may clear (KI-21) | section 2.5 | W13: after the prebuild and before `adb install -r`, check that `keytool -list -v` on that file prints SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` (PA-03) |
| d | Android 16 (API 36) images print no certificate SHA-256 through `pm` or `dumpsys` (only a 32-bit hash code; `pm get-app-links` is empty for this package) | section 2.4 | Later rows that must identify a build can use the on-device `sha256sum` of `base.apk` and `signatures:[51ed3f60]` (debug) against `3d5ced7b` (release) |
| e | Maestro CLI 2.11.0 starts outside the sandbox (exit 0); the earlier `ExceptionInInitializerError` is a sandbox effect | section 4 | KI-02 stays open as planned (no flows) |
| f | No reverse rule on any emulator; airplane mode off; the DEMS app is not running on any | sections 2.2, 7 | None |
| g | No listener of the other project (`[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`) and none of step 27 (4421, 5176) at the three probe times | section 1.3 | None; a probe is a snapshot |
| h | `.locks/vite.pid` (2026-10-01, PID 73328, gone) is stale; `.cache/apk-backup/` does not exist yet | sections 5, 6 | W13 creates the backup folder; the PID file is the controller's call |

## Deviations from the brief (candidates for DR-n)

| # | Deviation | Reason |
|---|---|---|
| 1 | The certificate was compared with `apps/mobile/android/app/debug.keystore`, not with `~/.android/debug.keystore` | The named file does not exist; the Gradle debug signing config names the project file. Nothing under `apps/mobile/signing/` was read |
| 2 | The certificate digest was computed by a small standard-library script over the APK Signing Block of the host's `app-debug.apk` | The device prints no SHA-256; the script was proven on the release APK (it reproduces the recorded `995c1e38...1647`); the host file is byte-identical to the three installed files |
| 3 | `netstat` and `ps` were added to the `lsof` probes | `lsof` without root sees only this user's processes; `netstat` found the listener on 5432 |
| 4 | The Maestro start carried two environment variables (`MAESTRO_CLI_NO_ANALYTICS=1`, `MAESTRO_DISABLE_UPDATE_CHECK=true`) | P20, loopback only. Their effect was not verified |
| 5 | Maestro changed one file of its own under `~/.maestro/` | Unavoidable side effect of starting the CLI; left as it is |
| 6 | The generic verifier files (`02_plan.md` status, `99_implementation_report.md`, `verification/01_verification.md`) were not written | Parallel run: shared files; the row's write list |

## Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | DP-1 outcome | A (D17), list: `dems_phone`, `dems_tablet`, `dems_phone2`. W12 and W13 may start after it is recorded |
| 2 | F1 and the host PostgreSQL on 5432 | Amend F1; add "always pass 4432 explicitly" to the delegations of W07 and of the database rows; mention the server to the user |

## Blockers

None.

---
*Generated: 2026-10-04 06:40 WIB*
