# Delegation progress: coder-execution, step 19 (integration smoke)

Parallel-run file (P8). The controller synthesises it into the shared files. This agent did not write `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md` or `implementation/99_implementation_report.md`.

- **Status:** complete
- **Window:** 2026-10-01 01:55-02:03 WIB
- **Step log:** `implementation/06_integration_smoke.md` (Tier 3)

## Verification (blueprint row 19)

| Check | Result | Evidence |
|---|---|---|
| AC-40 | PASS on both serials | `adb -s emulator-5554 reverse --list` → `host-10 tcp:4400 tcp:4400` / `host-10 tcp:8081 tcp:8081`; `emulator-5556` → `host-24` with the same two rules |
| AC-41 | PASS, three clients | The mock-core log has `"clients":2` (phone clientId 3, tablet clientId 4), then `"clients":3` with the web (clientId 6, origin `http://127.0.0.1:5173`). `heartbeat-seq` t → t+5 s: web 160 → 165, phone 161 → 165, tablet 161 → 165. All "Live"; all `mock-core v0.1.0 · api v1` |
| AC-45 | PASS | `node 51662 … IPv4 … TCP 127.0.0.1:8081 (LISTEN)` |
| `adb reverse --remove-all` | Done on both serials | Lists empty afterwards |
| Every started PID stopped | Yes, emulators excepted (P3/D40) | mock-core 50831/50851/50873/50874 (graceful `shutdown complete`); Vite 50983/51000/51022; Metro 51616/51637/51662; lock holder 51407; adb server 51259; app PIDs 5669/5896 force-stopped |

## Timeline (WIB)

- **01:55** Pre-check.
  - Ports 4400, 8081, 5037 and 5554-5557 were free.
  - `127.0.0.1:5173` was free; only the foreign SMART WMS `[::1]:5173` (PID 3489) was present, and it was left alone.
  - No emulator was running. `.locks/` did not exist, so it was created.
- **01:56:00** mock-core started under the P5 lock (PID 50831 in `.locks/mock-core.pid`; user entry `step-19`).
- **01:56:09** Vite started on `127.0.0.1:5173`.
- **01:56:33 and 01:56:35** Both AVDs booted, each under its own lock.
  - `dems_phone`: `-port 5554`, PID 51262, up in 6 s.
  - `dems_tablet`: `-port 5556`, PID 51273, up in 2 s. Both boots were quick-boot.
- **01:57:01-02:01:03** Device session, with both AVD locks held (phone, then tablet).
  - Reverse rules set with `ANDROID_SERIAL=<serial> npm run mobile:reverse`.
  - Metro started (`127.0.0.1:8081`).
  - The app instances restored from the snapshots reconnected by themselves. Both were force-stopped and relaunched fresh (phone 01:57:32, tablet 01:57:56).
  - Frames captured at 01:58:42.452 and 01:58:47.453.
  - Teardown: apps force-stopped, Metro stopped, reverse rules removed.
- **02:01:03-02:01:23** Vite stopped. mock-core released per P5 (last user, so it was stopped gracefully) and `.locks/mock-core.pid` removed.
- **After 02:01:23** adb server stopped.
- **02:03** Final check.
  - 4400, 8081 and 5037 are free.
  - The emulators are still up (PIDs 51262 and 51273, PPID 1).

## Milestones for the controller

- Step 19 PASS. SC5 is proven end to end on web plus both AVDs at once.
- Both emulators are **left running** for W2/step 67 (D40). PIDs are in `.locks/dems_phone.pid` (51262) and `.locks/dems_tablet.pid` (51273).
- The app is stopped and no reverse rules remain. The adb server is stopped; the next `adb` call restarts it and re-attaches both emulators.

## Decisions and drift to record (proposed)

1. **Scope superset (drift, process):**
   - Row 19 names only `dems_tablet`, and AC-41 is worded for `"clients":2`.
   - This run used web + phone + tablet, per the delegation.
   - The `"clients":2` line exists, plus `"clients":3`.
   - Suggest the AC-41 wording for steps 22/61 accept "≥ 2 clients" (or 3 with both AVDs).
2. **`npm run mobile:reverse` with two emulators:**
   - The script uses bare `adb reverse`, so it needs `ANDROID_SERIAL=<serial>` (or `adb -s`) whenever two devices are attached.
   - The plain form's failure ("more than one device/emulator") is known adb behaviour and was **not run here**.
   - For step 60: add this to the README "Emulator networking" section. Alternatively, a mobile-lane step could make the script serial-aware; not done here (P6).
3. **Quick-boot snapshot holds a running app (env):**
   - After a quick boot, the row-18 app instance resumes and reconnects on its own once the reverse rules exist.
   - Recommendation for steps 57, 59, 61, 67 and the M-rows: `am force-stop com.dems.demo.tablet` before the first launch in a session.
   - Booting with `-no-snapshot-save` kept the row-18 snapshot unchanged.
4. **Both AVD locks held by a pre-gate step:**
   - Step 19 held both locks, like steps 57/59, because it needs both AVDs at once.
   - No other lock users existed.
5. **`uiautomator dump` does not work on the home screen:** it reports "could not get idle state", because of the continuous Skia pulse and heartbeat animation.
   - Screenshots are the evidence, as AC-41 specifies.
   - **Risk hypothesis for step 90 / Maestro (MA ACs):** idle-wait tooling may stall on animated screens. Not verified.
6. **React StrictMode dev double connect on the web** (clientId 5 opened and closed within 1 ms): expected in dev, not a defect.
7. **P5 mechanics confirmed:** one `kill -TERM` on the recorded npm leader PID propagates as a single signal to the server, giving a graceful `shutdown complete` with no forced exit.
   - `.locks/mock-core.pid` is removed after a confirmed stop.
   - `.locks/mock-core.users/` is left empty.
8. **P4 has no row for step 19:** it used Vite 5173 and Metro 8081, as the delegation assigned.

## Files created or updated

- `docs/2026-09-30_dems_demo_stack_setup/implementation/06_integration_smoke.md` (new)
- `docs/2026-09-30_dems_demo_stack_setup/implementation/assets/19_web_t0.png`, `19_web_t5.png` (new)
- `docs/2026-09-30_dems_demo_stack_setup/implementation/assets/mobile/19_dems_phone_t0.png`, `19_dems_phone_t5.png`, `19_dems_tablet_t0.png`, `19_dems_tablet_t5.png` (new; `assets/mobile/` created per P3)
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_step_19.md` (this file)
- `/Users/gsp-budi/Documents/DEMS/.locks/` (new directory):
  - `mock-core.lock`, `dems_phone.lock`, `dems_tablet.lock` (lockf `-k` lock files);
  - `dems_phone.pid` (51262) and `dems_tablet.pid` (51273);
  - an empty `mock-core.users/`.
  - `.gitignore` was not edited; step 25 adds `.locks/`.
