---
step: 67c
decision: D100
agent: coder-execution
date: 2026-10-01
status: complete
artifact: implementation/72_second_phone_avd.md
---

# coder-execution: step 67c (second phone AVD + any-phone picker)

**Status: complete.** There is one deviation in the proof: the two concurrent sessions landed on different serials only in a harness with a stub adb. On the real devices the phone lock stayed held by lanes the whole time. See 72 §4.

## Files and host changes
- New AVD `dems_phone2` at `/Users/gsp-budi/.android/avd/dems_phone2.avd` (+ `.ini`). Its config.ini is byte-identical to `dems_phone`'s.
- Emulator running: qemu **PID 97196**, serial `emulator-5558`, port 5558, D78 flags. It booted in 24 s and is left running.
- New files in `.locks/`: `dems_phone2.pid` (97196), `dems_phone2.emulator.log`, `dems_phone2.lock` (created by the first session).
- On `emulator-5558`:
  - The step-72 APK is installed (sha256 `cb6b1f51…0be5`, matching 45/47).
  - `USE_BIOMETRIC` and `USE_FINGERPRINT` are granted. There are no runtime permissions to grant.
  - PIN 1234 and one fingerprint are enrolled (`get-disabled=false`, `"count":1`).
- `apps/mobile/scripts/device-session.sh` went from 405 to 476 lines, sha256 `1dff863f…b07ae6e`. It was swapped in with an atomic `mv` at 10:13:13. Changes:
  - New targets `phone2`, `any-phone` and `any`.
  - The session logs its serial at start and exports `AVD_NAME`.
  - The cap watchdog and all 67b behaviour are kept.
- Docs: `implementation/72_second_phone_avd.md`, this file.
- Not written: `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md` and `99_implementation_report.md`. This was a parallel run, so these are left to the controller.

## Usage for lanes
`NO_METRO=1 apps/mobile/scripts/device-session.sh any-phone '<commands using "$SERIAL" or plain adb>'`, or with `METRO_PORT=808x`. `any` adds the tablet.

## For the controller
- Lanes already blocked on `phone` stay in that queue. Only new `any-phone` calls use phone2. Tell the lanes to switch.
- phone2 runs at nice 5, inherited from the agent shell (74b). Its cold starts may be slower than the phone's.
- The in-app biometric binding was not made on phone2. It needs a Metro session: sign in once with a password, then Enable.
- **Rollback:**
  1. `adb -s emulator-5558 emu kill`
  2. `avdmanager delete avd -n dems_phone2`
  3. Remove `.locks/dems_phone2.*`.
  4. Restore the 67b script (sha `81136209…`).
- Nothing was committed. No `dems_phone`/`dems_tablet` process was touched (95964 and 92922 are unchanged).
