# coder-execution, controller row W02b (lock-free emulators, D58) and its follow-up (D63)

Status: **complete** (row: 2026-10-04 10:31 to 10:58 WIB; follow-up: 11:04 to 11:24 WIB)

Output document: `initialization/06_lock_free_emulators.md` (VERDICT: PASS; the follow-up is its section 17).

## Milestones, row W02b

| Time (WIB) | Milestone |
|---|---|
| 10:31 | Inputs read (decisions D33/D35/D47/D49, F33/F36; protocol P3/P6/P7/P10/P19/P21/P22/P23; `05_emulator_cold_boot.md`; step 35 report; `device-session.sh`; the old `config.ini` files). Before state recorded, read-only: three old emulators up, all `isKeyguardShowing=true`, `RUNNING_LOCKED` |
| 10:32 | P23 pre-image `.cache/rollback/W02b.pre.patch` (3,294 bytes) saved and proven on a scratch copy |
| 10:34 to 10:36 | `device-session.sh`: `DEMS_AVD_PREFIX` (default `dems2_`), screen-lock check (exit 77), header and usage text. `sh -n`, `bash -n`, `zsh -n` OK; usage and bad-value paths exit 64 |
| 10:35 | Stub dry run: secure lock gives exit 77 and `<commands>` do not run; default prefix boots `-avd dems2_<target>`, `DEMS_AVD_PREFIX=dems_` boots `-avd dems_<target>`; old vs new trace differs by the three added calls only |
| 10:37 | AVDs `dems2_phone`, `dems2_tablet`, `dems2_phone2` created with `avdmanager` (first attempt failed on a quoting error of mine and created nothing); `config.ini` aligned: byte-identical to the old ones (same SHA-256) |
| 10:38 | Old emulators stopped gracefully under their device locks (`adb emu kill`): PIDs 84074, 84299, 84494; ports free |
| 10:38 to 10:41 | New emulators booted cold through the script, one after another: PIDs 68181 (5554), 68876 (5556), 70102 (5558) |
| 10:42 | Lock state, read-only: `isKeyguardShowing=false`, `RUNNING_UNLOCKED`, `locksettings get-disabled` = `true`, `CredentialType: NONE`, no fingerprint, on all three |
| 10:42 to 10:43 | APK verified (SHA-256 `d89c9be3...8a14ec`, certificate `fac61745...033b9c`) and installed in a device session per emulator; `base.apk` on each device = host APK |
| 10:44 to 10:47 | Launch check (`13_launch_check.sh`, unchanged) on tablet, phone2, phone: status 0 each; the screencaps show the sign-in screen with "Core: DEMS-IR-01 • paired (simulated)" |
| 10:48 to 10:51 | After state: three `device`, no reverse rule, no Metro, no session process left; old AVD `config.ini` / `.ini` hashes and mtimes unchanged. Final script file (one comment reflowed, code identical) run again on all three and through the stub dry run |

## Milestones, follow-up (controller message after the gate; D63)

No device session was run and nothing but read-only queries was sent to the emulators.

| Time (WIB) | Milestone |
|---|---|
| 11:04 | Follow-up read. Background checked: project memory note `feedback-no-device-security-changes`, decision D60, the README's enrolment block (old lock value masked while reading) |
| 11:08 | P23 pre-image `.cache/rollback/W02b_followup.pre.patch` (13,433 bytes) saved and proven; working copy `device-session.sh.w02b-new` made next to the script |
| 11:09 to 11:11 | Part A written on the working copy: port guard in `ensure_avd`, name check when the own AVD runs and after a boot, corrected "step-72" log line, header. Stub dry run: 17 cases (foreign emulator: 69, no boot, PID file untouched, `<commands>` not run; own AVD running: one added read-only call, same log lines; nothing on the port: same emulator call) |
| 11:11 | The guard's queries run read-only on the three real emulators: each port has exactly one emulator process, and `emu avd name` equals the session's AVD |
| 11:12 | Atomic replace: `mv -f` of the tested copy over `device-session.sh` (inode 13963922 to 14183999, SHA-256 `8baf7a8d...52ec0091`); `sh -n`, `bash -n`, `zsh -n`, usage path OK |
| 11:14 | Part B written: `apps/mobile/scripts/emulator-user-lock.sh` (391 lines, mode 755): `status` for any caller; `setup`, `unlock`, `remove` behind the terminal check (exit 77) and the device lock |
| 11:18 | Stub tests: 123 of 123 under `/bin/sh` and under `dash` (first run showed 16 failures caused by a bug in my stub, `${*#prefix}`; the helper was not changed). `shellcheck` is not installed |
| 11:18 | From this agent's shell: `setup`, `unlock`, `remove` refuse with 77 and the stub's call log is empty; `status` against the three real emulators prints `CredentialType=NONE`, `fingerprint count=0` |
| 11:19 | Final read-only check: three `device`, `dems2_*`, no keyguard, no credential, no fingerprint; PIDs 68181, 68876, 70102 unchanged |

## Files created or updated

Row:

- `apps/mobile/scripts/device-session.sh` (tracked)
- `.cache/rollback/W02b.pre.patch`
- `.locks/dems2_phone.pid`, `.locks/dems2_tablet.pid`, `.locks/dems2_phone2.pid`, `.locks/dems2_*.emulator.log` (written by the script)
- `docs/2026-10-04_dems_backend_rbac_pairing/initialization/06_lock_free_emulators.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_w02b.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/02b_*` (18 files) and `13_dems2_{phone,tablet,phone2}_launch.png`
- Host, outside the workspace: `~/.android/avd/dems2_phone.ini`, `dems2_tablet.ini`, `dems2_phone2.ini` and their `.avd` folders

Follow-up:

- `apps/mobile/scripts/device-session.sh` (tracked; replaced atomically)
- `apps/mobile/scripts/emulator-user-lock.sh` (new, untracked)
- `.cache/rollback/W02b_followup.pre.patch`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/02b_followup_device_session.diff`, `02b_followup_dry_run.sh`, `02b_followup_dry_run.txt`, `02b_user_lock_test.sh`, `02b_user_lock_transcript.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/initialization/06_lock_free_emulators.md` (section 17 appended), this file
- Host: nothing

## Processes

- Stopped by the row (D58): 84074 (`dems_phone`), 84299 (`dems_tablet`), 84494 (`dems_phone2`), each with `adb emu kill`.
- Started and left running: 68181 (`dems2_phone`), 68876 (`dems2_tablet`), 70102 (`dems2_phone2`).
- Started and stopped by the row: three Metro processes (73813, 75902, 77496), one per launch session.
- Follow-up: no process started on a device; the stub harnesses ran `lockf` and `sleep` on scratch files only.
- Not touched: PostgreSQL (19121, port 4432), the adb server (83893).

## Findings, deviations, decisions

Row: `initialization/06_lock_free_emulators.md`, section 16 (F-1 to F-12, DV-1 to DV-9, DN-1 to DN-7); ruled on by D63.

Follow-up: section 17.5 (FU-F1 to FU-F6, FU-DV1 to FU-DV6, FU-DN1 to FU-DN4). First to see:

- F-2 is closed by the port guard; the guard is wider than the literal instruction (it also counts a serial that answers, because `npm run emulator` starts an AVD without `-port`).
- The helper's `setup`, `unlock` and `remove` have not run on a device and will not be run by an agent; what that leaves unverified is listed in section 17.4.
- `status` reads "lock screen disabled" from `dumpsys`, not from `locksettings get-disabled` (FU-F1).
- The terminal check stops accidents, not intent (FU-F4).
- `emulator-user-lock.sh` is a new untracked file for the next checkpoint commit (FU-DN4).

## Not done, by the rules

No PIN, pattern or password typed on a device; no `locksettings` write; no `emu finger`; no
`settings put`; no `-wipe-data`; no `kill` signal to an emulator; nothing deleted, renamed or edited
under `~/.android/avd/dems_*`; no SDK install; no `sudo`; no shell-profile edit; no sign-in, pairing
or biometric set-up in the app. In the follow-up: no device session, no in-place edit of
`device-session.sh`, no run of `setup`, `unlock` or `remove` against a device, no pseudo-terminal,
no change to `README.md` or `package.json`.
