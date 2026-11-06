---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier D, model sonnet)
blueprint_row: 24 (plan W02, emulator cold boot)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 24 (W02, emulator cold boot)

Status: complete

## Result

| AVD | Serial | PID in `.locks/<avd>.pid` | Cold-boot proof | `sys.boot_completed` | `adb` state |
|---|---|--:|---|:-:|---|
| `dems_phone` | `emulator-5554` | 84074 | "Emulator is performing a full startup", "Boot completed in 13824 ms" | 1 | device |
| `dems_tablet` | `emulator-5556` | 84299 | same line, "Boot completed in 10381 ms" | 1 | device |
| `dems_phone2` | `emulator-5558` | 84494 | same line, "Boot completed in 12371 ms" | 1 | device |

All three process command lines carry `-no-snapshot-load -no-snapshot-save` (3 of 3 matched; quoted in `initialization/05_emulator_cold_boot.md` section 5.3). No retry was needed. The emulators were not running before the row (no process, empty `adb devices`, the three old PIDs of 2026-10-01 dead), so nothing was kept or flagged.

## Files created or updated

- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/initialization/05_emulator_cold_boot.md` (new, the row's expected output)
- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_24.md` (new, this file)
- `/Users/gsp-budi/Documents/DEMS/.locks/dems_phone.pid` (overwritten: 95964 to 84074)
- `/Users/gsp-budi/Documents/DEMS/.locks/dems_tablet.pid` (overwritten: 92922 to 84299)
- `/Users/gsp-budi/Documents/DEMS/.locks/dems_phone2.pid` (overwritten: 97196 to 84494)

`.locks/` is git-ignored, so `git status` shows no change from this row. No other file was touched; the predecessor's `.locks/*.emulator.log` files are as they were.

## For the controller to record

1. **Milestone.** W02 done: three emulators up, cold, between 06:27:20 and 06:28:19 WIB; the boots took 10 to 14 s each. H-14 is now live (host processes until the user closes them).
2. **adb server left running (P7 deviation, deliberate).** PID 83893 (`adb -L tcp:5037 fork-server server`), started by this row's first `adb` call. It is the transport to the three emulators and W06 and every device row need it, so it was not stopped. If the controller wants P7 read literally, `adb kill-server` stops it and affects no emulator. Decide and record.
3. **Nice 5 (R14 materialised).** All three emulators run at nice 5, inherited from the agent shell. Device checks may be slower under load. The R14 remedy (the user boots them from a Terminal) was not needed for the boot itself, which was fast on an idle host.
4. **The DEMS app is installed on all three.** `pm list packages | grep dems` returns `package:com.dems.demo.tablet` on 5554, 5556 and 5558 (information only; the cold boot kept the data partition). Build class (DEBUG or RELEASE-SIGNED) and certificate digest were not read: that is W06's work and the input to DP-1 (default A, decided by D17). No decision is needed from this row.
5. **No `blocked` outcome.** Step 28 (W06) starts on its normal dependency; no "start W06 anyway" case arises.
6. **Not done, by rule.** No install, no app start, no `adb reverse`, no emulator setting change, no wipe, no snapshot use, no kill, no `npm run emulator`.

## Blockers

None.

## Deviations

- Logs of this run are in the session scratchpad (`/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/<avd>.log`) and not in `.locks/<avd>.emulator.log`, to leave the predecessor's logs intact; the key lines are quoted in the initialization document.
- The detach wrapper is `device-session.sh`'s perl `setsid` exec, not a bare `nohup ... &`; same flags as 02_plan section 5.5.
